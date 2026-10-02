const { authRequest, requireAccount, requireOwner, samePassword } = require('./_shared/auth');
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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store',
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

      // Supabase Auth owns credentials and issues verifiable sessions.
      if (action === 'signup') {
        if (!USE_SUPABASE) return err('Authentication unavailable', 503);
        if (!/^[a-z0-9-]{1,60}$/.test(slug || '') || typeof body.email !== 'string' || !/^[^\s@,()]+@[^\s@,()]+\.[^\s@,()]+$/.test(body.email) || typeof body.password !== 'string' || body.password.length < 8) return err('Valid email, slug and password of at least 8 characters required');
        const email = body.email.trim().toLowerCase();
        const existing = await sbGet('users', `or=(slug.eq.${encodeURIComponent(slug)},email.eq.${encodeURIComponent(email)})&select=slug`);
        const profile = await sbGet('epk_profiles', `slug=eq.${encodeURIComponent(slug)}&select=slug`);
        if (!existing.ok || !profile.ok) return err('Account lookup unavailable', 503);
        if (existing.data.length || profile.data.length) return err('Account or profile already exists. Sign in instead.', 409);
        const signup = await authRequest('signup?redirect_to=https%3A%2F%2Fporfolioid.com%2Flogin.html', 'POST', { email, password: body.password });
        if (!signup.ok || !(signup.data.id || signup.data.user?.id)) return err('Unable to create account. Please try signing in or resetting your password.', 400);
        const userRes = await sbUpsert('users', { slug, email, password: 'supabase-auth:' + (signup.data.id || signup.data.user.id), first_name: body.firstName, last_name: body.lastName });
        if (!userRes.ok) return err('Account created but profile setup failed. Contact support.', 503);
        const initEpk = { ...(body.epk || {}), slug, name: `${body.firstName || ''} ${body.lastName || ''}`.trim() };
        const saved = await sbUpsert('epk_profiles', { slug, data: initEpk, updated_at: new Date().toISOString() });
        if (!saved.ok) return err('Account created but profile setup failed. Contact support.', 503);
        return ok({ success: true, session: signup.data.access_token ? signup.data : null, confirmationRequired: !signup.data.access_token,
          user: { slug, email, firstName: body.firstName, lastName: body.lastName } });
      }

      if (action === 'login') {
        if (!USE_SUPABASE || typeof body.email !== 'string' || typeof body.password !== 'string') return err('Invalid email or password', 401);
        const email = body.email.trim().toLowerCase();
        let login = await authRequest('token?grant_type=password', 'POST', { email, password: body.password });
        if (!login.ok && login.data.error_code === 'invalid_credentials') {
          // One-time migration: credentials must match the existing account.
          // Never claim an existing profile from sign-up metadata.
          const legacy = await sbGet('users', `email=eq.${encodeURIComponent(email)}&select=slug,password`);
          if (!legacy.ok) return err('Authentication unavailable', 503);
          if (legacy.data.length === 1 && samePassword(legacy.data[0].password, body.password)) {
            const created = await authRequest('admin/users', 'POST', { email, password: body.password, email_confirm: true });
            if (created.ok) login = await authRequest('token?grant_type=password', 'POST', { email, password: body.password });
          }
        }
        if (!login.ok || !login.data.access_token) return err('Invalid email or password', 401);
        const account = await requireAccount({ headers: { authorization: `Bearer ${login.data.access_token}` } });
        const cleared = await sbUpdate('users', { slug: account.slug }, { password: 'supabase-auth:' + login.data.user.id });
        if (!cleared.ok) return err('Account transition unavailable. Try again.', 503);
        return ok({ success: true, session: login.data, user: { slug: account.slug, email: account.email, firstName: account.first_name || '', lastName: account.last_name || '' } });
      }

      if (action === 'refreshSession') {
        if (typeof body.refreshToken !== 'string') return err('Sign in required', 401);
        const refreshed = await authRequest('token?grant_type=refresh_token', 'POST', { refresh_token: body.refreshToken });
        if (!refreshed.ok) return err('Sign in required', 401);
        return ok({ success: true, session: refreshed.data });
      }

      if (action === 'requestPasswordReset') {
        // Fixed trusted callback: never accept a browser-provided redirect.
        const reset = await authRequest('recover?redirect_to=https%3A%2F%2Fporfolioid.com%2Flogin.html', 'POST', { email: body.email }, undefined);
        if (!reset.ok && reset.status >= 500) return err('Email service unavailable', 503);
        return ok({ success: true });
      }

      if (action === 'session') {
        const account = await requireAccount(event);
        return ok({ success: true, user: { slug: account.slug, email: account.email, firstName: account.first_name || '', lastName: account.last_name || '' } });
      }
      if (action === 'logout') {
        await requireAccount(event);
        const token = (event.headers.authorization || event.headers.Authorization).slice(7);
        const result = await authRequest('logout', 'POST', undefined, token);
        if (!result.ok) return err('Sign out failed', 503);
        return ok({ success: true });
      }
      if (action === 'updatePassword') {
        await requireAccount(event);
        if (typeof body.password !== 'string' || body.password.length < 8) return err('Use at least 8 characters');
        const token = (event.headers.authorization || event.headers.Authorization).slice(7);
        const result = await authRequest('user', 'PUT', { password: body.password }, token);
        if (!result.ok) return err('Could not update password', 400);
        return ok({ success: true });
      }

      // Deny unknown write actions; validate identity AND ownership before using
      // the server's service key (which bypasses RLS).
      const protectedActions = ['save', 'saveSection', 'getAnalytics', 'listProfiles', 'createProfile', 'deleteProfile'];
      if (action === 'migrate') return err('Migration endpoint disabled', 403);
      if (protectedActions.includes(action)) {
        if (['listProfiles', 'createProfile', 'deleteProfile'].includes(action)) {
          const account = await requireAccount(event);
          if (body.userSlug !== account.slug) return err('Profile access denied', 403);
          if (action === 'deleteProfile') await requireOwner(event, body.profileSlug);
        } else {
          await requireOwner(event, slug);
        }
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
        // Protect photos, awards, assets, works from partial/accidental empty saves.
        // Narrow exception: a caller can explicitly confirm an empty array is
        // intentional (not an accidental/crashed save) by including the field
        // name in data.intentionallyEmpty. This is opt-in only — a normal save
        // with no such flag behaves exactly as before for all four fields,
        // including photos and awards. Added specifically to allow a one-time,
        // deliberate cleanup of the assets array without weakening the
        // existing protection for photos or awards.
        const intentionallyEmpty = Array.isArray(data.intentionallyEmpty) ? data.intentionallyEmpty : [];
        for (const field of ['photos', 'awards', 'assets', 'works']) {
          if (intentionallyEmpty.includes(field)) continue;
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
        // CANONICAL OBJECT — the single protected profile object written to
        // every destination below. Established once, after all preservation
        // and merge logic above has completed. No destination may receive
        // the original unprotected `data` after this point.
        const canonicalData = safeData;

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
            body: JSON.stringify({ slug, data: canonicalData, updated_at: new Date().toISOString() })
          }
        ).then(r => ({ ok: r.ok, status: r.status }));

        // Also write backup to Netlify Blobs so data survives Supabase hiccups
        try {
          const store = await getBlobs();
          if (store) await store.set(`epk:${slug}`, JSON.stringify(canonicalData));
        } catch(backupErr) {
          console.error('Blob backup failed (non-fatal):', backupErr.message);
        }

        // Also write backup to GitHub — permanent, never resets, survives everything
        try {
          const GITHUB_TOKEN = process.env.GITHUB_BACKUP_TOKEN;
          const GITHUB_REPO = process.env.GITHUB_BACKUP_REPO || 'lesliegofficial/porfolioid';
          if (GITHUB_TOKEN) {
            const backupPath = `_backups/${slug}-core.json`;
            // Use the same canonical object already written to Supabase above —
            // no re-fetch needed, and no fallback to the raw incoming `data`.
            const backupContent = JSON.stringify(canonicalData, null, 2);
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

        // Existing single-profile users may predate user_profiles. If they
        // create an additional profile, that new row can be the only registry
        // entry even though the original primary EPK still exists. Always
        // include the original user slug as the primary profile so the
        // dashboard switcher can never hide it.
        const profiles = Array.isArray(res.data) ? [...res.data] : [];
        const hasPrimary = profiles.some(p =>
          p.profile_slug === userSlug || p.is_primary === true
        );
        if (!hasPrimary) {
          profiles.unshift({
            user_slug: userSlug,
            profile_slug: userSlug,
            profile_type: 'primary',
            profile_name: 'Primary',
            is_primary: true
          });
        }
        return ok({ profiles });
      }

      // ── CREATE PROFILE ──
      if (action === 'createProfile') {
        const { userSlug, profileSlug, profileType, profileName } = body;
        if (typeof profileSlug !== 'string' || !/^[a-z0-9-]{1,60}$/.test(profileSlug)) return err('Valid profile slug required');
        if (!userSlug || !profileSlug) return err('userSlug and profileSlug required');

        // Ensure the original professional profile is registered before
        // adding a secondary profile. This keeps older single-profile
        // accounts compatible with the multi-profile switcher.
        if (USE_SUPABASE) {
          const primaryRes = await sbGet(
            'user_profiles',
            `user_slug=eq.${userSlug}&profile_slug=eq.${userSlug}&select=profile_slug`
          );
          if (primaryRes.ok && primaryRes.data.length === 0) {
            await sb('user_profiles', 'POST', {
              user_slug: userSlug,
              profile_slug: userSlug,
              profile_type: 'primary',
              profile_name: 'Primary',
              is_primary: true
            });
          }
        }

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
    if (!e.status) console.error('EPK function error:', e.message);
    return { statusCode: e.status || 500, headers, body: JSON.stringify({ error: e.status ? e.message : 'Server error' }) };
  }
};
