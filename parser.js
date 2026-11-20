/* Chil message reader: turns pasted M-Pesa messages into records. Works in the app and in Node tests. */
(function (root) {
  var AMT = '([\\d,]+(?:\\.\\d+)?)';
  var DATE = '(\\d{1,2}\\/\\d{1,2}\\/\\d{2,4})';
  var TIME = '(\\d{1,2}:\\d{2}\\s*[AP]M)';
  var CODE = '([A-Z0-9]{10})';
  var CONF = ' confirmed[.,]?\\s*';

  function num(s) { return parseFloat(String(s).replace(/,/g, '')); }

  function cleanName(s) {
    s = String(s).replace(/\s+/g, ' ').trim();
    s = s.replace(/\s+for account\s+.*$/i, '').trim();      // paybill: keep only the business name
    s = s.replace(/\s+[\d*]{8,}$/, '').trim();               // drop a trailing phone number
    return s.toLowerCase().replace(/(^|[\s'\-\/])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); });
  }

  function when(d, t) {
    var p = d.split('/');
    var yy = p[2].length === 2 ? '20' + p[2] : p[2];
    var iso = yy + '-' + ('0' + p[1]).slice(-2) + '-' + ('0' + p[0]).slice(-2);
    var m = t.replace(/\s+/g, '').match(/(\d{1,2}):(\d{2})([AP]M)/i);
    var h = parseInt(m[1], 10) % 12;
    if (m[3].toUpperCase() === 'PM') h += 12;
    var hhmm = ('0' + h).slice(-2) + ':' + m[2];
    return { date: iso, time: hhmm, ts: iso + 'T' + hhmm };
  }

  // verified:false means the wording was not in the samples we tested; the app shows a "check" flag on these rows.
  var RULES = [
    { kind: 'received', verified: true,
      re: new RegExp('^' + CODE + CONF + 'You have received Ksh' + AMT + ' from (.+?) on ' + DATE + ' (?:at )?' + TIME + '\\s*\\.*\\s*New (Pochi|M-PESA) balance is Ksh' + AMT, 'i'),
      build: function (m) {
        var w = when(m[4], m[5]);
        var pochi = /pochi/i.test(m[6]);
        return { code: m[1], dir: 'in', amount: num(m[2]), fee: 0, name: cleanName(m[3]),
          account: pochi ? 'Pochi' : 'M-PESA', balance: num(m[7]),
          bucket: 'business', auto: true, tag: null, date: w.date, time: w.time, ts: w.ts };
      } },
    { kind: 'sent', verified: true,
      re: new RegExp('^' + CODE + CONF + 'Ksh' + AMT + ' sent to (.+?) on ' + DATE + ' at ' + TIME + '\\s*\\.*\\s*New (Pochi|M-PESA) balance is Ksh' + AMT + '\\.?\\s*Transaction cost, Ksh' + AMT, 'i'),
      build: function (m) {
        var w = when(m[4], m[5]);
        return { code: m[1], dir: 'out', amount: num(m[2]), fee: num(m[8]), name: cleanName(m[3]),
          account: /pochi/i.test(m[6]) ? 'Pochi' : 'M-PESA', balance: num(m[7]), bucket: 'personal', auto: true, tag: null, date: w.date, time: w.time, ts: w.ts };
      } },
    { kind: 'airtime', verified: true,
      re: new RegExp('^' + CODE + CONF + 'You bought Ksh' + AMT + ' of airtime on ' + DATE + ' at ' + TIME + '\\s*\\.?\\s*New M-PESA balance is Ksh' + AMT + '\\.?\\s*Transaction cost, Ksh' + AMT, 'i'),
      build: function (m) {
        var w = when(m[3], m[4]);
        return { code: m[1], dir: 'out', amount: num(m[2]), fee: num(m[6]), name: 'Airtime',
          account: 'M-PESA', balance: num(m[5]), bucket: 'personal', auto: true, tag: 'Airtime', date: w.date, time: w.time, ts: w.ts };
      } },
    { kind: 'own-transfer', verified: true,
      re: new RegExp('^' + CODE + CONF + 'Ksh' + AMT + ' has been moved from your Pochi account to your M-PESA account on ' + DATE + ' at ' + TIME + '\\s*\\.*\\s*New Pochi balance is Ksh' + AMT + '\\.?\\s*New M-PESA balance is Ksh' + AMT, 'i'),
      build: function (m) {
        var w = when(m[3], m[4]);
        return { code: m[1], dir: 'own', amount: num(m[2]), fee: 0, name: 'Pochi to M-PESA',
          account: 'Both', balance: num(m[6]), pochiBal: num(m[5]), bucket: null, tag: null, date: w.date, time: w.time, ts: w.ts };
      } },
    // Till and shop payments: "Ksh100.00 paid to NAME. on ..." (from M-PESA or Pochi)
    { kind: 'paid', verified: true,
      re: new RegExp('^' + CODE + CONF + 'Ksh' + AMT + ' paid to (.+?)\\.?\\s+on ' + DATE + ' at ' + TIME + '\\s*\\.*\\s*New (Pochi|M-PESA) balance is Ksh' + AMT + '\\.?\\s*Transaction cost, Ksh' + AMT, 'i'),
      build: function (m) {
        var w = when(m[4], m[5]);
        return { code: m[1], dir: 'out', amount: num(m[2]), fee: num(m[8]), name: cleanName(m[3]),
          account: /pochi/i.test(m[6]) ? 'Pochi' : 'M-PESA', balance: num(m[7]), bucket: 'personal', auto: true, tag: null, date: w.date, time: w.time, ts: w.ts };
      } },
    // Cash withdrawal at an agent: moves money out of M-PESA into cash, so only the fee is an expense.
    { kind: 'withdrawal', verified: false,
      re: new RegExp('^' + CODE + CONF + 'on ' + DATE + ' at ' + TIME + '\\s*Withdraw Ksh' + AMT + ' from (.+?)\\s+New M-PESA balance is Ksh' + AMT + '\\.?\\s*Transaction cost, Ksh' + AMT, 'i'),
      build: function (m) {
        var w = when(m[2], m[3]);
        return { code: m[1], dir: 'own', amount: num(m[4]), fee: num(m[7]), name: 'Cash withdrawal',
          account: 'M-PESA', balance: num(m[6]), bucket: null, tag: null, date: w.date, time: w.time, ts: w.ts };
      } }
  ];

  var SKIP = [
    { why: 'Failed send (not enough balance)', re: /^failed\./i },
    { why: 'Cancelled request', re: /^you have cancelled/i },
    { why: 'Account activation notice', re: /^to activate your m-pesa/i }
  ];


  // Safety net: any other message that clearly says money was received, sent or paid is still saved (flagged "check")
  // instead of being dropped. Own-money moves and withdrawals are never guessed.
  function generic(msg) {
    if (!/^[A-Z0-9]{10} confirmed/i.test(msg)) return null;
    if (/moved from|withdraw|you bought|airtime|failed|cancel/i.test(msg)) return null;
    var code = msg.slice(0, 10).toUpperCase(), a, dir, name;
    var rin = msg.match(/received ksh\s?([\d,]+(?:\.\d+)?)\s+from\s+(.+?)\s+on\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
    var rout = msg.match(/ksh\s?([\d,]+(?:\.\d+)?)\s+(?:sent to|paid to|paid for)\s+(.+?)\s+on\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
    var m = rin || rout;
    if (!m) return null;
    dir = rin ? 'in' : 'out';
    var tm = msg.slice(msg.indexOf(m[3])).match(/(\d{1,2}:\d{2}\s*[AP]M)/i);
    if (!tm) return null;
    var w = when(m[3], tm[1]);
    var fee = msg.match(/transaction cost,?\s*ksh\s?([\d,]+(?:\.\d+)?)/i);
    var bal = msg.match(/new (pochi|m-pesa) balance is ksh\s?([\d,]+(?:\.\d+)?)/i);
    return { code: code, dir: dir, amount: num(m[1]), fee: fee ? num(fee[1]) : 0, name: cleanName(m[2]),
      account: bal ? (/pochi/i.test(bal[1]) ? 'Pochi' : 'M-PESA') : 'M-PESA', balance: bal ? num(bal[2]) : null,
      bucket: dir === 'in' ? 'business' : 'personal', auto: true, tag: null, date: w.date, time: w.time, ts: w.ts,
      kind: dir === 'in' ? 'other-in' : 'other-out', check: true };
  }

  // Cut pasted text into one string per message, even when one message wraps over several lines.
  function split(text) {
    var out = [];
    String(text).split(/\r?\n/).forEach(function (line) {
      var t = line.trim();
      if (!t) return;
      var starts = new RegExp('^' + CODE + ' confirmed', 'i').test(t) || SKIP.some(function (s) { return s.re.test(t); });
      if (starts || out.length === 0) out.push(t);
      else out[out.length - 1] += ' ' + t;
    });
    return out;
  }

  // sim is 1 or 2.
  function parseMessages(text, sim) {
    var records = [], skipped = [], unrecognised = [];
    split(text).forEach(function (msg) {
      var done = false;
      for (var i = 0; i < RULES.length && !done; i++) {
        var m = msg.match(RULES[i].re);
        if (m) {
          var r = RULES[i].build(m);
          r.kind = RULES[i].kind; r.sim = sim || 1;
          if (!RULES[i].verified) r.check = true;
          records.push(r); done = true;
        }
      }
      if (done) return;
      var g = generic(msg);
      if (g) { g.sim = sim || 1; records.push(g); return; }
      for (var j = 0; j < SKIP.length; j++) {
        if (SKIP[j].re.test(msg)) { skipped.push({ why: SKIP[j].why, text: msg }); return; }
      }
      unrecognised.push(msg); // never dropped silently: shown to the user
    });
    return { records: records, skipped: skipped, unrecognised: unrecognised };
  }

  // The M-Pesa code is the identity of a record, so pasting the same message twice adds nothing.
  function mergeNew(existing, incoming) {
    var seen = {};
    existing.forEach(function (r) { seen[r.code] = true; });
    var added = [], dupes = 0;
    incoming.forEach(function (r) {
      if (seen[r.code]) { dupes++; return; }
      seen[r.code] = true; added.push(r);
    });
    return { all: existing.concat(added), added: added, duplicates: dupes };
  }

  // Money in, money out (including all fees), and own-money moves (not counted).
  function totals(records) {
    var t = { inn: 0, out: 0, fees: 0, own: 0 };
    records.forEach(function (r) {
      if (r.dir === 'in') t.inn += r.amount;
      else if (r.dir === 'out') { t.out += r.amount + (r.fee || 0); t.fees += (r.fee || 0); }
      else { t.own += r.amount; t.out += (r.fee || 0); t.fees += (r.fee || 0); }
    });
    t.inn = Math.round(t.inn * 100) / 100; t.out = Math.round(t.out * 100) / 100;
    t.fees = Math.round(t.fees * 100) / 100; t.own = Math.round(t.own * 100) / 100;
    return t;
  }

  var api = { parseMessages: parseMessages, mergeNew: mergeNew, totals: totals, split: split };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.Chil = root.Chil || {}; root.Chil.Parser = api; }
})(typeof window !== 'undefined' ? window : this);
