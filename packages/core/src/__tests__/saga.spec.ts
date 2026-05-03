import { transition, statusOf, type SagaState } from '../application/swapSaga.js';
import type { SwapOrder } from '../domain/entities.js';

const order = { requestId: 'r1', status: 'Created' } as unknown as SwapOrder;

describe('SwapSaga', () => {
  it('Created → AwaitingSignature → Submitted → Done(Success)', () => {
    let s: SagaState = { kind: 'Created', order };
    s = transition(s, { kind: 'AwaitSignature' });
    expect(s.kind).toBe('AwaitingSignature');
    s = transition(s, { kind: 'Submit' });
    expect(s.kind).toBe('Submitted');
    s = transition(s, { kind: 'Succeed', result: { status: 'Success' } });
    expect(s.kind).toBe('Done');
    expect(statusOf(s)).toBe('Success');
  });

  it('compensates on Fail', () => {
    const s = transition({ kind: 'Submitted', order }, { kind: 'Fail', reason: 'rpc' });
    expect(s.kind).toBe('Compensated');
    expect(statusOf(s)).toBe('Failed');
  });

  it('ignores out-of-order events', () => {
    const s = transition({ kind: 'Created', order }, { kind: 'Submit' });
    expect(s.kind).toBe('Created');
  });
});

