import {
  fetchAllModels,
  getSuccessfulModels,
  type ModelName,
  type NormalizedWeatherData,
  type ModelFetchResult,
  DEFAULT_LOCATION
} from './model-fetcher'
import {
  calculateKongWBGT,
  calculateEnsembleStats,
  type WBGTParams,
  type WBGTResult,
  type ModelEnsemble
} from './kong-wbgt'
import {
  fetchObservationsWithFallback,
  fetchHistoricalObservations,
  type ObservationData,
  type ObservationResult
} from './observation-fetcher'
import { fetchARPANSAUV } from './arpansa-uv'
import { fetchAirQuality, getAQIForTimestamp, type AirQualityData } from './air-quality'

// ============================================================================
// API Endpoints
// ============================================================================

const LEGACY_API_BASE = "https://wbgt-mcp-server.justin213141.workers.dev/api"
const API_BASE = LEGACY_API_BASE // Alias for legacy functions
const BOM_FORECAST_API = "https://bom-forecast.justin213141.workers.dev"

/**
 * Fetch current observations using the new observation fetcher with fallback chain
 *
 * Weather data priority:
 * 1. BOM observations (station 95765)
 * 2. OpenMeteo forecast API (past_days=2)
 * 3. OpenMeteo archive API
 *
 * Solar radiation priority:
 * 1. Satellite API (satellite_radiation_seamless)
 * 2. Satellite API (best_match)
 * 3. OpenMeteo forecast/archive (only if satellite fails)
 *
 * Note: Pressure falls back to OpenMeteo if BOM station doesn't report it
 *
 * @param latOrKey - Latitude number OR SWR cache key string (which is ignored)
 * @param lon - Longitude (optional, uses default if not provided)
 * @param options - Additional options for fetching
 */
export async function fetchObservations(
  latOrKey?: number | string,
  lon?: number,
  options?: { targetDate?: Date }
) {
  // Handle SWR usage where key string is passed as first argument
  // When called by SWR, latOrKey will be the cache key string like "recent-observations"
  const lat = typeof latOrKey === 'number' ? latOrKey : DEFAULT_LOCATION.lat
  const longitude = typeof lon === 'number' ? lon : DEFAULT_LOCATION.lon
  try {
    // Fetch weather observations, ARPANSA UV, and air quality data in parallel
    const [result, arpansaResult, airQualityResult] = await Promise.all([
      fetchObservationsWithFallback(lat, longitude, options),
      fetchARPANSAUV().catch(err => {
        console.warn('ARPANSA UV fetch failed, UV will be unavailable:', err)
        return null
      }),
      fetchAirQuality(lat, longitude).catch(err => {
        console.warn('Air quality fetch failed, AQI will be unavailable:', err)
        return null
      })
    ])

    // Transform to legacy format expected by the app, calculating WBGT for each observation
    const observations = result.observations.map((obs: ObservationData) => {
      // Handle potential NaN values with fallbacks
      const temp = isNaN(obs.temperature) ? 20 : obs.temperature
      const humidity = isNaN(obs.humidity) ? 50 : obs.humidity
      const windSpeed = isNaN(obs.windSpeed) ? 0 : obs.windSpeed
      const solarRad = isNaN(obs.solarRadiation) ? 0 : obs.solarRadiation
      // Calculate dew point using Magnus formula if not provided
      let dewPoint = obs.dewPoint
      if (isNaN(dewPoint)) {
        // Magnus formula: γ = ln(RH/100) + (b*T)/(c+T), Td = (c*γ)/(b-γ)
        const b = 17.625
        const c = 243.04
        const gamma = Math.log(humidity / 100) + (b * temp) / (c + temp)
        dewPoint = (c * gamma) / (b - gamma)
      }
      const pressure = isNaN(obs.pressure) ? 1013 : obs.pressure

      // Estimate cloud cover from solar radiation (BOM observations don't include it)
      // Extract hour from timestamp string to avoid timezone conversion issues
      // obs.time format: "2026-01-14T16:30:00+11:00" or "2026-01-14T16:30:00"
      const hourMatch = obs.time.match(/T(\d{2}):/);
      const hour = hourMatch ? parseInt(hourMatch[1], 10) : new Date(obs.time).getHours();
      const isNight = hour < 6 || hour > 19
      let cloudCover = 50 // Default
      if (!isNight && solarRad > 0) {
        const maxExpectedSolar = 900
        cloudCover = Math.max(0, Math.min(100, 100 - (solarRad / maxExpectedSolar) * 100))
      } else if (!isNight && solarRad === 0) {
        cloudCover = 100
      }

      // Get UV index from ARPANSA (current real-time measurement)
      const uvIndex = arpansaResult?.currentUV ?? undefined

      // Get Australian AQI for this hour
      let airQuality: number | undefined = undefined
      if (airQualityResult) {
        const aqiForHour = getAQIForTimestamp(airQualityResult, obs.time)
        if (aqiForHour) {
          airQuality = aqiForHour.overall
        }
      }

      // Get direct/diffuse radiation (with NaN handling)
      const directRad = isNaN(obs.directRadiation) ? undefined : obs.directRadiation
      const diffuseRad = isNaN(obs.diffuseRadiation) ? undefined : obs.diffuseRadiation

      // Calculate WBGT for this observation
      let wbgt = 0
      let apparentTemp = temp
      try {
        const wbgtResult = calculateKongWBGT({
          temperature: temp,
          relativeHumidity: humidity,
          windSpeed: windSpeed,
          solarRadiation: solarRad,
          directRadiation: directRad,
          diffuseRadiation: diffuseRad,
          latitude: lat,
          longitude: longitude,
          timestamp: new Date(obs.time)
        })
        wbgt = wbgtResult.wbgt
        apparentTemp = wbgtResult.wetBulbTemp + (wbgtResult.globeTemp - wbgtResult.wetBulbTemp) * 0.5
      } catch (e) {
        console.warn('WBGT calculation failed for observation:', obs.time, e)
      }

      return {
        timestamp: obs.time,
        localTimestamp: obs.time,
        temperature: temp,
        humidity: humidity,
        wind_speed: windSpeed,
        wind_speed_ms: windSpeed,
        dew_point: dewPoint,
        solar_radiation: solarRad,
        direct_radiation: isNaN(obs.directRadiation) ? 0 : obs.directRadiation,
        diffuse_radiation: isNaN(obs.diffuseRadiation) ? 0 : obs.diffuseRadiation,
        pressure: pressure,
        weather_source: obs.source.weather,
        solar_source: obs.source.solar,
        pressure_source: obs.source.pressure,
        station: result.metadata.bomStation,
        station_name: result.metadata.bomStationName,
        wbgt,
        apparent_temp: apparentTemp,
        cloud_cover: cloudCover,
        uv_index: uvIndex,
        air_quality: airQuality
      }
    })

    return observations
  } catch (error) {
    console.warn('New observation fetcher failed, falling back to legacy API:', error)

    // Fall back to legacy API
    const response = await fetch(`${LEGACY_API_BASE}/observations`)
    if (!response.ok) {
      throw new Error('Failed to fetch observations')
    }
    const result = await response.json()
    return result.data || result
  }
}

/**
 * Fetch historical observations for a date range
 */
export async function fetchHistoricalObservationsApi(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string
) {
  const result = await fetchHistoricalObservations(lat, lon, startDate, endDate)

  return result.observations.map((obs: ObservationData) => ({
    timestamp: obs.time,
    localTimestamp: obs.time,
    temperature: obs.temperature,
    humidity: obs.humidity,
    wind_speed: obs.windSpeed,
    wind_speed_ms: obs.windSpeed,
    dew_point: obs.dewPoint,
    solar_radiation: isNaN(obs.solarRadiation) ? 0 : obs.solarRadiation,
    direct_radiation: isNaN(obs.directRadiation) ? 0 : obs.directRadiation,
    diffuse_radiation: isNaN(obs.diffuseRadiation) ? 0 : obs.diffuseRadiation,
    pressure: obs.pressure,
    weather_source: obs.source.weather,
    solar_source: obs.source.solar
  }))
}

/**
 * Fetch forecast from legacy API
 * @deprecated Use fetchMultiModelWBGT instead for better accuracy
 */
export async function fetchForecast() {
  const response = await fetch(`${API_BASE}/forecast`)
  if (!response.ok) {
    throw new Error("Failed to fetch forecast")
  }
  const result = await response.json()
  // Handle API wrapper format: { success: true, data: [...] }
  return result.data || result
}

/**
 * Fetch current conditions from legacy API
 * @deprecated Use fetchMultiModelCurrent instead for better accuracy
 */
export async function fetchCurrent() {
  const response = await fetch(`${API_BASE}/current`)
  if (!response.ok) {
    throw new Error("Failed to fetch current conditions")
  }
  const result = await response.json()
  // Handle API wrapper format: { success: true, data: {...} }
  return result.data || result
}

// ============================================================================
// Multi-Model WBGT System - Client-Side Calculations
// ============================================================================

/**
 * Result of calculating WBGT from a single model's weather data
 */
export interface ModelWBGTData {
  modelName: string
  times: string[]
  wbgt: number[]
  globeTemp: number[]
  wetBulbTemp: number[]
  temperature: number[]
  humidity: number[]
}

/**
 * Multi-model WBGT result with ensemble statistics
 */
export interface MultiModelWBGTResult {
  models: ModelWBGTData[]
  ensemble: {
    times: string[]
    mean: number[]
    stddev: number[]
    min: number[]
    max: number[]
  }
  metadata: {
    location: {
      lat: number
      lon: number
    }
    fetchedAt: string
    successfulModels: number
    failedModels: number
  }
}

/**
 * Calculate WBGT for normalized weather data from a single model
 *
 * @param data - Normalized weather data from a forecast model
 * @param lat - Latitude for solar angle calculations
 * @param lon - Longitude (for future use)
 * @returns Calculated WBGT data for each time step
 */
export function calculateWBGTFromModel(
  data: NormalizedWeatherData,
  lat: number,
  lon: number
): ModelWBGTData {
  const wbgt: number[] = []
  const globeTemp: number[] = []
  const wetBulbTemp: number[] = []

  // Calculate WBGT for each hourly data point
  for (let i = 0; i < data.times.length; i++) {
    try {
      // Get direct/diffuse radiation if available (NaN means unavailable)
      const directRad = isNaN(data.directRadiation[i]) ? undefined : data.directRadiation[i]
      const diffuseRad = isNaN(data.diffuseRadiation[i]) ? undefined : data.diffuseRadiation[i]

      const params: WBGTParams = {
        temperature: data.temperature[i],
        relativeHumidity: data.humidity[i],
        windSpeed: data.windSpeed[i],
        solarRadiation: data.solarRadiation[i],
        directRadiation: directRad,
        diffuseRadiation: diffuseRad,
        latitude: lat,
        longitude: lon,
        timestamp: new Date(data.times[i])
      }

      const result = calculateKongWBGT(params)
      wbgt.push(result.wbgt)
      globeTemp.push(result.globeTemp)
      wetBulbTemp.push(result.wetBulbTemp)
    } catch (error) {
      // Handle calculation errors gracefully
      console.warn(`WBGT calculation failed for ${data.modelName} at ${data.times[i]}:`, error)
      wbgt.push(NaN)
      globeTemp.push(NaN)
      wetBulbTemp.push(NaN)
    }
  }

  return {
    modelName: data.modelName,
    times: data.times,
    wbgt,
    globeTemp,
    wetBulbTemp,
    temperature: data.temperature,
    humidity: data.humidity
  }
}

/**
 * Fetch all models and calculate WBGT client-side with ensemble statistics
 *
 * This is the primary function for fetching multi-model WBGT forecasts.
 * It fetches data from multiple weather models in parallel, calculates WBGT
 * for each model, and computes ensemble statistics (mean, stddev, min, max).
 *
 * @param lat - Latitude (default: Sydney)
 * @param lon - Longitude (default: Sydney)
 * @param enabledModels - Optional list of models to fetch
 * @returns Multi-model WBGT result with ensemble statistics
 */
export async function fetchMultiModelWBGT(
  lat: number = DEFAULT_LOCATION.lat,
  lon: number = DEFAULT_LOCATION.lon,
  enabledModels?: ModelName[]
): Promise<MultiModelWBGTResult> {
  // Fetch all models in parallel
  const modelResults: ModelFetchResult[] = await fetchAllModels(lat, lon, enabledModels)

  // Extract successful models
  const successfulData = getSuccessfulModels(modelResults)

  if (successfulData.length === 0) {
    throw new Error('All weather models failed to fetch data')
  }

  // Calculate WBGT for each successful model
  const modelWBGTData: ModelWBGTData[] = successfulData.map(data =>
    calculateWBGTFromModel(data, lat, lon)
  )

  // Prepare ensemble data for statistics calculation
  const ensembleData: ModelEnsemble[] = modelWBGTData.map(model => ({
    modelName: model.modelName,
    wbgtValues: model.wbgt
  }))

  // Calculate ensemble statistics
  const stats = calculateEnsembleStats(ensembleData)

  // Use times from the first model (all should have the same times)
  const times = modelWBGTData[0].times

  return {
    models: modelWBGTData,
    ensemble: {
      times,
      mean: stats.mean,
      stddev: stats.stddev,
      min: stats.min,
      max: stats.max
    },
    metadata: {
      location: { lat, lon },
      fetchedAt: new Date().toISOString(),
      successfulModels: successfulData.length,
      failedModels: modelResults.length - successfulData.length
    }
  }
}

/**
 * Get current conditions from the most recent model data
 *
 * This function fetches multi-model data and returns the current (most recent)
 * WBGT conditions, using the ensemble mean for the current hour.
 *
 * @param lat - Latitude (default: Sydney)
 * @param lon - Longitude (default: Sydney)
 * @returns Current WBGT conditions with ensemble statistics
 */
export async function fetchMultiModelCurrent(
  lat: number = DEFAULT_LOCATION.lat,
  lon: number = DEFAULT_LOCATION.lon
): Promise<{
  wbgt: number
  wbgtMin: number
  wbgtMax: number
  wbgtStddev: number
  temperature: number
  humidity: number
  globeTemp: number
  wetBulbTemp: number
  timestamp: string
  location: { lat: number; lon: number }
  numModels: number
}> {
  // Fetch multi-model WBGT data
  const multiModelData = await fetchMultiModelWBGT(lat, lon)

  // Get the current hour index (index 0 is the current forecast hour)
  const currentIndex = 0

  // Extract current values from ensemble
  const currentWBGT = multiModelData.ensemble.mean[currentIndex]
  const currentMin = multiModelData.ensemble.min[currentIndex]
  const currentMax = multiModelData.ensemble.max[currentIndex]
  const currentStddev = multiModelData.ensemble.stddev[currentIndex]
  const currentTime = multiModelData.ensemble.times[currentIndex]

  // Calculate mean temperature and humidity from all models
  const temperatures = multiModelData.models.map(m => m.temperature[currentIndex])
  const humidities = multiModelData.models.map(m => m.humidity[currentIndex])
  const globeTemps = multiModelData.models.map(m => m.globeTemp[currentIndex])
  const wetBulbTemps = multiModelData.models.map(m => m.wetBulbTemp[currentIndex])

  const avgTemp = temperatures.reduce((sum, t) => sum + t, 0) / temperatures.length
  const avgHumidity = humidities.reduce((sum, h) => sum + h, 0) / humidities.length
  const avgGlobeTemp = globeTemps.reduce((sum, g) => sum + g, 0) / globeTemps.length
  const avgWetBulbTemp = wetBulbTemps.reduce((sum, w) => sum + w, 0) / wetBulbTemps.length

  return {
    wbgt: currentWBGT,
    wbgtMin: currentMin,
    wbgtMax: currentMax,
    wbgtStddev: currentStddev,
    temperature: Number(avgTemp.toFixed(1)),
    humidity: Number(avgHumidity.toFixed(0)),
    globeTemp: Number(avgGlobeTemp.toFixed(1)),
    wetBulbTemp: Number(avgWetBulbTemp.toFixed(1)),
    timestamp: currentTime,
    location: { lat, lon },
    numModels: multiModelData.metadata.successfulModels
  }
}
