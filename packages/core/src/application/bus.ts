/**
 * Minimal generic CQRS buses (Command + Query).
 *
 * Generics give compile-time safety: a `CommandBus.dispatch(cmd)` call returns
 * exactly the type its registered handler returns.
 *
 * Big-O: register O(1), dispatch O(1) (Map lookup + handler exec).
 */
export interface Command<R = unknown> {
  readonly type: string;
  readonly __resultType?: R; // phantom type to drive inference
}

export interface CommandHandler<C extends Command<R>, R = unknown> {
  handle(cmd: C): Promise<R>;
}

export class CommandBus {
  private readonly handlers = new Map<string, CommandHandler<Command<unknown>, unknown>>();

  register<C extends Command<R>, R>(type: string, handler: CommandHandler<C, R>): void {
    this.handlers.set(type, handler as CommandHandler<Command<unknown>, unknown>);
  }

  async dispatch<R, C extends Command<R>>(cmd: C): Promise<R> {
    const h = this.handlers.get(cmd.type);
    if (!h) throw new Error(`No handler registered for command "${cmd.type}"`);
    return (await h.handle(cmd)) as R;
  }
}

export interface Query<R = unknown> {
  readonly type: string;
  readonly __resultType?: R;
}

export interface QueryHandler<Q extends Query<R>, R = unknown> {
  handle(q: Q): Promise<R>;
}

export class QueryBus {
  private readonly handlers = new Map<string, QueryHandler<Query<unknown>, unknown>>();

  register<Q extends Query<R>, R>(type: string, handler: QueryHandler<Q, R>): void {
    this.handlers.set(type, handler as QueryHandler<Query<unknown>, unknown>);
  }

  async ask<R, Q extends Query<R>>(q: Q): Promise<R> {
    const h = this.handlers.get(q.type);
    if (!h) throw new Error(`No handler registered for query "${q.type}"`);
    return (await h.handle(q)) as R;
  }
}

