import { z } from 'zod';

/** Curated list of common Solana mints — enough for the demo assistant. */
export const KNOWN_MINTS: Record<string, string> = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
};

export const ParsedIntent = z.object({
  inputMint: z.string(),
  outputMint: z.string(),
  /** UI amount (human, e.g. "0.1"). Conversion to lamports happens client-side
   *  with token decimals, kept here for clarity. */
  amount: z.string(),
  slippageBps: z.number().int().min(0).max(10_000).default(50),
  swapMode: z.enum(['ExactIn', 'ExactOut']).default('ExactIn'),
});
export type ParsedIntent = z.infer<typeof ParsedIntent>;

const NUM_RE = /(\d+(?:\.\d+)?)/;

/** Heuristic rule-based parser. Wrapped by the agent which can fall back to
 *  the LLM when this returns null. */
export function parseSwapIntent(prompt: string): ParsedIntent | null {
  const text = prompt.trim();
  const m = text.match(
    new RegExp(`swap\\s+${NUM_RE.source}\\s+([A-Z]{2,8})\\s+(?:to|for|into)\\s+([A-Z]{2,8})`, 'i'),
  );
  if (!m) return null;
  const [, amount, fromSym, toSym] = m;
  const inputMint = KNOWN_MINTS[fromSym!.toUpperCase()];
  const outputMint = KNOWN_MINTS[toSym!.toUpperCase()];
  if (!inputMint || !outputMint) return null;
  const slippageMatch = text.match(/(\d+(?:\.\d+)?)\s*%/);
  const slippageBps = slippageMatch ? Math.round(parseFloat(slippageMatch[1]!) * 100) : 50;
  return ParsedIntent.parse({ inputMint, outputMint, amount: amount!, slippageBps });
}

