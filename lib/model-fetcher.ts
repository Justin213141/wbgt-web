/**
 * Multi-Model Weather Data Fetcher
 *
 * Fetches weather forecast data from multiple models in parallel:
 * - Open-Meteo models (ECMWF, ICON, JMA, UKMO)
 * - BOM ACCESS-G via Cloudflare Worker proxy
 *
 * Features:
 * - Parallel fetching with Promise.allSettled
 * - Graceful error handling per model
 * - Data normalization across different API formats
 * - Rate limit tracking in localStorage
 */

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface NormalizedWeatherData {
  modelName: string
  times: string[]
  temperature: number[]
  humidity: number[]
  windSpeed: number[]
  solarRadiation: number[]
  directRadiation: number[]   // Direct beam radiation (W/m²)
  diffuseRadiation: number[]  // Diffuse radiation (W/m²)
  uvIndex: number[]
  dewPoint: number[]
  apparentTemp: number[]
  cloudCover: number[]
  precipitationProbability: number[]  // Rain chance percentage
}

export interface ModelFetchResult {
  modelName: string
  status: 'success' | 'error'
  data?: NormalizedWeatherData
  error?: string
  fetchTimeMs?: number
}

export interface OpenMeteoResponse {
  latitude: number
  longitude: number
  hourly: {
    time: string[]
    temperature_2m: number[]
    relative_humidity_2m: number[]
    dew_point_2m: number[]
    apparent_temperature: number[]
    wind_speed_10m: number[]
    shortwave_radiation: number[]
    shortwave_radiation_instant?: number[]
    direct_radiation_instant?: number[]
    diffuse_radiation_instant?: number[]
    uv_index: number[]
    cloud_cover: number[]
    precipitation_probability?: number[]
  }
}

export interface BomProxyResponse {
  hourly: {
    time: string[]
    temperature_2m: number[]
    relative_humidity_2m: number[]
    wind_speed_10m: number[]
    shortwave_radiation?: number[]
    shortwave_radiation_instant?: number[]
    direct_radiation_instant?: number[]
    diffuse_radiation_instant?: number[]
    uv_index?: number[]
    dew_point_2m?: number[]
    apparent_temperature?: number[]
    cloud_cover?: number[]
    precipitation_probability?: number[]
  }
}

export type ModelName = 'ecmwf_ifs' | 'gfs_seamless' | 'bom_access'

export interface ModelConfig {
  name: ModelName
  displayName: string
  endpoint: string
  requiresProxy: boolean
}

// ============================================================================
// Configuration
// ============================================================================

export const DEFAULT_LOCATION = {
  lat: -33.87,
  lon: 151.21,
  name: 'Sydney, Australia'
}

export const MODEL_CONFIGS: Record<ModelName, ModelConfig> = {
  ecmwf_ifs: {
    name: 'ecmwf_ifs',
    displayName: 'ECMWF IFS',
    endpoint: 'https://api.open-meteo.com/v1/forecast',
    requiresProxy: false
  },
  gfs_seamless: {
    name: 'gfs_seamless',
    displayName: 'GFS',
    endpoint: 'https://api.open-meteo.com/v1/forecast',
    requiresProxy: false
  },
  bom_access: {
    name: 'bom_access',
    displayName: 'BOM ACCESS-G',
    endpoint: 'https://bom-forecast.justin213141.workers.dev',
    requiresProxy: true
  }
}

export const ALL_MODELS: ModelName[] = Object.keys(MODEL_CONFIGS) as ModelName[]

// Rate limiting configuration
const RATE_LIMIT_KEY_PREFIX = 'weather_api_calls_'
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const RATE_LIMIT_MAX_CALLS = 100 // Per model per hour

// ============================================================================
// Rate Limiting
// ============================================================================

interface RateLimitEntry {
  calls: number
  windowStart: number
}

function getRateLimitKey(modelName: string): string {
  return `${RATE_LIMIT_KEY_PREFIX}${modelName}`
}

function checkRateLimit(modelName: string): { allowed: boolean; remaining: number } {
  if (typeof window === 'undefined') {
    return { allowed: true, remaining: RATE_LIMIT_MAX_CALLS }
  }

  const key = getRateLimitKey(modelName)
  const now = Date.now()

  try {
    const stored = localStorage.getItem(key)
    const entry: RateLimitEntry = stored
      ? JSON.parse(stored)
      : { calls: 0, windowStart: now }

    // Reset window if expired
    if (now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
      entry.calls = 0
      entry.windowStart = now
    }

    const remaining = RATE_LIMIT_MAX_CALLS - entry.calls
    const allowed = entry.calls < RATE_LIMIT_MAX_CALLS

    return { allowed, remaining }
  } catch (error) {
    console.warn('Rate limit check failed:', error)
    return { allowed: true, remaining: RATE_LIMIT_MAX_CALLS }
  }
}

function incrementRateLimit(modelName: string): void {
  if (typeof window === 'undefined') return

  const key = getRateLimitKey(modelName)
  const now = Date.now()

  try {
    const stored = localStorage.getItem(key)
    const entry: RateLimitEntry = stored
      ? JSON.parse(stored)
      : { calls: 0, windowStart: now }

    // Reset window if expired
    if (now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
      entry.calls = 1
      entry.windowStart = now
    } else {
      entry.calls += 1
    }

    localStorage.setItem(key, JSON.stringify(entry))
  } catch (error) {
    console.warn('Rate limit increment failed:', error)
  }
}

export function getRateLimitStatus(modelName?: string): Record<string, { calls: number; remaining: number; resetIn: number }> {
  if (typeof window === 'undefined') return {}

  const models = modelName ? [modelName] : ALL_MODELS
  const status: Record<string, { calls: number; remaining: number; resetIn: number }> = {}

  for (const model of models) {
    const key = getRateLimitKey(model)
    try {
      const stored = localStorage.getItem(key)
      if (!stored) {
        status[model] = { calls: 0, remaining: RATE_LIMIT_MAX_CALLS, resetIn: RATE_LIMIT_WINDOW_MS }
        continue
      }

      const entry: RateLimitEntry = JSON.parse(stored)
      const now = Date.now()
      const resetIn = Math.max(0, RATE_LIMIT_WINDOW_MS - (now - entry.windowStart))

      status[model] = {
        calls: entry.calls,
        remaining: Math.max(0, RATE_LIMIT_MAX_CALLS - entry.calls),
        resetIn
      }
    } catch (error) {
      console.warn(`Failed to get rate limit status for ${model}:`, error)
      status[model] = { calls: 0, remaining: RATE_LIMIT_MAX_CALLS, resetIn: RATE_LIMIT_WINDOW_MS }
    }
  }

  return status
}

// ============================================================================
// URL Construction
// ============================================================================

function buildOpenMeteoUrl(modelName: ModelName, lat: number, lon: number): string {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    models: modelName,
    hourly: [
      'temperature_2m',
      'relative_humidity_2m',
      'dew_point_2m',
      'apparent_temperature',
      'wind_speed_10m',
      'shortwave_radiation',
      'shortwave_radiation_instant',
      'direct_radiation_instant',
      'diffuse_radiation_instant',
      'uv_index',
      'cloud_cover',
      'precipitation_probability'
    ].join(','),
    timezone: 'GMT'
  })

  return `${MODEL_CONFIGS[modelName].endpoint}?${params.toString()}`
}

function buildBomProxyUrl(lat: number, lon: number): string {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lon.toString()
  })

  return `${MODEL_CONFIGS.bom_access.endpoint}?${params.toString()}`
}

/**
 * Build URL for Open-Meteo supplemental data
 * BOM/ACCESS is missing: solar radiation, cloud cover
 * BOM/ACCESS already has: dew_point, uv_index (don't fetch these)
 */
function buildSupplementalDataUrl(lat: number, lon: number): string {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    hourly: 'shortwave_radiation_instant,direct_radiation_instant,diffuse_radiation_instant,cloud_cover',
    timezone: 'GMT',
    past_days: '3',
    forecast_days: '3'
  })

  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`
}

interface SupplementalDataResponse {
  hourly: {
    time: string[]
    shortwave_radiation_instant: number[]
    direct_radiation_instant: number[]
    diffuse_radiation_instant: number[]
    cloud_cover?: number[]
  }
}

/**
 * Fetch supplemental data from Open-Meteo to supplement BOM/ACCESS
 */
async function fetchSupplementalData(lat: number, lon: number): Promise<SupplementalDataResponse | null> {
  const url = buildSupplementalDataUrl(lat, lon)

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000)
    })

    if (!response.ok) {
      console.warn(`Solar radiation fetch failed: HTTP ${response.status}`)
      return null
    }

    return await response.json()
  } catch (error) {
    console.warn('Solar radiation fetch error:', error)
    return null
  }
}

/**
 * Convert timestamp to epoch milliseconds for comparison
 * All timestamps are now UTC (BOM has Z suffix, Open-Meteo uses timezone=GMT)
 */
function timestampToEpoch(timestamp: string): number {
  // If timestamp has Z suffix, it's already UTC
  if (timestamp.endsWith('Z')) {
    return new Date(timestamp).getTime()
  }
  // Open-Meteo with timezone=GMT returns UTC times without Z suffix
  // Append Z to parse as UTC
  return new Date(timestamp + 'Z').getTime()
}

/**
 * Round epoch to nearest hour for matching (handles minor timestamp differences)
 */
function roundToHour(epoch: number): number {
  return Math.round(epoch / 3600000) * 3600000
}

/**
 * Merge supplemental data (solar radiation, cloud cover) into BOM response
 * Note: BOM already has dew_point_2m and uv_index, so we don't overwrite those
 */
function mergeSupplementalData(
  bomData: BomProxyResponse,
  supplementalData: SupplementalDataResponse | null
): BomProxyResponse {
  if (!supplementalData) {
    return bomData
  }

  // Create maps of epoch (rounded to hour) -> values for quick lookup
  const radiationMap = new Map<number, number>()
  const directRadMap = new Map<number, number>()
  const diffuseRadMap = new Map<number, number>()
  const cloudCoverMap = new Map<number, number>()

  supplementalData.hourly.time.forEach((time, index) => {
    const epoch = roundToHour(timestampToEpoch(time))
    radiationMap.set(epoch, supplementalData.hourly.shortwave_radiation_instant[index])
    directRadMap.set(epoch, supplementalData.hourly.direct_radiation_instant[index])
    diffuseRadMap.set(epoch, supplementalData.hourly.diffuse_radiation_instant[index])
    if (supplementalData.hourly.cloud_cover) {
      cloudCoverMap.set(epoch, supplementalData.hourly.cloud_cover[index])
    }
  })

  // Map BOM times to supplemental values using epoch matching
  const mapValues = (valueMap: Map<number, number>) => {
    return bomData.hourly.time.map(time => {
      const epoch = roundToHour(timestampToEpoch(time))
      return valueMap.get(epoch) ?? NaN
    })
  }

  return {
    ...bomData,
    hourly: {
      ...bomData.hourly,
      shortwave_radiation: mapValues(radiationMap),
      shortwave_radiation_instant: mapValues(radiationMap),
      direct_radiation_instant: mapValues(directRadMap),
      diffuse_radiation_instant: mapValues(diffuseRadMap),
      cloud_cover: mapValues(cloudCoverMap)
      // Note: dew_point_2m and uv_index already exist in BOM data
    }
  }
}

function buildModelUrl(modelName: ModelName, lat: number, lon: number): string {
  if (modelName === 'bom_access') {
    return buildBomProxyUrl(lat, lon)
  }
  return buildOpenMeteoUrl(modelName, lat, lon)
}

// ============================================================================
// Data Normalization
// ============================================================================

/**
 * Normalize timestamp to ISO 8601 UTC format with Z suffix
 * Open-Meteo returns timestamps without Z suffix (e.g., "2025-12-17T00:00")
 * BOM returns timestamps with Z suffix (e.g., "2025-12-17T00:00:00Z")
 * This ensures all timestamps are consistently UTC for proper comparison
 */
function normalizeTimestamp(timestamp: string): string {
  if (timestamp.endsWith('Z')) {
    return timestamp
  }
  // Open-Meteo with timezone=GMT returns UTC times without Z suffix
  // Add Z to ensure proper UTC parsing
  return timestamp + ':00Z'
}

export function normalizeModelData(modelName: ModelName, rawData: OpenMeteoResponse | BomProxyResponse): NormalizedWeatherData {
  const hourly = rawData.hourly

  // Handle missing data with fallback arrays
  const rawTimes = hourly.time || []
  // Normalize all timestamps to UTC format with Z suffix
  const times = rawTimes.map(normalizeTimestamp)
  const length = times.length

  // Prefer instant radiation values over hourly averages for WBGT calculation
  const solarRad = hourly.shortwave_radiation_instant || hourly.shortwave_radiation || new Array(length).fill(NaN)

  // Wind speed unit conversion:
  // - Open-Meteo models (ECMWF, GFS) return wind_speed_10m in km/h by default
  // - BOM worker already converts to m/s
  // We need to convert Open-Meteo km/h to m/s for consistent WBGT calculation
  const rawWindSpeed = hourly.wind_speed_10m || new Array(length).fill(NaN)
  const isBomModel = modelName === 'bom_access'
  const windSpeed = isBomModel
    ? rawWindSpeed  // BOM already provides m/s
    : rawWindSpeed.map((v: number) => isNaN(v) ? NaN : v / 3.6)  // Convert km/h to m/s

  return {
    modelName,
    times,
    temperature: hourly.temperature_2m || new Array(length).fill(NaN),
    humidity: hourly.relative_humidity_2m || new Array(length).fill(NaN),
    windSpeed,
    solarRadiation: solarRad,
    directRadiation: hourly.direct_radiation_instant || new Array(length).fill(NaN),
    diffuseRadiation: hourly.diffuse_radiation_instant || new Array(length).fill(NaN),
    uvIndex: hourly.uv_index || new Array(length).fill(NaN),
    dewPoint: hourly.dew_point_2m || new Array(length).fill(NaN),
    apparentTemp: hourly.apparent_temperature || new Array(length).fill(NaN),
    cloudCover: hourly.cloud_cover || new Array(length).fill(NaN),
    precipitationProbability: hourly.precipitation_probability || new Array(length).fill(0)
  }
}

// ============================================================================
// Single Model Fetching
// ============================================================================

export async function fetchSingleModel(
  modelName: ModelName,
  lat: number = DEFAULT_LOCATION.lat,
  lon: number = DEFAULT_LOCATION.lon
): Promise<NormalizedWeatherData> {
  // Check rate limit
  const { allowed, remaining } = checkRateLimit(modelName)
  if (!allowed) {
    throw new Error(`Rate limit exceeded for ${modelName}. Remaining: ${remaining}`)
  }

  const url = buildModelUrl(modelName, lat, lon)
  const config = MODEL_CONFIGS[modelName]

  try {
    // For BOM/ACCESS, fetch solar radiation from Open-Meteo in parallel
    const isBom = modelName === 'bom_access'
    const supplementalPromise = isBom ? fetchSupplementalData(lat, lon) : Promise.resolve(null)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      // Timeout after 15 seconds
      signal: AbortSignal.timeout(15000)
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    let rawData = await response.json()

    // Merge supplemental data for BOM/ACCESS
    if (isBom) {
      const supplementalData = await supplementalPromise
      rawData = mergeSupplementalData(rawData as BomProxyResponse, supplementalData)
    }

    // Increment rate limit counter on success
    incrementRateLimit(modelName)

    // Normalize the data
    return normalizeModelData(modelName, rawData)
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        throw new Error(`Request timeout for ${config.displayName}`)
      }
      throw new Error(`Failed to fetch ${config.displayName}: ${error.message}`)
    }
    throw new Error(`Failed to fetch ${config.displayName}: Unknown error`)
  }
}

// ============================================================================
// Multi-Model Parallel Fetching
// ============================================================================

export async function fetchAllModels(
  lat: number = DEFAULT_LOCATION.lat,
  lon: number = DEFAULT_LOCATION.lon,
  enabledModels: ModelName[] = ALL_MODELS
): Promise<ModelFetchResult[]> {
  console.log(`Fetching ${enabledModels.length} models in parallel for lat=${lat}, lon=${lon}`)

  const startTime = Date.now()

  // Fetch all models in parallel using Promise.allSettled
  const fetchPromises = enabledModels.map(async (modelName): Promise<ModelFetchResult> => {
    const modelStartTime = Date.now()

    try {
      const data = await fetchSingleModel(modelName, lat, lon)
      const fetchTimeMs = Date.now() - modelStartTime

      return {
        modelName,
        status: 'success',
        data,
        fetchTimeMs
      }
    } catch (error) {
      const fetchTimeMs = Date.now() - modelStartTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      console.warn(`Model ${modelName} failed:`, errorMessage)

      return {
        modelName,
        status: 'error',
        error: errorMessage,
        fetchTimeMs
      }
    }
  })

  const results = await Promise.allSettled(fetchPromises)

  const totalTime = Date.now() - startTime
  console.log(`All models fetched in ${totalTime}ms`)

  // Extract results from Promise.allSettled
  const modelResults: ModelFetchResult[] = results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value
    } else {
      // Promise itself was rejected (shouldn't happen with our error handling)
      return {
        modelName: enabledModels[index],
        status: 'error',
        error: result.reason?.message || 'Promise rejected'
      }
    }
  })

  // Log summary
  const successful = modelResults.filter(r => r.status === 'success').length
  const failed = modelResults.filter(r => r.status === 'error').length
  console.log(`Results: ${successful} successful, ${failed} failed`)

  return modelResults
}

// ============================================================================
// Utility Functions
// ============================================================================

export function getSuccessfulModels(results: ModelFetchResult[]): NormalizedWeatherData[] {
  return results
    .filter((r): r is ModelFetchResult & { data: NormalizedWeatherData } =>
      r.status === 'success' && r.data !== undefined
    )
    .map(r => r.data)
}

export function getFailedModels(results: ModelFetchResult[]): Array<{ modelName: string; error: string }> {
  return results
    .filter(r => r.status === 'error')
    .map(r => ({
      modelName: r.modelName,
      error: r.error || 'Unknown error'
    }))
}

export function getModelDisplayName(modelName: ModelName): string {
  return MODEL_CONFIGS[modelName]?.displayName || modelName
}

export function formatFetchTime(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`
  }
  return `${(ms / 1000).toFixed(2)}s`
}

// ============================================================================
// Export Summary
// ============================================================================

export const ModelFetcher = {
  fetchAllModels,
  fetchSingleModel,
  normalizeModelData,
  getSuccessfulModels,
  getFailedModels,
  getRateLimitStatus,
  getModelDisplayName,
  formatFetchTime,
  DEFAULT_LOCATION,
  MODEL_CONFIGS,
  ALL_MODELS
}

export default ModelFetcher
