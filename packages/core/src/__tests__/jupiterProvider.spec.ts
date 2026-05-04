import { HttpClient } from '../infrastructure/http/httpClient.js';
import { JupiterUltraClient } from '../infrastructure/jupiter/jupiterUltraClient.js';
import { JupiterSwapProvider } from '../infrastructure/jupiter/jupiterSwapProvider.js';
import { mintAddress, requestId, base64Tx } from '../domain/types/brand.js';
import { InsufficientBalanceError, RateLimitedError, SlippageExceededError } from '../domain/errors.js';

const SOL = 'So11111111111111111111111111111111111111112';
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

function mockFetch(handler: (url: string, init: RequestInit) => Response): typeof fetch {
  return ((url: RequestInfo | URL, init?: RequestInit) =>
    Promise.resolve(handler(String(url), init ?? {}))) as unknown as typeof fetch;
}

const validOrderResp = {
  requestId: 'req-1',
  transaction: 'YWJj',
  inputMint: SOL,
  outputMint: USDC,
  inAmount: '1000',
  outAmount: '900',
  otherAmountThreshold: '880',
  swapMode: 'ExactIn',
  slippageBps: 50,
  priceImpactPct: '0.01',
  routePlan: [],
};

describe('JupiterSwapProvider', () => {
  it('createOrder maps DTO → domain order', async () => {
    const fetchImpl = mockFetch(() => new Response(JSON.stringify(validOrderResp), { status: 200 }));
    const http = new HttpClient({
      baseUrl: 'https://example.test', timeoutMs: 1000, maxRetries: 0, fetchImpl,
    });
    const provider = new JupiterSwapProvider(new JupiterUltraClient(http));
    const r = await provider.createOrder({
      inputMint: mintAddress(SOL), outputMint: mintAddress(USDC), amount: '1000',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.requestId).toBe('req-1');
      expect(r.value.status).toBe('Created');
    }
  });

  it('createOrder maps 429 → RateLimitedError', async () => {
    const fetchImpl = mockFetch(() => new Response('rate limit', { status: 429 }));
    const http = new HttpClient({
      baseUrl: 'https://example.test', timeoutMs: 1000, maxRetries: 0, fetchImpl,
    });
    const provider = new JupiterSwapProvider(new JupiterUltraClient(http));
    const r = await provider.createOrder({
      inputMint: mintAddress(SOL), outputMint: mintAddress(USDC), amount: '1000',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBeInstanceOf(RateLimitedError);
  });

  it('createOrder maps slippage error text', async () => {
    const fetchImpl = mockFetch(
      () => new Response(JSON.stringify({ error: 'slippage tolerance exceeded' }), { status: 400 }),
    );
    const http = new HttpClient({
      baseUrl: 'https://example.test', timeoutMs: 1000, maxRetries: 0, fetchImpl,
    });
    const provider = new JupiterSwapProvider(new JupiterUltraClient(http));
    const r = await provider.createOrder({
      inputMint: mintAddress(SOL), outputMint: mintAddress(USDC), amount: '1000',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBeInstanceOf(SlippageExceededError);
  });

  it('translates embedded "Insufficient funds" 200-OK response into a typed error', async () => {
    const fetchImpl = mockFetch(
      () =>
        new Response(
          JSON.stringify({
            ...validOrderResp,
            transaction: '',
            errorCode: 1,
            errorMessage: 'Insufficient funds',
            error: 'Insufficient funds',
          }),
          { status: 200 },
        ),
    );
    const http = new HttpClient({
      baseUrl: 'https://example.test', timeoutMs: 1000, maxRetries: 0, fetchImpl,
    });
    const provider = new JupiterSwapProvider(new JupiterUltraClient(http));
    const r = await provider.createOrder({
      inputMint: mintAddress(SOL), outputMint: mintAddress(USDC), amount: '1000',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBeInstanceOf(InsufficientBalanceError);
  });

  it('executeOrder happy path', async () => {
    const fetchImpl = mockFetch(
      () => new Response(JSON.stringify({ status: 'Success', signature: 'sig', slot: 123 }), { status: 200 }),
    );
    const http = new HttpClient({
      baseUrl: 'https://example.test', timeoutMs: 1000, maxRetries: 0, fetchImpl,
    });
    const provider = new JupiterSwapProvider(new JupiterUltraClient(http));
    const r = await provider.executeOrder({
      requestId: requestId('req-1'),
      signedTransaction: base64Tx('YWJj'),
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.status).toBe('Success');
      expect(r.value.signature).toBe('sig');
      expect(r.value.slot).toBe('123');
    }
  });
});

