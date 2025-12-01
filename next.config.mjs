/** @type {import('next').NextConfig} */
const isGitHubPages = process.env.GITHUB_PAGES === 'true'
const isCloudflare = process.env.CLOUDFLARE_PAGES === 'true'

const nextConfig = {
  output: 'export',
  distDir: isCloudflare ? 'out' : 'docs',
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Add basePath for GitHub Pages deployment only
  basePath: isGitHubPages ? '/wbgt-web' : '',
  assetPrefix: isGitHubPages ? '/wbgt-web' : '',
}

export default nextConfig
