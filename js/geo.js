// Geography helpers shared by circles.html and start-circle.html.
//
// City search uses the free Open-Meteo geocoding API (no key, CORS enabled):
// https://open-meteo.com/en/docs/geocoding-api. Only the typed city name is
// sent; coordinates from "Use my location" never leave the browser.
'use strict';

window.Geo = (() => {
  const GEOCODER = 'https://geocoding-api.open-meteo.com/v1/search';
  const US_AND_TERRITORIES = new Set(['US', 'PR', 'VI', 'GU', 'AS', 'MP', 'UM']);

  let regionNames = null;
  try { regionNames = new Intl.DisplayNames(['en'], { type: 'region' }); } catch {}
  const countryName = (code) => { try { return code && regionNames ? regionNames.of(code) : code || ''; } catch { return code || ''; } };

  const round2 = (x) => Math.round(x * 100) / 100;

  function distanceKm(a, b) {
    const R = 6371, rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  // Current UTC offset (hours) of an IANA zone, e.g. "Asia/Kolkata" -> 5.5.
  function offsetOf(iana) {
    try {
      const part = new Intl.DateTimeFormat('en-US', { timeZone: iana, timeZoneName: 'shortOffset' })
        .formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value || '';
      const m = /GMT(?:([+-])(\d{1,2})(?::(\d{2}))?)?/.exec(part);
      if (!m) return null;
      if (!m[1]) return 0;
      const v = Number(m[2]) + (m[3] ? Number(m[3]) / 60 : 0);
      return m[1] === '-' ? -v : v;
    } catch { return null; }
  }

  const deviceOffset = () => -new Date().getTimezoneOffset() / 60;

  function parseOffset(tz) {
    const m = /^UTC(?:([+-])(\d{1,2})(?::(\d{2}))?)?$/.exec(String(tz || ''));
    if (!m) return null;
    if (!m[1]) return 0;
    const v = Number(m[2]) + (m[3] ? Number(m[3]) / 60 : 0);
    return m[1] === '-' ? -v : v;
  }

  function formatOffset(n) {
    if (n === 0) return 'UTC';
    const abs = Math.abs(n), h = Math.floor(abs), m = Math.round((abs - h) * 60);
    return `UTC${n < 0 ? '-' : '+'}${h}${m ? ':' + String(m).padStart(2, '0') : ''}`;
  }

  async function search(query, signal) {
    const url = `${GEOCODER}?name=${encodeURIComponent(query)}&count=8&language=en&format=json`;
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`Geocoder HTTP ${res.status}`);
    const data = await res.json();
    return (data.results || []).map((r) => ({
      city: r.name,
      admin_area: r.admin1 || '',
      country: r.country_code || '',
      countryName: r.country || countryName(r.country_code),
      lat: round2(r.latitude),
      lon: round2(r.longitude),
      timezone: r.timezone || '',
      offset: r.timezone ? offsetOf(r.timezone) : null,
      isUS: US_AND_TERRITORIES.has(r.country_code)
    }));
  }

  const placeLabel = (p) => [p.city, p.admin_area && p.admin_area !== p.city ? p.admin_area : '', p.countryName || countryName(p.country)].filter(Boolean).join(', ');

  // Turns a text input into an accessible city combobox.
  // onSelect(place) is called with a result from search().
  function attachCityPicker(input, onSelect, { onInput } = {}) {
    const listId = input.id + '-options';
    const wrap = input.parentElement;
    wrap.classList.add('relative');
    const list = document.createElement('ul');
    list.id = listId;
    list.setAttribute('role', 'listbox');
    list.className = 'absolute left-0 right-0 top-full z-40 mt-1 hidden max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900';
    wrap.appendChild(list);

    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', listId);
    input.autocomplete = 'off';

    let results = [], active = -1, timer, ctrl;

    const close = () => { list.classList.add('hidden'); input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); active = -1; };
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function render(message) {
      if (message) {
        list.innerHTML = `<li class="px-3 py-2 text-slate-500 dark:text-slate-400">${esc(message)}</li>`;
      } else {
        list.innerHTML = results.map((r, i) => `
          <li id="${listId}-${i}" role="option" aria-selected="${i === active}" data-i="${i}"
              class="flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2 ${i === active ? 'bg-brand-50 dark:bg-brand-500/15' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}">
            <span><span class="font-medium">${esc(r.city)}</span><span class="text-slate-500 dark:text-slate-400">${r.admin_area && r.admin_area !== r.city ? ', ' + esc(r.admin_area) : ''}, ${esc(r.countryName)}</span></span>
            <span class="shrink-0 text-xs text-slate-400">${r.offset !== null ? esc(formatOffset(r.offset)) : ''}</span>
          </li>`).join('');
      }
      list.classList.remove('hidden');
      input.setAttribute('aria-expanded', 'true');
      if (active >= 0) input.setAttribute('aria-activedescendant', `${listId}-${active}`);
    }

    function choose(i) {
      const r = results[i];
      if (!r) return;
      input.value = placeLabel(r);
      close();
      onSelect(r);
    }

    input.addEventListener('input', () => {
      onInput?.();
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 2) { close(); return; }
      timer = setTimeout(async () => {
        ctrl?.abort();
        ctrl = new AbortController();
        render('Searching…');
        try {
          results = await search(q, ctrl.signal);
          active = results.length ? 0 : -1;
          results.length ? render() : render('No places found');
        } catch (e) {
          if (e.name !== 'AbortError') render('City search is unavailable right now');
        }
      }, 250);
    });

    input.addEventListener('keydown', (e) => {
      if (list.classList.contains('hidden') || !results.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % results.length; render(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + results.length) % results.length; render(); }
      else if (e.key === 'Enter') { e.preventDefault(); choose(active); }
      else if (e.key === 'Escape') close();
    });

    list.addEventListener('mousedown', (e) => {
      const li = e.target.closest('[data-i]');
      if (li) { e.preventDefault(); choose(Number(li.dataset.i)); }
    });
    input.addEventListener('blur', () => setTimeout(close, 120));
  }

  return { search, distanceKm, offsetOf, deviceOffset, parseOffset, formatOffset, round2, countryName, placeLabel, attachCityPicker, US_AND_TERRITORIES };
})();
