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
import { Loader2, Settings } from "lucide-react"
import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { getLocationPreference, type LocationCoordinates } from "@/lib/utils"

// Map model IDs from ModelSelector to ModelFetcher format
const MODEL_ID_MAP: Record<string, ModelName> = {
  'ecmwf': 'ecmwf_ifs',
  'gfs': 'gfs_seamless',
  'bom': 'bom_access',
}

// Models to use when multimodel is enabled
const MULTIMODEL_IDS = ['bom', 'gfs', 'ecmwf']
const SINGLE_MODEL_IDS = ['bom']

export default function FuturePage() {
  // Multimodel toggle state - default to false (BOM only)
  const [multiModelEnabled, setMultiModelEnabled] = useState(false)
  const [modelStatus, setModelStatus] = useState<Record<string, 'loading' | 'success' | 'error'>>({})
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Location preference state
  const [location, setLocation] = useState<LocationCoordinates>(getLocationPreference)

  // Load location preference from localStorage on mount and listen for changes
  useEffect(() => {
    const updateLocation = () => {
      setLocation(getLocationPreference())
    }

    // Listen for storage events (when location changes in settings)
    window.addEventListener('storage', updateLocation)

    // Also listen for custom event when location is updated in the same tab
    window.addEventListener('locationPreferenceChanged', updateLocation)

    return () => {
      window.removeEventListener('storage', updateLocation)
      window.removeEventListener('locationPreferenceChanged', updateLocation)
    }
  }, [])

  // Determine which models to fetch based on toggle
  const enabledModels = multiModelEnabled ? MULTIMODEL_IDS : SINGLE_MODEL_IDS

  // Fetch multi-model forecast data
  const { data: modelResults, error: modelError, isLoading: modelsLoading } = useSWR(
    ['future-forecast', enabledModels, location.lat, location.lon],
    async () => {
      const modelNames = enabledModels.map(id => MODEL_ID_MAP[id]).filter(Boolean) as ModelName[]

      const loadingStatus: Record<string, 'loading' | 'success' | 'error'> = {}
      enabledModels.forEach(id => {
        loadingStatus[id] = 'loading'
      })
      setModelStatus(loadingStatus)

      const results = await fetchAllModels(location.lat, location.lon, modelNames)

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
  // When multimodel is enabled: average input variables, then calculate WBGT
  const { forecast, activeModels, wbgtRange } = useMemo(() => {
    if (!modelResults) return { forecast: [] as WeatherForecast[], activeModels: [] as WeatherModelId[], wbgtRange: null }

    const successfulModels = getSuccessfulModels(modelResults)
    if (successfulModels.length === 0) return { forecast: [] as WeatherForecast[], activeModels: [] as WeatherModelId[], wbgtRange: null }

    const modelIds = successfulModels.map(m => m.modelName) as WeatherModelId[]
    const refModel = successfulModels[0]
    const times = refModel.times

    // Extended to 48 hours
    const maxHours = 48
    const limitedTimes = times.slice(0, maxHours)

    // Arrays to collect WBGT range data when multimodel
    const wbgtRangeData: { min: number; max: number }[] = []

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
          latitude: location.lat,
          longitude: location.lon,
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
              latitude: location.lat,
              longitude: location.lon,
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
          latitude: location.lat,
          longitude: location.lon,
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

    return {
      forecast: forecastData,
      activeModels: modelIds,
      wbgtRange: multiModelEnabled && wbgtRangeData.length > 0 ? wbgtRangeData : null,
    }
  }, [modelResults, multiModelEnabled, location.lat, location.lon])

  const isLoading = modelsLoading || (!modelResults && !modelError)
  const hasError = modelError

  // Filter to 3-hour intervals for chart display
  const chartData = forecast.filter((_, index) => index % 3 === 0)

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
            models={activeModels}
            showUncertainty={false}
          />

          {/* Time Range Finder - compact cards */}
          <TimeRangeFinder data={forecast} />

          {/* Detailed Forecast Table - 3-hour intervals */}
          <HourlyForecastTable
            data={forecast}
            title="48-Hour Detailed Forecast"
            intervalHours={3}
            wbgtRange={wbgtRange}
            multiModelEnabled={multiModelEnabled}
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

      {!isLoading && !hasError && forecast.length === 0 && (
        <div className="rounded-lg border border-border bg-muted p-8 text-center">
          <p className="text-muted-foreground">No forecast data available</p>
        </div>
      )}
    </PageContainer>
  )
}
