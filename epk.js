
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
  const nameParts = (epk.name || 'Artist Name').split(' ');
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' ');

  // Build nav
  const navLinks = document.getElementById('navLinks');
  navLinks.innerHTML = '';
  const sections = [
    { id: 'bio', label: 'Biography' },
    { id: 'credits', label: 'Credits' },
    { id: 'photos', label: 'Photos' },
    { id: 'music', label: 'Music' },
    { id: 'videos', label: 'Video' },
    { id: 'assets', label: 'Assets' },
    { id: 'booking', label: 'Booking' },
  ];
  sections.forEach(s => {
    navLinks.innerHTML += `<li><a href="#${s.id}">${s.label}</a></li>`;
  });

  document.getElementById('footerLogo').textContent = `${epk.name} — EPK 2025`;
  document.title = `${epk.name} — Electronic Press Kit`;

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

  const buildConnectLinks = (keys, s) => keys.flatMap(k => {
    const val = s[k];
    if (!val) return [];
    const urls = Array.isArray(val) ? val.filter(Boolean) : (val ? [val] : []);
    if (!urls.length) return [];
    return urls.map((url, i) => {
      const domain = (() => { try { return new URL(url).hostname.replace('www.',''); } catch { return ''; } })();
      const labelSuffix = urls.length > 1 ? ` <span style="font-size:0.55rem;opacity:0.6">${i+1}</span>` : '';
      return `<a href="${url}" class="connect-link" target="_blank" rel="noopener">${svgIcons[k]}<span class="connect-link-label">${labels[k]}${labelSuffix}</span><span class="connect-link-url">${domain}</span></a>`;
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

  const heroImgHTML = epk.heroImage
    ? `<img class="hero-img" src="${epk.heroImage}" alt="${epk.name}" onerror="this.parentElement.innerHTML='<div class=hero-placeholder><div class=hero-placeholder-icon>🎤</div></div>'">`
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

  const bioParagraphs = (epk.bio || '').split('\n').filter(p => p.trim()).map(p => `<p style="margin-bottom:1.5em">${p}</p>`).join('');

  // Sort: pinned first, filter hidden
  const visibleCredits = (epk.credits || [])
    .map((c, i) => ({...c, _origIdx: i}))
    .filter(c => c.visible !== false)
    .sort((a, b) => (b.pinned?1:0) - (a.pinned?1:0));
  epkVisibleCredits = visibleCredits;

  const creditsHTML = visibleCredits.map((c, i) => {
    const origI = c._origIdx;
    const hasPhotos = c.photos && c.photos.length > 0;
    const hasDetail = c.fullDesc || hasPhotos || c.mediaLink || c.videoUrl;
    const categoryBadge = c.category ? `<span style="font-family:var(--font-mono);font-size:0.5rem;letter-spacing:0.1em;text-transform:uppercase;background:rgba(201,168,76,0.08);color:var(--gray);padding:0.15rem 0.5rem;margin-right:0.4rem">${c.category}</span>` : '';
    const verifiedBadge = c.verified ? `<span style="font-family:var(--font-mono);font-size:0.5rem;letter-spacing:0.1em;text-transform:uppercase;background:rgba(100,200,100,0.1);color:#7ec97e;padding:0.15rem 0.5rem">✦ VERIFIED</span>` : '';
    const pinnedBadge = c.pinned ? `<span style="font-family:var(--font-mono);font-size:0.5rem;letter-spacing:0.1em;text-transform:uppercase;background:rgba(201,168,76,0.12);color:var(--gold);padding:0.15rem 0.5rem">📌 FEATURED</span>` : '';
    const badgesRow = (categoryBadge || verifiedBadge || pinnedBadge) ? `<div style="margin-bottom:0.5rem;display:flex;gap:0.3rem;flex-wrap:wrap">${pinnedBadge}${verifiedBadge}${categoryBadge}</div>` : '';
    const collaboratorsRow = c.collaborators?.length ? `<div style="font-family:var(--font-mono);font-size:0.55rem;color:var(--gray);margin-top:0.3rem;letter-spacing:0.08em">w/ ${c.collaborators.join(', ')}</div>` : '';
    return `
    <div class="credit-card" ${hasDetail ? `onclick="openCreditModal(${i})"` : ''}>
      ${badgesRow}
      <div class="credit-header">
        <div class="credit-artist">${c.artist}</div>
        ${c.years ? `<span class="credit-years">${c.years}</span>` : ''}
      </div>
      <div class="credit-role">${c.role}${c.contractType ? ` · <span style="opacity:0.7">${c.contractType}</span>` : ''}</div>
      ${collaboratorsRow}
      ${c.desc ? `<p class="credit-desc" style="-webkit-line-clamp:2;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden">${c.desc}</p>` : ''}
      ${hasDetail ? `<div class="credit-expand-hint">View Details →</div>` : ''}
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
    const isMP4First = first && first.url && (first.url.includes('.mp4') || first.url.includes('cloudinary'));
    const firstThumb = first && (first.thumb || getYouTubeThumb(first.url));
    const firstMedia = first ? (isMP4First
      ? `<video controls style="width:100%;aspect-ratio:16/9;display:block;background:#000" ${first.thumb?`poster="${first.thumb}"`:''}><source src="${first.url}" type="video/mp4"></video>`
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
  } else {
    // Default grid
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

  const categoryIcons = { 'Resume':'📋', 'Press Kit':'📦', 'Tech Rider':'🎛', 'Stage Plot':'🎭', 'Bio':'📝', 'Photo Pack':'📸', 'Contract Template':'📜', 'Certificate':'🏅', 'Other':'📄' };

  const assetsHTML = (epk.assets || [])
    .filter(a => a.visible !== false)
    .map((a, i) => {
      const icon = categoryIcons[a.category] || '📄';
      const categoryTag = a.category ? `<div style="font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gray);margin-bottom:0.75rem">${a.category}</div>` : '';
      const downloadAttr = a.url ? `onclick="trackAssetDownload(${epk.assets.indexOf(a)})"` : '';
      return `
    <div class="asset-card">
      <div class="asset-icon">${icon}</div>
      ${categoryTag}
      <div class="asset-title">${a.title}</div>
      <p class="asset-desc">${a.desc || ''}</p>
      ${a.url ? `<a href="${a.url}" class="asset-btn" target="_blank" ${downloadAttr}>${a.btnLabel || 'Download →'}</a>` : `<span class="asset-btn" style="opacity:0.4">${a.btnLabel || 'Coming Soon'}</span>`}
    </div>`;
    }).join('');

  const bookingEmail = epk.bookingEmail || '';
  const bookingPhone = epk.bookingPhone || '';
  const bookingTagline = epk.bookingTagline || 'Now booking live performances, studio sessions, and creative collaborations.';
  const bookingNote = epk.bookingNote || 'Serious inquiries only';

  document.getElementById('epkContent').innerHTML = `
    <!-- HERO -->
    <div class="hero">
      <div class="hero-image-panel">${heroImgHTML}</div>
      <div class="hero-content">
        <p class="hero-eyebrow">Electronic Press Kit</p>
        <h1 class="hero-name">${firstName}<br><em>${lastName}</em></h1>
        ${taglinesHTML ? `<p class="hero-tagline">${taglinesHTML}</p>` : ''}
        <div class="hero-ctas">
          ${epk.bookingEnabled !== false ? `<a href="#booking" class="btn-secondary">Book Now →</a>` : ""}
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
            blocks += `<div class="identity-block"><div class="identity-block-label">Featured Credit</div><div class="identity-featured-credit"><span class="identity-featured-artist">${fc.artist}</span><span class="identity-featured-role">${fc.role}${fc.years ? ' · ' + fc.years : ''}</span></div></div>`;
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

    <!-- BIO -->
    ${epk.bio ? `
    <section id="bio">
      <div class="section-label">Biography</div>
      <div class="bio-grid">
        <div class="bio-sidebar">
          ${bioImgHTML}
          ${contactHTML}
          ${credentialsHTML}
        </div>
        <div class="bio-text">${bioParagraphs}</div>
      </div>
    </section>
    <div class="divider"></div>` : ''}

    <!-- CREDITS -->
    ${epk.credits?.length ? `
    <div class="credits-section" id="credits">
      <div class="credits-inner">
        <div class="section-label">Credits & Collaborations</div>
        <h2 class="section-title">The Record</h2>
        <div class="credits-grid">${creditsHTML}</div>
      </div>
    </div>` : ''}

    <!-- PHOTOS — moved before music for claim→proof sequence — Credits=Claim, Photos=Proof -->
    ${epk.photos?.length ? `
    <div class="gallery-section" id="photos">
      <div class="gallery-inner">
        <div class="section-label">Photos</div>
        <h2 class="section-title">On Stage & Behind the Scenes</h2>
        <div id="galleryContent"></div>
      </div>
    </div>` : ''}

    <!-- MUSIC -->
    ${epk.tracks?.length ? `
    <section id="music">
      <div class="section-label">Live Music Tracks</div>
      <h2 class="section-title">On Record</h2>
      <div class="music-tracks">${tracksHTML}</div>
    </section>
    <div class="divider"></div>` : ''}

    <!-- VIDEOS -->
    ${visibleVideos.length ? `
    <section id="videos">
      <div class="section-label">Video</div>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:0">
        <h2 class="section-title" style="margin-bottom:0">Live & On Camera</h2>
        ${visibleVideos.length > 3 ? `<button onclick="toggleAllVideos()" id="videoToggleBtn" style="font-family:var(--font-mono);font-size:0.6rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--gold);background:none;border:1px solid rgba(201,168,76,0.3);padding:0.4rem 0.9rem;cursor:pointer;margin-bottom:1.5rem;transition:all 0.2s">View All Videos +</button>` : ''}
      </div>
      <div id="videosFeatured">${visibleVideos.length <= 3 ? videosHTML : `<div class="videos-grid">${visibleVideos.slice(0,3).map((v,i) => buildVideoCard(v,i)).join("")}</div>`}</div>
      ${visibleVideos.length > 3 ? `<div id="videosAll" style="display:none">${videosHTML}</div>` : ''}
    </section>
    <div class="divider"></div>` : ''}

    <!-- ASSETS -->
    ${epk.assets?.length ? `
    <section id="assets">
      <div class="section-label">Professional Assets</div>
      <h2 class="section-title">Resources</h2>
      <div class="assets-grid">${assetsHTML}</div>
    </section>` : ''}

    <!-- CONNECT -->
    ${connectSectionHTML}

    <!-- BOOKING -->
    ${epk.bookingEnabled !== false ? `<div class="booking-section" id="booking">` : '<div id="booking" style="display:none">'}
      <div class="booking-inner">
        <h2 class="booking-title">Let's Create Something <em>Unforgettable</em></h2>
        <p class="booking-sub">${bookingTagline}</p>
        <p class="booking-note">${bookingNote}</p>
        <div class="booking-ctas">
          ${bookingEmail ? `<a href="mailto:${bookingEmail}" class="btn-primary">✉ Send Booking Inquiry</a>` : ''}
          ${bookingPhone ? `<a href="tel:${bookingPhone}" class="btn-secondary">☎ Call to Discuss</a>` : ''}
        </div>
      </div>
    </div>
  `;

  // Build photo gallery if photos exist
  if (epk.photos?.length) buildGallery(epk.photos);
}

let currentGalleryLayout = 'marquee'; // overridden by epk.galleryLayout
let galleryPhotos = [];

function setGalleryLayout(layout) {
  currentGalleryLayout = layout;
  const activeStyle = 'font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.1em;text-transform:uppercase;padding:0.35rem 0.75rem;border:1px solid rgba(201,168,76,0.4);background:rgba(201,168,76,0.1);color:var(--gold);cursor:pointer;transition:all 0.2s';
  const inactiveStyle = 'font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.1em;text-transform:uppercase;padding:0.35rem 0.75rem;border:1px solid rgba(255,255,255,0.1);background:none;color:var(--gray);cursor:pointer;transition:all 0.2s';
  ['btnMarquee','btnScroll','btnGrid'].forEach(id => {
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
    item.innerHTML = `<img src="${photo.url}" alt="${photo.caption || ''}" loading="lazy" onerror="this.style.display='none'" style="object-position:${pos}"><div class="gallery-marquee-caption">${photo.caption || ''}</div>`;
    const photoIdx = photos.indexOf(photo) % (photos.length / 2);
    item.innerHTML += `<div class="owner-overlay"><button class="owner-action-btn owner-up" onclick="event.stopPropagation();ownerMoveItem('photos',${photoIdx},-1)">▲</button><button class="owner-action-btn owner-down" onclick="event.stopPropagation();ownerMoveItem('photos',${photoIdx},1)">▼</button></div>`;
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
        document.getElementById('epkContent').innerHTML = '<div style="padding:8rem 3rem;text-align:center;font-family:var(--font-mono);color:var(--gray)">EPK not found. <a href="/" style="color:var(--gold)">Return home →</a></div>';
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
function openCreditModal(i) {
  const c = epkVisibleCredits[i];
  if (!c) return;
  const photos = c.photos || [];
  document.getElementById('creditModalArtist').textContent = c.artist;
  document.getElementById('creditModalMeta').textContent = [c.role, c.contractType, c.years].filter(Boolean).join(' · ');
  document.getElementById('creditModalDesc').textContent = c.fullDesc || c.desc || '';

  // Collaborators
  const collabEl = document.getElementById('creditModalCollaborators');
  collabEl.innerHTML = c.collaborators?.length ? `<div style="font-family:var(--font-mono);font-size:0.6rem;letter-spacing:0.1em;color:var(--gray);margin-bottom:1rem">w/ ${c.collaborators.join(', ')}</div>` : '';

  // Media — support multiple items
  const mediaHTML = (() => {
    let html = '';
    // New multi-media system
    const mediaItems = c.mediaItems || [];
    if (mediaItems.length > 0) {
      mediaItems.forEach(m => {
        if (!m.url) return;
        if (m.type === 'video' || m.url.includes('.mp4') || m.url.includes('.mov')) {
          html += `<video controls style="width:100%;aspect-ratio:16/9;display:block;background:#000;object-fit:contain;margin-bottom:1rem" src="${m.url}"></video>`;
        } else {
          const ytId2 = m.url.split('v=')[1]?.split('&')[0] || m.url.split('youtu.be/')[1]?.split('?')[0];
          if (ytId2) {
            html += `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin-bottom:1rem"><iframe src="https://www.youtube.com/embed/${ytId2}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none" allowfullscreen></iframe></div>`;
          } else {
            const label = m.label || 'Watch / Listen →';
            html += `<a href="${m.url}" target="_blank" style="display:inline-flex;align-items:center;gap:0.5rem;font-family:var(--font-mono);font-size:0.65rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--gold);text-decoration:none;border:1px solid rgba(201,168,76,0.3);padding:0.5rem 1rem;margin-bottom:0.75rem;margin-right:0.5rem;transition:all 0.3s" onmouseover="this.style.background='rgba(201,168,76,0.08)'" onmouseout="this.style.background=''">${label}</a>`;
          }
        }
      });
    } else {
      // Legacy single media support
      if (c.videoUrl) {
        html += `<video controls style="width:100%;aspect-ratio:16/9;display:block;background:#000;object-fit:contain;margin-bottom:1rem" src="${c.videoUrl}"></video>`;
      }
      if (c.mediaLink) {
        const ytId2 = c.mediaLink.split('v=')[1]?.split('&')[0] || c.mediaLink.split('youtu.be/')[1]?.split('?')[0];
        if (ytId2) {
          html += `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin-bottom:1rem"><iframe src="https://www.youtube.com/embed/${ytId2}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none" allowfullscreen></iframe></div>`;
        } else {
          const label = c.mediaLabel || 'View Media →';
          html += `<a href="${c.mediaLink}" target="_blank" style="display:inline-flex;align-items:center;gap:0.5rem;font-family:var(--font-mono);font-size:0.65rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--gold);text-decoration:none;border:1px solid rgba(201,168,76,0.3);padding:0.5rem 1rem;margin-bottom:1rem;transition:all 0.3s" onmouseover="this.style.background='rgba(201,168,76,0.08)'" onmouseout="this.style.background=''">${label}</a>`;
        }
      }
    }
    // Proof link
    if (c.proofLink) {
      html += `<div style="margin-top:0.5rem"><a href="${c.proofLink}" target="_blank" style="font-family:var(--font-mono);font-size:0.55rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gray);text-decoration:none;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:1px">✦ View Verification Source →</a></div>`;
    }
    return html;
  })();
  document.getElementById('creditModalMedia').innerHTML = mediaHTML;
  document.getElementById('creditModalPhotos').innerHTML = photos.map(url =>
    `<img class="credit-modal-photo" src="${url}" alt="${c.artist}" loading="lazy" onclick="openLightbox('${url}')" onerror="this.style.display='none'">`
  ).join('');
  document.getElementById('creditModalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeCreditModal() {
  document.getElementById('creditModalOverlay').classList.remove('open');
  document.body.style.overflow = '';
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
