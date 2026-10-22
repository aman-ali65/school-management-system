/* Money flow: where the money came from (student fees) and where it went (salaries, expenses, advances).
   Cash basis: a fee counts on the day it is received, a salary on the day it is marked paid. */
(function () {
  var S = ED.storage, F = ED.fmt, U = ED.ui, I = ED.icons, h = F.esc, D = ED.data, C = ED.charts;
  var short = function (v) { return 'Rs ' + (v >= 1000 ? Math.round(v / 100) / 10 + 'k' : Math.round(v)); };
  function sum(list, fn) { return list.reduce(function (a, x) { return a + (fn ? fn(x) : x); }, 0); }

  function load() { return D.load(['feePayments', 'feeInvoices', 'salaries', 'expenses', 'advances', 'students', 'classes', 'teachers', 'expenseCategories']); }

  /* month = 'YYYY-MM', or '' for everything */
  function summary(d, month) {
    var inP = function (date) { return !month || F.monthKey(date) === month; };
    var pays = d.feePayments.filter(function (p) { return inP(p.date); });
    var sals = d.salaries.filter(function (s) { return s.status === 'paid' && s.paidDate && inP(s.paidDate); });
    var exps = d.expenses.filter(function (e) { return inP(e.date); });
    var advs = d.advances.filter(function (a) { return inP(a.date); });
    var invs = d.feeInvoices.filter(function (i) { return !month || i.month === month; });
    var catName = function (id) { return (d.map.expenseCategories[id] || { name: 'Other' }).name; };
    var stu = function (id) { return d.map.students[id] || { name: '(deleted)', classId: null }; };
    var s = { month: month, pays: pays, sals: sals, exps: exps, advs: advs, invs: invs };
    s.feesIn = sum(pays, function (p) { return p.amount; });
    s.salOut = sum(sals, function (x) { return x.net; }); s.expOut = sum(exps, function (x) { return x.amount; }); s.advOut = sum(advs, function (x) { return x.amount; });
    s.out = s.salOut + s.expOut + s.advOut; s.net = s.feesIn - s.out;
    s.billed = sum(invs, function (i) { return i.total; }); s.billedPaid = sum(invs, function (i) { return Math.min(i.paid, i.total); }); s.pending = sum(invs, D.invoiceBalance);
    s.rate = s.billed ? s.billedPaid / s.billed * 100 : null;
    s.payablePending = sum(d.salaries.filter(function (x) { return x.status !== 'paid' && (!month || x.month === month); }), function (x) { return x.net; });
    s.byMethod = {}; pays.forEach(function (p) { s.byMethod[p.method || 'Other'] = (s.byMethod[p.method || 'Other'] || 0) + p.amount; });
    s.byCat = {}; exps.forEach(function (e) { var k = catName(e.categoryId); s.byCat[k] = (s.byCat[k] || 0) + e.amount; });
    s.byClass = d.classes.map(function (c) {
      var inv = invs.filter(function (i) { return stu(i.studentId).classId === c.id; }), rec = pays.filter(function (p) { return stu(p.studentId).classId === c.id; });
      return { label: F.className(c), billed: sum(inv, function (i) { return i.total; }), received: sum(rec, function (p) { return p.amount; }) };
    }).filter(function (x) { return x.billed || x.received; });
    var per = {};
    invs.forEach(function (i) { var r = per[i.studentId] = per[i.studentId] || { id: i.studentId, billed: 0, received: 0, pending: 0 }; r.billed += i.total; r.pending += D.invoiceBalance(i); });
    pays.forEach(function (p) { var r = per[p.studentId] = per[p.studentId] || { id: p.studentId, billed: 0, received: 0, pending: 0 }; r.received += p.amount; });
    s.students = Object.keys(per).map(function (k) { var r = per[k], st = stu(k); return Object.assign(r, { name: st.name, cls: st.classId ? F.className(d.map.classes[st.classId]) : '-', batch: F.batchName(st.sessionId) }); });
    var led = [];
    pays.forEach(function (p) { var st = stu(p.studentId); led.push({ date: p.date, kind: 'Fee received', party: st.name + (st.classId ? ' (' + F.className(d.map.classes[st.classId]) + ')' : ''), detail: 'Receipt ' + p.receiptNo, method: p.method, inAmt: p.amount, outAmt: 0 }); });
    sals.forEach(function (x) { led.push({ date: x.paidDate, kind: 'Salary paid', party: (d.map.teachers[x.teacherId] || { name: '(deleted)' }).name, detail: F.monthLabel(x.month) + ' salary', method: x.method || '', inAmt: 0, outAmt: x.net }); });
    exps.forEach(function (e) { led.push({ date: e.date, kind: 'Expense', party: catName(e.categoryId), detail: e.description || '', method: e.method, inAmt: 0, outAmt: e.amount }); });
    advs.forEach(function (a) { led.push({ date: a.date, kind: 'Advance given', party: (d.map.teachers[a.teacherId] || { name: '(deleted)' }).name, detail: 'Advance salary', method: '', inAmt: 0, outAmt: a.amount }); });
    s.ledger = led.sort(function (a, b) { return b.date.localeCompare(a.date); }).map(function (x, i) { return Object.assign({ id: String(i) }, x); });
    return s;
  }

  /* "where it came from, where it went" as a ribbon diagram */
  function flowSVG(s) {
    var out = [];
    if (s.salOut) out.push({ label: 'Salaries', value: s.salOut, color: 'var(--c1)' });
    var cats = Object.keys(s.byCat).sort(function (a, b) { return s.byCat[b] - s.byCat[a]; }), pal = ['var(--c3)', 'var(--c5)', 'var(--c6)', 'var(--c7)', 'var(--c8)'];
    cats.slice(0, 5).forEach(function (k, i) { out.push({ label: k, value: s.byCat[k], color: pal[i % 5] }); });
    var rest = sum(cats.slice(5), function (k) { return s.byCat[k]; }); if (rest) out.push({ label: 'Other expenses', value: rest, color: 'var(--text-muted)' });
    if (s.advOut) out.push({ label: 'Advances to teachers', value: s.advOut, color: 'var(--c4)' });
    var left = [];
    if (s.feesIn > 0) left.push({ label: 'Fees received', value: s.feesIn, color: 'var(--c2)' });
    if (s.out > s.feesIn) left.push({ label: 'Shortfall (from savings)', value: s.out - s.feesIn, color: 'var(--c4)' });
    if (s.feesIn > s.out) out.push({ label: 'Left over', value: s.feesIn - s.out, color: 'var(--c2)' });
    var total = Math.max(s.feesIn, s.out);
    if (!total) return '<div class="chart-empty">No money moved in this period.</div>';
    var W = 720, nodeW = 12, padY = 12, gap = 8, lx = 190, rx = W - 230, H = Math.max(240, Math.max(left.length, out.length) * 44 + 2 * padY);
    var scaleL = (H - 2 * padY - gap * (left.length - 1)) / total, scaleR = (H - 2 * padY - gap * (out.length - 1)) / total;
    var y = padY; left.forEach(function (n) { n.y = y; y += n.value * scaleL + gap; });
    y = padY; out.forEach(function (n) { n.y = y; y += n.value * scaleR + gap; });
    var rem = left.map(function (n) { return n.value; }), li = 0, lc = left.map(function (n) { return n.y; }), rc = out.map(function (n) { return n.y; }), paths = '';
    out.forEach(function (r, ri) {
      var need = r.value;
      while (need > 1e-9 && li < left.length) {
        var take = Math.min(need, rem[li]), x0 = lx + nodeW, x1 = rx, xm = (x0 + x1) / 2, a0 = lc[li], b0 = a0 + take * scaleL, a1 = rc[ri], b1 = a1 + take * scaleR;
        paths += '<path d="M' + x0 + ' ' + a0 + ' C' + xm + ' ' + a0 + ' ' + xm + ' ' + a1 + ' ' + x1 + ' ' + a1 + ' L' + x1 + ' ' + b1 + ' C' + xm + ' ' + b1 + ' ' + xm + ' ' + b0 + ' ' + x0 + ' ' + b0 + ' Z" fill="' + r.color + '" fill-opacity="0.35"><title>' + h(left[li].label) + ' to ' + h(r.label) + ': ' + short(take) + '</title></path>';
        lc[li] = b0; rc[ri] = b1; rem[li] -= take; need -= take; if (rem[li] <= 1e-9) li++;
      }
    });
    function trunc(t) { return t.length > 24 ? t.slice(0, 23) + '...' : t; }
    var nodes = left.map(function (n) { var hh = Math.max(2, n.value * scaleL); return '<rect x="' + lx + '" y="' + n.y + '" width="' + nodeW + '" height="' + hh + '" rx="3" fill="' + n.color + '"/><text class="ch-val" x="' + (lx - 8) + '" y="' + (n.y + hh / 2 - 2) + '" text-anchor="end">' + h(trunc(n.label)) + '</text><text class="ch-axis" x="' + (lx - 8) + '" y="' + (n.y + hh / 2 + 12) + '" text-anchor="end">' + short(n.value) + '</text>'; }).join('') +
      out.map(function (n) { var hh = Math.max(2, n.value * scaleR); return '<rect x="' + rx + '" y="' + n.y + '" width="' + nodeW + '" height="' + hh + '" rx="3" fill="' + n.color + '"/><text class="ch-val" x="' + (rx + nodeW + 8) + '" y="' + (n.y + hh / 2 - 2) + '">' + h(trunc(n.label)) + '</text><text class="ch-axis" x="' + (rx + nodeW + 8) + '" y="' + (n.y + hh / 2 + 12) + '">' + short(n.value) + ' | ' + Math.round(n.value / total * 100) + '%</text>'; }).join('');
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Money flow diagram">' + paths + nodes + '</svg>';
  }

  function periodLabel(m) { return m ? F.monthLabel(m) : 'whole session'; }

  /* the full report inside the analytics "Money flow" tab */
  function mountReport(panel, d) {
    var month = F.monthKey(F.today()), typeFilter = '';
    function paint() {
      var s = summary(d, month), lastMonths = [], k = month || F.monthKey(F.today());
      for (var i = 0; i < 6; i++) { lastMonths.unshift(k); k = F.prevMonth(k); }
      var six = lastMonths.map(function (m) { var x = summary(d, m); return { m: m, inV: x.feesIn, outV: x.out, net: x.net }; });
      var trend;
      if (month) {
        var n = F.daysInMonth(month), inD = [], outD = [], labels = [];
        for (var dd = 1; dd <= n; dd++) {
          var iso = month + '-' + (dd < 10 ? '0' + dd : dd); labels.push(String(dd));
          inD.push(sum(s.pays.filter(function (p) { return p.date === iso; }), function (p) { return p.amount; }));
          outD.push(sum(s.sals.filter(function (x) { return x.paidDate === iso; }), function (x) { return x.net; }) + sum(s.exps.filter(function (x) { return x.date === iso; }), function (x) { return x.amount; }) + sum(s.advs.filter(function (x) { return x.date === iso; }), function (x) { return x.amount; }));
        }
        trend = C.line({ labels: labels, series: [{ name: 'Money in', values: inD, color: 'var(--c2)' }, { name: 'Money out', values: outD, color: 'var(--c4)' }], fmt: short, label: 'Daily money in and out' });
      } else trend = C.bar({ labels: six.map(function (x) { return F.monthLabel(x.m); }), series: [{ name: 'Money in', values: six.map(function (x) { return x.inV; }), color: 'var(--c2)' }, { name: 'Money out', values: six.map(function (x) { return x.outV; }), color: 'var(--c4)' }], fmt: short });
      var outItems = []; if (s.salOut) outItems.push({ label: 'Salaries', value: s.salOut }); Object.keys(s.byCat).forEach(function (kk) { outItems.push({ label: kk, value: s.byCat[kk] }); }); if (s.advOut) outItems.push({ label: 'Advances', value: s.advOut });
      panel.innerHTML =
        '<div class="filters card card-pad"><div class="field"><label for="mf-m">Month</label><input class="input" type="month" id="mf-m" value="' + h(month) + '"></div><div class="row" style="align-self:flex-end;flex-wrap:wrap">' + U.btn('Whole session', { id: 'mf-all' }) + U.btn('Export ledger CSV', { id: 'mf-csv' }) + '</div></div>' +
        '<div class="grid-stats">' + U.stat('Money in (fees received)', F.currency(s.feesIn), s.pays.length + ' payments, ' + periodLabel(month), 'good') + U.stat('Money out', F.currency(s.out), 'Salaries ' + short(s.salOut) + ', expenses ' + short(s.expOut) + (s.advOut ? ', advances ' + short(s.advOut) : '')) + U.stat(s.net >= 0 ? 'Left over' : 'Shortfall', F.currency(Math.abs(s.net)), s.net >= 0 ? 'Money in minus money out' : 'More went out than came in', s.net >= 0 ? 'good' : 'bad') +
        U.stat('Fees billed', F.currency(s.billed), s.invs.length + ' invoices') + U.stat('Fees still pending', F.currency(s.pending), s.rate === null ? '-' : F.pct(s.rate) + ' of billed fees collected', s.pending ? 'bad' : 'good') + U.stat('Salaries to pay', F.currency(s.payablePending), 'Generated but not paid yet', s.payablePending ? 'bad' : 'good') + '</div>' +
        '<section class="card chart-card chart"><h3>Where the money came from and where it went (' + h(periodLabel(month)) + ')</h3>' + flowSVG(s) + '</section>' +
        '<div class="grid-2"><section class="card chart-card chart"><h3>How fees were paid</h3>' + C.donut({ items: Object.keys(s.byMethod).map(function (x) { return { label: x, value: s.byMethod[x] }; }), center: short(s.feesIn), centerSub: 'received', fmt: short, empty: 'No fees received in this period' }) + '</section>' +
        '<section class="card chart-card chart"><h3>Where it was spent</h3>' + C.donut({ items: outItems, center: short(s.out), centerSub: 'spent', fmt: short, empty: 'Nothing was spent in this period' }) + '</section></div>' +
        '<div class="grid-2"><section class="card chart-card chart"><h3>Fees by class: billed and received</h3>' + C.bar({ labels: s.byClass.map(function (x) { return x.label; }), series: [{ name: 'Billed', values: s.byClass.map(function (x) { return x.billed; }), color: 'var(--c1)' }, { name: 'Received', values: s.byClass.map(function (x) { return x.received; }), color: 'var(--c2)' }], fmt: short, empty: 'No fees in this period' }) + '</section>' +
        '<section class="card chart-card chart"><h3>' + (month ? 'Day by day' : 'Month by month') + '</h3>' + trend + '</section></div>' +
        '<section class="card"><div class="card-head"><h3>Fees from students (' + h(periodLabel(month)) + ')</h3></div><div id="mf-stu"></div></section>' +
        '<section class="card"><div class="card-head"><h3>Every transaction</h3><select class="select" id="mf-type" style="width:auto" aria-label="Filter transactions"><option value="">All types</option><option>Fee received</option><option>Salary paid</option><option>Expense</option><option>Advance given</option></select></div><div id="mf-led"></div></section>' +
        '<section class="card"><div class="card-head"><h3>Last 6 months</h3></div><div class="table-wrap"><table class="table rowcards"><thead><tr><th>Month</th><th class="num">Money in</th><th class="num">Money out</th><th class="num">Net</th></tr></thead><tbody>' +
        six.map(function (x) { return '<tr><td class="td-title" data-label="Month">' + h(F.monthLabel(x.m)) + '</td><td class="num" data-label="Money in">' + F.currency(x.inV) + '</td><td class="num" data-label="Money out">' + F.currency(x.outV) + '</td><td class="num" data-label="Net"><b style="font-weight:500;color:var(--' + (x.net >= 0 ? 'success' : 'danger') + ')">' + F.currency(x.net) + '</b></td></tr>'; }).join('') + '</tbody></table></div></section>';
      var stuTbl = U.table(panel.querySelector('#mf-stu'), {
        rows: s.students, pageSize: 8, search: function (r) { return r.name + ' ' + r.cls; }, searchPlaceholder: 'Search student',
        toolbar: '<div class="row" style="margin-left:auto">' + U.btn('Export CSV', { id: 'mf-stu-csv', small: true }) + '</div>',
        columns: [{ key: 'name', label: 'Student', render: function (r) { return '<div class="cell-main">' + U.avatar(r.name) + '<div><div>' + h(r.name) + '</div><div class="cell-sub">' + h(r.cls) + ' | Batch ' + h(r.batch) + '</div></div></div>'; } },
          { key: 'billed', label: 'Billed', num: true, render: function (r) { return F.currency(r.billed); } }, { key: 'received', label: 'Received', num: true, render: function (r) { return F.currency(r.received); } },
          { key: 'pending', label: 'Pending', num: true, render: function (r) { return r.pending ? '<span style="color:var(--danger)">' + F.currency(r.pending) + '</span>' : F.currency(0); } }],
        empty: { icon: 'fees', title: 'No fee activity', message: 'No invoices or payments in this period.' }
      });
      panel.querySelector('#mf-stu-csv').addEventListener('click', function () { U.download('fees-by-student.csv', U.toCSV([['student', 'class', 'batch', 'billed', 'received', 'pending']].concat(stuTbl.visible().map(function (r) { return [r.name, r.cls, r.batch, r.billed, r.received, r.pending]; }))), 'text/csv'); });
      var ledTbl = U.table(panel.querySelector('#mf-led'), {
        rows: s.ledger.filter(function (x) { return !typeFilter || x.kind === typeFilter; }), pageSize: 10, search: function (r) { return r.kind + ' ' + r.party + ' ' + r.detail + ' ' + r.method; }, searchPlaceholder: 'Search transactions',
        columns: [{ key: 'date', label: 'Date', render: function (r) { return F.date(r.date); } }, { key: 'kind', label: 'Type', render: function (r) { return U.badge(r.kind, r.inAmt ? 'present' : (r.kind === 'Salary paid' ? 'primary' : 'late')); } }, { key: 'party', label: 'Who or what' }, { key: 'detail', label: 'Details' }, { key: 'method', label: 'Method' },
          { key: 'inAmt', label: 'In', num: true, render: function (r) { return r.inAmt ? '<span style="color:var(--success)">+ ' + F.currency(r.inAmt) + '</span>' : ''; } }, { key: 'outAmt', label: 'Out', num: true, render: function (r) { return r.outAmt ? '<span style="color:var(--danger)">- ' + F.currency(r.outAmt) + '</span>' : ''; } }],
        empty: { icon: 'fees', title: 'No transactions', message: 'Nothing was received or paid in this period.' }
      });
      var tsel = panel.querySelector('#mf-type'); tsel.value = typeFilter; tsel.addEventListener('change', function () { typeFilter = tsel.value; ledTbl.setRows(s.ledger.filter(function (x) { return !typeFilter || x.kind === typeFilter; })); });
      panel.querySelector('#mf-csv').addEventListener('click', function () { U.download('money-ledger-' + (month || 'all') + '.csv', U.toCSV([['date', 'type', 'who or what', 'details', 'method', 'in', 'out']].concat(s.ledger.map(function (r) { return [r.date, r.kind, r.party, r.detail, r.method, r.inAmt || '', r.outAmt || '']; }))), 'text/csv'); U.toast(s.ledger.length + ' transactions exported', 'success'); });
      panel.querySelector('#mf-m').addEventListener('change', function (e) { month = e.target.value; paint(); });
      panel.querySelector('#mf-all').addEventListener('click', function () { month = ''; paint(); });
    }
    paint();
  }

  /* the small card on the admin dashboard */
  function dashCard(el, d) {
    var m = F.monthKey(F.today()), s = summary(d, m), tot = Math.max(1, s.feesIn + s.out), pIn = Math.round(s.feesIn / tot * 100);
    el.innerHTML = '<div class="row-between" style="flex-wrap:wrap;gap:8px"><h3>Money this month</h3><a class="small" href="analytics.html#money">Open money flow</a></div>' +
      '<div class="grid-stats" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr));margin-top:8px">' +
      '<div><div class="small muted">Came in (fees)</div><div style="font-size:18px;font-weight:500;color:var(--success)">' + F.currency(s.feesIn) + '</div></div>' +
      '<div><div class="small muted">Went out</div><div style="font-size:18px;font-weight:500;color:var(--danger)">' + F.currency(s.out) + '</div></div>' +
      '<div><div class="small muted">' + (s.net >= 0 ? 'Left over' : 'Shortfall') + '</div><div style="font-size:18px;font-weight:500;color:var(--' + (s.net >= 0 ? 'success' : 'danger') + ')">' + F.currency(Math.abs(s.net)) + '</div></div></div>' +
      '<div style="display:flex;height:10px;border-radius:999px;overflow:hidden;margin-top:12px;background:var(--bg-hover)" role="img" aria-label="Money in compared with money out"><i style="width:' + pIn + '%;background:var(--c2)"></i><i style="width:' + (100 - pIn) + '%;background:var(--c4)"></i></div>' +
      '<div class="small muted" style="margin-top:6px">Salaries ' + short(s.salOut) + ' | Expenses ' + short(s.expOut) + (s.advOut ? ' | Advances ' + short(s.advOut) : '') + ' | Fees still pending ' + short(s.pending) + '</div>';
  }

  window.ED = window.ED || {};
  ED.money = { load: load, summary: summary, flowSVG: flowSVG, mountReport: mountReport, dashCard: dashCard };
})();
