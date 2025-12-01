"use client"

import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from "recharts"
import { ConfidenceBadgeFromLevel } from "./confidence-badge"
import { ModelLegend } from "./model-legend"
import {
  type EnsembleDataPoint,
  formatChartDataWithUncertainty,
  getOverallConfidence,
} from "@/lib/ensemble-utils"
import type { WeatherModelId } from "@/lib/types"

interface UncertaintyChartProps {
  data: EnsembleDataPoint[]
  title?: string
  unit: string
  color?: string
  models?: WeatherModelId[]
  showPerformanceZones?: boolean
  yDomain?: [number, number]
}

interface UncertaintyTooltipProps {
  active?: boolean
  payload?: Array<{ payload: ReturnType<typeof formatChartDataWithUncertainty>[0] }>
  unit: string
}

function UncertaintyTooltip({ active, payload, unit }: UncertaintyTooltipProps) {
  if (!active || !payload?.length) return null

  const data = payload[0].payload

  return (
    <div className="bg-background border rounded-lg p-3 shadow-lg">
      <p className="font-medium">{data.time}</p>
      <div className="mt-2 space-y-1 text-sm">
        <p>
          Mean: <span className="font-mono">{data.mean.toFixed(1)}{unit}</span>
        </p>
        <p>
          Range:{" "}
          <span className="font-mono">
            {data.lowerRange.toFixed(1)} - {data.upperRange.toFixed(1)}{unit}
          </span>
        </p>
        <p>
          ±1σ:{" "}
          <span className="font-mono">
            {data.lowerStdDev.toFixed(1)} - {data.upperStdDev.toFixed(1)}{unit}
          </span>
        </p>
      </div>
    </div>
  )
}

export function UncertaintyChart({
  data,
  title = "Forecast with Uncertainty",
  unit,
  color = "hsl(var(--primary))",
  models = [],
  showPerformanceZones = false,
  yDomain,
}: UncertaintyChartProps) {
  const chartData = formatChartDataWithUncertainty(data)
  const confidence = getOverallConfidence(data)

  // Calculate domain from data if not provided
  const calculatedDomain = yDomain || (() => {
    const allMin = Math.min(...chartData.map(d => d.lowerRange))
    const allMax = Math.max(...chartData.map(d => d.upperRange))
    const padding = (allMax - allMin) * 0.1
    return [Math.floor(allMin - padding), Math.ceil(allMax + padding)] as [number, number]
  })()

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          <ConfidenceBadgeFromLevel level={confidence} />
        </div>
        {models.length > 0 && (
          <ModelLegend models={models} className="mt-2" compact />
        )}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="uncertaintyGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="50%" stopColor={color} stopOpacity={0.1} />
                <stop offset="100%" stopColor={color} stopOpacity={0.3} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="time" stroke="#6b7280" style={{ fontSize: "12px" }} />
            <YAxis
              stroke="#6b7280"
              style={{ fontSize: "12px" }}
              domain={calculatedDomain}
              tickFormatter={(value) => `${value}${unit}`}
            />

            {/* WBGT Performance Zones (optional) */}
            {showPerformanceZones && (
              <>
                <ReferenceArea y1={20} y2={23} fill="#eab308" fillOpacity={0.1} />
                <ReferenceArea y1={23} y2={26} fill="#f97316" fillOpacity={0.1} />
                <ReferenceArea y1={26} y2={29} fill="#ef4444" fillOpacity={0.1} />
                <ReferenceArea y1={29} y2={35} fill="#991b1b" fillOpacity={0.1} />
              </>
            )}

            {/* Min/Max range - lightest shade */}
            <Area
              type="monotone"
              dataKey="upperRange"
              stroke="none"
              fill={color}
              fillOpacity={0.1}
            />
            <Area
              type="monotone"
              dataKey="lowerRange"
              stroke="none"
              fill="white"
              fillOpacity={1}
            />

            {/* ±1 Std Dev - medium shade */}
            <Area
              type="monotone"
              dataKey="upperStdDev"
              stroke="none"
              fill={color}
              fillOpacity={0.2}
            />
            <Area
              type="monotone"
              dataKey="lowerStdDev"
              stroke="none"
              fill="white"
              fillOpacity={1}
            />

            {/* Mean line */}
            <Line
              type="monotone"
              dataKey="mean"
              stroke={color}
              strokeWidth={2}
              dot={false}
            />

            <Tooltip content={<UncertaintyTooltip unit={unit} />} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
