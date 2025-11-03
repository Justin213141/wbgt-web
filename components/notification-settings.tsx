"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card"
import { Label } from "./ui/label"
import { Switch } from "./ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Bell } from "lucide-react"

export function NotificationSettings() {
  const [wbgtAlerts, setWbgtAlerts] = useState(true)
  const [optimalTimeAlerts, setOptimalTimeAlerts] = useState(false)
  const [dailySummary, setDailySummary] = useState(false)
  const [alertThreshold, setAlertThreshold] = useState("warning")

  useEffect(() => {
    // Load settings from localStorage
    const savedSettings = localStorage.getItem("notificationSettings")
    if (savedSettings) {
      const settings = JSON.parse(savedSettings)
      setWbgtAlerts(settings.wbgtAlerts ?? true)
      setOptimalTimeAlerts(settings.optimalTimeAlerts ?? false)
      setDailySummary(settings.dailySummary ?? false)
      setAlertThreshold(settings.alertThreshold ?? "warning")
    }
  }, [])

  const saveSettings = (key: string, value: boolean | string) => {
    const currentSettings = JSON.parse(localStorage.getItem("notificationSettings") || "{}")
    const newSettings = { ...currentSettings, [key]: value }
    localStorage.setItem("notificationSettings", JSON.stringify(newSettings))
  }

  const handleWbgtAlertsChange = (checked: boolean) => {
    setWbgtAlerts(checked)
    saveSettings("wbgtAlerts", checked)
  }

  const handleOptimalTimeAlertsChange = (checked: boolean) => {
    setOptimalTimeAlerts(checked)
    saveSettings("optimalTimeAlerts", checked)
  }

  const handleDailySummaryChange = (checked: boolean) => {
    setDailySummary(checked)
    saveSettings("dailySummary", checked)
  }

  const handleAlertThresholdChange = (value: string) => {
    setAlertThreshold(value)
    saveSettings("alertThreshold", value)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Preferences
        </CardTitle>
        <CardDescription>Configure alerts and notifications for weather conditions</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* WBGT Alerts */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="wbgt-alerts">WBGT Heat Alerts</Label>
            <p className="text-sm text-muted-foreground">Get notified when WBGT reaches unsafe levels</p>
          </div>
          <Switch id="wbgt-alerts" checked={wbgtAlerts} onCheckedChange={handleWbgtAlertsChange} />
        </div>

        {/* Alert Threshold */}
        {wbgtAlerts && (
          <div className="space-y-2 pl-6 border-l-2 border-muted">
            <Label htmlFor="alert-threshold">Alert Threshold</Label>
            <Select value={alertThreshold} onValueChange={handleAlertThresholdChange}>
              <SelectTrigger id="alert-threshold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="caution">Caution (27°C)</SelectItem>
                <SelectItem value="warning">Warning (29°C)</SelectItem>
                <SelectItem value="danger">Danger (32°C)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Optimal Time Alerts */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="optimal-time-alerts">Optimal Running Time Alerts</Label>
            <p className="text-sm text-muted-foreground">Get notified about the best times to run</p>
          </div>
          <Switch
            id="optimal-time-alerts"
            checked={optimalTimeAlerts}
            onCheckedChange={handleOptimalTimeAlertsChange}
          />
        </div>

        {/* Daily Summary */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="daily-summary">Daily Weather Summary</Label>
            <p className="text-sm text-muted-foreground">Receive a daily summary of weather conditions</p>
          </div>
          <Switch id="daily-summary" checked={dailySummary} onCheckedChange={handleDailySummaryChange} />
        </div>

        <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
          Note: Browser notifications require permission. You may need to enable notifications in your browser settings.
        </div>
      </CardContent>
    </Card>
  )
}
