/* Chil exports: CSV (opens in Excel), PDF through the phone's print dialog, calendar reminders, and share-sheet sending. */
(function () {
  var C = window.Chil, U = C.U;

  function cell(v) {
    v = v == null ? '' : String(v);
    return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  function csv(rows) { return '\uFEFF' + rows.map(function (r) { return r.map(cell).join(','); }).join('\r\n') + '\r\n'; }

  var Ex = {
    txCSV: function (list, simNames) {
      var rows = [['Date', 'Time', 'SIM', 'Name', 'Money in', 'Money out', 'Fee', 'Counted as', 'Category', 'Account', 'Balance', 'M-Pesa code']];
      list.slice().sort(function (a, b) { return a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0; }).forEach(function (r) {
        rows.push([r.date, r.time, (simNames && simNames[r.sim]) || 'SIM ' + r.sim, r.name,
          r.dir === 'in' ? r.amount.toFixed(2) : '', r.dir === 'out' ? r.amount.toFixed(2) : (r.dir === 'own' ? '(own money ' + r.amount.toFixed(2) + ')' : ''),
          r.fee ? r.fee.toFixed(2) : '', r.bucket ? U.cap(r.bucket) : '', r.tag || '', r.account, r.balance != null ? r.balance.toFixed(2) : '', r.code]);
      });
      return csv(rows);
    },
    debtsCSV: function (list, statusFn) {
      var rows = [['Type', 'Date given', 'Name', 'Description', 'Amount', 'Paid', 'Balance', 'Due date', 'Status']];
      list.forEach(function (d) {
        var paid = U.sum(d.payments || [], function (p) { return p.amount; });
        rows.push([d.kind === 'owed' ? 'Owed to me' : 'I owe', d.date, d.name, d.desc || '', d.amount.toFixed(2), paid.toFixed(2),
          U.round2(d.amount - paid).toFixed(2), d.due || '', statusFn(d).label]);
      });
      return csv(rows);
    },

    // Repeating alarms for opening and closing, as a calendar file (.ics). Times are "floating": they follow the phone's own clock.
    ics: function (s) {
      if (!s.openAt || !s.closeAt || !s.days.length) return null;
      var BY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
      var days = s.days.slice().sort().map(function (d) { return BY[d]; }).join(',');
      function esc(t) { return String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
      function first(hhmm) {
        var now = new Date();
        for (var i = 0; i < 8; i++) {
          var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
          if (s.days.indexOf(d.getDay()) < 0) continue;
          var p = hhmm.split(':').map(Number);
          var at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), p[0], p[1]);
          if (at > now) return U.toISO(d).replace(/-/g, '') + 'T' + U.pad(p[0]) + U.pad(p[1]) + '00';
        }
        return U.todayISO().replace(/-/g, '') + 'T' + hhmm.replace(':', '') + '00';
      }
      function ev(id, hhmm, title, text) {
        return ['BEGIN:VEVENT', 'UID:chil-' + id + '-' + U.uid() + '@chil.app', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z',
          'DTSTART:' + first(hhmm), 'DURATION:PT10M', 'RRULE:FREQ=WEEKLY;BYDAY=' + days, 'SUMMARY:' + esc(title), 'DESCRIPTION:' + esc(text),
          'BEGIN:VALARM', 'TRIGGER:PT0S', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(title), 'END:VALARM', 'END:VEVENT'].join('\r\n');
      }
      var shop = s.shopName ? s.shopName + ': ' : '';
      return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Chil//Shop reminders//EN', 'CALSCALE:GREGORIAN',
        ev('open', s.openAt, shop + 'Time to open', s.openMsg || "Let's get to work. Make the day fruitful."),
        ev('close', s.closeAt, shop + 'Time to close shop', 'Open Chil, check today and close shop.'),
        'END:VCALENDAR'].join('\r\n') + '\r\n';
    },

    // Opens the phone's print dialog, where "Save as PDF" makes the PDF.
    print: function (html, title) {
      var root = document.getElementById('print-root');
      root.innerHTML = html;
      var old = document.title;
      if (title) document.title = title;
      document.body.classList.add('printing');
      function done() {
        document.body.classList.remove('printing'); root.innerHTML = ''; document.title = old;
        window.removeEventListener('afterprint', done);
      }
      window.addEventListener('afterprint', done);
      setTimeout(function () { try { window.print(); } catch (e) { done(); } }, 60);
    },

    // Uses the phone's share menu (WhatsApp, email, Drive) when it can, otherwise downloads the file.
    shareFile: async function (name, content, mime) {
      try {
        var file = new File([content], name, { type: mime });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: name });
          return 'shared';
        }
      } catch (e) {
        if (e && e.name === 'AbortError') return 'cancelled';
      }
      U.download(name, content, mime);
      return 'downloaded';
    }
  };
  C.Export = Ex;
})();
