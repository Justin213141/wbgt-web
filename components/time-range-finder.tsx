"use client"

import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import type { WeatherForecast } from "@/lib/types"
import { CheckCircle, XCircle } from "lucide-react"
import { parseApiDate } from "@/lib/utils"
import { getWBGTZone, getWBGTZoneColor } from "@/lib/weather-utils"

interface TimeRangeFinderProps {
  data: WeatherForecast[]
}

interface TimeRange {
  startHour: number
  endHour: number
  startTime: string
  endTime: string
  wbgtMin: number
  wbgtMax: number
  tempMin: number
  tempMax: number
  srMin: number
  srMax: number
  rainMin: number
  rainMax: number
  windMin: number
  windMax: number
  score: number
}

export function TimeRangeFinder({ data }: TimeRangeFinderProps) {
  // Filter out nighttime hours (10PM-6AM) and score remaining hours
  const scoredHours = data.map((hour, index) => {
    const date = parseApiDate(hour.localTimestamp)
    const hourNum = date.getHours()

    // Exclude nighttime hours
    if (hourNum >= 22 || hourNum < 6) {
      return { ...hour, score: -1, index, hourNum, excluded: true }
    }

    let score = 100

    // Primary scoring based on WBGT performance zones
    if (hour.wbgt < 20) score += 30
    else if (hour.wbgt < 23) score += 15
    else if (hour.wbgt < 26) score -= 10
    else if (hour.wbgt < 29) score -= 25
    else score -= 40

    // Temperature bonus
    if (hour.temperature < 15) score += 5
    else if (hour.temperature > 25) score -= 5

    // UV penalty
    if (hour.uv_index > 8) score -= 10
    else if (hour.uv_index > 6) score -= 5
    else if (hour.uv_index > 3) score -= 2

    // Rain penalty
    if (hour.rain_chance > 50) score -= 15
    else if (hour.rain_chance > 30) score -= 5

    return { ...hour, score: Math.max(0, score), index, hourNum, excluded: false }
  })

  // Group consecutive hours into 2-hour ranges
  const createRanges = (hours: typeof scoredHours, isBest: boolean): TimeRange[] => {
    const validHours = hours.filter(h => !h.excluded)
    if (validHours.length === 0) return []

    // Sort by score
    const sorted = [...validHours].sort((a, b) =>
      isBest ? b.score - a.score : a.score - b.score
    )

    const ranges: TimeRange[] = []
    const usedIndices = new Set<number>()

    // Take top/bottom hours and group into 2-hour ranges
    for (const hour of sorted) {
      if (usedIndices.has(hour.index)) continue
      if (ranges.length >= 2) break

      // Find adjacent hours to form 2-hour range
      const adjacentHours = [hour]

      // Look for next hour
      const nextHour = validHours.find(h =>
        h.index === hour.index + 1 && !usedIndices.has(h.index)
      )
      if (nextHour) {
        adjacentHours.push(nextHour)
      }

      if (adjacentHours.length < 2) {
        // Try looking for previous hour
        const prevHour = validHours.find(h =>
          h.index === hour.index - 1 && !usedIndices.has(h.index)
        )
        if (prevHour) {
          adjacentHours.unshift(prevHour)
        }
      }

      if (adjacentHours.length >= 1) {
        // Mark indices as used
        adjacentHours.forEach(h => usedIndices.add(h.index))

        // Sort by time
        adjacentHours.sort((a, b) => a.index - b.index)

        const startDate = parseApiDate(adjacentHours[0].localTimestamp)
        const endDate = parseApiDate(adjacentHours[adjacentHours.length - 1].localTimestamp)
        endDate.setHours(endDate.getHours() + 1) // End is exclusive

        ranges.push({
          startHour: startDate.getHours(),
          endHour: endDate.getHours(),
          startTime: formatTimeRange(startDate.getHours()),
          endTime: formatTimeRange(endDate.getHours()),
          wbgtMin: Math.min(...adjacentHours.map(h => h.wbgt)),
          wbgtMax: Math.max(...adjacentHours.map(h => h.wbgt)),
          tempMin: Math.min(...adjacentHours.map(h => h.temperature)),
          tempMax: Math.max(...adjacentHours.map(h => h.temperature)),
          srMin: Math.min(...adjacentHours.map(h => h.solar_radiation)),
          srMax: Math.max(...adjacentHours.map(h => h.solar_radiation)),
          rainMin: Math.min(...adjacentHours.map(h => h.rain_chance)),
          rainMax: Math.max(...adjacentHours.map(h => h.rain_chance)),
          windMin: Math.min(...adjacentHours.map(h => h.wind_speed_ms * 3.6)),
          windMax: Math.max(...adjacentHours.map(h => h.wind_speed_ms * 3.6)),
          score: adjacentHours.reduce((sum, h) => sum + h.score, 0) / adjacentHours.length,
        })
      }
    }

    return ranges
  }

  const formatTimeRange = (hour: number) => {
    const h = hour % 12 || 12
    const ampm = hour < 12 ? 'AM' : 'PM'
    return `${h}${ampm}`
  }

  const bestRanges = createRanges(scoredHours, true)
  const worstRanges = createRanges(scoredHours, false)

  const RangeCard = ({ range, isBest }: { range: TimeRange; isBest: boolean }) => {
    const zone = getWBGTZone(range.wbgtMax)
    const colors = isBest
      ? { bg: "bg-green-50", border: "border-green-200", text: "text-green-700" }
      : { bg: "bg-red-50", border: "border-red-200", text: "text-red-700" }

    return (
      <div className={`rounded-lg border ${colors.border} ${colors.bg} p-3`}>
        <div className={`font-semibold ${colors.text} mb-2`}>
          {range.startTime}-{range.endTime}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div className="text-gray-600">
            WBGT <span className="font-medium text-gray-800">{range.wbgtMin.toFixed(0)}-{range.wbgtMax.toFixed(0)}°</span>
          </div>
          <div className="text-gray-600">
            Temp <span className="font-medium text-gray-800">{range.tempMin.toFixed(0)}-{range.tempMax.toFixed(0)}°</span>
          </div>
          <div className="text-gray-600">
            SR <span className="font-medium text-gray-800">{range.srMin.toFixed(0)}-{range.srMax.toFixed(0)}</span>
          </div>
          <div className="text-gray-600">
            Rain <span className="font-medium text-gray-800">{range.rainMin.toFixed(0)}-{range.rainMax.toFixed(0)}%</span>
          </div>
          <div className="col-span-2 text-gray-600">
            Wind <span className="font-medium text-gray-800">{range.windMin.toFixed(0)}-{range.windMax.toFixed(0)} km/h</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Best Times */}
      <Card className="border-green-200">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base text-green-700">
            <CheckCircle className="h-4 w-4" />
            Best Times
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {bestRanges.length > 0 ? (
            bestRanges.map((range, idx) => (
              <RangeCard key={idx} range={range} isBest={true} />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No suitable times found</p>
          )}
        </CardContent>
      </Card>

      {/* Times to Avoid */}
      <Card className="border-red-200">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base text-red-700">
            <XCircle className="h-4 w-4" />
            Times to Avoid
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {worstRanges.length > 0 ? (
            worstRanges.map((range, idx) => (
              <RangeCard key={idx} range={range} isBest={false} />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">All times are suitable</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
