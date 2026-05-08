const { getDeployStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const store = getDeployStore('epk-data');

  try {
    // GET - load EPK data by slug
    if (event.httpMethod === 'GET') {
      const slug = event.queryStringParameters?.slug;
      if (!slug) return { statusCode: 400, headers, body: JSON.stringify({ error: 'slug required' }) };
      
      const data = await store.get(slug, { type: 'json' });
      if (!data) return { statusCode: 404, headers, body: JSON.stringify({ error: 'not found' }) };
      
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    // POST - save EPK data
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body);
      const { slug, data, action } = body;

      if (!slug) return { statusCode: 400, headers, body: JSON.stringify({ error: 'slug required' }) };

      // LOGIN action - verify credentials
      if (action === 'login') {
        const existing = await store.get(`user:${slug}`, { type: 'json' });
        if (!existing) return { statusCode: 404, headers, body: JSON.stringify({ error: 'User not found' }) };
        if (existing.password !== body.password) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid password' }) };
        const { password, ...safeUser } = existing;
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, user: safeUser }) };
      }

      // SIGNUP action
      if (action === 'signup') {
        const existing = await store.get(`user:${slug}`, { type: 'json' });
        if (existing) return { statusCode: 409, headers, body: JSON.stringify({ error: 'Slug already taken' }) };
        
        const emailCheck = await store.get(`email:${body.email}`, { type: 'json' });
        if (emailCheck) return { statusCode: 409, headers, body: JSON.stringify({ error: 'Email already registered' }) };

        const newUser = {
          id: `user_${Date.now()}`,
          firstName: body.firstName,
          lastName: body.lastName,
          email: body.email,
          slug: body.slug,
          password: body.password,
          createdAt: new Date().toISOString(),
          epk: body.epk
        };

        await store.set(`user:${slug}`, JSON.stringify(newUser));
        await store.set(`email:${body.email}`, JSON.stringify({ slug }));
        await store.set(`epk:${slug}`, JSON.stringify(body.epk));

        const { password, ...safeUser } = newUser;
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, user: safeUser }) };
      }

      // SAVE EPK action
      if (action === 'save') {
        await store.set(`epk:${slug}`, JSON.stringify(data));
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }

      // LOAD EPK action
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
