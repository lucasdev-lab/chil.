/* Chil: search across money records, debts and business evaluation rows. */
(function () {
  var C = window.Chil, U = C.U, S = C.Store, A = C.A;
  var q = '';

  function norm(s) { return String(s == null ? '' : s).toLowerCase(); }
  function amounts(n) {
    if (n == null || isNaN(n)) return '';
    var r = U.round2(n);
    return [String(r), r.toFixed(2), U.money(r), U.money2(r)].join(' ');
  }
  function txHay(r) {
    var d = U.parseISO(r.date);
    return norm([r.name, r.code, r.tag, r.bucket, r.account, amounts(r.amount), amounts(r.fee), amounts(r.balance), r.date, U.fmtDay(r.date), U.fmtDayYear(r.date),
      U.MONTHS[d.getMonth()], U.DAYS[d.getDay()], r.time, U.time12(r.time),
      r.dir === 'in' ? 'in income received money in' : r.dir === 'out' ? 'out expense sent spent money out' : 'own withdrawal transfer',
      S.D.settings.simNames[r.sim] || 'SIM ' + r.sim, A.needsTag(r) ? 'untagged not tagged' : ''].join(' | '));
  }
  function debtHay(d) {
    var i = A.debtInfo(d);
    return norm([d.name, d.desc, amounts(d.amount), amounts(i.bal), d.date, d.due, U.fmtDay(d.date), U.fmtDay(d.due), i.label,
      d.kind === 'owed' ? 'owed to me debt customer' : 'i owe credit supplier'].join(' | '));
  }
  function workHay(w) {
    var sa = C.Calc.evalExpr(w.sales), sk = C.Calc.evalExpr(w.stock), p = (sa == null && sk == null) ? null : (sa || 0) - (sk || 0);
    return norm([w.item, w.date, U.fmtDay(w.date), amounts(sa), amounts(sk), amounts(p), 'business evaluation stock sales profit'].join(' | '));
  }
  function matches(hay, toks) { return toks.every(function (t) { return hay.indexOf(t) >= 0; }); }

  function results() {
    var toks = norm(q).replace(/,/g, '').split(/\s+/).filter(Boolean);
    var out = { tx: [], debts: [], work: [] };
    if (!toks.length) return null;
    out.tx = S.D.tx.filter(function (r) { return matches(txHay(r), toks); }).sort(function (a, b) { return a.ts < b.ts ? 1 : -1; });
    out.debts = S.D.debts.filter(function (d) { return matches(debtHay(d), toks); });
    out.work = S.D.biz.rows.filter(function (w) { return matches(workHay(w), toks); });
    return out;
  }

  function resultHTML() {
    var r = results();
    if (!r) return '<div class="empty">Search by name, amount, category, date or M-Pesa code.<br><span class="hint">Examples: "Mama Mboga", "1500", "food", "Nov", "business"</span></div>';
    var n = r.tx.length + r.debts.length + r.work.length;
    if (!n) return '<div class="empty"><b>We are sorry, we couldn\'t find your search.</b>Try a different name, amount or category.</div>';
    var h = '<p class="hint" style="margin:0 0 10px">' + n + (n === 1 ? ' result' : ' results') + '</p>';
    if (r.tx.length) {
      var sm = A.summarize(r.tx);
      h += '<div class="card"><h3>Money (' + r.tx.length + ')</h3><div class="row wrap hint" style="margin:0 0 6px"><span>In <b class="pos">' + U.money(sm.inn) + '</b></span><span>Out <b class="neg">' + U.money(sm.spent + sm.saved) + '</b></span></div>';
      r.tx.slice(0, 60).forEach(function (t) {
        h += '<div class="list-item" data-tx="' + t.code + '" style="cursor:pointer"><div class="grow"><b>' + U.esc(t.name) + '</b><small>' + U.fmtDayYear(t.date) + ' · ' + U.time12(t.time) + ' · ' +
          (t.dir === 'own' ? 'Own money' : U.esc((t.bucket ? U.cap(t.bucket) + ' · ' : '') + (t.tag || (A.needsTag(t) ? 'Not tagged' : '')))) + '</small></div>' +
          '<b class="num ' + (t.dir === 'in' ? 'pos' : t.dir === 'out' ? 'neg' : 'mute') + '">' + (t.dir === 'in' ? '+' : t.dir === 'out' ? '−' : '') + U.money2(t.dir === 'out' ? t.amount + (t.fee || 0) : t.amount) + '</b></div>';
      });
      if (r.tx.length > 60) h += '<p class="hint">Showing the latest 60. Type more letters to narrow down.</p>';
      h += '</div>';
    }
    if (r.debts.length) {
      h += '<div class="card"><h3>Debts and credits (' + r.debts.length + ')</h3>';
      r.debts.forEach(function (d) {
        var i = A.debtInfo(d);
        h += '<div class="list-item" data-debt="' + d.id + '" style="cursor:pointer"><div class="grow"><b>' + U.esc(d.name) + '</b><small>' + (d.kind === 'owed' ? 'Owed to me' : 'I owe') + (d.desc ? ' · ' + U.esc(d.desc) : '') + (d.due ? ' · due ' + U.fmtDayYear(d.due) : '') + '</small></div>' +
          '<div class="right"><b class="num">' + U.money2(i.bal) + '</b><br><span class="pill ' + (i.key === 'over' ? 'bad' : i.key === 'paid' ? 'ok' : i.key === 'soon' ? 'warn' : '') + '">' + i.label + '</span></div></div>';
      });
      h += '</div>';
    }
    if (r.work.length) {
      h += '<div class="card"><h3>Business evaluation (' + r.work.length + ')</h3>';
      r.work.forEach(function (w) {
        var sa = C.Calc.evalExpr(w.sales), sk = C.Calc.evalExpr(w.stock), p = (sa == null && sk == null) ? null : U.round2((sa || 0) - (sk || 0));
        h += '<div class="list-item" data-work="1" style="cursor:pointer"><div class="grow"><b>' + U.esc(w.item || 'Item') + '</b><small>' + U.fmtDayYear(w.date) + ' · stock ' + (sk == null ? '-' : U.money(sk)) + ' · sales ' + (sa == null ? '-' : U.money(sa)) + '</small></div><b class="num ' + (p < 0 ? 'neg' : 'pos') + '">' + (p == null ? '' : (p < 0 ? '−' : '') + U.money(Math.abs(p))) + '</b></div>';
      });
      h += '</div>';
    }
    return h;
  }

  A.V.search = {
    html: function () {
      return '<div class="row" style="margin-bottom:12px"><input class="in grow" id="q" type="search" inputmode="search" autocomplete="off" placeholder="Search name, amount, category..." value="' + U.esc(q) + '"><button class="btn ghost small hide" id="q-x">Clear</button></div><div id="q-res">' + resultHTML() + '</div>';
    },
    mount: function (root) {
      var inp = U.$('#q', root), res = U.$('#q-res', root), x = U.$('#q-x', root);
      function bind() {
        U.$$('[data-tx]', res).forEach(function (e) { e.onclick = function () { A.tagSheet(e.getAttribute('data-tx')); }; });
        U.$$('[data-debt]', res).forEach(function (e) { e.onclick = function () { A.V.debts.open(e.getAttribute('data-debt')); }; });
        U.$$('[data-work]', res).forEach(function (e) { e.onclick = function () { A.go('biz'); }; });
        x.classList.toggle('hide', !q);
      }
      inp.oninput = function () { q = inp.value; res.innerHTML = resultHTML(); bind(); };
      x.onclick = function () { q = ''; inp.value = ''; res.innerHTML = resultHTML(); bind(); inp.focus(); };
      bind();
      if (!q) setTimeout(function () { try { inp.focus(); } catch (e) { /* ignore */ } }, 50);
    },
    reset: function () { q = ''; }
  };
})();
