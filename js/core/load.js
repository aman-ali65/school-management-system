/* Loads every core script in order, then the page script.
   Usage:  <script src="../js/core/load.js" data-root="../" data-page="students"></script> */
(function () {
  var cs = document.currentScript;
  var root = cs.dataset.root || '';
  var page = cs.dataset.page;
  var V = '4.0.1';
  var core = ['storage', 'format', 'icons', 'theme', 'auth', 'ui', 'components', 'charts', 'blobs', 'data', 'papers', 'money', 'seed', 'wa', 'ocr', 'shell'];
  var list = core.map(function (n) { return root + 'js/core/' + n + '.js'; });
  if (page) list.push(root + 'js/pages/' + page + '.js');
  list.forEach(function (src) {
    var s = document.createElement('script');
    s.src = src + '?v=' + V;
    s.async = false;
    document.body.appendChild(s);
  });
})();
