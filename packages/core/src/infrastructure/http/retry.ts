/**
 * Exponential-backoff retry with full jitter (AWS-style).
 * Generic over the value type, predicate-driven for retryability.
 *
 * Time complexity: O(maxAttempts).
 */
export interface RetryOptions {
  readonly maxAttempts: number;
  readonly baseMs: number;
  readonly capMs: number;
  readonly shouldRetry?: (err: unknown, attempt: number) => boolean;
  readonly onRetry?: (err: unknown, attempt: number, delayMs: number) => void;
  readonly sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((res) => setTimeout(res, ms));

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  const sleep = opts.sleep ?? defaultSleep;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const retryable = opts.shouldRetry ? opts.shouldRetry(e, attempt) : true;
      if (!retryable || attempt === opts.maxAttempts) break;
      const expo = Math.min(opts.capMs, opts.baseMs * 2 ** (attempt - 1));
      const jitter = Math.floor(Math.random() * expo);
      opts.onRetry?.(e, attempt, jitter);
      await sleep(jitter);
    }
  }
  throw lastErr;
}

