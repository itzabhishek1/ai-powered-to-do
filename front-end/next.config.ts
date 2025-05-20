import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
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
