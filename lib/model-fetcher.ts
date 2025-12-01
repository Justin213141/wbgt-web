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
  uvIndex: number[]
  dewPoint: number[]
  apparentTemp: number[]
  cloudCover: number[]
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
    uv_index: number[]
    cloud_cover: number[]
  }
}

export interface BomProxyResponse {
  hourly: {
    time: string[]
    temperature_2m: number[]
    relative_humidity_2m: number[]
    wind_speed_10m: number[]
    shortwave_radiation?: number[]
    uv_index?: number[]
    dew_point_2m?: number[]
    apparent_temperature?: number[]
    cloud_cover?: number[]
  }
}

export type ModelName = 'ecmwf_ifs' | 'icon_seamless' | 'jma_seamless' | 'ukmo_seamless' | 'bom_access'

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
  icon_seamless: {
    name: 'icon_seamless',
    displayName: 'ICON Seamless',
    endpoint: 'https://api.open-meteo.com/v1/forecast',
    requiresProxy: false
  },
  jma_seamless: {
    name: 'jma_seamless',
    displayName: 'JMA Seamless',
    endpoint: 'https://api.open-meteo.com/v1/forecast',
    requiresProxy: false
  },
  ukmo_seamless: {
    name: 'ukmo_seamless',
    displayName: 'UKMO Seamless',
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
      'uv_index',
      'cloud_cover'
    ].join(','),
    timezone: 'auto'
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
 * Used to supplement BOM/ACCESS which doesn't provide solar radiation, cloud cover, etc.
 */
function buildSupplementalDataUrl(lat: number, lon: number): string {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    hourly: 'shortwave_radiation_instant,direct_radiation_instant,diffuse_radiation_instant,cloud_cover,dew_point_2m,uv_index',
    timezone: 'auto',
    past_days: '3',
    forecast_days: '3'
  })

  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`
}

interface SolarRadiationResponse {
  hourly: {
    time: string[]
    shortwave_radiation_instant: number[]
    direct_radiation_instant: number[]
    diffuse_radiation_instant: number[]
    cloud_cover?: number[]
    dew_point_2m?: number[]
    uv_index?: number[]
  }
}

/**
 * Fetch supplemental data from Open-Meteo to supplement BOM/ACCESS
 */
async function fetchSupplementalData(lat: number, lon: number): Promise<SolarRadiationResponse | null> {
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
 * Handles both BOM (ISO with Z suffix, UTC) and Open-Meteo (no timezone, local Sydney time)
 */
function timestampToEpoch(timestamp: string): number {
  // If timestamp has Z suffix, it's UTC - parse directly
  if (timestamp.endsWith('Z')) {
    return new Date(timestamp).getTime()
  }
  // OpenMeteo times are local Sydney time (AEDT = UTC+11 or AEST = UTC+10)
  // Append timezone offset to parse correctly
  // Using +11:00 for AEDT (summer time)
  return new Date(timestamp + ':00+11:00').getTime()
}

/**
 * Round epoch to nearest hour for matching (handles minor timestamp differences)
 */
function roundToHour(epoch: number): number {
  return Math.round(epoch / 3600000) * 3600000
}

/**
 * Merge supplemental data (solar, cloud, dew point, UV) into BOM response
 */
function mergeSupplementalData(
  bomData: BomProxyResponse,
  supplementalData: SolarRadiationResponse | null
): BomProxyResponse {
  if (!supplementalData) {
    return bomData
  }

  // Create maps of epoch (rounded to hour) -> values for quick lookup
  const radiationMap = new Map<number, number>()
  const cloudCoverMap = new Map<number, number>()
  const dewPointMap = new Map<number, number>()
  const uvIndexMap = new Map<number, number>()

  supplementalData.hourly.time.forEach((time, index) => {
    const epoch = roundToHour(timestampToEpoch(time))
    radiationMap.set(epoch, supplementalData.hourly.shortwave_radiation_instant[index])
    if (supplementalData.hourly.cloud_cover) {
      cloudCoverMap.set(epoch, supplementalData.hourly.cloud_cover[index])
    }
    if (supplementalData.hourly.dew_point_2m) {
      dewPointMap.set(epoch, supplementalData.hourly.dew_point_2m[index])
    }
    if (supplementalData.hourly.uv_index) {
      uvIndexMap.set(epoch, supplementalData.hourly.uv_index[index])
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
      cloud_cover: mapValues(cloudCoverMap),
      dew_point_2m: mapValues(dewPointMap),
      uv_index: mapValues(uvIndexMap)
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

export function normalizeModelData(modelName: ModelName, rawData: OpenMeteoResponse | BomProxyResponse): NormalizedWeatherData {
  const hourly = rawData.hourly

  // Handle missing data with fallback arrays
  const times = hourly.time || []
  const length = times.length

  return {
    modelName,
    times,
    temperature: hourly.temperature_2m || new Array(length).fill(NaN),
    humidity: hourly.relative_humidity_2m || new Array(length).fill(NaN),
    windSpeed: hourly.wind_speed_10m || new Array(length).fill(NaN),
    solarRadiation: hourly.shortwave_radiation || new Array(length).fill(NaN),
    uvIndex: hourly.uv_index || new Array(length).fill(NaN),
    dewPoint: hourly.dew_point_2m || new Array(length).fill(NaN),
    apparentTemp: hourly.apparent_temperature || new Array(length).fill(NaN),
    cloudCover: hourly.cloud_cover || new Array(length).fill(NaN)
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
