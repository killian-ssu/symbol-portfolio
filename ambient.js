(() => {
  'use strict';
  const canvas = document.getElementById('ambient-lines');
  const reader = document.getElementById('reader');
  const folio = document.getElementById('document');
  const surface = canvas?.parentElement;
  const workspace = document.querySelector('.workspace');
  if (!canvas || !reader || !folio || !surface || !workspace) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const wide = matchMedia('(min-width: 701px)');
  const contrast = matchMedia('(prefers-contrast: more), (forced-colors: active)');
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  let width = 0;
  let height = 0;
  let bounds;
  let paperLeft = 0;
  let paperRight = 0;
  let readerTop = 0;
  let workspaceTop = 0;
  let labelMasks = [];
  let frameId = 0;
  let lastFrame = 0;
  let lastScroll = -1000;
  let time = 0;
  let printing = false;
  let pageHidden = false;
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0, strength: 0, targetStrength: 0 };

  const visible = () => wide.matches && width > 0 && height > 0 &&
    !document.hidden && !printing && !pageHidden && !contrast.matches && !reader.classList.contains('zoomed');
  const moving = () => visible() && fine.matches && !reduced.matches &&
    !document.body.classList.contains('focus-mode');

  function measure() {
    // A single viewport-sized field sits behind the masthead, toolbar and reader.
    bounds = surface.getBoundingClientRect();
    width = surface.clientWidth;
    height = surface.clientHeight;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const paper = folio.getBoundingClientRect();
    paperLeft = clamp(paper.left - bounds.left, 0, width);
    paperRight = clamp(paper.right - bounds.left, paperLeft, width);
    readerTop = reader.getBoundingClientRect().top - bounds.top;
    workspaceTop = workspace.getBoundingClientRect().top - bounds.top;
    labelMasks = [...document.querySelectorAll('.identity, .edition, .header-actions, .reader-context, .toolbar-actions')]
      .map(node => node.getBoundingClientRect())
      .filter(rect => rect.width && rect.height)
      .map(rect => ({ x: rect.left - bounds.left + rect.width / 2, y: rect.top - bounds.top + rect.height / 2,
        rx: rect.width / 2 + 24, ry: rect.height / 2 + 16 }));
  }

  // Broad right-hand fields cross UI boundaries and extend behind the pages.
  // Their scale follows the window, rather than the width of the narrow gutter.
  function composition() {
    return [
      {
        count: 14, spread: clamp(width * .14, 160, 260), strength: .96, phase: 4.7,
        points: [[width * .48, -height * .12], [width * .66, height * .38],
          [width * .92, -height * .02], [width * 1.14, height * .31]]
      },
      {
        count: 11, spread: clamp(width * .11, 140, 240), strength: .9, phase: 2.3,
        points: [[width * 1.12, height * .20], [width * .72, height * .30],
          [width * 1.25, height * .72], [width * .77, height * 1.04]]
      }
    ];
  }

  // Restore the two intersecting left-middle sweeps from the accepted version.
  // Keep their original coordinates within the space below the masthead.
  function leftRibbon(group) {
    const count = group === 0 ? 13 : 10;
    const fieldHeight = height - workspaceTop;
    const span = Math.min(fieldHeight, 960);
    const drift = Math.sin(time * .075 + group * 2.3);
    const lightX = width * (.44 + Math.sin(time * .045 + group * 1.6) * .16);
    const ink = ctx.createLinearGradient(lightX - width * .68, workspaceTop, lightX + width * .68, workspaceTop + fieldHeight * .35);
    ink.addColorStop(0, 'rgba(123,129,139,0)');
    ink.addColorStop(.16, 'rgba(133,134,133,.15)');
    ink.addColorStop(.38, 'rgba(167,147,99,.28)');
    ink.addColorStop(.58, 'rgba(217,185,114,.32)');
    ink.addColorStop(.79, 'rgba(153,143,119,.19)');
    ink.addColorStop(1, 'rgba(123,129,139,0)');
    ctx.strokeStyle = ink;
    ctx.lineWidth = .75;
    ctx.lineCap = ctx.lineJoin = 'round';
    for (let line = 0; line < count; line++) {
      const n = line / (count - 1);
      const offset = (n - .5) * (group === 0 ? 112 : 90);
      ctx.globalAlpha = (.38 + .62 * Math.sin(Math.PI * (.12 + n * .76))) * (group === 0 ? 1 : .68);
      ctx.beginPath();
      for (let step = 0; step <= 100; step++) {
        const u = step / 100;
        const x = width * (-.16 + u * 1.32);
        const arc = Math.sin(u * Math.PI * 1.48 - .42 + group * .85);
        const fan = .28 + .85 * Math.pow(Math.sin(u * Math.PI + group * .6), 2);
        const fold = Math.sin(u * Math.PI * 2.05 + n * .7 + group * 2.2);
        let y = workspaceTop + (group === 0
          ? fieldHeight * .17 + span * .26 * arc + offset * fan
          : fieldHeight * .66 - span * .18 * arc + offset * fan);
        y += fold * (8 + n * 8) + drift * 5 * Math.sin(u * Math.PI);
        y += Math.sin(time * .11 + u * 4.4 + n * .6) * 3;
        const dx = x - pointer.x;
        const dy = y - pointer.y;
        const influence = Math.exp(-(dx * dx + dy * dy) / (2 * 155 * 155));
        y += influence * pointer.strength * clamp(dy * .06, -5, 5);
        if (step === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  function ribbon(group) {
    const { count, spread, strength, phase, points: [a, b, c, d] } = group;
    const drift = Math.sin(time * .075 + phase);
    const light = Math.sin(time * .045 + phase) * .06;
    const ink = ctx.createLinearGradient(a[0], a[1], d[0] + 1, d[1]);
    ink.addColorStop(0, 'rgba(123,129,139,0)');
    ink.addColorStop(.16, 'rgba(133,134,133,.15)');
    ink.addColorStop(.38 + light, 'rgba(167,147,99,.28)');
    ink.addColorStop(.58 + light, 'rgba(217,185,114,.32)');
    ink.addColorStop(.79, 'rgba(153,143,119,.19)');
    ink.addColorStop(1, 'rgba(123,129,139,0)');
    ctx.strokeStyle = ink;
    ctx.lineWidth = .75;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let line = 0; line < count; line++) {
      const n = line / (count - 1);
      const offset = (Math.pow(n, 1.23) - .5) * spread;
      ctx.globalAlpha = (.38 + .62 * Math.sin(Math.PI * (.12 + n * .76))) * strength;
      ctx.beginPath();
      for (let step = 0; step <= 80; step++) {
        const u = step / 80;
        const v = 1 - u;
        const tx = 3 * v * v * (b[0] - a[0]) + 6 * v * u * (c[0] - b[0]) + 3 * u * u * (d[0] - c[0]);
        const ty = 3 * v * v * (b[1] - a[1]) + 6 * v * u * (c[1] - b[1]) + 3 * u * u * (d[1] - c[1]);
        const length = Math.hypot(tx, ty) || 1;
        const nx = -ty / length;
        const ny = tx / length;
        const fan = .35 + .65 * Math.pow(Math.sin(u * Math.PI + phase * .16), 2);
        const bend = offset * fan + drift * 4 * Math.sin(u * Math.PI) +
          Math.sin(time * .11 + u * 4.4 + n * .6 + phase) * 2;
        let x = v ** 3 * a[0] + 3 * v * v * u * b[0] + 3 * v * u * u * c[0] + u ** 3 * d[0] + nx * bend;
        let y = v ** 3 * a[1] + 3 * v * v * u * b[1] + 3 * v * u * u * c[1] + u ** 3 * d[1] + ny * bend;
        // Bend the existing line locally. No halo, trail, magnification or tilt.
        const dx = x - pointer.x;
        const dy = y - pointer.y;
        const influence = Math.exp(-(dx * dx + dy * dy) / (2 * 155 * 155));
        const displacement = influence * pointer.strength * clamp((dx * nx + dy * ny) * .06, -5, 5);
        x += nx * displacement;
        y += ny * displacement;
        if (step === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  function paint() {
    ctx.clearRect(0, 0, width, height);
    if (!visible()) return;
    ctx.save();
    leftRibbon(0);
    leftRibbon(1);
    ctx.globalAlpha = 1;
    // Let the restored sweeps dissolve toward the centre, before adding the
    // other fields. There is no rectangular document-column or toolbar mask.
    const dissolveEnd = width * .60;
    const dissolveStart = clamp(paperLeft - 96, 0, dissolveEnd);
    const dissolveMiddle = clamp(paperLeft + 44, dissolveStart, dissolveEnd);
    const dissolve = ctx.createLinearGradient(0, 0, dissolveEnd, 0);
    dissolve.addColorStop(0, 'rgba(0,0,0,0)');
    dissolve.addColorStop(dissolveStart / dissolveEnd, 'rgba(0,0,0,0)');
    dissolve.addColorStop(dissolveMiddle / dissolveEnd, 'rgba(0,0,0,.94)');
    dissolve.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = dissolve;
    ctx.fillRect(0, 0, width, height);

    ctx.globalCompositeOperation = 'source-over';
    composition().forEach(ribbon);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'destination-out';

    // Feather only immediately behind header labels, preserving the field
    // across both bar boundaries. The original page images cover it naturally.
    labelMasks.forEach(({ x, y, rx, ry }) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(rx, ry);
      const quiet = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      quiet.addColorStop(0, 'rgba(0,0,0,.5)');
      quiet.addColorStop(.55, 'rgba(0,0,0,.5)');
      quiet.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = quiet;
      ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
    });

    const ends = ctx.createLinearGradient(0, 0, 0, height);
    ends.addColorStop(0, 'rgba(0,0,0,.12)');
    ends.addColorStop(.04, 'rgba(0,0,0,0)');
    ends.addColorStop(.87, 'rgba(0,0,0,0)');
    ends.addColorStop(1, 'rgba(0,0,0,.35)');
    ctx.fillStyle = ends;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  function frame(now) {
    frameId = 0;
    if (!moving()) return;
    const elapsed = now - lastFrame;
    if (elapsed >= 1000 / 30) {
      lastFrame = now;
      // Let native document scrolling have priority over decorative drawing.
      if (now - lastScroll > 120) {
        time += Math.min(elapsed / 1000, .06);
        pointer.x += (pointer.targetX - pointer.x) * .09;
        pointer.y += (pointer.targetY - pointer.y) * .09;
        pointer.strength += (pointer.targetStrength - pointer.strength) * .08;
        paint();
      }
    }
    frameId = requestAnimationFrame(frame);
  }

  function sync() {
    cancelAnimationFrame(frameId);
    frameId = 0;
    measure();
    if (!moving()) pointer.strength = pointer.targetStrength = 0;
    paint();
    if (moving()) {
      lastFrame = performance.now();
      frameId = requestAnimationFrame(frame);
    }
  }

  surface.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || !moving()) return;
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    // Ignore the work itself; react only in the surrounding page margins.
    pointer.targetStrength = y < readerTop || x < paperLeft || x > paperRight ? 1 : 0;
    pointer.targetX = x;
    pointer.targetY = y;
  }, { passive: true });
  surface.addEventListener('pointerleave', () => { pointer.targetStrength = 0; });
  reader.addEventListener('scroll', () => { lastScroll = performance.now(); }, { passive: true });
  workspace.querySelector('.sidebar')?.addEventListener('scroll', () => { lastScroll = performance.now(); }, { passive: true });
  [reduced, fine, wide, contrast].forEach(query => query.addEventListener('change', sync));
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('resize', sync);
  window.addEventListener('beforeprint', () => { printing = true; sync(); });
  window.addEventListener('afterprint', () => { printing = false; sync(); });
  window.addEventListener('pagehide', () => { pageHidden = true; cancelAnimationFrame(frameId); });
  window.addEventListener('pageshow', () => { pageHidden = false; sync(); });
  if ('ResizeObserver' in window) {
    const resize = new ResizeObserver(sync);
    resize.observe(surface);
    resize.observe(workspace);
    resize.observe(reader);
  }
  const mode = new MutationObserver(sync);
  mode.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  mode.observe(reader, { attributes: true, attributeFilter: ['class'] });
  sync();
})();
