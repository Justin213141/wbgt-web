import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { BirdIcon as AirIcon } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts"
import { parseApiDate } from "@/lib/utils"

interface EnvironmentalMetricsProps {
  airQuality?: number
  forecastData: Array<{
    localTimestamp: string
    air_quality?: number
  }>
}

export function EnvironmentalMetrics({ airQuality, forecastData }: EnvironmentalMetricsProps) {
  const getAQILevel = (aqi: number) => {
    if (aqi <= 50) return { level: "Good", color: "#22c55e", bg: "#dcfce7" }
    if (aqi <= 100) return { level: "Moderate", color: "#eab308", bg: "#fef9c3" }
    if (aqi <= 150) return { level: "Unhealthy for Sensitive", color: "#f97316", bg: "#fed7aa" }
    if (aqi <= 200) return { level: "Unhealthy", color: "#ef4444", bg: "#fecaca" }
    if (aqi <= 300) return { level: "Very Unhealthy", color: "#991b1b", bg: "#fca5a5" }
    return { level: "Hazardous", color: "#7f1d1d", bg: "#f87171" }
  }

  const aqiLevel = airQuality !== undefined && airQuality !== null ? getAQILevel(airQuality) : null

  const aqiChartData = forecastData
    .filter((item) => item.air_quality !== undefined)
    .map((item) => ({
      time: parseApiDate(item.localTimestamp).toLocaleTimeString("en-US", { hour: "numeric" }),
      aqi: item.air_quality,
    }))

  return (
    <div>
      {/* Air Quality */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AirIcon className="h-5 w-5 text-blue-600" />
            Air Quality Index
          </CardTitle>
        </CardHeader>
        <CardContent>
          {aqiLevel ? (
            <>
              <div className="mb-6">
                <div className="rounded-xl p-6 text-center" style={{ backgroundColor: aqiLevel.bg }}>
                  <div className="text-5xl font-bold mb-2" style={{ color: aqiLevel.color }}>
                    {(airQuality ?? 0).toFixed(0)}
                  </div>
                  <div
                    className="inline-block rounded-full px-4 py-1 text-sm font-bold uppercase"
                    style={{ backgroundColor: aqiLevel.color, color: "white" }}
                  >
                    {aqiLevel.level}
                  </div>
                </div>
              </div>

              {aqiChartData.length > 0 && (
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={aqiChartData}>
                      <XAxis dataKey="time" stroke="#9ca3af" style={{ fontSize: "10px" }} />
                      <YAxis stroke="#9ca3af" style={{ fontSize: "10px" }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "white",
                          border: "1px solid #e5e7eb",
                          borderRadius: "6px",
                          fontSize: "12px",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="aqi"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ fill: "#3b82f6", r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          ) : (
            <div className="flex h-64 items-center justify-center rounded-xl bg-gray-50">
              <p className="text-sm text-gray-500">Air quality data not available</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}