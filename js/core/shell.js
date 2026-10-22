/* App shell: builds the floating sidebar and the topbar on every protected page.
   Menu items: [id, label, icon, href, phase]. phase 0 = page exists, higher = built later. */
(function () {
  var I = ED.icons, F = ED.fmt;
  var SB_KEY = 'edudesk:sidebar';
  var root = document.documentElement;

  var MENUS = {
    admin: [
      { g: null, items: [['dashboard', 'Dashboard', 'dashboard', 'admin/dashboard.html', 0]] },
      { g: 'Academics', items: [
        ['classes', 'Classes and subjects', 'classes', 'admin/classes.html', 0],
        ['assignments', 'Assignments', 'assignments', 'admin/assignments.html', 0],
        ['timetable', 'Timetable', 'timetable', 'admin/timetable.html', 0]] },
      { g: 'People', items: [
        ['students', 'Students', 'students', 'admin/students.html', 0],
        ['teachers', 'Teachers', 'teachers', 'admin/teachers.html', 0]] },
      { g: 'Attendance', items: [
        ['attendance', 'Mark attendance', 'attendance', 'admin/attendance.html', 0],
        ['attendance-reports', 'Reports', 'history', 'admin/attendance-reports.html', 0]] },
      { g: 'Results', items: [
        ['results', 'Results', 'results', 'admin/results.html', 0],
        ['grading', 'Grading', 'grading', 'admin/grading.html', 0]] },
      { g: 'Finance', items: [
        ['fees', 'Fees', 'fees', 'admin/fees.html', 0],
        ['salary', 'Salary', 'salary', 'admin/salary.html', 0],
        ['expenses', 'Expenses', 'expenses', 'admin/expenses.html', 0]] },
      { g: 'Insights', items: [['analytics', 'Analytics', 'analytics', 'admin/analytics.html', 0]] },
      { g: 'Communication', items: [
        ['announcements', 'Announcements', 'announce', 'admin/announcements.html', 0],
        ['whatsapp', 'WhatsApp connection', 'whatsapp', 'admin/whatsapp.html', 0],
        ['whatsapp-history', 'WhatsApp history', 'history', 'admin/whatsapp-history.html', 0]] },
      { g: 'System', items: [
        ['settings', 'Settings', 'settings', 'admin/settings.html', 0],
        ['audit-log', 'Audit log', 'audit', 'admin/audit-log.html', 0],
        ['restore', 'Restore deleted', 'history', 'admin/restore.html', 0],
        ['backup', 'Backup', 'backup', 'admin/backup.html', 0]] }
    ],
    teacher: [
      { g: null, items: [['dashboard', 'Dashboard', 'dashboard', 'teacher/dashboard.html', 0]] },
      { g: 'My classes', items: [
        ['students', 'Students', 'students', 'teacher/students.html', 0],
        ['attendance', 'Mark attendance', 'attendance', 'teacher/attendance.html', 0]] },
      { g: 'Results', items: [
        ['results', 'Marks entry', 'results', 'teacher/results.html', 0],
        ['upload-result', 'Upload result photos', 'upload', 'teacher/upload-result.html', 0]] },
      { g: 'Insights', items: [['analytics', 'Analytics', 'analytics', 'teacher/analytics.html', 0]] },
      { g: 'Communication', items: [['announcements', 'Announcements', 'announce', 'teacher/announcements.html', 0]] }
    ]
  };

  function isDesktop() { return window.matchMedia('(min-width: 1024px)').matches; }

  /* ---------- Sidebar state ---------- */
  function sidebarState() { return root.dataset.sidebar === 'collapsed' ? 'collapsed' : 'expanded'; }
  function drawerOpen() { return root.dataset.drawer === 'open'; }

  function syncAria() {
    var btn = document.getElementById('sb-toggle');
    if (!btn) return;
    btn.setAttribute('aria-expanded', String(isDesktop() ? sidebarState() === 'expanded' : drawerOpen()));
    var c = document.getElementById('sb-collapse');
    if (c) c.setAttribute('aria-expanded', String(sidebarState() === 'expanded'));
  }
  function setSidebar(state) {
    root.dataset.sidebar = state;
    try { localStorage.setItem(SB_KEY, state); } catch (e) {}
    syncAria();
  }
  function setDrawer(open) {
    if (open) {
      root.dataset.drawer = 'open';
      var first = document.querySelector('#sidebar .sb-link');
      if (first) first.focus();
    } else {
      delete root.dataset.drawer;
    }
    syncAria();
  }
  function toggleSidebar() {
    if (isDesktop()) setSidebar(sidebarState() === 'collapsed' ? 'expanded' : 'collapsed');
    else {
      var wasOpen = drawerOpen();
      setDrawer(!wasOpen);
      if (wasOpen) { var b = document.getElementById('sb-toggle'); if (b) b.focus(); }
    }
  }

  /* ---------- Markup ---------- */
  function sidebarHTML(role, active, base, session) {
    var groups = MENUS[role].map(function (g) {
      var title = g.g ? '<div class="sb-group-title">' + g.g + '</div>' : '';
      var links = g.items.map(function (it) {
        var ready = it[4] === 0;
        return '<a class="sb-link' + (it[0] === active ? ' active' : '') + '" href="' + (ready ? base + it[3] : '#') + '"' +
          ' data-phase="' + it[4] + '" data-label="' + it[1] + '" title="' + it[1] + '"' +
          (it[0] === active ? ' aria-current="page"' : '') + '>' + I.svg(it[2], 18) + '<span class="sb-label">' + it[1] + '</span></a>';
      }).join('');
      return '<div class="sb-group">' + title + links + '</div>';
    }).join('');

    return '' +
      '<div class="sb-head"><span class="sb-logo">' + I.svg('school', 18) + '</span><span class="sb-brand">EduDesk</span></div>' +
      '<nav class="sb-nav" aria-label="Main">' + groups + '</nav>' +
      '<div class="sb-foot">' +
        '<div class="sb-user" title="' + F.esc(session.name) + '"><span class="avatar">' + F.esc(F.initials(session.name)) + '</span>' +
        '<div class="sb-user-text"><div class="sb-user-name">' + F.esc(session.name) + '</div><div class="sb-user-role">' + (session.role === 'admin' ? 'Admin' : 'Teacher') + '</div></div></div>' +
        '<button type="button" class="sb-collapse" id="sb-collapse" aria-expanded="true" title="Collapse sidebar (Ctrl+B)">' + I.svg('chevronsLeft', 18) + '<span class="sb-label">Collapse</span></button>' +
        '<div class="sb-label small muted" style="padding:0 10px 4px">Version 4.0.1</div>' +
      '</div>';
  }

  function themeIcon(choice) { return choice === 'dark' ? 'moon' : choice === 'light' ? 'sun' : 'monitor'; }

  function themeItem(value, label, icon, current) {
    return '<button type="button" class="menu-item" role="menuitemradio" data-theme-choice="' + value + '" aria-checked="' + (current === value) + '">' +
      I.svg(icon, 16) + '<span>' + label + '</span><span class="tick">' + I.svg('check', 16) + '</span></button>';
  }

  function topbarHTML(session, base) {
    var t = ED.theme.get();
    return '' +
      '<div class="topbar">' +
        '<button type="button" class="icon-btn" id="sb-toggle" aria-label="Toggle sidebar" aria-controls="sidebar" aria-expanded="true" title="Toggle sidebar (Ctrl+B)">' + I.svg('menu', 20) + '</button>' +
        '<div class="tb-search-wrap"><form class="tb-search" role="search" id="tb-search-form">' + I.svg('search', 16) +
          '<input class="input" id="gsearch" type="search" placeholder="Search students or teachers" aria-label="Search students or teachers" autocomplete="off"></form>' +
          '<div class="search-menu" id="search-menu" role="listbox"></div></div>' +
        '<div class="tb-right">' +
          '<div class="dropdown" id="theme-dd">' +
            '<button type="button" class="icon-btn" id="theme-btn" data-dd-trigger aria-haspopup="menu" aria-expanded="false" aria-label="Change theme">' + I.svg(themeIcon(t), 18) + '</button>' +
            '<div class="menu" role="menu" aria-label="Theme">' + themeItem('light', 'Light', 'sun', t) + themeItem('dark', 'Dark', 'moon', t) + themeItem('system', 'System', 'monitor', t) + '</div>' +
          '</div>' +
          '<div class="dropdown">' +
            '<button type="button" class="icon-btn" id="bell-btn" data-dd-trigger aria-haspopup="menu" aria-expanded="false" aria-label="Notifications">' + I.svg('bell', 18) + '</button>' +
            '<div class="menu notif-menu" role="menu" aria-label="Notifications"><div id="notif-list"><div class="menu-empty">You are all caught up.</div></div></div>' +
          '</div>' +
          '<div class="dropdown">' +
            '<button type="button" class="avatar avatar-btn" data-dd-trigger aria-haspopup="menu" aria-expanded="false" aria-label="Account menu">' + F.esc(F.initials(session.name)) + '</button>' +
            '<div class="menu" role="menu" aria-label="Account">' +
              '<div class="menu-head"><div class="name">' + F.esc(session.name) + '</div><div class="small muted">' + F.esc(session.email) + '</div></div>' +
              (session.role === 'teacher' ? '<a class="menu-item" role="menuitem" href="' + base + 'teacher/profile.html">' + I.svg('user', 16) + '<span>My profile</span></a>' : '') +
              '<button type="button" class="menu-item" role="menuitem" data-action="password">' + I.svg('key', 16) + '<span>Change password</span></button>' +
              '<button type="button" class="menu-item" role="menuitem" data-action="logout">' + I.svg('logout', 16) + '<span>Sign out</span></button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  /* ---------- Change password ---------- */
  function openChangePassword() {
    var body =
      '<div class="field"><label for="cp-current">Current password</label><input class="input" id="cp-current" type="password" autocomplete="current-password"></div>' +
      '<div class="field"><label for="cp-new">New password</label><input class="input" id="cp-new" type="password" autocomplete="new-password"><span class="hint">At least 6 characters.</span></div>' +
      '<div class="field"><label for="cp-confirm">Confirm new password</label><input class="input" id="cp-confirm" type="password" autocomplete="new-password"></div>' +
      '<div class="form-error" id="cp-error" role="alert" hidden></div>';
    ED.ui.modal({
      title: 'Change password',
      body: body,
      actions: [
        { label: 'Cancel', variant: 'secondary', value: false },
        { label: 'Save password', variant: 'primary', value: true, onClick: function (box) {
          var err = box.querySelector('#cp-error');
          var cur = box.querySelector('#cp-current').value, nw = box.querySelector('#cp-new').value, cf = box.querySelector('#cp-confirm').value;
          function fail(m) { err.textContent = m; err.hidden = false; return false; }
          if (!cur || !nw || !cf) return fail('Fill in all three fields.');
          if (nw.length < 6) return fail('New password must be at least 6 characters.');
          if (nw !== cf) return fail('New passwords do not match.');
          return ED.auth.changePassword(cur, nw).then(function (r) {
            if (!r.ok) return fail(r.error);
            ED.ui.toast('Password changed', 'success');
          });
        } }
      ]
    });
  }

  /* ---------- Wiring ---------- */
  function closeDropdowns(except) {
    document.querySelectorAll('.dropdown.open').forEach(function (d) {
      if (d === except) return;
      d.classList.remove('open');
      var t = d.querySelector('[data-dd-trigger]'); if (t) t.setAttribute('aria-expanded', 'false');
    });
  }

  function wire() {
    document.addEventListener('click', function (e) {
      var trig = e.target.closest('[data-dd-trigger]');
      var dd = trig ? trig.closest('.dropdown') : null;
      closeDropdowns(dd);
      if (dd) {
        var open = dd.classList.toggle('open');
        trig.setAttribute('aria-expanded', String(open));
        if (open) { var first = dd.querySelector('.menu-item'); if (first) first.focus(); }
        return;
      }

      var theme = e.target.closest('[data-theme-choice]');
      if (theme) {
        var c = theme.dataset.themeChoice;
        ED.theme.set(c);
        document.querySelectorAll('[data-theme-choice]').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.themeChoice === c)); });
        document.getElementById('theme-btn').innerHTML = I.svg(themeIcon(c), 18);
        closeDropdowns();
        return;
      }
      var act = e.target.closest('[data-action]');
      if (act) {
        closeDropdowns();
        if (act.dataset.action === 'logout') ED.auth.logout();
        if (act.dataset.action === 'password') openChangePassword();
        return;
      }

      var link = e.target.closest('#sidebar .sb-link');
      if (link) {
        if (link.dataset.phase !== '0') {
          e.preventDefault();
          ED.ui.soon(link.dataset.label, link.dataset.phase);
        }
        if (!isDesktop()) setDrawer(false);
      }
    });

    document.getElementById('sb-toggle').addEventListener('click', toggleSidebar);
    document.getElementById('sb-collapse').addEventListener('click', toggleSidebar);
    document.querySelector('.sb-overlay').addEventListener('click', function () { setDrawer(false); });


    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (drawerOpen()) { setDrawer(false); var b = document.getElementById('sb-toggle'); if (b) b.focus(); }
        closeDropdowns();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); toggleSidebar(); }
      var tag = (e.target.tagName || '').toLowerCase();
      if (e.key === '/' && tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
        e.preventDefault();
        document.getElementById('gsearch').focus();
      }
    });

    window.matchMedia('(min-width: 1024px)').addEventListener('change', function () { delete root.dataset.drawer; syncAria(); });
  }

  function loadNotifications(session) {
    ED.data.context(session).then(ED.data.notifications).then(function (items) {
      var list = document.getElementById('notif-list'), bell = document.getElementById('bell-btn');
      if (!list) return;
      if (items.length) {
        list.innerHTML = items.map(function (n) { return '<a class="notif-item" href="' + n.href + '">' + I.svg(n.icon, 16) + '<span>' + F.esc(n.text) + '</span></a>'; }).join('');
        var dot = document.createElement('span'); dot.className = 'dot'; bell.appendChild(dot);
      }
    });
  }

  function wireSearch(session) {
    var input = document.getElementById('gsearch'), menu = document.getElementById('search-menu'), form = document.getElementById('tb-search-form');
    var base = document.body.dataset.root || '';
    var studentsHref = base + (session.role === 'admin' ? 'admin' : 'teacher') + '/students.html';
    var ctxP = ED.data.context(session);
    input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase();
      if (q.length < 2) { menu.classList.remove('open'); return; }
      Promise.all([ctxP, ED.storage.getAll('students'), ED.storage.getAll('teachers')]).then(function (r) {
        var ctx = r[0];
        var st = r[1].filter(function (s) { var dq = F.digits(q); return (ctx.isAdmin || ctx.canAccess(s.classId)) && (s.name.toLowerCase().indexOf(q) >= 0 || String(s.rollNo) === q || (dq.length >= 4 && (F.digits(s.fatherCnic).indexOf(dq) >= 0 || F.digits(s.bForm).indexOf(dq) >= 0))); }).slice(0, 5);
        var ts = ctx.isAdmin ? r[2].filter(function (t) { return t.name.toLowerCase().indexOf(q) >= 0; }).slice(0, 3) : [];
        var html = st.map(function (s) { return '<a class="menu-item" href="' + studentsHref + '?q=' + encodeURIComponent(s.name) + '">' + I.svg('students', 16) + '<span>' + F.esc(s.name) + ' <span class="muted small">Student</span></span></a>'; }).join('') +
          ts.map(function (t) { return '<a class="menu-item" href="' + base + 'admin/teachers.html?q=' + encodeURIComponent(t.name) + '">' + I.svg('teachers', 16) + '<span>' + F.esc(t.name) + ' <span class="muted small">Teacher</span></span></a>'; }).join('');
        menu.innerHTML = html || '<div class="menu-empty">No results for "' + F.esc(input.value) + '"</div>';
        menu.classList.add('open');
      });
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('.tb-search-wrap')) menu.classList.remove('open'); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = input.value.trim();
      if (q) location.href = studentsHref + '?q=' + encodeURIComponent(q);
    });
  }

  /* opts: { role: 'admin' | 'teacher', active: 'dashboard' } */
  function init(opts) {
    var session = ED.auth.guard(opts.role);
    if (!session) return Promise.resolve(null);
    return ED.seed.ensure().then(ED.data.initBatchMeta).then(function () {
      var base = document.body.dataset.root || '';

      var aside = document.createElement('aside');
      aside.className = 'sidebar';
      aside.id = 'sidebar';
      aside.setAttribute('aria-label', 'Sidebar');
      aside.innerHTML = sidebarHTML(session.role, opts.active, base, session);
      var overlay = document.createElement('div');
      overlay.className = 'sb-overlay';
      document.body.prepend(overlay);
      document.body.prepend(aside);

      document.getElementById('topbar').outerHTML = '<div class="topbar-wrap" id="topbar">' + topbarHTML(session, base) + '</div>';
      wire();
      wireSearch(session);
      loadNotifications(session);
      syncAria();
      document.body.dataset.ready = 'true';
      return session;
    });
  }

  window.ED = window.ED || {};
  ED.shell = { init: init, setSidebar: setSidebar, toggle: toggleSidebar };
})();
