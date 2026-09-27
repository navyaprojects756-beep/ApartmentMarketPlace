import { Router } from 'express';
import { z } from 'zod';
import { recordErrorLog } from '../services/error-log.service.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

export const clientErrorsRouter = Router();
const clientErrorSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  stack: z.string().max(12000).optional(),
  code: z.string().max(120).optional(),
  context: z.string().max(160).optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

clientErrorsRouter.post('/client-errors', (request, response) => {
  const input = clientErrorSchema.safeParse(request.body);
  if (!input.success) { response.status(202).json({ accepted: false }); return; }
  recordErrorLog({ source: 'WEB', error: new Error(input.data.message), code: input.data.code, details: { context: input.data.context, stack: input.data.stack, ...input.data.details }, request: request as never, userId: null });
  response.status(202).json({ accepted: true });
});

async function listErrorLogs(request: Parameters<typeof requireAuth>[0], response: Parameters<typeof requireAuth>[1], next: Parameters<typeof requireAuth>[2]) {
  try {
    const limit = Math.min(Number(request.query.limit) || 100, 500);
    const logs = await prisma.errorLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit, include: { user: { select: { id: true, name: true, phone: true } } } });
    response.json(logs);
  } catch (error) { next(error); }
}

clientErrorsRouter.get('/admin/error-logs', requireAuth, requireRole('GLOBAL_ADMIN'), listErrorLogs);
clientErrorsRouter.get('/error-logs', requireAuth, requireRole('GLOBAL_ADMIN'), listErrorLogs);
