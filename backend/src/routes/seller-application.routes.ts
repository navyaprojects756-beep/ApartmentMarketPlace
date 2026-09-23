import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { prisma } from '../lib/prisma.js';
import { getPrimaryApartment } from '../services/home.service.js';

export const sellerApplicationRouter = Router();

const applicationSchema = z.object({ sellerType: z.enum(['APARTMENT', 'OUTSIDE']), sellerName: z.string().trim().min(2).max(160), businessName: z.string().trim().min(2).max(160), description: z.string().trim().max(2000).optional(), deliveryApartmentIds: z.array(z.string().uuid()).max(50).optional() });

sellerApplicationRouter.post('/apply', requireAuth, async (request, response, next) => {
  try {
    const input = applicationSchema.parse(request.body);
    const context = await getPrimaryApartment(request.auth!.userId);
    if (!context) {
      response.status(400).json({ error: { code: 'COMMUNITY_REQUIRED', message: 'Select an apartment before applying as a seller' } });
      return;
    }
    if (input.sellerType === 'APARTMENT' && input.deliveryApartmentIds?.some(id => id !== context.apartmentId)) {
      response.status(400).json({ error: { code: 'INVALID_APARTMENT_SCOPE', message: 'Apartment sellers can only serve their own apartment' } });
      return;
    }
    const profile = await prisma.sellerProfile.create({ data: { userId: request.auth!.userId, sellerType: input.sellerType, sellerName: input.sellerName, businessName: input.businessName, description: input.description, apartmentId: input.sellerType === 'APARTMENT' ? context.apartmentId : undefined, status: 'PENDING', deliveryAreas: input.sellerType === 'OUTSIDE' ? { create: (input.deliveryApartmentIds ?? [context.apartmentId]).map(apartmentId => ({ apartmentId, isApproved: false })) } : undefined } });
    response.status(201).json(profile);
  } catch (error) {
    next(error);
  }
});

sellerApplicationRouter.get('/mine', requireAuth, async (request, response, next) => {
  try {
    response.json(await prisma.sellerProfile.findUnique({ where: { userId: request.auth!.userId }, include: { deliveryAreas: { include: { apartment: true } } } }));
  } catch (error) {
    next(error);
  }
});

sellerApplicationRouter.patch('/:sellerId/status', requireAuth, requireRole('GLOBAL_ADMIN'), async (request, response, next) => {
  try {
    const sellerId = z.string().uuid().parse(request.params.sellerId);
    const { status } = z.object({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED', 'INACTIVE']) }).parse(request.body);
    const updated = await prisma.sellerProfile.update({ where: { id: sellerId }, data: { status } });
    try {
      await prisma.auditLog.create({ data: { actorId: request.auth!.userId, action: 'SELLER_STATUS_CHANGED', entityType: 'SellerProfile', entityId: sellerId, afterData: { status } } });
    } catch (auditError) {
      console.error('Seller approval audit failed after the status was saved', auditError);
    }
    response.json(updated);
  } catch (error) {
    next(error);
  }
});
