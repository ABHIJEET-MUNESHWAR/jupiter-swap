import {
  CreateOrderHandler,
  ExecuteOrderHandler,
  GetOrderHandler,
  type CreateOrderCommand,
  type ExecuteOrderCommand,
  type GetOrderQuery,
} from '../application/handlers.js';
import { InMemoryOrderRepository } from '../infrastructure/persistence/inMemoryOrderRepository.js';
import { InProcessEventBus } from '../infrastructure/eventBus.js';
import type { Logger, RateLimiter, SwapProvider } from '../domain/ports.js';
import { ok, err } from '../domain/types/result.js';
import { base64Tx, mintAddress, requestId, type RequestId } from '../domain/types/brand.js';
import { NotFoundError, SlippageExceededError } from '../domain/errors.js';
import type { SwapOrder } from '../domain/entities.js';

const noopLogger: Logger = {
  info() {}, warn() {}, error() {}, debug() {},
  child() { return noopLogger; },
};
const noopLimiter: RateLimiter = { async consume() {} };

const SOL = 'So11111111111111111111111111111111111111112';
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

const sample: SwapOrder = {
  requestId: requestId('r1'),
  transaction: base64Tx('YWJj'),
  inputMint: mintAddress(SOL),
  outputMint: mintAddress(USDC),
  inAmount: '1', outAmount: '1', otherAmountThreshold: '1',
  swapMode: 'ExactIn',
  slippageBps: 50 as never,
  priceImpactPct: 0,
  routePlan: [],
  status: 'Created',
};

describe('CreateOrderHandler', () => {
  it('persists, emits OrderCreated, returns order', async () => {
    const repo = new InMemoryOrderRepository();
    const bus = new InProcessEventBus();
    let received = 0;
    bus.subscribe('OrderCreated', () => { received++; });

    const provider: SwapProvider = {
      async createOrder() { return ok(sample); },
      async executeOrder() { return ok({ status: 'Success' }); },
    };
    const h = new CreateOrderHandler(provider, repo, bus, noopLimiter, noopLogger);

    const cmd: CreateOrderCommand = {
      type: 'CreateOrder', rateLimitKey: 'k',
      params: { inputMint: mintAddress(SOL), outputMint: mintAddress(USDC), amount: '1' },
    };
    const out = await h.handle(cmd);
    expect(out.requestId).toBe('r1');
    expect(repo.size()).toBe(1);
    // event delivery is async via Promise.allSettled
    await new Promise((r) => setImmediate(r));
    expect(received).toBe(1);
  });

  it('throws domain errors from the provider', async () => {
    const provider: SwapProvider = {
      async createOrder() { return err(new SlippageExceededError('nope')); },
      async executeOrder() { return ok({ status: 'Success' }); },
    };
    const h = new CreateOrderHandler(
      provider, new InMemoryOrderRepository(), new InProcessEventBus(), noopLimiter, noopLogger,
    );
    await expect(
      h.handle({
        type: 'CreateOrder', rateLimitKey: 'k',
        params: { inputMint: mintAddress(SOL), outputMint: mintAddress(USDC), amount: '1' },
      }),
    ).rejects.toBeInstanceOf(SlippageExceededError);
  });
});

describe('ExecuteOrderHandler', () => {
  it('executes & marks success', async () => {
    const repo = new InMemoryOrderRepository();
    await repo.save(sample);
    const provider: SwapProvider = {
      async createOrder() { return ok(sample); },
      async executeOrder() { return ok({ status: 'Success', signature: 'sig' }); },
    };
    const h = new ExecuteOrderHandler(provider, repo, new InProcessEventBus(), noopLimiter, noopLogger);
    const cmd: ExecuteOrderCommand = {
      type: 'ExecuteOrder',
      requestId: requestId('r1'),
      signedTransaction: base64Tx('YWJj'),
      rateLimitKey: 'k',
    };
    const out = await h.handle(cmd);
    expect(out.status).toBe('Success');
    expect((await repo.findById(requestId('r1') as RequestId))!.status).toBe('Success');
  });

  it('compensates by marking Failed when provider errors', async () => {
    const repo = new InMemoryOrderRepository();
    await repo.save(sample);
    const provider: SwapProvider = {
      async createOrder() { return ok(sample); },
      async executeOrder() { return err(new SlippageExceededError('slip')); },
    };
    const h = new ExecuteOrderHandler(provider, repo, new InProcessEventBus(), noopLimiter, noopLogger);
    await expect(
      h.handle({
        type: 'ExecuteOrder',
        requestId: requestId('r1'),
        signedTransaction: base64Tx('YWJj'),
        rateLimitKey: 'k',
      }),
    ).rejects.toBeInstanceOf(SlippageExceededError);
    expect((await repo.findById(requestId('r1') as RequestId))!.status).toBe('Failed');
  });

  it('throws NotFound when order does not exist', async () => {
    const provider: SwapProvider = {
      async createOrder() { return ok(sample); },
      async executeOrder() { return ok({ status: 'Success' }); },
    };
    const h = new ExecuteOrderHandler(
      provider, new InMemoryOrderRepository(), new InProcessEventBus(), noopLimiter, noopLogger,
    );
    await expect(
      h.handle({
        type: 'ExecuteOrder',
        requestId: requestId('missing'),
        signedTransaction: base64Tx('YWJj'),
        rateLimitKey: 'k',
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('GetOrderHandler', () => {
  it('returns saved order', async () => {
    const repo = new InMemoryOrderRepository();
    await repo.save(sample);
    const h = new GetOrderHandler(repo);
    const q: GetOrderQuery = { type: 'GetOrder', requestId: requestId('r1') };
    expect((await h.handle(q)).requestId).toBe('r1');
  });
  it('throws NotFound', async () => {
    const h = new GetOrderHandler(new InMemoryOrderRepository());
    await expect(
      h.handle({ type: 'GetOrder', requestId: requestId('missing') }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

