/* Chil: Daily / Monthly / Yearly summary, PDF and Excel export, close shop button. */
(function () {
  var C = window.Chil, U = C.U, S = C.Store, A = C.A, Ex = C.Export;
  var st = A.st;

  function years() {
    var y = {};
    S.D.tx.forEach(function (r) { y[r.date.slice(0, 4)] = 1; });
    y[String(new Date().getFullYear())] = 1;
    if (st.sumYear) y[st.sumYear] = 1;
    return Object.keys(y).sort().reverse();
  }
  function bars(obj, cls, max) {
    var rows = A.sorted(obj), top = rows.length ? rows[0][1] : 0;
    if (!rows.length) return '<p class="hint">Nothing yet.</p>';
    return '<div class="bars">' + rows.slice(0, max || 8).map(function (r) {
      var w = top > 0 ? Math.max(3, Math.round(r[1] / top * 100)) : 0;
      return '<div class="bar"><div class="l"><span>' + U.esc(r[0]) + '</span><b class="num">' + U.money(r[1]) + '</b></div><i class="' + (cls || '') + '" style="width:' + w + '%"></i></div>';
    }).join('') + '</div>';
  }

  // Printable page for PDF.
  A.summaryPrintHTML = function () {
    var list = A.periodList(), sm = A.summarize(list);
    var h = '<h1>Chil summary: ' + U.esc(A.shopLabel()) + '</h1><p class="sub">' + U.esc(A.periodLabel()) + ' · made ' + U.fmtDayYear(U.todayISO()) + '</p>';
    h += '<h2>Totals</h2><table class="kv"><tr><td>Money in</td><td class="n">' + U.money2(sm.inn) + '</td></tr><tr><td>Money spent (incl. fees)</td><td class="n">' + U.money2(sm.spent) + '</td></tr>' +
      '<tr><td>Saved</td><td class="n">' + U.money2(sm.saved) + '</td></tr><tr><td>Left</td><td class="n">' + U.money2(sm.left) + '</td></tr></table>';
    h += '<h2>Business and personal</h2><table><tr><th></th><th class="n">Business</th><th class="n">Personal</th><th class="n">Not tagged</th></tr>' +
      '<tr><td>Money in</td><td class="n">' + U.money2(sm.inBiz) + '</td><td class="n">' + U.money2(sm.inPer) + '</td><td class="n">' + U.money2(sm.inUn) + '</td></tr>' +
      '<tr><td>Spent</td><td class="n">' + U.money2(sm.outBiz) + '</td><td class="n">' + U.money2(sm.outPer) + '</td><td class="n">' + U.money2(sm.outUn) + '</td></tr></table>';
    h += '<h2>Where the money went</h2><table><tr><th>Category</th><th class="n">Amount</th></tr>' + (A.sorted(sm.cats).map(function (r) { return '<tr><td>' + U.esc(r[0]) + '</td><td class="n">' + U.money2(r[1]) + '</td></tr>'; }).join('') || '<tr><td colspan="2">Nothing</td></tr>') + '</table>';
    h += '<h2>Where the money came from</h2><table><tr><th>Name</th><th class="n">Amount</th></tr>' + (A.sorted(sm.from).map(function (r) { return '<tr><td>' + U.esc(r[0]) + '</td><td class="n">' + U.money2(r[1]) + '</td></tr>'; }).join('') || '<tr><td colspan="2">Nothing</td></tr>') + '</table>';
    h += '<h2>All records (' + list.length + ')</h2><table><tr><th>Date</th><th>Name</th><th class="n">In</th><th class="n">Out</th><th>Type</th><th>Category</th><th>Account</th><th class="n">Balance</th><th>Code</th></tr>' +
      list.slice().sort(function (a, b) { return a.ts < b.ts ? -1 : 1; }).map(function (r) {
        return '<tr><td>' + U.fmtDay(r.date) + ' ' + U.time12(r.time) + '</td><td>' + U.esc(r.name) + '</td><td class="n">' + (r.dir === 'in' ? U.money2(r.amount) : '') + '</td><td class="n">' + (r.dir === 'out' ? U.money2(r.amount + (r.fee || 0)) : (r.dir === 'own' && r.fee ? U.money2(r.fee) : '')) + '</td><td>' +
          U.esc(r.bucket ? U.cap(r.bucket) : (r.dir === 'own' ? 'Own money' : '')) + '</td><td>' + U.esc(r.tag || '') + '</td><td>' + U.esc(r.account) + '</td><td class="n">' + (r.balance != null ? U.money2(r.balance) : '') + '</td><td>' + r.code + '</td></tr>';
      }).join('') + '</table>';
    return h;
  };

  A.V.sum = {
    html: function () {
      var list = A.periodList(), sm = A.summarize(list);
      var h = '<div class="seg">' + [['day', 'Daily'], ['month', 'Monthly'], ['year', 'Yearly']].map(function (t) {
        return '<button data-mode="' + t[0] + '" class="' + (st.sumMode === t[0] ? 'on' : '') + '">' + t[1] + '</button>';
      }).join('') + '</div>';
      if (st.sumMode === 'day') h += '<input class="in" type="date" id="p-day" value="' + st.sumDay + '" max="2100-12-31">';
      else if (st.sumMode === 'month') h += '<input class="in" type="month" id="p-month" value="' + st.sumMonth + '">';
      else h += '<select class="sel" id="p-year">' + years().map(function (y) { return '<option' + (y === st.sumYear ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select>';
      h += '<p class="hint" style="margin:8px 2px 12px"><b style="color:var(--ink)">' + U.esc(A.periodLabel()) + '</b> · ' + list.length + (list.length === 1 ? ' record' : ' records') + '</p>';
      if (!list.length) {
        h += '<div class="empty"><b>No records for this ' + (st.sumMode === 'day' ? 'day' : st.sumMode) + '</b>Pick another date, or add your messages with the + button.</div>';
      } else {
        h += '<div class="tot four"><div><small>Money in</small><b class="pos num">' + U.money(sm.inn) + '</b></div><div><small>Spent</small><b class="neg num">' + U.money(sm.spent) + '</b></div>' +
          '<div><small>Saved</small><b class="num">' + U.money(sm.saved) + '</b></div><div><small>Left</small><b class="num ' + (sm.left < 0 ? 'neg' : 'pos') + '">' + U.money(sm.left) + '</b></div></div>';
        if (sm.untagged) h += '<div class="banner">' + sm.untagged + ' not tagged yet, so the split below is incomplete. <button data-act="tagged">Fix</button></div>';
        h += '<div class="card"><h3>Business and personal</h3><div class="split2"><div><small>Money in: Business</small><b class="num">' + U.money(sm.inBiz) + '</b></div><div><small>Money in: Personal</small><b class="num">' + U.money(sm.inPer) + '</b></div>' +
          '<div><small>Spent: Business</small><b class="num">' + U.money(sm.outBiz) + '</b></div><div><small>Spent: Personal</small><b class="num">' + U.money(sm.outPer) + '</b></div></div>' +
          (sm.inUn || sm.outUn ? '<p class="hint">Not tagged: in ' + U.money(sm.inUn) + ', out ' + U.money(sm.outUn) + '</p>' : '') +
          (sm.outFee ? '<p class="hint">Withdrawal and savings fees ' + U.money(sm.outFee) + ' are counted in Spent but not in the split.</p>' : '') + '</div>';
        h += '<div class="card"><h3>Where the money went</h3>' + bars(sm.cats, '', 10) + '</div>';
        h += '<div class="card"><h3>Where the money came from</h3>' + bars(sm.from, 'g', 8) + '</div>';
      }
      h += '<div class="card"><h3>Save this summary</h3><div class="row"><button class="btn ghost grow" data-act="pdf">PDF</button><button class="btn ghost grow" data-act="xls">Excel</button><button class="btn ghost grow" data-act="send">Send report</button></div>' +
        '<p class="hint">PDF: choose "Save as PDF" in the print window. Excel: a file that opens in Excel or Sheets.</p></div>';
      h += '<div class="card" style="text-align:center"><h3>End of day</h3><p class="hint" style="margin:0 0 10px">Check everything, then close the shop.</p><button class="btn green block" data-act="close">Close shop</button></div>';
      return h;
    },
    mount: function (root) {
      U.$$('[data-mode]', root).forEach(function (b) { b.onclick = function () { st.sumMode = b.getAttribute('data-mode'); A.refresh(); }; });
      var d = U.$('#p-day', root), m = U.$('#p-month', root), y = U.$('#p-year', root);
      if (d) d.onchange = function () { if (d.value) { st.sumDay = d.value; A.refresh(); } };
      if (m) m.onchange = function () { if (m.value) { st.sumMonth = m.value; A.refresh(); } };
      if (y) y.onchange = function () { st.sumYear = y.value; A.refresh(); };
      U.$$('[data-act]', root).forEach(function (b) {
        b.onclick = function () {
          var a = b.getAttribute('data-act'), list = A.periodList();
          if (a === 'tagged') { st.onlyUntagged = true; st.month = 'all'; A.go('money'); }
          if (a === 'close') A.V.more.closeShop();
          if (a === 'send') A.V.more.reportSheet();
          if (a === 'pdf' || a === 'xls') {
            if (!list.length) { U.toast('Nothing to save for this period.'); return; }
          }
          if (a === 'pdf') Ex.print(A.summaryPrintHTML(), 'Chil ' + A.periodLabel());
          if (a === 'xls') U.download('Chil-' + A.periodLabel().replace(/[^A-Za-z0-9]+/g, '-') + '.csv', Ex.txCSV(list, S.D.settings.simNames), 'text/csv;charset=utf-8');
        };
      });
    }
  };
})();
