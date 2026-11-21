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

  function rowHTML(c, i) {
    var open = !!st.custOpen[c.key];
    var h = '<div class="cust' + (open ? ' open' : '') + '" data-k="' + U.esc(c.key) + '"><div class="cust-h"><span class="rank">' + (i + 1) + '</span><div class="grow"><b>' + U.esc(c.name) + '</b><small>' +
      c.count + (c.count === 1 ? ' payment' : ' payments') + ' · last ' + U.fmtDayYear(c.last) + '</small></div><b class="num pos">' + U.money(c.total) + '</b><span class="chev">' + (open ? '▲' : '▼') + '</span></div>';
    if (open) {
      h += '<div class="cust-b">' + c.rows.slice().sort(function (a, b) { return a.ts < b.ts ? 1 : -1; }).map(function (r) {
        return '<div class="list-item"><div class="grow"><span>' + U.fmtDayYear(r.date) + ' · ' + U.time12(r.time) + '</span><small>' + U.esc((r.bucket ? U.cap(r.bucket) : '') + (r.tag ? ' · ' + r.tag : '')) + '</small></div><b class="num">' + U.money2(r.amount) + '</b></div>';
      }).join('') + '<button class="btn ghost small" data-hide="' + U.esc(c.key) + '" style="margin-top:8px">Not a customer (hide)</button></div>';
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
      h += '<div id="cu-list">' + (shown.length ? shown.map(rowHTML).join('') : '<div class="empty"><b>We are sorry, we couldn\'t find your search.</b></div>') + '</div>';
      h += '<p class="hint center">Ranked by total spent. Tap a name to see what they paid. Family or friends who sent you money can be hidden.</p>';
      if (hid.length) h += '<div class="card"><h3>Hidden (' + hid.length + ')</h3>' + hid.map(function (c) { return '<div class="list-item"><span>' + U.esc(c.name) + '</span><button class="btn small ghost" data-show="' + U.esc(c.key) + '">Show again</button></div>'; }).join('') + '</div>';
      return h;
    },
    mount: function (root) {
      var inp = U.$('#cu-q', root);
      if (!inp) return;
      U.$('#cu-m', root).onchange = function () { st.custMonth = this.value; A.refresh(); };
      inp.oninput = function () { q = inp.value; var pos = inp.selectionStart; A.refresh(); var n = U.$('#cu-q'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* ignore */ } } };
      U.$$('.cust-h', root).forEach(function (h) { h.onclick = function () { var k = h.parentNode.getAttribute('data-k'); st.custOpen[k] = !st.custOpen[k]; A.refresh(); }; });
      U.$$('[data-hide]', root).forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-hide'); var hid = S.D.settings.hidden || (S.D.settings.hidden = []); if (hid.indexOf(k) < 0) hid.push(k); S.commit('settings'); A.refresh(); }; });
      U.$$('[data-show]', root).forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-show'); S.D.settings.hidden = (S.D.settings.hidden || []).filter(function (x) { return x !== k; }); S.commit('settings'); A.refresh(); }; });
    }
  };
})();
