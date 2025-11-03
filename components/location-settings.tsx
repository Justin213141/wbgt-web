"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { MapPin, Loader2 } from "lucide-react"

export function LocationSettings() {
  const [location, setLocation] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSaved, setIsSaved] = useState(false)

  useEffect(() => {
    // Load saved location from localStorage
    const savedLocation = localStorage.getItem("weatherLocation")
    if (savedLocation) {
      setLocation(savedLocation)
    }
  }, [])

  const handleSave = () => {
    setIsLoading(true)
    // Save to localStorage
    localStorage.setItem("weatherLocation", location)

    setTimeout(() => {
      setIsLoading(false)
      setIsSaved(true)
      setTimeout(() => setIsSaved(false), 2000)
    }, 500)
  }

  const handleUseCurrentLocation = () => {
    setIsLoading(true)
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          const locationString = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
          setLocation(locationString)
          localStorage.setItem("weatherLocation", locationString)
          setIsLoading(false)
          setIsSaved(true)
          setTimeout(() => setIsSaved(false), 2000)
        },
        (error) => {
          console.error("Error getting location:", error)
          setIsLoading(false)
        },
      )
    } else {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Location Preferences
        </CardTitle>
        <CardDescription>Set your location for accurate weather data</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            placeholder="Enter city name or coordinates"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Example: Singapore or 1.3521, 103.8198</p>
        </div>

        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={isLoading || !location}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : isSaved ? (
              "Saved!"
            ) : (
              "Save Location"
            )}
          </Button>

          <Button variant="outline" onClick={handleUseCurrentLocation} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Getting location...
              </>
            ) : (
              <>
                <MapPin className="mr-2 h-4 w-4" />
                Use Current Location
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
