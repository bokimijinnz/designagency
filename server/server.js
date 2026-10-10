#!/usr/bin/env node
/*
 * WHETŪ Studio server — zero dependencies, Node 18+.
 *
 *   ADMIN_PASSWORD='choose-a-long-password' node server/server.js
 *
 * Serves the site and a small JSON API so clients and the studio share the
 * same projects, messages and files. Data lives in server/data/ (JSON + files).
 * Run it behind HTTPS in production (Render, Railway, Fly.io, a VPS + Caddy…).
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const W = require('../js/workflow.js');
const SEED = require('../js/data/seed.js');

const PORT = Number(process.env.PORT) || 8080;
const ROOT = path.resolve(__dirname, '..');
const DATA = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const FILES = path.join(DATA, 'files');
const MEDIA = path.join(DATA, 'media');
const DB_FILE = path.join(DATA, 'db.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const MAX_UPLOAD = (Number(process.env.MAX_UPLOAD_MB) || 25) * 1024 * 1024;
const SESSION_DAYS = 30;

[DATA, FILES, MEDIA].forEach(d => fs.mkdirSync(d, { recursive: true }));

/* ---------------- storage ---------------- */
let db = { requests: {}, sessions: {}, posts: null, works: null };
try { db = Object.assign(db, JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))); } catch (e) { /* first run */ }
if (!db.posts) db.posts = SEED.posts;
if (!db.works) db.works = SEED.works;

let saveT = null;
function save() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, DB_FILE);
  }, 50);
}

/* ---------------- notifications ----------------
 * Hook your email provider in here (Resend, Postmark, SES…). Until then the
 * server prints what it would send, so you can copy access codes manually. */
function notify(event, req, extra) {
  const who = event.startsWith('client:') ? req.client.email : (process.env.STUDIO_EMAIL || 'studio');
  console.log(`[notify] ${event} → ${who} · ${req.id}${extra ? ' · ' + extra : ''}`);
}
const NOTIFY_ON = {
  studio: { publish_quote: 'client:quote', confirm_deposit: 'client:deposit', publish_directions: 'client:directions', publish_version: 'client:version', confirm_balance: 'client:files', message: 'client:message' },
  client: { accept_quote: 'studio:accepted', decline_quote: 'studio:declined', choose_direction: 'studio:direction', submit_round: 'studio:round', add_round: 'studio:extra-round', approve_design: 'studio:approved', message: 'studio:message' }
};

/* ---------------- auth ---------------- */
const tokenHash = t => crypto.createHash('sha256').update(t).digest('hex');
function newSession(role, email) {
  const token = crypto.randomBytes(32).toString('base64url');
  db.sessions[tokenHash(token)] = { role, email: email || '', exp: Date.now() + SESSION_DAYS * 864e5 };
  save();
  return token;
}
function auth(req, url) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : (url.searchParams.get('t') || '');
  if (!t) return null;
  const s = db.sessions[tokenHash(t)];
  if (!s || s.exp < Date.now()) return null;
  return Object.assign({ key: tokenHash(t) }, s);
}
const safeEq = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// Simple per-IP brake on login attempts.
const tries = new Map();
function limited(ip) {
  const now = Date.now(), t = (tries.get(ip) || []).filter(x => now - x < 15 * 60e3);
  t.push(now); tries.set(ip, t);
  return t.length > 20;
}

/* ---------------- helpers ---------------- */
function send(res, status, body, headers) {
  const b = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, headers || {}));
  res.end(b);
}
const err = (res, status, error, code) => send(res, status, { error, code });

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', c => { n += c.length; if (n > limit) { reject(Object.assign(new Error('File is too large.'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJson(req) {
  const b = await readBody(req, 2 * 1024 * 1024);
  try { return JSON.parse(b.toString('utf8') || '{}'); } catch (e) { throw Object.assign(new Error('Invalid JSON.'), { status: 400 }); }
}
const roleOf = s => (s && s.role) || null;
function canSee(s, r) { return s && (s.role === 'studio' || (s.role === 'client' && r.client.email === s.email)); }
const safeName = n => String(n || 'file').replace(/[^\w.\- ]+/g, '_').slice(0, 120) || 'file';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.zip': 'application/zip'
};
const SAFE_INLINE = new Set(['.webp', '.png', '.jpg', '.jpeg', '.gif', '.pdf', '.mp4']);

function serveFile(res, file, opts) {
  fs.stat(file, (e, st) => {
    if (e || !st.isFile()) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain' });
    const ext = path.extname(file).toLowerCase();
    const h = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': st.size, 'X-Content-Type-Options': 'nosniff' };
    if (opts && opts.download) {
      h['Content-Disposition'] = (SAFE_INLINE.has(ext) ? 'inline' : 'attachment') + '; filename="' + safeName(opts.download) + '"';
      h['Cache-Control'] = 'private, max-age=300';
      if (!SAFE_INLINE.has(ext)) h['Content-Type'] = 'application/octet-stream';
    } else {
      h['Cache-Control'] = ext === '.html' ? 'no-cache' : 'public, max-age=3600';
    }
    res.writeHead(200, h);
    fs.createReadStream(file).pipe(res);
  });
}

function contentItem(body) {
  const slug = String(body.slug || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  if (!slug) throw Object.assign(new Error('A URL slug is required.'), { status: 400 });
  return Object.assign({}, body, { slug });
}

/* ---------------- routes ---------------- */
async function api(req, res, url) {
  const p = url.pathname, m = req.method, s = auth(req, url);
  const ip = req.socket.remoteAddress;

  if (p === '/api/health') return send(res, 200, { ok: true });

  if (p === '/api/requests' && m === 'POST') {
    if (limited(ip)) return err(res, 429, 'Too many attempts. Try again in a few minutes.');
    const body = await readJson(req);
    const r = W.createRequest(body, { taken: id => !!db.requests[id] });
    db.requests[r.id] = r; save();
    notify('studio:new-request', r);
    notify('client:access-code', r, 'code ' + r.accessCode);
    return send(res, 201, { id: r.id, accessCode: r.accessCode, email: r.client.email });
  }

  if (p === '/api/auth/client' && m === 'POST') {
    if (limited(ip)) return err(res, 429, 'Too many attempts. Try again in a few minutes.');
    const b = await readJson(req);
    const email = String(b.email || '').trim().toLowerCase(), code = String(b.code || '').trim().toUpperCase();
    const hit = Object.values(db.requests).find(r => r.client.email === email && safeEq(r.accessCode, code));
    if (!hit) return err(res, 401, 'That email and access code don\'t match a project.');
    return send(res, 200, { token: newSession('client', email), email });
  }
  if (p === '/api/auth/studio' && m === 'POST') {
    if (limited(ip)) return err(res, 429, 'Too many attempts. Try again in a few minutes.');
    const b = await readJson(req);
    if (!ADMIN_PASSWORD) return err(res, 503, 'Set the ADMIN_PASSWORD environment variable on the server first.');
    if (!safeEq(b.password || '', ADMIN_PASSWORD)) return err(res, 401, 'Wrong password.');
    return send(res, 200, { token: newSession('studio') });
  }
  if (p === '/api/me') return s ? send(res, 200, { role: s.role, email: s.email }) : err(res, 401, 'Not signed in.');
  if (p === '/api/logout' && m === 'POST') { if (s) { delete db.sessions[s.key]; save(); } return send(res, 200, { ok: true }); }

  if (p === '/api/requests' && m === 'GET') {
    if (!s) return err(res, 401, 'Please sign in again.');
    const list = Object.values(db.requests).filter(r => canSee(s, r)).sort((a, b) => b.updatedAt - a.updatedAt).map(r => W.view(r, s.role));
    return send(res, 200, { requests: list });
  }

  let mm = p.match(/^\/api\/requests\/([\w-]+)(\/actions|\/files)?$/);
  if (mm) {
    const r = db.requests[mm[1]];
    if (!s) return err(res, 401, 'Please sign in again.');
    if (!r || !canSee(s, r)) return err(res, 404, 'Project not found.');
    if (!mm[2] && m === 'GET') return send(res, 200, { request: W.view(r, s.role) });
    if (mm[2] === '/actions' && m === 'POST') {
      const b = await readJson(req);
      const next = W.apply(r, s.role, String(b.action || ''), b.data || {});
      db.requests[r.id] = next; save();
      const ev = (NOTIFY_ON[s.role] || {})[b.action];
      if (ev) notify(ev, next);
      return send(res, 200, { request: W.view(next, s.role) });
    }
    if (mm[2] === '/files' && m === 'POST') {
      const buf = await readBody(req, MAX_UPLOAD);
      if (!buf.length) return err(res, 400, 'Empty file.');
      const name = safeName(url.searchParams.get('name'));
      const out = W.addFile(r, { name, size: buf.length, type: url.searchParams.get('type') || '', kind: url.searchParams.get('kind') || 'message' }, s.role);
      fs.mkdirSync(path.join(FILES, r.id), { recursive: true });
      fs.writeFileSync(path.join(FILES, r.id, out.file.id + path.extname(name).toLowerCase()), buf);
      db.requests[r.id] = out.req; save();
      return send(res, 201, { file: out.file });
    }
  }

  mm = p.match(/^\/api\/files\/([\w-]+)\/([a-z0-9]+)$/);
  if (mm && m === 'GET') {
    const r = db.requests[mm[1]];
    if (!s || !r || !canSee(s, r)) return err(res, 404, 'File not found.');
    const visible = W.view(r, s.role).files.find(f => f.id === mm[2]);
    if (!visible) return err(res, 404, 'File not found.');
    return serveFile(res, path.join(FILES, r.id, visible.id + path.extname(visible.name).toLowerCase()), { download: visible.name });
  }

  if (p === '/api/media' && m === 'POST') {
    if (roleOf(s) !== 'studio') return err(res, 401, 'Please sign in again.');
    const ext = path.extname(safeName(url.searchParams.get('name'))).toLowerCase();
    if (!['.webp', '.png', '.jpg', '.jpeg', '.gif'].includes(ext)) return err(res, 400, 'Use a WEBP, PNG, JPG or GIF image.');
    const buf = await readBody(req, MAX_UPLOAD);
    const name = W.uid() + ext;
    fs.writeFileSync(path.join(MEDIA, name), buf);
    return send(res, 201, { url: '/media/' + name });
  }

  mm = p.match(/^\/api\/(posts|works)(?:\/([\w-]+))?$/);
  if (mm) {
    const type = mm[1], slug = mm[2];
    const all = url.searchParams.get('all') && roleOf(s) === 'studio';
    if (m === 'GET' && !slug) return send(res, 200, { items: db[type].filter(x => all || x.published !== false) });
    if (m === 'GET') { const it = db[type].find(x => x.slug === slug && (all || x.published !== false)); return it ? send(res, 200, { item: it }) : err(res, 404, 'Not found.'); }
    if (roleOf(s) !== 'studio') return err(res, 401, 'Please sign in again.');
    if (m === 'PUT') {
      const item = contentItem(await readJson(req));
      if (item.slug !== slug && db[type].some(x => x.slug === item.slug)) return err(res, 409, 'Another entry already uses this URL slug.');
      const i = db[type].findIndex(x => x.slug === slug);
      if (i >= 0) db[type][i] = item; else db[type].unshift(item);
      save();
      return send(res, 200, { item });
    }
    if (m === 'DELETE') { db[type] = db[type].filter(x => x.slug !== slug); save(); return send(res, 200, { ok: true }); }
  }

  return err(res, 404, 'Not found.');
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (url.pathname.startsWith('/media/')) return serveFile(res, path.join(MEDIA, path.basename(url.pathname)));
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.resolve(ROOT, '.' + rel);
    // Never serve the server folder (data, sessions, uploads) or anything outside the site.
    if (!file.startsWith(ROOT + path.sep) || file.startsWith(path.join(ROOT, 'server') + path.sep)) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain' });
    if (!path.extname(file) && fs.existsSync(file + '.html')) return serveFile(res, file + '.html');
    return serveFile(res, file);
  } catch (e) {
    if (e instanceof W.WorkflowError) return err(res, 400, e.message, e.code);
    if (e.status) return err(res, e.status, e.message);
    console.error(e);
    return err(res, 500, 'Server error.');
  }
});

server.listen(PORT, () => {
  console.log(`WHETŪ Studio running on http://localhost:${PORT}`);
  if (!ADMIN_PASSWORD) console.log('⚠  ADMIN_PASSWORD is not set — studio sign-in is disabled until you set it.');
});
