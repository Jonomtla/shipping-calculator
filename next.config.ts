import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/shipping-calculator',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
