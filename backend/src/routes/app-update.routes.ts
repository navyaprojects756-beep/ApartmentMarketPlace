import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

export const appUpdateRouter = Router();

const defaultConfig = {
  latestVersion: '1.0.0',
  minimumVersion: '1.0.0',
  mode: 'OPTIONAL' as const,
  storeUrl: 'https://play.google.com/store/apps/details?id=com.cheritech.gatedcart',
  title: 'A new version is available',
  message: 'Update GatedCart to get the latest improvements.',
};

function readConfig(value?: string | null) {
  if (!value) return defaultConfig;
  try {
    const parsed = JSON.parse(value);
    return { ...defaultConfig, ...parsed };
  } catch {
    return defaultConfig;
  }
}

appUpdateRouter.get('/app-update', async (_request, response, next) => {
  try {
    const setting = await prisma.platformSetting.findUnique({ where: { key: 'mobile_app_update_policy' } });
    response.json(readConfig(setting?.value));
  } catch (error) {
    next(error);
  }
});

export const appUpdateSchema = z.object({
  latestVersion: z.string().regex(/^\d+\.\d+\.\d+$/, 'Use version format X.Y.Z'),
  minimumVersion: z.string().regex(/^\d+\.\d+\.\d+$/, 'Use version format X.Y.Z'),
  mode: z.enum(['OPTIONAL', 'MANDATORY']),
  storeUrl: z.string().url(),
  title: z.string().trim().min(1).max(160),
  message: z.string().trim().min(1).max(500),
});
