const crypto = require('node:crypto');

async function authRequest(path, method = 'GET', body, token) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw Object.assign(new Error('Authentication unavailable'), { status: 503 });
  const res = await fetch(`${url}/auth/v1/${path}`, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${token || key}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

async function rows(table, query) {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` }
  });
  if (!res.ok) throw Object.assign(new Error('Account lookup unavailable'), { status: 503 });
  return res.json();
}

async function requireAccount(event) {
  const header = event.headers?.authorization || event.headers?.Authorization || '';
  const token = /^Bearer (\S+)$/.exec(header)?.[1];
  if (!token) throw Object.assign(new Error('Sign in required'), { status: 401 });
  const result = await authRequest('user', 'GET', undefined, token);
  if (!result.ok || !result.data.id || !result.data.email_confirmed_at) {
    throw Object.assign(new Error('Sign in required'), { status: 401 });
  }
  // Use the verified Auth email, never browser metadata, to resolve legacy ownership.
  const accounts = await rows('users', `email=eq.${encodeURIComponent(result.data.email)}&select=slug,email,first_name,last_name`);
  if (accounts.length !== 1) throw Object.assign(new Error('Account not linked'), { status: 403 });
  return accounts[0];
}

async function requireOwner(event, slug) {
  const account = await requireAccount(event);
  if (typeof slug !== 'string' || !/^[a-z0-9-]{1,60}$/.test(slug)) throw Object.assign(new Error('Valid profile slug required'), { status: 400 });
  if (slug === account.slug) return account;
  const profiles = await rows('user_profiles', `user_slug=eq.${encodeURIComponent(account.slug)}&profile_slug=eq.${encodeURIComponent(slug)}&select=profile_slug`);
  if (!profiles.length) throw Object.assign(new Error('Profile access denied'), { status: 403 });
  return account;
}

function samePassword(actual, supplied) {
  if (typeof actual !== 'string' || typeof supplied !== 'string' || !actual || actual.startsWith('supabase-auth:')) return false;
  const digest = value => crypto.createHash('sha256').update(value).digest();
  return crypto.timingSafeEqual(digest(actual), digest(supplied));
}

function authError(error, headers = {}) {
  return { statusCode: error.status || 503, headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify({ error: error.message || 'Authentication unavailable' }) };
}

module.exports = { authRequest, requireAccount, requireOwner, samePassword, authError };
