import type { CreateOrderParams, ExecuteResult, SwapOrder } from '../domain/entities.js';
import { DomainError, NotFoundError } from '../domain/errors.js';
import type { EventBus, Logger, OrderRepository, RateLimiter, SwapProvider } from '../domain/ports.js';
import { match, type Result } from '../domain/types/result.js';
import { type Base64Tx, type RequestId } from '../domain/types/brand.js';
import { ordersCreated, ordersExecuted } from '../infrastructure/metrics.js';
import { makeEvent } from '../infrastructure/eventBus.js';
import type { Command, CommandHandler, Query, QueryHandler } from './bus.js';

/* ─────────── Commands ─────────── */

export interface CreateOrderCommand extends Command<SwapOrder> {
  readonly type: 'CreateOrder';
  readonly params: CreateOrderParams;
  readonly rateLimitKey: string;
}
export const CreateOrderCommandType = 'CreateOrder' as const;

export interface ExecuteOrderCommand extends Command<ExecuteResult> {
  readonly type: 'ExecuteOrder';
  readonly requestId: RequestId;
  readonly signedTransaction: Base64Tx;
  readonly rateLimitKey: string;
}
export const ExecuteOrderCommandType = 'ExecuteOrder' as const;

/* ─────────── Queries ─────────── */

export interface GetOrderQuery extends Query<SwapOrder> {
  readonly type: 'GetOrder';
  readonly requestId: RequestId;
}
export const GetOrderQueryType = 'GetOrder' as const;

/* ─────────── Handlers ─────────── */

export class CreateOrderHandler implements CommandHandler<CreateOrderCommand, SwapOrder> {
  constructor(
    private readonly provider: SwapProvider,
    private readonly repo: OrderRepository,
    private readonly bus: EventBus,
    private readonly limiter: RateLimiter,
    private readonly logger: Logger,
  ) {}

  async handle(cmd: CreateOrderCommand): Promise<SwapOrder> {
    await this.limiter.consume(`order:${cmd.rateLimitKey}`);
    const result: Result<SwapOrder, DomainError> = await this.provider.createOrder(cmd.params);
    return match(result, {
      ok: async (order) => {
        await this.repo.save(order);
        ordersCreated.inc({
          input_mint: cmd.params.inputMint,
          output_mint: cmd.params.outputMint,
          status: order.status,
        });
        await this.bus.publish(makeEvent('OrderCreated', order));
        this.logger.info({ requestId: order.requestId }, 'order created');
        return order;
      },
      err: (e) => {
        this.logger.warn({ err: e.code, msg: e.message }, 'order creation failed');
        throw e;
      },
    });
  }
}

export class ExecuteOrderHandler implements CommandHandler<ExecuteOrderCommand, ExecuteResult> {
  constructor(
    private readonly provider: SwapProvider,
    private readonly repo: OrderRepository,
    private readonly bus: EventBus,
    private readonly limiter: RateLimiter,
    private readonly logger: Logger,
  ) {}

  async handle(cmd: ExecuteOrderCommand): Promise<ExecuteResult> {
    await this.limiter.consume(`execute:${cmd.rateLimitKey}`);
    const existing = await this.repo.findById(cmd.requestId);
    if (!existing) throw new NotFoundError(`Order ${cmd.requestId} not found`);

    await this.repo.save({ ...existing, status: 'AwaitingSignature' });
    await this.bus.publish(
      makeEvent('OrderStatusChanged', { requestId: cmd.requestId, status: 'AwaitingSignature' }),
    );

    const result = await this.provider.executeOrder({
      requestId: cmd.requestId,
      signedTransaction: cmd.signedTransaction,
    });

    return match(result, {
      ok: async (exec) => {
        await this.repo.save({ ...existing, status: exec.status });
        ordersExecuted.inc({ status: exec.status });
        await this.bus.publish(
          makeEvent('OrderStatusChanged', { requestId: cmd.requestId, status: exec.status }),
        );
        this.logger.info(
          { requestId: cmd.requestId, status: exec.status, signature: exec.signature },
          'order executed',
        );
        return exec;
      },
      err: async (e) => {
        // Saga compensation: mark order as Failed for audit + downstream consumers.
        await this.repo.save({ ...existing, status: 'Failed' });
        ordersExecuted.inc({ status: 'Failed' });
        await this.bus.publish(
          makeEvent('OrderStatusChanged', { requestId: cmd.requestId, status: 'Failed' }),
        );
        this.logger.error({ err: e.code, msg: e.message }, 'execute failed (compensated)');
        throw e;
      },
    });
  }
}

export class GetOrderHandler implements QueryHandler<GetOrderQuery, SwapOrder> {
  constructor(private readonly repo: OrderRepository) {}
  async handle(q: GetOrderQuery): Promise<SwapOrder> {
    const order = await this.repo.findById(q.requestId);
    if (!order) throw new NotFoundError(`Order ${q.requestId} not found`);
    return order;
  }
}

