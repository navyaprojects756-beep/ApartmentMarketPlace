import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.middleware.js';
import { prisma } from '../lib/prisma.js';
import { getPrimaryApartment } from '../services/home.service.js';
import { getSellerAvailability } from '../utils/seller-hours.js';

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
        ...(context.apartment.sellerDisplayMode === 'LOCAL_ONLY' ? { sellerType: 'APARTMENT', apartmentId: context.apartmentId } : context.apartment.sellerDisplayMode === 'OUTSIDE_ONLY' ? { sellerType: 'OUTSIDE', deliveryAreas: { some: { apartmentId: context.apartmentId, isApproved: true, isEnabled: true } } } : { OR: [{ sellerType: 'APARTMENT', apartmentId: context.apartmentId }, { sellerType: 'OUTSIDE', deliveryAreas: { some: { apartmentId: context.apartmentId, isApproved: true, isEnabled: true } } }] }),
      },
      include: { operatingHours: true, categories: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } }, reviews: { where: { productId: null }, select: { rating: true } } },
      orderBy: { createdAt: 'asc' },
    });
    response.json(sellers.filter(seller => getSellerAvailability(seller).isOpen).map(seller => { const reviews = seller.reviews || []; const showRatings = (seller as any).showRatings === true; const { reviews: _reviews, ...visibleSeller } = seller; return { ...visibleSeller, rating: showRatings && reviews.length ? Number((reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length).toFixed(1)) : null, reviewCount: showRatings ? reviews.length : 0 }; }));
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
    const visibility = context.apartment.sellerDisplayMode === 'LOCAL_ONLY'
      ? { sellerType: 'APARTMENT' as const, apartmentId: context.apartmentId }
      : context.apartment.sellerDisplayMode === 'OUTSIDE_ONLY'
        ? { sellerType: 'OUTSIDE' as const, deliveryAreas: { some: { apartmentId: context.apartmentId, isApproved: true, isEnabled: true } } }
        : { OR: [{ sellerType: 'APARTMENT' as const, apartmentId: context.apartmentId }, { sellerType: 'OUTSIDE' as const, deliveryAreas: { some: { apartmentId: context.apartmentId, isApproved: true, isEnabled: true } } }] };
    const seller = await prisma.sellerProfile.findFirst({ where: { id: sellerId, status: 'APPROVED', ...visibility }, include: { reviews: { where: { productId: null }, select: { rating: true } }, operatingHours: { orderBy: { dayOfWeek: 'asc' } }, categories: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } }, advertisements: { where: { status: 'APPROVED', OR: [{ startAt: null }, { startAt: { lte: new Date() } }], AND: [{ OR: [{ endAt: null }, { endAt: { gte: new Date() } }] }] }, orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }], take: 3 }, advertisementReqs: { where: { status: 'PENDING', type: 'SELLER_ADVERTISEMENT' }, orderBy: { createdAt: 'desc' }, take: 3 }, products: { where: { availability: true }, include: { reviews: { select: { rating: true } }, images: { orderBy: { sortOrder: 'asc' } }, category: true, globalCategory: true, inventory: true }, orderBy: { createdAt: 'asc' } } } });
    if (!seller) {
      response.status(404).json({ error: { code: 'SELLER_NOT_FOUND', message: 'Seller is not available in your apartment' } });
      return;
    }
    if (!getSellerAvailability(seller).isOpen) {
      response.status(404).json({ error: { code: 'SELLER_CLOSED', message: 'This seller is currently closed' } });
      return;
    }
    const sellerUser = await prisma.user.findUnique({ where: { id: seller.userId }, select: { phone: true, apartments: { where: { isPrimary: true }, include: { apartment: true, block: true, flat: true } } } });
    const sellerRatings = seller.reviews || [];
    const showRatings = (seller as any).showRatings === true;
    const { reviews: _sellerReviews, ...sellerWithoutReviews } = seller;
    response.json({ ...sellerWithoutReviews, rating: showRatings && sellerRatings.length ? Number((sellerRatings.reduce((sum, item) => sum + item.rating, 0) / sellerRatings.length).toFixed(1)) : null, reviewCount: showRatings ? sellerRatings.length : 0, products: seller.products.map(product => { const { reviews, ...visibleProduct } = product; return { ...visibleProduct, rating: showRatings && reviews.length ? Number((reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length).toFixed(1)) : null, reviewCount: showRatings ? reviews.length : 0 }; }), user: sellerUser });
  } catch (error) {
    next(error);
  }
});

sellerRouter.get('/:sellerId/reviews', requireAuth, async (request, response, next) => {
  try {
    const sellerId = z.string().uuid().parse(request.params.sellerId);
    const context = await getPrimaryApartment(request.auth!.userId);
    const seller = context ? await prisma.sellerProfile.findFirst({ where: { id: sellerId, status: 'APPROVED', OR: [{ sellerType: 'APARTMENT', apartmentId: context.apartmentId }, { sellerType: 'OUTSIDE', deliveryAreas: { some: { apartmentId: context.apartmentId, isApproved: true, isEnabled: true } } }] }, select: { id: true } }) : null;
    if (!seller) { response.status(404).json({ error: { code: 'SELLER_NOT_FOUND', message: 'Seller is not available in your apartment' } }); return; }
    const [reviews, aggregate] = await Promise.all([
      prisma.review.findMany({ where: { sellerId, productId: null }, select: { id: true, rating: true, text: true, productId: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 20 }),
      prisma.review.aggregate({ where: { sellerId, productId: null }, _avg: { rating: true }, _count: { _all: true } }),
    ]);
    response.json({ averageRating: aggregate._avg.rating ?? 0, reviewCount: aggregate._count._all, reviews });
  } catch (error) { next(error); }
});
