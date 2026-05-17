/**
 * app.js — Main application controller
 * Manages view navigation, slide transitions, and connection flow.
 */
window.App = (function() {
  // ── State ────────────────────────────────────────────────────────────────
  const VIEWS = ['connections', 'databases', 'collections', 'documents', 'editor'];
  let _stack = []; // navigation stack: [{ view, state }]
  let _current = 'connections';
  let _isAnimating = false;

  // ── View Elements ────────────────────────────────────────────────────────
  function el(name) {
    return document.getElementById(`view-${name}`);
  }

  // ── Slide Transition ──────────────────────────────────────────────────────
  /**
   * direction: 'forward' (new view slides in from right)
   *            'back'    (new view slides in from left, old slides to right)
   */
  function transition(fromName, toName, direction = 'forward') {
    if (_isAnimating) return;
    _isAnimating = true;

    const from = el(fromName);
    const to   = el(toName);
    if (!from || !to) { _isAnimating = false; return; }

    const DURATION = 280;

    if (direction === 'forward') {
      // To: start offscreen right, slide to center
      // From: slide to left, fade
      to.style.transform = 'translateX(100%)';
      to.style.opacity = '0';
      to.style.pointerEvents = 'none';
      to.classList.add('active');

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          to.style.transition   = `transform ${DURATION}ms cubic-bezier(0.4,0,0.2,1), opacity ${DURATION}ms cubic-bezier(0.4,0,0.2,1)`;
          from.style.transition = `transform ${DURATION}ms cubic-bezier(0.4,0,0.2,1), opacity ${DURATION}ms cubic-bezier(0.4,0,0.2,1)`;
          to.style.transform   = 'translateX(0)';
          to.style.opacity     = '1';
          from.style.transform = 'translateX(-30%)';
          from.style.opacity   = '0';

          setTimeout(() => {
            from.classList.remove('active');
            from.style.cssText = '';
            to.style.cssText   = '';
            to.classList.add('active');
            to.style.pointerEvents = '';
            _isAnimating = false;
          }, DURATION + 20);
        });
      });
    } else {
      // Back: from slides right, to slides from left center
      from.style.transition = `transform ${DURATION}ms cubic-bezier(0.4,0,0.2,1), opacity ${DURATION}ms cubic-bezier(0.4,0,0.2,1)`;
      to.style.transform   = 'translateX(-30%)';
      to.style.opacity     = '0';
      to.style.pointerEvents = 'none';
      to.classList.add('active');

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          to.style.transition   = `transform ${DURATION}ms cubic-bezier(0.4,0,0.2,1), opacity ${DURATION}ms cubic-bezier(0.4,0,0.2,1)`;
          to.style.transform   = 'translateX(0)';
          to.style.opacity     = '1';
          from.style.transform = 'translateX(100%)';
          from.style.opacity   = '0';

          setTimeout(() => {
            from.classList.remove('active');
            from.style.cssText = '';
            to.style.cssText   = '';
            to.classList.add('active');
            to.style.pointerEvents = '';
            _isAnimating = false;
          }, DURATION + 20);
        });
      });
    }
  }

  // ── Navigate ──────────────────────────────────────────────────────────────
  /**
   * Navigate forward to a named view, optionally loading new state.
   */
  function navigate(viewName, state) {
    const from = _current;
    _stack.push({ view: from, state: null });
    _current = viewName;

    // Load the new view's data
    switch (viewName) {
      case 'databases':   ViewDatabases.load(state);   break;
      case 'collections': ViewCollections.load(state); break;
      case 'documents':   ViewDocuments.load(state);   break;
      case 'editor':      ViewEditor.load(state);      break;
    }

    transition(from, viewName, 'forward');
  }

  /**
   * Go back one level.
   */
  function back() {
    if (_stack.length === 0) return;
    const { view } = _stack.pop();
    const from = _current;
    _current = view;
    transition(from, view, 'back');

    // Clear search when leaving documents
    if (from === 'documents') {
      document.getElementById('doc-search').value = '';
    }
  }

  /**
   * Connect to a saved connection and navigate to databases.
   */
  async function connectTo(connectionId) {
    const conns = await DB.listConnections();
    const conn  = conns.find(c => c.id === connectionId);
    if (!conn) { Toast.error('Connection not found'); return; }

    // Show indicator as loading
    const ind = document.getElementById(`ind-${connectionId}`);
    if (ind) ind.style.background = 'var(--warning)';

    try {
      const result = await API.connect(conn.uri, conn.name);
      await DB.touchConnection(connectionId);
      if (ind) { ind.classList.add('connected'); }
      navigate('databases', {
        connectionId: result.connectionId,
        name: conn.name || conn.uri,
        uri: conn.uri,
      });
    } catch (err) {
      if (ind) ind.style.background = 'var(--danger)';
      Toast.error(`Connect failed: ${err.message}`);
    }
  }

  // ── Hardware Back Button (Android) ────────────────────────────────────────
  function initHardwareBack() {
    const base = window.__PWADB_BASE__ || '';
    const rootPath = base ? base + '/' : '/';
    window.addEventListener('popstate', () => {
      if (_stack.length > 0) {
        back();
        history.pushState(null, '', rootPath);
      }
    });
    // Push initial state so popstate fires
    history.pushState(null, '', rootPath);
  }

  // ── PWA Service Worker ────────────────────────────────────────────────────
  function registerSW() {
    if ('serviceWorker' in navigator) {
      // Use the injected base path (from server's config.js) for SW URL + scope
      const base = window.__PWADB_BASE__ || '';
      navigator.serviceWorker.register(base + '/sw.js', { scope: base + '/' })
        .then(reg => console.log('[pwaDb] SW registered', reg.scope))
        .catch(err => console.warn('[pwaDb] SW error', err));
    }
  }

  // ── Init ─────────────────────────────────────────────────────────────────
  function init() {
    // Init all views
    ViewConnections.init();
    ViewDatabases.init();
    ViewCollections.init();
    ViewDocuments.init();
    ViewEditor.init();

    // Init components
    Theme.init();

    // Hardware back
    initHardwareBack();

    // Service worker
    registerSW();

    // URL shortcut: ?action=add
    if (new URLSearchParams(location.search).get('action') === 'add') {
      setTimeout(() => document.getElementById('btn-add-connection').click(), 300);
    }

    console.log('[pwaDb] Ready');
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { navigate, back, connectTo };
})();
