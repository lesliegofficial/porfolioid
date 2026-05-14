
const CLOUDINARY_CLOUD = 'djj8xe3gx';
const CLOUDINARY_PRESET = 'dj8fqdhj';
const CLOUDINARY_VIDEO_PRESET = 'mgjdexrj';

async function uploadToCloudinary(file, onSuccess) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_PRESET);

  const btn = event.currentTarget;
  const originalText = btn.textContent;
  btn.textContent = 'Uploading...';
  btn.disabled = true;

  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.secure_url) {
      onSuccess(data.secure_url);
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
  } catch (err) {
    btn.textContent = 'Upload failed';
    btn.disabled = false;
    setTimeout(() => { btn.textContent = originalText; btn.disabled = false; }, 2000);
  }
}

function triggerUpload(inputId, targetFieldId) {
  const input = document.getElementById(inputId);
  input.click();
  input.onchange = function() {
    const file = input.files[0];
    if (!file) return;
    uploadToCloudinary(file, (url) => {
      document.getElementById(targetFieldId).value = url;
      saveAll();
    });
  };
}

function triggerMp4Upload(inputId) {
  const input = document.getElementById(inputId);
  input.click();
  input.onchange = async function() {
    const file = input.files[0];
    if (!file) return;
    const btn = document.querySelector(`[onclick="triggerMp4Upload('${inputId}')"]`);
    if (btn) { btn.textContent = 'Uploading...'; btn.disabled = true; }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_VIDEO_PRESET);
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/video/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.secure_url) {
        document.getElementById('newVideoUrl').value = data.secure_url;
        if (btn) { btn.textContent = '✓ Uploaded'; btn.style.color = '#7ec97e'; setTimeout(() => { btn.textContent = '↑ Upload MP4'; btn.style.color = ''; btn.disabled = false; }, 2000); }
      }
    } catch(e) {
      if (btn) { btn.textContent = 'Failed'; btn.disabled = false; }
    }
  };
}

function triggerThumbUpload(inputId) {
  const input = document.getElementById(inputId);
  input.click();
  input.onchange = async function() {
    const file = input.files[0];
    if (!file) return;
    const btn = document.querySelector(`[onclick="triggerThumbUpload('${inputId}')"]`);
    if (btn) { btn.textContent = 'Uploading...'; btn.disabled = true; }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_PRESET);
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.secure_url) {
        document.getElementById('newVideoThumb').value = data.secure_url;
        if (btn) { btn.textContent = '✓ Uploaded'; btn.style.color = '#7ec97e'; setTimeout(() => { btn.textContent = '↑ Upload Thumbnail'; btn.style.color = ''; btn.disabled = false; }, 2000); }
      }
    } catch(e) {
      if (btn) { btn.textContent = 'Failed'; btn.disabled = false; }
    }
  };
}

function triggerMp3Upload(inputId) {
  const input = document.getElementById(inputId);
  input.click();
  input.onchange = async function() {
    const file = input.files[0];
    if (!file) return;
    const btn = document.querySelector(`[onclick="triggerMp3Upload('${inputId}')"]`);
    if (btn) { btn.textContent = 'Uploading...'; btn.disabled = true; }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_VIDEO_PRESET);
    formData.append('resource_type', 'video'); // Cloudinary uses 'video' for audio files
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/video/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.secure_url) {
        document.getElementById('newTrackLink').value = data.secure_url;
        if (btn) { btn.textContent = '✓ Uploaded'; btn.style.color = '#7ec97e'; setTimeout(() => { btn.textContent = '↑ Upload MP3'; btn.style.color = ''; btn.disabled = false; }, 2000); }
      }
    } catch(e) {
      if (btn) { btn.textContent = 'Failed'; btn.disabled = false; }
    }
  };
}

function triggerPhotoUpload(inputId) {
  const input = document.getElementById(inputId);
  input.click();
  input.onchange = async function() {
    const file = input.files[0];
    if (!file) return;
    const btn = document.querySelector(`[onclick="triggerPhotoUpload('${inputId}')"]`);
    if (btn) { btn.textContent = 'Uploading...'; btn.disabled = true; }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_PRESET);
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.secure_url) {
        document.getElementById('newPhotoUrl').value = data.secure_url;
        if (btn) { btn.textContent = '✓ Done'; btn.style.color = '#7ec97e'; setTimeout(() => { btn.textContent = '↑ Upload Photo'; btn.style.color = ''; btn.disabled = false; }, 2000); }
      }
    } catch(e) {
      if (btn) { btn.textContent = 'Failed'; btn.disabled = false; }
    }
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
    const res = await fetch('/api/epk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'load', slug: session.slug })
    });
    const data = await res.json();

    if (data.success && data.epk) {
      epk = data.epk;
      currentUser = { firstName: session.name.split(' ')[0], lastName: session.name.split(' ').slice(1).join(' '), email: session.email, slug: session.slug, epk };
    } else {
      // EPK not found - redirect to setup
      console.warn('EPK not found for slug:', session.slug, data);
      epk = createEmptyEPK(session.slug, session.name);
      currentUser = { firstName: session.name.split(' ')[0], lastName: session.name.split(' ').slice(1).join(' '), email: session.email, slug: session.slug, epk };
    }
  } catch(err) {
    console.error('Failed to load EPK:', err);
    // Fall back to empty EPK
    epk = createEmptyEPK(session.slug, session.name);
    currentUser = { firstName: session.name.split(' ')[0], lastName: session.name.split(' ').slice(1).join(' '), email: session.email, slug: session.slug, epk };
  }

  document.getElementById('topbarUser').textContent = session.name;
  document.getElementById('epkUrlDisplay').textContent = `porfolioid.com/epk.html?slug=${session.slug}`;
  document.getElementById('epkUrlDisplay').href = `/epk/${session.slug}`;
  document.getElementById('epkUrlDisplay').textContent = `porfolioid.com/epk/${session.slug}`;
  document.getElementById('viewEPKBtn').href = `/epk.html?slug=${session.slug}`;

  loadAllFields();
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
  // Hero
  const nameParts = (epk.name || '').split(' ');
  document.getElementById('heroFirstName').value = nameParts[0] || '';
  document.getElementById('heroLastName').value = nameParts.slice(1).join(' ') || '';
  document.getElementById('heroImage').value = epk.heroImage || '';

  const stats = epk.stats || [];
  if (stats[0]) { document.getElementById('stat1num').value = stats[0].number || ''; document.getElementById('stat1label').value = stats[0].label || ''; }
  if (stats[1]) { document.getElementById('stat2num').value = stats[1].number || ''; document.getElementById('stat2label').value = stats[1].label || ''; }
  if (stats[2]) { document.getElementById('stat3num').value = stats[2].number || ''; document.getElementById('stat3label').value = stats[2].label || ''; }

  renderTaglines();

  // Bio
  document.getElementById('bioText').value = epk.bio || '';
  document.getElementById('bioLocation').value = epk.location || '';
  // availability loaded below
  document.getElementById('bioImage').value = epk.bioImage || '';
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
  document.getElementById('bookingEmail').value = epk.bookingEmail || '';
  document.getElementById('bookingPhone').value = epk.bookingPhone || '';
  document.getElementById('bookingTagline').value = epk.bookingTagline || '';
  document.getElementById('bookingNote').value = epk.bookingNote || '';
  document.getElementById('bookingAvailability').value = epk.bookingAvailability || '';
  document.getElementById('bookingRegion').value = epk.bookingRegion || '';
  document.getElementById('bookingAutoResponse').value = epk.bookingAutoResponse || '';
  const bcats = epk.bookingCategories || [];
  ['live','studio','features','touring','hosting','ar','creative','media'].forEach(cat => {
    const el = document.getElementById('bcat_' + cat);
    if (el) el.checked = bcats.includes(cat);
  });
  loadBookingToggle();

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
}

function saveAll() {
  epk.name = `${document.getElementById('heroFirstName').value.trim()} ${document.getElementById('heroLastName').value.trim()}`.trim();
  epk.heroImage = document.getElementById('heroImage').value.trim();
  epk.stats = [
    { number: document.getElementById('stat1num').value, label: document.getElementById('stat1label').value },
    { number: document.getElementById('stat2num').value, label: document.getElementById('stat2label').value },
    { number: document.getElementById('stat3num').value, label: document.getElementById('stat3label').value },
  ];
  epk.bio = document.getElementById('bioText').value.trim();
  epk.location = document.getElementById('bioLocation').value.trim();
  epk.availability = document.getElementById('availabilitySelect').value;
  epk.bioImage = document.getElementById('bioImage').value.trim();
  epk.bookingEmail = document.getElementById('bookingEmail').value.trim();
  epk.bookingPhone = document.getElementById('bookingPhone').value.trim();
  epk.bookingTagline = document.getElementById('bookingTagline').value.trim();
  epk.bookingNote = document.getElementById('bookingNote').value.trim();
  epk.bookingAvailability = document.getElementById('bookingAvailability').value;
  epk.bookingRegion = document.getElementById('bookingRegion').value.trim();
  epk.bookingAutoResponse = document.getElementById('bookingAutoResponse').value.trim();
  epk.bookingCategories = ['live','studio','features','touring','hosting','ar','creative','media'].filter(cat => {
    const el = document.getElementById('bcat_' + cat);
    return el && el.checked;
  });

  persistUser();
  showSaveBanner();
}

async function persistUser() {
  currentUser.epk = epk;
  try {
    const session = JSON.parse(localStorage.getItem('porfolioid_session') || '{}');
    await fetch('/api/epk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save', slug: session.slug || epk.slug, data: epk })
    });
  } catch(err) {
    console.error('Save failed:', err);
  }
}

function showSaveBanner() {
  const banner = document.getElementById('saveBanner');
  banner.classList.add('show');
  setTimeout(() => banner.classList.remove('show'), 2000);
}

function showPanel(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`panel-${name}`).classList.add('active');
  event.currentTarget.classList.add('active');
}

function toggleAddForm(id) {
  const form = document.getElementById(id);
  form.classList.toggle('open');
}

// TAGLINES
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
  const sorted = [...credits.map((c,i) => ({...c, _origIdx: i}))].sort((a,b) => (b.pinned?1:0)-(a.pinned?1:0));
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
            <div class="editable-card-title">${c.artist}</div>
            <div class="editable-card-subtitle">${c.role}${c.years ? ' · ' + c.years : ''}${c.contractType ? ' · ' + c.contractType : ''}</div>
            ${c.collaborators?.length ? `<div style="font-family:var(--font-mono);font-size:0.55rem;color:var(--gray);margin-top:0.2rem;letter-spacing:0.08em">w/ ${c.collaborators.join(', ')}</div>` : ''}
            <p style="font-size:0.85rem;color:var(--gray);line-height:1.6;margin:0.3rem 0 0;white-space:pre-line">${c.desc || ''}</p>
            ${photosHTML}
            ${photos.length < 20 ? `
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
  document.getElementById('newCreditArtist').value = c.artist || '';
  document.getElementById('newCreditYears').value = c.years || '';
  document.getElementById('newCreditCategory').value = c.category || '';
  document.getElementById('newCreditContractType').value = c.contractType || '';
  document.getElementById('newCreditRole').value = c.role || '';
  document.getElementById('newCreditProjectType').value = c.projectType || '';
  document.getElementById('newCreditDesc').value = c.desc || '';
  document.getElementById('newCreditFullDesc').value = c.fullDesc || '';
  pendingCreditMedia = c.mediaItems || (c.mediaLink ? [{type:'link', url:c.mediaLink, label:c.mediaLabel||''}] : []);
  if (c.videoUrl && !pendingCreditMedia.find(m => m.url === c.videoUrl)) pendingCreditMedia.push({type:'video', url:c.videoUrl, label:''});
  renderCreditMediaList();
  document.getElementById('newCreditProofLink').value = c.proofLink || '';
  document.getElementById('newCreditVisible').checked = c.visible !== false;
  document.getElementById('newCreditVerified').checked = c.verified || false;
  document.getElementById('newCreditPinned').checked = c.pinned || false;
  pendingCreditCollaborators = [...(c.collaborators || [])];
  renderCreditCollaborators();
  // Restore photos preview
  pendingCreditPhotos = [...(c.photos || [])];
  renderCreditPhotosPreview();
  document.getElementById('addCreditForm').classList.add('open');
  document.getElementById('addCreditForm').scrollIntoView({ behavior: 'smooth' });
  document.querySelector('#addCreditForm .add-form-title').textContent = 'Edit Credit';
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
function triggerCreditPhotoUpload() {
  const input = document.getElementById('creditPhotoInput');
  input.value = '';
  input.click();
  input.onchange = async function() {
    const files = Array.from(input.files);
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_PRESET);
      try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.secure_url) { pendingCreditPhotos.push(data.secure_url); renderCreditPhotosPreview(); }
      } catch(e) { console.error('Upload failed', e); }
    }
  };
}
async function addPhotosToCredit(i) {
  const input = document.getElementById(`creditPhotoInput_${i}`);
  input.value = '';
  input.click();
  input.onchange = async function() {
    const files = Array.from(input.files);
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_PRESET);
      try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.secure_url) {
          epk.credits[i].photos = epk.credits[i].photos || [];
          epk.credits[i].photos.push(data.secure_url);
          renderCredits(); persistUser(); showSaveBanner();
        }
      } catch(e) { console.error('Upload failed', e); }
    }
  };
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
  const category = document.getElementById('newCreditCategory').value;
  const contractType = document.getElementById('newCreditContractType').value;
  const role = document.getElementById('newCreditRole').value.trim();
  const projectType = document.getElementById('newCreditProjectType').value.trim();
  const desc = document.getElementById('newCreditDesc').value.trim();
  const fullDesc = document.getElementById('newCreditFullDesc').value.trim();
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
  const creditData = { artist, years, category, contractType, role, projectType, desc, fullDesc, mediaLink, mediaLabel, videoUrl, mediaItems, proofLink, visible, verified, pinned, collaborators: [...pendingCreditCollaborators], photos: [...pendingCreditPhotos] };
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
  renderCreditPhotosPreview();
  renderCreditCollaborators();
  renderCreditMediaList();
  ['newCreditArtist','newCreditYears','newCreditRole','newCreditProjectType','newCreditDesc','newCreditFullDesc','newCreditProofLink'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('newCreditCategory').value = '';
  document.getElementById('newCreditContractType').value = '';
  document.getElementById('newCreditVisible').checked = true;
  document.getElementById('newCreditVerified').checked = false;
  document.getElementById('newCreditPinned').checked = false;
  toggleAddForm('addCreditForm');
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

function renderCreditMediaList() {
  const container = document.getElementById('creditMediaList');
  if (!container) return;
  container.innerHTML = pendingCreditMedia.map((m, i) => `
    <div style="background:var(--dark-3);border:1px solid rgba(201,168,76,0.12);padding:0.75rem;display:flex;gap:0.5rem;align-items:center">
      <span style="font-family:var(--font-mono);font-size:0.5rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--gold);min-width:40px">${m.type === 'video' ? '📹 MP4' : '🔗 LINK'}</span>
      <input type="url" value="${m.url}" placeholder="URL" oninput="pendingCreditMedia[${i}].url=this.value"
        style="flex:1;background:transparent;border:none;color:var(--white);font-family:var(--font-body);font-size:0.8rem;outline:none">
      <input type="text" value="${m.label}" placeholder="Label (optional)" oninput="pendingCreditMedia[${i}].label=this.value"
        style="width:160px;background:transparent;border:none;border-left:1px solid rgba(255,255,255,0.1);padding-left:0.5rem;color:var(--gray);font-family:var(--font-body);font-size:0.75rem;outline:none">
      <button onclick="pendingCreditMedia.splice(${i},1);renderCreditMediaList()"
        style="background:none;border:none;color:#ff6b6b;cursor:pointer;font-size:0.8rem;padding:0 0.25rem">✕</button>
    </div>`).join('');
}

function addCreditMedia(type) {
  if (type === 'upload') {
    const input = document.getElementById('creditVideoInput');
    input.value = '';
    input.onchange = async function() {
      const file = input.files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_VIDEO_PRESET);
      try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/video/upload`, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.secure_url) {
          pendingCreditMedia.push({ type: 'video', url: data.secure_url, label: file.name.replace(/\.[^.]+$/, '') });
          renderCreditMediaList();
        }
      } catch(e) { console.error('Upload failed', e); }
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
    if (btn) { btn.textContent = 'Uploading...'; btn.disabled = true; }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_VIDEO_PRESET);
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/video/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.secure_url) {
        document.getElementById('newCreditVideoUrl').value = data.secure_url;
        if (btn) { btn.textContent = '✓ Uploaded'; btn.style.color = '#7ec97e'; setTimeout(() => { btn.textContent = '↑ Upload MP4'; btn.style.color = ''; btn.disabled = false; }, 2000); }
      }
    } catch(e) {
      if (btn) { btn.textContent = 'Failed'; btn.disabled = false; }
    }
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
  document.getElementById('newVideoThumb').value = v.thumb || '';
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
  if (!title || !url) return;
  epk.videos = epk.videos || [];
  const videoData = { title, category, featured, url, thumb, album, year, desc, visible };
  if (editingVideoIdx >= 0) {
    epk.videos[editingVideoIdx] = { ...epk.videos[editingVideoIdx], ...videoData };
    editingVideoIdx = -1;
    document.querySelector('#addVideoForm .add-form-title').textContent = 'New Video';
  } else {
    epk.videos.push(videoData);
  }
  ['newVideoTitle','newVideoUrl','newVideoThumb','newVideoAlbum','newVideoYear','newVideoDesc'].forEach(id => document.getElementById(id).value = '');
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
      p.group ? `<span style="font-family:var(--font-mono);font-size:0.5rem;background:rgba(255,255,255,0.05);color:var(--gray);padding:0.15rem 0.5rem">${p.group}</span>` : '',
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
  document.getElementById('newPhotoGroup').value = p.group || '';
  document.getElementById('newPhotoCategory').value = p.category || '';
  document.getElementById('newPhotoFeatured').checked = p.featured || false;
  const pos = p.position || 'center 0%';
  // Extract % value from position string like "center 30%"
  const posMatch = pos.match(/(\d+)%/);
  const posVal = posMatch ? parseInt(posMatch[1]) : 0;
  document.getElementById('photoPositionSlider').value = posVal;
  document.getElementById('photoPositionValue').value = pos;
  updatePhotoPreview(p.url || '');
  if (document.getElementById('photoPreviewImg')) document.getElementById('photoPreviewImg').style.objectPosition = pos;
  document.getElementById('addPhotoForm').classList.add('open');
  document.getElementById('addPhotoForm').scrollIntoView({ behavior: 'smooth' });
  document.querySelector('#addPhotoForm .add-form-title').textContent = 'Edit Photo';
}
function addPhoto() {
  const caption = document.getElementById('newPhotoCaption').value.trim();
  const url = document.getElementById('newPhotoUrl').value.trim();
  const group = document.getElementById('newPhotoGroup').value.trim();
  const category = document.getElementById('newPhotoCategory').value;
  const featured = document.getElementById('newPhotoFeatured').checked;
  const position = document.getElementById('photoPositionValue').value || 'center 0%';
  if (!url) return;
  epk.photos = epk.photos || [];
  const photoData = { caption, url, group, category, featured, position };
  if (editingPhotoIdx >= 0) {
    epk.photos[editingPhotoIdx] = { ...epk.photos[editingPhotoIdx], ...photoData };
    editingPhotoIdx = -1;
    document.querySelector('#addPhotoForm .add-form-title').textContent = 'New Photo';
  } else {
    epk.photos.push(photoData);
  }
  ['newPhotoCaption','newPhotoUrl','newPhotoGroup'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('newPhotoCategory').value = '';
  document.getElementById('newPhotoFeatured').checked = false;
  document.getElementById('photoPositionSlider').value = 0;
  document.getElementById('photoPositionValue').value = 'center 0%';
  document.getElementById('photoPreviewBox').style.display = 'none';
  toggleAddForm('addPhotoForm');
  renderPhotos(); persistUser(); showSaveBanner();
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
    if (btn) { btn.textContent = 'Uploading...'; btn.disabled = true; }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_PRESET);
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/raw/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.secure_url) {
        document.getElementById('newAssetUrl').value = data.secure_url;
        if (!document.getElementById('newAssetBtn').value) {
          document.getElementById('newAssetBtn').value = 'Download ' + file.name.split('.').pop().toUpperCase() + ' →';
        }
        if (btn) { btn.textContent = '✓ Uploaded'; btn.style.color = '#7ec97e'; setTimeout(() => { btn.textContent = '↑ Upload File'; btn.style.color = ''; btn.disabled = false; }, 2000); }
      }
    } catch(e) {
      if (btn) { btn.textContent = 'Failed'; btn.disabled = false; }
    }
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
function triggerAwardCertUpload() {
  const input = document.getElementById('awardCertInput');
  input.value = '';
  input.onchange = async function() {
    const file = input.files[0];
    if (!file) return;
    const btn = document.querySelector('[onclick="triggerAwardCertUpload()"]');
    if (btn) { btn.textContent = 'Uploading...'; btn.disabled = true; }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_PRESET);
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/raw/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.secure_url) {
        document.getElementById('newAwardCertUrl').value = data.secure_url;
        if (btn) { btn.textContent = '✓ Uploaded'; btn.style.color = '#7ec97e'; setTimeout(() => { btn.textContent = '↑ Upload Certificate'; btn.style.color = ''; btn.disabled = false; }, 2000); }
      }
    } catch(e) { if (btn) { btn.textContent = '↑ Upload Certificate'; btn.disabled = false; } }
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
  const awardData = { title, org, year, type, desc, category, proofLink, certUrl, verified, featured };
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
  toggleAddForm('addAwardForm');
  renderAwards(); persistUser(); showSaveBanner();
}
function removeAward(i) { epk.awards.splice(i, 1); renderAwards(); persistUser(); showSaveBanner(); }

// SOCIAL LINKS — multi-field support for instagram, facebook, website
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
  // Save multi fields (already kept in sync via updateSocialField)
  // Save single fields
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
  // Clean empty entries from multi fields
  ['instagram','facebook','website'].forEach(p => {
    if (Array.isArray(epk.socials[p])) {
      epk.socials[p] = epk.socials[p].filter(v => v.trim());
    }
  });
  persistUser(); showSaveBanner();
}

function loadSocials() {
  const s = epk.socials || {};
  // Load multi fields
  ['instagram','facebook','website'].forEach(p => {
    const placeholders = { instagram:'https://instagram.com/yourhandle', facebook:'https://facebook.com/yourpage', website:'https://yourwebsite.com' };
    const val = s[p];
    epk.socials = epk.socials || {};
    epk.socials[p] = Array.isArray(val) ? val : (val ? [val] : []);
    renderSocialList(p, placeholders[p]);
  });
  // Load single fields
  const singles = { tiktok:'socialTiktok', linkedin:'socialLinkedin', spotify:'socialSpotify', appleMusic:'socialAppleMusic', youtube:'socialYoutube', soundcloud:'socialSoundcloud', tidal:'socialTidal', bandcamp:'socialBandcamp' };
  // Load follower counts
  ['tiktok','linkedin','spotify','youtube'].forEach(k => {
    const el = document.getElementById('social' + k.charAt(0).toUpperCase() + k.slice(1) + '_followers');
    if (el) el.value = s[k + '_followers'] || '';
  });
  Object.entries(singles).forEach(([key, elId]) => {
    const el = document.getElementById(elId);
    if (el) el.value = s[key] || '';
  });
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
