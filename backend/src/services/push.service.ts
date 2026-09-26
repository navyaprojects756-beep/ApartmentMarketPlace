import { prisma } from '../lib/prisma.js';

const expoPushUrl = 'https://exp.host/--/api/v2/push/send';

type PushMessage = {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
};

function isExpoToken(token: string) {
  return /^(Expo|Exponent)PushToken\[.+\]$/.test(token);
}

export async function sendPushNotifications(messages: PushMessage[]) {
  if (!messages.length) return;
  try {
    const devices = (await Promise.all([...new Set(messages.map(message => message.userId))].map(userId => prisma.$queryRaw<Array<{ id: string; userId: string; token: string }>>`SELECT id, user_id AS "userId", token FROM push_devices WHERE user_id = ${userId}::uuid AND is_active = true`))).flat();
    console.log(`[push] preparing ${messages.length} message(s) for ${devices.length} active device(s)`);
    const messageByUser = new Map(messages.map(message => [message.userId, message]));
    const validDevices = devices.filter(device => isExpoToken(device.token));
    for (let index = 0; index < validDevices.length; index += 100) {
      const batch = validDevices.slice(index, index + 100);
      const response = await fetch(expoPushUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch.map(device => {
          const message = messageByUser.get(device.userId)!;
          return { to: device.token, title: message.title, body: message.body, sound: 'default', priority: 'high', channelId: 'orders', data: message.data || {} };
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
    PREPARING: 'Your order is being prepared.',
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
