import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { findLocationByName } from './locations'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Default location (Sydney, Australia) used when no preference is set
 */
export const DEFAULT_LOCATION = {
  lat: -33.87,
  lon: 151.21,
  name: 'Sydney'
}

/**
 * Location coordinates interface
 */
export interface LocationCoordinates {
  lat: number
  lon: number
}

/**
 * Parse location string from localStorage into coordinates
 * Supports formats:
 * - "lat, lon" (e.g., "-33.87, 151.21")
 * - NSW suburb/city names (e.g., "katoomba", "ulladulla", "parramatta")
 *
 * @param locationString - The location string from localStorage
 * @returns Parsed coordinates or default location
 */
export function parseLocationString(locationString: string | null): LocationCoordinates {
  if (!locationString || locationString.trim() === '') {
    return DEFAULT_LOCATION
  }

  // Try to parse as "lat, lon" format
  const parts = locationString.split(',').map(s => s.trim())
  if (parts.length === 2) {
    const lat = parseFloat(parts[0])
    const lon = parseFloat(parts[1])

    // Validate coordinates
    if (!isNaN(lat) && !isNaN(lon) &&
        lat >= -90 && lat <= 90 &&
        lon >= -180 && lon <= 180) {
      return { lat, lon }
    }
  }

  // Try to resolve as a suburb/city name
  const location = findLocationByName(locationString)
  if (location) {
    return { lat: location.lat, lon: location.lon }
  }

  // If it's an unrecognized name, return default
  return DEFAULT_LOCATION
}

/**
 * Get location coordinates from localStorage preference
 * Falls back to default location if not set or invalid
 *
 * @returns Location coordinates
 */
export function getLocationPreference(): LocationCoordinates {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCATION
  }

  try {
    const savedLocation = localStorage.getItem('weatherLocation')
    return parseLocationString(savedLocation)
  } catch (error) {
    console.warn('Failed to read location preference:', error)
    return DEFAULT_LOCATION
  }
}

/**
 * Parse date from API format "DD/MM/YYYY, HH:mm:ss" to JavaScript Date object
 */
export function parseApiDate(dateString: string): Date {
  if (!dateString) return new Date()

  // Handle DD/MM/YYYY, HH:mm:ss format
  const parts = dateString.split(', ')
  if (parts.length === 2) {
    const [datePart, timePart] = parts
    const [day, month, year] = datePart.split('/').map(Number)
    const [hours, minutes, seconds] = timePart.split(':').map(Number)

    // Create Date object (month is 0-indexed in JavaScript)
    return new Date(year, month - 1, day, hours, minutes, seconds)
  }

  // Fallback to standard Date parsing
  return new Date(dateString)
}
