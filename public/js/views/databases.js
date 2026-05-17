/**
 * views/databases.js — Database list for an active connection
 */
window.ViewDatabases = (function() {
  let _state = null; // { connectionId, name }

  function formatSize(bytes) {
    if (!bytes) return '';
    const mb = bytes / 1024 / 1024;
    return mb < 1 ? `${(bytes / 1024).toFixed(0)} KB` : `${mb.toFixed(1)} MB`;
  }

  async function load(state) {
    if (state) _state = state;
    const { connectionId, name } = _state;

    // Update nav
    document.getElementById('nav-db-heading').textContent = 'Databases';
    document.getElementById('nav-db-breadcrumb').textContent = name;

    const container = document.getElementById('databases-content');
    container.innerHTML = `<div class="loading-overlay"><div class="spinner spinner-lg"></div><span>Loading databases…</span></div>`;

    try {
      const dbs = await API.databases(connectionId);
      renderDatabases(dbs);
    } catch (err) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon"><svg width="28" height="28"><use href="#ic-alert"/></svg></div>
          <div class="empty-state__title">Connection error</div>
          <p class="empty-state__desc">${err.message}</p>
          <button class="btn btn-ghost btn-sm" onclick="ViewDatabases.load()">Retry</button>
        </div>`;
      Toast.error(err.message);
    }
  }

  function renderDatabases(dbs) {
    const container = document.getElementById('databases-content');
    const { connectionId, name } = _state;

    if (!dbs.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon"><svg width="28" height="28"><use href="#ic-database"/></svg></div>
          <div class="empty-state__title">No databases found</div>
          <p class="empty-state__desc">This connection has no accessible databases (admin, local, and config are hidden).</p>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="section-header">
        <span class="section-title">${dbs.length} database${dbs.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="list-group reveal-list">
        ${dbs.map(db => `
          <div class="list-item" data-db="${encodeURIComponent(db.name)}" role="button" tabindex="0" aria-label="${db.name}">
            <div class="list-item__icon">
              <svg><use href="#ic-database"/></svg>
            </div>
            <div class="list-item__body">
              <div class="list-item__name">${db.name}</div>
              ${db.sizeOnDisk ? `<div class="list-item__meta">${formatSize(db.sizeOnDisk)}</div>` : ''}
            </div>
            <span class="list-item__chevron"><svg><use href="#ic-chevron-right"/></svg></span>
          </div>`).join('')}
      </div>`;

    container.querySelectorAll('[data-db]').forEach(el => {
      el.addEventListener('click', () => {
        App.navigate('collections', {
          connectionId,
          connName: name,
          db: decodeURIComponent(el.dataset.db),
        });
      });
    });
  }

  function init() {
    document.getElementById('btn-back-databases').addEventListener('click', () => App.back());
    document.getElementById('btn-refresh-databases').addEventListener('click', () => load());
  }

  return { init, load };
})();
