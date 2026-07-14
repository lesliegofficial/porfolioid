
// ── R2 UPLOAD SYSTEM ─────────────────────────────────────────
// Replaces Cloudinary. All new uploads go to Cloudflare R2
// via media-presign → direct R2 PUT → media-register → media-service
// No Cloudinary dependency. No hardcoded delivery URLs.
// ─────────────────────────────────────────────────────────────

// Convert filename to clean slug descriptor
// "Don Omar Chile Concert - Dec 2006.jpg" → "don-omar-chile-concert-dec-2006"
function filenameToDescriptor(filename) {
  const withoutExt = filename.replace(/\.[^/.]+$/, '');
  const slug = withoutExt
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || 'upload-' + Date.now();
}

// Show visible error in dashboard — no silent failures
function showUploadError(btn, originalText, message) {
  console.error('[Upload Error]', message);
  if (btn) {
    btn.textContent = '✗ ' + (message.length > 30 ? 'Upload failed' : message);
    btn.style.color = '#e07070';
    btn.disabled = false;
    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.color = '';
    }, 4000);
  }
}

// Core R2 upload pipeline
// file: File object
// category: 'photos' | 'videos' | 'audio' | 'thumbnails' | 'documents' | 'covers'
// onSuccess(deliveryUrl): called with the canonical media-service URL
// onError(message): called on any failure
async function uploadToR2(file, category, onSuccess, onError) {
  const slug = (currentUser && currentUser.slug) ? currentUser.slug : 'leslie-guerra';
  const descriptor = filenameToDescriptor(file.name);

  // Step 1: Compute SHA-256 in browser for duplicate detection
  let sha256Hash;
  try {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    sha256Hash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    onError('Could not compute file hash');
    return;
  }

  // Step 2: Get pre-signed upload URL from media-presign
  let presignData;
  try {
    const presignRes = await fetch('/.netlify/functions/media-presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName:   file.name,
        mimeType:   file.type,
        fileSize:   file.size,
        sha256Hash,
        slug,
        category,
        descriptor,
        isPublic:   true,
      })
    });
    if (!presignRes.ok) {
      const err = await presignRes.json().catch(() => ({}));
      onError(err.error || 'Presign request failed (' + presignRes.status + ')');
      return;
    }
    presignData = await presignRes.json();
  } catch (e) {
    onError('Network error during presign');
    return;
  }

  // Duplicate — file already in library, return existing URL
  if (presignData.duplicate) {
    try {
      const svcRes = await fetch(
        `/.netlify/functions/media-service?slug=${encodeURIComponent(slug)}&category=${encodeURIComponent(category)}&descriptor=${encodeURIComponent(descriptor)}`
      );
      if (svcRes.ok) {
        const svcData = await svcRes.json();
        if (svcData.url) { onSuccess(svcData.url); return; }
      }
      // Fallback: construct from storage_key
      onSuccess('https://media.porfolioid.com/' + presignData.storage_key);
    } catch(e) {
      onSuccess('https://media.porfolioid.com/' + presignData.storage_key);
    }
    return;
  }

  // Step 3: PUT file directly to R2 (browser → R2, no Netlify bandwidth)
  try {
    const uploadRes = await fetch(presignData.upload_url, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type }
    });
    if (!uploadRes.ok) {
      onError('R2 upload failed (' + uploadRes.status + ')');
      return;
    }
  } catch (e) {
    onError('Network error during R2 upload');
    return;
  }

  // Step 4: Register asset in Supabase via media-register
  let registerData;
  try {
    const registerRes = await fetch('/.netlify/functions/media-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storageKey:    presignData.storage_key,
        assetFamilyId: presignData.asset_family_id,
        version:       presignData.version,
        slug,
        category,
        descriptor,
        mimeType:      file.type,
        fileSize:      file.size,
        clientSha256:  sha256Hash,
        fileName:      file.name,
        isPublic:      true,
      })
    });
    if (!registerRes.ok) {
      const err = await registerRes.json().catch(() => ({}));
      onError(err.error || 'Registration failed (' + registerRes.status + ')');
      return;
    }
    registerData = await registerRes.json();
    if (!registerData.success) {
      onError('Registration returned failure');
      return;
    }
  } catch (e) {
    onError('Network error during registration');
    return;
  }

  // Step 5: Get canonical delivery URL from media-service
  try {
    const svcRes = await fetch(
      `/.netlify/functions/media-service?slug=${encodeURIComponent(slug)}&category=${encodeURIComponent(category)}&descriptor=${encodeURIComponent(descriptor)}`
    );
    if (svcRes.ok) {
      const svcData = await svcRes.json();
      if (svcData.url) { onSuccess(svcData.url); return; }
    }
  } catch(e) { /* fallback below */ }

  // Fallback: construct from storage_key if media-service unavailable
  onSuccess('https://media.porfolioid.com/' + presignData.storage_key);
}

// ── UPLOAD TRIGGER FUNCTIONS ──────────────────────────────────
// Same signatures as before — only internals changed

async function uploadToCloudinary(file, onSuccess) {
  // Kept for signature compatibility — now routes to R2
  const btn = (typeof event !== 'undefined' && event && event.currentTarget) ? event.currentTarget : null;
  const originalText = btn ? btn.textContent : '';
  if (btn) { btn.textContent = 'Uploading...'; btn.disabled = true; }
  await uploadToR2(file, 'photos',
    (url) => {
      onSuccess(url);
      if (btn) {
        btn.textContent = '✓ Uploaded';
        btn.style.background = 'rgba(100,200,100,0.15)';
        btn.style.borderColor = 'rgba(100,200,100,0.4)';
        btn.style.color = '#7ec97e';
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.background = '';
          btn.style.borderColor = '';
          btn.style.color = '';
          btn.disabled = false;
        }, 2000);
      }
    },
    (err) => showUploadError(btn, originalText, err)
  );
}

function triggerUpload(inputId, targetFieldId, previewCallback) {
  const input = document.getElementById(inputId);
  input.click();
  input.onchange = async function() {
    const file = input.files[0];
    if (!file) return;
    const btn = document.querySelector(`[onclick*="triggerUpload('${inputId}')"]`);
    const originalText = btn ? btn.textContent : '';
    if (btn) { btn.textContent = 'Uploading...'; btn.disabled = true; }
    await uploadToR2(file, 'photos',
      (url) => {
        document.getElementById(targetFieldId).value = url;
        // Call optional preview callback (e.g. updateHeroPreview, updateBioPreview)
        if (typeof previewCallback === 'function') previewCallback(url);
        if (btn) { btn.textContent = '✓ Uploaded'; btn.style.color = '#7ec97e'; setTimeout(() => { btn.textContent = originalText; btn.style.color = ''; btn.disabled = false; }, 2000); }
        // Intentionally no saveAll() here — upload only populates the field
        // and preview. Persisting is left to the existing explicit
        // "Save Changes" button in this panel (see dashboard.html), so a
        // media upload never triggers a broad full-profile save on its own.
      },
      (err) => showUploadError(btn, originalText, err)
    );
  };
}

function triggerMp4Upload(inputId) {
  const input = document.getElementById(inputId);
  input.click();
  input.onchange = async function() {
    const file = input.files[0];
    if (!file) return;
    const btn = document.querySelector(`[onclick="triggerMp4Upload('${inputId}')"]`);
    const originalText = btn ? btn.textContent : '↑ Upload MP4';
    if (btn) { btn.textContent = 'Uploading...'; btn.disabled = true; }
    await uploadToR2(file, 'videos',
      (url) => {
        document.getElementById('newVideoUrl').value = url;
        if (btn) { btn.textContent = '✓ Uploaded'; btn.style.color = '#7ec97e'; setTimeout(() => { btn.textContent = originalText; btn.style.color = ''; btn.disabled = false; }, 2000); }
      },
      (err) => showUploadError(btn, originalText, err)
    );
  };
}

function triggerThumbUpload(inputId) {
  const input = document.getElementById(inputId);
  input.click();
  input.onchange = async function() {
    const file = input.files[0];
    if (!file) return;
    const btn = document.querySelector(`[onclick="triggerThumbUpload('${inputId}')"]`);
    const originalText = btn ? btn.textContent : '↑ Upload Thumbnail';
    if (btn) { btn.textContent = 'Uploading...'; btn.disabled = true; }
    await uploadToR2(file, 'thumbnails',
      (url) => {
        document.getElementById('newVideoThumb').value = url;
        // Show live preview so user can confirm the right image was uploaded
        let preview = document.getElementById('videoThumbPreview');
        if (!preview) {
          preview = document.createElement('div');
          preview.id = 'videoThumbPreview';
          preview.style.cssText = 'margin-top:0.5rem';
          const thumbInput = document.getElementById('newVideoThumb');
          thumbInput.parentNode.insertBefore(preview, thumbInput.nextSibling);
        }
        preview.innerHTML = `<img src="${url}" style="width:160px;height:90px;object-fit:cover;border:2px solid rgba(126,201,126,0.5);margin-top:0.5rem;display:block"><div style="font-family:var(--font-mono);font-size:0.5rem;color:#7ec97e;margin-top:0.3rem">✓ Thumbnail uploaded — confirm this matches your video</div>`;
        if (btn) { btn.textContent = '✓ Uploaded'; btn.style.color = '#7ec97e'; setTimeout(() => { btn.textContent = originalText; btn.style.color = ''; btn.disabled = false; }, 2000); }
      },
      (err) => showUploadError(btn, originalText, err)
    );
  };
}

// PDF/Doc upload — routes through GitHub for public access (Cloudinary raw requires auth)
async function uploadPdfToGitHub(file, folder) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async function(e) {
      try {
        // Convert to base64
        const base64 = e.target.result.split(',')[1];
        const res = await fetch('/api/upload-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileData: base64, fileName: file.name, folder: folder || 'press' })
        });
        const data = await res.json();
        if (data.url) {
          resolve(data.url);
        } else {
          reject(new Error(data.error || 'Upload failed'));
        }
      } catch(err) { reject(err); }
    };
    reader.readAsDataURL(file);
  });
}

function triggerMp3Upload(inputId) {
  const input = document.getElementById(inputId);
  input.click();
  input.onchange = async function() {
    const file = input.files[0];
    if (!file) return;
    const btn = document.querySelector(`[onclick="triggerMp3Upload('${inputId}')"]`);
    const originalText = btn ? btn.textContent : '↑ Upload MP3';
    if (btn) { btn.textContent = 'Uploading...'; btn.disabled = true; }
    await uploadToR2(file, 'audio',
      (url) => {
        document.getElementById('newTrackLink').value = url;
        if (btn) { btn.textContent = '✓ Uploaded'; btn.style.color = '#7ec97e'; setTimeout(() => { btn.textContent = originalText; btn.style.color = ''; btn.disabled = false; }, 2000); }
      },
      (err) => showUploadError(btn, originalText, err)
    );
  };
}

function triggerPhotoUpload(inputId) {
  const input = document.getElementById(inputId);
  input.click();
  input.onchange = async function() {
    const file = input.files[0];
    if (!file) return;
    const btn = document.querySelector(`[onclick="triggerPhotoUpload('${inputId}')"]`);
    const originalText = btn ? btn.textContent : '↑ Upload Photo';
    if (btn) { btn.textContent = 'Uploading...'; btn.disabled = true; }
    await uploadToR2(file, 'photos',
      (url) => {
        document.getElementById('newPhotoUrl').value = url;
        if (btn) { btn.textContent = '✓ Done'; btn.style.color = '#7ec97e'; setTimeout(() => { btn.textContent = originalText; btn.style.color = ''; btn.disabled = false; }, 2000); }
      },
      (err) => showUploadError(btn, originalText, err)
    );
  };
}

let currentUser = null;
let epk = null;

async function init() {
  // Check session
  const sessionStr = localStorage.getItem('porfolioid_session');
  if (!sessionStr) { window.location.href = '/login.html'; return; }

  let session;
  try { session = JSON.parse(sessionStr); } catch { window.location.href = '/login.html'; return; }

  // Show loading state
  document.getElementById('topbarUser').textContent = 'Loading...';

  // Load EPK data from API
  try {
    const res = await fetch('/.netlify/functions/epk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'load', slug: session.slug })
    });
    const data = await res.json();

    if (data.success && data.epk) {
      epk = data.epk;
      window._epkData = epk; // sync immediately on load
      window.epk = epk;
      currentUser = { firstName: session.name.split(' ')[0], lastName: session.name.split(' ').slice(1).join(' '), email: session.email, slug: session.slug, epk };
    } else {
      // EPK not found - redirect to setup
      console.warn('EPK not found for slug:', session.slug, data);
      epk = createEmptyEPK(session.slug, session.name);
      window._epkData = epk;
      window.epk = epk;
      currentUser = { firstName: session.name.split(' ')[0], lastName: session.name.split(' ').slice(1).join(' '), email: session.email, slug: session.slug, epk };
    }
  } catch(err) {
    console.error('Failed to load EPK:', err);
    // Fall back to empty EPK
    epk = createEmptyEPK(session.slug, session.name);
    currentUser = { firstName: session.name.split(' ')[0], lastName: session.name.split(' ').slice(1).join(' '), email: session.email, slug: session.slug, epk };
  }

  document.getElementById('topbarUser').textContent = session.name;

  loadAllFields();

  // Phase 7 — load all profiles for this user
  activeProfileSlug = session.slug;
  initProfiles();
}

function createEmptyEPK(slug, name) {
  return {
    name, slug,
    taglines: [], stats: [{number:'',label:'Years Active'},{number:'',label:'Live Shows'},{number:'',label:'Credits'}],
    bio: '', location: '', availability: '', credentials: [],
    credits: [], tracks: [], videos: [], photos: [], assets: [],
    bookingEmail: '', bookingPhone: '', bookingTagline: '', bookingNote: '',
    bookingEnabled: true, heroImage: '', bioImage: '', socials: {}, awards: []
  };
}

function loadAllFields() {
  window._epkData = epk; // keep _epkData in sync with loaded epk
  // Hero
  const nameParts = (epk.name || '').split(' ');
  document.getElementById('heroFirstName').value = nameParts[0] || '';
  document.getElementById('heroLastName').value = nameParts.slice(1).join(' ') || '';
  document.getElementById('heroImage').value = epk.heroImage || '';
  if (epk.heroImage) {
    updateHeroPreview(epk.heroImage);
    const heroPosVal = epk.heroImagePosition || 0;
    const heroZoomVal = epk.heroImageZoom || 100;
    document.getElementById('heroPositionSlider').value = heroPosVal;
    document.getElementById('heroPositionValue').value = heroPosVal;
    document.getElementById('heroZoomSlider').value = heroZoomVal;
    document.getElementById('heroZoomValue').value = heroZoomVal;
    const heroCropVal = epk.heroImageCropTop || 0;
    document.getElementById('heroCropTopSlider').value = heroCropVal;
    document.getElementById('heroCropTopValue').value = heroCropVal;
    const heroImg = document.getElementById('heroPreviewImg');
    if (heroImg) {
      heroImg.style.objectFit = epk.heroImageFit || 'cover';
      heroImg.style.objectPosition = `center ${heroPosVal}%`;
    }
    updateHeroZoom(heroZoomVal);
  }

  const stats = epk.stats || [];
  if (stats[0]) { document.getElementById('stat1num').value = stats[0].number || ''; document.getElementById('stat1label').value = stats[0].label || ''; }
  if (stats[1]) { document.getElementById('stat2num').value = stats[1].number || ''; document.getElementById('stat2label').value = stats[1].label || ''; }
  if (stats[2]) { document.getElementById('stat3num').value = stats[2].number || ''; document.getElementById('stat3label').value = stats[2].label || ''; }

  renderTaglines();

  // Bio
  document.getElementById('bioText').value = epk.bioFull || epk.bio || '';
  document.getElementById('shortBioText').value = epk.shortBio || '';
  document.getElementById('bioLocation').value = epk.location || '';
  // availability loaded below
  document.getElementById('bioImage').value = epk.bioImage || '';
  if (epk.bioImage) {
    updateBioPreview(epk.bioImage);
    const posVal = epk.bioImagePosition || 0;
    const cropVal = epk.bioImageCropTop || 0;
    document.getElementById('bioCropTopSlider').value = cropVal;
    document.getElementById('bioCropTopValue').value = cropVal;
    if (cropVal > 0) updateBioCropTop(cropVal);
    document.getElementById('bioPositionSlider').value = posVal;
    document.getElementById('bioPositionValue').value = posVal;
    const zoomVal = epk.bioImageZoom || 100;
    document.getElementById('bioZoomSlider').value = zoomVal;
    document.getElementById('bioZoomValue').value = zoomVal;
    const img = document.getElementById('bioPreviewImg');
    if (img) {
      img.style.objectPosition = `center ${posVal}%`;
      updateBioZoom(zoomVal);
    }
  }
  renderCredentials();

  // Credits
  renderCredits();
  // Music
  renderTracks();
  // Videos
  renderVideos();
  // Photos
  renderPhotos();
  // Assets
  renderAssets();
  // Booking
  const PRESET_BOOKING_LABELS = ['Inquiries','Bookings','Contact Me','Get in Touch','Speaking Requests','Media Requests','Collaboration Requests','Consulting Requests'];
  const currentBookingLabel = epk.bookingLabel || 'Inquiries';
  if (PRESET_BOOKING_LABELS.includes(currentBookingLabel)) {
    document.getElementById('bookingLabel').value = currentBookingLabel;
    document.getElementById('bookingLabelCustomWrap').style.display = 'none';
  } else {
    document.getElementById('bookingLabel').value = 'custom';
    document.getElementById('bookingLabelCustom').value = currentBookingLabel;
    document.getElementById('bookingLabelCustomWrap').style.display = 'block';
  }
  document.getElementById('bookingEmail').value = epk.bookingEmail || '';
  document.getElementById('bookingPhone').value = epk.bookingPhone || '';
  document.getElementById('bookingTagline').value = epk.bookingTagline || '';
  document.getElementById('bookingNote').value = epk.bookingNote || '';
  document.getElementById('bookingAvailability').value = epk.bookingAvailability || '';
  document.getElementById('bookingRegion').value = epk.bookingRegion || '';
  document.getElementById('bookingAutoResponse').value = epk.bookingAutoResponse || '';
  const bcats = epk.bookingCategories || [];
  _selectedCategories = [...bcats];
  renderCategoryCardGroups();
  // Show/hide Other text input
  const bcatOtherInp = document.getElementById('bcat_other_input');
  if (bcatOtherInp) bcatOtherInp.style.display = bcats.includes('other') ? 'block' : 'none';
  loadBookingToggle();
  epk.assetsLocked = epk.assetsLocked !== undefined ? epk.assetsLocked : true;
  updateAssetsLockUI();
  setAssetsLayout(epk.assetsLayout || 'cards');

  // Availability dropdown
  const availSel = document.getElementById('availabilitySelect');
  if (availSel) availSel.value = epk.availability || '';

  // Socials
  loadSocials();

  // Awards
  renderAwards();

  // Identity Block
  loadIdentityBlock();

  // Gallery Layout
  loadGalleryLayout();

  // Video Layout
  loadVideoLayout();

  // Career Layout
  loadCareerLayout();

  // Resume
  renderResumeCards();
  const resumeToggle = document.getElementById('resumeToggle');
  if (resumeToggle) resumeToggle.checked = epk.resumeEnabled !== false;
}

function saveAll() {
  epk.name = `${document.getElementById('heroFirstName').value.trim()} ${document.getElementById('heroLastName').value.trim()}`.trim();
  epk.heroImage = document.getElementById('heroImage').value.trim();
  epk.heroImagePosition = parseInt(document.getElementById('heroPositionValue').value || 0);
  epk.heroImageZoom = parseInt(document.getElementById('heroZoomValue').value || 100);
  epk.heroImageCropTop = parseInt(document.getElementById('heroCropTopValue').value || 0);
  epk.heroImageFit = epk.heroImageFit || 'cover';
  epk.stats = [
    { number: document.getElementById('stat1num').value, label: document.getElementById('stat1label').value },
    { number: document.getElementById('stat2num').value, label: document.getElementById('stat2label').value },
    { number: document.getElementById('stat3num').value, label: document.getElementById('stat3label').value },
  ];
  epk.bioFull = document.getElementById('bioText').value.trim();
  epk.shortBio = document.getElementById('shortBioText').value.trim();
  epk.location = document.getElementById('bioLocation').value.trim();
  epk.availability = document.getElementById('availabilitySelect').value;
  epk.bioImage = document.getElementById('bioImage').value.trim();
  epk.bioImagePosition = parseInt(document.getElementById('bioPositionValue').value || 0);
  epk.bioImageCropTop = parseInt(document.getElementById('bioCropTopValue').value || 0);
  epk.bioImageZoom = parseInt(document.getElementById('bioZoomValue').value || 100);
  const bookingLabelSelect = document.getElementById('bookingLabel').value;
  epk.bookingLabel = bookingLabelSelect === 'custom'
    ? (document.getElementById('bookingLabelCustom').value.trim() || 'Inquiries')
    : bookingLabelSelect;
  epk.bookingEmail = document.getElementById('bookingEmail').value.trim();
  epk.bookingPhone = document.getElementById('bookingPhone').value.trim();
  epk.bookingTagline = document.getElementById('bookingTagline').value.trim();
  epk.bookingNote = document.getElementById('bookingNote').value.trim();
  epk.bookingAvailability = document.getElementById('bookingAvailability').value;
  epk.bookingRegion = document.getElementById('bookingRegion').value.trim();
  epk.bookingAutoResponse = document.getElementById('bookingAutoResponse').value.trim();
  epk.bookingCategories = [..._selectedCategories];

  persistUser();
  showSaveBanner();
}

async function persistUser() {
  currentUser.epk = epk;
  try {
    const session = JSON.parse(localStorage.getItem('porfolioid_session') || '{}');
    const slug = session.slug || epk.slug;
    if (!slug) return;

    // Separate large paginated arrays from core profile data
    const PAGINATED_SECTIONS = ['assets', 'awards']; // photos/credits/videos/tracks saved in core to preserve all fields
    const coreData = {};
    const sectionData = {};

    Object.entries(epk).forEach(([k, v]) => {
      if (PAGINATED_SECTIONS.includes(k) && Array.isArray(v)) {
        sectionData[k] = v;
      } else {
        coreData[k] = v;
      }
    });

    // Save core profile (always)
    const coreRes = await fetch('/.netlify/functions/epk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save', slug, data: coreData })
    });
    if (!coreRes.ok) console.error('Core save failed');

    // Save paginated sections — CRITICAL: never overwrite a section with empty
    // if memory is empty for that section, load current server data first to protect it
    const SAFE_SECTIONS = ['videos', 'assets', 'awards'];
    const sectionSaves = await Promise.all(Object.entries(sectionData).map(async ([section, items]) => {
      let finalItems = items;
      // If section appears empty in memory but is a critical section,
      // fetch current server data and use that instead of wiping it
      if ((!items || items.length === 0) && SAFE_SECTIONS.includes(section)) {
        try {
          const checkRes = await fetch('/.netlify/functions/epk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'load', slug })
          });
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            const serverItems = checkData.epk && checkData.epk[section];
            if (serverItems && serverItems.length > 0) {
              console.log(`PROTECTED: ${section} was empty in memory but has ${serverItems.length} items on server — keeping server data`);
              finalItems = serverItems;
              // Also restore in local epk object
              epk[section] = serverItems;
            }
          }
        } catch(e) {
          console.error(`Protection check failed for ${section}:`, e);
          return; // skip saving this section rather than wiping it
        }
      }
      if (!finalItems || finalItems.length === 0) return; // truly empty, skip

      // CRITICAL: For credits, always merge with server to preserve fullDesc/fullDescEs
      // These fields are not always in browser memory but must never be lost
      if (section === 'credits') {
        try {
          const serverRes = await fetch('/.netlify/functions/epk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'load', slug })
          });
          if (serverRes.ok) {
            const serverData = await serverRes.json();
            const serverCredits = serverData.epk && serverData.epk.credits;
            if (serverCredits && serverCredits.length > 0) {
              finalItems = finalItems.map(localCredit => {
                const serverCredit = serverCredits.find(sc =>
                  sc.company === localCredit.company || sc.artist === localCredit.company
                );
                if (serverCredit) {
                  return {
                    ...serverCredit,
                    ...localCredit,
                    // Always preserve these rich fields from server
                    fullDesc: localCredit.fullDesc || serverCredit.fullDesc || '',
                    fullDescEs: localCredit.fullDescEs || serverCredit.fullDescEs || '',
                    desc: localCredit.desc || serverCredit.desc || '',
                    descEs: localCredit.descEs || serverCredit.descEs || '',
                  };
                }
                return localCredit;
              });
              console.log('Credits merged with server data — fullDesc preserved');
            }
          }
        } catch(e) {
          console.error('Credits merge failed (non-fatal):', e);
        }
      }

      return fetch('/.netlify/functions/epk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'saveSection', slug, section, items: finalItems })
      }).catch(e => console.error(`Section save failed (${section}):`, e));
    }));

  } catch(err) {
    console.error('Save failed:', err);
  }
}


function showPanel(name) {
  // Warn if credit form is open with unsaved changes
  const creditForm = document.getElementById('addCreditForm');
  if (creditForm && creditForm.classList.contains('open')) {
    const titleEl = document.querySelector('#addCreditForm .add-form-title');
    const isEditing = titleEl && titleEl.textContent === 'Edit Credit';
    if (isEditing) {
      if (!confirm('You have unsaved changes in the credit form. Leave without saving?')) return;
      // Close the form without saving
      creditForm.classList.remove('open');
      editingCreditIdx = -1;
    }
  }
  if (name === 'qr') setTimeout(initQRPanel, 100);
  if (name === 'sections') setTimeout(initSectionsPanel, 100);
  if (name === 'careertype') setTimeout(initCareerTypePanel, 100);
  if (name === 'bio') setTimeout(loadSpanish, 300);
  if (name === 'analytics') setTimeout(() => loadAnalytics(currentAnalyticsDays || 30), 100);
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const panel = document.getElementById(`panel-${name}`);
  if (panel) panel.classList.add('active');
  if (event && event.currentTarget) event.currentTarget.classList.add('active');
}

// ── SECTION ORDER & VISIBILITY ──
const DEFAULT_SECTIONS = [
  { id: 'bio',     label: 'Career Profile', icon: '✦' },
  { id: 'credits', label: 'Credits',        icon: '🏆' },
  { id: 'photos',  label: 'Photos',         icon: '📸' },
  { id: 'videos',  label: 'Video',          icon: '🎬' },
  { id: 'music',   label: 'Music',          icon: '🎵' },
  { id: 'awards',  label: 'Awards',         icon: '🏅' },
  { id: 'assets',  label: 'Assets',         icon: '📦' },
  { id: 'connect', label: 'Connect Hub',    icon: '◎' },
];

function initSectionsPanel() {
  const epk = window._epkData || window.epk || {};
  const order = epk.sectionOrder || DEFAULT_SECTIONS.map(s => s.id);
  const visibility = epk.sectionVisibility || {};
  const list = document.getElementById('sectionsOrderList');
  if (!list) return;

  // Build ordered list — preserve every saved section ID, including ones
  // not present in DEFAULT_SECTIONS (e.g. future or legacy sections),
  // instead of silently dropping them via .filter(Boolean). Known IDs get
  // their canonical label/icon; unknown IDs get a safe fallback label so
  // they stay visible in the editor and are never lost on the next save.
  // Duplicate IDs are removed safely (first occurrence wins).
  const seen = new Set();
  const ordered = [];
  order.forEach(id => {
    if (seen.has(id)) return;
    seen.add(id);
    const known = DEFAULT_SECTIONS.find(s => s.id === id);
    ordered.push(known || { id, label: id.charAt(0).toUpperCase() + id.slice(1), icon: '•' });
  });
  // Append any default sections missing from the saved order (e.g. newly
  // introduced sections) exactly once each.
  DEFAULT_SECTIONS.forEach(s => {
    if (!seen.has(s.id)) { ordered.push(s); seen.add(s.id); }
  });

  list.innerHTML = ordered.map((s, i) => {
    const visible = visibility[s.id] !== false;
    return `
    <div class="section-order-item" draggable="true" data-id="${s.id}" data-index="${i}"
      style="display:flex;align-items:center;gap:1rem;padding:1rem 1.25rem;margin-bottom:0.5rem;background:var(--dark-2);border:1px solid rgba(201,168,76,0.15);cursor:grab;border-left:3px solid ${visible ? 'var(--gold)' : 'rgba(255,255,255,0.1)'}">
      <span style="color:rgba(255,255,255,0.3);font-size:1.2rem;cursor:grab;letter-spacing:-2px">⠿⠿</span>
      <span style="font-size:1.1rem">${s.icon}</span>
      <span style="font-family:var(--font-display);font-size:1rem;font-weight:600;color:var(--white);flex:1">${s.label}</span>
      <button onclick="toggleSectionVisibility('${s.id}', this)" 
        style="background:none;border:1px solid rgba(255,255,255,0.15);color:${visible ? 'var(--gold)' : 'rgba(255,255,255,0.3)'};padding:0.35rem 0.75rem;cursor:pointer;font-size:0.85rem;transition:all 0.2s"
        title="${visible ? 'Hide section' : 'Show section'}">
        ${visible ? '👁 Visible' : '🚫 Hidden'}
      </button>
    </div>`;
  }).join('');

  // Add drag-and-drop
  initDragDrop();
}

function toggleSectionVisibility(id, btn) {
  const epk = window._epkData || {};
  if (!epk.sectionVisibility) epk.sectionVisibility = {};
  const current = epk.sectionVisibility[id] !== false;
  epk.sectionVisibility[id] = !current;
  window._epkData = epk;
  // Update button
  const item = btn.closest('.section-order-item');
  btn.textContent = !current ? '👁 Visible' : '🚫 Hidden';
  btn.style.color = !current ? 'var(--gold)' : 'rgba(255,255,255,0.3)';
  item.style.borderLeftColor = !current ? 'var(--gold)' : 'rgba(255,255,255,0.1)';
}

function initDragDrop() {
  const list = document.getElementById('sectionsOrderList');
  if (!list) return;
  let dragSrc = null;
  let placeholder = null;

  function getItems() { return [...list.querySelectorAll('.section-order-item')]; }

  function createPlaceholder() {
    const ph = document.createElement('div');
    ph.id = 'drag-placeholder';
    ph.style.cssText = 'height:60px;margin-bottom:0.5rem;border:2px dashed var(--gold);background:rgba(201,168,76,0.05);border-radius:2px;transition:all 0.15s';
    return ph;
  }

  function removePlaceholder() {
    const ph = document.getElementById('drag-placeholder');
    if (ph) ph.remove();
  }

  function updateOrder() {
    const newOrder = getItems().map(el => el.dataset.id);
    if (!window._epkData) window._epkData = {};
    window._epkData.sectionOrder = newOrder;
  }

  list.addEventListener('dragstart', e => {
    const item = e.target.closest('.section-order-item');
    if (!item) return;
    dragSrc = item;
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => { item.style.opacity = '0.4'; }, 0);
    placeholder = createPlaceholder();
  });

  list.addEventListener('dragend', e => {
    const item = e.target.closest('.section-order-item');
    if (item) item.style.opacity = '1';
    removePlaceholder();
    dragSrc = null;
  });

  list.addEventListener('dragover', e => {
    e.preventDefault();
    if (!dragSrc || !placeholder) return;
    const target = e.target.closest('.section-order-item');
    if (!target || target === dragSrc) return;
    const rect = target.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    removePlaceholder();
    if (e.clientY < midY) {
      list.insertBefore(placeholder, target);
    } else {
      list.insertBefore(placeholder, target.nextSibling);
    }
  });

  list.addEventListener('drop', e => {
    e.preventDefault();
    if (!dragSrc || !placeholder) return;
    list.insertBefore(dragSrc, placeholder);
    removePlaceholder();
    dragSrc.style.opacity = '1';
    updateOrder();
    dragSrc = null;
  });
}

async function saveSectionSettings() {
  // Use both window._epkData and module-level epk, whichever is available
  const epkData = window._epkData || epk;
  if (!epkData) return;
  // Read current order from DOM
  const items = document.querySelectorAll('.section-order-item');
  epkData.sectionOrder = [...items].map(el => el.dataset.id);
  // Sync visibility from current _epkData if available
  if (window._epkData && window._epkData.sectionVisibility) {
    epkData.sectionVisibility = window._epkData.sectionVisibility;
  }
  // Keep both references in sync
  window._epkData = epkData;

  const slug = currentUser?.slug;
  if (!slug) { showToast('Could not find portfolio slug'); return; }

  try {
    const res = await fetch('/.netlify/functions/epk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save', slug, data: epkData })
    });
    if (res.ok) showToast('Section order saved ✓');
    else showToast('Save failed — try again');
  } catch(e) { showToast('Error saving — try again'); }
}

function toggleAddForm(id) {
  const form = document.getElementById(id);
  form.classList.toggle('open');
}

// ── DRAFT AUTO-SAVE SYSTEM ──────────────────────────────────────
// Saves every keystroke to localStorage. Restored on form open.
// Cleared only on successful save. Survives refresh, navigation, crashes.

const DRAFT_FIELDS = {
  addCreditForm: [
    'newCreditArtist','newCreditYears','newCreditCategory','newCreditHighlightTag','newCreditContractType',
    'newCreditRole','newCreditProjectType','newCreditDesc','newCreditFullDesc',
    'newCreditFullDescEs','newCreditProofLink',
    { id:'newCreditVisible', type:'checkbox' },
    { id:'newCreditVerified', type:'checkbox' },
    { id:'newCreditPinned', type:'checkbox' }
  ],
  addPhotoForm: [
    'newPhotoCaption','newPhotoUrl','newPhotoGroup','newPhotoDesc',
    'newPhotoYear','newPhotoDate','newPhotoLocation','newPhotoPeople',
    'newPhotoTags','newPhotoCredit','newPhotoCategory','newPhotoCareerPhase',
    'newPhotoMediaType','newPhotoAchievement',
    { id:'newPhotoFeatured', type:'checkbox' },
    { id:'newPhotoCollectionCover', type:'checkbox' }
  ]
};

function draftKey(formId, idx) {
  return `porfolioid_draft_${formId}_${idx >= 0 ? idx : 'new'}`;
}

function saveDraft(formId, idx) {
  const fields = DRAFT_FIELDS[formId];
  if (!fields) return;
  const draft = {};
  fields.forEach(f => {
    const fieldId = typeof f === 'string' ? f : f.id;
    const isCheckbox = typeof f === 'object' && f.type === 'checkbox';
    const el = document.getElementById(fieldId);
    if (el) draft[fieldId] = isCheckbox ? el.checked : el.value;
  });
  localStorage.setItem(draftKey(formId, idx), JSON.stringify(draft));
}

function restoreDraft(formId, idx) {
  const key = draftKey(formId, idx);
  const raw = localStorage.getItem(key);
  if (!raw) return false;
  try {
    const draft = JSON.parse(raw);
    const fields = DRAFT_FIELDS[formId];
    if (!fields) return false;
    let restored = false;
    fields.forEach(f => {
      const fieldId = typeof f === 'string' ? f : f.id;
      const isCheckbox = typeof f === 'object' && f.type === 'checkbox';
      const el = document.getElementById(fieldId);
      if (el && draft[fieldId] !== undefined) {
        if (isCheckbox) el.checked = draft[fieldId];
        else el.value = draft[fieldId];
        restored = true;
      }
    });
    return restored;
  } catch(e) { return false; }
}

function clearDraft(formId, idx) {
  localStorage.removeItem(draftKey(formId, idx));
}

function attachDraftListeners(formId, getIdx) {
  const fields = DRAFT_FIELDS[formId];
  if (!fields) return;
  fields.forEach(f => {
    const fieldId = typeof f === 'string' ? f : f.id;
    const isCheckbox = typeof f === 'object' && f.type === 'checkbox';
    const el = document.getElementById(fieldId);
    if (!el) return;
    const evt = isCheckbox ? 'change' : 'input';
    el.addEventListener(evt, () => saveDraft(formId, getIdx()));
  });
}

function showDraftBanner(formId) {
  const form = document.getElementById(formId);
  if (!form) return;
  let banner = form.querySelector('.draft-restored-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.className = 'draft-restored-banner';
    banner.innerHTML = '⚡ Draft restored — your previous work was recovered. <button onclick="this.parentElement.remove()">✕</button>';
    form.insertBefore(banner, form.firstChild);
  }
}

// Wire up draft listeners after DOM loads
document.addEventListener('DOMContentLoaded', () => {
  attachDraftListeners('addCreditForm', () => editingCreditIdx);
  attachDraftListeners('addPhotoForm', () => editingPhotoIdx);
});

function renderTaglines() {
  const container = document.getElementById('taglinesList');
  container.innerHTML = '';
  (epk.taglines || []).forEach((t, i) => {
    const tag = document.createElement('div');
    tag.className = 'tag';
    tag.innerHTML = `${t} <button class="tag-remove" onclick="removeTagline(${i})">×</button>`;
    container.appendChild(tag);
  });
}
function addTagline() {
  const val = document.getElementById('newTagline').value.trim();
  if (!val) return;
  epk.taglines = epk.taglines || [];
  epk.taglines.push(val);
  document.getElementById('newTagline').value = '';
  renderTaglines(); persistUser(); showSaveBanner();
}
function removeTagline(i) { epk.taglines.splice(i, 1); renderTaglines(); persistUser(); showSaveBanner(); }
document.getElementById('newTagline').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addTagline(); } });

// CREDENTIALS
function renderCredentials() {
  const container = document.getElementById('credentialsList');
  container.innerHTML = '';
  (epk.credentials || []).forEach((c, i) => {
    const tag = document.createElement('div');
    tag.className = 'tag';
    tag.innerHTML = `${c} <button class="tag-remove" onclick="removeCredential(${i})">×</button>`;
    container.appendChild(tag);
  });
}
function addCredential() {
  const val = document.getElementById('newCredential').value.trim();
  if (!val) return;
  epk.credentials = epk.credentials || [];
  epk.credentials.push(val);
  document.getElementById('newCredential').value = '';
  renderCredentials(); persistUser(); showSaveBanner();
}
function removeCredential(i) { epk.credentials.splice(i, 1); renderCredentials(); persistUser(); showSaveBanner(); }
document.getElementById('newCredential').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addCredential(); } });


// CREDITS
let editingCreditIdx = -1;

function setAssetsLayout(layout) {
  epk.assetsLayout = layout;
  ['cards','list','compact','table','featured'].forEach(l => {
    const btn = document.getElementById('alayout_' + l);
    if (btn) btn.style.background = l === layout ? 'var(--gold)' : 'rgba(255,255,255,0.04)';
    if (btn) btn.style.color = l === layout ? 'var(--black)' : 'var(--gray)';
  });
  persistUser(); showSaveBanner();
}

function toggleAssetsLock() {
  const before = epk.assetsLocked;
  console.log('[assetsLocked toggle] BEFORE click:', before, '(type:', typeof before + ')');

  epk.assetsLocked = !epk.assetsLocked;
  const after = epk.assetsLocked;
  console.log('[assetsLocked toggle] AFTER click (in-memory epk object):', after, '(type:', typeof after + ')');
  console.log('[assetsLocked toggle] Value about to be sent to persistUser():', epk.assetsLocked);

  updateAssetsLockUI();
  persistUser().then(function(result) {
    console.log('[assetsLocked toggle] persistUser() resolved. Return value:', result);
    console.log('[assetsLocked toggle] epk.assetsLocked immediately after save completes:', epk.assetsLocked);
    console.log('[assetsLocked toggle] Full epk object snapshot after save:', JSON.parse(JSON.stringify(epk)));
  }).catch(function(err) {
    console.error('[assetsLocked toggle] persistUser() FAILED:', err);
  });
  showSaveBanner();
}

function updateAssetsLockUI() {
  const locked = epk.assetsLocked;
  const track = document.getElementById('assetsLockTrack');
  const thumb = document.getElementById('assetsLockThumb');
  const label = document.getElementById('assetsLockLabel');
  const toggleLabel = document.getElementById('assetsLockToggleLabel');
  if (!track) return;
  if (locked) {
    track.style.background = '#333';
    thumb.style.left = '3px';
    label.textContent = '🔒 Assets Locked: ON — visitors must request access';
    toggleLabel.textContent = 'Locked';
  } else {
    track.style.background = 'var(--gold)';
    thumb.style.left = '23px';
    label.textContent = '🔓 Assets Locked: OFF — visitors can preview/download';
    toggleLabel.textContent = 'Unlocked';
  }
}

function toggleCreditCategoryOther(sel) {
  const other = document.getElementById('newCreditCategoryOther');
  if (other) other.style.display = sel.value === 'Other' ? 'block' : 'none';
}

function moveItem(section, idx, direction) {
  const arr = epk[section] || [];
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= arr.length) return;
  const temp = arr[idx];
  arr[idx] = arr[newIdx];
  arr[newIdx] = temp;
  epk[section] = arr;
  if (section === 'credits') renderCredits();
  else if (section === 'tracks') renderTracks();
  else if (section === 'videos') renderVideos();
  else if (section === 'photos') renderPhotos();
  persistUser(); showSaveBanner();
}

function renderCredits() {
  const container = document.getElementById('creditsList');
  container.innerHTML = '';
  const credits = epk.credits || [];
  // Sort: pinned first
  const sorted = credits.map((c,i) => ({...c, _origIdx: i}));
  sorted.forEach((c) => {
    const i = c._origIdx;
    const photos = c.photos || [];
    // Show count only — clicking expands to show photos (prevents lag with many photos)
    const photosHTML = photos.length ? `
      <div>
        <button onclick="toggleCreditPhotos(${i})" style="font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--gold);background:none;border:1px solid rgba(201,168,76,0.2);padding:0.25rem 0.6rem;cursor:pointer;margin-top:0.5rem">
          📷 ${photos.length} Photo${photos.length>1?'s':''} — Click to View
        </button>
        <div id="creditPhotos_${i}" style="display:none;flex-wrap:wrap;gap:0.5rem;margin-top:0.5rem">
          ${photos.map((url, pi) => `
          <div draggable="true" ondragstart="dragSavedPhoto(event,${i},${pi})" ondragover="event.preventDefault()" ondrop="dropSavedPhoto(event,${i},${pi})" style="position:relative;display:inline-block;cursor:grab">
            <img class="credit-photo-thumb" src="${url}" alt="Credit photo" loading="lazy" onerror="this.style.display='none'">
            <button onclick="removeCreditPhoto(${i},${pi})" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,0.7);border:none;color:#fff;font-size:0.6rem;cursor:pointer;padding:1px 4px;line-height:1">✕</button>
          </div>`).join('')}
        </div>
      </div>` : '';
    const badges = [
      c.pinned ? '<span style="font-family:var(--font-mono);font-size:0.5rem;background:rgba(201,168,76,0.15);color:var(--gold);padding:0.15rem 0.5rem;letter-spacing:0.1em">📌 PINNED</span>' : '',
      c.verified ? '<span style="font-family:var(--font-mono);font-size:0.5rem;background:rgba(100,200,100,0.12);color:#7ec97e;padding:0.15rem 0.5rem;letter-spacing:0.1em">✦ VERIFIED</span>' : '',
      c.visible === false ? '<span style="font-family:var(--font-mono);font-size:0.5rem;background:rgba(255,100,100,0.1);color:#ff6b6b;padding:0.15rem 0.5rem;letter-spacing:0.1em">HIDDEN</span>' : '',
      c.category ? `<span style="font-family:var(--font-mono);font-size:0.5rem;background:rgba(201,168,76,0.08);color:var(--gray);padding:0.15rem 0.5rem;letter-spacing:0.1em">${c.category}</span>` : '',
    ].filter(Boolean).join(' ');
    container.innerHTML += `
      <div class="editable-card" style="${c.visible===false?'opacity:0.5':''}">
        <div class="editable-card-header">
          <div style="display:flex;flex-direction:column;gap:0.2rem;margin-right:0.75rem">
            <button class="btn-card-action" onclick="moveItem('credits',${i},-1)" ${i===0?'disabled':''} style="padding:0.15rem 0.4rem;font-size:0.65rem;line-height:1">▲</button>
            <button class="btn-card-action" onclick="moveItem('credits',${i},1)" ${i===(credits.length-1)?'disabled':''} style="padding:0.15rem 0.4rem;font-size:0.65rem;line-height:1">▼</button>
          </div>
          <div style="flex:1">
            <div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.3rem">${badges}</div>
            <div class="editable-card-title">${c.company || c.artist || c.title || ''}</div>
            <div class="editable-card-subtitle">${c.role}${c.years ? ' · ' + c.years : ''}${c.contractType ? ' · ' + c.contractType : ''}</div>
            ${c.collaborators?.length ? `<div style="font-family:var(--font-mono);font-size:0.55rem;color:var(--gray);margin-top:0.2rem;letter-spacing:0.08em">w/ ${c.collaborators.join(', ')}</div>` : ''}
            <p style="font-size:0.85rem;color:var(--gray);line-height:1.6;margin:0.3rem 0 0;white-space:pre-line">${c.desc || ''}</p>
            ${photosHTML}
            ${photos.length < 50 ? `
            <div style="margin-top:0.5rem">
              <input type="file" id="creditPhotoInput_${i}" accept="image/*" multiple style="display:none">
              <button class="credit-photo-add-btn" onclick="addPhotosToCredit(${i})">+ Add Photos</button>
            </div>` : ''}
          </div>
          <div class="card-actions">
            <button class="btn-card-action" onclick="editCredit(${i})">Edit</button>
            <button class="btn-card-action btn-card-delete" onclick="removeCredit(${i})">Delete</button>
          </div>
        </div>
      </div>`;
  });
}
function toggleCreditPhotos(i) {
  const el = document.getElementById('creditPhotos_' + i);
  if (!el) return;
  el.style.display = el.style.display === 'none' ? 'flex' : 'none';
}

function editCredit(i) {
  editingCreditIdx = i;
  const c = epk.credits[i];
  document.getElementById('newCreditArtist').value = c.company || c.artist || '';
  document.getElementById('newCreditYears').value = c.years || '';
  document.getElementById('newCreditCategory').value = c.category || '';
  if (document.getElementById('newCreditHighlightTag')) document.getElementById('newCreditHighlightTag').value = c.highlightTag || '';
  document.getElementById('newCreditContractType').value = c.contractType || '';
  document.getElementById('newCreditRole').value = c.role || '';
  document.getElementById('newCreditProjectType').value = c.projectType || '';
  document.getElementById('newCreditDesc').value = c.desc || '';
  document.getElementById('newCreditFullDesc').value = c.fullDesc || '';
  if (document.getElementById('newCreditFullDescEs')) document.getElementById('newCreditFullDescEs').value = c.fullDescEs || '';
  pendingCreditMedia = c.mediaItems || (c.mediaLink ? [{type:'link', url:c.mediaLink, label:c.mediaLabel||''}] : []);
  if (c.videoUrl && !pendingCreditMedia.find(m => m.url === c.videoUrl)) pendingCreditMedia.push({type:'video', url:c.videoUrl, label:''});
  pendingCreditMediaLayout = c.mediaLayout || 'grid';
  renderCreditMediaList();
  document.getElementById('newCreditProofLink').value = c.proofLink || '';
  document.getElementById('newCreditVisible').checked = c.visible !== false;
  document.getElementById('newCreditVerified').checked = c.verified || false;
  document.getElementById('newCreditPinned').checked = c.pinned || false;
  pendingCreditCollaborators = [...(c.collaborators || [])];
  renderCreditCollaborators();
  // Restore press items
  pendingPressItems = [...(c.press || [])];
  renderPressItems();
  // Restore photos preview
  pendingCreditPhotos = [...(c.photos || [])];
  renderCreditPhotosPreview();
  document.getElementById('addCreditForm').classList.add('open');
  document.getElementById('addCreditForm').scrollIntoView({ behavior: 'smooth' });
  document.querySelector('#addCreditForm .add-form-title').textContent = 'Edit Credit';
  // Restore any unsaved draft for this credit
  if (restoreDraft('addCreditForm', i)) showDraftBanner('addCreditForm');
}
let pendingCreditPhotos = [];
function renderCreditPhotosPreview() {
  const preview = document.getElementById('creditPhotosPreview');
  if (!preview) return;
  preview.innerHTML = pendingCreditPhotos.map((url, i) => `
    <div draggable="true" data-index="${i}" ondragstart="dragCreditPhoto(event,${i})" ondragover="event.preventDefault()" ondrop="dropCreditPhoto(event,${i})" style="position:relative;display:inline-block;cursor:grab;opacity:1;transition:opacity 0.2s">
      <img src="${url}" style="width:70px;height:52px;object-fit:cover;border:1px solid rgba(201,168,76,0.3);display:block" onerror="this.style.display='none'">
      <button onclick="pendingCreditPhotos.splice(${i},1);renderCreditPhotosPreview()" style="position:absolute;top:1px;right:1px;background:rgba(0,0,0,0.75);border:none;color:#fff;font-size:0.55rem;cursor:pointer;padding:1px 3px;line-height:1">✕</button>
      <div style="text-align:center;font-size:0.5rem;color:var(--gray);font-family:var(--font-mono);margin-top:2px">⠿ drag</div>
    </div>`).join('');
}
let draggedCreditPhotoIdx = null;
function dragCreditPhoto(e, i) {
  draggedCreditPhotoIdx = i;
  e.dataTransfer.effectAllowed = 'move';
}
function dropCreditPhoto(e, i) {
  e.preventDefault();
  if (draggedCreditPhotoIdx === null || draggedCreditPhotoIdx === i) return;
  const moved = pendingCreditPhotos.splice(draggedCreditPhotoIdx, 1)[0];
  pendingCreditPhotos.splice(i, 0, moved);
  draggedCreditPhotoIdx = null;
  renderCreditPhotosPreview();
}
let draggedCreditMediaIdx = null;
function dragCreditMedia(e, i) {
  draggedCreditMediaIdx = i;
  e.dataTransfer.effectAllowed = 'move';
}
function dropCreditMedia(e, i) {
  e.preventDefault();
  if (draggedCreditMediaIdx === null || draggedCreditMediaIdx === i) return;
  const moved = pendingCreditMedia.splice(draggedCreditMediaIdx, 1)[0];
  pendingCreditMedia.splice(i, 0, moved);
  draggedCreditMediaIdx = null;
  renderCreditMediaList();
}
function triggerCreditPhotoUpload() {
  const input = document.getElementById('creditPhotoInput');
  input.value = '';
  input.click();
  input.onchange = async function() {
    const files = Array.from(input.files);
    for (const file of files) {
      await uploadToR2(file, 'credits',
        (url) => { pendingCreditPhotos.push(url); renderCreditPhotosPreview(); },
        (err) => { console.error('Credit photo upload failed:', err); alert('Upload failed: ' + err); }
      );
    }
  };
}
function browseCloudinaryForm() {
  const existing = document.getElementById('cloudinaryBrowserForm');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'cloudinaryBrowserForm';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center';
  const FOLDERS = ['don-omar','j-alvarez','las-nenas','melina-leon','sony-music-latin','arrow-management','nv-marketing','fema','venetian-productions','urban-latino','adam-torres','video-thumbs','gallery','resume','bio-photo','hero-photo','awards-degrees','delete-me'];
  overlay.innerHTML = `
    <div style="background:#141414;border:1px solid rgba(201,168,76,0.3);padding:1.5rem;width:680px;max-height:80vh;overflow-y:auto;position:relative">
      <button onclick="document.getElementById('cloudinaryBrowserForm').remove()" style="position:absolute;top:0.75rem;right:0.75rem;background:none;border:none;color:#888;font-size:1rem;cursor:pointer">✕ Close</button>
      <div style="font-family:'Courier Prime',monospace;font-size:0.6rem;letter-spacing:0.15em;color:var(--gold);text-transform:uppercase;margin-bottom:1rem">☁ Cloudinary — Browse Folder</div>
      <div id="cldrform-folders" style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-bottom:1rem"></div>
      <div id="cldrform-photos" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:0.5rem"></div>
      <div id="cldrform-status" style="font-size:0.75rem;color:#888;margin-top:0.5rem">Select a folder to browse photos</div>
      <button id="cldrform-add-btn" onclick="addSelectedFromCloudinaryForm()" style="display:none;margin-top:1rem;padding:0.5rem 1.5rem;background:rgba(201,168,76,0.15);border:1px solid rgba(201,168,76,0.4);color:var(--gold);font-family:'Courier Prime',monospace;font-size:0.6rem;letter-spacing:0.1em;cursor:pointer;text-transform:uppercase">+ Add Selected to Credit</button>
    </div>`;
  document.body.appendChild(overlay);
  const foldersEl = document.getElementById('cldrform-folders');
  FOLDERS.forEach(f => {
    const btn = document.createElement('button');
    btn.textContent = f;
    btn.style.cssText = 'font-family:"Courier Prime",monospace;font-size:0.55rem;letter-spacing:0.08em;padding:0.25rem 0.6rem;background:rgba(201,168,76,0.06);border:1px solid rgba(201,168,76,0.2);color:#aaa;cursor:pointer;text-transform:uppercase';
    btn.onclick = () => loadCloudinaryFolderForm(f);
    foldersEl.appendChild(btn);
  });
}
window._cldrFormSelected = {};
async function loadCloudinaryFolderForm(folder) {
  window._cldrFormSelected = {};
  const photosEl = document.getElementById('cldrform-photos');
  const statusEl = document.getElementById('cldrform-status');
  const addBtn = document.getElementById('cldrform-add-btn');
  photosEl.innerHTML = '<div style="color:#888;font-size:0.75rem;grid-column:1/-1">Loading...</div>';
  addBtn.style.display = 'none';
  try {
    const res = await fetch(`/.netlify/functions/cloudinary-browse?folder=${encodeURIComponent(folder)}`);
    const data = await res.json();
    const images = data.resources || [];
    if (!images.length) { photosEl.innerHTML = '<div style="color:#888;font-size:0.75rem;grid-column:1/-1">No images in this folder yet.</div>'; statusEl.textContent = `0 images in "${folder}"`; return; }
    statusEl.textContent = `${images.length} image${images.length>1?'s':''} in "${folder}" — click to select`;
    photosEl.innerHTML = images.map(img => `
      <div id="cldrform_${img.public_id.replace(/[^a-z0-9]/gi,'_')}" onclick="toggleCldrFormSelect('${img.public_id}','${img.secure_url}')" style="cursor:pointer;border:2px solid transparent">
        <img src="${img.secure_url.replace('/upload/','/upload/w_150,h_150,c_fill,f_jpg/')}" style="width:100%;height:90px;object-fit:cover;display:block" onerror="this.style.opacity='0.3'">
        <div style="font-size:9px;color:#666;padding:2px 4px;font-family:monospace;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${img.public_id.split('/').pop()}</div>
      </div>`).join('');
  } catch(e) { photosEl.innerHTML = '<div style="color:#ff6b6b;font-size:0.75rem;grid-column:1/-1">Error loading folder.</div>'; }
}
function toggleCldrFormSelect(publicId, secureUrl) {
  const safeId = 'cldrform_' + publicId.replace(/[^a-z0-9]/gi,'_');
  const el = document.getElementById(safeId);
  if (window._cldrFormSelected[publicId]) { delete window._cldrFormSelected[publicId]; el.style.border = '2px solid transparent'; el.style.background = 'none'; }
  else { window._cldrFormSelected[publicId] = secureUrl; el.style.border = '2px solid var(--gold)'; el.style.background = 'rgba(201,168,76,0.1)'; }
  const count = Object.keys(window._cldrFormSelected).length;
  const addBtn = document.getElementById('cldrform-add-btn');
  addBtn.style.display = count > 0 ? 'block' : 'none';
  addBtn.textContent = `+ Add ${count} Photo${count>1?'s':''} to Credit`;
}
function addSelectedFromCloudinaryForm() {
  const urls = Object.values(window._cldrFormSelected);
  if (!urls.length) return;
  urls.forEach(url => pendingCreditPhotos.push(url));
  renderCreditPhotosPreview();
  document.getElementById('cloudinaryBrowserForm').remove();
  window._cldrFormSelected = {};
}
async function addPhotosToCredit(i) {
  const input = document.getElementById(`creditPhotoInput_${i}`);
  input.value = '';
  input.click();
  input.onchange = async function() {
    const files = Array.from(input.files);
    for (const file of files) {
      await uploadToR2(file, 'credits',
        (url) => {
          epk.credits[i].photos = epk.credits[i].photos || [];
          epk.credits[i].photos.push(url);
          renderCredits(); persistUser(); showSaveBanner();
        },
        (err) => { console.error('Credit photo upload failed:', err); alert('Upload failed: ' + err); }
      );
    }
  };
}
async function browseCloudinary(creditIdx) {
  // Remove any existing popup
  const existing = document.getElementById('cloudinaryBrowser');
  if (existing) existing.remove();

  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = 'cloudinaryBrowser';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center';

  overlay.innerHTML = `
    <div style="background:#141414;border:1px solid rgba(201,168,76,0.3);padding:1.5rem;width:680px;max-height:80vh;overflow-y:auto;position:relative">
      <button onclick="document.getElementById('cloudinaryBrowser').remove()" style="position:absolute;top:0.75rem;right:0.75rem;background:none;border:none;color:#888;font-size:1rem;cursor:pointer">✕ Close</button>
      <div style="font-family:'Courier Prime',monospace;font-size:0.6rem;letter-spacing:0.15em;color:var(--gold);text-transform:uppercase;margin-bottom:1rem">☁ Cloudinary — Browse Folder</div>
      <div id="cldr-folders" style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-bottom:1rem"></div>
      <div id="cldr-photos" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:0.5rem"></div>
      <div id="cldr-status" style="font-size:0.75rem;color:#888;margin-top:0.5rem"></div>
      <button id="cldr-add-btn" onclick="addSelectedFromCloudinary(${creditIdx})" style="display:none;margin-top:1rem;padding:0.5rem 1.5rem;background:rgba(201,168,76,0.15);border:1px solid rgba(201,168,76,0.4);color:var(--gold);font-family:'Courier Prime',monospace;font-size:0.6rem;letter-spacing:0.1em;cursor:pointer;text-transform:uppercase">+ Add Selected to Credit Card</button>
    </div>`;
  document.body.appendChild(overlay);

  // Load folders
  const FOLDERS = ['don-omar','j-alvarez','las-nenas','melina-leon','sony-music-latin','arrow-management','nv-marketing','fema','venetian-productions','urban-latino','adam-torres','video-thumbs','gallery','resume','bio-photo','hero-photo','awards-degrees','mp3-tracks','mp4-videos','delete-me'];
  const foldersEl = document.getElementById('cldr-folders');
  FOLDERS.forEach(f => {
    const btn = document.createElement('button');
    btn.textContent = f;
    btn.style.cssText = 'font-family:"Courier Prime",monospace;font-size:0.55rem;letter-spacing:0.08em;padding:0.25rem 0.6rem;background:rgba(201,168,76,0.06);border:1px solid rgba(201,168,76,0.2);color:#aaa;cursor:pointer;text-transform:uppercase';
    btn.onclick = () => loadCloudinaryFolder(f);
    foldersEl.appendChild(btn);
  });

  document.getElementById('cldr-status').textContent = 'Select a folder to browse photos';
}

window._cldrSelected = {};

async function loadCloudinaryFolder(folder) {
  window._cldrSelected = {};
  const photosEl = document.getElementById('cldr-photos');
  const statusEl = document.getElementById('cldr-status');
  const addBtn = document.getElementById('cldr-add-btn');
  photosEl.innerHTML = '<div style="color:#888;font-size:0.75rem;grid-column:1/-1">Loading...</div>';
  addBtn.style.display = 'none';

  try {
    const res = await fetch(`/.netlify/functions/cloudinary-browse?folder=${encodeURIComponent(folder)}`);
    const data = await res.json();
    const images = data.resources || [];

    if (!images.length) {
      photosEl.innerHTML = '<div style="color:#888;font-size:0.75rem;grid-column:1/-1">No images in this folder yet.</div>';
      return;
    }

    statusEl.textContent = `${images.length} image${images.length>1?'s':''} in "${folder}" — click to select`;
    photosEl.innerHTML = images.map(img => `
      <div id="cldr_${img.public_id.replace(/[^a-z0-9]/gi,'_')}"
        onclick="toggleCldrSelect('${img.public_id}','${img.secure_url}')"
        style="cursor:pointer;border:2px solid transparent;position:relative">
        <img src="${img.secure_url.replace('/upload/','/upload/w_150,h_150,c_fill,f_jpg/')}"
          style="width:100%;height:90px;object-fit:cover;display:block"
          onerror="this.style.opacity='0.3'">
        <div style="font-size:9px;color:#666;padding:2px 4px;font-family:monospace;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${img.public_id.split('/').pop()}</div>
      </div>`).join('');
  } catch(e) {
    photosEl.innerHTML = '<div style="color:#ff6b6b;font-size:0.75rem;grid-column:1/-1">Error loading folder.</div>';
  }
}

function toggleCldrSelect(publicId, secureUrl) {
  const safeId = 'cldr_' + publicId.replace(/[^a-z0-9]/gi,'_');
  const el = document.getElementById(safeId);
  if (window._cldrSelected[publicId]) {
    delete window._cldrSelected[publicId];
    el.style.border = '2px solid transparent';
    el.style.background = 'none';
  } else {
    window._cldrSelected[publicId] = secureUrl;
    el.style.border = '2px solid var(--gold)';
    el.style.background = 'rgba(201,168,76,0.1)';
  }
  const count = Object.keys(window._cldrSelected).length;
  const addBtn = document.getElementById('cldr-add-btn');
  addBtn.style.display = count > 0 ? 'block' : 'none';
  addBtn.textContent = `+ Add ${count} Photo${count>1?'s':''} to Credit Card`;
}

function addSelectedFromCloudinary(creditIdx) {
  const urls = Object.values(window._cldrSelected);
  if (!urls.length) return;
  epk.credits[creditIdx].photos = epk.credits[creditIdx].photos || [];
  urls.forEach(url => epk.credits[creditIdx].photos.push(url));
  persistUser(); renderCredits(); showSaveBanner();
  document.getElementById('cloudinaryBrowser').remove();
  window._cldrSelected = {};
}

function removeCreditPhoto(creditIdx, photoIdx) {
  epk.credits[creditIdx].photos.splice(photoIdx, 1);
  renderCredits(); persistUser(); showSaveBanner();
}
let draggedSavedPhoto = null;
function dragSavedPhoto(e, creditIdx, photoIdx) {
  draggedSavedPhoto = { creditIdx, photoIdx };
  e.dataTransfer.effectAllowed = 'move';
}
function dropSavedPhoto(e, creditIdx, photoIdx) {
  e.preventDefault();
  if (!draggedSavedPhoto || draggedSavedPhoto.creditIdx !== creditIdx || draggedSavedPhoto.photoIdx === photoIdx) return;
  const photos = epk.credits[creditIdx].photos;
  const moved = photos.splice(draggedSavedPhoto.photoIdx, 1)[0];
  photos.splice(photoIdx, 0, moved);
  draggedSavedPhoto = null;
  renderCredits(); persistUser(); showSaveBanner();
}
function addCredit() {
  const artist = document.getElementById('newCreditArtist').value.trim();
  const years = document.getElementById('newCreditYears').value.trim();
  const catSelect = document.getElementById('newCreditCategory');
  const category = catSelect.value === 'Other'
    ? (document.getElementById('newCreditCategoryOther').value.trim() || 'Other')
    : catSelect.value;
  const contractType = document.getElementById('newCreditContractType').value;
  const highlightTag = document.getElementById('newCreditHighlightTag')?.value || '';
  const role = document.getElementById('newCreditRole').value.trim();
  const projectType = document.getElementById('newCreditProjectType').value.trim();
  const desc = document.getElementById('newCreditDesc').value.trim();
  const fullDesc = document.getElementById('newCreditFullDesc').value.trim();
  const fullDescEs = document.getElementById('newCreditFullDescEs')?.value.trim() || '';
  const mediaItems = [...pendingCreditMedia];
  const mediaLink = mediaItems[0]?.url || '';
  const mediaLabel = mediaItems[0]?.label || '';
  const videoUrl = mediaItems.find(m => m.type==='video')?.url || '';
  const proofLink = document.getElementById('newCreditProofLink').value.trim();
  const visible = document.getElementById('newCreditVisible').checked;
  const verified = document.getElementById('newCreditVerified').checked;
  const pinned = document.getElementById('newCreditPinned').checked;
  if (!artist || !role) return;
  epk.credits = epk.credits || [];
  const creditData = { company: artist, artist, years, category, highlightTag, contractType, role, projectType, desc, fullDesc, fullDescEs, mediaLink, mediaLabel, videoUrl, mediaItems, proofLink, visible, verified, pinned, mediaLayout: pendingCreditMediaLayout, collaborators: [...pendingCreditCollaborators], photos: [...pendingCreditPhotos], press: pendingPressItems.filter(p => p.publication && p.summary) };
  if (editingCreditIdx >= 0) {
    epk.credits[editingCreditIdx] = { ...epk.credits[editingCreditIdx], ...creditData };
    editingCreditIdx = -1;
    document.querySelector('#addCreditForm .add-form-title').textContent = 'New Credit';
  } else {
    epk.credits.push(creditData);
  }
  pendingCreditPhotos = [];
  pendingCreditCollaborators = [];
  pendingCreditMedia = [];
  pendingCreditMediaLayout = 'grid';
  pendingPressItems = [];
  renderPressItems();
  renderCreditPhotosPreview();
  renderCreditCollaborators();
  renderCreditMediaList();
  ['newCreditArtist','newCreditYears','newCreditRole','newCreditProjectType','newCreditDesc','newCreditFullDesc','newCreditFullDescEs','newCreditProofLink'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
  document.getElementById('newCreditCategory').value = '';
  if (document.getElementById('newCreditHighlightTag')) document.getElementById('newCreditHighlightTag').value = '';
  document.getElementById('newCreditContractType').value = '';
  document.getElementById('newCreditVisible').checked = true;
  document.getElementById('newCreditVerified').checked = false;
  document.getElementById('newCreditPinned').checked = false;
  toggleAddForm('addCreditForm');
  clearDraft('addCreditForm', editingCreditIdx >= 0 ? editingCreditIdx : -1);
  renderCredits(); persistUser(); showSaveBanner();
}
// CREDIT COLLABORATORS
let pendingCreditCollaborators = [];
function renderCreditCollaborators() {
  const container = document.getElementById('creditCollaboratorsList');
  if (!container) return;
  container.innerHTML = pendingCreditCollaborators.map((c, i) => `
    <div class="tag">${c}
      <button class="tag-remove" onclick="pendingCreditCollaborators.splice(${i},1);renderCreditCollaborators()">×</button>
    </div>`).join('');
}
function addCreditCollaborator() {
  const val = document.getElementById('newCreditCollaborator').value.trim();
  if (!val) return;
  pendingCreditCollaborators.push(val);
  document.getElementById('newCreditCollaborator').value = '';
  renderCreditCollaborators();
}

// CREDIT MULTI-MEDIA
let pendingCreditMedia = [];
let pendingCreditMediaLayout = 'grid';

function renderCreditMediaList() {
  const container = document.getElementById('creditMediaList');
  if (!container) return;
  // Sync the static radio buttons in the form
  document.querySelectorAll('input[name="perCardMediaLayout"]').forEach(r => {
    r.checked = r.value === pendingCreditMediaLayout;
  });
  container.innerHTML = pendingCreditMedia.map((m, i) => {
    const isVideo = m.type === 'video' || (m.url && m.url.includes('.mp4'));
    const typeLabel = isVideo ? '📹 MP4' : m.type === 'doc' ? '📄 DOC' : '🔗 LINK';
    const thumbSection = isVideo ? `
      <div style="margin-top:0.5rem;padding-top:0.5rem;border-top:1px solid rgba(255,255,255,0.06)">
        <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">
          <span style="font-family:var(--font-mono);font-size:0.48rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--gray)">Thumbnail:</span>
          ${m.thumb ? `<img src="${m.thumb}" style="width:80px;height:45px;object-fit:cover;border:1px solid rgba(201,168,76,0.3)">` : '<span style="font-family:var(--font-mono);font-size:0.48rem;color:var(--gray);opacity:0.6">None uploaded</span>'}
          <button onclick="triggerCreditItemThumb(${i})" style="font-family:var(--font-mono);font-size:0.48rem;letter-spacing:0.08em;text-transform:uppercase;background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.25);color:var(--gold);padding:0.25rem 0.6rem;cursor:pointer">↑ Upload Thumbnail</button>
          <input type="file" id="creditItemThumbInput_${i}" accept="image/*" style="display:none">
        </div>
      </div>` : '';
    return `
    <div draggable="true" ondragstart="dragCreditMedia(event,${i})" ondragover="event.preventDefault();this.style.borderColor='rgba(201,168,76,0.5)'" ondragleave="this.style.borderColor='rgba(201,168,76,0.12)'" ondrop="dropCreditMedia(event,${i});this.style.borderColor='rgba(201,168,76,0.12)'" style="background:var(--dark-3);border:1px solid rgba(201,168,76,0.12);padding:0.75rem;cursor:grab;transition:border-color 0.2s">
      <div style="display:flex;gap:0.5rem;align-items:center">
        <span style="font-family:var(--font-mono);font-size:0.7rem;color:rgba(201,168,76,0.3);cursor:grab;padding-right:0.25rem;user-select:none">⠿</span>
        <span style="font-family:var(--font-mono);font-size:0.5rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--gold);min-width:40px">${typeLabel}</span>
        <input type="url" value="${m.url}" placeholder="URL" oninput="pendingCreditMedia[${i}].url=this.value"
          style="flex:1;background:transparent;border:none;color:var(--white);font-family:var(--font-body);font-size:0.8rem;outline:none">
        <input type="text" value="${m.label}" placeholder="Label (optional)" oninput="pendingCreditMedia[${i}].label=this.value"
          style="width:160px;background:transparent;border:none;border-left:1px solid rgba(255,255,255,0.1);padding-left:0.5rem;color:var(--gray);font-family:var(--font-body);font-size:0.75rem;outline:none">
        <button onclick="pendingCreditMedia.splice(${i},1);renderCreditMediaList()"
          style="background:none;border:none;color:#ff6b6b;cursor:pointer;font-size:0.8rem;padding:0 0.25rem">✕</button>
      </div>
      ${thumbSection}
    </div>`;
  }).join('');
}

function triggerCreditItemThumb(idx) {
  const input = document.getElementById(`creditItemThumbInput_${idx}`);
  if (!input) return;
  input.value = '';
  input.onchange = async function() {
    const file = input.files[0];
    if (!file) return;
    const btn = document.querySelector(`[onclick="triggerCreditItemThumb(${idx})"]`);
    const originalText = btn ? btn.textContent : '↑ Upload Thumbnail';
    if (btn) { btn.textContent = 'Uploading...'; btn.disabled = true; }
    await uploadToR2(file, 'thumbnails',
      (url) => {
        pendingCreditMedia[idx].thumb = url;
        renderCreditMediaList();
        if (btn) { btn.textContent = '✓ Uploaded'; btn.style.color = '#7ec97e'; setTimeout(() => { btn.textContent = originalText; btn.style.color = ''; btn.disabled = false; }, 2000); }
      },
      (err) => showUploadError(btn, originalText, err)
    );
  };
  input.click();
}

function addCreditMedia(type) {
  if (type === 'upload') {
    const input = document.getElementById('creditVideoInput');
    input.value = '';
    input.onchange = async function() {
      const file = input.files[0];
      if (!file) return;
      await uploadToR2(file, 'videos',
        (url) => {
          // No auto-thumbnail from R2 — thumbnail uploaded separately
          pendingCreditMedia.push({ type: 'video', url: url, label: file.name.replace(/\.[^.]+$/, ''), thumb: '' });
          renderCreditMediaList();
        },
        (err) => { console.error('Credit video upload failed:', err); alert('Upload failed: ' + err); }
      );
    };
    input.click();
  } else if (type === 'doc') {
    const input = document.getElementById('creditDocInput');
    input.value = '';
    input.onchange = async function() {
      const file = input.files[0];
      if (!file) return;
      const btn = document.querySelector('.btn-add[onclick*="doc"]');
      if (btn) { btn.textContent = 'Uploading...'; btn.disabled = true; }
      try {
        const publicUrl = await uploadPdfToGitHub(file, 'press');
        const ext = file.name.split('.').pop().toUpperCase();
        pendingCreditMedia.push({ type: 'doc', url: publicUrl, label: file.name.replace(/\.[^.]+$/, ''), ext });
        renderCreditMediaList();
        if (btn) { btn.textContent = '✓ Uploaded'; btn.style.color = '#7ec97e'; setTimeout(() => { btn.textContent = '📄 Upload PDF / Doc'; btn.style.color = ''; btn.disabled = false; }, 2000); }
      } catch(e) {
        if (btn) { btn.textContent = '📄 Upload PDF / Doc'; btn.disabled = false; }
        console.error('PDF upload failed', e);
      }
    };
    input.click();
  } else {
    pendingCreditMedia.push({ type: 'link', url: '', label: '' });
    renderCreditMediaList();
    setTimeout(() => {
      const inputs = document.querySelectorAll('#creditMediaList input[type="url"]');
      if (inputs.length) inputs[inputs.length-1].focus();
    }, 50);
  }
}

function triggerCreditVideoUpload() {
  const input = document.getElementById('creditVideoInput');
  input.value = '';
  input.click();
  input.onchange = async function() {
    const file = input.files[0];
    if (!file) return;
    const btn = document.querySelector('[onclick="triggerCreditVideoUpload()"]');
    const originalText = btn ? btn.textContent : '↑ Upload MP4';
    if (btn) { btn.textContent = 'Uploading...'; btn.disabled = true; }
    await uploadToR2(file, 'videos',
      (url) => {
        document.getElementById('newCreditVideoUrl').value = url;
        if (btn) { btn.textContent = '✓ Uploaded'; btn.style.color = '#7ec97e'; setTimeout(() => { btn.textContent = originalText; btn.style.color = ''; btn.disabled = false; }, 2000); }
      },
      (err) => showUploadError(btn, originalText, err)
    );
  };
}
function removeCredit(i) { epk.credits.splice(i, 1); renderCredits(); persistUser(); showSaveBanner(); }

// TRACKS
let editingTrackIdx = -1;
function renderTracks() {
  const container = document.getElementById('tracksList');
  container.innerHTML = '';
  (epk.tracks || []).forEach((t, i) => {
    const badges = [
      t.unreleased ? '<span style="font-family:var(--font-mono);font-size:0.5rem;background:rgba(201,168,76,0.12);color:var(--gold);padding:0.15rem 0.5rem;letter-spacing:0.1em">UNRELEASED</span>' : '',
      t.visible === false ? '<span style="font-family:var(--font-mono);font-size:0.5rem;background:rgba(255,100,100,0.1);color:#ff6b6b;padding:0.15rem 0.5rem;letter-spacing:0.1em">HIDDEN</span>' : '',
      t.type ? `<span style="font-family:var(--font-mono);font-size:0.5rem;background:rgba(201,168,76,0.08);color:var(--gray);padding:0.15rem 0.5rem;letter-spacing:0.1em">${t.type}</span>` : '',
    ].filter(Boolean).join(' ');
    container.innerHTML += `
      <div class="editable-card" style="${t.visible===false?'opacity:0.5':''}">
        <div class="editable-card-header">
          <div style="display:flex;flex-direction:column;gap:0.2rem;margin-right:0.75rem">
            <button class="btn-card-action" onclick="moveItem('tracks',${i},-1)" ${i===0?'disabled':''} style="padding:0.15rem 0.4rem;font-size:0.65rem;line-height:1">▲</button>
            <button class="btn-card-action" onclick="moveItem('tracks',${i},1)" ${i===(epk.tracks.length-1)?'disabled':''} style="padding:0.15rem 0.4rem;font-size:0.65rem;line-height:1">▼</button>
          </div>
          <div style="flex:1">
            ${badges ? `<div style="display:flex;gap:0.3rem;flex-wrap:wrap;margin-bottom:0.3rem">${badges}</div>` : ''}
            <div class="editable-card-title">${t.title} ${t.tag ? `<span style="font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.1em;background:rgba(201,168,76,0.15);color:var(--gold);padding:0.2rem 0.5rem;margin-left:0.5rem">${t.tag}</span>` : ''}</div>
            <div class="editable-card-subtitle">${t.artist || ''} ${t.role ? '· ' + t.role : ''} ${t.album ? '· ' + t.album : ''} ${t.year ? '(' + t.year + ')' : ''}${t.releaseDate ? ' · ' + t.releaseDate : ''}</div>
            ${t.isrc ? `<div style="font-family:var(--font-mono);font-size:0.55rem;color:var(--gray);margin-top:0.2rem">ISRC: ${t.isrc}</div>` : ''}
            ${t.desc ? `<div style="font-size:0.85rem;color:var(--gray);margin-top:0.3rem">${t.desc}</div>` : ''}
          </div>
          <div class="card-actions">
            <button class="btn-card-action" onclick="editTrack(${i})">Edit</button>
            <button class="btn-card-action btn-card-delete" onclick="removeTrack(${i})">Delete</button>
          </div>
        </div>
        ${t.link ? `<a href="${t.link}" target="_blank" style="font-family:var(--font-mono);font-size:0.6rem;color:var(--gold);letter-spacing:0.1em">Listen →</a>` : ''}
      </div>`;
  });
}
function editTrack(i) {
  editingTrackIdx = i;
  const t = epk.tracks[i];
  document.getElementById('newTrackTitle').value = t.title || '';
  document.getElementById('newTrackArtist').value = t.artist || '';
  document.getElementById('newTrackType').value = t.type || '';
  document.getElementById('newTrackRole').value = t.role || '';
  document.getElementById('newTrackTag').value = t.tag || '';
  document.getElementById('newTrackReleaseDate').value = t.releaseDate || '';
  document.getElementById('newTrackLink').value = t.link || '';
  document.getElementById('newTrackAlbum').value = t.album || '';
  document.getElementById('newTrackYear').value = t.year || '';
  document.getElementById('newTrackISRC').value = t.isrc || '';
  document.getElementById('newTrackRights').value = t.rights || '';
  document.getElementById('newTrackLyrics').value = t.lyrics || '';
  document.getElementById('newTrackDesc').value = t.desc || '';
  document.getElementById('newTrackVisible').checked = t.visible !== false;
  document.getElementById('newTrackUnreleased').checked = t.unreleased || false;
  document.getElementById('addTrackForm').classList.add('open');
  document.getElementById('addTrackForm').scrollIntoView({ behavior: 'smooth' });
  document.querySelector('#addTrackForm .add-form-title').textContent = 'Edit Track';
}
function addTrack() {
  const title = document.getElementById('newTrackTitle').value.trim();
  const artist = document.getElementById('newTrackArtist').value.trim();
  const type = document.getElementById('newTrackType').value;
  const role = document.getElementById('newTrackRole').value.trim();
  const tag = document.getElementById('newTrackTag').value;
  const releaseDate = document.getElementById('newTrackReleaseDate').value.trim();
  const link = document.getElementById('newTrackLink').value.trim();
  const album = document.getElementById('newTrackAlbum').value.trim();
  const year = document.getElementById('newTrackYear').value.trim();
  const isrc = document.getElementById('newTrackISRC').value.trim();
  const rights = document.getElementById('newTrackRights').value.trim();
  const lyrics = document.getElementById('newTrackLyrics').value.trim();
  const desc = document.getElementById('newTrackDesc').value.trim();
  const visible = document.getElementById('newTrackVisible').checked;
  const unreleased = document.getElementById('newTrackUnreleased').checked;
  if (!title) return;
  epk.tracks = epk.tracks || [];
  const trackData = { title, artist, type, role, tag, releaseDate, link, album, year, isrc, rights, lyrics, desc, visible, unreleased };
  if (editingTrackIdx >= 0) {
    epk.tracks[editingTrackIdx] = { ...epk.tracks[editingTrackIdx], ...trackData };
    editingTrackIdx = -1;
    document.querySelector('#addTrackForm .add-form-title').textContent = 'New Track';
  } else {
    epk.tracks.push(trackData);
  }
  ['newTrackTitle','newTrackArtist','newTrackRole','newTrackLink','newTrackAlbum','newTrackYear','newTrackReleaseDate','newTrackISRC','newTrackRights','newTrackLyrics','newTrackDesc'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('newTrackTag').value = '';
  document.getElementById('newTrackType').value = '';
  document.getElementById('newTrackVisible').checked = true;
  document.getElementById('newTrackUnreleased').checked = false;
  toggleAddForm('addTrackForm');
  renderTracks(); persistUser(); showSaveBanner();
}
function removeTrack(i) { epk.tracks.splice(i, 1); renderTracks(); persistUser(); showSaveBanner(); }

// VIDEOS
let editingVideoIdx = -1;
function renderVideos() {
  const container = document.getElementById('videosList');
  container.innerHTML = '';
  (epk.videos || []).forEach((v, i) => {
    const badges = [
      v.featured ? '<span style="font-family:var(--font-mono);font-size:0.5rem;background:rgba(201,168,76,0.15);color:var(--gold);padding:0.15rem 0.5rem;letter-spacing:0.1em">⭐ FEATURED</span>' : '',
      v.visible === false ? '<span style="font-family:var(--font-mono);font-size:0.5rem;background:rgba(255,100,100,0.1);color:#ff6b6b;padding:0.15rem 0.5rem;letter-spacing:0.1em">HIDDEN</span>' : '',
      v.category ? `<span style="font-family:var(--font-mono);font-size:0.5rem;background:rgba(201,168,76,0.08);color:var(--gray);padding:0.15rem 0.5rem;letter-spacing:0.1em">${v.category}</span>` : '',
    ].filter(Boolean).join(' ');
    container.innerHTML += `
      <div class="editable-card" style="${v.visible===false?'opacity:0.5':''}">
        <div class="editable-card-header">
          <div style="display:flex;flex-direction:column;gap:0.2rem;margin-right:0.75rem">
            <button class="btn-card-action" onclick="moveItem('videos',${i},-1)" ${i===0?'disabled':''} style="padding:0.15rem 0.4rem;font-size:0.65rem;line-height:1">▲</button>
            <button class="btn-card-action" onclick="moveItem('videos',${i},1)" ${i===(epk.videos.length-1)?'disabled':''} style="padding:0.15rem 0.4rem;font-size:0.65rem;line-height:1">▼</button>
          </div>
          <div style="flex:1">
            ${badges ? `<div style="display:flex;gap:0.3rem;flex-wrap:wrap;margin-bottom:0.3rem">${badges}</div>` : ''}
            <div class="editable-card-title">${v.title} ${v.year ? '(' + v.year + ')' : ''}</div>
            ${v.album ? `<div class="editable-card-subtitle">${v.album}</div>` : ''}
            ${v.desc ? `<div style="font-size:0.85rem;color:var(--gray);margin-top:0.3rem">${v.desc}</div>` : ''}
            <div style="margin-top:0.4rem"><a href="${v.url}" target="_blank" style="font-family:var(--font-mono);font-size:0.65rem;letter-spacing:0.08em;color:var(--gold);text-decoration:none;border:1px solid rgba(201,168,76,0.3);padding:0.2rem 0.6rem;">▶ WATCH</a></div>
          </div>
          <div class="card-actions">
            <button class="btn-card-action" onclick="editVideo(${i})">Edit</button>
            <button class="btn-card-action btn-card-delete" onclick="removeVideo(${i})">Delete</button>
          </div>
        </div>
      </div>`;
  });
}
function editVideo(i) {
  editingVideoIdx = i;
  const v = epk.videos[i];
  document.getElementById('newVideoTitle').value = v.title || '';
  document.getElementById('newVideoCategory').value = v.category || '';
  document.getElementById('newVideoFeatured').checked = v.featured || false;
  document.getElementById('newVideoUrl').value = v.url || '';
  const existingThumb = v.thumbnail || v.thumb || '';
  document.getElementById('newVideoThumb').value = existingThumb;
  // Show existing thumbnail preview when editing
  let preview = document.getElementById('videoThumbPreview');
  if (!preview) {
    preview = document.createElement('div');
    preview.id = 'videoThumbPreview';
    const thumbInput = document.getElementById('newVideoThumb');
    thumbInput.parentNode.insertBefore(preview, thumbInput.nextSibling);
  }
  if (existingThumb) {
    preview.innerHTML = `<img src="${existingThumb}" style="width:160px;height:90px;object-fit:cover;border:2px solid rgba(201,168,76,0.3);margin-top:0.5rem;display:block"><div style="font-family:var(--font-mono);font-size:0.5rem;color:var(--gray);margin-top:0.3rem">Current thumbnail</div>`;
  } else {
    preview.innerHTML = '';
  }
  document.getElementById('newVideoAlbum').value = v.album || '';
  document.getElementById('newVideoYear').value = v.year || '';
  document.getElementById('newVideoDesc').value = v.desc || '';
  document.getElementById('newVideoVisible').checked = v.visible !== false;
  document.getElementById('addVideoForm').classList.add('open');
  document.getElementById('addVideoForm').scrollIntoView({ behavior: 'smooth' });
  document.querySelector('#addVideoForm .add-form-title').textContent = 'Edit Video';
}

function addVideo() {
  const title = document.getElementById('newVideoTitle').value.trim();
  const category = document.getElementById('newVideoCategory').value;
  const featured = document.getElementById('newVideoFeatured').checked;
  const url = document.getElementById('newVideoUrl').value.trim();
  const thumb = document.getElementById('newVideoThumb').value.trim();
  const album = document.getElementById('newVideoAlbum').value.trim();
  const year = document.getElementById('newVideoYear').value.trim();
  const desc = document.getElementById('newVideoDesc').value.trim();
  const visible = document.getElementById('newVideoVisible').checked;
  if (!title) return;
  // Allow saving without url when editing (e.g. adding thumbnail to existing video)
  if (!url && editingVideoIdx < 0) return;
  epk.videos = epk.videos || [];
  const videoData = { title, category, featured, url, thumb, thumbnail: thumb, album, year, desc, visible };
  if (editingVideoIdx >= 0) {
    epk.videos[editingVideoIdx] = { ...epk.videos[editingVideoIdx], ...videoData };
    editingVideoIdx = -1;
    document.querySelector('#addVideoForm .add-form-title').textContent = 'New Video';
  } else {
    epk.videos.push(videoData);
  }
  ['newVideoTitle','newVideoUrl','newVideoThumb','newVideoAlbum','newVideoYear','newVideoDesc'].forEach(id => document.getElementById(id).value = '');
  const thumbPreview = document.getElementById('videoThumbPreview');
  if (thumbPreview) thumbPreview.innerHTML = '';
  document.getElementById('newVideoCategory').value = '';
  document.getElementById('newVideoFeatured').checked = false;
  document.getElementById('newVideoVisible').checked = true;
  toggleAddForm('addVideoForm');
  renderVideos(); persistUser(); showSaveBanner();
}
function removeVideo(i) { epk.videos.splice(i, 1); renderVideos(); persistUser(); showSaveBanner(); }

// PHOTOS
let editingPhotoIdx = -1;
function renderPhotos() {
  const container = document.getElementById('photosList');
  container.innerHTML = '';
  (epk.photos || []).forEach((p, i) => {
    const badges = [
      p.featured ? '<span style="font-family:var(--font-mono);font-size:0.5rem;background:rgba(201,168,76,0.15);color:var(--gold);padding:0.15rem 0.5rem">⭐ FEATURED</span>' : '',
      p.category ? `<span style="font-family:var(--font-mono);font-size:0.5rem;background:rgba(201,168,76,0.08);color:var(--gray);padding:0.15rem 0.5rem">${p.category}</span>` : '',
      p.year ? `<span style="font-family:var(--font-mono);font-size:0.5rem;background:rgba(255,255,255,0.05);color:var(--gray);padding:0.15rem 0.5rem">${p.year}</span>` : '',
      (p.group || p.collection) ? `<span style="font-family:var(--font-mono);font-size:0.5rem;background:rgba(255,255,255,0.05);color:var(--gray);padding:0.15rem 0.5rem">📁 ${p.group || p.collection}</span>` : '',
      p.location ? `<span style="font-family:var(--font-mono);font-size:0.5rem;background:rgba(255,255,255,0.04);color:var(--gray);padding:0.15rem 0.5rem">📍 ${p.location}</span>` : '',
    ].filter(Boolean).join(' ');
    container.innerHTML += `
      <div class="editable-card" style="display:flex;gap:1rem;align-items:center">
        <div style="display:flex;flex-direction:column;gap:0.2rem;flex-shrink:0">
          <button class="btn-card-action" onclick="moveItem('photos',${i},-1)" ${i===0?'disabled':''} style="padding:0.15rem 0.4rem;font-size:0.65rem;line-height:1">▲</button>
          <button class="btn-card-action" onclick="moveItem('photos',${i},1)" ${i===(epk.photos.length-1)?'disabled':''} style="padding:0.15rem 0.4rem;font-size:0.65rem;line-height:1">▼</button>
        </div>
        <img src="${p.url}" style="width:100px;height:80px;object-fit:cover;object-position:${p.position||'top center'};flex-shrink:0;border:1px solid rgba(201,168,76,0.15)" onerror="this.style.display='none'">
        <div style="flex:1">
          ${badges ? `<div style="display:flex;gap:0.3rem;flex-wrap:wrap;margin-bottom:0.3rem">${badges}</div>` : ''}
          <div class="editable-card-title" style="font-size:0.95rem">${p.caption || '(no caption)'}</div>
        </div>
        <div class="card-actions">
          <button class="btn-card-action" onclick="editPhoto(${i})">Edit</button>
          <button class="btn-card-action btn-card-delete" onclick="removePhoto(${i})">Delete</button>
        </div>
      </div>`;
  });
}
function editPhoto(i) {
  editingPhotoIdx = i;
  const p = epk.photos[i];
  document.getElementById('newPhotoCaption').value = p.caption || '';
  document.getElementById('newPhotoUrl').value = p.url || '';
  document.getElementById('newPhotoGroup').value = p.group || p.collection || '';
  document.getElementById('newPhotoCategory').value = p.category || '';
  document.getElementById('newPhotoFeatured').checked = p.featured || false;
  document.getElementById('newPhotoCollectionCover').checked = p.collectionCover || false;
  document.getElementById('newPhotoYear').value = p.year || '';
  document.getElementById('newPhotoDate').value = p.date || '';
  document.getElementById('newPhotoLocation').value = p.location || '';
  document.getElementById('newPhotoPeople').value = p.people || '';
  document.getElementById('newPhotoTags').value = Array.isArray(p.tags) ? p.tags.join(', ') : (p.tags || '');
  document.getElementById('newPhotoDesc').value = p.desc || '';
  document.getElementById('newPhotoCareerPhase').value = p.careerPhase || '';
  document.getElementById('newPhotoMediaType').value = p.mediaType || '';
  document.getElementById('newPhotoAchievement').value = p.achievement || '';
  document.getElementById('newPhotoCredit').value = p.credit || '';
  const pos = p.position || 'center 0%';
  const posMatch = pos.match(/(\d+)%/);
  const posVal = posMatch ? parseInt(posMatch[1]) : 0;
  document.getElementById('photoPositionSlider').value = posVal;
  document.getElementById('photoPositionValue').value = pos;
  updatePhotoPreview(p.url || '');
  if (document.getElementById('photoPreviewImg')) document.getElementById('photoPreviewImg').style.objectPosition = pos;
  document.getElementById('addPhotoForm').classList.add('open');
  document.getElementById('addPhotoForm').scrollIntoView({ behavior: 'smooth' });
  document.querySelector('#addPhotoForm .add-form-title').textContent = 'Edit Photo';
  const submitBtn = document.getElementById('photoSubmitBtn');
  if (submitBtn) submitBtn.textContent = 'Save Photo';
  // Restore any unsaved draft for this photo
  if (restoreDraft('addPhotoForm', i)) showDraftBanner('addPhotoForm');
}
function addPhoto() {
  const caption = document.getElementById('newPhotoCaption').value.trim();
  const url = document.getElementById('newPhotoUrl').value.trim();
  const group = document.getElementById('newPhotoGroup').value.trim();
  const category = document.getElementById('newPhotoCategory').value;
  const featured = document.getElementById('newPhotoFeatured').checked;
  const collectionCover = document.getElementById('newPhotoCollectionCover').checked;
  const position = document.getElementById('photoPositionValue').value || 'center 0%';
  const year = document.getElementById('newPhotoYear').value ? parseInt(document.getElementById('newPhotoYear').value) : null;
  const date = document.getElementById('newPhotoDate').value.trim();
  const location = document.getElementById('newPhotoLocation').value.trim();
  const people = document.getElementById('newPhotoPeople').value.trim();
  const tagsRaw = document.getElementById('newPhotoTags').value.trim();
  const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
  const desc = document.getElementById('newPhotoDesc').value.trim();
  const careerPhase = document.getElementById('newPhotoCareerPhase').value;
  const mediaType = document.getElementById('newPhotoMediaType').value;
  const achievement = document.getElementById('newPhotoAchievement').value;
  const credit = document.getElementById('newPhotoCredit').value.trim();
  if (!url) return;
  epk.photos = epk.photos || [];
  const photoData = { caption, url, group, collection: group, category, featured, collectionCover, position, year, date, location, people, tags, desc, careerPhase, mediaType, achievement, credit };
  if (editingPhotoIdx >= 0) {
    epk.photos[editingPhotoIdx] = { ...epk.photos[editingPhotoIdx], ...photoData };
    editingPhotoIdx = -1;
    document.querySelector('#addPhotoForm .add-form-title').textContent = 'New Photo';
  } else {
    epk.photos.push(photoData);
  }

  // Apply all saved drafts to epk.photos before saving
  // This ensures metadata entered in previous edits (stored in localStorage) is preserved
  epk.photos.forEach((p, idx) => {
    const draftRaw = localStorage.getItem(`porfolioid_draft_addPhotoForm_${idx}`);
    if (draftRaw) {
      try {
        const draft = JSON.parse(draftRaw);
        const merged = { ...p };
        if (draft.newPhotoCaption) merged.caption = draft.newPhotoCaption;
        if (draft.newPhotoGroup) { merged.group = draft.newPhotoGroup; merged.collection = draft.newPhotoGroup; }
        if (draft.newPhotoCategory) merged.category = draft.newPhotoCategory;
        if (draft.newPhotoYear) merged.year = parseInt(draft.newPhotoYear);
        if (draft.newPhotoDate) merged.date = draft.newPhotoDate;
        if (draft.newPhotoLocation) merged.location = draft.newPhotoLocation;
        if (draft.newPhotoPeople) merged.people = draft.newPhotoPeople;
        if (draft.newPhotoTags) merged.tags = draft.newPhotoTags.split(',').map(t=>t.trim()).filter(Boolean);
        if (draft.newPhotoDesc) merged.desc = draft.newPhotoDesc;
        if (draft.newPhotoCareerPhase) merged.careerPhase = draft.newPhotoCareerPhase;
        if (draft.newPhotoMediaType) merged.mediaType = draft.newPhotoMediaType;
        if (draft.newPhotoAchievement) merged.achievement = draft.newPhotoAchievement;
        if (draft.newPhotoCredit) merged.credit = draft.newPhotoCredit;
        if (draft.newPhotoFeatured !== undefined) merged.featured = draft.newPhotoFeatured;
        if (draft.newPhotoCollectionCover !== undefined) merged.collectionCover = draft.newPhotoCollectionCover;
        epk.photos[idx] = merged;
      } catch(e) { console.error('Draft merge failed for photo', idx, e); }
    }
  });

  ['newPhotoCaption','newPhotoUrl','newPhotoGroup','newPhotoYear','newPhotoDate','newPhotoLocation','newPhotoPeople','newPhotoTags','newPhotoDesc','newPhotoCredit'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
  ['newPhotoCategory','newPhotoCareerPhase','newPhotoMediaType','newPhotoAchievement'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
  ['newPhotoFeatured','newPhotoCollectionCover'].forEach(id => { const el = document.getElementById(id); if(el) el.checked = false; });
  document.getElementById('photoPositionSlider').value = 0;
  document.getElementById('photoPositionValue').value = 'center 0%';
  document.getElementById('photoPreviewBox').style.display = 'none';
  toggleAddForm('addPhotoForm');
  // Clear all photo drafts after successful save
  epk.photos.forEach((p, idx) => clearDraft('addPhotoForm', idx));
  const submitBtn = document.getElementById('photoSubmitBtn');
  if (submitBtn) submitBtn.textContent = 'Add Photo';
  renderPhotos(); persistUser(); showSaveBanner();
}
function updateHeroPreview(url) {
  const preview = document.getElementById('heroImagePreview');
  const img = document.getElementById('heroPreviewImg');
  const posWrap = document.getElementById('heroPositionWrap');
  if (url) {
    preview.style.display = 'block';
    posWrap.style.display = 'block';
    img.src = url;
  } else {
    preview.style.display = 'none';
    posWrap.style.display = 'none';
  }
}

function updateHeroPosition(val) {
  const img = document.getElementById('heroPreviewImg');
  if (img) img.style.objectPosition = `center ${val}%`;
  document.getElementById('heroPositionValue').value = val;
}

function updateHeroZoom(val) {
  const img = document.getElementById('heroPreviewImg');
  if (img) {
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.maxWidth = '';
    img.style.position = '';
    img.style.top = '';
    img.style.left = '';
    img.style.transform = `scale(${val/100})`;
    img.style.transformOrigin = 'center center';
    img.style.objectFit = 'cover';
  }
  document.getElementById('heroZoomValue').value = val;
}

function fitFullHeroImage() {
  const img = document.getElementById('heroPreviewImg');
  if (img) { img.style.objectFit = 'contain'; img.style.transform = 'none'; }
  document.getElementById('heroPositionSlider').value = 0;
  document.getElementById('heroPositionValue').value = 0;
  document.getElementById('heroZoomSlider').value = 100;
  document.getElementById('heroZoomValue').value = 100;
  document.getElementById('heroCropTopSlider').value = 0;
  document.getElementById('heroCropTopValue').value = 0;
  epk.heroImageFit = 'contain';
  persistUser(); showSaveBanner();
}

function resetHeroImageFit() {
  const img = document.getElementById('heroPreviewImg');
  if (img) { img.style.objectFit = 'cover'; }
  epk.heroImageFit = 'cover';
  persistUser(); showSaveBanner();
}

function updateHeroCropTop(val) {
  const img = document.getElementById('heroPreviewImg');
  if (img) { img.style.objectPosition = `center ${val}%`; }
  document.getElementById('heroCropTopValue').value = val;
  document.getElementById('heroPositionSlider').value = val;
  document.getElementById('heroPositionValue').value = val;
}

function updateBioPreview(url) {
  const preview = document.getElementById('bioImagePreview');
  const img = document.getElementById('bioPreviewImg');
  const posWrap = document.getElementById('bioPositionWrap');
  if (url) {
    preview.style.display = 'block';
    posWrap.style.display = 'block';
    img.src = url;
  } else {
    preview.style.display = 'none';
    posWrap.style.display = 'none';
  }
}

function fitFullBioImage() {
  // Sets object-fit to contain so entire image fits
  const img = document.getElementById('bioPreviewImg');
  if (img) {
    img.style.objectFit = 'contain';
    img.style.transform = 'none';
    img.style.background = 'transparent';
  }
  // Reset sliders
  document.getElementById('bioPositionSlider').value = 0;
  document.getElementById('bioPositionValue').value = 0;
  document.getElementById('bioZoomSlider').value = 100;
  document.getElementById('bioZoomValue').value = 100;
  document.getElementById('bioCropTopSlider').value = 0;
  document.getElementById('bioCropTopValue').value = 0;
  epk.bioImageFit = 'contain';
  persistUser(); showSaveBanner();
}

function resetBioImageFit() {
  const img = document.getElementById('bioPreviewImg');
  if (img) {
    img.style.objectFit = 'cover';
  }
  epk.bioImageFit = 'cover';
  persistUser(); showSaveBanner();
}

function updateBioCropTop(val) {
  const img = document.getElementById('bioPreviewImg');
  if (img) {
    // Use object-position to shift image up — effectively cropping empty top space
    const posVal = document.getElementById('bioPositionValue').value || 0;
    img.style.objectPosition = `center ${val}%`;
  }
  document.getElementById('bioCropTopValue').value = val;
  // Also sync with position slider
  document.getElementById('bioPositionSlider').value = val;
  document.getElementById('bioPositionValue').value = val;
}

function updateBioPosition(val) {
  const img = document.getElementById('bioPreviewImg');
  if (img) img.style.objectPosition = `center ${val}%`;
  document.getElementById('bioPositionValue').value = val;
}

function updateBioZoom(val) {
  const img = document.getElementById('bioPreviewImg');
  if (img) {
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.maxWidth = '';
    img.style.position = '';
    img.style.top = '';
    img.style.left = '';
    img.style.transform = `scale(${val/100})`;
    img.style.transformOrigin = 'center center';
    img.style.objectFit = 'cover';
  }
  document.getElementById('bioZoomValue').value = val;
}

function saveCareerLayout(val) {
  epk.careerLayout = val;
  persistUser(); showSaveBanner();
}

function loadCareerLayout() {
  const val = epk.careerLayout || 'stacked';
  document.querySelectorAll('input[name="careerLayout"]').forEach(r => r.checked = r.value === val);
}

function saveVideoLayout(val) {
  epk.videoLayout = val;
  persistUser(); showSaveBanner();
}

function loadVideoLayout() {
  const val = epk.videoLayout || 'grid';
  document.querySelectorAll('input[name="videoLayout"]').forEach(r => r.checked = r.value === val);
}


function saveGalleryLayout(val) {
  epk.galleryLayout = val;
  persistUser(); showSaveBanner();
}

function loadGalleryLayout() {
  const val = epk.galleryLayout || 'marquee';
  document.querySelectorAll('input[name="galleryLayout"]').forEach(r => r.checked = r.value === val);
}

function updatePhotoPreview(url) {
  const box = document.getElementById('photoPreviewBox');
  const img = document.getElementById('photoPreviewImg');
  if (url) {
    box.style.display = 'block';
    img.src = url;
  } else {
    box.style.display = 'none';
  }
}

function updatePreviewPositionSlider(val) {
  const pos = `center ${val}%`;
  document.getElementById('photoPositionValue').value = pos;
  const img = document.getElementById('photoPreviewImg');
  if (img) img.style.objectPosition = pos;
}

function removePhoto(i) { epk.photos.splice(i, 1); renderPhotos(); persistUser(); showSaveBanner(); }

// ─── BULK PHOTO METADATA EDITOR ────────────────────────────────────────────
let photoBulkMode = false;
let photoBulkSaveTimer = null;

function togglePhotoBulkEdit() {
  photoBulkMode = !photoBulkMode;
  const btn = document.getElementById('photoBulkToggle');
  const cardsList = document.getElementById('photosList');
  const bulkEditor = document.getElementById('photoBulkEditor');
  if (photoBulkMode) {
    btn.textContent = '✕ Exit Bulk Edit';
    btn.style.background = 'rgba(255,80,80,0.08)';
    btn.style.borderColor = 'rgba(255,80,80,0.3)';
    btn.style.color = '#ff8080';
    cardsList.style.display = 'none';
    bulkEditor.style.display = 'block';
    renderPhotoBulkEditor();
  } else {
    btn.textContent = '📊 Bulk Edit All Photos';
    btn.style.background = 'rgba(201,168,76,0.08)';
    btn.style.borderColor = 'rgba(201,168,76,0.3)';
    btn.style.color = 'var(--gold)';
    cardsList.style.display = '';
    bulkEditor.style.display = 'none';
    renderPhotos();
  }
}

function renderPhotoBulkEditor() {
  const container = document.getElementById('photoBulkEditor');
  const photos = epk.photos || [];

  const categoryOptions = [
    '', 'Personal Pictures', 'Family', 'Friends', 'Colleagues',
    'Festival', 'Concert', 'Graduation', 'Travel', 'Work & Career', 'Celebration'
  ].map(c => `<option value="${c}">${c || '— Category —'}</option>`).join('');

  const careerPhaseOptions = [
    '', 'Personal/Personal', 'Personal/Family', 'Personal/Friends',
    'Career/Music', 'Career/Corporate', 'Career/Education', 'Career/Government',
    'General/Event', 'General/Travel', 'General/Milestone'
  ].map(c => `<option value="${c}">${c || '— Career Phase —'}</option>`).join('');

  const mediaTypeOptions = [
    '', 'Concert', 'Family', 'Friends', 'Colleagues', 'Festival',
    'Graduation', 'Travel', 'Studio', 'Press', 'Event', 'Documentary'
  ].map(m => `<option value="${m}">${m || '— Media Type —'}</option>`).join('');

  const colStyle = (w) => `style="min-width:${w};padding:0.4rem 0.5rem;vertical-align:top;border-right:1px solid rgba(201,168,76,0.06)"`;
  const inputStyle = `style="width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(201,168,76,0.15);color:var(--warm-white);font-family:var(--font-mono);font-size:0.65rem;padding:0.3rem 0.4rem;box-sizing:border-box"`;
  const selectStyle = `style="width:100%;background:var(--dark-3);border:1px solid rgba(201,168,76,0.15);color:var(--gray-light);font-family:var(--font-mono);font-size:0.6rem;padding:0.3rem 0.4rem;box-sizing:border-box"`;

  const headerCols = [
    ['#', '32px'], ['Photo', '100px'], ['Caption', '160px'], ['Year', '70px'],
    ['Location', '130px'], ['Collection', '120px'], ['Category', '140px'],
    ['Career Phase', '160px'], ['Media Type', '130px'], ['People', '130px'],
    ['Tags', '120px'], ['Featured', '60px'], ['Del', '44px']
  ];

  const headers = headerCols.map(([label, w]) =>
    `<th style="min-width:${w};padding:0.4rem 0.5rem;font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.1em;color:var(--gold);text-transform:uppercase;border-right:1px solid rgba(201,168,76,0.06);white-space:nowrap;font-weight:400;background:var(--dark-3);border-bottom:1px solid rgba(201,168,76,0.2)">${label}</th>`
  ).join('');

  const rows = photos.map((p, i) => `
    <tr id="bulkRow_${i}" style="border-bottom:1px solid rgba(255,255,255,0.04)">
      <td ${colStyle('32px')} style="min-width:32px;padding:0.4rem 0.5rem;vertical-align:middle;text-align:center;font-family:var(--font-mono);font-size:0.6rem;color:var(--gray)">${i + 1}</td>
      <td ${colStyle('100px')} style="min-width:100px;padding:0.4rem 0.5rem;vertical-align:middle">
        <img src="${p.url || ''}" style="width:80px;height:60px;object-fit:cover;object-position:${p.position||'top center'};border:1px solid rgba(201,168,76,0.1)" onerror="this.style.opacity=0.2">
      </td>
      <td ${colStyle('160px')} style="min-width:160px;padding:0.4rem 0.5rem;vertical-align:top">
        <input ${inputStyle} type="text" value="${(p.caption || '').replace(/"/g,'&quot;')}" placeholder="Caption" oninput="bulkFieldChange(${i},'caption',this.value)" onchange="bulkFieldChange(${i},'caption',this.value)">
      </td>
      <td ${colStyle('70px')} style="min-width:70px;padding:0.4rem 0.5rem;vertical-align:top">
        <input ${inputStyle} type="number" value="${p.year || ''}" placeholder="Year" min="1990" max="2030" oninput="bulkFieldChange(${i},'year',this.value?parseInt(this.value):null)">
      </td>
      <td ${colStyle('130px')} style="min-width:130px;padding:0.4rem 0.5rem;vertical-align:top">
        <input ${inputStyle} type="text" value="${(p.location || '').replace(/"/g,'&quot;')}" placeholder="City, State" oninput="bulkFieldChange(${i},'location',this.value)">
      </td>
      <td ${colStyle('120px')} style="min-width:120px;padding:0.4rem 0.5rem;vertical-align:top">
        <input ${inputStyle} type="text" value="${(p.group || p.collection || '').replace(/"/g,'&quot;')}" placeholder="Collection name" oninput="bulkFieldChange(${i},'group',this.value);bulkFieldChange(${i},'collection',this.value)">
      </td>
      <td ${colStyle('140px')} style="min-width:140px;padding:0.4rem 0.5rem;vertical-align:top">
        <select ${selectStyle} onchange="bulkFieldChange(${i},'category',this.value)">
          ${categoryOptions.replace(`value="${p.category || ''}"`, `value="${p.category || ''}" selected`)}
        </select>
      </td>
      <td ${colStyle('160px')} style="min-width:160px;padding:0.4rem 0.5rem;vertical-align:top">
        <select ${selectStyle} onchange="bulkFieldChange(${i},'careerPhase',this.value)">
          ${careerPhaseOptions.replace(`value="${p.careerPhase || ''}"`, `value="${p.careerPhase || ''}" selected`)}
        </select>
      </td>
      <td ${colStyle('130px')} style="min-width:130px;padding:0.4rem 0.5rem;vertical-align:top">
        <select ${selectStyle} onchange="bulkFieldChange(${i},'mediaType',this.value)">
          ${mediaTypeOptions.replace(`value="${p.mediaType || ''}"`, `value="${p.mediaType || ''}" selected`)}
        </select>
      </td>
      <td ${colStyle('130px')} style="min-width:130px;padding:0.4rem 0.5rem;vertical-align:top">
        <input ${inputStyle} type="text" value="${(p.people || '').replace(/"/g,'&quot;')}" placeholder="Names" oninput="bulkFieldChange(${i},'people',this.value)">
      </td>
      <td ${colStyle('120px')} style="min-width:120px;padding:0.4rem 0.5rem;vertical-align:top">
        <input ${inputStyle} type="text" value="${(Array.isArray(p.tags)?p.tags.join(', '):(p.tags||'')).replace(/"/g,'&quot;')}" placeholder="tag1, tag2" oninput="bulkFieldChange(${i},'tags',this.value.split(',').map(t=>t.trim()).filter(Boolean))">
      </td>
      <td ${colStyle('60px')} style="min-width:60px;padding:0.4rem 0.5rem;vertical-align:middle;text-align:center">
        <input type="checkbox" ${p.featured ? 'checked' : ''} style="accent-color:var(--gold);width:16px;height:16px;cursor:pointer" onchange="bulkFieldChange(${i},'featured',this.checked)">
      </td>
      <td style="min-width:44px;padding:0.4rem 0.5rem;vertical-align:middle;text-align:center">
        <button onclick="bulkDeletePhoto(${i})" style="background:rgba(255,60,60,0.08);border:1px solid rgba(255,60,60,0.25);color:#ff8080;font-size:0.65rem;cursor:pointer;padding:0.2rem 0.45rem;font-family:var(--font-mono)">✕</button>
      </td>
    </tr>`).join('');

  container.innerHTML = `
    <div style="font-family:var(--font-mono);font-size:0.55rem;color:var(--gray);margin-bottom:0.5rem;letter-spacing:0.08em">
      EDITING ${photos.length} PHOTOS — EVERY CHANGE SAVES INSTANTLY &nbsp;·&nbsp; SCROLL RIGHT FOR MORE COLUMNS
    </div>
    <table style="border-collapse:collapse;width:100%;min-width:1200px;background:var(--dark-2)">
      <thead><tr>${headers}</tr></thead>
      <tbody id="photoBulkBody">${rows}</tbody>
    </table>`;
}

function bulkFieldChange(idx, field, value) {
  if (!epk.photos || !epk.photos[idx]) return;
  epk.photos[idx][field] = value;
  // Debounce save: reset timer on every keystroke, fire after 800ms of silence
  clearTimeout(photoBulkSaveTimer);
  photoBulkSaveTimer = setTimeout(() => {
    persistUser();
    // Show "Saved ✓" indicator
    const status = document.getElementById('photoBulkStatus');
    if (status) {
      status.style.opacity = '1';
      setTimeout(() => { status.style.opacity = '0'; }, 2000);
    }
  }, 800);
}

function bulkDeletePhoto(idx) {
  if (!confirm(`Delete photo "${epk.photos[idx]?.caption || 'photo ' + (idx+1)}"? This cannot be undone.`)) return;
  epk.photos.splice(idx, 1);
  persistUser();
  renderPhotoBulkEditor(); // re-render table with updated indices
  // Also update card view in background
  renderPhotos();
}
// ─── END BULK PHOTO EDITOR ──────────────────────────────────────────────────

// ASSETS
let editingAssetIdx = -1;
function renderAssets() {
  const container = document.getElementById('assetsList');
  container.innerHTML = '';
  (epk.assets || []).forEach((a, i) => {
    const badges = [
      a.visible === false ? '<span style="font-family:var(--font-mono);font-size:0.5rem;background:rgba(255,100,100,0.1);color:#ff6b6b;padding:0.15rem 0.5rem">HIDDEN</span>' : '',
      a.category ? `<span style="font-family:var(--font-mono);font-size:0.5rem;background:rgba(201,168,76,0.08);color:var(--gray);padding:0.15rem 0.5rem">${a.category}</span>` : '',
    ].filter(Boolean).join(' ');
    const downloads = a.downloads || 0;
    container.innerHTML += `
      <div class="editable-card" style="${a.visible===false?'opacity:0.5':''}">
        <div class="editable-card-header">
          <div style="flex:1">
            ${badges ? `<div style="display:flex;gap:0.3rem;flex-wrap:wrap;margin-bottom:0.3rem">${badges}</div>` : ''}
            <div class="editable-card-title">${a.title}</div>
            <div class="editable-card-subtitle">${a.btnLabel || ''}</div>
            ${downloads > 0 ? `<div style="font-family:var(--font-mono);font-size:0.55rem;color:var(--gold);margin-top:0.3rem">↓ ${downloads} download${downloads !== 1 ? 's' : ''}</div>` : ''}
          </div>
          <div class="card-actions">
            <button class="btn-card-action" onclick="editAsset(${i})">Edit</button>
            <button class="btn-card-action btn-card-delete" onclick="removeAsset(${i})">Delete</button>
          </div>
        </div>
        <p style="font-size:0.85rem;color:var(--gray)">${a.desc || ''}</p>
      </div>`;
  });
}
function editAsset(i) {
  editingAssetIdx = i;
  const a = epk.assets[i];
  document.getElementById('newAssetTitle').value = a.title || '';
  document.getElementById('newAssetCategory').value = a.category || '';
  document.getElementById('newAssetDesc').value = a.desc || '';
  document.getElementById('newAssetBtn').value = a.btnLabel || '';
  document.getElementById('newAssetUrl').value = a.url || '';
  document.getElementById('newAssetVisible').checked = a.visible !== false;
  document.getElementById('addAssetForm').classList.add('open');
  document.getElementById('addAssetForm').scrollIntoView({ behavior: 'smooth' });
  document.querySelector('#addAssetForm .add-form-title').textContent = 'Edit Asset';
}
function triggerAssetUpload() {
  const input = document.getElementById('assetFileInput');
  input.value = '';
  input.click();
  input.onchange = async function() {
    const file = input.files[0];
    if (!file) return;
    const btn = document.querySelector('[onclick="triggerAssetUpload()"]');
    const originalText = btn ? btn.textContent : '↑ Upload File';
    if (btn) { btn.textContent = 'Uploading...'; btn.disabled = true; }
    await uploadToR2(file, 'documents',
      (url) => {
        document.getElementById('newAssetUrl').value = url;
        if (!document.getElementById('newAssetBtn').value) {
          document.getElementById('newAssetBtn').value = 'Download ' + file.name.split('.').pop().toUpperCase() + ' →';
        }
        if (btn) { btn.textContent = '✓ Uploaded'; btn.style.color = '#7ec97e'; setTimeout(() => { btn.textContent = originalText; btn.style.color = ''; btn.disabled = false; }, 2000); }
      },
      (err) => showUploadError(btn, originalText, err)
    );
  };
}

function addAsset() {
  const title = document.getElementById('newAssetTitle').value.trim();
  const category = document.getElementById('newAssetCategory').value;
  const desc = document.getElementById('newAssetDesc').value.trim();
  const btnLabel = document.getElementById('newAssetBtn').value.trim();
  const url = document.getElementById('newAssetUrl').value.trim();
  const visible = document.getElementById('newAssetVisible').checked;
  if (!title) return;
  epk.assets = epk.assets || [];
  const assetData = { title, category, desc, btnLabel, url, visible, downloads: 0 };
  if (editingAssetIdx >= 0) {
    assetData.downloads = epk.assets[editingAssetIdx].downloads || 0;
    epk.assets[editingAssetIdx] = { ...epk.assets[editingAssetIdx], ...assetData };
    editingAssetIdx = -1;
    document.querySelector('#addAssetForm .add-form-title').textContent = 'New Asset';
  } else {
    epk.assets.push(assetData);
  }
  ['newAssetTitle','newAssetDesc','newAssetBtn','newAssetUrl'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('newAssetCategory').value = '';
  document.getElementById('newAssetVisible').checked = true;
  toggleAddForm('addAssetForm');
  renderAssets(); persistUser(); showSaveBanner();
}
function removeAsset(i) { epk.assets.splice(i, 1); renderAssets(); persistUser(); showSaveBanner(); }

// AWARDS
// PRESS & ARCHIVE
let pendingPressItems = [];

async function uploadPressDoc(i) {
  const input = document.getElementById(`pressFileInput_${i}`);
  input.value = '';
  input.onchange = async function() {
    const file = input.files[0];
    if (!file) return;
    const btn = document.getElementById(`pressUploadBtn_${i}`);
    if (btn) { btn.textContent = 'Uploading...'; btn.disabled = true; }
    try {
      const publicUrl = await uploadPdfToGitHub(file, 'press');
      pendingPressItems[i].url = publicUrl;
      const urlInput = document.getElementById(`pressUrl_${i}`);
      if (urlInput) urlInput.value = publicUrl;
      if (btn) { btn.textContent = '✓ Uploaded'; btn.style.color = '#7ec97e'; setTimeout(() => { btn.textContent = '↑ Upload PDF'; btn.style.color = ''; btn.disabled = false; }, 2000); }
    } catch(e) { if (btn) { btn.textContent = '↑ Upload PDF'; btn.disabled = false; } console.error('PDF upload failed', e); }
  };
  input.click();
}

function addPressItem() {
  pendingPressItems.push({ publication: '', location: '', year: '', summary: '', url: '' });
  renderPressItems();
  setTimeout(() => {
    const inputs = document.querySelectorAll('#pressItemsList .press-pub-input');
    if (inputs.length) inputs[inputs.length-1].focus();
  }, 50);
}

function removePressItem(i) {
  pendingPressItems.splice(i, 1);
  renderPressItems();
}

function renderPressItems() {
  const container = document.getElementById('pressItemsList');
  if (!container) return;
  container.innerHTML = pendingPressItems.map((p, i) => `
    <div style="background:var(--dark-3);border:1px solid rgba(201,168,76,0.1);padding:1rem;display:flex;flex-direction:column;gap:0.5rem">
      <div style="display:flex;gap:0.5rem">
        <input type="text" class="press-pub-input" placeholder="Publication (e.g. El Nuevo Herald)" value="${p.publication || ''}"
          oninput="pendingPressItems[${i}].publication=this.value"
          style="flex:2;background:var(--dark-2);border:1px solid rgba(255,255,255,0.08);color:var(--white);padding:0.5rem 0.75rem;font-size:0.8rem">
        <input type="text" placeholder="Location (e.g. Miami, FL)" value="${p.location || ''}"
          oninput="pendingPressItems[${i}].location=this.value"
          style="flex:1;background:var(--dark-2);border:1px solid rgba(255,255,255,0.08);color:var(--white);padding:0.5rem 0.75rem;font-size:0.8rem">
        <input type="text" placeholder="Year" value="${p.year || ''}"
          oninput="pendingPressItems[${i}].year=this.value"
          style="width:70px;background:var(--dark-2);border:1px solid rgba(255,255,255,0.08);color:var(--white);padding:0.5rem 0.75rem;font-size:0.8rem">
        <button onclick="removePressItem(${i})" style="background:none;border:none;color:var(--gray);cursor:pointer;padding:0.25rem 0.5rem;font-size:1rem">✕</button>
      </div>
      <textarea placeholder="Brief factual summary — e.g. 'Las Nenas del Swing listed among featured artists performing at Puerto Rico's Third AIDS Walk alongside Marc Anthony and Tony Vega.'"
        oninput="pendingPressItems[${i}].summary=this.value"
        rows="2" style="background:var(--dark-2);border:1px solid rgba(255,255,255,0.08);color:var(--white);padding:0.5rem 0.75rem;font-size:0.8rem;resize:vertical;font-family:inherit">${p.summary || ''}</textarea>
      <div style="display:flex;gap:0.5rem;align-items:center">
        <input type="url" id="pressUrl_${i}" placeholder="Archive link — or upload PDF below" value="${p.url || ''}"
          oninput="pendingPressItems[${i}].url=this.value"
          style="flex:1;background:var(--dark-2);border:1px solid rgba(255,255,255,0.08);color:var(--white);padding:0.5rem 0.75rem;font-size:0.8rem">
        <button onclick="uploadPressDoc(${i})" id="pressUploadBtn_${i}" style="font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.1em;text-transform:uppercase;background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.3);color:var(--gold);padding:0.5rem 0.85rem;cursor:pointer;white-space:nowrap">↑ Upload PDF</button>
        <input type="file" id="pressFileInput_${i}" accept=".pdf,.jpg,.jpeg,.png" style="display:none">
      </div>
    </div>`).join('');
}

// QR CODE / SMART SHARE — PHASE 5
let currentQRMode = 'artist';
let qrScanCounts = {};

const QR_MODE_CONFIG = {
  artist: {
    label: 'ARTIST QR',
    badge: 'ARTIST',
    emoji: '🎨',
    param: 'mode=artist',
    sections: ['bio','credits','music','videos','photos','booking','socials'],
    defaultOn: ['bio','credits','music','videos','socials'],
    tagline: 'EPK · Credits · Music · Videos · Socials'
  },
  career: {
    label: 'CAREER QR',
    badge: 'CAREER',
    emoji: '💼',
    param: 'mode=career',
    sections: ['bio','credits','assets','awards','booking','socials'],
    defaultOn: ['bio','credits','assets','awards'],
    tagline: 'Resume · Experience · Certifications · Assets'
  },
  event: {
    label: 'EVENT QR',
    badge: 'EVENT',
    emoji: '⚡',
    param: 'mode=event',
    sections: ['bio','credits','music','videos','assets','booking','socials'],
    defaultOn: ['bio','credits','music','socials'],
    tagline: 'Temporary · Expirable · Trackable'
  }
};

const SECTION_LABELS = {
  bio: 'Bio', credits: 'Credits', music: 'Music', videos: 'Videos',
  photos: 'Photos', assets: 'Assets', awards: 'Awards', connect: 'Connect', socials: 'Socials'
};

function initQRPanel() {
  const saved = JSON.parse(localStorage.getItem('porfolioid_qr_settings') || '{}');
  currentQRMode = saved.mode || 'artist';
  qrScanCounts = JSON.parse(localStorage.getItem('porfolioid_scan_counts') || '{}');

  // Restore event fields
  if (saved.eventName) document.getElementById('eventQRName') && (document.getElementById('eventQRName').value = saved.eventName);
  if (saved.eventExpiry) document.getElementById('eventQRExpiry') && (document.getElementById('eventQRExpiry').value = saved.eventExpiry);
  if (saved.eventNote) document.getElementById('eventQRNote') && (document.getElementById('eventQRNote').value = saved.eventNote);

  setQRMode(currentQRMode, true);
}

function setQRMode(mode, init) {
  currentQRMode = mode;

  // Update button styles
  ['artist','career','event'].forEach(m => {
    const btn = document.getElementById('qrMode-' + m);
    if (!btn) return;
    if (m === mode) {
      btn.style.border = '2px solid var(--gold)';
      btn.style.background = 'rgba(201,168,76,0.08)';
    } else {
      btn.style.border = '2px solid rgba(201,168,76,0.15)';
      btn.style.background = 'var(--dark-2)';
    }
  });

  // Show/hide event options
  const eventOpts = document.getElementById('eventQROptions');
  if (eventOpts) eventOpts.style.display = mode === 'event' ? 'block' : 'none';

  // Build section toggles
  buildQRSectionToggles(mode);

  // Update QR
  refreshQRCode();

  // Update share card preview
  updateShareCardPreview();

  // Save
  if (!init) saveQRSettings();
}

function buildQRSectionToggles(mode) {
  const container = document.getElementById('qrSectionToggles');
  if (!container) return;

  const config = QR_MODE_CONFIG[mode];
  const saved = JSON.parse(localStorage.getItem('porfolioid_qr_settings') || '{}');
  const savedSections = saved.sections && saved.sections[mode] ? saved.sections[mode] : config.defaultOn;

  container.innerHTML = config.sections.map(s => {
    const on = savedSections.includes(s);
    return `<label style="display:flex;align-items:center;gap:0.4rem;cursor:pointer;font-family:var(--font-mono);font-size:0.58rem;color:${on ? 'var(--white)' : 'var(--gray)'};background:${on ? 'rgba(201,168,76,0.1)' : 'var(--dark-3)'};border:1px solid ${on ? 'rgba(201,168,76,0.3)' : 'rgba(255,255,255,0.05)'};padding:0.4rem 0.75rem;transition:all 0.2s" id="qrtoggle-label-${s}">
      <input type="checkbox" id="qrtoggle-${s}" ${on ? 'checked' : ''} onchange="onQRSectionToggle('${s}')" style="accent-color:var(--gold)">
      ${SECTION_LABELS[s] || s}
    </label>`;
  }).join('');
}

function onQRSectionToggle(section) {
  const cb = document.getElementById('qrtoggle-' + section);
  const label = document.getElementById('qrtoggle-label-' + section);
  if (!cb || !label) return;
  if (cb.checked) {
    label.style.color = 'var(--white)';
    label.style.background = 'rgba(201,168,76,0.1)';
    label.style.border = '1px solid rgba(201,168,76,0.3)';
  } else {
    label.style.color = 'var(--gray)';
    label.style.background = 'var(--dark-3)';
    label.style.border = '1px solid rgba(255,255,255,0.05)';
  }
  updateShareCardPreview();
  saveQRSettings();
}

function getSelectedSections() {
  const config = QR_MODE_CONFIG[currentQRMode];
  return config.sections.filter(s => {
    const cb = document.getElementById('qrtoggle-' + s);
    return cb && cb.checked;
  });
}

function buildQRUrl() {
  const session = JSON.parse(localStorage.getItem('porfolioid_session') || '{}');
  const slug = session.slug || epk.slug || '';
  if (!slug) return '';

  let url = `https://porfolioid.com/epk.html?slug=${slug}&qr=${currentQRMode}`;

  if (currentQRMode === 'event') {
    const nameEl = document.getElementById('eventQRName');
    const expiryEl = document.getElementById('eventQRExpiry');
    if (nameEl && nameEl.value) url += `&event=${encodeURIComponent(nameEl.value)}`;
    if (expiryEl && expiryEl.value) url += `&expires=${expiryEl.value}`;
  }

  const sections = getSelectedSections();
  if (sections.length) url += `&sections=${sections.join(',')}`;

  return url;
}

function refreshQRCode() {
  const url = buildQRUrl();
  if (!url) return;

  const display = document.getElementById('qrCodeDisplay');
  const urlDisplay = document.getElementById('qrUrlDisplay');
  const modeLabel = document.getElementById('qrModeLabel');
  const config = QR_MODE_CONFIG[currentQRMode];

  if (urlDisplay) urlDisplay.textContent = url;
  if (modeLabel) modeLabel.textContent = config.label;

  if (display) {
    display.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}&color=000000&bgcolor=ffffff&margin=10" alt="QR Code" style="width:200px;height:200px;display:block">`;
  }

  // Update mini QR in share card
  const miniImg = document.getElementById('shareCardQRImg');
  if (miniImg) {
    miniImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(url)}&color=000000&bgcolor=ffffff&margin=5`;
  }
}

function updateShareCardPreview() {
  const config = QR_MODE_CONFIG[currentQRMode];
  const session = JSON.parse(localStorage.getItem('porfolioid_session') || '{}');
  const slug = session.slug || epk.slug || '';

  // Badge
  const badge = document.getElementById('shareCardModeBadge');
  if (badge) badge.textContent = config.badge;

  // Name
  const nameEl = document.getElementById('shareCardName');
  if (nameEl) nameEl.textContent = epk.name || 'Leslie Guerra';

  // Tagline
  const taglineEl = document.getElementById('shareCardTagline');
  if (taglineEl) {
    if (currentQRMode === 'event') {
      const evtName = document.getElementById('eventQRName');
      taglineEl.textContent = evtName && evtName.value ? '⚡ ' + evtName.value : config.tagline;
    } else {
      taglineEl.textContent = epk.tagline || config.tagline;
    }
  }

  // URL
  const urlEl = document.getElementById('shareCardUrl');
  if (urlEl) urlEl.textContent = slug ? `porfolioid.com/epk.html?slug=${slug}` : 'porfolioid.com';

  // Photo
  const img = document.getElementById('shareCardPhotoImg');
  const initial = document.getElementById('shareCardPhotoInitial');
  if (epk.photo) {
    if (img) { img.src = epk.photo; img.style.display = 'block'; }
    if (initial) initial.style.display = 'none';
  } else {
    if (img) img.style.display = 'none';
    if (initial) {
      initial.style.display = 'flex';
      initial.textContent = (epk.name || 'L')[0].toUpperCase();
    }
  }

  // Sections list
  const sections = getSelectedSections();
  const sectionsEl = document.getElementById('shareCardSections');
  if (sectionsEl) {
    sectionsEl.textContent = sections.map(s => SECTION_LABELS[s]).join(' · ');
  }

  // Scan count for event
  const scanCountEl = document.getElementById('scanCountNum');
  if (scanCountEl) {
    const key = currentQRMode === 'event' ? 'event_' + (document.getElementById('eventQRName') || {value:''}).value : currentQRMode;
    scanCountEl.textContent = qrScanCounts[key] || 0;
  }
}

function saveQRSettings() {
  const saved = JSON.parse(localStorage.getItem('porfolioid_qr_settings') || '{}');
  saved.mode = currentQRMode;

  // Save section selections per mode
  if (!saved.sections) saved.sections = {};
  saved.sections[currentQRMode] = getSelectedSections();

  // Save event fields
  const nameEl = document.getElementById('eventQRName');
  const expiryEl = document.getElementById('eventQRExpiry');
  const noteEl = document.getElementById('eventQRNote');
  if (nameEl) saved.eventName = nameEl.value;
  if (expiryEl) saved.eventExpiry = expiryEl.value;
  if (noteEl) saved.eventNote = noteEl.value;

  localStorage.setItem('porfolioid_qr_settings', JSON.stringify(saved));
}

function downloadQR() {
  const url = buildQRUrl();
  if (!url) return;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(url)}&color=000000&bgcolor=ffffff&margin=20`;
  const session = JSON.parse(localStorage.getItem('porfolioid_session') || '{}');
  const slug = session.slug || epk.slug || '';
  const a = document.createElement('a');
  a.href = qrUrl;
  a.download = `porfolioid-${currentQRMode}-qr-${slug}.png`;
  a.target = '_blank';
  a.click();
}

function downloadShareCard() {
  // Generate a downloadable version using html2canvas or just share as image link
  // For now, open the card as a printable page
  const url = buildQRUrl();
  if (!url) return;
  const session = JSON.parse(localStorage.getItem('porfolioid_session') || '{}');
  const slug = session.slug || epk.slug || '';
  const name = epk.name || 'PorfolioID';
  const config = QR_MODE_CONFIG[currentQRMode];
  const sections = getSelectedSections().map(s => SECTION_LABELS[s]).join(' · ');
  const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}&color=000000&bgcolor=ffffff&margin=10`;

  const cardHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Mono:wght@400;500&display=swap');
  body { margin:0; background:#080808; display:flex; align-items:center; justify-content:center; min-height:100vh; font-family:'DM Mono',monospace; }
  .card { width:420px; background:#0E0E0E; border:1px solid rgba(201,168,76,0.4); padding:2rem; position:relative; }
  .card::before { content:''; position:absolute; top:0; left:0; right:0; height:4px; background:linear-gradient(90deg,#C9A84C,#E8C97A,#C9A84C); }
  .top { display:flex; align-items:center; gap:1rem; margin-bottom:1.25rem; }
  .photo { width:60px; height:60px; border-radius:50%; border:2px solid #C9A84C; overflow:hidden; flex-shrink:0; background:#1C1C1C; display:flex; align-items:center; justify-content:center; }
  .photo img { width:100%; height:100%; object-fit:cover; }
  .name { font-family:'Playfair Display',serif; font-size:1.15rem; color:#F5F3EE; font-weight:700; }
  .tagline { font-size:0.55rem; color:#C9A84C; margin-top:0.2rem; }
  .badge { margin-left:auto; font-size:0.48rem; letter-spacing:0.12em; text-transform:uppercase; color:#000; background:#C9A84C; padding:0.3rem 0.7rem; align-self:flex-start; font-weight:600; }
  .sections { font-size:0.52rem; color:#888; margin-bottom:1.25rem; line-height:1.8; }
  .bottom { display:flex; align-items:flex-end; justify-content:space-between; gap:1rem; }
  .brand { font-size:0.45rem; letter-spacing:0.15em; text-transform:uppercase; color:#888; margin-bottom:0.25rem; }
  .url { font-size:0.5rem; color:#C9A84C; }
  .qr { background:white; padding:6px; }
  .qr img { display:block; width:60px; height:60px; }
  @media print { body { background:#080808; } }
</style>
<title>PorfolioID Share Card — ${name}</title></head>
<body>
<div class="card">
  <div class="top">
    <div class="photo">${epk && epk.photo ? `<img src="${epk.photo}">` : `<span style="font-family:'Playfair Display',serif;font-size:1.4rem;color:#C9A84C">${name[0]}</span>`}</div>
    <div>
      <div class="name">${name}</div>
      <div class="tagline">${epk && epk.tagline ? epk.tagline : config.tagline}</div>
    </div>
    <div class="badge">${config.badge}</div>
  </div>
  <div class="sections">${sections}</div>
  <div class="bottom">
    <div><div class="brand">PorfolioID</div><div class="url">porfolioid.com/epk.html?slug=${slug}</div></div>
    <div class="qr"><img src="${qrImgUrl}" alt="QR"></div>
  </div>
</div>
<script>window.onload=()=>setTimeout(()=>window.print(),500)<\/script>
</body></html>`;

  const blob = new Blob([cardHtml], { type: 'text/html' });
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, '_blank');
}

function shareCardVia(method) {
  const url = buildQRUrl();
  if (!url) return;
  const name = epk.name || 'My Portfolio';
  const config = QR_MODE_CONFIG[currentQRMode];
  const text = `${name} — ${config.label} on PorfolioID`;
  if (method === 'native' && navigator.share) {
    navigator.share({ title: text, url });
  } else {
    navigator.clipboard.writeText(url);
  }
}

function copyPortfolioLink() {
  const url = buildQRUrl();
  if (!url) return;
  navigator.clipboard.writeText(url).then(() => {
    const btn = document.getElementById('copyLinkBtn');
    if (btn) {
      btn.textContent = '✓ Copied!';
      btn.style.color = '#7ec97e';
      setTimeout(() => { btn.textContent = '⎘ Copy Link'; btn.style.color = ''; }, 2000);
    }
  });
}

function shareVia(method) {
  const url = buildQRUrl() || `https://porfolioid.com/epk.html?slug=${epk.slug || ''}`;
  const name = epk.name || 'My Portfolio';
  const config = QR_MODE_CONFIG[currentQRMode];
  const text = `${name} — ${config.label} on PorfolioID`;
  if (method === 'email') {
    window.location.href = `mailto:?subject=${encodeURIComponent(name + ' — PorfolioID')}&body=${encodeURIComponent(text + '\n\n' + url)}`;
  } else if (method === 'sms') {
    window.location.href = `sms:?body=${encodeURIComponent(text + ' ' + url)}`;
  } else if (method === 'native') {
    if (navigator.share) navigator.share({ title: text, url });
    else copyPortfolioLink();
  }
}

// Hook event inputs to live-update the card
document.addEventListener('DOMContentLoaded', () => {
  ['eventQRName','eventQRExpiry','eventQRNote'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => { refreshQRCode(); updateShareCardPreview(); saveQRSettings(); });
  });
});


// RESUME CARDS
let editingResumeIdx = -1;

function renderResumeCards() {
  const container = document.getElementById('resumeCardsList');
  if (!container) return;
  container.innerHTML = '';
  (epk.resumeCards || []).forEach((r, i) => {
    const skills = (r.skills || []).slice(0, 4).join(' · ');
    container.innerHTML += `
      <div class="editable-card">
        <div class="editable-card-header">
          <div style="flex:1">
            <div style="font-family:var(--font-mono);font-size:0.5rem;color:var(--gold);letter-spacing:0.15em;text-transform:uppercase;margin-bottom:0.25rem">${r.label || ''}</div>
            <div class="editable-card-title">${r.title}</div>
            <div class="editable-card-subtitle">${r.subtitle || ''}</div>
            ${skills ? `<div style="font-family:var(--font-mono);font-size:0.55rem;color:var(--gray);margin-top:0.25rem">${skills}</div>` : ''}
          </div>
          <div class="card-actions">
            <button class="btn-card-action" onclick="openResumeFile(${i})" title="Open the uploaded resume file" style="background:rgba(201,168,76,0.1);border-color:rgba(201,168,76,0.3);color:var(--gold)">↓ PDF</button>
            <button class="btn-card-action" onclick="editResumeCard(${i})">Edit</button>
            <button class="btn-card-action btn-card-delete" onclick="removeResumeCard(${i})">Delete</button>
          </div>
        </div>
      </div>`;
  });
  // Hide add button if 2 cards already
  const addBtn = document.getElementById('addResumeBtn');
  if (addBtn) addBtn.style.display = (epk.resumeCards || []).length >= 2 ? 'none' : '';
}

// Opens the actual uploaded/selected resume file in a new browser tab.
// Checks pdfUrl first (canonical field going forward), falls back through
// resumeUrl then the legacy url field for cards saved before each fix. Never
// writes or migrates data - read-only fallback, fields stay exactly as saved.
function openResumeFile(idx) {
  const r = epk.resumeCards[idx];
  if (!r) return;
  const fileUrl = r.pdfUrl || r.resumeUrl || r.url;
  if (!fileUrl) { alert('No PDF has been uploaded or selected for this card yet.'); return; }
  window.open(fileUrl, '_blank');
}

// PRESERVED for a possible future, separately-labeled "Generate Resume" action.
// No longer wired to the Resume Card's primary PDF button - see openResumeFile()
// above, which now opens the actual uploaded/selected file instead.
function generateResumePDF(idx) {
  const r = epk.resumeCards[idx];
  if (!r) return;

  const name = epk.name || 'Portfolio';
  const location = epk.location || '';
  const email = epk.bookingEmail || '';
  const phone = epk.bookingPhone || '';
  const skills = (r.skills || []).join(' · ');
  const portfolioUrl = `porfolioid.com/${epk.slug || ''}`;

  // Build experience/credit lines from credits
  const relevantCredits = (epk.credits || []).slice(0, 12).map(c =>
    `<tr>
      <td style="padding:0.4rem 0;border-bottom:1px solid #1a1a1a;font-size:0.75rem;color:#F5F3EE;font-weight:500">${c.title || ''}</td>
      <td style="padding:0.4rem 0;border-bottom:1px solid #1a1a1a;font-size:0.7rem;color:#C9A84C;text-align:right">${c.role || ''}</td>
      <td style="padding:0.4rem 0;border-bottom:1px solid #1a1a1a;font-size:0.65rem;color:#888;text-align:right;min-width:60px">${c.year || ''}</td>
    </tr>`
  ).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${name} — Resume | PorfolioID</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #080808; color: #F5F3EE; font-family: 'DM Sans', sans-serif; font-weight: 300; padding: 0; }
  .page { max-width: 800px; margin: 0 auto; padding: 3rem 3.5rem; min-height: 100vh; position: relative; }
  .page::before { content: ''; display: block; height: 4px; background: linear-gradient(90deg, #C9A84C, #E8C97A, #C9A84C); margin-bottom: 2.5rem; }
  .header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid rgba(201,168,76,0.2); }
  .name { font-family: 'Playfair Display', serif; font-size: 2.2rem; font-weight: 900; color: #F5F3EE; line-height: 1.1; }
  .label-tag { font-family: 'DM Mono', monospace; font-size: 0.55rem; letter-spacing: 0.2em; text-transform: uppercase; color: #C9A84C; margin-top: 0.5rem; }
  .title-line { font-family: 'Playfair Display', serif; font-size: 1rem; color: #BBBBBB; margin-top: 0.35rem; }
  .contact { text-align: right; }
  .contact div { font-family: 'DM Mono', monospace; font-size: 0.6rem; color: #888; margin-bottom: 0.35rem; }
  .contact .portfolio-link { color: #C9A84C; }
  .section-title { font-family: 'DM Mono', monospace; font-size: 0.55rem; letter-spacing: 0.2em; text-transform: uppercase; color: #C9A84C; margin-bottom: 1rem; margin-top: 1.75rem; padding-bottom: 0.4rem; border-bottom: 1px solid rgba(201,168,76,0.15); }
  .skills-block { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .skill-tag { font-family: 'DM Mono', monospace; font-size: 0.6rem; background: rgba(201,168,76,0.08); border: 1px solid rgba(201,168,76,0.2); color: #C9A84C; padding: 0.25rem 0.7rem; }
  .desc { font-size: 0.8rem; color: #BBBBBB; line-height: 1.7; }
  table { width: 100%; border-collapse: collapse; }
  .footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid rgba(201,168,76,0.1); display: flex; justify-content: space-between; align-items: center; }
  .footer-brand { font-family: 'Playfair Display', serif; font-size: 0.9rem; color: rgba(255,255,255,0.3); }
  .footer-brand span { color: #C9A84C; }
  .footer-url { font-family: 'DM Mono', monospace; font-size: 0.55rem; color: #C9A84C; }
  @media print { body { background: #080808 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="name">${name}</div>
      ${r.label ? `<div class="label-tag">${r.label}</div>` : ''}
      ${r.subtitle ? `<div class="title-line">${r.subtitle}</div>` : ''}
    </div>
    <div class="contact">
      ${location ? `<div>📍 ${location}</div>` : ''}
      ${email ? `<div>✉ ${email}</div>` : ''}
      ${phone ? `<div>📞 ${phone}</div>` : ''}
      <div class="portfolio-link">🔗 ${portfolioUrl}</div>
    </div>
  </div>

  ${r.desc ? `
  <div class="section-title">Professional Summary</div>
  <p class="desc">${r.desc}</p>` : ''}

  ${skills ? `
  <div class="section-title">Skills & Expertise</div>
  <div class="skills-block">
    ${(r.skills || []).map(s => `<span class="skill-tag">${s}</span>`).join('')}
  </div>` : ''}

  ${relevantCredits ? `
  <div class="section-title">Selected Credits & Experience</div>
  <table>${relevantCredits}</table>` : ''}

  <div class="footer">
    <div class="footer-brand">Porfolio<span>ID</span></div>
    <div class="footer-url">${portfolioUrl}</div>
  </div>
</div>
<script>window.onload = () => setTimeout(() => window.print(), 600);<\/script>
</body></html>`;

  const blob = new Blob([html], { type: 'text/html' });
  window.open(URL.createObjectURL(blob), '_blank');
}

function editResumeCard(i) {
  editingResumeIdx = i;
  const r = epk.resumeCards[i];
  document.getElementById('newResumeCardType').value = r.cardType || 'other';
  document.getElementById('newResumeLabel').value = r.label || '';
  document.getElementById('newResumeTitle').value = r.title || '';
  document.getElementById('newResumeSubtitle').value = r.subtitle || '';
  document.getElementById('newResumeSkills').value = (r.skills || []).join(', ');
  document.getElementById('newResumeDesc').value = r.desc || '';
  document.getElementById('newResumeUrl').value = r.pdfUrl || r.resumeUrl || r.url || '';
  document.getElementById('newResumePdfButtonLabel').value = r.pdfButtonLabel || '';
  document.getElementById('newResumeShowComingSoon').checked = !!r.showPdfComingSoon;
  document.getElementById('newResumeFooterText').value = r.footerText || '';
  document.getElementById('newResumeFullBio').value = r.fullBio || '';
  document.getElementById('addResumeForm').classList.add('open');
  document.getElementById('addResumeForm').scrollIntoView({ behavior: 'smooth' });
  document.querySelector('#addResumeForm .add-form-title').textContent = 'Edit Profile Card';
}

function triggerResumeUpload() {
  const input = document.getElementById('resumeFileInput');
  input.value = '';
  input.onchange = async function() {
    const file = input.files[0];
    if (!file) return;
    const btn = document.querySelector('[onclick="triggerResumeUpload()"]');
    if (btn) { btn.textContent = 'Uploading...'; btn.disabled = true; }
    try {
      const publicUrl = await uploadPdfToGitHub(file, 'assets');
      document.getElementById('newResumeUrl').value = publicUrl;
      if (btn) { btn.textContent = '✓ Uploaded'; btn.style.color = '#7ec97e'; setTimeout(() => { btn.textContent = '↑ Upload PDF'; btn.style.color = ''; btn.disabled = false; }, 2000); }
    } catch(e) { if (btn) { btn.textContent = '↑ Upload PDF'; btn.disabled = false; } console.error('PDF upload failed', e); }
  };
  input.click();
}

// Card Type dropdown prefills sensible defaults into the existing editable
// fields. Nothing is locked - the person can change any field afterward.
// Only fires when fields are currently empty for label/title-ish prefill
// behavior is intentionally NOT applied - this always overwrites the title/
// PDF button label/footer placeholders so picking a type gives an obvious,
// predictable starting point, matching the approved plan's examples.
function applyResumeCardTypeDefaults() {
  const type = document.getElementById('newResumeCardType').value;
  const titleEl = document.getElementById('newResumeTitle');
  const btnLabelEl = document.getElementById('newResumePdfButtonLabel');
  if (type === 'executive_resume') {
    if (!titleEl.value.trim()) titleEl.value = 'Executive Resume';
    if (!btnLabelEl.value.trim()) btnLabelEl.value = 'Download Resume';
  } else if (type === 'biography') {
    if (!titleEl.value.trim()) titleEl.value = 'About Leslie';
    if (!btnLabelEl.value.trim()) btnLabelEl.value = 'Download Biography';
  }
  // 'other' - no prefill, user controls everything manually
}

function addResumeCard() {
  const title = document.getElementById('newResumeTitle').value.trim();
  if (!title) return;
  // Canonical field going forward is pdfUrl (Profile Card system). resumeUrl/url
  // are preserved as read fallbacks for cards saved before this system existed -
  // openResumeFile() and the public renderer both still check them in order.
  const existingLegacyUrl = (editingResumeIdx >= 0 && epk.resumeCards && epk.resumeCards[editingResumeIdx])
    ? epk.resumeCards[editingResumeIdx].url
    : undefined;
  const existingLegacyResumeUrl = (editingResumeIdx >= 0 && epk.resumeCards && epk.resumeCards[editingResumeIdx])
    ? epk.resumeCards[editingResumeIdx].resumeUrl
    : undefined;
  const card = {
    cardType: document.getElementById('newResumeCardType').value,
    label: document.getElementById('newResumeLabel').value.trim(),
    title,
    subtitle: document.getElementById('newResumeSubtitle').value.trim(),
    skills: document.getElementById('newResumeSkills').value.split(',').map(s => s.trim()).filter(Boolean),
    desc: document.getElementById('newResumeDesc').value.trim(),
    pdfUrl: document.getElementById('newResumeUrl').value.trim(),
    pdfButtonLabel: document.getElementById('newResumePdfButtonLabel').value.trim(),
    showPdfComingSoon: document.getElementById('newResumeShowComingSoon').checked,
    footerText: document.getElementById('newResumeFooterText').value.trim(),
    fullBio: document.getElementById('newResumeFullBio').value.trim(),
  };
  if (existingLegacyUrl) card.url = existingLegacyUrl;
  if (existingLegacyResumeUrl) card.resumeUrl = existingLegacyResumeUrl;
  epk.resumeCards = epk.resumeCards || [];
  if (editingResumeIdx >= 0) {
    epk.resumeCards[editingResumeIdx] = card;
    editingResumeIdx = -1;
    document.querySelector('#addResumeForm .add-form-title').textContent = 'New Profile Card';
  } else {
    epk.resumeCards.push(card);
  }
  ['newResumeLabel','newResumeTitle','newResumeSubtitle','newResumeSkills','newResumeDesc','newResumeUrl','newResumePdfButtonLabel','newResumeFooterText','newResumeFullBio'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('newResumeShowComingSoon').checked = false;
  document.getElementById('newResumeCardType').value = 'other';
  toggleAddForm('addResumeForm');
  renderResumeCards(); persistUser(); showSaveBanner();
}

function removeResumeCard(i) { epk.resumeCards.splice(i, 1); renderResumeCards(); persistUser(); showSaveBanner(); }

function renderAwards() {
  const container = document.getElementById('awardsList');
  if (!container) return;
  container.innerHTML = '';
  const typeIcons = { award:'🏆', nomination:'🎯', degree:'🎓', certification:'📜', recognition:'⭐', honor:'🏅' };
  (epk.awards || []).forEach((a, i) => {
    const icon = typeIcons[a.type] || '🏆';
    const badges = [
      a.verified ? '<span style="font-family:var(--font-mono);font-size:0.5rem;background:rgba(201,168,76,0.15);color:var(--gold);padding:0.15rem 0.5rem">✓ VERIFIED</span>' : '',
      a.featured ? '<span style="font-family:var(--font-mono);font-size:0.5rem;background:rgba(255,255,255,0.06);color:var(--gray);padding:0.15rem 0.5rem">⭐ FEATURED</span>' : '',
      a.category ? `<span style="font-family:var(--font-mono);font-size:0.5rem;background:rgba(255,255,255,0.04);color:var(--gray);padding:0.15rem 0.5rem">${a.category}</span>` : '',
    ].filter(Boolean).join(' ');
    container.innerHTML += `
      <div class="editable-card">
        <div class="editable-card-header">
          <div style="display:flex;gap:0.75rem;align-items:flex-start;flex:1">
            <span style="font-size:1.4rem;line-height:1;flex-shrink:0;margin-top:0.1rem">${icon}</span>
            <div style="flex:1">
              ${badges ? `<div style="display:flex;gap:0.3rem;flex-wrap:wrap;margin-bottom:0.3rem">${badges}</div>` : ''}
              <div class="editable-card-title">${a.title}</div>
              <div class="editable-card-subtitle">${[a.org, a.year].filter(Boolean).join(' · ')}</div>
              ${a.proofLink ? `<a href="${a.proofLink}" target="_blank" style="font-family:var(--font-mono);font-size:0.5rem;color:var(--gold);text-decoration:none;letter-spacing:0.08em">✦ View Verification →</a>` : ''}
            </div>
          </div>
          <div class="card-actions">
            <button class="btn-card-action" onclick="editAward(${i})">Edit</button>
            <button class="btn-card-action btn-card-delete" onclick="removeAward(${i})">Delete</button>
          </div>
        </div>
        ${a.desc ? `<p style="font-size:0.85rem;color:var(--gray);margin-top:0.5rem;padding-left:2.25rem">${a.desc}</p>` : ''}
      </div>`;
  });
}
let editingAwardIdx = -1;
// AWARD PHOTOS
let pendingAwardPhotos = [];

function triggerAwardPhotoUpload() {
  const input = document.getElementById('awardPhotoInput');
  input.value = '';
  input.onchange = async function() {
    const files = Array.from(input.files);
    for (const file of files) {
      await uploadToR2(file, 'awards',
        (url) => {
          pendingAwardPhotos.push({url: url, caption: ''});
          renderAwardPhotosPreview();
        },
        (err) => { console.error('Award photo upload failed:', err); alert('Upload failed: ' + err); }
      );
    }
  };
  input.click();
}

function renderAwardPhotosPreview() {
  const preview = document.getElementById('awardPhotosPreview');
  if (!preview) return;
  preview.innerHTML = pendingAwardPhotos.map((p, i) => {
    const url = typeof p === 'object' ? p.url : p;
    const cap = typeof p === 'object' ? (p.caption || '') : '';
    return `<div style="display:flex;flex-direction:column;gap:0.25rem;margin-bottom:0.5rem">
      <div style="position:relative;display:inline-block">
        <img src="${url}" style="width:120px;height:90px;object-fit:cover;border:1px solid rgba(201,168,76,0.3);display:block" onerror="this.style.display='none'">
        <button onclick="pendingAwardPhotos.splice(${i},1);renderAwardPhotosPreview()" style="position:absolute;top:1px;right:1px;background:rgba(0,0,0,0.75);border:none;color:#fff;font-size:0.55rem;cursor:pointer;padding:1px 3px;line-height:1">✕</button>
      </div>
      <input type="text" value="${cap}" placeholder="Caption (optional)" oninput="if(typeof pendingAwardPhotos[${i}]==='object'){pendingAwardPhotos[${i}].caption=this.value}else{pendingAwardPhotos[${i}]={url:'${url}',caption:this.value}}" style="width:120px;background:rgba(255,255,255,0.04);border:1px solid rgba(201,168,76,0.15);color:var(--white);padding:0.25rem 0.4rem;font-size:0.6rem;font-family:var(--font-mono)">
    </div>`;
  }).join('');
}

function triggerAwardCertUpload() {
  const input = document.getElementById('awardCertInput');
  input.value = '';
  input.onchange = async function() {
    const file = input.files[0];
    if (!file) return;
    const btn = document.querySelector('[onclick="triggerAwardCertUpload()"]');
    if (btn) { btn.textContent = 'Uploading...'; btn.disabled = true; }
    try {
      const publicUrl = await uploadPdfToGitHub(file, 'awards');
      document.getElementById('newAwardCertUrl').value = publicUrl;
      if (btn) { btn.textContent = '✓ Uploaded'; btn.style.color = '#7ec97e'; setTimeout(() => { btn.textContent = '↑ Upload Certificate'; btn.style.color = ''; btn.disabled = false; }, 2000); }
    } catch(e) { if (btn) { btn.textContent = '↑ Upload Certificate'; btn.disabled = false; } console.error('PDF upload failed', e); }
  };
  input.click();
}

function editAward(i) {
  editingAwardIdx = i;
  const a = epk.awards[i];
  document.getElementById('newAwardTitle').value = a.title || '';
  document.getElementById('newAwardOrg').value = a.org || '';
  document.getElementById('newAwardYear').value = a.year || '';
  document.getElementById('newAwardType').value = a.type || 'award';
  document.getElementById('newAwardDesc').value = a.desc || '';
  document.getElementById('newAwardCategory').value = a.category || '';
  document.getElementById('newAwardProof').value = a.proofLink || '';
  document.getElementById('newAwardCertUrl').value = a.certUrl || '';
  document.getElementById('newAwardVerified').checked = a.verified || false;
  document.getElementById('newAwardFeatured').checked = a.featured || false;
  pendingAwardPhotos = [...(a.photos || [])];
  const psEl = document.getElementById('newAwardPhotoStyle'); if(psEl) psEl.value = a.photoStyle || 'thumbnails';
  renderAwardPhotosPreview();
  document.getElementById('addAwardForm').classList.add('open');
  document.getElementById('addAwardForm').scrollIntoView({ behavior: 'smooth' });
  document.querySelector('#addAwardForm .add-form-title').textContent = 'Edit Entry';
}
function addAward() {
  const title = document.getElementById('newAwardTitle').value.trim();
  const org = document.getElementById('newAwardOrg').value.trim();
  const year = document.getElementById('newAwardYear').value.trim();
  const type = document.getElementById('newAwardType').value;
  const desc = document.getElementById('newAwardDesc').value.trim();
  const category = document.getElementById('newAwardCategory').value.trim();
  const proofLink = document.getElementById('newAwardProof').value.trim();
  const certUrl = document.getElementById('newAwardCertUrl').value.trim();
  const verified = document.getElementById('newAwardVerified').checked;
  const featured = document.getElementById('newAwardFeatured').checked;
  if (!title) return;
  epk.awards = epk.awards || [];
  const photoStyle = (document.getElementById('newAwardPhotoStyle') || {}).value || 'thumbnails';
  const awardData = { title, org, year, type, desc, category, proofLink, certUrl, verified, featured, photoStyle, photos: [...pendingAwardPhotos] };
  if (editingAwardIdx >= 0) {
    epk.awards[editingAwardIdx] = { ...epk.awards[editingAwardIdx], ...awardData };
    editingAwardIdx = -1;
    document.querySelector('#addAwardForm .add-form-title').textContent = 'New Entry';
  } else {
    epk.awards.push(awardData);
  }
  ['newAwardTitle','newAwardOrg','newAwardYear','newAwardDesc','newAwardCategory','newAwardProof','newAwardCertUrl'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('newAwardVerified').checked = false;
  document.getElementById('newAwardFeatured').checked = false;
  pendingAwardPhotos = [];
  renderAwardPhotosPreview();
  toggleAddForm('addAwardForm');
  renderAwards(); persistUser(); showSaveBanner();
}
function removeAward(i) { epk.awards.splice(i, 1); renderAwards(); persistUser(); showSaveBanner(); }

// SOCIAL LINKS — Connect Hub dashboard

// ── RICH WEBSITE ENTRIES (title, url, description, icon) ──
function normalizeWebsites(val) {
  if (!val || (Array.isArray(val) && val.length === 0)) return [];
  const arr = Array.isArray(val) ? val : [val];
  return arr.map(v => {
    if (typeof v === 'string') return { url: v, title: '', description: '', icon: '' };
    return { url: v.url||'', title: v.title||'', description: v.description||'', icon: v.icon||'' };
  });
}

function renderWebsiteList() {
  const container = document.getElementById('websiteList');
  if (!container) return;
  const sites = normalizeWebsites(epk.socials && epk.socials.website);
  if (sites.length === 0) { container.innerHTML = ''; return; }
  container.innerHTML = sites.map((site, i) => `
    <div style="background:var(--dark-2);border:1px solid rgba(201,168,76,0.12);padding:1rem;margin-bottom:0.75rem;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.5rem;">
        <div>
          <label style="font-family:var(--font-mono);font-size:0.52rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);opacity:0.7;display:block;margin-bottom:0.3rem;">Title</label>
          <input type="text" value="${site.title || ''}" placeholder="e.g. My Portfolio"
            style="width:100%;background:var(--dark-3);border:1px solid rgba(201,168,76,0.12);color:var(--white);padding:0.65rem 0.85rem;font-family:var(--font-body);font-size:0.85rem;outline:none;box-sizing:border-box"
            oninput="updateWebsite(${i},'title',this.value)">
        </div>
        <div>
          <label style="font-family:var(--font-mono);font-size:0.52rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);opacity:0.7;display:block;margin-bottom:0.3rem;">URL</label>
          <input type="url" value="${site.url || ''}" placeholder="https://yourwebsite.com"
            style="width:100%;background:var(--dark-3);border:1px solid rgba(201,168,76,0.12);color:var(--white);padding:0.65rem 0.85rem;font-family:var(--font-body);font-size:0.85rem;outline:none;box-sizing:border-box"
            oninput="updateWebsite(${i},'url',this.value)">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.5rem;">
        <div>
          <label style="font-family:var(--font-mono);font-size:0.52rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);opacity:0.7;display:block;margin-bottom:0.3rem;">Description <span style="opacity:0.5;font-size:0.45rem">(optional)</span></label>
          <input type="text" value="${site.description || ''}" placeholder="e.g. Official Portfolio & Profile"
            style="width:100%;background:var(--dark-3);border:1px solid rgba(201,168,76,0.12);color:var(--white);padding:0.65rem 0.85rem;font-family:var(--font-body);font-size:0.85rem;outline:none;box-sizing:border-box"
            oninput="updateWebsite(${i},'description',this.value)">
        </div>
        <div>
          <label style="font-family:var(--font-mono);font-size:0.52rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);opacity:0.7;display:block;margin-bottom:0.3rem;">Icon URL <span style="opacity:0.5;font-size:0.45rem">(optional — favicon or logo)</span></label>
          <input type="url" value="${site.icon || ''}" placeholder="https://yoursite.com/favicon.ico"
            style="width:100%;background:var(--dark-3);border:1px solid rgba(201,168,76,0.12);color:var(--white);padding:0.65rem 0.85rem;font-family:var(--font-body);font-size:0.85rem;outline:none;box-sizing:border-box"
            oninput="updateWebsite(${i},'icon',this.value)">
        </div>
      </div>
      <button onclick="removeWebsite(${i})"
        style="background:none;border:1px solid rgba(255,100,100,0.3);color:#ff6b6b;padding:0.4rem 0.75rem;cursor:pointer;font-family:var(--font-mono);font-size:0.55rem;transition:all 0.2s"
        onmouseover="this.style.borderColor='#ff6b6b'" onmouseout="this.style.borderColor='rgba(255,100,100,0.3)'">✕ Remove</button>
    </div>`).join('');
}

function addWebsite() {
  epk.socials = epk.socials || {};
  const sites = normalizeWebsites(epk.socials.website);
  sites.push({ url: '', title: '', description: '', icon: '' });
  epk.socials.website = sites;
  renderWebsiteList();
}

function updateWebsite(idx, field, value) {
  epk.socials = epk.socials || {};
  const sites = normalizeWebsites(epk.socials.website);
  if (sites[idx]) {
    sites[idx][field] = value;
    epk.socials.website = sites;
  }
}

function removeWebsite(idx) {
  epk.socials = epk.socials || {};
  const sites = normalizeWebsites(epk.socials.website);
  sites.splice(idx, 1);
  epk.socials.website = sites;
  renderWebsiteList();
  persistUser(); showSaveBanner();
}

function renderSocialList(platform, placeholder) {
  const container = document.getElementById(platform + 'List');
  if (!container) return;
  const values = (epk.socials && epk.socials[platform]) || [];
  const arr = Array.isArray(values) ? values : (values ? [values] : []);
  container.innerHTML = arr.map((url, i) => `
    <div style="display:flex;gap:0.5rem;margin-bottom:0.5rem;align-items:center">
      <input type="url" value="${url}" placeholder="${placeholder}"
        style="flex:1;background:var(--dark-3);border:1px solid rgba(201,168,76,0.12);color:var(--white);padding:0.8rem 1rem;font-family:var(--font-body);font-size:0.9rem;outline:none"
        oninput="updateSocialField('${platform}',${i},this.value)">
      <button onclick="removeSocialField('${platform}',${i})"
        style="background:none;border:1px solid rgba(255,100,100,0.3);color:#ff6b6b;padding:0.6rem 0.75rem;cursor:pointer;font-family:var(--font-mono);font-size:0.6rem;white-space:nowrap;transition:all 0.2s"
        onmouseover="this.style.borderColor='#ff6b6b'" onmouseout="this.style.borderColor='rgba(255,100,100,0.3)'">✕ Remove</button>
    </div>`).join('');
}

function addSocialField(platform, placeholder) {
  epk.socials = epk.socials || {};
  const existing = epk.socials[platform];
  const arr = Array.isArray(existing) ? existing : (existing ? [existing] : []);
  arr.push('');
  epk.socials[platform] = arr;
  renderSocialList(platform, placeholder);
}

function removeSocialField(platform, idx) {
  const arr = epk.socials[platform] || [];
  arr.splice(idx, 1);
  epk.socials[platform] = arr;
  const placeholders = { instagram:'https://instagram.com/yourhandle', facebook:'https://facebook.com/yourpage', website:'https://yourwebsite.com' };
  renderSocialList(platform, placeholders[platform]);
  persistUser(); showSaveBanner();
}

function updateSocialField(platform, idx, value) {
  if (!epk.socials) epk.socials = {};
  const arr = Array.isArray(epk.socials[platform]) ? epk.socials[platform] : [];
  arr[idx] = value;
  epk.socials[platform] = arr;
}

function saveSocials() {
  epk.socials = epk.socials || {};
  epk.socials.tiktok = document.getElementById('socialTiktok').value.trim();
  epk.socials.tiktok_followers = document.getElementById('socialTiktok_followers').value.trim();
  epk.socials.linkedin = document.getElementById('socialLinkedin').value.trim();
  epk.socials.linkedin_followers = document.getElementById('socialLinkedin_followers').value.trim();
  epk.socials.spotify = document.getElementById('socialSpotify').value.trim();
  epk.socials.spotify_followers = document.getElementById('socialSpotify_followers').value.trim();
  epk.socials.appleMusic = document.getElementById('socialAppleMusic').value.trim();
  epk.socials.youtube = document.getElementById('socialYoutube').value.trim();
  epk.socials.youtube_followers = document.getElementById('socialYoutube_followers').value.trim();
  epk.socials.soundcloud = document.getElementById('socialSoundcloud').value.trim();
  epk.socials.tidal = document.getElementById('socialTidal').value.trim();
  epk.socials.bandcamp = document.getElementById('socialBandcamp').value.trim();
  const amazonEl = document.getElementById('socialAmazon');
  if (amazonEl) epk.socials.amazon = amazonEl.value.trim() || undefined;
  // Additional platforms
  const newPlatforms = ['threads','x','snapchat','pinterest','reddit','discord','twitch','bluesky','telegram','tumblr','mastodon','wechat','clubhouse','dribbble','strava','letterboxd','quora'];
  newPlatforms.forEach(p => {
    const el = document.getElementById('social' + p.charAt(0).toUpperCase() + p.slice(1));
    if (el) epk.socials[p] = el.value.trim() || undefined;
  });
  epk.socials.instagram_followers = document.getElementById('socialInstagram_followers') ? document.getElementById('socialInstagram_followers').value.trim() : (epk.socials.instagram_followers || '');
  const metricsEl = document.getElementById('socialShowMetrics');
  if (metricsEl) epk.socials.showMetrics = metricsEl.checked;
  ['instagram','facebook'].forEach(p => {
    if (Array.isArray(epk.socials[p])) {
      epk.socials[p] = epk.socials[p].filter(v => v && v.trim());
    }
  });
  // Normalize website as rich objects, filter empty URLs
  if (epk.socials.website) {
    const wSites = normalizeWebsites(epk.socials.website).filter(w => w.url && w.url.trim());
    epk.socials.website = wSites.length ? wSites : [];
  }
  persistUser(); showSaveBanner();
}

function loadSocials() {
  const s = epk.socials || {};
  ['instagram','facebook'].forEach(p => {
    const placeholders = { instagram:'https://instagram.com/yourhandle', facebook:'https://facebook.com/yourpage' };
    const val = s[p];
    epk.socials = epk.socials || {};
    epk.socials[p] = Array.isArray(val) ? val : (val ? [val] : []);
    renderSocialList(p, placeholders[p]);
  });
  // Load website as rich objects
  if (s.website !== undefined) {
    epk.socials = epk.socials || {};
    epk.socials.website = normalizeWebsites(s.website);
  }
  renderWebsiteList();
  const singles = { tiktok:'socialTiktok', linkedin:'socialLinkedin', spotify:'socialSpotify', appleMusic:'socialAppleMusic', youtube:'socialYoutube', soundcloud:'socialSoundcloud', tidal:'socialTidal', bandcamp:'socialBandcamp', amazon:'socialAmazon', threads:'socialThreads', x:'socialX', snapchat:'socialSnapchat', pinterest:'socialPinterest', reddit:'socialReddit', discord:'socialDiscord', twitch:'socialTwitch', bluesky:'socialBluesky', telegram:'socialTelegram', tumblr:'socialTumblr', mastodon:'socialMastodon', wechat:'socialWechat', clubhouse:'socialClubhouse', dribbble:'socialDribbble', strava:'socialStrava', letterboxd:'socialLetterboxd', quora:'socialQuora' };
  ['tiktok','linkedin','spotify','youtube'].forEach(k => {
    const el = document.getElementById('social' + k.charAt(0).toUpperCase() + k.slice(1) + '_followers');
    if (el) el.value = s[k + '_followers'] || '';
  });
  const igFollEl = document.getElementById('socialInstagram_followers');
  if (igFollEl) igFollEl.value = s.instagram_followers || '';
  Object.entries(singles).forEach(([key, elId]) => {
    const el = document.getElementById(elId);
    if (el) el.value = s[key] || '';
  });
  // Load metrics toggle — default ON
  const metricsEl = document.getElementById('socialShowMetrics');
  if (metricsEl) metricsEl.checked = s.showMetrics !== false && s.showMetrics !== 'false';
}

// BOOKING TOGGLE
function toggleBooking() {
  epk.bookingEnabled = document.getElementById('bookingToggle').checked;
  persistUser(); showSaveBanner();
}

function loadBookingToggle() {
  const toggle = document.getElementById('bookingToggle');
  if (toggle) toggle.checked = epk.bookingEnabled !== false;
}

// IDENTITY BLOCK
function saveIdentityBlock() {
  epk.identityBlock = epk.identityBlock || {};
  const ib = epk.identityBlock;
  ib.availabilityEnabled = document.getElementById('identityAvailabilityEnabled').checked;
  ib.rolesEnabled = document.getElementById('identityRolesEnabled').checked;
  ib.featuredEnabled = document.getElementById('identityFeaturedEnabled').checked;
  ib.featuredCreditIdx = document.getElementById('featuredCreditSelect').value;
  ib.verifiedEnabled = document.getElementById('identityVerifiedEnabled').checked;
  ib.verificationStatus = document.getElementById('verificationStatus').value.trim();
  ib.languagesEnabled = document.getElementById('identityLanguagesEnabled').checked;
  ib.repEnabled = document.getElementById('identityRepEnabled').checked;
  ib.repName = document.getElementById('repName').value.trim();
  ib.repRole = document.getElementById('repRole').value.trim();
  ib.repContact = document.getElementById('repContact').value.trim();
  ib.timelineEnabled = document.getElementById('identityTimelineEnabled').checked;
  persistUser(); showSaveBanner();
}

function loadIdentityBlock() {
  const ib = epk.identityBlock || {};
  epk.identityBlock = ib;

  // Checkboxes
  document.getElementById('identityAvailabilityEnabled').checked = ib.availabilityEnabled || false;
  document.getElementById('identityRolesEnabled').checked = ib.rolesEnabled || false;
  document.getElementById('identityFeaturedEnabled').checked = ib.featuredEnabled || false;
  document.getElementById('identityVerifiedEnabled').checked = ib.verifiedEnabled || false;
  document.getElementById('identityLanguagesEnabled').checked = ib.languagesEnabled || false;
  document.getElementById('identityRepEnabled').checked = ib.repEnabled || false;
  document.getElementById('identityTimelineEnabled').checked = ib.timelineEnabled || false;

  // Single fields
  document.getElementById('verificationStatus').value = ib.verificationStatus || '';
  document.getElementById('repName').value = ib.repName || '';
  document.getElementById('repRole').value = ib.repRole || '';
  document.getElementById('repContact').value = ib.repContact || '';

  // Tag lists
  ib.availabilityBadges = ib.availabilityBadges || [];
  ib.industryRoles = ib.industryRoles || [];
  ib.languages = ib.languages || [];
  ib.timeline = ib.timeline || [];
  renderIdentityTags('availabilityBadges', 'availabilityBadgesList');
  renderIdentityTags('industryRoles', 'industryRolesList');
  renderIdentityTags('languages', 'languagesList');
  renderTimeline();

  // Featured credit dropdown
  populateFeaturedCreditSelect(ib.featuredCreditIdx || '');
}

function populateFeaturedCreditSelect(selectedVal) {
  const sel = document.getElementById('featuredCreditSelect');
  sel.innerHTML = '<option value="">— Select a credit to feature —</option>';
  (epk.credits || []).forEach((c, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `${c.artist} · ${c.role}${c.years ? ' · ' + c.years : ''}`;
    if (String(i) === String(selectedVal)) opt.selected = true;
    sel.appendChild(opt);
  });
}

function renderIdentityTags(key, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const arr = epk.identityBlock[key] || [];
  container.innerHTML = arr.map((t, i) => `
    <div class="tag">${t}
      <button class="tag-remove" onclick="removeIdentityTag('${key}','${containerId}',${i})">×</button>
    </div>`).join('');
}

function addIdentityTag(key, inputId, containerId) {
  const val = document.getElementById(inputId).value.trim();
  if (!val) return;
  epk.identityBlock = epk.identityBlock || {};
  epk.identityBlock[key] = epk.identityBlock[key] || [];
  epk.identityBlock[key].push(val);
  document.getElementById(inputId).value = '';
  renderIdentityTags(key, containerId);
  saveIdentityBlock();
}

function removeIdentityTag(key, containerId, idx) {
  epk.identityBlock[key].splice(idx, 1);
  renderIdentityTags(key, containerId);
  saveIdentityBlock();
}

function renderTimeline() {
  const container = document.getElementById('timelineList');
  if (!container) return;
  const arr = epk.identityBlock.timeline || [];
  container.innerHTML = arr.map((m, i) => `
    <div style="display:flex;align-items:center;gap:0.75rem;padding:0.5rem 0;border-bottom:1px solid rgba(201,168,76,0.06)">
      <span style="font-family:var(--font-mono);font-size:0.65rem;color:var(--gold);min-width:40px">${m.year}</span>
      <span style="font-size:0.85rem;color:var(--gray-light);flex:1">${m.milestone}</span>
      <button class="tag-remove" onclick="removeTimelineMilestone(${i})">×</button>
    </div>`).join('');
}

function addTimelineMilestone() {
  const year = document.getElementById('newTimelineYear').value.trim();
  const milestone = document.getElementById('newTimelineMilestone').value.trim();
  if (!year || !milestone) return;
  epk.identityBlock = epk.identityBlock || {};
  epk.identityBlock.timeline = epk.identityBlock.timeline || [];
  epk.identityBlock.timeline.push({ year, milestone });
  epk.identityBlock.timeline.sort((a, b) => a.year - b.year);
  document.getElementById('newTimelineYear').value = '';
  document.getElementById('newTimelineMilestone').value = '';
  renderTimeline();
  saveIdentityBlock();
}

function removeTimelineMilestone(i) {
  epk.identityBlock.timeline.splice(i, 1);
  renderTimeline();
  saveIdentityBlock();
}

function logout() {
  localStorage.removeItem('porfolioid_session');
  window.location.href = '/login.html';
}

init();

// ── SPANISH TRANSLATION ──
function loadSpanish() {
  const epk = window._epkData || window.epk || {};
  const shortBio = document.getElementById('esShortBio');
  const bio = document.getElementById('esBio');
  const taglines = document.getElementById('esTaglines');
  if (shortBio) shortBio.value = epk.shortBioES || epk.es?.shortBio || '';
  if (bio) bio.value = epk.bioFullES || epk.bioES || epk.es?.bio || '';
  if (taglines) taglines.value = (epk.es?.taglines || []).join('\n');
}

async function saveSpanish() {
  const epk = window._epkData;
  if (!epk) return;
  epk.shortBioES = document.getElementById('esShortBio')?.value || '';
  epk.bioFullES = document.getElementById('esBio')?.value || '';
  epk.bioES = epk.bioFullES;
  window._epkData = epk;
  const taglinesRaw = document.getElementById('esTaglines')?.value || '';
  if (!epk.es) epk.es = {};
  epk.es.taglines = taglinesRaw.split('\n').map(t => t.trim()).filter(Boolean);

  const slug = currentUser?.slug;
  if (!slug) { showToast('Could not find slug'); return; }
  try {
    const res = await fetch('/.netlify/functions/epk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save', slug, data: epk })
    });
    if (res.ok) showToast('Spanish content saved ✓');
    else showToast('Save failed');
  } catch(e) { showToast('Error saving'); }
}

// ── AVAILABILITY CATEGORY CARDS (grouped by niche) ──
const CATEGORY_GROUPS = [
  { title: '🎵 Music & Entertainment', items: [
    { id: 'live', label: 'Live Performances' },
    { id: 'studio', label: 'Studio Sessions' },
    { id: 'features', label: 'Features / Collabs' },
    { id: 'touring', label: 'Touring' },
    { id: 'hosting', label: 'Hosting / MC' },
    { id: 'ar', label: 'A&R Consulting' },
    { id: 'arcoordinator', label: 'A&R Coordinator' },
    { id: 'creative', label: 'Creative Direction' },
    { id: 'tourcoordinator', label: 'Tour Coordinator' },
    { id: 'productioncoordinator', label: 'Production Coordinator' },
    { id: 'artistmanager', label: 'Artist Manager' },
    { id: 'talentscout', label: 'Talent Scout' },
  ]},
  { title: '📣 Media & Marketing', items: [
    { id: 'media', label: 'Media / Press' },
    { id: 'marketing', label: 'Marketing / PR' },
    { id: 'marketingcoordinator', label: 'Marketing Coordinator' },
    { id: 'socialmediamanager', label: 'Social Media Manager' },
    { id: 'brandpartnerships', label: 'Brand Partnerships' },
  ]},
  { title: '💼 Professional & Admin', items: [
    { id: 'professional', label: 'Professional' },
    { id: 'government', label: 'Government' },
    { id: 'governmentliaison', label: 'Government Liaison' },
    { id: 'administration', label: 'Administration' },
    { id: 'adminsupport', label: 'Administrative Support' },
    { id: 'crm', label: 'CRM' },
    { id: 'sales', label: 'Sales' },
    { id: 'compliancespecialist', label: 'Compliance Specialist' },
    { id: 'projectcoordinator', label: 'Project Coordinator' },
    { id: 'customersuccess', label: 'Customer Success Rep' },
    { id: 'consultant', label: 'Consultant' },
    { id: 'entrepreneur', label: 'Entrepreneur' },
  ]},
  { title: '🤝 Assistant & Support Roles', items: [
    { id: 'personalassistant', label: 'Personal Assistant' },
    { id: 'executiveassistant', label: 'Executive Assistant' },
    { id: 'virtualassistant', label: 'Virtual Assistant' },
    { id: 'translator', label: 'Bilingual Translator / Interpreter' },
  ]},
  { title: '💻 Tech & Socials', items: [
    { id: 'technical', label: 'Technical' },
  ]},
  { title: '📌 Other', items: [
    { id: 'armedforces', label: 'Armed Forces' },
    { id: 'jobhunter', label: 'Job Hunter / Open to Work' },
    { id: 'other', label: 'Other' },
  ]},
];
const ALL_CATEGORY_IDS = CATEGORY_GROUPS.flatMap(g => g.items.map(i => i.id));
let _selectedCategories = [];

function renderCategoryCardGroups() {
  const container = document.getElementById('categoryCardGroups');
  if (!container) return;
  container.innerHTML = CATEGORY_GROUPS.map(group => `
    <div style="margin-bottom:1.75rem">
      <div style="font-family:var(--font-mono);font-size:0.65rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);margin-bottom:0.85rem">${group.title}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:0.75rem">
        ${group.items.map(item => {
          const active = _selectedCategories.includes(item.id);
          return `<div onclick="toggleCategoryCard('${item.id}')" id="catcard_${item.id}"
            style="background:${active ? 'rgba(201,168,76,0.08)' : 'var(--dark-2)'};border:1px solid ${active ? 'var(--gold)' : 'rgba(201,168,76,0.12)'};
            padding:0.9rem 1rem;cursor:pointer;transition:all 0.15s;position:relative;display:flex;align-items:center;justify-content:space-between;gap:0.5rem">
            <span style="font-family:var(--font-mono);font-size:0.78rem;color:${active ? 'var(--white)' : 'var(--gray-light)'}">${item.label}</span>
            ${active ? '<span style="color:var(--gold);font-size:0.9rem;flex-shrink:0">✓</span>' : ''}
          </div>`;
        }).join('')}
      </div>
    </div>
  `).join('');
}

function toggleCategoryCard(id) {
  if (_selectedCategories.includes(id)) {
    _selectedCategories = _selectedCategories.filter(c => c !== id);
  } else {
    _selectedCategories.push(id);
  }
  renderCategoryCardGroups();
  const otherInp = document.getElementById('bcat_other_input');
  if (otherInp) otherInp.style.display = _selectedCategories.includes('other') ? 'block' : 'none';
}

// ── CAREER TYPE PANEL ──
const CAREER_TYPES = [
  { id: 'creative',     icon: '🎤', name: 'Creative / Artist',        desc: 'Performer, recording artist, visual artist, musician.' },
  { id: 'corporate',    icon: '💼', name: 'Corporate Professional',    desc: 'Executive, manager, specialist in business or ops.' },
  { id: 'freelancer',   icon: '🔧', name: 'Freelancer',               desc: 'Independent contractor across clients and projects.' },
  { id: 'entrepreneur', icon: '🚀', name: 'Entrepreneur',             desc: 'Founder, startup builder, business owner.' },
  { id: 'media',        icon: '🎬', name: 'Media / Entertainment',     desc: 'Industry professional in music, film, TV, events.' },
  { id: 'tech',         icon: '💻', name: 'Tech / Data',              desc: 'Developer, analyst, engineer, product manager.' },
  { id: 'academic',     icon: '🎓', name: 'Academic / Research',      desc: 'Professor, researcher, scientist, educator.' },
  { id: 'hybrid',       icon: '⚡', name: 'Hybrid / Multi-hyphenate', desc: 'You wear multiple hats. Pick up to 2 types.' },
];

const CAREER_LABELS = {
  creative:     { credits: 'Credits', booking: 'Booking', assets: 'Media Kit', bio: 'Artist Bio' },
  corporate:    { credits: 'Experience', booking: 'Available For', assets: 'Professional Assets', bio: 'Professional Summary' },
  freelancer:   { credits: 'Projects', booking: 'Hire Me', assets: 'Portfolio Assets', bio: 'About Me' },
  entrepreneur: { credits: 'Ventures', booking: 'Connect', assets: 'Resources', bio: 'Founder Story' },
  media:        { credits: 'Credits', booking: 'Booking', assets: 'Press Kit', bio: 'Industry Bio' },
  tech:         { credits: 'Projects', booking: 'Available For', assets: 'Case Studies', bio: 'Professional Summary' },
  academic:     { credits: 'Publications', booking: 'Speaking', assets: 'Research', bio: 'Academic Profile' },
  hybrid:       { credits: 'Credits & Experience', booking: 'Connect', assets: 'Assets', bio: 'Professional Identity' },
};

let _selectedCareerTypes = [];

function initCareerTypePanel() {
  const epk = window._epkData || {};
  const current = epk.careerType;
  _selectedCareerTypes = Array.isArray(current) ? current : (current ? [current] : []);

  const grid = document.getElementById('careerTypeGrid');
  if (!grid) return;

  grid.innerHTML = CAREER_TYPES.map(t => `
    <div onclick="toggleCareerType('${t.id}')" id="ct_${t.id}"
      style="background:var(--dark-2);border:1px solid ${_selectedCareerTypes.includes(t.id) ? 'var(--gold)' : 'rgba(201,168,76,0.1)'};
      background:${_selectedCareerTypes.includes(t.id) ? 'rgba(201,168,76,0.08)' : 'var(--dark-2)'};
      padding:1.25rem;cursor:pointer;transition:all 0.2s;position:relative">
      <div style="font-size:1.5rem;margin-bottom:0.5rem">${t.icon}</div>
      <div style="font-family:var(--font-display);font-size:0.95rem;font-weight:700;margin-bottom:0.25rem;color:var(--white)">${t.name}</div>
      <div style="font-size:0.78rem;color:var(--gray);line-height:1.4">${t.desc}</div>
      ${_selectedCareerTypes.includes(t.id) ? '<div style="position:absolute;top:0.75rem;right:0.75rem;color:var(--gold)">✓</div>' : ''}
    </div>
  `).join('');

  updateHybridNote();
}

function toggleCareerType(id) {
  if (id === 'hybrid') {
    _selectedCareerTypes = _selectedCareerTypes.includes('hybrid') ? [] : ['hybrid'];
  } else {
    _selectedCareerTypes = _selectedCareerTypes.filter(t => t !== 'hybrid');
    if (_selectedCareerTypes.includes(id)) {
      _selectedCareerTypes = _selectedCareerTypes.filter(t => t !== id);
    } else if (_selectedCareerTypes.length < 2) {
      _selectedCareerTypes.push(id);
    }
  }
  initCareerTypePanel();
}

function updateHybridNote() {
  const note = document.getElementById('careerTypeHybridNote');
  if (note) note.style.display = (_selectedCareerTypes.includes('hybrid') || _selectedCareerTypes.length === 2) ? 'block' : 'none';
}

async function saveCareerType() {
  const epk = window._epkData;
  if (!epk || _selectedCareerTypes.length === 0) { showToast('Please select a career type'); return; }
  epk.careerType = _selectedCareerTypes.length === 1 ? _selectedCareerTypes[0] : _selectedCareerTypes;
  epk.careerLabels = CAREER_LABELS[_selectedCareerTypes[0]] || CAREER_LABELS.creative;
  persistUser();
  showToast('Career type saved ✓');
}
// ── PHASE 7 — MULTIPLE PROFESSIONAL PROFILES ──────────────────────

const PROFILE_TYPE_META = {
  creative:  { emoji: '🎨', label: 'Creative',  color: '#C9A84C' },
  corporate: { emoji: '💼', label: 'Corporate', color: '#8FB8D0' },
  freelance: { emoji: '⚡', label: 'Freelance', color: '#A8C5A0' },
  speaker:   { emoji: '🎤', label: 'Speaker',   color: '#D4A0C0' },
  primary:   { emoji: '✦',  label: 'Primary',   color: '#C9A84C' },
};

let userProfiles = [];       // [{profileSlug, profileType, profileName, isPrimary}]
let activeProfileSlug = '';  // currently editing
let newProfileType = 'creative';

// ── INIT: Load all profiles for user ──────────────────────────────
async function initProfiles() {
  const session = JSON.parse(localStorage.getItem('porfolioid_session') || '{}');
  const userSlug = session.slug;
  if (!userSlug) return;

  try {
    const res = await fetch('/.netlify/functions/epk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'listProfiles', userSlug })
    });
    const data = await res.json();

    if (data.profiles && data.profiles.length > 0) {
      userProfiles = data.profiles.map(p => ({
        profileSlug: p.profile_slug || p.profileSlug,
        profileType: p.profile_type || p.profileType || 'primary',
        profileName: p.profile_name || p.profileName || 'Primary',
        isPrimary: p.is_primary || p.isPrimary || false
      }));
    } else {
      // First time / blobs user — create primary entry
      userProfiles = [{ profileSlug: userSlug, profileType: 'primary', profileName: 'Primary', isPrimary: true }];
    }

    // Set active profile to primary (or first)
    const primary = userProfiles.find(p => p.isPrimary) || userProfiles[0];
    activeProfileSlug = primary.profileSlug;

    renderProfileSwitcher();
    updateSidebarProfileInfo();

  } catch (e) {
    console.error('Profile init error:', e);
    // Fallback — single profile mode
    userProfiles = [{ profileSlug: userSlug, profileType: 'primary', profileName: 'Primary', isPrimary: true }];
    activeProfileSlug = userSlug;
    renderProfileSwitcher();
  }
}

// ── RENDER profile tabs in topbar ────────────────────────────────
function renderProfileSwitcher() {
  const container = document.getElementById('profileSwitcher');
  if (!container) return;

  const tabs = userProfiles.map(p => {
    const meta = PROFILE_TYPE_META[p.profileType] || PROFILE_TYPE_META.primary;
    const isActive = p.profileSlug === activeProfileSlug;
    return `<button
      class="profile-tab ${isActive ? 'active' : ''}"
      onclick="switchProfile('${p.profileSlug}')"
      title="${p.profileName} — ${meta.label}"
    >
      <span>${meta.emoji}</span>
      <span>${p.profileName}</span>
      ${p.isPrimary ? '' : `<span onclick="event.stopPropagation();confirmDeleteProfile('${p.profileSlug}','${p.profileName}')" title="Delete profile" style="opacity:0.4;font-size:0.65rem;margin-left:0.25rem;line-height:1" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.4'">✕</span>`}
    </button>`;
  }).join('');

  container.innerHTML = tabs + `<button class="profile-tab-add" onclick="openNewProfileModal()">+ New Profile</button>`;
}

// ── SWITCH active profile ─────────────────────────────────────────
async function switchProfile(profileSlug) {
  if (profileSlug === activeProfileSlug) return;

  // Auto-save current profile first
  saveAll();

  activeProfileSlug = profileSlug;
  renderProfileSwitcher();

  // Show loading state
  document.getElementById('topbarUser').textContent = 'Switching...';

  // Load the new profile's EPK
  try {
    const res = await fetch('/.netlify/functions/epk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'load', slug: profileSlug })
    });
    const data = await res.json();

    if (data.success && data.epk) {
      epk = data.epk;
    } else {
      epk = createEmptyEPK(profileSlug, epk.name || '');
      epk.profileType = userProfiles.find(p => p.profileSlug === profileSlug)?.profileType || 'creative';
    }

    loadAllFields();
    updateSidebarProfileInfo();

    const session = JSON.parse(localStorage.getItem('porfolioid_session') || '{}');
    document.getElementById('topbarUser').textContent = session.name || '';

    showSaveBanner('Switched to ' + (userProfiles.find(p => p.profileSlug === profileSlug)?.profileName || profileSlug));
  } catch (e) {
    console.error('Profile switch error:', e);
    document.getElementById('topbarUser').textContent = 'Switch failed';
  }
}

// ── UPDATE sidebar link to reflect active profile ────────────────
function updateSidebarProfileInfo() {
  const profile = userProfiles.find(p => p.profileSlug === activeProfileSlug);
  const meta = PROFILE_TYPE_META[(profile?.profileType) || 'primary'];

  const urlDisplay = document.getElementById('epkUrlDisplay');
  const badge = document.getElementById('activeProfileBadge');
  const label = document.getElementById('activeProfileLabel');
  const viewBtn = document.getElementById('viewEPKBtn');

  const url = `porfolioid.com/${activeProfileSlug}`;
  const fullUrl = `/epk.html?slug=${activeProfileSlug}`;

  if (urlDisplay) { urlDisplay.textContent = url; urlDisplay.href = fullUrl; }
  if (badge) { badge.textContent = meta.emoji + ' ' + (profile?.profileName || 'Primary'); }
  if (label) label.textContent = 'Portfolio Link';
  if (viewBtn) viewBtn.href = fullUrl;
}

// ── OVERRIDE persistUser to save to active profile slug ──────────
// (monkey-patch: replace the slug used in saves)
const _origPersistUser = persistUser;

// ── NEW PROFILE MODAL ─────────────────────────────────────────────
function openNewProfileModal() {
  newProfileType = 'creative';
  document.getElementById('newProfileName').value = '';
  document.getElementById('newProfileUrlPreview').textContent = 'porfolioid.com/—';
  updateNewProfileTypeUI();
  document.getElementById('newProfileModal').classList.add('open');
}

function closeNewProfileModal() {
  document.getElementById('newProfileModal').classList.remove('open');
}

function selectNewProfileType(type) {
  newProfileType = type;
  updateNewProfileTypeUI();
}

function updateNewProfileTypeUI() {
  ['creative','corporate','freelance','speaker'].forEach(t => {
    const btn = document.getElementById('npt-' + t);
    if (!btn) return;
    btn.style.border = t === newProfileType ? '2px solid var(--gold)' : '2px solid rgba(201,168,76,0.15)';
    btn.style.background = t === newProfileType ? 'rgba(201,168,76,0.08)' : 'var(--dark-3)';
  });
}

// Live URL preview as user types profile name
document.addEventListener('DOMContentLoaded', () => {
  const nameInput = document.getElementById('newProfileName');
  if (nameInput) {
    nameInput.addEventListener('input', () => {
      const session = JSON.parse(localStorage.getItem('porfolioid_session') || '{}');
      const base = session.slug || 'your-slug';
      const suffix = nameInput.value.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
      const profileSlug = suffix ? `${base}--${suffix}` : base;
      document.getElementById('newProfileUrlPreview').textContent = `porfolioid.com/${profileSlug}`;
    });
  }
});

async function createNewProfile() {
  const session = JSON.parse(localStorage.getItem('porfolioid_session') || '{}');
  const userSlug = session.slug;
  const nameVal = document.getElementById('newProfileName').value.trim();

  if (!nameVal) {
    document.getElementById('newProfileName').style.borderColor = 'rgba(255,100,100,0.5)';
    return;
  }

  const suffix = nameVal.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const profileSlug = `${userSlug}--${suffix}`;

  const btn = document.querySelector('#newProfileModal button[onclick="createNewProfile()"]');
  if (btn) { btn.textContent = 'Creating...'; btn.disabled = true; }

  try {
    const res = await fetch('/.netlify/functions/epk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'createProfile',
        userSlug,
        profileSlug,
        profileType: newProfileType,
        profileName: nameVal,
        name: epk.name || session.name || ''
      })
    });
    const data = await res.json();

    if (data.success) {
      userProfiles.push({ profileSlug, profileType: newProfileType, profileName: nameVal, isPrimary: false });
      closeNewProfileModal();
      renderProfileSwitcher();
      // Switch to the new profile
      await switchProfile(profileSlug);
    } else {
      alert(data.error || 'Could not create profile. Try a different name.');
    }
  } catch (e) {
    console.error('Create profile error:', e);
    alert('Network error. Please try again.');
  } finally {
    if (btn) { btn.textContent = 'Create Profile'; btn.disabled = false; }
  }
}

async function confirmDeleteProfile(profileSlug, profileName) {
  if (!confirm(`Delete the "${profileName}" profile? This cannot be undone.`)) return;

  const session = JSON.parse(localStorage.getItem('porfolioid_session') || '{}');

  try {
    const res = await fetch('/.netlify/functions/epk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deleteProfile', userSlug: session.slug, profileSlug })
    });
    const data = await res.json();

    if (data.success) {
      userProfiles = userProfiles.filter(p => p.profileSlug !== profileSlug);
      if (activeProfileSlug === profileSlug) {
        const primary = userProfiles.find(p => p.isPrimary) || userProfiles[0];
        await switchProfile(primary.profileSlug);
      } else {
        renderProfileSwitcher();
      }
    } else {
      alert(data.error || 'Could not delete profile.');
    }
  } catch (e) {
    console.error('Delete profile error:', e);
  }
}

// ── PATCH showSaveBanner to optionally show a message ────────────
function showSaveBanner(msg) {
  const banner = document.getElementById('saveBanner');
  if (!banner) return;
  const prev = banner.textContent;
  if (msg) banner.textContent = msg;
  banner.classList.add('show');
  setTimeout(() => { banner.classList.remove('show'); if (msg) banner.textContent = prev; }, 2500);
}


// ── PHASE 8 — ANALYTICS ──────────────────────────────────────────

let currentAnalyticsDays = 30;

async function loadAnalytics(days) {
  currentAnalyticsDays = days;

  // Update range button states
  [7, 30, 90].forEach(d => {
    const btn = document.getElementById(`anDays-${d}`);
    if (btn) btn.classList.toggle('active', d === days);
  });

  const session = JSON.parse(localStorage.getItem('porfolioid_session') || '{}');
  const userSlug = session.slug;
  if (!userSlug) return;

  // Show loading
  document.getElementById('anTotalViews').textContent = '…';
  document.getElementById('anTotalScans').textContent = '…';
  document.getElementById('anTotalDownloads').textContent = '…';

  try {
    const res = await fetch('/.netlify/functions/epk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getAnalytics', userSlug, days })
    });
    const data = await res.json();

    if (data.error || data.totalViews === undefined) {
      // Likely no Supabase — show notice
      document.getElementById('analyticsNoSupabase').style.display = 'block';
      document.getElementById('anTotalViews').textContent = '0';
      document.getElementById('anTotalScans').textContent = '0';
      document.getElementById('anTotalDownloads').textContent = '0';
      return;
    }

    document.getElementById('analyticsNoSupabase').style.display = 'none';

    // Stat cards
    document.getElementById('anTotalViews').textContent = data.totalViews.toLocaleString();
    document.getElementById('anTotalScans').textContent = data.totalScans.toLocaleString();
    document.getElementById('anTotalDownloads').textContent = data.totalDownloads.toLocaleString();

    // Daily chart
    renderAnalyticsChart(data.daily || []);

    // Device breakdown
    renderBreakdown('anDeviceBreakdown', data.devices || {}, {
      mobile: '📱 Mobile', desktop: '🖥 Desktop', unknown: '? Unknown'
    });

    // QR mode breakdown
    renderBreakdown('anQRBreakdown', data.qrModes || {}, {
      artist: '🎨 Artist QR', career: '💼 Career QR', event: '⚡ Event QR'
    });

    // Top assets
    renderTopAssets(data.topAssets || []);

  } catch (e) {
    console.error('Analytics load error:', e);
    document.getElementById('anTotalViews').textContent = '—';
    document.getElementById('anTotalScans').textContent = '—';
    document.getElementById('anTotalDownloads').textContent = '—';
  }
}

function renderAnalyticsChart(daily) {
  const chart = document.getElementById('analyticsChart');
  const labels = document.getElementById('analyticsChartLabels');
  if (!chart) return;

  const max = Math.max(...daily.map(d => d.count), 1);

  chart.innerHTML = daily.map(d => {
    const pct = Math.max((d.count / max) * 100, 2);
    const label = d.date.slice(5); // MM-DD
    return `<div class="analytics-bar" style="height:${pct}%">
      <div class="analytics-bar-tooltip">${label}: ${d.count} view${d.count !== 1 ? 's' : ''}</div>
    </div>`;
  }).join('');

  if (labels && daily.length) {
    const first = daily[0].date.slice(5);
    const last = daily[daily.length - 1].date.slice(5);
    const mid = daily[Math.floor(daily.length / 2)].date.slice(5);
    labels.innerHTML = `<span>${first}</span><span>${mid}</span><span>${last}</span>`;
  }
}

function renderBreakdown(containerId, data, labelMap) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const total = Object.values(data).reduce((a, b) => a + b, 0) || 1;
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);

  if (!entries.length) {
    el.innerHTML = '<div style="font-family:var(--font-mono);font-size:0.55rem;color:var(--gray)">No data yet.</div>';
    return;
  }

  el.innerHTML = entries.map(([key, count]) => {
    const pct = Math.round((count / total) * 100);
    const label = labelMap[key] || key;
    return `<div class="analytics-breakdown-row">
      <span style="min-width:90px">${label}</span>
      <div class="analytics-breakdown-bar"><div class="analytics-breakdown-fill" style="width:${pct}%"></div></div>
      <span style="min-width:40px;text-align:right;color:var(--gold)">${count}</span>
    </div>`;
  }).join('');
}

function renderTopAssets(assets) {
  const el = document.getElementById('anTopAssets');
  if (!el) return;
  if (!assets.length) {
    el.innerHTML = '<div style="font-family:var(--font-mono);font-size:0.55rem;color:var(--gray)">No downloads yet.</div>';
    return;
  }
  el.innerHTML = assets.map((a, i) => `
    <div style="display:flex;align-items:center;gap:1rem;padding:0.75rem 0;border-bottom:1px solid rgba(255,255,255,0.05)">
      <span style="font-family:var(--font-mono);font-size:0.55rem;color:var(--gray);min-width:16px">${i + 1}</span>
      <span style="font-family:var(--font-mono);font-size:0.65rem;color:var(--white);flex:1">${a.title || 'Untitled'}</span>
      <span style="font-family:var(--font-mono);font-size:0.6rem;color:var(--gold)">${a.downloads} dl</span>
    </div>`).join('');
}


function browseCloudinaryVideo() {
  _openCloudinaryPicker('cloudinaryBrowserVideo','mp4-videos','☁ Browse Cloudinary — Videos',function(url){
    document.getElementById('newVideoUrl').value=url;
    document.getElementById('cloudinaryBrowserVideo').remove();
  });
}
function browseCloudinaryMp3() {
  _openCloudinaryPicker('cloudinaryBrowserMp3','mp3-tracks','☁ Browse Cloudinary — MP3 Tracks',function(url){
    document.getElementById('newTrackLink').value=url;
    document.getElementById('cloudinaryBrowserMp3').remove();
  });
}
function _openCloudinaryPicker(id,folder,title,onSelect) {
  const existing=document.getElementById(id); if(existing) existing.remove();
  const overlay=document.createElement('div');
  overlay.id=id;
  overlay.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML=`<div style="background:#141414;border:1px solid rgba(201,168,76,0.3);padding:1.5rem;width:680px;max-height:80vh;overflow-y:auto;position:relative">
    <button onclick="document.getElementById('${id}').remove()" style="position:absolute;top:0.75rem;right:0.75rem;background:none;border:none;color:#888;font-size:1rem;cursor:pointer">✕ Close</button>
    <div style="font-family:'Courier Prime',monospace;font-size:0.6rem;letter-spacing:0.15em;color:var(--gold);text-transform:uppercase;margin-bottom:1rem">${title}</div>
    <div id="${id}-files" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:0.75rem"></div>
    <div id="${id}-status" style="font-size:0.75rem;color:#888;margin-top:0.75rem">Loading...</div>
  </div>`;
  document.body.appendChild(overlay);
  window['_picker_cb_'+id]=onSelect;
  fetch('/.netlify/functions/cloudinary-browse?folder='+encodeURIComponent(folder))
    .then(r=>r.json()).then(data=>{
      const items=data.resources||[];
      const statusEl=document.getElementById(id+'-status');
      const filesEl=document.getElementById(id+'-files');
      if(!items.length){statusEl.textContent='No files in "'+folder+'" yet. Upload to Cloudinary first.';return;}
      statusEl.textContent=items.length+' file'+(items.length>1?'s':'')+' in "'+folder+'" — click to select';
      filesEl.innerHTML=items.map(function(item){
        const name=item.public_id.split('/').pop();
        const isVid=item.resource_type==='video';
        const isImg=item.resource_type==='image';
        const isAudio=isVid && (item.format==='mp3'||item.format==='wav'||item.format==='aac'||item.format==='ogg');
        const thumb=isAudio?null:isVid?item.secure_url.replace('/upload/','/upload/w_150,h_90,c_fill,f_jpg,so_2/'):isImg?item.secure_url.replace('/upload/','/upload/w_150,h_90,c_fill,f_jpg/'):null;
        const icon=isAudio?'🎵':(!thumb?'📄':'');
        const safeUrl=item.secure_url.replace(/'/g,'%27');
        return '<div onclick="(window[\'_picker_cb_'+id+'\'])(\''+safeUrl+'\')" style="cursor:pointer;border:1px solid rgba(201,168,76,0.2);padding:0.5rem;background:rgba(201,168,76,0.04);border-radius:4px">'
          +(thumb?'<img src="'+thumb+'" style="width:100%;height:70px;object-fit:cover;display:block;margin-bottom:0.4rem" onerror="this.style.display=\'none\'">'
          :'<div style="width:100%;height:40px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;margin-bottom:0.4rem">'+(icon||'📄')+'</div>')
          +'<div style="font-size:10px;color:#aaa;font-family:monospace;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">'+name+'</div></div>';
      }).join('');
    }).catch(function(){document.getElementById(id+'-status').textContent='Error loading files.';});
}

function browseCloudinaryPhoto() {
  _openCloudinaryPicker('cloudinaryBrowserPhoto','gallery','☁ Browse Cloudinary — Gallery',function(url){
    document.getElementById('newPhotoUrl').value=url;
    if(window.updatePhotoPreview) updatePhotoPreview(url);
    document.getElementById('cloudinaryBrowserPhoto').remove();
  });
}

function browseCloudinaryAsset() {
  _openCloudinaryPicker('cloudinaryBrowserAsset','resume','☁ Browse Cloudinary — Assets (resume)',function(url){
    document.getElementById('newAssetUrl').value=url;
    document.getElementById('cloudinaryBrowserAsset').remove();
  });
}
