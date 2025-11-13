"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table"
import type { WeatherObservation } from "@/lib/types"
import { ArrowUp, ArrowDown, Minus } from "lucide-react"
import { getWBGTZone } from "@/lib/weather-utils"
import { parseApiDate } from "@/lib/utils"

interface RecentDataTableProps {
  data: WeatherObservation[]
}

export function RecentDataTable({ data }: RecentDataTableProps) {
  const [sortColumn, setSortColumn] = useState<keyof WeatherObservation | null>(null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")

  const handleSort = (column: keyof WeatherObservation) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortColumn(column)
      setSortDirection("desc")
    }
  }

  const sortedData = [...data].sort((a, b) => {
    if (!sortColumn) return 0
    const aVal = a[sortColumn]
    const bVal = b[sortColumn]
    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortDirection === "asc" ? aVal - bVal : bVal - aVal
    }
    return 0
  })

  const getTrend = (index: number, key: keyof WeatherObservation) => {
    if (index === 0) return null
    const current = data[index][key] as number
    const previous = data[index - 1][key] as number
    if (current > previous) return "up"
    if (current < previous) return "down"
    return "same"
  }

  const formatTime = (timestamp: string) => {
    if (!timestamp) return 'Invalid Date'

    try {
      const date = parseApiDate(timestamp)

      if (isNaN(date.getTime())) {
        console.error('Invalid date created from timestamp:', timestamp)
        return 'Invalid Date'
      }

      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      })
    } catch (error) {
      console.error('Date formatting error:', error, 'Timestamp:', timestamp)
      return 'Invalid Date'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Detailed Observations</CardTitle>
        <p className="text-sm text-muted-foreground">Click column headers to sort</p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => handleSort("localTimestamp")}>
                  Time
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort("wbgt")}>
                  WBGT
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort("temperature")}>
                  Temp
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort("apparent_temp")}>
                  Feels Like
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort("humidity")}>
                  Humidity
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort("solar_radiation")}>
                  Solar Rad
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort("uv_index")}>
                  UV
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.map((row, index) => {
                const wbgtZone = getWBGTZone(row.wbgt)
                const originalIndex = data.indexOf(row)

                return (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{formatTime(row.timestamp || row.localTimestamp)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-3 w-3 rounded-full"
                          style={{
                            backgroundColor:
                              getWBGTZone(row.wbgt).level === 0
                                ? "#22c55e" // Optimal - green
                                : getWBGTZone(row.wbgt).level === 1
                                  ? "#eab308" // Minor Impact - yellow
                                  : getWBGTZone(row.wbgt).level === 2
                                    ? "#f97316" // Significant Impact - orange
                                    : getWBGTZone(row.wbgt).level === 3
                                      ? "#ef4444" // Major Impact - red
                                      : "#991b1b", // Extreme - dark red
                          }}
                        />
                        <span className="font-semibold">{row.wbgt.toFixed(1)}°C</span>
                        {getTrend(originalIndex, "wbgt") === "up" && <ArrowUp className="h-3 w-3 text-red-500" />}
                        {getTrend(originalIndex, "wbgt") === "down" && <ArrowDown className="h-3 w-3 text-green-500" />}
                        {getTrend(originalIndex, "wbgt") === "same" && <Minus className="h-3 w-3 text-gray-400" />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {row.temperature.toFixed(1)}°C
                        {getTrend(originalIndex, "temperature") === "up" && (
                          <ArrowUp className="h-3 w-3 text-red-500" />
                        )}
                        {getTrend(originalIndex, "temperature") === "down" && (
                          <ArrowDown className="h-3 w-3 text-blue-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {row.apparent_temp.toFixed(1)}°C
                        {getTrend(originalIndex, "apparent_temp") === "up" && (
                          <ArrowUp className="h-3 w-3 text-red-500" />
                        )}
                        {getTrend(originalIndex, "apparent_temp") === "down" && (
                          <ArrowDown className="h-3 w-3 text-blue-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{row.humidity}%</TableCell>
                    <TableCell>{row.solar_radiation.toFixed(0)} W/m²</TableCell>
                    <TableCell>{row.uv_index.toFixed(1)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}