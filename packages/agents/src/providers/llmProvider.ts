/** Pluggable LLM provider port — swap OpenAI / Anthropic / local Ollama by
 *  implementing this interface. Keeps agents free of vendor SDK coupling. */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMProvider {
  readonly name: string;
  complete(messages: ChatMessage[], opts?: { temperature?: number }): Promise<string>;
}

