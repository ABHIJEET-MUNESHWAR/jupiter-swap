import type { ChatMessage, LLMProvider } from './llmProvider.js';

/** Deterministic LLM stub — used when no API key is configured. Lets the
 *  swap-assistant tool pipeline keep functioning (the parser regex inside
 *  the tool layer does the heavy lifting; the LLM just frames replies). */
export class MockLLMProvider implements LLMProvider {
  readonly name = 'mock';
  async complete(messages: ChatMessage[]): Promise<string> {
    const last = messages.at(-1)?.content ?? '';
    return `(mock-llm) Parsed your prompt: "${last.slice(0, 200)}"`;
  }
}

