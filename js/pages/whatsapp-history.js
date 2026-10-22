(async function () {
  var session = await ED.shell.init({ role: 'admin', active: 'whatsapp-history' });
  if (!session) return;
  var S = ED.storage, F = ED.fmt, U = ED.ui, I = ED.icons, h = F.esc, A = ED.audit;
  var d;
  async function fetchAll() { d = await ED.data.load(['sendHistory', 'messageTemplates', 'students']); }
  await fetchAll();
  document.getElementById('content').innerHTML = U.pageHead('WhatsApp history', 'Every message sent or queued to parents, and the message templates.') + '<div id="tabs"></div>';
  var tabsApi;
  async function reload() { await fetchAll(); tabsApi.select(tabsApi.current()); }
  var TYPE = {}; ED.wa.TYPES.forEach(function (t) { TYPE[t[0]] = t[1]; });

  function history(p) {
    p.innerHTML = '<div class="callout">' + I.svg('info', 18) + '<span>Demo mode: "Queued" means saved here, not delivered. Real delivery starts when the backend and WhatsApp API are connected.</span></div><div class="filters card card-pad"><div class="field"><label for="h-t">Type</label><select class="select" id="h-t"><option value="">All types</option>' + ED.wa.TYPES.map(function (t) { return '<option value="' + t[0] + '">' + t[1] + '</option>'; }).join('') + '</select></div><div class="field"><label for="h-s">Status</label><select class="select" id="h-s"><option value="">All</option><option value="queued">Queued</option><option value="opened">Opened in WhatsApp</option></select></div><div class="row" style="align-self:flex-end">' + U.btn('Clear history', { id: 'h-clear', variant: 'danger' }) + '</div></div><section class="card" id="h-tbl"></section>';
    function rows() { var t = p.querySelector('#h-t').value, s = p.querySelector('#h-s').value; return d.sendHistory.filter(function (x) { return (!t || x.type === t) && (!s || x.status === s); }).sort(function (a, b) { return b.at.localeCompare(a.at); }); }
    var tbl = U.table(p.querySelector('#h-tbl'), {
      rows: rows(), pageSize: 10, search: function (r) { return r.studentName + ' ' + r.message + ' ' + r.number; }, searchPlaceholder: 'Search messages',
      columns: [{ key: 'at', label: 'When', render: function (r) { return F.date(r.at) + '<div class="cell-sub">' + F.time(r.at) + '</div>'; } }, { key: 'studentName', label: 'Student', render: function (r) { return h(r.studentName) + '<div class="cell-sub">' + h(r.number) + '</div>'; } }, { key: 'type', label: 'Type', render: function (r) { return U.badge(TYPE[r.type] || r.type, 'primary'); } }, { key: 'message', label: 'Message', render: function (r) { return '<span title="' + h(r.message) + '">' + h(r.message.length > 60 ? r.message.slice(0, 60) + '...' : r.message) + '</span>'; } }, { key: 'status', label: 'Status', render: function (r) { return U.statusBadge('wa', r.status); } }, { key: 'createdByName', label: 'By' }],
      actions: [{ id: 'v', label: 'View message', icon: 'eye', onClick: function (r) { U.view('Message to ' + r.studentName, '<div class="msg-bubble">' + h(r.message) + '</div><p class="small muted">' + h(r.number) + ' | ' + F.date(r.at) + ' ' + F.time(r.at) + '</p>'); } }, { id: 'r', label: 'Send again', icon: 'whatsapp', onClick: function (r) { var s = d.map.students[r.studentId]; if (!s) return U.toast('That student no longer exists.', 'danger'); ED.wa.openModal({ students: [s], type: r.type, text: r.message }).then(reload); } }],
      empty: { icon: 'whatsapp', title: 'No messages yet', message: 'Messages you send to parents are listed here.' }
    });
    ['h-t', 'h-s'].forEach(function (id) { p.querySelector('#' + id).addEventListener('change', function () { tbl.setRows(rows()); }); });
    p.querySelector('#h-clear').addEventListener('click', async function () { var ok = await U.confirm({ title: 'Clear all history?', message: d.sendHistory.length + ' records will be deleted.', confirmLabel: 'Clear', danger: true }); if (!ok) return; S._writeList('sendHistory', []); A.log('delete', 'whatsapp', 'Cleared WhatsApp history'); U.toast('History cleared', 'success'); reload(); });
  }

  function templates(p) {
    var VARS = ED.wa.VARIABLES, names = Object.keys(VARS);
    p.innerHTML = '<div class="callout">' + I.svg('info', 18) + '<span>Write a variable in curly brackets, like {student}. It is replaced with the real value for each student. A variable only works in the message types listed below; anything else would be sent as plain text, so it is blocked.</span></div>' +
      '<section class="card"><div class="card-head"><h3>Variables</h3></div><div class="table-wrap"><table class="table rowcards var-table"><thead><tr><th>Variable</th><th>Meaning</th><th>Example</th><th>Works in</th></tr></thead><tbody>' +
      names.map(function (k) { var v = VARS[k]; return '<tr><td class="td-title" data-label="Variable"><code>{' + k + '}</code></td><td data-label="Meaning">' + h(v.meaning) + '</td><td data-label="Example">' + h(v.example) + '</td><td data-label="Works in">' + (v.types.length ? v.types.map(function (t) { return U.badge(ED.wa.TYPE_NAME[t], t === 'custom' ? '' : 'primary'); }).join(' ') : '<span class="small muted">Only where the screen supplies it (e.g. report card messages)</span>') + '</td></tr>'; }).join('') +
      '</tbody></table></div></section><div class="grid-2" id="t-grid"></div>';
    var tpl = {}; d.messageTemplates.forEach(function (t) { tpl[t.type] = t; });
    p.querySelector('#t-grid').innerHTML = ED.wa.TYPES.map(function (t) {
      var text = tpl[t[0]] ? tpl[t[0]].text : ED.wa.DEFAULT_TEMPLATES[t[0]];
      return '<section class="card card-pad stack"><h3>' + t[1] + '</h3><textarea class="textarea" rows="4" data-type="' + t[0] + '" aria-label="' + t[1] + ' template">' + h(text) + '</textarea><div class="chip-row"><span class="small muted" style="align-self:center">Insert:</span>' + ED.wa.allowed(t[0]).map(function (v) { return '<button type="button" class="chip" data-ins="' + v + '" data-for="' + t[0] + '" title="' + h(VARS[v].meaning) + '">{' + v + '}</button>'; }).join('') + '</div><div class="small" data-warn="' + t[0] + '" role="alert"></div><div class="row"><button type="button" class="btn btn-primary btn-sm" data-save="' + t[0] + '">Save template</button><button type="button" class="btn btn-ghost btn-sm" data-reset="' + t[0] + '">Reset</button></div></section>';
    }).join('');
    function warn(type) {
      var ta = p.querySelector('textarea[data-type="' + type + '"]'), res = ED.wa.checkVars(type, ta.value), el = p.querySelector('[data-warn="' + type + '"]');
      el.textContent = res.ok ? '' : ED.wa.problemText(type, res) + '.'; el.style.color = res.ok ? '' : 'var(--danger)'; return res.ok;
    }
    p.addEventListener('input', function (e) { if (e.target.matches('textarea[data-type]')) warn(e.target.dataset.type); });
    p.addEventListener('click', async function (e) {
      var ins = e.target.closest('[data-ins]'), s = e.target.closest('[data-save]'), r = e.target.closest('[data-reset]');
      if (ins) { var ta = p.querySelector('textarea[data-type="' + ins.dataset.for + '"]'), t = '{' + ins.dataset.ins + '}', a = ta.selectionStart, z = ta.selectionEnd; ta.value = ta.value.slice(0, a) + t + ta.value.slice(z); ta.focus(); ta.setSelectionRange(a + t.length, a + t.length); warn(ins.dataset.for); }
      if (s) {
        var type = s.dataset.save, text = p.querySelector('textarea[data-type="' + type + '"]').value.trim();
        if (!text) return U.toast('The template cannot be empty.', 'danger');
        if (!warn(type)) return U.toast('Fix the variables marked in red first.', 'danger');
        var cur = S._readList('messageTemplates').filter(function (x) { return x.type === type; })[0];
        if (cur) await S.update('messageTemplates', cur.id, { text: text }); else await S.insert('messageTemplates', { type: type, text: text });
        A.log('update', 'whatsapp', 'Edited ' + TYPE[type] + ' template'); U.toast('Template saved', 'success'); await fetchAll();
      }
      if (r) { var t2 = r.dataset.reset; p.querySelector('textarea[data-type="' + t2 + '"]').value = ED.wa.DEFAULT_TEMPLATES[t2]; warn(t2); U.toast('Default text restored. Press Save template to keep it.', 'info'); }
    });
  }
  tabsApi = U.tabs(document.getElementById('tabs'), [{ id: 'history', label: 'Message history', render: history }, { id: 'templates', label: 'Templates', render: templates }]);
})();
