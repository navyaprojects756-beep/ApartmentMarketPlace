import { Router } from 'express';
import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.middleware.js';
import { prisma } from '../lib/prisma.js';

export const reportRouter = Router();

reportRouter.get('/seller/summary', requireAuth, async (request, response, next) => {
  try {
    const query = z.object({
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
      apartmentId: z.string().uuid().optional(),
      blockId: z.string().uuid().optional(),
      flatId: z.string().uuid().optional(),
      deliveryBoyId: z.string().uuid().optional(),
      productId: z.string().uuid().optional(),
      categoryId: z.string().uuid().optional(),
      status: z.enum(['PENDING', 'ACCEPTED', 'REJECTED', 'PREPARING', 'READY_FOR_PICKUP', 'ASSIGNED_TO_DELIVERY_BOY', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED']).optional(),
      fulfillmentType: z.enum(['DELIVERY', 'PICKUP']).optional(),
    }).parse(request.query);
    const from = query.from ?? new Date(Date.now() - 30 * 86400000);
    const to = query.to ?? new Date();
    const seller = await prisma.sellerProfile.findUnique({ where: { userId: request.auth!.userId } });
    if (!seller) {
      response.status(403).json({ error: { code: 'SELLER_REQUIRED', message: 'Seller access is required' } });
      return;
    }
    const orders = await prisma.order.findMany({
      where: {
        sellerId: seller.id,
        createdAt: { gte: from, lte: to },
        ...(query.apartmentId ? { apartmentId: query.apartmentId } : {}),
        ...(query.blockId ? { blockId: query.blockId } : {}),
        ...(query.flatId ? { flatId: query.flatId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.fulfillmentType ? { fulfillmentType: query.fulfillmentType } : {}),
        ...(query.deliveryBoyId ? { deliveryAssignment: { deliveryBoyId: query.deliveryBoyId } } : {}),
        ...(query.productId ? { items: { some: { productId: query.productId } } } : {}),
        ...(query.categoryId ? { items: { some: { product: { categoryId: query.categoryId } } } } : {}),
      },
      select: { status: true, total: true, items: { select: { quantity: true } } },
    });
    const completed = orders.filter(order => ['DELIVERED', 'COMPLETED'].includes(order.status));
    const cancelled = orders.filter(order => order.status === 'CANCELLED');
    const totalSales = completed.reduce((sum, order) => sum + Number(order.total), 0);
    const unitsSold = completed.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
    response.json({ from, to, filters: query, totalOrders: orders.length, completedOrders: completed.length, cancelledOrders: cancelled.length, grossSales: totalSales, averageOrderValue: completed.length ? totalSales / completed.length : 0, unitsSold });
  } catch (error) {
    next(error);
  }
});

reportRouter.get('/seller/summary.pdf', requireAuth, async (request, response, next) => {
  try {
    const query = z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional(), apartmentId: z.string().uuid().optional(), blockId: z.string().uuid().optional(), flatId: z.string().uuid().optional(), deliveryBoyId: z.string().uuid().optional(), productId: z.string().uuid().optional(), categoryId: z.string().uuid().optional(), status: z.enum(['PENDING', 'ACCEPTED', 'REJECTED', 'PREPARING', 'READY_FOR_PICKUP', 'ASSIGNED_TO_DELIVERY_BOY', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED']).optional(), fulfillmentType: z.enum(['DELIVERY', 'PICKUP']).optional() }).parse(request.query);
    const from = query.from ?? new Date(Date.now() - 30 * 86400000);
    const to = query.to ?? new Date();
    const seller = await prisma.sellerProfile.findUnique({ where: { userId: request.auth!.userId } });
    if (!seller) { response.status(403).json({ error: { code: 'SELLER_REQUIRED', message: 'Seller access is required' } }); return; }
    const orders = await prisma.order.findMany({ where: { sellerId: seller.id, createdAt: { gte: from, lte: to }, ...(query.apartmentId ? { apartmentId: query.apartmentId } : {}), ...(query.blockId ? { blockId: query.blockId } : {}), ...(query.flatId ? { flatId: query.flatId } : {}), ...(query.status ? { status: query.status } : {}), ...(query.fulfillmentType ? { fulfillmentType: query.fulfillmentType } : {}), ...(query.deliveryBoyId ? { deliveryAssignment: { deliveryBoyId: query.deliveryBoyId } } : {}), ...(query.productId ? { items: { some: { productId: query.productId } } } : {}), ...(query.categoryId ? { items: { some: { product: { categoryId: query.categoryId } } } } : {}) }, include: { apartment: true, items: true } });
    const completed = orders.filter(order => ['DELIVERED', 'COMPLETED'].includes(order.status));
    const grossSales = completed.reduce((sum, order) => sum + Number(order.total), 0);
    const unitsSold = completed.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
    const document = new PDFDocument({ margin: 42 });
    response.type('application/pdf').setHeader('Content-Disposition', 'attachment; filename="seller-summary-report.pdf"');
    document.pipe(response);
    document.fontSize(20).fillColor('#4b2eb4').text(seller.businessName || seller.sellerName);
    document.fontSize(14).fillColor('#222').text('Seller summary report').moveDown(0.3);
    document.fontSize(10).fillColor('#555').text(`Period: ${from.toLocaleDateString()} - ${to.toLocaleDateString()}`).text(`Generated: ${new Date().toLocaleString()}`).moveDown();
    document.fontSize(11).fillColor('#222').text(`Orders: ${orders.length}`).text(`Completed orders: ${completed.length}`).text(`Gross sales: Rs ${grossSales.toFixed(2)}`).text(`Units sold: ${unitsSold}`).moveDown();
    document.fontSize(9).text('Order number                         Date                 Apartment                 Amount                 Status');
    document.moveTo(42, document.y).lineTo(570, document.y).strokeColor('#d8d2e6').stroke();
    for (const order of orders.slice(0, 500)) document.text(`${order.orderNumber.padEnd(28)} ${order.createdAt.toLocaleDateString().padEnd(20)} ${order.apartment.name.slice(0, 20).padEnd(22)} Rs ${Number(order.total).toFixed(2).padEnd(18)} ${order.status}`);
    document.end();
  } catch (error) { next(error); }
});
