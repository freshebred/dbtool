/**
 * views/connections.js — Saved connections list view
 * Handles: display, add, delete, connect flow
 */
window.ViewConnections = (function() {
  let _deferredInstall = null;

  // ── Helpers ──────────────────────────────────────────────────────────────

  function uriMask(uri) {
    // Hide password in URI for display
    try {
      return uri.replace(/:([^@\s]{3})[^@\s]*@/, ':$1***@');
    } catch { return uri; }
  }

  function renderEmpty() {
    return `
      <div class="empty-state reveal">
        <div class="empty-state__icon">
          <svg width="28" height="28"><use href="#ic-server"/></svg>
        </div>
        <div class="empty-state__title">No connections yet</div>
        <p class="empty-state__desc">Tap <strong style="color:var(--accent)">+</strong> to add your first MongoDB connection string.</p>
      </div>`;
  }

  function renderConnections(conns) {
    const container = document.getElementById('connections-content');
    if (!conns.length) {
      container.innerHTML = renderEmpty();
      return;
    }

    container.innerHTML = `
      <div class="section-header">
        <span class="section-title">${conns.length} connection${conns.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="list-group-card reveal-list" id="conn-list">
        ${conns.map(c => renderConnCard(c)).join('')}
      </div>`;

    // Bind tap handlers
    container.querySelectorAll('[data-conn-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.conn-card__actions button')) return;
        App.connectTo(el.dataset.connId);
      });
    });

    // Delete buttons
    container.querySelectorAll('[data-delete-id]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.deleteId;
        const conn = conns.find(c => c.id === id);
        const ok = await Modal.confirm(
          'Remove Connection',
          `Remove "${conn?.name || id}"? This only removes the saved connection — your database is not affected.`,
          'Remove'
        );
        if (ok) {
          await DB.deleteConnection(id);
          Toast.success('Connection removed');
          load();
        }
      });
    });
  }

  function renderConnCard(c) {
    const type = API.detectUriType(c.uri);
    const typeLabel = API.TYPE_LABELS[type];
    const lastUsed = c.lastUsed
      ? new Date(c.lastUsed).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : 'Never';

    return `
      <div class="conn-card" data-conn-id="${c.id}" role="button" tabindex="0" aria-label="Connect to ${c.name}">
        <div class="conn-card__indicator" id="ind-${c.id}"></div>
        <div class="conn-card__body">
          <div class="conn-card__name">${c.name}</div>
          <div class="conn-card__uri">${uriMask(c.uri)}</div>
          <div class="conn-card__tag">
            <span class="uri-type ${type}">${typeLabel}</span>
            &nbsp;·&nbsp; Last used ${lastUsed}
          </div>
        </div>
        <div class="conn-card__actions">
          <button class="icon-btn" data-delete-id="${c.id}" aria-label="Remove connection" title="Remove">
            <svg><use href="#ic-trash"/></svg>
          </button>
          <div style="color:var(--text-dim)"><svg width="16" height="16"><use href="#ic-chevron-right"/></svg></div>
        </div>
      </div>`;
  }

  // ── Load ─────────────────────────────────────────────────────────────────

  async function load() {
    const container = document.getElementById('connections-content');
    container.innerHTML = `<div class="loading-overlay"><div class="spinner"></div></div>`;
    try {
      const conns = await DB.listConnections();
      renderConnections(conns);
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><p class="empty-state__desc">${err.message}</p></div>`;
    }
  }

  // ── Add Connection Modal ──────────────────────────────────────────────────

  function initAddModal() {
    const btnAdd    = document.getElementById('btn-add-connection');
    const btnCancel = document.getElementById('btn-conn-cancel');
    const btnSave   = document.getElementById('btn-conn-save');
    const uriInput  = document.getElementById('conn-uri');
    const nameInput = document.getElementById('conn-name');
    const uriError  = document.getElementById('conn-uri-error');
    const uriType   = document.getElementById('conn-uri-type');

    btnAdd.addEventListener('click', () => {
      uriInput.value = '';
      nameInput.value = '';
      uriError.classList.remove('show');
      uriType.innerHTML = '';
      Modal.open('modal-add-conn');
      setTimeout(() => uriInput.focus(), 150);
    });

    btnCancel.addEventListener('click', () => Modal.close('modal-add-conn'));

    // Live URI type detection
    uriInput.addEventListener('input', () => {
      const type = API.detectUriType(uriInput.value.trim());
      if (uriInput.value.trim()) {
        uriType.innerHTML = `<span class="uri-type ${type}">${API.TYPE_LABELS[type]}</span>`;
      } else {
        uriType.innerHTML = '';
      }
      uriError.classList.remove('show');
    });

    btnSave.addEventListener('click', doConnect);
    uriInput.addEventListener('keydown', e => { if (e.key === 'Enter') doConnect(); });

    async function doConnect() {
      const uri  = uriInput.value.trim();
      const name = nameInput.value.trim() || null;
      if (!uri) {
        uriError.textContent = 'Connection string is required';
        uriError.classList.add('show');
        return;
      }

      btnSave.disabled = true;
      btnSave.innerHTML = `<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div> Connecting…`;

      try {
        const result = await API.connect(uri, name);
        await DB.saveConnection({ ...result, uri, name: name || result.name });
        Modal.close('modal-add-conn');
        Toast.success(`Connected to ${result.name || uri}`);
        await load();
        // Navigate to databases
        App.navigate('databases', { connectionId: result.connectionId, name: result.name || uri, uri });
      } catch (err) {
        uriError.textContent = err.message;
        uriError.classList.add('show');
      } finally {
        btnSave.disabled = false;
        btnSave.innerHTML = `<svg><use href="#ic-plug"/></svg> Connect`;
      }
    }
  }

  // ── PWA Install Banner ────────────────────────────────────────────────────

  function initInstallBanner() {
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      _deferredInstall = e;
      const banner = document.getElementById('install-banner');
      if (!sessionStorage.getItem('pwadb-install-dismissed')) {
        banner.classList.add('show');
      }
    });

    document.getElementById('btn-install').addEventListener('click', async () => {
      if (!_deferredInstall) return;
      _deferredInstall.prompt();
      const { outcome } = await _deferredInstall.userChoice;
      if (outcome === 'accepted') {
        document.getElementById('install-banner').classList.remove('show');
      }
      _deferredInstall = null;
    });

    document.getElementById('btn-install-dismiss').addEventListener('click', () => {
      document.getElementById('install-banner').classList.remove('show');
      sessionStorage.setItem('pwadb-install-dismissed', '1');
    });
  }

  // ── Init ─────────────────────────────────────────────────────────────────

  function init() {
    initAddModal();
    initInstallBanner();
    load();
  }

  return { init, load };
})();
