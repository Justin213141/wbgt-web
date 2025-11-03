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