"use client"

import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import type { WeatherForecast } from "@/lib/types"
import {
  getWBGTZone,
  getWbgtTextColor,
  getTemperatureTextColor,
  getSolarRadiationTextColor,
  getDewPointTextColor,
  getUvIndexTextColor,
  getWindSpeedTextColor
} from "@/lib/weather-utils"
import { parseApiDate } from "@/lib/utils"

interface HourlyForecastTableProps {
  data: WeatherForecast[]
  title?: string
  intervalHours?: number
  wbgtRange?: { min: number; max: number }[] | null
  multiModelEnabled?: boolean
}

export function HourlyForecastTable({
  data,
  title = "Detailed Forecast",
  intervalHours = 1,
  wbgtRange,
  multiModelEnabled
}: HourlyForecastTableProps) {
  // Filter data to show only every N hours if interval > 1
  const filteredData = intervalHours > 1
    ? data.filter((_, index) => index % intervalHours === 0)
    : data

  // Filter wbgtRange to match the filtered data
  const filteredRange = wbgtRange && intervalHours > 1
    ? wbgtRange.filter((_, index) => index % intervalHours === 0)
    : wbgtRange

  const formatTime = (timestamp: string) => {
    const date = parseApiDate(timestamp)
    return date.toLocaleTimeString("en-AU", { hour: "numeric", hour12: true })
  }

  const formatDate = (timestamp: string) => {
    const date = parseApiDate(timestamp)
    return date.toLocaleDateString("en-AU", { weekday: "short", day: "numeric" })
  }

  // Format WBGT with range if multimodel is enabled
  const formatWbgtValue = (wbgt: number, index: number) => {
    const mainValue = (wbgt ?? 0).toFixed(0)
    if (multiModelEnabled && filteredRange && filteredRange[index]) {
      const range = filteredRange[index]
      const rangeMin = range.min.toFixed(0)
      const rangeMax = range.max.toFixed(0)
      return (
        <span>
          {mainValue}°
          <span className="text-[10px] ml-0.5 opacity-60">({rangeMin}-{rangeMax})</span>
        </span>
      )
    }
    return <span>{mainValue}°</span>
  }

  // Track date changes to show date headers
  let lastDate = ""
  let lastHour = -1

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-2 font-medium text-xs">Time</th>
                <th className="text-left p-2 font-medium text-xs">WBGT</th>
                <th className="text-left p-2 font-medium text-xs">Temp</th>
                <th className="text-left p-2 font-medium text-xs">Humidity</th>
                <th className="text-left p-2 font-medium text-xs">Dew Pt</th>
                <th className="text-left p-2 font-medium text-xs">Wind</th>
                <th className="text-left p-2 font-medium text-xs">Solar</th>
                <th className="text-left p-2 font-medium text-xs">UV</th>
                <th className="text-left p-2 font-medium text-xs">Rain</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((hour, index) => {
                const zone = getWBGTZone(hour.wbgt ?? 0)
                const zoneColor =
                  zone.level === 0 ? "#22c55e" : zone.level === 1 ? "#eab308" : zone.level === 2 ? "#f97316" : "#ef4444"

                const currentDate = formatDate(hour.localTimestamp)
                const parsedDate = parseApiDate(hour.localTimestamp)
                const currentHour = parsedDate.getHours()

                // Show date when: date changes OR at midnight (hour 0)
                const dateChanged = currentDate !== lastDate
                const isMidnight = currentHour === 0
                const showDate = dateChanged || (isMidnight && index > 0)

                // Add thick border at day boundary (when hour wraps from late to early)
                const isDayBoundary = index > 0 && currentHour < lastHour

                lastDate = currentDate
                lastHour = currentHour

                return (
                  <tr key={index} className={`border-b border-border/50 hover:bg-muted/30 ${isDayBoundary ? 'border-t-2 border-t-gray-300' : ''}`}>
                    <td className="p-2">
                      <div className="font-medium text-xs">
                        {showDate && <span className="text-muted-foreground mr-1">{currentDate}</span>}
                        {formatTime(hour.localTimestamp)}
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: zoneColor }} />
                        <span className={`font-medium text-xs ${getWbgtTextColor(hour.wbgt ?? 0)}`}>{formatWbgtValue(hour.wbgt ?? 0, index)}</span>
                      </div>
                    </td>
                    <td className={`p-2 text-xs ${getTemperatureTextColor(hour.temperature ?? 0)}`}>{(hour.temperature ?? 0).toFixed(0)}°</td>
                    <td className="p-2 text-xs">{(hour.humidity ?? 0).toFixed(0)}%</td>
                    <td className={`p-2 text-xs ${getDewPointTextColor(hour.dew_point ?? 0)}`}>{hour.dew_point?.toFixed(0) ?? '-'}°</td>
                    <td className={`p-2 text-xs ${getWindSpeedTextColor((hour.wind_speed_ms ?? 0) * 3.6)}`}>{((hour.wind_speed_ms ?? 0) * 3.6).toFixed(0)}</td>
                    <td className={`p-2 text-xs ${getSolarRadiationTextColor(hour.solar_radiation ?? 0)}`}>{hour.solar_radiation?.toFixed(0) ?? '-'}</td>
                    <td className={`p-2 text-xs ${getUvIndexTextColor(hour.uv_index ?? 0)}`}>{hour.uv_index?.toFixed(0) ?? '-'}</td>
                    <td className="p-2 text-xs text-blue-600">{(hour.rain_chance ?? 0).toFixed(0)}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
