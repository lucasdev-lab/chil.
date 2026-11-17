/* Chil: Debts and credits table. kind 'owed' = money people owe me; kind 'owe' = money I owe suppliers. */
(function () {
  var C = window.Chil, U = C.U, S = C.Store, A = C.A, Ex = C.Export;
  var st = A.st;

  function byId(id) { return S.D.debts.filter(function (d) { return d.id === id; })[0]; }
  function pillCls(k) { return k === 'over' ? 'bad' : k === 'paid' ? 'ok' : k === 'soon' ? 'warn' : ''; }
  function listFor(kind) {
    return S.D.debts.filter(function (d) { return d.kind === kind; }).sort(function (a, b) {
      var ia = A.debtInfo(a), ib = A.debtInfo(b);
      var pa = ia.key === 'paid' ? 1 : 0, pb = ib.key === 'paid' ? 1 : 0;
      if (pa !== pb) return pa - pb;
      var da = a.due || '9999-99-99', db = b.due || '9999-99-99';
      if (da !== db) return da < db ? -1 : 1;
      return a.date < b.date ? -1 : 1;
    });
  }

  A.debtsPrintHTML = function () {
    function tbl(kind, title) {
      var l = listFor(kind), t = A.debtTotals(kind);
      return '<h2>' + title + '</h2><table><tr><th>#</th><th>Date</th><th>Name</th><th>Description</th><th class="n">Amount</th><th class="n">Paid</th><th class="n">Balance</th><th>Due date</th><th>Status</th></tr>' +
        (l.map(function (d, i) { var f = A.debtInfo(d); return '<tr><td>' + (i + 1) + '</td><td>' + U.fmtDayYear(d.date) + '</td><td>' + U.esc(d.name) + '</td><td>' + U.esc(d.desc || '') + '</td><td class="n">' + U.money2(d.amount) + '</td><td class="n">' + U.money2(f.paid) + '</td><td class="n">' + U.money2(f.bal) + '</td><td>' + (d.due ? U.fmtDayYear(d.due) : '') + '</td><td>' + f.label + '</td></tr>'; }).join('') || '<tr><td colspan="9">None</td></tr>') +
        '</table><p><b>Outstanding: ' + U.money2(t.open) + '</b> (overdue ' + U.money2(t.over) + ')</p>';
    }
    return '<h1>Chil debts and credits: ' + U.esc(A.shopLabel()) + '</h1><p class="sub">Made ' + U.fmtDayYear(U.todayISO()) + '</p>' + tbl('owed', 'Owed to me (customers)') + tbl('owe', 'I owe (suppliers)');
  };

  function form(d, kind) {
    var isNew = !d;
    d = d || { kind: kind, name: '', desc: '', amount: '', date: U.todayISO(), due: '' };
    var k = d.kind;
    function body() {
      return '<h2>' + (isNew ? 'Add to the list' : 'Edit entry') + '</h2>' +
        '<div class="chips" style="margin-top:8px"><button class="chip' + (k === 'owed' ? ' on' : '') + '" data-k="owed">Owed to me</button><button class="chip' + (k === 'owe' ? ' on' : '') + '" data-k="owe">I owe</button></div>' +
        '<p class="hint">' + (k === 'owed' ? 'Someone took goods or money from you and will pay later.' : 'You took stock or credit from a supplier and will pay later.') + '</p>' +
        '<label class="f">' + (k === 'owed' ? 'Who owes you?' : 'Who do you owe?') + '</label><input class="in" id="d-name" maxlength="60" placeholder="Name" value="' + U.esc(d.name) + '">' +
        '<label class="f">Description</label><input class="in" id="d-desc" maxlength="120" placeholder="e.g. 2 bags of sugar" value="' + U.esc(d.desc) + '">' +
        '<label class="f">Amount (KSh)</label><input class="in" id="d-amt" inputmode="decimal" placeholder="0" value="' + U.esc(d.amount) + '">' +
        '<div class="row"><div class="grow"><label class="f">Date given</label><input class="in" type="date" id="d-date" value="' + d.date + '"></div>' +
        '<div class="grow"><label class="f">Date to pay</label><input class="in" type="date" id="d-due" value="' + (d.due || '') + '"></div></div>' +
        '<div class="err" id="d-err"></div><button class="btn green block" id="d-save">Save</button>';
    }
    function draw() {
      A.sheet(body(), function (b) {
        U.$$('[data-k]', b).forEach(function (x) {
          x.onclick = function () {
            d = { kind: k, name: U.$('#d-name', b).value, desc: U.$('#d-desc', b).value, amount: U.$('#d-amt', b).value, date: U.$('#d-date', b).value, due: U.$('#d-due', b).value, id: d.id, payments: d.payments };
            k = x.getAttribute('data-k'); d.kind = k; draw();
          };
        });
        U.$('#d-save', b).onclick = function () {
          var name = U.$('#d-name', b).value.trim(), desc = U.$('#d-desc', b).value.trim();
          var amt = C.Calc.evalExpr(U.$('#d-amt', b).value), date = U.$('#d-date', b).value, due = U.$('#d-due', b).value;
          var err = U.$('#d-err', b);
          if (!name) { err.textContent = 'Please enter a name.'; return; }
          if (amt == null || amt <= 0) { err.textContent = 'Please enter an amount above 0.'; return; }
          if (!date) { err.textContent = 'Please pick the date given.'; return; }
          if (due && due < date) { err.textContent = 'The pay date cannot be before the date given.'; return; }
          amt = U.round2(amt);
          if (isNew) {
            S.D.debts.push({ id: U.uid(), kind: k, name: name, desc: desc, amount: amt, date: date, due: due || '', payments: [] });
          } else {
            var o = byId(d.id);
            var paid = U.sum(o.payments || [], function (p) { return p.amount; });
            if (amt < paid) { err.textContent = 'The amount cannot be less than what has already been paid (' + U.money(paid) + ').'; return; }
            o.kind = k; o.name = name; o.desc = desc; o.amount = amt; o.date = date; o.due = due || '';
          }
          S.commit('debts'); st.debtView = k; A.closeSheet(); U.toast('Saved');
          if (st.tab === 'debts') A.refresh(); else A.go('debts');
        };
      });
    }
    draw();
  }

  function detail(id) {
    var d = byId(id);
    if (!d) return;
    var i = A.debtInfo(d);
    var h = '<h2>' + U.esc(d.name) + '</h2><p class="mute">' + (d.kind === 'owed' ? 'Owes you' : 'You owe') + (d.desc ? ' · ' + U.esc(d.desc) : '') + '</p>' +
      '<div class="tot" style="margin-top:10px"><div><small>Amount</small><b class="num">' + U.money2(d.amount) + '</b></div><div><small>Paid</small><b class="num pos">' + U.money2(i.paid) + '</b></div><div><small>Balance</small><b class="num ' + (i.bal > 0 ? 'neg' : 'pos') + '">' + U.money2(i.bal) + '</b></div></div>' +
      '<p class="hint" style="margin:0 0 6px">Given ' + U.fmtDayYear(d.date) + (d.due ? ' · to be paid by ' + U.fmtDayYear(d.due) : '') + ' · <span class="pill ' + pillCls(i.key) + '">' + i.label + '</span></p>';
    if ((d.payments || []).length) {
      h += '<div class="card" style="margin-top:8px"><h3>Payments</h3>' + d.payments.map(function (p) {
        return '<div class="list-item"><span>' + U.fmtDayYear(p.date) + '</span><span><b class="num">' + U.money2(p.amount) + '</b> <button class="del" data-delp="' + p.id + '">Remove</button></span></div>';
      }).join('') + '</div>';
    }
    if (i.bal > 0) {
      h += '<label class="f">' + (d.kind === 'owed' ? 'Record a payment received' : 'Record a payment you made') + '</label><div class="row"><input class="in grow" id="p-amt" inputmode="decimal" placeholder="Amount"><input class="in grow" type="date" id="p-date" value="' + U.todayISO() + '"></div>' +
        '<div class="err" id="p-err"></div><div class="row"><button class="btn green grow" id="p-add">Add payment</button><button class="btn ghost grow" id="p-full">Mark fully paid</button></div>';
    }
    h += '<div class="row" style="margin-top:14px"><button class="btn ghost grow" id="d-edit">Edit</button><button class="btn ghost grow" id="d-del" style="color:var(--red)">Delete</button></div>';
    A.sheet(h, function (b) {
      function addPay(amount, date) {
        d.payments = d.payments || [];
        d.payments.push({ id: U.uid(), date: date, amount: U.round2(amount) });
        S.commit('debts'); A.refresh(); detail(id);
      }
      U.$$('[data-delp]', b).forEach(function (x) { x.onclick = function () { d.payments = d.payments.filter(function (p) { return p.id !== x.getAttribute('data-delp'); }); S.commit('debts'); A.refresh(); detail(id); }; });
      var pa = U.$('#p-add', b);
      if (pa) {
        pa.onclick = function () {
          var v = C.Calc.evalExpr(U.$('#p-amt', b).value), date = U.$('#p-date', b).value, err = U.$('#p-err', b);
          if (v == null || v <= 0) { err.textContent = 'Enter the amount paid.'; return; }
          if (!date) { err.textContent = 'Pick the payment date.'; return; }
          if (v > i.bal + 0.001) { err.textContent = 'That is more than the balance (' + U.money2(i.bal) + ').'; return; }
          addPay(v, date);
        };
        U.$('#p-full', b).onclick = function () { addPay(i.bal, U.$('#p-date', b).value || U.todayISO()); };
      }
      U.$('#d-edit', b).onclick = function () { form(d); };
      U.$('#d-del', b).onclick = function () {
        A.confirm('Delete this entry?', 'This removes ' + d.name + ' and its payments from your list.', 'Delete', function () {
          S.D.debts = S.D.debts.filter(function (x) { return x !== d; }); S.commit('debts'); A.refresh(); U.toast('Deleted');
        }, true);
      };
    });
  }

  A.V.debts = {
    open: function (id) { if (st.tab !== 'debts') { st.tab = 'debts'; A.shell(); A.render(true); } detail(id); },
    html: function () {
      var kind = st.debtView, l = listFor(kind), t = A.debtTotals(kind), tt = A.debtTotals(kind === 'owed' ? 'owe' : 'owed');
      var h = '<h1 class="page-title">Debts and credits</h1><div class="seg"><button data-v="owed" class="' + (kind === 'owed' ? 'on' : '') + '">Owed to me</button><button data-v="owe" class="' + (kind === 'owe' ? 'on' : '') + '">I owe</button></div>';
      h += '<div class="tot four"><div><small>' + (kind === 'owed' ? 'Still owed to you' : 'Still to pay') + '</small><b class="num ' + (kind === 'owed' ? 'pos' : 'neg') + '">' + U.money(t.open) + '</b></div><div><small>Overdue</small><b class="num ' + (t.over ? 'neg' : '') + '">' + U.money(t.over) + '</b></div></div>';
      if (!l.length) {
        h += '<div class="empty"><b>' + (kind === 'owed' ? 'Nobody owes you yet' : 'You owe no supplier') + '</b>Tap the button below to write one down with its date, pay date and description.</div>';
      } else {
        h += '<div class="tw"><table class="t"><thead><tr><th>#</th><th>Date</th><th class="name">Name</th><th>Description</th><th class="r">Amount</th><th class="r">Paid</th><th class="r">Balance</th><th>Pay by</th><th>Status</th></tr></thead><tbody>';
        l.forEach(function (d, n) {
          var i = A.debtInfo(d);
          h += '<tr class="tx" data-id="' + d.id + '"><td class="mute">' + (n + 1) + '</td><td>' + U.fmtDay(d.date) + '</td><td class="name"><b>' + U.esc(d.name) + '</b></td><td class="desc">' + U.esc(d.desc || '') + '</td>' +
            '<td class="r num">' + U.money2(d.amount) + '</td><td class="r num">' + U.money2(i.paid) + '</td><td class="r num"><b>' + U.money2(i.bal) + '</b></td><td>' + (d.due ? U.fmtDayYear(d.due) : '<span class="mute">—</span>') + '</td><td><span class="pill ' + pillCls(i.key) + '">' + i.label + '</span></td></tr>';
        });
        h += '</tbody><tfoot><tr><td colspan="4">Outstanding total</td><td></td><td></td><td class="r num">' + U.money2(t.open) + '</td><td colspan="2"></td></tr></tfoot></table></div>';
      }
      h += '<button class="btn block" data-act="add">+ Add ' + (kind === 'owed' ? 'a debt someone owes me' : 'a credit I owe') + '</button>';
      if (l.length) h += '<div class="row" style="margin-top:10px"><button class="btn ghost grow" data-act="pdf">PDF</button><button class="btn ghost grow" data-act="xls">Excel</button></div>';
      if (tt.open) h += '<p class="hint center">' + (kind === 'owed' ? 'You also owe suppliers ' : 'People also owe you ') + 'KSh ' + U.money(tt.open) + '.</p>';
      h += '<p class="hint center">Tap a row to record a payment, edit or delete.</p>';
      return h;
    },
    mount: function (root) {
      U.$$('[data-v]', root).forEach(function (b) { b.onclick = function () { st.debtView = b.getAttribute('data-v'); A.refresh(); }; });
      U.$$('tr.tx', root).forEach(function (r) { r.onclick = function () { detail(r.getAttribute('data-id')); }; });
      U.$$('[data-act]', root).forEach(function (b) {
        b.onclick = function () {
          var a = b.getAttribute('data-act');
          if (a === 'add') form(null, st.debtView);
          if (a === 'pdf') Ex.print(A.debtsPrintHTML(), 'Chil debts and credits');
          if (a === 'xls') U.download('Chil-debts-' + U.todayISO() + '.csv', Ex.debtsCSV(S.D.debts.slice().sort(function (a, b) { return a.kind < b.kind ? 1 : -1; }), A.debtInfo), 'text/csv;charset=utf-8');
        };
      });
    }
  };
})();
