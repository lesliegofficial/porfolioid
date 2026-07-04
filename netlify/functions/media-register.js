// ============================================================
// PorfolioID — media-register.js
// AMS Asset Registration — Post-Upload Confirmation
// Version: 1.0.0 — July 4, 2026
// ============================================================
// PHASE 2B — BACKUP (not yet implemented):
//   backup_r2 = false in all rows. No silent lie.
//   Phase 2B requires Cloudflare Queue + Worker.
//   See architecture doc Phase 2B section.
// ============================================================

const { S3Client, HeadObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const crypto        = require('crypto');
const { pipeline }  = require('stream/promises');

const { ALLOWED_TYPES, VALID_CATEGORIES } = require('./config/media-config');

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const R2_ENDPOINT          = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY        = process.env.R2_ACCESS_KEY;
const R2_SECRET_KEY        = process.env.R2_SECRET_KEY;
const R2_BUCKET            = process.env.R2_BUCKET;

function getR2Client() {
  return new S3Client({
    region: 'auto', endpoint: R2_ENDPOINT,
    credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET_KEY },
  });
}

async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' }
  });
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, status: res.status, data: text }; }
}

async function sbInsert(table, row) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify(row)
  });
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, status: res.status, data: text }; }
}

async function sbUpdate(table, filter, updates) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify(updates)
  });
  return { ok: res.ok, status: res.status };
}

async function r2Delete(r2Client, key) {
  try {
    await r2Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  } catch (e) {
    console.error(`R2 rollback delete failed for key ${key}:`, e.message);
  }
}

async function computeStreamingSha256(r2Client, bucket, key) {
  const getResult = await r2Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const hash = crypto.createHash('sha256');
  await pipeline(getResult.Body, hash);
  return hash.digest('hex');
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !R2_ENDPOINT || !R2_ACCESS_KEY || !R2_SECRET_KEY || !R2_BUCKET) {
    return { statusCode: 503, headers, body: JSON.stringify({ error: 'Registration service not configured' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) }; }

  const { storageKey, assetFamilyId, version, slug, category, descriptor, displayName, altText, tags, isPublic, mimeType, fileSize, clientSha256, fileName } = body;

  if (!storageKey || !slug || !category || !descriptor || !mimeType || !version || !fileSize) {
    return { statusCode: 400, headers, body: JSON.stringify({
      error: 'Missing required fields',
      required: ['storageKey', 'slug', 'category', 'descriptor', 'mimeType', 'version', 'fileSize'],
    })};
  }

  const typeInfo = ALLOWED_TYPES[mimeType];
  if (!typeInfo) return { statusCode: 400, headers, body: JSON.stringify({ error: `Unsupported MIME type: ${mimeType}` }) };
  if (!VALID_CATEGORIES.has(category)) return { statusCode: 400, headers, body: JSON.stringify({ error: `Invalid category: ${category}` }) };

  const r2Client = getR2Client();

  // Stage 3: Verify upload exists in R2
  let headData;
  try {
    headData = await r2Client.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: storageKey }));
  } catch {
    return { statusCode: 404, headers, body: JSON.stringify({
      error: 'Upload not found in storage',
      detail: 'File not found at expected storage location. Upload may have failed or expired.',
      storage_key: storageKey,
    })};
  }

  // Verify Content-Type
  if (headData.ContentType && headData.ContentType !== mimeType) {
    return { statusCode: 409, headers, body: JSON.stringify({
      error: 'Content-Type mismatch', expected: mimeType, found: headData.ContentType,
    })};
  }

  // Exact size match — no tolerance for single PUT uploads
  if (headData.ContentLength !== fileSize) {
    return { statusCode: 409, headers, body: JSON.stringify({
      error: 'File size mismatch', expected_bytes: fileSize, found_bytes: headData.ContentLength,
    })};
  }

  // Stage 4: Compute authoritative SHA-256 via streaming
  let serverSha256;
  try {
    serverSha256 = await computeStreamingSha256(r2Client, R2_BUCKET, storageKey);
  } catch (err) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'Failed to verify file integrity', detail: err.message }) };
  }

  // Stage 5: Compare hashes — client hash is hint only
  if (clientSha256 && clientSha256 !== serverSha256) {
    await r2Delete(r2Client, storageKey);
    return { statusCode: 409, headers, body: JSON.stringify({
      error: 'File integrity check failed',
      detail: 'SHA-256 hash mismatch. Upload rejected and removed from storage.',
    })};
  }

  // Stage 6: Demote previous version
  if (version > 1) {
    await sbUpdate('media_assets',
      `slug=eq.${encodeURIComponent(slug)}&descriptor=eq.${encodeURIComponent(descriptor)}&is_current=eq.true`,
      { is_current: false }
    );
  }

  // Stage 7: Insert into Supabase
  const newAsset = {
    asset_family_id:   assetFamilyId || null,
    version,
    is_current:        true,
    slug,
    asset_type:        typeInfo.asset_type,
    category,
    descriptor,
    display_name:      displayName || null,
    original_filename: fileName || null,
    alt_text:          altText || null,
    tags:              tags || [],
    provider:          'r2',
    storage_zone:      R2_BUCKET,
    storage_key:       storageKey,
    sha256_hash:       serverSha256,
    size_bytes:        headData.ContentLength,
    mime_type:         mimeType,
    format:            typeInfo.ext,
    has_thumbnail: false, has_medium: false, has_large: false, has_webp: false, has_hls: false,
    backup_r2: false, backup_r2_key: null, backup_gdrive: false, backup_local: false,
    is_public:  isPublic !== false,
    is_active:  true,
    status:     'active',
  };

  const insertResult = await sbInsert('media_assets', newAsset);

  // Stage 8: Atomic rollback if insert fails
  if (!insertResult.ok) {
    console.error('Supabase insert failed — rolling back R2 upload');
    await r2Delete(r2Client, storageKey);
    return { statusCode: 502, headers, body: JSON.stringify({
      error: 'Asset registration failed — upload rolled back',
      stage: 7, detail: insertResult.data,
    })};
  }

  const createdAsset = Array.isArray(insertResult.data) ? insertResult.data[0] : insertResult.data;

  // Set asset_family_id = id on first upload
  if (version === 1 && createdAsset?.id) {
    await sbUpdate('media_assets', `id=eq.${encodeURIComponent(createdAsset.id)}`, { asset_family_id: createdAsset.id });
  }

  return { statusCode: 200, headers, body: JSON.stringify({
    success:     true,
    asset_id:    createdAsset?.id,
    storage_key: storageKey,
    version,
    sha256_hash: serverSha256,
    size_bytes:  headData.ContentLength,
    asset_type:  typeInfo.asset_type,
    backup_r2:   false,
  })};
};
