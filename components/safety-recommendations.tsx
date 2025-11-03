import { Card, CardContent } from "./ui/card"
import { AlertTriangle, CheckCircle, AlertOctagon, XCircle } from "lucide-react"
import { getSafetyRecommendations } from "@/lib/weather-utils"

interface SafetyRecommendationsProps {
  wbgt: number
  esi: number
}

export function SafetyRecommendations({ wbgt, esi }: SafetyRecommendationsProps) {
  const recommendations = getSafetyRecommendations(wbgt, esi)

  const icons = {
    0: CheckCircle,
    1: AlertTriangle,
    2: AlertOctagon,
    3: XCircle,
  }

  const Icon = icons[recommendations.level as keyof typeof icons]

  return (
    <Card className="border-2" style={{ borderColor: recommendations.color }}>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-full p-3" style={{ backgroundColor: `${recommendations.color}20` }}>
            <Icon className="h-6 w-6" style={{ color: recommendations.color }} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900 mb-2">{recommendations.title}</h3>
            <p className="text-gray-700 mb-3">{recommendations.message}</p>
            <ul className="space-y-1">
              {recommendations.actions.map((action, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-gray-400 flex-shrink-0" />
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
