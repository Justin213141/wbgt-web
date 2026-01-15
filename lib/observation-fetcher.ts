/**
 * Observation Data Fetcher
 *
 * Fetches historical/recent weather observations with robust fallback chains:
 *
 * Weather Data (non-solar):
 * 1. BOM observations (primary, with station fallback)
 *    - Note: Closest station (95765) doesn't report pressure, falls back to OpenMeteo for pressure
 * 2. OpenMeteo fallback:
 *    - 2A: Same day → forecast API with past_days
 *    - 2B: Prior day → archive API with date range
 *
 * Solar Radiation:
 * 1. Satellite API (satellite_radiation_seamless) - primary
 * 2. Satellite API (best_match) - secondary
 * 3. OpenMeteo forecast/archive - only if satellite API completely fails
 */

import { DEFAULT_LOCATION } from './model-fetcher'

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface ObservationData {
  time: string
  temperature: number
  humidity: number
  dewPoint: number
  windSpeed: number
  pressure: number
  solarRadiation: number
  directRadiation: number
  diffuseRadiation: number
  source: {
    weather: 'bom' | 'openmeteo_forecast' | 'openmeteo_archive'
    solar: 'satellite_seamless' | 'satellite_best_match' | 'openmeteo_forecast' | 'openmeteo_archive'
    pressure?: 'bom' | 'openmeteo'
  }
}

export interface ObservationResult {
  observations: ObservationData[]
  metadata: {
    lat: number
    lon: number
    fetchedAt: string
    weatherSource: string
    solarSource: string
    bomStation?: string
    bomStationName?: string
  }
}

interface BomObservationsResponse {
  hourly: {
    time: string[]
    temperature_2m: number[]
    relative_humidity_2m: number[]
    wind_speed_10m: number[]
    surface_pressure?: number[]
    dew_point_2m?: number[]
  }
  station?: {
    code: string
    name: string
  }
}

interface OpenMeteoHourlyResponse {
  hourly: {
    time: string[]
    temperature_2m?: number[]
    relative_humidity_2m?: number[]
    dew_point_2m?: number[]
    surface_pressure?: number[]
    wind_speed_10m?: number[]
  }
}

interface SatelliteRadiationResponse {
  hourly: {
    time: string[]
    // Satellite seamless model fields
    shortwave_radiation_instant_satellite_radiation_seamless?: number[]
    direct_radiation_instant_satellite_radiation_seamless?: number[]
    diffuse_radiation_instant_satellite_radiation_seamless?: number[]
    // Best match model fields
    shortwave_radiation_instant_archive_best_match?: number[]
    direct_radiation_instant_archive_best_match?: number[]
    diffuse_radiation_instant_archive_best_match?: number[]
    // Fallback fields (no model suffix)
    shortwave_radiation_instant?: number[]
    direct_radiation_instant?: number[]
    diffuse_radiation_instant?: number[]
  }
}

// ============================================================================
// Configuration
// ============================================================================

const BOM_FORECAST_API = 'https://bom-forecast.justin213141.workers.dev'

// ============================================================================
// URL Builders
// ============================================================================

/**
 * Build BOM observations URL with lat/lon
 * The bom-forecast worker will find the nearest station automatically
 */
function buildBomObservationsUrl(lat: number, lon: number): string {
  return `${BOM_FORECAST_API}/observations?lat=${lat}&lon=${lon}`
}

/**
 * OpenMeteo forecast API for same-day observations
 * Uses past_days=2, forecast_days=1 to get recent data
 */
function buildOpenMeteoForecastUrl(lat: number, lon: number): string {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    hourly: 'temperature_2m,relative_humidity_2m,dew_point_2m,surface_pressure,wind_speed_10m',
    timezone: 'auto',
    past_days: '2',
    forecast_days: '1'
  })
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`
}

/**
 * OpenMeteo archive API for historical data (prior days)
 */
function buildOpenMeteoArchiveUrl(lat: number, lon: number, startDate: string, endDate: string): string {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    start_date: startDate,
    end_date: endDate,
    hourly: 'temperature_2m,dew_point_2m,relative_humidity_2m,surface_pressure,wind_speed_10m',
    timezone: 'auto'
  })
  return `https://archive-api.open-meteo.com/v1/archive?${params.toString()}`
}

/**
 * Satellite solar radiation API - primary source for solar data
 * Returns both satellite_radiation_seamless and best_match models
 */
function buildSatelliteRadiationUrl(lat: number, lon: number): string {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    hourly: 'shortwave_radiation_instant,direct_radiation_instant,diffuse_radiation_instant',
    models: 'satellite_radiation_seamless,best_match',
    timezone: 'auto',
    past_days: '3'
  })
  return `https://satellite-api.open-meteo.com/v1/archive?${params.toString()}`
}

/**
 * OpenMeteo forecast API for solar radiation (fallback)
 */
function buildOpenMeteoSolarForecastUrl(lat: number, lon: number): string {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    hourly: 'shortwave_radiation_instant,direct_radiation_instant,diffuse_radiation_instant',
    timezone: 'auto',
    past_days: '2',
    forecast_days: '1'
  })
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`
}

/**
 * OpenMeteo archive API for solar radiation (fallback)
 */
function buildOpenMeteoSolarArchiveUrl(lat: number, lon: number, startDate: string, endDate: string): string {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    start_date: startDate,
    end_date: endDate,
    hourly: 'shortwave_radiation_instant,direct_radiation_instant,diffuse_radiation_instant',
    timezone: 'auto'
  })
  return `https://archive-api.open-meteo.com/v1/archive?${params.toString()}`
}

// ============================================================================
// Fetch Functions
// ============================================================================

/**
 * Fetch BOM observations using coordinates
 * The bom-forecast worker finds the nearest station automatically
 */
async function fetchBomObservations(lat: number, lon: number): Promise<BomObservationsResponse | null> {
  const url = buildBomObservationsUrl(lat, lon)

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000)
    })

    if (!response.ok) {
      console.warn(`BOM observations failed: HTTP ${response.status}`)
      return null
    }

    const data = await response.json()
    if (data.hourly && data.hourly.time && data.hourly.time.length > 0) {
      // Keep full station object (code and name)
      return data
    }
    return null
  } catch (error) {
    console.warn('BOM observations fetch error:', error)
    return null
  }
}

/**
 * Fetch OpenMeteo pressure data to supplement BOM (which may not report pressure)
 */
async function fetchOpenMeteoPressure(lat: number, lon: number): Promise<Map<string, number>> {
  const url = buildOpenMeteoForecastUrl(lat, lon)
  const pressureMap = new Map<string, number>()

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000)
    })

    if (!response.ok) return pressureMap

    const data: OpenMeteoHourlyResponse = await response.json()
    if (data.hourly?.time && data.hourly?.surface_pressure) {
      data.hourly.time.forEach((time, i) => {
        if (data.hourly.surface_pressure![i] !== null && data.hourly.surface_pressure![i] !== undefined) {
          pressureMap.set(time, data.hourly.surface_pressure![i])
        }
      })
    }
  } catch (error) {
    console.warn('OpenMeteo pressure fetch error:', error)
  }

  return pressureMap
}

/**
 * Fetch OpenMeteo forecast data (same-day fallback)
 */
async function fetchOpenMeteoForecast(lat: number, lon: number): Promise<OpenMeteoHourlyResponse | null> {
  const url = buildOpenMeteoForecastUrl(lat, lon)

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000)
    })

    if (!response.ok) {
      console.warn(`OpenMeteo forecast failed: HTTP ${response.status}`)
      return null
    }

    return await response.json()
  } catch (error) {
    console.warn('OpenMeteo forecast fetch error:', error)
    return null
  }
}

/**
 * Fetch OpenMeteo archive data (prior day fallback)
 */
async function fetchOpenMeteoArchive(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string
): Promise<OpenMeteoHourlyResponse | null> {
  const url = buildOpenMeteoArchiveUrl(lat, lon, startDate, endDate)

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000)
    })

    if (!response.ok) {
      console.warn(`OpenMeteo archive failed: HTTP ${response.status}`)
      return null
    }

    return await response.json()
  } catch (error) {
    console.warn('OpenMeteo archive fetch error:', error)
    return null
  }
}

/**
 * Fetch satellite solar radiation data
 * Returns data with source priority info
 */
async function fetchSatelliteRadiation(lat: number, lon: number): Promise<{
  data: SatelliteRadiationResponse | null
  source: 'satellite_seamless' | 'satellite_best_match' | null
}> {
  const url = buildSatelliteRadiationUrl(lat, lon)

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000)
    })

    if (!response.ok) {
      console.warn(`Satellite radiation API failed: HTTP ${response.status}`)
      return { data: null, source: null }
    }

    const data: SatelliteRadiationResponse = await response.json()

    // Determine which model has data
    if (data.hourly?.shortwave_radiation_instant_satellite_radiation_seamless?.some(v => v !== null && !isNaN(v))) {
      return { data, source: 'satellite_seamless' }
    }
    if (data.hourly?.shortwave_radiation_instant_archive_best_match?.some(v => v !== null && !isNaN(v))) {
      return { data, source: 'satellite_best_match' }
    }

    console.warn('Satellite API returned no valid radiation data')
    return { data: null, source: null }
  } catch (error) {
    console.warn('Satellite radiation fetch error:', error)
    return { data: null, source: null }
  }
}

/**
 * Fetch OpenMeteo solar radiation as fallback
 */
async function fetchOpenMeteoSolarFallback(
  lat: number,
  lon: number,
  targetDate?: Date
): Promise<{
  data: SatelliteRadiationResponse | null
  source: 'openmeteo_forecast' | 'openmeteo_archive' | null
}> {
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const target = targetDate || now
  const targetDateStr = target.toISOString().split('T')[0]

  // If target is within the last 2 days, use forecast API
  const daysDiff = Math.floor((now.getTime() - target.getTime()) / (1000 * 60 * 60 * 24))

  if (daysDiff <= 2) {
    // Use forecast API
    const url = buildOpenMeteoSolarForecastUrl(lat, lon)
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000)
      })

      if (response.ok) {
        const data = await response.json()
        return { data, source: 'openmeteo_forecast' }
      }
    } catch (error) {
      console.warn('OpenMeteo solar forecast fallback error:', error)
    }
  }

  // Use archive API
  const startDate = new Date(target)
  startDate.setDate(startDate.getDate() - 2)
  const endDate = new Date(target)
  endDate.setDate(endDate.getDate() + 1)

  const url = buildOpenMeteoSolarArchiveUrl(
    lat,
    lon,
    startDate.toISOString().split('T')[0],
    endDate.toISOString().split('T')[0]
  )

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000)
    })

    if (response.ok) {
      const data = await response.json()
      return { data, source: 'openmeteo_archive' }
    }
  } catch (error) {
    console.warn('OpenMeteo solar archive fallback error:', error)
  }

  return { data: null, source: null }
}

// ============================================================================
// Solar Radiation Extraction Helpers
// ============================================================================

interface SolarRadiationValues {
  shortwave: number
  direct: number
  diffuse: number
}

/**
 * Strip timezone offset from ISO timestamp for consistent comparison
 * Handles formats like "2026-01-15T13:30:00+11:00" -> "2026-01-15T13:30:00"
 */
function stripTimezoneOffset(time: string): string {
  // Remove timezone offset like +11:00, -05:00, Z
  return time.replace(/[+-]\d{2}:\d{2}$/, '').replace(/Z$/, '')
}

/**
 * Look up solar radiation values from the map, handling timezone offset differences
 * BOM returns timestamps with timezone offset (+11:00), satellite API returns without
 */
function lookupSolarRadiation(
  solarMap: Map<string, SolarRadiationValues>,
  time: string
): SolarRadiationValues {
  // First try exact match
  let solar = solarMap.get(time)
  if (solar) return solar

  // Strip timezone offset and try again
  const timeNoTz = stripTimezoneOffset(time)
  solar = solarMap.get(timeNoTz)
  if (solar) return solar

  // Try without seconds (HH:MM format)
  const timeShort = timeNoTz.replace(/:00$/, '').replace(/:00:00$/, ':00')
  solar = solarMap.get(timeShort)
  if (solar) return solar

  // Try with seconds added
  if (!timeNoTz.match(/:\d{2}:\d{2}$/)) {
    solar = solarMap.get(`${timeNoTz}:00`)
    if (solar) return solar
  }

  return { shortwave: NaN, direct: NaN, diffuse: NaN }
}

/**
 * Interpolate solar radiation for :30 timestamps
 * Solar data is only available hourly, so :30 values are computed as
 * the average of the current hour and next hour values
 */
function interpolateSolarRadiation(
  observations: ObservationData[],
  solarMap: Map<string, SolarRadiationValues>
): ObservationData[] {
  return observations.map((obs, index) => {
    // Check if this is a :30 timestamp
    const isHalfHour = /:30/.test(obs.time)
    if (!isHalfHour) return obs

    // Strip timezone offset for consistent processing
    const timeNoTz = stripTimezoneOffset(obs.time)

    // Get the current hour timestamp (for looking up in solarMap)
    const currentHourTime = timeNoTz.replace(/:30:00$/, ':00:00').replace(/:30$/, ':00')

    // Get the next hour timestamp by string manipulation (avoid timezone conversion)
    // Parse hour from timestamp like "2025-12-06T13:00:00" or "2025-12-06T13:00"
    const hourMatch = currentHourTime.match(/T(\d{2}):/)
    if (!hourMatch) return obs

    const currentHour = parseInt(hourMatch[1], 10)
    const nextHour = (currentHour + 1) % 24
    const nextHourStr = nextHour.toString().padStart(2, '0')

    // Handle day rollover for midnight
    let nextHourTime = currentHourTime.replace(/T\d{2}:/, `T${nextHourStr}:`)
    if (nextHour === 0) {
      // Day rollover - increment the date
      const dateMatch = currentHourTime.match(/(\d{4})-(\d{2})-(\d{2})/)
      if (dateMatch) {
        const d = new Date(parseInt(dateMatch[1]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[3]))
        d.setDate(d.getDate() + 1)
        const newDateStr = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`
        nextHourTime = nextHourTime.replace(/\d{4}-\d{2}-\d{2}/, newDateStr)
      }
    }

    // Try to get solar values for current and next hour using the lookup helper
    const currentSolar = lookupSolarRadiation(solarMap, currentHourTime)
    const nextSolar = lookupSolarRadiation(solarMap, nextHourTime)

    // If we have both values, interpolate
    if (!isNaN(currentSolar.shortwave) && !isNaN(nextSolar.shortwave)) {
      return {
        ...obs,
        solarRadiation: (currentSolar.shortwave + nextSolar.shortwave) / 2,
        directRadiation: (currentSolar.direct + nextSolar.direct) / 2,
        diffuseRadiation: (currentSolar.diffuse + nextSolar.diffuse) / 2
      }
    }

    // If we only have current hour, use it (already set from original processing)
    return obs
  })
}

function extractSolarRadiation(
  data: SatelliteRadiationResponse,
  source: 'satellite_seamless' | 'satellite_best_match' | 'openmeteo_forecast' | 'openmeteo_archive',
  index: number
): SolarRadiationValues {
  const h = data.hourly

  if (source === 'satellite_seamless') {
    return {
      shortwave: h.shortwave_radiation_instant_satellite_radiation_seamless?.[index] ?? NaN,
      direct: h.direct_radiation_instant_satellite_radiation_seamless?.[index] ?? NaN,
      diffuse: h.diffuse_radiation_instant_satellite_radiation_seamless?.[index] ?? NaN
    }
  }

  if (source === 'satellite_best_match') {
    return {
      shortwave: h.shortwave_radiation_instant_archive_best_match?.[index] ?? NaN,
      direct: h.direct_radiation_instant_archive_best_match?.[index] ?? NaN,
      diffuse: h.diffuse_radiation_instant_archive_best_match?.[index] ?? NaN
    }
  }

  // OpenMeteo fallback (no model suffix)
  return {
    shortwave: h.shortwave_radiation_instant?.[index] ?? NaN,
    direct: h.direct_radiation_instant?.[index] ?? NaN,
    diffuse: h.diffuse_radiation_instant?.[index] ?? NaN
  }
}

// ============================================================================
// Main Export Function
// ============================================================================

/**
 * Fetch observations with full fallback chain
 *
 * Weather data priority:
 * 1. BOM observations
 * 2. OpenMeteo forecast (past_days=2)
 * 3. OpenMeteo archive
 *
 * Solar radiation priority:
 * 1. Satellite API (satellite_radiation_seamless)
 * 2. Satellite API (best_match)
 * 3. OpenMeteo forecast/archive (only if satellite fails completely)
 *
 * Pressure: Falls back to OpenMeteo if BOM station doesn't report it
 */
export async function fetchObservationsWithFallback(
  lat: number = DEFAULT_LOCATION.lat,
  lon: number = DEFAULT_LOCATION.lon,
  options?: {
    targetDate?: Date
  }
): Promise<ObservationResult> {
  const targetDate = options?.targetDate || new Date()

  // Fetch all data sources in parallel
  // BOM observations use lat/lon - the worker finds the nearest station automatically
  const [bomData, pressureData, satelliteResult] = await Promise.all([
    fetchBomObservations(lat, lon),
    fetchOpenMeteoPressure(lat, lon),
    fetchSatelliteRadiation(lat, lon)
  ])

  // Determine weather source and data
  let weatherData: OpenMeteoHourlyResponse | BomObservationsResponse | null = bomData
  let weatherSource: 'bom' | 'openmeteo_forecast' | 'openmeteo_archive' = 'bom'

  if (!bomData) {
    console.log('BOM failed, trying OpenMeteo forecast...')
    const forecastData = await fetchOpenMeteoForecast(lat, lon)

    if (forecastData?.hourly?.time?.length) {
      weatherData = forecastData
      weatherSource = 'openmeteo_forecast'
    } else {
      console.log('OpenMeteo forecast failed, trying archive...')
      const startDate = new Date(targetDate)
      startDate.setDate(startDate.getDate() - 3)
      const archiveData = await fetchOpenMeteoArchive(
        lat, lon,
        startDate.toISOString().split('T')[0],
        targetDate.toISOString().split('T')[0]
      )

      if (archiveData?.hourly?.time?.length) {
        weatherData = archiveData
        weatherSource = 'openmeteo_archive'
      }
    }
  }

  // Determine solar source and data
  let solarData = satelliteResult.data
  let solarSource: 'satellite_seamless' | 'satellite_best_match' | 'openmeteo_forecast' | 'openmeteo_archive' | null = satelliteResult.source

  if (!solarData || !solarSource) {
    console.log('Satellite API failed, trying OpenMeteo solar fallback...')
    const solarFallback = await fetchOpenMeteoSolarFallback(lat, lon, targetDate)
    solarData = solarFallback.data
    solarSource = solarFallback.source
  }

  // If we still have no data, throw
  if (!weatherData?.hourly?.time?.length) {
    throw new Error('All weather data sources failed')
  }

  // Build solar radiation lookup map
  // Normalize timestamps to handle format differences:
  // - BOM uses: "2025-12-03T10:00:00+11:00" (with seconds and timezone)
  // - Satellite uses: "2025-12-03T10:00" (without seconds or timezone)
  const solarMap = new Map<string, SolarRadiationValues>()
  if (solarData?.hourly?.time && solarSource) {
    solarData.hourly.time.forEach((time, i) => {
      const values = extractSolarRadiation(solarData!, solarSource!, i)

      // Only store if values are valid (satellite API often returns null for recent hours)
      if (!isNaN(values.shortwave) && values.shortwave !== null) {
        // Store original format
        solarMap.set(time, values)

        // Normalize: if time is HH:MM format, also store with :00 seconds
        // e.g., "2025-12-03T10:00" -> also store as "2025-12-03T10:00:00"
        const timePart = time.split('T')[1] || ''
        if (timePart.length === 5) {
          // Format is HH:MM, add seconds
          solarMap.set(`${time}:00`, values)
        } else if (timePart.length === 8) {
          // Format is HH:MM:SS, also store without seconds
          solarMap.set(time.slice(0, -3), values)
        }
      }
    })
  }

  // If satellite data is missing recent hours, fetch forecast data as fallback
  const weatherTimes = weatherData?.hourly?.time || []
  const missingTimes = weatherTimes.filter(time => {
    const timeNoTz = stripTimezoneOffset(time)
    return !solarMap.has(time) && !solarMap.has(timeNoTz) && !solarMap.has(timeNoTz.slice(0, -3))
  })

  if (missingTimes.length > 0) {
    console.log(`Satellite data missing for ${missingTimes.length} hours, fetching forecast fallback...`)
    const forecastFallback = await fetchOpenMeteoSolarFallback(lat, lon, targetDate)
    if (forecastFallback.data?.hourly?.time) {
      forecastFallback.data.hourly.time.forEach((time, i) => {
        const values = extractSolarRadiation(forecastFallback.data!, forecastFallback.source || 'openmeteo_forecast', i)
        if (!isNaN(values.shortwave) && values.shortwave !== null) {
          // Only fill in gaps - don't overwrite satellite data
          if (!solarMap.has(time)) {
            solarMap.set(time, values)
            const timePart = time.split('T')[1] || ''
            if (timePart.length === 5) {
              solarMap.set(`${time}:00`, values)
            } else if (timePart.length === 8) {
              solarMap.set(time.slice(0, -3), values)
            }
          }
        }
      })
    }
  }

  // Merge data into observations
  const observations: ObservationData[] = weatherData.hourly.time.map((time, i) => {
    // Use the helper function to look up solar data with timezone handling
    const solar = lookupSolarRadiation(solarMap, time)
    const h = weatherData!.hourly

    // Get pressure - from BOM if available, otherwise from OpenMeteo fallback
    let pressure = (h as BomObservationsResponse['hourly']).surface_pressure?.[i]
    let pressureSource: 'bom' | 'openmeteo' | undefined = pressure !== undefined && pressure !== null ? 'bom' : undefined

    if (pressure === undefined || pressure === null || isNaN(pressure)) {
      pressure = pressureData.get(time) ?? 1013.25
      pressureSource = pressureData.has(time) ? 'openmeteo' : undefined
    }

    return {
      time,
      temperature: h.temperature_2m?.[i] ?? NaN,
      humidity: h.relative_humidity_2m?.[i] ?? NaN,
      dewPoint: h.dew_point_2m?.[i] ?? NaN,
      windSpeed: h.wind_speed_10m?.[i] ?? NaN,
      pressure,
      solarRadiation: solar.shortwave,
      directRadiation: solar.direct,
      diffuseRadiation: solar.diffuse,
      source: {
        weather: weatherSource,
        solar: solarSource || 'openmeteo_forecast',
        pressure: pressureSource
      }
    }
  })

  // Fix half-hourly timestamps: BOM proxy returns duplicate :00 timestamps
  // for data that should be at :00 and :30
  const seenTimestamps = new Set<string>()
  const fixedObservations = observations.map(obs => {
    if (seenTimestamps.has(obs.time)) {
      // This is a duplicate - it should be :30 data
      // Change :00 to :30 in the timestamp
      const fixedTime = obs.time.replace(/T(\d{2}):00:00([+-]\d{2}:\d{2})?$/, 'T$1:30:00$2')
        .replace(/T(\d{2}):00([+-]\d{2}:\d{2})?$/, 'T$1:30$2')
      return { ...obs, time: fixedTime }
    }
    seenTimestamps.add(obs.time)
    return obs
  })

  // Interpolate solar radiation for :30 timestamps
  // Solar data is only hourly, so :30 values should be the average of adjacent hours
  const uniqueObservations = interpolateSolarRadiation(fixedObservations, solarMap)

  return {
    observations: uniqueObservations,
    metadata: {
      lat,
      lon,
      fetchedAt: new Date().toISOString(),
      weatherSource,
      solarSource: solarSource || 'none',
      bomStation: weatherSource === 'bom' ? (bomData as BomObservationsResponse)?.station?.code : undefined,
      bomStationName: weatherSource === 'bom' ? (bomData as BomObservationsResponse)?.station?.name : undefined
    }
  }
}

/**
 * Fetch observations for a specific date range
 * Uses archive API for dates older than 2 days
 */
export async function fetchHistoricalObservations(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string
): Promise<ObservationResult> {
  // Always use archive APIs for historical data
  const [weatherData, solarData] = await Promise.all([
    fetchOpenMeteoArchive(lat, lon, startDate, endDate),
    (async () => {
      // Try satellite first
      const satellite = await fetchSatelliteRadiation(lat, lon)
      if (satellite.data && satellite.source) {
        return { data: satellite.data, source: satellite.source }
      }
      // Fall back to archive
      const url = buildOpenMeteoSolarArchiveUrl(lat, lon, startDate, endDate)
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(10000)
        })
        if (response.ok) {
          return { data: await response.json(), source: 'openmeteo_archive' as const }
        }
      } catch (e) {
        console.warn('Historical solar fetch failed:', e)
      }
      return { data: null, source: null }
    })()
  ])

  if (!weatherData?.hourly?.time?.length) {
    throw new Error('Failed to fetch historical weather data')
  }

  // Build solar map with timestamp normalization for format compatibility
  const solarMap = new Map<string, SolarRadiationValues>()
  if (solarData.data?.hourly?.time && solarData.source) {
    solarData.data.hourly.time.forEach((time: string, i: number) => {
      const values = extractSolarRadiation(solarData.data!, solarData.source!, i)

      // Store original format
      solarMap.set(time, values)

      // Normalize: handle format differences between APIs
      const timePart = time.split('T')[1] || ''
      if (timePart.length === 5) {
        // Format is HH:MM, also store with :00 seconds
        solarMap.set(`${time}:00`, values)
      } else if (timePart.length === 8) {
        // Format is HH:MM:SS, also store without seconds
        solarMap.set(time.slice(0, -3), values)
      }
    })
  }

  const observations: ObservationData[] = weatherData.hourly.time.map((time, i) => {
    const solar = lookupSolarRadiation(solarMap, time)
    const h = weatherData.hourly

    return {
      time,
      temperature: h.temperature_2m?.[i] ?? NaN,
      humidity: h.relative_humidity_2m?.[i] ?? NaN,
      dewPoint: h.dew_point_2m?.[i] ?? NaN,
      windSpeed: h.wind_speed_10m?.[i] ?? NaN,
      pressure: h.surface_pressure?.[i] ?? 1013.25,
      solarRadiation: solar.shortwave,
      directRadiation: solar.direct,
      diffuseRadiation: solar.diffuse,
      source: {
        weather: 'openmeteo_archive',
        solar: solarData.source || 'openmeteo_archive'
      }
    }
  })

  return {
    observations,
    metadata: {
      lat,
      lon,
      fetchedAt: new Date().toISOString(),
      weatherSource: 'openmeteo_archive',
      solarSource: solarData.source || 'none'
    }
  }
}

// ============================================================================
// Export Summary
// ============================================================================

export const ObservationFetcher = {
  fetchObservationsWithFallback,
  fetchHistoricalObservations,
  DEFAULT_LOCATION
}

export default ObservationFetcher
