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
  'gfs': 'gfs_seamless',
  'bom': 'bom_access',
}

// Models to use when multimodel is enabled
const MULTIMODEL_IDS = ['bom', 'gfs', 'ecmwf']
const SINGLE_MODEL_IDS = ['bom']

export default function TodayPage() {
  // Multimodel toggle state - default to false (BOM only)
  const [multiModelEnabled, setMultiModelEnabled] = useState(false)
  const [modelStatus, setModelStatus] = useState<Record<string, 'loading' | 'success' | 'error'>>({})
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Determine which models to fetch based on toggle
  const enabledModels = multiModelEnabled ? MULTIMODEL_IDS : SINGLE_MODEL_IDS

  // Fetch observations for current conditions (most recent actual data)
  const { data: observationsData } = useSWR<any>("observations", fetchObservations, {
    refreshInterval: 60000,
  })

  // Fetch multi-model forecast data
  const { data: modelResults, error: modelError, isLoading: modelsLoading } = useSWR(
    ['multi-model-forecast', enabledModels],
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

  // Calculate WBGT from multi-model data
  // When multimodel is enabled: average input variables, then calculate WBGT
  // Extended to 12 hours for the hourly strip
  const { forecast, ensembleData, activeModels, forecastSummary, wbgtRange } = useMemo(() => {
    if (!modelResults) return { forecast: [] as WeatherForecast[], ensembleData: null, activeModels: [] as WeatherModelId[], forecastSummary: null, wbgtRange: null }

    const successfulModels = getSuccessfulModels(modelResults)
    if (successfulModels.length === 0) return { forecast: [] as WeatherForecast[], ensembleData: null, activeModels: [] as WeatherModelId[], forecastSummary: null, wbgtRange: null }

    // Get model IDs for legend display
    const modelIds = successfulModels.map(m => m.modelName) as WeatherModelId[]

    // Use first successful model's time array as reference
    const refModel = successfulModels[0]
    const times = refModel.times

    // Extended to 12 hours for hourly strip
    const maxHours = 12
    const limitedTimes = times.slice(0, maxHours)

    // Arrays to collect WBGT range data when multimodel
    const wbgtRangeData: { min: number; max: number }[] = []

    // Calculate forecast data
    const forecastData: WeatherForecast[] = limitedTimes.map((time, idx) => {
      if (multiModelEnabled && successfulModels.length > 1) {
        // MULTIMODEL: Average input variables, then calculate WBGT
        const tempValues: number[] = []
        const humidityValues: number[] = []
        const windSpeedValues: number[] = []
        const solarRadValues: number[] = []
        const uvIndexValues: number[] = []
        const cloudCoverValues: number[] = []
        const apparentTempValues: number[] = []

        successfulModels.forEach(model => {
          if (idx < model.times.length) {
            tempValues.push(model.temperature[idx])
            humidityValues.push(model.humidity[idx])
            windSpeedValues.push(model.windSpeed[idx])
            solarRadValues.push(model.solarRadiation[idx])
            uvIndexValues.push(model.uvIndex[idx])
            cloudCoverValues.push(model.cloudCover[idx])
            apparentTempValues.push(model.apparentTemp[idx])
          }
        })

        // Helper to calculate average, filtering out NaN values
        const safeAvg = (arr: number[]) => {
          const valid = arr.filter(v => !isNaN(v) && v !== null && v !== undefined)
          return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : NaN
        }

        // Calculate averages (filtering out NaN values)
        const avgTemp = safeAvg(tempValues)
        const avgHumidity = safeAvg(humidityValues)
        const avgWindSpeed = safeAvg(windSpeedValues)
        const avgSolarRad = safeAvg(solarRadValues)
        const avgUvIndex = safeAvg(uvIndexValues)
        const avgCloudCover = safeAvg(cloudCoverValues)
        const avgApparentTemp = safeAvg(apparentTempValues)

        // Calculate WBGT from averaged inputs
        const params: WBGTParams = {
          temperature: avgTemp,
          relativeHumidity: avgHumidity,
          windSpeed: avgWindSpeed,
          solarRadiation: avgSolarRad,
          latitude: -33.87,
          longitude: 151.21,
          timestamp: new Date(time),
        }
        const wbgtResult = calculateKongWBGT(params)
        const wbgt = wbgtResult.wbgt

        // Also calculate WBGT for each model to get range
        const modelWbgts: number[] = []
        successfulModels.forEach(model => {
          if (idx < model.times.length) {
            const modelParams: WBGTParams = {
              temperature: model.temperature[idx],
              relativeHumidity: model.humidity[idx],
              windSpeed: model.windSpeed[idx],
              solarRadiation: model.solarRadiation[idx],
              latitude: -33.87,
              longitude: 151.21,
              timestamp: new Date(time),
            }
            const modelResult = calculateKongWBGT(modelParams)
            if (!isNaN(modelResult.wbgt)) {
              modelWbgts.push(modelResult.wbgt)
            }
          }
        })

        // Store range for display
        wbgtRangeData.push({
          min: modelWbgts.length > 0 ? Math.min(...modelWbgts) : wbgt,
          max: modelWbgts.length > 0 ? Math.max(...modelWbgts) : wbgt,
        })

        // Calculate dew point using Magnus formula approximation
        const a = 17.27
        const b = 237.7
        const alpha = (a * avgTemp) / (b + avgTemp) + Math.log(avgHumidity / 100)
        const dewPoint = (b * alpha) / (a - alpha)

        return {
          wbgt,
          temperature: avgTemp,
          humidity: avgHumidity,
          timestamp: time,
          localTimestamp: time,
          wind_speed_ms: avgWindSpeed,
          solar_radiation: avgSolarRad,
          uv_index: avgUvIndex,
          dew_point: dewPoint,
          cloud_cover: avgCloudCover,
          esi: 0,
          apparent_temp: avgApparentTemp,
          rain_chance: 0,
        } as WeatherForecast
      } else {
        // SINGLE MODEL (BOM): Use values directly
        const model = successfulModels[0]
        const params: WBGTParams = {
          temperature: model.temperature[idx],
          relativeHumidity: model.humidity[idx],
          windSpeed: model.windSpeed[idx],
          solarRadiation: model.solarRadiation[idx],
          latitude: -33.87,
          longitude: 151.21,
          timestamp: new Date(time),
        }
        const wbgtResult = calculateKongWBGT(params)

        // Calculate dew point
        const a = 17.27
        const b = 237.7
        const alpha = (a * model.temperature[idx]) / (b + model.temperature[idx]) + Math.log(model.humidity[idx] / 100)
        const dewPoint = (b * alpha) / (a - alpha)

        return {
          wbgt: wbgtResult.wbgt,
          temperature: model.temperature[idx],
          humidity: model.humidity[idx],
          timestamp: time,
          localTimestamp: time,
          wind_speed_ms: model.windSpeed[idx],
          solar_radiation: model.solarRadiation[idx],
          uv_index: model.uvIndex[idx],
          dew_point: dewPoint,
          cloud_cover: model.cloudCover[idx],
          esi: 0,
          apparent_temp: model.apparentTemp[idx],
          rain_chance: 0,
        } as WeatherForecast
      }
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
      ensembleData: null, // We don't need ensemble data for charts anymore
      activeModels: modelIds,
      forecastSummary: summary,
      wbgtRange: multiModelEnabled && wbgtRangeData.length > 0 ? wbgtRangeData : null,
    }
  }, [modelResults, multiModelEnabled])

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

  // Get current WBGT range for display
  const currentWbgtRange = wbgtRange && wbgtRange.length > 0 ? wbgtRange[0] : null

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
            wbgtRange={currentWbgtRange}
            multiModelEnabled={multiModelEnabled}
          />

          {/* 12-Hour Hourly Strip */}
          <HourlyStrip
            data={forecast}
            maxHours={12}
            wbgtRange={wbgtRange}
            multiModelEnabled={multiModelEnabled}
          />

          {/* Forecast Chart - 6 hours */}
          <ForecastChart
            data={forecast.slice(0, 6)}
            models={activeModels}
            showUncertainty={false}
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
                      ({multiModelEnabled ? '3 models' : 'BOM only'})
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
                    multiModelEnabled={multiModelEnabled}
                    onMultiModelChange={setMultiModelEnabled}
                    modelStatus={modelStatus}
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
