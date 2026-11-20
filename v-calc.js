/* Chil: Calculator (on its own). The old Workings page was replaced by Business evaluation in 1.0.1. */
(function () {
  var C = window.Chil, U = C.U, A = C.A, E = C.Calc;
  var expr = '';

  function resultText() {
    if (!expr) return '0';
    var v = E.evalExpr(expr);
    return v == null ? '…' : U.money(v);
  }

  A.V.calc = {
    html: function () {
      var keys = [['C', 'cl'], ['(', 'op'], [')', 'op'], ['⌫', 'op'],
        ['7'], ['8'], ['9'], ['÷', 'op'], ['4'], ['5'], ['6'], ['×', 'op'], ['1'], ['2'], ['3'], ['−', 'op'], ['0'], ['.'], ['%', 'op'], ['+', 'op']];
      return '<h1 class="page-title">Calculator</h1><div class="calc"><div class="disp"><div class="expr" id="c-expr">' + U.esc(expr || ' ') + '</div><div class="res num" id="c-res">' + resultText() + '</div></div>' +
        '<div class="keys">' + keys.map(function (k) { return '<button class="' + (k[1] || '') + '" data-k="' + k[0] + '" aria-label="' + k[0] + '">' + k[0] + '</button>'; }).join('') +
        '<button class="eq" data-k="=" style="grid-column:span 4">=</button></div></div>' +
        '<button class="btn ghost block" id="c-copy">Copy result</button>' +
        '<p class="hint center">Tip: 1000+16% gives 1,160. Use it for VAT, discounts and profit. For stock and sales, use the Business tab.</p>';
    },
    mount: function (root) {
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
      U.$('#c-copy', root).onclick = function () {
        var v = E.evalExpr(expr);
        if (v == null) { U.toast('Nothing to copy yet'); return; }
        try { navigator.clipboard.writeText(String(v)); U.toast('Copied ' + U.money(v)); } catch (e) { U.toast('Could not copy'); }
      };
    }
  };
})();
