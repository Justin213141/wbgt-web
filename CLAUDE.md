# WBGT Web Project Notes

## CRITICAL: Deployment

**NEVER run `npm run build` directly.** Always use:
```bash
GITHUB_PAGES=true npm run build && git add docs/ && git commit -m "build: update GitHub Pages" && git push
```
Without `GITHUB_PAGES=true`, assets load from wrong paths and the site breaks.

---

## Current Focus
- Today page: AQI in chart, color-coded metrics, 48h forecast, multimodel temp ranges
- HourlyForecastTable: visual day separator at midnight boundaries

## Build & Deployment

### GitHub Pages Deployment
Always build with the environment variable for correct asset paths:
```bash
GITHUB_PAGES=true npm run build
```

Without this, assets load from `/_next/` instead of `/wbgt-web/_next/` and the site breaks.

### After Pushing Code Changes
Source code changes don't update the live GitHub Pages site. After pushing source changes, also rebuild and push the docs folder:
```bash
GITHUB_PAGES=true npm run build && git add docs/ && git commit -m "build: update GitHub Pages" && git push
```
