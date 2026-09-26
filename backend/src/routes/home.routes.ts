import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.middleware.js';
import { getHomeData } from '../services/home.service.js';
import { prisma } from '../lib/prisma.js';

export const homeRouter = Router();

homeRouter.get('/categories', requireAuth, async (_request, response, next) => {
  try { response.json(await prisma.globalCategory.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] })); } catch (error) { next(error); }
});

homeRouter.get('/', requireAuth, async (request, response, next) => {
  try {
    response.json(await getHomeData(request.auth!.userId));
  } catch (error) {
    next(error);
  }
});

homeRouter.get('/categories/:categoryId/products', requireAuth, async (request, response, next) => {
  try {
    const categoryId = z.string().uuid().parse(request.params.categoryId);
    const association = await prisma.userApartment.findFirst({ where: { userId: request.auth!.userId }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }], include: { apartment: true } });
    if (!association) { response.json({ category: null, products: [] }); return; }
    const sellers = await prisma.sellerProfile.findMany({ where: { status: 'APPROVED', isOpen: true, OR: [{ sellerType: 'APARTMENT', apartmentId: association.apartmentId }, { sellerType: 'OUTSIDE', deliveryAreas: { some: { apartmentId: association.apartmentId, isApproved: true } } }] }, select: { id: true } });
    const category = await prisma.globalCategory.findFirst({ where: { id: categoryId, isActive: true } });
    if (!category) { response.status(404).json({ error: { code: 'CATEGORY_NOT_FOUND', message: 'Category not found' } }); return; }
    const products = await prisma.product.findMany({ where: { globalCategoryId: categoryId, sellerId: { in: sellers.map(seller => seller.id) }, availability: true }, include: { images: { orderBy: { sortOrder: 'asc' } }, globalCategory: true, seller: { select: { id: true, sellerName: true, businessName: true, sellerType: true, logoUrl: true, bannerUrl: true, isOpen: true, deliveryEnabled: true, pickupEnabled: true } }, inventory: true }, orderBy: { createdAt: 'asc' }, take: 100 });
    response.json({ category, products });
  } catch (error) { next(error); }
});
