const CACHE_NAME = "muhasebe-v13-20260104-1";
const ASSETS = [
  "./",
  "./index.html",
  "./app.css",
  "./app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (e)=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)));
});
self.addEventListener("activate", (e)=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.map(k=>k!==CACHE_NAME && caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});
self.addEventListener("fetch", (e)=>{
  const req=e.request;
  e.respondWith(
    caches.match(req).then(res=> res || fetch(req).then(net=>{
      const copy=net.clone();
      caches.open(CACHE_NAME).then(c=>c.put(req, copy)).catch(()=>{});
      return net;
    }).catch(()=>caches.match("./index.html")))
  );
});
