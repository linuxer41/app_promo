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
      stage: { scale: 0.80, y: 0.14 },
      hero:   { p: [ 1.22, 0.10, 0.95], ry: -0.05, scale: 3.55 },
      behind: [
        { p: [ 0.82, 1.02, -0.55], ry:  0.34, scale: 1.50 },
        { p: [ 1.24, -0.80, -0.55], ry: -0.24, scale: 1.50 }
      ],
      phones: {
        hero:   { p: [ 1.70, 0.70, 0.70], ry: -0.16, scale: 2.35 },
        behind: [
          { p: [ 1.08, 0.05, 0.20], ry:  0.02, scale: 2.35 },
          { p: [ 0.46, -0.60, -0.30], ry:  0.20, scale: 2.35 }
        ]
      }
    },
    portrait: {
      stage: { scale: 0.86, y: 0.20 },
      hero:   { p: [ 1.12, 0.00, 0.95], ry: -0.05, scale: 3.92 },
      behind: [
        { p: [ 0.78, 1.32, -0.55], ry:  0.34, scale: 1.62 },
        { p: [ 1.14, -1.04, -0.55], ry: -0.24, scale: 1.60 }
      ],
      phones: {
        hero:   { p: [ 1.68, 0.85, 0.70], ry: -0.16, scale: 2.50 },
        behind: [
          { p: [ 1.06, 0.10, 0.20], ry:  0.02, scale: 2.50 },
          { p: [ 0.44, -0.65, -0.30], ry:  0.20, scale: 2.50 }
        ]
      }
    },
    reel: {
      stage: { scale: 0.60, y: -0.30 },
      hero:   { p: [ 0.45, 0.02, 0.95], ry: -0.04, scale: 2.55 },
      behind: [
        { p: [-0.82, 0.62, -0.55], ry:  0.30, scale: 1.38 },
        { p: [ 0.82, -0.58, -0.55], ry: -0.22, scale: 1.38 }
      ],
      phones: {
        hero:   { p: [ 0.45, 1.40, 0.70], ry: -0.12, scale: 2.05 },
        behind: [
          { p: [ 0.15, 0.60, 0.20], ry:  0.04, scale: 2.05 },
          { p: [-0.15, -0.20, -0.30], ry:  0.16, scale: 2.05 }
        ]
      }
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
  var sel = null;      // equipo objetivo de las herramientas (clic), no cambia el layout
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
  var devices = {};       // id -> { id, type, label, pivot, root, screen, half, slotP, slotS, mem }
  var typeCount = {};     // type -> nº de instancias creadas (global, no se reinicia)
  // Cada formato tiene su PROPIA memoria: orden de equipos, vista, selección
  // y, por equipo, offset + ajustes. Al cambiar de formato se conserva todo.
  var fmtState = {};      // fmt -> { order: [], view: 'all', sel: null, init: false }
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
        mem: null,   // memorias por formato; las crea M(d) al usarse
        slotP: { x: 0, y: 0, z: 0 }, slotS: 1
      };
      F().order.push(id);
      applyLayout(false);
      buildScreenRows();
      updateTools();
      var autos = AUTO[type];
      if (type === 'phone' && autos.length > 1) {   // variar captura entre móviles
        var off = (typeCount[type] - 1) % autos.length;
        autos = autos.slice(off).concat(autos.slice(0, off));
      }
      return tryAuto(id, autos).then(function () { return id; });
    });
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
    });
  }

  var qsDesign = null, qsSel = null;
  try {
    var qsParams = new URLSearchParams(location.search);
    qsDesign = qsParams.get('design') || qsParams.get('scene');
    qsSel = qsParams.get('sel');
  } catch (e) {}
  setDesign(qsDesign || design).then(function () {
    if (qsSel && devices[qsSel]) { sel = qsSel; F().sel = sel; updateTools(); }
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
    phone:  ['screns/mobile_1.png', 'screns/mobile_2.png'],
    tablet: ['screns/tablet.jpeg'],
    laptop: ['screns/pc_screen.png']
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
    if (moved) return;
    if (mode === 'move' && id) { sel = (sel === id) ? null : id; st.sel = sel; } 
    else if (mode === 'rotate' && sel) { sel = null; st.sel = null; }
    st.view = view; updateTools();
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
    btn.classList.add('active');
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-fmt]'), function (b) {
    b.addEventListener('click', function () {
      var nf = b.getAttribute('data-fmt');
      // memoria visible del formato actual antes de irnos
      var stCur = F();
      stCur.sel = sel;
      stCur.view = view;
      // pasar al nuevo formato: restaurar su selección/vista
      fmt = nf;
      var stN = F();
      sel = stN.sel; view = stN.view;
      card.className = 'card fmt-' + fmt + (card.classList.contains('show-safe') ? ' show-safe' : '');
      setActive('[data-fmt]', b);
      setActive('[data-view]', document.querySelector('[data-view="' + view + '"]'));
      applyLayout(false);
      updateTools();
      updateSnapLabel();
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-view]'), function (b) {
    b.addEventListener('click', function () { setView(b.getAttribute('data-view')); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-design]'), function (b) {
    b.addEventListener('click', function () { setDesign(b.getAttribute('data-design')); });
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

  // Renderiza la card en `targetFmt`, la convierte a imagen y llama cb(err, url, name).
  function renderAd(targetFmt, cb) {
    if (typeof htmlToImage === 'undefined') { cb(new Error('Falta libs/html-to-image.js (recarga con Ctrl+F5).')); return; }
    var prevFmt = fmt, prevClass = card.className;
    fmt = targetFmt;
    card.className = 'card fmt-' + fmt;
    var size = EXPORT[fmt];
    var w = card.clientWidth || 600, h = card.clientHeight || 600;
    var ratio = size.w / w;

    // 3D supersampleado para que la pantalla del modelo salga nítida a 1080
    sizeRenderer(Math.max(size.w, size.h) * EXPORT_SS);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    applyLayout(true);
    renderer.render(scene, camera);
    var data = renderer.domElement.toDataURL('image/png');
    sizeRenderer(RENDER_LONG);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);

    var img = new Image();
    img.style.cssText = 'position:absolute;inset:0;z-index:1;width:100%;height:100%;';
    function finish() {
      card.removeChild(img);
      canvas.style.visibility = '';
      sizeRenderer(RENDER_LONG);
      fmt = prevFmt;
      card.className = prevClass;
      resize();
      applyLayout(true);
      renderer.render(scene, camera);
    }
    img.onload = function () {
      canvas.style.visibility = 'hidden';
      card.appendChild(img);
      var job = ext === 'jpg'
        ? htmlToImage.toJpeg(card, { pixelRatio: ratio, quality: 0.95, cacheBust: true })
        : htmlToImage.toPng(card, { pixelRatio: ratio, cacheBust: true });
      job.then(function (url) {
        finish();
        cb(null, url, 'resto-' + targetFmt + '-' + size.w + 'x' + size.h + '.' + ext);
      }).catch(function (e) {
        finish();
        cb(e);
      });
    };
    img.onerror = function () {
      fmt = prevFmt; card.className = prevClass; resize(); applyLayout(true);
      cb(new Error('No se pudo leer el render 3D.'));
    };
    img.src = data;
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

  function exportAll() {
    if (exporting) return;
    exporting = true;
    var list = ['feed', 'portrait', 'reel'];
    var snap = document.getElementById('snap');
    var btn = document.getElementById('snap-all');
    if (snap) snap.disabled = true;
    if (btn) btn.disabled = true;
    var i = 0;
    function step() {
      if (i >= list.length) {
        exporting = false;
        if (snap) snap.disabled = false;
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa fa-camera"></i> Exportar todo (3)'; }
        return;
      }
      if (btn) btn.innerHTML = '<i class="fa fa-camera"></i> Exportando ' + (i + 1) + '/' + list.length + '\u2026';
      exportOne(list[i], function () {
        i++;
        setTimeout(step, 900);   // pausa para que el navegador permita varias descargas
      });
    }
    step();
  }

  var snapBtn = document.getElementById('snap');
  if (snapBtn) snapBtn.addEventListener('click', function () { if (!exporting) exportOne(fmt); });
  var snapAll = document.getElementById('snap-all');
  if (snapAll) snapAll.addEventListener('click', exportAll);

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
})();


