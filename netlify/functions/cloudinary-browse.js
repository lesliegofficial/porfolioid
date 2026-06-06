exports.handler = async (event) => {
  const folder = event.queryStringParameters?.folder || '';
  const CLOUD = 'djj8xe3gx';
  const API_KEY = '395616716687167';
  const API_SECRET = 'NKdgzUa37r5NUD6Kn-QjhEOBDJs';
  const credentials = Buffer.from(`${API_KEY}:${API_SECRET}`).toString('base64');

  try {
    const expr = encodeURIComponent(`folder="${folder}"`);
    const url = `https://api.cloudinary.com/v1_1/${CLOUD}/resources/search?expression=${expr}&max_results=50&sort_by[0][created_at]=desc`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Basic ${credentials}` }
    });
    const data = await res.json();
    const resources = (data.resources || []).map(r => ({
      public_id: r.public_id,
      secure_url: r.secure_url,
      version: r.version,
      resource_type: r.resource_type
    }));
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ resources })
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message, resources: [] })
    };
  }
};
