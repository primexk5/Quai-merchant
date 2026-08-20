import { NextRequest } from "next/server";

/**
 * Server-side proxy for all /v1/* backend calls made from the browser.
 *
 * Why this exists:
 *   The backend's CORS_ORIGINS only allows the deployed Vercel domain.
 *   During local development the browser would be at localhost:3000, which the
 *   backend rejects with a CORS preflight failure — causing every auth call to
 *   appear as a hanging "loop" because backendFetch retries twice.
 *
 *   By routing all /v1/* calls through this Next.js API route the browser never
 *   makes a cross-origin request to the backend. The server-to-server call has
 *   no CORS restriction. The Set-Cookie header from the backend is forwarded so
 *   the HttpOnly session cookie still lands in the browser correctly.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKEND_URLS = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8080")
  .split(",")
  .map((u) => u.trim())
  .filter(Boolean);

async function proxyHandler(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await params;
  const query = request.nextUrl.search;
  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();

  // Forward headers the backend needs — strip hop-by-hop headers, Host, and
  // Accept-Encoding. We must NOT forward Accept-Encoding because Node's fetch
  // automatically decompresses the response body. If we then forward the
  // Content-Encoding header the browser tries to decompress again →
  // ERR_CONTENT_DECODING_FAILED.
  const forwardHeaders: Record<string, string> = {};
  for (const [key, value] of request.headers.entries()) {
    const lower = key.toLowerCase();
    if (
      lower === "host" ||
      lower === "connection" ||
      lower === "transfer-encoding" ||
      lower === "keep-alive" ||
      lower === "accept-encoding"   // ← prevent compressed response from backend
    )
      continue;
    forwardHeaders[key] = value;
  }

  let lastError: unknown;
  for (const base of BACKEND_URLS) {
    try {
      const res = await fetch(`${base}/v1/${path.join("/")}${query}`, {
        method: request.method,
        headers: forwardHeaders,
        body,
        signal: AbortSignal.timeout(15_000),
        // @ts-expect-error — Node 18 fetch doesn't support duplex, but that's OK for our payloads
        duplex: "half",
      });

      const responseBody = await res.arrayBuffer();

      // Build response headers, forwarding Set-Cookie so session cookies work.
      // Strip Content-Encoding and Content-Length: the body is already decoded
      // by Node's fetch; forwarding encoding headers would confuse the browser.
      const responseHeaders = new Headers();
      for (const [key, value] of res.headers.entries()) {
        const lower = key.toLowerCase();
        if (
          lower === "connection" ||
          lower === "transfer-encoding" ||
          lower === "keep-alive" ||
          lower === "content-encoding" ||   // ← body already decompressed
          lower === "content-length"         // ← length changed after decompression
        )
          continue;
        responseHeaders.append(key, value);
      }

      return new Response(responseBody.byteLength > 0 ? responseBody : null, {
        status: res.status,
        headers: responseHeaders,
      });
    } catch (err) {
      lastError = err;
    }
  }

  return Response.json(
    {
      error: `backend unreachable: ${lastError instanceof Error ? lastError.message : "unknown"}`,
    },
    { status: 502 },
  );
}

export {
  proxyHandler as GET,
  proxyHandler as POST,
  proxyHandler as PATCH,
  proxyHandler as DELETE,
  proxyHandler as OPTIONS,
};
