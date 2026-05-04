import type { HttpClient } from '../http/httpClient.js';
import { ExecuteResponseDto, OrderResponseDto, type ExecuteResponseDtoT, type OrderResponseDtoT } from './dto.js';

/** Thin transport wrapper around the Jupiter **Swap V2** REST endpoints.
 *
 *  Endpoints (per https://dev.jup.ag/docs/api/swap-api):
 *    GET  https://api.jup.ag/swap/v2/order   (header: x-api-key)
 *    POST https://api.jup.ag/swap/v2/execute (header: x-api-key, body: { signedTransaction, requestId, lastValidBlockHeight })
 *
 *  The class name is preserved for backwards compatibility with callers and
 *  tests; it now targets Swap V2 instead of the deprecated Ultra endpoints.
 */
export interface JupiterOrderRequest {
  inputMint: string;
  outputMint: string;
  amount: string;
  taker?: string;
  referralAccount?: string;
  referralFee?: number;
  slippageBps?: number;
}

export interface JupiterExecuteRequest {
  signedTransaction: string;
  requestId: string;
  lastValidBlockHeight?: string;
}

export class JupiterUltraClient {
  constructor(private readonly http: HttpClient) {}

  async createOrder(req: JupiterOrderRequest): Promise<OrderResponseDtoT> {
    return this.http.request(
      {
        method: 'GET',
        path: '/swap/v2/order',
        query: {
          inputMint: req.inputMint,
          outputMint: req.outputMint,
          amount: req.amount,
          taker: req.taker,
          referralAccount: req.referralAccount,
          referralFee: req.referralFee,
          slippageBps: req.slippageBps,
        },
      },
      OrderResponseDto,
    );
  }

  async executeOrder(req: JupiterExecuteRequest): Promise<ExecuteResponseDtoT> {
    return this.http.request(
      {
        method: 'POST',
        path: '/swap/v2/execute',
        body: req,
      },
      ExecuteResponseDto,
    );
  }
}

