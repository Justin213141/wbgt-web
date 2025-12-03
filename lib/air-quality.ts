/**
 * Australian Air Quality Index (AQI) Calculator
 *
 * Uses Open-Meteo Air Quality API with Australian NEPM standards
 * Formula: AQI = (Concentration / NEPM Standard) × 100
 * Overall AQI = maximum across all pollutants
 */

// Open-Meteo Air Quality API endpoint
const AIR_QUALITY_API = 'https://air-quality-api.open-meteo.com/v1/air-quality'

// Australian NEPM standards (μg/m³)
// Using appropriate averaging period standards
const NEPM_STANDARDS: Record<string, number> = {
  pm2_5: 25,           // 24-hour standard
  pm10: 50,            // 24-hour standard
  ozone: 130,          // 8-hour (65 ppb ≈ 130 μg/m³)
  nitrogen_dioxide: 150, // 1-hour (80 ppb ≈ 150 μg/m³)
  sulphur_dioxide: 260,  // 1-hour (100 ppb ≈ 260 μg/m³)
  carbon_monoxide: 10000 // 8-hour (9 ppm ≈ 10,000 μg/m³)
}

// Australian AQI categories
export type AQICategory = 'Very Good' | 'Good' | 'Fair' | 'Poor' | 'Very Poor'

export interface AQIResult {
  overall: number
  category: AQICategory
  dominantPollutant: string
  pollutants: Record<string, {
    concentration: number
    aqi: number
    unit: string
  }>
  timestamp: string
}

export interface AirQualityData {
  current: AQIResult | null
  hourly: AQIResult[]
  fetchedAt: string
  source: 'open-meteo'
}

interface OpenMeteoAirQualityResponse {
  hourly: {
    time: string[]
    pm10: (number | null)[]
    pm2_5: (number | null)[]
    ozone: (number | null)[]
    nitrogen_dioxide: (number | null)[]
    sulphur_dioxide: (number | null)[]
    carbon_monoxide: (number | null)[]
  }
}

/**
 * Get AQI category from AQI value
 */
export function getAQICategory(aqi: number): AQICategory {
  if (aqi <= 33) return 'Very Good'
  if (aqi <= 66) return 'Good'
  if (aqi <= 99) return 'Fair'
  if (aqi <= 149) return 'Poor'
  return 'Very Poor'
}

/**
 * Get color for AQI category
 */
export function getAQIColor(category: AQICategory): string {
  switch (category) {
    case 'Very Good': return '#00e400' // Green
    case 'Good': return '#a3ff00'      // Light green
    case 'Fair': return '#ffff00'      // Yellow
    case 'Poor': return '#ff7e00'      // Orange
    case 'Very Poor': return '#ff0000' // Red
  }
}

/**
 * Calculate Australian AQI for a single pollutant
 */
function calculatePollutantAQI(concentration: number | null, pollutant: string): number | null {
  if (concentration === null || concentration === undefined) return null
  const standard = NEPM_STANDARDS[pollutant]
  if (!standard) return null
  return (concentration / standard) * 100
}

/**
 * Calculate AQI result for a single time point
 */
function calculateAQIForTimepoint(
  data: OpenMeteoAirQualityResponse['hourly'],
  index: number,
  timestamp: string
): AQIResult | null {
  const pollutantResults: Record<string, { concentration: number; aqi: number; unit: string }> = {}
  let maxAqi = 0
  let dominantPollutant = ''

  const pollutantKeys = ['pm2_5', 'pm10', 'ozone', 'nitrogen_dioxide', 'sulphur_dioxide', 'carbon_monoxide'] as const

  for (const pollutant of pollutantKeys) {
    const concentration = data[pollutant]?.[index]
    if (concentration !== null && concentration !== undefined) {
      const aqi = calculatePollutantAQI(concentration, pollutant)
      if (aqi !== null) {
        pollutantResults[pollutant] = {
          concentration,
          aqi: Math.round(aqi * 10) / 10,
          unit: 'μg/m³'
        }
        if (aqi > maxAqi) {
          maxAqi = aqi
          dominantPollutant = pollutant
        }
      }
    }
  }

  if (Object.keys(pollutantResults).length === 0) return null

  const overall = Math.round(maxAqi)
  return {
    overall,
    category: getAQICategory(overall),
    dominantPollutant: formatPollutantName(dominantPollutant),
    pollutants: pollutantResults,
    timestamp
  }
}

/**
 * Format pollutant name for display
 */
function formatPollutantName(pollutant: string): string {
  const names: Record<string, string> = {
    pm2_5: 'PM2.5',
    pm10: 'PM10',
    ozone: 'Ozone (O₃)',
    nitrogen_dioxide: 'NO₂',
    sulphur_dioxide: 'SO₂',
    carbon_monoxide: 'CO'
  }
  return names[pollutant] || pollutant
}

/**
 * Fetch air quality data from Open-Meteo
 */
export async function fetchAirQuality(
  lat: number = -33.8018,
  lon: number = 151.1254
): Promise<AirQualityData> {
  try {
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lon.toString(),
      hourly: 'pm10,pm2_5,ozone,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide',
      timezone: 'GMT',
      forecast_days: '3',
      domains: 'cams_global'
    })

    const response = await fetch(`${AIR_QUALITY_API}?${params}`)

    if (!response.ok) {
      throw new Error(`Air quality API failed: ${response.status}`)
    }

    const data: OpenMeteoAirQualityResponse = await response.json()

    // Calculate AQI for each hour
    const hourlyResults: AQIResult[] = []
    for (let i = 0; i < data.hourly.time.length; i++) {
      const result = calculateAQIForTimepoint(data.hourly, i, data.hourly.time[i])
      if (result) {
        hourlyResults.push(result)
      }
    }

    // Find current hour's data
    const now = new Date()
    const currentHourUTC = now.toISOString().slice(0, 13) + ':00'
    const currentResult = hourlyResults.find(r => r.timestamp.startsWith(currentHourUTC.slice(0, 13))) || hourlyResults[0] || null

    return {
      current: currentResult,
      hourly: hourlyResults,
      fetchedAt: now.toISOString(),
      source: 'open-meteo'
    }
  } catch (error) {
    console.error('Failed to fetch air quality data:', error)
    throw error
  }
}

/**
 * Get AQI for a specific timestamp
 */
export function getAQIForTimestamp(data: AirQualityData, timestamp: string): AQIResult | null {
  // Try to match by hour
  const targetHour = timestamp.slice(0, 13)
  return data.hourly.find(r => r.timestamp.startsWith(targetHour)) || null
}
