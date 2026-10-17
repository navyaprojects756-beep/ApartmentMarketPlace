import { prisma } from '../lib/prisma.js';
import { getSellerAvailability } from '../utils/seller-hours.js';

export async function getPrimaryApartment(userId: string) {
  const association = await prisma.userApartment.findFirst({ where: { userId }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }], include: { apartment: true, block: true, flat: true } });
  return association;
}

export async function getHomeData(userId: string) {
  const association = await getPrimaryApartment(userId);
  const mode = association?.apartment.sellerDisplayMode ?? 'BOTH';
  if (!association) return { mode, apartment: null, localSellers: [], outsideSellers: [], advertisements: [], homePromotions: [], communityServices: [] };

  const sellerSelect = { id: true, sellerName: true, businessName: true, description: true, logoUrl: true, bannerUrl: true, sellerType: true, isOpen: true, deliveryEnabled: true, pickupEnabled: true, showRatings: true, reviews: { where: { productId: null }, select: { rating: true } }, operatingHours: { select: { dayOfWeek: true, openTime: true, closeTime: true, isClosed: true } } } as const;
  const [localSellers, outsideSellers, advertisements, homePromotions, globalCategories, communityServices] = await Promise.all([
    mode === 'OUTSIDE_ONLY' ? [] : prisma.sellerProfile.findMany({ where: { sellerType: 'APARTMENT', status: 'APPROVED', apartmentId: association.apartmentId }, select: sellerSelect, orderBy: { createdAt: 'asc' } }),
    mode === 'LOCAL_ONLY' ? [] : prisma.sellerProfile.findMany({ where: { sellerType: 'OUTSIDE', status: 'APPROVED', deliveryAreas: { some: { apartmentId: association.apartmentId, isApproved: true, isEnabled: true } } }, select: sellerSelect, orderBy: { createdAt: 'asc' } }),
    prisma.advertisement.findMany({ where: { status: 'APPROVED', type: { not: 'PROMOTION' }, AND: [{ OR: [{ startAt: null }, { startAt: { lte: new Date() } }] }, { OR: [{ endAt: null }, { endAt: { gte: new Date() } }] }, { OR: [{ targets: { none: {} } }, { targets: { some: { apartmentId: association.apartmentId } } }] }] }, orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }], take: 10 }),
    prisma.advertisement.findMany({ where: { type: 'PROMOTION', sellerId: null, status: 'APPROVED', OR: [{ startAt: null }, { startAt: { lte: new Date() } }], AND: [{ OR: [{ endAt: null }, { endAt: { gte: new Date() } }] }, { OR: [{ targets: { none: {} } }, { targets: { some: { apartmentId: association.apartmentId } } }] }] }, orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }], take: 10 }),
    prisma.globalCategory.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.communityService.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], include: { providers: { where: { isActive: true, apartments: { some: { apartmentId: association.apartmentId } } }, select: { id: true } } } }),
  ]);

  const available = (sellers: typeof localSellers) => sellers.filter(seller => getSellerAvailability(seller).isOpen);
  const presentSeller = (seller: any) => { const ratings = seller.reviews || []; const showRatings = seller.showRatings === true; const rating = showRatings && ratings.length ? Number((ratings.reduce((sum: number, item: { rating: number }) => sum + item.rating, 0) / ratings.length).toFixed(1)) : null; const { reviews, ...visibleSeller } = seller; return { ...visibleSeller, rating, reviewCount: showRatings ? ratings.length : 0 }; };
  return { mode, apartment: association, localSellers: available(localSellers).map(presentSeller), outsideSellers: available(outsideSellers).map(presentSeller), advertisements, homePromotions, globalCategories, communityServices: communityServices.map(service => ({ ...service, providerCount: service.providers.length, providers: undefined })) };
}
