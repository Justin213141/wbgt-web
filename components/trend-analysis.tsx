"use client"

import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import type { WeatherObservation } from "@/lib/types"
import { TrendingUp, TrendingDown, Minus, Activity } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts"

interface TrendAnalysisProps {
  data: WeatherObservation[]
}

export function TrendAnalysis({ data }: TrendAnalysisProps) {
  const calculateTrend = (values: number[]) => {
    if (values.length < 2) return { direction: "stable", change: 0 }
    const first = values[0]
    const last = values[values.length - 1]
    const change = ((last - first) / first) * 100

    if (Math.abs(change) < 2) return { direction: "stable", change: 0 }
    return { direction: change > 0 ? "up" : "down", change: Math.abs(change) }
  }

  const formatTime = (timestamp: string) => {
    if (!timestamp) return 'Invalid Date'

    try {
      let date: Date

      if (timestamp.includes('/')) {
        // Parse DD/MM/YYYY, HH:mm:ss format
        const parts = timestamp.split(', ')
        if (parts.length !== 2) throw new Error('Invalid timestamp format')

        const [datePart, timePart] = parts
        const [day, month, year] = datePart.trim().split('/')
        const timeComponents = timePart.trim().split(':')

        if (timeComponents.length < 2) throw new Error('Invalid time format')

        const [hours, minutes, seconds = '0'] = timeComponents

        // Create date with explicit numeric values
        const dayNum = parseInt(day, 10)
        const monthNum = parseInt(month, 10)
        const yearNum = parseInt(year, 10)
        const hoursNum = parseInt(hours, 10)
        const minutesNum = parseInt(minutes, 10)
        const secondsNum = parseInt(seconds, 10)

        if (isNaN(dayNum) || isNaN(monthNum) || isNaN(yearNum) ||
            isNaN(hoursNum) || isNaN(minutesNum) || isNaN(secondsNum)) {
          throw new Error('Invalid numeric values in timestamp')
        }

        // Note: JavaScript months are 0-indexed, so subtract 1
        date = new Date(yearNum, monthNum - 1, dayNum, hoursNum, minutesNum, secondsNum)
      } else {
        // Try standard ISO format
        date = new Date(timestamp)
      }

      if (isNaN(date.getTime())) {
        return 'Invalid Date'
      }

      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      })
    } catch (error) {
      return 'Invalid Date'
    }
  }

  const wbgtValues = data.map((d) => d.wbgt)
  const tempValues = data.map((d) => d.temperature)
  const humidityValues = data.map((d) => d.humidity)
  const windValues = data.map((d) => d.wind_speed_ms)

  const wbgtTrend = calculateTrend(wbgtValues)
  const tempTrend = calculateTrend(tempValues)
  const humidityTrend = calculateTrend(humidityValues)
  const windTrend = calculateTrend(windValues)

  // Reverse data for charts so time goes left to right (oldest to newest)
  const chartData = [...data].reverse().map((item) => ({
    time: formatTime(item.timestamp || item.localTimestamp),
    wbgt: item.wbgt,
    temperature: item.temperature,
    humidity: item.humidity,
  }))

  const TrendIcon = ({ direction }: { direction: string }) => {
    if (direction === "up") return <TrendingUp className="h-5 w-5 text-red-500" />
    if (direction === "down") return <TrendingDown className="h-5 w-5 text-green-500" />
    return <Minus className="h-5 w-5 text-gray-400" />
  }

  const trends = [
    {
      label: "WBGT",
      current: wbgtValues[wbgtValues.length - 1],
      unit: "°C",
      trend: wbgtTrend,
      color: "#ef4444",
    },
    {
      label: "Temperature",
      current: tempValues[tempValues.length - 1],
      unit: "°C",
      trend: tempTrend,
      color: "#f97316",
    },
    {
      label: "Humidity",
      current: humidityValues[humidityValues.length - 1],
      unit: "%",
      trend: humidityTrend,
      color: "#3b82f6",
    },
    {
      label: "Wind Speed",
      current: windValues[windValues.length - 1],
      unit: "m/s",
      trend: windTrend,
      color: "#06b6d4",
    },
  ]

  return (
    <div className="space-y-6">
      {/* Trend Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {trends.map((item) => (
          <Card key={item.label}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">{item.label}</span>
                <TrendIcon direction={item.trend.direction} />
              </div>
              <div className="text-3xl font-bold" style={{ color: item.color }}>
                {item.current.toFixed(1)}
                <span className="text-lg ml-1">{item.unit}</span>
              </div>
              {item.trend.change > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {item.trend.direction === "up" ? "+" : "-"}
                  {item.trend.change.toFixed(1)}% over 6 hours
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Trend Charts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5" />
            6-Hour Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {/* WBGT Trend */}
            <div>
              <h4 className="text-sm font-semibold mb-3 text-muted-foreground">WBGT Temperature</h4>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="time" stroke="#9ca3af" style={{ fontSize: "11px" }} />
                  <YAxis stroke="#9ca3af" style={{ fontSize: "11px" }} domain={["dataMin - 1", "dataMax + 1"]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="wbgt"
                    stroke="#ef4444"
                    strokeWidth={3}
                    dot={{ fill: "#ef4444", r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Temperature Trend */}
            <div>
              <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Temperature</h4>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="time" stroke="#9ca3af" style={{ fontSize: "11px" }} />
                  <YAxis stroke="#9ca3af" style={{ fontSize: "11px" }} domain={["dataMin - 1", "dataMax + 1"]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="temperature"
                    stroke="#f97316"
                    strokeWidth={3}
                    dot={{ fill: "#f97316", r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Humidity Trend */}
            <div>
              <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Humidity</h4>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="time" stroke="#9ca3af" style={{ fontSize: "11px" }} />
                  <YAxis stroke="#9ca3af" style={{ fontSize: "11px" }} domain={["dataMin - 5", "dataMax + 5"]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="humidity"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={{ fill: "#3b82f6", r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
