import OpenAI from 'openai';
import type { ChatMessage, LLMProvider } from './llmProvider.js';

export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';
  private readonly client: OpenAI;
  constructor(private readonly apiKey: string, private readonly model = 'gpt-4o-mini') {
    this.client = new OpenAI({ apiKey });
  }
  async complete(messages: ChatMessage[], opts: { temperature?: number } = {}): Promise<string> {
    const res = await this.client.chat.completions.create({
      model: this.model,
      temperature: opts.temperature ?? 0.2,
      messages,
    });
    return res.choices[0]?.message?.content ?? '';
  }
}

