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
        color: PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)], a: 0.5 + Math.random() * 0.35 };
    }
    function draw() {
      var w = canvas.clientWidth, h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      list.forEach(function (p, i) {
        p.wob += 0.012; p.rot += p.vr; p.x += p.vx + Math.sin(p.wob) * 0.35; p.y += p.vy;
        if (p.y > h + 20 || p.x > w + 20) list[i] = make(false);
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
