exports.handler = async (event) => {
  const folder = event.queryStringParameters?.folder || '';
  const CLOUD = 'djj8xe3gx';
  const API_KEY = process.env.CLOUDINARY_API_KEY || '395616716687167';
  const API_SECRET = process.env.CLOUDINARY_API_SECRET || 'NKdgzUa37r5NUD6Kn-QjhEOBDJs';

  try {
    const credentials = Buffer.from(`${API_KEY}:${API_SECRET}`).toString('base64');
    const url = `https://api.cloudinary.com/v1_1/${CLOUD}/resources/search`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        expression: `folder="${folder}" AND resource_type:image`,
        max_results: 50,
        with_field: ['secure_url','public_id','version']
      })
    });
    const data = await res.json();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ resources: data.resources || [] })
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message, resources: [] })
    };
  }
};
