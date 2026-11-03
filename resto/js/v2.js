/* ==========================================================================
   Resto — v2 (versión única: junta v3 + v4)
   Escena 3D con modelos GLB reales (iPhone / iPad / MacBook).
   Incluye selector de textos de CTA y export nativo para los 3 tamaños.
   Se aplica el screenshot de la app sobre el material "Screen" de cada modelo.
   Export del anuncio en PNG 4K con html-to-image.
   ========================================================================== */
(function () {
  'use strict';

  var card     = document.getElementById('card');
  var canvas   = document.getElementById('scene');
  var loading  = document.getElementById('loading');
  var errBox   = document.getElementById('err');

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
  // "phones" = cascada elegante de 3 móviles del MISMO tamaño (con solape);
  // al usarla no se aplica la separación automática.
  var LAYOUT = {
    feed: {
      stage: { scale: 0.78, y: 0.12 },
      hero:   { p: [ 1.46, 0.04, 0.95], ry: -0.05, scale: 3.38 },
      behind: [
        { p: [ 1.02, 1.02, -0.55], ry:  0.34, scale: 1.40 },
        { p: [ 1.42, -0.88, -0.55], ry: -0.26, scale: 1.40 }
      ],
      phones: {
        hero:   { p: [ 1.86, 0.66, 0.70], ry: -0.16, scale: 2.14 },
        behind: [
          { p: [ 1.26, 0.02, 0.20], ry:  0.02, scale: 2.14 },
          { p: [ 0.66, -0.62, -0.30], ry:  0.20, scale: 2.14 }
        ]
      }
    },
    portrait: {
      stage: { scale: 0.82, y: 0.06 },
      hero:   { p: [ 1.34, 0.00, 0.95], ry: -0.05, scale: 3.34 },
      behind: [
        { p: [ 0.98, 1.06, -0.55], ry:  0.34, scale: 1.40 },
        { p: [ 1.42, -0.98, -0.55], ry: -0.24, scale: 1.40 }
      ],
      phones: {
        hero:   { p: [ 1.84, 0.82, 0.70], ry: -0.16, scale: 2.28 },
        behind: [
          { p: [ 1.24, 0.10, 0.20], ry:  0.02, scale: 2.28 },
          { p: [ 0.64, -0.62, -0.30], ry:  0.20, scale: 2.28 }
        ]
      }
    },
    reel: {
      stage: { scale: 0.68, y: -0.44 },
      hero:   { p: [ 0.58, 0.04, 0.95], ry: -0.05, scale: 2.92 },
      behind: [
        { p: [-1.02, 0.86, -0.60], ry:  0.32, scale: 1.56 },
        { p: [ 0.94, -0.94, -0.60], ry: -0.26, scale: 1.48 }
      ],
      phones: {
        hero:   { p: [ 0.46, 1.42, 0.70], ry: -0.12, scale: 2.40 },
        behind: [
          { p: [ 0.12, 0.52, 0.20], ry:  0.04, scale: 2.40 },
          { p: [-0.20, -0.38, -0.30], ry:  0.16, scale: 2.40 }
        ]
      }
    }
  };
  // Aspecto de cada formato y media altura visible del plano z=0 (para el
  // recorte automático). fov de cámara por defecto = 32°, distancia = 10.
  var ASPECT = { feed: 1, portrait: 4 / 5, reel: 9 / 16 };
  var CAM_HALF0 = Math.tan(32 * Math.PI / 360) * 10;   // ~2.867
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
  var sel = null;      // equipo objetivo de las herramientas (clic), no cambia el layout
  var selftest = false;
  var texFlipY = false;
  var videoVRes = 0;   // tope opcional del lado mayor del vídeo (?vres=)
  var autorec = false; // grabación automática de la ventana (Electron)
  var videoDur = 0;    // duración del vídeo (?vdur=)
  try {
    var qs = new URLSearchParams(location.search);
    if (qs.get('fmt')) fmt = qs.get('fmt');
    if (qs.get('view')) view = qs.get('view');
    if (qs.get('focus')) view = qs.get('focus');
    if (qs.get('res')) RENDER_LONG = Math.max(256, parseInt(qs.get('res'), 10) || RENDER_LONG);
    if (qs.get('vres')) videoVRes = Math.max(160, parseInt(qs.get('vres'), 10) || 0);
    if (qs.get('selftest')) selftest = true;
    if (qs.get('flipy') === '1') texFlipY = true;
    if (qs.get('autorec')) autorec = true;
    if (qs.get('vdur')) videoDur = Math.max(2, Math.min(60, parseInt(qs.get('vdur'), 10) || 0));
    if (qs.get('wintitle')) { try { document.title = qs.get('wintitle'); } catch (e) {} }
  } catch (e) {}

  /* ------------------------------------------------------------ modelos */
  var loader = new THREE.GLTFLoader();
  var devices = {};       // id -> { id, type, label, pivot, root, screen, half, slotP, slotS, mem }
  var typeCount = {};     // type -> nº de instancias creadas (global, no se reinicia)
  // Cada formato tiene su PROPIA memoria: orden de equipos, vista, selección
  // y, por equipo, offset + ajustes. Al cambiar de formato se conserva todo.
  var fmtState = {};      // fmt -> { order: [], view: 'all', sel: null, init: false }
  var HEADLINES = [
    { a: 'Tu restaurante merece una forma', em: 'más fácil', c: 'de trabajar.' },
    { a: 'Todo tu restaurante, en',       em: 'una sola app', c: '.' },
    { a: 'Gestiona mesas, cocina y caja', em: 'desde una app', c: '.' },
    { a: 'Menos papel,',                  em: 'más sabor',     c: ' en tu restaurante.' },
    { a: 'Tu restaurante,',               em: 'conectado en tiempo real', c: '.' },
    { a: 'Desde el pedido hasta la caja:', em: 'todo en una app', c: '.' },
    { a: '',                              em: 'Cobra rápido, cuadra el turno', c: ' sin errores.' },
    { a: 'Meseros, cocina y caja',        em: 'en la misma aplicación', c: '.' }
  ];
  var headlineIdx = 0;
  function setHeadline(i, persist) {
    if (i < 0 || i >= HEADLINES.length) return;
    headlineIdx = i;
    var h = HEADLINES[i];
    var elA = document.getElementById('h1-a');
    var elEm = document.getElementById('h1-em');
    var elC = document.getElementById('h1-c');
    if (elA) elA.textContent = h.a;
    if (elEm) elEm.textContent = h.em;
    if (elC) elC.textContent = h.c;
    Array.prototype.forEach.call(document.querySelectorAll('[data-headline]'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-headline') == String(i));
    });
    if (persist !== false) saveState();
  }

  function F(f) {
    f = f || fmt;
    if (!fmtState[f]) fmtState[f] = { order: [], view: 'all', sel: null, init: false };
    return fmtState[f];
  }
  function blankMem() {
    return { offset: { x: 0, y: 0 }, adj: { rx: 0, ry: 0, rz: 0, dz: 0, sc: 1 } };
  }
  function cloneMem(m) {
    return { offset: { x: m.offset.x, y: m.offset.y },
             adj: { rx: m.adj.rx, ry: m.adj.ry, rz: m.adj.rz, dz: m.adj.dz, sc: m.adj.sc } };
  }
  function M(d) {          // memoria (offset + ajustes) del formato actual para el equipo d
    if (!d.mem) d.mem = {};
    if (!d.mem[fmt]) d.mem[fmt] = blankMem();
    return d.mem[fmt];
  }
  function stillUsed(id, except) {
    for (var f in fmtState) {
      if (f === except) continue;
      if (fmtState[f].order.indexOf(id) >= 0) return true;
    }
    return false;
  }
  // Persistencia por formato en localStorage (base de datos del navegador).
  // Guarda, para CADA formato, qué equipos tiene su escena y su posición/
  // escala/giro/selección. Al recargar se reconstruyen todos los formatos tal
  // cual los dejaste. Cada formato es totalmente independiente del resto.
  var LS_KEY = 'resto_v2_state_v3';
  var pendingState = null;
  function loadState() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) pendingState = JSON.parse(raw);
    } catch (e) { pendingState = null; }
  }
  // Empaqueta TODO el diseño: posiciones/giros/escalas (mem), qué equipos hay,
  // qué screenshot usa cada uno y el texto (headline) elegido.
  function serialize(includeDataUrls) {
    var types = {}, mems = {}, screens = {};
    Object.keys(devices).forEach(function (id) {
      var d = devices[id];
      if (!d) return;
      types[id] = d.type;
      if (d.mem) mems[id] = d.mem;
      if (d.screenSrc && (includeDataUrls || d.screenSrc.indexOf('data:') !== 0)) screens[id] = d.screenSrc;
    });
    return {
      app: 'app-promo-v2', version: 1,
      order: fmtState, types: types, mems: mems, screens: screens,
      design: design, headlineIdx: headlineIdx
    };
  }
  function saveState() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(serialize(false))); } catch (e) {}
  }
  // reconstruye TODA la escena desde un objeto de diseño (JSON o localStorage)
  function clearStage() {
    Object.keys(devices).forEach(function (id) {
      if (devices[id] && devices[id].pivot) stage.remove(devices[id].pivot);
    });
    devices = {};
    typeCount = {};
  }
  function applyScreenSrc(id, src) {
    return new Promise(function (resolve) {
      if (!src) { resolve(); return; }
      var img = new Image();
      img.onload = function () { applyScreenshot(id, img, src); resolve(); };
      img.onerror = function () { resolve(); };
      img.src = src;
    });
  }
  function applyState(state) {
    if (!state || !state.types || !Object.keys(state.types).length) return setDesign(design);
    loadingScene = true;
    clearStage();
    fmtState = state.order || {};
    if (state.design && DESIGNS[state.design]) design = state.design;
    if (state.headlineIdx !== undefined && state.headlineIdx !== null && !isNaN(state.headlineIdx)) headlineIdx = parseInt(state.headlineIdx, 10);
    if (qsHead !== null) headlineIdx = qsHead;                  // ?headline= gana al estado guardado
    var types = state.types;
    var ids = Object.keys(types);
    return Promise.all(ids.map(function (id) {
      return createDevice(types[id], id).then(function () {
        if (state.screens && state.screens[id]) return applyScreenSrc(id, state.screens[id]);
        return autoScreen(id, types[id]);
      });
    })).then(function () {
      ids.forEach(function (id) {
        if (state.mems && state.mems[id] && devices[id]) devices[id].mem = state.mems[id];
      });
      ensureTypeCounts();
      loadingScene = false;
      if (sel && !devices[sel]) sel = null;
      var st = F();
      if (!st.order.length) { markDesign(); return setDesign(design); }
      buildScreenRows();
      applyLayout(true);
      updateTools();
      markDesign();
      setHeadline(headlineIdx);
      return null;
    }).catch(function (e) { loadingScene = false; throw e; });
  }
  var TYPE_LABEL = { phone: 'Móvil', tablet: 'Tablet', laptop: 'PC' };
  var DEVICE_GLB = {
    phone:  'models/apple_iphone_18_pro_max_black_2026.glb',
    tablet: 'models/galaxy_tab_s8_ultra.glb',
    laptop: 'models/huawei_matebook_x_screen.glb'
  };
  // Diseños listos para exportar (el primero es el protagonista). Mismos
  // modelos; solo cambia cuántos y cuáles se muestran. Elegir un diseño
  // recrea los equipos con ajustes limpios.
  var DESIGNS = {
    trio:   ['phone', 'tablet', 'laptop'],
    phones: ['phone', 'phone', 'phone'],
    duo:    ['phone', 'tablet'],
    solo:   ['phone']
  };
  var design = 'trio';

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

  // crea la malla 3D de un equipo y la registra en `devices` con un id dado.
  function createDevice(type, id, label) {
    return loadGLB(DEVICE_GLB[type]).then(function (root) {
      var screen = prep(root, ORIENT[type]);
      tintDevice(root);
      var pivot = new THREE.Group();
      pivot.add(root);
      stage.add(pivot);
      var bb = new THREE.Box3().setFromObject(root);
      var sz = bb.getSize(new THREE.Vector3());
      var suf = /-(\d+)$/.exec(id);
      devices[id] = {
        id: id, type: type,
        label: label || (TYPE_LABEL[type] + (suf ? ' ' + suf[1] : '')),
        pivot: pivot, root: root, screen: screen,
        half: { x: sz.x / 2, y: sz.y / 2 },
        mem: null,   // memorias por formato; las crea M(d) al usarse
        slotP: { x: 0, y: 0, z: 0 }, slotS: 1
      };
      return id;
    });
  }

  function nextId(type) {
    typeCount[type] = (typeCount[type] || 0) + 1;
    return typeCount[type] > 1 ? (type + '-' + typeCount[type]) : type;
  }

  function addDevice(type) {
    var n = (typeCount[type] || 0) + 1;                 // nº de esta instancia
    var id = nextId(type);
    var label = TYPE_LABEL[type] + (n > 1 ? ' ' + n : '');
    return createDevice(type, id, label).then(function () {
      F().order.push(id);
      applyLayout(false);
      buildScreenRows();
      updateTools();
      saveState();
      return autoScreen(id, type).then(function () { return id; });
    });
  }

  // aplica una captura por defecto a la pantalla del equipo (varía entre móviles)
  function autoScreen(id, type) {
    var autos = AUTO[type] || [];
    if (type === 'phone' && autos.length > 1) {
      var m = /-(\d+)$/.exec(id);
      var n = m ? parseInt(m[1], 10) : 1;
      var off = (n - 1) % autos.length;
      autos = autos.slice(off).concat(autos.slice(0, off));
    }
    return tryAuto(id, autos);
  }

  // Modelos cuyo display comparte una única malla/material con el cuerpo
  // (Huawei MateBook): se usa un GLB derivado (huawei_matebook_x_screen.glb)
  // con una malla/material propios para el LCD ("Screen"), de modo que el
  // screenshot se pinta a resolución completa y sin iluminación.

  var loadingScene = false;

  function clearDevices() {
    // vacía solo el formato actual; los otros conservan sus equipos y memoria.
    // (typeCount no se reinicia para no repetir ids entre formatos)
    var st = F();
    st.order.forEach(function (id) {
      var d = devices[id];
      if (d && d.mem) delete d.mem[fmt];
      if (d && !stillUsed(id, fmt)) {
        if (d.pivot) stage.remove(d.pivot);
        delete devices[id];
      }
    });
    st.order = [];
    st.view = 'all'; st.sel = null;
    sel = null;
    view = 'all';
  }

  // elimina un equipo de la escena (p. ej. el seleccionado en el panel)
  function removeDevice(id) {
    var d = devices[id];
    if (!d) return;
    // se quita solo del formato actual; si otro formato lo usa, se conserva
    var st = F();
    var ix = st.order.indexOf(id);
    if (ix >= 0) st.order.splice(ix, 1);
    if (!stillUsed(id, null)) {
      if (d.pivot) stage.remove(d.pivot);
      delete devices[id];
    }
    if (sel === id) { sel = null; st.sel = null; }
    if (view === id) {
      view = 'all';
      F().view = 'all';
      Array.prototype.forEach.call(document.querySelectorAll('[data-view]'), function (b) {
        b.classList.toggle('active', b.getAttribute('data-view') === 'all');
      });
    }
    applyLayout(false);
    buildScreenRows();
    updateTools();
    saveState();
  }

  // duplica un equipo tal como está: misma posición, giro y escala visibles.
  // Como el clon cae en otro slot, se compensan offset/ajustes para que
  // quede exactamente sobre el original; luego se puede arrastrar.
  function duplicateDevice(id) {
    var src = devices[id];
    if (!src) return Promise.resolve(null);
    var srcM = M(src);
    var srcS = src.slotS || 1;
    var srcSc = srcM.adj.sc || 1;
    var spx = src.pivot.position.x, spy = src.pivot.position.y, spz = src.pivot.position.z;
    var srx = src.pivot.rotation.x, sry = src.pivot.rotation.y, srz = src.pivot.rotation.z;
    return addDevice(src.type).then(function (newId) {
      var d = devices[newId];
      if (!d) return newId;
      var ns = d.slotP || { x: 0, y: 0, z: 0 };
      var nss = d.slotS || 1;
      var m = M(d);
      m.offset.x = spx - ns.x;
      m.offset.y = spy - ns.y;
      m.adj.rx = srx;
      m.adj.rz = srz;
      var goal = d.pivot.userData.goal;
      var gry = (goal && typeof goal.ry === 'number') ? goal.ry : 0;
      m.adj.ry = sry - gry;
      m.adj.dz = spz - ns.z;
      m.adj.sc = nss ? (srcS * srcSc) / nss : 1;
      sel = newId;
      applyLayout(false);
      updateTools();
      saveState();
      return newId;
    });
  }

  function setDesign(id) {
    if (loadingScene) return;
    if (!DESIGNS[id]) id = 'trio';
    design = id;
    Array.prototype.forEach.call(document.querySelectorAll('[data-design]'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-design') === id);
      b.disabled = true;
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-view]'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-view') === 'all');
    });
    loadingScene = true;
    clearDevices();
    applyLayout(false);
    updateTools();
    return Promise.all(DESIGNS[id].map(function (t) { return addDevice(t); })).then(function () {
      applyLayout(true);
      loadingScene = false;
      Array.prototype.forEach.call(document.querySelectorAll('[data-design]'), function (b) { b.disabled = false; });
      saveState();
    });
  }

  // --- arranque: reconstruye el estado guardado o crea la escena por defecto ---
  var qsDesign = null, qsSel = null, qsHead = null;
  try {
    var qsParams = new URLSearchParams(location.search);
    qsDesign = qsParams.get('design') || qsParams.get('scene');
    qsSel = qsParams.get('sel');
    var qsHeadline = qsParams.get('headline');
    if (qsHeadline !== null && !isNaN(qsHeadline)) { qsHead = parseInt(qsHeadline, 10); headlineIdx = qsHead; }
  } catch (e) {}

  // ajusta typeCount para que los ids nuevos no choquen con los reconstruidos
  function ensureTypeCounts() {
    Object.keys(devices).forEach(function (id) {
      var d = devices[id];
      var m = /-(\d+)$/.exec(id);
      var n = m ? parseInt(m[1], 10) : 1;
      if (!typeCount[d.type] || typeCount[d.type] < n) typeCount[d.type] = n;
    });
  }
  function markDesign() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-design]'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-design') === design);
    });
  }

  function initScene() {
    loadState();
    // Grabación (Electron): escena limpia y determinista, sin estado guardado
    // de sesiones anteriores (que descuadraba tamaños/posiciones).
    if (autorec) {
      try { localStorage.removeItem(LS_KEY); } catch (e) {}
      pendingState = null; design = 'trio';
      return setDesign('trio');
    }
    if (qsDesign) design = qsDesign;                          // ?design= fuerza el diseño
    else if (pendingState && pendingState.design && DESIGNS[pendingState.design]) design = pendingState.design;
    if (pendingState && pendingState.types && Object.keys(pendingState.types).length) {
      return applyState(pendingState);                        // reconstruye lo guardado
    }
    return setDesign(design);                                 // primera visita: escena por defecto
  }

  initScene().then(function () {
    if (qsSel && devices[qsSel]) { sel = qsSel; F().sel = sel; updateTools(); }
    setHeadline(headlineIdx);
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

  function applyScreenshot(id, img, src) {
    var dev = devices[id];
    if (!dev || !dev.screen) return;
    dev.screenSrc = src || img.src;   // se guarda en el JSON para poder restaurarlo
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
    phone:  ['screns/mobile_1.png', 'screns/mobile_2.png'],
    tablet: ['screns/tablet.jpeg'],
    laptop: ['screns/pc_screen.png']
  };
  function tryAuto(id, list) {
    return new Promise(function (resolve) {
      if (!list.length) { resolve(); return; }
      var img = new Image();
      img.onload = function () { applyScreenshot(id, img, list[0]); resolve(); };
      img.onerror = function () { tryAuto(id, list.slice(1)).then(resolve); };
      img.src = list[0];
    });
  }

  // una fila de subida de pantalla por cada equipo (se regenera al añadir uno)
  function buildScreenRows() {
    var host = document.getElementById('screens');
    if (!host) return;
    host.innerHTML = '';
    F().order.forEach(function (id) {
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
        var fr = new FileReader();
        fr.onload = function () {
          var dataUrl = fr.result;
          var img = new Image();
          img.onload = function () { applyScreenshot(id, img, dataUrl); };
          img.onerror = function () { fail('No se pudo leer la imagen. Usa PNG o JPG.'); };
          img.src = dataUrl;
        };
        fr.onerror = function () { fail('No se pudo leer el archivo.'); };
        fr.readAsDataURL(f);
      });
      lab.appendChild(input);
      row.appendChild(lab);
      host.appendChild(row);
    });
  }

  /* ----------------------------------------------------------- animación */
  function visibleIds() {
    return F().order.filter(function (id) { return !!devices[id]; });
  }
  function heroDefault() {
    var ids = visibleIds();
    return ids.length ? ids[0] : 'phone';
  }

  // slots activos: el diseño "3 móviles" usa sus huecos propios (mismo tamaño)
  function activeSlots() {
    var L = LAYOUT[fmt];
    if (design === 'phones' && L.phones) return L.phones;
    return L;
  }

  // media altura/ancho del encuadre visible en el plano z (unidades de stage)
  function frameHalf(z) {
    var st = LAYOUT[fmt].stage;
    var halfH = CAM_HALF0 * (Math.max(1, 10 - (z || 0)) / 10) / st.scale;
    return { h: halfH, w: halfH * (ASPECT[fmt] || 1) };
  }
  // escala que hace que la huella del equipo ocupe fillW/fillH del encuadre
  function fitScale(d, fillW, fillH) {
    var z = (d.slotP && d.slotP.z) || 0.9;
    var f = frameHalf(z);
    var h = d.half || { x: 0.5, y: 0.5 };
    var sW = (fillW * f.w) / Math.max(1e-3, h.x);
    var sH = (fillH * f.h) / Math.max(1e-3, h.y);
    return Math.min(sW, sH);
  }

  // slot que le toca a cada equipo: el seleccionado (o el primero por defecto)
  // va al hero y los demás a los huecos "behind".
  function slotFor(key) {
    var L = activeSlots();
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

  // encaja los slots dentro del encuadre visible para que ningún equipo se
  // recorte por los bordes (solo afecta a las posiciones por defecto; el
  // arrastre manual posterior puede moverlo libremente).
  function clampSlots(list) {
    var st = LAYOUT[fmt].stage;
    var asp = ASPECT[fmt] || 1;
    list.forEach(function (e) {
      var dist = Math.max(1, 10 - e.z);
      var halfH = CAM_HALF0 * (dist / 10) / st.scale;
      var halfW = halfH * asp;
      var mx = Math.max(0, halfW * 0.98 - e.hx);
      var my = Math.max(0, halfH * 0.98 - e.hy);
      e.x = Math.max(-mx, Math.min(mx, e.x));
      e.y = Math.max(-my, Math.min(my, e.y));
    });
  }

  function applyLayout(instant) {
    var st = LAYOUT[fmt].stage;
    var list = [];
    // oculta los equipos que no pertenecen al formato actual
    var ids = visibleIds();
    Object.keys(devices).forEach(function (id) {
      if (ids.indexOf(id) < 0 && devices[id].pivot) devices[id].pivot.visible = false;
    });
    ids.forEach(function (key) {
      var s = slotFor(key);
      devices[key].pivot.visible = !!s;
      if (!s) return;
      var h = devices[key].half || { x: 0.5, y: 0.5 };
      list.push({ key: key, x: s.p[0], y: s.p[1], z: s.p[2], hx: h.x * s.scale, hy: h.y * s.scale, ry: s.ry, s: s.scale });
    });
    // el diseño "3 móviles" lleva solape elegante por diseño: no separar
    if (design !== 'phones') separate(list);
    clampSlots(list);
    list.forEach(function (e) {
      var d = devices[e.key];
      d.slotP = { x: e.x, y: e.y, z: e.z };
      d.slotS = e.s;
      var mm = M(d);
      var gx = e.x + mm.offset.x, gy = e.y + mm.offset.y;
      if (instant) {
        d.pivot.position.set(gx, gy, e.z);
        d.pivot.rotation.y = e.ry;
        d.pivot.userData.scale = e.s;
        d.pivot.scale.setScalar(e.s * (mm.adj.sc || 1));
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
      var mm = M(d);
      var a = mm.adj || { rx: 0, ry: 0, rz: 0, dz: 0, sc: 1 };
      d.pivot.position.lerp(new THREE.Vector3(g.p[0], g.p[1], g.p[2] + (a.dz || 0)), 0.12);
      d.pivot.rotation.x += (a.rx - d.pivot.rotation.x) * 0.12;
      d.pivot.rotation.y += ((g.ry + a.ry) - d.pivot.rotation.y) * 0.12;
      d.pivot.rotation.z += (a.rz - d.pivot.rotation.z) * 0.12;
      var ts = g.s * (a.sc || 1);
      var cs = d.pivot.scale.x;
      d.pivot.scale.setScalar(cs + (ts - cs) * 0.12);
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
    if (v !== 'all') sel = v;
    var st = F();
    st.view = view; st.sel = sel;
    Array.prototype.forEach.call(document.querySelectorAll('[data-view]'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-view') === view);
    });
    applyLayout(false);
    updateTools();
    saveState();
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
    var mm = M(d);
    drag.pivotStart = { x: d.slotP.x + mm.offset.x, y: d.slotP.y + mm.offset.y };
  });

  window.addEventListener('pointerup', function (e) {
    if (!drag.active) return;
    drag.active = false;
    var mode = drag.mode, id = drag.id, moved = drag.moved;
    drag.mode = null; drag.id = null;
    var st = F();
    if (moved) { if (mode === 'move') saveState(); return; }
    if (mode === 'move' && id) { sel = (sel === id) ? null : id; st.sel = sel; } 
    else if (mode === 'rotate' && sel) { sel = null; st.sel = null; }
    st.view = view; updateTools();
    saveState();
  });

  window.addEventListener('pointermove', function (e) {
    if (!drag.active) return;
    if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 6) drag.moved = true;
    if (drag.mode === 'move' && drag.id) {
      var local = localOnPlane(e.clientX, e.clientY);
      if (local) {
        var d = devices[drag.id];
        var mm = M(d);
        var nx = drag.pivotStart.x + (local.x - drag.localStart.x);
        var ny = drag.pivotStart.y + (local.y - drag.localStart.y);
        mm.offset.x = nx - d.slotP.x;
        mm.offset.y = ny - d.slotP.y;
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
    if (e.key === 'Escape' && sel) { sel = null; F().sel = null; F().view = view; updateTools(); }
  });

  /* -------------------------------------------------------- botones UI */
  function setActive(selector, btn) {
    Array.prototype.forEach.call(document.querySelectorAll(selector), function (b) { b.classList.remove('active'); });
    if (btn) btn.classList.add('active');
  }
  // cambia de formato: cada formato es una escena INDEPENDIENTE con sus propios
  // equipos. Si el formato aún no tiene escena, se crea una por defecto nueva.
  function selectFormat(nf) {
    var stCur = F();
    stCur.sel = sel;
    stCur.view = view;
    fmt = nf;
    var stN = F();
    sel = stN.sel; view = stN.view;
    card.className = 'card fmt-' + fmt + (card.classList.contains('show-safe') ? ' show-safe' : '');
    setActive('[data-fmt]', document.querySelector('[data-fmt="' + fmt + '"]'));
    setActive('[data-view]', document.querySelector('[data-view="' + view + '"]'));
    updateSnapLabel();
    var live = stN.order.filter(function (id) { return !!devices[id]; });
    if (!live.length) return setDesign(design);          // primera visita: escena nueva
    buildScreenRows();                                   // lista de pantallas del formato
    applyLayout(false);
    updateTools();
    saveState();
    return Promise.resolve(null);
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-fmt]'), function (b) {
    b.addEventListener('click', function () { selectFormat(b.getAttribute('data-fmt')); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-view]'), function (b) {
    b.addEventListener('click', function () { setView(b.getAttribute('data-view')); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-design]'), function (b) {
    b.addEventListener('click', function () { setDesign(b.getAttribute('data-design')); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-headline]'), function (b) {
    b.addEventListener('click', function () { setHeadline(parseInt(b.getAttribute('data-headline'), 10)); });
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
  var DZ_UNIT = 0.08;   // unidades de mundo por paso del slider de zoom del objeto
  var modelTools = document.getElementById('model-tools');
  var toolsTitle = document.getElementById('model-tools-title');
  var sliders = {
    dz: document.getElementById('zoom'),
    sc: document.getElementById('scale'),
    rx: document.getElementById('rot-x'),
    ry: document.getElementById('rot-y'),
    rz: document.getElementById('rot-z')
  };
  var outs = {
    dz: document.getElementById('zoom-v'),
    sc: document.getElementById('scale-v'),
    rx: document.getElementById('rot-x-v'),
    ry: document.getElementById('rot-y-v'),
    rz: document.getElementById('rot-z-v')
  };

  function currentAdj() {
    var d = devices[sel];
    return d ? M(d).adj : null;
  }
  function updateOut() {
    if (!outs.rx) return;
    outs.rx.textContent = sliders.rx.value + '\u00B0';
    outs.ry.textContent = sliders.ry.value + '\u00B0';
    outs.rz.textContent = sliders.rz.value + '\u00B0';
    if (outs.dz) {
      var zv = parseFloat(sliders.dz.value) || 0;
      outs.dz.textContent = (zv > 0 ? '+' : '') + zv;
    }
    if (outs.sc) outs.sc.textContent = sliders.sc.value + '%';
  }
  function updateTools() {
    if (!modelTools) return;
    var d = currentAdj();
    if (!d) { modelTools.hidden = true; return; }
    modelTools.hidden = false;
    if (toolsTitle) toolsTitle.textContent = 'Ajustar: ' + devices[sel].label;
    sliders.dz.value = Math.round(d.dz / DZ_UNIT);
    sliders.sc.value = Math.round((d.sc || 1) * 100);
    sliders.rx.value = Math.round(d.rx / DEG);
    sliders.ry.value = Math.round(d.ry / DEG);
    sliders.rz.value = Math.round(d.rz / DEG);
    updateOut();
  }
  function bindSlider(el, key, factor) {
    if (!el) return;
    el.addEventListener('input', function () {
      var d = currentAdj();
      updateOut();
      if (!d) return;
      d[key] = (parseFloat(el.value) || 0) * (factor || DEG);
    });
    el.addEventListener('change', function () { saveState(); });
  }
  bindSlider(sliders.dz, 'dz', DZ_UNIT);
  bindSlider(sliders.sc, 'sc', 0.01);
  bindSlider(sliders.rx, 'rx');
  bindSlider(sliders.ry, 'ry');
  bindSlider(sliders.rz, 'rz');

  var modelReset = document.getElementById('model-reset');
  if (modelReset) modelReset.addEventListener('click', function () {
    var d = currentAdj();
    if (!d) return;
    d.rx = d.ry = d.rz = d.dz = 0;
    d.sc = 1;
    updateTools();
    saveState();
  });

  var modelDelete = document.getElementById('model-delete');
  if (modelDelete) modelDelete.addEventListener('click', function () {
    if (sel && devices[sel]) removeDevice(sel);
  });

  var modelDup = document.getElementById('model-duplicate');
  if (modelDup) modelDup.addEventListener('click', function () {
    if (!(sel && devices[sel])) return;
    modelDup.disabled = true;
    duplicateDevice(sel).then(function () { modelDup.disabled = false; })
      .catch(function (e) { modelDup.disabled = false; fail('No se pudo duplicar el equipo: ' + (e && e.message ? e.message : e)); });
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
  F().sel = sel;

  /* ------------------------------------------------------------- export */
  // Tamaño nativo por plataforma (Instagram / Facebook / TikTok / Reels)
  var EXPORT = {
    feed:     { w: 1080, h: 1080 },
    portrait: { w: 1080, h: 1350 },
    reel:     { w: 1080, h: 1920 }
  };
  var EXPORT_SS = 2;       // supersampling del 3D al exportar (más nítido)
  var ext = 'png';         // png | jpg
  var exporting = false;

  function updateSnapLabel() {
    var b = document.getElementById('snap');
    var s = EXPORT[fmt];
    if (b) b.innerHTML = '<i class="fa fa-camera"></i> Descargar ' + s.w + '\u00D7' + s.h;
  }

  // Renderiza la card en `targetFmt` SIN tocar lo que se ve en pantalla:
  //  - el 3D se dibuja en un renderer FUERA de pantalla (no parpadea ni mueve nada)
  //  - el DOM se captura sobre un clon oculto de la card
  // Así el archivo sale idéntico a la vista previa de ese formato.
  function snapshotScene() {
    var s = {
      fmt: fmt, camAspect: camera.aspect, camFov: camera.fov,
      stageScale: stage.scale.x, stageY: stage.position.y,
      stageGoal: stage.userData.goal ? { scale: stage.userData.goal.scale, y: stage.userData.goal.y } : null,
      devs: {}
    };
    Object.keys(devices).forEach(function (id) {
      var d = devices[id];
      if (!d || !d.pivot) return;
      s.devs[id] = {
        px: d.pivot.position.x, py: d.pivot.position.y, pz: d.pivot.position.z,
        rx: d.pivot.rotation.x, ry: d.pivot.rotation.y, rz: d.pivot.rotation.z,
        sc: d.pivot.scale.x, vis: d.pivot.visible,
        goal: d.pivot.userData.goal ? { p: d.pivot.userData.goal.p.slice(), ry: d.pivot.userData.goal.ry, s: d.pivot.userData.goal.s } : null,
        slotP: d.slotP ? { x: d.slotP.x, y: d.slotP.y, z: d.slotP.z } : null,
        slotS: d.slotS
      };
    });
    return s;
  }
  function restoreScene(s) {
    fmt = s.fmt;
    camera.aspect = s.camAspect; camera.fov = s.camFov; camera.updateProjectionMatrix();
    stage.scale.setScalar(s.stageScale); stage.position.y = s.stageY;
    stage.userData.goal = s.stageGoal;
    Object.keys(s.devs).forEach(function (id) {
      var d = devices[id]; if (!d || !d.pivot) return;
      var v = s.devs[id];
      d.pivot.position.set(v.px, v.py, v.pz);
      d.pivot.rotation.set(v.rx, v.ry, v.rz);
      d.pivot.scale.setScalar(v.sc);
      d.pivot.visible = v.vis;
      d.pivot.userData.goal = v.goal;
      d.slotP = v.slotP; d.slotS = v.slotS;
    });
  }

  // captura el DOM en un clon oculto dimensionado al tamaño exacto de export
  function captureClone(targetFmt, w, h, dataUrl, cb) {
    var host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;z-index:-1;';
    var clone = card.cloneNode(true);
    clone.classList.remove('fmt-feed', 'fmt-portrait', 'fmt-reel');
    clone.classList.add('fmt-' + targetFmt);
    clone.style.cssText = 'position:relative;left:0;top:0;margin:0;border-radius:0;' +
      'box-shadow:none;width:' + w + 'px;height:' + h + 'px;max-width:none;';
    var cc = clone.querySelector('canvas');
    if (cc && cc.parentNode) cc.parentNode.removeChild(cc);
    var img = document.createElement('img');
    img.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;z-index:1;';
    clone.appendChild(img);
    host.appendChild(clone);
    document.body.appendChild(host);
    function cleanup() { if (host.parentNode) host.parentNode.removeChild(host); }
    img.onload = function () {
      var job = ext === 'jpg'
        ? htmlToImage.toJpeg(clone, { pixelRatio: 1, quality: 0.95, cacheBust: true })
        : htmlToImage.toPng(clone, { pixelRatio: 1, cacheBust: true });
      job.then(function (url) { cleanup(); cb(null, url); })
         .catch(function (e) { cleanup(); cb(e); });
    };
    img.onerror = function () { cleanup(); cb(new Error('No se pudo leer el render 3D.')); };
    img.src = dataUrl;
  }

  // Export FIEL para el formato que ya está en pantalla: captura la card EN VIVO
  // tal cual, sin clon, sin cambiar cámara ni layout. Solo sube la resolución del
  // 3D (visualmente idéntico) → el archivo sale igual que la vista previa.
  function renderLive(targetFmt, cb) {
    var size = EXPORT[targetFmt];
    var w = size.w, h = size.h;
    var cw = card.clientWidth || w, ch = card.clientHeight || h;
    var ratio = w / cw;
    sizeRenderer(Math.max(w, h) * EXPORT_SS);
    renderer.render(scene, camera);
    var data = renderer.domElement.toDataURL('image/png');
    sizeRenderer(RENDER_LONG);
    renderer.render(scene, camera);
    var img = new Image();
    img.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;z-index:1;';
    function done(url, err) {
      if (img.parentNode) card.removeChild(img);
      canvas.style.visibility = '';
      if (err) cb(err);
      else cb(null, url, 'resto-' + targetFmt + '-' + w + 'x' + h + '.' + ext);
    }
    img.onload = function () {
      canvas.style.visibility = 'hidden';
      card.appendChild(img);
      var job = ext === 'jpg'
        ? htmlToImage.toJpeg(card, { pixelRatio: ratio, quality: 0.95, cacheBust: true })
        : htmlToImage.toPng(card, { pixelRatio: ratio, cacheBust: true });
      job.then(function (url) { done(url); }).catch(function (e) { done(null, e); });
    };
    img.onerror = function () { done(null, new Error('No se pudo leer el render 3D.')); };
    img.src = data;
  }

  function renderClone(targetFmt, cb) {
    var size = EXPORT[targetFmt];
    var w = size.w, h = size.h;

    // 1) 3D con el layout del formato destino, renderizado y restaurado en el
    //    mismo instante (el navegador no llega a pintar el estado intermedio,
    //    así que la vista previa NO cambia en absoluto).
    var snap = snapshotScene();
    fmt = targetFmt;
    renderer.setPixelRatio(1);
    renderer.setSize(Math.round(w * EXPORT_SS), Math.round(h * EXPORT_SS), false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    applyLayout(true);
    renderer.render(scene, camera);
    var data = renderer.domElement.toDataURL('image/png');
    restoreScene(snap);                 // vuelve exactamente a como estaba
    resize();                           // restaura el buffer de la vista previa
    renderer.render(scene, camera);

    // 2) DOM en un clon oculto (no se ve afectada la card real)
    captureClone(targetFmt, w, h, data, function (err, url) {
      cb(err, url, 'resto-' + targetFmt + '-' + w + 'x' + h + '.' + ext);
    });
  }

  // Al exportar el formato actual se captura la card en vivo (idéntica a la vista).
  // Para los otros formatos (Exportar todo) se reconstruye en un clon oculto.
  function renderAd(targetFmt, cb) {
    if (typeof htmlToImage === 'undefined') { cb(new Error('Falta libs/html-to-image.js (recarga con Ctrl+F5).')); return; }
    if (targetFmt === fmt) return renderLive(targetFmt, cb);
    return renderClone(targetFmt, cb);
  }

  function saveUrl(url, name) {
    var a = document.createElement('a');
    a.download = name;
    a.href = url;
    a.click();
  }

  function exportOne(targetFmt, done) {
    renderAd(targetFmt, function (err, url, name) {
      if (err) {
        fail('No se pudo exportar: ' + (err && err.message ? err.message : err));
        if (done) done(err);
        return;
      }
      saveUrl(url, name);
      if (done) done();
    });
  }

  var ALL_LABEL = '<i class="fa fa-camera"></i> Exportar todo (3)';
  function exportAll() {
    if (exporting) return;
    exporting = true;
    var list = ['feed', 'portrait', 'reel'];
    var snap = document.getElementById('snap');
    var btn = document.getElementById('snap-all');
    var zipBtn = document.getElementById('snap-zip');
    if (snap) snap.disabled = true;
    if (btn) btn.disabled = true;
    if (zipBtn) zipBtn.disabled = true;
    var entries = [], i = 0;
    function finishUp() {
      exporting = false;
      if (snap) snap.disabled = false;
      if (btn) { btn.disabled = false; btn.innerHTML = ALL_LABEL; }
      if (zipBtn) zipBtn.disabled = false;
    }
    function step() {
      if (i >= list.length) {
        var url;
        try { url = URL.createObjectURL(buildZip(entries)); }
        catch (e) { finishUp(); fail('No se pudo crear el ZIP: ' + (e && e.message ? e.message : e)); return; }
        saveUrl(url, 'resto-3-formatos.zip');
        setTimeout(function () { URL.revokeObjectURL(url); }, 8000);
        finishUp();
        return;
      }
      var f = list[i];
      if (btn) btn.innerHTML = '<i class="fa fa-camera"></i> Exportando ' + (i + 1) + '/' + list.length + '\u2026';
      renderOne(f, function (err, res) {
        if (err) { finishUp(); fail('No se pudo exportar: ' + (err && err.message ? err.message : err)); return; }
        var s = EXPORT[f];
        entries.push({ name: 'resto_' + f + '_' + s.w + 'x' + s.h + '.' + ext, data: dataUrlToBytes(res.url) });
        i++;
        setTimeout(step, 60);
      });
    }
    step();
  }

  var snapBtn = document.getElementById('snap');
  if (snapBtn) snapBtn.addEventListener('click', function () { if (!exporting) exportOne(fmt); });
  var snapAll = document.getElementById('snap-all');
  if (snapAll) snapAll.addEventListener('click', exportAll);

  /* --------------------------------- exportar los 8 textos × 3 en un ZIP */
  // envuelve renderAd en una promesa con { url, fmt }
  function renderOne(targetFmt, cb) {
    renderAd(targetFmt, function (err, url) {
      if (err) cb(err); else cb(null, { url: url, fmt: targetFmt });
    });
  }
  // data URL (base64) -> bytes
  function dataUrlToBytes(u) {
    var comma = u.indexOf(',');
    var bin = atob(u.slice(comma + 1));
    var n = bin.length, out = new Uint8Array(n);
    for (var k = 0; k < n; k++) out[k] = bin.charCodeAt(k);
    return out;
  }
  // ZIP (método "store": las imágenes ya vienen comprimidas)
  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(u8) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function u16(v) { return [v & 0xFF, (v >>> 8) & 0xFF]; }
  function u32(v) { return [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF]; }
  function buildZip(entries, when) {
    var chunks = [], central = [], offset = 0;
    var d = when || new Date();
    var dosTime = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF;
    var dosDate = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
    entries.forEach(function (e) {
      var name = new TextEncoder().encode(e.name);
      var crc = crc32(e.data), size = e.data.length;
      var head = new Uint8Array([].concat(
        u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(dosTime), u16(dosDate),
        u32(crc), u32(size), u32(size), u16(name.length), u16(0)));
      chunks.push(head, name, e.data);
      central.push({ name: name, crc: crc, size: size, offset: offset });
      offset += head.length + name.length + size;
    });
    var cdStart = offset;
    central.forEach(function (c) {
      var hdr = new Uint8Array([].concat(
        u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(dosTime), u16(dosDate),
        u32(c.crc), u32(c.size), u32(c.size), u16(c.name.length), u16(0), u16(0),
        u16(0), u16(0), u32(0), u32(c.offset)));
      chunks.push(hdr, c.name);
      offset += hdr.length + c.name.length;
    });
    var cdSize = offset - cdStart;
    chunks.push(new Uint8Array([].concat(
      u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length),
      u32(cdSize), u32(cdStart), u16(0))));
    return new Blob(chunks, { type: 'application/zip' });
  }

  var ZIP_LABEL = '<i class="fa fa-camera"></i> Exportar 8 textos \u00D7 3 (ZIP)';
  function exportTextsZip() {
    if (exporting) return;
    exporting = true;
    var btn = document.getElementById('snap-zip');
    var snap = document.getElementById('snap');
    var snapAllBtn = document.getElementById('snap-all');
    if (snap) snap.disabled = true;
    if (snapAllBtn) snapAllBtn.disabled = true;
    if (btn) btn.disabled = true;
    var origHeadline = headlineIdx, origFmt = fmt;
    var fmts = ['feed', 'portrait', 'reel'];
    var entries = [], total = HEADLINES.length * fmts.length, done = 0, i = 0, j = 0;
    function finishUp() {
      exporting = false;
      if (snap) snap.disabled = false;
      if (snapAllBtn) snapAllBtn.disabled = false;
      if (btn) { btn.disabled = false; btn.innerHTML = ZIP_LABEL; }
    }
    function finish() {
      var url;
      try { url = URL.createObjectURL(buildZip(entries)); }
      catch (e) { finishUp(); fail('No se pudo crear el ZIP: ' + (e && e.message ? e.message : e)); return; }
      saveUrl(url, 'resto-8-textos-3-formatos.zip');
      setTimeout(function () { URL.revokeObjectURL(url); }, 8000);
      setHeadline(origHeadline, true);                 // restaura el estado visible
      if (origFmt !== fmt) selectFormat(origFmt);
      finishUp();
    }
    function step() {
      if (i >= HEADLINES.length) { finish(); return; }
      if (j >= fmts.length) { i++; j = 0; step(); return; }
      if (btn) btn.innerHTML = '<i class="fa fa-camera"></i> Exportando texto ' + (i + 1) + '/' +
        HEADLINES.length + ' \u00B7 ' + (j + 1) + '/' + fmts.length + '\u2026';
      setHeadline(i, false);
      var f = fmts[j];
      setTimeout(function () {
        renderOne(f, function (err, res) {
          if (err) { finishUp(); fail('No se pudo exportar: ' + (err && err.message ? err.message : err)); return; }
          var s = EXPORT[f];
          entries.push({ name: 'resto_' + (i + 1 < 10 ? '0' : '') + (i + 1) + '_' + f + '_' + s.w + 'x' + s.h + '.' + ext,
                         data: dataUrlToBytes(res.url) });
          done++; j++;
          if (btn) btn.innerHTML = '<i class="fa fa-camera"></i> Exportando ' + done + '/' + total + '\u2026';
          setTimeout(step, 50);
        });
      }, 60);
    }
    step();
  }
  var snapZip = document.getElementById('snap-zip');
  if (snapZip) snapZip.addEventListener('click', exportTextsZip);

  /* ------------------------------------------ exportar vídeo (bucle 4 s) */
  function pickMime() {
    if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) return false;
    var cands = ['video/mp4;codecs=avc1.42E01E', 'video/mp4',
                 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    for (var i = 0; i < cands.length; i++) if (MediaRecorder.isTypeSupported(cands[i])) return cands[i];
    return 'video/webm';
  }
  // capa estática SIN canvas: 'under' = solo fondo; 'over' = texto con alfa
  function makeLayer(targetFmt, w, h, mode, cb) {
    var host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;z-index:-1;';
    var clone = card.cloneNode(true);
    clone.classList.remove('fmt-feed', 'fmt-portrait', 'fmt-reel');
    clone.classList.add('fmt-' + targetFmt);
    clone.classList.add(mode === 'under' ? 'rec-plain' : 'rec-nobg');
    clone.style.cssText = 'position:relative;left:0;top:0;margin:0;border-radius:0;box-shadow:none;width:' + w + 'px;height:' + h + 'px;max-width:none;' +
      (mode === 'over' ? 'background:transparent;' : '');
    var cc = clone.querySelector('canvas');
    if (cc && cc.parentNode) cc.parentNode.removeChild(cc);
    if (mode === 'under') {
      ['.topbar', '.headline', '.pills', '.cta', '.safezone', '.loading', '.err'].forEach(function (sel) {
        var el = clone.querySelector(sel); if (el) el.style.visibility = 'hidden';
      });
    }
    host.appendChild(clone); document.body.appendChild(host);
    function cleanup() { if (host.parentNode) host.parentNode.removeChild(host); }
    htmlToImage.toPng(clone, { pixelRatio: 1, cacheBust: true })
      .then(function (url) { cleanup(); cb(null, url); })
      .catch(function (e) { cleanup(); cb(e); });
  }
  function loadImg(src) {
    return new Promise(function (res, rej) {
      var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = src;
    });
  }

  var VIDEO_SECONDS = videoDur || 30;
  var VIDEO_LABEL = '<i class="fa fa-camera"></i> Descargar v\u00EDdeo (' + VIDEO_SECONDS + ' s)';
  function exportVideo() {
    if (exporting) return;
    if (window.promoRec && window.promoRec.getSource) { exportVideoElectron(VIDEO_SECONDS); return; }
    var mime = pickMime();
    if (!mime) { fail('Este navegador no permite grabar v\u00EDdeo (MediaRecorder/captureStream).'); return; }
    exporting = true;
    var btn = document.getElementById('snap-video');
    var snap = document.getElementById('snap');
    var snapAllBtn = document.getElementById('snap-all');
    var zipBtn = document.getElementById('snap-zip');
    [snap, snapAllBtn, zipBtn, btn].forEach(function (b) { if (b) b.disabled = true; });
    function finishUp() {
      exporting = false;
      [snap, snapAllBtn, zipBtn].forEach(function (b) { if (b) b.disabled = false; });
      if (btn) { btn.disabled = false; btn.innerHTML = VIDEO_LABEL; }
    }
    var targetFmt = fmt, ex = EXPORT[targetFmt], w = ex.w, h = ex.h;
    if (videoVRes) { var vsc = videoVRes / Math.max(w, h); if (vsc < 1) { w = Math.round(w * vsc); h = Math.round(h * vsc); } }
    var DUR = VIDEO_SECONDS, FPS = 30;
    if (btn) btn.innerHTML = '<i class="fa fa-camera"></i> Preparando\u2026';

    makeLayer(targetFmt, w, h, 'under', function (e1, underUrl) {
      if (e1) { finishUp(); fail('No se pudo preparar el v\u00EDdeo: ' + (e1 && e1.message ? e1.message : e1)); return; }
      makeLayer(targetFmt, w, h, 'over', function (e2, overUrl) {
        if (e2) { finishUp(); fail('No se pudo preparar el v\u00EDdeo: ' + (e2 && e2.message ? e2.message : e2)); return; }
        Promise.all([loadImg(underUrl), loadImg(overUrl)]).then(function (imgs) {
          record(imgs[0], imgs[1]);
        }).catch(function () { finishUp(); fail('No se pudieron cargar las capas del v\u00EDdeo.'); });
      });
    });

    function record(under, over) {
      var rc = document.createElement('canvas'); rc.width = w; rc.height = h;
      var ctx = rc.getContext('2d');
      var rec;
      try {
        rec = new MediaRecorder(rc.captureStream(FPS), { mimeType: mime, videoBitsPerSecond: 8000000 });
      } catch (err) { finishUp(); fail('No se pudo iniciar la grabaci\u00F3n de v\u00EDdeo.'); return; }
      var chunks = [];
      rec.ondataavailable = function (ev) { if (ev.data && ev.data.size) chunks.push(ev.data); };
      rec.onerror = function () { restore(); finishUp(); fail('Fall\u00F3 la grabaci\u00F3n de v\u00EDdeo.'); };
      rec.onstop = function () {
        var type = (rec.mimeType || mime).split(';')[0];
        var extv = type.indexOf('mp4') >= 0 ? 'mp4' : 'webm';
        var url = URL.createObjectURL(new Blob(chunks, { type: type }));
        saveUrl(url, 'resto-video-' + targetFmt + '-' + w + 'x' + h + '.' + extv);
        setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
        restore();
        finishUp();
      };

      var snapScene = snapshotScene();
      var savedRy = drag.tRy, savedRx = drag.tRx, savedFov = camGoalFov;
      fmt = targetFmt;
      renderer.setPixelRatio(1);
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      applyLayout(true);
      renderer.render(scene, camera);

      function restore() {
        restoreScene(snapScene);
        drag.tRy = savedRy; drag.tRx = savedRx; camGoalFov = savedFov;
        resize();
        renderer.render(scene, camera);
      }

      rec.start();
      var t0 = performance.now();
      function frame() {
        var t = (performance.now() - t0) / 1000;
        if (t >= DUR) { rec.stop(); return; }
        var k = t / DUR;
        drag.tRy = savedRy + Math.sin(t * 0.9) * 0.05;               // vaiv\u00E9n
        drag.tRx = savedRx + Math.sin(t * 0.6 + 1) * 0.012;
        camGoalFov = camBaseFov - 1.2 - Math.sin(Math.PI * k) * 1.6; // acercamiento
        renderer.render(scene, camera);
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(under, 0, 0, w, h);
        ctx.drawImage(renderer.domElement, 0, 0, w, h);
        var a = Math.min(1, t / 0.7); a = 1 - Math.pow(1 - a, 3);    // entrada del texto
        ctx.globalAlpha = a;
        ctx.drawImage(over, 0, 0, w, h);
        ctx.globalAlpha = 1;
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }
  }

  /* Graba la VENTANA de Electron (desktopCapturer) — píxeles compuestos
     (DOM + WebGL) a la velocidad real, sin recomponer por frame en JS.
     Sale mucho más suave que el path de canvas. */

  // --- Director de escenas del vídeo -------------------------------------
  // Cada escena elige QUÉ modelos se ven, su captura de pantalla (2D), si se
  // muestra la UI/texto y el zoom. Cortes limpios, tipo spot publicitario.
  // SIEMPRE un único equipo por plano (móvil, tablet o PC), nunca uno pequeño
  // detrás de otro: el equipo ocupa todo el espacio libre del encuadre.
  // Capturas horizontales en la tablet (tablet_1/tablet_2 son verticales).
  var VIDEO_SCENES = [
    { types: ['phone'],  screens: { phone: 'screns/mobile_1.png' },    ui: true,  zoom: 0.9, head: 0 },
    { types: ['tablet'], screens: { tablet: 'screns/tablet.jpeg' },    ui: false, zoom: 0.3 },
    { types: ['laptop'], screens: { laptop: 'screns/pc_screen_2.png' }, ui: true,  zoom: 0.9, head: 2 },
    { types: ['phone'],  screens: { phone: 'screns/mobile_2.png' },    ui: false, zoom: 0.3 },
    { types: ['tablet'], screens: { tablet: 'screns/tablet.jpeg' },    ui: true,  zoom: 0.9, head: 4, fill: { reel: { w: 0.9, center: true } } },
    { types: ['laptop'], screens: { laptop: 'screns/pc_screen_1.png' }, ui: false, zoom: 0.3 },
    { types: ['phone'],  screens: { phone: 'screns/mobile_1.png' },    ui: true,  zoom: 0.9, head: 6 },
    { types: ['tablet'], screens: { tablet: 'screns/tablet.jpeg' },    ui: false, zoom: 0.3 }
  ];

  function idOfType(type) {
    var ids = Object.keys(devices);
    for (var i = 0; i < ids.length; i++) if (devices[ids[i]].type === type) return ids[i];
    return null;
  }
  function loadImgEl(src) {
    return new Promise(function (res, rej) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = rej; im.src = src; });
  }

  function exportVideoElectron(seconds) {
    if (exporting) return;
    exporting = true;
    var btn = document.getElementById('snap-video');
    var snap = document.getElementById('snap');
    var snapAllBtn = document.getElementById('snap-all');
    var zipBtn = document.getElementById('snap-zip');
    [snap, snapAllBtn, zipBtn, btn].forEach(function (b) { if (b) b.disabled = true; });
    if (btn) btn.innerHTML = '<i class="fa fa-camera"></i> Preparando\u2026';

    var ex = EXPORT[fmt], w = ex.w, h = ex.h;
    if (videoVRes) { var vsc = videoVRes / Math.max(w, h); if (vsc < 1) { w = Math.round(w * vsc); h = Math.round(h * vsc); } }
    var DUR = seconds, mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
      .filter(function (m) { return MediaRecorder.isTypeSupported(m); })[0];
    var savedRy = drag.tRy, savedRx = drag.tRx, savedFov = camGoalFov;
    var savedHead = headlineIdx;
    var hlEl = card.querySelector('.headline');

    var N = Math.max(1, Math.min(VIDEO_SCENES.length, Math.round(DUR / 3.75)));
    var SEG = DUR / N;
    var stopped = false, lastScene = -1, sceneBaseX = 0;
    var imgCache = {}, snapOrder = null, snapView = view, snapSel = sel, devState = {};

    // Entradas/salidas: en vez de fundir a negro, el modelo y el texto
    // literalmente ENTRAN y SALEN de la escena (escala + deslizamiento).
    function enterDev(d) {
      if (!d || !d.pivot) return;
      var t = d._targetS || 1;
      d.pivot.scale.setScalar(Math.max(1e-3, t * 0.22));
      d.pivot.position.x += 1.8;      // entra deslizándose desde la derecha
      d.pivot.position.y -= 0.45;
      d.pivot.rotation.y -= 0.7;      // y girando suavemente hasta su pose
      d.pivot.rotation.x -= 0.12;
    }
    function exitDev(d) {
      if (!d || !d.pivot) return;
      var goal = d.pivot.userData.goal, t = d._targetS || goal.s || 1;
      goal.s = t * 0.12;              // se encoge
      goal.p[0] += 1.8;               // se va hacia la derecha
      goal.p[1] -= 0.4;
      goal.ry += 0.9;                 // girando al salir
    }

    // cambio de escena: primero SALEN el modelo y el texto actuales y, cuando
    // ya se han retirado, ENTRAN los siguientes (así se ve claramente el relevo)
    function transitionTo(i) {
      if (stopped) return;
      Object.keys(devices).forEach(function (id) {
        var d = devices[id]; if (d && d.pivot && d.pivot.visible) exitDev(d);
      });
      card.classList.add('beat');
      setTimeout(function () {
        if (stopped) return;
        applyScene(VIDEO_SCENES[i], true);
        card.classList.remove('beat');
      }, 380);
    }
    function applyScene(sc, animate) {
      var ids = sc.types.map(idOfType).filter(Boolean);
      if (!ids.length) return;
      var focus = (sc.focus && ids.indexOf(sc.focus) >= 0) ? sc.focus : ids[0];
      view = focus; F().view = view; F().sel = (view !== 'all') ? view : null; sel = F().sel;
      applyLayout(true);
      // Un único equipo por plano, ocupando TODO el espacio libre: a pantalla
      // completa cuando no hay texto y en su hueco (derecha) cuando lo hay.
      var solo = ids.length === 1;
      var clean = (sc.ui === false);
      var fw = clean ? 0.92 : 0.54, fh = 0.74;
      var fo = sc.fill && sc.fill[fmt];        // encaje específico por formato
      if (fo) { if (fo.w != null) fw = fo.w; if (fo.h != null) fh = fo.h; }
      var center = solo && (sc.center === true || clean || (fo && fo.center));
      sceneBaseX = center ? -activeSlots().hero.p[0] : 0;
      stage.position.x = sceneBaseX;
      ids.forEach(function (id) {
        var d = devices[id];
        if (!d || !d.pivot || !d.pivot.userData.goal) return;
        var adj = (M(d).adj && M(d).adj.sc) ? M(d).adj.sc : 1;
        var eff = fitScale(d, fw, fh);
        if (sc.boost) eff *= sc.boost;
        d._targetS = eff / adj;
        d.pivot.userData.goal.s = d._targetS;
      });
      Object.keys(devices).forEach(function (id) {
        var d = devices[id]; if (d && d.pivot) d.pivot.visible = ids.indexOf(id) >= 0;
      });
      ids.forEach(function (id) {
        var s = sc.screens && sc.screens[devices[id].type];
        if (s && imgCache[s]) applyScreenshot(id, imgCache[s], s);
      });
      card.classList.toggle('clean', sc.ui === false);
      if (sc.ui !== false && typeof sc.head === 'number') setHeadline(sc.head, false);
      if (animate) ids.forEach(function (id) { enterDev(devices[id]); });
    }
    function restoreLook() {
      stopped = true;
      drag.tRy = savedRy; drag.tRx = savedRx; camGoalFov = savedFov;
      card.classList.remove('clean');
      card.classList.remove('beat');
      if (hlEl) { hlEl.style.transition = ''; hlEl.style.opacity = ''; }
      stage.position.x = 0;
      if (snapOrder) {
        F().order = snapOrder.slice(); view = snapView; sel = snapSel; F().view = snapView; F().sel = snapSel;
      }
      setHeadline(savedHead, false);
      Object.keys(devState).forEach(function (id) {
        var d = devices[id]; if (!d || !d.pivot) return;
        if (devState[id].screen && d.screenSrc !== devState[id].screen) { try { applyScreenSrc(id, devState[id].screen); } catch (e) {} }
      });
      applyLayout(true);
      Object.keys(devState).forEach(function (id) { var d = devices[id]; if (d && d.pivot) d.pivot.visible = devState[id].vis; });
    }
    function done() {
      exporting = false;
      [snap, snapAllBtn, zipBtn].forEach(function (b) { if (b) b.disabled = false; });
      if (btn) { btn.disabled = false; btn.innerHTML = VIDEO_LABEL; }
    }

    (async function () {
      try {
        if (autorec) {
          var need = ['phone', 'tablet', 'laptop'];
          for (var ti = 0; ti < need.length; ti++) { if (!idOfType(need[ti])) await addDevice(need[ti]); }
        }
        var srcs = {};
        VIDEO_SCENES.forEach(function (s) { if (s.screens) Object.keys(s.screens).forEach(function (t) { srcs[s.screens[t]] = 1; }); });
        await Promise.all(Object.keys(srcs).map(function (s) {
          return loadImgEl(s).then(function (im) { imgCache[s] = im; }).catch(function () {});
        }));

        var src = await window.promoRec.getSource();
        if (!src) throw new Error('no se encontr\u00F3 la ventana para capturar');
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var md = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: src, maxWidth: Math.round(w * dpr), maxHeight: Math.round(h * dpr), maxFrameRate: 30 } }
        });
        var stream = new MediaStream([md.getVideoTracks()[0]]);
        var rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 14000000 });
        var chunks = [];
        rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onstop = function () {
          restoreLook();
          var blob = new Blob(chunks, { type: 'video/webm' });
          var fr = new FileReader();
          fr.onload = function () {
            window.promoRec.save('resto-' + fmt + '.webm', String(fr.result).split(',')[1]);
            setTimeout(function () { try { window.close(); } catch (e) {} }, 400);
          };
          fr.readAsDataURL(blob);
          done();
        };

        // instantánea del estado visual para restaurarlo al terminar
        snapOrder = F().order.slice(); snapView = view; snapSel = sel; devState = {};
        Object.keys(devices).forEach(function (id) { devState[id] = { vis: devices[id].pivot ? devices[id].pivot.visible : true, screen: devices[id].screenSrc }; });

        rec.start(250);
        // arranque: entra la primera escena (modelo + texto) con su animación
        card.classList.add('beat');
        applyScene(VIDEO_SCENES[0], true);
        lastScene = 0;
        var t0 = performance.now();
        requestAnimationFrame(function () { if (!stopped) card.classList.remove('beat'); });
        (function loop() {
          var t = (performance.now() - t0) / 1000;
          if (t >= DUR) { try { rec.stop(); } catch (e) {} return; }
          var scene = Math.min(N - 1, Math.floor(t / SEG));
          var k = SEG > 0 ? (t - scene * SEG) / SEG : 0;   // 0..1 dentro de la escena
          if (scene !== lastScene) { lastScene = scene; transitionTo(scene); }
          var sc = VIDEO_SCENES[scene];
          var dir = (scene % 2 === 0) ? 1 : -1;
          camGoalFov = camBaseFov - (sc.zoom || 0.6) - (0.25 + 0.25 * Math.sin(k * Math.PI));   // deriva suave
          drag.tRy = savedRy + Math.sin(t * 0.5) * 0.04 + dir * 0.025 * (0.5 + 0.5 * Math.sin(k * Math.PI));
          drag.tRx = savedRx + Math.sin(t * 0.4 + 1) * 0.012;
          // paneo lateral: el equipo se desliza con suavidad dentro del plano
          var panAmt = (sc.pan != null ? sc.pan : 0.26);
          stage.position.x = sceneBaseX + dir * (k - 0.5) * panAmt;
          requestAnimationFrame(loop);
        })();
      } catch (e) {
        restoreLook();
        done();
        fail('No se pudo grabar en Electron: ' + (e && e.message ? e.message : e));
      }
    })();
  }
  var snapVideo = document.getElementById('snap-video');
  if (snapVideo) snapVideo.addEventListener('click', exportVideo);


  function exportJSON() {
    try {
      var data = JSON.stringify(serialize(true), null, 2);
      var blob = new Blob([data], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'diseno-app-promo.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    } catch (e) { fail('No se pudo guardar el JSON: ' + (e && e.message ? e.message : e)); }
  }
  function importJSON(file) {
    if (!file) return;
    var fr = new FileReader();
    fr.onload = function () {
      var state;
      try { state = JSON.parse(fr.result); } catch (e) { fail('El archivo JSON no es válido.'); return; }
      if (!state || !state.types || !Object.keys(state.types).length) { fail('El JSON no contiene un diseño válido.'); return; }
      applyState(state).then(function () { saveState(); });
    };
    fr.onerror = function () { fail('No se pudo leer el archivo JSON.'); };
    fr.readAsText(file);
  }
  var saveJson = document.getElementById('save-json');
  if (saveJson) saveJson.addEventListener('click', exportJSON);
  var loadJson = document.getElementById('load-json');
  var jsonFile = document.getElementById('json-file');
  if (loadJson && jsonFile) loadJson.addEventListener('click', function () { jsonFile.click(); });
  if (jsonFile) jsonFile.addEventListener('change', function () {
    importJSON(jsonFile.files && jsonFile.files[0]);
    jsonFile.value = '';
  });

  // selector de formato de archivo PNG / JPG
  var extPng = document.getElementById('ext-png');
  var extJpg = document.getElementById('ext-jpg');
  function setExt(v) {
    ext = v;
    if (extPng) extPng.classList.toggle('active', v === 'png');
    if (extJpg) extJpg.classList.toggle('active', v === 'jpg');
  }
  if (extPng) extPng.addEventListener('click', function () { setExt('png'); });
  if (extJpg) extJpg.addEventListener('click', function () { setExt('jpg'); });
  updateSnapLabel();

  // autorprueba headless: exporta el formato actual y publica las dimensiones
  function runSelfTest() {
    renderAd(fmt, function (err, url) {
      if (err) { document.title = 'SELFTEST export error ' + (err && err.message ? err.message : err); return; }
      var probe = new Image();
      probe.onload = function () {
        var out = 'SELFTEST ok ' + probe.naturalWidth + 'x' + probe.naturalHeight + ' fmt=' + fmt;
        var el = document.createElement('div');
        el.id = 'selftest';
        el.textContent = out;
        el.style.cssText = 'position:fixed;left:0;top:0;z-index:9999;background:#0f0;color:#000;font:12px monospace;padding:2px 4px;';
        document.body.appendChild(el);
        document.title = out;
      };
      probe.onerror = function () { document.title = 'SELFTEST img error'; };
      probe.src = url;
    });
  }

  /* ---------------------------------------------------------------- go */
  resize();
  applyLayout(true);
  tick();

  /* --- hook de depuración (mide el encaje aparente de cada modelo) --- */
  window.__resto = {
    show: function (type) {
      var id = null;
      Object.keys(devices).forEach(function (k) { if (devices[k].type === type) id = k; });
      if (id) { view = id; F().view = id; sel = id; F().sel = id; }
      applyLayout(true);
      return id;
    },
    solo: function (type, boost) {
      var id = null;
      Object.keys(devices).forEach(function (k) { if (devices[k].type === type) id = k; });
      if (!id) return null;
      view = id; F().view = id; sel = id; F().sel = id;
      applyLayout(true);
      stage.position.x = -activeSlots().hero.p[0];
      Object.keys(devices).forEach(function (k) { if (devices[k].pivot) devices[k].pivot.visible = (k === id); });
      if (boost && devices[id].pivot && devices[id].pivot.userData.goal) devices[id].pivot.userData.goal.s = (devices[id].slotS || 1) * boost;
      return id;
    },
    boost: function (type, f) {
      var id = null;
      Object.keys(devices).forEach(function (k) { if (devices[k].type === type) id = k; });
      if (id && devices[id].pivot && devices[id].pivot.userData.goal) devices[id].pivot.userData.goal.s = (devices[id].slotS || 1) * f;
      return id;
    },
    info: function () {
      return Object.keys(devices).map(function (id) {
        var d = devices[id];
        return { id: id, type: d.type,
          vis: d.pivot ? d.pivot.visible : null,
          scale: d.pivot ? +d.pivot.scale.x.toFixed(4) : null,
          goalS: (d.pivot && d.pivot.userData.goal) ? +d.pivot.userData.goal.s.toFixed(4) : null,
          w: +(2 * d.half.x).toFixed(4), h: +(2 * d.half.y).toFixed(4),
          screenH: d.pivot ? +(d.pivot.scale.x * 2 * d.half.y).toFixed(4) : null };
      });
    },
    state: function () { return { view: view, order: F().order.slice(), design: design, fmt: fmt }; },
    fmt: function () { return fmt; }
  };

  // Grabación automática de la ventana (Electron): modo limpio y arranque
  // cuando el 3D ya está cargado.
  if (autorec && window.promoRec) {
    document.body.classList.add('rec');
    card.classList.remove('fmt-feed', 'fmt-portrait', 'fmt-reel');
    card.classList.add('fmt-' + fmt);
    resize(); applyLayout(true);
    var waited = 0;
    (function waitReady() {
      if (loading.style.display === 'none' || waited > 15000) {
        setTimeout(function () { exportVideoElectron(VIDEO_SECONDS); }, 600);
      } else { waited += 200; setTimeout(waitReady, 200); }
    })();
  }
})();


