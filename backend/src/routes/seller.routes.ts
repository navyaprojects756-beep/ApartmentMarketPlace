import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.middleware.js';
import { prisma } from '../lib/prisma.js';
import { getPrimaryApartment } from '../services/home.service.js';

export const sellerRouter = Router();

sellerRouter.get('/', requireAuth, async (request, response, next) => {
  try {
    const context = await getPrimaryApartment(request.auth!.userId);
    const type = z.enum(['APARTMENT', 'OUTSIDE']).optional().parse(request.query.type);
    if (!context) {
      response.json([]);
      return;
    }
    const sellers = await prisma.sellerProfile.findMany({
      where: {
        status: 'APPROVED',
        ...(type ? { sellerType: type } : {}),
        OR: [
          { sellerType: 'APARTMENT', apartmentId: context.apartmentId },
          { sellerType: 'OUTSIDE', deliveryAreas: { some: { apartmentId: context.apartmentId, isApproved: true } } },
        ],
      },
      include: { categories: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
    response.json(sellers);
  } catch (error) {
    next(error);
  }
});

sellerRouter.get('/:sellerId', requireAuth, async (request, response, next) => {
  try {
    const sellerId = z.string().uuid().parse(request.params.sellerId);
    const context = await getPrimaryApartment(request.auth!.userId);
    if (!context) {
      response.status(403).json({ error: { code: 'COMMUNITY_REQUIRED', message: 'Select an apartment first' } });
      return;
    }
    const seller = await prisma.sellerProfile.findFirst({ where: { id: sellerId, status: 'APPROVED', OR: [{ sellerType: 'APARTMENT', apartmentId: context.apartmentId }, { sellerType: 'OUTSIDE', deliveryAreas: { some: { apartmentId: context.apartmentId, isApproved: true } } }] }, include: { categories: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } }, advertisements: { where: { status: 'APPROVED', OR: [{ startAt: null }, { startAt: { lte: new Date() } }], AND: [{ OR: [{ endAt: null }, { endAt: { gte: new Date() } }] }] }, orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }], take: 3 }, products: { where: { availability: true }, include: { images: { orderBy: { sortOrder: 'asc' } }, category: true }, orderBy: { createdAt: 'asc' } } } });
    if (!seller) {
      response.status(404).json({ error: { code: 'SELLER_NOT_FOUND', message: 'Seller is not available in your apartment' } });
      return;
    }
    response.json(seller);
  } catch (error) {
    next(error);
  }
});

sellerRouter.get('/:sellerId/reviews', requireAuth, async (request, response, next) => {
  try {
    const sellerId = z.string().uuid().parse(request.params.sellerId);
    const context = await getPrimaryApartment(request.auth!.userId);
    const seller = context ? await prisma.sellerProfile.findFirst({ where: { id: sellerId, status: 'APPROVED', OR: [{ sellerType: 'APARTMENT', apartmentId: context.apartmentId }, { sellerType: 'OUTSIDE', deliveryAreas: { some: { apartmentId: context.apartmentId, isApproved: true } } }] }, select: { id: true } }) : null;
    if (!seller) { response.status(404).json({ error: { code: 'SELLER_NOT_FOUND', message: 'Seller is not available in your apartment' } }); return; }
    const [reviews, aggregate] = await Promise.all([
      prisma.review.findMany({ where: { sellerId }, include: { user: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 20 }),
      prisma.review.aggregate({ where: { sellerId }, _avg: { rating: true }, _count: { _all: true } }),
    ]);
    response.json({ averageRating: aggregate._avg.rating ?? 0, reviewCount: aggregate._count._all, reviews });
  } catch (error) { next(error); }
});
