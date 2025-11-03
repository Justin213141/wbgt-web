"use client"

import { Card, CardContent } from "./ui/card"
import type { WeatherForecast } from "@/lib/types"
import { Thermometer, Droplets, Wind, Sun, AlertTriangle } from "lucide-react"
import { getWBGTZone } from "@/lib/weather-utils"

interface DayOverviewProps {
  data: WeatherForecast[]
}

export function DayOverview({ data }: DayOverviewProps) {
  const wbgtValues = data.map((d) => d.wbgt)
  const tempValues = data.map((d) => d.temperature)
  const humidityValues = data.map((d) => d.humidity)
  const windValues = data.map((d) => d.wind_speed_ms)
  const uvValues = data.map((d) => d.uv_index)

  const maxWBGT = Math.max(...wbgtValues)
  const minWBGT = Math.min(...wbgtValues)
  const maxTemp = Math.max(...tempValues)
  const minTemp = Math.min(...tempValues)
  const avgHumidity = humidityValues.reduce((a, b) => a + b, 0) / humidityValues.length
  const maxWind = Math.max(...windValues)
  const maxUV = Math.max(...uvValues)

  const worstZone = getWBGTZone(maxWBGT)
  const bestZone = getWBGTZone(minWBGT)

  const stats = [
    {
      icon: Thermometer,
      label: "WBGT Range",
      value: `${minWBGT.toFixed(1)}°C - ${maxWBGT.toFixed(1)}°C`,
      subValue: `Peak: ${worstZone.label}`,
      color: worstZone.level >= 2 ? "#ef4444" : worstZone.level === 1 ? "#f97316" : "#22c55e",
    },
    {
      icon: Thermometer,
      label: "Temperature Range",
      value: `${minTemp.toFixed(1)}°C - ${maxTemp.toFixed(1)}°C`,
      subValue: maxTemp > 25 ? "Warm" : maxTemp > 15 ? "Mild" : "Cool",
      color: "#f97316",
    },
    {
      icon: Droplets,
      label: "Avg Humidity",
      value: `${avgHumidity.toFixed(0)}%`,
      subValue: avgHumidity > 70 ? "High" : avgHumidity > 50 ? "Moderate" : "Low",
      color: "#3b82f6",
    },
    {
      icon: Wind,
      label: "Max Wind",
      value: `${maxWind.toFixed(1)} m/s`,
      subValue: `${(maxWind * 3.6).toFixed(1)} km/h`,
      color: "#06b6d4",
    },
    {
      icon: Sun,
      label: "Max UV Index",
      value: maxUV.toFixed(1),
      subValue: maxUV >= 8 ? "Very High" : maxUV >= 6 ? "High" : maxUV >= 3 ? "Moderate" : "Low",
      color: "#eab308",
    },
  ]

  return (
    <div className="space-y-4">
      {/* Alert if conditions are dangerous */}
      {worstZone.level >= 2 && (
        <Card className="border-2 border-orange-500 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-orange-900">Heat Advisory</h3>
                <p className="text-sm text-orange-800 mt-1">
                  WBGT will reach {worstZone.label} levels tomorrow. Plan outdoor activities carefully and take
                  necessary precautions.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <stat.icon className="h-5 w-5" style={{ color: stat.color }} />
                <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
              </div>
              <div className="text-2xl font-bold" style={{ color: stat.color }}>
                {stat.value}
              </div>
              <div className="text-xs text-muted-foreground mt-1">{stat.subValue}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
