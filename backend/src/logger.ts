import { pino, type Logger } from 'pino';

let root: Logger | undefined;

/**
 * Process-wide structured logger. Reads only its own env (LOG_LEVEL / LOG_PRETTY) directly, rather
 * than the fully-validated app config, so importing any module never fails merely because an
 * unrelated config value is missing. JSON in production; pretty-printed when LOG_PRETTY=true.
 * Silent under test runners to keep output clean.
 */
export function logger(): Logger {
  if (root) return root;
  const underTest = !!process.env.VITEST || process.env.NODE_ENV === 'test';
  const level = process.env.LOG_LEVEL ?? (underTest ? 'silent' : 'info');
  const pretty = process.env.LOG_PRETTY === 'true' || process.env.LOG_PRETTY === '1';
  root = pino({
    level,
    ...(pretty && !underTest
      ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } } }
      : {}),
  });
  return root;
}

/** A child logger tagged with a component name, e.g. `log('indexer')`. */
export function log(component: string): Logger {
  return logger().child({ component });
}
