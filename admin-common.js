// Shared by the two admin pages: admin.js (login + list) and admin-edit.js (new / edit a project).
// Sets up the Supabase client and a few helpers, exposed as window.AdminCommon.
// `AdminCommon.ok` is false when the site is not configured yet (the page then shows the setup notice).
(function () {
  const $ = (id) => document.getElementById(id);
  const show = (id, on) => { const e = $(id); if (e) e.hidden = !on; };
  const C = { $, show, ok: false };
  window.AdminCommon = C;

  const configured = /^https:\/\//.test(window.SUPABASE_URL || '') && !/^YOUR_/.test(window.SUPABASE_ANON_KEY || '');
  if (!configured || !window.supabase || !window.RayCards) { show('setup', true); return; }

  const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  const listPage = document.body.dataset.list || 'admin.html';
  const editPage = document.body.dataset.edit || 'admin-edit.html';
  const FLASH = 'raysun-admin-flash';

  Object.assign(C, {
    ok: true,
    sb,
    BUCKET: 'project-media',
    MAX_IMG: 10 * 1024 * 1024,
    MAX_IMAGES: window.RayCards.MAX_IMAGES,
    IMG_TYPES: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' },
    listUrl: listPage,
    editUrl: (id) => editPage + (id ? '?id=' + encodeURIComponent(id) : ''),
    go: (url) => { location.href = url; }
  });

  C.text = (el, s) => { el.textContent = s; return el; };
  C.setMsg = (id, s, ok) => { const el = $(id); if (!el) return; el.textContent = s || ''; el.classList.toggle('ok', !!ok); };

  let toastTimer = 0;
  C.toast = (msg) => {
    const el = $('toast');
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  };

  // One-shot message handed from the edit page to the list page ("已保存" …)
  C.flash = (msg) => { try { sessionStorage.setItem(FLASH, msg); } catch (_) { /* ignore */ } };
  C.takeFlash = () => {
    try { const m = sessionStorage.getItem(FLASH); sessionStorage.removeItem(FLASH); return m; } catch (_) { return null; }
  };

  // The card itself is built by cards.js, the same code the public site runs.
  C.card = (row, lang, opts) => window.RayCards.buildCard(row, Object.assign({ lang, allowLocal: true }, opts));

  // public URL → object path inside the bucket (null if it is not one of ours)
  C.storagePath = (url) => {
    if (!url) return null;
    const marker = '/storage/v1/object/public/' + C.BUCKET + '/';
    const i = url.indexOf(marker);
    return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length).split('?')[0]);
  };

  C.httpsOrEmpty = (s, label) => {
    s = (s || '').trim();
    if (!s) return null;
    let u; try { u = new URL(s); } catch (_) { throw new Error(label + '不是有效的网址'); }
    if (u.protocol !== 'https:') throw new Error(label + '必须以 https:// 开头');
    return u.href;
  };

  // links that depend on the page names
  document.querySelectorAll('[data-nav="list"]').forEach((a) => { a.href = listPage; });
  document.querySelectorAll('[data-nav="new"]').forEach((a) => { a.href = C.editUrl(); });

  const logout = $('logout');
  if (logout) logout.addEventListener('click', async () => { await sb.auth.signOut(); C.go(listPage); });
})();
