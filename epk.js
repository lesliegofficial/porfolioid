
function pdfViewerUrl(url) {
  // If URL looks like a PDF, wrap in Google Docs viewer so it opens inline
  if (url && (url.includes('.pdf') || url.includes('/raw/') || url.includes('raw.githubusercontent'))) {
    return 'https://docs.google.com/viewer?url=' + encodeURIComponent(url);
  }
  return url;
}

function getSlugFromURL() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('slug');
  if (fromQuery) return fromQuery;
  const epkPathMatch = window.location.pathname.match(/\/epk\/([^\/]+)/);
  if (epkPathMatch) return epkPathMatch[1];
  // Netlify's status-200 rewrite (/:slug -> epk.html?slug=:slug) substitutes the query string
  // server-side only — window.location.search/pathname on the client still reflect the original
  // clean URL the browser actually requested, not the rewritten target. Fall back to reading the
  // slug straight out of a bare top-level path segment, excluding direct .html file access and
  // known non-profile paths so this never misfires on a real page.
  const bareMatch = window.location.pathname.match(/^\/([^\/]+)\/?$/);
  if (bareMatch) {
    const candidate = bareMatch[1];
    const reserved = ['epk.html', 'index.html', 'dashboard.html', 'login.html', 'signup.html', 'onboarding.html', 'archive', 'archive.html', 'api', ''];
    if (candidate && !reserved.includes(candidate) && !candidate.includes('.html')) return candidate;
  }
  return null;
}

function getEPKData(slug) {
  const users = JSON.parse(localStorage.getItem('porfolioid_users') || '[]');
  const user = users.find(u => u.slug === slug || u.epk?.slug === slug);
  return user ? user.epk : null;
}

function getYouTubeThumb(url) {
  const match = url.match(/youtube\.com.*v=([^&]+)|youtu\.be\/([^?]+)/);
  return match ? `https://img.youtube.com/vi/${match[1]||match[2]}/hqdefault.jpg` : null;
}

// Compute a Work's display status from its dates, unless a manual statusOverride is set.
// Override always wins; otherwise: no completed/released dates = In Progress, completed only = Completed, released = Published.
function getWorkStatus(w) {
  const overrideLabels = {
    'on-hold': 'On Hold', 'archived': 'Archived', 'private': 'Private',
    'coming-soon': 'Coming Soon', 'in-revision': 'In Revision', 'unreleased': 'Unreleased'
  };
  if (w.statusOverride && overrideLabels[w.statusOverride]) return overrideLabels[w.statusOverride];
  if (w.releasedDate) return 'Published';
  if (w.completedDate) return 'Completed';
  if (w.startedDate) return 'In Progress';
  return 'Draft';
}

// Builds the markup for a custom premium audio player (replaces native <audio controls>).
// Generates a fixed-bar-count "waveform" track purely for visual texture — it does not reflect actual audio amplitude.
function buildWorkAudioPlayer(id, src) {
  const barCount = 46;
  let bars = '';
  // Deterministic pseudo-random heights so the waveform looks organic but is identical on every render (no layout shift / hydration mismatch)
  let seed = 0;
  for (let i = 0; i < id.length; i++) seed += id.charCodeAt(i);
  for (let i = 0; i < barCount; i++) {
    const n = Math.sin(seed + i * 12.9898) * 43758.5453;
    const frac = n - Math.floor(n);
    const height = 28 + Math.round(frac * 72); // 28%–100% of track height
    bars += `<div class="wp-bar" style="height:${height}%"></div>`;
  }
  return `
    <div class="work-player" id="${id}" data-src="${src}">
      <audio class="wp-audio" preload="metadata" src="${src}"></audio>
      <button class="wp-playbtn" onclick="workPlayerToggle('${id}')" aria-label="Play">
        <svg class="wp-icon-play" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        <svg class="wp-icon-pause" viewBox="0 0 24 24" style="display:none"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>
      </button>
      <div class="wp-main">
        <div class="wp-waveform" onclick="workPlayerSeek(event, '${id}')">
          <div class="wp-waveform-bars">${bars}</div>
          <div class="wp-progress-fill"></div>
        </div>
        <div class="wp-time-row">
          <span class="wp-time-current">0:00</span>
          <span class="wp-time-total">0:00</span>
        </div>
      </div>
      <div class="wp-volume">
        <svg class="wp-vol-icon" viewBox="0 0 24 24" onclick="workPlayerMute('${id}')"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1-3.29-2.5-4.03v8.05c1.5-.73 2.5-2.25 2.5-4.02z"/></svg>
        <input class="wp-vol-slider" type="range" min="0" max="1" step="0.01" value="1" oninput="workPlayerVolume('${id}', this.value)">
      </div>
    </div>`;
}

// ── CAREER RECORD HIGHLIGHTS — data-driven, dashboard-editable ──────
// CH3_ICON_PATHS: fixed set of icon keys the dashboard editor can choose
// from. Storing a key (not raw SVG) keeps saved data small and safe.
const CH3_ICON_PATHS = {
  music: 'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z',
  mic: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z',
  building: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z',
  briefcase: 'M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z',
  megaphone: 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z',
  flag: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
};

// DEFAULT_CAREER_HIGHLIGHTS: exact content of the original 6 hardcoded
// cards, converted to data. If epk.careerHighlights is absent or empty,
// this is what renders — byte-for-byte equivalent to the prior hardcoded
// output. This is the single source of truth for defaults; dashboard.js
// keeps a matching copy for its "Reset card to default" action.
const DEFAULT_CAREER_HIGHLIGHTS = [
  { id: 'default-recordingartist', tag: 'recordingartist', order: 0, visible: true, icon: 'music',
    title: 'Recording Artist', titleEs: 'Artista de Grabación',
    description: 'Recording artist with Las Nenas del Swing. Original compositions and live concert recordings across multiple releases.',
    descriptionEs: 'Artista de grabación con Las Nenas del Swing. Composiciones originales y grabaciones de conciertos en vivo en múltiples lanzamientos.',
    image: 'https://res.cloudinary.com/djj8xe3gx/image/upload/v1781052294/career-highlights/recording-artist.jpg' },
  { id: 'default-liveperformance', tag: 'liveperformance', order: 1, visible: true, icon: 'mic',
    title: 'Touring Vocalist', titleEs: 'Presentaciones en Vivo',
    description: 'Exclusive touring vocalist for Don Omar, J Álvarez, and Melina León — hundreds of performances across five continents.',
    descriptionEs: 'Vocalista de gira exclusiva para Don Omar, J Álvarez y Melina León — cientos de presentaciones en cinco continentes.',
    image: 'https://res.cloudinary.com/djj8xe3gx/image/upload/v1782320896/career-highlights/touring-vocalist-don-omar.jpg' },
  { id: 'default-industryoperations', tag: 'industryoperations', order: 2, visible: true, icon: 'building',
    title: 'Operations &amp; Compliance', titleEs: 'Operaciones de la Industria',
    description: 'Executive operations, regulatory compliance, and organizational leadership. Human Services at FEMA, Head of Compliance at Venetian Productions, and operations coordination at Arrow Management.',
    descriptionEs: 'Logística de Artistas y Coordinación de Eventos para Adam Torres Concerts. Apoyo artístico en Arrow Management. Jefa de Cumplimiento en Venetian Productions.',
    image: 'https://res.cloudinary.com/djj8xe3gx/image/upload/v1782317473/career-highlights/operations-compliance.png' },
  { id: 'default-creativeprofessional', tag: 'creativeprofessional', order: 3, visible: true, icon: 'briefcase',
    title: 'Artist Liaison &amp; A&amp;R Coordinator', titleEs: 'Profesional Creativa',
    description: 'A&amp;R coordination and artist development at Sony Music Latin and Urban Latino Music. Artist liaison and event coordination for Adam Torres Concerts. Music projects, release coordination, and industry relationships.',
    descriptionEs: 'Coordinadora de A&R en Sony Music Latin y Urban Latino Music. Desarrollo artístico, coordinación de lanzamientos y operaciones creativas.',
    image: 'https://res.cloudinary.com/djj8xe3gx/image/upload/v1781052295/career-highlights/creative-professional.jpg' },
  { id: 'default-marketingpr', tag: 'marketingpr', order: 4, visible: true, icon: 'megaphone',
    title: 'Digital Marketing', titleEs: 'Mercadeo y Relaciones Públicas',
    description: 'Digital marketing, social media strategy, public relations, and content marketing at NV Marketing &amp; PR. Managed artist marketing campaigns and brand promotion for major Latin artists.',
    descriptionEs: 'Coordinadora de Mercadeo y Contenido en NV Marketing & PR. Campañas digitales, apoyo de publicidad y estrategia de contenido para grandes artistas latinos.',
    image: 'https://res.cloudinary.com/djj8xe3gx/video/upload/v1781052306/career-highlights/marketing-pr.mp4' },
  { id: 'default-founderbuilder', tag: 'founderbuilder', order: 5, visible: true, icon: 'flag',
    title: 'Founder, porfolioID', titleEs: 'Fundadora y Creadora',
    description: 'Founder &amp; Product Architect of porfolioID and IDPressDrop — original platforms built from concept to deployment.',
    descriptionEs: 'Fundadora y Arquitecta de Producto de PorfolioID e IDPressDrop — plataformas originales construidas desde el concepto hasta el despliegue.',
    image: 'https://res.cloudinary.com/djj8xe3gx/image/upload/v1781638246/career-highlights/founder-builder-official.jpg' },
];

// Resolve which dataset to render from: saved data wins only if it's a
// real, non-empty array; otherwise fall back to the defaults so existing
// visitors see no change until a save happens.
function getActiveCareerHighlights(epk) {
  if (Array.isArray(epk.careerHighlights) && epk.careerHighlights.length > 0) {
    return [...epk.careerHighlights].sort((a, b) => (a.order || 0) - (b.order || 0));
  }
  return DEFAULT_CAREER_HIGHLIGHTS;
}

function isCh3VideoUrl(url) {
  return !!url && /\.(mp4|mov|webm)(\?|$)/i.test(url);
}

// Original per-tag image crop/position treatment, preserved so the default
// six cards keep their exact prior appearance. Applied by tag rather than
// as a new editable field, since the data model intentionally doesn't
// expose image styling as an editor option.
const CH3_IMAGE_STYLE_BY_TAG = {
  recordingartist: 'object-position: top',
  liveperformance: 'transform: scale(1.12); object-position: center 20%',
  creativeprofessional: 'object-position: top',
  founderbuilder: 'object-position: top',
};

function renderCh3Card(card) {
  if (card.visible === false) return '';
  const imgStyle = CH3_IMAGE_STYLE_BY_TAG[card.tag] || '';
  const media = isCh3VideoUrl(card.image)
    ? `<div class="ch3-img" style="position:relative;overflow:hidden">
        <video autoplay muted loop playsinline style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0" poster="${card.image}${card.image.includes('?') ? '&' : '?'}so_2,f_jpg">
          <source src="${card.image}" type="video/mp4">
        </video>
      </div>`
    : `<div class="ch3-img"><img src="${card.image || ''}" alt="${card.title || ''}" loading="lazy"${imgStyle ? ` style="${imgStyle}"` : ''}></div>`;
  const iconPath = CH3_ICON_PATHS[card.icon] || CH3_ICON_PATHS.briefcase;
  return `
          <div class="ch3-card" data-ch3-tag="${card.tag}" onclick="filterCreditsByCategory('${card.tag}')" style="cursor:pointer">
            ${media}
            <div class="ch3-body">
              <div class="ch3-icon"><svg viewBox="0 0 24 24" style="fill:var(--gold);width:13px;height:13px"><path d="${iconPath}"/></svg></div>
              <h3 class="ch3-title">${card.title || ''}</h3>
              <p class="ch3-desc">${card.description || ''}</p>
            </div>
          </div>`;
}

function buildEPK(epk) {
  window._epkData = epk;
  window._epkData.awards = epk.awards || [];
  const nameParts = (epk.name || 'Artist Name').split(' ');
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' ');
  const bookingLabel = epk.bookingLabel || 'Inquiries';

  // Build nav
  const navLinks = document.getElementById('navLinks');
  navLinks.innerHTML = '';
  const ALL_SECTIONS = [
    { id: 'bio', label: 'Career Profile' },
    { id: 'credits', label: 'Credits' },
    { id: 'works', label: 'Works' },
    { id: 'photos', label: 'Photos' },
    { id: 'videos', label: 'Video' },
    { id: 'music', label: 'Music' },
    { id: 'awards', label: 'Awards' },
    { id: 'assets', label: 'Assets' },
    { id: 'connect', label: 'Connect' },
  ];
  const savedOrder = epk.sectionOrder || ALL_SECTIONS.map(s => s.id);
  // Self-heal: any section in ALL_SECTIONS not yet present in a saved sectionOrder (e.g. newly added sections like 'works') gets appended at the end, so existing saved data doesn't hide new nav items.
  const sectionOrder = savedOrder.concat(ALL_SECTIONS.map(s => s.id).filter(id => !savedOrder.includes(id)));
  const sectionVisibility = epk.sectionVisibility || {};

  // QR mode can override which sections are visible via ?sections= param
  const urlParams = new URLSearchParams(window.location.search);
  const qrSections = urlParams.get('sections');
  const qrAllowed = qrSections ? new Set(qrSections.split(',')) : null;

  const sections = sectionOrder
    .map(id => ALL_SECTIONS.find(s => s.id === id))
    .filter(s => {
      if (!s) return false;
      if (sectionVisibility[s.id] === false) return false;
      if (qrAllowed && !qrAllowed.has(s.id)) return false; // QR override
      return true;
    });
  sections.forEach(s => {
    navLinks.innerHTML += `<li><a href="#${s.id}" onclick="expandSection('${s.id}')">${s.label}</a></li>`;
  });

  document.getElementById('footerLogo').textContent = `${epk.name} — PorfolioID`;
  document.title = `${epk.name} — Professional Portfolio & Identity | PorfolioID`;

  // Dynamic OG / Twitter meta tags
  const metaTitle = `${epk.name} — Professional Portfolio | PorfolioID`;
  const metaDesc = epk.shortBio || epk.bio
    ? (epk.shortBio || epk.bio).slice(0, 160).replace(/\s+\S*$/, '') + '…'
    : `View ${epk.name}'s professional portfolio on PorfolioID.`;
  const metaImage = epk.heroImage || epk.bioImage || 'https://porfolioid.com/og-default.png';
  const metaUrl = `https://porfolioid.com/epk/${epk.slug}`;

  const setMeta = (id, val) => { const el = document.getElementById(id); if (el) el.setAttribute('content', val); };
  document.getElementById('pageTitle') && (document.getElementById('pageTitle').textContent = metaTitle);
  document.getElementById('pageDesc') && (document.getElementById('pageDesc').setAttribute('content', metaDesc));
  setMeta('ogTitle', metaTitle); setMeta('ogDesc', metaDesc);
  setMeta('ogImage', metaImage); setMeta('ogUrl', metaUrl);
  setMeta('twTitle', metaTitle); setMeta('twDesc', metaDesc); setMeta('twImage', metaImage);

  // Show edit button if logged in as this artist
  try {
    const session = JSON.parse(localStorage.getItem('porfolioid_session') || 'null');
    if (session && session.slug === epk.slug) {
      document.getElementById('editBtn').classList.add('visible');
      document.body.classList.add('is-owner');
      window._isOwner = true;
      window._ownerSlug = epk.slug;
    }
  } catch(e) {}

  // Store credits for modal access
  epkCreditsData = epk.credits || [];

  // Build featured videos (first 3)

  // Build connect section — Connect Hub v13 (executive premium)
  const svgIcons = {
    instagram: '<svg viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>',
    facebook: '<svg viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>',
    website: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>',
    spotify: '<svg viewBox="0 0 24 24"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>',
    appleMusic: '<svg viewBox="0 0 24 24"><path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.076-.525c-.378-.127-.76-.2-1.147-.232-.238-.018-.48-.026-.72-.026H5.37c-.24 0-.482.008-.72.026-.387.032-.77.105-1.147.232a5.022 5.022 0 00-1.076.525C1.308 1.624.563 2.624.246 3.934A9.23 9.23 0 00.006 6.124C-.005 6.4 0 6.678 0 6.956v10.088c0 .278-.005.556.006.832.03.732.15 1.46.42 2.153.386 1.01 1.05 1.802 1.97 2.356a5.4 5.4 0 001.574.62c.44.098.886.148 1.336.162.287.008.576.012.864.012h13.66c.288 0 .577-.004.864-.012.45-.014.896-.064 1.336-.163a5.4 5.4 0 001.573-.619c.92-.554 1.584-1.346 1.97-2.356.27-.692.39-1.42.42-2.153.011-.276.006-.554.006-.832V6.956c0-.278.005-.556-.006-.832zm-7.27 8.526a.93.93 0 01-.415.79.894.894 0 01-.501.147.928.928 0 01-.443-.11L9.1 12.74v4.613a.933.933 0 01-.933.934.933.933 0 01-.933-.934V6.647a.933.933 0 01.597-.87.928.928 0 011.006.201l6.554 4.04V6.647a.933.933 0 01.933-.934.933.933 0 01.933.934v8.003z"/></svg>',
    youtube: '<svg viewBox="0 0 24 24"><path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg>',
    soundcloud: '<svg viewBox="0 0 24 24"><path d="M1.175 12.225c-.015 0-.03.002-.044.003C.5 12.28 0 12.84 0 13.516c0 .682.504 1.235 1.124 1.235.02 0 .038-.002.057-.003h.05c.02 0 .038.003.058.003h16.754c.62 0 1.123-.553 1.123-1.235 0-.642-.45-1.17-1.03-1.233a2.95 2.95 0 00.03-.396c0-1.66-1.396-3.005-3.12-3.005-.23 0-.455.026-.67.074C13.74 7.48 12.174 6.5 10.38 6.5c-2.537 0-4.595 1.988-4.595 4.442 0 .08.003.158.008.236-.013-.001-.026-.002-.04-.002-1.326 0-2.4 1.048-2.4 2.342 0 .25.042.49.117.716H1.175z"/></svg>',
    tidal: '<svg viewBox="0 0 24 24"><path d="M12.012 3.992L8.008 7.996 4.004 3.992 0 7.996l4.004 4.004 4.004-4.004 4.004 4.004 4.004-4.004zM8.008 16.004l4.004-4.004 4.004 4.004L20.02 12l-4.004-4.004-4.004 4.004-4.004-4.004L4.004 12z"/></svg>',
    bandcamp: '<svg viewBox="0 0 24 24"><path d="M0 18.75l7.437-13.5H24l-7.438 13.5z"/></svg>',
    booking: '<svg viewBox="0 0 24 24"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/></svg>',
    amazon: '',
    threads: '<svg viewBox="0 0 24 24"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.5 12.068c0-3.52.85-6.374 2.495-8.423C5.845 1.341 8.598.16 12.18.136h.014c2.764.019 5.152.822 6.904 2.322 1.527 1.312 2.44 3.098 2.638 5.163l-2.089.2c-.327-3.345-2.717-5.525-7.447-5.557-2.697.018-4.757.867-6.121 2.523C4.837 6.38 4.164 8.43 4.164 12.068c0 3.643.738 6.148 2.19 7.822 1.322 1.522 3.27 2.297 5.836 2.312 2.202-.013 3.854-.584 4.91-1.698.97-1.018 1.524-2.508 1.648-4.424L16.66 15.7c-.264 1.697-.83 2.938-1.669 3.687-.93.83-2.283 1.25-3.995 1.25l-.81-.637zm7.093-8.72c-.42-4.463-3.005-7.04-7.294-7.04-2.684 0-4.836 1.094-5.988 3.085-.883 1.534-1.082 3.497-.554 5.46.528 1.964 1.813 3.528 3.6 4.406.738.364 1.55.549 2.387.549 1.578 0 2.897-.573 3.82-1.658.84-.99 1.29-2.343 1.29-3.914 0-.156-.01-.311-.027-.464l-.02-.21.028.019 2.759.406z"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
    snapchat: '<svg viewBox="0 0 24 24"><path d="M12.065.001c1.587.007 6.585.38 8.944 5.233.916 1.877.697 5.049.536 7.485l-.01.161c-.01.109.066.232.168.296.52.324 1.63.69 3.255.972.107.019.146.1.112.184-.162.388-.782 1.26-2.472 1.535-.104.016-.133.091-.093.198.073.198.15.546.176.927.025.346-.07.557-.372.557a2.43 2.43 0 00-.617.09c-.59.175-1.195.768-2.13 1.329-1.01.61-2.15.82-3.238.573-.578-.133-1.092-.432-1.573-.715-.43-.254-.829-.49-1.205-.547a1.45 1.45 0 00-.236-.019c-.079 0-.157.006-.234.019-.378.057-.777.293-1.206.547-.48.283-.995.582-1.572.715-1.089.247-2.229.037-3.238-.573-.936-.561-1.54-1.154-2.13-1.329a2.43 2.43 0 00-.617-.09c-.303 0-.397-.211-.372-.557.026-.381.103-.729.176-.927.04-.107.011-.182-.093-.198C.782 15.418.162 14.546 0 14.158c-.034-.084.005-.165.112-.184 1.625-.282 2.735-.648 3.255-.972.102-.064.178-.187.168-.296l-.01-.161c-.16-2.436-.38-5.608.536-7.485C6.41.381 11.408.008 12.065.001z"/></svg>',
    pinterest: '<svg viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/></svg>',
    reddit: '<svg viewBox="0 0 24 24"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>',
    discord: '<svg viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.08.114 18.1.133 18.113a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>',
    twitch: '<svg viewBox="0 0 24 24"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>',
    bluesky: '<svg viewBox="0 0 24 24"><path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.204-.659-.299-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8z"/></svg>',
    mastodon: '<svg viewBox="0 0 24 24"><path d="M23.268 5.313c-.35-2.578-2.617-4.61-5.304-5.004C17.51.242 15.792 0 11.813 0h-.03c-3.98 0-4.835.242-5.288.309C3.882.692 1.496 2.518.917 5.127.64 6.412.61 7.837.661 9.143c.074 1.874.088 3.745.26 5.611.118 1.24.325 2.47.62 3.68.55 2.237 2.777 4.098 4.96 4.857 2.336.792 4.849.923 7.256.38.265-.061.527-.132.786-.213.585-.184 1.27-.39 1.774-.753a.057.057 0 0 0 .023-.043v-1.809a.052.052 0 0 0-.02-.041.053.053 0 0 0-.046-.01 20.282 20.282 0 0 1-4.709.545c-2.73 0-3.463-1.284-3.674-1.818a5.593 5.593 0 0 1-.319-1.433.053.053 0 0 1 .066-.054c1.517.363 3.072.546 4.632.546.376 0 .75 0 1.125-.01 1.57-.044 3.224-.124 4.768-.422.038-.008.077-.015.11-.024 2.435-.464 4.753-1.92 4.989-5.604.008-.145.03-1.52.03-1.67.002-.512.167-3.63-.024-5.545zm-3.748 9.195h-2.561V8.29c0-1.309-.55-1.976-1.67-1.976-1.23 0-1.846.79-1.846 2.35v3.403h-2.546V8.663c0-1.56-.617-2.35-1.848-2.35-1.112 0-1.668.668-1.67 1.977v6.218H4.822V8.102c0-1.31.337-2.35 1.011-3.12.696-.77 1.608-1.164 2.74-1.164 1.311 0 2.302.5 2.962 1.498l.638 1.06.638-1.06c.66-.999 1.65-1.498 2.96-1.498 1.13 0 2.043.395 2.74 1.164.675.77 1.012 1.81 1.012 3.12z"/></svg>',
    telegram: '<svg viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>',
    wechat: '<svg viewBox="0 0 24 24"><path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18z"/></svg>',
    tumblr: '<svg viewBox="0 0 24 24"><path d="M14.563 24c-5.093 0-7.031-3.756-7.031-6.411V9.747H5.116V6.648c3.63-1.313 4.512-4.596 4.71-6.469C9.84.051 9.941 0 9.96 0h3.156v6.248h4.027v3.499h-4.048v7.441c.03 1.209.684 2.136 2.523 2.136a4.685 4.685 0 0 0 1.523-.228v3.396a9.039 9.039 0 0 1-2.578.508z"/></svg>',
    clubhouse: '<svg viewBox="0 0 24 24"><path d="M1.191 6.32c1.956-5.619 9.766-8.003 13.468-5.817 3.702 2.186 4.047 8.047 4.047 8.047s1.735-.576 2.56.231c.825.806.765 2.79-.346 4.284-1.111 1.493-2.618 1.697-2.618 1.697s-1.072 4.438-4.47 6.57c-3.397 2.132-7.81.892-9.307-.857-1.498-1.749-1.128-5.296-1.128-5.296S.482 13.756.38 11.7c-.103-2.056.855-4.762.811-5.38zm9.434 11.39c3.267 0 5.914-2.909 5.914-6.498 0-3.588-2.647-6.497-5.914-6.497-3.267 0-5.914 2.909-5.914 6.497s2.647 6.497 5.914 6.497z"/></svg>',
    dribbble: '<svg viewBox="0 0 24 24"><path d="M12 24C5.385 24 0 18.615 0 12S5.385 0 12 0s12 5.385 12 12-5.385 12-12 12zm10.12-10.358c-.35-.11-3.17-.953-6.384-.438 1.34 3.684 1.887 6.684 1.992 7.308 2.3-1.555 3.936-4.02 4.395-6.87zm-6.115 7.808c-.153-.9-.75-4.032-2.19-7.77l-.066.02c-5.79 2.015-7.86 6.025-8.048 6.409 1.73 1.35 3.92 2.166 6.298 2.166 1.42 0 2.77-.29 4.006-.825zm-11.62-2.857c.232-.4 3.045-5.055 8.332-6.765.135-.045.27-.084.405-.12-.26-.585-.54-1.167-.832-1.74C7.17 11.775 2.206 11.71 1.756 11.7l-.004.312c0 2.633.998 5.037 2.634 6.838zm-2.42-8.955c.46.008 4.683.026 9.477-1.248-1.698-3.018-3.53-5.558-3.8-5.928-2.868 1.35-5.01 3.99-5.676 7.176zM9.6 2.052c.282.38 2.145 2.914 3.822 6 3.645-1.365 5.19-3.44 5.373-3.702-1.81-1.61-4.19-2.586-6.795-2.586-.477 0-.945.04-1.4.113zm8.864 13.28c.04-.01.08-.02.12-.02-1.5-3.855-2.048-6.864-2.15-7.476-.43.07-.865.11-1.3.11-.36 0-.712-.024-1.06-.065-.045.012-.09.025-.13.04 1.44 3.756 1.982 6.778 2.115 7.395.84-.073 1.67-.18 2.405-.33z"/></svg>',
    strava: '<svg viewBox="0 0 24 24"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/></svg>',
    letterboxd: '<svg viewBox="0 0 24 24"><path d="M0 12c0 6.627 5.373 12 12 12s12-5.373 12-12S18.627 0 12 0 0 5.373 0 12zm9.623 4.5L12 8.997l2.377 7.503H9.623zm-2.218 0H4l1.944-2.615.716.483.744-2.368-2.432-1.633h3.527L9.448 7.5 12 16.5l2.552-9h3.45l-1.943 3.367.744 2.368.716-.483L19.461 16.5h-3.405L12 5.985 8.395 16.5H7.405z"/></svg>',
    nextdoor: '<svg viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-.389 16.99c-.88.042-1.755-.124-2.565-.485L7.91 17.5c-.186.096-.4-.062-.37-.27l.395-2.47a5.57 5.57 0 0 1-1.468-4.437c.266-2.694 2.494-4.864 5.193-5.063a5.57 5.57 0 0 1 5.936 5.539c0 2.957-2.296 5.382-5.184 5.49z"/></svg>',
    quora: '<svg viewBox="0 0 24 24"><path d="M12.555 18.858c-.598-1.393-1.309-2.832-2.835-2.832-.301 0-.631.06-.93.195l-.508-1.125c.69-.464 1.695-.763 2.727-.763 2.064 0 3.296 1.035 4.161 2.832h.043a4.574 4.574 0 0 0 .547-2.181c0-2.573-1.884-4.53-4.756-4.53-2.87 0-4.757 1.957-4.757 4.53 0 2.574 1.887 4.531 4.757 4.531.507 0 .993-.064 1.551-.658zM23.5 15.144c0 4.93-4.552 8.856-10.254 8.856h-.492C7.052 24 2.5 20.074 2.5 15.144c0-4.931 4.552-8.884 10.254-8.884.182 0 .358.008.538.016-1.069.8-1.783 2.104-1.783 3.614 0 2.553 1.906 4.635 4.267 4.635.338 0 .671-.044.984-.128-.6 1.254-1.602 2.202-2.784 2.597-.38.129-.552.45-.406.748l.367.773c.128.268.461.374.745.246 2.822-1.255 4.818-4.005 4.818-7.12 0-.155-.008-.308-.02-.46 2.686 1.554 4.02 4.038 4.02 6.963z"/></svg>',
  };

  const labels = {
    instagram:'Instagram', facebook:'Facebook', tiktok:'TikTok', linkedin:'LinkedIn',
    website:'Website', spotify:'Spotify', appleMusic:'Apple Music', youtube:'YouTube',
    soundcloud:'SoundCloud', tidal:'Tidal', bandcamp:'Bandcamp', booking:'Booking & Contact',
    amazon:'Amazon Storefront', threads:'Threads', x:'X (Twitter)', snapchat:'Snapchat',
    pinterest:'Pinterest', reddit:'Reddit', discord:'Discord', twitch:'Twitch',
    bluesky:'Bluesky', mastodon:'Mastodon', telegram:'Telegram', wechat:'WeChat',
    tumblr:'Tumblr', clubhouse:'Clubhouse', dribbble:'Dribbble', strava:'Strava',
    letterboxd:'Letterboxd', nextdoor:'Nextdoor', quora:'Quora',
  };

  const platformColors = {
    instagram:'#E1306C', facebook:'#1877F2', tiktok:'#161823', linkedin:'#0A66C2',
    website:'#C9A84C', spotify:'#1DB954', appleMusic:'#FC3C44', youtube:'#FF0000',
    soundcloud:'#FF5500', tidal:'#000000', bandcamp:'#1DA0C3', booking:'#C9A84C',
    amazon:'#232F3E', threads:'#000000', x:'#000000', snapchat:'#FFFC00',
    pinterest:'#E60023', reddit:'#FF4500', discord:'#5865F2', twitch:'#9146FF',
    bluesky:'#0085FF', mastodon:'#6364FF', telegram:'#26A5E4', wechat:'#07C160',
    tumblr:'#35465C', clubhouse:'#F3EFE7', dribbble:'#EA4C89', strava:'#FC4C02',
    letterboxd:'#00C030', nextdoor:'#8DC63F', quora:'#B92B27',
  };

  const platformBg = {
    instagram:'rgba(225,48,108,0.15)', facebook:'rgba(24,119,242,0.15)',
    tiktok:'rgba(1,1,1,0.9)', linkedin:'rgba(10,102,194,0.15)',
    website:'rgba(201,168,76,0.15)', spotify:'rgba(29,185,84,0.15)',
    appleMusic:'rgba(252,60,68,0.15)', youtube:'rgba(255,0,0,0.12)',
    soundcloud:'rgba(255,85,0,0.15)', tidal:'rgba(0,0,0,0.8)',
    bandcamp:'rgba(29,160,195,0.15)', booking:'rgba(201,168,76,0.15)',
    amazon:'#232F3E', threads:'rgba(0,0,0,0.85)', x:'rgba(0,0,0,0.85)',
    snapchat:'rgba(255,252,0,0.15)', pinterest:'rgba(230,0,35,0.15)',
    reddit:'rgba(255,69,0,0.15)', discord:'rgba(88,101,242,0.15)',
    twitch:'rgba(145,70,255,0.15)', bluesky:'rgba(0,133,255,0.15)',
    mastodon:'rgba(99,100,255,0.15)', telegram:'rgba(38,165,228,0.15)',
    wechat:'rgba(7,193,96,0.15)', tumblr:'rgba(53,70,92,0.8)',
    clubhouse:'rgba(243,239,231,0.15)', dribbble:'rgba(234,76,137,0.15)',
    strava:'rgba(252,76,2,0.15)', letterboxd:'rgba(0,192,48,0.15)',
    nextdoor:'rgba(141,198,63,0.15)', quora:'rgba(185,43,39,0.15)',
  };

  // Custom image icons (overrides SVG for specific platforms)
  const platformImg = {
    amazon: 'https://media.porfolioid.com/profiles/leslie-guerra/icon/leslie-guerra_amazon-icon-logo_v1_20260802.jpg',
    tiktok: 'https://media.porfolioid.com/profiles/leslie-guerra/icon/leslie-guerra_tiktok-icon-logo_v1_20260802.jpg',
  };

  const platformCat = {
    instagram:'Social', facebook:'Social', tiktok:'Social', linkedin:'Professional',
    website:'Website', spotify:'Music', appleMusic:'Music', youtube:'Video',
    soundcloud:'Music', tidal:'Music', bandcamp:'Music', booking:'Booking',
    amazon:'Curated Picks', threads:'Social', x:'Social', snapchat:'Social',
    pinterest:'Social', reddit:'Social', discord:'Community', twitch:'Live',
    bluesky:'Social', mastodon:'Social', telegram:'Messaging', wechat:'Messaging',
    tumblr:'Social', clubhouse:'Audio', dribbble:'Design', strava:'Fitness',
    letterboxd:'Film', nextdoor:'Local', quora:'Knowledge',
  };

  const platformDesc = {
    instagram:'Official Profile', facebook:'Community Updates', tiktok:'Short Form Content',
    linkedin:'Professional Network', website:'View Portfolio', spotify:'Listen to Official Releases',
    appleMusic:'Official Releases', youtube:'Official Channel', soundcloud:'Listen & Stream',
    tidal:'Hi-Fi Streaming', bandcamp:'Independent Music', booking:'Work With Me',
    amazon:'Products I Personally Use & Recommend', threads:'Threads Profile',
    x:'X Profile', snapchat:'Snapchat Stories', pinterest:'Pinterest Boards',
    reddit:'Reddit Profile', discord:'Discord Community', twitch:'Live Streams',
    bluesky:'Bluesky Profile', mastodon:'Mastodon Profile', telegram:'Telegram Channel',
    wechat:'WeChat Account', tumblr:'Tumblr Blog', clubhouse:'Clubhouse Rooms',
    dribbble:'Design Portfolio', strava:'Activity Profile', letterboxd:'Film Journal',
    nextdoor:'Neighborhood', quora:'Answers & Insights',
  };

  // Unique CTA verbs per featured card — creates hierarchy
  const featuredCTA = {
    website:'View Portfolio', instagram:'Follow', spotify:'Listen',
    youtube:'Watch', booking:'Inquire', amazon:'Visit Storefront',
  };

  const s = epk.socials || {};
  const showMetrics = s.showMetrics === true || s.showMetrics === 'true';
  const hasValue = (v) => Array.isArray(v) ? v.some(Boolean) : !!v;
  const getFirstUrl = (v) => Array.isArray(v) ? (v.find(Boolean)||'') : (v||'');
  const getDomain = (url) => { try { return new URL(url).hostname.replace('www.',''); } catch { return url; } };

  const socialKeys = ['instagram','tiktok','facebook','linkedin','threads','x','snapchat','pinterest','reddit','discord','twitch','bluesky','mastodon','telegram','wechat','tumblr','clubhouse','dribbble','strava','letterboxd','nextdoor','quora'];
  const musicKeys = ['spotify','appleMusic','youtube','soundcloud','tidal','bandcamp'];
  const hasSocials = socialKeys.some(k => hasValue(s[k]));
  const hasMusic = musicKeys.some(k => hasValue(s[k]));
  const hasAnyLinks = hasSocials || hasMusic || hasValue(s.website);
  const getSvgPath = (key) => svgIcons[key] ? svgIcons[key].replace('<svg viewBox="0 0 24 24">','').replace('</svg>','') : '';

  // Rich website helper
  const normalizeWebsiteEntry = (v) => {
    if (!v) return null;
    if (typeof v === 'string') return { url: v, title: '', description: '', icon: '' };
    return { url: v.url||'', title: v.title||'', description: v.description||'', icon: v.icon||'' };
  };
  const getWebsites = () => {
    const raw = s.website;
    if (!raw) return [];
    const arr = Array.isArray(raw) ? raw : [raw];
    return arr.map(normalizeWebsiteEntry).filter(w => w && w.url && w.url.trim());
  };

  // ── HERO — two-column ──
  const heroPanelHTML = `
    <div class="ch-hero">
      <div class="ch-hero-left">
        <p class="ch-eyebrow">Connect <span class="ch-eyebrow-line"></span></p>
        <h2 class="ch-hero-title">Connect <em>With Me</em></h2>
      </div>
      <div class="ch-hero-divider"></div>
      <div class="ch-hero-right">
        <p class="ch-hero-sub">Explore my official platforms, music channels, and social media profiles.</p>
        <div class="ch-hero-btns">
          <a href="javascript:void(0)" onclick="openInquiryModal()" class="ch-btn-gold">${bookingLabel} →</a>
        </div>
      </div>
    </div>`;

  // ── PRIMARY FEATURED CARDS — 5 cards, unique CTA verbs ──
  const ws = getWebsites();
  const w = ws[0];

  const buildPrimaryCard = (key, catOverride, nameOverride, descOverride) => {
    const isBooking = key === 'booking';
    const val = s[key];
    if (!val && !isBooking) return '';
    const url = isBooking ? 'javascript:void(0)' : getFirstUrl(val);
    if (!url && !isBooking) return '';
    const color = platformColors[key] || '#C9A84C';
    const cat = catOverride || platformCat[key] || '';
    const name = nameOverride || labels[key] || key;
    const desc = descOverride || platformDesc[key] || '';
    const cta = featuredCTA[key] || 'Visit';
    const imgIcon = platformImg[key];
    return `<a href="${url}" class="ch-pcard" ${isBooking ? 'onclick="openInquiryModal();return false;"' : ''} target="${isBooking?'_self':'_blank'}" rel="noopener">
      <span class="ch-pcard-icon" style="background:${color}">
        ${imgIcon ? `<img src="${imgIcon}" style="width:100%;height:100%;object-fit:cover" alt="${key}">` : `<svg viewBox="0 0 24 24" style="fill:#fff;width:26px;height:26px">${getSvgPath(key)}</svg>`}
      </span>
      <span class="ch-pcard-body">
        <small class="ch-pcard-cat">${cat}</small>
        <span class="ch-pcard-name">${name}</span>
        <span class="ch-pcard-desc">${desc}</span>
      </span>
      <span class="ch-pcard-cta">${cta} →</span>
    </a>`;
  };

  const websiteCard = w
    ? `<a href="${w.url}" class="ch-pcard ch-pcard--primary" target="_blank" rel="noopener">
        <span class="ch-pcard-icon" style="background:#C9A84C">
          ${w.icon ? `<img src="${w.icon}" style="width:26px;height:26px;object-fit:contain;border-radius:50%" onerror="this.outerHTML='<svg viewBox=\\"0 0 24 24\\" style=\\"fill:#fff;width:26px;height:26px\\">${getSvgPath('website')}</svg>'">`
                   : `<svg viewBox="0 0 24 24" style="fill:#fff;width:26px;height:26px">${getSvgPath('website')}</svg>`}
        </span>
        <span class="ch-pcard-body">
          <small class="ch-pcard-cat">Website</small>
          <span class="ch-pcard-name">${w.title || 'PorfolioID'}</span>
          <span class="ch-pcard-desc">${w.description || 'Professional Identity'}</span>
        </span>
        <span class="ch-pcard-cta">View Portfolio →</span>
      </a>`
    : `<a class="ch-pcard ch-pcard--primary ch-pcard--empty" style="pointer-events:none">
        <span class="ch-pcard-icon" style="background:rgba(201,168,76,0.2)">
          <svg viewBox="0 0 24 24" style="fill:rgba(255,255,255,0.35);width:26px;height:26px">${getSvgPath('website')}</svg>
        </span>
        <span class="ch-pcard-body">
          <small class="ch-pcard-cat">Website</small>
          <span class="ch-pcard-name" style="opacity:0.3">Official Website</span>
          <span class="ch-pcard-desc" style="opacity:0.2">Add URL in dashboard</span>
        </span>
        <span class="ch-pcard-cta" style="opacity:0.15">View Portfolio →</span>
      </a>`;

  const amazonUrl = getFirstUrl(s.amazon || '');

  const primaryCardsHTML = [
    websiteCard,
    buildPrimaryCard('instagram','Social','Instagram','Behind The Scenes'),
    buildPrimaryCard('spotify','Music','Spotify','Official Releases'),
    buildPrimaryCard('youtube','Video','YouTube','Watch Live Performances'),
    amazonUrl ? buildPrimaryCard('amazon','Curated Picks','My Picks','Products I Personally Use & Recommend') : null,
    buildPrimaryCard('booking',bookingLabel,'Connect',bookingLabel),
  ].filter(Boolean).join('');

  // ── AMAZON — secondary wide banner ──
  const amazonBannerHTML = amazonUrl ? `
    <a href="${amazonUrl}" class="ch-amazon-banner" target="_blank" rel="noopener">
      <span class="ch-amazon-icon">
        <img src="https://media.porfolioid.com/profiles/leslie-guerra/icon/leslie-guerra_amazon-icon-logo_v1_20260802.jpg" style="width:100%;height:100%;object-fit:cover" alt="amazon">
      </span>
      <span class="ch-amazon-left">
        <small class="ch-amazon-cat">Curated Picks</small>
        <span class="ch-amazon-name">My Picks</span>
        <span class="ch-amazon-desc">Products I Personally Use & Recommend</span>
      </span>
      <span class="ch-amazon-mid">Shop my curated favorites and tools I use on a daily basis for work and life.</span>
      <span class="ch-amazon-cta">Visit Amazon Storefront →</span>
    </a>` : '';

  // ── PLATFORM ROWS — compact ──
  const buildPlatRow = (key, urls) => urls.map((url, i) => {
    const color = platformColors[key] || '#C9A84C';
    const suffix = urls.length > 1 ? ` ${i+1}` : '';
    const desc = platformDesc[key] || getDomain(url);
    const metric = i===0 ? (s[key+'_followers']||'') : '';
    const rowImgIcon = platformImg[key];
    return `<a href="${url}" class="ch-row" target="_blank" rel="noopener" style="--ch-pc:${color}">
      <span class="ch-row-icon" style="background:${color}">
        ${rowImgIcon
          ? `<img src="${rowImgIcon}" style="width:100%;height:100%;object-fit:cover" alt="${key}">`
          : `<svg viewBox="0 0 24 24" style="fill:#fff;width:18px;height:18px">${getSvgPath(key)}</svg>`}
      </span>
      <span class="ch-row-name">${labels[key]}${suffix}</span>
      <span class="ch-row-desc">${desc}</span>
      ${(showMetrics && metric) ? `<span class="ch-metric">${metric}</span>` : ''}
      <span class="ch-row-arrow">→</span>
    </a>`;
  }).join('');

  const buildPlatRows = (keys) => keys.flatMap(k => {
    const val = s[k]; if (!hasValue(val)) return [];
    const urls = Array.isArray(val) ? val.filter(Boolean) : [val];
    return [buildPlatRow(k, urls)];
  }).join('');

  const socialRowsHTML = buildPlatRows(socialKeys);
  const musicRowsHTML = buildPlatRows(musicKeys);

  // ── FOLLOW EVERYWHERE — right column ──
  const followKeys = ['instagram','tiktok','facebook','linkedin','spotify','youtube'].filter(k => hasValue(s[k]));
  const followColHTML = followKeys.length ? `
    <div class="ch-follow-col">
      <p class="ch-section-label">Follow Everywhere</p>
      <div class="ch-follow-grid">
        ${followKeys.map(k => {
          const url = getFirstUrl(s[k]);
          const color = platformColors[k];
          return `<a href="${url}" target="_blank" rel="noopener" class="ch-follow-sq" title="${labels[k]}">
            ${platformImg[k] ? `<img src="${platformImg[k]}" style="width:70%;height:70%;object-fit:contain" alt="${k}">` : `<svg viewBox="0 0 24 24" style="fill:${color};width:28px;height:28px">${getSvgPath(k)}</svg>`}
          </a>`;
        }).join('')}
      </div>
      <p class="ch-follow-tagline">Stay connected across all platforms for the latest updates, content, and releases.</p>
    </div>` : '';

  const connectSectionHTML = hasAnyLinks ? `
    <div class="connect-hub">
      ${heroPanelHTML}
      <div class="ch-feat-wrap">
        <p class="ch-section-label">Featured Links</p>
        <div class="ch-pcards-grid">${primaryCardsHTML}</div>
        ${amazonBannerHTML}
      </div>
      <div class="ch-bottom-cols">
        ${hasSocials ? `<div class="ch-col">
          <p class="ch-section-label">Social Platforms</p>
          <div class="ch-rows">${socialRowsHTML}</div>
        </div>` : ''}
        ${hasMusic ? `<div class="ch-col">
          <p class="ch-section-label">Music Platforms</p>
          <div class="ch-rows">${musicRowsHTML}</div>
        </div>` : ''}
        ${followColHTML}
      </div>
      <p class="ch-footer-note">
        <svg viewBox="0 0 24 24" style="fill:rgba(201,168,76,0.4);width:12px;height:12px;flex-shrink:0"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>
        All platforms are official.
      </p>
    </div>
    <div class="divider"></div>` : '';


  const statsHTML = (epk.stats || []).filter(s => s.number).map(s => `
    <div>
      <span class="hero-stat-number">${s.number}</span>
      <span class="hero-stat-label">${s.label}</span>
    </div>`).join('');

  const taglinesHTML = (epk.taglines || []).join('<br>');

  // NOTE ON FIELD USAGE (per approved design correction): the top first-page
  // slot renders epk.bioImage (the profile portrait) and the lower Career
  // Profile section renders epk.heroImage (the feature/performance image).
  // This is a deliberate reversal of the field *names* vs. where they render
  // — the stored URLs and their upload panels are unchanged; only which
  // section pulls from which field changed. See epk.js history for context.
  //
  // TODO (future refactor, not in scope here): epk.heroImage and
  // epk.bioImage no longer describe where they render in the UI, which is
  // confusing for anyone maintaining this later. Once there's appetite for
  // a data-model change, rename to something like epk.profilePortrait (top
  // slot) and epk.careerFeatureImage (lower Career Profile slot), update
  // the dashboard field labels and panel IDs to match, and migrate existing
  // saved records. Do NOT do this as part of the current fix — it requires
  // a Supabase data migration and dashboard UI changes beyond this PR's
  // scope, and isn't needed for correct behavior today.
  const heroImgPos = epk.bioImagePosition !== undefined ? `center ${epk.bioImagePosition}%` : 'center 0%';
  const heroZoom = epk.bioImageZoom || 100;
  const heroFit = epk.bioImageFit || 'cover';
  const heroZoomStyle = heroZoom !== 100 ? `transform:scale(${heroZoom/100});transform-origin:center top;` : '';
  const heroImgHTML = epk.bioImage
    ? `<img class="hero-img" src="${epk.bioImage}" alt="${epk.name}" style="object-fit:${heroFit};object-position:${heroImgPos};${heroZoomStyle}" onerror="this.parentElement.innerHTML='<div class=hero-placeholder><div class=hero-placeholder-icon>🎤</div></div>'">`
    : `<div class="hero-placeholder"><div class="hero-placeholder-icon">🎤</div></div>`;

  const bioImgHTML = epk.bioImage
    ? `<img class="bio-portrait" src="${epk.bioImage}" alt="${epk.name}" onerror="this.style.display='none'">`
    : '';

  const contactHTML = [
    epk.location ? `<div class="bio-contact-item"><span class="bio-contact-dot"></span><span>Based in ${epk.location}</span></div>` : '',
    epk.availability ? `<div class="bio-contact-item"><span class="bio-contact-dot"></span><span>${epk.availability}</span></div>` : '',
    `<div class="bio-contact-item"><span class="bio-contact-dot"></span><span>Contact available upon request</span></div>`,
  ].join('');

  const credentialsHTML = (epk.credentials || []).length
    ? `<div class="credentials-row">${epk.credentials.map(c => `<span class="credential-badge">${c}</span>`).join('')}</div>`
    : '';

  const bioParas = (epk.bio || '').split('\n').filter(p => p.trim());
  const shortBio = epk.shortBio || (bioParas[0] || '');
  const bioFullText = epk.bioFull || bioParas.slice(1).join('\n\n');
  const hasMoreBio = bioFullText.trim().length > 0;
  const bioParagraphs = bioFullText.split(/\n\n+/).filter(p => p.trim()).map(p => `<p style="margin-bottom:1em">${p}</p>`).join('');
  const shortBioHTML = `<p style="margin-bottom:1.5em">${shortBio}</p>`;

  // Build career profile card (Profile Card system - supports Executive Resume,
  // Biography, and Other card types via the generic fields below. cardType only
  // drives dashboard form defaults; rendering here is fully generic and works
  // identically regardless of cardType. All fields fall back safely so existing
  // cards saved before this system (resumeUrl/url only) keep working unchanged.)
  const buildResumeCard = (r, idx) => {
    const isMusicResume = (r.label||'').includes('Marketing') || (r.title||'').includes('Marketing') || (r.label||'').includes('Artist');
    const rc = isMusicResume ? 'var(--gold)' : '#8FB8D0';
    const rbg = isMusicResume ? 'rgba(201,168,76,' : 'rgba(123,155,175,';
    const cardTypeLabels = { executive_resume: 'Executive Resume', biography: 'Biography', other: 'Other' };
    const displayLabel = cardTypeLabels[r.cardType] || r.label || 'Resume';
    const pdfUrl = r.pdfUrl || r.resumeUrl || r.url || '';
    const pdfBtnLabel = r.pdfButtonLabel || 'Download Resume';
    const pdfAreaHTML = pdfUrl
      ? `<a href="${pdfUrl}" target="_blank" class="resume-card-btn" style="color:${rc};border-color:${rc}4D">↓ ${pdfBtnLabel} →</a>`
      : (r.showPdfComingSoon ? '<span style="font-family:var(--font-mono);font-size:0.55rem;color:var(--gray);letter-spacing:0.1em;opacity:0.5">PDF coming soon</span>' : '');
    // "Read Full Biography" opens the same modal used by Credit cards (openBiographyModal
    // reuses #creditModalOverlay) so the on-site reading experience matches the rest of
    // the site exactly. Index-based lookup (epkResumeCards[idx]) avoids embedding the
    // full long-form text inside an inline HTML attribute. Only renders when fullBio
    // is actually present on the card - independent of cardType, so it's available to
    // any Profile Card that has long-form text, not just Biography.
    const readBioHTML = r.fullBio ? `<button type="button" class="resume-card-btn" style="color:${rc};border-color:${rc}4D;background:none;cursor:pointer" onclick="openBiographyModal(${idx})">Read Full Biography →</button>` : '';
    const buttonRowHTML = [pdfAreaHTML, readBioHTML].filter(Boolean).join('');
    return `<div class="resume-card" style="border-top:3px solid ${rc}">
      <div class="resume-card-label" style="color:${rc}">${displayLabel}</div>
      <div class="resume-card-title">${r.title}</div>
      <div class="resume-card-subtitle">${r.subtitle || ''}</div>
      ${r.skills?.length ? `<div class="resume-card-skills">${r.skills.map(s => `<span class="resume-skill-tag" style="border-color:${rc}4D;background:${rc}0D">${s}</span>`).join('')}</div>` : ''}
      ${r.desc ? `<div class="resume-card-desc">${r.desc}</div>` : ''}
      ${buttonRowHTML ? `<div style="display:flex;gap:0.75rem;flex-wrap:wrap;margin-top:auto;padding-top:1.25rem">${buttonRowHTML}</div>` : ''}
      ${r.footerText ? `<div style="margin-top:0.85rem;padding-top:0.75rem;border-top:1px solid rgba(201,168,76,0.15);font-family:var(--font-mono);font-size:0.55rem;color:var(--gray);letter-spacing:0.08em;line-height:1.5;opacity:0.7">${r.footerText}</div>` : ''}
    </div>`;
  };


  const careerLayout = epk.careerLayout || 'stacked';
  const resumeCards = epk.resumeCards || [];
  epkResumeCards = resumeCards;
  const bioImgPos = epk.heroImagePosition !== undefined ? `center ${epk.heroImagePosition}%` : 'center 0%';
  const bioZoom = epk.heroImageZoom || 100;
  const bioCropTop = epk.heroImageCropTop || 0; // not currently editable from the Hero panel; defaults to no crop
  const bioZoomStyle = bioZoom !== 100 ? `transform:scale(${bioZoom/100});transform-origin:center top;` : '';
  const bioCropStyle = bioCropTop > 0 ? `margin-top:-${bioCropTop}%;height:calc(100% + ${bioCropTop}%);` : '';
  const bioFit = epk.heroImageFit || 'cover';
  const bioContainerStyle = bioFit === 'contain' ? 'background:transparent;display:flex;align-items:flex-start;justify-content:center;' : '';
  const bioPortrait = epk.heroImage ? `<div style="position:relative;overflow:hidden;width:100%;height:100%;${bioContainerStyle}"><img src="${epk.heroImage}" class="career-portrait" alt="${epk.name}" style="object-fit:${bioFit};object-position:${bioImgPos};${bioZoomStyle}${bioCropStyle}"></div>` : '';

  const bioShortContent = `
    <div class="career-bio-text">
      <div id="bioShort" data-editable data-editable-key="shortBio" data-editable-type="body" style="outline:none">${shortBioHTML}</div>
      ${hasMoreBio ? `
      <div id="bioFull" style="display:none;margin-top:0.5em">${bioParagraphs}</div>
      <button onclick="toggleBio()" id="bioToggleBtn" style="font-family:var(--font-mono);font-size:0.6rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--gold);background:none;border:1px solid rgba(201,168,76,0.3);padding:0.4rem 0.9rem;cursor:pointer;margin-top:1rem;transition:all 0.2s">Read Full Bio +</button>` : ''}
    </div>`;

  const bioFullContent = '';

  const bioContent = bioShortContent;

  // Build career profile HTML for the top always-visible Career Profile
  // section — PORTRAIT + BIOGRAPHY TEXT ONLY.
  //
  // IMPORTANT: resumeCards (Executive Resume / About Leslie / etc., via
  // buildResumeCard) are deliberately NOT included here. They already
  // render in their one original location further down the page, inside
  // the expandable Credits container under "Professional Documents" (see
  // the "PROFESSIONAL RESUME" block below, further down in this function).
  // An earlier version of this section reused the same careerLayout
  // branches used by that lower section, which also assembled resumeCards
  // markup — inserting that combined markup at the top caused every resume
  // card to render twice on the page. This block intentionally builds only
  // the portrait/bio markup, regardless of careerLayout, so the top section
  // can never reintroduce that duplication even if the Career Profile
  // Layout setting (stacked / side-by-side / three columns) changes later.
  let careerProfileHTML = '';
  if (careerLayout === 'sidebyside' || careerLayout === 'threecol') {
    // Both multi-column layouts collapse to the same single-column
    // portrait+bio treatment here, since the cards column that used to
    // differentiate them no longer applies to this always-visible section.
    careerProfileHTML = `
      <div class="career-sidebyside">
        <div class="career-sidebyside-left">
          ${bioPortrait}
          ${bioContent}
        </div>
      </div>`;
  } else {
    // Stacked (default)
    careerProfileHTML = `
      <div class="career-stacked-bio">
        ${bioPortrait ? `<div>${bioPortrait}</div>` : ''}
        ${bioContent}
      </div>`;
  }


  // Sort: pinned first, filter hidden
  const visibleCredits = (epk.credits || [])
    .map((c, i) => ({...c, _origIdx: i}))
    .filter(c => c.visible !== false)
;
  epkVisibleCredits = visibleCredits;

  const musicCreditNames = ['Don Omar','J Álvarez','Melina León','Las Nenas del Swing'];

  const creditsHTML = visibleCredits.map((c, i) => {
    const origI = c._origIdx;
    const hasPhotos = c.photos && c.photos.length > 0;
    const hasDetail = c.fullDesc || hasPhotos || c.mediaLink || c.videoUrl;
    const isMusic = musicCreditNames.includes(c.company || c.artist);
    const accentColor = isMusic ? 'var(--gold)' : '#8FB8D0';
    const cardTypeLabel = isMusic ? 'MUSIC & ENTERTAINMENT' : 'PROFESSIONAL';
    const categoryBadge = c.category ? `<span style="font-family:var(--font-mono);font-size:0.5rem;letter-spacing:0.1em;text-transform:uppercase;background:rgba(201,168,76,0.08);color:var(--gray);padding:0.15rem 0.5rem;margin-right:0.4rem">${c.category}</span>` : '';
    const verifiedBadge = c.verified ? `<span style="font-family:var(--font-mono);font-size:0.5rem;letter-spacing:0.1em;text-transform:uppercase;background:rgba(100,200,100,0.1);color:#7ec97e;padding:0.15rem 0.5rem">✦ VERIFIED</span>` : '';
    const pinnedBadge = c.pinned ? `<span style="font-family:var(--font-mono);font-size:0.5rem;letter-spacing:0.1em;text-transform:uppercase;background:rgba(201,168,76,0.12);color:var(--gold);padding:0.15rem 0.5rem">📌 FEATURED</span>` : '';
    const badgesRow = (categoryBadge || verifiedBadge || pinnedBadge) ? `<div style="margin-bottom:0.5rem;display:flex;gap:0.3rem;flex-wrap:wrap">${pinnedBadge}${verifiedBadge}${categoryBadge}</div>` : '';
    const collaboratorsRow = c.collaborators?.length ? `<div style="font-family:var(--font-mono);font-size:0.55rem;color:var(--gray);margin-top:0.3rem;letter-spacing:0.08em">w/ ${c.collaborators.join(', ')}</div>` : '';
    const ownerArrows = `<div class="owner-overlay" style="flex-direction:column;gap:0.2rem"><button class="owner-action-btn owner-up" onclick="event.stopPropagation();moveCreditCard(${i},-1)">&#9650;</button><button class="owner-action-btn owner-down" onclick="event.stopPropagation();moveCreditCard(${i},1)">&#9660;</button></div>`;
    return `
    <div class="credit-card owner-item-wrap" data-highlight="${c.highlightTag || ''}" ${hasDetail ? `onclick="openCreditModal(${i})"` : '' } style="border-top:2px solid ${accentColor};position:relative">
      ${ownerArrows}
      <div style="font-family:var(--font-mono);font-size:0.48rem;letter-spacing:0.18em;text-transform:uppercase;color:${accentColor};opacity:0.6;margin-bottom:0.5rem">${cardTypeLabel}</div>
      ${badgesRow}
      <div class="credit-header">
        <div class="credit-artist">${c.company || c.artist}</div>
        ${c.years ? `<span class="credit-years">${c.years}</span>` : ''}
      </div>
      <div class="credit-role" style="color:${accentColor}">${c.role}${c.contractType ? ` · <span style="opacity:0.7">${c.contractType}</span>` : ''}</div>
      ${collaboratorsRow}
      ${c.desc ? `<p class="credit-desc" data-editable data-editable-key="credits.${i}.desc" data-editable-type="body" style="-webkit-line-clamp:2;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;outline:none" onclick="event.stopPropagation()">${c.desc}</p>` : ''}
      ${hasDetail ? `<div class="credit-expand-hint" style="color:${accentColor}">View Details →</div>` : ''}
    </div>`;
  }).join('');

  // Filter hidden & unreleased tracks
  const visibleTracks = (epk.tracks || []).filter(t => t.visible !== false && !t.unreleased);

  const tracksHTML = visibleTracks.map((t, i) => {
    const isMP3 = t.link && (t.link.includes('.mp3') || t.link.includes('cloudinary') || t.link.includes('.wav') || t.link.includes('.ogg'));
    const linkHTML = t.link ? (isMP3
      ? `<audio controls style="width:100%;height:32px;margin-top:0.5rem;opacity:0.8;accent-color:var(--gold)" src="${t.link}"></audio>`
      : `<a href="${t.link}" target="_blank" style="font-family:var(--font-mono);font-size:0.6rem;color:var(--gold);letter-spacing:0.1em">Listen →</a>`)
      : '';
    return `
    <div class="track-item">
      <span class="track-num">0${i+1}</span>
      <div class="track-info">
        <div class="track-title">${t.title} ${t.tag ? `<span class="track-tag">${t.tag}</span>` : ''}</div>
        <div class="track-artist">${t.artist}</div>
        ${(t.album || t.year) ? `<div class="track-meta">${t.album ? `<span>${t.album}</span>` : ''}${t.album && t.year ? ' · ' : ''}${t.year || ''}</div>` : ''}
        ${t.desc ? `<div class="track-desc">${t.desc}</div>` : ''}
        ${linkHTML}
      </div>
      <div class="track-role">${t.role}</div>
    </div>`;
  }).join('');


  // Filter hidden videos — respect manual order set in dashboard
  const visibleVideos = (epk.videos || [])
    .filter(v => v.visible !== false);

  const buildVideoCard = (v, vidIdx, showDesc) => {
    if (showDesc === undefined) showDesc = true;
    const ownerOverlay = `<div class="owner-overlay" style="flex-direction:row;gap:0.2rem"><button class="owner-action-btn owner-up" onclick="event.stopPropagation();ownerMoveItem('videos',${vidIdx},-1)" title="Move Left">◀</button><button class="owner-action-btn owner-down" onclick="event.stopPropagation();ownerMoveItem('videos',${vidIdx},1)" title="Move Right">▶</button></div>`;
    const isMP4 = v.url && (v.url.includes('.mp4') || v.url.includes('.mov') || v.url.includes('.webm') || (v.url.includes('cloudinary') && !v.url.includes('youtube')));
    const thumb = v.thumb || getYouTubeThumb(v.url);
    const videoMeta = (v.album || v.year) ? `<div class="vcard-meta">${v.album ? `<span>${v.album}</span>` : ''}${v.album && v.year ? ' · ' : ''}${v.year || ''}</div>` : '';
    const videoDesc = (showDesc && v.desc) ? `<div class="vcard-desc">${v.desc}</div>` : '';
    const categoryBadge = v.category ? `<div class="vcard-badge">${v.category}</div>` : '';
    const featuredBadge = v.featured ? `<div class="vcard-badge vcard-badge-featured">★ Featured</div>` : '';
    if (isMP4) {
      return `<div class="vcard owner-item-wrap">${ownerOverlay}<div class="vcard-media">${categoryBadge}${featuredBadge}<video controls style="width:100%;aspect-ratio:16/9;display:block;background:#000;object-fit:contain" ${v.thumb ? `poster="${v.thumb}"` : ''}><source src="${v.url}" type="video/mp4"></video></div><div class="vcard-body"><div class="vcard-title">${v.title}</div>${videoMeta}${videoDesc}</div></div>`;
    }
    const ytId = v.url ? v.url.match(/youtube\.com.*v=([^&]+)|youtu\.be\/([^?]+)/) : null;
    const ytVideoId = ytId ? (ytId[1] || ytId[2]) : null;
    if (ytVideoId) {
      const ytEmbedId = 'yt_' + vidIdx + '_' + ytVideoId;
      return `<div class="vcard owner-item-wrap" id="ytcard_${ytEmbedId}">${ownerOverlay}<div class="vcard-media vcard-media-clickable" id="ytthumb_${ytEmbedId}" onclick="playYouTubeInline('${ytEmbedId}','${ytVideoId}')">${categoryBadge}${featuredBadge}${thumb ? `<img class="vcard-thumb" src="${thumb}" alt="${v.title}" loading="lazy">` : `<div class="vcard-thumb vcard-thumb-empty">▶</div>`}<div class="vcard-play">▶</div></div><div id="ytembed_${ytEmbedId}" style="display:none;width:100%;aspect-ratio:16/9"></div><div class="vcard-body"><div class="vcard-title">${v.title}</div>${videoMeta}${videoDesc}<a href="${v.url}" target="_blank" class="vcard-ytlink">↗ Watch on YouTube</a></div></div>`;
    }
    return `<div class="vcard owner-item-wrap" onclick="window.open('${v.url}','_blank')">${ownerOverlay}<div class="vcard-media vcard-media-clickable">${categoryBadge}${featuredBadge}${thumb ? `<img class="vcard-thumb" src="${thumb}" alt="${v.title}" loading="lazy">` : `<div class="vcard-thumb vcard-thumb-empty">▶</div>`}<div class="vcard-play">▶</div></div><div class="vcard-body"><div class="vcard-title">${v.title}</div>${videoMeta}${videoDesc}</div></div>`;
  };

  // Group by category — but keep original indices for reordering.
  // Reused by Grid (category headings) and Spotlight (Collections).
  const groupedVideos = {};
  const uncategorized = [];
  visibleVideos.forEach((v, origIdx) => {
    v._origIdx = origIdx;
    if (v.category) {
      if (!groupedVideos[v.category]) groupedVideos[v.category] = [];
      groupedVideos[v.category].push(v);
    } else {
      uncategorized.push(v);
    }
  });

  const hasCategories = Object.keys(groupedVideos).length > 0;
  const videoLayout = epk.videoLayout || 'grid';

  // Shared media builder for a hero/featured video (used by Cinematic and
  // Spotlight). Preserves all three playback mechanisms exactly.
  const buildFeaturedMedia = (v, playerId) => {
    if (!v) return '';
    const isMP4 = v.url && (v.url.includes('.mp4') || v.url.includes('.mov') || v.url.includes('.webm') || (v.url.includes('cloudinary') && !v.url.includes('youtube')));
    const th = v.thumb || getYouTubeThumb(v.url);
    const ytMatch = v.url ? v.url.match(/youtube\.com.*v=([^&]+)|youtu\.be\/([^?]+)/) : null;
    const ytId = ytMatch ? (ytMatch[1] || ytMatch[2]) : null;
    if (isMP4) {
      return `<video ${playerId ? `id="${playerId}"` : ''} controls style="width:100%;height:100%;display:block;background:#000;object-fit:contain" ${v.thumb ? `poster="${v.thumb}"` : ''}><source src="${v.url}" type="video/mp4"></video>`;
    }
    if (ytId) {
      return `<iframe ${playerId ? `id="${playerId}"` : ''} src="https://www.youtube.com/embed/${ytId}?rel=0" style="width:100%;height:100%;border:none;display:block" allowfullscreen allow="autoplay; encrypted-media"></iframe>`;
    }
    return `<div onclick="window.open('${v.url}','_blank')" style="position:relative;cursor:pointer;width:100%;height:100%">${th ? `<img src="${th}" style="width:100%;height:100%;object-fit:cover;display:block">` : ''}<div class="vcard-play" style="width:64px;height:64px;font-size:1.3rem">▶</div></div>`;
  };

  // Emits one .videos-grid per list of videos. Responsive column count
  // (3/2/1) and centering of any trailing incomplete row are both
  // handled entirely by CSS (repeat(auto-fit, minmax(...)) +
  // justify-content:center) -- correct at every breakpoint automatically,
  // never by arbitrarily enlarging a card.
  const buildGridRows = (vids, showDesc) => {
    if (!vids.length) return '';
    return `<div class="video-carousel-wrap">
      <button class="video-carousel-arrow video-carousel-arrow-prev" onclick="scrollCarousel(this,-1)" aria-label="Scroll left">‹</button>
      <div class="video-carousel">${vids.map(v => buildVideoCard(v, v._origIdx, showDesc)).join('')}</div>
      <button class="video-carousel-arrow video-carousel-arrow-next" onclick="scrollCarousel(this,1)" aria-label="Scroll right">›</button>
    </div>`;
  };

  let videosHTML = '';

  if (videoLayout === 'cinematic') {
    // Editorial hero: video left, info right on desktop; stacks on mobile.
    const [first, ...rest] = visibleVideos;
    if (first) {
      const meta = [first.album, first.year].filter(Boolean).join(' · ');
      videosHTML = `<div class="video-hero video-hero-glow">
        <div class="video-hero-media">${buildFeaturedMedia(first)}</div>
        <div class="video-hero-info">
          ${first.category ? `<div class="video-hero-eyebrow">${first.category}</div>` : ''}
          <h3 class="video-hero-title">${first.title}</h3>
          ${meta ? `<div class="video-hero-meta">${meta}</div>` : ''}
          ${first.desc ? `<div class="video-hero-desc">${first.desc}</div>` : ''}
          <a href="${first.url}" target="_blank" class="video-hero-watch">Watch Performance →</a>
        </div>
      </div>`;
    }
    if (rest.length) {
      videosHTML += `<div class="videos-subsection videos-more-performances">
        <div class="videos-subheading">More Performances<span class="videos-subheading-rule"></span></div>
        ${buildGridRows(rest.map((v,i) => { v._origIdx = first ? i + 1 : i; return v; }), true)}
      </div>`;
    }
  } else if (videoLayout === 'list') {
    videosHTML = '<div class="videos-list-wrap">';
    visibleVideos.forEach((v, i) => {
      const isMP4 = v.url && (v.url.includes('.mp4') || v.url.includes('cloudinary'));
      const thumb = v.thumb || getYouTubeThumb(v.url);
      const thumbHTML = isMP4
        ? `<video style="width:100%;aspect-ratio:16/9;display:block" src="${v.url}" ${v.thumb?`poster="${v.thumb}"`:''}></video>`
        : `${thumb?`<img src="${thumb}" style="width:100%;aspect-ratio:16/9;object-fit:cover;display:block" alt="${v.title}">`:''}<div class="video-play">▶</div>`;
      videosHTML += `<div class="video-list-item">
        <div class="video-list-thumb owner-item-wrap" onclick="window.open('${v.url}','_blank')">${thumbHTML}<div class="owner-overlay"><button class="owner-action-btn owner-up" onclick="event.stopPropagation();ownerMoveItem('videos',${i},-1)">▲</button><button class="owner-action-btn owner-down" onclick="event.stopPropagation();ownerMoveItem('videos',${i},1)">▼</button></div></div>
        <div class="video-list-info">
          ${v.category ? `<div class="video-list-category">${v.category}</div>` : ''}
          <div class="video-list-title">${v.title}</div>
          <div class="video-list-meta">${[v.album, v.year].filter(Boolean).join(' · ')}</div>
          ${v.desc?`<div class="video-list-desc">${v.desc}</div>`:''}
        </div>
      </div>`;
    });
    videosHTML += '</div>';
  } else if (videoLayout === 'spotlight') {
    // Shared clickable item for Collections: always sets the featured
    // player via spotlightSelect(), always carries a stable
    // data-video-idx identifier (the video's own index in
    // visibleVideos) so the active-highlight can match by identity
    // instead of DOM/carousel-scroll position.
    const buildSpotlightThumb = (v) => {
      const th = v.thumb || getYouTubeThumb(v.url);
      const img = th ? `<img class="vcard-thumb" src="${th}" alt="${v.title}" loading="lazy">` : `<div class="vcard-thumb-empty" style="aspect-ratio:16/9">▶</div>`;
      return `<div class="videos-spotlight-thumb videos-collection-thumb" data-video-idx="${v._origIdx}" onclick="spotlightSelect(${v._origIdx})" title="${v.title}">
        ${img}
        <div class="video-play" style="width:1.6rem;height:1.6rem;font-size:0.7rem">▶</div>
      </div>`;
    };
    const first = visibleVideos[0];
    const rest = visibleVideos.slice(1);
    let html = '';
    if (first) {
      const meta = [first.album, first.year].filter(Boolean).join(' · ');
      html += `<div class="video-hero video-hero-glow">
        <div class="video-hero-media videos-spotlight-player" data-video-idx="${first._origIdx}">${buildFeaturedMedia(first, 'spotlightPlayer')}</div>
        <div class="video-hero-info">
          <div class="video-hero-eyebrow video-hero-eyebrow-featured">✦ Featured${first.category ? ` · ${first.category}` : ''}</div>
          <h3 class="video-hero-title" id="spotlightFeaturedTitle">${first.title}</h3>
          <div class="video-hero-meta" id="spotlightFeaturedMeta">${meta}</div>
          ${first.desc ? `<div class="video-hero-desc" id="spotlightFeaturedDesc">${first.desc}</div>` : ''}
          <a href="${first.url}" target="_blank" class="video-hero-watch" id="spotlightFeaturedWatch">Watch Performance →</a>
        </div>
      </div>`;
    }
    if (rest.length) {
      html += `<div class="videos-subsection videos-collections">
        <div class="videos-subheading">Collections<span class="videos-subheading-rule"></span></div>
        <div class="video-carousel-wrap">
          <button class="video-carousel-arrow video-carousel-arrow-prev" onclick="scrollCarousel(this,-1)" aria-label="Scroll left">‹</button>
          <div class="video-carousel">${rest.map(v => buildSpotlightThumb(v)).join('')}</div>
          <button class="video-carousel-arrow video-carousel-arrow-next" onclick="scrollCarousel(this,1)" aria-label="Scroll right">›</button>
        </div>
      </div>`;
    }
    videosHTML = html;
  } else {
    // Grid: compact visual overview of the entire library. Flat,
    // uncategorized (category shown as a badge inside each card, not
    // as a section divider), static multi-column grid -- not a
    // carousel, deliberately distinct from Cinematic/Spotlight now
    // that those use horizontal scrolling. Category is preserved as
    // metadata via buildVideoCard's existing badge, just no longer
    // used to split the page into separate sections/rows.
    if (visibleVideos.length) {
      videosHTML = `<div class="videos-flat-grid">${visibleVideos.map(v => buildVideoCard(v, v._origIdx, false)).join('')}</div>`;
    }
  }

  const categoryIcons = {
    'Resume': '📄', 'Professional Assets': '📄',
    'Education': '🎓', 'Diploma': '🎓',
    'Certification': '📜', 'Certificate': '📜',
    'Award': '🏆', 'Recognition': '🏆',
    'Press': '📰', 'Press Kit': '📦',
    'Contract': '✍️', 'Contract Template': '✍️',
    'Letter': '✉️', 'Recommendation': '✉️',
    'Tech Rider': '🎛', 'Stage Plot': '🎭',
    'Bio': '📝', 'Photo Pack': '📸', 'Other': '📄'
  };

  function getAssetIcon(a) {
    const t = (a.title || '').toLowerCase();
    const c = (a.category || '').toLowerCase();
    if (t.includes('resume') || c.includes('resume') || c.includes('professional')) return '📄';
    if (t.includes('diploma') || t.includes('degree')) return '🎓';
    if (t.includes('certification') || t.includes('certificate') || c.includes('certif')) return '📜';
    if (t.includes('award') || t.includes('honor') || t.includes('president')) return '🏆';
    if (t.includes('press') || t.includes('media')) return '📰';
    if (t.includes('contract') || t.includes('agreement')) return '✍️';
    if (t.includes('letter') || t.includes('recommendation')) return '✉️';
    return categoryIcons[a.category] || '📄';
  }

  // ── PREMIUM ASSETS SECTION ────────────────────────────────────────────────
  // Category pill colors
  function getCatColor(cat) {
    const c = (cat || '').toLowerCase();
    if (c.includes('professional') || c.includes('resume')) return {bg:'rgba(201,168,76,0.15)',color:'#C9A84C',border:'rgba(201,168,76,0.4)'};
    if (c.includes('education') || c.includes('diploma')) return {bg:'rgba(139,92,246,0.15)',color:'#a78bfa',border:'rgba(139,92,246,0.4)'};
    if (c.includes('certif')) return {bg:'rgba(20,184,166,0.15)',color:'#2dd4bf',border:'rgba(20,184,166,0.4)'};
    if (c.includes('award') || c.includes('honor')) return {bg:'rgba(251,191,36,0.15)',color:'#fbbf24',border:'rgba(251,191,36,0.4)'};
    if (c.includes('press')) return {bg:'rgba(59,130,246,0.15)',color:'#60a5fa',border:'rgba(59,130,246,0.4)'};
    if (c.includes('contract')) return {bg:'rgba(239,68,68,0.15)',color:'#f87171',border:'rgba(239,68,68,0.4)'};
    return {bg:'rgba(255,255,255,0.06)',color:'#888',border:'rgba(255,255,255,0.15)'};
  }

  // SVG icons per asset type
  function getAssetSVG(a) {
    const t = (a.title||'').toLowerCase();
    const c = (a.category||'').toLowerCase();
    const gold = 'rgba(201,168,76,0.9)';
    if (t.includes('resume') || c.includes('professional')) return '<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><rect x="6" y="3" width="20" height="26" rx="2" stroke="'+gold+'" stroke-width="1.5"/><line x1="10" y1="9" x2="22" y2="9" stroke="'+gold+'" stroke-width="1.5" stroke-linecap="round"/><line x1="10" y1="13" x2="22" y2="13" stroke="'+gold+'" stroke-width="1.5" stroke-linecap="round"/><line x1="10" y1="17" x2="18" y2="17" stroke="'+gold+'" stroke-width="1.5" stroke-linecap="round"/><circle cx="12" cy="23" r="2" stroke="'+gold+'" stroke-width="1.5"/><line x1="16" y1="22" x2="22" y2="22" stroke="'+gold+'" stroke-width="1" stroke-linecap="round"/><line x1="16" y1="24" x2="20" y2="24" stroke="'+gold+'" stroke-width="1" stroke-linecap="round"/></svg>';
    if (t.includes('diploma') || t.includes('degree') || c.includes('education')) return '<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M16 6L2 13l14 7 14-7-14-7z" stroke="'+gold+'" stroke-width="1.5" stroke-linejoin="round"/><path d="M6 15.5V22c0 2.5 4.5 5 10 5s10-2.5 10-5v-6.5" stroke="'+gold+'" stroke-width="1.5" stroke-linecap="round"/><line x1="28" y1="13" x2="28" y2="21" stroke="'+gold+'" stroke-width="1.5" stroke-linecap="round"/><circle cx="28" cy="22.5" r="1.5" fill="'+gold+'"/></svg>';
    if (t.includes('president') || t.includes('list') || (t.includes('certif') && c.includes('education'))) return '<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><rect x="5" y="4" width="22" height="18" rx="2" stroke="'+gold+'" stroke-width="1.5"/><path d="M10 28l6-5 6 5" stroke="'+gold+'" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16" cy="13" r="4" stroke="'+gold+'" stroke-width="1.5"/><line x1="11" y1="9" x2="11" y2="9" stroke="'+gold+'" stroke-width="1.5" stroke-linecap="round"/></svg>';
    if (t.includes('analytics') || t.includes('excel') || c.includes('certif')) return '<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="11" stroke="'+gold+'" stroke-width="1.5"/><path d="M16 16l-5-5" stroke="'+gold+'" stroke-width="1.5" stroke-linecap="round"/><circle cx="16" cy="16" r="2" fill="'+gold+'"/><path d="M16 5v3M27 16h-3M16 27v-3M5 16h3" stroke="'+gold+'" stroke-width="1.5" stroke-linecap="round"/></svg>';
    return '<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><rect x="7" y="3" width="18" height="26" rx="2" stroke="'+gold+'" stroke-width="1.5"/><line x1="11" y1="10" x2="21" y2="10" stroke="'+gold+'" stroke-width="1.5" stroke-linecap="round"/><line x1="11" y1="15" x2="21" y2="15" stroke="'+gold+'" stroke-width="1.5" stroke-linecap="round"/><line x1="11" y1="20" x2="17" y2="20" stroke="'+gold+'" stroke-width="1.5" stroke-linecap="round"/></svg>';
  }

  function getAssetDetails(a) {
    const t = (a.title||'').toLowerCase();
    const parts = [];
    if (t.includes('resume')) { parts.push('Professional Resume'); parts.push('PDF'); }
    else if (t.includes('diploma')) { parts.push('Diploma'); parts.push('1 document • PDF'); }
    else if (t.includes('president')) { parts.push('Certificate'); parts.push('1 document • PDF'); }
    else if (t.includes('analytics') && t.includes('google')) { parts.push('Google Analytics 4 Certification'); parts.push('1 document • PDF'); }
    else if (t.includes('excel') || t.includes('business analytics')) { parts.push('Business Analytics Course'); parts.push('1 document • PDF'); }
    else { if (a.desc) parts.push(a.desc.split(',')[0]); parts.push('PDF'); }
    return parts.join(' • ');
  }

  function getAssetYear(a) {
    if (!a.desc) return '';
    const m = a.desc.match(/(\d{4})/);
    return m ? m[1] : '';
  }

  function getAssetSubtitle(a) {
    const t = (a.title||'').toLowerCase();
    if (t.includes('resume')) return 'Professional Resume';
    if (a.desc) {
      // Strip trailing year since it's shown in the "Issued" line
      const cleaned = a.desc.replace(/[,\s]*\d{4}\s*$/, '').trim();
      const bits = cleaned.split(/[,—–]/).map(s=>s.trim()).filter(s=>s.length>0 && !/^\d{4}$/.test(s));
      return bits.slice(0,2).join(' • ');
    }
    return '';
  }

  const assetsLocked = epk.assetsLocked === true;
  const assetsLayout = epk.assetsLayout || 'cards';
  const visibleAssets = (epk.assets || []).filter(a => a.visible !== false && a.category !== 'Resume');
  const allCategories = [...new Set(visibleAssets.map(a => a.category).filter(Boolean))];

  // Preview now mirrors the same assetsLocked/a.url branching already proven
  // correct in makeAccessBtn() below, rather than always routing to Connect.
  // Locked: no file URL is ever exposed, same safe fallback as Request Access.
  // Unlocked with a real file: opens the actual asset directly.
  // Unlocked with no file: nothing to preview, so nothing renders.
  function makePreviewBtn(a, i) {
    if (assetsLocked) return '<button onclick="requestAssetViaConnect()" style="display:inline-flex;align-items:center;gap:0.4rem;font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;border:1px solid rgba(201,168,76,0.5);background:rgba(201,168,76,0.08);color:var(--gold);padding:0.45rem 0.9rem;transition:all 0.2s;white-space:nowrap" onmouseover="this.style.background=\'rgba(201,168,76,0.18)\'" onmouseout="this.style.background=\'rgba(201,168,76,0.08)\'">👁 Preview</button>';
    if (a.url) return '<a href="'+a.url+'" target="_blank" style="display:inline-flex;align-items:center;gap:0.4rem;font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;border:1px solid rgba(201,168,76,0.5);background:rgba(201,168,76,0.08);color:var(--gold);padding:0.45rem 0.9rem;transition:all 0.2s;text-decoration:none;white-space:nowrap" onmouseover="this.style.background=\'rgba(201,168,76,0.18)\'" onmouseout="this.style.background=\'rgba(201,168,76,0.08)\'">👁 Preview</a>';
    return '';
  }

  function makeAccessBtn(a, i) {
    if (assetsLocked) return '<button onclick="requestAssetViaConnect()" style="display:inline-flex;align-items:center;gap:0.4rem;font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;border:1px solid rgba(201,168,76,0.35);background:none;color:var(--white);padding:0.45rem 0.9rem;transition:all 0.2s;white-space:nowrap" onmouseover="this.style.borderColor=\'rgba(201,168,76,0.8)\'" onmouseout="this.style.borderColor=\'rgba(201,168,76,0.35)\'">🔒 Request Access</button>';
    if (a.url) return '<a href="'+a.url+'" target="_blank" onclick="trackAssetDownload('+i+')" style="display:inline-flex;align-items:center;gap:0.4rem;font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;border:1px solid rgba(201,168,76,0.5);background:var(--gold);color:var(--black);padding:0.45rem 0.9rem;transition:all 0.2s;text-decoration:none;white-space:nowrap">↓ Download</a>';
    return '';
  }

  // ── CARDS layout ────────────────────────────────────────────────────────────
  let assetsHTML = '';
  if (assetsLayout === 'cards') {
    assetsHTML = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:rgba(201,168,76,0.1)">';
    visibleAssets.forEach(function(a, i) {
      const svg = getAssetSVG(a);
      const cat = getCatColor(a.category);
      const sub = getAssetSubtitle(a);
      const year = getAssetYear(a);
      const isFeat = a.featured || i === 0;
      assetsHTML += '<div style="background:#0E0E0E;padding:1.75rem 1.5rem;display:flex;flex-direction:column;gap:0;position:relative;transition:background 0.2s;min-height:280px" onmouseover="this.style.background=\'#141414\'" onmouseout="this.style.background=\'#0E0E0E\'">'
        + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1.25rem">'
        + (isFeat ? '<span style="font-family:var(--font-mono);font-size:0.5rem;letter-spacing:0.1em;background:rgba(201,168,76,0.15);color:var(--gold);border:1px solid rgba(201,168,76,0.3);padding:0.15rem 0.5rem">⭐ FEATURED</span>' : '<span style="font-family:var(--font-mono);font-size:0.5rem;letter-spacing:0.1em;background:rgba(255,255,255,0.04);color:var(--gray);border:1px solid rgba(255,255,255,0.08);padding:0.15rem 0.5rem">🔒 PRIVATE</span>')
        + (a.verified ? '<span style="font-family:var(--font-mono);font-size:0.5rem;letter-spacing:0.08em;background:rgba(126,201,126,0.1);color:#7ec97e;border:1px solid rgba(126,201,126,0.25);padding:0.15rem 0.5rem">✓ VERIFIED</span>' : '')
        + '</div>'
        + '<div style="margin-bottom:1rem">' + svg + '</div>'
        + '<div style="font-family:var(--font-mono);font-size:0.5rem;letter-spacing:0.15em;text-transform:uppercase;padding:0.2rem 0.75rem;display:inline-block;margin-bottom:0.75rem;background:'+cat.bg+';color:'+cat.color+';border:1px solid '+cat.border+'">' + (a.category||'') + '</div>'
        + '<div style="font-family:var(--font-display);font-size:1.1rem;color:var(--white);line-height:1.3;margin-bottom:0.4rem">' + a.title + '</div>'
        + (sub ? '<div style="font-family:var(--font-mono);font-size:0.55rem;color:var(--gray);line-height:1.5;margin-bottom:1rem">' + sub + (year ? ' • ' + year : '') + '</div>' : '<div style="margin-bottom:1rem"></div>')
        + '<div style="display:flex;gap:0.5rem;margin-top:auto;padding-top:1rem">' + makePreviewBtn(a,i) + makeAccessBtn(a,i) + '</div>'
        + (year ? '<div style="font-family:var(--font-mono);font-size:0.5rem;color:var(--gray);opacity:0.6">📅 Issued: ' + year + '</div>' : '')
        + (isFeat ? '<div style="position:absolute;left:0;top:0;bottom:0;width:2px;background:var(--gold)"></div>' : '')
        + '</div>';
    });
    assetsHTML += '</div>';

  // ── LIST layout ──────────────────────────────────────────────────────────────
  } else if (assetsLayout === 'list') {
    assetsHTML = '<table style="width:100%;border-collapse:collapse">'
      + '<thead><tr style="border-bottom:1px solid rgba(201,168,76,0.2)">'
      + '<th style="text-align:left;padding:0.75rem 1rem;font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.15em;color:var(--gray);font-weight:400">DOCUMENT</th>'
      + '<th style="text-align:left;padding:0.75rem 1rem;font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.15em;color:var(--gray);font-weight:400">CATEGORY</th>'
      + '<th style="text-align:left;padding:0.75rem 1rem;font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.15em;color:var(--gray);font-weight:400">DETAILS</th>'
      + '<th style="text-align:left;padding:0.75rem 1rem;font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.15em;color:var(--gray);font-weight:400">LAST UPDATED</th>'
      + '<th style="text-align:right;padding:0.75rem 1rem;font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.15em;color:var(--gray);font-weight:400">ACCESS</th>'
      + '</tr></thead><tbody>';
    visibleAssets.forEach(function(a, i) {
      const svg = getAssetSVG(a);
      const cat = getCatColor(a.category);
      const sub = getAssetSubtitle(a);
      const year = getAssetYear(a);
      const details = getAssetDetails(a);
      const isFeat = a.featured || i === 0;
      assetsHTML += '<tr style="border-bottom:1px solid rgba(255,255,255,0.04);transition:background 0.2s;position:relative" onmouseover="this.style.background=\'rgba(201,168,76,0.03)\'" onmouseout="this.style.background=\'\'\'">'
        + '<td style="padding:1rem 1rem">'
        + '<div style="display:flex;align-items:center;gap:0.85rem">'
        + '<div style="flex-shrink:0;width:44px;height:44px;background:rgba(201,168,76,0.06);border:1px solid rgba(201,168,76,0.15);display:flex;align-items:center;justify-content:center">' + svg.replace('width="32" height="32"','width="22" height="22"') + '</div>'
        + '<div>'
        + '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.2rem">'
        + '<span style="font-family:var(--font-display);font-size:0.95rem;color:var(--white)">' + a.title + '</span>'
        + (isFeat ? '<span style="font-family:var(--font-mono);font-size:0.45rem;background:rgba(201,168,76,0.12);color:var(--gold);border:1px solid rgba(201,168,76,0.3);padding:0.1rem 0.4rem">⭐ FEATURED</span>' : '')
        + '</div>'
        + (sub ? '<div style="font-family:var(--font-mono);font-size:0.52rem;color:var(--gray)">' + sub + '</div>' : '')
        + '</div></div></td>'
        + '<td style="padding:1rem 1rem;vertical-align:middle">'
        + '<div><span style="font-family:var(--font-mono);font-size:0.52rem;letter-spacing:0.08em;padding:0.2rem 0.6rem;background:'+cat.bg+';color:'+cat.color+';border:1px solid '+cat.border+'">' + (a.category||'—') + '</span>'
        + '<div style="font-family:var(--font-mono);font-size:0.5rem;color:var(--gray);margin-top:0.35rem">🔒 Private</div></div>'
        + '</td>'
        + '<td style="padding:1rem 1rem;font-family:var(--font-mono);font-size:0.58rem;color:rgba(187,187,187,0.8);vertical-align:middle;line-height:1.6">' + details + '</td>'
        + '<td style="padding:1rem 1rem;font-family:var(--font-mono);font-size:0.6rem;color:var(--gray);vertical-align:middle">' + (year || '—') + '</td>'
        + '<td style="padding:1rem 1rem;vertical-align:middle;text-align:right">'
        + '<div style="display:flex;gap:0.4rem;justify-content:flex-end">' + makePreviewBtn(a,i) + makeAccessBtn(a,i) + '</div></td>'
        + '</tr>';
    });
    assetsHTML += '</tbody></table>'
      + '<div style="display:flex;align-items:center;justify-content:space-between;padding:0.85rem 1rem;border-top:1px solid rgba(255,255,255,0.05)">'
      + '<div style="font-family:var(--font-mono);font-size:0.55rem;color:var(--gray)">Showing 1 to ' + visibleAssets.length + ' of ' + visibleAssets.length + ' assets</div>'
      + '<div style="display:flex;align-items:center;gap:0.5rem"><span style="font-family:var(--font-mono);font-size:0.55rem;color:var(--gray)">Rows per page: 10</span></div>'
      + '</div>';

  // ── COMPACT layout ───────────────────────────────────────────────────────────
  } else if (assetsLayout === 'compact') {
    assetsHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:0.75rem">';
    visibleAssets.forEach(function(a, i) {
      const svg = getAssetSVG(a);
      const cat = getCatColor(a.category);
      const sub = getAssetSubtitle(a);
      const year = getAssetYear(a);
      assetsHTML += '<div style="background:rgba(255,255,255,0.02);border:1px solid rgba(201,168,76,0.1);padding:1.4rem 1.1rem;display:flex;flex-direction:column;align-items:center;text-align:center;gap:0.4rem;transition:border-color 0.2s,background 0.2s" onmouseover="this.style.borderColor=\'rgba(201,168,76,0.4)\';this.style.background=\'rgba(201,168,76,0.03)\'" onmouseout="this.style.borderColor=\'rgba(201,168,76,0.1)\';this.style.background=\'rgba(255,255,255,0.02)\'">'
        + '<div style="margin-bottom:0.5rem">' + svg.replace('width="32" height="32"','width="28" height="28"') + '</div>'
        + '<span style="font-family:var(--font-mono);font-size:0.48rem;letter-spacing:0.12em;padding:0.15rem 0.45rem;background:'+cat.bg+';color:'+cat.color+';border:1px solid '+cat.border+'">' + (a.category||'') + '</span>'
        + '<div style="font-family:var(--font-display);font-size:0.9rem;color:var(--white);line-height:1.3">' + a.title + '</div>'
        + (sub ? '<div style="font-family:var(--font-mono);font-size:0.5rem;color:var(--gray);line-height:1.4">' + sub.replace(a.category+' • ','') + (year?' • '+year:'') + '</div>' : '')
        + '<div style="margin-top:0.5rem;width:100%">' + makeAccessBtn(a,i) + '</div>'
        + '</div>';
    });
    assetsHTML += '</div>';

  // ── TABLE layout ─────────────────────────────────────────────────────────────
  } else {
    assetsHTML = '<table style="width:100%;border-collapse:collapse">'
      + '<thead><tr style="border-bottom:2px solid rgba(201,168,76,0.25)">'
      + '<th style="text-align:left;padding:0.85rem 1rem;font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.15em;color:var(--gold);font-weight:400;width:35%">DOCUMENT ↕</th>'
      + '<th style="text-align:left;padding:0.85rem 1rem;font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.15em;color:var(--gold);font-weight:400;width:16%">CATEGORY ↕</th>'
      + '<th style="text-align:left;padding:0.85rem 1rem;font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.15em;color:var(--gold);font-weight:400">DESCRIPTION</th>'
      + '<th style="text-align:left;padding:0.85rem 1rem;font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.15em;color:var(--gold);font-weight:400;width:120px">LAST UPDATED ↕</th>'
      + '<th style="text-align:right;padding:0.85rem 1rem;font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.15em;color:var(--gold);font-weight:400;width:220px">ACCESS</th>'
      + '</tr></thead><tbody>';
    visibleAssets.forEach(function(a, i) {
      const svg = getAssetSVG(a);
      const cat = getCatColor(a.category);
      const sub = getAssetSubtitle(a);
      const year = getAssetYear(a);
      const details = getAssetDetails(a);
      const isFeat = a.featured || i === 0;
      assetsHTML += '<tr style="border-bottom:1px solid rgba(255,255,255,0.04);transition:background 0.2s" onmouseover="this.style.background=\'rgba(201,168,76,0.04)\'" onmouseout="this.style.background=\'\'\'">'
        + '<td style="padding:0.9rem 1rem;' + (isFeat?'border-left:2px solid var(--gold);':'' ) + '">'
        + '<div style="display:flex;align-items:center;gap:0.75rem">'
        + '<div style="flex-shrink:0;width:40px;height:40px;background:rgba(201,168,76,0.06);border:1px solid rgba(201,168,76,0.15);display:flex;align-items:center;justify-content:center">' + svg.replace('width="32" height="32"','width="20" height="20"') + '</div>'
        + '<div><div style="font-family:var(--font-display);font-size:1rem;color:var(--white);display:flex;align-items:center;gap:0.4rem">' + a.title
        + (isFeat ? ' <span style="font-family:var(--font-mono);font-size:0.45rem;background:rgba(201,168,76,0.12);color:var(--gold);border:1px solid rgba(201,168,76,0.3);padding:0.1rem 0.35rem">⭐ Featured</span>' : '')
        + '</div>'
        + (sub ? '<div style="font-family:var(--font-mono);font-size:0.52rem;color:var(--gray);margin-top:0.2rem">' + sub + '</div>' : '')
        + '</div></div></td>'
        + '<td style="padding:0.9rem 1rem;vertical-align:middle"><div><span style="font-family:var(--font-mono);font-size:0.52rem;letter-spacing:0.06em;padding:0.2rem 0.55rem;background:'+cat.bg+';color:'+cat.color+';border:1px solid '+cat.border+'">' + (a.category||'—') + '</span>'
        + '<div style="font-family:var(--font-mono);font-size:0.48rem;color:var(--gray);margin-top:0.3rem">🔒 Private</div></div></td>'
        + '<td style="padding:0.9rem 1rem;font-family:var(--font-mono);font-size:0.6rem;color:rgba(187,187,187,0.85);vertical-align:middle;line-height:1.6">' + details + '</td>'
        + '<td style="padding:0.9rem 1rem;font-family:var(--font-mono);font-size:0.6rem;color:var(--gray);vertical-align:middle">' + (year||'—') + '</td>'
        + '<td style="padding:0.9rem 1rem;vertical-align:middle;text-align:right">'
        + '<div style="display:flex;gap:0.4rem;justify-content:flex-end">' + makePreviewBtn(a,i) + makeAccessBtn(a,i) + '</div></td>'
        + '</tr>';
    });
    assetsHTML += '</tbody></table>'
      + '<div style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem 1rem;border-top:1px solid rgba(255,255,255,0.05)">'
      + '<div style="font-family:var(--font-mono);font-size:0.52rem;color:var(--gray)">Showing 1 to '+visibleAssets.length+' of '+visibleAssets.length+' assets</div>'
      + '<div style="display:flex;align-items:center;gap:0.5rem"><span style="font-family:var(--font-mono);font-size:0.52rem;color:var(--gray)">Rows per page: 10</span></div>'
      + '</div>';
  }

    const bookingEmail = epk.bookingEmail || '';
  const bookingPhone = epk.bookingPhone || '';
  const bookingTagline = epk.bookingTagline || 'Now booking live performances, studio sessions, and creative collaborations.';
  const bookingNote = epk.bookingNote || '';
  const bookingAvailability = epk.bookingAvailability || '';
  const bookingRegion = epk.bookingRegion || '';
  const bookingCategories = epk.bookingCategories || [];
  const availabilityLabels = { available:'✅ Available for Bookings', limited:'⚡ Limited Availability', touring:'🎤 Currently on Tour', selective:'🎯 Selective Projects Only', unavailable:'❌ Not Currently Available' };
  const categoryLabels = { live:'Live Performances', studio:'Studio Sessions', features:'Features / Collabs', touring:'Touring', hosting:'Hosting / MC', ar:'A&R Consulting', creative:'Creative Direction', media:'Media / Press', marketing:'Marketing / PR', professional:'Professional', government:'Government', entrepreneur:'Entrepreneur', technical:'Technical', administration:'Administration', crm:'CRM', sales:'Sales', personalassistant:'Personal Assistant', executiveassistant:'Executive Assistant', virtualassistant:'Virtual Assistant', arcoordinator:'A&R Coordinator', artistmanager:'Artist Manager', tourcoordinator:'Tour Coordinator', productioncoordinator:'Production Coordinator', marketingcoordinator:'Marketing Coordinator', socialmediamanager:'Social Media Manager', brandpartnerships:'Brand Partnerships', compliancespecialist:'Compliance Specialist', governmentliaison:'Government Liaison', adminsupport:'Administrative Support', projectcoordinator:'Project Coordinator', translator:'Bilingual Translator / Interpreter', customersuccess:'Customer Success Rep', talentscout:'Talent Scout', consultant:'Consultant', jobhunter:'Job Hunter / Open to Work', armedforces:'Armed Forces', other:'Other' };
  const availBadge = bookingAvailability ? `<div style="display:inline-block;font-family:var(--font-mono);font-size:0.6rem;letter-spacing:0.12em;background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.2);color:var(--gold);padding:0.4rem 1rem;margin-bottom:1.5rem">${availabilityLabels[bookingAvailability]||''}</div>` : '';
  const regionBadge = bookingRegion ? `<div style="font-family:var(--font-mono);font-size:0.55rem;color:var(--gray);letter-spacing:0.1em;margin-bottom:1rem">📍 ${bookingRegion}</div>` : '';
  const catBadges = bookingCategories.length ? `<div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-bottom:2rem">${bookingCategories.map(c => `<span style="font-family:var(--font-mono);font-size:0.5rem;letter-spacing:0.1em;text-transform:uppercase;border:1px solid rgba(201,168,76,0.2);color:var(--gray);padding:0.25rem 0.6rem">${categoryLabels[c]||c}</span>`).join('')}</div>` : '';
  // Inquiry type dropdown options — built from the categories the client actually selected.
  // Falls back to a generic list only if they haven't picked any (so the form never ships empty).
  // "Other" is always appended (unless already present) so visitors can specify a role that isn't listed.
  const inquiryTypeOptions = bookingCategories.length
    ? bookingCategories.map(c => categoryLabels[c] || c)
    : ['General Inquiry', 'Collaboration', 'Professional'];
  if (!inquiryTypeOptions.some(l => l.toLowerCase() === 'other')) inquiryTypeOptions.push('Other');
  const inquiryTypeOptionsHTML = inquiryTypeOptions.map(label => `<option value="${label}">${label}</option>`).join('');

  document.getElementById('epkContent').innerHTML = `
    <!-- HERO v3 — 2-col editorial -->
    <div class="hero">
      <div class="hero-image-panel">${heroImgHTML}</div>
      <div class="hero-content">

        <h1 class="hero-name">${firstName} <em>${lastName}</em></h1>

        <div class="hero-roles-row">
          <div class="hero-role-item">
            <svg viewBox="0 0 24 24" class="hero-role-icon"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
            <span>International<br>Vocalist</span>
          </div>
          <div class="hero-role-item">
            <svg viewBox="0 0 24 24" class="hero-role-icon"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
            <span>Recording<br>Artist</span>
          </div>
          <div class="hero-role-item">
            <svg viewBox="0 0 24 24" class="hero-role-icon"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
            <span>A&amp;R<br>Coordinator</span>
          </div>
          <div class="hero-role-item">
            <svg viewBox="0 0 24 24" class="hero-role-icon"><path d="M18 11v2h4v-2h-4zm-2 6.61c.96.71 2.21 1.65 3.2 2.39.4-.53.8-1.07 1.2-1.6-.99-.74-2.24-1.68-3.2-2.4-.4.54-.8 1.08-1.2 1.61zM20.4 5.6c-.4-.53-.8-1.07-1.2-1.6-.99.74-2.24 1.68-3.2 2.4.4.53.8 1.07 1.2 1.6.96-.72 2.21-1.66 3.2-2.4zM4 9c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h1v4h2v-4h1l5 3V6L8 9H4zm11.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
            <span>Marketing<br>Professional</span>
          </div>
          <div class="hero-role-item">
            <svg viewBox="0 0 24 24" class="hero-role-icon"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
            <span>Founder &amp;<br>Builder</span>
          </div>
        </div>

        <div class="hero-stats-row">
          ${(epk.stats||[]).filter(s=>s.number).length ?
            (epk.stats||[]).filter(s=>s.number).map(s=>`<div class="hero-stat-item"><span class="hero-stat-n">${s.number}</span><span class="hero-stat-l">${s.label}</span></div>`).join('') :
            `<div class="hero-stat-item"><span class="hero-stat-n">25+</span><span class="hero-stat-l">Years Active</span></div>
             <div class="hero-stat-item"><span class="hero-stat-n">500+</span><span class="hero-stat-l">Live Shows</span></div>
             <div class="hero-stat-item"><span class="hero-stat-n">5</span><span class="hero-stat-l">Continents</span></div>
             <div class="hero-stat-item hero-stat-item--gold"><span class="hero-stat-n">Multiple</span><span class="hero-stat-l">Genres &amp; Industries</span></div>`
          }
        </div>

        <div class="hero-presence-bar" onclick="const c=document.getElementById('connect');if(!c)return;const open=c.style.display==='block';c.style.display=open?'none':'block';this.querySelector('.hero-presence-explore').textContent=open?'Explore →':'Close ←';if(!open){setTimeout(()=>{const top=c.getBoundingClientRect().top+window.scrollY-80;window.scrollTo({top,behavior:'smooth'});},50);}" style="cursor:pointer">
          <p class="hero-presence-eyebrow">
              <svg viewBox="0 0 24 24" style="fill:var(--gold);width:12px;height:12px"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
              Connect
            </p>
          <h3 class="hero-presence-title">My Digital Presence &nbsp;<span class="hero-presence-explore">Explore →</span></h3>
          <span class="hero-presence-meta">Social Platforms • Music • Video • Recommendations • ${bookingLabel}</span>
          <div class="hero-presence-dots">
            <span class="hero-presence-dot" style="background:#E1306C"></span>
            <span class="hero-presence-dot" style="background:#1DB954"></span>
            <span class="hero-presence-dot" style="background:#FF0000"></span>
            <span class="hero-presence-dot" style="background:#0A66C2"></span>
            <span class="hero-presence-dot" style="background:#C9A84C"></span>
          </div>
          <div class="hero-presence-icons">
            ${(()=>{
              const s = epk.socials||{};
              const platforms = [
                {k:'instagram',color:'#E1306C',path:'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z'},
                {k:'youtube',color:'#FF0000',path:'M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z'},
                {k:'spotify',color:'#1DB954',path:'M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z'},
                {k:'appleMusic',color:'#FC3C44',path:'M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.076-.525c-.378-.127-.76-.2-1.147-.232-.238-.018-.48-.026-.72-.026H5.37c-.24 0-.482.008-.72.026-.387.032-.77.105-1.147.232a5.022 5.022 0 00-1.076.525C1.308 1.624.563 2.624.246 3.934A9.23 9.23 0 00.006 6.124C-.005 6.4 0 6.678 0 6.956v10.088c0 .278-.005.556.006.832.03.732.15 1.46.42 2.153.386 1.01 1.05 1.802 1.97 2.356a5.4 5.4 0 001.574.62c.44.098.886.148 1.336.162.287.008.576.012.864.012h13.66c.288 0 .577-.004.864-.012.45-.014.896-.064 1.336-.163a5.4 5.4 0 001.573-.619c.92-.554 1.584-1.346 1.97-2.356.27-.692.39-1.42.42-2.153.011-.276.006-.554.006-.832V6.956c0-.278.005-.556-.006-.832zm-7.27 8.526a.93.93 0 01-.415.79.894.894 0 01-.501.147.928.928 0 01-.443-.11L9.1 12.74v4.613a.933.933 0 01-.933.934.933.933 0 01-.933-.934V6.647a.933.933 0 01.597-.87.928.928 0 011.006.201l6.554 4.04V6.647a.933.933 0 01.933-.934.933.933 0 01.933.934v8.003z'},
                {k:'soundcloud',color:'#FF5500',path:'M1.175 12.225c-.015 0-.03.002-.044.003C.5 12.28 0 12.84 0 13.516c0 .682.504 1.235 1.124 1.235.02 0 .038-.002.057-.003h.05c.02 0 .038.003.058.003h16.754c.62 0 1.123-.553 1.123-1.235 0-.642-.45-1.17-1.03-1.233a2.95 2.95 0 00.03-.396c0-1.66-1.396-3.005-3.12-3.005-.23 0-.455.026-.67.074C13.74 7.48 12.174 6.5 10.38 6.5c-2.537 0-4.595 1.988-4.595 4.442 0 .08.003.158.008.236-.013-.001-.026-.002-.04-.002-1.326 0-2.4 1.048-2.4 2.342 0 .25.042.49.117.716H1.175z'},
              ];
              const hasValue = (v) => Array.isArray(v) ? v.some(Boolean) : !!v;
              const getUrl = (v) => Array.isArray(v) ? (v.find(Boolean)||'') : (v||'');
              return platforms.filter(p => hasValue(s[p.k])).map(p =>
                `<a href="${getUrl(s[p.k])}" target="_blank" rel="noopener" class="hero-presence-icon" style="--hpi-c:${p.color}" title="${p.k}">
                  <svg viewBox="0 0 24 24" style="fill:${p.color};width:16px;height:16px"><path d="${p.path}"/></svg>
                </a>`
              ).join('') || platforms.map(p =>
                `<a href="#connect" class="hero-presence-icon" style="--hpi-c:${p.color}">
                  <svg viewBox="0 0 24 24" style="fill:${p.color};width:16px;height:16px"><path d="${p.path}"/></svg>
                </a>`
              ).join('');
            })()}
          </div>
        </div>

        <div class="hero-bio">
          <p>With more than 25 years in the music industry, Leslie A. Guerra bridges the stage, the studio, and the business side of entertainment.</p>
          <p>Her career spans live performance, recording, artist development, operations, marketing, and digital portfolio innovation across multiple industries and continents.</p>
          <p>Explore her verified credits, projects, performances, and professional journey below.</p>
        </div>

      </div>
    </div>

    <!-- CONNECT PANEL -->
    <div id="connect" style="display:none">${connectSectionHTML}</div>

    <!-- CAREER HIGHLIGHTS -->
    <section class="career-profile-section" id="bio">
      <div class="ch3-wrap">
        <!-- CAREER PROFILE / BIOGRAPHY — previously built as careerProfileHTML
             but never inserted anywhere (dead code); now rendered here as the
             lead content of the always-visible #bio section, ahead of the
             Career Record Highlights cards. No collapsible wrapper — this
             section requires no click-to-expand interaction. -->
        ${careerProfileHTML}
        <div class="ch3-header">
          <span class="ch3-label" id="ch3Eyebrow">Career Profile</span>
          <div class="ch3-title-row">
            <h2 class="section-title" id="ch3Heading" style="margin:0">Career Record Highlights</h2>
          </div>
        </div>
        <div class="ch3-grid">
          ${getActiveCareerHighlights(epk).map(renderCh3Card).join('')}
        </div>

        <div style="text-align:center;margin-top:2rem">
          <p id="viewCompleteRecordCaption" style="font-family:var(--font-display);font-size:1.05rem;font-style:italic;color:rgba(245,243,238,0.65);margin-bottom:1.1rem;letter-spacing:0.01em">Every credit, role, and collaboration in one place — sortable by category, with full details behind each entry.</p>
          <a href="#credits" onclick="filterCreditsByCategory('')" id="viewCompleteRecordBtn" class="ch3-viewcomplete">View Complete Record →</a>
        </div>

        <!-- THE RECORD — hidden by default, revealed on demand -->
        ${epk.credits?.length ? `
        <div id="credits" style="display:none;margin-top:3rem;padding-top:2.5rem;border-top:1px solid rgba(201,168,76,0.15)">
          <!-- PROFESSIONAL RESUME — first item revealed inside the expandable Credits
               container. buildResumeCard() markup, styling, and the resumeEnabled
               gating are unchanged from before - only the insertion point moved,
               from a standalone visible block above "View Complete Record" to here,
               so it now inherits the same hidden-until-expanded show/hide behavior
               as the Credits cards (toggled by filterCreditsByCategory). -->
          ${(epk.resumeEnabled !== false && resumeCards.length) ? `
          <div class="ch3-header" style="margin-top:5rem;padding-top:2.5rem;border-top:1px solid rgba(201,168,76,0.1)">
            <span class="ch3-label">Professional Profile</span>
            <div class="ch3-title-row">
              <h2 class="section-title" style="margin:0">Professional Documents</h2>
            </div>
          </div>
          <div class="career-stacked-cards">
            ${resumeCards.map(buildResumeCard).join('')}
          </div>` : ''}
          <div id="creditsFilterBanner" style="display:none;font-family:var(--font-mono);font-size:0.65rem;letter-spacing:0.08em;color:var(--gray-light);margin-bottom:1rem"></div>
          <div class="credits-grid" id="creditsGrid">${creditsHTML}</div>
          ${visibleCredits.length > 4 ? `
          <div style="text-align:center;margin-top:1rem">
            <button onclick="toggleAllCredits()" id="creditsToggleBtn" style="font-family:var(--font-mono);font-size:0.6rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--gold);background:none;border:1px solid rgba(201,168,76,0.3);padding:0.6rem 1.5rem;cursor:pointer;transition:all 0.2s">View All ${visibleCredits.length} Credits +</button>
          </div>` : ''}
        </div>` : ''}
      </div>
    </section>
    <div class="divider"></div>

    <!-- CREATIVE WORKS -->
    ${(epk.works || []).filter(w => w.visible !== false).length ? `
    <section class="works-section" id="works">
      <div class="works-wrap">
        <div class="works-header">
          <span class="works-label" id="worksEyebrow">Creative Works</span>
          <div class="works-title-row">
            <h2 class="section-title" id="worksHeading" style="margin:0">Original Works</h2>
          </div>
          <p class="works-tagline" id="worksTagline">Some stories couldn't stay on the page. They became music.</p>
        </div>
        <div class="works-grid">
          ${(epk.works || [])
            .filter(w => w.visible !== false)
            .sort((a, b) => (a.sortOrder||0) - (b.sortOrder||0))
            .map((w, wi) => {
              const status = getWorkStatus(w);
              const statusLabel = status === 'Unreleased' ? 'First Listen' : status;
              const audioAsset = (w.assets || []).find(a => a.type === 'audio' && a.role === 'release') || (w.assets || []).find(a => a.type === 'audio');
              const genre = w.music?.genre || '';
              const duration = w.music?.duration || (audioAsset ? null : null);
              const durationLabel = duration ? `${Math.floor(duration/60)}:${String(duration%60).padStart(2,'0')}` : '';
              const playerId = `workPlayer_${w.id || wi}`;
              return `
              <div class="work-card" data-category="${w.category || 'music'}">
                <div class="work-card-cover">
                  <img src="${w.heroImage}" alt="${w.title}" loading="lazy">
                </div>
                <div class="work-card-body">
                  <div class="work-card-meta">${genre}${genre && durationLabel ? ' · ' : ''}${durationLabel}</div>
                  <div class="work-card-status">${statusLabel}</div>
                  <h3 class="work-card-title">${w.title}</h3>
                  <p class="work-card-desc">${w.description || ''}</p>
                  ${audioAsset ? buildWorkAudioPlayer(playerId, audioAsset.url) : ''}
                  <div class="work-card-cta-row">
                    <a class="work-card-cta" href="/archive/${encodeURIComponent(epk.slug || '')}/${encodeURIComponent(w.id || '')}">Enter the Story <span class="work-card-cta-arrow">→</span></a>
                  </div>
                </div>
              </div>`;
            }).join('')}
        </div>
      </div>
    </section>
    <div class="divider"></div>` : ''}

    <!-- PHOTOS — moved before music for claim→proof sequence — Credits=Claim, Photos=Proof -->
    ${epk.photos?.length ? `
    <div class="gallery-section" id="photos">
      <div class="gallery-inner">
        <div class="section-label" id="galleryEyebrow">Photos</div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:1rem;margin-bottom:0.5rem">
          <div id="galleryTitleBlock">
            <h2 class="section-title" data-editable data-editable-key="photosTitle" data-editable-type="title" style="outline:none;margin-bottom:0.25rem">On Stage & Behind the Scenes</h2>
            <p style="font-family:var(--font-body);font-size:0.9rem;color:var(--gray);margin:0 0 1rem">Explore moments from performances, studio sessions, press events, and more.</p>
          </div>
          <!-- PUBLIC LAYOUT SELECTOR — INTENTIONALLY HIDDEN (Sprint 1, June 24 2026)
               Dashboard is the single source of truth for photo layout.
               The layout set in Dashboard is saved to Supabase and rendered here on load.
               This selector is preserved (not deleted) for potential future use as an
               Owner Preview tool. Do not remove this block. Re-enable by changing display:none to display:flex. -->
          <div style="display:none;gap:0.75rem;align-items:center;flex-shrink:0">
            <div style="position:relative">
              <select id="galleryLayoutSelect" onchange="setGalleryLayout(this.value)" style="appearance:none;-webkit-appearance:none;background:var(--dark-3);border:1px solid rgba(201,168,76,0.3);color:var(--text);font-family:var(--font-mono);font-size:0.6rem;letter-spacing:0.1em;text-transform:uppercase;padding:0.5rem 2rem 0.5rem 0.85rem;cursor:pointer;outline:none">
                <option value="marquee">▶ Auto Scroll</option>
                <option value="scroll">⟷ Manual Scroll</option>
                <option value="wall">▦ Wall</option>
                <option value="collections">⬛ Collections</option>
                <option value="grid">⊞ Grid</option>
                <option value="magazine">◧ Magazine</option>
                <option value="timeline">⏱ Timeline</option>
                <option value="table">☰ Table</option>
              </select>
              <span style="position:absolute;right:0.6rem;top:50%;transform:translateY(-50%);color:var(--gold);pointer-events:none;font-size:0.6rem">▾</span>
            </div>
          </div>
        </div>
        <div id="galleryCategoryBar"></div>
        <div id="galleryContent"></div>
      </div>
    </div>` : ''}

    <!-- VIDEOS -->
    ${visibleVideos.length ? `
    <section id="videos">
      <div class="video-shell">
        <div class="section-label">Video</div>
        <div class="video-shell-header">
          <div>
            <h2 class="section-title" data-editable data-editable-key="videoTitle" data-editable-type="title" style="outline:none;margin-bottom:0.4rem">Live & On Camera</h2>
            <p class="video-shell-subtitle">Selected performances, live appearances, acoustic sessions, and more.</p>
          </div>
          ${visibleVideos.length > 3 ? `<button onclick="toggleAllVideos()" id="videoToggleBtn" aria-expanded="false" aria-controls="videosAll" class="video-toggle-btn">View All Videos +</button>` : ''}
        </div>
        <div id="videosFeatured">${visibleVideos.length <= 3 ? videosHTML : `<div class="videos-grid">${visibleVideos.slice(0,3).map((v,i) => buildVideoCard(v,i,false)).join("")}</div>`}</div>
        ${visibleVideos.length > 3 ? `<div id="videosAll" style="display:none">${videosHTML}</div>` : ''}
      </div>
    </section>
    <div class="divider"></div>` : ''}

    <!-- MUSIC -->
    ${epk.tracks?.length ? `
    <div class="collapsible-section" id="music">
      <div class="collapsible-header" onclick="toggleSection('musicBody', this)">
        <div class="collapsible-header-left">
          <div class="collapsible-icon">♪</div>
          <div>
            <div class="collapsible-header-label">Music</div>
            <div class="collapsible-header-title">Live Tracks & Recordings</div>
            <div class="collapsible-header-meta">${epk.tracks.length} track${epk.tracks.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <div class="collapsible-toggle"><span class="toggle-label">Expand</span> ＋</div>
      </div>
      <div class="collapsible-body" id="musicBody">
        <div class="collapsible-body-inner" style="max-width:1100px;margin:0 auto;padding:0 2rem 3rem">
          <div class="music-tracks">${tracksHTML}</div>
        </div>
      </div>
    </div>` : ''}

    <!-- AWARDS -->
    ${(epk.awards || []).length ? `
    <div class="collapsible-section" id="awards">
      <div class="collapsible-header" onclick="toggleSection('awardsBody', this)">
        <div class="collapsible-header-left">
          <div class="collapsible-icon" style="border-color:rgba(123,155,175,0.35);color:#8FB8D0;background:rgba(123,155,175,0.06)">✦</div>
          <div>
            <div class="collapsible-header-label" style="color:#8FB8D0">Recognition</div>
            <div class="collapsible-header-title">Awards, Degrees & Credentials</div>
            <div class="collapsible-header-meta">${(epk.awards||[]).length} entr${(epk.awards||[]).length !== 1 ? 'ies' : 'y'} · ${(epk.awards||[]).filter(a=>a.verified).length} verified</div>
          </div>
        </div>
        <div class="collapsible-toggle" style="color:#8FB8D0"><span class="toggle-label">Expand</span> ＋</div>
      </div>
      <div class="collapsible-body" id="awardsBody">
        <div class="collapsible-body-inner awards-inner">
          <div class="awards-grid">
            ${(epk.awards || []).map((a, idx) => {
              const icons = { award:'🏆', nomination:'🎯', degree:'🎓', certification:'📜', recognition:'⭐', honor:'🏅' };
              const typeLabels = { award:'Award', nomination:'Nomination', degree:'Education', certification:'Certification', recognition:'Recognition', honor:'Honor' };
              const icon = icons[a.type] || '🏆';
              const typeLabel = typeLabels[a.type] || 'Award';
              const hasDetails = a.desc || a.proofLink || a.certUrl || (a.photos||[]).length;
              const isMusicAward = ['award','nomination'].includes(a.type);
              const awColor = isMusicAward ? 'var(--gold)' : '#8FB8D0';
              return `<div class="award-card ${hasDetails ? 'award-card-clickable' : ''}" ${hasDetails ? `onclick="openAwardModal(${idx})"` : ''} style="border-top:2px solid ${awColor}">
                <span class="award-card-icon">${icon}</span>
                <div class="award-card-type" style="color:${awColor}">${typeLabel} ${a.year ? '· ' + a.year : ''}</div>
                <div class="award-card-badges">
                  ${a.verified ? `<span class="award-badge award-badge-verified" style="background:${awColor}1A;color:${awColor};border-color:${awColor}33">✓ Verified</span>` : ''}
                  ${a.category ? `<span class="award-badge award-badge-category">${a.category}</span>` : ''}
                </div>
                <div class="award-card-title">${a.title}</div>
                ${a.org ? `<div class="award-card-org">${a.org}</div>` : ''}
                ${hasDetails ? `<div style="font-family:var(--font-mono);font-size:0.5rem;letter-spacing:0.12em;text-transform:uppercase;color:${awColor};margin-top:0.75rem;opacity:0.7">View Details →</div>` : ''}
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>
    </div>` : ''}

    <!-- ASSETS -->
    ${epk.assets?.filter(a => a.visible !== false && a.category !== 'Resume').length ? `
    <div class="collapsible-section" id="assets">
      <div class="collapsible-header" onclick="toggleSection('assetsBody', this)">
        <div class="collapsible-header-left">
          <div class="collapsible-icon">⬡</div>
          <div>
            <div class="collapsible-header-label">Professional Assets</div>
            <div class="collapsible-header-title">Resources & Downloads</div>
            <div class="collapsible-header-meta">${epk.assets.filter(a=>a.visible!==false && a.category!=='Resume').length} available</div>
          </div>
        </div>
        <div class="collapsible-toggle"><span class="toggle-label">Expand</span> ＋</div>
      </div>
      <div class="collapsible-body" id="assetsBody">
        <div class="collapsible-body-inner" style="max-width:1100px;margin:0 auto;padding:0 2rem 3rem">
          <div style="width:100%">${assetsHTML}</div>
        </div>
      </div>
    </div>` : ''}


    <!-- BOOKING/INQUIRY (now rendered as a modal, triggered from the Connect card) -->
    <div id="booking" style="display:none"></div>
  `;

  // Build the inquiry form HTML and store it for the modal (openInquiryModal)
  window._inquiryFormHTML = (epk.bookingEnabled !== false) ? `
    <div class="section-label">Connect</div>
    <h2 class="booking-title">${bookingLabel}</h2>
    <p class="booking-sub">${bookingTagline}</p>
    ${availBadge}
    ${regionBadge}
    ${catBadges}
    ${bookingNote ? `<p class="booking-note">${bookingNote}</p>` : ''}
    <form name="booking-inquiry" method="POST" data-netlify="true" netlify-honeypot="bot-field"
      onsubmit="handleBookingSubmit(event)"
      style="max-width:560px;margin-top:2rem">
      <input type="hidden" name="form-name" value="booking-inquiry">
      <input type="hidden" name="recipient" value="${bookingEmail}">
      <p style="display:none"><input name="bot-field"></p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem">
        <div>
          <label style="font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gray);display:block;margin-bottom:0.4rem">Your Name</label>
          <input type="text" name="name" required placeholder="Full Name"
            style="width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(201,168,76,0.2);color:var(--white);padding:0.75rem;font-family:var(--font-body);font-size:0.9rem;outline:none;box-sizing:border-box"
            onfocus="this.style.borderColor='rgba(201,168,76,0.5)'" onblur="this.style.borderColor='rgba(201,168,76,0.2)'">
        </div>
        <div>
          <label style="font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gray);display:block;margin-bottom:0.4rem">Your Email</label>
          <input type="email" name="email" required placeholder="email@example.com"
            style="width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(201,168,76,0.2);color:var(--white);padding:0.75rem;font-family:var(--font-body);font-size:0.9rem;outline:none;box-sizing:border-box"
            onfocus="this.style.borderColor='rgba(201,168,76,0.5)'" onblur="this.style.borderColor='rgba(201,168,76,0.2)'">
        </div>
      </div>
      <div style="margin-bottom:1rem">
        <label style="font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gray);display:block;margin-bottom:0.4rem">Inquiry Type</label>
        <select name="booking-type" id="inquiryTypeSelect"
          onchange="document.getElementById('inquiryTypeOtherWrap').style.display = this.value === 'Other' ? 'block' : 'none'; document.getElementById('inquiryTypeOther').required = this.value === 'Other';"
          style="width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(201,168,76,0.2);color:var(--white);padding:0.75rem;font-family:var(--font-body);font-size:0.9rem;outline:none;appearance:none">
          <option value="">— Select Type —</option>
          ${inquiryTypeOptionsHTML}
        </select>
      </div>
      <div id="inquiryTypeOtherWrap" style="display:none;margin-bottom:1rem">
        <label style="font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gray);display:block;margin-bottom:0.4rem">Please Specify</label>
        <input type="text" name="booking-type-other" id="inquiryTypeOther" placeholder="e.g. Personal Assistant, Coordinator, Website Administrator"
          style="width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(201,168,76,0.2);color:var(--white);padding:0.75rem;font-family:var(--font-body);font-size:0.9rem;outline:none;box-sizing:border-box"
          onfocus="this.style.borderColor='rgba(201,168,76,0.5)'" onblur="this.style.borderColor='rgba(201,168,76,0.2)'">
      </div>
      <div style="margin-bottom:1.5rem">
        <label style="font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gray);display:block;margin-bottom:0.4rem">Message</label>
        <textarea name="message" required rows="4" placeholder="Tell me about your project, event date, and any other details..."
          style="width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(201,168,76,0.2);color:var(--white);padding:0.75rem;font-family:var(--font-body);font-size:0.9rem;outline:none;resize:vertical;box-sizing:border-box"
          onfocus="this.style.borderColor='rgba(201,168,76,0.5)'" onblur="this.style.borderColor='rgba(201,168,76,0.2)'"></textarea>
      </div>
      <button type="submit"
        style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px;min-height:50px;background:#d7b84f;color:#050505;border:none;font-family:var(--font-mono);font-size:0.7rem;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;cursor:pointer;transition:opacity 0.18s"
        onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">✉ Send Inquiry</button>
      <div id="bookingSuccess" style="display:none;margin-top:1rem;font-family:var(--font-mono);font-size:0.65rem;letter-spacing:0.12em;color:var(--gold);text-align:center;padding:1rem;border:1px solid rgba(201,168,76,0.2)">
        ✓ Your inquiry has been sent. We'll be in touch soon.
      </div>
    </form>
    ${bookingPhone ? `<p style="font-family:var(--font-mono);font-size:0.6rem;color:var(--gray);margin-top:1.5rem">Prefer to call? <a href="tel:${bookingPhone}" style="color:var(--gold)">${bookingPhone}</a></p>` : ''}
  ` : '';

  // Apply section order and visibility from epk data
  applySectionOrderAndVisibility(epk);
  document.querySelectorAll('.work-player').forEach(wrap => workPlayerWire(wrap));

  // Build photo gallery if photos exist
  if (epk.photos?.length) buildGallery(epk.photos);

  // ── TEMPORARY OWNER-ONLY DEBUG PANEL ──────────────────────────────────
  // Production incident diagnosis only - reads the REAL, final, post-render
  // DOM and live epk object, gated strictly on window._isOwner (the same
  // existing flag that shows the Edit button). Public visitors never see
  // this. Remove once the Assets lock issue is confirmed resolved from a
  // real owner-session screenshot.
  if (window._isOwner) {
    try { renderAssetsDebugPanel(epk); } catch(e) {
      console.error('Debug panel failed:', e);
    }
  }
  initVideoCarousels();
}

function renderAssetsDebugPanel(epk) {
  const existing = document.getElementById('__assetsDebugPanel');
  if (existing) existing.remove();

  const scriptEl = document.querySelector('script[src*="epk.js"]');
  const scriptSrc = scriptEl ? scriptEl.getAttribute('src') : 'NOT FOUND';

  const assetsList = (epk.assets || []).filter(a => a.visible !== false && a.category !== 'Resume');
  const first = assetsList[0];

  // Find the FIRST asset's actually-rendered Preview and access elements in
  // the real DOM, inside the real #assetsBody container - not reconstructed
  // from logic, read directly from what the browser actually has on screen.
  const assetsBody = document.getElementById('assetsBody');
  let firstPreviewInfo = 'no #assetsBody found';
  let firstAccessInfo = 'no #assetsBody found';
  if (assetsBody) {
    const clickable = assetsBody.querySelectorAll('button, a');
    const previewEl = Array.from(clickable).find(el => el.textContent.includes('Preview') || el.textContent.includes('PREVIEW'));
    const accessEl = Array.from(clickable).find(el =>
      (el.textContent.includes('Request Access') || el.textContent.includes('REQUEST ACCESS') || el.textContent.includes('Download') || el.textContent.includes('DOWNLOAD'))
    );
    if (previewEl) {
      const tag = previewEl.tagName;
      const onclick = previewEl.getAttribute('onclick');
      const href = previewEl.getAttribute('href');
      firstPreviewInfo = tag === 'A' && href
        ? 'ANCHOR opening URL: ' + href
        : 'BUTTON calling: ' + (onclick || '(no onclick found)');
    } else {
      firstPreviewInfo = 'NO preview element found in #assetsBody';
    }
    if (accessEl) {
      const tag = accessEl.tagName;
      const onclick = accessEl.getAttribute('onclick');
      const href = accessEl.getAttribute('href');
      const label = accessEl.textContent.trim();
      firstAccessInfo = tag === 'A' && href
        ? 'DOWNLOAD LINK (anchor) to: ' + href + ' | label: "' + label + '"'
        : 'REQUEST ACCESS BUTTON calling: ' + (onclick || '(no onclick found)') + ' | label: "' + label + '"';
    } else {
      firstAccessInfo = 'NO access/download element found in #assetsBody';
    }
  }

  const assetUrlRows = assetsList.map((a, i) =>
    '<div>[' + i + '] "' + (a.title || '(untitled)') + '" — url: ' + (a.url ? 'PRESENT (' + a.url.slice(0, 60) + '...)' : 'MISSING') + '</div>'
  ).join('');

  const panel = document.createElement('div');
  panel.id = '__assetsDebugPanel';
  panel.style.cssText = 'position:relative;max-width:1100px;margin:0 auto 1rem;border:2px solid #ff4444;font-family:monospace;font-size:11px;color:#ffcccc;line-height:1.6';

  const header = document.createElement('div');
  header.style.cssText = 'padding:0.6rem 1rem;background:#1a0000;cursor:pointer;display:flex;align-items:center;justify-content:space-between;user-select:none';
  header.innerHTML = '<span style="color:#ff6666;font-weight:bold;font-size:12px">⚠ DEBUG PANEL (collapsed) — click to expand — owner view only</span><span id="__debugPanelArrow" style="color:#ff6666">▸</span>';

  const body = document.createElement('div');
  body.id = '__assetsDebugPanelBody';
  body.style.cssText = 'display:none;padding:1.25rem 1.5rem;background:#1a0000;border-top:1px solid #662222;white-space:pre-wrap;word-break:break-all';
  body.innerHTML =
    '<div><b>1. epk.js script src (loaded by THIS browser, right now):</b> ' + scriptSrc + '</div>' +
    '<div><b>   Diagnostic loaded at:</b> ' + new Date().toISOString() + '</div>' +
    '<div style="margin-top:0.5rem"><b>2. epk.assetsLocked (as read by this page render):</b> ' + JSON.stringify(epk.assetsLocked) + ' (type: ' + typeof epk.assetsLocked + ')</div>' +
    '<div style="margin-top:0.5rem"><b>3. Asset URLs (epk.assets, filtered same as live render):</b>' + (assetUrlRows || ' (no assets found)') + '</div>' +
    '<div style="margin-top:0.5rem"><b>4. First asset — Preview element, AS ACTUALLY RENDERED in #assetsBody:</b><br>' + firstPreviewInfo + '</div>' +
    '<div style="margin-top:0.5rem"><b>5. First asset — Access/Download element, AS ACTUALLY RENDERED in #assetsBody:</b><br>' + firstAccessInfo + '</div>' +
    '<div style="margin-top:0.5rem"><b>6. Page load timestamp:</b> ' + (window.performance && performance.timing ? new Date(performance.timing.navigationStart).toISOString() : 'unavailable') + '</div>' +
    '<div style="margin-top:0.5rem"><b>7. Data source:</b> fetched live via POST /api/epk on this page load (no embedded/static JSON is used in production) — epk.lastUpdated field: ' + (epk.lastUpdated || '(not set)') + '</div>';

  header.onclick = function() {
    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : 'block';
    document.getElementById('__debugPanelArrow').textContent = isOpen ? '▸' : '▾';
    header.querySelector('span').textContent = isOpen
      ? '⚠ DEBUG PANEL (collapsed) — click to expand — owner view only'
      : '⚠ DEBUG PANEL (expanded) — click to collapse — owner view only';
  };

  panel.appendChild(header);
  panel.appendChild(body);

  const assetsBodyEl = document.getElementById('assetsBody');
  if (assetsBodyEl && assetsBodyEl.parentElement) {
    assetsBodyEl.parentElement.insertBefore(panel, assetsBodyEl);
  } else {
    document.body.insertBefore(panel, document.body.firstChild);
  }
}

let currentGalleryLayout = 'marquee'; // overridden by epk.galleryLayout
let galleryPhotos = [];

// GALLERY_SCROLL_SPEED — controls Auto Scroll (marquee) animation duration in seconds.
// Lower = faster, higher = slower/more premium feel.
// Future Dashboard controls (Slow/Medium/Fast) should write to epk.galleryScrollSpeed
// and call setGalleryScrollSpeed() to update this value at runtime without a full rebuild.
// Slow ≈ 100s | Medium ≈ 75s | Fast ≈ 45s
const GALLERY_SCROLL_SPEED_DEFAULT = 80; // seconds

function setGalleryLayout(layout) {
  // NOTE: setGalleryLayout() is intentionally preserved for future use as an Owner Preview tool.
  // The public layout selector is hidden (Sprint 1, June 24 2026).
  // Dashboard is the single source of truth — layout is saved to Supabase and rendered on load.
  currentGalleryLayout = layout;
  // Sync the dropdown (hidden but functional — ready for owner-preview re-enable)
  const sel = document.getElementById('galleryLayoutSelect');
  if (sel) sel.value = layout;
  buildGallery(galleryPhotos);
}

function buildMarqueeGallery(photos, container) {
  const wrap = document.createElement('div');
  wrap.className = 'gallery-marquee-wrap';
  const track = document.createElement('div');
  track.className = 'gallery-marquee';
  // Apply scroll speed from epk data (if set by Dashboard) or fall back to default constant.
  // Future Dashboard controls write to epk.galleryScrollSpeed — no CSS rewrite needed.
  const speed = (window._epkData && window._epkData.galleryScrollSpeed) ? window._epkData.galleryScrollSpeed : GALLERY_SCROLL_SPEED_DEFAULT;
  track.style.setProperty('--marquee-speed', speed + 's');
  // Double the photos for seamless infinite loop
  const allPhotos = [...photos, ...photos];
  allPhotos.forEach(photo => {
    const pos = photo.position || 'center 0%';
    const item = document.createElement('div');
    item.className = 'gallery-marquee-item';
    const img = document.createElement('img');
    img.src = photo.url;
    img.alt = photo.caption || '';
    img.loading = 'lazy';
    img.style.objectPosition = pos;
    img.onerror = function() { this.style.display = 'none'; };
    img.onload = function() {
      const ratio = this.naturalWidth / this.naturalHeight;
      if (ratio > 1.1) {
        const newWidth = Math.min(Math.round(380 * ratio), 700);
        item.style.width = newWidth + 'px';
        img.style.objectFit = 'contain';
        img.style.background = '#0E0E0E';
      }
    };
    const caption = document.createElement('div');
    caption.className = 'gallery-marquee-caption';
    caption.textContent = photo.caption || '';
    item.appendChild(img);
    item.appendChild(caption);
    const photoIdx = photos.indexOf(photo) % (photos.length / 2);
    const ownerDiv = document.createElement('div');
    ownerDiv.className = 'owner-overlay';
    ownerDiv.innerHTML = `<button class="owner-action-btn owner-up" onclick="event.stopPropagation();ownerMoveItem('photos',${photoIdx},-1)">▲</button><button class="owner-action-btn owner-down" onclick="event.stopPropagation();ownerMoveItem('photos',${photoIdx},1)">▼</button>`;
    item.appendChild(ownerDiv);
    item.onclick = () => openLightbox(photo.url);
    track.appendChild(item);
  });
  wrap.appendChild(track);
  container.appendChild(wrap);
}

function buildWallGallery(photos, container) {
  if (!photos.length) return;

  const outer = document.createElement('div');
  outer.className = 'ew-outer';

  // ── SIDEBAR ──
  const sidebar = document.createElement('div');
  sidebar.className = 'ew-sidebar';

  const sidebarTop = document.createElement('div');
  sidebarTop.className = 'ew-sidebar-section-label';
  sidebarTop.textContent = 'PHOTO WALL';
  sidebar.appendChild(sidebarTop);

  const collections = [...new Set(photos.map(p => p.collection).filter(Boolean))];
  let activeFilter = 'all';

  const topItems = [
    { label: 'All Photos', count: photos.length, filter: 'all', icon: '⊞' },
    { label: 'Featured', count: photos.filter(p => p.featured).length, filter: 'featured', icon: '★' },
    { label: 'Recent', count: photos.filter(p => p.year && p.year >= 2020).length, filter: 'recent', icon: '◷' },
    { label: 'Favorites', count: 0, filter: 'favorites', icon: '♡' },
  ];

  topItems.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'ew-sidebar-btn' + (item.filter === 'all' ? ' active' : '');
    btn.dataset.filter = item.filter;
    btn.innerHTML = `<span class="ew-sidebar-icon">${item.icon}</span><span class="ew-sidebar-label">${item.label}</span>${item.count ? `<span class="ew-sidebar-count">${item.count}</span>` : ''}`;
    btn.onclick = () => handleFilter(item.filter);
    sidebar.appendChild(btn);
  });

  const colLabel = document.createElement('div');
  colLabel.className = 'ew-sidebar-section-label';
  colLabel.style.marginTop = '1rem';
  colLabel.textContent = 'COLLECTIONS';
  sidebar.appendChild(colLabel);

  const collectionList = collections.length ? collections : ['Live Performances','Backstage','Awards & Events','Studio Sessions','Personal Moments','Press & Publications','Tour Life'];
  collectionList.forEach(col => {
    const count = photos.filter(p => p.collection === col).length;
    const btn = document.createElement('button');
    btn.className = 'ew-sidebar-btn';
    btn.dataset.filter = col;
    btn.innerHTML = `<span class="ew-sidebar-icon">📁</span><span class="ew-sidebar-label">${col}</span>${count ? `<span class="ew-sidebar-count">${count}</span>` : ''}`;
    btn.onclick = () => handleFilter(col);
    sidebar.appendChild(btn);
  });

  // Quote card
  const quoteCard = document.createElement('div');
  quoteCard.className = 'ew-quote-card';
  quoteCard.innerHTML = `<div class="ew-quote-mark">"</div><div class="ew-quote-text">Every moment has a story. This is mine.</div><div class="ew-quote-sig">— LESLIE A. GUERRA</div>`;
  sidebar.appendChild(quoteCard);

  // Add Photos button
  const addBtn = document.createElement('button');
  addBtn.className = 'ew-add-btn';
  addBtn.innerHTML = '+ ADD PHOTOS';
  addBtn.onclick = () => { window.location.href = '/dashboard.html#photos'; };
  sidebar.appendChild(addBtn);

  outer.appendChild(sidebar);

  // ── MAIN AREA ──
  const main = document.createElement('div');
  main.className = 'ew-main';
  renderWallMain(main, photos);
  outer.appendChild(main);
  container.appendChild(outer);

  function handleFilter(filter) {
    activeFilter = filter;
    outer.querySelectorAll('.ew-sidebar-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === filter));
    main.innerHTML = '';
    renderWallMain(main, filterPhotos(photos, filter));
  }

  function filterPhotos(photos, filter) {
    if (filter === 'all') return photos;
    if (filter === 'featured') return photos.filter(p => p.featured);
    if (filter === 'recent') return photos.filter(p => p.year && p.year >= 2020);
    return photos.filter(p => p.collection === filter);
  }

  function makeCard(photo, extraClass, alwaysVisible) {
    const card = document.createElement('div');
    card.className = `ew-card ${extraClass}`;
    const metaParts = [photo.location, photo.year ? String(photo.year) : ''].filter(Boolean);
    card.innerHTML = `
      <img src="${photo.url}" alt="${(photo.caption||'').replace(/"/g,"'")}" loading="lazy" onerror="this.style.display='none'" style="object-position:center top">
      <div class="ew-card-overlay${alwaysVisible ? ' always' : ''}">
        ${photo.collection ? `<div class="ew-overlay-category">${photo.collection.toUpperCase()}</div>` : ''}
        ${photo.caption ? `<div class="ew-overlay-title">${photo.caption}</div>` : ''}
        ${metaParts.length ? `<div class="ew-overlay-meta">${metaParts.join(' • ')}</div>` : ''}
        ${(photo.caption || metaParts.length) ? `<div class="ew-overlay-bar"></div>` : ''}
      </div>`;
    card.onclick = () => openLightbox(photo.url);
    return card;
  }

  function renderWallMain(main, filteredPhotos) {
    if (!filteredPhotos.length) {
      main.innerHTML = `<div class="ew-empty">No photos in this section yet.</div>`;
      return;
    }

    const hero = filteredPhotos[0];
    const sec1 = filteredPhotos[1];
    const sec2 = filteredPhotos[2];
    const mosaic = filteredPhotos.slice(3, 11);
    const strip = filteredPhotos.slice(11);

    // ── ROW 1: HERO + SECONDARY + CARDS ──
    const row1 = document.createElement('div');
    row1.className = 'ew-row1';

    // Hero
    const heroCard = document.createElement('div');
    heroCard.className = 'ew-card ew-hero-card';
    const heroMeta = [hero.location, hero.year].filter(Boolean).join(' • ');
    heroCard.innerHTML = `
      <img src="${hero.url}" alt="${(hero.caption||'').replace(/"/g,"'")}" loading="lazy" onerror="this.style.display='none'" style="object-position:center top">
      <div class="ew-card-overlay always">
        <div class="ew-overlay-category">FEATURED MOMENT</div>
        ${hero.caption ? `<div class="ew-overlay-title">${hero.caption}</div>` : ''}
        ${heroMeta ? `<div class="ew-overlay-meta">${heroMeta}</div>` : ''}
        <div class="ew-overlay-bar"></div>
      </div>`;
    heroCard.onclick = () => openLightbox(hero.url);
    row1.appendChild(heroCard);

    // Right column: sec1, quote, sec2, milestone
    const rightCol = document.createElement('div');
    rightCol.className = 'ew-right-col';

    if (sec1) rightCol.appendChild(makeCard(sec1, 'ew-sec-card', true));

    // Quote card in grid
    const qCard = document.createElement('div');
    qCard.className = 'ew-grid-quote';
    qCard.innerHTML = `<div class="ew-gq-mark">"</div><div class="ew-gq-text">Grateful for every stage, every lesson, and every person who believed in my journey.</div><div class="ew-gq-sig">— LESLIE A. GUERRA</div>`;
    rightCol.appendChild(qCard);

    if (sec2) rightCol.appendChild(makeCard(sec2, 'ew-sec-card', true));

    // Milestone card in grid
    const mCard = document.createElement('div');
    mCard.className = 'ew-grid-milestone';
    mCard.innerHTML = `<div class="ew-ms-icon">🏆</div><div class="ew-ms-label">MILESTONE</div><div class="ew-ms-title">20+ Years in Music</div><div class="ew-ms-sub">From local stages to international tours.</div>`;
    rightCol.appendChild(mCard);

    row1.appendChild(rightCol);
    main.appendChild(row1);

    // ── ROW 2: MOSAIC ──
    if (mosaic.length) {
      const row2 = document.createElement('div');
      row2.className = 'ew-mosaic';
      // Pattern repeats every 3: large(5)+medium(4)+small(3) = 12 cols exactly
      const sizePattern = ['large','medium','small'];
      mosaic.forEach((photo, i) => {
        row2.appendChild(makeCard(photo, `ew-mosaic-${sizePattern[i % 3]}`, true));
      });
      main.appendChild(row2);
    }

    // ── ROW 3: STRIP ──
    if (strip.length) {
      const row3 = document.createElement('div');
      row3.className = 'ew-strip';
      strip.forEach(photo => {
        const card = document.createElement('div');
        card.className = 'ew-strip-card';
        card.innerHTML = `<img src="${photo.url}" alt="${(photo.caption||'').replace(/"/g,"'")}" loading="lazy" onerror="this.style.display='none'" style="object-position:center top">`;
        card.onclick = () => openLightbox(photo.url);
        row3.appendChild(card);
      });
      main.appendChild(row3);
    }
  }
}

function buildScrollGallery(photos, container) {
  const wrap = document.createElement('div');
  wrap.className = 'gallery-scroll-wrap';

  // Header: drag to explore
  const header = document.createElement('div');
  header.className = 'gallery-scroll-header';
  header.innerHTML = `<span class="gallery-scroll-drag">← Drag to explore →</span>`;
  wrap.appendChild(header);

  const strip = document.createElement('div');
  strip.className = 'gallery-scroll';
  strip.id = 'galleryScroll';

  photos.forEach((photo, i) => {
    const pos = photo.position || 'center 0%';
    const item = document.createElement('div');
    item.className = 'gallery-scroll-item';
    item.innerHTML = `
      <img src="${photo.url}" alt="${photo.caption || ''}" loading="lazy" onerror="this.style.display='none'" style="object-position:${pos}">
      ${photo.featured ? `<div class="gallery-scroll-star">★</div>` : ''}
      <div class="gallery-scroll-overlay">
        ${photo.collection ? `<div class="gallery-scroll-category">${photo.collection.toUpperCase()}</div>` : ''}
        ${photo.caption ? `<div class="gallery-scroll-title">${photo.caption}</div>` : ''}
        ${[photo.location, photo.year ? String(photo.year) : ''].filter(Boolean).length ? `<div class="gallery-scroll-meta">${[photo.location, photo.year].filter(Boolean).join(', ')}</div>` : ''}
      </div>`;
    item.onclick = () => openLightbox(photo.url);
    strip.appendChild(item);
  });

  // Drag to scroll
  let isDown = false, startX, scrollLeft;
  strip.addEventListener('mousedown', e => { isDown = true; startX = e.pageX - strip.offsetLeft; scrollLeft = strip.scrollLeft; strip.style.cursor = 'grabbing'; });
  strip.addEventListener('mouseleave', () => { isDown = false; strip.style.cursor = 'grab'; });
  strip.addEventListener('mouseup', () => { isDown = false; strip.style.cursor = 'grab'; });
  strip.addEventListener('mousemove', e => { if (!isDown) return; e.preventDefault(); const x = e.pageX - strip.offsetLeft; strip.scrollLeft = scrollLeft - (x - startX) * 1.5; });

  wrap.appendChild(strip);

  // Bottom bar: arrows + counter
  const bottomBar = document.createElement('div');
  bottomBar.className = 'gallery-scroll-bottom';
  bottomBar.innerHTML = `
    <div class="gallery-scroll-arrows">
      <button class="gallery-scroll-arrow-btn" id="scrollPrev">&#8249;</button>
      <button class="gallery-scroll-arrow-btn" id="scrollNext">&#8250;</button>
    </div>
    <div class="gallery-scroll-counter" id="scrollCounter">01 / ${String(photos.length).padStart(2,'0')}</div>
    <div class="gallery-scroll-collection-label" id="scrollColLabel">${photos[0]?.collection || ''}</div>
    <div style="font-family:var(--font-mono);font-size:0.5rem;color:var(--gray);letter-spacing:0.1em;margin-left:auto">Scroll to explore all photos</div>`;
  wrap.appendChild(bottomBar);

  container.appendChild(wrap);

  // Wire up arrows after DOM insertion
  requestAnimationFrame(() => {
    const scrollEl = document.getElementById('galleryScroll');
    const prevBtn = document.getElementById('scrollPrev');
    const nextBtn = document.getElementById('scrollNext');
    const counter = document.getElementById('scrollCounter');
    const colLabel = document.getElementById('scrollColLabel');

    function updateCounter() {
      if (!scrollEl) return;
      const itemW = scrollEl.querySelector('.gallery-scroll-item')?.offsetWidth || 1;
      const idx = Math.round(scrollEl.scrollLeft / (itemW + 12));
      const photo = photos[Math.min(idx, photos.length - 1)];
      if (counter) counter.textContent = `${String(idx+1).padStart(2,'0')} / ${String(photos.length).padStart(2,'0')}`;
      if (colLabel && photo) colLabel.textContent = photo.collection || '';
    }

    if (prevBtn && scrollEl) prevBtn.onclick = () => { scrollEl.scrollBy({left:-scrollEl.offsetWidth*0.8,behavior:'smooth'}); setTimeout(updateCounter,400); };
    if (nextBtn && scrollEl) nextBtn.onclick = () => { scrollEl.scrollBy({left:scrollEl.offsetWidth*0.8,behavior:'smooth'}); setTimeout(updateCounter,400); };
    if (scrollEl) scrollEl.addEventListener('scroll', updateCounter);
  });
}

function buildCollectionsGallery(photos, container) {
  const collectionMeta = {
    'Live Performances': { icon: '🎤', desc: 'Concerts, tours, and live shows' },
    'Backstage': { icon: '🎭', desc: 'Behind the scenes moments' },
    'Studio Sessions': { icon: '🎙', desc: 'In the studio and recording' },
    'Press & Media': { icon: '📰', desc: 'Interviews, coverage, and media' },
    'Awards & Recognition': { icon: '🏆', desc: 'Awards, nominations, and honors' },
    'Personal Moments': { icon: '❤', desc: 'Personal and candid moments' },
  };

  const groups = {};
  photos.forEach(photo => {
    const col = photo.collection || 'All Photos';
    if (!groups[col]) groups[col] = [];
    groups[col].push(photo);
  });

  const wrap = document.createElement('div');
  wrap.className = 'gallery-collections';

  Object.entries(groups).forEach(([name, gphotos]) => {
    const card = document.createElement('div');
    card.className = 'gallery-collection-card';

    const collage = document.createElement('div');
    collage.className = 'gallery-collection-collage gallery-collection-collage-' + Math.min(gphotos.length, 4);
    gphotos.slice(0, 4).forEach(p => {
      const img = document.createElement('img');
      img.src = p.url;
      img.alt = p.caption || '';
      img.loading = 'lazy';
      img.style.objectPosition = p.position || 'center 0%';
      img.onerror = function() { this.style.display = 'none'; };
      collage.appendChild(img);
    });

    const meta = collectionMeta[name] || { icon: '📁', desc: '' };
    const infoDiv = document.createElement('div');
    infoDiv.className = 'gallery-collection-info';
    infoDiv.innerHTML = `
      <div class="gallery-collection-header">
        <span class="gallery-collection-icon">${meta.icon}</span>
        <span class="gallery-collection-name">${name}</span>
      </div>
      ${meta.desc ? `<div class="gallery-collection-desc">${meta.desc}</div>` : ''}
      <div class="gallery-collection-footer">
        <span class="gallery-collection-count">${gphotos.length} PHOTO${gphotos.length !== 1 ? 'S' : ''}</span>
        <span class="gallery-collection-cta">View Collection →</span>
      </div>`;

    card.appendChild(collage);
    card.appendChild(infoDiv);

    card.onclick = () => {
      const existing = document.getElementById('collectionLightbox');
      if (existing) existing.remove();
      const lb = document.createElement('div');
      lb.id = 'collectionLightbox';
      lb.className = 'gallery-collection-lightbox';
      lb.innerHTML = `
        <div class="gallery-collection-lb-inner">
          <button class="gallery-collection-lb-close" onclick="document.getElementById('collectionLightbox').remove()">✕</button>
          <div class="gallery-collection-lb-title">${meta.icon} ${name}</div>
          <div class="gallery-collection-lb-grid">
            ${gphotos.map(p => `<div class="gallery-collection-lb-item" onclick="openLightbox('${p.url}')">
              <img src="${p.url}" alt="${(p.caption||'').replace(/"/g,"'")}" loading="lazy" style="object-position:${(p.position && p.position !== 'center') ? p.position : 'center top'}" onerror="this.style.display='none'">
              ${p.caption ? `<div class="gallery-collection-lb-cap">${p.caption}</div>` : ''}
            </div>`).join('')}
          </div>
        </div>`;
      document.body.appendChild(lb);
      lb.addEventListener('click', e => { if (e.target === lb) lb.remove(); });
    };
    wrap.appendChild(card);
  });

  container.appendChild(wrap);

  // Footer tagline
  const footer = document.createElement('div');
  footer.className = 'gallery-collections-footer';
  footer.innerHTML = `<span style="font-size:1.5rem">📷</span><div><div style="font-family:var(--font-display);font-size:1rem;color:var(--text);font-weight:600">Your Story Through Images</div><div style="font-family:var(--font-body);font-size:0.85rem;color:var(--gray);margin-top:0.25rem">Each collection represents a chapter of the journey. Explore the moments that have shaped this career.</div></div>`;
  container.appendChild(footer);
}

function buildExhibitionGallery(photos, container) {
  // Discrete 5-slot fan installation on desktop/tablet; mobile keeps
  // its own unchanged, simpler vertical stack (all photos, native
  // touch scroll). These are genuinely different DOM structures now,
  // not one markup styled two ways -- chosen once at build time.
  if (!photos.length) return;
  const mobile = window.matchMedia('(max-width: 700px)').matches;
  if (mobile) {
    buildExhibitionMobile(photos, container);
  } else {
    buildExhibitionFan(photos, container);
  }
}

// ---- Mobile: unchanged vertical stack ----------------------------
// Extracted, not rewritten, from the previous single implementation's
// mobile behavior. Same markup, same motion math, same ~8deg max
// rotation as every prior Exhibition round -- this pass does not
// touch mobile at all.
function buildExhibitionMobile(photos, container) {
  const wrap = document.createElement('div');
  wrap.className = 'exhibition-wrap';

  photos.forEach((photo, i) => {
    const slide = document.createElement('div');
    slide.className = 'exhibition-slide';
    const pos = photo.position || 'center';
    const capHTML = photo.caption ? `<div class="exhibition-caption-title">${photo.caption}</div>` : '';
    const yearHTML = photo.year ? `<div class="exhibition-caption-year">${photo.year}</div>` : '';
    slide.innerHTML = `
      <div class="exhibition-frame-outer owner-item-wrap">
        <div class="owner-overlay" style="flex-direction:row;gap:0.2rem">
          <button class="owner-action-btn owner-up" onclick="event.stopPropagation();ownerMoveItem('photos',${i},-1)" title="Move earlier">◀</button>
          <button class="owner-action-btn owner-down" onclick="event.stopPropagation();ownerMoveItem('photos',${i},1)" title="Move later">▶</button>
        </div>
        <div class="exhibition-frame">
          <img src="${photo.url}" alt="${photo.caption || ''}" loading="lazy" style="object-position:${pos}" onerror="this.style.display='none'">
        </div>
      </div>
      ${(capHTML || yearHTML) ? `<div class="exhibition-caption">${capHTML}${yearHTML}</div>` : ''}
    `;
    const frameOuter = slide.querySelector('.exhibition-frame-outer');
    frameOuter.style.cursor = 'pointer';
    frameOuter.onclick = () => openLightbox(photo.url, photo);
    wrap.appendChild(slide);
  });

  const outer = document.createElement('div');
  outer.className = 'exhibition-outer';
  outer.appendChild(wrap);
  container.appendChild(outer);

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reducedMotion) initExhibitionMobileMotion(wrap);
}

function initExhibitionMobileMotion(wrap) {
  const frames = Array.from(wrap.querySelectorAll('.exhibition-frame-outer'));
  if (!frames.length) return;
  const maxRotate = 8;
  const active = new Set();
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) active.add(entry.target);
      else active.delete(entry.target);
    });
  }, { root: null, rootMargin: '50% 50% 50% 50%', threshold: 0 });
  frames.forEach(el => io.observe(el));

  let ticking = false;
  function update() {
    const centerY = window.innerHeight / 2;
    active.forEach(el => {
      const rect = el.getBoundingClientRect();
      const elCenter = rect.top + rect.height / 2;
      const dist = elCenter - centerY;
      const ratio = Math.max(-1, Math.min(1, dist / (window.innerHeight * 0.8)));
      const rotate = ratio * maxRotate;
      const scale = 1 - Math.abs(ratio) * 0.06;
      el.style.transform = `perspective(1400px) rotateY(${(-rotate).toFixed(2)}deg) scale(${scale.toFixed(3)})`;
    });
    ticking = false;
  }
  function onUpdate() {
    if (!ticking) { requestAnimationFrame(update); ticking = true; }
  }
  window.addEventListener('scroll', onUpdate, { passive: true });
  window.addEventListener('resize', onUpdate, { passive: true });
  update();
}

// ---- Desktop/tablet: fixed 5-slot fan installation ----------------
// Five target slot definitions -- outer-left, inner-left, hero,
// inner-right, outer-right. rotate/scale/liftY/z/capOpacity are the
// resting values for a photo sitting in that slot; xFrac is its
// horizontal offset as a fraction of the stage width, combined with
// each panel's own self-centering (left:50% + translateX(-50%)) so
// photos of any aspect ratio center correctly on their slot's anchor
// point. Rotation ceiling (not a fixed target) tuned to 17deg per
// approved feedback, within the requested 15-19deg range.
// Fixed art-directed slot windows, not natural-aspect-ratio scaling.
// Portrait and landscape source photos are cropped via object-fit:
// cover into the same shared silhouette height so the five pieces
// read as one composition rather than five independently-sized
// objects -- the full uncropped photo remains available in the
// lightbox on click. All dimensions/offsets are fractions of the
// measured stage width, so the composition (including overlap
// ratios) scales together at any viewport rather than only fitting
// one reference size.
//
// Overlap verified by construction, not eyeballed: hero right edge
// sits at 0.145 (half of 0.290 width); inner-right's left edge sits
// at 0.205 - 0.1075 = 0.0975 -- a 0.0475 overlap, which is 22% of
// inner's own 0.215 width (target 15-25%). Outer overlaps inner by
// ~19% of outer's own width using the same method. Hero is 0.290 /
// 0.215 = 1.35x an inner panel's width (target 30-40% wider).
// Triptych: LEFT SUPPORT -- HERO -- RIGHT SUPPORT. The hero adapts
// its own window proportions to whichever photo currently occupies
// it (a genuinely tall window for a portrait photo, a genuinely wide
// one for a landscape photo) rather than forcing every photo into
// one fixed shape. Support panels stay art-directed cover-crops --
// they're previews of what's next, not the featured piece.
const EXHIBITION_HERO_PORTRAIT = { widthFrac: 0.35, aspect: 0.72 };   // width/height
const EXHIBITION_HERO_LANDSCAPE = { widthFrac: 0.52, aspect: 1.65 };
const EXHIBITION_SUPPORT_WIDTH_FRAC = 0.22;
const EXHIBITION_SUPPORT_HEIGHT_RATIO = 0.73; // fraction of the hero's own height

function buildExhibitionFan(photos, container) {
  const N = photos.length;
  if (!N) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Clamp so a complete three-piece installation is always shown --
  // reaching the start/end of the library never leaves a missing
  // support panel. Wheel input attempting to advance past the clamp
  // passes through to page scroll, same as every previous round.
  const minCenter = N >= 3 ? 1 : 0;
  const maxCenter = N >= 3 ? N - 2 : N - 1;
  let centerIndex = Math.min(maxCenter, Math.max(minCenter, Math.floor((minCenter + maxCenter) / 2)));

  const outer = document.createElement('div');
  outer.className = 'exhibition-outer';

  // Pull the section's own eyebrow/title/subtitle INTO the room --
  // in the approved reference, the header lives inside the same dark
  // box as the photos, not above it on the plain page background.
  // These elements already exist in the page (rendered by the shared
  // section-header markup); moving them (not cloning) keeps
  // data-editable hooks and existing behavior intact.
  const eyebrow = document.getElementById('galleryEyebrow');
  const titleBlock = document.getElementById('galleryTitleBlock');
  if (eyebrow || titleBlock) {
    const headerWrap = document.createElement('div');
    headerWrap.className = 'exhibition-room-header';
    if (eyebrow) headerWrap.appendChild(eyebrow);
    if (titleBlock) headerWrap.appendChild(titleBlock);
    outer.appendChild(headerWrap);
  }

  const stage = document.createElement('div');
  stage.className = 'exhibition-stage';
  stage.setAttribute('tabindex', '0');
  stage.setAttribute('role', 'region');
  stage.setAttribute('aria-label', 'Photo exhibition installation, use arrow keys to advance');

  const prevBtn = document.createElement('button');
  prevBtn.className = 'exhibition-arrow exhibition-arrow-prev';
  prevBtn.setAttribute('aria-label', 'Previous photograph');
  prevBtn.innerHTML = '‹';
  const nextBtn = document.createElement('button');
  nextBtn.className = 'exhibition-arrow exhibition-arrow-next';
  nextBtn.setAttribute('aria-label', 'Next photograph');
  nextBtn.innerHTML = '›';

  outer.appendChild(prevBtn);
  outer.appendChild(stage);
  outer.appendChild(nextBtn);
  container.appendChild(outer);

  // Arrows align with the photo area specifically (stage's own
  // vertical center), not a fixed percentage of the whole outer box
  // -- correct regardless of how tall the header above it is.
  function positionArrows() {
    const stageMidpoint = stage.offsetTop + stage.offsetHeight / 2;
    prevBtn.style.top = `${stageMidpoint}px`;
    nextBtn.style.top = `${stageMidpoint}px`;
  }

  let panels = [];
  let transitioning = false;
  const orientationCache = new Map(); // photoIdx -> 'portrait' | 'landscape'
  const fitCache = new Map(); // photoIdx -> 'cover' | 'contain'

  // Orientation and crop-fit are both derived from the photo's real
  // natural dimensions once known (from the already-loaded <img> if
  // it was previously showing as a support, or via its own load
  // event the first time it appears at all) -- never guessed.
  function resolveHeroTreatment(photoIdx, imgEl, onReady) {
    if (orientationCache.has(photoIdx)) {
      onReady(orientationCache.get(photoIdx), fitCache.get(photoIdx));
      return;
    }
    function compute() {
      const w = imgEl.naturalWidth, h = imgEl.naturalHeight;
      const orientation = (w && h && h > w) ? 'portrait' : 'landscape';
      const win = orientation === 'portrait' ? EXHIBITION_HERO_PORTRAIT : EXHIBITION_HERO_LANDSCAPE;
      const imgAspect = (w && h) ? w / h : win.aspect;
      // cover crops minimally when the photo's own aspect is already
      // close to the hero window's aspect; contain preserves the full
      // photo when the mismatch is large enough that cover would cut
      // off a meaningful portion (a real panorama in a narrower
      // window, for example).
      const mismatch = Math.abs(imgAspect - win.aspect) / win.aspect;
      const fit = mismatch > 0.30 ? 'contain' : 'cover';
      orientationCache.set(photoIdx, orientation);
      fitCache.set(photoIdx, fit);
      onReady(orientation, fit);
    }
    if (imgEl.complete && imgEl.naturalWidth) compute();
    else imgEl.addEventListener('load', compute, { once: true });
  }

  function currentHeroOrientation() {
    return panels.find(p => p.slotPos === 0)?.heroOrientation || 'landscape';
  }

  function slotDefFor(panel) {
    // Height reference always comes from whichever panel currently
    // sits in the hero slot -- never from this panel's own history.
    // A support panel that was previously hero (before advancing
    // away) must not keep using its own stale orientation; all three
    // panels share one consistent height, tied to the current hero.
    const heroOrientation = currentHeroOrientation();
    const win = heroOrientation === 'portrait' ? EXHIBITION_HERO_PORTRAIT : EXHIBITION_HERO_LANDSCAPE;
    const heroHeightFrac = win.widthFrac / win.aspect;
    const supportHeightFrac = heroHeightFrac * EXHIBITION_SUPPORT_HEIGHT_RATIO;
    const heroHalf = win.widthFrac / 2;
    const overlap = EXHIBITION_SUPPORT_WIDTH_FRAC * 0.25;
    // Extra outward gap beyond the overlap term itself -- the overlap
    // amount (how much the support tucks behind the hero) stays the
    // same; this just gives the pair more breathing room from each
    // other so they don't crowd the hero.
    const outwardGap = 0.02;
    const supportOffset = heroHalf + overlap + outwardGap;

    if (panel.slotPos === 0) {
      // Hero steps toward the viewer: lifted higher and pushed
      // further forward in depth than before, reinforcing "standing
      // closer to you" rather than just "centered."
      return { widthFrac: win.widthFrac, heightFrac: heroHeightFrac, offsetFrac: 0, rotate: 0, z: 55, liftY: -24, capMode: 'full', isHero: true };
    }
    if (panel.slotPos === -1) {
      // Supports plant lower and recede further -- a real physical
      // step down and back, not just a smaller/dimmer copy sitting on
      // the same line as the hero.
      return { widthFrac: EXHIBITION_SUPPORT_WIDTH_FRAC, heightFrac: supportHeightFrac, offsetFrac: -supportOffset, rotate: 10, z: -32, liftY: 16, capMode: 'quiet' };
    }
    if (panel.slotPos === 1) {
      return { widthFrac: EXHIBITION_SUPPORT_WIDTH_FRAC, heightFrac: supportHeightFrac, offsetFrac: supportOffset, rotate: -10, z: -32, liftY: 16, capMode: 'quiet' };
    }
    // Entering/exiting just off-stage, extrapolated from the nearest
    // real support slot, pushed further out and transparent.
    const dir = panel.slotPos < -1 ? -1 : 1;
    return {
      widthFrac: EXHIBITION_SUPPORT_WIDTH_FRAC * 0.85, heightFrac: supportHeightFrac * 0.85,
      offsetFrac: dir * (supportOffset + EXHIBITION_SUPPORT_WIDTH_FRAC * 0.7),
      rotate: dir > 0 ? -16 : 16, z: -50, liftY: 12, capMode: 'hidden', offstage: true,
    };
  }

  function applyPanelStyle(panel) {
    const def = slotDefFor(panel);
    const stageWidth = stage.getBoundingClientRect().width;
    const xOffset = def.offsetFrac * stageWidth;
    const widthPx = def.widthFrac * stageWidth;
    const heightPx = def.heightFrac * stageWidth;
    const opacity = def.offstage ? '0' : '1';
    panel.frameOuter.style.width = `${widthPx.toFixed(1)}px`;
    panel.frameOuter.style.height = `${heightPx.toFixed(1)}px`;
    panel.frameOuter.style.transform = `translateX(calc(-50% + ${xOffset.toFixed(1)}px)) translateY(${def.liftY}px) perspective(1400px) rotateY(${def.rotate}deg) translateZ(${def.z}px)`;
    panel.frameOuter.style.opacity = opacity;
    panel.frameOuter.style.zIndex = String(def.isHero ? 20 : (10 - Math.abs(panel.slotPos)));
    panel.frameOuter.classList.toggle('exhibition-fan-hero', !!def.isHero);
    // Explicit pixel sizing for the backdrop, matching frame-outer's
    // own dimensions exactly -- CSS percentage/inset sizing was
    // resolving against the wrong containing block in this nested
    if (def.isHero && panel.fitMode) {
      panel.imgEl.style.objectFit = panel.fitMode;
      panel.frameOuter.classList.toggle('exhibition-frame-letterboxed', panel.fitMode === 'contain');
    } else {
      panel.frameOuter.classList.remove('exhibition-frame-letterboxed');
    }
    if (panel.capEl) {
      const hidden = def.offstage || def.capMode === 'hidden';
      const photoLeftEdge = xOffset - widthPx / 2;
      panel.capEl.style.top = `${(heightPx + 14).toFixed(1)}px`;
      panel.capEl.style.width = `${((def.isHero ? 0.28 : 0.19) * stageWidth).toFixed(1)}px`;
      panel.capEl.style.transform = `translateX(${photoLeftEdge.toFixed(1)}px) translateY(${def.liftY}px)`;
      panel.capEl.style.opacity = hidden ? '0' : (def.capMode === 'full' ? '1' : '0.55');
      panel.capEl.style.zIndex = String(def.isHero ? 20 : (10 - Math.abs(panel.slotPos)));
      panel.capEl.classList.toggle('exhibition-caption-quiet', def.capMode === 'quiet');
    }
    
  }

  function renderPhotoIntoPanel(panel, photoIdx, isHeroSlot) {
    const photo = photos[photoIdx];
    panel.photoIndex = photoIdx;
    panel.imgEl.src = photo.url;
    panel.imgEl.alt = photo.caption || '';
    panel.imgEl.style.objectPosition = photo.position || 'center';
    panel.imgEl.style.objectFit = 'cover';
    if (panel.capTitleEl) panel.capTitleEl.textContent = photo.caption || '';
    if (panel.capYearEl) panel.capYearEl.textContent = photo.year || '';
    panel.frameOuter.onclick = () => openLightbox(photo.url, photo);
    if (isHeroSlot) {
      resolveHeroTreatment(photoIdx, panel.imgEl, (orientation, fit) => {
        panel.heroOrientation = orientation;
        panel.fitMode = fit;
        applyPanelStyle(panel);
        updateStageHeight(); positionArrows();
      });
    }
  }

  function createPanel(slotPos, photoIdx) {
    const el = document.createElement('div');
    el.className = 'exhibition-fan-panel';
    el.innerHTML = `
      <div class="exhibition-frame-outer">
        <div class="exhibition-frame">
          <img class="exhibition-frame-main" loading="lazy" onerror="this.style.display='none'">
        </div>
      </div>
      <div class="exhibition-caption">
        <div class="exhibition-caption-title"></div>
        <div class="exhibition-caption-year"></div>
      </div>
    `;
    const frameOuter = el.querySelector('.exhibition-frame-outer');
    const capEl = el.querySelector('.exhibition-caption');
    const transitionCss = reducedMotion ? 'none' : 'transform 0.6s cubic-bezier(0.22,0.61,0.36,1), opacity 0.6s ease, width 0.6s cubic-bezier(0.22,0.61,0.36,1), height 0.6s cubic-bezier(0.22,0.61,0.36,1)';
    frameOuter.style.transition = transitionCss;
    capEl.style.transition = 'opacity 0.4s ease, transform 0.6s cubic-bezier(0.22,0.61,0.36,1)';
    const panel = {
      el, frameOuter,
      imgEl: el.querySelector('.exhibition-frame-main'),
      capEl,
      capTitleEl: el.querySelector('.exhibition-caption-title'),
      capYearEl: el.querySelector('.exhibition-caption-year'),
      slotPos, photoIndex: photoIdx,
      heroOrientation: 'landscape', fitMode: 'cover',
    };
    renderPhotoIntoPanel(panel, photoIdx, slotPos === 0);
    stage.appendChild(el);
    return panel;
  }

  function updateStageHeight() {
    const heroWin = currentHeroOrientation() === 'portrait' ? EXHIBITION_HERO_PORTRAIT : EXHIBITION_HERO_LANDSCAPE;
    const heroHeightFrac = heroWin.widthFrac / heroWin.aspect;
    const stageWidth = stage.getBoundingClientRect().width;
    const heightPx = heroHeightFrac * stageWidth;
    stage.style.height = `${(heightPx + 32 + 110).toFixed(1)}px`;
  }

  function renderInitial() {
    panels = [];
    for (let p = -1; p <= 1; p++) {
      const idx = centerIndex + p;
      if (idx < 0 || idx >= N) continue;
      panels.push(createPanel(p, idx));
    }
    requestAnimationFrame(() => { panels.forEach(applyPanelStyle); updateStageHeight(); positionArrows(); });
  }

  function advance(dir) {
    if (transitioning) return false;
    const newCenter = centerIndex + dir;
    if (newCenter < minCenter || newCenter > maxCenter) return false;
    transitioning = true;
    centerIndex = newCenter;

    panels.forEach(panel => { panel.slotPos -= dir; });
    // The panel moving INTO hero (slotPos becomes 0) needs its hero
    // treatment resolved fresh -- it was rendered as a support crop
    // until now.
    const becomingHero = panels.find(p => p.slotPos === 0);
    if (becomingHero) {
      resolveHeroTreatment(becomingHero.photoIndex, becomingHero.imgEl, (orientation, fit) => {
        becomingHero.heroOrientation = orientation;
        becomingHero.fitMode = fit;
        applyPanelStyle(becomingHero);
        updateStageHeight(); positionArrows();
      });
    }
    const leaving = panels.filter(p => Math.abs(p.slotPos) > 1);
    panels = panels.filter(p => Math.abs(p.slotPos) <= 1);

    const enterSlotPos = dir > 0 ? 1 : -1;
    const enterPhotoIdx = centerIndex + enterSlotPos;
    if (enterPhotoIdx >= 0 && enterPhotoIdx < N && !panels.find(p => p.slotPos === enterSlotPos)) {
      const startSlotPos = enterSlotPos + dir;
      const panel = createPanel(startSlotPos, enterPhotoIdx);
      panel.el.style.transition = 'none';
      panel.frameOuter.style.transition = 'none';
      panel.capEl.style.transition = 'none';
      applyPanelStyle(panel);
      void panel.el.offsetHeight;
      const transitionCss = reducedMotion ? 'none' : 'transform 0.6s cubic-bezier(0.22,0.61,0.36,1), opacity 0.6s ease, width 0.6s cubic-bezier(0.22,0.61,0.36,1), height 0.6s cubic-bezier(0.22,0.61,0.36,1)';
      panel.frameOuter.style.transition = transitionCss;
      panel.capEl.style.transition = 'opacity 0.4s ease, transform 0.6s cubic-bezier(0.22,0.61,0.36,1)';
      panel.slotPos = enterSlotPos;
      panels.push(panel);
    }

    requestAnimationFrame(() => { panels.forEach(applyPanelStyle); updateStageHeight(); positionArrows(); });
    setTimeout(() => {
      leaving.forEach(p => p.el.remove());
      transitioning = false;
    }, reducedMotion ? 0 : 650);
    return true;
  }

  renderInitial();

  prevBtn.onclick = () => advance(-1);
  nextBtn.onclick = () => advance(1);

  let wheelAccum = 0;
  const WHEEL_THRESHOLD = 60;
  stage.addEventListener('wheel', (e) => {
    if (window.matchMedia('(max-width: 700px)').matches) return;
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    const dir = e.deltaY > 0 ? 1 : -1;
    const wouldExceed = (centerIndex + dir < minCenter) || (centerIndex + dir > maxCenter);
    if (wouldExceed) return;
    e.preventDefault();
    if (transitioning) return;
    wheelAccum += e.deltaY;
    if (Math.abs(wheelAccum) >= WHEEL_THRESHOLD) {
      advance(wheelAccum > 0 ? 1 : -1);
      wheelAccum = 0;
    }
  }, { passive: false });

  stage.addEventListener('keydown', (e) => {
    if (window.matchMedia('(max-width: 700px)').matches) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); advance(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); advance(-1); }
  });

  window.addEventListener('resize', () => { panels.forEach(applyPanelStyle); updateStageHeight(); positionArrows(); }, { passive: true });
}


function buildGridGallery(photos, container) {
  // Editorial "Gallery" -- image-first, minimal text (caption + year
  // only). Reuses the same percentage-flexbox technique proven for
  // Video's Grid so a trailing incomplete row centers correctly at
  // every column-count tier, regardless of how many items are left
  // over. No pagination -- matches the "see everything quickly"
  // purpose; revisit only if a very large library proves this wrong.
  if (!photos.length) return;
  const grid = document.createElement('div');
  grid.className = 'photo-flat-grid';
  photos.forEach((photo, i) => {
    const item = document.createElement('div');
    item.className = 'pcard owner-item-wrap';
    const pos = photo.position || 'center';
    const capHTML = photo.caption ? `<div class="pcard-title">${photo.caption}</div>` : '';
    const yearHTML = photo.year ? `<div class="pcard-meta">${photo.year}</div>` : '';
    item.innerHTML = `
      <div class="owner-overlay" style="flex-direction:row;gap:0.2rem">
        <button class="owner-action-btn owner-up" onclick="event.stopPropagation();ownerMoveItem('photos',${i},-1)" title="Move Left">◀</button>
        <button class="owner-action-btn owner-down" onclick="event.stopPropagation();ownerMoveItem('photos',${i},1)" title="Move Right">▶</button>
      </div>
      <div class="pcard-media">
        <img src="${photo.url}" alt="${photo.caption || ''}" loading="lazy" style="object-position:${pos}" onerror="this.style.display='none'">
      </div>
      ${(capHTML || yearHTML) ? `<div class="pcard-body">${capHTML}${yearHTML}</div>` : ''}
    `;
    const media = item.querySelector('.pcard-media');
    media.style.cursor = 'pointer';
    media.onclick = () => openLightbox(photo.url, photo);
    grid.appendChild(item);
  });
  container.appendChild(grid);
}

function buildMagazineGallery(photos, container) {
  const wrap = document.createElement('div');
  wrap.className = 'gallery-magazine';
  if (!photos.length) { container.appendChild(wrap); return; }

  const featured = photos.find(p => p.featured) || photos[0];
  const rest = photos.filter(p => p !== featured);

  function makeOverlay(photo, cls) {
    const o = document.createElement('div');
    o.className = cls;
    const meta = [photo.location, photo.year ? String(photo.year) : ''].filter(Boolean).join(' · ');
    o.innerHTML = `
      ${photo.collection ? `<span class="gallery-magazine-badge">${photo.collection.toUpperCase()}</span>` : ''}
      ${photo.caption ? `<div class="gallery-magazine-item-caption">${photo.caption}</div>` : ''}
      ${meta ? `<div class="gallery-magazine-item-meta">${meta}</div>` : ''}`;
    return o;
  }

  // ── ROW 1: Hero left + 3 stacked right ──
  const row1 = document.createElement('div');
  row1.className = 'gallery-magazine-row1';

  const heroWrap = document.createElement('div');
  heroWrap.className = 'gallery-magazine-hero';
  const heroImg = document.createElement('img');
  heroImg.src = featured.url;
  heroImg.alt = featured.caption || '';
  heroImg.loading = 'lazy';
  heroImg.style.objectPosition = (featured.position && featured.position !== 'center') ? featured.position : 'center top';
  heroImg.onerror = function() { this.style.display = 'none'; };
  heroImg.onclick = () => openLightbox(featured.url);
  heroImg.style.cursor = 'pointer';
  const heroOverlay = makeOverlay(featured, 'gallery-magazine-hero-overlay');
  heroWrap.appendChild(heroImg);
  heroWrap.appendChild(heroOverlay);
  row1.appendChild(heroWrap);

  // Right column — up to 3 photos
  if (rest.length) {
    const rightCol = document.createElement('div');
    rightCol.className = 'gallery-magazine-right-col';
    rest.slice(0, 3).forEach(photo => {
      const item = document.createElement('div');
      item.className = 'gallery-magazine-item';
      item.style.cursor = 'pointer';
      const img = document.createElement('img');
      img.src = photo.url;
      img.alt = photo.caption || '';
      img.loading = 'lazy';
      img.style.objectPosition = (photo.position && photo.position !== 'center') ? photo.position : 'center top';
      img.onerror = function() { this.style.display = 'none'; };
      img.onclick = () => openLightbox(photo.url);
      item.appendChild(img);
      item.appendChild(makeOverlay(photo, 'gallery-magazine-item-overlay'));
      rightCol.appendChild(item);
    });
    row1.appendChild(rightCol);
  }
  wrap.appendChild(row1);

  // ── REMAINING: 4-col grid ──
  const remaining = rest.slice(3);
  if (remaining.length) {
    const grid = document.createElement('div');
    grid.className = 'gallery-magazine-grid';
    remaining.forEach(photo => {
      const item = document.createElement('div');
      item.className = 'gallery-magazine-item';
      item.style.cursor = 'pointer';
      const img = document.createElement('img');
      img.src = photo.url;
      img.alt = photo.caption || '';
      img.loading = 'lazy';
      img.style.objectPosition = (photo.position && photo.position !== 'center') ? photo.position : 'center top';
      img.onerror = function() { this.style.display = 'none'; };
      img.onclick = () => openLightbox(photo.url);
      item.appendChild(img);
      item.appendChild(makeOverlay(photo, 'gallery-magazine-item-overlay'));
      grid.appendChild(item);
    });
    wrap.appendChild(grid);
  }
  container.appendChild(wrap);
}

function buildTimelineGallery(photos, container) {
  const groups = {};
  photos.forEach(photo => {
    const yr = photo.year ? String(photo.year) : 'Undated';
    if (!groups[yr]) groups[yr] = [];
    groups[yr].push(photo);
  });
  const sorted = Object.keys(groups).sort((a, b) => {
    if (a === 'Undated') return 1;
    if (b === 'Undated') return -1;
    return Number(b) - Number(a);
  });
  const wrap = document.createElement('div');
  wrap.className = 'gallery-timeline';

  sorted.forEach((year, yi) => {
    const section = document.createElement('div');
    section.className = 'gallery-timeline-year';

    const header = document.createElement('div');
    header.className = 'gallery-timeline-year-header';
    const isFirst = yi === 0;
    header.innerHTML = `
      <div class="gallery-timeline-dot${isFirst ? ' active' : ''}"></div>
      <span class="gallery-timeline-year-label">${year}</span>
      <span class="gallery-timeline-year-count">${groups[year].length} Photo${groups[year].length !== 1 ? 's' : ''}</span>
      <span class="gallery-timeline-toggle">▾</span>`;

    let collapsed = false;
    const photoRow = document.createElement('div');
    photoRow.className = 'gallery-timeline-row';

    groups[year].forEach(photo => {
      const item = document.createElement('div');
      item.className = 'gallery-timeline-item';
      const img = document.createElement('img');
      img.src = photo.url;
      img.alt = photo.caption || '';
      img.loading = 'lazy';
      img.style.objectPosition = (photo.position && photo.position !== 'center') ? photo.position : 'center top';
      img.onerror = function() { this.style.display = 'none'; };
      img.onclick = () => openLightbox(photo.url);
      item.appendChild(img);
      if (photo.caption || photo.location) {
        const cap = document.createElement('div');
        cap.className = 'gallery-timeline-cap';
        cap.textContent = [photo.caption, photo.location].filter(Boolean).join(' · ');
        item.appendChild(cap);
      }
      photoRow.appendChild(item);
    });

    header.onclick = () => {
      collapsed = !collapsed;
      photoRow.style.display = collapsed ? 'none' : '';
      header.querySelector('.gallery-timeline-toggle').textContent = collapsed ? '▸' : '▾';
    };

    section.appendChild(header);
    section.appendChild(photoRow);
    wrap.appendChild(section);
  });
  container.appendChild(wrap);
}

function buildTableGallery(photos, container) {
  let sortField = 'position';
  let sortDir = 1;
  let filterText = '';

  const wrap = document.createElement('div');
  wrap.className = 'gallery-table-wrap';

  function render() {
    wrap.innerHTML = '';
    // Search bar
    const searchBar = document.createElement('div');
    searchBar.className = 'gallery-table-search-bar';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search photos…';
    searchInput.value = filterText;
    searchInput.className = 'gallery-table-search';
    searchInput.oninput = e => { filterText = e.target.value; render(); };
    searchBar.appendChild(searchInput);
    wrap.appendChild(searchBar);

    // Filter + sort
    let filtered = photos.filter(p => {
      const q = filterText.toLowerCase();
      return !q || (p.caption||'').toLowerCase().includes(q) || (p.collection||'').toLowerCase().includes(q) || (p.location||'').toLowerCase().includes(q) || String(p.year||'').includes(q);
    });
    filtered = filtered.slice().sort((a, b) => {
      const av = a[sortField] || (sortField === 'position' ? 0 : '');
      const bv = b[sortField] || (sortField === 'position' ? 0 : '');
      if (typeof av === 'number') return (av - bv) * sortDir;
      return String(av).localeCompare(String(bv)) * sortDir;
    });

    const table = document.createElement('table');
    table.className = 'gallery-table';
    const head = document.createElement('thead');
    const headRow = document.createElement('tr');
    const cols = [
      { key: 'url', label: 'Photo' },
      { key: 'caption', label: 'Caption' },
      { key: 'collection', label: 'Collection' },
      { key: 'year', label: 'Year' },
      { key: 'location', label: 'Location' },
    ];
    cols.forEach(col => {
      const th = document.createElement('th');
      th.innerHTML = col.label + (col.key !== 'url' ? ` <span class="gallery-table-sort-icon">${sortField === col.key ? (sortDir === 1 ? '↑' : '↓') : '↕'}</span>` : '');
      if (col.key !== 'url') {
        th.style.cursor = 'pointer';
        th.onclick = () => {
          if (sortField === col.key) sortDir *= -1;
          else { sortField = col.key; sortDir = 1; }
          render();
        };
      }
      headRow.appendChild(th);
    });
    head.appendChild(headRow);
    table.appendChild(head);

    const body = document.createElement('tbody');
    filtered.forEach(photo => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="gallery-table-thumb"><img src="${photo.url}" alt="${(photo.caption||'').replace(/"/g,"'")}" onclick="openLightbox('${photo.url}')" onerror="this.style.display='none'"></td>
        <td>${photo.caption || '<span style="opacity:0.3">—</span>'}</td>
        <td>${photo.collection || '<span style="opacity:0.3">—</span>'}</td>
        <td>${photo.year || '<span style="opacity:0.3">—</span>'}</td>
        <td>${photo.location || '<span style="opacity:0.3">—</span>'}</td>`;
      body.appendChild(tr);
    });
    table.appendChild(body);
    wrap.appendChild(table);

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'gallery-table-empty';
      empty.textContent = 'No photos match your search.';
      wrap.appendChild(empty);
    }
  }
  render();
  container.appendChild(wrap);
}

let _galleryCategoryFilter = 'all';

function buildCategoryBar(photos) {
  const bar = document.getElementById('galleryCategoryBar');
  if (!bar) return;
  // Layouts that use category bar. 'grid' intentionally excluded --
  // the approved Gallery design is a clean flat grid with no filter
  // UI (minimal text, see-everything-quickly), and this bar has a
  // pre-existing mobile overflow issue in the other four modes that
  // is out of scope for this Gallery-only redesign.
  const showBar = ['collections','magazine','timeline','wall'].includes(currentGalleryLayout);
  if (!showBar) { bar.innerHTML = ''; return; }

  // Build category counts
  const counts = { 'all': photos.length };
  photos.forEach(p => {
    if (p.collection) {
      counts[p.collection] = (counts[p.collection] || 0) + 1;
    }
  });

  const collectionIcons = {
    'Live Performances': '🎤', 'Backstage': '🎭', 'Studio Sessions': '🎙',
    'Press & Media': '📰', 'Awards & Recognition': '🏆', 'Personal Moments': '❤',
    'all': '📷'
  };

  bar.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'gallery-cat-bar';

  Object.entries(counts).forEach(([cat, count]) => {
    const btn = document.createElement('button');
    btn.className = 'gallery-cat-btn' + (cat === _galleryCategoryFilter ? ' active' : '');
    const icon = collectionIcons[cat] || '📁';
    const label = cat === 'all' ? 'ALL PHOTOS' : cat.toUpperCase();
    btn.innerHTML = `<span class="gallery-cat-icon">${icon}</span><span class="gallery-cat-label">${label}</span><span class="gallery-cat-count">${count}</span>`;
    btn.onclick = () => {
      _galleryCategoryFilter = cat;
      buildGallery(galleryPhotos);
    };
    wrap.appendChild(btn);
  });
  bar.appendChild(wrap);
}

function buildGallery(photos) {
  galleryPhotos = photos;
  // Use saved layout preference from dashboard
  if (window._epkData && window._epkData.galleryLayout) {
    currentGalleryLayout = window._epkData.galleryLayout;
  }
  // Preview-only override: ?previewLayout=exhibition lets a specific
  // layout be reviewed on a deploy preview without writing anything to
  // the real saved dashboard preference. Read-only, client-side only,
  // never touches window._epkData or persists anywhere.
  const previewLayout = new URLSearchParams(window.location.search).get('previewLayout');
  if (previewLayout) currentGalleryLayout = previewLayout;
  // Sync dropdown
  const sel = document.getElementById('galleryLayoutSelect');
  if (sel) sel.value = currentGalleryLayout;

  // Filter by category
  const filtered = _galleryCategoryFilter === 'all'
    ? photos
    : photos.filter(p => p.collection === _galleryCategoryFilter);

  const container = document.getElementById('galleryContent');
  if (!container) return;
  container.innerHTML = '';

  // Build category bar for applicable layouts
  buildCategoryBar(photos);

  if (currentGalleryLayout === 'marquee') {
    buildMarqueeGallery(filtered, container);
    return;
  }
  if (currentGalleryLayout === 'wall') {
    buildWallGallery(filtered, container);
    return;
  }
  if (currentGalleryLayout === 'scroll') {
    buildScrollGallery(filtered, container);
    return;
  }
  if (currentGalleryLayout === 'collections') {
    buildCollectionsGallery(filtered, container);
    return;
  }
  if (currentGalleryLayout === 'grid') {
    buildGridGallery(filtered, container);
    return;
  }
  if (currentGalleryLayout === 'magazine') {
    buildMagazineGallery(filtered, container);
    return;
  }
  if (currentGalleryLayout === 'timeline') {
    buildTimelineGallery(filtered, container);
    return;
  }
  if (currentGalleryLayout === 'table') {
    buildTableGallery(filtered, container);
    return;
  }
  if (currentGalleryLayout === 'exhibition') {
    buildExhibitionGallery(filtered, container);
    return;
  }

  // All photos go into one pool, distributed across 4 columns
  const numCols = 5;
  const cols = [[], [], [], [], []];
  photos.forEach((p, i) => cols[i % numCols].push(p));

  const grid = document.createElement('div');
  grid.className = 'gallery-4col';

  cols.forEach((colPhotos, colIdx) => {
    if (!colPhotos.length) return;
    const col = document.createElement('div');
    col.className = 'gallery-col';
    const state = { current: 0 };

    colPhotos.forEach((photo, i) => {
      const slide = document.createElement('div');
      slide.className = 'gallery-slide' + (i === 0 ? ' active' : '');
      const pos = photo.position || 'center 0%';
      slide.innerHTML = `<img src="${photo.url}" alt="${photo.caption || ''}" loading="lazy" onclick="openLightbox('${photo.url}')" onerror="this.style.display='none'" style="width:100%;height:100%;object-fit:cover;object-position:${pos};display:block"><div class="gallery-caption">${photo.caption || ''}</div>`;
      col.appendChild(slide);
    });

    // Auto-rotate each column at different speeds
    if (colPhotos.length > 1) {
      setInterval(() => {
        const slides = col.querySelectorAll('.gallery-slide');
        slides[state.current].classList.remove('active');
        state.current = (state.current + 1) % colPhotos.length;
        slides[state.current].classList.add('active');
      }, 3000 + colIdx * 800);
    }

    grid.appendChild(col);
  });

  container.innerHTML = '';
  container.appendChild(grid);
}

function goToSlide(col, state, idx) {
  const slides = col.querySelectorAll('.gallery-slide');
  const dots = col.querySelectorAll('.gallery-dot');
  if (slides[state.current]) slides[state.current].classList.remove('active');
  if (dots[state.current]) dots[state.current].classList.remove('active');
  state.current = idx;
  if (slides[state.current]) slides[state.current].classList.add('active');
  if (dots[state.current]) dots[state.current].classList.add('active');
}

function navigateSlide(col, state, total, dir) {
  const next = (state.current + dir + total) % total;
  goToSlide(col, state, next);
}

// ── QR SCAN TRACKING + EXPIRY CHECK ──
(function() {
  const params = new URLSearchParams(window.location.search);
  const qrMode = params.get('qr');
  const expires = params.get('expires');
  const eventName = params.get('event');
  const s = params.get('slug');

  // Check expiry for Event QR
  if (qrMode === 'event' && expires) {
    const expDate = new Date(expires + 'T23:59:59');
    if (Date.now() > expDate.getTime()) {
      document.addEventListener('DOMContentLoaded', () => {
        const content = document.getElementById('epkContent');
        if (content) content.innerHTML = `
          <div style="padding:8rem 3rem;text-align:center;font-family:var(--font-mono);color:var(--gray)">
            <div style="font-size:2rem;margin-bottom:1rem">⚡</div>
            <div style="font-family:'Playfair Display',serif;font-size:1.5rem;color:#C9A84C;margin-bottom:1rem">This QR code has expired</div>
            ${eventName ? `<div style="font-size:0.75rem;margin-bottom:0.5rem">Event: ${decodeURIComponent(eventName)}</div>` : ''}
            <div style="font-size:0.65rem;color:#666">Expired: ${expires}</div>
            <div style="margin-top:2rem"><a href="/index.html" style="color:#C9A84C;font-size:0.65rem;letter-spacing:0.1em">PorfolioID →</a></div>
          </div>`;
      });
      return; // Stop execution
    }
  }

  // Track scan (fire and forget)
  if (qrMode && s) {
    fetch('/api/epk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'trackScan',
        slug: s,
        qrMode,
        eventName: eventName ? decodeURIComponent(eventName) : null,
        userAgent: navigator.userAgent
      })
    }).catch(() => {});
  }

  // Track page view (fire and forget — always, for every portfolio visit)
  if (s) {
    const device = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
    fetch('/api/epk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'trackView',
        slug: s,
        referrer: document.referrer || null,
        qrMode: qrMode || null,
        device
      })
    }).catch(() => {});
  }
})();

// Init
const slug = getSlugFromURL();
if (slug) {
  // Try API first
  fetch('/api/epk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'load', slug })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success && data.epk) {
      try {
        buildEPK(data.epk);
      } catch(err) {
        document.getElementById('epkContent').innerHTML = '<div style="padding:8rem 3rem;text-align:center;font-family:var(--font-mono);color:var(--gray);font-size:0.8rem">Error: ' + err.message + '<br><br><a href="/" style="color:var(--gold)">Return home →</a></div>';
      }
    } else {
      const epk = getEPKData(slug);
      if (epk) {
        buildEPK(epk);
      } else {
        document.getElementById('epkContent').innerHTML = '<div style="padding:8rem 3rem;text-align:center;font-family:var(--font-mono);color:var(--gray)">Portfolio not found. <a href="/" style="color:var(--gold)">Return home →</a></div>';
      }
    }
  })
  .catch((err) => {
    const epk = getEPKData(slug);
    if (epk) {
      buildEPK(epk);
    } else {
      document.getElementById('epkContent').innerHTML = '<div style="padding:8rem 3rem;text-align:center;font-family:var(--font-mono);color:var(--gray)">Fetch error: ' + err.message + '<br><a href="/" style="color:var(--gold)">Return home →</a></div>';
    }
  });
} else {
  window.location.href = '/index.html';
}

// Lyrics toggle
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('lyrics-toggle')) {
    const id = e.target.getAttribute('data-id');
    const el = document.getElementById(id);
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
  }
});

// Horizontal video carousel: prev/next button scroll + wheel-redirect.
// Shared by Grid categories, Cinematic's More Performances, and
// Spotlight's Collections -- one implementation, three uses.
function scrollCarousel(btn, dir) {
  const wrap = btn.closest('.video-carousel-wrap');
  const track = wrap && wrap.querySelector('.video-carousel');
  if (!track) return;
  const card = track.querySelector('.vcard, .videos-collection-thumb');
  const step = card ? (card.getBoundingClientRect().width + 24) * 2 : 400;
  track.scrollBy({ left: dir * step, behavior: 'smooth' });
}
function initVideoCarousels() {
  document.querySelectorAll('.video-carousel').forEach((track) => {
    if (track.dataset.wheelBound) return;
    track.dataset.wheelBound = '1';
    track.addEventListener('wheel', (e) => {
      // Only intercept vertical wheel motion, and only while the
      // carousel actually has room to scroll further in that
      // direction -- otherwise let the event pass through so the
      // page keeps scrolling normally rather than trapping the user.
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      if (track.scrollWidth <= track.clientWidth) return;
      const atStart = track.scrollLeft <= 0;
      const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 1;
      if ((e.deltaY < 0 && atStart) || (e.deltaY > 0 && atEnd)) return;
      e.preventDefault();
      track.scrollLeft += e.deltaY;
    }, { passive: false });
  });
}

// Video collapse/expand
function toggleAllVideos() {
  const allDiv = document.getElementById('videosAll');
  const featDiv = document.getElementById('videosFeatured');
  const btn = document.getElementById('videoToggleBtn');
  if (!allDiv || !btn) return;
  const isExpanding = btn.getAttribute('aria-expanded') !== 'true';
  allDiv.style.display = isExpanding ? 'block' : 'none';
  featDiv.style.display = isExpanding ? 'none' : 'block';
  btn.setAttribute('aria-expanded', isExpanding ? 'true' : 'false');
  btn.textContent = isExpanding ? 'Show Less \u2212' : 'View All Videos +';
  if (isExpanding) initVideoCarousels();
  if (!isExpanding) {
    // Collapsing: only scroll back to the top of the section if the user
    // has scrolled below where the collapsed content ends, so they aren't
    // left stranded looking at empty space below the now-shorter section.
    const section = document.getElementById('videos');
    if (section) {
      const rect = section.getBoundingClientRect();
      if (rect.top < 0) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }
}

// Modal font size control
let _modalFontSize = 1.0; // rem, default
function adjustModalFont(dir) {
  const desc = document.getElementById('creditModalDesc');
  if (!desc) return;
  if (dir === 0) { _modalFontSize = 1.0; }
  else { _modalFontSize = Math.min(1.5, Math.max(0.8, _modalFontSize + dir * 0.1)); }
  desc.style.fontSize = _modalFontSize + 'rem';
  // Also scale line height for readability
  desc.style.lineHeight = _modalFontSize > 1.1 ? '2' : '1.9';
}

// Section order and visibility
function applySectionOrderAndVisibility(epk) {
  const DEFAULT_ORDER = ['connect','bio','photos','videos','music','awards','assets','booking'];
  const order = (epk.sectionOrder || DEFAULT_ORDER).filter(id => id !== 'credits');
  const visibility = epk.sectionVisibility || {};

  // QR mode section override
  const urlParams = new URLSearchParams(window.location.search);
  const qrSections = urlParams.get('sections');
  const qrAllowed = qrSections ? new Set(qrSections.split(',')) : null;

  const container = document.getElementById('epkContent');
  if (!container) return;

  // Hide/show sections based on visibility + QR override
  DEFAULT_ORDER.forEach(id => {
    if (id === 'connect') return;
    const el = document.getElementById(id);
    if (!el) return;
    const isVisible = visibility[id] !== false && (!qrAllowed || qrAllowed.has(id));
    el.style.display = isVisible ? '' : 'none';
  });

  // Reorder sections in DOM based on sectionOrder
  // Find the divider after hero as the insertion point
  const hero = container.querySelector('.hero');
  if (!hero) return;
  let insertAfter = hero.nextElementSibling; // usually a divider or first section

  // Pin connect div right after hero before reordering other sections
  const connectEl = document.getElementById('connect');
  if (connectEl) hero.insertAdjacentElement('afterend', connectEl);

  let anchor = connectEl || hero;
  order.forEach(id => {
    if (id === 'connect') return;
    const el = document.getElementById(id);
    if (!el) return;
    const nextSib = el.nextElementSibling;
    anchor.insertAdjacentElement('afterend', el);
    anchor = el;
    if (nextSib && nextSib.classList && nextSib.classList.contains('divider')) {
      anchor.insertAdjacentElement('afterend', nextSib);
      anchor = nextSib;
    }
    // Works is fixed (not user-reorderable) but must be re-pinned right after bio,
    // since reordering bio's siblings would otherwise strand it wherever the DOM mutations left it.
    if (id === 'bio') {
      const worksEl = document.getElementById('works');
      if (worksEl) {
        const worksNextSib = worksEl.nextElementSibling;
        anchor.insertAdjacentElement('afterend', worksEl);
        anchor = worksEl;
        if (worksNextSib && worksNextSib.classList && worksNextSib.classList.contains('divider')) {
          anchor.insertAdjacentElement('afterend', worksNextSib);
          anchor = worksNextSib;
        }
      }
    }
  });
}

// ══════════════════════════════════════════════
// CREATIVE WORKS — custom audio player controls
// ══════════════════════════════════════════════
function formatPlayerTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function workPlayerEl(id) { return document.getElementById(id); }

function workPlayerWire(wrap) {
  if (!wrap || wrap.dataset.wired) return;
  wrap.dataset.wired = '1';
  const audio = wrap.querySelector('.wp-audio');
  if (!audio) return;
  const fill = wrap.querySelector('.wp-progress-fill');
  const curEl = wrap.querySelector('.wp-time-current');
  const totEl = wrap.querySelector('.wp-time-total');

  audio.addEventListener('loadedmetadata', () => {
    if (totEl) totEl.textContent = formatPlayerTime(audio.duration);
  });
  // The browser may have already loaded metadata before this listener was attached
  // (e.g. preload="metadata" resolves fast on a cached/fast connection) — check directly too.
  if (audio.readyState >= 1 && totEl) totEl.textContent = formatPlayerTime(audio.duration);
  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    if (fill) fill.style.width = pct + '%';
    if (curEl) curEl.textContent = formatPlayerTime(audio.currentTime);
  });
  audio.addEventListener('ended', () => {
    wrap.classList.remove('is-playing');
    if (fill) fill.style.width = '0%';
    if (curEl) curEl.textContent = '0:00';
  });
  audio.addEventListener('pause', () => wrap.classList.remove('is-playing'));
  audio.addEventListener('play', () => wrap.classList.add('is-playing'));
}

function workPlayerToggle(id) {
  const wrap = workPlayerEl(id);
  if (!wrap) return;
  const audio = wrap.querySelector('.wp-audio');
  if (!audio) return;

  // Pause every other Work player first so only one plays at a time
  document.querySelectorAll('.work-player').forEach(other => {
    if (other.id !== id) {
      const otherAudio = other.querySelector('.wp-audio');
      if (otherAudio && !otherAudio.paused) otherAudio.pause();
      other.classList.remove('is-playing');
    }
  });

  if (audio.paused) {
    audio.play();
    wrap.classList.add('is-playing');
  } else {
    audio.pause();
    wrap.classList.remove('is-playing');
  }

  workPlayerWire(wrap);
}

function workPlayerSeek(evt, id) {
  const wrap = workPlayerEl(id);
  if (!wrap) return;
  const audio = wrap.querySelector('.wp-audio');
  const track = wrap.querySelector('.wp-waveform');
  if (!audio || !track || !audio.duration) return;
  const rect = track.getBoundingClientRect();
  const pct = Math.min(1, Math.max(0, (evt.clientX - rect.left) / rect.width));
  audio.currentTime = pct * audio.duration;
}

function workPlayerVolume(id, value) {
  const wrap = workPlayerEl(id);
  if (!wrap) return;
  const audio = wrap.querySelector('.wp-audio');
  if (audio) audio.volume = parseFloat(value);
  wrap.classList.toggle('is-muted', parseFloat(value) === 0);
}

function workPlayerMute(id) {
  const wrap = workPlayerEl(id);
  if (!wrap) return;
  const audio = wrap.querySelector('.wp-audio');
  const slider = wrap.querySelector('.wp-vol-slider');
  if (!audio) return;
  if (audio.volume > 0) {
    audio.dataset.prevVolume = audio.volume;
    audio.volume = 0;
    if (slider) slider.value = 0;
    wrap.classList.add('is-muted');
  } else {
    const restore = parseFloat(audio.dataset.prevVolume || '1');
    audio.volume = restore;
    if (slider) slider.value = restore;
    wrap.classList.remove('is-muted');
  }
}

// Credits collapse/expand
function toggleAllCredits() {
  const container = document.getElementById('credits');
  const grid = document.getElementById('creditsGrid');
  const btn = document.getElementById('creditsToggleBtn');
  const banner = document.getElementById('creditsFilterBanner');
  if (!grid || !btn || !container) return;

  // Fully close — re-hide the whole Record section back to its initial state
  container.style.display = 'none';
  grid.classList.remove('credits-expanded');
  grid.querySelectorAll('.credit-card').forEach(card => { card.style.display = ''; });
  if (banner) banner.style.display = 'none';
  const total = grid.querySelectorAll('.credit-card').length;
  btn.textContent = _currentLang === 'es' ? `Ver los ${total} Créditos +` : `View All ${total} Credits +`;
  btn.style.display = '';

  // Scroll back up to the Career Highlights cards so the page doesn't leave the user staring at empty space
  const wrap = document.querySelector('.ch3-wrap');
  if (wrap) {
    setTimeout(() => { wrap.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 30);
  }
}

// Filter credits grid by Career Highlight category, then scroll to it.
// Pass '' to clear the filter and show everything.
//
// LEGACY_HIGHLIGHT_TAG_ALIASES: some already-saved credits still carry an
// older tag value from before a prior taxonomy consolidation. This maps
// each legacy value to its current canonical equivalent so filtering still
// finds them, without renaming/mutating the credit data itself or the
// data-highlight attribute already rendered into the DOM. Read-only,
// in-memory canonicalization at match time only.
const LEGACY_HIGHLIGHT_TAG_ALIASES = { operationscompliance: 'industryoperations' };

function filterCreditsByCategory(tag) {
  const canonicalTag = LEGACY_HIGHLIGHT_TAG_ALIASES[tag] || tag;
  const container = document.getElementById('credits');
  const grid = document.getElementById('creditsGrid');
  const btn = document.getElementById('creditsToggleBtn');
  const banner = document.getElementById('creditsFilterBanner');
  if (!grid) return;

  if (container) container.style.display = 'block'; // reveal on demand — hidden until a card/button is clicked
  grid.classList.add('credits-expanded'); // bypass the nth-child collapse so filtered results aren't hidden
  if (btn) {
    btn.style.display = ''; // Close button stays visible whether filtered or showing everything
    btn.textContent = _currentLang === 'es' ? 'Cerrar –' : 'Close –';
  }

  const cards = grid.querySelectorAll('.credit-card');
  let matchCount = 0;
  cards.forEach(card => {
    const cardTagRaw = card.getAttribute('data-highlight');
    const cardTag = LEGACY_HIGHLIGHT_TAG_ALIASES[cardTagRaw] || cardTagRaw;
    const matches = !canonicalTag || cardTag === canonicalTag;
    card.style.display = matches ? '' : 'none';
    if (matches) matchCount++;
  });

  if (banner) {
    if (canonicalTag && matchCount > 0) {
      const labels = _currentLang === 'es'
        ? { liveperformance:'Presentaciones en Vivo', recordingartist:'Artista de Grabación', creativeprofessional:'Profesional Creativa', marketingpr:'Mercadeo y Relaciones Públicas', industryoperations:'Operaciones de la Industria', founderbuilder:'Fundadora y Creadora' }
        : { liveperformance:'Live Performance', recordingartist:'Recording Artist', creativeprofessional:'Creative Professional', marketingpr:'Marketing & PR', industryoperations:'Industry Operations', founderbuilder:'Founder & Builder' };
      const showingText = _currentLang === 'es' ? 'Mostrando:' : 'Showing:';
      const viewAllText = _currentLang === 'es' ? 'Ver Récord Completo →' : 'View Complete Record →';
      const closeText = _currentLang === 'es' ? 'Cerrar –' : 'Close –';
      banner.innerHTML = `${showingText} <strong style="color:var(--gold)">${labels[canonicalTag] || canonicalTag}</strong> &nbsp;<a href="javascript:void(0)" onclick="filterCreditsByCategory('')" style="color:var(--gray);text-decoration:underline">${viewAllText}</a> &nbsp;<a href="javascript:void(0)" onclick="toggleAllCredits()" style="color:var(--gray);text-decoration:underline">${closeText}</a>`;
      banner.style.display = 'block';
    } else {
      banner.style.display = 'none';
    }
  }

  // Scroll target: when a category tag is passed (highlight card click), scroll to the
  // creditsGrid itself (Career Record section) — NOT the #credits container top which
  // would land on Professional Documents first.
  const scrollTarget = canonicalTag
    ? document.getElementById('creditsGrid')   // → Career Record cards directly
    : document.getElementById('credits');       // → top of expanded section (View Complete Record)
  if (scrollTarget) {
    setTimeout(() => { scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 30);
  }
}


// Credit card reorder
function moveCreditCard(idx, dir) {
  const credits = window._epkData && window._epkData.credits;
  if (!credits) return;
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= credits.length) return;
  const temp = credits[idx];
  credits[idx] = credits[newIdx];
  credits[newIdx] = temp;
  window._epkData.credits = credits;
  const sess = JSON.parse(localStorage.getItem('porfolioid_session') || 'null');
  const slug = (window._ownerSlug) || (sess && sess.slug);
  if (slug) {
    fetch('/.netlify/functions/epk', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({action: 'save', slug: slug, data: {credits: credits}})
    });
  }
  buildEPK(window._epkData);
}

// Owner inline reorder
async function ownerMoveItem(section, idx, dir) {
  if (!window._isOwner || !window._ownerSlug) return;
  try {
    const arr = window._epkData[section] || [];
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= arr.length) return;
    // Swap in local data
    const temp = arr[idx];
    arr[idx] = arr[newIdx];
    arr[newIdx] = temp;
    window._epkData[section] = arr;
    // Save to backend
    fetch('/api/epk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save', slug: window._ownerSlug, data: window._epkData })
    });
    // Re-render just that section without page reload
    buildEPK(window._epkData);
  } catch(e) { console.error('Reorder failed:', e); }
}

// Collapsible sections
function toggleSection(bodyId, header) {
  const body = document.getElementById(bodyId);
  if (!body) return;
  const isOpen = body.classList.contains('open');
  body.classList.toggle('open', !isOpen);
  const toggle = header.querySelector('.collapsible-toggle');
  const label = header.querySelector('.toggle-label');
  const isConnect = bodyId === 'connectBody';
  if (toggle) toggle.innerHTML = isOpen
    ? (isConnect ? '<span class="toggle-label">Explore</span> →' : '<span class="toggle-label">Expand</span> ＋')
    : '<span class="toggle-label">Collapse</span> －';
}

function expandSection(sectionId) {
  // Credits now lives hidden inside the Career Highlights block until requested
  if (sectionId === 'credits') {
    filterCreditsByCategory('');
    return;
  }
  // Works is a plain always-visible section — just smooth-scroll to it
  if (sectionId === 'works') {
    const el = document.getElementById('works');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  // Connect uses a simple display:none toggle on #connect, not the collapsible-body pattern
  if (sectionId === 'connect') {
    const c = document.getElementById('connect');
    if (!c) return;
    const isOpen = c.style.display === 'block';
    c.style.display = isOpen ? 'none' : 'block';
    const bar = document.querySelector('.hero-presence-bar');
    if (bar) {
      const exploreSpan = bar.querySelector('.hero-presence-explore');
      if (exploreSpan) exploreSpan.textContent = isOpen ? 'Explore →' : 'Close ←';
    }
    if (!isOpen) {
      setTimeout(() => {
        const top = c.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top, behavior: 'smooth' });
      }, 50);
    }
    return;
  }
  // Map section IDs to their body IDs
  const bodyMap = { music:'musicBody', awards:'awardsBody', assets:'assetsBody' };
  const bodyId = bodyMap[sectionId];
  if (!bodyId) return;
  const body = document.getElementById(bodyId);
  if (!body) return;
  // Open it if not already open
  if (!body.classList.contains('open')) {
    body.classList.add('open');
    const header = body.previousElementSibling;
    if (header) {
      const toggle = header.querySelector('.collapsible-toggle');
      if (toggle) toggle.innerHTML = '<span class="toggle-label">Collapse</span> －';
    }
  }
}

// Award Modal
function openAwardModal(idx) {
  const awards = window._epkData?.awards || [];
  const a = awards[idx];
  if (!a) return;
  const icons = { award:'🏆', nomination:'🎯', degree:'🎓', certification:'📜', recognition:'⭐', honor:'🏅' };
  const typeLabels = { award:'Award', nomination:'Nomination', degree:'Education', certification:'Certification', recognition:'Recognition', honor:'Honor' };
  const icon = icons[a.type] || '🏆';
  const typeLabel = typeLabels[a.type] || 'Award';

  document.getElementById('awardModalContent').innerHTML = `
    <div style="font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.2em;text-transform:uppercase;color:var(--gold);margin-bottom:0.5rem">${typeLabel} ${a.year ? '· ' + a.year : ''}</div>
    <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1rem">
      <span style="font-size:2rem">${icon}</span>
      <div>
        ${a.verified ? '<span style="font-family:var(--font-mono);font-size:0.5rem;background:rgba(201,168,76,0.15);color:var(--gold);padding:0.15rem 0.5rem;letter-spacing:0.1em;text-transform:uppercase">✓ VERIFIED</span>' : ''}
        <h2 style="font-family:var(--font-display);font-size:1.4rem;color:var(--white);margin:0.25rem 0 0">${a.title}</h2>
      </div>
    </div>
    ${a.org ? `<div style="font-family:var(--font-mono);font-size:0.65rem;color:var(--gray);letter-spacing:0.1em;margin-bottom:1rem">${a.org}</div>` : ''}
    ${a.category ? `<div style="font-family:var(--font-mono);font-size:0.5rem;background:rgba(255,255,255,0.05);color:var(--gray);padding:0.2rem 0.6rem;display:inline-block;margin-bottom:1rem">${a.category}</div>` : ''}
    ${a.desc ? `<p style="font-size:0.9rem;color:var(--gray-light);line-height:1.75;margin-bottom:1.25rem">${a.desc}</p>` : ''}
    ${(a.photos||[]).length ? `
      <div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-bottom:1.25rem">
        ${(a.photos||[]).map(p=>{const url=typeof p==='string'?p:p.url; const cap=typeof p==='string'?'':p.caption||''; return `<div style="width:calc(50% - 0.25rem);position:relative"><img src="${url}" onclick="openLightbox('${url}')" style="width:100%;aspect-ratio:4/3;object-fit:cover;cursor:pointer;border:1px solid rgba(201,168,76,0.15);transition:opacity 0.2s;display:block" onmouseover="this.style.opacity=0.8" onmouseout="this.style.opacity=1" onerror="this.style.display='none'">${cap?`<div style="font-family:var(--font-mono);font-size:0.48rem;letter-spacing:0.08em;color:rgba(255,255,255,0.6);padding:0.3rem 0.25rem">${cap}</div>`:''}</div>`;}).join('')}
      </div>` : ''}
    <div style="display:flex;flex-direction:column;gap:0.5rem">
      ${a.certUrl ? (() => {
        const isCloudinary = a.certUrl.includes('cloudinary.com');
        if (isCloudinary) {
          const rotation = a.certRotation ? ',a_' + a.certRotation : '';
          const match = a.certUrl.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.\w+)?$/);
          const pubId = match ? match[1] : null;
          const imgUrl = pubId
            ? 'https://res.cloudinary.com/djj8xe3gx/image/upload/f_jpg,q_85' + rotation + '/' + pubId + '.pdf'
            : a.certUrl;
          return '<div style="margin-bottom:1rem"><img src="' + imgUrl + '" style="width:100%;border:1px solid rgba(201,168,76,0.2);display:block;cursor:pointer" onclick="openLightbox(\'' + imgUrl + '\')" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"><a href="' + a.certUrl + '" target="_blank" style="display:none;align-items:center;gap:0.75rem;font-family:var(--font-mono);font-size:0.6rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--white);text-decoration:none;border:1px solid rgba(201,168,76,0.2);padding:0.75rem 1rem;background:rgba(201,168,76,0.05)">📄 <span>View Certificate</span> <span style="margin-left:auto;color:var(--gold)">→</span></a></div>';
        }
        return '<a href="' + pdfViewerUrl(a.certUrl) + '" target="_blank" style="display:flex;align-items:center;gap:0.75rem;font-family:var(--font-mono);font-size:0.6rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--white);text-decoration:none;border:1px solid rgba(201,168,76,0.2);padding:0.75rem 1rem;background:rgba(201,168,76,0.05);transition:all 0.2s" onmouseover="this.style.background=\'rgba(201,168,76,0.1)\'" onmouseout="this.style.background=\'rgba(201,168,76,0.05)\'">📄 <span>View Certificate</span> <span style="margin-left:auto;color:var(--gold)">→</span></a>';
      })() : ''}
      ${a.proofLink ? `<a href="${pdfViewerUrl(a.proofLink)}" target="_blank" style="display:flex;align-items:center;gap:0.75rem;font-family:var(--font-mono);font-size:0.6rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);text-decoration:none;border:1px solid rgba(201,168,76,0.15);padding:0.75rem 1rem;transition:all 0.2s" onmouseover="this.style.background='rgba(201,168,76,0.05)'" onmouseout="this.style.background=\'\'\'">✦ <span>View Verification</span> <span style="margin-left:auto">→</span></a>` : ''}
    </div>`;

  const overlay = document.getElementById('awardModalOverlay');
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeAwardModal() {
  document.getElementById('awardModalOverlay').style.display = 'none';
  document.body.style.overflow = '';
}

// Inquiry Modal (lives inside Connect — triggered by the Inquiries card)
function openInquiryModal() {
  const content = document.getElementById('inquiryModalContent');
  if (!content) return;
  content.innerHTML = window._inquiryFormHTML || '<p style="color:var(--gray);font-family:var(--font-mono);font-size:0.7rem">Inquiries are currently unavailable.</p>';
  const overlay = document.getElementById('inquiryModalOverlay');
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeInquiryModal() {
  document.getElementById('inquiryModalOverlay').style.display = 'none';
  document.body.style.overflow = '';
}

// Share Modal
function openShareModal() {
  const url = window.location.href.split('#')[0];
  document.getElementById('modalQRUrl').textContent = url;
  document.getElementById('modalQRCode').innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}&color=000000&bgcolor=ffffff&margin=8" style="width:180px;height:180px;display:block">`;
  const modal = document.getElementById('shareModal');
  modal.style.display = 'flex';
}

function closeShareModal() {
  document.getElementById('shareModal').style.display = 'none';
}

function copyEPKLink() {
  const url = window.location.href.split('#')[0];
  navigator.clipboard.writeText(url).then(() => {
    const btn = document.getElementById('modalCopyBtn');
    btn.textContent = '✓ Copied!';
    setTimeout(() => { btn.textContent = '⎘ Copy Link'; }, 2000);
  });
}

function downloadEPKQR() {
  const url = window.location.href.split('#')[0];
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}&color=000000&bgcolor=ffffff&margin=20`;
  window.open(qrUrl, '_blank');
}

// Bio toggle
function toggleBio() {
  const full = document.getElementById('bioFull');
  const btn = document.getElementById('bioToggleBtn');
  if (!full) return;
  const isHidden = full.style.display === 'none';
  full.style.display = isHidden ? 'block' : 'none';
  if (btn) btn.textContent = isHidden ? 'Collapse Bio −' : 'Read Full Bio +';
}

// Booking form submission
async function handleBookingSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  const success = document.getElementById('bookingSuccess');
  btn.textContent = 'Sending...';
  btn.disabled = true;
  try {
    const formData = new FormData(form);
    await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(formData).toString() });
    form.reset();
    success.style.display = 'block';
    btn.style.display = 'none';
  } catch(err) {
    btn.textContent = '✉ Send Inquiry';
    btn.disabled = false;
    alert('Something went wrong. Please try again.');
  }
}

// Asset download tracking
function trackAssetDownload(idx) {
  try {
    fetch('/api/epk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'trackDownload', slug: getSlugFromURL(), assetIdx: idx })
    });
  } catch(e) {}
}

// Phase 1 fix: openAssetRequest() was referenced by both the Preview and Request
// Access buttons in the Assets section but was never defined anywhere, so both
// silently did nothing on click. This is defined here, at the top level (not
// nested inside buildEPK), because inline onclick="" attributes run in the
// global scope - a nested version is unreachable and throws "not defined".
// This routes visitors to the existing, working Connect Hub inquiry section.
// Intentionally NOT a real request-capture flow (no form, no storage, no
// email) - that remains separate, future Phase 3 work.
function requestAssetViaConnect() {
  const c = document.getElementById('connect');
  if (!c) return;
  c.style.display = 'block';
  const bar = document.querySelector('.hero-presence-bar');
  if (bar) {
    const exploreSpan = bar.querySelector('.hero-presence-explore');
    if (exploreSpan) exploreSpan.textContent = 'Close ←';
  }
  setTimeout(() => {
    const top = c.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: 'smooth' });
  }, 50);
}

// Credit modal
let epkCreditsData = [];
let epkVisibleCredits = [];
let epkResumeCards = [];
let _currentOpenCredit = null;
function openCreditModal(i) {
  const c = (typeof i === 'object') ? i : epkVisibleCredits[i];
  if (!c) return;
  _currentOpenCredit = c;
  const photos = c.photos || [];
  document.getElementById('creditModalArtist').textContent = c.company || c.artist;
  document.getElementById('creditModalMeta').textContent = [c.role, c.contractType, c.years].filter(Boolean).join(' · ');
  const rawDesc = (_currentLang === 'es' && c.fullDescEs) ? c.fullDescEs : (c.fullDesc || c.desc || '');
  // Convert newlines to <br> tags
  // Extract campaign portfolio link from desc and render separately above grid
  let formattedDesc = rawDesc.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
  let campaignLink = '';
  formattedDesc = formattedDesc.replace(
    /View Campaign Portfolio:\s*<a href="([^"]+)"[^>]*>[^<]*<\/a>/gi,
    (match, url) => { campaignLink = url; return ''; }
  );
  // Also clean up trailing <br> left behind
  formattedDesc = formattedDesc.replace(/(<br\s*\/?>)+\s*$/, '');
  document.getElementById('creditModalDesc').innerHTML = formattedDesc;

  // Collaborators
  const collabEl = document.getElementById('creditModalCollaborators');
  collabEl.innerHTML = c.collaborators?.length ? `<div style="font-family:var(--font-mono);font-size:0.6rem;letter-spacing:0.1em;color:var(--gray);margin-bottom:1rem">w/ ${c.collaborators.join(', ')}</div>` : '';

  // Build unified media grid — videos + photos together, same cell size
  // mediaLayout: per-card setting saved in dashboard (defaults to 'grid')
  const mediaLayout = c.mediaLayout || 'grid';
  const allMediaItems = [];

  // Collect videos/docs from mediaItems or legacy fields
  const mediaItems = c.mediaItems || [];
  if (mediaItems.length > 0) {
    mediaItems.forEach(m => {
      if (!m.url) return;
      allMediaItems.push({ kind: 'media', data: m });
    });
  } else {
    if (c.videoUrl) allMediaItems.push({ kind: 'legacy-video', url: c.videoUrl, thumb: c.videoThumb });
    if (c.mediaLink) allMediaItems.push({ kind: 'legacy-link', url: c.mediaLink, label: c.mediaLabel });
  }
  // Collect photos
  photos.forEach(url => allMediaItems.push({ kind: 'photo', url }));

  const totalMedia = allMediaItems.length;
  let unifiedHTML = '';

  // Add teaser label above media grid if there's a campaign/portfolio link in the description
  const hasCampaignLink = !!campaignLink;
  if (totalMedia > 0) {
    if (hasCampaignLink) {
      unifiedHTML += `<div style="margin:0 0 0.75rem">
        <a href="${campaignLink}" target="_blank" style="display:inline-flex;align-items:center;gap:0.75rem;text-decoration:none;border:1px solid #C9A84C;padding:0.6rem 1.25rem;background:rgba(201,168,76,0.08);transition:background 0.2s" onmouseover="this.style.background='rgba(201,168,76,0.18)'" onmouseout="this.style.background='rgba(201,168,76,0.08)'">
          <span style="font-family:var(--font-display);font-size:1.3rem;font-weight:700;color:#F5F3EE;letter-spacing:0.01em">View Campaign</span>
          <span style="font-family:var(--font-display);font-size:1.3rem;font-style:italic;font-weight:700;color:#C9A84C">Portfolio</span>
          <span style="font-family:var(--font-mono);font-size:0.85rem;color:#4A9EFF;text-decoration:underline;letter-spacing:0.02em">${campaignLink} →</span>
        </a>
      </div>`;
      unifiedHTML += `<div style="font-family:var(--font-mono);font-size:0.5rem;letter-spacing:0.2em;text-transform:uppercase;color:#C9A84C;opacity:0.7;margin-bottom:0.5rem;display:flex;align-items:center;gap:0.75rem">Inside the Campaign <span style="flex:1;height:1px;background:rgba(201,168,76,0.2)"></span></div>`;
    }
    // Layout toggle — only show if there are both videos and photos
    if (mediaLayout === 'grid') {
      unifiedHTML += `<div class="credit-media-grid">`;
      allMediaItems.forEach(item => {
        if (item.kind === 'photo') {
          unifiedHTML += `<div class="credit-media-cell credit-media-cell-photo">
            <img src="${item.url}" alt="${c.company||c.artist||''}" loading="lazy" onclick="openLightbox('${item.url}')" onerror="this.parentElement.style.display='none'">
          </div>`;
        } else if (item.kind === 'legacy-video') {
          const thumb = fixVideoThumb(item.thumb || '');
          const label = item.label || '';
          unifiedHTML += `<div class="credit-media-cell credit-media-cell-video" onclick="openVideoPlayer('${item.url}','${thumb}')">
            ${thumb ? `<img src="${thumb}" style="width:100%;height:auto;display:block" onerror="this.style.display='none'">` : `<div style="width:100%;height:100%;background:#111;display:flex;align-items:center;justify-content:center"></div>`}
            <div class="credit-media-play">▶</div>
            ${label ? `<div class="credit-media-label">${label}</div>` : ''}
          </div>`;
        } else if (item.kind === 'legacy-link') {
          const ytId = item.url.split('v=')[1]?.split('&')[0] || item.url.split('youtu.be/')[1]?.split('?')[0];
          if (ytId) {
            const ytThumb = `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`;
            unifiedHTML += `<div class="credit-media-cell credit-media-cell-video" onclick="openVideoPlayer('yt:${ytId}','${ytThumb}')">
              <img src="${ytThumb}" style="width:100%;height:auto;display:block">
              <div class="credit-media-play">▶</div>
            </div>`;
          } else {
            unifiedHTML += `<div class="credit-media-cell credit-media-cell-link">
              <a href="${item.url}" target="_blank">${item.label||'Watch →'}</a>
            </div>`;
          }
        } else {
          const m = item.data;
          if (m.type === 'video' || m.url.includes('.mp4') || m.url.includes('.mov')) {
            const thumb = fixVideoThumb(m.thumb || '');
            const label = m.label || '';
            unifiedHTML += `<div class="credit-media-cell credit-media-cell-video" onclick="openVideoPlayer('${m.url}','${thumb}')">
              ${thumb ? `<img src="${thumb}" style="width:100%;height:auto;display:block" onerror="this.style.background='#111'">` : `<div style="width:100%;height:100%;background:#111;display:flex;align-items:center;justify-content:center"></div>`}
              <div class="credit-media-play">▶</div>
              ${label ? `<div class="credit-media-label">${label}</div>` : ''}
            </div>`;
          } else if (m.type === 'doc' || m.url.includes('.pdf') || m.url.includes('.doc')) {
            const label = m.label || 'View Document';
            unifiedHTML += `<div class="credit-media-cell credit-media-cell-doc">
              <a href="${pdfViewerUrl(m.url)}" target="_blank"><span style="font-size:2rem">📄</span><span>${label}</span></a>
            </div>`;
          } else {
            const ytId2 = m.url.split('v=')[1]?.split('&')[0] || m.url.split('youtu.be/')[1]?.split('?')[0];
            if (ytId2) {
              const ytThumb = `https://img.youtube.com/vi/${ytId2}/mqdefault.jpg`;
              unifiedHTML += `<div class="credit-media-cell credit-media-cell-video" onclick="openVideoPlayer('yt:${ytId2}','${ytThumb}')">
                <img src="${ytThumb}" style="width:100%;height:auto;display:block">
                <div class="credit-media-play">▶</div>
              </div>`;
            } else {
              unifiedHTML += `<div class="credit-media-cell credit-media-cell-link">
                <a href="${m.url}" target="_blank">${m.label||'Watch / Listen →'}</a>
              </div>`;
            }
          }
        }
      });
      unifiedHTML += `</div>`;
    } else if (mediaLayout === 'hybrid') {
      // Hybrid: videos full-width on top, photos in grid below
      const videoItems = allMediaItems.filter(item => item.kind !== 'photo');
      const photoItems = allMediaItems.filter(item => item.kind === 'photo');

      videoItems.forEach(item => {
        if (item.kind === 'legacy-video') {
          const thumb = fixVideoThumb(item.thumb || '');
          const label = item.label || '';
          unifiedHTML += `<div class="credit-media-cell credit-media-cell-video" style="width:100%;aspect-ratio:16/9;margin-bottom:0.75rem" onclick="openVideoPlayer('${item.url}','${thumb}')">
            ${thumb ? `<img src="${thumb}" style="width:100%;height:100%;object-fit:cover;display:block;object-position:center top" onerror="this.style.display='none'">` : `<div style="width:100%;height:100%;background:#111"></div>`}
            <div class="credit-media-play">▶</div>
            ${label ? `<div class="credit-media-label">${label}</div>` : ''}
          </div>`;
        } else if (item.kind === 'legacy-link') {
          const ytId = item.url.split('v=')[1]?.split('&')[0] || item.url.split('youtu.be/')[1]?.split('?')[0];
          if (ytId) {
            unifiedHTML += `<div style="position:relative;width:100%;aspect-ratio:16/9;margin-bottom:0.75rem"><iframe src="https://www.youtube.com/embed/${ytId}" style="position:absolute;inset:0;width:100%;height:100%;border:none" allowfullscreen></iframe></div>`;
          }
        } else {
          const m = item.data;
          if (m.type === 'video' || m.url.includes('.mp4') || m.url.includes('.mov')) {
            const thumb = fixVideoThumb(m.thumb || '');
            const label = m.label || '';
            unifiedHTML += `<div class="credit-media-cell credit-media-cell-video" style="width:100%;aspect-ratio:16/9;margin-bottom:0.75rem" onclick="openVideoPlayer('${m.url}','${thumb}')">
              ${thumb ? `<img src="${thumb}" style="width:100%;height:100%;object-fit:cover;display:block;object-position:center top" onerror="this.style.background='#111'">` : `<div style="width:100%;height:100%;background:#111"></div>`}
              <div class="credit-media-play">▶</div>
              ${label ? `<div class="credit-media-label">${label}</div>` : ''}
            </div>`;
          } else if (m.type === 'doc' || m.url.includes('.pdf')) {
            unifiedHTML += `<a href="${pdfViewerUrl(m.url)}" target="_blank" style="display:flex;align-items:center;gap:0.75rem;font-family:var(--font-mono);font-size:0.6rem;color:var(--white);text-decoration:none;border:1px solid rgba(201,168,76,0.2);padding:0.75rem 1rem;margin-bottom:0.75rem;background:rgba(201,168,76,0.05)">📄 ${m.label || 'View Document'} →</a>`;
          }
        }
      });

      if (photoItems.length) {
        unifiedHTML += `<div class="credit-media-grid" style="margin-top:0.5rem">`;
        photoItems.forEach(item => {
          unifiedHTML += `<div class="credit-media-cell credit-media-cell-photo">
            <img src="${item.url}" alt="" loading="lazy" onclick="openLightbox('${item.url}')" onerror="this.parentElement.style.display='none'" style="object-position:center top">
          </div>`;
        });
        unifiedHTML += `</div>`;
      }

    } else if (mediaLayout === 'spotlight') {
      // Spotlight: first photo large featured, rest in supporting grid
      const photos = allMediaItems.filter(item => item.kind === 'photo');
      const nonPhotos = allMediaItems.filter(item => item.kind !== 'photo');

      // Non-photo items (videos/docs) render stacked first if any
      nonPhotos.forEach(item => {
        if (item.kind === 'legacy-video') {
          const thumb = fixVideoThumb(item.thumb || '');
          const label = item.label || '';
          unifiedHTML += `<div class="credit-media-cell credit-media-cell-video" style="width:100%;aspect-ratio:16/9;margin-bottom:0.75rem" onclick="openVideoPlayer('${item.url}','${thumb}')">
            ${thumb ? `<img src="${thumb}" style="width:100%;height:100%;object-fit:cover;display:block;object-position:center top" onerror="this.style.display='none'">` : '<div style="width:100%;height:100%;background:#111"></div>'}
            <div class="credit-media-play">▶</div>
            ${label ? `<div class="credit-media-label">${label}</div>` : ''}
          </div>`;
        } else if (item.kind === 'media') {
          const m = item.data;
          if (m.type === 'video' || m.url.includes('.mp4') || m.url.includes('.mov')) {
            const thumb = fixVideoThumb(m.thumb || '');
            const label = m.label || '';
            unifiedHTML += `<div class="credit-media-cell credit-media-cell-video" style="width:100%;aspect-ratio:16/9;margin-bottom:0.75rem" onclick="openVideoPlayer('${m.url}','${thumb}')">
              ${thumb ? `<img src="${thumb}" style="width:100%;height:100%;object-fit:cover;display:block;object-position:center top" onerror="this.style.background='#111'">` : '<div style="width:100%;height:100%;background:#111"></div>'}
              <div class="credit-media-play">▶</div>
              ${label ? `<div class="credit-media-label">${label}</div>` : ''}
            </div>`;
          }
        }
      });

      if (photos.length === 0) {
        // No photos — nothing to spotlight
      } else if (photos.length === 1) {
        // Single photo — just show it full width
        unifiedHTML += `<div class="credit-spotlight-solo" onclick="openLightbox('${photos[0].url}')">
          <img src="${photos[0].url}" alt="" loading="lazy" onerror="this.style.display='none'" style="object-position:center top">
        </div>`;
      } else {
        // Featured (first) + supporting grid
        const featured = photos[0];
        const rest = photos.slice(1);
        unifiedHTML += `<div class="credit-spotlight-wrap">
          <div class="credit-spotlight-featured" onclick="openLightbox('${featured.url}')">
            <img src="${featured.url}" alt="" loading="lazy" onerror="this.style.display='none'" style="object-position:center top">
            <div class="credit-spotlight-badge">★ Featured</div>
          </div>
          <div class="credit-spotlight-grid">
            ${rest.map(p => `<div class="credit-spotlight-item" onclick="openLightbox('${p.url}')">
              <img src="${p.url}" alt="" loading="lazy" onerror="this.parentElement.style.display='none'" style="object-position:center top">
            </div>`).join('')}
          </div>
        </div>`;
      }

    } else {
      // Stack layout — original full-width behavior
      allMediaItems.forEach(item => {
        if (item.kind === 'photo') {
          unifiedHTML += `<img class="credit-modal-photo" src="${item.url}" alt="" loading="lazy" onclick="openLightbox('${item.url}')" onerror="this.style.display='none'">`;
        } else if (item.kind === 'legacy-video') {
          const posterAttr = item.thumb ? `poster="${item.thumb}"` : '';
          unifiedHTML += `<video controls style="width:100%;aspect-ratio:16/9;display:block;background:#000;margin-bottom:1rem" src="${item.url}" ${posterAttr}></video>`;
        } else if (item.kind === 'legacy-link') {
          const ytId = item.url.split('v=')[1]?.split('&')[0] || item.url.split('youtu.be/')[1]?.split('?')[0];
          if (ytId) {
            unifiedHTML += `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin-bottom:1rem"><iframe src="https://www.youtube.com/embed/${ytId}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none" allowfullscreen></iframe></div>`;
          }
        } else {
          const m = item.data;
          if (m.type === 'video' || m.url.includes('.mp4') || m.url.includes('.mov')) {
            const posterAttr = m.thumb ? `poster="${m.thumb}"` : '';
            unifiedHTML += `<video controls style="width:100%;aspect-ratio:16/9;display:block;background:#000;object-fit:contain;margin-bottom:1rem" src="${m.url}" ${posterAttr}></video>`;
          } else if (m.type === 'doc' || m.url.includes('.pdf') || m.url.includes('.doc')) {
            const label = m.label || 'View Document';
            unifiedHTML += `<a href="${pdfViewerUrl(m.url)}" target="_blank" style="display:flex;align-items:center;gap:0.75rem;font-family:var(--font-mono);font-size:0.65rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--white);text-decoration:none;border:1px solid rgba(201,168,76,0.2);padding:0.75rem 1.25rem;margin-bottom:0.75rem;background:rgba(201,168,76,0.05);transition:all 0.3s">📄 ${label} →</a>`;
          } else {
            const ytId2 = m.url.split('v=')[1]?.split('&')[0] || m.url.split('youtu.be/')[1]?.split('?')[0];
            if (ytId2) {
              unifiedHTML += `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin-bottom:1rem"><iframe src="https://www.youtube.com/embed/${ytId2}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none" allowfullscreen></iframe></div>`;
            }
          }
        }
      });
    }

    // Proof link always at bottom
    if (c.proofLink) {
      unifiedHTML += `<div style="margin-top:1rem"><a href="${pdfViewerUrl(c.proofLink)}" target="_blank" style="font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gray);text-decoration:none;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:1px">✦ View Verification Source →</a></div>`;
    }
  } else {
    // No media at all — still show proof link if present
    if (c.proofLink) {
      unifiedHTML += `<div style="margin-top:0.5rem"><a href="${pdfViewerUrl(c.proofLink)}" target="_blank" style="font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gray);text-decoration:none;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:1px">✦ View Verification Source →</a></div>`;
    }
  }

  document.getElementById('creditModalMedia').innerHTML = unifiedHTML;
  document.getElementById('creditModalPhotos').innerHTML = ''; // now unified above

  // Press & Archive section
  const pressItems = c.press || [];
  document.getElementById('creditModalPress').innerHTML = pressItems.length ? `
    <div style="margin-top:2rem;padding-top:1.5rem;border-top:1px solid rgba(201,168,76,0.12)">
      <div style="font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.25em;text-transform:uppercase;color:var(--gold);margin-bottom:1.25rem;display:flex;align-items:center;gap:0.75rem">
        Press & Archive
        <span style="flex:1;height:1px;background:linear-gradient(to right,rgba(201,168,76,0.2),transparent)"></span>
      </div>
      ${pressItems.map(p => `
        <div style="padding:1rem 0;border-bottom:1px solid rgba(255,255,255,0.05);display:flex;flex-direction:column;gap:0.4rem">
          <div style="display:flex;align-items:baseline;gap:0.75rem;flex-wrap:wrap">
            <span style="font-family:var(--font-mono);font-size:0.7rem;font-weight:700;letter-spacing:0.05em;color:var(--white);text-transform:uppercase">${p.publication}</span>
            ${p.location ? `<span style="font-family:var(--font-mono);font-size:0.55rem;color:var(--gray)">${p.location}</span>` : ''}
            ${p.year ? `<span style="font-family:var(--font-mono);font-size:0.55rem;color:var(--gold);opacity:0.7">· ${p.year}</span>` : ''}
          </div>
          ${p.summary ? `<p style="font-size:0.82rem;color:var(--gray-light);line-height:1.65;font-style:italic;margin:0">${p.summary}</p>` : ''}
          ${p.url ? `<a href="https://docs.google.com/viewer?url=${encodeURIComponent(p.url)}" target="_blank" style="font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);text-decoration:none;display:inline-flex;align-items:center;gap:0.35rem;margin-top:0.25rem;opacity:0.8;transition:opacity 0.2s" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.8">View Archive →</a>` : ''}
        </div>`).join('')}
    </div>` : '';

  document.getElementById('creditModalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeCreditModal() {
  document.getElementById('creditModalOverlay').classList.remove('open');
  document.body.style.overflow = '';
}
// Opens the Biography's full long-form text in the same modal used by Credit
// cards, so the on-site reading experience matches the rest of the site
// exactly - same overlay, same typography, same close button and font-size
// controls. Reuses openCreditModal's text-formatting convention: \n\n becomes
// a paragraph break, and <strong>Heading</strong> renders as a gold section
// header (existing .credit-modal-desc strong CSS rule, unchanged).
function openBiographyModal(idx) {
  const r = epkResumeCards[idx];
  if (!r || !r.fullBio) return;
  document.getElementById('creditModalArtist').textContent = r.title || 'Biography';
  document.getElementById('creditModalMeta').textContent = r.subtitle || '';
  let formattedBio = r.fullBio.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
  document.getElementById('creditModalDesc').innerHTML = formattedBio;
  document.getElementById('creditModalCollaborators').innerHTML = '';
  document.getElementById('creditModalMedia').innerHTML = '';
  document.getElementById('creditModalPhotos').innerHTML = '';
  document.getElementById('creditModalPress').innerHTML = '';
  document.getElementById('creditModalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function fixVideoThumb(url) {
  // Remove forced crop transforms from Cloudinary video thumbnails
  // so portrait/square videos show correctly
  if (!url) return url;
  return url.replace(/so_auto,[^/]*c_fill[^/]*\/f_jpg\//, 'so_auto/f_jpg/');
}

function openVideoPlayer(src, thumb) {
  const existing = document.getElementById('videoPlayerOverlay');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'videoPlayerOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:10000;display:flex;align-items:center;justify-content:center;padding:1rem';
  const isYT = src.startsWith('yt:');
  const inner = document.createElement('div');
  inner.style.cssText = 'position:relative;width:100%;max-width:860px;aspect-ratio:16/9;background:#000';
  if (isYT) {
    const ytId = src.replace('yt:', '');
    inner.innerHTML = `<iframe src="https://www.youtube.com/embed/${ytId}?autoplay=1" style="position:absolute;inset:0;width:100%;height:100%;border:none" allowfullscreen allow="autoplay"></iframe>`;
  } else {
    inner.innerHTML = `<video controls autoplay src="${src}" ${thumb?`poster="${thumb}"`:''}  style="width:100%;height:100%;object-fit:contain;background:#000"></video>`;
  }
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'position:absolute;top:-2.5rem;right:0;background:none;border:1px solid rgba(201,168,76,0.4);color:var(--gold);font-size:0.9rem;width:32px;height:32px;cursor:pointer;z-index:1';
  closeBtn.onclick = () => overlay.remove();
  inner.appendChild(closeBtn);
  overlay.appendChild(inner);
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
}
// Lightbox for photos
function openLightbox(url) {
  document.getElementById('lightboxImg').src = url;
  document.getElementById('lightboxOverlay').style.display = 'flex';
}
function closeLightbox() {
  document.getElementById('lightboxOverlay').style.display = 'none';
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeCreditModal(); closeLightbox(); }
});

// ══════════════════════════════════════════════
// LANGUAGE TOGGLE EN/ES
// ══════════════════════════════════════════════
let _currentLang = 'en';

function toggleLang(lang) {
  _currentLang = lang;
  const epk = window._epkData;
  if (!epk) return;

  const btnEN = document.getElementById('langEN');
  const btnES = document.getElementById('langES');
  const activeStyle = 'font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.1em;background:rgba(201,168,76,0.15);color:var(--gold);border:1px solid rgba(201,168,76,0.4);padding:0.3rem 0.6rem;cursor:pointer;transition:all 0.2s';
  const inactiveStyle = 'font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.1em;background:none;color:rgba(255,255,255,0.3);border:1px solid rgba(255,255,255,0.15);padding:0.3rem 0.6rem;cursor:pointer;transition:all 0.2s';

  if (btnEN) btnEN.style.cssText = lang === 'en' ? activeStyle : inactiveStyle;
  if (btnES) btnES.style.cssText = lang === 'es' ? activeStyle : inactiveStyle;

  const es = epk.es || {};

  // Swap bio text — support both shortBioES (top-level) and es.bio (nested)
  const bioEl = document.getElementById('bioShort');
  if (bioEl) {
    const esText = epk.shortBioES || es.bio || '';
    const text = lang === 'es' && esText ? esText : (epk.shortBio || (epk.bio||'').split('\n')[0] || '');
    bioEl.innerHTML = `<p style="margin-bottom:1.5em">${text}</p>`;
  }

  // Swap full bio
  const bioFullEl = document.getElementById('bioFull');
  if (bioFullEl) {
    if (lang === 'es') {
      const esFullText = epk.bioFullES || '';
      if (esFullText) {
        bioFullEl.innerHTML = esFullText.split(/\n\n+/).filter(p => p.trim()).map(p => `<p style="margin-bottom:1em">${p}</p>`).join('');
      }
    } else {
      const enFullText = epk.bioFull || '';
      if (enFullText) {
        bioFullEl.innerHTML = enFullText.split(/\n\n+/).filter(p => p.trim()).map(p => `<p style="margin-bottom:1em">${p}</p>`).join('');
      }
    }
    bioFullEl.style.display = 'none';
  }

  // Reset bio toggle button on language switch
  const bioToggleBtn = document.getElementById('bioToggleBtn');
  if (bioToggleBtn) {
    bioToggleBtn.style.display = 'inline';
    bioToggleBtn.textContent = lang === 'es' ? 'Leer bio completa +' : 'Read Full Bio +';
  }

  // Swap taglines
  const taglineEl = document.querySelector('.hero-tagline');
  if (taglineEl) {
    const taglines = lang === 'es' && es.taglines ? es.taglines : (epk.taglines || []);
    taglineEl.innerHTML = taglines.join('<br>');
  }

  // Swap hero bio paragraphs (hardcoded English in hero build)
  const heroBioEls = document.querySelectorAll('.hero-bio p');
  if (heroBioEls.length >= 3) {
    if (lang === 'es') {
      heroBioEls[0].textContent = 'Con más de 25 años en la industria musical, Leslie A. Guerra conecta el escenario, el estudio y el lado empresarial del entretenimiento.';
      heroBioEls[1].textContent = 'Su trayectoria abarca presentaciones en vivo, grabación, desarrollo artístico, operaciones, mercadeo e innovación en portafolios digitales en múltiples industrias y continentes.';
      heroBioEls[2].textContent = 'Explora sus créditos verificados, proyectos, presentaciones y trayectoria profesional a continuación.';
    } else {
      heroBioEls[0].textContent = 'With more than 25 years in the music industry, Leslie A. Guerra bridges the stage, the studio, and the business side of entertainment.';
      heroBioEls[1].textContent = 'Her career spans live performance, recording, artist development, operations, marketing, and digital portfolio innovation across multiple industries and continents.';
      heroBioEls[2].textContent = 'Explore her verified credits, projects, performances, and professional journey below.';
    }
  }

  // Swap Connect / My Digital Presence bar labels
  const presenceTitle = document.querySelector('.hero-presence-title');
  if (presenceTitle) {
    const exploreSpan = presenceTitle.querySelector('.hero-presence-explore');
    const exploreText = exploreSpan ? exploreSpan.textContent : 'Explore →';
    const isOpen = exploreText === 'Close ←' || exploreText === 'Cerrar ←';
    if (lang === 'es') {
      presenceTitle.childNodes[0].textContent = 'Mi Presencia Digital \u00a0';
      if (exploreSpan) exploreSpan.textContent = isOpen ? 'Cerrar ←' : 'Explorar →';
    } else {
      presenceTitle.childNodes[0].textContent = 'My Digital Presence \u00a0';
      if (exploreSpan) exploreSpan.textContent = isOpen ? 'Close ←' : 'Explore →';
    }
  }

  const presenceMeta = document.querySelector('.hero-presence-meta');
  if (presenceMeta) {
    const currentBookingLabel = (window._epkData && window._epkData.bookingLabel) || 'Inquiries';
    presenceMeta.textContent = lang === 'es'
      ? `Plataformas Sociales • Música • Video • Recomendaciones • ${currentBookingLabel}`
      : `Social Platforms • Music • Video • Recommendations • ${currentBookingLabel}`;
  }

  const presenceEyebrow = document.querySelector('.hero-presence-eyebrow');
  if (presenceEyebrow) {
    const svgEl = presenceEyebrow.querySelector('svg');
    if (svgEl) {
      presenceEyebrow.innerHTML = '';
      presenceEyebrow.appendChild(svgEl);
      presenceEyebrow.appendChild(document.createTextNode(lang === 'es' ? ' Conectar' : ' Connect'));
    }
  }

  // Swap section titles
  const titleMap = {
    careerTitle: lang === 'es' ? (es.careerTitle || 'Identidad <em>Profesional</em>') : 'Professional <em>Identity</em>',
    creditsTitle: lang === 'es' ? (es.creditsTitle || 'El Récord') : 'The Record',
    photosTitle:  lang === 'es' ? (es.photosTitle  || 'En Escena & Detrás de Cámaras') : 'On Stage & Behind the Scenes',
    videoTitle:   lang === 'es' ? (es.videoTitle   || 'En Vivo & En Cámara') : 'Live & On Camera',
  };
  Object.entries(titleMap).forEach(([key, val]) => {
    const el = document.querySelector(`[data-editable-key="${key}"]`);
    if (el) el.innerHTML = val;
  });

  // Swap Career Highlights section (eyebrow, heading, 6 cards, caption, button)
  const ch3Eyebrow = document.getElementById('ch3Eyebrow');
  if (ch3Eyebrow) ch3Eyebrow.textContent = lang === 'es' ? 'Perfil Profesional' : 'Career Profile';

  const ch3Heading = document.getElementById('ch3Heading');
  if (ch3Heading) ch3Heading.textContent = lang === 'es' ? 'Aspectos Destacados de la Trayectoria' : 'Career Record Highlights';

  // Cards read their own titleEs/descriptionEs — either from saved
  // epk.careerHighlights or from DEFAULT_CAREER_HIGHLIGHTS — instead of a
  // separate hardcoded translation map, so dashboard-edited Spanish content
  // is picked up automatically.
  const ch3ActiveCards = getActiveCareerHighlights(epk);
  document.querySelectorAll('.ch3-card').forEach(card => {
    const tag = card.getAttribute('data-ch3-tag');
    const titleEl = card.querySelector('.ch3-title');
    const descEl = card.querySelector('.ch3-desc');
    const cardData = ch3ActiveCards.find(c => c.tag === tag);
    if (!tag || !cardData) return;
    if (lang === 'es') {
      if (titleEl) { if (!titleEl.dataset.enOriginal) titleEl.dataset.enOriginal = titleEl.innerHTML; titleEl.innerHTML = cardData.titleEs || cardData.title || ''; }
      if (descEl)  { if (!descEl.dataset.enOriginal)  descEl.dataset.enOriginal  = descEl.innerHTML;  descEl.innerHTML  = cardData.descriptionEs || cardData.description || ''; }
    } else {
      if (titleEl && titleEl.dataset.enOriginal) titleEl.innerHTML = titleEl.dataset.enOriginal;
      if (descEl && descEl.dataset.enOriginal)  descEl.innerHTML  = descEl.dataset.enOriginal;
    }
  });

  const ch3Caption = document.getElementById('viewCompleteRecordCaption');
  if (ch3Caption) {
    ch3Caption.textContent = lang === 'es'
      ? 'Cada crédito, rol y colaboración en un solo lugar — clasificado por categoría, con detalles completos detrás de cada entrada.'
      : 'Every credit, role, and collaboration in one place — sortable by category, with full details behind each entry.';
  }

  const ch3ViewBtn = document.getElementById('viewCompleteRecordBtn');
  if (ch3ViewBtn) ch3ViewBtn.textContent = lang === 'es' ? 'Ver Récord Completo →' : 'View Complete Record →';

  const worksEyebrow = document.getElementById('worksEyebrow');
  if (worksEyebrow) worksEyebrow.textContent = lang === 'es' ? 'Obras Creativas' : 'Creative Works';

  const worksHeading = document.getElementById('worksHeading');
  if (worksHeading) worksHeading.textContent = lang === 'es' ? 'Obras Originales' : 'Original Works';

  const worksTagline = document.getElementById('worksTagline');
  if (worksTagline) {
    worksTagline.textContent = lang === 'es'
      ? 'Algunas historias no podían quedarse en la página. Se convirtieron en música.'
      : 'Some stories couldn\'t stay on the page. They became music.';
  }

  document.querySelectorAll('.work-card-cta').forEach(el => {
    if (el.firstChild && el.firstChild.nodeType === Node.TEXT_NODE) {
      el.firstChild.textContent = lang === 'es' ? 'Entrar a la Historia ' : 'Enter the Story ';
    }
  });
}

// ══════════════════════════════════════════════
// INLINE EDIT MODE
// ══════════════════════════════════════════════
let _editMode = false;
let _pendingEdits = {}; // { fieldKey: newValue }
let _globalFontSize = 16; // px

function toggleEditMode() {
  if (!window._isOwner) return;
  _editMode = !_editMode;
  document.body.classList.toggle('edit-mode', _editMode);
  const bar = document.getElementById('inlineEditBar');
  const btn = document.getElementById('editBtn');
  if (_editMode) {
    bar.style.display = 'flex';
    btn.textContent = '✕ Exit Editing';
    activateEditableFields();
  } else {
    bar.style.display = 'none';
    btn.textContent = 'Edit Portfolio';
    deactivateEditableFields();
  }
}

function activateEditableFields() {
  // Make all data-editable elements contenteditable
  document.querySelectorAll('[data-editable]').forEach(el => {
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('spellcheck', 'true');
    el.addEventListener('input', onFieldEdit);
    el.addEventListener('focus', onFieldFocus);
    // Apply current global font size
    if (el.dataset.editableType === 'body') {
      el.style.fontSize = _globalFontSize + 'px';
    }
  });
}

function deactivateEditableFields() {
  document.querySelectorAll('[data-editable]').forEach(el => {
    el.setAttribute('contenteditable', 'false');
    el.removeEventListener('input', onFieldEdit);
    el.removeEventListener('focus', onFieldFocus);
  });
}

function onFieldEdit(e) {
  const el = e.target;
  const key = el.dataset.editableKey;
  if (key) {
    _pendingEdits[key] = el.innerText.trim();
    // Show unsaved dot on save button
    const saveBtn = document.querySelector('#inlineEditBar button');
    if (saveBtn && !saveBtn.querySelector('.unsaved-dot')) {
      const dot = document.createElement('span');
      dot.className = 'unsaved-dot';
      saveBtn.appendChild(dot);
    }
  }
}

function onFieldFocus(e) {
  const el = e.target;
  const type = el.dataset.editableType;
  // Sync font size selector to current element size
  const currentSize = parseInt(window.getComputedStyle(el).fontSize);
  const sel = document.getElementById('editFontSize');
  if (sel && currentSize) {
    // Find closest option
    const options = Array.from(sel.options).map(o => parseInt(o.value));
    const closest = options.reduce((a,b) => Math.abs(b-currentSize) < Math.abs(a-currentSize) ? b : a);
    sel.value = closest;
  }
}

function applyFontSize() {
  const size = parseInt(document.getElementById('editFontSize').value);
  const applyAll = document.getElementById('applyToAll').checked;
  _globalFontSize = size;

  if (applyAll) {
    // Apply to all body text fields
    document.querySelectorAll('[data-editable][data-editable-type="body"]').forEach(el => {
      el.style.fontSize = size + 'px';
      el.style.lineHeight = size >= 18 ? '2' : '1.85';
      const key = el.dataset.editableKey;
      if (key) _pendingEdits['__fontSize__' + key] = size;
    });
    _pendingEdits['__globalFontSize__'] = size;
  } else {
    // Apply only to focused element
    const focused = document.querySelector('[data-editable]:focus');
    if (focused) {
      focused.style.fontSize = size + 'px';
      focused.style.lineHeight = size >= 18 ? '2' : '1.85';
    }
  }
  // Show unsaved dot
  const saveBtn = document.querySelector('#inlineEditBar button');
  if (saveBtn && !saveBtn.querySelector('.unsaved-dot')) {
    const dot = document.createElement('span');
    dot.className = 'unsaved-dot';
    saveBtn.appendChild(dot);
  }
}

async function saveInlineEdits() {
  if (!window._ownerSlug || Object.keys(_pendingEdits).length === 0) {
    showEditToast('No changes to save');
    return;
  }
  const saveBtn = document.querySelector('#inlineEditBar button');
  const originalText = '✓ Save Changes';
  saveBtn.textContent = 'Saving...';
  saveBtn.disabled = true;

  try {
    // Load current EPK data
    const res = await fetch(`/.netlify/functions/epk?slug=${window._ownerSlug}`);
    const epk = await res.json();

    // Apply pending edits to epk data object
    for (const [key, value] of Object.entries(_pendingEdits)) {
      if (key.startsWith('__')) continue; // skip meta keys
      const parts = key.split('.');
      if (parts.length === 1) {
        epk[parts[0]] = value;
      } else if (parts.length === 2) {
        if (!epk[parts[0]]) epk[parts[0]] = {};
        epk[parts[0]][parts[1]] = value;
      } else if (parts.length === 3) {
        const [section, idx, field] = parts;
        if (epk[section] && epk[section][parseInt(idx)]) {
          epk[section][parseInt(idx)][field] = value;
        }
      }
    }

    // Apply global font size if changed
    if (_pendingEdits['__globalFontSize__']) {
      epk._globalFontSize = _pendingEdits['__globalFontSize__'];
    }

    // Save back
    const saveRes = await fetch('/.netlify/functions/epk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: window._ownerSlug, data: epk })
    });

    if (saveRes.ok) {
      _pendingEdits = {};
      saveBtn.textContent = '✓ Saved!';
      saveBtn.style.background = '#2a7a2a';
      setTimeout(() => {
        saveBtn.textContent = originalText;
        saveBtn.style.background = '';
        saveBtn.disabled = false;
      }, 2000);
      showEditToast('Changes saved ✓');
    } else {
      throw new Error('Save failed');
    }
  } catch(err) {
    saveBtn.textContent = '✕ Error — retry';
    saveBtn.style.background = '#7a2a2a';
    saveBtn.disabled = false;
    setTimeout(() => {
      saveBtn.textContent = originalText;
      saveBtn.style.background = '';
    }, 3000);
  }
}

function showEditToast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(10,10,10,0.92);color:var(--gold);font-family:var(--font-mono);font-size:0.65rem;letter-spacing:0.12em;padding:0.6rem 1.25rem;border:1px solid rgba(201,168,76,0.3);z-index:9999;pointer-events:none;transition:opacity 0.3s';
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 2500);
}

// Mon May 18 10:20:25 UTC 2026

function playYouTubeInline(embedId, ytVideoId) {
  const thumb = document.getElementById('ytthumb_' + embedId);
  const embed = document.getElementById('ytembed_' + embedId);
  if (!thumb || !embed) return;
  thumb.style.display = 'none';
  embed.style.display = 'block';
  embed.innerHTML = `<iframe src="https://www.youtube.com/embed/${ytVideoId}?autoplay=1&rel=0" style="width:100%;height:100%;border:none;display:block" allowfullscreen allow="autoplay; encrypted-media"></iframe>`;
}

function spotlightSelect(idx) {
  const videos = window._epkData?.videos || [];
  const v = videos.filter(v => v.visible !== false)[idx];
  if (!v) return;
  // Update active state by the item's own stable data-video-idx identity,
  // not DOM/loop position -- Collections groups items by category, so
  // DOM order no longer matches data order, and Recommended/Collections
  // can both contain the item, so multiple elements may need to update.
  document.querySelectorAll('.videos-spotlight-thumb').forEach((el) => {
    el.classList.toggle('active', el.getAttribute('data-video-idx') === String(idx));
  });
  // Update player
  const player = document.querySelector('.videos-spotlight-player');
  if (player) {
    player.setAttribute('data-video-idx', String(idx));
    const isMP4 = v.url && (v.url.includes('.mp4') || v.url.includes('.mov') || v.url.includes('.webm') || (v.url.includes('cloudinary') && !v.url.includes('youtube')));
    const ytId = v.url ? v.url.match(/youtube\.com.*v=([^&]+)|youtu\.be\/([^?]+)/) : null;
    const ytVideoId = ytId ? (ytId[1] || ytId[2]) : null;
    if (isMP4) {
      player.innerHTML = `<video controls autoplay style="width:100%;height:100%;display:block;background:#000;object-fit:contain" ${v.thumb?`poster="${v.thumb}"`:''}><source src="${v.url}" type="video/mp4"></video>`;
    } else if (ytVideoId) {
      player.innerHTML = `<iframe src="https://www.youtube.com/embed/${ytVideoId}?autoplay=1&rel=0" style="width:100%;height:100%;border:none;display:block" allowfullscreen allow="autoplay; encrypted-media"></iframe>`;
    } else {
      const th = v.thumb || (typeof getYouTubeThumb === 'function' ? getYouTubeThumb(v.url) : null);
      player.innerHTML = `<div onclick="window.open('${v.url}','_blank')" style="position:relative;cursor:pointer;width:100%;height:100%">${th ? `<img src="${th}" style="width:100%;height:100%;object-fit:cover;display:block">` : ''}<div class="vcard-play" style="width:64px;height:64px;font-size:1.3rem;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)">▶</div></div>`;
    }
  }
  // Update the featured info panel so title/meta/description/watch-link
  // match the newly selected video, not the original first one.
  const titleEl = document.getElementById('spotlightFeaturedTitle');
  if (titleEl) titleEl.textContent = v.title || '';
  const metaEl = document.getElementById('spotlightFeaturedMeta');
  if (metaEl) metaEl.textContent = [v.album, v.year].filter(Boolean).join(' · ');
  const descEl = document.getElementById('spotlightFeaturedDesc');
  if (descEl) descEl.textContent = v.desc || '';
  const watchEl = document.getElementById('spotlightFeaturedWatch');
  if (watchEl) watchEl.setAttribute('href', v.url || '#');
}
