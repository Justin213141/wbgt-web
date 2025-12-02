# WBGT Web Project Notes

## Build & Deployment

### GitHub Pages Deployment
Always build with the environment variable for correct asset paths:
```bash
GITHUB_PAGES=true npm run build
```

Without this, assets load from `/_next/` instead of `/wbgt-web/_next/` and the site breaks.
