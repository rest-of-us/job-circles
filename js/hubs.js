// Hub manager: finds hubs, fetches their profile feeds and caches responses.
//
// Sources, merged and de-duplicated by feed URL:
//   1. ./hubs.json next to the page (relative, so any fork or self-hosted copy
//      works without edits);
//   2. registries listed in that file's "peers" array (followed one level deep);
//   3. hub feeds or hubs.json registries the visitor adds in the UI, kept in
//      this browser's localStorage.
//
// Responses are cached in IndexedDB (falling back to memory) for a
// configurable time, so repeat visits don't re-download every hub.
'use strict';

window.Hubs = (() => {
  const DEFAULT_REGISTRY = './hubs.json';
  const CUSTOM_KEY = 'trou-custom-hubs';
  const TTL_KEY = 'trou-cache-ttl-min';
  const DEFAULT_TTL_MIN = 60;
  const MAX_CUSTOM = 10;
  const MAX_REGISTRIES = 20;
  const MAX_PROFILES_PER_HUB = 2000;
  const TIMEOUT_MS = 10000;

  /* -------------------------------------------------------------- *
   * Settings & custom entries (localStorage, best effort)
   * -------------------------------------------------------------- */
  const store = {
    get(key, fallback) { try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
  };

  const ttlMinutes = () => { const n = Number(store.get(TTL_KEY, DEFAULT_TTL_MIN)); return Number.isFinite(n) && n >= 0 ? n : DEFAULT_TTL_MIN; };
  const setTtlMinutes = (n) => store.set(TTL_KEY, Math.max(0, Number(n) || 0));

  function isAllowedUrl(u) {
    try {
      const url = new URL(u, location.href);
      if (url.protocol === 'https:') return true;
      return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    } catch { return false; }
  }

  const customEntries = () => (store.get(CUSTOM_KEY, []) || []).filter((e) => e && isAllowedUrl(e.url) && (e.kind === 'hub' || e.kind === 'registry'));

  function addCustom(entry) {
    const list = customEntries();
    const url = new URL(entry.url, location.href).href;
    if (list.some((e) => e.url === url)) throw new Error('That address is already in your list.');
    if (list.length >= MAX_CUSTOM) throw new Error(`You can add up to ${MAX_CUSTOM} custom sources.`);
    list.push({ kind: entry.kind, url, name: String(entry.name || '').slice(0, 60), added: new Date().toISOString() });
    store.set(CUSTOM_KEY, list);
  }

  function removeCustom(url) {
    store.set(CUSTOM_KEY, customEntries().filter((e) => e.url !== url));
  }

  /* -------------------------------------------------------------- *
   * Cache: IndexedDB with an in-memory fallback
   * -------------------------------------------------------------- */
  const memory = new Map();
  let dbPromise = null;

  function db() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open('trou-cache', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('responses', { keyPath: 'url' });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch { resolve(null); }
    });
    return dbPromise;
  }

  async function cacheGet(url) {
    const d = await db();
    if (!d) return memory.get(url) || null;
    return new Promise((resolve) => {
      try {
        const req = d.transaction('responses').objectStore('responses').get(url);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(memory.get(url) || null);
      } catch { resolve(memory.get(url) || null); }
    });
  }

  async function cachePut(entry) {
    memory.set(entry.url, entry);
    const d = await db();
    if (!d) return;
    try { d.transaction('responses', 'readwrite').objectStore('responses').put(entry); } catch {}
  }

  async function clearCache() {
    memory.clear();
    const d = await db();
    if (!d) return;
    await new Promise((resolve) => {
      try {
        const tx = d.transaction('responses', 'readwrite');
        tx.objectStore('responses').clear();
        tx.oncomplete = tx.onerror = () => resolve();
      } catch { resolve(); }
    });
  }

  // Returns { data, fetchedAt, fromCache, stale, error? }.
  // A fresh cached copy is used if younger than the TTL; if the network fails,
  // an expired copy is returned with stale: true rather than nothing.
  async function cachedFetch(input, { force = false } = {}) {
    const url = new URL(input, location.href).href;
    const ttlMs = ttlMinutes() * 60000;
    const cached = await cacheGet(url);
    if (!force && cached && ttlMs > 0 && Date.now() - cached.fetchedAt < ttlMs) {
      return { data: cached.data, fetchedAt: cached.fetchedAt, fromCache: true, stale: false };
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: ctrl.signal, cache: 'no-cache', headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const entry = { url, data, fetchedAt: Date.now() };
      if (ttlMs > 0) await cachePut(entry);
      return { data, fetchedAt: entry.fetchedAt, fromCache: false, stale: false };
    } catch (err) {
      const message = err.name === 'AbortError' ? 'timed out' : err.message || 'network error';
      if (cached) return { data: cached.data, fetchedAt: cached.fetchedAt, fromCache: true, stale: true, error: message };
      throw new Error(message);
    } finally {
      clearTimeout(timer);
    }
  }

  /* -------------------------------------------------------------- *
   * Registries & hubs
   * -------------------------------------------------------------- */
  const hostOf = (u) => { try { return new URL(u).host; } catch { return ''; } };

  function shortHash(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  // Loads every registry and returns { hubs, registries, config }.
  // `config` is the default registry's own settings (submit targets, circles).
  async function loadRegistry({ force = false } = {}) {
    const registries = [];
    const hubsByFeed = new Map();
    const seenRegistries = new Set();
    let config = null;

    const queue = [{ url: new URL(DEFAULT_REGISTRY, location.href).href, source: 'default', depth: 0 }];
    for (const e of customEntries()) {
      if (e.kind === 'registry') queue.push({ url: e.url, source: 'custom', depth: 0, name: e.name });
    }

    while (queue.length && seenRegistries.size < MAX_REGISTRIES) {
      const reg = queue.shift();
      if (seenRegistries.has(reg.url)) continue;
      seenRegistries.add(reg.url);
      const record = { url: reg.url, source: reg.source, name: reg.name || '', ok: false, hubCount: 0 };
      registries.push(record);
      try {
        // This site's own registry is small and changes when hubs are added, so always
        // re-fetch it (the cached copy is still used if the network fails).
        const { data, fetchedAt, stale, error } = await cachedFetch(reg.url, { force: force || reg.source === 'default' });
        if (!data || !Array.isArray(data.hubs)) throw new Error('not a hubs.json registry');
        Object.assign(record, { ok: true, fetchedAt, stale, error, name: record.name || data.name || hostOf(reg.url) });
        if (reg.source === 'default') config = data;

        for (const h of data.hubs) {
          if (!h || !h.id || !h.profiles_url) continue;
          const feed = new URL(h.profiles_url, reg.url).href;
          if (!isAllowedUrl(feed) || hubsByFeed.has(feed)) continue;
          const source = reg.source === 'default' ? 'default' : reg.source === 'custom' ? 'custom' : 'peer';
          hubsByFeed.set(feed, {
            ...h,
            key: source === 'default' ? h.id : `${hostOf(reg.url)}~${h.id}`,
            feed,
            registry: reg.url,
            source
          });
          record.hubCount++;
        }
        // Follow peer registries one level from the default or a custom registry.
        if (reg.depth === 0 && Array.isArray(data.peers)) {
          for (const peer of data.peers.slice(0, MAX_REGISTRIES)) {
            const url = typeof peer === 'string' ? peer : peer?.url;
            if (url && isAllowedUrl(url)) queue.push({ url: new URL(url, reg.url).href, source: 'peer', depth: 1 });
          }
        }
      } catch (err) {
        record.error = err.message;
      }
    }

    for (const e of customEntries()) {
      if (e.kind !== 'hub' || hubsByFeed.has(e.url)) continue;
      hubsByFeed.set(e.url, {
        id: `custom-${shortHash(e.url)}`,
        key: `custom-${shortHash(e.url)}`,
        name: e.name || hostOf(e.url),
        description: `Added by you: ${e.url}`,
        profiles_url: e.url,
        feed: e.url,
        status: 'active',
        source: 'custom'
      });
    }

    return { hubs: [...hubsByFeed.values()], registries, config };
  }

  // A hub feed is an array of profiles, {"profiles": [...]}, or an array of
  // URLs (relative to the feed) of individual profile files.
  // Returns { entries: [{ profile, src }], fetchedAt, fromCache, stale, error? }.
  async function loadHub(hub, { force = false } = {}) {
    const res = await cachedFetch(hub.feed, { force });
    const list = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.profiles) ? res.data.profiles : null;
    if (!list) throw new Error('feed is not a list of profiles');
    const entries = await Promise.all(list.slice(0, MAX_PROFILES_PER_HUB).map(async (item) => {
      if (typeof item !== 'string') return { profile: item, src: hub.feed };
      const src = new URL(item, hub.feed).href;
      if (!isAllowedUrl(src)) return null;
      try { return { profile: (await cachedFetch(src, { force })).data, src }; } catch { return null; }
    }));
    return { entries: entries.filter(Boolean), fetchedAt: res.fetchedAt, fromCache: res.fromCache, stale: res.stale, error: res.error };
  }

  // Works out whether a URL is a hubs.json registry or a single hub feed.
  async function detect(url) {
    if (!isAllowedUrl(url)) throw new Error('Use an https:// address (or http://localhost for testing).');
    const { data } = await cachedFetch(url, { force: true });
    if (data && Array.isArray(data.hubs)) return { kind: 'registry', name: data.name || '', count: data.hubs.length };
    const list = Array.isArray(data) ? data : Array.isArray(data?.profiles) ? data.profiles : null;
    if (list) return { kind: 'hub', name: data?.name || '', count: list.length };
    throw new Error('That address returned JSON, but it isn’t a hubs.json registry or a profile feed.');
  }

  return {
    loadRegistry, loadHub, cachedFetch, clearCache, detect,
    customEntries, addCustom, removeCustom, isAllowedUrl,
    ttlMinutes, setTtlMinutes, DEFAULT_TTL_MIN
  };
})();
