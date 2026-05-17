const API_URL = import.meta.env.VITE_API_URL || '';
const AUTH_URL = import.meta.env.VITE_AUTH_URL || 'http://localhost:3004';
const ANALYTICS_URL = import.meta.env.VITE_ANALYTICS_URL || 'http://localhost:3006';

function authHeaders() {
  const token = localStorage.getItem('adflow_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchCampaigns(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API_URL}/api/campaigns${qs ? `?${qs}` : ''}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch campaigns');
  return res.json();
}

export async function fetchStats() {
  const res = await fetch(`${API_URL}/api/campaigns/stats`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

export async function fetchAnalytics() {
  const res = await fetch(`${ANALYTICS_URL}/api/analytics/overview`);
  if (!res.ok) throw new Error('Failed to fetch analytics');
  return res.json();
}

export async function fetchFailures() {
  const res = await fetch(`${ANALYTICS_URL}/api/analytics/failures`);
  if (!res.ok) throw new Error('Failed to fetch failures');
  return res.json();
}

export async function createCampaign(data) {
  const res = await fetch(`${API_URL}/api/campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || err.details?.join?.(', ') || 'Create failed');
  }
  return res.json();
}

export async function processCampaign(id) {
  const res = await fetch(`${API_URL}/api/campaigns/${id}/process`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Process failed');
  return res.json();
}

export async function bulkIngest(campaigns) {
  const res = await fetch(`${API_URL}/api/campaigns/ingest/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ campaigns }),
  });
  if (!res.ok) throw new Error('Bulk ingest failed');
  return res.json();
}

export async function login(email, password) {
  const res = await fetch(`${AUTH_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error('Login failed');
  const data = await res.json();
  localStorage.setItem('adflow_token', data.token);
  return data;
}

export function logout() {
  localStorage.removeItem('adflow_token');
}

export function connectMetricsWebSocket(onMessage) {
  const base = import.meta.env.VITE_WS_URL || 'ws://localhost:3002';
  const url = base.endsWith('/ws') ? base : `${base.replace(/\/$/, '')}/ws`;
  const ws = new WebSocket(url);
  ws.onmessage = (event) => {
    try {
      onMessage(JSON.parse(event.data));
    } catch {
      /* ignore */
    }
  };
  ws.onerror = () => onMessage({ type: 'error', data: { message: 'WebSocket failed' } });
  return ws;
}
