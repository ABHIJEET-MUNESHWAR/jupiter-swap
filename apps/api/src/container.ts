import {
  CommandBus, QueryBus, CreateOrderHandler, ExecuteOrderHandler, GetOrderHandler,
  HttpClient, CircuitBreaker, JupiterUltraClient, JupiterSwapProvider,
  InMemoryOrderRepository, InProcessEventBus, MemoryRateLimiter, createLogger,
  type SwapProvider, type OrderRepository, type EventBus, type RateLimiter, type Logger,
} from '@jupiter-swap/core';
import { loadEnv } from '@jupiter-swap/config';
import {
  MockLLMProvider, OpenAIProvider, SwapAssistantAgent, type LLMProvider,
} from '@jupiter-swap/agents';

export interface Container {
  env: ReturnType<typeof loadEnv>;
  logger: Logger;
  bus: EventBus;
  repo: OrderRepository;
  limiter: RateLimiter;
  provider: SwapProvider;
  commandBus: CommandBus;
  queryBus: QueryBus;
  assistant: SwapAssistantAgent;
  llm: LLMProvider;
}

/** Composition root — explicit DI. Avoids decorator-based magic so the
 *  dependency graph is greppable and trivially mockable from tests. */
export function buildContainer(overrides: Partial<Container> = {}): Container {
  const env = overrides.env ?? loadEnv();
  const logger = overrides.logger ?? createLogger(env.LOG_LEVEL);
  const bus = overrides.bus ?? new InProcessEventBus();
  const repo = overrides.repo ?? new InMemoryOrderRepository();
  const limiter =
    overrides.limiter ??
    new MemoryRateLimiter({
      points: env.RATE_LIMIT_POINTS,
      durationSec: env.RATE_LIMIT_DURATION_SEC,
    });

  const breaker = new CircuitBreaker({
    errorThresholdPct: env.CIRCUIT_ERROR_THRESHOLD_PCT,
    windowSize: 20,
    resetMs: env.CIRCUIT_RESET_MS,
  });
  const http = new HttpClient({
    baseUrl: env.JUPITER_BASE_URL,
    timeoutMs: env.JUPITER_TIMEOUT_MS,
    maxRetries: env.JUPITER_MAX_RETRIES,
    breaker,
    logger: logger.child({ component: 'http' }),
    defaultHeaders: env.JUPITER_API_KEY ? { 'x-api-key': env.JUPITER_API_KEY } : {},
  });
  const provider = overrides.provider ?? new JupiterSwapProvider(new JupiterUltraClient(http));

  const commandBus = overrides.commandBus ?? new CommandBus();
  const queryBus = overrides.queryBus ?? new QueryBus();

  commandBus.register('CreateOrder', new CreateOrderHandler(provider, repo, bus, limiter, logger));
  commandBus.register('ExecuteOrder', new ExecuteOrderHandler(provider, repo, bus, limiter, logger));
  queryBus.register('GetOrder', new GetOrderHandler(repo));

  const llm =
    overrides.llm ??
    (env.LLM_PROVIDER === 'openai' && env.OPENAI_API_KEY
      ? new OpenAIProvider(env.OPENAI_API_KEY, env.OPENAI_MODEL)
      : new MockLLMProvider());
  const assistant = overrides.assistant ?? new SwapAssistantAgent(llm);

  return { env, logger, bus, repo, limiter, provider, commandBus, queryBus, assistant, llm };
}

