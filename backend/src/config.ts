import { z } from 'zod';

/**
 * Environment configuration, validated at startup. Any missing/invalid value fails fast with a
 * readable error rather than surfacing as a confusing runtime crash later.
 */
const boolish = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined ? def : v === 'true' || v === '1'));

const EnvSchema = z.object({
  RPC_URL: z.string().url(),
  CHAIN_ID: z.coerce.number().int().positive(),
  PAYWITHQUAI_ADDRESS: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/, 'PAYWITHQUAI_ADDRESS must be a 20-byte hex address'),
  START_BLOCK: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== '' ? Number(v) : undefined))
    .pipe(z.number().int().nonnegative().optional()),

  CONFIRMATIONS: z.coerce.number().int().nonnegative().default(12),
  POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  MAX_BLOCK_RANGE: z.coerce.number().int().positive().default(2000),

  WEBHOOK_MAX_ATTEMPTS: z.coerce.number().int().positive().default(10),
  WEBHOOK_BASE_BACKOFF_MS: z.coerce.number().int().positive().default(5000),
  WEBHOOK_MAX_BACKOFF_MS: z.coerce.number().int().positive().default(3_600_000),
  WEBHOOK_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  // SSRF guard escape hatch. When false (default/production) webhook URLs must be https and must
  // not resolve to private/loopback/reserved addresses. Set true only for local development against
  // an http://localhost receiver.
  WEBHOOK_ALLOW_INSECURE_URLS: boolish(false),

  PORT: z.coerce.number().int().positive().default(8080),
  // Comma-separated list of allowed browser origins for the HTTP API, or `*` for any origin.
  // Only relevant in local dev — the dashboard runs on a different port than the backend.
  CORS_ORIGINS: z.string().default('*'),
  ADMIN_API_KEY: z.string().min(16, 'ADMIN_API_KEY should be at least 16 chars'),
  // Rate limit for the single unauthenticated, RPC-backed route (GET /v1/orders/...): max requests
  // per IP per window. Protects the upstream Quai RPC from being used as an amplification target.
  PUBLIC_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  PUBLIC_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),

  DATABASE_PATH: z.string().default('./data/relayer.db'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  LOG_PRETTY: boolish(false),
});

export type Config = z.infer<typeof EnvSchema>;

let cached: Config | undefined;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
