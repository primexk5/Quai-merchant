import type { NextFunction, Request, Response } from 'express';

const ALLOWED_METHODS = 'GET,POST,PATCH,OPTIONS';
const ALLOWED_HEADERS = 'content-type, authorization';

/**
 * CORS middleware. `origins` is a comma-separated allowlist, or `*` to allow any origin
 * (the default — this is a local/dev MVP; the admin routes are still gated by the bearer
 * token, so an open origin does not expose the API itself).
 */
export function cors(origins: string) {
  const allowAll = origins === '*';
  const allowed = origins
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.header('origin') ?? '';
    if (allowAll || allowed.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', allowAll ? '*' : origin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
    res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
    res.setHeader('Access-Control-Max-Age', '600');

    // Preflight for the dashboard's cross-origin admin calls (they carry a Bearer token, so the
    // browser always sends OPTIONS first) — answer it directly and don't hit the routes.
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  };
}