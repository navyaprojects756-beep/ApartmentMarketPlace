import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { prisma } from '../lib/prisma.js';

export const advertisementRouter = Router();
const requestSchema = z.object({ title: z.string().trim().min(2).max(180), description: z.string().max(3000).optional(), type: z.enum(['PROMOTION', 'SELLER_ADVERTISEMENT', 'USER_ADVERTISEMENT', 'PRODUCT_PROMOTION', 'APARTMENT_ANNOUNCEMENT', 'EVENT', 'IMPORTANT_ALERT']), imageUrl: z.string().url().optional(), sellerId: z.string().uuid().optional(), apartmentIds: z.array(z.string().uuid()).max(50).optional(), startAt: z.coerce.date().optional(), endAt: z.coerce.date().optional(), priority: z.number().int().min(0).max(100).default(0) });

advertisementRouter.post('/requests', requireAuth, async (request, response, next) => {
  try {
    const input = requestSchema.parse(request.body);
    const created = await prisma.advertisementRequest.create({ data: { requesterId: request.auth!.userId, sellerId: input.sellerId, title: input.title, description: input.description, type: input.type, imageUrl: input.imageUrl, startAt: input.startAt, endAt: input.endAt, priority: input.priority, targets: { create: (input.apartmentIds ?? []).map(apartmentId => ({ apartmentId })) } }, include: { targets: true } });
    response.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

advertisementRouter.get('/requests/mine', requireAuth, async (request, response, next) => {
  try {
    response.json(await prisma.advertisementRequest.findMany({ where: { requesterId: request.auth!.userId }, include: { targets: { include: { apartment: true } }, seller: true }, orderBy: { createdAt: 'desc' } }));
  } catch (error) {
    next(error);
  }
});

advertisementRouter.get('/requests', requireAuth, requireRole('GLOBAL_ADMIN'), async (_request, response, next) => {
  try {
    response.json(await prisma.advertisementRequest.findMany({ where: { status: 'PENDING' }, include: { requester: true, seller: true, targets: { include: { apartment: true } } }, orderBy: { createdAt: 'asc' } }));
  } catch (error) {
    next(error);
  }
});

advertisementRouter.patch('/requests/:requestId/review', requireAuth, requireRole('GLOBAL_ADMIN'), async (request, response, next) => {
  try {
    const requestId = z.string().uuid().parse(request.params.requestId);
    const input = z.object({ decision: z.enum(['APPROVE', 'REJECT']), adminRemarks: z.string().max(2000).optional() }).parse(request.body);
    const adRequest = await prisma.advertisementRequest.findUnique({ where: { id: requestId }, include: { targets: true } });
    if (!adRequest || adRequest.status !== 'PENDING') {
      response.status(404).json({ error: { code: 'ADVERTISEMENT_REQUEST_NOT_FOUND', message: 'Pending advertisement request not found' } });
      return;
    }
    const status = input.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const result = await prisma.$transaction(async tx => { const updated = await tx.advertisementRequest.update({ where: { id: requestId }, data: { status, adminRemarks: input.adminRemarks, reviewedById: request.auth!.userId, reviewedAt: new Date() } }); if (status === 'APPROVED') await tx.advertisement.create({ data: { requesterId: adRequest.requesterId, sellerId: adRequest.sellerId, title: adRequest.title, description: adRequest.description, imageUrl: adRequest.imageUrl, type: adRequest.type, status: 'APPROVED', startAt: adRequest.startAt, endAt: adRequest.endAt, priority: adRequest.priority, approvedById: request.auth!.userId, approvedAt: new Date(), targets: { create: adRequest.targets.map(target => ({ apartmentId: target.apartmentId })) } } }); await tx.auditLog.create({ data: { actorId: request.auth!.userId, action: `ADVERTISEMENT_${status}`, entityType: 'AdvertisementRequest', entityId: requestId, afterData: { status, adminRemarks: input.adminRemarks } } }); return updated; });
    response.json(result);
  } catch (error) {
    next(error);
  }
});
