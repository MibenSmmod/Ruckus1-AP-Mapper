// Apply theme before CSS paint to avoid a flash. Default is dark; only 'light' opts out.
(function () {
  try {
    const theme = localStorage.getItem('r1-mapper-color-theme');
    if (theme !== 'light') {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch (_) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
