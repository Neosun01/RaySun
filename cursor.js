/* ============================================================
   cursor.js — Comet cursor (desktop) + Ripple dot-field background
   桌面：箭头彗星光标（跟随鼠标，绿色拖尾）
   触屏：不显示光标，手指拖动时涟漪点阵跟随
   降级：prefers-reduced-motion / 粗指针设备自动禁用
   调参：改下面 CONFIG 即可，无需动其它代码
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- 参数（调这里） ---------------- */
  var CONFIG = {
    comet: {                       // 彗星光标（仅精确指针设备）
      head: 'dot',                 // 头部样式: dot(圆形)|ring(空心环)|arrow|cross|diamond|frame|target|dash
      size: 15,                    // 头部大小 px
      count: 22,                   // 尾巴数量
      gap: 2,                      // 尾巴长度（历史采样间隔）
      fade: 5,                     // 尾巴渐隐（1 极快 … 10 极慢，5 柔和）
      ease: 0.28,                  // 跟随松紧（小=黏手，大=飘）
      color: '#63d01b'             // 颜色（用户自定义 RGB 99,208,27）
    },
    ripple: {                      // 涟漪点阵背景（鼠标/手指均触发）
      gap: 24,                     // 点间距 px
      rad: 180,                    // 影响半径 px
      wave: 26,                    // 波纹宽度
      spd: 300,                    // 波动速度（小=快）
      amp: 3.2,                    // 波峰放大倍数
      base: 1.4,                   // 基础点大小 px
      tint: 0.6,                   // 波峰绿色浓度 0..1
      dim: 0.22                    // 静态点透明度 0..1
    }
  };

  /* ---------------- 环境检测 ---------------- */
  var fine = matchMedia('(hover: hover) and (pointer: fine)');
  var reduced = matchMedia('(prefers-reduced-motion: reduce)');
  if (reduced.matches) return;                      // 尊重系统"减少动态效果"
  fine.addEventListener && fine.addEventListener('change', function () {
    location.reload();                              // 指针类型切换（如插拔数位板）后刷新生效
  });

  var P = CONFIG.comet, R = CONFIG.ripple;

  /* ---------------- 涟漪点阵 canvas ---------------- */
  // 背景层方案：canvas 挂到 html 层（body 之外），天然位于所有 body 内容之下。
  // 不改 body/html 背景（避免 sticky 导航与 hero 的层叠冲突）。
  var canvas = document.createElement('canvas');
  canvas.id = 'ripple-field';
  canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:-1';
  document.documentElement.appendChild(canvas);

  var cv = canvas.getContext('2d');
  var pts = [], DPR = 1, W = 0, H = 0, lastW = 0, lastH = 0, lastDPR = 0;
  function buildPts() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    // 缩放时宽高比可能变化，需要按当前尺寸重建点位，否则点位会错位
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    cv.setTransform(DPR, 0, 0, DPR, 0, 0);
    pts = [];
    for (var y = R.gap / 2; y < H; y += R.gap)
      for (var x = R.gap / 2; x < W; x += R.gap) pts.push({ x: x, y: y });
    lastW = W; lastH = H; lastDPR = DPR;
  }
  buildPts();
  window.addEventListener('resize', buildPts);

  function drawRipple(lx, ly, has, now) {
    // 每帧对齐视口：缩放过程中 resize 事件可能漏触发，这里保证 canvas 与点位始终匹配当前窗口
    if (window.innerWidth !== lastW || window.innerHeight !== lastH) buildPts();
    cv.clearRect(0, 0, W, H);
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      var d = has ? Math.sqrt((p.x - lx) * (p.x - lx) + (p.y - ly) * (p.y - ly)) : 9999;
      var w = (has && d < R.rad) ? Math.sin(now / R.spd - d / R.wave) * (1 - d / R.rad) : 0;
      var wp = Math.max(0, w);
      var s = R.base + wp * R.amp;
      var a = wp > 0.06 ? R.dim + wp * (0.75 - R.dim) : R.dim;
      cv.beginPath();
      cv.arc(p.x, p.y, Math.max(0.4, s), 0, 6.2832);
      cv.fillStyle = (wp * R.tint > 0.05) ? 'rgba(150,200,20,' + a.toFixed(3) + ')'
                                          : 'rgba(16,16,16,' + a.toFixed(3) + ')';
      cv.fill();
    }
  }

  /* ---------------- 彗星光标（仅精确指针） ---------------- */
  var HEADS = {
    dot: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5.5" fill="currentColor"/></svg>',
    ring: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    arrow: '<svg viewBox="0 0 24 24"><path d="M3 3 L3 20 L8 15 L11 21 L14 19.5 L11 14 L18 14 Z" fill="currentColor" stroke="#fff" stroke-width=".7" stroke-linejoin="round"/></svg>',
    cross: '<svg viewBox="0 0 24 24"><path d="M12 3 V21 M3 12 H21" stroke="currentColor" stroke-width="1.8"/></svg>',
    diamond: '<svg viewBox="0 0 24 24"><rect x="6.5" y="6.5" width="11" height="11" transform="rotate(45 12 12)" fill="currentColor"/></svg>',
    frame: '<svg viewBox="0 0 24 24"><path d="M7 3 H3 V7 M17 3 H21 V7 M21 17 V21 H17 M3 17 V21 H7" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    target: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="12" cy="12" r="2.6" fill="currentColor"/></svg>',
    dash: '<svg viewBox="0 0 24 24"><path d="M8 12 H16" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>'
  };

  function hex2rgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c }).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  var head = null, pool = [], rgb = hex2rgb(P.color);
  function mkEl(css) {
    var e = document.createElement('div');
    e.style.cssText = 'position:fixed;left:0;top:0;pointer-events:none;will-change:transform;' + css;
    document.body.appendChild(e);
    return e;
  }

  if (fine.matches) {
    // 隐藏系统光标（由本类控制，reduced-motion 或脚本失败时不会生效）
    document.documentElement.classList.add('cursor-none');
    head = mkEl('z-index:2147483000;border-radius:0;display:flex;align-items:center;justify-content:center');
    head.innerHTML = HEADS[P.head] || HEADS.arrow;
    head.style.color = P.color;
    head.style.opacity = '0';
  }

  function obtainDot() {
    var e = mkEl('border-radius:50%;z-index:2147482999;opacity:0');
    pool.push(e);
    return e;
  }

  /* ---------------- 输入：鼠标 + 触摸 ---------------- */
  var tx = null, ty = null, lx = null, ly = null, inside = false;
  var hist = [], cx = null, cy = null;

  document.addEventListener('mousemove', function (e) {
    tx = e.clientX; ty = e.clientY; inside = true;
  }, { passive: true });
  document.addEventListener('mouseleave', function () { inside = false; tx = ty = null; });
  // 触屏：不阻止滚动（passive），涟漪跟随触点；彗星光标不启用
  document.addEventListener('touchstart', function (e) {
    var t = e.touches[0]; tx = t.clientX; ty = t.clientY; inside = true;
  }, { passive: true });
  document.addEventListener('touchmove', function (e) {
    var t = e.touches[0]; tx = t.clientX; ty = t.clientY; inside = true;
  }, { passive: true });
  document.addEventListener('touchend', function () {
    if (!e || !e.touches || !e.touches.length) { inside = false; tx = ty = null; }
  }, { passive: true });

  /* ---------------- 主循环 ---------------- */
  var used = 0;
  function frame(now) {
    var has = inside && tx !== null;
    if (has) { lx = (lx === null) ? tx : lx + (tx - lx) * 0.25; ly = (ly === null) ? ty : ly + (ty - ly) * 0.25; }
    drawRipple(lx, ly, has, now);

    if (fine.matches && head) {
      if (has) {
        head.style.opacity = '1';
        if (cx === null) { cx = tx; cy = ty; }
        cx += (tx - cx) * P.ease; cy += (ty - cy) * P.ease;
        hist.unshift({ x: cx, y: cy });
        if (hist.length > P.count * P.gap + 4) hist.pop();

        used = 0;
        for (var i = 1; i <= P.count; i++) {
          var q = hist[i * P.gap]; if (!q) break;
          var t = (i - 1) / Math.max(1, P.count - 1);
          var sz = P.size * (1 - t * 0.78);
          var a = Math.pow(1 - t, P.fade / 3);
          if (used >= pool.length) obtainDot();
          var e = pool[used++];
          e.style.opacity = '1';
          e.style.width = sz + 'px'; e.style.height = sz + 'px';
          e.style.margin = (-sz / 2) + 'px 0 0 ' + (-sz / 2) + 'px';
          e.style.background = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a.toFixed(3) + ')';
          e.style.transform = 'translate(' + q.x + 'px,' + q.y + 'px)';
        }
        for (; used < pool.length; used++) pool[used].style.opacity = '0';

        var hs = P.size * 2.6;
        head.style.width = hs + 'px'; head.style.height = hs + 'px';
        head.style.margin = (-hs / 2) + 'px 0 0 ' + (-hs / 2) + 'px';
        head.style.transform = 'translate(' + cx + 'px,' + cy + 'px)';
      } else {
        head.style.opacity = '0';
        for (var j = 0; j < pool.length; j++) pool[j].style.opacity = '0';
        cx = cy = null; hist = [];
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ---------------- 光标隐藏样式（最后注入，随脚本生效） ---------------- */
  var st = document.createElement('style');
  st.textContent = 'html.cursor-none, html.cursor-none * { cursor: none !important; }';
  document.head.appendChild(st);
})();
