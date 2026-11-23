/* Chil: Privacy policy and data protection agreement. Shown once at first launch; again only if POLICY_VERSION changes. */
(function () {
  var C = window.Chil, U = C.U, A = C.A;
  var KEY = 'chil.priv', VERSION = '1';
  var DATE = '23 November 2026';

  var SUMMARY = ['Your records stay on your phone. Chil has no account and no server that holds your data.',
    'The seller cannot see your messages, customers or amounts.',
    'You are responsible for the data of your customers and members, and for keeping backups safe.',
    'Chil only shares your Device ID with the seller, when you choose to send it, to make your activation code.'];

  var SECTIONS = [
    ['1. Who we are', 'Chil is a money tracking app sold by the seller named in the app (the "Seller"). In this policy, "you" means the person using Chil, and "Chil" means the app and the Seller.'],
    ['2. What Chil handles', 'The M-Pesa messages you paste in, the amounts, names and phone numbers inside them, the categories you choose, your business rows, debts, cash entries, shop name and settings. This can include personal data of other people, such as your customers, members, debtors and creditors.'],
    ['3. Where data is kept', 'All of this is stored on your phone, in the browser storage used by the app. It is not sent to the Seller or to any server by Chil. The app works offline.'],
    ['4. What the Seller can see', 'Only what you choose to send: your Device ID (to make an activation code), your WhatsApp message, and any backup or screenshot you send for help. The activation code carries your plan type and end date only.'],
    ['5. Why data is used', 'To read your messages, calculate balances and reports, and show them to you. Chil does not sell data, show adverts, or build profiles.'],
    ['6. Your customers and members', 'When Chil holds personal data about other people, you are the person who decides how it is used (the "data controller") under the Kenya Data Protection Act, 2019. Use it only for your business or group, keep it accurate, do not share it without a lawful reason, and respect requests from those people to see or correct their data. The Seller does not receive this data and is not its controller or processor.'],
    ['7. Backups and sharing', 'Backups, Excel files and printed reports leave the app when you save or send them. Once outside Chil, you are responsible for protecting them. Use the PIN lock and keep your phone secure.'],
    ['8. Keeping and deleting data', 'Data stays on your phone until you delete it, use "Erase everything", clear browser data, or uninstall. Deleted data cannot be recovered by the Seller unless you have a backup.'],
    ['9. Security', 'You can set a PIN. Chil uses your phone\'s own protections. No system is perfectly secure: lost or shared phones can expose your records.'],
    ['10. Your rights', 'You may see, correct and delete your data at any time inside the app. For data held outside the app, you may contact the Seller. You may also complain to the Office of the Data Protection Commissioner in Kenya.'],
    ['11. Children', 'Chil is for adults and businesses. Do not enter children\'s personal data unless you have a lawful reason.'],
    ['12. Changes', 'If this policy changes in a way that matters, Chil will show it again and ask you to accept it. You can read it anytime in Settings.'],
    ['13. Agreement', 'By ticking the box and pressing Continue, you confirm that you have read this policy, you agree to it, and you will handle other people\'s data lawfully. Version ' + VERSION + ', dated ' + DATE + '.']
  ];

  function read() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function write() { try { localStorage.setItem(KEY, JSON.stringify({ v: VERSION, ts: new Date().toISOString() })); return true; } catch (e) { return false; } }
  function fullHTML() { return SECTIONS.map(function (s) { return '<h4>' + U.esc(s[0]) + '</h4><p style="margin:0">' + U.esc(s[1]) + '</p>'; }).join(''); }

  A.privacy = {
    version: VERSION,
    accepted: function () { var p = read(); return !!(p && p.v === VERSION); },
    // First launch / policy changed: summary, scroll box, tick, Continue.
    screen: function (done) {
      var upd = !!read();
      A.screen('', '<div class="pad"><div class="center" style="margin:6px 0 10px">' + C.Logo.lockup(40, 28) + '</div>' +
        '<h2>' + (upd ? 'Our policy has changed' : 'Your privacy') + '</h2>' +
        '<ul style="padding-left:18px;margin:6px 0">' + SUMMARY.map(function (x) { return '<li style="margin:4px 0">' + U.esc(x) + '</li>'; }).join('') + '</ul>' +
        '<p class="hint" style="margin:8px 0 4px">Scroll to the bottom to read the full policy.</p>' +
        '<div class="pv-box" id="pv-box" tabindex="0">' + fullHTML() + '<p class="hint" style="margin-top:14px">— End of policy —</p></div>' +
        '<label class="pv-chk"><input type="checkbox" id="pv-tick" disabled><span>I have read and agree to the Privacy Policy and Data Protection Agreement.</span></label>' +
        '<button class="btn block" id="pv-go" disabled>Continue</button>' +
        '<p class="hint center" id="pv-note">Scroll down to unlock the tick box.</p>' +
        '<button class="btn ghost block" id="pv-no" style="margin-top:8px">I do not agree</button></div>', function (root) {
        var box = U.$('#pv-box', root), tick = U.$('#pv-tick', root), go = U.$('#pv-go', root), note = U.$('#pv-note', root);
        function atEnd() { return box.scrollTop + box.clientHeight >= box.scrollHeight - 6; }
        function check() { if (atEnd()) { tick.disabled = false; note.textContent = 'Tick the box, then press Continue.'; } }
        box.onscroll = check; check();
        tick.onchange = function () { go.disabled = !tick.checked; };
        go.onclick = function () { if (!tick.checked) return; write(); A.clearScreen(); done(); };
        U.$('#pv-no', root).onclick = function () { note.textContent = 'Chil cannot be used without agreeing. You can close the app.'; };
      });
    },
    // Read again from Settings.
    show: function () {
      var p = read();
      A.sheet('<div class="row"><h2 class="grow" style="margin:0">Privacy policy</h2><button class="btn small ghost" id="pv-close">Close</button></div><p class="hint">Version ' + VERSION + (p ? ' · agreed ' + U.esc(String(p.ts).slice(0, 10)) : '') + '</p><div class="pv-box" style="height:50vh">' + fullHTML() + '</div>', function (b) { U.$('#pv-close', b).onclick = A.closeSheet; });
    }
  };
})();
