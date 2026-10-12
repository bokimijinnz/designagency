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
const AI = require('./agents.js');

const PORT = Number(process.env.PORT) || 8080;
const ROOT = path.resolve(__dirname, '..');
const DATA = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const FILES = path.join(DATA, 'files');
const MEDIA = path.join(DATA, 'media');
const DB_FILE = path.join(DATA, 'db.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const MAX_UPLOAD = (Number(process.env.MAX_UPLOAD_MB) || 25) * 1024 * 1024;
const SESSION_DAYS = 30;
const SITE_URL = (process.env.SITE_URL || '').replace(/\/$/, '');
const STUDIO_EMAIL = process.env.STUDIO_EMAIL || '';
const FROM_EMAIL = process.env.FROM_EMAIL || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';

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

/* ---------------- email ----------------
 * Set RESEND_API_KEY, FROM_EMAIL (a verified sender) and STUDIO_EMAIL to send real
 * email through Resend (resend.com). Without them the server prints what it would send. */
const escHtml = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
async function sendEmail(to, subject, html) {
  if (!RESEND_API_KEY || !FROM_EMAIL || !to) { console.log(`[email] → ${to || '(no address)'} · ${subject}`); return; }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html })
    });
    if (!res.ok) console.error('[email] failed', res.status, await res.text());
  } catch (e) { console.error('[email] failed', e.message); }
}
const wrap = (title, body, link, label) => `<div style="font:15px/1.6 -apple-system,Segoe UI,sans-serif;max-width:560px;color:#111">
  <p style="font-weight:700;letter-spacing:.04em">WHETŪ STUDIO</p><h2 style="font-size:22px;margin:18px 0 8px">${escHtml(title)}</h2>${body}
  ${link ? `<p style="margin:24px 0"><a href="${escHtml(link)}" style="background:#111;color:#fff;padding:12px 20px;text-decoration:none;display:inline-block">${escHtml(label)}</a></p>` : ''}</div>`;
const portalLink = r => SITE_URL ? `${SITE_URL}/login.html?email=${encodeURIComponent(r.client.email)}` : '';
const adminLink = r => SITE_URL ? `${SITE_URL}/admin.html?id=${encodeURIComponent(r.id)}` : '';

function notify(event, r) {
  const toClient = (subject, title, body) => sendEmail(r.client.email, subject, wrap(title, body, portalLink(r), 'Open My Studio'));
  const toStudio = (subject, body) => sendEmail(STUDIO_EMAIL, subject, wrap(subject, body, adminLink(r), 'Open in Studio'));
  const lastText = by => { const m = [...r.messages].reverse().find(x => x.by === by); return m ? escHtml(m.text).replace(/\n/g, '<br>') : ''; };
  switch (event) {
    case 'studio:new-request': {
      const b = r.ai && r.ai.brief && r.ai.brief.data;
      const est = r.estimate.tot ? `NZD ${r.estimate.tot.toFixed(2)} incl. GST (indicative)` : 'No fixed-price items';
      return toStudio(`New request: ${r.biz} (${r.id})`,
        `<p><b>${escHtml(r.client.name)}</b> · ${escHtml(r.client.email)}<br>${escHtml((r.services || []).join(', '))} · ${est}</p>` +
        (b ? `<h3>AI brief</h3><p>${escHtml(b.summary)}</p><ul>${(b.directions || []).map(d => `<li><b>${escHtml(d.key)} · ${escHtml(d.name)}</b> — ${escHtml(d.idea)}</li>`).join('')}</ul>
              <p><b>Questions to ask:</b></p><ul>${(b.questions || []).map(q => `<li>${escHtml(q)}</li>`).join('')}</ul>`
           : (r.ai && r.ai.brief && r.ai.brief.status === 'error' ? `<p>AI brief failed: ${escHtml(r.ai.brief.error)}</p>` : '')));
    }
    case 'client:access-code':
      return toClient('Your WHETŪ Studio request', 'Thanks, your request is in.',
        `<p>Request ${escHtml(r.id)}. Your designer will review it and publish a quote in My Studio.</p><p>Sign in with this email and your access code: <b style="font-size:20px;letter-spacing:.12em">${escHtml(r.accessCode)}</b></p>`);
    case 'client:quote': return toClient('Your quote is ready', 'Your confirmed quote is ready.', `<p>Quote ${escHtml(r.quote.id)} v${r.quote.version}: NZD ${r.quote.total.toFixed(2)} incl. GST.</p>`);
    case 'client:message': return toClient('New message from your designer', 'You have a new message.', `<p>${lastText('studio')}</p>`);
    case 'client:deposit': return toClient('Deposit received', 'Deposit received. Design has started.', '');
    case 'client:directions': return toClient('Your concept directions are ready', 'Your concept directions are ready to review.', '');
    case 'client:version': return toClient('A new design version is ready', 'A new version is ready for your review.', '');
    case 'client:files': return toClient('Your final files are ready', 'Your final files are ready to download.', '');
    case 'studio:message': return toStudio(`New message: ${r.biz}`, `<p>${lastText('client')}</p>`);
    default: return toStudio(`${event.replace('studio:', '').replace(/-/g, ' ')}: ${r.biz} (${r.id})`, '');
  }
}
const NOTIFY_ON = {
  studio: { publish_quote: 'client:quote', confirm_deposit: 'client:deposit', publish_directions: 'client:directions', publish_version: 'client:version', confirm_balance: 'client:files', message: 'client:message' },
  client: { accept_quote: 'studio:quote-accepted', decline_quote: 'studio:quote-declined', choose_direction: 'studio:direction-chosen', submit_round: 'studio:feedback-round', add_round: 'studio:extra-round', approve_design: 'studio:design-approved', submit_brief: 'studio:brief-received', message: 'studio:message' }
};

/* ---------------- AI agents (studio-only drafts) ---------------- */
function setAi(id, key, val) {
  const r = db.requests[id];
  if (!r) return;
  r.ai = r.ai || {};
  r.ai[key] = val;
  r.updatedAt = Date.now();
  save();
}
async function runIntake(id, emailAfter) {
  const r = db.requests[id];
  if (!AI.enabled()) { if (emailAfter) notify('studio:new-request', r); return; }
  setAi(id, 'brief', { status: 'running', at: Date.now() });
  try {
    const data = await AI.intake(db.requests[id]);
    setAi(id, 'brief', { status: 'ready', at: Date.now(), model: AI.MODEL, data });
  } catch (e) {
    console.error('[ai] intake failed', id, e.message);
    setAi(id, 'brief', { status: 'error', at: Date.now(), error: e.message });
  }
  if (emailAfter) notify('studio:new-request', db.requests[id]);
}
async function runRound(id, n) {
  if (!AI.enabled()) return;
  try {
    const data = await AI.round(db.requests[id], n);
    const rounds = Object.assign({}, (db.requests[id].ai || {}).rounds, { [n]: Object.assign({ at: Date.now() }, data) });
    setAi(id, 'rounds', rounds);
  } catch (e) { console.error('[ai] round failed', id, e.message); }
}

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
    notify('client:access-code', r);
    runIntake(r.id, true); // emails the studio when the AI brief is ready (or straight away without AI)
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
      if (b.action === 'submit_round') runRound(r.id, next.design.rounds.length);
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

  if (p === '/api/ai' && m === 'GET') return send(res, 200, { enabled: AI.enabled(), model: AI.MODEL });
  mm = p.match(/^\/api\/requests\/([\w-]+)\/ai\/(intake|reply)$/);
  if (mm && m === 'POST') {
    if (roleOf(s) !== 'studio') return err(res, 401, 'Please sign in again.');
    const r = db.requests[mm[1]];
    if (!r) return err(res, 404, 'Project not found.');
    if (!AI.enabled()) return err(res, 503, 'AI is off. Run npm install and set ANTHROPIC_API_KEY on the server.');
    if (mm[2] === 'intake') { runIntake(r.id, false); return send(res, 202, { ok: true }); }
    try { return send(res, 200, await AI.reply(r)); } catch (e) { return err(res, 502, 'AI draft failed: ' + e.message); }
  }
  if (p === '/api/ai/post' && m === 'POST') {
    if (roleOf(s) !== 'studio') return err(res, 401, 'Please sign in again.');
    if (!AI.enabled()) return err(res, 503, 'AI is off. Run npm install and set ANTHROPIC_API_KEY on the server.');
    const b = await readJson(req);
    if (!String(b.topic || '').trim()) return err(res, 400, 'Write a topic first.');
    try { return send(res, 200, await AI.post(String(b.topic).slice(0, 500), String(b.notes || '').slice(0, 3000))); } catch (e) { return err(res, 502, 'AI draft failed: ' + e.message); }
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
    const relPath = path.relative(ROOT, file);
    if (!file.startsWith(ROOT + path.sep) || /^(server|node_modules|docs)([\\/]|$)|^package(-lock)?\.json$|(^|[\\/])\./.test(relPath)) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain' });
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
  console.log(AI.enabled() ? `AI agents on (${AI.MODEL}).` : 'AI agents off (npm install + ANTHROPIC_API_KEY to turn on).');
  console.log(RESEND_API_KEY && FROM_EMAIL ? 'Email on (Resend).' : 'Email off: printing emails to this console.');
});
