/* Chil: Help. Guide through each tab, FAQ, what to do if something goes wrong, and a short quiz. */
(function () {
  var C = window.Chil, U = C.U, A = C.A;
  var st = A.st; st.hp = st.hp || { sec: 'guide', open: {}, quiz: null };

  var GUIDE = [
    ['Money', 'Open Money and tap +. Paste your M-Pesa and bank messages (copy them from your Messages app) and tap Read. Chil lists each one as money in or money out. For every item choose Business or Personal and a category tag (money out sent to Savings needs no tag). At the top, type your cash when you open and your cash when you close. Chil works out the cash sales. Add any cash you spent with Cash used, and any cash you put in the bank with Cash taken to bank.'],
    ['Money in bank (More)', 'Shows each bank account, its balance from your latest bank message, and the bank money in and out. Tap Cash taken to bank to record cash you deposited. That lowers your cash in hand and raises the bank. Tap Set to type a balance yourself.'],
    ['Summary', 'Shows how much came in, how much went out, and what is left, for a day, a month or a range. Use it to compare periods and see which categories took your money.'],
    ['Business', 'Shows sales, profit and a balance sheet built from your messages and your Business rows. Add stock bought and other business costs that M-Pesa does not show. Type your stock value yourself when you count it. Capital is the money you started with.'],
    ['Customers (More)', 'Everyone who paid you by M-Pesa, ranked by total spent. Tap a name to see payments. Print or save a report for one customer or all customers. Family and friends can be hidden.'],
    ['Debtors and creditors (More)', 'Creditors are people who owe you. Debtors are people you owe. Add the amount, a due date and record each payment. Long-press a row to select several and copy them.'],
    ['Expenditure (More)', 'All your money out in one place: grouped Business, Personal, Savings, then by category with totals. Tap a category to see when and on what. Choose a month or all time, then print or save to Excel.'],
    ['Calculator and Search (More)', 'Calculator is for quick sums. Search finds names, amounts, categories and M-Pesa codes.'],
    ['Settings (More)', 'Shop name, PIN lock, backup and restore, close shop, your subscription and activation code, and the privacy policy.']
  ];
  var FAQ = [
    ['Does Chil need internet?', 'No. After the first open, Chil works offline. Everything is saved on your phone.'],
    ['Where is my data kept?', 'Only on your phone. The seller cannot see it. That is why backups matter.'],
    ['How do I add M-Pesa messages?', 'Copy the messages in your Messages app, open Money, tap +, paste, tap Read, then Save.'],
    ['Why must I choose a category?', 'Categories power your Customers report, Expenditure report and Summary. Items without one show as "No category".'],
    ['What happens when I deposit or withdraw cash at an agent?', 'A deposit moves your cash into M-Pesa. A withdrawal moves M-Pesa into cash. It is your own business money moving, so it is not a sale or an expense. Only the transaction cost counts as an expense.'],
    ['How do cash sales work?', 'Cash sales = closing cash − opening cash + cash used + deposits to M-Pesa − withdrawals + cash taken to bank. Type your opening and closing cash every day.'],
    ['A bank message was not read', 'Banks word messages differently. Chil marks bank records with "check". Compare the amount with your bank app. Send the message to the seller on WhatsApp so it can be added.'],
    ['What if I move money from M-Pesa to my bank?', 'If the bank message shows the credit and the M-Pesa message shows the same amount sent, Chil matches them as your own money. Otherwise open the record and tick "This is my own money moving between my accounts".'],
    ['I got a new phone. What do I do?', 'On the old phone: Settings, Backup. Send the file to yourself. On the new phone: open Chil, Settings, Restore. Your activation code is tied to the old phone, so message the seller with your new Device ID.'],
    ['What is a Device ID?', 'A number that identifies this phone. The seller uses it to make your activation code, which works only on this phone.'],
    ['What happens when my subscription ends?', 'You get a warning before it ends and one day of grace. After that the app locks until you enter a new code. Your data is not deleted.'],
    ['Can two phones use one code?', 'No. A code works only on the phone it was made for.'],
    ['I forgot my PIN.', 'Contact the seller on WhatsApp from Help. Restoring a backup on a fresh install also removes the PIN.'],
    ['How do I print a report?', 'Tap Print report on Customers or Expenditure, then choose Save as PDF or a printer.'],
    ['How do I close the app completely?', 'Settings, Close shop, then Done.']
  ];
  var WRONG = [
    ['A message was not read', 'Make sure you pasted the full M-Pesa message. Send us a sample on WhatsApp if it keeps failing.'],
    ['Numbers look wrong after adding messages', 'Check for duplicates (Chil skips repeated codes) and that your opening and closing cash are typed for each day. Use Search to find an item.'],
    ['The app says it is locked or the clock is wrong', 'Set your phone date and time to automatic, then reopen Chil.'],
    ['The app looks old after an update', 'Close it fully and open it again once while online. If needed, clear the site data in your browser, but make a backup first.'],
    ['I deleted something by mistake', 'Restore your last backup. This is why you should back up every week.'],
    ['Nothing helps', 'Tap the WhatsApp button below and send your Device ID and a short description.']
  ];
  var QUIZ = [
    ['Where is your data stored?', ['On the seller\'s server', 'Only on your phone', 'On M-Pesa'], 1],
    ['Creditors are people who...', ['owe you money', 'you owe money', 'work for you'], 0],
    ['What must you pick for each money-in or money-out item?', ['Business or Personal and a category', 'Only the date', 'Nothing'], 0],
    ['Cash you give an agent to put on M-Pesa is...', ['A sale', 'An expense', 'Your own money moving'], 2],
    ['Before changing phones you should...', ['Delete the app', 'Make a backup', 'Turn off M-Pesa'], 1],
    ['A code made for one phone works on...', ['Any phone', 'Only that phone', 'Two phones'], 1]
  ];

  function acc(list, key) {
    return list.map(function (x, i) {
      var k = key + i, o = !!st.hp.open[k];
      return '<div class="card hp-q" data-k="' + k + '" style="padding:0"><button class="menu-it hp-h" style="width:100%"><span class="grow"><b>' + U.esc(x[0]) + '</b></span><span class="chev">' + (o ? '▲' : '▼') + '</span></button>' +
        (o ? '<p style="padding:0 14px 14px;margin:0">' + U.esc(x[1]) + '</p>' : '') + '</div>';
    }).join('');
  }
  function quizHTML() {
    var q = st.hp.quiz || (st.hp.quiz = { i: 0, score: 0, picked: null });
    if (q.i >= QUIZ.length) {
      return '<div class="card center"><h3>Quiz done</h3><p class="num" style="font-size:28px"><b>' + q.score + ' / ' + QUIZ.length + '</b></p><p class="mute">' + (q.score === QUIZ.length ? 'Excellent. You know Chil well.' : 'Read the Guide and FAQ, then try again.') + '</p><button class="btn" id="hp-again">Try again</button></div>';
    }
    var it = QUIZ[q.i];
    return '<div class="card"><small class="mute">Question ' + (q.i + 1) + ' of ' + QUIZ.length + '</small><h3>' + U.esc(it[0]) + '</h3>' +
      it[1].map(function (o, n) {
        var cls = 'btn ghost block hp-opt';
        if (q.picked != null) cls += n === it[2] ? ' hp-right' : (n === q.picked ? ' hp-wrong' : '');
        return '<button class="' + cls + '" data-n="' + n + '" style="margin-top:8px;text-align:left"' + (q.picked != null ? ' disabled' : '') + '>' + U.esc(o) + (q.picked != null && n === it[2] ? ' ✓' : '') + '</button>';
      }).join('') +
      (q.picked != null ? '<p class="hint">' + (q.picked === it[2] ? 'Correct.' : 'Not quite. The right answer is marked.') + '</p><button class="btn" id="hp-next">' + (q.i + 1 === QUIZ.length ? 'See result' : 'Next') + '</button>' : '') + '</div>';
  }

  A.V.help = {
    html: function () {
      var s = st.hp.sec, tabs = [['guide', 'Guide'], ['faq', 'FAQ'], ['wrong', 'Problems'], ['quiz', 'Quiz']];
      var h = '<h1 class="page-title">Help and FAQ</h1><div class="seg">' + tabs.map(function (t) { return '<button data-s="' + t[0] + '" class="' + (s === t[0] ? 'on' : '') + '">' + t[1] + '</button>'; }).join('') + '</div>';
      if (s === 'guide') h += '<p class="mute">A short walk through each tab.</p>' + acc(GUIDE, 'g');
      else if (s === 'faq') h += acc(FAQ, 'f');
      else if (s === 'wrong') h += '<p class="mute">If something goes wrong, try these first.</p>' + acc(WRONG, 'w');
      else h += quizHTML();
      return h + '<div class="gap"></div>' + (A.helpBanner ? A.helpBanner() : '');
    },
    mount: function (root) {
      U.$$('[data-s]', root).forEach(function (b) { b.onclick = function () { st.hp.sec = b.getAttribute('data-s'); A.refresh(); }; });
      U.$$('.hp-q', root).forEach(function (c) { U.$('.hp-h', c).onclick = function () { var k = c.getAttribute('data-k'); st.hp.open[k] = !st.hp.open[k]; A.refresh(); }; });
      var q = st.hp.quiz;
      U.$$('.hp-opt', root).forEach(function (b) { b.onclick = function () { var n = +b.getAttribute('data-n'); q.picked = n; if (n === QUIZ[q.i][2]) q.score++; A.refresh(); }; });
      var nx = U.$('#hp-next', root); if (nx) nx.onclick = function () { q.i++; q.picked = null; A.refresh(); };
      var ag = U.$('#hp-again', root); if (ag) ag.onclick = function () { st.hp.quiz = null; A.refresh(); };
    }
  };
})();
