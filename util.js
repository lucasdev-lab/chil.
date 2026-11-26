/* Chil utilities: small helpers used everywhere. */
(function () {
  var U = {};
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  U.MON = MON; U.MONTHS = MONTHS; U.DAYS = DAYS;
  U.$ = function (s, r) { return (r || document).querySelector(s); };
  U.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  U.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  U.pad = function (n) { return String(n).padStart(2, '0'); };
  U.round2 = function (n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; };

  // Money: whole numbers without decimals, otherwise two decimals.
  U.money = function (n) {
    n = U.round2(n || 0);
    var a = Math.abs(n);
    var s = a.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(a) ? 0 : 2, maximumFractionDigits: 2 });
    return (n < 0 ? '−' : '') + s;
  };
  // Money with two decimals always (tables).
  U.money2 = function (n) {
    n = U.round2(n || 0);
    var s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (n < 0 ? '−' : '') + s;
  };
  U.ksh = function (n) { return 'KSh ' + U.money(n); };

  U.todayISO = function () {
    var d = new Date();
    return d.getFullYear() + '-' + U.pad(d.getMonth() + 1) + '-' + U.pad(d.getDate());
  };
  U.parseISO = function (iso) {
    var p = String(iso).split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  };
  U.toISO = function (d) { return d.getFullYear() + '-' + U.pad(d.getMonth() + 1) + '-' + U.pad(d.getDate()); };
  U.addDays = function (iso, n) { var d = U.parseISO(iso); d.setDate(d.getDate() + n); return U.toISO(d); };
  U.daysBetween = function (aISO, bISO) { // b - a in whole days
    var a = U.parseISO(aISO), b = U.parseISO(bISO);
    return Math.round((b - a) / 86400000);
  };
  U.monthKey = function (iso) { return String(iso).slice(0, 7); };
  U.monthLabel = function (key) { var p = key.split('-'); return MONTHS[+p[1] - 1] + ' ' + p[0]; };
  U.fmtDay = function (iso) { if (!iso) return ''; var p = iso.split('-'); return +p[2] + ' ' + MON[+p[1] - 1]; };
  U.fmtDayYear = function (iso) { if (!iso) return ''; var p = iso.split('-'); return +p[2] + ' ' + MON[+p[1] - 1] + ' ' + p[0]; };
  U.fmtDayLong = function (iso) {
    var d = U.parseISO(iso);
    return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear();
  };
  U.time12 = function (hhmm) {
    if (!hhmm) return '';
    var p = hhmm.split(':').map(Number);
    var h = p[0] % 12 || 12;
    return h + ':' + U.pad(p[1]) + ' ' + (p[0] >= 12 ? 'PM' : 'AM');
  };
  U.nowHHMM = function () { var d = new Date(); return U.pad(d.getHours()) + ':' + U.pad(d.getMinutes()); };

  U.uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); };
  U.key = function (name) { return String(name || '').toLowerCase().replace(/\s+/g, ' ').trim(); };
  U.cap = function (s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); };

  // Kenyan phone number -> 2547XXXXXXXX (digits only) or '' when it is not valid.
  U.phone = function (raw) {
    var d = String(raw || '').replace(/\D/g, '');
    if (d.indexOf('254') === 0) { /* ok */ }
    else if (d.charAt(0) === '0') d = '254' + d.slice(1);
    else if (d.length === 9) d = '254' + d;
    return /^254[17]\d{8}$/.test(d) ? d : '';
  };
  U.isEmail = function (s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim()); };

  U.download = function (filename, content, mime) {
    var blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'application/octet-stream' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
  };

  U.toast = function (msg, ms, kind) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.className = kind ? kind : '';
    if (kind === 'exit') el.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9"/></svg><span></span>', el.lastChild.textContent = msg;
    else el.textContent = msg;
    el.classList.add('show');
    clearTimeout(U._t);
    U._t = setTimeout(function () { el.classList.remove('show'); }, ms || 2600);
  };

  U.sum = function (arr, fn) { var t = 0; for (var i = 0; i < arr.length; i++) t += fn(arr[i]); return U.round2(t); };

  window.Chil = window.Chil || {};
  window.Chil.U = U;
})();
