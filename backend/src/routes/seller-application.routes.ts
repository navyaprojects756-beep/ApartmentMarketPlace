import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { prisma } from '../lib/prisma.js';
import { getPrimaryApartment } from '../services/home.service.js';

export const sellerApplicationRouter = Router();

const applicationSchema = z.discriminatedUnion('sellerType', [
  z.object({ sellerType: z.literal('APARTMENT'), sellerName: z.string().trim().min(1).max(160), businessName: z.string().trim().min(1).max(160), description: z.string().trim().min(1).max(2000), address: z.string().trim().max(1000).optional(), deliveryApartmentIds: z.array(z.string().uuid()).max(50).optional() }),
  z.object({ sellerType: z.literal('OUTSIDE'), sellerName: z.string().trim().min(1).max(160), businessName: z.string().trim().min(1).max(160), description: z.string().trim().min(1).max(2000), address: z.string().trim().min(1).max(1000), deliveryApartmentIds: z.array(z.string().uuid()).max(50).optional() }),
]);

sellerApplicationRouter.post('/apply', requireAuth, async (request, response, next) => {
  try {
    const input = applicationSchema.parse(request.body);
    const context = await getPrimaryApartment(request.auth!.userId);
    if (input.sellerType === 'APARTMENT' && !context) {
      response.status(400).json({ error: { code: 'COMMUNITY_REQUIRED', message: 'Select an apartment before applying as a seller' } });
      return;
    }
    if (input.sellerType === 'APARTMENT' && input.deliveryApartmentIds?.some(id => id !== context?.apartmentId)) {
      response.status(400).json({ error: { code: 'INVALID_APARTMENT_SCOPE', message: 'Apartment sellers can only serve their own apartment' } });
      return;
    }
    const apartmentIds = input.deliveryApartmentIds || [];
    if (apartmentIds.length) {
      const activeApartments = await prisma.apartment.findMany({ where: { id: { in: apartmentIds }, isActive: true }, select: { id: true } });
      if (activeApartments.length !== apartmentIds.length) {
        response.status(400).json({ error: { code: 'INVALID_DELIVERY_APARTMENTS', message: 'One or more selected apartments are unavailable' } });
        return;
      }
    }
    const profile = await prisma.sellerProfile.create({ data: { userId: request.auth!.userId, sellerType: input.sellerType, sellerName: input.sellerName, businessName: input.businessName, description: input.description, address: input.address, apartmentId: input.sellerType === 'APARTMENT' ? context!.apartmentId : undefined, status: 'PENDING', deliveryAreas: input.sellerType === 'OUTSIDE' ? { create: apartmentIds.map(apartmentId => ({ apartmentId, isApproved: false })) } : undefined } });
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

sellerApplicationRouter.patch('/:sellerId/delivery-areas', requireAuth, requireRole('GLOBAL_ADMIN'), async (request, response, next) => {
  try {
    const sellerId = z.string().uuid().parse(request.params.sellerId);
    const { apartmentIds } = z.object({ apartmentIds: z.array(z.string().uuid()).max(100) }).parse(request.body);
    const seller = await prisma.sellerProfile.findUnique({ where: { id: sellerId }, select: { id: true, sellerType: true } });
    if (!seller) { response.status(404).json({ error: { code: 'SELLER_NOT_FOUND', message: 'Seller was not found' } }); return; }
    if (seller.sellerType !== 'OUTSIDE') { response.status(400).json({ error: { code: 'APARTMENT_SELLER_SCOPE', message: 'Only outside sellers can have delivery areas' } }); return; }
    const apartments = await prisma.apartment.findMany({ where: { id: { in: apartmentIds }, isActive: true }, select: { id: true } });
    if (apartments.length !== apartmentIds.length) { response.status(400).json({ error: { code: 'INVALID_DELIVERY_APARTMENTS', message: 'One or more selected apartments are unavailable' } }); return; }
    const updated = await prisma.$transaction(async tx => {
      const existing = await tx.sellerDeliveryArea.findMany({ where: { sellerId }, select: { apartmentId: true, isEnabled: true } });
      const selected = new Set(apartmentIds);
      for (const area of existing) {
        await tx.sellerDeliveryArea.update({ where: { sellerId_apartmentId: { sellerId, apartmentId: area.apartmentId } }, data: { isApproved: selected.has(area.apartmentId), isEnabled: selected.has(area.apartmentId) ? area.isEnabled : false } });
      }
      const existingIds = new Set(existing.map(area => area.apartmentId));
      const missing = apartmentIds.filter(apartmentId => !existingIds.has(apartmentId));
      if (missing.length) await tx.sellerDeliveryArea.createMany({ data: missing.map(apartmentId => ({ sellerId, apartmentId, isApproved: true, isEnabled: true })) });
      return tx.sellerDeliveryArea.findMany({ where: { sellerId }, include: { apartment: true }, orderBy: { apartment: { name: 'asc' } } });
    });
    response.json(updated);
  } catch (error) { next(error); }
});

sellerApplicationRouter.patch('/:sellerId/status', requireAuth, requireRole('GLOBAL_ADMIN'), async (request, response, next) => {
  try {
    const sellerId = z.string().uuid().parse(request.params.sellerId);
    const { status } = z.object({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED', 'INACTIVE']) }).parse(request.body);
    const updated = await prisma.$transaction(async tx => {
      const seller = await tx.sellerProfile.update({ where: { id: sellerId }, data: { status } });
      const role = await tx.role.findUniqueOrThrow({ where: { code: seller.sellerType === 'OUTSIDE' ? 'OUTSIDE_SELLER' : 'APARTMENT_SELLER' } });
      if (status === 'APPROVED') {
        await tx.userRole.upsert({ where: { userId_roleId: { userId: seller.userId, roleId: role.id } }, update: {}, create: { userId: seller.userId, roleId: role.id } });
      } else {
        await tx.userRole.deleteMany({ where: { userId: seller.userId, roleId: role.id } });
      }
      return seller;
    });
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
