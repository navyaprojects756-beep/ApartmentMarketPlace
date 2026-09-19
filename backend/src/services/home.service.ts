import { prisma } from '../lib/prisma.js';

export async function getPrimaryApartment(userId: string) {
  const association = await prisma.userApartment.findFirst({ where: { userId }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }], include: { apartment: true, block: true, flat: true } });
  return association;
}

export async function getHomeData(userId: string) {
  const association = await getPrimaryApartment(userId);
  const setting = await prisma.platformSetting.findUnique({ where: { key: 'home_seller_display_mode' } });
  const mode = setting?.value === 'LOCAL_ONLY' || setting?.value === 'OUTSIDE_ONLY' ? setting.value : 'BOTH';
  if (!association) return { mode, apartment: null, localSellers: [], outsideSellers: [], advertisements: [] };

  const sellerSelect = { id: true, sellerName: true, businessName: true, description: true, logoUrl: true, bannerUrl: true, sellerType: true, isOpen: true, deliveryEnabled: true, pickupEnabled: true } as const;
  const [localSellers, outsideSellers, advertisements] = await Promise.all([
    mode === 'OUTSIDE_ONLY' ? [] : prisma.sellerProfile.findMany({ where: { sellerType: 'APARTMENT', status: 'APPROVED', apartmentId: association.apartmentId }, select: sellerSelect, orderBy: { createdAt: 'asc' } }),
    mode === 'LOCAL_ONLY' ? [] : prisma.sellerProfile.findMany({ where: { sellerType: 'OUTSIDE', status: 'APPROVED', deliveryAreas: { some: { apartmentId: association.apartmentId, isApproved: true } } }, select: sellerSelect, orderBy: { createdAt: 'asc' } }),
    prisma.advertisement.findMany({ where: { status: 'APPROVED', AND: [{ OR: [{ startAt: null }, { startAt: { lte: new Date() } }] }, { OR: [{ endAt: null }, { endAt: { gte: new Date() } }] }, { OR: [{ targets: { none: {} } }, { targets: { some: { apartmentId: association.apartmentId } } }] }] }, orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }], take: 10 }),
  ]);

  return { mode, apartment: association, localSellers, outsideSellers, advertisements };
}
