(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const reader = $('#reader');
  const book = $('#document');
  const pages = [...document.querySelectorAll('.page')];
  const links = [...document.querySelectorAll('.chapters a')];
  const chapter = $('#chapter-select');
  const progress = $('#progress-bar');
  const previous = $('#previous-page');
  const next = $('#next-page');
  const zoomIn = $('#zoom-in');
  const zoomOut = $('#zoom-out');
  const zoomFit = $('#zoom-fit');
  const focusButton = $('#focus-toggle');
  const status = $('#reader-status');
  const tip = $('#reading-tip');
  const cover = $('.cover-art');
  const contextTitle = $('#context-title');
  const projectLinks = [...document.querySelectorAll('[data-project-jump]')];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const levels = [1, 1.25, 1.5, 2, 2.5, 3];
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const locationTarget = () => /^#(?:page-[1-6]|daodao|beifa|merchant|midnight)$/.test(location.hash)
    ? location.hash.slice(1).replace(/^page-/, '') : null;
  // Capture an intentional deep link once. Ordinary reading never rewrites the
  // share URL with the reader's current chapter or project.
  const initialTarget = locationTarget() || '1';
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  let startupPending = true;
  let startupFrame = 0;
  let layoutWidth = 0;
  let zoom = 0;
  let activeNumber = 0;
  let frame = 0;
  let journey = 0;
  let tipTimer = 0;
  let drag = null;

  function topOf(element) {
    return element.getBoundingClientRect().top - reader.getBoundingClientRect().top + reader.scrollTop;
  }
  function currentPage() {
    const lead = Math.min(100, reader.clientHeight * 0.15);
    return pages.filter(page => topOf(page) <= reader.scrollTop + lead).at(-1) || pages[0];
  }
  function announce(message) {
    status.textContent = message;
    tip.textContent = message;
    tip.classList.add('visible');
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => tip.classList.remove('visible'), 2400);
  }
  function updateReading() {
    frame = 0;
    const page = currentPage();
    const number = Number(page.dataset.number);
    chapter.value = String(number);
    previous.disabled = number === 1;
    next.disabled = number === pages.length;
    const maxScroll = Math.max(1, reader.scrollHeight - reader.clientHeight);
    progress.style.width = `${clamp(reader.scrollTop / maxScroll) * 100}%`;
    // Only the cover's frame responds to scrolling; the PDF artwork stays still.
    if (cover) {
      const passed = clamp((reader.scrollTop - topOf(pages[0])) / Math.max(1, cover.offsetHeight));
      cover.style.setProperty('--cover-light', reduceMotion.matches ? '0' : String(1 - passed));
    }
    links.forEach((link, index) => {
      const start = Math.max(0, topOf(pages[index]) - 20);
      const end = index === pages.length - 1 ? maxScroll : topOf(pages[index + 1]) - 20;
      const local = clamp((reader.scrollTop - start) / Math.max(1, end - start));
      link.style.setProperty('--chapter-progress', String(local));
      if (index + 1 === number) {
        link.setAttribute('aria-current', 'location');
        $('#context-progress').textContent = `${Math.round(local * 100)}%`;
      } else link.removeAttribute('aria-current');
    });
    if (activeNumber !== number) {
      activeNumber = number;
      $('#context-number').textContent = String(number).padStart(2, '0');
      pages.forEach(item => item.classList.toggle('is-entering', item === page));
    }
    const currentProject = [...page.querySelectorAll('.project-anchor')].filter(item => topOf(item) <= reader.scrollTop + 120).at(-1);
    const projectNames = { daodao: '刀刀 TD', beifa: '北伐', merchant: '远行商人', midnight: '子时已到' };
    const title = currentProject ? projectNames[currentProject.id] : page.dataset.title;
    if (contextTitle.textContent !== title) {
      contextTitle.textContent = title;
      if (!reduceMotion.matches && contextTitle.animate) {
        contextTitle.getAnimations().forEach(animation => animation.cancel());
        contextTitle.animate([{ opacity: .5, transform: 'translateY(3px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'ease-out' });
      }
    }
    projectLinks.forEach(link => {
      if (currentProject && link.hash === `#${currentProject.id}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  function stopJourney() {
    if (journey) cancelAnimationFrame(journey);
    journey = 0;
  }
  function goTo(number, immediate = false) {
    const project = ['daodao', 'beifa', 'merchant', 'midnight'].includes(String(number)) ? document.getElementById(String(number)) : null;
    const page = project?.closest('.page') || pages.find(item => item.dataset.number === String(number));
    if (!page) return;
    stopJourney();
    const from = reader.scrollTop;
    const to = !project && page === pages[0] ? 0 : clamp(topOf(project || page) - 20, 0, Math.max(0, reader.scrollHeight - reader.clientHeight));
    reader.scrollLeft = 0;
    if (location.hash) history.replaceState(history.state, '', location.pathname + location.search);
    const finish = () => {
      journey = 0;
      reader.scrollTop = to;
      updateReading();
      status.textContent = `已跳到${page.dataset.title}`;
    };
    if (immediate || reduceMotion.matches || Math.abs(to - from) < 4) return finish();
    const start = performance.now();
    const duration = Math.min(680, 280 + Math.sqrt(Math.abs(to - from)) * 4);
    const step = now => {
      const fraction = clamp((now - start) / duration);
      const eased = 1 - Math.pow(1 - fraction, 4);
      reader.scrollTop = from + (to - from) * eased;
      if (fraction < 1) journey = requestAnimationFrame(step);
      else finish();
    };
    journey = requestAnimationFrame(step);
  }
  document.querySelectorAll('a[href^="#page-"], a[data-project-jump]').forEach(link => {
    link.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      goTo(link.hash.slice(1).replace(/^page-/, ''));
    });
  });
  chapter.addEventListener('change', () => goTo(chapter.value));
  previous.addEventListener('click', () => goTo(activeNumber - 1));
  next.addEventListener('click', () => goTo(activeNumber + 1));

  // Keep the same point in the artwork under the pointer during zoom or layout changes.
  function captureAnchor(point) {
    const viewport = reader.getBoundingClientRect();
    const x = point?.clientX ?? viewport.left + reader.clientWidth / 2;
    const y = point?.clientY ?? viewport.top + Math.min(160, reader.clientHeight * 0.32);
    const page = pages.find(item => {
      const rect = item.getBoundingClientRect();
      return y >= rect.top && y < rect.bottom;
    }) || currentPage();
    const element = page.querySelector('.page-images');
    const rect = element.getBoundingClientRect();
    return { element, x: clamp((x - rect.left) / rect.width), y: clamp((y - rect.top) / rect.height), screenX: x - viewport.left, screenY: y - viewport.top };
  }
  function layoutReading(anchor = captureAnchor()) {
    layoutWidth = reader.clientWidth;
    const css = getComputedStyle(reader);
    const available = reader.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight);
    const cap = document.body.classList.contains('focus-mode') ? 1440 : 1280;
    book.style.setProperty('--reading-width', `${Math.max(1, Math.min(cap, available)) * levels[zoom]}px`);
    reader.classList.toggle('zoomed', zoom > 0);
    if (anchor) {
      reader.scrollTop = topOf(anchor.element) + anchor.y * anchor.element.offsetHeight - anchor.screenY;
      const rect = anchor.element.getBoundingClientRect();
      reader.scrollLeft += rect.left - reader.getBoundingClientRect().left + anchor.x * rect.width - anchor.screenX;
    }
    if (!zoom) reader.scrollLeft = 0;
    zoomIn.disabled = zoom === levels.length - 1;
    zoomOut.disabled = zoom === 0;
    zoomFit.textContent = zoom ? `${Math.round(levels[zoom] * 100)}%` : '适合宽度';
    zoomFit.setAttribute('aria-label', zoom ? `当前 ${Math.round(levels[zoom] * 100)}%，恢复适合宽度` : '当前适合宽度');
    updateReading();
  }
  function changeZoom(nextZoom, point) {
    stopJourney();
    const anchor = captureAnchor(point);
    zoom = clamp(nextZoom, 0, levels.length - 1);
    layoutReading(anchor);
    announce(zoom ? `已放大至 ${Math.round(levels[zoom] * 100)}% · 可拖动或滑动查看` : '已恢复适合宽度');
  }
  zoomIn.addEventListener('click', () => changeZoom(zoom + 1));
  zoomOut.addEventListener('click', () => changeZoom(zoom - 1));
  zoomFit.addEventListener('click', () => changeZoom(0));
  reader.addEventListener('dblclick', event => {
    if (!event.target.closest('.page-images') || event.target.closest('a')) return;
    event.preventDefault();
    changeZoom(zoom ? 0 : 3, event);
  });
  function toggleFocus() {
    stopJourney();
    const anchor = captureAnchor();
    const focused = document.body.classList.toggle('focus-mode');
    focusButton.setAttribute('aria-pressed', String(focused));
    focusButton.querySelector('span').textContent = focused ? '退出专注' : '专注阅读';
    layoutReading(anchor);
    if (!reduceMotion.matches && book.animate) book.animate([{ opacity: 0.7 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' });
    announce(focused ? '专注阅读已开启 · 按 Esc 退出' : '已返回完整视图');
  }
  focusButton.addEventListener('click', toggleFocus);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      stopJourney();
      if (document.body.classList.contains('focus-mode')) toggleFocus();
      else if (zoom) changeZoom(0);
      return;
    }
    if (event.target !== reader || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === 'ArrowRight' && !zoom) { event.preventDefault(); goTo(activeNumber + 1); }
    if (event.key === 'ArrowLeft' && !zoom) { event.preventDefault(); goTo(activeNumber - 1); }
  });

  function endDrag(event) {
    if (drag && reader.hasPointerCapture?.(drag.id)) reader.releasePointerCapture(drag.id);
    drag = null;
    reader.classList.remove('is-dragging');
  }
  reader.addEventListener('pointerdown', event => {
    stopJourney();
    if (!zoom || event.pointerType !== 'mouse' || event.button !== 0 || !event.target.closest('.page-images') || event.target.closest('a')) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: reader.scrollLeft, top: reader.scrollTop, moving: false };
  });
  reader.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moving && Math.hypot(dx, dy) > 5) {
      drag.moving = true;
      reader.setPointerCapture(drag.id);
      reader.classList.add('is-dragging');
    }
    if (!drag.moving) return;
    event.preventDefault();
    reader.scrollLeft = drag.left - dx;
    reader.scrollTop = drag.top - dy;
  });
  reader.addEventListener('pointerup', endDrag);
  reader.addEventListener('pointercancel', endDrag);
  reader.addEventListener('lostpointercapture', () => { drag = null; reader.classList.remove('is-dragging'); });
  reader.addEventListener('wheel', stopJourney, { passive: true });
  reader.addEventListener('touchstart', stopJourney, { passive: true });
  reader.addEventListener('keydown', stopJourney);
  reader.addEventListener('scroll', () => { if (!frame) frame = requestAnimationFrame(updateReading); }, { passive: true });
  window.addEventListener('resize', () => {
    stopJourney();
    if (startupPending) placeInitial();
    // Mobile browser chrome often changes height without changing page width.
    // Keep the existing scroll position instead of re-anchoring the artwork.
    else if (reader.clientWidth !== layoutWidth) layoutReading();
    else updateReading();
  });
  window.addEventListener('blur', endDrag);
  window.addEventListener('hashchange', () => {
    const target = locationTarget();
    if (target) { cancelStartup(); goTo(target); }
  });
  reduceMotion.addEventListener('change', () => { if (reduceMotion.matches) stopJourney(); updateReading(); });

  // Reveal chapter furniture once, without animating or separating image tiles.
  if ('IntersectionObserver' in window) {
    const chapterObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('chapter-visible');
        chapterObserver.unobserve(entry.target);
      });
    }, { root: reader, threshold: .5 });
    document.querySelectorAll('.page-header').forEach(header => chapterObserver.observe(header));
  }

  document.querySelectorAll('.page-images img').forEach(img => {
    function showError() {
      if (img.dataset.failed) return;
      img.dataset.failed = 'true';
      const fallback = document.createElement('a');
      fallback.className = 'image-error';
      fallback.href = `portfolio.pdf?v=c2a99e7d#page=${img.closest('.page').dataset.number}`;
      fallback.target = '_blank';
      fallback.rel = 'noopener';
      fallback.textContent = '这部分暂未载入，点击在 PDF 中查看';
      const icon = document.querySelector('.open-original .icon-wrap')?.cloneNode(true);
      if (icon) fallback.append(' ', icon);
      img.insertAdjacentElement('afterend', fallback);
      img.hidden = true;
      img.style.display = 'none';
    }
    img.addEventListener('error', showError);
    if (img.complete && !img.naturalWidth) showError();
  });
  function cancelStartup() {
    startupPending = false;
    cancelAnimationFrame(startupFrame);
  }
  function placeInitial() {
    if (!startupPending) return;
    layoutReading(null);
    goTo(initialTarget, true);
  }
  function settleInitial() {
    if (!startupPending) return;
    placeInitial();
    cancelAnimationFrame(startupFrame);
    // Apply once after the browser's load/pageshow restoration. Never snap back
    // after the visitor has started reading, tapping controls or using a key.
    startupFrame = requestAnimationFrame(() => {
      startupFrame = requestAnimationFrame(placeInitial);
    });
  }
  ['pointerdown', 'touchstart', 'wheel', 'keydown', 'click', 'change'].forEach(type => {
    document.addEventListener(type, cancelStartup, { capture: true, passive: true });
  });
  window.addEventListener('load', settleInitial, { once: true });
  window.addEventListener('pageshow', event => { if (!event.persisted) settleInitial(); });
  window.addEventListener('pagehide', cancelStartup);
  if (document.fonts) document.fonts.ready.then(() => { if (startupPending) placeInitial(); });
  settleInitial();
})();
