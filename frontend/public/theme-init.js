// Sets the theme before first paint so there is no wrong-theme flash. Loaded as an external, blocking script
// because the site CSP (script-src 'self') blocks inline scripts. Mirrors src/theme/theme.js:
// a stored 'light' or 'dark' wins; otherwise local hour 06:00 to 17:59 is day, else night.
(function () {
  try {
    var m = null; try { m = localStorage.getItem('agentboard.theme') } catch (e) {}
    var t;
    if (m === 'light' || m === 'dark') t = m;
    else { var h = new Date().getHours(); t = (h >= 6 && h < 18) ? 'light' : 'dark'; }
    var r = document.documentElement; r.dataset.theme = t; r.dataset.themeMode = (m === 'light' || m === 'dark') ? m : 'auto'; r.style.colorScheme = t;
    var mt = document.querySelector('meta[name="theme-color"]'); if (mt) mt.setAttribute('content', t === 'dark' ? '#09090B' : '#FFFFFF');
  } catch (e) { document.documentElement.dataset.theme = 'light'; }
})();
