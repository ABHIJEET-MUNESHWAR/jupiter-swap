import { GraphQLError } from 'graphql';
import {
  base64Tx,
  bps,
  DomainError,
  mintAddress,
  requestId,
  walletAddress,
  type CreateOrderCommand,
  type ExecuteOrderCommand,
  type GetOrderQuery,
} from '@jupiter-swap/core';
import type { Container } from '../container.js';

export interface GraphQLContext {
  container: Container;
  requestKey: string;
}

function toGraphQLError(e: unknown): GraphQLError {
  if (e instanceof DomainError) {
    return new GraphQLError(e.message, {
      extensions: { code: e.code, httpStatus: e.httpStatus, retryable: e.retryable },
    });
  }
  const msg = e instanceof Error ? e.message : String(e);
  return new GraphQLError(msg, { extensions: { code: 'INTERNAL', httpStatus: 500 } });
}

const startedAt = Date.now();

export const resolvers = {
  Query: {
    health: () => ({
      status: 'ok',
      version: process.env.npm_package_version ?? '1.0.0',
      uptimeMs: Date.now() - startedAt,
    }),
    getOrder: async (_: unknown, args: { requestId: string }, ctx: GraphQLContext) => {
      try {
        const q: GetOrderQuery = { type: 'GetOrder', requestId: requestId(args.requestId) };
        return await ctx.container.queryBus.ask(q);
      } catch (e) {
        throw toGraphQLError(e);
      }
    },
  },
  Mutation: {
    createOrder: async (
      _: unknown,
      args: {
        input: {
          inputMint: string; outputMint: string; amount: string;
          taker?: string; slippageBps?: number;
          referralAccount?: string; referralFee?: number;
        };
      },
      ctx: GraphQLContext,
    ) => {
      try {
        const cmd: CreateOrderCommand = {
          type: 'CreateOrder',
          rateLimitKey: ctx.requestKey,
          params: {
            inputMint: mintAddress(args.input.inputMint),
            outputMint: mintAddress(args.input.outputMint),
            amount: args.input.amount,
            ...(args.input.taker ? { taker: walletAddress(args.input.taker) } : {}),
            ...(args.input.slippageBps !== undefined ? { slippageBps: bps(args.input.slippageBps) } : {}),
            ...(args.input.referralAccount && args.input.referralFee !== undefined
              ? {
                  referralAccount: walletAddress(args.input.referralAccount),
                  referralFee: bps(args.input.referralFee),
                }
              : {}),
          },
        };
        return await ctx.container.commandBus.dispatch(cmd);
      } catch (e) {
        throw toGraphQLError(e);
      }
    },

    executeOrder: async (
      _: unknown,
      args: { input: { requestId: string; signedTransaction: string } },
      ctx: GraphQLContext,
    ) => {
      try {
        const cmd: ExecuteOrderCommand = {
          type: 'ExecuteOrder',
          rateLimitKey: ctx.requestKey,
          requestId: requestId(args.input.requestId),
          signedTransaction: base64Tx(args.input.signedTransaction),
        };
        return await ctx.container.commandBus.dispatch(cmd);
      } catch (e) {
        throw toGraphQLError(e);
      }
    },

    askAssistant: async (_: unknown, args: { prompt: string }, ctx: GraphQLContext) => {
      try {
        return await ctx.container.assistant.ask(args.prompt);
      } catch (e) {
        throw toGraphQLError(e);
      }
    },
  },

  Subscription: {
    orderStatus: {
      subscribe: async function* (
        _: unknown,
        args: { requestId: string },
        ctx: GraphQLContext,
      ) {
        const queue: string[] = [];
        let resolveNext: (() => void) | undefined;
        const unsub = ctx.container.bus.subscribe<{ requestId: string; status: string }>(
          'OrderStatusChanged',
          (e) => {
            if (e.payload.requestId === args.requestId) {
              queue.push(e.payload.status);
              resolveNext?.();
            }
          },
        );
        try {
          while (true) {
            if (queue.length === 0) {
              await new Promise<void>((r) => (resolveNext = r));
            }
            while (queue.length) yield { orderStatus: queue.shift()! };
          }
        } finally {
          unsub();
        }
      },
      resolve: (payload: { orderStatus: string }) => payload.orderStatus,
    },
  },
};

