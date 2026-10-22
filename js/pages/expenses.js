(async function () {
  var session = await ED.shell.init({ role: 'admin', active: 'expenses' });
  if (!session) return;
  var S = ED.storage, F = ED.fmt, U = ED.ui, I = ED.icons, h = F.esc, A = ED.audit, C = ED.charts;
  var today = F.today(), thisMonth = F.monthKey(today), d;
  var METHODS = ['Cash', 'Bank transfer', 'Cheque', 'JazzCash', 'Easypaisa'].map(function (m) { return { value: m, label: m }; });
  async function fetchAll() { d = await ED.data.load(['expenses', 'expenseCategories']); }
  await fetchAll();
  var catName = function (id) { return (d.map.expenseCategories[id] || { name: '(deleted)' }).name; };

  document.getElementById('content').innerHTML = U.pageHead('Expenses', 'Building bills, equipment, repairs and everything else the school spends on.', U.btn('Add expense', { variant: 'primary', icon: 'plus', id: 'add' })) + '<div id="tabs"></div>';
  var tabsApi;
  async function reload() { await fetchAll(); tabsApi.select(tabsApi.current()); }
  function sumBy(list) { return list.reduce(function (a, e) { return a + e.amount; }, 0); }
  var money = function (v) { return 'Rs ' + (v >= 1000 ? Math.round(v / 100) / 10 + 'k' : v); };

  async function editExpense(x) {
    var active = d.expenseCategories.filter(function (c) { return !c.isArchived || (x && c.id === x.categoryId); });
    if (!active.length) return U.toast('Create a category first (Categories tab).', 'info');
    var v = await U.form({
      title: x ? 'Edit expense' : 'Add expense', size: 'wide', value: x || { date: today, method: 'Cash' },
      fields: [
        { name: 'categoryId', label: 'Category', type: 'select', required: true, placeholder: 'Choose category', options: active.map(function (c) { return { value: c.id, label: c.name }; }) },
        { name: 'amount', label: 'Amount (Rs)', type: 'number', required: true, min: 1, step: 50 },
        { name: 'date', label: 'Date', type: 'date', required: true, max: today },
        { name: 'method', label: 'Payment method', type: 'select', options: METHODS },
        { name: 'description', label: 'Description', full: true, placeholder: 'e.g. Electricity bill for October' },
        { name: 'receipt', label: 'Receipt photo (optional)', type: 'file', full: true }
      ]
    });
    if (!v) return;
    if (x) await S.update('expenses', x.id, v); else await S.insert('expenses', v);
    A.log(x ? 'update' : 'create', 'expenses', (x ? 'Edited' : 'Added') + ' expense ' + F.currency(v.amount) + ' (' + catName(v.categoryId) + ')'); U.toast('Expense saved', 'success'); reload();
  }

  function listTab(p) {
    p.innerHTML = '<div class="filters card card-pad"><div class="field"><label for="x-m">Month</label><input class="input" type="month" id="x-m" value="' + thisMonth + '"></div><div class="field"><label for="x-c">Category</label><select class="select" id="x-c"><option value="">All categories</option>' + U.options(d.expenseCategories, 'id', function (c) { return c.name; }) + '</select></div><div class="row" style="align-self:flex-end"><button type="button" class="btn btn-ghost" id="x-all">Show all months</button></div></div><div id="x-sum"></div><section class="card" id="x-tbl"></section>';
    function rows() { var m = p.querySelector('#x-m').value, c = p.querySelector('#x-c').value; return d.expenses.filter(function (e) { return (!m || F.monthKey(e.date) === m) && (!c || e.categoryId === c); }).map(function (e) { return Object.assign({}, e, { cat: catName(e.categoryId) }); }).sort(function (a, b) { return b.date.localeCompare(a.date); }); }
    var tbl = U.table(p.querySelector('#x-tbl'), {
      rows: rows(), pageSize: 10, search: function (r) { return r.cat + ' ' + r.description + ' ' + r.method; }, searchPlaceholder: 'Search expenses',
      toolbar: '<div class="row" style="margin-left:auto">' + U.btn('Export CSV', { id: 'x-csv', small: true }) + '</div>',
      columns: [{ key: 'date', label: 'Date', render: function (r) { return F.date(r.date); } }, { key: 'cat', label: 'Category', render: function (r) { return U.badge(r.cat, 'primary'); } }, { key: 'description', label: 'Description' }, { key: 'method', label: 'Method' }, { key: 'receipt', label: 'Receipt', sortable: false, render: function (r) { return r.receipt ? '<button type="button" class="btn btn-ghost btn-sm" data-receipt="' + h(r.id) + '">View</button>' : '<span class="muted">-</span>'; } }, { key: 'amount', label: 'Amount', num: true, render: function (r) { return F.currency(r.amount); } }],
      actions: [{ id: 'e', label: 'Edit expense', icon: 'settings', onClick: editExpense }, { id: 'x', label: 'Delete expense', icon: 'x', danger: true, onClick: async function (r) { var ok = await U.confirm({ title: 'Delete this expense?', message: F.currency(r.amount) + ' (' + r.cat + ') will be removed.', confirmLabel: 'Delete', danger: true }); if (!ok) return; await S.remove('expenses', r.id); A.log('delete', 'expenses', 'Deleted expense ' + F.currency(r.amount) + ' (' + r.cat + ')'); U.toast('Expense deleted', 'success'); reload(); } }],
      empty: { icon: 'expenses', title: 'No expenses for this selection', message: 'Use Add expense to record one.' }
    });
    function paint() { var r = rows(); tbl.setRows(r); p.querySelector('#x-sum').innerHTML = '<div class="grid-stats">' + U.stat('Total spent', F.currency(sumBy(r)), r.length + ' expenses') + U.stat('Biggest category', r.length ? h(topCat(r)) : '-', 'In this selection') + '</div>'; }
    function topCat(r) { var by = {}; r.forEach(function (e) { by[e.cat] = (by[e.cat] || 0) + e.amount; }); return Object.keys(by).sort(function (a, b) { return by[b] - by[a]; })[0]; }
    ['x-m', 'x-c'].forEach(function (id) { p.querySelector('#' + id).addEventListener('change', paint); });
    p.querySelector('#x-all').addEventListener('click', function () { p.querySelector('#x-m').value = ''; paint(); });
    p.querySelector('#x-csv').addEventListener('click', function () { U.download('expenses.csv', U.toCSV([['date', 'category', 'description', 'method', 'amount']].concat(tbl.visible().map(function (r) { return [r.date, r.cat, r.description, r.method, r.amount]; }))), 'text/csv'); });
    p.addEventListener('click', function (e) { var b = e.target.closest('[data-receipt]'); if (!b) return; var x = d.map.expenses[b.dataset.receipt]; U.view('Receipt: ' + catName(x.categoryId), '<img alt="Receipt" style="max-width:100%;border-radius:8px" src="' + x.receipt + '">'); });
    paint();
  }

  function catsTab(p) {
    p.innerHTML = '<div class="row" style="justify-content:flex-end">' + U.btn('Add category', { variant: 'primary', icon: 'plus', id: 'c-add' }) + '</div><section class="card" id="c-tbl"></section>';
    function rows() { return d.expenseCategories.map(function (c) { var mine = d.expenses.filter(function (e) { return e.categoryId === c.id; }); return { id: c.id, c: c, name: c.name, count: mine.length, total: sumBy(mine), status: c.isArchived ? 'inactive' : 'active' }; }); }
    var tbl = U.table(p.querySelector('#c-tbl'), {
      rows: rows(), pageSize: 15, columns: [{ key: 'name', label: 'Category' }, { key: 'count', label: 'Expenses', num: true }, { key: 'total', label: 'Total', num: true, render: function (r) { return F.currency(r.total); } }, { key: 'status', label: 'Status', render: function (r) { return U.badge(r.status === 'active' ? 'In use' : 'Archived', r.status === 'active' ? 'present' : ''); } }],
      actions: [{ id: 'e', label: 'Rename category', icon: 'settings', onClick: function (r) { edit(r.c); } }, { id: 'a', label: 'Archive or restore', icon: 'check', onClick: async function (r) { await S.update('expenseCategories', r.id, { isArchived: !r.c.isArchived }); A.log('update', 'expenses', (r.c.isArchived ? 'Restored' : 'Archived') + ' category ' + r.name); reload(); } }, { id: 'x', label: 'Delete category', icon: 'x', danger: true, onClick: del }],
      empty: { icon: 'expenses', title: 'No categories', message: 'Add categories like Electricity or Equipment.' }
    });
    async function edit(c) {
      var v = await U.form({ title: c ? 'Rename category' : 'Add category', value: c || {}, fields: [{ name: 'name', label: 'Category name', required: true, full: true }], validate: function (x) { return d.expenseCategories.some(function (o) { return (!c || o.id !== c.id) && o.name.toLowerCase() === x.name.toLowerCase(); }) ? 'That category already exists.' : null; } });
      if (!v) return;
      if (c) await S.update('expenseCategories', c.id, { name: v.name }); else await S.insert('expenseCategories', { name: v.name, isArchived: false });
      A.log(c ? 'update' : 'create', 'expenses', (c ? 'Renamed' : 'Created') + ' category ' + v.name); U.toast('Category saved', 'success'); reload();
    }
    async function del(r) {
      if (r.count) {
        var others = d.expenseCategories.filter(function (c) { return c.id !== r.id; }); if (!others.length) return U.toast('Create another category first so the expenses can move there.', 'danger');
        var v = await U.form({ title: 'Delete ' + r.name + '?', submitLabel: 'Move and delete', fields: [{ name: 'to', label: 'Move its ' + r.count + ' expenses to', type: 'select', required: true, placeholder: 'Choose category', full: true, options: others.map(function (c) { return { value: c.id, label: c.name }; }) }] });
        if (!v) return;
        S._writeList('expenses', S._readList('expenses').map(function (e) { return e.categoryId === r.id ? Object.assign({}, e, { categoryId: v.to }) : e; }));
      } else { var ok = await U.confirm({ title: 'Delete ' + r.name + '?', message: 'This cannot be undone.', confirmLabel: 'Delete', danger: true }); if (!ok) return; }
      await S.remove('expenseCategories', r.id); A.log('delete', 'expenses', 'Deleted category ' + r.name); U.toast('Category deleted', 'success'); reload();
    }
    p.querySelector('#c-add').addEventListener('click', function () { edit(null); });
  }

  function reportTab(p) {
    p.innerHTML = '<div class="filters card card-pad"><div class="field"><label for="r-m">Month</label><input class="input" type="month" id="r-m" value="' + thisMonth + '"></div></div><div id="r-out"></div>';
    function paint() {
      var m = p.querySelector('#r-m').value, list = d.expenses.filter(function (e) { return F.monthKey(e.date) === m; }), total = sumBy(list), by = {};
      list.forEach(function (e) { by[catName(e.categoryId)] = (by[catName(e.categoryId)] || 0) + e.amount; });
      var names = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; }), months = [], k = m; for (var i = 0; i < 6; i++) { months.unshift(k); k = F.prevMonth(k); }
      p.querySelector('#r-out').innerHTML = !list.length ? '<div class="card">' + U.empty('expenses', 'No expenses in ' + F.monthLabel(m), '') + '</div>' :
        '<div class="grid-2"><section class="card chart-card chart"><h3>By category</h3>' + C.donut({ items: names.map(function (n) { return { label: n, value: by[n] }; }), center: money(total), centerSub: F.monthLabel(m), fmt: money }) + '</section><section class="card chart-card chart"><h3>Last 6 months</h3>' + C.bar({ labels: months.map(F.monthLabel), series: [{ name: 'Spent', values: months.map(function (x) { return sumBy(d.expenses.filter(function (e) { return F.monthKey(e.date) === x; })); }) }], fmt: money }) + '</section></div>' +
        '<section class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Category</th><th class="num">Amount</th><th class="num">Share</th></tr></thead><tbody>' + names.map(function (n) { return '<tr><td>' + h(n) + '</td><td class="num">' + F.currency(by[n]) + '</td><td class="num">' + F.pct(by[n] / total * 100) + '</td></tr>'; }).join('') + '<tr><td><b style="font-weight:500">Total</b></td><td class="num"><b style="font-weight:500">' + F.currency(total) + '</b></td><td></td></tr></tbody></table></div></section>';
    }
    p.querySelector('#r-m').addEventListener('change', paint); paint();
  }
  tabsApi = U.tabs(document.getElementById('tabs'), [{ id: 'list', label: 'Expenses', render: listTab }, { id: 'cats', label: 'Categories', render: catsTab }, { id: 'report', label: 'Monthly report', render: reportTab }]);
  document.getElementById('add').addEventListener('click', function () { editExpense(null); });
  if (new URLSearchParams(location.search).get('add')) editExpense(null);
})();
