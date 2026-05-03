import { buildServer } from './server.js';
import { loadEnv } from '@jupiter-swap/config';

async function main(): Promise<void> {
  const env = loadEnv();
  const { app, container } = await buildServer();
  await app.listen({ port: env.API_PORT, host: '0.0.0.0' });
  container.logger.info({ port: env.API_PORT }, '🚀 Jupiter Swap API ready');
  container.logger.info({}, `   GraphQL → http://localhost:${env.API_PORT}/graphql`);
  container.logger.info({}, `   Health  → http://localhost:${env.API_PORT}/health`);
  container.logger.info({}, `   Metrics → http://localhost:${env.API_PORT}/metrics`);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('Fatal startup error:', e);
  process.exit(1);
});

