import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.middleware.js';
import { prisma } from '../lib/prisma.js';
import { getPrimaryApartment } from '../services/home.service.js';

export const couponRouter = Router();

const couponCode = z.string().trim().min(3).max(80).regex(/^[A-Z0-9_-]+$/).transform(value => value.toUpperCase());
const couponInput = z.object({
  code: couponCode,
  amount: z.number().positive(),
  firstOrderOnly: z.boolean().default(false),
  validFrom: z.coerce.date(),
  validTo: z.coerce.date(),
  minimumSubtotal: z.number().nonnegative().default(0),
  maxUsesPerCustomer: z.union([z.literal(1), z.literal(2)]).nullable(),
  apartmentIds: z.array(z.string().uuid()).min(1).max(100),
});

async function sellerForUser(userId: string) {
  return prisma.sellerProfile.findUnique({ where: { userId }, include: { deliveryAreas: true } });
}

async function servingApartmentIds(seller: NonNullable<Awaited<ReturnType<typeof sellerForUser>>>) {
  if (seller.sellerType === 'APARTMENT') return seller.apartmentId ? [seller.apartmentId] : [];
  return seller.deliveryAreas.filter(area => area.isApproved && area.isEnabled).map(area => area.apartmentId);
}

async function checkCoupon(coupon: any, userId: string, apartmentId: string, subtotal: number, sellerId: string, client: any = prisma) {
  const now = new Date();
  if (!coupon || coupon.sellerId !== sellerId || !coupon.isActive) return { valid: false, message: 'This coupon is not available.' };
  if (now < coupon.validFrom || now > coupon.validTo) return { valid: false, message: 'This coupon is outside its valid dates.' };
  if (coupon.apartmentTargets.length && !coupon.apartmentTargets.some((target: any) => target.apartmentId === apartmentId)) return { valid: false, message: 'This coupon is not valid for your apartment.' };
  if (coupon.firstOrderOnly) {
    const previousOrder = await client.order.findFirst({ where: { customerId: userId, sellerId }, select: { id: true } });
    if (previousOrder) return { valid: false, message: 'This coupon is only valid on your first order from this seller.' };
  }
  const redemptionCount = await client.couponRedemption.count({ where: { couponId: coupon.id, userId } });
  if (coupon.maxUsesPerCustomer != null && redemptionCount >= coupon.maxUsesPerCustomer) return { valid: false, message: `You have already used this coupon ${coupon.maxUsesPerCustomer} time${coupon.maxUsesPerCustomer === 1 ? '' : 's'}.` };
  const minimum = Number(coupon.minimumSubtotal);
  if (subtotal < minimum) return { valid: false, message: `Add ₹${(minimum - subtotal).toFixed(2)} more to unlock this offer.`, addMoreAmount: Number((minimum - subtotal).toFixed(2)), minimumSubtotal: minimum };
  const discount = Math.min(Number(coupon.amount), subtotal);
  return { valid: true, couponId: coupon.id, code: coupon.code, discount, minimumSubtotal: minimum };
}

couponRouter.get('/coupons', requireAuth, async (request, response, next) => {
  try {
    const seller = await sellerForUser(request.auth!.userId);
    if (!seller) { response.status(403).json({ error: { code: 'SELLER_REQUIRED', message: 'Seller access is required' } }); return; }
    response.json(await (prisma as any).coupon.findMany({ where: { sellerId: seller.id }, include: { apartmentTargets: { include: { apartment: true } }, _count: { select: { redemptions: true } } }, orderBy: { createdAt: 'desc' } }));
  } catch (error) { next(error); }
});

couponRouter.get('/coupons/available', requireAuth, async (request, response, next) => {
  try {
    const input = z.object({ sellerId: z.string().uuid(), subtotal: z.coerce.number().nonnegative() }).parse(request.query);
    const context = await getPrimaryApartment(request.auth!.userId);
    if (!context) { response.json({ eligible: [], suggestions: [] }); return; }
    const coupons = await (prisma as any).coupon.findMany({ where: { sellerId: input.sellerId, isActive: true, validFrom: { lte: new Date() }, validTo: { gte: new Date() } }, include: { apartmentTargets: true }, orderBy: { minimumSubtotal: 'asc' } });
    const results = await Promise.all(coupons.map(async (coupon: any) => checkCoupon(coupon, request.auth!.userId, context.apartmentId, input.subtotal, input.sellerId)));
    const eligible = results.filter(result => result.valid).map(result => ({ code: result.code, discount: result.discount, minimumSubtotal: result.minimumSubtotal }));
    const suggestions = results.filter(result => !result.valid && result.addMoreAmount).map(result => ({ code: result.code, addMoreAmount: result.addMoreAmount, minimumSubtotal: result.minimumSubtotal, discount: result.discount || 0 }));
    response.json({ eligible, suggestions });
  } catch (error) { next(error); }
});

couponRouter.post('/coupons', requireAuth, async (request, response, next) => {
  try {
    const seller = await sellerForUser(request.auth!.userId);
    if (!seller) { response.status(403).json({ error: { code: 'SELLER_REQUIRED', message: 'Seller access is required' } }); return; }
    const input = couponInput.parse(request.body);
    if (input.validTo <= input.validFrom) throw new Error('COUPON_DATE_RANGE_INVALID');
    const allowed = new Set(await servingApartmentIds(seller));
    if (input.apartmentIds.some(id => !allowed.has(id))) throw new Error('COUPON_APARTMENT_INVALID');
    const created = await (prisma as any).coupon.create({ data: { sellerId: seller.id, code: input.code, amount: input.amount, firstOrderOnly: input.firstOrderOnly, validFrom: input.validFrom, validTo: input.validTo, minimumSubtotal: input.minimumSubtotal, maxUsesPerCustomer: input.maxUsesPerCustomer, apartmentTargets: { create: input.apartmentIds.map(apartmentId => ({ apartmentId })) } }, include: { apartmentTargets: { include: { apartment: true } } } });
    response.status(201).json(created);
  } catch (error) { next(error); }
});

couponRouter.patch('/coupons/:couponId', requireAuth, async (request, response, next) => {
  try {
    const seller = await sellerForUser(request.auth!.userId);
    if (!seller) { response.status(403).json({ error: { code: 'SELLER_REQUIRED', message: 'Seller access is required' } }); return; }
    const input = z.object({ isActive: z.boolean() }).parse(request.body);
    const coupon = await (prisma as any).coupon.findFirst({ where: { id: request.params.couponId, sellerId: seller.id } });
    if (!coupon) { response.status(404).json({ error: { code: 'COUPON_NOT_FOUND', message: 'Coupon not found' } }); return; }
    if (!input.isActive && coupon.isActive) {
      response.json(await (prisma as any).coupon.update({ where: { id: coupon.id }, data: { isActive: false } }));
      return;
    }
    if (input.isActive && !coupon.isActive) throw new Error('COUPON_CANNOT_BE_REACTIVATED');
    response.json(coupon);
  } catch (error) { next(error); }
});

couponRouter.post('/coupons/validate', requireAuth, async (request, response, next) => {
  try {
    const input = z.object({ sellerId: z.string().uuid(), code: couponCode, subtotal: z.number().nonnegative() }).parse(request.body);
    const context = await getPrimaryApartment(request.auth!.userId);
    if (!context) { response.status(400).json({ valid: false, message: 'Select your apartment before applying a coupon.' }); return; }
    const coupon = await (prisma as any).coupon.findUnique({ where: { code: input.code }, include: { apartmentTargets: true } });
    response.json(await checkCoupon(coupon, request.auth!.userId, context.apartmentId, input.subtotal, input.sellerId));
  } catch (error) { next(error); }
});

export async function validateCouponForCheckout(tx: Prisma.TransactionClient, input: { code: string; sellerId: string; userId: string; apartmentId: string; subtotal: Prisma.Decimal }) {
  const normalizedCode = input.code.trim().toUpperCase();
  const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM coupons WHERE code = ${normalizedCode} AND seller_id = ${input.sellerId}::uuid FOR UPDATE`;
  const coupon = locked[0] ? await (tx as any).coupon.findUnique({ where: { id: locked[0].id }, include: { apartmentTargets: true } }) : null;
  const result = await checkCoupon(coupon, input.userId, input.apartmentId, Number(input.subtotal), input.sellerId, tx);
  if (!result.valid) { const message = result.message || ''; throw new Error(message === 'This coupon is outside its valid dates.' ? 'COUPON_EXPIRED' : message.includes('Add ₹') ? 'COUPON_MINIMUM_NOT_MET' : message.includes('first order') ? 'COUPON_FIRST_ORDER_ONLY' : message.includes('used this coupon') ? 'COUPON_USAGE_LIMIT' : 'COUPON_INVALID'); }
  return { coupon, discount: new Prisma.Decimal(result.discount || 0) };
}
