/** 同源代理目标：Next 服务端转发 `/api/youle-backend/*`，浏览器不再直连 `:8001`（绕开 Cursor/部分环境下的 Failed to fetch）。 */
const backendOrigin = (process.env.YOULE_BACKEND_INTERNAL_URL || 'http://127.0.0.1:8001').replace(
  /\/+$/,
  '',
)

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/youle-backend/:path*',
        destination: `${backendOrigin}/:path*`,
      },
    ]
  },
}

export default nextConfig
