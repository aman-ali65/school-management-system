/* Parent messages on WhatsApp.
   DEMO MODE: "Queue" saves the message in send history. "Open in WhatsApp" opens wa.me with the text ready,
   so a single message can really be sent from your own WhatsApp. When the backend exists, replace the body of
   send() with an API call (the rest of the app keeps using ED.wa.send / ED.wa.openModal unchanged). */
(function () {
  var S = ED.storage, F = ED.fmt, U = ED.ui, h = F.esc;

  var TYPES = [['result', 'Result'], ['fee', 'Fee reminder'], ['absent', 'Absent alert'], ['custom', 'Custom message']];
  var TYPE_NAME = {}; TYPES.forEach(function (t) { TYPE_NAME[t[0]] = t[1]; });

  /* Every variable the system can fill in. "types" lists the message types where it has a value. */
  var COMMON = ['student', 'class', 'parent', 'school', 'date'];
  var VARIABLES = {
    student: { meaning: 'Student full name', example: 'Ali Raza', types: ['result', 'fee', 'absent', 'custom'] },
    class: { meaning: 'Class and section', example: '9-A', types: ['result', 'fee', 'absent', 'custom'] },
    parent: { meaning: 'Parent or father name', example: 'Mr. Raza', types: ['result', 'fee', 'absent', 'custom'] },
    school: { meaning: 'School name from Settings', example: 'EduDesk Public School', types: ['result', 'fee', 'absent', 'custom'] },
    date: { meaning: 'Today, or the date of the absence', example: '15 Oct 2026', types: ['result', 'fee', 'absent', 'custom'] },
    marks: { meaning: 'Marks obtained', example: '42', types: ['result'], extra: true },
    total: { meaning: 'Total marks of the exam', example: '50', types: ['result'] },
    percentage: { meaning: 'Percentage (result or attendance)', example: '84%', types: ['result'], extra: true },
    grade: { meaning: 'Grade from the grading scale', example: 'A', types: ['result'], extra: true },
    exam: { meaning: 'Exam name', example: 'Mid-term', types: ['result'] },
    subject: { meaning: 'Subject name', example: 'Mathematics', types: ['result', 'absent'] },
    month: { meaning: 'Fee month', example: 'Oct 2026', types: ['fee'] },
    due: { meaning: 'Amount still unpaid (numbers only)', example: '3,500', types: ['fee'] },
    dueDate: { meaning: 'Last date to pay', example: '10 Oct 2026', types: ['fee'] },
    rank: { meaning: 'Position in class (report card)', example: '3', types: [], extra: true },
    paperLink: { meaning: 'Private link to the child\'s paper, marks and remark', example: 'paper.html?t=ab12cd...', types: [], extra: true }
  };
  var DEFAULT_TEMPLATES = {
    result: 'Assalam o Alaikum {parent}, {student} ({class}) scored {marks}/{total} ({percentage}) in {subject} {exam}. Grade: {grade}. - {school}',
    fee: 'Assalam o Alaikum {parent}, the fee of {student} ({class}) for {month} is pending: Rs {due}. Due date: {dueDate}. Please pay at your earliest. - {school}',
    absent: 'Assalam o Alaikum {parent}, {student} ({class}) was absent from school on {date}. - {school}',
    custom: 'Assalam o Alaikum {parent}, '
  };

  /* which variables can be used for a message type; "extra" are added by the screen that opens the dialog */
  function allowed(type, extra) {
    var list = Object.keys(VARIABLES).filter(function (k) { return VARIABLES[k].types.indexOf(type) >= 0; });
    (extra || []).forEach(function (k) { if (list.indexOf(k) < 0 && VARIABLES[k]) list.push(k); });
    return list;
  }
  /* returns { unknown:[...], unavailable:[...] } for the {variables} found in text */
  function checkVars(type, text, extra) {
    var ok = allowed(type, extra), found = (String(text).match(/\{[^{}]*\}/g) || []).map(function (x) { return x.slice(1, -1); });
    var unknown = [], unavailable = [];
    found.forEach(function (v) {
      if (!VARIABLES[v]) { if (unknown.indexOf(v) < 0) unknown.push(v); }
      else if (ok.indexOf(v) < 0 && unavailable.indexOf(v) < 0) unavailable.push(v);
    });
    return { unknown: unknown, unavailable: unavailable, ok: !unknown.length && !unavailable.length };
  }
  function problemText(type, res) {
    var parts = [];
    if (res.unknown.length) parts.push(res.unknown.map(function (v) { return '{' + v + '}'; }).join(', ') + ' is not a valid variable');
    if (res.unavailable.length) parts.push(res.unavailable.map(function (v) { return '{' + v + '}'; }).join(', ') + ' has no value in ' + (TYPE_NAME[type] || type) + ' messages');
    return parts.join('. ');
  }

  function templates() {
    return S.getAll('messageTemplates').then(function (rows) {
      var out = Object.assign({}, DEFAULT_TEMPLATES);
      rows.forEach(function (r) { out[r.type] = r.text; });
      return out;
    });
  }
  function fill(text, vars) {
    return String(text).replace(/\{(\w+)\}/g, function (m, k) { return vars[k] !== undefined && vars[k] !== null ? vars[k] : m; });
  }
  /* 0300 1234567 -> +923001234567 using the default country code from Settings */
  function normalizeNumber(num, cc) {
    var raw = String(num || '').trim(), d = raw.replace(/\D/g, '');
    if (!d) return '';
    if (raw.charAt(0) === '+') return '+' + d;
    if (d.charAt(0) === '0') return (cc || '+92') + d.slice(1);
    return d.length <= 10 ? (cc || '+92') + d : '+' + d;
  }

  function send(o) {
    var s = ED.auth.session();
    return S.insert('sendHistory', {
      studentId: o.studentId, studentName: o.studentName, number: o.number, type: o.type, message: o.message,
      status: o.status || 'queued', createdBy: s ? s.userId : null, createdByName: s ? s.name : '', at: new Date().toISOString()
    });
  }

  /* opts: { students, type, text, title, vars(student)->values, extra:[variable names the screen supplies] } */
  function openModal(opts) {
    return Promise.all([templates(), ED.data.settings(), S.getAll('classes'), S.getObject('whatsappSession', { status: 'disconnected' })]).then(function (r) {
      var tpl = r[0], settings = r[1], classes = r[2], conn = r[3], wcfg = settings.whatsapp;
      var cmap = {}; classes.forEach(function (c) { cmap[c.id] = c; });
      var students = opts.students || [];
      if (!students.length) { U.toast('Select at least one student first.', 'info'); return null; }
      var single = students.length === 1, s0 = students[0], type = opts.type || 'custom', extra = opts.extra || [];
      if (opts.vars) { try { extra = extra.concat(Object.keys(opts.vars(s0))); } catch (e) {} }

      function varsFor(st) {
        var base = { student: st.name, class: F.className(cmap[st.classId]), parent: st.parentName || 'Parent', school: settings.schoolName, date: F.date(F.today()) };
        return Object.assign(base, opts.vars ? opts.vars(st) : {});
      }

      var body = document.createElement('div');
      body.className = 'stack';
      body.innerHTML =
        (conn.status !== 'connected' ? '<div class="callout warn">WhatsApp is not connected. Messages are only queued. Connect it from Admin > WhatsApp connection.</div>' : '') +
        (single ? '<div class="field"><label for="wa-num">WhatsApp number</label><input class="input" id="wa-num" value="' + h(s0.parentWhatsapp || '') + '" placeholder="+92 300 1234567"><span class="hint">To: parent of ' + h(s0.name) + ' (' + h(F.className(cmap[s0.classId])) + ')</span></div>'
          : '<div class="callout">Sending to the parents of <b>' + students.length + '</b> students. Each message uses that student\'s own details.</div>') +
        '<div class="field"><label for="wa-type">Message type</label><select class="select" id="wa-type">' + TYPES.map(function (t) { return '<option value="' + t[0] + '"' + (t[0] === type ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label for="wa-text">Message</label><textarea class="textarea" id="wa-text" rows="4"></textarea><div class="chip-row" id="wa-chips" aria-label="Variables you can insert"></div><div class="small" id="wa-warn" role="alert"></div></div>' +
        '<div><div class="small muted" style="margin-bottom:4px">Preview for ' + h(s0.name) + '</div><div class="msg-bubble" id="wa-prev"></div></div>' +
        '<div class="callout">Demo mode: "Queue message" saves it in WhatsApp history. Real delivery starts when the backend is connected.' + (single ? ' Use "Open in WhatsApp" to send this one right now from your own WhatsApp.' : '') + '</div>';
      var typeEl = body.querySelector('#wa-type'), textEl = body.querySelector('#wa-text'), prev = body.querySelector('#wa-prev'), chips = body.querySelector('#wa-chips'), warn = body.querySelector('#wa-warn');
      textEl.value = opts.text !== undefined ? opts.text : (tpl[type] || '');

      function signature() { return wcfg.useSignature && wcfg.signature ? '\n' + wcfg.signature : ''; }
      function paint() {
        var res = checkVars(typeEl.value, textEl.value, extra);
        warn.textContent = res.ok ? '' : problemText(typeEl.value, res) + '. Fix it before sending.';
        warn.style.color = res.ok ? '' : 'var(--danger)';
        prev.textContent = fill(textEl.value, varsFor(s0)) + signature();
        chips.innerHTML = '<span class="small muted" style="align-self:center">Insert:</span>' + allowed(typeEl.value, extra).map(function (v) { return '<button type="button" class="chip" data-var="' + v + '" title="' + h(VARIABLES[v].meaning + ', e.g. ' + VARIABLES[v].example) + '">{' + v + '}</button>'; }).join('');
      }
      chips.addEventListener('click', function (e) {
        var b = e.target.closest('[data-var]'); if (!b) return;
        var t = '{' + b.dataset.var + '}', a = textEl.selectionStart, z = textEl.selectionEnd;
        textEl.value = textEl.value.slice(0, a) + t + textEl.value.slice(z); textEl.focus(); textEl.setSelectionRange(a + t.length, a + t.length); paint();
      });
      typeEl.addEventListener('change', function () { if (typeEl.value !== 'custom' || !textEl.value) textEl.value = tpl[typeEl.value] || ''; paint(); });
      textEl.addEventListener('input', paint);
      paint();

      function run(openLink) {
        var res = checkVars(typeEl.value, textEl.value, extra);
        if (!res.ok) { U.toast(problemText(typeEl.value, res) + '.', 'danger'); return false; }
        var numEl = body.querySelector('#wa-num'), count = 0, skipped = 0, firstUrl = '';
        var jobs = students.map(function (st) {
          var number = normalizeNumber(single ? numEl.value : st.parentWhatsapp, wcfg.countryCode);
          if (!ED.data.phoneOk(number)) { skipped++; return Promise.resolve(); }
          var msg = fill(textEl.value, varsFor(st)) + signature();
          if (!firstUrl) firstUrl = 'https://wa.me/' + number.replace(/\D/g, '') + '?text=' + encodeURIComponent(msg);
          count++;
          return send({ studentId: st.id, studentName: st.name, number: number, type: typeEl.value, message: msg, status: openLink ? 'opened' : 'queued' });
        });
        return Promise.all(jobs).then(function () {
          if (!count) { U.toast('No valid WhatsApp number found. Add the parent number first.', 'danger'); return false; }
          if (openLink && firstUrl) window.open(firstUrl, '_blank', 'noopener');
          U.toast(count + (count === 1 ? ' message ' : ' messages ') + (openLink ? 'opened in WhatsApp' : 'queued') + (skipped ? ', ' + skipped + ' skipped (no valid number)' : ''), 'success');
          ED.audit.log('send', 'whatsapp', count + ' ' + typeEl.value + ' message(s)');
        });
      }
      var actions = [{ label: 'Cancel', variant: 'secondary', value: false }];
      if (single) actions.push({ label: 'Open in WhatsApp', variant: 'secondary', value: 'opened', onClick: function () { return run(true); } });
      actions.push({ label: single ? 'Queue message' : 'Queue ' + students.length + ' messages', variant: 'whatsapp', value: 'queued', onClick: function () { return run(false); } });
      return U.modal({ title: opts.title || 'Send to parent', body: body, size: 'wide', actions: actions });
    });
  }

  window.ED = window.ED || {};
  ED.wa = { TYPES: TYPES, TYPE_NAME: TYPE_NAME, VARIABLES: VARIABLES, DEFAULT_TEMPLATES: DEFAULT_TEMPLATES, allowed: allowed, checkVars: checkVars, problemText: problemText, normalizeNumber: normalizeNumber, templates: templates, fill: fill, send: send, openModal: openModal };
})();
