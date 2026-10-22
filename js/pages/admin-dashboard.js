(async function () {
  var session = await ED.shell.init({ role: 'admin', active: 'dashboard' });
  if (!session) return;
  var S = ED.storage, F = ED.fmt, U = ED.ui, I = ED.icons, h = F.esc, D = ED.data;
  var today = F.today(), month = F.monthKey(today), dw = F.dow(today);

  var d = await D.load(['students', 'teachers', 'classes', 'subjects', 'attendance', 'timetable', 'holidays', 'feeInvoices', 'feePayments', 'expenses', 'exams', 'auditLog']);
  var settings = await D.settings();
  var cur = settings.activeSessionId, curClasses = d.classes.filter(function (c) { return c.sessionId === cur; });
  var students = d.students.filter(function (s) { return s.status === 'active' && s.sessionId === cur; });
  var att = d.attendance.filter(function (a) { return a.date === today; });
  var attPct = D.attPct(att);
  var collected = d.feePayments.filter(function (p) { return F.monthKey(p.date) === month; }).reduce(function (a, p) { return a + p.amount; }, 0);
  var pending = d.feeInvoices.reduce(function (a, i) { return a + D.invoiceBalance(i); }, 0);
  var spent = d.expenses.filter(function (e) { return F.monthKey(e.date) === month; }).reduce(function (a, e) { return a + e.amount; }, 0);
  var awaiting = d.exams.filter(function (e) { return e.status === 'extracted' || e.status === 'verified'; });
  var cname = {}; d.classes.forEach(function (c) { cname[c.id] = F.className(c); });
  var tname = {}; d.teachers.forEach(function (t) { tname[t.id] = t.name; });
  var sname = function (id) { return D.subjectName(d.map.subjects, id); };
  var noClass = D.isSunday(today) || d.holidays.some(function (x) { return x.date === today; });

  /* lessons scheduled today by the timetable, and which of them have attendance */
  var marked = {}; att.forEach(function (a) { marked[a.classId + '|' + a.subjectId] = a; });
  var sched = {}; d.timetable.filter(function (t) { return t.day === dw && !noClass; }).forEach(function (t) { sched[t.classId + '|' + t.subjectId] = t; });
  var schedKeys = Object.keys(sched), doneCount = schedKeys.filter(function (k) { return marked[k]; }).length;

  var classRows = curClasses.map(function (c) {
    var keys = schedKeys.filter(function (k) { return k.split('|')[0] === c.id; });
    Object.keys(marked).forEach(function (k) { if (k.split('|')[0] === c.id && keys.indexOf(k) < 0) keys.push(k); });
    var chips = keys.map(function (k) { var sid = k.split('|')[1], m = marked[k]; return U.badge(sname(sid) + (m ? ': ' + m.markedByName.split(' ')[0] : ': pending'), m ? 'present' : 'late'); }).join(' ');
    return '<li class="list-item"><div><div class="list-title">Class ' + h(F.className(c)) + '</div><div class="list-sub">Class teacher: ' + h(tname[c.classTeacherId] || 'Not assigned') + '</div>' +
      '<div class="subj-chips" style="margin-top:6px">' + (chips || '<span class="small muted">' + (noClass ? 'Holiday' : 'No lessons scheduled') + '</span>') + '</div></div>' +
      '<a class="btn btn-secondary btn-sm" href="attendance.html?class=' + c.id + '">Open</a></li>';
  }).join('');
  var examRows = awaiting.map(function (e) {
    return '<li class="list-item"><div><div class="list-title">' + h(e.name) + ' | ' + h(cname[e.classId]) + '</div><div class="list-sub">' + (e.status === 'extracted' ? 'Waiting for teacher verification' : 'Verified, ready to publish') + '</div></div>' +
      '<a class="btn btn-secondary btn-sm" href="results.html#exam=' + e.id + '">Open</a></li>';
  }).join('');
  var activity = d.auditLog.slice().sort(function (a, b) { return b.at.localeCompare(a.at); }).slice(0, 8).map(function (a) {
    return '<li class="list-item"><div><div class="list-title">' + h(a.summary) + '</div><div class="list-sub">' + h(a.userName) + ' | ' + F.date(a.at) + ' ' + F.time(a.at) + '</div></div>' + U.badge(a.entity) + '</li>';
  }).join('');

  var QA = [['Add student', 'students', 'students.html?add=1'], ['Mark attendance', 'attendance', 'attendance.html'], ['Receive fee', 'fees', 'fees.html'], ['New announcement', 'announce', 'announcements.html?new=1'], ['New expense', 'expenses', 'expenses.html?add=1'], ['Open analytics', 'analytics', 'analytics.html']];

  document.getElementById('content').innerHTML =
    U.pageHead(F.greeting() + ', ' + session.name, F.date(today) + ' | ' + settings.schoolName + ' | Batch ' + F.batchName(cur)) +
    '<section class="grid-stats">' +
      U.stat('Students', students.length, 'Active students', '', 'students.html') +
      U.stat('Teachers', d.teachers.filter(function (t) { return t.status === 'active'; }).length, 'Active teachers', '', 'teachers.html') +
      U.stat('Attendance today', attPct === null ? '-' : F.pct(attPct), doneCount + ' of ' + schedKeys.length + ' lessons marked', attPct === null ? '' : (attPct >= settings.attendanceThreshold ? 'good' : 'bad'), 'attendance-reports.html') +
      U.stat('Pending verification', awaiting.length, 'Exams needing action', awaiting.length ? 'bad' : 'good', 'results.html') +
      U.stat('Fees collected', F.currency(collected), 'This month', 'good', 'fees.html') +
      U.stat('Fees pending', F.currency(pending), 'All unpaid balances', pending ? 'bad' : 'good', 'fees.html') +
      U.stat('Expenses', F.currency(spent), 'This month', '', 'expenses.html') +
      U.stat('Classes', curClasses.length, 'Batch ' + F.batchName(cur), '', 'classes.html') +
    '</section>' +
    '<section class="card card-pad" id="money-card"></section>' +
    '<div class="grid-2">' +
      '<section class="card"><div class="card-head"><h3>Attendance today, by subject</h3></div><div class="card-body">' + (classRows ? '<ul class="list">' + classRows + '</ul>' : U.empty('classes', 'No classes yet', 'Create a class to start.')) + '</div></section>' +
      '<section class="card"><div class="card-head"><h3>Quick actions</h3></div><div class="card-body"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px">' +
        QA.map(function (q) { return '<a class="btn btn-secondary" href="' + q[2] + '">' + I.svg(q[1], 16) + q[0] + '</a>'; }).join('') + '</div></div></section>' +
    '</div>' +
    '<div class="grid-2">' +
      '<section class="card"><div class="card-head"><h3>Results needing action</h3></div><div class="card-body">' + (examRows ? '<ul class="list">' + examRows + '</ul>' : U.empty('results', 'All results are up to date', '')) + '</div></section>' +
      '<section class="card"><div class="card-head"><h3>Recent activity</h3><a href="audit-log.html" class="small">View all</a></div><div class="card-body">' + (activity ? '<ul class="list">' + activity + '</ul>' : U.empty('history', 'No activity yet', '')) + '</div></section>' +
    '</div>';
  ED.money.load().then(function (m) { ED.money.dashCard(document.getElementById('money-card'), m); });
})();
