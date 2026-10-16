/* ==========================================================================
   Resto — v4
   Anuncio 2D sin WebGL: los equipos son mockups CSS y el screenshot se aplica
   como <img> (object-fit: cover) => pantallas NÍTIDAS a cualquier resolución.
   El "giro 3D" se simula con CSS 3D (perspective + rotate) controlado por arrastre.
   Export PNG 4K con html-to-image.
   ========================================================================== */
(function () {
  'use strict';

  var card    = document.getElementById('card');
  var stage   = document.getElementById('stage');
  var world   = document.getElementById('world');
  var loading = document.getElementById('loading');
  var errBox  = document.getElementById('err');

  var ORDER   = ['phone', 'tablet', 'laptop'];
  var MAX_4K  = 3840;

  var fmt  = 'feed';
  var view = 'all';
  var cardW = 800;

  /* ---------------------------------------------------------- composición */
  // fx/fy = posición como fracción del ancho de la tarjeta (0 = centro)
  // z = profundidad en px, ry = giro en grados, s = escala
  var LAYOUT = {
    feed: {
      hero:   { fx: 0.13, fy: 0.00, z: 0, ry: -7, s: 1.00 },
      behind: [ { fx: -0.19, fy: -0.17, z: -150, ry: 20, s: 0.44 },
                { fx: 0.28, fy: -0.13, z: -150, ry: -21, s: 0.42 } ]
    },
    portrait: {
      hero:   { fx: 0.15, fy: 0.07, z: 0, ry: -7, s: 1.02 },
      behind: [ { fx: -0.20, fy: -0.22, z: -160, ry: 20, s: 0.44 },
                { fx: 0.30, fy: -0.17, z: -160, ry: -21, s: 0.42 } ]
    },
    reel: {
      hero:   { fx: 0.01, fy: 0.19, z: 0, ry: -5, s: 0.90 },
      behind: [ { fx: -0.23, fy: 0.33, z: -160, ry: 18, s: 0.40 },
                { fx: 0.23, fy: 0.06, z: -160, ry: -18, s: 0.40 } ]
    }
  };

  /* ------------------------------------------------------- crear equipos */
  var els = {};
  ORDER.forEach(function (kind) {
    var d = document.createElement('div');
    d.className = 'device ' + kind;
    d.setAttribute('data-kind', kind);
    if (kind === 'laptop') {
      d.innerHTML =
        '<div class="lid"><div class="screen"><img alt="" /></div><span class="cam"></span></div>' +
        '<div class="base"></div>';
    } else {
      d.innerHTML =
        '<div class="frame"><div class="screen"><img alt="" /></div>' +
        (kind === 'phone' ? '<span class="notch"></span>' : '<span class="cam"></span>') +
        '</div>';
    }
    world.appendChild(d);
    els[kind] = {
      el: d,
      img: d.querySelector('.screen img'),
      cur:  { fx: 0, fy: 0, z: 0, ry: 0, s: 0.001 },
      goal: { fx: 0, fy: 0, z: 0, ry: 0, s: 0.001 }
    };
  });

  /* ------------------------------------------------------------- layout */
  function heroKey() { return view !== 'all' ? view : 'phone'; }

  function applyLayout(instant) {
    var L = LAYOUT[fmt] || LAYOUT.feed;
    var hk = heroKey();
    var others = ORDER.filter(function (k) { return k !== hk; });
    ORDER.forEach(function (kind) {
      var isHero = kind === hk;
      var slot = isHero ? L.hero : (L.behind[others.indexOf(kind)] || L.behind[L.behind.length - 1]);
      var s = slot.s;
      if (view !== 'all') s *= isHero ? 1.14 : 0.82;
      var goal = { fx: slot.fx, fy: slot.fy, z: slot.z, ry: slot.ry, s: s };
      els[kind].goal = goal;
      els[kind].el.style.zIndex = isHero ? 3 : 2;
      if (instant) els[kind].cur = { fx: goal.fx, fy: goal.fy, z: goal.z, ry: goal.ry, s: goal.s };
    });
  }

  /* ------------------------------------------------------------- medidas */
  function measure() { cardW = card.clientWidth || 800; }
  if (window.ResizeObserver) new ResizeObserver(measure).observe(card);
  window.addEventListener('resize', measure);

  /* ------------------------------------------- arrastre = giro simulado */
  var drag = { active: false, x: 0, y: 0, ry: 0, rx: 0, tRy: 0, tRx: 0, moved: 0 };
  stage.addEventListener('pointerdown', function (e) {
    drag.active = true; drag.x = e.clientX; drag.y = e.clientY; drag.moved = 0;
    stage.setPointerCapture && stage.setPointerCapture(e.pointerId);
  });
  window.addEventListener('pointerup', function (e) {
    if (drag.active && drag.moved < 8) {
      var t = document.elementFromPoint(e.clientX, e.clientY);
      var dev = t && t.closest ? t.closest('.device') : null;
      if (dev) setView(dev.getAttribute('data-kind'));
    }
    drag.active = false;
  });
  window.addEventListener('pointermove', function (e) {
    if (!drag.active) return;
    drag.moved += Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y);
    drag.tRy += (e.clientX - drag.x) * 0.38;
    drag.tRx += (e.clientY - drag.y) * -0.16;
    drag.tRy = Math.max(-34, Math.min(34, drag.tRy));
    drag.tRx = Math.max(-20, Math.min(20, drag.tRx));
    drag.x = e.clientX; drag.y = e.clientY;
  });

  // parallax suave con el mouse
  var mouse = { x: 0, y: 0 };
  card.addEventListener('pointermove', function (e) {
    var r = card.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
    mouse.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
  });
  card.addEventListener('pointerleave', function () { mouse.x = 0; mouse.y = 0; });

  /* ----------------------------------------------------------- animación */
  var t0 = performance.now();
  function tick(now) {
    requestAnimationFrame(tick);
    var t = (now - t0) / 1000;
    var a = 0.12;

    drag.ry += (drag.tRy - drag.ry) * 0.08;
    drag.rx += (drag.tRx - drag.rx) * 0.08;
    var ryWorld = drag.ry + mouse.x * 4;
    var rxWorld = drag.rx - mouse.y * 3;
    world.style.transform = 'translateZ(0) rotateX(' + rxWorld.toFixed(2) + 'deg) rotateY(' + ryWorld.toFixed(2) + 'deg)';

    ORDER.forEach(function (kind, i) {
      var d = els[kind], g = d.goal, c = d.cur;
      c.fx += (g.fx - c.fx) * a;
      c.fy += (g.fy - c.fy) * a;
      c.z  += (g.z  - c.z)  * a;
      c.ry += (g.ry - c.ry) * a;
      c.s  += (g.s  - c.s)  * a;
      var floatY = Math.sin(t * 1.1 + i * 1.7) * 0.006;
      var tx = c.fx * cardW;
      var ty = (c.fy + floatY) * cardW;
      d.el.style.transform =
        'translate(-50%,-50%) translate3d(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px,' + c.z.toFixed(1) + 'px) ' +
        'rotateY(' + c.ry.toFixed(2) + 'deg) scale(' + c.s.toFixed(4) + ')';
    });
  }
  requestAnimationFrame(tick);

  /* -------------------------------------------------------------- imágenes */
  var AUTO = {
    phone:  ['screns/mobile_1.png', 'screns/mobile_2.png', 'mobile_1.png', 'mobile_2.png', 'app-screenshot.png'],
    tablet: ['screns/tablet.jpeg', 'tablet.jpeg', 'app-screenshot.png'],
    laptop: ['screns/pc_screen.png', 'pc_screen.png', 'app-screenshot.png']
  };
  function tryLoad(kind, list, i) {
    i = i || 0;
    if (!list || i >= list.length) return;
    var img = els[kind].img;
    img.onerror = function () { tryLoad(kind, list, i + 1); };
    img.onload = function () { if (loading) loading.style.display = 'none'; };
    img.src = list[i];
  }
  ORDER.forEach(function (k) { tryLoad(k, AUTO[k]); });

  [['up-phone', 'phone'], ['up-tablet', 'tablet'], ['up-laptop', 'laptop']].forEach(function (pair) {
    var input = document.getElementById(pair[0]);
    if (!input) return;
    input.addEventListener('change', function () {
      var f = input.files && input.files[0];
      if (!f) return;
      els[pair[1]].img.onerror = null;
      els[pair[1]].img.src = URL.createObjectURL(f);
    });
  });

  /* ------------------------------------------------------------- controles */
  function setActive(sel, btn) {
    Array.prototype.forEach.call(document.querySelectorAll(sel), function (b) { b.classList.remove('active'); });
    if (btn) btn.classList.add('active');
  }
  function setFmt(f, btn) {
    fmt = f;
    card.className = 'card fmt-' + f + (card.classList.contains('show-safe') ? ' show-safe' : '');
    setActive('[data-fmt]', btn || document.querySelector('[data-fmt="' + f + '"]'));
    applyLayout(false);
  }
  function setView(v, btn) {
    view = v;
    setActive('[data-view]', btn || document.querySelector('[data-view="' + v + '"]'));
    applyLayout(false);
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-fmt]'), function (b) {
    b.addEventListener('click', function () { setFmt(b.getAttribute('data-fmt'), b); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-view]'), function (b) {
    b.addEventListener('click', function () { setView(b.getAttribute('data-view'), b); });
  });
  var safe = document.getElementById('safe');
  if (safe) safe.addEventListener('change', function () { card.classList.toggle('show-safe', safe.checked); });

  /* ---------------------------------------------------------------- export */
  function fail(msg) {
    if (errBox) { errBox.style.display = 'block'; errBox.textContent = msg; }
    if (loading) loading.style.display = 'none';
  }

  function exportPNG() {
    if (typeof htmlToImage === 'undefined') { fail('Falta libs/html-to-image.js (recarga con Ctrl+F5).'); return; }
    var w = card.clientWidth, h = card.clientHeight;
    var ratio = MAX_4K / Math.max(w, h);
    if (loading) { loading.style.display = 'block'; loading.textContent = 'Generando PNG…'; }
    htmlToImage.toPng(card, { pixelRatio: ratio, cacheBust: true })
      .then(function (url) {
        var a = document.createElement('a');
        a.download = 'resto-v4-' + fmt + '.png';
        a.href = url;
        a.click();
      })
      .catch(function (e) { fail('No se pudo exportar: ' + (e && e.message ? e.message : e)); })
      .then(function () { if (loading) loading.style.display = 'none'; });
  }
  var snap = document.getElementById('snap');
  if (snap) snap.addEventListener('click', exportPNG);

  /* ------------------------------------------------------------------ init */
  measure();
  card.className = 'card fmt-' + fmt;
  applyLayout(true);
})();
