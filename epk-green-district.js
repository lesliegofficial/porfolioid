/* porfolioID — Green District runtime
   Theme-only DOM composition. Never mutates saved profile data.
   Golden and Blue Zone are untouched because every action is gated by
   document.documentElement.dataset.theme === 'district'.
*/
(function () {
  const LABELS = {
    'career-highlights': 'Career Record',
    bio: 'Biography',
    documents: 'Profile & Documents',
    credits: 'Credits',
    photos: 'Photos',
    videos: 'Video',
    music: 'Music',
    works: 'Works',
    awards: 'Recognition',
    assets: 'Assets',
    connect: 'Connect'
  };

  const SECTION_IDS = Object.keys(LABELS);
  let railObserver = null;
  let refreshTimer = null;

  function isDistrict() {
    return document.documentElement.dataset.theme === 'district';
  }

  function epkData() {
    return window._epkData || window.epk || null;
  }

  function safeUrl(value) {
    if (!value || typeof value !== 'string') return '';
    const v = value.trim();
    if (!v) return '';
    try {
      const u = new URL(v, window.location.origin);
      if (!['http:', 'https:'].includes(u.protocol)) return '';
      return u.href;
    } catch (_) {
      return '';
    }
  }

  function escapeAttr(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function visible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  function formatNum(n) {
    return String(n).padStart(2, '0');
  }

  function stripHtml(value) {
    const div = document.createElement('div');
    div.innerHTML = value || '';
    return (div.textContent || div.innerText || '').trim();
  }

  function firstResumeUrl(epk) {
    const cards = Array.isArray(epk?.resumeCards) ? epk.resumeCards : [];
    for (const card of cards) {
      const url = safeUrl(card?.pdfUrl || card?.resumeUrl || card?.url);
      if (url) return url;
    }
    return '';
  }

  function applyImageFrame(img, src, position, zoom, fit, origin) {
    if (!img || !src) return;
    img.src = src;
    const pos = Number.isFinite(Number(position)) ? Number(position) : 0;
    const scale = Number.isFinite(Number(zoom)) ? Number(zoom) : 100;
    img.style.objectPosition = `center ${pos}%`;
    img.style.objectFit = fit || 'cover';
    img.style.transform = scale !== 100 ? `scale(${scale / 100})` : '';
    img.style.transformOrigin = origin || 'center center';
  }

  function setupHero(epk) {
    const hero = document.querySelector('#epkContent .hero');
    const content = hero?.querySelector('.hero-content');
    if (!hero || !content) return;

    hero.id = 'profile';

    // Green District uses the dashboard's full-body/feature image in the hero,
    // while the biography section receives the saved profile portrait.
    const heroImg = hero.querySelector('.hero-img');
    if (epk.heroImage && heroImg) {
      applyImageFrame(
        heroImg,
        epk.heroImage,
        epk.heroImagePosition,
        epk.heroImageZoom,
        epk.heroImageFit || 'contain',
        'center center'
      );
    }

    const biographyPortrait = document.querySelector('#bio .career-portrait');
    if (epk.bioImage && biographyPortrait) {
      applyImageFrame(
        biographyPortrait,
        epk.bioImage,
        epk.bioImagePosition,
        epk.bioImageZoom,
        epk.bioImageFit || 'cover',
        'center center'
      );
    }

    if (!content.querySelector('.gd-hero-kicker')) {
      const kicker = document.createElement('div');
      kicker.className = 'gd-hero-kicker';
      kicker.textContent = '01 / CAREER PROFILE';
      content.prepend(kicker);
    }

    // Replace the legacy Leslie-specific hero copy with this profile's actual
    // saved biography text. No generated or inferred facts enter the theme.
    const heroBio = content.querySelector('.hero-bio');
    if (heroBio) {
      const actualBio = stripHtml(epk.shortBio || epk.bio || epk.bioFull || '');
      heroBio.innerHTML = '';
      if (actualBio) {
        const p = document.createElement('p');
        p.textContent = actualBio;
        heroBio.appendChild(p);
      } else {
        heroBio.style.display = 'none';
      }
    }

    if (!content.querySelector('.gd-hero-actions')) {
      const actions = document.createElement('div');
      actions.className = 'gd-hero-actions';

      const explore = document.createElement('a');
      explore.className = 'gd-cta gd-cta-primary';
      explore.href = '#career-highlights';
      explore.dataset.greenExplore = 'true';
      explore.innerHTML = 'Explore My Work <span aria-hidden="true">→</span>';
      explore.addEventListener('click', function (event) {
        const target = document.querySelector(this.getAttribute('href'));
        if (!target) return;
        event.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      actions.appendChild(explore);

      const resumeUrl = firstResumeUrl(epk);
      if (resumeUrl) {
        const resume = document.createElement('a');
        resume.className = 'gd-cta gd-cta-secondary';
        resume.href = resumeUrl;
        resume.target = '_blank';
        resume.rel = 'noopener';
        resume.innerHTML = 'Download Resume <span aria-hidden="true">⇩</span>';
        actions.appendChild(resume);
      }

      content.appendChild(actions);
    }

    const imagePanel = hero.querySelector('.hero-image-panel');
    if (imagePanel && !imagePanel.querySelector('.gd-hero-aside')) {
      const tags = Array.isArray(epk.taglines)
        ? epk.taglines.map(stripHtml).filter(Boolean).slice(0, 4)
        : [];
      if (tags.length) {
        const aside = document.createElement('div');
        aside.className = 'gd-hero-aside';
        tags.forEach(tag => {
          const span = document.createElement('span');
          span.textContent = tag;
          aside.appendChild(span);
        });
        imagePanel.appendChild(aside);
      }
    }
  }

  function setupCareerRecord() {
    const section = document.getElementById('career-highlights');
    if (!section) return;
    // Green District revision: all six Career Record cards carry equal visual
    // weight. No featured tile and no compressed Founder strip.
    const cards = Array.from(section.querySelectorAll('.ch3-card'));
    cards.forEach(card => {
      card.classList.remove('gd-featured', 'gd-support', 'gd-founder');
      card.classList.add('gd-even');
    });
  }

  function setupBioDocuments(epk) {
    const bio = document.getElementById('bio');
    const documents = document.getElementById('documents');
    if (!bio || !documents || documents.dataset.greenBioMerged === 'true') return;

    const visibility = epk.dashboardSectionVisibility || epk.sectionVisibility || {};
    const combinedVisible = visibility.bio !== false || visibility.documents !== false;
    if (!combinedVisible) {
      bio.style.display = 'none';
      documents.style.display = 'none';
      return;
    }

    const bioWrap = bio.querySelector('.ch3-wrap');
    const documentsWrap = documents.querySelector('.ch3-wrap');
    const bioPanel = bioWrap?.querySelector('.career-stacked-bio, .career-sidebyside');
    const documentsHeader = documentsWrap?.querySelector('.ch3-header');
    if (!bioPanel || !documentsWrap) return;

    documents.dataset.greenBioMerged = 'true';
    documents.classList.add('gd-profile-documents');
    documents.style.display = '';

    if (documentsHeader) {
      const label = documentsHeader.querySelector('.ch3-label');
      const title = documentsHeader.querySelector('.section-title');
      if (label) label.textContent = 'Professional Profile';
      if (title) title.textContent = 'Biography & Professional Documents';
    }

    const cards = documentsWrap.querySelector('.career-stacked-cards');
    const suite = document.createElement('div');
    suite.className = 'gd-profile-suite';

    const merged = document.createElement('div');
    merged.className = 'gd-bio-documents-profile';
    merged.appendChild(bioPanel);
    suite.appendChild(merged);

    if (cards) suite.appendChild(cards);

    if (documentsHeader) {
      documentsHeader.insertAdjacentElement('afterend', suite);
    } else {
      documentsWrap.prepend(suite);
    }

    const bioToggle = merged.querySelector('#bioToggleBtn');
    const bioFull = merged.querySelector('#bioFull');
    if (bioToggle) {
      const syncBioButton = () => {
        const expanded = bioFull && bioFull.style.display !== 'none';
        bioToggle.textContent = expanded ? 'Close Biography ↑' : 'Read Full Biography →';
        bioToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      };
      syncBioButton();
      bioToggle.addEventListener('click', () => requestAnimationFrame(syncBioButton));
    }

    bio.style.display = 'none';
    const bioDivider = bio.nextElementSibling;
    if (bioDivider?.classList.contains('divider')) bioDivider.style.display = 'none';
  }

  function setupVideo() {
    const featured = document.getElementById('videosFeatured');
    const all = document.getElementById('videosAll');
    if (!featured || featured.dataset.greenDistrictBuilt === 'true') return;

    // The public renderer keeps the saved Spotlight composition inside
    // #videosAll whenever there are more than three videos. Move that exact
    // rendered composition into the visible stage so Green District uses
    // the owner's real video titles/thumbnails rather than creating stand-ins.
    if (all && all.children.length && all.querySelector('.video-hero')) {
      featured.innerHTML = '';
      while (all.firstChild) featured.appendChild(all.firstChild);
      all.style.display = 'none';
    }

    featured.dataset.greenDistrictBuilt = 'true';
    document.getElementById('videoToggleBtn')?.remove();
    if (typeof window.initVideoCarousels === 'function') {
      try { window.initVideoCarousels(); } catch (_) {}
    }
  }

  function setupAwards() {
    const awards = document.getElementById('awards');
    const body = document.getElementById('awardsBody');
    if (!awards || !body) return;
    // Restore the platform's normal reveal-on-demand behavior.
    body.classList.remove('open');
    body.style.removeProperty('max-height');
    body.style.removeProperty('opacity');
    body.style.removeProperty('overflow');
    const label = awards.querySelector('.toggle-label');
    if (label) label.textContent = 'Expand';
  }

  function firstSocialUrl(socials, key) {
    const value = socials?.[key];
    if (Array.isArray(value)) {
      for (const v of value) {
        const url = safeUrl(typeof v === 'object' ? v?.url : v);
        if (url) return url;
      }
      return '';
    }
    if (typeof value === 'object' && value) return safeUrl(value.url);
    return safeUrl(value);
  }

  function setupConnect(epk) {
    const connect = document.getElementById('connect');
    if (!connect) return;

    const visibility = epk.dashboardSectionVisibility || epk.sectionVisibility || {};
    if (visibility.connect === false) {
      connect.style.display = 'none';
      return;
    }

    // Green District treats Connect as a real closing district rather than a
    // hero-only reveal panel.
    connect.style.display = '';

    if (connect.querySelector('.gd-connect-summary')) return;

    const summary = document.createElement('div');
    summary.className = 'gd-connect-summary';

    const eyebrow = document.createElement('div');
    eyebrow.className = 'gd-connect-eyebrow';
    eyebrow.textContent = 'Connect';
    summary.appendChild(eyebrow);

    const title = document.createElement('h2');
    title.className = 'gd-connect-title';
    title.textContent = "Let's build what's next.";
    summary.appendChild(title);

    const sourceCopy = stripHtml(epk.bookingTagline || epk.shortBio || '');
    if (sourceCopy) {
      const copy = document.createElement('p');
      copy.className = 'gd-connect-copy';
      copy.textContent = sourceCopy;
      summary.appendChild(copy);
    }

    const actions = document.createElement('div');
    actions.className = 'gd-connect-actions';

    const socialDefs = [
      ['instagram', 'IG'],
      ['youtube', 'YT'],
      ['spotify', '♪'],
      ['linkedin', 'in'],
      ['website', '↗']
    ];
    const socials = epk.socials || {};
    socialDefs.forEach(([key, label]) => {
      const url = firstSocialUrl(socials, key);
      if (!url) return;
      const a = document.createElement('a');
      a.className = 'gd-social-link';
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.title = key;
      a.textContent = label;
      actions.appendChild(a);
    });

    const hub = connect.querySelector('.connect-hub');
    if (hub) {
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'gd-more-links';
      more.title = 'More links';
      more.textContent = '+';
      more.addEventListener('click', () => {
        connect.classList.toggle('gd-links-open');
        more.textContent = connect.classList.contains('gd-links-open') ? '−' : '+';
      });
      actions.appendChild(more);
    }

    if (epk.bookingEnabled !== false) {
      const inquiry = document.createElement('button');
      inquiry.type = 'button';
      inquiry.className = 'gd-inquiry-btn';
      inquiry.textContent = epk.bookingLabel ? `Send ${epk.bookingLabel} →` : 'Send an Inquiry →';
      inquiry.addEventListener('click', () => {
        if (typeof window.openInquiryModal === 'function') window.openInquiryModal();
      });
      actions.appendChild(inquiry);
    }

    summary.appendChild(actions);
    connect.insertBefore(summary, connect.firstChild);
  }

  function sectionList() {
    return SECTION_IDS
      .map(id => document.getElementById(id))
      .filter(el => el && visible(el))
      .sort((a, b) => {
        if (a === b) return 0;
        const relation = a.compareDocumentPosition(b);
        return relation & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
      });
  }

  function ensureNumberLabel(el, number, label) {
    if (!el) return;
    let host = null;
    if (el.id === 'career-highlights') host = el.querySelector('.ch3-wrap');
    else if (el.id === 'photos') host = el.querySelector('.gallery-inner');
    else if (el.id === 'videos') host = el.querySelector('.video-shell');
    else if (el.id === 'works') host = el.querySelector('.works-wrap');
    else host = el;

    if (!host) return;
    let marker = host.querySelector(':scope > .gd-number-label');
    if (!marker) {
      marker = document.createElement('div');
      marker.className = 'gd-number-label';
      host.insertBefore(marker, host.firstChild);
    }
    marker.textContent = `${formatNum(number)} / ${String(label || '').toUpperCase()}`;
  }

  function rebuildTopNav(entries) {
    const nav = document.getElementById('navLinks');
    if (!nav) return;
    nav.innerHTML = '';

    const all = [{ id: 'profile', label: 'Profile', num: 1 }, ...entries];
    all.forEach(item => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `#${item.id}`;
      a.dataset.greenNav = item.id;
      a.innerHTML = `<span class="gd-nav-num">${formatNum(item.num)}</span><span>${escapeAttr(item.label)}</span>`;
      a.addEventListener('click', event => {
        const target = document.getElementById(item.id) || document.querySelector(item.id === 'profile' ? '.hero' : `#${item.id}`);
        if (!target) return;
        event.preventDefault();
        if (typeof window.expandSection === 'function' && item.id !== 'profile') {
          try { window.expandSection(item.id); } catch (_) {}
        }
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      li.appendChild(a);
      nav.appendChild(li);
    });
  }

  function buildRail(entries) {
    document.querySelector('.gd-rail')?.remove();

    const rail = document.createElement('aside');
    rail.className = 'gd-rail';
    rail.setAttribute('aria-label', 'Portfolio sections');
    const inner = document.createElement('div');
    inner.className = 'gd-rail-inner';

    const all = [{ id: 'profile', label: 'Profile', num: 1 }, ...entries];
    all.forEach(item => {
      const link = document.createElement('a');
      link.className = 'gd-rail-link';
      link.href = `#${item.id}`;
      link.dataset.greenRail = item.id;
      link.innerHTML = `<span class="gd-rail-number">${formatNum(item.num)}</span><span class="gd-rail-label">${escapeAttr(item.label)}</span>`;
      link.addEventListener('click', event => {
        const target = document.getElementById(item.id) || document.querySelector(item.id === 'profile' ? '.hero' : `#${item.id}`);
        if (!target) return;
        event.preventDefault();
        if (typeof window.expandSection === 'function' && item.id !== 'profile') {
          try { window.expandSection(item.id); } catch (_) {}
        }
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      inner.appendChild(link);
    });

    rail.appendChild(inner);
    document.body.appendChild(rail);
  }

  function activate(id) {
    document.querySelectorAll('[data-green-rail]').forEach(el => {
      el.classList.toggle('gd-active', el.dataset.greenRail === id);
    });
    document.querySelectorAll('[data-green-nav]').forEach(el => {
      el.classList.toggle('gd-nav-active', el.dataset.greenNav === id);
    });
  }

  function observeSections(entries) {
    if (railObserver) railObserver.disconnect();
    const targets = [
      { id: 'profile', el: document.querySelector('.hero') },
      ...entries.map(item => ({ id: item.id, el: document.getElementById(item.id) }))
    ].filter(item => item.el);

    railObserver = new IntersectionObserver(records => {
      const candidates = records
        .filter(r => r.isIntersecting)
        .sort((a, b) => Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top));
      if (!candidates.length) return;
      const match = targets.find(item => item.el === candidates[0].target);
      if (match) activate(match.id);
    }, { rootMargin: '-18% 0px -68% 0px', threshold: [0, .01, .15] });

    targets.forEach(item => railObserver.observe(item.el));
  }

  function refreshNumbering() {
    if (!isDistrict()) return;
    const sections = sectionList();
    const entries = sections.map((el, index) => {
      const num = index + 2;
      const label = LABELS[el.id] || el.id;
      ensureNumberLabel(el, num, label);
      return { id: el.id, label, num };
    });

    rebuildTopNav(entries);
    buildRail(entries);
    observeSections(entries);

    const explore = document.querySelector('[data-green-explore]');
    if (explore) {
      const first = entries[0];
      explore.href = first ? `#${first.id}` : '#profile';
    }

    activate('profile');
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refreshNumbering, 90);
  }

  function initialize() {
    if (!isDistrict()) return false;
    const epk = epkData();
    const hero = document.querySelector('#epkContent .hero');
    if (!epk || !hero) return false;

    setupHero(epk);
    setupCareerRecord();
    setupBioDocuments(epk);
    setupVideo();
    setupAwards();
    setupConnect(epk);
    refreshNumbering();

    // Reveal-on-demand sections can alter which districts are on-screen.
    // Re-number from actual DOM visibility after those interactions.
    document.addEventListener('click', event => {
      if (!isDistrict()) return;
      if (event.target.closest(
        '#viewCompleteRecordBtn, .ch3-card, .collapsible-header, .gd-more-links, [onclick*="expandSection"]'
      )) scheduleRefresh();
    }, true);

    const content = document.getElementById('epkContent');
    if (content && !content.dataset.greenDistrictObserved) {
      content.dataset.greenDistrictObserved = 'true';
      const observer = new MutationObserver(() => scheduleRefresh());
      observer.observe(content, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['style', 'class']
      });
    }

    window.refreshGreenDistrict = refreshNumbering;
    return true;
  }

  function waitForProfile() {
    if (initialize()) return;
    const target = document.getElementById('epkContent') || document.body;
    const observer = new MutationObserver(() => {
      if (initialize()) observer.disconnect();
    });
    observer.observe(target, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 12000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForProfile, { once: true });
  } else {
    waitForProfile();
  }
})();
