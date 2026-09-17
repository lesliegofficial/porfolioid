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
})();
