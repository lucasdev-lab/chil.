/* Chil calculator engine: safe expression evaluator (no eval). Works in the app and in Node tests. */
(function (root) {
  // Supports + - x / ( ) %, and "1000+16%" meaning 1000 plus 16 percent of 1000.
  function evalExpr(str) {
    if (!str) return null;
    var s = String(str).replace(/×|x|X|\*/g, '*').replace(/÷|\//g, '/').replace(/−|–/g, '-').replace(/,/g, '').replace(/\s+/g, '');
    if (!s) return null;
    var i = 0;
    function num() {
      var m = /^(\d*\.\d+|\d+\.?)/.exec(s.slice(i));
      if (!m) throw new Error('n');
      i += m[0].length;
      var v = parseFloat(m[0]);
      while (s[i] === '%') { v /= 100; i++; }
      return v;
    }
    var expr;
    function factor() {
      if (s[i] === '-') { i++; return -factor(); }
      if (s[i] === '+') { i++; return factor(); }
      if (s[i] === '(') {
        i++;
        var v = expr();
        if (s[i] !== ')') throw new Error('p');
        i++;
        while (s[i] === '%') { v /= 100; i++; }
        return v;
      }
      return num();
    }
    function term() {
      var v = factor();
      while (s[i] === '*' || s[i] === '/') {
        var o = s[i++];
        var r = factor();
        if (o === '*') v *= r;
        else { if (r === 0) throw new Error('z'); v /= r; }
      }
      return v;
    }
    expr = function () {
      var v = term();
      while (s[i] === '+' || s[i] === '-') {
        var o = s[i++];
        var start = i;
        var r = term();
        var pct = /^\d*\.?\d+%$/.test(s.slice(start, i));
        var rr = pct ? v * r : r;
        v = o === '+' ? v + rr : v - rr;
      }
      return v;
    };
    try {
      var v = expr();
      if (i !== s.length || !isFinite(v)) return null;
      return Math.round(v * 1e8) / 1e8;
    } catch (e) { return null; }
  }
  var api = { evalExpr: evalExpr };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.Chil = root.Chil || {}; root.Chil.Calc = api; }
})(typeof window !== 'undefined' ? window : this);
