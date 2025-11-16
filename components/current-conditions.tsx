import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Droplets, Wind, Sun, Cloud, Gauge, ThermometerSun } from "lucide-react"

interface CurrentConditionsProps {
  data: {
    temperature: number
    humidity: number
    wind_speed_ms: number
    solar_radiation: number
    cloud_cover: number
    apparent_temp: number
    dew_point: number
  }
}

export function CurrentConditions({ data }: CurrentConditionsProps) {
  const conditions = [
    {
      icon: ThermometerSun,
      label: "Temperature",
      value: `${data.temperature.toFixed(1)}°C`,
      subValue: `Feels like: ${data.apparent_temp.toFixed(1)}°C`,
      color: "text-orange-600",
    },
    {
      icon: Droplets,
      label: "Humidity",
      value: `${data.humidity}%`,
      subValue: `Dew point: ${data.dew_point.toFixed(1)}°C`,
      color: "text-blue-600",
    },
    {
      icon: Sun,
      label: "Solar Radiation",
      value: `${data.solar_radiation.toFixed(0)} W/m²`,
      subValue: `Cloud cover: ${data.cloud_cover}%`,
      color: "text-yellow-600",
    },
    {
      icon: Wind,
      label: "Wind Speed",
      value: `${data.wind_speed_ms.toFixed(1)} m/s`,
      subValue: `${(data.wind_speed_ms * 3.6).toFixed(1)} km/h`,
      color: "text-cyan-600",
    },
  ]

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-gray-600">Current Conditions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {conditions.map((condition) => (
            <div key={condition.label} className="rounded-lg border bg-gray-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <condition.icon className={`h-5 w-5 ${condition.color}`} />
                <span className="text-xs font-medium text-gray-600">{condition.label}</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{condition.value}</div>
              <div className="text-xs text-gray-500 mt-1">{condition.subValue}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}