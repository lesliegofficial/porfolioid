// ============================================================
// PorfolioID — media-service.js
// AMS Abstraction Layer — Asset ID → Delivery URL Resolver
// Version: 1.1.0 — July 4, 2026
// ============================================================

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const PROVIDERS = {
  r2: {
    cdnBase: process.env.R2_CDN_BASE,
  },
};

async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      'apikey':        SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type':  'application/json',
    }
  });
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, status: res.status, data: text }; }
}

function generateDeliveryUrl(provider, storage_key) {
  const config = PROVIDERS[provider];
  if (!config) return null;
  if (!config.cdnBase) return null;
  return `${config.cdnBase}/${storage_key}`;
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type':                'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return { statusCode: 503, headers, body: JSON.stringify({ error: 'Media service not configured' }) };
  }

  const params = event.queryStringParameters || {};

  if (params.id) {
    const safeId = encodeURIComponent(params.id);
    const result = await sbGet(
      `media_assets?id=eq.${safeId}&is_current=eq.true&is_active=eq.true&is_public=eq.true&limit=1`
    );
    if (!result.ok || !result.data || result.data.length === 0) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Asset not found', id: params.id }) };
    }
    const asset = result.data[0];
    const url = generateDeliveryUrl(asset.provider, asset.storage_key);
    if (!url) {
      return { statusCode: 503, headers, body: JSON.stringify({
        error: 'Public delivery not configured',
        detail: 'R2_CDN_BASE is not set. Connect media.porfolioid.com to R2 bucket before assets can be delivered publicly.',
        provider: asset.provider,
      })};
    }
    return { statusCode: 200, headers, body: JSON.stringify({
      url,
      asset_id:      asset.id,
      asset_type:    asset.asset_type,
      mime_type:     asset.mime_type,
      display_name:  asset.display_name,
      width_px:      asset.width_px,
      height_px:     asset.height_px,
      duration_sec:  asset.duration_sec,
      has_thumbnail: asset.has_thumbnail,
      has_webp:      asset.has_webp,
    })};
  }

  if (params.slug && params.category && params.descriptor) {
    const safeSlug       = encodeURIComponent(params.slug);
    const safeCategory   = encodeURIComponent(params.category);
    const safeDescriptor = encodeURIComponent(params.descriptor);
    const result = await sbGet(
      `media_assets?slug=eq.${safeSlug}&category=eq.${safeCategory}&descriptor=eq.${safeDescriptor}&is_current=eq.true&is_active=eq.true&is_public=eq.true&limit=1`
    );
    if (!result.ok || !result.data || result.data.length === 0) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Asset not found', params }) };
    }
    const asset = result.data[0];
    const url = generateDeliveryUrl(asset.provider, asset.storage_key);
    if (!url) {
      return { statusCode: 503, headers, body: JSON.stringify({
        error: 'Public delivery not configured',
        detail: 'R2_CDN_BASE is not set. Connect media.porfolioid.com to R2 bucket.',
        provider: asset.provider,
      })};
    }
    return { statusCode: 200, headers, body: JSON.stringify({
      url,
      asset_id:     asset.id,
      asset_type:   asset.asset_type,
      mime_type:    asset.mime_type,
      display_name: asset.display_name,
      width_px:     asset.width_px,
      height_px:    asset.height_px,
      duration_sec: asset.duration_sec,
    })};
  }

  return { statusCode: 400, headers, body: JSON.stringify({
    error: 'Missing required parameters',
    usage: ['GET ?id={asset_uuid}', 'GET ?slug={slug}&category={category}&descriptor={descriptor}']
  })};
};
