import pino from 'pino';
import type { Logger } from '../domain/ports.js';

export function createLogger(level: string = 'info', name = 'jupiter-swap'): Logger {
  const base = pino({
    name,
    level,
    transport:
      process.env.NODE_ENV === 'production'
        ? undefined
        : { target: 'pino-pretty', options: { colorize: true } },
  });
  return wrap(base);
}

function wrap(p: pino.Logger): Logger {
  return {
    info: (o, m) => p.info(o as object, m),
    warn: (o, m) => p.warn(o as object, m),
    error: (o, m) => p.error(o as object, m),
    debug: (o, m) => p.debug(o as object, m),
    child: (b) => wrap(p.child(b)),
  };
}

