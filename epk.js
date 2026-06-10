
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
    { id: 'connect', label: 'Connect' },
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
    amazon: 'https://res.cloudinary.com/djj8xe3gx/image/upload/x_234,y_211,w_541,h_551,c_crop,e_make_transparent:10,f_png/icons/amazon-icon-white.jpg',
    tiktok: 'https://res.cloudinary.com/djj8xe3gx/image/upload/c_trim,e_make_transparent:10,f_png/icons/tiktok-icon-white.jpg',
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
        <p class="ch-hero-sub">Explore my official platforms, music channels, social media profiles, and booking information.</p>
        <div class="ch-hero-btns">
          <a href="#booking" class="ch-btn-gold">Booking &amp; Contact →</a>
          <a href="#booking" class="ch-btn-outline">
            <svg viewBox="0 0 24 24" style="fill:currentColor;width:13px;height:13px"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/></svg>
            Save to Contacts
          </a>
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
    const url = isBooking ? '#booking' : getFirstUrl(val);
    if (!url && !isBooking) return '';
    const color = platformColors[key] || '#C9A84C';
    const cat = catOverride || platformCat[key] || '';
    const name = nameOverride || labels[key] || key;
    const desc = descOverride || platformDesc[key] || '';
    const cta = featuredCTA[key] || 'Visit';
    const imgIcon = platformImg[key];
    return `<a href="${url}" class="ch-pcard" target="${isBooking?'_self':'_blank'}" rel="noopener">
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
          <span class="ch-pcard-name">${w.title || 'PortfolioID'}</span>
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
    buildPrimaryCard('booking','Booking','Booking & Contact','Work With Me'),
  ].filter(Boolean).join('');

  // ── AMAZON — secondary wide banner ──
  const amazonBannerHTML = amazonUrl ? `
    <a href="${amazonUrl}" class="ch-amazon-banner" target="_blank" rel="noopener">
      <span class="ch-amazon-icon">
        <img src="https://res.cloudinary.com/djj8xe3gx/image/upload/x_234,y_211,w_541,h_551,c_crop,e_make_transparent:10,f_png/icons/amazon-icon-white.jpg" style="width:100%;height:100%;object-fit:cover" alt="amazon">
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
    <!-- HERO v2 — 3 column -->
    <div class="hero">
      <div class="hero-image-panel">${heroImgHTML}</div>
      <div class="hero-content">
        <h1 class="hero-name">${firstName}<br><em>${lastName}</em></h1>
        ${taglinesHTML ? `<p class="hero-tagline">${taglinesHTML}</p>` : ''}
        <div class="hero-rule"></div>
        <div class="hero-intro">
          <p>With more than 25 years in the music industry, Leslie A. Guerra bridges the stage, the studio, and the business side of entertainment.</p>
          <p>Her career spans live performance, recording, artist development, operations, marketing, and digital portfolio innovation across multiple industries and continents.</p>
          <p>Explore her verified credits, projects, performances, and professional journey below.</p>
        </div>
        <div class="hero-ctas">
          <a href="#credits" onclick="expandSection('credits')" class="btn-primary" style="display:inline-flex;align-items:center;gap:0.75rem">
            <svg viewBox="0 0 24 24" style="fill:currentColor;width:14px;height:14px;flex-shrink:0"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
            Explore The Record
          </a>
          <a href="#connect" onclick="expandSection('connect')" class="btn-secondary">Connect →</a>
        </div>
      </div>
      <div class="hero-stats-col">
        ${(epk.stats||[]).filter(s=>s.number).length ? (epk.stats||[]).filter(s=>s.number).map(s=>`
        <div class="hero-stat-card">
          <div class="hero-stat-icon">${s.icon||'◎'}</div>
          <div><span class="hero-stat-number">${s.number}</span><span class="hero-stat-label">${s.label}</span></div>
        </div>`).join('') : `
        <div class="hero-stat-card"><div class="hero-stat-icon"><svg viewBox="0 0 24 24" style="fill:var(--gold);width:16px;height:16px"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></div><div><span class="hero-stat-number">25+</span><span class="hero-stat-label">Years Active</span></div></div>
        <div class="hero-stat-card"><div class="hero-stat-icon"><svg viewBox="0 0 24 24" style="fill:var(--gold);width:16px;height:16px"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg></div><div><span class="hero-stat-number">500+</span><span class="hero-stat-label">Live Shows</span></div></div>
        <div class="hero-stat-card"><div class="hero-stat-icon"><svg viewBox="0 0 24 24" style="fill:var(--gold);width:16px;height:16px"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg></div><div><span class="hero-stat-number">5</span><span class="hero-stat-label">Continents</span></div></div>
        <div class="hero-stat-card"><div class="hero-stat-icon"><svg viewBox="0 0 24 24" style="fill:var(--gold);width:16px;height:16px"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/></svg></div><div><span class="hero-stat-number">Multiple</span><span class="hero-stat-label">Genres &amp; Industries</span></div></div>`}
      </div>
    </div>

    <!-- CAREER HIGHLIGHTS -->
    <section class="career-profile-section" id="bio">
      <div class="ch-highlights-wrap">
        <div class="ch-highlights-header">
          <span class="ch-highlights-label">Career Highlights</span>
          <a href="#credits" onclick="expandSection('credits')" class="ch-highlights-viewall">View All Credits →</a>
        </div>
        <div class="ch-highlights-grid">
          <div class="ch-hl-card" onclick="expandSection('credits')">
            <div class="ch-hl-bg" style="background-image:url('https://res.cloudinary.com/djj8xe3gx/image/upload/v1778442969/gpdkrnybqxokkubhutqq.jpg')"></div>
            <div class="ch-hl-overlay"></div>
            <div class="ch-hl-icon"><svg viewBox="0 0 24 24" style="fill:#C9A84C;width:14px;height:14px"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg></div>
            <div class="ch-hl-body"><h3 class="ch-hl-title">Live Performance</h3><p class="ch-hl-desc">Exclusive touring vocalist for Don Omar, J Álvarez, and Melina León — hundreds of performances across five continents.</p><span class="ch-hl-link">View Credits →</span></div>
          </div>
          <div class="ch-hl-card" onclick="expandSection('credits')">
            <div class="ch-hl-bg" style="background-image:url('https://res.cloudinary.com/djj8xe3gx/image/upload/v1778190019/kz1ti0u2tqqvqmxhhvzr.jpg')"></div>
            <div class="ch-hl-overlay"></div>
            <div class="ch-hl-icon"><svg viewBox="0 0 24 24" style="fill:#C9A84C;width:14px;height:14px"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg></div>
            <div class="ch-hl-body"><h3 class="ch-hl-title">Recording Artist</h3><p class="ch-hl-desc">Recording artist with Las Nenas del Swing. Original compositions and live concert recordings across multiple releases.</p><span class="ch-hl-link">View Credits →</span></div>
          </div>
          <div class="ch-hl-card" onclick="expandSection('credits')">
            <div class="ch-hl-bg" style="background-image:url('https://res.cloudinary.com/djj8xe3gx/image/upload/v1778629124/ekfdjyawqz9m3ixwz37d.png')"></div>
            <div class="ch-hl-overlay"></div>
            <div class="ch-hl-icon"><svg viewBox="0 0 24 24" style="fill:#C9A84C;width:14px;height:14px"><path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/></svg></div>
            <div class="ch-hl-body"><h3 class="ch-hl-title">Creative Professional</h3><p class="ch-hl-desc">A&amp;R Coordinator at Sony Music Latin and Urban Latino Music. Artist development, release coordination, and creative operations.</p><span class="ch-hl-link">View Credits →</span></div>
          </div>
          <div class="ch-hl-card" onclick="expandSection('credits')">
            <div class="ch-hl-bg" style="background-image:url('https://res.cloudinary.com/djj8xe3gx/image/upload/v1780095510/leslie_concert_blue.jpg')"></div>
            <div class="ch-hl-overlay"></div>
            <div class="ch-hl-icon"><svg viewBox="0 0 24 24" style="fill:#C9A84C;width:14px;height:14px"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg></div>
            <div class="ch-hl-body"><h3 class="ch-hl-title">Marketing &amp; PR</h3><p class="ch-hl-desc">Marketing &amp; Content Coordinator at NV Marketing &amp; PR. Digital campaigns, publicity support, and content strategy for major Latin artists.</p><span class="ch-hl-link">View Credits →</span></div>
          </div>
          <div class="ch-hl-card" onclick="expandSection('credits')">
            <div class="ch-hl-bg" style="background-image:url('https://res.cloudinary.com/djj8xe3gx/image/upload/v1778613766/ewm8lcxopo7ybkkts7mk.jpg')"></div>
            <div class="ch-hl-overlay"></div>
            <div class="ch-hl-icon"><svg viewBox="0 0 24 24" style="fill:#C9A84C;width:14px;height:14px"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/></svg></div>
            <div class="ch-hl-body"><h3 class="ch-hl-title">Industry Operations</h3><p class="ch-hl-desc">Artist Logistics &amp; Event Coordination for Adam Torres Concerts. Artist support and operations at Arrow Management. Head of Compliance at Venetian Productions.</p><span class="ch-hl-link">View Credits →</span></div>
          </div>
          <div class="ch-hl-card" onclick="expandSection('credits')">
            <div class="ch-hl-bg" style="background-image:url('https://res.cloudinary.com/djj8xe3gx/image/upload/v1778611958/belq6epfwatfxki2ujyt.jpg')"></div>
            <div class="ch-hl-overlay"></div>
            <div class="ch-hl-icon"><svg viewBox="0 0 24 24" style="fill:#C9A84C;width:14px;height:14px"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg></div>
            <div class="ch-hl-body"><h3 class="ch-hl-title">Collaborations</h3><p class="ch-hl-desc">On stage with Don Omar at King of Kings, Viña del Mar Festival, and Sinfónico. Shared the stage with Natti Natasha, J Álvarez, Luis Fonsi, and more.</p><span class="ch-hl-link">View Credits →</span></div>
          </div>
        </div>
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
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:1rem;margin-bottom:0.5rem">
          <div>
            <h2 class="section-title" data-editable data-editable-key="photosTitle" data-editable-type="title" style="outline:none;margin-bottom:0.25rem">On Stage & Behind the Scenes</h2>
            <p style="font-family:var(--font-body);font-size:0.9rem;color:var(--gray);margin:0 0 1rem">Explore moments from performances, studio sessions, press events, and more.</p>
          </div>
          <div style="display:flex;gap:0.75rem;align-items:center;flex-shrink:0">
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
            <div class="collapsible-header-title">My Digital Presence</div>
            <div class="collapsible-header-meta">Social Platforms &bull; Music &bull; Video &bull; Recommendations &bull; Booking</div>
            <div class="ch-preview-icons">
              <span class="ch-preview-dot" style="background:#E1306C" title="Instagram"></span>
              <span class="ch-preview-dot" style="background:#1DB954" title="Spotify"></span>
              <span class="ch-preview-dot" style="background:#FF0000" title="YouTube"></span>
              <span class="ch-preview-dot" style="background:#232F3E" title="Amazon"></span>
              <span class="ch-preview-dot" style="background:#C9A84C" title="Booking"></span>
            </div>
          </div>
        </div>
        <div class="collapsible-toggle"><span class="toggle-label">Explore</span> →</div>
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
  // Sync the dropdown
  const sel = document.getElementById('galleryLayoutSelect');
  if (sel) sel.value = layout;
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

function buildGridGallery(photos, container) {
  let PAGE_SIZE = 20;
  let page = 0;
  const wrap = document.createElement('div');
  wrap.className = 'gallery-grid-wrap';

  function renderPage() {
    wrap.innerHTML = '';
    const start = page * PAGE_SIZE;
    const end = Math.min(start + PAGE_SIZE, photos.length);

    const grid = document.createElement('div');
    grid.className = 'gallery-grid';
    photos.slice(start, end).forEach(photo => {
      const item = document.createElement('div');
      item.className = 'gallery-grid-item';
      const img = document.createElement('img');
      img.src = photo.url;
      img.alt = photo.caption || '';
      img.loading = 'lazy';
      img.style.objectPosition = (photo.position && photo.position !== 'center') ? photo.position : 'center top';
      img.onerror = function() { this.style.display = 'none'; };
      item.appendChild(img);
      if (photo.caption) {
        const cap = document.createElement('div');
        cap.className = 'gallery-grid-caption';
        cap.textContent = photo.caption;
        item.appendChild(cap);
      }
      item.onclick = () => openLightbox(photo.url);
      grid.appendChild(item);
    });
    wrap.appendChild(grid);

    // Pagination bar
    const totalPages = Math.ceil(photos.length / PAGE_SIZE);
    const pagBar = document.createElement('div');
    pagBar.className = 'gallery-grid-pagbar';

    // Count label
    const countLabel = document.createElement('div');
    countLabel.className = 'gallery-grid-count';
    countLabel.textContent = `Showing ${start + 1} to ${end} of ${photos.length} photos`;
    pagBar.appendChild(countLabel);

    // Page buttons
    const pagBtns = document.createElement('div');
    pagBtns.className = 'gallery-grid-pagination';
    if (totalPages > 1) {
      // Prev
      const prev = document.createElement('button');
      prev.innerHTML = '&#8249;';
      prev.className = 'gallery-grid-pag-btn' + (page === 0 ? ' disabled' : '');
      prev.disabled = page === 0;
      prev.onclick = () => { if (page > 0) { page--; renderPage(); } };
      pagBtns.appendChild(prev);

      // Page numbers with ellipsis
      const pageNums = [];
      if (totalPages <= 7) {
        for (let i = 0; i < totalPages; i++) pageNums.push(i);
      } else {
        pageNums.push(0);
        if (page > 2) pageNums.push('...');
        for (let i = Math.max(1, page-1); i <= Math.min(totalPages-2, page+1); i++) pageNums.push(i);
        if (page < totalPages - 3) pageNums.push('...');
        pageNums.push(totalPages - 1);
      }
      pageNums.forEach(n => {
        if (n === '...') {
          const ell = document.createElement('span');
          ell.textContent = '...';
          ell.style.cssText = 'font-family:var(--font-mono);font-size:0.6rem;color:var(--gray);padding:0 0.25rem';
          pagBtns.appendChild(ell);
        } else {
          const btn = document.createElement('button');
          btn.textContent = n + 1;
          btn.className = 'gallery-grid-pag-btn' + (n === page ? ' active' : '');
          btn.onclick = () => { page = n; renderPage(); };
          pagBtns.appendChild(btn);
        }
      });

      // Next
      const next = document.createElement('button');
      next.innerHTML = '&#8250;';
      next.className = 'gallery-grid-pag-btn' + (page === totalPages - 1 ? ' disabled' : '');
      next.disabled = page === totalPages - 1;
      next.onclick = () => { if (page < totalPages - 1) { page++; renderPage(); } };
      pagBtns.appendChild(next);
    }
    pagBar.appendChild(pagBtns);

    // Photos per page selector
    const perPageWrap = document.createElement('div');
    perPageWrap.className = 'gallery-grid-perpage';
    perPageWrap.innerHTML = `<span style="font-family:var(--font-mono);font-size:0.55rem;color:var(--gray);letter-spacing:0.05em">Photos per page:</span>
      <select onchange="this.closest('.gallery-grid-wrap') && (arguments[0].target.closest('.gallery-grid-wrap'))" style="background:var(--dark-3);border:1px solid rgba(201,168,76,0.2);color:var(--text);font-family:var(--font-mono);font-size:0.55rem;padding:0.2rem 0.4rem;cursor:pointer;outline:none">
        <option value="12" ${PAGE_SIZE===12?'selected':''}>12</option>
        <option value="20" ${PAGE_SIZE===20?'selected':''}>20</option>
        <option value="40" ${PAGE_SIZE===40?'selected':''}>40</option>
      </select>`;
    perPageWrap.querySelector('select').onchange = e => {
      PAGE_SIZE = parseInt(e.target.value);
      page = 0;
      renderPage();
    };
    pagBar.appendChild(perPageWrap);
    wrap.appendChild(pagBar);
  }
  renderPage();
  container.appendChild(wrap);
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
  // Layouts that use category bar
  const showBar = ['collections','grid','magazine','timeline','wall'].includes(currentGalleryLayout);
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
  if (typeof epk !== 'undefined' && epk.galleryLayout) {
    currentGalleryLayout = epk.galleryLayout;
  }
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
  const DEFAULT_ORDER = ['connect','bio','credits','photos','videos','music','awards','assets','booking'];
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

  let anchor = hero;
  order.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const nextSib = el.nextElementSibling;
    anchor.insertAdjacentElement('afterend', el);
    anchor = el;
    if (nextSib && nextSib.classList && nextSib.classList.contains('divider')) {
      anchor.insertAdjacentElement('afterend', nextSib);
      anchor = nextSib;
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
  const isConnect = bodyId === 'connectBody';
  if (toggle) toggle.innerHTML = isOpen
    ? (isConnect ? '<span class="toggle-label">Explore</span> →' : '<span class="toggle-label">Expand</span> ＋')
    : '<span class="toggle-label">Collapse</span> －';
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
