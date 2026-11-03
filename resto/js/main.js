/* Modelos procedurales (hechos con código, sin descargas) + Three.js LOCAL.
   Funciona con doble clic al HTML, sin internet y sin servidor. */
(function () {
  'use strict';

  var loading = document.getElementById('loading');
  var errBox = document.getElementById('err');
  function fail(msg) {
    if (loading) loading.style.display = 'none';
    if (errBox) {
      errBox.hidden = false;
      errBox.textContent = msg;
    } else {
      alert(msg);
    }
  }

  if (typeof THREE === 'undefined') {
    fail('No se encontró libs/three.min.js junto al HTML. Revisa que la carpeta libs exista.');
    return;
  }

  try {
    /* ---------- decoración 2D ---------- */
    var bokeh = document.getElementById('bokeh');
    for (var r = 0; r < 2; r++) {
      for (var c = 0; c < 7; c++) {
        var s = document.createElement('span');
        var size = 3.2 + Math.random() * 1.4;
        s.style.width = s.style.height = size + 'cqw';
        s.style.left = (c * 8 + r * 4) + 'cqw';
        s.style.top = (r * 7 + 3) + 'cqw';
        s.style.opacity = (0.5 + Math.random() * 0.5).toFixed(2);
        s.style.animationDelay = (Math.random() * 3).toFixed(2) + 's';
        bokeh.appendChild(s);
      }
    }
    /* ---------- renderer / escena ---------- */
    var canvas = document.getElementById('scene');
    var card = document.getElementById('card');
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    } catch (e) {
      fail('Tu navegador bloqueó WebGL. Activa la aceleración por hardware o prueba en Chrome/Edge.');
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    var maxAniso = renderer.capabilities.getMaxAnisotropy();
    // Igual que en v2: el canvas se renderiza SIEMPRE a resolución fija alta
    // (lado mayor) y el navegador lo escala por CSS. Así el screenshot de la
    // pantalla del modelo se ve nítido, sin depender del tamaño de la card.
    var RENDER_LONG = 1920;
    var exportLock = false;   // true mientras se exporta (fija el pixel ratio a mano)
    if (THREE.SRGBColorSpace && 'outputColorSpace' in renderer) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else if ('outputEncoding' in renderer && THREE.sRGBEncoding !== undefined) {
      renderer.outputEncoding = THREE.sRGBEncoding;
    }

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0, 11);

    scene.add(new THREE.AmbientLight(0x9fd4e8, 0.85));
    var key = new THREE.DirectionalLight(0xfff2df, 1.1);
    key.position.set(-4, 5, 6);
    scene.add(key);
    var rim = new THREE.PointLight(0xDC2626, 1.4, 25);
    rim.position.set(4, 2, 2);
    scene.add(rim);
    var fill = new THREE.PointLight(0xDC2626, 0.9, 25);
    fill.position.set(0, -3, 5);
    scene.add(fill);

    /* ---------- pantallas ---------- */
    var screenMats = [];   // materiales de las 3 pantallas para cambiarles la textura
    var lastShot = null;   // screenshot global: vale para los 3
    var kindShots = {};    // screenshot por aparato: { phone, tablet, laptop }
    // Icono real de la app para la maqueta de las pantallas (logo-app.png junto al HTML)
    var appLogo = new Image();
    var logoReady = false;
    appLogo.onload = function () { logoReady = true; refreshPromoScreens(); };
    appLogo.src = 'logo-app.png';
    function refreshPromoScreens() {
      if (lastShot) return; // tu screenshot manda
      screenMats.forEach(function (e) {
        e.mat.map = canvasTexture(makePromoTexture(e.texW, e.texH, e.kind));
        e.mat.needsUpdate = true;
      });
    }

    function roundRectPath(g, x, y, w, h, rad) {
      g.beginPath();
      g.moveTo(x + rad, y);
      g.arcTo(x + w, y, x + w, y + h, rad);
      g.arcTo(x + w, y + h, x, y + h, rad);
      g.arcTo(x, y + h, x, y, rad);
      g.arcTo(x, y, x + w, y, rad);
      g.closePath();
    }

    // Promo dibujada con los colores de tu app (se ve hasta que pongas tu screenshot real)
    function makePromoTexture(w, h, kind) {
      var cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      var g = cv.getContext('2d');
      var F = "'Plus Jakarta Sans', Poppins, sans-serif";
      // fondo claro de la app
      g.fillStyle = '#F1F5F9';
      g.fillRect(0, 0, w, h);
      var m = Math.min(w, h);
      // barra superior blanca
      g.fillStyle = '#FFFFFF';
      g.fillRect(0, 0, w, h * 0.15);
      g.fillStyle = '#E2E8F0';
      g.fillRect(0, h * 0.15, w, Math.max(2, m * 0.008));
      // logo rojo + nombre
      var gradLogo = g.createLinearGradient(w * 0.05, 0, w * 0.13, 0);
      gradLogo.addColorStop(0, '#DC2626');
      gradLogo.addColorStop(1, '#DC2626');
      // logo rojo degradado o icono real de la app
      if (logoReady) {
        var ls = m * 0.115, lx = w * 0.09 - ls / 2, ly = h * 0.075 - ls / 2;
        g.drawImage(appLogo, lx, ly, ls, ls);
      } else {
        g.fillStyle = gradLogo;
        g.beginPath(); g.arc(w * 0.09, h * 0.075, m * 0.045, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = '#0F172A'; g.textAlign = 'left';
      g.font = '800 ' + Math.round(m * 0.07) + 'px ' + F;
      g.fillText('Resto', w * 0.155, h * 0.10);
      g.textAlign = 'center';
      g.fillStyle = '#64748B';
      g.font = '700 ' + Math.round(m * 0.055) + 'px ' + F;
      g.fillText(kind === 'laptop' ? 'Pedidos · Mesa 3' : 'Hoy', w / 2, h * 0.235);
      // tarjetas blancas con datos
      function rcard(y, big, small, accent) {
        var cw = w * 0.8, ch = h * 0.155, cx = w * 0.1, cy = h * y;
        g.fillStyle = 'rgba(15,23,42,0.08)';
        roundRectPath(g, cx, cy + m * 0.008, cw, ch, ch * 0.28);
        g.fill();
        g.fillStyle = '#FFFFFF';
        roundRectPath(g, cx, cy, cw, ch, ch * 0.28);
        g.fill();
        g.strokeStyle = '#E2E8F0'; g.lineWidth = Math.max(2, m * 0.006);
        roundRectPath(g, cx, cy, cw, ch, ch * 0.28);
        g.stroke();
        g.fillStyle = '#0F172A'; g.textAlign = 'left';
        g.font = '800 ' + Math.round(m * 0.08) + 'px ' + F;
        g.fillText(big, cx + cw * 0.07, cy + ch * 0.58);
        g.fillStyle = accent || '#64748B';
        g.font = '700 ' + Math.round(m * 0.042) + 'px ' + F;
        g.fillText(small, cx + cw * 0.07, cy + ch * 0.85);
      }
      rcard(0.29, 'Bs 2.843', 'Ventas totales   ↑ 12%', '#22C55E');
      rcard(0.485, '24 · 8', 'Pedidos · Mesas ocupadas');
      rcard(0.68, 'Mesa 3 · Bs 70', 'Clásica · Papas · Gaseosa', '#DC2626');
      // botón degradado rojo → rosa
      var bw = w * 0.62, bh = h * 0.085, bx = w * 0.19, by = h * 0.885;
      var gradBtn = g.createLinearGradient(bx, 0, bx + bw, 0);
      gradBtn.addColorStop(0, '#DC2626');
      gradBtn.addColorStop(1, '#DC2626');
      g.fillStyle = gradBtn;
      roundRectPath(g, bx, by, bw, bh, bh / 2);
      g.fill();
      g.fillStyle = '#FFFFFF'; g.textAlign = 'center';
      g.font = '800 ' + Math.round(m * 0.048) + 'px ' + F;
      g.fillText('Enviar a cocina', w / 2, by + bh * 0.68);
      return cv;
    }

    function canvasTexture(cv) {
      var tex = new THREE.CanvasTexture(cv);
      if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(16, maxAniso);
      return tex;
    }

    // Tu screenshot en CALIDAD ORIGINAL: la imagen va directo como textura,
    // sin pasar por ningún canvas intermedio que la re-muestree o la suavice.
    function imageTexture(img) {
      var tex = new THREE.Texture(img);
      tex.needsUpdate = true;
      if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(16, maxAniso);
      return tex;
    }

    function screenMesh(w, h, kind, texW) {
      var aspect = w / h;
      var texH = Math.round(texW / aspect);
      var shot = kindShots[kind] || lastShot;
      var map = shot ? imageTexture(shot) : canvasTexture(makePromoTexture(texW, texH, kind));
      var mat = new THREE.MeshBasicMaterial({ map: map, toneMapped: false });
      screenMats.push({ mat: mat, aspect: aspect, kind: kind, texW: texW, texH: texH });
      return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    }

    function applyScreenshot(img, kind) {
      if (kind) { kindShots[kind] = img; }
      else { lastShot = img; }
      screenMats.forEach(function (e) {
        if (kind && e.kind !== kind) return;
        var shot = kindShots[e.kind] || lastShot;
        if (!shot) return;
        if (e.mat.map) e.mat.map.dispose();
        e.mat.map = imageTexture(shot);
        e.mat.needsUpdate = true;
      });
      if (loading) loading.style.display = 'none';
    }

    // Auto-carga por aparato: usa los archivos de la carpeta "screns".
    var AUTO = {
      phone: ['screns/mobile_1.png', 'screns/mobile_2.png'],
      tablet: ['screns/tablet.jpeg'],
      laptop: ['screns/pc_screen.png']
    };
    function tryAutoFor(kind, list) {
      if (!list.length || kindShots[kind]) return;
      var img = new Image();
      img.onload = function () { applyScreenshot(img, kind); };
      img.onerror = function () { tryAutoFor(kind, list.slice(1)); };
      img.src = list[0];
    }
    Object.keys(AUTO).forEach(function (kind) { tryAutoFor(kind, AUTO[kind]); });

    // Un botón por aparato: Móvil / Tablet / PC
    [['shot-phone', 'phone'], ['shot-tablet', 'tablet'], ['shot-laptop', 'laptop']].forEach(function (pair) {
      var input = document.getElementById(pair[0]);
      var kind = pair[1];
      if (!input) return;
      input.addEventListener('change', function () {
        var f = input.files && input.files[0];
        if (!f) return;
        var url = URL.createObjectURL(f);
        var img = new Image();
        img.onload = function () { applyScreenshot(img, kind); URL.revokeObjectURL(url); };
        img.onerror = function () { fail('No se pudo leer esa imagen. Prueba con un PNG o JPG.'); };
        img.src = url;
      });
    });

    // Botón "Tomar screenshot": compone TODO el anuncio (nodo #card) en PNG 1080x1080.
    // Todo es local, sin librerías externas. Para exportar hay que abrir con abrir.bat
    // (con doble clic al HTML el navegador bloquea la exportación por seguridad).
    var snapBtn = document.getElementById('snap');
    if (snapBtn) {
      snapBtn.addEventListener('click', function () { snapCard(); });
    }
    var bgPhoto = new Image();
    var bgReady = false;
    bgPhoto.onload = function () { bgReady = true; };
    bgPhoto.src = 'bg-restaurante.jpg';

    function snapCard() {
      if (loading) { loading.style.display = 'block'; loading.textContent = 'Generando imagen...'; }
      var start = function () {
        try {
          var dims = FORMATS[FORMAT] || FORMATS.feed;
          doSnap(dims[0], dims[1]);
        }
        catch (e) {
          fail('No se pudo generar la imagen. Abre con <b>abrir.bat</b> en vez de doble clic al HTML.');
        }
        if (loading) loading.style.display = 'none';
      };
      if (document.fonts && document.fonts.ready) {
        var raced = false;
        var go = function () { if (!raced) { raced = true; start(); } };
        document.fonts.ready.then(go);
        setTimeout(go, 1500);
      } else { start(); }
    }

    function coverDraw(g, img, S) {
      var ia = img.naturalWidth / img.naturalHeight;
      var sw, sh, sx, sy;
      if (ia > 1) { sh = img.naturalHeight; sw = sh; sx = (img.naturalWidth - sw) / 2; sy = 0; }
      else { sw = img.naturalWidth; sh = sw; sx = 0; sy = (img.naturalHeight - sh) / 2; }
      g.drawImage(img, sx, sy, sw, sh, 0, 0, S, S);
    }

    function doSnap(W, H) {
      if (H > W * 1.05) { tallSnap(W, H); return; }
      var S = W, u = S / 100; // u = 1cqw en px
      if (!bgReady || !bgPhoto.naturalWidth) throw new Error('bg');
      var cv = document.createElement('canvas');
      cv.width = S; cv.height = S;
      var g = cv.getContext('2d');
      var F = "'Plus Jakarta Sans','Poppins',sans-serif";
      var PINK = '#DC2626';

      // 1. foto de fondo
      coverDraw(g, bgPhoto, S);

      // 2. tintes (igual que .tint del CSS)
      var glow = g.createRadialGradient(S * 0.78, S * 0.18, 0, S * 0.78, S * 0.18, S * 0.42);
      glow.addColorStop(0, 'rgba(220,38,38,0.20)');
      glow.addColorStop(1, 'rgba(220,38,38,0)');
      g.fillStyle = glow;
      g.fillRect(0, 0, S, S);
      var left = g.createLinearGradient(0, 0, S, 0);
      left.addColorStop(0, 'rgba(3,22,38,0.97)');
      left.addColorStop(0.32, 'rgba(4,29,50,0.94)');
      left.addColorStop(0.55, 'rgba(5,35,60,0.62)');
      left.addColorStop(0.75, 'rgba(5,33,58,0.30)');
      left.addColorStop(1, 'rgba(3,18,32,0.50)');
      g.fillStyle = left;
      g.fillRect(0, 0, S, S);
      var bottom = g.createLinearGradient(0, S, 0, S * 0.66);
      bottom.addColorStop(0, 'rgba(2,15,28,0.98)');
      bottom.addColorStop(0.47, 'rgba(2,15,28,0.90)');
      bottom.addColorStop(1, 'rgba(2,15,28,0)');
      g.fillStyle = bottom;
      g.fillRect(0, 0, S, S);
      var vig = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.75);
      vig.addColorStop(0.52, 'rgba(1,10,20,0)');
      vig.addColorStop(1, 'rgba(1,10,20,0.6)');
      g.fillStyle = vig;
      g.fillRect(0, 0, S, S);

      // 3. brillos cálidos
      var dots = [[0.38, 0.03, 20], [0.5, 0.05, 16], [0.62, 0.03, 19], [0.74, 0.06, 15],
                  [0.86, 0.03, 18], [0.44, 0.12, 17], [0.58, 0.13, 21], [0.72, 0.12, 16], [0.9, 0.11, 19]];
      dots.forEach(function (d) {
        var rg = g.createRadialGradient(d[0] * S, d[1] * S, 0, d[0] * S, d[1] * S, d[2]);
        rg.addColorStop(0, 'rgba(255,235,200,0.55)');
        rg.addColorStop(1, 'rgba(255,235,200,0)');
        g.fillStyle = rg;
        g.fillRect(d[0] * S - d[2], d[1] * S - d[2], d[2] * 2, d[2] * 2);
      });

      // 4. escena 3D renderizada a 1080 (fondo transparente, se fusiona con la foto)
      var w = card.clientWidth || 600;
      var oldPR = renderer.getPixelRatio();
      exportLock = true;
      renderer.setPixelRatio(S / w);
      resize();
      renderer.render(scene, camera);
      g.drawImage(canvas, 0, 0, S, S);
      exportLock = false;
      renderer.setPixelRatio(oldPR);
      resize();

      // 5. logo
      var lx = S * 0.06, ly = S * 0.045;
      if (logoReady && appLogo.naturalWidth) {
        g.drawImage(appLogo, lx, ly, S * 0.064, S * 0.064);
      }
      g.textBaseline = 'alphabetic';
      g.fillStyle = '#fff';
      g.textAlign = 'left';
      g.font = '800 ' + Math.round(S * 0.046) + 'px ' + F;
      g.fillText('Resto', lx + S * 0.078, ly + S * 0.045);
      try { g.letterSpacing = '4px'; } catch (e) {}
      g.font = '600 ' + Math.round(S * 0.0145) + 'px ' + F;
      g.globalAlpha = 0.9;
      g.fillText('SISTEMA PARA RESTAURANTES', lx + S * 0.078, ly + S * 0.066);
      g.globalAlpha = 1;
      try { g.letterSpacing = '0px'; } catch (e) {}

      // 6. titular con "más fácil" en magenta (se lee del propio HTML)
      var h1El = document.querySelector('.content h1');
      var toks = [];
      if (h1El) {
        Array.prototype.forEach.call(h1El.childNodes, function (n) {
          var acc = n.nodeType === 1 && n.tagName === 'SPAN';
          var parts = (n.textContent || '').match(/\S+\s*/g) || [];
          parts.forEach(function (p) { toks.push({ t: p, acc: acc }); });
        });
      }
      var fs = S * 0.072, lh = fs * 1.06, maxW = S * 0.46, tx = S * 0.06;
      var lines = [], line = [], lw = 0;
      g.font = '800 ' + Math.round(fs) + 'px ' + F;
      toks.forEach(function (tk) {
        var tw = g.measureText(tk.t).width;
        if (lw + tw > maxW && line.length) { lines.push(line); line = []; lw = 0; }
        line.push({ t: tk.t, acc: tk.acc, w: tw });
        lw += tw;
      });
      if (line.length) lines.push(line);
      var hy = S * 0.14 + fs * 0.82;
      lines.forEach(function (ln) {
        var cx = tx;
        ln.forEach(function (tk) {
          g.fillStyle = tk.acc ? PINK : '#fff';
          g.fillText(tk.t, cx, hy);
          cx += tk.w;
        });
        hy += lh;
      });

      // 7. insignias de tiendas (se leen del propio HTML)
      var by = hy + S * 0.028, bx = tx, bh = S * 0.056;
      var brandMap = { 'fa-apple': '\uf179', 'fa-google-play': '\uf3ab', 'fa-microsoft': '\uf3ca' };
      var stores = document.querySelectorAll('.store');
      Array.prototype.forEach.call(stores, function (st, idx) {
        var small = (st.querySelector('small') || {}).textContent || '';
        var big = (st.querySelector('b') || {}).textContent || '';
        var cls = (st.querySelector('i') || {}).className || '';
        var code = '\uf179';
        Object.keys(brandMap).forEach(function (k) { if (cls.indexOf(k) !== -1) code = brandMap[k]; });
        g.font = '700 ' + Math.round(S * 0.019) + 'px ' + F;
        var bw1 = g.measureText(big).width;
        g.font = '600 ' + Math.round(S * 0.011) + 'px ' + F;
        var bw2 = g.measureText(small).width;
        var bw = Math.max(bw1, bw2) + S * 0.027 + S * 0.01 + S * 0.03;
        if (idx > 0) bx += S * 0.012;
        // antes de dibujar la insignia 2 y 3, bx ya avanzó; para la primera bx = tx
        g.fillStyle = 'rgba(2,12,22,0.72)';
        g.fillRect(bx, by, bw, bh);
        g.strokeStyle = 'rgba(255,255,255,0.35)';
        g.lineWidth = 2;
        g.strokeRect(bx, by, bw, bh);
        g.fillStyle = '#fff';
        g.font = '400 ' + Math.round(S * 0.027) + 'px FA-Brands';
        g.fillText(code, bx + S * 0.012, by + bh * 0.72);
        var txtX = bx + S * 0.012 + S * 0.027 + S * 0.01;
        g.globalAlpha = 0.7;
        g.font = '600 ' + Math.round(S * 0.011) + 'px ' + F;
        g.fillText(small, txtX, by + bh * 0.36);
        g.globalAlpha = 1;
        g.font = '700 ' + Math.round(S * 0.019) + 'px ' + F;
        g.fillText(big, txtX, by + bh * 0.74);
        bx += bw;
      });

      // 8. características (se leen del propio HTML)
      var faMap = { 'fa-receipt': '\uf543', 'fa-chart-column': '\ue0e3', 'fa-box': '\uf466', 'fa-utensils': '\uf2e7', 'fa-chart-line': '\uf201', 'fa-lightbulb': '\uf0eb', 'fa-bell-concierge': '\uf562', 'fa-kitchen-set': '\ue51a', 'fa-cash-register': '\uf788', 'fa-arrows-rotate': '\uf021', 'fa-mobile-screen': '\uf3cf', 'fa-heart': '\uf004', 'fa-comment': '\uf075', 'fa-share': '\uf064' };
      var feats = readBenFeats(faMap);
      var gap = S * 0.012, cardW = (S * 0.90 - gap * (feats.length - 1)) / feats.length;
      var fx0 = S * 0.05, cardH = S * 0.082;
      var ticksY = S - S * 0.030;
      var cardsY = ticksY - S * 0.014 - cardH;
      g.fillStyle = '#fff';
      g.textAlign = 'center';
      g.font = '800 ' + Math.round(S * 0.023) + 'px ' + F;
      g.fillText(benTitle(), S / 2, cardsY - S * 0.016);
      feats.forEach(function (ft, i) {
        drawBenCard(g, fx0 + i * (cardW + gap), cardsY, cardW, cardH, ft, S, F);
      });
      g.fillStyle = '#FCA5A5';
      g.textAlign = 'center';
      g.font = '700 ' + Math.round(S * 0.016) + 'px ' + F;
      g.fillText(benTicks(), S / 2, ticksY);
      g.textAlign = 'left';

      // 9. exportar PNG (si el canvas quedó "sucio" por file://, blob = null)
      exportCanvas(cv, 'anuncio-resto-' + FORMAT + '.png');
    }

    function exportCanvas(cv, name) {
      cv.toBlob(function (blob) {
        if (!blob) {
          fail('El navegador bloqueó la exportación. Abre con <b>abrir.bat</b> en vez de doble clic al HTML.');
          return;
        }
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      }, 'image/png');
    }

    function coverRect(g, img, W, H) {
      var ia = img.naturalWidth / img.naturalHeight, a = W / H, sw, sh, sx, sy;
      if (ia > a) { sh = img.naturalHeight; sw = sh * a; sx = (img.naturalWidth - sw) / 2; sy = 0; }
      else { sw = img.naturalWidth; sh = sw / a; sx = 0; sy = (img.naturalHeight - sh) / 2; }
      g.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
    }

    function readBenFeats(faMap) {
      var out = [];
      Array.prototype.forEach.call(document.querySelectorAll('.feat'), function (ft) {
        var title = ((ft.querySelector('b') || {}).textContent || '').trim();
        var desc = ((ft.querySelector('span') || {}).textContent || '').trim();
        var cls = ((ft.querySelector('i') || {}).className || '');
        var code = '\uf0eb';
        Object.keys(faMap).forEach(function (k) { if (cls.indexOf(k) !== -1) code = faMap[k]; });
        out.push({ title: title, desc: desc, code: code });
      });
      return out;
    }
    function benTicks() {
      var el = document.querySelector('.feat-ticks');
      return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
    }
    function benTitle() {
      var el = document.querySelector('.feat-title');
      return el ? el.textContent.trim() : '';
    }
    function drawBenCard(g, x0, y0, cw, ch, ft, u, F) {
      var pad = u * 0.012, isz = u * 0.052;
      g.fillStyle = 'rgba(2,12,22,0.55)';
      g.fillRect(x0, y0, cw, ch);
      g.strokeStyle = 'rgba(255,255,255,0.22)';
      g.lineWidth = 2;
      g.strokeRect(x0, y0, cw, ch);
      g.fillStyle = 'rgba(220,38,38,0.20)';
      g.fillRect(x0 + pad, y0 + (ch - isz) / 2, isz, isz);
      g.strokeStyle = 'rgba(220,38,38,0.6)';
      g.strokeRect(x0 + pad, y0 + (ch - isz) / 2, isz, isz);
      g.fillStyle = '#FCA5A5';
      g.textAlign = 'center';
      g.font = '900 ' + Math.round(u * 0.024) + 'px FA';
      g.fillText(ft.code, x0 + pad + isz / 2, y0 + (ch - isz) / 2 + isz * 0.70);
      var tx2 = x0 + pad + isz + pad, twMax = cw - pad - isz - pad * 2;
      g.textAlign = 'left';
      g.fillStyle = '#fff';
      g.font = '800 ' + Math.round(u * 0.019) + 'px ' + F;
      var ty = y0 + ch / 2 - u * 0.008, t2 = ft.title;
      while (g.measureText(t2).width > twMax && t2.length > 4) t2 = t2.slice(0, -2);
      g.fillText(t2, tx2, ty);
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.font = '600 ' + Math.round(u * 0.0145) + 'px ' + F;
      var words = ft.desc.split(/\s+/), fl = [], cl = '';
      words.forEach(function (wd) {
        var s2 = cl ? cl + ' ' + wd : wd;
        if (g.measureText(s2).width > twMax && cl) { fl.push(cl); cl = wd; }
        else { cl = s2; }
      });
      if (cl) fl.push(cl);
      fl = fl.slice(0, 2);
      fl.forEach(function (ln, li) {
        g.fillText(ln, tx2, ty + u * 0.016 * (li + 1));
      });
    }

    // Formatos verticales (Retrato 4:5, Reel 9:16): misma marca, composición apilada
    function tallSnap(W, H) {
      if (!bgReady || !bgPhoto.naturalWidth) throw new Error('bg');
      var cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      var g = cv.getContext('2d');
      var F = "'Plus Jakarta Sans','Poppins',sans-serif";
      var PINK = '#DC2626';
      coverRect(g, bgPhoto, W, H);
      var glow = g.createRadialGradient(W * 0.78, H * 0.10, 0, W * 0.78, H * 0.10, W * 0.45);
      glow.addColorStop(0, 'rgba(220,38,38,0.20)');
      glow.addColorStop(1, 'rgba(220,38,38,0)');
      g.fillStyle = glow;
      g.fillRect(0, 0, W, H);
      var left = g.createLinearGradient(0, 0, W, 0);
      left.addColorStop(0, 'rgba(3,22,38,0.97)');
      left.addColorStop(0.32, 'rgba(4,29,50,0.94)');
      left.addColorStop(0.55, 'rgba(5,35,60,0.62)');
      left.addColorStop(0.75, 'rgba(5,33,58,0.30)');
      left.addColorStop(1, 'rgba(3,18,32,0.50)');
      g.fillStyle = left;
      g.fillRect(0, 0, W, H);
      var bottom = g.createLinearGradient(0, H, 0, H * 0.70);
      bottom.addColorStop(0, 'rgba(2,15,28,0.98)');
      bottom.addColorStop(0.45, 'rgba(2,15,28,0.90)');
      bottom.addColorStop(1, 'rgba(2,15,28,0)');
      g.fillStyle = bottom;
      g.fillRect(0, 0, W, H);
      var vig = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.72);
      vig.addColorStop(0.52, 'rgba(1,10,20,0)');
      vig.addColorStop(1, 'rgba(1,10,20,0.6)');
      g.fillStyle = vig;
      g.fillRect(0, 0, W, H);
      var dots = [[0.38, 0.02, 20], [0.5, 0.03, 16], [0.62, 0.02, 19], [0.74, 0.04, 15],
                  [0.86, 0.02, 18], [0.44, 0.07, 17], [0.58, 0.08, 21], [0.72, 0.07, 16], [0.9, 0.06, 19]];
      dots.forEach(function (d) {
        var rg = g.createRadialGradient(d[0] * W, d[1] * H, 0, d[0] * W, d[1] * H, d[2]);
        rg.addColorStop(0, 'rgba(255,235,200,0.55)');
        rg.addColorStop(1, 'rgba(255,235,200,0)');
        g.fillStyle = rg;
        g.fillRect(d[0] * W - d[2], d[1] * H - d[2], d[2] * 2, d[2] * 2);
      });

      // logo
      var lx = W * 0.07, ly = H * 0.028;
      if (logoReady && appLogo.naturalWidth) {
        g.drawImage(appLogo, lx, ly, W * 0.075, W * 0.075);
      }
      g.textBaseline = 'alphabetic';
      g.textAlign = 'left';
      g.fillStyle = '#fff';
      g.font = '800 ' + Math.round(W * 0.052) + 'px ' + F;
      g.fillText('Resto', lx + W * 0.088, ly + W * 0.052);
      try { g.letterSpacing = '3px'; } catch (e) {}
      g.font = '600 ' + Math.round(W * 0.016) + 'px ' + F;
      g.globalAlpha = 0.9;
      g.fillText('SISTEMA PARA RESTAURANTES', lx + W * 0.088, ly + W * 0.075);
      g.globalAlpha = 1;
      try { g.letterSpacing = '0px'; } catch (e) {}

      // titular a todo el ancho (texto real del HTML)
      var h1El = document.querySelector('.content h1');
      var toks = [];
      if (h1El) {
        Array.prototype.forEach.call(h1El.childNodes, function (n) {
          var acc = n.nodeType === 1 && n.tagName === 'SPAN';
          var parts = (n.textContent || '').match(/\S+\s*/g) || [];
          parts.forEach(function (p) { toks.push({ t: p, acc: acc }); });
        });
      }
      var fs = W * 0.075, lh = fs * 1.06, maxW = W * 0.86 - ((H > W * 1.5) ? W * 0.13 : 0), tx = W * 0.07;
      g.font = '800 ' + Math.round(fs) + 'px ' + F;
      var lines = [], line = [], lw = 0;
      toks.forEach(function (tk) {
        var tw = g.measureText(tk.t).width;
        if (lw + tw > maxW && line.length) { lines.push(line); line = []; lw = 0; }
        line.push({ t: tk.t, acc: tk.acc, w: tw });
        lw += tw;
      });
      if (line.length) lines.push(line);
      var hy = H * 0.105 + fs * 0.82;
      lines.forEach(function (ln) {
        var cx = tx;
        ln.forEach(function (tk) {
          g.fillStyle = tk.acc ? PINK : '#fff';
          g.fillText(tk.t, cx, hy);
          cx += tk.w;
        });
        hy += lh;
      });

      // escena 3D cuadrada debajo del titular
      var w = card.clientWidth || 600;
      var isReel = FORMAT === 'reel';
      var cardHe = W * (isReel ? 0.075 : 0.082);
      var cardsHe = isReel ? 3 * cardHe + 2 * W * 0.014 : cardHe;
      var featBlock = W * 0.039 + cardsHe + W * 0.03 + H * 0.035;
      var storeBlock = H * 0.055;
      var sceneSize = Math.min(W, H - hy - H * 0.02 - storeBlock - featBlock - H * 0.03);
      var yScene = hy + H * 0.02;
      var oldPR = renderer.getPixelRatio();
      exportLock = true;
      renderer.setPixelRatio(sceneSize / w);
      resize();
      renderer.render(scene, camera);
      g.drawImage(canvas, (W - sceneSize) / 2, yScene, sceneSize, sceneSize);
      exportLock = false;
      renderer.setPixelRatio(oldPR);
      resize();

      // insignias de tiendas
      var brandMap = { 'fa-apple': '\uf179', 'fa-google-play': '\uf3ab', 'fa-microsoft': '\uf3ca' };
      var items = [];
      Array.prototype.forEach.call(document.querySelectorAll('.store'), function (st) {
        var small = (st.querySelector('small') || {}).textContent || '';
        var big = (st.querySelector('b') || {}).textContent || '';
        var cls = (st.querySelector('i') || {}).className || '';
        var code = '\uf179';
        Object.keys(brandMap).forEach(function (k) { if (cls.indexOf(k) !== -1) code = brandMap[k]; });
        g.font = '700 ' + Math.round(W * 0.019) + 'px ' + F;
        var wBig = g.measureText(big).width;
        g.font = '600 ' + Math.round(W * 0.011) + 'px ' + F;
        var wSmall = g.measureText(small).width;
        items.push({ small: small, big: big, code: code, w: Math.max(wBig, wSmall) + W * 0.067 });
      });
      var totW = 0;
      items.forEach(function (it) { totW += it.w; });
      totW += (items.length - 1) * W * 0.012;
      var kk = Math.min(1, (W * 0.86) / totW);
      var byy = yScene + sceneSize + H * 0.018, bxx = W * 0.07, bhh = H * 0.042 * kk + 14 * (1 - kk);
      items.forEach(function (it, idx) {
        var bw = it.w * kk;
        if (idx > 0) bxx += W * 0.012 * kk;
        g.fillStyle = 'rgba(2,12,22,0.72)';
        g.fillRect(bxx, byy, bw, bhh);
        g.strokeStyle = 'rgba(255,255,255,0.35)';
        g.lineWidth = 2;
        g.strokeRect(bxx, byy, bw, bhh);
        g.fillStyle = '#fff';
        g.font = '400 ' + Math.round(W * 0.027 * kk) + 'px FA-Brands';
        g.fillText(it.code, bxx + W * 0.012 * kk, byy + bhh * 0.72);
        var tX = bxx + (W * 0.012 + W * 0.027 + W * 0.01) * kk;
        g.globalAlpha = 0.7;
        g.font = '600 ' + Math.round(W * 0.011 * kk + 6 * (1 - kk)) + 'px ' + F;
        g.fillText(it.small, tX, byy + bhh * 0.36);
        g.globalAlpha = 1;
        g.font = '700 ' + Math.round(W * 0.019 * kk + 8 * (1 - kk)) + 'px ' + F;
        g.fillText(it.big, tX, byy + bhh * 0.74);
        bxx += bw;
      });

      // beneficios: 1 fila de 6 (retrato) o 2 filas de 3 (reel)
      var faMap2 = { 'fa-receipt': '\uf543', 'fa-chart-column': '\ue0e3', 'fa-box': '\uf466', 'fa-utensils': '\uf2e7', 'fa-chart-line': '\uf201', 'fa-lightbulb': '\uf0eb', 'fa-bell-concierge': '\uf562', 'fa-kitchen-set': '\ue51a', 'fa-cash-register': '\uf788', 'fa-arrows-rotate': '\uf021', 'fa-mobile-screen': '\uf3cf' };
      var feats = readBenFeats(faMap2);
      var gap2 = W * 0.014;
      var availX = W * 0.07, availW = W * 0.86 - (isReel ? W * 0.09 : 0);
      var cols = isReel ? 1 : feats.length;
      var cw = (availW - gap2 * (cols - 1)) / cols;
      var safeB = isReel ? H * 0.17 : H * 0.06;
      var rowsN = isReel ? feats.length : 1;
      var yTop = H - safeB - (W * 0.039 + rowsN * cardHe + (rowsN - 1) * gap2 + W * 0.03);
      g.fillStyle = '#fff';
      g.textAlign = 'center';
      g.font = '800 ' + Math.round(W * 0.023) + 'px ' + F;
      g.fillText(benTitle(), W / 2, yTop + W * 0.023);
      var cy = yTop + W * 0.039;
      feats.forEach(function (ft, i) {
        var col = isReel ? 0 : i, row = isReel ? i : 0;
        drawBenCard(g, availX + col * (cw + gap2), cy + row * (cardHe + gap2), isReel ? availW : cw, cardHe, ft, W, F);
      });
      var ticksY2 = cy + (isReel ? feats.length * (cardHe + gap2) - gap2 : cardHe) + W * 0.03;
      g.fillStyle = '#FCA5A5';
      g.textAlign = 'center';
      g.font = '700 ' + Math.round(W * 0.016) + 'px ' + F;
      g.fillText(benTicks(), W / 2, ticksY2);
      g.textAlign = 'left';

      exportCanvas(cv, 'anuncio-resto-' + FORMAT + '.png');
    }

    // Guía de margen seguro: solo se muestra en formato Reel (vista previa, no se exporta)
    var safeToggle = document.getElementById('safeToggle');
    var safezone = document.getElementById('safezone');
    function updateSafe() {
      if (!safezone) return;
      var show = safeToggle && safeToggle.checked && FORMAT === 'reel';
      safezone.style.display = show ? 'block' : 'none';
    }
    if (safeToggle && safezone) {
      safeToggle.addEventListener('change', updateSafe);
      updateSafe();
    }

/* ---------- materiales y aparatos ---------- */
    var bodyMat = new THREE.MeshStandardMaterial({ color: 0x23232c, metalness: 0.35, roughness: 0.55 });
    var frameMat = new THREE.MeshStandardMaterial({ color: 0x3a3a46, metalness: 0.5, roughness: 0.45 });
    var bezelMat = new THREE.MeshStandardMaterial({ color: 0x050507, roughness: 0.4, metalness: 0.2 });
    var lensMat = new THREE.MeshStandardMaterial({ color: 0x0a0a12, metalness: 0.4, roughness: 0.15 });

    function box(w, h, d, mat) {
      return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    }

    function addCameraBump(group, x, y, z) {
      var bump = box(0.32, 0.32, 0.04, frameMat);
      bump.position.set(x, y, z);
      group.add(bump);
      [[-0.07, 0.07], [0.07, -0.07]].forEach(function (d) {
        var lens = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 20), lensMat);
        lens.rotation.x = Math.PI / 2;
        lens.position.set(x + d[0], y + d[1], z - 0.025);
        group.add(lens);
      });
    }

    function createPhone() {
      var g = new THREE.Group();
      var W = 0.78, H = 1.62, D = 0.085;
      g.add(box(W, H, D, bodyMat));
      var bezel = box(W - 0.02, H - 0.02, 0.005, bezelMat);
      bezel.position.z = D / 2;
      g.add(bezel);
      var scr = screenMesh(W - 0.08, H - 0.08, 'phone', 1024);
      scr.position.z = D / 2 + 0.004;
      g.add(scr);
      var notch = box(0.24, 0.05, 0.01, bezelMat);
      notch.position.set(0, H / 2 - 0.08, D / 2 + 0.007);
      g.add(notch);
      addCameraBump(g, -W / 2 + 0.22, H / 2 - 0.22, -D / 2 - 0.015);
      return g;
    }

    function createTablet() {
      var g = new THREE.Group();
      var W = 1.35, H = 1.85, D = 0.06;
      g.add(box(W, H, D, bodyMat));
      var bezel = box(W - 0.02, H - 0.02, 0.005, bezelMat);
      bezel.position.z = D / 2;
      g.add(bezel);
      var scr = screenMesh(W - 0.12, H - 0.12, 'tablet', 1536);
      scr.position.z = D / 2 + 0.004;
      g.add(scr);
      addCameraBump(g, -W / 2 + 0.24, H / 2 - 0.24, -D / 2 - 0.015);
      return g;
    }

    function createLaptop() {
      var g = new THREE.Group();
      var W = 2.3, Dp = 1.55, T = 0.07;
      g.add(box(W, T, Dp, frameMat));
      var kb = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.25, Dp * 0.42), bezelMat);
      kb.rotation.x = -Math.PI / 2;
      kb.position.set(0, T / 2 + 0.002, -0.18);
      g.add(kb);
      var pad = box(0.75, 0.008, 0.42, bezelMat);
      pad.position.set(0, T / 2, 0.47);
      g.add(pad);
      var lidPivot = new THREE.Group();
      lidPivot.position.set(0, T / 2, -Dp / 2 + 0.02);
      lidPivot.rotation.x = -0.22;
      g.add(lidPivot);
      var LH = 1.5;
      var lid = box(W, LH, 0.05, frameMat);
      lid.position.y = LH / 2;
      lidPivot.add(lid);
      var bez = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.03, LH - 0.03), bezelMat);
      bez.position.set(0, LH / 2, 0.026);
      lidPivot.add(bez);
      var scr = screenMesh(W - 0.14, LH - 0.16, 'laptop', 2048);
      scr.position.set(0, LH / 2 + 0.01, 0.028);
      lidPivot.add(scr);
      return g;
    }

    var devices;
    var root = new THREE.Group();
    scene.add(root);
    devices = { laptop: createLaptop(), tablet: createTablet(), phone: createPhone() };
    Object.keys(devices).forEach(function (k) { root.add(devices[k]); });

    /* ---------- adornos ---------- */
    var neonMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 });
    var ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 12, 40), neonMat);
    ring.position.set(-0.2, -1.9, 0.5);
    scene.add(ring);
    var tri = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.018, 8, 3), neonMat);
    tri.position.set(-0.4, 2.1, 0);
    scene.add(tri);

    function L(p, r, s) { return { p: new THREE.Vector3(p[0], p[1], p[2]), r: new THREE.Euler(r[0], r[1], r[2]), s: s }; }
    var layouts = {
      all: {
        laptop: L([1.4, -0.65, -1.0], [0.38, -0.45, 0], 0.95),
        tablet: L([2.3, 0.45, -0.1], [0.05, -0.55, 0.1], 0.8),
        phone: L([1.05, -0.35, 1.1], [0.05, -0.35, -0.18], 0.85)
      },
      phone: {
        laptop: L([2.6, -0.9, -3.2], [0.38, -0.6, 0], 0.7),
        tablet: L([3.2, 0.6, -2.8], [0.05, -0.7, 0.1], 0.6),
        phone: L([1.7, 0.0, 1.4], [0.05, -0.3, -0.2], 1.35)
      },
      tablet: {
        laptop: L([2.8, -0.9, -3.2], [0.38, -0.6, 0], 0.7),
        tablet: L([1.75, 0.05, 1.0], [0.05, -0.35, 0.08], 1.25),
        phone: L([3.2, -0.6, -1.5], [0.05, -0.5, -0.15], 0.6)
      },
      laptop: {
        laptop: L([1.1, -0.55, 0.6], [0.35, -0.4, 0], 1.15),
        tablet: L([3.3, 0.8, -3.0], [0.05, -0.7, 0.1], 0.6),
        phone: L([3.4, -0.7, -2.5], [0.05, -0.6, -0.15], 0.55)
      }
    };
    var mode = 'all';
    var ZOOM = 1.5; // modelos más grandes en todos los modos
    // Formato de tarjeta: Feed 1:1, Retrato 4:5, Reel 9:16 (también cambia el encuadre 3D)
    var FORMAT = 'feed';
    var FORMATS = { feed: [1080, 1080], portrait: [1080, 1350], reel: [1080, 1920] };
    // Posiciones 3D por formato (el encuadre cambia con el aspecto)
    var PRESETS = {
      feed: { camZ: 11, all: null }, // usa layouts.all
      portrait: { camZ: 12.5, all: {
        laptop: L([1.2, -0.6, -1.0], [0.38, -0.45, 0], 0.85),
        tablet: L([2.0, 0.4, -0.1], [0.05, -0.55, 0.1], 0.7),
        phone: L([0.9, -0.35, 1.1], [0.05, -0.35, -0.18], 0.78) } },
      reel: { camZ: 13, all: {
        laptop: L([-0.6, -1.2, -1.2], [0.3, -0.35, 0], 0.82),
        tablet: L([0.75, 0.5, -0.2], [0.05, -0.4, 0.08], 0.72),
        phone: L([-0.15, -0.25, 1.0], [0.05, -0.3, -0.15], 0.82) } }
    };
    var camZT = 11;
    function targetFor(k) {
      if (mode === 'all') {
        if (FORMAT === 'feed' || !PRESETS[FORMAT].all) return layouts.all[k];
        return PRESETS[FORMAT].all[k];
      }
      if (FORMAT === 'feed') return layouts[mode][k];
      if (k === mode) return L([0.25, 0, 1.2], [0.05, -0.3, -0.1], 1.45);
      return L([(k === 'laptop' ? -1 : 1) * 3.6, -1.6, -3.6], [0.1, -0.6, 0], 0.55);
    }
    function placeAll() {
      Object.keys(devices).forEach(function (k) {
        var t = targetFor(k);
        devices[k].position.copy(t.p);
        devices[k].rotation.copy(t.r);
        devices[k].scale.setScalar(t.s * ZOOM);
      });
    }
    placeAll();

    var tabBtns = document.querySelectorAll('#tabs button');
    tabBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        tabBtns.forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        mode = b.getAttribute('data-mode');
      });
    });

    // Botones de formato del panel
    var fmtBtns = document.querySelectorAll('#fmt button');
    fmtBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        fmtBtns.forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        FORMAT = b.getAttribute('data-fmt');
        card.className = 'card fmt-' + FORMAT;
        camZT = (PRESETS[FORMAT] || PRESETS.feed).camZ || 11;
        placeAll();
        updateSafe();
      });
    });

    /* ---------- interacción ---------- */
    var raycaster = new THREE.Raycaster();
    var pointer = new THREE.Vector2();
    var mouse = { x: 0, y: 0 };
    var drag = null, spin = 0, spinVel = 0;

    function setPointer(e) {
      var rc = canvas.getBoundingClientRect();
      pointer.set(
        ((e.clientX - rc.left) / rc.width) * 2 - 1,
        -(((e.clientY - rc.top) / rc.height) * 2 - 1)
      );
      mouse.x = pointer.x;
      mouse.y = pointer.y;
    }
    canvas.addEventListener('pointermove', function (e) {
      setPointer(e);
      if (drag !== null) {
        var dx = e.clientX - drag;
        drag = e.clientX;
        spinVel = dx * 0.01;
        spin += spinVel;
      }
    });
    canvas.addEventListener('pointerdown', function (e) {
      drag = e.clientX;
      setPointer(e);
      raycaster.setFromCamera(pointer, camera);
      var hit = raycaster.intersectObjects(root.children, true)[0];
      if (hit) {
        var o = hit.object;
        while (o.parent && o.parent !== root) o = o.parent;
        var name = Object.keys(devices).filter(function (k) { return devices[k] === o; })[0];
        if (name) {
          var btn = document.querySelector('#tabs button[data-mode="' + name + '"]');
          if (btn) btn.click();
        }
      }
    });
    window.addEventListener('pointerup', function () { drag = null; });

    function resize() {
      var w = card.clientWidth || 600, h = card.clientHeight || 600;
      if (!exportLock) renderer.setPixelRatio(Math.max(1, RENDER_LONG / Math.max(w, h)));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    if ('ResizeObserver' in window) {
      new ResizeObserver(resize).observe(card);
    } else {
      window.addEventListener('resize', resize);
    }
    resize();

    /* ---------- animación ---------- */
    var clock = new THREE.Clock();
    var tmpQ = new THREE.Quaternion();
    var firstFrame = true;
    function animate() {
      requestAnimationFrame(animate);
      var dt = Math.min(clock.getDelta(), 0.05);
      var t = clock.elapsedTime;
      var a = 1 - Math.pow(0.002, dt);

      if (drag === null) { spinVel *= 0.92; spin += spinVel; spin *= 0.97; }

      var i = 0;
      Object.keys(devices).forEach(function (k) {
        var d = devices[k];
        var tgt = targetFor(k);
        var floatY = Math.sin(t * 1.2 + i * 1.7) * 0.08;
        d.position.x += (tgt.p.x - d.position.x) * a;
        d.position.y += ((tgt.p.y + floatY) - d.position.y) * a;
        d.position.z += (tgt.p.z - d.position.z) * a;
        tmpQ.setFromEuler(new THREE.Euler(
          tgt.r.x + Math.sin(t * 0.8 + i) * 0.03,
          tgt.r.y + Math.sin(t * 0.6 + i * 2) * 0.06 + ((mode === k || mode === 'all') ? spin : 0),
          tgt.r.z
        ));
        d.quaternion.slerp(tmpQ, a);
        var sc = d.scale.x + (tgt.s * ZOOM - d.scale.x) * a;
        d.scale.setScalar(sc);
        i++;
      });

      root.rotation.y += ((mouse.x * 0.12) - root.rotation.y) * 0.05;
      root.rotation.x += ((-mouse.y * 0.08) - root.rotation.x) * 0.05;
      camera.position.z += (camZT - camera.position.z) * 0.05;

      ring.position.y = -1.9 + Math.sin(t * 1.5) * 0.08;
      ring.rotation.y = t * 0.8;
      tri.rotation.z = t * 0.6;

      renderer.render(scene, camera);
      if (firstFrame) {
        firstFrame = false;
        if (loading) loading.style.display = 'none'; // el "cargando" SIEMPRE se oculta aquí
      }
    }
    animate();
  } catch (e) {
    fail('El 3D falló al arrancar: ' + (e && e.message ? e.message : e));
  }
})();
