/* Chil: Customers. Everyone who paid you by M-Pesa, ranked by total spent. Read from your messages. */
(function () {
  var C = window.Chil, U = C.U, S = C.Store, A = C.A;
  var st = A.st, q = '';

  function months() {
    var m = {};
    S.D.tx.forEach(function (r) { if (r.dir === 'in') m[U.monthKey(r.date)] = 1; });
    return Object.keys(m).sort().reverse();
  }
  function list(includeHidden) {
    var g = {}, hid = S.D.settings.hidden || [];
    S.D.tx.forEach(function (r) {
      if (r.dir !== 'in') return;
      if (st.custMonth !== 'all' && U.monthKey(r.date) !== st.custMonth) return;
      var k = U.key(r.name);
      if (!k) return;
      var c = g[k] = g[k] || { key: k, names: {}, total: 0, count: 0, last: '', rows: [] };
      c.names[r.name] = (c.names[r.name] || 0) + 1;
      c.total += r.amount; c.count++; if (r.date > c.last) c.last = r.date;
      c.rows.push(r);
    });
    var out = Object.keys(g).map(function (k) {
      var c = g[k];
      c.name = Object.keys(c.names).sort(function (a, b) { return c.names[b] - c.names[a]; })[0];
      c.total = U.round2(c.total); c.hidden = hid.indexOf(k) >= 0;
      return c;
    });
    out = out.filter(function (c) { return includeHidden ? c.hidden : !c.hidden; });
    out.sort(function (a, b) { return b.total - a.total || (a.name < b.name ? -1 : 1); });
    return out;
  }

  /* ---------- reports: per customer, or all customers grouped by customer ---------- */
  function cat(r) { return r.tag || 'Untagged'; }
  function sums(rows) {
    var m = {}, tot = 0;
    rows.forEach(function (r) { var k = cat(r); (m[k] = m[k] || { n: 0, t: 0 }); m[k].n++; m[k].t += r.amount; tot += r.amount; });
    var out = Object.keys(m).sort(function (a, b) { return m[b].t - m[a].t; }).map(function (k) { return { cat: k, n: m[k].n, total: U.round2(m[k].t) }; });
    return { cats: out, total: U.round2(tot) };
  }
  function sorted(c) { return c.rows.slice().sort(function (a, b) { return a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0; }); }
  function periodLabel() { return st.custMonth === 'all' ? 'All time' : U.monthLabel(st.custMonth); }
  function oneHTML(c) {
    var rows = sorted(c), sm = sums(rows);
    var h = '<h2>' + U.esc(c.name) + '</h2><table><tr><th>Date</th><th>Customer</th><th>Category</th><th class="n">Amount</th></tr>' +
      rows.map(function (r) { return '<tr><td>' + U.fmtDayYear(r.date) + '</td><td>' + U.esc(c.name) + '</td><td>' + U.esc(cat(r)) + '</td><td class="n">' + U.money2(r.amount) + '</td></tr>'; }).join('') + '</table>' +
      '<table><tr><th>Category</th><th class="n">Payments</th><th class="n">Total</th></tr>' +
      sm.cats.map(function (x) { return '<tr><td>' + U.esc(x.cat) + '</td><td class="n">' + x.n + '</td><td class="n">' + U.money2(x.total) + '</td></tr>'; }).join('') +
      '<tr><th>Total for ' + U.esc(c.name) + '</th><th class="n">' + rows.length + '</th><th class="n">' + U.money2(sm.total) + '</th></tr></table>';
    return { html: h, total: sm.total, rows: rows };
  }
  A.customerReportHTML = function (cs) {
    var one = cs.length === 1, all = [], grand = 0;
    var h = '<h1>' + (one ? 'Customer report: ' + U.esc(cs[0].name) : 'All customers report') + ' · ' + U.esc(A.shopLabel()) + '</h1><p class="sub">' + U.esc(periodLabel()) + ' · made ' + U.fmtDayYear(U.todayISO()) + '</p>';
    cs.forEach(function (c) { var o = oneHTML(c); h += o.html; grand += o.total; all = all.concat(o.rows); });
    if (!one) {
      var sm = sums(all);
      h += '<h2>All customers together</h2><table><tr><th>Category</th><th class="n">Payments</th><th class="n">Total</th></tr>' +
        sm.cats.map(function (x) { return '<tr><td>' + U.esc(x.cat) + '</td><td class="n">' + x.n + '</td><td class="n">' + U.money2(x.total) + '</td></tr>'; }).join('') +
        '<tr><th>Total from ' + cs.length + ' customers</th><th class="n">' + all.length + '</th><th class="n">' + U.money2(U.round2(grand)) + '</th></tr></table>';
    }
    return h;
  };
  A.customerReportCSV = function (cs) {
    function cell(v) { v = v == null ? '' : String(v); return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
    var out = [['Date', 'Customer', 'Category', 'Amount']], all = [];
    cs.forEach(function (c) {
      var rows = sorted(c), sm = sums(rows);
      rows.forEach(function (r) { out.push([r.date, c.name, cat(r), r.amount.toFixed(2)]); all.push(r); });
      sm.cats.forEach(function (x) { out.push(['', c.name, 'Total ' + x.cat, x.total.toFixed(2)]); });
      out.push(['', c.name, 'TOTAL', sm.total.toFixed(2)]); out.push([]);
    });
    if (cs.length > 1) {
      var sa = sums(all);
      sa.cats.forEach(function (x) { out.push(['', 'ALL CUSTOMERS', 'Total ' + x.cat, x.total.toFixed(2)]); });
      out.push(['', 'ALL CUSTOMERS', 'GRAND TOTAL', sa.total.toFixed(2)]);
    }
    return '\ufeff' + out.map(function (r) { return r.map(cell).join(','); }).join('\r\n') + '\r\n';
  };
  function fileName(cs, ext) { return 'Chil-' + (cs.length === 1 ? 'customer-' + U.key(cs[0].name).replace(/\s+/g, '-') : 'all-customers') + '-' + (st.custMonth === 'all' ? 'all-time' : st.custMonth) + '.' + ext; }

  function rowHTML(c, i) {
    var open = !!st.custOpen[c.key];
    var h = '<div class="cust' + (open ? ' open' : '') + '" data-k="' + U.esc(c.key) + '"><div class="cust-h"><span class="rank">' + (i + 1) + '</span><div class="grow"><b>' + U.esc(c.name) + '</b><small>' +
      c.count + (c.count === 1 ? ' payment' : ' payments') + ' · last ' + U.fmtDayYear(c.last) + '</small></div><b class="num pos">' + U.money(c.total) + '</b><span class="chev">' + (open ? '▲' : '▼') + '</span></div>';
    if (open) {
      h += '<div class="cust-b">' + c.rows.slice().sort(function (a, b) { return a.ts < b.ts ? 1 : -1; }).map(function (r) {
        return '<div class="list-item"><div class="grow"><span>' + U.fmtDayYear(r.date) + ' · ' + U.time12(r.time) + '</span><small>' + U.esc((r.bucket ? U.cap(r.bucket) : '') + (r.tag ? ' · ' + r.tag : '')) + '</small></div><b class="num">' + U.money2(r.amount) + '</b></div>';
      }).join('') + '<div class="row" style="margin-top:8px;flex-wrap:wrap"><button class="btn small" data-rep="' + U.esc(c.key) + '">Print report</button><button class="btn ghost small" data-xls="' + U.esc(c.key) + '">Excel</button><button class="btn ghost small" data-hide="' + U.esc(c.key) + '">Not a customer (hide)</button></div></div>';
    }
    return h + '</div>';
  }

  A.V.customers = {
    html: function () {
      var ms = months(), all = list(false), hid = list(true), f = U.key(q);
      if (st.custMonth !== 'all' && ms.indexOf(st.custMonth) < 0) st.custMonth = 'all';
      var shown = f ? all.filter(function (c) { return U.key(c.name).indexOf(f) >= 0; }) : all;
      var total = U.sum(all, function (c) { return c.total; });
      var h = '<h1 class="page-title">Customers</h1>' +
        '<div class="row" style="margin-bottom:10px"><input class="in grow" id="cu-q" type="search" autocomplete="off" placeholder="Find a customer" value="' + U.esc(q) + '"><select class="sel" id="cu-m" style="width:auto"><option value="all">All time</option>' +
        ms.map(function (k) { return '<option value="' + k + '"' + (k === st.custMonth ? ' selected' : '') + '>' + U.monthLabel(k) + '</option>'; }).join('') + '</select></div>';
      if (!all.length && !hid.length) return h + '<div class="empty"><b>No customers yet</b>Everyone who pays you by M-Pesa appears here once you add your messages.</div>';
      h += '<div class="tot four"><div><small>Customers</small><b class="num">' + all.length + '</b></div><div><small>Total received</small><b class="num pos">' + U.money(total) + '</b></div></div>';
      h += '<div class="row" style="margin-bottom:10px"><button class="btn grow" id="cu-rep">Report: all customers</button><button class="btn ghost grow" id="cu-xls">Excel</button></div>';
      h += '<div id="cu-list">' + (shown.length ? shown.map(rowHTML).join('') : '<div class="empty"><b>We are sorry, we couldn\'t find your search.</b></div>') + '</div>';
      h += '<p class="hint center">Ranked by total spent. Tap a name to see what they paid. Family or friends who sent you money can be hidden.</p>';
      if (hid.length) h += '<div class="card"><h3>Hidden (' + hid.length + ')</h3>' + hid.map(function (c) { return '<div class="list-item"><span>' + U.esc(c.name) + '</span><button class="btn small ghost" data-show="' + U.esc(c.key) + '">Show again</button></div>'; }).join('') + '</div>';
      return h;
    },
    mount: function (root) {
      A.select.set({
        row: '.cust[data-k]', id: function (el) { return el.getAttribute('data-k'); },
        header: 'Rank\tCustomer\tPayments\tTotal spent',
        text: function (el) { var b = el.querySelector('.cust-h'); return [el.querySelector('.rank').textContent, el.querySelector('.grow b').textContent, (el.querySelector('.grow small').textContent.split(' ')[0]), b.querySelector('.num').textContent.replace(/,/g, '')].join('\t'); }
      });
      var inp = U.$('#cu-q', root);
      if (!inp) return;
      U.$('#cu-m', root).onchange = function () { st.custMonth = this.value; A.refresh(); };
      inp.oninput = function () { q = inp.value; var pos = inp.selectionStart; A.refresh(); var n = U.$('#cu-q'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* ignore */ } } };
      U.$$('.cust-h', root).forEach(function (h) { h.onclick = function () { var k = h.parentNode.getAttribute('data-k'); st.custOpen[k] = !st.custOpen[k]; A.refresh(); }; });
      function byKey(k) { return list(false).concat(list(true)).filter(function (c) { return c.key === k; })[0]; }
      U.$('#cu-rep', root).onclick = function () { C.Export.print(A.customerReportHTML(list(false)), 'Chil customers report'); };
      U.$('#cu-xls', root).onclick = function () { var cs = list(false); U.download(fileName(cs, 'csv'), A.customerReportCSV(cs), 'text/csv;charset=utf-8'); };
      U.$$('[data-rep]', root).forEach(function (b) { b.onclick = function () { var c = byKey(b.getAttribute('data-rep')); if (c) C.Export.print(A.customerReportHTML([c]), 'Chil customer report'); }; });
      U.$$('[data-xls]', root).forEach(function (b) { b.onclick = function () { var c = byKey(b.getAttribute('data-xls')); if (c) U.download(fileName([c], 'csv'), A.customerReportCSV([c]), 'text/csv;charset=utf-8'); }; });
      U.$$('[data-hide]', root).forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-hide'); var hid = S.D.settings.hidden || (S.D.settings.hidden = []); if (hid.indexOf(k) < 0) hid.push(k); S.commit('settings'); A.refresh(); }; });
      U.$$('[data-show]', root).forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-show'); S.D.settings.hidden = (S.D.settings.hidden || []).filter(function (x) { return x !== k; }); S.commit('settings'); A.refresh(); }; });
    }
  };
})();
