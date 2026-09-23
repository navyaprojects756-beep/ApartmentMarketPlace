import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.middleware.js';
import { prisma } from '../lib/prisma.js';
import { getSellerAvailability } from '../utils/seller-hours.js';

export const searchRouter = Router();

searchRouter.get('/', requireAuth, async (request, response, next) => {
  try {
    const input = z.object({ q: z.string().trim().min(2).max(80), type: z.enum(['all', 'sellers', 'products', 'categories']).default('all'), limit: z.coerce.number().int().min(1).max(30).default(10) }).parse(request.query);
    const association = await prisma.userApartment.findFirst({ where: { userId: request.auth!.userId }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] });
    if (!association) { response.json({ sellers: [], products: [], categories: [] }); return; }
    const apartment = await prisma.apartment.findUnique({ where: { id: association.apartmentId }, select: { sellerDisplayMode: true } });
    const mode = apartment?.sellerDisplayMode ?? 'BOTH';
    const sellerVisibility = mode === 'LOCAL_ONLY'
      ? { sellerType: 'APARTMENT' as const, apartmentId: association.apartmentId }
      : mode === 'OUTSIDE_ONLY'
        ? { sellerType: 'OUTSIDE' as const, deliveryAreas: { some: { apartmentId: association.apartmentId, isApproved: true } } }
        : { OR: [{ sellerType: 'APARTMENT' as const, apartmentId: association.apartmentId }, { sellerType: 'OUTSIDE' as const, deliveryAreas: { some: { apartmentId: association.apartmentId, isApproved: true } } }] };
    const visibleSellerWhere = { AND: [{ status: 'APPROVED' as const }, sellerVisibility] };
    const visibleSellers = await prisma.sellerProfile.findMany({ where: visibleSellerWhere, select: { id: true, isOpen: true, operatingHours: { select: { dayOfWeek: true, openTime: true, closeTime: true, isClosed: true } } } });
    const sellerIds = visibleSellers.filter(seller => getSellerAvailability(seller).isOpen).map(item => item.id);
    const sellers = input.type === 'products' || input.type === 'categories' ? [] : await prisma.sellerProfile.findMany({ where: { id: { in: sellerIds }, OR: [{ businessName: { contains: input.q, mode: 'insensitive' } }, { sellerName: { contains: input.q, mode: 'insensitive' } }, { description: { contains: input.q, mode: 'insensitive' } }] }, select: { id: true, businessName: true, sellerName: true, description: true, logoUrl: true, sellerType: true }, take: input.limit, orderBy: { businessName: 'asc' } });
    const sellerSearchSelect = { id: true, businessName: true, sellerName: true, description: true, logoUrl: true, bannerUrl: true, sellerType: true, isOpen: true, deliveryEnabled: true, pickupEnabled: true } as const;
    const categories = input.type === 'sellers' || input.type === 'products' ? [] : await prisma.sellerCategory.findMany({ where: { sellerId: { in: sellerIds }, isActive: true, name: { contains: input.q, mode: 'insensitive' } }, select: { id: true, name: true, sellerId: true, seller: { select: sellerSearchSelect } }, take: input.limit, orderBy: { name: 'asc' } });
    const products = input.type === 'sellers' || input.type === 'categories' ? [] : await prisma.product.findMany({ where: { sellerId: { in: sellerIds }, availability: true, OR: [{ name: { contains: input.q, mode: 'insensitive' } }, { description: { contains: input.q, mode: 'insensitive' } }, { category: { name: { contains: input.q, mode: 'insensitive' } } }] }, select: { id: true, name: true, finalPrice: true, price: true, sellerId: true, category: { select: { name: true } }, seller: { select: sellerSearchSelect } }, take: input.limit, orderBy: { name: 'asc' } });
    response.json({ mode, sellers, categories, products });
  } catch (error) { next(error); }
});
