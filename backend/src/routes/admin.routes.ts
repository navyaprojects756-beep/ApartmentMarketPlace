import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { prisma } from '../lib/prisma.js';

export const adminRouter = Router();
const modeSchema = z.object({ mode: z.enum(['LOCAL_ONLY', 'OUTSIDE_ONLY', 'BOTH']) });
const homePromotionSchema = z.object({ imageUrls: z.array(z.string().url()).min(1).max(10), endAt: z.coerce.date().nullable().optional() });

adminRouter.get('/home-promotions', requireAuth, requireRole('GLOBAL_ADMIN'), async (_request, response, next) => {
  try {
    response.json(await prisma.advertisement.findMany({ where: { type: 'PROMOTION', sellerId: null }, orderBy: { createdAt: 'desc' } }));
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/home-promotions', requireAuth, requireRole('GLOBAL_ADMIN'), async (request, response, next) => {
  try {
    const input = homePromotionSchema.parse(request.body);
    const created = await prisma.$transaction(input.imageUrls.map(imageUrl => prisma.advertisement.create({ data: { requesterId: request.auth!.userId, title: 'Home promotion', imageUrl, imageUrls: [imageUrl], type: 'PROMOTION', status: 'APPROVED', endAt: input.endAt ?? null, approvedById: request.auth!.userId, approvedAt: new Date() } })));
    response.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/home-promotions/:id', requireAuth, requireRole('GLOBAL_ADMIN'), async (request, response, next) => {
  try {
    const id = z.string().uuid().parse(request.params.id);
    const input = z.object({ isActive: z.boolean().optional(), endAt: z.coerce.date().nullable().optional() }).parse(request.body);
    const updated = await prisma.advertisement.update({ where: { id }, data: { status: input.isActive === undefined ? undefined : input.isActive ? 'APPROVED' : 'CANCELLED', endAt: input.endAt } });
    response.json(updated);
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/home-promotions/:id', requireAuth, requireRole('GLOBAL_ADMIN'), async (request, response, next) => {
  try {
    const id = z.string().uuid().parse(request.params.id);
    await prisma.advertisement.delete({ where: { id } });
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/settings/home-seller-display-mode', requireAuth, requireRole('GLOBAL_ADMIN'), async (_request, response, next) => {
  try {
    const setting = await prisma.platformSetting.findUnique({ where: { key: 'home_seller_display_mode' } });
    response.json({ mode: setting?.value ?? 'BOTH' });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/settings/home-seller-display-mode', requireAuth, requireRole('GLOBAL_ADMIN'), async (request, response, next) => {
  try {
    const { mode } = modeSchema.parse(request.body);
    const previous = await prisma.platformSetting.findUnique({ where: { key: 'home_seller_display_mode' } });
    const setting = await prisma.platformSetting.upsert({ where: { key: 'home_seller_display_mode' }, update: { value: mode, updatedById: request.auth!.userId }, create: { key: 'home_seller_display_mode', value: mode, description: 'Controls local/outside seller visibility on customer home', updatedById: request.auth!.userId } });
    await prisma.auditLog.create({ data: { actorId: request.auth!.userId, action: 'HOME_SELLER_DISPLAY_MODE_CHANGED', entityType: 'PlatformSetting', entityId: setting.id, beforeData: previous ? { mode: previous.value } : undefined, afterData: { mode } } });
    response.json({ mode: setting.value });
  } catch (error) {
    next(error);
  }
});
