// Cross-promotion for JobFlo, an iOS/macOS job search tracker made by one of
// this project's contributors. Edit the copy here; every page picks it up.
//
// Usage: <div data-promo="jobflo" data-variant="banner|card"></div>
//        <script src="assets/jobflo.js" defer></script>
'use strict';

(() => {
  const APP = {
    name: 'JobFlo',
    // Storefront-neutral link: opens the visitor's own country's App Store.
    url: 'https://apps.apple.com/app/id6759933192',
    icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/51/81/eb/5181ebcd-b6cb-ecf8-2396-8476ed2c9413/AppIcon-0-0-1x_U007epad-0-1-85-220.png/256x256bb.jpg',
    platforms: 'iPhone, iPad, Mac and Apple Watch',
    disclosure: 'JobFlo is made by one of The Rest of US contributors.',
    features: [
      ['Ghost-job detection', 'Flags postings that were never really open, before you spend hours on them.'],
      ['Pipeline board', 'Every application from first click to offer, with alerts when one goes cold.'],
      ['Private by default', 'Your data stays on your devices and syncs through your own iCloud.'],
      ['One-click capture', 'Save postings from Safari, Chrome or the share sheet, with details filled in.']
    ]
  };

  const icon = (size) => `<img src="${APP.icon}" alt="" width="${size}" height="${size}" loading="lazy" class="shrink-0 rounded-[22%] shadow-sm ring-1 ring-black/5" style="width:${size}px;height:${size}px">`;
  const cta = (cls) => `<a href="${APP.url}" target="_blank" rel="noopener" data-jobflo-cta class="${cls}">Get JobFlo on the App Store <span aria-hidden="true">↗</span></a>`;

  const variants = {
    banner: () => `
      <div class="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-brand-50 dark:border-slate-800 dark:from-slate-900 dark:to-brand-500/10">
        <div class="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div>
            <div class="flex items-center gap-4">
              ${icon(64)}
              <div>
                <p class="text-xs font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-400">For candidates</p>
                <h2 class="text-2xl font-bold tracking-tight sm:text-3xl">Track your whole search in ${APP.name}</h2>
              </div>
            </div>
            <p class="mt-4 text-slate-600 dark:text-slate-300">Being findable here is half the job. For everything you apply to yourself, ${APP.name} keeps your pipeline organised and spots ghost jobs, and it works on ${APP.platforms}.</p>
            <div class="mt-6 flex flex-wrap items-center gap-3">
              ${cta('inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200')}
              <span class="text-sm text-slate-500 dark:text-slate-400">Free to download</span>
            </div>
            <p class="mt-4 text-xs text-slate-500 dark:text-slate-400">${APP.disclosure}</p>
          </div>
          <ul class="grid gap-4 sm:grid-cols-2">
            ${APP.features.map(([t, d]) => `
              <li class="rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                <p class="font-semibold">${t}</p>
                <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">${d}</p>
              </li>`).join('')}
          </ul>
        </div>
      </div>`,

    strip: () => `
      <div class="border-b border-slate-200 bg-gradient-to-r from-brand-50 to-white dark:border-slate-800 dark:from-brand-500/10 dark:to-slate-950">
        <div class="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6">
          ${icon(32)}
          <p class="min-w-0 flex-1 text-sm leading-snug">
            <span class="font-semibold">${APP.name}</span>
            <span class="hidden sm:inline">: track every application and spot ghost jobs before you apply. Private, on ${APP.platforms}.</span>
            <span class="sm:hidden">: track applications, spot ghost jobs.</span>
            <span class="hidden text-xs text-slate-500 dark:text-slate-400 lg:inline">· Made by a contributor</span>
          </p>
          ${cta('shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200').replace('Get JobFlo on the App Store', '<span class="sm:hidden">Get it</span><span class="hidden sm:inline">Get JobFlo</span>')}
        </div>
      </div>`,

    card: (el) => `
      <div class="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div class="flex items-start gap-3">
          ${icon(48)}
          <div class="min-w-0">
            <p class="font-semibold">${el.dataset.title || `Track applications with ${APP.name}`}</p>
            <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">${el.dataset.text || 'Organise every application, catch ghost jobs early and see which ones have gone cold. Private, on-device.'}</p>
          </div>
        </div>
        ${cta('mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200')}
        <p class="mt-3 text-[11px] leading-snug text-slate-500 dark:text-slate-400">${APP.disclosure}</p>
      </div>`
  };

  function mount() {
    document.querySelectorAll('[data-promo="jobflo"]').forEach((el) => {
      const render = variants[el.dataset.variant] || variants.card;
      el.innerHTML = render(el);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
