exports.handler = async (event) => {
  const folder = event.queryStringParameters?.folder || '';
  const CLOUD = 'djj8xe3gx';
  const API_KEY = '395616716687167';
  const API_SECRET = 'NKdgzUa37r5NUD6Kn-QjhEOBDJs';
  const credentials = Buffer.from(`${API_KEY}:${API_SECRET}`).toString('base64');

  try {
    const expr = `folder="${folder}"`;
    const url = `https://api.cloudinary.com/v1_1/${CLOUD}/resources/search?expression=${encodeURIComponent(expr)}&max_results=50`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Basic ${credentials}` }
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch(e) { data = {}; }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        resources: (data.resources || []).map(r => ({
          public_id: r.public_id,
          secure_url: r.secure_url,
          version: r.version
        })),
        debug: { status: res.status, count: (data.resources||[]).length, error: data.error || null }
      })
    };
  } catch (e) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ resources: [], debug: { exception: e.message } })
    };
  }
};
