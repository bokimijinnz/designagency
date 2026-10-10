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
