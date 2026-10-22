(async function () {
  var session = await ED.shell.init({ role: 'admin', active: 'backup' });
  if (!session) return;
  var S = ED.storage, F = ED.fmt, U = ED.ui, I = ED.icons, A = ED.audit;
  var LIMIT = 5 * 1024 * 1024;
  function usageHTML() {
    var used = S.usage(), pct = Math.min(100, used / LIMIT * 100);
    return '<div class="meter" role="progressbar" aria-valuenow="' + Math.round(pct) + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + pct + '%;background:' + (pct > 80 ? 'var(--danger)' : 'var(--primary)') + '"></i></div><div class="small muted" style="margin-top:6px">' + (used / 1024 / 1024).toFixed(2) + ' MB used of about 5 MB available in this browser (' + Math.round(pct) + '%). Photos use the most space.</div>';
  }
  document.getElementById('content').innerHTML = U.pageHead('Backup and data', 'Everything is saved in this browser. Download a backup regularly, especially before clearing the browser data.') +
    '<div class="grid-2"><section class="card card-pad stack"><h3>Backup</h3><p class="muted">Downloads one JSON file with all students, teachers, attendance, results, fees, salaries, expenses and settings.</p><button type="button" class="btn btn-primary" id="export" style="align-self:flex-start">' + I.svg('upload', 16) + 'Download backup</button></section>' +
    '<section class="card card-pad stack"><h3>Restore</h3><p class="muted">Restoring replaces all current data with the backup file. Logins come from the backup too.</p><input class="input" type="file" id="file" accept=".json,application/json"><button type="button" class="btn btn-secondary" id="import" style="align-self:flex-start">Restore from file</button></section>' +
    '<section class="card card-pad stack"><h3>Storage</h3><div id="usage">' + usageHTML() + '</div><div class="small muted" id="idb-usage">Paper pictures: checking...</div></section>' +
    '<section class="card card-pad stack"><h3>Reset</h3><p class="muted">Start again with the demo data, or remove everything and begin with an empty school.</p><div class="row" style="flex-wrap:wrap"><button type="button" class="btn btn-secondary" id="reset">Reset to demo data</button><button type="button" class="btn btn-danger" id="wipe">Delete all data</button></div></section></div>';

  document.getElementById('export').addEventListener('click', async function () {
    var blobs = {}; try { blobs = await ED.blobs.exportAll(); } catch (e) {}
    var data = { app: 'edudesk', version: 4, exportedAt: new Date().toISOString(), data: S.exportAll(), blobs: blobs };
    U.download('edudesk-backup-' + F.today() + '.json', JSON.stringify(data), 'application/json'); A.log('create', 'backup', 'Downloaded a backup'); U.toast('Backup downloaded' + (Object.keys(blobs).length ? ' with ' + Object.keys(blobs).length + ' paper pictures' : ''), 'success');
  });
  document.getElementById('import').addEventListener('click', async function () {
    var f = document.getElementById('file').files[0]; if (!f) return U.toast('Choose a backup file first.', 'info');
    var parsed; try { parsed = JSON.parse(await U.readText(f)); } catch (e) { return U.toast('That file is not a valid backup.', 'danger'); }
    if (!parsed || parsed.app !== 'edudesk' || !parsed.data || !parsed.data.users) return U.toast('That file is not an EduDesk backup.', 'danger');
    var ok = await U.confirm({ title: 'Restore this backup?', message: 'All current data is replaced. Backup date: ' + F.date(parsed.exportedAt) + '. You will be signed out.', confirmLabel: 'Restore', danger: true }); if (!ok) return;
    S.importAll(parsed.data); try { await ED.blobs.importAll(parsed.blobs || {}); } catch (e) {} localStorage.removeItem('edudesk:session'); U.toast('Backup restored. Signing out...', 'success'); setTimeout(function () { location.href = '../index.html'; }, 900);
  });
  document.getElementById('reset').addEventListener('click', async function () {
    var ok = await U.confirm({ title: 'Reset to demo data?', message: 'Everything you added is replaced by the demo school. You will be signed out.', confirmLabel: 'Reset', danger: true }); if (!ok) return;
    ED.seed.reset(); localStorage.removeItem('edudesk:session'); location.href = '../index.html';
  });
  document.getElementById('wipe').addEventListener('click', async function () {
    var ok = await U.confirm({ title: 'Delete all data?', message: 'Students, results, fees, everything is removed and cannot be recovered. Only the admin login remains. Download a backup first.', confirmLabel: 'Delete everything', danger: true }); if (!ok) return;
    var admin = (await S.getAll('users')).filter(function (u) { return u.role === 'admin'; });
    var settings = await ED.data.settings();
    ED.seed.clearEverything();
    ['users', 'sessions', 'subjects', 'teachers', 'classes', 'assignments', 'students', 'attendance', 'teacherAttendance', 'timetable', 'holidays', 'exams', 'marks', 'examImages', 'feeStructures', 'feePlans', 'feeInvoices', 'feePayments', 'salaries', 'advances', 'expenses', 'announcements', 'sendHistory', 'auditLog', 'paperScans', 'trash'].forEach(function (c) { S._writeList(c, []); });
    S._writeList('users', admin); S._writeList('sessions', [{ id: 'ses-new', name: String(new Date().getFullYear()), startDate: '', endDate: '', isActive: true }]);
    S._writeList('feePlans', [{ id: 'fp-0', name: 'Standard', discountPercent: 0 }]);
    S._writeList('gradingScale', [['A+', 90, 'Outstanding'], ['A', 80, 'Excellent'], ['B', 70, 'Very good'], ['C', 60, 'Good'], ['D', 50, 'Satisfactory'], ['E', 40, 'Pass'], ['F', 0, 'Fail']].map(function (g, i) { return { id: 'gr-' + (i + 1), grade: g[0], minPercent: g[1], remarks: g[2] }; }));
    S._writeList('expenseCategories', ['Electricity', 'Water', 'Internet', 'Equipment', 'Repair', 'Stationery', 'Rent'].map(function (n, i) { return { id: 'exc-' + (i + 1), name: n, isArchived: false }; }));
    S._writeList('messageTemplates', []);
    S.setObject('settings', Object.assign({}, settings, { activeSessionId: 'ses-new' })); localStorage.setItem('edudesk:seeded', ED.seed.VERSION);
    localStorage.removeItem('edudesk:session'); location.href = '../index.html';
  });
  ED.blobs.estimate().then(function (e) { var el = document.getElementById('idb-usage'); if (el) el.textContent = e && e.usage ? 'Student paper pictures are kept in a separate, much larger browser store. Everything together: ' + (e.usage / 1024 / 1024).toFixed(1) + ' MB' + (e.quota ? ' of about ' + Math.round(e.quota / 1024 / 1024) + ' MB' : '') + '.' : 'Student paper pictures are kept in a separate, much larger browser store.'; });
})();
