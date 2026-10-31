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

    // Preserve existing Next.js API routes locally on Vercel.
    // Unmatched API requests fallback to the Render backend server.
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [
        {
          source: "/api/:path*",
          destination: `${cleanBackendUrl}/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
