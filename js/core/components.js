/* Reusable UI building blocks used by every page. */
(function () {
  var F = ED.fmt, I = ED.icons, U = ED.ui, h = F.esc;

  /* ---------- small helpers ---------- */
  var ATT = { P: ['Present', 'present'], A: ['Absent', 'absent'], L: ['Late', 'late'], LV: ['Leave', 'leave'] };
  var EXAM = { pending: ['Pending', ''], extracted: ['Extracted', 'late'], verified: ['Verified', 'primary'], published: ['Published', 'present'] };
  var FEE = { paid: ['Paid', 'present'], partial: ['Partial', 'late'], unpaid: ['Unpaid', 'absent'] };
  var MAPS = { att: ATT, exam: EXAM, fee: FEE, active: { active: ['Active', 'present'], inactive: ['Inactive', ''] }, wa: { queued: ['Queued', 'late'], opened: ['Opened', 'present'], sent: ['Sent', 'present'], failed: ['Failed', 'absent'] }, salary: { paid: ['Paid', 'present'], pending: ['Pending', 'late'] } };

  U.badge = function (text, cls) { return '<span class="badge' + (cls ? ' badge-' + cls : '') + '">' + h(text) + '</span>'; };
  U.statusBadge = function (kind, code) {
    var m = (MAPS[kind] || {})[code] || [code, ''];
    return U.badge(m[0], m[1]);
  };
  U.statLabel = function (kind, code) { return ((MAPS[kind] || {})[code] || [code])[0]; };
  U.pageHead = function (title, sub, actions) {
    return '<div class="page-head"><div><h1>' + h(title) + '</h1>' + (sub ? '<p class="muted">' + h(sub) + '</p>' : '') + '</div>' +
      '<div class="row" style="flex-wrap:wrap">' + (actions || '') + '</div></div>';
  };
  U.stat = function (label, value, sub, cls, href) {
    var inner = '<div class="stat-label">' + h(label) + '</div><div class="stat-value ' + (cls || '') + '">' + value + '</div><div class="stat-sub">' + (sub || '') + '</div>';
    return href ? '<a class="card stat stat-link" href="' + href + '">' + inner + '</a>' : '<div class="card stat">' + inner + '</div>';
  };
  U.empty = function (icon, title, msg) {
    return '<div class="empty"><div class="icon">' + I.svg(icon || 'inbox', 20) + '</div><h3>' + h(title) + '</h3>' + (msg ? '<p>' + h(msg) + '</p>' : '') + '</div>';
  };
  U.avatar = function (name) { return '<span class="avatar">' + h(F.initials(name)) + '</span>'; };
  U.btn = function (label, opts) {
    opts = opts || {};
    return '<button type="button" class="btn btn-' + (opts.variant || 'secondary') + (opts.small ? ' btn-sm' : '') + '"' + (opts.id ? ' id="' + opts.id + '"' : '') + (opts.attrs ? ' ' + opts.attrs : '') + '>' + (opts.icon ? I.svg(opts.icon, 16) : '') + h(label) + '</button>';
  };
  U.options = function (list, valueKey, labelFn, selected) {
    return list.map(function (x) {
      var v = typeof valueKey === 'function' ? valueKey(x) : x[valueKey];
      return '<option value="' + h(v) + '"' + (String(v) === String(selected) ? ' selected' : '') + '>' + h(labelFn(x)) + '</option>';
    }).join('');
  };
  U.field = function (label, control, id) { return '<div class="field"><label' + (id ? ' for="' + id + '"' : '') + '>' + h(label) + '</label>' + control + '</div>'; };

  /* ---------- download, CSV, files, images ---------- */
  U.download = function (name, content, mime) {
    var blob = new Blob([content], { type: mime || 'text/plain' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  };
  U.toCSV = function (rows) {
    return rows.map(function (r) {
      return r.map(function (c) {
        c = c === null || c === undefined ? '' : String(c);
        return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c;
      }).join(',');
    }).join('\r\n');
  };
  U.parseCSV = function (text) {
    var rows = [], row = [], cell = '', q = false;
    text = text.replace(/^\uFEFF/, '');
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') q = false;
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
      } else cell += c;
    }
    row.push(cell);
    if (row.length > 1 || row[0] !== '') rows.push(row);
    return rows;
  };
  U.readText = function (file) {
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsText(file); });
  };
  U.compressImage = function (file, max, q) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () {
        var img = new Image();
        img.onload = function () {
          var s = Math.min(1, (max || 800) / Math.max(img.width, img.height));
          var c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.width * s)); c.height = Math.max(1, Math.round(img.height * s));
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          res(c.toDataURL('image/jpeg', q || 0.7));
        };
        img.onerror = function () { rej(new Error('Not an image')); };
        img.src = r.result;
      };
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  };

  /* ---------- print (hidden iframe) ---------- */
  var PRINT_CSS =
    'body{font-family:Inter,Arial,sans-serif;color:#111;font-size:13px;margin:24px}h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:16px 0 6px}' +
    'table{width:100%;border-collapse:collapse;margin:8px 0}th,td{border:1px solid #bbb;padding:6px 8px;text-align:left}th{background:#f1f1f1}td.n,th.n{text-align:right}' +
    '.hd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:12px}.muted{color:#555}' +
    '.box{border:1px solid #999;padding:10px;border-radius:6px;margin:8px 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px}.tot td{font-weight:700}' +
    '.card-id{width:340px;height:215px;border:2px solid #4F46E5;border-radius:12px;padding:12px;display:inline-block;margin:8px;vertical-align:top;position:relative;page-break-inside:avoid}' +
    '.card-id .ph{width:70px;height:84px;border:1px solid #999;border-radius:6px;float:right;display:flex;align-items:center;justify-content:center;font-size:26px;color:#4F46E5;background:#EEF2FF}' +
    '.pb{page-break-after:always}.sig{margin-top:40px;display:flex;justify-content:space-between}.sig div{border-top:1px solid #111;padding-top:4px;width:180px;text-align:center}' +
    '@media print{.noprint{display:none}}';
  U.print = function (html, title) {
    var f = document.createElement('iframe');
    f.setAttribute('aria-hidden', 'true');
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(f);
    var d = f.contentWindow.document;
    d.open();
    d.write('<!doctype html><html><head><meta charset="utf-8"><title>' + h(title || 'Print') + '</title><style>' + PRINT_CSS + '</style></head><body>' + html + '</body></html>');
    d.close();
    setTimeout(function () {
      try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) {}
      setTimeout(function () { f.remove(); }, 2000);
    }, 250);
  };
  U.docHeader = function (settings, title, sub) {
    return '<div class="hd"><div><h1>' + h(settings.schoolName || 'School') + '</h1><div class="muted">' + h(settings.address || '') + (settings.phone ? ' | ' + h(settings.phone) : '') + '</div></div>' +
      '<div style="text-align:right"><h2 style="margin:0">' + h(title) + '</h2><div class="muted">' + h(sub || '') + '</div></div></div>';
  };

  /* ---------- tabs ---------- */
  U.tabs = function (el, tabs, opt) {
    opt = opt || {};
    el.innerHTML = '<div class="tabs" role="tablist"></div><div class="tab-panel" role="tabpanel"></div>';
    var bar = el.querySelector('.tabs'), panel = el.querySelector('.tab-panel'), cur = null;
    tabs.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'tab'; b.setAttribute('role', 'tab'); b.dataset.tab = t.id; b.textContent = t.label;
      b.addEventListener('click', function () { select(t.id); });
      bar.appendChild(b);
    });
    function select(id) {
      var t = tabs.find(function (x) { return x.id === id; }) || tabs[0];
      cur = t.id;
      bar.querySelectorAll('.tab').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.tab === cur)); });
      panel.innerHTML = '';
      t.render(panel);
      if (opt.onChange) opt.onChange(cur);
    }
    select(opt.initial || tabs[0].id);
    return { select: select, current: function () { return cur; }, panel: panel };
  };

  /* ---------- data table ---------- */
  /* opt: { rows, columns:[{key,label,render(row),sort(row),num,sortable}], actions:[{id,label,icon,danger,show(row),onClick(row)}],
            search(row)->string, searchPlaceholder, pageSize, selectable, onSelect(rows), empty:{icon,title,message}, toolbar (html), onToolbar(el), onRowClick } */
  U.table = function (el, opt) {
    var rows = opt.rows || [], cols = opt.columns, size = opt.pageSize || 10;
    var st = { q: '', key: null, dir: 1, page: 1 }, sel = {};
    el.classList.add('dt');
    el.innerHTML = '<div class="table-toolbar"></div><div class="table-wrap"><table class="table"></table></div><div class="table-foot"></div>';
    var bar = el.querySelector('.table-toolbar'), tbl = el.querySelector('table'), foot = el.querySelector('.table-foot');

    if (opt.search || opt.toolbar) {
      bar.innerHTML = (opt.search ? '<div class="grow">' + I.svg('search', 16) + '<input class="input" type="search" data-q placeholder="' + h(opt.searchPlaceholder || 'Search') + '" aria-label="Search table"></div>' : '') + (opt.toolbar || '');
      if (opt.onToolbar) opt.onToolbar(bar);
    }

    function list() {
      var r = rows;
      if (st.q && opt.search) { var q = st.q.toLowerCase(); r = r.filter(function (x) { return String(opt.search(x)).toLowerCase().indexOf(q) >= 0; }); }
      if (st.key) {
        var c = cols.filter(function (x) { return x.key === st.key; })[0];
        var f = c.sort || function (x) { return x[c.key]; };
        r = r.slice().sort(function (a, b) {
          var A = f(a), B = f(b);
          if (A === null || A === undefined) A = ''; if (B === null || B === undefined) B = '';
          if (typeof A === 'string' && typeof B === 'string') return A.localeCompare(B, undefined, { numeric: true }) * st.dir;
          return (A > B ? 1 : A < B ? -1 : 0) * st.dir;
        });
      }
      return r;
    }
    function selectedRows() { return rows.filter(function (r) { return sel[r.id]; }); }

    function render() {
      var all = list(), pages = Math.max(1, Math.ceil(all.length / size));
      if (st.page > pages) st.page = pages;
      var view = all.slice((st.page - 1) * size, st.page * size);
      var allSel = all.length && all.every(function (r) { return sel[r.id]; });
      var head = '<thead><tr>' + (opt.selectable ? '<th class="col-check"><input type="checkbox" data-all aria-label="Select all"' + (allSel ? ' checked' : '') + '></th>' : '') +
        cols.map(function (c) {
          var sortable = c.sortable !== false && (c.sort || c.key);
          var ind = st.key === c.key ? (st.dir === 1 ? ' &#9650;' : ' &#9660;') : '';
          return '<th class="' + (c.num ? 'num' : '') + '"' + (sortable && st.key === c.key ? ' aria-sort="' + (st.dir === 1 ? 'ascending' : 'descending') + '"' : '') + '>' +
            (sortable ? '<button type="button" class="th-sort" data-sort="' + c.key + '">' + h(c.label) + '<span aria-hidden="true" style="font-size:9px">' + ind + '</span></button>' : h(c.label)) + '</th>';
        }).join('') + (opt.actions ? '<th class="num"><span class="sr-only">Actions</span></th>' : '') + '</tr></thead>';
      var body = '<tbody>' + view.map(function (r) {
        return '<tr data-id="' + h(r.id) + '"' + (opt.onRowClick ? ' style="cursor:pointer"' : '') + '>' +
          (opt.selectable ? '<td class="col-check"><input type="checkbox" data-sel="' + h(r.id) + '"' + (sel[r.id] ? ' checked' : '') + ' aria-label="Select row"></td>' : '') +
          cols.map(function (c, ci) { return '<td class="' + (c.num ? 'num' : '') + (ci === 0 ? ' td-title' : '') + '" data-label="' + h(c.label) + '">' + (c.render ? c.render(r) : h(r[c.key])) + '</td>'; }).join('') +
          (opt.actions ? '<td class="td-actions"><div class="row-actions">' + opt.actions.filter(function (a) { return !a.show || a.show(r); }).map(function (a) {
            return '<button type="button" class="icon-btn' + (a.danger ? ' danger' : '') + '" data-act="' + a.id + '" data-id="' + h(r.id) + '" title="' + h(a.label) + '" aria-label="' + h(a.label) + '">' + I.svg(a.icon || 'info', 16) + '</button>';
          }).join('') + '</div></td>' : '') + '</tr>';
      }).join('') + '</tbody>';
      tbl.className = 'table rowcards';
      tbl.innerHTML = head + body;
      var emptyEl = el.querySelector('.dt-empty');
      if (emptyEl) emptyEl.remove();
      if (!view.length) {
        var e = opt.empty || { icon: 'inbox', title: 'Nothing here yet', message: '' };
        var d = document.createElement('div'); d.className = 'dt-empty';
        d.innerHTML = U.empty(e.icon, st.q ? 'No matches' : e.title, st.q ? 'Try a different search.' : e.message);
        el.querySelector('.table-wrap').after(d);
      }
      var n = selectedRows().length;
      foot.innerHTML = all.length ?
        '<span>' + ((st.page - 1) * size + 1) + '-' + Math.min(st.page * size, all.length) + ' of ' + all.length + (n ? ' | ' + n + ' selected' : '') + '</span>' +
        (pages > 1 ? '<span class="row"><button type="button" class="btn btn-secondary btn-sm" data-page="prev"' + (st.page === 1 ? ' disabled' : '') + '>Previous</button><span>Page ' + st.page + ' of ' + pages + '</span><button type="button" class="btn btn-secondary btn-sm" data-page="next"' + (st.page === pages ? ' disabled' : '') + '>Next</button></span>' : '') : '';
    }

    el.addEventListener('input', function (e) {
      if (e.target.matches('[data-q]')) { st.q = e.target.value; st.page = 1; render(); var i = el.querySelector('[data-q]'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
    });
    el.addEventListener('change', function (e) {
      if (e.target.matches('[data-sel]')) { sel[e.target.dataset.sel] = e.target.checked; render(); if (opt.onSelect) opt.onSelect(selectedRows()); }
      if (e.target.matches('[data-all]')) { var on = e.target.checked; list().forEach(function (r) { sel[r.id] = on; }); render(); if (opt.onSelect) opt.onSelect(selectedRows()); }
    });
    el.addEventListener('click', function (e) {
      var s = e.target.closest('[data-sort]');
      if (s) { if (st.key === s.dataset.sort) st.dir = -st.dir; else { st.key = s.dataset.sort; st.dir = 1; } render(); return; }
      var p = e.target.closest('[data-page]');
      if (p) { st.page += p.dataset.page === 'next' ? 1 : -1; render(); return; }
      var a = e.target.closest('[data-act]');
      if (a) {
        var act = opt.actions.filter(function (x) { return x.id === a.dataset.act; })[0];
        var row = rows.filter(function (r) { return String(r.id) === a.dataset.id; })[0];
        if (act && row) act.onClick(row);
        return;
      }
      if (opt.onRowClick && !e.target.closest('input,button,a')) {
        var tr = e.target.closest('tr[data-id]');
        if (tr) { var rr = rows.filter(function (r) { return String(r.id) === tr.dataset.id; })[0]; if (rr) opt.onRowClick(rr); }
      }
    });

    render();
    return {
      setRows: function (r, keepPage) { rows = r; if (!keepPage) st.page = 1; render(); },
      getRows: function () { return rows; },
      visible: list,
      selected: selectedRows,
      clearSelection: function () { sel = {}; render(); if (opt.onSelect) opt.onSelect([]); },
      refresh: render
    };
  };

  /* ---------- form modal ---------- */
  /* opt: { title, fields:[{name,label,type,options,required,hint,value,min,max,step,placeholder,full,disabled}], value, submitLabel, size, validate(values)->string|null (may be async) }
     Resolves with the values object, or null if cancelled. */
  U.form = function (opt) {
    var fields = opt.fields, v = opt.value || {};
    var out = null;
    function attr(f) {
      var a = '';
      ['min', 'max', 'step', 'placeholder', 'maxlength'].forEach(function (k) { if (f[k] !== undefined) a += ' ' + k + '="' + h(f[k]) + '"'; });
      if (f.disabled) a += ' disabled';
      if (f.autocomplete) a += ' autocomplete="' + f.autocomplete + '"';
      return a;
    }
    var html = '<div class="form-grid">' + fields.map(function (f) {
      var id = 'f_' + f.name, val = v[f.name] !== undefined && v[f.name] !== null ? v[f.name] : (f.value !== undefined ? f.value : '');
      var hint = f.hint ? '<span class="hint">' + h(f.hint) + '</span>' : '';
      if (f.type === 'checkbox') return '<div class="field full"><label class="check"><input type="checkbox" id="' + id + '"' + (val ? ' checked' : '') + (f.disabled ? ' disabled' : '') + '> ' + h(f.label) + '</label>' + hint + '</div>';
      var ctl;
      if (f.type === 'select') ctl = '<select class="select" id="' + id + '"' + attr(f) + '>' + (f.placeholder ? '<option value="">' + h(f.placeholder) + '</option>' : '') +
        f.options.map(function (o) { return '<option value="' + h(o.value) + '"' + (String(o.value) === String(val) ? ' selected' : '') + '>' + h(o.label) + '</option>'; }).join('') + '</select>';
      else if (f.type === 'textarea') ctl = '<textarea class="textarea" id="' + id + '"' + attr(f) + '>' + h(val) + '</textarea>';
      else if (f.type === 'file') ctl = '<input class="input" type="file" accept="image/*" id="' + id + '">' + (val ? '<img class="thumb" alt="Current" src="' + h(val) + '">' : '');
      else ctl = '<input class="input" type="' + (f.type || 'text') + '" id="' + id + '" value="' + h(val) + '"' + attr(f) + '>';
      return '<div class="field' + (f.full || f.type === 'textarea' ? ' full' : '') + '"><label for="' + id + '">' + h(f.label) + (f.required ? ' <span class="req">*</span>' : '') + '</label>' + ctl + hint + '</div>';
    }).join('') + '</div><div class="form-error" id="form-error" role="alert" hidden></div>';
    var body = document.createElement('div');
    body.className = 'stack'; body.innerHTML = html;
    body.querySelectorAll('input[type=file]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        if (!inp.files[0]) return;
        U.compressImage(inp.files[0], 700, 0.6).then(function (d) { inp._data = d; }).catch(function () { U.toast('That file is not an image.', 'danger'); inp.value = ''; });
      });
    });

    function read(box) {
      var o = {};
      fields.forEach(function (f) {
        var el = box.querySelector('#f_' + f.name);
        if (!el) return;
        if (f.type === 'checkbox') o[f.name] = el.checked;
        else if (f.type === 'number') o[f.name] = el.value === '' ? null : Number(el.value);
        else if (f.type === 'file') o[f.name] = el._data !== undefined ? el._data : (v[f.name] || '');
        else o[f.name] = el.value.trim();
      });
      return o;
    }
    return U.modal({
      title: opt.title, body: body, size: opt.size,
      actions: [
        { label: 'Cancel', variant: 'secondary', value: false },
        { label: opt.submitLabel || 'Save', variant: 'primary', value: true, onClick: function (box) {
          var err = box.querySelector('#form-error');
          function fail(m, name) { err.textContent = m; err.hidden = false; var el = name && box.querySelector('#f_' + name); if (el) { el.setAttribute('aria-invalid', 'true'); el.focus(); } return false; }
          box.querySelectorAll('[aria-invalid]').forEach(function (x) { x.removeAttribute('aria-invalid'); });
          var vals = read(box);
          for (var i = 0; i < fields.length; i++) {
            var f = fields[i], x = vals[f.name];
            if (f.required && (x === '' || x === null || x === undefined || (typeof x === 'number' && isNaN(x)))) return fail(f.label + ' is required.', f.name);
            if (f.type === 'number' && x !== null) {
              if (f.min !== undefined && x < f.min) return fail(f.label + ' must be at least ' + f.min + '.', f.name);
              if (f.max !== undefined && x > f.max) return fail(f.label + ' must be at most ' + f.max + '.', f.name);
            }
            if (f.type === 'email' && x && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)) return fail('Enter a valid email address.', f.name);
          }
          return Promise.resolve(opt.validate ? opt.validate(vals) : null).then(function (m) {
            if (m) return fail(typeof m === 'string' ? m : m.message, typeof m === 'string' ? null : m.field);
            out = vals;
          });
        } }
      ]
    }).then(function (r) { return r === true ? out : null; });
  };

  U.view = function (title, html, size) {
    return U.modal({ title: title, body: html, size: size, actions: [{ label: 'Close', variant: 'secondary', value: true }] });
  };
})();
