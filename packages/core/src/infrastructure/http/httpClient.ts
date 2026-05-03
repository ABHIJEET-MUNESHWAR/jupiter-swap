import { z, type ZodType } from 'zod';
import { CircuitBreaker } from './circuitBreaker.js';
import { withRetry } from './retry.js';
import {
  DomainError,
  fromUpstream,
  UpstreamError,
  UpstreamTimeoutError,
} from '../../domain/errors.js';
import type { Logger } from '../../domain/ports.js';
/** Generic, dependency-free typed HTTP client.
 *
 * Generics:
 *   - `TRes` is inferred from a runtime Zod schema, giving us *both*
 *     compile-time types and runtime validation of upstream payloads.
 *
 * Reliability features:
 *   - per-request timeout via AbortController
 *   - exponential backoff retry on retryable failures
 *   - shared circuit breaker
 *
 * Big-O: O(maxAttempts) per request.
 */
export interface HttpRequestConfig<TBody = unknown> {
  readonly method: 'GET' | 'POST';
  readonly path: string;
  readonly body?: TBody;
  readonly query?: Record<string, string | number | undefined>;
  readonly headers?: Record<string, string>;
}

export interface HttpClientOptions {
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly maxRetries: number;
  readonly defaultHeaders?: Record<string, string>;
  readonly breaker?: CircuitBreaker;
  readonly logger?: Logger;
  readonly fetchImpl?: typeof fetch;
}

const ProblemSchema = z.unknown();

export class HttpClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly opts: HttpClientOptions) {
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  async request<S extends ZodType>(
    cfg: HttpRequestConfig,
    schema: S,
  ): Promise<z.infer<S>> {
    const exec = (): Promise<z.infer<S>> => this.doRequest(cfg, schema);
    const wrapped = this.opts.breaker ? () => this.opts.breaker!.execute(exec) : exec;
    return withRetry(wrapped, {
      maxAttempts: this.opts.maxRetries + 1,
      baseMs: 200,
      capMs: 4_000,
      shouldRetry: (e) => e instanceof DomainError && e.retryable,
      onRetry: (e, attempt, delay) =>
        this.opts.logger?.warn({ err: String(e), attempt, delay }, 'http retry'),
    });
  }

  private async doRequest<S extends ZodType>(
    cfg: HttpRequestConfig,
    schema: S,
  ): Promise<z.infer<S>> {
    const url = this.buildUrl(cfg);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.opts.timeoutMs);
    try {
      const init: RequestInit = {
        method: cfg.method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...this.opts.defaultHeaders,
          ...cfg.headers,
        },
        signal: ctrl.signal,
      };
      if (cfg.body !== undefined) init.body = JSON.stringify(cfg.body);
      const res = await this.fetchImpl(url, init);
      const text = await res.text();
      const parsedBody: unknown = text ? safeJson(text) : undefined;
      if (!res.ok) {
        ProblemSchema.parse(parsedBody); // future hook
        throw fromUpstream(res.status, parsedBody);
      }
      const parsed = schema.safeParse(parsedBody);
      if (!parsed.success) {
        throw new UpstreamError(
          `Schema validation failed: ${parsed.error.message}`,
          parsedBody,
        );
      }
      return parsed.data as z.infer<S>;
    } catch (e) {
      if (e instanceof DomainError) throw e;
      if (e instanceof Error && e.name === 'AbortError') {
        throw new UpstreamTimeoutError(`Request to ${url} timed out`, e);
      }
      throw new UpstreamError(`HTTP failure: ${String(e)}`, e);
    } finally {
      clearTimeout(timer);
    }
  }

  private buildUrl(cfg: HttpRequestConfig): string {
    const u = new URL(cfg.path.replace(/^\//, ''), ensureTrailingSlash(this.opts.baseUrl));
    if (cfg.query) {
      for (const [k, v] of Object.entries(cfg.query)) {
        if (v !== undefined) u.searchParams.set(k, String(v));
      }
    }
    return u.toString();
  }
}

function ensureTrailingSlash(s: string): string {
  return s.endsWith('/') ? s : `${s}/`;
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s) as unknown;
  } catch {
    return s;
  }
}



