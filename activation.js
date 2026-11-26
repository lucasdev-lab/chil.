/* Chil activation and subscription.
   Each phone has a Device ID. The seller signs "Device ID + plan + end date" with a private key; the app checks the signature
   with the public key. Codes made before 1.0.1 (Device ID only) stay valid and never expire. */
(function () {
  var C = window.Chil, U = C.U;
  var KEY = 'chil.act';
  var DEVICE_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1 so it is easy to read out
  var B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  var EPOCH = Date.UTC(2020, 0, 1);
  var TYPE_BY_BYTE = { 1: 'paid', 2: 'trial', 3: 'lifetime' };
  var CHAR_BY_TYPE = { paid: 'P', trial: 'T', lifetime: 'L' };

  function readAct() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  function writeAct(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* ignore */ } }

  function newDeviceId() {
    var bytes = new Uint8Array(10);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    var s = '';
    for (var i = 0; i < 10; i++) s += DEVICE_ALPHA.charAt(bytes[i] & 31);
    return s;
  }
  function normId(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function showId(id) { return id.slice(0, 5) + '-' + id.slice(5); }

  function b32decode(str) {
    var s = String(str || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
    var bits = '', out = [];
    for (var i = 0; i < s.length; i++) bits += ('00000' + B32.indexOf(s.charAt(i)).toString(2)).slice(-5);
    for (var j = 0; j + 8 <= bits.length; j += 8) out.push(parseInt(bits.slice(j, j + 8), 2));
    return new Uint8Array(out);
  }
  function dayIso(n) {
    var d = new Date(EPOCH + n * 86400000);
    return d.getUTCFullYear() + '-' + U.pad(d.getUTCMonth() + 1) + '-' + U.pad(d.getUTCDate());
  }

  // Returns {legacy, type, days, sig} or null.
  function parse(code) {
    var b = b32decode(code);
    if (b.length === 64) return { legacy: true, type: 'lifetime', days: 0, sig: b };
    if (b.length === 68) {
      var type = TYPE_BY_BYTE[b[0] & 15];
      if (!type) return null;
      return { legacy: false, type: type, tier: b[0] >> 4, days: (b[1] << 16) | (b[2] << 8) | b[3], sig: b.slice(4) };
    }
    return null;
  }

  var Act = {
    info: null, // {ok, type, end} once loaded
    deviceId: function () {
      var a = readAct();
      if (!a.deviceId || a.deviceId.length !== 10) { a.deviceId = newDeviceId(); writeAct(a); }
      return a.deviceId;
    },
    shownId: function () { return showId(Act.deviceId()); },
    supported: function () { return !!(window.crypto && window.crypto.subtle); },
    normId: normId,

    // Checks the signature. Resolves {type, end} or null.
    verify: async function (deviceId, code) {
      try {
        var p = parse(code);
        if (!p) return null;
        var id = normId(deviceId);
        var msg = p.legacy ? id : id + ':' + CHAR_BY_TYPE[p.type] + ':' + p.days + (p.tier ? ':' + p.tier : '');
        var key = await crypto.subtle.importKey('jwk', window.CHIL_CONFIG.PUBLIC_KEY_JWK, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
        var ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, p.sig, new TextEncoder().encode(msg));
        if (!ok) return null;
        return { type: p.type, tier: p.tier || 0, end: p.type === 'lifetime' ? null : dayIso(p.days) };
      } catch (e) { return null; }
    },

    // Called once at start.
    load: async function () {
      if (!window.CHIL_CONFIG.REQUIRE_ACTIVATION) { Act.info = { ok: true, type: 'free', end: null }; return; }
      var a = readAct();
      if (!a.code || !Act.supported()) { Act.info = { ok: false }; return; }
      var v = await Act.verify(Act.deviceId(), a.code);
      Act.info = v ? { ok: true, type: v.type, tier: v.tier, end: v.end } : { ok: false };
    },

    // Plan size: 0 = old code (no limit), 1 = up to 50 messages a day, 2 = up to 100, 3 = no limit.
    tier: function () { return Act.info && Act.info.tier ? Act.info.tier : 0; },
    dailyLimit: function () { var t = Act.tier(); return t === 1 ? 50 : t === 2 ? 100 : null; },
    tierName: function () { var t = Act.tier(); return t === 1 ? 'Small (up to 50 messages a day)' : t === 2 ? 'Medium (up to 100 messages a day)' : t === 3 ? 'Large (more than 100 a day)' : ''; },
    isBlocked: function () {
      var me = normId(Act.deviceId());
      return (window.CHIL_CONFIG.BLOCKED || []).some(function (x) { return normId(x) === me; });
    },

    // What the app should do right now. kind: none | blocked | clock | expired | grace | warn | ok
    state: function (infoOverride) {
      var cfg = window.CHIL_CONFIG, i = infoOverride || Act.info;
      if (!cfg.REQUIRE_ACTIVATION) return { kind: 'ok', type: 'free' };
      if (!i || !i.ok) return { kind: 'none' };
      if (Act.isBlocked()) return { kind: 'blocked', type: i.type, end: i.end };
      if (i.type === 'lifetime') return { kind: 'ok', type: 'lifetime', end: null };
      var a = readAct(), real = U.todayISO(), seen = a.lastSeen || real;
      // A phone clock moved backwards cannot extend a subscription.
      if (real < U.addDays(seen, -2)) return { kind: 'clock', type: i.type, end: i.end, seen: seen };
      var today = real > seen ? real : seen;
      if (today !== a.lastSeen) { a.lastSeen = today; writeAct(a); }
      var left = U.daysBetween(today, i.end);
      var warn = cfg.WARN_DAYS == null ? 7 : cfg.WARN_DAYS, grace = cfg.GRACE_DAYS == null ? 1 : cfg.GRACE_DAYS;
      var s = { type: i.type, end: i.end, left: left };
      if (left >= 0) { s.kind = left <= warn ? 'warn' : 'ok'; return s; }
      s.kind = -left <= grace ? 'grace' : 'expired';
      return s;
    },

    // Resolves {ok:true} or {ok:false, reason:'invalid'|'ended', end}.
    activate: async function (code) {
      var v = await Act.verify(Act.deviceId(), code);
      if (!v) return { ok: false, reason: 'invalid' };
      var info = { ok: true, type: v.type, tier: v.tier, end: v.end };
      if (v.type !== 'lifetime') {
        var s = Act.state(info);
        if (s.kind === 'expired') return { ok: false, reason: 'ended', end: v.end };
      }
      var a = readAct();
      a.code = String(code).trim().replace(/\s+/g, '');
      a.lastSeen = U.todayISO(); // a fresh code from the seller resets the clock check
      writeAct(a);
      Act.info = info;
      return { ok: true, type: v.type, end: v.end };
    }
  };
  C.Act = Act;
})();
