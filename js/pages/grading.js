(async function () {
  var session = await ED.shell.init({ role: 'admin', active: 'grading' });
  if (!session) return;
  var S = ED.storage, F = ED.fmt, U = ED.ui, h = F.esc, A = ED.audit;
  var DEFAULT = [['A+', 90, 'Outstanding'], ['A', 80, 'Excellent'], ['B', 70, 'Very good'], ['C', 60, 'Good'], ['D', 50, 'Satisfactory'], ['E', 40, 'Pass'], ['F', 0, 'Fail']];
  var scale, settings;
  async function fetchAll() { scale = (await S.getAll('gradingScale')).sort(function (a, b) { return b.minPercent - a.minPercent; }); settings = await ED.data.settings(); }
  await fetchAll();

  document.getElementById('content').innerHTML = U.pageHead('Grading', 'Percentage ranges used on mark sheets, report cards and analytics.', U.btn('Add grade', { variant: 'primary', icon: 'plus', id: 'add' }) + U.btn('Reset to default', { id: 'reset' })) +
    '<div class="grid-2"><section class="card" id="tbl"></section><div class="stack"><section class="card card-pad stack"><h3>Pass mark</h3><div class="field"><label for="pass">Pass percentage</label><input class="input" id="pass" type="number" min="1" max="100"><span class="hint">Students below this percentage are shown as failed.</span></div><button type="button" class="btn btn-primary" id="save-pass" style="align-self:flex-start">Save pass mark</button></section><section class="card card-pad stack"><h3>Try it</h3><div class="field"><label for="try">Percentage</label><input class="input" id="try" type="number" min="0" max="100" value="73"></div><div id="try-out"></div></section></div></div>';
  document.getElementById('pass').value = settings.passPercent;

  var tbl = U.table(document.getElementById('tbl'), {
    rows: scale, pageSize: 20,
    columns: [
      { key: 'grade', label: 'Grade', sortable: false, render: function (r) { return U.badge(r.grade, r.minPercent >= settings.passPercent ? 'present' : 'absent'); } },
      { key: 'minPercent', label: 'From (%)', num: true, sortable: false },
      { key: 'range', label: 'To (%)', num: true, sortable: false, render: function (r) { var i = scale.indexOf(r); return i === 0 ? '100' : (scale[i - 1].minPercent - 0.1).toFixed(1); } },
      { key: 'remarks', label: 'Remarks', sortable: false }
    ],
    actions: [{ id: 'edit', label: 'Edit grade', icon: 'settings', onClick: function (r) { edit(r); } }, { id: 'del', label: 'Delete grade', icon: 'x', danger: true, onClick: del }],
    empty: { icon: 'grading', title: 'No grades', message: 'Add a grade or reset to default.' }
  });
  function repaint() { tbl.setRows(scale); preview(); }
  function preview() {
    var v = Number(document.getElementById('try').value), g = ED.data.gradeFor(v, scale);
    document.getElementById('try-out').innerHTML = isNaN(v) ? '' : '<div class="row">' + U.badge('Grade ' + g, v >= settings.passPercent ? 'present' : 'absent') + '<span class="muted">' + (v >= settings.passPercent ? 'Pass' : 'Fail') + '</span></div>';
  }
  document.getElementById('try').addEventListener('input', preview);

  async function edit(r) {
    var v = await U.form({
      title: r ? 'Edit grade' : 'Add grade', value: r || {}, fields: [{ name: 'grade', label: 'Grade', required: true, maxlength: 4 }, { name: 'minPercent', label: 'From percentage', type: 'number', required: true, min: 0, max: 100, step: 0.5 }, { name: 'remarks', label: 'Remarks', full: true, placeholder: 'e.g. Excellent' }],
      validate: function (x) {
        if (scale.some(function (g) { return (!r || g.id !== r.id) && g.grade.toLowerCase() === x.grade.toLowerCase(); })) return 'That grade name already exists.';
        if (scale.some(function (g) { return (!r || g.id !== r.id) && g.minPercent === x.minPercent; })) return 'Another grade already starts at ' + x.minPercent + '%.';
        if (r && r.minPercent === 0 && x.minPercent !== 0) return 'The lowest grade must start at 0% so every mark gets a grade.';
        return null;
      }
    });
    if (!v) return;
    if (r) await S.update('gradingScale', r.id, v); else await S.insert('gradingScale', v);
    A.log('update', 'grading', 'Changed grading scale (' + v.grade + ' from ' + v.minPercent + '%)'); U.toast('Grade saved', 'success'); await fetchAll(); repaint();
  }
  async function del(r) {
    if (r.minPercent === 0) return U.toast('The grade starting at 0% cannot be deleted.', 'danger');
    var ok = await U.confirm({ title: 'Delete grade ' + r.grade + '?', message: 'Students in this range will get the next lower grade.', confirmLabel: 'Delete', danger: true }); if (!ok) return;
    await S.remove('gradingScale', r.id); A.log('delete', 'grading', 'Deleted grade ' + r.grade); U.toast('Grade deleted', 'success'); await fetchAll(); repaint();
  }
  document.getElementById('add').addEventListener('click', function () { edit(null); });
  document.getElementById('reset').addEventListener('click', async function () {
    var ok = await U.confirm({ title: 'Reset grading scale?', message: 'Your grades are replaced by the default A+ to F scale.', confirmLabel: 'Reset', danger: true }); if (!ok) return;
    S._writeList('gradingScale', DEFAULT.map(function (g, i) { return { id: 'gr-' + (i + 1), grade: g[0], minPercent: g[1], remarks: g[2], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; }));
    A.log('update', 'grading', 'Reset grading scale to default'); U.toast('Grading scale reset', 'success'); await fetchAll(); repaint();
  });
  document.getElementById('save-pass').addEventListener('click', async function () {
    var v = Number(document.getElementById('pass').value);
    if (!(v >= 1 && v <= 100)) return U.toast('Enter a pass percentage between 1 and 100.', 'danger');
    await S.setObject('settings', Object.assign({}, await S.getObject('settings', {}), { passPercent: v })); settings.passPercent = v;
    A.log('update', 'grading', 'Pass percentage set to ' + v + '%'); U.toast('Pass mark saved', 'success'); repaint();
  });
  repaint();
})();
