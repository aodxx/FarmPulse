export const manifest = JSON.stringify({
  name: "FarmPulse — ผู้ช่วยจัดการสวน",
  short_name: "FarmPulse",
  description: "ผู้ช่วยตัดสินใจและบันทึกงานสวนจากข้อมูลอากาศ",
  lang: "th",
  start_url: "/?source=pwa",
  scope: "/",
  display: "standalone",
  orientation: "portrait",
  background_color: "#f3f7f3",
  theme_color: "#14532d",
  icons: [
    { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
  ],
});

export const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" rx="120" fill="#14532d"/>
<circle cx="256" cy="256" r="168" fill="#facc15"/>
<path d="M257 386c-11-86 13-143 68-190-78 17-123 65-129 144-19-33-25-70-19-110 8-55 43-96 106-124 9 64-5 112-41 146 39-28 83-38 132-29-23 88-62 137-117 146v17z" fill="#166534"/>
</svg>`;

export const serviceWorker = `
const STATIC_CACHE="farmpulse-static-v1";
const PRIVATE_CACHE="farmpulse-private-v1";
const STATIC_URLS=["/manifest.webmanifest","/icon.svg"];
self.addEventListener("install",function(event){
  event.waitUntil(caches.open(STATIC_CACHE).then(function(cache){return cache.addAll(STATIC_URLS)}).then(function(){return self.skipWaiting()}));
});
self.addEventListener("activate",function(event){
  event.waitUntil(caches.keys().then(function(keys){return Promise.all(keys.filter(function(key){return ![STATIC_CACHE,PRIVATE_CACHE].includes(key)}).map(function(key){return caches.delete(key)}))}).then(function(){return self.clients.claim()}));
});
self.addEventListener("message",function(event){
  if(event.data&&event.data.type==="CLEAR_PRIVATE_CACHE")event.waitUntil(caches.delete(PRIVATE_CACHE));
});
self.addEventListener("fetch",function(event){
  var request=event.request,url=new URL(request.url);
  if(request.method!=="GET"||url.origin!==self.location.origin)return;
  if(STATIC_URLS.includes(url.pathname)){
    event.respondWith(caches.match(request).then(function(cached){return cached||fetch(request)}));return;
  }
  var privateGet=url.pathname==="/"||url.pathname==="/api/farms"||url.pathname==="/api/settings/default-farm"||url.pathname==="/api/health"||url.pathname==="/api/db/health";
  if(privateGet){
    event.respondWith(fetch(request).then(function(response){
      if(response.ok){var copy=response.clone();caches.open(PRIVATE_CACHE).then(function(cache){cache.put(request,copy)})}
      return response;
    }).catch(function(){return caches.match(request).then(function(cached){return cached||new Response(JSON.stringify({ok:false,offline:true,message:"ไม่มีข้อมูลที่บันทึกไว้ในอุปกรณ์"}),{status:503,headers:{"content-type":"application/json; charset=utf-8"}})})}));
  }
});
`;

export const pwaRegistration = `<link rel="manifest" href="/manifest.webmanifest"><link rel="icon" href="/icon.svg">
<script>if("serviceWorker" in navigator){window.addEventListener("load",function(){navigator.serviceWorker.register("/sw.js").catch(function(){})})}</script>`;
