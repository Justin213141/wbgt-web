"use client"

import { PageContainer } from "@/components/page-container"
import { OptimalTimeFinder } from "@/components/optimal-time-finder"
import { HourlyForecastTable } from "@/components/hourly-forecast-table"
import { DayOverview } from "@/components/day-overview"
import useSWR from "swr"
import { fetchForecast } from "@/lib/api"
import type { WeatherForecast } from "@/lib/types"
import { Loader2 } from "lucide-react"

export default function TomorrowPage() {
  const { data: forecast, error } = useSWR<WeatherForecast[]>("tomorrow-forecast", fetchForecast, {
    refreshInterval: 300000,
  })

  const isLoading = !forecast
  const hasError = error

  // Get 24 hours of forecast data
  const tomorrowData = forecast?.slice(0, 24) || []

  return (
    <PageContainer title="Tomorrow" description="24-hour forecast with optimal running time identification">
      {hasError && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
          Failed to load forecast data. Please try again later.
        </div>
      )}

      {isLoading && !hasError && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && !hasError && tomorrowData.length > 0 && (
        <div className="space-y-6">
          {/* Day Overview */}
          <DayOverview data={tomorrowData} />

          {/* Optimal Time Finder */}
          <OptimalTimeFinder data={tomorrowData} />

          {/* Hourly Forecast Table */}
          <HourlyForecastTable data={tomorrowData} />
        </div>
      )}

      {!isLoading && !hasError && tomorrowData.length === 0 && (
        <div className="rounded-lg border border-border bg-muted p-8 text-center">
          <p className="text-muted-foreground">No forecast data available</p>
        </div>
      )}
    </PageContainer>
  )
}
