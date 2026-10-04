// Public site: loads "Selected work" from Supabase and renders the cards.
// - Not configured (supabase-config.js still has the YOUR_... placeholders) → the static
//   placeholder cards in index.html stay as they are.
// - Configured → cards come from the `projects` table (published rows only).
// Only a plain fetch against the REST API is used here, so the public page does not have to
// load the Supabase client library.
(function () {
  const grid = document.querySelector('.proj-grid');
  if (!grid) return;

  const URL_ = window.SUPABASE_URL || '';
  const KEY = window.SUPABASE_ANON_KEY || '';
  const configured = /^https:\/\//.test(URL_) && KEY && !/^YOUR_/.test(KEY);
  if (!configured || !window.RayCards) return;

  let rows = null;        // null = still loading, [] = nothing to show
  const lang = () => (window.__i18n && window.__i18n.currentLang()) || 'en';
  const t = (key, fallback) => {
    const d = window.__i18n && window.__i18n.DICT[lang()];
    return (d && d[key]) || fallback;
  };

  // Card markup lives in cards.js (shared with the admin preview)
  const build = (row) => window.RayCards.buildCard(row, { lang: lang() });

  function render() {
    if (rows === null) return;
    grid.classList.add('is-ready');
    if (!rows.length) {
      const p = document.createElement('p');
      p.className = 'proj-empty';
      p.textContent = t('projects.empty', 'New work is on its way.');
      grid.replaceChildren(p);
      return;
    }
    grid.replaceChildren(...rows.map(build));
  }

  // called by i18n.applyLang after a language switch
  window.renderProjects = render;

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  fetch(URL_ + '/rest/v1/projects?select=*&published=eq.true&order=sort_order.asc,created_at.desc', {
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY },
    signal: ctl.signal
  })
    .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then((data) => { rows = Array.isArray(data) ? data : []; })
    .catch((err) => { console.warn('[projects] could not load:', err); rows = []; })
    .finally(() => { clearTimeout(timer); render(); });
})();
