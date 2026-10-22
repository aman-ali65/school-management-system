/* Student answer papers: stored page by page in IndexedDB, described by a "paperScans" record.
   Each exam + student has one private link token. DEMO: the parent page reads from this browser's storage.
   With a backend the same token would be looked up on the server, so the link works on any phone. */
(function () {
  var S = ED.storage, F = ED.fmt, h = F.esc;

  function token() {
    var a = new Uint8Array(16);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.floor(Math.random() * 256); });
    return Array.prototype.map.call(a, function (b) { return b.toString(36).padStart(2, '0'); }).join('').slice(0, 24);
  }
  function find(examId, studentId) { return S._readList('paperScans').filter(function (x) { return x.examId === examId && x.studentId === studentId; })[0] || null; }
  function link(tok) { return new URL((document.body.dataset.root || '') + 'paper.html?t=' + tok, location.href).href; }

  function ensure(examId, studentId) {
    var cur = find(examId, studentId); if (cur) return Promise.resolve(cur);
    var s = ED.auth.session();
    return S.insert('paperScans', { examId: examId, studentId: studentId, pages: [], remark: '', token: token(), revoked: false, uploadedBy: s ? s.name : '', uploadedAt: new Date().toISOString() });
  }
  /* stores every file at once, compressed. Returns the updated scan. */
  async function addPages(examId, studentId, files) {
    var scan = await ensure(examId, studentId), ids = scan.pages.slice();
    for (var i = 0; i < files.length; i++) {
      var url = await ED.ui.compressImage(files[i], 1400, 0.7), id = 'paper-' + scan.id + '-' + Date.now().toString(36) + i;
      await ED.blobs.put(id, url); ids.push(id);
    }
    return S.update('paperScans', scan.id, { pages: ids, uploadedAt: new Date().toISOString() });
  }
  async function removePage(scan, blobId) {
    await ED.blobs.del(blobId);
    return S.update('paperScans', scan.id, { pages: scan.pages.filter(function (x) { return x !== blobId; }) });
  }
  async function removeAll(scan) { try { await ED.blobs.delMany(scan.pages); } catch (e) {} await S.remove('paperScans', scan.id); }
  async function pagesOf(scan) { var out = []; for (var i = 0; i < scan.pages.length; i++) { var u = await ED.blobs.get(scan.pages[i]); if (u) out.push(u); } return out; }

  /* everything the parent page (and the download file) needs */
  async function details(scan) {
    var x = await ED.data.load(['exams', 'students', 'classes', 'subjects', 'marks', 'gradingScale']), st = await ED.data.settings();
    var exam = x.map.exams[scan.examId], stu = x.map.students[scan.studentId]; if (!exam || !stu) return null;
    var m = x.marks.filter(function (z) { return z.examId === exam.id && z.studentId === stu.id; })[0];
    var pct = m && !m.absent && m.marks !== null ? m.marks / exam.totalMarks * 100 : null;
    return { scan: scan, exam: exam, student: stu, cls: x.map.classes[stu.classId], subject: (x.map.subjects[exam.subjectId] || {}).name || '-', school: st, published: exam.status === 'published',
      marks: m ? m.marks : null, absent: !!(m && m.absent), pct: pct, grade: pct === null ? '' : ED.data.gradeFor(pct, x.gradingScale) };
  }
  /* one self-contained HTML file (images inside) that can be attached in WhatsApp */
  async function sheetHTML(scan) {
    var d = await details(scan), pages = await pagesOf(scan); if (!d) return '';
    var res = d.absent ? 'Absent' : d.marks === null ? 'Not entered' : d.marks + ' / ' + d.exam.totalMarks + ' (' + F.pct(d.pct) + ', grade ' + d.grade + ')';
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + h(d.student.name) + ' - ' + h(d.exam.name) + '</title><style>body{font-family:Arial,sans-serif;margin:0;background:#f4f5f7;color:#111}main{max-width:760px;margin:0 auto;padding:16px}.c{background:#fff;border:1px solid #ddd;border-radius:12px;padding:14px;margin-bottom:12px}h1{font-size:20px;margin:0}img{width:100%;border:1px solid #ccc;border-radius:8px;margin-top:10px}.m{color:#555}</style></head><body><main>' +
      '<div class="c"><h1>' + h(d.school.schoolName) + '</h1><div class="m">Student paper</div></div>' +
      '<div class="c"><b>' + h(d.student.name) + '</b><div class="m">Class ' + h(F.className(d.cls)) + ' | Roll ' + h(d.student.rollNo) + '</div><p>' + h(d.subject) + ' | ' + h(d.exam.name) + ' | ' + F.date(d.exam.date) + '</p><p><b>Marks: ' + h(res) + '</b></p>' + (d.scan.remark ? '<p>Teacher remark: ' + h(d.scan.remark) + '</p>' : '') + '</div>' +
      pages.map(function (u, i) { return '<div class="c"><div class="m">Page ' + (i + 1) + ' of ' + pages.length + '</div><img alt="Paper page ' + (i + 1) + '" src="' + u + '"></div>'; }).join('') + '</main></body></html>';
  }

  window.ED = window.ED || {};
  ED.papers = { find: find, ensure: ensure, link: link, addPages: addPages, removePage: removePage, removeAll: removeAll, pagesOf: pagesOf, details: details, sheetHTML: sheetHTML };
})();
