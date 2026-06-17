// ════════════════════════════════════════════════════════════
// PORFOLIOID ARCHIVE SYSTEM — v1
// Reusable, metadata-driven Archive page. Renders any Work from
// epk.works regardless of category (music, books, screenplays,
// writing, and future categories) through the same component set.
// Sections that have no data for a given Work render an elegant
// "not yet documented" placeholder rather than being hidden —
// this keeps the exhibition framework visible and consistent
// across every Archive, even when content is still being added.
// ════════════════════════════════════════════════════════════

function getArchiveParamsFromURL() {
  const params = new URLSearchParams(window.location.search);
  let slug = params.get('slug');
  let work = params.get('work');
  if (slug && work) return { slug, work };
  // Netlify's status-200 rewrite (/archive/:slug/:work -> archive.html?slug=:slug&work=:work) substitutes
  // the query string server-side only — window.location.search still reflects the original clean URL the
  // visitor's browser actually requested. Parse the real values straight out of the pathname instead.
  const match = window.location.pathname.match(/\/archive\/([^\/]+)\/([^\/]+)/);
  if (match) return { slug: decodeURIComponent(match[1]), work: decodeURIComponent(match[2]) };
  return { slug: null, work: null };
}

// Reused from epk.js's status logic so Archive and homepage cards never disagree on a Work's status.
function getWorkStatusArchive(w) {
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

function archiveFormatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function archiveFormatDuration(seconds) {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function archiveEscape(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ── ARCHIVE CONFIGURATION LAYER ──
// This is the single source of truth for what an Archive looks like for a given work type.
// Each entry defines: which sections exist, in what order, and what each is labeled — nothing
// about rendering itself. The render functions below (buildArchiveAbout, buildArchiveTimeline,
// etc.) are written once per section TYPE, not per work type, and are shared across every
// category. Adding a new work type to porfolioID never requires touching the render functions
// or the page-assembly logic — only adding a new entry to ARCHIVE_TYPE_CONFIG below.
//
// Section ids map 1:1 to render functions via ARCHIVE_SECTION_RENDERERS. A work type's config
// lists only the section ids it wants, in the order they should appear; everything else is
// simply absent from that Archive instead of needing to be hidden.
const ARCHIVE_TYPE_CONFIG = {
  music: {
    sections: [
      { id: 'about',      label: 'About the Work' },
      { id: 'story',      label: 'Story Behind the Work' },
      { id: 'timeline',   label: 'Timeline' },
      { id: 'notes',      label: 'Creative Notes' },
      { id: 'manuscript', label: 'Lyrics' },
      { id: 'credits',    label: 'Credits' },
      { id: 'gallery',    label: 'Gallery' },
      { id: 'media',      label: 'Media' },
      { id: 'related',    label: 'Related Works' }
    ]
  },
  books: {
    sections: [
      { id: 'about',      label: 'About the Book' },
      { id: 'story',      label: 'Story Behind the Book' },
      { id: 'timeline',   label: 'Timeline' },
      { id: 'manuscript', label: 'Manuscript' },
      { id: 'notes',      label: 'Notes' },
      { id: 'credits',    label: 'Credits' },
      { id: 'gallery',    label: 'Gallery' },
      { id: 'press',      label: 'Press' },
      { id: 'related',    label: 'Related Works' }
    ]
  },
  screenplays: {
    sections: [
      { id: 'about',      label: 'About the Screenplay' },
      { id: 'story',      label: 'Story Behind the Screenplay' },
      { id: 'timeline',   label: 'Timeline' },
      { id: 'manuscript', label: 'Script' },
      { id: 'notes',      label: 'Creative Notes' },
      { id: 'credits',    label: 'Credits' },
      { id: 'gallery',    label: 'Gallery' },
      { id: 'media',      label: 'Media' },
      { id: 'related',    label: 'Related Works' }
    ]
  },
  blog: {
    sections: [
      { id: 'about',      label: 'About this Post' },
      { id: 'manuscript', label: 'Full Text' },
      { id: 'notes',      label: 'Notes' },
      { id: 'credits',    label: 'Credits' },
      { id: 'related',    label: 'Related Works' }
    ]
  },
  article: {
    sections: [
      { id: 'about',      label: 'About this Article' },
      { id: 'story',      label: 'Story Behind the Article' },
      { id: 'manuscript', label: 'Full Article' },
      { id: 'credits',    label: 'Credits' },
      { id: 'press',      label: 'Press' },
      { id: 'related',    label: 'Related Works' }
    ]
  },
  photography: {
    sections: [
      { id: 'about',      label: 'Artist Statement' },
      { id: 'story',      label: 'Creative Process' },
      { id: 'gallery',    label: 'Gallery' },
      { id: 'equipment',  label: 'Equipment' },
      { id: 'credits',    label: 'Credits' },
      { id: 'related',    label: 'Related Works' }
    ]
  },
  painting: {
    sections: [
      { id: 'about',      label: 'About the Work' },
      { id: 'story',      label: 'Creative Process' },
      { id: 'gallery',    label: 'Gallery' },
      { id: 'notes',      label: 'Creative Notes' },
      { id: 'credits',    label: 'Credits' },
      { id: 'related',    label: 'Related Works' }
    ]
  },
  podcast: {
    sections: [
      { id: 'about',      label: 'About this Episode' },
      { id: 'timeline',   label: 'Timeline' },
      { id: 'media',      label: 'Media' },
      { id: 'notes',      label: 'Notes' },
      { id: 'credits',    label: 'Credits' },
      { id: 'related',    label: 'Related Works' }
    ]
  },
  research: {
    sections: [
      { id: 'about',      label: 'Abstract' },
      { id: 'story',      label: 'Background' },
      { id: 'timeline',   label: 'Timeline' },
      { id: 'manuscript', label: 'Full Paper' },
      { id: 'credits',    label: 'Credits' },
      { id: 'press',      label: 'Press' },
      { id: 'related',    label: 'Related Works' }
    ]
  },
  patent: {
    sections: [
      { id: 'about',      label: 'Overview' },
      { id: 'story',      label: 'Story Behind the Invention' },
      { id: 'timeline',   label: 'Timeline' },
      { id: 'manuscript', label: 'Filing' },
      { id: 'credits',    label: 'Credits' },
      { id: 'related',    label: 'Related Works' }
    ]
  },
  speech: {
    sections: [
      { id: 'about',      label: 'About this Speech' },
      { id: 'story',      label: 'Story Behind the Speech' },
      { id: 'manuscript', label: 'Transcript' },
      { id: 'media',      label: 'Media' },
      { id: 'credits',    label: 'Credits' },
      { id: 'related',    label: 'Related Works' }
    ]
  },
  course: {
    sections: [
      { id: 'about',      label: 'About this Course' },
      { id: 'timeline',   label: 'Timeline' },
      { id: 'notes',      label: 'Creative Notes' },
      { id: 'media',      label: 'Media' },
      { id: 'credits',    label: 'Credits' },
      { id: 'related',    label: 'Related Works' }
    ]
  },
  journal: {
    sections: [
      { id: 'about',      label: 'About this Entry' },
      { id: 'manuscript', label: 'Full Text' },
      { id: 'notes',      label: 'Notes' },
      { id: 'gallery',    label: 'Gallery' },
      { id: 'related',    label: 'Related Works' }
    ]
  }
};
// Any category not explicitly configured falls back to the most general shape rather than
// failing — the Archive should never break simply because a new, not-yet-configured work
// type was added to a Work's data before its section list was defined here.
const ARCHIVE_DEFAULT_CONFIG = {
  sections: [
    { id: 'about',      label: 'About the Work' },
    { id: 'story',      label: 'Story Behind the Work' },
    { id: 'timeline',   label: 'Timeline' },
    { id: 'manuscript', label: 'Manuscript' },
    { id: 'notes',      label: 'Creative Notes' },
    { id: 'credits',    label: 'Credits' },
    { id: 'gallery',    label: 'Gallery' },
    { id: 'media',      label: 'Media' },
    { id: 'related',    label: 'Related Works' }
  ]
};
function archiveTypeConfig(category) {
  return ARCHIVE_TYPE_CONFIG[category] || ARCHIVE_DEFAULT_CONFIG;
}

function archiveEmptyState(message) {
  return `<div class="arc-empty">${archiveEscape(message)}</div>`;
}


function buildArchiveHero(w, epk) {
  const status = getWorkStatusArchive(w);
  const genre = w.music?.genre || '';
  const duration = w.music?.duration ? archiveFormatDuration(w.music.duration) : '';
  const year = (w.releasedDate || w.completedDate || w.startedDate || '').slice(0, 4);
  const audioAsset = (w.assets || []).find(a => a.type === 'audio' && a.role === 'release') || (w.assets || []).find(a => a.type === 'audio');

  return `
  <section class="arc-hero" id="arc-hero">
    <div class="arc-hero-bg" style="background-image:url('${archiveEscape(w.heroImage || '')}')"></div>
    <div class="arc-hero-scrim"></div>
    <div class="arc-hero-content">
      <div class="arc-hero-cover">
        <img src="${archiveEscape(w.heroImage || '')}" alt="${archiveEscape(w.title)}">
      </div>
      <div class="arc-hero-info">
        <span class="arc-hero-eyebrow">${archiveEscape(epk.name || 'Creative Works')}</span>
        <h1 class="arc-hero-title">${archiveEscape(w.title)}</h1>
        ${w.archiveTagline ? `<p class="arc-hero-subtitle">${archiveEscape(w.archiveTagline)}</p>` : ''}
        <div class="arc-hero-meta">
          ${genre ? `<span>${archiveEscape(genre)}</span>` : ''}
          ${year ? `<span>${archiveEscape(year)}</span>` : ''}
          <span class="arc-hero-status">${archiveEscape(status)}</span>
        </div>
        <div class="arc-hero-actions">
          ${audioAsset ? `<button class="arc-hero-play" onclick="archivePlayHeroAudio('${archiveEscape(audioAsset.url)}', this)"><svg viewBox="0 0 24 24" class="arc-play-icon"><path d="M8 5v14l11-7z"/></svg><svg viewBox="0 0 24 24" class="arc-pause-icon" style="display:none"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg><span>Play</span></button>` : ''}
          <button class="arc-hero-share" onclick="archiveShare()">Share</button>
        </div>
      </div>
    </div>
  </section>`;
}

function buildArchiveAbout(w) {
  if (!w.aboutWork && !w.description) {
    return archiveEmptyState('This work\'s overview has not yet been documented.');
  }
  return `<p class="arc-body-text">${archiveEscape(w.aboutWork || w.description)}</p>`;
}

function buildArchiveStory(w) {
  if (!w.storyBehindWork) {
    return archiveEmptyState('The story behind this work has not yet been written.');
  }
  const paragraphs = w.storyBehindWork.split(/\n\s*\n/).filter(p => p.trim());
  return paragraphs.map(p => `<p class="arc-body-text arc-story-p">${archiveEscape(p.trim())}</p>`).join('');
}

function buildArchiveTimeline(w) {
  const milestones = [];
  if (w.startedDate) milestones.push({ date: w.startedDate, title: 'Started', description: null });
  if (w.completedDate) milestones.push({ date: w.completedDate, title: 'Completed', description: null });
  if (w.releasedDate) milestones.push({ date: w.releasedDate, title: 'Released', description: null });
  if (!milestones.length) {
    return archiveEmptyState('A detailed timeline for this work has not yet been documented.');
  }
  milestones.sort((a, b) => new Date(a.date) - new Date(b.date));
  return `
    <div class="arc-timeline">
      ${milestones.map(m => `
        <div class="arc-timeline-item">
          <div class="arc-timeline-dot"></div>
          <div class="arc-timeline-body">
            <div class="arc-timeline-date">${archiveEscape(archiveFormatDate(m.date))}</div>
            <div class="arc-timeline-title">${archiveEscape(m.title)}</div>
            ${m.description ? `<div class="arc-timeline-desc">${archiveEscape(m.description)}</div>` : ''}
          </div>
        </div>`).join('')}
    </div>`;
}

function buildArchiveNotes(w) {
  const parts = [];
  if (w.creativeNotes) parts.push({ label: 'Creative Notes', text: w.creativeNotes });
  if (w.inspiration) parts.push({ label: 'Inspiration', text: w.inspiration });
  if (!parts.length) {
    return archiveEmptyState('Creative notes for this work have not yet been added.');
  }
  return parts.map(p => `
    <div class="arc-notes-block">
      <div class="arc-notes-label">${archiveEscape(p.label)}</div>
      <p class="arc-body-text">${archiveEscape(p.text)}</p>
    </div>`).join('');
}

function buildArchiveManuscript(w, sectionLabel) {
  let text = null;
  if (w.category === 'music') text = w.music?.lyrics;
  else if (w.category === 'books') text = (w.books?.excerpts || []).join('\n\n') || w.books?.synopsis;
  else if (w.category === 'screenplays') text = w.screenplays?.synopsis;
  else if (w.writing?.bodyContent) text = w.writing.bodyContent;
  // Generic fallback: any category can store manuscript-style long text directly on the
  // Work as w.manuscriptText without needing its own dedicated metadata block.
  if (!text) text = w.manuscriptText || null;

  if (!text) {
    return archiveEmptyState(`The ${(sectionLabel || 'manuscript').toLowerCase()} for this work has not yet been added.`);
  }
  const lines = text.split('\n');
  return `<div class="arc-manuscript">${lines.map(l => l.trim() ? `<p>${archiveEscape(l)}</p>` : '<br>').join('')}</div>`;
}

function buildArchiveCredits(w) {
  const credits = w.credits || [];
  if (!credits.length) {
    return archiveEmptyState('Credits for this work have not yet been added.');
  }
  return `
    <div class="arc-credits-grid">
      ${credits.map(c => `
        <div class="arc-credit-item">
          <div class="arc-credit-name">${archiveEscape(c.name)}</div>
          <div class="arc-credit-role">${archiveEscape(c.role || '')}</div>
        </div>`).join('')}
    </div>`;
}

// ── PRESS (coverage, reviews, mentions — used by books, articles, research) ──
function buildArchivePress(w) {
  const items = w.press || [];
  if (!items.length) {
    return archiveEmptyState('No press coverage has been added for this work yet.');
  }
  return `
    <div class="arc-press-list">
      ${items.map(p => `
        <div class="arc-press-item">
          ${p.outlet ? `<div class="arc-press-outlet">${archiveEscape(p.outlet)}</div>` : ''}
          ${p.title ? `<div class="arc-press-title">${archiveEscape(p.title)}</div>` : ''}
          ${p.quote ? `<p class="arc-press-quote">${archiveEscape(p.quote)}</p>` : ''}
          ${p.url ? `<a class="arc-press-link" href="${archiveEscape(p.url)}" target="_blank" rel="noopener">Read more →</a>` : ''}
        </div>`).join('')}
    </div>`;
}

// ── EQUIPMENT (cameras, lenses, instruments, software — used by photography, painting) ──
function buildArchiveEquipment(w) {
  const items = w.equipment || [];
  if (!items.length) {
    return archiveEmptyState('Equipment details have not yet been added for this work.');
  }
  return `
    <div class="arc-equipment-list">
      ${items.map(e => `
        <div class="arc-equipment-item">
          <div class="arc-equipment-name">${archiveEscape(e.name || e)}</div>
          ${e.note ? `<div class="arc-equipment-note">${archiveEscape(e.note)}</div>` : ''}
        </div>`).join('')}
    </div>`;
}

function buildArchiveGallery(w) {
  const items = (w.assets || []).filter(a => a.type === 'image');
  if (!items.length) {
    return archiveEmptyState('No gallery items have been added for this work yet.');
  }
  return `
    <div class="arc-gallery-grid">
      ${items.map(a => `
        <div class="arc-gallery-item" onclick="archiveOpenLightbox('${archiveEscape(a.url)}')">
          <img src="${archiveEscape(a.url)}" alt="${archiveEscape(a.title || w.title)}" loading="lazy">
          ${a.title ? `<div class="arc-gallery-caption">${archiveEscape(a.title)}</div>` : ''}
        </div>`).join('')}
    </div>`;
}

function buildArchiveMedia(w) {
  const items = (w.assets || []).filter(a => a.type === 'audio' || a.type === 'video');
  if (!items.length) {
    return archiveEmptyState('No additional media has been added for this work yet.');
  }
  return `
    <div class="arc-media-list">
      ${items.map(a => `
        <div class="arc-media-item">
          <div class="arc-media-role">${archiveEscape(a.role || a.type)}</div>
          <div class="arc-media-title">${archiveEscape(a.title || w.title)}</div>
          ${a.type === 'audio'
            ? `<audio controls class="arc-media-audio" src="${archiveEscape(a.url)}"></audio>`
            : `<video controls class="arc-media-video" src="${archiveEscape(a.url)}"></video>`}
        </div>`).join('')}
    </div>`;
}

function buildArchiveRelated(w, allWorks, slug) {
  const relatedIds = w.relatedWorkIds || [];
  const related = relatedIds.map(id => allWorks.find(rw => rw.id === id)).filter(Boolean);
  if (!related.length) {
    return archiveEmptyState('No related works have been linked yet.');
  }
  return `
    <div class="arc-related-grid">
      ${related.map(rw => `
        <a class="arc-related-item" href="/archive/${archiveEscape(slug)}/${archiveEscape(rw.id)}">
          <img src="${archiveEscape(rw.heroImage || '')}" alt="${archiveEscape(rw.title)}">
          <div class="arc-related-title">${archiveEscape(rw.title)}</div>
        </a>`).join('')}
    </div>`;
}

function buildArchiveNav(sections) {
  return `
    <nav class="arc-sidenav" id="arcSideNav">
      ${sections.map(s => `<a href="#arc-${s.id}" class="arc-sidenav-link" data-section="${s.id}">${archiveEscape(s.label)}</a>`).join('')}
    </nav>`;
}

// ── Section renderer registry. Maps a section id (as used in ARCHIVE_TYPE_CONFIG) to the
// function that renders its content. This is the only place that needs a new entry when a
// genuinely new SECTION TYPE is introduced — new WORK TYPES never need new renderers, only
// a new entry in ARCHIVE_TYPE_CONFIG choosing which existing renderers to use. ──
const ARCHIVE_SECTION_RENDERERS = {
  about:      function(w) { return buildArchiveAbout(w); },
  story:      function(w) { return buildArchiveStory(w); },
  timeline:   function(w) { return buildArchiveTimeline(w); },
  notes:      function(w) { return buildArchiveNotes(w); },
  manuscript: function(w, label) { return buildArchiveManuscript(w, label); },
  credits:    function(w) { return buildArchiveCredits(w); },
  press:      function(w) { return buildArchivePress(w); },
  equipment:  function(w) { return buildArchiveEquipment(w); },
  gallery:    function(w) { return buildArchiveGallery(w); },
  media:      function(w) { return buildArchiveMedia(w); },
  related:    function(w, label, works, slug) { return buildArchiveRelated(w, works, slug); }
};

function buildArchive(epk, workSlug) {
  const works = epk.works || [];
  const w = works.find(item => item.id === workSlug || item.title === workSlug);
  const container = document.getElementById('archiveContent');

  if (!w) {
    container.innerHTML = `
      <div class="arc-not-found">
        <span class="arc-not-found-eyebrow">Archive</span>
        <h1>This work could not be found</h1>
        <p>It may have been moved, renamed, or is not yet published.</p>
        <a href="/${archiveEscape(epk.slug || '')}">&larr; Return to Profile</a>
      </div>`;
    return;
  }

  // The work's category determines its full section list and ordering via the configuration
  // layer — this is the only place category drives page structure. A category with no explicit
  // entry safely falls back to the general-purpose default shape rather than breaking.
  const config = archiveTypeConfig(w.category);
  const sections = config.sections;

  document.getElementById('pageTitle').textContent = w.title + ' — Archive — PorfolioID';
  const desc = (w.description || w.aboutWork || '').slice(0, 160);
  document.getElementById('pageDesc').setAttribute('content', desc);
  document.getElementById('ogTitle').setAttribute('content', w.title + ' — PorfolioID Archive');
  document.getElementById('ogDesc').setAttribute('content', desc);
  if (w.heroImage) document.getElementById('ogImage').setAttribute('content', w.heroImage);
  document.getElementById('ogUrl').setAttribute('content', window.location.href);
  document.getElementById('twTitle').setAttribute('content', w.title + ' — PorfolioID Archive');
  document.getElementById('twDesc').setAttribute('content', desc);
  if (w.heroImage) document.getElementById('twImage').setAttribute('content', w.heroImage);

  const backLink = document.getElementById('archiveBackLink');
  if (backLink) backLink.href = '/' + (epk.slug || '');

  const sectionsHTML = sections.map(function(s) {
    const renderer = ARCHIVE_SECTION_RENDERERS[s.id];
    const body = renderer ? renderer(w, s.label, works, epk.slug) : archiveEmptyState('This section is not yet available.');
    return `
        <section class="arc-section" id="arc-${s.id}">
          <h2 class="arc-section-title">${archiveEscape(s.label)}</h2>
          ${body}
        </section>`;
  }).join('');

  container.innerHTML = `
    ${buildArchiveHero(w, epk)}
    <div class="arc-layout">
      ${buildArchiveNav(sections)}
      <div class="arc-sections">
        ${sectionsHTML}
      </div>
    </div>`;

  archiveWireSideNavScrollSpy();
}

function archiveWireSideNavScrollSpy() {
  const sections = document.querySelectorAll('.arc-section');
  const links = document.querySelectorAll('.arc-sidenav-link');
  if (!sections.length || !links.length) return;

  const lastSectionId = sections[sections.length - 1].id.replace('arc-', '');
  const setActive = function(id) {
    links.forEach(function(l) { l.classList.toggle('is-active', l.dataset.section === id); });
  };

  const visible = new Map();
  const observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      const id = entry.target.id.replace('arc-', '');
      if (entry.isIntersecting) visible.set(id, entry.boundingClientRect.top);
      else visible.delete(id);
    });
    if (visible.size) {
      // Of all sections currently touching the trigger band, highlight whichever sits highest on screen —
      // this matches reading order even when a short section is sandwiched between two tall ones.
      let topId = null, topY = Infinity;
      visible.forEach(function(y, id) { if (y < topY) { topY = y; topId = id; } });
      setActive(topId);
    }
  }, { rootMargin: '-15% 0px -75% 0px', threshold: 0 });

  sections.forEach(function(s) { observer.observe(s); });

  // Trailing short sections (e.g. Related Works as the final section) can sit below the trigger band
  // forever once the page hits its scroll limit, since nothing remains to push them up into it.
  // Force-activate the last section whenever the user is within a few px of the bottom of the page.
  const checkBottom = function() {
    const atBottom = (window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - 40);
    if (atBottom) setActive(lastSectionId);
  };
  // Scroll listener covers normal user scrolling (wheel, trackpad, touch, drag).
  let bottomCheckTimer = null;
  window.addEventListener('scroll', function() {
    checkBottom();
    clearTimeout(bottomCheckTimer);
    bottomCheckTimer = setTimeout(checkBottom, 120);
  }, { passive: true });

  // A single programmatic scroll jump (e.g. window.scrollTo straight to the bottom) doesn't
  // reliably fire 'scroll' events in every engine. A sentinel observed independently of the
  // section-tracking observer below catches "reached the bottom" regardless of how the user got there.
  const sentinel = document.createElement('div');
  sentinel.style.cssText = 'position:absolute;bottom:0;height:1px;width:1px;pointer-events:none;';
  document.body.appendChild(sentinel);
  const bottomObserver = new IntersectionObserver(function(entries) {
    if (entries[0].isIntersecting) setActive(lastSectionId);
  }, { threshold: 0 });
  bottomObserver.observe(sentinel);
}

let archiveHeroAudio = null;
function archivePlayHeroAudio(url, btn) {
  if (!archiveHeroAudio) {
    archiveHeroAudio = new Audio(url);
    archiveHeroAudio.addEventListener('ended', function() { archiveSetHeroPlayState(btn, false); });
  }
  if (archiveHeroAudio.paused) {
    archiveHeroAudio.play();
    archiveSetHeroPlayState(btn, true);
  } else {
    archiveHeroAudio.pause();
    archiveSetHeroPlayState(btn, false);
  }
}
function archiveSetHeroPlayState(btn, playing) {
  const playIcon = btn.querySelector('.arc-play-icon');
  const pauseIcon = btn.querySelector('.arc-pause-icon');
  const label = btn.querySelector('span');
  if (playIcon) playIcon.style.display = playing ? 'none' : 'block';
  if (pauseIcon) pauseIcon.style.display = playing ? 'block' : 'none';
  if (label) label.textContent = playing ? 'Pause' : 'Play';
}

function archiveShare() {
  if (navigator.share) {
    navigator.share({ title: document.title, url: window.location.href }).catch(function() {});
  } else {
    navigator.clipboard.writeText(window.location.href);
    alert('Link copied to clipboard');
  }
}

function archiveOpenLightbox(url) {
  let overlay = document.getElementById('arcLightbox');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'arcLightbox';
    overlay.className = 'arc-lightbox';
    overlay.innerHTML = '<img id="arcLightboxImg" src="">';
    overlay.addEventListener('click', function() { overlay.classList.remove('is-visible'); });
    document.body.appendChild(overlay);
  }
  document.getElementById('arcLightboxImg').src = url;
  overlay.classList.add('is-visible');
}

function toggleArchiveLang(lang) {
  const en = document.getElementById('archiveLangEN');
  const es = document.getElementById('archiveLangES');
  if (en) en.classList.toggle('is-active-lang', lang === 'en');
  if (es) es.classList.toggle('is-active-lang', lang === 'es');
  const backLink = document.getElementById('archiveBackLink');
  if (backLink) backLink.textContent = lang === 'es' ? '← Volver al Perfil' : '← Back to Profile';
}

const archiveParams = getArchiveParamsFromURL();
if (archiveParams.slug && archiveParams.work) {
  fetch('/api/epk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'load', slug: archiveParams.slug })
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (data.success && data.epk) {
      try {
        buildArchive(data.epk, archiveParams.work);
      } catch (err) {
        document.getElementById('archiveContent').innerHTML = '<div class="arc-not-found"><h1>Something went wrong</h1><p>' + archiveEscape(err.message) + '</p></div>';
      }
    } else {
      document.getElementById('archiveContent').innerHTML = '<div class="arc-not-found"><h1>Profile not found</h1></div>';
    }
  })
  .catch(function() {
    document.getElementById('archiveContent').innerHTML = '<div class="arc-not-found"><h1>Unable to load this Archive</h1></div>';
  });
} else {
  document.getElementById('archiveContent').innerHTML = '<div class="arc-not-found"><h1>Missing profile or work reference</h1></div>';
}
