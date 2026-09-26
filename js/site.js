/*
 * 908 Labs — site runtime
 * Recreates the interactive behaviour of the original Framer build without Framer:
 *   - character "blur-up" text reveal ............ [data-fx="chars"]
 *   - count-up milestones ........................ [data-counter-end]
 *   - infinite logo ticker ....................... [data-ticker]
 *   - 3D services carousel ....................... [data-carousel="services"]
 *   - hover states ............................... [data-hover]   (styles in /css/site.css)
 *   - phone navigation menu ...................... [data-nav]
 *   - smooth scrolling (Lenis) ................... <html data-smooth-scroll="1">
 * Timings/easings are the exact values from the original Framer project.
 */
(() => {
  'use strict';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------ easing */
  // Framer spring {bounce: 0, duration: d} == critically damped spring that
  // settles (|x| < 0.001) at t = d  ->  x(u) = 1 - (1 + k u) e^(-k u), k ~= 9.23
  function springLinear(k = 9.23, steps = 40) {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const y = u === 1 ? 1 : 1 - (1 + k * u) * Math.exp(-k * u);
      pts.push(y.toFixed(4));
    }
    return `linear(${pts.join(', ')})`;
  }
  const SPRING_EASE = CSS.supports('transition-timing-function', 'linear(0, 1)')
    ? springLinear() : 'cubic-bezier(0.2, 0.8, 0.2, 1)';

  /* ------------------------------------------------------------ 1. text reveal */
  const CHAR_FROM = {
    opacity: 0.001, filter: 'blur(10px)',
    transform: 'translateX(0px) translateY(10px) scale(1) rotate(0deg) skewX(0deg) skewY(0deg)',
  };
  const CHAR_TO = {
    opacity: 1, filter: 'blur(0px)',
    transform: 'translateX(0px) translateY(0px) scale(1) rotate(0deg) skewX(0deg) skewY(0deg)',
  };

  function splitChars(el) {
    const unset = new Set((el.dataset.fxUnset || '').split(',').filter(Boolean).map(Number));
    const text = el.textContent;
    el.setAttribute('aria-label', text);
    el.textContent = '';
    const chars = [];
    text.split(/( +)/).forEach((part, i, arr) => {
      if (!part) return;
      if (/^ +$/.test(part)) { el.appendChild(document.createTextNode(part)); return; }
      const wordIndex = arr.slice(0, i).filter(p => p && !/^ +$/.test(p)).length;
      const word = document.createElement('span');
      word.style.whiteSpace = unset.has(wordIndex) ? 'unset' : 'nowrap';
      word.setAttribute('aria-hidden', 'true');
      for (const ch of Array.from(part)) {
        const c = document.createElement('span');
        c.textContent = ch;
        c.style.display = 'inline-block';
        Object.assign(c.style, CHAR_FROM);
        word.appendChild(c);
        chars.push(c);
      }
      el.appendChild(word);
    });
    return chars;
  }

  function initTextReveal() {
    document.querySelectorAll('[data-fx="chars"]').forEach(el => {
      const chars = splitChars(el);
      chars.forEach((c, i) => {
        if (reduceMotion) { Object.assign(c.style, CHAR_TO); return; }
        const a = c.animate([CHAR_FROM, CHAR_TO], {
          duration: 1200, delay: i * 50, easing: SPRING_EASE, fill: 'forwards',
        });
        a.onfinish = () => { Object.assign(c.style, CHAR_TO); a.cancel(); };
      });
    });
  }

  /* ------------------------------------------------------------ 2. counters */
  // Original: Counter component, start 0, +1 every 150 ms while in viewport.
  function initCounters() {
    document.querySelectorAll('[data-counter-end]').forEach(el => {
      const end = parseFloat(el.dataset.counterEnd);
      const start = parseFloat(el.dataset.counterStart || '0');
      const speed = parseFloat(el.dataset.counterSpeed || '150');
      let value = start, timer = null;
      el.textContent = String(start);
      if (reduceMotion) { el.textContent = String(end); return; }
      const tick = () => {
        value = Math.min(end, value + 1);
        el.textContent = String(value);
        if (value >= end) { clearInterval(timer); timer = null; }
      };
      new IntersectionObserver(([e]) => {
        if (e.isIntersecting && value < end && !timer) timer = setInterval(tick, speed);
        else if (!e.isIntersecting && timer) { clearInterval(timer); timer = null; }
      }).observe(el);
    });
  }

  /* ------------------------------------------------------------ 3. ticker */
  // Original: Framer Ticker, direction left, speed px/s, gap 10.
  function initTickers() {
    document.querySelectorAll('[data-ticker]').forEach(section => {
      const ul = section.querySelector('ul');
      if (!ul) return;
      const speed = parseFloat(section.dataset.ticker || '100');
      const hoverFactor = parseFloat(section.dataset.tickerHover || '1');
      const gap = parseFloat(getComputedStyle(ul).columnGap || getComputedStyle(ul).gap) || 10;
      const originals = [...ul.children].filter(li => !li.hasAttribute('data-clone'));
      let anim = null;

      const build = () => {
        ul.querySelectorAll('[data-clone]').forEach(n => n.remove());
        if (anim) { anim.cancel(); anim = null; }
        const parent = section.offsetWidth;
        const first = originals[0], last = originals[originals.length - 1];
        const children = last.offsetLeft + last.offsetWidth - first.offsetLeft + gap;
        if (!parent || !children) return;
        const copies = Math.min(Math.round(parent / children * 2) + 1, 10);
        for (let n = 0; n < copies; n++) {
          originals.forEach(li => {
            const c = li.cloneNode(true);
            c.setAttribute('data-clone', '');
            c.setAttribute('aria-hidden', 'true');
            ul.appendChild(c);
          });
        }
        section.style.opacity = '1';
        if (reduceMotion) return;
        const distance = children + children * Math.round(parent / children);
        ul.style.willChange = 'transform';
        anim = ul.animate(
          { transform: ['translateX(0px)', `translateX(-${distance}px)`] },
          { duration: distance / speed * 1000, iterations: Infinity, easing: 'linear' });
      };
      ul.addEventListener('mouseenter', () => { if (anim) anim.playbackRate = hoverFactor; });
      ul.addEventListener('mouseleave', () => { if (anim) anim.playbackRate = 1; });
      document.addEventListener('visibilitychange', () => {
        if (!anim) return;
        document.hidden ? anim.pause() : anim.play();
      });
      let rt;
      new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(build, 100); }).observe(section);
      build();
    });
  }

  /* ------------------------------------------------------------ 4. services carousel */
  // Original: "Carousel" component, 4 variants cycling every 1.5 s,
  // transition 0.7 s cubic-bezier(.85,-.03,.21,1.04); pills switch after 0.35 s.
  const CAROUSEL = {
    variants: ['framer-v-vtqha7', 'framer-v-r7lori', 'framer-v-ph6smv', 'framer-v-cvq28e'],
    hold: 1500, duration: 700, ease: 'cubic-bezier(.85,-.03,.21,1.04)', pillDelay: 350,
    // [rotateY, translateZ] for each card in each variant
    cards: {
      'framer-1j0jns5': [[0, 0], [60, -220], [0, -360], [-60, -220]],
      'framer-1oxezk': [[-60, -220], [0, 1], [60, -220], [0, -360]],
      'framer-nd0e6t': [[0, -360], [-60, -220], [0, 1], [60, -220]],
      'framer-yldh2t': [[60, -220], [0, -360], [-60, -220], [0, 1]],
    },
    pills: ['framer-wj01af-container', 'framer-1mrghnp-container',
      'framer-1plfh6v-container', 'framer-1en48kh-container'],
  };
  const cardTransform = ([ry, z], dx = 0) =>
    `translateX(${dx}px) translateZ(${z}px) rotateY(${ry}deg)`;

  function initCarousels() {
    document.querySelectorAll('.framer-bGFer.framer-vtqha7, [data-carousel="services"]').forEach(root => {
      if (root.dataset.carouselInit) return;
      root.dataset.carouselInit = '1';
      const images = root.querySelector('.framer-1cxxn5');
      if (images) images.style.transform = 'perspective(1200px)';
      const cards = Object.keys(CAROUSEL.cards).map(c => [c, root.querySelector('.' + c)]).filter(x => x[1]);
      const pills = CAROUSEL.pills.map(c => root.querySelector('.' + c));
      const uiPill = root.querySelector('.framer-1en48kh-container');
      const labels = (root.dataset.labels || 'Web Design|Platform Development|Branding|UI/UX').split('|');
      let idx = 0;

      const applyStatic = i => {
        cards.forEach(([c, el]) => { el.style.transform = cardTransform(CAROUSEL.cards[c][i]); });
      };
      const setPills = i => {
        pills.forEach((p, n) => { if (p) p.style.opacity = n === i ? '1' : '0'; });
        if (uiPill) {
          const num = uiPill.querySelector('.framer-wcqigb h6, .framer-wcqigb p');
          const txt = uiPill.querySelector('.framer-19rcwc0 h6, .framer-19rcwc0 p');
          if (num) num.textContent = String(i + 1).padStart(2, '0');
          if (txt) txt.textContent = labels[i] || labels[0];
        }
      };
      applyStatic(0);

      const go = next => {
        const before = cards.map(([, el]) => el.offsetLeft);  // layout position, ignores transforms
        root.classList.remove(CAROUSEL.variants[idx]);
        root.classList.add(CAROUSEL.variants[next]);
        cards.forEach(([c, el], n) => {
          el.style.transform = cardTransform(CAROUSEL.cards[c][next]);
          const after = el.offsetLeft;
          const dx = before[n] - after;
          if (!reduceMotion) {
            el.animate([
              { transform: cardTransform(CAROUSEL.cards[c][idx], dx) },
              { transform: cardTransform(CAROUSEL.cards[c][next], 0) },
            ], { duration: CAROUSEL.duration, easing: CAROUSEL.ease });
          }
        });
        const from = idx;
        setTimeout(() => setPills(next), reduceMotion ? 0 : CAROUSEL.pillDelay);
        idx = next;
        return from;
      };
      const loop = () => setTimeout(() => { go((idx + 1) % 4); loop(); }, CAROUSEL.hold);
      if (!reduceMotion) loop();
    });
  }

  /* ------------------------------------------------------------ 5. hover states */
  // Hover variants from the Framer components. Each entry: root selector -> what changes.
  // Framer's own CSS keys some hover layouts off a literal ".hover" class, so we add it too.
  // Default Framer hover transition: spring {bounce: .2, duration: .4}.
  const HOVER_EASE = 'cubic-bezier(0.34, 1.25, 0.64, 1)';
  const WHITE = 'var(--token-b9a38ae6-6808-421e-8c6e-e2c5bc817a9d, rgb(255, 255, 255))';
  const HOVERS = [
    { // "Button" (Contact / Explore More): plus icon turns 90deg
      sel: '.framer-DHpVm.framer-v-5iwahy, .framer-DHpVm.framer-v-mmrlrr, .framer-S6sSW, .framer-ptrWy',
      on: el => el.querySelectorAll('.framer-p8oi1e > div, .framer-yb9dk9 > div, .framer-xbcxfs > div')
        .forEach(i => tween(i, { transform: 'rotate(90deg)' })),
      off: el => el.querySelectorAll('.framer-p8oi1e > div, .framer-yb9dk9 > div, .framer-xbcxfs > div')
        .forEach(i => tween(i, { transform: 'rotate(0deg)' })),
    },
    { // "Nav_tab": small white dot appears before the label
      sel: '.framer-DWDyA.framer-v-1lfgxol',
      on: el => {
        const wrap = el.querySelector('.framer-msadyk');
        if (!wrap || wrap.querySelector('.framer-11txwi6')) return;
        const dot = document.createElement('div');
        dot.className = 'framer-11txwi6';
        dot.style.cssText = 'background-color:rgb(255, 255, 255);border-radius:13px';
        wrap.prepend(dot);
        dot.animate([{ transform: 'scale(0)' }, { transform: 'scale(1)' }], { duration: 400, easing: HOVER_EASE });
      },
      off: el => el.querySelectorAll('.framer-11txwi6').forEach(d => d.remove()),
    },
    { // "Tab V2" footer links: underline grows (CSS via .hover) + label turns white
      sel: '.framer-v-oqizzt',
      on: el => el.querySelectorAll('.framer-10dwp0c').forEach(t => t.style.setProperty('--extracted-r6o4lv', 'rgba(255, 255, 255, 1)')),
      off: el => el.querySelectorAll('.framer-10dwp0c').forEach(t => t.style.setProperty('--extracted-r6o4lv', 'var(--token-17dd74c0-48e7-4cc6-8876-ee446770c16e, rgb(242, 242, 242))')),
    },
    { // social icons: 44% white -> solid white
      sel: '.framer-v-1snaxn2, .framer-v-1qw279p, .framer-v-1cnw714, .framer-v-18tdlwz',
      on: el => el.querySelectorAll('[style*="background-image"]').forEach(i => {
        i.style.backgroundImage = i.style.backgroundImage.replaceAll('rgba(255, 255, 255, 0.44)', 'rgb(255, 255, 255)');
      }),
      off: el => el.querySelectorAll('[style*="background-image"]').forEach(i => {
        i.style.backgroundImage = i.style.backgroundImage.replaceAll('rgb(255, 255, 255)', 'rgba(255, 255, 255, 0.44)');
      }),
    },
    { // "Button 2" (package enquiry submit)
      sel: '.framer-QrVfh.framer-v-17tyreu',
      on: el => tween(el, { backgroundColor: 'rgba(51, 51, 51, 0.85)' }, 200, 'cubic-bezier(.44,0,.56,1)'),
      off: el => tween(el, { backgroundColor: 'rgb(16, 16, 16)' }, 200, 'cubic-bezier(.44,0,.56,1)'),
    },
    { // "Button Form 2" (contact submit): label fades to 60%
      sel: '.framer-cv8oS.framer-v-1juyh6d',
      on: el => el.querySelectorAll('.framer-13na5k5').forEach(l => tween(l, { opacity: 0.6 })),
      off: el => el.querySelectorAll('.framer-13na5k5').forEach(l => tween(l, { opacity: 1 })),
    },
  ];

  function tween(el, props, duration = 400, easing = HOVER_EASE) {
    if (reduceMotion) { Object.assign(el.style, props); return; }
    const from = {};
    const cs = getComputedStyle(el);
    for (const k in props) from[k] = cs[k];
    el.animate([from, props], { duration, easing });
    Object.assign(el.style, props);
  }

  // Cards whose hover state adds/removes content (project, package, client and team cards):
  // the exact hovered markup recorded from the original site is stored in a sibling
  // <template data-hover-state> and swapped in on hover.
  const HOVER_STATES = () => document.querySelector('template[data-hover-states]');
  const MORPH = { dur: 420, ease: 'cubic-bezier(0.22, 1, 0.36, 1)' };
  const keyOf = e => [...e.classList].find(c => /^framer-[a-z0-9]{5,8}$/.test(c));

  // Card hovers (project, package, client and team cards) use the exact hovered markup recorded
  // from the original site. It is laid over the card and morphed in: text that exists in both
  // states glides to its new position, new elements fade in, so nothing jumps or ghosts.
  function snapshotHover(el) {
    const store = HOVER_STATES();
    const hovered = store && store.content.querySelector(`[data-hover-key="${el.dataset.hoverSnap}"]`);
    if (!hovered) return null;
    let layer = null, pairs = [], fresh = [], mode = 'morph', token = 0;

    const build = () => {
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      layer = hovered.cloneNode(true);
      ['data-hover-key', 'data-hover-snap', 'data-href', 'role', 'tabindex'].forEach(a => layer.removeAttribute(a));
      layer.setAttribute('data-hover-layer', '');
      Object.assign(layer.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', margin: '0', zIndex: '2' });
      // originals, by class, measured before the layer exists
      const orig = {};
      el.querySelectorAll('[class]').forEach(e => {
        if (e.closest('[data-hover-layer]')) return;
        const k = keyOf(e); if (!k) return;
        (orig[k] = orig[k] || []).push(e);
      });
      const bgBefore = getComputedStyle(el).backgroundColor;
      el.appendChild(layer);
      mode = getComputedStyle(layer).backgroundColor === bgBefore ? 'morph' : 'fade';
      pairs = []; fresh = [];
      const seen = {};
      layer.querySelectorAll('[class]').forEach(e => {
        const k = keyOf(e); if (!k) return;
        const i = seen[k] = (seen[k] || 0) + 1;
        const o = orig[k] && orig[k][i - 1];
        if (o) {
          if (e.matches('[data-framer-component-type="RichTextContainer"]')) {
            const a = o.getBoundingClientRect(), b = e.getBoundingClientRect();
            pairs.push({ e, dx: a.left - b.left, dy: a.top - b.top });
          }
        } else if (!e.parentElement.closest('[data-fresh]')) {
          e.setAttribute('data-fresh', ''); fresh.push(e);
        }
      });
      initHover(layer);
    };

    const run = dir => {
      const t = ++token;
      const opts = { duration: MORPH.dur, easing: MORPH.ease, fill: 'both' };
      const anims = [];
      if (reduceMotion) { if (dir < 0 && layer) { layer.remove(); layer = null; } return; }
      if (mode === 'fade') {
        anims.push(layer.animate([{ opacity: 0 }, { opacity: 1 }], { ...opts, direction: dir > 0 ? 'normal' : 'reverse' }));
      } else {
        // everything that didn't change is identical in both layers, so only morph the differences
        pairs.forEach(({ e, dx, dy }) => anims.push(e.animate(
          [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0px, 0px)' }],
          { ...opts, direction: dir > 0 ? 'normal' : 'reverse' })));
        fresh.forEach(e => anims.push(e.animate(
          [{ opacity: 0, transform: `${getComputedStyle(e).transform === 'none' ? '' : getComputedStyle(e).transform} scale(0.94)`.trim() },
           { opacity: 1, transform: getComputedStyle(e).transform }],
          { ...opts, direction: dir > 0 ? 'normal' : 'reverse' })));
      }
      if (dir < 0) Promise.all(anims.map(a => a.finished.catch(() => {}))).then(() => {
        if (t === token && layer) { layer.remove(); layer = null; }
      });
    };

    return {
      on: () => { if (!layer) build(); else layer.getAnimations({ subtree: true }).forEach(a => a.cancel()); run(1); },
      off: () => { if (!layer) return; layer.getAnimations({ subtree: true }).forEach(a => a.cancel()); run(-1); },
    };
  }

  function initHover(scope = document) {
    const bindOne = (el, on, off, cls = true) => {
      if (el.dataset.hoverBound) return;
      el.dataset.hoverBound = '1';
      let hovered = false;
      // Swapping markup under the cursor can fire extra enter/leave events; only act on real
      // transitions, and confirm a leave with the pointer's actual position.
      el.addEventListener('pointerenter', e => {
        if (e.pointerType !== 'mouse' || hovered) return;
        hovered = true;
        if (cls) el.classList.add('hover');
        on(el);
      });
      el.addEventListener('pointerleave', e => {
        if (e.pointerType !== 'mouse' || !hovered) return;
        const r = el.getBoundingClientRect();
        if (e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom) return;
        hovered = false;
        el.classList.remove('hover');
        off(el);
      });
    };
    scope.querySelectorAll('[data-hover-snap]:not([data-hover-layer] *)').forEach(el => {
      const s = snapshotHover(el);
      if (s) bindOne(el, s.on, s.off, false);
    });
    HOVERS.forEach(h => scope.querySelectorAll(h.sel).forEach(el => bindOne(el, h.on, h.off)));
  }

  /* ------------------------------------------------------------ 6. phone navigation */
  // Original: "Navigation" component, variant Phone <-> Phone Open,
  // spring {stiffness 400, damping 40, mass 1} (critically damped, settles in ~0.46 s).
  const NAV = { duration: 460 };
  function initNav() {
    document.querySelectorAll('nav[data-nav]').forEach(nav => {
      const tpl = nav.querySelector('template[data-nav-open]');
      if (!tpl) return;
      const closedNodes = [...nav.childNodes].filter(n => n !== tpl);
      const openFrag = () => tpl.content.cloneNode(true);

      const morph = (toOpen) => {
        const from = nav.getBoundingClientRect();
        [...nav.childNodes].forEach(n => { if (n !== tpl) n.remove(); });
        if (toOpen) nav.insertBefore(openFrag(), tpl);
        else closedNodes.forEach(n => nav.insertBefore(n, tpl));
        nav.classList.toggle(nav.dataset.navOpened, toOpen);
        nav.classList.toggle(nav.dataset.navClosed, !toOpen);
        nav.setAttribute('data-nav', toOpen ? 'open' : 'closed');
        nav.setAttribute('data-framer-name', toOpen ? 'Phone Open' : 'Phone');
        bind();
        const to = nav.getBoundingClientRect();
        if (reduceMotion || !from.width || !to.width) return;
        // FLIP the container size; counter-scale children so content isn't distorted
        const sx = from.width / to.width, sy = from.height / to.height;
        const ease = springLinear(9.23);
        nav.animate([
          { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${sx}, ${sy})`, transformOrigin: '0 0' },
          { transform: 'none', transformOrigin: '0 0' },
        ], { duration: NAV.duration, easing: ease });
        [...nav.children].forEach(ch => {
          if (ch === tpl) return;
          ch.animate([{ opacity: 0 }, { opacity: 1 }], { duration: NAV.duration * 0.6, easing: 'ease-out' });
        });
      };

      const bind = () => {
        nav.querySelectorAll('[data-nav-toggle]').forEach(btn => {
          if (btn.dataset.bound) return;
          btn.dataset.bound = '1';
          btn.addEventListener('click', e => { e.preventDefault(); morph(true); });
          btn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); morph(true); } });
        });
        nav.querySelectorAll('[data-nav-close]').forEach(btn => {
          if (btn.dataset.bound) return;
          btn.dataset.bound = '1';
          btn.addEventListener('click', e => { e.preventDefault(); morph(false); });
          btn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); morph(false); } });
        });
        initHover(nav);
      };
      bind();
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.dataset.nav === 'open') morph(false); });
    });
  }

  /* ------------------------------------------------------------ 7. forms */
  // Buttons keep Framer's states: Loading (spinner), Success ("Thank you"), Error.
  const FORM_BUTTONS = {
    // "Button Form 2" (footer / contact forms)
    'framer-1juyh6d': {
      states: { idle: 'framer-v-1juyh6d', loading: 'framer-v-6zels', success: 'framer-v-xshp1j', error: 'framer-v-150318b' },
      label: '.framer-13na5k5',
      spinnerBg: 'conic-gradient(from 0deg at 50% 50%, rgba(255, 255, 255, 0) 7.2deg, rgb(0, 0, 0) 342deg)',
      success: { text: 'Thank you', css: '--framer-font-family:"undefined", monospace;--framer-font-size:14px;--framer-font-weight:500;--framer-letter-spacing:-0.02em;--framer-line-height:1.3em;--framer-text-alignment:left;--framer-text-transform:uppercase' },
      error: { text: 'Something went wrong', css: '--framer-font-family:"undefined", monospace;--framer-font-size:14px;--framer-font-weight:500;--framer-letter-spacing:-0.02em;--framer-line-height:1.3em;--framer-text-alignment:left;--framer-text-color:rgb(255, 38, 38)', bg: 'rgba(255, 34, 68, 0.15)' },
    },
    // "Button 2" (package enquiry forms)
    'framer-17tyreu': {
      states: { idle: 'framer-v-17tyreu', loading: 'framer-v-erxs67', success: 'framer-v-1h87yrx', error: 'framer-v-1jd2z8b' },
      label: '.framer-1avmpxp',
      spinnerBg: 'conic-gradient(from 0deg at 50% 50%, rgba(255, 255, 255, 0) 7.2deg, rgb(255, 255, 255) 342deg)',
      success: { text: 'Thank you', css: '--framer-font-family:"Inter", "Inter Placeholder", sans-serif;--framer-font-size:14px;--framer-font-weight:600;--framer-text-color:rgb(255, 255, 255)' },
      error: { text: 'Something went wrong', css: '--framer-font-family:"Inter", "Inter Placeholder", sans-serif;--framer-font-size:14px;--framer-font-weight:600;--framer-text-color:rgb(255, 34, 68)', bg: 'rgba(255, 34, 68, 0.15)' },
    },
  };

  function initForms() {
    document.querySelectorAll('form').forEach(form => {
      const btn = form.querySelector('button');
      if (!btn) return;
      const kind = Object.keys(FORM_BUTTONS).find(c => btn.classList.contains(c));
      const cfg = kind && FORM_BUTTONS[kind];
      const label = cfg && btn.querySelector(cfg.label);
      const labelHTML = label ? label.innerHTML : '';
      const bg = btn.style.backgroundColor;
      let spinner = null;

      const setState = state => {
        if (!cfg) return;
        Object.values(cfg.states).forEach(c => btn.classList.remove(c));
        btn.classList.add(cfg.states[state]);
        btn.disabled = state === 'loading';
        btn.style.backgroundColor = state === 'error' ? cfg.error.bg : bg;
        if (spinner) { spinner.remove(); spinner = null; }
        if (label) {
          label.style.display = state === 'loading' ? 'none' : '';
          if (state === 'idle') label.innerHTML = labelHTML;
          if (state === 'success' || state === 'error') {
            const s = cfg[state];
            label.innerHTML = `<p class="framer-text" style='${s.css}'>${s.text}</p>`;
          }
        }
        if (state === 'loading') {
          spinner = document.createElement('div');
          spinner.className = 'form-spinner';
          spinner.innerHTML = `<div style="background:${cfg.spinnerBg}"><i></i></div>`;
          btn.appendChild(spinner);
        }
      };

      form.addEventListener('submit', async e => {
        e.preventDefault();
        if (!form.reportValidity()) return;
        setState('loading');
        const data = Object.fromEntries(new FormData(form).entries());
        data._page = location.pathname;
        try {
          const r = await fetch(form.dataset.endpoint || '/api/contact', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
          });
          if (!r.ok) throw new Error(String(r.status));
          setState('success');
          form.reset();
        } catch (err) {
          setState('error');
          setTimeout(() => setState('idle'), 4000);
        }
      });
    });
  }

  /* ------------------------------------------------------------ 7b. clickable cards */
  function initCardLinks() {
    document.querySelectorAll('[data-href]').forEach(card => {
      const go = e => {
        if (e.target.closest('a')) return;           // inner links handle themselves
        if (e.metaKey || e.ctrlKey) window.open(card.dataset.href, '_blank');
        else location.href = card.dataset.href;
      };
      card.addEventListener('click', go);
      card.addEventListener('keydown', e => { if (e.key === 'Enter') go(e); });
    });
  }

  /* ------------------------------------------------------------ 8. smooth scroll */
  // Original: "Smooth Scroll" component (Lenis) with intensity 10 -> duration 1.0
  function initSmoothScroll() {
    if (reduceMotion || typeof window.Lenis !== 'function') return;
    document.querySelectorAll('*').forEach(n => {
      if (getComputedStyle(n).overflow === 'auto') n.setAttribute('data-lenis-prevent', 'true');
    });
    const lenis = new window.Lenis({ duration: 1 });
    window.__lenis = lenis;
    const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    // keep anchor links (#contact-us etc.) smooth
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href*="#"]');
      if (!a) return;
      const url = new URL(a.href, location.href);
      if (url.pathname !== location.pathname || !url.hash) return;
      const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (target) { e.preventDefault(); lenis.scrollTo(target); history.replaceState(null, '', url.hash); }
    });
  }

  /* ------------------------------------------------------------ boot */
  const boot = () => {
    initTextReveal();
    initCounters();
    initTickers();
    initCarousels();
    initHover();
    initNav();
    initForms();
    initCardLinks();
    initSmoothScroll();
    document.documentElement.classList.add('js-ready');
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
