/* MASAÉ — shared behaviour for every page.
   Exposes window.MASAE = { reduceMotion, lenis, isTouch, petals(canvas) }.
   Load after GSAP/ScrollTrigger/Lenis and before any page script. */
window.MASAE = (function () {
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isTouch = window.matchMedia('(pointer: coarse)').matches;

  // Register once, before anything touches ScrollTrigger (GSAP requirement)
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
  }

  /* ---------- Phone & tablet menu ---------- */
  var menuBtn = document.getElementById('menuBtn');
  var mobileMenu = document.getElementById('mobileMenu');
  var lenis = null;

  function setMenu(open) {
    document.documentElement.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    menuBtn.querySelector('.menu-label').textContent = open ? 'Close' : 'Menu';
    if (lenis) { open ? lenis.stop() : lenis.start(); }
  }
  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', function () { setMenu(!document.documentElement.classList.contains('menu-open')); });
    mobileMenu.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
  }

  /* ---------- Header: solid once the opening scene has passed ---------- */
  var header = document.getElementById('header');
  var headerWatch = document.querySelector('[data-header-watch]');   // the page's opening scene
  function updateHeader() {
    if (!header) return;
    var past = headerWatch ? headerWatch.getBoundingClientRect().bottom < 80 : window.scrollY > 40;
    header.classList.toggle('is-solid', past);
  }
  window.addEventListener('scroll', updateHeader, { passive: true });
  window.addEventListener('resize', updateHeader);
  updateHeader();

  /* ---------- Smooth wheel scrolling (desktop pointers only) ---------- */
  if (window.Lenis && !isTouch && !reduceMotion) {
    // lerp follows the wheel frame by frame; a long duration made scroll-linked scenes feel laggy
    lenis = new Lenis({ lerp: 0.12, wheelMultiplier: 1, smoothWheel: true, syncTouch: false });
    if (window.ScrollTrigger) lenis.on('scroll', ScrollTrigger.update);
    if (window.gsap) {
      gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);
    }
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href');
        if (id.length < 2) return;
        var el = document.querySelector(id);
        if (!el) return;
        e.preventDefault();
        lenis.scrollTo(el, { duration: 1.6 });
      });
    });
  }

  /* ---------- Footer newsletter (prototype: validates, does not send) ---------- */
  var newsForm = document.getElementById('newsForm');
  if (newsForm) {
    newsForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = document.getElementById('newsEmail').value.trim();
      document.getElementById('newsNote').textContent = /.+@.+\..+/.test(v)
        ? 'Thank you. (Prototype: sign-up is not connected yet.)'
        : 'Please enter a valid email address.';
    });
  }

  /* ---------- Drifting petals, used by several pages ---------- */
  var PETAL_COLORS = ['#EBC9C3', '#E2B3AE', '#F4EBDD', '#C98F8C', '#7D241E'];
  function petals(canvas, opts) {
    if (!canvas || reduceMotion) return;
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var count = opts.count || (window.innerWidth < 768 ? 8 : 14);
    var alpha = opts.alpha == null ? 1 : opts.alpha;
    var list = [], visible = true;

    function size() {
      var w = Math.round(canvas.clientWidth), h = Math.round(canvas.clientHeight);
      if (canvas.width === w && canvas.height === h) return;
      canvas.width = w; canvas.height = h;
    }
    function make(anywhere) {
      var w = canvas.clientWidth, h = canvas.clientHeight;
      return { x: Math.random() * w * 1.1 - w * 0.1, y: anywhere ? Math.random() * h : -20,
        r: 5 + Math.random() * 7, vx: 0.15 + Math.random() * 0.35, vy: 0.25 + Math.random() * 0.45,
        rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.02, wob: Math.random() * Math.PI * 2,
        color: PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)], a: 0.5 + Math.random() * 0.35,
        depth: 0.5 + Math.random() * 0.9 };   // nearer petals answer the scroll more
    }
    var lastScroll = window.scrollY, drift = 0;
    function draw() {
      var w = canvas.clientWidth, h = canvas.clientHeight;
      // how far the page moved since the last frame, used to push the petals along
      var now = window.scrollY, delta = now - lastScroll;
      lastScroll = now;
      drift = drift * 0.86 + delta * (opts.scrollDrift || 0);
      ctx.clearRect(0, 0, w, h);
      list.forEach(function (p, i) {
        p.wob += 0.012; p.rot += p.vr; p.x += p.vx + Math.sin(p.wob) * 0.35; p.y += p.vy + drift * p.depth;
        if (p.y > h + 30 || p.x > w + 30) list[i] = make(false);
        else if (p.y < -60) { p.y = h + 20; p.x = Math.random() * w; }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.globalAlpha = p.a * alpha; ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.moveTo(0, -p.r);
        ctx.bezierCurveTo(p.r * 0.9, -p.r * 0.6, p.r * 0.7, p.r * 0.7, 0, p.r);
        ctx.bezierCurveTo(-p.r * 0.7, p.r * 0.7, -p.r * 0.9, -p.r * 0.6, 0, -p.r);
        ctx.fill(); ctx.restore();
      });
    }
    function loop() { if (visible) draw(); requestAnimationFrame(loop); }

    size();
    window.addEventListener('resize', size);
    if (window.ResizeObserver) new ResizeObserver(size).observe(canvas);
    for (var i = 0; i < count; i++) list.push(make(true));
    new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }).observe(canvas);
    requestAnimationFrame(loop);
  }

  /* ---------- Reveal on scroll ----------
     ScrollTrigger.batch() groups everything that enters together into one staggered
     animation, instead of creating a separate trigger per element. */
  function reveals() {
    var els = document.querySelectorAll('[data-reveal]');
    if (!els.length) return;
    if (reduceMotion || !window.gsap || !window.ScrollTrigger) {
      gsap.set && gsap.set(els, { clearProps: 'all' });
      els.forEach(function (el) { el.style.opacity = 1; el.style.transform = 'none'; });
      return;
    }
    gsap.set(els, { autoAlpha: 0, y: 26 });
    ScrollTrigger.batch(els, {
      start: 'top 88%',
      once: true,
      onEnter: function (batch) {
        gsap.to(batch, { autoAlpha: 1, y: 0, duration: 1.1, ease: 'power2.out', stagger: 0.08, overwrite: true });
      }
    });
  }

  /* ---------- The footer's botanical border draws itself in ---------- */
  function footerBorder() {
    var paths = document.querySelectorAll('.footer-border .draw');
    if (!paths.length || reduceMotion || !window.gsap || !window.ScrollTrigger) return;
    paths.forEach(function (path) {
      var len = path.getTotalLength();
      gsap.fromTo(path, { strokeDasharray: len, strokeDashoffset: len },
        { strokeDashoffset: 0, duration: 2.2, ease: 'power2.inOut',
          scrollTrigger: { trigger: '.site-footer', start: 'top 92%', once: true } });
    });
  }

  /* ---------- Recalculate trigger positions once the page has really settled ----------
     Images and web fonts change the layout after load, which moves every start/end. */
  function refreshWhenSettled() {
    if (!window.ScrollTrigger) return;
    var refresh = function () { ScrollTrigger.refresh(); };
    window.addEventListener('load', refresh);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
    document.querySelectorAll('img').forEach(function (img) {
      if (!img.complete) img.addEventListener('load', refresh, { once: true });
    });
  }
  refreshWhenSettled();

  return { reduceMotion: reduceMotion, isTouch: isTouch, lenis: lenis, petals: petals,
           reveals: reveals, footerBorder: footerBorder, updateHeader: updateHeader };
})();

/* ---------------------------------------------------------------------------
   Background music with a mute button, on every page.
   - Browsers block sound until the visitor interacts, so the music starts on the
     first click, tap or key press, and fades in gently.
   - The button mutes / unmutes; the choice is remembered on later pages.
   - The track resumes roughly where it left off when moving between pages.
   - It pauses while the tab is hidden, and never autoplays loudly.
--------------------------------------------------------------------------- */
(function () {
  var SCRIPT = document.currentScript && document.currentScript.src;
  if (!SCRIPT) return;
  var SRC = new URL('../audio/masae-music.mp3', SCRIPT).href;
  var TARGET = 0.32;                    // a quiet background level
  var KEY_PREF = 'masae-sound', KEY_TIME = 'masae-sound-time';

  function read(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function write(k, v) { try { window.localStorage.setItem(k, v); } catch (e) {} }
  function sread(k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } }
  function swrite(k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) {} }

  var wantSound = read(KEY_PREF) !== 'off';   // sound is on unless the visitor muted it
  var audio = new Audio();
  audio.src = SRC; audio.loop = true; audio.preload = 'none'; audio.volume = 0;
  var fadeTimer = null, started = false, silent = false, starting = false;   // silent: already playing, muted, waiting for the first interaction

  /* ---------- the button ---------- */
  var btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'sound-btn';
  btn.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M4 9.5v5h3.6L12.5 19V5L7.6 9.5H4z"/>' +
      '<path class="waves" d="M16 9a4.2 4.2 0 0 1 0 6M18.6 6.6a7.6 7.6 0 0 1 0 10.8"/>' +
      '<path class="slash" d="M17 8.5l4.5 7M21.5 8.5l-4.5 7"/>' +
    '</svg><span class="sound-tip" aria-hidden="true"></span>';
  document.body.appendChild(btn);

  function paint() {
    var on = wantSound && started && !audio.paused && !silent;
    btn.classList.toggle('is-muted', !on);
    btn.classList.toggle('is-waiting', wantSound && !on);   // gentle pulse: one click away from sound
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    var label = on ? 'Mute background music' : (wantSound ? 'Play background music' : 'Unmute background music');
    btn.setAttribute('aria-label', label);
    btn.querySelector('.sound-tip').textContent = on ? 'Sound on' : (wantSound ? 'Click anywhere for sound' : 'Sound off');
  }

  /* ---------- fading (timers, not rAF, so it also works in background tabs) ---------- */
  function fadeTo(v, ms, done) {
    clearInterval(fadeTimer);
    var from = audio.volume, steps = Math.max(1, Math.round(ms / 40)), i = 0;
    fadeTimer = setInterval(function () {
      i++; audio.volume = Math.max(0, Math.min(1, from + (v - from) * (i / steps)));
      if (i >= steps) { clearInterval(fadeTimer); if (done) done(); }
    }, 40);
  }
  function start() {
    if (!wantSound || document.hidden || starting) return Promise.resolve(false);
    starting = true;
    audio.preload = 'auto';
    var saved = parseFloat(sread(KEY_TIME));
    if (!started && !silent && saved > 0) {
      var seek = function () { try { if (audio.currentTime < 1) audio.currentTime = saved % (audio.duration || 1e9); } catch (e) {} };
      if (audio.readyState >= 1) seek(); else audio.addEventListener('loadedmetadata', seek, { once: true });
    }
    audio.muted = false;
    var p = audio.play();
    return (p && p.then ? p : Promise.resolve()).then(function () {
      started = true; silent = false; starting = false; fadeTo(TARGET, 1800); paint(); return true;
    }).catch(function () {
      // Blocked until the visitor interacts: keep the music running silently so it is already
      // playing the moment they first click, tap or press a key, then fade the sound in.
      audio.muted = true;
      var q = audio.play();
      return (q && q.then ? q : Promise.resolve()).then(function () {
        silent = true; starting = false; paint(); return false;
      }).catch(function () { starting = false; paint(); return false; });
    });
  }
  function stop() { silent = false; fadeTo(0, 500, function () { audio.pause(); audio.muted = false; paint(); }); }

  /* ---------- the visitor's controls ---------- */
  btn.addEventListener('click', function () {
    if (wantSound && started && !audio.paused && !silent) { wantSound = false; write(KEY_PREF, 'off'); stop(); }
    else { wantSound = true; write(KEY_PREF, 'on'); start(); }
    paint();
  });

  // the first real interaction anywhere on the page starts the music (unless it is on the button itself)
  function firstGesture(e) {
    if (e.target && e.target.closest && e.target.closest('.sound-btn')) return;
    if (!started) start();
    if (started || !wantSound) removeGestureListeners();
  }
  var EVENTS = ['pointerdown', 'mousedown', 'click', 'keydown', 'touchend'];
  function removeGestureListeners() { EVENTS.forEach(function (t) { document.removeEventListener(t, firstGesture, true); }); }
  EVENTS.forEach(function (t) { document.addEventListener(t, firstGesture, true); });

  // keep the position for the next page; stay quiet while the tab is hidden
  function remember() { if (started) swrite(KEY_TIME, String(audio.currentTime || 0)); }
  setInterval(remember, 2000);
  window.addEventListener('pagehide', remember);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { remember(); if (started && !audio.paused) { audio.pause(); } }
    else if (wantSound && (started || silent)) { start(); }
  });

  paint();
  start().then(function (audible) {
    if (!audible && wantSound) {                       // hint for desktop visitors, then it quietly retires
      btn.classList.add('show-tip'); setTimeout(function () { btn.classList.remove('show-tip'); }, 7000);
    }
  });   // plays straight away if the browser already allows sound for this site
})();
