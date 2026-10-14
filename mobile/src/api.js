const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:5000/api/v1';

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || 'Request failed');
  return data;
}

export async function exchangeFirebaseToken(idToken, name) {
  return request('/auth/firebase/exchange', { method: 'POST', body: JSON.stringify({ idToken, name }) });
}

export async function loadHome(accessToken) {
  return request('/home', { headers: { Authorization: `Bearer ${accessToken}` } });
}

export async function loadOrders(accessToken) {
  return request('/orders', { headers: { Authorization: `Bearer ${accessToken}` } });
}

export async function loadRoleData(accessToken, role) {
  const endpoint = role === 'seller' ? '/seller/dashboard' : role === 'delivery' ? '/delivery/orders' : '/admin/dashboard';
  return request(endpoint, { headers: { Authorization: `Bearer ${accessToken}` } });
}

export async function loadSellerOrders(accessToken) {
  return request('/seller/orders', { headers: { Authorization: `Bearer ${accessToken}` } });
}

export async function updateSellerOrder(accessToken, orderId, status) {
  return request(`/orders/${orderId}/status`, { method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ status }) });
}

export async function updateDeliveryOrder(accessToken, orderId, status) {
  return request(`/delivery/orders/${orderId}/status`, { method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ status }) });
}

export async function loadAdminMode(accessToken) {
  return request('/admin/settings/home-seller-display-mode', { headers: { Authorization: `Bearer ${accessToken}` } });
}

export async function updateAdminMode(accessToken, value) {
  return request('/admin/settings/home-seller-display-mode', { method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ mode: value }) });
}
