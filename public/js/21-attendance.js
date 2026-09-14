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
      <p style="font-size:12px;color:var(--c-text-3);margin-top:12px;line-height:1.5">People can clock in and out only while they are inside an active geofence (or on a work-from-home day). ${_attSettings().open_shift_mode==='auto_out'?'Anyone still clocked in at the end of the day is clocked out automatically at <b>'+esc(_attSettings().auto_out_time||'23:59')+'</b>.':'A forgotten clock-out stays open and is flagged to the person’s manager to close.'}</p>
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
/* v133 — every number below is a PARAMETER (HRMS spec §17). Defaults are the spec's; People confirms before go-live. */
const ATT_DEFAULT={enabled:false,tz:'Asia/Dubai',tracking_from:'2026-09-11',
  open_shift_mode:'flag',            // 'flag' = never close a shift on a timer; the manager resolves it (spec §9.2) · 'auto_out' = legacy 23:59 auto clock-out
  auto_out_time:'23:59',
  reminder_in_on:true,reminder_in_after_min:15,reminder_out_on:true,reminder_out_after_min:30,
  missed_in_rm_after_min:60,         // manager is told about a missed clock-in this long after shift start (same day, §9.2)
  clockout_reminder_hours:10,        // "still clocked in?" nudge after this many hours on the clock (§17)
  log_buffer_days:3,                 // an open / incomplete day older than this escalates (§9.6)
  geofence_strict:true,gps_tolerance_m:30,max_accuracy_m:300,min_exit_dwell_min:30,
  late_grace_min:30,grace_instances_per_month:4,partial_day_instances_per_month:2,
  wfh_instances_per_month:4,regularisation_monthly_cap:7,regularisation_window_days:2,
  half_day_below_h:4.5,absent_below_h:2,shortage_tolerance_min:30,
  ot_max_day_h:7,ot_max_week_h:35,
  comp_off_rate:1,comp_off_expiry_days:60,comp_off_annual_cap:30};
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
function _mAtt(r){return{id:r.id,userId:r.user_id,date:r.date,inAt:r.clock_in_at||null,outAt:r.clock_out_at||null,inLat:r.in_lat,inLng:r.in_lng,inAcc:r.in_acc,outLat:r.out_lat,outLng:r.out_lng,outAcc:r.out_acc,inLocId:r.in_location_id||null,outLocId:r.out_location_id||null,inDist:r.in_distance_m,outDist:r.out_distance_m,mode:r.mode||'office',autoOut:!!r.auto_out,source:r.source||'web',note:r.note||'',editedBy:r.edited_by||null,editedAt:r.edited_at||null,editReason:r.edit_reason||'',updatedAt:r.updated_at||null,history:Array.isArray(r.history)?r.history:[],queued:!!r.queued,rmNotifiedAt:r.rm_notified_at||null};}
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
  _attLoadHolidays();_attLoadRequests();
}
function _attScopeUsers(){
  const f=scopeFilter('attendance');
  return (DB.users||[]).filter(u=>u.status==='Active'&&(u.id===S.uid||f(u.id))).sort((a,b)=>fullName(a).localeCompare(fullName(b)));
}
function _attRowsFor(uid2,date){return (DB.attendance||[]).filter(a=>a.userId===uid2&&a.date===date).sort((a,b)=>String(a.inAt).localeCompare(String(b.inAt)));}
/* Open session — today's first; otherwise the most recent unresolved one (an open shift the manager still has to close). */
function _attOpen(uid2){const all=(DB.attendance||[]).filter(a=>a.userId===uid2&&a.inAt&&!a.outAt);return all.find(a=>a.date===todayISO())||all[0]||null;}
/* The session the person can still clock out of: open and not (yet) an unresolved open shift. */
function _attOpenToday(uid2){return (DB.attendance||[]).find(a=>a.userId===uid2&&a.inAt&&!a.outAt&&!_attIsOpenShift(a))||null;}
function _attIsWfh(uid2,date){return (DB.wfh||[]).some(w=>w.userId===uid2&&w.date===date);}
/* An open session on a PAST day is an unresolved open shift: its hours are unknown, so it counts 0 until the manager
   resolves it (spec §9.2 — never infer a clock-out from an absence of data). Today's open session keeps ticking. */
function _attIsOpenShift(a){
  if(!a||!a.inAt||a.outAt)return false;const t=todayISO();if(a.date>=t)return false;
  // A night shift that started yesterday is still live this morning — only call it "open" once it is older than
  // yesterday, or has been running longer than anyone's shift could (12 h, or clockout_reminder_hours + 4).
  const y=new Date();y.setDate(y.getDate()-1);if(a.date<_attISO(y))return true;
  const lim=Math.max(12,Number(_attSettings().clockout_reminder_hours||10)+4);
  return (Date.now()-new Date(a.inAt))/36e5>=lim;
}
function _attMins(a){if(!a||!a.inAt)return 0;if(_attIsOpenShift(a))return 0;const end=a.outAt?new Date(a.outAt):new Date();return Math.max(0,Math.round((end-new Date(a.inAt))/60000));}
function _attFmtMins(m){m=Math.max(0,Math.round(m||0));const h=Math.floor(m/60),mm=m%60;return h+'h '+String(mm).padStart(2,'0')+'m';}
function _attFmtHHMM(m){m=Math.max(0,Math.round(m||0));return Math.floor(m/60)+':'+String(m%60).padStart(2,'0');}
function _attHM(iso){if(!iso)return '—';const d=new Date(iso);return d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});}
function _attDayMins(uid2,date){return _attRowsFor(uid2,date).reduce((n,a)=>n+_attMins(a),0);}
/* ═══ WORK PATTERN (spec §9.4) — per person, DATED. u.workSchedule = the current pattern {in,out,offDays,category,
   effectiveFrom} plus history:[{effectiveFrom,in,out,offDays,category}] of earlier versions. _attSchedule(u,date)
   returns the version live on that date, so changing someone's rest day from next Monday never rewrites last month. */
const ATT_CATEGORIES=[['office','Office (geofenced)'],['warehouse','Warehouse / Dark store (geofenced, shift)'],['remote','Remote / field (manual clock-in, no geofence)'],['consultant','Consultant / contingent (manual clock-in)']];
function _attSchedule(u,date){
  const cur={in:'09:00',out:'18:00',offDays:['Sun'],category:'office',...((u&&u.workSchedule)||{})};
  if(!date||!cur.effectiveFrom||date>=cur.effectiveFrom)return cur;
  const hist=(cur.history||[]).filter(h=>h&&h.effectiveFrom&&h.effectiveFrom<=date).sort((a,b)=>b.effectiveFrom.localeCompare(a.effectiveFrom));
  const older=(cur.history||[]).filter(h=>h&&!h.effectiveFrom);   // the pattern that was live before the first dated change
  const pick=hist[0]||older[0];
  return pick?{in:'09:00',out:'18:00',offDays:['Sun'],category:cur.category||'office',...pick}:cur;
}
function _attCategory(u){return _attSchedule(u,todayISO()).category||'office';}
/* Manual capture (no geofence) for remote / consultant categories — spec §9.1 */
function _attManualCapture(u){const c=_attCategory(u);return c==='remote'||c==='consultant';}
function _attStdMins(u,date){const s=_attSchedule(u,date);const m=hm2m(s.out)-hm2m(s.in);return m>0?m:540;}
function _attIsOff(u,date){const s=_attSchedule(u,date);return (s.offDays||[]).includes(dayAbbr(date));}
/* Public holidays: DB.holidays [{id,date,name,locationId|null}] — null = every location (spec §4.2) */
function _attHoliday(u,date){return (DB.holidays||[]).find(h=>h.date===date&&(!h.locationId||!u||!u.locationId||h.locationId===u.locationId))||null;}
/* Approved on-duty covering this date (spec §9.6) */
function _attOnDuty(uid2,date){return (DB.attRequests||[]).find(r=>r.userId===uid2&&r.type==='on_duty'&&r.status==='Approved'&&r.date<=date&&(r.dateTo||r.date)>=date)||null;}
/* Approved partial day (late arrival / early leave) for this date */
function _attPartial(uid2,date){return (DB.attRequests||[]).find(r=>r.userId===uid2&&r.type==='partial_day'&&r.status==='Approved'&&r.date===date)||null;}
/* Approved leave hook — filled in by the leave module later; today nobody is ever "on leave" here. */
function _attOnLeave(uid2,date){try{return (typeof leaveCovering==='function')?leaveCovering(uid2,date):null;}catch(e){return null;}}
/* ═══ classify_day (spec §0.2) — first match wins: holiday → rest day → leave → scheduled working ═══ */
function _attDayKind(u,date){
  const h=_attHoliday(u,date);if(h)return{type:'PUBLIC_HOLIDAY',label:'Public holiday',expectsPunch:false,compOff:true,holiday:h};
  if(_attIsOff(u,date))return{type:'REST_DAY',label:'Rest day',expectsPunch:false,compOff:true};
  const lv=_attOnLeave(u.id,date);if(lv)return{type:'ON_LEAVE',label:'On leave',expectsPunch:false,compOff:false,leave:lv};
  return{type:'SCHEDULED_WORKING',label:'Working day',expectsPunch:u.attendanceRequired!==false,compOff:false};
}
/* Days before attendance tracking started (or before the person joined) are neither present nor absent. */
function _attTracked(u,date){const from=_attSettings().tracking_from||'';if(from&&date<from)return false;if(u&&u.joiningDate&&date<u.joiningDate)return false;return true;}
function _attInMins(a){const d=new Date(a.inAt);return d.getHours()*60+d.getMinutes();}
function _attOutMins(a){const d=new Date(a.outAt);return d.getHours()*60+d.getMinutes();}
/* Late = first clock-in after shift start + grace. Grace is allowed N times a month (spec §9.6); once those are used
   up, an arrival inside the grace window counts as late too. An approved partial-day (late arrival) excuses the day. */
function _attLateRaw(u,a,date){if(!a||!a.inAt)return false;const s=_attSchedule(u,date||a.date);return _attInMins(a)>hm2m(s.in)+Number(_attSettings().late_grace_min||0);}
function _attInGrace(u,a,date){if(!a||!a.inAt)return false;const s=_attSchedule(u,date||a.date);const m=_attInMins(a);return m>hm2m(s.in)&&m<=hm2m(s.in)+Number(_attSettings().late_grace_min||0);}
function _attGraceUsed(uid2,ym,before){const u=uById(uid2);let n=0;(DB.attendance||[]).filter(a=>a.userId===uid2&&a.date.slice(0,7)===ym&&(!before||a.date<before)).forEach(a=>{const first=_attRowsFor(uid2,a.date)[0];if(first&&first.id===a.id&&_attInGrace(u,a,a.date))n++;});return n;}
function _attLate(u,a){
  if(!a||!a.inAt)return false;const d=a.date;
  const p=_attPartial(u.id,d);if(p&&(p.payload||{}).kind==='late_arrival')return false;
  if(_attOnDuty(u.id,d))return false;
  if(_attLateRaw(u,a,d))return true;
  if(_attInGrace(u,a,d)){const cap=Number(_attSettings().grace_instances_per_month||0);if(cap>0&&_attGraceUsed(u.id,d.slice(0,7),d)>=cap)return true;}
  return false;
}
/* Early leave: last clock-out before shift end (not excused by an approved early-leave partial day) */
function _attEarly(u,a){if(!a||!a.outAt||a.autoOut)return false;const p=_attPartial(u.id,a.date);if(p&&(p.payload||{}).kind==='early_leave')return false;if(_attOnDuty(u.id,a.date))return false;return _attOutMins(a)<hm2m(_attSchedule(u,a.date).out);}
/* Everything the payroll file / reports need to know about one person-day (spec §9.3, §9.6, §10.2) */
function _attDayFlags(u,d){
  const st=_attSettings();const rs=_attRowsFor(u.id,d);const kind=_attDayKind(u,d);
  const mins=rs.reduce((n,a)=>n+_attMins(a),0);const std=_attStdMins(u,d);
  const first=rs[0],last=rs[rs.length-1];
  const openShift=rs.some(_attIsOpenShift);
  const onDuty=!!_attOnDuty(u.id,d);
  const working=kind.type==='SCHEDULED_WORKING';   // late / early / short only mean something on a scheduled working day
  const f={kind:kind.type,rows:rs.length,mins,stdMins:std,late:!!(working&&first&&_attLate(u,first)),early:!!(working&&last&&_attEarly(u,last)),openShift,queued:rs.some(a=>a.queued),autoOut:rs.some(a=>a.autoOut),edited:rs.some(a=>a.editedBy),onDuty,restDayWork:kind.compOff&&rs.length>0,wfh:_attIsWfh(u.id,d)||rs.some(a=>a.mode==='wfh'),halfDay:false,shortage:false,otMins:0,absent:false,missingLog:false};
  if(kind.type==='SCHEDULED_WORKING'&&kind.expectsPunch&&_attTracked(u,d)&&d<todayISO()){
    if(!rs.length&&!onDuty)f.absent=true;
    if(rs.length&&!openShift){
      if(mins<Number(st.absent_below_h||0)*60)f.absent=true;
      else if(mins<Number(st.half_day_below_h||0)*60)f.halfDay=true;
      if(mins<std-Number(st.shortage_tolerance_min||0))f.shortage=true;
    }
    if(openShift)f.missingLog=true;
  }
  if(rs.length&&!openShift&&kind.type==='SCHEDULED_WORKING')f.otMins=Math.max(0,mins-std);
  if(rs.length&&!openShift&&kind.compOff)f.otMins=mins;   // rest-day / holiday work is all overtime
  return f;
}
/* Realtime: attendance rows of the people I can see, so Team view and My Day stay live. */
let _attRT=null;
function _attLiveStart(){
  if(_attRT||!S.uid||!sb.channel)return;
  try{
    _attRT=sb.channel('bb-att-'+S.uid)
      .on('postgres_changes',{event:'*',schema:'public',table:'attendance'},p=>{try{const r=p.new&&p.new.id?p.new:null;if(p.eventType==='DELETE'){DB.attendance=(DB.attendance||[]).filter(a=>a.id!==(p.old&&p.old.id));}else if(r){_attMerge([r]);}if(['home','attendance','profile','dashboard'].includes(S.route))rr();}catch(e){}})
      .on('postgres_changes',{event:'*',schema:'public',table:'wfh_days'},p=>{try{DB.wfh=DB.wfh||[];if(p.eventType==='DELETE'){DB.wfh=DB.wfh.filter(w=>!(w.userId===p.old.user_id&&w.date===p.old.date));}else{const r=p.new;if(!DB.wfh.some(w=>w.userId===r.user_id&&w.date===r.date))DB.wfh.push({userId:r.user_id,date:r.date,note:r.note||''});}if(['home','attendance'].includes(S.route))rr();}catch(e){}})
      .on('postgres_changes',{event:'*',schema:'public',table:'attendance_requests'},p=>{try{if(p.eventType==='DELETE'){DB.attRequests=(DB.attRequests||[]).filter(r=>r.id!==(p.old&&p.old.id));}else if(p.new&&p.new.id)_attReqMerge([p.new]);if(['home','attendance','profile'].includes(S.route))rr();}catch(e){}})
      .on('postgres_changes',{event:'*',schema:'public',table:'public_holidays'},p=>{try{if(p.eventType==='DELETE'){DB.holidays=(DB.holidays||[]).filter(h=>h.id!==(p.old&&p.old.id));}else if(p.new&&p.new.id){DB.holidays=(DB.holidays||[]).filter(h=>h.id!==p.new.id).concat([_mHol(p.new)]);}if(['home','attendance','attsettings'].includes(S.route))rr();}catch(e){}})
      .subscribe();
  }catch(e){_attRT=null;}
}
function _attLiveStop(){try{if(_attRT)sb.removeChannel(_attRT);}catch(e){}_attRT=null;_attLoaded={};}

/* ═══════════════ CLOCK IN / OUT ═══════════════ */
let _attBusy=false;
function _attNotify(userId,text,link,kind,evt){
  if(!userId||userId===S.uid)return;
  try{if(evt&&typeof _ns!=='undefined'&&_ns&&_ns['inapp_'+evt]===false)return;}catch(e){}
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
  if(_attOpenToday(S.uid))return toast('You are already clocked in','warn');
  _attBusy=true;_attSetBtn('Finding you…');
  try{
    const wfh=_attIsWfh(S.uid,today);
    const manual=_attManualCapture(u)||!!_attOnDuty(S.uid,today);   // remote / consultant / approved on-duty: no geofence (§9.1, §9.6)
    let pos=null,near=null;
    if(wfh||manual){
      try{pos=await _geoHere({timeout:8000});}catch(e){pos=null;}   // location is optional; recorded when available
      if(pos)near=_geoNearest(pos.lat,pos.lng,pos.acc);
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
    const kind=_attDayKind(u,today);
    const mode=wfh?'wfh':(_attOnDuty(S.uid,today)?'onduty':(manual?'remote':'office'));
    const row={id:uid('att'),user_id:S.uid,date:today,clock_in_at:new Date().toISOString(),in_lat:pos?pos.lat:null,in_lng:pos?pos.lng:null,in_acc:pos?pos.acc:null,in_location_id:near&&near.inside?near.loc.id:null,in_distance_m:near?near.dist:null,mode,source:(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform())?'app':'web',history:[],queued:false};
    _attMerge([row]);rr();
    const ok=await _attPunchWrite({table:'attendance',op:'insert',id:row.id,values:row},'Clock-in');
    if(!ok){const a=DB.attendance.find(x=>x.id===row.id);if(a)a.queued=true;}
    log(fullName(u),'Clocked in',wfh?'Work from home':(near&&near.inside?near.loc.name+' · '+near.dist+' m':(mode==='onduty'?'On duty':mode==='remote'?'Remote':'')));
    toast(wfh?'Clocked in — working from home ✓':(mode==='onduty'?'Clocked in — on duty ✓':mode==='remote'?'Clocked in ✓':'Clocked in at '+near.loc.name+' ✓'));
    try{if(window.BBNotify&&BBNotify.play)BBNotify.play('pop',{force:true});}catch(e){}
    // Rest day / public holiday work → comp-off request to the manager, automatically (spec §9.2, §9.5)
    if(kind.compOff)_attCompOffRequest(u,row.id,today,kind).catch(e=>console.warn('[att] comp off',e.message));
  }catch(e){toast(e.message,'err');rr();}
  finally{_attBusy=false;}
};
/* Punch writes go through the sync queue: if the network is down the punch is kept on the device with its TRUE
   timestamp, marked "queued", and re-sent when the connection is back (spec §15.5). Returns true when it reached the server now. */
async function _attPunchWrite(w,label){
  if(typeof sbWrite!=='function'){const r=w.op==='insert'?await sb.from(w.table).insert(w.values):await sb.from(w.table).update(w.values).eq(w.match.col,w.match.val);if(r.error)throw new Error('Couldn’t save your '+label.toLowerCase()+' — '+r.error.message);return true;}
  const ok=await sbWrite(w,{label,silent:true});
  if(!ok){
    // Mark the queued copy so the manager can see it arrived late (the queue replays the same values later).
    if(w.values){w.values.queued=true;try{_savePendingWrites();}catch(e){}}
    toast(label+' saved on this device — no connection right now, it will sync with the original time','warn');
  }
  return ok;
}
App._attClockOut=async()=>{
  if(_attBusy)return;const u=me();if(!u)return;
  const open=_attOpenToday(S.uid);if(!open)return toast('You are not clocked in','warn');
  _attBusy=true;_attSetBtn('Finding you…');
  try{
    const free=open.mode!=='office';   // wfh / remote / on-duty sessions close from anywhere
    let pos=null,near=null;
    if(free){try{pos=await _geoHere({timeout:8000});}catch(e){pos=null;}if(pos)near=_geoNearest(pos.lat,pos.lng,pos.acc);}
    else{
      pos=await _geoHere();
      const maxAcc=Number(_attSettings().max_accuracy_m||300);
      if(pos.acc>maxAcc)throw new Error('GPS signal is too weak right now (±'+pos.acc+' m). Try again near a window.');
      near=_geoNearest(pos.lat,pos.lng,pos.acc);
      if(_attSettings().geofence_strict!==false&&(!near||!near.inside)){
        const tail=_attSettings().open_shift_mode==='auto_out'?' If you forget, you’ll be clocked out automatically at '+(_attSettings().auto_out_time||'23:59')+'.':' If you forget, your manager will have to close the shift for you.';
        throw new Error(near?('You’re outside the geofence — '+_geoFmtDist(near.dist)+' from '+near.loc.name+'. Clock out before you leave.'+tail):'You’re not near any office.');
      }
    }
    const patch={clock_out_at:new Date().toISOString(),out_lat:pos?pos.lat:null,out_lng:pos?pos.lng:null,out_acc:pos?pos.acc:null,out_location_id:near&&near.inside?near.loc.id:null,out_distance_m:near?near.dist:null,updated_at:new Date().toISOString()};
    Object.assign(open,{outAt:patch.clock_out_at,outLat:patch.out_lat,outLng:patch.out_lng,outAcc:patch.out_acc,outLocId:patch.out_location_id,outDist:patch.out_distance_m});rr();
    const ok=await _attPunchWrite({table:'attendance',op:'update',id:open.id,match:{col:'id',val:open.id},values:patch},'Clock-out');
    if(!ok)open.queued=true;
    log(fullName(u),'Clocked out',_attFmtMins(_attMins(open)));
    toast('Clocked out — '+_attFmtMins(_attMins(open))+' today ✓');
    try{_attCompOffUpdate(open);}catch(e){}   // rest-day work: put the real hours on the comp-off request
  }catch(e){toast(e.message,'err');rr();}
  finally{_attBusy=false;}
};
App._attToggleWfh=async()=>{
  const u=me();if(!u)return;
  if(!_attEnabled())return toast('Attendance isn’t switched on yet','warn');
  if(!u.wfhAllowed)return toast('Work from home isn’t enabled on your profile — ask your manager','err');
  const today=todayISO();
  if(_attIsWfh(S.uid,today)){
    const open=_attOpenToday(S.uid);if(open&&open.mode==='wfh')return toast('Clock out first, then switch WFH off','warn');
    DB.wfh=(DB.wfh||[]).filter(w=>!(w.userId===S.uid&&w.date===today));rr();
    await sb.from('wfh_days').delete().eq('user_id',S.uid).eq('date',today);
    toast('WFH removed for today');
  }else{
    // Monthly quota (spec §9.6 — wfh_instances_per_month, PARAMETER). HR can still add WFH for someone by editing the day.
    const cap=Number(_attSettings().wfh_instances_per_month||0);
    const used=(DB.wfh||[]).filter(w=>w.userId===S.uid&&w.date.slice(0,7)===today.slice(0,7)).length;
    if(cap>0&&used>=cap)return toast('You’ve used all '+cap+' work-from-home days for this month — ask your manager or HR','err');
    (DB.wfh=DB.wfh||[]).push({userId:S.uid,date:today,note:''});rr();
    const{error}=await sb.from('wfh_days').upsert({user_id:S.uid,date:today},{onConflict:'user_id,date'});
    if(error){DB.wfh=DB.wfh.filter(w=>!(w.userId===S.uid&&w.date===today));rr();return toast('Couldn’t save — '+error.message,'err');}
    log(fullName(u),'Marked WFH',today);
    toast('Today is a work-from-home day 🏠');
    if(u.managerId&&(typeof _ns==='undefined'||!_ns||_ns.inapp_attendance_wfh!==false)){
      _attNotify(u.managerId,'🏠 '+fullName(u)+' is working from home today.','att:team:'+today,'attendance');
      try{if(typeof sendEmail==='function')sendEmail('attendance_wfh',u.managerId,{wfh_user:fullName(u),date:fmtD(today)}).catch(()=>{});}catch(e){}
    }
  }
};

/* ═══════════════ MY DAY (home) ═══════════════ */
let _attTick=null;
function _attStartTick(){clearInterval(_attTick);_attTick=setInterval(()=>{const el=$('#att-elapsed');const o=_attOpenToday(S.uid);if(el&&o)el.textContent=_attFmtMins(_attMins(o));if(!el)clearInterval(_attTick);},30000);}
function _attClockCard(){
  const u=me();const today=todayISO();
  if(!_attEnabled()){
    if(!_ATTS)return '';   // settings not loaded yet — don't flash anything
    return can('attendance','manage')?`<div class="ui-card" style="padding:14px 18px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;border-style:dashed"><span style="width:34px;height:34px;border-radius:10px;background:var(--c-surface-2);display:grid;place-items:center;color:var(--c-text-3)">${ic('clock','w-4 h-4')}</span><div style="flex:1;min-width:200px"><div style="font-size:13px;font-weight:800;color:var(--c-text)">Attendance isn’t switched on yet</div><div style="font-size:12px;color:var(--c-text-3)">Set geofences on your locations, then turn it on — only admins see this note.</div></div>${btn('Attendance settings',"App.go('attsettings')",{variant:'ghost',size:'sm',icon:'cog'})}</div>`:'';
  }
  const open=_attOpen(S.uid);const wfh=_attIsWfh(S.uid,today);
  const rows=_attRowsFor(S.uid,today);const total=_attDayMins(S.uid,today);
  const sched=_attSchedule(u,today);const kind=_attDayKind(u,today);const off=kind.type!=='SCHEDULED_WORKING';
  const manual=_attManualCapture(u)||!!_attOnDuty(S.uid,today);
  const fences=_geoFences();
  const canClock=can('attendance','clock');
  const loc=open&&open.inLocId?locById(open.inLocId):null;
  const openOld=open&&_attIsOpenShift(open);   // an earlier shift never closed — the manager resolves it (§9.2)
  if(open&&!openOld)_attStartTick();
  const modeLbl=m=>m==='wfh'?'Working from home':m==='onduty'?'On duty':m==='remote'?'Remote':(loc?esc(loc.name):'On site');
  const state=open&&!openOld
    ?`<div class="att-nowrap" style="display:flex;align-items:center;gap:10px"><span style="width:10px;height:10px;border-radius:50%;background:#428059;box-shadow:0 0 0 4px rgba(66,128,89,.18)"></span><div><div style="font-size:13px;font-weight:800;color:var(--c-success-ink)">Clocked in · ${modeLbl(open.mode)}</div><div style="font-size:12px;color:var(--c-text-3)">since ${_attHM(open.inAt)} · <b id="att-elapsed" style="color:var(--c-text)">${_attFmtMins(_attMins(open))}</b> so far${open.queued?' · <span style="color:var(--c-warn-ink)">waiting to sync</span>':''}</div></div></div>`
    :`<div class="att-nowrap" style="display:flex;align-items:center;gap:10px"><span style="width:10px;height:10px;border-radius:50%;background:${openOld?'#C9584A':'var(--c-border-2)'}"></span><div><div style="font-size:13px;font-weight:800;color:var(--c-text)">${openOld?'Open shift from '+fmtS(open.date):(rows.length?'Clocked out':'Not clocked in yet')}</div><div style="font-size:12px;color:var(--c-text-3)">${openOld?'You didn’t clock out on '+fmtS(open.date)+' — your manager will set the time. You can still clock in today.':(rows.length?('Today: '+_attFmtMins(total)+' · last out '+_attHM(rows[rows.length-1].outAt)):(off?('Today is a '+kind.label.toLowerCase()+(kind.holiday?' — '+esc(kind.holiday.name):'')):('Shift '+sched.in+' – '+sched.out)))}</div></div></div>`;
  const btnHTML=open&&!openOld
    ?`<button id="att-btn" onclick="App._attClockOut()" class="ui-btn ui-btn-primary ui-btn-md" style="min-width:150px;background:var(--c-danger)">${ic('clock','w-[18px] h-[18px]')}Clock out</button>`
    :(canClock?`<button id="att-btn" onclick="App._attClockIn()" class="ui-btn ui-btn-brand ui-btn-md" style="min-width:150px">${ic('clock','w-[18px] h-[18px]')}Clock in</button>`:'');
  const wfhBtn=u.wfhAllowed?`<button onclick="App._attToggleWfh()" class="ui-btn ${wfh?'ui-btn-primary':'ui-btn-ghost'} ui-btn-md" title="${wfh?'Turn off work-from-home for today':'Mark today as work from home — clock in without a geofence'}">🏠 ${wfh?'WFH today ✓':'Work from home'}</button>`:'';
  const reqBtn=canClock?`<button onclick="App._attReqNew()" class="ui-btn ui-btn-ghost ui-btn-md" title="Fix a missed punch, ask for a late arrival / early leave, or log on-duty work">Request…</button>`:'';
  const hint=!open&&!wfh&&!manual&&!fences.length?'<div style="font-size:11.5px;color:var(--c-warn-ink);background:var(--c-warn-soft);border-radius:10px;padding:8px 11px;margin-top:10px">No office has a geofence yet — clock-in will work once an admin sets one up under Locations.</div>':
    (!open&&wfh?'<div style="font-size:11.5px;color:var(--c-text-3);margin-top:10px">Work-from-home day — clock in from anywhere; your manager has been told.</div>':
    (!open&&off&&!rows.length?'<div style="font-size:11.5px;color:var(--c-text-3);margin-top:10px">Working today anyway? Clocking in on a '+kind.label.toLowerCase()+' sends a comp-off request to your manager automatically.</div>':
    (!open&&manual&&!wfh?'<div style="font-size:11.5px;color:var(--c-text-3);margin-top:10px">'+(_attOnDuty(S.uid,today)?'On duty today — clock in from wherever you are.':'No geofence for your role — clock in from wherever you work.')+'</div>':'')));
  const sessions=rows.length>1||(rows.length===1&&rows[0].outAt)?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">${rows.map(a=>`<span style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;background:var(--c-surface-2);color:var(--c-text-2)">${_attHM(a.inAt)} → ${a.outAt?_attHM(a.outAt):'…'}${a.autoOut?' <span title="Auto clocked out">⚠</span>':''}${a.queued?' <span title="Synced late">↻</span>':''}</span>`).join('')}</div>`:'';
  return `<div class="ui-card att-clock" style="padding:16px 18px;background:linear-gradient(135deg,#FFFFFF,#FAF5EC)">
    <div class="att-clock-row" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
      ${state}
      <div class="att-clock-actions" style="display:flex;gap:8px;flex-wrap:wrap">${reqBtn}${wfhBtn}${btnHTML}</div>
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
  let attReqN=0;try{if(_attEnabled()&&(can('attendance','approve')||can('attendance','edit')))attReqN=_attInboxItems().length;}catch(e){}
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
      ${attReqN?tile('Attendance',attReqN,'requests & open shifts','clock',"App.go('attendance');S.filters.attTab='requests';rr()",'#A63528'):''}
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
/* Who may add / edit someone's attendance by hand: a person with Attendance → Edit (HR / admin) — and never their own.
   Employees only clock in and out; their own record is never editable by them. */
function _attCanEditFor(uid2){return !!uid2&&uid2!==S.uid&&can('attendance','edit')&&scopeFilter('attendance')(uid2);}
/* ═══ Date range (shared by My / Team / Export) ═══ */
function _attISO(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function _attRange(){
  const t=todayISO();
  let from=S.filters.attFrom,to=S.filters.attTo;
  if(!from||!to){from=t.slice(0,8)+'01';to=t;}
  if(from>to){const x=from;from=to;to=x;}
  if(to>t)to=t;
  return{from,to};
}
function _attDaysBetween(from,to){const out=[];const d=new Date(from+'T00:00:00');const end=new Date(to+'T00:00:00');let n=0;while(d<=end&&n<400){out.push(_attISO(d));d.setDate(d.getDate()+1);n++;}return out;}
function _attMonthsBetween(from,to){const out=[];let d=new Date(from.slice(0,7)+'-01T00:00:00');const end=new Date(to.slice(0,7)+'-01T00:00:00');while(d<=end&&out.length<14){out.push(_attISO(d).slice(0,7));d.setMonth(d.getMonth()+1);}return out;}
function _attMonthLabel(ym){const [y,m]=ym.split('-').map(Number);return new Date(y,m-1,1).toLocaleDateString('en-GB',{month:'long',year:'numeric'});}
function _attRangeLabel(r){return r.from===r.to?fmtD(r.from):(fmtS(r.from)+' – '+fmtD(r.to));}
App._attPreset=(k)=>{
  const t=new Date();const iso=_attISO;
  let from,to=iso(t);
  if(k==='custom'){S.filters.attPreset='custom';rr();return;}
  if(k==='today'){from=to;}
  else if(k==='yesterday'){const d=new Date(t);d.setDate(d.getDate()-1);from=to=iso(d);}
  else if(k==='week'){const d=new Date(t);d.setDate(d.getDate()-6);from=iso(d);}
  else if(k==='month'){from=to.slice(0,8)+'01';}
  else if(k==='lastmonth'){const f=new Date(t.getFullYear(),t.getMonth()-1,1);const l=new Date(t.getFullYear(),t.getMonth(),0);from=iso(f);to=iso(l);}
  else if(k==='30'){const d=new Date(t);d.setDate(d.getDate()-29);from=iso(d);}
  else if(k==='90'){const d=new Date(t);d.setDate(d.getDate()-89);from=iso(d);}
  S.filters.attFrom=from;S.filters.attTo=to;S.filters.attPreset=k;rr();
};
App._attSetRange=(from,to)=>{if(from)S.filters.attFrom=from;if(to)S.filters.attTo=to;S.filters.attPreset='custom';rr();};
function _attRangeBar(){
  const r=_attRange();const p=S.filters.attPreset||'month';
  const opts=[['today','Today'],['yesterday','Yesterday'],['week','Last 7 days'],['month','This month'],['lastmonth','Last month'],['30','Last 30 days'],['90','Last 90 days'],['custom','Custom range…']];
  return `<div class="att-range" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px">
    <select class="ui-select" style="width:auto;min-width:150px;max-width:100%;padding:7px 30px 7px 12px" onchange="App._attPreset(this.value)">${opts.map(([k,l])=>`<option value="${k}" ${p===k?'selected':''}>${l}</option>`).join('')}</select>
    ${p==='custom'?`<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><input type="date" class="ui-input" style="width:auto;padding:6px 10px" value="${r.from}" max="${todayISO()}" onchange="App._attSetRange(this.value,null)"/><span style="font-size:12px;color:var(--c-text-3)">to</span><input type="date" class="ui-input" style="width:auto;padding:6px 10px" value="${r.to}" max="${todayISO()}" onchange="App._attSetRange(null,this.value)"/></div>`:`<span style="font-size:12.5px;color:var(--c-text-3);flex:1 1 auto;min-width:0">${esc(_attRangeLabel(r))}</span>`}
  </div>`;
}
/* Load a whole range for a set of people (cached per range). */
async function _attLoadRange(from,to,ids){
  if(!S.uid||!ids||!ids.length)return;const key='r:'+from+':'+to+':'+ids.length;if(_attLoaded[key])return;_attLoaded[key]=true;
  try{
    const [a,w]=await Promise.all([
      sb.from('attendance').select('*').in('user_id',ids).gte('date',from).lte('date',to).order('date',{ascending:false}),
      sb.from('wfh_days').select('*').in('user_id',ids).gte('date',from).lte('date',to)]);
    if(!a.error)_attMerge(a.data);
    if(!w.error){DB.wfh=DB.wfh||[];const by=new Map(DB.wfh.map(x=>[x.userId+'|'+x.date,x]));(w.data||[]).forEach(x=>by.set(x.user_id+'|'+x.date,{userId:x.user_id,date:x.date,note:x.note||''}));DB.wfh=[...by.values()];}
    rr();
  }catch(e){delete _attLoaded[key];console.warn('[att] range',e.message);}
}
function _attStats(uid2,from,to){
  const u=uById(uid2);const days=_attDaysBetween(from,to).filter(d=>d<=todayISO());
  let present=0,mins=0,wfh=0,late=0,autoOut=0,absent=0,off=0,openShift=0,halfDay=0,shortage=0,otMins=0,early=0,onDuty=0,restWork=0,holiday=0,scheduled=0;
  days.forEach(d=>{const f=_attDayFlags(u,d);
    if(f.kind==='PUBLIC_HOLIDAY')holiday++;else if(f.kind==='REST_DAY')off++;
    if(f.kind==='SCHEDULED_WORKING'&&_attTracked(u,d)&&u.attendanceRequired!==false&&d<todayISO())scheduled++;
    if(f.rows){present++;mins+=f.mins;if(f.wfh)wfh++;if(f.autoOut)autoOut++;if(f.late)late++;if(f.early)early++;if(f.openShift)openShift++;if(f.halfDay)halfDay++;if(f.shortage)shortage++;otMins+=f.otMins;if(f.restDayWork)restWork++;}
    else if(f.onDuty){present++;onDuty++;}
    if(f.absent)absent++;});
  return{present,mins,wfh,late,early,autoOut,absent,off,holiday,openShift,halfDay,shortage,otMins,onDuty,restWork,scheduled,avg:present?Math.round(mins/present):0};
}
/* Status values exposed to the dashboard (spec §9.3): Not In Yet · Present · Late · Remote · WFH · On duty · On leave ·
   Rest day · Public holiday · Absent · Open shift · Half day · Exempt · — (untracked). */
function _attDayStatus(u,d){
  const rs=_attRowsFor(u.id,d);const kind=_attDayKind(u,d);const t=todayISO();
  const wfh=_attIsWfh(u.id,d)||rs.some(a=>a.mode==='wfh');
  if(rs.some(_attIsOpenShift))return 'Open shift';
  if(rs.length){
    const last=rs[rs.length-1];
    if(last&&!last.outAt)return wfh?'In · WFH':(last.mode==='remote'?'In · Remote':last.mode==='onduty'?'In · On duty':'In');
    const f=_attDayFlags(u,d);
    if(f.absent)return 'Absent';
    if(f.halfDay)return 'Half day';
    if(wfh)return 'WFH';
    if(last.mode==='onduty')return 'On duty';
    if(f.late)return 'Late';
    return last.mode==='remote'?'Remote':'Present';
  }
  if(kind.type==='PUBLIC_HOLIDAY')return 'Holiday';
  if(kind.type==='ON_LEAVE')return 'On leave';
  if(_attOnDuty(u.id,d))return 'On duty';
  if(wfh)return 'WFH';
  if(kind.type==='REST_DAY')return 'Off';
  if(u.attendanceRequired===false)return 'Exempt';
  if(d>t||!_attTracked(u,d))return '—';
  if(d===t)return nowHM()<hm2m(_attSchedule(u,d).in)?'Not yet':'Not in yet';
  return 'Absent';
}
const ATT_SC={In:'background:#E9F1E8;color:#346A47','In · WFH':'background:#E9F1E8;color:#346A47','In · Remote':'background:#E9F1E8;color:#346A47','In · On duty':'background:#E9F1E8;color:#346A47',Present:'background:#E9F1E8;color:#346A47',Remote:'background:#E9F1E8;color:#346A47',Late:'background:#F9F1DF;color:#7C5A26','Half day':'background:#F9F1DF;color:#7C5A26',WFH:'background:#F6EAE3;color:#8A6152','On duty':'background:#EEE5D6;color:#4A3B34','On leave':'background:#EEE5D6;color:#4A3B34',Off:'background:#F7F3EE;color:#A59788',Holiday:'background:#F5EFDF;color:#463830',Exempt:'background:#F7F3EE;color:#A59788',Absent:'background:#F9EBE5;color:#A63528','Open shift':'background:#F9EBE5;color:#A63528','Not yet':'background:#F7F3EE;color:#A59788','Not in yet':'background:#FBF7EB;color:#7C5A26','—':'background:#F7F3EE;color:#A59788'};
const ATT_DOT={In:'#428059','In · WFH':'#428059','In · Remote':'#428059','In · On duty':'#428059',Present:'#428059',Remote:'#428059',Late:'#C9A76B','Half day':'#C9A76B',WFH:'#B7826F','On duty':'#96695B','On leave':'#96695B',Off:'#D8CCC0',Holiday:'#C9AB7C',Exempt:'#D8CCC0',Absent:'#C9584A','Open shift':'#C9584A','Not yet':'transparent','Not in yet':'#C9A76B','—':'transparent'};

function attendancePage(forceTab){
  const u=me();if(!u)return '';
  _attLoadMine();_attLiveStart();if(!_ATTS)_attLoadSettings().then(()=>rr());
  const others=_attScopeUsers().filter(x=>x.id!==S.uid).length>0;
  const canMng=can('attendance','manage');
  if(forceTab==='settings')return `<div class="fade">${hdr('Attendance settings','Rules for clock-in, reminders and auto clock-out — applies to everyone')}${canMng?_attSettingsTab():empty('lock','Restricted','You need Attendance → Manage.')}</div>`;
  const canApprove=others&&(can('attendance','approve')||can('attendance','edit'));
  const pendingN=canApprove?_attInboxItems().length:0;
  const TABS=[['my','My attendance']].concat(others?[['team','Team']]:[]).concat(canApprove?[['requests','Requests'+(pendingN?' <span style="font-size:9px;font-weight:800;padding:1px 6px;border-radius:99px;background:var(--c-danger-soft);color:var(--c-danger-ink)">'+pendingN+'</span>':'')]]:[]).concat((others&&(can('attendance','export')||can('attendance','manage')||canApprove))?[['reports','Reports']]:[]);   // rules live in Administration → Attendance only
  let tab=S.filters.attTab||'my';if(!TABS.some(t=>t[0]===tab))tab='my';
  const tabs=TABS.length>1?`<div class="ui-tabs" style="margin-bottom:14px">${TABS.map(([k,l])=>`<button class="ui-tab${tab===k?' on':''}" onclick="S.filters.attTab='${k}';rr()">${l}</button>`).join('')}</div>`:'';
  let body='';
  if(!_attEnabled()){body=(_ATTS?empty('clock','Attendance isn’t switched on yet',canMng?'Turn it on under Administration → Attendance when the geofences are ready.':'Your admin will switch it on soon.'):loadingState());}
  else if(tab==='my')body=_attMyTab(S.uid)+_attMyRequestsCard(S.uid);
  else if(tab==='requests')body=_attInboxTab();
  else if(tab==='reports')body=_attReportsTab();
  else body=_attTeamTab();
  const r=_attRange();
  return `<div class="fade">${hdr('Attendance','Clock-ins, hours and work-from-home days',(canMng?btn('Rules',"App.go('attsettings')",{variant:'subtle',size:'sm',icon:'cog'}):'')+(can('attendance','export')&&_attEnabled()?btn('Export CSV',`App._attExport('${tab}')`,{variant:'ghost',size:'sm',icon:'download',attrs:'title="Exports '+esc(_attRangeLabel(r))+'"'}):''))}${tabs}${body}</div>`;
}
/* ── Calendar for one person over the range ── */
function _attMyTab(uid2,opts){
  opts=opts||{};const u=uById(uid2);if(!u)return '';
  const r=_attRange();const mine=uid2===S.uid;
  if(!mine||r.from<new Date(Date.now()-62*864e5).toISOString().slice(0,10))_attLoadRange(r.from,r.to,[uid2]);
  const st=_attStats(uid2,r.from,r.to);
  const tiles=[['Days present',st.present,'#54433C'],['Hours',_attFmtMins(st.mins),'#13171B'],['Absent',st.absent,'#A63528'],['Late',st.late,'#A97C33'],['Open shifts',st.openShift,'#C9584A'],['Overtime',_attFmtMins(st.otMins),'#463830'],['Avg / day',_attFmtMins(st.avg),'#936659'],['WFH days',st.wfh,'#B7826F'],['Early out',st.early,'#A97C33'],['Half days',st.halfDay,'#A97C33']].concat(st.autoOut?[['Auto out',st.autoOut,'#C9584A']]:[]).concat(st.restWork?[['Rest-day work',st.restWork,'#463830']]:[]).map(([l,v,c],i)=>`<div class="att-tile${i>=6?' att-tile-more':''}" style="background:var(--c-surface);border:1px solid var(--c-border);border-radius:14px;padding:10px 12px;min-width:0"><div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--c-text-3)">${l}</div><div class="fd" style="font-size:20px;font-weight:800;color:${c};margin-top:3px">${v}</div></div>`).join('');
  const switcher='';
  const back=opts.back?`<button onclick="S.filters.attPerson=null;rr()" class="ui-btn ui-btn-subtle ui-btn-sm" title="Back to the team list">${ic('back','w-3.5 h-3.5')}Team</button>`:'';
  const head=`<div class="att-person-head" style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px">${mine?'':`<div style="display:flex;align-items:center;gap:8px;min-width:0">${back}${avatar(u,'w-8 h-8','text-[11px]')}<b style="font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(fullName(u))}</b>${can('employees','viewProfile')?`<button onclick="App.openProfile('${u.id}')" style="font-size:12px;font-weight:700;color:var(--c-brand);background:none;border:none;cursor:pointer">Profile →</button>`:''}</div>`}${switcher}</div>`;
  const legend=`<div style="display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:var(--c-text-3);margin:8px 2px 0">${[['Present','#428059'],['Late / half day','#C9A76B'],['WFH','#B7826F'],['On duty','#96695B'],['Absent / open shift','#C9584A'],['Holiday','#C9AB7C'],['Rest day','#D8CCC0']].map(([l,c])=>`<span style="display:inline-flex;align-items:center;gap:5px"><span style="width:8px;height:8px;border-radius:50%;background:${c}"></span>${l}</span>`).join('')}<span>· tap a day for details</span></div>`;
  const more=`<button class="att-tiles-more" onclick="this.closest('.att-kpis').classList.toggle('open');this.textContent=this.closest('.att-kpis').classList.contains('open')?'Fewer':'More…'">More…</button>`;
  return (mine?_attRangeBar():head+_attRangeBar())+`<div class="bb-kpis att-kpis" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:12px">${tiles}${more}</div>`+_attCalendar(u,r)+legend;
}
function _attCalendar(u,r){
  const canEdit=_attCanEditFor(u.id);
  const months=_attMonthsBetween(r.from,r.to);
  const today=todayISO();
  return months.map(ym=>{
    const [y,m]=ym.split('-').map(Number);const first=new Date(y,m-1,1);const nDays=new Date(y,m,0).getDate();
    let lead=(first.getDay()+6)%7;   // Monday-first
    const cells=[];for(let i=0;i<lead;i++)cells.push('<div></div>');
    for(let d=1;d<=nDays;d++){
      const iso=ym+'-'+String(d).padStart(2,'0');const inRange=iso>=r.from&&iso<=r.to;
      const rs=_attRowsFor(u.id,iso);const mins=rs.reduce((n,a)=>n+_attMins(a),0);
      const status=inRange?_attDayStatus(u,iso):'—';const dot=ATT_DOT[status]||'transparent';
      const f=inRange?_attDayFlags(u,iso):{};const wfh=!!f.wfh;
      const isT=iso===today;const future=iso>today;
      const bg=status==='Present'||status==='Remote'||status.indexOf('In')===0?'#F1F6F0':status==='Late'||status==='Half day'?'#FBF7EB':status==='WFH'?'#FBF3EF':status==='Absent'||status==='Open shift'?'#FBEFEB':status==='Holiday'?'#FAF5E9':'var(--c-surface)';
      const mid=rs.length?_attFmtMins(mins)+(f.openShift?' <span style="color:#A63528">open</span>':''):(status==='Absent'?'<span style="color:#A63528;font-weight:700">Absent</span>':status==='WFH'?'<span style="color:#8A6152">WFH</span>':status==='Off'?'<span style="color:var(--c-text-3);font-weight:600">Off</span>':status==='Holiday'?'<span style="color:#7F6533;font-weight:600">Holiday</span>':status==='On duty'?'<span style="color:#4A3B34;font-weight:600">On duty</span>':status==='On leave'?'<span style="color:#4A3B34;font-weight:600">Leave</span>':'');
      cells.push(`<button ${inRange&&!future?`onclick="App._attDay('${u.id}','${iso}')"`:'disabled'} class="att-cell" style="border:1px solid ${isT?'var(--c-brand)':'var(--c-border)'};background:${bg};opacity:${inRange&&!future?1:.4}">
        <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12px;font-weight:${isT?'800':'700'};color:${isT?'var(--c-brand)':'var(--c-text)'}">${d}</span><span style="width:7px;height:7px;border-radius:50%;background:${dot}"></span></div>
        <div style="font-size:11px;font-weight:700;color:var(--c-text);margin-top:4px;min-height:14px">${mid}</div>
        <div style="font-size:9.5px;color:var(--c-text-3);display:flex;gap:4px;flex-wrap:wrap;min-height:12px"><span class="att-cell-times">${rs.length?_attHM(rs[0].inAt)+'–'+(rs[rs.length-1].outAt?_attHM(rs[rs.length-1].outAt):'…'):''}</span>${wfh&&rs.length?'<span>🏠</span>':''}${f.late?'<span style="color:#A97C33;font-weight:800" title="Late">L</span>':''}${f.early?'<span style="color:#A97C33;font-weight:800" title="Left early">E</span>':''}${f.halfDay?'<span style="color:#A97C33;font-weight:800" title="Half day">½</span>':''}${f.otMins>0?'<span style="color:#463830;font-weight:800" title="Overtime '+_attFmtMins(f.otMins)+'">OT</span>':''}${f.autoOut?'<span style="color:#C9584A;font-weight:800" title="Auto clock-out">A</span>':''}${f.queued?'<span title="Synced late">↻</span>':''}${f.edited?'<span title="Corrected">✎</span>':''}</div>
      </button>`);
    }
    return `<div class="ui-card" style="margin-bottom:12px"><div class="ui-card-head" style="padding:11px 16px"><span class="ui-card-title" style="font-size:14px">${_attMonthLabel(ym)}</span>${canEdit?`<span style="font-size:11px;color:var(--c-text-3)">tap a day to edit</span>`:''}</div>
      <div class="ui-card-pad" style="padding:10px 12px 12px"><div class="att-cal" style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px">${WKDAYS.map(d=>`<div style="font-size:10px;font-weight:800;color:var(--c-text-3);text-align:center;padding:2px 0 4px;text-transform:uppercase">${d}</div>`).join('')}${cells.join('')}</div></div></div>`;
  }).join('');
}
/* ── Day detail (tap a calendar cell) ── */
App._attDay=(uid2,d)=>{
  const u=uById(uid2);if(!u)return;
  const rs=_attRowsFor(uid2,d);const status=_attDayStatus(u,d);const total=rs.reduce((n,a)=>n+_attMins(a),0);
  const canEdit=_attCanEditFor(uid2);const canResolve=_attCanResolveFor(uid2);
  const f=_attDayFlags(u,d);const kind=_attDayKind(u,d);const sched=_attSchedule(u,d);
  const chipS=(t,bg,fg)=>`<span style="font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:20px;background:${bg};color:${fg}">${t}</span>`;
  const sess=rs.map(a=>{const li=a.inLocId?locById(a.inLocId):null;const lo=a.outLocId?locById(a.outLocId):null;const ed=a.editedBy?uById(a.editedBy):null;const openS=_attIsOpenShift(a);
    const hist=(a.history||[]).map(h=>{const by=h.by?uById(h.by):null;const b=h.before||{};return `<div style="font-size:11px;color:var(--c-text-3);padding:4px 0 0;border-top:1px dashed var(--c-border);margin-top:6px">Original: ${_attHM(b.in)} → ${b.out?_attHM(b.out):'…'}${b.mode&&b.mode!==a.mode?' · '+esc(b.mode):''} · changed ${h.at?new Date(h.at).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):''} by ${esc(by?fullName(by):'—')}${h.reason?' — '+esc(h.reason):''}</div>`;}).join('');
    return `<div style="border:1px solid ${openS?'#E7B8AE':'var(--c-border)'};border-radius:12px;padding:10px 12px;margin-bottom:8px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap"><div style="font-size:14px;font-weight:800;color:var(--c-text)">${_attHM(a.inAt)} → ${a.outAt?_attHM(a.outAt):(openS?'<span style="color:#A63528">not closed</span>':'<span style="color:#346A47">still in</span>')} <span style="font-size:12px;color:var(--c-text-3);font-weight:600">· ${openS?'unresolved':_attFmtMins(_attMins(a))}</span></div><div style="display:flex;gap:4px;flex-wrap:wrap">${a.mode==='wfh'?chipS('🏠 WFH','#F6EAE3','#8A6152'):a.mode==='onduty'?chipS('On duty','#EEE5D6','#4A3B34'):a.mode==='remote'?chipS('Remote','#E9F1E8','#346A47'):''}${rs[0]===a&&f.late?chipS('Late','#F9F1DF','#7C5A26'):''}${rs[rs.length-1]===a&&f.early?chipS('Left early','#F9F1DF','#7C5A26'):''}${a.autoOut?chipS('Auto clock-out','#F9E9E3','#7E2A1C'):''}${openS?chipS('Open shift','#F9E9E3','#7E2A1C'):''}${a.queued?chipS('Synced late','#F5EFDF','#463830'):''}${a.source==='regularised'?chipS('Regularised','#EEE5D6','#4A3B34'):''}</div></div>
      <div style="font-size:11.5px;color:var(--c-text-3);margin-top:5px;line-height:1.5">${li?'In at '+esc(li.name)+(a.inDist!=null?' ('+a.inDist+' m away)':''):(a.inLat!=null?'In at '+a.inLat.toFixed(4)+', '+a.inLng.toFixed(4):'')}${a.outAt?(lo?' · out at '+esc(lo.name)+(a.outDist!=null?' ('+a.outDist+' m)':''):''):''}${a.source==='manual'?' · added manually':''}${ed?' · edited by '+esc(fullName(ed))+(a.editReason?': '+esc(a.editReason):''):''}${a.note?'<br>'+esc(a.note):''}</div>
      ${hist}
      ${(canEdit||(openS&&canResolve))?`<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">${openS&&canResolve?btn('Close this shift',`App._attResolve('${a.id}')`,{variant:'primary',size:'sm',icon:'clock'}):''}${canEdit?btn('Edit',`App._attEdit('${a.id}','${uid2}','${d}')`,{variant:'ghost',size:'sm',icon:'edit'}):''}</div>`:''}
    </div>`;}).join('');
  const reqs=(DB.attRequests||[]).filter(r=>r.userId===uid2&&(r.date===d||(r.type==='on_duty'&&r.date<=d&&(r.dateTo||r.date)>=d))).map(r=>`<div style="font-size:12px;color:var(--c-text-2);padding:6px 0;border-top:1px solid var(--c-border)"><b>${esc(_attReqLabel(r))}</b> · ${chip(r.status)}${r.reason?'<div style="font-size:11.5px;color:var(--c-text-3)">'+esc(r.reason)+'</div>':''}</div>`).join('');
  const summary=`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">${chipS(kind.label+(kind.holiday?' · '+esc(kind.holiday.name):''),'var(--c-surface-2)','var(--c-text-2)')}${kind.type==='SCHEDULED_WORKING'?chipS('Shift '+sched.in+'–'+sched.out+' · '+_attFmtMins(_attStdMins(u,d)),'var(--c-surface-2)','var(--c-text-2)'):''}${f.halfDay?chipS('Half day','#F9F1DF','#7C5A26'):''}${f.shortage&&!f.halfDay?chipS('Short by '+_attFmtMins(f.stdMins-f.mins),'#F9F1DF','#7C5A26'):''}${f.otMins>0?chipS('OT '+_attFmtMins(f.otMins),'#EEE5D6','#4A3B34'):''}${f.restDayWork?chipS('Comp-off requested','#EEE5D6','#4A3B34'):''}</div>`;
  const mine=uid2===S.uid&&can('attendance','clock');
  const fixBtn=mine&&d<=todayISO()&&_attRegularisable(d)?btn('Fix a missed / wrong punch',`App._attReqNew('regularisation','${d}')`,{variant:'ghost',size:'md',icon:'edit'}):'';
  modalShell({title:fmtD(d)+' · '+dayAbbr(d),sub:fullName(u)+' · '+status+(total?' · '+_attFmtMins(total):''),size:'max-w-md',key:'att-day',
    body:`<div>${summary}${sess||`<div style="padding:16px;text-align:center;font-size:12.5px;color:var(--c-text-3)">${status==='Off'?'Rest day — no sessions.':status==='Holiday'?'Public holiday — no sessions.':status==='WFH'?'Marked as work from home, no clock-in yet.':status==='On duty'?'Approved on-duty day — counted as worked.':status==='Absent'?'No clock-in recorded.':'No sessions.'}</div>`}${reqs?'<div style="margin-top:6px"><div style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--c-text-3)">Requests</div>'+reqs+'</div>':''}</div>`,
    footer:fixBtn+(canEdit?btn('Add session',`App._attEdit('','${uid2}','${d}')`,{variant:'ghost',size:'md',icon:'plus'}):'')+btnP('Close','App.closeModal()')});
};
/* ── Team ── */
function _attTeamTab(){
  const r=_attRange();
  const people=_attScopeUsers();
  _attLoadRange(r.from,r.to,people.map(p=>p.id));
  const q=(S.filters.attQ||'').toLowerCase();
  const list=people.filter(p=>!q||fullName(p).toLowerCase().includes(q)||String(p.department||'').toLowerCase().includes(q));
  if(S.filters.attPerson){const p=uById(S.filters.attPerson);if(p)return _attMyTab(p.id,{back:true});}
  const day=r.to>todayISO()?todayISO():r.to; // status column follows the range dropdown (its last day)
  const isToday=day===todayISO();
  let inN=0,wfhN=0,outN=0,absN=0,openN=0,lateN=0;
  const rows=list.map(p=>{
    const rs=_attRowsFor(p.id,day);const openT=rs.find(a=>!a.outAt&&a.date===day);const f=_attDayFlags(p,day);
    const m=f.mins;const first=rs[0],last=rs[rs.length-1];
    const status=_attDayStatus(p,day);const sc=ATT_SC[status]||ATT_SC['—'];
    if(status==='Open shift')openN++;else if(openT)inN++;else if(rs.length)outN++;else if(status==='WFH')wfhN++;
    if(status==='Absent')absN++;if(f.late)lateN++;
    const oldOpen=_attOpen(p.id);const oldOpenS=oldOpen&&_attIsOpenShift(oldOpen)&&oldOpen.date!==day?oldOpen:null;
    const loc=first&&first.inLocId?locById(first.inLocId):null;
    const st=_attStats(p.id,r.from,r.to);
    return `<div class="att-trow" onclick="S.filters.attPerson='${p.id}';rr()" style="display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--c-border);cursor:pointer">
      <div class="att-nowrap" style="display:flex;align-items:center;gap:10px;min-width:0">${avatar(p,'w-9 h-9','text-[11px]')}<div style="min-width:0"><div style="font-size:13px;font-weight:700;color:var(--c-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(fullName(p))}</div><div style="font-size:11px;color:var(--c-text-3);display:flex;gap:6px;flex-wrap:wrap;align-items:center"><span style="font-size:10.5px;font-weight:700;padding:1px 8px;border-radius:20px;${sc}">${status}</span>${rs.length?`<span>${_attHM(first.inAt)} → ${last.outAt?_attHM(last.outAt):'…'}</span>`:''}${loc?`<span>· ${esc(loc.name)}</span>`:''}${f.late?'<span style="font-weight:800;color:#A97C33">LATE</span>':''}${f.early?'<span style="font-weight:800;color:#A97C33">EARLY</span>':''}${f.halfDay?'<span style="font-weight:800;color:#A97C33">½ DAY</span>':''}${f.otMins>0?'<span style="font-weight:800;color:#463830">OT '+_attFmtMins(f.otMins)+'</span>':''}${f.autoOut?'<span style="font-weight:800;color:#C9584A">AUTO OUT</span>':''}${f.queued?'<span title="Synced late">↻</span>':''}${oldOpenS?'<span style="font-weight:800;color:#C9584A" title="Open shift from '+oldOpenS.date+'">OPEN '+fmtS(oldOpenS.date).toUpperCase()+'</span>':''}</div></div></div>
      <div style="text-align:right"><div class="fd" style="font-size:14px;font-weight:800">${rs.length?_attFmtMins(m):'—'}</div><div style="font-size:10.5px;color:var(--c-text-3)">${st.present}d · ${_attFmtMins(st.mins)}${st.absent?' · <span style="color:#A63528">'+st.absent+' absent</span>':''}${st.openShift?' · <span style="color:#A63528">'+st.openShift+' open</span>':''}</div></div>
    </div>`;}).join('');
  return _attRangeBar()+`<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px">
      <span style="font-size:12px;color:var(--c-text-3)">Status as of <b style="color:var(--c-text)">${isToday?'today':esc(fmtD(day))}</b> · ${list.length} people</span><span style="font-size:12px;color:var(--c-text-3)">totals: ${esc(_attRangeLabel(r))}</span></div>
    <div class="bb-kpis att-team-kpis" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:12px">${[['Clocked in',inN,'#346A47'],['Absent',absN,'#A63528'],['Late',lateN,'#A97C33'],['Open shifts',openN,'#A63528'],['WFH',wfhN,'#8A6152'],['Finished',outN,'#463830']].map(([l,v,c])=>`<div style="background:var(--c-surface);border:1px solid var(--c-border);border-radius:14px;padding:10px 12px"><div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--c-text-3)">${l}</div><div class="fd" style="font-size:20px;font-weight:800;color:${c};margin-top:3px">${v}</div></div>`).join('')}</div>
    <div class="ui-card"><div style="padding:10px 12px;border-bottom:1px solid var(--c-border);display:flex;gap:8px;align-items:center"><input id="att-q" class="ui-input" placeholder="Search people…" value="${esc(S.filters.attQ||'')}" oninput="S.filters.attQ=this.value;App._searchRR('att-q')"/>${q?`<button onclick="S.filters.attQ='';rr()" class="ui-btn ui-btn-subtle ui-btn-sm">Clear</button>`:''}</div><div class="ui-card-pad" style="padding-top:2px">${rows||empty('users','Nobody in your scope','')}</div></div>`;
}
function _attSettingsTab(){
  const s=_attSettings();
  const row=(id,label,desc,ctl)=>`<div class="att-set-row" style="display:flex;align-items:center;justify-content:space-between;gap:14px;padding:11px 0;border-top:1px solid var(--c-border)"><div class="att-set-text" style="min-width:0;flex:1"><div style="font-size:13.5px;font-weight:700;color:var(--c-text)">${label}</div><div style="font-size:11.5px;color:var(--c-text-3);line-height:1.45">${desc}</div></div><div class="att-set-ctl" style="flex-shrink:0">${ctl}</div></div>`;
  const tog=(k)=>`<button role="switch" aria-checked="${s[k]!==false}" class="tog ${s[k]!==false?'on':'off'}" onclick="App._attSet('${k}',!(this.classList.contains('on')));this.classList.toggle('on');this.classList.toggle('off')"><span></span></button>`;
  const num=(k,unit,min,max,step)=>`<div class="att-num" style="display:flex;align-items:center;gap:6px"><input type="number" inputmode="decimal" min="${min}" max="${max}" step="${step||1}" value="${s[k]}" class="ui-input" style="width:84px;padding:7px 10px" onchange="App._attSet('${k}',Number(this.value))"/><span style="font-size:11.5px;color:var(--c-text-3);white-space:nowrap">${unit}</span></div>`;
  const card=(title,rows,note)=>`<div class="ui-card" style="margin-bottom:12px"><div class="ui-card-head"><span class="ui-card-title">${title}</span><span style="font-size:11px;color:var(--c-text-3)">${note||'saved instantly · applies to everyone'}</span></div><div class="ui-card-pad" style="padding-top:2px">${rows}</div></div>`;
  const master=`<div class="ui-card" style="margin-bottom:12px;border:1.5px solid ${s.enabled?'#428059':'var(--c-border-2)'}"><div class="ui-card-pad" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap"><div style="flex:1;min-width:220px"><div style="font-size:14px;font-weight:800;color:var(--c-text)">Attendance system ${s.enabled?'<span style="font-size:10.5px;padding:2px 8px;border-radius:20px;background:#E9F1E8;color:#346A47;vertical-align:middle">LIVE</span>':'<span style="font-size:10.5px;padding:2px 8px;border-radius:20px;background:var(--c-surface-2);color:var(--c-text-3);vertical-align:middle">OFF</span>'}</div><div style="font-size:12px;color:var(--c-text-3);line-height:1.45">Off: nobody sees the clock card or WFH button, and the server sends no reminders. Turn it on once every office has its geofence and people have been told.</div></div>${tog('enabled')}</div></div>`;
  const openMode=`<select class="ui-select" style="width:auto;padding:7px 30px 7px 12px" onchange="App._attSet('open_shift_mode',this.value)"><option value="flag" ${s.open_shift_mode!=='auto_out'?'selected':''}>Flag to manager (never auto-close)</option><option value="auto_out" ${s.open_shift_mode==='auto_out'?'selected':''}>Auto clock-out at a set time</option></select>`;
  return master
  +card('Open shifts & reminders',
     row('osm','Forgotten clock-outs','<b>Flag to manager</b>: the shift stays open, the person and their manager are told the next morning, and the manager sets the real time with a reason — hours don’t count until then (HR spec: a shift may only be closed on an event someone actually observed). <b>Auto clock-out</b>: legacy behaviour, closes every open shift at the time below.',openMode)
    +(s.open_shift_mode==='auto_out'?row('auto','Auto clock-out time','Anyone still clocked in is clocked out automatically at this time (local time) and told about it.',`<input type="time" value="${esc(s.auto_out_time||'23:59')}" class="ui-input" style="width:auto;padding:7px 10px" onchange="App._attSet('auto_out_time',this.value)"/>`):'')
    +row('rin','Clock-in reminder to the person','Remind people who haven’t clocked in, this many minutes after their shift start. Channels are set under Settings → In-App / Email → Attendance.',`<div class="att-nowrap att-num-tog" style="display:flex;align-items:center;gap:8px">${num('reminder_in_after_min','min',0,240)}${tog('reminder_in_on')}</div>`)
    +row('rinrm','Tell the manager about a missed clock-in','Same-day push to the manager when a scheduled person still hasn’t clocked in, this many minutes after shift start. Only while the clock-in reminder above is on.',num('missed_in_rm_after_min','min',0,600))
    +row('rout','Clock-out reminder','Remind people still clocked in, this many minutes after their shift end…',`<div class="att-nowrap att-num-tog" style="display:flex;align-items:center;gap:8px">${num('reminder_out_after_min','min',0,240)}${tog('reminder_out_on')}</div>`)
    +row('routh','…and after this many hours on the clock','A second nudge for long days, whatever the shift end (spec: clockout_reminder_threshold).',num('clockout_reminder_hours','h',1,24))
    +row('buf','Escalate incomplete days after','An open or incomplete day older than this is escalated to the manager again instead of waiting (spec: log_buffer_days).',num('log_buffer_days','days',1,30)))
  +card('Geofence',
     row('strict','Geofence for clock-out too','On: office staff must be inside the geofence to clock out as well as in. Off: clock-out works from anywhere (the location is still recorded). Remote / consultant categories and on-duty days never need a geofence.',tog('geofence_strict'))
    +row('tol','GPS tolerance','Extra metres added to every geofence radius, because phones are rarely exact.',num('gps_tolerance_m','m',0,200))
    +row('acc','Reject weak GPS above','If the phone reports a worse accuracy than this, ask the person to try again instead of guessing.',num('max_accuracy_m','m',50,2000))
    +row('dwell','Ignore short exits under','Reserved for the mobile app’s automatic clock-out on leaving the geofence: an exit shorter than this (delivery run, bank, lunch) never closes the shift (spec: min_exit_dwell).',num('min_exit_dwell_min','min',0,240)))
  +card('Late, short days & overtime',
     row('late','Late grace period','Minutes after the shift start before an arrival counts as late.',num('late_grace_min','min',0,120))
    +row('gracen','Grace allowed per month','After this many grace arrivals in a month, every arrival inside the grace window counts as late too.',num('grace_instances_per_month','× / month',0,31))
    +row('partial','Partial-day requests per month','How many approved late-arrival / early-leave requests a person may use per month.',num('partial_day_instances_per_month','× / month',0,31))
    +row('half','Half day below','A working day with fewer hours than this is flagged as a half day.',num('half_day_below_h','h',0,12,0.5))
    +row('abs','Absent below','A working day with fewer hours than this is flagged absent even though there was a punch.',num('absent_below_h','h',0,12,0.5))
    +row('short','Hours-shortage tolerance','A day is flagged “short” when worked hours fall below the shift length by more than this.',num('shortage_tolerance_min','min',0,240))
    +row('otd','Overtime cap per day','Raw overtime hours beyond the shift are captured (not paid here); above this cap the day is flagged for payroll.',num('ot_max_day_h','h',0,16,0.5))
    +row('otw','Overtime cap per week','Weekly cap for the same flag.',num('ot_max_week_h','h',0,80,0.5)))
  +card('Requests & work from home',
     row('regc','Regularisations per month','How many missed / wrong punches a person may ask to fix per month (spec: regularisation_monthly_cap).',num('regularisation_monthly_cap','× / month',0,31))
    +row('regw','Regularisation window','A punch can only be corrected within this many days of the date (spec: regularisation_window_days).',num('regularisation_window_days','days',0,31))
    +row('wfhq','Work-from-home days per month','Self-serve WFH (for people allowed to) is limited to this many days a month; HR can still add more by editing the day.',num('wfh_instances_per_month','× / month',0,31)))
  +card('Comp off (rest-day work)',
     row('cor','Comp-off rate','Comp-off earned per rest-day / holiday day worked (UAE policy 1 : 1; KSA statutory minimum 1.5).',num('comp_off_rate','× day',0,3,0.25))
    +row('coe','Comp-off expires after','Days an approved comp-off stays usable (KSA statute: 60).',num('comp_off_expiry_days','days',0,730))
    +row('coc','Comp-off annual cap','Maximum comp-off days a person can accumulate in a year (KSA statute: 30).',num('comp_off_annual_cap','days',0,365)),'balances are handled by the leave module')
  +card('Tracking',
     row('from','Tracking started on','Days before this date are not counted as absent (the feature launch date, or when you started using it).',`<input type="date" value="${esc(s.tracking_from||'')}" class="ui-input" style="width:auto;padding:7px 10px" onchange="App._attSet('tracking_from',this.value)"/>`)
    +row('tz','Time zone','Used by the server for reminders and end-of-day; each location can carry its own time zone on its geofence.',`<input value="${esc(s.tz||'Asia/Dubai')}" class="ui-input" style="width:150px;padding:7px 10px" onchange="App._attSet('tz',this.value)"/>`))
  +_attHolidaysCard()
  +`<p style="font-size:12px;color:var(--c-text-3);margin-top:12px;line-height:1.5">Per-person settings — <b>worker category</b> (office / warehouse / remote / consultant), <b>shift times, rest days and their effective date</b>, <b>who must clock in</b> and <b>who may work from home</b> — live on each profile (Users → open profile → Work). Managers with Attendance → “Set schedule” can change their own team’s.</p>`;
}
App._attSet=(k,v)=>{if(!can('attendance','manage'))return toast('You need Attendance → Manage','err');_attSaveSettings({[k]:v}).then(()=>{toast(k==='enabled'?(v?'Attendance is LIVE — clock cards, reminders and auto clock-out are on':'Attendance switched off'):'Saved');if(k==='enabled'){log(fullName(me()),v?'Attendance switched ON':'Attendance switched OFF','');rr();}});};

/* ── Manual edit / add (managers) ── */
App._attEdit=(id,uid2,date)=>{
  if(uid2===S.uid)return toast('You can’t change your own attendance — clock in and out from My Day, or ask HR','err');
  if(!_attCanEditFor(uid2))return toast('Only HR (Attendance → Edit) can add or change someone’s attendance','err');
  const a=id?(DB.attendance||[]).find(x=>x.id===id):null;
  const u=uById(uid2);
  const t=iso=>iso?new Date(iso).toTimeString().slice(0,5):'';
  modalShell({title:(a?'Edit':'Add')+' attendance — '+fullName(u),sub:fmtD(date)+' · a reason is required and the person is told',size:'max-w-md',key:'att-edit',
    body:`<div style="display:grid;gap:12px">
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">${fld('Clock in','ae-in',t(a&&a.inAt),'time')}${fld('Clock out','ae-out',t(a&&a.outAt),'time')}</div>
      ${selF('Mode','ae-mode',[['office','Office'],['wfh','Work from home'],['remote','Remote'],['onduty','On duty']],a?a.mode:'office')}
      ${fld('Note (visible to the person)','ae-note',a?a.note:'')}
      ${fld('Reason for this change *','ae-reason',a?a.editReason||'':'')}
    </div>`,
    footer:(a&&can('attendance','delete')?btn('Delete',`App._attDel('${a.id}')`,{variant:'danger',size:'md',icon:'trash'}):'')+btnG('Cancel','App.closeModal()')+btnP('Save','App._attEditSave(\''+(a?a.id:'')+'\',\''+uid2+'\',\''+date+'\')')});
};
App._attEditSave=async(id,uid2,date)=>{
  if(!_attCanEditFor(uid2))return toast('Only HR can add or change someone’s attendance','err');
  const tin=$('#ae-in')?.value,tout=$('#ae-out')?.value,mode=$('#ae-mode')?.value||'office',note=($('#ae-note')?.value||'').trim(),reason=($('#ae-reason')?.value||'').trim();
  if(!tin)return toast('Clock-in time is required','err');
  if(!reason)return toast('Give a reason — it is shown to the person and kept in the audit log','err');
  const mk=t=>t?new Date(date+'T'+t+':00').toISOString():null;
  // Night shifts: a clock-out earlier than the clock-in belongs to the next calendar day.
  const mkOut=t=>{if(!t)return null;const d=new Date(date+'T'+t+':00');if(d<=new Date(date+'T'+tin+':00'))d.setDate(d.getDate()+1);return d.toISOString();};
  const now=new Date().toISOString();
  const patch={clock_in_at:mk(tin),clock_out_at:mkOut(tout),mode,note,edited_by:S.uid,edited_at:now,edit_reason:reason,updated_at:now,auto_out:false};
  let err;
  if(id){
    // The original punch is never overwritten silently — it is kept in history (spec §9.6 / §15.1).
    const a=DB.attendance.find(x=>x.id===id);
    const hist=(a&&a.history||[]).concat([{at:now,by:S.uid,reason,before:a?{in:a.inAt,out:a.outAt,mode:a.mode}:null}]);
    patch.history=hist;
    ({error:err}=await sb.from('attendance').update(patch).eq('id',id));
    if(!err&&a)Object.assign(a,{inAt:patch.clock_in_at,outAt:patch.clock_out_at,mode,note,editedBy:S.uid,editedAt:now,editReason:reason,autoOut:false,history:hist});
  }
  else{const row={id:uid('att'),user_id:uid2,date,source:'manual',history:[],...patch};({error:err}=await sb.from('attendance').insert(row));if(!err)_attMerge([row]);}
  if(err)return toast('Couldn’t save — '+err.message,'err');
  log(fullName(me()),id?'Edited attendance':'Added attendance',fullName(uById(uid2))+' · '+date+' · '+reason);
  _attNotify(uid2,'✏️ '+fullName(me())+' '+(id?'edited':'added')+' your attendance for '+fmtS(date)+' — '+reason,'att:'+date,'attendance','attendance_edited');
  try{if(typeof sendEmail==='function'&&uid2!==S.uid)sendEmail('attendance_edited',uid2,{date:fmtD(date),reason,actor:fullName(me())}).catch(()=>{});}catch(e){}
  closeModal();toast('Saved ✓');rr();
};
App._attDel=async(id)=>{
  const a=(DB.attendance||[]).find(x=>x.id===id);if(!a)return;
  if(a.userId===S.uid)return toast('You can’t delete your own attendance','err');
  if(!can('attendance','delete')||!scopeFilter('attendance')(a.userId))return toast('You need Attendance → Delete for this person','err');
  if(!(await confirmP({title:'Delete this attendance entry?',body:'<b>'+esc(fullName(uById(a.userId)))+'</b> · '+esc(fmtD(a.date))+' · '+_attHM(a.inAt)+' → '+(a.outAt?_attHM(a.outAt):'…'),confirmLabel:'Delete',cancelLabel:'Keep it'})))return;
  DB.attendance=DB.attendance.filter(x=>x.id!==id);closeModal();rr();
  const{error}=await sb.from('attendance').delete().eq('id',id);
  if(error){_attMerge([{id:a.id,user_id:a.userId,date:a.date,clock_in_at:a.inAt,clock_out_at:a.outAt,mode:a.mode}]);rr();return toast('Couldn’t delete — '+error.message,'err');}
  log(fullName(me()),'Deleted attendance',fullName(uById(a.userId))+' · '+a.date);
  toast('Deleted','warn');
};
App._attExport=(tab)=>{
  if(!can('attendance','export'))return toast('You need Attendance → Export','err');
  const r=_attRange();const people=tab==='my'?[me()]:_attScopeUsers();
  const csv=_attBuildCsv(people,r.from,r.to);
  _attDownload(csv,'attendance-'+r.from+'_'+r.to+(tab==='my'?'':'-team')+'.csv');
  log(fullName(me()),'Exported attendance',r.from+' to '+r.to);
};
/* One line per person-day (plus one per extra session) — everything payroll needs (spec §10.2) */
function _attBuildCsv(people,from,to){
  const lines=[['Employee ID','Name','Email','Department','Location','Category','Date','Day','Day type','Status','Shift','Scheduled (h:mm)','Clock in','Clock out','Worked (h:mm)','Shortage (h:mm)','Overtime (h:mm)','Late','Early out','Half day','Absent','Open shift','WFH','On duty','Rest-day work','Synced late','Corrected','Auto out','Pending requests','Note']];
  people.forEach(p=>{const loc=p.locationId?locById(p.locationId):null;
    _attDaysBetween(from,to).filter(d=>d<=todayISO()).forEach(d=>{
      const rs=_attRowsFor(p.id,d);const st=_attDayStatus(p,d);if(!rs.length&&st==='—')return;
      const f=_attDayFlags(p,d);const kind=_attDayKind(p,d);const sched=_attSchedule(p,d);
      const pend=(DB.attRequests||[]).filter(x=>x.userId===p.id&&x.status==='Pending'&&x.date===d).map(_attReqLabel).join('; ');
      const y=v=>v?'yes':'';
      const base=[p.employeeId||'',fullName(p),p.email,p.department||'',loc?loc.name:'',sched.category||'office',d,dayAbbr(d),kind.label,st,kind.type==='SCHEDULED_WORKING'?sched.in+'-'+sched.out:'',kind.type==='SCHEDULED_WORKING'?_attFmtHHMM(f.stdMins):''];
      const tail=[_attFmtHHMM(f.mins),f.shortage?_attFmtHHMM(f.stdMins-f.mins):'',f.otMins?_attFmtHHMM(f.otMins):'',y(f.late),y(f.early),y(f.halfDay),y(f.absent),y(f.openShift),y(f.wfh),y(f.onDuty),y(f.restDayWork),y(f.queued),y(f.edited),y(f.autoOut),pend,rs.map(a=>a.note).filter(Boolean).join(' | ')];
      if(!rs.length){lines.push(base.concat(['',''],tail));return;}
      rs.forEach((a,i)=>{lines.push(base.concat([_attHM(a.inAt),a.outAt?_attHM(a.outAt):''],i===0?tail:[_attFmtHHMM(_attMins(a))].concat(new Array(14).fill('')).concat([a.note||''])));});
    });});
  return lines.map(x=>x.map(v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"').join(',')).join('\n');
}
function _attDownload(csv,name){const blob=new Blob(['﻿'+csv],{type:'text/csv'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();}
