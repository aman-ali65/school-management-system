(async function () {
  var role = document.body.dataset.role;
  var session = await ED.shell.init({ role: role, active: 'students' });
  if (!session) return;
  var S = ED.storage, F = ED.fmt, U = ED.ui, I = ED.icons, h = F.esc, A = ED.audit, D = ED.data;
  var ctx = await D.context(session);
  var canEdit = ctx.isAdmin || ctx.settings.permissions.teacherCanAddStudents;
  var canMsg = ctx.isAdmin || ctx.settings.permissions.teacherCanMessage;
  var params = new URLSearchParams(location.search);
  var d, PERSON_FIELDS = ['name', 'gender', 'dob', 'address', 'parentName', 'fatherCnic', 'bForm', 'parentWhatsapp', 'feePlanId'];

  async function fetchAll() { d = await D.load(['students', 'classes', 'feePlans', 'sessions']); ctx.settings = await D.settings(); }
  await fetchAll();
  var activeId = function () { return ctx.settings.activeSessionId; };
  var bname = function (id) { return F.batchName(id); };
  var cname = function (id) { return F.className(d.map.classes[id]); };
  function batchBadge(r) { return r.sessionId === activeId() ? U.badge('Current | ' + bname(r.sessionId), 'present') : U.badge('Old | ' + bname(r.sessionId)); }
  function label(c) { return c.name + '-' + c.section; }

  var actions = '';
  if (canEdit) actions += U.btn('Add student', { variant: 'primary', icon: 'plus', id: 'add' });
  if (ctx.isAdmin) actions += U.btn('Import CSV', { icon: 'upload', id: 'import' });
  actions += U.btn('Export CSV', { id: 'export' });
  if (ctx.isAdmin) actions += U.btn('Add selected to a new batch', { id: 'promote' }) + U.btn('Print ID cards', { id: 'idcards' });
  if (canMsg) actions += U.btn('Message parents', { variant: 'whatsapp', icon: 'whatsapp', id: 'msg' });

  var batchSelect = ctx.isAdmin ? '<div class="field"><label for="f-b">Batch</label><select class="select" id="f-b"><option value="">All batches</option>' + d.sessions.map(function (b) { return '<option value="' + h(b.id) + '"' + (b.id === activeId() ? ' selected' : '') + '>' + h(b.name) + (b.id === activeId() ? ' (current)' : '') + '</option>'; }).join('') + '</select></div>' : '';
  document.getElementById('content').innerHTML = U.pageHead('Students', ctx.isAdmin ? 'Every child, by batch. Pick a batch to see that year; old batches stay safe here.' : 'Students of your assigned classes in the current batch.' + (canEdit ? '' : ' The admin has not allowed teachers to add or edit students.'), actions) +
    '<div class="filters card card-pad">' + batchSelect + '<div class="field"><label for="f-c">Class</label><select class="select" id="f-c"></select></div>' +
    '<div class="field"><label for="f-s">Status</label><select class="select" id="f-s"><option value="">All</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div></div>' +
    '<section class="card" id="tbl"></section>';

  var bEl = document.getElementById('f-b'), cEl = document.getElementById('f-c'), sEl = document.getElementById('f-s');
  function fillClassFilter() {
    var b = bEl ? bEl.value : '', list = ctx.classes.filter(function (c) { return !b || c.sessionId === b; }), keep = cEl.value;
    cEl.innerHTML = '<option value="">All classes</option>' + U.options(list, 'id', F.className, list.some(function (c) { return c.id === keep; }) ? keep : '');
  }
  fillClassFilter();

  function rows() {
    var b = bEl ? bEl.value : '', c = cEl.value, s = sEl.value;
    return d.students.filter(function (x) { return ctx.canAccess(x.classId) && (!b || x.sessionId === b) && (!c || x.classId === c) && (!s || x.status === s); })
      .map(function (x) { return Object.assign({}, x, { cls: cname(x.classId) }); });
  }
  var tbl = U.table(document.getElementById('tbl'), {
    rows: rows(), pageSize: 10, selectable: true,
    search: function (r) { return [r.name, r.rollNo, r.cls, r.parentName, r.parentWhatsapp, r.fatherCnic, F.digits(r.fatherCnic), r.bForm, F.digits(r.bForm), bname(r.sessionId)].join(' '); }, searchPlaceholder: 'Search name, CNIC, B-form, roll',
    columns: [
      { key: 'name', label: 'Student', render: function (r) { return '<div class="cell-main">' + U.avatar(r.name) + '<div><div>' + h(r.name) + '</div><div class="cell-sub">' + (r.gender === 'female' ? 'Female' : 'Male') + (r.dob ? ' | Born ' + F.date(r.dob) : '') + '</div></div></div>'; } },
      { key: 'rollNo', label: 'Roll no', sort: function (r) { return Number(r.rollNo) || 0; } },
      { key: 'cls', label: 'Class' },
      { key: 'sessionId', label: 'Batch', sort: function (r) { return bname(r.sessionId); }, render: batchBadge },
      { key: 'parentName', label: 'Father / parent', render: function (r) { return '<div>' + h(r.parentName || '-') + '</div><div class="cell-sub">CNIC ' + h(r.fatherCnic ? F.cnic(r.fatherCnic) : 'not added') + '</div><div class="cell-sub">' + h(r.parentWhatsapp || 'No number') + '</div>'; } },
      { key: 'status', label: 'Status', render: function (r) { return U.statusBadge('active', r.status); } }
    ],
    actions: [
      { id: 'edit', label: 'Edit student', icon: 'settings', show: function () { return canEdit; }, onClick: function (r) { openForm({ mode: 'edit', row: r }); } },
      { id: 'hist', label: 'History in all batches', icon: 'history', show: function () { return ctx.isAdmin; }, onClick: showHistory },
      { id: 'nb', label: 'Add to a new batch', icon: 'plus', show: function () { return ctx.isAdmin; }, onClick: function (r) { openForm({ mode: 'newbatch', row: r }); } },
      { id: 'msg', label: 'Message parent', icon: 'whatsapp', show: function () { return canMsg; }, onClick: function (r) { ED.wa.openModal({ students: [r], type: 'custom' }); } },
      { id: 'card', label: 'Print ID card', icon: 'user', show: function () { return ctx.isAdmin; }, onClick: function (r) { idCards([r]); } },
      { id: 'toggle', label: 'Activate or deactivate', icon: 'check', show: function () { return canEdit; }, onClick: toggle },
      { id: 'del', label: 'Remove or delete', icon: 'x', danger: true, show: function () { return ctx.isAdmin; }, onClick: removeFlow }
    ],
    empty: { icon: 'students', title: 'No students found', message: canEdit ? 'Use Add student to create one.' : 'Students will appear here once the admin adds them.' }
  });
  function repaint() { tbl.setRows(rows()); }
  if (bEl) bEl.addEventListener('change', function () { fillClassFilter(); repaint(); });
  cEl.addEventListener('change', repaint); sEl.addEventListener('change', repaint);
  async function refresh() { ctx = await D.context(session); await fetchAll(); if (bEl) { var cur = bEl.value; bEl.innerHTML = '<option value="">All batches</option>' + d.sessions.map(function (b) { return '<option value="' + h(b.id) + '">' + h(b.name) + (b.id === activeId() ? ' (current)' : '') + '</option>'; }).join(''); bEl.value = d.sessions.some(function (b) { return b.id === cur; }) ? cur : ''; } fillClassFilter(); tbl.setRows(rows(), true); }
  if (params.get('q')) { var qi = document.querySelector('[data-q]'); qi.value = params.get('q'); qi.dispatchEvent(new Event('input', { bubbles: true })); if (bEl) { bEl.value = ''; fillClassFilter(); repaint(); } }

  /* ---------------------------------------------------------------- add / edit / add-to-new-batch form */
  function rowsOfPerson(pid) { return d.students.filter(function (s) { return (s.personId || s.id) === pid; }); }
  function personFields(src) { var o = {}; PERSON_FIELDS.forEach(function (k) { o[k] = src[k] || ''; }); return o; }

  async function openForm(o) {
    var mode = o.mode, row = o.row || null, person = row ? { personId: row.personId || row.id, rows: [row].concat(rowsOfPerson(row.personId || row.id).filter(function (z) { return z.id !== row.id; })) } : null;
    var vals = row ? personFields(row) : { gender: 'male', feePlanId: 'fp-0' };
    var oneClass = !ctx.isAdmin;                             /* teachers pick from their own classes; admin types dynamic batch and class */
    var batchDefault = mode === 'edit' ? bname(row.sessionId) : bname(activeId());
    var batchClasses = function (bid) { return d.classes.filter(function (c) { return c.sessionId === bid; }); };
    var body = document.createElement('div'); body.className = 'stack';
    var planOpts = d.feePlans.map(function (p) { return '<option value="' + p.id + '">' + h(p.name + (p.discountPercent ? ' (' + p.discountPercent + '% off)' : '')) + '</option>'; }).join('');
    function field(id, lab, ctl, hint, full) { return '<div class="field' + (full ? ' full' : '') + '"><label for="f_' + id + '">' + lab + '</label>' + ctl + (hint ? '<span class="hint">' + hint + '</span>' : '') + '</div>'; }
    var cnicLocked = mode === 'newbatch';
    body.innerHTML = (mode === 'edit' ? '<div class="callout">' + I.svg('info', 18) + '<span>Name, parent and CNIC changes apply to <b>every batch</b> of this child. Class and roll number change only this batch\'s record. To start a new year use <b>Add to a new batch</b>.</span></div>' : '') +
      (mode === 'newbatch' ? '<div class="callout good">' + I.svg('check', 18) + '<span>Adding <b>' + h(row.name) + '</b> to a new batch. The old batch (' + h(bname(row.sessionId)) + ', class ' + h(cname(row.classId)) + ') stays exactly as it is.</span></div>' : '') +
      '<div class="form-grid">' +
      field('bForm', 'Student B-form (optional)', '<input class="input" id="f_bForm" maxlength="15" placeholder="35202-1234567-1"' + (cnicLocked || mode === 'edit' && false ? ' disabled' : '') + '>', mode === 'add' ? 'Type it first. If the child is already in the system you will be told.' : '') +
      field('fatherCnic', 'Father CNIC <span class="req">*</span>', '<input class="input" id="f_fatherCnic" maxlength="15" placeholder="35202-1234567-1"' + (cnicLocked ? ' disabled' : '') + '>', '13 digits. Used to find the student quickly.') +
      '<div class="full" id="lk"></div>' +
      field('name', 'Student name <span class="req">*</span>', '<input class="input" id="f_name">', '', true) +
      field('parentName', 'Father name <span class="req">*</span>', '<input class="input" id="f_parentName">') +
      field('parentWhatsapp', 'Parent WhatsApp number <span class="req">*</span>', '<input class="input" id="f_parentWhatsapp" type="tel" placeholder="+92 300 1234567">') +
      field('gender', 'Gender', '<select class="select" id="f_gender"><option value="male">Male</option><option value="female">Female</option></select>') +
      field('dob', 'Date of birth', '<input class="input" id="f_dob" type="date" max="' + F.today() + '">') +
      field('address', 'Address', '<input class="input" id="f_address">', '', true) +
      field('feePlanId', 'Fee plan', '<select class="select" id="f_feePlanId">' + planOpts + '</select>') +
      (ctx.isAdmin ? field('batch', 'Batch <span class="req">*</span>', '<input class="input" id="f_batch" list="dl-batch" autocomplete="off"' + (mode === 'edit' ? ' disabled' : '') + '><datalist id="dl-batch">' + d.sessions.map(function (b) { return '<option value="' + h(b.name) + '">'; }).join('') + '</datalist>', mode === 'edit' ? 'A batch cannot be changed here.' : 'Type a batch. An existing one is matched, a new name creates a new batch.')
        : '') +
      field('classLabel', 'Class <span class="req">*</span>', oneClass ? '<select class="select" id="f_classLabel">' + U.options(ctx.classes, 'id', F.className, row ? row.classId : '') + '</select>' : '<input class="input" id="f_classLabel" list="dl-class" autocomplete="off" placeholder="e.g. 10-A"><datalist id="dl-class"></datalist>', oneClass ? '' : 'Type a class like 10-A. A new class is created in that batch if needed.') +
      field('rollNo', 'Roll number <span class="req">*</span>', '<input class="input" id="f_rollNo" maxlength="8">') +
      field('status', 'Status', '<select class="select" id="f_status"><option value="active">Active</option><option value="inactive">Inactive</option></select>') +
      '</div><div class="form-error" id="form-error" role="alert" hidden></div>';
    var $ = function (id) { return body.querySelector('#f_' + id); };

    function fillPerson(src) { PERSON_FIELDS.forEach(function (k) { if ($(k) && src[k] !== undefined) $(k).value = src[k] || ''; }); }
    fillPerson(Object.assign({}, vals, { feePlanId: vals.feePlanId || 'fp-0' }));
    $('bForm').value = vals.bForm ? F.cnic(vals.bForm) : ''; $('fatherCnic').value = vals.fatherCnic ? F.cnic(vals.fatherCnic) : '';
    $('status').value = row && mode === 'edit' ? row.status : 'active';
    if ($('batch')) $('batch').value = batchDefault;
    if (mode === 'edit') { if (oneClass) $('classLabel').value = row.classId; else $('classLabel').value = label(d.map.classes[row.classId]); $('rollNo').value = row.rollNo; }
    if (mode === 'newbatch' && oneClass) $('classLabel').value = '';

    function refreshClassList() {
      var dl = body.querySelector('#dl-class'); if (!dl) return;
      var b = $('batch') ? d.sessions.filter(function (x) { return D.normBatch(x.name) === D.normBatch($('batch').value); })[0] : null;
      var list = b ? batchClasses(b.id) : d.classes.filter(function (c) { return c.sessionId === activeId(); });
      var seen = {}; dl.innerHTML = list.filter(function (c) { var k = label(c); if (seen[k]) return false; seen[k] = 1; return true; }).map(function (c) { return '<option value="' + h(label(c)) + '">'; }).join('');
    }
    if ($('batch')) $('batch').addEventListener('input', refreshClassList); refreshClassList();

    /* ---- find an existing child by B-form or father CNIC ---- */
    var found = mode === 'newbatch' ? person : null, primary = null;
    function setPrimaryLabel() { if (primary) primary.textContent = found && mode !== 'edit' ? 'Add to new batch' : (mode === 'edit' ? 'Save changes' : 'Save student'); }
    function latest(p) { return p.rows[0]; }
    function useFound(p) {
      found = p; var r = latest(p); fillPerson(personFields(r)); $('bForm').value = r.bForm ? F.cnic(r.bForm) : $('bForm').value; $('fatherCnic').value = r.fatherCnic ? F.cnic(r.fatherCnic) : $('fatherCnic').value;
      var hist = p.rows.map(function (x) { return 'batch ' + bname(x.sessionId) + ', class ' + label(d.map.classes[x.classId]); }).join('; ');
      if ($('batch') && p.rows.some(function (x) { return D.normBatch(bname(x.sessionId)) === D.normBatch($('batch').value); })) { $('batch').value = ''; $('batch').placeholder = 'Type the new batch, e.g. 2027'; }
      body.querySelector('#lk').innerHTML = '<div class="callout good">' + I.svg('check', 18) + '<span><b>' + h(r.name) + '</b> is already in the system (' + h(hist) + '). Details are filled in. Choose the <b>new batch and class</b> below, then press <b>Add to new batch</b>. The old record stays.</span></div>';
      setPrimaryLabel();
    }
    async function lookup() {
      if (mode !== 'add') return;
      var res = await D.lookupPerson({ bForm: $('bForm').value, fatherCnic: $('fatherCnic').value }), lk = body.querySelector('#lk');
      if (res.exact) { useFound(res.exact); return; }
      found = null; setPrimaryLabel();
      if (res.siblings.length) {
        lk.innerHTML = '<div class="callout warn">' + I.svg('info', 18) + '<span>Children with this father CNIC are already in the system. Is this one of them?</span></div><div class="stack" style="gap:6px;margin-top:6px">' +
          res.siblings.map(function (p) { var r = latest(p); return '<div class="row-between card card-pad" style="padding:8px 12px"><span>' + h(r.name) + ' <span class="muted small">(' + h(bname(r.sessionId)) + ', class ' + h(cname(r.classId)) + ')</span></span><button type="button" class="btn btn-secondary btn-sm" data-use="' + h(p.personId) + '">Yes, this child</button></div>'; }).join('') +
          '<div class="small muted">Not listed? Just continue, this is a new child.</div></div>';
        lk._sib = res.siblings;
      } else lk.innerHTML = '';
    }
    body.addEventListener('click', function (e) { var b = e.target.closest('[data-use]'); if (!b) return; var p = body.querySelector('#lk')._sib.filter(function (x) { return x.personId === b.dataset.use; })[0]; if (p) useFound(p); });
    ['bForm', 'fatherCnic'].forEach(function (k) { $(k).addEventListener('input', function () { if (F.digits($(k).value).length === 13) lookup(); else if (mode === 'add' && found) { found = null; body.querySelector('#lk').innerHTML = ''; setPrimaryLabel(); } }); });
    if (mode === 'newbatch') useFound(person);

    var out = null;
    var overlay = U.modal({
      title: mode === 'add' ? 'Add student' : mode === 'edit' ? 'Edit student' : 'Add ' + row.name + ' to a new batch', body: body, size: 'wide',
      actions: [{ label: 'Cancel', variant: 'secondary', value: false }, { label: mode === 'edit' ? 'Save changes' : mode === 'newbatch' ? 'Add to new batch' : 'Save student', variant: 'primary', value: true, onClick: async function (box) {
        var err = box.querySelector('#form-error'); function fail(m, f) { err.textContent = m; err.hidden = false; var el = f && box.querySelector('#f_' + f); if (el) el.focus(); return false; }
        err.hidden = true;
        var v = {}; PERSON_FIELDS.forEach(function (k) { v[k] = ($(k).value || '').trim(); });
        var roll = $('rollNo').value.trim(), status = $('status').value, pid = found ? found.personId : (person ? person.personId : null);
        if (!v.name) return fail('Student name is required.', 'name');
        if (!F.cnicOk(v.fatherCnic)) return fail('Father CNIC must have 13 digits.', 'fatherCnic');
        if (v.bForm && !F.cnicOk(v.bForm)) return fail('B-form must have 13 digits, or leave it empty.', 'bForm');
        if (!v.parentName) return fail('Father name is required.', 'parentName');
        if (!D.phoneOk(v.parentWhatsapp)) return fail('Enter a valid WhatsApp number with 10 to 15 digits.', 'parentWhatsapp');
        if (!roll) return fail('Roll number is required.', 'rollNo');
        if (v.bForm && d.students.some(function (s) { return (s.personId || s.id) !== pid && F.digits(s.bForm) === F.digits(v.bForm); })) return fail('Another child already has this B-form.', 'bForm');
        v.fatherCnic = F.cnic(v.fatherCnic); v.bForm = v.bForm ? F.cnic(v.bForm) : '';

        /* 1) check without creating anything */
        var batchText = ctx.isAdmin ? $('batch').value.trim() : '', batchRow = ctx.isAdmin ? d.sessions.filter(function (x) { return D.normBatch(x.name) === D.normBatch(batchText); })[0] : d.map.sessions[activeId()];
        if (ctx.isAdmin && !batchText) return fail('Batch is required.', 'batch');
        var classRow = null, parsed = null;
        if (oneClass) { classRow = d.map.classes[$('classLabel').value]; if (!classRow) return fail('Choose a class.', 'classLabel'); }
        else { parsed = D.parseClassLabel($('classLabel').value); if (!parsed) return fail('Write the class like 10-A.', 'classLabel'); if (batchRow) classRow = d.classes.filter(function (c) { return c.sessionId === batchRow.id && label(c).toLowerCase() === (parsed.name + '-' + parsed.section).toLowerCase(); })[0] || null; }
        if (classRow && d.students.some(function (s) { return s.classId === classRow.id && String(s.rollNo) === roll && (mode !== 'edit' || s.id !== row.id); })) return fail('Roll number ' + roll + ' is already used in class ' + F.className(classRow) + '.', 'rollNo');
        if (mode !== 'edit' && pid && batchRow && rowsOfPerson(pid).some(function (s) { return s.sessionId === batchRow.id; })) return fail(v.name + ' is already enrolled in batch ' + batchRow.name + '. Choose another batch, or use Edit.', 'batch');

        /* 2) now create the batch and class if they are new */
        var batch = batchRow || await D.resolveBatch(batchText);
        if (!batch) return false;
        if (mode !== 'edit' && pid && rowsOfPerson(pid).some(function (z) { return z.sessionId === batch.id; })) return fail(v.name + ' is already enrolled in batch ' + batch.name + '. Choose another batch, or use Edit.', 'batch');
        var cls = classRow || await D.resolveClass(batch.id, $('classLabel').value);
        if (!cls) return fail('Write the class like 10-A.', 'classLabel');
        out = { v: v, roll: roll, status: status, batch: batch, cls: cls, pid: pid };
      } }]
    });
    primary = body.closest('.modal-overlay').querySelector('.modal-foot .btn-primary'); setPrimaryLabel();
    var ok = await overlay;
    if (ok !== true || !out) return;
    var x = out;
    if (mode === 'edit') {
      await S.update('students', row.id, Object.assign({ rollNo: x.roll, status: x.status, classId: x.cls.id }, x.v));
      await syncPerson(x.pid, x.v, row.id);
      A.log('update', 'student', 'Updated student ' + x.v.name);
    } else {
      var personId = x.pid || ('per-' + S.uid());
      await S.insert('students', Object.assign({ personId: personId, rollNo: x.roll, status: x.status, classId: x.cls.id, sessionId: x.batch.id, admissionDate: F.today(), addedBy: session.userId }, x.v));
      if (x.pid) await syncPerson(personId, x.v, null);
      A.log('create', 'student', (x.pid ? 'Added ' + x.v.name + ' to batch ' + x.batch.name : 'Added student ' + x.v.name + ' to ' + F.className(x.cls)));
    }
    U.toast(mode === 'newbatch' || (mode === 'add' && x.pid) ? x.v.name + ' added to batch ' + x.batch.name + '. The old batch record is kept.' : 'Student saved', 'success');
    refresh();
  }
  /* person-level details are copied to every enrollment of the same child */
  async function syncPerson(pid, v, exceptId) {
    var list = S._readList('students').map(function (s) { return (s.personId || s.id) === pid && s.id !== exceptId ? Object.assign({}, s, v, { updatedAt: new Date().toISOString() }) : s; });
    S._writeList('students', list);
  }
  async function toggle(r) {
    var next = r.status === 'active' ? 'inactive' : 'active';
    await S.update('students', r.id, { status: next }); A.log('update', 'student', (next === 'active' ? 'Activated ' : 'Deactivated ') + r.name);
    U.toast(r.name + ' is now ' + next, 'success'); refresh();
  }

  /* ---------------------------------------------------------------- history across batches */
  async function showHistory(r) {
    var x = await D.load(['attendance', 'marks', 'exams', 'feeInvoices']), pid = r.personId || r.id, list = rowsOfPerson(pid).sort(function (a, b) { return bname(a.sessionId).localeCompare(bname(b.sessionId)); });
    var body = list.map(function (e) {
      var att = x.attendance.filter(function (a) { return a.studentId === e.id; }), pc = D.attPct(att);
      var mk = x.marks.filter(function (m) { return m.studentId === e.id && !m.absent && m.marks !== null && x.map.exams[m.examId] && x.map.exams[m.examId].status === 'published'; });
      var tot = mk.reduce(function (a, m) { return a + x.map.exams[m.examId].totalMarks; }, 0), got = mk.reduce(function (a, m) { return a + m.marks; }, 0);
      var inv = x.feeInvoices.filter(function (i) { return i.studentId === e.id; }), billed = inv.reduce(function (a, i) { return a + i.total; }, 0), paid = inv.reduce(function (a, i) { return a + i.paid; }, 0);
      return '<section class="card card-pad stack"><div class="row-between"><h3>Batch ' + h(bname(e.sessionId)) + ' | Class ' + h(cname(e.classId)) + '</h3>' + batchBadge(e) + '</div>' +
        '<div class="grid-stats" style="grid-template-columns:repeat(auto-fit,minmax(120px,1fr))">' + U.stat('Roll no', h(e.rollNo), U.statLabel('active', e.status)) + U.stat('Attendance', pc === null ? '-' : F.pct(pc), att.length + ' records') + U.stat('Result', tot ? F.pct(got / tot * 100) : '-', mk.length + ' published papers') + U.stat('Fees', F.currency(paid), 'paid of ' + F.currency(billed), billed - paid ? 'bad' : 'good') + '</div></section>';
    }).join('');
    U.view(r.name + ': all batches', '<div class="stack"><div class="small muted">CNIC ' + h(F.cnic(r.fatherCnic) || '-') + (r.bForm ? ' | B-form ' + h(F.cnic(r.bForm)) : '') + '</div>' + body + '</div>', 'xl');
  }

  /* ---------------------------------------------------------------- remove from batch / delete child (goes to Restore) */
  async function removeFlow(r) {
    var pid = r.personId || r.id, all = rowsOfPerson(pid), multi = all.length > 1;
    var x = await D.load(['attendance', 'marks', 'feeInvoices']);
    function count(e) { return { att: x.attendance.filter(function (a) { return a.studentId === e.id; }).length, mk: x.marks.filter(function (m) { return m.studentId === e.id; }).length, inv: x.feeInvoices.filter(function (i) { return i.studentId === e.id; }).length }; }
    var c = count(r), body = document.createElement('div'); body.className = 'stack';
    body.innerHTML = '<p>' + (multi ? '<b>' + h(r.name) + '</b> is in ' + all.length + ' batches.' : 'Choose what to remove.') + ' Nothing is lost for good: everything goes to <b>Restore deleted</b>, where you can bring it back.</p>' +
      '<label class="check"><input type="radio" name="rm" value="one" checked> Remove from batch <b>' + h(bname(r.sessionId)) + '</b> only (' + c.att + ' attendance, ' + c.mk + ' marks, ' + c.inv + ' fee records)' + (multi ? '. Other batches stay.' : '') + '</label>' +
      (multi ? '<label class="check"><input type="radio" name="rm" value="all"> Delete the child from <b>all ' + all.length + ' batches</b> (' + all.map(function (e) { return bname(e.sessionId); }).join(', ') + ')</label>' : '');
    var pick = await U.modal({ title: 'Remove ' + r.name, body: body, actions: [{ label: 'Cancel', variant: 'secondary', value: null }, { label: 'Move to Restore', variant: 'danger', value: 'go', onClick: function (box) { body.dataset.v = (box.querySelector('input[name=rm]:checked') || {}).value; } }] });
    if (pick !== 'go') return;
    var targets = body.dataset.v === 'all' ? all : [r];
    for (var i = 0; i < targets.length; i++) await trashEnrollment(targets[i]);
    A.log('delete', 'student', (body.dataset.v === 'all' ? 'Deleted ' : 'Removed ') + r.name + (body.dataset.v === 'all' ? ' from all batches' : ' from batch ' + bname(r.sessionId)) + ' (restorable)');
    U.toast(r.name + ' moved to Restore deleted', 'success'); refresh();
  }
  async function trashEnrollment(e) {
    var take = function (col, key) { var all = S._readList(col), mine = all.filter(function (z) { return z[key] === e.id; }); S._writeList(col, all.filter(function (z) { return z[key] !== e.id; })); return mine; };
    var payload = { student: e, attendance: take('attendance', 'studentId'), marks: take('marks', 'studentId'), invoices: take('feeInvoices', 'studentId'), payments: take('feePayments', 'studentId'), papers: take('paperScans', 'studentId') };
    S._writeList('students', S._readList('students').filter(function (z) { return z.id !== e.id; }));
    await S.insert('trash', { kind: 'enrollment', personId: e.personId || e.id, name: e.name, label: bname(e.sessionId) + ' | class ' + cname(e.classId), deletedAt: new Date().toISOString(), deletedBy: session.name, payload: payload, counts: { attendance: payload.attendance.length, marks: payload.marks.length, invoices: payload.invoices.length, papers: payload.papers.length } });
  }

  /* ---------------------------------------------------------------- export, import, bulk */
  document.getElementById('export').addEventListener('click', function () {
    var list = tbl.visible();
    U.download('students.csv', U.toCSV([['name', 'rollNo', 'class', 'batch', 'gender', 'dob', 'parentName', 'fatherCnic', 'bForm', 'parentWhatsapp', 'address', 'status']].concat(list.map(function (s) { return [s.name, s.rollNo, s.cls, bname(s.sessionId), s.gender, s.dob, s.parentName, s.fatherCnic, s.bForm, s.parentWhatsapp, s.address, s.status]; }))), 'text/csv');
    U.toast(list.length + ' students exported', 'success');
  });
  var imp = document.getElementById('import');
  if (imp) imp.addEventListener('click', async function () {
    var body = document.createElement('div'); body.className = 'stack';
    body.innerHTML = '<p>Upload a CSV with: <b>name, rollNo, class, parentName, fatherCnic, parentWhatsapp</b> (optional: batch, gender, bForm). The batch and class are created if they do not exist yet. A child whose B-form is already in the system is added to the new batch, not duplicated.</p><input class="input" type="file" id="csv-file" accept=".csv,text/csv"><button type="button" class="btn btn-secondary btn-sm" id="sample" style="align-self:flex-start">Download sample CSV</button><div class="form-error" id="csv-err" hidden></div>';
    body.querySelector('#sample').addEventListener('click', function () { U.download('students-sample.csv', U.toCSV([['name', 'rollNo', 'class', 'batch', 'gender', 'parentName', 'fatherCnic', 'bForm', 'parentWhatsapp'], ['Sample Student', '20', '9-A', bname(activeId()), 'male', 'Mr. Sample', '35202-1234567-1', '', '+92 300 1234567']]), 'text/csv'); });
    var result = null;
    await U.modal({ title: 'Import students from CSV', body: body, actions: [{ label: 'Cancel', variant: 'secondary', value: false }, { label: 'Import', variant: 'primary', value: true, onClick: async function (box) {
      var f = box.querySelector('#csv-file').files[0], err = box.querySelector('#csv-err');
      if (!f) { err.textContent = 'Choose a CSV file first.'; err.hidden = false; return false; }
      var rowsCsv = U.parseCSV(await U.readText(f));
      if (rowsCsv.length < 2) { err.textContent = 'The file has no data rows.'; err.hidden = false; return false; }
      var head = rowsCsv[0].map(function (x) { return x.trim().toLowerCase(); }), idx = function (n) { return head.indexOf(n.toLowerCase()); };
      if (idx('name') < 0 || idx('rollno') < 0 || idx('class') < 0 || idx('fathercnic') < 0) { err.textContent = 'The first row must include name, rollNo, class and fatherCnic.'; err.hidden = false; return false; }
      var added = 0, errors = [];
      await fetchAll();
      for (var i = 1; i < rowsCsv.length; i++) {
        var r = rowsCsv[i], g = function (n) { return idx(n) >= 0 ? (r[idx(n)] || '').trim() : ''; }, name = g('name'), roll = g('rollno'), cnic = g('fathercnic'), bf = g('bform'), phone = g('parentwhatsapp'), bn = g('batch') || bname(activeId());
        if (!name || !roll) { errors.push('Row ' + (i + 1) + ': name and roll number are required'); continue; }
        if (!F.cnicOk(cnic)) { errors.push('Row ' + (i + 1) + ': father CNIC must have 13 digits'); continue; }
        if (bf && !F.cnicOk(bf)) { errors.push('Row ' + (i + 1) + ': B-form must have 13 digits'); continue; }
        if (phone && !D.phoneOk(phone)) { errors.push('Row ' + (i + 1) + ': invalid phone number'); continue; }
        if (!D.parseClassLabel(g('class'))) { errors.push('Row ' + (i + 1) + ': class must look like 9-A'); continue; }
        var batch = d.sessions.filter(function (b) { return D.normBatch(b.name) === D.normBatch(bn); })[0];
        if (!batch) { batch = await S.insert('sessions', { name: bn, startDate: '', endDate: '', isActive: false }); d.sessions.push(batch); F._batch.names[batch.id] = batch.name; }
        var person = bf ? d.students.filter(function (s) { return F.digits(s.bForm) === F.digits(bf); })[0] : null;
        if (person && d.students.some(function (s) { return (s.personId || s.id) === (person.personId || person.id) && s.sessionId === batch.id; })) { errors.push('Row ' + (i + 1) + ': ' + name + ' is already in batch ' + batch.name); continue; }
        var cls = await D.resolveClass(batch.id, g('class')); if (!d.classes.some(function (c) { return c.id === cls.id; })) d.classes.push(cls);
        if (d.students.some(function (s) { return s.classId === cls.id && String(s.rollNo) === roll; })) { errors.push('Row ' + (i + 1) + ': roll ' + roll + ' already exists in ' + F.className(cls)); continue; }
        var rec = await S.insert('students', Object.assign(person ? personFields(person) : {}, { personId: person ? (person.personId || person.id) : 'per-' + S.uid(), name: name, rollNo: roll, classId: cls.id, sessionId: batch.id, gender: g('gender').toLowerCase() || 'male', parentName: g('parentname'), fatherCnic: F.cnic(cnic), bForm: bf ? F.cnic(bf) : '', parentWhatsapp: phone, status: 'active', feePlanId: 'fp-0', admissionDate: F.today(), addedBy: session.userId }));
        d.students.push(rec); added++;
      }
      result = { added: added, errors: errors };
    } }] });
    if (!result) return;
    A.log('create', 'student', 'Imported ' + result.added + ' students from CSV'); await refresh();
    U.toast(result.added + ' students imported' + (result.errors.length ? ', ' + result.errors.length + ' skipped' : ''), result.errors.length ? 'info' : 'success');
    if (result.errors.length) U.view('Rows that were skipped', '<ul>' + result.errors.slice(0, 15).map(function (e) { return '<li>' + h(e) + '</li>'; }).join('') + '</ul>');
  });

  function needSelection() { var s = tbl.selected(); if (!s.length) { U.toast('Tick one or more students in the table first.', 'info'); return null; } return s; }
  var promote = document.getElementById('promote');
  if (promote) promote.addEventListener('click', async function () {
    var sel = needSelection(); if (!sel) return;
    var body = document.createElement('div'); body.className = 'stack';
    body.innerHTML = '<p>Adds the ' + sel.length + ' selected students to a new batch and class. Their old batch records stay untouched.</p><div class="field"><label for="pb">Batch</label><input class="input" id="pb" list="pb-dl" autocomplete="off" placeholder="e.g. 2027"><datalist id="pb-dl">' + d.sessions.map(function (b) { return '<option value="' + h(b.name) + '">'; }).join('') + '</datalist></div><div class="field"><label for="pc">Class</label><input class="input" id="pc" placeholder="e.g. 10-A"></div><div class="form-error" id="pe" hidden></div>';
    var made = null;
    await U.modal({ title: 'Add to a new batch', body: body, actions: [{ label: 'Cancel', variant: 'secondary', value: false }, { label: 'Add students', variant: 'primary', value: true, onClick: async function () {
      var pe = body.querySelector('#pe'); function fail(m) { pe.textContent = m; pe.hidden = false; return false; }
      var bt = body.querySelector('#pb').value.trim(), ct = body.querySelector('#pc').value.trim();
      if (!bt) return fail('Write the batch.'); if (!D.parseClassLabel(ct)) return fail('Write the class like 10-A.');
      var batch = await D.resolveBatch(bt); if (!batch) return false;
      var cls = await D.resolveClass(batch.id, ct), fresh = await S.getAll('students'), n = 0, skipped = [];
      var maxRoll = Math.max.apply(null, [0].concat(fresh.filter(function (s) { return s.classId === cls.id; }).map(function (s) { return Number(s.rollNo) || 0; })));
      for (var i = 0; i < sel.length; i++) {
        var s = sel[i], pid = s.personId || s.id;
        if (fresh.some(function (z) { return (z.personId || z.id) === pid && z.sessionId === batch.id; })) { skipped.push(s.name); continue; }
        maxRoll++; var rec = Object.assign({}, s); delete rec.cls; delete rec.id; delete rec.createdAt; delete rec.updatedAt;
        await S.insert('students', Object.assign(rec, { personId: pid, classId: cls.id, sessionId: batch.id, rollNo: String(maxRoll).padStart(2, '0'), status: 'active', admissionDate: F.today() })); n++;
      }
      made = { n: n, batch: batch, cls: cls, skipped: skipped };
    } }] });
    if (!made) return;
    A.log('create', 'student', 'Added ' + made.n + ' students to batch ' + made.batch.name + ' class ' + F.className(made.cls));
    U.toast(made.n + ' students added to ' + made.batch.name + ', class ' + F.className(made.cls) + '. New roll numbers were given.' + (made.skipped.length ? ' Already there: ' + made.skipped.join(', ') : ''), 'success');
    tbl.clearSelection(); refresh();
  });
  var msg = document.getElementById('msg');
  if (msg) msg.addEventListener('click', function () { var sel = needSelection(); if (sel) ED.wa.openModal({ students: sel, type: 'custom' }); });
  var idb = document.getElementById('idcards');
  if (idb) idb.addEventListener('click', function () { var sel = needSelection(); if (sel) idCards(sel); });

  function idCards(list) {
    var html = list.map(function (s) {
      return '<div class="card-id"><div class="ph">' + h(F.initials(s.name)) + '</div><div style="font-weight:700;color:#4F46E5">' + h(ctx.settings.schoolName) + '</div><div class="muted" style="font-size:11px">Student ID card</div>' +
        '<div style="margin-top:14px;font-size:16px;font-weight:700">' + h(s.name) + '</div><div>Class: ' + h(cname(s.classId)) + ' | Roll no: ' + h(s.rollNo) + '</div>' +
        '<div class="muted" style="font-size:11px;margin-top:6px">Parent: ' + h(s.parentName || '-') + '<br>' + h(s.parentWhatsapp || '') + '</div>' +
        '<div class="muted" style="position:absolute;bottom:10px;left:12px;font-size:10px">Batch ' + h(bname(s.sessionId)) + ' | ID ' + h(String(s.id).slice(-6).toUpperCase()) + '</div></div>';
    }).join('');
    U.print(html, 'ID cards'); U.toast('Opening print dialog for ' + list.length + ' ID card(s)', 'info');
  }
  var addBtn = document.getElementById('add');
  if (addBtn) addBtn.addEventListener('click', function () { openForm({ mode: 'add' }); });
  if (params.get('add') && canEdit) openForm({ mode: 'add' });
})();
