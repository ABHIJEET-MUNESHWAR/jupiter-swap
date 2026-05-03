import { withRetry } from '../infrastructure/http/retry.js';

describe('withRetry', () => {
  it('returns immediately on success', async () => {
    let calls = 0;
    const out = await withRetry(async () => { calls++; return 42; }, {
      maxAttempts: 3, baseMs: 1, capMs: 10, sleep: async () => {},
    });
    expect(out).toBe(42);
    expect(calls).toBe(1);
  });

  it('retries until success', async () => {
    let calls = 0;
    const out = await withRetry(async () => {
      calls++;
      if (calls < 3) throw new Error('fail');
      return 'ok';
    }, { maxAttempts: 5, baseMs: 1, capMs: 10, sleep: async () => {} });
    expect(out).toBe('ok');
    expect(calls).toBe(3);
  });

  it('gives up after maxAttempts', async () => {
    let calls = 0;
    await expect(
      withRetry(async () => { calls++; throw new Error('boom'); }, {
        maxAttempts: 3, baseMs: 1, capMs: 10, sleep: async () => {},
      }),
    ).rejects.toThrow('boom');
    expect(calls).toBe(3);
  });

  it('respects shouldRetry predicate', async () => {
    let calls = 0;
    await expect(
      withRetry(async () => { calls++; throw new Error('nope'); }, {
        maxAttempts: 5, baseMs: 1, capMs: 10, shouldRetry: () => false, sleep: async () => {},
      }),
    ).rejects.toThrow();
    expect(calls).toBe(1);
  });
});

