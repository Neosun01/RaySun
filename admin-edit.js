// Admin: create / edit one project on its own page.  admin-edit.html  = new,  admin-edit.html?id=…  = edit.
// Saving or deleting sends you back to the list (admin.html).
(function () {
  const C = window.AdminCommon;
  if (!C || !C.ok) return;
  const { $, show, sb, setMsg, text, BUCKET, MAX_IMG, MAX_IMAGES, IMG_TYPES } = C;

  const id = new URLSearchParams(location.search).get('id');
  const form = $('form');
  let editing = null;      // the record being edited, null = new
  let imgs = [];           // ordered images: { url } (already uploaded) or { file, url: blob: preview } (new)
  let pvLang = 'zh';
  let isPublished = false; // current state of the record (new projects start as drafts)
  let dirty = false;       // unsaved changes → ask before leaving
  let leaving = false;

  /* ---------- live preview (built by the same cards.js as the public site) ---------- */
  function values() {
    const f = form.elements;
    return {
      title_zh: f.title_zh.value.trim(), title_en: f.title_en.value.trim(),
      tag_zh: f.tag_zh.value.trim(), tag_en: f.tag_en.value.trim(),
      desc_zh: f.desc_zh.value.trim(), desc_en: f.desc_en.value.trim(),
      video_url: f.video_url.value.trim(), link_url: f.link_url.value.trim(),
      images: imgs.map((i) => i.url), published: isPublished
    };
  }
  const renderPreview = () => $('pv-card').replaceChildren(C.card(values(), pvLang, { placeholder: true }));

  form.addEventListener('input', () => { dirty = true; renderPreview(); });
  document.querySelectorAll('.ed-preview [data-pv]').forEach((b) => b.addEventListener('click', () => {
    pvLang = b.dataset.pv;
    document.querySelectorAll('.ed-preview [data-pv]').forEach((x) => {
      const on = x === b; x.classList.toggle('active', on); x.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    renderPreview();
  }));

  /* ---------- images ---------- */
  const revoke = (i) => { if (i.file) URL.revokeObjectURL(i.url); };

  function move(from, to) {
    if (from === to || to < 0 || to >= imgs.length) return;
    const [m] = imgs.splice(from, 1);
    imgs.splice(to, 0, m);
    dirty = true;
    renderImgs();
  }

  function renderImgs() {
    const ul = $('imgs');
    ul.replaceChildren();
    imgs.forEach((im, i) => {
      const li = document.createElement('li');
      li.className = 'im' + (im.file ? ' is-new' : '');
      li.draggable = true;
      li.style.backgroundImage = 'url("' + im.url.replace(/"/g, '%22') + '")';
      if (i === 0) { const c = document.createElement('span'); c.className = 'im-cover'; c.textContent = '封面'; li.append(c); }

      const x = document.createElement('button');
      x.type = 'button'; x.className = 'im-x'; x.textContent = '×'; x.setAttribute('aria-label', '移除第 ' + (i + 1) + ' 张');
      x.addEventListener('click', () => { revoke(im); imgs.splice(i, 1); dirty = true; renderImgs(); });

      const tools = document.createElement('div');
      tools.className = 'im-tools';
      const mk = (txt, aria, fn, disabled) => {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = txt; b.setAttribute('aria-label', aria); b.disabled = !!disabled;
        b.addEventListener('click', fn); return b;
      };
      tools.append(
        mk('←', '前移', () => move(i, i - 1), i === 0),
        mk('→', '后移', () => move(i, i + 1), i === imgs.length - 1),
        ...(i === 0 ? [] : [mk('★', '设为封面', () => move(i, 0))])
      );
      li.append(x, tools);

      // drag to reorder
      li.addEventListener('dragstart', (e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/x-im', String(i)); li.classList.add('is-dragging'); });
      li.addEventListener('dragend', () => { li.classList.remove('is-dragging'); ul.querySelectorAll('.is-target').forEach((n) => n.classList.remove('is-target')); });
      li.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('text/x-im')) { e.preventDefault(); li.classList.add('is-target'); } });
      li.addEventListener('dragleave', () => li.classList.remove('is-target'));
      li.addEventListener('drop', (e) => {
        if (!e.dataTransfer.types.includes('text/x-im')) return;
        e.preventDefault(); e.stopPropagation();
        move(parseInt(e.dataTransfer.getData('text/x-im'), 10), i);
      });
      ul.append(li);
    });
    renderPreview();
  }

  function addFiles(fileList) {
    const files = [...fileList];
    if (!files.length) return;
    const problems = [];
    let added = 0;
    for (const file of files) {
      if (imgs.length >= MAX_IMAGES) { problems.push('最多 ' + MAX_IMAGES + ' 张，多出来的没有添加'); break; }
      if (!IMG_TYPES[file.type]) { problems.push('「' + file.name + '」不是支持的图片格式'); continue; }
      if (file.size > MAX_IMG) { problems.push('「' + file.name + '」超过 10MB'); continue; }
      imgs.push({ file, url: URL.createObjectURL(file) });
      added++;
    }
    setMsg('form-msg', problems.join('；'));
    if (added) dirty = true;
    if (added || problems.length) renderImgs();
  }

  $('img-file').addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });
  const drop = $('drop');
  const isFiles = (e) => [...(e.dataTransfer.types || [])].includes('Files');
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { if (!isFiles(e)) return; e.preventDefault(); drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-over'); }));
  drop.addEventListener('drop', (e) => { if (isFiles(e)) addFiles(e.dataTransfer.files); });
  // a file dropped next to the drop zone must not make the browser navigate away to the image
  ['dragover', 'drop'].forEach((ev) => window.addEventListener(ev, (e) => { if (isFiles(e)) e.preventDefault(); }));

  /* ---------- load ---------- */
  async function start() {
    const { data } = await sb.auth.getSession();
    if (!data.session) return show('need-login', true);
    show('app', true);

    let row = null;
    if (id) {
      setMsg('load-msg', '加载中…', true);
      const { data: r, error } = await sb.from('projects').select('*').eq('id', id);
      if (error) return setMsg('load-msg', '加载失败：' + error.message);
      row = Array.isArray(r) ? r[0] : r;
      if (!row) return setMsg('load-msg', '没有找到这个作品，它可能已被删除。');
    }
    setMsg('load-msg', '');
    fill(row);
  }

  function fill(row) {
    editing = row;
    imgs = (row ? window.RayCards.imagesOf(row, true) : []).map((url) => ({ url }));
    let nextSort = 10;
    if (!row) {
      // new project goes to the end: last sort_order + 10 (best effort)
      sb.from('projects').select('sort_order').order('sort_order', { ascending: false }).then((res) => {
        const top = res && res.data && res.data[0] ? res.data[0].sort_order : 0;
        nextSort = top + 10;
        if (!dirty) form.elements.sort_order.value = String(nextSort);
      });
    }
    const v = row || { sort_order: nextSort, published: true };
    for (const name of ['title_zh', 'title_en', 'tag_zh', 'tag_en', 'desc_zh', 'desc_en', 'video_url', 'link_url', 'sort_order']) {
      form.elements[name].value = v[name] ?? '';
    }
    isPublished = !!(row && row.published);
    paintButtons();
    text($('page-title'), row ? (row.title_zh || row.title_en || '编辑作品') : '新建作品');
    text($('page-kicker'), row ? 'EDIT PROJECT' : 'NEW PROJECT');
    document.title = (row ? '编辑作品' : '新建作品') + ' · Ray';
    show('danger', !!row);
    show('ed-body', true); show('pg-foot', true);
    renderImgs();
    dirty = false;
  }

  /* ---------- the two save buttons ----------
     new / draft  →  [保存草稿] [发布到网站]
     published    →  [转为草稿] [保存修改]        (so the labels always say what will happen) */
  function paintButtons() {
    text($('btn-draft'), isPublished ? '转为草稿' : '保存草稿');
    text($('btn-publish'), isPublished ? '保存修改' : '发布到网站');
    $('status').textContent = editing ? (isPublished ? '当前状态：已发布' : '当前状态：草稿（网站上看不到）') : '新作品：还没有保存';
  }
  const busy = (on) => { $('btn-draft').disabled = on; $('btn-publish').disabled = on; };

  /* ---------- save ---------- */
  // Enter inside a text field must not save by accident: only the two buttons save
  form.addEventListener('submit', (e) => e.preventDefault());
  $('btn-draft').addEventListener('click', () => save(false));
  $('btn-publish').addEventListener('click', () => save(true));

  async function save(publish) {
    // left button always saves as draft, right button always saves as published
    const willPublish = publish;
    busy(true);
    const uploaded = [];       // files uploaded during THIS save (removed again if the save fails)
    try {
      const f = form.elements;
      const payload = {
        title_zh: f.title_zh.value.trim(), title_en: f.title_en.value.trim(),
        tag_zh: f.tag_zh.value.trim(), tag_en: f.tag_en.value.trim(),
        desc_zh: f.desc_zh.value.trim(), desc_en: f.desc_en.value.trim(),
        video_url: C.httpsOrEmpty(f.video_url.value, '视频链接'),
        link_url: C.httpsOrEmpty(f.link_url.value, '跳转地址'),
        sort_order: parseInt(f.sort_order.value, 10) || 0,
        published: willPublish
      };
      if (!payload.title_zh && !payload.title_en) throw new Error('标题至少填一种语言');

      // 1) upload new files, keeping their position in the list
      const urls = [];
      const fresh = imgs.filter((i) => i.file).length;
      let n = 0;
      for (const im of imgs) {
        if (!im.file) { urls.push(im.url); continue; }
        n++;
        setMsg('form-msg', '上传图片中… ' + n + ' / ' + fresh, true);
        const path = crypto.randomUUID() + '.' + IMG_TYPES[im.file.type];
        const up = await sb.storage.from(BUCKET).upload(path, im.file, { contentType: im.file.type, cacheControl: '31536000' });
        if (up.error) throw new Error('图片上传失败：' + up.error.message);
        uploaded.push(path);
        urls.push(sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
      }
      payload.images = urls;
      payload.cover_url = urls[0] || null;

      // 2) one database write
      setMsg('form-msg', '保存中…', true);
      const { error } = editing
        ? await sb.from('projects').update(payload).eq('id', editing.id)
        : await sb.from('projects').insert(payload);
      if (error) throw new Error(error.message);

      // 3) only after the row is safe: remove files that are no longer used (best effort)
      if (editing) {
        const keep = new Set(urls);
        const gone = window.RayCards.imagesOf(editing, true).filter((u) => !keep.has(u)).map(C.storagePath).filter(Boolean);
        if (gone.length) await sb.storage.from(BUCKET).remove(gone);
      }
      C.flash(!willPublish ? (editing && isPublished ? '已转为草稿' : '草稿已保存')
                           : (editing && isPublished ? '已保存修改' : '已发布到网站'));
      try { sessionStorage.setItem('raysun-admin-tab', willPublish ? 'published' : 'draft'); } catch (_) { /* ignore */ }
      leaving = true;
      C.go(C.listUrl);
    } catch (err) {
      if (uploaded.length) { try { await sb.storage.from(BUCKET).remove(uploaded); } catch (_) { /* best effort */ } }
      setMsg('form-msg', err.message || String(err));
      busy(false);
    }
  }

  /* ---------- delete ---------- */
  $('delete').addEventListener('click', async () => {
    if (!editing) return;
    if (!confirm('确定删除「' + (editing.title_zh || editing.title_en) + '」？此操作无法撤销。')) return;
    const { error } = await sb.from('projects').delete().eq('id', editing.id);
    if (error) return setMsg('form-msg', '删除失败：' + error.message);
    const gone = window.RayCards.imagesOf(editing, true).map(C.storagePath).filter(Boolean);
    if (gone.length) await sb.storage.from(BUCKET).remove(gone);
    C.flash('已删除');
    leaving = true;
    C.go(C.listUrl);
  });

  /* ---------- leaving with unsaved changes ---------- */
  window.addEventListener('beforeunload', (e) => {
    if (dirty && !leaving) { e.preventDefault(); e.returnValue = ''; }
  });
  window.addEventListener('pagehide', () => imgs.forEach(revoke));

  start();
})();
