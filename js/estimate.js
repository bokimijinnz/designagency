/*
 * Estimate wizard. Seven steps, a live price, then a real quote request that
 * lands in the studio admin and opens a private My Studio portal for the client.
 *
 * Prices live in SV (starting prices) and calc() (line items). Change them there.
 */
(function () {
  const PREVIEW = true; /* false = require answers before Next */
  const KEY = 'whetu.estimate';
  const newId = () => 'EST-2026-' + (1000 + Math.floor(Math.random() * 9000));
  const S = { step: 0, svc: [], d: {}, sent: false, cid: newId(), reqId: '', code: '', email: '' };
  try { const x = JSON.parse(localStorage.getItem(KEY) || 'null'); if (x) Object.assign(S, x); } catch (e) { /* ignore */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } };

  const D = k => S.d[k] || '', has = (k, v) => [].concat(S.d[k] || []).includes(v), sv = k => S.svc.includes(k);

  const STEPS = ['Your business', 'Services', 'Service details', 'Look and feel', 'Timing and budget', 'Your estimate', 'Send request'];
  const SV = Pricing.SV;
  const NZ = ['Auckland', 'Waikato', 'Bay of Plenty', 'Wellington', 'Canterbury', 'Otago', 'Another NZ region', 'Outside NZ'];
  const PAL = { 'Black and white': ['#000', '#fff', '#6b6b6b', '#d9d9d9'], 'Earthy': ['#8a5a3c', '#c19a6b', '#6b705c', '#e9dcc3', '#3d2b1f'], 'Bright': ['#ff3b30', '#ffcc00', '#34c759', '#0a84ff', '#af52de'], 'Soft and light': ['#f4e4e1', '#e3ecf4', '#eef2e3', '#f6efe0', '#e6e0f0'], 'Deep and rich': ['#0b2545', '#5a1a2b', '#14452f', '#2d1b4e', '#1a1a1a'], 'Open to suggestions': [], 'I have brand colours': [] };
  const FNT = { 'Clean sans-serif': ['Inter,sans-serif', 'Aa', 'Modern and clear'], 'Elegant serif': ['"Playfair Display",serif', 'Aa', 'Refined and classic'], 'Handmade': ['Caveat,cursive', 'Aa', 'Personal and crafted'], 'Bold and chunky': ['"Archivo Black",sans-serif', 'Aa', 'Loud and confident'], 'Open to suggestions': ['inherit', '?', 'Designer decides'] };
  const OK = [1, 4, 5, 2, 3, 7, 8, 1];

  /* ---------- pricing (prices live in js/pricing.js) ---------- */
  const wk = () => Pricing.weeks(S.svc, S.d);
  const calc = () => Pricing.calc(S.svc, S.d);
  function incl() {
    const a = [];
    if (sv('brand')) a.push('Origin brief, two initial logo directions with rationale, colour and type, mini guide, business card, three illustrative mockups, final logo files');
    else if (sv('logo')) a.push('Origin brief, two initial directions with rationale, three illustrative mockups, final logo exports');
    if (sv('web')) a.push('Goal and audience snapshot, simple sitemap, look-and-feel board, one chosen direction, desktop and mobile previews, basic platform build, editing notes');
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
  const VF = (k, l, opts, fn, h) => `<div class="fld"><div class="q">${l}${h ? `<small class="hint">${h}</small>` : ''}</div><div class="chips">${opts.map(o => `<button type="button" class="chip vis" data-f="${k}" data-v="${esc(o)}" data-m="1" aria-pressed="${has(k, o)}">${fn(o)}</button>`).join('')}</div></div>`;
  const colV = o => { const c = PAL[o]; return (c.length ? `<div class="sw">${c.map(x => `<i style="background:${x}"></i>`).join('')}</div>` : '<div class="sw q"></div>') + o; };
  const fntV = o => { const f = FNT[o]; return `<span class="tp" style="font-family:${f[0]}">${f[1]}</span><span class="tn"><b>${o}</b></span><small>${f[2]}</small>`; };
  const H = t => `<h4 class="sh">${t}</h4>`;

  const BLK = {
    brand: () => H('Logo and brand identity') + F('b_origin', 'What\'s the story behind your business?', 'a', 0, 'Why you started, and what inspired you. Not sure? Skip it.') + F('b_values', 'What do you stand for?', 'a', 0, 'Purpose, values, promises to customers') + F('b_aud', 'Who do you most want to reach?', 'a') + F('b_diff', 'What makes your offer different?', 'a') + F('b_cust', 'What do customers value or struggle with when choosing you?', 'a') + F('b_feel', 'What should people feel when they see your brand?', 'm', ['Trustworthy', 'Warm', 'Premium', 'Playful', 'Bold', 'Calm', 'Modern', 'Traditional', 'Local', 'Technical', 'Friendly', 'Expert']) + F('b_state', 'Where is your brand at now?', 'c', ['New, nothing yet', 'Have a logo, keep it', 'Refresh what I have', 'Full rebrand']) + F('b_type', 'Logo style you lean towards', 'm', ['Wordmark (name only)', 'Symbol', 'Symbol and name', 'Monogram', 'No preference']) + F('b_app', 'Where will it appear?', 'm', ['Signage', 'Uniforms', 'Website', 'Packaging', 'Social media', 'Vehicles', 'Documents', 'Not sure']) + F('b_guide', 'How much guidance do you need?', 'c', ['Logo files only', 'Mini brand guide', 'Full brand guidelines']),
    web: () => H('Website') + F('w_aud', 'Who visits, and what are they trying to find?', 'a') + F('w_act', 'Most important action visitors should take', 'c', ['Contact or enquire', 'Book', 'Buy', 'Sign up', 'Learn about us', 'Something else']) + F('w_url', 'Current website (if any)', 't') + F('w_prob', 'What\'s difficult about your current site?', 'a') + F('w_pages', 'Pages you need', 'm', ['Home', 'About', 'Services', 'Work or gallery', 'Contact', 'Blog', 'FAQ', 'Pricing', 'Shop', 'Other']) + F('pages', 'How many pages in total?', 'c', ['5', '6', '7', '8', '9+'], 'Pages 6 to 8 add $180 each. 9 or more is scoped by hand.') + F('w_type', 'What kind of site?', 'c', ['Information only', 'Appointment booking', 'Online store', 'Membership', 'Custom functionality']) + F('w_int', 'Integrations', 'm', ['Booking system', 'Payments', 'Email newsletter', 'CRM', 'Maps', 'Live chat', 'None']) + F('w_content', 'Do you have the writing ready?', 'c', ['All of it', 'Some of it', 'None, I need copywriting']) + F('w_photo', 'Photos and testimonials', 'c', ['I have photos', 'Need photography', 'Using stock', 'Not sure']) + F('w_plat', 'Platform', 'c', ['Squarespace', 'WordPress', 'Webflow', 'Wix', 'Shopify', 'Not sure']) + F('w_scope', 'Design only, or design and build?', 'c', ['Design only', 'Design and basic build']) + F('w_extra', 'Extras you\'d want', 'm', ['SEO', 'Accessibility review', 'Multiple languages', 'Analytics set-up', 'Advanced animation']),
    print: () => H('Print and brochure') + F('p_items', 'What do you need printed?', 'm', ['Brochure', 'Flyers', 'Menus', 'Packaging', 'Stickers or labels', 'Letterhead', 'Posters', 'Other']) + F('p_use', 'What is each piece for, and who gets it?', 'a') + F('p_size', 'Size, page count and finish, if known', 't') + F('p_cont', 'Content', 'c', ['I\'ll supply everything', 'Some supplied', 'I need help writing it']) + F('p_prod', 'Output', 'c', ['Print-ready files only', 'Help with printing']) + F('p_qty', 'Rough quantity', 't'),
    card: () => H('Business card') + F('c_det', 'Name, title and details for the card', 'a') + F('c_side', 'Sides', 'c', ['One side', 'Both sides']),
    social: () => H('Social media assets') + F('s_plat', 'Platforms', 'm', ['Instagram', 'Facebook', 'LinkedIn', 'TikTok', 'Other']) + F('s_goal', 'What should the posts do for you?', 'a') + F('s_topics', 'What will you post about?', 'a') + F('s_tpl', 'Format', 'c', ['Static post templates', 'Not sure yet']),
    app: () => H('App UI/UX (reviewed by hand)') + F('a_user', 'Who uses it?', 'a') + F('a_tasks', 'Top three tasks users must complete', 'a') + F('a_fail', 'Where do users get stuck today?', 'a') + F('a_plat', 'Platform', 'c', ['iOS', 'Android', 'Web app', 'More than one']) + F('a_scr', 'Rough number of screens', 'c', ['Under 10', '10 to 25', '25 to 50', '50+', 'Not sure']) + F('a_ex', 'Existing product?', 'c', ['New idea', 'Redesign of live product']) + F('a_res', 'Research and testing', 'c', ['None', 'Light research', 'Prototype testing']) + F('a_dev', 'Design only, or development too?', 'c', ['Design only', 'Development too']) + F('a_acc', 'Accessibility expectations', 't'),
    space: () => H('Space and signage') + F('x_type', 'What is it?', 'c', ['Shopfront sign', 'Interior graphics', 'Wayfinding', 'Vehicle', 'Event or pop-up']) + F('x_ref', 'Photos or plans available?', 'c', ['Yes', 'Not yet']) + F('x_size', 'Size, number of locations, materials', 't') + F('x_inst', 'Who handles production and install?', 'c', ['Me or my supplier', 'Need advice']),
    mkt: () => H('Ongoing marketing') + F('m_goal', 'Main objective', 'a') + F('m_ch', 'Channels', 'm', ['Instagram', 'Facebook', 'LinkedIn', 'Email', 'Website updates', 'Print', 'Other']) + F('m_out', 'Outputs per month', 'c', ['Under 8', '8 to 15', '15 to 30', 'Not sure']) + F('m_assets', 'Brand assets', 'c', ['Full set', 'Partial', 'None']) + F('m_pub', 'Design only, or managed publishing?', 'c', ['Design only', 'Managed publishing']) + F('m_rep', 'Reporting', 'c', ['Monthly summary', 'Not needed']) + F('m_ad', 'Ad spend (separate from our fees)', 't')
  };
  function blocks() {
    if (PREVIEW && !S.svc.length) return ['brand', 'web', 'print', 'card', 'social', 'app', 'space', 'mkt'];
    const k = [];
    if (sv('brand') || sv('logo')) k.push('brand');
    ['web', 'app', 'space', 'mkt', 'card', 'social'].forEach(x => sv(x) && k.push(x));
    if (sv('brochure')) k.push('print');
    return k;
  }

  const tl = () => { const [l, h] = wk(); return l || h ? `<div class="l"><span>ESTIMATED TIMELINE</span><span>${l == h ? l : l + '–' + h} weeks from design start</span></div>` : ''; };
  function sum() {
    const r = [['Business', D('biz') + (D('ind') ? ' · ' + D('ind') : '')], ['Region', D('region')], ['Services', S.svc.map(k => SV.find(a => a[0] == k)[1]).join(', ')], ['Timing', D('deadline') + (D('date') ? ' · ' + D('date') : '')], ['Budget', D('budget')]];
    return r.filter(x => x[1]).map(x => `<div class="l"><span>${x[0]}</span><span>${esc(x[1])}</span></div>`).join('');
  }
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

    if (c == 0) h = `<h3>Tell us about your business.</h3>${orb('Hi! I\'m Orbit, our AI studio assistant. Nothing to sign up for yet. Answer as much as you can. Skip anything you\'re unsure of.')}` + F('biz', 'Business name', 't') + F('ind', 'Industry', 'c', ['Beauty & Wellness', 'Hospitality', 'Trades', 'Professional Services', 'Retail', 'Technology', 'Health', 'Education', 'Creative', 'Other']) + F('what', 'What do you do, in a sentence or two?', 'a') + F('stage', 'Stage', 'c', ['New business', 'Existing business', 'Rebrand or redesign']) + F('years', 'How long have you been operating?', 'c', ['Not started yet', 'Under 1 year', '1 to 3 years', '3 to 10 years', '10+ years']) + F('team', 'Team size', 'c', ['Just me', '2 to 5', '6 to 20', '20+']) + F('region', 'Where are you based?', 's', NZ) + F('site', 'Website or social links (optional)', 't') + F('lang', 'Language you\'re most comfortable in', 's', ['English', '한국어', '中文', 'हिन्दी', 'Te Reo Māori', 'Samoan', 'Other'], 'Translated screens are a convenience. A person reviews final copy.') + nav('Next');
    if (c == 1) h = `<h3>What can we help you create?</h3>${orb('Choose everything that applies. I\'ll ask detailed questions about each one next.')}<div class="chips">${SV.map(a => `<button type="button" class="chip" data-svc="${a[0]}" aria-pressed="${sv(a[0])}">${a[1]}<small>from ${a[2]}</small></button>`).join('')}</div>${F('why', 'What\'s the main thing you want this project to achieve?', 'a')}${F('problem', 'What problem are you trying to solve with new design?', 'a')}${nav('Next')}`;
    if (c == 2) h = `<h3>The details.</h3>${orb('Here are questions for the services you chose. Only what\'s relevant.')}${blocks().map(k => BLK[k]()).join('')}${nav('Next')}`;
    if (c == 3) h = `<h3>Look and feel.</h3>${orb('Tell me what you like and what you don\'t. References help a lot.')}` + F('love', 'Brands, sites or designs you admire, and why', 'a', '', ' Links welcome') + F('avoid', 'Anything you want to avoid?', 'a') + VF('colour', 'Colour direction', Object.keys(PAL), colV, 'Pick as many as you like') + F('hex', 'Your brand colours, if you have them', 't', '', 'Hex codes or colour names') + VF('type', 'Typography feel', Object.keys(FNT), fntV, 'Pick as many as you like') + F('assets', 'What do you already have?', 'm', ['Logo files', 'Brand colours', 'Fonts', 'Photography', 'Written copy', 'Brand guidelines', 'Nothing yet']) + F('lic', 'Do you have licences or rights for anything you\'ll supply?', 'c', ['Yes', 'Not sure', 'Not applicable']) + nav('Next');
    if (c == 4) h = `<h3>Timing and budget.</h3>${orb('This helps your designer check capacity. A budget is optional and doesn\'t change the price.')}` + F('deadline', 'When do you need it?', 'c', ['Flexible', 'A planned month', 'Priority request'], 'Priority requests are reviewed by hand.') + F('date', 'Target date or month', 't') + F('why_date', 'What is driving that date?', 't') + F('budget', 'Budget range (optional)', 'c', ['Under $1,000', '$1,000 to $2,500', '$2,500 to $5,000', '$5,000+', 'Not sure']) + F('who', 'Who makes the final decision?', 'c', ['Just me', 'Me and a partner', 'A team']) + F('approve', 'How quickly can you review each round?', 'c', ['Within 2 days', 'Within a week', 'Slower']) + F('more', 'Anything else your designer should know?', 'a') + F('how', 'How did you hear about us? (optional)', 't') + nav('See my estimate');
    if (c == 5) {
      const r = calc(), i = incl();
      const [lo, hi] = wk();
      h = `<h3>Here's an initial estimate based on what you've told me.</h3>` + invoiceHtml({
        title: 'ESTIMATE', sub: 'Indicative · NZD',
        meta: [['Estimate no.', S.cid], ['Bill to', esc(D('biz')) || 'Your business'], ['Date', fmtDate(Date.now())], ['Timeline', lo || hi ? `${lo == hi ? lo : lo + '–' + hi} weeks` : '—']],
        lines: r.L,
        notes: r.M.length ? `<b>Additional scope review needed</b><ul>${r.M.map(m => `<li>${m}</li>`).join('')}</ul><p>These are quoted separately. No total is shown for them.</p>` : '<b>Notes</b><p>Two in-scope revision rounds on your chosen direction.</p>',
        sums: r.L.length ? [['Subtotal', money(r.sub)], ['GST (15%)', money(r.gst)], ['Indicative total', money(r.tot), 'tot']] : [],
        stamp: { text: 'DRAFT', small: 'A DESIGNER CHECKS IT NEXT', tone: 'grey' }
      }) + `<div class="cols"><div><b>What's included</b><ul>${i.map(x => `<li>${x}</li>`).join('') || '<li>Confirmed once scoped</li>'}</ul><p>Two in-scope revision rounds on your chosen direction.</p></div><div><b>Not included</b><ul><li>Domain, hosting and paid tools</li><li>Anything marked above</li></ul></div></div>
      <p class="note" style="margin-top:22px">A free initial estimate with an indicative timeline. Once our team approves it, we start designing. It isn't an agreed quote until then. A professional designer checks the details before any payment is requested. No automatic checkout.</p><div class="acts"><button class="link" data-n="-1">Edit my answers</button><button class="btn" data-n="1">Request my official quote ↗</button></div>`;
    }
    if (c == 6) h = `<h3>Send your quote request.</h3>${orb('Last step. Now I just need your details so your quote has somewhere to go.')}<div class="ticket">${sum()}</div>` + F('name', 'Your name', 't') + F('email', 'Email', 't') + F('role', 'Your role', 't') + F('refs', 'Reference links (optional)', 't')
      + `<div class="fld"><div class="q">Upload brand files or references (optional)</div><input type="file" id="files" multiple></div><label class="ck"><input type="checkbox" id="ack">I understand this is a quote request. No payment is required, and my project isn't booked yet.</label><label class="ck"><input type="checkbox" data-f="newsletter">Send me the studio newsletter (optional)</label><p class="note">We'll set up your My Studio space from this email. Your quote and questions appear there, not in your inbox.</p><div class="err" id="er" role="alert"></div><div class="acts"><button class="link" data-n="-1">Back to estimate</button><button class="btn" id="send">Send my quote request ↗</button></div>`;
    if (c == 7) {
      const login = `login.html?email=${encodeURIComponent(S.email)}&code=${encodeURIComponent(S.code)}`;
      h = `<h3>Thanks — your request is in.</h3><p style="max-width:56ch">Orbit has prepared your design brief. A professional designer will personally review the scope and pricing. Your written quote or any follow-up questions will appear in My Studio. <b>You haven't been charged, and you're not committed to a project.</b></p>
      <div class="code-box"><div><small>Your My Studio access code</small><b data-no-tr>${esc(S.code)}</b></div><a class="btn" href="${login}" style="background:#fff;color:#000">Open My Studio ↗</a></div>
      <p class="note">Sign in with <b data-no-tr>${esc(S.email)}</b> and this code. Keep it somewhere safe.</p>
      <div class="ticket"><div class="l"><span>Request ID</span><span data-no-tr>${esc(S.reqId)}</span></div><div class="l"><span>Sent from</span><span data-no-tr>${esc(S.email)}</span></div><div class="l"><span>Status</span><span>New request</span></div></div>
      <ul class="tl"><li class="d">Request sent</li><li>In review: the designer checks scope, effort and capacity</li><li>Questions, if any, appear in My Studio</li><li>Quote published: accept, ask or decline</li><li>After you accept: secure 50% deposit link, then project tools unlock</li></ul>
      <div class="acts"><a class="btn" href="${login}">Open My Studio ↗</a><button class="link" id="again">Start another estimate</button></div>`;
    }
    if (c < 7) h = `<div class="stp"><span>STEP ${c + 1} OF 7 · ${STEPS[c].toUpperCase()}</span><i style="width:${(c + 1) / 7 * 100}%"></i></div>` + h;
    if (c < 5) h = live() + h;
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
      Object.assign(S, { step: 7, sent: true, reqId: res.id, code: res.accessCode, email: res.email });
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
    if (c == 0 && (!D('biz') || !D('ind'))) return 'Add your business name and industry.';
    if (c == 1 && !S.svc.length) return 'Choose at least one service.';
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
