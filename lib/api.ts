const API_BASE = "https://wbgt-mcp-server.justin213141.workers.dev/api"

export async function fetchObservations() {
  const response = await fetch(`${API_BASE}/observations`)
  if (!response.ok) {
    throw new Error("Failed to fetch observations")
  }
  const result = await response.json()
  // Handle API wrapper format: { success: true, data: [...] }
  return result.data || result
}

export async function fetchForecast() {
  const response = await fetch(`${API_BASE}/forecast`)
  if (!response.ok) {
    throw new Error("Failed to fetch forecast")
  }
  const result = await response.json()
  // Handle API wrapper format: { success: true, data: [...] }
  return result.data || result
}

export async function fetchCurrent() {
  const response = await fetch(`${API_BASE}/current`)
  if (!response.ok) {
    throw new Error("Failed to fetch current conditions")
  }
  const result = await response.json()
  // Handle API wrapper format: { success: true, data: {...} }
  return result.data || result
}
