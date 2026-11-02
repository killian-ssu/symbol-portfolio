'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const originalFetch = window.fetch.bind(window);
  let instance, starting = false, suspended = false, failed = false, progress = 0;
  function layoutLoading() {
    const game = $('game').getBoundingClientRect(), safe = $('loading-safe-area').getBoundingClientRect();
    const unit = Math.max(game.width / 720, game.height / 1600), artTop = (game.height - 1600 * unit) / 2;
    const art = $('loading-art');
    art.style.width = `${720 * unit}px`; art.style.height = `${1600 * unit}px`; art.style.setProperty('--u', `${unit}px`);
    const footerLift = Math.max(0, artTop + 1446 * unit - (safe.bottom - game.top));
    document.querySelector('.loading-progress').style.transform = `translateY(${-footerLift}px)`;
    const preferredWidth = 679.685512 * unit, preferredHeight = 271.805654 * unit;
    const scale = Math.min(1, Math.max(.01, (safe.width - 32 * unit) / preferredWidth));
    const width = preferredWidth * scale, height = preferredHeight * scale;
    const desiredX = (game.width - 720 * unit) / 2 + 360.086572 * unit;
    const desiredY = artTop + 400 * unit;
    const centerX = Math.max(safe.left - game.left + 16 * unit + width / 2, Math.min(desiredX, safe.right - game.left - 16 * unit - width / 2));
    const centerY = Math.max(safe.top - game.top + 16 * unit + height / 2, Math.min(desiredY, safe.bottom - game.top - 16 * unit - height / 2));
    const logo = $('logo');
    logo.style.width = `${width}px`;logo.style.left = `${centerX - (game.width - 720 * unit) / 2 - width / 2}px`;logo.style.top = `${centerY - artTop - height / 2}px`;
  }
  layoutLoading();new ResizeObserver(layoutLoading).observe($('game'));
  function setProgress(value) {
    // Unity's download/decompression callbacks are the only source of progress.
    progress = Math.max(progress, Math.min(1, value));
    const percent = Math.floor(progress * 100);
    $('progress').setAttribute('aria-valuenow', String(percent));
    $('progress-fill').style.width = `${progress * 100}%`;
    $('progress-fill').classList.toggle('empty', progress === 0);
    $('percent').textContent = `${percent}%`;
  }
  function fail(message) {
    failed = true;
    $('error').textContent = message;
    $('error').classList.remove('hidden');
    $('status').textContent = '暂时未能进入巡夜';
    $('retry').classList.remove('hidden');
    $('progress').classList.add('hidden');
    $('percent').classList.add('hidden');
    $('control-hint').classList.add('hidden');
  }
  function suspend() {
    if (!instance || suspended) return;
    suspended = true;
    instance.SendMessage('NoonWebPlatform', 'SuspendForBrowser');
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); else suspended = false; });
  window.addEventListener('pagehide', suspend);
  window.addEventListener('blur', suspend);
  window.addEventListener('focus', () => { suspended = false; });
  $('unity-canvas').addEventListener('webglcontextlost', event => { event.preventDefault(); fail('浏览器暂时失去图形连接，请重新加载。'); $('loading').classList.remove('done'); });
  $('retry').addEventListener('click', () => location.reload());
  function installChunkFetch(files) {
    const base = new URL('./', location.href);
    window.fetch = async (input, init) => {
      const url = new URL(typeof input === 'string' ? input : input.url, location.href);
      const key = url.pathname.startsWith(base.pathname) ? url.pathname.slice(base.pathname.length) : '';
      const entry = url.origin === base.origin && Object.hasOwn(files, key) ? files[key] : undefined;
      if (!entry) return originalFetch(input, init);
      const signal = init?.signal || (input instanceof Request ? input.signal : undefined);
      const stream = new ReadableStream({
        async start(controller) {
          try {
            for (const part of entry.parts) {
              const response = await originalFetch(part.url, { signal });
              if (!response.ok) throw new Error('资源下载中断，请重新加载。');
              const bytes = new Uint8Array(await response.arrayBuffer());
              if (bytes.byteLength !== part.bytes) throw new Error('资源不完整，请重新加载。');
              const digest = await crypto.subtle.digest('SHA-256', bytes);
              const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
              if (hash !== part.sha256) throw new Error('资源校验未通过，请重新加载。');
              controller.enqueue(bytes);
            }
            controller.close();
          } catch (error) { controller.error(error); }
        }
      });
      return new Response(stream, { headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(entry.bytes) } });
    };
  }
  async function start() {
    if (starting) return; starting = true;
    try {
      try {
        await new Promise((resolve, reject) => {
          const request = indexedDB.open('NoonStorageCapability', 1);
          request.onupgradeneeded = () => request.result.createObjectStore('probe');
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result, tx = db.transaction('probe', 'readwrite');
            tx.objectStore('probe').put(1, 'ready');
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onerror = () => { db.close(); reject(tx.error); };
          };
        });
      } catch { $('storage-warning').classList.remove('hidden'); }
      if (!window.WebAssembly || !document.createElement('canvas').getContext('webgl2')) throw new Error('此浏览器不支持游戏所需的图形功能，请使用新版 Safari 或 Chrome。');
      const response = await originalFetch('build.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error('游戏资源尚未就绪，请稍后重试。');
      const build = await response.json();
      installChunkFetch(build.chunked || {});
      const config = { ...build.config, autoSyncPersistentDataPath: true,
        devicePixelRatio: Math.min(devicePixelRatio || 1, 2),
        matchWebGLToCanvasSize: true,
        showBanner(message, type) { if (type === 'error') fail('游戏遇到问题，请重新加载。'); else console.warn(message); }
      };
      await new Promise((resolve, reject) => {
        const script = document.createElement('script'); script.src = build.loader;
        script.onload = resolve; script.onerror = () => reject(new Error('下载失败，请检查网络后重试。')); document.head.appendChild(script);
      });
      instance = await createUnityInstance($('unity-canvas'), config, value => {
        setProgress(Math.min(.99, value));
        $('status').textContent = '正在准备巡夜…';
      });
      window.noonUnity = instance;
      // Keep the poster over Unity's internal boot until the real home screen is ready.
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { cleanup(); reject(new Error('进入巡夜超时，请重新加载。')); }, 60000);
        const ready = () => { if (window.noonWebState?.ready) { cleanup(); resolve(); } };
        function cleanup() { clearTimeout(timeout); window.removeEventListener('noon-state', ready); }
        window.addEventListener('noon-state', ready); ready();
      });
      if (failed) return;
      setProgress(1);
      $('status').textContent = '巡夜准备完成';
      // Start the shared short fade after a rendered readiness boundary.
      await new Promise(resolve => requestAnimationFrame(resolve));
      $('loading').classList.add('done');
      if (!document.hidden) $('unity-canvas').focus({ preventScroll: true });
    } catch (error) { console.error(error); fail(error.message || '加载失败，请检查网络后重试。'); }
  }
  // Loading itself needs no gesture. Unity unlocks audio on the first actual game input.
  start();
  window.addEventListener('noon-state', () => { if (!document.hidden) suspended = false; });
})();
