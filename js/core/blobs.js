/* IndexedDB store for big files (student papers). localStorage is only about 5 MB, IndexedDB holds far more.
   API: ED.blobs.put(id, dataUrl), get(id), del(id), exportAll(), importAll(map), estimate() */
(function () {
  var DB = 'edudesk-blobs', STORE = 'files', dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      if (!window.indexedDB) { rej(new Error('IndexedDB is not available in this browser')); return; }
      var rq = indexedDB.open(DB, 1);
      rq.onupgradeneeded = function () { rq.result.createObjectStore(STORE); };
      rq.onsuccess = function () { res(rq.result); };
      rq.onerror = function () { rej(rq.error); };
    });
    return dbp;
  }
  function run(mode, fn) {
    return open().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction(STORE, mode), st = tx.objectStore(STORE), out = fn(st);
        tx.oncomplete = function () { res(out && out.result !== undefined ? out.result : undefined); };
        tx.onerror = function () { rej(tx.error); };
        tx.onabort = function () { rej(tx.error); };
      });
    });
  }
  window.ED = window.ED || {};
  ED.blobs = {
    put: function (id, data) { return run('readwrite', function (st) { st.put(data, id); }); },
    get: function (id) { return run('readonly', function (st) { return st.get(id); }); },
    del: function (id) { return run('readwrite', function (st) { st.delete(id); }); },
    delMany: function (ids) { return run('readwrite', function (st) { ids.forEach(function (i) { st.delete(i); }); }); },
    exportAll: function () {
      return open().then(function (db) {
        return new Promise(function (res, rej) {
          var out = {}, rq = db.transaction(STORE, 'readonly').objectStore(STORE).openCursor();
          rq.onsuccess = function () { var c = rq.result; if (c) { out[c.key] = c.value; c.continue(); } else res(out); };
          rq.onerror = function () { rej(rq.error); };
        });
      });
    },
    importAll: function (map) {
      return run('readwrite', function (st) { st.clear(); Object.keys(map || {}).forEach(function (k) { st.put(map[k], k); }); });
    },
    clear: function () { return run('readwrite', function (st) { st.clear(); }); },
    estimate: function () { return navigator.storage && navigator.storage.estimate ? navigator.storage.estimate() : Promise.resolve({}); }
  };
})();
