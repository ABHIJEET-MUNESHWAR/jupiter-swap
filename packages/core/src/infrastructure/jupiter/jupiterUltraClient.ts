import type { HttpClient } from '../http/httpClient.js';
import { ExecuteResponseDto, OrderResponseDto, type ExecuteResponseDtoT, type OrderResponseDtoT } from './dto.js';

/** Thin transport wrapper around the Jupiter Ultra REST endpoints.
 *
 *  Endpoints (per https://developers.jup.ag/docs/api-reference/swap):
 *    POST /ultra/v1/order
 *    POST /ultra/v1/execute
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
}

export class JupiterUltraClient {
  constructor(private readonly http: HttpClient) {}

  async createOrder(req: JupiterOrderRequest): Promise<OrderResponseDtoT> {
    return this.http.request(
      {
        method: 'POST',
        path: '/ultra/v1/order',
        body: req,
      },
      OrderResponseDto,
    );
  }

  async executeOrder(req: JupiterExecuteRequest): Promise<ExecuteResponseDtoT> {
    return this.http.request(
      {
        method: 'POST',
        path: '/ultra/v1/execute',
        body: req,
      },
      ExecuteResponseDto,
    );
  }
}

