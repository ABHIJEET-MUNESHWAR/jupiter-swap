import type { LLMProvider } from '../providers/llmProvider.js';
import { parseSwapIntent, type ParsedIntent } from '../tools/parseSwapIntent.js';

export interface AssistantReply {
  message: string;
  parsedOrder: ParsedIntent | null;
}

/**
 * SwapAssistantAgent — converts a free-form prompt into a structured swap
 * intent. Uses a deterministic parser as the primary "tool" and the LLM as a
 * fallback / explainer. This is a minimal Agentic AI loop: parse → reflect.
 */
export class SwapAssistantAgent {
  constructor(private readonly llm: LLMProvider) {}

  async ask(prompt: string): Promise<AssistantReply> {
    const parsed = parseSwapIntent(prompt);
    if (parsed) {
      return {
        parsedOrder: parsed,
        message: `Got it — preparing to swap ${parsed.amount} ${symbolFor(parsed.inputMint)} → ${symbolFor(parsed.outputMint)} at ${(parsed.slippageBps / 100).toFixed(2)}% slippage.`,
      };
    }
    const llmReply = await this.llm.complete([
      {
        role: 'system',
        content:
          'You are a Solana DEX swap assistant. If the user request is ambiguous, ask one short clarifying question. Do not invent token tickers.',
      },
      { role: 'user', content: prompt },
    ]);
    return { parsedOrder: null, message: llmReply };
  }
}

function symbolFor(mint: string): string {
  const entry = Object.entries({
    SOL: 'So11111111111111111111111111111111111111112',
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  }).find(([, m]) => m === mint);
  return entry ? entry[0] : mint.slice(0, 4) + '…';
}

