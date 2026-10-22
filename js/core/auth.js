/* Front-end only login. It protects pages for demo and testing; real security
   (password hashing, tokens) must come from the backend later. */
(function () {
  var KEY = 'edudesk:session';
  var DAY = 24 * 60 * 60 * 1000;

  /* cyrb53: small non-crypto hash, only so demo passwords are not stored as plain text */
  function hash(str) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0; i < str.length; i++) {
      var ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }

  function root() { return document.body.dataset.root || ''; }
  function homeFor(role) { return role === 'admin' ? 'admin/dashboard.html' : 'teacher/dashboard.html'; }

  function session() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      if (!s || s.exp < Date.now()) { localStorage.removeItem(KEY); return null; }
      return s;
    } catch (e) { return null; }
  }

  var auth = {
    hash: hash,
    session: session,
    homeFor: homeFor,

    login: function (email, password, remember) {
      return ED.storage.getAll('users').then(function (users) {
        var u = users.find(function (x) { return x.email.toLowerCase() === String(email).trim().toLowerCase(); });
        if (!u || u.status !== 'active' || u.passwordHash !== hash(password)) {
          return { ok: false, error: 'Incorrect email or password.' };
        }
        var s = {
          userId: u.id, name: u.name, email: u.email, role: u.role, teacherId: u.teacherId || null,
          exp: Date.now() + (remember ? 7 * DAY : 12 * 60 * 60 * 1000)
        };
        localStorage.setItem(KEY, JSON.stringify(s));
        return { ok: true, session: s };
      });
    },

    logout: function () {
      localStorage.removeItem(KEY);
      location.href = root() + 'index.html';
    },

    /* Call at the top of every protected page. Returns the session, or null after redirecting. */
    guard: function (role) {
      var s = session();
      if (!s) { location.replace(root() + 'index.html'); return null; }
      if (role && s.role !== role) { location.replace(root() + homeFor(s.role)); return null; }
      return s;
    },

    changePassword: function (current, next) {
      var s = session();
      if (!s) return Promise.resolve({ ok: false, error: 'Your session has expired. Sign in again.' });
      return ED.storage.getById('users', s.userId).then(function (u) {
        if (!u || u.passwordHash !== hash(current)) return { ok: false, error: 'Current password is incorrect.' };
        return ED.storage.update('users', u.id, { passwordHash: hash(next) }).then(function () { return { ok: true }; });
      });
    }
  };

  window.ED = window.ED || {};
  ED.auth = auth;
})();
