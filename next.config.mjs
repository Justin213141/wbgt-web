/** @type {import('next').NextConfig} */
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
  basePath: process.env.NODE_ENV === 'production' ? '/wbgt-web' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/wbgt-web' : '',
}

export default nextConfig
