/**
 * pwaDb — Local MongoDB Proxy Server
 *
 * Supports deployment at any subdirectory via BASE_PATH env var.
 *
 * Examples:
 *   BASE_PATH=/dbtool node server.js          → served at /dbtool/
 *   node server.js                            → served at /  (default)
 *
 * Connection string support:
 *   - Standard:    mongodb://host:port
 *   - Atlas SRV:   mongodb+srv://user:pass@cluster.mongodb.net/
 *   - Azure CosmosDB: mongodb://account.mongo.cosmos.azure.com:10255/?ssl=true
 *   - AWS DocumentDB: mongodb://user:pass@cluster.docdb.amazonaws.com:27017/?tls=true
 */

const express = require('express');
const cors    = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── Base Path ────────────────────────────────────────────────────────────────
// Normalize: ensure it starts with / and has NO trailing slash.
// e.g. "dbtool" → "/dbtool" | "/dbtool/" → "/dbtool" | "" or "/" → ""
let BASE_PATH = (process.env.BASE_PATH || '').trim();
if (BASE_PATH && !BASE_PATH.startsWith('/')) BASE_PATH = '/' + BASE_PATH;
if (BASE_PATH.endsWith('/')) BASE_PATH = BASE_PATH.slice(0, -1);
// BASE_PATH is now either "" (root) or "/something"

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Allow localhost (dev) + any origin set via ALLOWED_ORIGIN env var.
const allowedOrigins = [
  'http://localhost:' + PORT,
  'http://127.0.0.1:' + PORT,
];
if (process.env.ALLOWED_ORIGIN) {
  allowedOrigins.push(...process.env.ALLOWED_ORIGIN.split(',').map(s => s.trim()));
}
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (same-origin, PWA installs, mobile)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    // Also allow if origin matches the host we're running on
    return cb(null, true); // open for local tool; restrict via firewall/auth instead
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// ─── Active client pool ───────────────────────────────────────────────────────
// Map<connectionId, { client, uri, name }>
const clients = new Map();

/**
 * Build MongoClient options based on the connection URI.
 * Auto-detects CosmosDB, DocumentDB, and standard MongoDB.
 */
function buildClientOptions(uri) {
  const opts = {
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 30000,
  };
  const lower = uri.toLowerCase();
  if (lower.includes('cosmos.azure.com') || lower.includes('cosmosdb')) {
    opts.tls = true;
    opts.tlsAllowInvalidCertificates = false;
  } else if (lower.includes('docdb.amazonaws.com') || lower.includes('documentdb')) {
    opts.tls = true;
    opts.tlsAllowInvalidCertificates = false;
    opts.retryWrites = false;
  }
  return opts;
}

function getClient(id) {
  const entry = clients.get(id);
  if (!entry) throw { status: 400, message: 'Connection not found. Please reconnect.' };
  return entry.client;
}

function safeId(id) {
  try { return ObjectId.isValid(id) ? new ObjectId(id) : id; }
  catch { return id; }
}

// ─── Dynamic static files ─────────────────────────────────────────────────────
// These 3 files are served dynamically so they embed the correct BASE_PATH.

/**
 * GET <base>/js/config.js
 * Injects window.__PWADB_BASE__ so the frontend JS knows the base path.
 */
app.get(BASE_PATH + '/js/config.js', (req, res) => {
  res.type('application/javascript');
  res.send(`window.__PWADB_BASE__ = ${JSON.stringify(BASE_PATH)};`);
});

/**
 * GET <base>/manifest.json
 * Dynamic manifest with correct start_url and scope.
 */
app.get(BASE_PATH + '/manifest.json', (req, res) => {
  const base = BASE_PATH || '/';
  const startUrl = BASE_PATH ? BASE_PATH + '/' : '/';
  res.json({
    name: 'pwaDb',
    short_name: 'pwaDb',
    description: 'Mobile-first MongoDB database manager',
    start_url: startUrl,
    scope: base,
    display: 'standalone',
    background_color: '#020617',
    theme_color: '#020617',
    orientation: 'portrait',
    icons: [
      { src: (BASE_PATH || '') + '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: (BASE_PATH || '') + '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
    categories: ['developer', 'utilities'],
    shortcuts: [{
      name: 'Add Connection',
      short_name: 'Connect',
      url: startUrl + '?action=add',
      icons: [{ src: (BASE_PATH || '') + '/icons/icon-192.png', sizes: '192x192' }],
    }],
  });
});

/**
 * GET <base>/sw.js
 * Dynamic service worker with correct cache paths.
 */
app.get(BASE_PATH + '/sw.js', (req, res) => {
  const b = BASE_PATH; // e.g. "/dbtool" or ""
  const STATIC = [
    b + '/',
    b + '/manifest.json',
    b + '/js/config.js',
    b + '/css/variables.css',
    b + '/css/base.css',
    b + '/css/components.css',
    b + '/css/animations.css',
    b + '/js/app.js',
    b + '/js/db.js',
    b + '/js/api.js',
    b + '/js/views/connections.js',
    b + '/js/views/databases.js',
    b + '/js/views/collections.js',
    b + '/js/views/documents.js',
    b + '/js/views/editor.js',
    b + '/js/components/theme.js',
    b + '/js/components/toast.js',
    b + '/js/components/modal.js',
    b + '/icons/icon-192.png',
    b + '/icons/icon-512.png',
  ].filter(Boolean);

  const apiPrefix = b + '/api/';

  res.type('application/javascript');
  res.send(`
const CACHE = 'pwadb-v2';
const STATIC = ${JSON.stringify(STATIC)};
const API_PREFIX = ${JSON.stringify(apiPrefix)};

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(STATIC))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith(API_PREFIX)) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ error: 'Offline — server not reachable' }), {
          status: 503, headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
    }).catch(() => caches.match(${JSON.stringify(BASE_PATH + '/')}))
  );
});
  `.trim());
});

// ─── Static files (everything else under public/) ────────────────────────────
// Mount the public/ directory at BASE_PATH.
const publicDir = path.join(__dirname, 'public');
app.use(BASE_PATH || '/', express.static(publicDir));

// ─── API Routes ───────────────────────────────────────────────────────────────
const api = BASE_PATH + '/api';

/**
 * POST <api>/connect
 * Body: { uri, name }
 */
app.post(api + '/connect', async (req, res) => {
  const { uri, name } = req.body;
  if (!uri) return res.status(400).json({ error: 'URI is required' });

  const connectionId = Buffer.from(uri).toString('base64').slice(0, 16);
  if (clients.has(connectionId)) {
    return res.json({ connectionId, name: clients.get(connectionId).name, uri });
  }

  let client;
  try {
    client = new MongoClient(uri, buildClientOptions(uri));
    await client.connect();
    await client.db('admin').command({ ping: 1 });
    clients.set(connectionId, { client, uri, name: name || uri });
    res.json({ connectionId, name: name || uri, uri });
  } catch (err) {
    if (client) await client.close().catch(() => {});
    res.status(500).json({ error: `Connection failed: ${err.message}` });
  }
});

/**
 * DELETE <api>/connect/:connectionId
 */
app.delete(api + '/connect/:connectionId', async (req, res) => {
  const entry = clients.get(req.params.connectionId);
  if (entry) {
    await entry.client.close().catch(() => {});
    clients.delete(req.params.connectionId);
  }
  res.json({ ok: true });
});

/**
 * GET <api>/:connectionId/databases
 */
app.get(api + '/:connectionId/databases', async (req, res) => {
  try {
    const client = getClient(req.params.connectionId);
    const result = await client.db().admin().listDatabases();
    const dbs = result.databases
      .filter(d => !['admin', 'local', 'config'].includes(d.name))
      .map(d => ({ name: d.name, sizeOnDisk: d.sizeOnDisk, empty: d.empty }));
    res.json(dbs);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * GET <api>/:connectionId/:db/collections
 */
app.get(api + '/:connectionId/:db/collections', async (req, res) => {
  try {
    const client = getClient(req.params.connectionId);
    const db = client.db(req.params.db);
    const collections = await db.listCollections().toArray();
    const withCounts = await Promise.all(
      collections.map(async col => {
        try {
          const count = await db.collection(col.name).estimatedDocumentCount();
          return { name: col.name, type: col.type, count };
        } catch {
          return { name: col.name, type: col.type, count: null };
        }
      })
    );
    res.json(withCounts);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * GET <api>/:connectionId/:db/:collection/documents?page=&limit=&q=
 */
app.get(api + '/:connectionId/:db/:collection/documents', async (req, res) => {
  try {
    const client = getClient(req.params.connectionId);
    const col = client.db(req.params.db).collection(req.params.collection);
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip  = (page - 1) * limit;

    let filter = {};
    if (req.query.q) {
      try { filter = JSON.parse(req.query.q); }
      catch { return res.status(400).json({ error: 'Invalid JSON filter' }); }
    }
    const [docs, total] = await Promise.all([
      col.find(filter).skip(skip).limit(limit).toArray(),
      col.countDocuments(filter),
    ]);
    res.json({ docs, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * GET <api>/:connectionId/:db/:collection/documents/:id
 */
app.get(api + '/:connectionId/:db/:collection/documents/:id', async (req, res) => {
  try {
    const client = getClient(req.params.connectionId);
    const col = client.db(req.params.db).collection(req.params.collection);
    const doc = await col.findOne({ _id: safeId(req.params.id) });
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.json(doc);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * POST <api>/:connectionId/:db/:collection/documents
 */
app.post(api + '/:connectionId/:db/:collection/documents', async (req, res) => {
  try {
    const client = getClient(req.params.connectionId);
    const col = client.db(req.params.db).collection(req.params.collection);
    const doc = req.body;
    delete doc._id;
    const result = await col.insertOne(doc);
    res.json({ insertedId: result.insertedId });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * PUT <api>/:connectionId/:db/:collection/documents/:id
 */
app.put(api + '/:connectionId/:db/:collection/documents/:id', async (req, res) => {
  try {
    const client = getClient(req.params.connectionId);
    const col = client.db(req.params.db).collection(req.params.collection);
    const doc = req.body;
    delete doc._id;
    const result = await col.replaceOne({ _id: safeId(req.params.id) }, doc, { upsert: false });
    res.json({ matchedCount: result.matchedCount, modifiedCount: result.modifiedCount });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * DELETE <api>/:connectionId/:db/:collection/documents/:id
 */
app.delete(api + '/:connectionId/:db/:collection/documents/:id', async (req, res) => {
  try {
    const client = getClient(req.params.connectionId);
    const col = client.db(req.params.db).collection(req.params.collection);
    const result = await col.deleteOne({ _id: safeId(req.params.id) });
    res.json({ deletedCount: result.deletedCount });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ─── Catch-all: serve index.html for all non-API routes under BASE_PATH ───────
app.get(BASE_PATH + '/{*path}', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Also handle exact BASE_PATH (no trailing slash)
if (BASE_PATH) {
  app.get(BASE_PATH, (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

// ─── Cleanup on exit ──────────────────────────────────────────────────────────
async function shutdown() {
  console.log('\nShutting down...');
  for (const [, { client }] of clients) await client.close().catch(() => {});
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  const base = BASE_PATH || '/';
  console.log(`\n🗄  pwaDb server running`);
  console.log(`   Local:  http://localhost:${PORT}${base}`);
  if (BASE_PATH) {
    console.log(`   Path:   ${BASE_PATH} (BASE_PATH env is set)`);
  }
  console.log(`   Open this URL in your browser (or install as PWA)\n`);
});
