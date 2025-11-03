"use client"

import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import type { WeatherForecast } from "@/lib/types"
import { Clock, CheckCircle, XCircle } from "lucide-react"
import { getWBGTZone } from "@/lib/weather-utils"
import { Badge } from "./ui/badge"

interface OptimalTimeFinderProps {
  data: WeatherForecast[]
}

export function OptimalTimeFinder({ data }: OptimalTimeFinderProps) {
  // Score each hour based on WBGT for running recommendations
  const scoredHours = data.map((hour, index) => {
    let score = 100

    // Primary scoring based on WBGT performance zones
    if (hour.wbgt < 20) score += 30 // Optimal - best bonus
    else if (hour.wbgt < 23) score += 15 // Minor impact - good bonus  
    else if (hour.wbgt < 26) score -= 10 // Significant impact - penalty
    else if (hour.wbgt < 29) score -= 25 // Major impact - big penalty
    else score -= 40 // Extreme - avoid completely

    // Temperature bonus (secondary factor)
    if (hour.temperature < 15) score += 5 // Cool bonus
    else if (hour.temperature > 25) score -= 5 // Hot penalty

    // UV penalty
    if (hour.uv_index > 8) score -= 10
    else if (hour.uv_index > 6) score -= 5
    else if (hour.uv_index > 3) score -= 2

    // Rain penalty
    if (hour.rain_chance > 50) score -= 15
    else if (hour.rain_chance > 30) score -= 5

    return {
      ...hour,
      score: Math.max(0, score),
      index,
    }
  })

  // Sort by score (higher is better)
  const sortedHours = [...scoredHours].sort((a, b) => b.score - a.score)

  // Best times (top 3 - coolest/optimal WBGT)
  const bestTimes = sortedHours.slice(0, 3)

  // Worst times (bottom 3 - hottest/poorest WBGT)  
  const worstTimes = sortedHours.slice(-3).reverse()

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  }

  const getScoreColor = (score: number) => {
    if (score >= 75) return { bg: "bg-green-100", text: "text-green-700", border: "border-green-300" }
    if (score >= 50) return { bg: "bg-yellow-100", text: "text-yellow-700", border: "border-yellow-300" }
    if (score >= 25) return { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-300" }
    return { bg: "bg-red-100", text: "text-red-700", border: "border-red-300" }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Best Times */}
      <Card className="border-2 border-green-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-green-700">
            <CheckCircle className="h-5 w-5" />
            Best Times to Run
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {bestTimes.map((hour, index) => {
              const zone = getWBGTZone(hour.wbgt)
              const colors = getScoreColor(hour.score)

              return (
                <div key={hour.index} className={`rounded-lg border-2 p-4 ${colors.bg} ${colors.border}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Clock className={`h-4 w-4 ${colors.text}`} />
                      <span className={`font-bold ${colors.text}`}>{formatTime(hour.localTimestamp)}</span>
                      {index === 0 && <Badge className="bg-green-600 text-white">Optimal</Badge>}
                    </div>
                    <span className={`text-sm font-semibold ${colors.text}`}>Score: {hour.score}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">WBGT:</span>{" "}
                      <span className="font-semibold">{hour.wbgt.toFixed(1)}°C</span>
                      <span className={`ml-1 text-xs ${colors.text}`}>({zone.label})</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">UV:</span>{" "}
                      <span className="font-semibold">{hour.uv_index.toFixed(1)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Rain:</span>{" "}
                      <span className="font-semibold">{hour.rain_chance}%</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Wind:</span>{" "}
                      <span className="font-semibold">{hour.wind_speed_ms.toFixed(1)} m/s</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Worst Times */}
      <Card className="border-2 border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-red-700">
            <XCircle className="h-5 w-5" />
            Times to Avoid
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {worstTimes.map((hour) => {
              const zone = getWBGTZone(hour.wbgt)
              const colors = getScoreColor(hour.score)

              return (
                <div key={hour.index} className={`rounded-lg border-2 p-4 ${colors.bg} ${colors.border}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Clock className={`h-4 w-4 ${colors.text}`} />
                      <span className={`font-bold ${colors.text}`}>{formatTime(hour.localTimestamp)}</span>
                    </div>
                    <span className={`text-sm font-semibold ${colors.text}`}>Score: {hour.score}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">WBGT:</span>{" "}
                      <span className="font-semibold">{hour.wbgt.toFixed(1)}°C</span>
                      <span className={`ml-1 text-xs ${colors.text}`}>({zone.label})</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">UV:</span>{" "}
                      <span className="font-semibold">{hour.uv_index.toFixed(1)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Rain:</span>{" "}
                      <span className="font-semibold">{hour.rain_chance}%</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Wind:</span>{" "}
                      <span className="font-semibold">{hour.wind_speed_ms.toFixed(1)} m/s</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}