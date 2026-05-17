/**
 * views/collections.js — Collection list for a database
 */
window.ViewCollections = (function() {
  let _state = null; // { connectionId, connName, db }

  async function load(state) {
    if (state) _state = state;
    const { connectionId, connName, db } = _state;

    document.getElementById('nav-col-heading').textContent = db;
    document.getElementById('nav-col-breadcrumb').innerHTML = `
      <span>${connName}</span>
      <span class="sep">/</span>
      <span>${db}</span>`;

    const container = document.getElementById('collections-content');
    container.innerHTML = `<div class="loading-overlay"><div class="spinner spinner-lg"></div><span>Loading collections…</span></div>`;

    try {
      const cols = await API.collections(connectionId, db);
      renderCollections(cols);
    } catch (err) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon"><svg width="28" height="28"><use href="#ic-alert"/></svg></div>
          <div class="empty-state__title">Error</div>
          <p class="empty-state__desc">${err.message}</p>
          <button class="btn btn-ghost btn-sm" onclick="ViewCollections.load()">Retry</button>
        </div>`;
      Toast.error(err.message);
    }
  }

  function renderCollections(cols) {
    const container = document.getElementById('collections-content');
    const { connectionId, connName, db } = _state;

    if (!cols.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon"><svg width="28" height="28"><use href="#ic-folder"/></svg></div>
          <div class="empty-state__title">No collections</div>
          <p class="empty-state__desc">This database has no collections yet.</p>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="section-header">
        <span class="section-title">${cols.length} collection${cols.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="list-group reveal-list">
        ${cols.map(col => `
          <div class="list-item" data-col="${encodeURIComponent(col.name)}" role="button" tabindex="0" aria-label="${col.name}">
            <div class="list-item__icon">
              <svg><use href="#ic-folder"/></svg>
            </div>
            <div class="list-item__body">
              <div class="list-item__name">${col.name}</div>
              <div class="list-item__meta">
                ${col.count !== null ? `${col.count.toLocaleString()} document${col.count !== 1 ? 's' : ''}` : 'View documents'}
              </div>
            </div>
            ${col.count !== null ? `<span class="badge badge-gray">${col.count > 999 ? (col.count/1000).toFixed(1)+'k' : col.count}</span>` : ''}
            <span class="list-item__chevron"><svg><use href="#ic-chevron-right"/></svg></span>
          </div>`).join('')}
      </div>`;

    container.querySelectorAll('[data-col]').forEach(el => {
      el.addEventListener('click', () => {
        App.navigate('documents', {
          connectionId,
          connName,
          db,
          collection: decodeURIComponent(el.dataset.col),
        });
      });
    });
  }

  function init() {
    document.getElementById('btn-back-collections').addEventListener('click', () => App.back());
    document.getElementById('btn-refresh-collections').addEventListener('click', () => load());
  }

  return { init, load };
})();
