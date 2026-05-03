import { CircuitBreaker } from '../infrastructure/http/circuitBreaker.js';
import { CircuitOpenError } from '../domain/errors.js';

describe('CircuitBreaker', () => {
  it('starts CLOSED and lets calls through', async () => {
    const cb = new CircuitBreaker({ errorThresholdPct: 50, windowSize: 4, resetMs: 100 });
    expect(cb.getState()).toBe('CLOSED');
    await expect(cb.execute(async () => 1)).resolves.toBe(1);
  });

  it('opens after exceeding error threshold', async () => {
    const cb = new CircuitBreaker({
      errorThresholdPct: 50, windowSize: 4, resetMs: 1000, minimumCalls: 4,
    });
    for (let i = 0; i < 4; i++) {
      await expect(cb.execute(async () => { throw new Error('x'); })).rejects.toThrow();
    }
    expect(cb.getState()).toBe('OPEN');
    await expect(cb.execute(async () => 1)).rejects.toBeInstanceOf(CircuitOpenError);
  });

  it('moves to HALF_OPEN after resetMs and closes on success', async () => {
    const cb = new CircuitBreaker({
      errorThresholdPct: 50, windowSize: 2, resetMs: 5, minimumCalls: 2,
    });
    await expect(cb.execute(async () => { throw new Error('x'); })).rejects.toThrow();
    await expect(cb.execute(async () => { throw new Error('x'); })).rejects.toThrow();
    expect(cb.getState()).toBe('OPEN');
    await new Promise((r) => setTimeout(r, 10));
    await expect(cb.execute(async () => 'ok')).resolves.toBe('ok');
    expect(cb.getState()).toBe('CLOSED');
  });
});

