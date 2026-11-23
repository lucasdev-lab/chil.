/* Chil: makes real Excel (.xlsx) files with no internet. Dates are real dates, amounts are numbers, columns are wide enough, headers are bold.
   Cells: text, number, {d:'YYYY-MM-DD'} date, {m:number} money (2 decimals), {b:value} bold (text or number), {bm:number} bold money. */
(function () {
  var C = window.Chil;
  var MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  var enc = new TextEncoder();

  var T = null;
  function crc(b) {
    if (!T) { T = []; for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; T[n] = c >>> 0; } }
    var x = 0xFFFFFFFF;
    for (var i = 0; i < b.length; i++) x = T[(x ^ b[i]) & 255] ^ (x >>> 8);
    return (x ^ 0xFFFFFFFF) >>> 0;
  }
  function u16(a, v) { a.push(v & 255, (v >>> 8) & 255); }
  function u32(a, v) { a.push(v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255); }
  function zip(files) {
    var out = [], central = [], off = 0;
    files.forEach(function (f) {
      var name = enc.encode(f.name), data = enc.encode(f.data), c = crc(data), h = [];
      u32(h, 0x04034b50); u16(h, 20); u16(h, 0x0800); u16(h, 0); u16(h, 0); u16(h, 0x21); u32(h, c); u32(h, data.length); u32(h, data.length); u16(h, name.length); u16(h, 0);
      var ch = [];
      u32(ch, 0x02014b50); u16(ch, 20); u16(ch, 20); u16(ch, 0x0800); u16(ch, 0); u16(ch, 0); u16(ch, 0x21); u32(ch, c); u32(ch, data.length); u32(ch, data.length); u16(ch, name.length); u16(ch, 0); u16(ch, 0); u16(ch, 0); u16(ch, 0); u32(ch, 0); u32(ch, off);
      out.push(new Uint8Array(h), name, data);
      central.push(new Uint8Array(ch), name);
      off += h.length + name.length + data.length;
    });
    var csize = 0; central.forEach(function (p) { csize += p.length; });
    var end = []; u32(end, 0x06054b50); u16(end, 0); u16(end, 0); u16(end, files.length); u16(end, files.length); u32(end, csize); u32(end, off); u16(end, 0);
    return new Blob(out.concat(central, [new Uint8Array(end)]), { type: MIME });
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''); }
  function col(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  function serial(iso) { var p = String(iso).split('-'); return Math.round((Date.UTC(+p[0], +p[1] - 1, +p[2]) - Date.UTC(1899, 11, 30)) / 86400000); }
  // styles: 0 normal, 1 bold, 2 date, 3 money, 4 bold money, 5 bold header with fill
  function cell(v, ref, isHeader) {
    if (v == null || v === '') return '';
    var st = 0, kind = 'n', val = v;
    if (typeof v === 'object') {
      if (v.d != null) { st = 2; val = serial(v.d); }
      else if (v.m != null) { st = 3; val = v.m; }
      else if (v.bm != null) { st = 4; val = v.bm; }
      else if (v.b != null) { st = 1; val = v.b; }
    }
    if (typeof val === 'number') { if (!isFinite(val)) return ''; return '<c r="' + ref + '" s="' + (isHeader ? 5 : st) + '"><v>' + val + '</v></c>'; }
    return '<c r="' + ref + '" s="' + (isHeader ? 5 : st === 0 ? 0 : 1) + '" t="inlineStr"><is><t xml:space="preserve">' + esc(val) + '</t></is></c>';
  }
  function sheetXML(sh) {
    var cols = (sh.cols || []).map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('');
    var rows = sh.rows.map(function (r, ri) {
      var cells = r.map(function (v, ci) { return cell(v, col(ci) + (ri + 1), sh.header !== false && ri === 0); }).join('');
      return '<row r="' + (ri + 1) + '">' + cells + '</row>';
    }).join('');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0">' +
      (sh.header !== false ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' : '') + '</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>' +
      (cols ? '<cols>' + cols + '</cols>' : '') + '<sheetData>' + rows + '</sheetData></worksheet>';
  }
  function safeName(n, used) {
    var s = String(n || 'Sheet').replace(/[\[\]:*?\/\\]/g, ' ').trim().slice(0, 31) || 'Sheet', base = s, i = 2;
    while (used[s.toLowerCase()]) { s = base.slice(0, 28) + ' ' + i++; }
    used[s.toLowerCase()] = 1; return s;
  }

  // sheets: [{name, cols:[widths], rows:[[cell,...]], header:true}]
  function build(sheets) {
    var used = {}, names = sheets.map(function (s) { return safeName(s.name, used); });
    var files = [];
    files.push({ name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      sheets.map(function (s, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') + '</Types>' });
    files.push({ name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' });
    files.push({ name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
      names.map(function (n, i) { return '<sheet name="' + esc(n) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') + '</sheets></workbook>' });
    files.push({ name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      sheets.map(function (s, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') +
      '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' });
    files.push({ name: 'xl/styles.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<numFmts count="2"><numFmt numFmtId="164" formatCode="dd\\ mmm\\ yyyy"/><numFmt numFmtId="165" formatCode="#,##0.00"/></numFmts>' +
      '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
      '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFE6B8"/><bgColor indexed="64"/></patternFill></fill></fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left"/></xf>' +
      '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' });
    sheets.forEach(function (s, i) { files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: sheetXML(s) }); });
    return zip(files);
  }
  C.Xlsx = { build: build, MIME: MIME };
})();
