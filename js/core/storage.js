/* Storage layer. All functions are async so pages never change when this
   file is replaced by real API calls (fetch) after the backend is ready. */
(function () {
  var NS = 'edudesk:';

  function readList(col) {
    try { return JSON.parse(localStorage.getItem(NS + col)) || []; }
    catch (e) { return []; }
  }
  function safeSet(key, value) {
    try { localStorage.setItem(key, value); return true; }
    catch (e) {
      if (window.ED && ED.ui) ED.ui.toast('Browser storage is full, the last change was not saved. Export a backup and remove old photos.', 'danger');
      return false;
    }
  }
  function writeList(col, arr) { return safeSet(NS + col, JSON.stringify(arr)); }
  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  function now() { return new Date().toISOString(); }

  var storage = {
    uid: uid,
    NS: NS,

    getAll: function (col) { return Promise.resolve(readList(col)); },
    getById: function (col, id) {
      return Promise.resolve(readList(col).find(function (r) { return r.id === id; }) || null);
    },
    query: function (col, fn) { return Promise.resolve(readList(col).filter(fn)); },
    insert: function (col, rec) {
      var arr = readList(col);
      var row = Object.assign({ id: uid(), createdAt: now(), updatedAt: now() }, rec);
      arr.push(row);
      writeList(col, arr);
      return Promise.resolve(row);
    },
    update: function (col, id, patch) {
      var arr = readList(col), found = null;
      arr = arr.map(function (r) {
        if (r.id !== id) return r;
        found = Object.assign({}, r, patch, { updatedAt: now() });
        return found;
      });
      writeList(col, arr);
      return Promise.resolve(found);
    },
    remove: function (col, id) {
      writeList(col, readList(col).filter(function (r) { return r.id !== id; }));
      return Promise.resolve(true);
    },
    replaceAll: function (col, arr) { writeList(col, arr); return Promise.resolve(arr); },

    /* single-object records (e.g. settings) */
    getObject: function (key, fallback) {
      try {
        var v = JSON.parse(localStorage.getItem(NS + key));
        return Promise.resolve(v === null || v === undefined ? (fallback || {}) : v);
      } catch (e) { return Promise.resolve(fallback || {}); }
    },
    setObject: function (key, value) {
      safeSet(NS + key, JSON.stringify(value));
      return Promise.resolve(value);
    },

    exportAll: function () {
      var out = {};
      Object.keys(localStorage).forEach(function (k) {
        if (k.indexOf(NS) === 0 && ['theme', 'sidebar', 'session'].indexOf(k.slice(NS.length)) < 0) out[k.slice(NS.length)] = localStorage.getItem(k);
      });
      return out;
    },
    importAll: function (obj) {
      storage.clearAll();
      Object.keys(obj).forEach(function (k) { localStorage.setItem(NS + k, obj[k]); });
    },
    usage: function () {
      var n = 0;
      Object.keys(localStorage).forEach(function (k) { if (k.indexOf(NS) === 0) n += (k.length + (localStorage.getItem(k) || '').length) * 2; });
      return n;
    },

    /* sync helpers, only for seed.js and boot code */
    _readList: readList,
    _writeList: writeList,
    clearAll: function () {
      Object.keys(localStorage).forEach(function (k) {
        if (k.indexOf(NS) === 0 && k !== NS + 'theme' && k !== NS + 'sidebar' && k !== NS + 'session') localStorage.removeItem(k);
      });
    }
  };

  window.ED = window.ED || {};
  ED.storage = storage;
})();
