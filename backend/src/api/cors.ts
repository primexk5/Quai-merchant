import type { NextFunction, Request, Response } from 'express';

const ALLOWED_METHODS = 'GET,POST,PATCH,OPTIONS';
const ALLOWED_HEADERS = 'content-type, authorization';

/**
 * CORS middleware. `origins` is a comma-separated allowlist, or `*` to allow any origin
 * (local/dev MVP default). When credentials are in play (the HttpOnly session cookie on
 * /v1/me etc.), the response must echo the specific request origin — `Access-Control-Allow-Origin:
 * *` would make the browser refuse the credentialed request.
 */
export function cors(origins: string) {
  const allowAll = origins === '*';
  const allowed = origins
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.header('origin') ?? '';
    if (origin && (allowAll || allowed.includes(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
    res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
    res.setHeader('Access-Control-Max-Age', '600');

    // Preflight for the dashboard's cross-origin calls (they carry a Bearer token or session
    // cookie, so the browser always sends OPTIONS first) — answer it directly.
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  };
}