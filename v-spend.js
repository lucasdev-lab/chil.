/* Chil: Expenditure. All the money that went out, by group (Business / Personal / Savings), then by category. */
(function () {
  var C = window.Chil, U = C.U, S = C.Store, A = C.A;
  var st = A.st;
  st.spMonth = st.spMonth || 'all'; st.spOpen = st.spOpen || {};

  function inPeriod(d) { return st.spMonth === 'all' || U.monthKey(d) === st.spMonth; }
  function groupName(b) { return b === 'business' ? 'Business' : b === 'personal' ? 'Personal' : b === 'savings' ? 'Savings' : 'Not sorted yet'; }
  var ORDER = ['Business', 'Personal', 'Savings', 'Not sorted yet'];

  // Every money-out item, one flat list.
  function items() {
    var out = [];
    S.D.tx.forEach(function (r) {
      if (!inPeriod(r.date)) return;
      var g = groupName(r.bucket);
      if (r.dir === 'out') {
        out.push({ date: r.date, ts: r.ts, what: r.name, group: g, cat: r.tag || (r.bucket === 'savings' ? 'Savings' : 'No category'), amount: U.round2(r.amount), fee: 0, src: r.bank ? r.account : 'M-Pesa' });
      }
      if ((r.dir === 'out' || r.dir === 'own') && r.fee) {
        out.push({ date: r.date, ts: r.ts, what: (r.name || 'Transfer') + ' (cost)', group: g, cat: 'Transaction cost', amount: U.round2(r.fee), fee: r.fee, src: r.bank ? r.account : 'M-Pesa' });
      }
    });
    ((S.D.biz && S.D.biz.rows) || []).forEach(function (b) {
      if (!inPeriod(b.date)) return;
      out.push({ date: b.date, ts: b.date + ' 00:00', what: b.item || (b.kind === 'stock' ? 'Stock' : 'Business expense'), group: 'Business', cat: b.kind === 'stock' ? 'Stock bought' : 'Other business costs', amount: U.round2(b.amount), fee: 0, src: 'Business tab' });
    });
    ((S.D.cash && S.D.cash.used) || []).forEach(function (x) {
      if (!inPeriod(x.date)) return;
      out.push({ date: x.date, ts: x.date + ' 00:00', what: x.note || 'Cash used', group: x.bucket === 'business' ? 'Business' : x.bucket === 'personal' ? 'Personal' : 'Not sorted yet', cat: x.tag || 'Cash used', amount: U.round2(x.amount), fee: 0, src: 'Cash' });
    });
    return out;
  }
  function build() {
    var its = items(), groups = {}, grand = 0;
    its.forEach(function (i) {
      var g = groups[i.group] = groups[i.group] || { name: i.group, total: 0, cats: {} };
      var c = g.cats[i.cat] = g.cats[i.cat] || { name: i.cat, total: 0, items: [] };
      c.total += i.amount; c.items.push(i); g.total += i.amount; grand += i.amount;
    });
    var list = ORDER.filter(function (n) { return groups[n]; }).map(function (n) {
      var g = groups[n];
      g.catList = Object.keys(g.cats).map(function (k) { var c = g.cats[k]; c.total = U.round2(c.total); c.items.sort(function (a, b) { return a.ts < b.ts ? -1 : 1; }); return c; }).sort(function (a, b) { return b.total - a.total; });
      g.total = U.round2(g.total); return g;
    });
    return { groups: list, total: U.round2(grand), count: its.length };
  }
  function months() {
    var m = {};
    var save = st.spMonth; st.spMonth = 'all';
    items().forEach(function (i) { m[U.monthKey(i.date)] = 1; });
    st.spMonth = save;
    return Object.keys(m).sort().reverse();
  }
  function period() { return st.spMonth === 'all' ? 'All time' : U.monthLabel(st.spMonth); }

  A.spendReportHTML = function () {
    var b = build();
    var h = '<h1>Expenditure report · ' + U.esc(A.shopLabel()) + '</h1><p class="sub">' + U.esc(period()) + ' · made ' + U.fmtDayYear(U.todayISO()) + '</p>';
    b.groups.forEach(function (g) {
      h += '<h2>' + U.esc(g.name) + ' · KSh ' + U.money2(g.total) + '</h2>';
      g.catList.forEach(function (c) {
        h += '<table><tr><th colspan="3">' + U.esc(c.name) + '</th><th class="n">' + U.money2(c.total) + '</th></tr>' +
          c.items.map(function (i) { return '<tr><td>' + U.fmtDayYear(i.date) + '</td><td>' + U.esc(i.what) + '</td><td>' + U.esc(i.src) + '</td><td class="n">' + U.money2(i.amount) + '</td></tr>'; }).join('') + '</table>';
      });
    });
    h += '<h2>Summary</h2><table><tr><th>Group</th><th>Category</th><th class="n">Total</th></tr>' +
      b.groups.map(function (g) { return g.catList.map(function (c) { return '<tr><td>' + U.esc(g.name) + '</td><td>' + U.esc(c.name) + '</td><td class="n">' + U.money2(c.total) + '</td></tr>'; }).join(''); }).join('') +
      '<tr><th colspan="2">TOTAL SPENT</th><th class="n">' + U.money2(b.total) + '</th></tr></table>';
    return h;
  };
  A.spendXLSX = function () {
    var X = C.Xlsx, b = build(), rows = [['Date', 'Group', 'Category', 'What', 'Where from', 'Amount']], sum = [['Group', 'Category', 'Items', 'Total spent']];
    b.groups.forEach(function (g) {
      g.catList.forEach(function (c) {
        c.items.forEach(function (i) { rows.push([{ d: i.date }, g.name, c.name, i.what, i.src, { m: i.amount }]); });
        sum.push([g.name, c.name, c.items.length, { m: c.total }]);
      });
      sum.push([{ b: g.name }, { b: 'Total ' + g.name }, '', { bm: g.total }]);
    });
    rows.push([]); rows.push([{ b: 'TOTAL SPENT' }, '', '', '', '', { bm: b.total }]);
    sum.push([]); sum.push([{ b: 'TOTAL SPENT' }, '', '', { bm: b.total }]);
    return X.build([{ name: 'Expenditure', cols: [14, 16, 22, 32, 14, 14], rows: rows }, { name: 'By category', cols: [16, 26, 8, 16], rows: sum }]);
  };

  A.V.spend = {
    html: function () {
      var ms = months(); if (st.spMonth !== 'all' && ms.indexOf(st.spMonth) < 0) st.spMonth = 'all';
      var b = build();
      var h = '<h1 class="page-title">Expenditure</h1><div class="row" style="margin-bottom:10px"><select class="sel grow" id="sp-m"><option value="all">All time</option>' +
        ms.map(function (k) { return '<option value="' + k + '"' + (k === st.spMonth ? ' selected' : '') + '>' + U.monthLabel(k) + '</option>'; }).join('') + '</select></div>';
      if (!b.count) return h + '<div class="empty"><b>No spending yet</b>Money you send out by M-Pesa, business costs and cash used appear here.</div>';
      h += '<div class="tot four"><div><small>Total spent</small><b class="num neg">' + U.money(b.total) + '</b></div><div><small>Items</small><b class="num">' + b.count + '</b></div></div>';
      h += '<div class="row" style="margin-bottom:10px"><button class="btn grow" id="sp-rep">Print report</button><button class="btn ghost grow" id="sp-xls">Excel</button></div>';
      b.groups.forEach(function (g) {
        h += '<div class="card"><div class="row"><h3 class="grow">' + U.esc(g.name) + '</h3><b class="num">' + U.money(g.total) + '</b></div>';
        g.catList.forEach(function (c) {
          var k = g.name + '|' + c.name, open = !!st.spOpen[k];
          h += '<div class="sp-cat" data-k="' + U.esc(k) + '"><div class="list-item sp-h" style="cursor:pointer"><div class="grow"><b>' + U.esc(c.name) + '</b><small>' + c.items.length + (c.items.length === 1 ? ' item' : ' items') + '</small></div><b class="num">' + U.money(c.total) + '</b><span class="chev">' + (open ? '▲' : '▼') + '</span></div>';
          if (open) h += c.items.map(function (i) { return '<div class="list-item" style="padding-left:12px"><div class="grow"><span>' + U.esc(i.what) + '</span><small>' + U.fmtDayYear(i.date) + ' · ' + U.esc(i.src) + '</small></div><span class="num">' + U.money2(i.amount) + '</span></div>'; }).join('');
          h += '</div>';
        });
        h += '</div>';
      });
      return h + '<p class="hint center">Transaction costs (M-Pesa, bank and ATM charges) show as their own category. Tap a category to see when and on what. Categories come from the tags you set in Money.</p>';
    },
    mount: function (root) {
      var m = U.$('#sp-m', root); if (m) m.onchange = function () { st.spMonth = this.value; A.refresh(); };
      var r = U.$('#sp-rep', root); if (!r) return;
      r.onclick = function () { C.Export.print(A.spendReportHTML(), 'Chil expenditure report'); };
      U.$('#sp-xls', root).onclick = function () { U.download('Chil-expenditure-' + (st.spMonth === 'all' ? 'all-time' : st.spMonth) + '.xlsx', A.spendXLSX(), C.Xlsx.MIME); };
      U.$$('.sp-h', root).forEach(function (h) { h.onclick = function () { var k = h.parentNode.getAttribute('data-k'); st.spOpen[k] = !st.spOpen[k]; A.refresh(); }; });
    }
  };
})();
