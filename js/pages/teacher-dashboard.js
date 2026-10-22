(async function () {
  var session = await ED.shell.init({ role: 'teacher', active: 'dashboard' });
  if (!session) return;
  var S = ED.storage, F = ED.fmt, U = ED.ui, I = ED.icons, h = F.esc, D = ED.data;
  var today = F.today(), dw = F.dow(today);
  var ctx = await D.context(session);
  var d = await D.load(['students', 'attendance', 'exams', 'subjects', 'announcements', 'timetable', 'holidays']);
  var cname = {}; ctx.allClasses.forEach(function (c) { cname[c.id] = F.className(c); });
  var sname = function (id) { return D.subjectName(d.map.subjects, id); };
  var noClass = D.isSunday(today) || d.holidays.some(function (x) { return x.date === today; });

  var att = d.attendance.filter(function (a) { return a.date === today && ctx.canView(a.classId); });
  var marked = {}; att.forEach(function (a) { marked[a.classId + '|' + a.subjectId] = a; });
  var sched = {}; d.timetable.forEach(function (t) { if (t.day === dw && t.teacherId === ctx.teacherId && !noClass) sched[t.classId + '|' + t.subjectId] = 1; });
  var myStudents = d.students.filter(function (s) { return ctx.canAccess(s.classId) && s.status === 'active'; });
  var toMark = ctx.assignments.filter(function (a) { var k = a.classId + '|' + a.subjectId; return sched[k] && !marked[k]; }).length;
  var stuById = {}; d.students.forEach(function (s) { stuById[s.id] = s; });
  var absentBy = {};
  att.filter(function (a) { return a.status === 'A'; }).forEach(function (a) { (absentBy[a.studentId] = absentBy[a.studentId] || []).push(sname(a.subjectId)); });
  var absentIds = Object.keys(absentBy);
  var myExams = d.exams.filter(function (e) { return ctx.canAccess(e.classId) && ctx.teachesSubject(e.classId, e.subjectId) && (e.status === 'pending' || e.status === 'extracted'); });
  var news = d.announcements.filter(function (a) { return a.audience === 'all' || ctx.canView(a.audience); }).sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); }).slice(0, 4);

  var lessonRows = ctx.assignments.map(function (a) {
    var k = a.classId + '|' + a.subjectId, m = marked[k], due = !!sched[k];
    return '<li class="list-item"><div><div class="list-title">' + h(sname(a.subjectId)) + ' | Class ' + h(cname[a.classId]) + '</div><div class="list-sub">' + (m ? 'Marked at ' + F.time(m.markedAt) : due ? 'Scheduled today' : 'Not on today\'s timetable') + '</div></div>' +
      '<div class="row">' + U.badge(m ? 'Marked' : due ? 'Pending' : 'Free', m ? 'present' : due ? 'late' : '') + '<a class="btn btn-secondary btn-sm" href="attendance.html?class=' + a.classId + '&subject=' + a.subjectId + '">' + (m ? 'View' : 'Mark') + '</a></div></li>';
  }).join('');

  /* class teacher: read-only summary of the whole class today */
  var own = ctx.allClasses.filter(function (c) { return ctx.isClassTeacherOf(c.id) || c.classTeacherId === ctx.teacherId; });
  var ownCards = own.map(function (c) {
    var recs = d.attendance.filter(function (a) { return a.date === today && a.classId === c.id; }), subs = recs.map(function (r) { return r.subjectId; }).filter(function (x, i, a) { return a.indexOf(x) === i; });
    var pc = D.attPct(recs);
    return '<li class="list-item"><div><div class="list-title">Class ' + h(F.className(c)) + ' (you are the class teacher)</div><div class="list-sub">' + (subs.length ? subs.map(sname).join(', ') + ' marked' : 'No attendance marked yet') + (pc === null ? '' : ' | ' + F.pct(pc) + ' attended') + '</div></div><a class="btn btn-secondary btn-sm" href="attendance.html?class=' + c.id + '&subject=summary">Class summary</a></li>';
  }).join('');

  document.getElementById('content').innerHTML =
    U.pageHead(F.greeting() + ', ' + session.name.split(' ')[0], F.date(today)) +
    '<section class="grid-stats">' +
      U.stat('My classes', ctx.classIds.length, 'Assigned this session', '', 'attendance.html') +
      U.stat('My students', myStudents.length, 'In my classes', '', 'students.html') +
      U.stat('Attendance to mark', toMark, toMark ? 'Lessons waiting today' : 'All done for today', toMark ? 'bad' : 'good', 'attendance.html') +
      U.stat('Absent today', absentIds.length, 'Students absent in a subject', absentIds.length ? 'bad' : 'good') +
      U.stat('Results to finish', myExams.length, 'Pending or needing verification', myExams.length ? 'bad' : 'good', 'results.html') +
    '</section>' +
    '<div class="grid-2">' +
      '<section class="card"><div class="card-head"><h3>My lessons today</h3></div><div class="card-body">' + (lessonRows ? '<ul class="list">' + lessonRows + '</ul>' : U.empty('classes', 'No classes assigned', 'Ask the admin to assign you a class and subject.')) + '</div></section>' +
      '<section class="card"><div class="card-head"><h3>Absent today</h3>' + (absentIds.length ? '<button type="button" class="btn btn-whatsapp btn-sm" id="msg-absent">' + I.svg('whatsapp', 16) + 'Send alerts</button>' : '') + '</div><div class="card-body">' +
        (absentIds.length ? '<ul class="list">' + absentIds.map(function (id) { var s = stuById[id]; return '<li class="list-item"><div><div class="list-title">' + h(s.name) + '</div><div class="list-sub">Class ' + h(cname[s.classId]) + ' | Absent in ' + h(absentBy[id].join(', ')) + '</div></div>' + U.badge('Absent', 'absent') + '</li>'; }).join('') + '</ul>' : U.empty('check', 'No absentees today', 'Nobody marked so far is absent.')) + '</div></section>' +
    '</div>' +
    (ownCards ? '<section class="card"><div class="card-head"><h3>My class as class teacher</h3></div><div class="card-body"><ul class="list">' + ownCards + '</ul></div></section>' : '') +
    '<div class="grid-2">' +
      '<section class="card"><div class="card-head"><h3>Results to finish</h3></div><div class="card-body">' + (myExams.length ? '<ul class="list">' + myExams.map(function (e) { return '<li class="list-item"><div><div class="list-title">' + h(e.name) + ' | ' + h(cname[e.classId]) + ' | ' + h(sname(e.subjectId)) + '</div><div class="list-sub">' + (e.status === 'extracted' ? 'Extracted, please verify' : 'No marks entered yet') + '</div></div><a class="btn btn-secondary btn-sm" href="results.html#exam=' + e.id + '">Open</a></li>'; }).join('') + '</ul>' : U.empty('results', 'Nothing pending', '')) + '</div></section>' +
      '<section class="card"><div class="card-head"><h3>Announcements</h3><a class="small" href="announcements.html">View all</a></div><div class="card-body">' + (news.length ? '<ul class="list">' + news.map(function (a) { return '<li class="list-item"><div><div class="list-title">' + h(a.title) + '</div><div class="list-sub">' + h(a.createdByName) + ' | ' + F.date(a.createdAt) + '</div></div></li>'; }).join('') + '</ul>' : U.empty('announce', 'No announcements', 'Notices will appear here.')) + '</div></section>' +
    '</div>';

  var btn = document.getElementById('msg-absent');
  if (btn) btn.addEventListener('click', function () {
    if (!ctx.settings.permissions.teacherCanMessage) return U.toast('The admin has turned off parent messages for teachers.', 'info');
    ED.wa.openModal({ students: absentIds.map(function (id) { return stuById[id]; }), type: 'absent', text: 'Assalam o Alaikum {parent}, {student} ({class}) was absent in {subject} on {date}. - {school}', vars: function (s) { return { subject: absentBy[s.id].join(', '), date: F.date(today) }; } });
  });
})();
