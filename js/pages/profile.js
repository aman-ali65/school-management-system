(async function () {
  var session = await ED.shell.init({ role: 'teacher', active: 'profile' });
  if (!session) return;
  var S = ED.storage, F = ED.fmt, U = ED.ui, h = F.esc, A = ED.audit;
  var t = await S.getById('teachers', session.teacherId);
  var d = await ED.data.load(['classes', 'subjects', 'assignments']);
  if (!t) { document.getElementById('content').innerHTML = '<div class="card">' + U.empty('user', 'Profile not found', 'Ask the admin to check your account.') + '</div>'; return; }
  var mine = d.assignments.filter(function (a) { return a.teacherId === t.id; });
  var can = !!t.canEditProfile;

  function field(id, label, value, opts) {
    opts = opts || {};
    return '<div class="field"><label for="' + id + '">' + label + '</label><input class="input" id="' + id + '" value="' + h(value || '') + '"' + (can && !opts.locked ? '' : ' disabled') + (opts.type ? ' type="' + opts.type + '"' : '') + '></div>';
  }
  document.getElementById('content').innerHTML = U.pageHead('My profile', can ? 'You can update your own details here.' : 'Your details. Only the admin can change them.') +
    (can ? '' : '<div class="callout">' + ED.icons.svg('info', 18) + '<span>The admin has not allowed profile editing for your account. If something is wrong, ask the admin to correct it.</span></div>') +
    '<div class="grid-2"><section class="card card-pad stack"><h3>Personal details</h3>' + field('p-name', 'Full name', t.name) + field('p-phone', 'Phone', t.phone, { type: 'tel' }) + field('p-qual', 'Qualification', t.qualification) +
    field('p-email', 'Login email (admin only)', t.email, { locked: true }) + field('p-join', 'Joining date (admin only)', F.date(t.joiningDate), { locked: true }) +
    (can ? '<button type="button" class="btn btn-primary" id="p-save" style="align-self:flex-start">Save changes</button>' : '') + '</section>' +
    '<section class="card card-pad stack"><h3>My classes and subjects</h3>' + (mine.length ? '<ul class="list">' + mine.map(function (a) { return '<li class="list-item"><div class="list-title">Class ' + h(F.className(d.map.classes[a.classId])) + '</div>' + U.badge((d.map.subjects[a.subjectId] || {}).name || '-', 'primary') + '</li>'; }).join('') + '</ul>' : U.empty('classes', 'Nothing assigned yet', 'The admin assigns your classes and subjects.')) + '</section></div>';

  var save = document.getElementById('p-save');
  if (save) save.addEventListener('click', async function () {
    var name = document.getElementById('p-name').value.trim(), phone = document.getElementById('p-phone').value.trim();
    if (!name) return U.toast('Name is required.', 'danger');
    if (phone && !ED.data.phoneOk(phone)) return U.toast('Enter a valid phone number.', 'danger');
    await S.update('teachers', t.id, { name: name, phone: phone, qualification: document.getElementById('p-qual').value.trim() });
    var u = (await S.getAll('users')).filter(function (x) { return x.teacherId === t.id; })[0]; if (u) await S.update('users', u.id, { name: name });
    var sess = JSON.parse(localStorage.getItem('edudesk:session')); sess.name = name; localStorage.setItem('edudesk:session', JSON.stringify(sess));
    A.log('update', 'teacher', name + ' updated their own profile'); U.toast('Profile saved', 'success');
  });
})();
