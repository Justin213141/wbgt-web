import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Sun, BirdIcon as AirIcon } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceArea, ReferenceLine } from "recharts"

interface EnvironmentalMetricsProps {
  uvIndex: number
  airQuality?: number
  forecastData: Array<{
    localTimestamp: string
    uv_index: number
    air_quality?: number
  }>
}

export function EnvironmentalMetrics({ uvIndex, airQuality, forecastData }: EnvironmentalMetricsProps) {
  const getUVLevel = (uv: number) => {
    if (uv < 3) return { level: "Low", color: "#22c55e", bg: "#dcfce7" }
    if (uv < 6) return { level: "Moderate", color: "#eab308", bg: "#fef9c3" }
    if (uv < 8) return { level: "High", color: "#f97316", bg: "#fed7aa" }
    if (uv < 11) return { level: "Very High", color: "#ef4444", bg: "#fecaca" }
    return { level: "Extreme", color: "#991b1b", bg: "#fca5a5" }
  }

  const getAQILevel = (aqi: number) => {
    if (aqi <= 50) return { level: "Good", color: "#22c55e", bg: "#dcfce7" }
    if (aqi <= 100) return { level: "Moderate", color: "#eab308", bg: "#fef9c3" }
    if (aqi <= 150) return { level: "Unhealthy for Sensitive", color: "#f97316", bg: "#fed7aa" }
    if (aqi <= 200) return { level: "Unhealthy", color: "#ef4444", bg: "#fecaca" }
    if (aqi <= 300) return { level: "Very Unhealthy", color: "#991b1b", bg: "#fca5a5" }
    return { level: "Hazardous", color: "#7f1d1d", bg: "#f87171" }
  }

  const uvLevel = getUVLevel(uvIndex)
  const aqiLevel = airQuality ? getAQILevel(airQuality) : null

  const uvChartData = forecastData.map((item) => ({
    time: new Date(item.localTimestamp).toLocaleTimeString("en-US", { hour: "numeric" }),
    uv: item.uv_index,
  }))

  const aqiChartData = forecastData
    .filter((item) => item.air_quality !== undefined)
    .map((item) => ({
      time: new Date(item.localTimestamp).toLocaleTimeString("en-US", { hour: "numeric" }),
      aqi: item.air_quality,
    }))

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* UV Index */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sun className="h-5 w-5 text-yellow-600" />
            UV Index
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <div className="rounded-xl p-6 text-center" style={{ backgroundColor: uvLevel.bg }}>
              <div className="text-5xl font-bold mb-2" style={{ color: uvLevel.color }}>
                {uvIndex.toFixed(1)}
              </div>
              <div
                className="inline-block rounded-full px-4 py-1 text-sm font-bold uppercase"
                style={{ backgroundColor: uvLevel.color, color: "white" }}
              >
                {uvLevel.level}
              </div>
            </div>
          </div>

          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={uvChartData}>
                <XAxis dataKey="time" stroke="#9ca3af" style={{ fontSize: "10px" }} />
                <YAxis stroke="#9ca3af" style={{ fontSize: "10px" }} />
                
                {/* UV Sunscreen Zone (>3) */}
                <ReferenceArea y1={3} y2={15} fill="#eab308" fillOpacity={0.2} />

                {/* UV=3 Reference Line */}
                <ReferenceLine y={3} stroke="#eab308" strokeWidth={2} strokeDasharray="5 5" />

                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "6px",
                    fontSize: "12px",
                  }}
                />
                <Line type="monotone" dataKey="uv" stroke="#eab308" strokeWidth={2} dot={{ fill: "#eab308", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Air Quality */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AirIcon className="h-5 w-5 text-blue-600" />
            Air Quality Index
          </CardTitle>
        </CardHeader>
        <CardContent>
          {airQuality && aqiLevel ? (
            <>
              <div className="mb-6">
                <div className="rounded-xl p-6 text-center" style={{ backgroundColor: aqiLevel.bg }}>
                  <div className="text-5xl font-bold mb-2" style={{ color: aqiLevel.color }}>
                    {airQuality.toFixed(0)}
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