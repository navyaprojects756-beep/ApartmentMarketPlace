import { Router } from 'express';
import { Prisma, type OrderStatus } from '@prisma/client';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { prisma } from '../lib/prisma.js';
import { sendPushNotifications } from '../services/push.service.js';

export const adminNotificationsRouter = Router();
const adminOnly = [requireAuth, requireRole('GLOBAL_ADMIN')];
const activeOrderStatuses: OrderStatus[] = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'ASSIGNED_TO_DELIVERY_BOY', 'PICKED_UP', 'OUT_FOR_DELIVERY'];
const routeSchema = z.enum(['home', 'orders', 'seller-orders', 'profile']).default('home');
const filtersSchema = z.object({
  apartmentId: z.string().uuid().optional().nullable(),
  sellerId: z.string().uuid().optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
  search: z.string().trim().max(120).optional().nullable(),
  activeOrdersOnly: z.boolean().default(false),
});

function recipientWhere(filters: z.infer<typeof filtersSchema>): Prisma.UserWhereInput {
  const conditions: Prisma.UserWhereInput[] = [];
  const where: Prisma.UserWhereInput = { isActive: true };
  if (filters.userId) conditions.push({ id: filters.userId });
  if (filters.apartmentId) conditions.push({ apartments: { some: { apartmentId: filters.apartmentId } } });
  if (filters.search) conditions.push({ OR: [{ name: { contains: filters.search, mode: 'insensitive' } }, { phone: { contains: filters.search } }] });
  const orderCondition: Prisma.OrderWhereInput = {
    ...(filters.sellerId ? { sellerId: filters.sellerId } : {}),
    ...(filters.activeOrdersOnly ? { status: { in: activeOrderStatuses } } : {}),
  };
  if (filters.sellerId) {
    conditions.push({ OR: [
      { sellerProfile: { is: { id: filters.sellerId } } },
      { orders: { some: orderCondition } },
    ] });
  } else if (filters.activeOrdersOnly) {
    conditions.push({ orders: { some: orderCondition } });
  }
  if (conditions.length) where.AND = conditions;
  return where;
}

async function findRecipients(filters: z.infer<typeof filtersSchema>) {
  return prisma.user.findMany({
    where: recipientWhere(filters),
    select: {
      id: true,
      name: true,
      phone: true,
      roles: { select: { role: { select: { code: true } } } },
      apartments: { where: { isPrimary: true }, select: { apartment: { select: { id: true, name: true } } } },
      sellerProfile: { select: { id: true, businessName: true, sellerName: true } },
      pushDevices: { where: { isActive: true }, select: { id: true } },
    },
    orderBy: [{ name: 'asc' }, { phone: 'asc' }],
    take: 2000,
  });
}

function recipientView(user: Awaited<ReturnType<typeof findRecipients>>[number]) {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    roles: user.roles.map(item => item.role.code),
    apartment: user.apartments[0]?.apartment || null,
    seller: user.sellerProfile,
    hasActivePushDevice: user.pushDevices.length > 0,
  };
}

adminNotificationsRouter.post('/notification-campaigns/preview', ...adminOnly, async (request, response, next) => {
  try {
    const filters = filtersSchema.parse(request.body?.filters || {});
    const recipients = await findRecipients(filters);
    response.json({ count: recipients.length, pushReadyCount: recipients.filter(item => item.pushDevices.length > 0).length, recipients: recipients.map(recipientView) });
  } catch (error) { next(error); }
});

adminNotificationsRouter.post('/notification-campaigns', ...adminOnly, async (request, response, next) => {
  try {
    const input = z.object({ title: z.string().trim().min(2).max(180), message: z.string().trim().min(2).max(4000), route: routeSchema, filters: filtersSchema }).parse(request.body);
    const recipients = await findRecipients(input.filters);
    if (!recipients.length) { response.status(400).json({ error: { code: 'NO_NOTIFICATION_RECIPIENTS', message: 'No active users match these filters.' } }); return; }
    const campaign = await prisma.notificationCampaign.create({ data: { createdById: request.auth!.userId, title: input.title, message: input.message, route: input.route, filters: input.filters } });
    await prisma.notification.createMany({ data: recipients.map(user => ({ userId: user.id, campaignId: campaign.id, type: 'SYSTEM' as const, title: input.title, message: input.message, data: { route: input.route, campaignId: campaign.id } })) });
    await prisma.auditLog.create({ data: { actorId: request.auth!.userId, action: 'NOTIFICATION_CAMPAIGN_SENT', entityType: 'NotificationCampaign', entityId: campaign.id, afterData: { title: input.title, filters: input.filters, recipientCount: recipients.length } } });
    void sendPushNotifications(recipients.map(user => ({ userId: user.id, title: input.title, body: input.message, data: { route: input.route, campaignId: campaign.id } })));
    response.status(201).json({ id: campaign.id, recipientCount: recipients.length, pushReadyCount: recipients.filter(item => item.pushDevices.length > 0).length, sentAt: campaign.createdAt });
  } catch (error) { next(error); }
});

adminNotificationsRouter.get('/notification-campaigns', ...adminOnly, async (_request, response, next) => {
  try {
    const campaigns = await prisma.notificationCampaign.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { _count: { select: { notifications: true } } } });
    const result = await Promise.all(campaigns.map(async campaign => ({
      ...campaign,
      readCount: await prisma.notificationRead.count({ where: { notification: { campaignId: campaign.id } } }),
    })));
    response.json(result);
  } catch (error) { next(error); }
});

adminNotificationsRouter.get('/notification-campaigns/:campaignId', ...adminOnly, async (request, response, next) => {
  try {
    const campaignId = z.string().uuid().parse(request.params.campaignId);
    const campaign = await prisma.notificationCampaign.findUnique({ where: { id: campaignId }, include: { notifications: { include: { user: { select: { id: true, name: true, phone: true, apartments: { where: { isPrimary: true }, select: { apartment: { select: { name: true } } } } } }, reads: true }, orderBy: { user: { name: 'asc' } } } } });
    if (!campaign) { response.status(404).json({ error: { code: 'CAMPAIGN_NOT_FOUND', message: 'Notification campaign not found.' } }); return; }
    response.json({ ...campaign, recipients: campaign.notifications.map(notification => ({ id: notification.user.id, name: notification.user.name, phone: notification.user.phone, apartment: notification.user.apartments[0]?.apartment?.name || null, received: true, readAt: notification.reads[0]?.readAt || null, dismissedAt: notification.reads[0]?.dismissedAt || null })) });
  } catch (error) { next(error); }
});
