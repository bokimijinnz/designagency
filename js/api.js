/*
 * Data layer used by every page.
 *
 * Two modes, picked automatically:
 *  - server: when /api/health answers (run `node server/server.js`). Requests,
 *    messages and files are stored on the server, so you and your client see
 *    the same project from different devices.
 *  - local:  when the site is opened as plain files or on static hosting.
 *    Everything is stored in this browser's localStorage. Good for trying the
 *    whole flow (open the portal and admin in two tabs), not for real clients.
 */
(function () {
  'use strict';
  const CFG = window.STUDIO_CONFIG || {};
  const W = window.Workflow;
  const BASE = CFG.apiBase || '';
  const DB_KEY = 'whetu.db.v1', SES = 'whetu.session.', TOK = 'whetu.token.';
  const LOCAL_FILE_LIMIT = 350 * 1024;

  const ls = {
    get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };

  /* ---------------- mode detection ---------------- */
  let modeP = null;
  function mode() {
    if (!modeP) modeP = (async () => {
      if (CFG.mode === 'local' || location.protocol === 'file:') return 'local';
      try {
        const r = await fetch(BASE + '/api/health', { cache: 'no-store' });
        if (r.ok && (await r.json()).ok) return 'server';
      } catch (e) { /* no server */ }
      return 'local';
    })();
    return modeP;
  }

  /* ---------------- change notifications ---------------- */
  const subs = new Set();
  const emit = () => subs.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
  addEventListener('storage', e => { if (e.key === DB_KEY) emit(); });
  let pollT = null;
  function subscribe(fn) {
    subs.add(fn);
    mode().then(m => {
      if (m === 'server' && !pollT) pollT = setInterval(() => { if (!document.hidden) emit(); }, CFG.pollMs || 8000);
    });
    return () => subs.delete(fn);
  }

  /* ---------------- local store ---------------- */
  function db() {
    const d = ls.get(DB_KEY) || {};
    d.requests = d.requests || {};
    return d;
  }
  function saveDb(d) {
    if (!ls.set(DB_KEY, d)) throw new Error('This browser\'s storage is full. Remove large attachments, or run the site in server mode.');
    emit();
  }
  const role2 = r => (r === 'studio' ? 'studio' : 'client');

  function localSession(role) {
    const s = ls.get(SES + role);
    if (!s) return null;
    if (role === 'client') {
      const own = Object.values(db().requests).some(r => r.client.email === s.email);
      if (!own) { ls.del(SES + role); return null; }
    }
    return s;
  }
  function localOwn(role, id) {
    const d = db(), r = d.requests[id];
    const s = localSession(role);
    if (!s) throw Object.assign(new Error('Please sign in again.'), { status: 401 });
    if (!r || (role === 'client' && r.client.email !== s.email)) throw Object.assign(new Error('Project not found.'), { status: 404 });
    return { d, r };
  }

  /* ---------------- server helper ---------------- */
  async function http(method, path, body, role) {
    const h = {};
    const t = role && ls.get(TOK + role);
    if (t) h.Authorization = 'Bearer ' + t;
    let b;
    if (body instanceof Blob) { b = body; h['Content-Type'] = 'application/octet-stream'; }
    else if (body !== undefined) { b = JSON.stringify(body); h['Content-Type'] = 'application/json'; }
    const r = await fetch(BASE + path, { method, headers: h, body: b, cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (r.status === 401 && role) ls.del(TOK + role);
      throw Object.assign(new Error(j.error || 'Something went wrong. Please try again.'), { code: j.code, status: r.status });
    }
    return j;
  }
  const wrap = e => { if (e instanceof W.WorkflowError) throw Object.assign(new Error(e.message), { code: e.code }); throw e; };

  /* ---------------- public API ---------------- */
  const API = {
    mode, subscribe, emit,

    async createRequest(input) {
      if (await mode() === 'server') return http('POST', '/api/requests', input);
      const d = db();
      let r;
      try { r = W.createRequest(input, { taken: id => !!d.requests[id] }); } catch (e) { wrap(e); }
      d.requests[r.id] = r;
      saveDb(d);
      return { id: r.id, accessCode: r.accessCode, email: r.client.email };
    },

    async login(role, creds) {
      role = role2(role);
      if (await mode() === 'server') {
        const j = await http('POST', '/api/auth/' + role, creds);
        ls.set(TOK + role, j.token);
        return j;
      }
      if (role === 'studio') {
        if (!creds.password || creds.password !== (CFG.demoAdminPassword || 'studio')) throw new Error('Wrong password.');
        ls.set(SES + role, { at: Date.now() });
        return { ok: true };
      }
      const email = String(creds.email || '').trim().toLowerCase(), code = String(creds.code || '').trim().toUpperCase();
      const hit = Object.values(db().requests).find(r => r.client.email === email && r.accessCode === code);
      if (!hit) throw new Error('That email and access code don\'t match a project.');
      ls.set(SES + role, { email, at: Date.now() });
      return { ok: true, email };
    },

    // Demo mode: make sure there is a sample project to look at, then sign in.
    async demoSignIn(role) {
      if (await mode() !== 'local' || !CFG.demoAutoLogin) return false;
      role = role2(role);
      const d = db();
      let list = Object.values(d.requests).sort((a, b) => b.updatedAt - a.updatedAt);
      if (!list.length) {
        const now = Date.now() - 3 * 864e5;
        let r = W.createRequest({
          client: { name: 'Jane Smith', email: 'jane@kiwicoffee.co.nz', role: 'Owner' },
          biz: 'Kiwi Coffee Roasters', lang: 'en', services: ['brand', 'web'],
          answers: { biz: 'Kiwi Coffee Roasters', ind: 'Hospitality', what: 'We roast and sell specialty coffee to cafés and online.', region: 'Auckland', why: 'Look more professional so we can win bigger clients.', problem: 'Our logo looks dated and customers don\'t remember us.', b_feel: ['Warm', 'Local', 'Trustworthy'], pages: '5', deadline: 'A planned month', date: 'End of November', budget: '$2,500 to $5,000', name: 'Jane Smith', email: 'jane@kiwicoffee.co.nz' },
          estimate: { lines: [['BRAND-01 Brand Starter', 1090], ['WEB-05 Website, up to 5 pages', 1690], ['LAUNCH-01 Launch bundle saving', -490]], manual: [], sub: 2290, gst: 343.5, tot: 2633.5, weeks: [6, 9] }
        }, { now, taken: id => !!d.requests[id] });
        r = W.apply(r, 'client', 'message', { text: 'Hi! Could the website be ready before our shop opens at the end of November?' }, now + 36e5);
        r = W.apply(r, 'studio', 'start_review', {}, now + 864e5);
        r = W.apply(r, 'studio', 'message', { text: 'Hi Jane, yes, end of November works if we start next week. Your quote is below.' }, now + 864e5 + 6e5);
        r = W.apply(r, 'studio', 'publish_quote', {
          lines: [{ label: 'BRAND-01 Brand Starter', amount: 1090 }, { label: 'WEB-05 Website, up to 5 pages', amount: 1690 }, { label: 'LAUNCH-01 Launch bundle saving', amount: -490 }],
          weeks: '6–9 weeks from design start', validDays: 14,
          includes: 'Two logo directions with rationale\nColour and type, mini brand guide\nBusiness card\n5-page website design and basic build',
          excludes: 'Domain, hosting and paid tools\nPrinting', notes: 'Sample project for the demo. Try accepting the quote, then switch to the designer portal.'
        }, now + 864e5 + 9e5);
        r.read.client = now + 864e5;
        d.requests[r.id] = r;
        saveDb(d);
        list = [r];
      }
      if (role === 'studio') ls.set(SES + role, { at: Date.now() });
      else ls.set(SES + role, { email: list[0].client.email, at: Date.now() });
      return true;
    },

    async session(role) {
      role = role2(role);
      if (await mode() === 'server') {
        if (!ls.get(TOK + role)) return null;
        try { const j = await http('GET', '/api/me', undefined, role); return j.role === role ? j : null; } catch (e) { return null; }
      }
      return localSession(role);
    },

    async logout(role) {
      role = role2(role);
      if (await mode() === 'server') { try { await http('POST', '/api/logout', {}, role); } catch (e) { /* ignore */ } ls.del(TOK + role); return; }
      ls.del(SES + role);
    },

    async list(role) {
      role = role2(role);
      if (await mode() === 'server') return (await http('GET', '/api/requests', undefined, role)).requests;
      const s = localSession(role);
      if (!s) throw Object.assign(new Error('Please sign in again.'), { status: 401 });
      return Object.values(db().requests)
        .filter(r => role === 'studio' || r.client.email === s.email)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map(r => W.view(r, role));
    },

    async get(role, id) {
      role = role2(role);
      if (await mode() === 'server') return (await http('GET', '/api/requests/' + encodeURIComponent(id), undefined, role)).request;
      return W.view(localOwn(role, id).r, role);
    },

    async act(role, id, action, data) {
      role = role2(role);
      if (await mode() === 'server') return (await http('POST', '/api/requests/' + encodeURIComponent(id) + '/actions', { action, data }, role)).request;
      const { d, r } = localOwn(role, id);
      let next;
      try { next = W.apply(r, role, action, data); } catch (e) { wrap(e); }
      d.requests[id] = next;
      saveDb(d);
      return W.view(next, role);
    },

    // Uploads one file and returns its metadata ({id, name, size, …}).
    async upload(role, id, file, kind) {
      role = role2(role);
      if (await mode() === 'server') {
        const q = '?name=' + encodeURIComponent(file.name) + '&type=' + encodeURIComponent(file.type || '') + '&kind=' + encodeURIComponent(kind || 'message');
        return (await http('POST', '/api/requests/' + encodeURIComponent(id) + '/files' + q, file, role)).file;
      }
      const { d, r } = localOwn(role, id);
      let url = '';
      if (file.size <= LOCAL_FILE_LIMIT) {
        url = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });
      }
      const out = W.addFile(r, { name: file.name, size: file.size, type: file.type, kind, url }, role);
      d.requests[id] = out.req;
      saveDb(d);
      return Object.assign({ localOnly: !url }, out.file);
    },

    fileUrl(role, reqId, f) {
      if (!f) return '';
      if (f.url) return f.url;
      const t = ls.get(TOK + role2(role));
      return t ? BASE + '/api/files/' + encodeURIComponent(reqId) + '/' + encodeURIComponent(f.id) + '?t=' + encodeURIComponent(t) : '';
    },

    /* ---------- Journal (posts) and Work (works) ---------- */
    content: {
      async list(type, opts) {
        const all = opts && opts.all;
        let items;
        if (await mode() === 'server') items = (await http('GET', '/api/' + type + (all ? '?all=1' : ''), undefined, all ? 'studio' : undefined)).items;
        else items = (db()[type] || (window.SEED ? window.SEED[type] : [])).slice();
        if (!all) items = items.filter(x => x.published !== false);
        if (type === 'posts') items.sort((a, b) => String(b.date).localeCompare(String(a.date)));
        return items;
      },
      async get(type, slug) {
        const items = await API.content.list(type, { all: false });
        return items.find(x => x.slug === slug) || null;
      },
      async save(type, item, oldSlug) {
        if (await mode() === 'server') return (await http('PUT', '/api/' + type + '/' + encodeURIComponent(oldSlug || item.slug), item, 'studio')).item;
        if (!localSession('studio')) throw new Error('Please sign in again.');
        const d = db();
        const items = (d[type] || (window.SEED ? window.SEED[type] : [])).slice();
        const i = items.findIndex(x => x.slug === (oldSlug || item.slug));
        if (item.slug !== oldSlug && items.some(x => x.slug === item.slug)) throw new Error('Another entry already uses this URL slug.');
        if (i >= 0) items[i] = item; else items.unshift(item);
        d[type] = items;
        saveDb(d);
        return item;
      },
      async remove(type, slug) {
        if (await mode() === 'server') return http('DELETE', '/api/' + type + '/' + encodeURIComponent(slug), undefined, 'studio');
        if (!localSession('studio')) throw new Error('Please sign in again.');
        const d = db();
        d[type] = (d[type] || (window.SEED ? window.SEED[type] : [])).filter(x => x.slug !== slug);
        saveDb(d);
      },
      // Image for a post or project cover. Returns a URL to store on the item.
      async uploadMedia(file) {
        if (await mode() === 'server') return (await http('POST', '/api/media?name=' + encodeURIComponent(file.name), file, 'studio')).url;
        if (file.size > LOCAL_FILE_LIMIT) throw new Error('In demo mode images must be under 350 KB. Run server mode for larger images.');
        return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });
      }
    }
  };

  window.API = API;
})();
