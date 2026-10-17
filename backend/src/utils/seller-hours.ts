type SellerHours = {
  isOpen: boolean;
  operatingHours?: Array<{ dayOfWeek: number; openTime: string | null; closeTime: string | null; isClosed: boolean }>;
};

export function getSellerAvailability(seller: SellerHours, now = new Date()) {
  if (!seller.isOpen) return { isOpen: false, reason: 'Store is inactive.' };
  const timeParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: process.env.APP_TIME_ZONE || 'Asia/Kolkata',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const weekday = timeParts.find(part => part.type === 'weekday')?.value;
  const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday || '');
  const hours = seller.operatingHours?.find(item => item.dayOfWeek === dayOfWeek);
  if (!hours) return { isOpen: true, reason: null };
  if (hours.isClosed || !hours.openTime || !hours.closeTime) return { isOpen: false, reason: 'Store is closed today.' };
  const currentHour = Number(timeParts.find(part => part.type === 'hour')?.value || 0);
  const currentMinute = Number(timeParts.find(part => part.type === 'minute')?.value || 0);
  const current = currentHour * 60 + currentMinute;
  const [openHour, openMinute] = hours.openTime.split(':').map(Number);
  const [closeHour, closeMinute] = hours.closeTime.split(':').map(Number);
  const open = openHour * 60 + openMinute;
  const close = closeHour * 60 + closeMinute;
  const isOpen = close >= open ? current >= open && current <= close : current >= open || current <= close;
  return { isOpen, reason: isOpen ? null : `Available ${hours.openTime}–${hours.closeTime}.` };
}
