import { OrderBuilder } from '../application/orderBuilder.js';
import { DustAmountError, InvalidInputError, SameMintError } from '../domain/errors.js';

const SOL = 'So11111111111111111111111111111111111111112';
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const TAKER = '6dNVk6mEZ7C8u3hX1z8L1bqj4hYGFmYRFnQ5J9aHkS9X';

describe('OrderBuilder', () => {
  it('builds a valid order', () => {
    const p = OrderBuilder.create()
      .from(SOL).to(USDC).withAmount('10000000').withTaker(TAKER).withSlippageBps(50)
      .build();
    expect(p.inputMint).toBe(SOL);
    expect(p.outputMint).toBe(USDC);
    expect(p.amount).toBe('10000000');
    expect(p.slippageBps).toBe(50);
  });

  it('rejects same in/out mint', () => {
    expect(() =>
      OrderBuilder.create().from(SOL).to(SOL).withAmount('1').build(),
    ).toThrow(SameMintError);
  });

  it('rejects missing mints', () => {
    expect(() => OrderBuilder.create().withAmount('1').build()).toThrow(InvalidInputError);
  });

  it('rejects dust amount', () => {
    expect(() =>
      OrderBuilder.create().from(SOL).to(USDC).withAmount('0').build(),
    ).toThrow(DustAmountError);
  });

  it('rejects non-integer amount', () => {
    expect(() =>
      OrderBuilder.create().from(SOL).to(USDC).withAmount('abc').build(),
    ).toThrow(InvalidInputError);
  });
});

