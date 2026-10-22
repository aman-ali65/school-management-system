(async function () {
  var session = await ED.shell.init({ role: 'admin', active: 'whatsapp' });
  if (!session) return;
  var S = ED.storage, F = ED.fmt, U = ED.ui, I = ED.icons, h = F.esc, A = ED.audit;
  var conn, settings, log, timer = null, qrLeft = 0;
  async function fetchAll() { conn = await S.getObject('whatsappSession', { status: 'disconnected' }); settings = await ED.data.settings(); log = (await S.getAll('whatsappLog')).sort(function (a, b) { return b.at.localeCompare(a.at); }); }
  await fetchAll();

  async function event(name, detail) { await S.insert('whatsappLog', { at: new Date().toISOString(), event: name, detail: detail || '', by: session.name }); }
  async function setConn(patch) { conn = Object.assign({}, conn, patch); await S.setObject('whatsappSession', conn); }
  function mask(n) { var d = F.digits(n); return d.length > 6 ? '+' + d.slice(0, 2) + ' ' + d.slice(2, 5) + ' ****' + d.slice(-3) : n; }

  /* a pretty but fake QR code, only so the connect screen can be designed and tested */
  function fakeQR(seed) {
    var N = 25, cells = '', r = (function (x) { return function () { x = (x * 1664525 + 1013904223) % 4294967296; return x / 4294967296; }; })(seed);
    function finder(ox, oy) { var o = '<rect x="' + ox + '" y="' + oy + '" width="7" height="7" fill="#000"/><rect x="' + (ox + 1) + '" y="' + (oy + 1) + '" width="5" height="5" fill="#fff"/><rect x="' + (ox + 2) + '" y="' + (oy + 2) + '" width="3" height="3" fill="#000"/>'; return o; }
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      var inF = (x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9);
      if (!inF && r() > 0.52) cells += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="#000"/>';
    }
    return '<svg viewBox="0 0 ' + N + ' ' + N + '" shape-rendering="crispEdges" role="img" aria-label="Demo QR code, not scannable"><rect width="' + N + '" height="' + N + '" fill="#fff"/>' + cells + finder(0, 0) + finder(N - 7, 0) + finder(0, N - 7) + '</svg>';
  }

  document.getElementById('content').innerHTML = U.pageHead('WhatsApp connection', 'Link the school WhatsApp so messages to parents can go out from it.') +
    '<div class="callout warn">' + I.svg('info', 18) + '<span><b>Demo screen.</b> A real QR connection needs the backend. Here the QR is a placeholder and "Simulate scan" stands in for scanning, so the whole flow and settings can be designed and tested now.</span></div>' +
    '<div class="grid-2"><section class="card card-pad stack" id="status-card"></section><section class="card card-pad stack" id="settings-card"></section></div>' +
    '<section class="card"><div class="card-head"><h3>Connection log</h3></div><div id="log-tbl"></div></section>';

  var logTbl = U.table(document.getElementById('log-tbl'), {
    rows: log, pageSize: 6,
    columns: [{ key: 'at', label: 'When', render: function (r) { return F.date(r.at) + '<div class="cell-sub">' + F.time(r.at) + '</div>'; } }, { key: 'event', label: 'Event', render: function (r) { return U.badge(r.event, r.event === 'Connected' ? 'present' : r.event === 'Disconnected' ? 'absent' : 'primary'); } }, { key: 'detail', label: 'Details' }, { key: 'by', label: 'By' }],
    empty: { icon: 'whatsapp', title: 'No activity yet', message: 'Connect or disconnect events are listed here.' }
  });

  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }
  function statusCard() {
    var c = document.getElementById('status-card'); stopTimer();
    if (conn.status === 'connected') {
      c.innerHTML = '<div class="row"><span class="status-dot on"></span><h3>Connected</h3></div>' +
        '<div class="row" style="gap:12px">' + U.avatar(conn.name || 'WA') + '<div><div>' + h(conn.name || 'WhatsApp account') + '</div><div class="small muted">' + h(mask(conn.number)) + ' | since ' + F.date(conn.connectedAt) + ' ' + F.time(conn.connectedAt) + '</div></div></div>' +
        '<p class="muted">Parent messages from this app will be sent from this number once the backend is live. For now they are saved in WhatsApp history.</p>' +
        '<div class="row" style="flex-wrap:wrap">' + U.btn('Send test message', { variant: 'whatsapp', icon: 'whatsapp', id: 'w-test' }) + U.btn('Disconnect', { variant: 'danger', id: 'w-off' }) + '</div>';
      c.querySelector('#w-test').addEventListener('click', testMsg); c.querySelector('#w-off').addEventListener('click', disconnect);
    } else if (conn.status === 'connecting') {
      qrLeft = Math.max(0, 60 - Math.round((Date.now() - (conn.qrAt || Date.now())) / 1000));
      c.innerHTML = '<div class="row"><span class="status-dot wait"></span><h3>Waiting for scan</h3></div><div class="row" style="gap:20px;align-items:flex-start;flex-wrap:wrap"><div><div class="qr-box" id="qr">' + fakeQR(conn.qrAt || 1) + '</div><div class="small muted" id="qr-timer" style="margin-top:6px;text-align:center"></div></div>' +
        '<ol style="margin:0;padding-left:18px;line-height:1.8;flex:1;min-width:200px"><li>Open WhatsApp on the school phone</li><li>Tap Menu or Settings, then <b>Linked devices</b></li><li>Tap <b>Link a device</b></li><li>Point the phone at this QR code</li></ol></div>' +
        '<div class="row" style="flex-wrap:wrap">' + U.btn('Simulate scan (demo)', { variant: 'primary', id: 'w-scan' }) + U.btn('New QR code', { id: 'w-new' }) + U.btn('Cancel', { variant: 'ghost', id: 'w-cancel' }) + '</div>';
      var tEl = c.querySelector('#qr-timer');
      function tick() { if (qrLeft <= 0) { tEl.textContent = 'QR code expired. Press New QR code.'; c.querySelector('#qr').style.opacity = '.25'; stopTimer(); return; } tEl.textContent = 'Expires in ' + qrLeft + 's'; qrLeft--; }
      tick(); if (qrLeft > 0) timer = setInterval(tick, 1000);
      c.querySelector('#w-scan').addEventListener('click', simulateScan); c.querySelector('#w-new').addEventListener('click', startConnect); c.querySelector('#w-cancel').addEventListener('click', async function () { await setConn({ status: 'disconnected' }); statusCard(); });
    } else {
      c.innerHTML = '<div class="row"><span class="status-dot"></span><h3>Not connected</h3></div><p class="muted">Connect the school WhatsApp number by scanning a QR code, the same way you link WhatsApp Web. Result, fee and absent messages to parents will then go out from that number.</p>' + '<div>' + U.btn('Connect WhatsApp', { variant: 'whatsapp', icon: 'whatsapp', id: 'w-conn' }) + '</div>';
      c.querySelector('#w-conn').addEventListener('click', startConnect);
    }
  }
  async function startConnect() { await setConn({ status: 'connecting', qrAt: Date.now() }); await event('QR shown', 'Waiting for a scan'); await refreshLog(); statusCard(); }
  async function simulateScan() {
    var v = await U.form({ title: 'Simulate scan', submitLabel: 'Connect', fields: [{ name: 'number', label: 'WhatsApp number of the school phone', type: 'tel', required: true, placeholder: '+92 300 1234567', full: true }, { name: 'name', label: 'Account name', placeholder: settings.schoolName, full: true }], validate: function (x) { return ED.data.phoneOk(x.number) ? null : { field: 'number', message: 'Enter a valid number with 10 to 15 digits.' }; } });
    if (!v) return;
    await setConn({ status: 'connected', number: ED.wa.normalizeNumber(v.number, settings.whatsapp.countryCode), name: v.name || settings.schoolName, connectedAt: new Date().toISOString() });
    await event('Connected', mask(conn.number)); A.log('update', 'whatsapp', 'Connected WhatsApp (demo)'); U.toast('WhatsApp connected', 'success'); await refreshLog(); statusCard();
  }
  async function disconnect() {
    var ok = await U.confirm({ title: 'Disconnect WhatsApp?', message: 'Messages will only be queued until you connect again.', confirmLabel: 'Disconnect', danger: true }); if (!ok) return;
    await setConn({ status: 'disconnected', number: '', name: '' }); await event('Disconnected', 'By ' + session.name); A.log('update', 'whatsapp', 'Disconnected WhatsApp'); U.toast('WhatsApp disconnected', 'success'); await refreshLog(); statusCard();
  }
  async function testMsg() {
    var v = await U.form({ title: 'Send test message', submitLabel: 'Queue test', value: { number: conn.number, text: 'Test message from ' + settings.schoolName + '.' }, fields: [{ name: 'number', label: 'Send to', type: 'tel', required: true, full: true }, { name: 'text', label: 'Message', type: 'textarea', required: true }], validate: function (x) { return ED.data.phoneOk(x.number) ? null : { field: 'number', message: 'Enter a valid number.' }; } });
    if (!v) return;
    var w = settings.whatsapp, msg = v.text + (w.useSignature && w.signature ? '\n' + w.signature : '');
    await ED.wa.send({ studentId: null, studentName: 'Test message', number: ED.wa.normalizeNumber(v.number, w.countryCode), type: 'custom', message: msg });
    await event('Test message', 'To ' + mask(v.number)); U.toast('Test message queued in WhatsApp history', 'success'); await refreshLog();
  }
  async function refreshLog() { log = (await S.getAll('whatsappLog')).sort(function (a, b) { return b.at.localeCompare(a.at); }); logTbl.setRows(log); }

  function settingsCard() {
    var w = settings.whatsapp, c = document.getElementById('settings-card');
    c.innerHTML = '<h3>Profile and message settings</h3><div class="field"><label for="w-name">Display name</label><input class="input" id="w-name" maxlength="40" value="' + h(w.displayName) + '" placeholder="' + h(settings.schoolName) + '"><span class="hint">The name parents see. On the real account this is changed in the backend later.</span></div>' +
      '<div class="field"><label for="w-about">About / status line</label><input class="input" id="w-about" maxlength="120" value="' + h(w.about) + '" placeholder="Official school account"></div>' +
      '<div class="field"><label for="w-sig">Message signature</label><textarea class="textarea" id="w-sig" rows="2" maxlength="160" placeholder="e.g. EduDesk Public School, Model Town">' + h(w.signature) + '</textarea></div>' +
      '<label class="check"><input type="checkbox" id="w-usesig"' + (w.useSignature ? ' checked' : '') + '> Add the signature at the end of every message</label>' +
      '<div class="form-grid"><div class="field"><label for="w-cc">Default country code</label><input class="input" id="w-cc" value="' + h(w.countryCode) + '" maxlength="4"><span class="hint">Used when a number starts with 0.</span></div><div class="field"><label for="w-delay">Delay between bulk messages (seconds)</label><input class="input" id="w-delay" type="number" min="0" max="60" value="' + w.delaySeconds + '"><span class="hint">Spreads out bulk sends. 3 or more is safer.</span></div></div>' +
      '<button type="button" class="btn btn-primary" id="w-save" style="align-self:flex-start">Save settings</button>';
    c.querySelector('#w-save').addEventListener('click', async function () {
      var cc = c.querySelector('#w-cc').value.trim(), delay = Number(c.querySelector('#w-delay').value);
      if (!/^\+\d{1,3}$/.test(cc)) return U.toast('Country code must look like +92.', 'danger');
      if (!(delay >= 0 && delay <= 60)) return U.toast('Delay must be between 0 and 60 seconds.', 'danger');
      var next = { displayName: c.querySelector('#w-name').value.trim(), about: c.querySelector('#w-about').value.trim(), signature: c.querySelector('#w-sig').value.trim(), useSignature: c.querySelector('#w-usesig').checked, countryCode: cc, delaySeconds: delay };
      if (next.useSignature && !next.signature) return U.toast('Write a signature first, or untick the box.', 'danger');
      await S.setObject('settings', Object.assign({}, await S.getObject('settings', {}), { whatsapp: next })); settings.whatsapp = next;
      A.log('update', 'whatsapp', 'Updated WhatsApp profile and message settings'); await event('Settings changed', 'Profile and message settings'); await refreshLog(); U.toast('WhatsApp settings saved', 'success');
    });
  }
  statusCard(); settingsCard();
})();
