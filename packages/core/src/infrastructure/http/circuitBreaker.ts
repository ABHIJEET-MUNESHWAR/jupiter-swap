import { CircuitOpenError } from '../../domain/errors.js';

/**
 * Minimal in-process circuit breaker (CLOSED → OPEN → HALF_OPEN).
 * Avoids extra dependencies; production deployments can swap in `opossum`
 * via the same interface.
 *
 * Big-O: O(1) per call.
 */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitOptions {
  readonly errorThresholdPct: number; // e.g. 50
  readonly windowSize: number;        // rolling window of last N calls
  readonly resetMs: number;           // after this in OPEN, move to HALF_OPEN
  readonly minimumCalls?: number;     // before evaluating threshold
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private results: boolean[] = [];
  private openedAt = 0;
  private readonly minimumCalls: number;

  constructor(private readonly opts: CircuitOptions) {
    this.minimumCalls = opts.minimumCalls ?? Math.max(5, Math.floor(opts.windowSize / 2));
  }

  getState(): CircuitState {
    return this.state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.openedAt >= this.opts.resetMs) this.state = 'HALF_OPEN';
      else throw new CircuitOpenError('Circuit breaker is OPEN');
    }
    try {
      const out = await fn();
      this.record(true);
      if (this.state === 'HALF_OPEN') this.state = 'CLOSED';
      return out;
    } catch (e) {
      this.record(false);
      this.maybeTrip();
      throw e;
    }
  }

  private record(success: boolean): void {
    this.results.push(success);
    if (this.results.length > this.opts.windowSize) this.results.shift();
  }

  private maybeTrip(): void {
    if (this.results.length < this.minimumCalls) return;
    const errors = this.results.filter((r) => !r).length;
    const errorPct = (errors / this.results.length) * 100;
    if (errorPct >= this.opts.errorThresholdPct) {
      this.state = 'OPEN';
      this.openedAt = Date.now();
    }
  }
}

