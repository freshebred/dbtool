/**
 * theme.js — Dark/Light mode toggle
 * Reads/writes to localStorage, respects prefers-color-scheme on first visit.
 */
(function() {
  const KEY = 'pwadb-theme';
  const html = document.documentElement;

  function getPreferred() {
    const saved = localStorage.getItem(KEY);
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function applyTheme(t) {
    html.dataset.theme = t;
    localStorage.setItem(KEY, t);
    const meta = document.getElementById('meta-theme-color');
    if (meta) meta.content = t === 'dark' ? '#020617' : '#F1F5F9';
    // Update icon in navbar
    const btn = document.getElementById('btn-theme');
    if (btn) {
      btn.querySelector('use').setAttribute('href', t === 'dark' ? '#ic-moon' : '#ic-sun');
      btn.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
  }

  // Apply immediately (before render) to prevent flash
  applyTheme(getPreferred());

  // Expose global
  window.Theme = {
    current: () => html.dataset.theme,
    toggle() {
      applyTheme(html.dataset.theme === 'dark' ? 'light' : 'dark');
    },
    init() {
      const btn = document.getElementById('btn-theme');
      if (btn) btn.addEventListener('click', () => this.toggle());
    }
  };
})();
