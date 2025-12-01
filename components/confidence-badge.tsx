"use client"

import { cn } from "@/lib/utils"
import { getConfidenceLevel, type ConfidenceLevel } from "@/lib/ensemble-utils"

interface ConfidenceBadgeProps {
  stdDev: number
  mean: number
  className?: string
  showCV?: boolean
}

const CONFIDENCE_COLORS = {
  high: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  low: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
}

export function ConfidenceBadge({ stdDev, mean, className, showCV = false }: ConfidenceBadgeProps) {
  const confidence = getConfidenceLevel(stdDev, mean)

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
        CONFIDENCE_COLORS[confidence.level],
        className
      )}
    >
      {confidence.label}
      {showCV && (
        <span className="opacity-75">
          ({confidence.cv.toFixed(1)}%)
        </span>
      )}
    </span>
  )
}

interface ConfidenceBadgeFromLevelProps {
  level: ConfidenceLevel
  className?: string
  showCV?: boolean
}

export function ConfidenceBadgeFromLevel({ level, className, showCV = false }: ConfidenceBadgeFromLevelProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
        CONFIDENCE_COLORS[level.level],
        className
      )}
    >
      {level.label}
      {showCV && (
        <span className="opacity-75">
          ({level.cv.toFixed(1)}%)
        </span>
      )}
    </span>
  )
}
