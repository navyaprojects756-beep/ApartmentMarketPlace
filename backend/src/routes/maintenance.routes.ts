import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const maintenanceRouter = Router();

maintenanceRouter.get('/maintenance', async (_request, response, next) => {
  try {
    const setting = await prisma.platformSetting.findUnique({ where: { key: 'maintenance_mode' } });
    const value = setting?.value ? JSON.parse(setting.value) : { enabled: false, message: '' };
    response.json({ enabled: Boolean(value.enabled), message: String(value.message || '') });
  } catch (error) {
    next(error);
  }
});
