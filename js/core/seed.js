/* Demo data so every screen has something to show.
   Logins:  admin@edudesk.pk / admin123     teacher@edudesk.pk / teacher123

   Model: every row in "students" is an ENROLLMENT (one child in one batch and one class).
   The same child in two batches has two rows with the same personId, so nothing is lost when a child moves up. */
(function () {
  var VERSION = '4';
  var FLAG = 'edudesk:seeded';

  var NAMES = [
    'Ali Raza', 'Sara Khan', 'Hamza Ali', 'Zainab Noor', 'Usman Tariq', 'Hira Fatima', 'Ahmed Bilal', 'Maryam Iqbal',
    'Danish Ahmad', 'Areeba Shah', 'Faizan Malik', 'Noor Fatima', 'Talha Mehmood', 'Iqra Aslam', 'Saad Hussain', 'Laiba Zahid',
    'Rayyan Javed', 'Mehak Siddiqui', 'Hassan Raza', 'Anum Tahir', 'Shayan Butt', 'Rida Naveed', 'Owais Qureshi', 'Eman Farooq',
    'Bilal Sheikh', 'Amna Yousaf', 'Kamran Akbar', 'Sidra Bashir', 'Waqas Hameed', 'Nimra Ejaz', 'Arslan Gul', 'Fiza Rehman'
  ];

  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function build() {
    var S = ED.storage, F = ED.fmt, hash = ED.auth.hash, R = rng(2026);
    var today = F.today(), thisMonth = F.monthKey(today), lastMonth = F.prevMonth(thisMonth);
    var nowIso = new Date().toISOString();
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    var data = {};
    function put(col, arr) { data[col] = arr.map(function (r) { return Object.assign({ createdAt: nowIso, updatedAt: nowIso }, r); }); }

    /* ---- batches (dynamic list; the newest running one is "current") ---- */
    put('sessions', [{ id: 'ses-2025', name: '2025', startDate: '', endDate: '', isActive: false }, { id: 'ses-2026', name: '2026', startDate: '', endDate: '', isActive: true }]);
    var subjects = ['English', 'Urdu', 'Mathematics', 'Physics', 'Chemistry', 'Computer Science', 'Islamiat'];
    put('subjects', subjects.map(function (n, i) { return { id: 'sub-' + (i + 1), name: n, code: n.slice(0, 3).toUpperCase() }; }));
    var teachers = [
      { id: 'tch-1', name: 'Bilal Ahmed', phone: '+92 300 1111111', email: 'teacher@edudesk.pk', qualification: 'MSc Mathematics', joiningDate: '2022-08-01', baseSalary: 60000, status: 'active' },
      { id: 'tch-2', name: 'Ayesha Malik', phone: '+92 300 2222222', email: 'ayesha@edudesk.pk', qualification: 'MA English', joiningDate: '2021-04-15', baseSalary: 55000, status: 'active' },
      { id: 'tch-3', name: 'Sana Rauf', phone: '+92 300 3333333', email: 'sana@edudesk.pk', qualification: 'BS Computer Science', joiningDate: '2023-01-10', baseSalary: 58000, status: 'active' }
    ];
    put('teachers', teachers.map(function (t, i) { return Object.assign({ canEditProfile: i === 1 }, t); }));

    var classes26 = [
      { id: 'cls-9a', name: '9', section: 'A', classTeacherId: 'tch-1', sessionId: 'ses-2026' },
      { id: 'cls-9b', name: '9', section: 'B', classTeacherId: 'tch-2', sessionId: 'ses-2026' },
      { id: 'cls-10a', name: '10', section: 'A', classTeacherId: 'tch-3', sessionId: 'ses-2026' }
    ];
    var classes25 = [
      { id: 'cls25-9a', name: '9', section: 'A', classTeacherId: 'tch-1', sessionId: 'ses-2025' },
      { id: 'cls25-9b', name: '9', section: 'B', classTeacherId: 'tch-2', sessionId: 'ses-2025' }
    ];
    var classes = classes25.concat(classes26);
    put('classes', classes);

    var mkAsg = function (list, prefix, ses) { return list.map(function (a, i) { return { id: prefix + (i + 1), teacherId: a[0], classId: a[1], subjectId: a[2], sessionId: ses }; }); };
    var asg26 = mkAsg([
      ['tch-1', 'cls-9a', 'sub-3'], ['tch-1', 'cls-9b', 'sub-3'], ['tch-1', 'cls-9a', 'sub-4'], ['tch-1', 'cls-10a', 'sub-4'],
      ['tch-2', 'cls-9a', 'sub-1'], ['tch-2', 'cls-9b', 'sub-1'], ['tch-2', 'cls-10a', 'sub-1'],
      ['tch-3', 'cls-9a', 'sub-6'], ['tch-3', 'cls-10a', 'sub-6'], ['tch-3', 'cls-9b', 'sub-5']
    ], 'asg-', 'ses-2026');
    var asg25 = mkAsg([['tch-1', 'cls25-9a', 'sub-3'], ['tch-1', 'cls25-9b', 'sub-3'], ['tch-2', 'cls25-9a', 'sub-1'], ['tch-2', 'cls25-9b', 'sub-1']], 'asg25-', 'ses-2025');
    put('assignments', asg25.concat(asg26));
    put('users', [
      { id: 'usr-admin', name: 'School Admin', email: 'admin@edudesk.pk', passwordHash: hash('admin123'), role: 'admin', status: 'active' }
    ].concat(teachers.map(function (t, i) { return { id: 'usr-' + (i + 1), name: t.name, email: t.email, passwordHash: hash('teacher123'), role: 'teacher', teacherId: t.id, status: 'active' }; })));
    put('feePlans', [{ id: 'fp-0', name: 'Standard', discountPercent: 0 }, { id: 'fp-1', name: 'Sibling concession', discountPercent: 10 }, { id: 'fp-2', name: 'Scholarship', discountPercent: 25 }]);

    /* ---- children (persons) and their enrollments ---- */
    var persons = NAMES.map(function (nm, i) {
      var n = i + 1;
      return { personId: 'per-' + n, name: nm, gender: n % 2 ? 'male' : 'female', parentName: 'Mr. ' + nm.split(' ')[1],
        fatherCnic: '35202-' + String(1000000 + n * 7919).slice(0, 7) + '-' + (n % 9 + 1), bForm: n % 3 === 0 ? '' : '35202-' + String(2000000 + n * 104729).slice(0, 7) + '-' + (n % 9 + 1),
        parentWhatsapp: '+92 3' + (10 + n) + ' 55' + String(1000 + n * 7), dob: (2010 - (n > 16 ? 1 : 0)) + '-' + pad(1 + (n % 12)) + '-' + pad(1 + (n % 27)), address: 'House ' + (10 + n) + ', Model Town, Lahore',
        feePlanId: n === 3 ? 'fp-1' : n === 10 ? 'fp-2' : 'fp-0' };
    });
    function enroll(id, p, classId, sessionId, roll) {
      return Object.assign({}, p, { id: id, classId: classId, sessionId: sessionId, rollNo: pad(roll), status: 'active', admissionDate: sessionId === 'ses-2025' ? '2025-04-01' : '2026-04-01' });
    }
    var students26 = [], students25 = [];
    for (var i = 0; i < 8; i++) {
      students26.push(enroll('stu-' + (i + 1), persons[i], 'cls-9a', 'ses-2026', i + 1));              /* new admissions, 9-A */
      students26.push(enroll('stu-' + (i + 9), persons[i + 8], 'cls-9b', 'ses-2026', i + 1));          /* new admissions, 9-B */
      students26.push(enroll('stu-' + (i + 17), persons[i + 16], 'cls-10a', 'ses-2026', i + 1));       /* moved up from 9-A (2025) */
      students25.push(enroll('stu25-' + (i + 1), persons[i + 16], 'cls25-9a', 'ses-2025', i + 1));     /* same children in 2025 */
      students25.push(enroll('stu25-' + (i + 9), persons[i + 24], 'cls25-9b', 'ses-2025', i + 1));     /* left after 2025 */
    }
    students26.sort(function (a, b) { return Number(a.id.slice(4)) - Number(b.id.slice(4)); });
    var students = students25.concat(students26);
    put('students', students);

    /* ---- timetable (2026, Mon-Fri, periods 1-6, no teacher clashes) ---- */
    var tt = [], busy = {}, tid = 0;
    for (var day = 1; day <= 5; day++) {
      for (var p = 1; p <= 6; p++) {
        classes26.forEach(function (c, ci) {
          var mine = asg26.filter(function (a) { return a.classId === c.id; });
          for (var k = 0; k < mine.length; k++) {
            var a = mine[(day + p + ci + k) % mine.length], key = day + '-' + p + '-' + a.teacherId;
            if (busy[key]) continue;
            busy[key] = 1;
            tt.push({ id: 'tt-' + (++tid), classId: c.id, day: day, period: p, subjectId: a.subjectId, teacherId: a.teacherId });
            break;
          }
        });
      }
    }
    put('timetable', tt);

    /* ---- attendance: subject-wise. 2026 = last 20 days, 2025 = a few days of history ---- */
    var att = [], tatt = [], aid = 0, subjOfDay = {}, dayRoll = {};
    tt.forEach(function (t) { var k = t.classId + '|' + t.day; subjOfDay[k] = subjOfDay[k] || {}; if (!subjOfDay[k][t.subjectId]) subjOfDay[k][t.subjectId] = t.teacherId; });
    var tById = {}; teachers.forEach(function (t) { tById[t.id] = t; });
    for (var d = 19; d >= 0; d--) {
      var date = F.addDays(today, -d), dw = F.dow(date);
      if (dw === 0) continue;
      classes26.forEach(function (c) {
        var subs = subjOfDay[c.id + '|' + dw], ids = subs ? Object.keys(subs) : [];
        if (d === 0) ids = c.id === 'cls-10a' ? [] : ids.slice(0, 1);
        ids.forEach(function (sid, idx) {
          students26.filter(function (s) { return s.classId === c.id; }).forEach(function (s) {
            var rk = s.id + date; if (dayRoll[rk] === undefined) dayRoll[rk] = R();
            var r = dayRoll[rk], code = r < 0.86 ? 'P' : r < 0.93 ? 'A' : r < 0.98 ? (idx === 0 ? 'L' : 'P') : 'LV';
            att.push({ id: 'att-' + (++aid), date: date, classId: c.id, subjectId: sid, studentId: s.id, status: code, markedBy: subs[sid], markedByName: tById[subs[sid]].name, markedAt: date + 'T0' + (8 + idx) + ':30:00.000Z' });
          });
        });
      });
      teachers.forEach(function (t) { var r = R(); tatt.push({ id: 'tat-' + date + '-' + t.id, date: date, teacherId: t.id, status: r < 0.92 ? 'P' : r < 0.96 ? 'A' : 'L' }); });
    }
    for (var h = 0; h < 8; h++) {                       /* 2025 history, about a year ago */
      var hd = F.addDays(today, -340 + h); if (F.dow(hd) === 0) continue;
      asg25.forEach(function (a, ai) {
        students25.filter(function (s) { return s.classId === a.classId; }).forEach(function (s) {
          var r = R(), code = r < 0.82 ? 'P' : r < 0.92 ? 'A' : r < 0.97 ? 'L' : 'LV';
          att.push({ id: 'att-' + (++aid), date: hd, classId: a.classId, subjectId: a.subjectId, studentId: s.id, status: code, markedBy: a.teacherId, markedByName: tById[a.teacherId].name, markedAt: hd + 'T0' + (8 + ai % 2) + ':30:00.000Z' });
        });
      });
    }
    put('attendance', att);
    put('teacherAttendance', tatt);
    put('holidays', [{ id: 'hol-1', date: F.addDays(today, 10), title: 'School event day' }]);

    /* ---- exams and marks ---- */
    var exams = [], marks = [], mid = 0, ability = {};
    persons.forEach(function (p) { ability[p.personId] = 0.5 + R() * 0.42; });
    function addExam(ex, studs) {
      exams.push(ex);
      studs.forEach(function (s) {
        var pct = Math.max(0.2, Math.min(1, ability[s.personId] + (R() - 0.5) * 0.25)), absent = R() < 0.03;
        marks.push({ id: 'mrk-' + (++mid), examId: ex.id, studentId: s.id, marks: absent ? null : Math.round(ex.totalMarks * pct), absent: absent, source: 'manual', confidence: null });
      });
    }
    asg26.forEach(function (a, i) { addExam({ id: 'exm-' + (i + 1), name: 'Mid-term', type: 'mid', classId: a.classId, subjectId: a.subjectId, totalMarks: 50, date: F.addDays(today, -21), status: 'published', createdBy: a.teacherId }, students26.filter(function (s) { return s.classId === a.classId; })); });
    asg25.forEach(function (a, i) { addExam({ id: 'exm25-' + (i + 1), name: 'Final Term', type: 'final', classId: a.classId, subjectId: a.subjectId, totalMarks: 100, date: F.addDays(today, -300), status: 'published', createdBy: a.teacherId }, students25.filter(function (s) { return s.classId === a.classId; })); });
    exams.push({ id: 'exm-q2', name: 'Quiz 2', type: 'quiz', classId: 'cls-9a', subjectId: 'sub-3', totalMarks: 20, date: F.addDays(today, -2), status: 'pending', createdBy: 'tch-1' });
    exams.push({ id: 'exm-q3', name: 'Quiz 3', type: 'quiz', classId: 'cls-9a', subjectId: 'sub-4', totalMarks: 20, date: F.addDays(today, -1), status: 'extracted', createdBy: 'tch-1' });
    students26.filter(function (s) { return s.classId === 'cls-9a'; }).forEach(function (s) {
      var conf = 0.55 + R() * 0.44;
      marks.push({ id: 'mrk-' + (++mid), examId: 'exm-q3', studentId: s.id, marks: conf < 0.6 ? null : Math.round(20 * (0.4 + R() * 0.55)), absent: false, source: 'ocr', confidence: Math.round(conf * 100) / 100 });
    });
    put('exams', exams);
    put('marks', marks);
    put('examImages', []);
    put('paperScans', []);
    var scale = [['A+', 90, 'Outstanding'], ['A', 80, 'Excellent'], ['B', 70, 'Very good'], ['C', 60, 'Good'], ['D', 50, 'Satisfactory'], ['E', 40, 'Pass'], ['F', 0, 'Fail']];
    put('gradingScale', scale.map(function (g, i) { return { id: 'gr-' + (i + 1), grade: g[0], minPercent: g[1], remarks: g[2] }; }));

    /* ---- fees ---- */
    var heads = [];
    classes.forEach(function (c) {
      var big = c.name === '10';
      heads.push({ id: 'fs-' + c.id + '-1', classId: c.id, headName: 'Tuition fee', amount: big ? 3500 : 3000, frequency: 'monthly' });
      heads.push({ id: 'fs-' + c.id + '-2', classId: c.id, headName: 'Computer lab', amount: 300, frequency: 'monthly' });
      heads.push({ id: 'fs-' + c.id + '-3', classId: c.id, headName: 'Exam fund', amount: 200, frequency: 'monthly' });
    });
    put('feeStructures', heads);
    var plans = { 'fp-0': 0, 'fp-1': 10, 'fp-2': 25 }, invoices = [], payments = [], iid = 0, pid = 0, methods = ['Cash', 'Bank transfer', 'JazzCash', 'Easypaisa'];
    function invoice(s, month, paid, due) {
      var items = heads.filter(function (x) { return x.classId === s.classId && x.frequency === 'monthly'; }).map(function (x) { return { head: x.headName, amount: x.amount }; });
      var gross = items.reduce(function (a, b) { return a + b.amount; }, 0), disc = Math.round(gross * plans[s.feePlanId] / 100), total = gross - disc;
      if (paid === 'all') paid = total;
      var inv = { id: 'inv-' + (++iid), studentId: s.id, month: month, items: items, gross: gross, discount: disc, fine: 0, total: total, paid: paid, dueDate: due || month + '-10', status: paid >= total ? 'paid' : paid > 0 ? 'partial' : 'unpaid' };
      invoices.push(inv);
      if (paid > 0) payments.push({ id: 'pay-' + (++pid), invoiceId: inv.id, studentId: s.id, amount: paid, method: methods[pid % 4], date: month + '-' + pad(2 + (pid % 8)), receivedBy: 'School Admin', receiptNo: 'RC-' + String(1000 + pid) });
    }
    [[lastMonth, 0.7, 0.15], [thisMonth, 0.4, 0.1]].forEach(function (mm) {
      students26.forEach(function (s) {
        var items = heads.filter(function (h) { return h.classId === s.classId && h.frequency === 'monthly'; }), total = items.reduce(function (a, b) { return a + b.amount; }, 0) * (1 - plans[s.feePlanId] / 100);
        var r = R(); invoice(s, mm[0], r < mm[1] ? 'all' : r < mm[1] + mm[2] ? Math.round(total / 2 / 100) * 100 : 0);
      });
    });
    var oldMonth = F.monthKey(F.addDays(today, -240));    /* dues that stayed unpaid from the 2025 batch */
    invoice(students25[0], oldMonth, 0); invoice(students25[2], oldMonth, 1500); invoice(students25[4], oldMonth, 0);
    put('feeInvoices', invoices);
    put('feePayments', payments);

    /* ---- salary ---- */
    put('advances', [{ id: 'adv-1', teacherId: 'tch-3', amount: 10000, monthlyCut: 2500, balance: 7500, date: F.addDays(today, -60) }]);
    put('salaries', teachers.map(function (t, i) {
      var allow = i === 0 ? 3000 : 0, adv = i === 2 ? 2500 : 0;
      return { id: 'sal-' + (i + 1), teacherId: t.id, month: lastMonth, base: t.baseSalary, allowances: allow, deductions: 0, advance: adv, net: t.baseSalary + allow - adv, status: 'paid', paidDate: lastMonth + '-28', method: 'Bank transfer', notes: '', advanceApplied: true };
    }));

    /* ---- expenses ---- */
    var cats = ['Electricity', 'Water', 'Internet', 'Equipment', 'Repair', 'Stationery', 'Rent'];
    put('expenseCategories', cats.map(function (n, i) { return { id: 'exc-' + (i + 1), name: n, isArchived: false }; }));
    var ex = [], eid = 0;
    [F.prevMonth(lastMonth), lastMonth, thisMonth].forEach(function (m, mi) {
      var add = function (cat, amt, day, desc, method) { ex.push({ id: 'exp-' + (++eid), categoryId: 'exc-' + cat, amount: amt, date: m + '-' + pad(day), description: desc, method: method || 'Bank transfer', receipt: '' }); };
      add(7, 60000, 1, 'Building rent');
      add(1, 17000 + mi * 1500, 8, 'Electricity bill');
      add(3, 4500, 9, 'Internet bill');
      add(2, 3200, 12, 'Water bill', 'Cash');
      if (mi === 1) { add(4, 22000, 14, 'Projector for class 10-A', 'Cash'); add(5, 6800, 18, 'Classroom door repair', 'Cash'); }
      if (mi === 2) { add(6, 5400, 5, 'Markers, registers and chalk', 'Cash'); }
    });
    put('expenses', ex);

    /* ---- communication ---- */
    put('announcements', [
      { id: 'ann-1', title: 'Parent-teacher meeting', body: 'The parent-teacher meeting will be held on Saturday at 10:00 AM in the main hall. Please attend.', audience: 'all', createdBy: 'usr-admin', createdByName: 'School Admin', createdAt: F.addDays(today, -3) + 'T09:00:00.000Z' },
      { id: 'ann-2', title: 'Mid-term results', body: 'Mid-term results for class 9-A are published. Please review your marks.', audience: 'cls-9a', createdBy: 'usr-1', createdByName: 'Bilal Ahmed', createdAt: F.addDays(today, -1) + 'T11:30:00.000Z' }
    ]);
    put('messageTemplates', Object.keys(ED.wa.DEFAULT_TEMPLATES).map(function (k, i) { return { id: 'mt-' + (i + 1), type: k, text: ED.wa.DEFAULT_TEMPLATES[k] }; }));
    put('sendHistory', [
      { id: 'wh-1', studentId: 'stu-4', studentName: 'Zainab Noor', number: students26[3].parentWhatsapp, type: 'absent', message: 'Assalam o Alaikum Mr. Noor, Zainab Noor (9-A) was absent from school.', status: 'queued', createdBy: 'usr-1', createdByName: 'Bilal Ahmed', at: F.addDays(today, -2) + 'T10:00:00.000Z' },
      { id: 'wh-2', studentId: 'stu-9', studentName: 'Danish Ahmad', number: students26[8].parentWhatsapp, type: 'fee', message: 'Assalam o Alaikum Mr. Ahmad, fee reminder for Danish Ahmad (9-B).', status: 'queued', createdBy: 'usr-admin', createdByName: 'School Admin', at: F.addDays(today, -1) + 'T12:15:00.000Z' }
    ]);
    put('auditLog', [
      { id: 'au-1', userId: 'usr-admin', userName: 'School Admin', role: 'admin', action: 'publish', entity: 'results', summary: 'Published Mid-term results for class 9-A Mathematics', at: F.addDays(today, -20) + 'T14:00:00.000Z' },
      { id: 'au-2', userId: 'usr-admin', userName: 'School Admin', role: 'admin', action: 'create', entity: 'fees', summary: 'Generated fee invoices for ' + F.monthLabel(thisMonth), at: F.addDays(today, -13) + 'T09:30:00.000Z' },
      { id: 'au-3', userId: 'usr-admin', userName: 'School Admin', role: 'admin', action: 'pay', entity: 'salary', summary: 'Paid salaries for ' + F.monthLabel(lastMonth), at: lastMonth + '-28T16:00:00.000Z' },
      { id: 'au-4', userId: 'usr-1', userName: 'Bilal Ahmed', role: 'teacher', action: 'update', entity: 'attendance', summary: 'Marked attendance for class 9-A', at: today + 'T08:40:00.000Z' }
    ]);
    put('trash', []);

    var settings = Object.assign({}, ED.data.DEFAULTS, { schoolName: 'EduDesk Public School', address: 'Model Town, Lahore', phone: '+92 42 1234567', activeSessionId: 'ses-2026' });
    Object.keys(data).forEach(function (col) { S._writeList(col, data[col]); });
    S.setObject('settings', settings);
    localStorage.setItem(FLAG, VERSION);
  }

  /* ---- upgrades from older saved data (nothing is deleted) ---- */
  function migrate2to3() {
    var S = ED.storage, now = new Date().toISOString(), active = 'ses-2026';
    try { active = (JSON.parse(localStorage.getItem('edudesk:settings')) || {}).activeSessionId || active; } catch (e) {}
    S._writeList('attendance', S._readList('attendance').map(function (a) { return a.subjectId ? a : Object.assign({}, a, { subjectId: 'general' }); }));
    S._writeList('students', S._readList('students').map(function (s) { return Object.assign({ sessionId: active, fatherCnic: '', bForm: '' }, s); }));
    S._writeList('teachers', S._readList('teachers').map(function (t) { return Object.assign({ canEditProfile: false }, t); }));
  }
  function migrate3to4() {
    var S = ED.storage;
    S._writeList('students', S._readList('students').map(function (s) { return s.personId ? s : Object.assign({ personId: 'per-' + s.id }, s); }));
    ['paperScans', 'trash'].forEach(function (c) { if (!localStorage.getItem('edudesk:' + c)) S._writeList(c, []); });
  }

  window.ED = window.ED || {};
  ED.seed = {
    VERSION: VERSION,
    ensure: function () {
      var v = localStorage.getItem(FLAG);
      if (v === VERSION) return Promise.resolve();
      if (v === '2') { migrate2to3(); migrate3to4(); localStorage.setItem(FLAG, VERSION); }
      else if (v === '3') { migrate3to4(); localStorage.setItem(FLAG, VERSION); }
      else build();
      return Promise.resolve();
    },
    reset: function () {
      ED.storage.clearAll();
      localStorage.removeItem(FLAG);
      build();
      if (ED.blobs) ED.blobs.clear().catch(function () {});
    },
    clearEverything: function () {
      ED.storage.clearAll();
      localStorage.removeItem(FLAG);
      if (ED.blobs) ED.blobs.clear().catch(function () {});
    }
  };
})();
