"use client"

import { Card } from "./ui/card"
import {
  getWBGTZone,
  getWBGTZoneColor,
  getWbgtTextColor,
  getTemperatureTextColor,
  getSolarRadiationTextColor,
  getDewPointTextColor,
  getUvIndexTextColor,
  getAqiTextColor,
  getWindSpeedTextColor
} from "@/lib/weather-utils"
import { parseApiDate } from "@/lib/utils"
import { Cloud, Sun, CloudRain, CloudSun, CloudLightning, CloudSnow, Wind, Thermometer } from "lucide-react"

interface DaySummary {
  minTemp: number
  maxTemp: number
  minTempRange?: { min: number; max: number }
  maxTempRange?: { min: number; max: number }
  maxWbgt: number
  maxWbgtTimeWindow?: string  // e.g., "1PM-3PM"
  rainChance: number
  peakRainTime?: string
  peakAqi?: number
  peakAqiTime?: string
  description?: string
  iconDescriptor?: string  // BOM icon descriptor for weather icon
}

interface TodayConditionsProps {
  data: {
    wbgt: number
    temperature: number
    humidity: number
    wind_speed_ms: number
    solar_radiation: number
    cloud_cover: number
    dew_point: number
    uv_index?: number
    air_quality?: number
    timestamp?: string
    localTimestamp?: string
    weather_source?: string
    solar_source?: string
    station?: string
    station_name?: string
  }
  forecastSummary?: DaySummary
  tomorrowSummary?: DaySummary
  wbgtRange?: { min: number; max: number } | null
  multiModelEnabled?: boolean
  worstDailyAqi?: number
  worstDailyAqiTime?: string
}

export function TodayConditions({ data, forecastSummary, tomorrowSummary, wbgtRange, multiModelEnabled, worstDailyAqi, worstDailyAqiTime }: TodayConditionsProps) {
  const wbgtValue = data.wbgt ?? 0
  const zone = getWBGTZone(wbgtValue)
  const zoneColors = getWBGTZoneColor(zone)

  const timestamp = data.timestamp || data.localTimestamp
  const updateTime = timestamp
    ? parseApiDate(timestamp).toLocaleTimeString("en-AU", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      }).toUpperCase() + " AEDT"
    : ""

  // Weather icon based on cloud cover and conditions (for current conditions)
  const getWeatherIcon = () => {
    if (data.cloud_cover > 80) return <Cloud className="h-12 w-12 text-gray-500" />
    if (data.cloud_cover > 40) return <CloudSun className="h-12 w-12 text-yellow-500" />
    return <Sun className="h-12 w-12 text-yellow-500" />
  }

  // Weather icon from BOM icon descriptor (for forecasts)
  const getWeatherIconFromDescriptor = (descriptor?: string, size: string = "h-12 w-12") => {
    if (!descriptor) return <Sun className={`${size} text-yellow-500`} />
    const d = descriptor.toLowerCase()
    // Storm icons (most extreme)
    if (d.includes('storm') || d.includes('thunder')) return <CloudLightning className={`${size} text-purple-500`} />
    // Rain icons
    if (d.includes('rain') || d.includes('shower')) return <CloudRain className={`${size} text-blue-500`} />
    // Snow/hail
    if (d.includes('snow') || d.includes('hail') || d.includes('frost')) return <CloudSnow className={`${size} text-blue-300`} />
    // Wind
    if (d.includes('wind') || d.includes('dust')) return <Wind className={`${size} text-gray-500`} />
    // Cloudy
    if (d.includes('overcast') || d.includes('cloudy')) return <Cloud className={`${size} text-gray-400`} />
    // Partly cloudy
    if (d.includes('partly') || d.includes('cloud')) return <CloudSun className={`${size} text-yellow-500`} />
    // Hot
    if (d.includes('hot') || d.includes('heat')) return <Thermometer className={`${size} text-red-500`} />
    // Default - sunny/clear
    return <Sun className={`${size} text-yellow-500`} />
  }

  // UV Index category
  const getUvCategory = (uv: number) => {
    if (uv <= 2) return "Low"
    if (uv <= 5) return "Moderate"
    if (uv <= 7) return "High"
    if (uv <= 10) return "Very High"
    return "Extreme"
  }

  // Australian Air Quality Index categories (NEPM standards)
  const getAqCategory = (aqi?: number) => {
    if (aqi === undefined || aqi === null) return "N/A"
    if (aqi <= 33) return "Very Good"
    if (aqi <= 66) return "Good"
    if (aqi <= 99) return "Fair"
    if (aqi <= 149) return "Poor"
    return "Very Poor"
  }

  // Format WBGT with range if multimodel is enabled
  const formatWbgt = () => {
    const mainValue = wbgtValue.toFixed(1)
    if (multiModelEnabled && wbgtRange) {
      const rangeMin = wbgtRange.min.toFixed(1)
      const rangeMax = wbgtRange.max.toFixed(1)
      return (
        <span>
          {mainValue}°
          <span className="text-2xl ml-1 opacity-60">
            ({rangeMin}-{rangeMax})
          </span>
        </span>
      )
    }
    return <span>{mainValue}°</span>
  }

  return (
    <Card className="overflow-hidden">
      <div className="grid md:grid-cols-2 gap-0">
        {/* Left: Current Conditions */}
        <div
          className="p-6"
          style={{ backgroundColor: zoneColors?.bg || '#f9fafb' }}
        >
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold" style={{ color: zoneColors?.text || '#374151' }}>
                Now
              </span>
              <div className="text-right">
                <div className="text-xs text-gray-500">
                  UPDATED {updateTime}
                </div>
                {(data.weather_source || data.station) && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    {data.weather_source === 'bom' && (data.station_name || data.station) && `SOURCE: BOM ${data.station_name || data.station}`}
                    {data.weather_source === 'openmeteo_forecast' && 'SOURCE: Open-Meteo Forecast'}
                    {data.weather_source === 'openmeteo_archive' && 'SOURCE: Open-Meteo Archive'}
                    {!data.weather_source && 'SOURCE: Forecast'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* WBGT Hero */}
          <div className="mb-4">
            <div
              className="text-6xl font-bold tracking-tight"
              style={{ color: zoneColors?.text || '#374151' }}
            >
              {formatWbgt()}
            </div>
            <div className="text-sm font-medium text-gray-600">
              WBGT{multiModelEnabled && <span className="text-xs ml-1">(multi-model)</span>}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-gray-500">→</span>
              <span className="text-lg font-semibold text-gray-700">
                {(data.temperature ?? 0).toFixed(1)}°C
              </span>
              <span className="text-sm text-gray-500">Temp</span>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200/50">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">Humidity</div>
              <div className="text-lg font-semibold text-gray-800">{(data.humidity ?? 0).toFixed(0)}%</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">Dew Point</div>
              <div className={`text-lg font-semibold ${getDewPointTextColor(data.dew_point ?? 0)}`}>
                {(data.dew_point ?? 0).toFixed(1)}°C
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">Wind</div>
              <div className={`text-lg font-semibold ${getWindSpeedTextColor((data.wind_speed_ms ?? 0) * 3.6)}`}>
                {((data.wind_speed_ms ?? 0) * 3.6).toFixed(0)} km/h
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">Cloud Cover</div>
              <div className="text-lg font-semibold text-gray-800">{(data.cloud_cover ?? 0).toFixed(0)}%</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">Solar Radiation</div>
              <div className={`text-lg font-semibold ${getSolarRadiationTextColor(data.solar_radiation ?? 0)}`}>
                {(data.solar_radiation ?? 0).toFixed(0)} W/m²
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">UV</div>
              <div className={`text-lg font-semibold ${getUvIndexTextColor(data.uv_index ?? 0)}`}>
                {data.uv_index !== undefined ? Math.round(data.uv_index) : "N/A"}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Today Summary */}
        <div className="p-6 bg-white border-l border-gray-100">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              {forecastSummary?.iconDescriptor ? getWeatherIconFromDescriptor(forecastSummary.iconDescriptor) : getWeatherIcon()}
              <div>
                <div className="text-lg font-semibold text-gray-800">Today</div>
                <div className="text-sm text-gray-500">
                  {zone.label}
                </div>
              </div>
            </div>
            {forecastSummary && (
              <div className="flex gap-2">
                <div className="text-center">
                  <span className={`px-2 py-1 text-sm font-medium rounded bg-blue-100 ${getTemperatureTextColor(forecastSummary.minTemp ?? 0)}`}>
                    {(forecastSummary.minTemp ?? 0).toFixed(0)}°
                  </span>
                  {multiModelEnabled && forecastSummary.minTempRange && (
                    <div className="text-[9px] text-gray-500 mt-0.5">
                      ({forecastSummary.minTempRange.min.toFixed(0)}-{forecastSummary.minTempRange.max.toFixed(0)})
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <span className={`px-2 py-1 text-sm font-medium rounded bg-orange-100 ${getTemperatureTextColor(forecastSummary.maxTemp ?? 0)}`}>
                    {(forecastSummary.maxTemp ?? 0).toFixed(0)}°
                  </span>
                  {multiModelEnabled && forecastSummary.maxTempRange && (
                    <div className="text-[9px] text-gray-500 mt-0.5">
                      ({forecastSummary.maxTempRange.min.toFixed(0)}-{forecastSummary.maxTempRange.max.toFixed(0)})
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {forecastSummary && (
            <p className="text-sm text-gray-600 mb-4">
              {forecastSummary.description || (
                <>
                  Peak WBGT <span className={`font-semibold ${getWbgtTextColor(forecastSummary.maxWbgt ?? 0)}`}>{(forecastSummary.maxWbgt ?? 0).toFixed(0)}°</span>
                  {forecastSummary.maxWbgtTimeWindow && <span className="text-gray-500"> ({forecastSummary.maxWbgtTimeWindow})</span>}
                </>
              )}
            </p>
          )}

          {/* Secondary Metrics */}
          <div className="space-y-3 pt-4 border-t border-gray-100">
            {forecastSummary && forecastSummary.rainChance > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CloudRain className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-gray-600">Rain</span>
                </div>
                <span className="text-sm font-medium text-blue-600">
                  {forecastSummary.rainChance}%{forecastSummary.peakRainTime && ` at ${forecastSummary.peakRainTime}`}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">Peak AQI</span>
              </div>
              <span className={`text-sm font-medium ${getAqiTextColor(worstDailyAqi)}`}>
                {worstDailyAqi !== undefined
                  ? `${Math.round(worstDailyAqi)} (${getAqCategory(worstDailyAqi)})${worstDailyAqiTime ? ` at ${worstDailyAqiTime}` : ''}`
                  : "N/A"}
              </span>
            </div>
          </div>

          {/* Tomorrow Section */}
          {tomorrowSummary && (
            <div className="pt-4 mt-4 border-t border-gray-200">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {getWeatherIconFromDescriptor(tomorrowSummary.iconDescriptor, "h-10 w-10")}
                  <div>
                    <div className="text-lg font-semibold text-gray-800">Tomorrow</div>
                    <div className="text-sm text-gray-500">
                      {tomorrowSummary.description || (
                        <>
                          Peak WBGT <span className={`font-semibold ${getWbgtTextColor(tomorrowSummary.maxWbgt ?? 0)}`}>{(tomorrowSummary.maxWbgt ?? 0).toFixed(0)}°</span>
                          {tomorrowSummary.maxWbgtTimeWindow && <span> ({tomorrowSummary.maxWbgtTimeWindow})</span>}
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="text-center">
                    <span className={`px-2 py-1 text-sm font-medium rounded bg-blue-100 ${getTemperatureTextColor(tomorrowSummary.minTemp ?? 0)}`}>
                      {(tomorrowSummary.minTemp ?? 0).toFixed(0)}°
                    </span>
                    {multiModelEnabled && tomorrowSummary.minTempRange && (
                      <div className="text-[9px] text-gray-500 mt-0.5">
                        ({tomorrowSummary.minTempRange.min.toFixed(0)}-{tomorrowSummary.minTempRange.max.toFixed(0)})
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <span className={`px-2 py-1 text-sm font-medium rounded bg-orange-100 ${getTemperatureTextColor(tomorrowSummary.maxTemp ?? 0)}`}>
                      {(tomorrowSummary.maxTemp ?? 0).toFixed(0)}°
                    </span>
                    {multiModelEnabled && tomorrowSummary.maxTempRange && (
                      <div className="text-[9px] text-gray-500 mt-0.5">
                        ({tomorrowSummary.maxTempRange.min.toFixed(0)}-{tomorrowSummary.maxTempRange.max.toFixed(0)})
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {tomorrowSummary.rainChance > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CloudRain className="h-4 w-4 text-blue-500" />
                      <span className="text-sm text-gray-600">Rain</span>
                    </div>
                    <span className="text-sm font-medium text-blue-600">
                      {tomorrowSummary.rainChance}%{tomorrowSummary.peakRainTime && ` at ${tomorrowSummary.peakRainTime}`}
                    </span>
                  </div>
                )}
                {tomorrowSummary.peakAqi !== undefined && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cloud className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">Peak AQI</span>
                    </div>
                    <span className={`text-sm font-medium ${getAqiTextColor(tomorrowSummary.peakAqi)}`}>
                      {Math.round(tomorrowSummary.peakAqi)} ({getAqCategory(tomorrowSummary.peakAqi)})
                      {tomorrowSummary.peakAqiTime ? ` at ${tomorrowSummary.peakAqiTime}` : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
