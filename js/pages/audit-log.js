(async function () {
  var session = await ED.shell.init({ role: 'admin', active: 'audit-log' });
  if (!session) return;
  var S = ED.storage, F = ED.fmt, U = ED.ui, h = F.esc;
  var log = (await S.getAll('auditLog')).sort(function (a, b) { return b.at.localeCompare(a.at); });
  var entities = log.map(function (x) { return x.entity; }).filter(function (x, i, a) { return a.indexOf(x) === i; }).sort();
  var users = log.map(function (x) { return x.userName; }).filter(function (x, i, a) { return a.indexOf(x) === i; }).sort();
  document.getElementById('content').innerHTML = U.pageHead('Audit log', 'Who changed what and when. Marks, fees, salaries and permissions are all recorded here.', U.btn('Export CSV', { id: 'csv' })) +
    '<div class="filters card card-pad"><div class="field"><label for="l-e">Area</label><select class="select" id="l-e"><option value="">All areas</option>' + entities.map(function (e) { return '<option>' + h(e) + '</option>'; }).join('') + '</select></div><div class="field"><label for="l-u">User</label><select class="select" id="l-u"><option value="">All users</option>' + users.map(function (e) { return '<option>' + h(e) + '</option>'; }).join('') + '</select></div></div><section class="card" id="tbl"></section>';
  function rows() { var e = document.getElementById('l-e').value, u = document.getElementById('l-u').value; return log.filter(function (x) { return (!e || x.entity === e) && (!u || x.userName === u); }); }
  var tbl = U.table(document.getElementById('tbl'), {
    rows: rows(), pageSize: 15, search: function (r) { return r.summary + ' ' + r.userName + ' ' + r.entity; }, searchPlaceholder: 'Search the log',
    columns: [{ key: 'at', label: 'When', render: function (r) { return F.date(r.at) + '<div class="cell-sub">' + F.time(r.at) + '</div>'; } }, { key: 'userName', label: 'User', render: function (r) { return h(r.userName) + '<div class="cell-sub">' + h(r.role) + '</div>'; } }, { key: 'action', label: 'Action', render: function (r) { return U.badge(r.action); } }, { key: 'entity', label: 'Area', render: function (r) { return U.badge(r.entity, 'primary'); } }, { key: 'summary', label: 'What happened' }],
    empty: { icon: 'audit', title: 'Nothing recorded yet', message: 'Changes you make will be listed here.' }
  });
  ['l-e', 'l-u'].forEach(function (id) { document.getElementById(id).addEventListener('change', function () { tbl.setRows(rows()); }); });
  document.getElementById('csv').addEventListener('click', function () { U.download('audit-log.csv', U.toCSV([['when', 'user', 'role', 'action', 'area', 'summary']].concat(tbl.visible().map(function (r) { return [r.at, r.userName, r.role, r.action, r.entity, r.summary]; }))), 'text/csv'); });
})();
