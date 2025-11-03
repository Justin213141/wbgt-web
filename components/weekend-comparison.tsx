"use client"

import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import type { WeatherForecast } from "@/lib/types"
import { Calendar, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { getWBGTZone } from "@/lib/weather-utils"

interface WeekendComparisonProps {
  day1: WeatherForecast[]
  day2: WeatherForecast[]
}

export function WeekendComparison({ day1, day2 }: WeekendComparisonProps) {
  const getDayStats = (data: WeatherForecast[]) => {
    const wbgtValues = data.map((d) => d.wbgt)
    const tempValues = data.map((d) => d.temperature)
    const uvValues = data.map((d) => d.uv_index)
    const rainChances = data.map((d) => d.rain_chance)

    return {
      maxWBGT: Math.max(...wbgtValues),
      minWBGT: Math.min(...wbgtValues),
      avgWBGT: wbgtValues.reduce((a, b) => a + b, 0) / wbgtValues.length,
      maxTemp: Math.max(...tempValues),
      minTemp: Math.min(...tempValues),
      maxUV: Math.max(...uvValues),
      maxRain: Math.max(...rainChances),
      avgRain: rainChances.reduce((a, b) => a + b, 0) / rainChances.length,
    }
  }

  const day1Stats = getDayStats(day1)
  const day2Stats = getDayStats(day2)

  const formatDate = (timestamp: string, dayNumber: number) => {
    const date = new Date(timestamp)
    const today = new Date()
    const currentDay = today.getDay()
    
    // Calculate days until Saturday (6) and Sunday (0)
    const daysUntilSaturday = (6 - currentDay + 7) % 7 || 7
    const daysUntilSunday = (0 - currentDay + 7) % 7 || 7
    
    // Get the actual dates for this weekend
    const saturday = new Date(today)
    saturday.setDate(today.getDate() + daysUntilSaturday)
    const sunday = new Date(today)
    sunday.setDate(today.getDate() + daysUntilSunday)
    
    // Format dates to compare with forecast data
    const saturdayStr = saturday.toLocaleDateString("en-US", { weekday: "long" })
    const sundayStr = sunday.toLocaleDateString("en-US", { weekday: "long" })
    
    if (dayNumber === 1) {
      return saturdayStr
    } else {
      return sundayStr
    }
  }

  const day1Zone = getWBGTZone(day1Stats.maxWBGT)
  const day2Zone = getWBGTZone(day2Stats.maxWBGT)

  const getBetterDay = () => {
    if (day1Stats.avgWBGT < day2Stats.avgWBGT) return "day1"
    if (day2Stats.avgWBGT < day1Stats.avgWBGT) return "day2"
    return "equal"
  }

  const betterDay = getBetterDay()

  const ComparisonIcon = ({ val1, val2 }: { val1: number; val2: number }) => {
    if (val1 < val2) return <TrendingDown className="h-4 w-4 text-green-600" />
    if (val1 > val2) return <TrendingUp className="h-4 w-4 text-red-600" />
    return <Minus className="h-4 w-4 text-gray-400" />
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Day 1 */}
      <Card className={betterDay === "day1" ? "border-2 border-green-400" : ""}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {day1.length > 0 && formatDate(day1[0].localTimestamp, 1)}
            </div>
            {betterDay === "day1" && <span className="text-sm font-semibold text-green-600">Optimal WBGT</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* WBGT */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">WBGT Range</span>
              <ComparisonIcon val1={day1Stats.avgWBGT} val2={day2Stats.avgWBGT} />
            </div>
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-4 w-4 rounded-full"
                style={{
                  backgroundColor:
                    day1Zone.level === 0
                      ? "#22c55e" // Optimal - green
                      : day1Zone.level === 1
                        ? "#eab308" // Minor Impact - yellow
                        : day1Zone.level === 2
                          ? "#f97316" // Significant Impact - orange
                          : day1Zone.level === 3
                            ? "#ef4444" // Major Impact - red
                            : "#991b1b", // Extreme - dark red
                }}
              />
              <span className="text-2xl font-bold">
                {day1Stats.minWBGT.toFixed(1)}°C - {day1Stats.maxWBGT.toFixed(1)}°C
              </span>
            </div>
            <div className="text-sm text-muted-foreground mt-1">Peak: {day1Zone.label}</div>
          </div>

          {/* Temperature */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Temperature Range</span>
              <ComparisonIcon val1={day1Stats.maxTemp} val2={day2Stats.maxTemp} />
            </div>
            <div className="text-xl font-semibold">
              {day1Stats.minTemp.toFixed(1)}°C - {day1Stats.maxTemp.toFixed(1)}°C
            </div>
          </div>

          {/* UV & Rain */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">Max UV</span>
                <ComparisonIcon val1={day1Stats.maxUV} val2={day2Stats.maxUV} />
              </div>
              <div className="text-xl font-semibold">{day1Stats.maxUV.toFixed(1)}</div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">Rain Chance</span>
                <ComparisonIcon val1={day1Stats.maxRain} val2={day2Stats.maxRain} />
              </div>
              <div className="text-xl font-semibold">{day1Stats.maxRain}%</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Day 2 */}
      <Card className={betterDay === "day2" ? "border-2 border-green-400" : ""}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {day2.length > 0 && formatDate(day2[0].localTimestamp, 2)}
            </div>
            {betterDay === "day2" && <span className="text-sm font-semibold text-green-600">Optimal WBGT</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* WBGT */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">WBGT Range</span>
              <ComparisonIcon val1={day2Stats.avgWBGT} val2={day1Stats.avgWBGT} />
            </div>
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-4 w-4 rounded-full"
                style={{
                  backgroundColor:
                    day2Zone.level === 0
                      ? "#22c55e" // Optimal - green
                      : day2Zone.level === 1
                        ? "#eab308" // Minor Impact - yellow
                        : day2Zone.level === 2
                          ? "#f97316" // Significant Impact - orange
                          : day2Zone.level === 3
                            ? "#ef4444" // Major Impact - red
                            : "#991b1b", // Extreme - dark red
                }}
              />
              <span className="text-2xl font-bold">
                {day2Stats.minWBGT.toFixed(1)}°C - {day2Stats.maxWBGT.toFixed(1)}°C
              </span>
            </div>
            <div className="text-sm text-muted-foreground mt-1">Peak: {day2Zone.label}</div>
          </div>

          {/* Temperature */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Temperature Range</span>
              <ComparisonIcon val1={day2Stats.maxTemp} val2={day1Stats.maxTemp} />
            </div>
            <div className="text-xl font-semibold">
              {day2Stats.minTemp.toFixed(1)}°C - {day2Stats.maxTemp.toFixed(1)}°C
            </div>
          </div>

          {/* UV & Rain */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">Max UV</span>
                <ComparisonIcon val1={day2Stats.maxUV} val2={day1Stats.maxUV} />
              </div>
              <div className="text-xl font-semibold">{day2Stats.maxUV.toFixed(1)}</div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">Rain Chance</span>
                <ComparisonIcon val1={day2Stats.maxRain} val2={day1Stats.maxRain} />
              </div>
              <div className="text-xl font-semibold">{day2Stats.maxRain}%</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}