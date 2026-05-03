'use client';

import { useState } from 'react';
import { Settings, X } from 'lucide-react';

export function SlippageSettings({
  bps,
  onChange,
}: {
  bps: number;
  onChange: (b: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const presets = [10, 50, 100];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg p-2 text-muted hover:bg-white/5 hover:text-white"
        aria-label="Slippage settings"
      >
        <Settings size={18} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass w-[360px] rounded-2xl p-4 shadow-glow">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Settings</h3>
              <button onClick={() => setOpen(false)} className="text-muted hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="text-sm text-muted mb-2">Max slippage</div>
            <div className="flex items-center gap-2">
              {presets.map((p) => (
                <button
                  key={p}
                  onClick={() => onChange(p)}
                  className={`rounded-lg px-3 py-1.5 text-sm ${
                    bps === p ? 'bg-accent text-bg' : 'bg-panel2 text-white hover:bg-white/10'
                  }`}
                >
                  {(p / 100).toFixed(2)}%
                </button>
              ))}
              <input
                type="number"
                min={0}
                max={5000}
                step={1}
                value={bps}
                onChange={(e) => onChange(Number(e.target.value || 0))}
                className="ml-auto w-24 rounded-lg bg-panel2 px-3 py-1.5 text-right outline-none"
              />
              <span className="text-muted">bps</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

