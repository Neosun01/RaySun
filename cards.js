// One implementation of the "Selected work" card, shared by the public page (projects.js) and the
// admin (admin.js), so the preview in the admin is exactly what visitors get.
//
//   RayCards.buildCard(row, options) → <article class="card">
//     row      a `projects` record (title_zh/en, tag_*, desc_*, images[], cover_url, video_url, link_url)
//     options  lang         'zh' | 'en'   (falls back to the other language when a field is empty)
//              allowLocal   also accept blob:/data:image URLs (admin previews of not-yet-uploaded files)
//              compact      admin list: show only the first image + a count, no carousel
//              inert        nothing is clickable inside (admin list: the whole card is one button)
//              placeholder  show grey placeholder text for empty title/description (admin preview)
//              status       show the Published / Draft chip (admin list)
//              footer       extra element appended to .info (admin list)
//              editable     adds .is-editable
(function () {
  const MAX_IMAGES = 12;

  // The card's own small set of strings (the admin does not load i18n.js)
  const L = {
    en: { link: 'View project', video: 'Video', playVideo: 'Play video', prev: 'Previous image', next: 'Next image',
          goto: 'Go to image', images: 'Project images', close: 'Close video', photos: (n) => n + ' photos',
          titlePh: 'Project title', descPh: 'The description appears here.', noTitle: '(Untitled)', pub: 'Published', draft: 'Draft' },
    zh: { link: '查看项目', video: '视频', playVideo: '播放视频', prev: '上一张', next: '下一张',
          goto: '跳到第几张', images: '作品图片', close: '关闭视频', photos: (n) => n + ' 张',
          titlePh: '作品标题', descPh: '这里显示作品简介。', noTitle: '（无标题）', pub: '已发布', draft: '草稿' }
  };

  const reduceMotion = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  // Only https URLs (or, for admin previews, our own blob:/data: images) may reach src/href
  function safeUrl(u, allowLocal) {
    if (!u || typeof u !== 'string') return null;
    if (allowLocal && /^(blob:|data:image\/)/.test(u)) return u;
    try { const x = new URL(u); return x.protocol === 'https:' ? x.href : null; } catch (_) { return null; }
  }

  // Ordered image list of a record. Old records only have cover_url.
  function imagesOf(row, allowLocal) {
    const list = Array.isArray(row.images) && row.images.length ? row.images : (row.cover_url ? [row.cover_url] : []);
    return list.map((u) => safeUrl(u, allowLocal)).filter(Boolean).slice(0, MAX_IMAGES);
  }

  // Turn a pasted video link into something we can embed. Unknown hosts are not embedded.
  function videoSpec(raw) {
    const href = safeUrl(raw);
    if (!href) return null;
    const u = new URL(href);
    const host = u.hostname.replace(/^www\./, '');
    let m;
    if (host === 'youtu.be') {
      m = u.pathname.match(/^\/([\w-]{6,})/);
      if (m) return { kind: 'iframe', src: 'https://www.youtube-nocookie.com/embed/' + m[1] + '?autoplay=1&rel=0' };
    }
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = u.searchParams.get('v') || (u.pathname.match(/^\/(?:embed|shorts)\/([\w-]{6,})/) || [])[1];
      if (id) return { kind: 'iframe', src: 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0' };
    }
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      m = u.pathname.match(/(\d{5,})/);
      if (m) return { kind: 'iframe', src: 'https://player.vimeo.com/video/' + m[1] + '?autoplay=1' };
    }
    if (host === 'bilibili.com' || host === 'm.bilibili.com') {
      m = u.pathname.match(/\/video\/(BV[\w]+)/i);
      if (m) return { kind: 'iframe', src: 'https://player.bilibili.com/player.html?bvid=' + m[1] + '&autoplay=1&high_quality=1' };
    }
    if (/\.(mp4|webm|mov)$/i.test(u.pathname)) return { kind: 'video', src: href };
    return { kind: 'link', src: href };   // not embeddable: open in a new tab
  }

  const el = (tag, cls, txt) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  };

  function playVideo(media, spec, s) {
    const saved = [...media.childNodes];      // keep the images so "close" can bring them back
    media.replaceChildren();
    media.classList.add('is-playing');
    let player;
    if (spec.kind === 'video') {
      player = document.createElement('video');
      player.src = spec.src; player.controls = true; player.autoplay = true; player.playsInline = true;
    } else {
      player = document.createElement('iframe');
      player.src = spec.src;
      player.allow = 'autoplay; fullscreen; picture-in-picture';
      player.allowFullscreen = true;
      player.referrerPolicy = 'strict-origin-when-cross-origin';
      player.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation allow-popups');
      player.title = 'Project video';
    }
    const close = el('button', 'media-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', s.close);
    close.addEventListener('click', () => { media.classList.remove('is-playing'); media.replaceChildren(...saved); });
    media.append(player, close);
  }

  // Horizontal scroll-snap carousel: swipe on touch, arrows on hover devices, dots, counter, arrow keys.
  function carousel(urls, label, s) {
    const wrap = el('div', 'carousel');
    const track = el('div', 'slides');
    track.tabIndex = 0;
    track.setAttribute('role', 'group');
    track.setAttribute('aria-roledescription', 'carousel');
    track.setAttribute('aria-label', label || s.images);
    urls.forEach((u, i) => {
      const slide = el('div', 'slide');
      slide.setAttribute('role', 'group');
      slide.setAttribute('aria-roledescription', 'slide');
      slide.setAttribute('aria-label', (i + 1) + ' / ' + urls.length);
      const img = document.createElement('img');
      img.src = u; img.alt = ''; img.decoding = 'async';
      if (i > 0) img.loading = 'lazy';
      slide.append(img); track.append(slide);
    });
    wrap.append(track);

    const mk = (cls, txt, aria) => {
      const b = el('button', cls, txt);
      b.type = 'button'; b.setAttribute('aria-label', aria);
      b.addEventListener('click', (e) => e.stopPropagation());
      return b;
    };
    const prev = mk('car-btn car-prev', '‹', s.prev);
    const next = mk('car-btn car-next', '›', s.next);
    const count = el('span', 'car-count');
    count.setAttribute('aria-hidden', 'true');
    let dots = [];
    if (urls.length <= 8) {
      const box = el('div', 'dots');
      dots = urls.map((_, i) => {
        const d = mk('dot', '', s.goto + ' ' + (i + 1));
        d.addEventListener('click', () => go(i));
        box.append(d);
        return d;
      });
      wrap.append(box);
    }
    wrap.append(prev, next, count);

    let idx = 0, raf = 0;
    const go = (i) => {
      i = Math.max(0, Math.min(urls.length - 1, i));
      track.scrollTo({ left: i * track.clientWidth, behavior: reduceMotion() ? 'auto' : 'smooth' });
    };
    const paint = () => {
      count.textContent = (idx + 1) + ' / ' + urls.length;
      prev.disabled = idx === 0;
      next.disabled = idx === urls.length - 1;
      dots.forEach((d, i) => { if (i === idx) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
    };
    track.addEventListener('scroll', () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (!track.clientWidth) return;
        const i = Math.round(track.scrollLeft / track.clientWidth);
        if (i !== idx) { idx = i; paint(); }
      });
    }, { passive: true });
    prev.addEventListener('click', () => go(idx - 1));
    next.addEventListener('click', () => go(idx + 1));
    track.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(idx + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1); }
    });
    paint();
    return wrap;
  }

  function buildCard(row, o) {
    o = o || {};
    const lang = o.lang === 'zh' ? 'zh' : 'en';
    const other = lang === 'zh' ? 'en' : 'zh';
    const s = L[lang];
    const pick = (n) => row[n + '_' + lang] || row[n + '_' + other] || '';

    const card = el('article', 'card' + (o.editable ? ' is-editable' : ''));
    const media = el('div', 'media');
    const title = pick('title');
    const urls = imagesOf(row, o.allowLocal);

    if (o.status) media.append(el('span', 'a-chip ' + (row.published ? 'on' : 'off'), row.published ? s.pub : s.draft));

    if (urls.length === 1 || (urls.length > 1 && o.compact)) {
      const img = document.createElement('img');
      img.src = urls[0]; img.alt = title; img.decoding = 'async'; img.loading = 'lazy';
      media.append(img);
      if (urls.length > 1) media.append(el('span', 'car-count', s.photos(urls.length)));
    } else if (urls.length > 1) {
      media.append(carousel(urls, title, s));
    }

    const spec = row.video_url ? videoSpec(row.video_url) : null;
    if (spec) {
      const pill = urls.length > 1;                      // with a carousel the play control must not cover the swipe area
      const cls = pill ? 'play-pill' : 'play';
      if (o.inert) {
        const p = el('span', cls, pill ? s.video : '');
        p.setAttribute('aria-hidden', 'true');
        media.append(p);
      } else {
        const b = el('button', cls, pill ? s.video : '');
        b.type = 'button';
        b.setAttribute('aria-label', s.playVideo);
        if (spec.kind === 'link') b.addEventListener('click', () => window.open(spec.src, '_blank', 'noopener'));
        else b.addEventListener('click', () => playVideo(media, spec, s));
        media.append(b);
      }
    }
    card.append(media);

    const info = el('div', 'info');
    const tag = pick('tag'), desc = pick('desc');
    if (tag) info.append(el('p', 'tag', tag));
    const h = el('h3', title ? '' : (o.placeholder ? 'is-placeholder' : ''), title || (o.placeholder ? s.titlePh : s.noTitle));
    if (title || o.placeholder || o.status) info.append(h);
    if (desc) info.append(el('p', 'desc', desc));
    else if (o.placeholder) info.append(el('p', 'desc is-placeholder', s.descPh));
    const href = row.link_url && safeUrl(row.link_url);
    if (href) {
      if (o.inert) info.append(el('span', 'link', s.link));
      else {
        const a = el('a', 'link', s.link);
        a.href = href; a.target = '_blank'; a.rel = 'noopener';
        info.append(a);
      }
    }
    if (o.footer) info.append(o.footer);
    card.append(info);
    return card;
  }

  window.RayCards = { buildCard, safeUrl, imagesOf, videoSpec, MAX_IMAGES };
})();
