const CACHE='crowniq-v1';
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['/','/dashboard','/manifest.webmanifest','/crowniq-icon.svg']))));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||e.request.url.includes('127.0.0.1:8788'))return;e.respondWith(fetch(e.request).then(r=>{const x=r.clone();caches.open(CACHE).then(c=>c.put(e.request,x));return r}).catch(()=>caches.match(e.request)))})
