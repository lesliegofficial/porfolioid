exports.handler = async (event) => {
  const folder = event.queryStringParameters?.folder || '';
  const CLOUD = 'djj8xe3gx';
  const API_KEY = '395616716687167';
  const API_SECRET = 'NKdgzUa37r5NUD6Kn-QjhEOBDJs';
  const credentials = Buffer.from(`${API_KEY}:${API_SECRET}`).toString('base64');

  async function search(expr) {
    const url = `https://api.cloudinary.com/v1_1/${CLOUD}/resources/search`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ expression: expr, max_results: 50, sort_by: [{ created_at: 'desc' }] })
    });
    const data = await res.json();
    return data.resources || [];
  }

  try {
    const [images, videos] = await Promise.all([
      search(`folder="${folder}"`),
      search(`folder="${folder}" AND resource_type:video`)
    ]);

    // Merge, deduplicate by public_id
    const seen = new Set();
    const resources = [...images, ...videos]
      .filter(r => { if (seen.has(r.public_id)) return false; seen.add(r.public_id); return true; })
      .map(r => ({
        public_id: r.public_id,
        secure_url: r.secure_url,
        version: r.version,
        resource_type: r.resource_type,
        format: r.format
      }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ resources })
    };
  } catch (e) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ resources: [], error: e.message })
    };
  }
};
