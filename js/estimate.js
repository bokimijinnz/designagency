/*
 * Estimate wizard. Seven steps, a live price, then a real quote request that
 * lands in the studio admin and opens a private My Studio portal for the client.
 *
 * Prices live in SV (starting prices) and calc() (line items). Change them there.
 */
(function () {
  const PREVIEW = false; /* true = never block Next (for reviewing the form) */
  const KEY = 'whetu.estimate';
  const newId = () => 'EST-2026-' + (1000 + Math.floor(Math.random() * 9000));
  const S = { step: 0, svc: [], d: {}, sent: false, cid: newId(), reqId: '', code: '', email: '' };
  try { const x = JSON.parse(localStorage.getItem(KEY) || 'null'); if (x) Object.assign(S, x); } catch (e) { /* ignore */ }
  // Older saved progress used 7 steps: start those over at step 1.
  if (S.sent) S.step = 3; else if (S.step > 2) S.step = 0;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } };

  const D = k => S.d[k] || '', has = (k, v) => [].concat(S.d[k] || []).includes(v), sv = k => S.svc.includes(k);

  const STEPS = ['Services', 'A few details', 'Estimate and send'];
  const SV = Pricing.SV;
  const OK = [1, 4, 5, 2, 3, 7, 8, 1];

  /* ---------- pricing (prices live in js/pricing.js) ---------- */
  const wk = () => Pricing.weeks(S.svc, S.d);
  const calc = () => Pricing.calc(S.svc, S.d);
  function incl() {
    const a = [];
    if (sv('brand')) a.push('Origin brief, two initial logo directions with rationale, colour and type, mini guide, business card, three illustrative mockups, final logo files');
    else if (sv('logo')) a.push('Origin brief, two initial directions with rationale, three illustrative mockups, final logo exports');
    if (sv('web')) a.push('Sitemap, look-and-feel board, one chosen direction, desktop and mobile page designs delivered as a Figma file and PDF');
    if (sv('brochure')) a.push('Four-page layout from your supplied material');
    if (sv('social')) a.push('Four static branded assets');
    return a;
  }

  /* ---------- field builders ---------- */
  const ch = (k, opts, m) => `<div class="chips">${opts.map(o => `<button type="button" class="chip" data-f="${k}" data-v="${esc(o)}" data-m="${m ? 1 : ''}" aria-pressed="${has(k, o)}">${o}</button>`).join('')}</div>`;
  const F = (k, l, t, o, h) => `<div class="fld"><div class="q">${l}${h ? `<small class="hint">${h}</small>` : ''}</div>` + (
    t == 't' ? `<input type="text" data-f="${k}" value="${esc(D(k))}" placeholder="${esc(PH[k] || '')}">`
      : t == 'a' ? `<textarea rows="3" data-f="${k}" placeholder="${esc(PH[k] || '')}">${esc(D(k))}</textarea>`
        : t == 's' ? `<select data-f="${k}"><option value="">Choose</option>${o.map(x => `<option value="${esc(x)}" ${D(k) == x ? 'selected' : ''}>${x}</option>`).join('')}</select>`
          : ch(k, o, t == 'm')) + '</div>';
  const orb = t => `<div class="orb"><span class="oc oc${OK[S.step] || 1}" aria-hidden="true"></span><p>${t}</p></div>`;
  const live = () => {
    const r = calc(), [l, h] = wk();
    return `<div class="livebar"><span><b>Live estimate</b> ${r.L.length ? money(r.tot) + ' incl. GST' : 'Pick a service to see your price'}</span><span>${l || h ? (l == h ? l : l + '–' + h) + ' weeks' : 'Timeline appears with your services'}${r.M.length ? ' · ' + r.M.length + ' item' + (r.M.length > 1 ? 's' : '') + ' quoted separately' : ''}</span></div>`;
  };

  /* ---------- render ---------- */
  function render() {
    const st = $('#stage'), c = S.step;
    save();
    $('#rail').innerHTML = STEPS.map((t, i) => `<li class="${i == c ? 'on' : i < c ? 'done' : ''}" ${S.sent ? '' : `data-go="${i}" tabindex="0" role="button"`}>${i + 1} ${t}</li>`).join('')
      + '<li class="later">After you send</li>'
      + ['Designer review', 'Quote published', 'You accept the quote', 'Deposit and project tools'].map(t => `<li class="after">${t}</li>`).join('');
    let h = '';
    const nav = n => `<div class="err" id="er" role="alert"></div><div class="acts">${c ? '<button class="link" data-n="-1">Back</button>' : ''}<button class="btn" data-n="1">${n} ↗</button></div><p class="note">Your answers are kept on this device as you go. No account or email needed until the last step.</p>`;

    // Step 1: services, with the live price.
    if (c == 0) h = `<h3>What do you need?</h3>${orb('Pick everything that applies. Your price updates as you tap.')}<div class="chips">${SV.map(a => `<button type="button" class="chip" data-svc="${a[0]}" aria-pressed="${sv(a[0])}">${a[1]}<small>from ${a[2]}</small></button>`).join('')}</div>
      ${sv('web') || sv('app') ? '<div class="flag"><b>Design files only</b><p style="margin:4px 0 0">Websites and apps are delivered as Figma files and PDF, ready for your developer or platform. Building and hosting are not included.</p></div>' : ''}${nav('Next')}`;

    // Step 2: only what changes the price or the timing.
    if (c == 1) h = `<h3>A few details.</h3>${orb('Only what changes your price or timing. The rest your designer asks later.')}`
      + F('biz', 'Business name', 't') + F('what', 'What do you do, in a sentence or two?', 'a')
      + (sv('brand') || sv('logo') ? F('b_state', 'Where is your brand at now?', 'c', ['New, nothing yet', 'Refresh what I have', 'Full rebrand']) : '')
      + (sv('web') ? F('pages', 'How many pages in total?', 'c', ['5', '6', '7', '8', '9+'], 'Pages 6 to 8 add $180 each. 9 or more is scoped by hand.') + F('w_type', 'What kind of site?', 'c', ['Information only', 'Appointment booking', 'Online store', 'Membership', 'Custom functionality']) + F('w_content', 'Do you have the writing ready?', 'c', ['All of it', 'Some of it', 'None, I need copywriting']) : '')
      + (sv('app') ? F('a_scr', 'Rough number of screens', 'c', ['Under 10', '10 to 25', '25 to 50', '50+', 'Not sure']) : '')
      + (sv('space') ? F('x_type', 'What is it?', 'c', ['Shopfront sign', 'Interior graphics', 'Wayfinding', 'Vehicle', 'Event or pop-up']) : '')
      + (sv('mkt') ? F('m_ch', 'Channels', 'm', ['Instagram', 'Facebook', 'LinkedIn', 'Google search ads', 'Blog', 'Email']) : '')
      + F('deadline', 'When do you need it?', 'c', ['Flexible', 'A planned month', 'Priority request'], 'Priority requests are reviewed by hand.')
      + (D('deadline') && D('deadline') !== 'Flexible' ? F('date', 'Target date or month', 't') : '')
      + F('budget', 'Budget range (optional)', 'c', ['Under $1,000', '$1,000 to $2,500', '$2,500 to $5,000', '$5,000+', 'Not sure'])
      + nav('See my estimate');

    // Step 3: the estimate, then contact details and send.
    if (c == 2) {
      const r = calc(), i = incl();
      const [lo, hi] = wk();
      h = `<h3>Your estimate.</h3>` + invoiceHtml({
        title: 'ESTIMATE', sub: 'Indicative · NZD',
        meta: [['Estimate no.', S.cid], ['Bill to', esc(D('biz')) || 'Your business'], ['Date', fmtDate(Date.now())], ['Timeline', lo || hi ? `${lo == hi ? lo : lo + '–' + hi} weeks` : '—']],
        lines: r.L,
        notes: r.M.length ? `<b>Additional scope review needed</b><ul>${r.M.map(m => `<li>${m}</li>`).join('')}</ul><p>These are quoted separately. No total is shown for them.</p>` : `<b>What's included</b><ul>${i.map(x => `<li>${x}</li>`).join('') || '<li>Confirmed once scoped</li>'}</ul>`,
        sums: r.L.length ? [['Subtotal', money(r.sub)], ['GST (15%)', money(r.gst)], ['Indicative total', money(r.tot), 'tot']] : [],
        stamp: { text: 'DRAFT', small: 'A DESIGNER CHECKS IT NEXT', tone: 'grey' }
      }) + `<h4 class="sh" style="margin-top:56px">Where should we send your quote?</h4>`
        + F('name', 'Your name', 't') + F('email', 'Email', 't') + F('more', 'Anything else your designer should know? (optional)', 'a')
        + `<div class="fld"><div class="q">Upload brand files or references (optional)</div><input type="file" id="files" multiple></div><label class="ck"><input type="checkbox" id="ack">I understand this is a quote request. No payment is required, and my project isn't booked yet.</label><p class="note">A designer checks this estimate and replies in My Studio, your private project page.</p><div class="err" id="er" role="alert"></div><div class="acts"><button class="link" data-n="-1">Back</button><button class="btn" id="send">Send my quote request ↗</button></div>`;
    }
    if (c == 3) {
      const login = `login.html?email=${encodeURIComponent(S.email)}&code=${encodeURIComponent(S.code)}`;
      h = `<h3>Thanks — your request is in.</h3><p style="max-width:56ch">A designer will review the scope and price, and your quote or any questions will appear in My Studio. <b>You haven't been charged, and you're not committed to a project.</b></p>
      <div class="code-box"><div><small>Your My Studio access code</small><b data-no-tr>${esc(S.code)}</b></div><a class="btn" href="${login}" style="background:#fff;color:#000">Open My Studio ↗</a></div>
      <p class="note">Sign in with <b data-no-tr>${esc(S.email)}</b> and this code. Keep it somewhere safe.</p>
      <ul class="tl"><li class="d">Request sent</li><li>A designer reviews it and publishes your quote</li><li>You accept, then pay a 50% deposit</li><li>Design starts in My Studio</li></ul>
      <div class="acts"><a class="btn" href="${login}">Open My Studio ↗</a><button class="link" id="again">Start another estimate</button></div>`;
    }
    if (c < 3) h = `<div class="stp"><span>STEP ${c + 1} OF 3 · ${STEPS[c].toUpperCase()}</span><i style="width:${(c + 1) / 3 * 100}%"></i></div>` + h;
    if (c < 2) h = live() + h;
    st.innerHTML = h;
    apply(st); apply($('#rail'));
  }

  /* ---------- sending ---------- */
  async function send(btn) {
    const er = m => { $('#er').textContent = tr(m); };
    if (!D('name').trim()) return er('Enter your name.');
    if (!/^\S+@\S+\.\S+$/.test(D('email').trim())) return er('Enter a valid email, like name@business.co.nz.');
    if (!$('#ack').checked) return er('Tick the box to confirm you understand this is a quote request.');
    btn.disabled = true;
    try {
      const r = calc();
      const res = await API.createRequest({
        client: { name: D('name'), email: D('email'), role: D('role') },
        biz: D('biz'), lang: LANG, services: S.svc, answers: S.d,
        estimate: { lines: r.L, manual: r.M, sub: r.sub, gst: r.gst, tot: r.tot, weeks: wk() }
      });
      const files = $('#files') && $('#files').files;
      if (files && files.length) {
        // Sign in quietly so the brief files can be attached to the new request.
        try {
          await API.login('client', { email: res.email, code: res.accessCode });
          for (const f of files) await API.upload('client', res.id, f, 'brief');
        } catch (e) { console.warn('Upload failed', e); }
      }
      Object.assign(S, { step: 3, sent: true, reqId: res.id, code: res.accessCode, email: res.email });
      render();
      toStage();
    } catch (e) {
      er(e.message);
      btn.disabled = false;
    }
  }

  /* ---------- events ---------- */
  const align = el => { const f = el.closest('.fld') || el.parentElement; scrollTo({ top: scrollY + f.getBoundingClientRect().top - 138, behavior: 'smooth' }); };
  const toStage = () => scrollTo({ top: scrollY + $('#stage').getBoundingClientRect().top - 100, behavior: 'smooth' });
  const need = () => {
    if (PREVIEW) return;
    const c = S.step;
    if (c == 0 && !S.svc.length) return 'Choose at least one service.';
  };

  $('#rail').addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) { S.step = +g.dataset.go; render(); toStage(); } });
  $('#rail').addEventListener('keydown', e => { if (e.key == 'Enter' || e.key == ' ') { const g = e.target.closest('[data-go]'); if (g) { e.preventDefault(); g.click(); } } });
  $('#stage').addEventListener('input', e => { const f = e.target.dataset.f; if (f) { S.d[f] = e.target.type == 'checkbox' ? e.target.checked : e.target.value; save(); } });
  $('#stage').addEventListener('click', e => {
    const t = e.target.closest('button');
    if (!t) return;
    const top0 = t.getBoundingClientRect().top, k0 = t.dataset.f, v0 = t.dataset.v, s0 = t.dataset.svc;
    // Keep the clicked chip under the pointer after the step re-renders.
    const fix = () => {
      const nb = $$('#stage .chip').find(b => s0 ? b.dataset.svc == s0 : (b.dataset.f == k0 && b.dataset.v == v0));
      if (nb) { scrollTo({ top: scrollY + nb.getBoundingClientRect().top - top0, behavior: 'instant' }); return nb; }
    };
    if (t.dataset.svc) { const k = t.dataset.svc, i = S.svc.indexOf(k); i < 0 ? S.svc.push(k) : S.svc.splice(i, 1); render(); const nb = fix(); if (nb) requestAnimationFrame(() => align(nb)); return; }
    if (t.dataset.f) {
      const k = t.dataset.f, v = t.dataset.v;
      if (t.dataset.m) { const a = [].concat(S.d[k] || []); const i = a.indexOf(v); i < 0 ? a.push(v) : a.splice(i, 1); S.d[k] = a; }
      else S.d[k] = S.d[k] == v ? '' : v;
      render(); const nb = fix(); if (nb) requestAnimationFrame(() => align(nb)); return;
    }
    if (t.dataset.n) { if (+t.dataset.n > 0) { const m = need(); if (m) { $('#er').textContent = tr(m); return; } } S.step += +t.dataset.n; render(); return toStage(); }
    if (t.id == 'send') return send(t);
    if (t.id == 'again') { Object.assign(S, { step: 0, svc: [], d: {}, sent: false, cid: newId(), reqId: '', code: '', email: '' }); render(); toStage(); }
  });
  $('#stage').addEventListener('focusin', e => { const t = e.target; if (t.matches('input:not([type=checkbox]):not([type=file]),textarea,select')) setTimeout(() => align(t), 60); });

  Site.onLang(render);
  render();
})();
