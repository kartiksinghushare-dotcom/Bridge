/* ============================================================
   Bridge — 21-attendance.js  (v132)
   Geofences on locations · My Day home · clock in / out · WFH ·
   the Attendance tab (my / team / settings).
   Classic script: shares top-level scope with the other /js files.
   ============================================================ */

/* ═══════════════ GEO HELPERS ═══════════════ */
function _geoDist(aLat,aLng,bLat,bLng){
  const R=6371000,toR=x=>x*Math.PI/180;
  const dLat=toR(bLat-aLat),dLng=toR(bLng-aLng);
  const h=Math.sin(dLat/2)**2+Math.cos(toR(aLat))*Math.cos(toR(bLat))*Math.sin(dLng/2)**2;
  return Math.round(2*R*Math.asin(Math.sqrt(h)));
}
function _geoDefaultTz(){try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'Asia/Dubai';}catch(e){return 'Asia/Dubai';}}
function _geoFmtDist(m){return m==null?'—':(m<1000?m+' m':(m/1000).toFixed(m<10000?1:0)+' km');}
/* Active locations that have a usable geofence. */
function _geoFences(){return (DB.locations||[]).filter(l=>l.status!=='Inactive'&&l.geofenceEnabled&&l.lat!=null&&l.lng!=null);}
/* Nearest fence to a point → {loc,dist,inside} (inside honours the GPS tolerance setting). */
function _geoNearest(lat,lng,acc){
  const tol=Number(_attSettings().gps_tolerance_m||30);
  let best=null;
  _geoFences().forEach(l=>{const d=_geoDist(lat,lng,l.lat,l.lng);const inside=d<=(l.radiusM||150)+tol;if(!best||d<best.dist)best={loc:l,dist:d,inside};});
  return best;
}
/* One-shot GPS read. Resolves {lat,lng,acc} or rejects with a human message. */
function _geoHere(opts={}){
  return new Promise((res,rej)=>{
    if(!navigator.geolocation)return rej(new Error('This device has no location service.'));
    let done=false;
    const ok=p=>{if(done)return;done=true;res({lat:p.coords.latitude,lng:p.coords.longitude,acc:Math.round(p.coords.accuracy||0)});};
    const bad=e=>{if(done)return;done=true;rej(new Error(e&&e.code===1?'Location permission is blocked. Allow location for Bridge in your browser / phone settings and try again.':e&&e.code===2?'Couldn’t get a GPS fix. Move near a window or outdoors and try again.':'Location timed out. Try again.'));};
    navigator.geolocation.getCurrentPosition(ok,bad,{enableHighAccuracy:true,timeout:opts.timeout||15000,maximumAge:opts.maxAge||0});
  });
}
/* Leaflet loads on demand (only the geofence editor / preview needs it). */
let _leafletP=null;
function _loadLeaflet(){
  if(window.L&&window.L.map)return Promise.resolve();
  if(_leafletP)return _leafletP;
  _leafletP=new Promise((res,rej)=>{
    const css=document.createElement('link');css.rel='stylesheet';css.href='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';document.head.appendChild(css);
    const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    const to=setTimeout(()=>{_leafletP=null;rej(new Error('Map timed out'));},8000);
    s.onload=()=>{clearTimeout(to);res();};s.onerror=()=>{clearTimeout(to);_leafletP=null;rej(new Error('Map failed to load'));};document.head.appendChild(s);
  });
  return _leafletP;
}
function _geoMap(elId,lat,lng,radius,{interactive=true,onMove=null}={}){
  const el=document.getElementById(elId);if(!el||!window.L)return null;
  if(el._map){try{el._map.remove();}catch(e){}}
  const map=L.map(el,{zoomControl:interactive,dragging:interactive,scrollWheelZoom:interactive,touchZoom:interactive,doubleClickZoom:interactive,boxZoom:false,keyboard:false,attributionControl:false}).setView([lat,lng],16);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
  const circle=L.circle([lat,lng],{radius:radius,color:'#54433C',weight:2,fillColor:'#D1B68F',fillOpacity:.25}).addTo(map);
  const marker=L.marker([lat,lng],{draggable:interactive}).addTo(map);
  if(interactive){
    marker.on('drag',e=>{const p=e.target.getLatLng();circle.setLatLng(p);if(onMove)onMove(p.lat,p.lng);});
    map.on('click',e=>{marker.setLatLng(e.latlng);circle.setLatLng(e.latlng);if(onMove)onMove(e.latlng.lat,e.latlng.lng);});
  }
  el._map=map;el._circle=circle;el._marker=marker;
  setTimeout(()=>{try{map.invalidateSize();}catch(e){}},120);
  return map;
}

/* ═══════════════ LOCATION → GEOFENCE TAB + EDITOR ═══════════════ */
function _geoLocTab(l){
  const on=l.geofenceEnabled&&l.lat!=null;
  const canG=can('locations','manageGeofence')||can('locations','edit');
  const todayHere=(DB.attendance||[]).filter(a=>a.date===todayISO()&&(a.inLocId===l.id)).length;
  setTimeout(()=>{if(on)_loadLeaflet().then(()=>_geoMap('geo-prev-'+l.id,l.lat,l.lng,l.radiusM||150,{interactive:false})).catch(()=>{});},60);
  return `<div class="ui-card" style="overflow:hidden">
    <div class="ui-card-head"><span class="ui-card-title">Geofence</span>${canG?btn(on?'Edit geofence':'Set up geofence',`App._geoEdit('${l.id}')`,{variant:'primary',size:'sm',icon:'pin'}):''}</div>
    <div class="ui-card-pad">
      ${on?`<div id="geo-prev-${l.id}" style="height:220px;border-radius:12px;overflow:hidden;background:var(--c-surface-2);margin-bottom:14px"></div>`:''}
      <div class="bb-kpis" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px">
        ${[['Status',on?'<span style="color:var(--c-success-ink);font-weight:800">On</span>':'<span style="color:var(--c-text-3);font-weight:700">Off</span>'],['Radius',on?(l.radiusM||150)+' m':'—'],['Coordinates',on?l.lat.toFixed(5)+', '+l.lng.toFixed(5):'—'],['Time zone',esc(l.timezone||'Asia/Dubai')],['Clocked in here today',String(todayHere)]].map(([k,v])=>`<div style="background:var(--c-surface-2);border-radius:12px;padding:10px 12px"><div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--c-text-3);margin-bottom:3px">${k}</div><div style="font-size:14px;font-weight:700;color:var(--c-text)">${v}</div></div>`).join('')}
      </div>
      <p style="font-size:12px;color:var(--c-text-3);margin-top:12px;line-height:1.5">People can clock in and out only while they are inside an active geofence (or on a work-from-home day). Anyone still clocked in at the end of the day is clocked out automatically at <b>${esc(_attSettings().auto_out_time||'23:59')}</b>.</p>
    </div></div>`;
}
let _GEOD=null;
App._geoEdit=async(locId)=>{
  if(!(can('locations','manageGeofence')||can('locations','edit')))return toast('You need Locations → Manage geofence','err');
  const l=locById(locId);if(!l)return;
  _GEOD={id:l.id,lat:l.lat!=null?l.lat:25.2048,lng:l.lng!=null?l.lng:55.2708,radius:l.radiusM||150,enabled:l.geofenceEnabled!==false&&l.lat!=null?true:(l.lat==null),timezone:l.timezone||_geoDefaultTz(),hasCoords:l.lat!=null};
  App._geoRender();
  try{await _loadLeaflet();App._geoPaintMap();}catch(e){const m=document.getElementById('geo-map');if(m)m.innerHTML='<div style="padding:30px;text-align:center;font-size:12.5px;color:var(--c-text-3)">Map unavailable — you can still type the coordinates or use “My current location”.</div>';}
};
App._geoRender=()=>{
  const d=_GEOD;if(!d)return;
  const l=locById(d.id);
  modalShell({title:'Geofence — '+(l?l.name:''),sub:'Drag the pin or tap the map. People can clock in inside the circle.',size:'max-w-2xl',key:'geo-edit',
    body:`<div>
      <div id="geo-map" style="height:300px;border-radius:14px;overflow:hidden;background:var(--c-surface-2);margin-bottom:14px;border:1px solid var(--c-border)"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;align-items:center">
        ${btn('My current location','App._geoUseHere()',{variant:'ghost',size:'sm',icon:'pin'})}
        <div style="display:flex;gap:6px;flex:1;min-width:200px"><input id="geo-q" class="ui-input" placeholder="Search an address or place…" style="padding:7px 12px" onkeydown="if(event.key==='Enter')App._geoSearch()"/>${btn('Find','App._geoSearch()',{variant:'ghost',size:'sm',icon:'search'})}</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">
        <div><label class="ui-label">Latitude</label><input id="geo-lat" class="ui-input rf" type="number" step="0.000001" value="${d.lat}" oninput="App._geoInput()"/></div>
        <div><label class="ui-label">Longitude</label><input id="geo-lng" class="ui-input rf" type="number" step="0.000001" value="${d.lng}" oninput="App._geoInput()"/></div>
      </div>
      <div style="margin-top:12px"><label class="ui-label">Radius — <b id="geo-rad-lbl">${d.radius} m</b></label>
        <input id="geo-rad" type="range" min="30" max="2000" step="10" value="${d.radius}" style="width:100%" oninput="App._geoRadius(this.value)"/>
        <div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--c-text-3)"><span>30 m (one shop)</span><span>2 km (a whole area)</span></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px;align-items:end">
        <div><label class="ui-label">Time zone</label><input id="geo-tz" class="ui-input rf" value="${esc(d.timezone)}" placeholder="Asia/Dubai"/></div>
        <div>${mkTog('geo-on',d.enabled,'Geofence active')}</div>
      </div>
      <p style="font-size:11.5px;color:var(--c-text-3);margin-top:10px;line-height:1.5">Tip: phones report GPS within ~10–50 m. A radius under 60 m can reject people standing at the door — 100–150 m is a good default for an office; 300 m+ for a large site.</p>
    </div>`,
    footer:btnG('Cancel','_GEOD=null;App.closeModal()')+btnP('Save geofence','App._geoSave()')});
};
App._geoPaintMap=()=>{const d=_GEOD;if(!d||!window.L)return;_geoMap('geo-map',d.lat,d.lng,d.radius,{interactive:true,onMove:(la,ln)=>{d.lat=+la.toFixed(6);d.lng=+ln.toFixed(6);d.hasCoords=true;const a=$('#geo-lat'),b=$('#geo-lng');if(a)a.value=d.lat;if(b)b.value=d.lng;}});};
App._geoInput=()=>{const d=_GEOD;if(!d)return;const la=parseFloat($('#geo-lat')?.value),ln=parseFloat($('#geo-lng')?.value);if(isNaN(la)||isNaN(ln))return;d.lat=la;d.lng=ln;d.hasCoords=true;const el=document.getElementById('geo-map');if(el&&el._map){el._marker.setLatLng([la,ln]);el._circle.setLatLng([la,ln]);el._map.panTo([la,ln]);}};
App._geoRadius=(v)=>{const d=_GEOD;if(!d)return;d.radius=Number(v)||150;const lbl=$('#geo-rad-lbl');if(lbl)lbl.textContent=d.radius+' m';const el=document.getElementById('geo-map');if(el&&el._circle)el._circle.setRadius(d.radius);};
App._geoUseHere=async()=>{
  const d=_GEOD;if(!d)return;
  toast('Getting your location…');
  try{const p=await _geoHere({timeout:20000});d.lat=+p.lat.toFixed(6);d.lng=+p.lng.toFixed(6);d.hasCoords=true;
    const a=$('#geo-lat'),b=$('#geo-lng');if(a)a.value=d.lat;if(b)b.value=d.lng;
    const el=document.getElementById('geo-map');if(el&&el._map){el._marker.setLatLng([d.lat,d.lng]);el._circle.setLatLng([d.lat,d.lng]);el._map.setView([d.lat,d.lng],17);}
    toast('Pin moved to where you are (±'+p.acc+' m)');
  }catch(e){toast(e.message,'err');}
};
App._geoSearch=async()=>{
  const d=_GEOD;if(!d)return;
  const q=($('#geo-q')?.value||'').trim();if(!q)return toast('Type an address first','warn');
  try{
    const r=await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q='+encodeURIComponent(q),{headers:{'Accept':'application/json'}});
    const j=await r.json();if(!j||!j[0])return toast('Nothing found for that address','warn');
    d.lat=+parseFloat(j[0].lat).toFixed(6);d.lng=+parseFloat(j[0].lon).toFixed(6);d.hasCoords=true;
    const a=$('#geo-lat'),b=$('#geo-lng');if(a)a.value=d.lat;if(b)b.value=d.lng;
    const el=document.getElementById('geo-map');if(el&&el._map){el._marker.setLatLng([d.lat,d.lng]);el._circle.setLatLng([d.lat,d.lng]);el._map.setView([d.lat,d.lng],16);}
  }catch(e){toast('Address search unavailable right now','err');}
};
App._geoSave=()=>{
  const d=_GEOD;if(!d)return;
  if(!(can('locations','manageGeofence')||can('locations','edit')))return toast('You need Locations → Manage geofence','err');
  const l=locById(d.id);if(!l)return;
  const on=togV('geo-on');
  if(on&&!d.hasCoords)return toast('Set the pin first (drag it, search, or use your current location)','err');
  l.lat=d.lat;l.lng=d.lng;l.radiusM=d.radius;l.geofenceEnabled=on;l.timezone=($('#geo-tz')?.value||'').trim()||'Asia/Dubai';
  log(fullName(me()),'Geofence updated',l.name+' · '+(on?(l.radiusM+' m'):'off'));
  _GEOD=null;saveDB();closeModal();toast('Geofence saved ✓');rr();
  sb.from('locations').update({lat:l.lat,lng:l.lng,radius_m:l.radiusM,geofence_enabled:l.geofenceEnabled,timezone:l.timezone}).eq('id',l.id).then(({error})=>{if(error)_syncErr('geofence')(error);}).catch(_syncErr('geofence'));
};

/* ═══════════════ ATTENDANCE SETTINGS (workspace_settings · attendance_settings) ═══════════════ */
const ATT_DEFAULT={enabled:false,tz:'Asia/Dubai',tracking_from:'2026-09-11',auto_out_time:'23:59',reminder_in_on:true,reminder_in_after_min:15,reminder_out_on:true,reminder_out_after_min:30,geofence_strict:true,gps_tolerance_m:30,max_accuracy_m:300,wfh_notify_manager:true,late_grace_min:10};
let _ATTS=null;
function _attSettings(){return _ATTS||ATT_DEFAULT;}
/* Master switch — the whole attendance system (clock card, WFH, reminders, auto clock-out) stays dark until an admin turns it on in Attendance → Settings. */
function _attEnabled(){return _attSettings().enabled===true;}
async function _attLoadSettings(){
  try{const{data}=await sb.from('workspace_settings').select('value').eq('key','attendance_settings').maybeSingle();_ATTS={...ATT_DEFAULT,...((data&&data.value)||{})};}catch(e){_ATTS={...ATT_DEFAULT};}
  return _ATTS;
}
function _attSaveSettings(patch){
  _ATTS={...(_ATTS||ATT_DEFAULT),...patch};
  return sb.from('workspace_settings').upsert({key:'attendance_settings',value:_ATTS,updated_at:new Date().toISOString()},{onConflict:'key'}).then(({error})=>{if(error)_syncErr('attendance settings')(error);});
}

/* ═══════════════ DATA ═══════════════ */
function _mAtt(r){return{id:r.id,userId:r.user_id,date:r.date,inAt:r.clock_in_at||null,outAt:r.clock_out_at||null,inLat:r.in_lat,inLng:r.in_lng,inAcc:r.in_acc,outLat:r.out_lat,outLng:r.out_lng,outAcc:r.out_acc,inLocId:r.in_location_id||null,outLocId:r.out_location_id||null,inDist:r.in_distance_m,outDist:r.out_distance_m,mode:r.mode||'office',autoOut:!!r.auto_out,source:r.source||'web',note:r.note||'',editedBy:r.edited_by||null,editedAt:r.edited_at||null,editReason:r.edit_reason||'',updatedAt:r.updated_at||null};}
function _attMerge(rows){
  DB.attendance=DB.attendance||[];
  const by=new Map(DB.attendance.map(a=>[a.id,a]));
  (rows||[]).forEach(r=>by.set(r.id,_mAtt(r)));
  DB.attendance=[...by.values()].sort((a,b)=>String(b.inAt||b.date).localeCompare(String(a.inAt||a.date)));
}
let _attLoaded={};
/* Load my own rows (last 62 days) + today's rows for everyone I may see. */
async function _attLoadMine(){
  if(!S.uid||_attLoaded.mine)return;_attLoaded.mine=true;
  try{
    const from=new Date(Date.now()-62*864e5).toISOString().slice(0,10);
    const [a,w]=await Promise.all([
      sb.from('attendance').select('*').eq('user_id',S.uid).gte('date',from).order('date',{ascending:false}),
      sb.from('wfh_days').select('*').eq('user_id',S.uid).gte('date',from)]);
    if(!a.error)_attMerge(a.data);
    if(!w.error){DB.wfh=DB.wfh||[];const by=new Map(DB.wfh.map(x=>[x.userId+'|'+x.date,x]));(w.data||[]).forEach(x=>by.set(x.user_id+'|'+x.date,{userId:x.user_id,date:x.date,note:x.note||''}));DB.wfh=[...by.values()];}
    rr();
  }catch(e){_attLoaded.mine=false;console.warn('[att] mine',e.message);}
}
/* Load a whole month for the people in my attendance scope (Team tab). */
async function _attLoadMonth(ym){
  if(!S.uid)return;const key='m:'+ym;if(_attLoaded[key])return;_attLoaded[key]=true;
  try{
    const ids=_attScopeUsers().map(u=>u.id);if(!ids.length)return;
    const from=ym+'-01',to=_attMonthEnd(ym);
    const [a,w]=await Promise.all([
      sb.from('attendance').select('*').in('user_id',ids).gte('date',from).lte('date',to).order('date',{ascending:false}),
      sb.from('wfh_days').select('*').in('user_id',ids).gte('date',from).lte('date',to)]);
    if(!a.error)_attMerge(a.data);
    if(!w.error){DB.wfh=DB.wfh||[];const by=new Map(DB.wfh.map(x=>[x.userId+'|'+x.date,x]));(w.data||[]).forEach(x=>by.set(x.user_id+'|'+x.date,{userId:x.user_id,date:x.date,note:x.note||''}));DB.wfh=[...by.values()];}
    rr();
  }catch(e){delete _attLoaded[key];console.warn('[att] month',e.message);}
}
function _attMonthEnd(ym){const [y,m]=ym.split('-').map(Number);return y+'-'+String(m).padStart(2,'0')+'-'+String(new Date(y,m,0).getDate()).padStart(2,'0');}
function _attScopeUsers(){
  const f=scopeFilter('attendance');
  return (DB.users||[]).filter(u=>u.status==='Active'&&(u.id===S.uid||f(u.id))).sort((a,b)=>fullName(a).localeCompare(fullName(b)));
}
function _attRowsFor(uid2,date){return (DB.attendance||[]).filter(a=>a.userId===uid2&&a.date===date).sort((a,b)=>String(a.inAt).localeCompare(String(b.inAt)));}
function _attOpen(uid2){return (DB.attendance||[]).find(a=>a.userId===uid2&&a.inAt&&!a.outAt)||null;}
function _attIsWfh(uid2,date){return (DB.wfh||[]).some(w=>w.userId===uid2&&w.date===date);}
function _attMins(a){if(!a||!a.inAt)return 0;const end=a.outAt?new Date(a.outAt):new Date();return Math.max(0,Math.round((end-new Date(a.inAt))/60000));}
function _attFmtMins(m){if(!m)return '0h';const h=Math.floor(m/60),mm=m%60;return h?(h+'h'+(mm?' '+mm+'m':'')):(mm+'m');}
function _attHM(iso){if(!iso)return '—';const d=new Date(iso);return d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});}
function _attDayMins(uid2,date){return _attRowsFor(uid2,date).reduce((n,a)=>n+_attMins(a),0);}
function _attSchedule(u){return {in:'09:00',out:'18:00',offDays:['Sun'],...((u&&u.workSchedule)||{})};}
function _attIsOff(u,date){const s=_attSchedule(u);return (s.offDays||[]).includes(dayAbbr(date));}
/* Days before attendance tracking started (or before the person joined) are neither present nor absent. */
function _attTracked(u,date){const from=_attSettings().tracking_from||'';if(from&&date<from)return false;if(u&&u.joiningDate&&date<u.joiningDate)return false;return true;}
function _attLate(u,a){if(!a||!a.inAt)return false;const s=_attSchedule(u);const d=new Date(a.inAt);const m=d.getHours()*60+d.getMinutes();return m>hm2m(s.in)+Number(_attSettings().late_grace_min||10);}
/* Realtime: attendance rows of the people I can see, so Team view and My Day stay live. */
let _attRT=null;
function _attLiveStart(){
  if(_attRT||!S.uid||!sb.channel)return;
  try{
    _attRT=sb.channel('bb-att-'+S.uid)
      .on('postgres_changes',{event:'*',schema:'public',table:'attendance'},p=>{try{const r=p.new&&p.new.id?p.new:null;if(p.eventType==='DELETE'){DB.attendance=(DB.attendance||[]).filter(a=>a.id!==(p.old&&p.old.id));}else if(r){_attMerge([r]);}if(['home','attendance','profile','dashboard'].includes(S.route))rr();}catch(e){}})
      .on('postgres_changes',{event:'*',schema:'public',table:'wfh_days'},p=>{try{DB.wfh=DB.wfh||[];if(p.eventType==='DELETE'){DB.wfh=DB.wfh.filter(w=>!(w.userId===p.old.user_id&&w.date===p.old.date));}else{const r=p.new;if(!DB.wfh.some(w=>w.userId===r.user_id&&w.date===r.date))DB.wfh.push({userId:r.user_id,date:r.date,note:r.note||''});}if(['home','attendance'].includes(S.route))rr();}catch(e){}})
      .subscribe();
  }catch(e){_attRT=null;}
}
function _attLiveStop(){try{if(_attRT)sb.removeChannel(_attRT);}catch(e){}_attRT=null;_attLoaded={};}

/* ═══════════════ CLOCK IN / OUT ═══════════════ */
let _attBusy=false;
function _attNotify(userId,text,link,kind){
  if(!userId||userId===S.uid)return;
  const n={id:uid('n'),userId,text,time:new Date().toISOString(),read:false,link:link||null,kind:kind||'attendance'};
  DB.notifications.unshift(n);
  sb.from('notifications').insert({id:n.id,user_id:userId,text:n.text,read:false,created_at:n.time,link:n.link,kind:n.kind}).then(()=>{}).catch(()=>{});
  try{_invalidateNotifCache();}catch(e){}
}
function _attSetBtn(txt){const b=$('#att-btn');if(b){b.disabled=true;b.innerHTML=txt;}}
App._attClockIn=async()=>{
  if(_attBusy)return;const u=me();if(!u)return;
  if(!_attEnabled())return toast('Attendance isn’t switched on yet','warn');
  if(!can('attendance','clock'))return toast('Your role can’t clock in — ask an admin','err');
  const today=todayISO();
  if(_attOpen(S.uid))return toast('You are already clocked in','warn');
  _attBusy=true;_attSetBtn('Finding you…');
  try{
    const wfh=_attIsWfh(S.uid,today);
    let pos=null,near=null;
    if(wfh){
      try{pos=await _geoHere({timeout:8000});}catch(e){pos=null;}   // optional on WFH days
    }else{
      if(!_geoFences().length)throw new Error('No location has a geofence yet — ask an admin to set one up under Locations.');
      pos=await _geoHere();
      const maxAcc=Number(_attSettings().max_accuracy_m||300);
      if(pos.acc>maxAcc)throw new Error('GPS signal is too weak right now (±'+pos.acc+' m). Step outside or near a window and try again.');
      near=_geoNearest(pos.lat,pos.lng,pos.acc);
      if(!near||!near.inside){
        const d=near?_geoFmtDist(near.dist):'—';
        throw new Error(near?('You’re outside the geofence — '+d+' from '+near.loc.name+' (allowed: '+(near.loc.radiusM||150)+' m). Move closer and try again.'):'You’re not near any office.');
      }
    }
    const row={id:uid('att'),user_id:S.uid,date:today,clock_in_at:new Date().toISOString(),in_lat:pos?pos.lat:null,in_lng:pos?pos.lng:null,in_acc:pos?pos.acc:null,in_location_id:near?near.loc.id:null,in_distance_m:near?near.dist:null,mode:wfh?'wfh':'office',source:(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform())?'app':'web'};
    _attMerge([row]);rr();
    const{error}=await sb.from('attendance').insert(row);
    if(error){DB.attendance=DB.attendance.filter(a=>a.id!==row.id);rr();throw new Error('Couldn’t save your clock-in — '+error.message);}
    log(fullName(u),'Clocked in',wfh?'Work from home':(near?near.loc.name+' · '+near.dist+' m':''));
    toast(wfh?'Clocked in — working from home ✓':'Clocked in at '+near.loc.name+' ✓');
    try{if(window.BBNotify&&BBNotify.play)BBNotify.play('pop',{force:true});}catch(e){}
  }catch(e){toast(e.message,'err');rr();}
  finally{_attBusy=false;}
};
App._attClockOut=async()=>{
  if(_attBusy)return;const u=me();if(!u)return;
  const open=_attOpen(S.uid);if(!open)return toast('You are not clocked in','warn');
  _attBusy=true;_attSetBtn('Finding you…');
  try{
    const wfh=open.mode==='wfh';
    let pos=null,near=null;
    if(wfh){try{pos=await _geoHere({timeout:8000});}catch(e){pos=null;}}
    else{
      pos=await _geoHere();
      const maxAcc=Number(_attSettings().max_accuracy_m||300);
      if(pos.acc>maxAcc)throw new Error('GPS signal is too weak right now (±'+pos.acc+' m). Try again near a window.');
      near=_geoNearest(pos.lat,pos.lng,pos.acc);
      if(_attSettings().geofence_strict!==false&&(!near||!near.inside)){
        throw new Error(near?('You’re outside the geofence — '+_geoFmtDist(near.dist)+' from '+near.loc.name+'. Clock out before you leave; if you forget, you’ll be clocked out automatically at '+(_attSettings().auto_out_time||'23:59')+'.'):'You’re not near any office.');
      }
    }
    const patch={clock_out_at:new Date().toISOString(),out_lat:pos?pos.lat:null,out_lng:pos?pos.lng:null,out_acc:pos?pos.acc:null,out_location_id:near?near.loc.id:null,out_distance_m:near?near.dist:null,updated_at:new Date().toISOString()};
    const prev={...open};
    Object.assign(open,{outAt:patch.clock_out_at,outLat:patch.out_lat,outLng:patch.out_lng,outAcc:patch.out_acc,outLocId:patch.out_location_id,outDist:patch.out_distance_m});rr();
    const{error}=await sb.from('attendance').update(patch).eq('id',open.id);
    if(error){Object.assign(open,prev);rr();throw new Error('Couldn’t save your clock-out — '+error.message);}
    log(fullName(u),'Clocked out',_attFmtMins(_attMins(open)));
    toast('Clocked out — '+_attFmtMins(_attMins(open))+' today ✓');
  }catch(e){toast(e.message,'err');rr();}
  finally{_attBusy=false;}
};
App._attToggleWfh=async()=>{
  const u=me();if(!u)return;
  if(!_attEnabled())return toast('Attendance isn’t switched on yet','warn');
  if(!u.wfhAllowed)return toast('Work from home isn’t enabled on your profile — ask your manager','err');
  const today=todayISO();
  if(_attIsWfh(S.uid,today)){
    const open=_attOpen(S.uid);if(open&&open.mode==='wfh')return toast('Clock out first, then switch WFH off','warn');
    DB.wfh=(DB.wfh||[]).filter(w=>!(w.userId===S.uid&&w.date===today));rr();
    await sb.from('wfh_days').delete().eq('user_id',S.uid).eq('date',today);
    toast('WFH removed for today');
  }else{
    (DB.wfh=DB.wfh||[]).push({userId:S.uid,date:today,note:''});rr();
    const{error}=await sb.from('wfh_days').upsert({user_id:S.uid,date:today},{onConflict:'user_id,date'});
    if(error){DB.wfh=DB.wfh.filter(w=>!(w.userId===S.uid&&w.date===today));rr();return toast('Couldn’t save — '+error.message,'err');}
    log(fullName(u),'Marked WFH',today);
    toast('Today is a work-from-home day 🏠');
    if(_attSettings().wfh_notify_manager!==false&&u.managerId){
      _attNotify(u.managerId,'🏠 '+fullName(u)+' is working from home today.','att:team:'+today,'attendance');
      try{if(typeof sendEmail==='function')sendEmail('attendance_wfh',u.managerId,{wfh_user:fullName(u),date:fmtD(today)}).catch(()=>{});}catch(e){}
    }
  }
};

/* ═══════════════ MY DAY (home) ═══════════════ */
let _attTick=null;
function _attStartTick(){clearInterval(_attTick);_attTick=setInterval(()=>{const el=$('#att-elapsed');const o=_attOpen(S.uid);if(el&&o)el.textContent=_attFmtMins(_attMins(o));if(!el)clearInterval(_attTick);},30000);}
function _attClockCard(){
  const u=me();const today=todayISO();
  if(!_attEnabled()){
    if(!_ATTS)return '';   // settings not loaded yet — don't flash anything
    return can('attendance','manage')?`<div class="ui-card" style="padding:14px 18px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;border-style:dashed"><span style="width:34px;height:34px;border-radius:10px;background:var(--c-surface-2);display:grid;place-items:center;color:var(--c-text-3)">${ic('clock','w-4 h-4')}</span><div style="flex:1;min-width:200px"><div style="font-size:13px;font-weight:800;color:var(--c-text)">Attendance isn’t switched on yet</div><div style="font-size:12px;color:var(--c-text-3)">Set geofences on your locations, then turn it on — only admins see this note.</div></div>${btn('Attendance settings',"App.go('attendance');S.filters.attTab='settings';rr()",{variant:'ghost',size:'sm',icon:'cog'})}</div>`:'';
  }
  const open=_attOpen(S.uid);const wfh=_attIsWfh(S.uid,today);
  const rows=_attRowsFor(S.uid,today);const total=_attDayMins(S.uid,today);
  const sched=_attSchedule(u);const off=_attIsOff(u,today);
  const fences=_geoFences();
  const canClock=can('attendance','clock');
  const loc=open&&open.inLocId?locById(open.inLocId):null;
  if(open)_attStartTick();
  const state=open
    ?`<div style="display:flex;align-items:center;gap:10px"><span style="width:10px;height:10px;border-radius:50%;background:#428059;box-shadow:0 0 0 4px rgba(66,128,89,.18)"></span><div><div style="font-size:13px;font-weight:800;color:var(--c-success-ink)">Clocked in · ${open.mode==='wfh'?'Working from home':(loc?esc(loc.name):'On site')}</div><div style="font-size:12px;color:var(--c-text-3)">since ${_attHM(open.inAt)} · <b id="att-elapsed" style="color:var(--c-text)">${_attFmtMins(_attMins(open))}</b> so far</div></div></div>`
    :`<div style="display:flex;align-items:center;gap:10px"><span style="width:10px;height:10px;border-radius:50%;background:var(--c-border-2)"></span><div><div style="font-size:13px;font-weight:800;color:var(--c-text)">${rows.length?'Clocked out':'Not clocked in yet'}</div><div style="font-size:12px;color:var(--c-text-3)">${rows.length?('Today: '+_attFmtMins(total)+' · last out '+_attHM(rows[rows.length-1].outAt)):(off?'Today is your day off':('Shift '+sched.in+' – '+sched.out))}</div></div></div>`;
  const btnHTML=open
    ?`<button id="att-btn" onclick="App._attClockOut()" class="ui-btn ui-btn-primary ui-btn-md" style="min-width:150px;background:var(--c-danger)">${ic('clock','w-[18px] h-[18px]')}Clock out</button>`
    :(canClock?`<button id="att-btn" onclick="App._attClockIn()" class="ui-btn ui-btn-brand ui-btn-md" style="min-width:150px">${ic('clock','w-[18px] h-[18px]')}Clock in</button>`:'');
  const wfhBtn=u.wfhAllowed?`<button onclick="App._attToggleWfh()" class="ui-btn ${wfh?'ui-btn-primary':'ui-btn-ghost'} ui-btn-md" title="${wfh?'Turn off work-from-home for today':'Mark today as work from home — clock in without a geofence'}">🏠 ${wfh?'WFH today ✓':'Work from home'}</button>`:'';
  const hint=!open&&!wfh&&!fences.length?'<div style="font-size:11.5px;color:var(--c-warn-ink);background:var(--c-warn-soft);border-radius:10px;padding:8px 11px;margin-top:10px">No office has a geofence yet — clock-in will work once an admin sets one up under Locations.</div>':
    (!open&&wfh?'<div style="font-size:11.5px;color:var(--c-text-3);margin-top:10px">Work-from-home day — clock in from anywhere; your manager has been told.</div>':'');
  const sessions=rows.length>1||(rows.length===1&&rows[0].outAt)?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">${rows.map(a=>`<span style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;background:var(--c-surface-2);color:var(--c-text-2)">${_attHM(a.inAt)} → ${a.outAt?_attHM(a.outAt):'…'}${a.autoOut?' <span title="Auto clocked out">⚠</span>':''}</span>`).join('')}</div>`:'';
  return `<div class="ui-card" style="padding:16px 18px;background:linear-gradient(135deg,#FFFFFF,#FAF5EC)">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
      ${state}
      <div style="display:flex;gap:8px;flex-wrap:wrap">${wfhBtn}${btnHTML}</div>
    </div>${hint}${sessions}
  </div>`;
}
function _homeGreeting(){const h=new Date().getHours();return h<12?'Good morning':h<17?'Good afternoon':'Good evening';}
function homePage(){
  const u=me();if(!u)return '';
  _attLoadMine();_attLiveStart();
  const today=todayISO();
  // today's work
  let clsDue=0,clsDone=0;try{const cls=myCls(S.uid,today);clsDue=cls.length;clsDone=cls.filter(c=>{const s=subForCl(c,S.uid,today);return s&&s.status!=='Editing';}).length;}catch(e){}
  let okrDue=0;try{if(typeof okrDueForUser==='function')okrDue=okrDueForUser(S.uid,today).filter(o=>!okrCheckinForDate(o.id,today)).length;}catch(e){}
  const apprN=can('approvals','view')?(()=>{try{return _approvalPendingCount();}catch(e){return 0;}})():0;
  const tkN=(DB.tickets||[]).filter(t=>t.assignedTo===S.uid&&(t.status==='Open'||t.status==='In Progress')).length;
  const dmN=(typeof _dmUnreadTotal==='function')?_dmUnreadTotal():0;
  const alertsN=(DB.notifications||[]).filter(n=>n.userId===S.uid&&!n.read).length;
  // week hours
  const wk=[];for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);wk.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'));}
  const wkMins=wk.reduce((n,d)=>n+_attDayMins(S.uid,d),0);
  const tile=(label,val,sub,icon,go,tone)=>`<button onclick="${go}" class="stat-card-click" style="text-align:left;background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--r-lg);box-shadow:var(--sh-sm);padding:14px;cursor:pointer;min-width:0">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px"><span style="font-size:11px;font-weight:700;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em">${label}</span><span style="width:26px;height:26px;border-radius:8px;background:${tone}18;color:${tone};display:grid;place-items:center;flex-shrink:0">${ic(icon,'w-3.5 h-3.5')}</span></div>
      <div class="fd" style="font-size:26px;font-weight:800;line-height:1;color:${tone}">${val}</div>
      <div style="font-size:11.5px;color:var(--c-text-3);margin-top:6px">${sub}</div></button>`;
  const strip=wk.map(d=>{const m=_attDayMins(S.uid,d);const w=_attIsWfh(S.uid,d);const off=_attIsOff(u,d);const on=d===today;return `<div style="flex:1;min-width:0;text-align:center"><div style="height:46px;display:flex;align-items:flex-end;justify-content:center"><div title="${_attFmtMins(m)}" style="width:70%;max-width:26px;height:${Math.max(4,Math.min(46,m/10))}px;border-radius:6px 6px 2px 2px;background:${m?(w?'#B7826F':'var(--c-brand)'):(off?'var(--c-border)':'var(--c-border-2)')}"></div></div><div style="font-size:10px;font-weight:${on?'800':'600'};color:${on?'var(--c-brand)':'var(--c-text-3)'};margin-top:4px">${dayAbbr(d)}</div></div>`;}).join('');
  return `<div class="fade">
    ${hdr(_homeGreeting()+', '+esc(u.firstName||'there')+' 👋',fmtD(today)+' · here’s your day at a glance')}
    ${_attClockCard()}
    <div class="bb-kpis" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:12px 0">
      ${tile('Checklists',clsDone+'/'+clsDue,clsDue?(clsDue-clsDone)+' still to submit':'nothing due today','check',"App.go('mychecklists')",'#54433C')}
      ${okrDue?tile('OKR check-ins',okrDue,'due today','flag',"App.go('okr')",'#936659'):''}
      ${can('messages','view')?tile('Messages',dmN,dmN?'unread chats':'all caught up','msg',"App.go('crm');if(window.CRM){CRM.sel.dm=true;CRM.sel.convoId=null;rr();}",'#B7826F'):''}
      ${tile('Alerts',alertsN,alertsN?'unread':'inbox is clear','bell',"App.go('notifications')",'#AF7B6D')}
      ${apprN?tile('Approvals',apprN,'waiting for you','approve',"App.go('approvals')",'#13171B'):''}
      ${tkN?tile('My tickets',tkN,'open or in progress','ticket',"App.go('tickets')",'#A97C33'):''}
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px">
      <div class="ui-card"><div class="ui-card-head"><span class="ui-card-title">This week</span><button onclick="App.go('attendance')" style="font-size:12px;font-weight:700;color:var(--c-brand);background:none;border:none;cursor:pointer">Attendance →</button></div>
        <div class="ui-card-pad" style="padding-top:12px"><div style="display:flex;align-items:baseline;gap:8px;margin-bottom:8px"><span class="fd" style="font-size:24px;font-weight:800">${_attFmtMins(wkMins)}</span><span style="font-size:12px;color:var(--c-text-3)">worked in the last 7 days</span></div><div class="hscroll" style="gap:4px">${strip}</div></div></div>
      ${_homeTodayChecklists(today)}
    </div>
  </div>`;
}
function _homeTodayChecklists(today){
  let cls=[];try{cls=myCls(S.uid,today);}catch(e){}
  const rows=cls.slice(0,6).map(c=>{const s=subForCl(c,S.uid,today);const st=s?s.status:'Pending';const late=!s&&c.scheduleTime&&nowHM()>hm2m(c.scheduleTime);return `<button onclick="App.go('mychecklists')" style="width:100%;display:flex;align-items:center;gap:10px;padding:9px 0;border:none;border-top:1px solid var(--c-border);background:none;cursor:pointer;text-align:left"><span style="width:8px;height:8px;border-radius:50%;flex-shrink:0;background:${s?'#428059':(late?'#C9584A':'#C9A76B')}"></span><span style="flex:1;min-width:0;font-size:13px;font-weight:600;color:var(--c-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.name)}</span><span style="font-size:11px;color:var(--c-text-3);flex-shrink:0">${c.scheduleTime?'by '+c.scheduleTime:''}</span>${chip(s?st:(late?'Late':'Pending'))}</button>`;}).join('');
  return `<div class="ui-card"><div class="ui-card-head"><span class="ui-card-title">Today’s checklists</span><button onclick="App.go('mychecklists')" style="font-size:12px;font-weight:700;color:var(--c-brand);background:none;border:none;cursor:pointer">Open →</button></div><div class="ui-card-pad" style="padding-top:4px;padding-bottom:6px">${rows||'<div style="padding:18px 0;text-align:center;font-size:12.5px;color:var(--c-text-3)">Nothing due today 🎉</div>'}${cls.length>6?`<div style="font-size:11.5px;color:var(--c-text-3);padding:8px 0 2px">+${cls.length-6} more</div>`:''}</div></div>`;
}

/* ═══════════════ ATTENDANCE TAB ═══════════════ */
function _attYM(){const d=new Date();return S.filters.attYm||(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'));}
function _attMonthDays(ym){const [y,m]=ym.split('-').map(Number);const n=new Date(y,m,0).getDate();const out=[];for(let i=1;i<=n;i++)out.push(ym+'-'+String(i).padStart(2,'0'));return out;}
function _attMonthLabel(ym){const [y,m]=ym.split('-').map(Number);return new Date(y,m-1,1).toLocaleDateString('en-GB',{month:'long',year:'numeric'});}
App._attShiftMonth=(n)=>{const [y,m]=_attYM().split('-').map(Number);const d=new Date(y,m-1+n,1);S.filters.attYm=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');rr();};
function _attMonthStats(uid2,ym){
  const u=uById(uid2);const days=_attMonthDays(ym).filter(d=>d<=todayISO());
  let present=0,mins=0,wfh=0,late=0,autoOut=0,absent=0,off=0;
  days.forEach(d=>{const rows=_attRowsFor(uid2,d);const m=rows.reduce((n,a)=>n+_attMins(a),0);const isOff=_attIsOff(u,d);
    if(!rows.length&&!_attTracked(u,d))return;
    if(rows.length){present++;mins+=m;if(rows.some(a=>a.mode==='wfh'))wfh++;if(rows.some(a=>a.autoOut))autoOut++;if(_attLate(u,rows[0]))late++;}
    else if(isOff)off++;else absent++;});
  return{present,mins,wfh,late,autoOut,absent,off,avg:present?Math.round(mins/present):0};
}
function attendancePage(){
  const u=me();if(!u)return '';
  _attLoadMine();_attLiveStart();if(!_ATTS)_attLoadSettings().then(()=>rr());
  const others=_attScopeUsers().filter(x=>x.id!==S.uid).length>0;
  const canMng=can('attendance','manage');
  const TABS=[['my','My attendance']].concat(others?[['team','Team']]:[]).concat(canMng?[['settings','Settings']]:[]);
  let tab=S.filters.attTab||'my';if(!TABS.some(t=>t[0]===tab))tab='my';
  const ym=_attYM();
  const monthNav=`<div style="display:flex;align-items:center;gap:6px"><button onclick="App._attShiftMonth(-1)" class="ui-btn ui-btn-ghost ui-btn-sm" aria-label="Previous month">${ic('back','w-4 h-4')}</button><span style="font-size:13.5px;font-weight:800;min-width:130px;text-align:center">${_attMonthLabel(ym)}</span><button onclick="App._attShiftMonth(1)" class="ui-btn ui-btn-ghost ui-btn-sm" aria-label="Next month" ${ym>=todayISO().slice(0,7)?'disabled':''}>${ic('chevR','w-4 h-4')}</button></div>`;
  const tabs=`<div class="ui-tabs" style="margin-bottom:14px">${TABS.map(([k,l])=>`<button class="ui-tab${tab===k?' on':''}" onclick="S.filters.attTab='${k}';rr()">${l}</button>`).join('')}</div>`;
  let body='';
  if(!_attEnabled()&&tab!=='settings'){body=(_ATTS?empty('clock','Attendance isn’t switched on yet',can('attendance','manage')?'Turn it on under Settings when the geofences are ready.':'Your admin will switch it on soon.'):loadingState());}
  else if(tab==='my')body=_attMyTab(S.uid,ym,monthNav);
  else if(tab==='team')body=_attTeamTab(ym,monthNav);
  else body=_attSettingsTab();
  return `<div class="fade">${hdr('Attendance','Clock-ins, hours and work-from-home days',tab!=='settings'&&can('attendance','export')?btn('Export CSV',`App._attExport('${tab}')`,{variant:'ghost',size:'sm',icon:'download'}):'')}${tabs}${body}</div>`;
}
function _attMyTab(uid2,ym,monthNav){
  const u=uById(uid2);const st=_attMonthStats(uid2,ym);
  const mine=uid2===S.uid;
  if(!mine&&!_attLoaded['m:'+ym])_attLoadMonth(ym);
  const canEdit=can('attendance','edit')&&(mine?true:scopeFilter('attendance')(uid2));
  const tiles=[['Days present',st.present,'#54433C'],['Hours',_attFmtMins(st.mins),'#13171B'],['Avg / day',_attFmtMins(st.avg),'#936659'],['WFH days',st.wfh,'#B7826F'],['Late arrivals',st.late,'#A97C33'],['Auto clock-outs',st.autoOut,'#C9584A'],['Absent',st.absent,'#786A5F']].map(([l,v,c])=>`<div style="background:var(--c-surface);border:1px solid var(--c-border);border-radius:14px;padding:12px 14px;min-width:0"><div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--c-text-3)">${l}</div><div class="fd" style="font-size:22px;font-weight:800;color:${c};margin-top:4px">${v}</div></div>`).join('');
  const days=_attMonthDays(ym).filter(d=>d<=todayISO()).reverse();
  const rows=days.map(d=>{
    const rs=_attRowsFor(uid2,d);const m=rs.reduce((n,a)=>n+_attMins(a),0);const off=_attIsOff(u,d);const wfh=_attIsWfh(uid2,d)||rs.some(a=>a.mode==='wfh');
    const first=rs[0],last=rs[rs.length-1];
    const status=rs.length?(last&&!last.outAt?'In':(wfh?'WFH':'Present')):(off?'Off':((d===todayISO()||!_attTracked(u,d)||u.attendanceRequired===false)?'—':'Absent'));
    const sc={In:'background:#E9F1E8;color:#346A47',Present:'background:#E9F1E8;color:#346A47',WFH:'background:#F6EAE3;color:#8A6152',Off:'background:#F7F3EE;color:#A59788',Absent:'background:#F9EBE5;color:#A63528','—':'background:#F7F3EE;color:#A59788'}[status];
    const loc=first&&first.inLocId?locById(first.inLocId):null;
    return `<div class="att-row" style="display:grid;grid-template-columns:64px 1fr auto;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--c-border)">
      <div><div style="font-size:13px;font-weight:800;color:var(--c-text)">${fmtS(d)}</div><div style="font-size:10.5px;color:var(--c-text-3)">${dayAbbr(d)}</div></div>
      <div style="min-width:0"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="font-size:11px;font-weight:700;padding:2px 9px;border-radius:20px;${sc}">${status}</span>${rs.length?`<span style="font-size:12.5px;color:var(--c-text)">${_attHM(first.inAt)} → ${last.outAt?_attHM(last.outAt):'…'}</span>`:''}${rs.length>1?`<span style="font-size:10.5px;color:var(--c-text-3)">${rs.length} sessions</span>`:''}${first&&_attLate(u,first)?'<span style="font-size:10px;font-weight:800;color:#A97C33">LATE</span>':''}${rs.some(a=>a.autoOut)?'<span style="font-size:10px;font-weight:800;color:#C9584A" title="Forgot to clock out — auto clocked out">AUTO OUT</span>':''}${rs.some(a=>a.editedBy)?'<span style="font-size:10px;font-weight:800;color:#786A5F" title="Edited by a manager">EDITED</span>':''}</div>
        <div style="font-size:11px;color:var(--c-text-3);margin-top:2px">${loc?esc(loc.name):(wfh&&rs.length?'Work from home':'')}${first&&first.note?' · '+esc(first.note):''}</div></div>
      <div style="display:flex;align-items:center;gap:8px"><span class="fd" style="font-size:14px;font-weight:800;color:var(--c-text)">${rs.length?_attFmtMins(m):''}</span>${canEdit?`<button onclick="App._attEdit('${rs.length?rs[0].id:''}','${uid2}','${d}')" class="ui-btn ui-btn-subtle ui-btn-sm" style="min-height:28px;padding:2px 8px" title="${rs.length?'Edit':'Add entry'}">${ic(rs.length?'edit':'plus','w-3.5 h-3.5')}</button>`:''}</div>
    </div>`;}).join('');
  return `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px">${mine?'':`<div style="display:flex;align-items:center;gap:8px">${avatar(u,'w-8 h-8','text-[11px]')}<b style="font-size:14px">${esc(fullName(u))}</b>${can('employees','viewProfile')?`<button onclick="App.openProfile('${u.id}')" style="font-size:12px;font-weight:700;color:var(--c-brand);background:none;border:none;cursor:pointer">Profile →</button>`:''}</div>`}${monthNav}</div>
    <div class="bb-kpis" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:14px">${tiles}</div>
    <div class="ui-card"><div class="ui-card-pad" style="padding-top:4px">${rows||'<div style="padding:24px;text-align:center;color:var(--c-text-3);font-size:12.5px">No days yet</div>'}</div></div>`;
}
function _attTeamTab(ym,monthNav){
  _attLoadMonth(ym);
  const people=_attScopeUsers();
  const day=S.filters.attDay||todayISO();
  const q=(S.filters.attQ||'').toLowerCase();
  const list=people.filter(p=>!q||fullName(p).toLowerCase().includes(q)||String(p.department||'').toLowerCase().includes(q));
  if(S.filters.attPerson){const p=uById(S.filters.attPerson);if(p)return `<button onclick="S.filters.attPerson=null;rr()" class="ui-btn ui-btn-ghost ui-btn-sm" style="margin-bottom:12px">${ic('back','w-4 h-4')}Back to team</button>`+_attMyTab(p.id,ym,monthNav);}
  const isToday=day===todayISO();
  let inN=0,wfhN=0,outN=0,absN=0;
  const rows=list.map(p=>{
    const rs=_attRowsFor(p.id,day);const open=rs.find(a=>!a.outAt);const wfh=_attIsWfh(p.id,day)||rs.some(a=>a.mode==='wfh');const off=_attIsOff(p,day);
    const m=rs.reduce((n,a)=>n+_attMins(a),0);const first=rs[0],last=rs[rs.length-1];
    let status,sc;
    if(open){status=wfh?'In · WFH':'In';sc='background:#E9F1E8;color:#346A47';inN++;}
    else if(rs.length){status=wfh?'Done · WFH':'Done';sc='background:#F5EFDF;color:#463830';outN++;}
    else if(wfh){status='WFH';sc='background:#F6EAE3;color:#8A6152';wfhN++;}
    else if(off){status='Off';sc='background:#F7F3EE;color:#A59788';}
    else if(!p.attendanceRequired){status='Exempt';sc='background:#F7F3EE;color:#A59788';}
    else if(!_attTracked(p,day)){status='—';sc='background:#F7F3EE;color:#A59788';}
    else{status=isToday&&nowHM()<hm2m(_attSchedule(p).in)?'Not yet':'Absent';sc=status==='Absent'?'background:#F9EBE5;color:#A63528':'background:#F7F3EE;color:#A59788';if(status==='Absent')absN++;}
    const loc=first&&first.inLocId?locById(first.inLocId):null;
    const st=_attMonthStats(p.id,ym);
    return `<div class="att-trow" onclick="S.filters.attPerson='${p.id}';rr()" style="display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--c-border);cursor:pointer">
      <div style="display:flex;align-items:center;gap:10px;min-width:0">${avatar(p,'w-9 h-9','text-[11px]')}<div style="min-width:0"><div style="font-size:13px;font-weight:700;color:var(--c-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(fullName(p))}</div><div style="font-size:11px;color:var(--c-text-3);display:flex;gap:6px;flex-wrap:wrap;align-items:center"><span style="font-size:10.5px;font-weight:700;padding:1px 8px;border-radius:20px;${sc}">${status}</span>${rs.length?`<span>${_attHM(first.inAt)} → ${last.outAt?_attHM(last.outAt):'…'}</span>`:''}${loc?`<span>· ${esc(loc.name)}</span>`:''}${first&&_attLate(p,first)?'<span style="font-weight:800;color:#A97C33">LATE</span>':''}${rs.some(a=>a.autoOut)?'<span style="font-weight:800;color:#C9584A">AUTO OUT</span>':''}</div></div></div>
      <div style="text-align:right"><div class="fd" style="font-size:14px;font-weight:800">${rs.length?_attFmtMins(m):'—'}</div><div style="font-size:10.5px;color:var(--c-text-3)">${st.present}d · ${_attFmtMins(st.mins)} this month</div></div>
    </div>`;}).join('');
  return `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><input type="date" class="ui-input" style="width:auto" value="${day}" max="${todayISO()}" onchange="S.filters.attDay=this.value;S.filters.attYm=this.value.slice(0,7);rr()"/>${isToday?'':`<button onclick="S.filters.attDay=null;S.filters.attYm=null;rr()" class="ui-btn ui-btn-subtle ui-btn-sm">Today</button>`}</div>${monthNav}</div>
    <div class="bb-kpis" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:12px">${[['Clocked in',inN,'#346A47'],['Finished',outN,'#463830'],['WFH',wfhN,'#8A6152'],['Absent',absN,'#A63528'],['People',list.length,'#13171B']].map(([l,v,c])=>`<div style="background:var(--c-surface);border:1px solid var(--c-border);border-radius:14px;padding:12px 14px"><div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--c-text-3)">${l}</div><div class="fd" style="font-size:22px;font-weight:800;color:${c};margin-top:4px">${v}</div></div>`).join('')}</div>
    <div class="ui-card"><div style="padding:10px 12px;border-bottom:1px solid var(--c-border)"><input id="att-q" class="ui-input" placeholder="Search people…" value="${esc(S.filters.attQ||'')}" oninput="S.filters.attQ=this.value;App._searchRR('att-q')"/></div><div class="ui-card-pad" style="padding-top:2px">${rows||empty('users','Nobody in your scope','')}</div></div>`;
}
function _attSettingsTab(){
  const s=_attSettings();
  const row=(id,label,desc,ctl)=>`<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;padding:11px 0;border-top:1px solid var(--c-border)"><div style="min-width:0"><div style="font-size:13.5px;font-weight:700;color:var(--c-text)">${label}</div><div style="font-size:11.5px;color:var(--c-text-3);line-height:1.45">${desc}</div></div><div style="flex-shrink:0">${ctl}</div></div>`;
  const tog=(k)=>`<button role="switch" aria-checked="${s[k]!==false}" class="tog ${s[k]!==false?'on':'off'}" onclick="App._attSet('${k}',!(this.classList.contains('on')));this.classList.toggle('on');this.classList.toggle('off')"><span></span></button>`;
  const num=(k,unit,min,max)=>`<div style="display:flex;align-items:center;gap:6px"><input type="number" min="${min}" max="${max}" value="${s[k]}" class="ui-input" style="width:84px;padding:7px 10px" onchange="App._attSet('${k}',Number(this.value))"/><span style="font-size:11.5px;color:var(--c-text-3)">${unit}</span></div>`;
  const master=`<div class="ui-card" style="margin-bottom:12px;border:1.5px solid ${s.enabled?'#428059':'var(--c-border-2)'}"><div class="ui-card-pad" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap"><div style="flex:1;min-width:220px"><div style="font-size:14px;font-weight:800;color:var(--c-text)">Attendance system ${s.enabled?'<span style="font-size:10.5px;padding:2px 8px;border-radius:20px;background:#E9F1E8;color:#346A47;vertical-align:middle">LIVE</span>':'<span style="font-size:10.5px;padding:2px 8px;border-radius:20px;background:var(--c-surface-2);color:var(--c-text-3);vertical-align:middle">OFF</span>'}</div><div style="font-size:12px;color:var(--c-text-3);line-height:1.45">Off: nobody sees the clock card or WFH button, and the server sends no reminders or auto clock-outs. Turn it on once every office has its geofence and people have been told.</div></div>${tog('enabled')}</div></div>`;
  return master+`<div class="ui-card"><div class="ui-card-head"><span class="ui-card-title">Attendance rules</span><span style="font-size:11px;color:var(--c-text-3)">saved instantly · apply to everyone</span></div><div class="ui-card-pad" style="padding-top:2px">
    ${row('auto','Auto clock-out time','Anyone still clocked in is clocked out automatically at this time (local time) and told about it.',`<input type="time" value="${esc(s.auto_out_time||'23:59')}" class="ui-input" style="width:auto;padding:7px 10px" onchange="App._attSet('auto_out_time',this.value)"/>`)}
    ${row('strict','Geofence for clock-out too','On: people must be inside the geofence to clock out as well as in. Off: clock-out works from anywhere (the location is still recorded).',tog('geofence_strict'))}
    ${row('tol','GPS tolerance','Extra metres added to every geofence radius, because phones are rarely exact.',num('gps_tolerance_m','m',0,200))}
    ${row('acc','Reject weak GPS above','If the phone reports a worse accuracy than this, ask the person to try again instead of guessing.',num('max_accuracy_m','m',50,2000))}
    ${row('late','Late grace period','Minutes after the shift start before an arrival counts as late.',num('late_grace_min','min',0,120))}
    ${row('rin','Clock-in reminder','Remind people who haven’t clocked in, this many minutes after their shift start (in-app, push and email as per their preferences).',`<div style="display:flex;align-items:center;gap:8px">${num('reminder_in_after_min','min',0,240)}${tog('reminder_in_on')}</div>`)}
    ${row('rout','Clock-out reminder','Remind people still clocked in, this many minutes after their shift end.',`<div style="display:flex;align-items:center;gap:8px">${num('reminder_out_after_min','min',0,240)}${tog('reminder_out_on')}</div>`)}
    ${row('wfh','Tell the manager about WFH days','When someone marks a work-from-home day, their manager gets a note (in-app + email as per settings).',tog('wfh_notify_manager'))}
    ${row('from','Tracking started on','Days before this date are not counted as absent (the feature launch date, or when you started using it).',`<input type="date" value="${esc(s.tracking_from||'')}" class="ui-input" style="width:auto;padding:7px 10px" onchange="App._attSet('tracking_from',this.value)"/>`)}
    ${row('tz','Time zone','Used for the auto clock-out and reminders.',`<input value="${esc(s.tz||'Asia/Dubai')}" class="ui-input" style="width:150px;padding:7px 10px" onchange="App._attSet('tz',this.value)"/>`)}
  </div></div>
  <p style="font-size:12px;color:var(--c-text-3);margin-top:12px;line-height:1.5">Per-person switches — <b>who may work from home</b>, <b>who must clock in</b> and each person’s <b>shift times and off days</b> — live on their profile (Users → open profile → Work).</p>`;
}
App._attSet=(k,v)=>{if(!can('attendance','manage'))return toast('You need Attendance → Manage','err');_attSaveSettings({[k]:v}).then(()=>{toast(k==='enabled'?(v?'Attendance is LIVE — clock cards, reminders and auto clock-out are on':'Attendance switched off'):'Saved');if(k==='enabled'){log(fullName(me()),v?'Attendance switched ON':'Attendance switched OFF','');rr();}});};

/* ── Manual edit / add (managers) ── */
App._attEdit=(id,uid2,date)=>{
  if(!can('attendance','edit'))return toast('You need Attendance → Edit','err');
  const a=id?(DB.attendance||[]).find(x=>x.id===id):null;
  const u=uById(uid2);
  const t=iso=>iso?new Date(iso).toTimeString().slice(0,5):'';
  modalShell({title:(a?'Edit':'Add')+' attendance — '+fullName(u),sub:fmtD(date)+' · a reason is required and the person is told',size:'max-w-md',key:'att-edit',
    body:`<div style="display:grid;gap:12px">
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">${fld('Clock in','ae-in',t(a&&a.inAt),'time')}${fld('Clock out','ae-out',t(a&&a.outAt),'time')}</div>
      ${selF('Mode','ae-mode',[['office','Office'],['wfh','Work from home']],a?a.mode:'office')}
      ${fld('Note (visible to the person)','ae-note',a?a.note:'')}
      ${fld('Reason for this change *','ae-reason',a?a.editReason||'':'')}
    </div>`,
    footer:(a&&can('attendance','delete')?btn('Delete',`App._attDel('${a.id}')`,{variant:'danger',size:'md',icon:'trash'}):'')+btnG('Cancel','App.closeModal()')+btnP('Save','App._attEditSave(\''+(a?a.id:'')+'\',\''+uid2+'\',\''+date+'\')')});
};
App._attEditSave=async(id,uid2,date)=>{
  if(!can('attendance','edit'))return;
  const tin=$('#ae-in')?.value,tout=$('#ae-out')?.value,mode=$('#ae-mode')?.value||'office',note=($('#ae-note')?.value||'').trim(),reason=($('#ae-reason')?.value||'').trim();
  if(!tin)return toast('Clock-in time is required','err');
  if(!reason)return toast('Give a reason — it is shown to the person and kept in the audit log','err');
  const mk=t=>t?new Date(date+'T'+t+':00').toISOString():null;
  if(tout&&mk(tout)<mk(tin))return toast('Clock-out must be after clock-in','err');
  const now=new Date().toISOString();
  const patch={clock_in_at:mk(tin),clock_out_at:mk(tout),mode,note,edited_by:S.uid,edited_at:now,edit_reason:reason,updated_at:now,auto_out:false};
  let err;
  if(id){({error:err}=await sb.from('attendance').update(patch).eq('id',id));if(!err){const a=DB.attendance.find(x=>x.id===id);if(a)Object.assign(a,{inAt:patch.clock_in_at,outAt:patch.clock_out_at,mode,note,editedBy:S.uid,editedAt:now,editReason:reason,autoOut:false});}}
  else{const row={id:uid('att'),user_id:uid2,date,source:'manual',...patch};({error:err}=await sb.from('attendance').insert(row));if(!err)_attMerge([row]);}
  if(err)return toast('Couldn’t save — '+err.message,'err');
  log(fullName(me()),id?'Edited attendance':'Added attendance',fullName(uById(uid2))+' · '+date+' · '+reason);
  _attNotify(uid2,'✏️ '+fullName(me())+' '+(id?'edited':'added')+' your attendance for '+fmtS(date)+' — '+reason,'att:'+date,'attendance');
  try{if(typeof sendEmail==='function'&&uid2!==S.uid)sendEmail('attendance_edited',uid2,{date:fmtD(date),reason,actor:fullName(me())}).catch(()=>{});}catch(e){}
  closeModal();toast('Saved ✓');rr();
};
App._attDel=async(id)=>{
  if(!can('attendance','delete'))return toast('You need Attendance → Delete','err');
  const a=(DB.attendance||[]).find(x=>x.id===id);if(!a)return;
  if(!(await confirmP({title:'Delete this attendance entry?',body:'<b>'+esc(fullName(uById(a.userId)))+'</b> · '+esc(fmtD(a.date))+' · '+_attHM(a.inAt)+' → '+(a.outAt?_attHM(a.outAt):'…'),confirmLabel:'Delete',cancelLabel:'Keep it'})))return;
  DB.attendance=DB.attendance.filter(x=>x.id!==id);closeModal();rr();
  const{error}=await sb.from('attendance').delete().eq('id',id);
  if(error){_attMerge([{id:a.id,user_id:a.userId,date:a.date,clock_in_at:a.inAt,clock_out_at:a.outAt,mode:a.mode}]);rr();return toast('Couldn’t delete — '+error.message,'err');}
  log(fullName(me()),'Deleted attendance',fullName(uById(a.userId))+' · '+a.date);
  toast('Deleted','warn');
};
App._attExport=(tab)=>{
  if(!can('attendance','export'))return toast('You need Attendance → Export','err');
  const ym=_attYM();const people=tab==='team'?_attScopeUsers():[me()];
  const lines=[['Name','Email','Department','Date','Status','Clock in','Clock out','Hours','Mode','Location','Late','Auto out','Edited','Note']];
  people.forEach(p=>{_attMonthDays(ym).filter(d=>d<=todayISO()).forEach(d=>{const rs=_attRowsFor(p.id,d);if(!rs.length){if(!_attTracked(p,d))return;lines.push([fullName(p),p.email,p.department,d,_attIsOff(p,d)?'Off':'Absent','','','0','','','','','','']);return;}rs.forEach(a=>{const loc=a.inLocId?locById(a.inLocId):null;lines.push([fullName(p),p.email,p.department,d,'Present',_attHM(a.inAt),a.outAt?_attHM(a.outAt):'',(_attMins(a)/60).toFixed(2),a.mode,loc?loc.name:'',_attLate(p,a)?'yes':'',a.autoOut?'yes':'',a.editedBy?'yes':'',a.note||'']);});});});
  const csv=lines.map(r=>r.map(v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"').join(',')).join('\n');
  const blob=new Blob(['﻿'+csv],{type:'text/csv'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='attendance-'+ym+(tab==='team'?'-team':'')+'.csv';a.click();
  log(fullName(me()),'Exported attendance',ym);
};
