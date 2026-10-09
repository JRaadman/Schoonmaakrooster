self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

const PUSH_CLICK_DB='schoonmaak_push_click_bridge_v1';
const PUSH_CLICK_STORE='kv';
const PUSH_CLICK_KEY='pending';

function openPushClickDb_(){
  return new Promise((resolve,reject)=>{
    try{
      const req=indexedDB.open(PUSH_CLICK_DB,1);
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains(PUSH_CLICK_STORE))db.createObjectStore(PUSH_CLICK_STORE);
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error('indexeddb-open-failed'));
    }catch(err){reject(err);}
  });
}

async function savePushClick_(data){
  const db=await openPushClickDb_();
  try{
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(PUSH_CLICK_STORE,'readwrite');
      const req=tx.objectStore(PUSH_CLICK_STORE).put({data:data||{},savedAt:Date.now()},PUSH_CLICK_KEY);
      req.onsuccess=()=>resolve();
      req.onerror=()=>reject(req.error||new Error('indexeddb-write-failed'));
    });
  }finally{
    try{db.close();}catch(e){}
  }
}

function isRealAppClient_(client){
  try{
    if(!client||!client.url||client.url==='about:blank')return false;
    const scope=new URL(self.registration.scope);
    const url=new URL(client.url);
    return url.origin===scope.origin && url.pathname.startsWith(scope.pathname);
  }catch(e){return false;}
}

self.addEventListener('notificationclick', event => {
  event.notification.close();

  const data=(event.notification&&event.notification.data)||{};
  const pushId=String(data.pushId||'').trim();
  let targetUrl=data.url||self.registration.scope;

  if(pushId){
    try{
      const u=new URL(targetUrl,self.location.origin);
      u.searchParams.set('pushOpen',pushId);
      if(String(data.title||''))u.searchParams.set('pushTitle',String(data.title||''));
      if(String(data.body||''))u.searchParams.set('pushBody',String(data.body||''));
      if(String(data.day||data.dayName||''))u.searchParams.set('pushDay',String(data.day||data.dayName||''));
      if(String(data.acc||''))u.searchParams.set('pushAcc',String(data.acc||''));
      if(String(data.kind||''))u.searchParams.set('pushKind',String(data.kind||''));
      targetUrl=u.href;
    }catch(e){}
  }

  event.waitUntil((async()=>{
    // Eerst persistent opslaan. Daardoor hoeft een bestaande PWA nooit te
    // herladen alleen om pushdata door te geven.
    try{await savePushClick_(data);}catch(e){}

    const allClients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const appClients=allClients.filter(isRealAppClient_);

    // WebKit/iOS kan naast de echte PWA een about:blank WindowClient hebben.
    // Kies daarom alleen een client die echt binnen onze launcher-scope valt.
    const client=
      appClients.find(c=>c.focused) ||
      appClients.find(c=>c.visibilityState==='visible') ||
      appClients[0] ||
      null;

    if(client){
      let focused=client;
      try{focused=await client.focus()||client;}catch(e){}

      // Alleen een nudge. De launcher haalt de payload ook zelf uit IndexedDB
      // zodra hij weer zichtbaar wordt, dus deze berichten mogen verloren gaan
      // zonder dat de melding verloren gaat.
      const payload={type:'SCHOONMAAK_NOTIFICATION_CLICK',data:data};
      for(const delay of [250,900,2000,3500]){
        await new Promise(resolve=>setTimeout(resolve,delay===250?250:(delay===900?650:(delay===2000?1100:1500))));
        try{focused.postMessage(payload);}catch(e){}
      }
      return;
    }

    // Geen echte PWA-client aanwezig: dan is de app werkelijk gesloten.
    // Alleen in dat geval mag de app opnieuw worden gestart.
    await self.clients.openWindow(targetUrl);
  })());
});


self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type !== 'SCHOONMAAK_SHOW_NOTIFICATION') return;

  const title = String(data.title || 'Schoonmaakrooster');
  const options = {
    body: String(data.body || ''),
    icon: './app_icon_192.png?v=20261009-v122',
    badge: './app_icon_192.png?v=20261009-v122',
    tag: String(data.tag || 'schoonmaakrooster'),
    renotify: true,
    data: data.data || { url: './' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});


// PWA installability for older Android/Chrome versions.
// Network-first passthrough: no caching, so app behavior stays unchanged.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request));
});
