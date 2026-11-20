/* Chil storage: everything lives on this phone, in localStorage. */
(function () {
  var C = window.Chil;
  var KEYS = { settings: 'chil.settings', tx: 'chil.tx', rules: 'chil.rules', biz: 'chil.biz', debts: 'chil.debts' };
  var DEFAULT_SETTINGS = {
    shopName: '', openAt: '', closeAt: '', days: [1, 2, 3, 4, 5, 6],
    openMsg: "Let's get to work. Make the day fruitful.",
    simNames: { 1: 'SIM 1', 2: 'SIM 2' },
    pin: null, autoLockMin: 2,
    recipients: [], selRecipient: null,
    reportOpts: { split: true, cat: true, work: true, debts: true },
    setupDone: false, lastBackup: null, customTags: [],
    closedDate: null, greetedDate: null, lastImportAt: null, installedAt: null, backupSnoozeUntil: null, v2: false
  };
  var D = { settings: null, tx: [], rules: {}, biz: { capital: null, rows: [] }, debts: [] };
  var warned = false;

  function read(k, def) {
    try {
      var v = localStorage.getItem(KEYS[k]);
      return v ? JSON.parse(v) : def;
    } catch (e) { return def; }
  }
  function write(k, v) {
    try { localStorage.setItem(KEYS[k], JSON.stringify(v)); return true; }
    catch (e) {
      if (!warned) { warned = true; C.U.toast('Could not save. Phone storage may be full or blocked.', 5000); }
      return false;
    }
  }

  function mergeSettings(s) {
    var out = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    Object.keys(s || {}).forEach(function (k) { out[k] = s[k]; });
    out.simNames = Object.assign({}, DEFAULT_SETTINGS.simNames, (s && s.simNames) || {});
    out.reportOpts = Object.assign({}, DEFAULT_SETTINGS.reportOpts, (s && s.reportOpts) || {});
    return out;
  }

  function cleanBiz(b) {
    var out = { capital: null, rows: [] };
    if (b && typeof b === 'object') {
      if (typeof b.capital === 'number' && isFinite(b.capital) && b.capital > 0) out.capital = b.capital;
      if (Array.isArray(b.rows)) out.rows = b.rows.filter(function (r) { return r && typeof r === 'object' && r.id && r.date; });
    }
    return out;
  }
  // 1.0.1: money received is Business and money sent is Personal unless the owner changes it. Applies once to older records.
  function migrate() {
    if (D.settings.v2) return;
    D.tx.forEach(function (r) {
      if (r.dir === 'in' && !r.bucket) { r.bucket = 'business'; r.auto = true; }
      else if (r.dir === 'out' && !r.bucket && r.tag !== 'Savings') { r.bucket = 'personal'; r.auto = true; }
    });
    D.settings.v2 = true;
    write('tx', D.tx); write('settings', D.settings);
  }

  var Store = {
    D: D,
    init: function () {
      D.settings = mergeSettings(read('settings', {}));
      D.tx = read('tx', []);
      D.rules = read('rules', {});
      D.biz = cleanBiz(read('biz', null));
      try { localStorage.removeItem('chil.work'); } catch (e) { /* the old Workings page was removed in 1.0.1 */ }
      D.debts = read('debts', []);
      migrate();
      try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* optional */ }
    },
    commit: function () {
      var ks = arguments.length ? Array.prototype.slice.call(arguments) : Object.keys(KEYS);
      var ok = true;
      ks.forEach(function (k) { ok = write(k, D[k]) && ok; });
      return ok;
    },
    exportAll: function () {
      return {
        app: 'chil', version: 1, exportedAt: new Date().toISOString(),
        settings: D.settings, tx: D.tx, rules: D.rules, biz: D.biz, debts: D.debts
      };
    },
    // Returns {ok, message, counts}. mode: 'replace' only (simple and predictable).
    importAll: function (obj) {
      if (!obj || obj.app !== 'chil' || !Array.isArray(obj.tx) || !Array.isArray(obj.debts)) {
        return { ok: false, message: 'This file is not a Chil backup.' };
      }
      D.settings = mergeSettings(obj.settings || {});
      D.tx = obj.tx;
      D.rules = obj.rules || {};
      D.biz = cleanBiz(obj.biz);
      D.debts = obj.debts;
      migrate();
      Store.commit();
      return { ok: true, counts: { tx: D.tx.length, debts: D.debts.length } };
    },
    wipe: function () {
      Object.keys(KEYS).forEach(function (k) { try { localStorage.removeItem(KEYS[k]); } catch (e) { /* ignore */ } });
      Store.init();
    },
    // Tags the user can pick from.
    IN_TAGS: ['Sales', 'Refund', 'Gift', 'Loan repaid', 'Other'],
    OUT_TAGS: ['Food', 'Transport', 'Stock', 'Savings', 'Rent', 'Airtime', 'Family', 'School fees', 'Utilities', 'Other']
  };
  C.Store = Store;
})();
