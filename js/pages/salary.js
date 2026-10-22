(async function () {
  var session = await ED.shell.init({ role: 'admin', active: 'salary' });
  if (!session) return;
  var S = ED.storage, F = ED.fmt, U = ED.ui, I = ED.icons, h = F.esc, A = ED.audit, D = ED.data;
  var today = F.today(), thisMonth = F.monthKey(today), settings, d;
  var METHODS = ['Bank transfer', 'Cash', 'Cheque', 'JazzCash', 'Easypaisa'].map(function (m) { return { value: m, label: m }; });
  async function fetchAll() { d = await D.load(['teachers', 'salaries', 'advances', 'teacherAttendance']); settings = await D.settings(); }
  await fetchAll();
  var tname = function (id) { return (d.map.teachers[id] || { name: '(deleted)' }).name; };

  document.getElementById('content').innerHTML = U.pageHead('Salary', 'Monthly salary with automatic deductions from teacher attendance, advances and salary slips.', U.btn('Generate salaries', { variant: 'primary', icon: 'plus', id: 'gen' })) + '<div id="tabs"></div>';
  var tabsApi;
  async function reload() { await fetchAll(); tabsApi.select(tabsApi.current()); }

  function autoDeduction(t, month) {
    var mine = d.teacherAttendance.filter(function (a) { return a.teacherId === t.id && F.monthKey(a.date) === month; });
    var absent = mine.filter(function (a) { return a.status === 'A'; }).length, late = mine.filter(function (a) { return a.status === 'L'; }).length;
    var perDay = Math.round((t.baseSalary || 0) / (settings.absentDeductionDivisor || 26));
    return { absent: absent, late: late, amount: absent * perDay + late * (settings.lateDeduction || 0), perDay: perDay };
  }
  function advanceCut(teacherId) {
    var cut = 0; d.advances.filter(function (a) { return a.teacherId === teacherId && a.balance > 0; }).forEach(function (a) { cut += Math.min(a.monthlyCut, a.balance); }); return cut;
  }
  function net(r) { return Math.max(0, (r.base || 0) + (r.allowances || 0) - (r.deductions || 0) - (r.advance || 0)); }

  function salaryTab(p) {
    p.innerHTML = '<div class="filters card card-pad"><div class="field"><label for="s-m">Month</label><input class="input" type="month" id="s-m" value="' + thisMonth + '"></div></div><div id="s-stats"></div><section class="card" id="s-tbl"></section>';
    function rows() { var m = p.querySelector('#s-m').value; return d.salaries.filter(function (s) { return s.month === m; }).map(function (s) { return Object.assign({}, s, { name: tname(s.teacherId) }); }); }
    var tbl = U.table(p.querySelector('#s-tbl'), {
      rows: rows(), pageSize: 12, search: function (r) { return r.name; }, searchPlaceholder: 'Search teacher',
      columns: [
        { key: 'name', label: 'Teacher', render: function (r) { return '<div class="cell-main">' + U.avatar(r.name) + '<span>' + h(r.name) + '</span></div>'; } },
        { key: 'base', label: 'Base', num: true, render: function (r) { return F.currency(r.base); } },
        { key: 'allowances', label: 'Allowances', num: true, render: function (r) { return F.currency(r.allowances); } },
        { key: 'deductions', label: 'Deductions', num: true, render: function (r) { return F.currency(r.deductions); } },
        { key: 'advance', label: 'Advance cut', num: true, render: function (r) { return F.currency(r.advance); } },
        { key: 'net', label: 'Net pay', num: true, render: function (r) { return '<b style="font-weight:500">' + F.currency(r.net) + '</b>'; } },
        { key: 'status', label: 'Status', render: function (r) { return U.statusBadge('salary', r.status); } }
      ],
      actions: [
        { id: 'edit', label: 'Edit salary', icon: 'settings', show: function (r) { return r.status !== 'paid'; }, onClick: edit },
        { id: 'pay', label: 'Mark as paid', icon: 'check', show: function (r) { return r.status !== 'paid'; }, onClick: pay },
        { id: 'slip', label: 'Print salary slip', icon: 'results', onClick: slip },
        { id: 'del', label: 'Delete', icon: 'x', danger: true, show: function (r) { return r.status !== 'paid'; }, onClick: async function (r) { var ok = await U.confirm({ title: 'Delete this salary record?', message: 'You can generate it again.', confirmLabel: 'Delete', danger: true }); if (!ok) return; await S.remove('salaries', r.id); A.log('delete', 'salary', 'Deleted salary record of ' + r.name); await reload(); } }
      ],
      empty: { icon: 'salary', title: 'No salary records for this month', message: 'Use Generate salaries to create them for all active teachers.' }
    });
    function paint() {
      var r = rows(), total = r.reduce(function (a, x) { return a + x.net; }, 0), paid = r.filter(function (x) { return x.status === 'paid'; }).reduce(function (a, x) { return a + x.net; }, 0);
      tbl.setRows(r);
      p.querySelector('#s-stats').innerHTML = '<div class="grid-stats">' + U.stat('Total payable', F.currency(total), r.length + ' teachers') + U.stat('Paid', F.currency(paid), r.filter(function (x) { return x.status === 'paid'; }).length + ' teachers', 'good') + U.stat('Pending', F.currency(total - paid), r.filter(function (x) { return x.status !== 'paid'; }).length + ' teachers', total - paid ? 'bad' : 'good') + '</div>';
    }
    p.querySelector('#s-m').addEventListener('change', paint); paint();
  }
  async function edit(r) {
    var t = d.map.teachers[r.teacherId], auto = t ? autoDeduction(t, r.month) : { amount: 0, absent: 0, late: 0 };
    var v = await U.form({
      title: 'Edit salary: ' + r.name + ' (' + F.monthLabel(r.month) + ')', size: 'wide', value: r,
      fields: [
        { name: 'allowances', label: 'Allowances (Rs)', type: 'number', min: 0, step: 500 },
        { name: 'deductions', label: 'Deductions (Rs)', type: 'number', min: 0, step: 100, hint: 'From attendance: ' + auto.absent + ' absent, ' + auto.late + ' late = ' + F.currency(auto.amount) },
        { name: 'advance', label: 'Advance cut (Rs)', type: 'number', min: 0, step: 500 },
        { name: 'notes', label: 'Notes', full: true }
      ]
    });
    if (!v) return;
    var upd = Object.assign({}, v, { base: r.base }); upd.net = net(upd);
    await S.update('salaries', r.id, { allowances: v.allowances || 0, deductions: v.deductions || 0, advance: v.advance || 0, notes: v.notes, net: upd.net });
    A.log('update', 'salary', 'Edited salary of ' + r.name + ' for ' + F.monthLabel(r.month)); U.toast('Salary updated', 'success'); reload();
  }
  async function pay(r) {
    var v = await U.form({ title: 'Pay ' + r.name + ': ' + F.currency(r.net), submitLabel: 'Mark as paid', value: { method: 'Bank transfer', date: today }, fields: [{ name: 'method', label: 'Payment method', type: 'select', options: METHODS }, { name: 'date', label: 'Payment date', type: 'date', required: true, max: today }] });
    if (!v) return;
    if (!r.advanceApplied && r.advance > 0) {
      var left = r.advance;
      for (var i = 0; i < d.advances.length && left > 0; i++) { var a = d.advances[i]; if (a.teacherId !== r.teacherId || a.balance <= 0) continue; var cut = Math.min(a.balance, left); await S.update('advances', a.id, { balance: a.balance - cut }); left -= cut; }
    }
    await S.update('salaries', r.id, { status: 'paid', paidDate: v.date, method: v.method, advanceApplied: true });
    A.log('pay', 'salary', 'Paid salary ' + F.currency(r.net) + ' to ' + r.name + ' for ' + F.monthLabel(r.month)); U.toast('Salary marked as paid', 'success'); await reload();
  }
  function slip(r) {
    U.print(U.docHeader(settings, 'Salary slip', F.monthLabel(r.month)) + '<div class="grid box"><div>Teacher: <b>' + h(r.name) + '</b></div><div>Status: <b>' + (r.status === 'paid' ? 'Paid on ' + F.date(r.paidDate) : 'Pending') + '</b></div></div>' +
      '<table><thead><tr><th>Description</th><th class="n">Amount</th></tr></thead><tbody><tr><td>Base salary</td><td class="n">' + F.currency(r.base) + '</td></tr><tr><td>Allowances</td><td class="n">' + F.currency(r.allowances) + '</td></tr><tr><td>Attendance deductions</td><td class="n">- ' + F.currency(r.deductions) + '</td></tr><tr><td>Advance recovery</td><td class="n">- ' + F.currency(r.advance) + '</td></tr></tbody><tfoot><tr class="tot"><td>Net pay</td><td class="n">' + F.currency(r.net) + '</td></tr></tfoot></table>' + (r.notes ? '<p class="muted">Notes: ' + h(r.notes) + '</p>' : '') + '<div class="sig"><div>Accountant</div><div>Teacher</div></div>', 'Salary slip');
  }

  function advancesTab(p) {
    p.innerHTML = '<div class="row" style="justify-content:flex-end">' + U.btn('New advance', { variant: 'primary', icon: 'plus', id: 'a-add' }) + '</div><section class="card" id="a-tbl"></section>';
    var tbl = U.table(p.querySelector('#a-tbl'), {
      rows: d.advances.map(function (a) { return Object.assign({}, a, { name: tname(a.teacherId) }); }), pageSize: 10,
      columns: [{ key: 'name', label: 'Teacher', render: function (r) { return '<div class="cell-main">' + U.avatar(r.name) + '<span>' + h(r.name) + '</span></div>'; } }, { key: 'date', label: 'Given on', render: function (r) { return F.date(r.date); } }, { key: 'amount', label: 'Amount', num: true, render: function (r) { return F.currency(r.amount); } }, { key: 'monthlyCut', label: 'Monthly cut', num: true, render: function (r) { return F.currency(r.monthlyCut); } }, { key: 'balance', label: 'Balance', num: true, render: function (r) { return r.balance > 0 ? F.currency(r.balance) : U.badge('Cleared', 'present'); } }],
      actions: [{ id: 'del', label: 'Delete advance', icon: 'x', danger: true, onClick: async function (r) { var ok = await U.confirm({ title: 'Delete this advance?', message: 'It will no longer be deducted from salary.', confirmLabel: 'Delete', danger: true }); if (!ok) return; await S.remove('advances', r.id); A.log('delete', 'salary', 'Deleted advance of ' + r.name); await reload(); } }],
      empty: { icon: 'salary', title: 'No advances', message: 'Advance salary given to teachers appears here.' }
    });
    p.querySelector('#a-add').addEventListener('click', async function () {
      var v = await U.form({ title: 'New advance', submitLabel: 'Save advance', value: { date: today }, fields: [{ name: 'teacherId', label: 'Teacher', type: 'select', required: true, placeholder: 'Choose teacher', full: true, options: d.teachers.filter(function (t) { return t.status === 'active'; }).map(function (t) { return { value: t.id, label: t.name }; }) }, { name: 'amount', label: 'Amount (Rs)', type: 'number', required: true, min: 1, step: 500 }, { name: 'monthlyCut', label: 'Cut every month (Rs)', type: 'number', required: true, min: 1, step: 500 }, { name: 'date', label: 'Date', type: 'date', required: true, max: today }], validate: function (x) { return x.monthlyCut > x.amount ? 'Monthly cut cannot be more than the advance.' : null; } });
      if (!v) return;
      await S.insert('advances', { teacherId: v.teacherId, amount: v.amount, monthlyCut: v.monthlyCut, balance: v.amount, date: v.date });
      A.log('create', 'salary', 'Gave advance ' + F.currency(v.amount) + ' to ' + tname(v.teacherId)); U.toast('Advance saved. It will be deducted automatically.', 'success'); reload();
    });
  }
  tabsApi = U.tabs(document.getElementById('tabs'), [{ id: 'salary', label: 'Monthly salary', render: salaryTab }, { id: 'advances', label: 'Advances', render: advancesTab }]);

  document.getElementById('gen').addEventListener('click', async function () {
    var v = await U.form({ title: 'Generate salaries', submitLabel: 'Generate', value: { month: thisMonth }, fields: [{ name: 'month', label: 'Month', type: 'month', required: true, full: true, hint: 'Deductions come from teacher attendance (' + F.currency(settings.lateDeduction) + ' per late, base/' + settings.absentDeductionDivisor + ' per absent day). Advances are deducted automatically.' }] });
    if (!v) return;
    var made = 0;
    for (var i = 0; i < d.teachers.length; i++) {
      var t = d.teachers[i]; if (t.status !== 'active' || d.salaries.some(function (s) { return s.teacherId === t.id && s.month === v.month; })) continue;
      var rec = { teacherId: t.id, month: v.month, base: t.baseSalary || 0, allowances: 0, deductions: autoDeduction(t, v.month).amount, advance: advanceCut(t.id), status: 'pending', paidDate: '', method: '', notes: '', advanceApplied: false };
      rec.net = net(rec); await S.insert('salaries', rec); made++;
    }
    A.log('create', 'salary', 'Generated ' + made + ' salary records for ' + F.monthLabel(v.month));
    U.toast(made ? made + ' salary records created' : 'All teachers already have a salary record for that month.', made ? 'success' : 'info'); reload();
  });
})();
