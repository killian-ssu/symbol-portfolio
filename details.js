(() => {
  'use strict';
  const reader = document.getElementById('reader');
  const pane = document.querySelector('.reading-pane');
  const dock = document.getElementById('reader-dock');
  const peek = document.getElementById('dock-peek');
  if (!reader || !pane || !dock || !peek) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const mouse = matchMedia('(hover: hover) and (pointer: fine)');
  const desktop = matchMedia('(min-width: 701px)');
  const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
  const mouseEffects = () => mouse.matches && !motion.matches;

  // Only arrows move; the clickable targets keep their original position and size.
  const magnets = [];
  document.querySelectorAll('.download, .game, .chapter-next, .step-button').forEach(control => {
    const icon = control.querySelector('.icon-wrap');
    if (!icon) return;
    control.classList.add('magnetic-control');
    icon.classList.add('magnetic-icon');
    const reset = () => {
      icon.style.setProperty('--magnet-x', '0px');
      icon.style.setProperty('--magnet-y', '0px');
    };
    magnets.push(reset);
    control.addEventListener('pointermove', event => {
      if (event.pointerType !== 'mouse' || !mouseEffects() || control.disabled) return reset();
      const r = control.getBoundingClientRect();
      icon.style.setProperty('--magnet-x', `${clamp((event.clientX - r.left - r.width / 2) * .07, -3, 3)}px`);
      icon.style.setProperty('--magnet-y', `${clamp((event.clientY - r.top - r.height / 2) * .12, -3, 3)}px`);
    }, { passive: true });
    control.addEventListener('pointerleave', reset);
    control.addEventListener('blur', reset);
  });

  // Auto-rest only on desktop mouse devices; never hide focused controls.
  let resting = false;
  let nearDock = false;
  let idleTimer = 0;
  let lastTop = reader.scrollTop;
  let lastScroll = 0;
  let downTravel = 0;
  let holdUntil = 0;
  const mayRest = () => mouseEffects() && desktop.matches && 'inert' in dock;
  function showTools(hold = 0) {
    if (hold) holdUntil = performance.now() + hold;
    if (!resting) return;
    resting = false;
    dock.inert = false;
    dock.removeAttribute('aria-hidden');
    pane.classList.remove('tools-resting');
    // Transfer focus before hiding the reveal button.
    if (document.activeElement === peek) document.getElementById('chapter-select').focus({ preventScroll: true });
    peek.tabIndex = -1;
    peek.setAttribute('aria-expanded', 'true');
    peek.setAttribute('aria-hidden', 'true');
  }
  function restTools() {
    if (resting || !mayRest() || nearDock || performance.now() < holdUntil ||
        dock.contains(document.activeElement) || dock.matches(':hover')) return;
    resting = true;
    dock.inert = true;
    dock.setAttribute('aria-hidden', 'true');
    peek.tabIndex = 0;
    peek.setAttribute('aria-hidden', 'false');
    peek.setAttribute('aria-expanded', 'false');
    pane.classList.add('tools-resting');
  }
  reader.addEventListener('scroll', () => {
    const now = performance.now();
    const delta = reader.scrollTop - lastTop;
    lastTop = reader.scrollTop;
    clearTimeout(idleTimer);
    if (delta > 0) {
      downTravel = now - lastScroll > 450 ? delta : downTravel + delta;
      if (downTravel > 110 && reader.scrollTop > 100) restTools();
    } else if (delta < -2) { downTravel = 0; showTools(); }
    lastScroll = now;
    if (!mayRest() || reader.scrollTop < 100 || reader.scrollHeight - reader.clientHeight - reader.scrollTop < 40) showTools();
    idleTimer = setTimeout(() => { downTravel = 0; showTools(); }, 1100);
  }, { passive: true });
  pane.addEventListener('pointermove', event => {
    const r = pane.getBoundingClientRect();
    nearDock = event.pointerType === 'mouse' && event.clientY > r.bottom - 118 && Math.abs(event.clientX - (r.left + r.width / 2)) < 240;
    if (nearDock) showTools(700);
  }, { passive: true });
  pane.addEventListener('pointerleave', () => { nearDock = false; });
  peek.addEventListener('click', () => showTools(1400));
  peek.addEventListener('focus', () => showTools(1400));
  dock.addEventListener('pointerenter', () => showTools(900));
  dock.addEventListener('focusin', () => showTools(1400));
  document.addEventListener('keydown', () => showTools(1400), true);
  document.addEventListener('click', event => {
    if (event.target.closest('a, button, select')) showTools(1400);
  }, true);
  document.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse') { showTools(1400); }
  }, { passive: true });
  function resetDetails() {
    magnets.forEach(reset => reset());
    downTravel = 0;
    lastTop = reader.scrollTop;
    clearTimeout(idleTimer);
    showTools();
  }
  [motion, mouse, desktop].forEach(query => query.addEventListener('change', resetDetails));
  window.addEventListener('resize', resetDetails);
  window.addEventListener('blur', resetDetails);
})();
