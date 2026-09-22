type SellerHours = {
  isOpen: boolean;
  operatingHours?: Array<{ dayOfWeek: number; openTime: string | null; closeTime: string | null; isClosed: boolean }>;
};

export function getSellerAvailability(seller: SellerHours, now = new Date()) {
  if (!seller.isOpen) return { isOpen: false, reason: 'Store is inactive.' };
  const hours = seller.operatingHours?.find(item => item.dayOfWeek === now.getDay());
  if (!hours) return { isOpen: true, reason: null };
  if (hours.isClosed || !hours.openTime || !hours.closeTime) return { isOpen: false, reason: 'Store is closed today.' };
  const current = now.getHours() * 60 + now.getMinutes();
  const [openHour, openMinute] = hours.openTime.split(':').map(Number);
  const [closeHour, closeMinute] = hours.closeTime.split(':').map(Number);
  const open = openHour * 60 + openMinute;
  const close = closeHour * 60 + closeMinute;
  const isOpen = close >= open ? current >= open && current <= close : current >= open || current <= close;
  return { isOpen, reason: isOpen ? null : `Available ${hours.openTime}–${hours.closeTime}.` };
}
