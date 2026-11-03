// Presentación de Mis Facturas para Termux.
//
// No usa Electron ni MediaRecorder: cada cuadro se dibuja de forma determinista
// con renderAt(t). render.mjs pide los cuadros a Chromium (headless) y los manda
// a ffmpeg. La misma página sirve como vista previa en el navegador.
//
// El "marco 3D" del móvil es CSS 3D (perspectiva, bisel, canto, isla y reflejo):
// se ve igual en el móvil y en Chromium headless, y no depende de WebGL, que en
// Termux pierde el contexto al leer los píxeles.
//
//   http://localhost:8080/            -> vista previa en bucle
//   ?render=1&vdur=30                 -> lo que captura render.mjs
//   ?beat=3                           -> congela un paso para revisarlo
(function () {
  'use strict';

  var qs = new URLSearchParams(location.search);
  var DUR = Math.max(8, Math.min(90, Number(qs.get('vdur')) || 30));
  var RENDER = qs.get('render') === '1';
  var FREEZE = qs.get('beat');

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
  BEATS.forEach(function (b) { b.d = b.dur * DUR / total; b.t0 = acc; acc += b.d; });
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
      '<div class="shotwrap"><div class="shot">' +
        '<i class="phone-back"></i>' +
        '<i class="pbtn pbtn-vol1"></i>' +
        '<i class="pbtn pbtn-vol2"></i>' +
        '<i class="pbtn pbtn-power"></i>' +
        '<div class="phone-screen">' +
          '<img src="' + b.src + '" alt="">' +
          '<i class="phone-island"></i>' +
          '<i class="phone-glare"></i>' +
        '</div>' +
      '</div></div>' +
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

  function objectives(b, el, i) {
    if (b.kind === 'shot') {
      return [
        { el: el.querySelector('.kicker'), delay: 0, dur: 0.36, kind: 'copy', hid: 18 },
        { el: el.querySelector('.title'), delay: 0.06, dur: 0.42, kind: 'copy', hid: 26 },
        { el: el.querySelector('.sub'), delay: 0.13, dur: 0.42, kind: 'copy', hid: 26 },
        { el: el.querySelector('.shot'), delay: 0.04, dur: 0.54, kind: 'phone', phase: i * 1.7 }
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
    b.items = objectives(b, b.el, i);
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

  // Dibuja el cuadro exacto del segundo t. Todo va por estilos en línea, así que
  // el resultado no depende de transiciones ni del reloj del navegador.
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
          var exitDur = it.kind === 'phone' ? 0.30 : it.dur;
          pout = clamp((t - end - exitDelay) / exitDur);
        }
        var eout = easeInOut(pout);
        var opacity = ein * (1 - eout);

        var tf;
        if (it.kind === 'phone') {
          var ph = it.phase || 0;
          var x = (1 - ein) * 150 - eout * 205;
          var y = Math.sin(t * 1.1 + ph) * 5 + (1 - ein) * 18;
          var sc = 1 + (1 - ein) * 0.05 - eout * 0.08;
          var rx = 3.2 + Math.sin(t * 0.75 + ph) * 1.2;
          var ry = -12 + Math.sin(t * 0.9 + ph) * 2.2 - (1 - ein) * 24 + eout * 38;
          var rz = -1 + Math.sin(t * 0.6 + ph) * 0.6;
          tf = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0)' +
               ' scale(' + sc.toFixed(4) + ')' +
               ' rotateX(' + rx.toFixed(2) + 'deg)' +
               ' rotateY(' + ry.toFixed(2) + 'deg)' +
               ' rotateZ(' + rz.toFixed(2) + 'deg)';
        } else if (it.kind === 'copy') {
          var y1 = (1 - ein) * it.hid - eout * 16;
          tf = 'translateY(' + y1.toFixed(3) + 'px)';
        } else {
          var y2 = (1 - ein) * 26 + eout * 26;
          tf = 'translateY(' + y2.toFixed(3) + 'px)';
        }

        it.el.style.opacity = opacity.toFixed(4);
        it.el.style.transform = tf;
      }
    }
  }
  window.renderAt = renderAt;

  function ready() {
    var imgs = [].slice.call(document.images);
    return Promise.all([
      document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve(),
      Promise.all(imgs.map(function (im) {
        return im.complete ? Promise.resolve() : new Promise(function (r) {
          im.addEventListener('load', r); im.addEventListener('error', r);
        });
      }))
    ]);
  }

  ready().then(function () {
    window.PROMO_READY = true;

    if (FREEZE !== null) {
      var n = Math.max(0, Math.min(BEATS.length - 1, Number(FREEZE) || 0));
      renderAt(BEATS[n].t0 + Math.min(1.2, BEATS[n].d / 2));
      return;
    }

    renderAt(0);
    if (RENDER) return;

    var note = document.getElementById('note');
    if (note) {
      note.style.display = 'block';
      note.textContent = 'Vista de trabajo · ' + DUR + ' s en bucle · ' + BEATS.length + ' pasos';
    }

    var t0 = performance.now();
    (function loop() {
      renderAt(((performance.now() - t0) / 1000) % DUR);
      requestAnimationFrame(loop);
    })();
  });
})();
