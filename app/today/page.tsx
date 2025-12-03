"use client"

import { PageContainer } from "@/components/page-container"
import { TodayConditions } from "@/components/today-conditions"
import { HourlyStrip } from "@/components/hourly-strip"
import { ForecastChart } from "@/components/forecast-chart"
import { ModelSelector } from "@/components/model-selector"
import useSWR from "swr"
import { fetchObservations } from "@/lib/api"
import { fetchAirQuality, getAQIForTimestamp, type AirQualityData } from "@/lib/air-quality"
import { fetchAllModels, type ModelName, getSuccessfulModels } from "@/lib/model-fetcher"
import { calculateKongWBGT, type WBGTParams } from "@/lib/kong-wbgt"
import type { WeatherObservation, WeatherForecast, WeatherModelId } from "@/lib/types"
import { calculateEnsembleStats, type EnsembleDataPoint } from "@/lib/ensemble-utils"
import { Loader2 } from "lucide-react"
import { parseApiDate } from "@/lib/utils"
import { useState, useMemo } from "react"

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

  // Determine which models to fetch based on toggle
  const enabledModels = multiModelEnabled ? MULTIMODEL_IDS : SINGLE_MODEL_IDS

  // Fetch observations for current conditions (most recent actual data)
  const { data: observationsData } = useSWR<any>("observations", fetchObservations, {
    refreshInterval: 60000,
  })

  // Fetch air quality forecast data
  const { data: airQualityData } = useSWR<AirQualityData>(
    "air-quality-forecast",
    () => fetchAirQuality(-33.87, 151.21),
    { refreshInterval: 300000 }
  )

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
  const { forecast, ensembleData, activeModels, forecastSummary, wbgtRange, ranges } = useMemo(() => {
    if (!modelResults) return { forecast: [] as WeatherForecast[], ensembleData: null, activeModels: [] as WeatherModelId[], forecastSummary: null, wbgtRange: null, ranges: null }

    const successfulModels = getSuccessfulModels(modelResults)
    if (successfulModels.length === 0) return { forecast: [] as WeatherForecast[], ensembleData: null, activeModels: [] as WeatherModelId[], forecastSummary: null, wbgtRange: null, ranges: null }

    // Get model IDs for legend display
    const modelIds = successfulModels.map(m => m.modelName) as WeatherModelId[]

    // Use first successful model's time array as reference
    const refModel = successfulModels[0]
    const times = refModel.times

    // Extended to 48 hours for scrollable forecast
    const maxHours = 48
    const limitedTimes = times.slice(0, maxHours)

    // Arrays to collect range data when multimodel
    const wbgtRangeData: { min: number; max: number }[] = []
    const tempRangeData: { min: number; max: number }[] = []
    const humidityRangeData: { min: number; max: number }[] = []
    const dewPointRangeData: { min: number; max: number }[] = []
    const windSpeedRangeData: { min: number; max: number }[] = []

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

        // Store ranges for other metrics
        const validTemp = tempValues.filter(v => !isNaN(v))
        tempRangeData.push({
          min: validTemp.length > 0 ? Math.min(...validTemp) : avgTemp,
          max: validTemp.length > 0 ? Math.max(...validTemp) : avgTemp,
        })

        const validHumidity = humidityValues.filter(v => !isNaN(v))
        humidityRangeData.push({
          min: validHumidity.length > 0 ? Math.min(...validHumidity) : avgHumidity,
          max: validHumidity.length > 0 ? Math.max(...validHumidity) : avgHumidity,
        })

        const validWindSpeed = windSpeedValues.filter(v => !isNaN(v))
        windSpeedRangeData.push({
          min: validWindSpeed.length > 0 ? Math.min(...validWindSpeed) * 3.6 : avgWindSpeed * 3.6,
          max: validWindSpeed.length > 0 ? Math.max(...validWindSpeed) * 3.6 : avgWindSpeed * 3.6,
        })

        // Calculate dew point using Magnus formula approximation
        const a = 17.27
        const b = 237.7
        const alpha = (a * avgTemp) / (b + avgTemp) + Math.log(avgHumidity / 100)
        const dewPoint = (b * alpha) / (a - alpha)

        // Calculate dew point for each model to get range
        const modelDewPoints: number[] = []
        successfulModels.forEach(model => {
          if (idx < model.times.length) {
            const temp = model.temperature[idx]
            const hum = model.humidity[idx]
            if (!isNaN(temp) && !isNaN(hum) && hum > 0) {
              const alphaModel = (a * temp) / (b + temp) + Math.log(hum / 100)
              const dpModel = (b * alphaModel) / (a - alphaModel)
              if (!isNaN(dpModel)) {
                modelDewPoints.push(dpModel)
              }
            }
          }
        })
        dewPointRangeData.push({
          min: modelDewPoints.length > 0 ? Math.min(...modelDewPoints) : dewPoint,
          max: modelDewPoints.length > 0 ? Math.max(...modelDewPoints) : dewPoint,
        })

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

    // Add air quality data to forecast
    const forecastWithAQI = forecastData.map(f => {
      if (airQualityData) {
        const aqiResult = getAQIForTimestamp(airQualityData, f.timestamp || f.localTimestamp || '')
        return {
          ...f,
          air_quality: aqiResult?.overall,
        }
      }
      return f
    })

    // Calculate forecast summary for TodayConditions - filter to today only
    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(todayStart)
    todayEnd.setDate(todayEnd.getDate() + 1)

    const todayForecasts = forecastWithAQI.filter(f => {
      const fDate = parseApiDate(f.timestamp || f.localTimestamp || '')
      return fDate >= todayStart && fDate < todayEnd
    })

    const temps = todayForecasts.length > 0 ? todayForecasts.map(f => f.temperature) : forecastWithAQI.slice(0, 12).map(f => f.temperature)
    const wbgts = todayForecasts.length > 0 ? todayForecasts.map(f => f.wbgt) : forecastWithAQI.slice(0, 12).map(f => f.wbgt)
    const rainChances = todayForecasts.length > 0 ? todayForecasts.map(f => f.rain_chance) : forecastWithAQI.slice(0, 12).map(f => f.rain_chance)

    const minTemp = Math.min(...temps)
    const maxTemp = Math.max(...temps)
    const maxWbgt = Math.max(...wbgts)
    const maxRain = Math.max(...rainChances)

    // Calculate WBGT time window (hours within 1°C of peak)
    let maxWbgtTimeWindow: string | undefined
    const wbgtWithTimes = (todayForecasts.length > 0 ? todayForecasts : forecastWithAQI.slice(0, 12))
      .filter(f => f.wbgt >= maxWbgt - 1)
      .map(f => parseApiDate(f.timestamp || f.localTimestamp || ''))
    if (wbgtWithTimes.length > 0) {
      const sortedTimes = wbgtWithTimes.sort((a, b) => a.getTime() - b.getTime())
      const startHour = sortedTimes[0].getHours()
      const endHour = sortedTimes[sortedTimes.length - 1].getHours() + 1
      const formatHr = (h: number) => `${h % 12 || 12}${h < 12 ? 'AM' : 'PM'}`
      maxWbgtTimeWindow = `${formatHr(startHour)}-${formatHr(endHour)}`
    }

    // Calculate peak rain time (if any rain > 10%)
    let peakRainTime: string | undefined
    if (maxRain > 10) {
      const peakRainForecast = (todayForecasts.length > 0 ? todayForecasts : forecastWithAQI.slice(0, 12))
        .find(f => f.rain_chance === maxRain)
      if (peakRainForecast) {
        const peakTime = parseApiDate(peakRainForecast.timestamp || peakRainForecast.localTimestamp || '')
        peakRainTime = peakTime.toLocaleTimeString("en-AU", { hour: "numeric", hour12: true }).toUpperCase()
      }
    }

    // Calculate min/max temp ranges when multimodel is enabled
    let minTempRange: { min: number; max: number } | undefined
    let maxTempRange: { min: number; max: number } | undefined
    if (multiModelEnabled && tempRangeData.length > 0) {
      // Find the forecast objects with min/max temps
      const sourceForecasts = todayForecasts.length > 0 ? todayForecasts : forecastWithAQI.slice(0, 12)
      const minTempForecast = sourceForecasts.find(f => f.temperature === minTemp)
      const maxTempForecast = sourceForecasts.find(f => f.temperature === maxTemp)

      // Look up their indices in the original forecastWithAQI to get correct range data
      if (minTempForecast) {
        const originalIdx = forecastWithAQI.indexOf(minTempForecast)
        if (originalIdx >= 0 && originalIdx < tempRangeData.length) {
          minTempRange = tempRangeData[originalIdx]
        }
      }
      if (maxTempForecast) {
        const originalIdx = forecastWithAQI.indexOf(maxTempForecast)
        if (originalIdx >= 0 && originalIdx < tempRangeData.length) {
          maxTempRange = tempRangeData[originalIdx]
        }
      }
    }

    const summary = {
      minTemp,
      maxTemp,
      minTempRange,
      maxTempRange,
      maxWbgt,
      maxWbgtTimeWindow,
      rainChance: maxRain,
      peakRainTime,
    }

    // Build ranges object for HourlyStrip
    const ranges = multiModelEnabled ? {
      temperature: tempRangeData,
      dew_point: dewPointRangeData,
      humidity: humidityRangeData,
      wind_speed: windSpeedRangeData,
    } : null

    return {
      forecast: forecastWithAQI,
      ensembleData: null, // We don't need ensemble data for charts anymore
      activeModels: modelIds,
      forecastSummary: summary,
      wbgtRange: multiModelEnabled && wbgtRangeData.length > 0 ? wbgtRangeData : null,
      ranges,
    }
  }, [modelResults, multiModelEnabled, airQualityData])

  // Get the most recent observation for current conditions and calculate worst daily AQI
  let currentData: WeatherObservation | null = null
  let worstDailyAqi: number | undefined = undefined
  let worstDailyAqiTime: string | undefined = undefined
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

      // Calculate worst (highest) AQI from today's observations with timestamp
      // Limited to 7am-10pm as AQI outside these hours is less relevant
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const todayAqiObs = observations
        .filter(obs => {
          const obsDate = parseApiDate(obs.timestamp || obs.localTimestamp || "")
          const hour = obsDate.getHours()
          return obsDate >= todayStart &&
                 hour >= 7 && hour < 22 && // 7am to 10pm
                 obs.air_quality !== undefined && obs.air_quality !== null
        })

      if (todayAqiObs.length > 0) {
        const worstObs = todayAqiObs.reduce((worst, obs) =>
          (obs.air_quality ?? 0) > (worst.air_quality ?? 0) ? obs : worst
        )
        worstDailyAqi = worstObs.air_quality
        const worstTime = parseApiDate(worstObs.timestamp || worstObs.localTimestamp || '')
        worstDailyAqiTime = worstTime.toLocaleTimeString("en-AU", {
          hour: "numeric",
          hour12: true
        }).toUpperCase()
      }
    }
  }

  // Calculate tomorrow's summary from forecast
  const tomorrowSummary = useMemo(() => {
    if (forecast.length === 0) return undefined

    const now = new Date()
    const tomorrowStart = new Date(now)
    tomorrowStart.setDate(tomorrowStart.getDate() + 1)
    tomorrowStart.setHours(0, 0, 0, 0)
    const tomorrowEnd = new Date(tomorrowStart)
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1)

    const tomorrowForecasts = forecast.filter(f => {
      const fDate = parseApiDate(f.timestamp || f.localTimestamp || '')
      return fDate >= tomorrowStart && fDate < tomorrowEnd
    })

    if (tomorrowForecasts.length === 0) return undefined

    const temps = tomorrowForecasts.map(f => f.temperature)
    const wbgts = tomorrowForecasts.map(f => f.wbgt)
    const rainChances = tomorrowForecasts.map(f => f.rain_chance)

    const minTemp = Math.min(...temps)
    const maxTemp = Math.max(...temps)
    const maxWbgt = Math.max(...wbgts)
    const maxRain = Math.max(...rainChances)

    // Calculate WBGT time window (hours within 1°C of peak)
    let maxWbgtTimeWindow: string | undefined
    const wbgtWithTimes = tomorrowForecasts
      .filter(f => f.wbgt >= maxWbgt - 1)
      .map(f => parseApiDate(f.timestamp || f.localTimestamp || ''))
    if (wbgtWithTimes.length > 0) {
      const sortedTimes = wbgtWithTimes.sort((a, b) => a.getTime() - b.getTime())
      const startHour = sortedTimes[0].getHours()
      const endHour = sortedTimes[sortedTimes.length - 1].getHours() + 1
      const formatHr = (h: number) => `${h % 12 || 12}${h < 12 ? 'AM' : 'PM'}`
      maxWbgtTimeWindow = `${formatHr(startHour)}-${formatHr(endHour)}`
    }

    // Calculate peak rain time (if any rain > 10%)
    let peakRainTime: string | undefined
    if (maxRain > 10) {
      const peakRainForecast = tomorrowForecasts.find(f => f.rain_chance === maxRain)
      if (peakRainForecast) {
        const peakTime = parseApiDate(peakRainForecast.timestamp || peakRainForecast.localTimestamp || '')
        peakRainTime = peakTime.toLocaleTimeString("en-AU", { hour: "numeric", hour12: true }).toUpperCase()
      }
    }

    // Find peak AQI for tomorrow with timestamp (limited to 7am-10pm)
    let peakAqi: number | undefined
    let peakAqiTime: string | undefined

    const aqiForecasts = tomorrowForecasts.filter(f => {
      if (f.air_quality === undefined || f.air_quality === null) return false
      const hour = parseApiDate(f.timestamp || f.localTimestamp || '').getHours()
      return hour >= 7 && hour < 22 // 7am to 10pm
    })
    if (aqiForecasts.length > 0) {
      const peakForecast = aqiForecasts.reduce((peak, f) =>
        (f.air_quality ?? 0) > (peak.air_quality ?? 0) ? f : peak
      )
      peakAqi = peakForecast.air_quality
      const peakTime = parseApiDate(peakForecast.timestamp || peakForecast.localTimestamp || '')
      peakAqiTime = peakTime.toLocaleTimeString("en-AU", {
        hour: "numeric",
        hour12: true
      }).toUpperCase()
    }

    // Determine most extreme weather icon
    // Priority: storm > rain > snow > wind > cloudy > partly cloudy > sunny
    let iconDescriptor: string | undefined
    const hasStorm = tomorrowForecasts.some(f => (f as any).icon_descriptor?.toLowerCase().includes('storm'))
    const hasRain = maxRain > 30 || tomorrowForecasts.some(f => (f as any).icon_descriptor?.toLowerCase().includes('rain'))
    const hasCloud = tomorrowForecasts.some(f => f.cloud_cover > 70)
    if (hasStorm) iconDescriptor = 'storm'
    else if (hasRain) iconDescriptor = 'rain'
    else if (hasCloud) iconDescriptor = 'cloudy'
    else iconDescriptor = 'sunny'

    // Calculate min/max temp ranges when multimodel is enabled
    let minTempRange: { min: number; max: number } | undefined
    let maxTempRange: { min: number; max: number } | undefined
    if (multiModelEnabled && ranges?.temperature && ranges.temperature.length > 0) {
      const minTempForecast = tomorrowForecasts.find(f => f.temperature === minTemp)
      const maxTempForecast = tomorrowForecasts.find(f => f.temperature === maxTemp)

      if (minTempForecast) {
        const originalIdx = forecast.indexOf(minTempForecast)
        if (originalIdx >= 0 && originalIdx < ranges.temperature.length) {
          minTempRange = ranges.temperature[originalIdx]
        }
      }
      if (maxTempForecast) {
        const originalIdx = forecast.indexOf(maxTempForecast)
        if (originalIdx >= 0 && originalIdx < ranges.temperature.length) {
          maxTempRange = ranges.temperature[originalIdx]
        }
      }
    }

    return {
      minTemp,
      maxTemp,
      minTempRange,
      maxTempRange,
      maxWbgt,
      maxWbgtTimeWindow,
      rainChance: maxRain,
      peakRainTime,
      peakAqi,
      peakAqiTime,
      iconDescriptor,
    }
  }, [forecast, multiModelEnabled, ranges])

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
  // Also supplement solar radiation from forecast if observation solar is 0/NaN during daytime
  const rawDisplayData = (currentData && 'wbgt' in currentData && currentData.wbgt !== undefined)
    ? currentData
    : derivedCurrentData

  // Supplement solar radiation from forecast when observation data is stale (satellite API lag)
  const displayCurrentData = rawDisplayData ? (() => {
    const hour = rawDisplayData.timestamp || rawDisplayData.localTimestamp
      ? new Date(rawDisplayData.timestamp || rawDisplayData.localTimestamp || '').getHours()
      : new Date().getHours()
    const isDaytime = hour >= 6 && hour < 19
    const solarIsStale = (rawDisplayData.solar_radiation ?? 0) === 0 && isDaytime

    // If solar radiation is stale during daytime, use forecast data
    if (solarIsStale && forecast.length > 0) {
      const forecastSolar = forecast[0].solar_radiation
      const forecastCloudCover = forecast[0].cloud_cover
      return {
        ...rawDisplayData,
        solar_radiation: forecastSolar,
        cloud_cover: forecastCloudCover
      }
    }
    return rawDisplayData
  })() : null

  const isLoading = modelsLoading || (!modelResults && !modelError)
  const hasError = modelError
  const hasValidData = displayCurrentData && 'wbgt' in displayCurrentData && displayCurrentData.wbgt !== undefined

  // Get current WBGT range for display - only show range if using derived (forecast) data
  // When using actual observation data, WBGT is a single measured value, not a range
  const isUsingObservationData = currentData && 'wbgt' in currentData && currentData.wbgt !== undefined
  const currentWbgtRange = (!isUsingObservationData && wbgtRange && wbgtRange.length > 0) ? wbgtRange[0] : null

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
            tomorrowSummary={tomorrowSummary}
            wbgtRange={currentWbgtRange}
            multiModelEnabled={multiModelEnabled}
            worstDailyAqi={worstDailyAqi}
            worstDailyAqiTime={worstDailyAqiTime}
          />

          {/* 36-Hour Scrollable Forecast */}
          <HourlyStrip
            data={forecast}
            wbgtRange={wbgtRange}
            ranges={ranges}
            multiModelEnabled={multiModelEnabled}
          />

          {/* Forecast Chart - 6 hours */}
          <ForecastChart
            data={forecast.slice(0, 6)}
            models={activeModels}
            showUncertainty={false}
            wbgtRange={wbgtRange?.slice(0, 6)}
            tempRange={ranges?.temperature?.slice(0, 6)}
            multiModelEnabled={multiModelEnabled}
          />

          {/* Model Selector */}
          <ModelSelector
            multiModelEnabled={multiModelEnabled}
            onMultiModelChange={setMultiModelEnabled}
            modelStatus={modelStatus}
          />
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
