(async function () {
  var session = await ED.shell.init({ role: 'admin', active: 'settings' });
  if (!session) return;
  var S = ED.storage, F = ED.fmt, U = ED.ui, I = ED.icons, h = F.esc, A = ED.audit, D = ED.data;
  var st = await D.settings(), d;
  async function fetchAll() { d = await D.load(['sessions', 'holidays', 'classes']); }
  await fetchAll();
  async function saveSettings(patch, msg, what) {
    st = Object.assign({}, st, patch, patch.permissions ? { permissions: Object.assign({}, st.permissions, patch.permissions) } : {});
    await S.setObject('settings', st); A.log('update', 'settings', what); U.toast(msg || 'Settings saved', 'success');
  }
  function switchRow(id, label, hint, on) {
    return '<div class="row-between" style="padding:10px 0;border-bottom:1px solid var(--border)"><div><div>' + label + '</div><div class="small muted">' + hint + '</div></div><label class="switch"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + ' aria-label="' + label + '"><span></span></label></div>';
  }
  document.getElementById('content').innerHTML = U.pageHead('Settings', 'School details, session, teacher permissions and the rules used for fines and deductions.') +
    '<div class="grid-2"><div class="stack">' +
    '<section class="card card-pad stack"><h3>School details</h3><div class="field"><label for="s-name">School name</label><input class="input" id="s-name" value="' + h(st.schoolName) + '"></div><div class="field"><label for="s-addr">Address</label><input class="input" id="s-addr" value="' + h(st.address) + '"></div><div class="field"><label for="s-phone">Phone</label><input class="input" id="s-phone" value="' + h(st.phone) + '"></div><button type="button" class="btn btn-primary" id="s-save" style="align-self:flex-start">Save details</button></section>' +
    '<section class="card card-pad"><h3 style="margin-bottom:4px">Teacher permissions</h3>' + switchRow('p-add', 'Teachers can add and edit students', 'Only in their own classes.', st.permissions.teacherCanAddStudents) + switchRow('p-pub', 'Teachers can publish results', 'Otherwise only the admin publishes.', st.permissions.teacherCanPublish) + switchRow('p-msg', 'Teachers can message parents', 'WhatsApp messages for their own classes.', st.permissions.teacherCanMessage) + '</section>' +
    '<section class="card card-pad stack"><h3>Rules for attendance, fines and salary</h3><div class="form-grid"><div class="field"><label for="r-att">Low attendance limit (%)</label><input class="input" id="r-att" type="number" min="1" max="100" value="' + st.attendanceThreshold + '"></div><div class="field"><label for="r-fine">Late fee fine per day (Rs)</label><input class="input" id="r-fine" type="number" min="0" value="' + st.lateFinePerDay + '"></div><div class="field"><label for="r-div">Salary days in a month</label><input class="input" id="r-div" type="number" min="20" max="31" value="' + st.absentDeductionDivisor + '"></div><div class="field"><label for="r-late">Deduction per late arrival (Rs)</label><input class="input" id="r-late" type="number" min="0" value="' + st.lateDeduction + '"></div></div><button type="button" class="btn btn-primary" id="r-save" style="align-self:flex-start">Save rules</button></section></div>' +
    '<div class="stack"><section class="card"><div class="card-head"><h3>Batches</h3><button type="button" class="btn btn-secondary btn-sm" id="ses-add">Start new batch</button></div><div id="ses-tbl"></div></section>' +
    '<section class="card"><div class="card-head"><h3>Holidays</h3><button type="button" class="btn btn-secondary btn-sm" id="hol-add">Add holiday</button></div><div id="hol-tbl"></div></section></div></div>';

  document.getElementById('s-save').addEventListener('click', function () {
    var n = document.getElementById('s-name').value.trim(); if (!n) return U.toast('School name is required.', 'danger');
    saveSettings({ schoolName: n, address: document.getElementById('s-addr').value.trim(), phone: document.getElementById('s-phone').value.trim() }, 'School details saved', 'Updated school details');
  });
  [['p-add', 'teacherCanAddStudents'], ['p-pub', 'teacherCanPublish'], ['p-msg', 'teacherCanMessage']].forEach(function (x) {
    document.getElementById(x[0]).addEventListener('change', function (e) { var p = {}; p[x[1]] = e.target.checked; saveSettings({ permissions: p }, 'Permission updated', 'Permission ' + x[1] + ' set to ' + e.target.checked); });
  });
  document.getElementById('r-save').addEventListener('click', function () {
    var v = { attendanceThreshold: Number(document.getElementById('r-att').value), lateFinePerDay: Number(document.getElementById('r-fine').value), absentDeductionDivisor: Number(document.getElementById('r-div').value), lateDeduction: Number(document.getElementById('r-late').value) };
    if (!(v.attendanceThreshold >= 1 && v.attendanceThreshold <= 100) || v.lateFinePerDay < 0 || !(v.absentDeductionDivisor >= 20 && v.absentDeductionDivisor <= 31) || v.lateDeduction < 0) return U.toast('Please enter valid numbers.', 'danger');
    saveSettings(v, 'Rules saved', 'Updated attendance, fine and salary rules');
  });

  async function batchRows() {
    var x = await D.load(['sessions', 'classes', 'students']);
    return x.sessions.map(function (b) { return Object.assign({}, b, { classes: x.classes.filter(function (c) { return c.sessionId === b.id; }).length, kids: x.students.filter(function (z) { return z.sessionId === b.id; }).length }); });
  }
  var sesTbl = U.table(document.getElementById('ses-tbl'), {
    rows: [], pageSize: 8,
    columns: [{ key: 'name', label: 'Batch', render: function (r) { return h(r.name) + (r.id === st.activeSessionId ? ' ' + U.badge('Current', 'present') : ''); } }, { key: 'classes', label: 'Classes', num: true }, { key: 'kids', label: 'Students', num: true }],
    actions: [
      { id: 'act', label: 'Make current', icon: 'check', show: function (r) { return r.id !== st.activeSessionId; }, onClick: async function (r) {
        var ok = await U.confirm({ title: 'Make ' + r.name + ' the current batch?', message: 'Teachers will only see the classes and subjects assigned to them in this batch. Other batches stay available to the admin.', confirmLabel: 'Make current' }); if (!ok) return;
        await saveSettings({ activeSessionId: r.id }, r.name + ' is now the current batch', 'Current batch set to ' + r.name); F._batch.active = r.id; sesTbl.setRows(await batchRows(), true); } },
      { id: 'ren', label: 'Rename batch', icon: 'settings', onClick: async function (r) {
        var v = await U.form({ title: 'Rename batch', value: { name: r.name }, fields: [{ name: 'name', label: 'Batch name', required: true, full: true }], validate: function (x) { return d.sessions.some(function (o) { return o.id !== r.id && D.normBatch(o.name) === D.normBatch(x.name); }) ? 'That batch name already exists.' : null; } }); if (!v) return;
        await S.update('sessions', r.id, { name: v.name }); F._batch.names[r.id] = v.name; A.log('update', 'settings', 'Renamed batch ' + r.name + ' to ' + v.name); await fetchAll(); sesTbl.setRows(await batchRows(), true); } },
      { id: 'del', label: 'Delete batch', icon: 'x', danger: true, show: function (r) { return r.id !== st.activeSessionId; }, onClick: async function (r) {
        if (r.classes || r.kids) return U.toast('This batch has ' + r.classes + ' classes and ' + r.kids + ' students. Remove them first.', 'danger');
        var ok = await U.confirm({ title: 'Delete batch ' + r.name + '?', message: 'It has no classes or students.', confirmLabel: 'Delete', danger: true }); if (!ok) return;
        await S.remove('sessions', r.id); A.log('delete', 'settings', 'Deleted batch ' + r.name); await fetchAll(); sesTbl.setRows(await batchRows(), true); } }
    ],
    empty: { icon: 'classes', title: 'No batches', message: '' }
  });
  batchRows().then(function (r) { sesTbl.setRows(r); });

  /* start a new batch: optionally copy last batch's classes, teacher assignments and fee heads */
  document.getElementById('ses-add').addEventListener('click', async function () {
    var cur = d.sessions.filter(function (b) { return b.id === st.activeSessionId; })[0];
    var v = await U.form({ title: 'Start a new batch', submitLabel: 'Create batch', value: { copy: true, makeCurrent: true }, size: 'wide', fields: [
      { name: 'name', label: 'Batch name', required: true, placeholder: 'e.g. 2027', full: true },
      { name: 'copy', label: 'Copy the classes, teacher assignments and fee heads of "' + (cur ? cur.name : 'the current batch') + '"', type: 'checkbox' },
      { name: 'makeCurrent', label: 'Make it the current batch (teachers will see this batch from now on)', type: 'checkbox' }],
      validate: function (x) { return d.sessions.some(function (o) { return D.normBatch(o.name) === D.normBatch(x.name); }) ? 'A batch with that name already exists.' : null; } });
    if (!v) return;
    var batch = await S.insert('sessions', { name: v.name, startDate: '', endDate: '', isActive: false }); F._batch.names[batch.id] = batch.name;
    var copied = 0;
    if (v.copy && cur) {
      var x = await D.load(['classes', 'assignments', 'feeStructures']);
      for (var i = 0; i < x.classes.length; i++) {
        var c = x.classes[i]; if (c.sessionId !== cur.id) continue;
        var nc = await S.insert('classes', { name: c.name, section: c.section, classTeacherId: c.classTeacherId || '', sessionId: batch.id }); copied++;
        for (var a = 0; a < x.assignments.length; a++) if (x.assignments[a].classId === c.id) await S.insert('assignments', { classId: nc.id, teacherId: x.assignments[a].teacherId, subjectId: x.assignments[a].subjectId, sessionId: batch.id });
        for (var f = 0; f < x.feeStructures.length; f++) if (x.feeStructures[f].classId === c.id) await S.insert('feeStructures', { classId: nc.id, headName: x.feeStructures[f].headName, amount: x.feeStructures[f].amount, frequency: x.feeStructures[f].frequency });
      }
    }
    if (v.makeCurrent) { await S.setObject('settings', Object.assign({}, await S.getObject('settings', {}), { activeSessionId: batch.id })); st.activeSessionId = batch.id; F._batch.active = batch.id; }
    A.log('create', 'settings', 'Started batch ' + batch.name + (copied ? ' with ' + copied + ' copied classes' : '') + (v.makeCurrent ? ' (current)' : ''));
    U.toast('Batch ' + batch.name + ' created' + (copied ? ' with ' + copied + ' classes copied' : '') + '. Add students from the Students page.', 'success'); await fetchAll(); sesTbl.setRows(await batchRows(), true);
  });

  var holTbl = U.table(document.getElementById('hol-tbl'), {
    rows: d.holidays.slice().sort(function (a, b) { return a.date.localeCompare(b.date); }), pageSize: 6, columns: [{ key: 'date', label: 'Date', render: function (r) { return F.date(r.date); } }, { key: 'title', label: 'Holiday' }],
    actions: [{ id: 'del', label: 'Delete holiday', icon: 'x', danger: true, onClick: async function (r) { await S.remove('holidays', r.id); A.log('delete', 'settings', 'Deleted holiday ' + r.title); await fetchAll(); holTbl.setRows(d.holidays, true); } }],
    empty: { icon: 'attendance', title: 'No holidays', message: 'Sundays are always holidays. Add other days here.' }
  });
  document.getElementById('hol-add').addEventListener('click', async function () {
    var v = await U.form({ title: 'Add holiday', fields: [{ name: 'title', label: 'Holiday name', required: true, full: true }, { name: 'date', label: 'Date', type: 'date', required: true, full: true }], validate: function (x) { return d.holidays.some(function (o) { return o.date === x.date; }) ? 'That date is already a holiday.' : null; } });
    if (!v) return;
    await S.insert('holidays', v); A.log('create', 'settings', 'Added holiday ' + v.title); U.toast('Holiday added. Attendance is blocked on that day.', 'success'); await fetchAll(); holTbl.setRows(d.holidays.slice().sort(function (a, b) { return a.date.localeCompare(b.date); }), true);
  });
})();
