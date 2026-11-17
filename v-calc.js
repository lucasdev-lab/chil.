/* Chil: Calculator and Workings page. */
(function () {
  var C = window.Chil, U = C.U, S = C.Store, A = C.A, E = C.Calc;
  var st = A.st;
  var expr = '';
  var BASE_TAGS = ['Sales', 'Stock', 'Transport', 'Profit', 'Expense', 'Loan', 'Other'];

  function show(v) { return v == null ? '' : U.money2(v); }
  function resultText() {
    if (!expr) return '0';
    var v = E.evalExpr(expr);
    return v == null ? '…' : U.money(v);
  }
  function tagList() {
    var seen = {}, out = [];
    BASE_TAGS.concat(S.D.work.tags || [], S.D.work.rows.map(function (w) { return w.tag; })).forEach(function (t) {
      if (t && !seen[U.key(t)]) { seen[U.key(t)] = 1; out.push(t); }
    });
    return out;
  }
  function netText() {
    var n = A.workNet();
    return { text: (n.net < 0 ? '−' : '') + 'KSh ' + U.money(Math.abs(n.net)), used: n.used };
  }

  function calcHTML() {
    var keys = [['C', 'cl'], ['(', 'op'], [')', 'op'], ['⌫', 'op'],
      ['7'], ['8'], ['9'], ['÷', 'op'], ['4'], ['5'], ['6'], ['×', 'op'], ['1'], ['2'], ['3'], ['−', 'op'], ['0'], ['.'], ['%', 'op'], ['+', 'op']];
    return '<div class="calc"><div class="disp"><div class="expr" id="c-expr">' + U.esc(expr || ' ') + '</div><div class="res num" id="c-res">' + resultText() + '</div></div>' +
      '<div class="keys">' + keys.map(function (k) { return '<button class="' + (k[1] || '') + '" data-k="' + k[0] + '" aria-label="' + k[0] + '">' + k[0] + '</button>'; }).join('') +
      '<button class="eq" data-k="=" style="grid-column:span 4">=</button></div></div>' +
      '<button class="btn green block" id="c-use">Add this result to my workings</button>' +
      '<p class="hint center">Tip: 1000+16% gives 1,160. Use it for VAT, discounts and profit.</p>';
  }

  function rowHTML(w) {
    var v = A.rowValue(w);
    return '<div class="wrow' + (w.counts ? '' : ' off') + '" data-id="' + w.id + '">' +
      '<div class="top2"><button class="sign' + (w.sign === '-' ? ' minus' : '') + '" data-f="sign" aria-label="Add or take away">' + (w.sign === '-' ? '−' : '+') + '</button>' +
      '<input class="in grow" data-f="label" maxlength="60" placeholder="What is this? e.g. Today\'s sales" value="' + U.esc(w.label) + '"><div class="val num" data-v>' + (v == null ? '<span class="mute">?</span>' : show(v)) + '</div></div>' +
      '<div class="row" style="margin-top:8px"><input class="in grow" data-f="expr" inputmode="decimal" autocomplete="off" placeholder="Maths, e.g. 450+300×2" value="' + U.esc(w.expr) + '">' +
      '<button class="in grow tagbtn' + (w.tag ? '' : ' empty-tag') + '" data-f="tag">' + (w.tag ? U.esc(w.tag) : 'Choose tag') + '<span aria-hidden="true">▾</span></button></div>' +
      '<div class="row" style="margin-top:8px;justify-content:space-between"><label class="tog" data-f="counts"><span class="sw' + (w.counts ? ' on' : '') + '"></span><span>Counts in net</span></label><button class="del" data-f="del">Delete</button></div></div>';
  }

  function workHTML() {
    var rows = S.D.work.rows, n = netText();
    return '<div class="netbox"><div><small>Net of rows marked "counts"</small><b id="w-net">' + n.text + '</b></div><small id="w-used">' + n.used + (n.used === 1 ? ' row' : ' rows') + '</small></div>' +
      (rows.length ? rows.map(rowHTML).join('') : '<div class="empty"><b>Your workings are empty</b>Add a row, type any maths, give it a tag, and switch on "Counts in net" for the ones that are useful.</div>') +
      '<button class="btn block" id="w-add">+ Add a row</button>' +
      (rows.length ? '<button class="btn ghost block" id="w-clear" style="margin-top:10px">Clear all rows</button>' : '') +
      '<p class="hint center">The net here is kept separate from your M-Pesa summary.</p>';
  }

  function newRow(exprText) {
    var w = { id: U.uid(), label: '', expr: exprText || '', sign: '+', tag: '', counts: true };
    S.D.work.rows.push(w);
    S.commit('work');
    return w;
  }

  function mountCalc(root) {
    var ex = U.$('#c-expr', root), rs = U.$('#c-res', root);
    function upd() { ex.textContent = expr || ' '; rs.textContent = resultText(); }
    U.$$('[data-k]', root).forEach(function (b) {
      b.onclick = function () {
        var k = b.getAttribute('data-k');
        if (k === 'C') expr = '';
        else if (k === '⌫') expr = expr.slice(0, -1);
        else if (k === '=') { var v = E.evalExpr(expr); if (v != null) expr = String(v); else U.toast('Check the maths'); }
        else expr += k === '−' ? '-' : k;
        upd();
      };
    });
    U.$('#c-use', root).onclick = function () {
      var v = E.evalExpr(expr);
      if (v == null) { U.toast('Type a valid calculation first'); return; }
      newRow(String(v));
      st.calcMode = 'work'; A.refresh(); U.toast('Added to workings');
    };
  }

  function tagPicker(w, btn) {
    function pick(t) {
      w.tag = t || '';
      if (t) {
        var all = S.D.work.tags = S.D.work.tags || [];
        var known = BASE_TAGS.concat(all).map(U.key);
        if (known.indexOf(U.key(t)) < 0) all.push(t);
      }
      S.commit('work');
      btn.classList.toggle('empty-tag', !w.tag);
      btn.innerHTML = (w.tag ? U.esc(w.tag) : 'Choose tag') + '<span aria-hidden="true">▾</span>';
      A.closeSheet();
    }
    A.sheet('<h2>What is this for?</h2><p class="hint" style="margin:0 0 10px">Tap one, or type your own below.</p><div class="chips">' +
      tagList().map(function (t) { return '<button class="chip' + (U.key(t) === U.key(w.tag) ? ' on' : '') + '" data-t="' + U.esc(t) + '">' + U.esc(t) + '</button>'; }).join('') + '</div>' +
      '<label class="f">Or add your own</label><div class="row"><input class="in grow" id="tp-own" maxlength="30" placeholder="Type a tag"><button class="btn green" id="tp-add">Add</button></div>' +
      '<div class="err" id="tp-err"></div>' + (w.tag ? '<button class="btn ghost block" id="tp-none">Remove tag</button>' : ''), function (b) {
        U.$$('[data-t]', b).forEach(function (x) { x.onclick = function () { pick(x.getAttribute('data-t')); }; });
        function addOwn() {
          var v = U.$('#tp-own', b).value.trim();
          if (!v) { U.$('#tp-err', b).textContent = 'Type a tag first.'; return; }
          var found = tagList().filter(function (t) { return U.key(t) === U.key(v); })[0];
          pick(found || v);
        }
        U.$('#tp-add', b).onclick = addOwn;
        U.$('#tp-own', b).onkeydown = function (e) { if (e.key === 'Enter') addOwn(); };
        var none = U.$('#tp-none', b);
        if (none) none.onclick = function () { pick(''); };
      });
  }

  function mountWork(root) {
    var add = U.$('#w-add', root), clr = U.$('#w-clear', root);
    function updNet() { var n = netText(); U.$('#w-net', root).textContent = n.text; U.$('#w-used', root).textContent = n.used + (n.used === 1 ? ' row' : ' rows'); }
    add.onclick = function () { newRow(''); A.refresh(); var rows = U.$$('.wrow', root); setTimeout(function () { var l = U.$$('[data-f=label]'); if (l.length) l[l.length - 1].focus(); }, 30); };
    if (clr) clr.onclick = function () { A.confirm('Clear all rows?', 'This removes every row in your workings.', 'Clear', function () { S.D.work.rows = []; S.commit('work'); A.refresh(); }, true); };
    U.$$('.wrow', root).forEach(function (el) {
      var w = S.D.work.rows.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0];
      if (!w) return;
      U.$$('[data-f]', el).forEach(function (f) {
        var k = f.getAttribute('data-f');
        if (k === 'label' || k === 'expr') {
          f.oninput = function () {
            w[k] = f.value;
            if (k === 'expr') { var v = A.rowValue(w); U.$('[data-v]', el).innerHTML = v == null ? '<span class="mute">?</span>' : show(v); }
            S.commit('work'); updNet();
          };
        } else if (k === 'tag') {
          f.onclick = function () { tagPicker(w, f); };
        } else if (k === 'sign') {
          f.onclick = function () { w.sign = w.sign === '-' ? '+' : '-'; f.textContent = w.sign === '-' ? '−' : '+'; f.classList.toggle('minus', w.sign === '-'); S.commit('work'); updNet(); };
        } else if (k === 'counts') {
          f.onclick = function () { w.counts = !w.counts; U.$('.sw', f).classList.toggle('on', w.counts); el.classList.toggle('off', !w.counts); S.commit('work'); updNet(); };
        } else if (k === 'del') {
          f.onclick = function () { S.D.work.rows = S.D.work.rows.filter(function (x) { return x !== w; }); S.commit('work'); A.refresh(); };
        }
      });
    });
  }

  A.V.calc = {
    html: function () {
      return '<div class="seg"><button data-m="calc" class="' + (st.calcMode === 'calc' ? 'on' : '') + '">Calculator</button><button data-m="work" class="' + (st.calcMode === 'work' ? 'on' : '') + '">Workings</button></div>' +
        (st.calcMode === 'calc' ? calcHTML() : workHTML());
    },
    mount: function (root) {
      U.$$('[data-m]', root).forEach(function (b) { b.onclick = function () { st.calcMode = b.getAttribute('data-m'); A.refresh(); }; });
      if (st.calcMode === 'calc') mountCalc(root); else mountWork(root);
    }
  };
})();
