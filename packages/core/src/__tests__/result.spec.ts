import { ok, err, isOk, isErr, map, flatMap, match, tryAsync } from '../domain/types/result.js';

describe('Result', () => {
  it('ok wraps a value', () => {
    const r = ok(42);
    expect(isOk(r)).toBe(true);
    expect(isErr(r)).toBe(false);
    if (r.ok) expect(r.value).toBe(42);
  });

  it('map transforms only on ok', () => {
    expect(map(ok(2), (n) => n * 3)).toEqual(ok(6));
    expect(map(err('e'), (n: number) => n * 3)).toEqual(err('e'));
  });

  it('flatMap chains', () => {
    const r = flatMap(ok(2), (n) => (n > 0 ? ok(n + 1) : err('neg')));
    expect(r).toEqual(ok(3));
  });

  it('match exhaustively handles variants', () => {
    expect(match(ok(1), { ok: (v) => `v${v}`, err: () => 'e' })).toBe('v1');
    expect(match(err('boom'), { ok: () => 'v', err: (e) => `e${e}` })).toBe('eboom');
  });

  it('tryAsync wraps thrown errors', async () => {
    const r = await tryAsync(async () => {
      throw new Error('x');
    });
    expect(r.ok).toBe(false);
  });

  it('tryAsync returns ok on success', async () => {
    const r = await tryAsync(async () => 7);
    expect(r).toEqual(ok(7));
  });
});

