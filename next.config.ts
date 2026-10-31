import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL;

    if (!backendUrl) {
      return [];
    }

    const cleanBackendUrl = backendUrl.replace(/\/$/, "");

    return {
      beforeFiles: [
        {
          source: "/api/:path*",
          destination: `${cleanBackendUrl}/api/:path*`,
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
