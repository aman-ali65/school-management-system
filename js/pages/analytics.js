(async function () {
  var role = document.body.dataset.role;
  var session = await ED.shell.init({ role: role, active: 'analytics' });
  if (!session) return;
  var S = ED.storage, F = ED.fmt, U = ED.ui, I = ED.icons, h = F.esc, D = ED.data, C = ED.charts;
  var ctx = await D.context(session), settings = ctx.settings;
  var today = F.today(), thisMonth = F.monthKey(today);
  var d = await D.load(['attendance', 'exams', 'marks', 'students', 'subjects', 'gradingScale', 'feePayments', 'feeInvoices', 'expenses', 'expenseCategories', 'teachers', 'teacherAttendance']);
  var subMap = d.map.subjects, scale = d.gradingScale, pctFmt = function (v) { return Math.round(v) + '%'; }, money = function (v) { return 'Rs ' + (v >= 1000 ? Math.round(v / 100) / 10 + 'k' : Math.round(v)); };

  document.getElementById('content').innerHTML = U.pageHead('Analytics', ctx.isAdmin ? 'Attendance, results and money across the whole school.' : 'Attendance and results for your classes.', U.btn('Export summary CSV', { id: 'export' })) +
    '<div id="tabs"></div>';
  var filtersHTML = '<div class="filters card card-pad">' + (ctx.isAdmin ? '<div class="field"><label for="a-b">Batch</label><select class="select" id="a-b"><option value="">All batches</option>' + ctx.batches.map(function (b) { return '<option value="' + b.id + '"' + (b.id === ctx.activeId ? ' selected' : '') + '>' + h(b.name) + (b.id === ctx.activeId ? ' (current)' : '') + '</option>'; }).join('') + '</select></div>' : '') + '<div class="field"><label for="a-p">Period</label><select class="select" id="a-p"><option value="month">This month</option><option value="30">Last 30 days</option><option value="all">Whole session</option></select></div><div class="field"><label for="a-c">Class</label><select class="select" id="a-c"><option value="">' + (ctx.isAdmin ? 'All classes' : 'All my classes') + '</option>' + U.options(ctx.classes, 'id', F.className) + '</select></div></div><div id="out"></div>';

  function overview(panel) {
    panel.innerHTML = filtersHTML;
  var pEl = document.getElementById('a-p'), cEl = document.getElementById('a-c'), summary = [];

  function inPeriod(date) {
    var p = pEl.value; if (p === 'all') return date <= today;
    if (p === '30') return date >= F.addDays(today, -29) && date <= today;
    return F.monthKey(date) === thisMonth;
  }
  var bEl = document.getElementById('a-b');
  function fillC() { var list = ctx.classes.filter(function (c) { return !bEl || !bEl.value || c.sessionId === bEl.value; }); cEl.innerHTML = '<option value="">' + (ctx.isAdmin ? 'All classes' : 'All my classes') + '</option>' + U.options(list, 'id', F.className); }
  fillC();
  function classSet() { return cEl.value ? [cEl.value] : ctx.classIds.filter(function (id) { var c = ctx.allClasses.filter(function (x) { return x.id === id; })[0]; return !bEl || !bEl.value || (c && c.sessionId === bEl.value); }); }
  function paint() {
    var classes = classSet(), cn = function (id) { return F.className(ctx.allClasses.filter(function (c) { return c.id === id; })[0]); };
    var att = d.attendance.filter(function (a) { return classes.indexOf(a.classId) >= 0 && inPeriod(a.date); });
    var attRate = D.attPct(att);
    var exams = d.exams.filter(function (e) { return classes.indexOf(e.classId) >= 0 && e.status === 'published'; }), examById = {}; exams.forEach(function (e) { examById[e.id] = e; });
    var mk = d.marks.filter(function (m) { return examById[m.examId] && !m.absent && m.marks !== null; });
    var pcts = mk.map(function (m) { return m.marks / examById[m.examId].totalMarks * 100; });
    var avg = pcts.length ? pcts.reduce(function (a, b) { return a + b; }, 0) / pcts.length : null, passRate = pcts.length ? pcts.filter(function (x) { return x >= settings.passPercent; }).length / pcts.length * 100 : null;

    /* attendance by class */
    var byClass = classes.map(function (id) { return { l: cn(id), v: D.attPct(att.filter(function (a) { return a.classId === id; })) || 0 }; });
    /* trend by day */
    var days = {}; att.forEach(function (a) { (days[a.date] = days[a.date] || []).push(a); });
    var dayKeys = Object.keys(days).sort().slice(-14);
    /* attendance by subject */
    var attSub = {}; att.forEach(function (a) { (attSub[a.subjectId] = attSub[a.subjectId] || []).push(a); });
    var attSubKeys = Object.keys(attSub);
    /* subject averages */
    var bySub = {}; mk.forEach(function (m) { var e = examById[m.examId], k = (d.subjects.filter(function (s) { return s.id === e.subjectId; })[0] || {}).name || '-'; (bySub[k] = bySub[k] || []).push(m.marks / e.totalMarks * 100); });
    var subNames = Object.keys(bySub);
    /* grades */
    var gd = {}; pcts.forEach(function (x) { var g = D.gradeFor(x, scale); gd[g] = (gd[g] || 0) + 1; });
    /* students ranking */
    var per = {}; mk.forEach(function (m) { var e = examById[m.examId]; per[m.studentId] = per[m.studentId] || { o: 0, t: 0 }; per[m.studentId].o += m.marks; per[m.studentId].t += e.totalMarks; });
    var rank = Object.keys(per).map(function (id) { var s = d.students.filter(function (x) { return x.id === id; })[0]; return s ? { name: s.name, cls: cn(s.classId), pct: per[id].o / per[id].t * 100 } : null; }).filter(Boolean).sort(function (a, b) { return b.pct - a.pct; });
    var attBy = {}; att.forEach(function (a) { (attBy[a.studentId] = attBy[a.studentId] || []).push(a); });
    var low = Object.keys(attBy).map(function (id) { var s = d.students.filter(function (x) { return x.id === id; })[0]; return s ? { name: s.name, cls: cn(s.classId), pct: D.attPct(attBy[id]) } : null; }).filter(function (x) { return x && x.pct !== null; }).sort(function (a, b) { return a.pct - b.pct; }).slice(0, 5);
    function tbl(rows, title, good) { return '<section class="card"><div class="card-head"><h3>' + title + '</h3></div><div class="table-wrap"><table class="table"><tbody>' + (rows.length ? rows.map(function (r, i) { return '<tr><td>' + (i + 1) + '</td><td>' + h(r.name) + '<div class="cell-sub">' + h(r.cls) + '</div></td><td class="num">' + U.badge(F.pct(r.pct), good ? 'present' : (r.pct < 60 ? 'absent' : 'late')) + '</td></tr>'; }).join('') : '<tr><td>' + U.empty('analytics', 'No data', '') + '</td></tr>') + '</tbody></table></div></section>'; }

    var html = '<div class="grid-stats">' + U.stat('Attendance', attRate === null ? '-' : F.pct(attRate), att.length + ' records', attRate !== null && attRate < settings.attendanceThreshold ? 'bad' : 'good') + U.stat('Average result', avg === null ? '-' : F.pct(avg), exams.length + ' published exams') + U.stat('Pass rate', passRate === null ? '-' : F.pct(passRate), 'Pass mark ' + settings.passPercent + '%', passRate !== null && passRate < 70 ? 'bad' : 'good');
    summary = [['Metric', 'Value'], ['Attendance %', attRate === null ? '' : Math.round(attRate * 10) / 10], ['Average result %', avg === null ? '' : Math.round(avg * 10) / 10], ['Pass rate %', passRate === null ? '' : Math.round(passRate * 10) / 10]];
    if (ctx.isAdmin) {
      var pays = d.feePayments.filter(function (x) { return inPeriod(x.date); }).reduce(function (a, x) { return a + x.amount; }, 0), exp = d.expenses.filter(function (x) { return inPeriod(x.date); }).reduce(function (a, x) { return a + x.amount; }, 0);
      html += U.stat('Fees collected', F.currency(pays), 'In this period', 'good') + U.stat('Expenses', F.currency(exp), 'In this period') + U.stat('Surplus', F.currency(pays - exp), 'Fees minus expenses (salary excluded)', pays - exp >= 0 ? 'good' : 'bad');
      summary.push(['Fees collected', pays], ['Expenses', exp]);
    }
    html += '</div>';
    html += '<div class="grid-2"><section class="card chart-card chart"><h3>Attendance by class</h3>' + C.bar({ labels: byClass.map(function (x) { return x.l; }), series: [{ name: 'Attendance', values: byClass.map(function (x) { return x.v; }) }], max: 100, fmt: pctFmt, label: 'Attendance by class' }) + '</section>' +
      '<section class="card chart-card chart"><h3>Daily attendance trend</h3>' + C.line({ labels: dayKeys.map(function (k) { return k.slice(8) + '/' + k.slice(5, 7); }), series: [{ name: 'Attendance', values: dayKeys.map(function (k) { return D.attPct(days[k]) || 0; }) }], max: 100, min: 0, fmt: pctFmt, label: 'Daily attendance', empty: 'Not enough days of data yet' }) + '</section></div>';
    html += '<section class="card chart-card chart"><h3>Attendance by subject</h3>' + C.bar({ labels: attSubKeys.map(function (k) { return D.subjectName(subMap, k); }), series: [{ name: 'Attendance', values: attSubKeys.map(function (k) { return D.attPct(attSub[k]) || 0; }), color: 'var(--c5)' }], max: 100, fmt: pctFmt, label: 'Attendance by subject', empty: 'No attendance in this period' }) + '</section>';
    html += '<div class="grid-2"><section class="card chart-card chart"><h3>Average result by subject</h3>' + C.bar({ labels: subNames, series: [{ name: 'Average', values: subNames.map(function (k) { return bySub[k].reduce(function (a, b) { return a + b; }, 0) / bySub[k].length; }), color: 'var(--c6)' }], max: 100, fmt: pctFmt, label: 'Subject averages', empty: 'No published results yet' }) + '</section>' +
      '<section class="card chart-card chart"><h3>Grade distribution</h3>' + C.donut({ items: Object.keys(gd).map(function (g) { return { label: 'Grade ' + g, value: gd[g] }; }), center: String(pcts.length), centerSub: 'marks', empty: 'No published results yet' }) + '</section></div>';
    html += '<div class="grid-2">' + tbl(rank.slice(0, 5), 'Top 5 students', true) + tbl(rank.slice(-5).reverse(), 'Needs support (lowest results)', false) + '</div>' + tbl(low, 'Lowest attendance (top 5)', false);

    if (ctx.isAdmin) {
      var months = [], k = thisMonth; for (var i = 0; i < 6; i++) { months.unshift(k); k = F.prevMonth(k); }
      var inc = months.map(function (m) { return d.feePayments.filter(function (x) { return F.monthKey(x.date) === m; }).reduce(function (a, x) { return a + x.amount; }, 0); }), out = months.map(function (m) { return d.expenses.filter(function (x) { return F.monthKey(x.date) === m; }).reduce(function (a, x) { return a + x.amount; }, 0); });
      var cat = {}; d.expenses.filter(function (x) { return inPeriod(x.date); }).forEach(function (x) { var n = (d.expenseCategories.filter(function (c) { return c.id === x.categoryId; })[0] || {}).name || '-'; cat[n] = (cat[n] || 0) + x.amount; });
      var tat = d.teachers.filter(function (t) { return t.status === 'active'; }).map(function (t) { return { l: t.name.split(' ')[0], v: D.attPct(d.teacherAttendance.filter(function (a) { return a.teacherId === t.id && inPeriod(a.date); })) || 0 }; });
      html += '<div class="grid-2"><section class="card chart-card chart"><h3>Fees collected vs expenses</h3>' + C.bar({ labels: months.map(F.monthLabel), series: [{ name: 'Fees collected', values: inc, color: 'var(--c2)' }, { name: 'Expenses', values: out, color: 'var(--c4)' }], fmt: money }) + '</section>' +
        '<section class="card chart-card chart"><h3>Expenses by category</h3>' + C.donut({ items: Object.keys(cat).map(function (n) { return { label: n, value: cat[n] }; }), center: money(Object.keys(cat).reduce(function (a, n) { return a + cat[n]; }, 0)), centerSub: 'spent', fmt: money, empty: 'No expenses in this period' }) + '</section></div>' +
        '<section class="card chart-card chart"><h3>Teacher attendance</h3>' + C.bar({ labels: tat.map(function (x) { return x.l; }), series: [{ name: 'Attendance', values: tat.map(function (x) { return x.v; }), color: 'var(--c7)' }], max: 100, fmt: pctFmt }) + '</section>';
      months.forEach(function (m, i) { summary.push(['Fees ' + m, inc[i]], ['Expenses ' + m, out[i]]); });
    }
    document.getElementById('out').innerHTML = '<div class="stack">' + html + '</div>';
  }
  pEl.addEventListener('change', paint); cEl.addEventListener('change', paint);
  if (bEl) bEl.addEventListener('change', function () { fillC(); paint(); });
  document.getElementById('export').addEventListener('click', function () { U.download('analytics-summary.csv', U.toCSV(summary), 'text/csv'); U.toast('Summary exported', 'success'); });
  paint();
  }

  var tabDefs = [{ id: 'overview', label: 'Overview', render: overview }];
  if (ctx.isAdmin) tabDefs.push({ id: 'money', label: 'Money flow', render: function (panel) { ED.money.load().then(function (m) { ED.money.mountReport(panel, m); }); } });
  var tabsApi = U.tabs(document.getElementById('tabs'), tabDefs, { initial: ctx.isAdmin && location.hash === '#money' ? 'money' : 'overview' });
  if (tabDefs.length === 1) document.querySelector('#tabs .tabs').style.display = 'none';
})();
