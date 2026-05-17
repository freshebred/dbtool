/**
 * db.js — IndexedDB wrapper for saving MongoDB connection strings.
 * Uses the native IndexedDB API — no external dependencies.
 */
window.DB = (function() {
  const DB_NAME = 'pwadb';
  const DB_VER  = 1;
  const STORE   = 'connections';
  let _db = null;

  function open() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('by_name', 'name', { unique: false });
        }
      };
      req.onsuccess = e => { _db = e.target.result; resolve(_db); };
      req.onerror   = e => reject(e.target.error);
    });
  }

  function tx(mode = 'readonly') {
    return open().then(db => db.transaction(STORE, mode).objectStore(STORE));
  }

  function wrap(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = e => resolve(e.target.result);
      req.onerror   = e => reject(e.target.error);
    });
  }

  /** List all saved connections (sorted by lastUsed desc) */
  async function listConnections() {
    const store = await tx('readonly');
    const all = await wrap(store.getAll());
    return all.sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));
  }

  /** Save or update a connection */
  async function saveConnection(conn) {
    // id is derived from the URI on the server side but we generate here too
    const id = conn.connectionId || btoa(conn.uri).slice(0, 16);
    const record = {
      id,
      name: conn.name || conn.uri,
      uri: conn.uri,
      connectionId: id,
      lastUsed: Date.now(),
      createdAt: conn.createdAt || Date.now(),
    };
    const store = await tx('readwrite');
    await wrap(store.put(record));
    return record;
  }

  /** Delete a connection by id */
  async function deleteConnection(id) {
    const store = await tx('readwrite');
    await wrap(store.delete(id));
  }

  /** Touch lastUsed timestamp */
  async function touchConnection(id) {
    const store = await tx('readwrite');
    const record = await wrap(store.get(id));
    if (record) {
      record.lastUsed = Date.now();
      await wrap(store.put(record));
    }
  }

  return { listConnections, saveConnection, deleteConnection, touchConnection };
})();
