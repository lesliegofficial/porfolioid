// PorfolioID — Netlify Function
// Phase 6: Supabase backend with Netlify Blobs fallback

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const USE_SUPABASE = !!(SUPABASE_URL && SUPABASE_SERVICE_KEY);

// ── SUPABASE HELPERS ──────────────────────────────────────────────
async function sb(path, method = 'GET', body) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal'
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, opts);
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, status: res.status, data: text }; }
}

async function sbGet(table, query) {
  return sb(`${table}?${query}`, 'GET');
}

async function sbUpsert(table, data) {
  return sb(`${table}?on_conflict=${data.slug ? 'slug' : 'id'}`, 'POST', data);
}

async function sbUpdate(table, match, data) {
  const q = Object.entries(match).map(([k,v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&');
  return sb(`${table}?${q}`, 'PATCH', data);
}

async function sbDelete(table, match) {
  const q = Object.entries(match).map(([k,v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&');
  return sb(`${table}?${q}`, 'DELETE');
}

// ── NETLIFY BLOBS FALLBACK ────────────────────────────────────────
let blobStore = null;
async function getBlobs() {
  if (blobStore) return blobStore;
  try {
    const { getStore } = require('@netlify/blobs');
    blobStore = getStore({ name: 'epk-data', siteID: process.env.EPK_SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });
    return blobStore;
  } catch { return null; }
}

// ── MIGRATE BLOB → SUPABASE ───────────────────────────────────────
async function migrateFromBlobs(slug) {
  try {
    const store = await getBlobs();
    if (!store) return null;
    const raw = await store.get(`epk:${slug}`);
    if (!raw) return null;
    const epkData = typeof raw === 'string' ? JSON.parse(raw) : raw;
    // Already migrated check
    const existing = await sbGet('epk_profiles', `slug=eq.${slug}&select=slug`);
    if (existing.ok && existing.data.length > 0) return epkData;
    // Migrate core profile
    await sbUpsert('epk_profiles', { slug, data: epkData, updated_at: new Date().toISOString() });
    console.log(`Migrated ${slug} from Blobs to Supabase`);
    return epkData;
  } catch (e) {
    console.error('Migration error:', e.message);
    return null;
  }
}

// ── MAIN HANDLER ─────────────────────────────────────────────────
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const ok = (data) => ({ statusCode: 200, headers, body: JSON.stringify(data) });
  const err = (msg, code = 400) => ({ statusCode: code, headers, body: JSON.stringify({ error: msg }) });

  try {
    // ── GET: Load EPK ──────────────────────────────────────────
    if (event.httpMethod === 'GET') {
      const { slug, section, page = 0, limit = 50 } = event.queryStringParameters || {};
      if (!slug) return err('slug required');

      if (!USE_SUPABASE) {
        // Fallback to blobs
        const store = await getBlobs();
        if (!store) return err('No storage configured', 500);
        const raw = await store.get(`epk:${slug}`);
        if (!raw) return err('not found', 404);
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return ok(data);
      }

      // Try Supabase
      const profileRes = await sbGet('epk_profiles', `slug=eq.${slug}&select=data,updated_at`);

      let epkData;
      if (!profileRes.ok || !profileRes.data.length) {
        // Try migrating from blobs
        epkData = await migrateFromBlobs(slug);
        if (!epkData) return err('not found', 404);
      } else {
        epkData = profileRes.data[0].data;
      }

      // If requesting a specific section with pagination
      if (section) {
        const tableMap = {
          credits: 'credits', music: 'music_tracks', videos: 'videos',
          photos: 'photos', assets: 'assets', awards: 'awards'
        };
        const table = tableMap[section];
        if (table) {
          const offset = parseInt(page) * parseInt(limit);
          const sectionRes = await sbGet(table,
            `slug=eq.${slug}&order=sort_order.asc,created_at.asc&limit=${limit}&offset=${offset}`
          );
          if (sectionRes.ok) return ok({ items: sectionRes.data, page: parseInt(page) });
        }
      }

      return ok(epkData);
    }

    // ── POST: All write actions ────────────────────────────────
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { action, slug, data } = body;

      // ── LOAD ──
      if (action === 'load') {
        if (!slug) return err('slug required');
        if (!USE_SUPABASE) {
          const store = await getBlobs();
          if (!store) return err('No storage configured', 500);
          const raw = await store.get(`epk:${slug}`);
          if (!raw) return err('not found', 404);
          const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
          return ok({ success: true, epk: data });
        }
        const profileRes = await sbGet('epk_profiles', `slug=eq.${slug}&select=data,updated_at`);
        if (!profileRes.ok || !profileRes.data.length) {
          // Supabase failed — try Netlify Blobs backup
          const store = await getBlobs();
          if (store) {
            try {
              const raw = await store.get(`epk:${slug}`);
              if (raw) {
                const blobData = typeof raw === 'string' ? JSON.parse(raw) : raw;
                // Restore to Supabase while we're at it
                await sb(`epk_profiles?on_conflict=slug`, 'POST', { slug, data: blobData, updated_at: new Date().toISOString() });
                console.log(`Restored ${slug} from Blobs backup to Supabase`);
                return ok({ success: true, epk: blobData });
              }
            } catch(e) { console.error('Blob fallback error:', e.message); }
          }
          // Last resort — try GitHub backup
          try {
            const GITHUB_TOKEN = process.env.GITHUB_BACKUP_TOKEN;
            const GITHUB_REPO = process.env.GITHUB_BACKUP_REPO || 'lesliegofficial/porfolioid';
            if (GITHUB_TOKEN) {
              const ghRes = await fetch(
                `https://api.github.com/repos/${GITHUB_REPO}/contents/_backups/${slug}.json`,
                { headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'User-Agent': 'porfolioid-backup' } }
              );
              if (ghRes.ok) {
                const ghFile = await ghRes.json();
                const ghData = JSON.parse(Buffer.from(ghFile.content, 'base64').toString('utf-8'));
                // Restore to Supabase and Blobs
                await sb(`epk_profiles?on_conflict=slug`, 'POST', { slug, data: ghData, updated_at: new Date().toISOString() });
                if (store) await store.set(`epk:${slug}`, JSON.stringify(ghData));
                console.log(`Restored ${slug} from GitHub backup`);
                return ok({ success: true, epk: ghData });
              }
            }
          } catch(ghErr) { console.error('GitHub fallback error:', ghErr.message); }
          const epkData = await migrateFromBlobs(slug);
          if (!epkData) return err('not found', 404);
          return ok({ success: true, epk: epkData });
        }
        // Merge section data from separate tables into core EPK data
        const coreData = profileRes.data[0].data;
        try {
          const [creditsRes, awardsRes, assetsRes, videosRes, tracksRes] = await Promise.all([
            sbGet('credits', `slug=eq.${slug}&order=sort_order.asc&limit=100`),
            sbGet('awards', `slug=eq.${slug}&order=sort_order.asc&limit=50`),
            sbGet('assets', `slug=eq.${slug}&order=sort_order.asc&limit=50`),
            sbGet('videos', `slug=eq.${slug}&order=sort_order.asc&limit=50`),
            sbGet('music_tracks', `slug=eq.${slug}&order=sort_order.asc&limit=100`)
          ]);
          // Credits: use core data credits directly if they have fullDesc
          // Only fall back to section table if core data has no credits
          const coreCredits = coreData.credits || [];
          const coreHasFullDesc = coreCredits.some(c => c.fullDesc && c.fullDesc.length > 0);
          if (coreHasFullDesc) {
            // Core data has full descriptions — use it directly, just add photos from section table if any
            coreData.credits = coreCredits;
          } else if (creditsRes.ok && creditsRes.data.length) {
            // Fall back to section table merge only if core has no fullDesc
            coreData.credits = creditsRes.data.map((c, i) => {
              const core = coreCredits.find(cc => cc.company === c.title || cc.company === c.company) || coreCredits[i] || {};
              return {
                company: c.title || core.company, role: c.role || core.role, years: c.year || core.years,
                desc: core.desc || c.description || '',
                descEs: core.descEs || '',
                category: c.category || core.category,
                visible: core.visible !== undefined ? core.visible : true,
                verified: core.verified !== undefined ? core.verified : true,
                pinned: core.pinned !== undefined ? core.pinned : (c.sort_order < 3),
                fullDesc: core.fullDesc || '',
                fullDescEs: core.fullDescEs || '',
                id: core.id || c.id || '',
                color: core.color || 'gold',
                sort_order: c.sort_order,
                photos: core.photos || []
              };
            });
          }
          if (awardsRes.ok && awardsRes.data.length) {
            coreData.awards = awardsRes.data.map(a => ({
              title: a.title, org: a.organization, year: a.year,
              verified: true, type: 'recognition'
            }));
          }
          if (assetsRes.ok && assetsRes.data.length) {
            coreData.assets = assetsRes.data.map(a => ({
              title: a.title, url: a.url, category: 'Professional Assets',
              btnLabel: '\u2193 Download Resume \u2192', visible: true
            }));
          }
          // Videos: use core data directly if it has videos — only fall back to section table if core has none
          const coreHasVideos = coreData.videos && coreData.videos.length > 0;
          if (!coreHasVideos && videosRes.ok && videosRes.data.length) {
            coreData.videos = videosRes.data.map(v => ({
              title: v.title, url: v.url, thumb: v.thumbnail,
              year: v.year, visible: true
            }));
          }
          // Tracks: use core data directly if it has tracks — only fall back to section table if core has none
          const coreHasTracks = coreData.tracks && coreData.tracks.length > 0;
          if (!coreHasTracks && tracksRes.ok && tracksRes.data.length) {
            coreData.tracks = tracksRes.data.map(t => ({
              title: t.title, artist: t.artist, album: t.album,
              year: t.year, link: t.url, visible: true, role: 'Touring Vocalist'
            }));
          }
        } catch(mergeErr) {
          console.error('Section merge error (non-fatal):', mergeErr.message);
        }
        return ok({ success: true, epk: coreData });
      }

      // ── SIGNUP ──
      if (action === 'signup') {
        if (!USE_SUPABASE) {
          const store = await getBlobs();
          if (!store) return err('No storage', 500);
          const existingSlug = await store.get(`user:${slug}`, { type: 'json' });
          if (existingSlug) return err('Slug already taken', 409);
          const emailCheck = await store.get(`email:${body.email}`, { type: 'json' });
          if (emailCheck) return err('Email already registered', 409);
          const newUser = { id: `user_${Date.now()}`, firstName: body.firstName, lastName: body.lastName, email: body.email, slug };
          await store.set(`user:${slug}`, JSON.stringify(newUser));
          await store.set(`email:${body.email}`, JSON.stringify({ slug }));
          await store.set(`epk:${slug}`, JSON.stringify(body.epk || {}));
          const { password: _p, ...safeUser } = newUser;
          return ok({ success: true, user: safeUser });
        }

        // Supabase signup
        const slugCheck = await sbGet('users', `slug=eq.${slug}&select=slug`);
        if (slugCheck.ok && slugCheck.data.length > 0) return err('Slug already taken', 409);
        const emailCheck = await sbGet('users', `email=eq.${encodeURIComponent(body.email)}&select=email`);
        if (emailCheck.ok && emailCheck.data.length > 0) return err('Email already registered', 409);

        const userRes = await sbUpsert('users', {
          slug,
          email: body.email,
          password: body.password,
          first_name: body.firstName,
          last_name: body.lastName
        });
        if (!userRes.ok) return err('Signup failed: ' + JSON.stringify(userRes.data), 500);

        const initEpk = body.epk || { name: `${body.firstName} ${body.lastName}`, slug };
        await sbUpsert('epk_profiles', { slug, data: initEpk, updated_at: new Date().toISOString() });

        // Migrate any existing blob data
        await migrateFromBlobs(slug);

        return ok({ success: true, user: { id: userRes.data[0]?.id, firstName: body.firstName, lastName: body.lastName, email: body.email, slug } });
      }

      // ── LOGIN ──
      if (action === 'login') {
        if (!USE_SUPABASE) {
          const store = await getBlobs();
          if (!store) return err('No storage', 500);
          const emailRecord = await store.get(`email:${body.email}`, { type: 'json' });
          if (!emailRecord) return err('User not found', 404);
          const existing = await store.get(`user:${emailRecord.slug}`, { type: 'json' });
          if (!existing || existing.password !== body.password) return err('Invalid password', 401);
          const { password: _p, ...safeUser } = existing;
          return ok({ success: true, user: safeUser });
        }

        // Supabase login
        const userRes = await sbGet('users', `email=eq.${encodeURIComponent(body.email)}&select=*`);
        if (!userRes.ok || !userRes.data.length) return err('User not found', 404);
        const user = userRes.data[0];
        if (user.password !== body.password) return err('Invalid password', 401);

        // Load EPK — migrate from blobs if needed
        let epkData = null;
        const profileRes = await sbGet('epk_profiles', `slug=eq.${user.slug}&select=data`);
        if (profileRes.ok && profileRes.data.length) {
          epkData = profileRes.data[0].data;
        } else {
          epkData = await migrateFromBlobs(user.slug);
        }

        return ok({
          success: true,
          user: { id: user.id, firstName: user.first_name, lastName: user.last_name, email: user.email, slug: user.slug },
          epk: epkData
        });
      }

      // ── SAVE (full EPK) ──
      if (action === 'save') {
        if (!slug) return err('slug required');

        if (!USE_SUPABASE) {
          const store = await getBlobs();
          if (!store) return err('No storage', 500);
          await store.set(`epk:${slug}`, JSON.stringify(data));
          return ok({ success: true });
        }

        // Save core profile data to Supabase — reliable upsert (insert or update)
        // CRITICAL: If incoming data has empty/missing credits, preserve existing credits from server
        // This prevents photo/video saves from wiping fullDesc
        let safeData = { ...data };
        // Protect videos and tracks — if incoming data has none, preserve from server
        // This prevents photo/credit saves from wiping videos and tracks
        if (!safeData.videos || safeData.videos.length === 0) {
          try {
            const existingRes = await sbGet('epk_profiles', `slug=eq.${slug}&select=data`);
            if (existingRes.ok && existingRes.data.length) {
              const existingVideos = existingRes.data[0].data && existingRes.data[0].data.videos;
              if (existingVideos && existingVideos.length > 0) {
                safeData.videos = existingVideos;
                console.log(`PROTECTED: preserved ${existingVideos.length} videos from server`);
              }
            }
          } catch(e) { console.error('Videos protection failed:', e); }
        }
        if (!safeData.tracks || safeData.tracks.length === 0) {
          try {
            const existingRes = await sbGet('epk_profiles', `slug=eq.${slug}&select=data`);
            if (existingRes.ok && existingRes.data.length) {
              const existingTracks = existingRes.data[0].data && existingRes.data[0].data.tracks;
              if (existingTracks && existingTracks.length > 0) {
                safeData.tracks = existingTracks;
                console.log(`PROTECTED: preserved ${existingTracks.length} tracks from server`);
              }
            }
          } catch(e) { console.error('Tracks protection failed:', e); }
        }
        // Protect photos, awards, assets from partial saves
        for (const field of ['photos', 'awards', 'assets']) {
          if (!safeData[field] || safeData[field].length === 0) {
            try {
              const existingRes = await sbGet('epk_profiles', `slug=eq.${slug}&select=data`);
              if (existingRes.ok && existingRes.data.length) {
                const existing = existingRes.data[0].data && existingRes.data[0].data[field];
                if (existing && existing.length > 0) safeData[field] = existing;
              }
            } catch(e) { console.error(`${field} protection failed:`, e); }
          }
        }
        if (!safeData.credits || safeData.credits.length === 0) {
          try {
            const existingRes = await sbGet('epk_profiles', `slug=eq.${slug}&select=data`);
            if (existingRes.ok && existingRes.data.length) {
              const existingCredits = existingRes.data[0].data && existingRes.data[0].data.credits;
              if (existingCredits && existingCredits.length > 0) {
                safeData.credits = existingCredits;
                console.log(`PROTECTED: preserved ${existingCredits.length} credits from server`);
              }
            }
          } catch(e) { console.error('Credits protection check failed:', e); }
        } else {
          // Credits present — but ensure fullDesc is preserved from server for any credit missing it
          try {
            const existingRes = await sbGet('epk_profiles', `slug=eq.${slug}&select=data`);
            if (existingRes.ok && existingRes.data.length) {
              const existingCredits = existingRes.data[0].data && existingRes.data[0].data.credits || [];
              safeData.credits = safeData.credits.map(c => {
                const existing = existingCredits.find(e => e.company === c.company || e.id === c.id);
                if (existing) {
                  return {
                    ...existing,
                    ...c,
                    fullDesc: c.fullDesc || existing.fullDesc || '',
                    fullDescEs: c.fullDescEs || existing.fullDescEs || '',
                    desc: c.desc || existing.desc || '',
                    descEs: c.descEs || existing.descEs || '',
                    photos: c.photos || existing.photos || []
                  };
                }
                return c;
              });
            }
          } catch(e) { console.error('Credits fullDesc merge failed:', e); }
        }
        const upsertRes = await fetch(
          `${SUPABASE_URL}/rest/v1/epk_profiles?on_conflict=slug`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
              'Prefer': 'resolution=merge-duplicates,return=minimal'
            },
            body: JSON.stringify({ slug, data: safeData, updated_at: new Date().toISOString() })
          }
        ).then(r => ({ ok: r.ok, status: r.status }));

        // Also write backup to Netlify Blobs so data survives Supabase hiccups
        try {
          const store = await getBlobs();
          if (store) await store.set(`epk:${slug}`, JSON.stringify(data));
        } catch(backupErr) {
          console.error('Blob backup failed (non-fatal):', backupErr.message);
        }

        // Also write backup to GitHub — permanent, never resets, survives everything
        try {
          const GITHUB_TOKEN = process.env.GITHUB_BACKUP_TOKEN;
          const GITHUB_REPO = process.env.GITHUB_BACKUP_REPO || 'lesliegofficial/porfolioid';
          if (GITHUB_TOKEN) {
            const backupPath = `_backups/${slug}-core.json`;
            // For backup, fetch complete data including credits from Supabase
            let fullBackupData = { ...data };
            try {
              const fullRes = await fetch(
                `${SUPABASE_URL}/rest/v1/epk_profiles?slug=eq.${slug}&select=data`,
                { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
              );
              if (fullRes.ok) {
                const fullProfile = await fullRes.json();
                if (fullProfile[0]) fullBackupData = fullProfile[0].data;
              }
            } catch(e) {}
            const backupContent = JSON.stringify(fullBackupData, null, 2);
            const encoded = Buffer.from(backupContent).toString('base64');
            // Get current SHA if file exists (required for updates)
            let fileSha = null;
            try {
              const getRes = await fetch(
                `https://api.github.com/repos/${GITHUB_REPO}/contents/${backupPath}`,
                { headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'User-Agent': 'porfolioid-backup' } }
              );
              if (getRes.ok) {
                const existing = await getRes.json();
                fileSha = existing.sha;
              }
            } catch(e) {}
            // Write backup file
            const body = { message: `Auto-backup: ${slug} ${new Date().toISOString()}`, content: encoded };
            if (fileSha) body.sha = fileSha;
            await fetch(
              `https://api.github.com/repos/${GITHUB_REPO}/contents/${backupPath}`,
              {
                method: 'PUT',
                headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'porfolioid-backup' },
                body: JSON.stringify(body)
              }
            );
          }
        } catch(ghErr) {
          console.error('GitHub backup failed (non-fatal):', ghErr.message);
        }

        if (!upsertRes.ok) {
          console.error('Supabase upsert failed:', JSON.stringify(upsertRes.data));
          return err('Save failed: ' + JSON.stringify(upsertRes.data), 500);
        }

        return ok({ success: true });
      }

      // ── SAVE SECTION (paginated arrays) ──
      if (action === 'saveSection') {
        const { section, items } = body;
        if (!slug || !section) return err('slug and section required');

        const tableMap = {
          credits: 'credits', music: 'music_tracks', videos: 'videos',
          photos: 'photos', assets: 'assets', awards: 'awards'
        };
        const table = tableMap[section];
        if (!table) return err('Unknown section');

        if (!USE_SUPABASE) {
          // Fallback: save into blob EPK data
          const store = await getBlobs();
          const raw = await store.get(`epk:${slug}`);
          const epkData = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {};
          epkData[section] = items;
          await store.set(`epk:${slug}`, JSON.stringify(epkData));
          return ok({ success: true });
        }

        // For credits: save to epk_profiles core data to preserve fullDesc/fullDescEs
        // The credits table only has basic columns and would silently drop rich fields
        if (section === 'credits') {
          const profileRes = await sbGet('epk_profiles', `slug=eq.${slug}&select=data`);
          if (profileRes.ok && profileRes.data.length) {
            const coreData = profileRes.data[0].data || {};
            coreData.credits = items;
            const updateRes = await sb('epk_profiles', 'POST', { slug, data: coreData, updated_at: new Date().toISOString() }, {
              headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' }
            });
            if (!updateRes.ok) console.error('Credits core save error:', updateRes.data);
          }
          // Also update the basic credits table for indexing purposes only
          await sbDelete(table, { slug });
          if (items && items.length) {
            const rows = items.map((item, i) => ({
              slug, sort_order: i,
              title: item.company || item.artist || '',
              role: item.role || '',
              year: item.years || '',
              category: item.category || '',
              description: item.desc || ''
            }));
            await sb(table, 'POST', rows);
          }
          return ok({ success: true });
        }

        // For photos: save full rich data into epk_profiles core (not just the photos table)
        // This ensures all metadata fields (year, location, people, tags, etc.) survive the round trip
        if (section === 'photos') {
          const profileRes = await sbGet('epk_profiles', `slug=eq.${slug}&select=data`);
          if (profileRes.ok && profileRes.data.length) {
            const coreData = profileRes.data[0].data || {};
            coreData.photos = items;
            const updateRes = await sb('epk_profiles', 'POST', { slug, data: coreData, updated_at: new Date().toISOString() }, {
              headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' }
            });
            if (!updateRes.ok) console.error('Photos core save error:', updateRes.data);
          }
          return ok({ success: true });
        }

        // Delete existing and reinsert with new sort order
        await sbDelete(table, { slug });
        if (items && items.length) {
          const rows = items.map((item, i) => ({ ...item, slug, sort_order: i, id: item.id || `${section}_${slug}_${Date.now()}_${i}` }));
          // Batch insert (Supabase handles arrays)
          const insertRes = await sb(table, 'POST', rows);
          if (!insertRes.ok) console.error('Section save error:', insertRes.data);
        }
        return ok({ success: true });
      }

      // ── TRACK DOWNLOAD ──
      if (action === 'trackDownload') {
        if (!slug) return err('slug required');
        const { assetIdx } = body;

        if (!USE_SUPABASE) {
          const store = await getBlobs();
          const raw = await store.get(`epk:${slug}`);
          if (raw) {
            const epkData = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (epkData.assets && epkData.assets[assetIdx] !== undefined) {
              epkData.assets[assetIdx].downloads = (epkData.assets[assetIdx].downloads || 0) + 1;
              await store.set(`epk:${slug}`, JSON.stringify(epkData));
            }
          }
          return ok({ success: true });
        }

        // Increment downloads in assets table
        const assetRes = await sbGet('assets', `slug=eq.${slug}&order=sort_order.asc&limit=100`);
        if (assetRes.ok && assetRes.data[assetIdx]) {
          const asset = assetRes.data[assetIdx];
          await sbUpdate('assets', { id: asset.id }, { downloads: (asset.downloads || 0) + 1 });
        }
        return ok({ success: true });
      }

      // ── TRACK QR SCAN ──
      if (action === 'trackScan') {
        if (!slug) return err('slug required');
        if (!USE_SUPABASE) return ok({ success: true }); // Skip tracking without Supabase

        await sb('qr_scans', 'POST', {
          slug,
          qr_mode: body.qrMode || 'artist',
          event_name: body.eventName || null,
          user_agent: body.userAgent || null
        });

        // Return current count for this mode
        const countRes = await sbGet('qr_scans',
          `slug=eq.${slug}&qr_mode=eq.${body.qrMode || 'artist'}&select=id`
        );
        return ok({ success: true, count: countRes.ok ? countRes.data.length : 0 });
      }

      // ── TRACK PAGE VIEW ──
      if (action === 'trackView') {
        if (!slug) return ok({ success: true }); // silent fail
        if (!USE_SUPABASE) return ok({ success: true });

        const { referrer, qrMode, device, country } = body;
        await sb('profile_views', 'POST', {
          slug,
          referrer: referrer || null,
          qr_mode: qrMode || null,
          device: device || null,
          country: country || null,
          viewed_at: new Date().toISOString()
        });
        return ok({ success: true });
      }

      // ── GET ANALYTICS ──
      if (action === 'getAnalytics') {
        const { userSlug, days = 30 } = body;
        if (!userSlug) return err('userSlug required');
        if (!USE_SUPABASE) return ok({ views: 0, scans: 0, downloads: 0, topSections: [], recent: [] });

        const since = new Date(Date.now() - days * 86400000).toISOString();

        // Get all profile slugs for this user
        const profilesRes = await sbGet('user_profiles', `user_slug=eq.${userSlug}&select=profile_slug`);
        const slugs = profilesRes.ok && profilesRes.data.length
          ? profilesRes.data.map(p => p.profile_slug)
          : [userSlug];

        // Run queries in parallel
        const [viewsRes, scansRes, downloadsRes] = await Promise.all([
          sbGet('profile_views', `slug=in.(${slugs.join(',')})&viewed_at=gte.${since}&select=id,slug,viewed_at,device,country,qr_mode`),
          sbGet('qr_scans', `slug=in.(${slugs.join(',')})&scanned_at=gte.${since}&select=id,slug,qr_mode,event_name,scanned_at`),
          sbGet('assets', `slug=in.(${slugs.join(',')})&select=title,downloads,slug`)
        ]);

        const views = viewsRes.ok ? viewsRes.data : [];
        const scans = scansRes.ok ? scansRes.data : [];
        const assets = downloadsRes.ok ? downloadsRes.data : [];
        const totalDownloads = assets.reduce((sum, a) => sum + (a.downloads || 0), 0);

        // Device breakdown
        const devices = views.reduce((acc, v) => {
          const d = v.device || 'unknown';
          acc[d] = (acc[d] || 0) + 1;
          return acc;
        }, {});

        // Daily view counts for chart (last 14 days)
        const daily = {};
        for (let i = 13; i >= 0; i--) {
          const d = new Date(Date.now() - i * 86400000);
          daily[d.toISOString().slice(0,10)] = 0;
        }
        views.forEach(v => {
          const day = v.viewed_at.slice(0,10);
          if (daily[day] !== undefined) daily[day]++;
        });

        // QR mode breakdown
        const qrModes = scans.reduce((acc, s) => {
          acc[s.qr_mode] = (acc[s.qr_mode] || 0) + 1;
          return acc;
        }, {});

        return ok({
          totalViews: views.length,
          totalScans: scans.length,
          totalDownloads,
          devices,
          daily: Object.entries(daily).map(([date, count]) => ({ date, count })),
          qrModes,
          recentViews: views.slice(-10).reverse(),
          topAssets: assets.sort((a,b) => (b.downloads||0) - (a.downloads||0)).slice(0,5)
        });
      }

      // ── MIGRATE (manual trigger) ──
      if (action === 'migrate') {
        if (!slug) return err('slug required');
        const epkData = await migrateFromBlobs(slug);
        if (!epkData) return err('Nothing to migrate or already migrated');
        return ok({ success: true, message: 'Migrated successfully' });
      }

      // ── LIST PROFILES for a user ──
      if (action === 'listProfiles') {
        const { userSlug } = body;
        if (!userSlug) return err('userSlug required');

        if (!USE_SUPABASE) {
          // Blobs: return just the primary profile
          const store = await getBlobs();
          const raw = await store.get(`epk:${userSlug}`);
          if (!raw) return ok({ profiles: [] });
          return ok({ profiles: [{ profileSlug: userSlug, profileType: 'primary', profileName: 'Primary', isPrimary: true }] });
        }

        const res = await sbGet('user_profiles', `user_slug=eq.${userSlug}&order=created_at.asc`);
        if (!res.ok) return ok({ profiles: [] });
        return ok({ profiles: res.data });
      }

      // ── CREATE PROFILE ──
      if (action === 'createProfile') {
        const { userSlug, profileSlug, profileType, profileName } = body;
        if (!userSlug || !profileSlug) return err('userSlug and profileSlug required');

        // Check slug not taken
        const slugCheck = await sbGet('epk_profiles', `slug=eq.${profileSlug}&select=slug`);
        if (slugCheck.ok && slugCheck.data.length > 0) return err('Profile slug already taken', 409);

        // Also check users table
        const userSlugCheck = await sbGet('users', `slug=eq.${profileSlug}&select=slug`);
        if (userSlugCheck.ok && userSlugCheck.data.length > 0) return err('Profile slug already taken', 409);

        // Create empty EPK for this profile
        const initEpk = { slug: profileSlug, profileType: profileType || 'creative', profileName: profileName || 'My Profile', name: body.name || '' };
        await sbUpsert('epk_profiles', { slug: profileSlug, data: initEpk, updated_at: new Date().toISOString() });

        // Register in user_profiles table
        if (USE_SUPABASE) {
          await sb('user_profiles', 'POST', {
            user_slug: userSlug,
            profile_slug: profileSlug,
            profile_type: profileType || 'creative',
            profile_name: profileName || 'My Profile',
            is_primary: false
          });
        }

        return ok({ success: true, profileSlug });
      }

      // ── DELETE PROFILE ──
      if (action === 'deleteProfile') {
        const { userSlug, profileSlug } = body;
        if (!userSlug || !profileSlug) return err('userSlug and profileSlug required');

        // Can't delete primary profile
        if (profileSlug === userSlug) return err('Cannot delete primary profile', 400);

        if (USE_SUPABASE) {
          await sbDelete('epk_profiles', { slug: profileSlug });
          await sbDelete('user_profiles', { user_slug: userSlug, profile_slug: profileSlug });
          // Delete all section data
          for (const table of ['credits','music_tracks','videos','photos','assets','awards']) {
            await sbDelete(table, { slug: profileSlug });
          }
        }

        return ok({ success: true });
      }

      return err('Unknown action');
    }

    return err('Method not allowed', 405);

  } catch (e) {
    console.error('EPK function error:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error', details: e.message }) };
  }
};
