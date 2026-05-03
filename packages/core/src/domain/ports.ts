import type { DomainError } from './errors.js';
import type { CreateOrderParams, ExecuteOrderParams, ExecuteResult, SwapOrder } from './entities.js';
import type { RequestId } from './types/brand.js';
import type { Result } from './types/result.js';

/**
 * Strategy interface — abstracts the underlying DEX aggregator. Jupiter is
 * just one implementation; new providers (Raydium router, 1inch-style
 * meta-aggregator, etc.) plug in by implementing this port.
 *
 * SOLID: this is the Open/Closed seam.
 */
export interface SwapProvider {
  createOrder(params: CreateOrderParams): Promise<Result<SwapOrder, DomainError>>;
  executeOrder(params: ExecuteOrderParams): Promise<Result<ExecuteResult, DomainError>>;
}

/** Generic repository — `T` entity, `ID` identifier. */
export interface Repository<T, ID> {
  save(entity: T): Promise<void>;
  findById(id: ID): Promise<T | null>;
}

export type OrderRepository = Repository<SwapOrder, RequestId>;

export interface Logger {
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
  debug(obj: unknown, msg?: string): void;
  child(bindings: Record<string, unknown>): Logger;
}

export interface Clock {
  now(): Date;
  monotonicMs(): number;
}

export interface RateLimiter {
  /** Throws `RateLimitedError` when exhausted. */
  consume(key: string, points?: number): Promise<void>;
}

export interface DomainEvent<T = unknown> {
  readonly type: string;
  readonly occurredAt: Date;
  readonly payload: T;
}

export type EventHandler<T> = (e: DomainEvent<T>) => void | Promise<void>;

export interface EventBus {
  publish<T>(event: DomainEvent<T>): Promise<void>;
  subscribe<T>(type: string, handler: EventHandler<T>): () => void;
}

