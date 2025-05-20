import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Avoid hydration issues with VSCode or browser extensions
  compiler: {
    styledComponents: true,
  },
  // Improve performance with Images
  images: {
    domains: ['localhost'],
  },
  // API proxying
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/:path*`
      }
    ];
  }
};

export default nextConfig;
