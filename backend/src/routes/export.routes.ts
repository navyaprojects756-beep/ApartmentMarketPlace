import { Router } from 'express';
import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.middleware.js';
import { prisma } from '../lib/prisma.js';

export const exportRouter = Router();

function csvCell(value: unknown) { return `"${String(value ?? '').replaceAll('"', '""')}"`; }

exportRouter.get('/seller/orders.csv', requireAuth, async (request, response, next) => {
  try {
    const seller = await prisma.sellerProfile.findUnique({ where: { userId: request.auth!.userId } });
    if (!seller) { response.status(403).json({ error: { code: 'SELLER_REQUIRED', message: 'Seller access is required' } }); return; }
    const orders = await prisma.order.findMany({ where: { sellerId: seller.id }, include: { customer: true, apartment: true }, orderBy: { createdAt: 'desc' }, take: 5000 });
    const lines = [['Order number', 'Date', 'Customer', 'Apartment', 'Amount', 'Status'], ...orders.map(order => [order.orderNumber, order.createdAt.toISOString(), order.customer.name ?? order.customer.phone, order.apartment.name, order.total, order.status])].map(row => row.map(csvCell).join(','));
    response.type('text/csv').setHeader('Content-Disposition', 'attachment; filename="seller-orders.csv"').send(lines.join('\n'));
  } catch (error) { next(error); }
});

exportRouter.get('/seller/orders.pdf', requireAuth, async (request, response, next) => {
  try {
    const seller = await prisma.sellerProfile.findUnique({ where: { userId: request.auth!.userId } });
    if (!seller) { response.status(403).json({ error: { code: 'SELLER_REQUIRED', message: 'Seller access is required' } }); return; }
    const orders = await prisma.order.findMany({ where: { sellerId: seller.id }, include: { customer: true, apartment: true }, orderBy: { createdAt: 'desc' }, take: 5000 });
    const document = new PDFDocument({ margin: 42 });
    response.type('application/pdf').setHeader('Content-Disposition', 'attachment; filename="seller-orders.pdf"');
    document.pipe(response);
    document.fontSize(20).fillColor('#4b2eb4').text(seller.businessName || seller.sellerName);
    document.fontSize(11).fillColor('#444').text('Order report').text(`Generated: ${new Date().toLocaleString()}`).moveDown();
    document.fontSize(10).fillColor('#222');
    for (const order of orders) {
      document.text(`${order.orderNumber}   ${order.createdAt.toLocaleDateString()}   ${order.customer.name ?? order.customer.phone}   ${order.apartment.name}   ₹${order.total}   ${order.status}`);
    }
    document.end();
  } catch (error) { next(error); }
});

exportRouter.get('/seller/orders/:orderId/print.pdf', requireAuth, async (request, response, next) => {
  try {
    const orderId = z.string().uuid().parse(request.params.orderId);
    const seller = await prisma.sellerProfile.findUnique({ where: { userId: request.auth!.userId } });
    if (!seller) { response.status(403).json({ error: { code: 'SELLER_REQUIRED', message: 'Seller access is required' } }); return; }
    const order = await prisma.order.findFirst({ where: { id: orderId, sellerId: seller.id }, include: { customer: { include: { apartments: { orderBy: { isPrimary: 'desc' }, include: { flat: true } } } }, apartment: true, block: true, flat: true, address: true, items: true } });
    if (!order) { response.status(404).json({ error: { code: 'ORDER_NOT_FOUND', message: 'Seller order not found' } }); return; }
    const document = new PDFDocument({ margin: 42 });
    response.type('application/pdf').setHeader('Content-Disposition', `inline; filename="${order.orderNumber}.pdf"`);
    document.pipe(response);
    document.fontSize(22).fillColor('#4b2eb4').text(seller.businessName || seller.sellerName);
    document.fontSize(10).fillColor('#777').text('SELLER INVOICE').moveDown(0.4);
    document.fontSize(15).fillColor('#222').text(`Order ${order.orderNumber}`).fontSize(10).fillColor('#555').text(order.createdAt.toLocaleString()).moveDown();
    document.roundedRect(42, document.y, 511, 100, 6).fillAndStroke('#faf8ff', '#e3dcf5');
    const infoTop = document.y + 12;
    const customerApartment = order.customer.apartments?.[0];
    const customerFlat = order.flat?.number || order.address?.manualFlatNumber || customerApartment?.flat?.number || customerApartment?.manualFlatNumber;
    const customerAddress = [order.apartment.name, order.block?.name, customerFlat ? `Flat ${customerFlat}` : 'Flat number not provided'].filter(Boolean).join(' · ');
    document.fillColor('#222').fontSize(10).text(`Customer: ${order.customer.name ?? 'Customer'} (${order.customer.phone})`, 55, infoTop).text(`Status: ${order.status}`, 55, infoTop + 20).text(`Fulfillment: ${order.fulfillmentType}`, 310, infoTop + 20).text(`Address: ${order.apartment.name}${order.block ? ` · ${order.block.name}` : ''}${order.flat ? ` · ${order.flat.number}` : ''}${order.address?.manualFlatNumber ? ` · Flat ${order.address.manualFlatNumber}` : ''}`, 55, infoTop + 40).text(order.address?.addressLine || '', 55, infoTop + 56);
    document.fillColor('#222').fontSize(10).text(`Flat / address: ${customerAddress}`, 55, infoTop + 72).text(`Phone: ${order.customer.phone || 'Phone number not provided'}`, 310, infoTop + 72);
    // Redraw the customer details cleanly so the address and phone do not overlap.
    document.rect(42, infoTop - 12, 511, 100).fillAndStroke('#faf8ff', '#e3dcf5');
    document.fillColor('#222').fontSize(10).text(`Customer: ${order.customer.name ?? 'Customer'}`, 55, infoTop).text(`Phone: ${order.customer.phone || 'Phone number not provided'}`, 310, infoTop).text(`Status: ${order.status}`, 55, infoTop + 20).text(`Fulfillment: ${order.fulfillmentType}`, 310, infoTop + 20).text(`Address: ${customerAddress}`, 55, infoTop + 40).text(order.address?.addressLine || '', 55, infoTop + 56);
    document.y = infoTop + 112;
    document.fontSize(10).fillColor('#777').text('ITEM', 55, document.y).text('QTY', 360, document.y).text('AMOUNT', 450, document.y); document.moveDown(0.5);
    document.moveTo(55, document.y).lineTo(540, document.y).strokeColor('#ddd6ec').stroke();
    for (const item of order.items) { document.moveDown(0.5).fillColor('#222').text(item.productName, 55, document.y).text(String(item.quantity), 360, document.y).text(`₹${Number(item.totalPrice).toFixed(2)}`, 450, document.y); }
    document.moveDown().moveTo(350, document.y).lineTo(540, document.y).strokeColor('#ddd6ec').stroke(); document.moveDown().fontSize(14).fillColor('#4b2eb4').text(`Total: ₹${Number(order.total).toFixed(2)}`, 360, document.y).fontSize(10).fillColor('#555').text(`Notes: ${order.customerNotes || '—'}`, 55, document.y + 20);
    document.end();
  } catch (error) { next(error); }
});
