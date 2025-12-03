export interface WBGTZone {
  level: number
  label: string
  description: string
}

export function getWBGTZone(wbgtCelsius: number): WBGTZone {
  // Custom performance-based WBGT zones
  if (wbgtCelsius < 20) {
    return {
      level: 0,
      label: "Low Risk",
      description: "Optimal performance conditions",
    }
  } else if (wbgtCelsius < 23) {
    return {
      level: 1,
      label: "Medium Risk", 
      description: "Minor performance impact",
    }
  } else if (wbgtCelsius < 26) {
    return {
      level: 2,
      label: "High Risk",
      description: "Significant performance detriment",
    }
  } else if (wbgtCelsius < 29) {
    return {
      level: 3,
      label: "High Risk",
      description: "Major performance detriment",
    }
  } else {
    return {
      level: 4,
      label: "Extreme Risk",
      description: "Dangerous performance conditions",
    }
  }
}

export function getWBGTZoneColor(zone: WBGTZone) {
  const colors = {
    0: { bg: "#dcfce7", text: "#166534", border: "#22c55e" },
    1: { bg: "#fef9c3", text: "#854d0e", border: "#eab308" },
    2: { bg: "#fed7aa", text: "#9a3412", border: "#f97316" },
    3: { bg: "#fecaca", text: "#991b1b", border: "#ef4444" },
  }
  return colors[zone.level as keyof typeof colors]
}

// ============================================
// Shared Color Utility Functions
// These can be used across all components
// ============================================

/**
 * Get text color class for WBGT value
 * <20: gray, 20-23: yellow, 23-25: orange, >25: red
 */
export function getWbgtTextColor(wbgt: number): string {
  if (wbgt < 20) return "text-gray-700"
  if (wbgt < 23) return "text-yellow-600"
  if (wbgt < 25) return "text-orange-500"
  if (wbgt < 28) return "text-red-500"
  return "text-red-700"
}

/**
 * Get text color class for Solar Radiation
 * Fades from gray (100) to dark red (1000+)
 */
export function getSolarRadiationTextColor(sr: number): string {
  if (sr < 100) return "text-gray-500"
  if (sr < 300) return "text-gray-600"
  if (sr < 500) return "text-yellow-600"
  if (sr < 700) return "text-orange-500"
  if (sr < 900) return "text-red-500"
  return "text-red-700"
}

/**
 * Get text color class for Dew Point
 * <13: green (comfortable), 13-18: yellow, 18-20: orange, 20-23: red, >23: purple (oppressive)
 */
export function getDewPointTextColor(dp: number): string {
  if (dp < 13) return "text-green-600"
  if (dp < 18) return "text-yellow-600"
  if (dp < 20) return "text-orange-500"
  if (dp < 23) return "text-red-500"
  return "text-purple-600"
}

/**
 * Get text color class for UV Index
 * <3: gray (low), 3-6: yellow (moderate), 6-8: orange (high), 8-10: red (very high), >10: purple (extreme)
 */
export function getUvIndexTextColor(uv: number): string {
  if (uv < 3) return "text-gray-600"
  if (uv < 6) return "text-yellow-600"
  if (uv < 8) return "text-orange-500"
  if (uv < 10) return "text-red-500"
  return "text-purple-600"
}

/**
 * Get text color class for Australian AQI (NEPM standards)
 * Very Good (0-33): green, Good (34-66): blue, Fair (67-99): yellow, Poor (100-149): orange, Very Poor (150+): red
 */
export function getAqiTextColor(aqi: number | undefined | null): string {
  if (aqi === undefined || aqi === null) return "text-gray-500"
  if (aqi <= 33) return "text-green-600"
  if (aqi <= 66) return "text-blue-600"
  if (aqi <= 99) return "text-yellow-600"
  if (aqi <= 149) return "text-orange-500"
  return "text-red-600"
}

/**
 * Get text color class for Wind Speed (km/h)
 * <10: gray (calm), 10-20: green (light), 20-30: yellow (moderate), 30-40: orange (fresh), >40: red (strong)
 */
export function getWindSpeedTextColor(windKmh: number): string {
  if (windKmh < 10) return "text-gray-600"
  if (windKmh < 20) return "text-green-600"
  if (windKmh < 30) return "text-yellow-600"
  if (windKmh < 40) return "text-orange-500"
  return "text-red-600"
}

/**
 * Get text color class for Temperature
 * <15: blue (cold), 15-20: green (cool), 20-25: yellow (mild), 25-30: orange (warm), >30: red (hot)
 */
export function getTemperatureTextColor(temp: number): string {
  if (temp < 15) return "text-blue-600"
  if (temp < 20) return "text-green-600"
  if (temp < 25) return "text-yellow-600"
  if (temp < 30) return "text-orange-500"
  if (temp < 35) return "text-orange-600"
  return "text-red-600"
}

export function getSafetyRecommendations(wbgtCelsius: number, esi: number) {
  const zone = getWBGTZone(wbgtCelsius)

  const recommendations = {
    0: {
      title: "Optimal Conditions",
      message: "Perfect conditions for peak performance.",
      actions: [
        "Ideal time for intense training sessions",
        "Maximize performance potential",
        "Monitor hydration during extended efforts",
        "Recovery will be optimal in these conditions",
      ],
      color: "#22c55e",
      level: 0,
    },
    1: {
      title: "Minor Impact",
      message: "Slight performance impact possible during prolonged efforts.",
      actions: [
        "Maintain normal training intensity",
        "Stay hydrated during activities",
        "Monitor performance metrics closely",
        "Consider shorter warm-up periods",
      ],
      color: "#eab308",
      level: 1,
    },
    2: {
      title: "Significant Impact",
      message: "Notable performance detriment. Adjust training expectations.",
      actions: [
        "Reduce training intensity by 10-15%",
        "Increase rest periods between intervals",
        "Focus on technique over speed",
        "Consider indoor alternatives for quality sessions",
      ],
      color: "#f97316",
      level: 2,
    },
    3: {
      title: "Major Impact", 
      message: "Severe performance detriment. Reconsider training plans.",
      actions: [
        "Significantly reduce intensity (20-30% less)",
        "Prioritize hydration and cooling strategies",
        "Consider moving training to cooler times",
        "Recovery sessions may be more appropriate",
      ],
      color: "#ef4444",
      level: 3,
    },
    4: {
      title: "Dangerous Conditions",
      message: "Extreme performance detriment. Avoid outdoor training.",
      actions: [
        "Cancel outdoor training sessions",
        "Move to air-conditioned indoor facilities",
        "If outdoor activity is essential, keep intensity minimal",
        "Focus on active recovery and mobility instead",
      ],
      color: "#991b1b",
      level: 4,
    },
  }

  return recommendations[zone.level as keyof typeof recommendations] || recommendations[4]
}