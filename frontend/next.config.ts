import type { NextConfig } from "next";

// connect-src must allow the RPC, the relayer backend(s) and local dev receivers. Composed from
// the same env vars the app uses so the CSP doesn't drift from the config.
const connectSources = [
  "'self'",
  process.env.NEXT_PUBLIC_RPC_URL,
  ...(process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8080")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean),
  "ws://localhost:*",
  "http://localhost:*",
]
  .filter(Boolean)
  .join(" ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'", // Next hydration bootstrap
              "style-src 'self' 'unsafe-inline'", // React inline styles
              `img-src 'self' data:`,
              "font-src 'self' data:",
              `connect-src ${connectSources}`,
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default nextConfig;
