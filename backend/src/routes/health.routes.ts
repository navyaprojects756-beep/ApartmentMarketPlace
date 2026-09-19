import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const healthRouter = Router();

healthRouter.get('/', async (_request, response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    response.json({
      status: 'ok',
      service: 'apartment-marketplace-api',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch {
    response.status(503).json({
      status: 'degraded',
      service: 'apartment-marketplace-api',
      database: 'unavailable',
      timestamp: new Date().toISOString(),
    });
  }
});
