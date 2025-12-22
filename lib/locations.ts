/**
 * NSW/Sydney Locations Database
 * Maps suburb/city names to coordinates for easy location selection
 */

export interface Location {
  key: string
  name: string
  lat: number
  lon: number
}

/**
 * Known NSW locations with coordinates
 * Source: BOM forecast API location data
 */
export const NSW_LOCATIONS: Record<string, Location> = {
  // Sydney Metro
  sydney: { key: "sydney", name: "Sydney CBD", lat: -33.8688, lon: 151.2093 },
  parramatta: { key: "parramatta", name: "Parramatta", lat: -33.8151, lon: 151.0011 },
  bondi: { key: "bondi", name: "Bondi Beach", lat: -33.8915, lon: 151.2767 },
  manly: { key: "manly", name: "Manly", lat: -33.7969, lon: 151.2878 },
  chatswood: { key: "chatswood", name: "Chatswood", lat: -33.7969, lon: 151.1833 },
  penrith: { key: "penrith", name: "Penrith", lat: -33.7506, lon: 150.6944 },
  liverpool: { key: "liverpool", name: "Liverpool", lat: -33.92, lon: 150.9256 },
  campbelltown: { key: "campbelltown", name: "Campbelltown", lat: -34.065, lon: 150.8142 },
  hornsby: { key: "hornsby", name: "Hornsby", lat: -33.7025, lon: 151.0994 },
  sutherland: { key: "sutherland", name: "Sutherland", lat: -34.0314, lon: 151.0567 },
  cronulla: { key: "cronulla", name: "Cronulla", lat: -34.0542, lon: 151.1517 },
  blacktown: { key: "blacktown", name: "Blacktown", lat: -33.7668, lon: 150.9054 },
  bankstown: { key: "bankstown", name: "Bankstown", lat: -33.9175, lon: 151.0356 },
  strathfield: { key: "strathfield", name: "Strathfield", lat: -33.8797, lon: 151.0849 },
  burwood: { key: "burwood", name: "Burwood", lat: -33.8773, lon: 151.1037 },
  ryde: { key: "ryde", name: "Ryde", lat: -33.8149, lon: 151.1025 },
  epping: { key: "epping", name: "Epping", lat: -33.7728, lon: 151.0819 },
  castle_hill: { key: "castle_hill", name: "Castle Hill", lat: -33.7314, lon: 151.0031 },
  dee_why: { key: "dee_why", name: "Dee Why", lat: -33.7544, lon: 151.2878 },
  mona_vale: { key: "mona_vale", name: "Mona Vale", lat: -33.6778, lon: 151.3033 },
  richmond: { key: "richmond", name: "Richmond", lat: -33.5994, lon: 150.7519 },
  windsor: { key: "windsor", name: "Windsor", lat: -33.6108, lon: 150.8147 },
  olympic_park: { key: "olympic_park", name: "Sydney Olympic Park", lat: -33.83, lon: 151.07 },

  // Greater Sydney / Regional
  wollongong: { key: "wollongong", name: "Wollongong", lat: -34.4278, lon: 150.8931 },
  newcastle: { key: "newcastle", name: "Newcastle", lat: -32.9283, lon: 151.7817 },
  gosford: { key: "gosford", name: "Gosford", lat: -33.4256, lon: 151.3419 },
  katoomba: { key: "katoomba", name: "Katoomba", lat: -33.7139, lon: 150.3114 },
  bathurst: { key: "bathurst", name: "Bathurst", lat: -33.4194, lon: 149.5778 },
  orange: { key: "orange", name: "Orange", lat: -33.2836, lon: 149.1011 },
  dubbo: { key: "dubbo", name: "Dubbo", lat: -32.2569, lon: 148.6011 },
  tamworth: { key: "tamworth", name: "Tamworth", lat: -31.0833, lon: 150.9167 },
  armidale: { key: "armidale", name: "Armidale", lat: -30.5083, lon: 151.6711 },
  coffs_harbour: { key: "coffs_harbour", name: "Coffs Harbour", lat: -30.2986, lon: 153.1139 },
  port_macquarie: { key: "port_macquarie", name: "Port Macquarie", lat: -31.4333, lon: 152.9167 },
  byron_bay: { key: "byron_bay", name: "Byron Bay", lat: -28.6436, lon: 153.615 },
  lismore: { key: "lismore", name: "Lismore", lat: -28.8133, lon: 153.275 },
  tweed_heads: { key: "tweed_heads", name: "Tweed Heads", lat: -28.1778, lon: 153.5389 },
  albury: { key: "albury", name: "Albury", lat: -36.0748, lon: 146.913 },
  wagga_wagga: { key: "wagga_wagga", name: "Wagga Wagga", lat: -35.1082, lon: 147.3598 },
  broken_hill: { key: "broken_hill", name: "Broken Hill", lat: -31.9539, lon: 141.4539 },
  nowra: { key: "nowra", name: "Nowra", lat: -34.8808, lon: 150.6006 },
  batemans_bay: { key: "batemans_bay", name: "Batemans Bay", lat: -35.7069, lon: 150.1761 },
  ulladulla: { key: "ulladulla", name: "Ulladulla", lat: -35.36, lon: 150.48 },
  moree: { key: "moree", name: "Moree", lat: -29.4633, lon: 149.845 },
  griffith: { key: "griffith", name: "Griffith", lat: -34.2869, lon: 146.035 },

  // ACT
  canberra: { key: "canberra", name: "Canberra", lat: -35.2809, lon: 149.13 },
  queanbeyan: { key: "queanbeyan", name: "Queanbeyan", lat: -35.3533, lon: 149.2342 },
}

/**
 * Get all locations as a sorted array for display
 */
export function getLocationsList(): Location[] {
  return Object.values(NSW_LOCATIONS).sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Look up a location by name (case-insensitive, flexible matching)
 */
export function findLocationByName(name: string): Location | null {
  const normalized = name.toLowerCase().replace(/[\s-]+/g, '_')

  // Direct key match
  if (NSW_LOCATIONS[normalized]) {
    return NSW_LOCATIONS[normalized]
  }

  // Try partial match on name
  const locations = Object.values(NSW_LOCATIONS)
  const match = locations.find(loc =>
    loc.name.toLowerCase() === name.toLowerCase() ||
    loc.key === normalized
  )

  return match || null
}

/**
 * Saved location with optional custom name
 */
export interface SavedLocation {
  id: string
  name: string
  lat: number
  lon: number
  isCustom: boolean  // true if user entered coordinates manually
}

const SAVED_LOCATIONS_KEY = 'savedLocations'
const ACTIVE_LOCATION_KEY = 'weatherLocation'

/**
 * Get all saved locations from localStorage
 */
export function getSavedLocations(): SavedLocation[] {
  if (typeof window === 'undefined') return []

  try {
    const saved = localStorage.getItem(SAVED_LOCATIONS_KEY)
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

/**
 * Save a location to the saved locations list
 */
export function saveLocation(location: SavedLocation): SavedLocation[] {
  const saved = getSavedLocations()

  // Check if already exists
  const existingIndex = saved.findIndex(loc => loc.id === location.id)
  if (existingIndex >= 0) {
    saved[existingIndex] = location
  } else {
    saved.push(location)
  }

  localStorage.setItem(SAVED_LOCATIONS_KEY, JSON.stringify(saved))
  return saved
}

/**
 * Remove a location from saved locations
 */
export function removeLocation(id: string): SavedLocation[] {
  const saved = getSavedLocations().filter(loc => loc.id !== id)
  localStorage.setItem(SAVED_LOCATIONS_KEY, JSON.stringify(saved))
  return saved
}

/**
 * Set the active location (used for weather display)
 */
export function setActiveLocation(location: SavedLocation): void {
  const locationString = `${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}`
  localStorage.setItem(ACTIVE_LOCATION_KEY, locationString)
  window.dispatchEvent(new Event('locationPreferenceChanged'))
}

/**
 * Generate a unique ID for a location
 */
export function generateLocationId(name: string, lat: number, lon: number): string {
  return `${name.toLowerCase().replace(/\s+/g, '_')}_${lat.toFixed(2)}_${lon.toFixed(2)}`
}
