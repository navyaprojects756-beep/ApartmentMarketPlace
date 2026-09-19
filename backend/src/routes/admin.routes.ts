import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { prisma } from '../lib/prisma.js';

export const adminRouter = Router();
const modeSchema = z.object({ mode: z.enum(['LOCAL_ONLY', 'OUTSIDE_ONLY', 'BOTH']) });

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
