"use client"

import { useEffect } from "react"
import { Switch } from "./ui/switch"
import { Label } from "./ui/label"
import { CheckCircle2, Loader2, XCircle, Layers } from "lucide-react"

export interface ModelSelectorProps {
  multiModelEnabled: boolean
  onMultiModelChange: (enabled: boolean) => void
  modelStatus?: Record<string, "loading" | "success" | "error">
}

const STORAGE_KEY = "wbgt-multimodel-enabled"

export function ModelSelector({
  multiModelEnabled,
  onMultiModelChange,
  modelStatus = {},
}: ModelSelectorProps) {
  // Save to localStorage whenever setting changes
  // (Loading is handled by parent component's useState initializer)
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(multiModelEnabled))
  }, [multiModelEnabled])

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

  // When multimodel is enabled, we use BOM + GFS + ECMWF
  const activeModels = multiModelEnabled
    ? ['bom', 'gfs', 'ecmwf']
    : ['bom']

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 pb-2 border-b">
        <Layers className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Forecast Models</span>
      </div>

      {/* Multi-model toggle */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="multimodel-toggle" className="font-medium text-sm cursor-pointer">
            Multi-model ensemble
          </Label>
          <p className="text-xs text-muted-foreground">
            {multiModelEnabled
              ? "Averaging BOM ACCESS, GFS, and ECMWF"
              : "Using BOM ACCESS only"}
          </p>
        </div>
        <Switch
          id="multimodel-toggle"
          checked={multiModelEnabled}
          onCheckedChange={onMultiModelChange}
        />
      </div>

      {/* Status indicators when multimodel is enabled */}
      {multiModelEnabled && (
        <div className="pt-3 border-t space-y-2">
          <div className="text-xs text-muted-foreground font-medium">Model Status</div>
          <div className="flex flex-wrap gap-3">
            {[
              { id: 'bom', name: 'BOM ACCESS', color: '#f97316' },
              { id: 'gfs', name: 'GFS', color: '#3b82f6' },
              { id: 'ecmwf', name: 'ECMWF', color: '#ef4444' },
            ].map((model) => (
              <div key={model.id} className="flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: model.color }}
                />
                <span className="text-xs">{model.name}</span>
                {getStatusIcon(model.id)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
