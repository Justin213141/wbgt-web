"use client"

import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { parseApiDate } from "@/lib/utils"
import {
  getWBGTZone,
  getWBGTZoneColor,
  getWbgtTextColor,
  getSolarRadiationTextColor,
  getDewPointTextColor,
  getUvIndexTextColor,
  getAqiTextColor,
  getWindSpeedTextColor,
  getTemperatureTextColor
} from "@/lib/weather-utils"
import { Cloud, Sun, CloudRain, CloudSun, CloudLightning, Moon, CloudMoon } from "lucide-react"
import { useRef } from "react"

interface HourlyData {
  localTimestamp: string
  temperature: number
  wbgt: number
  solar_radiation: number
  dew_point: number
  rain_chance: number
  wind_speed_ms: number
  cloud_cover: number
  humidity?: number
  uv_index?: number
  air_quality?: number
}

interface MetricRange {
  min: number
  max: number
}

interface HourlyRanges {
  wbgt?: MetricRange[]
  temperature?: MetricRange[]
  dew_point?: MetricRange[]
  humidity?: MetricRange[]
  wind_speed?: MetricRange[]
}

interface HourlyStripProps {
  data: HourlyData[]
  maxHours?: number
  wbgtRange?: { min: number; max: number }[] | null
  ranges?: HourlyRanges | null
  multiModelEnabled?: boolean
}

export function HourlyStrip({ data, maxHours = 48, wbgtRange, ranges, multiModelEnabled }: HourlyStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const displayData = data.slice(0, maxHours)

  // Helper to format a value with range
  const formatWithRange = (value: number, rangeArr: MetricRange[] | undefined, index: number, unit: string = '', decimals: number = 0) => {
    const mainValue = value.toFixed(decimals)
    if (multiModelEnabled && rangeArr && rangeArr[index]) {
      const range = rangeArr[index]
      const rangeMin = range.min.toFixed(decimals)
      const rangeMax = range.max.toFixed(decimals)
      return (
        <div className="flex flex-col items-center leading-tight">
          <span>{mainValue}{unit}</span>
          <span className="text-[9px] opacity-60">({rangeMin}-{rangeMax})</span>
        </div>
      )
    }
    return <span>{mainValue}{unit}</span>
  }

  const getWeatherIcon = (hour: HourlyData, hourNum: number) => {
    const isNight = hourNum >= 19 || hourNum < 6
    const iconClass = "h-6 w-6"

    if (hour.rain_chance > 60) {
      return <CloudRain className={`${iconClass} text-blue-500`} />
    }
    if (hour.rain_chance > 30) {
      return <CloudLightning className={`${iconClass} text-gray-500`} />
    }
    if (hour.cloud_cover > 80) {
      return isNight
        ? <CloudMoon className={`${iconClass} text-gray-400`} />
        : <Cloud className={`${iconClass} text-gray-400`} />
    }
    if (hour.cloud_cover > 40) {
      return isNight
        ? <CloudMoon className={`${iconClass} text-gray-400`} />
        : <CloudSun className={`${iconClass} text-yellow-500`} />
    }
    return isNight
      ? <Moon className={`${iconClass} text-indigo-400`} />
      : <Sun className={`${iconClass} text-yellow-500`} />
  }

  // Use shared color utilities from weather-utils.ts

  const formatHour = (timestamp: string, index: number) => {
    if (index === 0) return "NOW"
    const date = parseApiDate(timestamp)
    return date.toLocaleTimeString("en-AU", { hour: "numeric", hour12: true }).toUpperCase()
  }

  // Format WBGT with range if multimodel is enabled
  const formatWbgtValue = (wbgt: number, index: number) => {
    const mainValue = (wbgt ?? 0).toFixed(0)
    if (multiModelEnabled && wbgtRange && wbgtRange[index]) {
      const range = wbgtRange[index]
      const rangeMin = range.min.toFixed(0)
      const rangeMax = range.max.toFixed(0)
      return (
        <div className="flex flex-col items-center leading-tight">
          <span>{mainValue}°</span>
          <span className="text-[9px] opacity-60">({rangeMin}-{rangeMax})</span>
        </div>
      )
    }
    return <span>{mainValue}°</span>
  }

  // Rows that get taller when multimodel is enabled to show ranges
  const rangeRows = multiModelEnabled ? ['temp', 'wbgt', 'dp', 'humidity', 'wind'] : []

  // Reordered: WBGT, Temp, SR, DP, RH, Wind, Rain %, UV, AQI
  const rowLabels = [
    { key: "icon", label: "" },
    { key: "wbgt", label: "WBGT" },
    { key: "temp", label: "°C" },
    { key: "sr", label: "SR" },
    { key: "dp", label: "DP" },
    { key: "humidity", label: "RH%" },
    { key: "wind", label: "km/h" },
    { key: "rain", label: "Rain %" },
    { key: "uv", label: "UV" },
    { key: "aqi", label: "AQI" },
  ]

  // Group hours by date for date header row
  const getDayGroups = () => {
    const groups: { date: string; label: string; count: number }[] = []
    let currentDate = ''
    let currentCount = 0

    displayData.forEach((hour, index) => {
      const date = parseApiDate(hour.localTimestamp)
      const dateKey = date.toDateString()

      if (dateKey !== currentDate) {
        if (currentCount > 0) {
          const prevDate = parseApiDate(displayData[index - 1].localTimestamp)
          const dayName = prevDate.toLocaleDateString('en-AU', { weekday: 'short' })
          const dateNum = prevDate.getDate()
          const month = prevDate.toLocaleDateString('en-AU', { month: 'short' })
          groups.push({
            date: currentDate,
            label: `${dayName} ${dateNum} ${month}`,
            count: currentCount
          })
        }
        currentDate = dateKey
        currentCount = 1
      } else {
        currentCount++
      }
    })

    // Push last group
    if (currentCount > 0 && displayData.length > 0) {
      const lastDate = parseApiDate(displayData[displayData.length - 1].localTimestamp)
      const dayName = lastDate.toLocaleDateString('en-AU', { weekday: 'short' })
      const dateNum = lastDate.getDate()
      const month = lastDate.toLocaleDateString('en-AU', { month: 'short' })
      groups.push({
        date: currentDate,
        label: `${dayName} ${dateNum} ${month}`,
        count: currentCount
      })
    }

    return groups
  }

  const dayGroups = getDayGroups()

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Forecast</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto" ref={scrollRef}>
          <div className="min-w-max">
            {/* Date header row */}
            <div className="flex">
              {/* Empty label cell for date row */}
              <div className="flex-shrink-0 w-12 bg-gray-100 border-r border-gray-200">
                <div className="h-6 flex items-center justify-center text-[10px] text-gray-500 font-medium"></div>
              </div>
              {/* Date spans */}
              {dayGroups.map((group, groupIndex) => (
                <div
                  key={group.date}
                  className="flex-shrink-0 bg-gray-100 border-r border-gray-200 last:border-r-0"
                  style={{ width: `${group.count * 56}px` }}
                >
                  <div className="h-6 flex items-center justify-center text-xs font-semibold text-gray-700">
                    {group.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Row labels on left, then data columns */}
            <div className="flex">
              {/* Labels column */}
              <div className="flex-shrink-0 w-12 bg-gray-50 border-r border-gray-100">
                <div className="h-8 flex items-center justify-center text-[10px] text-gray-400 font-medium border-b border-gray-100"></div>
                {rowLabels.map((row) => (
                  <div
                    key={row.key}
                    className={`flex items-center justify-center text-[10px] text-gray-400 font-medium ${rangeRows.includes(row.key) ? 'h-10' : 'h-7'}`}
                  >
                    {row.label}
                  </div>
                ))}
              </div>

              {/* Data columns */}
              {displayData.map((hour, index) => {
                const date = parseApiDate(hour.localTimestamp)
                const hourNum = date.getHours()

                return (
                  <div
                    key={hour.localTimestamp}
                    className="flex-shrink-0 w-14 text-center border-r border-gray-50 last:border-r-0"
                  >
                    {/* Hour label */}
                    <div className="h-8 flex items-center justify-center text-xs font-semibold text-gray-700 bg-gray-50 border-b border-gray-100">
                      {formatHour(hour.localTimestamp, index)}
                    </div>

                    {/* Weather icon */}
                    <div className="h-7 flex items-center justify-center">
                      {getWeatherIcon(hour, hourNum)}
                    </div>

                    {/* WBGT - first after icon */}
                    <div className={`flex items-center justify-center text-sm font-semibold ${getWbgtTextColor(hour.wbgt ?? 0)} ${multiModelEnabled ? 'h-10' : 'h-7'}`}>
                      {formatWbgtValue(hour.wbgt, index)}
                    </div>

                    {/* Temperature */}
                    <div className={`flex items-center justify-center text-sm font-semibold ${getTemperatureTextColor(hour.temperature ?? 0)} ${multiModelEnabled ? 'h-10' : 'h-7'}`}>
                      {formatWithRange(hour.temperature ?? 0, ranges?.temperature, index, '°')}
                    </div>

                    {/* Solar Radiation */}
                    <div className={`h-7 flex items-center justify-center text-xs ${getSolarRadiationTextColor(hour.solar_radiation ?? 0)}`}>
                      {(hour.solar_radiation ?? 0).toFixed(0)}
                    </div>

                    {/* Dew Point */}
                    <div className={`flex items-center justify-center text-xs ${getDewPointTextColor(hour.dew_point ?? 0)} ${multiModelEnabled ? 'h-10' : 'h-7'}`}>
                      {formatWithRange(hour.dew_point ?? 0, ranges?.dew_point, index, '°')}
                    </div>

                    {/* Humidity */}
                    <div className={`flex items-center justify-center text-xs text-gray-600 ${multiModelEnabled ? 'h-10' : 'h-7'}`}>
                      {formatWithRange(hour.humidity ?? 0, ranges?.humidity, index, '%')}
                    </div>

                    {/* Wind Speed */}
                    <div className={`flex items-center justify-center text-xs ${getWindSpeedTextColor((hour.wind_speed_ms ?? 0) * 3.6)} ${multiModelEnabled ? 'h-10' : 'h-7'}`}>
                      {formatWithRange((hour.wind_speed_ms ?? 0) * 3.6, ranges?.wind_speed, index, '')}
                    </div>

                    {/* Rain Chance */}
                    <div className="h-7 flex items-center justify-center text-xs text-blue-600">
                      {(hour.rain_chance ?? 0).toFixed(0)}
                    </div>

                    {/* UV Index */}
                    <div className={`h-7 flex items-center justify-center text-xs ${getUvIndexTextColor(hour.uv_index ?? 0)}`}>
                      {hour.uv_index !== undefined && hour.uv_index !== null ? Math.round(hour.uv_index) : '-'}
                    </div>

                    {/* Air Quality Index */}
                    <div className={`h-7 flex items-center justify-center text-xs ${getAqiTextColor(hour.air_quality)}`}>
                      {hour.air_quality !== undefined && hour.air_quality !== null ? Math.round(hour.air_quality) : '-'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
