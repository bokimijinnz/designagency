/*
 * Project workflow: the single source of truth for what the client and the
 * studio can do at each stage. The browser (demo mode) and server/server.js
 * both run this file, so the rules are identical everywhere.
 *
 *   new → reviewing → quoted → accepted → active → approved → complete
 *                        ↘ declined            (studio can cancel / reopen)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Workflow = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CFG = { includedRounds: 2, extraRound: 150, gst: 0.15, quoteValidDays: 14 };

  const STATUS = ['new', 'reviewing', 'quoted', 'accepted', 'active', 'approved', 'complete', 'declined', 'cancelled'];
  // Which stage of the client-facing rail each status belongs to.
  const STAGES = ['Request sent', 'In review', 'Quote', 'Deposit', 'Design', 'Final payment', 'Handover'];
  const STAGE_OF = { new: 1, reviewing: 1, quoted: 2, accepted: 3, active: 4, approved: 5, complete: 7, declined: 2, cancelled: 1 };
  const AREAS = ['logo', 'col', 'type', 'layout', 'words', 'other'];
  // The design brief clients fill in after the quote (kept short on purpose).
  const BRIEF_KEYS = ['story', 'audience', 'feel', 'admire', 'avoid', 'have'];

  class WorkflowError extends Error {
    constructor(code, msg) { super(msg || code); this.code = code; }
  }
  const fail = (code, msg) => { throw new WorkflowError(code, msg); };

  function rand(n, alphabet) {
    const a = alphabet || 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const buf = new Uint32Array(n);
    globalThis.crypto.getRandomValues(buf);
    let s = '';
    for (let i = 0; i < n; i++) s += a[buf[i] % a.length];
    return s;
  }
  const uid = () => rand(12, 'abcdefghijklmnopqrstuvwxyz0123456789');

  const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max || 5000);
  const num = v => { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; };
  const isUrl = v => /^https?:\/\/[^\s<>"']+$/i.test(v || '');
  const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || '');
  const clone = o => JSON.parse(JSON.stringify(o));

  /* ---------- creating a request from the estimate form ---------- */
  function createRequest(input, opts) {
    opts = opts || {};
    const now = opts.now || Date.now();
    const email = str(input.client && input.client.email, 200).toLowerCase();
    if (!isEmail(email)) fail('bad_email', 'A valid email is required.');
    const taken = opts.taken || (() => false);
    let id;
    do { id = 'REQ-' + new Date(now).getFullYear() + '-' + rand(4, '0123456789'); } while (taken(id));
    const est = input.estimate || {};
    const lines = Array.isArray(est.lines) ? est.lines.slice(0, 30).map(l => [str(l[0], 200), num(l[1])]) : [];
    return {
      id, createdAt: now, updatedAt: now, status: 'new',
      accessCode: rand(6),
      client: { name: str(input.client.name, 120), email, role: str(input.client.role, 120) },
      biz: str(input.biz, 160) || 'Your business',
      lang: ['en', 'ko', 'zh'].includes(input.lang) ? input.lang : 'en',
      services: Array.isArray(input.services) ? input.services.slice(0, 12).map(s => str(s, 20)) : [],
      answers: sanitizeAnswers(input.answers),
      estimate: {
        lines,
        manual: Array.isArray(est.manual) ? est.manual.slice(0, 20).map(m => str(m, 200)) : [],
        sub: num(est.sub), gst: num(est.gst), tot: num(est.tot),
        weeks: Array.isArray(est.weeks) ? est.weeks.slice(0, 2).map(num) : [0, 0]
      },
      quote: null, quoteHistory: [],
      design: { directions: [], chosen: null, chosenAt: 0, chosenNote: '', versions: [], rounds: [], extraRounds: 0, included: CFG.includedRounds },
      finalFiles: [], finalLink: '', files: [], brief: null, ai: {},
      messages: [{ id: uid(), by: 'system', key: 'request_sent', args: {}, text: '', files: [], at: now }],
      read: { client: now, studio: 0 },
      internalNote: ''
    };
  }

  function sanitizeAnswers(a) {
    const out = {};
    if (!a || typeof a !== 'object') return out;
    Object.keys(a).slice(0, 200).forEach(k => {
      const key = str(k, 40);
      const v = a[k];
      out[key] = Array.isArray(v) ? v.slice(0, 30).map(x => str(x, 200)) : str(v, 3000);
    });
    return out;
  }

  /* ---------- derived values ---------- */
  const lastRound = r => r.design.rounds[r.design.rounds.length - 1];
  const pending = r => { const l = lastRound(r); return !!(l && !l.done); };
  const allowedRounds = r => r.design.included + r.design.extraRounds;
  const usedRounds = r => r.design.rounds.length;

  function money(r) {
    const q = r.quote;
    const total = q ? q.total : 0;
    const extras = r.design.extraRounds * CFG.extraRound;
    return { total, deposit: total / 2, extras, balance: total / 2 + extras };
  }

  function quoteTotals(lines) {
    const sub = lines.reduce((a, l) => a + l.amount, 0);
    const gst = Math.round(sub * CFG.gst * 100) / 100;
    return { sub, gst, total: Math.round((sub + gst) * 100) / 100 };
  }

  // What the client is waiting on / what they need to do next.
  function phase(r) {
    if (r.status !== 'active') return r.status;
    const d = r.design;
    if (!d.directions.length) return 'preparing';
    if (!d.chosen) return 'choose';
    if (pending(r)) return 'revising';
    if (usedRounds(r) >= allowedRounds(r)) return 'rounds_used';
    return 'review';
  }

  function unread(r, role) {
    const since = (r.read && r.read[role]) || 0;
    return r.messages.filter(m => m.at > since && m.by !== role && m.by !== 'system').length;
  }

  /* ---------- actions ---------- */
  function sys(r, key, args, now) {
    r.messages.push({ id: uid(), by: 'system', key, args: args || {}, text: '', files: [], at: now });
  }
  function fileIds(r, ids) {
    if (!Array.isArray(ids)) return [];
    const known = new Set(r.files.map(f => f.id));
    return ids.filter(id => known.has(id)).slice(0, 20);
  }
  function need(cond, code, msg) { if (!cond) fail(code, msg); }

  const ACTIONS = {
    message: {
      roles: ['client', 'studio'],
      run(r, d, role, now) {
        const text = str(d.text, 5000), files = fileIds(r, d.files);
        need(text || files.length, 'empty', 'Write a message or attach a file.');
        r.messages.push({ id: uid(), by: role, text, files, at: now });
        r.read[role] = now;
      }
    },
    mark_read: { roles: ['client', 'studio'], quiet: true, run(r, d, role, now) { r.read[role] = now; } },

    start_review: {
      roles: ['studio'], from: ['new'],
      run(r, d, role, now) { r.status = 'reviewing'; sys(r, 'review_started', {}, now); }
    },
    publish_quote: {
      roles: ['studio'], from: ['new', 'reviewing', 'quoted'],
      run(r, d, role, now) {
        const lines = (Array.isArray(d.lines) ? d.lines : [])
          .map(l => ({ label: str(l.label, 200), amount: num(l.amount) }))
          .filter(l => l.label);
        need(lines.length, 'no_lines', 'Add at least one line item.');
        const t = quoteTotals(lines);
        need(t.total > 0, 'zero_total', 'The quote total must be more than zero.');
        const link = str(d.paymentLink, 500);
        need(!link || isUrl(link), 'bad_link', 'Payment link must start with https://');
        if (r.quote) r.quoteHistory.push(r.quote);
        const version = (r.quote ? r.quote.version : 0) + 1;
        const days = Math.min(90, Math.max(1, num(d.validDays) || CFG.quoteValidDays));
        r.quote = {
          id: 'QUO-' + r.id.slice(4), version, lines, sub: t.sub, gst: t.gst, total: t.total,
          weeks: str(d.weeks, 40),
          includes: str(d.includes, 3000), excludes: str(d.excludes, 3000), notes: str(d.notes, 3000),
          paymentLink: link,
          validUntil: now + days * 864e5, publishedAt: now
        };
        r.status = 'quoted';
        sys(r, 'quote_published', { v: version }, now);
      }
    },
    accept_quote: {
      roles: ['client'], from: ['quoted'],
      run(r, d, role, now) {
        need(r.quote && Number(d.version) === r.quote.version, 'stale', 'This quote has changed. Please review the latest version.');
        need(now <= r.quote.validUntil, 'expired', 'This quote has expired. Ask your designer for an updated one.');
        r.status = 'accepted'; r.acceptedAt = now;
        sys(r, 'quote_accepted', { v: r.quote.version }, now);
      }
    },
    decline_quote: {
      roles: ['client'], from: ['quoted'],
      run(r, d, role, now) {
        r.status = 'declined'; r.declinedAt = now;
        sys(r, 'quote_declined', {}, now);
        const why = str(d.reason, 2000);
        if (why) r.messages.push({ id: uid(), by: 'client', text: why, files: [], at: now });
      }
    },
    confirm_deposit: {
      roles: ['studio'], from: ['accepted'],
      run(r, d, role, now) { r.status = 'active'; r.depositAt = now; sys(r, 'deposit_confirmed', {}, now); }
    },
    publish_directions: {
      roles: ['studio'], from: ['active'],
      run(r, d, role, now) {
        need(!r.design.chosen, 'chosen', 'The client has already chosen a direction.');
        const list = (Array.isArray(d.directions) ? d.directions : []).slice(0, 3).map((x, i) => ({
          key: 'ABC'[i], title: str(x.title, 80) || 'Direction ' + 'ABC'[i], desc: str(x.desc, 1000),
          files: fileIds(r, x.files), demo: ['A', 'B', 'C'].includes(x.demo) ? x.demo : null,
          link: isUrl(str(x.link, 500)) ? str(x.link, 500) : ''
        }));
        need(list.length, 'no_dirs', 'Add at least one direction.');
        need(list.every(x => x.files.length || x.demo || x.link), 'no_visual', 'Each direction needs an image, a PDF, a Figma link or a demo board.');
        r.design.directions = list;
        sys(r, 'directions_published', { n: list.length }, now);
      }
    },
    choose_direction: {
      roles: ['client'], from: ['active'],
      run(r, d, role, now) {
        const dir = r.design.directions.find(x => x.key === d.key);
        need(dir, 'no_dir', 'Choose one of the directions.');
        need(!r.design.chosen, 'chosen', 'A direction is already chosen.');
        r.design.chosen = dir.key; r.design.chosenAt = now; r.design.chosenNote = str(d.note, 2000);
        r.design.versions = [{ n: 1, note: '', files: dir.files.slice(), demo: dir.demo, link: dir.link || '', at: now }];
        sys(r, 'direction_chosen', { d: dir.key }, now);
      }
    },
    submit_round: {
      roles: ['client'], from: ['active'],
      run(r, d, role, now) {
        need(r.design.chosen, 'no_dir', 'Choose a direction first.');
        need(!pending(r), 'pending', 'Your designer is still working on the last round.');
        need(usedRounds(r) < allowedRounds(r), 'no_rounds', 'All revision rounds are used.');
        const areas = (Array.isArray(d.areas) ? d.areas : []).filter(a => AREAS.includes(a));
        const t1 = str(d.t1, 5000), t2 = str(d.t2, 3000);
        need(t1 || areas.length, 'empty', 'Tell us what to change.');
        const n = usedRounds(r) + 1;
        r.design.rounds.push({ n, areas, t1, t2, files: fileIds(r, d.files), at: now, extra: n > r.design.included, done: false, onVersion: r.design.versions.length });
        sys(r, 'round_submitted', { n }, now);
      }
    },
    add_round: {
      roles: ['client'], from: ['active'],
      run(r, d, role, now) {
        need(r.design.chosen && !pending(r), 'not_now', 'You can add a round once the current version is delivered.');
        need(usedRounds(r) >= allowedRounds(r), 'has_rounds', 'You still have revision rounds left.');
        r.design.extraRounds++;
        sys(r, 'round_added', { price: CFG.extraRound }, now);
      }
    },
    publish_version: {
      roles: ['studio'], from: ['active'],
      run(r, d, role, now) {
        need(r.design.chosen, 'no_dir', 'The client has not chosen a direction yet.');
        const files = fileIds(r, d.files);
        const demo = d.demo ? r.design.chosen : null;
        const n = r.design.versions.length + 1;
        const link = str(d.link, 500);
        need(!link || isUrl(link), 'bad_link', 'Links must start with https://');
        need(files.length || demo || link, 'no_visual', 'Attach an image, a PDF or a Figma link.');
        r.design.versions.push({ n, note: str(d.note, 3000), files, demo, link, at: now });
        const l = lastRound(r);
        if (l && !l.done) { l.done = true; l.deliveredAs = n; }
        sys(r, 'version_published', { n }, now);
      }
    },
    approve_design: {
      roles: ['client'], from: ['active'],
      run(r, d, role, now) {
        need(r.design.chosen && !pending(r), 'not_now', 'Wait for the next version before approving.');
        r.status = 'approved'; r.approvedAt = now;
        sys(r, 'design_approved', { v: r.design.versions.length }, now);
      }
    },
    deliver_files: {
      roles: ['studio'], from: ['active', 'approved', 'complete'],
      run(r, d, role, now) {
        const files = fileIds(r, d.files);
        const link = str(d.link, 500);
        need(!link || isUrl(link), 'bad_link', 'Links must start with https://');
        need(files.length || link, 'no_files', 'Upload the final files or add a Figma link first.');
        r.finalFiles = files;
        if (d.link !== undefined) r.finalLink = link;
        files.forEach(id => { const f = r.files.find(x => x.id === id); if (f) f.kind = 'final'; });
        if (r.status === 'complete') sys(r, 'final_ready', {}, now);
      }
    },
    confirm_balance: {
      roles: ['studio'], from: ['approved'],
      run(r, d, role, now) {
        r.status = 'complete'; r.completedAt = now;
        sys(r, 'balance_confirmed', {}, now);
        if (r.finalFiles.length) sys(r, 'final_ready', {}, now);
      }
    },
    submit_brief: {
      roles: ['client'], from: ['quoted', 'accepted', 'active'],
      run(r, d, role, now) {
        const b = {};
        BRIEF_KEYS.forEach(k => { const v = d[k]; b[k] = Array.isArray(v) ? v.slice(0, 20).map(x => str(x, 100)) : str(v, 3000); });
        r.brief = Object.assign(b, { at: now });
        sys(r, 'brief_sent', {}, now);
      }
    },
    set_note: { roles: ['studio'], quiet: true, run(r, d) { r.internalNote = str(d.note, 10000); } },
    cancel: {
      roles: ['studio'], from: ['new', 'reviewing', 'quoted', 'accepted', 'active', 'approved'],
      run(r, d, role, now) { r.status = 'cancelled'; sys(r, 'cancelled', {}, now); }
    },
    reopen: {
      roles: ['studio'], from: ['declined', 'cancelled'],
      run(r, d, role, now) { r.status = 'reviewing'; sys(r, 'reopened', {}, now); }
    }
  };

  // Applies an action to a copy of the request and returns the copy.
  function apply(req, role, action, data, now) {
    const a = ACTIONS[action];
    if (!a) fail('unknown_action', 'Unknown action.');
    if (!a.roles.includes(role)) fail('forbidden', 'Not allowed.');
    if (a.from && !a.from.includes(req.status)) fail('wrong_status', 'This step is not available right now.');
    const r = clone(req);
    now = now || Date.now();
    a.run(r, data || {}, role, now);
    if (!a.quiet) r.updatedAt = now;
    return r;
  }

  // Strips what the client must not see.
  function view(req, role) {
    if (role === 'studio') return req;
    const r = clone(req);
    delete r.internalNote;
    delete r.accessCode;
    delete r.ai;
    if (r.status !== 'complete') {
      r.finalLink = '';
      const hidden = new Set(r.finalFiles);
      r.files = r.files.filter(f => !hidden.has(f.id) && f.kind !== 'final');
      r.finalFiles = [];
    }
    return r;
  }

  function addFile(req, meta, by, now) {
    const r = clone(req);
    const f = {
      id: uid(), name: str(meta.name, 200) || 'file', size: num(meta.size), type: str(meta.type, 100),
      by, at: now || Date.now(), kind: str(meta.kind, 20) || 'message', url: meta.url || ''
    };
    r.files.push(f);
    r.updatedAt = f.at;
    return { req: r, file: f };
  }

  return {
    CFG, STATUS, STAGES, STAGE_OF, AREAS, BRIEF_KEYS, WorkflowError,
    createRequest, apply, view, addFile, actions: Object.keys(ACTIONS),
    phase, pending, unread, money, quoteTotals, allowedRounds, usedRounds, lastRound,
    isEmail, isUrl, rand, uid
  };
});
