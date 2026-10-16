/* ==========================================================================
   Resto — v3
   Escena 3D con modelos GLB reales (iPhone / iPad / MacBook).
   Se aplica el screenshot de la app sobre el material "Screen" de cada modelo.
   Export del anuncio en PNG 4K con html-to-image.
   ========================================================================== */
(function () {
  'use strict';

  var card     = document.getElementById('card');
  var canvas   = document.getElementById('scene');
  var loading  = document.getElementById('loading');
  var errBox   = document.getElementById('err');
  var MAX_4K   = 3840;   // lado mayor de la exportación (4K)

  function fail(msg) {
    errBox.style.display = 'block';
    errBox.textContent = msg;
    loading.style.display = 'none';
  }

  if (typeof THREE === 'undefined') { fail('No se pudo cargar Three.js (libs/three.min.js).'); return; }
  if (typeof THREE.GLTFLoader === 'undefined') { fail('Falta libs/GLTFLoader.js (recarga con Ctrl+F5).'); return; }

  /* ----------------------------------------------------------- renderer */
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  // El canvas se renderiza SIEMPRE a una resolución fija (lado mayor) y el
  // navegador lo escala a la card por CSS. Así lo que ves es lo que exportas
  // y el screenshot del modelo se muestrea a alta resolución (estilo mockup).
  var RENDER_LONG = 1920;
  if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
  else if (THREE.sRGBEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.setClearAlpha(0);
  var maxAniso = renderer.capabilities.getMaxAnisotropy();

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  camera.position.set(0, 0, 10);

  /* --------------------------------------------------- entorno (reflejos) */
  function makeEnv() {
    var s = new THREE.Scene();
    var box = new THREE.BoxGeometry();
    box.deleteAttribute('uv');
    var room = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ side: THREE.BackSide }));
    room.scale.setScalar(12);
    s.add(room);
    function area(x, y, z, w, h, hex) {
      var m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 1, side: THREE.DoubleSide })
      );
      m.position.set(x, y, z);
      m.lookAt(0, 0, 0);
      s.add(m);
    }
    area(0, 10, 0, 10, 10, 0xffffff);      // cénit
    area(-6, 2, 0, 6, 8, 0xffffff);        // lateral claro
    area(6, 2, 0, 6, 8, 0xc9c9d6);         // lateral gris
    area(0, 0, -8, 10, 8, 0xf3f3f7);       // fondo
    return s;
  }
  var pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(makeEnv(), 0.04).texture;

  /* --------------------------------------------------------------- luces */
  scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe3ea, 0.85));
  var key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(4, 7, 8); scene.add(key);
  var rim = new THREE.DirectionalLight(0xbfd0ff, 0.6); rim.position.set(-6, 2, 4); scene.add(rim);

  /* -------------------------------------------------------------- stage */
  var stage = new THREE.Group();
  scene.add(stage);

  /* ------------------------------------------------------- layout por formato */
  // El texto va a la izquierda (CSS). Los equipos van a la derecha:
  //   hero   = equipo destacado (grande, delante)
  //   behind = los otros dos (pequeños, detrás)
  // p = posición, ry = giro, scale = tamaño del lado mayor del equipo
  var LAYOUT = {
    feed: {
      stage: { scale: 0.90, y: 0.10 },
      hero:   { p: [ 0.90, 0.00,  0.90], ry: -0.05, scale: 3.65 },
      behind: [
        { p: [ 0.10, 0.90, -0.60], ry:  0.34, scale: 1.70 },
        { p: [ 2.25, 0.35, -0.60], ry: -0.36, scale: 1.60 },
        { p: [ 0.05, -0.80, -0.62], ry: -0.28, scale: 1.55 },
        { p: [ 2.40, 1.50, -0.62], ry:  0.30, scale: 1.45 },
        { p: [ 1.15, -1.30, -0.62], ry:  0.00, scale: 1.40 }
      ]
    },
    portrait: {
      stage: { scale: 0.86, y: 0.20 },
      hero:   { p: [ 1.00, 0.10,  0.90], ry: -0.05, scale: 4.05 },
      behind: [
        { p: [ 0.10, 1.10, -0.60], ry:  0.34, scale: 1.75 },
        { p: [ 2.45, 0.50, -0.60], ry: -0.36, scale: 1.65 },
        { p: [ 0.05, -0.85, -0.62], ry: -0.28, scale: 1.60 },
        { p: [ 2.55, 1.65, -0.62], ry:  0.30, scale: 1.50 },
        { p: [ 1.20, -1.45, -0.62], ry:  0.00, scale: 1.45 }
      ]
    },
    reel: {
      stage: { scale: 0.72, y: -0.42 },
      hero:   { p: [ 0.45, 0.10,  0.90], ry: -0.03, scale: 3.70 },
      behind: [
        { p: [-1.05, 0.80, -0.60], ry:  0.32, scale: 1.85 },
        { p: [-0.80, -1.00, -0.50], ry: -0.22, scale: 1.75 },
        { p: [ 1.55,  1.60, -0.62], ry: -0.30, scale: 1.60 },
        { p: [ 1.50, -1.10, -0.62], ry:  0.20, scale: 1.55 },
        { p: [ 0.30,  0.85, -0.62], ry:  0.00, scale: 1.50 }
      ]
    }
  };
  // correcciones de orientación y material de pantalla por equipo.
  // El material de la pantalla cambia según el modelo:
  //   macbook.glb                  -> "Screen"
  //   apple_iphone_18_pro_max.glb  -> "COLOUR_Black_Screen"
  //   galaxy_tab_s8_ultra.glb      -> "Wallpaper"
  var ORIENT = {
    phone:  { screenMat: /screen/i },
    tablet: { screenMat: /screen|wallpaper/i, flipX: false, flipY: true },
    laptop: { screenMat: /screen/i, noFlip: true }   // huawei_*_screen.glb: el LCD es una malla/material propios ("Screen")
  };

  var fmt = 'feed';
  var view = 'all';
  var selftest = false;
  var texFlipY = false;
  try {
    var qs = new URLSearchParams(location.search);
    if (qs.get('fmt')) fmt = qs.get('fmt');
    if (qs.get('view')) view = qs.get('view');
    if (qs.get('focus')) view = qs.get('focus');
    if (qs.get('res')) RENDER_LONG = Math.max(256, parseInt(qs.get('res'), 10) || RENDER_LONG);
    if (qs.get('selftest')) selftest = true;
    if (qs.get('flipy') === '1') texFlipY = true;
  } catch (e) {}

  /* ------------------------------------------------------------ modelos */
  var loader = new THREE.GLTFLoader();
  var devices = {};       // id -> { id, type, label, pivot, root, screen, half, offset, slotP, slotS }
  var deviceOrder = [];   // ids en orden de creación
  var typeCount = {};     // type -> nº de instancias creadas
  var TYPE_LABEL = { phone: 'Móvil', tablet: 'Tablet', laptop: 'PC' };
  var DEVICE_GLB = {
    phone:  'models/apple_iphone_18_pro_max_black_2026.glb',
    tablet: 'models/galaxy_tab_s8_ultra.glb',
    laptop: 'models/huawei_matebook_x_screen.glb'
  };

  function loadGLB(url) {
    return new Promise(function (res, rej) {
      loader.load(url, function (g) { res(g.scene); }, undefined, function (e) { rej(e); });
    });
  }

  // orienta (pantalla hacia +Z), centra y escala el modelo a la unidad
  // (el tamaño real lo fija el slot del LAYOUT vía pivot.scale).
  // opt.noFlip: no aplicar el giro 180 de la heurística.
  // opt.roll:   giro extra en el plano de la pantalla (radianes).
  function prep(root, opt) {
    opt = opt || {};
    root.updateWorldMatrix(true, true);
    var screen = null;
    var matRe = opt.screenMat || /screen/i;
    root.traverse(function (o) {
      if (!o.isMesh || !o.material) return;
      if (opt.meshName) { if (o.name === opt.meshName) screen = o; }
      else if (o.material.name && matRe.test(o.material.name)) screen = o;
    });
    var whole = new THREE.Box3().setFromObject(root);
    var cAll = whole.getCenter(new THREE.Vector3());
    if (screen && !opt.noFlip) {
      var sc = new THREE.Box3().setFromObject(screen).getCenter(new THREE.Vector3());
      if (sc.z < cAll.z) { root.rotateY(Math.PI); root.userData.flipX = true; }
    }
    if (opt.roll) root.rotateZ(opt.roll);
    root.updateWorldMatrix(true, true);
    var box = new THREE.Box3().setFromObject(root);
    var size = box.getSize(new THREE.Vector3());
    var maxDim = Math.max(size.x, size.y, size.z) || 1;
    root.scale.multiplyScalar(1 / maxDim);
    root.updateWorldMatrix(true, true);
    var box2 = new THREE.Box3().setFromObject(root);
    var c2 = box2.getCenter(new THREE.Vector3());
    root.position.sub(c2);
    root.userData.screen = screen;
    if (screen && screen.geometry && screen.geometry.attributes && screen.geometry.attributes.uv) {
      var uv = screen.geometry.attributes.uv;
      var uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
      for (var i = 0; i < uv.count; i++) {
        var u = uv.getX(i), v = uv.getY(i);
        if (u < uMin) uMin = u; if (u > uMax) uMax = u;
        if (v < vMin) vMin = v; if (v > vMax) vMax = v;
      }
      root.userData.screenUV = { uMin: uMin, uMax: uMax, vMin: vMin, vMax: vMax };
    }
    return screen;
  }

  function tintDevice(root) {
    root.traverse(function (o) {
      if (!o.isMesh || !o.material) return;
      var n = o.material.name;
      if (n === 'Frame') {
        o.material = o.material.clone();
        o.material.color.setHex(0x0f172a);
        o.material.metalness = 0.72;
        o.material.roughness = 0.32;
      } else if (n === 'Logo') {
        o.visible = false;
      } else if (n === 'PenBody' || n === 'PenTip') {
        o.visible = false;   // oculta el S-Pen del Galaxy Tab
      }
    });
  }

  function addDevice(type) {
    return loadGLB(DEVICE_GLB[type]).then(function (root) {
      var screen = prep(root, ORIENT[type]);
      tintDevice(root);
      var pivot = new THREE.Group();
      pivot.add(root);
      stage.add(pivot);
      var bb = new THREE.Box3().setFromObject(root);
      var sz = bb.getSize(new THREE.Vector3());
      typeCount[type] = (typeCount[type] || 0) + 1;
      var id = typeCount[type] > 1 ? (type + '-' + typeCount[type]) : type;
      devices[id] = {
        id: id, type: type,
        label: TYPE_LABEL[type] + (typeCount[type] > 1 ? ' ' + typeCount[type] : ''),
        pivot: pivot, root: root, screen: screen,
        half: { x: sz.x / 2, y: sz.y / 2 },
        offset: { x: 0, y: 0 },
        adj: { rx: 0, ry: 0, rz: 0 },
        slotP: { x: 0, y: 0, z: 0 }, slotS: 1
      };
      deviceOrder.push(id);
      applyLayout(false);
      buildScreenRows();
      updateTools();
      return tryAuto(id, AUTO[type]).then(function () { return id; });
    });
  }

  // Modelos cuyo display comparte una única malla/material con el cuerpo
  // (Huawei MateBook): se usa un GLB derivado (huawei_matebook_x_screen.glb)
  // con una malla/material propios para el LCD ("Screen"), de modo que el
  // screenshot se pinta a resolución completa y sin iluminación.

  Promise.all([
    addDevice('phone'),
    addDevice('tablet'),
    addDevice('laptop')
  ]).then(function () {
    applyLayout(true);
    loading.style.display = 'none';
    if (selftest) runSelfTest();
  }).catch(function (e) {
    fail('No se pudieron cargar los modelos GLB. Abre la página con un servidor local (abrir.bat). Detalle: ' + (e && e.message ? e.message : e));
  });

  /* -------------------------------------------------------- imágenes/texturas */
  function makeTexture(img) {
    var tex = new THREE.Texture(img);
    tex.flipY = texFlipY;
    if ('colorSpace' in tex && THREE.SRGBColorSpace !== undefined) tex.colorSpace = THREE.SRGBColorSpace;
    else if (THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = Math.min(16, maxAniso);
    tex.needsUpdate = true;
    return tex;
  }

  function applyScreenshot(id, img) {
    var dev = devices[id];
    if (!dev || !dev.screen) return;
    var mesh = dev.screen;
    var o = ORIENT[dev.type] || {};
    var tex = makeTexture(img);
    var uv = dev.root.userData.screenUV;
    var ru = 1, rv = 1, ou = 0, ov = 0;
    // Ajusta la imagen al rectángulo UV real de la pantalla del modelo
    // (algunos modelos usan solo una franja del atlas, p.ej. la Galaxy Tab).
    if (uv && uv.uMax > uv.uMin && uv.vMax > uv.vMin) {
      ru = 1 / (uv.uMax - uv.uMin);
      rv = 1 / (uv.vMax - uv.vMin);
      ou = -uv.uMin * ru;
      ov = -uv.vMin * rv;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
    }
    var fx = o.flipX;
    if (fx === undefined) fx = dev.root.userData.flipX;
    if (fx) { ou = uv ? uv.uMax * ru : 1; ru = -ru; }
    if (o.flipY) { ov = uv ? uv.vMax * rv : 1; rv = -rv; }
    tex.repeat.set(ru, rv);
    tex.offset.set(ou, ov);
    mesh.material = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  }

  var AUTO = {
    phone:  ['screns/mobile_1.png', 'screns/mobile_2.png', 'mobile_1.png', 'mobile_2.png', 'app-screenshot.png'],
    tablet: ['screns/tablet.jpeg', 'tablet.jpeg', 'app-screenshot.png'],
    laptop: ['screns/pc_screen.png', 'pc_screen.png', 'app-screenshot.png']
  };
  function tryAuto(id, list) {
    return new Promise(function (resolve) {
      if (!list.length) { resolve(); return; }
      var img = new Image();
      img.onload = function () { applyScreenshot(id, img); resolve(); };
      img.onerror = function () { tryAuto(id, list.slice(1)).then(resolve); };
      img.src = list[0];
    });
  }

  // una fila de subida de pantalla por cada equipo (se regenera al añadir uno)
  function buildScreenRows() {
    var host = document.getElementById('screens');
    if (!host) return;
    host.innerHTML = '';
    deviceOrder.forEach(function (id) {
      var d = devices[id];
      var row = document.createElement('div');
      row.className = 'srow';

      var lab = document.createElement('label');
      lab.className = 'upload';
      lab.innerHTML = '<i class="fa fa-image"></i> ' + d.label;
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.hidden = true;
      input.addEventListener('change', function () {
        var f = input.files && input.files[0];
        if (!f) return;
        var url = URL.createObjectURL(f);
        var img = new Image();
        img.onload = function () { applyScreenshot(id, img); URL.revokeObjectURL(url); };
        img.onerror = function () { fail('No se pudo leer la imagen. Usa PNG o JPG.'); };
        img.src = url;
      });
      lab.appendChild(input);
      row.appendChild(lab);
      host.appendChild(row);
    });
  }

  /* ----------------------------------------------------------- animación */
  function visibleIds() {
    return deviceOrder.filter(function (id) { return !!devices[id]; });
  }
  function heroDefault() {
    var ids = visibleIds();
    return ids.length ? ids[0] : 'phone';
  }

  // slot que le toca a cada equipo: el seleccionado (o el primero por defecto)
  // va al hero y los demás a los huecos "behind".
  function slotFor(key) {
    var L = LAYOUT[fmt];
    var heroKey = (view !== 'all' && devices[view]) ? view : heroDefault();
    if (key === heroKey) return L.hero;
    var others = visibleIds().filter(function (k) { return k !== heroKey; });
    var idx = others.indexOf(key);
    return L.behind[idx] || L.behind[L.behind.length - 1];
  }

  // separa los equipos para que sus huellas (proyectadas en el plano de la
  // pantalla) no se solapen: el más ligero empuja y cede más; los de más masa
  // (p.ej. el hero) apenas se mueven.
  function separate(list) {
    for (var it = 0; it < 12; it++) {
      for (var i = 0; i < list.length; i++) {
        for (var j = i + 1; j < list.length; j++) {
          var a = list[i], b = list[j];
          var ox = (a.hx + b.hx) - Math.abs(b.x - a.x);
          var oy = (a.hy + b.hy) - Math.abs(b.y - a.y);
          if (ox <= 0 || oy <= 0) continue;
          var ma = a.hx * a.hy + 1e-4, mb = b.hx * b.hy + 1e-4;
          var wa = mb / (ma + mb), wb = ma / (ma + mb);
          if (ox < oy) {
            var sx = (b.x - a.x) >= 0 ? 1 : -1, px = ox + 0.002;
            a.x -= sx * px * wa; b.x += sx * px * wb;
          } else {
            var sy = (b.y - a.y) >= 0 ? 1 : -1, py = oy + 0.002;
            a.y -= sy * py * wa; b.y += sy * py * wb;
          }
        }
      }
    }
  }

  function applyLayout(instant) {
    var st = LAYOUT[fmt].stage;
    var list = [];
    visibleIds().forEach(function (key) {
      var s = slotFor(key);
      devices[key].pivot.visible = !!s;
      if (!s) return;
      var h = devices[key].half || { x: 0.5, y: 0.5 };
      list.push({ key: key, x: s.p[0], y: s.p[1], z: s.p[2], hx: h.x * s.scale, hy: h.y * s.scale, ry: s.ry, s: s.scale });
    });
    separate(list);
    list.forEach(function (e) {
      var d = devices[e.key];
      d.slotP = { x: e.x, y: e.y, z: e.z };
      d.slotS = e.s;
      var gx = e.x + d.offset.x, gy = e.y + d.offset.y;
      if (instant) {
        d.pivot.position.set(gx, gy, e.z);
        d.pivot.rotation.y = e.ry;
        d.pivot.userData.scale = e.s;
        d.pivot.scale.setScalar(e.s);
      }
      d.pivot.userData.goal = { p: [gx, gy, e.z], ry: e.ry, s: e.s };
    });
    stage.userData.goal = { scale: st.scale, y: st.y };
    if (instant) {
      stage.scale.setScalar(st.scale);
      stage.position.y = st.y;
    }
  }

  var clock = new THREE.Clock();
  var drag = { active: false, x: 0, y: 0, sx: 0, sy: 0, moved: false, ry: 0, rx: 0, tRy: 0, tRx: 0,
               mode: null, id: null, plane: null, localStart: null, pivotStart: null };

  function tick() {
    requestAnimationFrame(tick);
    var t = clock.getElapsedTime();

    Object.keys(devices).forEach(function (key) {
      var d = devices[key];
      var g = d.pivot.userData.goal;
      if (!g) return;
      var a = d.adj || { rx: 0, ry: 0, rz: 0 };
      d.pivot.position.lerp(new THREE.Vector3(g.p[0], g.p[1], g.p[2]), 0.12);
      d.pivot.rotation.x += (a.rx - d.pivot.rotation.x) * 0.12;
      d.pivot.rotation.y += ((g.ry + a.ry) - d.pivot.rotation.y) * 0.12;
      d.pivot.rotation.z += (a.rz - d.pivot.rotation.z) * 0.12;
      var cs = d.pivot.scale.x;
      d.pivot.scale.setScalar(cs + (g.s - cs) * 0.12);
    });

    var sg = stage.userData.goal;
    if (sg) {
      var cs2 = stage.scale.x;
      stage.scale.setScalar(cs2 + (sg.scale - cs2) * 0.12);
      stage.position.y += (sg.y - stage.position.y) * 0.12;
    }
    stage.position.y += Math.sin(t * 1.1) * 0.0016;

    // zoom de cámara (lente/FOV)
    if (typeof camGoalFov === 'number') {
      camera.fov += (camGoalFov - camera.fov) * 0.12;
      camera.updateProjectionMatrix();
    }

    // giro por arrastre
    drag.ry += (drag.tRy - drag.ry) * 0.08;
    drag.rx += (drag.tRx - drag.rx) * 0.08;
    stage.rotation.y = drag.ry;
    stage.rotation.x = drag.rx;

    renderer.render(scene, camera);
  }

  /* ------------------------------------------------------------- resize */
  // Fija el buffer del 3D a `long` en su lado mayor, conservando el aspecto de
  // la card. No toca el tamaño CSS (el canvas sigue al 100% y lo escala el navegador).
  function sizeRenderer(long) {
    var w = card.clientWidth, h = card.clientHeight;
    if (!w || !h) return;
    var s = long / Math.max(w, h);
    renderer.setSize(Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s)), false);
  }
  function resize() {
    var w = card.clientWidth, h = card.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    sizeRenderer(RENDER_LONG);
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(card);
  window.addEventListener('resize', resize);
  resize();

  /* ------------------------------------------------------------- arrastre */
  var raycaster = new THREE.Raycaster();
  var ndc = new THREE.Vector2();

  function keyForObject(obj) {
    var found = null;
    Object.keys(devices).forEach(function (key) {
      var o = obj;
      while (o) { if (o === devices[key].root) { found = key; break; } o = o.parent; }
    });
    return found;
  }
  function deviceAt(clientX, clientY) {
    var rc = canvas.getBoundingClientRect();
    ndc.x = ((clientX - rc.left) / rc.width) * 2 - 1;
    ndc.y = -((clientY - rc.top) / rc.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    var roots = Object.keys(devices)
      .filter(function (k) { return devices[k].pivot.visible; })
      .map(function (k) { return devices[k].root; });
    var hit = raycaster.intersectObjects(roots, true)[0];
    return hit ? keyForObject(hit.object) : null;
  }
  function setView(v) {
    view = (v === 'all' || devices[v]) ? v : 'all';
    Array.prototype.forEach.call(document.querySelectorAll('[data-view]'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-view') === view);
    });
    applyLayout(false);
    updateTools();
  }

  // punto de la escena (coordenadas locales del stage) bajo el cursor,
  // proyectado sobre el plano de arrastre.
  var planeN = new THREE.Vector3();
  var tmpQ = new THREE.Quaternion();
  var tmpP = new THREE.Vector3();
  function localOnPlane(clientX, clientY) {
    var rc = canvas.getBoundingClientRect();
    ndc.x = ((clientX - rc.left) / rc.width) * 2 - 1;
    ndc.y = -((clientY - rc.top) / rc.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    if (!raycaster.ray.intersectPlane(drag.plane, tmpP)) return null;
    return stage.worldToLocal(tmpP.clone());
  }

  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  canvas.addEventListener('pointerdown', function (e) {
    drag.active = true; drag.x = e.clientX; drag.y = e.clientY;
    drag.sx = e.clientX; drag.sy = e.clientY; drag.moved = false;
    drag.mode = 'rotate'; drag.id = null;

    // arrastrar = mover el equipo bajo el cursor; Shift o botón derecho = girar
    if (e.button === 2 || e.shiftKey) return;
    var key = deviceAt(e.clientX, e.clientY);
    if (!key) return;
    var d = devices[key];
    stage.getWorldQuaternion(tmpQ);
    planeN.set(0, 0, 1).applyQuaternion(tmpQ);
    d.pivot.getWorldPosition(tmpP);
    drag.plane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeN.clone(), tmpP.clone());
    var local = localOnPlane(e.clientX, e.clientY);
    if (!local) return;
    drag.mode = 'move'; drag.id = key;
    drag.localStart = local;
    drag.pivotStart = { x: d.slotP.x + d.offset.x, y: d.slotP.y + d.offset.y };
  });

  window.addEventListener('pointerup', function (e) {
    if (!drag.active) return;
    drag.active = false;
    var mode = drag.mode, id = drag.id, moved = drag.moved;
    drag.mode = null; drag.id = null;
    if (moved) return;
    if (mode === 'move' && id) setView(view === id ? 'all' : id);
    else if (mode === 'rotate' && view !== 'all') setView('all');
  });

  window.addEventListener('pointermove', function (e) {
    if (!drag.active) return;
    if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 6) drag.moved = true;
    if (drag.mode === 'move' && drag.id) {
      var local = localOnPlane(e.clientX, e.clientY);
      if (local) {
        var d = devices[drag.id];
        var nx = drag.pivotStart.x + (local.x - drag.localStart.x);
        var ny = drag.pivotStart.y + (local.y - drag.localStart.y);
        d.offset.x = nx - d.slotP.x;
        d.offset.y = ny - d.slotP.y;
        d.pivot.position.x = nx; d.pivot.position.y = ny;
        if (d.pivot.userData.goal) { d.pivot.userData.goal.p[0] = nx; d.pivot.userData.goal.p[1] = ny; }
      }
    } else {
      drag.tRy += (e.clientX - drag.x) * 0.006;
      drag.tRx += (e.clientY - drag.y) * 0.004;
      drag.tRx = Math.max(-0.5, Math.min(0.5, drag.tRx));
    }
    drag.x = e.clientX; drag.y = e.clientY;
  });

  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && view !== 'all') setView('all');
  });

  /* -------------------------------------------------------- botones UI */
  function setActive(selector, btn) {
    Array.prototype.forEach.call(document.querySelectorAll(selector), function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-fmt]'), function (b) {
    b.addEventListener('click', function () {
      fmt = b.getAttribute('data-fmt');
      card.className = 'card fmt-' + fmt + (card.classList.contains('show-safe') ? ' show-safe' : '');
      setActive('[data-fmt]', b);
      applyLayout(false);
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-view]'), function (b) {
    b.addEventListener('click', function () { setView(b.getAttribute('data-view')); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-add]'), function (b) {
    b.addEventListener('click', function () {
      var t = b.getAttribute('data-add');
      b.disabled = true;
      addDevice(t).then(function () { b.disabled = false; })
        .catch(function (e) { b.disabled = false; fail('No se pudo añadir el equipo: ' + (e && e.message ? e.message : e)); });
    });
  });
  var safe = document.getElementById('safe');
  if (safe) safe.addEventListener('change', function () { card.classList.toggle('show-safe', safe.checked); });

  /* ------------------------------------- tools del modelo seleccionado */
  var DEG = Math.PI / 180;
  var modelTools = document.getElementById('model-tools');
  var toolsTitle = document.getElementById('model-tools-title');
  var sliders = {
    rx: document.getElementById('rot-x'),
    ry: document.getElementById('rot-y'),
    rz: document.getElementById('rot-z')
  };
  var outs = {
    rx: document.getElementById('rot-x-v'),
    ry: document.getElementById('rot-y-v'),
    rz: document.getElementById('rot-z-v')
  };

  function currentAdj() {
    var d = devices[view];
    return (view !== 'all' && d) ? d.adj : null;
  }
  function updateOut() {
    if (!outs.rx) return;
    outs.rx.textContent = sliders.rx.value + '\u00B0';
    outs.ry.textContent = sliders.ry.value + '\u00B0';
    outs.rz.textContent = sliders.rz.value + '\u00B0';
  }
  function updateTools() {
    if (!modelTools) return;
    var d = currentAdj();
    if (!d) { modelTools.hidden = true; return; }
    modelTools.hidden = false;
    if (toolsTitle) toolsTitle.textContent = 'Ajustar: ' + devices[view].label;
    sliders.rx.value = Math.round(d.rx / DEG);
    sliders.ry.value = Math.round(d.ry / DEG);
    sliders.rz.value = Math.round(d.rz / DEG);
    updateOut();
  }
  function bindSlider(el, key) {
    if (!el) return;
    el.addEventListener('input', function () {
      var d = currentAdj();
      updateOut();
      if (!d) return;
      d[key] = (parseFloat(el.value) || 0) * DEG;
    });
  }
  bindSlider(sliders.rx, 'rx');
  bindSlider(sliders.ry, 'ry');
  bindSlider(sliders.rz, 'rz');

  var modelReset = document.getElementById('model-reset');
  if (modelReset) modelReset.addEventListener('click', function () {
    var d = currentAdj();
    if (!d) return;
    d.rx = d.ry = d.rz = 0;
    updateTools();
  });

  /* --------------------------------------------- zoom de cámara (FOV) */
  var camBaseFov = camera.fov;
  var camGoalFov = camera.fov;
  function fovFromZoom(v) { return Math.max(10, Math.min(64, camBaseFov - v * 0.22)); }
  var camZoom = document.getElementById('cam-zoom');
  var camZoomOut = document.getElementById('cam-zoom-v');
  function updateCamOut() {
    if (!camZoomOut) return;
    var v = parseInt(camZoom.value, 10) || 0;
    camZoomOut.textContent = (v > 0 ? '+' : '') + v;
  }
  if (camZoom) camZoom.addEventListener('input', function () {
    camGoalFov = fovFromZoom(parseFloat(camZoom.value) || 0);
    updateCamOut();
  });
  var camReset = document.getElementById('cam-reset');
  if (camReset) camReset.addEventListener('click', function () {
    if (!camZoom) return;
    camZoom.value = 0;
    camGoalFov = camBaseFov;
    updateCamOut();
  });
  updateCamOut();

  updateTools();


  // estado inicial (permite ?fmt=reel&view=laptop)
  card.className = 'card fmt-' + fmt;
  Array.prototype.forEach.call(document.querySelectorAll('[data-fmt]'), function (b) { b.classList.toggle('active', b.getAttribute('data-fmt') === fmt); });
  Array.prototype.forEach.call(document.querySelectorAll('[data-view]'), function (b) { b.classList.toggle('active', b.getAttribute('data-view') === view); });

  /* ------------------------------------------------------------- export */
  function exportPNG() {
    if (typeof htmlToImage === 'undefined') { fail('Falta libs/html-to-image.js (recarga con Ctrl+F5).'); return; }
    var w = card.clientWidth, h = card.clientHeight;
    var ratio = MAX_4K / Math.max(w, h);
    sizeRenderer(MAX_4K);
    renderer.render(scene, camera);
    var data = renderer.domElement.toDataURL('image/png');
    sizeRenderer(RENDER_LONG);
    renderer.render(scene, camera);

    var img = new Image();
    img.style.cssText = 'position:absolute;inset:0;z-index:1;width:100%;height:100%;';
    img.onload = function () {
      canvas.style.visibility = 'hidden';
      card.appendChild(img);
      htmlToImage.toPng(card, { pixelRatio: ratio, cacheBust: true })
        .then(function (url) {
          var a = document.createElement('a');
          a.download = 'resto-v3-' + fmt + '.png';
          a.href = url;
          a.click();
        })
        .catch(function (e) { fail('No se pudo exportar: ' + (e && e.message ? e.message : e)); })
        .then(function () {
          card.removeChild(img);
          canvas.style.visibility = '';
          sizeRenderer(RENDER_LONG);
          renderer.render(scene, camera);
        });
    };
    img.src = data;
  }
  document.getElementById('snap').addEventListener('click', exportPNG);

  // autotest headless: exporta 4K y publica las dimensiones resultantes
  function runSelfTest() {
    var w = card.clientWidth, h = card.clientHeight;
    var ratio = MAX_4K / Math.max(w, h);
    sizeRenderer(MAX_4K);
    renderer.render(scene, camera);
    var data = renderer.domElement.toDataURL('image/png');
    var img = new Image();
    img.style.cssText = 'position:absolute;inset:0;z-index:1;width:100%;height:100%;';
    img.onload = function () {
      canvas.style.visibility = 'hidden';
      card.appendChild(img);
      htmlToImage.toPng(card, { pixelRatio: ratio, cacheBust: true }).then(function (url) {
        var probe = new Image();
        probe.onload = function () {
          var out = 'SELFTEST ok ' + probe.naturalWidth + 'x' + probe.naturalHeight + ' card=' + w + 'x' + h + ' fmt=' + fmt;
          var el = document.createElement('div');
          el.id = 'selftest';
          el.textContent = out;
          el.style.cssText = 'position:fixed;left:0;top:0;z-index:9999;background:#0f0;color:#000;font:12px monospace;padding:2px 4px;';
          document.body.appendChild(el);
          document.title = out;
        };
        probe.onerror = function () { document.title = 'SELFTEST img error'; };
        probe.src = url;
      }).catch(function (e) {
        document.title = 'SELFTEST export error ' + (e && e.message ? e.message : e);
      });
    };
    img.onerror = function () { document.title = 'SELFTEST canvas error'; };
    img.src = data;
  }

  /* ---------------------------------------------------------------- go */
  resize();
  applyLayout(true);
  tick();
})();


