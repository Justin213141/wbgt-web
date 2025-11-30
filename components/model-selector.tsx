"use client"

import { useEffect } from "react"
import { Checkbox } from "./ui/checkbox"
import { Label } from "./ui/label"
import { CheckCircle2, Loader2, XCircle, Layers } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ModelSelectorProps {
  enabledModels: string[]
  onModelsChange: (models: string[]) => void
  modelStatus?: Record<string, "loading" | "success" | "error">
  showEnsemble?: boolean
  onEnsembleChange?: (show: boolean) => void
}

export const WEATHER_MODELS = [
  {
    id: "ecmwf",
    name: "ECMWF IFS",
    description: "European",
    color: "#ef4444",
  },
  {
    id: "icon",
    name: "ICON",
    description: "German",
    color: "#3b82f6",
  },
  {
    id: "jma",
    name: "JMA",
    description: "Japanese",
    color: "#22c55e",
  },
  {
    id: "ukmo",
    name: "UKMO",
    description: "UK Met Office",
    color: "#8b5cf6",
  },
  {
    id: "bom",
    name: "BOM Access",
    description: "Australian",
    color: "#f97316",
  },
] as const

const STORAGE_KEY = "wbgt-enabled-models"

export function ModelSelector({
  enabledModels,
  onModelsChange,
  modelStatus = {},
  showEnsemble = false,
  onEnsembleChange,
}: ModelSelectorProps) {
  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const models = JSON.parse(saved)
        if (Array.isArray(models) && models.length > 0) {
          onModelsChange(models)
        }
      } catch (error) {
        console.error("Failed to load enabled models from localStorage:", error)
      }
    }
  }, []) // Only run on mount

  // Save to localStorage whenever models change
  useEffect(() => {
    if (enabledModels.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(enabledModels))
    }
  }, [enabledModels])

  const allSelected = enabledModels.length === WEATHER_MODELS.length
  const noneSelected = enabledModels.length === 0

  const toggleAll = () => {
    if (allSelected) {
      onModelsChange([])
    } else {
      onModelsChange(WEATHER_MODELS.map((m) => m.id))
    }
  }

  const toggleModel = (modelId: string) => {
    if (enabledModels.includes(modelId)) {
      onModelsChange(enabledModels.filter((id) => id !== modelId))
    } else {
      onModelsChange([...enabledModels, modelId])
    }
  }

  const getStatusIcon = (modelId: string) => {
    const status = modelStatus[modelId]
    if (!status) return null

    switch (status) {
      case "loading":
        return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
      case "success":
        return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
      case "error":
        return <XCircle className="h-3.5 w-3.5 text-red-500" />
    }
  }

  return (
    <div className="space-y-4">
      {/* Header with Select All/Deselect All */}
      <div className="flex items-center justify-between pb-2 border-b">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Weather Models</span>
        </div>
        <button
          onClick={toggleAll}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
          type="button"
        >
          {allSelected ? "Deselect All" : "Select All"}
        </button>
      </div>

      {/* Model Checkboxes */}
      <div className="space-y-3">
        {WEATHER_MODELS.map((model) => {
          const isEnabled = enabledModels.includes(model.id)
          const status = modelStatus[model.id]

          return (
            <div key={model.id} className="flex items-center gap-3 group">
              <Checkbox
                id={`model-${model.id}`}
                checked={isEnabled}
                onCheckedChange={() => toggleModel(model.id)}
                className="data-[state=checked]:border-2"
                style={
                  isEnabled
                    ? {
                        borderColor: model.color,
                        backgroundColor: model.color,
                      }
                    : undefined
                }
              />
              <Label
                htmlFor={`model-${model.id}`}
                className="flex-1 cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  {/* Color indicator */}
                  <div
                    className="w-2 h-2 rounded-full ring-1 ring-gray-300"
                    style={{ backgroundColor: model.color }}
                  />
                  <div>
                    <span className="font-medium text-sm">{model.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">({model.description})</span>
                  </div>
                </div>
                {/* Status indicator */}
                {isEnabled && <div className="ml-2">{getStatusIcon(model.id)}</div>}
              </Label>
            </div>
          )
        })}
      </div>

      {/* Warning if no models selected */}
      {noneSelected && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
          <p className="font-medium">No models selected</p>
          <p className="text-amber-800 mt-1">Select at least one weather model to view forecasts.</p>
        </div>
      )}

      {/* Ensemble toggle (optional) */}
      {onEnsembleChange && enabledModels.length >= 2 && (
        <div className="pt-3 border-t">
          <div className="flex items-center gap-3">
            <Checkbox
              id="ensemble-toggle"
              checked={showEnsemble}
              onCheckedChange={onEnsembleChange}
              className="data-[state=checked]:bg-gray-700 data-[state=checked]:border-gray-700"
            />
            <Label htmlFor="ensemble-toggle" className="cursor-pointer flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">Show ensemble average</span>
                <span className="text-xs text-muted-foreground">
                  ({enabledModels.length} models)
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Display mean of all selected models
              </p>
            </Label>
          </div>
        </div>
      )}
    </div>
  )
}
