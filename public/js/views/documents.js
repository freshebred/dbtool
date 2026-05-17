/**
 * views/documents.js — Document list with search, pagination, and filter
 */
window.ViewDocuments = (function() {
  let _state = null;  // { connectionId, connName, db, collection }
  let _page  = 1;
  let _total = 0;
  let _pages = 0;
  let _searchDebounce = null;

  function docPreview(doc) {
    // Show a readable preview of the document (top-level keys, max ~80 chars)
    const { _id, ...rest } = doc;
    const str = JSON.stringify(rest);
    return str.length > 100 ? str.slice(0, 97) + '…' : str;
  }

  function idStr(doc) {
    if (!doc._id) return '(no _id)';
    if (typeof doc._id === 'object') return JSON.stringify(doc._id);
    return String(doc._id);
  }

  async function load(state, page = 1) {
    if (state) { _state = state; _page = 1; }
    _page = page;

    const { connectionId, connName, db, collection } = _state;

    // Nav breadcrumb
    document.getElementById('nav-docs-heading').textContent = collection;
    document.getElementById('nav-docs-breadcrumb').innerHTML = `
      <span>${connName}</span><span class="sep">/</span>
      <span>${db}</span><span class="sep">/</span>
      <span>${collection}</span>`;

    const container = document.getElementById('documents-content');
    container.innerHTML = `<div class="loading-overlay"><div class="spinner spinner-lg"></div><span>Loading documents…</span></div>`;

    const q = document.getElementById('doc-search').value.trim();

    try {
      const result = await API.documents(connectionId, db, collection, { page: _page, limit: 20, q });
      _total = result.total;
      _pages = result.pages;
      renderDocuments(result.docs, result);
    } catch (err) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon"><svg width="28" height="28"><use href="#ic-alert"/></svg></div>
          <div class="empty-state__title">Error</div>
          <p class="empty-state__desc">${err.message}</p>
        </div>`;
      Toast.error(err.message);
    }
  }

  function renderDocuments(docs, meta) {
    const container = document.getElementById('documents-content');

    if (!docs.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon"><svg width="28" height="28"><use href="#ic-file"/></svg></div>
          <div class="empty-state__title">No documents</div>
          <p class="empty-state__desc">This collection is empty${document.getElementById('doc-search').value ? ' (no matches for your filter)' : ''}.</p>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="section-header">
        <span class="section-title">${meta.total.toLocaleString()} document${meta.total !== 1 ? 's' : ''}</span>
        <span class="badge badge-gray">Page ${meta.page}/${meta.pages || 1}</span>
      </div>
      <div class="list-group reveal-list" id="doc-list">
        ${docs.map(doc => `
          <div class="doc-row" data-doc-id="${encodeURIComponent(idStr(doc))}" data-doc='${encodeURIComponent(JSON.stringify(doc))}' role="button" tabindex="0">
            <div class="doc-row__id">${idStr(doc)}</div>
            <div class="doc-row__preview">${docPreview(doc)}</div>
          </div>`).join('')}
      </div>
      ${meta.pages > 1 ? `
      <div class="pagination">
        <button class="btn btn-ghost btn-sm" id="btn-prev-page" ${meta.page <= 1 ? 'disabled' : ''}>
          <svg><use href="#ic-chevron-left"/></svg> Prev
        </button>
        <span class="pagination__info">${meta.page} / ${meta.pages}</span>
        <button class="btn btn-ghost btn-sm" id="btn-next-page" ${meta.page >= meta.pages ? 'disabled' : ''}>
          Next <svg><use href="#ic-chevron-right"/></svg>
        </button>
      </div>` : ''}`;

    // Document tap → editor
    container.querySelectorAll('.doc-row').forEach(row => {
      row.addEventListener('click', () => {
        const doc = JSON.parse(decodeURIComponent(row.dataset.doc));
        App.navigate('editor', {
          ..._state,
          mode: 'edit',
          doc,
          docId: decodeURIComponent(row.dataset.docId),
        });
      });
    });

    // Pagination
    const prev = document.getElementById('btn-prev-page');
    const next = document.getElementById('btn-next-page');
    if (prev) prev.addEventListener('click', () => load(null, _page - 1));
    if (next) next.addEventListener('click', () => load(null, _page + 1));
  }

  function init() {
    document.getElementById('btn-back-documents').addEventListener('click', () => App.back());
    document.getElementById('btn-refresh-documents').addEventListener('click', () => load());

    // New document
    document.getElementById('btn-new-document').addEventListener('click', () => {
      if (!_state) return;
      App.navigate('editor', { ..._state, mode: 'create', doc: null, docId: null });
    });

    // Search with debounce
    const searchInput = document.getElementById('doc-search');
    searchInput.addEventListener('input', () => {
      clearTimeout(_searchDebounce);
      _searchDebounce = setTimeout(() => load(null, 1), 500);
    });
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { clearTimeout(_searchDebounce); load(null, 1); }
    });
  }

  return { init, load };
})();
