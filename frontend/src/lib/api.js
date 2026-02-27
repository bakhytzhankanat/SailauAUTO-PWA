const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '') + '/api';

const NETWORK_ERROR_MSG = 'Серверге қосылу мүмкін емес. Интернетті тексеріңіз немесе кейін қайталаңыз.';

function getToken() {
  return localStorage.getItem('sailau_token');
}

export function setAuth(token, user) {
  if (token) localStorage.setItem('sailau_token', token);
  if (user) localStorage.setItem('sailau_user', JSON.stringify(user));
}

export function getAuth() {
  const token = getToken();
  const raw = localStorage.getItem('sailau_user');
  const user = raw ? JSON.parse(raw) : null;
  return { token, user };
}

export function clearAuth() {
  localStorage.removeItem('sailau_token');
  localStorage.removeItem('sailau_user');
}

export async function api(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(API_BASE + path, { ...options, headers });
  } catch (err) {
    throw new Error(err.message === 'Failed to fetch' ? NETWORK_ERROR_MSG : (err.message || NETWORK_ERROR_MSG));
  }
  const data = res.ok ? await res.json().catch(() => ({})) : await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export async function login(phone, password) {
  return api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phone, password }),
  });
}

export async function getMe() {
  return api('/auth/me');
}

export async function getSettings() {
  return api('/settings');
}

export async function updateSettings(keyValues) {
  return api('/settings', { method: 'PATCH', body: JSON.stringify({ keyValues }) });
}

export async function getUsers() {
  return api('/users');
}

export async function getWorkers() {
  return api('/users/workers');
}

export async function createUser(body) {
  return api('/users', { method: 'POST', body: JSON.stringify(body) });
}

export async function updateUser(id, body) {
  return api(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export async function getAdminOwners() {
  return api('/admin/owners');
}

export async function createOwner(body) {
  return api('/admin/owners', { method: 'POST', body: JSON.stringify(body) });
}

export async function getVehicleCatalog() {
  return api('/vehicle-catalog');
}

export async function getServiceCatalog() {
  return api('/service-catalog');
}

export async function createServiceCatalogItem(body) {
  return api('/service-catalog', { method: 'POST', body: JSON.stringify(body) });
}

export async function deleteServiceCatalogItem(id) {
  return api(`/service-catalog/${id}`, { method: 'DELETE' });
}

export async function getServiceCategories() {
  return api('/service-categories');
}

export async function getServiceCategoriesWithServices(vehicleCatalogId = null, bodyType = null) {
  const params = new URLSearchParams();
  if (vehicleCatalogId) params.set('vehicle_catalog_id', vehicleCatalogId);
  if (bodyType) params.set('body_type', bodyType);
  const q = params.toString() ? `?${params}` : '';
  return api(`/service-categories-with-services${q}`);
}

export async function getClients(q = '') {
  const query = q ? `?q=${encodeURIComponent(q)}` : '';
  return api(`/clients${query}`);
}

export async function getClient(id) {
  return api(`/clients/${id}`);
}

export async function getClientVisits(id) {
  return api(`/clients/${id}/visits`);
}

export async function getClientWarranties(id) {
  return api(`/clients/${id}/warranties`);
}

export async function getWarrantiesExpiring(days = 7) {
  return api(`/warranties/expiring?days=${days}`);
}

export async function getBookings(date, boxId = null) {
  const params = new URLSearchParams({ date });
  if (boxId != null) params.set('box_id', boxId);
  return api(`/bookings?${params}`);
}

export async function getBooking(id) {
  return api(`/bookings/${id}`);
}

export async function createBooking(body) {
  return api('/bookings', { method: 'POST', body: JSON.stringify(body) });
}

export async function updateBooking(id, body) {
  return api(`/bookings/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export async function startBooking(id, body = {}) {
  const opts = { method: 'PATCH' };
  if (body && Object.keys(body).length > 0) opts.body = JSON.stringify(body);
  return api(`/bookings/${id}/start`, opts);
}

export async function completeBooking(id, body) {
  return api(`/bookings/${id}/complete`, { method: 'PATCH', body: JSON.stringify(body) });
}

export async function getInventoryItems(name = '') {
  const q = name ? `?name=${encodeURIComponent(name)}` : '';
  return api(`/inventory-items${q}`);
}

export async function getInventory(name = '') {
  const q = name ? `?name=${encodeURIComponent(name)}` : '';
  return api(`/inventory${q}`);
}

export async function createInventoryItem(body) {
  return api('/inventory', { method: 'POST', body: JSON.stringify(body) });
}

export async function createInventoryMovement(body) {
  return api('/inventory/movement', { method: 'POST', body: JSON.stringify(body) });
}

export async function deleteInventoryItem(id) {
  return api(`/inventory/${id}`, { method: 'DELETE' });
}

export async function getDayClose(date, shiftIndex = null) {
  const params = new URLSearchParams();
  if (date) params.set('date', date);
  if (shiftIndex != null && Number.isFinite(shiftIndex)) params.set('shift_index', String(shiftIndex));
  return api(`/day-close?${params}`);
}

export async function createDayClose(body) {
  return api('/day-close', { method: 'POST', body: JSON.stringify(body) });
}

export async function updateDayClose(id, body) {
  return api(`/day-close/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export async function getDayCloseWorkers() {
  return api('/day-close/workers');
}

export async function getReminders(status = 'all') {
  const q = status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : '';
  return api(`/reminders${q}`);
}

export async function createReminder(body) {
  return api('/reminders', { method: 'POST', body: JSON.stringify(body) });
}

export async function setReminderStatus(id, status) {
  return api(`/reminders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
}

export async function deleteReminder(id) {
  return api(`/reminders/${id}`, { method: 'DELETE' });
}

export async function clearDoneReminders() {
  return api('/reminders/clear-done', { method: 'POST' });
}

export async function getWhatsappInbound(q = '') {
  const query = q ? `?q=${encodeURIComponent(q)}` : '';
  return api(`/whatsapp-inbound${query}`);
}

export async function getAnalyticsSummary(period = 'day', date, drillMasterId = null) {
  const params = new URLSearchParams({ period });
  if (date) params.set('date', date);
  if (drillMasterId) params.set('drill', drillMasterId);
  return api(`/analytics/summary?${params}`);
}
