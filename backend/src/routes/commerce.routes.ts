import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { Prisma, type OrderStatus } from '@prisma/client';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.middleware.js';
import { prisma } from '../lib/prisma.js';
import { getPrimaryApartment } from '../services/home.service.js';
import { getSellerAvailability } from '../utils/seller-hours.js';
import { orderStatusMessage, sendPushNotifications } from '../services/push.service.js';
import { validateCouponForCheckout } from './coupon.routes.js';

export const commerceRouter = Router();

const cartItemSchema = z.object({ productId: z.string().uuid(), quantity: z.number().int().positive() });
const checkoutSchema = z.object({ sellerId: z.string().uuid(), items: z.array(cartItemSchema).min(1), fulfillmentType: z.enum(['DELIVERY', 'PICKUP']), paymentMethod: z.enum(['CASH_ON_DELIVERY', 'DUMMY_PAYMENT']), addressId: z.string().uuid().optional(), customerNotes: z.string().max(2000).optional(), couponCode: z.string().trim().min(3).max(80).optional() });
const orderReferenceAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function createOrderReference(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: '2-digit', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const day = parts.find(part => part.type === 'day')?.value || '00';
  const month = parts.find(part => part.type === 'month')?.value || '00';
  const year = parts.find(part => part.type === 'year')?.value || '00';
  const randomPart = Array.from(randomBytes(6), value => orderReferenceAlphabet[value % orderReferenceAlphabet.length]).join('');
  return `GC-${year}${month}${day}-${randomPart}`;
}

async function sellerIsVisible(userId: string, sellerId: string) {
  const context = await getPrimaryApartment(userId);
  if (!context) return false;
  return Boolean(await prisma.sellerProfile.findFirst({ where: { id: sellerId, status: 'APPROVED', OR: [{ sellerType: 'APARTMENT', apartmentId: context.apartmentId }, { sellerType: 'OUTSIDE', deliveryAreas: { some: { apartmentId: context.apartmentId, isApproved: true, isEnabled: true } } }] } }));
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
    const tester = await prisma.userRole.findFirst({ where: { userId: request.auth!.userId, role: { code: 'TESTER' as any } } });
    if (tester) {
      response.status(403).json({ error: { code: 'TESTER_ORDER_RESTRICTED', message: 'Tester accounts can browse products but cannot place orders.' } });
      return;
    }
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
    const tester = await prisma.userRole.findFirst({ where: { userId: request.auth!.userId, role: { code: 'TESTER' as any } } });
    if (tester) {
      response.status(403).json({ error: { code: 'TESTER_ORDER_RESTRICTED', message: 'Tester accounts can browse products but cannot place orders.' } });
      return;
    }
    const input = checkoutSchema.parse(request.body);
    const context = await getPrimaryApartment(request.auth!.userId);
    if (!context || !(await sellerIsVisible(request.auth!.userId, input.sellerId))) {
      response.status(400).json({ error: { code: 'INVALID_COMMUNITY_SCOPE', message: 'Select a valid apartment and seller' } });
      return;
    }
    const order = await prisma.$transaction(async tx => {
      const seller = await tx.sellerProfile.findUniqueOrThrow({ where: { id: input.sellerId }, include: { operatingHours: true, apartment: true, user: { include: { apartments: { where: { isPrimary: true }, include: { apartment: true, block: true, flat: true } } } } } });
      const customer = await tx.user.findUniqueOrThrow({ where: { id: request.auth!.userId }, select: { phone: true } });
      const selectedAddress = input.addressId ? await tx.address.findFirst({ where: { id: input.addressId, userId: request.auth!.userId }, include: { apartment: true, block: true, flat: true } }) : null;
      const sellerApartment = seller.user.apartments[0];
      const fulfillmentAddress = input.fulfillmentType === 'PICKUP'
        ? [seller.address, seller.apartment?.address, seller.apartment?.name || sellerApartment?.apartment?.name, sellerApartment?.block?.name, sellerApartment?.flat?.number ? `Flat ${sellerApartment.flat.number}` : null].filter(Boolean).join(' · ') || 'Seller pickup address not provided'
        : [selectedAddress?.addressLine, selectedAddress?.apartment?.name || context.apartment.name, selectedAddress?.block?.name || context.block?.name, selectedAddress?.flat?.number ? `Flat ${selectedAddress.flat.number}` : context.flat?.number ? `Flat ${context.flat.number}` : null].filter(Boolean).join(' · ') || 'Delivery address not provided';
      const fulfillmentPhone = input.fulfillmentType === 'PICKUP' ? seller.user.phone : customer.phone;
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
      const couponResult = input.couponCode ? await validateCouponForCheckout(tx, { code: input.couponCode, sellerId: seller.id, userId: request.auth!.userId, apartmentId: context.apartmentId, subtotal }) : null;
      const couponDiscount = couponResult?.discount ?? new Prisma.Decimal(0);
      const deliveryCharge = input.fulfillmentType === 'DELIVERY' ? (seller.deliveryCharge ?? new Prisma.Decimal(0)) : new Prisma.Decimal(0);
      const total = subtotal.sub(couponDiscount).add(deliveryCharge);
      const created = await tx.order.create({ data: { orderNumber: createOrderReference(), customerId: request.auth!.userId, sellerId: seller.id, apartmentId: context.apartmentId, blockId: context.blockId, flatId: context.flatId, addressId: input.addressId, subtotal, discount: couponDiscount, couponId: couponResult?.coupon?.id, couponCode: couponResult?.coupon?.code, deliveryCharge, total, paymentMethod: input.paymentMethod, paymentStatus: input.paymentMethod === 'DUMMY_PAYMENT' ? 'PAID' : 'PENDING', fulfillmentType: input.fulfillmentType, fulfillmentAddress, fulfillmentPhone, verificationCode: String(Math.floor(100000 + Math.random() * 900000)), customerNotes: input.customerNotes, items: { create: orderItems }, statusHistory: { create: { toStatus: 'PENDING' } } } });
      if (couponResult?.coupon) await (tx as any).couponRedemption.create({ data: { couponId: couponResult.coupon.id, userId: request.auth!.userId, orderId: created.id, amount: couponDiscount } });
      for (const item of orderItems) {
        const product = products.find(record => record.id === item.productId)!;
        if (product.inventoryTracking) await tx.inventoryMovement.create({ data: { productId: product.id, type: 'SALE', quantity: -item.quantity, orderId: created.id, reason: `Order ${created.orderNumber}` } });
      }
      await tx.notification.create({ data: { userId: request.auth!.userId, type: 'ORDER_PLACED', title: 'Order placed', message: `Your order ${created.orderNumber} has been placed.` } });
      await tx.notification.create({ data: { userId: seller.userId, type: 'ORDER_PLACED', title: 'New order received', message: `New order ${created.orderNumber} has been placed.` } });
      return created;
    });
    const seller = await prisma.sellerProfile.findUnique({ where: { id: order.sellerId }, select: { userId: true } });
    void sendPushNotifications([
      { userId: order.customerId, title: 'Order placed', body: `Your order ${order.orderNumber} has been placed.`, channelId: 'customer_updates', data: { route: 'orders', orderId: order.id } },
      ...(seller ? [{ userId: seller.userId, title: 'New order received', body: `New order ${order.orderNumber} has been placed.`, channelId: 'seller_orders' as const, data: { route: 'seller-orders', orderId: order.id } }] : []),
    ]);
    response.status(201).json(order);
  } catch (error) {
    next(error);
  }
});

commerceRouter.get('/orders', requireAuth, async (request, response, next) => {
  try {
    const orders = await prisma.order.findMany({ where: { customerId: request.auth!.userId }, include: { customer: { include: { apartments: { where: { isPrimary: true }, include: { flat: true } } } }, seller: { include: { apartment: true, user: { include: { apartments: { where: { isPrimary: true }, include: { apartment: true, block: true, flat: true } } } } } }, apartment: true, block: true, flat: true, address: true, items: true, statusHistory: { orderBy: { createdAt: 'asc' } }, deliveryAssignment: { include: { deliveryBoy: { include: { user: true } } } } }, orderBy: { createdAt: 'desc' } });
    response.json(orders.map(order => {
      if (order.fulfillmentAddress) {
        return {
          ...order,
          address: { ...(order.address || {}), addressLine: order.fulfillmentAddress, manualFlatNumber: null },
          apartment: null,
          block: null,
          flat: null,
          customer: { ...order.customer, phone: order.fulfillmentPhone || order.customer.phone, apartments: [] }
        };
      }
      if (order.fulfillmentType !== 'PICKUP') return order;
      const sellerApartment = order.seller.user.apartments[0];
      const pickupAddress = [order.seller.address, order.seller.apartment?.address, order.seller.apartment?.name || sellerApartment?.apartment?.name, sellerApartment?.block?.name, sellerApartment?.flat?.number ? `Flat ${sellerApartment.flat.number}` : null]
        .filter(Boolean)
        .join(' · ') || 'Seller pickup address not provided';
      return {
        ...order,
        address: { ...(order.address || {}), addressLine: pickupAddress, manualFlatNumber: null },
        apartment: null,
        block: null,
        flat: sellerApartment?.flat || null,
        customer: { ...order.customer, phone: order.seller.user.phone, apartments: sellerApartment ? [{ ...sellerApartment, isPrimary: true }] : [] }
      };
    }));
  } catch (error) {
    next(error);
  }
});

const transitions: Record<OrderStatus, OrderStatus[]> = { PENDING: ['ACCEPTED', 'REJECTED', 'CANCELLED'], ACCEPTED: ['PREPARING', 'CANCELLED'], REJECTED: [], PREPARING: ['READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'CANCELLED'], READY_FOR_PICKUP: ['ASSIGNED_TO_DELIVERY_BOY', 'PICKED_UP', 'OUT_FOR_DELIVERY'], ASSIGNED_TO_DELIVERY_BOY: ['PICKED_UP', 'OUT_FOR_DELIVERY'], PICKED_UP: ['OUT_FOR_DELIVERY', 'COMPLETED'], OUT_FOR_DELIVERY: ['DELIVERED'], DELIVERED: ['COMPLETED'], COMPLETED: [], CANCELLED: [] };

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
    if (status === 'COMPLETED' && !isAdmin) {
      response.status(400).json({ error: { code: 'ORDER_PIN_REQUIRED', message: 'Enter the customer Order PIN to complete this order.' } });
      return;
    }
    if (status === 'PICKED_UP' && order.fulfillmentType === 'PICKUP' && !isAdmin) {
      response.status(400).json({ error: { code: 'ORDER_PIN_REQUIRED', message: 'Enter the customer Order PIN to complete this pickup.' } });
      return;
    }
    if (!isAdmin && order.customerId === request.auth!.userId && status === 'CANCELLED' && order.status !== 'PENDING') {
      response.status(400).json({ error: { code: 'CUSTOMER_CANCEL_WINDOW_CLOSED', message: 'Customers can cancel only while the seller is reviewing the order.' } });
      return;
    }
    // Status updates are idempotent. A seller may submit the status currently
    // shown in the queue after a refresh or a repeated click; that is not an
    // invalid transition and should not create duplicate history/notifications.
    if (order.status === status) {
      response.json(order);
      return;
    }
    const isSeller = order.seller.userId === request.auth!.userId;
    const sellerDirectStatuses: OrderStatus[] = ['ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'ASSIGNED_TO_DELIVERY_BOY', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'];
    const sellerMayJumpToStatus = isSeller && sellerDirectStatuses.includes(status) && !['REJECTED', 'CANCELLED', 'COMPLETED'].includes(order.status);
    const sellerMayCancelOrder = isSeller && status === 'CANCELLED' && !['REJECTED', 'CANCELLED', 'DELIVERED', 'COMPLETED'].includes(order.status);
    if (!isAdmin && !sellerMayJumpToStatus && !sellerMayCancelOrder && !transitions[order.status].includes(status)) {
      response.status(400).json({ error: { code: 'INVALID_STATUS_TRANSITION', message: `Cannot move order from ${order.status} to ${status}` } });
      return;
    }
    const updated = await prisma.$transaction(async tx => { const item = await tx.order.update({ where: { id: orderId }, data: { status, ...(status === 'ACCEPTED' ? { acceptedAt: new Date() } : {}), ...(status === 'PREPARING' ? { preparingAt: new Date() } : {}), ...(status === 'READY_FOR_PICKUP' ? { readyAt: new Date() } : {}), ...(status === 'PICKED_UP' ? { pickedUpAt: new Date() } : {}), ...(status === 'DELIVERED' ? { deliveredAt: new Date() } : {}), ...(status === 'CANCELLED' ? { cancelledAt: new Date() } : {}) } }); if (status === 'CANCELLED' && order.status !== 'CANCELLED') { for (const orderItem of order.items) { const product = await tx.product.findUnique({ where: { id: orderItem.productId }, select: { inventoryTracking: true } }); if (product?.inventoryTracking) { const inventory = await tx.inventory.update({ where: { productId: orderItem.productId }, data: { quantity: { increment: orderItem.quantity } } }); await tx.inventoryMovement.create({ data: { productId: orderItem.productId, inventoryId: inventory.id, type: 'CANCELLED_ORDER', quantity: orderItem.quantity, orderId, reason: `Order ${order.orderNumber} cancelled` } }); } } } await tx.orderStatusHistory.create({ data: { orderId, fromStatus: order.status, toStatus: status, changedById: request.auth!.userId, note } }); await tx.auditLog.create({ data: { actorId: request.auth!.userId, action: 'ORDER_STATUS_CHANGED', entityType: 'Order', entityId: orderId, beforeData: { status: order.status }, afterData: { status }, } }); return item; });
    if (status === 'REJECTED' && order.status !== 'REJECTED') {
      await prisma.$transaction(async tx => {
        for (const orderItem of order.items) {
          const product = await tx.product.findUnique({ where: { id: orderItem.productId }, select: { inventoryTracking: true } });
          if (!product?.inventoryTracking) continue;
          const inventory = await tx.inventory.update({ where: { productId: orderItem.productId }, data: { quantity: { increment: orderItem.quantity } } });
          await tx.inventoryMovement.create({ data: { productId: orderItem.productId, inventoryId: inventory.id, type: 'CANCELLED_ORDER', quantity: orderItem.quantity, orderId, reason: `Order ${order.orderNumber} rejected` } });
        }
      });
    }
    const notificationType = ({ ACCEPTED: 'ORDER_ACCEPTED', REJECTED: 'ORDER_REJECTED', PREPARING: 'ORDER_PREPARING', READY_FOR_PICKUP: 'ORDER_READY', ASSIGNED_TO_DELIVERY_BOY: 'DELIVERY_ASSIGNED', PICKED_UP: 'ORDER_PICKED_UP', OUT_FOR_DELIVERY: 'ORDER_OUT_FOR_DELIVERY', DELIVERED: 'ORDER_DELIVERED' } as Record<string, string>)[status] || 'SYSTEM';
    const customerNotification = { userId: order.customerId, type: notificationType as never, title: 'Order update', message: orderStatusMessage(status), data: { route: 'orders', orderId: order.id, status } };
    const sellerCancelledByCustomer = status === 'CANCELLED' && order.customerId === request.auth!.userId;
    const sellerNotification = sellerCancelledByCustomer ? { userId: order.seller.userId, type: 'SYSTEM' as never, title: 'Order cancelled', message: `Order ${order.orderNumber} was cancelled by the customer.`, data: { route: 'seller-orders', orderId: order.id, status } } : null;
    await prisma.notification.createMany({ data: sellerNotification ? [customerNotification, sellerNotification] : [customerNotification] });
    const pushMessages: Array<{ userId: string; title: string; body: string; channelId: 'customer_updates' | 'seller_orders'; data: Record<string, string> }> = [{ userId: order.customerId, title: 'Order update', body: orderStatusMessage(status), channelId: 'customer_updates', data: { route: 'orders', orderId: order.id, status } }];
    if (sellerCancelledByCustomer && order.seller.userId !== order.customerId) pushMessages.push({ userId: order.seller.userId, title: 'Order cancelled', body: `Order ${order.orderNumber} was cancelled by the customer.`, channelId: 'seller_orders', data: { route: 'seller-orders', orderId: order.id, status } });
    void sendPushNotifications(pushMessages);
    response.json(updated);
  } catch (error) {
    next(error);
  }
});

commerceRouter.post('/orders/:orderId/verify-items', requireAuth, async (request, response, next) => {
  try {
    const orderId = z.string().uuid().parse(request.params.orderId);
    const { code: submittedCode, targetStatus } = z.object({ code: z.string().trim().regex(/^\d{6}$/), targetStatus: z.enum(['DELIVERED', 'COMPLETED']).optional().default('COMPLETED') }).parse(request.body);
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { seller: { select: { userId: true } }, items: true, deliveryAssignment: { include: { deliveryBoy: { select: { userId: true } } } } } });
    const isAdmin = request.auth!.roles.includes('GLOBAL_ADMIN');
    const isSeller = order?.seller.userId === request.auth!.userId;
    const isDeliveryBoy = order?.deliveryAssignment?.deliveryBoy.userId === request.auth!.userId;
    if (!order || (!isAdmin && !isSeller && !isDeliveryBoy)) {
      response.status(404).json({ error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' } });
      return;
    }
    const validWindow = targetStatus === 'DELIVERED' && isSeller
      ? !['CANCELLED', 'COMPLETED', 'DELIVERED'].includes(order.status)
      : order.fulfillmentType === 'PICKUP'
      ? ['READY_FOR_PICKUP', 'PICKED_UP'].includes(order.status)
      : ['OUT_FOR_DELIVERY', 'DELIVERED'].includes(order.status);
    if (!validWindow) {
      if (order.status === 'COMPLETED' && submittedCode === order.verificationCode) {
        response.json(order);
        return;
      }
      response.status(400).json({ error: { code: 'VERIFICATION_NOT_READY', message: 'Verification is available only at the final handover stage.' } });
      return;
    }
    if (submittedCode !== order.verificationCode) {
      response.status(400).json({ error: { code: 'INVALID_VERIFICATION_CODE', message: 'The order PIN is incorrect.' } });
      return;
    }
    const updated = await prisma.$transaction(async tx => {
      const result = await tx.order.update({ where: { id: order.id }, data: { status: targetStatus, ...(targetStatus === 'DELIVERED' ? { deliveredAt: new Date() } : {}), ...(targetStatus === 'COMPLETED' ? { verifiedAt: new Date() } : {}) } });
      await tx.orderStatusHistory.create({ data: { orderId: order.id, fromStatus: order.status, toStatus: targetStatus, changedById: request.auth!.userId, note: `${order.fulfillmentType === 'PICKUP' ? 'Takeaway' : 'Delivery'} verification completed` } });
      return result;
    });
    await prisma.notification.create({ data: { userId: order.customerId, type: 'ORDER_DELIVERED' as never, title: 'Order update', message: `Verification completed for order ${order.orderNumber}.`, data: { route: 'orders', orderId: order.id, status: targetStatus } } });
    response.json(updated);
  } catch (error) {
    next(error);
  }
});
