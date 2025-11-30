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

// ============================================================================
// Legacy API (Cloudflare Worker) - Backward Compatibility
// ============================================================================

const API_BASE = "https://wbgt-mcp-server.justin213141.workers.dev/api"

/**
 * Fetch observations from legacy API
 * Used by Recent page for historical data
 */
export async function fetchObservations() {
  const response = await fetch(`${API_BASE}/observations`)
  if (!response.ok) {
    throw new Error("Failed to fetch observations")
  }
  const result = await response.json()
  // Handle API wrapper format: { success: true, data: [...] }
  return result.data || result
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
      const params: WBGTParams = {
        temperature: data.temperature[i],
        relativeHumidity: data.humidity[i],
        windSpeed: data.windSpeed[i],
        solarRadiation: data.solarRadiation[i],
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
