/* ============================================================
   DEEP SPACE BLACK HOLE — HUD PORTFOLIO
   Rendering + interaction engine
   ============================================================ */

(function () {
  'use strict';

  /* A phone at DPR 3 paints nine times the pixels of a 1x display for the same
     CSS box, and this page repaints two full-screen canvases every frame. Cap
     the backing store hard on touch devices, keep the crisp 2x on desktop. */
  var coarse = window.matchMedia('(pointer: coarse)').matches;
  var isMobile = coarse || /Android|iPhone|iPad|iPod|Windows Phone|Mobile/i.test(navigator.userAgent);
  var dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.4 : 2);
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* -----------------------------------------------------------
     Deterministic pseudo-random (no per-frame flicker)
     ----------------------------------------------------------- */
  function rnd(seed) {
    var x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  /* -----------------------------------------------------------
     Canvas fit helper
     ----------------------------------------------------------- */
  function fit(canvas) {
    if (!canvas) return null;
    var rect = canvas.getBoundingClientRect();
    var w = Math.max(1, Math.round(rect.width));
    var h = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: h };
  }

  /* ===========================================================
     1. DEEP SPACE BACKGROUND
     =========================================================== */
  var spaceEl = document.getElementById('space-canvas');
  var space = null;
  var stars = [];
  var dust = [];
  var orbits = [];
  var ticksX = [];
  var ticksY = [];
  var meteors = [];
  var bgLayer = null;

  /* The dashed grid and the edge ruler ticks are identical on every frame, yet
     they cost ~400 stroke() calls per frame on a wide screen. Paint them once
     into an offscreen canvas and blit that instead. */
  function paintGrid(x, w, h) {
    x.strokeStyle = 'rgba(53, 231, 255, 0.038)';
    x.lineWidth = 1;
    x.setLineDash([13, 39]);
    for (var gx = 0; gx <= w + 52; gx += 52) {
      x.beginPath(); x.moveTo(gx, -20); x.lineTo(gx, h + 20); x.stroke();
    }
    for (var gy = 0; gy <= h + 52; gy += 52) {
      x.beginPath(); x.moveTo(-20, gy); x.lineTo(w + 20, gy); x.stroke();
    }
    x.setLineDash([]);

    x.strokeStyle = 'rgba(53, 231, 255, 0.07)';
    for (var i1 = 0; i1 < ticksX.length; i1++) {
      var long1 = i1 % 4 === 0;
      x.beginPath();
      x.moveTo(ticksX[i1], 0);
      x.lineTo(ticksX[i1], long1 ? 9 : 4);
      x.stroke();
      x.beginPath();
      x.moveTo(ticksX[i1], h);
      x.lineTo(ticksX[i1], h - (long1 ? 9 : 4));
      x.stroke();
    }
    for (var i2 = 0; i2 < ticksY.length; i2++) {
      var long2 = i2 % 4 === 0;
      x.beginPath();
      x.moveTo(0, ticksY[i2]);
      x.lineTo(long2 ? 9 : 4, ticksY[i2]);
      x.stroke();
      x.beginPath();
      x.moveTo(w, ticksY[i2]);
      x.lineTo(w - (long2 ? 9 : 4), ticksY[i2]);
      x.stroke();
    }
  }

  function buildBgLayer(w, h) {
    var pad = 10;
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round((w + pad * 2) * dpr));
    c.height = Math.max(1, Math.round((h + pad * 2) * dpr));
    var x = c.getContext('2d');
    if (!x) return null;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.translate(pad, pad);
    paintGrid(x, w, h);
    c.__pad = pad;
    return c;
  }

  function buildSpace() {
    space = fit(spaceEl);
    if (!space) return;

    var w = space.w, h = space.h;
    var starCount = w < 820 ? 105 : 240;

    stars = [];
    for (var i = 0; i < starCount; i++) {
      stars.push({
        x: rnd(i * 3.1) * w,
        y: rnd(i * 7.7) * h,
        r: rnd(i * 11.3) * 1.2 + 0.35,
        a: rnd(i * 13.9) * 0.50 + 0.35,
        p: rnd(i * 17.1) * Math.PI * 2,
        s: rnd(i * 19.3) * 0.9 + 0.25,
        warm: rnd(i * 23.7) > 0.82
      });
    }

    dust = [];
    var dustCount = w < 820 ? 18 : 44;
    for (var d = 0; d < dustCount; d++) {
      dust.push({
        x: rnd(d * 31.1) * w,
        y: rnd(d * 37.7) * h,
        r: rnd(d * 41.3) * 1.8 + 0.5,
        vy: -(rnd(d * 43.9) * 0.22 + 0.05),
        vx: (rnd(d * 47.1) - 0.5) * 0.16,
        a: rnd(d * 53.3) * 0.28 + 0.05
      });
    }

    orbits = [];
    var orbitCount = w < 820 ? 2 : 4;
    for (var o = 0; o < orbitCount; o++) {
      orbits.push({
        cx: w * (0.5 + (rnd(o * 61.7) - 0.5) * 0.5),
        cy: h * (0.32 + (rnd(o * 67.3) - 0.5) * 0.34),
        r: Math.min(w, h) * (0.18 + o * 0.1 + rnd(o * 71.9) * 0.06),
        a: 0.11 + rnd(o * 73.1) * 0.09,
        rot: rnd(o * 79.7) * Math.PI
      });
    }

    ticksX = [];
    for (var tx = 0; tx < Math.floor(w / 26); tx++) ticksX.push(tx * 26);
    ticksY = [];
    for (var ty = 0; ty < Math.floor(h / 26); ty++) ticksY.push(ty * 26);

    bgLayer = buildBgLayer(w, h);

    meteors = [];
    for (var m = 0; m < (w < 820 ? 1 : 2); m++) {
      meteors.push({ x: 0, y: 0, life: 0, delay: 6 + rnd(m * 83.3) * 14, speed: 0 });
    }
  }

  function drawSpace(t, mx, my) {
    if (!space) return;
    var ctx = space.ctx, w = space.w, h = space.h;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // gentle parallax for the whole star field
    ctx.translate(mx * 6, my * 6);

    // --- static ruler layer: grid + edge ticks, painted once and blitted ---
    if (bgLayer) {
      var bgPad = bgLayer.__pad;
      ctx.drawImage(bgLayer, -bgPad, -bgPad, w + bgPad * 2, h + bgPad * 2);
    } else {
      paintGrid(ctx, w, h);
    }

    // --- orbit arcs ---
    for (var oi = 0; oi < orbits.length; oi++) {
      var ob = orbits[oi];
      ctx.save();
      ctx.translate(ob.cx + mx * 10, ob.cy + my * 10);
      ctx.rotate(ob.rot);
      ctx.strokeStyle = 'rgba(150, 194, 255, ' + ob.a + ')';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.ellipse(0, 0, ob.r, ob.r * 0.42, 0, 0, Math.PI * 2);
      ctx.stroke();

      // a slow travelling node on the orbit
      var ang = t * 0.00016 + oi * 1.7;
      var px = Math.cos(ang) * ob.r;
      var py = Math.sin(ang) * ob.r * 0.42;
      ctx.beginPath();
      ctx.arc(px, py, 1.9, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(53, 231, 255, 0.62)';
      ctx.fill();
      ctx.restore();
    }

    // --- stars ---
    for (var si = 0; si < stars.length; si++) {
      var st = stars[si];
      var tw = 0.80 + Math.sin(t * 0.0009 * st.s + st.p) * 0.20;
      var alpha = st.a * tw;
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      ctx.fillStyle = st.warm
        ? 'rgba(232, 214, 255, ' + alpha + ')'
        : 'rgba(214, 244, 255, ' + alpha + ')';
      ctx.fill();

      if (!isMobile && st.r > 0.92) {
        ctx.globalAlpha = alpha * 0.40;
        ctx.fillStyle = 'rgba(53, 231, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r * 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // --- drifting dust ---
    for (var di = 0; di < dust.length; di++) {
      var du = dust[di];
      du.y += du.vy;
      du.x += du.vx;
      if (du.y < -12) { du.y = h + 10; du.x = rnd(di + t * 0.001) * w; }
      if (du.x < -12) du.x = w + 10;
      if (du.x > w + 12) du.x = -10;
      var da = du.a * (0.6 + Math.sin(t * 0.0008 + di) * 0.4);
      ctx.beginPath();
      ctx.arc(du.x, du.y, du.r, 0, Math.PI * 2);
      ctx.fillStyle = di % 3 === 0
        ? 'rgba(161, 99, 255, ' + Math.max(0, da) + ')'
        : 'rgba(53, 231, 255, ' + Math.max(0, da) + ')';
      ctx.fill();
    }

    // --- occasional meteor trail ---
    if (!reduced) {
      for (var mi = 0; mi < meteors.length; mi++) {
        var me = meteors[mi];
        if (me.life <= 0) {
          me.delay -= 1 / 60;
          if (me.delay <= 0) {
            me.life = 1;
            me.x = rnd(t * 0.001 + mi * 91.7) * w * 0.8 + w * 0.1;
            me.y = rnd(t * 0.001 + mi * 97.3) * h * 0.4;
            me.speed = 1.6 + rnd(mi * 99.1) * 1.4;
          }
        } else {
          me.life -= 0.012;
          me.x += me.speed;
          me.y += me.speed * 0.42;
          var tailLen = 70;
          var grad = ctx.createLinearGradient(me.x, me.y, me.x - tailLen, me.y - tailLen * 0.42);
          grad.addColorStop(0, 'rgba(150, 235, 255, ' + (me.life * 0.5) + ')');
          grad.addColorStop(1, 'rgba(150, 235, 255, 0)');
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(me.x, me.y);
          ctx.lineTo(me.x - tailLen, me.y - tailLen * 0.42);
          ctx.stroke();
          if (me.life <= 0) me.delay = 10 + rnd(t * 0.002 + mi) * 12;
        }
      }
    }
  }

  /* ===========================================================
     2. BLACK HOLE
     =========================================================== */
  var bhEl = document.getElementById('bh-canvas');
  var bh = null;

  function buildBH() {
    bh = fit(bhEl);
  }

  /* interactive view state for the black hole */
  var bhView = {
    rot: 0, rotVel: 0,
    tilt: 0, tiltVel: 0,
    zoom: 1, zoomTarget: 1,
    boost: 0,
    dragging: false,
    touched: false,
    lastAct: 0
  };

  function drawBlackHole(t, mx, my) {
    if (!bh) return;
    var ctx = bh.ctx, w = bh.w, h = bh.h;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    var cx = w / 2 + mx * 8;
    var cy = h / 2 + my * 8;
    var R = Math.min(w, h) * 0.235 * bhView.zoom;     // photon sphere radius
    var tilt = -0.10 + bhView.tilt;
    var squash = 0.30;

    /* --- deep nebula halo --- */
    var halo = ctx.createRadialGradient(cx, cy, R * 0.5, cx, cy, R * 2.6);
    halo.addColorStop(0, 'rgba(70, 130, 255, 0.20)');
    halo.addColorStop(0.30, 'rgba(110, 80, 240, 0.13)');
    halo.addColorStop(0.62, 'rgba(53, 231, 255, 0.06)');
    halo.addColorStop(1, 'rgba(2, 3, 10, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 2.6, 0, Math.PI * 2);
    ctx.fill();

    /* --- accretion disk: differential-rotation plasma streams --- */
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tilt);
    ctx.scale(1, squash);
    ctx.globalCompositeOperation = 'lighter';

    // soft dust band under the streams
    var band = ctx.createRadialGradient(0, 0, R * 0.95, 0, 0, R * 2.7);
    band.addColorStop(0, 'rgba(150, 225, 255, 0.13)');
    band.addColorStop(0.35, 'rgba(110, 200, 255, 0.09)');
    band.addColorStop(0.68, 'rgba(150, 110, 255, 0.07)');
    band.addColorStop(1, 'rgba(2, 3, 10, 0)');
    ctx.fillStyle = band;
    ctx.beginPath();
    ctx.arc(0, 0, R * 2.7, 0, Math.PI * 2);
    ctx.fill();

    // pass 1 — soft plasma bands: wide low-alpha strokes merge into a glow
    var bands = w < 820 ? 8 : 12;
    for (var bi = 0; bi < bands; bi++) {
      var bp = bi / (bands - 1);
      var br = R * (1.10 + bp * 1.42);
      var bAlpha = 0.072 + (1 - bp) * 0.06;
      ctx.strokeStyle = bp < 0.45
        ? 'rgba(120, 226, 255, ' + bAlpha + ')'
        : 'rgba(140, 108, 255, ' + bAlpha + ')';
      ctx.lineWidth = R * (0.05 + bp * 0.04);
      ctx.setLineDash([br * 1.4, br * 0.55]);
      ctx.lineDashOffset = -(t * 0.0006 * (1 - bp * 0.6) + bi * 21 + bhView.rot * br);
      ctx.beginPath();
      ctx.arc(0, 0, br, 0, Math.PI * 2);
      ctx.stroke();
    }

    // pass 2 — thin bright streams drifting at different speeds
    var streams = w < 820 ? 12 : 20;
    for (var sti = 0; sti < streams; sti++) {
      var sp2 = sti / (streams - 1);
      var sr = R * (1.12 + sp2 * 1.48);
      var sAlpha = Math.pow(1 - sp2, 1.3) * 0.52 + 0.06;
      var scol = sp2 < 0.5 ? 'rgba(196, 246, 255,' : 'rgba(152, 120, 255,';
      ctx.strokeStyle = scol + sAlpha + ')';
      ctx.lineWidth = Math.max(0.7, R * 0.010 * (0.7 + rnd(sti * 9.1) * 1.5));
      var dashOn2 = sr * (0.10 + rnd(sti * 5.3) * 0.20);
      var dashOff2 = sr * (0.16 + rnd(sti * 7.7) * 0.24);
      ctx.setLineDash([dashOn2, dashOff2]);
      ctx.lineDashOffset = -(t * 0.0013 * (1 - sp2 * 0.5) + sti * 17 + bhView.rot * sr);
      ctx.beginPath();
      ctx.arc(0, 0, sr, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    /* --- flat band: the disk seen almost edge-on --- */
    ctx.save();
    ctx.scale(1, 0.26);
    var streak = ctx.createRadialGradient(0, 0, R * 0.9, 0, 0, R * 2.75);
    streak.addColorStop(0, 'rgba(235, 252, 255, 0.34)');
    streak.addColorStop(0.22, 'rgba(120, 232, 255, 0.26)');
    streak.addColorStop(0.55, 'rgba(140, 120, 255, 0.16)');
    streak.addColorStop(1, 'rgba(2, 3, 10, 0)');
    ctx.fillStyle = streak;
    ctx.beginPath();
    ctx.arc(0, 0, R * 2.75, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();

    /* --- event horizon --- */
    ctx.save();
    ctx.translate(cx, cy);
    var core = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.99);
    core.addColorStop(0, '#000000');
    core.addColorStop(0.70, '#000000');
    core.addColorStop(0.90, '#020510');
    core.addColorStop(1, 'rgba(3, 6, 18, 0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.99, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    /* --- photon ring: thin circle hugging the horizon --- */
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tilt);
    ctx.globalCompositeOperation = 'lighter';
    var pulse = 0.9 + Math.sin(t * 0.0012) * 0.1 + bhView.boost;

    ctx.strokeStyle = 'rgba(255, 255, 255, ' + (0.42 * pulse) + ')';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, R * 1.02, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(53, 231, 255, ' + (0.44 * pulse) + ')';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, R * 1.02, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(161, 99, 255, ' + (0.26 * pulse) + ')';
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.arc(0, 0, R * 1.02, 0, Math.PI * 2);
    ctx.stroke();

    // brighter concentrations where the disk meets the ring (kills the bubble look)
    for (var hi = 0; hi < 2; hi++) {
      var hotAng = hi === 0 ? 0.05 : Math.PI - 0.05;
      ctx.strokeStyle = 'rgba(238, 253, 255, ' + (0.34 * pulse) + ')';
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.arc(0, 0, R * 1.02, hotAng - 0.40, hotAng + 0.40);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(126, 238, 255, ' + (0.22 * pulse) + ')';
      ctx.lineWidth = 13;
      ctx.beginPath();
      ctx.arc(0, 0, R * 1.02, hotAng - 0.28, hotAng + 0.28);
      ctx.stroke();
    }
    ctx.restore();

    /* --- lensed halo: soft vertical glow above and below the hole --- */
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalCompositeOperation = 'lighter';
    for (var li = 0; li < 2; li++) {
      var side = li === 0 ? -1 : 1;
      var lg = ctx.createRadialGradient(0, side * R * 0.62, R * 0.1, 0, side * R * 0.62, R * 0.95);
      lg.addColorStop(0, 'rgba(150, 235, 255, ' + (0.13 * pulse) + ')');
      lg.addColorStop(1, 'rgba(150, 235, 255, 0)');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.arc(0, side * R * 0.62, R * 0.95, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    /* --- orbiting fragments / asteroids --- */
    var fragCount = w < 820 ? 7 : 14;
    ctx.save();
    ctx.translate(cx, cy);
    for (var qi = 0; qi < fragCount; qi++) {
      var qs = qi * 29.7;
      var orbitR = R * (1.5 + rnd(qs) * 1.7);
      var ang = t * (0.00011 + rnd(qs + 1) * 0.00018) + rnd(qs + 2) * Math.PI * 2 + bhView.rot * 0.8;
      var fx = Math.cos(ang) * orbitR;
      var fy = Math.sin(ang) * orbitR * 0.30 + (rnd(qs + 3) - 0.5) * R * 0.18;
      var size = 1 + rnd(qs + 4) * 2.1;
      var alphaF = 0.14 + rnd(qs + 5) * 0.32;

      ctx.beginPath();
      ctx.ellipse(fx, fy, size * 1.7, size, ang * 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(130, 160, 210, ' + alphaF + ')';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(fx, fy, size * 3.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(53, 231, 255, ' + (alphaF * 0.12) + ')';
      ctx.fill();
    }
    ctx.restore();

    /* --- soft edge mask so no canvas rectangle is visible --- */
    ctx.globalCompositeOperation = 'destination-in';
    var mask = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.5);
    mask.addColorStop(0, 'rgba(0,0,0,1)');
    mask.addColorStop(0.66, 'rgba(0,0,0,0.92)');
    mask.addColorStop(0.86, 'rgba(0,0,0,0.45)');
    mask.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = mask;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';

    drawMeteors(ctx, cx, cy, R);
  }

  /* ===========================================================
     2C. METEOR IMPACT
     A tap drops debris that spirals in, stretches under tidal pull
     and is swallowed with a warp ring.
     =========================================================== */
  var impactRocks = [];
  var shockRings = [];
  var flashAmt = 0;

  function spawnMeteors(count, angle) {
    if (!bh || reduced) return;
    var base = Math.min(bh.w, bh.h) * 0.235 * bhView.zoom;
    var n = bh.w < 820 ? Math.max(2, Math.round(count * 0.6)) : count;

    for (var i = 0; i < n; i++) {
      /* rocks come in from the side you tapped, spread over a small fan */
      var a0 = typeof angle === 'number'
        ? angle + (Math.random() - 0.5) * (0.55 + n * 0.05)
        : Math.random() * Math.PI * 2;

      /* rounded craggy silhouette + a field of impact pits, cartoon-rock style */
      var verts = [];
      var vn = 9;
      for (var v = 0; v < vn; v++) verts.push(0.86 + Math.random() * 0.26);
      var craters = [];
      var cn = 3 + Math.floor(Math.random() * 3);
      for (var c2 = 0; c2 < cn; c2++) {
        craters.push({
          a: Math.random() * Math.PI * 2,
          d: 0.12 + Math.random() * 0.46,
          r: 0.12 + Math.random() * 0.26
        });
      }
      var spots = [];
      var sn = 2 + Math.floor(Math.random() * 3);
      for (var s2 = 0; s2 < sn; s2++) {
        spots.push({
          a: Math.random() * Math.PI * 2,
          d: 0.10 + Math.random() * 0.70,
          r: 0.020 + Math.random() * 0.050
        });
      }

      impactRocks.push({
        a0: a0,
        r0: base * (1.52 + Math.random() * 0.56),
        t: 0,
        speed: 0.0048 + Math.random() * 0.0025,
        spin: (1.1 + Math.random() * 1.5) * (Math.random() < 0.5 ? -1 : 1),
        size: base * (0.044 + Math.random() * 0.038),
        verts: verts,
        craters: craters,
        spots: spots,
        hue: Math.random() < 0.45 ? 0 : 1,
        trail: []
      });
    }
    if (impactRocks.length > 26) impactRocks.splice(0, impactRocks.length - 26);

    shockRings.push({ r: base * 1.02, life: 1, w: 2.8, sp: 0.046 });
    shockRings.push({ r: base * 0.84, life: 0.72, w: 1.3, sp: 0.030 });
    if (shockRings.length > 6) shockRings.splice(0, shockRings.length - 6);
    bhView.boost = Math.min(0.9, bhView.boost + 0.26);
  }

  function drawMeteors(ctx, cx, cy, R) {
    if (!impactRocks.length && !shockRings.length && flashAmt <= 0.002) return;

    var i, k, m;

    /* horizon glow when something falls in */
    if (flashAmt > 0.002) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var fb = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.5);
      fb.addColorStop(0, 'rgba(200, 245, 255, ' + (0.42 * flashAmt) + ')');
      fb.addColorStop(0.42, 'rgba(120, 200, 255, ' + (0.15 * flashAmt) + ')');
      fb.addColorStop(1, 'rgba(80, 120, 255, 0)');
      ctx.fillStyle = fb;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      flashAmt *= 0.90;
    }

    /* --- falling rocks --- */
    for (i = impactRocks.length - 1; i >= 0; i--) {
      m = impactRocks[i];
      m.t += m.speed;

      var ease = m.t * m.t * (3 - 2 * m.t);
      var rad = m.r0 * (1 - ease);
      var ang = m.a0 + m.spin * m.t * m.t;
      var squash = 1 - 0.62 * Math.min(1, m.t * 1.6);   /* flattens into the disk plane */
      var px = cx + Math.cos(ang) * rad;
      var py = cy + Math.sin(ang) * rad * squash;

      /* swallowed */
      if (m.t >= 1 || rad < R * 0.92) {
        impactRocks.splice(i, 1);
        shockRings.push({ r: R * 0.96, life: 1, w: 2.2, sp: 0.055 });
        shockRings.push({ r: R * 0.78, life: 0.7, w: 1.1, sp: 0.034 });
        if (shockRings.length > 6) shockRings.splice(0, shockRings.length - 6);
        flashAmt = Math.min(0.72, flashAmt + 0.45);
        bhView.boost = Math.min(0.9, bhView.boost + 0.22);
        shakeAmt = Math.min(1, shakeAmt + 0.5);
        continue;
      }

      var stretch = 1 + 1.5 * Math.min(1, m.t * 1.3);   /* tidal stretching */
      var vis = Math.min(1, m.t * 6);
      var shrink = 1 - 0.55 * Math.max(0, (m.t - 0.62) / 0.38);
      var hot = Math.max(0, (m.t - 0.6) / 0.4);         /* blueshift just before capture */

      /* molten sparks shed along the path, not a smooth dot chain */
      m.trail.push({
        x: px + (Math.random() - 0.5) * m.size * 1.5,
        y: py + (Math.random() - 0.5) * m.size * 1.5,
        r: m.size * (0.09 + Math.random() * 0.28)
      });
      if (m.trail.length > 18) m.trail.shift();

      var dirA = Math.atan2(py - cy, px - cx);

      /* filament: space bending between the rock and the horizon */
      if (m.t > 0.30) {
        var ta = Math.min(1, (m.t - 0.30) * 2.6);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(160, 230, 255, ' + (0.20 * ta) + ')';
        ctx.lineWidth = Math.max(0.8, m.size * 0.6);
        ctx.moveTo(px * 0.52, py * 0.52);
        ctx.quadraticCurveTo(px * 0.70 - (py - cy) * 0.10, py * 0.70 + (px - cx) * 0.10, px, py);
        ctx.stroke();

        ctx.beginPath();
        ctx.strokeStyle = 'rgba(190, 250, 255, ' + (0.08 * ta) + ')';
        ctx.lineWidth = Math.max(1.2, m.size * 1.4);
        ctx.moveTo(px * 0.52, py * 0.52);
        ctx.quadraticCurveTo(px * 0.70 - (py - cy) * 0.10, py * 0.70 + (px - cx) * 0.10, px, py);
        ctx.stroke();
        ctx.restore();
      }

      /* trail */
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (k = 0; k < m.trail.length; k++) {
        var tp = m.trail[k];
        var frac = k / m.trail.length;
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, Math.max(0.4, tp.r * (0.35 + frac * 0.85) * shrink), 0, Math.PI * 2);
        ctx.fillStyle = (frac > 0.55
          ? 'rgba(255, 208, 152, ' : 'rgba(214, 150, 104, ') + (frac * 0.78 * vis) + ')';
        ctx.fill();
      }
      ctx.restore();

      /* the rock itself: irregular cratered body, molten rim, hot leading edge */
      var S = Math.max(1.6, m.size * shrink);
      var vn2 = m.verts.length;
      var spinA = m.spin * m.t * 2.2;

      function rockPath(c) {
        c.beginPath();
        for (var q = 0; q < vn2; q++) {
          var va = q / vn2 * Math.PI * 2 + spinA;
          var vr = S * m.verts[q];
          var vx = Math.cos(va) * vr * stretch;
          var vy = Math.sin(va) * vr * 0.92;
          if (q) c.lineTo(vx, vy); else c.moveTo(vx, vy);
        }
        c.closePath();
      }

      ctx.save();
      ctx.translate(px, py);
      ctx.globalAlpha = vis;
      ctx.rotate(dirA);

      /* pale grey stone with a cool shadow side, like the reference art */
      rockPath(ctx);
      var body = ctx.createLinearGradient(-S * stretch, -S * 0.85, S * stretch, S * 0.85);
      body.addColorStop(0, 'rgba(240, 245, 248, 1)');
      body.addColorStop(0.45, 'rgba(198, 208, 214, 1)');
      body.addColorStop(0.78, 'rgba(152, 168, 176, 1)');
      body.addColorStop(1, 'rgba(112, 130, 140, 1)');
      ctx.fillStyle = body;
      ctx.fill();

      /* impact pits: dark bowl, lit upper rim, shadowed floor */
      for (k = 0; k < m.craters.length; k++) {
        var cr = m.craters[k];
        var ca = cr.a + spinA;
        var cxp = Math.cos(ca) * cr.d * S * stretch;
        var cyp = Math.sin(ca) * cr.d * S * 0.9;
        var crx = Math.max(0.5, cr.r * S * 1.18);
        var cry = Math.max(0.4, cr.r * S * 0.86);

        ctx.beginPath();
        ctx.ellipse(cxp, cyp, crx, cry, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(108, 124, 132, 0.95)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(26, 32, 40, 0.85)';
        ctx.lineWidth = Math.max(0.35, S * 0.045);
        ctx.stroke();

        /* crescent highlight on the upper inner wall */
        ctx.beginPath();
        ctx.ellipse(cxp, cyp - cry * 0.16, crx * 0.80, cry * 0.62, 0, Math.PI * 1.04, Math.PI * 1.96);
        ctx.strokeStyle = 'rgba(242, 248, 252, 0.9)';
        ctx.lineWidth = Math.max(0.35, S * 0.055);
        ctx.stroke();

        /* dark floor patch */
        ctx.beginPath();
        ctx.ellipse(cxp, cyp + cry * 0.30, crx * 0.58, cry * 0.30, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(58, 70, 78, 0.55)';
        ctx.fill();
      }

      /* tiny pits */
      for (k = 0; k < m.spots.length; k++) {
        var sp = m.spots[k];
        var sa = sp.a + spinA;
        ctx.beginPath();
        ctx.arc(Math.cos(sa) * sp.d * S * stretch, Math.sin(sa) * sp.d * S * 0.9,
                Math.max(0.3, sp.r * S), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(74, 88, 96, 0.85)';
        ctx.fill();
      }

      /* specular glints */
      for (k = 0; k < 2; k++) {
        var ga = spinA + 1.1 + k * 2.4;
        ctx.beginPath();
        ctx.ellipse(Math.cos(ga) * S * 0.42 * stretch, Math.sin(ga) * S * 0.36,
                    Math.max(0.4, S * 0.20), Math.max(0.3, S * 0.13), ga * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.55 - k * 0.2) + ')';
        ctx.fill();
      }

      /* bold cartoon outline last, so it caps pits and glints */
      rockPath(ctx);
      ctx.strokeStyle = 'rgba(14, 18, 24, 0.92)';
      ctx.lineWidth = Math.max(0.8, S * 0.16);
      ctx.stroke();
      ctx.restore();

      /* molten rim + friction glow facing the hole */
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(dirA);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = vis;

      rockPath(ctx);
      ctx.strokeStyle = (hot > 0.05
        ? 'rgba(206, 244, 255, ' : 'rgba(255, 232, 200, ') + (0.40 + hot * 0.45) + ')';
      ctx.lineWidth = Math.max(0.7, S * 0.14);
      ctx.stroke();

      /* blazing head on the leading edge */
      ctx.beginPath();
      ctx.ellipse(-S * stretch * 0.82, 0, S * 0.55 * (1 + hot * 0.7), S * 0.62, 0, 0, Math.PI * 2);
      ctx.fillStyle = (m.hue ? 'rgba(255, 224, 176, ' : 'rgba(236, 250, 255, ') + (0.40 + hot * 0.35) + ')';
      ctx.fill();
      ctx.restore();
    }

    /* --- warp rings: the bent light leaves as a shockwave --- */
    for (i = shockRings.length - 1; i >= 0; i--) {
      var rg = shockRings[i];
      var spd = rg.sp || 0.046;
      rg.r += R * spd + R * 0.020 * (1 - rg.life);
      rg.life -= 0.030;
      if (rg.life <= 0) { shockRings.splice(i, 1); continue; }

      ctx.save();
      ctx.translate(cx, cy);
      ctx.globalCompositeOperation = 'lighter';
      ctx.scale(1, 0.85);

      ctx.beginPath();
      ctx.arc(0, 0, rg.r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(200, 252, 255, ' + (0.38 * rg.life) + ')';
      ctx.lineWidth = rg.w;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, rg.r * 1.06, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(150, 120, 255, ' + (0.26 * rg.life) + ')';
      ctx.lineWidth = rg.w * 2.6;
      ctx.stroke();

      for (k = 0; k < 5; k++) {
        var off = k * 1.257 + rg.life * 0.9;
        ctx.beginPath();
        ctx.arc(0, 0, rg.r * 1.02, off, off + 0.34);
        ctx.strokeStyle = 'rgba(130, 240, 255, ' + (0.34 * rg.life) + ')';
        ctx.lineWidth = rg.w * 0.8;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /* ===========================================================
     2B. BLACK HOLE INTERACTION
     drag / swipe = spin the disk, wheel / pinch = zoom, tap = pulse
     =========================================================== */
  var bhStage = document.querySelector('.bh-stage');
  var bhHint = document.querySelector('.bh-hint');

  function setZoom(z) {
    bhView.zoomTarget = Math.max(0.72, Math.min(1.6, z));
    bhView.lastAct = performance.now();
  }

  function hideHint() {
    if (bhHint) bhHint.classList.add('is-hidden');
  }

  function requestBHDraw() {
    if (rafId === null && bh) drawBlackHole(performance.now() - startTime, mx, my);
  }

  function bindBlackHole() {
    if (!bhStage) return;

    var pointers = {};
    var count = 0;
    var lastX = 0, lastY = 0, moved = 0, downAt = 0;
    var startX = 0, startY = 0;
    var pinchStart = 0, pinchZoom = 1;
    var pinched = false;
    var tapTimer = null;

    function dist(a, b) {
      var dx = a.x - b.x, dy = a.y - b.y;
      return Math.sqrt(dx * dx + dy * dy) || 1;
    }

    function list() {
      var out = [];
      for (var k in pointers) {
        if (Object.prototype.hasOwnProperty.call(pointers, k)) out.push(pointers[k]);
      }
      return out;
    }

    bhStage.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      count++;
      hideHint();
      try { bhStage.setPointerCapture(e.pointerId); } catch (err) {}
      if (e.pointerType === 'touch') bhView.touched = true;

      if (count === 1) {
        lastX = e.clientX;
        lastY = e.clientY;
        startX = e.clientX;
        startY = e.clientY;
        moved = 0;
        pinched = false;
        downAt = performance.now();
        bhView.lastAct = downAt;
        bhView.dragging = true;
        bhStage.classList.add('is-dragging');
      } else if (count === 2) {
        var p = list();
        pinchStart = dist(p[0], p[1]);
        pinchZoom = bhView.zoomTarget;
        bhView.dragging = false;
        pinched = true;
        moved = 999;   // a pinch must never be read as a tap
      }
    });

    bhStage.addEventListener('pointermove', function (e) {
      if (!pointers[e.pointerId]) return;
      pointers[e.pointerId].x = e.clientX;
      pointers[e.pointerId].y = e.clientY;

      if (count >= 2) {
        var p = list();
        setZoom(pinchZoom * (dist(p[0], p[1]) / pinchStart));
        return;
      }

      var dx = e.clientX - lastX;
      var dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);

      bhView.rotVel += dx * 0.00055;
      bhView.tiltVel += dy * 0.0000024;
      bhView.lastAct = performance.now();

      if (moved > 8 && e.cancelable) e.preventDefault();
      requestBHDraw();
    });

    function endPointer(e) {
      if (!pointers[e.pointerId]) return;
      delete pointers[e.pointerId];
      count = Math.max(0, count - 1);

      if (count === 0) {
        bhView.dragging = false;
        bhStage.classList.remove('is-dragging');
        var dt = performance.now() - downAt;
        bhView.lastAct = performance.now();

        /* throw it further and faster -> the disk keeps spinning harder */
        if (!pinched && moved > 8 && e.type === 'pointerup') {
          var speed = (e.clientX - startX) / Math.max(60, dt);          // px per ms
          bhView.rotVel = Math.max(-0.12, Math.min(0.12, speed * 0.14));
          var tiltSpeed = (e.clientY - startY) / Math.max(60, dt);
          bhView.tiltVel = Math.max(-0.0006, Math.min(0.0006, tiltSpeed * 0.0007));
        }

        if (moved < 8 && dt < 340 && !pinched) {
          bhView.boost = Math.min(0.7, bhView.boost + 0.5);

          /* which side of the hole did you hit? rocks fall in from there */
          var box = bhStage.getBoundingClientRect();
          var hitA = Math.atan2(e.clientY - (box.top + box.height / 2),
                                e.clientX - (box.left + box.width / 2));

          if (tapTimer) {
            clearTimeout(tapTimer);
            tapTimer = null;
            setZoom(1.42);            // second tap inside the window = full zoom
            spawnMeteors(11, hitA);
          } else {
            tapTimer = setTimeout(function () {
              tapTimer = null;
              setZoom(bhView.zoomTarget > 1.12 ? 1 : 1.24);
              spawnMeteors(5, hitA);
              requestBHDraw();
            }, 260);
          }
        }
        pinched = false;
        requestBHDraw();
      }
    }
    bhStage.addEventListener('pointerup', endPointer);
    bhStage.addEventListener('pointercancel', endPointer);

    /* wheel zoom: only over the hole AND only with Ctrl/Cmd, so normal page scrolling is untouched */
    bhStage.addEventListener('wheel', function (e) {
      if (!e.ctrlKey && !e.metaKey) return;
      var rect = bhStage.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      var rad = Math.min(rect.width, rect.height) * 0.44;
      var ddx = e.clientX - cx, ddy = e.clientY - cy;
      if (Math.sqrt(ddx * ddx + ddy * ddy) > rad) return;
      e.preventDefault();
      setZoom(bhView.zoomTarget + (e.deltaY < 0 ? 0.12 : -0.12));
      hideHint();
    }, { passive: false });

    bhStage.addEventListener('pointerleave', function () {
      bhView.lastAct = performance.now();
    });

    bhStage.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { bhView.rotVel -= 0.006; }
      else if (e.key === 'ArrowRight') { bhView.rotVel += 0.006; }
      else if (e.key === '+' || e.key === '=') { setZoom(bhView.zoomTarget + 0.12); }
      else if (e.key === '-') { setZoom(bhView.zoomTarget - 0.12); }
      else if (e.key === '0') { setZoom(1); }
      else if (e.key === 'Enter' || e.key === ' ') { spawnMeteors(5); }
      else return;
      e.preventDefault();
      requestBHDraw();
    });
  }

  /* ===========================================================
     3. MAIN LOOP
     =========================================================== */
  var mx = 0, my = 0, tmx = 0, tmy = 0;
  var startTime = performance.now();
  var rafId = null;
  /* the scene is slow by design, so 30fps on touch devices looks identical
     while halving the per-frame cost */
  var frameGap = isMobile ? 32 : 0;
  var lastFrame = 0;

  function loop() {
    /* any full-screen overlay covers the whole scene: skip every repaint
       while one is open so the player / gallery gets the whole GPU */
    var root = document.documentElement;
    if (root.classList.contains('vid-open') ||
        root.classList.contains('pv-open') ||
        root.classList.contains('prj-open')) {
      rafId = document.hidden ? null : requestAnimationFrame(loop);
      return;
    }
    var now = performance.now();
    if (frameGap && now - lastFrame < frameGap) {
      rafId = document.hidden ? null : requestAnimationFrame(loop);
      return;
    }
    lastFrame = now;
    var t = now - startTime;
    mx += (tmx - mx) * 0.06;
    my += (tmy - my) * 0.06;

    // inertia for the interactive black hole
    bhView.rot += bhView.rotVel;
    bhView.rotVel *= 0.94;
    bhView.tilt += bhView.tiltVel;
    bhView.tiltVel *= 0.92;
    bhView.tilt = Math.max(-0.075, Math.min(0.075, bhView.tilt));
    bhView.zoom += (bhView.zoomTarget - bhView.zoom) * 0.09;
    bhView.boost *= 0.9;
    if (bhView.rot > Math.PI * 2) bhView.rot -= Math.PI * 2;
    if (bhView.rot < -Math.PI * 2) bhView.rot += Math.PI * 2;

    settleRest();
    applyShake();

    drawSpace(t, mx, my);
    drawBlackHole(t, mx, my);
    rafId = document.hidden ? null : requestAnimationFrame(loop);
  }

  /* whole-page tremble when something is swallowed */
  var shakeAmt = 0;
  var shakeActive = false;

  function applyShake() {
    if (reduced) return;
    if (shakeAmt > 0.004) {
      shakeAmt *= 0.90;
      var amp = shakeAmt * 8;
      var sx = (Math.random() * 2 - 1) * amp;
      var sy = (Math.random() * 2 - 1) * amp;
      document.documentElement.style.setProperty('--shake-x', sx.toFixed(2) + 'px');
      document.documentElement.style.setProperty('--shake-y', sy.toFixed(2) + 'px');
      shakeActive = true;
    } else if (shakeActive) {
      shakeAmt = 0;
      document.documentElement.style.setProperty('--shake-x', '0px');
      document.documentElement.style.setProperty('--shake-y', '0px');
      shakeActive = false;
    }
  }

  /* keep the scene alive when the tab is in the background and rAF is paused */
  setInterval(function () {
    if (document.hidden && !reduced) loop();
  }, 62);

  /* ===========================================================
     3B. RETURN TO REST
     Runs off elapsed time, so it keeps working even when the
     tab is throttled and requestAnimationFrame is paused.
     =========================================================== */
  var lastSettle = performance.now();

  function settleRest() {
    var now = performance.now();
    var dtMs = Math.min(400, now - lastSettle);
    lastSettle = now;
    if (!bhStage || bhView.dragging || dtMs <= 0) return;

    var hoverPause = !bhView.touched && bhStage.matches(':hover');
    if (hoverPause || !bhView.lastAct || now - bhView.lastAct <= 3600) return;

    var f = dtMs / 16.7;
    var kZoom = 1 - Math.pow(1 - 0.022, f);
    var kRot = 1 - Math.pow(1 - 0.012, f);

    bhView.zoomTarget += (1 - bhView.zoomTarget) * kZoom;
    if (Math.abs(bhView.zoomTarget - 1) < 0.006) bhView.zoomTarget = 1;
    bhView.rot += (-bhView.rot) * kRot;
    if (Math.abs(bhView.rot) < 0.002) bhView.rot = 0;
    bhView.tilt += (-bhView.tilt) * (1 - Math.pow(1 - 0.02, f));
    if (Math.abs(bhView.tilt) < 0.0004) bhView.tilt = 0;
  }

  setInterval(function () {
    if (document.hidden) settleRest();
  }, 70);

  window.addEventListener('mousemove', function (e) {
    tmx = (e.clientX / window.innerWidth - 0.5) * 2;
    tmy = (e.clientY / window.innerHeight - 0.5) * 2;
    document.documentElement.style.setProperty('--mx', tmx.toFixed(3));
    document.documentElement.style.setProperty('--my', tmy.toFixed(3));
  }, { passive: true });

  function boot() {
    buildSpace();
    buildBH();
    bindBlackHole();
    if (reduced) {
      drawSpace(0, 0, 0);
      drawBlackHole(0, 0, 0);
    } else if (rafId === null) {
      loop();
    }
  }

  window.addEventListener('resize', function () {
    clearTimeout(window.__rz);
    window.__rz = setTimeout(function () {
      buildSpace();
      buildBH();
    }, 180);
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    } else if (!reduced && rafId === null) {
      loop();
    }
  });

  /* ===========================================================
     4. TOP BAR / NAV
     =========================================================== */
  var topbar = document.querySelector('.topbar');
  var nav = document.querySelector('.nav');
  var navToggle = document.querySelector('.nav-toggle');

  function onScroll() {
    if (!topbar) return;
    topbar.classList.toggle('is-scrolled', window.scrollY > 50);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if (navToggle && nav) {
    navToggle.addEventListener('click', function () {
      nav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', nav.classList.contains('is-open') ? 'true' : 'false');
    });
    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () { nav.classList.remove('is-open'); });
    });
  }

  /* ===========================================================
     5. BUTTON RIPPLE
     =========================================================== */
  document.querySelectorAll('.hud-btn').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      var rect = btn.getBoundingClientRect();
      var size = Math.max(rect.width, rect.height);
      var ripple = document.createElement('span');
      ripple.className = 'ripple';
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
      ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
      btn.appendChild(ripple);
      setTimeout(function () { if (ripple.parentNode) ripple.parentNode.removeChild(ripple); }, 900);
    });
  });

  /* ===========================================================
     6. BOOT OVERLAY + PAGE TRANSITION
     =========================================================== */
  var bootOverlay = document.getElementById('bootOverlay');

  function hideBoot() {
    if (!bootOverlay) return;
    setTimeout(function () {
      bootOverlay.classList.add('is-done');
      setTimeout(function () {
        if (bootOverlay && bootOverlay.parentNode) bootOverlay.parentNode.removeChild(bootOverlay);
      }, 950);
    }, 700);
  }

  if (bootOverlay) {
    if (document.readyState === 'complete') {
      hideBoot();
    } else {
      window.addEventListener('load', hideBoot);
      setTimeout(hideBoot, 2200); // safety net
    }
  }

  document.querySelectorAll('a[href$=".html"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      if (link.getAttribute('target') === '_blank') return;
      var href = link.getAttribute('href');
      if (!href) return;
      e.preventDefault();
      document.body.classList.add('is-leaving');
      setTimeout(function () { window.location.href = href; }, 330);
    });
  });

  /* ===========================================================
     7. SYSTEM STATUS CLOCK
     =========================================================== */
  var clockEl = document.getElementById('sysClock');
  var moduleEl = document.getElementById('sysModule');
  var statusBar = document.getElementById('sysBar');

  if (moduleEl) {
    moduleEl.textContent = document.body.getAttribute('data-module') || 'HOME';
  }

  function tickClock() {
    if (!clockEl) return;
    var now = new Date();
    var p = function (n) { return n < 10 ? '0' + n : '' + n; };
    clockEl.textContent = p(now.getHours()) + ':' + p(now.getMinutes()) + ':' + p(now.getSeconds());
  }
  if (clockEl) {
    tickClock();
    setInterval(tickClock, 1000);
  }

  if (statusBar && !reduced) {
    var barVal = 46;
    setInterval(function () {
      barVal = 38 + Math.round(rnd(performance.now() * 0.001) * 40);
      statusBar.style.width = barVal + '%';
    }, 3200);
  }

  /* ===========================================================
     7B. LIVE TELEMETRY
     Real date, session uptime, latency jitter and the disk readout.
     =========================================================== */
  var dateEl = document.getElementById('sysDate');
  var uptimeEl = document.getElementById('hudUptime');
  var latencyEl = document.getElementById('hudLatency');
  var rotEl = document.getElementById('hudRot');
  var zoomEl = document.getElementById('hudZoom');
  var tickEls = document.querySelectorAll('.ticks i');
  var dateMini = document.querySelectorAll('.js-date');
  var dateDay = document.querySelectorAll('.eyebrow-date i');
  var bootAt = performance.now();
  var DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  function p2(n) { return n < 10 ? '0' + n : '' + n; }

  function tickTelemetry() {
    var now = new Date();
    var dStr = p2(now.getDate()) + '.' + p2(now.getMonth() + 1) + '.' + now.getFullYear();

    if (dateEl) {
      dateEl.textContent = dStr + ' / ' + DAYS[now.getDay()];
    }

    for (var k = 0; k < dateMini.length; k++) dateMini[k].textContent = dStr;
    for (var m = 0; m < dateDay.length; m++) dateDay[m].textContent = '/ ' + DAYS[now.getDay()];

    if (uptimeEl) {
      var up = Math.floor((performance.now() - bootAt) / 1000);
      uptimeEl.textContent = p2(Math.floor(up / 3600) % 24) + ':' + p2(Math.floor(up / 60) % 60) + ':' + p2(up % 60);
    }

    if (latencyEl && !reduced) {
      latencyEl.textContent = (9 + Math.floor(rnd(performance.now() * 0.021) * 17)) + ' ms';
    }

    if (rotEl) {
      var deg = (bhView.rot * 180 / Math.PI) % 360;
      if (deg < 0) deg += 360;
      rotEl.textContent = deg.toFixed(1) + '\u00b0';
    }
    if (zoomEl) {
      zoomEl.textContent = bhView.zoomTarget.toFixed(2) + '\u00d7';
    }
  }

  function tickSignal() {
    for (var i = 0; i < tickEls.length; i++) {
      tickEls[i].style.height = (30 + Math.round(rnd(performance.now() * 0.007 + i * 3.3) * 68)) + '%';
    }
  }

  tickTelemetry();
  setInterval(tickTelemetry, 1000);

  if (!reduced && tickEls.length) {
    tickSignal();
    setInterval(tickSignal, 1500);
  }

  /* ===========================================================
     8. FORM VALIDATION
     =========================================================== */
  var form = document.getElementById('commentForm');
  var msg = document.getElementById('formMsg');

  function showMsg(text, ok) {
    if (!msg) return;
    msg.textContent = text;
    msg.classList.remove('is-error', 'is-ok');
    msg.classList.add('is-visible', ok ? 'is-ok' : 'is-error');
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var name = form.querySelector('#name');
      var email = form.querySelector('#email');
      var message = form.querySelector('#message');

      var n = name ? name.value.trim() : '';
      var m = email ? email.value.trim() : '';
      var body = message ? message.value.trim() : '';

      if (!n) { showMsg('// ERROR: CALLSIGN REQUIRED', false); if (name) name.focus(); return; }
      if (!m) { showMsg('// ERROR: CONTACT FREQUENCY REQUIRED', false); if (email) email.focus(); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m)) {
        showMsg('// ERROR: INVALID EMAIL FORMAT', false);
        if (email) email.focus();
        return;
      }
      if (!body) { showMsg('// ERROR: MESSAGE BODY EMPTY', false); if (message) message.focus(); return; }

      showMsg('// TRANSMISSION RECEIVED — THANK YOU, ' + n.toUpperCase() + '.', true);
      form.reset();
    });
  }

  /* ===========================================================
     9. CARD ENTRANCE (soft, staggered)
     =========================================================== */
  if (!reduced && 'IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'none';
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.hud-card, .table-shell, .video-shell, .stat-strip').forEach(function (el, i) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(18px)';
      el.style.transition = 'opacity 0.8s cubic-bezier(0.22,0.61,0.36,1) ' + (i % 4) * 0.06 + 's, transform 0.9s cubic-bezier(0.16,1,0.3,1) ' + (i % 4) * 0.06 + 's';
      revealObserver.observe(el);
    });
  }

  /* ===========================================================
     10. PORTRAIT VIEWER (biodata only — open the photo full size)
     =========================================================== */
  (function initPortraitViewer() {
    var viewer = document.getElementById('portraitViewer');
    var opener = document.getElementById('avatarOpen');
    if (!viewer || !opener) return;

    var closeBtn = document.getElementById('pvClose');
    var lastFocus = null;

    function isOpen() { return !viewer.hasAttribute('hidden'); }

    function openViewer() {
      lastFocus = document.activeElement;
      viewer.removeAttribute('hidden');
      document.documentElement.classList.add('pv-open');
      if (closeBtn) closeBtn.focus();
    }

    function closeViewer() {
      viewer.setAttribute('hidden', '');
      document.documentElement.classList.remove('pv-open');
      if (lastFocus && lastFocus !== document.body && lastFocus.focus) lastFocus.focus();
      else opener.focus();
    }

    opener.addEventListener('click', openViewer);

    /* clicking anywhere in the viewer (backdrop or the photo) closes it */
    viewer.addEventListener('click', function (e) {
      if (closeBtn && e.target === closeBtn) return; /* handled by its own listener */
      closeViewer();
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        closeViewer();
      });
    }

    document.addEventListener('keydown', function (e) {
      if (!isOpen()) return;
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        closeViewer();
      }
    });
  })();

  /* ===========================================================
     11. PROJECT LOG GALLERY (portfolio — tap a card, browse shots)
     =========================================================== */
  (function initProjectGallery() {
    var viewer = document.getElementById('prjViewer');
    if (!viewer) return;

    var codeEl = document.getElementById('prjCode');
    var titleEl = document.getElementById('prjTitle');
    var imgEl = document.getElementById('prjImg');
    var captionEl = document.getElementById('prjCaption');
    var indexEl = document.getElementById('prjIndex');
    var totalEl = document.getElementById('prjTotal');
    var dotsEl = document.getElementById('prjDots');
    var prevBtn = document.getElementById('prjPrev');
    var nextBtn = document.getElementById('prjNext');
    var closeBtn = document.getElementById('prjClose');
    var frame = imgEl ? imgEl.parentElement : null;

    /* each project log: title + ordered shots (swap the src list for real screenshots) */
    var LOGS = {
      '1': {
        code: 'PRJ_01', title: 'Animation',
        shots: [
          { src: 'img-anim-1.png', cap: 'LOW-POLY TANK / FLAT SHADING' },
          { src: 'img-anim-2.png', cap: 'WOOD-GRAIN CREATURE / MODELLED' },
          { src: 'img-anim-3.png', cap: 'NEON STREET DIORAMA / SET BUILD' },
          { src: 'img-anim-4.png', cap: 'INTERACTIVE SCENE / STATS PANEL' },
          { src: 'img-anim-5.png', cap: 'CHIBI CHARACTER / STYLISED' },
          { src: 'img-anim-6.png', cap: 'ISOMETRIC ROOM / PROP LAYOUT' },
          { src: 'img-push-1.jpg', cap: 'PUSH / CGI SHORT FILM TITLE' },
          { src: 'img-push-2.jpg', cap: 'PUSH / LIVE-ACTION NIGHT EXTERIOR' },
          { src: 'img-push-3.jpg', cap: 'PUSH / GREEN SCREEN + CREDITS' }
        ]
      },
      '2': {
        code: 'PRJ_02', title: 'Augmented Reality',
        shots: [
          { src: 'img-ar-1.jpg', cap: 'AR TUTORIAL 1 / TARGET TRACKED' },
          { src: 'img-ar-2.jpg', cap: 'AR TUTORIAL 2 / CHARACTER SET ON TARGET' },
          { src: 'img-ar-3.jpg', cap: 'AR TUTORIAL 3 / TWO MODELS TRACKED' },
          { src: 'img-ar-4.jpg', cap: 'AR TUTORIAL 4 / AUDIO PASS' },
          { src: 'img-ar-5.jpg', cap: 'AR TUTORIAL 5 / DUCK TARGET' }
        ]
      },
      '3': {
        code: 'PRJ_03', title: 'Java Programming',
        shots: [
          { src: 'img-java-1.png', cap: 'LOGIN SCREEN / GROCERY STOCK' },
          { src: 'img-java-2.png', cap: 'CREDENTIALS / ADMIN' },
          { src: 'img-java-3.png', cap: 'MAIN MENU / INVENTORY OR LOGOUT' },
          { src: 'img-java-4.png', cap: 'INVENTORY LIST / ID NAME PRICE QTY' },
          { src: 'img-java-5.png', cap: 'INVALID INPUT / MESSAGE BOX' },
          { src: 'img-java-6.png', cap: 'ADD ITEM / TABLE FILLED' },
          { src: 'img-java-7.png', cap: 'UPDATE ITEM / CONFIRM' },
          { src: 'img-java-8.png', cap: 'DELETE ITEM / CONFIRM' },
          { src: 'img-java-9.png', cap: 'RECORD TABLE / STOCK ENTRY' }
        ]
      },
      '4': {
        code: 'PRJ_04', title: 'Video Production',
        shots: [
          { src: 'img-video-1.jpg', cap: 'PUSH / TITLE CARD' },
          { src: 'img-video-2.jpg', cap: 'PUSH / NIGHT EXTERIOR' },
          { src: 'img-video-3.jpg', cap: 'PUSH / GREEN SCREEN + CLOSING CARD' }
        ]
      },
      '5': {
        code: 'PRJ_05', title: 'Multimedia Design',
        shots: [
          { src: 'img-md-2.jpg', cap: 'SURREAL LANDSCAPE / BLENDED IMAGES' },
          { src: 'img-md-4.jpg', cap: 'POSTER / HUMANITARIAN CONFLICT' }
        ]
      }
    };

    var cards = document.querySelectorAll('.project-card[data-prj]');
    if (!cards.length) return;

    var shots = [];
    var cursor = 0;
    var lastFocus = null;

    function isOpen() { return !viewer.hasAttribute('hidden'); }
    function pad(n) { return (n < 10 ? '0' : '') + n; }

    function paint() {
      var shot = shots[cursor];
      if (!shot || !imgEl) return;
      imgEl.src = shot.src;
      imgEl.alt = titleEl.textContent + ' — image ' + (cursor + 1) + ' of ' + shots.length;
      captionEl.textContent = shot.cap;
      indexEl.textContent = pad(cursor + 1);
      totalEl.textContent = pad(shots.length);

      var dots = dotsEl ? dotsEl.children : [];
      for (var i = 0; i < dots.length; i++) {
        dots[i].className = i === cursor ? 'is-on' : '';
      }
      var solo = shots.length < 2;
      if (prevBtn) prevBtn.disabled = solo;
      if (nextBtn) nextBtn.disabled = solo;
    }

    function buildDots() {
      if (!dotsEl) return;
      dotsEl.innerHTML = '';
      for (var i = 0; i < shots.length; i++) dotsEl.appendChild(document.createElement('i'));
    }

    function step(dir) {
      if (shots.length < 2) return;
      cursor = (cursor + dir + shots.length) % shots.length;
      paint();
    }

    function openCard(card) {
      var log = LOGS[card.getAttribute('data-prj')];
      if (!log) return;
      shots = log.shots;
      cursor = 0;
      codeEl.textContent = log.code;
      titleEl.textContent = log.title;
      buildDots();
      paint();

      lastFocus = document.activeElement;
      viewer.removeAttribute('hidden');
      viewer.setAttribute('aria-hidden', 'false');
      document.documentElement.classList.add('prj-open');
      if (closeBtn) closeBtn.focus();
    }

    function closeViewer() {
      viewer.setAttribute('hidden', '');
      viewer.setAttribute('aria-hidden', 'true');
      document.documentElement.classList.remove('prj-open');
      if (lastFocus && lastFocus !== document.body && lastFocus.focus) lastFocus.focus();
    }

    Array.prototype.forEach.call(cards, function (card) {
      card.addEventListener('click', function () { openCard(card); });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          openCard(card);
        }
      });
    });

    if (prevBtn) prevBtn.addEventListener('click', function () { step(-1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { step(1); });
    if (closeBtn) closeBtn.addEventListener('click', closeViewer);

    /* backdrop click closes; clicks inside the shell stay put */
    viewer.addEventListener('click', function (e) {
      if (e.target === viewer) closeViewer();
    });

    document.addEventListener('keydown', function (e) {
      if (!isOpen()) return;
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        closeViewer();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        step(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        step(-1);
      }
    });

    /* swipe the image on touch screens */
    if (frame) {
      var sx = 0, sy = 0, tracking = false;
      frame.addEventListener('touchstart', function (e) {
        if (e.touches.length !== 1) return;
        sx = e.touches[0].clientX;
        sy = e.touches[0].clientY;
        tracking = true;
      }, { passive: true });
      frame.addEventListener('touchend', function (e) {
        if (!tracking) return;
        tracking = false;
        var t = e.changedTouches[0];
        var dx = t.clientX - sx;
        var dy = t.clientY - sy;
        if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
      }, { passive: true });
    }
  })();

  /* ===========================================================
     12. VIDEO ARCHIVE (video.html — cards + single-item player)
     =========================================================== */
  (function initVideoArchive() {
    var grid = document.getElementById('videoGrid');
    if (!grid) return;

    /* -------------------------------------------------------------------
       DATA SOURCE — one entry per video.
       yt   : YouTube video id  (thumbnail is derived from it)
       dur  : duration shown on the card
       desc : the description you write for this clip (empty = pending)
       ------------------------------------------------------------------- */
    function ytThumb(id) {
      return 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg';
    }

    var VIDEOS = [
      {
        code: 'TX_01', title: 'Animation Group Assignment (Group Atomic)',
        yt: 'BLGAc_iYeA0', dur: '2:27', desc: ''
      },
      {
        code: 'TX_02', title: 'Push — Group Project 2025/2026 (Short Film + CGI/VFX)',
        yt: 'J-5dhWwY4n8', dur: '7:12', desc: ''
      },
      {
        code: 'TX_03', title: 'AR Tutorial 1 — Session 2026/2017',
        yt: 'GQqusOhlZM4', dur: '0:47', desc: ''
      },
      {
        code: 'TX_04', title: 'AR Tutorial 2',
        yt: '8IsMXdYMjUk', dur: '0:19', desc: ''
      },
      {
        code: 'TX_05', title: 'AR Tutorial 3',
        yt: 'lekUeLA5P8s', dur: '0:27', desc: ''
      },
      {
        code: 'TX_06', title: 'AR Tutorial 4',
        yt: 'hDkoKLWNv2A', dur: '0:41', desc: ''
      },
      {
        code: 'TX_07', title: 'AR Tutorial 5',
        yt: 'vuBT88_S_LI', dur: '0:18', desc: ''
      },
      {
        code: 'TX_08', title: 'Animation Practical Report 2',
        yt: 'BhfePvVQzjs', dur: '0:18', desc: ''
      }
    ].map(function (v) {
      v.poster = v.poster || ytThumb(v.yt);
      return v;
    });

    var noteEl = document.getElementById('videoNote');
    var emptyEl = document.getElementById('videoEmpty');
    var viewer = document.getElementById('vidViewer');
    var codeEl = document.getElementById('vidCode');
    var titleEl = document.getElementById('vidTitle');
    var descEl = document.getElementById('vidDesc');
    var indexEl = document.getElementById('vidIndex');
    var totalEl = document.getElementById('vidTotal');
    var dotsEl = document.getElementById('vidDots');
    var frameIframe = document.getElementById('vidPlayer');
    var emptyBox = document.getElementById('vidEmpty');
    var prevBtn = document.getElementById('vidPrev');
    var nextBtn = document.getElementById('vidNext');
    var closeBtn = document.getElementById('vidClose');

    var loaded = 0;
    VIDEOS.forEach(function (v) { if (v.yt) loaded += 1; });

    function pad(n) { return (n < 10 ? '0' : '') + n; }

    function embedUrl(id) {
      return 'https://www.youtube.com/embed/' + id +
        '?rel=0&modestbranding=1&playsinline=1&color=white';
    }

    /* ---------- archive cards ---------- */
    function buildCard(v, i) {
      var card = document.createElement('article');
      card.className = 'hud-card video-card';
      card.setAttribute('data-vid', String(i));
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', 'Open video ' + v.code + ': ' + v.title);

      var poster = document.createElement('div');
      poster.className = 'video-poster';

      var img = document.createElement('img');
      img.src = v.poster;
      img.alt = v.title + ' preview';
      img.loading = 'lazy';
      poster.appendChild(img);

      var play = document.createElement('span');
      play.className = 'video-play';
      play.appendChild(document.createElement('i'));
      poster.appendChild(play);

      var idTag = document.createElement('span');
      idTag.className = 'video-id';
      idTag.textContent = v.code;
      poster.appendChild(idTag);

      var dur = document.createElement('span');
      dur.className = 'video-dur';
      dur.textContent = v.dur;
      poster.appendChild(dur);

      var body = document.createElement('div');
      body.className = 'video-body';

      var h = document.createElement('h3');
      h.className = 'card-title';
      h.textContent = v.title;
      body.appendChild(h);

      var p = document.createElement('p');
      p.className = 'card-text';
      p.textContent = v.desc || 'Description pending.';
      if (!v.desc) p.classList.add('is-pending');
      body.appendChild(p);

      var slot = document.createElement('span');
      slot.className = 'video-slot';
      slot.textContent = v.yt ? 'STREAM READY' : 'SLOT RESERVED';
      body.appendChild(slot);

      card.appendChild(poster);
      card.appendChild(body);
      return card;
    }

    function renderArchive() {
      grid.innerHTML = '';
      VIDEOS.forEach(function (v, i) {
        grid.appendChild(buildCard(v, i));
      });

      if (noteEl) {
        noteEl.textContent = VIDEOS.length + ' SLOTS · ' + loaded + ' STREAM' +
          (loaded === 1 ? '' : 'S') + ' LOADED · SOURCE YOUTUBE';
      }
      if (emptyEl) emptyEl.hidden = VIDEOS.length > 0;
    }

    /* ---------- player overlay ---------- */
    var cursor = 0;
    var lastFocus = null;

    function isOpen() { return !viewer.hasAttribute('hidden'); }

    function paint() {
      var v = VIDEOS[cursor];
      if (!v) return;

      codeEl.textContent = v.code;
      titleEl.textContent = v.title;
      descEl.textContent = v.desc || 'DESCRIPTION PENDING — this write-up has not been added yet.';
      descEl.classList.toggle('is-pending', !v.desc);
      indexEl.textContent = pad(cursor + 1);
      totalEl.textContent = pad(VIDEOS.length);

      if (dotsEl) {
        dotsEl.innerHTML = '';
        if (VIDEOS.length <= 12) {
          for (var i = 0; i < VIDEOS.length; i++) {
            var dot = document.createElement('i');
            if (i === cursor) dot.className = 'is-on';
            dotsEl.appendChild(dot);
          }
        }
      }

      var solo = VIDEOS.length < 2;
      if (prevBtn) prevBtn.disabled = solo;
      if (nextBtn) nextBtn.disabled = solo;

      if (v.yt && frameIframe) {
        if (emptyBox) emptyBox.hidden = true;
        frameIframe.title = v.title;
        frameIframe.src = embedUrl(v.yt);
      } else if (frameIframe) {
        frameIframe.src = 'about:blank';
        frameIframe.title = 'No media loaded';
        if (emptyBox) emptyBox.hidden = false;
      }
    }

    function openAt(i) {
      cursor = i;
      lastFocus = document.activeElement;
      viewer.removeAttribute('hidden');
      viewer.setAttribute('aria-hidden', 'false');
      document.documentElement.classList.add('vid-open');
      paint();
      if (closeBtn) closeBtn.focus();
    }

    function closeViewer() {
      viewer.setAttribute('hidden', '');
      viewer.setAttribute('aria-hidden', 'true');
      document.documentElement.classList.remove('vid-open');
      /* stop any running playback and release the stream */
      if (frameIframe) frameIframe.src = 'about:blank';
      if (lastFocus && lastFocus !== document.body && lastFocus.focus) lastFocus.focus();
    }

    function step(dir) {
      if (VIDEOS.length < 2) return;
      cursor = (cursor + dir + VIDEOS.length) % VIDEOS.length;
      paint();
    }

    renderArchive();

    grid.addEventListener('click', function (e) {
      var card = e.target.closest ? e.target.closest('.video-card') : null;
      if (!card) return;
      openAt(parseInt(card.getAttribute('data-vid'), 10) || 0);
    });

    grid.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
      var card = e.target.closest ? e.target.closest('.video-card') : null;
      if (!card) return;
      e.preventDefault();
      openAt(parseInt(card.getAttribute('data-vid'), 10) || 0);
    });

    if (prevBtn) prevBtn.addEventListener('click', function () { step(-1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { step(1); });
    if (closeBtn) closeBtn.addEventListener('click', closeViewer);

    viewer.addEventListener('click', function (e) {
      if (e.target === viewer) closeViewer();
    });

    document.addEventListener('keydown', function (e) {
      if (!isOpen()) return;
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        closeViewer();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        step(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        step(-1);
      }
    });
  })();

  /* ===========================================================
     13. GO
     =========================================================== */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
