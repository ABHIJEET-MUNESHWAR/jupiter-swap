import type { SwapOrder } from '../../domain/entities.js';
import type { OrderRepository } from '../../domain/ports.js';
import type { RequestId } from '../../domain/types/brand.js';

/** In-memory repository — handy for dev & tests. Production should use the
 *  partitioned Postgres repo (see `infra/postgres/init.sql`). */
export class InMemoryOrderRepository implements OrderRepository {
  private readonly store = new Map<string, SwapOrder>();

  async save(entity: SwapOrder): Promise<void> {
    this.store.set(entity.requestId, entity);
  }

  async findById(id: RequestId): Promise<SwapOrder | null> {
    return this.store.get(id) ?? null;
  }

  size(): number {
    return this.store.size;
  }
}

