import type {
  CreateOrderParams,
  ExecuteOrderParams,
  ExecuteResult,
  OrderStatus,
  SwapOrder,
} from '../../domain/entities.js';
import { DomainError, fromUpstream, InternalError } from '../../domain/errors.js';
import type { SwapProvider } from '../../domain/ports.js';
import { err, ok, type Result } from '../../domain/types/result.js';
import {
  base64Tx,
  bps,
  mintAddress,
  requestId,
  type MintAddress,
} from '../../domain/types/brand.js';
import { upstreamLatency } from '../metrics.js';
import type { JupiterUltraClient } from './jupiterUltraClient.js';

/** Adapter mapping Jupiter Ultra DTOs ↔ domain `SwapOrder` / `ExecuteResult`.
 *
 *  Keeps the domain free of any Jupiter-specific knowledge (DIP).
 */
export class JupiterSwapProvider implements SwapProvider {
  constructor(private readonly client: JupiterUltraClient) {}

  async createOrder(params: CreateOrderParams): Promise<Result<SwapOrder, DomainError>> {
    const start = Date.now();
    try {
      const dto = await this.client.createOrder({
        inputMint: params.inputMint,
        outputMint: params.outputMint,
        amount: params.amount,
        taker: params.taker,
        referralAccount: params.referralAccount,
        referralFee: params.referralFee,
        slippageBps: params.slippageBps,
      });
      upstreamLatency.observe({ endpoint: 'order', outcome: 'ok' }, Date.now() - start);

      // Ultra returns 200 with embedded error fields when it cannot produce
      // a transaction (e.g. "Insufficient funds"). Translate those into our
      // typed DomainError hierarchy.
      const embeddedError = dto.errorMessage ?? dto.error;
      if (embeddedError || dto.transaction.length === 0) {
        return err(fromUpstream(400, dto, embeddedError ?? 'Jupiter returned no transaction'));
      }

      const order: SwapOrder = {
        requestId: requestId(dto.requestId),
        transaction: base64Tx(dto.transaction),
        inputMint: mintAddress(dto.inputMint),
        outputMint: mintAddress(dto.outputMint),
        inAmount: dto.inAmount,
        outAmount: dto.outAmount,
        otherAmountThreshold: dto.otherAmountThreshold,
        swapMode: dto.swapMode,
        slippageBps: bps(dto.slippageBps),
        priceImpactPct: dto.priceImpactPct,
        routePlan: dto.routePlan.map((s) => ({
          percent: s.percent,
          swapInfo: {
            ammKey: s.swapInfo.ammKey,
            label: s.swapInfo.label,
            inputMint: s.swapInfo.inputMint as MintAddress,
            outputMint: s.swapInfo.outputMint as MintAddress,
            inAmount: s.swapInfo.inAmount,
            outAmount: s.swapInfo.outAmount,
            feeAmount: s.swapInfo.feeAmount,
            feeMint: (s.swapInfo.feeMint || s.swapInfo.outputMint) as MintAddress,
          },
        })),
        contextSlot: dto.contextSlot,
        prioritizationFeeLamports: dto.prioritizationFeeLamports,
        expiresAt: dto.expiresAt,
        lastValidBlockHeight: dto.lastValidBlockHeight,
        status: 'Created',
      };
      return ok(order);
    } catch (e) {
      upstreamLatency.observe({ endpoint: 'order', outcome: 'error' }, Date.now() - start);
      return err(toDomain(e));
    }
  }

  async executeOrder(params: ExecuteOrderParams): Promise<Result<ExecuteResult, DomainError>> {
    const start = Date.now();
    try {
      const dto = await this.client.executeOrder({
        requestId: params.requestId,
        signedTransaction: params.signedTransaction,
        lastValidBlockHeight: params.lastValidBlockHeight,
      });
      upstreamLatency.observe({ endpoint: 'execute', outcome: 'ok' }, Date.now() - start);
      return ok({
        status: normalizeStatus(dto.status),
        signature: dto.signature,
        slot: dto.slot,
        code: dto.code,
        error: dto.error,
        inputAmountResult: dto.inputAmountResult,
        outputAmountResult: dto.outputAmountResult,
      });
    } catch (e) {
      upstreamLatency.observe({ endpoint: 'execute', outcome: 'error' }, Date.now() - start);
      return err(toDomain(e));
    }
  }
}

function toDomain(e: unknown): DomainError {
  if (e instanceof DomainError) return e;
  return new InternalError(`Unexpected error: ${String(e)}`, e);
}

function normalizeStatus(s: string): OrderStatus {
  switch (s.toLowerCase()) {
    case 'success':
      return 'Success';
    case 'failed':
      return 'Failed';
    case 'submitted':
      return 'Submitted';
    case 'expired':
      return 'Expired';
    case 'awaitingsignature':
    case 'awaiting_signature':
      return 'AwaitingSignature';
    default:
      return 'Created';
  }
}

