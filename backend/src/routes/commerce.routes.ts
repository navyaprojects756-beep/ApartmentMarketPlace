import { Router } from 'express';
import { Prisma, type OrderStatus } from '@prisma/client';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.middleware.js';
import { prisma } from '../lib/prisma.js';
import { getPrimaryApartment } from '../services/home.service.js';
import { getSellerAvailability } from '../utils/seller-hours.js';

export const commerceRouter = Router();

const cartItemSchema = z.object({ productId: z.string().uuid(), quantity: z.number().int().positive() });
const checkoutSchema = z.object({ sellerId: z.string().uuid(), items: z.array(cartItemSchema).min(1), fulfillmentType: z.enum(['DELIVERY', 'PICKUP']), paymentMethod: z.enum(['CASH_ON_DELIVERY', 'DUMMY_PAYMENT']), addressId: z.string().uuid().optional(), customerNotes: z.string().max(2000).optional() });

async function sellerIsVisible(userId: string, sellerId: string) {
  const context = await getPrimaryApartment(userId);
  if (!context) return false;
  return Boolean(await prisma.sellerProfile.findFirst({ where: { id: sellerId, status: 'APPROVED', OR: [{ sellerType: 'APARTMENT', apartmentId: context.apartmentId }, { sellerType: 'OUTSIDE', deliveryAreas: { some: { apartmentId: context.apartmentId, isApproved: true } } }] } }));
}

commerceRouter.get('/carts/:sellerId', requireAuth, async (request, response, next) => {
  try {
    const sellerId = z.string().uuid().parse(request.params.sellerId);
    if (!(await sellerIsVisible(request.auth!.userId, sellerId))) {
      response.status(404).json({ error: { code: 'SELLER_NOT_FOUND', message: 'Seller is not available in your apartment' } });
      return;
    }
    response.json(await prisma.cart.findUnique({ where: { userId_sellerId: { userId: request.auth!.userId, sellerId } }, include: { items: { include: { product: true } }, seller: true } }));
  } catch (error) {
    next(error);
  }
});

commerceRouter.post('/carts/:sellerId/items', requireAuth, async (request, response, next) => {
  try {
    const sellerId = z.string().uuid().parse(request.params.sellerId);
    const item = cartItemSchema.parse(request.body);
    if (!(await sellerIsVisible(request.auth!.userId, sellerId))) {
      response.status(404).json({ error: { code: 'SELLER_NOT_FOUND', message: 'Seller is not available in your apartment' } });
      return;
    }
    const product = await prisma.product.findFirst({ where: { id: item.productId, sellerId, availability: true } });
    if (!product) {
      response.status(404).json({ error: { code: 'PRODUCT_NOT_FOUND', message: 'Product is unavailable' } });
      return;
    }
    const cart = await prisma.cart.upsert({ where: { userId_sellerId: { userId: request.auth!.userId, sellerId } }, update: {}, create: { userId: request.auth!.userId, sellerId } });
    const cartItem = await prisma.cartItem.upsert({ where: { cartId_productId: { cartId: cart.id, productId: product.id } }, update: { quantity: item.quantity }, create: { cartId: cart.id, productId: product.id, quantity: item.quantity } });
    response.status(201).json(cartItem);
  } catch (error) {
    next(error);
  }
});

commerceRouter.post('/orders', requireAuth, async (request, response, next) => {
  try {
    const input = checkoutSchema.parse(request.body);
    const context = await getPrimaryApartment(request.auth!.userId);
    if (!context || !(await sellerIsVisible(request.auth!.userId, input.sellerId))) {
      response.status(400).json({ error: { code: 'INVALID_COMMUNITY_SCOPE', message: 'Select a valid apartment and seller' } });
      return;
    }
    const order = await prisma.$transaction(async tx => {
      const seller = await tx.sellerProfile.findUniqueOrThrow({ where: { id: input.sellerId }, include: { operatingHours: true } });
      const availability = getSellerAvailability(seller);
      if (!availability.isOpen) throw new Error(availability.reason || 'STORE_CLOSED');
      if (input.fulfillmentType === 'DELIVERY' && !seller.deliveryEnabled) throw new Error('DELIVERY_NOT_AVAILABLE');
      if (input.fulfillmentType === 'PICKUP' && !seller.pickupEnabled) throw new Error('PICKUP_NOT_AVAILABLE');
      const products = await tx.product.findMany({ where: { id: { in: input.items.map(item => item.productId) }, sellerId: input.sellerId, availability: true } });
      if (products.length !== input.items.length) throw new Error('PRODUCT_SCOPE_INVALID');
      let subtotal = new Prisma.Decimal(0);
      const orderItems: Array<{ productId: string; productName: string; quantity: number; unitPrice: Prisma.Decimal; discount: Prisma.Decimal; totalPrice: Prisma.Decimal }> = [];
      for (const item of input.items) {
        const product = products.find(record => record.id === item.productId)!;
        if (product.maximumQuantity && item.quantity > product.maximumQuantity) throw new Error('MAXIMUM_QUANTITY_EXCEEDED');
        if (item.quantity < product.minimumQuantity) throw new Error('MINIMUM_QUANTITY_NOT_MET');
        if (product.inventoryTracking) {
          await tx.$queryRaw`SELECT id FROM inventory WHERE product_id = ${product.id}::uuid FOR UPDATE`;
          const inventory = await tx.inventory.findUnique({ where: { productId: product.id } });
          if (!inventory || inventory.quantity < item.quantity) throw new Error('INSUFFICIENT_STOCK');
          await tx.inventory.update({ where: { productId: product.id }, data: { quantity: { decrement: item.quantity } } });
        }
        const totalPrice = product.finalPrice.mul(item.quantity);
        subtotal = subtotal.add(totalPrice);
        orderItems.push({ productId: product.id, productName: product.name, quantity: item.quantity, unitPrice: product.finalPrice, discount: product.discount, totalPrice });
      }
      const deliveryCharge = input.fulfillmentType === 'DELIVERY' ? (seller.deliveryCharge ?? new Prisma.Decimal(0)) : new Prisma.Decimal(0);
      const total = subtotal.add(deliveryCharge);
      const created = await tx.order.create({ data: { orderNumber: `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`, customerId: request.auth!.userId, sellerId: seller.id, apartmentId: context.apartmentId, blockId: context.blockId, flatId: context.flatId, addressId: input.addressId, subtotal, discount: 0, deliveryCharge, total, paymentMethod: input.paymentMethod, paymentStatus: input.paymentMethod === 'DUMMY_PAYMENT' ? 'PAID' : 'PENDING', fulfillmentType: input.fulfillmentType, customerNotes: input.customerNotes, items: { create: orderItems }, statusHistory: { create: { toStatus: 'PENDING' } } } });
      for (const item of orderItems) {
        const product = products.find(record => record.id === item.productId)!;
        if (product.inventoryTracking) await tx.inventoryMovement.create({ data: { productId: product.id, type: 'SALE', quantity: -item.quantity, orderId: created.id, reason: `Order ${created.orderNumber}` } });
      }
      await tx.notification.create({ data: { userId: request.auth!.userId, type: 'ORDER_PLACED', title: 'Order placed', message: `Your order ${created.orderNumber} has been placed.` } });
      return created;
    });
    response.status(201).json(order);
  } catch (error) {
    next(error);
  }
});

commerceRouter.get('/orders', requireAuth, async (request, response, next) => {
  try {
    response.json(await prisma.order.findMany({ where: { customerId: request.auth!.userId }, include: { seller: true, apartment: true, block: true, flat: true, address: true, items: true, statusHistory: { orderBy: { createdAt: 'asc' } }, deliveryAssignment: { include: { deliveryBoy: { include: { user: true } } } } }, orderBy: { createdAt: 'desc' } }));
  } catch (error) {
    next(error);
  }
});

const transitions: Record<OrderStatus, OrderStatus[]> = { PENDING: ['ACCEPTED', 'REJECTED', 'CANCELLED'], ACCEPTED: ['PREPARING', 'CANCELLED'], REJECTED: [], PREPARING: ['READY_FOR_PICKUP', 'CANCELLED'], READY_FOR_PICKUP: ['ASSIGNED_TO_DELIVERY_BOY', 'PICKED_UP'], ASSIGNED_TO_DELIVERY_BOY: ['PICKED_UP'], PICKED_UP: ['OUT_FOR_DELIVERY', 'COMPLETED'], OUT_FOR_DELIVERY: ['DELIVERED'], DELIVERED: ['COMPLETED'], COMPLETED: [], CANCELLED: [] };

commerceRouter.patch('/orders/:orderId/status', requireAuth, async (request, response, next) => {
  try {
    const orderId = z.string().uuid().parse(request.params.orderId);
    const { status, note } = z.object({ status: z.enum(['PENDING', 'ACCEPTED', 'REJECTED', 'PREPARING', 'READY_FOR_PICKUP', 'ASSIGNED_TO_DELIVERY_BOY', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED']), note: z.string().max(1000).optional() }).parse(request.body);
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { seller: { select: { userId: true } }, items: true } });
    const isAdmin = request.auth!.roles.includes('GLOBAL_ADMIN');
    if (!order || (!isAdmin && order.customerId !== request.auth!.userId && order.seller.userId !== request.auth!.userId)) {
      response.status(404).json({ error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' } });
      return;
    }
    if (!isAdmin && !transitions[order.status].includes(status)) {
      response.status(400).json({ error: { code: 'INVALID_STATUS_TRANSITION', message: `Cannot move order from ${order.status} to ${status}` } });
      return;
    }
    const updated = await prisma.$transaction(async tx => { const item = await tx.order.update({ where: { id: orderId }, data: { status, ...(status === 'ACCEPTED' ? { acceptedAt: new Date() } : {}), ...(status === 'PREPARING' ? { preparingAt: new Date() } : {}), ...(status === 'READY_FOR_PICKUP' ? { readyAt: new Date() } : {}), ...(status === 'PICKED_UP' ? { pickedUpAt: new Date() } : {}), ...(status === 'DELIVERED' ? { deliveredAt: new Date() } : {}), ...(status === 'CANCELLED' ? { cancelledAt: new Date() } : {}) } }); if (status === 'CANCELLED' && order.status !== 'CANCELLED') { for (const orderItem of order.items) { const product = await tx.product.findUnique({ where: { id: orderItem.productId }, select: { inventoryTracking: true } }); if (product?.inventoryTracking) { const inventory = await tx.inventory.update({ where: { productId: orderItem.productId }, data: { quantity: { increment: orderItem.quantity } } }); await tx.inventoryMovement.create({ data: { productId: orderItem.productId, inventoryId: inventory.id, type: 'CANCELLED_ORDER', quantity: orderItem.quantity, orderId, reason: `Order ${order.orderNumber} cancelled` } }); } } } await tx.orderStatusHistory.create({ data: { orderId, fromStatus: order.status, toStatus: status, changedById: request.auth!.userId, note } }); await tx.auditLog.create({ data: { actorId: request.auth!.userId, action: 'ORDER_STATUS_CHANGED', entityType: 'Order', entityId: orderId, beforeData: { status: order.status }, afterData: { status }, } }); return item; });
    response.json(updated);
  } catch (error) {
    next(error);
  }
});
