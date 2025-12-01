/**
 * Ensemble statistics utilities for multi-model weather data
 */

export interface EnsembleDataPoint {
  time: string
  mean: number
  stdDev: number
  min: number
  max: number
  p10: number
  p90: number
  members: number[]
}

export interface ConfidenceLevel {
  level: 'high' | 'medium' | 'low'
  label: string
  cv: number
}

/**
 * Calculate ensemble statistics from an array of member values
 */
export function calculateEnsembleStats(members: number[]): {
  mean: number
  stdDev: number
  min: number
  max: number
  p10: number
  p90: number
} {
  const n = members.length
  if (n === 0) {
    return { mean: 0, stdDev: 0, min: 0, max: 0, p10: 0, p90: 0 }
  }

  const mean = members.reduce((a, b) => a + b, 0) / n
  const variance = members.reduce((sum, val) => sum + (val - mean) ** 2, 0) / n
  const stdDev = Math.sqrt(variance)
  const sorted = [...members].sort((a, b) => a - b)

  return {
    mean,
    stdDev,
    min: sorted[0],
    max: sorted[n - 1],
    p10: sorted[Math.floor(n * 0.1)] ?? sorted[0],
    p90: sorted[Math.floor(n * 0.9)] ?? sorted[n - 1],
  }
}

/**
 * Calculate confidence level based on coefficient of variation
 */
export function getConfidenceLevel(stdDev: number, mean: number): ConfidenceLevel {
  // Avoid division by zero
  if (mean === 0) {
    return { level: 'low', label: 'Low confidence', cv: 100 }
  }

  // Coefficient of variation as percentage
  const cv = Math.abs(stdDev / mean) * 100

  if (cv < 5) {
    return { level: 'high', label: 'High confidence', cv }
  } else if (cv < 15) {
    return { level: 'medium', label: 'Medium confidence', cv }
  } else {
    return { level: 'low', label: 'Low confidence', cv }
  }
}

/**
 * Transform raw model data into ensemble data points for charting
 */
export function createEnsembleDataPoints(
  times: string[],
  modelValues: number[][] // Array of value arrays, one per model
): EnsembleDataPoint[] {
  return times.map((time, idx) => {
    const members = modelValues
      .map(values => values[idx])
      .filter(v => v !== undefined && !isNaN(v))

    const stats = calculateEnsembleStats(members)

    return {
      time,
      mean: stats.mean,
      stdDev: stats.stdDev,
      min: stats.min,
      max: stats.max,
      p10: stats.p10,
      p90: stats.p90,
      members,
    }
  })
}

/**
 * Format chart data with uncertainty bands for Recharts
 */
export function formatChartDataWithUncertainty(
  ensembleData: EnsembleDataPoint[]
): Array<{
  time: string
  mean: number
  upperStdDev: number
  lowerStdDev: number
  upperRange: number
  lowerRange: number
  upperP90: number
  lowerP10: number
}> {
  return ensembleData.map(d => ({
    time: d.time,
    mean: d.mean,
    upperStdDev: d.mean + d.stdDev,
    lowerStdDev: d.mean - d.stdDev,
    upperRange: d.max,
    lowerRange: d.min,
    upperP90: d.p90,
    lowerP10: d.p10,
  }))
}

/**
 * Calculate average confidence across all data points
 */
export function getOverallConfidence(ensembleData: EnsembleDataPoint[]): ConfidenceLevel {
  if (ensembleData.length === 0) {
    return { level: 'low', label: 'No data', cv: 100 }
  }

  const avgStdDev = ensembleData.reduce((sum, d) => sum + d.stdDev, 0) / ensembleData.length
  const avgMean = ensembleData.reduce((sum, d) => sum + d.mean, 0) / ensembleData.length

  return getConfidenceLevel(avgStdDev, avgMean)
}
