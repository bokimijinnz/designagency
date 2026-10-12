/* Home page: the scroll story, the live invoice, and Work and Journal teasers. */
(function () {
  /* ---------- scroll story: typing → direction → live invoice ---------- */
  const story = $('#story');
  const LINE = {
    en: 'A small coffee roaster in Auckland. We want a warm, honest brand and a simple website.',
    ko: '오클랜드의 작은 커피 로스터리예요. 따뜻하고 정직한 브랜드와 간단한 웹사이트가 필요해요.',
    zh: '我们是奥克兰的一家小型咖啡烘焙店，想要一个温暖真诚的品牌和简单的网站。'
  };
  if (story) {
    const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
    const stick = $('.st-stick', story), type = $('#st-type'), sug = $$('#st-sug .chip');
    let last = -1;
    const tiles = async () => {
      const works = await API.content.list('works');
      $('#st-tiles').innerHTML = works.slice(0, 3).map(w => `<div class="st-tile">${workCover(w)}</div>`).join('');
    };
    tiles();
    function update() {
      // 0 → 1 across the story section while it is pinned.
      const r = story.getBoundingClientRect(), span = story.offsetHeight - innerHeight;
      const p = reduce ? 1 : Math.min(1, Math.max(0, -r.top / (span || 1)));
      const stage = p < .36 ? 0 : p < .68 ? 1 : 2;
      if (stage !== last) { stick.dataset.stage = stage; last = stage; }
      const t = Math.min(1, p / .3), line = LINE[LANG] || LINE.en;
      type.textContent = line.slice(0, Math.round(line.length * (stage > 0 ? 1 : t)));
      stick.classList.toggle('typing', stage === 0 && t < 1);
      sug.forEach(c => c.classList.toggle('in', (stage > 0 ? 1 : t) >= +c.dataset.at));
      stick.style.setProperty('--p', p.toFixed(3));
    }
    addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update);
    Site.onLang(update);
    update();
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
  // The total rolls to its new value so the price visibly updates live.
  let last = 0, raf = 0;
  function count(to) {
    const el = $('#hq-tot');
    if (!el) { last = 0; return; }
    const from = last, t0 = performance.now(), dur = matchMedia('(prefers-reduced-motion:reduce)').matches ? 0 : 450;
    cancelAnimationFrame(raf);
    el.parentElement.classList.remove('flash'); void el.offsetWidth; el.parentElement.classList.add('flash');
    const step = t => {
      const k = dur ? Math.min(1, (t - t0) / dur) : 1, e = 1 - Math.pow(1 - k, 3);
      el.textContent = money(Math.round((from + (to - from) * e) * 100) / 100);
      if (k < 1) raf = requestAnimationFrame(step); else last = to;
    };
    raf = requestAnimationFrame(step);
  }
  function draw() {
    $('#hq-chips').innerHTML = Pricing.SV.filter(s => offered.includes(s[0])).map(s => `<button type="button" class="chip" data-s="${s[0]}" aria-pressed="${svc.includes(s[0])}">${s[1]}<small>${s[2]}</small></button>`).join('');
    const r = Pricing.calc(svc), [lo, hi] = Pricing.weeks(svc);
    $('#hq-lines').innerHTML = r.L.length
      ? r.L.map(l => { const [c, t] = split(l[0]); return `<p><span><span class="c">${c}</span>${t}</span><span class="${l[1] < 0 ? 'neg' : ''}">${money(l[1])}</span></p>`; }).join('')
      : '<p class="empty">Tap a service to see your price</p>';
    $('#hq-sum').innerHTML = r.L.length
      ? `<p><span>GST (15%)</span><span>${money(r.gst)}</span></p><p><span>Timeline</span><span>${lo == hi ? lo : lo + '–' + hi} weeks</span></p><p class="tot"><span>Total</span><span id="hq-tot" data-no-tr>${money(last)}</span></p>`
      : '';
    apply(box);
    count(r.tot);
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
