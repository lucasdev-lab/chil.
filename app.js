/* Chil start-up: splash, activation, setup, lock, then the app. */
(function () {
  var C = window.Chil, U = C.U, S = C.Store, A = C.A, Act = C.Act;
  var hiddenAt = 0;

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function splash(first) {
    var s = S.D.settings, today = U.todayISO();
    var morning = !first && s.setupDone && s.greetedDate !== today;
    A.screen('splash', '<div class="scene">' + C.Logo.SUNRISE + '</div><div class="below">' + C.Logo.lockup(48, 34) +
      (morning ? '<div class="msg">' + U.esc(s.openMsg) + '</div>' : '<div class="tag">Your money, sorted.</div>') + '</div>');
    if (morning) { s.greetedDate = today; S.commit('settings'); }
  }

  function start() {
    A.clearScreen();
    U.$('#app').classList.remove('hide');
    A.go('money');
  }

  function afterActivation() {
    var s = S.D.settings;
    function lockThen() {
      if (s.pin) A.lock(start); else start();
    }
    if (!s.setupDone) A.setup(lockThen); else lockThen();
  }

  function fatal(e) {
    try { console.error(e); } catch (x) { /* ignore */ }
    document.body.innerHTML = '<div style="padding:28px;font:16px system-ui"><h2>Chil could not start</h2><p>Please close the app and open it again. If this keeps happening, contact the seller.</p></div>';
  }

  async function boot() {
    try {
      S.init();
      splash(false);
      var t0 = Date.now();
      var ok = await Act.check();
      var left = 1500 - (Date.now() - t0);
      if (left > 0) await wait(left);
      if (!ok) { A.activationScreen(afterActivation); return; }
      afterActivation();
    } catch (e) { fatal(e); }
  }

  document.addEventListener('visibilitychange', function () {
    var s = S.D.settings;
    if (!s || !s.pin) return;
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (hiddenAt && U.$('#app') && !U.$('#app').classList.contains('hide') && !U.$('#screen-host .screen')) {
      var away = (Date.now() - hiddenAt) / 60000;
      if (away >= s.autoLockMin) { A.closeSheet(); A.lock(function () { A.refresh(); }); }
    }
  });

  // Keep the "closing time" banner fresh while the app is open.
  setInterval(function () { if (A.st.tab === 'money' && !document.hidden && !U.$('#sheet.open')) { var m = U.$('#main'); if (m && !U.$('#screen-host .screen')) A.refresh(); } }, 60000);

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* offline use is optional */ }); });
  }
  boot();
})();
