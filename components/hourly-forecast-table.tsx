"use client"

import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import type { WeatherForecast } from "@/lib/types"
import { getWBGTZone } from "@/lib/weather-utils"
import { parseApiDate } from "@/lib/utils"

interface HourlyForecastTableProps {
  data: WeatherForecast[]
  title?: string
  intervalHours?: number
}

export function HourlyForecastTable({
  data,
  title = "Detailed Forecast",
  intervalHours = 1
}: HourlyForecastTableProps) {
  // Filter data to show only every N hours if interval > 1
  const filteredData = intervalHours > 1
    ? data.filter((_, index) => index % intervalHours === 0)
    : data

  const formatTime = (timestamp: string) => {
    const date = parseApiDate(timestamp)
    return date.toLocaleTimeString("en-AU", { hour: "numeric", hour12: true })
  }

  const formatDate = (timestamp: string) => {
    const date = parseApiDate(timestamp)
    return date.toLocaleDateString("en-AU", { weekday: "short", day: "numeric" })
  }

  // Track date changes to show date headers
  let lastDate = ""

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
                const showDate = currentDate !== lastDate
                lastDate = currentDate

                return (
                  <tr key={index} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="p-2">
                      <div className="font-medium text-xs">
                        {showDate && <span className="text-muted-foreground mr-1">{currentDate}</span>}
                        {formatTime(hour.localTimestamp)}
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: zoneColor }} />
                        <span className="font-medium text-xs">{(hour.wbgt ?? 0).toFixed(0)}°</span>
                      </div>
                    </td>
                    <td className="p-2 text-xs">{(hour.temperature ?? 0).toFixed(0)}°</td>
                    <td className="p-2 text-xs">{(hour.humidity ?? 0).toFixed(0)}%</td>
                    <td className="p-2 text-xs">{hour.dew_point?.toFixed(0) ?? '-'}°</td>
                    <td className="p-2 text-xs">{((hour.wind_speed_ms ?? 0) * 3.6).toFixed(0)}</td>
                    <td className="p-2 text-xs">{hour.solar_radiation?.toFixed(0) ?? '-'}</td>
                    <td className="p-2 text-xs">{hour.uv_index?.toFixed(0) ?? '-'}</td>
                    <td className="p-2 text-xs">{(hour.rain_chance ?? 0).toFixed(0)}%</td>
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
