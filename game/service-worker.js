/* Snap Squad service worker — offline-first caching */
const CACHE = "snapsquad-v7";
const ASSETS = [
  "./", "./index.html",
  "./css/style.css", "./js/icons.js", "./js/data.js", "./js/game.js",
  "./js/world3d.js", "./js/vendor/three.module.min.js",
  "./manifest.webmanifest",
  "./assets/icons/icon-192.png", "./assets/icons/icon-512.png",
  "./assets/fx/cookiecat.webp", "./assets/fx/summoner.webp",
  "./assets/chars/android.webp","./assets/chars/aphex.webp","./assets/chars/bedhead.webp","./assets/chars/billion.webp","./assets/chars/bluehour.webp","./assets/chars/captain.webp","./assets/chars/chin.webp","./assets/chars/closer.webp","./assets/chars/contractor.webp","./assets/chars/cursed.webp","./assets/chars/deckhand.webp","./assets/chars/doppel.webp","./assets/chars/drowsy.webp","./assets/chars/feral.webp","./assets/chars/freshface.webp","./assets/chars/frost.webp","./assets/chars/goblin.webp","./assets/chars/golfgod.webp","./assets/chars/grin.webp","./assets/chars/licker.webp","./assets/chars/lowkey.webp","./assets/chars/lurker.webp","./assets/chars/mustache.webp","./assets/chars/nightshift.webp","./assets/chars/panmaster.webp","./assets/chars/phantom.webp","./assets/chars/possessed.webp","./assets/chars/regular.webp","./assets/chars/rookie.webp","./assets/chars/selfie.webp","./assets/chars/shellshock.webp","./assets/chars/skipper.webp","./assets/chars/smug.webp","./assets/chars/stormcaller.webp","./assets/chars/swap.webp","./assets/chars/tastemaker.webp","./assets/chars/tourist.webp","./assets/chars/toxic.webp","./assets/chars/trippy.webp","./assets/chars/unhinged.webp"
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
