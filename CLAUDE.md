# WBGT Web Project Notes

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
