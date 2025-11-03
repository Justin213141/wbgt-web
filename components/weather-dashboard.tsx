"use client"

import useSWR from "swr"
import { WBGTDisplay } from "./wbgt-display"
import { CurrentConditions } from "./current-conditions"
import { SafetyRecommendations } from "./safety-recommendations"
import { ForecastChart } from "./forecast-chart"
import { EnvironmentalMetrics } from "./environmental-metrics"
import { Card, CardContent } from "./ui/card"
import { AlertCircle, Loader2 } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function WeatherDashboard() {
  const { data: observations, error: obsError } = useSWR(
    "https://wbgt-mcp-server.justin213141.workers.dev/api/observations",
    fetcher,
    { refreshInterval: 60000 }, // Refresh every minute
  )

  const { data: forecast, error: forecastError } = useSWR(
    "https://wbgt-mcp-server.justin213141.workers.dev/api/forecast",
    fetcher,
    { refreshInterval: 300000 }, // Refresh every 5 minutes
  )

  if (obsError || forecastError) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="flex items-center gap-3 p-6">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <p className="text-red-900">Failed to load weather data. Please try again later.</p>
        </CardContent>
      </Card>
    )
  }

  if (!observations || !forecast) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-3 p-12">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <p className="text-gray-600">Loading weather data...</p>
        </CardContent>
      </Card>
    )
  }

  // Get the most recent observation
  const currentData = Array.isArray(observations) ? observations[0] : observations
  const forecastData = Array.isArray(forecast) ? forecast.slice(0, 6) : []

  return (
    <div className="space-y-6">
      {/* Top Section: WBGT Display and Current Conditions */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <WBGTDisplay data={currentData} />
        </div>
        <div className="lg:col-span-2">
          <CurrentConditions data={currentData} />
        </div>
      </div>

      {/* Safety Recommendations */}
      <SafetyRecommendations wbgt={currentData.wbgt} esi={currentData.esi} />

      {/* Forecast Chart */}
      <ForecastChart data={forecastData} />

      {/* Environmental Health Metrics */}
      <EnvironmentalMetrics
        uvIndex={currentData.uv_index}
        airQuality={currentData.air_quality}
        forecastData={forecastData}
      />
    </div>
  )
}
