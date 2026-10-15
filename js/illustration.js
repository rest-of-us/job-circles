// <undraw-illustration name="person-search"> inlines illustrations/<name>.svg.
//
// Illustrations are decorative: the text next to them carries the meaning, so
// they're hidden from assistive technology (aria-hidden, no role). Size them
// with classes on the element (e.g. class="mx-auto w-40"); pass the viewBox
// ratio as style="aspect-ratio: w / h" to reserve space before the file loads.
//
// They're inlined rather than used as <img> so the page's dark mode can reach
// them: the rules below swap unDraw's dark ink and pale greys for slate tones.
// Colours come from scripts/fetch-undraw.mjs, which lowercases every hex value.
'use strict';

(() => {
  if (customElements.get('undraw-illustration')) return;

  const DARK = {
    '#3f3d56': '#94a3b8', '#2f2e41': '#64748b', '#090814': '#475569',
    '#e6e6e6': '#1e293b', '#e5e5e5': '#1e293b', '#e4e4e4': '#1e293b', '#f2f2f2': '#1e293b', '#f0f0f0': '#1e293b',
    '#cccccc': '#334155', '#cacaca': '#334155', '#ffffff': '#0f172a',
    '#4f46e5': '#818cf8'
  };
  const css = `
    undraw-illustration { display: block; }
    undraw-illustration svg { display: block; width: 100%; height: 100%; }
    ${Object.entries(DARK).map(([from, to]) => `.dark undraw-illustration [fill="${from}"] { fill: ${to}; }`).join('\n    ')}
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // Resolve files next to this script's folder, so pages at any depth work.
  const scriptUrl = document.currentScript?.src;
  const cache = new Map();

  class UndrawIllustration extends HTMLElement {
    connectedCallback() {
      this.setAttribute('aria-hidden', 'true');
      const name = this.getAttribute('name') || '';
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || this.dataset.loaded === name) return;
      this.dataset.loaded = name;
      const url = new URL(`../illustrations/${name}.svg`, scriptUrl || location.href).href;
      if (!cache.has(url)) cache.set(url, fetch(url).then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`)))));
      cache.get(url).then((text) => {
        const svg = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement;
        if (svg.nodeName !== 'svg') return;
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        this.replaceChildren(document.importNode(svg, true));
      }).catch(() => { /* Decorative: leave the space empty. */ });
    }
  }

  customElements.define('undraw-illustration', UndrawIllustration);
})();
