(async function () {
  var session = await ED.shell.init({ role: 'admin', active: 'assignments' });
  if (!session) return;
  var S = ED.storage, F = ED.fmt, U = ED.ui, h = F.esc, A = ED.audit;
  var params = new URLSearchParams(location.search);
  var d;
  async function fetchAll() { d = await ED.data.load(['assignments', 'teachers', 'classes', 'subjects', 'sessions']); }
  await fetchAll();

  document.getElementById('content').innerHTML = U.pageHead('Assignments', 'Choose which teacher teaches which subject in which class. Teachers only see the classes assigned to them.', U.btn('New assignment', { variant: 'primary', icon: 'plus', id: 'add' })) +
    '<div class="filters card card-pad"><div class="field"><label for="f-t">Teacher</label><select class="select" id="f-t"><option value="">All teachers</option>' + U.options(d.teachers, 'id', function (t) { return t.name; }, params.get('teacher')) + '</select></div>' +
    '<div class="field"><label for="f-b">Batch</label><select class="select" id="f-b"><option value="">All batches</option>' + d.sessions.map(function (b) { return '<option value="' + b.id + '"' + (F._batch && b.id === F._batch.active ? ' selected' : '') + '>' + F.esc(b.name) + '</option>'; }).join('') + '</select></div>' +
    '<div class="field"><label for="f-c">Class</label><select class="select" id="f-c"><option value="">All classes</option>' + U.options(d.classes, 'id', F.className) + '</select></div></div>' +
    '<section class="card" id="tbl"></section>';

  function rows() {
    var t = document.getElementById('f-t').value, c = document.getElementById('f-c').value, bb = document.getElementById('f-b').value;
    return d.assignments.filter(function (a) { return (!t || a.teacherId === t) && (!c || a.classId === c) && (!bb || (d.map.classes[a.classId] || {}).sessionId === bb); }).map(function (a) {
      return { id: a.id, teacher: (d.map.teachers[a.teacherId] || {}).name || '-', cls: F.className(d.map.classes[a.classId]), subject: (d.map.subjects[a.subjectId] || {}).name || '-', a: a };
    });
  }
  var tbl = U.table(document.getElementById('tbl'), {
    rows: rows(), pageSize: 10, search: function (r) { return r.teacher + ' ' + r.cls + ' ' + r.subject; }, searchPlaceholder: 'Search assignments',
    columns: [
      { key: 'teacher', label: 'Teacher', render: function (r) { return '<div class="cell-main">' + U.avatar(r.teacher) + '<span>' + h(r.teacher) + '</span></div>'; } },
      { key: 'cls', label: 'Class' }, { key: 'subject', label: 'Subject' }
    ],
    actions: [{ id: 'del', label: 'Remove assignment', icon: 'x', danger: true, onClick: remove }],
    empty: { icon: 'assignments', title: 'No assignments', message: 'Use New assignment to link a teacher to a class and subject.' }
  });
  function repaint() { tbl.setRows(rows()); }
  document.getElementById('f-t').addEventListener('change', repaint);
  document.getElementById('f-c').addEventListener('change', repaint);
  document.getElementById('f-b').addEventListener('change', repaint);

  async function add() {
    var v = await U.form({
      title: 'New assignment', submitLabel: 'Assign',
      fields: [
        { name: 'teacherId', label: 'Teacher', type: 'select', required: true, placeholder: 'Choose teacher', full: true, value: document.getElementById('f-t').value, options: d.teachers.filter(function (t) { return t.status === 'active'; }).map(function (t) { return { value: t.id, label: t.name }; }) },
        { name: 'classId', label: 'Class', type: 'select', required: true, placeholder: 'Choose class', options: d.classes.map(function (c) { return { value: c.id, label: F.className(c) }; }) },
        { name: 'subjectId', label: 'Subject', type: 'select', required: true, placeholder: 'Choose subject', options: d.subjects.map(function (s) { return { value: s.id, label: s.name }; }) }
      ],
      validate: function (x) {
        var other = d.assignments.filter(function (a) { return a.classId === x.classId && a.subjectId === x.subjectId; })[0];
        if (!other) return null;
        return other.teacherId === x.teacherId ? 'That teacher already teaches this subject in this class.' : (d.map.teachers[other.teacherId] || {}).name + ' already teaches this subject in this class. Remove that assignment first.';
      }
    });
    if (!v) return;
    await S.insert('assignments', Object.assign({ sessionId: (await ED.data.settings()).activeSessionId }, v));
    A.log('create', 'assignment', 'Assigned ' + d.map.teachers[v.teacherId].name + ' to ' + F.className(d.map.classes[v.classId]) + ' ' + d.map.subjects[v.subjectId].name);
    U.toast('Assignment saved', 'success'); await fetchAll(); repaint();
  }
  async function remove(r) {
    var ok = await U.confirm({ title: 'Remove assignment?', message: r.teacher + ' will no longer teach ' + r.subject + ' in ' + r.cls + '. Existing marks stay.', confirmLabel: 'Remove', danger: true });
    if (!ok) return;
    await S.remove('assignments', r.id); A.log('delete', 'assignment', 'Removed ' + r.teacher + ' from ' + r.cls + ' ' + r.subject);
    U.toast('Assignment removed', 'success'); await fetchAll(); repaint();
  }
  document.getElementById('add').addEventListener('click', add);
})();
