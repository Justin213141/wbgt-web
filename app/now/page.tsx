"use client"

import { PageContainer } from "@/components/page-container"
import { WBGTDisplay } from "@/components/wbgt-display"
import { CurrentConditions } from "@/components/current-conditions"
import { SafetyRecommendations } from "@/components/safety-recommendations"
import { ForecastChart } from "@/components/forecast-chart"
import { EnvironmentalMetrics } from "@/components/environmental-metrics"
import useSWR from "swr"
import { fetchCurrent, fetchForecast } from "@/lib/api"
import type { WeatherObservation, WeatherForecast } from "@/lib/types"
import { Loader2 } from "lucide-react"

export default function NowPage() {
  const { data: currentData, error: currentError } = useSWR<any>("current", fetchCurrent, {
    refreshInterval: 60000,
  })

  const { data: forecastData, error: forecastError } = useSWR<any>("forecast", fetchForecast, {
    refreshInterval: 300000,
  })

  console.log("[v0] Raw forecast data:", forecastData)

  let forecast: WeatherForecast[] = []
  if (forecastData) {
    if (Array.isArray(forecastData)) {
      forecast = forecastData
    } else if (forecastData.forecast && Array.isArray(forecastData.forecast)) {
      forecast = forecastData.forecast
    } else if (typeof forecastData === "object") {
      // If it's a single object, wrap it in an array
      forecast = [forecastData]
    }
  }

  console.log("[v0] Normalized forecast array:", forecast)

  const isLoading = !currentData || !forecastData
  const hasError = currentError || forecastError

  return (
    <PageContainer title="Now" description="Current conditions and 6-hour forecast with running recommendations">
      {hasError && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
          Failed to load weather data. Please try again later.
        </div>
      )}

      {isLoading && !hasError && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && !hasError && currentData && forecastData && forecastData.length > 0 && (
        <div className="space-y-6">
          <WBGTDisplay
            data={{
              wbgt: currentData.wbgt,
              localTimestamp: currentData.timestamp,
            }}
          />
          <SafetyRecommendations wbgt={currentData.wbgt} esi={currentData.esi} />
          <CurrentConditions data={currentData} />
          <ForecastChart data={forecastData.slice(0, 6)} />
          <EnvironmentalMetrics
            uvIndex={currentData.uv_index}
            airQuality={currentData.air_quality}
            forecastData={forecastData.slice(0, 6)}
          />
        </div>
      )}

      {!isLoading && !hasError && (!currentData || !forecastData || forecastData.length === 0) && (
        <div className="rounded-lg border border-muted bg-muted/10 p-4 text-muted-foreground">
          No weather data available at this time.
        </div>
      )}
    </PageContainer>
  )
}
