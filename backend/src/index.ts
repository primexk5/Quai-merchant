import 'dotenv/config';
import type { Server } from 'node:http';
import { loadConfig } from './config.js';
import { logger, log } from './logger.js';
import { JsonStore } from './store/json.js';
import { QuaiClient } from './chain/client.js';
import { Indexer } from './indexer/indexer.js';
import { WebhookDispatcher } from './webhooks/dispatcher.js';
import { createServer } from './api/server.js';

const boot = log('main');

async function main(): Promise<void> {
  const cfg = loadConfig();
  boot.info(
    {
      chainId: cfg.CHAIN_ID,
      contract: cfg.PAYWITHQUAI_ADDRESS,
      confirmations: cfg.CONFIRMATIONS,
      env: process.env.NODE_ENV ?? 'development',
    },
    'starting Pay with Quai relayer',
  );
  if (cfg.WEBHOOK_ALLOW_INSECURE_URLS) {
    boot.warn(
      'WEBHOOK_ALLOW_INSECURE_URLS=true — SSRF guard DISABLED (https requirement and private-address blocking skipped). Intended for local dev only; will not boot with NODE_ENV=production.',
    );
  }

  const store = new JsonStore(cfg.DATABASE_PATH);
  const client = new QuaiClient(cfg);
  const dispatcher = new WebhookDispatcher(store, cfg);
  const indexer = new Indexer(client, store, cfg);

  const app = createServer(store, client, cfg);
  const server: Server = app.listen(cfg.PORT, () => boot.info({ port: cfg.PORT }, 'HTTP API listening'));

  dispatcher.start();
  await indexer.start();

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    boot.info({ signal }, 'shutting down');
    await indexer.stop();
    await dispatcher.stop();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    store.close();
    boot.info('shutdown complete');
    process.exit(0);
  };

  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, () => void shutdown(sig));
  }
  process.on('unhandledRejection', (reason) => {
    // A rejected promise that nobody handled means an async path is in an unknown state (a queued
    // webhook may have silently not been sent). Log it and exit so the process manager restarts
    // into a known state instead of limping on.
    logger().fatal({ reason }, 'unhandledRejection — exiting');
    process.exit(1);
  });
  process.on('uncaughtException', (err) => {
    logger().fatal({ err }, 'uncaughtException — exiting');
    process.exit(1);
  });
}

main().catch((err) => {
  logger().fatal({ err }, 'failed to start');
  process.exit(1);
});
