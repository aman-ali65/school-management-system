/* Light, dark and system theme. The same logic also runs as a tiny inline
   script in every <head> so the page never flashes the wrong theme. */
(function () {
  var KEY = 'edudesk:theme';
  var mq = window.matchMedia('(prefers-color-scheme: dark)');

  function get() {
    var v = null;
    try { v = localStorage.getItem(KEY); } catch (e) {}
    return v === 'light' || v === 'dark' ? v : 'system';
  }
  function resolved(choice) {
    choice = choice || get();
    return choice === 'system' ? (mq.matches ? 'dark' : 'light') : choice;
  }
  function apply(choice) {
    document.documentElement.dataset.theme = resolved(choice);
    document.dispatchEvent(new CustomEvent('edudesk:theme', { detail: { choice: choice || get(), theme: resolved(choice) } }));
  }
  function set(choice) {
    try { localStorage.setItem(KEY, choice); } catch (e) {}
    apply(choice);
  }

  mq.addEventListener('change', function () { if (get() === 'system') apply('system'); });

  window.ED = window.ED || {};
  ED.theme = { get: get, set: set, apply: apply, resolved: resolved };
})();
