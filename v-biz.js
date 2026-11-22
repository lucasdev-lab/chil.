/* Chil: Business. Sales and M-Pesa costs are read from the Money tab. You add stock bought and other costs that were not in M-Pesa.
   Profit, a balance sheet, projections and advice come from those. */
(function () {
  var C = window.Chil, U = C.U, S = C.Store, A = C.A, E = C.Calc, Ex = C.Export;
  var st = A.st;

  function signed(n) { return (n < 0 ? '−' : '') + U.money(Math.abs(n)); }
  function cls(n) { return n < 0 ? 'neg' : n > 0 ? 'pos' : ''; }
  function amt(r) { return +r.amount || 0; }

  function months() {
    var m = {};
    S.D.tx.forEach(function (r) { m[U.monthKey(r.date)] = 1; });
    S.D.biz.rows.forEach(function (r) { m[U.monthKey(r.date)] = 1; });
    Object.keys(S.D.cash.days).forEach(function (d) { m[U.monthKey(d)] = 1; });
    m[U.monthKey(U.todayISO())] = 1;
    return Object.keys(m).sort().reverse();
  }
  function rowsInView() {
    return S.D.biz.rows.filter(function (r) { return st.bizMonth === 'all' || U.monthKey(r.date) === st.bizMonth; });
  }
  function snapBefore(date, strict) {
    var best = null;
    S.D.biz.stockSnaps.forEach(function (x) { if ((strict ? x.date < date : x.date <= date) && (!best || x.date >= best.date)) best = x; });
    return best;
  }

  // Profit and loss between two dates (inclusive). from = null means since the start.
  A.bizCalc = function (from, to) {
    var f = from || '0000-00-00';
    var tx = S.D.tx.filter(function (r) { return r.date >= f && r.date <= to; });
    var sm = A.summarize(tx);
    var led = A.ledger().filter(function (e) { return e.date >= f && e.date <= to; });
    var cashIn = 0, cashUsed = 0, rowStock = 0, rowExp = 0, days = {};
    led.forEach(function (e) { cashIn += e.cashIn; cashUsed += e.cashUsed; });
    S.D.biz.rows.forEach(function (r) {
      if (r.date < f || r.date > to) return;
      if (r.kind === 'stock') rowStock += amt(r); else rowExp += amt(r);
    });
    var mStock = 0, mExp = 0, persOut = 0;
    tx.forEach(function (r) {
      if (r.dir === 'in' && (r.bucket === 'business')) days[r.date] = 1;
      if (r.dir !== 'out' || r.tag === 'Savings') return;
      var tot = r.amount + (r.fee || 0);
      if (r.bucket === 'business') { if (U.key(r.tag) === 'stock') mStock += tot; else mExp += tot; }
      else persOut += tot;
    });
    led.forEach(function (e) { if (e.cashIn > 0) days[e.date] = 1; });
    var open = from ? snapBefore(from, true) : null, close = snapBefore(to, false);
    var o = {
      from: from, to: to,
      salesM: U.round2(sm.inBiz), salesCash: U.round2(cashIn), sales: U.round2(sm.inBiz + cashIn),
      stockBuyM: U.round2(mStock), stockBuyRows: U.round2(rowStock), stockBuy: U.round2(mStock + rowStock),
      expM: U.round2(mExp), expRows: U.round2(rowExp), exp: U.round2(mExp + rowExp),
      openStock: open ? open.value : 0, closeStock: close ? close.value : 0, hasClose: !!close, hasOpen: !!open || !from,
      persOut: U.round2(persOut), cashUsed: U.round2(cashUsed), activeDays: Object.keys(days).length, sm: sm
    };
    o.cogs = U.round2(o.openStock + o.stockBuy - o.closeStock);
    o.profit = U.round2(o.sales - o.cogs - o.exp);
    o.cashMade = U.round2(o.sales - o.stockBuy - o.exp);
    return o;
  };

  // Numbers and advice for the month (or all time) chosen on the page.
  A.bizStats = function () {
    var from = null, to = U.todayISO();
    if (st.bizMonth !== 'all') { from = st.bizMonth + '-01'; to = st.bizMonth + '-31'; }
    var o = A.bizCalc(from, to), cap = S.D.biz.capital;
    o.cap = cap;
    o.margin = o.sales > 0 ? o.profit / o.sales * 100 : null;
    o.perDay = o.activeDays ? o.profit / o.activeDays : null;
    var openDays = Math.max(1, (S.D.settings.days || []).length || 6);
    o.proj = o.perDay == null ? null : { week: o.perDay * openDays, month: o.perDay * openDays * 4.33, quarter: o.perDay * openDays * 13 };
    o.openDays = openDays;
    if (cap) { o.roi = o.profit / cap * 100; o.payback = o.perDay > 0 ? Math.ceil(cap / o.perDay) : null; }
    if (o.exp > 0 && o.margin > 0 && o.sales > 0) { var gm = (o.sales - o.cogs) / o.sales; if (gm > 0) o.breakEven = o.exp / gm; }
    var tips = [];
    if (!o.sales && !o.exp && !o.stockBuy) tips.push('Add your M-Pesa messages and your cash in on the Money tab, then add stock bought here. Chil will work out your profit and advice.');
    else {
      if (!o.hasClose) tips.push('Type the value of the stock on your shelf (above). Without it every stock purchase is counted as spent, so profit looks lower than it really is.');
      else if (st.bizMonth !== 'all' && !o.hasOpen) tips.push('For an exact profit in this month, add your stock value as at the start of the month too (use "Save stock value" with that date).');
      if (o.profit < 0) tips.push('You are at a loss of KSh ' + U.money(-o.profit) + ' in this period. Check your buying prices and your costs.');
      if (o.margin != null && o.margin >= 0 && o.margin < 10) tips.push('Your profit margin is ' + o.margin.toFixed(1) + '%. Raise prices a little, or look for cheaper stock.');
      if (o.margin != null && o.margin >= 25) tips.push('Healthy margin of ' + o.margin.toFixed(1) + '%. Keep your prices and buy more of what sells.');
      if (o.sales > 0 && o.exp / o.sales > 0.3) tips.push('Other costs are ' + Math.round(o.exp / o.sales * 100) + '% of your sales. Look at what you can cut.');
      if (o.sales > 0 && o.persOut / o.sales > 0.5) tips.push('Personal spending from M-Pesa is ' + Math.round(o.persOut / o.sales * 100) + '% of your sales. Try to leave more in the business.');
      if (cap && o.payback && o.payback > 90) tips.push('At this speed your capital takes about ' + o.payback + ' working days to come back. Sell faster or buy stock that moves quicker.');
      if (o.cashMade < 0 && o.profit >= 0) tips.push('You spent more cash than you earned, but the difference is stock still on your shelf. Sell it to get the cash back.');
      if (o.activeDays && o.activeDays < 3) tips.push('Only ' + o.activeDays + (o.activeDays === 1 ? ' day' : ' days') + ' of sales so far. Add more days to make projections more reliable.');
    }
    o.tips = tips;
    return o;
  };

  /* ---------- balance sheet ---------- */
  function mpesaBalanceAt(date) {
    var bal = { 'M-PESA': null, Pochi: null };
    S.D.tx.filter(function (r) { return r.date <= date; }).sort(function (a, b) { return a.ts < b.ts ? -1 : 1; }).forEach(function (r) {
      if (r.account === 'Both') { if (r.balance != null) bal['M-PESA'] = r.balance; if (r.pochiBal != null) bal.Pochi = r.pochiBal; }
      else if (r.balance != null && bal[r.account] !== undefined) bal[r.account] = r.balance;
    });
    var has = bal['M-PESA'] != null || bal.Pochi != null;
    return { auto: has ? U.round2((bal['M-PESA'] || 0) + (bal.Pochi || 0)) : null };
  }
  function debtOpenAt(kind, date) {
    var t = 0;
    S.D.debts.forEach(function (d) {
      if (d.kind !== kind || d.date > date) return;
      var paid = U.sum(d.payments || [], function (p) { return p.date <= date ? p.amount : 0; });
      var b = d.amount - paid; if (b > 0) t += b;
    });
    return U.round2(t);
  }
  A.balanceSheet = function (date) {
    var left = A.moneyLeftAt(date), mp = mpesaBalanceAt(date);
    var typed = S.D.biz.mpesaBal;
    var mpesa = typed != null ? typed : (mp.auto != null ? mp.auto : 0);
    var cash = U.round2(left - mpesa);
    var snap = snapBefore(date, false), stock = snap ? snap.value : 0;
    var debtors = debtOpenAt('owed', date), equip = U.sum(S.D.biz.equip, function (e) { return e.value; });
    var assets = U.round2(mpesa + cash + stock + debtors + equip);
    var creditors = debtOpenAt('owe', date);
    var net = U.round2(assets - creditors);
    var pl = A.bizCalc(null, date), sm = pl.sm;
    var drawings = U.round2((sm.spent + sm.saved - sm.outBiz) - sm.inPer - sm.inUn + pl.cashUsed);
    var cap = S.D.biz.capital || 0;
    var other = U.round2(net - (cap + pl.profit - drawings));
    return { date: date, mpesa: mpesa, mpesaAuto: mp.auto, mpesaTyped: typed != null, cash: cash, stock: stock, stockDate: snap ? snap.date : null, debtors: debtors, equip: equip,
      assets: assets, creditors: creditors, net: net, cap: cap, profit: pl.profit, drawings: drawings, other: other, left: left };
  };
  function bsRows(b, money) {
    return [
      ['h', 'What you own (Assets)'],
      ['r', 'M-Pesa and Pochi balance', b.mpesa],
      ['r', 'Cash in hand', b.cash],
      ['r', 'Stock on the shelf' + (b.stockDate ? ' (counted ' + U.fmtDayYear(b.stockDate) + ')' : ''), b.stock],
      ['r', 'Creditors (people who owe you)', b.debtors],
      ['r', 'Equipment and other assets', b.equip],
      ['t', 'Total assets', b.assets],
      ['h', 'What you owe (Liabilities)'],
      ['r', 'Debtors (people you owe)', b.creditors],
      ['t', 'Total liabilities', b.creditors],
      ['t', 'Net worth (assets minus liabilities)', b.net],
      ['h', 'What belongs to you (Owner\'s equity)'],
      ['r', 'Capital', b.cap],
      ['r', 'Profit to date', b.profit],
      ['r', 'Less: personal money taken out (net)', -b.drawings],
      ['r', 'Opening balance and other items (balancing figure)', b.other],
      ['t', 'Total owner\'s equity', b.net]
    ];
  }
  function bsHTML(b) {
    return bsRows(b).map(function (r) {
      if (r[0] === 'h') return '<p class="bs-h">' + U.esc(r[1]) + '</p>';
      return '<div class="list-item' + (r[0] === 't' ? ' bs-t' : '') + '"><span>' + (r[0] === 't' ? '<b>' + U.esc(r[1]) + '</b>' : U.esc(r[1])) + '</span><b class="num ' + (r[0] === 't' ? '' : cls(r[2])) + '">' + signed(r[2]) + '</b></div>';
    }).join('');
  }
  A.balanceSheetPrintHTML = function (date) {
    var b = A.balanceSheet(date);
    var h = '<h1>Balance sheet: ' + U.esc(A.shopLabel()) + '</h1><p class="sub">As at ' + U.fmtDayYear(date) + ' · made ' + U.fmtDayYear(U.todayISO()) + '</p><table>';
    bsRows(b).forEach(function (r) {
      if (r[0] === 'h') h += '<tr><th colspan="2">' + U.esc(r[1]) + '</th></tr>';
      else h += '<tr><td>' + (r[0] === 't' ? '<b>' + U.esc(r[1]) + '</b>' : U.esc(r[1])) + '</td><td class="n">' + (r[0] === 't' ? '<b>' + U.money2(r[2]) + '</b>' : U.money2(r[2])) + '</td></tr>';
    });
    return h + '</table><p class="sub">Assets = Liabilities + Owner\'s equity. Cash in hand is worked out from your daily cash rows minus the M-Pesa balance. Stock is the value you typed. The balancing figure holds your opening balance and any items not recorded as capital or profit.</p>';
  };
  A.bizPrintHTML = function () {
    var s = A.bizStats(), label = st.bizMonth === 'all' ? 'All time' : U.monthLabel(st.bizMonth);
    function r(a, b, c) { return '<tr><td>' + a + '</td><td class="n">' + b + '</td></tr>'; }
    return '<h1>Business report: ' + U.esc(A.shopLabel()) + '</h1><p class="sub">' + U.esc(label) + ' · made ' + U.fmtDayYear(U.todayISO()) + '</p><table>' +
      r('Sales (M-Pesa received as Business + cash in)', U.money2(s.sales)) +
      r('Stock at start', U.money2(s.openStock)) + r('Stock bought', U.money2(s.stockBuy)) + r('Stock left on shelf', '−' + U.money2(s.closeStock)) +
      r('<b>Cost of stock sold</b>', '<b>' + U.money2(s.cogs) + '</b>') + r('Other business costs', U.money2(s.exp)) +
      r('<b>' + (s.profit < 0 ? 'Loss' : 'Profit') + '</b>', '<b>' + U.money2(s.profit) + '</b>') +
      (s.margin != null ? r('Profit margin', s.margin.toFixed(1) + '%') : '') + r('Cash made or lost (money in minus money out)', U.money2(s.cashMade)) + '</table>' +
      (s.proj ? '<p class="sub">If things continue: next week ' + signed(Math.round(s.proj.week)) + ', next month ' + signed(Math.round(s.proj.month)) + ', 3 months ' + signed(Math.round(s.proj.quarter)) + '.</p>' : '') +
      (s.tips.length ? '<h2>What to improve</h2>' + s.tips.map(function (t) { return '<p>• ' + U.esc(t) + '</p>'; }).join('') : '');
  };

  /* ---------- screen pieces ---------- */
  function plHTML(s) {
    var h = '<div class="card"><h3>Profit and loss</h3>' +
      '<div class="list-item"><span>Sales from M-Pesa (Business)</span><b class="num">' + U.money(s.salesM) + '</b></div>' +
      '<div class="list-item"><span>Cash sales (Money tab)</span><b class="num">' + U.money(s.salesCash) + '</b></div>' +
      '<div class="list-item"><span><b>Total sales</b></span><b class="num">' + U.money(s.sales) + '</b></div>' +
      '<div class="list-item"><span>Stock bought</span><b class="num neg">' + U.money(s.stockBuy) + '</b></div>' +
      '<div class="list-item"><span>Stock left on shelf</span><b class="num">' + U.money(s.closeStock) + '</b></div>' +
      '<div class="list-item"><span>Cost of stock sold</span><b class="num neg">' + U.money(s.cogs) + '</b></div>' +
      '<div class="list-item"><span>Other business costs</span><b class="num neg">' + U.money(s.exp) + '</b></div>' +
      '<div class="list-item"><span><b>' + (s.profit < 0 ? 'Loss' : 'Profit') + '</b></span><b class="num ' + cls(s.profit) + '">' + signed(s.profit) + '</b></div>' +
      (s.margin != null ? '<div class="list-item"><span>Profit margin</span><b class="num">' + s.margin.toFixed(1) + '%</b></div>' : '') +
      '<div class="list-item"><span>Cash made or lost</span><b class="num ' + cls(s.cashMade) + '">' + signed(s.cashMade) + '</b></div>' +
      (s.breakEven ? '<div class="list-item"><span>Sales needed to cover your costs</span><b class="num">' + U.money(s.breakEven) + '</b></div>' : '') +
      '<p class="hint" style="margin:8px 0 0">Stock is not a loss when you buy it. Only the stock you sold counts. Cash made or lost counts every purchase as money out. Goods given on credit count as sales when the money comes in.</p></div>';
    return h;
  }
  function insightsHTML() {
    var s = A.bizStats(), h = plHTML(s);
    if (s.cap) {
      h += '<div class="card"><h3>Your capital</h3>' +
        '<div class="list-item"><span>Capital</span><b class="num">' + U.money(s.cap) + '</b></div>' +
        '<div class="list-item"><span>Return on capital</span><b class="num ' + cls(s.roi) + '">' + s.roi.toFixed(1) + '%</b></div>' +
        '<div class="list-item"><span>Capital plus profit</span><b class="num">' + U.money(s.cap + s.profit) + '</b></div>' +
        (s.payback ? '<div class="list-item"><span>Time to earn back capital</span><b class="num">~' + s.payback + ' working days</b></div>' : '') + '</div>';
    }
    if (s.proj) {
      h += '<div class="card"><h3>If things continue like this</h3><div class="tot" style="margin-bottom:6px"><div><small>Next week</small><b class="num ' + cls(s.proj.week) + '">' + signed(Math.round(s.proj.week)) + '</b></div>' +
        '<div><small>Next month</small><b class="num ' + cls(s.proj.month) + '">' + signed(Math.round(s.proj.month)) + '</b></div><div><small>3 months</small><b class="num ' + cls(s.proj.quarter) + '">' + signed(Math.round(s.proj.quarter)) + '</b></div></div>' +
        '<p class="hint" style="margin:0">An estimate only. It uses your average profit per selling day (KSh ' + signed(Math.round(s.perDay)) + ' over ' + s.activeDays + (s.activeDays === 1 ? ' day' : ' days') + ') and the ' + s.openDays + ' days a week you open.</p></div>';
    }
    h += '<div class="card"><h3>What to improve</h3>' + (s.tips.length ? s.tips.map(function (t) { return '<p style="margin:0 0 8px">• ' + U.esc(t) + '</p>'; }).join('') : '<p class="hint" style="margin:0">Nothing to flag yet.</p>') + '</div>';
    return h;
  }
  function totalsHTML(s) {
    return '<div class="tot"><div><small>Sales</small><b class="num pos">' + U.money(s.sales) + '</b></div><div><small>Costs</small><b class="num neg">' + U.money(s.cogs + s.exp) + '</b></div>' +
      '<div><small>' + (s.profit < 0 ? 'Loss' : 'Profit') + '</small><b class="num ' + cls(s.profit) + '">' + signed(s.profit) + '</b></div></div>';
  }
  function tableHTML() {
    var rows = rowsInView();
    if (!rows.length) return '<div class="empty"><b>No rows yet</b>Add stock you bought and other costs that are not in your M-Pesa messages (for example stock paid in cash, rent, transport). Sales are read automatically.</div>';
    var days = {};
    rows.forEach(function (r) { (days[r.date] = days[r.date] || []).push(r); });
    var h = '<div class="tw"><table class="t bz"><thead><tr><th>Type</th><th>Item</th><th class="r">Amount</th><th></th></tr></thead><tbody>';
    Object.keys(days).sort().reverse().forEach(function (d) {
      var tot = U.sum(days[d], amt);
      h += '<tr class="day"><td colspan="2">' + U.esc(U.fmtDayLong(d)) + '</td><td class="r" data-day="' + d + '">' + U.money(tot) + '</td><td></td></tr>';
      days[d].forEach(function (r) {
        h += '<tr data-id="' + r.id + '"><td><select class="bzin" data-f="kind"><option value="stock"' + (r.kind === 'stock' ? ' selected' : '') + '>Stock</option><option value="expense"' + (r.kind === 'expense' ? ' selected' : '') + '>Expense</option></select></td>' +
          '<td><input class="bzin" data-f="item" maxlength="40" placeholder="' + (r.kind === 'stock' ? 'e.g. Sugar' : 'e.g. Rent') + '" value="' + U.esc(r.item || '') + '"></td>' +
          '<td><input class="bzin r' + (r.raw && E.evalExpr(r.raw) == null ? ' bad' : '') + '" data-f="amount" inputmode="decimal" autocomplete="off" placeholder="0" value="' + U.esc(r.raw != null ? r.raw : (r.amount || '')) + '"></td>' +
          '<td><button class="del" data-f="del" aria-label="Delete row">✕</button></td></tr>';
      });
    });
    return h + '</tbody></table></div>';
  }
  function stockCardHTML() {
    var snaps = S.D.biz.stockSnaps.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }), last = snaps[0];
    return '<div class="card"><h3>Stock on the shelf</h3><p class="hint" style="margin:0 0 8px">Count what is on your shelf and type its value at cost. ' + (last ? 'Last: KSh ' + U.money(last.value) + ' on ' + U.fmtDayYear(last.date) + '.' : 'You have not typed it yet.') + '</p>' +
      '<div class="row"><input class="in grow" id="sk-val" inputmode="decimal" autocomplete="off" placeholder="Value, e.g. 25000"><input class="in" type="date" id="sk-date" value="' + U.todayISO() + '" style="width:auto"></div>' +
      '<button class="btn block" id="sk-save" style="margin-top:8px">Save stock value</button>' +
      (snaps.length ? '<div style="margin-top:8px">' + snaps.slice(0, 4).map(function (x) { return '<div class="list-item"><span>' + U.fmtDayYear(x.date) + '</span><span><b class="num">' + U.money(x.value) + '</b> <button class="del" data-delsk="' + x.id + '" aria-label="Remove">✕</button></span></div>'; }).join('') + '</div>' : '') + '</div>';
  }
  function bsBodyHTML(b) {
    return bsHTML(b) + (b.cash < -1 ? '<div class="banner" style="margin-top:8px">Cash in hand is below zero. Check the first day\'s Brought forward on the Money tab: it should be all the money you started with, cash and M-Pesa.</div>' : '');
  }
  function bsCardHTML() {
    var b = A.balanceSheet(st.bsDate || U.todayISO());
    var h = '<div class="card"><h3>Balance sheet</h3><div class="row" style="margin-bottom:8px"><span class="mute grow" style="font-size:14px">As at</span><input class="in" type="date" id="bs-date" value="' + (st.bsDate || U.todayISO()) + '" style="width:auto"></div><div id="bs-body">' + bsBodyHTML(b) + '</div>';
    h += '<div class="list-item" style="margin-top:6px"><span>M-Pesa balance ' + (b.mpesaTyped ? '(typed)' : '(read from your latest message)') + '</span><span><input class="in" id="bs-mp" inputmode="decimal" autocomplete="off" placeholder="' + (b.mpesaAuto != null ? U.money(b.mpesaAuto) : '0') + '" value="' + (b.mpesaTyped ? U.esc(String(S.D.biz.mpesaBal)) : '') + '" style="width:110px;text-align:right"></span></div>' +
      '<p class="hint" style="margin:4px 0 8px">Leave empty to use your latest message balance. Type an amount to change it.</p>' +
      '<label class="f">Equipment and other assets (fridge, shelves, ...)</label>' +
      S.D.biz.equip.map(function (e) { return '<div class="list-item"><span>' + U.esc(e.name) + '</span><span><b class="num">' + U.money(e.value) + '</b> <button class="del" data-delq="' + e.id + '" aria-label="Remove">✕</button></span></div>'; }).join('') +
      '<button class="btn ghost block" id="bs-add" style="margin:8px 0">+ Add equipment</button>' +
      '<button class="btn green block" id="bs-print">Print or save balance sheet (PDF)</button></div>';
    return h;
  }
  function bizCSV() {
    function cell(v) { v = v == null ? '' : String(v); return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
    var rows = [['Date', 'Type', 'Item', 'Amount']];
    rowsInView().slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }).forEach(function (r) {
      rows.push([r.date, r.kind === 'stock' ? 'Stock' : 'Expense', r.item || '', amt(r).toFixed(2)]);
    });
    return '﻿' + rows.map(function (r) { return r.map(cell).join(','); }).join('\r\n') + '\r\n';
  }

  A.V.biz = {
    html: function () {
      var ms = months(), cap = S.D.biz.capital, s = A.bizStats();
      if (st.bizMonth !== 'all' && ms.indexOf(st.bizMonth) < 0) st.bizMonth = 'all';
      return '<h1 class="page-title">Business</h1>' +
        '<div class="card"><h3>Your capital <span class="mute" style="font-weight:400">(optional)</span></h3><input class="in" id="b-cap" inputmode="decimal" autocomplete="off" placeholder="Leave empty if you prefer" value="' + (cap ? U.esc(String(cap)) : '') + '">' +
        '<p class="hint">Adds return on capital and the balance sheet. You can change it any time.</p></div>' +
        stockCardHTML() +
        '<select class="sel" id="b-month" style="margin-bottom:12px"><option value="all">All time</option>' + ms.map(function (k) { return '<option value="' + k + '"' + (k === st.bizMonth ? ' selected' : '') + '>' + U.monthLabel(k) + '</option>'; }).join('') + '</select>' +
        '<div id="b-totals">' + totalsHTML(s) + '</div>' +
        '<div class="row" style="margin-bottom:12px"><button class="btn grow" id="b-add-stock">+ Stock bought</button><button class="btn ghost grow" id="b-add-exp">+ Other cost</button></div>' +
        '<p class="hint" style="margin:-4px 2px 10px">Only add what was NOT paid by M-Pesa. M-Pesa payments are read from the Money tab. Rows here count as cash used that day.</p>' +
        '<div id="b-table">' + tableHTML() + '</div>' +
        '<div id="b-insights">' + insightsHTML() + '</div>' +
        '<div id="b-bs">' + bsCardHTML() + '</div>' +
        '<div class="row" style="margin-bottom:14px"><button class="btn ghost grow" id="b-print">Print report</button>' + (S.D.biz.rows.length ? '<button class="btn ghost grow" id="b-xls">Excel</button>' : '') + '</div>';
    },
    mount: function (root) {
      var cap = U.$('#b-cap', root);
      cap.onchange = function () {
        var raw = cap.value.trim(), v = raw === '' ? null : E.evalExpr(raw);
        if (raw !== '' && (v == null || v <= 0)) { U.toast('Enter an amount above 0, or leave it empty'); cap.value = S.D.biz.capital || ''; return; }
        S.D.biz.capital = v == null ? null : U.round2(v); S.commit('biz'); cap.value = S.D.biz.capital || ''; live(); U.toast('Saved');
      };
      U.$('#b-month', root).onchange = function () { st.bizMonth = this.value; A.refresh(); };
      function addRow(kind) {
        var id = U.uid();
        S.D.biz.rows.push({ id: id, date: U.todayISO(), kind: kind, item: '', amount: 0, raw: '' });
        if (st.bizMonth !== 'all' && st.bizMonth !== U.monthKey(U.todayISO())) st.bizMonth = U.monthKey(U.todayISO());
        S.commit('biz'); A.refresh();
        setTimeout(function () { var el = U.$('tr[data-id="' + id + '"] [data-f=item]'); if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); } }, 40);
      }
      U.$('#b-add-stock', root).onclick = function () { addRow('stock'); };
      U.$('#b-add-exp', root).onclick = function () { addRow('expense'); };
      U.$('#sk-save', root).onclick = function () {
        var v = E.evalExpr(U.$('#sk-val', root).value), d = U.$('#sk-date', root).value || U.todayISO();
        if (v == null || v < 0) { U.toast('Type the stock value, for example 25000'); return; }
        S.D.biz.stockSnaps = S.D.biz.stockSnaps.filter(function (x) { return x.date !== d; });
        S.D.biz.stockSnaps.push({ id: U.uid(), date: d, value: U.round2(v) }); S.commit('biz'); A.refresh(); U.toast('Saved');
      };
      U.$$('[data-delsk]', root).forEach(function (b) { b.onclick = function () { var id = b.getAttribute('data-delsk'); S.D.biz.stockSnaps = S.D.biz.stockSnaps.filter(function (x) { return x.id !== id; }); S.commit('biz'); A.refresh(); }; });
      bindBS(root);
      U.$('#b-print', root).onclick = function () { Ex.print(A.bizPrintHTML(), 'Chil business report'); };
      var xl = U.$('#b-xls', root);
      if (xl) xl.onclick = function () { U.download('Chil-business-' + (st.bizMonth === 'all' ? 'all-time' : st.bizMonth) + '.csv', bizCSV(), 'text/csv;charset=utf-8'); };
      bindRows(root);
    }
  };

  function bindBS(root) {
    var bd = U.$('#bs-date', root);
    if (bd) bd.onchange = function () { if (this.value) { st.bsDate = this.value; U.$('#b-bs').innerHTML = bsCardHTML(); bindBS(root); } };
    U.$$('[data-delq]', root).forEach(function (b) { b.onclick = function () { var id = b.getAttribute('data-delq'); S.D.biz.equip = S.D.biz.equip.filter(function (x) { return x.id !== id; }); S.commit('biz'); A.refresh(); }; });
    var mp = U.$('#bs-mp', root);
    if (mp) mp.onchange = function () {
      mp.onchange = null;
      var t = mp.value.trim();
      if (t === '') S.D.biz.mpesaBal = null;
      else { var v = E.evalExpr(t); if (v == null) { U.toast('Enter an amount'); bindBS(root); return; } S.D.biz.mpesaBal = U.round2(v); }
      S.commit('biz'); U.$('#b-bs').innerHTML = bsCardHTML(); bindBS(root);
    };
    var add = U.$('#bs-add', root);
    if (add) add.onclick = function () {
      A.sheet('<h2>Add equipment</h2><label class="f">Name</label><input class="in" id="eq-n" maxlength="40" placeholder="e.g. Fridge"><label class="f">Value (KSh)</label><input class="in" id="eq-v" inputmode="decimal" placeholder="e.g. 30000"><div class="err" id="eq-e"></div><button class="btn green block" id="eq-s">Save</button>', function (b) {
        U.$('#eq-s', b).onclick = function () {
          var n = U.$('#eq-n', b).value.trim(), v = E.evalExpr(U.$('#eq-v', b).value);
          if (!n) { U.$('#eq-e', b).textContent = 'Give it a name.'; return; }
          if (v == null || v <= 0) { U.$('#eq-e', b).textContent = 'Type its value.'; return; }
          S.D.biz.equip.push({ id: U.uid(), name: n, value: U.round2(v) }); S.commit('biz'); A.closeSheet(); A.refresh();
        };
      });
    };
    var pr = U.$('#bs-print', root);
    if (pr) pr.onclick = function () { Ex.print(A.balanceSheetPrintHTML(st.bsDate || U.todayISO()), 'Chil balance sheet'); };
  }

  // Update numbers without redrawing, so typing is never interrupted.
  function live() {
    var s = A.bizStats();
    var t = U.$('#b-totals'); if (t) t.innerHTML = totalsHTML(s);
    var i = U.$('#b-insights'); if (i) i.innerHTML = insightsHTML();
    var b = U.$('#bs-body'); if (b) b.innerHTML = bsBodyHTML(A.balanceSheet(st.bsDate || U.todayISO()));
    var days = {};
    rowsInView().forEach(function (r) { days[r.date] = (days[r.date] || 0) + amt(r); });
    U.$$('[data-day]').forEach(function (el) { el.textContent = U.money(U.round2(days[el.getAttribute('data-day')] || 0)); });
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
            if (!r.item && !r.amount) go(); else A.confirm('Delete this row?', (r.item || 'This row') + ' will be removed.', 'Delete', go, true);
          };
          return;
        }
        if (k === 'kind') { f.onchange = function () { r.kind = f.value; S.commit('biz'); A.refresh(); }; return; }
        f.oninput = function () {
          if (k === 'amount') {
            r.raw = f.value; var v = f.value.trim() === '' ? 0 : E.evalExpr(f.value);
            r.amount = v == null ? 0 : U.round2(v);
            f.classList.toggle('bad', f.value.trim() !== '' && v == null);
          } else r[k] = f.value;
          S.commit('biz'); live();
        };
      });
    });
  }
})();
