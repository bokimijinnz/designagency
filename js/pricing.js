/*
 * Prices and timelines. Used by the estimate form and the home page hero,
 * so a price changed here changes everywhere.
 *
 *  SV:    services with their "from" price shown on the chips
 *  calc:  line items (amounts excl. GST) + items that need a hand-made quote
 *  weeks: rough timeline in weeks [low, high]
 */
const Pricing = {
  GST: 0.15,
  SV: [['logo', 'Logo', '$490'], ['brand', 'Brand identity', '$1,090'], ['web', 'Website', '$1,690'], ['brochure', 'Brochure (4 pages)', '$390'], ['social', 'Social set (4 assets)', '$240'], ['card', 'Business card', '$180'], ['app', 'App UI/UX', 'Quoted'], ['space', 'Space & signage', 'Quoted'], ['mkt', 'Ongoing marketing', 'Quoted']],

  weeks(svc, d) {
    d = d || {};
    const sv = k => svc.includes(k), D = k => d[k] || '';
    let lo = 0, hi = 0;
    const a = (l, h) => { lo += l; hi += h; };
    if (sv('brand')) a(3, 4); else if (sv('logo')) a(2, 3);
    if (sv('web')) { a(4, 6); const p = D('pages') || '5'; if (p != '9+' && +p > 5) a(.5 * (+p - 5), +p - 5); }
    if (sv('brochure')) a(1, 2);
    if (sv('social')) a(1, 1);
    if (sv('card') && !sv('brand')) a(1, 1);
    if (sv('brand') && sv('web')) { lo -= 1; hi -= 1; }
    return [Math.ceil(lo), Math.ceil(hi)];
  },
  calc(svc, d) {
    d = d || {};
    const sv = k => svc.includes(k), D = k => d[k] || '', has = (k, v) => [].concat(d[k] || []).includes(v);
    const L = [], M = [];
    if (sv('brand')) L.push(['BRAND-01 Brand Starter', 1090]); else if (sv('logo')) L.push(['LOGO-01 Logo Essential', 490]);
    if (sv('web')) {
      L.push(['WEB-05 Website, up to 5 pages', 1690]);
      const p = D('pages') || '5';
      if (p == '9+') M.push('Website with 9 or more pages');
      else { const x = +p - 5; if (x) L.push([`WEB-EXTRA ${x} extra page${x > 1 ? 's' : ''} × $180`, x * 180]); }
      if (['Online store', 'Membership', 'Custom functionality'].includes(D('w_type'))) M.push('Website type: ' + D('w_type').toLowerCase());
      if ([].concat(d.w_int || []).some(i => i != 'None')) M.push('Website integrations');
      if (D('w_content').startsWith('None')) M.push('Copywriting');
      if (['SEO', 'Accessibility review', 'Advanced animation', 'Analytics set-up', 'Multiple languages'].some(x => has('w_extra', x))) M.push('Website extras (SEO, accessibility, languages, analytics or animation)');
    }
    if (sv('brochure')) L.push(['BROCHURE-04 Four-page brochure', 390]);
    if (sv('social')) L.push(['SOCIAL-04 Four static assets', 240]);
    if (sv('card') && !sv('brand')) L.push(['CARD-01 Business card', 180]);
    if (sv('brand') && sv('web')) L.push(['LAUNCH-01 Launch bundle saving', -490]);
    if (D('b_guide') == 'Full brand guidelines') M.push('Full brand guidelines');
    if (sv('app')) M.push('App UI/UX');
    if (sv('space')) M.push('Space and signage');
    if (sv('mkt')) M.push('Ongoing marketing plan');
    if (D('deadline') == 'Priority request') M.push('Priority deadline');
    const sub = L.reduce((a, b) => a + b[1], 0);
    return { L, M: [...new Set(M)], sub, gst: sub * .15, tot: sub * 1.15 };
  }
};
