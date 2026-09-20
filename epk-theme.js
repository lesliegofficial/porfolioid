/* PorfolioID public-profile theme runtime.
   Final dashboard palette set:
   gold, sage, sage-light, midnight, plum.
   Query-string theme preview still overrides the saved profile theme for review.
*/
(function () {
  const allowedPreviewThemes = new Set(['gold', 'sage', 'sage-light', 'midnight', 'plum']);
  const legacyGoldPattern = /(var\(--gold\)|#c9a84c|201\s*,\s*168\s*,\s*76)/i;
  const legacyProfessionalPattern = /(#8fb8d0|143\s*,\s*184\s*,\s*208|123\s*,\s*155\s*,\s*175)/i;

  function applyPorfolioTheme(theme) {
    if (!allowedPreviewThemes.has(theme)) return false;
    document.documentElement.dataset.theme = theme;
    return true;
  }

  window.applyPorfolioTheme = applyPorfolioTheme;

  const previewTheme = new URLSearchParams(window.location.search).get('theme');
  if (previewTheme && allowedPreviewThemes.has(previewTheme)) {
    applyPorfolioTheme(previewTheme);
    document.documentElement.dataset.themePreview = 'true';
  }

  function loadOverrideStylesheet(href, dataKey) {
    if (document.querySelector(`link[data-${dataKey}]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute(`data-${dataKey}`, 'true');
    document.head.appendChild(link);
  }

  function legacyCategoryFromStyle(el) {
    const style = el?.getAttribute?.('style') || '';
    if (legacyProfessionalPattern.test(style)) return 'professional';
    if (legacyGoldPattern.test(style)) return 'music';
    return null;
  }

  function markCategoryCard(card) {
    if (!card || card.dataset.semanticCategoryApplied === 'true') return;
    const category = legacyCategoryFromStyle(card);
    if (!category) return;

    card.classList.add(`semantic-category-${category}`);

    let label = card.querySelector('.resume-card-label, .award-card-type');
    if (!label && card.classList.contains('credit-card')) {
      label = Array.from(card.children).find(child => {
        const text = (child.textContent || '').trim().toUpperCase();
        return text === 'MUSIC & ENTERTAINMENT' || text === 'PROFESSIONAL';
      });
    }
    if (label) label.classList.add('semantic-category-label');
    card.dataset.semanticCategoryApplied = 'true';
  }

  function assetCategoryClass(text) {
    const value = (text || '').trim().toLowerCase();
    if (!value) return null;
    if (value.includes('professional') || value.includes('resume')) return 'semantic-asset-category-professional';
    if (value.includes('education') || value.includes('diploma')) return 'semantic-asset-category-education';
    if (value.includes('certif')) return 'semantic-asset-category-certification';
    if (value.includes('award') || value.includes('honor')) return 'semantic-asset-category-award';
    if (value.includes('press')) return 'semantic-asset-category-press';
    if (value.includes('contract')) return 'semantic-asset-category-contract';
    return null;
  }

  function eachSelfAndDescendant(root, selector, callback) {
    if (root.matches?.(selector)) callback(root);
    root.querySelectorAll?.(selector).forEach(callback);
  }

  function markStatusBadges(root) {
    eachSelfAndDescendant(root, 'span, .award-badge-verified', el => {
      const context = el.closest?.('.credit-card, #assets, #awardModalContent, .award-card');
      if (!context && !el.classList.contains('award-badge-verified')) return;

      const text = (el.textContent || '').trim().toUpperCase();
      if (text.includes('VERIFIED')) el.classList.add('semantic-status-verified');
      if (text.includes('FEATURED') || text.includes('PINNED')) el.classList.add('semantic-status-featured');
    });
  }

  function markAssetCategories(root) {
    eachSelfAndDescendant(root, 'span[style]', el => {
      if (!el.closest?.('#assets')) return;
      if (!el.style.border && !el.style.borderColor) return;
      const categoryClass = assetCategoryClass(el.textContent);
      if (categoryClass) el.classList.add(categoryClass);
    });

    /* Asset SVGs are decorative theme icons, not category semantics. */
    eachSelfAndDescendant(root, 'svg [stroke], svg [fill]', el => {
      if (!el.closest?.('#assets')) return;
      const stroke = el.getAttribute('stroke');
      const fill = el.getAttribute('fill');
      if (stroke && legacyGoldPattern.test(stroke)) el.setAttribute('stroke', 'var(--accent-icon)');
      if (fill && legacyGoldPattern.test(fill)) el.setAttribute('fill', 'var(--accent-icon)');
    });
  }

  function classifyGeneratedMarkup(root) {
    if (!root || root.nodeType !== Node.ELEMENT_NODE) return;

    if (root.matches?.('.resume-card, .credit-card, .award-card')) markCategoryCard(root);
    root.querySelectorAll?.('.resume-card, .credit-card, .award-card').forEach(markCategoryCard);

    markStatusBadges(root);
    markAssetCategories(root);
  }

  window.addEventListener('DOMContentLoaded', function () {
    /* Load isolated migration layers after legacy + core theme CSS so they
       remain independently revertible during visual review. */
    loadOverrideStylesheet('/epk-theme-media.css?v=20260917-1', 'porfolio-theme-media');
    loadOverrideStylesheet('/epk-theme-generated.css?v=20260917-1', 'porfolio-theme-generated');
    loadOverrideStylesheet('/epk-theme-connect.css?v=20260917-1', 'porfolio-theme-connect');
    loadOverrideStylesheet('/epk-theme-shell.css?v=20260917-1', 'porfolio-theme-shell');
    loadOverrideStylesheet('/epk-theme-sage-review.css?v=20260919-1', 'porfolio-theme-sage-review');
    loadOverrideStylesheet('/epk-theme-options.css?v=20260920-56', 'porfolio-theme-options');

    classifyGeneratedMarkup(document.body);

    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) classifyGeneratedMarkup(node);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
