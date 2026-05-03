import { SwapCard } from '../components/SwapCard';
import { Header } from '../components/Header';
import { AssistantChat } from '../components/AssistantChat';

export default function Page() {
  return (
    <main className="min-h-screen w-full">
      <Header />
      <section className="mx-auto max-w-6xl px-6 pb-24 pt-12 grid gap-8 lg:grid-cols-[480px_1fr]">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            The best swap on{' '}
            <span className="bg-gradient-to-r from-accent to-accent2 bg-clip-text text-transparent">
              Solana
            </span>
          </h1>
          <p className="mt-2 text-muted">
            Powered by Jupiter Ultra — Order &amp; Execute APIs.
          </p>
          <div className="mt-6">
            <SwapCard />
          </div>
        </div>
        <AssistantChat />
      </section>
    </main>
  );
}

