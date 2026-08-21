import type { NextConfig } from "next";

// connect-src must allow the RPC, the relayer backend(s) and local dev receivers. Composed from
// the same env vars the app uses so the CSP doesn't drift from the config. The documented
// default origins are ALWAYS included: NEXT_PUBLIC_* vars are inlined at build time, and if one
// is missing on Vercel the browser would otherwise have its RPC/backend fetches silently blocked
// by this CSP — which surfaces as an endless "registering orders…" spinner.
const connectSources = [
  "'self'",
  process.env.NEXT_PUBLIC_RPC_URL,
  // Quai mainnet public gateway (always allowed)
  "https://rpc.quai.network",
  "https://*.quai.network",
  ...(process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8080")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean),
  // Render-hosted backend (the default deployment target)
  "https://*.onrender.com",
  "ws://localhost:*",
  "http://localhost:*",
]
  .filter(Boolean)
  .join(" ");

// React's dev-mode debugging (callstack reconstruction) requires eval; production never uses
// it. CSP headers apply to dev and prod alike, so include 'unsafe-eval' only for dev builds.
const scriptSrc = ["'self'", "'unsafe-inline'"];
if (process.env.NODE_ENV !== "production") {
  scriptSrc.push("'unsafe-eval'");
}

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Browsers request /favicon.ico by default; serve the app icon instead.
      { source: "/favicon.ico", destination: "/icon.png", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              `script-src ${scriptSrc.join(" ")}`,
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
