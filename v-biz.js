/* Chil: Business evaluation. A Stock | Sales | Profit table with as many rows as needed, plus profit, loss and projections. */
(function () {
  var C = window.Chil, U = C.U, S = C.Store, A = C.A, E = C.Calc;
  var st = A.st;

  function val(t) { return t == null || String(t).trim() === '' ? null : E.evalExpr(t); }
  function rowCalc(r) {
    var st_ = val(r.stock), sa = val(r.sales);
    return { stock: st_, sales: sa, profit: (st_ == null && sa == null) ? null : U.round2((sa || 0) - (st_ || 0)) };
  }
  function signed(n) { return (n < 0 ? '−' : '') + U.money(Math.abs(n)); }
  function cls(n) { return n < 0 ? 'neg' : n > 0 ? 'pos' : ''; }

  function months() {
    var m = {};
    S.D.biz.rows.forEach(function (r) { m[U.monthKey(r.date)] = 1; });
    m[U.monthKey(U.todayISO())] = 1;
    return Object.keys(m).sort().reverse();
  }
  function rowsInView() {
    return S.D.biz.rows.filter(function (r) { return st.bizMonth === 'all' || U.monthKey(r.date) === st.bizMonth; });
  }

  // All the numbers and advice, from the rows on screen, the optional capital, and your tagged M-Pesa records.
  A.bizStats = function () {
    var rows = rowsInView(), cap = S.D.biz.capital;
    var t = { stock: 0, sales: 0, profit: 0 }, days = {}, items = {};
    rows.forEach(function (r) {
      var c = rowCalc(r);
      if (c.profit == null) return;
      t.stock += c.stock || 0; t.sales += c.sales || 0; t.profit += c.profit;
      days[r.date] = 1;
      var nm = String(r.item || '').trim();
      if (nm) { var k = U.key(nm); items[k] = items[k] || { name: nm, profit: 0 }; items[k].profit += c.profit; }
    });
    t.stock = U.round2(t.stock); t.sales = U.round2(t.sales); t.profit = U.round2(t.profit);
    var activeDays = Object.keys(days).length;
    var margin = t.sales > 0 ? t.profit / t.sales * 100 : null;
    var markup = t.stock > 0 ? t.profit / t.stock * 100 : null;
    var perDay = activeDays ? t.profit / activeDays : null;
    var openDays = Math.max(1, (S.D.settings.days || []).length || 6);
    var proj = perDay == null ? null : { week: perDay * openDays, month: perDay * openDays * 4.33, quarter: perDay * openDays * 13 };
    // Other business costs paid by M-Pesa (tagged Business, not stock or savings) in the same period.
    var tx = S.D.tx.filter(function (r) { return st.bizMonth === 'all' || U.monthKey(r.date) === st.bizMonth; });
    var costs = 0, persOut = 0, bizIn = 0;
    tx.forEach(function (r) {
      if (r.dir === 'in' && r.bucket === 'business') bizIn += r.amount;
      if (r.dir !== 'out') return;
      var tot = r.amount + (r.fee || 0);
      if (r.tag === 'Savings') return;
      if (r.bucket === 'business' && U.key(r.tag) !== 'stock') costs += tot;
      if (r.bucket === 'personal') persOut += tot;
    });
    costs = U.round2(costs); persOut = U.round2(persOut); bizIn = U.round2(bizIn);
    var list = Object.keys(items).map(function (k) { return items[k]; }).sort(function (a, b) { return b.profit - a.profit; });
    var out = { rows: rows.length, t: t, activeDays: activeDays, margin: margin, markup: markup, perDay: perDay, proj: proj, costs: costs,
      afterCosts: U.round2(t.profit - costs), items: list, cap: cap };
    if (cap) {
      out.roi = t.profit / cap * 100;
      out.rotation = t.stock / cap;
      out.payback = perDay > 0 ? Math.ceil(cap / perDay) : null;
    }
    if (costs > 0 && margin > 0) out.breakEven = costs / (margin / 100);
    // Advice in plain words.
    var tips = [];
    if (!activeDays) tips.push('Add a few rows (item, stock, sales) and Chil will work out your profit and advice.');
    else {
      if (t.profit < 0) tips.push('You are at a loss of KSh ' + U.money(-t.profit) + ' in this period. Check your buying prices and what is not selling.');
      if (margin != null && margin < 10 && t.profit >= 0) tips.push('Your profit margin is ' + margin.toFixed(1) + '%. Raise prices a little, or look for cheaper stock.');
      if (margin != null && margin >= 25) tips.push('Healthy margin of ' + margin.toFixed(1) + '%. Keep your prices and buy more of what sells.');
      var losers = list.filter(function (i) { return i.profit < 0; }).slice(0, 3);
      if (losers.length) tips.push('Lost money on: ' + losers.map(function (i) { return i.name; }).join(', ') + '. Check the buying price or stop stocking it.');
      if (list.length && list[0].profit > 0) tips.push('Best earner: ' + list[0].name + ' (profit KSh ' + U.money(list[0].profit) + '). Keep it always in stock.');
      if (cap && out.payback && out.payback > 90) tips.push('At this speed your capital takes about ' + out.payback + ' working days to come back. Sell faster or buy stock that moves quicker.');
      if (cap && out.rotation != null && out.rotation < 0.5) tips.push('You have bought stock worth only ' + Math.round(out.rotation * 100) + '% of your capital. Idle capital earns nothing: consider stocking more of your best sellers.');
      if (costs > 0 && out.afterCosts < 0) tips.push('Other business costs (KSh ' + U.money(costs) + ') are higher than your profit. Look at what you can cut.');
      if (bizIn > 0 && persOut / bizIn > 0.5) tips.push('Personal spending is ' + Math.round(persOut / bizIn * 100) + '% of your business income. Try to leave more in the business.');
      if (activeDays < 3) tips.push('Only ' + activeDays + (activeDays === 1 ? ' day' : ' days') + ' of entries so far. Add more days to make projections more reliable.');
    }
    out.tips = tips;
    return out;
  };

  function insightsHTML() {
    var s = A.bizStats(), h = '';
    h += '<div class="card"><h3>Profit and loss</h3>' +
      '<div class="list-item"><span>Sales</span><b class="num">' + U.money(s.t.sales) + '</b></div>' +
      '<div class="list-item"><span>Stock cost</span><b class="num">' + U.money(s.t.stock) + '</b></div>' +
      '<div class="list-item"><span><b>' + (s.t.profit < 0 ? 'Loss' : 'Profit') + '</b></span><b class="num ' + cls(s.t.profit) + '">' + signed(s.t.profit) + '</b></div>' +
      (s.margin != null ? '<div class="list-item"><span>Profit margin</span><b class="num">' + s.margin.toFixed(1) + '%</b></div>' : '') +
      (s.markup != null ? '<div class="list-item"><span>Markup on stock</span><b class="num">' + s.markup.toFixed(1) + '%</b></div>' : '') +
      (s.costs > 0 ? '<div class="list-item"><span>Other business costs (from M-Pesa)</span><b class="num neg">' + U.money(s.costs) + '</b></div><div class="list-item"><span><b>Profit after these costs</b></span><b class="num ' + cls(s.afterCosts) + '">' + signed(s.afterCosts) + '</b></div>' : '') +
      (s.breakEven ? '<div class="list-item"><span>Sales needed to cover those costs</span><b class="num">' + U.money(s.breakEven) + '</b></div>' : '') +
      '</div>';
    if (s.cap) {
      h += '<div class="card"><h3>Your capital</h3>' +
        '<div class="list-item"><span>Capital</span><b class="num">' + U.money(s.cap) + '</b></div>' +
        '<div class="list-item"><span>Return on capital</span><b class="num ' + cls(s.roi) + '">' + s.roi.toFixed(1) + '%</b></div>' +
        '<div class="list-item"><span>Stock bought vs capital</span><b class="num">' + s.rotation.toFixed(2) + ' times</b></div>' +
        '<div class="list-item"><span>Capital plus profit</span><b class="num">' + U.money(s.cap + s.t.profit) + '</b></div>' +
        (s.payback ? '<div class="list-item"><span>Time to earn back capital</span><b class="num">~' + s.payback + ' working days</b></div>' : '') + '</div>';
    }
    if (s.proj) {
      h += '<div class="card"><h3>If things continue like this</h3><div class="tot" style="margin-bottom:6px"><div><small>Next week</small><b class="num ' + cls(s.proj.week) + '">' + signed(Math.round(s.proj.week)) + '</b></div>' +
        '<div><small>Next month</small><b class="num ' + cls(s.proj.month) + '">' + signed(Math.round(s.proj.month)) + '</b></div><div><small>3 months</small><b class="num ' + cls(s.proj.quarter) + '">' + signed(Math.round(s.proj.quarter)) + '</b></div></div>' +
        '<p class="hint" style="margin:0">An estimate only. It uses your average profit per day (KSh ' + signed(Math.round(s.perDay)) + ' over ' + s.activeDays + (s.activeDays === 1 ? ' day' : ' days') + ' of entries) and the ' + ((S.D.settings.days || []).length || 6) + ' days a week you open.</p></div>';
    }
    h += '<div class="card"><h3>What to improve</h3>' + (s.tips.length ? s.tips.map(function (t) { return '<p style="margin:0 0 8px">• ' + U.esc(t) + '</p>'; }).join('') : '<p class="hint" style="margin:0">Nothing to flag yet. Keep adding your daily rows.</p>') + '</div>';
    return h;
  }

  function totalsHTML(s) {
    return '<div class="tot"><div><small>Stock</small><b class="num" id="b-stock">' + U.money(s.t.stock) + '</b></div><div><small>Sales</small><b class="num" id="b-sales">' + U.money(s.t.sales) + '</b></div>' +
      '<div><small>' + (s.t.profit < 0 ? 'Loss' : 'Profit') + '</small><b class="num ' + cls(s.t.profit) + '" id="b-profit">' + signed(s.t.profit) + '</b></div></div>';
  }

  function tableHTML() {
    var rows = rowsInView();
    if (!rows.length) return '<div class="empty"><b>No rows yet</b>Tap "+ Add row" and fill in an item, what the stock cost and what it sold for.</div>';
    var days = {};
    rows.forEach(function (r) { (days[r.date] = days[r.date] || []).push(r); });
    var h = '<div class="tw"><table class="t bz"><thead><tr><th>Item</th><th class="r">Stock</th><th class="r">Sales</th><th class="r">Profit</th><th></th></tr></thead><tbody>';
    Object.keys(days).sort().reverse().forEach(function (d) {
      var tot = 0; days[d].forEach(function (r) { var c = rowCalc(r); if (c.profit != null) tot += c.profit; });
      h += '<tr class="day"><td colspan="3">' + U.esc(U.fmtDayLong(d)) + '</td><td class="r ' + cls(tot) + '" data-day="' + d + '">' + signed(U.round2(tot)) + '</td><td></td></tr>';
      days[d].forEach(function (r) {
        var c = rowCalc(r);
        h += '<tr data-id="' + r.id + '"><td><input class="bzin" data-f="item" maxlength="40" placeholder="e.g. Sugar" value="' + U.esc(r.item || '') + '"></td>' +
          '<td><input class="bzin r' + (r.stock && c.stock == null ? ' bad' : '') + '" data-f="stock" inputmode="decimal" autocomplete="off" placeholder="0" value="' + U.esc(r.stock || '') + '"></td>' +
          '<td><input class="bzin r' + (r.sales && c.sales == null ? ' bad' : '') + '" data-f="sales" inputmode="decimal" autocomplete="off" placeholder="0" value="' + U.esc(r.sales || '') + '"></td>' +
          '<td class="r num ' + cls(c.profit || 0) + '" data-p><b>' + (c.profit == null ? '' : signed(c.profit)) + '</b></td><td><button class="del" data-f="del" aria-label="Delete row">✕</button></td></tr>';
      });
    });
    return h + '</tbody></table></div>';
  }

  function bizCSV() {
    function cell(v) { v = v == null ? '' : String(v); return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
    var rows = [['Date', 'Item', 'Stock', 'Sales', 'Profit']];
    rowsInView().slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }).forEach(function (r) {
      var c = rowCalc(r);
      rows.push([r.date, r.item || '', c.stock == null ? '' : c.stock.toFixed(2), c.sales == null ? '' : c.sales.toFixed(2), c.profit == null ? '' : c.profit.toFixed(2)]);
    });
    return '﻿' + rows.map(function (r) { return r.map(cell).join(','); }).join('\r\n') + '\r\n';
  }

  A.V.biz = {
    html: function () {
      var ms = months(), cap = S.D.biz.capital, s = A.bizStats();
      if (st.bizMonth !== 'all' && ms.indexOf(st.bizMonth) < 0) st.bizMonth = 'all';
      return '<h1 class="page-title">Business evaluation</h1>' +
        '<div class="card"><h3>Your capital <span class="mute" style="font-weight:400">(optional)</span></h3><input class="in" id="b-cap" inputmode="decimal" autocomplete="off" placeholder="Leave empty if you prefer" value="' + (cap ? U.esc(String(cap)) : '') + '">' +
        '<p class="hint">Adds return on capital and how fast your money comes back. You can change it any time.</p></div>' +
        '<select class="sel" id="b-month" style="margin-bottom:12px"><option value="all">All time</option>' + ms.map(function (k) { return '<option value="' + k + '"' + (k === st.bizMonth ? ' selected' : '') + '>' + U.monthLabel(k) + '</option>'; }).join('') + '</select>' +
        '<div id="b-totals">' + totalsHTML(s) + '</div><button class="btn block" id="b-add" style="margin-bottom:12px">+ Add row</button>' +
        '<div id="b-table">' + tableHTML() + '</div>' +
        (S.D.biz.rows.length ? '<button class="btn ghost block" id="b-xls" style="margin-bottom:14px">Download as Excel</button>' : '') +
        '<div id="b-insights">' + insightsHTML() + '</div>';
    },
    mount: function (root) {
      var cap = U.$('#b-cap', root);
      cap.onchange = function () {
        var raw = cap.value.trim(), v = raw === '' ? null : E.evalExpr(raw);
        if (raw !== '' && (v == null || v <= 0)) { U.toast('Enter an amount above 0, or leave it empty'); cap.value = S.D.biz.capital || ''; return; }
        S.D.biz.capital = v == null ? null : U.round2(v); S.commit('biz'); cap.value = S.D.biz.capital || ''; live(); U.toast('Saved');
      };
      U.$('#b-month', root).onchange = function () { st.bizMonth = this.value; A.refresh(); };
      U.$('#b-add', root).onclick = function () {
        var id = U.uid();
        S.D.biz.rows.push({ id: id, date: U.todayISO(), item: '', stock: '', sales: '' });
        if (st.bizMonth !== 'all' && st.bizMonth !== U.monthKey(U.todayISO())) st.bizMonth = U.monthKey(U.todayISO());
        S.commit('biz'); A.refresh();
        setTimeout(function () { var el = U.$('tr[data-id="' + id + '"] [data-f=item]'); if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); } }, 40);
      };
      var xl = U.$('#b-xls', root);
      if (xl) xl.onclick = function () { U.download('Chil-business-' + (st.bizMonth === 'all' ? 'all-time' : st.bizMonth) + '.csv', bizCSV(), 'text/csv;charset=utf-8'); };
      bindRows(root);
    }
  };

  // Update numbers without redrawing, so typing is never interrupted.
  function live() {
    var s = A.bizStats();
    var t = U.$('#b-totals'); if (t) t.innerHTML = totalsHTML(s);
    var i = U.$('#b-insights'); if (i) i.innerHTML = insightsHTML();
    var days = {};
    rowsInView().forEach(function (r) { var c = rowCalc(r); if (c.profit != null) days[r.date] = (days[r.date] || 0) + c.profit; });
    U.$$('[data-day]').forEach(function (el) { var v = U.round2(days[el.getAttribute('data-day')] || 0); el.textContent = signed(v); el.className = 'r ' + cls(v); });
  }

  function bindRows(root) {
    U.$$('tr[data-id]', root).forEach(function (tr) {
      var r = S.D.biz.rows.filter(function (x) { return x.id === tr.getAttribute('data-id'); })[0];
      if (!r) return;
      U.$$('[data-f]', tr).forEach(function (f) {
        var k = f.getAttribute('data-f');
        if (k === 'del') {
          f.onclick = function () {
            function go() { S.D.biz.rows = S.D.biz.rows.filter(function (x) { return x !== r; }); S.commit('biz'); A.refresh(); }
            if (!r.item && !r.stock && !r.sales) go(); else A.confirm('Delete this row?', (r.item || 'This row') + ' will be removed.', 'Delete', go, true);
          };
          return;
        }
        f.oninput = function () {
          r[k] = f.value;
          var c = rowCalc(r);
          if (k !== 'item') f.classList.toggle('bad', f.value.trim() !== '' && c[k] == null);
          var p = U.$('[data-p]', tr);
          p.innerHTML = '<b>' + (c.profit == null ? '' : signed(c.profit)) + '</b>'; p.className = 'r num ' + cls(c.profit || 0);
          S.commit('biz'); live();
        };
      });
    });
  }
})();
