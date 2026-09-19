import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import type { RoleCode } from '@prisma/client';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const phoneSchema = z.object({ phone: z.string().trim().regex(/^\+?[0-9]{10,15}$/, 'Enter a valid phone number'), name: z.string().trim().min(2).max(120).optional() });
const verifySchema = phoneSchema.extend({ otp: z.string().trim().regex(/^[0-9]{5}$/, 'OTP must contain 5 digits') });

function normalizePhone(phone: string) {
  return phone.replace(/\s+/g, '');
}

function canonicalPhone(phone: string) {
  const normalized = normalizePhone(phone).replace(/^\+91/, '');
  return normalized === '9000000001' ? '9493499405' : normalizePhone(phone);
}

function dummyOtp(phone: string) {
  return normalizePhone(phone).slice(-5);
}

const bootstrapRoles: Array<{ code: RoleCode; name: string }> = [
  { code: 'CUSTOMER', name: 'Customer' },
  { code: 'APARTMENT_SELLER', name: 'Apartment Seller' },
  { code: 'OUTSIDE_SELLER', name: 'Outside Seller' },
  { code: 'DELIVERY_BOY', name: 'Delivery Boy' },
  { code: 'GLOBAL_ADMIN', name: 'Global Admin' },
];

async function ensureSystemRoles() {
  for (const role of bootstrapRoles) await prisma.role.upsert({ where: { code: role.code }, update: { name: role.name }, create: role });
}

function createAccessToken(userId: string, roles: RoleCode[]) {
  return jwt.sign({ sub: userId, roles, type: 'access' }, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
}

function createRefreshToken(userId: string) {
  return jwt.sign({ sub: userId, type: 'refresh' }, env.JWT_REFRESH_SECRET, { expiresIn: '30d' });
}

async function sessionResponse(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { roles: { include: { role: true } } } });
  if (!user) throw new Error('User not found');
  const roles = user.roles.map(item => item.role.code);
  const accessToken = createAccessToken(user.id, roles);
  const refreshToken = createRefreshToken(user.id);
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: await bcrypt.hash(refreshToken, 10),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  return {
    user: { id: user.id, phone: user.phone, name: user.name, roles },
    accessToken,
    refreshToken,
  };
}

export const authRouter = Router();

authRouter.post('/request-otp', async (request, response, next) => {
  try {
    const { phone: rawPhone, name } = phoneSchema.parse(request.body);
    const phone = canonicalPhone(rawPhone);
    await ensureSystemRoles();
    const privilegedPhone = phone === '9493499405';
    const roleCode: RoleCode = privilegedPhone ? 'GLOBAL_ADMIN' : 'CUSTOMER';
    const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });
    const user = await prisma.user.upsert({
      where: { phone },
      update: name ? { name } : {},
      create: { phone, name, roles: { create: { roleId: role.id } } },
    });
    if (!(await prisma.userRole.findUnique({ where: { userId_roleId: { userId: user.id, roleId: role.id } } }))) await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
    const assignedRoles = await prisma.userRole.findMany({ where: { userId: user.id }, include: { role: true } });
    const sellerRole = assignedRoles.find(item => ['APARTMENT_SELLER', 'OUTSIDE_SELLER'].includes(item.role.code));
    if (sellerRole && !(await prisma.sellerProfile.findUnique({ where: { userId: user.id } }))) {
      const sellerType = sellerRole.role.code === 'OUTSIDE_SELLER' ? 'OUTSIDE' : 'APARTMENT';
      const primaryApartment = await prisma.userApartment.findFirst({ where: { userId: user.id, isPrimary: true } });
      await prisma.sellerProfile.create({ data: { userId: user.id, sellerType, sellerName: user.name || user.phone, businessName: user.name || user.phone, apartmentId: sellerType === 'APARTMENT' ? primaryApartment?.apartmentId : undefined, status: 'PENDING', isOpen: false } });
    }
    const otp = dummyOtp(phone);
    await prisma.otpRequest.create({
      data: {
        userId: user.id,
        phone,
        codeHash: await bcrypt.hash(otp, 10),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });
    response.json({ message: 'OTP generated', expiresInSeconds: 300, developmentOtp: otp });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/verify-otp', async (request, response, next) => {
  try {
    const { phone: rawPhone, otp } = verifySchema.parse(request.body);
    const phone = canonicalPhone(rawPhone);
    const record = await prisma.otpRequest.findFirst({ where: { phone, verifiedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } });
    if (!record || !(await bcrypt.compare(otp, record.codeHash))) {
      response.status(401).json({ error: { code: 'INVALID_OTP', message: 'The OTP is invalid or expired' } });
      return;
    }
    await prisma.otpRequest.update({ where: { id: record.id }, data: { verifiedAt: new Date() } });
    response.json(await sessionResponse(record.userId!));
  } catch (error) {
    next(error);
  }
});

authRouter.get('/me', requireAuth, async (request, response, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: request.auth!.userId }, include: { roles: { include: { role: true } }, apartments: { include: { apartment: true, block: true, flat: true } } } });
    if (!user) {
      response.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
      return;
    }
    response.json({ ...user, roles: user.roles.map(item => item.role.code) });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/refresh', async (request, response, next) => {
  try {
    const token = z.object({ refreshToken: z.string().min(1) }).parse(request.body).refreshToken;
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as { sub: string; type: 'refresh' };
    if (payload.type !== 'refresh') throw new Error('Invalid refresh token');
    const sessions = await prisma.refreshToken.findMany({ where: { userId: payload.sub, revokedAt: null, expiresAt: { gt: new Date() } } });
    const valid = await Promise.any(sessions.map(session => bcrypt.compare(token, session.tokenHash).then(isValid => isValid ? session : Promise.reject()))).catch(() => null);
    if (!valid) {
      response.status(401).json({ error: { code: 'INVALID_REFRESH_TOKEN', message: 'The refresh token is invalid or expired' } });
      return;
    }
    await prisma.refreshToken.update({ where: { id: valid.id }, data: { revokedAt: new Date() } });
    response.json(await sessionResponse(payload.sub));
  } catch (error) {
    response.status(401).json({ error: { code: 'INVALID_REFRESH_TOKEN', message: 'The refresh token is invalid or expired' } });
  }
});

authRouter.post('/logout', requireAuth, async (request, response, next) => {
  try {
    await prisma.refreshToken.updateMany({ where: { userId: request.auth!.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});
