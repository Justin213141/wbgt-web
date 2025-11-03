import type { WBGTZoneInfo } from "./types"

export function getWBGTZone(wbgt: number): WBGTZoneInfo {
  // WBGT zones in Celsius
  // Safe: < 27°C
  // Caution: 27-29°C
  // Warning: 29-32°C
  // Danger: > 32°C

  if (wbgt < 27) {
    return {
      zone: "safe",
      color: "#22c55e",
      label: "Safe",
      description: "Ideal conditions for outdoor activities",
    }
  } else if (wbgt < 29) {
    return {
      zone: "caution",
      color: "#eab308",
      label: "Caution",
      description: "Take regular breaks and stay hydrated",
    }
  } else if (wbgt < 32) {
    return {
      zone: "warning",
      color: "#f97316",
      label: "Warning",
      description: "Limit outdoor activities, frequent breaks needed",
    }
  } else {
    return {
      zone: "danger",
      color: "#ef4444",
      label: "Danger",
      description: "Avoid strenuous outdoor activities",
    }
  }
}

export function getRunningRecommendation(wbgt: number): string {
  const zone = getWBGTZone(wbgt)

  switch (zone.zone) {
    case "safe":
      return "Great conditions for running! Maintain your normal pace and distance."
    case "caution":
      return "Good for running with precautions. Stay hydrated and consider a slightly slower pace."
    case "warning":
      return "Consider running early morning or evening. Reduce intensity and take frequent breaks."
    case "danger":
      return "Not recommended for outdoor running. Consider indoor alternatives or wait for cooler conditions."
    default:
      return "Check current conditions before running."
  }
}

export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

export function formatDate(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}
