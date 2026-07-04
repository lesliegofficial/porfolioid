// ============================================================
// PorfolioID — media-audit.js
// AMS Asset Integrity Auditor
// Version: 1.0.0 — July 4, 2026
// ============================================================

const { S3Client, HeadObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const crypto        = require('crypto');
const { pipeline }  = require('stream/promises');
const { ALLOWED_TYPES } = require('./config/media-config');

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
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !R2_ENDPOINT || !R2_ACCESS_KEY || !R2_SECRET_KEY || !R2_BUCKET) {
    return { statusCode: 503, headers, body: JSON.stringify({ error: 'Audit service not configured' }) };
  }

  const params = event.queryStringParameters || {};

  if (!params.asset_id && !params.storage_key) {
    return { statusCode: 400, headers, body: JSON.stringify({
      error: 'Missing required parameter',
      usage: ['GET ?asset_id={uuid}', 'GET ?storage_key={path}']
    })};
  }

  // Look up asset in Supabase
  let dbAsset;
  if (params.asset_id) {
    const result = await sbGet(`media_assets?id=eq.${encodeURIComponent(params.asset_id)}&is_current=eq.true&limit=1`);
    if (!result.ok || !result.data?.length) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Asset not found in database', asset_id: params.asset_id }) };
    }
    dbAsset = result.data[0];
  } else {
    const result = await sbGet(`media_assets?storage_key=eq.${encodeURIComponent(params.storage_key)}&is_current=eq.true&limit=1`);
    if (!result.ok || !result.data?.length) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Asset not found in database', storage_key: params.storage_key }) };
    }
    dbAsset = result.data[0];
  }

  const r2Client = getR2Client();

  // Check 1: Object exists in R2
  let headData;
  try {
    headData = await r2Client.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: dbAsset.storage_key }));
  } catch {
    return { statusCode: 200, headers, body: JSON.stringify({
      asset_id: dbAsset.id, storage_key: dbAsset.storage_key, display_name: dbAsset.display_name,
      status: 'MISSING',
      checks: { exists_in_r2: false, bucket_match: null, provider_match: null, storage_key_match: null, content_type_match: null, size_match: null, hash_match: null },
      backup: { backup_r2: dbAsset.backup_r2, backup_r2_key: dbAsset.backup_r2_key, backup_gdrive: dbAsset.backup_gdrive, backup_local: dbAsset.backup_local },
      summary: '❌ MISSING — Asset registered in database but object not found in R2.',
      action: 'Manual recovery required — restore from porfolioid-backup bucket.',
    })};
  }

  // Check 2: Bucket match
  const bucketMatch = dbAsset.storage_zone === R2_BUCKET;

  // Check 3: Provider match
  const providerMatch = dbAsset.provider === 'r2';

  // Check 4: Storage key match
  const storageKeyMatch = !!dbAsset.storage_key;

  // Check 5: Content-Type match
  const r2ContentType    = headData.ContentType || '';
  const contentTypeMatch = r2ContentType === dbAsset.mime_type;

  // Check 6: Exact size match
  const sizeMatch = headData.ContentLength === dbAsset.size_bytes;

  // Check 7: SHA-256 hash (streaming — skip if size already failed)
  let computedHash = null;
  let hashError    = null;
  let hashMatch    = null;

  if (sizeMatch) {
    try {
      computedHash = await computeStreamingSha256(r2Client, R2_BUCKET, dbAsset.storage_key);
      hashMatch    = computedHash === dbAsset.sha256_hash;
    } catch (err) {
      hashError = err.message;
      hashMatch = false;
    }
  } else {
    hashMatch = false;
  }

  const allChecks  = [bucketMatch, providerMatch, storageKeyMatch, contentTypeMatch, sizeMatch, hashMatch];
  const overallPass = allChecks.every(c => c === true) && !hashError;

  const failures = [];
  if (!bucketMatch)       failures.push('bucket_match');
  if (!providerMatch)     failures.push('provider_match');
  if (!storageKeyMatch)   failures.push('storage_key_match');
  if (!contentTypeMatch)  failures.push('content_type_match');
  if (!sizeMatch)         failures.push('size_match');
  if (!hashMatch)         failures.push('hash_match');
  if (hashError)          failures.push(`hash_error: ${hashError}`);

  return { statusCode: 200, headers, body: JSON.stringify({
    asset_id:     dbAsset.id,
    storage_key:  dbAsset.storage_key,
    display_name: dbAsset.display_name,
    asset_type:   dbAsset.asset_type,
    status:       overallPass ? 'PASS' : 'FAIL',
    checks: {
      exists_in_r2:       true,
      bucket_match:       bucketMatch,
      provider_match:     providerMatch,
      storage_key_match:  storageKeyMatch,
      content_type_match: contentTypeMatch,
      size_match:         sizeMatch,
      hash_match:         hashMatch,
    },
    detail: {
      db_provider:     dbAsset.provider,
      db_storage_zone: dbAsset.storage_zone,
      queried_bucket:  R2_BUCKET,
      db_mime_type:    dbAsset.mime_type,
      r2_content_type: r2ContentType,
      db_size_bytes:   dbAsset.size_bytes,
      r2_size_bytes:   headData.ContentLength,
      db_sha256:       dbAsset.sha256_hash,
      computed_sha256: computedHash,
      hash_error:      hashError || null,
    },
    backup: {
      backup_r2:     dbAsset.backup_r2,
      backup_r2_key: dbAsset.backup_r2_key,
      backup_gdrive: dbAsset.backup_gdrive,
      backup_local:  dbAsset.backup_local,
    },
    failures: failures.length > 0 ? failures : null,
    summary: overallPass
      ? `✅ PASS — All 7 checks passed. Asset is intact.`
      : `❌ FAIL — ${failures.length} check(s) failed: ${failures.join(', ')}.`,
  })};
};
