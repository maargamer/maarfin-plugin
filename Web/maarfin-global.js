(function () {
  'use strict';

  var preferenceKey = 'maarfin.theme.enabled';

  function applyTheme() {
    var enabled = true;
    try {
      enabled = window.localStorage.getItem(preferenceKey) !== 'false';
    } catch (error) {
      console.error('Maarfin could not read the theme preference.', error);
    }

    document.documentElement.classList.toggle('maarfin-theme-enabled', enabled);
  }

  applyTheme();
  window.addEventListener('storage', function (event) {
    if (event.key === preferenceKey) {
      applyTheme();
    }
  });
}());
