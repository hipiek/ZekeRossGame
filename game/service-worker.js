/* Snap Squad service worker — offline-first caching */
const CACHE = "snapsquad-v1";
const ASSETS = [
  "./", "./index.html",
  "./css/style.css", "./js/data.js", "./js/game.js",
  "./manifest.webmanifest",
  "./assets/icons/icon-192.png", "./assets/icons/icon-512.png",
  "./assets/chars/closer.webp","./assets/chars/rookie.webp","./assets/chars/swap.webp",
  "./assets/chars/captain.webp","./assets/chars/shellshock.webp","./assets/chars/aphex.webp",
  "./assets/chars/nightshift.webp","./assets/chars/bluehour.webp","./assets/chars/goblin.webp",
  "./assets/chars/licker.webp","./assets/chars/toxic.webp","./assets/chars/frost.webp",
  "./assets/chars/golfgod.webp","./assets/chars/phantom.webp","./assets/chars/possessed.webp",
  "./assets/chars/mustache.webp","./assets/chars/stormcaller.webp","./assets/chars/contractor.webp",
  "./assets/chars/panmaster.webp","./assets/chars/cursed.webp"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if(e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(()=>{});
      return res;
    }).catch(()=>hit))
  );
});
