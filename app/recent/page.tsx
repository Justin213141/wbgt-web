"use client"

import { PageContainer } from "@/components/page-container"
import { RecentDataTable } from "@/components/recent-data-table"
import { TrendAnalysis } from "@/components/trend-analysis"
import useSWR from "swr"
import { fetchObservations } from "@/lib/api"
import type { WeatherObservation } from "@/lib/types"
import { Loader2 } from "lucide-react"

export default function RecentPage() {
  const { data: observations, error } = useSWR<WeatherObservation[]>("recent-observations", fetchObservations, {
    refreshInterval: 60000,
  })

  console.log("[v0] Recent observations data:", observations)

  const isLoading = !observations
  const hasError = error

  let normalizedObservations: WeatherObservation[] = []
  if (observations) {
    if (Array.isArray(observations)) {
      normalizedObservations = observations
    } else if (typeof observations === "object" && "observations" in observations) {
      normalizedObservations = Array.isArray((observations as any).observations)
        ? (observations as any).observations
        : []
    } else {
      // Single observation object - wrap in array
      normalizedObservations = [observations as WeatherObservation]
    }
  }

  // Sort observations by timestamp (most recent first) and get last 6 hours
  const sortedObservations = normalizedObservations.sort((a, b) => {
    const dateA = new Date(a.timestamp || a.localTimestamp || 0)
    const dateB = new Date(b.timestamp || b.localTimestamp || 0)
    return dateB.getTime() - dateA.getTime() // Most recent first
  })
  const recentData = sortedObservations.slice(0, 6)

  return (
    <PageContainer title="Recent" description="Past 6 hours of observations with data tables and trend analysis">
      {hasError && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
          Failed to load recent weather data. Please try again later.
        </div>
      )}

      {isLoading && !hasError && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && !hasError && recentData.length > 0 && (
        <div className="space-y-6">
          {/* Trend Analysis */}
          <TrendAnalysis data={recentData} />

          {/* Data Table */}
          <RecentDataTable data={recentData} />
        </div>
      )}

      {!isLoading && !hasError && recentData.length === 0 && (
        <div className="rounded-lg border border-border bg-muted p-8 text-center">
          <p className="text-muted-foreground">No recent data available</p>
        </div>
      )}
    </PageContainer>
  )
}
