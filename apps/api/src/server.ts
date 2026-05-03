import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createYoga } from 'graphql-yoga';
import { createSchema } from 'graphql-yoga';
import { typeDefs } from './schema/typeDefs.js';
import { resolvers, type GraphQLContext } from './schema/resolvers.js';
import { buildContainer, type Container } from './container.js';
import { registry } from '@jupiter-swap/core';

export interface ServerOptions {
  container?: Container;
}

export async function buildServer(options: ServerOptions = {}) {
  const container = options.container ?? buildContainer();
  const app = Fastify({ logger: false });

  await app.register(cors, { origin: true });

  const yoga = createYoga<{ req: import('fastify').FastifyRequest }>({
    schema: createSchema({ typeDefs, resolvers: resolvers as never }),
    graphqlEndpoint: '/graphql',
    landingPage: false,
    context: ({ req }): GraphQLContext => ({
      container,
      requestKey:
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.ip ||
        'anonymous',
    }),
  });

  app.route({
    url: '/graphql',
    method: ['GET', 'POST', 'OPTIONS'],
    handler: async (req, reply) => {
      const response = await yoga.handleNodeRequestAndResponse(req, reply, { req });
      response.headers.forEach((v, k) => reply.header(k, v));
      reply.status(response.status);
      reply.send(response.body);
      return reply;
    },
  });

  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/metrics', async (_req, reply) => {
    reply.header('Content-Type', registry.contentType);
    return registry.metrics();
  });

  return { app, container };
}

