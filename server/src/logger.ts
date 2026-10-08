/**
 * Minimal structured logger — no dependency, safe error output only.
 * Never logs secrets, tokens or raw evidence content.
 */
type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const isProduction = process.env.NODE_ENV === 'production';
const minLevel: Level = (process.env.LOG_LEVEL as Level) || (isProduction ? 'info' : 'debug');

function emit(level: Level, message: string, meta?: Record<string, unknown>): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;
  const line = {
    t: new Date().toISOString(),
    level,
    msg: message,
    ...(meta && Object.keys(meta).length > 0 ? { meta } : {}),
  };
  const text = isProduction ? JSON.stringify(line) : `${level.toUpperCase().padEnd(5)} ${message}`;
  const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
  if (isProduction) {
    stream.write(`${text}\n`);
  } else {
    stream.write(`${text}${meta ? ` ${JSON.stringify(meta)}` : ''}\n`);
  }
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => emit('debug', message, meta),
  info: (message: string, meta?: Record<string, unknown>) => emit('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => emit('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => emit('error', message, meta),
};
