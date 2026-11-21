// Sushiesta landing page: Nori animations, live popup demo, scroll effects and checkout.
(() => {
  const $ = (id) => document.getElementById(id);
  const config = window.SUSHIESTA || {};
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const now = () => performance.now() / 1000;

  // ---------------------------------------------------------------------------
  // Shared animation loop: draws every registered Nori canvas that's on screen.

  const scenes = [];
  function addScene(canvas, render) {
    const scene = { canvas, render, visible: true, ctx: canvas.getContext('2d'), w: 0, h: 0 };
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = canvas.getBoundingClientRect();
      scene.w = r.width; scene.h = r.height;
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      scene.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    new ResizeObserver(resize).observe(canvas);
    new IntersectionObserver(([e]) => { scene.visible = e.isIntersecting; }, { rootMargin: '120px' }).observe(canvas);
    scenes.push(scene);
    return scene;
  }

  function loop() {
    const t = now();
    for (const s of scenes) {
      if (!s.visible || !s.w) continue;
      s.ctx.clearRect(0, 0, s.w, s.h);
      s.render(s.ctx, s.w, s.h, t);
    }
    if (!reduceMotion) requestAnimationFrame(loop);
  }

  // Nori's arms and sparkles reach up to ~7% outside his box, so every Nori canvas is
  // 12% larger on each side than the spot he stands in (see .nori in styles.css) and he's
  // drawn in the middle — he can never be clipped.
  const PAD = 0.12;
  const drawSquare = (ctx, w, h, pose, t) => {
    const size = Math.min(w, h) / (1 + 2 * PAD);
    Nori.draw(ctx, pose, t, (w - size) / 2, (h - size) / 2, size, size);
  };

  // ---------------------------------------------------------------------------
  // Hero: Nori cycles through the breaks; tap him to celebrate.

  const ROUTINES = [
    ['overheadReach', 'Overhead Reach', 'Reach up tall and breathe.'],
    ['sideBend', 'Side Bend', 'Lean, hold, switch sides.'],
    ['eyeBreak', '20-20-20 Eye Break', 'Look far away for 20 seconds.'],
    ['neckRelease', 'Neck Release', 'Ear toward shoulder, gently.'],
    ['shoulderRolls', 'Shoulder Rolls', 'Up, back and down.'],
    ['toeTouch', 'Toe Touches', 'Fold forward, reach for your toes.'],
    ['chestOpener', 'Chest Opener', 'Arms wide, chest proud.'],
    ['walkAround', 'Walk Around', 'Get up and take a little walk.'],
  ];

  function setUpHero() {
    const hero = new Nori.Animator({ kind: 'waving' }, 'thriving');
    const bubble = $('heroBubble');
    let index = 0;
    let celebrating = false;
    const showBubble = (text) => {
      bubble.classList.add('swap');
      setTimeout(() => { bubble.textContent = text; bubble.classList.remove('swap'); }, 220);
    };
    const next = () => {
      if (celebrating) return;
      const [kind, name] = ROUTINES[index % 6];   // the walk reads better in its own strip
      index += 1;
      hero.transition({ kind: 'stretching', stretch: kind });
      showBubble(name);
    };
    setTimeout(next, 1800);
    setInterval(next, 6200);
    document.querySelector('.hero-stage').addEventListener('click', () => {
      celebrating = true;
      hero.transition({ kind: 'celebrating' });
      showBubble('Yay! 🎉');
      setTimeout(() => { celebrating = false; next(); }, 1900);
    });
    addScene($('heroNori'), (ctx, w, h, t) => drawSquare(ctx, w, h, hero.pose(t), t));
    if (reduceMotion) bubble.textContent = 'Overhead Reach';
  }

  // ---------------------------------------------------------------------------
  // Live popup demo — the real reminder, in miniature.

  function setUpDemo() {
    const DEMO_LOCK = 6;
    const nori = new Nori.Animator({ kind: 'idle' });
    const popup = $('popup');
    let openedAt = null;
    let outcome = null;
    let started = false;

    const copy = {
      null: ['Break time', "You've been working hard. Time to take a break!"],
      dismissed: ['Skipped', 'Okay… maybe next time.'],
      snoozed: ['Snoozed', 'Okay, fine… see you in 5 minutes.'],
      completed: ['Break complete', 'Nice work! Your body thanks you.'],
    };
    const setCopy = () => {
      $('demoEyebrow').textContent = copy[outcome][0];
      $('demoHeadline').textContent = copy[outcome][1];
      $('demoDismiss').disabled = $('demoSnooze').disabled = outcome !== null;
    };

    const open = () => {
      outcome = null;
      setCopy();
      popup.classList.remove('out');
      popup.classList.add('in');
      $('demoReplay').hidden = true;
      openedAt = now();
      nori.transition({ kind: 'waving' });
      setTimeout(() => { if (!outcome) nori.transition({ kind: 'stretching', stretch: 'overheadReach' }); }, 1600);
    };

    const finish = (result, state, delay) => {
      if (outcome) return;
      outcome = result;
      setCopy();
      nori.transition(state);
      setTimeout(() => {
        popup.classList.add('out');
        setTimeout(() => { popup.classList.remove('in'); $('demoReplay').hidden = false; }, 450);
      }, delay * 1000);
    };

    $('demoDismiss').onclick = () => finish('dismissed', { kind: 'disappointed' }, 3.2);
    $('demoSnooze').onclick = () => finish('snoozed', { kind: 'disappointed' }, 3.2);
    $('demoFeel').onclick = () => finish('completed', { kind: 'celebrating' }, 2.6);
    $('demoReplay').onclick = open;

    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started) { started = true; setTimeout(open, 400); }
    }, { threshold: 0.45 }).observe(document.querySelector('.desk'));

    // Feeling Better: locked while the fill sweeps across, white label revealed with the fill.
    const feel = $('demoFeel');
    const tick = () => {
      const elapsed = openedAt === null ? 0 : now() - openedAt;
      const progress = Math.min(1, elapsed / DEMO_LOCK);
      const ready = progress >= 1;
      const text = ready ? 'Feeling Better' : `🔒 Feeling Better in ${Math.max(1, Math.ceil(DEMO_LOCK - elapsed))}s`;
      if ($('demoLabel').textContent !== text) { $('demoLabel').textContent = text; $('demoLabelTop').textContent = text; }
      const width = feel.clientWidth;
      const fill = progress > 0.01 ? Math.max(feel.clientHeight, width * progress) : 0;
      $('demoFill').style.width = `${fill}px`;
      $('demoLabelTop').style.clipPath = `inset(0 ${Math.max(0, width - fill)}px 0 0)`;
      feel.disabled = !ready || outcome !== null;
      feel.classList.toggle('ready', ready && !outcome);
      requestAnimationFrame(tick);
    };
    tick();

    addScene($('demoNori'), (ctx, w, h, t) => drawSquare(ctx, w, h, nori.pose(t), t));
  }

  // ---------------------------------------------------------------------------
  // Gallery of all 8 breaks, each animating live.

  function setUpGallery() {
    const gallery = $('gallery');
    ROUTINES.forEach(([kind, name, line], i) => {
      const tile = document.createElement('article');
      tile.className = 'tile reveal';
      tile.innerHTML = `<span class="num">${i + 1}</span><div class="stage"><canvas></canvas></div><h3>${name}</h3><p>${line}</p>`;
      gallery.appendChild(tile);
      const offset = i * 1.7;
      const state = { kind: 'stretching', stretch: kind };
      addScene(tile.querySelector('canvas'), (ctx, w, h, t) => {
        // The walk tile marches in place using the "walking home" half of the cycle.
        const local = kind === 'walkAround'
          ? Nori.Walk.out + Nori.Walk.turn + 0.3 + ((t + offset) % 4.4)
          : t + offset;
        drawSquare(ctx, w, h, Nori.makePose(state, local), t);
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Nori strolls across the page.

  function setUpWalk() {
    const state = { kind: 'stretching', stretch: 'walkAround' };
    const crossing = 7.5;
    addScene($('walkNori'), (ctx, w, h, t) => {
      const size = h;
      const k = (t % crossing) / crossing;
      const x = -size + (w + 2 * size) * k;
      const pose = Nori.makePose(state, Nori.Walk.out + Nori.Walk.turn + 0.3 + (t % 4.4));
      const body = size / (1 + 2 * PAD);   // leave headroom for arms swinging up
      Nori.draw(ctx, pose, t, x - body / 2, size - body, body, body);
    });
  }

  function setUpPriceNori() {
    const nori = new Nori.Animator({ kind: 'idle' }, 'thriving');
    let celebrate = 0;
    setInterval(() => {
      celebrate += 1;
      nori.transition(celebrate % 2 ? { kind: 'celebrating' } : { kind: 'idle' });
    }, 3200);
    addScene($('priceNori'), (ctx, w, h, t) => drawSquare(ctx, w, h, nori.pose(t), t));
  }

  // ---------------------------------------------------------------------------
  // Page effects

  function setUpEffects() {
    const nav = $('nav');
    const onScroll = () => nav.classList.toggle('scrolled', scrollY > 10);
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('seen'); io.unobserve(e.target); }
    }, { threshold: 0.15 });
    document.querySelectorAll('.reveal').forEach((el, i) => {
      el.style.transitionDelay = `${(i % 3) * 70}ms`;
      io.observe(el);
    });

    if (!reduceMotion) {
      const grains = $('grains');
      for (let i = 0; i < 18; i += 1) {
        const g = document.createElement('i');
        g.style.left = `${Math.random() * 100}%`;
        g.style.animationDuration = `${14 + Math.random() * 16}s`;
        g.style.animationDelay = `${-Math.random() * 30}s`;
        g.style.opacity = `${0.35 + Math.random() * 0.5}`;
        g.style.transform = `scale(${0.7 + Math.random() * 0.8})`;
        grains.appendChild(g);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Platform detection + checkout

  function detectPlatform() {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod|Android/i.test(ua)) return 'phone';
    if (/Windows/i.test(ua)) return 'windows';
    return 'mac';
  }

  function toast(message) {
    const el = $('toast');
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { el.hidden = true; }, 3800);
  }

  function setUpCheckout() {
    const platform = detectPlatform();
    document.querySelectorAll('.price').forEach((el) => { el.textContent = config.price || '$4.99'; });
    if (platform === 'phone') document.querySelectorAll('.phone-note').forEach((el) => { el.hidden = false; });
    if (platform === 'windows') {
      // Lead with the Windows button for Windows visitors.
      const mac = $('heroMac'), win = $('heroWin');
      mac.classList.replace('primary', 'secondary');
      win.classList.replace('secondary', 'primary');
      win.lastChild.textContent = ' Get Nori for Windows';
      mac.lastChild.textContent = ' Mac';
      win.parentNode.insertBefore(win, mac);
    }

    // Polar's embedded checkout opens over the page; after payment we show install steps.
    const openCheckout = async () => {
      const hosted = () => { location.href = config.checkoutUrl; };
      if (!window.Polar?.EmbedCheckout) { hosted(); return; }
      // If Polar won't load inside the page (e.g. this site isn't on its embedding allow-list),
      // clear the half-open overlay after a few seconds and go to Polar's own checkout page.
      const before = new Set(document.body.children);
      const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 5000));
      try {
        const checkout = await Promise.race([
          window.Polar.EmbedCheckout.create(config.checkoutUrl, { theme: 'light' }),
          timeout,
        ]);
        if (!checkout) {
          [...document.body.children].forEach((el) => { if (!before.has(el)) el.remove(); });
          hosted();
          return;
        }
        checkout.addEventListener('success', (event) => {
          event.preventDefault();
          location.href = 'thanks.html';
        });
      } catch {
        hosted();
      }
    };

    document.querySelectorAll('.buy').forEach((button) => {
      button.addEventListener('click', () => {
        if (!config.checkoutUrl) {
          toast('Checkout opens very soon — Nori is putting on his apron 🍣');
          return;
        }
        openCheckout();
      });
    });
  }

  // ---------------------------------------------------------------------------

  addEventListener('DOMContentLoaded', () => {
    setUpGallery();   // before effects, so its tiles get the scroll-reveal too
    setUpEffects();
    setUpCheckout();
    setUpHero();
    setUpDemo();
    setUpWalk();
    setUpPriceNori();
    requestAnimationFrame(loop);
    addEventListener('load', () => document.documentElement.classList.add('smooth'));
    if (reduceMotion) setTimeout(() => { loop(); }, 100);
  });
})();
