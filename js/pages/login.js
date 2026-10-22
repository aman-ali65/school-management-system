(function () {
  var I = ED.icons;

  ED.seed.ensure().then(function () {
    var s = ED.auth.session();
    if (s) { location.replace(ED.auth.homeFor(s.role)); return; }
    init();
  });

  function init() {
    var form = document.getElementById('login-form');
    var email = document.getElementById('email');
    var pw = document.getElementById('password');
    var remember = document.getElementById('remember');
    var err = document.getElementById('login-error');
    var btn = document.getElementById('login-btn');
    var toggle = document.getElementById('toggle-pw');
    var cycle = document.getElementById('theme-cycle');

    document.getElementById('login-logo').innerHTML = I.svg('school', 18);
    toggle.innerHTML = I.svg('eye', 18);

    /* theme: light -> dark -> system */
    var ORDER = ['light', 'dark', 'system'];
    var ICON = { light: 'sun', dark: 'moon', system: 'monitor' };
    function paintTheme() {
      var c = ED.theme.get();
      cycle.innerHTML = I.svg(ICON[c], 18);
      cycle.title = 'Theme: ' + c;
    }
    cycle.addEventListener('click', function () {
      ED.theme.set(ORDER[(ORDER.indexOf(ED.theme.get()) + 1) % ORDER.length]);
      paintTheme();
    });
    paintTheme();

    toggle.addEventListener('click', function () {
      var show = pw.type === 'password';
      pw.type = show ? 'text' : 'password';
      toggle.innerHTML = I.svg(show ? 'eyeOff' : 'eye', 18);
      toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });

    document.querySelectorAll('[data-fill]').forEach(function (b) {
      b.addEventListener('click', function () {
        var admin = b.dataset.fill === 'admin';
        email.value = admin ? 'admin@edudesk.pk' : 'teacher@edudesk.pk';
        pw.value = admin ? 'admin123' : 'teacher123';
        err.hidden = true;
        pw.focus();
      });
    });

    document.getElementById('reset-demo').addEventListener('click', function (e) {
      e.preventDefault();
      ED.ui.confirm({
        title: 'Reset demo data',
        message: 'This deletes everything saved in this browser and loads the demo data again.',
        confirmLabel: 'Reset data', danger: true
      }).then(function (ok) {
        if (ok) { ED.seed.reset(); ED.ui.toast('Demo data restored', 'success'); }
      });
    });

    function showError(msg, field) {
      err.textContent = msg;
      err.hidden = false;
      email.removeAttribute('aria-invalid'); pw.removeAttribute('aria-invalid');
      if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      err.hidden = true;
      if (!email.value.trim()) return showError('Enter your email.', email);
      if (!pw.value) return showError('Enter your password.', pw);

      btn.setAttribute('aria-busy', 'true');
      btn.textContent = 'Signing in...';
      ED.auth.login(email.value, pw.value, remember.checked).then(function (r) {
        if (!r.ok) {
          btn.removeAttribute('aria-busy');
          btn.textContent = 'Sign in';
          return showError(r.error, pw);
        }
        location.href = ED.auth.homeFor(r.session.role);
      });
    });
  }
})();
