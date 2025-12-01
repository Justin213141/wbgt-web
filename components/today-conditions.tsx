"use client"

import { Card } from "./ui/card"
import { getWBGTZone, getWBGTZoneColor } from "@/lib/weather-utils"
import { parseApiDate } from "@/lib/utils"
import { Cloud, Sun, CloudRain, CloudSun } from "lucide-react"

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
  }
  forecastSummary?: {
    minTemp: number
    maxTemp: number
    maxWbgt: number
    rainChance: number
    description?: string
  }
}

export function TodayConditions({ data, forecastSummary }: TodayConditionsProps) {
  const zone = getWBGTZone(data.wbgt)
  const zoneColors = getWBGTZoneColor(zone)

  const timestamp = data.timestamp || data.localTimestamp
  const updateTime = timestamp
    ? parseApiDate(timestamp).toLocaleTimeString("en-AU", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      }).toUpperCase() + " AEDT"
    : ""

  // Weather icon based on cloud cover and conditions
  const getWeatherIcon = () => {
    if (data.cloud_cover > 80) return <Cloud className="h-12 w-12 text-gray-500" />
    if (data.cloud_cover > 40) return <CloudSun className="h-12 w-12 text-yellow-500" />
    return <Sun className="h-12 w-12 text-yellow-500" />
  }

  // UV Index category
  const getUvCategory = (uv: number) => {
    if (uv <= 2) return "Low"
    if (uv <= 5) return "Moderate"
    if (uv <= 7) return "High"
    if (uv <= 10) return "Very High"
    return "Extreme"
  }

  // Air Quality category (assuming AQI scale)
  const getAqCategory = (aqi?: number) => {
    if (!aqi) return "N/A"
    if (aqi <= 50) return "Good"
    if (aqi <= 100) return "Moderate"
    if (aqi <= 150) return "Unhealthy (Sensitive)"
    return "Unhealthy"
  }

  return (
    <Card className="overflow-hidden">
      <div className="grid md:grid-cols-2 gap-0">
        {/* Left: Current Conditions */}
        <div
          className="p-6"
          style={{ backgroundColor: zoneColors?.bg || '#f9fafb' }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-lg font-semibold" style={{ color: zoneColors?.text || '#374151' }}>
              Now
            </span>
            <span className="text-xs text-gray-500">
              UPDATED {updateTime}
            </span>
          </div>

          {/* WBGT Hero */}
          <div className="mb-4">
            <div
              className="text-6xl font-bold tracking-tight"
              style={{ color: zoneColors?.text || '#374151' }}
            >
              {data.wbgt.toFixed(1)}°
            </div>
            <div className="text-sm font-medium text-gray-600">WBGT</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-gray-500">→</span>
              <span className="text-lg font-semibold text-gray-700">
                {data.temperature.toFixed(1)}°C
              </span>
              <span className="text-sm text-gray-500">Temp</span>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200/50">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">Humidity</div>
              <div className="text-lg font-semibold text-gray-800">{data.humidity.toFixed(0)}%</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">Dew Point</div>
              <div className="text-lg font-semibold text-gray-800">{data.dew_point.toFixed(1)}°C</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">Wind</div>
              <div className="text-lg font-semibold text-gray-800">
                {(data.wind_speed_ms * 3.6).toFixed(0)} km/h
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">Cloud Cover</div>
              <div className="text-lg font-semibold text-gray-800">{data.cloud_cover.toFixed(0)}%</div>
            </div>
            <div className="col-span-2">
              <div className="text-xs text-gray-500 uppercase tracking-wide">Solar Radiation</div>
              <div className="text-lg font-semibold text-gray-800">{data.solar_radiation.toFixed(0)} W/m²</div>
            </div>
          </div>
        </div>

        {/* Right: Today Summary */}
        <div className="p-6 bg-white border-l border-gray-100">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              {getWeatherIcon()}
              <div>
                <div className="text-lg font-semibold text-gray-800">Today</div>
                <div className="text-sm text-gray-500">
                  {zone.label}
                </div>
              </div>
            </div>
            {forecastSummary && (
              <div className="flex gap-2">
                <span className="px-2 py-1 text-sm font-medium rounded bg-blue-100 text-blue-700">
                  {forecastSummary.minTemp.toFixed(0)}°
                </span>
                <span className="px-2 py-1 text-sm font-medium rounded bg-orange-100 text-orange-700">
                  {forecastSummary.maxTemp.toFixed(0)}°
                </span>
              </div>
            )}
          </div>

          {forecastSummary && (
            <p className="text-sm text-gray-600 mb-4">
              {forecastSummary.description || `Peak WBGT ${forecastSummary.maxWbgt.toFixed(0)}° expected today.`}
            </p>
          )}

          {/* Secondary Metrics */}
          <div className="space-y-3 pt-4 border-t border-gray-100">
            {forecastSummary && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CloudRain className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-gray-600">Rain</span>
                </div>
                <span className="text-sm font-medium text-gray-800">
                  {forecastSummary.rainChance}%
                </span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sun className="h-4 w-4 text-yellow-500" />
                <span className="text-sm text-gray-600">UV Index</span>
              </div>
              <span className="text-sm font-medium text-gray-800">
                {data.uv_index !== undefined ? getUvCategory(data.uv_index) : "N/A"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">Air Quality</span>
              </div>
              <span className="text-sm font-medium text-gray-800">
                {getAqCategory(data.air_quality)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
