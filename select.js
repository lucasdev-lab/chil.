/* Chil: press and hold a row to select it, tap more rows to add them, then copy them to paste anywhere (WhatsApp, Excel, Notes). */
(function () {
  var C = window.Chil, U = C.U, A = C.A;
  var cfg = null, sel = {}, count = 0, timer = null, sx = 0, sy = 0, held = false, lastTab = null;

  function root() { return U.$('#main'); }
  function rowOf(t) {
    if (!cfg || !t || !t.closest) return null;
    var r = t.closest(cfg.row);
    return r && root() && root().contains(r) ? r : null;
  }
  function rows() { return root() ? U.$$(cfg.row, root()) : []; }
  function paint() {
    if (!cfg) return;
    count = 0;
    rows().forEach(function (r) {
      var on = !!sel[cfg.id(r)];
      r.classList.toggle('sel', on);
      if (on) count++;
    });
    bar();
  }
  function bar() {
    var b = U.$('#selbar');
    if (!count) { if (b) b.remove(); return; }
    if (!b) {
      b = document.createElement('div'); b.id = 'selbar'; b.className = 'selbar';
      b.innerHTML = '<span class="n"></span><button data-s="all">All</button><button data-s="copy" class="pri">Copy</button><button data-s="x" aria-label="Cancel">✕</button>';
      document.body.appendChild(b);
      b.addEventListener('click', function (e) {
        var k = e.target.getAttribute && e.target.getAttribute('data-s');
        if (k === 'x') cancel();
        if (k === 'all') { rows().forEach(function (r) { sel[cfg.id(r)] = true; }); paint(); }
        if (k === 'copy') copy();
      });
    }
    b.querySelector('.n').textContent = count + (count === 1 ? ' row selected' : ' rows selected');
  }
  function cancel() { sel = {}; count = 0; if (cfg) rows().forEach(function (r) { r.classList.remove('sel'); }); var b = U.$('#selbar'); if (b) b.remove(); }
  function toggle(r) { var id = cfg.id(r); if (sel[id]) delete sel[id]; else sel[id] = true; paint(); }
  function write(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function (ok, no) {
      var t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select();
      try { document.execCommand('copy') ? ok() : no(); } catch (e) { no(e); } t.remove();
    });
  }
  function copy() {
    var lines = [], n = 0;
    rows().forEach(function (r) { if (sel[cfg.id(r)]) { lines.push(cfg.text(r)); n++; } });
    if (!n) return;
    var text = (cfg.header ? cfg.header + '\n' : '') + lines.join('\n');
    write(text).then(function () { U.toast('Copied ' + n + (n === 1 ? ' row' : ' rows') + '. Paste it anywhere.'); cancel(); }, function () { U.toast('Could not copy. Try again.'); });
  }

  A.select = {
    active: function () { return count > 0; },
    clear: cancel,
    // A view calls this after it draws. cfg: {row, id(el), text(el), header}
    set: function (c) { cfg = c; paint(); },
    // Called before every redraw: leaving the screen clears the selection.
    before: function (tab) { if (tab !== lastTab) { cancel(); lastTab = tab; } cfg = null; }
  };

  var skip = 'input,select,textarea,button,a,label';
  document.addEventListener('pointerdown', function (e) {
    held = false; clearTimeout(timer);
    var r = rowOf(e.target);
    if (!r || (e.target.closest && e.target.closest(skip))) return;
    sx = e.clientX; sy = e.clientY;
    timer = setTimeout(function () { held = true; if (navigator.vibrate) { try { navigator.vibrate(15); } catch (x) { /* ignore */ } } toggle(r); }, 480);
  }, true);
  document.addEventListener('pointermove', function (e) { if (timer && (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10)) { clearTimeout(timer); timer = null; } }, true);
  ['pointerup', 'pointercancel'].forEach(function (n) { document.addEventListener(n, function () { clearTimeout(timer); timer = null; }, true); });
  document.addEventListener('contextmenu', function (e) { if (rowOf(e.target)) e.preventDefault(); }, true);
  document.addEventListener('click', function (e) {
    var r = rowOf(e.target);
    if (held) { held = false; if (r) { e.preventDefault(); e.stopImmediatePropagation(); } return; }
    if (count && r && !(e.target.closest && e.target.closest(skip))) { e.preventDefault(); e.stopImmediatePropagation(); toggle(r); }
  }, true);
})();
