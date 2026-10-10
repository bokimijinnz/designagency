/*
 * Journal (blog) and Work (projects): list pages, detail pages and the cards
 * reused on the home page. Content comes from API.content (admin-editable).
 */
const Content = {
  empty: msg => `<div class="empty"><span class="oc oc3"></span><p>${esc(msg)}</p></div>`,

  workCard: w => `<a class="wcard" href="project.html?slug=${encodeURIComponent(w.slug)}">
    ${workCover(w)}
    <div class="wmeta"><b data-no-tr>${esc(w.title)}</b><span>${esc(w.year || '')}</span></div>
    <p data-no-tr>${esc(w.summary || '')}</p>
    <div class="wtags"><span data-no-tr>${esc((w.services || []).join(' · '))}</span>${w.sample ? '<span class="pill">Sample</span>' : ''}</div>
  </a>`,

  postCard: p => `<a class="pcard" href="post.html?slug=${encodeURIComponent(p.slug)}">
    ${postCover(p)}
    <div class="pmeta"><span>${esc(fmtDate(Date.parse(p.date)))}</span><span data-no-tr>${esc((p.tags || []).join(' · '))}</span></div>
    <h3 data-no-tr>${esc(p.title)}</h3>
    <p data-no-tr>${esc(p.excerpt || '')}</p>
    <span class="more">Read ↗</span>
  </a>`
};

(function () {
  const page = document.body.dataset.page;
  const done = el => { apply(el); };

  async function workList() {
    const el = $('#works'), filters = $('#wfilters');
    const items = await API.content.list('works');
    const tags = [...new Set(items.flatMap(w => w.services || []))].sort();
    let cur = qs('s') || '';
    const draw = () => {
      filters.innerHTML = ['', ...tags].map(t => `<button class="chip" data-s="${esc(t)}" aria-pressed="${t === cur}">${t ? `<span data-no-tr>${esc(t)}</span>` : 'All'}</button>`).join('');
      const list = cur ? items.filter(w => (w.services || []).includes(cur)) : items;
      el.innerHTML = list.map(Content.workCard).join('') || Content.empty('No projects yet.');
      done(filters); done(el);
    };
    filters.addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (b) { cur = b.dataset.s; draw(); } });
    draw();
  }

  async function workDetail() {
    const el = $('#article');
    const w = await API.content.get('works', qs('slug'));
    if (!w) { el.innerHTML = Content.empty('This project could not be found.') + '<p style="text-align:center"><a href="work.html">← All work</a></p>'; return done(el); }
    document.title = w.title + ' | WHETŪ Studio';
    const all = await API.content.list('works');
    const i = all.findIndex(x => x.slug === w.slug), next = all[(i + 1) % all.length];
    el.innerHTML = `<div class="lab"><a href="work.html">← All work</a></div>
      <div class="art-h">
        <h2 data-no-tr>${esc(w.title)}</h2>
        <dl class="facts">
          <div><dt>Client</dt><dd data-no-tr>${esc(w.client || w.title)}</dd></div>
          <div><dt>Year</dt><dd data-no-tr>${esc(w.year || '')}</dd></div>
          <div><dt>Services</dt><dd data-no-tr>${esc((w.services || []).join(', '))}</dd></div>
        </dl>
      </div>
      ${w.sample ? '<p class="note"><span class="pill">Sample</span> Example case study. Replace it with your own work in the studio admin.</p>' : ''}
      <p class="lead" data-no-tr>${esc(w.summary || '')}</p>
      <div class="art-cover">${workCover(w, true)}</div>
      <div class="prose" data-no-tr>${md(w.body)}</div>
      <div class="art-next">
        <a class="btn" href="estimate.html">Start a project like this ↗</a>
        ${next && next.slug !== w.slug ? `<a class="link" href="project.html?slug=${encodeURIComponent(next.slug)}">Next project: <span data-no-tr>${esc(next.title)}</span> →</a>` : ''}
      </div>`;
    done(el);
  }

  async function postList() {
    const el = $('#posts'), filters = $('#pfilters');
    const items = await API.content.list('posts');
    const tags = [...new Set(items.flatMap(p => p.tags || []))].sort();
    let cur = qs('tag') || '';
    const draw = () => {
      filters.innerHTML = ['', ...tags].map(t => `<button class="chip" data-t="${esc(t)}" aria-pressed="${t === cur}">${t ? `<span data-no-tr>${esc(t)}</span>` : 'All'}</button>`).join('');
      const list = cur ? items.filter(p => (p.tags || []).includes(cur)) : items;
      el.innerHTML = list.map(Content.postCard).join('') || Content.empty('No posts yet.');
      done(filters); done(el);
    };
    filters.addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) { cur = b.dataset.t; draw(); } });
    draw();
  }

  async function postDetail() {
    const el = $('#article');
    const p = await API.content.get('posts', qs('slug'));
    if (!p) { el.innerHTML = Content.empty('This post could not be found.') + '<p style="text-align:center"><a href="journal.html">← Journal</a></p>'; return done(el); }
    document.title = p.title + ' | WHETŪ Studio';
    const all = await API.content.list('posts');
    const more = all.filter(x => x.slug !== p.slug).slice(0, 2);
    el.innerHTML = `<div class="lab"><a href="journal.html">← Journal</a></div>
      <div class="post-h">
        <div class="pmeta"><span>${esc(fmtDate(Date.parse(p.date)))}</span><span data-no-tr>${esc((p.tags || []).join(' · '))}</span></div>
        <h2 data-no-tr>${esc(p.title)}</h2>
        <p class="lead" data-no-tr>${esc(p.excerpt || '')}</p>
      </div>
      <div class="prose narrow" data-no-tr>${md(p.body)}</div>
      <div class="post-cta"><span class="oc oc7"></span><div><b>Have a project in mind?</b><p>See your price and timeline in minutes.</p><a class="btn" href="estimate.html">Get my estimate ↗</a></div></div>
      ${more.length ? `<div class="sub-h" style="margin-top:80px"><span>More from the journal</span></div><div class="pgrid">${more.map(Content.postCard).join('')}</div>` : ''}`;
    done(el);
  }

  const run = { work: workList, project: workDetail, journal: postList, post: postDetail }[page];
  if (run) run().catch(e => { console.error(e); Site.toast(e.message); });
})();
