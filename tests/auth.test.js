const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'server-only-key';
const { requireOwner, requireAccount, samePassword } = require('../netlify/functions/_shared/auth');
const { handler } = require('../netlify/functions/epk');
const event = (action, data = {}, authorization) => ({ httpMethod: 'POST', headers: authorization ? { authorization } : {}, body: JSON.stringify({ action, ...data }) });
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status });
function accountFetch({ valid = true, confirmed = true, secondary = false } = {}) {
  global.fetch = async (url) => {
    if (url.endsWith('/auth/v1/user')) return valid ? reply({ id: 'auth-id', email: 'owner@example.com', email_confirmed_at: confirmed ? '2026-01-01' : null }) : reply({}, 401);
    if (url.includes('/users?')) return reply([{ slug: 'owner', email: 'owner@example.com', first_name: 'Owner', last_name: 'User' }]);
    if (url.includes('/user_profiles?')) return reply(secondary ? [{ profile_slug: 'secondary' }] : []);
    throw new Error('Unexpected privileged operation: ' + url);
  };
}
test('password transition rejects wrong, empty, missing and already migrated values', () => {
  assert.equal(samePassword('old-password', 'old-password'), true);
  for (const [actual, supplied] of [['old-password', 'wrong'], ['', ''], [null, 'x'], ['supabase-auth:id', 'supabase-auth:id']]) assert.equal(samePassword(actual, supplied), false);
});
test('forged browser profile cache cannot authorize a save', async () => {
  global.fetch = async () => { throw new Error('Must not reach privileged database'); };
  const response = await handler(event('save', { slug: 'owner', data: { name: 'Forged' } }));
  assert.equal(response.statusCode, 401);
});
test('invalid JWT is denied before database writes', async () => {
  accountFetch({ valid: false });
  assert.equal((await handler(event('save', { slug: 'owner', data: {} }, 'Bearer forged'))).statusCode, 401);
});
test('unconfirmed email cannot authorize account access', async () => {
  accountFetch({ confirmed: false });
  await assert.rejects(requireAccount(event('session', {}, 'Bearer jwt')), e => e.status === 401);
});
test('verified primary and registered secondary profiles are accessible', async () => {
  accountFetch({ secondary: true });
  assert.equal((await requireOwner(event('save', {}, 'Bearer jwt'), 'owner')).slug, 'owner');
  assert.equal((await requireOwner(event('save', {}, 'Bearer jwt'), 'secondary')).slug, 'owner');
});
test('valid user cannot save or read analytics for another profile', async () => {
  accountFetch();
  for (const action of ['save', 'saveSection', 'getAnalytics']) {
    assert.equal((await handler(event(action, { slug: 'victim', data: {} }, 'Bearer jwt'))).statusCode, 403);
  }
});
test('cannot list or create profiles for a different user', async () => {
  accountFetch();
  for (const action of ['listProfiles', 'createProfile']) assert.equal((await handler(event(action, { userSlug: 'victim', profileSlug: 'new' }, 'Bearer jwt'))).statusCode, 403);
});
test('cannot delete another account profile by spoofing its owner', async () => {
  accountFetch();
  assert.equal((await handler(event('deleteProfile', { userSlug: 'owner', profileSlug: 'victim' }, 'Bearer jwt'))).statusCode, 403);
});
test('public migration endpoint is disabled', async () => {
  global.fetch = async () => { throw new Error('Must not access storage'); };
  assert.equal((await handler(event('migrate', { slug: 'owner' }))).statusCode, 403);
});
test('legacy login migrates only after credential proof, then clears plaintext', async () => {
  let tokenCalls = 0, migrated = false, cleared = false;
  global.fetch = async (url, options = {}) => {
    if (url.includes('token?')) return ++tokenCalls === 1 ? reply({ error_code: 'invalid_credentials' }, 400) : reply({ access_token: 'jwt', refresh_token: 'refresh', user: { id: 'auth-id' } });
    if (url.endsWith('/admin/users')) { migrated = true; assert.equal(JSON.parse(options.body).email_confirm, true); return reply({ id: 'auth-id' }); }
    if (url.endsWith('/auth/v1/user')) return reply({ id: 'auth-id', email: 'owner@example.com', email_confirmed_at: '2026-01-01' });
    if (url.includes('/users?') && options.method === 'PATCH') { cleared = true; assert.equal(JSON.parse(options.body).password, 'supabase-auth:auth-id'); return reply({}); }
    if (url.includes('/users?') && url.includes('password')) return reply([{ slug: 'owner', password: 'old-password' }]);
    if (url.includes('/users?')) return reply([{ slug: 'owner', email: 'owner@example.com' }]);
    throw new Error('Unexpected request');
  };
  const result = await handler(event('login', { email: 'owner@example.com', password: 'old-password' }));
  assert.equal(result.statusCode, 200); assert.ok(migrated && cleared);
});
test('invalid legacy password never creates an Auth account', async () => {
  global.fetch = async url => {
    if (url.includes('token?')) return reply({ error_code: 'invalid_credentials' }, 400);
    if (url.includes('/users?')) return reply([{ password: 'real-password' }]);
    throw new Error('Must not create Auth user');
  };
  assert.equal((await handler(event('login', { email: 'owner@example.com', password: 'wrong' }))).statusCode, 401);
});
test('rate limit is not bypassed by legacy migration', async () => {
  global.fetch = async url => { assert.ok(url.includes('token?')); return reply({ error_code: 'over_request_rate_limit' }, 429); };
  assert.equal((await handler(event('login', { email: 'owner@example.com', password: 'old-password' }))).statusCode, 401);
});
function browser(fetcher) {
  const values = new Map(); const redirects = [];
  const context = { URL, Headers, Request, Date, JSON, Error, location: { origin: 'https://porfolioid.com', replace: url => redirects.push(url) },
    localStorage: { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) },
    document: { documentElement: { removeAttribute() {} } }, window: { fetch: fetcher } };
  vm.runInNewContext(fs.readFileSync('auth-client.js', 'utf8'), context);
  return { auth: context.window.PorfolioAuth, values, redirects };
}
test('browser tokens only go to same-origin function routes', async () => {
  const calls = []; const { auth } = browser(async (url, init) => { calls.push(init); return reply({}); });
  auth.store({ access_token: 'jwt', refresh_token: 'refresh', expires_in: 3600 });
  await auth.fetch('/api/epk'); await auth.fetch('https://r2.example.com/upload', { method: 'PUT' }); await auth.fetch('/epk.html');
  assert.equal(calls[0].headers.get('Authorization'), 'Bearer jwt');
  assert.equal(calls[1].headers, undefined); assert.equal(calls[2].headers, undefined);
});
test('expired browser session refreshes before authenticated request', async () => {
  const { auth } = browser(async (url, init) => {
    if (url === '/api/epk' && !init.headers.get) return reply({ session: { access_token: 'renewed', refresh_token: 'next', expires_in: 3600 } });
    assert.equal(init.headers.get('Authorization'), 'Bearer renewed'); return reply({});
  });
  auth.store({ access_token: 'old', refresh_token: 'refresh', expires_at: 1 });
  await auth.fetch('/api/epk');
});
test('browser route guard rejects a legacy cache without Auth tokens', async () => {
  const { auth, values, redirects } = browser(async () => { throw new Error('Unexpected request'); });
  values.set('porfolioid_session', JSON.stringify({ slug: 'owner' }));
  assert.equal(await auth.requireSession(), null); assert.deepEqual(redirects, ['/login.html']);
});
function uploadHandler(name) {
  const source = fs.readFileSync(`netlify/functions/${name}.js`, 'utf8');
  const context = { exports: {}, process, console, Buffer, fetch: (...args) => global.fetch(...args),
    require: path => {
      if (path === './_shared/auth') return require('../netlify/functions/_shared/auth');
      if (path === './config/media-config') return require('../netlify/functions/config/media-config');
      if (path.startsWith('@aws-sdk/')) return { S3Client: class {}, PutObjectCommand: class {}, HeadObjectCommand: class {}, GetObjectCommand: class {}, DeleteObjectCommand: class {} };
      return require(path);
    } };
  vm.runInNewContext(source, context);
  return context.exports.handler;
}
test('all upload endpoints reject missing and foreign-account tokens before storage operations', async () => {
  Object.assign(process.env, { R2_ENDPOINT: 'https://r2.example.com', R2_ACCESS_KEY: 'test', R2_SECRET_KEY: 'test', R2_BUCKET: 'test' });
  for (const name of ['media-presign', 'media-register', 'upload-pdf']) {
    const upload = uploadHandler(name);
    accountFetch();
    assert.equal((await upload(event('', { slug: 'owner' }))).statusCode, 401, name);
    assert.equal((await upload(event('', { slug: 'victim' }, 'Bearer jwt'))).statusCode, 403, name);
  }
});
test('R2 registration cannot act on another storage prefix with an owned slug', async () => {
  accountFetch();
  const result = await uploadHandler('media-register')(event('', { slug: 'owner', storageKey: 'profiles/victim/photos/victim_photo_v1_20261002.jpg',
    category: 'photos', descriptor: 'photo', mimeType: 'image/jpeg', version: 1, fileSize: 100 }, 'Bearer jwt'));
  assert.equal(result.statusCode, 403);
});
