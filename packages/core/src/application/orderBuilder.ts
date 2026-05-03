import {
  DustAmountError,
  InvalidInputError,
  SameMintError,
} from '../domain/errors.js';
import { bps, mintAddress, walletAddress } from '../domain/types/brand.js';
import type { CreateOrderParams } from '../domain/entities.js';

/** Builder pattern — fluent API for assembling a validated CreateOrderParams.
 *  All validation lives in `.build()`, so partial states are not type-leaked. */
export class OrderBuilder {
  private inputMint?: string;
  private outputMint?: string;
  private amount?: string;
  private taker?: string;
  private slippageBps?: number;
  private referralAccount?: string;
  private referralFee?: number;

  static create(): OrderBuilder {
    return new OrderBuilder();
  }

  from(mint: string): this { this.inputMint = mint; return this; }
  to(mint: string): this { this.outputMint = mint; return this; }
  withAmount(amount: string | bigint | number): this {
    this.amount = typeof amount === 'string' ? amount : String(amount);
    return this;
  }
  withTaker(addr: string): this { this.taker = addr; return this; }
  withSlippageBps(b: number): this { this.slippageBps = b; return this; }
  withReferral(addr: string, fee: number): this {
    this.referralAccount = addr;
    this.referralFee = fee;
    return this;
  }

  build(): CreateOrderParams {
    if (!this.inputMint || !this.outputMint) {
      throw new InvalidInputError('inputMint and outputMint are required');
    }
    if (this.inputMint === this.outputMint) {
      throw new SameMintError('inputMint and outputMint must differ');
    }
    if (!this.amount) throw new InvalidInputError('amount is required');
    let amt: bigint;
    try {
      amt = BigInt(this.amount);
    } catch {
      throw new InvalidInputError(`amount must be an integer string, got ${this.amount}`);
    }
    if (amt <= 0n) throw new DustAmountError('amount must be > 0');

    return {
      inputMint: mintAddress(this.inputMint),
      outputMint: mintAddress(this.outputMint),
      amount: amt.toString(),
      ...(this.taker !== undefined ? { taker: walletAddress(this.taker) } : {}),
      ...(this.slippageBps !== undefined ? { slippageBps: bps(this.slippageBps) } : {}),
      ...(this.referralAccount !== undefined && this.referralFee !== undefined
        ? {
            referralAccount: walletAddress(this.referralAccount),
            referralFee: bps(this.referralFee),
          }
        : {}),
    };
  }
}

