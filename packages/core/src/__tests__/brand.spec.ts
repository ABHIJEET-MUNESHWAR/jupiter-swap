import { mintAddress, lamports, bps, base64Tx, assertNever } from '../domain/types/brand.js';

describe('brand', () => {
  it('mintAddress accepts valid base58', () => {
    expect(mintAddress('So11111111111111111111111111111111111111112')).toBe(
      'So11111111111111111111111111111111111111112',
    );
  });

  it('mintAddress rejects invalid', () => {
    expect(() => mintAddress('not-base58!')).toThrow();
  });

  it('lamports rejects negative', () => {
    expect(() => lamports(-1n)).toThrow();
  });

  it('lamports accepts numeric strings', () => {
    expect(lamports('100')).toBe(100n);
  });

  it('bps validates range', () => {
    expect(bps(50)).toBe(50);
    expect(() => bps(-1)).toThrow();
    expect(() => bps(10_001)).toThrow();
    expect(() => bps(1.5)).toThrow();
  });

  it('base64Tx validates format', () => {
    expect(base64Tx('YWJj')).toBe('YWJj');
    expect(() => base64Tx('!!!')).toThrow();
  });

  it('assertNever throws', () => {
    expect(() => assertNever('x' as never)).toThrow();
  });
});

