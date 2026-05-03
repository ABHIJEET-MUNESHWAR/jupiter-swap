import { RateLimiterMemory } from 'rate-limiter-flexible';
import { RateLimitedError } from '../domain/errors.js';
import type { RateLimiter } from '../domain/ports.js';

/** Token-bucket rate limiter (in-memory). For multi-instance deployments
 *  swap in `RateLimiterRedis` behind the same interface. */
export class MemoryRateLimiter implements RateLimiter {
  private readonly impl: RateLimiterMemory;

  constructor(opts: { points: number; durationSec: number; keyPrefix?: string }) {
    this.impl = new RateLimiterMemory({
      points: opts.points,
      duration: opts.durationSec,
      keyPrefix: opts.keyPrefix ?? 'rl',
    });
  }

  async consume(key: string, points = 1): Promise<void> {
    try {
      await this.impl.consume(key, points);
    } catch (e) {
      throw new RateLimitedError(`Rate limit exceeded for ${key}`, e);
    }
  }
}

