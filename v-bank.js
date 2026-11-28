/* Chil: Money in bank. Balances from your bank messages, the bank's money in and out, and cash you take to the bank. */
(function () {
  var C = window.Chil, U = C.U, S = C.Store, A = C.A;
  var st = A.st;
  st.bkAcc = st.bkAcc || '';

  A.IC.bank = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10l9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18"/></svg>';

  // Cash from your hand into the bank. Cash in hand goes down by itself (it is part of the cash sums on the Money tab).
  A.cashBankSheet = function (date) {
    var accs = A.bankAccounts().map(function (a) { return a.label; }), pick = accs[0] || '';
    function draw(keep) {
      A.sheet('<h2>Cash taken to the bank</h2><p class="mute">Cash from your hand that you put in the bank. Your cash in hand goes down and the bank goes up. If your bank sends a message for this deposit, do not add it here as well.</p>' +
        '<label class="f">Amount (KSh)</label><input class="in" id="cb-amt" inputmode="decimal" placeholder="0">' +
        '<label class="f">Date</label><input class="in" type="date" id="cb-date" value="' + date + '">' +
        '<label class="f">Which bank account?</label><div class="chips">' + accs.map(function (a) { return '<button class="chip' + (!keep && pick === a || keep && keep.pick === a ? ' on' : '') + '" data-a="' + U.esc(a) + '">' + U.esc(a) + '</button>'; }).join('') + '</div>' +
        '<input class="in" id="cb-new" style="margin-top:10px" maxlength="30" placeholder="' + (accs.length ? 'Or type another account name' : 'Bank account name, e.g. Equity') + '">' +
        '<div class="err" id="cb-err"></div><button class="btn green block" id="cb-save">Save</button>', function (b) {
        if (keep) { U.$('#cb-amt', b).value = keep.amt; U.$('#cb-date', b).value = keep.date; U.$('#cb-new', b).value = keep.nw; }
        U.$$('[data-a]', b).forEach(function (x) { x.onclick = function () { draw({ amt: U.$('#cb-amt', b).value, date: U.$('#cb-date', b).value, nw: U.$('#cb-new', b).value, pick: x.getAttribute('data-a') }); pick = x.getAttribute('data-a'); }; });
        U.$('#cb-save', b).onclick = function () {
          var v = C.Calc.evalExpr(U.$('#cb-amt', b).value.trim()), nw = U.$('#cb-new', b).value.trim(), d = U.$('#cb-date', b).value, err = U.$('#cb-err', b);
          var acc = nw || (keep && keep.pick) || pick;
          if (v == null || v <= 0) { err.textContent = 'Enter the amount, for example 2000.'; return; }
          if (!d) { err.textContent = 'Pick the date.'; return; }
          if (!acc) { err.textContent = 'Choose or type the bank account.'; return; }
          S.D.cash.banked.push({ id: U.uid(), date: d, amount: U.round2(v), account: acc, note: '' });
          S.commit('cash'); A.closeSheet(); U.toast('Saved'); A.refresh();
        };
      });
    }
    draw();
  };

  // Money received (or paid out) in a business bank account, typed by hand, for banks that send no SMS.
  A.bankEntrySheet = function (acct, dir0) {
    var accs = A.bankAccounts().map(function (a) { return a.label; }), sel = { acct: acct || accs[0] || '', dir: dir0 || 'in', bucket: dir0 === 'out' ? 'personal' : 'business', tag: '' };
    function reason() { var a = (S.D.settings.banks || []).filter(function (b) { return b.name === sel.acct; })[0]; return a && a.reason ? a.reason : ''; }
    function draw(keep) {
      var tags = A.allTags(sel.dir), rs = reason(), tg = sel.tag || (sel.dir === 'in' ? rs : '');
      A.sheet('<h2>' + (sel.dir === 'in' ? 'Money received in the bank' : 'Money paid from the bank') + '</h2>' +
        '<div class="chips"><button class="chip' + (sel.dir === 'in' ? ' on' : '') + '" data-d="in">Money received</button><button class="chip' + (sel.dir === 'out' ? ' on' : '') + '" data-d="out">Money paid out</button></div>' +
        '<label class="f">Bank account</label><div class="chips">' + accs.map(function (a) { return '<button class="chip' + (sel.acct === a ? ' on' : '') + '" data-a="' + U.esc(a) + '">' + U.esc(a) + '</button>'; }).join('') + '</div>' +
        '<input class="in" id="be-new" style="margin-top:8px" maxlength="30" placeholder="' + (accs.length ? 'Or type another account name' : 'Bank account name, e.g. KCB shop account') + '">' +
        '<label class="f">Amount (KSh)</label><input class="in" id="be-amt" inputmode="decimal" placeholder="0">' +
        '<label class="f">' + (sel.dir === 'in' ? 'Received from' : 'Paid to') + '</label><input class="in" id="be-name" maxlength="40" placeholder="Name or reason">' +
        '<label class="f">Date</label><input class="in" type="date" id="be-date" value="' + U.todayISO() + '">' +
        '<label class="f">Business or personal?</label><div class="chips"><button class="chip biz' + (sel.bucket === 'business' ? ' on' : '') + '" data-b="business">Business</button><button class="chip per' + (sel.bucket === 'personal' ? ' on' : '') + '" data-b="personal">Personal</button></div>' +
        '<label class="f">Category</label><div class="chips">' + tags.map(function (t) { return '<button class="chip' + (tg === t ? ' on' : '') + '" data-t="' + U.esc(t) + '">' + U.esc(t) + '</button>'; }).join('') + '</div>' +
        '<input class="in" id="be-custom" style="margin-top:8px" maxlength="30" placeholder="Or type your own tag">' +
        '<div class="err" id="be-err"></div><button class="btn green block" id="be-save">Save</button>', function (b) {
        if (keep) { ['amt', 'name', 'date', 'new', 'custom'].forEach(function (k) { U.$('#be-' + k, b).value = keep[k]; }); }
        function snap() { var o = {}; ['amt', 'name', 'date', 'new', 'custom'].forEach(function (k) { o[k] = U.$('#be-' + k, b).value; }); return o; }
        U.$$('[data-d]', b).forEach(function (x) { x.onclick = function () { var k = snap(); sel.dir = x.getAttribute('data-d'); sel.bucket = sel.dir === 'in' ? 'business' : 'personal'; sel.tag = ''; draw(k); }; });
        U.$$('[data-a]', b).forEach(function (x) { x.onclick = function () { var k = snap(); k.new = ''; sel.acct = x.getAttribute('data-a'); draw(k); }; });
        U.$$('[data-b]', b).forEach(function (x) { x.onclick = function () { var k = snap(); sel.bucket = x.getAttribute('data-b'); draw(k); }; });
        U.$$('[data-t]', b).forEach(function (x) { x.onclick = function () { var k = snap(); k.custom = ''; sel.tag = x.getAttribute('data-t'); draw(k); }; });
        U.$('#be-save', b).onclick = function () {
          var k = snap(), v = C.Calc.evalExpr(k.amt.trim()), acc = k.new.trim() || sel.acct, tag = k.custom.trim() || sel.tag || (sel.dir === 'in' ? reason() : ''), err = U.$('#be-err', b);
          if (!acc) { err.textContent = 'Choose or type the bank account.'; return; }
          if (v == null || v <= 0) { err.textContent = 'Enter the amount, for example 2500.'; return; }
          if (!k.date) { err.textContent = 'Pick the date.'; return; }
          if (!tag) { err.textContent = 'Choose a category or type your own.'; return; }
          if (k.custom.trim()) A.rememberTag(k.custom.trim());
          if (!(S.D.settings.banks || []).some(function (x) { return x.name === acc; }) && !S.D.tx.some(function (x) { return x.bank && x.account === acc; })) S.D.settings.banks.push({ name: acc, reason: '' });
          var now = new Date(), hh = ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2);
          S.D.tx.push({ code: 'BM' + U.uid(), dir: sel.dir, amount: U.round2(v), fee: 0, name: k.name.trim() || (sel.dir === 'in' ? 'Money received' : 'Money paid'), account: acc, bank: true, balance: null, ref: '', bucket: sel.bucket, tag: tag,
            date: k.date, time: hh, ts: k.date + 'T' + hh, kind: 'manual', manual: true, sim: 0 });
          S.commit('tx', 'settings'); A.closeSheet(); U.toast('Saved'); A.refresh();
        };
      });
    }
    draw();
  };

  function txs() { return S.D.tx.filter(function (r) { return r.bank && (!st.bkAcc || r.account === st.bkAcc); }).sort(function (a, b) { return a.ts < b.ts ? 1 : -1; }); }

  A.V.bank = {
    html: function () {
      var accs = A.bankAccounts(), list = txs();
      var h = '<h1 class="page-title">Money in bank</h1>';
      h += '<div class="tot"><div><small>Total in bank</small><b class="num pos">' + U.money(accs.total) + '</b></div><div><small>Accounts</small><b class="num">' + accs.length + '</b></div></div>';
      h += '<div class="row" style="margin-bottom:10px"><button class="btn grow" id="bk-in">+ Money received</button><button class="btn ghost grow" id="bk-cash">Cash taken to bank</button></div><div class="row" style="margin-bottom:10px"><button class="btn ghost grow" id="bk-add">Add bank messages</button></div>';
      if (!accs.length) return h + '<div class="empty"><b>No bank money yet</b>Paste your bank SMS with the + button. Chil reads credits, debits, ATM, card and charges. You can also add cash you took to the bank.</div>';
      h += '<div class="card"><h3>Accounts</h3>' + accs.map(function (a) {
        return '<div class="list-item"><div class="grow"><b>' + U.esc(a.label) + '</b><small>' + (a.typed ? 'typed balance' : a.last ? 'from message ' + U.fmtDayYear(a.last.slice(0, 10)) : 'from cash taken to bank') + ' · ' + a.count + (a.count === 1 ? ' message' : ' messages') + '</small></div><b class="num">' + U.money2(a.balance) + '</b><button class="btn small ghost" data-bal="' + U.esc(a.label) + '">Set</button></div>';
      }).join('') + '<p class="hint" style="margin:8px 0 0">The balance comes from your latest bank message. Tap Set to type it yourself.</p></div>';
      if (accs.length > 1) h += '<div class="chips" style="margin-bottom:10px"><button class="chip' + (!st.bkAcc ? ' on' : '') + '" data-f="">All</button>' + accs.map(function (a) { return '<button class="chip' + (st.bkAcc === a.label ? ' on' : '') + '" data-f="' + U.esc(a.label) + '">' + U.esc(a.label) + '</button>'; }).join('') + '</div>';
      var banked = S.D.cash.banked.filter(function (x) { return !st.bkAcc || x.account === st.bkAcc; });
      if (banked.length) h += '<div class="card"><h3>Cash you took to the bank</h3>' + banked.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).map(function (x) { return '<div class="list-item"><div class="grow"><b>' + U.esc(x.account) + '</b><small>' + U.fmtDayYear(x.date) + '</small></div><b class="num">' + U.money2(x.amount) + '</b><button class="btn small ghost" data-delb="' + x.id + '">Delete</button></div>'; }).join('') + '</div>';
      h += '<div class="card"><h3>Bank money in and out</h3>' + (list.length ? list.map(function (r) {
        var sign = r.dir === 'in' ? '+' : r.dir === 'out' ? '−' : '';
        return '<div class="list-item bk-tx" data-code="' + r.code + '" style="cursor:pointer"><div class="grow"><b>' + U.esc(r.name) + '</b><small>' + U.fmtDayYear(r.date) + (r.time && r.time !== '00:00' ? ' · ' + U.time12(r.time) : '') + ' · ' + U.esc(r.account) + (r.xfer ? ' · own money' : r.tag ? ' · ' + U.esc(r.tag) : A.needsTag(r) ? ' · tap to tag' : '') + '</small></div><b class="num ' + (r.dir === 'in' ? 'pos' : r.dir === 'out' ? 'neg' : '') + '">' + sign + U.money2(r.amount) + '</b></div>';
      }).join('') : '<p class="hint">No bank messages yet.</p>') + '</div>';
      return h + '<p class="hint center">Bank messages are worded differently by each bank, so each is marked "check" until you confirm the amounts. Tap one to tag it.</p>';
    },
    mount: function (root) {
      var bi = U.$('#bk-in', root); if (bi) bi.onclick = function () { A.bankEntrySheet(st.bkAcc); };
      var cb = U.$('#bk-cash', root); if (cb) cb.onclick = function () { A.cashBankSheet(U.todayISO()); };
      var ad = U.$('#bk-add', root); if (ad) ad.onclick = function () { A.V.add.open(); };
      U.$$('[data-f]', root).forEach(function (b) { b.onclick = function () { st.bkAcc = b.getAttribute('data-f'); A.refresh(); }; });
      U.$$('[data-delb]', root).forEach(function (b) { b.onclick = function () { var id = b.getAttribute('data-delb'); S.D.cash.banked = S.D.cash.banked.filter(function (x) { return x.id !== id; }); S.commit('cash'); A.refresh(); }; });
      U.$$('.bk-tx', root).forEach(function (b) { b.onclick = function () { A.tagSheet(b.getAttribute('data-code')); }; });
      U.$$('[data-bal]', root).forEach(function (b) {
        b.onclick = function () {
          var l = b.getAttribute('data-bal');
          A.sheet('<h2>' + U.esc(l) + ' balance</h2><p class="mute">Type the balance you see in your bank app. Leave it empty to use the latest bank message again.</p><input class="in" id="bb-v" inputmode="decimal" placeholder="0" value="' + (S.D.cash.bankBal[l] != null ? S.D.cash.bankBal[l] : '') + '"><div class="err" id="bb-e"></div><button class="btn green block" id="bb-s" style="margin-top:10px">Save</button>', function (sb) {
            U.$('#bb-s', sb).onclick = function () {
              var t = U.$('#bb-v', sb).value.trim();
              if (t === '') delete S.D.cash.bankBal[l];
              else { var v = C.Calc.evalExpr(t); if (v == null || v < 0) { U.$('#bb-e', sb).textContent = 'Enter an amount.'; return; } S.D.cash.bankBal[l] = U.round2(v); }
              S.commit('cash'); A.closeSheet(); A.refresh();
            };
          });
        };
      });
    }
  };
})();
