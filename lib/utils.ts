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

/**
 * Extract the local hour from a timestamp string, accounting for timezone
 * This is needed because JavaScript's getHours() returns the browser's local hour,
 * not the hour embedded in the timestamp.
 *
 * Supports formats:
 * - "2026-01-14T16:30:00+11:00" (with offset) → extracts 16
 * - "2026-01-14T05:00:00Z" (UTC) → converts to Sydney time
 * - "2026-01-14T16:30:00" (no timezone) → extracts 16
 *
 * @param timestamp - ISO timestamp string
 * @returns Hour in Sydney local time (0-23)
 */
export function getSydneyHour(timestamp: string): number {
  if (!timestamp) return new Date().getHours()

  // Try to extract hour from timestamp string (format: ...THH:MM...)
  const hourMatch = timestamp.match(/T(\d{2}):/)
  if (!hourMatch) {
    return new Date(timestamp).getHours()
  }

  const hour = parseInt(hourMatch[1], 10)

  // Check if timestamp has timezone offset
  const offsetMatch = timestamp.match(/([+-])(\d{2}):(\d{2})$/)
  if (offsetMatch) {
    // Timestamp has explicit offset (e.g., +11:00) - hour is already local
    return hour
  }

  // Check if timestamp is UTC (ends with Z)
  if (timestamp.endsWith('Z')) {
    // Convert UTC hour to Sydney time
    // Determine DST: Oct-Mar = AEDT (+11), Apr-Sep = AEST (+10)
    const dateMatch = timestamp.match(/(\d{4})-(\d{2})-(\d{2})/)
    if (dateMatch) {
      const month = parseInt(dateMatch[2], 10)
      const isDST = month >= 10 || month <= 3 // Oct-Mar
      const offset = isDST ? 11 : 10
      return (hour + offset) % 24
    }
    // Fallback: assume AEDT (+11)
    return (hour + 11) % 24
  }

  // No timezone info - assume hour is already local
  return hour
}
