"use client"

import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import type { WeatherForecast } from "@/lib/types"
import { getWBGTZone } from "@/lib/weather-utils"

interface HourlyForecastTableProps {
  data: WeatherForecast[]
}

export function HourlyForecastTable({ data }: HourlyForecastTableProps) {
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  }

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">24-Hour Detailed Forecast</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 font-semibold">Time</th>
                <th className="text-left p-3 font-semibold">WBGT</th>
                <th className="text-left p-3 font-semibold">Temp</th>
                <th className="text-left p-3 font-semibold">Feels Like</th>
                <th className="text-left p-3 font-semibold">Humidity</th>
                <th className="text-left p-3 font-semibold">Wind</th>
                <th className="text-left p-3 font-semibold">Solar</th>
                <th className="text-left p-3 font-semibold">UV</th>
                <th className="text-left p-3 font-semibold">Rain</th>
                <th className="text-left p-3 font-semibold">Conditions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((hour, index) => {
                const zone = getWBGTZone(hour.wbgt)
                const zoneColor =
                  zone.level === 0 ? "#22c55e" : zone.level === 1 ? "#eab308" : zone.level === 2 ? "#f97316" : "#ef4444"

                return (
                  <tr key={index} className="border-b border-border hover:bg-muted/50">
                    <td className="p-3">
                      <div className="font-semibold">{formatTime(hour.localTimestamp)}</div>
                      {index === 0 && (
                        <div className="text-xs text-muted-foreground">{formatDate(hour.localTimestamp)}</div>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: zoneColor }} />
                        <span className="font-semibold">{hour.wbgt.toFixed(1)}°C</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{zone.label}</div>
                    </td>
                    <td className="p-3">
                      <div>{hour.temperature.toFixed(1)}°C</div>
                    </td>
                    <td className="p-3">
                      <div>{hour.apparent_temp.toFixed(1)}°C</div>
                    </td>
                    <td className="p-3">{hour.humidity}%</td>
                    <td className="p-3">
                      <div>{hour.wind_speed_ms.toFixed(1)} m/s</div>
                    </td>
                    <td className="p-3">
                      <div>{hour.solar_radiation?.toFixed(0) || 'N/A'} W/m²</div>
                    </td>
                    <td className="p-3">{hour.uv_index.toFixed(1)}</td>
                    <td className="p-3">{hour.rain_chance}%</td>
                    <td className="p-3">
                      <div className="text-xs">
                        {hour.cloud_cover > 75
                          ? "Overcast"
                          : hour.cloud_cover > 50
                            ? "Cloudy"
                            : hour.cloud_cover > 25
                              ? "Partly Cloudy"
                              : "Clear"}
                      </div>
                    </td>
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