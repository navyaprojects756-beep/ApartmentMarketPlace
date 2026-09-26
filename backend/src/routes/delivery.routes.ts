import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { prisma } from '../lib/prisma.js';
import { orderStatusMessage, sendPushNotifications } from '../services/push.service.js';

export const deliveryRouter = Router();

deliveryRouter.get('/orders', requireAuth, requireRole('DELIVERY_BOY'), async (request, response, next) => {
  try {
    const query = z.object({ apartmentId: z.string().uuid().optional(), sellerId: z.string().uuid().optional(), status: z.enum(['READY_FOR_PICKUP', 'ASSIGNED_TO_DELIVERY_BOY', 'PICKED_UP', 'OUT_FOR_DELIVERY']).optional(), groupBy: z.enum(['apartment', 'seller', 'status']).optional() }).parse(request.query);
    const deliveryBoy = await prisma.deliveryBoy.findUnique({ where: { userId: request.auth!.userId }, include: { sellers: true, apartments: true } });
    if (!deliveryBoy) {
      response.json([]);
      return;
    }
    const sellerIds = query.sellerId ? [query.sellerId] : deliveryBoy.sellers.map(item => item.sellerId);
    const apartmentIds = query.apartmentId ? [query.apartmentId] : deliveryBoy.apartments.map(item => item.apartmentId);
    const orders = await prisma.order.findMany({ where: { fulfillmentType: 'DELIVERY', sellerId: { in: sellerIds }, apartmentId: { in: apartmentIds }, status: query.status ? query.status : { in: ['READY_FOR_PICKUP', 'ASSIGNED_TO_DELIVERY_BOY', 'PICKED_UP', 'OUT_FOR_DELIVERY'] }, deliveryAssignment: { deliveryBoyId: deliveryBoy.id } }, include: { seller: true, customer: true, apartment: true, block: true, flat: true, items: true, deliveryAssignment: true }, orderBy: { createdAt: 'asc' } });
    if (!query.groupBy) { response.json(orders); return; }
    const groups = orders.reduce<Record<string, typeof orders>>((result, order) => { const key = query.groupBy === 'apartment' ? order.apartment.name : query.groupBy === 'seller' ? (order.seller.businessName || order.seller.sellerName) : order.status; (result[key] ??= []).push(order); return result; }, {});
    response.json({ orders, groups });
  } catch (error) {
    next(error);
  }
});

deliveryRouter.post('/orders/:orderId/assign', requireAuth, async (request, response, next) => {
  try {
    const orderId = z.string().uuid().parse(request.params.orderId);
    const { deliveryBoyId } = z.object({ deliveryBoyId: z.string().uuid() }).parse(request.body);
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      response.status(404).json({ error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' } });
      return;
    }
    const deliveryBoy = await prisma.deliveryBoy.findFirst({ where: { id: deliveryBoyId, isActive: true, sellers: { some: { sellerId: order.sellerId } }, apartments: { some: { apartmentId: order.apartmentId } } } });
    if (!deliveryBoy) {
      response.status(400).json({ error: { code: 'DELIVERY_SCOPE_INVALID', message: 'Delivery boy is not eligible for this seller and apartment' } });
      return;
    }
    const seller = await prisma.sellerProfile.findUnique({ where: { id: order.sellerId }, select: { userId: true } });
    const isAdmin = request.auth!.roles.includes('GLOBAL_ADMIN');
    if (!isAdmin && seller?.userId !== request.auth!.userId) {
      response.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only the seller or admin can assign delivery' } });
      return;
    }
    const assignment = await prisma.$transaction(async tx => { const created = await tx.orderDeliveryAssignment.upsert({ where: { orderId }, update: { deliveryBoyId }, create: { orderId, deliveryBoyId } }); await tx.order.update({ where: { id: orderId }, data: { status: 'ASSIGNED_TO_DELIVERY_BOY' } }); await tx.orderStatusHistory.create({ data: { orderId, fromStatus: order.status, toStatus: 'ASSIGNED_TO_DELIVERY_BOY', changedById: request.auth!.userId } }); return created; });
    void sendPushNotifications([{ userId: order.customerId, title: 'Order update', body: orderStatusMessage('ASSIGNED_TO_DELIVERY_BOY'), data: { route: 'orders', orderId: order.id, status: 'ASSIGNED_TO_DELIVERY_BOY' } }]);
    response.status(201).json(assignment);
  } catch (error) {
    next(error);
  }
});

deliveryRouter.patch('/orders/:orderId/status', requireAuth, requireRole('DELIVERY_BOY'), async (request, response, next) => {
  try {
    const orderId = z.string().uuid().parse(request.params.orderId);
    const { status, note } = z.object({ status: z.enum(['PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED']), note: z.string().max(1000).optional() }).parse(request.body);
    const deliveryBoy = await prisma.deliveryBoy.findUnique({ where: { userId: request.auth!.userId } });
    const order = await prisma.order.findFirst({ where: { id: orderId, deliveryAssignment: { deliveryBoyId: deliveryBoy?.id } } });
    if (!order) {
      response.status(404).json({ error: { code: 'DELIVERY_ORDER_NOT_FOUND', message: 'This order is not assigned to you' } });
      return;
    }
    const allowed: Record<string, string[]> = { READY_FOR_PICKUP: ['PICKED_UP'], ASSIGNED_TO_DELIVERY_BOY: ['PICKED_UP'], PICKED_UP: ['OUT_FOR_DELIVERY'], OUT_FOR_DELIVERY: ['DELIVERED'] };
    if (!allowed[order.status]?.includes(status)) {
      response.status(400).json({ error: { code: 'INVALID_STATUS_TRANSITION', message: `Cannot move delivery from ${order.status} to ${status}` } });
      return;
    }
    const updated = await prisma.$transaction(async tx => { const result = await tx.order.update({ where: { id: order.id }, data: { status, ...(status === 'PICKED_UP' ? { pickedUpAt: new Date() } : {}), ...(status === 'DELIVERED' ? { deliveredAt: new Date() } : {}) } }); await tx.orderStatusHistory.create({ data: { orderId: order.id, fromStatus: order.status, toStatus: status, changedById: request.auth!.userId, note } }); return result; });
    void sendPushNotifications([{ userId: order.customerId, title: 'Order update', body: orderStatusMessage(status), data: { route: 'orders', orderId: order.id, status } }]);
    response.json(updated);
  } catch (error) {
    next(error);
  }
});
