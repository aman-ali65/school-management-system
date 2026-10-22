(async function () {
  var session = await ED.shell.init({ role: 'admin', active: 'fees' });
  if (!session) return;
  var S = ED.storage, F = ED.fmt, U = ED.ui, I = ED.icons, h = F.esc, A = ED.audit, D = ED.data, C = ED.charts;
  var today = F.today(), thisMonth = F.monthKey(today), settings, d;
  var METHODS = ['Cash', 'Bank transfer', 'JazzCash', 'Easypaisa', 'Cheque'].map(function (m) { return { value: m, label: m }; });

  async function fetchAll() { d = await D.load(['feeInvoices', 'feePayments', 'feeStructures', 'feePlans', 'students', 'classes', 'sessions']); settings = await D.settings(); }
  await fetchAll();
  var cn = function (id) { return F.className(d.map.classes[id]); };
  function student(id) { return d.map.students[id] || { name: '(deleted)', classId: null }; }
  function balance(i) { return D.invoiceBalance(i); }
  function overdue(i) { return i.dueDate < today && balance(i) > 0; }

  document.getElementById('content').innerHTML = U.pageHead('Fees', 'Fee structure, monthly invoices, payments, receipts and defaulters.', U.btn('Generate monthly fees', { variant: 'primary', icon: 'plus', id: 'gen' }) + U.btn('Apply late fines', { id: 'fine' })) + '<div id="tabs"></div>';
  var tabsApi;
  async function reload() { await fetchAll(); tabsApi.select(tabsApi.current()); }

  /* ---------- helpers: money ops ---------- */
  function invoiceRows(filter) {
    return d.feeInvoices.filter(filter || function () { return true; }).map(function (i) {
      var s = student(i.studentId);
      return { id: i.id, i: i, s: s, name: s.name, cls: s.classId ? cn(s.classId) : '-', month: i.month, total: i.total, paid: i.paid, bal: balance(i), due: i.dueDate, status: D.invoiceStatus(i), late: overdue(i) };
    }).sort(function (a, b) { return b.month.localeCompare(a.month) || a.name.localeCompare(b.name); });
  }
  async function receive(row) {
    var bal = row.bal; if (!bal) return U.toast('This invoice is already paid.', 'info');
    var v = await U.form({
      title: 'Receive payment: ' + row.name, submitLabel: 'Record payment', value: { amount: bal, method: 'Cash', date: today },
      fields: [
        { name: 'amount', label: 'Amount (Rs)', type: 'number', required: true, min: 1, max: bal, step: 50, hint: 'Balance due: ' + F.currency(bal) },
        { name: 'method', label: 'Payment method', type: 'select', options: METHODS },
        { name: 'date', label: 'Payment date', type: 'date', required: true, max: today }
      ]
    });
    if (!v) return;
    var no = 'RC-' + String(1001 + S._readList('feePayments').length);
    var pay = await S.insert('feePayments', { invoiceId: row.id, studentId: row.i.studentId, amount: v.amount, method: v.method, date: v.date, receivedBy: session.name, receiptNo: no });
    var paid = row.i.paid + v.amount; await S.update('feeInvoices', row.id, { paid: paid, status: paid >= row.i.total ? 'paid' : 'partial' });
    A.log('pay', 'fees', 'Received ' + F.currency(v.amount) + ' from ' + row.name + ' (' + no + ')');
    U.toast('Payment recorded: ' + no, 'success'); await fetchAll();
    var pr = await U.confirm({ title: 'Print receipt?', message: 'Receipt ' + no + ' for ' + F.currency(v.amount) + '.', confirmLabel: 'Print receipt' });
    if (pr) printReceipt(pay); tabsApi.select(tabsApi.current());
  }
  function remind(rows) {
    var list = rows.map(function (r) { return r.s; }).filter(function (s) { return s && s.id; });
    if (!list.length) return U.toast('Nothing to send.', 'info');
    var byStudent = {}; rows.forEach(function (r) { var k = r.i.studentId; byStudent[k] = byStudent[k] || { due: 0, month: r.month, dueDate: r.due }; byStudent[k].due += r.bal; });
    var seen = {}, uniq = list.filter(function (s) { if (seen[s.id]) return false; seen[s.id] = 1; return true; });
    ED.wa.openModal({ students: uniq, type: 'fee', title: 'Send fee reminder', vars: function (s) { var b = byStudent[s.id]; return { due: Math.round(b.due).toLocaleString('en-PK'), month: F.monthLabel(b.month), dueDate: F.date(b.dueDate) }; } });
  }
  function printVoucher(row) {
    var i = row.i, s = row.s, rows = i.items.map(function (x) { return '<tr><td>' + h(x.head) + '</td><td class="n">' + F.currency(x.amount) + '</td></tr>'; }).join('');
    U.print(U.docHeader(settings, 'Fee voucher', F.monthLabel(i.month)) + '<div class="grid box"><div>Student: <b>' + h(s.name) + '</b></div><div>Class: <b>' + h(row.cls) + '</b></div><div>Roll no: <b>' + h(s.rollNo || '-') + '</b></div><div>Due date: <b>' + F.date(i.dueDate) + '</b></div></div>' +
      '<table><thead><tr><th>Description</th><th class="n">Amount</th></tr></thead><tbody>' + rows + '<tr><td>Discount</td><td class="n">- ' + F.currency(i.discount) + '</td></tr>' + (i.fine ? '<tr><td>Late fine</td><td class="n">' + F.currency(i.fine) + '</td></tr>' : '') + '</tbody><tfoot><tr class="tot"><td>Total</td><td class="n">' + F.currency(i.total) + '</td></tr><tr><td>Paid</td><td class="n">' + F.currency(i.paid) + '</td></tr><tr class="tot"><td>Balance due</td><td class="n">' + F.currency(balance(i)) + '</td></tr></tfoot></table><p class="muted">Please pay before the due date. Late fine of ' + F.currency(settings.lateFinePerDay) + ' per day applies after it.</p><div class="sig"><div>Accountant</div><div>Parent</div></div>', 'Fee voucher');
  }
  function printReceipt(p) {
    var s = student(p.studentId), inv = d.map.feeInvoices[p.invoiceId];
    U.print(U.docHeader(settings, 'Payment receipt', p.receiptNo) + '<div class="grid box"><div>Received from: <b>' + h(s.name) + '</b></div><div>Class: <b>' + (s.classId ? h(cn(s.classId)) : '-') + '</b></div><div>Date: <b>' + F.date(p.date) + '</b></div><div>Method: <b>' + h(p.method) + '</b></div><div>For: <b>' + (inv ? F.monthLabel(inv.month) + ' fee' : '-') + '</b></div><div>Received by: <b>' + h(p.receivedBy) + '</b></div></div><h2>Amount received: ' + F.currency(p.amount) + '</h2>' + (inv ? '<p class="muted">Invoice total ' + F.currency(inv.total) + ', paid so far ' + F.currency(inv.paid) + ', balance ' + F.currency(balance(inv)) + '.</p>' : '') + '<div class="sig"><div>Accountant</div><div>Parent</div></div>', 'Receipt');
  }

  /* ---------- Overview ---------- */
  function overview(p) {
    p.innerHTML = '<div class="filters card card-pad"><div class="field"><label for="o-m">Month</label><input class="input" type="month" id="o-m" value="' + thisMonth + '"></div></div><div id="o-out"></div>';
    function paint() {
      var m = p.querySelector('#o-m').value, inv = d.feeInvoices.filter(function (i) { return i.month === m; });
      var billed = inv.reduce(function (a, i) { return a + i.total; }, 0), paid = inv.reduce(function (a, i) { return a + i.paid; }, 0), n = { paid: 0, partial: 0, unpaid: 0 };
      inv.forEach(function (i) { n[D.invoiceStatus(i)]++; });
      var byClass = d.classes.map(function (c) { var mine = inv.filter(function (i) { return student(i.studentId).classId === c.id; }); return { l: F.className(c), b: mine.reduce(function (a, i) { return a + i.total; }, 0), p: mine.reduce(function (a, i) { return a + i.paid; }, 0) }; });
      p.querySelector('#o-out').innerHTML = !inv.length ? '<div class="card">' + U.empty('fees', 'No invoices for ' + F.monthLabel(m), 'Use "Generate monthly fees" to create them.') + '</div>' :
        '<div class="grid-stats">' + U.stat('Billed', F.currency(billed), inv.length + ' invoices') + U.stat('Collected', F.currency(paid), 'This month\'s invoices', 'good') + U.stat('Pending', F.currency(billed - paid), n.unpaid + ' unpaid, ' + n.partial + ' partial', billed - paid ? 'bad' : 'good') + U.stat('Collection rate', billed ? F.pct(paid / billed * 100) : '-', 'Paid out of billed') + '</div>' +
        '<div class="grid-2"><section class="card chart-card chart"><h3>Invoice status</h3>' + C.donut({ items: [{ label: 'Paid', value: n.paid, color: 'var(--c2)' }, { label: 'Partial', value: n.partial, color: 'var(--c3)' }, { label: 'Unpaid', value: n.unpaid, color: 'var(--c4)' }], center: String(inv.length), centerSub: 'invoices' }) + '</section>' +
        '<section class="card chart-card chart"><h3>Billed vs collected by class</h3>' + C.bar({ labels: byClass.map(function (x) { return x.l; }), series: [{ name: 'Billed', values: byClass.map(function (x) { return x.b; }), color: 'var(--c1)' }, { name: 'Collected', values: byClass.map(function (x) { return x.p; }), color: 'var(--c2)' }], fmt: function (v) { return 'Rs ' + (v >= 1000 ? Math.round(v / 100) / 10 + 'k' : v); } }) + '</section></div>';
    }
    p.querySelector('#o-m').addEventListener('change', paint); paint();
  }

  /* ---------- Invoices ---------- */
  function invoices(p) {
    p.innerHTML = '<div class="filters card card-pad"><div class="field"><label for="i-m">Month</label><input class="input" type="month" id="i-m" value="' + thisMonth + '"></div><div class="field"><label for="i-b">Batch</label><select class="select" id="i-b"><option value="">All batches</option>' + d.sessions.map(function (b) { return '<option value="' + b.id + '">' + h(b.name) + '</option>'; }).join('') + '</select></div><div class="field"><label for="i-c">Class</label><select class="select" id="i-c"><option value="">All classes</option>' + U.options(d.classes, 'id', F.className) + '</select></div><div class="field"><label for="i-s">Status</label><select class="select" id="i-s"><option value="">All</option><option value="unpaid">Unpaid</option><option value="partial">Partial</option><option value="paid">Paid</option></select></div></div><section class="card" id="i-tbl"></section>';
    function rows() { var m = p.querySelector('#i-m').value, c = p.querySelector('#i-c').value, st = p.querySelector('#i-s').value, bb = p.querySelector('#i-b').value; return invoiceRows(function (i) { return (!m || i.month === m) && (!c || student(i.studentId).classId === c) && (!bb || student(i.studentId).sessionId === bb); }).filter(function (r) { return !st || r.status === st; }); }
    var tbl = U.table(p.querySelector('#i-tbl'), {
      rows: rows(), pageSize: 12, selectable: true, search: function (r) { return r.name + ' ' + r.cls; }, searchPlaceholder: 'Search student',
      toolbar: '<div class="row" style="margin-left:auto">' + U.btn('Remind selected', { id: 'i-wa', small: true, variant: 'whatsapp', icon: 'whatsapp' }) + U.btn('Export CSV', { id: 'i-csv', small: true }) + '</div>',
      columns: [
        { key: 'name', label: 'Student', render: function (r) { return '<div class="cell-main">' + U.avatar(r.name) + '<div><div>' + h(r.name) + '</div><div class="cell-sub">' + h(r.cls) + '</div></div></div>'; } },
        { key: 'month', label: 'Month', render: function (r) { return F.monthLabel(r.month); } },
        { key: 'batch', label: 'Batch', render: function (r) { return h(F.batchName(r.s.sessionId)); } },
        { key: 'total', label: 'Total', num: true, render: function (r) { return F.currency(r.total); } },
        { key: 'paid', label: 'Paid', num: true, render: function (r) { return F.currency(r.paid); } },
        { key: 'bal', label: 'Balance', num: true, render: function (r) { return F.currency(r.bal); } },
        { key: 'due', label: 'Due', render: function (r) { return F.date(r.due) + (r.late ? ' ' + U.badge('Overdue', 'absent') : ''); } },
        { key: 'status', label: 'Status', render: function (r) { return U.statusBadge('fee', r.status); } }
      ],
      actions: [{ id: 'pay', label: 'Receive payment', icon: 'fees', show: function (r) { return r.bal > 0; }, onClick: receive }, { id: 'v', label: 'Print voucher', icon: 'results', onClick: printVoucher }, { id: 'wa', label: 'Send reminder', icon: 'whatsapp', show: function (r) { return r.bal > 0; }, onClick: function (r) { remind([r]); } }],
      empty: { icon: 'fees', title: 'No invoices', message: 'Generate monthly fees to create invoices.' }
    });
    ['i-m', 'i-b', 'i-c', 's-c-unused', 'i-s'].filter(function (x) { return p.querySelector('#' + x); }).forEach(function (id) { p.querySelector('#' + id).addEventListener('change', function () { tbl.setRows(rows()); }); });
    p.querySelector('#i-wa').addEventListener('click', function () { var sel = tbl.selected().filter(function (r) { return r.bal > 0; }); if (!sel.length) return U.toast('Tick unpaid invoices first.', 'info'); remind(sel); });
    p.querySelector('#i-csv').addEventListener('click', function () { U.download('fee-invoices.csv', U.toCSV([['student', 'class', 'month', 'total', 'paid', 'balance', 'due date', 'status']].concat(tbl.visible().map(function (r) { return [r.name, r.cls, r.month, r.total, r.paid, r.bal, r.due, r.status]; }))), 'text/csv'); });
  }

  /* ---------- Fee structure ---------- */
  function structure(p) {
    p.innerHTML = '<div class="filters card card-pad"><div class="field"><label for="s-c">Class</label><select class="select" id="s-c">' + U.options(d.classes, 'id', F.className) + '</select></div><div class="row" style="align-self:flex-end">' + U.btn('Add fee head', { variant: 'primary', icon: 'plus', id: 's-add' }) + U.btn('Copy to other classes', { id: 's-copy' }) + '</div></div><section class="card" id="s-tbl"></section><div id="s-sum"></div>';
    var sel = p.querySelector('#s-c');
    function rows() { return d.feeStructures.filter(function (x) { return x.classId === sel.value; }).map(function (x) { return Object.assign({}, x, { freq: x.frequency === 'monthly' ? 'Every month' : 'One time' }); }); }
    var tbl = U.table(p.querySelector('#s-tbl'), {
      rows: rows(), pageSize: 20, columns: [{ key: 'headName', label: 'Fee head' }, { key: 'freq', label: 'When' }, { key: 'amount', label: 'Amount', num: true, render: function (r) { return F.currency(r.amount); } }],
      actions: [{ id: 'e', label: 'Edit fee head', icon: 'settings', onClick: function (r) { head(r); } }, { id: 'x', label: 'Delete fee head', icon: 'x', danger: true, onClick: async function (r) { var ok = await U.confirm({ title: 'Delete ' + r.headName + '?', message: 'Existing invoices keep their amounts.', confirmLabel: 'Delete', danger: true }); if (!ok) return; await S.remove('feeStructures', r.id); A.log('delete', 'fees', 'Deleted fee head ' + r.headName); await fetchAll(); paint(); } }],
      empty: { icon: 'fees', title: 'No fee heads for this class', message: 'Add tuition and other fees.' }
    });
    function paint() { tbl.setRows(rows()); var tot = rows().filter(function (x) { return x.frequency === 'monthly'; }).reduce(function (a, x) { return a + x.amount; }, 0); p.querySelector('#s-sum').innerHTML = '<div class="callout">' + I.svg('info', 18) + '<span>Monthly fee for class ' + h(cn(sel.value)) + ': <b>' + F.currency(tot) + '</b> before discounts.</span></div>'; }
    async function head(r) {
      var v = await U.form({ title: r ? 'Edit fee head' : 'Add fee head', value: r || { frequency: 'monthly' }, fields: [{ name: 'headName', label: 'Name', required: true, placeholder: 'e.g. Tuition fee', full: true }, { name: 'amount', label: 'Amount (Rs)', type: 'number', required: true, min: 0, step: 50 }, { name: 'frequency', label: 'Charged', type: 'select', options: [{ value: 'monthly', label: 'Every month' }, { value: 'once', label: 'One time (not in monthly invoices)' }] }] });
      if (!v) return;
      if (r) await S.update('feeStructures', r.id, v); else await S.insert('feeStructures', Object.assign({ classId: sel.value }, v));
      A.log('update', 'fees', 'Fee structure changed for class ' + cn(sel.value)); U.toast('Fee head saved', 'success'); await fetchAll(); paint();
    }
    p.querySelector('#s-add').addEventListener('click', function () { head(null); });
    p.querySelector('#s-copy').addEventListener('click', async function () {
      var others = d.classes.filter(function (c) { return c.id !== sel.value; }); if (!others.length || !rows().length) return U.toast('Nothing to copy.', 'info');
      var v = await U.form({ title: 'Copy fee structure', submitLabel: 'Copy', fields: [{ name: 'to', label: 'Copy to class', type: 'select', required: true, placeholder: 'Choose class', full: true, options: others.map(function (c) { return { value: c.id, label: F.className(c) }; }), hint: 'Existing fee heads of that class are replaced.' }] });
      if (!v) return;
      S._writeList('feeStructures', S._readList('feeStructures').filter(function (x) { return x.classId !== v.to; }));
      for (var i = 0; i < rows().length; i++) { var r = rows()[i]; await S.insert('feeStructures', { classId: v.to, headName: r.headName, amount: r.amount, frequency: r.frequency }); }
      A.log('update', 'fees', 'Copied fee structure to class ' + cn(v.to)); U.toast('Fee structure copied', 'success'); await fetchAll(); paint();
    });
    sel.addEventListener('change', paint); paint();
  }

  /* ---------- Payments ---------- */
  function payments(p) {
    p.innerHTML = '<div class="filters card card-pad"><div class="field"><label for="p-m">Month</label><input class="input" type="month" id="p-m" value="' + thisMonth + '"></div></div><section class="card" id="p-tbl"></section>';
    function rows() { var m = p.querySelector('#p-m').value; return d.feePayments.filter(function (x) { return !m || F.monthKey(x.date) === m; }).map(function (x) { var s = student(x.studentId); return Object.assign({}, x, { name: s.name, cls: s.classId ? cn(s.classId) : '-' }); }).sort(function (a, b) { return b.date.localeCompare(a.date); }); }
    var tbl = U.table(p.querySelector('#p-tbl'), {
      rows: rows(), pageSize: 12, search: function (r) { return r.name + ' ' + r.receiptNo + ' ' + r.method; }, searchPlaceholder: 'Search receipt or student',
      toolbar: '<div class="row" style="margin-left:auto"><b style="font-weight:500" id="p-total"></b></div>',
      columns: [{ key: 'receiptNo', label: 'Receipt' }, { key: 'date', label: 'Date', render: function (r) { return F.date(r.date); } }, { key: 'name', label: 'Student', render: function (r) { return h(r.name) + '<div class="cell-sub">' + h(r.cls) + '</div>'; } }, { key: 'method', label: 'Method' }, { key: 'amount', label: 'Amount', num: true, render: function (r) { return F.currency(r.amount); } }],
      actions: [{ id: 'pr', label: 'Print receipt', icon: 'results', onClick: printReceipt }, { id: 'del', label: 'Reverse payment', icon: 'x', danger: true, onClick: async function (r) {
        var ok = await U.confirm({ title: 'Reverse ' + r.receiptNo + '?', message: F.currency(r.amount) + ' will be taken off the invoice again.', confirmLabel: 'Reverse payment', danger: true }); if (!ok) return;
        var inv = d.map.feeInvoices[r.invoiceId]; if (inv) { var paid = Math.max(0, inv.paid - r.amount); await S.update('feeInvoices', inv.id, { paid: paid, status: paid >= inv.total ? 'paid' : paid > 0 ? 'partial' : 'unpaid' }); }
        await S.remove('feePayments', r.id); A.log('delete', 'fees', 'Reversed payment ' + r.receiptNo); U.toast('Payment reversed', 'success'); await fetchAll(); paint(); } }],
      empty: { icon: 'fees', title: 'No payments', message: 'Payments you receive appear here.' }
    });
    function paint() { var r = rows(); tbl.setRows(r); p.querySelector('#p-total').textContent = 'Total: ' + F.currency(r.reduce(function (a, x) { return a + x.amount; }, 0)); }
    p.querySelector('#p-m').addEventListener('change', paint); paint();
  }

  /* ---------- Defaulters ---------- */
  function defaulters(p) {
    p.innerHTML = '<section class="card" id="d-tbl"></section>';
    var by = {};
    invoiceRows(overdue2).forEach(function (r) { var k = r.i.studentId; by[k] = by[k] || { id: k, s: r.s, name: r.name, cls: r.cls, bal: 0, months: 0, oldest: r.due, rows: [] }; by[k].bal += r.bal; by[k].months++; by[k].rows.push(r); if (r.due < by[k].oldest) by[k].oldest = r.due; });
    function overdue2(i) { return overdue(i); }
    var rows = Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return b.bal - a.bal; });
    var tbl = U.table(p.querySelector('#d-tbl'), {
      rows: rows, pageSize: 12, selectable: true, search: function (r) { return r.name + ' ' + r.cls; }, searchPlaceholder: 'Search student',
      toolbar: '<div class="row" style="margin-left:auto">' + U.btn('Remind selected', { small: true, variant: 'whatsapp', icon: 'whatsapp', id: 'd-wa' }) + U.btn('Remind all', { small: true, id: 'd-all' }) + '</div>',
      columns: [{ key: 'name', label: 'Student', render: function (r) { return '<div class="cell-main">' + U.avatar(r.name) + '<div><div>' + h(r.name) + '</div><div class="cell-sub">' + h(r.cls) + '</div></div></div>'; } }, { key: 'months', label: 'Months overdue', num: true }, { key: 'oldest', label: 'Oldest due date', render: function (r) { return F.date(r.oldest); } }, { key: 'bal', label: 'Total due', num: true, render: function (r) { return '<b style="font-weight:500;color:var(--danger)">' + F.currency(r.bal) + '</b>'; } }],
      actions: [{ id: 'pay', label: 'Receive payment', icon: 'fees', onClick: function (r) { receive(r.rows[0]); } }, { id: 'wa', label: 'Send reminder', icon: 'whatsapp', onClick: function (r) { remind(r.rows); } }],
      empty: { icon: 'check', title: 'No overdue fees', message: 'Everyone has paid on time.' }
    });
    function all(list) { var rr = []; list.forEach(function (x) { rr = rr.concat(x.rows); }); return rr; }
    p.querySelector('#d-wa').addEventListener('click', function () { var s = tbl.selected(); if (!s.length) return U.toast('Tick students first.', 'info'); remind(all(s)); });
    p.querySelector('#d-all').addEventListener('click', function () { if (!rows.length) return U.toast('No defaulters.', 'info'); remind(all(rows)); });
  }

  tabsApi = U.tabs(document.getElementById('tabs'), [{ id: 'overview', label: 'Overview', render: overview }, { id: 'invoices', label: 'Invoices', render: invoices }, { id: 'structure', label: 'Fee structure', render: structure }, { id: 'payments', label: 'Payments', render: payments }, { id: 'defaulters', label: 'Defaulters', render: defaulters }]);

  /* ---------- generate invoices / late fines ---------- */
  document.getElementById('gen').addEventListener('click', async function () {
    var v = await U.form({
      title: 'Generate monthly fees', submitLabel: 'Generate invoices', value: { month: thisMonth, dueDate: thisMonth + '-10' },
      fields: [{ name: 'month', label: 'Month', type: 'month', required: true }, { name: 'classId', label: 'Class', type: 'select', placeholder: 'All classes', options: d.classes.filter(function (c) { return c.sessionId === settings.activeSessionId; }).map(function (c) { return { value: c.id, label: F.className(c) }; }) }, { name: 'dueDate', label: 'Due date', type: 'date', required: true, full: true, hint: 'Students who already have an invoice for the month are skipped.' }]
    });
    if (!v) return;
    var made = 0, skipped = 0, noStructure = {}, plans = {}; d.feePlans.forEach(function (p) { plans[p.id] = p.discountPercent; });
    var list = d.students.filter(function (s) { return s.status === 'active' && s.sessionId === settings.activeSessionId && (!v.classId || s.classId === v.classId); });
    for (var k = 0; k < list.length; k++) {
      var s = list[k];
      if (d.feeInvoices.some(function (i) { return i.studentId === s.id && i.month === v.month; })) { skipped++; continue; }
      var items = d.feeStructures.filter(function (x) { return x.classId === s.classId && x.frequency === 'monthly'; }).map(function (x) { return { head: x.headName, amount: x.amount }; });
      if (!items.length) { noStructure[cn(s.classId)] = 1; continue; }
      var gross = items.reduce(function (a, x) { return a + x.amount; }, 0), disc = Math.round(gross * (plans[s.feePlanId] || 0) / 100);
      await S.insert('feeInvoices', { studentId: s.id, month: v.month, items: items, gross: gross, discount: disc, fine: 0, total: gross - disc, paid: 0, dueDate: v.dueDate, status: 'unpaid' }); made++;
    }
    A.log('create', 'fees', 'Generated ' + made + ' fee invoices for ' + F.monthLabel(v.month));
    U.toast(made + ' invoices created' + (skipped ? ', ' + skipped + ' already existed' : '') + (Object.keys(noStructure).length ? '. No fee structure for class ' + Object.keys(noStructure).join(', ') : ''), made ? 'success' : 'info'); reload();
  });
  document.getElementById('fine').addEventListener('click', async function () {
    var rate = settings.lateFinePerDay; if (!rate) return U.toast('Set a late fine per day in Settings first.', 'info');
    var late = d.feeInvoices.filter(overdue); if (!late.length) return U.toast('No overdue invoices.', 'info');
    var ok = await U.confirm({ title: 'Apply late fines?', message: late.length + ' overdue invoices get Rs ' + rate + ' per day since the due date (up to 25% of the fee). Running it again recalculates, it never doubles.', confirmLabel: 'Apply fines' }); if (!ok) return;
    for (var i = 0; i < late.length; i++) {
      var inv = late[i], days = Math.round((new Date(today) - new Date(inv.dueDate)) / 86400000), fine = Math.min(days * rate, Math.round(inv.gross * 0.25));
      await S.update('feeInvoices', inv.id, { fine: fine, total: inv.gross - inv.discount + fine, status: D.invoiceStatus({ total: inv.gross - inv.discount + fine, paid: inv.paid }) });
    }
    A.log('update', 'fees', 'Applied late fines to ' + late.length + ' invoices'); U.toast('Late fines applied to ' + late.length + ' invoices', 'success'); reload();
  });
})();
