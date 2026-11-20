/* Chil core: shared state, sheets, summaries, rules, debts maths. Views live in v-*.js */
(function () {
  var C = window.Chil, U = C.U, S = C.Store;
  var A = { V: {}, st: {
    tab: 'money', sim: 0, month: 'all',
    sumMode: 'day', sumDay: U.todayISO(), sumMonth: U.monthKey(U.todayISO()), sumYear: String(new Date().getFullYear()),
    debtView: 'owed', bizMonth: 'all', cmpOpen: false
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
    search: ic('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
    gear: ic('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>')
  };

  /* ---------- sheets (bottom pop-ups) ---------- */
  A.sheet = function (html, mount) {
    var b = U.$('#sheet-body');
    b.innerHTML = html;
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
      if (changed) n++;
    });
    return n;
  };
  // Does the record still need the owner's attention?
  A.needsTag = function (r) {
    if (r.dir === 'own') return false;
    if (r.dir === 'in') return !r.bucket;
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
          if (fee) s.cats.Fees = (s.cats.Fees || 0) + fee;
          s.cats.Savings = (s.cats.Savings || 0) + r.amount;
          s.outFee += fee;
        } else {
          var tot = r.amount + fee;
          s.spent += tot;
          if (r.bucket === 'business') s.outBiz += tot; else if (r.bucket === 'personal') s.outPer += tot; else s.outUn += tot;
          var c = r.tag || 'Not tagged yet';
          s.cats[c] = (s.cats[c] || 0) + tot;
        }
      } else { // own money moved (withdrawals): only the fee is a cost
        if (fee) { s.fees += fee; s.spent += fee; s.outFee += fee; s.cats.Fees = (s.cats.Fees || 0) + fee; }
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

  /* ---------- comparison (days of a month, months of a year, or all years) ---------- */
  A.compare = function (mode) {
    var st = A.st, groups = {}, title, mk = U.monthKey(st.sumDay), yr = st.sumMonth.slice(0, 4);
    S.D.tx.forEach(function (r) {
      var k;
      if (mode === 'day') { if (U.monthKey(r.date) !== mk) return; k = r.date; }
      else if (mode === 'month') { if (r.date.slice(0, 4) !== yr) return; k = U.monthKey(r.date); }
      else k = r.date.slice(0, 4);
      (groups[k] = groups[k] || []).push(r);
    });
    title = mode === 'day' ? 'Days of ' + U.monthLabel(mk) : mode === 'month' ? 'Months of ' + yr : 'All years';
    var rows = Object.keys(groups).sort().map(function (k) {
      var sm = A.summarize(groups[k]);
      var label = mode === 'day' ? U.fmtDayLong(k) : mode === 'month' ? U.monthLabel(k) : k;
      var short = mode === 'day' ? U.DAYS[U.parseISO(k).getDay()].slice(0, 3) + ' ' + U.fmtDay(k) : mode === 'month' ? U.MON[+k.slice(5) - 1] + ' ' + k.slice(2, 4) : k;
      return { key: k, label: label, short: short, bIn: sm.inBiz, bOut: sm.outBiz, pIn: sm.inPer, pOut: sm.outPer, made: sm.left, inn: sm.inn, out: U.round2(sm.spent + sm.saved) };
    });
    var t = { bIn: 0, bOut: 0, pIn: 0, pOut: 0, made: 0, inn: 0, out: 0 };
    rows.forEach(function (r) { Object.keys(t).forEach(function (k) { t[k] += r[k]; }); });
    Object.keys(t).forEach(function (k) { t[k] = U.round2(t[k]); });
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
  var TABS = [['money', 'Money', 'money'], ['sum', 'Summary', 'sum'], ['add', 'Add', 'plus'], ['biz', 'Business', 'biz'], ['calc', 'Calc', 'calc'], ['debts', 'Debts', 'debt']];

  A.shell = function () {
    var s = S.D.settings;
    var nav = TABS.map(function (t) {
      if (t[0] === 'add') return '<button class="add" data-tab="add" aria-label="Add messages"><span>' + A.IC.plus + '</span><em>Add</em></button>';
      return '<button data-tab="' + t[0] + '" class="' + (A.st.tab === t[0] ? 'on' : '') + '">' + A.IC[t[2]] + t[1] + '</button>';
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

  A.go = function (tab) {
    A.st.tab = tab;
    A.shell();
    A.render(true);
  };

  A.render = function (top) {
    var main = U.$('#main');
    if (!main) return;
    var y = top ? 0 : main.scrollTop;
    var v = A.V[A.st.tab];
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
