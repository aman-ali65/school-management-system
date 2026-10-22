(async function () {
  var session = await ED.shell.init({ role: 'admin', active: 'attendance-reports' });
  if (!session) return;
  var S = ED.storage, F = ED.fmt, U = ED.ui, I = ED.icons, h = F.esc, D = ED.data;
  var settings = await D.settings();
  var today = F.today(), month = F.monthKey(today);
  var d = await D.load(['students', 'classes', 'attendance', 'subjects', 'sessions']);
  var batchId = F._batch ? F._batch.active : '';
  function inBatch(classId) { return !batchId || (d.map.classes[classId] || {}).sessionId === batchId; }
  function bClasses() { return d.classes.filter(function (c) { return !batchId || c.sessionId === batchId; }); }
  var cname = function (id) { return F.className(d.map.classes[id]); };
  var subName = function (id) { return D.subjectName(d.map.subjects, id); };
  var usedSubjects = d.attendance.map(function (a) { return a.subjectId; }).filter(function (x, i, a) { return a.indexOf(x) === i; });
  var classOpts = function () { return '<option value="">All classes</option>' + U.options(bClasses(), 'id', F.className); };
  function subjectSelect(id, withSummary) {
    return '<div class="field"><label for="' + id + '">Subject</label><select class="select" id="' + id + '">' + (withSummary ? '<option value="summary">Subject-wise summary</option>' : '<option value="">All subjects</option>') +
      usedSubjects.map(function (s) { return '<option value="' + h(s) + '">' + h(subName(s)) + '</option>'; }).join('') + '</select></div>';
  }
  var pctText = function (p) { return p === null ? '-' : F.pct(p); };
  function count(recs) { var n = { P: 0, A: 0, L: 0, LV: 0 }; recs.forEach(function (r) { n[r.status]++; }); return n; }
  function monthRecs(m, classId, sub) { return d.attendance.filter(function (a) { return F.monthKey(a.date) === m && (!classId || a.classId === classId) && inBatch(a.classId) && (!sub || a.subjectId === sub); }); }

  document.getElementById('content').innerHTML = U.pageHead('Attendance reports', 'Daily, monthly, defaulters and per-student views, always by subject. Present and Late count as attended; Leave is left out of the percentage.') + '<div class="filters card card-pad"><div class="field"><label for="rb">Batch</label><select class="select" id="rb"><option value="">All batches</option>' + d.sessions.map(function (b) { return '<option value="' + h(b.id) + '"' + (b.id === batchId ? ' selected' : '') + '>' + h(b.name) + (F._batch && b.id === F._batch.active ? ' (current)' : '') + '</option>'; }).join('') + '</select></div></div><div id="tabs"></div>';

  /* ---- Daily ---- */
  function daily(p) {
    p.innerHTML = '<div class="filters card card-pad"><div class="field"><label for="d-date">Date</label><input class="input" type="date" id="d-date" value="' + today + '" max="' + today + '"></div><div class="field"><label for="d-class">Class</label><select class="select" id="d-class">' + classOpts() + '</select></div>' + subjectSelect('d-sub', false) + '<div class="field"><label for="d-st">Show</label><select class="select" id="d-st"><option value="">All statuses</option><option value="A">Absent</option><option value="L">Late</option><option value="LV">Leave</option><option value="P">Present</option></select></div></div><div class="summary-chips" id="d-sum"></div><section class="card" id="d-tbl"></section>';
    var tbl = U.table(p.querySelector('#d-tbl'), {
      rows: [], pageSize: 12, search: function (r) { return r.name + ' ' + r.cls + ' ' + r.subject; }, searchPlaceholder: 'Search student or subject',
      toolbar: '<div class="row" style="margin-left:auto">' + U.btn('Export CSV', { id: 'd-exp', small: true }) + U.btn('Message absentees', { id: 'd-wa', small: true, variant: 'whatsapp', icon: 'whatsapp' }) + '</div>',
      columns: [
        { key: 'name', label: 'Student', render: function (r) { return '<div class="cell-main">' + U.avatar(r.name) + '<span>' + h(r.name) + '</span></div>'; } },
        { key: 'cls', label: 'Class' }, { key: 'subject', label: 'Subject' }, { key: 'rollNo', label: 'Roll', sort: function (r) { return Number(r.rollNo) || 0; } },
        { key: 'status', label: 'Status', render: function (r) { return U.statusBadge('att', r.status); } },
        { key: 'by', label: 'Marked by' }
      ], empty: { icon: 'attendance', title: 'No attendance for this selection', message: 'Attendance has not been marked for this date, class or subject.' }
    });
    function filtered() { var date = p.querySelector('#d-date').value, c = p.querySelector('#d-class').value, sub = p.querySelector('#d-sub').value; return d.attendance.filter(function (a) { return a.date === date && (!c || a.classId === c) && inBatch(a.classId) && (!sub || a.subjectId === sub); }); }
    function rows() {
      var st = p.querySelector('#d-st').value;
      return filtered().map(function (a) { var s = d.map.students[a.studentId] || { name: '(deleted)', rollNo: '' }; return { id: a.id, name: s.name, cls: cname(a.classId), subject: subName(a.subjectId), rollNo: s.rollNo, status: a.status, by: a.markedByName || '-', studentId: a.studentId }; }).filter(function (r) { return !st || r.status === st; });
    }
    function paint() {
      tbl.setRows(rows());
      var all = filtered(), n = count(all), date = p.querySelector('#d-date').value;
      p.querySelector('#d-sum').innerHTML = U.badge('Present ' + n.P, 'present') + U.badge('Absent ' + n.A, 'absent') + U.badge('Late ' + n.L, 'late') + U.badge('Leave ' + n.LV, 'leave') + U.badge('Attendance ' + pctText(D.attPct(all)), 'primary') + (D.isSunday(date) ? U.badge('Sunday (holiday)') : '');
    }
    ['d-date', 'd-class', 'd-sub', 'd-st'].forEach(function (id) { p.querySelector('#' + id).addEventListener('change', paint); });
    p.querySelector('#d-exp').addEventListener('click', function () { U.download('attendance-' + p.querySelector('#d-date').value + '.csv', U.toCSV([['student', 'class', 'subject', 'roll', 'status', 'marked by']].concat(tbl.visible().map(function (r) { return [r.name, r.cls, r.subject, r.rollNo, U.statLabel('att', r.status), r.by]; }))), 'text/csv'); });
    p.querySelector('#d-wa').addEventListener('click', function () {
      var abs = rows().filter(function (r) { return r.status === 'A'; }), seen = {}, studs = [];
      abs.forEach(function (r) { if (!seen[r.studentId] && d.map.students[r.studentId]) { seen[r.studentId] = []; studs.push(d.map.students[r.studentId]); } if (seen[r.studentId]) seen[r.studentId].push(r.subject); });
      if (!studs.length) return U.toast('No absent students for this selection.', 'info');
      var dt = F.date(p.querySelector('#d-date').value);
      ED.wa.openModal({ students: studs, type: 'absent', text: 'Assalam o Alaikum {parent}, {student} ({class}) was absent in {subject} on {date}. - {school}', vars: function (s) { return { date: dt, subject: seen[s.id].join(', ') }; } });
    });
    paint();
  }

  /* ---- Monthly ---- */
  function monthly(p) {
    p.innerHTML = '<div class="filters card card-pad"><div class="field"><label for="m-month">Month</label><input class="input" type="month" id="m-month" value="' + month + '" max="' + month + '"></div><div class="field"><label for="m-class">Class</label><select class="select" id="m-class">' + U.options(bClasses(), 'id', F.className) + '</select></div>' + subjectSelect('m-sub', true) + '<div class="row" style="align-self:flex-end">' + U.btn('Export CSV', { id: 'm-exp' }) + U.btn('Print', { id: 'm-print' }) + '</div></div><section class="card"><div class="table-wrap" id="m-grid"></div></section>';
    var model;
    function build() {
      var m = p.querySelector('#m-month').value, c = p.querySelector('#m-class').value, sub = p.querySelector('#m-sub').value; if (!m) return;
      var studs = d.students.filter(function (s) { return s.classId === c && s.status === 'active'; }).sort(function (a, b) { return (Number(a.rollNo) || 0) - (Number(b.rollNo) || 0); });
      var recs = monthRecs(m, c, sub === 'summary' ? '' : sub);
      if (sub === 'summary') {
        var subs = recs.map(function (r) { return r.subjectId; }).filter(function (x, i, a) { return a.indexOf(x) === i; });
        model = { m: m, c: c, summary: true, subs: subs, rows: studs.map(function (s) { var mine = recs.filter(function (r) { return r.studentId === s.id; }); return { s: s, per: subs.map(function (k) { return D.attPct(mine.filter(function (r) { return r.subjectId === k; })); }), all: D.attPct(mine) }; }) };
        p.querySelector('#m-grid').innerHTML = !studs.length ? U.empty('students', 'No students in this class', '') : !subs.length ? U.empty('attendance', 'No attendance for this month', 'Nothing has been marked for this class yet.') :
          '<table class="table rowcards"><thead><tr><th>Student</th>' + subs.map(function (k) { return '<th class="num">' + h(subName(k)) + '</th>'; }).join('') + '<th class="num">Overall</th></tr></thead><tbody>' +
          model.rows.map(function (r) { return '<tr><td class="td-title" data-label="Student">' + h(r.s.rollNo + '. ' + r.s.name) + '</td>' + r.per.map(function (x, i) { return '<td class="num" data-label="' + h(subName(subs[i])) + '">' + (x === null ? '-' : U.badge(F.pct(x), x < settings.attendanceThreshold ? 'absent' : 'present')) + '</td>'; }).join('') + '<td class="num" data-label="Overall"><b style="font-weight:500">' + pctText(r.all) + '</b></td></tr>'; }).join('') + '</tbody></table>';
        return;
      }
      var days = []; for (var i = 1; i <= F.daysInMonth(m); i++) { var iso = m + '-' + (i < 10 ? '0' + i : i); if (iso <= today && !D.isSunday(iso)) days.push(iso); }
      var byKey = {}; recs.forEach(function (r) { byKey[r.studentId + '|' + r.date] = r.status; });
      days = days.filter(function (dd) { return recs.some(function (r) { return r.date === dd; }); });
      model = { m: m, c: c, sub: sub, days: days, rows: studs.map(function (s) { var mine = recs.filter(function (r) { return r.studentId === s.id; }), n = count(mine); return { s: s, cells: days.map(function (dd) { return byKey[s.id + '|' + dd] || ''; }), n: n, pct: D.attPct(mine) }; }) };
      p.querySelector('#m-grid').innerHTML = !studs.length ? U.empty('students', 'No students in this class', '') : !days.length ? U.empty('attendance', 'No ' + subName(sub) + ' attendance this month', 'It has not been marked for this class yet.') :
        '<table class="matrix"><thead><tr><th>Student</th>' + days.map(function (x) { return '<th>' + +x.slice(8) + '</th>'; }).join('') + '<th>P</th><th>A</th><th>L</th><th>LV</th><th>%</th></tr></thead><tbody>' +
        model.rows.map(function (r) { return '<tr><td>' + h(r.s.rollNo + '. ' + r.s.name) + '</td>' + r.cells.map(function (x) { return '<td class="' + (x ? 'm-' + x : '') + '">' + (x || '') + '</td>'; }).join('') + '<td>' + r.n.P + '</td><td>' + r.n.A + '</td><td>' + r.n.L + '</td><td>' + r.n.LV + '</td><td><b style="font-weight:500">' + pctText(r.pct) + '</b></td></tr>'; }).join('') + '</tbody></table>';
    }
    ['m-month', 'm-class', 'm-sub'].forEach(function (id) { p.querySelector('#' + id).addEventListener('change', build); });
    p.querySelector('#m-exp').addEventListener('click', function () {
      if (!model) return;
      var rows = model.summary ? [['roll', 'student'].concat(model.subs.map(subName), ['overall %'])].concat(model.rows.map(function (r) { return [r.s.rollNo, r.s.name].concat(r.per.map(function (x) { return x === null ? '' : Math.round(x); }), [r.all === null ? '' : Math.round(r.all)]); }))
        : [['roll', 'student'].concat(model.days.map(function (x) { return +x.slice(8); }), ['P', 'A', 'L', 'LV', '%'])].concat(model.rows.map(function (r) { return [r.s.rollNo, r.s.name].concat(r.cells, [r.n.P, r.n.A, r.n.L, r.n.LV, r.pct === null ? '' : Math.round(r.pct)]); }));
      U.download('attendance-' + model.m + '-' + cname(model.c) + (model.summary ? '-summary' : '-' + subName(model.sub)) + '.csv', U.toCSV(rows), 'text/csv');
    });
    p.querySelector('#m-print').addEventListener('click', function () {
      if (!model) return;
      var title = 'Class ' + cname(model.c) + ' | ' + F.monthLabel(model.m) + ' | ' + (model.summary ? 'All subjects' : subName(model.sub));
      var table = model.summary ? '<table><thead><tr><th>Student</th>' + model.subs.map(function (k) { return '<th>' + h(subName(k)) + '</th>'; }).join('') + '<th>Overall</th></tr></thead><tbody>' + model.rows.map(function (r) { return '<tr><td>' + h(r.s.name) + '</td>' + r.per.map(function (x) { return '<td>' + pctText(x) + '</td>'; }).join('') + '<td>' + pctText(r.all) + '</td></tr>'; }).join('') + '</tbody></table>'
        : '<table><thead><tr><th>Student</th>' + model.days.map(function (x) { return '<th>' + +x.slice(8) + '</th>'; }).join('') + '<th>%</th></tr></thead><tbody>' + model.rows.map(function (r) { return '<tr><td>' + h(r.s.name) + '</td>' + r.cells.map(function (x) { return '<td>' + x + '</td>'; }).join('') + '<td>' + pctText(r.pct) + '</td></tr>'; }).join('') + '</tbody></table>';
      U.print(U.docHeader(settings, 'Monthly attendance', title) + table, 'Attendance');
    });
    build();
  }

  /* ---- Defaulters ---- */
  function defaulters(p) {
    p.innerHTML = '<div class="filters card card-pad"><div class="field"><label for="x-month">Month</label><input class="input" type="month" id="x-month" value="' + month + '" max="' + month + '"></div><div class="field"><label for="x-class">Class</label><select class="select" id="x-class">' + classOpts() + '</select></div>' + subjectSelect('x-sub', false) + '<div class="field"><label for="x-th">Below (%)</label><input class="input" type="number" id="x-th" min="1" max="100" value="' + settings.attendanceThreshold + '"></div><div class="row" style="align-self:flex-end">' + U.btn('Message all parents', { variant: 'whatsapp', icon: 'whatsapp', id: 'x-wa' }) + '</div></div><section class="card" id="x-tbl"></section>';
    var pctBy = {};
    var tbl = U.table(p.querySelector('#x-tbl'), {
      rows: [], pageSize: 10, search: function (r) { return r.name + ' ' + r.cls; }, searchPlaceholder: 'Search student',
      columns: [
        { key: 'name', label: 'Student', render: function (r) { return '<div class="cell-main">' + U.avatar(r.name) + '<span>' + h(r.name) + '</span></div>'; } },
        { key: 'cls', label: 'Class' }, { key: 'A', label: 'Absent', num: true }, { key: 'L', label: 'Late', num: true }, { key: 'LV', label: 'Leave', num: true },
        { key: 'pct', label: 'Attendance', num: true, render: function (r) { return U.badge(pctText(r.pct), r.pct < 60 ? 'absent' : 'late'); } }
      ],
      actions: [{ id: 'wa', label: 'Message parent', icon: 'whatsapp', onClick: function (r) { msg([r.s]); } }],
      empty: { icon: 'check', title: 'No defaulters', message: 'Everyone is above the limit for this selection.' }
    });
    function rows() {
      var m = p.querySelector('#x-month').value, c = p.querySelector('#x-class').value, sub = p.querySelector('#x-sub').value, th = Number(p.querySelector('#x-th').value) || 75;
      var recs = monthRecs(m, '', sub);
      return d.students.filter(function (s) { return s.status === 'active' && inBatch(s.classId) && (!c || s.classId === c); }).map(function (s) {
        var mine = recs.filter(function (a) { return a.studentId === s.id; }), n = count(mine), pc = D.attPct(mine); pctBy[s.id] = pc;
        return { id: s.id, s: s, name: s.name, cls: cname(s.classId), A: n.A, L: n.L, LV: n.LV, pct: pc };
      }).filter(function (r) { return r.pct !== null && r.pct < th; }).sort(function (a, b) { return a.pct - b.pct; });
    }
    function msg(list) {
      var th = Number(p.querySelector('#x-th').value) || 75, m = p.querySelector('#x-month').value, sub = p.querySelector('#x-sub').value;
      ED.wa.openModal({ students: list, type: 'custom', text: 'Assalam o Alaikum {parent}, the ' + (sub ? subName(sub) + ' ' : '') + 'attendance of {student} ({class}) in ' + F.monthLabel(m) + ' is {percentage}, below the required ' + th + '%. Please ensure regular attendance. - {school}', vars: function (s) { return { percentage: pctText(pctBy[s.id]) }; } });
    }
    function paint() { tbl.setRows(rows()); }
    ['x-month', 'x-class', 'x-sub', 'x-th'].forEach(function (id) { p.querySelector('#' + id).addEventListener('change', paint); });
    p.querySelector('#x-wa').addEventListener('click', function () { var r = tbl.visible(); if (!r.length) return U.toast('No defaulters to message.', 'info'); msg(r.map(function (x) { return x.s; })); });
    paint();
  }

  /* ---- Single student ---- */
  function student(p) {
    p.innerHTML = '<div class="filters card card-pad"><div class="field"><label for="s-st">Student</label><select class="select" id="s-st">' + d.students.filter(function (s) { return inBatch(s.classId); }).map(function (s) { return '<option value="' + s.id + '">' + h(s.name + ' (' + cname(s.classId) + ')') + '</option>'; }).join('') + '</select></div><div class="field"><label for="s-m">Month</label><input class="input" type="month" id="s-m" value="' + month + '" max="' + month + '"></div>' + subjectSelect('s-sub', false) + '</div><div id="s-out"></div>';
    function paint() {
      var id = p.querySelector('#s-st').value, m = p.querySelector('#s-m').value, sub = p.querySelector('#s-sub').value; if (!id || !m) return;
      var all = d.attendance.filter(function (a) { return a.studentId === id && F.monthKey(a.date) === m; }), recs = all.filter(function (a) { return !sub || a.subjectId === sub; });
      var byDay = {}; recs.forEach(function (r) { (byDay[r.date] = byDay[r.date] || []).push(r); });
      var n = count(recs), first = F.dow(m + '-01'), lead = (first + 6) % 7, cells = '', COL = { P: 'present', A: 'absent', L: 'late', LV: 'leave' };
      ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(function (x) { cells += '<div class="dow">' + x + '</div>'; });
      for (var i = 0; i < lead; i++) cells += '<div class="day empty"></div>';
      for (var dd = 1; dd <= F.daysInMonth(m); dd++) {
        var iso = m + '-' + (dd < 10 ? '0' + dd : dd), rs = byDay[iso] || [], label = '', style = '';
        if (rs.length) {
          var c = count(rs);
          if (sub || rs.length === 1) { label = rs[0].status; style = ' style="background:var(--' + COL[rs[0].status] + '-bg);color:var(--' + COL[rs[0].status] + '-text)"'; }
          else { label = (c.P + c.L) + '/' + (rs.length - c.LV); var worst = c.A ? 'A' : c.L ? 'L' : 'P'; style = ' style="background:var(--' + COL[worst] + '-bg);color:var(--' + COL[worst] + '-text)"'; }
        }
        cells += '<div class="day"' + style + ' title="' + rs.map(function (r) { return subName(r.subjectId) + ': ' + U.statLabel('att', r.status); }).join(', ') + '"><span>' + dd + '</span><span class="st">' + label + '</span></div>';
      }
      var subs = all.map(function (a) { return a.subjectId; }).filter(function (x, i, a) { return a.indexOf(x) === i; });
      var rowsSub = subs.map(function (k) { var mine = all.filter(function (a) { return a.subjectId === k; }), c = count(mine); return '<tr><td data-label="Subject">' + h(subName(k)) + '</td><td class="num" data-label="Present">' + c.P + '</td><td class="num" data-label="Absent">' + c.A + '</td><td class="num" data-label="Late">' + c.L + '</td><td class="num" data-label="Leave">' + c.LV + '</td><td class="num" data-label="Attendance">' + pctText(D.attPct(mine)) + '</td></tr>'; }).join('');
      p.querySelector('#s-out').innerHTML = '<div class="grid-stats">' + U.stat('Attendance', pctText(D.attPct(recs)), F.monthLabel(m) + (sub ? ' | ' + subName(sub) : ' | all subjects'), D.attPct(recs) !== null && D.attPct(recs) < settings.attendanceThreshold ? 'bad' : 'good') + U.stat('Present', n.P, 'lessons') + U.stat('Absent', n.A, 'lessons', n.A ? 'bad' : '') + U.stat('Late / Leave', n.L + ' / ' + n.LV, 'lessons') + '</div>' +
        '<section class="card card-pad" style="margin-top:12px"><div class="cal">' + cells + '</div>' + (sub ? '' : '<p class="small muted" style="margin-top:8px">With all subjects selected, each day shows attended lessons out of total lessons.</p>') + '</section>' +
        '<section class="card" style="margin-top:12px"><div class="card-head"><h3>By subject</h3></div><div class="table-wrap">' + (subs.length ? '<table class="table rowcards"><thead><tr><th>Subject</th><th class="num">Present</th><th class="num">Absent</th><th class="num">Late</th><th class="num">Leave</th><th class="num">Attendance</th></tr></thead><tbody>' + rowsSub.replace(/<td data-label="Subject">/g, '<td class="td-title" data-label="Subject">') + '</tbody></table>' : U.empty('attendance', 'No attendance this month', '')) + '</div></section>';
    }
    ['s-st', 's-m', 's-sub'].forEach(function (id) { p.querySelector('#' + id).addEventListener('change', paint); }); paint();
  }

  var tabsApi = U.tabs(document.getElementById('tabs'), [{ id: 'daily', label: 'Daily', render: daily }, { id: 'monthly', label: 'Monthly', render: monthly }, { id: 'def', label: 'Defaulters', render: defaulters }, { id: 'student', label: 'Single student', render: student }]);
  document.getElementById('rb').addEventListener('change', function (e) { batchId = e.target.value; tabsApi.select(tabsApi.current()); });
})();
