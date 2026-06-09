import type { NextConfig } from "next";

const nextConfig: any = {
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'localhost:3001', 'hotmw-2401-4900-57e9-be39-ec68-1753-d7fd-cb95.run.pinggy-free.link']
    }
  },
  allowedDevOrigins: ['hotmw-2401-4900-57e9-be39-ec68-1753-d7fd-cb95.run.pinggy-free.link']
};

export default nextConfig;
