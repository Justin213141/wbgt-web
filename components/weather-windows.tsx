"use client"

import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import type { WeatherForecast } from "@/lib/types"
import { Clock, CheckCircle2 } from "lucide-react"
import { getWBGTZone } from "@/lib/weather-utils"

interface WeatherWindowsProps {
  data: WeatherForecast[]
}

export function WeatherWindows({ data }: WeatherWindowsProps) {
  // Find continuous windows of good weather
  const findWeatherWindows = () => {
    const windows: Array<{
      start: number
      end: number
      avgWBGT: number
      avgUV: number
      maxRain: number
    }> = []

    let currentWindow: number[] = []

    data.forEach((hour, index) => {
      const zone = getWBGTZone(hour.wbgt)
      const isGood = zone.level <= 1 && hour.rain_chance < 30 && hour.uv_index < 8

      if (isGood) {
        currentWindow.push(index)
      } else {
        if (currentWindow.length >= 2) {
          const windowData = currentWindow.map((i) => data[i])
          windows.push({
            start: currentWindow[0],
            end: currentWindow[currentWindow.length - 1],
            avgWBGT: windowData.reduce((sum, d) => sum + d.wbgt, 0) / windowData.length,
            avgUV: windowData.reduce((sum, d) => sum + d.uv_index, 0) / windowData.length,
            maxRain: Math.max(...windowData.map((d) => d.rain_chance)),
          })
        }
        currentWindow = []
      }
    })

    // Check last window
    if (currentWindow.length >= 2) {
      const windowData = currentWindow.map((i) => data[i])
      windows.push({
        start: currentWindow[0],
        end: currentWindow[currentWindow.length - 1],
        avgWBGT: windowData.reduce((sum, d) => sum + d.wbgt, 0) / windowData.length,
        avgUV: windowData.reduce((sum, d) => sum + d.uv_index, 0) / windowData.length,
        maxRain: Math.max(...windowData.map((d) => d.rain_chance)),
      })
    }

    return windows
  }

  const windows = findWeatherWindows()

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  }

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
  }

  const getDuration = (start: number, end: number) => {
    return end - start + 1
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5" />
          Optimal Weather Windows
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Continuous periods with safe WBGT, low rain chance, and moderate UV
        </p>
      </CardHeader>
      <CardContent>
        {windows.length > 0 ? (
          <div className="space-y-4">
            {windows.map((window, index) => {
              const startData = data[window.start]
              const endData = data[window.end]
              const duration = getDuration(window.start, window.end)
              const zone = getWBGTZone(window.avgWBGT)

              return (
                <div key={index} className="rounded-lg border-2 border-green-200 bg-green-50 p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <div>
                        <div className="font-semibold text-green-900">
                          Window {index + 1}: {duration} hours
                        </div>
                        <div className="text-sm text-green-700">{formatDate(startData.localTimestamp)}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-green-900">
                        {formatTime(startData.localTimestamp)} - {formatTime(endData.localTimestamp)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-green-700">Avg WBGT:</span>{" "}
                      <span className="font-semibold text-green-900">{window.avgWBGT.toFixed(1)}°C</span>
                      <div className="text-xs text-green-600">{zone.label}</div>
                    </div>
                    <div>
                      <span className="text-green-700">Avg UV:</span>{" "}
                      <span className="font-semibold text-green-900">{window.avgUV.toFixed(1)}</span>
                    </div>
                    <div>
                      <span className="text-green-700">Max Rain:</span>{" "}
                      <span className="font-semibold text-green-900">{window.maxRain}%</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-6 text-center">
            <p className="text-orange-800">
              No extended optimal weather windows found. Consider shorter activity periods during safer hours.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
