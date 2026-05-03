import type { Base64Tx, Bps, MintAddress, RequestId, WalletAddress } from './types/brand.js';

export type SwapMode = 'ExactIn' | 'ExactOut';

export type OrderStatus =
  | 'Created'
  | 'AwaitingSignature'
  | 'Submitted'
  | 'Success'
  | 'Failed'
  | 'Expired';

export interface SwapInfo {
  readonly ammKey: string;
  readonly label?: string;
  readonly inputMint: MintAddress;
  readonly outputMint: MintAddress;
  readonly inAmount: string;
  readonly outAmount: string;
  readonly feeAmount: string;
  readonly feeMint: MintAddress;
}

export interface RoutePlanStep {
  readonly swapInfo: SwapInfo;
  readonly percent: number;
}

/** A normalized order returned by `/ultra/v1/order`. */
export interface SwapOrder {
  readonly requestId: RequestId;
  readonly transaction: Base64Tx;
  readonly inputMint: MintAddress;
  readonly outputMint: MintAddress;
  readonly inAmount: string;
  readonly outAmount: string;
  readonly otherAmountThreshold: string;
  readonly swapMode: SwapMode;
  readonly slippageBps: Bps;
  readonly priceImpactPct: number;
  readonly routePlan: ReadonlyArray<RoutePlanStep>;
  readonly contextSlot?: string;
  readonly prioritizationFeeLamports?: string;
  readonly expiresAt?: string;
  readonly status: OrderStatus;
}

export interface CreateOrderParams {
  readonly inputMint: MintAddress;
  readonly outputMint: MintAddress;
  readonly amount: string;
  readonly taker?: WalletAddress;
  readonly referralAccount?: WalletAddress;
  readonly referralFee?: Bps;
  readonly slippageBps?: Bps;
}

export interface ExecuteOrderParams {
  readonly requestId: RequestId;
  readonly signedTransaction: Base64Tx;
}

export interface ExecuteResult {
  readonly status: OrderStatus;
  readonly signature?: string;
  readonly slot?: string;
  readonly code?: number;
  readonly error?: string;
  readonly inputAmountResult?: string;
  readonly outputAmountResult?: string;
}

