/**
 * views/editor.js — JSON document editor (create / edit)
 */
window.ViewEditor = (function() {
  let _state = null; // { connectionId, connName, db, collection, mode, doc, docId }

  function getTextarea() { return document.getElementById('editor-json'); }

  function setContent(doc) {
    getTextarea().value = doc ? JSON.stringify(doc, null, 2) : '{\n  \n}';
    validate();
  }

  function validate() {
    const ta = getTextarea();
    const err = document.getElementById('editor-error');
    try {
      JSON.parse(ta.value);
      ta.classList.remove('error');
      ta.classList.add('valid');
      err.classList.remove('show');
      return true;
    } catch (e) {
      ta.classList.add('error');
      ta.classList.remove('valid');
      err.textContent = `Invalid JSON: ${e.message}`;
      err.classList.add('show');
      return false;
    }
  }

  function load(state) {
    _state = state;
    const { mode, doc, connName, db, collection, docId } = state;

    const isEdit = mode === 'edit';

    // Nav
    document.getElementById('nav-editor-heading').textContent = isEdit ? 'Edit Document' : 'New Document';
    document.getElementById('nav-editor-breadcrumb').innerHTML = `
      <span>${connName}</span><span class="sep">/</span>
      <span>${db}</span><span class="sep">/</span>
      <span>${collection}</span>`;
    document.getElementById('btn-editor-save-label').textContent = isEdit ? 'Save Changes' : 'Insert';
    document.getElementById('btn-editor-delete').style.display = isEdit ? 'flex' : 'none';

    // Prepare document for editing (strip _id for cleaner editing)
    let displayDoc = null;
    if (isEdit && doc) {
      const { _id, ...rest } = doc;
      displayDoc = rest;
    }
    setContent(displayDoc);

    // Clear any previous error
    const err = document.getElementById('editor-error');
    err.classList.remove('show');
  }

  async function save() {
    if (!validate()) return;
    const { connectionId, db, collection, mode, docId } = _state;
    const doc = JSON.parse(getTextarea().value);
    const btn = document.getElementById('btn-editor-save');

    btn.disabled = true;
    btn.innerHTML = `<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div> Saving…`;

    try {
      if (mode === 'create') {
        await API.createDocument(connectionId, db, collection, doc);
        Toast.success('Document created');
      } else {
        await API.updateDocument(connectionId, db, collection, docId, doc);
        Toast.success('Document updated');
      }
      App.back();
      // Refresh documents view
      setTimeout(() => ViewDocuments.load(), 100);
    } catch (err) {
      Toast.error(err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<svg><use href="#ic-check"/></svg> <span id="btn-editor-save-label">${mode === 'create' ? 'Insert' : 'Save Changes'}</span>`;
    }
  }

  async function deleteDoc() {
    const { connectionId, db, collection, docId, doc } = _state;
    const id = docId || (doc?._id ? String(doc._id) : '?');
    const ok = await Modal.confirm(
      'Delete Document',
      `Permanently delete document "${id}"? This cannot be undone.`,
      'Delete'
    );
    if (!ok) return;

    const btn = document.getElementById('btn-editor-delete');
    btn.disabled = true;
    try {
      await API.deleteDocument(connectionId, db, collection, docId);
      Toast.success('Document deleted');
      App.back();
      setTimeout(() => ViewDocuments.load(), 100);
    } catch (err) {
      Toast.error(err.message);
      btn.disabled = false;
    }
  }

  function init() {
    document.getElementById('btn-back-editor').addEventListener('click', () => App.back());
    document.getElementById('btn-editor-cancel').addEventListener('click', () => App.back());
    document.getElementById('btn-editor-save').addEventListener('click', save);
    document.getElementById('btn-editor-delete').addEventListener('click', deleteDoc);

    // Copy JSON button
    document.getElementById('btn-editor-copy').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(getTextarea().value);
        Toast.success('Copied to clipboard');
      } catch {
        Toast.error('Could not copy to clipboard');
      }
    });

    // Live validation
    getTextarea().addEventListener('input', () => validate());

    // Auto-indent on Enter (basic)
    getTextarea().addEventListener('keydown', e => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = e.target.selectionStart;
        const end   = e.target.selectionEnd;
        e.target.value = e.target.value.slice(0, start) + '  ' + e.target.value.slice(end);
        e.target.selectionStart = e.target.selectionEnd = start + 2;
      }
    });
  }

  return { init, load };
})();
