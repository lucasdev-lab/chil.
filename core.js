/* Chil core: shared state, sheets, summaries, rules, debts maths. Views live in v-*.js */
(function () {
  var C = window.Chil, U = C.U, S = C.Store;
  var A = { V: {}, st: {
    tab: 'money', sim: 0, month: 'all',
    sumMode: 'day', sumDay: U.todayISO(), sumMonth: U.monthKey(U.todayISO()), sumYear: String(new Date().getFullYear()),
    debtView: 'owed', bizMonth: 'all', cmpOpen: false, cashDay: U.todayISO(), bsDate: U.todayISO(), custMonth: 'all', custOpen: {}
  } };
  C.A = A;

  function ic(path) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + path + '</svg>'; }
  A.IC = {
    money: ic('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>'),
    sum: ic('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
    plus: ic('<path d="M12 5v14M5 12h14"/>'),
    biz: ic('<path d="M3 17l5-5 4 4 8-9"/><path d="M15 7h5v5"/>'),
    calc: ic('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2"/>'),
    debt: ic('<path d="M4 4h16v16H4zM4 10h16M10 4v16"/>'),
    more: ic('<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>'),
    spend: ic('<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>'),
    help: ic('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>'),
    people: ic('<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5.2a3.2 3.2 0 0 1 0 5.6M18 14.3c1.8.8 3 2.6 3 4.7"/>'),
    search: ic('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
    gear: ic('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>')
  };

  /* ---------- sheets (bottom pop-ups) ---------- */
  A.sheet = function (html, mount) {
    var b = U.$('#sheet-body');
    b.innerHTML = html;
    if (!U.$('#sheet').classList.contains('open') && A.nav) { A.nav.guard(); if (A.nav.ready) A.nav.push(); }
    U.$('#sheet').classList.add('open');
    U.$('#sheet .body').scrollTop = 0;
    if (mount) mount(b);
  };
  A.closeSheet = function () { U.$('#sheet').classList.remove('open'); U.$('#sheet-body').innerHTML = ''; };
  A.confirm = function (title, text, okLabel, fn, danger) {
    A.sheet('<h2>' + U.esc(title) + '</h2><p class="mute">' + U.esc(text) + '</p><div class="gap"></div>' +
      '<div class="row"><button class="btn ghost grow" data-x="no">Cancel</button><button class="btn ' + (danger ? 'danger' : 'green') + ' grow" data-x="yes">' + U.esc(okLabel) + '</button></div>',
      function (b) {
        U.$('[data-x=no]', b).onclick = A.closeSheet;
        U.$('[data-x=yes]', b).onclick = function () { A.closeSheet(); fn(); };
      });
  };

  /* ---------- records and rules ---------- */
  A.ruleKey = function (r) { return r.dir + '|' + U.key(r.name); };
  A.applyRules = function (list) {
    var rules = S.D.rules, n = 0;
    list.forEach(function (r) {
      if (r.dir === 'own') return;
      var ru = rules[A.ruleKey(r)];
      if (!ru) return;
      var changed = false;
      if (ru.bucket && (r.auto || !r.bucket)) { r.bucket = ru.bucket; delete r.auto; changed = true; }
      if (!r.tag && ru.tag) { r.tag = ru.tag; changed = true; }
      if (changed) { n++; if (r.tag && U.key(r.tag) === 'business debt') A.syncLoan(r); }
    });
    return n;
  };
  // Does the record still need the owner's attention?
  A.needsTag = function (r) {
    if (r.dir === 'own') return false;
    if (r.dir === 'in') return !r.bucket || !r.tag;
    if (r.tag === 'Savings') return false;
    return !r.bucket || !r.tag;
  };
  A.allTags = function (dir) {
    var base = dir === 'in' ? S.IN_TAGS : S.OUT_TAGS;
    var seen = {}, out = [];
    base.concat(S.D.settings.customTags || []).forEach(function (t) { if (!seen[U.key(t)]) { seen[U.key(t)] = 1; out.push(t); } });
    return out;
  };
  A.rememberTag = function (t) {
    if (!t) return;
    var all = S.IN_TAGS.concat(S.OUT_TAGS).concat(S.D.settings.customTags || []).map(U.key);
    if (all.indexOf(U.key(t)) < 0) { S.D.settings.customTags.push(t); S.commit('settings'); }
  };

  /* ---------- periods and summaries ---------- */
  A.inPeriod = function (mode, val) {
    return S.D.tx.filter(function (r) { return r.date.indexOf(val) === 0 && (mode !== 'day' || r.date === val); });
  };
  A.periodList = function () {
    var s = A.st;
    if (s.sumMode === 'day') return A.inPeriod('day', s.sumDay);
    if (s.sumMode === 'month') return A.inPeriod('month', s.sumMonth);
    return A.inPeriod('year', s.sumYear);
  };
  A.periodLabel = function () {
    var s = A.st;
    if (s.sumMode === 'day') return U.fmtDayLong(s.sumDay);
    if (s.sumMode === 'month') return U.monthLabel(s.sumMonth);
    return 'Year ' + s.sumYear;
  };

  A.summarize = function (list) {
    var s = { inn: 0, spent: 0, saved: 0, fees: 0, left: 0, inBiz: 0, inPer: 0, inUn: 0, outBiz: 0, outPer: 0, outUn: 0, outFee: 0,
      cats: {}, from: {}, count: list.length, untagged: 0, check: 0 };
    list.forEach(function (r) {
      var fee = r.fee || 0;
      if (r.check) s.check++;
      if (A.needsTag(r)) s.untagged++;
      if (r.dir === 'in') {
        s.inn += r.amount;
        if (r.bucket === 'business') s.inBiz += r.amount; else if (r.bucket === 'personal') s.inPer += r.amount; else s.inUn += r.amount;
        s.from[r.name] = (s.from[r.name] || 0) + r.amount;
      } else if (r.dir === 'out') {
        s.fees += fee;
        if (r.tag === 'Savings') {
          s.saved += r.amount; s.spent += fee;
          if (fee) s.cats['Transaction cost'] = (s.cats['Transaction cost'] || 0) + fee;
          s.cats.Savings = (s.cats.Savings || 0) + r.amount;
          s.outFee += fee;
        } else {
          var tot = r.amount + fee;
          s.spent += tot;
          if (r.bucket === 'business') s.outBiz += tot; else if (r.bucket === 'personal') s.outPer += tot; else s.outUn += tot;
          var c = r.tag || 'Not tagged yet';
          s.cats[c] = (s.cats[c] || 0) + r.amount;
          if (fee) s.cats['Transaction cost'] = (s.cats['Transaction cost'] || 0) + fee;
        }
      } else { // own money moved (withdrawals): only the fee is a cost
        if (fee) { s.fees += fee; s.spent += fee; s.outFee += fee; s.cats['Transaction cost'] = (s.cats['Transaction cost'] || 0) + fee; }
      }
    });
    ['inn', 'spent', 'saved', 'fees', 'inBiz', 'inPer', 'inUn', 'outBiz', 'outPer', 'outUn', 'outFee'].forEach(function (k) { s[k] = U.round2(s[k]); });
    s.left = U.round2(s.inn - s.spent - s.saved);
    Object.keys(s.cats).forEach(function (k) { s.cats[k] = U.round2(s.cats[k]); });
    Object.keys(s.from).forEach(function (k) { s.from[k] = U.round2(s.from[k]); });
    return s;
  };
  A.sorted = function (obj) {
    return Object.keys(obj).map(function (k) { return [k, obj[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
  };

  /* ---------- daily cash: the owner types opening cash and closing cash; Chil works out the cash sales ---------- */
  A.bizPaid = function (date) {
    return U.round2(U.sum(S.D.biz.rows.filter(function (r) { return r.date === date; }), function (r) { return +r.amount || 0; }));
  };
  A.cashUsedList = function (date) { return S.D.cash.used.filter(function (x) { return !date || x.date === date; }); };
  A.cashBankedList = function (date) { return S.D.cash.banked.filter(function (x) { return !date || x.date === date; }); };
  // One entry per day with any activity.
  // Cash sales = closing cash - opening cash + cash used + business costs paid + deposits to M-Pesa - withdrawals + cash banked.
  A.ledger = function () {
    var byDay = {}, dates = {};
    S.D.tx.forEach(function (r) { (byDay[r.date] = byDay[r.date] || []).push(r); dates[r.date] = 1; });
    Object.keys(S.D.cash.days).forEach(function (d) { var c = S.D.cash.days[d]; if (c.in || c.open != null || c.close != null) dates[d] = 1; });
    S.D.cash.used.forEach(function (x) { dates[x.date] = 1; });
    S.D.cash.banked.forEach(function (x) { dates[x.date] = 1; });
    S.D.biz.rows.forEach(function (r) { dates[r.date] = 1; });
    return Object.keys(dates).sort().map(function (d) {
      var txs = byDay[d] || [], sm = A.summarize(txs), c = S.D.cash.days[d] || { in: 0, open: null, close: null };
      var dep = 0, wd = 0, banked = 0;
      txs.forEach(function (r) {
        if (r.kind === 'deposit') dep += r.amount;
        else if (r.kind === 'withdrawal' || r.kind === 'atm') wd += r.amount;
        else if (r.kind === 'cash-to-bank') banked += r.amount;
      });
      A.cashBankedList(d).forEach(function (x) { banked += x.amount; });
      var ub = 0, up = 0;
      A.cashUsedList(d).forEach(function (x) { if (x.bucket === 'business') ub += x.amount; else up += x.amount; });
      var bp = A.bizPaid(d), used = ub + up, derived = c.open != null && c.close != null;
      var raw = derived ? U.round2(c.close - c.open + used + bp + dep - wd + banked) : (c.in || 0);
      return { date: d, open: c.open, close: c.close, derived: derived, mIn: sm.inn, mOut: U.round2(sm.spent + sm.saved),
        cashInRaw: raw, cashIn: Math.max(0, raw), cashUsed: U.round2(used), cashUsedBiz: U.round2(ub), cashUsedPer: U.round2(up), bizPaid: bp,
        deposits: U.round2(dep), withdrawals: U.round2(wd), banked: U.round2(banked), sm: sm };
    });
  };
  A.ledgerFor = function (date) {
    var hit = null;
    A.ledger().forEach(function (e) { if (e.date === date) hit = e; });
    return hit || { date: date, open: null, close: null, derived: false, mIn: 0, mOut: 0, cashInRaw: 0, cashIn: 0, cashUsed: 0, cashUsedBiz: 0, cashUsedPer: 0, bizPaid: 0, deposits: 0, withdrawals: 0, banked: 0, sm: A.summarize([]) };
  };
  // The last closing cash the owner typed on or before a date (null when none was ever typed).
  A.cashAt = function (date) {
    var v = null, d = null;
    Object.keys(S.D.cash.days).sort().forEach(function (k) { var c = S.D.cash.days[k]; if (k <= date && c.close != null) { v = c.close; d = k; } });
    return v == null ? null : { value: v, date: d };
  };
  // Totals for the period shown in Summary.
  A.periodCash = function () {
    var s = A.st, from, to;
    if (s.sumMode === 'day') { from = to = s.sumDay; }
    else if (s.sumMode === 'month') { from = s.sumMonth; to = s.sumMonth + '-31'; }
    else { from = s.sumYear; to = s.sumYear + '-12-31'; }
    var rows = A.ledger().filter(function (e) { return e.date >= from && e.date <= to; });
    if (!rows.length) return null;
    var t = { open: null, close: null, cashIn: 0, cashUsed: 0, bizPaid: 0, deposits: 0, withdrawals: 0, banked: 0 };
    rows.forEach(function (e) {
      if (t.open == null && e.open != null) t.open = e.open;
      if (e.close != null) t.close = e.close;
      ['cashIn', 'cashUsed', 'bizPaid', 'deposits', 'withdrawals', 'banked'].forEach(function (k) { t[k] += e[k]; });
    });
    ['cashIn', 'cashUsed', 'bizPaid', 'deposits', 'withdrawals', 'banked'].forEach(function (k) { t[k] = U.round2(t[k]); });
    return t;
  };

  /* ---------- bank accounts: balance from the latest bank message, plus cash you took to the bank after it ---------- */
  A.bankAccounts = function (date) {
    var acc = {};
    function get(l) { return acc[l] || (acc[l] = { label: l, auto: null, last: '', count: 0, add: [], man: [] }); }
    S.D.tx.forEach(function (r) {
      if (!r.bank || (date && r.date > date)) return;
      var a = get(r.account); a.count++;
      if (r.manual) { a.man.push(r); return; }
      if (r.balance != null && r.ts >= a.last) { a.auto = r.balance; a.last = r.ts; }
    });
    S.D.cash.banked.forEach(function (x) { if (!date || x.date <= date) get(x.account || 'Bank').add.push(x); });
    (S.D.settings.banks || []).forEach(function (b) { get(b.name); });
    var out = Object.keys(acc).sort().map(function (k) {
      var a = acc[k], extra = U.sum(a.add.filter(function (x) { return !a.last || x.date > a.last.slice(0, 10); }), function (x) { return x.amount; });
      a.man.forEach(function (r) { if (!a.last || r.ts > a.last) extra += r.dir === 'in' ? r.amount : r.dir === 'out' ? -r.amount : 0; });
      var typed = !date && S.D.cash.bankBal[k] != null ? S.D.cash.bankBal[k] : null;
      a.balance = typed != null ? typed : U.round2((a.auto || 0) + extra); a.typed = typed != null;
      return a;
    });
    Object.keys(S.D.cash.bankBal).forEach(function (k) { if (!acc[k] && !date) out.push({ label: k, auto: null, last: '', count: 0, add: [], man: [], balance: S.D.cash.bankBal[k], typed: true }); });
    out.total = U.round2(U.sum(out, function (a) { return a.balance; }));
    return out;
  };
  // Own money moved between your accounts is not income or spending. Only the fee counts.
  A.setTransfer = function (r, on) {
    if (on && !r.xfer && (r.dir === 'in' || r.dir === 'out')) {
      r.xfer = true; r.dir0 = r.dir; r.kind0 = r.kind; r.dir = 'own';
      r.kind = r.kind === 'bank-cash-deposit' ? 'cash-to-bank' : 'transfer';
    } else if (!on && r.xfer) {
      r.dir = r.dir0 || r.dir; r.kind = r.kind0 || r.kind; delete r.xfer; delete r.dir0; delete r.kind0;
    }
    S.commit('tx');
  };
  // A bank credit from M-Pesa that matches an M-Pesa payment of the same amount at about the same time is your own money moving.
  A.linkTransfers = function (list) {
    var n = 0, mins = function (r) { return Date.parse(r.date + 'T' + (r.time || '00:00') + ':00Z') / 60000; };
    (list || S.D.tx).forEach(function (b) {
      if (!b.bank || b.xfer || (b.kind !== 'from-mobile' && b.kind !== 'to-mobile')) return;
      var want = b.kind === 'from-mobile' ? 'out' : 'in';
      var m = S.D.tx.filter(function (x) { return !x.bank && !x.xfer && x.dir === want && x.amount === b.amount && x.date === b.date && Math.abs(mins(x) - mins(b)) <= 180; })[0];
      if (m) { A.setTransfer(b, true); A.setTransfer(m, true); n++; }
    });
    return n;
  };

  /* ---------- comparison (days of a month, months of a year, or all years) ---------- */
  A.compare = function (mode) {
    var st = A.st, groups = {}, title, mk = U.monthKey(st.sumDay), yr = st.sumMonth.slice(0, 4);
    A.ledger().forEach(function (e) {
      var k;
      if (mode === 'day') { if (U.monthKey(e.date) !== mk) return; k = e.date; }
      else if (mode === 'month') { if (e.date.slice(0, 4) !== yr) return; k = U.monthKey(e.date); }
      else k = e.date.slice(0, 4);
      (groups[k] = groups[k] || []).push(e);
    });
    title = mode === 'day' ? 'Days of ' + U.monthLabel(mk) : mode === 'month' ? 'Months of ' + yr : 'All years';
    var rows = Object.keys(groups).sort().map(function (k) {
      var es = groups[k], r = { bIn: 0, bOut: 0, pIn: 0, pOut: 0, inn: 0, out: 0, made: 0 };
      es.forEach(function (e) {
        r.bIn += e.sm.inBiz + e.cashIn; r.bOut += e.sm.outBiz + e.bizPaid + e.cashUsedBiz;
        r.pIn += e.sm.inPer; r.pOut += e.sm.outPer + e.cashUsedPer;
        r.inn += e.sm.inn + e.cashIn; r.out += e.sm.spent + e.sm.saved + e.cashUsed + e.bizPaid;
      });
      Object.keys(r).forEach(function (x) { r[x] = U.round2(r[x]); });
      r.made = U.round2(r.inn - r.out);
      r.key = k; r.close = null; es.forEach(function (e) { if (e.close != null) r.close = e.close; });
      r.label = mode === 'day' ? U.fmtDayLong(k) : mode === 'month' ? U.monthLabel(k) : k;
      r.short = mode === 'day' ? U.DAYS[U.parseISO(k).getDay()].slice(0, 3) + ' ' + U.fmtDay(k) : mode === 'month' ? U.MON[+k.slice(5) - 1] + ' ' + k.slice(2, 4) : k;
      return r;
    });
    var t = { bIn: 0, bOut: 0, pIn: 0, pOut: 0, made: 0, inn: 0, out: 0 };
    rows.forEach(function (r) { Object.keys(t).forEach(function (k) { t[k] += r[k]; }); });
    Object.keys(t).forEach(function (k) { t[k] = U.round2(t[k]); });
    t.close = null; rows.forEach(function (r) { if (r.close != null) t.close = r.close; });
    return { title: title, rows: rows, total: t, unit: mode === 'day' ? 'Day' : mode === 'month' ? 'Month' : 'Year' };
  };

  // Gentle backup nudge: only when there is data worth saving, 7+ days since the last backup, and not snoozed.
  A.backupDue = function () {
    var s = S.D.settings, t = U.todayISO();
    if (S.D.tx.length < 5 && !S.D.debts.length) return false;
    if (s.backupSnoozeUntil && s.backupSnoozeUntil > t) return false;
    var ref = s.lastBackup || s.installedAt;
    if (!ref) return false;
    return U.daysBetween(ref, t) >= 7;
  };

  /* ---------- debts ---------- */
  A.debtInfo = function (d) {
    var paid = U.sum(d.payments || [], function (p) { return p.amount; });
    var bal = U.round2(d.amount - paid);
    var out = { paid: paid, bal: bal < 0 ? 0 : bal, key: 'open', label: 'Open' };
    if (bal <= 0) { out.key = 'paid'; out.label = 'Paid'; return out; }
    if (d.due) {
      var n = U.daysBetween(U.todayISO(), d.due);
      if (n < 0) { out.key = 'over'; out.label = 'Overdue ' + (-n) + (n === -1 ? ' day' : ' days'); }
      else if (n === 0) { out.key = 'soon'; out.label = 'Due today'; }
      else if (n <= 3) { out.key = 'soon'; out.label = 'Due in ' + n + (n === 1 ? ' day' : ' days'); }
    }
    return out;
  };
  // Loans made from M-Pesa rows tagged "Business debt": money in = a loan I received (I owe: Debtors),
  // money out = a loan I gave (they owe me: Creditors). Kept in step with the row's tag.
  A.syncLoan = function (r) {
    var want = r && r.tag && U.key(r.tag) === 'business debt' && (r.dir === 'in' || r.dir === 'out');
    var i, cur = null;
    for (i = 0; i < S.D.debts.length; i++) if (S.D.debts[i].src === 'mpesa' && S.D.debts[i].code === r.code) { cur = S.D.debts[i]; break; }
    if (!want) { if (cur && !(cur.payments || []).length) S.D.debts.splice(i, 1); S.commit('debts'); return; }
    var kind = r.dir === 'in' ? 'owe' : 'owed';
    if (cur) { cur.kind = kind; cur.name = r.name || 'Loan'; cur.amount = r.amount; cur.date = r.date; }
    else S.D.debts.push({ id: U.uid(), kind: kind, name: r.name || 'Loan', desc: 'Loan (from M-Pesa)', amount: r.amount, date: r.date, due: '', payments: [], src: 'mpesa', code: r.code });
    S.commit('debts');
  };
  A.debtTotals = function (kind) {
    var t = { open: 0, over: 0, count: 0 };
    S.D.debts.forEach(function (d) {
      if (d.kind !== kind) return;
      var i = A.debtInfo(d);
      if (i.key === 'paid') return;
      t.open += i.bal; t.count++;
      if (i.key === 'over') t.over += i.bal;
    });
    t.open = U.round2(t.open); t.over = U.round2(t.over);
    return t;
  };

  /* ---------- rendering ---------- */
  var NAV = [['money', 'Money', 'money'], ['sum', 'Summary', 'sum'], ['add', 'Add', 'plus'], ['biz', 'Business', 'biz'], ['menu', 'More', 'more']];
  var MORE_TABS = ['menu', 'customers', 'debts', 'bank', 'spend', 'calc', 'search', 'help', 'more'];

  A.shell = function () {
    var s = S.D.settings;
    var nav = NAV.map(function (t) {
      if (t[0] === 'add') return '<button class="add" data-tab="add" aria-label="Add messages"><span>' + A.IC.plus + '</span><em>Add</em></button>';
      var on = t[0] === 'menu' ? MORE_TABS.indexOf(A.st.tab) >= 0 : A.st.tab === t[0];
      return '<button data-tab="' + t[0] + '" class="' + (on ? 'on' : '') + '">' + A.IC[t[2]] + t[1] + '</button>';
    }).join('');
    U.$('#app').innerHTML =
      '<div class="top"><div class="lockup">' + C.Logo.icon(30) + C.Logo.wordmark(20) + '</div><div class="shop">' + U.esc(s.shopName) + '</div>' +
      '<button class="icon-btn" data-tab="search" aria-label="Search">' + A.IC.search + '</button><button class="icon-btn" data-tab="more" aria-label="Settings">' + A.IC.gear + '</button></div>' +
      '<div id="main"></div><nav class="nav">' + nav + '</nav>';
    U.$$('[data-tab]', U.$('#app')).forEach(function (b) {
      b.onclick = function () {
        var t = b.getAttribute('data-tab');
        if (t === 'add') { A.V.add.open(); return; }
        A.go(t);
      };
    });
  };

  /* ---------- Back button: close a pop-up, then go back a step, then Home, then ask before exiting ---------- */
  var nav = A.nav = { depth: 0, ready: false };
  nav.push = function () { try { history.pushState({ chil: 1, d: nav.depth + 1 }, ''); nav.depth++; } catch (e) { /* ignore */ } };
  nav.guard = function () { if (nav.ready && nav.depth === 0) nav.push(); };
  nav.start = function () {
    if (nav.ready) return;
    nav.ready = true;
    try { history.replaceState({ chil: 1, d: 0 }, ''); } catch (e) { /* ignore */ }
    document.addEventListener('pointerdown', nav.guard, true);
    window.addEventListener('popstate', function (e) {
      if (!nav.ready) return;
      nav.depth = e.state && typeof e.state.d === 'number' ? e.state.d : 0;
      if (A.select && A.select.active()) { A.select.clear(); return; }
      if (U.$('#sheet').classList.contains('open')) { A.closeSheet(); return; }
      var scr = U.$('#screen-host .screen');
      if (scr && scr.querySelector('[data-x=back]')) { A.clearScreen(); return; }
      if (!scr && A.st.tab !== 'money') { A.go(A.backTarget(), true); return; }
      if (nav.depth > 0) { history.go(-nav.depth); return; } // clear leftover steps, then ask
      U.toast('Press back again to exit', 2200, 'exit');
    });
  };
  A.MORE_SUB = ['customers', 'debts', 'bank', 'spend', 'calc', 'search', 'help', 'more'];
  A.backTarget = function () { return A.MORE_SUB.indexOf(A.st.tab) >= 0 && A.st.from === 'menu' ? 'menu' : 'money'; };
  A.go = function (tab, silent) {
    var prev = A.st.tab;
    A.st.from = prev === 'menu' ? 'menu' : null;
    A.st.tab = tab;
    try { sessionStorage.setItem('chil.last', tab); } catch (e) { /* ignore */ }
    if (!silent && prev === 'money' && tab !== 'money') { nav.guard(); if (nav.ready) nav.push(); }
    A.shell();
    A.render(true);
  };

  A.render = function (top) {
    var main = U.$('#main');
    if (!main) return;
    var y = top ? 0 : main.scrollTop;
    var v = A.V[A.st.tab];
    if (A.select) A.select.before(A.st.tab);
    main.innerHTML = v.html();
    if (v.mount) v.mount(main);
    main.scrollTop = y;
  };

  // Redraw the current screen without losing scroll or the tab bar.
  A.refresh = function () { A.render(false); };

  window.addEventListener('keydown', function (e) { if (e.key === 'Escape') A.closeSheet(); });
  document.addEventListener('click', function (e) { if (e.target && e.target.getAttribute && e.target.getAttribute('data-close')) A.closeSheet(); });

  A.fileDate = function () { return U.todayISO(); };
  A.shopLabel = function () { return S.D.settings.shopName || 'My shop'; };
})();
