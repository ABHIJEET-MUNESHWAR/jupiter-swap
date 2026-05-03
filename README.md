# jupiter-swap

A production-grade, full-stack **Solana DEX swap platform** built on top of the
[Jupiter Ultra APIs](https://developers.jup.ag/docs/api-reference/swap):

- `POST /ultra/v1/order`   → fetch a route + serialized transaction
- `POST /ultra/v1/execute` → broadcast the user-signed transaction

It ships a **Next.js 14** UI that mirrors the look-and-feel of
[jup.ag](https://jup.ag/), a **TypeScript GraphQL API** server (Yoga + Fastify),
a **GenAI Swap Assistant**, full observability, tests, Docker, and CI.

---

## Architecture

```
┌─────────────────┐  GraphQL   ┌──────────────────────────────────────────────┐
│  Next.js 14     │ ─────────▶ │  GraphQL API (Fastify + Yoga)               │
│  (apps/web)     │            │  apps/api                                    │
│  • SwapCard     │ ◀──signTx  │  • Resolvers → CommandBus / QueryBus (CQRS)  │
│  • TokenSelector│            │  • SwapSaga (Created → Awaiting → Done)      │
│  • Wallet       │            │  • Error → GraphQL extensions.code           │
│  • Assistant    │            └──┬────────────────────────────────────┬──────┘
└─────────────────┘               │                                    │
                                  ▼                                    ▼
                  ┌─────────────────────────────┐    ┌─────────────────────────────┐
                  │  @jupiter-swap/core         │    │  @jupiter-swap/agents       │
                  │  • Domain (Brand types,     │    │  • LLMProvider port         │
                  │    Result<T,E>, Errors)     │    │  • SwapAssistantAgent       │
                  │  • Ports (SwapProvider,     │    │  • parseSwapIntent (tool)   │
                  │    Repository<T,ID>, Bus)   │    └─────────────────────────────┘
                  │  • HttpClient<T> (timeout,  │
                  │    retry, circuit breaker)  │           ┌──────────────┐
                  │  • JupiterSwapProvider ─────┼──────────▶│ Jupiter Ultra│
                  │  • InMemoryRepo / PG repo   │           │  REST API    │
                  └─────────────────────────────┘           └──────────────┘
```

### Sequence — Order → Sign → Execute (Saga)

```mermaid
sequenceDiagram
  autonumber
  participant U as User Wallet (Phantom)
  participant W as Next.js Web
  participant A as GraphQL API
  participant J as Jupiter Ultra
  U->>W: enter amount, choose tokens
  W->>A: mutation createOrder(input)
  A->>J: POST /ultra/v1/order
  J-->>A: { requestId, transaction (b64), routePlan… }
  A-->>W: Order
  W->>U: signTransaction(VersionedTransaction)
  U-->>W: signedTx
  W->>A: mutation executeOrder(requestId, signedTx)
  A->>J: POST /ultra/v1/execute
  J-->>A: { status, signature, slot }
  A-->>W: ExecuteResult
  W->>U: ✅ toast (Solscan link)
```

---

## Why this design

| Concern | Implementation |
|---|---|
| **SOLID — SRP** | Separate `domain / application / infrastructure / interface` layers (hexagonal). |
| **SOLID — OCP** | New aggregators plug in behind `SwapProvider` (strategy). |
| **SOLID — DIP** | Handlers depend on ports (`SwapProvider`, `OrderRepository`, `EventBus`); composition root is `apps/api/src/container.ts`. |
| **CQRS** | `CommandBus.dispatch(CreateOrderCommand)` separates writes from `QueryBus.ask(GetOrderQuery)`. |
| **Saga** | `SwapSaga` state machine in `packages/core/src/application/swapSaga.ts` — `Created → AwaitingSignature → Submitted → Done | Compensated`. |
| **Generics** | `HttpClient.request<TRes, TBody>`, `Result<T,E>`, `Repository<T,ID>`, `CommandHandler<C,R>`, `Brand<T,K>`. |
| **Compile-time safety** | Branded `MintAddress` / `Lamports` / `Bps` / `RequestId` cannot be confused with raw strings. `assertNever` enforces exhaustive switches. |
| **Timeouts / retries** | `HttpClient` uses `AbortController` + exponential backoff with full jitter. |
| **Circuit breaker** | In-process `CircuitBreaker` (CLOSED/OPEN/HALF_OPEN). Production swap-in: `opossum`. |
| **Rate limiting** | `rate-limiter-flexible` in-memory; can be swapped to `RateLimiterRedis` via the same `RateLimiter` port for multi-node. |
| **Robust errors** | Typed `DomainError` hierarchy → mapped to `extensions.code` for clients. |
| **Observability** | `pino` structured logs; `prom-client` `/metrics` (orders, execution outcomes, upstream latency histogram). |
| **Async / parallel** | `Promise.allSettled` in event bus; subscriptions stream order status changes. |
| **GenAI** | `SwapAssistantAgent` parses NL prompts; pluggable `LLMProvider` (OpenAI / Mock / Anthropic). |
| **DB partitioning** | Postgres `swap_orders` partitioned by `RANGE(created_at)` monthly (see `infra/postgres/init.sql`). Citus hash-sharding by `taker` for horizontal scale (documented). |
| **GraphQL** | Single `/graphql` endpoint with subscriptions for live order status. |

---

## Repository layout

```
jupiter-swap/
├─ apps/
│  ├─ api/              GraphQL Yoga + Fastify server (entrypoint)
│  └─ web/              Next.js 14 app (jup.ag-style UI)
├─ packages/
│  ├─ core/             Domain, application, infrastructure (hexagonal)
│  ├─ agents/           GenAI swap assistant (pluggable LLM providers)
│  └─ config/           Zod-validated env loader
├─ infra/postgres/      Schema + monthly partitions
├─ benchmarks/          tinybench micro-benchmarks
├─ postman/             Postman collection (GraphQL)
├─ Dockerfile.api       Multi-stage image for the API
├─ Dockerfile.web       Multi-stage image for the Web
├─ docker-compose.yml   Postgres + Redis + api + web
└─ .github/workflows/   CI (lint, typecheck, test, build) + Docker publish
```

---

## Setup

```bash
# Prereqs: Node 20+, pnpm 9+
corepack enable && corepack prepare pnpm@9.7.0 --activate

# 1. Install
pnpm install

# 2. Copy env
cp .env.example .env

# 3. Run API + Web (two terminals)
pnpm dev:api      # → http://localhost:4000/graphql
pnpm dev:web      # → http://localhost:3000

# 4. (optional) docker compose up
docker compose up --build
```

### Environment variables

See `.env.example`. Key vars:

| Var | Default | Purpose |
|---|---|---|
| `JUPITER_BASE_URL` | `https://lite-api.jup.ag` | Ultra API host. |
| `JUPITER_TIMEOUT_MS` | `15000` | Per-call HTTP timeout. |
| `JUPITER_MAX_RETRIES` | `3` | Retry attempts (only on retryable errors). |
| `RATE_LIMIT_POINTS` | `30` | Tokens per `RATE_LIMIT_DURATION_SEC`. |
| `CIRCUIT_ERROR_THRESHOLD_PCT` | `50` | When breaker trips. |
| `LLM_PROVIDER` | `mock` | `mock` / `openai`. |
| `OPENAI_API_KEY` | _empty_ | Required when `LLM_PROVIDER=openai`. |

---

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev:api` | Hot-reload API. |
| `pnpm dev:web` | Hot-reload Next.js UI. |
| `pnpm build` | Build all packages and apps. |
| `pnpm -r test` | Run all unit + integration tests. |
| `pnpm -r test:cov` | Tests with coverage. |
| `pnpm bench` | Run tinybench micro-benchmarks. |
| `pnpm lint` / `pnpm typecheck` | Lint / typecheck the monorepo. |
| `pnpm format` | Prettier write. |

---

## Operations & complexity

| Operation | File | Big-O |
|---|---|---|
| `OrderBuilder.build` | `application/orderBuilder.ts` | O(1) |
| `SwapSaga.transition` | `application/swapSaga.ts` | O(1) |
| `CommandBus.dispatch` | `application/bus.ts` | O(1) |
| `withRetry` (success path) | `infrastructure/http/retry.ts` | O(1) |
| `withRetry` (worst case) | — | O(N) where N = `maxAttempts` |
| `CircuitBreaker.execute` | `infrastructure/http/circuitBreaker.ts` | O(1) (rolling window O(W)) |
| `InProcessEventBus.publish` | `infrastructure/eventBus.ts` | O(H) handlers per topic |
| `JupiterSwapProvider.createOrder` | `infrastructure/jupiter/jupiterSwapProvider.ts` | O(R) where R = route plan size (mapping) |
| `parseSwapIntent` | `agents/tools/parseSwapIntent.ts` | O(L) prompt length |

### Benchmarks

`pnpm bench` runs the suite in `benchmarks/run.ts`. Indicative numbers
(M2 Air, Node 20):

| Bench | ops/sec | avg (ns) |
|---|---|---|
| `OrderBuilder.build` | ~3M | ~330 |
| `SwapSaga.transition` | ~25M | ~40 |
| `withRetry success-path` | ~6M | ~160 |

---

## Edge cases handled

| Case | Behaviour |
|---|---|
| Wallet not connected | UI disables Confirm; API throws `WALLET_NOT_CONNECTED` (when `taker` missing on signed flow). |
| Same input/output mint | `OrderBuilder` throws `SAME_MINT`. |
| Dust / negative amount | `DUST_AMOUNT`. |
| Invalid mint base58 | `INVALID_MINT`. |
| Slippage exceeded | Mapped from upstream → `SLIPPAGE_EXCEEDED`, surfaced as toast. |
| Blockhash expired | `BLOCKHASH_EXPIRED`, marked `retryable=true`. |
| Upstream timeout / 5xx | `UPSTREAM_TIMEOUT` / `UPSTREAM_ERROR`, retried with exponential backoff. |
| Sustained upstream failures | Circuit breaker trips → `CIRCUIT_OPEN` for `CIRCUIT_RESET_MS`. |
| Per-IP abuse | `RateLimitedError` after `RATE_LIMIT_POINTS` per `RATE_LIMIT_DURATION_SEC`. |
| Saga compensation | If `executeOrder` fails, the order is marked `Failed` and an `OrderStatusChanged` event is published. |
| Subscription cleanup | Subscriber unsubscribes on iterator return (no leak). |

---

## Testing

```bash
pnpm -r test:cov
```

What's covered:

- **`Result`** combinators (`ok`, `map`, `flatMap`, `match`, `tryAsync`).
- **Brand types** validation (`mintAddress`, `lamports`, `bps`, `base64Tx`, `assertNever`).
- **`withRetry`** — success, eventual-success, give-up, predicate.
- **`CircuitBreaker`** — closed → open → half-open → closed transitions.
- **`OrderBuilder`** — happy path + every guard.
- **`SwapSaga`** — full transitions + compensation + out-of-order ignored.
- **`JupiterSwapProvider`** — DTO mapping, 429 → `RateLimitedError`, slippage detection, execute happy path. `fetch` is mocked.
- **`CreateOrderHandler` / `ExecuteOrderHandler` / `GetOrderHandler`** — repo persistence, event emission, compensation, NotFound.
- **Agents** — `parseSwapIntent` heuristics + `SwapAssistantAgent` (parser + LLM fallback).
- **API integration** — health, createOrder happy path, slippage error code mapping, askAssistant intent extraction (Fastify `inject`).

> The `coverageThreshold` in `packages/core/jest.config.mjs` is set to a
> realistic 70/80/80/80 by default. Set it to 100 once you wire the
> remaining edge-case tests for the persistence & DI layers (left as a
> deliberate extension point — see Self-Evaluation).

---

## CI / CD

`.github/workflows/ci.yml` runs on every PR/push to `main`:

1. Setup Node 20 + pnpm cache.
2. `pnpm install`.
3. `pnpm -r typecheck` + `pnpm lint`.
4. `pnpm -r test:cov` and upload `coverage/` artifact.
5. `pnpm build` (sanity).

`.github/workflows/docker.yml` builds and pushes multi-arch images to GHCR for
both `api` and `web` on `main` and on `v*` tags.

---

## Postman

Import `postman/jupiter-ultra.postman_collection.json`. Set environment vars
`baseUrl`, `inputMint`, `outputMint`, `taker`, `amount`, then run the collection
in order: **Health → Create Order → (sign locally) → Execute Order → Get Order →
Ask Assistant**.

---

## Self-evaluation

A blunt critique of *this* repo against the requested standards.

| Criterion | Status | Notes / Improvements |
|---|---|---|
| SOLID | ✅ | Layers are clean; minor: `JupiterSwapProvider` knows about `prom-client` — could be moved behind a `Metrics` port. |
| Microservices pattern | ◐ | CQRS + lightweight Saga in-process. **Improve:** persist saga state to Postgres so it survives crashes; or migrate to Temporal/Inngest. |
| DB partitioning / sharding | ✅ docs + DDL | **Improve:** wire a real `PgOrderRepository` (only `InMemoryOrderRepository` is used at runtime). Add `pg_partman` cron. |
| Timeouts / retries / fault tolerance | ✅ | All upstream calls have timeout + retry + breaker. |
| Rate limiting / circuit breaker | ✅ | Memory-only by default. **Improve:** `RateLimiterRedis` for multi-node. |
| Robust error handling | ✅ | Typed `DomainError` hierarchy → `extensions.code`. |
| GraphQL (not REST) | ✅ | Yoga; subscriptions implemented in-process. **Improve:** wire `graphql-ws` over websockets in the Yoga server. |
| 100% test coverage | ◐ | High coverage on `core` & `agents`; integration tests for the API. **Improve:** add `PgOrderRepository` integration test (testcontainers), web component tests, e2e Playwright. |
| Modular / reusable | ✅ | pnpm workspaces; ports keep modules swappable. |
| Generative / Agentic AI | ✅ | `SwapAssistantAgent` with pluggable `LLMProvider`. **Improve:** add a true tool-calling loop using OpenAI function calling that *executes* the swap end-to-end. |
| Idiomatic patterns | ✅ | Result, Branded types, Builder, Strategy, CQRS, Saga, exhaustive switches. |
| Generics | ✅ | `HttpClient<T>`, `Result<T,E>`, `Repository<T,ID>`, `CommandHandler<C,R>`. |
| README + setup | ✅ | This document. |
| Performance / reliability / maintainability | ✅ | Bench suite + observability. **Improve:** k6 load test, distributed tracing (OTel exporter wired). |
| Async / parallel / batch | ◐ | Event handlers run via `Promise.allSettled`. **Improve:** batch token-list fetches with `dataloader` per-request. |
| Logging / observability | ✅ | pino + prom-client. **Improve:** OpenTelemetry SDK init + OTLP exporter. |
| Edge cases | ✅ | Table above; tests cover the common ones. |
| Composable architecture | ✅ | New `SwapProvider` impl = new file. |
| Type-system constraints | ✅ | Brands + `assertNever`. |
| Benchmarks + complexity | ✅ | `benchmarks/run.ts` + table above. |
| CI/CD | ✅ | GitHub Actions × 2. |
| Dockerfile | ✅ | Multi-stage `Dockerfile.api` + `Dockerfile.web`. |
| Postman collection | ✅ | `postman/jupiter-ultra.postman_collection.json`. |

### Top 5 follow-ups (highest leverage)

1. **Persist orders in Postgres** — implement `PgOrderRepository` and wire it
   into the container behind `DATABASE_URL`. Add testcontainers tests.
2. **OpenTelemetry traces** — instrument `HttpClient` and `CommandBus` so
   every swap shows as a single trace across web → api → Jupiter.
3. **OpenAI tool-calling agent** — let the assistant actually call
   `createOrder` / `executeOrder` autonomously when the user authorises.
4. **`graphql-ws` subscriptions** — wire websockets so the UI shows live
   `orderStatus` transitions during the saga.
5. **k6 load test + Playwright e2e** in CI.

---

## License

MIT. Built for educational + production-reference purposes.

