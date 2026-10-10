/* Home page: mascot that follows the pointer, plus Work and Journal teasers. */
(function () {
  const hero = $('.hero');
  if (hero && !matchMedia('(prefers-reduced-motion:reduce)').matches) {
    const g = $('#ghost'), sd = $('#shadow'), ry = $('.rays');
    let tx = 0, ty = 0, run = 0;
    const a = [0, 0], b = [0, 0], c = [0, 0];
    const set = (el, x, y, p) => { el.style.setProperty('--' + p + 'x', x.toFixed(1) + 'px'); el.style.setProperty('--' + p + 'y', y.toFixed(1) + 'px'); };
    const tick = () => {
      a[0] += (tx - a[0]) * .09; a[1] += (ty - a[1]) * .09;
      b[0] += (tx - b[0]) * .06; b[1] += (ty - b[1]) * .06;
      c[0] += (tx - c[0]) * .05; c[1] += (ty - c[1]) * .05;
      set(g, a[0], a[1], 'p'); set(sd, b[0], b[1], 's'); set(ry, c[0], c[1], 'r');
      if (Math.abs(tx - c[0]) + Math.abs(ty - c[1]) > .5) requestAnimationFrame(tick); else run = 0;
    };
    const go = () => { if (!run) { run = 1; requestAnimationFrame(tick); } };
    hero.addEventListener('pointermove', e => { const r = hero.getBoundingClientRect(); tx = e.clientX - r.left - r.width / 2; ty = e.clientY - r.top - r.height / 2; go(); });
    hero.addEventListener('pointerleave', () => { tx = 0; ty = 0; go(); });
  }

  async function teasers() {
    const works = await API.content.list('works');
    const feat = works.filter(w => w.featured);
    $('#featured').innerHTML = (feat.length ? feat : works).slice(0, 3).map(Content.workCard).join('') || Content.empty('Work will appear here soon.');
    const posts = await API.content.list('posts');
    $('#latest').innerHTML = posts.slice(0, 3).map(Content.postCard).join('') || Content.empty('No posts yet.');
    apply($('#featured')); apply($('#latest'));
  }
  teasers();
})();

// Price list "issued" date: today, in the reader's language.
(function () {
  const d = $('#inv-date');
  const draw = () => { if (d) d.textContent = new Date().toLocaleDateString(LOC(), { day: 'numeric', month: 'short', year: 'numeric' }); };
  draw();
  Site.onLang(draw);
})();

// Hero: tap services, see a live mini invoice, then carry the choice into the estimate form.
(function () {
  const box = $('#hq');
  if (!box) return;
  const offered = ['logo', 'brand', 'web', 'brochure', 'social', 'card'];
  let svc = ['brand', 'web'];
  const split = l => { const m = l.match(/^([A-Z]+(?:-[A-Z0-9]+)+)\s+(.*)$/); return m ? [m[1], m[2]] : ['', l]; };
  function draw() {
    $('#hq-chips').innerHTML = Pricing.SV.filter(s => offered.includes(s[0])).map(s => `<button type="button" class="chip" data-s="${s[0]}" aria-pressed="${svc.includes(s[0])}">${s[1]}<small>${s[2]}</small></button>`).join('');
    const r = Pricing.calc(svc), [lo, hi] = Pricing.weeks(svc);
    $('#hq-lines').innerHTML = r.L.length
      ? r.L.map(l => { const [c, t] = split(l[0]); return `<p><span><span class="c">${c}</span>${t}</span><span class="${l[1] < 0 ? 'neg' : ''}">${money(l[1])}</span></p>`; }).join('')
      : '<p class="empty">Tap a service to see your price</p>';
    $('#hq-sum').innerHTML = r.L.length
      ? `<p><span>Subtotal</span><span>${money(r.sub)}</span></p><p><span>GST (15%)</span><span>${money(r.gst)}</span></p><p class="tot"><span>Total</span><span>${money(r.tot)}</span></p><p class="wk"><span>Timeline</span><span>${lo == hi ? lo : lo + '–' + hi} weeks</span></p>`
      : '';
    apply(box);
  }
  box.addEventListener('click', e => {
    const b = e.target.closest('[data-s]');
    if (!b) return;
    const k = b.dataset.s, i = svc.indexOf(k);
    i < 0 ? svc.push(k) : svc.splice(i, 1);
    // Logo is part of Brand identity; picking one replaces the other.
    if (i < 0 && k === 'brand') svc = svc.filter(x => x !== 'logo');
    if (i < 0 && k === 'logo') svc = svc.filter(x => x !== 'brand');
    draw();
  });
  $('#hq-go').addEventListener('click', () => {
    // Hand the picked services to the estimate form (step 2: Services).
    try {
      const st = JSON.parse(localStorage.getItem('whetu.estimate') || 'null') || {};
      const fresh = !st.svc || st.sent;
      localStorage.setItem('whetu.estimate', JSON.stringify(Object.assign(fresh ? { d: {} } : st, { svc: svc.slice(), step: 0, sent: false })));
    } catch (e) { /* storage blocked: the form simply starts empty */ }
  });
  draw();
  Site.onLang(draw);
})();
