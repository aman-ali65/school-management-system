/* Small dependency-free SVG charts. They use CSS variables, so they follow light and dark themes. */
(function () {
  var h = ED.fmt.esc;
  var PAL = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)', 'var(--c7)', 'var(--c8)'];

  function nice(v) {
    if (v <= 0) return 1;
    var p = Math.pow(10, Math.floor(Math.log(v) / Math.LN10)), n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  }
  function short(n) {
    n = Math.round(n * 10) / 10;
    if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'M';
    if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k';
    return String(n);
  }
  function legend(items) {
    return '<div class="legend">' + items.map(function (s, i) { return '<span><i style="background:' + (s.color || PAL[i % PAL.length]) + '"></i>' + h(s.name || s.label) + '</span>'; }).join('') + '</div>';
  }
  function empty(msg) { return '<div class="chart-empty">' + h(msg || 'No data yet') + '</div>'; }
  function axes(W, H, m, yMax, fmt) {
    var out = '';
    for (var i = 0; i <= 4; i++) {
      var y = m.t + (H - m.t - m.b) * (1 - i / 4);
      out += '<line class="ch-grid" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y + '" y2="' + y + '"/>' +
        '<text class="ch-axis" x="' + (m.l - 6) + '" y="' + (y + 4) + '" text-anchor="end">' + (fmt || short)(yMax * i / 4) + '</text>';
    }
    return out;
  }
  function trunc(s, n) { s = String(s); return s.length > n ? s.slice(0, n - 1) + '...' : s; }

  /* bar({ labels, series:[{name, values, color}], height, max, fmt, showValues }) */
  function bar(o) {
    var L = o.labels || [], S = o.series || [];
    if (!L.length || !S.length) return empty(o.empty);
    var W = 640, H = o.height || 240, m = { l: 44, r: 10, t: 12, b: 30 };
    var maxV = o.max || nice(Math.max.apply(null, [0].concat.apply([], S.map(function (s) { return s.values; }))) * 1.05 || 1);
    var gw = (W - m.l - m.r) / L.length, bw = Math.min(40, gw * 0.7 / S.length);
    var out = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + h(o.label || 'Bar chart') + '">' + axes(W, H, m, maxV, o.fmt);
    var total = L.length * S.length, showV = o.showValues !== false && total <= 14;
    L.forEach(function (lab, i) {
      var gx = m.l + gw * i + (gw - bw * S.length) / 2;
      S.forEach(function (s, j) {
        var v = s.values[i] || 0, bh = (H - m.t - m.b) * Math.min(v, maxV) / maxV, x = gx + bw * j, y = H - m.b - bh;
        out += '<rect x="' + x + '" y="' + y + '" width="' + (bw - 2) + '" height="' + bh + '" rx="3" fill="' + (s.color || PAL[j % PAL.length]) + '"><title>' + h(lab) + (S.length > 1 ? ' - ' + h(s.name) : '') + ': ' + (o.fmt || short)(v) + '</title></rect>';
        if (showV) out += '<text class="ch-val" x="' + (x + (bw - 2) / 2) + '" y="' + (y - 4) + '" text-anchor="middle">' + (o.fmt || short)(v) + '</text>';
      });
      out += '<text class="ch-axis" x="' + (m.l + gw * i + gw / 2) + '" y="' + (H - 10) + '" text-anchor="middle">' + h(trunc(lab, gw < 60 ? 6 : 12)) + '</text>';
    });
    return out + '</svg>' + (S.length > 1 || S[0].name && o.legend ? legend(S) : '');
  }

  /* line({ labels, series:[{name, values, color}], height, max, fmt }) */
  function line(o) {
    var L = o.labels || [], S = o.series || [];
    if (L.length < 2 || !S.length) return empty(o.empty);
    var W = 640, H = o.height || 240, m = { l: 44, r: 14, t: 12, b: 30 };
    var maxV = o.max || nice(Math.max.apply(null, [0].concat.apply([], S.map(function (s) { return s.values; }))) * 1.05 || 1);
    var minV = o.min || 0;
    var step = (W - m.l - m.r) / (L.length - 1);
    var out = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + h(o.label || 'Line chart') + '">' + axes(W, H, m, maxV, o.fmt);
    S.forEach(function (s, j) {
      var col = s.color || PAL[j % PAL.length], pts = s.values.map(function (v, i) { return [m.l + step * i, H - m.b - (H - m.t - m.b) * ((v || 0) - minV) / (maxV - minV)]; });
      out += '<polyline fill="none" stroke="' + col + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="' + pts.map(function (p) { return p[0] + ',' + p[1]; }).join(' ') + '"/>';
      pts.forEach(function (p, i) { out += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3.5" fill="' + col + '"><title>' + h(L[i]) + ': ' + (o.fmt || short)(s.values[i]) + '</title></circle>'; });
    });
    var every = Math.ceil(L.length / 10);
    L.forEach(function (lab, i) { if (i % every === 0) out += '<text class="ch-axis" x="' + (m.l + step * i) + '" y="' + (H - 10) + '" text-anchor="middle">' + h(trunc(lab, 8)) + '</text>'; });
    return out + '</svg>' + (S.length > 1 ? legend(S) : '');
  }

  /* donut({ items:[{label, value, color}], center, centerSub }) */
  function donut(o) {
    var items = (o.items || []).filter(function (i) { return i.value > 0; });
    var total = items.reduce(function (a, i) { return a + i.value; }, 0);
    if (!total) return empty(o.empty);
    var r = 62, c = 2 * Math.PI * r, off = 0;
    var out = '<svg viewBox="0 0 180 180" role="img" aria-label="' + h(o.label || 'Donut chart') + '"><g transform="rotate(-90 90 90)">';
    items.forEach(function (it, i) {
      var len = c * it.value / total;
      out += '<circle cx="90" cy="90" r="' + r + '" fill="none" stroke="' + (it.color || PAL[i % PAL.length]) + '" stroke-width="26" stroke-dasharray="' + len + ' ' + (c - len) + '" stroke-dashoffset="' + (-off) + '"><title>' + h(it.label) + ': ' + (o.fmt || short)(it.value) + '</title></circle>';
      off += len;
    });
    out += '</g><text class="ch-center" x="90" y="92" text-anchor="middle">' + h(o.center !== undefined ? o.center : (o.fmt || short)(total)) + '</text><text class="ch-center-sub" x="90" y="110" text-anchor="middle">' + h(o.centerSub || 'Total') + '</text></svg>';
    var lg = '<div class="legend">' + items.map(function (it, i) { return '<span><i style="background:' + (it.color || PAL[i % PAL.length]) + '"></i>' + h(it.label) + ': ' + (o.fmt || short)(it.value) + '</span>'; }).join('') + '</div>';
    return '<div class="donut-wrap">' + out + lg + '</div>';
  }

  window.ED = window.ED || {};
  ED.charts = { bar: bar, line: line, donut: donut, legend: legend, palette: PAL };
})();
