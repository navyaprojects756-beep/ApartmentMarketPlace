import { app } from './app.js';
import { env } from './config/env.js';
import { disconnectPrisma } from './lib/prisma.js';

const server = app.listen(env.PORT, () => {
  console.log(`Apartment Marketplace API listening on http://localhost:${env.PORT}`);
});

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await disconnectPrisma();
    process.exit(0);
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
