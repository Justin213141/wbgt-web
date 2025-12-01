"use client"

import { PageContainer } from "@/components/page-container"
import { TodayConditions } from "@/components/today-conditions"
import { HourlyStrip } from "@/components/hourly-strip"
import { ForecastChart } from "@/components/forecast-chart"
import { EnvironmentalMetrics } from "@/components/environmental-metrics"
import { ModelSelector } from "@/components/model-selector"
import useSWR from "swr"
import { fetchObservations } from "@/lib/api"
import { fetchAllModels, type ModelName, getSuccessfulModels } from "@/lib/model-fetcher"
import { calculateKongWBGT, type WBGTParams } from "@/lib/kong-wbgt"
import type { WeatherObservation, WeatherForecast, WeatherModelId } from "@/lib/types"
import { calculateEnsembleStats, type EnsembleDataPoint } from "@/lib/ensemble-utils"
import { Loader2, Settings } from "lucide-react"
import { parseApiDate } from "@/lib/utils"
import { useState, useMemo } from "react"
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

export default function TodayPage() {
  // Model selection state - default to BOM only
  const [enabledModels, setEnabledModels] = useState<string[]>(['bom'])
  const [showEnsemble, setShowEnsemble] = useState(true)
  const [modelStatus, setModelStatus] = useState<Record<string, 'loading' | 'success' | 'error'>>({})
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Fetch observations for current conditions (most recent actual data)
  const { data: observationsData } = useSWR<any>("observations", fetchObservations, {
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

  // Calculate WBGT from multi-model data with ensemble statistics
  // Extended to 12 hours for the hourly strip
  const { forecast, ensembleData, activeModels, forecastSummary } = useMemo(() => {
    if (!modelResults) return { forecast: [] as WeatherForecast[], ensembleData: null, activeModels: [] as WeatherModelId[], forecastSummary: null }

    const successfulModels = getSuccessfulModels(modelResults)
    if (successfulModels.length === 0) return { forecast: [] as WeatherForecast[], ensembleData: null, activeModels: [] as WeatherModelId[], forecastSummary: null }

    // Get model IDs for legend display
    const modelIds = successfulModels.map(m => m.modelName) as WeatherModelId[]

    // Use first successful model's time array as reference
    const refModel = successfulModels[0]
    const times = refModel.times

    // Extended to 12 hours for hourly strip
    const maxHours = 12
    const limitedTimes = times.slice(0, maxHours)

    // Arrays to collect all values for ensemble stats
    const wbgtEnsemble: EnsembleDataPoint[] = []
    const tempEnsemble: EnsembleDataPoint[] = []

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

      // Calculate ensemble stats for WBGT
      const wbgtStats = calculateEnsembleStats(wbgtValues)
      wbgtEnsemble.push({
        time,
        mean: wbgtStats.mean,
        stdDev: wbgtStats.stdDev,
        min: wbgtStats.min,
        max: wbgtStats.max,
        p10: wbgtStats.p10,
        p90: wbgtStats.p90,
        members: wbgtValues,
      })

      // Calculate ensemble stats for temperature
      const tempStats = calculateEnsembleStats(tempValues)
      tempEnsemble.push({
        time,
        mean: tempStats.mean,
        stdDev: tempStats.stdDev,
        min: tempStats.min,
        max: tempStats.max,
        p10: tempStats.p10,
        p90: tempStats.p90,
        members: tempValues,
      })

      // Calculate ensemble mean for display
      const wbgt = wbgtStats.mean
      const temperature = tempStats.mean
      const humidity = humidityValues.reduce((a, b) => a + b, 0) / humidityValues.length

      // Calculate dew point using Magnus formula approximation
      const a = 17.27
      const b = 237.7
      const alpha = (a * temperature) / (b + temperature) + Math.log(humidity / 100)
      const dewPoint = (b * alpha) / (a - alpha)

      return {
        wbgt,
        temperature,
        humidity,
        timestamp: time,
        localTimestamp: time,
        wind_speed_ms: refModel.windSpeed[idx],
        solar_radiation: refModel.solarRadiation[idx],
        uv_index: refModel.uvIndex[idx],
        dew_point: dewPoint,
        cloud_cover: refModel.cloudCover[idx],
        esi: 0,
        apparent_temp: refModel.apparentTemp[idx],
        rain_chance: 0, // Precipitation probability not available from model data
      } as WeatherForecast
    })

    // Calculate forecast summary for TodayConditions
    const temps = forecastData.map(f => f.temperature)
    const wbgts = forecastData.map(f => f.wbgt)
    const rainChances = forecastData.map(f => f.rain_chance)

    const summary = {
      minTemp: Math.min(...temps),
      maxTemp: Math.max(...temps),
      maxWbgt: Math.max(...wbgts),
      rainChance: Math.max(...rainChances),
    }

    return {
      forecast: forecastData,
      ensembleData: {
        wbgt: wbgtEnsemble,
        temperature: tempEnsemble,
      },
      activeModels: modelIds,
      forecastSummary: summary,
    }
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
      const sorted = [...observations].sort((a, b) => {
        const dateA = parseApiDate(a.timestamp || a.localTimestamp || "")
        const dateB = parseApiDate(b.timestamp || b.localTimestamp || "")
        return dateB.getTime() - dateA.getTime()
      })
      currentData = sorted[0]
    }
  }

  // Derive current conditions from forecast if observations API fails
  const derivedCurrentData: WeatherObservation | null = forecast.length > 0 ? (() => {
    const f = forecast[0]
    return {
      wbgt: f.wbgt,
      temperature: f.temperature,
      humidity: f.humidity,
      wind_speed_ms: f.wind_speed_ms,
      solar_radiation: f.solar_radiation,
      uv_index: f.uv_index,
      timestamp: f.timestamp || f.localTimestamp || '',
      localTimestamp: f.localTimestamp,
      dew_point: f.dew_point,
      cloud_cover: f.cloud_cover,
      esi: f.esi,
      apparent_temp: f.apparent_temp,
      rain_chance: f.rain_chance,
    } as WeatherObservation
  })() : null

  // Use observations data if available, otherwise fall back to derived data
  // Only use currentData if it has the required wbgt field
  const displayCurrentData = (currentData && 'wbgt' in currentData && currentData.wbgt !== undefined)
    ? currentData
    : derivedCurrentData

  const isLoading = modelsLoading || (!modelResults && !modelError)
  const hasError = modelError
  const hasValidData = displayCurrentData && 'wbgt' in displayCurrentData && displayCurrentData.wbgt !== undefined

  return (
    <PageContainer title="Today" description="Current conditions and 12-hour forecast">
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

      {!isLoading && !hasError && hasValidData && forecast.length > 0 && (
        <div className="space-y-4">
          {/* Current Conditions - Weatherzone style */}
          <TodayConditions
            data={displayCurrentData}
            forecastSummary={forecastSummary || undefined}
          />

          {/* 12-Hour Hourly Strip */}
          <HourlyStrip data={forecast} maxHours={12} />

          {/* Forecast Chart - 6 hours */}
          <ForecastChart
            data={forecast.slice(0, 6)}
            ensembleData={ensembleData ? {
              wbgt: ensembleData.wbgt.slice(0, 6),
              temperature: ensembleData.temperature.slice(0, 6),
            } : undefined}
            models={activeModels}
            showUncertainty={showEnsemble}
          />

          {/* Environmental Metrics - lower priority */}
          <EnvironmentalMetrics
            uvIndex={displayCurrentData.uv_index}
            airQuality={displayCurrentData.air_quality}
            forecastData={forecast.slice(0, 6)}
          />

          {/* Model Selector - collapsed by default */}
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
        </div>
      )}

      {!isLoading && !hasError && (!displayCurrentData || forecast.length === 0) && (
        <div className="rounded-lg border border-muted bg-muted/10 p-4 text-muted-foreground">
          No weather data available at this time.
        </div>
      )}
    </PageContainer>
  )
}
