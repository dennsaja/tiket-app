import type { NextConfig } from "next";
import { CDN_ORIGIN, API_ORIGIN, FRONTEND_ORIGIN } from "./src/lib/network/origins";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sql.js"],
  outputFileTracingIncludes: { "/api/admin/map/topology": ["./node_modules/sql.js/dist/sql-wasm.wasm"] },
  output: "standalone",
  assetPrefix: CDN_ORIGIN || undefined,

  // Disable powered-by header
  poweredByHeader: false,

  // Enable strict mode
  reactStrictMode: true,

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },

  // Experimental
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", ...[FRONTEND_ORIGIN, API_ORIGIN].filter(Boolean).map(value => new URL(value).host)],
    },
  },

  // Image configuration
  images: {
    remotePatterns: CDN_ORIGIN ? [{ protocol: new URL(CDN_ORIGIN).protocol.replace(":", "") as "http" | "https", hostname: new URL(CDN_ORIGIN).hostname, port: new URL(CDN_ORIGIN).port, pathname: "/**" }] : [],
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
