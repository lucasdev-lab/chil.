/* Chil activation: each phone has a Device ID; the seller signs it with a private key, the app checks the signature with the public key. */
(function () {
  var C = window.Chil;
  var KEY = 'chil.act';
  var DEVICE_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1 so it is easy to read out
  var B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

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

  var Act = {
    deviceId: function () {
      var a = readAct();
      if (!a.deviceId || a.deviceId.length !== 10) { a.deviceId = newDeviceId(); writeAct(a); }
      return a.deviceId;
    },
    shownId: function () { return showId(Act.deviceId()); },
    supported: function () { return !!(window.crypto && window.crypto.subtle); },
    verify: async function (deviceId, code) {
      try {
        var sig = b32decode(code);
        if (sig.length !== 64) return false;
        var key = await crypto.subtle.importKey('jwk', window.CHIL_CONFIG.PUBLIC_KEY_JWK, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
        return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, sig, new TextEncoder().encode(normId(deviceId)));
      } catch (e) { return false; }
    },
    // Called once at start. Resolves true when the app may run.
    check: async function () {
      if (!window.CHIL_CONFIG.REQUIRE_ACTIVATION) return true;
      var a = readAct();
      if (!a.code || !Act.supported()) return false;
      return Act.verify(Act.deviceId(), a.code);
    },
    activate: async function (code) {
      var ok = await Act.verify(Act.deviceId(), code);
      if (ok) { var a = readAct(); a.code = String(code).trim(); writeAct(a); }
      return ok;
    }
  };
  C.Act = Act;
})();
