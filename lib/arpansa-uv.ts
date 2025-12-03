/**
 * ARPANSA UV Index Fetcher
 *
 * Fetches real-time UV index data from the Australian Radiation Protection
 * and Nuclear Safety Agency (ARPANSA) monitoring network.
 *
 * Data source: https://uvdata.arpansa.gov.au/xml/uvvalues.xml
 *
 * XML structure:
 * <location id="Sydney">
 *   <name>syd</name>
 *   <index>9.8</index>
 *   <time>1:13 PM</time>
 *   <date>3/12/2025</date>
 *   <utcdatetime>2025/12/03 03:13</utcdatetime>
 *   <status>ok</status>
 * </location>
 */

export interface ARPANSAResult {
  currentUV: number | null
  locationName: string
  measurementTime: string
  status: string
  fetchedAt: string
  source: 'arpansa'
}

// ARPANSA UV XML API - provides current UV for all Australian cities
const ARPANSA_XML_URL = 'https://uvdata.arpansa.gov.au/xml/uvvalues.xml'

/**
 * Parse XML to extract Sydney UV data
 */
function parseSydneyUV(xml: string): { uv: number | null; time: string; status: string } {
  // Find Sydney location block
  const sydneyMatch = xml.match(/<location[^>]*id="Sydney"[^>]*>([\s\S]*?)<\/location>/i)
  if (!sydneyMatch) {
    console.warn('Sydney location not found in ARPANSA XML')
    return { uv: null, time: '', status: 'not_found' }
  }

  const sydneyBlock = sydneyMatch[1]

  // Extract UV index
  const indexMatch = sydneyBlock.match(/<index>([^<]*)<\/index>/i)
  const uvValue = indexMatch ? parseFloat(indexMatch[1]) : null
  const uv = uvValue !== null && !isNaN(uvValue) ? uvValue : null

  // Extract measurement time
  const timeMatch = sydneyBlock.match(/<time>([^<]*)<\/time>/i)
  const time = timeMatch ? timeMatch[1].trim() : ''

  // Extract status
  const statusMatch = sydneyBlock.match(/<status>([^<]*)<\/status>/i)
  const status = statusMatch ? statusMatch[1].trim() : 'unknown'

  return { uv, time, status }
}

/**
 * Fetch current UV data from ARPANSA XML API
 */
export async function fetchARPANSAUV(): Promise<ARPANSAResult> {
  try {
    const response = await fetch(ARPANSA_XML_URL)

    if (!response.ok) {
      throw new Error(`ARPANSA fetch failed: ${response.status}`)
    }

    const xml = await response.text()
    const { uv, time, status } = parseSydneyUV(xml)

    return {
      currentUV: uv,
      locationName: 'Sydney',
      measurementTime: time,
      status,
      fetchedAt: new Date().toISOString(),
      source: 'arpansa',
    }
  } catch (error) {
    console.error('Failed to fetch ARPANSA UV data:', error)
    throw error
  }
}
