# Project Index: WBGT Weather Dashboard

Generated: 2025-12-03

## Project Overview

A Next.js 16 application for real-time heat stress monitoring using WBGT (Wet Bulb Globe Temperature) calculations. Displays multi-model weather forecasts with ensemble statistics for running and outdoor activity recommendations.

**Stack**: Next.js 16, React 19, TypeScript, Tailwind CSS 4, Radix UI, Recharts, SWR

## Project Structure

```
wbgt-front-end/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx          # Root layout with Navigation
│   ├── page.tsx            # Redirect to /today
│   ├── today/page.tsx      # Current conditions + 12h forecast
│   ├── future/page.tsx     # Extended forecast view
│   ├── past/page.tsx       # Historical observations
│   └── settings/page.tsx   # User settings
├── components/             # React components
│   ├── ui/                 # shadcn/ui primitives (70+ components)
│   └── [feature].tsx       # Feature components (19 files)
├── lib/                    # Core logic
│   ├── api.ts              # API facade, multi-model WBGT
│   ├── kong-wbgt.ts        # WBGT calculation engine
│   ├── model-fetcher.ts    # Multi-model weather data fetcher
│   ├── observation-fetcher.ts  # BOM + OpenMeteo observations
│   ├── ensemble-utils.ts   # Statistical ensemble calculations
│   ├── wbgt-utils.ts       # WBGT zones and recommendations
│   ├── types.ts            # TypeScript interfaces
│   └── utils.ts            # cn() helper, date parsing
├── hooks/                  # React hooks
│   └── use-toast.ts        # Toast notifications
├── styles/                 # Global CSS
├── public/                 # Static assets
└── docs/                   # GitHub Pages build output
```

## Entry Points

- **Web App**: `app/layout.tsx` - Root layout with Navigation
- **Main Page**: `app/today/page.tsx` - Primary dashboard view
- **Build**: `npm run build` (outputs to `docs/` for GitHub Pages)
- **Dev**: `npm run dev`

## Core Modules

### lib/kong-wbgt.ts
**Purpose**: WBGT calculation engine using Kong et al. method
**Exports**:
- `calculateKongWBGT(params: WBGTParams): WBGTResult` - Main calculation (returns WBGT, globe temp, wet bulb temp)
- `calculateWetBulbTemperature(Ta, RH)` - Stull approximation
- `calculateEnsembleStats(wbgtArrays)` - Model statistics
- `categorizeHeatStress(wbgt)` - Risk categorization

### lib/model-fetcher.ts
**Purpose**: Parallel multi-model weather data fetching
**Exports**:
- `fetchAllModels(lat, lon, enabledModels)` - Fetch all weather models
- `fetchSingleModel(modelName, lat, lon)` - Fetch one model
- `MODEL_CONFIGS` - Model configuration (ECMWF, ICON, JMA, UKMO, BOM ACCESS)
- `DEFAULT_LOCATION` - Sydney coordinates (-33.87, 151.21)

### lib/observation-fetcher.ts
**Purpose**: Historical/recent observations with fallback chain
**Exports**:
- `fetchObservationsWithFallback(lat, lon, options)` - Primary fetcher
- `fetchHistoricalObservations(lat, lon, start, end)` - Archive data

**Data Sources**:
1. BOM observations (station 95765)
2. OpenMeteo forecast API (past_days=2)
3. OpenMeteo archive API
4. Satellite API (solar radiation)

### lib/api.ts
**Purpose**: High-level API facade combining models and WBGT
**Exports**:
- `fetchMultiModelWBGT(lat, lon, models)` - Multi-model WBGT forecast
- `fetchMultiModelCurrent(lat, lon)` - Current conditions
- `fetchObservations()` - Recent observations
- `fetchForecast()` - Legacy single-model forecast

### lib/ensemble-utils.ts
**Purpose**: Statistical calculations for model ensembles
**Exports**:
- `calculateEnsembleStats(members)` - mean, stdDev, min, max, p10, p90
- `getConfidenceLevel(stdDev, mean)` - high/medium/low confidence
- `createEnsembleDataPoints(times, modelValues)` - Chart data

### lib/types.ts
**Purpose**: TypeScript type definitions
**Key Types**:
- `WeatherObservation` / `WeatherForecast` - Weather data
- `WBGTZone` - safe | caution | warning | danger
- `WeatherModelId` - ecmwf_ifs | icon_seamless | jma_seamless | ukmo_seamless | bom_access
- `NormalizedWeatherData` - Unified model data format
- `MultiModelWBGTResult` - Combined WBGT with ensemble stats

## Key Feature Components

| Component | Purpose |
|-----------|---------|
| `today-conditions.tsx` | Current WBGT display with safety status |
| `hourly-strip.tsx` | 12-hour horizontal forecast strip |
| `forecast-chart.tsx` | Recharts-based WBGT/temp chart with uncertainty bands |
| `model-selector.tsx` | Toggle weather models (ECMWF, ICON, JMA, UKMO, BOM) |
| `environmental-metrics.tsx` | UV, air quality, conditions grid |
| `safety-recommendations.tsx` | Running/activity recommendations |
| `navigation.tsx` | Tab navigation (Today, Future, Past, Settings) |

## Configuration

| File | Purpose |
|------|---------|
| `next.config.mjs` | Static export, GitHub Pages basePath |
| `package.json` | Dependencies, scripts |
| `components.json` | shadcn/ui configuration |
| `tsconfig.json` | TypeScript config with path aliases |
| `postcss.config.mjs` | PostCSS for Tailwind |

## External APIs

| API | URL | Purpose |
|-----|-----|---------|
| Open-Meteo | `api.open-meteo.com` | ECMWF, ICON, JMA, UKMO forecasts |
| BOM Proxy | `bom-forecast.justin213141.workers.dev` | BOM ACCESS-G model |
| Satellite | `satellite-api.open-meteo.com` | Solar radiation data |
| OpenMeteo Archive | `archive-api.open-meteo.com` | Historical data |

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| next | 16.0.0 | React framework |
| react | 19.2.0 | UI library |
| swr | latest | Data fetching/caching |
| recharts | latest | Charts/visualizations |
| @radix-ui/* | various | UI primitives |
| tailwindcss | ^4.1.9 | Styling |
| zod | 3.25.76 | Schema validation |
| date-fns | 4.1.0 | Date utilities |

## Build & Deploy

```bash
# Development
npm run dev

# Production build (GitHub Pages)
GITHUB_PAGES=true npm run build

# Production build (Cloudflare)
CLOUDFLARE_PAGES=true npm run build
```

**Output**: Static export to `docs/` directory with `.nojekyll` marker

## WBGT Zones

| Zone | WBGT (°C) | Color | Recommendation |
|------|-----------|-------|----------------|
| Safe | < 27 | Green | Normal activities |
| Caution | 27-29 | Yellow | Stay hydrated, regular breaks |
| Warning | 29-32 | Orange | Limit activities, frequent breaks |
| Danger | > 32 | Red | Avoid strenuous outdoor activities |

## Data Flow

```
User Request → app/today/page.tsx
    ↓
useSWR hooks fetch data
    ↓
model-fetcher.ts → Open-Meteo / BOM APIs (parallel)
observation-fetcher.ts → BOM / OpenMeteo (fallback chain)
    ↓
kong-wbgt.ts → Calculate WBGT per model
ensemble-utils.ts → Statistical aggregation
    ↓
Components render with uncertainty bands
```

## Quick Reference

- **Default Location**: Sydney (-33.87, 151.21)
- **BOM Station**: 95765 (Sydney area)
- **Forecast Length**: 12 hours (hourly strip), 6 hours (chart)
- **Refresh Interval**: Observations 60s, Models 5min
- **Rate Limit**: 100 calls/hour per model (localStorage)
