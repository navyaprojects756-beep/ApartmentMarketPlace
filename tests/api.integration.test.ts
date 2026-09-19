import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import request from 'supertest';
import { app } from '../backend/src/app.js';

async function login(phone: string) {
  const otpResponse = await request(app).post('/api/v1/auth/request-otp').send({ phone });
  assert.equal(otpResponse.status, 200);
  const verifyResponse = await request(app).post('/api/v1/auth/verify-otp').send({ phone, otp: otpResponse.body.developmentOtp });
  assert.equal(verifyResponse.status, 200);
  return verifyResponse.body.accessToken as string;
}

describe('Apartment Marketplace HTTP API', () => {
  it('authenticates a seeded customer and returns scoped Home data', async () => {
    const token = await login('9000000010');
    const response = await request(app).get('/api/v1/home').set('Authorization', `Bearer ${token}`);
    assert.equal(response.status, 200);
    assert.equal(response.body.mode, 'BOTH');
    assert.ok(response.body.localSellers.length > 0);
    assert.ok(response.body.outsideSellers.length > 0);
    const adRequest = await request(app).post('/api/v1/advertisements/requests').set('Authorization', `Bearer ${token}`).send({ title: `Community event ${Date.now()}`, description: 'A seeded integration-test advertisement request.', type: 'EVENT' });
    assert.equal(adRequest.status, 201);
    const myRequests = await request(app).get('/api/v1/advertisements/requests/mine').set('Authorization', `Bearer ${token}`);
    assert.equal(myRequests.status, 200);
    assert.ok(myRequests.body.some((item: { id: string }) => item.id === adRequest.body.id));
    const image = await request(app).post('/api/v1/uploads/image').set('Authorization', `Bearer ${token}`).send({ dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=' });
    assert.equal(image.status, 201);
    const storedImage = await request(app).get(image.body.url);
    assert.equal(storedImage.status, 200);
  });

  it('supports community onboarding for a new phone user', async () => {
    const newPhone = `900${Date.now().toString().slice(-7)}`;
    const token = await login(newPhone);
    const before = await request(app).get('/api/v1/home').set('Authorization', `Bearer ${token}`);
    assert.equal(before.status, 200);
    assert.equal(before.body.apartment, null);
    const apartments = await request(app).get('/api/v1/apartments?search=ABC').set('Authorization', `Bearer ${token}`);
    assert.equal(apartments.status, 200);
    const apartment = apartments.body[0];
    const association = await request(app).post('/api/v1/apartments/me').set('Authorization', `Bearer ${token}`).send({ apartmentId: apartment.id, blockId: null, flatId: null, manualFlatNumber: 'Manual-9' });
    assert.equal(association.status, 200);
    const after = await request(app).get('/api/v1/home').set('Authorization', `Bearer ${token}`);
    assert.equal(after.body.apartment.apartmentId, apartment.id);
  });

  it('rejects customer access to Global Admin settings', async () => {
    const token = await login('9000000010');
    const response = await request(app).get('/api/v1/admin/settings/home-seller-display-mode').set('Authorization', `Bearer ${token}`);
    assert.equal(response.status, 403);
  });

  it('allows a seeded seller to access seller dashboard data', async () => {
    const token = await login('9000000020');
    const response = await request(app).get('/api/v1/seller/dashboard').set('Authorization', `Bearer ${token}`);
    assert.equal(response.status, 200);
    assert.equal(response.body.seller.businessName, 'Home Foods');
    assert.ok(response.body.products >= 1);
    const orders = await request(app).get('/api/v1/seller/orders?status=PREPARING').set('Authorization', `Bearer ${token}`);
    assert.equal(orders.status, 200);
    assert.ok(orders.body.every((order: { status: string }) => order.status === 'PREPARING'));
    const readyOrders = await request(app).get('/api/v1/seller/orders?status=READY_FOR_PICKUP').set('Authorization', `Bearer ${token}`);
    const staff = await request(app).get('/api/v1/seller/delivery-boys').set('Authorization', `Bearer ${token}`);
    assert.equal(staff.status, 200);
    if (readyOrders.body[0] && staff.body[0]) {
      const assignment = await request(app).post(`/api/v1/delivery/orders/${readyOrders.body[0].id}/assign`).set('Authorization', `Bearer ${token}`).send({ deliveryBoyId: staff.body[0].id });
      assert.equal(assignment.status, 201);
    }
    if (orders.body[0]) {
      const print = await request(app).get(`/api/v1/exports/seller/orders/${orders.body[0].id}/print.pdf`).set('Authorization', `Bearer ${token}`);
      assert.equal(print.status, 200);
      assert.match(print.headers['content-type'], /application\/pdf/);
      const report = await request(app).get(`/api/v1/reports/seller/summary?apartmentId=${orders.body[0].apartmentId}&status=PREPARING`).set('Authorization', `Bearer ${token}`);
      assert.equal(report.status, 200);
      assert.equal(report.body.filters.status, 'PREPARING');
    const reportPdf = await request(app).get(`/api/v1/reports/seller/summary.pdf?apartmentId=${orders.body[0].apartmentId}`).set('Authorization', `Bearer ${token}`);
      assert.equal(reportPdf.status, 200);
      assert.match(reportPdf.headers['content-type'], /application\/pdf/);
    }
    const sellerSettings = await request(app).get('/api/v1/seller/settings').set('Authorization', `Bearer ${token}`);
    assert.equal(sellerSettings.status, 200);
    const settingsUpdate = await request(app).patch('/api/v1/seller/settings').set('Authorization', `Bearer ${token}`).send({ isOpen: true, pickupEnabled: true, operatingHours: [{ dayOfWeek: 1, openTime: '09:00', closeTime: '21:00', isClosed: false }] });
    assert.equal(settingsUpdate.status, 200);
    const customerToken = await login('9000000010');
    const visibleSellers = await request(app).get('/api/v1/sellers').set('Authorization', `Bearer ${customerToken}`);
    const homeFoods = visibleSellers.body.find((seller: { businessName: string }) => seller.businessName === 'Home Foods');
    const search = await request(app).get('/api/v1/search?q=Home').set('Authorization', `Bearer ${customerToken}`);
    assert.equal(search.status, 200);
    assert.ok(search.body.sellers.some((seller: { businessName: string }) => seller.businessName === 'Home Foods'));
    const storefront = await request(app).get(`/api/v1/sellers/${homeFoods.id}`).set('Authorization', `Bearer ${customerToken}`);
    assert.equal(storefront.status, 200);
    assert.ok(storefront.body.categories.length > 0);
    assert.ok(storefront.body.advertisements.length > 0);
    assert.ok(storefront.body.products.length > 0);
    const reviews = await request(app).get(`/api/v1/sellers/${homeFoods.id}/reviews`).set('Authorization', `Bearer ${customerToken}`);
    assert.equal(reviews.status, 200);
    assert.equal(typeof reviews.body.averageRating, 'number');
    const productId = storefront.body.products[0].id;
    const image = await request(app).post(`/api/v1/seller/products/${productId}/images`).set('Authorization', `Bearer ${token}`).send({ imageUrl: 'https://example.com/product-image.jpg', sortOrder: 5 });
    assert.equal(image.status, 201);
    const duplicate = await request(app).post(`/api/v1/seller/products/${productId}/duplicate`).set('Authorization', `Bearer ${token}`).send({ name: 'Test duplicate product' });
    assert.equal(duplicate.status, 201);
    assert.equal(duplicate.body.availability, false);
  });

  it('allows Global Admin to monitor and manage apartment resources', async () => {
    const token = await login('9000000001');
    const apartments = await request(app).get('/api/v1/admin/apartments').set('Authorization', `Bearer ${token}`);
    assert.equal(apartments.status, 200);
    const abc = apartments.body.find((item: { name: string }) => item.name === 'ABC Residency');
    assert.ok(abc);
    const block = abc.blocks[0];
    const bulkFlats = await request(app).post(`/api/v1/admin/apartments/${abc.id}/blocks/${block.id}/flats/bulk`).set('Authorization', `Bearer ${token}`).send({ numbers: ['A999'] });
    assert.equal(bulkFlats.status, 201);
    assert.ok(bulkFlats.body.created >= 1);
    const blockUpdate = await request(app).patch(`/api/v1/admin/blocks/${block.id}`).set('Authorization', `Bearer ${token}`).send({ name: block.name });
    assert.equal(blockUpdate.status, 200);

    const users = await request(app).get('/api/v1/admin/users?search=Riya').set('Authorization', `Bearer ${token}`);
    assert.equal(users.status, 200);
    assert.ok(users.body.some((item: { phone: string }) => item.phone === '9000000010'));
    const customerUser = users.body.find((item: { phone: string }) => item.phone === '9000000010');
    const userUpdate = await request(app).patch(`/api/v1/admin/users/${customerUser.id}`).set('Authorization', `Bearer ${token}`).send({ name: 'Riya Sharma' });
    assert.equal(userUpdate.status, 200);
    const sellers = await request(app).get('/api/v1/admin/sellers').set('Authorization', `Bearer ${token}`);
    assert.equal(sellers.status, 200);
    assert.ok(sellers.body.some((item: { businessName: string }) => item.businessName === 'Home Foods'));
    const monitoredOrders = await request(app).get('/api/v1/admin/orders?search=ORD-SEED').set('Authorization', `Bearer ${token}`);
    assert.equal(monitoredOrders.status, 200);
    assert.ok(monitoredOrders.body.length > 0);

    const alerts = await request(app).get('/api/v1/admin/alerts').set('Authorization', `Bearer ${token}`);
    assert.equal(alerts.status, 200);
    assert.ok(Array.isArray(alerts.body));
    const adRequests = await request(app).get('/api/v1/advertisements/requests').set('Authorization', `Bearer ${token}`);
    assert.equal(adRequests.status, 200);
    if (adRequests.body[0]) {
      const review = await request(app).patch(`/api/v1/advertisements/requests/${adRequests.body[0].id}/review`).set('Authorization', `Bearer ${token}`).send({ decision: 'APPROVE', adminRemarks: 'Approved by integration test.' });
      assert.equal(review.status, 200);
      assert.equal(review.body.status, 'APPROVED');
    }
    const createdAlert = await request(app).post('/api/v1/admin/alerts').set('Authorization', `Bearer ${token}`).send({ title: 'Water supply update', description: 'Maintenance notice for residents.', apartmentIds: [abc.id], priority: 90 });
    assert.equal(createdAlert.status, 201);
    const customerToken = await login('9000000010');
    const importantAlerts = await request(app).get('/api/v1/important-alerts').set('Authorization', `Bearer ${customerToken}`);
    assert.equal(importantAlerts.status, 200);
    const matchingAlert = importantAlerts.body.find((item: { id: string }) => item.id === createdAlert.body.id);
    assert.ok(matchingAlert);
    assert.ok(matchingAlert.notificationId);
    const dismissed = await request(app).post(`/api/v1/notifications/${matchingAlert.notificationId}/dismiss`).set('Authorization', `Bearer ${customerToken}`);
    assert.equal(dismissed.status, 200);
  });

  it('allows Global Admin to update the enforced Home seller display mode', async () => {
    const token = await login('9000000001');
    const update = await request(app).patch('/api/v1/admin/settings/home-seller-display-mode').set('Authorization', `Bearer ${token}`).send({ mode: 'LOCAL_ONLY' });
    assert.equal(update.status, 200);
    assert.equal(update.body.mode, 'LOCAL_ONLY');
    const home = await request(app).get('/api/v1/home').set('Authorization', `Bearer ${await login('9000000010')}`);
    assert.equal(home.status, 200);
    assert.equal(home.body.mode, 'LOCAL_ONLY');
    assert.equal(home.body.outsideSellers.length, 0);
    await request(app).patch('/api/v1/admin/settings/home-seller-display-mode').set('Authorization', `Bearer ${token}`).send({ mode: 'BOTH' });
  });

  it('keeps delivery-boy queue scoped and rejects invalid status jumps', async () => {
    const token = await login('9000000040');
    const queue = await request(app).get('/api/v1/delivery/orders').set('Authorization', `Bearer ${token}`);
    assert.equal(queue.status, 200);
    assert.ok(Array.isArray(queue.body));
    if (queue.body[0]) {
      const invalid = await request(app).patch(`/api/v1/delivery/orders/${queue.body[0].id}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'DELIVERED' });
      assert.equal(invalid.status, 400);
    }
  });
});
