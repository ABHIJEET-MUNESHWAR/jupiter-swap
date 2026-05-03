import type { DomainEvent, EventBus, EventHandler } from '../domain/ports.js';

/**
 * Lightweight in-process pub/sub. For production multi-node setups
 * the same interface can be implemented over Redis / NATS / Kafka.
 *
 * Subscribe → O(1); publish → O(n) over handlers; unsubscribe → O(n) on the
 * handler list of that topic.
 */
export class InProcessEventBus implements EventBus {
  private readonly handlers = new Map<string, Set<EventHandler<unknown>>>();

  subscribe<T>(type: string, handler: EventHandler<T>): () => void {
    const set = this.handlers.get(type) ?? new Set();
    set.add(handler as EventHandler<unknown>);
    this.handlers.set(type, set);
    return () => set.delete(handler as EventHandler<unknown>);
  }

  async publish<T>(event: DomainEvent<T>): Promise<void> {
    const set = this.handlers.get(event.type);
    if (!set) return;
    await Promise.allSettled([...set].map((h) => h(event as DomainEvent<unknown>)));
  }
}

export function makeEvent<T>(type: string, payload: T): DomainEvent<T> {
  return { type, occurredAt: new Date(), payload };
}

