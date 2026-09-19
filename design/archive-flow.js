(() => {
  'use strict';
  const canvas = document.querySelector('.archive-flow');
  const main = document.querySelector('main');
  if (!canvas || !main) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const mask = document.createElement('canvas');
  const quiet = mask.getContext('2d');
  if (!quiet) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const contrast = matchMedia('(prefers-contrast: more), (forced-colors: active)');
  const mobile = matchMedia('(max-width: 760px)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const reading = document.body.classList.contains('document-page');
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  // Match the portfolio's grey/gold threads; this profile moves more visibly.
  const profile = { gain: reading ? .48 : 1, speed: .18, displacement: 20 };
  const labels = [...document.querySelectorAll(
    '.hero h1, .hero-description, .hero-actions, .count-block, .hero-counts, ' +
    '.section-heading, .timeline-content, .row-main, .project-intro, .start-reading, ' +
    '.archive-about, .doc-top, .doc-reading, .toc, .site-footer'
  )];
  let width = 0, height = 0, ratio = 1;
  let frameId = 0, lastFrame = 0, time = 0;
  let needsMeasure = true, needsMask = true, scrollAt = -1000;
  let printing = false, pageHidden = false;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0, strength: 0, target: 0 };
  const visible = () => !document.hidden && !pageHidden && !printing && !contrast.matches;
  const moving = () => visible() && !reduced.matches;

  function measure() {
    width = document.documentElement.clientWidth;
    height = window.innerHeight;
    ratio = Math.min(devicePixelRatio || 1, mobile.matches ? 1.25 : 1.5);
    for (const surface of [canvas, mask]) {
      surface.width = Math.round(width * ratio);
      surface.height = Math.round(height * ratio);
    }
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    quiet.setTransform(ratio, 0, 0, ratio, 0, 0);
    needsMeasure = false;
    needsMask = true;
  }

  function measureMask() {
    quiet.clearRect(0, 0, width, height);
    // Cache softly feathered text protection. No layout reads during drawing.
    for (const element of labels) {
      let r = element.getBoundingClientRect();
      if (element.matches('.hero h1, .hero-description')) {
        const range = document.createRange();
        range.selectNodeContents(element);
        r = range.getBoundingClientRect();
      }
      if (!r.width || !r.height || r.bottom < -60 || r.top > height + 60) continue;
      const left = Math.max(-60, r.left - 10);
      const right = Math.min(width + 60, r.right + 10);
      const top = Math.max(-60, r.top - 8);
      const bottom = Math.min(height + 60, r.bottom + 8);
      // Use the portfolio's feathered elliptical masks, avoiding rectangular
      // cut-outs as the moving field passes behind individual labels.
      quiet.save();
      quiet.translate((left + right) / 2, (top + bottom) / 2);
      quiet.scale((right - left) / 2 + 90, (bottom - top) / 2 + 55);
      const fade = quiet.createRadialGradient(0, 0, 0, 0, 0, 1);
      fade.addColorStop(0, 'rgba(0,0,0,.98)');
      fade.addColorStop(.52, 'rgba(0,0,0,.93)');
      fade.addColorStop(.78, 'rgba(0,0,0,.45)');
      fade.addColorStop(1, 'rgba(0,0,0,0)');
      quiet.fillStyle = fade;
      quiet.fillRect(-1, -1, 2, 2);
      quiet.restore();
    }
    needsMask = false;
  }

  function ribbon({ y, phase, count, gain, tilt, spread }) {
    const amplitude = Math.min(height * .14, 125);
    const lightX = width * (.54 + Math.sin(time * .12 + phase) * .12);
    const ink = ctx.createLinearGradient(lightX - width * .66, 0, lightX + width * .66, height * .4);
    ink.addColorStop(0, 'rgba(123,129,139,0)');
    ink.addColorStop(.15, 'rgba(133,134,133,.23)');
    ink.addColorStop(.38, 'rgba(167,147,99,.36)');
    ink.addColorStop(.59, 'rgba(217,185,114,.48)');
    ink.addColorStop(.82, 'rgba(153,143,119,.27)');
    ink.addColorStop(1, 'rgba(123,129,139,0)');
    ctx.strokeStyle = ink;
    ctx.lineWidth = .8;
    ctx.lineCap = ctx.lineJoin = 'round';
    const steps = mobile.matches ? 64 : 110;
    for (let line = 0; line < count; line++) {
      const n = line / (count - 1);
      ctx.globalAlpha = profile.gain * gain * (.38 + .62 * Math.sin(Math.PI * (.08 + n * .84)));
      ctx.beginPath();
      for (let step = 0; step <= steps; step++) {
        const u = step / steps;
        const envelope = Math.pow(Math.sin(u * Math.PI), 1.1);
        const x = width * (-.12 + u * 1.24);
        const fan = .26 + .74 * Math.sin(u * Math.PI) ** 2;
        const wave = Math.sin(u * 5.2 - time * profile.speed + phase + n * .70);
        const fold = Math.sin(u * 9.0 + time * .23 + phase + n * .85);
        let py = height * y + width * tilt * (u - .5) +
          wave * amplitude * envelope + (n - .5) * spread * fan +
          fold * profile.displacement * envelope;
        const dx = x - pointer.x, dy = py - pointer.y;
        const influence = Math.exp(-(dx * dx + dy * dy) / (2 * 165 * 165));
        py += influence * pointer.strength * clamp(dy * .055, -5, 5);
        if (!step) ctx.moveTo(x, py);
        else ctx.lineTo(x, py);
      }
      ctx.stroke();
    }
  }

  function paint() {
    ctx.clearRect(0, 0, width, height);
    if (!visible()) return;
    ctx.save();
    ribbon({ y: .31, phase: 1.5, count: mobile.matches ? 10 : 18, gain: mobile.matches ? .65 : 1, tilt: -.11, spread: 122 });
    ribbon({ y: .76, phase: 4.8, count: mobile.matches ? 7 : 12, gain: mobile.matches ? .40 : .68, tilt: -.05, spread: 106 });
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(mask, 0, 0, width, height);
    const ends = ctx.createLinearGradient(0, 0, 0, height);
    ends.addColorStop(0, 'rgba(0,0,0,.85)');
    ends.addColorStop(.12, 'rgba(0,0,0,0)');
    ends.addColorStop(.85, 'rgba(0,0,0,0)');
    ends.addColorStop(1, 'rgba(0,0,0,.7)');
    ctx.fillStyle = ends;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  function frame(now) {
    frameId = 0;
    const interval = 1000 / (mobile.matches ? 24 : 30);
    if (needsMeasure) measure();
    const changed = needsMask;
    if (needsMask) measureMask();
    const elapsed = now - lastFrame;
    if (changed || elapsed >= interval) {
      lastFrame = now;
      // Prioritize scrolling; resume smoothly without jumping ahead in time.
      if (moving() && now - scrollAt > 120) {
        time += Math.min(elapsed / 1000, .07);
        pointer.x += (pointer.tx - pointer.x) * .09;
        pointer.y += (pointer.ty - pointer.y) * .09;
        pointer.strength += (pointer.target - pointer.strength) * .08;
      }
      if (changed || now - scrollAt > 120) paint();
    }
    if (moving()) frameId = requestAnimationFrame(frame);
  }

  function schedule() {
    if (!frameId) { lastFrame = performance.now(); frameId = requestAnimationFrame(frame); }
  }
  function sync() {
    cancelAnimationFrame(frameId);
    frameId = 0;
    if (!moving()) pointer.strength = pointer.target = 0;
    if (needsMeasure) measure();
    if (needsMask) measureMask();
    paint();
    if (moving()) schedule();
  }
  window.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || !fine.matches || !moving()) return;
    pointer.tx = event.clientX;
    pointer.ty = event.clientY;
    // Only empty space reacts. Text and controls retain their quiet backdrop.
    pointer.target = event.target.closest('a, button, input, select, .prose, .hero-copy, .row-main') ? 0 : 1;
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { pointer.target = 0; });
  window.addEventListener('scroll', () => {
    scrollAt = performance.now();
    needsMask = true;
    schedule();
  }, { passive: true });
  window.addEventListener('resize', () => { needsMeasure = true; schedule(); });
  if ('ResizeObserver' in window) new ResizeObserver(() => { needsMask = true; schedule(); }).observe(main);
  [reduced, contrast, mobile, fine].forEach(query => query.addEventListener('change', () => { needsMeasure = true; sync(); }));
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('beforeprint', () => { printing = true; sync(); });
  window.addEventListener('afterprint', () => { printing = false; sync(); });
  window.addEventListener('pagehide', () => { pageHidden = true; cancelAnimationFrame(frameId); frameId = 0; });
  window.addEventListener('pageshow', () => { pageHidden = false; needsMeasure = true; sync(); });
  document.fonts?.ready.then(() => { needsMask = true; schedule(); });
  sync();
})();
