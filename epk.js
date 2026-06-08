
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
  const match = window.location.pathname.match(/\/epk\/([^\/]+)/);
  return match ? match[1] : null;
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

function buildEPK(epk) {
  window._epkData = epk;
  window._epkData.awards = epk.awards || [];
  const nameParts = (epk.name || 'Artist Name').split(' ');
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' ');

  // Build nav
  const navLinks = document.getElementById('navLinks');
  navLinks.innerHTML = '';
  const ALL_SECTIONS = [
    { id: 'bio', label: 'Career Profile' },
    { id: 'credits', label: 'Credits' },
    { id: 'photos', label: 'Photos' },
    { id: 'videos', label: 'Video' },
    { id: 'music', label: 'Music' },
    { id: 'awards', label: 'Awards' },
    { id: 'assets', label: 'Assets' },
    { id: 'booking', label: 'Booking' },
  ];
  const sectionOrder = epk.sectionOrder || ALL_SECTIONS.map(s => s.id);
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

  // Build connect section
  const svgIcons = {
    instagram: '<svg viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>',
    facebook: '<svg viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>',
    website: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>',
    spotify: '<svg viewBox="0 0 24 24"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>',
    appleMusic: '<svg viewBox="0 0 24 24"><path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.076-.525c-.378-.127-.76-.2-1.147-.232-.238-.018-.48-.026-.72-.026H5.37c-.24 0-.482.008-.72.026-.387.032-.77.105-1.147.232a5.022 5.022 0 00-1.076.525C1.308 1.624.563 2.624.246 3.934A9.23 9.23 0 00.006 6.124C-.005 6.4 0 6.678 0 6.956v10.088c0 .278-.005.556.006.832.03.732.15 1.46.42 2.153.386 1.01 1.05 1.802 1.97 2.356a5.4 5.4 0 001.574.62c.44.098.886.148 1.336.162.287.008.576.012.864.012h13.66c.288 0 .577-.004.864-.012.45-.014.896-.064 1.336-.163a5.4 5.4 0 001.573-.619c.92-.554 1.584-1.346 1.97-2.356.27-.692.39-1.42.42-2.153.011-.276.006-.554.006-.832V6.956c0-.278.005-.556-.006-.832zm-7.27 8.526a.93.93 0 01-.415.79.894.894 0 01-.501.147.928.928 0 01-.443-.11L9.1 12.74v4.613a.933.933 0 01-.933.934.933.933 0 01-.933-.934V6.647a.933.933 0 01.597-.87.928.928 0 011.006.201l6.554 4.04V6.647a.933.933 0 01.933-.934.933.933 0 01.933.934v8.003z"/></svg>',
    youtube: '<svg viewBox="0 0 24 24"><path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg>',
    soundcloud: '<svg viewBox="0 0 24 24"><path d="M1.175 12.225c-.015 0-.03.002-.044.003C.5 12.28 0 12.84 0 13.516c0 .682.504 1.235 1.124 1.235.02 0 .038-.002.057-.003h.05c.02 0 .038.003.058.003h16.754c.62 0 1.123-.553 1.123-1.235 0-.642-.45-1.17-1.03-1.233a2.95 2.95 0 00.03-.396c0-1.66-1.396-3.005-3.12-3.005-.23 0-.455.026-.67.074C13.74 7.48 12.174 6.5 10.38 6.5c-2.537 0-4.595 1.988-4.595 4.442 0 .08.003.158.008.236-.013-.001-.026-.002-.04-.002-1.326 0-2.4 1.048-2.4 2.342 0 .25.042.49.117.716H1.175zm21.649-3.335c-.007 0-.014.001-.021.002-.007-1.638-1.365-2.962-3.038-2.962-.476 0-.928.11-1.33.307-.657-1.49-2.173-2.527-3.936-2.527-2.369 0-4.29 1.854-4.29 4.142 0 .075.002.149.006.223-.011 0-.023-.002-.034-.002-1.238 0-2.242.978-2.242 2.185 0 1.207 1.004 2.185 2.242 2.185h12.643c1.238 0 2.242-.978 2.242-2.185 0-1.172-.948-2.13-2.142-2.168z"/></svg>',
    tidal: '<svg viewBox="0 0 24 24"><path d="M12.012 3.992L8.008 7.996 4.004 3.992 0 7.996l4.004 4.004 4.004-4.004 4.004 4.004 4.004-4.004zM8.008 16.004l4.004-4.004 4.004 4.004L20.02 12l-4.004-4.004-4.004 4.004-4.004-4.004L4.004 12z"/></svg>',
    bandcamp: '<svg viewBox="0 0 24 24"><path d="M0 18.75l7.437-13.5H24l-7.438 13.5z"/></svg>',
  };

  const multiKeys = ['instagram','facebook','website'];
  const labels = { instagram:'Instagram', facebook:'Facebook', tiktok:'TikTok', linkedin:'LinkedIn', website:'Website', spotify:'Spotify', appleMusic:'Apple Music', youtube:'YouTube', soundcloud:'SoundCloud', tidal:'Tidal', bandcamp:'Bandcamp' };

  const platformColors = {
    instagram: '#E1306C', facebook: '#1877F2', tiktok: '#010101',
    linkedin: '#0A66C2', website: '#C9A84C', spotify: '#1DB954',
    appleMusic: '#FC3C44', youtube: '#FF0000', soundcloud: '#FF5500',
    tidal: '#000000', bandcamp: '#1DA0C3'
  };

  const buildConnectLinks = (keys, s) => keys.flatMap(k => {
    const val = s[k];
    if (!val) return [];
    const urls = Array.isArray(val) ? val.filter(Boolean) : (val ? [val] : []);
    if (!urls.length) return [];
    const followers = s[k + '_followers'] || '';
    const color = platformColors[k] || '#C9A84C';
    return urls.map((url, i) => {
      const domain = (() => { try { return new URL(url).hostname.replace('www.',''); } catch { return url; } })();
      const labelSuffix = urls.length > 1 ? ` ${i+1}` : '';
      return `<a href="${url}" class="connect-link" target="_blank" rel="noopener" style="--platform-color:${color}">
        ${svgIcons[k]}
        <span class="connect-link-info">
          <span class="connect-link-label">${labels[k]}${labelSuffix}</span>
          <span class="connect-link-sub">${domain}</span>
        </span>
        ${followers ? `<span class="connect-link-followers">${followers}</span>` : ''}
        <span class="connect-link-arrow">→</span>
      </a>`;
    });
  }).join('');

  const s = epk.socials || {};
  const socialKeys = ['instagram','facebook','tiktok','linkedin','website'];
  const musicKeys = ['spotify','appleMusic','youtube','soundcloud','tidal','bandcamp'];
  const hasValue = (v) => Array.isArray(v) ? v.some(Boolean) : !!v;
  const hasSocials = socialKeys.some(k => hasValue(s[k]));
  const hasMusic = musicKeys.some(k => hasValue(s[k]));

  const connectSectionHTML = (hasSocials || hasMusic) ? `
    <div class="connect-section">
      <div class="section-label">Connect</div>
      <h2 class="section-title">Find Me Online</h2>
      <div class="connect-grid">
        ${hasSocials ? `
        <div class="connect-card">
          <div class="connect-card-title">Social Platforms</div>
          <div class="connect-links">${buildConnectLinks(socialKeys, s)}</div>
        </div>` : ''}
        ${hasMusic ? `
        <div class="connect-card">
          <div class="connect-card-title">Music Platforms</div>
          <div class="connect-links">${buildConnectLinks(musicKeys, s)}</div>
        </div>` : ''}
      </div>
    </div>
    <div class="divider"></div>` : '';

  const statsHTML = (epk.stats || []).filter(s => s.number).map(s => `
    <div>
      <span class="hero-stat-number">${s.number}</span>
      <span class="hero-stat-label">${s.label}</span>
    </div>`).join('');

  const taglinesHTML = (epk.taglines || []).join('<br>');

  const heroImgPos = epk.heroImagePosition !== undefined ? `center ${epk.heroImagePosition}%` : 'center 0%';
  const heroZoom = epk.heroImageZoom || 100;
  const heroFit = epk.heroImageFit || 'cover';
  const heroZoomStyle = heroZoom !== 100 ? `transform:scale(${heroZoom/100});transform-origin:center top;` : '';
  const heroImgHTML = epk.heroImage
    ? `<img class="hero-img" src="${epk.heroImage}" alt="${epk.name}" style="object-fit:${heroFit};object-position:${heroImgPos};${heroZoomStyle}" onerror="this.parentElement.innerHTML='<div class=hero-placeholder><div class=hero-placeholder-icon>🎤</div></div>'">`
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

  // Build career profile resume card
  const buildResumeCard = (r) => {
    const isMusicResume = (r.label||'').includes('Marketing') || (r.title||'').includes('Marketing') || (r.label||'').includes('Artist');
    const rc = isMusicResume ? 'var(--gold)' : '#8FB8D0';
    const rbg = isMusicResume ? 'rgba(201,168,76,' : 'rgba(123,155,175,';
    return `<div class="resume-card" style="border-top:3px solid ${rc}">
      <div class="resume-card-label" style="color:${rc}">${r.label || 'Resume'}</div>
      <div class="resume-card-title">${r.title}</div>
      <div class="resume-card-subtitle">${r.subtitle || ''}</div>
      ${r.skills?.length ? `<div class="resume-card-skills">${r.skills.map(s => `<span class="resume-skill-tag" style="border-color:${rc}4D;background:${rc}0D">${s}</span>`).join('')}</div>` : ''}
      ${r.desc ? `<div class="resume-card-desc">${r.desc}</div>` : ''}
      <div style="display:flex;gap:0.75rem;flex-wrap:wrap;margin-top:auto;padding-top:1.25rem">
        ${r.url ? `<a href="${r.url}" target="_blank" class="resume-card-btn" style="color:${rc};border-color:${rc}4D">↓ Download Resume →</a>` : '<span style="font-family:var(--font-mono);font-size:0.55rem;color:var(--gray);letter-spacing:0.1em;opacity:0.5">PDF coming soon</span>'}
      </div>
      <div style="margin-top:0.85rem;padding-top:0.75rem;border-top:1px solid rgba(201,168,76,0.15);font-family:var(--font-mono);font-size:0.55rem;color:var(--gray);letter-spacing:0.08em;line-height:1.5;opacity:0.7">Full job descriptions and career documentation available in the Credits section below</div>
    </div>`;
  };

  const careerLayout = epk.careerLayout || 'stacked';
  const resumeCards = epk.resumeCards || [];
  const bioImgPos = epk.bioImagePosition !== undefined ? `center ${epk.bioImagePosition}%` : 'center 0%';
  const bioZoom = epk.bioImageZoom || 100;
  const bioCropTop = epk.bioImageCropTop || 0;
  const bioZoomStyle = bioZoom !== 100 ? `transform:scale(${bioZoom/100});transform-origin:center top;` : '';
  const bioCropStyle = bioCropTop > 0 ? `margin-top:-${bioCropTop}%;height:calc(100% + ${bioCropTop}%);` : '';
  const bioFit = epk.bioImageFit || 'cover';
  const bioContainerStyle = bioFit === 'contain' ? 'background:transparent;display:flex;align-items:flex-start;justify-content:center;' : '';
  const bioPortrait = epk.bioImage ? `<div style="position:relative;overflow:hidden;width:100%;height:100%;${bioContainerStyle}"><img src="${epk.bioImage}" class="career-portrait" alt="${epk.name}" style="object-fit:${bioFit};object-position:${bioImgPos};${bioZoomStyle}${bioCropStyle}"></div>` : '';

  const bioShortContent = `
    <div class="career-bio-text">
      <div id="bioShort" data-editable data-editable-key="shortBio" data-editable-type="body" style="outline:none">${shortBioHTML}</div>
      ${hasMoreBio ? `
      <div id="bioFull" style="display:none;margin-top:0.5em">${bioParagraphs}</div>
      <button onclick="toggleBio()" id="bioToggleBtn" style="font-family:var(--font-mono);font-size:0.6rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--gold);background:none;border:1px solid rgba(201,168,76,0.3);padding:0.4rem 0.9rem;cursor:pointer;margin-top:1rem;transition:all 0.2s">Read Full Bio +</button>` : ''}
    </div>`;

  const bioFullContent = '';

  const bioContent = bioShortContent;

  // Build career profile HTML based on layout
  let careerProfileHTML = '';
  if (careerLayout === 'sidebyside') {
    careerProfileHTML = `
      <div class="career-sidebyside">
        <div class="career-sidebyside-left">
          ${bioPortrait}
          ${bioContent}
        </div>
        <div class="career-sidebyside-right">
          ${resumeCards.map(buildResumeCard).join('')}
        </div>
      </div>`;
  } else if (careerLayout === 'threecol') {
    careerProfileHTML = `
      <div class="career-threecol">
        <div class="career-threecol-bio">
          ${bioPortrait}
          ${bioContent}
        </div>
        <div class="career-threecol-cards">
          ${resumeCards[0] ? buildResumeCard(resumeCards[0]) : ''}
          ${resumeCards[1] ? buildResumeCard(resumeCards[1]) : ''}
        </div>
      </div>
      ${bioFullContent ? `<div class="career-bio-full-width">${bioFullContent}</div>` : ''}
    `;
  } else {
    // Stacked (default)
    careerProfileHTML = `
      <div class="career-stacked-bio">
        ${bioPortrait ? `<div>${bioPortrait}</div>` : ''}
        ${bioContent}
      </div>
      ${resumeCards.length ? `<div class="career-stacked-cards">${resumeCards.map(buildResumeCard).join('')}</div>` : ''}`;
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
    <div class="credit-card owner-item-wrap" ${hasDetail ? `onclick="openCreditModal(${i})"` : '' } style="border-top:2px solid ${accentColor};position:relative">
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

  const buildVideoCard = (v, vidIdx) => {
    const totalVisible = visibleVideos.length;
    const ownerOverlay = `<div class="owner-overlay" style="flex-direction:row;gap:0.2rem"><button class="owner-action-btn owner-up" onclick="event.stopPropagation();ownerMoveItem('videos',${vidIdx},-1)" title="Move Left">◀</button><button class="owner-action-btn owner-down" onclick="event.stopPropagation();ownerMoveItem('videos',${vidIdx},1)" title="Move Right">▶</button></div>`;
    const isMP4 = v.url && (v.url.includes('.mp4') || v.url.includes('.mov') || v.url.includes('.webm') || (v.url.includes('cloudinary') && !v.url.includes('youtube')));
    const thumb = v.thumb || getYouTubeThumb(v.url);
    const videoMeta = (v.album || v.year) ? `<div class="video-meta">${v.album ? `<span>${v.album}</span>` : ''}${v.album && v.year ? ' · ' : ''}${v.year || ''}</div>` : '';
    const videoDesc = v.desc ? `<div class="video-desc">${v.desc}</div>` : '';
    const categoryBadge = v.category ? `<div style="position:absolute;top:0.5rem;left:0.5rem;font-family:var(--font-mono);font-size:0.5rem;letter-spacing:0.1em;text-transform:uppercase;background:rgba(0,0,0,0.7);color:var(--gold);padding:0.15rem 0.5rem;z-index:2">${v.category}</div>` : '';
    const featuredBadge = v.featured ? `<div style="position:absolute;top:0.5rem;right:0.5rem;font-family:var(--font-mono);font-size:0.5rem;letter-spacing:0.1em;text-transform:uppercase;background:rgba(201,168,76,0.9);color:var(--black);padding:0.15rem 0.5rem;z-index:2">⭐ Featured</div>` : '';
    if (isMP4) {
      return `<div class="video-card owner-item-wrap" style="position:relative">${ownerOverlay}${categoryBadge}${featuredBadge}<video controls style="width:100%;aspect-ratio:16/9;display:block;background:#000;object-fit:contain" ${v.thumb ? `poster="${v.thumb}"` : ''}><source src="${v.url}" type="video/mp4"></video><div class="video-caption">${v.title}</div>${videoMeta}${videoDesc}</div>`;
    }
    const ytId = v.url ? v.url.match(/youtube\.com.*v=([^&]+)|youtu\.be\/([^?]+)/) : null;
    const ytVideoId = ytId ? (ytId[1] || ytId[2]) : null;
    if (ytVideoId) {
      const ytEmbedId = 'yt_' + vidIdx + '_' + ytVideoId;
      return `<div class="video-card owner-item-wrap" style="position:relative" id="ytcard_${ytEmbedId}">${ownerOverlay}${categoryBadge}${featuredBadge}<div id="ytthumb_${ytEmbedId}" style="position:relative;cursor:pointer" onclick="playYouTubeInline('${ytEmbedId}','${ytVideoId}')">${thumb ? `<img class="video-thumb" src="${thumb}" alt="${v.title}" loading="lazy" style="width:100%;aspect-ratio:16/9;object-fit:cover;display:block">` : `<div class="video-thumb" style="background:var(--dark-4);display:flex;align-items:center;justify-content:center;color:var(--gray);font-size:2rem;aspect-ratio:16/9">▶</div>`}<div class="video-play">▶</div></div><div id="ytembed_${ytEmbedId}" style="display:none;width:100%;aspect-ratio:16/9"></div><div class="video-caption">${v.title}</div>${videoMeta}${videoDesc}<div style="text-align:right;margin-top:0.25rem"><a href="${v.url}" target="_blank" style="font-family:var(--font-mono);font-size:0.55rem;color:var(--gray);letter-spacing:0.05em;text-decoration:none;opacity:0.6">↗ Watch on YouTube</a></div></div>`;
    }
    return `<div class="video-card owner-item-wrap" style="position:relative" onclick="window.open('${v.url}','_blank')">${ownerOverlay}${categoryBadge}${featuredBadge}${thumb ? `<img class="video-thumb" src="${thumb}" alt="${v.title}" loading="lazy">` : `<div class="video-thumb" style="background:var(--dark-4);display:flex;align-items:center;justify-content:center;color:var(--gray);font-size:2rem">▶</div>`}<div class="video-play">▶</div><div class="video-caption">${v.title}</div>${videoMeta}${videoDesc}</div>`;
  };

  // Group by category — but keep original indices for reordering
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

  let videosHTML = '';

  if (videoLayout === 'cinematic') {
    // First video large, rest in grid below
    const [first, ...rest] = visibleVideos;
    const isMP4First = first && first.url && (first.url.includes('.mp4') || first.url.includes('.mov') || first.url.includes('.webm') || (first.url.includes('cloudinary') && !first.url.includes('youtube')));
    const firstThumb = first && (first.thumb || getYouTubeThumb(first.url));
    const firstYtMatch = first && first.url ? first.url.match(/youtube\.com.*v=([^&]+)|youtu\.be\/([^?]+)/) : null;
    const firstYtId = firstYtMatch ? (firstYtMatch[1] || firstYtMatch[2]) : null;
    const firstMedia = first ? (isMP4First
      ? `<video controls style="width:100%;aspect-ratio:16/9;display:block;background:#000" ${first.thumb?`poster="${first.thumb}"`:''}><source src="${first.url}" type="video/mp4"></video>`
      : firstYtId
        ? `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden"><iframe src="https://www.youtube.com/embed/${firstYtId}?rel=0" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none" allowfullscreen allow="autoplay; encrypted-media"></iframe></div>`
        : `<div onclick="window.open('${first.url}','_blank')" style="position:relative;cursor:pointer">${firstThumb?`<img src="${firstThumb}" style="width:100%;aspect-ratio:16/9;object-fit:cover;display:block">`:''}<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:60px;height:60px;border-radius:50%;border:2px solid var(--gold);display:flex;align-items:center;justify-content:center;color:var(--gold);font-size:1.2rem;background:rgba(0,0,0,0.5)">▶</div></div>`) : '';
    if (first) {
      videosHTML = `<div class="video-cinematic-featured">${firstMedia}<div class="video-cinematic-title">${first.title}</div><div class="video-cinematic-meta">${[first.album, first.year].filter(Boolean).join(' · ')}</div>${first.desc?`<div class="video-cinematic-desc">${first.desc}</div>`:''}</div>`;
    }
    if (rest.length) {
      videosHTML += `<div class="video-cinematic-rest">${rest.map(v => buildVideoCard(v, v._origIdx || visibleVideos.indexOf(v))).join('')}</div>`;
    }
  } else if (videoLayout === 'list') {
    videosHTML = '<div>';
    visibleVideos.forEach((v, i) => {
      const isMP4 = v.url && (v.url.includes('.mp4') || v.url.includes('cloudinary'));
      const thumb = v.thumb || getYouTubeThumb(v.url);
      const thumbHTML = isMP4
        ? `<video style="width:100%;aspect-ratio:16/9;display:block" src="${v.url}" ${v.thumb?`poster="${v.thumb}"`:''}></video>`
        : `${thumb?`<img src="${thumb}" style="width:100%;aspect-ratio:16/9;object-fit:cover;display:block" alt="${v.title}">`:''}<div class="video-play">▶</div>`;
      videosHTML += `<div class="video-list-item">
        <div class="video-list-thumb owner-item-wrap" onclick="window.open('${v.url}','_blank')">${thumbHTML}<div class="owner-overlay"><button class="owner-action-btn owner-up" onclick="event.stopPropagation();ownerMoveItem('videos',${i},-1)">▲</button><button class="owner-action-btn owner-down" onclick="event.stopPropagation();ownerMoveItem('videos',${i},1)">▼</button></div></div>
        <div class="video-list-info">
          <div class="video-list-title">${v.title}</div>
          <div class="video-list-meta">${[v.album, v.year].filter(Boolean).join(' · ')}</div>
          ${v.desc?`<div class="video-list-desc">${v.desc}</div>`:''}
        </div>
      </div>`;
    });
    videosHTML += '</div>';
  } else if (videoLayout === 'spotlight') {
    const first = visibleVideos[0];
    const firstThumb = first ? (first.thumb || getYouTubeThumb(first.url)) : null;
    const firstIsMP4 = first && first.url && (first.url.includes('.mp4') || first.url.includes('.mov') || first.url.includes('.webm') || (first.url.includes('cloudinary') && !first.url.includes('youtube')));
    const firstYtId = first && first.url ? (first.url.match(/youtube\.com.*v=([^&]+)|youtu\.be\/([^?]+)/) || []) : [];
    const firstYtVideoId = firstYtId[1] || firstYtId[2] || null;
    let playerHTML = '';
    if (firstIsMP4) {
      playerHTML = `<video id="spotlightPlayer" controls style="width:100%;height:100%;display:block;background:#000;object-fit:contain" ${first.thumb?`poster="${first.thumb}"`:''}><source src="${first.url}" type="video/mp4"></video>`;
    } else if (firstYtVideoId) {
      playerHTML = `<iframe id="spotlightPlayer" src="https://www.youtube.com/embed/${firstYtVideoId}?rel=0" style="width:100%;height:100%;border:none;display:block" allowfullscreen allow="autoplay; encrypted-media"></iframe>`;
    }
    const thumbsHTML = visibleVideos.map((v, i) => {
      const th = v.thumb || getYouTubeThumb(v.url);
      return `<div class="videos-spotlight-thumb${i===0?' active':''}" onclick="spotlightSelect(${i})" id="spotthumb_${i}">
        ${th ? `<img src="${th}" alt="${v.title}" loading="lazy">` : `<div style="width:100%;aspect-ratio:16/9;background:var(--dark-4);display:flex;align-items:center;justify-content:center;color:var(--gray);font-size:1.5rem">▶</div>`}
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)" class="video-play" style="width:1.8rem;height:1.8rem;font-size:0.8rem">▶</div>
        <div class="spot-title">${v.title}</div>
      </div>`;
    }).join('');
    videosHTML = `<div class="videos-spotlight-player">${playerHTML}</div><div class="videos-spotlight-grid">${thumbsHTML}</div>`;
  } else {
    if (hasCategories) {
      Object.entries(groupedVideos).forEach(([cat, vids]) => {
        videosHTML += `<div style="margin-bottom:3rem"><div style="font-family:var(--font-mono);font-size:0.65rem;letter-spacing:0.25em;text-transform:uppercase;color:var(--gold);margin-bottom:1.25rem;display:flex;align-items:center;gap:1rem">${cat}<span style="flex:1;height:1px;background:linear-gradient(to right,rgba(201,168,76,0.2),transparent);max-width:200px;display:inline-block"></span></div><div class="videos-grid">${vids.map(v => buildVideoCard(v, v._origIdx)).join('')}</div></div>`;
      });
      if (uncategorized.length) {
        videosHTML += `<div class="videos-grid">${uncategorized.map(v => buildVideoCard(v, v._origIdx)).join('')}</div>`;
      }
    } else {
      videosHTML = `<div class="videos-grid">${visibleVideos.map((v,i) => buildVideoCard(v, i)).join('')}</div>`;
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

  function makePreviewBtn(a, i) {
    return '<button onclick="openAssetRequest()" style="display:inline-flex;align-items:center;gap:0.4rem;font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;border:1px solid rgba(201,168,76,0.5);background:rgba(201,168,76,0.08);color:var(--gold);padding:0.45rem 0.9rem;transition:all 0.2s;white-space:nowrap" onmouseover="this.style.background=\'rgba(201,168,76,0.18)\'" onmouseout="this.style.background=\'rgba(201,168,76,0.08)\'">👁 Preview</button>';
  }

  function makeAccessBtn(a, i) {
    if (assetsLocked) return '<button onclick="openAssetRequest()" style="display:inline-flex;align-items:center;gap:0.4rem;font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;border:1px solid rgba(201,168,76,0.35);background:none;color:var(--white);padding:0.45rem 0.9rem;transition:all 0.2s;white-space:nowrap" onmouseover="this.style.borderColor=\'rgba(201,168,76,0.8)\'" onmouseout="this.style.borderColor=\'rgba(201,168,76,0.35)\'">🔒 Request Access</button>';
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
  const categoryLabels = { live:'Live Performances', studio:'Studio Sessions', features:'Features / Collabs', touring:'Touring', hosting:'Hosting / MC', ar:'A&R Consulting', creative:'Creative Direction', media:'Media / Press' };
  const availBadge = bookingAvailability ? `<div style="display:inline-block;font-family:var(--font-mono);font-size:0.6rem;letter-spacing:0.12em;background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.2);color:var(--gold);padding:0.4rem 1rem;margin-bottom:1.5rem">${availabilityLabels[bookingAvailability]||''}</div>` : '';
  const regionBadge = bookingRegion ? `<div style="font-family:var(--font-mono);font-size:0.55rem;color:var(--gray);letter-spacing:0.1em;margin-bottom:1rem">📍 ${bookingRegion}</div>` : '';
  const catBadges = bookingCategories.length ? `<div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-bottom:2rem">${bookingCategories.map(c => `<span style="font-family:var(--font-mono);font-size:0.5rem;letter-spacing:0.1em;text-transform:uppercase;border:1px solid rgba(201,168,76,0.2);color:var(--gray);padding:0.25rem 0.6rem">${categoryLabels[c]||c}</span>`).join('')}</div>` : '';

  document.getElementById('epkContent').innerHTML = `
    <!-- HERO -->
    <div class="hero">
      <div class="hero-image-panel">${heroImgHTML}</div>
      <div class="hero-content">
        <p class="hero-eyebrow">PorfolioID — Professional Identity Platform</p>
        <h1 class="hero-name">${firstName}<br><em>${lastName}</em></h1>
        ${taglinesHTML ? `<p class="hero-tagline">${taglinesHTML}</p>` : ''}
        <div class="hero-ctas">
          ${epk.bookingEnabled !== false ? `<a href="#booking" class="btn-secondary">Book Now →</a>` : ""}
          <button onclick="openShareModal()" class="btn-secondary" style="display:inline-flex;align-items:center;gap:0.5rem">⬛ Share Portfolio</button>
        </div>
        ${statsHTML ? `<div class="hero-stats">${statsHTML}</div>` : ''}
        ${(() => {
          const ib = epk.identityBlock || {};
          let blocks = '';

          // Availability Badges
          if (ib.availabilityEnabled && ib.availabilityBadges?.length) {
            blocks += `<div class="identity-block"><div class="identity-block-label">Availability</div><div class="identity-tags">${ib.availabilityBadges.map(b=>`<span class="identity-tag">${b}</span>`).join('')}</div></div>`;
          }
          // Industry Roles
          if (ib.rolesEnabled && ib.industryRoles?.length) {
            blocks += `<div class="identity-block"><div class="identity-block-label">Industry Roles</div><div class="identity-tags">${ib.industryRoles.map(r=>`<span class="identity-tag">${r}</span>`).join('')}</div></div>`;
          }
          // Featured Credit
          if (ib.featuredEnabled && ib.featuredCreditIdx !== '' && epk.credits?.[ib.featuredCreditIdx]) {
            const fc = epk.credits[ib.featuredCreditIdx];
            blocks += `<div class="identity-block"><div class="identity-block-label">Featured Credit</div><div class="identity-featured-credit"><span class="identity-featured-artist">${fc.company || fc.artist}</span><span class="identity-featured-role">${fc.role}${fc.years ? ' · ' + fc.years : ''}</span></div></div>`;
          }
          // Verification
          if (ib.verifiedEnabled && ib.verificationStatus) {
            blocks += `<div class="identity-block"><div class="identity-block-label">Verification</div><div class="identity-verified">✦ ${ib.verificationStatus}</div></div>`;
          }
          // Languages
          if (ib.languagesEnabled && ib.languages?.length) {
            blocks += `<div class="identity-block"><div class="identity-block-label">Languages</div><div class="identity-langs">${ib.languages.join(' · ')}</div></div>`;
          }
          // Representation
          if (ib.repEnabled && ib.repName) {
            blocks += `<div class="identity-block"><div class="identity-block-label">Representation</div><div class="identity-rep"><span class="identity-rep-name">${ib.repName}</span>${ib.repRole ? `<span class="identity-rep-role">${ib.repRole}</span>` : ''}${ib.repContact ? `<span class="identity-rep-contact">${ib.repContact}</span>` : ''}</div></div>`;
          }
          // Timeline
          if (ib.timelineEnabled && ib.timeline?.length) {
            const items = ib.timeline.map(m=>`<div class="timeline-item"><span class="timeline-year">${m.year}</span><span class="timeline-milestone">${m.milestone}</span></div>`).join('');
            blocks += `<div class="identity-block"><div class="identity-block-label">Career Timeline</div><div class="identity-timeline">${items}</div></div>`;
          }
          return blocks ? `<div class="identity-blocks">${blocks}</div>` : '';
        })()}
      </div>
    </div>

    <!-- CAREER PROFILE (Bio + Resume unified) -->
    <section class="career-profile-section" id="bio">
      <div class="career-profile-inner">
        <div class="section-label">Career Profile</div>
        <h2 class="section-title" data-editable data-editable-key="careerTitle" data-editable-type="title" style="outline:none">Professional <em>Identity</em></h2>
        ${careerProfileHTML}
      </div>
    </section>
    <div class="divider"></div>


    <!-- CREDITS -->
    ${epk.credits?.length ? `
    <div class="credits-section" id="credits">
      <div class="credits-inner">
        <div class="section-label">Credits & Collaborations</div>
        <h2 class="section-title" data-editable data-editable-key="creditsTitle" data-editable-type="title" style="outline:none">The Record</h2>
        <div class="credits-grid" id="creditsGrid">${creditsHTML}</div>
        ${visibleCredits.length > 4 ? `
        <div style="text-align:center;margin-top:2rem">
          <button onclick="toggleAllCredits()" id="creditsToggleBtn" style="font-family:var(--font-mono);font-size:0.6rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--gold);background:none;border:1px solid rgba(201,168,76,0.3);padding:0.6rem 1.5rem;cursor:pointer;transition:all 0.2s">View All ${visibleCredits.length} Credits +</button>
        </div>` : ''}
      </div>
    </div>` : ''}

    <!-- PHOTOS — moved before music for claim→proof sequence — Credits=Claim, Photos=Proof -->
    ${epk.photos?.length ? `
    <div class="gallery-section" id="photos">
      <div class="gallery-inner">
        <div class="section-label">Photos</div>
        <h2 class="section-title" data-editable data-editable-key="photosTitle" data-editable-type="title" style="outline:none">On Stage & Behind the Scenes</h2>
        <div id="galleryContent"></div>
      </div>
    </div>` : ''}

    <!-- VIDEOS -->
    ${visibleVideos.length ? `
    <section id="videos">
      <div class="section-label">Video</div>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:0">
        <h2 class="section-title" data-editable data-editable-key="videoTitle" data-editable-type="title" style="outline:none;margin-bottom:0">Live & On Camera</h2>
        ${visibleVideos.length > 3 ? `<button onclick="toggleAllVideos()" id="videoToggleBtn" style="font-family:var(--font-mono);font-size:0.6rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--gold);background:none;border:1px solid rgba(201,168,76,0.3);padding:0.4rem 0.9rem;cursor:pointer;margin-bottom:1.5rem;transition:all 0.2s">View All Videos +</button>` : ''}
      </div>
      <div id="videosFeatured">${(videoLayout === 'spotlight' || videoLayout === 'cinematic' || videoLayout === 'list' || visibleVideos.length <= 3) ? videosHTML : `<div class="videos-grid">${visibleVideos.slice(0,3).map((v,i) => buildVideoCard(v,i)).join("")}</div>`}</div>
      ${(videoLayout !== 'spotlight' && videoLayout !== 'cinematic' && videoLayout !== 'list' && visibleVideos.length > 3) ? `<div id="videosAll" style="display:none">${videosHTML}</div>` : ''}
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

    <!-- CONNECT -->
    <div class="collapsible-section" id="connect">
      <div class="collapsible-header" onclick="toggleSection('connectBody', this)">
        <div class="collapsible-header-left">
          <div class="collapsible-icon">◎</div>
          <div>
            <div class="collapsible-header-label">Connect</div>
            <div class="collapsible-header-title">Find Me Online</div>
            <div class="collapsible-header-meta">Social & music platforms</div>
          </div>
        </div>
        <div class="collapsible-toggle"><span class="toggle-label">Expand</span> ＋</div>
      </div>
      <div class="collapsible-body" id="connectBody">
        <div class="collapsible-body-inner">
          ${connectSectionHTML}
        </div>
      </div>
    </div>

    <!-- BOOKING -->
    ${epk.bookingEnabled !== false ? `<div class="booking-section" id="booking">
      <div class="booking-inner">
        <div class="section-label">Booking</div>
        <h2 class="booking-title">Let's Create Something <em>Unforgettable</em></h2>
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
            <label style="font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gray);display:block;margin-bottom:0.4rem">Booking Type</label>
            <select name="booking-type"
              style="width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(201,168,76,0.2);color:var(--white);padding:0.75rem;font-family:var(--font-body);font-size:0.9rem;outline:none;appearance:none">
              <option value="">— Select Type —</option>
              <option value="Live Performance">Live Performance</option>
              <option value="Studio Session">Studio Session</option>
              <option value="Feature / Collab">Feature / Collab</option>
              <option value="Touring">Touring</option>
              <option value="Hosting / MC">Hosting / MC</option>
              <option value="A&R Consulting">A&R Consulting</option>
              <option value="Creative Direction">Creative Direction</option>
              <option value="Media / Press">Media / Press</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div style="margin-bottom:1.5rem">
            <label style="font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gray);display:block;margin-bottom:0.4rem">Message</label>
            <textarea name="message" required rows="4" placeholder="Tell me about your project, event date, and any other details..."
              style="width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(201,168,76,0.2);color:var(--white);padding:0.75rem;font-family:var(--font-body);font-size:0.9rem;outline:none;resize:vertical;box-sizing:border-box"
              onfocus="this.style.borderColor='rgba(201,168,76,0.5)'" onblur="this.style.borderColor='rgba(201,168,76,0.2)'"></textarea>
          </div>
          <button type="submit" class="btn-primary" style="width:100%;justify-content:center">✉ Send Booking Inquiry</button>
          <div id="bookingSuccess" style="display:none;margin-top:1rem;font-family:var(--font-mono);font-size:0.65rem;letter-spacing:0.12em;color:var(--gold);text-align:center;padding:1rem;border:1px solid rgba(201,168,76,0.2)">
            ✓ Your inquiry has been sent. We'll be in touch soon.
          </div>
        </form>
        ${bookingPhone ? `<p style="font-family:var(--font-mono);font-size:0.6rem;color:var(--gray);margin-top:1.5rem">Prefer to call? <a href="tel:${bookingPhone}" style="color:var(--gold)">${bookingPhone}</a></p>` : ''}
      </div>
    </div>` : '<div id="booking" style="display:none"></div>'}
  `;

  // Apply section order and visibility from epk data
  applySectionOrderAndVisibility(epk);

  // Build photo gallery if photos exist
  if (epk.photos?.length) buildGallery(epk.photos);
}

let currentGalleryLayout = 'marquee'; // overridden by epk.galleryLayout
let galleryPhotos = [];

function setGalleryLayout(layout) {
  currentGalleryLayout = layout;
  const activeStyle = 'font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.1em;text-transform:uppercase;padding:0.35rem 0.75rem;border:1px solid rgba(201,168,76,0.4);background:rgba(201,168,76,0.1);color:var(--gold);cursor:pointer;transition:all 0.2s';
  const inactiveStyle = 'font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.1em;text-transform:uppercase;padding:0.35rem 0.75rem;border:1px solid rgba(255,255,255,0.1);background:none;color:var(--gray);cursor:pointer;transition:all 0.2s';
  ['btnMarquee','btnScroll','btnWall','btnCollections','btnGrid','btnMagazine','btnTimeline','btnTable'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.style.cssText = inactiveStyle;
  });
  const active = document.getElementById('btn' + layout.charAt(0).toUpperCase() + layout.slice(1));
  if (active) active.style.cssText = activeStyle;
  buildGallery(galleryPhotos);
}

function buildMarqueeGallery(photos, container) {
  const wrap = document.createElement('div');
  wrap.className = 'gallery-marquee-wrap';
  const track = document.createElement('div');
  track.className = 'gallery-marquee';
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
  const wall = document.createElement('div');
  wall.className = 'gallery-wall';
  photos.forEach(photo => {
    const pos = photo.position || 'center 0%';
    const item = document.createElement('div');
    item.className = 'gallery-wall-item';
    item.innerHTML = `<img src="${photo.url}" alt="${photo.caption || ''}" loading="lazy" onerror="this.style.display='none'" style="object-position:${pos}"><div class="gallery-wall-caption">${photo.caption || ''}</div>`;
    item.onclick = () => openLightbox(photo.url);
    wall.appendChild(item);
  });
  container.appendChild(wall);
}

function buildScrollGallery(photos, container) {
  const wrap = document.createElement('div');
  wrap.className = 'gallery-scroll-wrap';
  const arrows = document.createElement('div');
  arrows.className = 'gallery-scroll-arrows';
  arrows.innerHTML = '<button class="gallery-scroll-arrow" id="scrollPrev">&#8249;</button><button class="gallery-scroll-arrow" id="scrollNext">&#8250;</button>';
  const strip = document.createElement('div');
  strip.className = 'gallery-scroll';
  strip.id = 'galleryScroll';
  photos.forEach(photo => {
    const pos = photo.position || 'center 0%';
    const item = document.createElement('div');
    item.className = 'gallery-scroll-item';
    item.innerHTML = `<img src="${photo.url}" alt="${photo.caption || ''}" loading="lazy" onclick="openLightbox('${photo.url}')" onerror="this.style.display='none'" style="object-position:${pos}"><div class="gallery-scroll-caption">${photo.caption || ''}</div>`;
    strip.appendChild(item);
  });
  // Drag to scroll
  let isDown = false, startX, scrollLeft;
  strip.addEventListener('mousedown', e => { isDown = true; startX = e.pageX - strip.offsetLeft; scrollLeft = strip.scrollLeft; });
  strip.addEventListener('mouseleave', () => isDown = false);
  strip.addEventListener('mouseup', () => isDown = false);
  strip.addEventListener('mousemove', e => { if (!isDown) return; e.preventDefault(); const x = e.pageX - strip.offsetLeft; strip.scrollLeft = scrollLeft - (x - startX) * 1.5; });
  document.getElementById('scrollPrev') && document.getElementById('scrollPrev').addEventListener('click', () => strip.scrollBy({left:-320,behavior:'smooth'}));
  document.getElementById('scrollNext') && document.getElementById('scrollNext').addEventListener('click', () => strip.scrollBy({left:320,behavior:'smooth'}));
  wrap.appendChild(arrows);
  wrap.appendChild(strip);
  container.appendChild(wrap);
}

function buildCollectionsGallery(photos, container) {
  // Group photos by collection field; fallback to single group if none set
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
    // Preview collage: up to 4 photos
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
    const meta = document.createElement('div');
    meta.className = 'gallery-collection-meta';
    meta.innerHTML = `<span class="gallery-collection-name">${name}</span><span class="gallery-collection-count">${gphotos.length} photo${gphotos.length !== 1 ? 's' : ''}</span>`;
    card.appendChild(collage);
    card.appendChild(meta);
    // Click opens a lightbox-style expanded view of this group
    card.onclick = () => {
      let idx = 0;
      function showCollectionLightbox() {
        const existing = document.getElementById('collectionLightbox');
        if (existing) existing.remove();
        const lb = document.createElement('div');
        lb.id = 'collectionLightbox';
        lb.className = 'gallery-collection-lightbox';
        lb.innerHTML = `
          <div class="gallery-collection-lb-inner">
            <button class="gallery-collection-lb-close" onclick="document.getElementById('collectionLightbox').remove()">✕</button>
            <div class="gallery-collection-lb-title">${name}</div>
            <div class="gallery-collection-lb-grid">
              ${gphotos.map((p,i) => `<div class="gallery-collection-lb-item" onclick="openLightbox('${p.url}')">
                <img src="${p.url}" alt="${(p.caption||'').replace(/"/g,"'")}" loading="lazy" style="object-position:${p.position||'center 0%'}" onerror="this.style.display='none'">
                ${p.caption ? `<div class="gallery-collection-lb-cap">${p.caption}</div>` : ''}
              </div>`).join('')}
            </div>
          </div>`;
        document.body.appendChild(lb);
        lb.addEventListener('click', e => { if (e.target === lb) lb.remove(); });
      }
      showCollectionLightbox();
    };
    wrap.appendChild(card);
  });
  container.appendChild(wrap);
}

function buildGridGallery(photos, container) {
  const PAGE_SIZE = 12;
  let page = 0;
  const wrap = document.createElement('div');
  wrap.className = 'gallery-grid-wrap';

  function renderPage() {
    wrap.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'gallery-grid';
    const start = page * PAGE_SIZE;
    photos.slice(start, start + PAGE_SIZE).forEach(photo => {
      const item = document.createElement('div');
      item.className = 'gallery-grid-item';
      const img = document.createElement('img');
      img.src = photo.url;
      img.alt = photo.caption || '';
      img.loading = 'lazy';
      img.style.objectPosition = photo.position || 'center 0%';
      img.onerror = function() { this.style.display = 'none'; };
      if (photo.caption) {
        const cap = document.createElement('div');
        cap.className = 'gallery-grid-caption';
        cap.textContent = photo.caption;
        item.appendChild(img);
        item.appendChild(cap);
      } else {
        item.appendChild(img);
      }
      item.onclick = () => openLightbox(photo.url);
      grid.appendChild(item);
    });
    wrap.appendChild(grid);
    // Pagination
    const totalPages = Math.ceil(photos.length / PAGE_SIZE);
    if (totalPages > 1) {
      const pag = document.createElement('div');
      pag.className = 'gallery-grid-pagination';
      for (let i = 0; i < totalPages; i++) {
        const btn = document.createElement('button');
        btn.textContent = i + 1;
        btn.className = 'gallery-grid-pag-btn' + (i === page ? ' active' : '');
        btn.onclick = () => { page = i; renderPage(); };
        pag.appendChild(btn);
      }
      wrap.appendChild(pag);
    }
  }
  renderPage();
  container.appendChild(wrap);
}

function buildMagazineGallery(photos, container) {
  const wrap = document.createElement('div');
  wrap.className = 'gallery-magazine';
  // First featured photo large, rest in smaller panels
  const featured = photos.find(p => p.featured) || photos[0];
  const rest = photos.filter(p => p !== featured);

  const heroWrap = document.createElement('div');
  heroWrap.className = 'gallery-magazine-hero';
  const heroImg = document.createElement('img');
  heroImg.src = featured.url;
  heroImg.alt = featured.caption || '';
  heroImg.loading = 'lazy';
  heroImg.style.objectPosition = featured.position || 'center 0%';
  heroImg.onerror = function() { this.style.display = 'none'; };
  heroImg.onclick = () => openLightbox(featured.url);
  const heroOverlay = document.createElement('div');
  heroOverlay.className = 'gallery-magazine-hero-overlay';
  const metaParts = [featured.caption, featured.location, featured.year].filter(Boolean);
  heroOverlay.innerHTML = metaParts.map((m, i) => `<span class="${i===0 ? 'gallery-magazine-hero-caption' : 'gallery-magazine-hero-meta'}">${m}</span>`).join('');
  heroWrap.appendChild(heroImg);
  heroWrap.appendChild(heroOverlay);
  wrap.appendChild(heroWrap);

  if (rest.length) {
    const grid = document.createElement('div');
    grid.className = 'gallery-magazine-grid';
    rest.forEach(photo => {
      const item = document.createElement('div');
      item.className = 'gallery-magazine-item';
      const img = document.createElement('img');
      img.src = photo.url;
      img.alt = photo.caption || '';
      img.loading = 'lazy';
      img.style.objectPosition = photo.position || 'center 0%';
      img.onerror = function() { this.style.display = 'none'; };
      img.onclick = () => openLightbox(photo.url);
      item.appendChild(img);
      const metaParts = [photo.caption, photo.location, photo.year].filter(Boolean);
      if (metaParts.length) {
        const cap = document.createElement('div');
        cap.className = 'gallery-magazine-caption';
        cap.textContent = metaParts.join(' · ');
        item.appendChild(cap);
      }
      grid.appendChild(item);
    });
    wrap.appendChild(grid);
  }
  container.appendChild(wrap);
}

function buildTimelineGallery(photos, container) {
  // Group by year; fallback label 'Undated'
  const groups = {};
  photos.forEach(photo => {
    const yr = photo.year ? String(photo.year) : 'Undated';
    if (!groups[yr]) groups[yr] = [];
    groups[yr].push(photo);
  });
  // Sort years descending; 'Undated' last
  const sorted = Object.keys(groups).sort((a, b) => {
    if (a === 'Undated') return 1;
    if (b === 'Undated') return -1;
    return Number(b) - Number(a);
  });
  const wrap = document.createElement('div');
  wrap.className = 'gallery-timeline';
  sorted.forEach(year => {
    const section = document.createElement('div');
    section.className = 'gallery-timeline-year';
    const header = document.createElement('div');
    header.className = 'gallery-timeline-year-header';
    let collapsed = false;
    header.innerHTML = `<span class="gallery-timeline-year-label">${year}</span><span class="gallery-timeline-year-count">${groups[year].length} photo${groups[year].length !== 1 ? 's' : ''}</span><span class="gallery-timeline-toggle">▲</span>`;
    const photoRow = document.createElement('div');
    photoRow.className = 'gallery-timeline-row';
    groups[year].forEach(photo => {
      const item = document.createElement('div');
      item.className = 'gallery-timeline-item';
      const img = document.createElement('img');
      img.src = photo.url;
      img.alt = photo.caption || '';
      img.loading = 'lazy';
      img.style.objectPosition = photo.position || 'center 0%';
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
      header.querySelector('.gallery-timeline-toggle').textContent = collapsed ? '▼' : '▲';
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

function buildGallery(photos) {
  galleryPhotos = photos;
  // Use saved layout preference from dashboard
  if (typeof epk !== 'undefined' && epk.galleryLayout) {
    currentGalleryLayout = epk.galleryLayout;
  }
  const container = document.getElementById('galleryContent');
  if (!container) return;
  container.innerHTML = '';

  if (currentGalleryLayout === 'marquee') {
    buildMarqueeGallery(photos, container);
    return;
  }
  if (currentGalleryLayout === 'wall') {
    buildWallGallery(photos, container);
    return;
  }
  if (currentGalleryLayout === 'scroll') {
    buildScrollGallery(photos, container);
    return;
  }
  if (currentGalleryLayout === 'collections') {
    buildCollectionsGallery(photos, container);
    return;
  }
  if (currentGalleryLayout === 'grid') {
    buildGridGallery(photos, container);
    return;
  }
  if (currentGalleryLayout === 'magazine') {
    buildMagazineGallery(photos, container);
    return;
  }
  if (currentGalleryLayout === 'timeline') {
    buildTimelineGallery(photos, container);
    return;
  }
  if (currentGalleryLayout === 'table') {
    buildTableGallery(photos, container);
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

// Video collapse/expand
function toggleAllVideos() {
  const allDiv = document.getElementById('videosAll');
  const featDiv = document.getElementById('videosFeatured');
  const btn = document.getElementById('videoToggleBtn');
  if (!allDiv) return;
  const isHidden = allDiv.style.display === 'none';
  allDiv.style.display = isHidden ? 'block' : 'none';
  featDiv.style.display = isHidden ? 'none' : 'block';
  btn.textContent = isHidden ? 'Show Less –' : 'View All Videos +';
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
  const DEFAULT_ORDER = ['bio','credits','photos','videos','music','awards','assets','booking'];
  const order = epk.sectionOrder || DEFAULT_ORDER;
  const visibility = epk.sectionVisibility || {};

  // QR mode section override
  const urlParams = new URLSearchParams(window.location.search);
  const qrSections = urlParams.get('sections');
  const qrAllowed = qrSections ? new Set(qrSections.split(',')) : null;

  const container = document.getElementById('epkContent');
  if (!container) return;

  // Hide/show sections based on visibility + QR override
  DEFAULT_ORDER.forEach(id => {
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

  order.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    // Also move any sibling divider that follows this section
    const nextSib = el.nextElementSibling;
    container.appendChild(el);
    if (nextSib && nextSib.classList && nextSib.classList.contains('divider')) {
      container.appendChild(nextSib);
    }
  });
}

// Credits collapse/expand
function toggleAllCredits() {
  const grid = document.getElementById('creditsGrid');
  const btn = document.getElementById('creditsToggleBtn');
  if (!grid || !btn) return;
  const isExpanded = grid.classList.contains('credits-expanded');
  grid.classList.toggle('credits-expanded', !isExpanded);
  const total = grid.querySelectorAll('.credit-card').length;
  btn.textContent = isExpanded ? `View All ${total} Credits +` : 'Show Less –';
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
  if (toggle) toggle.innerHTML = isOpen ? '<span class="toggle-label">Expand</span> ＋' : '<span class="toggle-label">Collapse</span> －';
}

function expandSection(sectionId) {
  // Map section IDs to their body IDs
  const bodyMap = { music:'musicBody', awards:'awardsBody', assets:'assetsBody', booking:'connectBody' };
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
    btn.textContent = '✉ Send Booking Inquiry';
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

// Credit modal
let epkCreditsData = [];
let epkVisibleCredits = [];
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
  // mediaLayout: read from global epk setting (set in dashboard Credits section)
  const mediaLayout = (typeof epk !== 'undefined' && epk.creditMediaLayout) ? epk.creditMediaLayout : 'grid';
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
      unifiedHTML += `<a href="${campaignLink}" target="_blank" style="display:block;margin:0 0 0.5rem;text-decoration:none"><span style="font-family:var(--font-display);font-size:1.5rem;font-weight:700;color:#F5F3EE;letter-spacing:0.01em">View Campaign</span> <span style="font-family:var(--font-display);font-size:1.5rem;font-style:italic;font-weight:700;color:#C9A84C">Portfolio →</span></a>`;
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
  // Update active thumb
  document.querySelectorAll('.videos-spotlight-thumb').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });
  // Update player
  const player = document.querySelector('.videos-spotlight-player');
  if (!player) return;
  const isMP4 = v.url && (v.url.includes('.mp4') || v.url.includes('.mov') || v.url.includes('.webm') || (v.url.includes('cloudinary') && !v.url.includes('youtube')));
  const ytId = v.url ? v.url.match(/youtube\.com.*v=([^&]+)|youtu\.be\/([^?]+)/) : null;
  const ytVideoId = ytId ? (ytId[1] || ytId[2]) : null;
  if (isMP4) {
    player.innerHTML = `<video controls autoplay style="width:100%;height:100%;display:block;background:#000;object-fit:contain" ${v.thumb?`poster="${v.thumb}"`:''}><source src="${v.url}" type="video/mp4"></video>`;
  } else if (ytVideoId) {
    player.innerHTML = `<iframe src="https://www.youtube.com/embed/${ytVideoId}?autoplay=1&rel=0" style="width:100%;height:100%;border:none;display:block" allowfullscreen allow="autoplay; encrypted-media"></iframe>`;
  }
}
