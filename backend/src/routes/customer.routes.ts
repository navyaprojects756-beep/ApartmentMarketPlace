import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.middleware.js';
import { prisma } from '../lib/prisma.js';

export const customerRouter = Router();

customerRouter.patch('/profile', requireAuth, async (request, response, next) => {
  try {
    const input = z.object({ name: z.string().trim().min(2).max(120) }).parse(request.body);
    response.json(await prisma.user.update({ where: { id: request.auth!.userId }, data: { name: input.name }, select: { id: true, phone: true, name: true } }));
  } catch (error) { next(error); }
});

customerRouter.get('/addresses', requireAuth, async (request, response, next) => {
  try {
    response.json(await prisma.address.findMany({ where: { userId: request.auth!.userId }, include: { apartment: true, block: true, flat: true }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] }));
  } catch (error) {
    next(error);
  }
});

customerRouter.post('/addresses', requireAuth, async (request, response, next) => {
  try {
    const input = z.object({ apartmentId: z.string().uuid(), blockId: z.string().uuid().nullable().optional(), flatId: z.string().uuid().nullable().optional(), manualFlatNumber: z.string().max(40).nullable().optional(), label: z.string().max(80).optional(), addressLine: z.string().max(1000).optional(), isDefault: z.boolean().default(false) }).parse(request.body);
    const address = await prisma.$transaction(async tx => { if (input.isDefault) await tx.address.updateMany({ where: { userId: request.auth!.userId }, data: { isDefault: false } }); return tx.address.create({ data: { ...input, userId: request.auth!.userId } }); });
    response.status(201).json(address);
  } catch (error) {
    next(error);
  }
});

customerRouter.patch('/addresses/:addressId', requireAuth, async (request, response, next) => {
  try {
    const addressId = z.string().uuid().parse(request.params.addressId);
    const input = z.object({ label: z.string().max(80).optional(), addressLine: z.string().max(1000).optional(), isDefault: z.boolean().optional() }).parse(request.body);
    const existing = await prisma.address.findFirst({ where: { id: addressId, userId: request.auth!.userId } });
    if (!existing) { response.status(404).json({ error: { code: 'ADDRESS_NOT_FOUND', message: 'Address not found' } }); return; }
    const address = await prisma.$transaction(async tx => { if (input.isDefault) await tx.address.updateMany({ where: { userId: request.auth!.userId }, data: { isDefault: false } }); return tx.address.update({ where: { id: addressId }, data: input }); });
    response.json(address);
  } catch (error) {
    next(error);
  }
});

customerRouter.get('/notifications', requireAuth, async (request, response, next) => {
  try {
    response.json(await prisma.notification.findMany({ where: { userId: request.auth!.userId }, include: { reads: { where: { userId: request.auth!.userId } } }, orderBy: { createdAt: 'desc' }, take: 100 }));
  } catch (error) { next(error); }
});

customerRouter.get('/important-alerts', requireAuth, async (request, response, next) => {
  try {
    const association = await prisma.userApartment.findFirst({ where: { userId: request.auth!.userId }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] });
    const now = new Date();
    const alerts = await prisma.advertisement.findMany({ where: { type: 'IMPORTANT_ALERT', status: 'APPROVED', AND: [{ OR: [{ startAt: null }, { startAt: { lte: now } }] }, { OR: [{ endAt: null }, { endAt: { gte: now } }] }, ...(association ? [{ OR: [{ targets: { none: {} } }, { targets: { some: { apartmentId: association.apartmentId } } }] }] : [])] }, include: { targets: true }, orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }], take: 20 });
    const notifications = await prisma.notification.findMany({ where: { userId: request.auth!.userId, type: 'IMPORTANT_ALERT' }, include: { reads: { where: { userId: request.auth!.userId } } } });
    response.json(alerts.map(alert => { const notification = notifications.find(item => (item.data as { advertisementId?: string } | null)?.advertisementId === alert.id); const read = notification?.reads[0]; return { ...alert, notificationId: notification?.id ?? null, readAt: read?.readAt ?? null, dismissedAt: read?.dismissedAt ?? null }; }));
  } catch (error) { next(error); }
});

customerRouter.post('/notifications/:notificationId/read', requireAuth, async (request, response, next) => {
  try {
    const notificationId = z.string().uuid().parse(request.params.notificationId);
    response.json(await prisma.notificationRead.upsert({ where: { notificationId_userId: { notificationId, userId: request.auth!.userId } }, update: { readAt: new Date() }, create: { notificationId, userId: request.auth!.userId } }));
  } catch (error) { next(error); }
});

customerRouter.post('/notifications/:notificationId/dismiss', requireAuth, async (request, response, next) => {
  try {
    const notificationId = z.string().uuid().parse(request.params.notificationId);
    response.json(await prisma.notificationRead.upsert({ where: { notificationId_userId: { notificationId, userId: request.auth!.userId } }, update: { dismissedAt: new Date(), readAt: new Date() }, create: { notificationId, userId: request.auth!.userId, dismissedAt: new Date() } }));
  } catch (error) { next(error); }
});

customerRouter.post('/reviews', requireAuth, async (request, response, next) => {
  try {
    const input = z.object({ orderId: z.string().uuid(), sellerId: z.string().uuid(), productId: z.string().uuid().optional(), rating: z.number().int().min(1).max(5), text: z.string().max(2000).optional() }).parse(request.body);
    const order = await prisma.order.findFirst({ where: { id: input.orderId, customerId: request.auth!.userId, sellerId: input.sellerId, status: { in: ['DELIVERED', 'COMPLETED'] }, ...(input.productId ? { items: { some: { productId: input.productId } } } : {}) } });
    if (!order) { response.status(400).json({ error: { code: 'REVIEW_NOT_ELIGIBLE', message: 'Only completed orders can be reviewed' } }); return; }
    const existing = await prisma.review.findFirst({ where: { userId: request.auth!.userId, orderId: input.orderId, productId: input.productId ?? null } });
    if (existing) { response.status(409).json({ error: { code: 'REVIEW_ALREADY_EXISTS', message: 'This order item has already been reviewed' } }); return; }
    const review = await prisma.review.create({ data: { userId: request.auth!.userId, orderId: input.orderId, sellerId: input.sellerId, productId: input.productId, rating: input.rating, text: input.text } });
    response.status(201).json(review);
  } catch (error) { next(error); }
});
