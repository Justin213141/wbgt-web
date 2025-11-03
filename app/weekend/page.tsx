"use client"

import { PageContainer } from "@/components/page-container"
import { WeekendComparison } from "@/components/weekend-comparison"
import { WeatherWindows } from "@/components/weather-windows"
import { WeekendTimeline } from "@/components/weekend-timeline"
import useSWR from "swr"
import { fetchForecast } from "@/lib/api"
import type { WeatherForecast } from "@/lib/types"
import { Loader2 } from "lucide-react"

export default function WeekendPage() {
  const { data: forecast, error } = useSWR<WeatherForecast[]>("weekend-forecast", fetchForecast, {
    refreshInterval: 300000,
  })

  const isLoading = !forecast
  const hasError = error

  // Get 48 hours of forecast data
  const weekendData = forecast?.slice(0, 48) || []

  // Split into two days
  const day1Data = weekendData.slice(0, 24)
  const day2Data = weekendData.slice(24, 48)

  return (
    <PageContainer title="Weekend" description="48-hour planning with detailed weather windows">
      {hasError && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
          Failed to load weekend forecast. Please try again later.
        </div>
      )}

      {isLoading && !hasError && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && !hasError && weekendData.length > 0 && (
        <div className="space-y-6">
          {/* Weekend Comparison */}
          <WeekendComparison day1={day1Data} day2={day2Data} />

          {/* Weather Windows */}
          <WeatherWindows data={weekendData} />

          {/* Weekend Timeline */}
          <WeekendTimeline day1={day1Data} day2={day2Data} />
        </div>
      )}

      {!isLoading && !hasError && weekendData.length === 0 && (
        <div className="rounded-lg border border-border bg-muted p-8 text-center">
          <p className="text-muted-foreground">No weekend forecast available</p>
        </div>
      )}
    </PageContainer>
  )
}
