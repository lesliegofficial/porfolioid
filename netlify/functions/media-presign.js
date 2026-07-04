// ============================================================
// PorfolioID — media-presign.js
// AMS Pre-Signed Upload URL Generator
// Version: 1.0.0 — July 4, 2026
// ============================================================

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl }               = require('@aws-sdk/s3-request-presigner');

const {
  ALLOWED_TYPES,
  MAX_SIZE_BYTES,
  VALID_CATEGORIES,
  PRESIGN_EXPIRY_SECONDS,
  buildStorageKey,
} = require('./config/media-config');

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const R2_ENDPOINT          = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY        = process.env.R2_ACCESS_KEY;
const R2_SECRET_KEY        = process.env.R2_SECRET_KEY;
const R2_BUCKET            = process.env.R2_BUCKET;

function getR2Client() {
  return new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId:     R2_ACCESS_KEY,
      secretAccessKey: R2_SECRET_KEY,
    },
  });
}

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

exports.handler = async (event) => {
  const headers = {
    'Content-Type':                 'application/json',
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !R2_ENDPOINT || !R2_ACCESS_KEY || !R2_SECRET_KEY || !R2_BUCKET) {
    return { statusCode: 503, headers, body: JSON.stringify({ error: 'Upload service not configured' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) }; }

  const { fileName, mimeType, fileSize, sha256Hash, slug, category, descriptor, displayName, isPublic } = body;

  if (!fileName || !mimeType || !fileSize || !sha256Hash || !slug || !category || !descriptor) {
    return { statusCode: 400, headers, body: JSON.stringify({
      error: 'Missing required fields',
      required: ['fileName', 'mimeType', 'fileSize', 'sha256Hash', 'slug', 'category', 'descriptor'],
    })};
  }

  const typeInfo = ALLOWED_TYPES[mimeType];
  if (!typeInfo) return { statusCode: 400, headers, body: JSON.stringify({ error: `File type not allowed: ${mimeType}` }) };

  if (!VALID_CATEGORIES.has(category)) {
    return { statusCode: 400, headers, body: JSON.stringify({
      error: `Invalid category: ${category}`,
      valid_categories: [...VALID_CATEGORIES],
    })};
  }

  const maxSize = MAX_SIZE_BYTES[typeInfo.asset_type];
  if (fileSize > maxSize) {
    return { statusCode: 400, headers, body: JSON.stringify({
      error: 'File too large',
      asset_type: typeInfo.asset_type,
      max_bytes: maxSize,
      received_bytes: fileSize,
    })};
  }

  // Duplicate detection
  const dupCheck = await sbGet(
    `media_assets?slug=eq.${encodeURIComponent(slug)}&sha256_hash=eq.${encodeURIComponent(sha256Hash)}&is_current=eq.true&limit=1`
  );
  if (dupCheck.ok && dupCheck.data?.length > 0) {
    const existing = dupCheck.data[0];
    return { statusCode: 200, headers, body: JSON.stringify({
      duplicate: true,
      message: 'This file already exists in your media library',
      asset_id: existing.id,
      display_name: existing.display_name,
      storage_key: existing.storage_key,
    })};
  }

  // Version resolution
  const versionCheck = await sbGet(
    `media_assets?slug=eq.${encodeURIComponent(slug)}&descriptor=eq.${encodeURIComponent(descriptor)}&select=version,asset_family_id&order=version.desc&limit=1`
  );
  const prevVersion = (versionCheck.ok && versionCheck.data?.length > 0) ? versionCheck.data[0].version : 0;
  const newVersion  = prevVersion + 1;
  const familyId    = (prevVersion > 0) ? versionCheck.data[0].asset_family_id : null;

  // Build storage key
  let storageKey;
  try {
    storageKey = buildStorageKey({ slug, category, descriptor, version: newVersion, ext: typeInfo.ext, date: new Date() });
  } catch (err) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: err.message }) };
  }

  // Generate pre-signed URL
  let uploadUrl;
  try {
    const r2Client = getR2Client();
    const command  = new PutObjectCommand({ Bucket: R2_BUCKET, Key: storageKey, ContentType: mimeType });
    uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: PRESIGN_EXPIRY_SECONDS });
  } catch (err) {
    console.error('Pre-sign failed:', err.message);
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'Failed to generate upload URL', detail: err.message }) };
  }

  return { statusCode: 200, headers, body: JSON.stringify({
    duplicate:       false,
    upload_url:      uploadUrl,
    storage_key:     storageKey,
    asset_family_id: familyId,
    version:         newVersion,
    asset_type:      typeInfo.asset_type,
    ext:             typeInfo.ext,
    expires_in:      PRESIGN_EXPIRY_SECONDS,
  })};
};
