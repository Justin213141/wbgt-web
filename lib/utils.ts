import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
