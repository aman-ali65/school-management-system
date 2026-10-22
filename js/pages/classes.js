(async function () {
  var session = await ED.shell.init({ role: 'admin', active: 'classes' });
  if (!session) return;
  var S = ED.storage, F = ED.fmt, U = ED.ui, h = F.esc, A = ED.audit;
  var content = document.getElementById('content');
  content.innerHTML = U.pageHead('Classes and subjects', 'Create classes, sections and subjects.', U.btn('Add class', { variant: 'primary', icon: 'plus', id: 'add-class' }) + U.btn('Add subject', { icon: 'plus', id: 'add-subject' })) +
    '<div class="filters card card-pad"><div class="field"><label for="cb">Batch</label><select class="select" id="cb"></select></div></div>' +
    '<div class="grid-2"><section class="card" id="classes-card"></section><section class="card" id="subjects-card"></section></div>';
  var d;
  async function fetchAll() { d = await ED.data.load(['classes', 'subjects', 'teachers', 'students', 'assignments', 'exams', 'sessions']); }
  await fetchAll();

  var cbEl = document.getElementById('cb');
  function fillBatches(keep) {
    cbEl.innerHTML = '<option value="">All batches</option>' + d.sessions.map(function (b) { return '<option value="' + h(b.id) + '">' + h(b.name) + (F._batch && b.id === F._batch.active ? ' (current)' : '') + '</option>'; }).join('');
    cbEl.value = keep !== undefined && d.sessions.some(function (b) { return b.id === keep; }) ? keep : (F._batch ? F._batch.active : '');
  }
  fillBatches();
  cbEl.addEventListener('change', function () { ct.setRows(classRows()); });
  function classRows() {
    return d.classes.filter(function (c) { return !cbEl.value || c.sessionId === cbEl.value; }).map(function (c) {
      return { id: c.id, c: c, batch: F.batchName(c.sessionId), label: c.name + '-' + c.section, teacher: (d.map.teachers[c.classTeacherId] || {}).name || 'Not assigned',
        students: d.students.filter(function (s) { return s.classId === c.id; }).length,
        subjects: d.assignments.filter(function (a) { return a.classId === c.id; }).map(function (a) { return a.subjectId; }).filter(function (x, i, arr) { return arr.indexOf(x) === i; }).length };
    });
  }
  function subjectRows() {
    return d.subjects.map(function (s) {
      return { id: s.id, s: s, name: s.name, code: s.code, used: d.assignments.filter(function (a) { return a.subjectId === s.id; }).map(function (a) { return a.classId; }).filter(function (x, i, arr) { return arr.indexOf(x) === i; }).length };
    });
  }

  document.getElementById('classes-card').innerHTML = '<div class="card-head"><h3>Classes</h3></div><div id="ct"></div>';
  document.getElementById('subjects-card').innerHTML = '<div class="card-head"><h3>Subjects</h3></div><div id="st"></div>';

  var ct = U.table(document.getElementById('ct'), {
    rows: classRows(), pageSize: 8, search: function (r) { return r.label + ' ' + r.teacher; }, searchPlaceholder: 'Search classes',
    columns: [
      { key: 'label', label: 'Class', render: function (r) { return '<b style="font-weight:500">' + h(r.label) + '</b>'; } },
      { key: 'batch', label: 'Batch' },
      { key: 'teacher', label: 'Class teacher' },
      { key: 'students', label: 'Students', num: true },
      { key: 'subjects', label: 'Subjects', num: true }
    ],
    actions: [
      { id: 'manage', label: 'Subjects and teachers', icon: 'assignments', onClick: function (r) { manage(r.c); } },
      { id: 'edit', label: 'Edit class', icon: 'settings', onClick: function (r) { editClass(r.c); } },
      { id: 'del', label: 'Delete class', icon: 'x', danger: true, onClick: function (r) { delClass(r); } }
    ],
    empty: { icon: 'classes', title: 'No classes yet', message: 'Use Add class to create the first one.' }
  });
  var st = U.table(document.getElementById('st'), {
    rows: subjectRows(), pageSize: 8, search: function (r) { return r.name + ' ' + r.code; }, searchPlaceholder: 'Search subjects',
    columns: [
      { key: 'name', label: 'Subject', render: function (r) { return '<b style="font-weight:500">' + h(r.name) + '</b>'; } },
      { key: 'code', label: 'Code' },
      { key: 'used', label: 'Classes', num: true }
    ],
    actions: [
      { id: 'edit', label: 'Edit subject', icon: 'settings', onClick: function (r) { editSubject(r.s); } },
      { id: 'del', label: 'Delete subject', icon: 'x', danger: true, onClick: function (r) { delSubject(r); } }
    ],
    empty: { icon: 'classes', title: 'No subjects yet', message: 'Use Add subject to create one.' }
  });
  async function refresh() { await fetchAll(); fillBatches(cbEl.value); ct.setRows(classRows(), true); st.setRows(subjectRows(), true); }

  /* one screen to set every subject of a class together with its teacher */
  async function manage(c) {
    var label = F.className(c);
    var rows = d.assignments.filter(function (a) { return a.classId === c.id; }).map(function (a) { return { id: a.id, subjectId: a.subjectId, teacherId: a.teacherId }; });
    var orig = rows.map(function (r) { return Object.assign({}, r); });
    var body = document.createElement('div'); body.className = 'stack';
    function opts(list, sel, ph) { return '<option value="">' + ph + '</option>' + list.map(function (x) { return '<option value="' + h(x.id) + '"' + (x.id === sel ? ' selected' : '') + '>' + h(x.name) + '</option>'; }).join(''); }
    function paint() {
      var teachers = d.teachers.filter(function (t) { return t.status === 'active'; });
      body.innerHTML = '<p class="muted">Pick the subjects taught in class ' + h(label) + ' and one teacher for each. A teacher can mark attendance and enter results only for the subjects given to them here.</p>' +
        (rows.length ? '<div class="table-wrap"><table class="table rowcards"><thead><tr><th>Subject</th><th>Teacher</th><th></th></tr></thead><tbody>' + rows.map(function (r, i) {
          var tList = teachers.slice(); if (r.teacherId && !tList.some(function (t) { return t.id === r.teacherId; }) && d.map.teachers[r.teacherId]) tList.push(d.map.teachers[r.teacherId]);
          return '<tr><td class="td-title" data-label="Subject"><select class="select" data-i="' + i + '" data-f="subjectId" aria-label="Subject">' + opts(d.subjects, r.subjectId, 'Choose subject') + '</select></td>' +
            '<td data-label="Teacher"><select class="select" data-i="' + i + '" data-f="teacherId" aria-label="Teacher">' + opts(tList, r.teacherId, 'Choose teacher') + '</select></td>' +
            '<td class="td-actions"><button type="button" class="icon-btn danger" data-rm="' + i + '" aria-label="Remove subject" title="Remove">' + ED.icons.svg('x', 16) + '</button></td></tr>';
        }).join('') + '</tbody></table></div>' : U.empty('classes', 'No subjects yet', 'Use Add subject below.')) +
        '<button type="button" class="btn btn-secondary btn-sm" id="m-add" style="align-self:flex-start">' + ED.icons.svg('plus', 16) + 'Add subject</button><div class="form-error" id="m-err" hidden></div>';
    }
    body.addEventListener('change', function (e) { var el = e.target.closest('[data-f]'); if (el) rows[+el.dataset.i][el.dataset.f] = el.value; });
    body.addEventListener('click', function (e) {
      if (e.target.closest('#m-add')) { rows.push({ id: null, subjectId: '', teacherId: '' }); paint(); return; }
      var rm = e.target.closest('[data-rm]'); if (rm) { rows.splice(+rm.dataset.rm, 1); paint(); }
    });
    paint();
    var saved = false;
    await U.modal({ title: 'Subjects and teachers: class ' + label, body: body, size: 'xl', actions: [{ label: 'Cancel', variant: 'secondary', value: false }, { label: 'Save', variant: 'primary', value: true, onClick: function () {
      var err = body.querySelector('#m-err'); function fail(m) { err.textContent = m; err.hidden = false; return false; }
      var seen = {};
      for (var i = 0; i < rows.length; i++) {
        if (!rows[i].subjectId || !rows[i].teacherId) return fail('Row ' + (i + 1) + ': choose both a subject and a teacher.');
        if (seen[rows[i].subjectId]) return fail(d.map.subjects[rows[i].subjectId].name + ' is listed twice. A class has one teacher per subject.');
        seen[rows[i].subjectId] = 1;
      }
      saved = true;
    } }] });
    if (!saved) return;
    var keep = {}; rows.forEach(function (r) { if (r.id) keep[r.id] = r; });
    var settings = await ED.data.settings(), added = 0, changed = 0, removed = 0;
    for (var k = 0; k < orig.length; k++) {
      var o = orig[k];
      if (!keep[o.id]) { await S.remove('assignments', o.id); removed++; }
      else if (keep[o.id].subjectId !== o.subjectId || keep[o.id].teacherId !== o.teacherId) { await S.update('assignments', o.id, { subjectId: keep[o.id].subjectId, teacherId: keep[o.id].teacherId }); changed++; }
    }
    for (var j = 0; j < rows.length; j++) if (!rows[j].id) { await S.insert('assignments', { classId: c.id, subjectId: rows[j].subjectId, teacherId: rows[j].teacherId, sessionId: settings.activeSessionId }); added++; }
    A.log('update', 'assignment', 'Class ' + label + ' subjects updated: ' + added + ' added, ' + changed + ' changed, ' + removed + ' removed');
    U.toast('Class ' + label + ' saved: ' + added + ' added, ' + changed + ' changed, ' + removed + ' removed', 'success'); refresh();
  }

  async function editClass(c) {
    var v = await U.form({
      title: c ? 'Edit class' : 'Add class', value: c || { sessionId: F._batch ? F._batch.active : '' },
      fields: [
        { name: 'name', label: 'Class', required: true, placeholder: 'e.g. 9', maxlength: 10 },
        { name: 'section', label: 'Section', required: true, placeholder: 'e.g. A', maxlength: 5 },
        { name: 'sessionId', label: 'Batch', type: 'select', required: true, disabled: !!c, full: true, options: d.sessions.map(function (b) { return { value: b.id, label: b.name + (F._batch && b.id === F._batch.active ? ' (current)' : '') }; }), hint: 'A class belongs to one batch. Start a new batch from Settings.' },
        { name: 'classTeacherId', label: 'Class teacher', type: 'select', placeholder: 'Not assigned', full: true, options: d.teachers.filter(function (t) { return t.status === 'active'; }).map(function (t) { return { value: t.id, label: t.name }; }) }
      ],
      validate: function (x) {
        var dup = d.classes.some(function (o) { return (!c || o.id !== c.id) && o.sessionId === (c ? c.sessionId : x.sessionId) && o.name.toLowerCase() === x.name.toLowerCase() && o.section.toLowerCase() === x.section.toLowerCase(); });
        return dup ? 'Class ' + x.name + '-' + x.section + ' already exists.' : null;
      }
    });
    if (!v) return;
    v.section = v.section.toUpperCase();
    if (c) { delete v.sessionId; await S.update('classes', c.id, v); A.log('update', 'class', 'Updated class ' + v.name + '-' + v.section); }
    else { await S.insert('classes', v); A.log('create', 'class', 'Created class ' + v.name + '-' + v.section); }
    U.toast('Class saved', 'success'); refresh();
  }
  async function delClass(r) {
    if (r.students) return U.toast('Move or delete the ' + r.students + ' students in this class first.', 'danger');
    var ok = await U.confirm({ title: 'Delete class ' + r.label + '?', message: 'Its subject assignments, timetable and exams will be removed too.', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    var id = r.id;
    await S.remove('classes', id);
    ['assignments', 'timetable', 'exams'].forEach(function (col) { S._writeList(col, S._readList(col).filter(function (x) { return x.classId !== id; })); });
    A.log('delete', 'class', 'Deleted class ' + r.label);
    U.toast('Class deleted', 'success'); refresh();
  }
  async function editSubject(s) {
    var v = await U.form({
      title: s ? 'Edit subject' : 'Add subject', value: s || {},
      fields: [{ name: 'name', label: 'Subject name', required: true, full: true }, { name: 'code', label: 'Code', placeholder: 'e.g. MAT', maxlength: 6, hint: 'Short code shown in tables. Optional.' }],
      validate: function (x) { return d.subjects.some(function (o) { return (!s || o.id !== s.id) && o.name.toLowerCase() === x.name.toLowerCase(); }) ? 'That subject already exists.' : null; }
    });
    if (!v) return;
    v.code = (v.code || v.name.slice(0, 3)).toUpperCase();
    if (s) await S.update('subjects', s.id, v); else await S.insert('subjects', v);
    A.log(s ? 'update' : 'create', 'subject', (s ? 'Updated' : 'Created') + ' subject ' + v.name);
    U.toast('Subject saved', 'success'); refresh();
  }
  async function delSubject(r) {
    if (r.used) return U.toast('This subject is assigned to ' + r.used + ' class(es). Remove those assignments first.', 'danger');
    if (d.exams.some(function (e) { return e.subjectId === r.id; })) return U.toast('Exams exist for this subject, so it cannot be deleted.', 'danger');
    var ok = await U.confirm({ title: 'Delete subject ' + r.name + '?', message: 'This cannot be undone.', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    await S.remove('subjects', r.id); A.log('delete', 'subject', 'Deleted subject ' + r.name);
    U.toast('Subject deleted', 'success'); refresh();
  }
  document.getElementById('add-class').addEventListener('click', function () { editClass(null); });
  document.getElementById('add-subject').addEventListener('click', function () { editSubject(null); });
})();
