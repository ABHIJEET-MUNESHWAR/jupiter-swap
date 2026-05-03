import { SwapAssistantAgent } from '../agents/swapAssistantAgent.js';
import { MockLLMProvider } from '../providers/mockProvider.js';
import { parseSwapIntent } from '../tools/parseSwapIntent.js';

describe('parseSwapIntent', () => {
  it('parses canonical "swap X SOL to USDC"', () => {
    const r = parseSwapIntent('swap 0.1 SOL to USDC');
    expect(r).not.toBeNull();
    expect(r!.amount).toBe('0.1');
    expect(r!.inputMint).toContain('So11');
    expect(r!.outputMint).toContain('EPjFW');
    expect(r!.slippageBps).toBe(50);
  });
  it('captures slippage percent', () => {
    const r = parseSwapIntent('swap 1 USDC for SOL with 0.25% slippage');
    expect(r!.slippageBps).toBe(25);
  });
  it('returns null for unknown ticker', () => {
    expect(parseSwapIntent('swap 1 FOO to BAR')).toBeNull();
  });
  it('returns null on garbage', () => {
    expect(parseSwapIntent('hello world')).toBeNull();
  });
});

describe('SwapAssistantAgent', () => {
  it('uses parser when possible', async () => {
    const agent = new SwapAssistantAgent(new MockLLMProvider());
    const r = await agent.ask('swap 0.5 SOL to USDC');
    expect(r.parsedOrder).not.toBeNull();
    expect(r.message).toMatch(/SOL.*USDC/);
  });
  it('falls back to LLM when parser fails', async () => {
    const agent = new SwapAssistantAgent(new MockLLMProvider());
    const r = await agent.ask('hi there');
    expect(r.parsedOrder).toBeNull();
    expect(r.message).toMatch(/mock-llm/);
  });
});

