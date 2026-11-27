/* Chil: the More page. Customers, Debtors and creditors, Calculator, Search, Settings. */
(function () {
  var C = window.Chil, U = C.U, S = C.Store, A = C.A;
  function item(tab, icon, title, sub) {
    return '<button class="menu-it" data-go="' + tab + '"><span class="mi">' + A.IC[icon] + '</span><span class="grow"><b>' + U.esc(title) + '</b><small>' + U.esc(sub) + '</small></span><span class="chev">›</span></button>';
  }
  A.V.menu = {
    html: function () {
      var d = A.debtTotals('owed'), c = A.debtTotals('owe');
      var names = {}; S.D.tx.forEach(function (r) { if (r.dir === 'in') names[U.key(r.name)] = 1; });
      var nc = Object.keys(names).length;
      return '<h1 class="page-title">More</h1>' +
        item('customers', 'people', 'Customers', nc ? nc + (nc === 1 ? ' person' : ' people') + ' ranked by what they spent' : 'Ranked by what they spent') +
        item('debts', 'debt', 'Debtors and creditors', 'Creditors owe you KSh ' + U.money(d.open) + ' · you owe debtors KSh ' + U.money(c.open)) +
        item('bank', 'bank', 'Money in bank', 'Bank balances and cash taken to bank') +
        item('spend', 'spend', 'Expenditure', 'All your money out, by category') +
        item('calc', 'calc', 'Calculator', 'Quick sums') +
        item('search', 'search', 'Search', 'Names, amounts, categories, codes') +
        item('help', 'help', 'Help and FAQ', 'Guide, answers, quiz') +
        item('more', 'gear', 'Settings', 'Shop, PIN, backup, subscription') +
        '<div class="gap"></div>' + (A.helpBanner ? A.helpBanner() : '');
    },
    mount: function (root) { U.$$('[data-go]', root).forEach(function (b) { b.onclick = function () { A.go(b.getAttribute('data-go')); }; }); }
  };
})();
