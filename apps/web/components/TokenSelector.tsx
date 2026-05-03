'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { TOKENS, type TokenInfo } from '../lib/tokens';

export function TokenSelector({
  value,
  onChange,
}: {
  value: TokenInfo;
  onChange: (t: TokenInfo) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!open) setQ('');
  }, [open]);

  const filtered = TOKENS.filter(
    (t) =>
      t.symbol.toLowerCase().includes(q.toLowerCase()) ||
      t.name.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full bg-panel2 px-3 py-2 hover:bg-white/5 transition"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={value.logoURI} alt="" className="h-6 w-6 rounded-full" />
        <span className="font-semibold">{value.symbol}</span>
        <ChevronDown size={16} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass w-[420px] rounded-2xl p-4 shadow-glow">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Select a token</h3>
              <button onClick={() => setOpen(false)} className="text-muted hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="mb-3 flex items-center gap-2 rounded-xl bg-panel2 px-3 py-2">
              <Search size={16} className="text-muted" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name or paste address"
                className="w-full bg-transparent outline-none placeholder:text-muted"
              />
            </div>
            <div className="max-h-80 overflow-y-auto">
              {filtered.map((t) => (
                <button
                  key={t.mint}
                  onClick={() => { onChange(t); setOpen(false); }}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/5"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.logoURI} alt="" className="h-8 w-8 rounded-full" />
                  <div className="text-left">
                    <div className="font-semibold">{t.symbol}</div>
                    <div className="text-xs text-muted">{t.name}</div>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="py-6 text-center text-muted">No tokens found</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

