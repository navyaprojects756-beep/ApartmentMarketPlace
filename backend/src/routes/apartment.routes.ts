import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.middleware.js';
import { prisma } from '../lib/prisma.js';

export const apartmentRouter = Router();

apartmentRouter.get('/', requireAuth, async (request, response, next) => {
  try {
    const search = z.string().trim().optional().parse(request.query.search);
    const apartments = await prisma.apartment.findMany({ where: { isActive: true, ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}) }, include: { blocks: { where: { isActive: true }, include: { flats: { where: { isActive: true } } } } }, orderBy: { name: 'asc' } });
    response.json(apartments);
  } catch (error) {
    next(error);
  }
});

apartmentRouter.get('/:apartmentId', requireAuth, async (request, response, next) => {
  try {
    const apartmentId = z.string().uuid().parse(request.params.apartmentId);
    const apartment = await prisma.apartment.findFirst({ where: { id: apartmentId, isActive: true }, include: { blocks: { where: { isActive: true }, include: { flats: { where: { isActive: true } } } }, flats: { where: { isActive: true, blockId: null } } } });
    if (!apartment) {
      response.status(404).json({ error: { code: 'APARTMENT_NOT_FOUND', message: 'Apartment not found' } });
      return;
    }
    response.json(apartment);
  } catch (error) {
    next(error);
  }
});

apartmentRouter.post('/me', requireAuth, async (request, response, next) => {
  try {
    const input = z.object({ apartmentId: z.string().uuid(), blockId: z.string().uuid().nullable().optional(), flatId: z.string().uuid().nullable().optional(), manualFlatNumber: z.string().trim().max(40).nullable().optional() }).parse(request.body);
    const apartment = await prisma.apartment.findFirst({ where: { id: input.apartmentId, isActive: true } });
    if (!apartment) {
      response.status(404).json({ error: { code: 'APARTMENT_NOT_FOUND', message: 'Apartment not found' } });
      return;
    }
    if (input.blockId && !(await prisma.block.findFirst({ where: { id: input.blockId, apartmentId: input.apartmentId, isActive: true } }))) {
      response.status(400).json({ error: { code: 'INVALID_BLOCK', message: 'Block does not belong to this apartment' } });
      return;
    }
    if (input.flatId && !(await prisma.flat.findFirst({ where: { id: input.flatId, apartmentId: input.apartmentId, isActive: true } }))) {
      response.status(400).json({ error: { code: 'INVALID_FLAT', message: 'Flat does not belong to this apartment' } });
      return;
    }
    await prisma.userApartment.updateMany({ where: { userId: request.auth!.userId }, data: { isPrimary: false } });
    const association = await prisma.userApartment.upsert({ where: { userId_apartmentId: { userId: request.auth!.userId, apartmentId: input.apartmentId } }, update: { blockId: input.blockId, flatId: input.flatId, manualFlatNumber: input.manualFlatNumber, isPrimary: true }, create: { userId: request.auth!.userId, apartmentId: input.apartmentId, blockId: input.blockId, flatId: input.flatId, manualFlatNumber: input.manualFlatNumber, isPrimary: true } });
    response.status(200).json(association);
  } catch (error) {
    next(error);
  }
});
