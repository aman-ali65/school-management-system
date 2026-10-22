(async function () {
  var role = document.body.dataset.role, mode = document.body.dataset.mode;
  var session = await ED.shell.init({ role: role, active: document.body.dataset.active });
  if (!session) return;
  var S = ED.storage, F = ED.fmt, U = ED.ui, I = ED.icons, h = F.esc, A = ED.audit, D = ED.data, C = ED.charts;
  var ctx = await D.context(session), settings = ctx.settings;
  var canMsg = ctx.isAdmin || settings.permissions.teacherCanMessage;
  var canPublish = ctx.isAdmin || settings.permissions.teacherCanPublish;
  var content = document.getElementById('content');
  var d, scale;
  var TYPES = [{ value: 'quiz', label: 'Quiz' }, { value: 'mid', label: 'Mid-term' }, { value: 'final', label: 'Final' }, { value: 'other', label: 'Other test' }];

  async function fetchAll() { d = await D.load(['exams', 'marks', 'students', 'classes', 'subjects', 'examImages', 'gradingScale']); scale = d.gradingScale; settings = await D.settings(); }
  function cn(id) { return F.className(d.map.classes[id]); }
  function sn(id) { return (d.map.subjects[id] || {}).name || '-'; }
  function canTeach(e) { return ctx.isAdmin || ctx.assignments.some(function (a) { return a.classId === e.classId && a.subjectId === e.subjectId; }); }
  function grade(p) { return D.gradeFor(p, scale); }
  function studentsOf(classId) { return d.students.filter(function (s) { return s.classId === classId && s.status === 'active'; }).sort(function (a, b) { return (Number(a.rollNo) || 0) - (Number(b.rollNo) || 0); }); }
  function typeLabel(t) { return (TYPES.filter(function (x) { return x.value === t; })[0] || {}).label || t; }

  /* ---------------------------------------------------------------- list view */
  async function showList() {
    await fetchAll();
    content.innerHTML = U.pageHead(mode === 'upload' ? 'Upload result photos' : 'Results', mode === 'upload' ? 'Pick an exam, upload photos of the answer sheets or mark list, then verify what was read.' : 'Create exams, enter or upload marks, verify, publish and print report cards.', U.btn('New exam', { variant: 'primary', icon: 'plus', id: 'new-exam' })) + '<div id="tabs"></div>';
    document.getElementById('new-exam').addEventListener('click', newExam);
    var tabs = [{ id: 'exams', label: 'Exams', render: examsTab }];
    if (mode !== 'upload') tabs.push({ id: 'cards', label: 'Report cards', render: cardsTab });
    U.tabs(document.getElementById('tabs'), tabs);
  }

  function examsTab(panel) {
    var exams = d.exams.filter(function (e) { return ctx.canAccess(e.classId) && canTeach(e); });
    panel.innerHTML = '<div class="filters card card-pad">' + (ctx.isAdmin ? '<div class="field"><label for="e-b">Batch</label><select class="select" id="e-b"><option value="">All batches</option>' + ctx.batches.map(function (b) { return '<option value="' + h(b.id) + '"' + (b.id === ctx.activeId ? ' selected' : '') + '>' + h(b.name) + (b.id === ctx.activeId ? ' (current)' : '') + '</option>'; }).join('') + '</select></div>' : '') + '<div class="field"><label for="e-c">Class</label><select class="select" id="e-c"><option value="">All classes</option>' + U.options(ctx.classes, 'id', F.className) + '</select></div>' +
      '<div class="field"><label for="e-s">Status</label><select class="select" id="e-s"><option value="">All</option><option value="pending">Pending</option><option value="extracted">Extracted</option><option value="verified">Verified</option><option value="published">Published</option></select></div></div><section class="card" id="e-tbl"></section>';
    function rows() {
      var c = panel.querySelector('#e-c').value, s = panel.querySelector('#e-s').value, bq = panel.querySelector('#e-b'), bb = bq ? bq.value : '';
      return exams.filter(function (e) { return (!c || e.classId === c) && (!s || e.status === s) && (!bb || (d.map.classes[e.classId] || {}).sessionId === bb); }).sort(function (a, b) { return b.date.localeCompare(a.date); }).map(function (e) {
        var total = studentsOf(e.classId).length, entered = d.marks.filter(function (m) { return m.examId === e.id && (m.marks !== null || m.absent); }).length;
        return { id: e.id, e: e, name: e.name, type: typeLabel(e.type), cls: cn(e.classId), subject: sn(e.subjectId), total: e.totalMarks, date: e.date, entered: entered, of: total, status: e.status };
      });
    }
    var tbl = U.table(panel.querySelector('#e-tbl'), {
      rows: rows(), pageSize: 10, search: function (r) { return [r.name, r.type, r.cls, r.subject].join(' '); }, searchPlaceholder: 'Search exams',
      onRowClick: function (r) { location.hash = 'exam=' + r.id + (mode === 'upload' ? '&tab=papers' : ''); },
      columns: [
        { key: 'name', label: 'Exam', render: function (r) { return '<div>' + h(r.name) + '</div><div class="cell-sub">' + h(r.type) + '</div>'; } },
        { key: 'cls', label: 'Class' }, { key: 'subject', label: 'Subject' },
        { key: 'total', label: 'Total marks', num: true },
        { key: 'date', label: 'Date', render: function (r) { return F.date(r.date); } },
        { key: 'entered', label: 'Entered', num: true, sort: function (r) { return r.entered; }, render: function (r) { return r.entered + '/' + r.of; } },
        { key: 'status', label: 'Status', render: function (r) { return U.statusBadge('exam', r.status); } }
      ],
      actions: [
        { id: 'open', label: mode === 'upload' ? 'Upload papers' : 'Open exam', icon: mode === 'upload' ? 'upload' : 'results', onClick: function (r) { location.hash = 'exam=' + r.id + (mode === 'upload' ? '&tab=papers' : ''); } },
        { id: 'del', label: 'Delete exam', icon: 'x', danger: true, show: function (r) { return r.status !== 'published' || ctx.isAdmin; }, onClick: delExam }
      ],
      empty: { icon: 'results', title: 'No exams yet', message: 'Use New exam to create the first one.' }
    });
    ['e-b', 'e-c', 'e-s'].forEach(function (id) { var el = panel.querySelector('#' + id); if (el) el.addEventListener('change', function () { tbl.setRows(rows()); }); });
  }

  async function newExam() {
    if (!ctx.assignments.length) return U.toast('No class and subject is assigned to you yet.', 'info');
    var v = await U.form({
      title: 'New exam', submitLabel: 'Create exam', size: 'wide', value: { type: 'quiz', totalMarks: 20, date: F.today() },
      fields: [
        { name: 'name', label: 'Exam name', required: true, placeholder: 'e.g. Quiz 4', full: true },
        { name: 'type', label: 'Type', type: 'select', options: TYPES },
        { name: 'totalMarks', label: 'Total marks', type: 'number', required: true, min: 1, max: 1000 },
        { name: 'asg', label: 'Class and subject', type: 'select', required: true, placeholder: 'Choose', full: true, options: ctx.assignments.map(function (a) { return { value: a.id, label: 'Class ' + F.className(ctx.allClasses.filter(function (c) { return c.id === a.classId; })[0]) + ' - ' + ctx.subjects.filter(function (s) { return s.id === a.subjectId; })[0].name }; }) },
        { name: 'date', label: 'Exam date', type: 'date', required: true }
      ]
    });
    if (!v) return;
    var a = ctx.assignments.filter(function (x) { return x.id === v.asg; })[0];
    var row = await S.insert('exams', { name: v.name, type: v.type, classId: a.classId, subjectId: a.subjectId, totalMarks: v.totalMarks, date: v.date, status: 'pending', createdBy: ctx.teacherId || 'admin' });
    A.log('create', 'results', 'Created exam ' + v.name + ' for ' + F.className(ctx.allClasses.filter(function (c) { return c.id === a.classId; })[0]));
    U.toast('Exam created', 'success'); location.hash = 'exam=' + row.id;
  }
  async function delExam(r) {
    var ok = await U.confirm({ title: 'Delete ' + r.name + '?', message: 'All marks and photos of this exam are deleted.', confirmLabel: 'Delete exam', danger: true });
    if (!ok) return;
    await S.remove('exams', r.id);
    ['marks', 'examImages'].forEach(function (col) { S._writeList(col, S._readList(col).filter(function (x) { return x.examId !== r.id; })); });
    A.log('delete', 'results', 'Deleted exam ' + r.name); U.toast('Exam deleted', 'success'); showList();
  }

  /* --------------------------------------------------------- report cards tab */
  function cardsTab(panel) {
    if (!ctx.classes.length) { panel.innerHTML = '<div class="card">' + U.empty('classes', 'No classes', '') + '</div>'; return; }
    var rcBatch = ctx.activeId;
    panel.innerHTML = '<div class="filters card card-pad">' + (ctx.isAdmin ? '<div class="field"><label for="r-b">Batch</label><select class="select" id="r-b">' + ctx.batches.map(function (b) { return '<option value="' + h(b.id) + '"' + (b.id === ctx.activeId ? ' selected' : '') + '>' + h(b.name) + (b.id === ctx.activeId ? ' (current)' : '') + '</option>'; }).join('') + '</select></div>' : '') + '<div class="field"><label for="r-c">Class</label><select class="select" id="r-c">' + U.options(ctx.classes.filter(function (c) { return !ctx.isAdmin || c.sessionId === rcBatch; }), 'id', F.className) + '</select></div>' +
      '<div class="field"><label for="r-t">Exam type</label><select class="select" id="r-t"><option value="">All published exams</option>' + U.options(TYPES, 'value', function (t) { return t.label; }) + '</select></div>' +
      '<div class="row" style="align-self:flex-end;flex-wrap:wrap">' + U.btn('Print all report cards', { id: 'r-print' }) + U.btn('Export class results CSV', { id: 'r-csv' }) + (canMsg ? U.btn('Send to all parents', { variant: 'whatsapp', icon: 'whatsapp', id: 'r-wa' }) : '') + '</div></div><section class="card" id="r-tbl"></section>';
    var classEl = panel.querySelector('#r-c'), typeEl = panel.querySelector('#r-t'), model = null;
    var tbl = U.table(panel.querySelector('#r-tbl'), {
      rows: [], pageSize: 12, search: function (r) { return r.s.name + ' ' + r.s.rollNo; }, searchPlaceholder: 'Search student',
      columns: [
        { key: 'rank', label: 'Rank', sort: function (r) { return r.rank || 999; }, render: function (r) { return r.rank ? '#' + r.rank : '-'; } },
        { key: 'name', label: 'Student', render: function (r) { return '<div class="cell-main">' + U.avatar(r.s.name) + '<span>' + h(r.s.name) + '</span></div>'; } },
        { key: 'roll', label: 'Roll', sort: function (r) { return Number(r.s.rollNo) || 0; }, render: function (r) { return h(r.s.rollNo); } },
        { key: 'obtained', label: 'Marks', num: true, render: function (r) { return r.total ? r.obtained + '/' + r.total : '-'; } },
        { key: 'pct', label: 'Percentage', num: true, sort: function (r) { return r.pct === null ? -1 : r.pct; }, render: function (r) { return r.pct === null ? '-' : F.pct(r.pct); } },
        { key: 'grade', label: 'Grade', render: function (r) { return r.grade ? U.badge(r.grade, r.pct >= settings.passPercent ? 'present' : 'absent') : '-'; } }
      ],
      actions: [{ id: 'view', label: 'View report card', icon: 'results', onClick: function (r) { viewCard(r); } }, { id: 'wa', label: 'Send to parent', icon: 'whatsapp', show: function () { return canMsg; }, onClick: function (r) { sendCard([r]); } }],
      onRowClick: viewCard, empty: { icon: 'results', title: 'No published results', message: 'Publish at least one exam for this class to see report cards.' }
    });
    function build() {
      var cid = classEl.value, t = typeEl.value;
      if (!cid) { model = { cid: '', exams: [], rows: [], ranked: 0 }; tbl.setRows([]); return; }
      var exams = d.exams.filter(function (e) { return e.classId === cid && e.status === 'published' && (!t || e.type === t); });
      var rows = studentsOf(cid).map(function (s) {
        var lines = [], obtained = 0, total = 0;
        exams.forEach(function (e) {
          var m = d.marks.filter(function (x) { return x.examId === e.id && x.studentId === s.id; })[0];
          if (!m || m.absent || m.marks === null) { lines.push({ e: e, marks: null, absent: !!(m && m.absent) }); return; }
          lines.push({ e: e, marks: m.marks }); obtained += m.marks; total += e.totalMarks;
        });
        var pct = total ? obtained / total * 100 : null;
        return { id: s.id, s: s, lines: lines, obtained: obtained, total: total, pct: pct, grade: pct === null ? '' : grade(pct), rank: 0 };
      });
      rows.filter(function (r) { return r.pct !== null; }).sort(function (a, b) { return b.pct - a.pct; }).forEach(function (r, i, arr) { r.rank = i && arr[i - 1].pct === r.pct ? arr[i - 1].rank : i + 1; });
      model = { cid: cid, exams: exams, rows: rows, ranked: rows.filter(function (r) { return r.pct !== null; }).length };
      tbl.setRows(rows);
    }
    function cardHTML(r) {
      var c = d.map.classes[model.cid], body = r.lines.map(function (l) {
        return '<tr><td>' + h(sn(l.e.subjectId)) + '</td><td>' + h(l.e.name) + '</td><td class="n">' + (l.absent ? 'Absent' : l.marks === null ? '-' : l.marks) + '</td><td class="n">' + l.e.totalMarks + '</td><td class="n">' + (l.marks === null ? '-' : F.pct(l.marks / l.e.totalMarks * 100)) + '</td><td>' + (l.marks === null ? '-' : grade(l.marks / l.e.totalMarks * 100)) + '</td></tr>';
      }).join('');
      var remark = r.pct === null ? '' : (scale.filter(function (g) { return g.grade === r.grade; })[0] || {}).remarks || '';
      return U.docHeader(settings, 'Report card', F.date(F.today())) + '<div class="grid box"><div>Student: <b>' + h(r.s.name) + '</b></div><div>Class: <b>' + h(F.className(c)) + '</b></div><div>Roll no: <b>' + h(r.s.rollNo) + '</b></div><div>Parent: <b>' + h(r.s.parentName || '-') + '</b></div></div>' +
        '<table><thead><tr><th>Subject</th><th>Exam</th><th class="n">Marks</th><th class="n">Total</th><th class="n">%</th><th>Grade</th></tr></thead><tbody>' + (body || '<tr><td colspan="6">No published results yet.</td></tr>') + '</tbody>' +
        '<tfoot><tr class="tot"><td colspan="2">Overall</td><td class="n">' + (r.total ? r.obtained : '-') + '</td><td class="n">' + (r.total || '-') + '</td><td class="n">' + (r.pct === null ? '-' : F.pct(r.pct)) + '</td><td>' + h(r.grade || '-') + '</td></tr></tfoot></table>' +
        '<div class="grid box"><div>Position: <b>' + (r.rank ? r.rank + ' of ' + model.ranked : '-') + '</b></div><div>Result: <b>' + (r.pct === null ? '-' : r.pct >= settings.passPercent ? 'Pass' : 'Fail') + '</b></div><div>Remarks: <b>' + h(remark || '-') + '</b></div></div>' +
        '<div class="sig"><div>Class teacher</div><div>Parent</div><div>Principal</div></div>';
    }
    function viewCard(r) {
      var box = document.createElement('div'); box.className = 'rc-wrap'; box.style.background = '#fff'; box.style.color = '#111'; box.style.borderRadius = '8px'; box.innerHTML = '<style>.rc-wrap table{width:100%;border-collapse:collapse;margin:8px 0}.rc-wrap th,.rc-wrap td{border:1px solid #bbb;padding:6px 8px;text-align:left;color:#111}.rc-wrap th{background:#f1f1f1}.rc-wrap .n{text-align:right}.rc-wrap .hd{display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:12px}.rc-wrap .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px}.rc-wrap .box{border:1px solid #999;padding:10px;border-radius:6px;margin:8px 0}.rc-wrap .muted{color:#555}.rc-wrap .sig{display:flex;justify-content:space-between;margin-top:30px}.rc-wrap .sig div{border-top:1px solid #111;width:150px;text-align:center;padding-top:4px}.rc-wrap h1{font-size:20px;margin:0}.rc-wrap h2{font-size:15px;margin:0}</style>' + cardHTML(r);
      U.modal({ title: 'Report card: ' + r.s.name, body: box, size: 'xl', actions: [{ label: 'Close', variant: 'secondary', value: false }].concat(canMsg ? [{ label: 'Send to parent', variant: 'whatsapp', value: 'wa', onClick: function () { sendCard([r]); return false; } }] : [], [{ label: 'Print', variant: 'primary', value: 'print', onClick: function () { U.print(cardHTML(r), 'Report card'); return false; } }]) });
    }
    function sendCard(list) {
      if (!list.length) return U.toast('Nothing to send.', 'info');
      var byId = {}; list.forEach(function (r) { byId[r.s.id] = r; });
      ED.wa.openModal({ students: list.map(function (r) { return r.s; }), type: 'custom', title: 'Send report card to parent', text: 'Assalam o Alaikum {parent}, the report card of {student} ({class}): {marks} marks, {percentage}, grade {grade}, position {rank}. - {school}', vars: function (s) { var r = byId[s.id]; return { marks: r.total ? r.obtained + '/' + r.total : 'N/A', percentage: r.pct === null ? 'N/A' : F.pct(r.pct), grade: r.grade || 'N/A', rank: r.rank || 'N/A' }; } });
    }
    var rbEl = panel.querySelector('#r-b');
    if (rbEl) rbEl.addEventListener('change', function () { var list = ctx.classes.filter(function (c) { return c.sessionId === rbEl.value; }); classEl.innerHTML = list.length ? U.options(list, 'id', F.className) : '<option value="">No classes in this batch</option>'; build(); });
    classEl.addEventListener('change', build); typeEl.addEventListener('change', build);
    panel.querySelector('#r-print').addEventListener('click', function () {
      var list = model.rows.filter(function (r) { return r.lines.length; });
      if (!list.length) return U.toast('No published results for this class yet.', 'info');
      U.print(list.map(function (r) { return '<div class="pb">' + cardHTML(r) + '</div>'; }).join(''), 'Report cards');
    });
    panel.querySelector('#r-csv').addEventListener('click', function () {
      if (!model.exams.length) return U.toast('No published results to export.', 'info');
      U.download('results-' + cn(model.cid) + '.csv', U.toCSV([['rank', 'roll', 'student', 'marks', 'total', 'percentage', 'grade']].concat(model.rows.map(function (r) { return [r.rank || '', r.s.rollNo, r.s.name, r.total ? r.obtained : '', r.total || '', r.pct === null ? '' : Math.round(r.pct * 10) / 10, r.grade]; }))), 'text/csv');
    });
    var wa = panel.querySelector('#r-wa'); if (wa) wa.addEventListener('click', function () { sendCard(model.rows.filter(function (r) { return r.pct !== null; })); });
    build();
  }

  /* ------------------------------------------------------------ exam detail */
  async function showExam(id, tab) {
    await fetchAll();
    var e = d.map.exams[id];
    if (!e || !ctx.canAccess(e.classId) || !canTeach(e)) { U.toast('That exam was not found or is not yours.', 'danger'); location.hash = ''; return; }
    var studs = studentsOf(e.classId), work = {}, images = d.examImages.filter(function (x) { return x.examId === id; }), viewIdx = 0;
    d.marks.filter(function (m) { return m.examId === id; }).forEach(function (m) { work[m.studentId] = { marks: m.marks, absent: !!m.absent, conf: m.confidence, source: m.source || 'manual' }; });
    var published = e.status === 'published';
    var current = tab || (mode === 'upload' ? 'papers' : 'marks');

    var actions = '';
    if (!published) actions += U.btn(e.status === 'verified' ? 'Save as draft' : 'Save draft', { id: 'x-draft' }) + U.btn('Verify and save', { variant: 'primary', icon: 'check', id: 'x-verify' });
    if (e.status === 'verified' && canPublish) actions += U.btn('Publish result', { variant: 'primary', id: 'x-publish' });
    if (published && ctx.isAdmin) actions += U.btn('Unlock to edit', { id: 'x-unlock' });
    if (published && canMsg) actions += U.btn('Send to parents', { variant: 'whatsapp', icon: 'whatsapp', id: 'x-wa' });
    actions += U.btn('Print mark sheet', { id: 'x-print' }) + U.btn('Export CSV', { id: 'x-csv' });

    content.innerHTML = '<div><button type="button" class="btn btn-ghost btn-sm" id="x-back">&larr; All exams</button></div>' +
      '<div class="page-head"><div><h1>' + h(e.name) + ' ' + U.statusBadge('exam', e.status) + '</h1><p class="muted">' + h(typeLabel(e.type)) + ' | Class ' + h(cn(e.classId)) + ' | ' + h(sn(e.subjectId)) + ' | ' + e.totalMarks + ' marks | ' + F.date(e.date) + '</p></div><div class="row" style="flex-wrap:wrap">' + actions + '</div></div>' +
      (published ? '<div class="callout good">' + I.svg('check', 18) + '<span>This result is published and locked.' + (ctx.isAdmin ? ' Use Unlock to edit if a correction is needed.' : ' Only the admin can change it.') + '</span></div>' : '') +
      (e.status === 'extracted' ? '<div class="callout warn">' + I.svg('info', 18) + '<span>Marks were read from photos. Check the red fields against the paper, then press Verify and save.</span></div>' : '') +
      '<div id="x-tabs"></div>';
    document.getElementById('x-back').addEventListener('click', function () { location.hash = ''; });

    /* ---- helpers ---- */
    var panelRef = null;
    function readInputs() {
      if (!panelRef || !panelRef.querySelector('.mark-input')) return;
      studs.forEach(function (s) {
        var tr = panelRef.querySelector('tr[data-id="' + s.id + '"]'); if (!tr) return;
        var inp = tr.querySelector('.mark-input'), ab = tr.querySelector('.abs'), v = inp.value.trim(), prev = work[s.id] || {};
        work[s.id] = { marks: ab.checked || v === '' ? null : Number(v), absent: ab.checked, conf: prev.conf === undefined ? null : prev.conf, source: prev.source || 'manual' };
      });
    }
    function validate() {
      for (var i = 0; i < studs.length; i++) {
        var w = work[studs[i].id]; if (!w || w.marks === null) continue;
        if (isNaN(w.marks) || w.marks < 0 || w.marks > e.totalMarks) return studs[i].name + ': marks must be between 0 and ' + e.totalMarks + '.';
      }
      return null;
    }
    async function persist(next) {
      readInputs();
      var err = validate(); if (err) { U.toast(err, 'danger'); return false; }
      var now = new Date().toISOString(), rest = S._readList('marks').filter(function (m) { return m.examId !== id; });
      var rows = studs.filter(function (s) { var w = work[s.id]; return w && (w.marks !== null || w.absent); }).map(function (s) { var w = work[s.id]; return { id: S.uid(), examId: id, studentId: s.id, marks: w.absent ? null : w.marks, absent: w.absent, source: w.source, confidence: w.conf === undefined ? null : w.conf, createdAt: now, updatedAt: now }; });
      S._writeList('marks', rest.concat(rows));
      await S.update('exams', id, { status: next });
      return true;
    }
    function missing() { readInputs(); return studs.filter(function (s) { var w = work[s.id]; return !w || (w.marks === null && !w.absent); }); }
    function rowsData() { readInputs(); return studs.map(function (s) { var w = work[s.id] || {}, pct = w.marks === null || w.marks === undefined ? null : w.marks / e.totalMarks * 100; return { s: s, w: w, pct: pct }; }); }

    /* ---- Marks tab ---- */
    function marksTab(panel) {
      panelRef = panel;
      var lowCount = studs.filter(function (s) { var w = work[s.id]; return w && w.source === 'ocr' && w.conf !== null && w.conf < 0.8 && e.status === 'extracted'; }).length;
      function tableHTML() {
        return '<section class="card"><div class="table-toolbar"><div class="summary-chips" id="x-sum"></div>' + (lowCount ? '<span style="margin-left:auto">' + U.badge(lowCount + ' low confidence', 'absent') + '</span>' : '') + '</div>' +
          '<div class="table-wrap"><table class="table rowcards"><thead><tr><th>Student</th><th class="num">Marks / ' + e.totalMarks + '</th><th>Absent</th><th class="num">%</th><th>Grade</th><th>Source</th></tr></thead><tbody>' +
          studs.map(function (s) {
            var w = work[s.id] || {}, low = e.status === 'extracted' && w.source === 'ocr' && w.conf !== null && w.conf !== undefined && w.conf < 0.8;
            return '<tr data-id="' + s.id + '"><td class="td-title" data-label="Student"><div class="cell-main">' + U.avatar(s.name) + '<span>' + h(s.rollNo + '. ' + s.name) + '</span></div></td>' +
              '<td class="num" data-label="Marks / ' + e.totalMarks + '"><input class="input mark-input' + (low ? ' low-conf' : '') + '" type="number" min="0" max="' + e.totalMarks + '" step="0.5" value="' + (w.marks === null || w.marks === undefined ? '' : w.marks) + '"' + (published || w.absent ? ' disabled' : '') + ' aria-label="Marks for ' + h(s.name) + '"></td>' +
              '<td data-label="Absent"><input class="abs" type="checkbox"' + (w.absent ? ' checked' : '') + (published ? ' disabled' : '') + ' aria-label="Absent"></td><td class="num pct" data-label="%"></td><td class="gr" data-label="Grade"></td>' +
              '<td data-label="Source">' + (w.source === 'ocr' ? U.badge('Photo ' + Math.round((w.conf || 0) * 100) + '%', low ? 'absent' : 'late') : (w.marks !== null && w.marks !== undefined || w.absent ? U.badge('Typed') : '')) + '</td></tr>';
          }).join('') + '</tbody></table></div></section>';
      }
      function viewerHTML() {
        if (!images.length) return '';
        var im = images[viewIdx];
        return '<section class="card viewer"><div class="row-between"><b style="font-weight:500">Photo ' + (viewIdx + 1) + ' of ' + images.length + '</b><div class="row"><button type="button" class="btn btn-secondary btn-sm" id="v-prev"' + (images.length < 2 ? ' disabled' : '') + '>Previous</button><button type="button" class="btn btn-secondary btn-sm" id="v-next"' + (images.length < 2 ? ' disabled' : '') + '>Next</button></div></div><img class="viewer-img" alt="Uploaded result photo ' + (viewIdx + 1) + '" src="' + im.dataUrl + '"></section>';
      }
      panel.innerHTML = images.length ? '<div class="split"><div>' + viewerHTML() + '</div><div>' + tableHTML() + '</div></div>' : tableHTML();
      if (!images.length && !published && e.status !== 'extracted') panel.insertAdjacentHTML('afterbegin', '<div class="callout">' + I.svg('info', 18) + '<span>Type marks below, or open the <b>Photos</b> tab to upload pictures of the paper. Photos show here next to the marks so you can compare.</span></div>');
      function recalc() {
        var filled = 0, n = { low: 0 };
        panel.querySelectorAll('tbody tr').forEach(function (tr) {
          var inp = tr.querySelector('.mark-input'), ab = tr.querySelector('.abs'), v = inp.value.trim(), num = Number(v);
          inp.disabled = published || ab.checked;
          var bad = v !== '' && (isNaN(num) || num < 0 || num > e.totalMarks);
          inp.setAttribute('aria-invalid', bad ? 'true' : 'false');
          if (v !== '' && !ab.checked && !bad) { tr.querySelector('.pct').textContent = F.pct(num / e.totalMarks * 100); tr.querySelector('.gr').innerHTML = U.badge(grade(num / e.totalMarks * 100), num / e.totalMarks * 100 >= settings.passPercent ? 'present' : 'absent'); filled++; }
          else { tr.querySelector('.pct').textContent = ab.checked ? 'Absent' : '-'; tr.querySelector('.gr').textContent = '-'; if (ab.checked) filled++; }
        });
        panel.querySelector('#x-sum').innerHTML = U.badge('Entered ' + filled + '/' + studs.length, filled === studs.length ? 'present' : 'late');
      }
      panel.oninput = function (ev) {
        if (!ev.target.matches('.mark-input')) return;
        var tr = ev.target.closest('tr'), sid = tr.dataset.id; work[sid] = Object.assign({}, work[sid] || {}, { source: 'manual', conf: null });
        ev.target.classList.remove('low-conf'); recalc();
      };
      panel.onchange = function (ev) { if (ev.target.matches('.abs')) { var sid = ev.target.closest('tr').dataset.id; work[sid] = Object.assign({}, work[sid] || {}, { source: 'manual', conf: null }); recalc(); } };
      var pv = panel.querySelector('#v-prev'), nx = panel.querySelector('#v-next');
      if (pv) pv.addEventListener('click', function () { viewIdx = (viewIdx - 1 + images.length) % images.length; readInputs(); marksTab(panel); });
      if (nx) nx.addEventListener('click', function () { viewIdx = (viewIdx + 1) % images.length; readInputs(); marksTab(panel); });
      recalc();
    }

    /* ---- Photos tab ---- */
    function photosTab(panel) {
      panelRef = panel;
      panel.innerHTML = (published ? '' : '<section class="card card-pad stack"><label class="dropzone" id="dz" for="x-file">' + I.svg('upload', 28) + '<b style="font-weight:500">Tap to take photos or choose files</b><span class="small">You can select several photos at once (batch). JPG or PNG.</span></label><input type="file" id="x-file" accept="image/*" multiple hidden>' +
        '<div class="callout">' + I.svg('info', 18) + '<span>Demo extraction: the system fills marks with simulated values and confidence so you can practise the review flow. Connect a real OCR service later (js/core/ocr.js) and everything else stays the same.</span></div></section>') +
        '<section class="card card-pad stack"><div class="row-between"><h3>Uploaded photos (' + images.length + ')</h3>' + (images.length && !published ? U.btn('Extract marks from photos', { variant: 'primary', id: 'x-extract' }) : '') + '</div><div id="x-prog" hidden><div class="progress"><i style="width:0"></i></div><div class="small muted" style="margin-top:4px">Reading photos...</div></div>' +
        (images.length ? '<div class="thumbs">' + images.map(function (im, i) { return '<div class="t' + (i === viewIdx ? ' active' : '') + '" data-i="' + i + '"><img alt="Photo ' + (i + 1) + '" src="' + im.dataUrl + '">' + (published ? '' : '<button type="button" data-del="' + im.id + '" aria-label="Delete photo ' + (i + 1) + '">' + I.svg('x', 12) + '</button>') + '</div>'; }).join('') + '</div>' : U.empty('upload', 'No photos yet', published ? '' : 'Upload photos of the paper or mark list to begin.')) + '</section>';
      var file = panel.querySelector('#x-file'), dz = panel.querySelector('#dz');
      async function addFiles(files) {
        var list = Array.prototype.slice.call(files).filter(function (f) { return /^image\//.test(f.type); });
        if (!list.length) return U.toast('Please choose image files.', 'danger');
        if (images.length + list.length > 10) return U.toast('Up to 10 photos per exam.', 'danger');
        U.toast('Processing ' + list.length + ' photo(s)...', 'info');
        for (var i = 0; i < list.length; i++) {
          try { var url = await U.compressImage(list[i], 1000, 0.6); var row = await S.insert('examImages', { examId: id, dataUrl: url, name: list[i].name, uploadedBy: session.userId }); images.push(row); } catch (err) { U.toast('Could not read ' + list[i].name, 'danger'); }
        }
        A.log('create', 'results', 'Uploaded ' + list.length + ' photo(s) for ' + e.name); photosTab(panel);
      }
      if (file) { file.addEventListener('change', function () { addFiles(file.files); }); ['dragover', 'dragenter'].forEach(function (n) { dz.addEventListener(n, function (ev) { ev.preventDefault(); dz.classList.add('drag'); }); }); ['dragleave', 'drop'].forEach(function (n) { dz.addEventListener(n, function (ev) { ev.preventDefault(); dz.classList.remove('drag'); if (n === 'drop' && ev.dataTransfer) addFiles(ev.dataTransfer.files); }); }); }
      panel.addEventListener('click', async function (ev) {
        var del = ev.target.closest('[data-del]');
        if (del) { await S.remove('examImages', del.dataset.del); images = images.filter(function (x) { return x.id !== del.dataset.del; }); viewIdx = 0; photosTab(panel); return; }
        var t = ev.target.closest('.t[data-i]'); if (t) { viewIdx = +t.dataset.i; U.toast('Photo ' + (viewIdx + 1) + ' selected. Open the Marks tab to compare.', 'info'); photosTab(panel); }
      });
      var ex = panel.querySelector('#x-extract');
      if (ex) ex.addEventListener('click', async function () {
        if (Object.keys(work).some(function (k) { return work[k] && (work[k].marks !== null || work[k].absent); })) {
          var ok = await U.confirm({ title: 'Replace existing marks?', message: 'Marks that are already entered will be replaced by the extracted values.', confirmLabel: 'Extract' }); if (!ok) return;
        }
        var prog = panel.querySelector('#x-prog'); prog.hidden = false; ex.setAttribute('aria-busy', 'true');
        var rows = await ED.ocr.extract({ exam: e, students: studs, images: images.map(function (x) { return x.dataUrl; }), onProgress: function (p) { prog.querySelector('i').style.width = p + '%'; } });
        rows.forEach(function (r) { work[r.studentId] = { marks: r.marks, absent: false, conf: r.confidence, source: 'ocr' }; });
        var ok2 = await persist('extracted'); if (!ok2) return;
        A.log('update', 'results', 'Extracted marks from photos for ' + e.name); U.toast('Marks extracted. Check the red ones.', 'success');
        showExam(id, 'marks');
      });
    }

    /* ---- Analysis tab ---- */
    function analysisTab(panel) {
      panelRef = null;
      var rows = studs.map(function (s) { var w = work[s.id]; return { s: s, marks: w && !w.absent && w.marks !== null ? w.marks : null, absent: !!(w && w.absent) }; }), scored = rows.filter(function (r) { return r.marks !== null; });
      if (!scored.length) { panel.innerHTML = '<div class="card">' + U.empty('analytics', 'No marks yet', 'Enter or extract marks to see the analysis.') + '</div>'; return; }
      var pcts = scored.map(function (r) { return r.marks / e.totalMarks * 100; }), avg = pcts.reduce(function (a, b) { return a + b; }, 0) / pcts.length, pass = pcts.filter(function (p) { return p >= settings.passPercent; }).length;
      var dist = {}; pcts.forEach(function (p) { var g = grade(p); dist[g] = (dist[g] || 0) + 1; });
      var sorted = scored.slice().sort(function (a, b) { return b.marks - a.marks; });
      panel.innerHTML = '<div class="grid-stats">' + U.stat('Class average', F.pct(avg), scored.length + ' students marked') + U.stat('Highest', Math.max.apply(null, scored.map(function (r) { return r.marks; })) + '/' + e.totalMarks, sorted[0].s.name, 'good') + U.stat('Lowest', Math.min.apply(null, scored.map(function (r) { return r.marks; })) + '/' + e.totalMarks, sorted[sorted.length - 1].s.name, 'bad') + U.stat('Pass rate', F.pct(pass / scored.length * 100), pass + ' passed, ' + (scored.length - pass) + ' failed', pass === scored.length ? 'good' : '') + '</div>' +
        '<div class="grid-2"><section class="card chart-card chart"><h3>Grade distribution</h3>' + C.donut({ items: Object.keys(dist).map(function (g) { return { label: 'Grade ' + g, value: dist[g] }; }), center: String(scored.length), centerSub: 'students', label: 'Grade distribution' }) + '</section>' +
        '<section class="card chart-card chart"><h3>Marks by student</h3>' + C.bar({ labels: sorted.map(function (r) { return r.s.name.split(' ')[0]; }), series: [{ name: 'Marks', values: sorted.map(function (r) { return r.marks; }) }], max: e.totalMarks, label: 'Marks by student', showValues: sorted.length <= 14 }) + '</section></div>';
    }

    /* ---- Student papers tab: one paper (several pages) per student, stored as you go ---- */
    function papersTab(panel) {
      panelRef = null;
      function scanOf(sid) { return ED.papers.find(id, sid); }
      function haveCount() { return studs.filter(function (s) { var sc = scanOf(s.id); return sc && sc.pages.length; }).length; }
      async function addFiles(s, fileList) {
        var files = Array.prototype.slice.call(fileList).filter(function (f) { return /^image\//.test(f.type); });
        if (!files.length) { U.toast('Please choose picture files (photos of the paper).', 'danger'); return false; }
        try { await ED.papers.addPages(id, s.id, files); } catch (err) { U.toast('Could not save the picture: ' + (err && err.message ? err.message : 'storage error'), 'danger'); return false; }
        A.log('create', 'results', 'Uploaded ' + files.length + ' paper page(s) of ' + s.name + ' for ' + e.name); U.toast(s.name + ': ' + files.length + ' page(s) saved', 'success'); return true;
      }
      async function saveMark(s, raw) {
        raw = String(raw).trim(); if (raw === '') return true;
        var v = Number(raw); if (isNaN(v) || v < 0 || v > e.totalMarks) { U.toast('Marks for ' + s.name + ' must be between 0 and ' + e.totalMarks + '.', 'danger'); return false; }
        if (published && !ctx.isAdmin) { U.toast('The result is published, so marks cannot be changed here.', 'info'); return true; }
        var cur = S._readList('marks').filter(function (m) { return m.examId === id && m.studentId === s.id; })[0];
        if (cur) await S.update('marks', cur.id, { marks: v, absent: false, source: 'manual', confidence: null }); else await S.insert('marks', { examId: id, studentId: s.id, marks: v, absent: false, source: 'manual', confidence: null });
        work[s.id] = { marks: v, absent: false, conf: null, source: 'manual' }; return true;
      }
      async function saveRemark(s, text) {
        text = String(text).trim(); var sc = scanOf(s.id);
        if (!sc && !text) return; sc = sc || await ED.papers.ensure(id, s.id);
        if (sc.remark !== text) await S.update('paperScans', sc.id, { remark: text });
      }
      function showLink(s) {
        var sc = scanOf(s.id); if (!sc || !sc.pages.length) return U.toast('Upload the paper first.', 'info');
        var url = ED.papers.link(sc.token), body = document.createElement('div'); body.className = 'stack';
        body.innerHTML = (published ? '' : '<div class="callout warn">' + I.svg('info', 18) + '<span>The result is not published yet. The parent page opens only after you publish it.</span></div>') +
          '<div class="field"><label for="lk-url">Private link for the parent of ' + h(s.name) + '</label><input class="input" id="lk-url" readonly value="' + h(url) + '"></div>' +
          '<div class="callout">' + I.svg('info', 18) + '<span>Demo: this link opens in the browser that holds the school data. When the backend is connected the same link works on any phone.</span></div>' + (sc.revoked ? '<div class="callout bad">This link is switched off.</div>' : '');
        body.querySelector('#lk-url').addEventListener('focus', function (ev) { ev.target.select(); });
        U.modal({ title: 'Parent link', body: body, actions: [{ label: 'Close', variant: 'secondary', value: 'x' }, { label: sc.revoked ? 'Switch link on' : 'Switch link off', variant: 'secondary', value: 'tog', onClick: async function () { await S.update('paperScans', sc.id, { revoked: !sc.revoked }); A.log('update', 'results', (sc.revoked ? 'Switched on' : 'Switched off') + ' the paper link of ' + s.name); U.toast(sc.revoked ? 'Link switched on' : 'Link switched off', 'success'); render(); } },
          { label: 'Copy link', variant: 'primary', value: 'copy', onClick: async function () { try { await navigator.clipboard.writeText(url); U.toast('Link copied', 'success'); } catch (err) { body.querySelector('#lk-url').select(); U.toast('Press Ctrl+C to copy the selected link.', 'info'); return false; } } }] });
      }
      async function viewPaper(s) {
        var sc = scanOf(s.id); if (!sc || !sc.pages.length) return U.toast('No paper uploaded for ' + s.name + ' yet.', 'info');
        var pages = await ED.papers.pagesOf(sc), body = document.createElement('div'); body.className = 'stack';
        body.innerHTML = '<div class="field"><label for="rm-text">Teacher remark (shown to the parent)</label><input class="input" id="rm-text" maxlength="200" value="' + h(sc.remark || '') + '" placeholder="e.g. Good effort, revise chapter 3"></div>' + pages.map(function (u, i) { return '<div><div class="small muted" style="margin-bottom:4px">Page ' + (i + 1) + ' of ' + pages.length + '</div><img class="viewer-img" style="max-height:none" alt="Page ' + (i + 1) + '" src="' + u + '"></div>'; }).join('');
        await U.modal({ title: s.name + ': ' + e.name, body: body, size: 'xl', actions: [{ label: 'Close', variant: 'secondary', value: false }, { label: 'Save remark', variant: 'primary', value: true, onClick: async function () { await saveRemark(s, body.querySelector('#rm-text').value); U.toast('Remark saved', 'success'); render(); } }] });
      }
      function render() {
        var have = haveCount(), pct = studs.length ? Math.round(have / studs.length * 100) : 0;
        panel.innerHTML = (published ? '' : '<div class="callout warn">' + I.svg('info', 18) + '<span>Parents can open their link only after the result is <b>published</b>. You can upload papers any time before that.</span></div>') +
          '<section class="card card-pad stack"><div class="row-between" style="flex-wrap:wrap"><h3>' + have + ' of ' + studs.length + ' papers uploaded</h3><div class="row" style="flex-wrap:wrap">' + U.btn('Upload one after another', { variant: 'primary', icon: 'upload', id: 'pp-seq' }) + (canMsg ? U.btn('Send links to parents', { variant: 'whatsapp', icon: 'whatsapp', id: 'pp-wa' }) : '') + '</div></div><div class="progress"><i style="width:' + pct + '%"></i></div>' +
          '<div class="small muted">Pictures are saved the moment you pick them. Several pages per student are fine.</div></section><section class="card" id="pp-tbl"></section>';
        var rows = studs.map(function (s) { var sc = scanOf(s.id), w = work[s.id] || {}; return { id: s.id, s: s, name: s.name, pages: sc ? sc.pages.length : 0, marks: w.absent ? 'Absent' : (w.marks === null || w.marks === undefined ? '-' : w.marks + '/' + e.totalMarks), remark: sc ? sc.remark : '', revoked: !!(sc && sc.revoked) }; });
        U.table(panel.querySelector('#pp-tbl'), {
          rows: rows, pageSize: 12, search: function (r) { return r.name; }, searchPlaceholder: 'Search student',
          columns: [
            { key: 'name', label: 'Student', render: function (r) { return '<div class="cell-main">' + U.avatar(r.name) + '<span>' + h(r.s.rollNo + '. ' + r.name) + '</span></div>'; } },
            { key: 'pages', label: 'Paper', render: function (r) { return r.pages ? U.badge(r.pages + (r.pages === 1 ? ' page' : ' pages'), 'present') + (r.revoked ? ' ' + U.badge('Link off', 'absent') : '') : U.badge('Missing', 'late'); } },
            { key: 'marks', label: 'Marks', num: true }, { key: 'remark', label: 'Remark', render: function (r) { return h(r.remark || '-'); } }
          ],
          actions: [
            { id: 'up', label: 'Upload or add pages', icon: 'upload', onClick: function (r) { var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true; inp.onchange = async function () { if (await addFiles(r.s, inp.files)) render(); }; inp.click(); } },
            { id: 'view', label: 'View paper and remark', icon: 'eye', show: function (r) { return r.pages > 0; }, onClick: function (r) { viewPaper(r.s); } },
            { id: 'link', label: 'Parent link', icon: 'assignments', show: function (r) { return r.pages > 0; }, onClick: function (r) { showLink(r.s); } },
            { id: 'dl', label: 'Download paper file', icon: 'backup', show: function (r) { return r.pages > 0; }, onClick: async function (r) { U.download(r.name.replace(/\s+/g, '-') + '-' + e.name.replace(/\s+/g, '-') + '.html', await ED.papers.sheetHTML(scanOf(r.id)), 'text/html'); U.toast('Paper file downloaded. Attach it in WhatsApp.', 'success'); } },
            { id: 'wa', label: 'Send link to parent', icon: 'whatsapp', show: function (r) { return canMsg && r.pages > 0; }, onClick: function (r) { sendLinks([r.s]); } },
            { id: 'rm', label: 'Remove paper', icon: 'x', danger: true, show: function (r) { return r.pages > 0; }, onClick: async function (r) { var ok = await U.confirm({ title: 'Remove the paper of ' + r.name + '?', message: 'All its pages and the parent link are deleted.', confirmLabel: 'Remove', danger: true }); if (!ok) return; await ED.papers.removeAll(scanOf(r.id)); A.log('delete', 'results', 'Removed the paper of ' + r.name + ' for ' + e.name); render(); } }
          ],
          empty: { icon: 'students', title: 'No students in this class', message: '' }
        });
        panel.querySelector('#pp-seq').addEventListener('click', function () { var first = studs.findIndex(function (s) { var sc = scanOf(s.id); return !(sc && sc.pages.length); }); seq(first < 0 ? 0 : first); });
        var wa = panel.querySelector('#pp-wa'); if (wa) wa.addEventListener('click', function () { var list = studs.filter(function (s) { var sc = scanOf(s.id); return sc && sc.pages.length && !sc.revoked; }); if (!list.length) return U.toast('Upload papers first.', 'info'); sendLinks(list); });
      }
      function sendLinks(list) {
        ED.wa.openModal({ students: list, type: 'custom', title: 'Send paper links to parents', text: 'Assalam o Alaikum {parent}, you can see the paper of {student} ({subject} {exam}) here: {paperLink} - {school}',
          vars: function (s) { var sc = scanOf(s.id), w = work[s.id] || {}; return { subject: sn(e.subjectId), exam: e.name, marks: w.marks === null || w.marks === undefined ? 'N/A' : w.marks, total: e.totalMarks, paperLink: sc ? ED.papers.link(sc.token) : '' }; } });
      }
      /* focused mode: one student at a time, pictures save automatically */
      var autoNext = true;
      function seq(i) {
        if (i >= studs.length) { U.toast('That was the last student. Well done.', 'success'); render(); return; }
        if (i < 0) i = 0;
        var s = studs[i], sc = scanOf(s.id), w = work[s.id] || {};
        panel.innerHTML = '<section class="card seq-card"><div class="row-between" style="flex-wrap:wrap"><div><div class="small muted">Student ' + (i + 1) + ' of ' + studs.length + ' | ' + haveCount() + ' papers uploaded</div><h2>' + h(s.rollNo + '. ' + s.name) + '</h2></div><button type="button" class="btn btn-ghost btn-sm" id="sq-back">Back to the list</button></div>' +
          '<div class="progress"><i style="width:' + Math.round(i / studs.length * 100) + '%"></i></div>' +
          '<label class="dropzone" for="sq-file">' + I.svg('upload', 28) + '<b style="font-weight:500">Take photos or choose pictures of the paper</b><span class="small">Pick all pages at once. They are saved immediately.</span></label><input type="file" id="sq-file" accept="image/*" multiple hidden>' +
          '<div class="mini-thumbs" id="sq-thumbs"></div>' +
          '<div class="form-grid"><div class="field"><label for="sq-marks">Marks (optional) out of ' + e.totalMarks + '</label><input class="input" id="sq-marks" type="number" min="0" max="' + e.totalMarks + '" step="0.5" value="' + (w.marks === null || w.marks === undefined ? '' : w.marks) + '"' + (published && !ctx.isAdmin ? ' disabled' : '') + '></div>' +
          '<div class="field"><label for="sq-remark">Remark for the parent (optional)</label><input class="input" id="sq-remark" maxlength="200" value="' + h(sc ? sc.remark : '') + '"></div></div>' +
          '<label class="check"><input type="checkbox" id="sq-auto"' + (autoNext ? ' checked' : '') + '> Move to the next student automatically after I add pictures</label>' +
          '<div class="row" style="flex-wrap:wrap">' + U.btn('Previous', { id: 'sq-prev' }) + U.btn('Skip', { id: 'sq-skip' }) + U.btn('Save and next', { variant: 'primary', id: 'sq-next' }) + '</div></section>';
        var thumbs = panel.querySelector('#sq-thumbs');
        (async function () {
          var cur = scanOf(s.id), pages = cur ? await ED.papers.pagesOf(cur) : [];
          thumbs.innerHTML = pages.length ? pages.map(function (u, k) { return '<div class="t"><img alt="Page ' + (k + 1) + '" src="' + u + '"><button type="button" data-rm="' + k + '" aria-label="Remove page ' + (k + 1) + '">' + I.svg('x', 12) + '</button></div>'; }).join('') : '<span class="small muted">No pages yet for this student.</span>';
        })();
        thumbs.addEventListener('click', async function (ev) { var b = ev.target.closest('[data-rm]'); if (!b) return; var cur = scanOf(s.id); await ED.papers.removePage(cur, cur.pages[+b.dataset.rm]); seq(i); });
        async function commit() { var okm = await saveMark(s, panel.querySelector('#sq-marks').value); await saveRemark(s, panel.querySelector('#sq-remark').value); return okm; }
        panel.querySelector('#sq-auto').addEventListener('change', function (ev) { autoNext = ev.target.checked; });
        panel.querySelector('#sq-file').addEventListener('change', async function (ev) {
          var good = await addFiles(s, ev.target.files); if (!good) return;
          if (autoNext && await commit()) setTimeout(function () { seq(i + 1); }, 500); else seq(i);
        });
        panel.querySelector('#sq-back').addEventListener('click', async function () { await commit(); render(); });
        panel.querySelector('#sq-prev').addEventListener('click', async function () { if (await commit()) seq(i - 1); });
        panel.querySelector('#sq-skip').addEventListener('click', function () { seq(i + 1); });
        panel.querySelector('#sq-next').addEventListener('click', async function () { if (await commit()) seq(i + 1); });
      }
      render();
    }

    var paperCount = S._readList('paperScans').filter(function (x) { return x.examId === id && x.pages.length; }).length;
    U.tabs(document.getElementById('x-tabs'), [{ id: 'marks', label: 'Marks' }, { id: 'papers', label: 'Student papers (' + paperCount + ')' }, { id: 'photos', label: 'Mark-list photos (' + images.length + ')' }, { id: 'analysis', label: 'Analysis' }].map(function (t) { return Object.assign(t, { render: { marks: marksTab, papers: papersTab, photos: photosTab, analysis: analysisTab }[t.id] }); }), { initial: current, onChange: function (t) { current = t; } });

    /* ---- header actions ---- */
    function on(btn, fn) { var el = document.getElementById(btn); if (el) el.addEventListener('click', fn); }
    on('x-draft', async function () { if (await persist(e.status === 'extracted' ? 'extracted' : 'pending')) { A.log('update', 'results', 'Saved draft marks for ' + e.name); U.toast('Draft saved', 'success'); showExam(id, current); } });
    on('x-verify', async function () {
      var left = missing(); if (left.length) return U.toast(left.length + ' student(s) have no marks yet. Enter marks or tick Absent.', 'danger');
      studs.forEach(function (s) { if (work[s.id]) work[s.id].conf = null; });
      if (await persist('verified')) { A.log('update', 'results', 'Verified marks for ' + e.name + ' (' + cn(e.classId) + ' ' + sn(e.subjectId) + ')'); U.toast('Marks verified. You can publish them now.', 'success'); showExam(id, 'marks'); }
    });
    on('x-publish', async function () {
      var ok = await U.confirm({ title: 'Publish ' + e.name + '?', message: 'The result becomes final and is locked. It will appear on report cards.', confirmLabel: 'Publish' }); if (!ok) return;
      await S.update('exams', id, { status: 'published' }); A.log('publish', 'results', 'Published ' + e.name + ' for class ' + cn(e.classId) + ' ' + sn(e.subjectId)); U.toast('Result published', 'success'); showExam(id, 'marks');
    });
    on('x-unlock', async function () {
      var ok = await U.confirm({ title: 'Unlock published result?', message: 'It goes back to Verified so you can correct marks. The change is written to the audit log.', confirmLabel: 'Unlock', danger: true }); if (!ok) return;
      await S.update('exams', id, { status: 'verified' }); A.log('update', 'results', 'Unlocked published result ' + e.name); U.toast('Result unlocked', 'success'); showExam(id, 'marks');
    });
    on('x-wa', function () {
      var students = studs.filter(function (s) { var w = work[s.id]; return w && w.marks !== null && w.marks !== undefined; });
      ED.wa.openModal({ students: students, type: 'result', vars: function (s) { var m = work[s.id].marks, p = m / e.totalMarks * 100; var sc = ED.papers.find(id, s.id); return { marks: m, total: e.totalMarks, percentage: F.pct(p), grade: grade(p), exam: e.name, subject: sn(e.subjectId), paperLink: sc && sc.pages.length && !sc.revoked ? ED.papers.link(sc.token) : '' }; } });
    });
    on('x-csv', function () { var r = rowsDataSafe(); U.download(e.name + '-' + cn(e.classId) + '.csv', U.toCSV([['roll', 'student', 'marks', 'total', 'percentage', 'grade']].concat(r.map(function (x) { return [x.s.rollNo, x.s.name, x.w.absent ? 'Absent' : (x.w.marks === null || x.w.marks === undefined ? '' : x.w.marks), e.totalMarks, x.pct === null ? '' : Math.round(x.pct * 10) / 10, x.pct === null ? '' : grade(x.pct)]; }))), 'text/csv'); });
    on('x-print', function () {
      var r = rowsDataSafe();
      U.print(U.docHeader(settings, 'Mark sheet', e.name + ' | Class ' + cn(e.classId) + ' | ' + sn(e.subjectId)) + '<table><thead><tr><th>Roll</th><th>Student</th><th class="n">Marks / ' + e.totalMarks + '</th><th class="n">%</th><th>Grade</th></tr></thead><tbody>' + r.map(function (x) { return '<tr><td>' + h(x.s.rollNo) + '</td><td>' + h(x.s.name) + '</td><td class="n">' + (x.w.absent ? 'Absent' : (x.w.marks === null || x.w.marks === undefined ? '-' : x.w.marks)) + '</td><td class="n">' + (x.pct === null ? '-' : F.pct(x.pct)) + '</td><td>' + (x.pct === null ? '-' : h(grade(x.pct))) + '</td></tr>'; }).join('') + '</tbody></table><div class="sig"><div>Subject teacher</div><div>Principal</div></div>', 'Mark sheet');
    });
    function rowsDataSafe() { return rowsData(); }
  }

  /* ---------------------------------------------------------------- router */
  function route() {
    var p = new URLSearchParams(location.hash.replace(/^#/, ''));
    if (p.get('exam')) showExam(p.get('exam'), p.get('tab')); else showList();
  }
  window.addEventListener('hashchange', route);
  route();
})();
