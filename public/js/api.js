/**
 * api.js — fetch() wrapper for communicating with the local pwaDb proxy.
 * All requests go to localhost:3001/api/...
 */
window.API = (function() {
  // BASE_PATH is injected by server.js into /js/config.js
  // Falls back to auto-detecting from the current page URL
  const BASE = (window.__PWADB_BASE__ || '') + '/api';

  /**
   * Detect what type of connection string we're dealing with.
   * Returns: 'atlas' | 'cosmos' | 'docdb' | 'standard'
   */
  function detectUriType(uri) {
    if (!uri) return 'standard';
    const l = uri.toLowerCase();
    if (l.includes('cosmos.azure.com') || l.includes('cosmosdb')) return 'cosmos';
    if (l.includes('docdb.amazonaws.com') || l.includes('documentdb'))  return 'docdb';
    if (l.includes('mongodb+srv') || l.includes('mongodb.net'))         return 'atlas';
    return 'standard';
  }

  const TYPE_LABELS = {
    atlas:    'MongoDB Atlas (SRV)',
    cosmos:   'Azure CosmosDB',
    docdb:    'AWS DocumentDB',
    standard: 'MongoDB Standard',
  };

  async function request(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body !== undefined) opts.body = JSON.stringify(body);

    let res;
    try {
      res = await fetch(BASE + path, opts);
    } catch (err) {
      throw new Error('Cannot reach local server. Is `node server.js` running?');
    }

    const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  return {
    detectUriType,
    TYPE_LABELS,

    /** Test + register a connection on the server */
    connect(uri, name) {
      return request('POST', '/connect', { uri, name });
    },

    /** Disconnect and release a connection */
    disconnect(connectionId) {
      return request('DELETE', `/connect/${connectionId}`);
    },

    /** List databases */
    databases(connectionId) {
      return request('GET', `/${connectionId}/databases`);
    },

    /** List collections in a database */
    collections(connectionId, db) {
      return request('GET', `/${connectionId}/${encodeURIComponent(db)}/collections`);
    },

    /** List documents with optional pagination + filter */
    documents(connectionId, db, col, { page = 1, limit = 20, q = '' } = {}) {
      const params = new URLSearchParams({ page, limit });
      if (q) params.set('q', q);
      return request('GET', `/${connectionId}/${encodeURIComponent(db)}/${encodeURIComponent(col)}/documents?${params}`);
    },

    /** Get a single document */
    getDocument(connectionId, db, col, id) {
      return request('GET', `/${connectionId}/${encodeURIComponent(db)}/${encodeURIComponent(col)}/documents/${encodeURIComponent(id)}`);
    },

    /** Create a document */
    createDocument(connectionId, db, col, doc) {
      return request('POST', `/${connectionId}/${encodeURIComponent(db)}/${encodeURIComponent(col)}/documents`, doc);
    },

    /** Replace a document */
    updateDocument(connectionId, db, col, id, doc) {
      return request('PUT', `/${connectionId}/${encodeURIComponent(db)}/${encodeURIComponent(col)}/documents/${encodeURIComponent(id)}`, doc);
    },

    /** Delete a document */
    deleteDocument(connectionId, db, col, id) {
      return request('DELETE', `/${connectionId}/${encodeURIComponent(db)}/${encodeURIComponent(col)}/documents/${encodeURIComponent(id)}`);
    },
  };
})();
