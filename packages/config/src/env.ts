import 'dotenv/config';
import { z } from 'zod';

/**
 * Zod-validated environment loader. Fails fast on bad config (12-factor).
 *
 * Time complexity: O(k) where k = number of env vars (constant in practice).
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  SOLANA_RPC_URL: z.string().url().default('https://api.mainnet-beta.solana.com'),

  JUPITER_BASE_URL: z.string().url().default('https://lite-api.jup.ag'),
  JUPITER_API_KEY: z.string().optional(),
  JUPITER_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  JUPITER_MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(3),

  RATE_LIMIT_POINTS: z.coerce.number().int().positive().default(30),
  RATE_LIMIT_DURATION_SEC: z.coerce.number().int().positive().default(60),
  CIRCUIT_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  CIRCUIT_ERROR_THRESHOLD_PCT: z.coerce.number().min(1).max(100).default(50),
  CIRCUIT_RESET_MS: z.coerce.number().int().positive().default(30_000),

  REDIS_URL: z.string().url().optional(),
  DATABASE_URL: z.string().optional(),

  LLM_PROVIDER: z.enum(['openai', 'anthropic', 'mock']).default('mock'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
});

export type AppEnv = z.infer<typeof EnvSchema>;

let cached: AppEnv | undefined;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('❌ Invalid environment:', parsed.error.flatten().fieldErrors);
    throw new Error('Environment validation failed');
  }
  cached = parsed.data;
  return cached;
}

/** Test helper — clears the memoized env. */
export function _resetEnvForTests(): void {
  cached = undefined;
}

