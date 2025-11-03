import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Thermometer, AlertTriangle } from "lucide-react"
import { getWBGTZone, getWBGTZoneColor } from "@/lib/weather-utils"

interface WBGTDisplayProps {
  data: {
    wbgt: number
    localTimestamp: string
  }
}

export function WBGTDisplay({ data }: WBGTDisplayProps) {
  const zone = getWBGTZone(data.wbgt)
  const colors = getWBGTZoneColor(zone)

  return (
    <Card className="h-full border-2" style={{ borderColor: colors.border }}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-gray-600">
          <Thermometer className="h-4 w-4" />
          WBGT Temperature
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-xl p-6 text-center transition-colors" style={{ backgroundColor: colors.bg }}>
          <div className="mb-2 flex items-center justify-center gap-2">
            {zone.level >= 2 && <AlertTriangle className="h-6 w-6" style={{ color: colors.text }} />}
          </div>
          <div className="mb-4 text-6xl font-bold" style={{ color: colors.text }}>
            {data.wbgt.toFixed(1)}°C
          </div>
          <div
            className="inline-block rounded-full px-4 py-2 text-sm font-bold uppercase tracking-wide"
            style={{ backgroundColor: colors.text, color: colors.bg }}
          >
            {zone.label}
          </div>
          <p className="mt-4 text-sm font-medium" style={{ color: colors.text }}>
            {zone.description}
          </p>
        </div>
        <div className="mt-4 text-center text-xs text-gray-500">Updated: {data.localTimestamp}</div>
      </CardContent>
    </Card>
  )
}
