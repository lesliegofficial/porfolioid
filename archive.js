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

// ── LANGUAGE STATE ──
// Tracks the user's selected Archive language for this page view. Defaults to English. Only
// fields that genuinely have real, human-provided Spanish content are ever shown under 'es' —
// archiveLocalize() falls back to the English field whenever the *Es counterpart is missing or
// blank, per the standing rule against displaying invented or placeholder translations.
let archiveCurrentLang = 'en';

// Returns the Spanish value for a field if (and only if) it exists and has real content;
// otherwise falls back to the English value. `esKey` defaults to `${enKey}Es` (the project's
// existing naming convention for translated fields), but can be passed explicitly.
function archiveLocalize(w, enKey, esKey) {
  const englishVal = w[enKey];
  if (archiveCurrentLang !== 'es') return englishVal;
  const key = esKey || (enKey + 'Es');
  const esVal = w[key];
  return (esVal && String(esVal).trim()) ? esVal : englishVal;
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
      { id: 'behindTheLyrics', label: 'Behind the Lyrics' },
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
  const text = archiveLocalize(w, 'aboutWork') || archiveLocalize(w, 'description');
  if (!text) {
    return archiveEmptyState('This work\'s overview has not yet been documented.');
  }
  return `<p class="arc-body-text">${archiveEscape(text)}</p>`;
}

function buildArchiveStory(w, epk) {
  const text = archiveLocalize(w, 'storyBehindWork');
  if (!text) {
    return archiveEmptyState('The story behind this work has not yet been written.');
  }
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
  const body = paragraphs.map(p => `<p class="arc-body-text arc-story-p">${archiveEscape(p.trim())}</p>`).join('');

  // A subtle signature reinforcing this story is told directly by the artist — only shown when
  // we have a real name and a real confirmed completion date; never a placeholder or guessed date.
  const artistName = epk && epk.name;
  const signedDate = w.completedDate ? archiveFormatDate(w.completedDate) : null;
  const signature = (artistName && signedDate) ? `
    <div class="arc-story-signature">
      <div class="arc-story-signature-name">&mdash; ${archiveEscape(artistName)}</div>
      <div class="arc-story-signature-date">${archiveEscape(signedDate)}</div>
    </div>` : '';

  return body + signature;
}

// ── TIMELINE ──
// Two distinct, honest categories, never blended:
// 1) Confirmed milestones — w.timeline entries with a real verified date. These render in the
//    actual chronological Timeline, sorted by date. The two original lifecycle dates (started/
//    completed) are included here as a fallback only if no w.timeline array exists yet, so existing
//    Works never lose their dates during the transition to the richer structure.
// 2) Stages Awaiting Documentation — logical creative-process stages with no verified date yet.
//    These are never sorted into the dated timeline and never given an invented date. They exist
//    purely so the Archive has a ready place to receive real information later, and so a visitor
//    can see the full intended shape of the documented journey even before every stage is filled in.
function archiveTimelineEntries(w) {
  if (Array.isArray(w.timeline) && w.timeline.length) return w.timeline;
  // Fallback for Works that haven't been migrated to the richer w.timeline structure yet —
  // preserves the two original confirmed lifecycle dates exactly as before.
  const fallback = [];
  if (w.startedDate) fallback.push({ date: w.startedDate, title: 'Started' });
  if (w.completedDate) fallback.push({ date: w.completedDate, title: 'Completed' });
  if (w.releasedDate) fallback.push({ date: w.releasedDate, title: 'Released' });
  return fallback;
}

function archiveEvidenceList(m) {
  const items = [];
  if (m.evidence && Array.isArray(m.evidence)) {
    m.evidence.forEach(function(e) { items.push(e); });
  }
  // Convenience singular fields (image/document/audio/video) are folded into the same evidence
  // list at render time, so a milestone author can use whichever is simpler for a given artifact.
  if (m.image) items.push({ type: 'image', url: m.image, label: 'Photo' });
  if (m.document) items.push({ type: 'document', url: m.document, label: 'Document' });
  if (m.audio) items.push({ type: 'audio', url: m.audio, label: 'Audio' });
  if (m.video) items.push({ type: 'video', url: m.video, label: 'Video' });
  return items;
}

function buildArchiveTimelineEvidence(m) {
  const items = archiveEvidenceList(m);
  if (!items.length) return '';
  return `
    <div class="arc-timeline-evidence">
      ${items.map(function(e) {
        if (e.type === 'image') {
          return `<div class="arc-evidence-chip arc-evidence-image" onclick="archiveOpenLightbox('${archiveEscape(e.url)}')"><img src="${archiveEscape(e.url)}" alt="${archiveEscape(e.label || 'Evidence')}" loading="lazy"></div>`;
        }
        const iconLabel = { document: 'Document', audio: 'Audio', video: 'Video' }[e.type] || 'Evidence';
        return `<a class="arc-evidence-chip arc-evidence-file" href="${archiveEscape(e.url)}" target="_blank" rel="noopener">${archiveEscape(e.label || iconLabel)}</a>`;
      }).join('')}
    </div>`;
}

// A milestone is eligible for the dated Timeline if it carries either a real single `date`
// (sorts precisely) or a `dateRange` (a season rather than an event — e.g. "2020–2026" — sorts
// by the range's ENDING year, since the range represents the span after its starting point
// milestone and before its ending point milestone — anchoring to the start year would
// incorrectly sort it before a same-year dated milestone that actually precedes it). Never
// given a fabricated single date just to make sorting easier.
function archiveTimelineSortKey(m) {
  if (m.date) return new Date(m.date).getTime();
  if (m.dateRange) {
    const years = String(m.dateRange).match(/\d{4}/g);
    const endYear = years && years.length ? parseInt(years[years.length - 1], 10) : NaN;
    if (!isNaN(endYear)) return new Date(endYear, 0, 1).getTime();
  }
  return 0;
}

function buildArchiveTimeline(w) {
  const milestones = archiveTimelineEntries(w).filter(function(m) { return !!(m.date || m.dateRange); });
  if (!milestones.length) {
    return archiveEmptyState('A detailed timeline for this work has not yet been documented.');
  }
  milestones.sort(function(a, b) { return archiveTimelineSortKey(a) - archiveTimelineSortKey(b); });
  return `
    <div class="arc-timeline">
      ${milestones.map(function(m) {
        const dateLabel = m.date ? archiveFormatDate(m.date) : m.dateRange;
        return `
        <div class="arc-timeline-item${m.dateRange && !m.date ? ' arc-timeline-item-range' : ''}">
          <div class="arc-timeline-dot"></div>
          <div class="arc-timeline-body">
            <div class="arc-timeline-date">${archiveEscape(dateLabel)}</div>
            <div class="arc-timeline-title">${archiveEscape(m.title)}</div>
            ${m.location ? `<div class="arc-timeline-location">${archiveEscape(m.location)}</div>` : ''}
            ${m.description ? `<div class="arc-timeline-desc">${archiveEscape(m.description)}</div>` : ''}
            ${m.notes ? `<div class="arc-timeline-notes">${archiveEscape(m.notes)}</div>` : ''}
            ${buildArchiveTimelineEvidence(m)}
          </div>
        </div>`;
      }).join('')}
    </div>
    ${buildArchiveStagesAwaitingDocumentation(w)}`;
}

// ── STAGES AWAITING DOCUMENTATION ──
// Logical creative-process stages with no verified date. Rendered as a visually distinct
// subsection beneath the real chronological Timeline — never merged into it, never given a
// fabricated date or description. Each stage is either a placeholder (no real data yet) or,
// once real information is added to w.timelineStages for that stage id, shows what's confirmed
// so far while still living outside the dated Timeline until it has a verified date and is
// promoted into w.timeline directly.
const ARCHIVE_DEFAULT_CREATIVE_STAGES = [
  { id: 'initial-idea', title: 'Initial Idea' },
  { id: 'first-draft',  title: 'First Draft' },
  { id: 'revisions',    title: 'Revisions' },
  { id: 'recording',    title: 'Recording' },
  { id: 'production',   title: 'Production' },
  { id: 'mix',          title: 'Mix' },
  { id: 'master',       title: 'Master' },
  { id: 'cover-design', title: 'Cover Design' },
  { id: 'release',      title: 'Release' }
];
function buildArchiveStagesAwaitingDocumentation(w) {
  const provided = (w.timelineStages && typeof w.timelineStages === 'object') ? w.timelineStages : {};
  const stages = ARCHIVE_DEFAULT_CREATIVE_STAGES.map(function(stage) {
    const data = provided[stage.id] || {};
    return Object.assign({}, stage, data);
  });
  return `
    <div class="arc-stages-awaiting">
      <div class="arc-stages-awaiting-label">Stages Awaiting Documentation</div>
      <div class="arc-stages-awaiting-grid">
        ${stages.map(function(s) {
          const hasContent = !!(s.description || s.notes);
          return `
          <div class="arc-stage-chip ${hasContent ? 'has-content' : ''}">
            <div class="arc-stage-title">${archiveEscape(s.title)}</div>
            ${hasContent
              ? `${s.description ? `<div class="arc-stage-desc">${archiveEscape(s.description)}</div>` : ''}`
              : `<div class="arc-stage-pending">Documentation pending</div>`}
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

function buildArchiveNotes(w) {
  const parts = [];
  const notes = archiveLocalize(w, 'creativeNotes');
  const inspiration = archiveLocalize(w, 'inspiration');
  if (notes) parts.push({ label: 'Creative Notes', text: notes });
  if (inspiration) parts.push({ label: 'Inspiration', text: inspiration });
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
          <div class="arc-credit-role">${archiveEscape(c.role || '')}</div>
          <div class="arc-credit-name">${archiveEscape(c.name)}</div>
          ${c.description ? `<div class="arc-credit-desc">${archiveEscape(c.description)}</div>` : ''}
        </div>`).join('')}
    </div>`;
}

// ── BEHIND THE LYRICS ──
// Preserves the real story behind a specific lyric, line, or phrase — not trivia, but documented
// creative provenance: the actual memory, accident, or experience that produced a particular
// piece of the work. New this session. Currently used by music (placed after Lyrics), but
// designed to extend to other categories later (e.g. "Behind a Passage" for books, "Behind a
// Scene" for screenplays) without any change to this renderer — only a new config entry pointing
// a different section id at the same underlying w.behindTheLyrics array shape, or a category
// reading from an analogous field. Each entry: { excerpt, story, evidence? }. Never invented —
// only real entries Leslie has explicitly provided are ever rendered here.
function buildArchiveBehindTheLyrics(w) {
  const entries = Array.isArray(w.behindTheLyrics) ? w.behindTheLyrics : [];
  if (!entries.length) {
    return archiveEmptyState('The real stories behind specific lyrics have not yet been documented for this work.');
  }
  return `
    <div class="arc-behind-lyrics">
      ${entries.map(function(e) {
        return `
        <div class="arc-lyric-story">
          <div class="arc-lyric-excerpt">&ldquo;${archiveEscape(e.excerpt)}&rdquo;</div>
          ${e.story ? e.story.split('\n').map(function(l) {
            return l.trim() ? `<p class="arc-body-text">${archiveEscape(l)}</p>` : '';
          }).join('') : ''}
          ${buildArchiveTimelineEvidence(e)}
        </div>`;
      }).join('')}
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

// ── GALLERY ──
// Reads from the same generic w.assets array already used by the hero/media sections, filtered
// to images. The architecture already supports any role string; this just gives the recognized
// roles a human-readable label so future material (behind-the-scenes, drafts, mood boards, studio
// photos, promotional shots, video stills, press assets) is captioned automatically once added —
// no layout or component change required to receive any of these asset types.
const ARCHIVE_GALLERY_ROLE_LABELS = {
  'cover-art': 'Cover Artwork',
  'alternate-cover': 'Alternate Cover',
  'behind-the-scenes': 'Behind the Scenes',
  'draft-lyrics': 'Draft Lyrics',
  'notebook-page': 'Notebook Page',
  'mood-board': 'Mood Board',
  'studio-photo': 'Studio Photo',
  'promotional': 'Promotional Photography',
  'video-still': 'Video Still',
  'press-asset': 'Press Asset'
};
function buildArchiveGallery(w) {
  const items = (w.assets || []).filter(a => a.type === 'image');
  if (!items.length) {
    return archiveEmptyState('No gallery items have been added for this work yet.');
  }
  return `
    <div class="arc-gallery-grid">
      ${items.map(a => {
        const roleLabel = ARCHIVE_GALLERY_ROLE_LABELS[a.role] || null;
        const caption = a.title || roleLabel;
        return `
        <div class="arc-gallery-item" onclick="archiveOpenLightbox('${archiveEscape(a.url)}')">
          <img src="${archiveEscape(a.url)}" alt="${archiveEscape(a.title || w.title)}" loading="lazy">
          ${caption ? `<div class="arc-gallery-caption">${archiveEscape(caption)}</div>` : ''}
        </div>`;
      }).join('')}
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

// Sections given slightly stronger visual weight in the sidenav per the established editorial
// hierarchy: About the Work, Story Behind the Work, Lyrics, and Media read as the primary path
// through an Archive; Timeline, Creative Notes, Behind the Lyrics, Credits, Gallery, and Related
// Works support that story without competing with it for attention.
const ARCHIVE_PRIMARY_NAV_SECTIONS = new Set(['about', 'story', 'manuscript', 'media']);

function buildArchiveNav(sections) {
  return `
    <nav class="arc-sidenav" id="arcSideNav">
      ${sections.map(s => {
        const weightClass = ARCHIVE_PRIMARY_NAV_SECTIONS.has(s.id) ? 'arc-sidenav-link-primary' : 'arc-sidenav-link-secondary';
        return `<a href="#arc-${s.id}" class="arc-sidenav-link ${weightClass}" data-section="${s.id}">${archiveEscape(s.label)}</a>`;
      }).join('')}
    </nav>`;
}

// ── Section renderer registry. Maps a section id (as used in ARCHIVE_TYPE_CONFIG) to the
// function that renders its content. This is the only place that needs a new entry when a
// genuinely new SECTION TYPE is introduced — new WORK TYPES never need new renderers, only
// a new entry in ARCHIVE_TYPE_CONFIG choosing which existing renderers to use. ──
const ARCHIVE_SECTION_RENDERERS = {
  about:      function(w) { return buildArchiveAbout(w); },
  story:      function(w, label, works, slug, epk) { return buildArchiveStory(w, epk); },
  timeline:   function(w) { return buildArchiveTimeline(w); },
  notes:      function(w) { return buildArchiveNotes(w); },
  manuscript: function(w, label) { return buildArchiveManuscript(w, label); },
  behindTheLyrics: function(w) { return buildArchiveBehindTheLyrics(w); },
  credits:    function(w) { return buildArchiveCredits(w); },
  press:      function(w) { return buildArchivePress(w); },
  equipment:  function(w) { return buildArchiveEquipment(w); },
  gallery:    function(w) { return buildArchiveGallery(w); },
  media:      function(w) { return buildArchiveMedia(w); },
  related:    function(w, label, works, slug) { return buildArchiveRelated(w, works, slug); }
};

// ── EDITORIAL PULL QUOTE ──
// A quiet, wordless moment between the Hero and the first section — not another content
// section, not an explanation. Renders only when the work carries real pullQuote data (a
// short excerpt the artist has chosen, optionally with a translation); a work with none simply
// has no pull quote, rather than ever showing an invented or default line.
function buildArchivePullQuote(w) {
  const quote = w.pullQuote;
  if (!quote || !quote.text) return '';
  return `
    <div class="arc-pull-quote">
      <div class="arc-pull-quote-rule"></div>
      <div class="arc-pull-quote-text">&ldquo;${archiveEscape(quote.text)}&rdquo;</div>
      ${quote.translation ? `<div class="arc-pull-quote-translation">${archiveEscape(quote.translation)}</div>` : ''}
    </div>`;
}

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
    const body = renderer ? renderer(w, s.label, works, epk.slug, epk) : archiveEmptyState('This section is not yet available.');
    return `
        <section class="arc-section" id="arc-${s.id}">
          <h2 class="arc-section-title">${archiveEscape(s.label)}</h2>
          ${body}
        </section>`;
  }).join('');

  container.innerHTML = `
    ${buildArchiveHero(w, epk)}
    ${buildArchivePullQuote(w)}
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

// Cached after a successful load so the language toggle can rebuild the page in place
// without a second network round-trip.
let archiveLoadedEpk = null;
let archiveLoadedWorkSlug = null;

function toggleArchiveLang(lang) {
  if (lang === archiveCurrentLang) return;
  archiveCurrentLang = lang;

  const en = document.getElementById('archiveLangEN');
  const es = document.getElementById('archiveLangES');
  if (en) en.classList.toggle('is-active-lang', lang === 'en');
  if (es) es.classList.toggle('is-active-lang', lang === 'es');
  const backLink = document.getElementById('archiveBackLink');
  if (backLink) backLink.textContent = lang === 'es' ? '← Volver al Perfil' : '← Back to Profile';

  // Re-render with the already-loaded data — no need to re-fetch. Preserve the user's scroll
  // position across the rebuild so switching languages mid-read doesn't jump them back to the top.
  if (archiveLoadedEpk && archiveLoadedWorkSlug) {
    const scrollY = window.scrollY;
    buildArchive(archiveLoadedEpk, archiveLoadedWorkSlug);
    window.scrollTo(0, scrollY);
  }
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
        archiveLoadedEpk = data.epk;
        archiveLoadedWorkSlug = archiveParams.work;
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
