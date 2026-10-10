/*
 * Site settings. Change these first.
 */
window.STUDIO_CONFIG = {
  name: 'WHETŪ STUDIO',
  tagline: 'Working name. Aotearoa, New Zealand.',
  contactEmail: 'hello@example.com',

  // '' = the API lives on the same domain as the site (node server/server.js).
  // Set a full URL (https://api.yourstudio.co.nz) if you host the API elsewhere.
  apiBase: '',

  // 'auto' uses the server when it answers, otherwise the in-browser demo store.
  // Force 'local' to always use the demo store.
  mode: 'auto',

  // Demo mode only (no server). On the server, set the ADMIN_PASSWORD env var instead.
  demoAdminPassword: 'studio',

  // Demo mode only: sign in automatically (client and designer) so every screen
  // can be looked at without codes or passwords. Has no effect in server mode.
  demoAutoLogin: true,

  // How often open portals check for new messages in server mode.
  pollMs: 8000
};
