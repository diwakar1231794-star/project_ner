const CACHE="routeai-shell-v3";
const ASSETS=["./","./index.html","./app.html","./css/app.css","./css/login.css","./js/app.js","./js/login.js","./manifest.json"];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",event=>{event.waitUntil(self.clients.claim())});
self.addEventListener("fetch",event=>{
  const u=new URL(event.request.url);
  if(u.origin===location.origin){
    event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));return r}).catch(()=>caches.match("./app.html"))));
  }
});