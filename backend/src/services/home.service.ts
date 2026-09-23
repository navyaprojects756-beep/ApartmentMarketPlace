import { prisma } from '../lib/prisma.js';
import { getSellerAvailability } from '../utils/seller-hours.js';

export async function getPrimaryApartment(userId: string) {
  const association = await prisma.userApartment.findFirst({ where: { userId }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }], include: { apartment: true, block: true, flat: true } });
  return association;
}

export async function getHomeData(userId: string) {
  const association = await getPrimaryApartment(userId);
  const mode = association?.apartment.sellerDisplayMode ?? 'BOTH';
  if (!association) return { mode, apartment: null, localSellers: [], outsideSellers: [], advertisements: [], homePromotions: [] };

  const sellerSelect = { id: true, sellerName: true, businessName: true, description: true, logoUrl: true, bannerUrl: true, sellerType: true, isOpen: true, deliveryEnabled: true, pickupEnabled: true, operatingHours: { select: { dayOfWeek: true, openTime: true, closeTime: true, isClosed: true } } } as const;
  const [localSellers, outsideSellers, advertisements, homePromotions] = await Promise.all([
    mode === 'OUTSIDE_ONLY' ? [] : prisma.sellerProfile.findMany({ where: { sellerType: 'APARTMENT', status: 'APPROVED', apartmentId: association.apartmentId }, select: sellerSelect, orderBy: { createdAt: 'asc' } }),
    mode === 'LOCAL_ONLY' ? [] : prisma.sellerProfile.findMany({ where: { sellerType: 'OUTSIDE', status: 'APPROVED', deliveryAreas: { some: { apartmentId: association.apartmentId, isApproved: true } } }, select: sellerSelect, orderBy: { createdAt: 'asc' } }),
    prisma.advertisement.findMany({ where: { status: 'APPROVED', type: { not: 'PROMOTION' }, AND: [{ OR: [{ startAt: null }, { startAt: { lte: new Date() } }] }, { OR: [{ endAt: null }, { endAt: { gte: new Date() } }] }, { OR: [{ targets: { none: {} } }, { targets: { some: { apartmentId: association.apartmentId } } }] }] }, orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }], take: 10 }),
    prisma.advertisement.findMany({ where: { type: 'PROMOTION', sellerId: null, status: 'APPROVED', OR: [{ startAt: null }, { startAt: { lte: new Date() } }], AND: [{ OR: [{ endAt: null }, { endAt: { gte: new Date() } }] }] }, orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }], take: 10 }),
  ]);

  const available = (sellers: typeof localSellers) => sellers.filter(seller => getSellerAvailability(seller).isOpen);
  return { mode, apartment: association, localSellers: available(localSellers), outsideSellers: available(outsideSellers), advertisements, homePromotions };
}
