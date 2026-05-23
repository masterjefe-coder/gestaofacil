import type { NextConfig } from "next";
import { getDefaultSecurityHeaders } from "./lib/security-headers";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: getDefaultSecurityHeaders(),
      },
    ];
  },
};

export default nextConfig;
