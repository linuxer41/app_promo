// Presentación de Mis Facturas con un iPhone 3D real (GLB) para Termux.
//
// La escena se dibuja con WebGL (Mesa/llvmpipe) en una ventana de Chromium
// dentro de Xvfb y se graba con ffmpeg x11grab. No se leen píxeles de WebGL,
// que es lo que rompía el proceso GPU en Termux.
//
// Solo hay dos móviles 3D: uno entra mientras el otro sale. Los cinco pasos
// reutilizan esos dos y cambian la captura de la pantalla cuando el móvil está
// fuera de cuadro, para que llvmpipe pueda mantener el ritmo.
//
//   http://localhost:8080/present-3d.html          -> vista previa en bucle
//   ?record=1&vdur=30                              -> queda en t=0 hasta beginRecording()
//   ?beat=3                                        -> congela un paso
(function () {
  'use strict';

  var qs = new URLSearchParams(location.search);
  var DUR = Math.max(8, Math.min(90, Number(qs.get('vdur')) || 30));
  var FREEZE = qs.get('beat');
  var RECORD = qs.get('record') === '1';
  var RES = Math.max(0.3, Math.min(1, Number(qs.get('res')) || 0.5));

  var W = 1080, H = 1920;
  var CAM_Z = 3.6, FOV = 30;
  var PX = H / (2 * CAM_Z * Math.tan(FOV * Math.PI / 360));
  var BASE_Y = -0.25;
  var BASE_SCALE = 1.32;
  var ENTRY_PX = 900, EXIT_PX = 900;

  // Duraciones de fábrica; se escalan al total que pida --duration.
  var BEATS = [
    { kind: 'cover', dur: 4.0,
      name: 'Mis Facturas', role: 'Pago de servicios con QR',
      tag: 'Paga el agua, la luz y tus servicios con el QR de tu banco o tu billetera. Sin filas y sin ventanillas.',
      chip: 'Web y Android · <b>IATHINGS</b>' },

    { kind: 'shot', dur: 4.3, src: 'screens/phone-web-empsaat.png',
      kicker: 'Paso 1 · Tu empresa', title: 'Entra desde la página de tu empresa',
      sub: 'En el sitio de EMPSAAT, de CESSA o de quien te cobra, pulsas el botón de pago y caes directo en Mis Facturas.' },

    { kind: 'shot', dur: 4.3, src: 'screens/phone-web-empresas.png',
      kicker: 'Paso 2 · Tus cuentas', title: 'Todas tus empresas en un solo lugar',
      sub: 'Elige la empresa que te cobra y, si la usas seguido, déjala guardada como pago frecuente.' },

    { kind: 'shot', dur: 4.3, src: 'screens/phone-web-colecciones.png',
      kicker: 'Paso 3 · Buscarte', title: 'Busca con tu número o tu CI',
      sub: 'Número de abonado o CI/NIT. Puedes ver tu deuda sin registro y sin contraseña.' },

    { kind: 'shot', dur: 4.4, src: 'screens/phone-deudas.png',
      kicker: 'Paso 4 · Revisar', title: 'Mira lo que debes y elige qué pagar',
      sub: 'Cada servicio y cada mes van por separado. Marcas lo que vas a pagar y el QR sale por el monto exacto.' },

    { kind: 'shot', dur: 4.4, src: 'screens/phone-qr.png',
      kicker: 'Paso 5 · Pagar', title: 'Escanea el QR y listo',
      sub: 'Abre tu banco o tu billetera, escanea el código y Mis Facturas queda esperando la confirmación del pago.' },

    { kind: 'end', dur: 4.3,
      name: 'Mis Facturas', tag: 'Disponible en Google Play y en la web',
      badge: 'screens/play-badge.png', url: 'mis-facturas.iathings.com' }
  ];

  var total = BEATS.reduce(function (a, b) { return a + b.dur; }, 0);
  var acc = 0;
  var shots = [];
  BEATS.forEach(function (b, i) {
    b.d = b.dur * DUR / total;
    b.t0 = acc;
    b.phase = i * 1.7;
    acc += b.d;
    if (b.kind === 'shot') shots.push({ beat: b, index: i });
  });
  window.TOTAL_DURATION = DUR;

  document.documentElement.classList.add('render-mode');

  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function easeOut(t) { t = 1 - t; return 1 - t * t * t; }
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function mk(html) {
    var d = document.createElement('div');
    d.innerHTML = html.trim();
    return d.firstChild;
  }

  function shotHTML(b) {
    return '<section class="beat">' +
      '<div class="copy">' +
        '<span class="kicker">' + b.kicker + '</span>' +
        '<h2 class="title">' + b.title + '</h2>' +
        '<p class="sub">' + b.sub + '</p>' +
      '</div>' +
    '</section>';
  }

  function midHTML(b, cover) {
    var inner = '<img class="bigicon" src="screens/icono.png" alt="">';
    inner += '<div class="name">' + b.name + '</div>';
    if (b.role) inner += '<div class="role">' + b.role + '</div>';
    if (b.tag) inner += '<p class="tag">' + b.tag + '</p>';
    if (cover && b.chip) inner += '<div class="chip">' + b.chip + '</div>';
    if (!cover && b.badge) inner += '<img class="badge" src="' + b.badge + '" alt="Disponible en Google Play">';
    if (!cover && b.url) inner += '<div class="url">' + b.url + '</div>';
    return '<section class="beat"><div class="mid">' + inner + '</div></section>';
  }

  function objectives(b, el) {
    if (b.kind === 'shot') {
      return [
        { el: el.querySelector('.kicker'), delay: 0, dur: 0.36, kind: 'copy', hid: 18 },
        { el: el.querySelector('.title'), delay: 0.06, dur: 0.42, kind: 'copy', hid: 26 },
        { el: el.querySelector('.sub'), delay: 0.13, dur: 0.42, kind: 'copy', hid: 26 }
      ];
    }
    var plan = [
      ['.bigicon', 0], ['.name', 0.07], ['.role', 0.13], ['.tag', 0.19],
      ['.chip', 0.25], ['.badge', 0.25], ['.url', 0.31]
    ];
    return plan.map(function (p) {
      var node = el.querySelector(p[0]);
      return node ? { el: node, delay: p[1], dur: 0.46, kind: 'mid' } : null;
    }).filter(Boolean);
  }

  var track = document.getElementById('track');
  BEATS.forEach(function (b, i) {
    b.el = mk(b.kind === 'shot' ? shotHTML(b) : midHTML(b, b.kind === 'cover'));
    b.el.style.zIndex = String(10 + i);
    b.items = objectives(b, b.el);
    track.appendChild(b.el);
  });

  var dotsEl = document.getElementById('dots');
  BEATS.forEach(function () { dotsEl.appendChild(document.createElement('i')); });
  function paintDots(i) {
    var kids = dotsEl.children;
    for (var n = 0; n < kids.length; n++) {
      kids[n].className = n === i ? 'now' : (n < i ? 'done' : '');
    }
  }

  function indexAt(t) {
    for (var i = BEATS.length - 1; i >= 0; i--) if (t >= BEATS[i].t0) return i;
    return 0;
  }

  // ---------------------------------------------------------------- WebGL
  var renderer = null, scene = null, cam = null;
  var RW = Math.round(W * RES), RH = Math.round(H * RES);
  var rigs = [];
  var screenImages = {};
  var screenTex = {};
  var meta = null;
  var ready3d = false;

  function makeEnvironment() {
    var ec = document.createElement('canvas');
    ec.width = 1024; ec.height = 512;
    var ex = ec.getContext('2d');
    var g = ex.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#6b7280');
    g.addColorStop(.42, '#2a2a31');
    g.addColorStop(.62, '#101014');
    g.addColorStop(1, '#050506');
    ex.fillStyle = g; ex.fillRect(0, 0, 1024, 512);
    var rg = ex.createRadialGradient(300, 120, 10, 300, 120, 220);
    rg.addColorStop(0, 'rgba(255,255,255,.95)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    ex.fillStyle = rg; ex.fillRect(0, 0, 1024, 512);
    var rg2 = ex.createRadialGradient(800, 190, 10, 800, 190, 260);
    rg2.addColorStop(0, 'rgba(255,170,80,.55)');
    rg2.addColorStop(1, 'rgba(255,170,80,0)');
    ex.fillStyle = rg2; ex.fillRect(0, 0, 1024, 512);
    var tex = new THREE.Texture(ec);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    if (THREE.SRGBColorSpace !== undefined && 'colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
    else tex.encoding = THREE.sRGBEncoding;
    tex.needsUpdate = true;
    return tex;
  }

  function initGL() {
    renderer = new THREE.WebGLRenderer({
      canvas: document.getElementById('gl'),
      antialias: false,
      alpha: true,
      preserveDrawingBuffer: false
    });
    renderer.setPixelRatio(1);
    renderer.setSize(RW, RH, false);
    if (THREE.sRGBEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    scene = new THREE.Scene();
    scene.environment = makeEnvironment();

    cam = new THREE.PerspectiveCamera(FOV, W / H, 0.1, 100);
    cam.position.set(0, 0, CAM_Z);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x1a1a20, 1.4));
    var d1 = new THREE.DirectionalLight(0xffffff, 2.2); d1.position.set(-3, 4, 5); scene.add(d1);
    var d2 = new THREE.DirectionalLight(0xff9a45, 1.4); d2.position.set(4, -2, 3); scene.add(d2);
    var d3 = new THREE.DirectionalLight(0x9db8ff, .9); d3.position.set(0, -4, -3); scene.add(d3);
  }

  // Orienta (pantalla hacia +Z), centra y escala el modelo a 1 unidad.
  function prep(root) {
    root.updateWorldMatrix(true, true);
    var screen = null;
    root.traverse(function (o) {
      if (!o.isMesh || !o.material) return;
      var n = Array.isArray(o.material)
        ? o.material.map(function (m) { return m.name || ''; }).join(' ')
        : (o.material.name || '');
      if (/screen/i.test(n)) screen = o;
    });
    var whole = new THREE.Box3().setFromObject(root);
    var cAll = whole.getCenter(new THREE.Vector3());
    var flipX = false;
    if (screen) {
      var sc = new THREE.Box3().setFromObject(screen).getCenter(new THREE.Vector3());
      if (sc.z < cAll.z) { root.rotateY(Math.PI); flipX = true; }
    }
    root.updateWorldMatrix(true, true);
    var box = new THREE.Box3().setFromObject(root);
    var size = box.getSize(new THREE.Vector3());
    var maxDim = Math.max(size.x, size.y, size.z) || 1;
    root.scale.multiplyScalar(1 / maxDim);
    root.updateWorldMatrix(true, true);
    var box2 = new THREE.Box3().setFromObject(root);
    var c2 = box2.getCenter(new THREE.Vector3());
    root.position.sub(c2);

    var uv = null;
    if (screen && screen.geometry && screen.geometry.attributes && screen.geometry.attributes.uv) {
      var a = screen.geometry.attributes.uv;
      var uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
      for (var i = 0; i < a.count; i++) {
        var u = a.getX(i), v = a.getY(i);
        if (u < uMin) uMin = u;
        if (u > uMax) uMax = u;
        if (v < vMin) vMin = v;
        if (v > vMax) vMax = v;
      }
      uv = { uMin: uMin, uMax: uMax, vMin: vMin, vMax: vMax };
    }
    return {
      screen: screen,
      screenGeometry: screen ? screen.geometry : null,
      flipX: flipX,
      uv: uv
    };
  }

  function screenTexture(src) {
    if (screenTex[src]) return screenTex[src];
    var img = screenImages[src];
    if (!img) return null;
    var tex = new THREE.Texture(img);
    tex.flipY = false;
    if (THREE.SRGBColorSpace !== undefined && 'colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
    else tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 1;
    var uv = meta.uv, ru = 1, rv = 1, ou = 0, ov = 0;
    if (uv && uv.uMax > uv.uMin && uv.vMax > uv.vMin) {
      ru = 1 / (uv.uMax - uv.uMin);
      rv = 1 / (uv.vMax - uv.vMin);
      ou = -uv.uMin * ru;
      ov = -uv.vMin * rv;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    }
    if (meta.flipX) { ou = uv ? uv.uMax * ru : 1; ru = -ru; }
    tex.repeat.set(ru, rv);
    tex.offset.set(ou, ov);
    tex.needsUpdate = true;
    screenTex[src] = tex;
    return tex;
  }

  function makeRig(root) {
    var pivot = new THREE.Group();
    scene.add(pivot);
    root.traverse(function (o) {
      if (!o.isMesh) return;
      if (Array.isArray(o.material)) {
        o.material = o.material.map(function (m) { return m.clone(); });
      } else if (o.material) {
        o.material = o.material.clone();
      }
      if (Array.isArray(o.material)) {
        o.material.forEach(function (m) { if (m) m.envMapIntensity = 1.2; });
      } else if (o.material) {
        o.material.envMapIntensity = 1.2;
      }
    });
    var screen = null;
    root.traverse(function (o) {
      if (o.isMesh && o.geometry === meta.screenGeometry) screen = o;
    });
    var screenMat = new THREE.MeshBasicMaterial({ toneMapped: false });
    if (screen) screen.material = screenMat;
    pivot.add(root);
    pivot.scale.setScalar(BASE_SCALE);
    pivot.position.set(0, BASE_Y, 0);
    pivot.visible = false;
    return { pivot: pivot, root: root, screen: screen, screenMat: screenMat, src: null };
  }

  function setRigScreen(rig, src) {
    if (!rig || !rig.screen || rig.src === src) return;
    var tex = screenTexture(src);
    if (!tex) return;
    rig.screenMat.map = tex;
    rig.screenMat.needsUpdate = true;
    rig.src = src;
  }

  function setRigTransform(rig, ein, eout, t, phase) {
    var x = (1 - ein) * ENTRY_PX - eout * EXIT_PX;
    var y = Math.sin(t * 1.1 + phase) * 5 + (1 - ein) * 18;
    var sc = 1 + (1 - ein) * 0.05 - eout * 0.08;
    var rx = (3.2 + Math.sin(t * 0.75 + phase) * 1.2) * Math.PI / 180;
    var ry = (-12 + Math.sin(t * 0.9 + phase) * 2.2 - (1 - ein) * 24 + eout * 38) * Math.PI / 180;
    var rz = (-1 + Math.sin(t * 0.6 + phase) * 0.6) * Math.PI / 180;
    rig.pivot.position.set(x / PX, BASE_Y + y / PX, 0);
    rig.pivot.scale.setScalar(BASE_SCALE * sc);
    rig.pivot.rotation.set(rx, ry, rz);
  }

  // ---------------------------------------------------------- timeline DOM
  function renderAt(time) {
    var t = Math.max(0, Math.min(DUR - 0.0001, Number(time) || 0));
    var active = indexAt(t);
    paintDots(active);

    for (var i = 0; i < BEATS.length; i++) {
      var b = BEATS[i];
      var start = b.t0;
      var end = b.t0 + b.d;
      var last = i === BEATS.length - 1;
      var visible = t >= start && (last || t <= end + 0.9);
      b.el.style.display = visible ? 'block' : 'none';
      if (!visible) continue;

      for (var j = 0; j < b.items.length; j++) {
        var it = b.items[j];
        var pin = clamp((t - start - it.delay) / it.dur);
        var ein = easeOut(pin);

        var pout = 0;
        if (!last) {
          var exitDelay = it.kind === 'mid' ? it.delay : 0;
          pout = clamp((t - end - exitDelay) / it.dur);
        }
        var eout = easeInOut(pout);
        var opacity = ein * (1 - eout);
        var y1 = (1 - ein) * (it.kind === 'copy' ? it.hid : 26) +
                 eout * (it.kind === 'copy' ? 16 : 26);

        it.el.style.opacity = opacity.toFixed(4);
        it.el.style.transform = 'translateY(' + y1.toFixed(3) + 'px)';
      }
    }

    if (!ready3d) return;
    var wanted = [false, false];
    for (var s = 0; s < shots.length; s++) {
      var entry = shots[s];
      var sb = entry.beat;
      var rig = rigs[entry.index % 2];
      if (!rig) continue;
      var st = sb.t0;
      var en = sb.t0 + sb.d;
      var inWindow = t >= st - 0.02 && t <= en + 0.34;
      if (!inWindow) continue;
      setRigScreen(rig, sb.src);
      var pin2 = clamp((t - st - 0.04) / 0.54);
      var ein2 = easeOut(pin2);
      var pout2 = clamp((t - en) / 0.30);
      var eout2 = easeInOut(pout2);
      var x2 = (1 - ein2) * ENTRY_PX - eout2 * EXIT_PX;
      if (x2 >= W * 0.92 || x2 <= -W * 0.92) continue;
      wanted[entry.index % 2] = true;
      setRigTransform(rig, ein2, eout2, t, sb.phase);
    }
    for (var r = 0; r < rigs.length; r++) {
      var rg = rigs[r];
      if (wanted[r] && !rg.pivot.parent) scene.add(rg.pivot);
      if (!wanted[r] && rg.pivot.parent) scene.remove(rg.pivot);
    }

    renderer.render(scene, cam);
  }
  window.renderAt = renderAt;

  window.beginRecording = function () {
    if (window.PROMO_RECORDING) return;
    window.PROMO_RECORDING = true;
    window.PROMO_RECORD_T0 = performance.now();
    if (window.PROMO_START_LOOP) window.PROMO_START_LOOP();
  };

  // ------------------------------------------------------------------ carga
  function loadImage(src) {
    return new Promise(function (ok) {
      var img = new Image();
      img.onload = function () { ok(img); };
      img.onerror = function () { ok(null); };
      img.src = src;
    });
  }

  function loadModel() {
    return new Promise(function (ok, fail) {
      new THREE.GLTFLoader().load('models/apple_iphone_18_pro_max_black_2026.glb',
        function (g) { ok(g.scene); },
        undefined,
        function (e) { fail(new Error('No pude cargar el modelo GLB: ' + e)); });
    });
  }

  function waitFontsAndDomImages() {
    var imgs = [].slice.call(document.images);
    return Promise.all([
      document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve(),
      Promise.all(imgs.map(function (im) {
        return im.complete ? Promise.resolve() : new Promise(function (r) {
          im.addEventListener('load', r);
          im.addEventListener('error', r);
        });
      }))
    ]);
  }

  initGL();

  Promise.all([
    waitFontsAndDomImages(),
    Promise.all(shots.map(function (s) {
      return loadImage(s.beat.src).then(function (img) { screenImages[s.beat.src] = img; });
    }))
  ]).then(function () {
    return loadModel();
  }).then(function (root) {
    meta = prep(root);
    var clones = [root.clone(true), root.clone(true)];
    for (var k = 0; k < clones.length; k++) rigs.push(makeRig(clones[k]));
    ready3d = true;

    // Precompila shaders y sube todas las capturas antes de avisar que está
    // listo. Si no, el primer cambio de pantalla bloquea el hilo principal.
    for (var s = 0; s < shots.length; s++) {
      var rig = rigs[shots[s].index % 2];
      setRigScreen(rig, shots[s].beat.src);
      if (!rig.pivot.parent) scene.add(rig.pivot);
      rig.pivot.visible = true;
      renderer.render(scene, cam);
      rig.pivot.visible = false;
      if (rig.pivot.parent) scene.remove(rig.pivot);
    }

    if (FREEZE !== null) {
      var n = Math.max(0, Math.min(BEATS.length - 1, Number(FREEZE) || 0));
      renderAt(BEATS[n].t0 + Math.min(1.2, BEATS[n].d / 2));
      window.PROMO_READY = true;
      return;
    }

    renderAt(0);
    window.PROMO_READY = true;

    var t0 = performance.now();
    function loop() {
      var t;
      if (window.PROMO_RECORDING) {
        t = (performance.now() - window.PROMO_RECORD_T0) / 1000;
        if (t > DUR) t = DUR;
      } else {
        t = ((performance.now() - t0) / 1000) % DUR;
      }
      renderAt(t);
      requestAnimationFrame(loop);
    }

    window.PROMO_START_LOOP = loop;
    if (RECORD) return;   // queda congelado en t=0 hasta beginRecording()

    var note = document.getElementById('note');
    if (note) {
      note.style.display = 'block';
      note.textContent = 'Vista 3D · ' + DUR + ' s en bucle · ' + BEATS.length + ' pasos';
    }
    loop();
  }).catch(function (err) {
    window.PROMO_ERROR = String(err && err.message || err);
    window.PROMO_READY = true;
    renderAt(0);
  });
})();
