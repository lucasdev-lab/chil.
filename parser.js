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
      } },
    // Cash deposit at an agent (real sample): "On 25/11/26 at 8:31 PM Give Ksh100.00 cash to AGENT New M-PESA balance is Ksh119.53."
    // Your cash becomes M-Pesa. It is your own business money moving, so it is not income. Cash in hand goes down.
    { kind: 'deposit', verified: true,
      re: new RegExp('^' + CODE + CONF + 'on ' + DATE + ' at ' + TIME + '\\s*Give Ksh' + AMT + ' cash to (.+?)\\s+New M-PESA balance is Ksh' + AMT, 'i'),
      build: function (m) {
        var w = when(m[2], m[3]);
        return { code: m[1], dir: 'own', amount: num(m[4]), fee: 0, name: 'Cash deposit', account: 'M-PESA', balance: num(m[6]),
          bucket: 'business', tag: null, date: w.date, time: w.time, ts: w.ts };
      } },
    // Wordings from the Kenya SMS reference sheet (not yet seen in real messages, so they carry a "check" flag).
    { kind: 'deposit', verified: false,
      re: new RegExp('^' + CODE + CONF + 'Ksh' + AMT + ' deposited to your M-PESA account on ' + DATE + ' (?:at )?' + TIME + '\\s*\\.*\\s*New M-PESA balance is Ksh' + AMT, 'i'),
      build: function (m) {
        var w = when(m[3], m[4]);
        return { code: m[1], dir: 'own', amount: num(m[2]), fee: 0, name: 'Cash deposit', account: 'M-PESA', balance: num(m[5]),
          bucket: 'business', tag: null, date: w.date, time: w.time, ts: w.ts };
      } },
    { kind: 'withdrawal', verified: false,
      re: new RegExp('^' + CODE + CONF + 'Ksh' + AMT + ' withdrawn from (.+?) on ' + DATE + ' (?:at )?' + TIME + '\\s*\\.*\\s*New M-PESA balance is Ksh' + AMT + '\\.?(?:\\s*Transaction cost, Ksh' + AMT + ')?', 'i'),
      build: function (m) {
        var w = when(m[4], m[5]);
        return { code: m[1], dir: 'own', amount: num(m[2]), fee: m[8] ? num(m[8]) : 0, name: 'Cash withdrawal', account: 'M-PESA', balance: num(m[6]),
          bucket: null, tag: null, date: w.date, time: w.time, ts: w.ts };
      } },
    { kind: 'received', verified: false,
      re: new RegExp('^' + CODE + CONF + 'Ksh' + AMT + ' received from (.+?)(?: for (.+?))? on ' + DATE + ' (?:at )?' + TIME + '\\s*\\.*\\s*(?:New (?:Pochi|M-PESA|business|Business)[^K]*Ksh' + AMT + ')?', 'i'),
      build: function (m) {
        var w = when(m[5], m[6]);
        return { code: m[1], dir: 'in', amount: num(m[2]), fee: 0, name: cleanName(m[3]), account: 'M-PESA', balance: m[7] ? num(m[7]) : null,
          bucket: 'business', auto: true, tag: null, date: w.date, time: w.time, ts: w.ts };
      } },
    { kind: 'reversal', verified: false,
      re: new RegExp('^' + CODE + '\\s+(?:confirmed[.,]?\\s*)?(?:Reversal|Refund) of Ksh' + AMT + '.*?(?:credited|returned).*? on ' + DATE + ' (?:at )?' + TIME + '.*?(?:balance(?: is)?\\s*Ksh' + AMT + ')?', 'i'),
      build: function (m) {
        var w = when(m[3], m[4]);
        return { code: m[1], dir: 'in', amount: num(m[2]), fee: 0, name: 'Reversal', account: 'M-PESA', balance: m[5] ? num(m[5]) : null,
          bucket: 'business', auto: true, tag: 'Refund', date: w.date, time: w.time, ts: w.ts };
      } },
    // Airtel Money (structure from the reference sheet, unverified)
    { kind: 'airtel', verified: false,
      re: new RegExp('^' + CODE + '\\s+(?:SUCCESS|CONFIRMED)\\.?\\s*You have (sent|received) Ksh' + AMT + ' (?:to|from) (.+?) on ' + DATE + ' (?:at )?' + TIME + '\\.?\\s*(?:Transaction fee,? Ksh' + AMT + '\\.?\\s*)?(?:New )?Airtel Money balance (?:is )?Ksh' + AMT, 'i'),
      build: function (m) {
        var w = when(m[5], m[6]), out = /sent/i.test(m[2]);
        return { code: m[1], dir: out ? 'out' : 'in', amount: num(m[3]), fee: m[7] ? num(m[7]) : 0, name: cleanName(m[4]), account: 'Airtel', balance: num(m[8]),
          bucket: out ? 'personal' : 'business', auto: true, tag: null, date: w.date, time: w.time, ts: w.ts };
      } }
  ];

  var SKIP = [
    { why: 'Failed send (not enough balance)', re: /^failed\./i },
    { why: 'Cancelled request', re: /^you have cancelled/i },
    { why: 'Account activation notice', re: /^to activate your m-pesa/i },
    { why: 'Fuliza notice (a loan, not counted as money in or out)', re: /fuliza m-?pesa/i },
    { why: 'Information only (pending, failed or ready for pickup)', re: /\b(pending|is being processed|ready for collection|status\s*\[?(?:pending|failed|ready))/i }
  ];


  // Safety net: any other message that clearly says money was received, sent or paid is still saved (flagged "check")
  // instead of being dropped. Own-money moves and withdrawals are never guessed.
  function generic(msg) {
    if (!/^[A-Z0-9]{10} confirmed/i.test(msg)) return null;
    if (/moved from|withdraw|give ksh|cash to|deposited|you bought|airtime|failed|cancel/i.test(msg)) return null;
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


  /* ---------- bank messages (no M-Pesa code at the start). Banks word these differently, so this reads key words and flags every
     bank record "check" until you confirm it. Anything it cannot read is shown to you, never guessed. ---------- */
  var BANKS = ['KCB', 'Equity', 'Co-operative', 'Co-op', 'NCBA', 'Absa', 'Standard Chartered', 'Stanbic', 'DTB', 'I&M', 'Family Bank', 'National Bank',
    'Citibank', 'Prime Bank', 'Bank of Baroda', 'Bank of India', 'Ecobank', 'Sidian', 'Access Bank', 'Gulf African', 'M-Oriental', 'Victoria', 'Development Bank', 'SBM'];
  var KES = '(?:KES|KSHS?|KSH|KShs?)\\.?\\s?';
  function isBankStart(t) {
    if (new RegExp('^' + CODE + ' ', 'i').test(t)) return false;
    return new RegExp('^(?:' + BANKS.map(function (b) { return b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')\\b', 'i').test(t) ||
      /^(?:dear customer|your account|account|a\/c|acct|bank)\b/i.test(t);
  }
  function fnv(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; }
    return ('00000000' + h.toString(16)).slice(-8).toUpperCase();
  }
  var MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  function p2(n) { return ('0' + n).slice(-2); }
  function bankWhen(msg) {
    var y, mo, d, m;
    if ((m = msg.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/))) { d = +m[1]; mo = +m[2]; y = +m[3]; }
    else if ((m = msg.match(/(\d{4})-(\d{2})-(\d{2})/))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else if ((m = msg.match(/(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?,?\s+(\d{2,4})/)) && MON[m[2].toLowerCase()]) { d = +m[1]; mo = MON[m[2].toLowerCase()]; y = +m[3]; }
    else return null;
    if (y < 100) y += 2000;
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    var iso = y + '-' + p2(mo) + '-' + p2(d), hh = '00:00', t = msg.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*([AP]M)?/i);
    if (t) { var h = +t[1]; if (t[3]) { h = h % 12; if (/pm/i.test(t[3])) h += 12; } hh = p2(h) + ':' + t[2]; }
    return { date: iso, time: hh, ts: iso + 'T' + hh };
  }
  function bank(msg) {
    if (new RegExp('^' + CODE + ' ', 'i').test(msg)) return null;
    if (!/(credited|debited|deposit|withdraw|transfer|received|sent to|card ending|cheque|atm|purchase|charge|interest|reversed|refund|paid)/i.test(msg)) return null;
    var am = msg.match(new RegExp(KES + AMT, 'i')); if (!am) return null;
    var amount = num(am[1]); if (!(amount > 0)) return null;
    var w = bankWhen(msg); if (!w) return null;
    var bn = ''; BANKS.forEach(function (b) { if (!bn && new RegExp('\\b' + b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(msg)) bn = b; });
    if (bn === 'Co-op') bn = 'Co-operative';
    var ac = msg.match(/\*{2,}\s?(\d{3,4})\b/) || msg.match(/\bx{2,}\s?(\d{3,4})\b/i) || msg.match(/ending\s+(\d{4})\b/i) || msg.match(/\b(?:a\/c|acc(?:ount)?)\s*(?:no\.?|number)?\s*:?\s*\d*?(\d{4})\b/i);
    var label = (bn || 'Bank') + (ac ? ' ****' + ac[1] : '');
    var bal = msg.match(new RegExp('balance(?:\\s+is)?\\s*[:\\-]?\\s*(?:' + KES + ')?' + AMT, 'i'));
    var fee = msg.match(new RegExp('(?:\\bfee|charge|charges|excise duty)\\s*[:\\-]?\\s*(?:' + KES + ')?' + AMT, 'i'));
    var nar = msg.match(/(?:narration\s*\/\s*reference|narration|reference|description)\s*[:\-]\s*([^.\n]{2,60}?)(?:\.\s|\s+(?:available|balance|ledger)|$)/i);
    var low = msg.toLowerCase(), dir, kind = 'bank', name = '', tag = null;
    var from = msg.match(/\bfrom\s+(?!account)(.{2,40}?)(?:\s+on\b|\s+at\b|\.|,|$)/i), to = msg.match(/\bto\s+(?!account|your)(.{2,40}?)(?:\s+on\b|\s+at\b|\.|,|\sref|$)/i);
    var mobile = /m-?pesa|mpesa|airtel|mobile|wallet|paybill|mpesa/i.test(msg);
    if (/atm/.test(low) && /withdraw/.test(low)) { dir = 'own'; kind = 'atm'; name = 'ATM withdrawal'; }
    else if (/card ending|pos\b|purchase|used for/.test(low)) { dir = 'out'; kind = 'card'; var at = msg.match(/\bat\s+(.{2,40}?)(?:\s+on\b|,|\.|$)/i); name = at ? at[1] : 'Card payment'; }
    else if (/(sms|ledger|maintenance|service|transfer)\s+(?:fee|charge)|bank charge|charges? for|excise/.test(low) && /debited|charged|deducted/.test(low)) { dir = 'out'; kind = 'charge'; name = 'Bank charge'; tag = 'Bank charges'; }
    else if (/interest/.test(low) && /credited|earned|paid/.test(low)) { dir = 'in'; kind = 'interest'; name = 'Interest'; tag = 'Interest'; }
    else if (/cheque|cash deposit|deposited/.test(low) && !/debited/.test(low)) { dir = 'in'; kind = 'bank-cash-deposit'; name = nar ? nar[1] : 'Deposit'; }
    else if (/credited|received|reversed|refund/.test(low) && !/debited/.test(low)) { dir = 'in'; kind = mobile ? 'from-mobile' : 'bank'; name = (from ? from[1] : nar ? nar[1] : 'Bank credit'); if (/reversed|refund/.test(low)) tag = 'Refund'; }
    else if (/debited|sent to|transfer of|paid|withdrawn|withdrawal/.test(low)) { dir = 'out'; kind = mobile ? 'to-mobile' : 'bank'; name = (to ? to[1] : nar ? nar[1] : 'Bank payment'); }
    else return null;
    name = cleanName(name);
    return { code: 'BK' + fnv(msg.replace(/\s+/g, ' ').trim().toLowerCase()), dir: dir, amount: amount, fee: fee && kind !== 'charge' ? num(fee[1]) : 0, name: name || 'Bank',
      account: label, bank: true, balance: bal ? num(bal[1]) : null, ref: nar ? nar[1].trim() : '', bucket: dir === 'in' ? 'business' : dir === 'out' ? 'personal' : null, auto: dir !== 'own',
      tag: tag, date: w.date, time: w.time, ts: w.ts, kind: kind, check: true, sim: 0 };
  }

  // Cut pasted text into one string per message, even when one message wraps over several lines.
  function split(text) {
    var out = [];
    String(text).split(/\r?\n/).forEach(function (line) {
      var t = line.trim();
      if (!t) return;
      var starts = new RegExp('^' + CODE + ' (?:confirmed|success|reversal|refund)', 'i').test(t) || isBankStart(t) || SKIP.some(function (s) { return s.re.test(t); });
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
      var bk = bank(msg);
      if (bk) { records.push(bk); return; }
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
