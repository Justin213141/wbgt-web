"use client"

import { cn } from "@/lib/utils"
import { WEATHER_MODELS, type WeatherModelId } from "@/lib/types"

interface ModelLegendProps {
  models: WeatherModelId[]
  className?: string
  compact?: boolean
}

export function ModelLegend({ models, className, compact = false }: ModelLegendProps) {
  if (models.length === 0) {
    return null
  }

  return (
    <div className={cn("flex items-center gap-4 text-sm", className)}>
      <span className="text-muted-foreground">Models:</span>
      <div className={cn("flex items-center", compact ? "gap-2" : "gap-4")}>
        {models.map(modelId => {
          const model = WEATHER_MODELS[modelId]
          if (!model) return null

          return (
            <div key={modelId} className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: model.color }}
              />
              <span className={compact ? "text-xs" : "text-sm"}>
                {model.name}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface ModelLegendWithStatusProps {
  models: Array<{
    id: WeatherModelId
    status: 'loading' | 'success' | 'error'
  }>
  className?: string
}

export function ModelLegendWithStatus({ models, className }: ModelLegendWithStatusProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3 text-sm", className)}>
      {models.map(({ id, status }) => {
        const model = WEATHER_MODELS[id]
        if (!model) return null

        return (
          <div key={id} className="flex items-center gap-1.5">
            <div
              className={cn(
                "w-2 h-2 rounded-full",
                status === 'loading' && "animate-pulse"
              )}
              style={{
                backgroundColor: status === 'error' ? '#9ca3af' : model.color,
                opacity: status === 'error' ? 0.5 : 1,
              }}
            />
            <span className={cn(
              "text-xs",
              status === 'error' && "text-muted-foreground line-through"
            )}>
              {model.name}
            </span>
          </div>
        )
      })}
    </div>
  )
}
