import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { prisma } from '../backend/src/lib/prisma.js';
import { getHomeData } from '../backend/src/services/home.service.js';

const customer = '9000000010';

describe('Apartment Marketplace critical database rules', () => {
  let customerId: string;
  let originalMode = 'BOTH';

  before(async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { phone: customer } });
    customerId = user.id;
    const setting = await prisma.platformSetting.findUnique({ where: { key: 'home_seller_display_mode' } });
    originalMode = setting?.value ?? 'BOTH';
  });

  after(async () => {
    await prisma.platformSetting.upsert({ where: { key: 'home_seller_display_mode' }, update: { value: originalMode }, create: { key: 'home_seller_display_mode', value: originalMode } });
    await prisma.$disconnect();
  });

  it('has every required role and seeded apartment structure', async () => {
    const roles = await prisma.role.findMany({ select: { code: true } });
    assert.deepEqual(new Set(roles.map(role => role.code)), new Set(['CUSTOMER', 'APARTMENT_SELLER', 'OUTSIDE_SELLER', 'DELIVERY_BOY', 'GLOBAL_ADMIN']));
    assert.equal(await prisma.apartment.count(), 4);
    assert.ok(await prisma.block.count() >= 2);
    assert.ok(await prisma.flat.count() >= 4);
  });

  it('returns both seller types in BOTH home mode', async () => {
    await prisma.platformSetting.update({ where: { key: 'home_seller_display_mode' }, data: { value: 'BOTH' } });
    const home = await getHomeData(customerId);
    assert.equal(home.mode, 'BOTH');
    assert.ok(home.localSellers.length > 0);
    assert.ok(home.outsideSellers.length > 0);
  });

  it('never returns disabled seller types', async () => {
    await prisma.platformSetting.update({ where: { key: 'home_seller_display_mode' }, data: { value: 'LOCAL_ONLY' } });
    const localOnly = await getHomeData(customerId);
    assert.ok(localOnly.localSellers.length > 0);
    assert.equal(localOnly.outsideSellers.length, 0);

    await prisma.platformSetting.update({ where: { key: 'home_seller_display_mode' }, data: { value: 'OUTSIDE_ONLY' } });
    const outsideOnly = await getHomeData(customerId);
    assert.equal(outsideOnly.localSellers.length, 0);
    assert.ok(outsideOnly.outsideSellers.length > 0);
  });

  it('contains seeded inventory, orders, and delivery scope', async () => {
    assert.ok(await prisma.product.count() >= 50);
    assert.ok(await prisma.sellerCategory.count() >= 10);
    assert.ok(await prisma.inventory.count() >= 50);
    assert.ok(await prisma.sellerProfile.count() >= 6);
    assert.ok(await prisma.order.count() >= 2);
    assert.ok(await prisma.deliveryBoySeller.count() >= 2);
    assert.ok(await prisma.deliveryBoyApartment.count() >= 1);
    const statuses = await prisma.order.findMany({ distinct: ['status'], select: { status: true } });
    assert.ok(new Set(statuses.map(order => order.status)).size >= 9);
  });
});
