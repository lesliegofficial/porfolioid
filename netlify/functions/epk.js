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
          const epkData = await migrateFromBlobs(slug);
          if (!epkData) return err('not found', 404);
          return ok({ success: true, epk: epkData });
        }
        return ok({ success: true, epk: profileRes.data[0].data });
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
        // PATCH was silently failing and causing data loss. Upsert always works.
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
            body: JSON.stringify({ slug, data, updated_at: new Date().toISOString() })
          }
        ).then(r => ({ ok: r.ok, status: r.status }));

        // Also write backup to Netlify Blobs so data survives Supabase hiccups
        try {
          const store = await getBlobs();
          if (store) await store.set(`epk:${slug}`, JSON.stringify(data));
        } catch(backupErr) {
          console.error('Blob backup failed (non-fatal):', backupErr.message);
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
