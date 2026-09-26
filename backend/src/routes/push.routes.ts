import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.middleware.js';
import { prisma } from '../lib/prisma.js';

export const pushRouter = Router();

const deviceSchema = z.object({ token: z.string().min(10).max(255), platform: z.enum(['android', 'ios']), deviceId: z.string().max(255).optional() });

pushRouter.post('/push-devices', requireAuth, async (request, response, next) => {
  try {
    const input = deviceSchema.parse(request.body);
    const updated = await prisma.$queryRaw<Array<{ id: string }>>`UPDATE push_devices SET user_id = ${request.auth!.userId}::uuid, platform = ${input.platform}, device_id = ${input.deviceId || null}, is_active = true, last_seen_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE token = ${input.token} RETURNING id`;
    const device = updated[0] || (await prisma.$queryRaw<Array<{ id: string }>>`INSERT INTO push_devices (id, user_id, token, platform, device_id, is_active, last_seen_at, created_at, updated_at) VALUES (gen_random_uuid(), ${request.auth!.userId}::uuid, ${input.token}, ${input.platform}, ${input.deviceId || null}, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id`)[0];
    response.status(201).json({ id: device.id, registered: true });
  } catch (error) {
    next(error);
  }
});

pushRouter.delete('/push-devices/:token', requireAuth, async (request, response, next) => {
  try {
    await prisma.$executeRaw`UPDATE push_devices SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE token = ${request.params.token} AND user_id = ${request.auth!.userId}::uuid`;
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});
