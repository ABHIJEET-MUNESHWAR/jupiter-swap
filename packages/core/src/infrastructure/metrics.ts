import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const ordersCreated = new Counter({
  name: 'orders_created_total',
  help: 'Total swap orders created',
  labelNames: ['input_mint', 'output_mint', 'status'] as const,
  registers: [registry],
});

export const ordersExecuted = new Counter({
  name: 'orders_executed_total',
  help: 'Total swap orders executed',
  labelNames: ['status'] as const,
  registers: [registry],
});

export const upstreamLatency = new Histogram({
  name: 'jupiter_upstream_latency_ms',
  help: 'Latency of Jupiter Ultra calls (ms)',
  labelNames: ['endpoint', 'outcome'] as const,
  buckets: [25, 50, 100, 250, 500, 1000, 2500, 5000, 10_000, 15_000],
  registers: [registry],
});

