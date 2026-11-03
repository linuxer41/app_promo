// Presentación de Mis Facturas: recorre las pantallas reales (web de la empresa,
// búsqueda de cuenta, deudas y QR) con un titular por paso.
//
//   abrir.bat / http://localhost:8000/misfacturas/present.html   -> vista de trabajo, en bucle
//   present.html?fmt=reel&autorec=1&vdur=30                      -> lo que graba Electron
(function () {
  'use strict';

  var qs = new URLSearchParams(location.search);
  var FMT = qs.get('fmt') || 'reel';
  var AUTOREC = !!qs.get('autorec');
  var DUR = Math.max(8, Math.min(90, Number(qs.get('vdur')) || 30));

  // Duraciones de fábrica; se escalan al total que pida --duration.
  var BEATS = [
    { kind: 'cover', dur: 4.0,
      name: 'Mis Facturas', role: 'Pago de servicios con QR',
      tag: 'Paga el agua, la luz y tus servicios con el QR de tu banco o tu billetera. Sin filas y sin ventanillas.',
      chip: 'Web y Android · <b>IATHINGS</b>' },

    { kind: 'shot', dur: 4.3, src: 'screens/web-empsaat.png',
      kicker: 'Paso 1 · Tu empresa', title: 'Entra desde la página de tu empresa',
      sub: 'En el sitio de EMPSAAT, de CESSA o de quien te cobra, pulsas el botón de pago y caes directo en Mis Facturas.' },

    { kind: 'shot', dur: 4.3, src: 'screens/web-empresas.png',
      kicker: 'Paso 2 · Tus cuentas', title: 'Todas tus empresas en un solo lugar',
      sub: 'Elige la empresa que te cobra y, si la usas seguido, déjala guardada como pago frecuente.' },

    { kind: 'shot', dur: 4.3, src: 'screens/web-colecciones.png',
      kicker: 'Paso 3 · Buscarte', title: 'Busca con tu número o tu CI',
      sub: 'Número de abonado o CI/NIT. Puedes ver tu deuda sin registro y sin contraseña.' },

    { kind: 'shot', dur: 4.4, src: 'screens/deudas.png',
      kicker: 'Paso 4 · Revisar', title: 'Mira lo que debes y elige qué pagar',
      sub: 'Cada servicio y cada mes van por separado. Marcas lo que vas a pagar y el QR sale por el monto exacto.' },

    { kind: 'shot', dur: 4.4, src: 'screens/qr.png',
      kicker: 'Paso 5 · Pagar', title: 'Escanea el QR y listo',
      sub: 'Abre tu banco o tu billetera, escanea el código y Mis Facturas queda esperando la confirmación del pago.' },

    { kind: 'end', dur: 4.3,
      name: 'Mis Facturas', tag: 'Disponible en Google Play y en la web',
      badge: 'screens/play-badge.png', url: 'mis-facturas.iathings.com' }
  ];

  var total = BEATS.reduce(function (a, b) { return a + b.dur; }, 0);
  var acc = 0;
  BEATS.forEach(function (b) { b.d = b.dur * DUR / total; b.t0 = acc; acc += b.d; });

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
      '<div class="shotwrap"><div class="shot"><img src="' + b.src + '" alt=""></div></div>' +
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

  var track = document.getElementById('track');
  BEATS.forEach(function (b, i) {
    b.el = mk(b.kind === 'shot' ? shotHTML(b) : midHTML(b, b.kind === 'cover'));
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

  var cur = -1, z = 10;
  function show(i) {
    if (i === cur) return;
    var prev = cur;
    cur = i;
    if (prev >= 0 && BEATS[prev]) {
      BEATS[prev].el.classList.remove('on');
      BEATS[prev].el.classList.add('out');
      setTimeout(function () { if (BEATS[prev]) BEATS[prev].el.classList.remove('out'); }, 560);
    }
    BEATS[i].el.style.zIndex = ++z;
    BEATS[i].el.classList.add('on');
    paintDots(i);
  }

  function indexAt(t) {
    for (var i = BEATS.length - 1; i >= 0; i--) if (t >= BEATS[i].t0) return i;
    return 0;
  }

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

  var STAGE = document.getElementById('stage');
  var W = STAGE.offsetWidth, H = STAGE.offsetHeight;

  function tick(stopAtEnd, onEnd) {
    var t0 = performance.now();
    (function loop() {
      var t = (performance.now() - t0) / 1000;
      if (t >= DUR) { if (stopAtEnd) onEnd(); else { show(0); t0 = performance.now(); } if (stopAtEnd) return; }
      show(indexAt(Math.min(t, DUR - 0.001)));
      requestAnimationFrame(loop);
    })();
  }

  var MIMES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];

  function record() {
    var mime = MIMES.filter(function (m) { return MediaRecorder.isTypeSupported(m); })[0];
    if (!mime) { fail('Este Electron no soporta MediaRecorder WebM.'); return; }
    return window.promoRec.getSource().then(function (src) {
      if (!src) throw new Error('no se encontró la ventana para capturar');
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      return navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { mandatory: {
          chromeMediaSource: 'desktop', chromeMediaSourceId: src,
          maxWidth: Math.round(W * dpr), maxHeight: Math.round(H * dpr), maxFrameRate: 30
        } }
      });
    }).then(function (md) {
      var stream = new MediaStream([md.getVideoTracks()[0]]);
      var rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 14000000 });
      var chunks = [];
      rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = function () {
        var blob = new Blob(chunks, { type: 'video/webm' });
        var fr = new FileReader();
        fr.onload = function () {
          window.promoRec.save('misfacturas-' + FMT + '.webm', String(fr.result).split(',')[1]);
          setTimeout(function () { try { window.close(); } catch (e) {} }, 400);
        };
        fr.readAsDataURL(blob);
      };
      rec.start(250);
      tick(true, function () { try { rec.stop(); } catch (e) {} });
    }).catch(fail);
  }

  function fail(msg) {
    var n = document.getElementById('note');
    n.textContent = '✖ ' + msg;
    n.style.display = 'block';
  }

  ready().then(function () {
    // ?beat=N congela un paso: sirve para revisar el cuadro a cuadro sin grabar
    var freeze = qs.get('beat');
    if (freeze !== null) {
      show(Math.max(0, Math.min(BEATS.length - 1, Number(freeze) || 0)));
      return;
    }
    show(0);
    // un frame de margen para que la primera escena entre animada, no ya montada
    requestAnimationFrame(function () {
      if (AUTOREC && window.promoRec) record();
      else {
        document.getElementById('note').style.display = 'block';
        document.getElementById('note').textContent =
          'Vista de trabajo · ' + DUR + ' s en bucle · ' + BEATS.length + ' pasos';
        tick(false);
      }
    });
  });
})();
