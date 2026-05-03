/**
 * Typed domain error hierarchy. Each error carries a stable `code` (used in
 * GraphQL `extensions.code`), an HTTP status hint, and a `retryable` flag
 * consumed by the retry/circuit-breaker layer.
 */
export type DomainErrorCode =
  | 'INSUFFICIENT_BALANCE'
  | 'SLIPPAGE_EXCEEDED'
  | 'BLOCKHASH_EXPIRED'
  | 'SIMULATION_FAILED'
  | 'RATE_LIMITED'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_ERROR'
  | 'CIRCUIT_OPEN'
  | 'INVALID_INPUT'
  | 'INVALID_MINT'
  | 'SAME_MINT'
  | 'DUST_AMOUNT'
  | 'WALLET_NOT_CONNECTED'
  | 'NOT_FOUND'
  | 'INTERNAL';

export abstract class DomainError extends Error {
  abstract readonly code: DomainErrorCode;
  abstract readonly httpStatus: number;
  readonly retryable: boolean = false;
  override readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = new.target.name;
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
  }

  toJSON(): Record<string, unknown> {
    return { code: this.code, message: this.message, httpStatus: this.httpStatus };
  }
}

export class InvalidInputError extends DomainError {
  readonly code = 'INVALID_INPUT' as const;
  readonly httpStatus = 400;
}
export class SameMintError extends DomainError {
  readonly code = 'SAME_MINT' as const;
  readonly httpStatus = 400;
}
export class DustAmountError extends DomainError {
  readonly code = 'DUST_AMOUNT' as const;
  readonly httpStatus = 400;
}
export class InvalidMintError extends DomainError {
  readonly code = 'INVALID_MINT' as const;
  readonly httpStatus = 400;
}
export class WalletNotConnectedError extends DomainError {
  readonly code = 'WALLET_NOT_CONNECTED' as const;
  readonly httpStatus = 401;
}
export class InsufficientBalanceError extends DomainError {
  readonly code = 'INSUFFICIENT_BALANCE' as const;
  readonly httpStatus = 402;
}
export class SlippageExceededError extends DomainError {
  readonly code = 'SLIPPAGE_EXCEEDED' as const;
  readonly httpStatus = 409;
}
export class BlockhashExpiredError extends DomainError {
  readonly code = 'BLOCKHASH_EXPIRED' as const;
  readonly httpStatus = 409;
  override readonly retryable = true;
}
export class SimulationFailedError extends DomainError {
  readonly code = 'SIMULATION_FAILED' as const;
  readonly httpStatus = 422;
}
export class RateLimitedError extends DomainError {
  readonly code = 'RATE_LIMITED' as const;
  readonly httpStatus = 429;
  override readonly retryable = true;
}
export class UpstreamTimeoutError extends DomainError {
  readonly code = 'UPSTREAM_TIMEOUT' as const;
  readonly httpStatus = 504;
  override readonly retryable = true;
}
export class UpstreamError extends DomainError {
  readonly code = 'UPSTREAM_ERROR' as const;
  readonly httpStatus = 502;
  override readonly retryable = true;
}
export class CircuitOpenError extends DomainError {
  readonly code = 'CIRCUIT_OPEN' as const;
  readonly httpStatus = 503;
}
export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND' as const;
  readonly httpStatus = 404;
}
export class InternalError extends DomainError {
  readonly code = 'INTERNAL' as const;
  readonly httpStatus = 500;
}

/** Map common Jupiter / network failures to a `DomainError`. */
export function fromUpstream(status: number, body: unknown, message?: string): DomainError {
  const text = typeof body === 'string' ? body : JSON.stringify(body ?? {});
  const merged = `${message ?? 'Upstream error'} [${status}]: ${text.slice(0, 400)}`;
  if (status === 429) return new RateLimitedError(merged, body);
  if (status === 408 || status === 504) return new UpstreamTimeoutError(merged, body);
  if (/slippage/i.test(text)) return new SlippageExceededError(merged, body);
  if (/blockhash/i.test(text)) return new BlockhashExpiredError(merged, body);
  if (/insufficient/i.test(text)) return new InsufficientBalanceError(merged, body);
  if (/simulation/i.test(text)) return new SimulationFailedError(merged, body);
  if (status >= 500) return new UpstreamError(merged, body);
  return new InvalidInputError(merged, body);
}


