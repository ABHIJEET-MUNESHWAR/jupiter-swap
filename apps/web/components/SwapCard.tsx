'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownUp, Loader2 } from 'lucide-react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { VersionedTransaction } from '@solana/web3.js';
import { toast } from 'sonner';
import { TokenSelector } from './TokenSelector';
import { SlippageSettings } from './SlippageSettings';
import { TOKENS } from '../lib/tokens';
import { CREATE_ORDER, EXECUTE_ORDER, gqlClient } from '../lib/graphql';

function toBaseUnits(uiAmount: string, decimals: number): string {
  if (!uiAmount || Number.isNaN(Number(uiAmount))) return '0';
  const [whole, frac = ''] = uiAmount.split('.');
  const padded = (frac + '0'.repeat(decimals)).slice(0, decimals);
  return BigInt((whole || '0') + padded).toString();
}

function fromBaseUnits(amount: string | undefined, decimals: number): string {
  if (!amount) return '0';
  const a = BigInt(amount);
  const div = 10n ** BigInt(decimals);
  const whole = a / div;
  const frac = (a % div).toString().padStart(decimals, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : `${whole}`;
}

export function SwapCard() {
  const { publicKey, signTransaction, connected } = useWallet();
  const { connection: _connection } = useConnection();

  const [inputToken, setInputToken] = useState(TOKENS[0]!);
  const [outputToken, setOutputToken] = useState(TOKENS[1]!);
  const [amount, setAmount] = useState('0.1');
  const [slippageBps, setSlippageBps] = useState(50);
  const [quote, setQuote] = useState<{
    requestId: string; transaction: string;
    outAmount: string; priceImpactPct: number;
    lastValidBlockHeight?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);

  // Wallet state is only known on the client; gate any wallet-dependent
  // markup behind a mounted flag to keep server & first-client renders
  // identical (avoids React hydration mismatches).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const walletReady = mounted && connected;

  const outDisplay = useMemo(
    () => (quote ? fromBaseUnits(quote.outAmount, outputToken.decimals) : ''),
    [quote, outputToken.decimals],
  );

  function flip() {
    setInputToken(outputToken);
    setOutputToken(inputToken);
    setQuote(null);
  }

  async function fetchQuote() {
    if (!publicKey) {
      toast.error('Connect a wallet first');
      return;
    }
    if (inputToken.mint === outputToken.mint) {
      toast.error('Input and output tokens must differ');
      return;
    }
    setLoading(true);
    setQuote(null);
    try {
      const variables = {
        input: {
          inputMint: inputToken.mint,
          outputMint: outputToken.mint,
          amount: toBaseUnits(amount, inputToken.decimals),
          taker: publicKey.toBase58(),
          slippageBps,
        },
      };
      const res = await gqlClient.request<{ createOrder: typeof quote & object }>(
        CREATE_ORDER as never, variables,
      );
      setQuote(res.createOrder);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch quote';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function executeSwap() {
    if (!quote || !signTransaction || !publicKey) return;
    setExecuting(true);
    try {
      const txBuf = Buffer.from(quote.transaction, 'base64');
      const tx = VersionedTransaction.deserialize(txBuf);
      const signed = await signTransaction(tx);
      const serialized = Buffer.from(signed.serialize()).toString('base64');

      const res = await gqlClient.request<{
        executeOrder: { status: string; signature?: string; error?: string };
      }>(EXECUTE_ORDER as never, {
        input: {
          requestId: quote.requestId,
          signedTransaction: serialized,
          ...(quote.lastValidBlockHeight
            ? { lastValidBlockHeight: quote.lastValidBlockHeight }
            : {}),
        },
      });
      if (res.executeOrder.status === 'Success' && res.executeOrder.signature) {
        toast.success(`Swap successful 🚀`, {
          description: res.executeOrder.signature,
          action: {
            label: 'View',
            onClick: () =>
              window.open(`https://solscan.io/tx/${res.executeOrder.signature}`, '_blank'),
          },
        });
        setQuote(null);
      } else {
        toast.error(`Swap failed: ${res.executeOrder.error ?? res.executeOrder.status}`);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Execution failed');
    } finally {
      setExecuting(false);
    }
  }

  return (
    <div className="glass rounded-3xl p-5 shadow-glow">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-muted">Swap</span>
        <SlippageSettings bps={slippageBps} onChange={setSlippageBps} />
      </div>

      {/* You pay */}
      <div className="rounded-2xl bg-panel2 p-4">
        <div className="mb-2 text-xs text-muted">You pay</div>
        <div className="flex items-center gap-3">
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
            placeholder="0.0"
            className="w-full bg-transparent text-3xl font-semibold outline-none placeholder:text-muted"
          />
          <TokenSelector value={inputToken} onChange={setInputToken} />
        </div>
      </div>

      {/* Flip */}
      <div className="my-2 flex justify-center">
        <button
          onClick={flip}
          className="rounded-xl border border-white/10 bg-panel p-2 hover:bg-white/5"
          aria-label="Swap direction"
        >
          <ArrowDownUp size={18} />
        </button>
      </div>

      {/* You receive */}
      <div className="rounded-2xl bg-panel2 p-4">
        <div className="mb-2 text-xs text-muted">You receive</div>
        <div className="flex items-center gap-3">
          <input
            readOnly
            value={outDisplay}
            placeholder="0.0"
            className="w-full bg-transparent text-3xl font-semibold outline-none placeholder:text-muted"
          />
          <TokenSelector value={outputToken} onChange={setOutputToken} />
        </div>
      </div>

      {/* Quote details */}
      {quote && (
        <div className="mt-4 rounded-xl bg-panel2/60 p-3 text-sm text-muted">
          <div className="flex justify-between"><span>Price impact</span><span>{quote.priceImpactPct.toFixed(4)}%</span></div>
          <div className="flex justify-between"><span>Slippage</span><span>{(slippageBps / 100).toFixed(2)}%</span></div>
          <div className="flex justify-between"><span>Request ID</span><span className="truncate max-w-[180px]">{quote.requestId}</span></div>
        </div>
      )}

      {/* Action button */}
      <button
        onClick={quote ? executeSwap : fetchQuote}
        disabled={loading || executing || !walletReady}
        className="btn-grad mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-lg disabled:opacity-50"
      >
        {(loading || executing) && <Loader2 className="animate-spin" size={20} />}
        {!walletReady
          ? 'Connect Wallet'
          : loading
            ? 'Fetching best route…'
            : executing
              ? 'Submitting…'
              : quote
                ? 'Confirm Swap'
                : 'Get Quote'}
      </button>
    </div>
  );
}

