import { buildServer } from '../server.js';
import { buildContainer } from '../container.js';
import {
  InMemoryOrderRepository, InProcessEventBus, MemoryRateLimiter, createLogger,
  ok, err, SlippageExceededError,
  base64Tx, bps, mintAddress, requestId,
  type SwapProvider,
} from '@jupiter-swap/core';
import { MockLLMProvider, SwapAssistantAgent } from '@jupiter-swap/agents';

const SOL = 'So11111111111111111111111111111111111111112';
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

function fakeContainer(provider: SwapProvider) {
  return buildContainer({
    env: {
      NODE_ENV: 'test', API_PORT: 0, LOG_LEVEL: 'error',
      SOLANA_RPC_URL: 'https://api.mainnet-beta.solana.com',
      JUPITER_BASE_URL: 'https://lite-api.jup.ag', JUPITER_TIMEOUT_MS: 5000, JUPITER_MAX_RETRIES: 0,
      RATE_LIMIT_POINTS: 1000, RATE_LIMIT_DURATION_SEC: 60,
      CIRCUIT_TIMEOUT_MS: 1000, CIRCUIT_ERROR_THRESHOLD_PCT: 50, CIRCUIT_RESET_MS: 1000,
      LLM_PROVIDER: 'mock', OPENAI_MODEL: 'gpt-4o-mini',
    },
    logger: createLogger('error'),
    bus: new InProcessEventBus(),
    repo: new InMemoryOrderRepository(),
    limiter: new MemoryRateLimiter({ points: 1000, durationSec: 60 }),
    provider,
    assistant: new SwapAssistantAgent(new MockLLMProvider()),
    llm: new MockLLMProvider(),
  });
}

async function gql(app: import('fastify').FastifyInstance, query: string, variables?: unknown) {
  const res = await app.inject({
    method: 'POST', url: '/graphql',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ query, variables }),
  });
  return JSON.parse(res.body);
}

describe('GraphQL API', () => {
  it('health query works', async () => {
    const stub: SwapProvider = {
      async createOrder() { return ok({} as never); },
      async executeOrder() { return ok({ status: 'Success' }); },
    };
    const { app } = await buildServer({ container: fakeContainer(stub) });
    const body = await gql(app, '{ health { status version uptimeMs } }');
    expect(body.data.health.status).toBe('ok');
    await app.close();
  });

  it('createOrder happy path', async () => {
    const sample = {
      requestId: requestId('r1'),
      transaction: base64Tx('YWJj'),
      inputMint: mintAddress(SOL),
      outputMint: mintAddress(USDC),
      inAmount: '1000', outAmount: '900', otherAmountThreshold: '880',
      swapMode: 'ExactIn' as const,
      slippageBps: bps(50),
      priceImpactPct: 0.01, routePlan: [],
      status: 'Created' as const,
    };
    const stub: SwapProvider = {
      async createOrder() { return ok(sample); },
      async executeOrder() { return ok({ status: 'Success', signature: 'sig' }); },
    };
    const { app } = await buildServer({ container: fakeContainer(stub) });
    const body = await gql(
      app,
      `mutation($i: CreateOrderInput!) { createOrder(input: $i) { requestId status outAmount } }`,
      { i: { inputMint: SOL, outputMint: USDC, amount: '1000', slippageBps: 50 } },
    );
    expect(body.errors).toBeUndefined();
    expect(body.data.createOrder.requestId).toBe('r1');
    await app.close();
  });

  it('returns typed error code on slippage failure', async () => {
    const stub: SwapProvider = {
      async createOrder() { return err(new SlippageExceededError('slip')); },
      async executeOrder() { return ok({ status: 'Success' }); },
    };
    const { app } = await buildServer({ container: fakeContainer(stub) });
    const body = await gql(
      app,
      `mutation($i: CreateOrderInput!) { createOrder(input: $i) { requestId } }`,
      { i: { inputMint: SOL, outputMint: USDC, amount: '1000' } },
    );
    expect(body.errors[0].extensions.code).toBe('SLIPPAGE_EXCEEDED');
    await app.close();
  });

  it('askAssistant parses swap intent', async () => {
    const stub: SwapProvider = {
      async createOrder() { return ok({} as never); },
      async executeOrder() { return ok({ status: 'Success' }); },
    };
    const { app } = await buildServer({ container: fakeContainer(stub) });
    const body = await gql(
      app,
      `mutation { askAssistant(prompt: "swap 0.1 SOL to USDC") { message parsedOrder { inputMint outputMint amount slippageBps } } }`,
    );
    expect(body.data.askAssistant.parsedOrder.inputMint).toContain('So11');
    await app.close();
  });
});

