"use client"

import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { parseApiDate } from "@/lib/utils"
import { getWBGTZone, getWBGTZoneColor } from "@/lib/weather-utils"
import { Cloud, Sun, CloudRain, CloudSun, CloudLightning, Moon, CloudMoon } from "lucide-react"
import { useRef } from "react"

interface HourlyData {
  localTimestamp: string
  temperature: number
  wbgt: number
  solar_radiation: number
  dew_point: number
  rain_chance: number
  wind_speed_ms: number
  cloud_cover: number
}

interface HourlyStripProps {
  data: HourlyData[]
  maxHours?: number
}

export function HourlyStrip({ data, maxHours = 12 }: HourlyStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const displayData = data.slice(0, maxHours)

  const getWeatherIcon = (hour: HourlyData, hourNum: number) => {
    const isNight = hourNum >= 19 || hourNum < 6
    const iconClass = "h-6 w-6"

    if (hour.rain_chance > 60) {
      return <CloudRain className={`${iconClass} text-blue-500`} />
    }
    if (hour.rain_chance > 30) {
      return <CloudLightning className={`${iconClass} text-gray-500`} />
    }
    if (hour.cloud_cover > 80) {
      return isNight
        ? <CloudMoon className={`${iconClass} text-gray-400`} />
        : <Cloud className={`${iconClass} text-gray-400`} />
    }
    if (hour.cloud_cover > 40) {
      return isNight
        ? <CloudMoon className={`${iconClass} text-gray-400`} />
        : <CloudSun className={`${iconClass} text-yellow-500`} />
    }
    return isNight
      ? <Moon className={`${iconClass} text-indigo-400`} />
      : <Sun className={`${iconClass} text-yellow-500`} />
  }

  const getTempColor = (temp: number) => {
    if (temp >= 35) return "text-red-600"
    if (temp >= 30) return "text-orange-600"
    if (temp >= 25) return "text-orange-500"
    if (temp >= 20) return "text-yellow-600"
    if (temp >= 15) return "text-green-600"
    return "text-blue-600"
  }

  const getWbgtColor = (wbgt: number) => {
    const zone = getWBGTZone(wbgt)
    const colors = getWBGTZoneColor(zone)
    return colors?.text || "text-gray-700"
  }

  const formatHour = (timestamp: string, index: number) => {
    if (index === 0) return "NOW"
    const date = parseApiDate(timestamp)
    return date.toLocaleTimeString("en-AU", { hour: "numeric", hour12: true }).toUpperCase()
  }

  const rowLabels = [
    { key: "icon", label: "" },
    { key: "temp", label: "°C" },
    { key: "wbgt", label: "WBGT" },
    { key: "sr", label: "SR" },
    { key: "dp", label: "DP" },
    { key: "rain", label: "%" },
    { key: "wind", label: "km/h" },
  ]

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">12-Hour Forecast</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto" ref={scrollRef}>
          <div className="min-w-max">
            {/* Row labels on left, then data columns */}
            <div className="flex">
              {/* Labels column */}
              <div className="flex-shrink-0 w-12 bg-gray-50 border-r border-gray-100">
                <div className="h-8 flex items-center justify-center text-[10px] text-gray-400 font-medium border-b border-gray-100"></div>
                {rowLabels.map((row) => (
                  <div
                    key={row.key}
                    className="h-7 flex items-center justify-center text-[10px] text-gray-400 font-medium"
                  >
                    {row.label}
                  </div>
                ))}
              </div>

              {/* Data columns */}
              {displayData.map((hour, index) => {
                const date = parseApiDate(hour.localTimestamp)
                const hourNum = date.getHours()

                return (
                  <div
                    key={hour.localTimestamp}
                    className="flex-shrink-0 w-14 text-center border-r border-gray-50 last:border-r-0"
                  >
                    {/* Hour label */}
                    <div className="h-8 flex items-center justify-center text-xs font-semibold text-gray-700 bg-gray-50 border-b border-gray-100">
                      {formatHour(hour.localTimestamp, index)}
                    </div>

                    {/* Weather icon */}
                    <div className="h-7 flex items-center justify-center">
                      {getWeatherIcon(hour, hourNum)}
                    </div>

                    {/* Temperature */}
                    <div className={`h-7 flex items-center justify-center text-sm font-semibold ${getTempColor(hour.temperature ?? 0)}`}>
                      {(hour.temperature ?? 0).toFixed(0)}°
                    </div>

                    {/* WBGT */}
                    <div className={`h-7 flex items-center justify-center text-sm font-semibold ${getWbgtColor(hour.wbgt ?? 0)}`}>
                      {(hour.wbgt ?? 0).toFixed(0)}°
                    </div>

                    {/* Solar Radiation */}
                    <div className="h-7 flex items-center justify-center text-xs text-gray-600">
                      {(hour.solar_radiation ?? 0).toFixed(0)}
                    </div>

                    {/* Dew Point */}
                    <div className="h-7 flex items-center justify-center text-xs text-gray-600">
                      {(hour.dew_point ?? 0).toFixed(0)}°
                    </div>

                    {/* Rain Chance */}
                    <div className="h-7 flex items-center justify-center text-xs text-blue-600">
                      {(hour.rain_chance ?? 0).toFixed(0)}
                    </div>

                    {/* Wind Speed */}
                    <div className="h-7 flex items-center justify-center text-xs text-gray-600">
                      {((hour.wind_speed_ms ?? 0) * 3.6).toFixed(0)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
