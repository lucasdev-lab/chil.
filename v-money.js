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
      if (st.sim && r.sim !== st.sim) return false;
      if (st.month !== 'all' && U.monthKey(r.date) !== st.month) return false;
      if (st.onlyUntagged && !A.needsTag(r)) return false;
      return true;
    });
  }
  function simName(n) { return S.D.settings.simNames[n] || 'SIM ' + n; }

  function catCell(r) {
    if (r.dir === 'own') return '<span class="pill">Own money</span>';
    var b = r.bucket ? '<span class="pill ' + (r.bucket === 'business' ? 'biz' : 'per') + '">' + U.cap(r.bucket) + '</span> ' : '';
    if (A.needsTag(r)) return b + '<span class="untag">Tap to tag</span>';
    return b + U.esc(r.tag || '');
  }

  /* ---------- daily cash card: brought forward, cash in, cash used, closing ---------- */
  function sgn(n) { return (n < 0 ? '−' : '') + U.money(Math.abs(n)); }
  function cashCard() {
    var d = st.cashDay || U.todayISO(), e = A.ledgerFor(d);
    var first = !A.ledger().length || A.ledger()[0].date >= d;
    return '<div class="card cashcard"><div class="row" style="justify-content:space-between;margin-bottom:8px"><h3 style="margin:0">Cash for the day</h3>' +
      '<input class="in" type="date" id="cc-date" value="' + d + '" style="width:auto;padding:6px 8px;min-height:36px"></div>' +
      '<div class="cc-grid">' +
      '<label><small>Brought forward' + (e.typed ? ' (typed)' : ' from yesterday') + '</small><input class="in" id="cc-open" inputmode="decimal" autocomplete="off" value="' + (e.open ? U.esc(String(e.open)) : '') + '" placeholder="0"></label>' +
      '<label><small>Cash in (cash sales)</small><input class="in" id="cc-in" inputmode="decimal" autocomplete="off" value="' + (e.cashIn ? U.esc(String(e.cashIn)) : '') + '" placeholder="0"></label>' +
      '<label><small>Cash used</small><input class="in" id="cc-used" inputmode="decimal" autocomplete="off" value="' + (e.cashUsed ? U.esc(String(e.cashUsed)) : '') + '" placeholder="0"></label>' +
      '<div class="cc-box"><small>Closing (left for tomorrow)</small><b class="num" id="cc-close">' + sgn(e.close) + '</b></div></div>' +
      '<p class="hint" id="cc-hint" style="margin:8px 0 0">M-Pesa in ' + U.money(e.mIn) + ', M-Pesa out ' + U.money(e.mOut) + (e.bizPaid ? ', business costs paid in cash ' + U.money(e.bizPaid) + ' (from the Business tab)' : '') + '. Closing = brought forward + M-Pesa in + cash in − M-Pesa out − cash used' + (e.bizPaid ? ' − business costs' : '') + '.' +
      (first ? ' <b>First day:</b> type all the money you started with (cash and M-Pesa) in Brought forward.' : '') + '</p></div>';
  }
  function bindCash(root) {
    var dEl = U.$('#cc-date', root); if (!dEl) return;
    dEl.onchange = function () { if (dEl.value) { st.cashDay = dEl.value; A.refresh(); } };
    function parse(el) { var t = el.value.trim(); if (t === '') return 0; var v = C.Calc.evalExpr(t); return v == null || v < 0 ? null : U.round2(v); }
    function rec() { var d = st.cashDay || U.todayISO(); return S.D.cash.days[d] || (S.D.cash.days[d] = { in: 0, used: 0, open: null }); }
    function after() {
      var e = A.ledgerFor(st.cashDay || U.todayISO());
      U.$('#cc-close', root).textContent = sgn(e.close);
    }
    [['#cc-in', 'in'], ['#cc-used', 'used']].forEach(function (x) {
      var el = U.$(x[0], root);
      el.onchange = function () {
        var v = parse(el); if (v == null) { U.toast('Enter an amount, for example 500'); var old = (S.D.cash.days[st.cashDay || U.todayISO()] || {})[x[1]]; el.value = old ? old : ''; return; }
        rec()[x[1]] = v; S.commit('cash'); el.value = v ? v : ''; after();
      };
    });
    var op = U.$('#cc-open', root);
    op.onchange = function () {
      var t = op.value.trim(), d = st.cashDay || U.todayISO(), r = rec();
      if (t === '') { r.open = null; }
      else { var v = C.Calc.evalExpr(t); if (v == null) { U.toast('Enter an amount'); return; } v = U.round2(v); var auto = A.ledgerFor(d).auto; r.open = v === auto ? null : v; }
      S.commit('cash'); A.refresh();
    };
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
      h += '<div class="chips" style="margin-bottom:12px"><button class="chip' + (!st.sim ? ' on' : '') + '" data-sim="0">Both SIMs</button>' +
        '<button class="chip' + (st.sim === 1 ? ' on' : '') + '" data-sim="1">' + U.esc(simName(1)) + '</button>' +
        '<button class="chip' + (st.sim === 2 ? ' on' : '') + '" data-sim="2">' + U.esc(simName(2)) + '</button></div>';
      h += '<div class="tot"><div><small>Money in</small><b class="pos num">' + U.money(sm.inn) + '</b></div><div><small>Money out</small><b class="neg num">' + U.money(sm.spent + sm.saved) + '</b></div>' +
        '<div><small>Left</small><b class="num ' + (sm.left < 0 ? 'neg' : 'pos') + '">' + U.money(sm.left) + '</b></div></div>';
      if (!list.length) return h + '<div class="empty"><b>Nothing here</b>No records match this view.</div>';

      var days = {};
      list.forEach(function (r) { (days[r.date] = days[r.date] || []).push(r); });
      var keys = Object.keys(days).sort().reverse();
      h += '<div class="tw"><table class="t"><thead><tr><th>Date</th><th class="name">Name</th><th class="r">In</th><th class="r">Out</th><th>Category</th><th>Account</th><th>Code</th></tr></thead><tbody>';
      keys.forEach(function (d) {
        var dt = A.summarize(days[d]);
        h += '<tr class="day"><td colspan="2" class="name">' + U.esc(U.fmtDayLong(d)) + '</td><td colspan="5">In ' + U.money(dt.inn) + ' &nbsp;·&nbsp; Out ' + U.money(dt.spent + dt.saved) + ' &nbsp;·&nbsp; Closing ' + sgn(A.ledgerFor(d).close) + '</td></tr>';
        days[d].slice().sort(function (a, b) { return a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0; }).forEach(function (r) {
          var amt = r.dir === 'in' ? '<td class="cin num">' + U.money2(r.amount) + '</td><td class="cout"></td>'
            : r.dir === 'out' ? '<td class="cin"></td><td class="cout num">' + U.money2(r.amount + (r.fee || 0)) + '</td>'
            : '<td class="cin"></td><td class="cout num mute" style="font-weight:600">' + (r.fee ? U.money2(r.fee) : '') + '</td>';
          h += '<tr class="tx" data-code="' + r.code + '"><td>' + U.fmtDay(r.date) + '<br><small class="mute">' + U.time12(r.time) + '</small></td>' +
            '<td class="name">' + U.esc(r.name) + (r.check ? ' <span class="pill warn">check</span>' : '') + '</td>' + amt +
            '<td>' + catCell(r) + '</td><td>' + U.esc(r.account) + (S.D.tx.some(function (x) { return x.sim === 2; }) ? ' <small class="mute">' + U.esc(simName(r.sim)) + '</small>' : '') + '</td>' +
            '<td class="code">' + r.code + '</td></tr>';
        });
      });
      h += '</tbody></table></div>';
      h += '<p class="hint center">Tap any row to tag it. Fees are included in Out.</p>';
      return h;
    },
    mount: function (root) {
      var m = U.$('#m-month', root);
      if (m) m.onchange = function () { st.month = m.value; A.refresh(); };
      U.$$('[data-sim]', root).forEach(function (b) { b.onclick = function () { st.sim = +b.getAttribute('data-sim'); A.refresh(); }; });
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
    var head = '<h2>' + U.esc(r.name) + '</h2><p class="mute">' + U.fmtDayLong(r.date) + ', ' + U.time12(r.time) + ' · ' + U.esc(r.account) + ' · ' + U.esc(simName(r.sim)) + '</p>' +
      '<p style="margin:8px 0"><b class="num ' + (r.dir === 'in' ? 'pos' : r.dir === 'out' ? 'neg' : '') + '" style="font-size:24px">' + (r.dir === 'in' ? '+' : r.dir === 'out' ? '−' : '') + 'KSh ' + U.money2(r.amount) + '</b>' +
      (r.fee ? ' <span class="mute">fee ' + U.money2(r.fee) + '</span>' : '') + '</p>' +
      '<p class="hint" style="margin:0 0 4px">M-Pesa code ' + r.code + '</p>';
    if (r.check) head += '<div class="banner" style="margin-top:8px">This message type was not tested before. Please compare the amounts with your phone.</div>';
    if (r.dir === 'own') {
      A.sheet(head + '<div class="banner green">This is your own money moving between your accounts or out as cash. It is not counted as spending' + (r.fee ? ', only the fee is.' : '.') + '</div><button class="btn ghost block" data-close="1">Close</button>');
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
        '<div class="err" id="tg-err"></div><button class="btn green block" id="tg-save">Save</button>';
      return h;
    }
    function draw() {
      A.sheet(body(), function (b) {
        U.$$('[data-b]', b).forEach(function (x) { x.onclick = function () { sel.custom = U.$('#tg-custom', b).value; sel.bucket = x.getAttribute('data-b'); draw(); keep(b); }; });
        U.$$('[data-t]', b).forEach(function (x) { x.onclick = function () { sel.custom = ''; sel.tag = x.getAttribute('data-t'); draw(); keep(b); }; });
        U.$('#tg-custom', b).oninput = function () { sel.custom = this.value; };
        U.$('#tg-save', b).onclick = function () { save(b); };
      });
    }
    var ruleOn = false;
    function keep() { var c = U.$('#tg-rule'); if (c) c.checked = ruleOn; }
    function save(b) {
      var custom = U.$('#tg-custom', b).value.trim();
      var tag = custom || sel.tag || null;
      ruleOn = U.$('#tg-rule', b).checked;
      var err = U.$('#tg-err', b);
      var isSav = tag && U.key(tag) === 'savings';
      if (r.dir === 'in' && !sel.bucket) { err.textContent = 'Please choose Business or Personal.'; return; }
      if (r.dir === 'out' && !isSav && !sel.bucket) { err.textContent = 'Please choose Business or Personal.'; return; }
      if (r.dir === 'out' && !tag) { err.textContent = 'Please choose a category or type your own.'; return; }
      if (custom) { var found = A.allTags(r.dir).filter(function (t) { return U.key(t) === U.key(custom); })[0]; tag = found || custom; if (!found) A.rememberTag(custom); }
      r.bucket = sel.bucket || r.bucket || null; r.tag = tag; delete r.auto;
      if (ruleOn) {
        S.D.rules[A.ruleKey(r)] = { bucket: r.bucket, tag: r.tag };
        S.D.tx.forEach(function (x) { if (x !== r && x.dir === r.dir && U.key(x.name) === U.key(r.name) && (x.auto || A.needsTag(x))) { if (x.auto || !x.bucket) { x.bucket = r.bucket; delete x.auto; } if (!x.tag) x.tag = r.tag; } });
      }
      S.commit('tx', 'rules', 'settings');
      A.closeSheet(); U.toast('Saved'); A.refresh();
    }
    draw();
    keep();
  };

  /* ---------- add (paste) ---------- */
  A.V.add = {
    open: function () {
      var sim = 1, res = null;
      function draw(text) {
        var h = '<h2>Add M-Pesa messages</h2><p class="mute">Copy the messages from your SMS app, then paste them here. Pasting the same message twice is safe.</p>' +
          '<label class="f">Which SIM received these messages?</label><div class="chips"><button class="chip' + (sim === 1 ? ' on' : '') + '" data-s="1">' + U.esc(simName(1)) + '</button><button class="chip' + (sim === 2 ? ' on' : '') + '" data-s="2">' + U.esc(simName(2)) + '</button></div>' +
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
          U.$$('[data-s]', b).forEach(function (x) { x.onclick = function () { var t = U.$('#ad-text', b).value; sim = +x.getAttribute('data-s'); res = null; draw(t); }; });
          var ta = U.$('#ad-text', b);
          ta.oninput = function () { if (res) { res = null; var rd = U.$('#ad-save', b); draw(ta.value); } };
          var rd = U.$('#ad-read', b);
          if (rd) rd.onclick = function () {
            var t = ta.value;
            if (!t.trim()) { U.$('#ad-err', b).textContent = 'Paste your M-Pesa messages first.'; return; }
            res = P.parseMessages(t, sim);
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
            A.closeSheet();
            U.toast(ms.added.length + ' added' + (n ? ', ' + n + ' tagged by your rules' : ''), 3400);
            st.tab = 'money'; st.onlyUntagged = false; A.go('money');
          };
        });
      }
      draw('');
    }
  };
})();
