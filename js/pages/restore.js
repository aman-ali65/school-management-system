(async function () {
  var session = await ED.shell.init({ role: 'admin', active: 'restore' });
  if (!session) return;
  var S = ED.storage, F = ED.fmt, U = ED.ui, h = F.esc, A = ED.audit;
  var items;
  async function fetchAll() { items = (await S.getAll('trash')).sort(function (a, b) { return b.deletedAt.localeCompare(a.deletedAt); }); }
  await fetchAll();
  document.getElementById('content').innerHTML = U.pageHead('Restore deleted', 'Students you removed from a batch or deleted are kept here with all their attendance, marks, fees and papers. Restore brings everything back.', U.btn('Empty the bin', { variant: 'danger', id: 'empty' })) +
    '<div class="callout">' + ED.icons.svg('info', 18) + '<span>Nothing here counts anywhere (reports, fees, attendance) until you restore it.</span></div><section class="card" id="tbl"></section>';

  function rows() { return items.map(function (t) { return Object.assign({}, t, { when: t.deletedAt }); }); }
  var tbl = U.table(document.getElementById('tbl'), {
    rows: rows(), pageSize: 10, search: function (r) { return r.name + ' ' + r.label + ' ' + r.deletedBy; }, searchPlaceholder: 'Search deleted students',
    columns: [
      { key: 'name', label: 'Student', render: function (r) { return '<div class="cell-main">' + U.avatar(r.name) + '<div><div>' + h(r.name) + '</div><div class="cell-sub">' + h(r.label) + '</div></div></div>'; } },
      { key: 'counts', label: 'Records kept', sortable: false, render: function (r) { var c = r.counts || {}; return h((c.attendance || 0) + ' attendance, ' + (c.marks || 0) + ' marks, ' + (c.invoices || 0) + ' fee records' + (c.papers ? ', ' + c.papers + ' paper(s)' : '')); } },
      { key: 'when', label: 'Deleted', render: function (r) { return F.date(r.deletedAt) + '<div class="cell-sub">' + F.time(r.deletedAt) + ' by ' + h(r.deletedBy) + '</div>'; } }
    ],
    actions: [{ id: 'restore', label: 'Restore', icon: 'history', onClick: restore }, { id: 'purge', label: 'Delete forever', icon: 'x', danger: true, onClick: purge }],
    empty: { icon: 'history', title: 'The bin is empty', message: 'Removed or deleted students appear here.' }
  });
  async function refresh() { await fetchAll(); tbl.setRows(rows(), true); }

  async function restore(t) {
    var p = t.payload, st = p.student, classes = await S.getAll('classes'), students = S._readList('students');
    if (!classes.some(function (c) { return c.id === st.classId; })) return U.toast('The class of this student was deleted. Create it again first, then restore.', 'danger');
    if (students.some(function (s) { return s.id === st.id; })) return U.toast('This student record already exists.', 'danger');
    if (students.some(function (s) { return (s.personId || s.id) === (st.personId || st.id) && s.sessionId === st.sessionId; })) return U.toast(st.name + ' is already enrolled in that batch, so this record cannot come back.', 'danger');
    var roll = st.rollNo, note = '';
    if (students.some(function (s) { return s.classId === st.classId && String(s.rollNo) === String(roll); })) {
      var max = Math.max.apply(null, [0].concat(students.filter(function (s) { return s.classId === st.classId; }).map(function (s) { return Number(s.rollNo) || 0; })));
      roll = String(max + 1).padStart(2, '0'); note = ' Roll number ' + st.rollNo + ' was taken, so the new roll number is ' + roll + '.';
    }
    var ok = await U.confirm({ title: 'Restore ' + t.name + '?', message: t.label + ' comes back with all its records.' + note, confirmLabel: 'Restore' }); if (!ok) return;
    S._writeList('students', students.concat([Object.assign({}, st, { rollNo: roll })]));
    [['attendance', 'attendance'], ['marks', 'marks'], ['feeInvoices', 'invoices'], ['feePayments', 'payments'], ['paperScans', 'papers']].forEach(function (x) { S._writeList(x[0], S._readList(x[0]).concat(p[x[1]] || [])); });
    await S.remove('trash', t.id); A.log('update', 'student', 'Restored ' + t.name + ' (' + t.label + ')'); U.toast(t.name + ' restored', 'success'); refresh();
  }
  async function dropBlobs(t) { var ids = []; ((t.payload && t.payload.papers) || []).forEach(function (sc) { ids = ids.concat(sc.pages || []); }); if (ids.length) { try { await ED.blobs.delMany(ids); } catch (e) {} } }
  async function purge(t) {
    var ok = await U.confirm({ title: 'Delete ' + t.name + ' forever?', message: 'Their records for ' + t.label + ' are removed for good and cannot be restored.', confirmLabel: 'Delete forever', danger: true }); if (!ok) return;
    await dropBlobs(t); await S.remove('trash', t.id); A.log('delete', 'student', 'Permanently deleted ' + t.name + ' (' + t.label + ')'); U.toast('Deleted for good', 'success'); refresh();
  }
  document.getElementById('empty').addEventListener('click', async function () {
    if (!items.length) return U.toast('The bin is already empty.', 'info');
    var ok = await U.confirm({ title: 'Empty the bin?', message: items.length + ' items are deleted for good. This cannot be undone.', confirmLabel: 'Empty the bin', danger: true }); if (!ok) return;
    for (var i = 0; i < items.length; i++) await dropBlobs(items[i]);
    S._writeList('trash', []); A.log('delete', 'student', 'Emptied the restore bin'); U.toast('Bin emptied', 'success'); refresh();
  });
})();
