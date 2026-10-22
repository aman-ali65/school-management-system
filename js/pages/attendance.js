(async function () {
  var role = document.body.dataset.role;
  var session = await ED.shell.init({ role: role, active: 'attendance' });
  if (!session) return;
  var S = ED.storage, F = ED.fmt, U = ED.ui, I = ED.icons, h = F.esc, A = ED.audit, D = ED.data;
  var ctx = await D.context(session);
  var today = F.today(), params = new URLSearchParams(location.search);
  var base = await D.load(['subjects', 'holidays', 'timetable', 'teachers']);
  var holidays = base.holidays;
  var canMsg = ctx.isAdmin || ctx.settings.permissions.teacherCanMessage;
  var CODES = [['P', 'P', 'Present'], ['A', 'A', 'Absent'], ['L', 'L', 'Late'], ['LV', 'LV', 'Leave']];
  var SUMMARY = 'summary', GENERAL = D.GENERAL_ID;
  var subName = function (id) { return D.subjectName(base.map.subjects, id); };

  var content = document.getElementById('content');
  content.innerHTML = U.pageHead('Attendance', ctx.isAdmin ? 'Attendance is taken subject by subject. Each teacher marks their own subject.' : 'Mark attendance for the subjects you teach. You can edit today only; the admin can edit past days.') + '<div id="tabs"></div>';

  function seg(name, current, disabled) {
    return '<div class="seg' + (disabled ? ' disabled' : '') + '" role="radiogroup" aria-label="Attendance status">' + CODES.map(function (c) {
      return '<label class="' + (current === c[0] ? 'on-' + c[0] : '') + '" title="' + c[2] + '"><input type="radio" name="' + name + '" value="' + c[0] + '"' + (current === c[0] ? ' checked' : '') + (disabled ? ' disabled' : '') + ' aria-label="' + c[2] + '">' + c[1] + '</label>';
    }).join('') + '</div>';
  }
  function bindSeg(root, onChange) {
    root.addEventListener('change', function (e) {
      if (!e.target.matches('.seg input')) return;
      var g = e.target.closest('.seg');
      g.querySelectorAll('label').forEach(function (l) { l.className = ''; });
      e.target.closest('label').className = 'on-' + e.target.value;
      if (onChange) onChange();
    });
  }
  function holidayInfo(date) {
    if (D.isSunday(date)) return 'Sunday is a weekly holiday, so attendance is not taken.';
    var hol = holidays.filter(function (x) { return x.date === date; })[0];
    return hol ? hol.title + ' is a school holiday, so attendance is not taken.' : '';
  }

  /* ---------- Students tab ---------- */
  function studentsTab(panel) {
    if (!ctx.viewClasses.length) { panel.innerHTML = '<div class="card">' + U.empty('classes', 'No classes assigned', 'Ask the admin to assign you a class and subject.') + '</div>'; return; }
    var startClass = ctx.canView(params.get('class')) ? params.get('class') : (ctx.viewClasses.filter(function (c) { return c.sessionId === ctx.activeId; })[0] || ctx.viewClasses[0]).id;
    var startBatch = (ctx.allClasses.filter(function (c) { return c.id === startClass; })[0] || {}).sessionId || ctx.activeId;
    panel.innerHTML =
      '<div class="filters card card-pad">' + (ctx.isAdmin ? '<div class="field"><label for="a-batch">Batch</label><select class="select" id="a-batch">' + ctx.batches.map(function (b) { return '<option value="' + h(b.id) + '"' + (b.id === startBatch ? ' selected' : '') + '>' + h(b.name) + (b.id === ctx.activeId ? ' (current)' : '') + '</option>'; }).join('') + '</select></div>' : '') + '<div class="field"><label for="a-class">Class</label><select class="select" id="a-class"></select></div>' +
      '<div class="field"><label for="a-subject">Subject</label><select class="select" id="a-subject"></select></div>' +
      '<div class="field"><label for="a-date">Date</label><input class="input" type="date" id="a-date" value="' + today + '" max="' + today + '"></div></div>' +
      '<div id="a-info" class="stack"></div><section class="card" id="a-card"></section>';
    var batchEl = panel.querySelector('#a-batch');
    var classEl = panel.querySelector('#a-class'), subjEl = panel.querySelector('#a-subject'), dateEl = panel.querySelector('#a-date'), info = panel.querySelector('#a-info'), card = panel.querySelector('#a-card');
    var students = [], existing = {}, locked = false, prefilled = false;

    function subjectOptions(classId) {
      var seen = {}, list = [];
      var asg = ctx.isAdmin ? ctx.assignments.filter(function (a) { return a.classId === classId; }) : ctx.assignments.filter(function (a) { return a.classId === classId; });
      asg.forEach(function (a) { if (!seen[a.subjectId]) { seen[a.subjectId] = 1; list.push({ value: a.subjectId, label: subName(a.subjectId) }); } });
      if (ctx.isAdmin) list.push({ value: GENERAL, label: 'General (whole day, old records)' });
      if (ctx.isAdmin || ctx.isClassTeacherOf(classId)) list.push({ value: SUMMARY, label: 'All subjects (view only)' });
      return list;
    }
    function fillSubjects(keep) {
      var opts = subjectOptions(classEl.value), want = keep || params.get('subject');
      subjEl.innerHTML = opts.map(function (o) { return '<option value="' + h(o.value) + '">' + h(o.label) + '</option>'; }).join('');
      if (opts.some(function (o) { return o.value === want; })) subjEl.value = want;
    }

    async function load() {
      var classId = classEl.value, subjectId = subjEl.value, date = dateEl.value;
      if (!date || !subjectId || !classId) { info.innerHTML = ''; card.innerHTML = U.empty('classes', 'No subject for this class', 'Ask the admin to assign a subject.'); return; }
      var all = await S.getAll('students'), allRecs = await S.query('attendance', function (a) { return a.classId === classId && a.date === date; });
      students = all.filter(function (s) { return s.classId === classId && s.status === 'active'; }).sort(function (a, b) { return (Number(a.rollNo) || 0) - (Number(b.rollNo) || 0); });

      /* which subjects already have attendance for this class and day */
      var groups = {};
      allRecs.forEach(function (r) { var g = groups[r.subjectId] = groups[r.subjectId] || { subjectId: r.subjectId, by: r.markedByName, at: r.markedAt, recs: [] }; g.recs.push(r); });
      var chips = Object.keys(groups).map(function (k) { var g = groups[k]; return U.badge(subName(g.subjectId) + ': ' + (g.by || 'teacher') + ' ' + F.time(g.at), 'present'); }).join(' ');
      var hol = holidayInfo(date), msg = '';
      if (hol) msg += '<div class="callout warn">' + I.svg('info', 18) + '<span>' + h(hol) + '</span></div>';
      if (chips) msg += '<div class="callout">' + I.svg('check', 18) + '<span>Already marked for this class on ' + F.date(date) + ':&nbsp;</span><div class="subj-chips">' + chips + '</div></div>';

      if (subjectId === SUMMARY) { info.innerHTML = msg; summaryView(groups, date); return; }

      existing = {}; prefilled = false;
      var mine = groups[subjectId];
      if (mine) mine.recs.forEach(function (r) { existing[r.studentId] = r; });
      else {
        var keys = Object.keys(groups).filter(function (k) { return k !== subjectId; });
        if (keys.length) {
          var latest = groups[keys.sort(function (a, b) { return groups[b].at.localeCompare(groups[a].at); })[0]];
          latest.recs.forEach(function (r) { existing[r.studentId] = { status: r.status }; });
          prefilled = true;
          msg += '<div class="callout warn">' + I.svg('info', 18) + '<span>Filled from <b>' + h(subName(latest.subjectId)) + '</b> attendance by ' + h(latest.by || 'a teacher') + ' at ' + F.time(latest.at) + '. If the same students are here for ' + h(subName(subjectId)) + ', just press Save. Change only what is different (someone late, or left early).</span></div>';
        }
      }
      locked = !!hol || (!ctx.isAdmin && date !== today) || (!ctx.teachesSubject(classId, subjectId) && subjectId !== GENERAL);
      if (!hol && !ctx.isAdmin && date !== today) msg += '<div class="callout warn">' + I.svg('info', 18) + '<span>Past days are view-only for teachers. Ask the admin to change a past record.</span></div>';
      if (mine && !locked) msg += '<div class="callout">' + I.svg('check', 18) + '<span>' + h(subName(subjectId)) + ' attendance was marked by <b>' + h(mine.by || 'a teacher') + '</b> at ' + F.time(mine.at) + '. You can edit it and save again.</span></div>';
      info.innerHTML = msg;
      paint();
    }

    function summaryView(groups, date) {
      var scheduled = base.timetable.filter(function (t) { return t.classId === classEl.value && t.day === F.dow(date); }).map(function (t) { return t.subjectId; });
      var ids = Object.keys(groups).concat(scheduled.filter(function (x) { return !groups[x]; })).filter(function (x, i, a) { return a.indexOf(x) === i; });
      if (!students.length) { card.innerHTML = U.empty('students', 'No active students in this class', ''); return; }
      if (!ids.length) { card.innerHTML = U.empty('attendance', 'No lessons or attendance for this day', 'Nothing is scheduled and nobody has marked attendance.'); return; }
      var byStu = {}; Object.keys(groups).forEach(function (k) { groups[k].recs.forEach(function (r) { (byStu[r.studentId] = byStu[r.studentId] || {})[k] = r.status; }); });
      card.innerHTML = '<div class="table-toolbar"><b style="font-weight:500">Class summary (view only)</b></div><div class="table-wrap"><table class="table rowcards"><thead><tr><th>Student</th>' + ids.map(function (k) { return '<th>' + h(subName(k)) + '<div class="small muted">' + (groups[k] ? 'marked' : 'not yet') + '</div></th>'; }).join('') + '<th>Attended</th></tr></thead><tbody>' +
        students.map(function (s) {
          var m = byStu[s.id] || {}, total = 0, att = 0;
          Object.keys(m).forEach(function (k) { if (m[k] !== 'LV') { total++; if (m[k] === 'P' || m[k] === 'L') att++; } });
          return '<tr><td class="td-title" data-label="Student"><div class="cell-main">' + U.avatar(s.name) + '<span>' + h(s.rollNo + '. ' + s.name) + '</span></div></td>' + ids.map(function (k) { return '<td data-label="' + h(subName(k)) + '">' + (m[k] ? U.statusBadge('att', m[k]) : '<span class="muted">-</span>') + '</td>'; }).join('') + '<td data-label="Attended">' + (total ? att + ' of ' + total : '-') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }

    function paint() {
      if (!students.length) { card.innerHTML = U.empty('students', 'No active students in this class', 'Add students first.'); return; }
      card.innerHTML =
        '<div class="table-toolbar"><div class="summary-chips" id="a-sum"></div><div class="row" style="margin-left:auto;flex-wrap:wrap">' +
        (locked ? '' : U.btn('Mark all present', { id: 'a-all' }) + U.btn('Save attendance', { variant: 'primary', icon: 'check', id: 'a-save' })) +
        (canMsg ? U.btn('Send absent alerts', { variant: 'whatsapp', icon: 'whatsapp', id: 'a-wa' }) : '') + '</div></div>' +
        '<div class="table-wrap"><table class="table rowcards"><thead><tr><th>Roll</th><th>Student</th><th>Status</th></tr></thead><tbody>' +
        students.map(function (s) { var cur = existing[s.id] ? existing[s.id].status : ''; return '<tr data-id="' + s.id + '"><td class="td-title" data-label="Student"><div class="cell-main">' + U.avatar(s.name) + '<span>' + h(s.rollNo + '. ' + s.name) + '</span></div></td><td class="td-block" data-label="Status">' + seg('st_' + s.id, cur, locked) + '</td></tr>'; }).join('') + '</tbody></table></div>';
      bindSeg(card, summary); summary();
      var all = card.querySelector('#a-all'); if (all) all.addEventListener('click', function () {
        card.querySelectorAll('.seg input[value=P]').forEach(function (r) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); });
        U.toast('Everyone marked present. Change the exceptions, then save.', 'info');
      });
      var save = card.querySelector('#a-save'); if (save) save.addEventListener('click', saveAtt);
      var wa = card.querySelector('#a-wa'); if (wa) wa.addEventListener('click', sendAlerts);
    }
    function current() {
      var out = {};
      card.querySelectorAll('tbody tr').forEach(function (tr) { var c = tr.querySelector('input:checked'); out[tr.dataset.id] = c ? c.value : ''; });
      return out;
    }
    function summary() {
      var cur = current(), n = { P: 0, A: 0, L: 0, LV: 0, none: 0 };
      Object.keys(cur).forEach(function (k) { n[cur[k] || 'none']++; });
      card.querySelector('#a-sum').innerHTML = U.badge('Present ' + n.P, 'present') + U.badge('Absent ' + n.A, 'absent') + U.badge('Late ' + n.L, 'late') + U.badge('Leave ' + n.LV, 'leave') + (n.none ? U.badge('Not marked ' + n.none) : '');
    }
    async function saveAtt() {
      var cur = current(), left = Object.keys(cur).filter(function (k) { return !cur[k]; }).length;
      if (left) return U.toast('Mark every student first (' + left + ' left). Use "Mark all present" to start.', 'danger');
      var classId = classEl.value, subjectId = subjEl.value, date = dateEl.value, now = new Date().toISOString();
      var rest = S._readList('attendance').filter(function (a) { return !(a.classId === classId && a.subjectId === subjectId && a.date === date); });
      var fresh = students.map(function (s) { return { id: S.uid(), date: date, classId: classId, subjectId: subjectId, studentId: s.id, status: cur[s.id], markedBy: ctx.teacherId || 'admin', markedByName: session.name, markedAt: now, createdAt: now, updatedAt: now }; });
      S._writeList('attendance', rest.concat(fresh));
      A.log('update', 'attendance', 'Marked ' + subName(subjectId) + ' attendance for class ' + F.className(ctx.allClasses.filter(function (c) { return c.id === classId; })[0]) + ' on ' + F.date(date));
      var abs = fresh.filter(function (x) { return x.status === 'A'; }).length;
      U.toast(subName(subjectId) + ' attendance saved. ' + abs + ' absent.', 'success');
      load();
    }
    function sendAlerts() {
      var cur = current(), abs = students.filter(function (s) { return cur[s.id] === 'A'; });
      if (!abs.length) return U.toast('No absent students to alert.', 'info');
      if (!ctx.isAdmin && !ctx.settings.permissions.teacherCanMessage) return U.toast('The admin has turned off parent messages for teachers.', 'info');
      var sn = subName(subjEl.value), dt = F.date(dateEl.value);
      ED.wa.openModal({ students: abs, type: 'absent', text: 'Assalam o Alaikum {parent}, {student} ({class}) was absent in ' + sn + ' on {date}. - {school}', vars: function () { return { date: dt, subject: sn }; } });
    }
    function fillClasses(keep) {
      var list = ctx.viewClasses.filter(function (c) { return !batchEl || c.sessionId === batchEl.value; });
      classEl.innerHTML = list.length ? U.options(list, 'id', F.className, keep) : '<option value="">No classes in this batch</option>';
      if (keep && list.some(function (c) { return c.id === keep; })) classEl.value = keep;
    }
    fillClasses(startClass);
    if (batchEl) batchEl.addEventListener('change', function () { fillClasses(); fillSubjects(); load(); });
    classEl.addEventListener('change', function () { fillSubjects(); load(); });
    subjEl.addEventListener('change', load); dateEl.addEventListener('change', load);
    fillSubjects(); load();
  }

  /* ---------- Teachers tab (admin) ---------- */
  function teachersTab(panel) {
    panel.innerHTML = '<div class="filters card card-pad"><div class="field"><label for="t-date">Date</label><input class="input" type="date" id="t-date" value="' + today + '" max="' + today + '"></div></div><div id="t-info"></div><section class="card" id="t-card"></section>';
    var dateEl = panel.querySelector('#t-date'), card = panel.querySelector('#t-card'), info = panel.querySelector('#t-info'), teachers = [];
    async function load() {
      var date = dateEl.value; if (!date) return;
      teachers = (await S.getAll('teachers')).filter(function (t) { return t.status === 'active'; });
      var recs = await S.query('teacherAttendance', function (a) { return a.date === date; }), map = {}; recs.forEach(function (r) { map[r.teacherId] = r.status; });
      var hol = holidayInfo(date); info.innerHTML = hol ? '<div class="callout warn">' + I.svg('info', 18) + '<span>' + h(hol) + '</span></div>' : '';
      card.innerHTML = '<div class="table-toolbar"><div class="row" style="margin-left:auto">' + (hol ? '' : U.btn('Mark all present', { id: 't-all' }) + U.btn('Save teacher attendance', { variant: 'primary', icon: 'check', id: 't-save' })) + '</div></div>' +
        '<div class="table-wrap"><table class="table rowcards"><thead><tr><th>Teacher</th><th>Status</th></tr></thead><tbody>' + teachers.map(function (t) { return '<tr data-id="' + t.id + '"><td class="td-title" data-label="Teacher"><div class="cell-main">' + U.avatar(t.name) + '<span>' + h(t.name) + '</span></div></td><td class="td-block" data-label="Status">' + seg('tt_' + t.id, map[t.id] || '', !!hol) + '</td></tr>'; }).join('') + '</tbody></table></div>';
      bindSeg(card);
      var all = card.querySelector('#t-all'); if (all) all.addEventListener('click', function () { card.querySelectorAll('.seg input[value=P]').forEach(function (r) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }); });
      var save = card.querySelector('#t-save'); if (save) save.addEventListener('click', async function () {
        var rows = []; var missing = 0;
        card.querySelectorAll('tbody tr').forEach(function (tr) { var c = tr.querySelector('input:checked'); if (!c) missing++; else rows.push({ id: 'tat-' + date + '-' + tr.dataset.id, date: date, teacherId: tr.dataset.id, status: c.value }); });
        if (missing) return U.toast('Mark every teacher first (' + missing + ' left).', 'danger');
        S._writeList('teacherAttendance', S._readList('teacherAttendance').filter(function (a) { return a.date !== date; }).concat(rows.map(function (r) { return Object.assign({ createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, r); })));
        A.log('update', 'attendance', 'Marked teacher attendance for ' + F.date(date)); U.toast('Teacher attendance saved. It feeds the salary deductions.', 'success');
      });
    }
    dateEl.addEventListener('change', load); load();
  }

  var tabs = ctx.isAdmin ? [{ id: 'students', label: 'Student attendance', render: studentsTab }, { id: 'teachers', label: 'Teacher attendance', render: teachersTab }] : [{ id: 'students', label: 'Student attendance', render: studentsTab }];
  U.tabs(document.getElementById('tabs'), tabs);
})();
