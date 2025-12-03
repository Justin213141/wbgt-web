"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea, Area, ComposedChart } from "recharts"
import { Button } from "./ui/button"
import { parseApiDate } from "@/lib/utils"
import type { WeatherModelId } from "@/lib/types"

interface ForecastData {
  localTimestamp: string
  wbgt: number
  temperature: number
  humidity: number
  solar_radiation: number
  wind_speed_ms: number
  rain_chance: number
  uv_index?: number
  air_quality?: number
}

interface MetricRange {
  min: number
  max: number
}

interface ForecastChartProps {
  data: ForecastData[]
  models?: WeatherModelId[]
  showUncertainty?: boolean
  wbgtRange?: MetricRange[] | null
  tempRange?: MetricRange[] | null
  multiModelEnabled?: boolean
}

export function ForecastChart({ data, models = [], showUncertainty = false, wbgtRange, tempRange, multiModelEnabled }: ForecastChartProps) {
  const [visibleLines, setVisibleLines] = useState({
    wbgt: true,
    temperature: true,
    humidity: false,
    solar_radiation: false,
    wind_speed_ms: false,
    rain_chance: false,
    uv_index: false,
    air_quality: false,
  })

  const toggleLine = (key: keyof typeof visibleLines) => {
    setVisibleLines((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // Build chart data
  const chartData = data.map((item, index) => {
    const time = parseApiDate(item.localTimestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })

    // Include range data for uncertainty bands when multimodel is enabled
    const wbgtMin = multiModelEnabled && wbgtRange?.[index] ? wbgtRange[index].min : item.wbgt
    const wbgtMax = multiModelEnabled && wbgtRange?.[index] ? wbgtRange[index].max : item.wbgt
    const tempMin = multiModelEnabled && tempRange?.[index] ? tempRange[index].min : item.temperature
    const tempMax = multiModelEnabled && tempRange?.[index] ? tempRange[index].max : item.temperature

    return {
      time,
      wbgt: item.wbgt,
      wbgtRange: multiModelEnabled ? [wbgtMin, wbgtMax] : undefined,
      temperature: item.temperature,
      tempRange: multiModelEnabled ? [tempMin, tempMax] : undefined,
      humidity: item.humidity,
      solar_radiation: item.solar_radiation,
      wind_speed_ms: item.wind_speed_ms,
      rain_chance: item.rain_chance,
      uv_index: item.uv_index ?? 0,
      air_quality: item.air_quality ?? 0,
    }
  })

  const temperatureMetrics = [
    { key: "wbgt", label: "WBGT", color: "#ef4444", unit: "°C", yAxisId: "temp" },
    { key: "temperature", label: "Temperature", color: "#f97316", unit: "°C", yAxisId: "temp" },
  ]

  const percentageMetrics = [
    { key: "humidity", label: "Humidity", color: "#3b82f6", unit: "%", yAxisId: "percent" },
    { key: "rain_chance", label: "Rain Chance", color: "#8b5cf6", unit: "%", yAxisId: "percent" },
  ]

  const solarMetrics = [
    { key: "solar_radiation", label: "Solar Rad", color: "#eab308", unit: "W/m²", yAxisId: "solar" },
  ]

  const windMetrics = [
    { key: "wind_speed_ms", label: "Wind Speed", color: "#6b7280", unit: "m/s", yAxisId: "wind" },
  ]

  const uvMetrics = [
    { key: "uv_index", label: "UV Index", color: "#f59e0b", unit: "", yAxisId: "uv" },
  ]

  const aqiMetrics = [
    { key: "air_quality", label: "AQI", color: "#10b981", unit: "", yAxisId: "aqi" },
  ]

  const allMetrics = [...temperatureMetrics, ...percentageMetrics, ...solarMetrics, ...windMetrics, ...uvMetrics, ...aqiMetrics]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">6-Hour Forecast</CardTitle>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {allMetrics.map((metric) => (
            <Button
              key={metric.key}
              variant={visibleLines[metric.key as keyof typeof visibleLines] ? "default" : "outline"}
              size="sm"
              onClick={() => toggleLine(metric.key as keyof typeof visibleLines)}
              className="text-xs"
              style={
                visibleLines[metric.key as keyof typeof visibleLines]
                  ? { backgroundColor: metric.color, borderColor: metric.color }
                  : {}
              }
            >
              {metric.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 text-center text-sm text-muted-foreground">
          Temp (L) | % (R)
        </div>
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="time" stroke="#6b7280" style={{ fontSize: "12px" }} />

            {/* Left Y-Axis - Temperature (Visible) */}
            <YAxis
              yAxisId="temp"
              stroke="#f97316"
              style={{ fontSize: "12px" }}
              label={{ value: 'Temperature (°C)', angle: -90, position: 'insideLeft' }}
              domain={[15, 35]}
            />

            {/* Right Y-Axis - Percentage (Visible) */}
            <YAxis
              yAxisId="percent"
              orientation="right"
              stroke="#3b82f6"
              style={{ fontSize: "12px" }}
              label={{ value: 'Percentage (%)', angle: 90, position: 'insideRight' }}
              domain={[0, 100]}
            />

            {/* Hidden Y-Axis - Solar Radiation */}
            <YAxis
              yAxisId="solar"
              orientation="right"
              hide={true}
              domain={[0, 1200]}
            />

            {/* Hidden Y-Axis - Wind Speed */}
            <YAxis
              yAxisId="wind"
              orientation="right"
              hide={true}
              domain={[0, 15]}
            />

            {/* Hidden Y-Axis - UV Index */}
            <YAxis
              yAxisId="uv"
              orientation="right"
              hide={true}
              domain={[0, 12]}
            />

            {/* Hidden Y-Axis - AQI */}
            <YAxis
              yAxisId="aqi"
              orientation="right"
              hide={true}
              domain={[0, 200]}
            />

            {/* WBGT Performance Zones */}
            <ReferenceArea yAxisId="temp" y1={20} y2={23} fill="#eab308" fillOpacity={0.1} />
            <ReferenceArea yAxisId="temp" y1={23} y2={26} fill="#f97316" fillOpacity={0.1} />
            <ReferenceArea yAxisId="temp" y1={26} y2={29} fill="#ef4444" fillOpacity={0.1} />
            <ReferenceArea yAxisId="temp" y1={29} y2={35} fill="#991b1b" fillOpacity={0.1} />

            <Tooltip
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                padding: "12px",
              }}
              formatter={(value: number | number[], name: string) => {
                // Skip range entries (they're for the uncertainty bands)
                if (name === 'wbgtRange' || name === 'tempRange') {
                  return null
                }
                // Handle array values (ranges) - show as "min - max"
                if (Array.isArray(value)) {
                  const metric = allMetrics.find((m) => m.key === name.replace('Range', ''))
                  return [`${value[0].toFixed(1)} - ${value[1].toFixed(1)} ${metric?.unit || ""}`, `${metric?.label || name} Range`]
                }
                const metric = allMetrics.find((m) => m.key === name)
                return [`${value.toFixed(1)} ${metric?.unit || ""}`, metric?.label || name]
              }}
              filterNull={true}
            />
            <Legend
              content={() => {
                return (
                  <div className="flex flex-wrap gap-4 justify-center mt-4">
                    {visibleLines.wbgt && (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#ef4444" }} />
                        <span className="text-sm">WBGT (°C)</span>
                      </div>
                    )}
                    {visibleLines.temperature && (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#f97316" }} />
                        <span className="text-sm">Temperature (°C)</span>
                      </div>
                    )}
                    {visibleLines.humidity && (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#3b82f6" }} />
                        <span className="text-sm">Humidity (%)</span>
                      </div>
                    )}
                    {visibleLines.rain_chance && (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#8b5cf6" }} />
                        <span className="text-sm">Rain (%)</span>
                      </div>
                    )}
                    {visibleLines.solar_radiation && (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#eab308" }} />
                        <span className="text-sm">Solar Rad (W/m²)</span>
                      </div>
                    )}
                    {visibleLines.wind_speed_ms && (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#6b7280" }} />
                        <span className="text-sm">Wind (m/s)</span>
                      </div>
                    )}
                    {visibleLines.uv_index && (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#f59e0b" }} />
                        <span className="text-sm">UV Index</span>
                      </div>
                    )}
                    {visibleLines.air_quality && (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#10b981" }} />
                        <span className="text-sm">AQI</span>
                      </div>
                    )}
                  </div>
                )
              }}
            />
            {/* Uncertainty bands - rendered first so they appear behind lines */}
            {multiModelEnabled && visibleLines.wbgt && wbgtRange && (
              <Area
                yAxisId="temp"
                type="monotone"
                dataKey="wbgtRange"
                stroke="none"
                fill="#ef4444"
                fillOpacity={0.15}
                name="wbgtRange"
                isAnimationActive={false}
              />
            )}
            {multiModelEnabled && visibleLines.temperature && tempRange && (
              <Area
                yAxisId="temp"
                type="monotone"
                dataKey="tempRange"
                stroke="none"
                fill="#f97316"
                fillOpacity={0.15}
                name="tempRange"
                isAnimationActive={false}
              />
            )}
            {/* Temperature lines - Left Y-Axis */}
            {visibleLines.wbgt && (
              <Line
                yAxisId="temp"
                type="monotone"
                dataKey="wbgt"
                stroke="#ef4444"
                strokeWidth={3}
                name="wbgt"
                dot={{ fill: "#ef4444", r: 4 }}
              />
            )}
            {visibleLines.temperature && (
              <Line
                yAxisId="temp"
                type="monotone"
                dataKey="temperature"
                stroke="#f97316"
                strokeWidth={2}
                name="temperature"
                dot={{ fill: "#f97316", r: 3 }}
              />
            )}
            {/* Percentage lines - Right Y-Axis */}
            {visibleLines.humidity && (
              <Line
                yAxisId="percent"
                type="monotone"
                dataKey="humidity"
                stroke="#3b82f6"
                strokeWidth={2}
                name="Humidity (%)"
                dot={{ fill: "#3b82f6", r: 3 }}
              />
            )}
            {visibleLines.rain_chance && (
              <>
                <Area
                  yAxisId="percent"
                  type="monotone"
                  dataKey="rain_chance"
                  stroke="#8b5cf6"
                  strokeWidth={0}
                  fill="#8b5cf6"
                  fillOpacity={0.2}
                />
              </>
            )}
            {/* Solar radiation line - Hidden Y-Axis */}
            {visibleLines.solar_radiation && (
              <Line
                yAxisId="solar"
                type="monotone"
                dataKey="solar_radiation"
                stroke="#eab308"
                strokeWidth={2}
                name="Solar Rad (W/m²)"
                dot={{ fill: "#eab308", r: 3 }}
              />
            )}
            {/* Wind speed line - Hidden Y-Axis */}
            {visibleLines.wind_speed_ms && (
              <Line
                yAxisId="wind"
                type="monotone"
                dataKey="wind_speed_ms"
                stroke="#6b7280"
                strokeWidth={2}
                name="Wind (m/s)"
                dot={{ fill: "#6b7280", r: 3 }}
              />
            )}
            {/* UV Index line - Hidden Y-Axis */}
            {visibleLines.uv_index && (
              <Line
                yAxisId="uv"
                type="monotone"
                dataKey="uv_index"
                stroke="#f59e0b"
                strokeWidth={2}
                name="UV Index"
                dot={{ fill: "#f59e0b", r: 3 }}
              />
            )}
            {/* AQI line - Hidden Y-Axis */}
            {visibleLines.air_quality && (
              <Line
                yAxisId="aqi"
                type="monotone"
                dataKey="air_quality"
                stroke="#10b981"
                strokeWidth={2}
                name="AQI"
                dot={{ fill: "#10b981", r: 3 }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
