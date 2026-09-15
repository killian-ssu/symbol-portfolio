(function () {
  'use strict';
  var platform = window.TMPlatform, cc = null, failed = false;
  var canvas = document.getElementById('GameCanvas'), status = document.getElementById('status');
  var message = document.getElementById('status-text'), retry = document.getElementById('retry');
  var last = 0, frames = 0, elapsed = 0;
  function fallback(text) {
    if (failed) return;
    failed = true;
    if (cc) cc.game.pause();
    status.hidden = false; message.textContent = text; retry.hidden = false;
  }
  platform.fallback = fallback;
  retry.addEventListener('click', function () { location.reload(); });
  canvas.addEventListener('contextmenu', function (event) { event.preventDefault(); });
  canvas.addEventListener('webglcontextlost', function (event) { event.preventDefault(); fallback('画面暂时中断，请重新进入游戏。'); });
  platform.beforeRun = function () {
    return System.import('chunks:///_virtual/MetaProfileRuntime.ts').then(function (module) {
      // No rewarded-ad or gift service is configured in this local H5 release.
      module.MetaProfileRuntime.setAdBridge({ showRewarded: function () { return Promise.resolve(false); } });
      module.MetaProfileRuntime.setSocialBridge({ sendGift: function () { return Promise.resolve(false); } });
    });
  };
  function measure() {
    if (document.hidden || failed) { last = 0; return; }
    var now = performance.now(); if (last) { elapsed += now - last; frames++; } last = now;
    var device = cc.director.root.device, m = platform.metrics;
    m.targetFPS = cc.game.frameRate; m.drawCalls = device.numDrawCalls;
    m.textureBytes = device.memoryStatus.textureSize; m.width = canvas.width; m.height = canvas.height;
    if (elapsed >= 3000) { m.observedFPS = frames * 1000 / elapsed; frames = 0; elapsed = 0; }
  }
  Promise.all([System.import('cc'), System.import('./application.js')]).then(function (modules) {
    cc = modules[0]; platform.engine = cc; platform.attachLayout(cc);
    var app = new modules[1].Application();
    app.init(cc);
    return app.start();
  }).then(function () {
    if (!failed) status.hidden = true;
    cc.director.on(cc.Director.EVENT_AFTER_DRAW, measure);
  }).catch(function (error) {
    console.error(error); fallback('游戏加载未完成，请刷新页面或更新浏览器后重试。');
  });
}());
