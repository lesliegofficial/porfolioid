const { getStore } = require('@netlify/blobs');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  const siteID = process.env.EPK_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN;
  if (!siteID || !token) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Missing env vars' }) };
  }
  const store = getStore({ name: 'epk-data', siteID, token });
  try {
    if (event.httpMethod === 'GET') {
      const slug = event.queryStringParameters?.slug;
      if (!slug) return { statusCode: 400, headers, body: JSON.stringify({ error: 'slug required' }) };
      const data = await store.get(`epk:${slug}`, { type: 'json' });
      if (!data) return { statusCode: 404, headers, body: JSON.stringify({ error: 'not found' }) };
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body);
      const { slug, data, action } = body;
      if (action === 'login') {
        const emailRecord = await store.get(`email:${body.email}`, { type: 'json' });
        if (!emailRecord) return { statusCode: 404, headers, body: JSON.stringify({ error: 'User not found' }) };
        const existing = await store.get(`user:${emailRecord.slug}`, { type: 'json' });
        if (!existing) return { statusCode: 404, headers, body: JSON.stringify({ error: 'User not found' }) };
        if (existing.password !== body.password) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid password' }) };
        const { password, ...safeUser } = existing;
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, user: safeUser }) };
      }
      if (!slug && action !== 'login') return { statusCode: 400, headers, body: JSON.stringify({ error: 'slug required' }) };
      if (action === 'signup') {
        const existingSlug = await store.get(`user:${slug}`, { type: 'json' });
        if (existingSlug) return { statusCode: 409, headers, body: JSON.stringify({ error: 'Slug already taken' }) };
        const emailCheck = await store.get(`email:${body.email}`, { type: 'json' });
        if (emailCheck) return { statusCode: 409, headers, body: JSON.stringify({ error: 'Email already registered' }) };
        const newUser = { id: `user_${Date.now()}`, firstName: body.firstName, lastName: body.lastName, email: body.email, slug };
        await store.set(`user:${slug}`, JSON.stringify(newUser));
        await store.set(`email:${body.email}`, JSON.stringify({ slug }));
        await store.set(`epk:${slug}`, JSON.stringify(body.epk));
        const { password, ...safeUser } = newUser;
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, user: safeUser }) };
      }
      if (action === 'save') {
        await store.set(`epk:${slug}`, JSON.stringify(data));
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }
      if (action === 'load') {
        const epk = await store.get(`epk:${slug}`, { type: 'json' });
        if (!epk) return { statusCode: 404, headers, body: JSON.stringify({ error: 'EPK not found' }) };
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, epk }) };
      }
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };
    }
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    console.error('EPK function error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error', details: err.message }) };
  }
};
