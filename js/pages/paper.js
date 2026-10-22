/* Public page a parent opens from the link. No login. DEMO: reads this browser's storage. */
(async function () {
  var S = ED.storage, F = ED.fmt, U = ED.ui, I = ED.icons, h = F.esc;
  await ED.seed.ensure(); await ED.data.initBatchMeta();
  var content = document.getElementById('content');
  var tok = new URLSearchParams(location.search).get('t');
  function note(title, msg) { content.innerHTML = '<div class="card card-pad">' + U.empty('info', title, msg) + '</div>'; }
  var scan = tok ? S._readList('paperScans').filter(function (x) { return x.token === tok; })[0] : null;
  if (!scan || scan.revoked) return note('This link is not active', 'It may have been switched off by the school, or the address is incomplete. Please contact the school.');
  var d = await ED.papers.details(scan);
  if (!d) return note('This paper is no longer available', 'Please contact the school.');
  if (!d.published) return note('The result is not published yet', 'The school will publish it soon. Please open this link again later.');
  var pages = await ED.papers.pagesOf(scan);
  var res = d.absent ? '<span class="badge badge-absent">Absent</span>' : d.marks === null ? '<span class="muted">Marks not entered</span>' : '<span style="font-size:24px;font-weight:500">' + d.marks + ' / ' + d.exam.totalMarks + '</span> ' + U.badge(F.pct(d.pct) + ' | Grade ' + d.grade, d.pct >= d.school.passPercent ? 'present' : 'absent');
  document.title = d.student.name + ' | ' + d.exam.name;
  content.innerHTML =
    '<div class="card card-pad stack"><div class="row" style="gap:12px"><span class="sb-logo">' + I.svg('school', 18) + '</span><div><div style="font-weight:500">' + h(d.school.schoolName) + '</div><div class="small muted">Your child\'s paper</div></div></div></div>' +
    '<div class="card card-pad stack"><div class="row" style="gap:12px">' + U.avatar(d.student.name) + '<div><div style="font-size:18px;font-weight:500">' + h(d.student.name) + '</div><div class="small muted">Class ' + h(F.className(d.cls)) + ' | Roll no ' + h(d.student.rollNo) + '</div></div></div>' +
    '<div class="small muted">' + h(d.subject) + ' | ' + h(d.exam.name) + ' | ' + F.date(d.exam.date) + '</div><div>' + res + '</div>' + (scan.remark ? '<div class="callout">' + I.svg('info', 18) + '<span><b>Teacher\'s remark:</b> ' + h(scan.remark) + '</span></div>' : '') + '</div>' +
    (pages.length ? pages.map(function (u, i) { return '<div class="card card-pad stack"><div class="row-between"><span class="small muted">Page ' + (i + 1) + ' of ' + pages.length + '</span><a class="btn btn-secondary btn-sm" download="paper-page-' + (i + 1) + '.jpg" href="' + u + '">Save image</a></div><img class="paper-img" data-i="' + i + '" alt="Paper page ' + (i + 1) + '" src="' + u + '"></div>'; }).join('') : '<div class="card card-pad">' + U.empty('inbox', 'No pictures were added', 'The school has not uploaded the paper pages.') + '</div>') +
    '<p class="small muted" style="text-align:center">Tap a page to see it bigger. This is a private link meant only for this child\'s family.</p>';
  content.addEventListener('click', function (e) {
    var im = e.target.closest('.paper-img'); if (!im) return;
    var lb = document.createElement('div'); lb.className = 'lightbox'; lb.innerHTML = '<button type="button" class="btn btn-secondary btn-sm" aria-label="Close">Close</button><div class="lb-scroll"><img alt="Paper, larger" src="' + im.src + '"></div>';
    function close() { lb.remove(); document.removeEventListener('keydown', onKey); } function onKey(ev) { if (ev.key === 'Escape') close(); }
    lb.querySelector('button').addEventListener('click', close); document.addEventListener('keydown', onKey); document.body.appendChild(lb); lb.querySelector('button').focus();
  });
})();
