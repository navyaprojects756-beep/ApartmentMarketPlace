import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { prisma } from '../lib/prisma.js';

export const adminResourcesRouter = Router();
const adminOnly = [requireAuth, requireRole('GLOBAL_ADMIN')];

adminResourcesRouter.get('/apartments', ...adminOnly, async (_request, response, next) => {
  try { response.json(await prisma.apartment.findMany({ include: { blocks: { include: { flats: true } }, _count: { select: { residents: true, apartmentSellers: true } } }, orderBy: { name: 'asc' } })); } catch (error) { next(error); }
});

adminResourcesRouter.post('/apartments', ...adminOnly, async (request, response, next) => {
  try {
    const input = z.object({ name: z.string().trim().min(2).max(160), address: z.string().max(1000).optional(), city: z.string().max(100).optional(), state: z.string().max(100).optional(), pincode: z.string().max(20).optional(), hasBlocks: z.boolean().default(false), hasPredefinedFlats: z.boolean().default(false) }).parse(request.body);
    const apartment = await prisma.apartment.create({ data: input });
    await prisma.auditLog.create({ data: { actorId: request.auth!.userId, action: 'APARTMENT_CREATED', entityType: 'Apartment', entityId: apartment.id, afterData: input } });
    response.status(201).json(apartment);
  } catch (error) { next(error); }
});

adminResourcesRouter.patch('/apartments/:apartmentId', ...adminOnly, async (request, response, next) => {
  try {
    const apartmentId = z.string().uuid().parse(request.params.apartmentId);
    const input = z.object({ name: z.string().trim().min(2).max(160).optional(), address: z.string().max(1000).nullable().optional(), city: z.string().max(100).nullable().optional(), state: z.string().max(100).nullable().optional(), pincode: z.string().max(20).nullable().optional(), hasBlocks: z.boolean().optional(), hasPredefinedFlats: z.boolean().optional(), isActive: z.boolean().optional() }).parse(request.body);
    const updated = await prisma.apartment.update({ where: { id: apartmentId }, data: input });
    await prisma.auditLog.create({ data: { actorId: request.auth!.userId, action: 'APARTMENT_UPDATED', entityType: 'Apartment', entityId: apartmentId, afterData: input } });
    response.json(updated);
  } catch (error) { next(error); }
});

adminResourcesRouter.post('/apartments/:apartmentId/blocks', ...adminOnly, async (request, response, next) => {
  try { const apartmentId = z.string().uuid().parse(request.params.apartmentId); const input = z.object({ name: z.string().trim().min(1).max(80) }).parse(request.body); response.status(201).json(await prisma.block.create({ data: { apartmentId, name: input.name } })); } catch (error) { next(error); }
});

adminResourcesRouter.post('/blocks/:blockId/flats', ...adminOnly, async (request, response, next) => {
  try { const blockId = z.string().uuid().parse(request.params.blockId); const block = await prisma.block.findUniqueOrThrow({ where: { id: blockId } }); const input = z.object({ number: z.string().trim().min(1).max(40) }).parse(request.body); response.status(201).json(await prisma.flat.create({ data: { apartmentId: block.apartmentId, blockId, number: input.number } })); } catch (error) { next(error); }
});

adminResourcesRouter.patch('/blocks/:blockId', ...adminOnly, async (request, response, next) => {
  try {
    const blockId = z.string().uuid().parse(request.params.blockId);
    const input = z.object({ name: z.string().trim().min(1).max(80).optional(), isActive: z.boolean().optional() }).parse(request.body);
    response.json(await prisma.block.update({ where: { id: blockId }, data: input }));
  } catch (error) { next(error); }
});

adminResourcesRouter.patch('/flats/:flatId', ...adminOnly, async (request, response, next) => {
  try {
    const flatId = z.string().uuid().parse(request.params.flatId);
    const input = z.object({ number: z.string().trim().min(1).max(40).optional(), isActive: z.boolean().optional() }).parse(request.body);
    response.json(await prisma.flat.update({ where: { id: flatId }, data: input }));
  } catch (error) { next(error); }
});

adminResourcesRouter.post('/apartments/:apartmentId/blocks/:blockId/flats/bulk', ...adminOnly, async (request, response, next) => {
  try {
    const apartmentId = z.string().uuid().parse(request.params.apartmentId);
    const blockId = z.string().uuid().parse(request.params.blockId);
    const input = z.object({ numbers: z.array(z.string().trim().min(1).max(40)).min(1).max(1000) }).parse(request.body);
    const block = await prisma.block.findFirst({ where: { id: blockId, apartmentId } });
    if (!block) { response.status(404).json({ error: { code: 'BLOCK_NOT_FOUND', message: 'Block not found in this apartment' } }); return; }
    const flats = await prisma.$transaction(input.numbers.map(number => prisma.flat.upsert({ where: { apartmentId_blockId_number: { apartmentId, blockId, number } }, update: { isActive: true }, create: { apartmentId, blockId, number } })));
    response.status(201).json({ created: flats.length, flats });
  } catch (error) { next(error); }
});

adminResourcesRouter.get('/users', ...adminOnly, async (request, response, next) => {
  try { const search = z.string().trim().optional().parse(request.query.search); response.json(await prisma.user.findMany({ where: search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }] } : {}, include: { roles: { include: { role: true } }, apartments: { include: { apartment: true } } }, orderBy: { createdAt: 'desc' }, take: 500 })); } catch (error) { next(error); }
});

adminResourcesRouter.patch('/users/:userId', ...adminOnly, async (request, response, next) => {
  try {
    const userId = z.string().uuid().parse(request.params.userId);
    const input = z.object({ name: z.string().trim().max(120).nullable().optional(), isActive: z.boolean().optional(), roles: z.array(z.enum(['CUSTOMER', 'APARTMENT_SELLER', 'OUTSIDE_SELLER', 'DELIVERY_BOY', 'GLOBAL_ADMIN'])).min(1).optional() }).parse(request.body);
    const existing = await prisma.user.findUnique({ where: { id: userId }, include: { roles: { include: { role: true } } } });
    if (!existing) { response.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } }); return; }
    if (input.isActive === false && existing.roles.some(item => item.role.code === 'GLOBAL_ADMIN')) {
      const activeAdmins = await prisma.user.count({ where: { isActive: true, roles: { some: { role: { code: 'GLOBAL_ADMIN' } } } } });
      if (activeAdmins <= 1) { response.status(400).json({ error: { code: 'FINAL_ADMIN_PROTECTED', message: 'The final active Global Admin cannot be deactivated' } }); return; }
    }
    const updated = await prisma.$transaction(async tx => {
      const user = await tx.user.update({ where: { id: userId }, data: { name: input.name, isActive: input.isActive } });
      if (input.roles) {
        const roleRecords = await tx.role.findMany({ where: { code: { in: input.roles } } });
        await tx.userRole.deleteMany({ where: { userId } });
        await tx.userRole.createMany({ data: roleRecords.map(role => ({ userId, roleId: role.id })) });
        const sellerType = input.roles.includes('OUTSIDE_SELLER') ? 'OUTSIDE' : input.roles.includes('APARTMENT_SELLER') ? 'APARTMENT' : null;
        if (sellerType && !(await tx.sellerProfile.findUnique({ where: { userId } }))) {
          const primaryApartment = await tx.userApartment.findFirst({ where: { userId, isPrimary: true } });
          await tx.sellerProfile.create({ data: { userId, sellerType, sellerName: user.name || user.phone, businessName: user.name || user.phone, apartmentId: sellerType === 'APARTMENT' ? primaryApartment?.apartmentId : undefined, status: 'PENDING', isOpen: false } });
        }
      }
      await tx.auditLog.create({ data: { actorId: request.auth!.userId, action: 'USER_UPDATED', entityType: 'User', entityId: userId, beforeData: { isActive: existing.isActive, roles: existing.roles.map(item => item.role.code) }, afterData: { isActive: input.isActive, roles: input.roles } } });
      return tx.user.findUnique({ where: { id: userId }, include: { roles: { include: { role: true } }, apartments: { include: { apartment: true } } } });
    });
    response.json(updated);
  } catch (error) { next(error); }
});

adminResourcesRouter.get('/sellers', ...adminOnly, async (_request, response, next) => {
  try { response.json(await prisma.sellerProfile.findMany({ include: { user: true, apartment: true, deliveryAreas: { include: { apartment: true } } }, orderBy: { createdAt: 'desc' } })); } catch (error) { next(error); }
});

adminResourcesRouter.post('/alerts', ...adminOnly, async (request, response, next) => {
  try {
    const input = z.object({ title: z.string().trim().min(2).max(180), description: z.string().max(3000).optional(), imageUrl: z.string().url().optional(), apartmentIds: z.array(z.string().uuid()).optional(), startAt: z.coerce.date().optional(), endAt: z.coerce.date().optional(), priority: z.number().int().min(0).max(100).default(100) }).parse(request.body);
    const alert = await prisma.advertisement.create({ data: { requesterId: request.auth!.userId, title: input.title, description: input.description, imageUrl: input.imageUrl, type: 'IMPORTANT_ALERT', status: 'APPROVED', priority: input.priority, startAt: input.startAt, endAt: input.endAt, approvedById: request.auth!.userId, approvedAt: new Date(), targets: { create: (input.apartmentIds ?? []).map(apartmentId => ({ apartmentId })) } }, include: { targets: { include: { apartment: true } } } });
    const recipients = await prisma.userApartment.findMany({ where: input.apartmentIds?.length ? { apartmentId: { in: input.apartmentIds } } : {}, select: { userId: true }, distinct: ['userId'] });
    if (recipients.length) await prisma.notification.createMany({ data: recipients.map(recipient => ({ userId: recipient.userId, type: 'IMPORTANT_ALERT' as const, title: input.title, message: input.description || input.title, data: { advertisementId: alert.id } })) });
    await prisma.auditLog.create({ data: { actorId: request.auth!.userId, action: 'IMPORTANT_ALERT_CREATED', entityType: 'Advertisement', entityId: alert.id, afterData: { title: input.title, apartmentIds: input.apartmentIds } } });
    response.status(201).json(alert);
  } catch (error) { next(error); }
});

adminResourcesRouter.get('/alerts', ...adminOnly, async (_request, response, next) => {
  try { response.json(await prisma.advertisement.findMany({ where: { type: 'IMPORTANT_ALERT' }, include: { targets: { include: { apartment: true } } }, orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }] })); } catch (error) { next(error); }
});
