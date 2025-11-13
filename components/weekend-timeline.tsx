"use client"

import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import type { WeatherForecast } from "@/lib/types"
import { getWBGTZone } from "@/lib/weather-utils"
import { parseApiDate } from "@/lib/utils"

interface WeekendTimelineProps {
  day1: WeatherForecast[]
  day2: WeatherForecast[]
}

export function WeekendTimeline({ day1, day2 }: WeekendTimelineProps) {
  const formatTime = (timestamp: string) => {
    const date = parseApiDate(timestamp)
    return date.toLocaleTimeString("en-US", { hour: "numeric" })
  }

  const formatDate = (timestamp: string) => {
    const date = parseApiDate(timestamp)
    return date.toLocaleDateString("en-US", { weekday: "long" })
  }

  const renderDayTimeline = (data: WeatherForecast[], dayLabel: string) => {
    return (
      <div className="space-y-3">
        <h3 className="font-semibold text-lg">{dayLabel}</h3>
        <div className="grid grid-cols-12 gap-1">
          {data.map((hour, index) => {
            const zone = getWBGTZone(hour.wbgt)
            const bgColor =
              zone.level === 0 ? "#22c55e" : zone.level === 1 ? "#eab308" : zone.level === 2 ? "#f97316" : "#ef4444"

            return (
              <div key={index} className="group relative">
                <div
                  className="h-16 rounded cursor-pointer transition-all hover:scale-105"
                  style={{ backgroundColor: bgColor }}
                  title={`${formatTime(hour.localTimestamp)}: ${hour.wbgt.toFixed(1)}°C - ${zone.label}`}
                />
                {index % 3 === 0 && (
                  <div className="text-xs text-center mt-1 text-muted-foreground">
                    {formatTime(hour.localTimestamp)}
                  </div>
                )}

                {/* Tooltip on hover */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                  <div className="bg-gray-900 text-white text-xs rounded-lg p-3 whitespace-nowrap shadow-lg">
                    <div className="font-semibold mb-1">{formatTime(hour.localTimestamp)}</div>
                    <div>
                      WBGT: {hour.wbgt.toFixed(1)}°C ({zone.label})
                    </div>
                    <div>Temp: {hour.temperature.toFixed(1)}°C</div>
                    <div>UV: {hour.uv_index.toFixed(1)}</div>
                    <div>Rain: {hour.rain_chance}%</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">48-Hour Visual Timeline</CardTitle>
        <p className="text-sm text-muted-foreground">
          Hover over each hour for details. Colors indicate WBGT safety levels.
        </p>
        <div className="flex items-center gap-4 mt-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-green-500" />
            <span>Safe</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-yellow-500" />
            <span>Caution</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-orange-500" />
            <span>Warning</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-red-500" />
            <span>Danger</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        {day1.length > 0 && renderDayTimeline(day1, formatDate(day1[0].localTimestamp))}
        {day2.length > 0 && renderDayTimeline(day2, formatDate(day2[0].localTimestamp))}
      </CardContent>
    </Card>
  )
}
