"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea, Area, ComposedChart } from "recharts"
import { Button } from "./ui/button"
import { parseApiDate } from "@/lib/utils"

interface ForecastData {
  localTimestamp: string
  wbgt: number
  temperature: number
  humidity: number
  solar_radiation: number
  wind_speed_ms: number
  rain_chance: number
}

interface ForecastChartProps {
  data: ForecastData[]
}

export function ForecastChart({ data }: ForecastChartProps) {
  const [visibleLines, setVisibleLines] = useState({
    wbgt: true,
    temperature: true,
    humidity: false,
    solar_radiation: false,
    wind_speed_ms: false,
    rain_chance: false,
  })

  const toggleLine = (key: keyof typeof visibleLines) => {
    setVisibleLines((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const chartData = data.map((item) => ({
    time: parseApiDate(item.localTimestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    wbgt: item.wbgt,
    temperature: item.temperature,
    humidity: item.humidity,
    solar_radiation: item.solar_radiation,
    wind_speed_ms: item.wind_speed_ms,
    rain_chance: item.rain_chance,
  }))

  const temperatureMetrics = [
    { key: "wbgt", label: "WBGT", color: "#ef4444", unit: "°C", yAxisId: "temp" },
    { key: "temperature", label: "Temperature", color: "#f97316", unit: "°C", yAxisId: "temp" },
  ]

  const percentageMetrics = [
    { key: "humidity", label: "Humidity", color: "#3b82f6", unit: "%", yAxisId: "percent" }, // Blue
    { key: "rain_chance", label: "Rain Chance", color: "#8b5cf6", unit: "%", yAxisId: "percent" }, // Purple
  ]

  const solarMetrics = [
    { key: "solar_radiation", label: "Solar Rad", color: "#eab308", unit: "W/m²", yAxisId: "solar" },
  ]

  const windMetrics = [
    { key: "wind_speed_ms", label: "Wind Speed", color: "#6b7280", unit: "m/s", yAxisId: "wind" }, // Grey
  ]

  const allMetrics = [...temperatureMetrics, ...percentageMetrics, ...solarMetrics, ...windMetrics]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">6-Hour Forecast</CardTitle>
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
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
            
            {/* WBGT Performance Zones */}
            {/* ReferenceArea for low performance impact (20-23) - Yellow */}
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
              formatter={(value: number, name: string) => {
                const metric = allMetrics.find((m) => m.key === name)
                return [`${value.toFixed(1)} ${metric?.unit || ""}`, metric?.label || name]
              }}
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
                  </div>
                )
              }}
            />
            {/* Temperature lines - Left Y-Axis */}
            {visibleLines.wbgt && (
              <Line
                yAxisId="temp"
                type="monotone"
                dataKey="wbgt"
                stroke="#ef4444"
                strokeWidth={3}
                name="WBGT (°C)"
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
                name="Temperature (°C)"
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
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}