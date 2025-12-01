"use client"

import { PageContainer } from "@/components/page-container"
import { TimeRangeFinder } from "@/components/time-range-finder"
import { HourlyForecastTable } from "@/components/hourly-forecast-table"
import { ForecastChart } from "@/components/forecast-chart"
import { ModelSelector } from "@/components/model-selector"
import useSWR from "swr"
import { fetchAllModels, type ModelName, getSuccessfulModels } from "@/lib/model-fetcher"
import { calculateKongWBGT, type WBGTParams } from "@/lib/kong-wbgt"
import type { WeatherForecast, WeatherModelId } from "@/lib/types"
import { calculateEnsembleStats, type EnsembleDataPoint } from "@/lib/ensemble-utils"
import { Loader2, Settings } from "lucide-react"
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

export default function FuturePage() {
  // Model selection state - default to BOM only
  const [enabledModels, setEnabledModels] = useState<string[]>(['bom'])
  const [showEnsemble, setShowEnsemble] = useState(true)
  const [modelStatus, setModelStatus] = useState<Record<string, 'loading' | 'success' | 'error'>>({})
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Fetch multi-model forecast data
  const { data: modelResults, error: modelError, isLoading: modelsLoading } = useSWR(
    enabledModels.length > 0 ? ['future-forecast', enabledModels] : null,
    async () => {
      const modelNames = enabledModels.map(id => MODEL_ID_MAP[id]).filter(Boolean) as ModelName[]

      const loadingStatus: Record<string, 'loading' | 'success' | 'error'> = {}
      enabledModels.forEach(id => {
        loadingStatus[id] = 'loading'
      })
      setModelStatus(loadingStatus)

      const results = await fetchAllModels(-33.87, 151.21, modelNames)

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
      refreshInterval: 300000,
      revalidateOnFocus: false,
    }
  )

  // Calculate WBGT from multi-model data - extended to 48 hours
  const { forecast, ensembleData, activeModels } = useMemo(() => {
    if (!modelResults) return { forecast: [] as WeatherForecast[], ensembleData: null, activeModels: [] as WeatherModelId[] }

    const successfulModels = getSuccessfulModels(modelResults)
    if (successfulModels.length === 0) return { forecast: [] as WeatherForecast[], ensembleData: null, activeModels: [] as WeatherModelId[] }

    const modelIds = successfulModels.map(m => m.modelName) as WeatherModelId[]
    const refModel = successfulModels[0]
    const times = refModel.times

    // Extended to 48 hours
    const maxHours = 48
    const limitedTimes = times.slice(0, maxHours)

    const wbgtEnsemble: EnsembleDataPoint[] = []
    const tempEnsemble: EnsembleDataPoint[] = []

    const forecastData: WeatherForecast[] = limitedTimes.map((time, idx) => {
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

      const wbgt = wbgtStats.mean
      const temperature = tempStats.mean
      const humidity = humidityValues.reduce((a, b) => a + b, 0) / humidityValues.length

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

    return {
      forecast: forecastData,
      ensembleData: {
        wbgt: wbgtEnsemble,
        temperature: tempEnsemble,
      },
      activeModels: modelIds,
    }
  }, [modelResults])

  const isLoading = modelsLoading || (!modelResults && !modelError)
  const hasError = modelError

  // Filter to 3-hour intervals for chart display
  const chartData = forecast.filter((_, index) => index % 3 === 0)
  const chartEnsembleData = ensembleData ? {
    wbgt: ensembleData.wbgt.filter((_, index) => index % 3 === 0),
    temperature: ensembleData.temperature.filter((_, index) => index % 3 === 0),
  } : undefined

  return (
    <PageContainer title="Future" description="48-hour forecast">
      {hasError && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
          Failed to load forecast data. Please try again later.
        </div>
      )}

      {isLoading && !hasError && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && !hasError && forecast.length > 0 && (
        <div className="space-y-4">
          {/* 48-Hour Forecast Chart - 3-hour intervals */}
          <ForecastChart
            data={chartData}
            ensembleData={chartEnsembleData}
            models={activeModels}
            showUncertainty={showEnsemble}
          />

          {/* Time Range Finder - compact cards */}
          <TimeRangeFinder data={forecast} />

          {/* Detailed Forecast Table - 3-hour intervals */}
          <HourlyForecastTable
            data={forecast}
            title="48-Hour Detailed Forecast"
            intervalHours={3}
          />

          {/* Model Selector - at bottom */}
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

      {!isLoading && !hasError && forecast.length === 0 && (
        <div className="rounded-lg border border-border bg-muted p-8 text-center">
          <p className="text-muted-foreground">No forecast data available</p>
        </div>
      )}
    </PageContainer>
  )
}
