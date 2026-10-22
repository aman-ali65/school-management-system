/* Small UI helpers: toast, modal, confirm. */
(function () {
  var I = ED.icons;

  function toast(message, type) {
    type = type || 'info';
    var stack = document.querySelector('.toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      stack.setAttribute('role', 'status');
      stack.setAttribute('aria-live', 'polite');
      document.body.appendChild(stack);
    }
    var el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.innerHTML = I.svg(type === 'success' ? 'check' : 'info', 18) + '<span></span>';
    el.querySelector('span').textContent = message;
    stack.appendChild(el);
    setTimeout(function () { el.remove(); }, 3500);
  }

  function focusables(root) {
    return Array.prototype.slice.call(root.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'));
  }

  /* modal({ title, body (HTML string or Node), actions: [{ label, variant, value, onClick }] })
     Resolves with the clicked action's value (or null if dismissed).
     If an onClick returns false the modal stays open (use it for validation). */
  function modal(opts) {
    return new Promise(function (resolve) {
      var previous = document.activeElement;
      var ov = document.createElement('div');
      ov.className = 'modal-overlay';
      ov.innerHTML =
        '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">' +
        '<div class="modal-head"><h2 id="modal-title"></h2>' +
        '<button type="button" class="icon-btn" data-close aria-label="Close">' + I.svg('x', 18) + '</button></div>' +
        '<div class="modal-body"></div><div class="modal-foot"></div></div>';
      var box = ov.querySelector('.modal');
      if (opts.size) box.classList.add(opts.size);
      ov.querySelector('h2').textContent = opts.title || '';
      var body = ov.querySelector('.modal-body');
      if (typeof opts.body === 'string') body.innerHTML = opts.body; else if (opts.body) body.appendChild(opts.body);

      function close(value) {
        document.removeEventListener('keydown', onKey, true);
        ov.remove();
        if (previous && previous.focus) previous.focus();
        resolve(value);
      }
      function onKey(e) {
        var all = document.querySelectorAll('.modal-overlay'); if (all[all.length - 1] !== ov) return;
        if (e.key === 'Escape') { e.stopPropagation(); close(null); }
        if (e.key === 'Tab') {
          var f = focusables(box);
          if (!f.length) return;
          var first = f[0], last = f[f.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }

      var foot = ov.querySelector('.modal-foot');
      (opts.actions || [{ label: 'Close', variant: 'secondary', value: true }]).forEach(function (a) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn btn-' + (a.variant || 'secondary');
        b.textContent = a.label;
        b.addEventListener('click', function () {
          Promise.resolve(a.onClick ? a.onClick(box) : undefined).then(function (r) {
            if (r === false) return;
            close(a.value !== undefined ? a.value : true);
          });
        });
        foot.appendChild(b);
      });

      ov.addEventListener('mousedown', function (e) { if (e.target === ov) close(null); });
      ov.querySelector('[data-close]').addEventListener('click', function () { close(null); });
      document.addEventListener('keydown', onKey, true);
      document.body.appendChild(ov);

      var first = body.querySelector('input, select, textarea') || foot.lastElementChild;
      if (first) first.focus();
    });
  }

  function confirm(opts) {
    var p = document.createElement('p');
    p.textContent = opts.message || '';
    return modal({
      title: opts.title || 'Are you sure?',
      body: p,
      actions: [
        { label: opts.cancelLabel || 'Cancel', variant: 'secondary', value: false },
        { label: opts.confirmLabel || 'Confirm', variant: opts.danger ? 'danger' : 'primary', value: true }
      ]
    }).then(function (v) { return v === true; });
  }

  /* For menu items that belong to a later build phase */
  function soon(label, phase) {
    toast(label + ' is planned for Phase ' + phase + '.', 'info');
  }

  window.ED = window.ED || {};
  ED.ui = { toast: toast, modal: modal, confirm: confirm, soon: soon };
})();
