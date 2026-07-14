// ============================================================
// PorfolioID — media-config.js
// Shared AMS Configuration
// Version: 1.0.0 — July 4, 2026
// ============================================================

const ALLOWED_TYPES = {
  'image/jpeg':         { ext: 'jpg',  asset_type: 'image' },
  'image/png':          { ext: 'png',  asset_type: 'image' },
  'image/webp':         { ext: 'webp', asset_type: 'image' },
  'image/gif':          { ext: 'gif',  asset_type: 'image' },
  'image/svg+xml':      { ext: 'svg',  asset_type: 'image' },
  'image/tiff':         { ext: 'tif',  asset_type: 'image' },
  'image/heic':         { ext: 'heic', asset_type: 'image' },
  'video/mp4':          { ext: 'mp4',  asset_type: 'video' },
  'video/quicktime':    { ext: 'mov',  asset_type: 'video' },
  'video/webm':         { ext: 'webm', asset_type: 'video' },
  'audio/mpeg':         { ext: 'mp3',  asset_type: 'audio' },
  'audio/mp4':          { ext: 'm4a',  asset_type: 'audio' },
  'audio/wav':          { ext: 'wav',  asset_type: 'audio' },
  'audio/flac':         { ext: 'flac', asset_type: 'audio' },
  'audio/aac':          { ext: 'aac',  asset_type: 'audio' },
  'application/pdf':    { ext: 'pdf',  asset_type: 'document' },
};

const MAX_SIZE_BYTES = {
  image:    25  * 1024 * 1024,
  video:    500 * 1024 * 1024,
  audio:    50  * 1024 * 1024,
  document: 25  * 1024 * 1024,
};

// VALID_CATEGORIES must match the category strings the browser (dashboard.js)
// actually sends via uploadToR2(). Previously this list only included
// 'credits' among the categories in real use (plus several unused legacy
// names), so media-presign.js rejected every other upload type (photos,
// videos, thumbnails, audio, documents, awards) with a 400 before it ever
// reached R2 or media-register — the root cause of media_assets staying
// empty for anything but credit photos. Legacy names below are preserved
// since dashboard.js is the only caller in this repo and nothing depends
// on them being removed.
const VALID_CATEGORIES = new Set([
  'gallery', 'bio', 'credits', 'thumbnail', 'resume',
  'cover', 'icon', 'branding', 'certificate', 'document',
  'photos', 'videos', 'thumbnails', 'audio', 'documents', 'awards',
]);

const VALID_ASSET_TYPES = new Set([
  'image', 'video', 'audio', 'document', 'logo', 'brand', 'ai-generated',
]);

const PRESIGN_EXPIRY_SECONDS = 3600;

const MAX_STORAGE_KEY_LENGTH = 512;

function buildStorageKey({ slug, category, descriptor, version, ext, date }) {
  const d = (date || new Date()).toISOString().slice(0, 10).replace(/-/g, '');

  const safeSlug = slug
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);

  const safeDescriptor = descriptor
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120);

  const key = `profiles/${safeSlug}/${category}/${safeSlug}_${safeDescriptor}_v${version}_${d}.${ext}`;

  if (key.length > MAX_STORAGE_KEY_LENGTH) {
    throw new Error(
      `Storage key too long: ${key.length} chars (max ${MAX_STORAGE_KEY_LENGTH}). Shorten the descriptor.`
    );
  }

  return key;
}

module.exports = {
  ALLOWED_TYPES,
  MAX_SIZE_BYTES,
  VALID_CATEGORIES,
  VALID_ASSET_TYPES,
  PRESIGN_EXPIRY_SECONDS,
  MAX_STORAGE_KEY_LENGTH,
  buildStorageKey,
};
