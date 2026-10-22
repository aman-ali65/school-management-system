(async function () {
  var role = document.body.dataset.role;
  var session = await ED.shell.init({ role: role, active: 'announcements' });
  if (!session) return;
  var S = ED.storage, F = ED.fmt, U = ED.ui, I = ED.icons, h = F.esc, A = ED.audit, D = ED.data;
  var ctx = await D.context(session);
  var canMsg = ctx.isAdmin || ctx.settings.permissions.teacherCanMessage;
  var d;
  async function fetchAll() { d = await D.load(['announcements', 'students', 'classes']); }
  await fetchAll();

  document.getElementById('content').innerHTML = U.pageHead('Announcements', ctx.isAdmin ? 'Notices for teachers, or for the parents of a class.' : 'Notices from the admin and for your classes.', U.btn('New announcement', { variant: 'primary', icon: 'plus', id: 'new' })) + '<div id="list" class="stack"></div>';

  function visible() { return d.announcements.filter(function (a) { return ctx.isAdmin || a.audience === 'all' || ctx.canAccess(a.audience); }).sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); }); }
  function audienceLabel(a) { return a === 'all' ? 'Everyone' : 'Class ' + F.className(d.map.classes[a]); }
  function paint() {
    var list = visible();
    document.getElementById('list').innerHTML = list.length ? list.map(function (a) {
      var mine = ctx.isAdmin || a.createdBy === session.userId;
      return '<article class="card announce"><div class="row-between"><h3>' + h(a.title) + '</h3><div class="row">' + U.badge(audienceLabel(a.audience), 'primary') + '</div></div><p>' + h(a.body) + '</p><div class="row-between"><span class="small muted">' + h(a.createdByName) + ' | ' + F.date(a.createdAt) + ' ' + F.time(a.createdAt) + '</span><div class="row">' +
        (canMsg ? '<button type="button" class="btn btn-whatsapp btn-sm" data-wa="' + a.id + '">' + I.svg('whatsapp', 16) + 'Send to parents</button>' : '') + (mine ? '<button type="button" class="btn btn-ghost btn-sm" data-edit="' + a.id + '">Edit</button><button type="button" class="btn btn-danger btn-sm" data-del="' + a.id + '">Delete</button>' : '') + '</div></div></article>';
    }).join('') : '<div class="card">' + U.empty('announce', 'No announcements yet', 'Use New announcement to post one.') + '</div>';
  }
  async function edit(a) {
    var opts = (ctx.isAdmin ? [{ value: 'all', label: 'Everyone' }] : []).concat(ctx.classes.filter(function (c) { return !ctx.isAdmin || c.sessionId === ctx.activeId; }).map(function (c) { return { value: c.id, label: 'Class ' + F.className(c) }; }));
    var v = await U.form({ title: a ? 'Edit announcement' : 'New announcement', size: 'wide', value: a || { audience: opts[0] ? opts[0].value : '' }, fields: [{ name: 'title', label: 'Title', required: true, full: true }, { name: 'audience', label: 'Audience', type: 'select', required: true, options: opts, full: true }, { name: 'body', label: 'Message', type: 'textarea', required: true }] });
    if (!v) return;
    if (a) await S.update('announcements', a.id, v); else await S.insert('announcements', Object.assign({ createdBy: session.userId, createdByName: session.name, createdAt: new Date().toISOString() }, v));
    A.log(a ? 'update' : 'create', 'announcement', (a ? 'Edited' : 'Posted') + ' announcement "' + v.title + '"'); U.toast('Announcement saved', 'success'); await fetchAll(); paint();
  }
  document.getElementById('new').addEventListener('click', function () { edit(null); });
  document.getElementById('list').addEventListener('click', async function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.edit) return edit(d.map.announcements[b.dataset.edit]);
    if (b.dataset.del) { var a = d.map.announcements[b.dataset.del], ok = await U.confirm({ title: 'Delete "' + a.title + '"?', message: 'This cannot be undone.', confirmLabel: 'Delete', danger: true }); if (!ok) return; await S.remove('announcements', a.id); A.log('delete', 'announcement', 'Deleted announcement "' + a.title + '"'); U.toast('Announcement deleted', 'success'); await fetchAll(); return paint(); }
    if (b.dataset.wa) {
      var an = d.map.announcements[b.dataset.wa];
      var studs = d.students.filter(function (s) { return s.status === 'active' && (an.audience === 'all' ? ctx.canAccess(s.classId) : s.classId === an.audience) && ctx.canAccess(s.classId); });
      ED.wa.openModal({ students: studs, type: 'custom', title: 'Send to parents: ' + an.title, text: 'Assalam o Alaikum {parent}, ' + an.title + ': ' + an.body + ' - {school}' });
    }
  });
  paint();
  if (new URLSearchParams(location.search).get('new')) edit(null);
})();
