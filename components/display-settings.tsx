"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card"
import { Label } from "./ui/label"
import { Switch } from "./ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Monitor, Palette } from "lucide-react"

export function DisplaySettings() {
  const [temperatureUnit, setTemperatureUnit] = useState("celsius")
  const [windUnit, setWindUnit] = useState("ms")
  const [timeFormat, setTimeFormat] = useState("12h")
  const [compactView, setCompactView] = useState(false)

  useEffect(() => {
    // Load settings from localStorage
    const savedSettings = localStorage.getItem("displaySettings")
    if (savedSettings) {
      const settings = JSON.parse(savedSettings)
      setTemperatureUnit(settings.temperatureUnit ?? "celsius")
      setWindUnit(settings.windUnit ?? "ms")
      setTimeFormat(settings.timeFormat ?? "12h")
      setCompactView(settings.compactView ?? false)
    }
  }, [])

  const saveSettings = (key: string, value: string | boolean) => {
    const currentSettings = JSON.parse(localStorage.getItem("displaySettings") || "{}")
    const newSettings = { ...currentSettings, [key]: value }
    localStorage.setItem("displaySettings", JSON.stringify(newSettings))
  }

  const handleTemperatureUnitChange = (value: string) => {
    setTemperatureUnit(value)
    saveSettings("temperatureUnit", value)
  }

  const handleWindUnitChange = (value: string) => {
    setWindUnit(value)
    saveSettings("windUnit", value)
  }

  const handleTimeFormatChange = (value: string) => {
    setTimeFormat(value)
    saveSettings("timeFormat", value)
  }

  const handleCompactViewChange = (checked: boolean) => {
    setCompactView(checked)
    saveSettings("compactView", checked)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="h-5 w-5" />
          Display Options
        </CardTitle>
        <CardDescription>Customize how weather data is displayed</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Temperature Unit */}
        <div className="space-y-2">
          <Label htmlFor="temperature-unit">Primary Temperature Unit</Label>
          <Select value={temperatureUnit} onValueChange={handleTemperatureUnitChange}>
            <SelectTrigger id="temperature-unit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="celsius">Celsius (°C)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Wind Unit */}
        <div className="space-y-2">
          <Label htmlFor="wind-unit">Wind Speed Unit</Label>
          <Select value={windUnit} onValueChange={handleWindUnitChange}>
            <SelectTrigger id="wind-unit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ms">Meters per second (m/s)</SelectItem>
              <SelectItem value="kmh">Kilometers per hour (km/h)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Time Format */}
        <div className="space-y-2">
          <Label htmlFor="time-format">Time Format</Label>
          <Select value={timeFormat} onValueChange={handleTimeFormatChange}>
            <SelectTrigger id="time-format">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="12h">12-hour (AM/PM)</SelectItem>
              <SelectItem value="24h">24-hour</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Compact View */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="compact-view">Compact View</Label>
            <p className="text-sm text-muted-foreground">Show more data in less space</p>
          </div>
          <Switch id="compact-view" checked={compactView} onCheckedChange={handleCompactViewChange} />
        </div>

        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm text-blue-900">
          <div className="flex items-start gap-2">
            <Palette className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold mb-1">Note about units</p>
              <p className="text-blue-800">
                WBGT calculations are standardized in Celsius. All weather data from the API is in metric units
                (Celsius, m/s, etc.).
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}