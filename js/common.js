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
    const chev = '<svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M1 1l4 4 4-4"/></svg>';
    const svc = [
      ['Logo & brand identity', 'A mark, colours and type that people remember'],
      ['Website design', 'Page designs for desktop and mobile, in Figma and PDF'],
      ['App design', 'Screens and flows, ready for your developer'],
      ['Print & social', 'Brochures, cards and social templates'],
      ['Signage & spaces', 'Shopfronts, interiors and vehicles'],
      ['Ongoing marketing', 'Social, search ads and blog, every month']
    ];
    hd.innerHTML = `<div class="hb">
      <a class="logo" href="index.html"><span class="gh lg" role="img" aria-label="WHETŪ mascot"></span><span>${esc(cfg.name || 'WHETŪ STUDIO')}</span></a>
      <nav id="nv" aria-label="Main">
        <button class="nv-t" data-mm="svc" aria-expanded="false">Services ${chev}</button>
        <button class="nv-t" data-mm="studio" aria-expanded="false">Studio ${chev}</button>
        <a href="work.html"${on('work')}>Work</a>
        <a href="journal.html"${on('journal')}>Journal</a>
      </nav>
      <div class="hr">
        <a class="hr-l" href="index.html#pricing">Pricing</a>
        <div class="lsw"><select id="langsel" aria-label="Language"><option value="en">EN</option><option value="ko">KO</option><option value="zh">中文</option></select></div>
        <a class="btn line sm" href="login.html"${on('login') || on('portal')}>Client login</a>
        <a class="btn sm" href="estimate.html">Get a quote</a>
        <button id="menu" aria-expanded="false" aria-controls="mm-mobile">Menu</button>
      </div>
    </div>
    <div class="mm" id="mm-svc" hidden>
      <div class="mm-l"><span class="mm-k">Services</span><h3>Explore the studio</h3><p>Everything a small business needs to look the part, quoted online in minutes.</p><a class="btn sm" href="estimate.html">Get a quote</a></div>
      <div class="mm-m"><span class="mm-k">What we design</span><div class="mm-grid">${svc.map(x => `<a href="estimate.html"><b>${x[0]}</b><span>${x[1]}</span></a>`).join('')}</div></div>
      <a class="mm-f" href="index.html#story"><span class="mm-k">Featured</span><div class="mm-inv"><i></i><i></i><i></i><b>$2,633.50</b></div><b>Live invoice</b><span>Tap what you need and watch your price update in real time.</span></a>
    </div>
    <div class="mm" id="mm-studio" hidden>
      <div class="mm-l"><span class="mm-k">Studio</span><h3>How we work</h3><p>No meetings. Everything happens online, in your own private project space.</p><a class="btn sm line" href="index.html#how">How it works</a></div>
      <div class="mm-m"><span class="mm-k">Pages</span><div class="mm-grid">
        <a href="work.html"><b>Work</b><span>Selected brands and websites</span></a>
        <a href="journal.html"><b>Journal</b><span>Notes on branding and pricing</span></a>
        <a href="index.html#pricing"><b>Pricing</b><span>Starting prices, confirmed by a human</span></a>
        <a href="login.html"><b>Client login</b><span>Your quote, messages and files</span></a>
        ${cfg.demoAutoLogin ? `<a href="admin.html"><b>Designer portal</b><span>The studio side of every project</span></a>` : ''}
      </div></div>
      <a class="mm-f dark" href="estimate.html"><span class="mm-k">Start here</span><span class="mm-star gh" aria-hidden="true"></span><b>Tell us about your business</b><span>Three short steps. See your price and timeline straight away.</span></a>
    </div>
    <div class="mm-mobile" id="mm-mobile" hidden>
      <a href="estimate.html">Get a quote</a><a href="work.html">Work</a><a href="journal.html">Journal</a><a href="index.html#how">How it works</a><a href="index.html#pricing">Pricing</a><a href="login.html">Client login</a>
      ${cfg.demoAutoLogin ? '<a href="admin.html">Designer portal</a>' : ''}
    </div>`;
    hd.classList.add('lt');
    $('#langsel').value = LANG;
    $('#langsel').addEventListener('change', e => Site.setLang(e.target.value));

    // Mega menus: open on click (and hover on wide screens), close on outside click or Escape.
    const close = () => { $$('.mm', hd).forEach(m => { m.hidden = true; }); $$('[data-mm]', hd).forEach(b => b.setAttribute('aria-expanded', 'false')); hd.classList.remove('open'); };
    const open = k => { close(); $('#mm-' + k).hidden = false; $(`[data-mm="${k}"]`, hd).setAttribute('aria-expanded', 'true'); hd.classList.add('open'); };
    $$('[data-mm]', hd).forEach(b => {
      b.addEventListener('click', () => (b.getAttribute('aria-expanded') === 'true' ? close() : open(b.dataset.mm)));
      b.addEventListener('mouseenter', () => { if (matchMedia('(hover:hover) and (min-width:901px)').matches) open(b.dataset.mm); });
    });
    hd.addEventListener('mouseleave', () => { if (matchMedia('(hover:hover)').matches) close(); });
    document.addEventListener('click', e => { if (!hd.contains(e.target)) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    $('#menu').onclick = e => { const m = $('#mm-mobile'); m.hidden = !m.hidden; e.currentTarget.setAttribute('aria-expanded', !m.hidden); };
    hd.addEventListener('click', e => { if (e.target.closest('.mm a, .mm-mobile a')) { close(); $('#mm-mobile').hidden = true; } });
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

/* ---------- Invoice-style document (price list, estimates, quotes) ----------
 * o = { title, sub, meta: [[label, value]], lines: [[label, amount, desc?]],
 *       sums: [[label, value, cls?]], notes: html, stamp: {text, small, tone}, after: html }
 * Labels may start with a code like "BRAND-01 …"; it goes in its own column.
 * Strings are expected to be translated already (or translated later by apply()). */
function invoiceHtml(o) {
  const cfg = window.STUDIO_CONFIG || {};
  const split = l => { const m = String(l).match(/^([A-Z]+(?:-[A-Z0-9]+)+)\s+(.*)$/); return m ? [m[1], m[2]] : ['', String(l)]; };
  const rows = (o.lines || []).map(l => { const [code, label] = split(l[0]); return { code, label, amount: l[1], desc: l[2] || '' }; });
  const hasCode = rows.some(r => r.code);
  return `<article class="inv doc">
    <header class="inv-top">
      <div class="inv-from"><span class="gh inv-logo" aria-hidden="true"></span><div><b>${esc(cfg.name || 'WHETŪ STUDIO')}</b><span>Aotearoa, New Zealand</span></div></div>
      <div class="inv-title"><h3>${o.title}</h3><span>${o.sub || ''}</span></div>
    </header>
    <dl class="inv-meta">${(o.meta || []).map(m => `<div><dt>${m[0]}</dt><dd>${m[1]}</dd></div>`).join('')}</dl>
    <div class="inv-scroll"><table class="inv-t">
      <thead><tr>${hasCode ? '<th>Code</th>' : ''}<th>Item</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>${rows.map(r => `<tr>${hasCode ? `<td class="c">${esc(r.code)}</td>` : ''}<td><b>${esc(tr(r.label))}</b>${r.desc ? `<span>${r.desc}</span>` : ''}</td><td class="amt${typeof r.amount === 'number' && r.amount < 0 ? ' neg' : ''}">${typeof r.amount === 'number' ? money(r.amount) : esc(r.amount)}</td></tr>`).join('') || `<tr><td colspan="3">—</td></tr>`}</tbody>
    </table></div>
    <div class="inv-foot">
      <div class="inv-notes">${o.notes || ''}${o.stamp ? `<div class="inv-stamp ${o.stamp.tone || ''}" aria-hidden="true"><span>${o.stamp.text}</span>${o.stamp.small ? `<small>${o.stamp.small}</small>` : ''}</div>` : ''}</div>
      <div class="inv-sum">${(o.sums || []).map(s => `<p class="${s[2] || ''}"><span>${s[0]}</span><span>${s[1]}</span></p>`).join('')}</div>
    </div>${o.after || ''}
  </article>`;
}
