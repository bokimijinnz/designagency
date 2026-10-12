/*
 * Studio admin. Three areas:
 *  - Requests: every quote request → review → quote → deposit → design → handover,
 *    with a message thread per project.
 *  - Journal: write and edit blog posts.
 *  - Work: write and edit portfolio projects.
 */
(async function () {
  const ROLE = 'studio';
  const el = $('#admin');
  const ui = {
    area: qs('a') || 'reqs', id: qs('id') || '', tab: 'next', filter: 'todo', q: '',
    msg: '', pendingFiles: [], qd: {}, note: {}, sure: '', edit: null, editType: '', preview: false
  };
  let reqs = [], isLocal = false, busy = false, aiOn = { enabled: false };
  isLocal = (await API.mode()) === 'local';

  /* ================= sign in ================= */
  async function loginView() {
    el.innerHTML = `<div class="lab"><a href="index.html">← Back to the studio</a></div><h2>${T('a_login')}</h2>
      <form class="cp-login" id="alf"><label class="fl-l" for="apw">${T('a_pw')}</label><input id="apw" type="password" autocomplete="current-password">
      <div class="err" id="er" role="alert"></div><div class="acts" style="margin-top:14px"><button class="btn" type="submit">${T('a_in')}</button></div>
      <p class="note" style="margin-top:22px">${T(isLocal ? 'a_pw_hint_local' : 'a_pw_hint_server')}</p></form>`;
    apply(el);
    $('#alf').addEventListener('submit', async e => {
      e.preventDefault();
      try { await API.login(ROLE, { password: $('#apw').value }); start(); } catch (x) { $('#er').textContent = x.message; }
    });
    $('#apw').focus();
  }

  /* ================= helpers ================= */
  const cur = () => reqs.find(r => r.id === ui.id);
  const needsAction = r => {
    const ph = Workflow.phase(r);
    return ['new', 'reviewing', 'accepted', 'preparing', 'revising', 'approved'].includes(ph) || Workflow.unread(r, ROLE) > 0;
  };
  const FILTERS = {
    todo: needsAction,
    open: r => !['complete', 'declined', 'cancelled'].includes(r.status),
    done: r => ['complete', 'declined', 'cancelled'].includes(r.status),
    all: () => true
  };
  const setUrl = () => { try { history.replaceState(null, '', `admin.html?a=${ui.area}${ui.id && ui.area === 'reqs' ? '&id=' + encodeURIComponent(ui.id) : ''}`); } catch (e) { /* ignore */ } };

  async function loadReqs() {
    try { reqs = await API.list(ROLE); } catch (e) { if (e.status === 401) { loginView(); return false; } throw e; }
    return true;
  }

  async function act(action, data, msg) {
    if (busy) return false;
    busy = true;
    try {
      const r = await API.act(ROLE, ui.id, action, data);
      reqs = reqs.map(x => (x.id === r.id ? r : x));
      ui.sure = '';
      if (msg) Site.toast(msg);
      rerender();
      return true;
    } catch (e) {
      const er = $('#er');
      if (er) er.textContent = e.message; else Site.toast(e.message);
      return false;
    } finally { busy = false; }
  }

  /* ================= requests ================= */
  function listView() {
    const q = ui.q.trim().toLowerCase();
    const items = reqs.filter(FILTERS[ui.filter]).filter(r => !q || [r.id, r.biz, r.client.name, r.client.email].join(' ').toLowerCase().includes(q));
    const count = k => reqs.filter(FILTERS[k]).length;
    return `<div class="ad-list">
      <div class="chips" style="gap:6px">${['todo', 'open', 'done', 'all'].map(k => `<button class="chip" data-act="filter" data-f="${k}" aria-pressed="${ui.filter === k}">${T('a_f_' + k)} <small style="display:inline;opacity:.6">${count(k)}</small></button>`).join('')}</div>
      <input type="text" id="aq" placeholder="${esc(T('a_search'))}" value="${esc(ui.q)}" style="margin-top:12px">
      <div class="ad-items">${items.map(r => {
        const un = Workflow.unread(r, ROLE);
        return `<button class="ad-item${r.id === ui.id ? ' on' : ''}" data-act="open" data-id="${esc(r.id)}">
          <span class="t"><b data-no-tr>${esc(r.biz)}</b>${un ? `<span class="cp-badge dot">${un}</span>` : ''}</span>
          <span class="s" data-no-tr>${esc(r.client.name || r.client.email)} · ${esc(r.id)}</span>
          <span class="s"><span class="st st-${r.status}">${PUI.statusLabel(r)}</span> · ${fmtDate(r.updatedAt, true)}</span></button>`;
      }).join('') || `<p class="note" style="padding:20px 0">${T('a_none')}</p>`}</div></div>`;
  }

  function detailView(r) {
    if (!r) return `<div class="ad-detail"><div class="empty"><span class="oc oc3"></span><p>${T('a_pick')}</p></div></div>`;
    const un = Workflow.unread(r, ROLE);
    const tabs = [['next', T('a_tab_next')], ['ai', T('ai_tab') + (aiBadge(r) ? ' <span class="cp-badge">' + aiBadge(r) + '</span>' : '')], ['msg', T('tab_msg') + (un ? ` <span class="cp-badge dot">${un}</span>` : '')], ['quote', T('a_tab_quote')], ['design', T('a_tab_design')], ['files', T('tab_files')], ['brief', T('a_brief')], ['notes', T('a_tab_notes')]];
    const body = { next: nextTab, ai: aiTab, msg: msgTab, quote: quoteTab, design: designTab, files: filesTab, brief: x => PUI.brief(x), notes: notesTab }[ui.tab](r);
    const m = Workflow.money(r);
    return `<div class="ad-detail">
      <div class="ad-head">
        <div><span class="st st-${r.status}">${PUI.statusLabel(r)}</span><h3 data-no-tr>${esc(r.biz)}</h3>
          <p class="note" data-no-tr>${esc(r.id)} · ${esc(r.client.name)} · <a href="mailto:${esc(r.client.email)}">${esc(r.client.email)}</a>${r.client.role ? ' · ' + esc(r.client.role) : ''}</p>
          <p class="note">${T('a_created')} ${fmtDate(r.createdAt, true)} · ${T('a_updated')} ${fmtDate(r.updatedAt, true)} · ${esc(PUI.services(r))}</p></div>
        <div class="ad-code"><small>${T('a_code')}</small><b data-no-tr>${esc(r.accessCode || '')}</b><small>${T('a_code_x')}</small></div>
      </div>
      ${r.quote ? `<div class="ad-money"><span>${T('q_tot')} <b>${money(m.total)}</b></span><span>${T('dp_due')} <b>${money(m.deposit)}</b>${r.depositAt ? ' ✓' : ''}</span><span>${T('fp_bal')} <b>${money(m.balance)}</b>${r.status === 'complete' ? ' ✓' : ''}</span></div>` : ''}
      <div class="cp-tabs cp-maintabs">${tabs.map(t => `<button class="cp-tab" data-act="tab" data-t="${t[0]}" aria-pressed="${ui.tab === t[0]}">${t[1]}</button>`).join('')}</div>
      <div id="tabbody">${body}</div></div>`;
  }

  function nextTab(r) {
    const ph = Workflow.phase(r);
    const todo = ph === 'revising' ? T('a_todo_revising', Workflow.usedRounds(r)) : T('a_todo_' + ph);
    let btns = '';
    if (r.status === 'new') btns = `<button class="btn" data-act="do" data-a="start_review">${T('a_start')}</button><button class="btn alt" data-act="tab" data-t="quote">${T('a_goquote')}</button>`;
    if (r.status === 'reviewing') btns = `<button class="btn" data-act="tab" data-t="quote">${T('a_goquote')}</button>`;
    if (r.status === 'quoted') btns = `<button class="btn alt" data-act="tab" data-t="quote">${T('a_tab_quote')} ↗</button>`;
    if (r.status === 'accepted') btns = sure('confirm_deposit', T('a_dep'));
    if (r.status === 'active') btns = `<button class="btn" data-act="tab" data-t="design">${T('a_tab_design')} ↗</button>`;
    if (r.status === 'approved') btns = `<button class="btn alt" data-act="tab" data-t="design">${T('a_f_final')} ↗</button>` + sure('confirm_balance', T('a_bal'));
    if (['declined', 'cancelled'].includes(r.status)) btns = `<button class="btn" data-act="do" data-a="reopen">${T('a_reopen')}</button>`;
    const canCancel = ['new', 'reviewing', 'quoted', 'accepted', 'active', 'approved'].includes(r.status);
    const last = [...r.messages].reverse().find(m => m.by === 'client');
    return `<div class="cp-panel"><h4>${todo}</h4><div class="err" id="er" role="alert"></div><div class="acts" style="margin-top:12px">${btns}</div></div>
      ${last ? `<button class="msg-peek" data-act="tab" data-t="msg"><span><b data-no-tr>${esc(r.client.name || T('m_client'))}</b> · <span data-no-tr>${esc((last.text || '📎').slice(0, 160))}</span></span><span>${T('tab_msg')} →</span></button>` : ''}
      ${r.quote ? `<div class="cp-h"><span>${T('a_q_cur', r.quote.version)}</span><span>${r.acceptedAt ? T('sys_quote_accepted', { v: r.quote.version }) : ''}</span></div>${PUI.quote(r)}` : `<div class="cp-h"><span>${T('a_q_est')}</span></div>${PUI.estimate(r) || `<p class="note">—</p>`}`}
      ${canCancel ? `<div class="acts" style="margin-top:48px">${sure('cancel', T('a_cancel'), true)}</div>` : ''}`;
  }
  // Two-step button for actions that matter (money, closing).
  const sure = (action, label, quiet) => ui.sure === action
    ? `<span class="ad-sure">${T('a_sure')} <button class="btn" data-act="do" data-a="${action}">${label} ✓</button><button class="link" data-act="unsure">${T('no')}</button></span>`
    : `<button class="${quiet ? 'link' : 'btn'}" data-act="sure" data-a="${action}">${label}</button>`;

  function msgTab(r) {
    return `<div class="th" id="th">${PUI.thread(ROLE, r)}</div>${PUI.composer(ui.msg)}
      <div class="acts" style="margin-top:10px"><button class="btn alt sm" data-act="ai-reply">${T('ai_reply')}</button><span class="note" id="ai-p"></span></div>`;
  }

  /* ---------- AI brief (studio-only drafts from server/agents.js) ---------- */
  const aiBadge = r => { const b = r.ai && r.ai.brief; return !b ? '' : b.status === 'running' ? '…' : b.status === 'ready' ? '✓' : b.status === 'error' ? '!' : ''; };
  function aiTab(r) {
    const b = r.ai && r.ai.brief;
    const run = aiOn.enabled ? `<button class="btn" data-act="ai-run">${T(b ? 'ai_rerun' : 'ai_run')}</button>` : '';
    if (!b || b.status !== 'ready') {
      const msg = !b ? (aiOn.enabled ? T('ai_none') : T(isLocal ? 'ai_off_demo' : 'ai_off')) : b.status === 'running' ? T('ai_running') : T('ai_error', b.error || '');
      return `<div class="cp-panel"><h4>${T('ai_title')}</h4><p>${esc(msg)}</p><div class="acts" style="margin-top:14px">${b && b.status === 'running' ? '' : run}</div></div>`;
    }
    const x = b.data, list = a => (a || []).length ? `<ul>${a.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : '<p class="note">—</p>';
    const link = u => /^https?:\/\//.test(u || '') ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40))}</a>` : '';
    return `<div class="ai" data-no-tr>
      <div class="ai-head"><span class="pill dark">AI</span><span class="note">${b.demo ? T('ai_demo') : T('ai_meta', fmtDate(b.at, true), b.model || '')}</span>${run ? `<span class="cp-sp"></span>${run.replace('class="btn"', 'class="btn alt sm"')}` : ''}</div>
      <p class="ai-sum">${esc(x.summary)}</p>
      <div class="ai-grid">
        <div><b>${T('ai_snap')}</b><p>${esc(x.snapshot.business)}<br><small>${esc(x.snapshot.industry)}</small></p><p><small>${T('ai_aud')}</small><br>${esc(x.snapshot.audience)}</p>${list(x.snapshot.goals)}</div>
        <div><b>${T('ai_concept')}</b><p>${esc(x.concept.positioning)}</p><p><small>${T('ai_tone')}</small><br>${esc(x.concept.tone)}</p><p>${(x.concept.personality || []).concat(x.concept.keywords || []).map(k => `<span class="pill">${esc(k)}</span>`).join(' ')}</p></div>
      </div>
      <div class="cp-h"><span>${T('ai_dirs')}</span></div>
      <div class="ai-dirs">${(x.directions || []).map(d => `<div class="ai-dir">
        <div class="ai-sw">${(d.palette || []).map(p => `<i style="background:${/^#[0-9a-f]{3,8}$/i.test(p.hex) ? p.hex : '#ccc'}" title="${esc(p.name)} ${esc(p.hex)}"></i>`).join('')}</div>
        <b>${esc(d.key)} · ${esc(d.name)}</b><p>${esc(d.idea)}</p>
        <p><small>${T('ai_mark')}</small><br>${esc(d.mark)}</p><p><small>${T('ai_type')}</small><br>${esc(d.typography)}</p>
        <p><small>${T('ai_why')}</small><br>${esc(d.why)}</p>${d.risk ? `<p class="ai-risk">⚠ ${esc(d.risk)}</p>` : ''}
        <p class="ai-hex">${(d.palette || []).map(p => esc(p.hex)).join(' · ')}</p></div>`).join('')}</div>
      <div class="ai-grid">
        <div><div class="cp-h"><span>${T('ai_research')}</span></div><ul>${(x.research || []).map(f => `<li>${esc(f.finding)} ${link(f.source)}</li>`).join('')}</ul>
          <div class="cp-h"><span>${T('ai_comp')}</span></div><ul>${(x.competitors || []).map(c => `<li><b>${esc(c.name)}</b> — ${esc(c.note)} ${link(c.url)}</li>`).join('')}</ul></div>
        <div><div class="cp-h"><span>${T('ai_deliv')}</span></div><p><b>${esc(x.deliverables.format)}</b></p>${list(x.deliverables.pages_or_screens)}<p class="note">${esc(x.deliverables.notes)}</p>
          ${x.marketing && x.marketing.needed ? `<div class="cp-h"><span>${T('ai_mkt')}</span></div><p>${esc(x.marketing.monthly_plan)}</p><p><small>${T('ai_ch')}</small></p>${list(x.marketing.channels)}<p><small>${T('ai_ideas')}</small></p>${list(x.marketing.content_ideas)}<p><small>${T('ai_kw')}</small></p><p>${(x.marketing.ad_keywords || []).map(k => `<span class="pill">${esc(k)}</span>`).join(' ')}</p><p><small>${T('ai_blog')}</small></p>${list(x.marketing.blog_topics)}` : ''}</div>
      </div>
      <div class="cp-h"><span>${T('ai_quote')}</span><button class="link" data-act="ai-quote">${T('ai_use_quote')}</button></div>
      <div class="ai-q">${(x.quote || []).map(q => `<p><span>${esc(q.label)}</span><span>${money(q.amount)}</span></p>`).join('')}</div><p class="note">${esc(x.quote_notes)}</p>
      <div class="ai-grid">
        <div><div class="cp-h"><span>${T('ai_q')}</span><button class="link" data-act="ai-ask">${T('ai_ask')}</button></div>${list(x.questions)}</div>
        <div><div class="cp-h"><span>${T('ai_flags')}</span></div>${list(x.red_flags)}<div class="cp-h"><span>${T('ai_next')}</span></div>${list(x.next_steps)}</div>
      </div></div>`;
  }

  /* ---------- quote editor ---------- */
  function draftFor(r) {
    if (ui.qd[r.id]) return ui.qd[r.id];
    const q = r.quote, e = r.estimate || {};
    const d = q ? { lines: q.lines.map(l => ({ label: l.label, amount: l.amount })), weeks: q.weeks, validDays: 14, paymentLink: q.paymentLink, includes: q.includes, excludes: q.excludes, notes: q.notes }
      : {
        lines: (e.lines || []).map(l => ({ label: l[0], amount: l[1] })), weeks: e.weeks && e.weeks[1] ? `${e.weeks[0] === e.weeks[1] ? e.weeks[0] : e.weeks[0] + '–' + e.weeks[1]} weeks from design start` : '',
        validDays: 14, paymentLink: '', includes: '', excludes: 'Domain, hosting and paid tools\nPrinting', notes: ''
      };
    if (!d.lines.length) d.lines.push({ label: '', amount: 0 });
    return (ui.qd[r.id] = d);
  }
  function quoteTab(r) {
    const d = draftFor(r), t = Workflow.quoteTotals(d.lines.map(l => ({ amount: Number(l.amount) || 0 })));
    const editable = ['new', 'reviewing', 'quoted'].includes(r.status);
    const next = (r.quote ? r.quote.version : 0) + 1;
    if (!editable) return r.quote ? `<div class="cp-h"><span>${T('a_q_cur', r.quote.version)}</span></div>${PUI.quote(r)}` : `<p class="note">—</p>`;
    return `<div class="cp-panel" id="qf">
      <div class="fl-l" style="margin-top:0">${T('a_q_lines')}</div>
      <div class="ad-lines">${d.lines.map((l, i) => `<div class="ad-line"><input type="text" data-q="label" data-i="${i}" value="${esc(l.label)}" placeholder="${esc(T('a_q_item'))}"><input type="number" step="0.01" data-q="amount" data-i="${i}" value="${esc(l.amount)}" placeholder="${esc(T('a_q_amt'))}"><button class="link" data-act="qdel" data-i="${i}" aria-label="Remove">✕</button></div>`).join('')}</div>
      <div class="acts" style="margin-top:12px"><button class="btn alt sm" data-act="qadd">${T('a_q_add')}</button>${(r.estimate.lines || []).length ? `<button class="link" data-act="qest">${T('a_q_from_est')}</button>` : ''}</div>
      <div class="cp-tk" id="qtot"><div class="l"><span>${T('q_sub')}</span><span>${money(t.sub)}</span></div><div class="l"><span>${T('q_gst')}</span><span>${money(t.gst)}</span></div><div class="l t"><span>${T('q_tot')}</span><span>${money(t.total)}</span></div><div class="l"><span>${T('q_dep')}</span><span>${money(t.total / 2)}</span></div></div>
      <div class="ad-2">
        <div><label class="fl-l">${T('a_q_weeks')}</label><input type="text" data-q="weeks" value="${esc(d.weeks)}" placeholder="${esc(T('a_q_weeks_ph'))}"></div>
        <div><label class="fl-l">${T('a_q_valid')}</label><input type="number" min="1" max="90" data-q="validDays" value="${esc(d.validDays)}"></div>
      </div>
      <label class="fl-l">${T('a_q_link')}</label><input type="url" data-q="paymentLink" value="${esc(d.paymentLink)}" placeholder="${esc(T('a_q_link_ph'))}">
      <div class="ad-2">
        <div><label class="fl-l">${T('a_q_inc')}</label><textarea rows="5" data-q="includes">${esc(d.includes)}</textarea></div>
        <div><label class="fl-l">${T('a_q_exc')}</label><textarea rows="5" data-q="excludes">${esc(d.excludes)}</textarea></div>
      </div>
      <label class="fl-l">${T('a_q_notes')}</label><textarea rows="4" data-q="notes">${esc(d.notes)}</textarea>
      <div class="err" id="er" role="alert"></div>
      <div class="acts" style="margin-top:12px"><button class="btn" data-act="qpub">${T('a_q_pub', next)}</button></div></div>
      <div class="cp-h"><span>${T('a_q_est')}</span></div>${PUI.estimate(r) || '<p class="note">—</p>'}
      ${r.quote ? `<div class="cp-h"><span>${T('a_q_cur', r.quote.version)}</span></div>${PUI.quote(r)}` : ''}`;
  }

  const aiRound = (r, n) => {
    const t = r.ai && r.ai.rounds && r.ai.rounds[n];
    if (!t) return '';
    return `<div class="ai-round" data-no-tr><span class="pill dark">AI</span> <b>${T('ai_tasks')}</b><ul>${(t.tasks || []).map(i => `<li>${esc(i)}</li>`).join('')}</ul>${(t.out_of_scope || []).length ? `<p class="ai-risk">⚠ ${T('ai_scope')}: ${t.out_of_scope.map(esc).join(' · ')}</p>` : ''}${t.question ? `<p><small>${T('ai_q1')}</small> ${esc(t.question)}</p>` : ''}</div>`;
  };

  /* ---------- design ---------- */
  function designTab(r) {
    const d = r.design;
    if (!['active', 'approved', 'complete'].includes(r.status)) return `<p class="note">${T('a_d_wait')}</p>`;
    let h = '';
    if (!d.chosen) {
      const ex = d.directions;
      h += `<div class="cp-h"><span>${T('a_d_dirs')}</span></div><p class="note">${T('a_d_dirs_x')}</p>
        ${ex.length ? `<div class="ad-dirs">${ex.map(x => `<div><b>${T('dir', x.key)} · <span data-no-tr>${esc(x.title)}</span></b><p class="note" data-no-tr>${esc(x.desc)}</p>${PUI.visual(ROLE, r, x, 1)}</div>`).join('')}</div>` : ''}
        ${r.status === 'active' ? `<div class="cp-panel" style="margin-top:24px">${['A', 'B', 'C'].map((k, i) => `<div class="ad-dir"><b>${T('dir', k)}</b>
            <input type="text" id="dt${i}" placeholder="${esc(T('a_d_title'))}" value="${esc((ex[i] && ex[i].title) || '')}">
            <textarea id="dd${i}" rows="2" placeholder="${esc(T('a_d_desc'))}">${esc((ex[i] && ex[i].desc) || '')}</textarea>
            <label class="fl-l">${T('a_d_files')}</label><input type="file" id="df${i}" multiple accept="image/*,.pdf">
            <input type="url" id="dl${i}" placeholder="${esc(T('a_figma'))} https://www.figma.com/…">
            <label class="ck"><input type="checkbox" id="dm${i}">${T('a_d_demo')}</label></div>`).join('')}
          <div class="err" id="er" role="alert"></div><div class="acts"><button class="btn" data-act="dirs">${T('a_d_pub')}</button></div></div>` : ''}`;
    } else {
      const last = d.versions[d.versions.length - 1];
      h += `<div class="cp-panel"><h4>${T('a_d_chosen', d.chosen)}</h4>${d.chosenNote ? `<q data-no-tr style="display:block;white-space:pre-wrap">${esc(d.chosenNote)}</q>` : ''}<p class="note" style="margin-top:8px">${T('k_rr')}: ${Workflow.usedRounds(r)} / ${Workflow.allowedRounds(r)}</p></div>`;
      if (r.status === 'active') {
        h += `<div class="cp-h"><span>${T('a_d_ver')}</span></div><div class="cp-panel">
          <label class="fl-l" style="margin-top:0">${T('a_d_ver_note')}</label><textarea id="vn" rows="3"></textarea>
          <label class="fl-l">${T('a_d_files')}</label><input type="file" id="vf" multiple accept="image/*,.pdf">
          <label class="fl-l">${T('a_figma')}</label><input type="url" id="vl" placeholder="https://www.figma.com/…">
          ${last && last.demo ? `<label class="ck"><input type="checkbox" id="vd">${T('a_d_demo')}</label>` : ''}
          <div class="err" id="er" role="alert"></div><div class="acts"><button class="btn" data-act="ver">${T('a_d_ver_pub', d.versions.length + 1)}</button></div></div>`;
      }
      h += `<div class="cp-h"><span>${T('a_d_rounds')}</span></div>` + (d.rounds.length ? d.rounds.slice().reverse().map(x => `<div class="cp-hs"><div class="hh"><span><b>${T('hs_round', x.n)}</b>${x.extra ? ' · ' + T('hs_xr') : ''} · ${fmtDate(x.at, true)}</span><span>${x.done ? T('hs_done', x.deliveredAs) : '<b>' + T('hs_wip') + '</b>'}</span></div>${x.areas.length ? `<div class="ar">${x.areas.map(a => T('ar_' + a)).join(' · ')}</div>` : ''}${x.t1 ? `<q data-no-tr>${esc(x.t1)}</q>` : ''}${x.t2 ? `<q data-no-tr style="opacity:.7;margin-top:6px">${esc(x.t2)}</q>` : ''}${x.files.length ? `<div style="margin-top:8px">${PUI.visual(ROLE, r, x, 1)}</div>` : ''}${aiRound(r, x.n)}</div>`).join('') : `<p class="note">${T('a_d_none')}</p>`);
      h += `<div class="cp-h"><span>${T('pv')}</span></div>` + d.versions.slice().reverse().map(v => `<div class="ad-ver"><b>${T('ver', v.n)}</b> · ${fmtDate(v.at, true)}${v.note ? `<p data-no-tr style="white-space:pre-wrap">${esc(v.note)}</p>` : ''}${PUI.visual(ROLE, r, v, v.n)}</div>`).join('');
    }
    const finals = r.files.filter(f => f.kind === 'final');
    h += `<div class="cp-h"><span>${T('a_f_final')}</span></div><p class="note">${T('a_f_final_x')}</p>
      ${finals.length ? PUI.files(ROLE, r, finals) : ''}
      <div class="acts" style="margin-top:14px"><label class="btn alt file-btn" style="text-decoration:none">${T('f_up')}<input type="file" id="ff" multiple></label><span class="note" id="ff-p"></span></div>
      <label class="fl-l">${T('a_figma_final')}</label><div class="cmp"><input type="url" id="fl" value="${esc(r.finalLink || '')}" placeholder="https://www.figma.com/…"><button class="btn alt" data-act="flink">${T('a_save')}</button></div>`;
    return h;
  }

  function filesTab(r) {
    return `<div class="acts" style="margin:0 0 18px"><label class="btn alt file-btn" style="text-decoration:none">${T('f_up')}<input type="file" id="fup" multiple></label><span class="note" id="fup-p"></span></div>${PUI.files(ROLE, r)}`;
  }

  function notesTab(r) {
    const v = ui.note[r.id] !== undefined ? ui.note[r.id] : r.internalNote || '';
    return `<p class="note">${T('a_notes_x')}</p><textarea id="nt" rows="12">${esc(v)}</textarea><div class="acts"><button class="btn" data-act="note">${T('a_save')}</button></div>`;
  }

  /* ================= journal + work ================= */
  async function contentView(type) {
    const items = await API.content.list(type, { all: true });
    if (ui.edit) return editorView(type);
    return `<div class="acts" style="margin:0 0 24px"><button class="btn" data-act="cnew">${T(type === 'posts' ? 'a_p_new' : 'a_w_new')}</button></div>
      <div class="ad-content">${items.map(x => `<div class="ad-crow">
        <div class="thumb">${type === 'posts' ? postCover(x) : workCover(x)}</div>
        <div><b data-no-tr>${esc(x.title)}</b><p class="note" data-no-tr>${esc(type === 'posts' ? x.date + ' · ' + (x.tags || []).join(', ') : (x.year || '') + ' · ' + (x.services || []).join(', '))}</p>
          <p>${x.published === false ? `<span class="pill">${T('a_draft')}</span> ` : ''}${x.sample ? '<span class="pill">Sample</span> ' : ''}${x.featured ? `<span class="pill dark">★</span>` : ''}</p></div>
        <div class="acts" style="margin:0"><a class="link" href="${type === 'posts' ? 'post' : 'project'}.html?slug=${encodeURIComponent(x.slug)}" target="_blank">↗</a><button class="btn alt sm" data-act="cedit" data-s="${esc(x.slug)}">${T('a_edit')}</button>${ui.sure === 'del:' + x.slug ? `<button class="btn sm" data-act="cdel" data-s="${esc(x.slug)}">${T('a_del')} ✓</button><button class="link" data-act="unsure">${T('no')}</button>` : `<button class="link" data-act="sure" data-a="del:${esc(x.slug)}">${T('a_del')}</button>`}</div>
      </div>`).join('') || `<p class="note">—</p>`}</div>`;
  }

  function editorView(type) {
    const x = ui.edit, c = x.cover || {};
    const f = (k, label, v, attrs) => `<label class="fl-l">${label}</label><input type="text" data-c="${k}" value="${esc(v == null ? '' : v)}" ${attrs || ''}>`;
    const cb = (k, label) => `<label class="ck"><input type="checkbox" data-c="${k}" ${x[k] ? 'checked' : ''}>${label}</label>`;
    const coverPrev = type === 'posts' ? postCover(x) : workCover(x);
    const aiBox = type === 'posts' ? `<div class="cp-panel ai-post"><b><span class="pill dark">AI</span> ${T('ai_post')}</b>
      <input type="text" id="ai-topic" placeholder="${esc(T('ai_topic'))}" style="margin-top:10px"><textarea id="ai-notes" rows="2" placeholder="${esc(T('ai_pnotes'))}" style="margin-top:8px"></textarea>
      <div class="acts" style="margin-top:10px"><button class="btn sm" data-act="ai-post">${T('ai_post_btn')}</button><span class="note" id="ai-pp">${aiOn.enabled ? '' : esc(T('ai_off_short'))}</span></div></div>` : '';
    let h = aiBox + `<div class="ad-ed"><div>` + f('title', T('a_c_title'), x.title) + f('slug', T('a_c_slug'), x.slug, 'pattern="[a-z0-9-]+"');
    if (type === 'posts') {
      h += `<div class="ad-2"><div><label class="fl-l">${T('a_c_date')}</label><input type="date" data-c="date" value="${esc(x.date)}"></div><div>${f('tags', T('a_c_tags'), (x.tags || []).join(', '))}</div></div>`
        + `<label class="fl-l">${T('a_c_excerpt')}</label><textarea rows="2" data-c="excerpt">${esc(x.excerpt || '')}</textarea>`;
    } else {
      h += `<div class="ad-2"><div>${f('client', T('a_c_client'), x.client)}</div><div>${f('year', T('a_c_year'), x.year)}</div></div>` + f('services', T('a_c_services'), (x.services || []).join(', '))
        + `<label class="fl-l">${T('a_c_excerpt')}</label><textarea rows="2" data-c="summary">${esc(x.summary || '')}</textarea>`;
    }
    h += `<label class="fl-l">${T('a_c_body')}</label><div class="cp-tabs" style="margin:0 0 8px"><button class="cp-tab" data-act="cprev" aria-pressed="${!ui.preview}">${T('a_edit')}</button><button class="cp-tab" data-act="cprev" aria-pressed="${ui.preview}">${T('a_c_preview')}</button></div>`
      + (ui.preview ? `<div class="prose" style="margin-top:0" data-no-tr>${md(x.body)}</div>` : `<textarea rows="22" data-c="body" style="font:15px/1.6 ui-monospace,Menlo,monospace">${esc(x.body || '')}</textarea>`)
      + `</div><div><div class="ad-cprev">${coverPrev}</div>
      <label class="fl-l">${T('a_c_cover')}</label><p class="note">${T('a_c_cover_x')}</p>
      <input type="file" id="cimg" accept="image/*">${c.image ? `<button class="link" data-act="cimgdel">${T('a_c_remove_img')}</button>` : ''}`;
    if (type === 'posts') {
      h += `<div class="ad-2"><div><label class="fl-l">${T('a_c_mascot')}</label><select data-cv="img">${[1, 2, 3, 4, 5, 6, 7, 8].map(n => `<option value="orbit-${n}" ${c.img === 'orbit-' + n ? 'selected' : ''}>${n}</option>`).join('')}</select></div><div><label class="fl-l">BG</label><input type="color" data-cv="bg" value="${esc(c.bg || '#f7f7f6')}"></div></div>`;
    } else {
      h += `<label class="fl-l">${T('a_c_colors')}</label><div class="ad-colors">${['ink', 'accent', 'light', 'paper'].map(k => `<input type="color" data-cv="${k}" value="${esc(c[k] || '#888888')}">`).join('')}</div>
        <div class="ad-2"><div><label class="fl-l">Font</label><select data-cv="font">${[["Inter,sans-serif", 'Inter'], ["'Bricolage Grotesque',sans-serif", 'Bricolage'], ["'Playfair Display',serif", 'Playfair'], ["'Archivo Black',sans-serif", 'Archivo Black'], ["'Caveat',cursive", 'Caveat']].map(o => `<option value="${esc(o[0])}" ${c.font === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></div>
        <div><label class="fl-l">Mark</label><input type="text" maxlength="2" data-cv="mark" value="${esc(c.mark || '')}"></div></div>` + cb('featured', T('a_c_feat'));
    }
    h += cb('published', T('a_c_pub')) + cb('sample', T('a_c_sample'))
      + `<div class="err" id="er" role="alert"></div><div class="acts"><button class="btn" data-act="csave">${T('a_c_save')}</button><button class="link" data-act="ccancel">${T('a_c_cancel')}</button></div></div></div>`;
    return h;
  }

  function blank(type) {
    const today = new Date().toISOString().slice(0, 10);
    return type === 'posts'
      ? { slug: '', title: '', date: today, tags: [], excerpt: '', body: '', published: true, sample: false, cover: { img: 'orbit-' + (1 + Math.floor(Math.random() * 8)), bg: '#f8f5ee' } }
      : { slug: '', title: '', client: '', year: String(new Date().getFullYear()), services: [], summary: '', body: '', published: true, featured: false, sample: false, cover: { ink: '#111111', accent: '#f2c200', light: '#ededed', paper: '#ffffff', font: "'Bricolage Grotesque',sans-serif", weight: 700, shape: '0', mark: '' } };
  }
  const slugify = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 80);

  /* ================= render ================= */
  async function render() {
    const areas = [['reqs', T('a_reqs')], ['posts', T('a_posts')], ['works', T('a_works')]];
    const todo = reqs.filter(needsAction).length;
    let body;
    if (ui.area === 'reqs') body = `<div class="ad-grid">${listView()}${detailView(cur())}</div>`;
    else body = await contentView(ui.area);
    el.innerHTML = `<div class="lab"><span><b>${T('a_title')}</b></span><span class="cp-sp"></span><a href="index.html" target="_blank">${T('a_view_site')}</a><button class="link" data-act="logout">${T('out')}</button></div>
      ${isLocal ? `<p class="cp-demo">${T('demo')}</p>` : ''}
      <div class="cp-tabs ad-areas">${areas.map(a => `<button class="cp-tab" data-act="area" data-x="${a[0]}" aria-pressed="${ui.area === a[0]}">${a[1]}${a[0] === 'reqs' && todo ? ` <span class="cp-badge dot">${todo}</span>` : ''}</button>`).join('')}</div>${body}`;
    apply(el);
    if (ui.area === 'reqs' && ui.tab === 'msg' && cur()) { const th = $('#th'); if (th) th.scrollTop = th.scrollHeight; markRead(); }
    document.title = 'Studio | WHETŪ Studio';
  }
  async function markRead() {
    const r = cur();
    if (r && Workflow.unread(r, ROLE)) {
      try { const n = await API.act(ROLE, r.id, 'mark_read'); reqs = reqs.map(x => (x.id === n.id ? n : x)); clearBadge(); } catch (e) { /* ignore */ }
    }
  }
  const rerender = async () => {
    const y = scrollY, ly = $('.ad-items') ? $('.ad-items').scrollTop : 0;
    await render();
    scrollTo({ top: y, behavior: 'instant' });
    if ($('.ad-items')) $('.ad-items').scrollTop = ly;
  };

  const clearBadge = () => $$('[data-act=tab][data-t=msg] .cp-badge').forEach(b => b.remove());

  /* ================= events ================= */
  el.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const a = b.dataset.act, r = cur();
    if (a === 'logout') { await API.logout(ROLE); return loginView(); }
    if (a === 'area') { ui.area = b.dataset.x; ui.edit = null; ui.sure = ''; setUrl(); return rerender(); }
    if (a === 'filter') { ui.filter = b.dataset.f; return rerender(); }
    if (a === 'open') { ui.id = b.dataset.id; ui.tab = 'next'; ui.sure = ''; setUrl(); await rerender(); if (innerWidth < 1000) $('.ad-detail').scrollIntoView({ behavior: 'smooth' }); return; }
    if (a === 'tab') { ui.tab = b.dataset.t; ui.sure = ''; return rerender(); }
    if (a === 'sure') { ui.sure = b.dataset.a; return rerender(); }
    if (a === 'unsure') { ui.sure = ''; return rerender(); }
    if (a === 'do') return act(b.dataset.a, {});
    // quote
    if (a === 'qadd') { draftFor(r).lines.push({ label: '', amount: 0 }); return rerender(); }
    if (a === 'qdel') { const d = draftFor(r); d.lines.splice(+b.dataset.i, 1); if (!d.lines.length) d.lines.push({ label: '', amount: 0 }); return rerender(); }
    if (a === 'qest') { draftFor(r).lines = r.estimate.lines.map(l => ({ label: l[0], amount: l[1] })); return rerender(); }
    if (a === 'qpub') { if (await act('publish_quote', draftFor(r))) { delete ui.qd[r.id]; ui.tab = 'next'; rerender(); } return; }
    // design
    if (a === 'dirs') {
      b.disabled = true;
      try {
        const dirs = [];
        for (let i = 0; i < 3; i++) {
          const title = $('#dt' + i).value.trim(), desc = $('#dd' + i).value.trim(), fl = $('#df' + i).files, demo = $('#dm' + i).checked, link = $('#dl' + i).value.trim();
          if (!title && !fl.length && !demo && !link) continue;
          const files = await PUI.uploadAll(ROLE, r.id, fl, 'direction');
          dirs.push({ title, desc, files, link, demo: demo ? 'ABC'[dirs.length] : null });
        }
        await act('publish_directions', { directions: dirs });
      } catch (x) { $('#er').textContent = x.message; } finally { b.disabled = false; }
      return;
    }
    if (a === 'ver') {
      b.disabled = true;
      try {
        const files = await PUI.uploadAll(ROLE, r.id, $('#vf').files, 'version');
        await act('publish_version', { note: $('#vn').value, files, link: $('#vl').value.trim(), demo: $('#vd') && $('#vd').checked });
      } catch (x) { $('#er').textContent = x.message; } finally { b.disabled = false; }
      return;
    }
    if (a === 'ai-run') { try { await API.ai.intake(r.id); Site.toast(T('ai_running')); await loadReqs(); rerender(); } catch (x) { Site.toast(x.message); } return; }
    if (a === 'ai-quote') { const x = r.ai.brief.data; ui.qd[r.id] = Object.assign(draftFor(r), { lines: x.quote.map(q => ({ label: q.label, amount: q.amount })), notes: x.quote_notes || '' }); ui.tab = 'quote'; return rerender(); }
    if (a === 'ai-ask') { ui.msg = r.ai.brief.data.questions.map((q, i) => `${i + 1}. ${q}`).join('\n'); ui.tab = 'msg'; return rerender(); }
    if (a === 'ai-reply') {
      const p = $('#ai-p'); b.disabled = true; p.textContent = T('ai_writing');
      try { const out = await API.ai.reply(r.id); ui.msg = out.draft; rerender(); } catch (x) { p.textContent = x.message; } finally { b.disabled = false; }
      return;
    }
    if (a === 'ai-post') {
      const p = $('#ai-pp'); b.disabled = true; p.textContent = T('ai_writing');
      try {
        const out = await API.ai.post($('#ai-topic').value, $('#ai-notes').value);
        Object.assign(ui.edit, { title: out.title, slug: ui.editSlug ? ui.edit.slug : slugify(out.slug || out.title), excerpt: out.excerpt, tags: out.tags, body: out.body });
        rerender();
      } catch (x) { p.textContent = x.message; } finally { b.disabled = false; }
      return;
    }
    if (a === 'flink') return act('deliver_files', { files: r.files.filter(f => f.kind === 'final').map(f => f.id), link: $('#fl').value.trim() }, T('saved'));
    if (a === 'note') { if (await act('set_note', { note: ui.note[r.id] !== undefined ? ui.note[r.id] : r.internalNote })) { delete ui.note[r.id]; Site.toast(T('saved')); } return; }
    // content
    if (a === 'cnew') { ui.edit = blank(ui.area); ui.editSlug = ''; ui.preview = false; return rerender(); }
    if (a === 'cedit') { const items = await API.content.list(ui.area, { all: true }); ui.edit = JSON.parse(JSON.stringify(items.find(x => x.slug === b.dataset.s))); ui.editSlug = ui.edit.slug; ui.preview = false; return rerender(); }
    if (a === 'cdel') { ui.sure = ''; try { await API.content.remove(ui.area, b.dataset.s); rerender(); } catch (x) { Site.toast(x.message); } return; }
    if (a === 'ccancel') { ui.edit = null; return rerender(); }
    if (a === 'cprev') { ui.preview = !ui.preview; return rerender(); }
    if (a === 'cimgdel') { delete ui.edit.cover.image; return rerender(); }
    if (a === 'csave') {
      const x = ui.edit;
      x.slug = slugify(x.slug || x.title);
      if (!x.title.trim() || !x.slug) { $('#er').textContent = T('a_c_title') + ' / ' + T('a_c_slug') + '?'; return; }
      try { await API.content.save(ui.area, x, ui.editSlug); ui.edit = null; Site.toast(T('a_c_saved')); rerender(); } catch (er) { $('#er').textContent = er.message; }
    }
  });

  el.addEventListener('input', e => {
    const t = e.target, r = cur();
    if (t.id === 'aq') { ui.q = t.value; const pos = t.selectionStart; rerender().then(() => { const n = $('#aq'); n.focus(); n.setSelectionRange(pos, pos); }); return; }
    if (t.id === 'cmp-t') { ui.msg = t.value; return; }
    if (t.id === 'nt') { ui.note[r.id] = t.value; return; }
    if (t.dataset.q && r) {
      const d = draftFor(r);
      if (t.dataset.i !== undefined) d.lines[+t.dataset.i][t.dataset.q] = t.dataset.q === 'amount' ? t.value : t.value;
      else d[t.dataset.q] = t.value;
      if (t.dataset.q === 'amount') {
        const tt = Workflow.quoteTotals(d.lines.map(l => ({ amount: Number(l.amount) || 0 })));
        const ls = $$('#qtot .l span:last-child');
        [tt.sub, tt.gst, tt.total, tt.total / 2].forEach((v, i) => { ls[i].textContent = money(v); });
      }
      return;
    }
    if (ui.edit && t.dataset.c) {
      const k = t.dataset.c;
      if (t.type === 'checkbox') ui.edit[k] = t.checked;
      else if (k === 'tags' || k === 'services') ui.edit[k] = t.value.split(',').map(s => s.trim()).filter(Boolean);
      else ui.edit[k] = t.value;
      if (k === 'title' && !ui.editSlug) { ui.edit.slug = slugify(t.value); const s = $('[data-c=slug]'); if (s) s.value = ui.edit.slug; }
    }
    if (ui.edit && t.dataset.cv) { ui.edit.cover = ui.edit.cover || {}; ui.edit.cover[t.dataset.cv] = t.value; const p = $('.ad-cprev'); if (p) { p.innerHTML = ui.area === 'posts' ? postCover(ui.edit) : workCover(ui.edit); } }
  });

  el.addEventListener('change', async e => {
    const t = e.target, r = cur();
    if (t.id === 'cmp-f') { ui.pendingFiles = [...t.files]; $('#cmp-p').textContent = ui.pendingFiles.map(f => f.name).join(', '); }
    if (t.id === 'fup' && t.files.length) {
      try { $('#fup-p').textContent = T('uploading'); const ids = await PUI.uploadAll(ROLE, r.id, t.files, 'message'); await act('message', { text: '', files: ids }); } catch (x) { Site.toast(x.message); }
    }
    if (t.id === 'ff' && t.files.length) {
      try {
        $('#ff-p').textContent = T('uploading');
        await PUI.uploadAll(ROLE, r.id, t.files, 'final');
        const fresh = await API.get(ROLE, r.id);
        reqs = reqs.map(x => (x.id === fresh.id ? fresh : x));
        await act('deliver_files', { files: fresh.files.filter(f => f.kind === 'final').map(f => f.id) });
      } catch (x) { Site.toast(x.message); $('#ff-p').textContent = ''; }
    }
    if (t.id === 'cimg' && t.files[0]) {
      try { const url = await API.content.uploadMedia(t.files[0]); ui.edit.cover = Object.assign({}, ui.edit.cover, { image: url }); rerender(); } catch (x) { $('#er').textContent = x.message; }
    }
  });

  el.addEventListener('submit', async e => {
    if (e.target.id !== 'cmp') return;
    e.preventDefault();
    const r = cur();
    if (!ui.msg.trim() && !ui.pendingFiles.length) return;
    try {
      const ids = await PUI.uploadAll(ROLE, r.id, ui.pendingFiles, 'message');
      if (await act('message', { text: ui.msg, files: ids })) { ui.msg = ''; ui.pendingFiles = []; await rerender(); const th = $('#th'); if (th) th.scrollTop = th.scrollHeight; $('#cmp-t').focus({ preventScroll: true }); }
    } catch (x) { Site.toast(x.message); }
  });
  el.addEventListener('keydown', e => {
    if (e.target.id === 'cmp-t' && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); $('#cmp').requestSubmit(); }
  });

  /* ================= start ================= */
  let unsub = null;
  async function start() {
    if (!(await loadReqs())) return;
    aiOn = await API.ai.status();
    if (!ui.id && reqs.length) { const first = reqs.find(needsAction) || reqs[0]; ui.id = first.id; }
    // Start on 'Needs action' only when something needs action.
    if (ui.filter === 'todo' && !reqs.some(needsAction)) ui.filter = reqs.some(FILTERS.open) ? 'open' : 'all';
    setUrl();
    await render();
    if (!unsub) unsub = API.subscribe(async () => {
      if (ui.area !== 'reqs') return;
      const sig = reqs.map(r => r.id + r.updatedAt + r.messages.length).join();
      if (!(await loadReqs())) return;
      if (reqs.map(r => r.id + r.updatedAt + r.messages.length).join() === sig) return;
      const a = document.activeElement, typing = a && el.contains(a) && /^(TEXTAREA|INPUT|SELECT)$/.test(a.tagName);
      if (typing && ui.tab === 'msg' && $('#th')) { $('#th').innerHTML = PUI.thread(ROLE, cur()); apply($('#th')); $('#th').scrollTop = $('#th').scrollHeight; markRead(); }
      else if (!typing) rerender();
    });
  }

  Site.onLang(() => { if (ui.area) rerender(); });
  if ((await API.session(ROLE)) || (await API.demoSignIn(ROLE))) start(); else loginView();
})();
