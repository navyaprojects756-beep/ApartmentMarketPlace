import { prisma } from '../lib/prisma.js';
import { getApp, getApps, initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { readFileSync } from 'node:fs';
import { env } from '../config/env.js';

const expoPushUrl = 'https://exp.host/--/api/v2/push/send';

type PushMessage = {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  channelId?: 'seller_orders' | 'customer_updates';
  sound?: string;
};

function firebaseMessaging() {
  const serviceAccount = env.FIREBASE_SERVICE_ACCOUNT_PATH
    ? JSON.parse(readFileSync(env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8'))
    : env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY
      ? { projectId: env.FIREBASE_PROJECT_ID, clientEmail: env.FIREBASE_CLIENT_EMAIL, privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') }
      : null;
  if (!serviceAccount) throw new Error('Firebase Admin credentials are not configured.');
  const app = getApps().length ? getApp() : initializeApp({ credential: cert(serviceAccount) });
  return getMessaging(app);
}

function isExpoToken(token: string) {
  return /^(Expo|Exponent)PushToken\[.+\]$/.test(token);
}

export async function sendPushNotifications(messages: PushMessage[]) {
  if (!messages.length) return;
  try {
    const devices = (await Promise.all([...new Set(messages.map(message => message.userId))].map(userId => prisma.$queryRaw<Array<{ id: string; userId: string; token: string; platform: string }>>`SELECT id, user_id AS "userId", token, platform FROM push_devices WHERE user_id = ${userId}::uuid AND is_active = true`))).flat();
    console.log(`[push] preparing ${messages.length} message(s) for ${devices.length} active device(s)`);
    const messageByUser = new Map(messages.map(message => [message.userId, message]));
    const webDevices = devices.filter(device => device.platform === 'web');
    if (webDevices.length) {
      const messaging = firebaseMessaging();
      for (const device of webDevices) {
        const message = messageByUser.get(device.userId)!;
        try {
          await messaging.send({ token: device.token, notification: { title: message.title, body: message.body }, data: message.data || {} });
        } catch (error) {
          const code = (error as { code?: string })?.code;
          if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') await prisma.$executeRaw`UPDATE push_devices SET is_active = false WHERE id = ${device.id}::uuid`;
          console.error('[push] web notification failed:', code || error);
        }
      }
    }
    const validDevices = devices.filter(device => device.platform !== 'web' && isExpoToken(device.token));
    for (let index = 0; index < validDevices.length; index += 100) {
      const batch = validDevices.slice(index, index + 100);
      const response = await fetch(expoPushUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch.map(device => {
          const message = messageByUser.get(device.userId)!;
          return { to: device.token, title: message.title, body: message.body, sound: message.sound || 'default', priority: 'high', channelId: message.channelId || 'customer_updates', data: message.data || {} };
        })),
      });
      if (!response.ok) console.error('Expo push request failed:', response.status, await response.text());
      const result = await response.json().catch(() => null) as { data?: Array<{ status?: string; details?: { error?: string } }> } | null;
      console.log('[push] Expo ticket result:', JSON.stringify(result));
      const invalidIds = batch.filter((_device, batchIndex) => result?.data?.[batchIndex]?.details?.error === 'DeviceNotRegistered').map(device => device.id);
      for (const id of invalidIds) await prisma.$executeRaw`UPDATE push_devices SET is_active = false WHERE id = ${id}::uuid`;
    }
  } catch (error) {
    // Push delivery must never make an order operation fail.
    console.error('Unable to send push notification:', error);
  }
}

export function orderStatusMessage(status: string) {
  const labels: Record<string, string> = {
    ACCEPTED: 'Your order has been accepted.',
    REJECTED: 'Your order was rejected by the seller.',
    PREPARING: 'Your order is being packed.',
    READY_FOR_PICKUP: 'Your order is ready for pickup.',
    ASSIGNED_TO_DELIVERY_BOY: 'A delivery partner has been assigned to your order.',
    PICKED_UP: 'Your order has been picked up.',
    OUT_FOR_DELIVERY: 'Your order is out for delivery.',
    DELIVERED: 'Your order has been delivered.',
    COMPLETED: 'Your order is complete.',
    CANCELLED: 'Your order has been cancelled.',
  };
  return labels[status] || `Your order status changed to ${status}.`;
}
