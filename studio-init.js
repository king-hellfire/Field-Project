// Runs before first paint so the studio doesn't flash the wrong colour scheme.
(function () {
  let mode = null;
  try { mode = localStorage.getItem('chromacraft-theme'); } catch (e) { /* storage unavailable */ }
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (mode === 'dark' || (mode === null && prefersDark)) {
    document.documentElement.classList.add('dark');
  }
})();
