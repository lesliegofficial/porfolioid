exports.handler = async (event) => {
  const folder = event.queryStringParameters?.folder || '';
  const CLOUD = 'djj8xe3gx';
  const API_KEY = '395616716687167';
  const API_SECRET = 'NKdgzUa37r5NUD6Kn-QjhEOBDJs';
  const credentials = Buffer.from(`${API_KEY}:${API_SECRET}`).toString('base64');

  try {
    // Search images
    const imgExpr = encodeURIComponent(`folder="${folder}" AND resource_type:image`);
    const imgUrl = `https://api.cloudinary.com/v1_1/${CLOUD}/resources/search?expression=${imgExpr}&max_results=50&sort_by[0][created_at]=desc`;
    
    // Search videos/audio
    const vidExpr = encodeURIComponent(`folder="${folder}" AND resource_type:video`);
    const vidUrl = `https://api.cloudinary.com/v1_1/${CLOUD}/resources/search?expression=${vidExpr}&max_results=50&sort_by[0][created_at]=desc`;

    const [imgRes, vidRes] = await Promise.all([
      fetch(imgUrl, { headers: { 'Authorization': `Basic ${credentials}` } }),
      fetch(vidUrl, { headers: { 'Authorization': `Basic ${credentials}` } })
    ]);

    const [imgData, vidData] = await Promise.all([imgRes.json(), vidRes.json()]);

    const resources = [
      ...(imgData.resources || []),
      ...(vidData.resources || [])
    ].map(r => ({
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
      statusCode: 500,
      body: JSON.stringify({ error: e.message, resources: [] })
    };
  }
};
