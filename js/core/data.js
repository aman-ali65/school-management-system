/* Shared data helpers: settings, lookups, access context, audit log, grading, notifications. */
(function () {
  var S = ED.storage, F = ED.fmt;

  var DEFAULTS = {
    schoolName: 'EduDesk Public School', address: '', phone: '', activeSessionId: 'ses-2026',
    attendanceThreshold: 75, passPercent: 40, lateFinePerDay: 20, absentDeductionDivisor: 26, lateDeduction: 200,
    permissions: { teacherCanAddStudents: false, teacherCanPublish: false, teacherCanMessage: true },
    whatsapp: { displayName: '', about: '', signature: '', useSignature: false, countryCode: '+92', delaySeconds: 3 }
  };

  function settings() {
    return S.getObject('settings', {}).then(function (s) {
      return Object.assign({}, DEFAULTS, s, { permissions: Object.assign({}, DEFAULTS.permissions, s.permissions || {}), whatsapp: Object.assign({}, DEFAULTS.whatsapp, s.whatsapp || {}) });
    });
  }

  /* load(['students','classes']) -> { students:[...], classes:[...], map:{ students:{id:row}, ... } } */
  function load(cols) {
    return Promise.all(cols.map(function (c) { return S.getAll(c); })).then(function (res) {
      var out = { map: {} };
      cols.forEach(function (c, i) {
        out[c] = res[i];
        var m = {}; res[i].forEach(function (r) { m[r.id] = r; });
        out.map[c] = m;
      });
      return out;
    });
  }

  function initBatchMeta() {
    return Promise.all([settings(), S.getAll('sessions')]).then(function (r) {
      var names = {}; r[1].forEach(function (b) { names[b.id] = b.name; });
      F._batch = { active: r[0].activeSessionId, names: names };
      return F._batch;
    });
  }

  /* Who is logged in and what they may touch. A teacher only reaches the classes and subjects
     assigned to them in the CURRENT batch. The admin reaches every batch (pages offer a batch filter). */
  function context(session) {
    return Promise.all([settings(), S.getAll('classes'), S.getAll('assignments'), S.getAll('subjects'), S.getAll('sessions')]).then(function (r) {
      var st = r[0], classes = r[1], allAsg = r[2], subjects = r[3], batches = r[4];
      var isAdmin = session.role === 'admin', activeId = st.activeSessionId, names = {};
      batches.forEach(function (b) { names[b.id] = b.name; });
      F._batch = { active: activeId, names: names };
      var isCurrent = function (c) { return !c.sessionId || c.sessionId === activeId; };
      var current = {}; classes.forEach(function (c) { if (isCurrent(c)) current[c.id] = true; });
      var mine = isAdmin ? allAsg : allAsg.filter(function (a) { return a.teacherId === session.teacherId && current[a.classId]; });
      var ids = isAdmin ? classes.map(function (c) { return c.id; }) : mine.map(function (a) { return a.classId; }).filter(function (x, i, a) { return a.indexOf(x) === i; });
      var ownIds = isAdmin ? [] : classes.filter(function (c) { return c.classTeacherId === session.teacherId && isCurrent(c); }).map(function (c) { return c.id; });
      var viewIds = ids.concat(ownIds.filter(function (x) { return ids.indexOf(x) < 0; }));
      function byIds(list) { return classes.filter(function (c) { return list.indexOf(c.id) >= 0; }); }
      return {
        session: session, isAdmin: isAdmin, teacherId: session.teacherId, settings: st, activeId: activeId, batches: batches,
        classes: byIds(ids), allClasses: classes, currentClasses: classes.filter(isCurrent), subjects: subjects, assignments: mine, classIds: ids,
        viewClasses: byIds(viewIds), viewClassIds: viewIds,
        canAccess: function (classId) { return ids.indexOf(classId) >= 0; },
        canView: function (classId) { return viewIds.indexOf(classId) >= 0; },
        isClassTeacherOf: function (classId) { return ownIds.indexOf(classId) >= 0; },
        teachesSubject: function (classId, subjectId) { return isAdmin || mine.some(function (a) { return a.classId === classId && a.subjectId === subjectId; }); },
        subjectsFor: function (classId) {
          var seen = {};
          return mine.filter(function (a) { return a.classId === classId; }).map(function (a) { return a.subjectId; })
            .filter(function (id) { if (seen[id]) return false; seen[id] = 1; return true; })
            .map(function (id) { return subjects.filter(function (x) { return x.id === id; })[0]; }).filter(Boolean);
        }
      };
    });
  }

  /* ---------- batches (dynamic) and classes inside a batch ---------- */
  function normBatch(s) { return String(s || '').toLowerCase().replace(/\s+/g, ''); }
  function batchYear(s) { var m = String(s || '').match(/(19|20)\d{2}/); return m ? m[0] : ''; }
  /* Finds the batch with this name, or creates it. Asks first when a batch of the same year exists under another spelling. */
  function resolveBatch(name) {
    name = String(name || '').trim();
    if (!name) return Promise.resolve(null);
    return S.getAll('sessions').then(function (list) {
      var n = normBatch(name), exact = list.filter(function (b) { return normBatch(b.name) === n; })[0];
      if (exact) return exact;
      var y = batchYear(name), near = y ? list.filter(function (b) { return batchYear(b.name) === y; })[0] : null;
      function create() { return S.insert('sessions', { name: name, startDate: '', endDate: '', isActive: false }).then(function (b) { F._batch && (F._batch.names[b.id] = b.name); return b; }); }
      if (!near) return create();
      return ED.ui.modal({ title: 'Use the existing batch ' + near.name + '?', body: '<p>You typed <b>' + F.esc(name) + '</b>. A batch named <b>' + F.esc(near.name) + '</b> already exists for the same year.</p>',
        actions: [{ label: 'Cancel', variant: 'secondary', value: null }, { label: 'Create "' + name + '" as a new batch', variant: 'secondary', value: 'new' }, { label: 'Use ' + near.name, variant: 'primary', value: 'use' }] })
        .then(function (v) { if (v === 'use') return near; if (v === 'new') return create(); return undefined; });
    });
  }
  function parseClassLabel(label) {
    var t = String(label || '').trim(), m = t.match(/^(\d{1,2})\s*[-\s]?\s*([A-Za-z]\w*)$/) || t.match(/^([A-Za-z]+)\s*[-\s]\s*(\w+)$/);
    return m ? { name: m[1], section: m[2].toUpperCase() } : null;
  }
  /* Finds class "10-A" inside the batch, or creates it */
  function resolveClass(batchId, label) {
    var p = parseClassLabel(label);
    if (!p) return Promise.resolve(null);
    return S.getAll('classes').then(function (list) {
      var f = list.filter(function (c) { return c.sessionId === batchId && c.name.toLowerCase() === p.name.toLowerCase() && c.section.toLowerCase() === p.section.toLowerCase(); })[0];
      return f || S.insert('classes', { name: p.name, section: p.section, classTeacherId: '', sessionId: batchId });
    });
  }
  /* finds an existing child by B-form (exact) or by father CNIC (may be several siblings) */
  function lookupPerson(o) {
    return S.getAll('students').then(function (rows) {
      var by = {}; rows.forEach(function (r) { var k = r.personId || r.id; (by[k] = by[k] || []).push(r); });
      var persons = Object.keys(by).map(function (k) { return { personId: k, rows: by[k].sort(function (a, b) { return F.batchName(b.sessionId).localeCompare(F.batchName(a.sessionId)) || String(b.createdAt).localeCompare(String(a.createdAt)); }) }; });
      var b = F.digits(o.bForm), c = F.digits(o.fatherCnic);
      return {
        exact: b.length === 13 ? persons.filter(function (p) { return p.rows.some(function (r) { return F.digits(r.bForm) === b; }); })[0] || null : null,
        siblings: c.length === 13 ? persons.filter(function (p) { return p.rows.some(function (r) { return F.digits(r.fatherCnic) === c; }); }) : []
      };
    });
  }

  function log(action, entity, summary) {
    var s = ED.auth.session();
    return S.insert('auditLog', { userId: s ? s.userId : null, userName: s ? s.name : 'System', role: s ? s.role : '', action: action, entity: entity, summary: summary, at: new Date().toISOString() });
  }

  function gradeFor(percent, scale) {
    var sorted = scale.slice().sort(function (a, b) { return b.minPercent - a.minPercent; });
    for (var i = 0; i < sorted.length; i++) if (percent >= sorted[i].minPercent) return sorted[i].grade;
    return sorted.length ? sorted[sorted.length - 1].grade : '-';
  }

  /* attendance percentage: Present and Late count as attended, Leave is left out */
  function attPct(records) {
    var den = records.filter(function (a) { return a.status !== 'LV'; }).length;
    if (!den) return null;
    return records.filter(function (a) { return a.status === 'P' || a.status === 'L'; }).length / den * 100;
  }
  function isSunday(iso) { return F.dow(iso) === 0; }

  var GENERAL_ID = 'general';
  function subjectName(map, id) { return id === GENERAL_ID ? 'General' : (map[id] || {}).name || '(deleted)'; }

  /* Lessons scheduled on a date (from the timetable) that have no attendance yet.
     Returns [{ classId, subjectId, teacherId }] */
  function pendingLessons(date, timetable, attendance, holidays) {
    var dw = F.dow(date);
    if (dw === 0 || holidays.some(function (h) { return h.date === date; })) return [];
    var done = {}; attendance.forEach(function (a) { if (a.date === date) done[a.classId + '|' + a.subjectId] = 1; });
    var seen = {}, out = [];
    timetable.forEach(function (t) {
      var k = t.classId + '|' + t.subjectId;
      if (t.day !== dw || done[k] || seen[k]) return;
      seen[k] = 1; out.push({ classId: t.classId, subjectId: t.subjectId, teacherId: t.teacherId });
    });
    return out;
  }

  function invoiceBalance(inv) { return Math.max(0, inv.total - inv.paid); }
  function invoiceStatus(inv) { return inv.paid >= inv.total ? 'paid' : inv.paid > 0 ? 'partial' : 'unpaid'; }

  function phoneOk(p) { var d = String(p || '').replace(/\D/g, ''); return d.length >= 10 && d.length <= 15; }

  function classOptions(ctx) { return ctx.classes.map(function (c) { return { value: c.id, label: F.className(c) }; }); }

  /* bell notifications, relative links so they work from /admin and /teacher */
  function notifications(ctx) {
    var today = F.today();
    return load(['attendance', 'exams', 'feeInvoices', 'timetable', 'holidays', 'classes', 'subjects']).then(function (d) {
      var items = [];
      pendingLessons(today, d.timetable, d.attendance, d.holidays).forEach(function (l) {
        if (!ctx.isAdmin && l.teacherId !== ctx.teacherId) return;
        items.push({ icon: 'attendance', text: 'Attendance not marked: ' + F.className(d.map.classes[l.classId]) + ' ' + subjectName(d.map.subjects, l.subjectId), href: 'attendance.html?class=' + l.classId + '&subject=' + l.subjectId });
      });
      d.exams.forEach(function (e) {
        if (!ctx.canAccess(e.classId)) return;
        if (e.status === 'extracted') items.push({ icon: 'results', text: e.name + ' is waiting for verification', href: 'results.html#exam=' + e.id });
        else if (ctx.isAdmin && e.status === 'verified') items.push({ icon: 'results', text: e.name + ' is verified and ready to publish', href: 'results.html#exam=' + e.id });
      });
      if (ctx.isAdmin) {
        var late = d.feeInvoices.filter(function (i) { return i.dueDate < today && invoiceBalance(i) > 0; }).length;
        if (late) items.push({ icon: 'fees', text: late + ' fee invoices are overdue', href: 'fees.html' });
      }
      return items;
    });
  }

  window.ED = window.ED || {};
  ED.data = {
    initBatchMeta: initBatchMeta, resolveBatch: resolveBatch, resolveClass: resolveClass, parseClassLabel: parseClassLabel, lookupPerson: lookupPerson, normBatch: normBatch,
    DEFAULTS: DEFAULTS, settings: settings, load: load, context: context, gradeFor: gradeFor, attPct: attPct, isSunday: isSunday,
    invoiceBalance: invoiceBalance, GENERAL_ID: GENERAL_ID, subjectName: subjectName, pendingLessons: pendingLessons, invoiceStatus: invoiceStatus, phoneOk: phoneOk, classOptions: classOptions, notifications: notifications
  };
  ED.audit = { log: log };
})();
