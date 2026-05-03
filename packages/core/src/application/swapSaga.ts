/**
 * SwapSaga — orchestrates the order → user-signs → execute flow.
 *
 * The saga is intentionally lightweight (in-process, no external orchestrator)
 * because the user-sign step happens client-side and the server is the
 * coordinator only for `create` and `execute`. Compensation logic for
 * `execute` failures lives in {@link ExecuteOrderHandler}.
 *
 * For multi-node durability the same state machine can be persisted to
 * Postgres or driven by Temporal/Inngest behind the same interface.
 */
import type { ExecuteResult, OrderStatus, SwapOrder } from '../domain/entities.js';
import { assertNever } from '../domain/types/brand.js';

export type SagaState =
  | { kind: 'Created'; order: SwapOrder }
  | { kind: 'AwaitingSignature'; order: SwapOrder }
  | { kind: 'Submitted'; order: SwapOrder }
  | { kind: 'Done'; order: SwapOrder; result: ExecuteResult }
  | { kind: 'Compensated'; order: SwapOrder; reason: string };

export type SagaEvent =
  | { kind: 'AwaitSignature' }
  | { kind: 'Submit' }
  | { kind: 'Succeed'; result: ExecuteResult }
  | { kind: 'Fail'; reason: string };

/** Pure transition function — easily unit-tested. */
export function transition(state: SagaState, event: SagaEvent): SagaState {
  switch (event.kind) {
    case 'AwaitSignature':
      if (state.kind !== 'Created') return state;
      return { kind: 'AwaitingSignature', order: state.order };
    case 'Submit':
      if (state.kind !== 'AwaitingSignature') return state;
      return { kind: 'Submitted', order: state.order };
    case 'Succeed':
      if (state.kind !== 'Submitted') return state;
      return { kind: 'Done', order: state.order, result: event.result };
    case 'Fail':
      return { kind: 'Compensated', order: state.order, reason: event.reason };
    default:
      return assertNever(event);
  }
}

export function statusOf(state: SagaState): OrderStatus {
  switch (state.kind) {
    case 'Created': return 'Created';
    case 'AwaitingSignature': return 'AwaitingSignature';
    case 'Submitted': return 'Submitted';
    case 'Done': return state.result.status;
    case 'Compensated': return 'Failed';
    default: return assertNever(state);
  }
}

