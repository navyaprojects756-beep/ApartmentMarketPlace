import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { prisma } from '../lib/prisma.js';

export const adminMonitoringRouter = Router();

adminMonitoringRouter.get('/dashboard', requireAuth, requireRole('GLOBAL_ADMIN'), async (_request, response, next) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const [users, sellers, apartments, ordersToday, pendingAds, activeAds] = await Promise.all([prisma.user.count(), prisma.sellerProfile.count(), prisma.apartment.count({ where: { isActive: true } }), prisma.order.count({ where: { createdAt: { gte: today } } }), prisma.advertisementRequest.count({ where: { status: 'PENDING' } }), prisma.advertisement.count({ where: { status: 'APPROVED' } })]);
    response.json({ users, sellers, apartments, ordersToday, pendingAds, activeAds });
  } catch (error) { next(error); }
});

adminMonitoringRouter.get('/orders', requireAuth, requireRole('GLOBAL_ADMIN'), async (request, response, next) => {
  try {
    const query = z.object({ status: z.enum(['PENDING', 'ACCEPTED', 'REJECTED', 'PREPARING', 'READY_FOR_PICKUP', 'ASSIGNED_TO_DELIVERY_BOY', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED']).optional(), sellerId: z.string().uuid().optional(), apartmentId: z.string().uuid().optional(), search: z.string().trim().max(100).optional() }).parse(request.query);
    const where = { ...(query.status ? { status: query.status } : {}), ...(query.sellerId ? { sellerId: query.sellerId } : {}), ...(query.apartmentId ? { apartmentId: query.apartmentId } : {}), ...(query.search ? { OR: [{ orderNumber: { contains: query.search, mode: 'insensitive' as const } }, { customer: { name: { contains: query.search, mode: 'insensitive' as const } } }, { customer: { phone: { contains: query.search } } }] } : {}) };
    response.json(await prisma.order.findMany({ where, include: { customer: true, seller: true, apartment: true, block: true, flat: true, items: true, deliveryAssignment: { include: { deliveryBoy: { include: { user: true } } } }, statusHistory: { orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'desc' }, take: 200 }));
  } catch (error) { next(error); }
});

adminMonitoringRouter.get('/audit-logs', requireAuth, requireRole('GLOBAL_ADMIN'), async (_request, response, next) => {
  try { response.json(await prisma.auditLog.findMany({ include: { actor: true }, orderBy: { createdAt: 'desc' }, take: 200 })); } catch (error) { next(error); }
});
