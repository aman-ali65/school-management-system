/* Photo-to-marks extraction. DEMO ONLY: it produces plausible marks with confidence scores so the
   upload, review and verify flow can be used end to end. When the backend is ready, replace the body
   of extract() with a real OCR / vision API call that returns the same row shape:
   [{ studentId, marks, confidence }]  (confidence from 0 to 1, marks null when unreadable). */
(function () {
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  window.ED = window.ED || {};
  ED.ocr = {
    isDemo: true,
    /* opts: { exam, students, images:[dataUrl], onProgress(pct) } */
    extract: function (opts) {
      var students = opts.students, n = Math.max(1, opts.images.length), per = Math.ceil(students.length / n);
      var r = rng(opts.images.reduce(function (a, s) { return a + s.length; }, 0) % 100000 + students.length);
      return new Promise(function (resolve) {
        var rows = [], i = 0;
        (function step() {
          if (i >= n) { resolve(rows); return; }
          students.slice(i * per, (i + 1) * per).forEach(function (s) {
            var conf = 0.55 + r() * 0.44;
            var marks = Math.round(opts.exam.totalMarks * (0.4 + r() * 0.55));
            rows.push({ studentId: s.id, marks: conf < 0.6 ? null : marks, confidence: Math.round(conf * 100) / 100 });
          });
          i++;
          if (opts.onProgress) opts.onProgress(Math.round(i / n * 100));
          setTimeout(step, 450);
        })();
      });
    }
  };
})();
