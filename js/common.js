/*
 * Shared by every page: header, footer, language switch, small helpers,
 * and a tiny Markdown renderer for Journal posts and Work case studies.
 */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const money = n => (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-NZ', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
const fmtDate = (ms, withTime) => {
  if (!ms) return '';
  const d = new Date(ms);
  return withTime
    ? d.toLocaleString(LOC(), { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString(LOC(), { day: 'numeric', month: 'short', year: 'numeric' });
};
const fmtSize = b => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
const qs = k => new URLSearchParams(location.search).get(k);

const Site = {
  langHooks: [],
  onLang(fn) { this.langHooks.push(fn); },

  setLang(l) {
    LANG = ['en', 'ko', 'zh'].includes(l) ? l : 'en';
    try { localStorage.setItem('whetu.lang', LANG); } catch (e) { /* ignore */ }
    document.documentElement.lang = LANG == 'zh' ? 'zh-Hans' : LANG;
    const ls = $('#langsel');
    if (ls) ls.value = LANG;
    this.langHooks.forEach(fn => fn());
    apply(document.body);
  },

  header() {
    const hd = $('#hd');
    if (!hd) return;
    const page = document.body.dataset.page || '';
    const cfg = window.STUDIO_CONFIG || {};
    const on = p => (page === p ? ' aria-current="page"' : '');
    hd.innerHTML = `<div class="w hb">
      <a class="logo" href="index.html"><span class="gh lg" role="img" aria-label="WHETŪ mascot"></span><span>${esc(cfg.name || 'WHETŪ STUDIO')}</span></a>
      <nav id="nv">
        <a href="work.html"${on('work')}>Work</a>
        <a href="journal.html"${on('journal')}>Journal</a>
        <a href="index.html#how">How It Works</a>
        <a href="index.html#pricing">Pricing</a>
        <a href="login.html"${on('login') || on('portal')}>Client login</a>
        ${cfg.demoAutoLogin ? `<a href="admin.html"${on('admin')}>Designer portal</a>` : ''}
        <a class="btn sm" href="estimate.html">Get an Estimate ↗</a>
      </nav>
      <div class="hr">
        <div class="lsw"><select id="langsel" aria-label="Language"><option value="en">English</option><option value="ko">한국어</option><option value="zh">中文</option></select></div>
        <button id="menu" aria-expanded="false" aria-controls="nv">Menu</button>
      </div></div>`;
    $('#langsel').value = LANG;
    $('#langsel').addEventListener('change', e => Site.setLang(e.target.value));
    $('#menu').onclick = e => { const o = $('#nv').classList.toggle('o'); e.currentTarget.setAttribute('aria-expanded', o); };
    $('#nv').onclick = e => { if (e.target.tagName == 'A') $('#nv').classList.remove('o'); };

    // Dark, transparent header while the home hero is on screen; light everywhere else.
    const hero = $('.hero');
    if (!hero) { hd.classList.add('lt'); return; }
    new IntersectionObserver(en => hd.classList.toggle('lt', !en[0].isIntersecting), { rootMargin: '-68px 0px 0px 0px' }).observe(hero);
  },

  footer() {
    const ft = $('#ft');
    if (!ft) return;
    const cfg = window.STUDIO_CONFIG || {};
    ft.innerHTML = `<div class="w">
      <span><b>${esc(cfg.name || 'WHETŪ STUDIO')}</b><br>${esc(cfg.tagline || '')}</span>
      <span class="fl"><a href="work.html">Work</a> · <a href="journal.html">Journal</a> · <a href="index.html#pricing">Pricing</a> · <a href="estimate.html">Get an estimate</a> · <a href="login.html">Client login</a> · <a href="admin.html">Studio</a></span>
      <span>Support email for sign-in, accessibility and legal matters only.<br><a href="mailto:${esc(cfg.contactEmail || '')}">${esc(cfg.contactEmail || '')}</a></span>
    </div>`;
  },

  toast(msg) {
    let t = $('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove('on'), 3200);
  },

  init() {
    document.documentElement.lang = LANG == 'zh' ? 'zh-Hans' : LANG;
    this.header();
    this.footer();
    apply(document.body);
  }
};

/* ---------- Markdown subset (safe: everything is escaped first) ---------- */
const safeUrl = u => /^(https?:\/\/|\/|#|mailto:|[\w-]+\.html|assets\/|data:image\/(png|jpe?g|gif|webp);)/i.test(u);
function mdInline(s) {
  return esc(s)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, a, u) => safeUrl(u) ? `<img src="${u}" alt="${a}" loading="lazy">` : '')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => safeUrl(u) ? `<a href="${u}"${/^https?:/i.test(u) ? ' target="_blank" rel="noopener"' : ''}>${t}</a>` : t)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
}
function md(src) {
  const out = [], lines = String(src || '').replace(/\r/g, '').split('\n');
  let para = [], list = null;
  const flushP = () => { if (para.length) { out.push('<p>' + mdInline(para.join(' ')) + '</p>'); para = []; } };
  const flushL = () => { if (list) { out.push(`<${list.t}>` + list.items.map(i => '<li>' + mdInline(i) + '</li>').join('') + `</${list.t}>`); list = null; } };
  for (const raw of lines) {
    const l = raw.trim();
    let m;
    if (!l) { flushP(); flushL(); continue; }
    if ((m = l.match(/^(#{2,3})\s+(.*)$/))) { flushP(); flushL(); out.push(`<h${m[1].length}>${mdInline(m[2])}</h${m[1].length}>`); continue; }
    if ((m = l.match(/^>\s?(.*)$/))) { flushP(); flushL(); out.push('<blockquote>' + mdInline(m[1]) + '</blockquote>'); continue; }
    if ((m = l.match(/^[-*]\s+(.*)$/)) || (m = l.match(/^\d+[.)]\s+(.*)$/))) {
      flushP();
      const t = /^\d/.test(l) ? 'ol' : 'ul';
      if (list && list.t !== t) flushL();
      if (!list) list = { t, items: [] };
      list.items.push(m[1]);
      continue;
    }
    if ((m = l.match(/^!\[[^\]]*\]\([^)]+\)$/))) { flushP(); flushL(); out.push('<figure>' + mdInline(l) + '</figure>'); continue; }
    flushL();
    para.push(l);
  }
  flushP(); flushL();
  return out.join('\n');
}

/* ---------- Cover art for Work and Journal cards ---------- */
// A project cover is either an uploaded image or a generated brand board
// (mark + wordmark in the project's palette), like the portal concept boards.
function workCover(w, big) {
  const c = w.cover || {};
  if (c.image) return `<div class="wc img${big ? ' big' : ''}"><img src="${esc(c.image)}" alt="" loading="lazy"></div>`;
  const shape = c.shape || '0', mark = esc((c.mark || (w.title || 'W')[0] || 'W').toUpperCase());
  return `<div class="wc${big ? ' big' : ''}" style="--ink:${esc(c.ink || '#111')};--ac:${esc(c.accent || '#888')};--lt:${esc(c.light || '#eee')};--pp:${esc(c.paper || '#fff')};--ff:${esc(c.font || 'Inter')};--fw:${esc(c.weight || 600)}">
    <div class="wc-mk" style="border-radius:${esc(shape)}"><span>${mark}</span></div>
    <div class="wc-wm">${esc(w.client || w.title)}</div>
    <div class="wc-sw"><i style="background:${esc(c.ink || '#111')}"></i><i style="background:${esc(c.accent || '#888')}"></i><i style="background:${esc(c.light || '#eee')}"></i></div>
  </div>`;
}
function postCover(p) {
  const c = p.cover || {};
  if (c.image) return `<div class="pc"><img src="${esc(c.image)}" alt="" loading="lazy"></div>`;
  const img = /^orbit-[1-8]$/.test(c.img || '') ? c.img : 'orbit-1';
  return `<div class="pc" style="background:${esc(c.bg || '#f7f7f6')}"><span class="pc-o" style="background-image:url(assets/img/${img}.webp)"></span></div>`;
}

document.addEventListener('DOMContentLoaded', () => Site.init());
