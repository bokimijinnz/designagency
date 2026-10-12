/*
 * Rendering pieces shared by the client portal and the studio admin:
 * concept boards, design visuals, files, the message thread, the brief and
 * the quote. `role` is 'client' or 'studio' — it decides whose messages are "mine".
 */
const SERVICE_NAMES = { logo: 'Logo', brand: 'Brand identity', web: 'Website', brochure: 'Brochure (4 pages)', social: 'Social set (4 assets)', card: 'Business card', app: 'App UI/UX', space: 'Space & signage', mkt: 'Ongoing marketing' };

// Labels for the estimate answers (the same wording as the estimate questions).
const BRIEF_LABELS = {
  biz: 'Business name', ind: 'Industry', what: 'What do you do, in a sentence or two?', stage: 'Stage', years: 'How long have you been operating?', team: 'Team size', region: 'Where are you based?', site: 'Website or social links (optional)', lang: 'Language you\'re most comfortable in',
  why: 'What\'s the main thing you want this project to achieve?', problem: 'What problem are you trying to solve with new design?',
  b_origin: 'What\'s the story behind your business?', b_values: 'What do you stand for?', b_aud: 'Who do you most want to reach?', b_diff: 'What makes your offer different?', b_cust: 'What do customers value or struggle with when choosing you?', b_feel: 'What should people feel when they see your brand?', b_state: 'Where is your brand at now?', b_type: 'Logo style you lean towards', b_app: 'Where will it appear?', b_guide: 'How much guidance do you need?',
  w_aud: 'Who visits, and what are they trying to find?', w_act: 'Most important action visitors should take', w_url: 'Current website (if any)', w_prob: 'What\'s difficult about your current site?', w_pages: 'Pages you need', pages: 'How many pages in total?', w_type: 'What kind of site?', w_int: 'Integrations', w_content: 'Do you have the writing ready?', w_photo: 'Photos and testimonials', w_plat: 'Platform', w_scope: 'Design only, or design and build?', w_extra: 'Extras you\'d want',
  p_items: 'What do you need printed?', p_use: 'What is each piece for, and who gets it?', p_size: 'Size, page count and finish, if known', p_cont: 'Content', p_prod: 'Output', p_qty: 'Rough quantity',
  c_det: 'Name, title and details for the card', c_side: 'Sides',
  s_plat: 'Platforms', s_goal: 'What should the posts do for you?', s_topics: 'What will you post about?', s_tpl: 'Format',
  a_user: 'Who uses it?', a_tasks: 'Top three tasks users must complete', a_fail: 'Where do users get stuck today?', a_plat: 'Platform', a_scr: 'Rough number of screens', a_ex: 'Existing product?', a_res: 'Research and testing', a_dev: 'Design only, or development too?', a_acc: 'Accessibility expectations',
  x_type: 'What is it?', x_ref: 'Photos or plans available?', x_size: 'Size, number of locations, materials', x_inst: 'Who handles production and install?',
  m_goal: 'Main objective', m_ch: 'Channels', m_out: 'Outputs per month', m_assets: 'Brand assets', m_pub: 'Design only, or managed publishing?', m_rep: 'Reporting', m_ad: 'Ad spend (separate from our fees)',
  love: 'Brands, sites or designs you admire, and why', avoid: 'Anything you want to avoid?', colour: 'Colour direction', hex: 'Your brand colours, if you have them', type: 'Typography feel', assets: 'What do you already have?', lic: 'Do you have licences or rights for anything you\'ll supply?',
  deadline: 'When do you need it?', date: 'Target date or month', why_date: 'What is driving that date?', budget: 'Budget range (optional)', who: 'Who makes the final decision?', approve: 'How quickly can you review each round?', more: 'Anything else your designer should know?', how: 'How did you hear about us? (optional)',
  name: 'Your name', email: 'Email', role: 'Your role', refs: 'Reference links (optional)'
};

// Demo concept boards (from the original prototype) for directions without uploaded images.
const DEMO_DIRS = {
  A: { f: "'Playfair Display',serif", w: 500, fn: 'Playfair Display', shape: '50%', pal: [['#3b2a20', '#b85c38', '#e8d5b5', '#faf5ea'], ['#33241b', '#c0653a', '#ecdcbf', '#fbf7ee'], ['#2e2018', '#c96a3c', '#efe1c8', '#fdfaf2']] },
  B: { f: "'Archivo Black','Bricolage Grotesque',sans-serif", w: 400, fn: 'Archivo Black', shape: '0', pal: [['#111111', '#f2c200', '#ededed', '#ffffff'], ['#0d0d0d', '#ffd21a', '#f0f0f0', '#ffffff'], ['#000000', '#ffd400', '#f4f4f4', '#ffffff']] },
  C: { f: "'Bricolage Grotesque',sans-serif", w: 700, fn: 'Bricolage Grotesque', shape: '38% 62% 55% 45% / 52% 40% 60% 48%', pal: [['#2f4a3c', '#8fb89a', '#f3d7d0', '#f8f6f0'], ['#2b4538', '#7fb08c', '#f6d9d1', '#faf8f2'], ['#26402f', '#76a985', '#f8dcd4', '#fbf9f3']] }
};
const DEMO_COPY = {
  A: ['Warm & Rooted', 'Earthy tones and a classic serif. Feels established, friendly and trustworthy.'],
  B: ['Bold & Modern', 'High contrast and a strong grotesque. Confident and easy to spot from across the street.'],
  C: ['Soft & Fresh', 'Gentle greens and rounded shapes. Calm, friendly and easy to approach.']
};

const PUI = {
  statusLabel: r => T('st_' + r.status),
  services: r => (r.services || []).map(k => tr(SERVICE_NAMES[k] || k)).join(', ') || '—',
  isImg: f => /^image\//.test(f.type || '') || /\.(png|jpe?g|gif|webp|svg)$/i.test(f.name || ''),
  fileById: (r, id) => r.files.find(f => f.id === id),

  board(key, v, name) {
    const D = DEMO_DIRS[key] || DEMO_DIRS.A, i = Math.min(Math.max(v, 1), 3) - 1, p = D.pal[i];
    const ini = (Array.from(String(name).trim())[0] || 'K').toUpperCase(), sc = [1, 1.08, 1.14][i];
    const mk = c => `<div class="cp-mk ${c}" style="border-radius:${D.shape}"><span>${esc(ini)}</span></div>`;
    return `<div class="cp-board" data-no-tr style="--ink:${p[0]};--ac:${p[1]};--lt:${p[2]};--pp:${p[3]};--ff:${D.f};--fw:${D.w}">
      <div class="cp-b1"><div class="cp-mkw" style="transform:scale(${sc})">${mk('')}</div><div class="cp-wm">${esc(name)}</div></div>
      <div class="cp-b2"><div><em>${T('bd_col')}</em><div class="cp-sw">${p.map(c => `<div><i style="background:${c}"></i><span>${c}</span></div>`).join('')}</div></div><div class="cp-ty"><em>${T('bd_ty')}</em><b>Aa</b><span>${D.fn}</span></div></div>
      <div class="cp-b3"><div class="cp-card"><em>${T('bd_card')}</em><div class="cp-row">${mk('sm')}<span class="cp-wm sm">${esc(name)}</span></div><small>hello@business.co.nz</small></div><div class="cp-sign"><em>${T('bd_sign')}</em><div class="cp-row">${mk('sm')}<span class="cp-wm sm">${esc(name)}</span></div></div></div></div>`;
  },

  // A direction or version: uploaded images/files, or a demo board.
  visual(role, r, item, v) {
    const files = (item.files || []).map(id => PUI.fileById(r, id)).filter(Boolean);
    const fig = item.link ? `<a class="btn alt figma" href="${esc(item.link)}" target="_blank" rel="noopener">${T('open_figma')}</a>` : '';
    if (!files.length) return (item.demo ? PUI.board(item.demo, v || 1, r.biz) : '') + fig;
    return fig + `<div class="cp-gal">${files.map(f => {
      const u = API.fileUrl(role, r.id, f);
      return PUI.isImg(f) && u ? `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="${esc(f.name)}" loading="lazy"></a>`
        : `<div class="doc"><span data-no-tr>${esc(f.name)}</span>${u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${T('dl')} ↗</a>` : ''}</div>`;
    }).join('')}</div>`;
  },

  fileRow(role, r, f, extra) {
    const u = API.fileUrl(role, r.id, f);
    const who = f.by === 'studio' ? T('m_studio') : f.by === 'client' ? (role === 'client' ? T('m_you') : T('m_client')) : '';
    return `<div class="f"><span class="nm"><span data-no-tr>${esc(f.name)}</span><small>${T('f_kind_' + (f.kind || 'message'))} · ${fmtSize(f.size)} · ${who} · ${fmtDate(f.at)}${u ? '' : ' · ' + T('f_local')}</small></span>${extra || ''}${u ? `<a href="${esc(u)}" target="_blank" rel="noopener" download="${esc(f.name)}">${T('dl')} ↗</a>` : ''}</div>`;
  },

  files(role, r, list) {
    list = list || r.files;
    return list.length ? `<div class="cp-files">${list.slice().reverse().map(f => PUI.fileRow(role, r, f)).join('')}</div>` : `<p class="note">${T('f_empty')}</p>`;
  },

  thread(role, r) {
    if (!r.messages.some(m => m.by !== 'system')) {
      return r.messages.map(m => `<div class="th-sys">${esc(sysText(m))} · ${fmtDate(m.at, true)}</div>`).join('') + `<div class="th-empty">${T('m_empty')}</div>`;
    }
    return r.messages.map(m => {
      if (m.by === 'system') return `<div class="th-sys">${esc(sysText(m))} · ${fmtDate(m.at, true)}</div>`;
      const me = m.by === role;
      const who = me ? T('m_you') : m.by === 'studio' ? T('m_studio') : (r.client.name || T('m_client'));
      const att = (m.files || []).map(id => PUI.fileById(r, id)).filter(Boolean).map(f => {
        const u = API.fileUrl(role, r.id, f);
        if (!u) return `<a>${esc(f.name)}</a>`;
        return PUI.isImg(f) ? `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="${esc(f.name)}"></a>` : `<a href="${esc(u)}" target="_blank" rel="noopener">📎 ${esc(f.name)}</a>`;
      }).join('');
      return `<div class="th-m${me ? ' me' : ''}"><span class="who" data-no-tr>${esc(who)} · ${fmtDate(m.at, true)}</span>${m.text ? `<div class="b" data-no-tr>${esc(m.text)}</div>` : ''}${att ? `<div class="att" data-no-tr>${att}</div>` : ''}</div>`;
    }).join('');
  },

  composer: draft => `<form class="cmp-wrap" id="cmp">
      <div class="cmp"><textarea id="cmp-t" rows="2" placeholder="${esc(T('m_ph'))}">${esc(draft || '')}</textarea><button class="btn" type="submit">${T('m_send')}</button></div>
      <div class="cmp-bar"><label class="file-btn">${T('m_attach')}<input type="file" id="cmp-f" multiple></label><span class="pend" id="cmp-p"></span><span class="note" style="margin-left:auto">${T('m_lang')}</span></div>
    </form>`,

  brief(r) {
    const a = r.answers || {};
    const val = v => Array.isArray(v) ? v.map(x => tr(String(x))).join(', ') : (typeof v === 'boolean' ? (v ? '✓' : '') : String(v));
    const rows = Object.keys(a).filter(k => val(a[k])).map(k => `<div class="row2"><dt>${esc(tr(BRIEF_LABELS[k] || k))}</dt><dd data-no-tr>${esc(val(a[k]))}</dd></div>`).join('');
    const est = r.estimate || {};
    return `<div class="brief">
      <div class="cp-h"><span>${T('b_sum')}</span></div>
      <dl>
        <div class="row2"><dt>${tr('Business')}</dt><dd data-no-tr>${esc(r.biz)}</dd></div>
        <div class="row2"><dt>${T('k_svc')}</dt><dd>${esc(PUI.services(r))}</dd></div>
        <div class="row2"><dt>${tr('Email')}</dt><dd data-no-tr>${esc(r.client.name)} · ${esc(r.client.email)}${r.client.role ? ' · ' + esc(r.client.role) : ''}</dd></div>
        ${est.tot ? `<div class="row2"><dt>${T('est_tot')}</dt><dd>${money(est.tot)}</dd></div>` : ''}
        ${(est.manual || []).length ? `<div class="row2"><dt>${T('est_sep')}</dt><dd>${est.manual.map(m => esc(tr(m))).join(', ')}</dd></div>` : ''}
      </dl>
      ${r.brief ? `<div class="cp-h"><span>${T('br_h')}</span><span>${fmtDate(r.brief.at)}</span></div><dl>${Workflow.BRIEF_KEYS.filter(k => r.brief[k] && String(r.brief[k]).length).map(k => `<div class="row2"><dt>${T('br_' + k)}</dt><dd data-no-tr>${esc(Array.isArray(r.brief[k]) ? r.brief[k].join(', ') : r.brief[k])}</dd></div>`).join('')}</dl>` : ''}
      <div class="cp-h"><span>${T('b_ans')}</span></div>
      <dl>${rows || `<p class="note">${T('b_none')}</p>`}</dl>
    </div>`;
  },

  estimate(r) {
    const e = r.estimate || {};
    if (!e.lines || !e.lines.length) return '';
    const w = e.weeks && e.weeks[1] ? (e.weeks[0] === e.weeks[1] ? e.weeks[0] : e.weeks[0] + '–' + e.weeks[1]) : '';
    return invoiceHtml({
      title: T('inv_est'), sub: T('inv_est_sub'),
      meta: [[T('inv_no'), 'EST-' + esc(r.id.slice(4))], [T('inv_bill'), `<span data-no-tr>${esc(r.biz)}</span>`], [T('inv_date'), fmtDate(r.createdAt)], [T('q_time'), w ? T('inv_weeks', w) : '—']],
      lines: e.lines.map(l => [l[0], l[1]]),
      notes: (e.manual || []).length ? `<b>${T('est_sep')}</b><ul>${e.manual.map(m => `<li>${esc(tr(m))}</li>`).join('')}</ul>` : `<b>${tr('Notes')}</b><p>${T('inv_est_note')}</p>`,
      sums: [[T('q_sub'), money(e.sub)], [T('q_gst'), money(e.gst)], [T('q_tot'), money(e.tot), 'tot']],
      stamp: { text: T('inv_draft'), small: T('inv_draft_s'), tone: 'grey' }
    });
  },

  quote(r) {
    const q = r.quote;
    if (!q) return '';
    const lst = s => s ? `<ul>${s.split('\n').map(x => x.replace(/^[-•*]\s*/, '').trim()).filter(Boolean).map(x => `<li data-no-tr>${esc(x)}</li>`).join('')}</ul>` : '';
    const notes = [
      q.notes ? `<div><b>${T('q_notes')}</b><p data-no-tr style="white-space:pre-wrap">${esc(q.notes)}</p></div>` : '',
      q.includes ? `<div><b>${T('q_inc')}</b>${lst(q.includes)}</div>` : '',
      q.excludes ? `<div><b>${T('q_exc')}</b>${lst(q.excludes)}</div>` : ''
    ].join('');
    const accepted = !!r.acceptedAt && ['accepted', 'active', 'approved', 'complete'].includes(r.status);
    return invoiceHtml({
      title: T('inv_quote'), sub: `v${q.version} · NZD`,
      meta: [[T('inv_no'), esc(q.id)], [T('inv_bill'), `<span data-no-tr>${esc(r.biz)}<br><small>${esc(r.client.name || '')}</small></span>`], [T('inv_issued'), fmtDate(q.publishedAt)], [T('inv_valid'), fmtDate(q.validUntil)]],
      lines: q.lines.map(l => [l.label, l.amount]),
      notes: notes + (q.weeks ? `<div><b>${T('q_time')}</b><p data-no-tr>${esc(q.weeks)}</p></div>` : ''),
      sums: [[T('q_sub'), money(q.sub)], [T('q_gst'), money(q.gst)], [T('q_tot'), money(q.total), 'tot'], [T('q_dep'), money(q.total / 2)], [T('q_bal'), money(q.total / 2), 'muted']],
      stamp: accepted ? { text: T('inv_acc'), small: fmtDate(r.acceptedAt), tone: 'green' } : { text: T('inv_appr'), small: T('inv_appr_s') }
    }) + `<div class="cols"><div><b>${T('q_terms')}</b><ul>${T('q_terms_l').map(x => `<li>${x}</li>`).join('')}</ul></div></div>`;
  },

  // Uploads a FileList one by one; returns the new file ids.
  async uploadAll(role, id, list, kind, onStep) {
    const ids = [];
    for (const f of list || []) {
      if (onStep) onStep(f);
      const meta = await API.upload(role, id, f, kind);
      ids.push(meta.id);
    }
    return ids;
  }
};
