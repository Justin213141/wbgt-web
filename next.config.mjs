/** @type {import('next').NextConfig} */
const isGitHubPages = process.env.GITHUB_PAGES === 'true' || process.env.NODE_ENV === 'production'

const nextConfig = {
  output: 'export',
  distDir: 'docs',
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Add basePath for GitHub Pages deployment
  basePath: isGitHubPages ? '/wbgt-web' : '',
  assetPrefix: isGitHubPages ? '/wbgt-web' : '',
}

export default nextConfig
