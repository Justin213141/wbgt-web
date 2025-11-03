export interface WeatherObservation {
  timestamp: string // Format: DD/MM/YYYY, HH:mm:ss
  localTimestamp?: string // Alternative field name
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
