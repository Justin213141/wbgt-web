export interface WeatherObservation {
  timestamp: string // ISO 8601 format: YYYY-MM-DDTHH:mm:ss
  localTimestamp?: string // ISO 8601 format: YYYY-MM-DDTHH:mm:ss (alternative field)
  temperature: number // Celsius
  humidity: number // percentage
  dew_point: number // Celsius
  wind_speed_ms: number // meters per second
  solar_radiation: number // W/m²
  cloud_cover: number // percentage
  uv_index: number
  wbgt: number // Celsius
  esi: number // Environmental Stress Index
  apparent_temp: number // Celsius (feels like)
  rain_chance: number // percentage
  air_quality?: number // optional, only if it's a factor
}

export interface WeatherForecast extends WeatherObservation {
  // Forecast has the same structure as observations
}

export type WBGTZone = "safe" | "caution" | "warning" | "danger"

export interface WBGTZoneInfo {
  zone: WBGTZone
  color: string
  label: string
  description: string
}

// Weather model identifiers
export type WeatherModelId = 'ecmwf_ifs' | 'icon_seamless' | 'jma_seamless' | 'ukmo_seamless' | 'bom_access'

// Model metadata
export interface WeatherModelInfo {
  id: WeatherModelId
  name: string
  source: string
  color: string
  description: string
}

// Normalized weather data from any model
export interface NormalizedWeatherData {
  modelName: WeatherModelId
  times: string[]
  temperature: number[]
  humidity: number[]
  windSpeed: number[]
  solarRadiation: number[]
  uvIndex: number[]
  dewPoint: number[]
  apparentTemp: number[]
}

// Result from fetching a single model
export interface ModelFetchResult {
  modelName: WeatherModelId
  status: 'success' | 'error'
  data?: NormalizedWeatherData
  error?: string
  fetchedAt: string
}

// WBGT calculation result for one time point
export interface WBGTCalculation {
  wbgt: number
  globeTemp: number
  wetBulbTemp: number
  dryBulbTemp: number
}

// WBGT series for one model
export interface ModelWBGTSeries {
  modelName: WeatherModelId
  times: string[]
  wbgt: number[]
  globeTemp: number[]
  wetBulbTemp: number[]
}

// Ensemble statistics across models
export interface EnsembleStats {
  times: string[]
  mean: number[]
  stddev: number[]
  min: number[]
  max: number[]
  modelCount: number
}

// Combined result for display
export interface MultiModelWBGTResult {
  location: { lat: number; lon: number }
  fetchedAt: string
  models: ModelWBGTSeries[]
  ensemble: EnsembleStats
  errors: { modelName: WeatherModelId; error: string }[]
}

export const WEATHER_MODELS: Record<WeatherModelId, WeatherModelInfo> = {
  ecmwf_ifs: {
    id: 'ecmwf_ifs',
    name: 'ECMWF IFS',
    source: 'European Centre',
    color: '#ef4444',
    description: 'European global model'
  },
  icon_seamless: {
    id: 'icon_seamless',
    name: 'ICON',
    source: 'DWD Germany',
    color: '#3b82f6',
    description: 'German weather service model'
  },
  jma_seamless: {
    id: 'jma_seamless',
    name: 'JMA',
    source: 'Japan Met Agency',
    color: '#22c55e',
    description: 'Japanese global model'
  },
  ukmo_seamless: {
    id: 'ukmo_seamless',
    name: 'UK Met Office',
    source: 'UKMO',
    color: '#8b5cf6',
    description: 'UK Met Office model'
  },
  bom_access: {
    id: 'bom_access',
    name: 'BOM ACCESS',
    source: 'Bureau of Meteorology',
    color: '#f97316',
    description: 'Australian ACCESS model'
  }
}
