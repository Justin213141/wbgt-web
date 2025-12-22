"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "./ui/select"
import { MapPin, Loader2, Plus, Trash2, Check } from "lucide-react"
import {
  NSW_LOCATIONS,
  getLocationsList,
  findLocationByName,
  getSavedLocations,
  saveLocation,
  removeLocation,
  setActiveLocation,
  generateLocationId,
  type SavedLocation,
  type Location,
} from "@/lib/locations"

export function LocationSettings() {
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([])
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  // For adding new locations
  const [selectedKnownLocation, setSelectedKnownLocation] = useState<string>("")
  const [customCoords, setCustomCoords] = useState("")
  const [customName, setCustomName] = useState("")

  const knownLocations = getLocationsList()

  useEffect(() => {
    // Load saved locations
    const saved = getSavedLocations()
    setSavedLocations(saved)

    // Determine which location is currently active
    const currentLocation = localStorage.getItem("weatherLocation")
    if (currentLocation && saved.length > 0) {
      // Try to match current location to a saved one
      const parts = currentLocation.split(",").map(s => parseFloat(s.trim()))
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        const match = saved.find(loc =>
          Math.abs(loc.lat - parts[0]) < 0.001 &&
          Math.abs(loc.lon - parts[1]) < 0.001
        )
        if (match) {
          setActiveLocationId(match.id)
        }
      }
    }
  }, [])

  const handleAddKnownLocation = () => {
    if (!selectedKnownLocation) return

    const location = NSW_LOCATIONS[selectedKnownLocation]
    if (!location) return

    const newSaved: SavedLocation = {
      id: generateLocationId(location.name, location.lat, location.lon),
      name: location.name,
      lat: location.lat,
      lon: location.lon,
      isCustom: false,
    }

    const updated = saveLocation(newSaved)
    setSavedLocations(updated)
    setSelectedKnownLocation("")

    // Auto-activate if it's the first location
    if (updated.length === 1) {
      handleActivateLocation(newSaved)
    }
  }

  const handleAddCustomLocation = () => {
    if (!customCoords) return

    const parts = customCoords.split(",").map(s => parseFloat(s.trim()))
    if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) {
      return
    }

    const [lat, lon] = parts
    const name = customName || `${lat.toFixed(4)}, ${lon.toFixed(4)}`

    const newSaved: SavedLocation = {
      id: generateLocationId(name, lat, lon),
      name,
      lat,
      lon,
      isCustom: true,
    }

    const updated = saveLocation(newSaved)
    setSavedLocations(updated)
    setCustomCoords("")
    setCustomName("")

    // Auto-activate if it's the first location
    if (updated.length === 1) {
      handleActivateLocation(newSaved)
    }
  }

  const handleUseCurrentLocation = () => {
    setIsLoading(true)
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          const name = `Current Location`

          const newSaved: SavedLocation = {
            id: generateLocationId(name, latitude, longitude),
            name,
            lat: latitude,
            lon: longitude,
            isCustom: true,
          }

          const updated = saveLocation(newSaved)
          setSavedLocations(updated)
          handleActivateLocation(newSaved)
          setIsLoading(false)
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

  const handleActivateLocation = (location: SavedLocation) => {
    setActiveLocation(location)
    setActiveLocationId(location.id)
    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 2000)
  }

  const handleRemoveLocation = (id: string) => {
    const updated = removeLocation(id)
    setSavedLocations(updated)

    // If we removed the active location, clear it
    if (id === activeLocationId) {
      setActiveLocationId(null)
      if (updated.length > 0) {
        // Activate the first remaining location
        handleActivateLocation(updated[0])
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Location Preferences
        </CardTitle>
        <CardDescription>
          Save multiple locations and switch between them
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Saved Locations */}
        {savedLocations.length > 0 && (
          <div className="space-y-2">
            <Label>Saved Locations</Label>
            <div className="space-y-2">
              {savedLocations.map((loc) => (
                <div
                  key={loc.id}
                  className={`flex items-center justify-between p-3 rounded-md border ${
                    activeLocationId === loc.id
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {activeLocationId === loc.id && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                    <div>
                      <div className="font-medium">{loc.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {loc.lat.toFixed(4)}, {loc.lon.toFixed(4)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {activeLocationId !== loc.id && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleActivateLocation(loc)}
                      >
                        Use
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveLocation(loc.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {showSuccess && (
              <p className="text-sm text-green-600">Location activated!</p>
            )}
          </div>
        )}

        {/* Add from Known Locations */}
        <div className="space-y-2">
          <Label>Add from NSW Locations</Label>
          <div className="flex gap-2">
            <Select
              value={selectedKnownLocation}
              onValueChange={setSelectedKnownLocation}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select a location..." />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Sydney Metro</SelectLabel>
                  {knownLocations
                    .filter((loc) =>
                      ["sydney", "parramatta", "bondi", "manly", "chatswood", "penrith",
                       "liverpool", "campbelltown", "hornsby", "sutherland", "cronulla",
                       "blacktown", "bankstown", "strathfield", "burwood", "ryde",
                       "epping", "castle_hill", "dee_why", "mona_vale", "richmond",
                       "windsor", "olympic_park"].includes(loc.key)
                    )
                    .map((loc) => (
                      <SelectItem key={loc.key} value={loc.key}>
                        {loc.name}
                      </SelectItem>
                    ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Regional NSW</SelectLabel>
                  {knownLocations
                    .filter((loc) =>
                      ["wollongong", "newcastle", "gosford", "katoomba", "bathurst",
                       "orange", "dubbo", "tamworth", "armidale", "coffs_harbour",
                       "port_macquarie", "byron_bay", "lismore", "tweed_heads",
                       "albury", "wagga_wagga", "broken_hill", "nowra", "batemans_bay",
                       "ulladulla", "moree", "griffith"].includes(loc.key)
                    )
                    .map((loc) => (
                      <SelectItem key={loc.key} value={loc.key}>
                        {loc.name}
                      </SelectItem>
                    ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>ACT</SelectLabel>
                  {knownLocations
                    .filter((loc) => ["canberra", "queanbeyan"].includes(loc.key))
                    .map((loc) => (
                      <SelectItem key={loc.key} value={loc.key}>
                        {loc.name}
                      </SelectItem>
                    ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button
              onClick={handleAddKnownLocation}
              disabled={!selectedKnownLocation}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Add Custom Coordinates */}
        <div className="space-y-2">
          <Label>Add Custom Coordinates</Label>
          <div className="flex gap-2">
            <Input
              placeholder="lat, lon (e.g., -33.87, 151.21)"
              value={customCoords}
              onChange={(e) => setCustomCoords(e.target.value)}
              className="flex-1"
            />
            <Input
              placeholder="Name (optional)"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="w-32"
            />
            <Button
              onClick={handleAddCustomLocation}
              disabled={!customCoords}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Use Current Location */}
        <Button
          variant="outline"
          onClick={handleUseCurrentLocation}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Getting location...
            </>
          ) : (
            <>
              <MapPin className="mr-2 h-4 w-4" />
              Use Current GPS Location
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
