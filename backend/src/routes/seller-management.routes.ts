import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.middleware.js';
import { prisma } from '../lib/prisma.js';

export const sellerManagementRouter = Router();

async function sellerForUser(userId: string) {
  return prisma.sellerProfile.findUnique({ where: { userId } });
}

sellerManagementRouter.get('/dashboard', requireAuth, async (request, response, next) => {
  try {
    const seller = await sellerForUser(request.auth!.userId);
    if (!seller) { response.status(403).json({ error: { code: 'SELLER_REQUIRED', message: 'Seller access is required' } }); return; }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const [orders, products, lowStock] = await Promise.all([
      prisma.order.findMany({ where: { sellerId: seller.id, createdAt: { gte: today } }, select: { status: true, total: true } }),
      prisma.product.count({ where: { sellerId: seller.id, availability: true } }),
      prisma.inventory.count({ where: { product: { sellerId: seller.id }, quantity: { lte: 5 } } }),
    ]);
    response.json({ seller, today: { orders: orders.length, sales: orders.filter(order => ['DELIVERED', 'COMPLETED'].includes(order.status)).reduce((sum, order) => sum + Number(order.total), 0), byStatus: orders.reduce<Record<string, number>>((result, order) => { result[order.status] = (result[order.status] ?? 0) + 1; return result; }, {}) }, products, lowStock });
  } catch (error) { next(error); }
});

sellerManagementRouter.get('/settings', requireAuth, async (request, response, next) => {
  try {
    const seller = await sellerForUser(request.auth!.userId);
    if (!seller) { response.status(403).json({ error: { code: 'SELLER_REQUIRED', message: 'Seller access is required' } }); return; }
    response.json(await prisma.sellerProfile.findUnique({ where: { id: seller.id }, include: { apartment: true, operatingHours: { orderBy: { dayOfWeek: 'asc' } }, deliveryAreas: { include: { apartment: true } } } }));
  } catch (error) { next(error); }
});

sellerManagementRouter.patch('/settings', requireAuth, async (request, response, next) => {
  try {
    const seller = await sellerForUser(request.auth!.userId);
    if (!seller) { response.status(403).json({ error: { code: 'SELLER_REQUIRED', message: 'Seller access is required' } }); return; }
    const input = z.object({ businessName: z.string().trim().min(2).max(160).optional(), description: z.string().max(3000).nullable().optional(), address: z.string().max(1000).nullable().optional(), logoUrl: z.string().url().nullable().optional(), bannerUrl: z.string().url().nullable().optional(), isOpen: z.boolean().optional(), deliveryEnabled: z.boolean().optional(), pickupEnabled: z.boolean().optional(), minimumOrder: z.number().nonnegative().nullable().optional(), deliveryCharge: z.number().nonnegative().nullable().optional(), operatingHours: z.array(z.object({ dayOfWeek: z.number().int().min(0).max(6), openTime: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/).nullable().optional(), closeTime: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/).nullable().optional(), isClosed: z.boolean().default(false) })).max(7).optional() }).parse(request.body);
    const updated = await prisma.$transaction(async tx => {
      const sellerUpdate = await tx.sellerProfile.update({ where: { id: seller.id }, data: { businessName: input.businessName, description: input.description, address: input.address, logoUrl: input.logoUrl, bannerUrl: input.bannerUrl, isOpen: input.isOpen, deliveryEnabled: input.deliveryEnabled, pickupEnabled: input.pickupEnabled, minimumOrder: input.minimumOrder, deliveryCharge: input.deliveryCharge } });
      if (input.operatingHours) for (const hour of input.operatingHours) await tx.sellerOperatingHour.upsert({ where: { sellerId_dayOfWeek: { sellerId: seller.id, dayOfWeek: hour.dayOfWeek } }, update: hour, create: { sellerId: seller.id, ...hour } });
      return sellerUpdate;
    });
    response.json(updated);
  } catch (error) { next(error); }
});

sellerManagementRouter.get('/delivery-areas', requireAuth, async (request, response, next) => {
  try { const seller = await sellerForUser(request.auth!.userId); if (!seller) { response.status(403).json({ error: { code: 'SELLER_REQUIRED', message: 'Seller access is required' } }); return; } response.json(await prisma.sellerDeliveryArea.findMany({ where: { sellerId: seller.id }, include: { apartment: true }, orderBy: { apartment: { name: 'asc' } } })); } catch (error) { next(error); }
});

sellerManagementRouter.put('/delivery-areas', requireAuth, async (request, response, next) => {
  try {
    const seller = await sellerForUser(request.auth!.userId); if (!seller) { response.status(403).json({ error: { code: 'SELLER_REQUIRED', message: 'Seller access is required' } }); return; }
    if (seller.sellerType !== 'OUTSIDE') { response.status(400).json({ error: { code: 'APARTMENT_SELLER_SCOPE', message: 'Apartment sellers are limited to their own apartment' } }); return; }
    const input = z.object({ apartmentIds: z.array(z.string().uuid()).max(100) }).parse(request.body);
    const result = await prisma.$transaction(async tx => { await tx.sellerDeliveryArea.deleteMany({ where: { sellerId: seller.id } }); if (input.apartmentIds.length) await tx.sellerDeliveryArea.createMany({ data: input.apartmentIds.map(apartmentId => ({ sellerId: seller.id, apartmentId, isApproved: false })) }); return tx.sellerDeliveryArea.findMany({ where: { sellerId: seller.id }, include: { apartment: true } }); });
    response.json({ status: 'PENDING_APPROVAL', areas: result });
  } catch (error) { next(error); }
});

sellerManagementRouter.get('/catalog', requireAuth, async (request, response, next) => {
  try { const seller = await sellerForUser(request.auth!.userId); if (!seller) { response.status(403).json({ error: { code: 'SELLER_REQUIRED', message: 'Seller access is required' } }); return; } response.json(await prisma.product.findMany({ where: { sellerId: seller.id }, include: { category: true, inventory: true, images: { orderBy: { sortOrder: 'asc' } } }, orderBy: { createdAt: 'desc' } })); } catch (error) { next(error); }
});

sellerManagementRouter.get('/orders', requireAuth, async (request, response, next) => {
  try {
    const seller = await sellerForUser(request.auth!.userId);
    if (!seller) { response.status(403).json({ error: { code: 'SELLER_REQUIRED', message: 'Seller access is required' } }); return; }
    const query = z.object({ status: z.enum(['PENDING', 'ACCEPTED', 'REJECTED', 'PREPARING', 'READY_FOR_PICKUP', 'ASSIGNED_TO_DELIVERY_BOY', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED']).optional(), fulfillmentType: z.enum(['DELIVERY', 'PICKUP']).optional(), from: z.coerce.date().optional(), to: z.coerce.date().optional(), search: z.string().trim().max(120).optional(), apartmentId: z.string().uuid().optional() }).parse(request.query);
    const where = { sellerId: seller.id, ...(query.status ? { status: query.status } : {}), ...(query.fulfillmentType ? { fulfillmentType: query.fulfillmentType } : {}), ...(query.apartmentId ? { apartmentId: query.apartmentId } : {}), ...(query.from || query.to ? { createdAt: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } } : {}), ...(query.search ? { OR: [{ orderNumber: { contains: query.search, mode: 'insensitive' as const } }, { customer: { name: { contains: query.search, mode: 'insensitive' as const } } }, { customer: { phone: { contains: query.search } } }] } : {}) };
    response.json(await prisma.order.findMany({ where, include: { customer: true, apartment: true, block: true, flat: true, address: true, items: true, deliveryAssignment: { include: { deliveryBoy: { include: { user: true } } } }, statusHistory: { orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'desc' }, take: 500 }));
  } catch (error) { next(error); }
});

sellerManagementRouter.post('/categories', requireAuth, async (request, response, next) => {
  try {
    const seller = await sellerForUser(request.auth!.userId);
    if (!seller) { response.status(403).json({ error: { code: 'SELLER_REQUIRED', message: 'Seller access is required' } }); return; }
    const input = z.object({ name: z.string().trim().min(2).max(100), imageUrl: z.string().url().optional(), sortOrder: z.number().int().default(0) }).parse(request.body);
    response.status(201).json(await prisma.sellerCategory.create({ data: { sellerId: seller.id, ...input } }));
  } catch (error) { next(error); }
});

sellerManagementRouter.patch('/categories/:categoryId', requireAuth, async (request, response, next) => {
  try {
    const seller = await sellerForUser(request.auth!.userId);
    const categoryId = z.string().uuid().parse(request.params.categoryId);
    const input = z.object({ name: z.string().trim().min(2).max(100).optional(), imageUrl: z.string().url().nullable().optional(), sortOrder: z.number().int().optional(), isActive: z.boolean().optional() }).parse(request.body);
    const category = await prisma.sellerCategory.findFirst({ where: { id: categoryId, sellerId: seller?.id } });
    if (!category) { response.status(404).json({ error: { code: 'CATEGORY_NOT_FOUND', message: 'Category not found' } }); return; }
    response.json(await prisma.sellerCategory.update({ where: { id: categoryId }, data: input }));
  } catch (error) { next(error); }
});

sellerManagementRouter.post('/products', requireAuth, async (request, response, next) => {
  try {
    const seller = await sellerForUser(request.auth!.userId);
    if (!seller) { response.status(403).json({ error: { code: 'SELLER_REQUIRED', message: 'Seller access is required' } }); return; }
    const input = z.object({ categoryId: z.string().uuid().optional(), name: z.string().trim().min(2).max(180), description: z.string().max(3000).optional(), sku: z.string().max(80).optional(), price: z.number().nonnegative(), discount: z.number().nonnegative().default(0), unit: z.string().max(40).optional(), inventoryTracking: z.boolean().default(false), quantity: z.number().int().nonnegative().default(0), lowStockLevel: z.number().int().nonnegative().default(5), minimumQuantity: z.number().int().positive().default(1), maximumQuantity: z.number().int().positive().optional(), preparationTimeMin: z.number().int().nonnegative().optional(), deliveryEligible: z.boolean().default(true), pickupEligible: z.boolean().default(true) }).parse(request.body);
    const finalPrice = Math.max(0, input.price - input.discount);
    const product = await prisma.$transaction(async tx => { const created = await tx.product.create({ data: { sellerId: seller.id, categoryId: input.categoryId, name: input.name, description: input.description, sku: input.sku, price: input.price, discount: input.discount, finalPrice, unit: input.unit, inventoryTracking: input.inventoryTracking, minimumQuantity: input.minimumQuantity, maximumQuantity: input.maximumQuantity, preparationTimeMin: input.preparationTimeMin, deliveryEligible: input.deliveryEligible, pickupEligible: input.pickupEligible, inventory: { create: { quantity: input.quantity, lowStockLevel: input.lowStockLevel } } } }); if (input.inventoryTracking && input.quantity > 0) await tx.inventoryMovement.create({ data: { productId: created.id, type: 'INITIAL_STOCK', quantity: input.quantity, reason: 'Initial product stock' } }); return created; });
    response.status(201).json(product);
  } catch (error) { next(error); }
});

sellerManagementRouter.patch('/products/:productId', requireAuth, async (request, response, next) => {
  try {
    const seller = await sellerForUser(request.auth!.userId);
    const productId = z.string().uuid().parse(request.params.productId);
    const input = z.object({ categoryId: z.string().uuid().nullable().optional(), name: z.string().trim().min(2).max(180).optional(), description: z.string().max(3000).nullable().optional(), price: z.number().nonnegative().optional(), discount: z.number().nonnegative().optional(), availability: z.boolean().optional(), minimumQuantity: z.number().int().positive().optional(), maximumQuantity: z.number().int().positive().nullable().optional() }).parse(request.body);
    const product = await prisma.product.findFirst({ where: { id: productId, sellerId: seller?.id } });
    if (!product) { response.status(404).json({ error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' } }); return; }
    const price = input.price ?? Number(product.price); const discount = input.discount ?? Number(product.discount);
    response.json(await prisma.product.update({ where: { id: productId }, data: { ...input, price, discount, finalPrice: Math.max(0, price - discount) } }));
  } catch (error) { next(error); }
});

sellerManagementRouter.post('/products/:productId/images', requireAuth, async (request, response, next) => {
  try {
    const seller = await sellerForUser(request.auth!.userId);
    const productId = z.string().uuid().parse(request.params.productId);
    const input = z.object({ imageUrl: z.string().url(), sortOrder: z.number().int().nonnegative().default(0) }).parse(request.body);
    const product = await prisma.product.findFirst({ where: { id: productId, sellerId: seller?.id } });
    if (!product) { response.status(404).json({ error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' } }); return; }
    response.status(201).json(await prisma.productImage.create({ data: { productId, ...input } }));
  } catch (error) { next(error); }
});

sellerManagementRouter.delete('/products/:productId/images/:imageId', requireAuth, async (request, response, next) => {
  try {
    const seller = await sellerForUser(request.auth!.userId);
    const productId = z.string().uuid().parse(request.params.productId);
    const imageId = z.string().uuid().parse(request.params.imageId);
    const image = await prisma.productImage.findFirst({ where: { id: imageId, productId, product: { sellerId: seller?.id } } });
    if (!image) { response.status(404).json({ error: { code: 'IMAGE_NOT_FOUND', message: 'Product image not found' } }); return; }
    await prisma.productImage.delete({ where: { id: imageId } });
    response.status(204).send();
  } catch (error) { next(error); }
});

sellerManagementRouter.post('/products/:productId/duplicate', requireAuth, async (request, response, next) => {
  try {
    const seller = await sellerForUser(request.auth!.userId);
    const productId = z.string().uuid().parse(request.params.productId);
    const source = await prisma.product.findFirst({ where: { id: productId, sellerId: seller?.id }, include: { images: true, inventory: true } });
    if (!source) { response.status(404).json({ error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' } }); return; }
    const input = z.object({ name: z.string().trim().min(2).max(180).optional(), sku: z.string().max(80).optional() }).parse(request.body);
    const duplicate = await prisma.product.create({ data: { sellerId: source.sellerId, categoryId: source.categoryId, name: input.name || `${source.name} copy`, description: source.description, sku: input.sku, price: source.price, discount: source.discount, finalPrice: source.finalPrice, unit: source.unit, inventoryTracking: source.inventoryTracking, availability: false, minimumQuantity: source.minimumQuantity, maximumQuantity: source.maximumQuantity, preparationTimeMin: source.preparationTimeMin, deliveryEligible: source.deliveryEligible, pickupEligible: source.pickupEligible, images: { create: source.images.map(image => ({ imageUrl: image.imageUrl, sortOrder: image.sortOrder })) }, inventory: { create: { quantity: 0, lowStockLevel: source.inventory?.lowStockLevel ?? 0 } } } });
    response.status(201).json(duplicate);
  } catch (error) { next(error); }
});

sellerManagementRouter.post('/inventory/:productId/adjust', requireAuth, async (request, response, next) => {
  try {
    const seller = await sellerForUser(request.auth!.userId);
    const productId = z.string().uuid().parse(request.params.productId);
    const input = z.object({ quantityDelta: z.number().int(), reason: z.string().max(500).optional() }).parse(request.body);
    const product = await prisma.product.findFirst({ where: { id: productId, sellerId: seller?.id }, include: { inventory: true } });
    if (!product?.inventory) { response.status(404).json({ error: { code: 'INVENTORY_NOT_FOUND', message: 'Tracked inventory not found' } }); return; }
    const inventory = await prisma.$transaction(async tx => { const current = await tx.inventory.findUniqueOrThrow({ where: { productId } }); const nextQuantity = current.quantity + input.quantityDelta; if (nextQuantity < 0) throw new Error('STOCK_CANNOT_BE_NEGATIVE'); const updated = await tx.inventory.update({ where: { productId }, data: { quantity: nextQuantity } }); await tx.inventoryMovement.create({ data: { productId, inventoryId: current.id, type: input.quantityDelta >= 0 ? 'MANUAL_ADD' : 'MANUAL_REMOVE', quantity: input.quantityDelta, reason: input.reason } }); return updated; });
    response.json(inventory);
  } catch (error) { next(error); }
});

sellerManagementRouter.get('/delivery-boys', requireAuth, async (request, response, next) => {
  try {
    const seller = await sellerForUser(request.auth!.userId);
    if (!seller) { response.status(403).json({ error: { code: 'SELLER_REQUIRED', message: 'Seller access is required' } }); return; }
    response.json(await prisma.deliveryBoy.findMany({ where: { sellers: { some: { sellerId: seller.id } } }, include: { user: true, apartments: { include: { apartment: true } } } }));
  } catch (error) { next(error); }
});

sellerManagementRouter.post('/delivery-boys', requireAuth, async (request, response, next) => {
  try {
    const seller = await sellerForUser(request.auth!.userId);
    if (!seller) { response.status(403).json({ error: { code: 'SELLER_REQUIRED', message: 'Seller access is required' } }); return; }
    const input = z.object({ phone: z.string().regex(/^\+?[0-9]{10,15}$/), name: z.string().min(2).max(120), apartmentIds: z.array(z.string().uuid()).min(1).max(50) }).parse(request.body);
    const deliveryRole = await prisma.role.findUniqueOrThrow({ where: { code: 'DELIVERY_BOY' } });
    const result = await prisma.$transaction(async tx => { const user = await tx.user.upsert({ where: { phone: input.phone }, update: { name: input.name }, create: { phone: input.phone, name: input.name } }); await tx.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: deliveryRole.id } }, update: {}, create: { userId: user.id, roleId: deliveryRole.id } }); const deliveryBoy = await tx.deliveryBoy.upsert({ where: { userId: user.id }, update: { isActive: true }, create: { userId: user.id } }); await tx.deliveryBoySeller.upsert({ where: { deliveryBoyId_sellerId: { deliveryBoyId: deliveryBoy.id, sellerId: seller.id } }, update: {}, create: { deliveryBoyId: deliveryBoy.id, sellerId: seller.id } }); for (const apartmentId of input.apartmentIds) await tx.deliveryBoyApartment.upsert({ where: { deliveryBoyId_apartmentId: { deliveryBoyId: deliveryBoy.id, apartmentId } }, update: {}, create: { deliveryBoyId: deliveryBoy.id, apartmentId } }); return deliveryBoy; });
    response.status(201).json(result);
  } catch (error) { next(error); }
});
