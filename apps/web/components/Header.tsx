'use client';

import dynamic from 'next/dynamic';

// WalletMultiButton reads wallet/localStorage state on mount, which causes
// SSR/CSR markup mismatch (extra <i> icon node). Load it client-only.
const WalletMultiButton = dynamic(
  async () =>
    (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  {
    ssr: false,
    loading: () => (
      <button
        className="rounded-xl px-4 py-2 text-sm font-semibold"
        style={{
          background: 'linear-gradient(90deg,#22d3ee,#a855f7)',
          color: '#0a0e17',
          height: 40,
        }}
        disabled
      >
        Connect Wallet
      </button>
    ),
  },
);

export function Header() {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-accent to-accent2" />
        <span className="text-lg font-semibold tracking-tight">Jupiter Swap</span>
      </div>
      <nav className="hidden items-center gap-6 text-sm text-muted md:flex">
        <a href="#" className="hover:text-white">Swap</a>
        <a href="#" className="hover:text-white">Limit</a>
        <a href="#" className="hover:text-white">DCA</a>
        <a href="#" className="hover:text-white">Perps</a>
      </nav>
      <WalletMultiButton
        style={{
          background: 'linear-gradient(90deg,#22d3ee,#a855f7)',
          color: '#0a0e17',
          borderRadius: 12,
          height: 40,
        }}
      />
    </header>
  );
}

