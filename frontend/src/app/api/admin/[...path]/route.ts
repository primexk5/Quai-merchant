import { NextRequest } from "next/server";

/**
 * Server-only proxy for admin calls that require the ADMIN_API_KEY (demo/dashboard fallback).
 * The key lives in `process.env.ADMIN_API_KEY` (server-side only, never in the browser bundle)
 * and is injected here, so the relayer's admin routes are never reachable with a leaked key.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKEND_URLS = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8080")
  .split(",")
  .map((u) => u.trim())
  .filter(Boolean);

export async function handler(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const apiKey = process.env.ADMIN_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ADMIN_API_KEY is not configured on the server" },
      { status: 500 },
    );
  }

  const { path } = await params;
  const query = request.nextUrl.search;
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();

  let lastError: unknown;
  for (const base of BACKEND_URLS) {
    try {
      const res = await fetch(`${base}/v1/${path.join("/")}${query}`, {
        method: request.method,
        headers: {
          authorization: `Bearer ${apiKey}`,
          ...(body ? { "content-type": request.headers.get("content-type") ?? "application/json" } : {}),
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      const text = await res.text();
      return new Response(text || null, {
        status: res.status,
        headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
      });
    } catch (err) {
      lastError = err;
    }
  }
  return Response.json(
    { error: `backend unreachable: ${lastError instanceof Error ? lastError.message : "unknown"}` },
    { status: 502 },
  );
}

export { handler as GET, handler as POST, handler as PATCH, handler as DELETE };
