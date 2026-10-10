/* Client sign-in: email + access code → portal.html */
(async function () {
  if (await API.session('client')) { location.replace('portal.html'); return; }
  if (await API.mode() === 'local') $('#demo').hidden = false;
  const em = $('#em'), cd = $('#cd'), er = $('#er');
  em.value = qs('email') || '';
  cd.value = qs('code') || '';

  async function go(e) {
    if (e) e.preventDefault();
    er.textContent = '';
    if (!Workflow.isEmail(em.value.trim())) { er.textContent = tr('Enter a valid email, like name@business.co.nz.'); return; }
    const btn = $('#lf button');
    btn.disabled = true;
    try {
      await API.login('client', { email: em.value, code: cd.value });
      location.replace('portal.html');
    } catch (x) {
      er.textContent = x.message;
      btn.disabled = false;
    }
  }
  $('#lf').addEventListener('submit', go);
  // Arriving from the "Open My Studio" button: sign straight in.
  if (em.value && cd.value) go();
})();
