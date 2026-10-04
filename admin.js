// Admin: login + the list of projects. Creating / editing happens on admin-edit.html.
(function () {
  const C = window.AdminCommon;
  if (!C || !C.ok) return;
  const { $, show, sb, setMsg, toast } = C;

  /* ---------- session ---------- */
  async function route() {
    const { data } = await sb.auth.getSession();
    const on = !!data.session;
    show('login', !on); show('app', on);
    if (on) load();
  }
  sb.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') route(); });

  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    setMsg('login-msg', '登录中…');
    const { error } = await sb.auth.signInWithPassword({ email: f.get('email'), password: f.get('password') });
    if (error) return setMsg('login-msg', '登录失败：' + error.message);
    setMsg('login-msg', '');
    route();
  });

  /* ---------- list (two tabs: published / drafts) ---------- */
  const TAB_KEY = 'raysun-admin-tab';
  const tabs = [...document.querySelectorAll('.a-tab')];
  let all = [];
  let tab = 'published';

  // the edit page says which tab to open after saving (e.g. after "save draft" → drafts)
  function initialTab() {
    const fromUrl = new URLSearchParams(location.search).get('tab');
    let saved = null; try { saved = sessionStorage.getItem(TAB_KEY); } catch (_) { /* ignore */ }
    const t = fromUrl || saved;
    return t === 'draft' ? 'draft' : 'published';
  }

  function selectTab(name, focus) {
    tab = name === 'draft' ? 'draft' : 'published';
    try { sessionStorage.setItem(TAB_KEY, tab); } catch (_) { /* ignore */ }
    tabs.forEach((b) => {
      const on = b.dataset.tab === tab;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    });
    $('list').setAttribute('aria-labelledby', 'tab-' + tab);
    renderList();
  }
  tabs.forEach((b) => {
    b.addEventListener('click', () => selectTab(b.dataset.tab));
    b.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        selectTab(e.key === 'ArrowRight' || e.key === 'End' ? 'draft' : 'published', true);
      }
    });
  });

  async function load() {
    setMsg('list-msg', '加载中…', true);
    const { data, error } = await sb.from('projects').select('*')
      .order('sort_order', { ascending: true }).order('created_at', { ascending: false });
    if (error) return setMsg('list-msg', '加载失败：' + error.message);
    setMsg('list-msg', '');
    all = data || [];
    selectTab(initialTab());
    const flash = C.takeFlash();
    if (flash) toast(flash);
  }

  function renderList() {
    const pub = all.filter((r) => r.published);
    const draft = all.filter((r) => !r.published);
    $('count-published').textContent = String(pub.length);
    $('count-draft').textContent = String(draft.length);
    $('stats').textContent = all.length ? '共 ' + all.length + ' 个作品' : '还没有作品';

    const box = $('list');
    box.replaceChildren();
    const rows = tab === 'draft' ? draft : pub;

    for (const row of rows) {
      const foot = document.createElement('div');
      foot.className = 'a-foot';
      const ord = document.createElement('span'); ord.className = 'a-order'; ord.textContent = '排序 ' + row.sort_order;
      const edit = document.createElement('span'); edit.className = 'pill sm'; edit.textContent = '编辑';
      foot.append(ord, edit);

      // the whole card is one real link: keyboard, middle-click and "open in new tab" all work
      const a = document.createElement('a');
      a.className = 'card-link';
      a.href = C.editUrl(row.id);
      a.setAttribute('aria-label', '编辑：' + (row.title_zh || row.title_en || '无标题'));
      // the tab already says published / draft, so the chip on the card is dropped
      a.append(C.card(row, 'zh', { editable: true, status: false, compact: true, inert: true, footer: foot }));
      box.append(a);
    }

    if (!rows.length) {
      const p = document.createElement('div');
      p.className = 'a-empty';
      const msg = document.createElement('p');
      msg.textContent = tab === 'draft'
        ? '草稿箱是空的。新建作品时点「保存草稿」，没写完的内容会放在这里。'
        : (draft.length ? '还没有已发布的作品。去草稿箱看看，或者新建一个并发布。' : '还没有已发布的作品。点右上角「＋ 新建作品」开始。');
      p.append(msg);
      box.append(p);
    }

    const add = document.createElement('a');
    add.className = 'a-add';
    add.href = C.editUrl();
    add.innerHTML = '<span class="a-add-plus" aria-hidden="true">＋</span><span>新建作品</span>';
    box.append(add);
  }

  route();
})();
