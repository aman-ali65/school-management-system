(function () {
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  var fmt = {
    /* local date as YYYY-MM-DD (not UTC) */
    today: function () {
      var d = new Date();
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    },
    date: function (iso) {
      if (!iso) return '';
      var p = String(iso).slice(0, 10).split('-');
      return p[2] + ' ' + MONTHS[+p[1] - 1] + ' ' + p[0];
    },
    currency: function (n) {
      return 'Rs ' + Math.round(Number(n) || 0).toLocaleString('en-PK');
    },
    pct: function (n) { return (Math.round(n * 10) / 10) + '%'; },
    initials: function (name) {
      var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
      if (!parts.length) return '?';
      return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
    },
    addDays: function (iso, n) {
      var p = iso.split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2] + n);
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    },
    dow: function (iso) { var p = iso.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]).getDay(); },
    monthKey: function (iso) { return String(iso).slice(0, 7); },
    monthLabel: function (ym) { var p = ym.split('-'); return MONTHS[+p[1] - 1] + ' ' + p[0]; },
    daysInMonth: function (ym) { var p = ym.split('-'); return new Date(+p[0], +p[1], 0).getDate(); },
    prevMonth: function (ym) { var p = ym.split('-'); var d = new Date(+p[0], +p[1] - 2, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); },
    nextMonth: function (ym) { var p = ym.split('-'); var d = new Date(+p[0], +p[1], 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); },
    time: function (iso) { var d = new Date(iso); return pad(d.getHours()) + ':' + pad(d.getMinutes()); },
    digits: function (s) { return String(s || '').replace(/\D/g, ''); },
    cnic: function (s) { var d = String(s || '').replace(/\D/g, ''); return d.length === 13 ? d.slice(0, 5) + '-' + d.slice(5, 12) + '-' + d.slice(12) : String(s || ''); },
    cnicOk: function (s) { return String(s || '').replace(/\D/g, '').length === 13; },
    /* "9-A" for the current batch, "9-A (2025)" for classes of other batches */
    className: function (c) {
      if (!c) return '';
      var base = c.name + '-' + c.section, m = fmt._batch;
      if (m && m.active && c.sessionId && c.sessionId !== m.active) return base + ' (' + (m.names[c.sessionId] || 'old') + ')';
      return base;
    },
    batchName: function (id) { var m = fmt._batch; return (m && m.names[id]) || 'Not set'; },
    greeting: function () {
      var h = new Date().getHours();
      return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    },
    /* always escape user-written text before putting it in innerHTML */
    esc: function (s) {
      return String(s === null || s === undefined ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
  };

  window.ED = window.ED || {};
  ED.fmt = fmt;
})();
