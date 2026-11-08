import type { NextConfig } from "next";

const buildTraceExcludes = [
  "**/android-technician/**", "**/motion/**", "**/uploads/**", "**/.git/**",
  "**/src/__tests__/**", "**/.env*", "**/.next/cache/**", "**/.next/standalone/**",
];

const nextConfig: NextConfig = {
  // Keep the existing Turbopack development flow alongside the production hook.
  turbopack: {},
  serverExternalPackages: ["sql.js"],
  outputFileTracingIncludes: { "/api/admin/map/topology": ["./node_modules/sql.js/dist/sql-wasm.wasm"] },
  // Backend backup handlers inspect the checkout; keep local devices, private data,
  // and unrelated projects out of the frontend deployment artifact.
  outputFileTracingExcludes: {
    // Also match Next's `next-server` trace, which has no leading slash.
    "**": buildTraceExcludes,
  },
  webpack(config, { dev, nextRuntime }) {
    if (!dev && nextRuntime === "nodejs") {
      // Next 16.3's final exclusion pass joins globs using Windows backslashes,
      // which picomatch treats as escapes. Apply the same exclusions before
      // tracing, while paths are still normalized (verified on Next 16.3.6).
      const tracer = config.plugins?.find((plugin: { constructor?: { name?: string } } | null) => plugin?.constructor?.name === "TraceEntryPointsPlugin");
      if (!tracer) throw new Error("Plugin penelusuran build berubah. Periksa pengecualian berkas privat sebelum membuat standalone.");
      tracer.traceIgnores = [...new Set([...(tracer.traceIgnores || []), ...buildTraceExcludes])];
    }
    return config;
  },
  output: "standalone",

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
      allowedOrigins: ["localhost:3000"],
    },
  },

  // Image configuration
  images: {
    remotePatterns: [],
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
