import { Bench } from 'tinybench';
import { OrderBuilder, transition, withRetry } from '../packages/core/src/index.js';

/**
 * Micro-benchmarks for hot paths.
 *
 * Run: `pnpm bench`
 *
 * Big-O reminder:
 *   OrderBuilder.build      → O(1)
 *   saga.transition         → O(1)
 *   withRetry (success)     → O(1) (one call, no sleeps)
 */
const SOL = 'So11111111111111111111111111111111111111112';
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

const bench = new Bench({ time: 500 });

bench
  .add('OrderBuilder.build', () => {
    OrderBuilder.create()
      .from(SOL).to(USDC).withAmount('10000000').withSlippageBps(50).build();
  })
  .add('SwapSaga.transition', () => {
    const s = { kind: 'Created' as const, order: { requestId: 'r' } as never };
    transition(s, { kind: 'AwaitSignature' });
  })
  .add('withRetry success-path', async () => {
    await withRetry(async () => 1, { maxAttempts: 3, baseMs: 1, capMs: 1, sleep: async () => {} });
  });

await bench.run();

// eslint-disable-next-line no-console
console.table(
  bench.tasks.map((t) => ({
    name: t.name,
    'ops/sec': Math.round(t.result?.hz ?? 0).toLocaleString(),
    'avg (ns)': Math.round((t.result?.mean ?? 0) * 1e6),
    samples: t.result?.samples.length ?? 0,
  })),
);

