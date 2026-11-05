import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getSellerAvailability } from '../backend/src/utils/seller-hours.js';

type Seller = { id: string; type: 'APARTMENT' | 'OUTSIDE'; approved: boolean; apartmentId?: string; deliveryApartments?: string[]; isOpen: boolean };
type Product = { id: string; sellerId: string; price: number; quantity: number; available: boolean };

function visibleSellers(sellers: Seller[], mode: 'LOCAL_ONLY' | 'OUTSIDE_ONLY' | 'BOTH', apartmentId: string) {
  return sellers.filter(seller => seller.approved && seller.isOpen && mode !== 'OUTSIDE_ONLY' && seller.type === 'APARTMENT' && seller.apartmentId === apartmentId || seller.approved && seller.isOpen && mode !== 'LOCAL_ONLY' && seller.type === 'OUTSIDE' && seller.deliveryApartments?.includes(apartmentId));
}

function cartTotal(items: Array<{ price: number; quantity: number }>, couponDiscount = 0, deliveryCharge = 0) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discount = Math.min(Math.max(0, couponDiscount), subtotal);
  return { subtotal, discount, deliveryCharge, total: subtotal - discount + deliveryCharge };
}

function reserveInventory(product: Product, quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1) return { ok: false, reason: 'INVALID_QUANTITY' };
  if (!product.available || product.quantity < quantity) return { ok: false, reason: 'OUT_OF_STOCK' };
  return { ok: true, remaining: product.quantity - quantity };
}

function variantFinalPrice(price: number, discount = 0) { return Math.max(0, price - discount); }
function variantCartKey(productId: string, variantId?: string | null) { return `${productId}:${variantId || 'base'}`; }
function variantAvailable(variant: { availability: boolean; inventoryTracking: boolean; quantity: number }) { return variant.availability && (!variant.inventoryTracking || variant.quantity > 0); }
function uniqueProductCount(productIds: string[]) { return new Set(productIds).size; }
function variantCreateAction(existing: { availability: boolean } | null) { return existing ? (existing.availability ? 'ALREADY_EXISTS' : 'REACTIVATE') : 'CREATE'; }

const transitions: Record<string, string[]> = {
  PENDING: ['ACCEPTED', 'CANCELLED'], ACCEPTED: ['PREPARING', 'CANCELLED'], PREPARING: ['READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'CANCELLED'],
  READY_FOR_PICKUP: ['HANDED_OVER', 'CANCELLED'], OUT_FOR_DELIVERY: ['DELIVERED'], DELIVERED: ['COMPLETED'], HANDED_OVER: ['COMPLETED'], COMPLETED: [], CANCELLED: [],
};

function canTransition(from: string, to: string) { return transitions[from]?.includes(to) ?? false; }

function filterDateRows<T extends { createdAt: string }>(rows: T[], from?: string, to?: string) {
  return rows.filter(row => (!from || row.createdAt.slice(0, 10) >= from) && (!to || row.createdAt.slice(0, 10) <= to));
}

function validateUpload(dataUrl: string, maxBytes = 1.5 * 1024 * 1024) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!match) return { ok: false, reason: 'IMAGE_FORMAT_NOT_SUPPORTED' };
  const bytes = Buffer.from(match[2].replaceAll(/\s/g, ''), 'base64').length;
  return bytes > 0 && bytes <= maxBytes ? { ok: true, mimeType: match[1], bytes } : { ok: false, reason: 'IMAGE_SIZE_INVALID' };
}

describe('database-free backend business rules', () => {
  it('keeps seller availability closed when the explicit active flag is false', () => {
    assert.deepEqual(getSellerAvailability({ isOpen: false }), { isOpen: false, reason: 'Store is inactive.' });
  });

  it('handles empty schedules using the explicit seller active flag', () => {
    assert.equal(getSellerAvailability({ isOpen: true }).isOpen, true);
  });

  it('treats a configured missing weekday as closed', () => {
    assert.equal(getSellerAvailability({ isOpen: true, operatingHours: [{ dayOfWeek: 0, openTime: '10:00', closeTime: '20:00', isClosed: false }] }, new Date('2026-11-02T12:00:00Z')).isOpen, false);
  });

  it('supports overnight seller hours', () => {
    assert.equal(getSellerAvailability({ isOpen: true, operatingHours: [{ dayOfWeek: 1, openTime: '22:00', closeTime: '02:00', isClosed: false }] }, new Date('2026-11-02T16:30:00Z')).isOpen, true);
  });

  it('filters home sellers by approval, mode, apartment, delivery scope, and availability', () => {
    const sellers: Seller[] = [
      { id: 'local', type: 'APARTMENT', approved: true, apartmentId: 'a1', isOpen: true },
      { id: 'outside', type: 'OUTSIDE', approved: true, deliveryApartments: ['a1'], isOpen: true },
      { id: 'wrong-apartment', type: 'APARTMENT', approved: true, apartmentId: 'a2', isOpen: true },
      { id: 'closed', type: 'APARTMENT', approved: true, apartmentId: 'a1', isOpen: false },
    ];
    assert.deepEqual(visibleSellers(sellers, 'BOTH', 'a1').map(item => item.id), ['local', 'outside']);
    assert.deepEqual(visibleSellers(sellers, 'LOCAL_ONLY', 'a1').map(item => item.id), ['local']);
    assert.deepEqual(visibleSellers(sellers, 'OUTSIDE_ONLY', 'a1').map(item => item.id), ['outside']);
  });

  it('validates accepted upload formats and rejects malformed data URLs', () => {
    const valid = validateUpload('data:image/png;base64,AA==');
    assert.equal(valid.ok, true);
    assert.equal(validateUpload('data:image/gif;base64,AA==').reason, 'IMAGE_FORMAT_NOT_SUPPORTED');
    assert.equal(validateUpload('not-an-image').reason, 'IMAGE_FORMAT_NOT_SUPPORTED');
  });

  it('rejects empty and oversized image payloads', () => {
    assert.equal(validateUpload('data:image/png;base64,').reason, 'IMAGE_FORMAT_NOT_SUPPORTED');
    const oversized = `data:image/png;base64,${Buffer.alloc(20).toString('base64')}`;
    assert.equal(validateUpload(oversized, 10).reason, 'IMAGE_SIZE_INVALID');
  });

  it('calculates cart subtotal, capped discount, delivery, and total separately', () => {
    assert.deepEqual(cartTotal([{ price: 100, quantity: 2 }, { price: 50, quantity: 1 }], 75, 30), { subtotal: 250, discount: 75, deliveryCharge: 30, total: 205 });
    assert.equal(cartTotal([{ price: 10, quantity: 1 }], 99).discount, 10);
  });

  it('rejects invalid or unavailable inventory reservations', () => {
    assert.deepEqual(reserveInventory({ id: 'p', sellerId: 's', price: 10, quantity: 2, available: true }, 2), { ok: true, remaining: 0 });
    assert.equal(reserveInventory({ id: 'p', sellerId: 's', price: 10, quantity: 2, available: true }, 3).reason, 'OUT_OF_STOCK');
    assert.equal(reserveInventory({ id: 'p', sellerId: 's', price: 10, quantity: 2, available: false }, 1).reason, 'OUT_OF_STOCK');
  });

  it('allows only valid forward order transitions', () => {
    assert.equal(canTransition('PENDING', 'ACCEPTED'), true);
    assert.equal(canTransition('PENDING', 'COMPLETED'), false);
    assert.equal(canTransition('COMPLETED', 'PREPARING'), false);
    assert.equal(canTransition('OUT_FOR_DELIVERY', 'DELIVERED'), true);
  });

  it('filters admin/order records by inclusive ISO date ranges', () => {
    const rows = [{ id: 'old', createdAt: '2026-11-01T10:00:00Z' }, { id: 'today', createdAt: '2026-11-05T10:00:00Z' }, { id: 'new', createdAt: '2026-11-06T10:00:00Z' }];
    assert.deepEqual(filterDateRows(rows, '2026-11-05', '2026-11-05').map(row => row.id), ['today']);
    assert.deepEqual(filterDateRows(rows, '2026-11-05').map(row => row.id), ['today', 'new']);
  });

  it('keeps terminal orders terminal', () => {
    assert.equal(Object.values(transitions).some(next => next.includes('COMPLETED')), true);
    assert.equal(Object.values(transitions).some(next => next.includes('CANCELLED')), true);
    assert.equal(canTransition('CANCELLED', 'ACCEPTED'), false);
  });

  it('calculates variant price without allowing negative prices', () => {
    assert.equal(variantFinalPrice(500, 100), 400);
    assert.equal(variantFinalPrice(100, 150), 0);
    assert.equal(variantFinalPrice(250), 250);
  });

  it('keeps same product variants as separate cart lines', () => {
    assert.notEqual(variantCartKey('product-1', 'size-xl'), variantCartKey('product-1', 'size-l'));
    assert.equal(variantCartKey('product-1'), 'product-1:base');
  });

  it('marks tracked zero-stock variants unavailable while allowing untracked variants', () => {
    assert.equal(variantAvailable({ availability: true, inventoryTracking: true, quantity: 0 }), false);
    assert.equal(variantAvailable({ availability: true, inventoryTracking: true, quantity: 2 }), true);
    assert.equal(variantAvailable({ availability: true, inventoryTracking: false, quantity: 0 }), true);
    assert.equal(variantAvailable({ availability: false, inventoryTracking: false, quantity: 10 }), false);
  });

  it('validates checkout products by unique product IDs when multiple variants are ordered', () => {
    assert.equal(uniqueProductCount(['product-1', 'product-1']), 1);
    assert.equal(uniqueProductCount(['product-1', 'product-2']), 2);
  });

  it('reactivates a matching inactive variant instead of creating a duplicate', () => {
    assert.equal(variantCreateAction({ availability: false }), 'REACTIVATE');
    assert.equal(variantCreateAction({ availability: true }), 'ALREADY_EXISTS');
    assert.equal(variantCreateAction(null), 'CREATE');
  });
});
