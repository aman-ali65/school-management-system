(async function () {
  var session = await ED.shell.init({ role: 'admin', active: 'timetable' });
  if (!session) return;
  var S = ED.storage, F = ED.fmt, U = ED.ui, h = F.esc, A = ED.audit;
  var DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], PERIODS = [[1, '08:00'], [2, '08:45'], [3, '09:30'], [4, '10:15'], ['b', 'Break'], [5, '11:15'], [6, '12:00'], [7, '12:45']];
  var d, mode = 'class', selDay = Math.min(6, Math.max(1, new Date().getDay() || 1));
  async function fetchAll() { d = await ED.data.load(['timetable', 'classes', 'teachers', 'subjects', 'assignments']); }
  await fetchAll();
  var settings = await ED.data.settings();

  document.getElementById('content').innerHTML = U.pageHead('Timetable', 'Click an empty slot to add a lesson. Clashes for teachers are blocked.', U.btn('Print timetable', { id: 'print' })) +
    '<div class="filters card card-pad"><div class="field"><label for="mode">View by</label><select class="select" id="mode"><option value="class">Class</option><option value="teacher">Teacher</option></select></div>' +
    '<div class="field"><label for="who">Choose</label><select class="select" id="who"></select></div></div>' +
    '<section class="card"><div class="table-wrap card-pad" id="grid"></div></section>';
  var modeEl = document.getElementById('mode'), whoEl = document.getElementById('who');
  function fillWho() {
    var list = modeEl.value === 'class' ? d.classes.slice().sort(function (a, b) { var act = F._batch ? F._batch.active : ''; return (b.sessionId === act) - (a.sessionId === act); }).map(function (c) { return [c.id, 'Class ' + F.className(c)]; }) : d.teachers.map(function (t) { return [t.id, t.name]; });
    var prev = whoEl.value;
    whoEl.innerHTML = list.map(function (x) { return '<option value="' + h(x[0]) + '">' + h(x[1]) + '</option>'; }).join('');
    if (list.some(function (x) { return x[0] === prev; })) whoEl.value = prev;
  }
  function slot(day, p) {
    return d.timetable.filter(function (t) {
      return t.day === day && t.period === p && (modeEl.value === 'class' ? t.classId === whoEl.value : t.teacherId === whoEl.value);
    })[0];
  }
  function render() {
    var byClass = modeEl.value === 'class';
    var html = '<div class="only-m" style="margin-bottom:8px"><div class="field" style="flex:1"><label for="tt-day">Day</label><select class="select" id="tt-day">' + DAYS.map(function (x, i) { return '<option value="' + (i + 1) + '"' + (String(i + 1) === String(selDay) ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></div></div>' +
      '<table class="tt" data-sel="' + selDay + '"><thead><tr><th class="p"></th>' + DAYS.map(function (x, i) { return '<th data-d="' + (i + 1) + '">' + x + '</th>'; }).join('') + '</tr></thead><tbody>';
    PERIODS.forEach(function (p) {
      if (p[0] === 'b') { html += '<tr class="brk"><td colspan="7">Break</td></tr>'; return; }
      html += '<tr><th class="p">Period ' + p[0] + '<div class="ptime">' + p[1] + '</div></th>';
      DAYS.forEach(function (x, i) {
        var t = slot(i + 1, p[0]);
        if (t) {
          var sub = (d.map.subjects[t.subjectId] || {}).name, other = byClass ? (d.map.teachers[t.teacherId] || {}).name : 'Class ' + F.className(d.map.classes[t.classId]);
          html += '<td data-d="' + (i + 1) + '"><button type="button" class="slot filled admin" data-day="' + (i + 1) + '" data-p="' + p[0] + '" aria-label="Edit lesson"><b>' + h(sub) + '</b>' + h(other) + '</button></td>';
        } else html += '<td data-d="' + (i + 1) + '">' + (byClass ? '<button type="button" class="slot admin" data-day="' + (i + 1) + '" data-p="' + p[0] + '" aria-label="Add lesson">+ Add</button>' : '<div class="slot" style="border-color:transparent">Free</div>') + '</td>';
      });
      html += '</tr>';
    });
    document.getElementById('grid').innerHTML = html + '</tbody></table>';
    var dayEl = document.getElementById('tt-day'); if (dayEl) dayEl.addEventListener('change', function () { selDay = dayEl.value; document.querySelector('.tt').setAttribute('data-sel', selDay); });
  }
  async function editSlot(day, period) {
    var classId = whoEl.value, cur = slot(day, period);
    var opts = d.assignments.filter(function (a) { return a.classId === classId; });
    if (!opts.length) return U.toast('Assign teachers to this class first (Assignments page).', 'info');
    var v = await U.form({
      title: DAYS[day - 1] + ', period ' + period, submitLabel: 'Save lesson', value: cur ? { asg: opts.filter(function (a) { return a.subjectId === cur.subjectId; })[0].id } : {},
      fields: [{ name: 'asg', label: 'Subject and teacher', type: 'select', required: true, placeholder: 'Choose lesson', full: true, options: opts.map(function (a) { return { value: a.id, label: d.map.subjects[a.subjectId].name + ' - ' + d.map.teachers[a.teacherId].name }; }) }],
      validate: function (x) {
        var a = d.map.assignments[x.asg];
        var clash = d.timetable.filter(function (t) { return t.day === day && t.period === period && t.teacherId === a.teacherId && t.classId !== classId; })[0];
        return clash ? d.map.teachers[a.teacherId].name + ' already teaches class ' + F.className(d.map.classes[clash.classId]) + ' in this period.' : null;
      }
    });
    if (v === null) return;
    var a = d.map.assignments[v.asg];
    if (cur) await S.update('timetable', cur.id, { subjectId: a.subjectId, teacherId: a.teacherId });
    else await S.insert('timetable', { classId: classId, day: day, period: period, subjectId: a.subjectId, teacherId: a.teacherId });
    A.log('update', 'timetable', 'Timetable updated for class ' + F.className(d.map.classes[classId]));
    U.toast('Lesson saved', 'success'); await fetchAll(); render();
  }
  document.getElementById('grid').addEventListener('click', async function (e) {
    var b = e.target.closest('.slot[data-day]'); if (!b) return;
    var day = +b.dataset.day, p = +b.dataset.p;
    if (modeEl.value !== 'class') return U.toast('Switch to Class view to edit lessons.', 'info');
    var cur = slot(day, p);
    if (cur) {
      var r = await U.modal({ title: 'Lesson options', body: '<p>' + h(d.map.subjects[cur.subjectId].name) + ' with ' + h(d.map.teachers[cur.teacherId].name) + '</p>', actions: [{ label: 'Close', variant: 'secondary', value: 'x' }, { label: 'Remove lesson', variant: 'danger', value: 'del' }, { label: 'Change lesson', variant: 'primary', value: 'edit' }] });
      if (r === 'del') { await S.remove('timetable', cur.id); A.log('delete', 'timetable', 'Removed a lesson'); U.toast('Lesson removed', 'success'); await fetchAll(); render(); }
      if (r === 'edit') editSlot(day, p);
    } else editSlot(day, p);
  });
  modeEl.addEventListener('change', function () { fillWho(); render(); });
  whoEl.addEventListener('change', render);
  document.getElementById('print').addEventListener('click', function () {
    var title = modeEl.options[modeEl.selectedIndex].text + ': ' + whoEl.options[whoEl.selectedIndex].text;
    var rows = PERIODS.filter(function (p) { return p[0] !== 'b'; }).map(function (p) {
      return '<tr><td>Period ' + p[0] + ' (' + p[1] + ')</td>' + DAYS.map(function (x, i) { var t = slot(i + 1, p[0]); return '<td>' + (t ? h(d.map.subjects[t.subjectId].name) + '<br><small>' + h(modeEl.value === 'class' ? d.map.teachers[t.teacherId].name : F.className(d.map.classes[t.classId])) + '</small>' : '') + '</td>'; }).join('') + '</tr>';
    }).join('');
    U.print(U.docHeader(settings, 'Timetable', title) + '<table><thead><tr><th></th>' + DAYS.map(function (x) { return '<th>' + x + '</th>'; }).join('') + '</tr></thead><tbody>' + rows + '</tbody></table>', 'Timetable');
  });
  fillWho(); render();
})();
