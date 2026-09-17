/* PorfolioID public-profile theme runtime.
   During token conversion this provides a non-persistent visual test harness:
   ?theme=wine switches the page to Wine without touching profile data.
   Normal URLs remain Gold until the approved profile theme field is wired later.
*/
(function () {
  const allowedPreviewThemes = new Set(['gold', 'wine']);

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

  /* Load the isolated media/gallery override after legacy + core theme CSS so
     the conversion remains independently revertible during visual review. */
  window.addEventListener('DOMContentLoaded', function () {
    if (document.querySelector('link[data-porfolio-theme-media]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/epk-theme-media.css?v=20260917-1';
    link.dataset.porfolioThemeMedia = 'true';
    document.head.appendChild(link);
  });
})();
