'use client';

import { useState } from 'react';
import { Sparkles, Send } from 'lucide-react';
import { ASK_ASSISTANT, gqlClient } from '../lib/graphql';

interface Msg { role: 'user' | 'assistant'; text: string }

export function AssistantChat() {
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: 'assistant', text: 'Hi! Try: "swap 0.1 SOL to USDC at 0.25% slippage"' },
  ]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  async function send() {
    if (!prompt.trim() || loading) return;
    const p = prompt;
    setMsgs((m) => [...m, { role: 'user', text: p }]);
    setPrompt('');
    setLoading(true);
    try {
      const r = await gqlClient.request<{ askAssistant: { message: string } }>(
        ASK_ASSISTANT as never, { prompt: p },
      );
      setMsgs((m) => [...m, { role: 'assistant', text: r.askAssistant.message }]);
    } catch (e) {
      setMsgs((m) => [
        ...m,
        { role: 'assistant', text: e instanceof Error ? e.message : 'Assistant error' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass flex h-[640px] flex-col rounded-3xl p-5 shadow-glow">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles size={18} className="text-accent" />
        <span className="font-semibold">Swap Assistant</span>
        <span className="ml-auto rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
          GenAI · Beta
        </span>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {msgs.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
              m.role === 'user'
                ? 'ml-auto bg-accent/20 text-white'
                : 'bg-panel2 text-white/90'
            }`}
          >
            {m.text}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-2xl bg-panel2 p-2">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Ask anything…"
          className="w-full bg-transparent px-2 outline-none placeholder:text-muted"
        />
        <button
          onClick={send}
          disabled={loading || !prompt.trim()}
          className="btn-grad rounded-xl px-3 py-2 disabled:opacity-50"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

