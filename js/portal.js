/*
 * Client portal (My Studio). One page per project with four tabs:
 * Project (the current step), Messages, Files and Brief.
 */
(async function () {
  const ROLE = 'client';
  const el = $('#portal');
  const ui = { id: qs('p') || '', tab: qs('tab') || 'over', view: null, dirTab: null, confirm: '', flash: '', msg: '', note: '', decl: '', draft: { areas: [], t1: '', t2: '' }, pendingFiles: [] };
  let list = [], req = null, isLocal = false, busy = false;

  const sess = await API.session(ROLE);
  if (!sess) { location.replace('login.html'); return; }
  isLocal = (await API.mode()) === 'local';

  async function load() {
    try {
      list = await API.list(ROLE);
    } catch (e) {
      if (e.status === 401) { location.replace('login.html'); return false; }
      throw e;
    }
    if (!list.length) { location.replace('login.html'); return false; }
    req = list.find(r => r.id === ui.id) || list[0];
    ui.id = req.id;
    return true;
  }

  /* ---------- building blocks ---------- */
  const rail = r => {
    const stage = Workflow.STAGE_OF[r.status];
    const steps = [1, 2, 3, 4, 5, 6];
    // stage numbers: 1 request/review, 2 quote, 3 deposit, 4 design, 5 final payment, 7 complete
    return `<ol class="cp-rail"><li class="rt">${T('r_t')}</li>${steps.map(i => {
      const cls = r.status === 'complete' || i < stage ? 'done' : i === stage ? 'on' : '';
      return `<li class="s ${cls}">${i} ${T('stage_' + i)}</li>`;
    }).join('')}</ol>`;
  };

  const ticket = r => {
    const ph = Workflow.phase(r);
    const d = r.design;
    return `<div class="cp-tk">
      <div class="l"><span>${T('k_id')}</span><span data-no-tr>${esc(r.id)}</span></div>
      <div class="l"><span>${T('k_svc')}</span><span>${esc(PUI.services(r))}</span></div>
      <div class="l"><span>${T('k_st')}</span><span><b>${PUI.statusLabel(r)}</b></span></div>
      ${d.chosen ? `<div class="l"><span>${T('k_rr')}</span><span>${Workflow.usedRounds(r)} / ${Workflow.allowedRounds(r)}</span></div>` : ''}
      <div class="l"><span>${T('k_nx')}</span><span>${T('nx_' + ph)}</span></div></div>`;
  };

  const askBtn = `<button class="btn alt" data-act="go-msg">${T('q_ask')}</button>`;
  const confirmPanel = (t, x, yes, act, extra) => `<div class="cp-panel"><h4>${t}</h4><p>${x}</p>${extra || ''}<div class="acts" style="margin-top:20px"><button class="btn" data-act="${act}">${yes}</button><button class="btn alt" data-act="confirm-no">${T('no')}</button></div></div>`;
  const payBtn = (link, label) => link ? `<a class="btn" href="${esc(link)}" target="_blank" rel="noopener">${label}</a>` : `<p class="note">${T('dp_manual')}</p>`;

  function overview(r) {
    const ph = Workflow.phase(r), d = r.design, price = money(Workflow.CFG.extraRound) + ' NZD';
    let h = '';

    if (r.status === 'new' || r.status === 'reviewing') {
      h = `<h3>${T('rv_t')}</h3><p class="cp-lead">${T('rv_x')}</p>${PUI.estimate(r)}<div class="acts">${askBtn}</div>`;
    }

    if (r.status === 'quoted') {
      const q = r.quote, expired = Date.now() > q.validUntil;
      h = `<h3>${T('q_t')}</h3><p class="note">${T('q_meta', q.version, fmtDate(q.validUntil))}</p>${PUI.quote(r)}`;
      if (expired) h += `<div class="flag">${T('q_expired')}</div><div class="acts">${askBtn}</div>`;
      else if (ui.confirm === 'accept') h += '<div style="margin-top:28px"></div>' + confirmPanel(T('acc_t'), T('acc_x'), T('acc_yes'), 'accept');
      else if (ui.confirm === 'decline') h += '<div style="margin-top:28px"></div>' + confirmPanel(T('dec_t'), T('dec_x'), T('dec_yes'), 'decline', `<textarea id="decl" rows="3" style="margin-top:14px" placeholder="${esc(T('dec_ph'))}">${esc(ui.decl)}</textarea>`);
      else h += `<div class="acts"><button class="btn" data-act="confirm" data-c="accept">${T('q_accept')}</button>${askBtn}<button class="link" data-act="confirm" data-c="decline">${T('q_decline')}</button></div>`;
    }

    if (r.status === 'accepted') {
      h = `<h3>${T('dp_t')}</h3><div class="cp-tk"><div class="l"><span>${esc(r.quote.id)} v${r.quote.version}</span><span>${fmtDate(r.acceptedAt)}</span></div><div class="l t"><span>${T('dp_due')}</span><span class="big">${money(r.quote.total / 2)}</span></div></div>
        <p class="cp-lead" style="margin-top:22px">${T('dp_x')}</p><div class="acts">${payBtn(r.quote.paymentLink, T('dp_pay'))}${askBtn}</div>`;
    }

    if (r.status === 'active' && ph === 'preparing') {
      h = `<h3>${T('pr_t')}</h3><p class="cp-lead">${T('pr_x')}</p><div class="empty"><span class="oc oc5"></span></div><div class="acts">${askBtn}</div>`;
    }

    if (r.status === 'active' && ph === 'choose') {
      const dirs = d.directions;
      const cur = dirs.find(x => x.key === ui.dirTab) || dirs[0];
      ui.dirTab = cur.key;
      const copy = cur.demo && !cur.desc ? DEMO_COPY[cur.demo] : null;
      h = `<h3>${T('c_t')}</h3><p class="cp-lead">${T('c_x')}</p>
        <div class="cp-h"><span>${T('pv')}</span></div>
        <div class="cp-tabs">${dirs.map(x => `<button class="cp-tab" data-act="dir" data-d="${x.key}" aria-pressed="${x.key === cur.key}">${T('dir', x.key)}</button>`).join('')}</div>
        <p class="cp-dl"><b data-no-tr>${esc(copy ? copy[0] : cur.title)}</b>${(copy ? copy[1] : cur.desc) ? ` · <span data-no-tr>${esc(copy ? copy[1] : cur.desc)}</span>` : ''}</p>
        ${PUI.visual(ROLE, r, cur, 1)}
        <label class="fl-l" for="cnote">${T('c_note')}</label><textarea id="cnote" rows="3" placeholder="${esc(T('c_note_ph'))}">${esc(ui.note)}</textarea>
        <div class="acts"><button class="btn" data-act="choose" data-d="${cur.key}">${T('choose', cur.key)}</button>${askBtn}</div><p class="note" style="margin-top:16px">${T('c_foot')}</p>`;
    }

    if (r.status === 'active' && ['review', 'revising', 'rounds_used'].includes(ph)) h = designReview(r, ph, price);

    if (r.status === 'approved') {
      const m = Workflow.money(r);
      h = `<h3>${T('fp_t')}</h3><p class="cp-lead">${T('fp_x')}</p>
        <div class="cp-tk"><div class="l"><span>${T('fp_total')}</span><span>${money(m.total)}</span></div><div class="l"><span>${T('fp_dep')}</span><span>${money(m.deposit)}</span></div>
        ${m.extras ? `<div class="l"><span>${T('fp_xtra', d.extraRounds, money(Workflow.CFG.extraRound))}</span><span>${money(m.extras)}</span></div>` : ''}
        <div class="l t"><span>${T('fp_bal')}</span><span class="big">${money(m.balance)}</span></div></div>
        <div class="acts">${payBtn(r.quote.paymentLink, T('fp_pay'))}${askBtn}</div>` + designHistory(r);
    }

    if (r.status === 'complete') {
      const finals = r.files.filter(f => f.kind === 'final');
      h = `<h3>${T('hd_t')}</h3><p class="cp-lead">${T('hd_x')}</p><div class="cp-h"><span>${T('stage_6')}</span></div>${finals.length ? PUI.files(ROLE, r, finals) : `<p class="note">${T('hd_wait')}</p>`}`;
    }

    if (r.status === 'declined' || r.status === 'cancelled') {
      h = `<h3>${T(r.status === 'declined' ? 'cl_dec' : 'cl_can')}</h3><p class="cp-lead">${T('cl_x')}</p><div class="acts"><button class="btn" data-act="go-msg">${T('ask')}</button></div>`;
    }

    // A peek at the latest message from the studio, so it's never missed.
    const last = [...r.messages].reverse().find(m => m.by === 'studio');
    const unread = Workflow.unread(r, ROLE);
    if (last && ui.tab === 'over') {
      h += `<button class="msg-peek" data-act="go-msg"><span><b>${T('m_studio')}</b> · <span data-no-tr>${esc((last.text || '📎').slice(0, 140))}${(last.text || '').length > 140 ? '…' : ''}</span></span><span>${unread ? `<span class="cp-badge dot">${unread}</span> ` : ''}${T('tab_msg')} →</span></button>`;
    }
    return h;
  }

  function designReview(r, ph, price) {
    const d = r.design, lat = d.versions.length, view = ui.view && ui.view <= lat ? ui.view : lat;
    const v = d.versions[view - 1], used = Workflow.usedRounds(r), allowed = Workflow.allowedRounds(r), left = allowed - used;
    const round = d.rounds.find(x => x.deliveredAs === view);
    const dir = d.directions.find(x => x.key === d.chosen) || {};
    const dirName = dir.demo && !dir.desc ? DEMO_COPY[dir.demo][0] : dir.title;
    const changes = view > 1
      ? `<div class="cp-3 cp-1"><div><b>${T('chg_t')}</b>${v.note ? `<p data-no-tr style="white-space:pre-wrap">${esc(v.note)}</p>` : ''}${round && round.t1 ? `<p class="note" style="margin-top:10px"><b>${T('yfb')}:</b> <span data-no-tr>${esc(round.t1)}</span></p>` : ''}</div></div>`
      : `<p class="note" style="margin-top:16px">${T('v1n')}</p>`;
    let panel = '';
    if (ph === 'review') {
      const dr = ui.draft, xr = used >= d.included;
      panel = ui.confirm === 'approve' ? confirmPanel(T('ap_t'), T('ap_x'), T('ap_yes'), 'approve')
        : `<div class="cp-h"><span>${T('fb_t')}</span></div><div class="cp-panel"><span class="cp-rb">${T('fb_round', used + 1, allowed)}${xr ? ' · ' + T('fb_xr') : ''}</span><p>${T('fb_lead')}</p>${view < lat ? `<p class="note" style="margin-top:10px"><b>${T('old_v', lat)}</b></p>` : ''}
          <div class="fl-l">${T('fb_areas')}</div><div class="chips">${Workflow.AREAS.map(a => `<button type="button" class="chip" data-act="area" data-a="${a}" aria-pressed="${dr.areas.includes(a)}">${T('ar_' + a)}</button>`).join('')}</div>
          <label class="fl-l" for="t1">${T('fb_l1')}</label><textarea id="t1" rows="5" placeholder="${esc(T('fb_ph1'))}">${esc(dr.t1)}</textarea>
          <label class="fl-l" for="t2">${T('fb_l2')}</label><textarea id="t2" rows="3" placeholder="${esc(T('fb_ph2'))}">${esc(dr.t2)}</textarea>
          <label class="fl-l" for="fbf">${T('fb_file')}</label><input id="fbf" type="file" multiple accept="image/*,.pdf">
          <p class="cp-warn">${left <= 1 ? T('fb_last', price) : T('fb_left', left - 1)}</p><div class="err" id="er" role="alert"></div>
          <div class="acts" style="margin-top:6px"><button class="btn" data-act="submit">${T('fb_submit', used + 1)}</button><button class="btn alt" data-act="confirm" data-c="approve">${T('fb_approve')}</button></div></div>`;
    }
    if (ph === 'revising') panel = `<div class="cp-h"><span>${T('fb_t')}</span></div><div class="cp-panel"><h4>${T('pd_t', used)}</h4><p>${T('pd_x', used)}</p></div>`;
    if (ph === 'rounds_used') {
      panel = `<div class="cp-h"><span>${T('fb_t')}</span></div>` + (ui.confirm === 'approve' ? confirmPanel(T('ap_t'), T('ap_x'), T('ap_yes'), 'approve')
        : `<div class="cp-panel"><h4>${T('ex_t')}</h4><p>${T('ex_x', allowed, price)}</p><div class="acts" style="margin-top:20px"><button class="btn" data-act="buy">${T('ex_buy', price)}</button><button class="btn alt" data-act="confirm" data-c="approve">${T('fb_approve')}</button></div></div>`);
    }
    return `<h3>${T('d_t')}</h3><p class="cp-lead">${T('d_x')}</p>
      <div class="cp-h"><span>${T('pv')}</span></div>
      <div class="cp-tabs">${d.versions.map(x => `<button class="cp-tab" data-act="ver" data-v="${x.n}" aria-pressed="${view == x.n}">${T('ver', x.n)}${x.n == lat ? `<span class="cp-badge">${T('latest')}</span>` : ''}</button>`).join('')}</div>
      <p class="cp-dl"><b>${T('dir', d.chosen)}</b> · <span data-no-tr>${esc(dirName || '')}</span> · ${T('ver', view)}</p>
      ${PUI.visual(ROLE, r, v, view)}${changes}${panel}${designHistory(r)}
      <div class="cp-h"><span>${T('rl_t')}</span></div><ul class="cp-rules">${T('rl', d.included, price).map(x => `<li>${x}</li>`).join('')}</ul>`;
  }

  function designHistory(r) {
    const d = r.design;
    if (!d.chosen) return '';
    const rounds = d.rounds.map(x => `<div class="cp-hs"><div class="hh"><span><b>${T('hs_round', x.n)}</b>${x.extra ? ' · ' + T('hs_xr') : ''} · ${fmtDate(x.at)}</span><span>${x.done ? T('hs_done', x.deliveredAs) : T('hs_wip')}</span></div>${x.areas.length ? `<div class="ar">${x.areas.map(a => T('ar_' + a)).join(' · ')}</div>` : ''}${x.t1 ? `<q data-no-tr>${esc(x.t1)}</q>` : ''}${x.t2 ? `<q data-no-tr style="opacity:.7;margin-top:6px">${esc(x.t2)}</q>` : ''}</div>`).join('');
    return `<div class="cp-h"><span>${T('hs_t')}</span></div><div class="cp-hs"><div class="hh"><span><b>${T('hs_dir')}</b> · ${T('dir', d.chosen)} · ${fmtDate(d.chosenAt)}</span></div>${d.chosenNote ? `<div class="ar">${T('hs_note')}</div><q data-no-tr>${esc(d.chosenNote)}</q>` : ''}</div>${rounds}`;
  }

  function messages(r) {
    return `<div class="th" id="th">${PUI.thread(ROLE, r)}</div>${PUI.composer(ui.msg)}`;
  }

  function filesTab(r) {
    return `<div class="acts" style="margin:0 0 18px"><label class="btn alt file-btn" style="text-decoration:none">${T('f_up')}<input type="file" id="fup" multiple></label><span class="note" id="fup-p"></span></div>${PUI.files(ROLE, r)}`;
  }

  /* ---------- render ---------- */
  function render() {
    const r = req, unread = Workflow.unread(r, ROLE);
    const fl = ui.flash; ui.flash = '';
    const tabs = [['over', T('tab_over')], ['msg', T('tab_msg') + (unread ? ` <span class="cp-badge dot">${unread}</span>` : '')], ['files', T('tab_files')], ['brief', T('tab_brief')]];
    const body = ui.tab === 'msg' ? messages(r) : ui.tab === 'files' ? filesTab(r) : ui.tab === 'brief' ? PUI.brief(r) : overview(r);
    el.innerHTML = `<div class="lab"><span><b>${T('ms')}</b> / <span data-no-tr>${esc(r.biz)}</span></span><span class="cp-sp"></span><span data-no-tr>${esc(sess.email || r.client.email)}</span><button class="link" data-act="logout">${T('out')}</button></div>
      <h2>${T('ms_title')}</h2>
      ${list.length > 1 ? `<div class="cp-tabs" style="margin-top:28px">${list.map(x => `<button class="cp-tab" data-act="proj" data-id="${esc(x.id)}" aria-pressed="${x.id === r.id}"><span data-no-tr>${esc(x.biz)}</span> · ${esc(x.id)}${Workflow.unread(x, ROLE) ? ' <span class="cp-badge dot">•</span>' : ''}</button>`).join('')}</div>` : ''}
      <div class="cp-grid">${rail(r)}<div class="cp-main" id="cp-main">
        ${isLocal ? `<p class="cp-demo">${T('demo')}</p>` : ''}
        ${fl ? `<div class="cp-flag" role="status">${fl}</div>` : ''}
        ${ticket(r)}
        <div class="cp-tabs cp-maintabs" role="tablist">${tabs.map(t => `<button class="cp-tab" data-act="tab" data-t="${t[0]}" aria-pressed="${ui.tab === t[0]}">${t[1]}</button>`).join('')}</div>
        <div id="tabbody">${body}</div>
      </div></div>`;
    apply(el);
    if (ui.tab === 'msg') { scrollThread(); markRead(); }
    document.title = T('ms') + ' | WHETŪ Studio';
  }
  const scrollThread = () => { const th = $('#th'); if (th) th.scrollTop = th.scrollHeight; };
  async function markRead() {
    if (Workflow.unread(req, ROLE)) { try { req = await API.act(ROLE, req.id, 'mark_read'); clearBadge(); } catch (e) { /* ignore */ } }
  }
  const rerender = () => { const y = scrollY; render(); scrollTo({ top: y, behavior: 'instant' }); };
  const toMain = () => { const m = $('#cp-main'); if (m) scrollTo({ top: scrollY + m.getBoundingClientRect().top - 110, behavior: 'smooth' }); };
  const setUrl = () => { try { history.replaceState(null, '', `portal.html?p=${encodeURIComponent(ui.id)}${ui.tab !== 'over' ? '&tab=' + ui.tab : ''}`); } catch (e) { /* ignore */ } };

  async function act(action, data, flash) {
    if (busy) return;
    busy = true;
    try {
      req = await API.act(ROLE, req.id, action, data);
      list = list.map(x => (x.id === req.id ? req : x));
      ui.confirm = '';
      if (flash) ui.flash = flash;
      rerender();
      if (flash) toMain();
      return true;
    } catch (e) {
      const er = $('#er');
      if (er) er.textContent = e.message; else Site.toast(e.message);
      return false;
    } finally { busy = false; }
  }

  const clearBadge = () => $$('[data-act=tab][data-t=msg] .cp-badge').forEach(b => b.remove());

  /* ---------- events ---------- */
  el.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const a = b.dataset.act;
    if (a === 'logout') { await API.logout(ROLE); location.replace('login.html'); return; }
    if (a === 'proj') { ui.id = b.dataset.id; Object.assign(ui, { view: null, dirTab: null, confirm: '', tab: 'over' }); await load(); setUrl(); return render(); }
    if (a === 'tab') { ui.tab = b.dataset.t; ui.confirm = ''; setUrl(); return rerender(); }
    if (a === 'go-msg') { ui.tab = 'msg'; setUrl(); render(); toMain(); setTimeout(() => { const t = $('#cmp-t'); if (t) t.focus({ preventScroll: true }); }, 300); return; }
    if (a === 'confirm') { ui.confirm = b.dataset.c; return rerender(); }
    if (a === 'confirm-no') { ui.confirm = ''; return rerender(); }
    if (a === 'accept') return act('accept_quote', { version: req.quote.version }, T('fl_acc'));
    if (a === 'decline') { if (await act('decline_quote', { reason: ui.decl }, T('fl_dec'))) ui.decl = ''; return; }
    if (a === 'dir') { ui.dirTab = b.dataset.d; return rerender(); }
    if (a === 'choose') { if (await act('choose_direction', { key: b.dataset.d, note: ui.note }, T('fl_dir', b.dataset.d))) ui.note = ''; return; }
    if (a === 'ver') { ui.view = +b.dataset.v; return rerender(); }
    if (a === 'area') { const k = b.dataset.a, i = ui.draft.areas.indexOf(k); i < 0 ? ui.draft.areas.push(k) : ui.draft.areas.splice(i, 1); b.setAttribute('aria-pressed', i < 0); return; }
    if (a === 'submit') {
      const dr = ui.draft;
      if (!dr.t1.trim() && !dr.areas.length) { $('#er').textContent = T('fb_err'); return; }
      b.disabled = true;
      try {
        const files = await PUI.uploadAll(ROLE, req.id, $('#fbf').files, 'round');
        const n = Workflow.usedRounds(req) + 1;
        if (await act('submit_round', { areas: dr.areas, t1: dr.t1, t2: dr.t2, files }, T('fl_sent', n))) ui.draft = { areas: [], t1: '', t2: '' };
      } catch (x) { $('#er').textContent = x.message; } finally { b.disabled = false; }
      return;
    }
    if (a === 'buy') return act('add_round', {}, T('fl_buy'));
    if (a === 'approve') return act('approve_design', {}, T('fl_appr'));
  });

  el.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 't1') ui.draft.t1 = t.value;
    else if (t.id === 't2') ui.draft.t2 = t.value;
    else if (t.id === 'cnote') ui.note = t.value;
    else if (t.id === 'decl') ui.decl = t.value;
    else if (t.id === 'cmp-t') ui.msg = t.value;
  });

  el.addEventListener('change', async e => {
    const t = e.target;
    if (t.id === 'cmp-f') {
      ui.pendingFiles = [...t.files];
      $('#cmp-p').textContent = ui.pendingFiles.map(f => f.name).join(', ');
    }
    if (t.id === 'fup' && t.files.length) {
      const p = $('#fup-p');
      try {
        p.textContent = T('uploading');
        const ids = await PUI.uploadAll(ROLE, req.id, t.files, 'message');
        await act('message', { text: '', files: ids });
      } catch (x) { Site.toast(x.message); p.textContent = ''; }
    }
  });

  el.addEventListener('submit', async e => {
    if (e.target.id !== 'cmp') return;
    e.preventDefault();
    const btn = e.target.querySelector('button');
    if (!ui.msg.trim() && !ui.pendingFiles.length) return;
    btn.disabled = true;
    try {
      $('#cmp-p').textContent = ui.pendingFiles.length ? T('uploading') : '';
      const ids = await PUI.uploadAll(ROLE, req.id, ui.pendingFiles, 'message');
      if (await act('message', { text: ui.msg, files: ids })) { ui.msg = ''; ui.pendingFiles = []; rerender(); scrollThread(); const t = $('#cmp-t'); if (t) t.focus({ preventScroll: true }); }
    } catch (x) { Site.toast(x.message); } finally { const b2 = $('#cmp button'); if (b2) b2.disabled = false; }
  });

  el.addEventListener('keydown', e => {
    // Cmd/Ctrl + Enter sends a message.
    if (e.target.id === 'cmp-t' && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); $('#cmp').requestSubmit(); }
  });

  // Live updates: re-render when something changed, without wiping what the client is typing.
  API.subscribe(async () => {
    const before = req && req.updatedAt + ':' + req.messages.length;
    try { if (!(await load())) return; } catch (e) { return; }
    if (req.updatedAt + ':' + req.messages.length === before) return;
    const typing = document.activeElement && el.contains(document.activeElement) && /^(TEXTAREA|INPUT)$/.test(document.activeElement.tagName);
    if (typing && ui.tab === 'msg') { $('#th').innerHTML = PUI.thread(ROLE, req); apply($('#th')); scrollThread(); markRead(); }
    else if (!typing) rerender();
  });

  Site.onLang(rerender);
  if (await load()) { setUrl(); render(); }
})();
