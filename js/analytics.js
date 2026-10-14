// Google Analytics (gtag.js) for the official site only. Forks, self-hosted
// copies and local development don't load it, so they never report into this
// property. To use your own on a fork, change SITE_HOST and MEASUREMENT_ID.
'use strict';

(() => {
  const SITE_HOST = 'rest-of-us.github.io';
  const MEASUREMENT_ID = 'G-SEVBES89HR';
  if (location.hostname !== SITE_HOST) return;

  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', MEASUREMENT_ID);
})();
