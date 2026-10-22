(async function () {
  var session = await ED.shell.init({ role: 'admin', active: 'teachers' });
  if (!session) return;
  var S = ED.storage, F = ED.fmt, U = ED.ui, h = F.esc, A = ED.audit, hash = ED.auth.hash;
  var d;
  async function fetchAll() { d = await ED.data.load(['teachers', 'users', 'assignments', 'classes', 'salaries']); }
  await fetchAll();
  document.getElementById('content').innerHTML = U.pageHead('Teachers', 'Add teachers, give them a login and manage their status.', U.btn('Add teacher', { variant: 'primary', icon: 'plus', id: 'add' })) + '<section class="card" id="tbl"></section>';

  function rows() {
    return d.teachers.map(function (t) {
      var mine = d.assignments.filter(function (a) { return a.teacherId === t.id; });
      var classes = mine.map(function (a) { return F.className(d.map.classes[a.classId]); }).filter(function (x, i, arr) { return arr.indexOf(x) === i; });
      return { id: t.id, t: t, name: t.name, phone: t.phone, email: t.email, classes: classes.join(', ') || 'None', count: mine.length, salary: t.baseSalary || 0, status: t.status, selfEdit: !!t.canEditProfile };
    });
  }
  var tbl = U.table(document.getElementById('tbl'), {
    rows: rows(), pageSize: 10, search: function (r) { return [r.name, r.phone, r.email, r.classes].join(' '); }, searchPlaceholder: 'Search teachers',
    columns: [
      { key: 'name', label: 'Teacher', render: function (r) { return '<div class="cell-main">' + U.avatar(r.name) + '<div><div>' + h(r.name) + '</div><div class="cell-sub">' + h(r.email) + '</div></div></div>'; } },
      { key: 'phone', label: 'Phone' },
      { key: 'classes', label: 'Classes' },
      { key: 'count', label: 'Assignments', num: true },
      { key: 'salary', label: 'Base salary', num: true, render: function (r) { return F.currency(r.salary); } },
      { key: 'selfEdit', label: 'Edits own profile', render: function (r) { return r.selfEdit ? U.badge('Allowed', 'primary') : U.badge('Admin only'); } },
      { key: 'status', label: 'Status', render: function (r) { return U.statusBadge('active', r.status); } }
    ],
    actions: [
      { id: 'edit', label: 'Edit teacher', icon: 'settings', onClick: function (r) { edit(r.t); } },
      { id: 'selfedit', label: 'Allow or block profile editing', icon: 'eye', onClick: async function (r) { await S.update('teachers', r.id, { canEditProfile: !r.selfEdit }); A.log('update', 'teacher', (r.selfEdit ? 'Blocked' : 'Allowed') + ' profile editing for ' + r.name); U.toast(r.name + (r.selfEdit ? ' can no longer edit their profile' : ' can now edit their own profile'), 'success'); refresh(); } },
      { id: 'assign', label: 'Assign classes', icon: 'assignments', onClick: function (r) { location.href = 'assignments.html?teacher=' + r.id; } },
      { id: 'pw', label: 'Reset password', icon: 'key', onClick: function (r) { resetPw(r.t); } },
      { id: 'toggle', label: 'Activate or deactivate', icon: 'user', onClick: function (r) { toggle(r.t); } },
      { id: 'del', label: 'Delete teacher', icon: 'x', danger: true, onClick: function (r) { del(r.t); } }
    ],
    empty: { icon: 'teachers', title: 'No teachers yet', message: 'Use Add teacher to create the first one.' }
  });
  var q = new URLSearchParams(location.search).get('q');
  if (q) { var qi = document.querySelector('[data-q]'); qi.value = q; qi.dispatchEvent(new Event('input', { bubbles: true })); }
  async function refresh() { await fetchAll(); tbl.setRows(rows(), true); }

  async function edit(t) {
    var fields = [
      { name: 'name', label: 'Full name', required: true, full: true },
      { name: 'email', label: 'Email (login)', type: 'email', required: true },
      { name: 'phone', label: 'Phone', type: 'tel', placeholder: '+92 300 1234567' },
      { name: 'qualification', label: 'Qualification' },
      { name: 'joiningDate', label: 'Joining date', type: 'date' },
      { name: 'baseSalary', label: 'Base salary (Rs)', type: 'number', min: 0, step: 500, required: true },
      { name: 'canEditProfile', label: 'Allow this teacher to edit their own profile (name, phone, qualification)', type: 'checkbox' }
    ];
    if (!t) fields.push({ name: 'password', label: 'Login password', type: 'text', value: 'teacher123', required: true, hint: 'At least 6 characters. The teacher can change it after login.' });
    var v = await U.form({
      title: t ? 'Edit teacher' : 'Add teacher', value: t || {}, fields: fields, size: 'wide',
      validate: function (x) {
        if (d.users.some(function (u) { return u.email.toLowerCase() === x.email.toLowerCase() && (!t || u.teacherId !== t.id); })) return { field: 'email', message: 'Another account already uses this email.' };
        if (!t && x.password.length < 6) return { field: 'password', message: 'Password must be at least 6 characters.' };
        if (x.phone && !ED.data.phoneOk(x.phone)) return { field: 'phone', message: 'Enter a valid phone number.' };
        return null;
      }
    });
    if (!v) return;
    if (t) {
      await S.update('teachers', t.id, { name: v.name, email: v.email, phone: v.phone, qualification: v.qualification, joiningDate: v.joiningDate, baseSalary: v.baseSalary, canEditProfile: !!v.canEditProfile });
      var u = d.users.filter(function (x) { return x.teacherId === t.id; })[0];
      if (u) await S.update('users', u.id, { name: v.name, email: v.email });
      A.log('update', 'teacher', 'Updated teacher ' + v.name);
    } else {
      var row = await S.insert('teachers', { name: v.name, email: v.email, phone: v.phone, qualification: v.qualification, joiningDate: v.joiningDate, baseSalary: v.baseSalary, canEditProfile: !!v.canEditProfile, status: 'active' });
      await S.insert('users', { name: v.name, email: v.email, passwordHash: hash(v.password), role: 'teacher', teacherId: row.id, status: 'active' });
      A.log('create', 'teacher', 'Added teacher ' + v.name);
    }
    U.toast('Teacher saved', 'success'); refresh();
  }
  async function resetPw(t) {
    var v = await U.form({ title: 'Reset password for ' + t.name, submitLabel: 'Reset password', fields: [{ name: 'password', label: 'New password', required: true, value: 'teacher123', full: true, hint: 'At least 6 characters.' }], validate: function (x) { return x.password.length < 6 ? 'Password must be at least 6 characters.' : null; } });
    if (!v) return;
    var u = d.users.filter(function (x) { return x.teacherId === t.id; })[0];
    if (!u) return U.toast('This teacher has no login account.', 'danger');
    await S.update('users', u.id, { passwordHash: hash(v.password) }); A.log('update', 'teacher', 'Reset password for ' + t.name);
    U.toast('Password reset', 'success');
  }
  async function toggle(t) {
    var next = t.status === 'active' ? 'inactive' : 'active';
    await S.update('teachers', t.id, { status: next });
    var u = d.users.filter(function (x) { return x.teacherId === t.id; })[0];
    if (u) await S.update('users', u.id, { status: next });
    A.log('update', 'teacher', (next === 'active' ? 'Activated ' : 'Deactivated ') + t.name);
    U.toast(t.name + ' is now ' + next, 'success'); refresh();
  }
  async function del(t) {
    if (d.assignments.some(function (a) { return a.teacherId === t.id; })) return U.toast('Remove this teacher\'s assignments first.', 'danger');
    if (d.classes.some(function (c) { return c.classTeacherId === t.id; })) return U.toast('This teacher is a class teacher. Change that in Classes first.', 'danger');
    if (d.salaries.some(function (s) { return s.teacherId === t.id; })) return U.toast('Salary history exists. Deactivate the teacher instead of deleting.', 'danger');
    var ok = await U.confirm({ title: 'Delete ' + t.name + '?', message: 'Their login account will be deleted too.', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    await S.remove('teachers', t.id);
    S._writeList('users', S._readList('users').filter(function (u) { return u.teacherId !== t.id; }));
    A.log('delete', 'teacher', 'Deleted teacher ' + t.name); U.toast('Teacher deleted', 'success'); refresh();
  }
  document.getElementById('add').addEventListener('click', function () { edit(null); });
  if (new URLSearchParams(location.search).get('add')) edit(null);
})();
