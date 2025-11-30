"use client"

import { PageContainer } from "@/components/page-container"
import { WBGTDisplay } from "@/components/wbgt-display"
import { CurrentConditions } from "@/components/current-conditions"
import { SafetyRecommendations } from "@/components/safety-recommendations"
import { ForecastChart } from "@/components/forecast-chart"
import { EnvironmentalMetrics } from "@/components/environmental-metrics"
import { ModelSelector } from "@/components/model-selector"
import useSWR from "swr"
import { fetchObservations } from "@/lib/api"
import { fetchAllModels, type ModelName, getSuccessfulModels } from "@/lib/model-fetcher"
import { calculateKongWBGT, calculateBatchWBGT, type WBGTParams } from "@/lib/kong-wbgt"
import type { WeatherObservation, WeatherForecast } from "@/lib/types"
import { Loader2, Settings } from "lucide-react"
import { parseApiDate } from "@/lib/utils"
import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

// Map model IDs from ModelSelector to ModelFetcher format
const MODEL_ID_MAP: Record<string, ModelName> = {
  'ecmwf': 'ecmwf_ifs',
  'icon': 'icon_seamless',
  'jma': 'jma_seamless',
  'ukmo': 'ukmo_seamless',
  'bom': 'bom_access',
}

export default function NowPage() {
  // Model selection state
  const [enabledModels, setEnabledModels] = useState<string[]>(['ecmwf', 'bom'])
  const [showEnsemble, setShowEnsemble] = useState(true)
  const [modelStatus, setModelStatus] = useState<Record<string, 'loading' | 'success' | 'error'>>({})
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Fetch observations for current conditions (most recent actual data)
  const { data: observationsData, error: observationsError } = useSWR<any>("observations", fetchObservations, {
    refreshInterval: 60000,
  })

  // Fetch multi-model forecast data
  const { data: modelResults, error: modelError, isLoading: modelsLoading } = useSWR(
    enabledModels.length > 0 ? ['multi-model-forecast', enabledModels] : null,
    async () => {
      const modelNames = enabledModels.map(id => MODEL_ID_MAP[id]).filter(Boolean) as ModelName[]

      // Set all models to loading
      const loadingStatus: Record<string, 'loading' | 'success' | 'error'> = {}
      enabledModels.forEach(id => {
        loadingStatus[id] = 'loading'
      })
      setModelStatus(loadingStatus)

      // Fetch all models
      const results = await fetchAllModels(-33.87, 151.21, modelNames)

      // Update status for each model
      const newStatus: Record<string, 'loading' | 'success' | 'error'> = {}
      results.forEach(result => {
        const modelId = Object.keys(MODEL_ID_MAP).find(key => MODEL_ID_MAP[key] === result.modelName)
        if (modelId) {
          newStatus[modelId] = result.status === 'success' ? 'success' : 'error'
        }
      })
      setModelStatus(newStatus)

      return results
    },
    {
      refreshInterval: 300000, // 5 minutes
      revalidateOnFocus: false,
    }
  )

  console.log("[v0] Model results:", modelResults)
  console.log("[v0] Raw observations data:", observationsData)

  // Calculate WBGT from multi-model data
  const forecast: WeatherForecast[] = useMemo(() => {
    if (!modelResults) return []

    const successfulModels = getSuccessfulModels(modelResults)
    if (successfulModels.length === 0) return []

    // Use first successful model's time array as reference
    const refModel = successfulModels[0]
    const times = refModel.times

    // Limit to first 6 hours
    const maxHours = 6
    const limitedTimes = times.slice(0, maxHours)

    // Calculate WBGT for each model at each time
    const forecastData: WeatherForecast[] = limitedTimes.map((time, idx) => {
      // Calculate WBGT for each model
      const wbgtValues: number[] = []
      const tempValues: number[] = []
      const humidityValues: number[] = []

      successfulModels.forEach(model => {
        if (idx < model.times.length) {
          const params: WBGTParams = {
            temperature: model.temperature[idx],
            relativeHumidity: model.humidity[idx],
            windSpeed: model.windSpeed[idx],
            solarRadiation: model.solarRadiation[idx],
            latitude: -33.87,
            longitude: 151.21,
            timestamp: new Date(time),
          }

          const result = calculateKongWBGT(params)
          wbgtValues.push(result.wbgt)
          tempValues.push(model.temperature[idx])
          humidityValues.push(model.humidity[idx])
        }
      })

      // Calculate ensemble mean
      const wbgt = wbgtValues.reduce((a, b) => a + b, 0) / wbgtValues.length
      const temperature = tempValues.reduce((a, b) => a + b, 0) / tempValues.length
      const humidity = humidityValues.reduce((a, b) => a + b, 0) / humidityValues.length

      return {
        wbgt,
        temperature,
        humidity,
        timestamp: time,
        localTimestamp: time,
        // Use first model's other values as defaults
        wind_speed: refModel.windSpeed[idx],
        solar_radiation: refModel.solarRadiation[idx],
        uv_index: refModel.uvIndex[idx],
      } as WeatherForecast
    })

    return forecastData
  }, [modelResults])

  // Get the most recent observation for current conditions
  let currentData: WeatherObservation | null = null
  if (observationsData) {
    let observations: WeatherObservation[] = []
    if (Array.isArray(observationsData)) {
      observations = observationsData
    } else if (typeof observationsData === "object" && "observations" in observationsData) {
      observations = Array.isArray(observationsData.observations) ? observationsData.observations : []
    }

    if (observations.length > 0) {
      // Sort by timestamp descending and get the most recent
      const sorted = [...observations].sort((a, b) => {
        const dateA = parseApiDate(a.timestamp || a.localTimestamp || "")
        const dateB = parseApiDate(b.timestamp || b.localTimestamp || "")
        return dateB.getTime() - dateA.getTime()
      })
      currentData = sorted[0]
      console.log("[v0] Most recent observation:", currentData)
    }
  }

  console.log("[v0] Normalized forecast array:", forecast)

  const isLoading = !observationsData || modelsLoading
  const hasError = observationsError || modelError

  return (
    <PageContainer title="Now" description="Current conditions and 6-hour forecast with running recommendations">
      {hasError && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
          Failed to load weather data. Please try again later.
        </div>
      )}

      {isLoading && !hasError && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && !hasError && currentData && forecast.length > 0 && (
        <div className="space-y-6">
          {/* Model Selector */}
          <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
            <Card>
              <CardHeader className="pb-3">
                <CollapsibleTrigger className="flex items-center justify-between w-full group">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Forecast Models
                    <span className="text-xs text-muted-foreground font-normal">
                      ({enabledModels.length} selected)
                    </span>
                  </CardTitle>
                  <div className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                    {settingsOpen ? 'Hide' : 'Show'}
                  </div>
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent>
                  <ModelSelector
                    enabledModels={enabledModels}
                    onModelsChange={setEnabledModels}
                    modelStatus={modelStatus}
                    showEnsemble={showEnsemble}
                    onEnsembleChange={setShowEnsemble}
                  />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          <WBGTDisplay
            data={{
              wbgt: currentData.wbgt,
              localTimestamp: currentData.timestamp || currentData.localTimestamp,
            }}
          />
          <SafetyRecommendations wbgt={currentData.wbgt} esi={currentData.esi} />
          <CurrentConditions data={currentData} />
          <ForecastChart data={forecast.slice(0, 6)} />
          <EnvironmentalMetrics
            uvIndex={currentData.uv_index}
            airQuality={currentData.air_quality}
            forecastData={forecast.slice(0, 6)}
          />
        </div>
      )}

      {!isLoading && !hasError && (!currentData || forecast.length === 0) && (
        <div className="rounded-lg border border-muted bg-muted/10 p-4 text-muted-foreground">
          No weather data available at this time.
        </div>
      )}
    </PageContainer>
  )
}
