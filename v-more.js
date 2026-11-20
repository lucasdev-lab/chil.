/* Chil: Settings, report sending, close shop, setup, lock and activation screens. */
(function () {
  var C = window.Chil, U = C.U, S = C.Store, A = C.A, Ex = C.Export, Act = C.Act;
  var st = A.st;
  var DAYN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  /* ---------- full screens ---------- */
  A.screen = function (cls, html, mount) {
    var h = U.$('#screen-host');
    h.innerHTML = '<div class="screen ' + (cls || '') + '">' + html + '</div>';
    if (mount) mount(U.$('.screen', h));
  };
  A.clearScreen = function () { U.$('#screen-host').innerHTML = ''; };

  /* ---------- PIN ---------- */
  function sha(s) {
    if (!(window.crypto && crypto.subtle)) return Promise.resolve('plain:' + s);
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(function (b) {
      return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    });
  }
  function hashPin(pin, salt) { return sha(salt + ':' + pin).then(function (h) { return salt + ':' + h; }); }
  function checkPin(pin) {
    var p = S.D.settings.pin;
    if (!p) return Promise.resolve(true);
    var salt = p.split(':')[0];
    return hashPin(pin, salt).then(function (h) { return h === p; });
  }
  A.lock = function (done) {
    var pin = '';
    function draw(msg) {
      A.screen('', '<div class="pad center" style="justify-content:center">' + C.Logo.icon(64) + '<h2 style="margin-top:14px">Enter your PIN</h2><div class="pin-dots">' +
        [0, 1, 2, 3].map(function (i) { return '<i class="' + (i < pin.length ? 'on' : '') + '"></i>'; }).join('') + '</div><div class="err" id="pin-err">' + (msg || '') + '</div>' +
        '<div class="keypad">' + ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map(function (k) { return k === '' ? '<span></span>' : '<button data-k="' + k + '">' + k + '</button>'; }).join('') + '</div>' +
        '<button class="hint" id="pin-forgot" style="text-decoration:underline">Forgot PIN?</button></div>', function (root) {
          U.$$('[data-k]', root).forEach(function (b) {
            b.onclick = function () {
              var k = b.getAttribute('data-k');
              if (k === '⌫') pin = pin.slice(0, -1); else if (pin.length < 4) pin += k;
              if (pin.length === 4) {
                checkPin(pin).then(function (ok) {
                  if (ok) { A.clearScreen(); done(); } else { pin = ''; draw('Wrong PIN. Try again.'); }
                });
                draw(); return;
              }
              draw();
            };
          });
          U.$('#pin-forgot', root).onclick = function () {
            A.sheet('<h2>Forgot your PIN?</h2><p class="mute">A PIN cannot be recovered. The only way back in is to erase all data on this phone and start fresh. If you saved a backup file, you can restore it afterwards.</p><div class="gap"></div>' +
              '<div class="row"><button class="btn ghost grow" data-close="1">Cancel</button><button class="btn danger grow" id="pin-wipe">Erase and start fresh</button></div>', function (b) {
                U.$('#pin-wipe', b).onclick = function () { S.wipe(); A.closeSheet(); A.clearScreen(); location.reload(); };
              });
          };
        });
    }
    draw();
  };

  /* ---------- activation and subscription ---------- */
  function sellerWA(msg) {
    var n = window.CHIL_CONFIG.SELLER_WHATSAPP;
    return n ? 'https://wa.me/' + n + '?text=' + encodeURIComponent(msg) : '';
  }
  function reasonText(r) {
    if (r.reason === 'ended') return 'That code already ended on ' + U.fmtDayYear(r.end) + '. Ask the seller for a new one.';
    return 'That code is not valid for this phone. Check it was copied fully, or ask the seller.';
  }
  function planName(t) { return t === 'trial' ? 'Free trial' : t === 'lifetime' ? 'Never expires' : t === 'free' ? 'Preview' : 'Subscription'; }

  // Paste-a-code box used on the activation screen, the lock screen, and Settings.
  function codeBox(onOk) {
    return '<label class="f">Activation code</label><textarea class="in" id="act-code" style="min-height:84px;text-transform:uppercase" placeholder="Paste your code here" autocomplete="off" autocapitalize="characters"></textarea>' +
      '<div class="err" id="act-err"></div><button class="btn block" id="act-go">Activate</button>';
  }
  function bindCode(root, onOk) {
    U.$('#act-go', root).onclick = function () {
      var code = U.$('#act-code', root).value.trim(), err = U.$('#act-err', root);
      if (!code) { err.textContent = 'Paste the activation code first.'; return; }
      err.textContent = 'Checking...';
      Act.activate(code).then(function (r) { if (r.ok) onOk(r); else err.textContent = reasonText(r); });
    };
  }
  function idBlock() {
    var id = Act.shownId();
    return '<div class="idbox" id="act-id">' + id + '</div><div class="row" style="margin-top:10px"><button class="btn ghost grow" id="act-copy">Copy ID</button></div>';
  }
  function bindCopy(root) {
    var id = Act.shownId();
    U.$('#act-copy', root).onclick = function () { try { navigator.clipboard.writeText(id); U.toast('Copied'); } catch (e) { U.toast('Press and hold the ID to copy'); } };
  }

  A.activationScreen = function (done) {
    var cfg = window.CHIL_CONFIG, id = Act.shownId();
    var wa = sellerWA('Hello, I want to use Chil. My Device ID is ' + id);
    A.screen('', '<div class="pad"><div class="center" style="margin:6px 0 14px">' + C.Logo.lockup(46, 30) + '<p class="mute" style="margin-top:6px">Your money, sorted.</p></div>' +
      '<h2>Activate Chil</h2><p class="mute">Send this Device ID to the seller. You will get an activation code that works only on this phone.</p>' +
      '<div class="gap"></div>' + idBlock() + (wa ? '<a class="btn green block" style="margin-top:8px" href="' + wa + '" target="_blank" rel="noopener">Send on WhatsApp</a>' : '') +
      (cfg.PAY_INSTRUCTIONS ? '<p class="hint" style="white-space:pre-line">' + U.esc(cfg.PAY_INSTRUCTIONS) + '</p>' : '') +
      codeBox() + (Act.supported() ? '' : '<div class="err">This browser cannot check activation codes. Open the link in Chrome or Safari.</div>') +
      '<p class="hint center" style="margin-top:14px">Needs to be done only once per plan. Works offline afterwards.</p></div>', function (root) {
        bindCopy(root);
        bindCode(root, function () { A.clearScreen(); done(); });
      });
  };

  // Shown when the subscription has ended, the copy was switched off, or the phone date looks wrong.
  A.subLock = function (state) {
    var cfg = window.CHIL_CONFIG, id = Act.shownId();
    var title, text;
    if (state.kind === 'blocked') { title = 'This copy has been switched off'; text = 'Please contact the seller.'; }
    else if (state.kind === 'clock') { title = 'Check your phone date'; text = 'Your phone\'s date is earlier than before. Set the correct date and time in your phone settings, then tap "Check again". Or ask the seller for a new code.'; }
    else { title = state.type === 'trial' ? 'Your free trial has ended' : 'Your subscription has ended'; text = 'It ended on ' + U.fmtDayYear(state.end) + '. Your records are safe. Pay the seller, send your Device ID, and paste the new code below.'; }
    var wa = sellerWA('Hello, my Chil ' + (state.type === 'trial' ? 'trial' : 'subscription') + ' has ended. I want to renew. My Device ID is ' + id);
    A.screen('', '<div class="pad"><div class="center" style="margin:6px 0 10px">' + C.Logo.icon(56) + '</div><h2>' + U.esc(title) + '</h2><p class="mute">' + U.esc(text) + '</p>' +
      '<div class="gap"></div>' + idBlock() + (wa ? '<a class="btn green block" style="margin-top:8px" href="' + wa + '" target="_blank" rel="noopener">Renew on WhatsApp</a>' : '') +
      (cfg.PAY_INSTRUCTIONS ? '<p class="hint" style="white-space:pre-line">' + U.esc(cfg.PAY_INSTRUCTIONS) + '</p>' : '') +
      (state.kind === 'blocked' ? '' : codeBox()) +
      (state.kind === 'clock' ? '<button class="btn ghost block" id="clk-again" style="margin-top:10px">Check again</button>' : '') +
      '<button class="btn ghost block" id="lk-backup" style="margin-top:10px">Save a backup of my records</button></div>', function (root) {
        bindCopy(root);
        if (state.kind !== 'blocked') bindCode(root, function () { location.reload(); });
        var ag = U.$('#clk-again', root); if (ag) ag.onclick = function () { location.reload(); };
        U.$('#lk-backup', root).onclick = function () { A.doBackup(); };
      });
  };

  // One line for the top of the Money tab when the end date is near.
  A.subBanner = function () {
    var s = Act.state();
    if (s.kind !== 'warn' && s.kind !== 'grace') return '';
    var what = s.type === 'trial' ? 'Free trial' : 'Subscription';
    var when = s.kind === 'grace' ? 'ended on ' + U.fmtDayYear(s.end) + '. Last day to renew!' : s.left === 0 ? 'ends today.' : s.left === 1 ? 'ends tomorrow.' : 'ends in ' + s.left + ' days (' + U.fmtDayYear(s.end) + ').';
    return '<div class="banner ' + (s.kind === 'grace' || s.left <= 1 ? 'red' : '') + '">' + what + ' ' + when + ' <button data-act="renew">Renew</button></div>';
  };

  // Renew or enter a new code (opened from the banner and from Settings).
  A.codeSheet = function () {
    var cfg = window.CHIL_CONFIG, id = Act.shownId(), s = Act.state();
    var wa = sellerWA('Hello, I want to renew Chil. My Device ID is ' + id);
    A.sheet('<h2>Renew or enter a new code</h2><p class="mute">Pay the seller and send your Device ID. Then paste the new code here.</p><div class="gap"></div>' + idBlock() +
      (wa ? '<a class="btn green block" style="margin-top:8px" href="' + wa + '" target="_blank" rel="noopener">Ask the seller on WhatsApp</a>' : '') +
      (cfg.PAY_INSTRUCTIONS ? '<p class="hint" style="white-space:pre-line">' + U.esc(cfg.PAY_INSTRUCTIONS) + '</p>' : '') + codeBox(), function (b) {
        bindCopy(b);
        bindCode(b, function (r) {
          A.closeSheet(); U.toast(r.type === 'lifetime' ? 'Activated. Never expires.' : 'Done. Valid until ' + U.fmtDayYear(r.end), 3600);
          A.go(A.st.tab === 'more' ? 'more' : A.st.tab);
        });
      });
  };

  A.subCardHTML = function () {
    var s = Act.state(), line, sub = '';
    if (s.type === 'lifetime') line = 'Never expires';
    else if (s.type === 'free') line = 'Preview copy';
    else {
      line = (s.type === 'trial' ? 'Free trial' : 'Subscription') + ' until ' + U.fmtDayYear(s.end);
      sub = s.kind === 'grace' ? 'Ended. Renew today to keep using Chil.' : s.left === 0 ? 'Ends today.' : s.left === 1 ? '1 day left.' : s.left + ' days left.';
    }
    return '<div class="card"><h3>Subscription</h3><div class="list-item"><div class="grow"><b>' + U.esc(line) + '</b>' + (sub ? '<small>' + U.esc(sub) + '</small>' : '') + '</div>' +
      (s.type === 'free' ? '' : '<button class="btn small ghost" id="s-code">' + (s.type === 'lifetime' ? 'Enter code' : 'Renew') + '</button>') + '</div></div>';
  };

  /* ---------- first-time setup ---------- */
  A.setup = function (done) {
    var s = S.D.settings, days = (s.days || [1, 2, 3, 4, 5, 6]).slice();
    function draw(vals) {
      vals = vals || { name: s.shopName, open: s.openAt, close: s.closeAt };
      A.screen('', '<div class="pad"><div class="center" style="margin:6px 0 12px">' + C.Logo.lockup(40, 26) + '</div><h2>Set up your shop</h2><p class="mute">This takes a minute. Chil uses your hours for reminders and the close shop check.</p>' +
        '<label class="f">Shop name</label><input class="in" id="su-name" maxlength="40" placeholder="e.g. Wanjiru General Shop" value="' + U.esc(vals.name) + '">' +
        '<div class="row"><div class="grow"><label class="f">Opening time</label><input class="in" type="time" id="su-open" value="' + vals.open + '"></div><div class="grow"><label class="f">Closing time</label><input class="in" type="time" id="su-close" value="' + vals.close + '"></div></div>' +
        '<label class="f">Days you open</label><div class="chips">' + [1, 2, 3, 4, 5, 6, 0].map(function (d) { return '<button class="chip' + (days.indexOf(d) >= 0 ? ' on' : '') + '" data-d="' + d + '">' + DAYN[d] + '</button>'; }).join('') + '</div>' +
        '<div class="err" id="su-err"></div><div style="flex:1"></div><button class="btn block" id="su-go">Start using Chil</button></div>', function (root) {
          function cur() { return { name: U.$('#su-name', root).value, open: U.$('#su-open', root).value, close: U.$('#su-close', root).value }; }
          U.$$('[data-d]', root).forEach(function (b) {
            b.onclick = function () {
              var d = +b.getAttribute('data-d'), i = days.indexOf(d);
              if (i >= 0) days.splice(i, 1); else days.push(d);
              b.classList.toggle('on', i < 0);
            };
          });
          U.$('#su-go', root).onclick = function () {
            var v = cur(), err = U.$('#su-err', root);
            if (!v.name.trim()) { err.textContent = 'Please enter your shop name.'; return; }
            if (!v.open) { err.textContent = 'Please enter your opening time.'; return; }
            if (!v.close) { err.textContent = 'Please enter your closing time.'; return; }
            if (v.close <= v.open) { err.textContent = 'Closing time must be later than opening time.'; return; }
            if (!days.length) { err.textContent = 'Pick at least one day.'; return; }
            s.shopName = v.name.trim(); s.openAt = v.open; s.closeAt = v.close; s.days = days.slice().sort(); s.setupDone = true;
            s.installedAt = s.installedAt || U.todayISO();
            S.commit('settings'); A.clearScreen(); done();
          };
        });
    }
    draw();
  };

  /* ---------- close shop ---------- */
  A.V.more = {};
  A.V.more.closeShop = function () {
    var today = U.todayISO(), s = S.D.settings;
    var tl = S.D.tx.filter(function (r) { return r.date === today; });
    var sm = A.summarize(tl);
    var untag = tl.filter(A.needsTag).length, chk = tl.filter(function (r) { return r.check; }).length;
    var overdue = S.D.debts.filter(function (d) { var i = A.debtInfo(d); return i.key === 'over' && d.kind === 'owed'; }).length;
    var dueToday = S.D.debts.filter(function (d) { var i = A.debtInfo(d); return i.key !== 'paid' && d.due === today; }).length;
    var imported = s.lastImportAt === today;
    function li(ok, t, sub, btn) { return '<li><span class="dot' + (ok ? '' : ' warn') + '">' + (ok ? '✓' : '!') + '</span><div class="grow"><b>' + t + '</b><small>' + sub + '</small></div>' + (btn || '') + '</li>'; }
    var h = '<div class="pad"><h2>Close shop check</h2><p class="mute">' + U.fmtDayLong(today) + '</p><ul class="checklist">' +
      li(imported, imported ? 'Messages added today' : 'Add today\'s M-Pesa messages', imported ? 'Your records are up to date.' : 'You have not pasted messages today.', imported ? '' : '<button class="btn small" data-x="add">Add</button>') +
      li(!untag, untag ? untag + ' not tagged' : 'Everything is tagged', untag ? 'Tag them so your summary is right.' : 'Business, personal and categories are done.', untag ? '<button class="btn small" data-x="tag">Tag</button>' : '') +
      (chk ? li(false, chk + ' to double-check', 'Rows marked "check" use a message type not tested before.', '') : '') +
      li(!dueToday && !overdue, (dueToday || overdue) ? 'Debts need attention' : 'No debts due', (dueToday ? dueToday + ' due today. ' : '') + (overdue ? overdue + ' owed to you overdue.' : (!dueToday ? 'Nothing is due today.' : '')), (dueToday || overdue) ? '<button class="btn small" data-x="debts">View</button>' : '') +
      '</ul><div class="card"><h3>Today</h3><div class="tot" style="margin:0"><div><small>In</small><b class="pos num">' + U.money(sm.inn) + '</b></div><div><small>Out</small><b class="neg num">' + U.money(sm.spent + sm.saved) + '</b></div><div><small>Left</small><b class="num">' + U.money(sm.left) + '</b></div></div></div>' +
      '<div style="flex:1"></div><button class="btn green block" data-x="close">Close shop</button><button class="btn ghost block" data-x="back" style="margin-top:10px">Not yet</button></div>';
    A.screen('', h, function (root) {
      U.$$('[data-x]', root).forEach(function (b) {
        b.onclick = function () {
          var x = b.getAttribute('data-x');
          if (x === 'back') A.clearScreen();
          if (x === 'add') { A.clearScreen(); A.V.add.open(); }
          if (x === 'tag') { A.clearScreen(); st.onlyUntagged = true; st.month = 'all'; A.go('money'); }
          if (x === 'debts') { A.clearScreen(); A.go('debts'); }
          if (x === 'close') {
            s.closedDate = today; S.commit('settings');
            A.screen('night', '<div class="pad">' + C.Logo.NIGHT + '<h1>It was fruitful today.</h1><p>Let\'s gather more tomorrow.</p><div class="gap"></div><button class="btn block" data-x="done" style="max-width:280px">Done</button></div>', function (r2) {
              U.$('[data-x=done]', r2).onclick = function () { A.clearScreen(); A.go('money'); };
            });
          }
        };
      });
    });
  };

  /* ---------- monthly report ---------- */
  function monthsWithData() {
    var m = {}, cur = U.monthKey(U.todayISO());
    m[cur] = 1;
    S.D.tx.forEach(function (r) { m[U.monthKey(r.date)] = 1; });
    return Object.keys(m).sort().reverse();
  }
  A.reportText = function (mk, o) {
    var s = S.D.settings, list = A.inPeriod('month', mk), sm = A.summarize(list);
    var L = [];
    L.push('*Chil monthly report*');
    L.push(A.shopLabel() + ' · ' + U.monthLabel(mk));
    L.push('');
    L.push('Money in: KSh ' + U.money(sm.inn));
    L.push('Spent: KSh ' + U.money(sm.spent));
    L.push('Saved: KSh ' + U.money(sm.saved));
    L.push('Left: KSh ' + U.money(sm.left));
    if (o.split) {
      L.push(''); L.push('*Business and personal*');
      L.push('In: Business ' + U.money(sm.inBiz) + ', Personal ' + U.money(sm.inPer) + (sm.inUn ? ', Not tagged ' + U.money(sm.inUn) : ''));
      L.push('Spent: Business ' + U.money(sm.outBiz) + ', Personal ' + U.money(sm.outPer) + (sm.outUn ? ', Not tagged ' + U.money(sm.outUn) : ''));
    }
    if (o.cat) {
      L.push(''); L.push('*Where the money went*');
      var cs = A.sorted(sm.cats);
      if (!cs.length) L.push('Nothing recorded');
      cs.forEach(function (r) { L.push(r[0] + ': ' + U.money(r[1])); });
    }
    if (o.work) {
      var bz = S.D.biz.rows.filter(function (r) { return U.monthKey(r.date) === mk; }), bt = 0, bs = 0, bk = 0, bn = 0;
      bz.forEach(function (r) {
        var sa = C.Calc.evalExpr(r.sales), sk = C.Calc.evalExpr(r.stock);
        if (sa == null && sk == null) return;
        bs += sa || 0; bk += sk || 0; bn++;
      });
      bt = U.round2(bs - bk);
      if (bn) { L.push(''); L.push('*Business evaluation*'); L.push('Sales: KSh ' + U.money(bs) + ', Stock: KSh ' + U.money(bk)); L.push((bt < 0 ? 'Loss' : 'Profit') + ': KSh ' + U.money(Math.abs(bt)) + ' from ' + bn + (bn === 1 ? ' row' : ' rows')); }
    }
    if (o.debts) {
      var a = A.debtTotals('owed'), b = A.debtTotals('owe');
      if (a.count || b.count) {
        L.push(''); L.push('*Debts and credits*');
        L.push('Owed to me: KSh ' + U.money(a.open) + (a.over ? ' (overdue ' + U.money(a.over) + ')' : ''));
        L.push('I owe: KSh ' + U.money(b.open) + (b.over ? ' (overdue ' + U.money(b.over) + ')' : ''));
      }
    }
    L.push(''); L.push('Sent from Chil. Your money, sorted.');
    return L.join('\n');
  };
  function recipLabel(r) { return r.name + ' (' + (r.type === 'email' ? r.value : '+' + r.value) + ')'; }

  A.V.more.reportSheet = function () {
    var s = S.D.settings, mk = st.sumMonth || U.monthKey(U.todayISO());
    var ms = monthsWithData();
    if (ms.indexOf(mk) < 0) mk = ms[0];
    function draw() {
      var o = s.reportOpts, rec = s.recipients.filter(function (r) { return r.id === s.selRecipient; })[0] || null;
      var text = A.reportText(mk, o);
      var h = '<h2>Send monthly report</h2>' +
        '<label class="f">Month</label><select class="sel" id="r-month">' + ms.map(function (k) { return '<option value="' + k + '"' + (k === mk ? ' selected' : '') + '>' + U.monthLabel(k) + '</option>'; }).join('') + '</select>' +
        '<label class="f">Send to</label><select class="sel" id="r-to"><option value="">Choose when sending</option>' + s.recipients.map(function (r) { return '<option value="' + r.id + '"' + (rec && rec.id === r.id ? ' selected' : '') + '>' + U.esc(recipLabel(r)) + '</option>'; }).join('') + '<option value="__new">+ Add new person</option></select>' +
        '<label class="f">Include</label>' +
        [['split', 'Business and personal'], ['cat', 'Where money went'], ['work', 'Business evaluation'], ['debts', 'Debts and credits']].map(function (p) {
          return '<label class="check-row"><input type="checkbox" data-o="' + p[0] + '"' + (o[p[0]] ? ' checked' : '') + '> ' + p[1] + '</label>';
        }).join('') +
        '<label class="f">Preview</label><pre class="report">' + U.esc(text) + '</pre><div class="gap"></div>' +
        '<div class="row"><button class="btn green grow" id="r-wa">WhatsApp</button><button class="btn grow" id="r-mail">Email</button></div>' +
        '<div class="row" style="margin-top:8px"><button class="btn ghost grow" id="r-file">Share Excel file</button><button class="btn ghost grow" id="r-copy">Copy text</button></div>' +
        '<p class="hint">WhatsApp and Email open with the report already typed. You press send. "Share Excel file" uses your phone\'s share menu.</p>';
      A.sheet(h, function (b) {
        U.$('#r-month', b).onchange = function () { mk = this.value; draw(); };
        U.$('#r-to', b).onchange = function () {
          if (this.value === '__new') { addRecipient(function () { draw(); }); return; }
          s.selRecipient = this.value || null; S.commit('settings'); draw();
        };
        U.$$('[data-o]', b).forEach(function (c) { c.onchange = function () { s.reportOpts[c.getAttribute('data-o')] = c.checked; S.commit('settings'); draw(); }; });
        var subject = 'Chil report: ' + A.shopLabel() + ' ' + U.monthLabel(mk);
        var plain = text.replace(/\*/g, '');
        U.$('#r-wa', b).onclick = function () {
          var num = rec && rec.type === 'whatsapp' ? rec.value : '';
          window.open('https://wa.me/' + num + '?text=' + encodeURIComponent(text), '_blank');
        };
        U.$('#r-mail', b).onclick = function () {
          var to = rec && rec.type === 'email' ? rec.value : '';
          location.href = 'mailto:' + to + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(plain);
        };
        U.$('#r-file', b).onclick = function () {
          var list = A.inPeriod('month', mk);
          if (!list.length) { U.toast('No records in that month.'); return; }
          Ex.shareFile('Chil-' + mk + '.csv', Ex.txCSV(list, s.simNames), 'text/csv').then(function (r) { if (r === 'downloaded') U.toast('File downloaded'); });
        };
        U.$('#r-copy', b).onclick = function () { try { navigator.clipboard.writeText(plain); U.toast('Copied'); } catch (e) { U.toast('Could not copy'); } };
      });
    }
    draw();
  };

  function addRecipient(after) {
    var s = S.D.settings, type = 'whatsapp';
    function draw(v) {
      v = v || { name: '', value: '' };
      A.sheet('<h2>Add a person</h2><div class="chips" style="margin-top:8px"><button class="chip' + (type === 'whatsapp' ? ' on' : '') + '" data-t="whatsapp">WhatsApp</button><button class="chip' + (type === 'email' ? ' on' : '') + '" data-t="email">Email</button></div>' +
        '<label class="f">Name</label><input class="in" id="rc-name" maxlength="40" placeholder="e.g. Accountant" value="' + U.esc(v.name) + '">' +
        '<label class="f">' + (type === 'email' ? 'Email address' : 'WhatsApp number') + '</label><input class="in" id="rc-val" ' + (type === 'email' ? 'type="email" placeholder="name@example.com"' : 'inputmode="tel" placeholder="0712 345 678"') + ' value="' + U.esc(v.value) + '">' +
        '<div class="err" id="rc-err"></div><button class="btn green block" id="rc-save">Save</button>', function (b) {
          U.$$('[data-t]', b).forEach(function (x) { x.onclick = function () { var cur = { name: U.$('#rc-name', b).value, value: '' }; type = x.getAttribute('data-t'); draw(cur); }; });
          U.$('#rc-save', b).onclick = function () {
            var name = U.$('#rc-name', b).value.trim(), val = U.$('#rc-val', b).value.trim(), err = U.$('#rc-err', b);
            if (!name) { err.textContent = 'Please enter a name.'; return; }
            if (type === 'email') { if (!U.isEmail(val)) { err.textContent = 'That email address does not look right.'; return; } val = val.toLowerCase(); }
            else { val = U.phone(val); if (!val) { err.textContent = 'Enter a valid Kenyan number, e.g. 0712 345 678.'; return; } }
            var r = { id: U.uid(), type: type, name: name, value: val };
            s.recipients.push(r); s.selRecipient = r.id; S.commit('settings');
            U.toast('Saved'); after();
          };
        });
    }
    draw();
  }

  /* ---------- settings page ---------- */
  function simRow(n) {
    return '<div class="row" style="margin-bottom:8px"><span class="pill" style="min-width:56px;text-align:center">SIM ' + n + '</span><input class="in grow" data-sim="' + n + '" maxlength="20" value="' + U.esc(S.D.settings.simNames[n]) + '"></div>';
  }

  A.V.more.html = function () {
    var s = S.D.settings;
    var h = '<h1 class="page-title">Settings</h1>';
    h += '<div class="card"><h3>My shop</h3><label class="f" style="margin-top:0">Shop name</label><input class="in" id="s-name" maxlength="40" value="' + U.esc(s.shopName) + '">' +
      '<div class="row"><div class="grow"><label class="f">Opens</label><input class="in" type="time" id="s-open" value="' + s.openAt + '"></div><div class="grow"><label class="f">Closes</label><input class="in" type="time" id="s-close" value="' + s.closeAt + '"></div></div>' +
      '<label class="f">Days open</label><div class="chips">' + [1, 2, 3, 4, 5, 6, 0].map(function (d) { return '<button class="chip' + (s.days.indexOf(d) >= 0 ? ' on' : '') + '" data-d="' + d + '">' + DAYN[d] + '</button>'; }).join('') + '</div>' +
      '<label class="f">Morning message</label><input class="in" id="s-msg" maxlength="90" value="' + U.esc(s.openMsg) + '"><div class="err" id="s-err"></div></div>';
    h += '<div class="card"><h3>Reminders</h3><p class="hint" style="margin:0 0 10px">Adds repeating alarms to your phone\'s calendar: one when you open and one when you close. They ring even when Chil is closed.</p><button class="btn block" id="s-ics">Add reminders to my calendar</button></div>';
    h += '<div class="card"><h3>My SIM cards</h3>' + simRow(1) + simRow(2) + '<p class="hint">Give them names you recognise, like "Shop line" and "Personal".</p></div>';
    h += '<div class="card"><h3>Monthly report</h3>' +
      (s.recipients.length ? s.recipients.map(function (r) { return '<div class="list-item"><div class="grow"><b>' + U.esc(r.name) + '</b><small>' + (r.type === 'email' ? 'Email · ' + U.esc(r.value) : 'WhatsApp · +' + r.value) + '</small></div><button class="del" data-rm="' + r.id + '">Remove</button></div>'; }).join('') : '<p class="hint" style="margin:0 0 8px">No saved people yet. Add the email or WhatsApp number you send reports to.</p>') +
      '<div class="row" style="margin-top:10px"><button class="btn ghost grow" id="s-addr">+ Add person</button><button class="btn grow" id="s-rep">Send report</button></div></div>';
    h += '<div class="card"><h3>Security</h3><div class="list-item"><div class="grow"><b>PIN lock</b><small>' + (s.pin ? 'On: asks for a 4-digit PIN' : 'Off') + '</small></div><button class="btn small ghost" id="s-pin">' + (s.pin ? 'Change' : 'Set PIN') + '</button></div>' +
      (s.pin ? '<div class="row" style="margin-top:8px"><span class="grow">Lock after being away</span><select class="sel" id="s-lock" style="width:auto">' + [0, 1, 2, 5, 10].map(function (m) { return '<option value="' + m + '"' + (m === s.autoLockMin ? ' selected' : '') + '>' + (m ? m + ' min' : 'Right away') + '</option>'; }).join('') + '</select></div><button class="btn ghost block" id="s-pinoff" style="margin-top:10px">Remove PIN</button>' : '') + '</div>';
    var nr = Object.keys(S.D.rules).length;
    h += '<div class="card"><h3>Tag rules</h3><div class="list-item"><div class="grow"><b>' + nr + ' saved</b><small>People you always tag the same way</small></div><button class="btn small ghost" id="s-rules"' + (nr ? '' : ' disabled') + '>Manage</button></div></div>';
    h += '<div class="card"><h3>Backup</h3><p class="hint" style="margin:0 0 10px">All your data stays on this phone. Save a backup file now and then, especially before clearing browser data or changing phones.' + (s.lastBackup ? ' Last backup: ' + U.fmtDayYear(s.lastBackup) + '.' : ' You have not made a backup yet.') + '</p>' +
      '<div class="row"><button class="btn grow" id="s-bk">Save backup</button><button class="btn ghost grow" id="s-rs">Restore</button></div><input type="file" id="s-file" accept=".json,application/json" class="hide"></div>';
    h += A.subCardHTML();
    h += '<div class="card"><h3>About</h3><div class="list-item"><span>Version</span><b>' + window.CHIL_CONFIG.VERSION + '</b></div><div class="list-item"><span>Device ID</span><b class="num">' + Act.shownId() + '</b></div>' +
      '<p class="hint">Chil works offline. Nothing is sent anywhere unless you press WhatsApp, Email or Share.</p><button class="btn ghost block" id="s-wipe" style="color:var(--red);margin-top:6px">Erase all data on this phone</button></div>';
    return h;
  };

  A.V.more.mount = function (root) {
    var s = S.D.settings, err = U.$('#s-err', root);
    function saveShop(showMsg) {
      var name = U.$('#s-name', root).value.trim(), o = U.$('#s-open', root).value, c = U.$('#s-close', root).value;
      err.textContent = '';
      if (!name) { err.textContent = 'Shop name cannot be empty.'; return; }
      if (!o || !c) { err.textContent = 'Opening and closing times are required.'; return; }
      if (c <= o) { err.textContent = 'Closing time must be later than opening time.'; return; }
      if (!s.days.length) { err.textContent = 'Pick at least one day.'; return; }
      s.shopName = name; s.openAt = o; s.closeAt = c; s.openMsg = U.$('#s-msg', root).value.trim() || "Let's get to work. Make the day fruitful.";
      S.commit('settings'); if (showMsg) U.toast('Saved');
      var sh = U.$('.top .shop'); if (sh) sh.textContent = s.shopName;
    }
    ['#s-name', '#s-open', '#s-close', '#s-msg'].forEach(function (q) { U.$(q, root).onchange = function () { saveShop(true); }; });
    U.$$('[data-d]', root).forEach(function (b) {
      b.onclick = function () {
        var d = +b.getAttribute('data-d'), i = s.days.indexOf(d);
        if (i >= 0) { if (s.days.length === 1) { err.textContent = 'Pick at least one day.'; return; } s.days.splice(i, 1); } else s.days.push(d);
        s.days.sort(); b.classList.toggle('on', i < 0); err.textContent = ''; S.commit('settings');
      };
    });
    U.$('#s-ics', root).onclick = function () {
      if (!s.openAt || !s.closeAt) { U.toast('Set your opening and closing times first.'); return; }
      var ics = Ex.ics(s);
      Ex.shareFile('Chil-shop-reminders.ics', ics, 'text/calendar').then(function (r) {
        if (r === 'downloaded') U.toast('Open the downloaded file to add the alarms to your calendar', 4500);
      });
    };
    U.$$('[data-sim]', root).forEach(function (i) {
      i.onchange = function () { var n = i.getAttribute('data-sim'); s.simNames[n] = i.value.trim() || 'SIM ' + n; i.value = s.simNames[n]; S.commit('settings'); U.toast('Saved'); };
    });
    U.$$('[data-rm]', root).forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute('data-rm');
        s.recipients = s.recipients.filter(function (r) { return r.id !== id; });
        if (s.selRecipient === id) s.selRecipient = null;
        S.commit('settings'); A.refresh();
      };
    });
    U.$('#s-addr', root).onclick = function () { addRecipient(function () { A.closeSheet(); A.refresh(); }); };
    U.$('#s-rep', root).onclick = function () { A.V.more.reportSheet(); };
    var sc = U.$('#s-code', root); if (sc) sc.onclick = function () { A.codeSheet(); };
    U.$('#s-pin', root).onclick = function () { pinSheet(); };
    var po = U.$('#s-pinoff', root);
    if (po) po.onclick = function () {
      A.sheet('<h2>Remove PIN?</h2><p class="mute">Enter your current PIN to turn the lock off.</p><input class="in" id="pn-cur" type="password" inputmode="numeric" maxlength="4" placeholder="Current PIN"><div class="err" id="pn-err"></div><button class="btn green block" id="pn-go">Remove PIN</button>', function (b) {
        U.$('#pn-go', b).onclick = function () { checkPin(U.$('#pn-cur', b).value).then(function (ok) { if (!ok) { U.$('#pn-err', b).textContent = 'Wrong PIN.'; return; } s.pin = null; S.commit('settings'); A.closeSheet(); A.refresh(); U.toast('PIN removed'); }); };
      });
    };
    var lk = U.$('#s-lock', root);
    if (lk) lk.onchange = function () { s.autoLockMin = +lk.value; S.commit('settings'); U.toast('Saved'); };
    U.$('#s-rules', root).onclick = function () {
      var keys = Object.keys(S.D.rules);
      A.sheet('<h2>Tag rules</h2><p class="hint">Chil tags new records from these people automatically.</p>' + keys.map(function (k) {
        var r = S.D.rules[k], p = k.split('|');
        return '<div class="list-item"><div class="grow"><b>' + U.esc(p.slice(1).join('|')) + '</b><small>' + (p[0] === 'in' ? 'Money in' : 'Money out') + ' · ' + U.esc((r.bucket ? U.cap(r.bucket) : '') + (r.tag ? ' · ' + r.tag : '')) + '</small></div><button class="del" data-k="' + U.esc(k) + '">Remove</button></div>';
      }).join(''), function (b) {
        U.$$('[data-k]', b).forEach(function (x) { x.onclick = function () { delete S.D.rules[x.getAttribute('data-k')]; S.commit('rules'); A.closeSheet(); A.refresh(); U.toast('Rule removed'); }; });
      });
    };
    U.$('#s-bk', root).onclick = function () { A.doBackup(function () { A.refresh(); }); };
    var fi = U.$('#s-file', root);
    U.$('#s-rs', root).onclick = function () { fi.click(); };
    fi.onchange = function () {
      var f = fi.files && fi.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        var obj; try { obj = JSON.parse(rd.result); } catch (e) { U.toast('That file could not be read.'); return; }
        if (!obj || obj.app !== 'chil' || !Array.isArray(obj.tx) || !Array.isArray(obj.debts)) { U.toast('This file is not a Chil backup.'); return; }
        A.confirm('Restore this backup?', 'It has ' + obj.tx.length + ' money records and ' + obj.debts.length + ' debt entries. Everything now on this phone will be replaced.', 'Restore', function () {
          var res = S.importAll(obj);
          if (res.ok) { U.toast('Restored'); A.go('money'); } else U.toast(res.message);
        }, true);
      };
      rd.readAsText(f); fi.value = '';
    };
    U.$('#s-wipe', root).onclick = function () {
      A.confirm('Erase everything?', 'All records, debts, business rows and settings on this phone will be deleted. Save a backup first if you want to keep them. Your activation stays.', 'Erase all', function () {
        S.wipe(); location.reload();
      }, true);
    };
  };

  function pinSheet() {
    var s = S.D.settings;
    A.sheet('<h2>' + (s.pin ? 'Change PIN' : 'Set a PIN') + '</h2><p class="mute">Choose 4 digits you will remember. A PIN cannot be recovered if forgotten.</p>' +
      (s.pin ? '<label class="f">Current PIN</label><input class="in" id="pn-cur" type="password" inputmode="numeric" maxlength="4">' : '') +
      '<label class="f">New PIN</label><input class="in" id="pn-a" type="password" inputmode="numeric" maxlength="4"><label class="f">Repeat new PIN</label><input class="in" id="pn-b" type="password" inputmode="numeric" maxlength="4">' +
      '<div class="err" id="pn-err"></div><button class="btn green block" id="pn-go">Save PIN</button>', function (b) {
        U.$('#pn-go', b).onclick = function () {
          var a = U.$('#pn-a', b).value, c = U.$('#pn-b', b).value, err = U.$('#pn-err', b);
          function proceed() {
            if (!/^\d{4}$/.test(a)) { err.textContent = 'The PIN must be exactly 4 digits.'; return; }
            if (a !== c) { err.textContent = 'The two PINs do not match.'; return; }
            hashPin(a, U.uid()).then(function (h) { s.pin = h; S.commit('settings'); A.closeSheet(); A.refresh(); U.toast('PIN saved'); });
          }
          if (s.pin) checkPin(U.$('#pn-cur', b).value).then(function (ok) { if (!ok) err.textContent = 'Current PIN is wrong.'; else proceed(); });
          else proceed();
        };
      });
  }

  A.doBackup = function (after) {
    var s = S.D.settings;
    var json = JSON.stringify(S.exportAll(), null, 1);
    Ex.shareFile('Chil-backup-' + U.todayISO() + '.json', json, 'application/json').then(function (r) {
      if (r === 'cancelled') return;
      s.lastBackup = U.todayISO(); S.commit('settings');
      U.toast(r === 'downloaded' ? 'Backup file downloaded. Keep it safe.' : 'Backup saved', 3200);
      if (after) after();
    });
  };
  A.checkPin = checkPin;
})();
