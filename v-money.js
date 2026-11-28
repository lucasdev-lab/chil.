/* Chil: Money table, tagging sheet and message import. */
(function () {
  var C = window.Chil, U = C.U, S = C.Store, A = C.A, P = C.Parser;
  var st = A.st;
  st.onlyUntagged = false;

  function months() {
    var m = {};
    S.D.tx.forEach(function (r) { m[U.monthKey(r.date)] = 1; });
    return Object.keys(m).sort().reverse();
  }
  function visible() {
    return S.D.tx.filter(function (r) {
      if (st.acct) { if (!(r.bank && r.account === st.acct)) return false; }
      else if (st.sim && (r.bank || r.sim !== st.sim)) return false;
      if (st.month !== 'all' && U.monthKey(r.date) !== st.month) return false;
      if (st.onlyUntagged && !A.needsTag(r)) return false;
      return true;
    });
  }
  function simName(n) { return S.D.settings.simNames[n] || 'SIM ' + n; }
  // Every place money arrives: SIM 1, SIM 2, extra SIMs, and bank accounts (the ones you added plus any seen in bank messages).
  A.accounts = function () {
    var s = S.D.settings, out = [], seen = {};
    Object.keys(s.simNames).map(Number).sort(function (a, b) { return a - b; }).forEach(function (n) { out.push({ key: 'sim:' + n, kind: 'sim', n: n, name: simName(n), reason: s.simReasons[n] || '' }); });
    s.banks.forEach(function (b) { seen[b.name] = 1; out.push({ key: 'bank:' + b.name, kind: 'bank', name: b.name, reason: b.reason || '' }); });
    S.D.tx.forEach(function (r) { if (r.bank && !seen[r.account]) { seen[r.account] = 1; out.push({ key: 'bank:' + r.account, kind: 'bank', name: r.account, reason: '' }); } });
    return out;
  };
  A.addAccountSheet = function (done) {
    var kind = 'bank';
    function draw(keep) {
      A.sheet('<h2>Add an account</h2><p class="mute">Add another phone line or a bank account that receives money for your business. You can say what the money is for, for example Offering, Tithe or Shop sales. Money received there will be tagged with it automatically.</p>' +
        '<label class="f">What is it?</label><div class="chips"><button class="chip' + (kind === 'bank' ? ' on' : '') + '" data-k="bank">Bank account</button><button class="chip' + (kind === 'sim' ? ' on' : '') + '" data-k="sim">Phone line (SIM)</button></div>' +
        '<label class="f">Name</label><input class="in" id="ac-name" maxlength="30" placeholder="' + (kind === 'bank' ? 'e.g. KCB shop account' : 'e.g. SIM 3') + '">' +
        '<label class="f">What is the money for? (optional)</label><input class="in" id="ac-reason" maxlength="30" placeholder="e.g. Offering, Tithe, Shop sales">' +
        '<div class="err" id="ac-err"></div><button class="btn green block" id="ac-save">Add account</button>', function (b) {
        if (keep) { U.$('#ac-name', b).value = keep.name; U.$('#ac-reason', b).value = keep.reason; }
        U.$$('[data-k]', b).forEach(function (x) { x.onclick = function () { var k = { name: U.$('#ac-name', b).value, reason: U.$('#ac-reason', b).value }; kind = x.getAttribute('data-k'); draw(k); }; });
        U.$('#ac-save', b).onclick = function () {
          var name = U.$('#ac-name', b).value.trim(), reason = U.$('#ac-reason', b).value.trim(), err = U.$('#ac-err', b), s = S.D.settings;
          if (!name) { err.textContent = 'Type a name for the account.'; return; }
          if (A.accounts().some(function (a) { return a.name.toLowerCase() === name.toLowerCase(); })) { err.textContent = 'You already have an account with that name.'; return; }
          if (reason) A.rememberTag(reason);
          var key;
          if (kind === 'sim') { var n = Math.max.apply(null, Object.keys(s.simNames).map(Number)) + 1; s.simNames[n] = name; if (reason) s.simReasons[n] = reason; key = 'sim:' + n; }
          else { s.banks.push({ name: name, reason: reason }); key = 'bank:' + name; }
          S.commit('settings'); A.closeSheet(); U.toast('Account added'); if (done) done(key); else A.refresh();
        };
      });
    }
    draw();
  };

  function catCell(r) {
    if (r.dir === 'own') return '<span class="pill">Own money</span>';
    var b = r.bucket ? '<span class="pill ' + (r.bucket === 'business' ? 'biz' : 'per') + '">' + U.cap(r.bucket) + '</span> ' : '';
    if (A.needsTag(r)) return b + '<span class="untag">Tap to tag</span>';
    return b + U.esc(r.tag || '');
  }

  /* ---------- daily cash card: opening cash, closing cash, cash sales worked out ---------- */
  function sgn(n) { return (n < 0 ? '−' : '') + U.money(Math.abs(n)); }
  function cashCard() {
    var d = st.cashDay || U.todayISO(), e = A.ledgerFor(d);
    var sales = e.derived ? '<b class="num ' + (e.cashInRaw < 0 ? 'neg' : 'pos') + '">' + sgn(e.cashInRaw) + '</b>' : (e.cashIn ? '<b class="num pos">' + sgn(e.cashIn) + '</b>' : '<b class="num mute">—</b>');
    var moves = [];
    if (e.deposits) moves.push('deposited to M-Pesa ' + U.money(e.deposits));
    if (e.withdrawals) moves.push('withdrawn from M-Pesa ' + U.money(e.withdrawals));
    if (e.banked) moves.push('cash taken to bank ' + U.money(e.banked));
    if (e.bizPaid) moves.push('business costs paid ' + U.money(e.bizPaid));
    return '<div class="card cashcard"><div class="row" style="justify-content:space-between;margin-bottom:8px"><h3 style="margin:0">Cash for the day</h3>' +
      '<input class="in" type="date" id="cc-date" value="' + d + '" style="width:auto;padding:6px 8px;min-height:36px"></div>' +
      '<div class="cc-grid">' +
      '<label><small>Cash when you opened</small><input class="in" id="cc-open" inputmode="decimal" autocomplete="off" value="' + (e.open != null ? U.esc(String(e.open)) : '') + '" placeholder="Type it"></label>' +
      '<label><small>Cash when you closed</small><input class="in" id="cc-close" inputmode="decimal" autocomplete="off" value="' + (e.close != null ? U.esc(String(e.close)) : '') + '" placeholder="Type it"></label>' +
      '<div class="cc-box"><small>Cash sales today</small><span id="cc-sales">' + sales + '</span></div>' +
      '<button class="cc-box cc-btn" id="cc-usedbtn" type="button"><small>Cash used (tap to add)</small><b class="num ' + (e.cashUsed ? 'neg' : 'mute') + '">' + (e.cashUsed ? U.money(e.cashUsed) : 'Add') + '</b></button></div>' +
      '<div class="row" style="margin-top:8px"><button class="btn small ghost grow" id="cc-bankbtn" type="button">Cash taken to bank</button></div>' +
      '<p class="hint" id="cc-hint" style="margin:8px 0 0">' + (moves.length ? U.esc(moves.join(' · ')) + '. ' : '') + 'Cash sales = closing − opening + cash used + deposits to M-Pesa − withdrawals + cash taken to bank. Type your cash when you open and when you close.' +
      (e.derived && e.cashInRaw < 0 ? ' <b>These figures give a negative sale. Check your cash.</b>' : '') + '</p></div>';
  }
  A.cashUsedSheet = function (date, back) {
    var list = A.cashUsedList(date), sel = { bucket: 'business', tag: '', custom: '' };
    function body() {
      var tags = A.allTags('out');
      return '<h2>Cash used on ' + U.esc(U.fmtDayLong(date)) + '</h2>' +
        (list.length ? '<div>' + list.map(function (x) { return '<div class="list-item"><div class="grow"><b>' + U.esc(x.tag || 'Cash used') + '</b><small>' + U.esc(U.cap(x.bucket || 'personal')) + (x.note ? ' · ' + U.esc(x.note) : '') + '</small></div><b class="num neg">' + U.money2(x.amount) + '</b><button class="btn small ghost" data-del="' + x.id + '">Delete</button></div>'; }).join('') + '</div>' : '<p class="hint">No cash used recorded for this day.</p>') +
        '<label class="f">Amount (KSh)</label><input class="in" id="cu-amt" inputmode="decimal" placeholder="0">' +
        '<label class="f">Business or personal?</label><div class="chips"><button class="chip biz' + (sel.bucket === 'business' ? ' on' : '') + '" data-b="business">Business</button><button class="chip per' + (sel.bucket === 'personal' ? ' on' : '') + '" data-b="personal">Personal</button></div>' +
        '<label class="f">Category</label><div class="chips">' + tags.map(function (t) { return '<button class="chip' + (!sel.custom && sel.tag === t ? ' on' : '') + '" data-t="' + U.esc(t) + '">' + U.esc(t) + '</button>'; }).join('') + '</div>' +
        '<input class="in" id="cu-custom" style="margin-top:10px" maxlength="30" placeholder="Or type your own tag" value="' + U.esc(sel.custom) + '"><input class="in" id="cu-note" style="margin-top:8px" maxlength="60" placeholder="Note (optional)">' +
        '<div class="err" id="cu-err"></div><div class="row"><button class="btn green grow" id="cu-save">Add</button><button class="btn ghost grow" id="cu-done">Done</button></div>';
    }
    function draw(keep) {
      A.sheet(body(), function (b) {
        if (keep) { U.$('#cu-amt', b).value = keep.amt; U.$('#cu-note', b).value = keep.note; }
        function snap() { return { amt: U.$('#cu-amt', b).value, note: U.$('#cu-note', b).value }; }
        U.$$('[data-b]', b).forEach(function (x) { x.onclick = function () { sel.custom = U.$('#cu-custom', b).value; var k = snap(); sel.bucket = x.getAttribute('data-b'); draw(k); }; });
        U.$$('[data-t]', b).forEach(function (x) { x.onclick = function () { var k = snap(); sel.custom = ''; sel.tag = x.getAttribute('data-t'); draw(k); }; });
        U.$$('[data-del]', b).forEach(function (x) { x.onclick = function () { var id = x.getAttribute('data-del'); S.D.cash.used = S.D.cash.used.filter(function (y) { return y.id !== id; }); S.commit('cash'); list = A.cashUsedList(date); draw(snap()); A.refresh(); }; });
        U.$('#cu-done', b).onclick = function () { A.closeSheet(); A.refresh(); };
        U.$('#cu-save', b).onclick = function () {
          var v = C.Calc.evalExpr(U.$('#cu-amt', b).value.trim()), err = U.$('#cu-err', b), custom = U.$('#cu-custom', b).value.trim(), tag = custom || sel.tag;
          if (v == null || v <= 0) { err.textContent = 'Enter the amount, for example 300.'; return; }
          if (!tag) { err.textContent = 'Choose a category or type your own.'; return; }
          if (custom) A.rememberTag(custom);
          S.D.cash.used.push({ id: U.uid(), date: date, amount: U.round2(v), tag: tag, bucket: sel.bucket, note: U.$('#cu-note', b).value.trim() });
          S.commit('cash'); list = A.cashUsedList(date); sel.tag = ''; sel.custom = ''; draw(); A.refresh(); U.toast('Added');
        };
      });
    }
    draw();
  };
  function bindCash(root) {
    var dEl = U.$('#cc-date', root); if (!dEl) return;
    dEl.onchange = function () { if (dEl.value) { st.cashDay = dEl.value; A.refresh(); } };
    function rec() { var d = st.cashDay || U.todayISO(); return S.D.cash.days[d] || (S.D.cash.days[d] = { in: 0, open: null, close: null }); }
    [['#cc-open', 'open'], ['#cc-close', 'close']].forEach(function (x) {
      var el = U.$(x[0], root);
      el.onchange = function () {
        var t = el.value.trim(), r = rec();
        if (t === '') { r[x[1]] = null; }
        else {
          var v = C.Calc.evalExpr(t);
          if (v == null || v < 0) { U.toast('Enter an amount, for example 5000'); var old = (S.D.cash.days[st.cashDay || U.todayISO()] || {})[x[1]]; el.value = old != null ? old : ''; return; }
          r[x[1]] = U.round2(v);
        }
        S.commit('cash'); A.refresh();
      };
    });
    U.$('#cc-usedbtn', root).onclick = function () { A.cashUsedSheet(st.cashDay || U.todayISO()); };
    U.$('#cc-bankbtn', root).onclick = function () { A.cashBankSheet(st.cashDay || U.todayISO()); };
  }

  var M = {
    html: function () {
      var s = S.D.settings, all = S.D.tx;
      if (!all.length) {
        return (A.subBanner ? A.subBanner() : '') + cashCard() + '<div class="empty"><b>No money records yet</b>Copy your M-Pesa messages, tap the orange <b style="display:inline;color:var(--o-d)">+ Add</b> button and paste them in.<div class="gap"></div><button class="btn" data-act="add">Add messages</button></div>';
      }
      var list = visible(), sm = A.summarize(list);
      var ms = months();
      if (st.month !== 'all' && ms.indexOf(st.month) < 0) st.month = 'all';
      var h = '';
      var now = U.nowHHMM(), dow = new Date().getDay();
      if (s.closeAt && now >= s.closeAt && s.closedDate !== U.todayISO() && s.days.indexOf(dow) >= 0) {
        h += '<div class="banner red">It is closing time. <button data-act="close">Close shop</button></div>';
      }
      if (A.backupDue()) {
        var lb = s.lastBackup ? U.daysBetween(s.lastBackup, U.todayISO()) + ' days ago' : 'never';
        h += '<div class="banner green">Save a backup of your records (last: ' + lb + '). <button data-act="backup">Save now</button><button data-act="snooze" aria-label="Remind me later" style="text-decoration:none;font-size:18px;padding:0 4px">✕</button></div>';
      }
      h += A.subBanner ? A.subBanner() : '';
      h += cashCard();
      var un = S.D.tx.filter(A.needsTag).length;
      if (un) h += '<div class="banner">' + un + (un === 1 ? ' record needs' : ' records need') + ' a category. <button data-act="untag">' + (st.onlyUntagged ? 'Show all' : 'Show them') + '</button></div>';
      h += '<div class="row" style="margin-bottom:10px"><select class="sel grow" id="m-month"><option value="all">All time</option>' +
        ms.map(function (k) { return '<option value="' + k + '"' + (k === st.month ? ' selected' : '') + '>' + U.monthLabel(k) + '</option>'; }).join('') + '</select></div>';
      var cur = st.acct ? 'bank:' + st.acct : st.sim ? 'sim:' + st.sim : '';
      h += '<div class="chips" style="margin-bottom:12px"><button class="chip' + (!cur ? ' on' : '') + '" data-acc="">All</button>' +
        A.accounts().map(function (x) { return '<button class="chip' + (cur === x.key ? ' on' : '') + '" data-acc="' + U.esc(x.key) + '">' + U.esc(x.name) + '</button>'; }).join('') +
        '<button class="chip" id="acc-plus" aria-label="Add an account" style="font-weight:800">+</button></div>' +
        (st.acct ? '<div class="row" style="margin-bottom:10px"><button class="btn grow" id="acc-recv">+ Money received in ' + U.esc(st.acct) + '</button></div>' : '');
      h += '<div class="tot"><div><small>Money in</small><b class="pos num">' + U.money(sm.inn) + '</b></div><div><small>Money out</small><b class="neg num">' + U.money(sm.spent + sm.saved) + '</b></div>' +
        '<div><small>Left</small><b class="num ' + (sm.left < 0 ? 'neg' : 'pos') + '">' + U.money(sm.left) + '</b></div></div>';
      if (!list.length) return h + '<div class="empty"><b>Nothing here</b>No records match this view.</div>';

      var days = {};
      list.forEach(function (r) { (days[r.date] = days[r.date] || []).push(r); });
      var keys = Object.keys(days).sort().reverse();
      h += '<div class="tw"><table class="t"><thead><tr><th>Date</th><th class="name">Name</th><th class="r">In</th><th class="r">Out</th><th>Category</th><th>Account</th><th>Code</th></tr></thead><tbody>';
      keys.forEach(function (d) {
        var dt = A.summarize(days[d]);
        h += '<tr class="day"><td colspan="2" class="name">' + U.esc(U.fmtDayLong(d)) + '</td><td colspan="5">In ' + U.money(dt.inn) + ' &nbsp;·&nbsp; Out ' + U.money(dt.spent + dt.saved) + (A.ledgerFor(d).close != null ? ' &nbsp;·&nbsp; Cash closing ' + sgn(A.ledgerFor(d).close) : '') + '</td></tr>';
        days[d].slice().sort(function (a, b) { return a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0; }).forEach(function (r) {
          var amt = r.dir === 'in' ? '<td class="cin num">' + U.money2(r.amount) + '</td><td class="cout"></td>'
            : r.dir === 'out' ? '<td class="cin"></td><td class="cout num">' + U.money2(r.amount + (r.fee || 0)) + '</td>'
            : '<td class="cin"></td><td class="cout num mute" style="font-weight:600">' + (r.fee ? U.money2(r.fee) : '') + '</td>';
          h += '<tr class="tx" data-code="' + r.code + '"><td>' + U.fmtDay(r.date) + '<br><small class="mute">' + U.time12(r.time) + '</small></td>' +
            '<td class="name">' + U.esc(r.name) + (r.check ? ' <span class="pill warn">check</span>' : '') + '</td>' + amt +
            '<td>' + catCell(r) + '</td><td>' + U.esc(r.account) + (!r.bank && S.D.tx.some(function (x) { return x.sim >= 2; }) ? ' <small class="mute">' + U.esc(simName(r.sim)) + '</small>' : '') + '</td>' +
            '<td class="code">' + r.code + '</td></tr>';
        });
      });
      h += '</tbody></table></div>';
      h += '<p class="hint center">Tap any row to tag it. Fees are included in Out.</p>';
      return h;
    },
    mount: function (root) {
      A.select.set({
        row: 'tr.tx[data-code]', id: function (el) { return el.getAttribute('data-code'); },
        header: 'Date\tTime\tName\tType\tAmount\tCategory\tAccount\tCode',
        text: function (el) {
          var r = S.D.tx.filter(function (x) { return x.code === el.getAttribute('data-code'); })[0]; if (!r) return '';
          return [U.fmtDayYear(r.date), U.time12(r.time), r.name || '', r.dir === 'in' ? 'Money in' : 'Money out', U.money2(r.amount), [r.bucket ? U.cap(r.bucket) : '', r.tag || ''].filter(Boolean).join(' / '), r.account || '', r.code].join('\t');
        }
      });
      var m = U.$('#m-month', root);
      if (m) m.onchange = function () { st.month = m.value; A.refresh(); };
      U.$$('[data-acc]', root).forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-acc'); st.sim = 0; st.acct = ''; if (k.indexOf('sim:') === 0) st.sim = +k.slice(4); else if (k.indexOf('bank:') === 0) st.acct = k.slice(5); A.refresh(); }; });
      var rc = U.$('#acc-recv', root); if (rc) rc.onclick = function () { A.bankEntrySheet(st.acct); };
      var pl = U.$('#acc-plus', root); if (pl) pl.onclick = function () { A.addAccountSheet(function (k) { st.sim = 0; st.acct = ''; if (k.indexOf('sim:') === 0) st.sim = +k.slice(4); else st.acct = k.slice(5); A.refresh(); }); };
      U.$$('[data-act]', root).forEach(function (b) {
        b.onclick = function () {
          var a = b.getAttribute('data-act');
          if (a === 'add') A.V.add.open();
          if (a === 'untag') { st.onlyUntagged = !st.onlyUntagged; A.refresh(); }
          if (a === 'close') A.V.more.closeShop();
          if (a === 'renew') A.codeSheet();
          if (a === 'backup') A.doBackup(function () { A.refresh(); });
          if (a === 'snooze') { S.D.settings.backupSnoozeUntil = U.addDays(U.todayISO(), 7); S.commit('settings'); A.refresh(); }
        };
      });
      bindCash(root);
      U.$$('tr.tx', root).forEach(function (tr) { tr.onclick = function () { A.tagSheet(tr.getAttribute('data-code')); }; });
    }
  };
  A.V.money = M;

  /* ---------- tag sheet ---------- */
  A.tagSheet = function (code) {
    var r = S.D.tx.filter(function (x) { return x.code === code; })[0];
    if (!r) return;
    var head = '<h2>' + U.esc(r.name) + '</h2><p class="mute">' + U.fmtDayLong(r.date) + ', ' + U.time12(r.time) + ' · ' + U.esc(r.account) + (r.bank ? '' : ' · ' + U.esc(simName(r.sim))) + '</p>' +
      '<p style="margin:8px 0"><b class="num ' + (r.dir === 'in' ? 'pos' : r.dir === 'out' ? 'neg' : '') + '" style="font-size:24px">' + (r.dir === 'in' ? '+' : r.dir === 'out' ? '−' : '') + 'KSh ' + U.money2(r.amount) + '</b>' +
      (r.fee ? ' <span class="mute">fee ' + U.money2(r.fee) + '</span>' : '') + '</p>' +
      '<p class="hint" style="margin:0 0 4px">' + (r.bank ? 'Bank message ID ' : 'M-Pesa code ') + r.code + '</p>';
    if (r.check) head += '<div class="banner" style="margin-top:8px">This message type was not tested before. Please compare the amounts with your phone.</div>';
    if (r.dir === 'own') {
      var why = r.kind === 'deposit' ? 'You gave cash to an agent and it became M-Pesa. Cash in hand goes down, M-Pesa goes up.' : r.kind === 'withdrawal' || r.kind === 'atm' ? 'Money left your account as cash. Cash in hand goes up.' : r.kind === 'cash-to-bank' ? 'Cash from your hand went into the bank.' : 'This is your own money moving between your accounts.';
      A.sheet(head + '<div class="banner green">' + why + ' It is not counted as income or spending' + (r.fee ? ', only the fee is.' : '.') + '</div>' +
        (r.xfer ? '<button class="btn ghost block" id="tg-notown" style="margin-top:8px">This was not my own money (count it)</button>' : '') + '<button class="btn ghost block" data-close="1" style="margin-top:8px">Close</button>', function (b) {
        var n = U.$('#tg-notown', b); if (n) n.onclick = function () { A.setTransfer(r, false); A.closeSheet(); A.refresh(); U.toast('Counted again'); };
      });
      return;
    }
    var sel = { bucket: r.bucket, tag: r.tag, custom: '' };
    var tags = A.allTags(r.dir);
    function body() {
      var h = head + '<label class="f">' + (r.dir === 'in' ? 'Is this money for business or personal?' : 'Was this spent on business or personal?') + '</label>' +
        '<div class="chips"><button class="chip biz' + (sel.bucket === 'business' ? ' on' : '') + '" data-b="business">Business</button><button class="chip per' + (sel.bucket === 'personal' ? ' on' : '') + '" data-b="personal">Personal</button></div>' +
        '<label class="f">' + (r.dir === 'in' ? 'What was it for? (optional)' : 'Category') + '</label><div class="chips">' +
        tags.map(function (t) { return '<button class="chip' + (!sel.custom && sel.tag === t ? ' on' : '') + '" data-t="' + U.esc(t) + '">' + U.esc(t) + '</button>'; }).join('') + '</div>' +
        '<input class="in" id="tg-custom" style="margin-top:10px" maxlength="30" placeholder="Or type your own tag" value="' + U.esc(sel.custom) + '">' +
        '<label class="check-row"><input type="checkbox" id="tg-rule"> Always tag ' + U.esc(r.name) + ' the same way</label>' +
        '<label class="check-row"><input type="checkbox" id="tg-own"> This is my own money moving between my accounts' + (r.kind === 'bank-cash-deposit' ? ' (my cash taken to the bank)' : '') + ', not ' + (r.dir === 'in' ? 'a sale' : 'spending') + '</label>' +
        '<div class="err" id="tg-err"></div><button class="btn green block" id="tg-save">Save</button>' + (r.manual ? '<button class="btn ghost block" id="tg-del" style="margin-top:8px">Delete this entry</button>' : '');
      return h;
    }
    function draw() {
      A.sheet(body(), function (b) {
        U.$$('[data-b]', b).forEach(function (x) { x.onclick = function () { sel.custom = U.$('#tg-custom', b).value; sel.bucket = x.getAttribute('data-b'); draw(); keep(b); }; });
        U.$$('[data-t]', b).forEach(function (x) { x.onclick = function () { sel.custom = ''; sel.tag = x.getAttribute('data-t'); draw(); keep(b); }; });
        U.$('#tg-custom', b).oninput = function () { sel.custom = this.value; };
        U.$('#tg-save', b).onclick = function () { save(b); };
        var dl = U.$('#tg-del', b); if (dl) dl.onclick = function () { S.D.tx = S.D.tx.filter(function (x) { return x.code !== r.code; }); S.commit('tx'); A.closeSheet(); A.refresh(); U.toast('Deleted'); };
      });
    }
    var ruleOn = false;
    function keep() { var c = U.$('#tg-rule'); if (c) c.checked = ruleOn; }
    function save(b) {
      var custom = U.$('#tg-custom', b).value.trim();
      var tag = custom || sel.tag || null;
      ruleOn = U.$('#tg-rule', b).checked;
      var err = U.$('#tg-err', b);
      if (U.$('#tg-own', b).checked) { A.setTransfer(r, true); A.closeSheet(); U.toast('Saved as your own money'); A.refresh(); return; }
      var isSav = tag && U.key(tag) === 'savings';
      if (r.dir === 'in' && !sel.bucket) { err.textContent = 'Please choose Business or Personal.'; return; }
      if (r.dir === 'out' && !isSav && !sel.bucket) { err.textContent = 'Please choose Business or Personal.'; return; }
      if (!tag) { err.textContent = 'Please choose a category or type your own.'; return; }
      if (custom) { var found = A.allTags(r.dir).filter(function (t) { return U.key(t) === U.key(custom); })[0]; tag = found || custom; if (!found) A.rememberTag(custom); }
      r.bucket = sel.bucket || r.bucket || null; r.tag = tag; delete r.auto;
      A.syncLoan(r);
      if (ruleOn) {
        S.D.rules[A.ruleKey(r)] = { bucket: r.bucket, tag: r.tag };
        S.D.tx.forEach(function (x) { if (x !== r && x.dir === r.dir && U.key(x.name) === U.key(r.name) && (x.auto || A.needsTag(x))) { if (x.auto || !x.bucket) { x.bucket = r.bucket; delete x.auto; } if (!x.tag) { x.tag = r.tag; A.syncLoan(x); } } });
      }
      S.commit('tx', 'rules', 'settings');
      A.closeSheet(); U.toast('Saved'); A.refresh();
    }
    draw();
    keep();
  };

  /* ---------- add (paste) ---------- */
  A.V.add = {
    reopen: function (text, key) { st.acct = key.indexOf('bank:') === 0 ? key.slice(5) : ''; st.sim = key.indexOf('sim:') === 0 ? +key.slice(4) : 0; A.V.add.open(text); },
    open: function (text0) {
      var res = null, acct = st.acct ? 'bank:' + st.acct : 'sim:' + (st.sim || 1);
      function accObj() { return A.accounts().filter(function (x) { return x.key === acct; })[0] || A.accounts()[0]; }
      function accReason() { var a = accObj(); return a ? a.reason : ''; }
      function draw(text) {
        var h = '<h2>Add M-Pesa and bank messages</h2><p class="mute">Copy the messages from your SMS app, then paste them here. Pasting the same message twice is safe.</p>' +
          '<label class="f">Which account received these messages?</label><div class="chips">' + A.accounts().map(function (x) { return '<button class="chip' + (acct === x.key ? ' on' : '') + '" data-s="' + U.esc(x.key) + '">' + U.esc(x.name) + '</button>'; }).join('') + '<button class="chip" id="ad-plus" style="font-weight:800" aria-label="Add an account">+</button></div>' +
          '<p class="hint" style="margin:6px 0 8px">Pick the SIM or the bank account. Bank messages are also recognised by themselves.' + (accReason() ? ' Money received here is tagged "' + U.esc(accReason()) + '".' : '') + '</p>' +
          '<label class="f">Paste messages</label><textarea class="in" id="ad-text" placeholder="Paste here...">' + U.esc(text || '') + '</textarea><div class="err" id="ad-err"></div>';
        if (res) {
          var ms = P.mergeNew(S.D.tx, res.records);
          res.merge = ms;
          var t = P.totals(ms.added);
          h += '<div class="card" style="margin-top:8px"><h3>What we found</h3>' +
            '<div class="list-item"><span>New records</span><b>' + ms.added.length + '</b></div>' +
            '<div class="list-item"><span>Already added before</span><b>' + ms.duplicates + '</b></div>' +
            '<div class="list-item"><span>Skipped (failed, cancelled, activation)</span><b>' + res.skipped.length + '</b></div>' +
            '<div class="list-item"><span>Money in</span><b class="pos num">' + U.money2(t.inn) + '</b></div>' +
            '<div class="list-item"><span>Money out (with fees)</span><b class="neg num">' + U.money2(t.out) + '</b></div>';
          if (res.unrecognised.length) {
            h += '<div class="banner" style="margin-top:10px">' + res.unrecognised.length + ' message' + (res.unrecognised.length > 1 ? 's were' : ' was') + ' not recognised and not saved. You can send them to the seller so the app can learn them.</div>' +
              '<pre class="report">' + U.esc(res.unrecognised.join('\n\n')) + '</pre>';
          }
          if (ms.added.some(function (r) { return r.check; })) h += '<div class="banner" style="margin-top:10px">Some records carry a "check" flag. Please compare them with your phone.</div>';
          h += '</div>';
          h += '<button class="btn green block" id="ad-save"' + (ms.added.length ? '' : ' disabled') + '>' + (ms.added.length ? 'Save ' + ms.added.length + ' record' + (ms.added.length > 1 ? 's' : '') : 'Nothing new to save') + '</button>';
        } else {
          h += '<button class="btn block" id="ad-read">Read messages</button>';
        }
        A.sheet(h, function (b) {
          U.$$('[data-s]', b).forEach(function (x) { x.onclick = function () { var t = U.$('#ad-text', b).value; acct = x.getAttribute('data-s'); res = null; draw(t); }; });
          var plus = U.$('#ad-plus', b); if (plus) plus.onclick = function () { var t = U.$('#ad-text', b).value; A.addAccountSheet(function (k) { acct = k; res = null; A.V.add.reopen(t, k); }); };
          var ta = U.$('#ad-text', b);
          ta.oninput = function () { if (res) { res = null; var rd = U.$('#ad-save', b); draw(ta.value); } };
          var rd = U.$('#ad-read', b);
          if (rd) rd.onclick = function () {
            var t = ta.value;
            if (!t.trim()) { U.$('#ad-err', b).textContent = 'Paste your M-Pesa messages first.'; return; }
            var ao = accObj(); res = P.parseMessages(t, ao.kind === 'sim' ? ao.n : 1);
            res.records.forEach(function (r) {
              if (r.bank && ao.kind === 'bank') r.account = ao.name;
              if (ao.reason && r.dir === 'in' && !r.tag) { r.tag = ao.reason; delete r.auto; }
            });
            if (!res.records.length && !res.skipped.length && !res.unrecognised.length) { res = null; U.$('#ad-err', b).textContent = 'No messages found in that text.'; return; }
            draw(t);
          };
          var sv = U.$('#ad-save', b);
          if (sv) sv.onclick = function () {
            var ms = res.merge;
            var n = A.applyRules(ms.added);
            S.D.tx = ms.all;
            S.D.settings.lastImportAt = U.todayISO();
            S.commit('tx', 'settings');
            var lk = A.linkTransfers(ms.added); if (lk) U.toast(lk + ' bank transfer' + (lk > 1 ? 's' : '') + ' matched to M-Pesa', 3000);
            A.closeSheet();
            if (A.fairUse) A.fairUse(ms.added.length);
            U.toast(ms.added.length + ' added' + (n ? ', ' + n + ' tagged by your rules' : ''), 3400);
            st.tab = 'money'; st.onlyUntagged = false; A.go('money');
          };
        });
      }
      draw('');
    }
  };
})();
