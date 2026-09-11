/* ============================================================
   Bridge — 20-notification-center.js  (v3.27)
   ONE notification pipeline — the way Slack / ClickUp / WhatsApp do it.

   The database decides WHO gets a notification and writes the row (kind, conversation, count).
   This file alone decides HOW the person is told about it on THIS device:

     realtime INSERT / UPDATE ─┐
     push handed over by sw.js ┼──► BBNotify.handle(row) ──► badge ─┬─ sound (one tone per family)
     60s poll (badge only)    ─┘                                   ├─ in-app card (tab focused)
                                                                   └─ desktop pop-up (tab in background)

   Rules (each one closes a real bug we had):
   · "New" means newer than the moment THIS session finished its first sync — measured on the
     SERVER clock (rpc server_now), so a wrong device clock can't make old rows look fresh.
   · Every row rings at most once per device, ever: key = id + count, remembered for 24h in
     localStorage. Reloads, reconnects, re-fetches and duplicate paths (realtime + push) never re-ring.
   · An UPDATE rings only when `count` actually grew (a busier chat), never when a row was marked
     read elsewhere or touched by a background sync.
   · Several tabs open: only the focused tab alerts; if none is focused, one elected tab does.
     Other devices: the server skips Web Push while any of the person's devices is focused (user_presence).
   · Never for the chat on screen, never while Do Not Disturb / quiet hours / device mute are on.
   · Audio is unlocked silently on the first tap and never plays "later" — a ring out of context
     is worse than none.
   Classic script: shares top-level scope with the other /js files. Loads after 19, before 99-boot.
   ============================================================ */
(function(){
  'use strict';
  if(window.BBNotify&&window.BBNotify._v===327)return;
  var NC={_v:327};window.BBNotify=NC;

  /* ─────────────────────────── helpers ─────────────────────────── */
  function S_(){try{return (typeof S!=='undefined'&&S)||window.S||{};}catch(e){return{};}}
  function sb_(){try{if(typeof sb!=='undefined'&&sb)return sb;}catch(e){}return window.sb||null;}
  function uid_(){var s=S_();return s&&s.uid||null;}
  function ls(k,d){try{var v=localStorage.getItem(k);return v==null?d:v;}catch(e){return d;}}
  function lsSet(k,v){try{localStorage.setItem(k,v);}catch(e){}}
  function lsDel(k){try{localStorage.removeItem(k);}catch(e){}}
  function prefs(){try{return (typeof _bbNP==='function'?_bbNP():{})||{};}catch(e){return{};}}
  function kindOf(row){try{return (typeof _bbNotifKind==='function'?_bbNotifKind(row):(row&&row.kind))||'general';}catch(e){return'general';}}
  function prefOn(kind,ch){try{return typeof _bbPrefOn==='function'?_bbPrefOn(kind,ch):true;}catch(e){return true;}}
  function esc_(s){try{return esc(s);}catch(e){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}}
  function nowServer(){return Date.now()+(NC._skew||0);}
  NC.isNative=function(){try{return typeof _bbIsNative==='function'&&_bbIsNative();}catch(e){return false;}};

  /* ─────────────────────────── families & sounds ─────────────────────────── */
  /* every kind belongs to one of three sound families — three tones is what people can tell apart */
  NC.FAMILY={mention:'mention',chat:'chat',dm:'mention',attendance:'attendance'};   /* v132: DMs ring like a mention (they are personal); attendance has its own family */
  NC.familyOf=function(kind){return NC.FAMILY[kind]||'other';};
  NC.SOUNDS=[
    ['alarm','Alarm','The loud rising triple-beep — impossible to miss'],
    ['pop','Pop','Soft and quick'],
    ['ding','Ding','A single clear note'],
    ['chime','Chime','Two rising notes'],
    ['pulse','Pulse','Short double blip'],
    ['bell','Bell','Warm and long'],
    ['knock','Knock','Low and discreet'],
    ['none','Silent','No sound for this family']
  ];
  NC.DEFAULT_SOUND={chat:'alarm',mention:'alarm',other:'alarm',attendance:'chime'};
  NC.soundFor=function(kind){var p=prefs();var fam=NC.familyOf(kind);var s=p.sounds&&p.sounds[fam];return NC.SOUNDS.some(function(x){return x[0]===s;})?s:NC.DEFAULT_SOUND[fam];};
  NC.volume=function(){var p=prefs();var v=p.sounds&&typeof p.sounds.volume==='number'?p.sounds.volume:0.8;return Math.max(0,Math.min(1,v));};

  /* tone specs: notes rendered offline into a tiny WAV (mono 16-bit, 22.05 kHz) */
  var RATE=22050;
  var SPEC={
    /* the original Bridge alert: insistent bright triple-beep that rises and repeats (~0.85s) */
    alarm:[{f:988,t:0,d:0.09},{f:1319,t:.12,d:0.09},{f:1760,t:.24,d:0.12},{f:1319,t:.46,d:0.09},{f:1760,t:.58,d:0.20}].reduce(function(a,n){a.push({f:n.f,t:n.t,d:n.d,g:.6,w:'square',sus:true});a.push({f:n.f,t:n.t,d:n.d,g:.55,w:'sine',sus:true});return a;},[]),
    pop:  [{f:920,t:0,d:0.12,g:1,glide:-260,w:'sine'},{f:1840,t:0,d:0.05,g:.25,w:'sine'}],
    ding: [{f:1318,t:0,d:0.38,g:.9,w:'sine'},{f:2636,t:0,d:0.18,g:.22,w:'sine'}],
    chime:[{f:988,t:0,d:0.20,g:.8,w:'sine'},{f:1976,t:0,d:0.08,g:.15,w:'sine'},{f:1319,t:.14,d:0.36,g:.9,w:'sine'},{f:2638,t:.14,d:0.12,g:.18,w:'sine'}],
    pulse:[{f:660,t:0,d:0.09,g:.85,w:'tri'},{f:880,t:.12,d:0.11,g:.85,w:'tri'}],
    bell: [{f:1568,t:0,d:0.65,g:.8,w:'sine'},{f:2093,t:0,d:0.45,g:.35,w:'sine'},{f:3136,t:0,d:0.22,g:.16,w:'sine'},{f:784,t:0,d:0.5,g:.2,w:'sine'}],
    knock:[{f:190,t:0,d:0.07,g:1,w:'tri',glide:-90},{f:180,t:.13,d:0.08,g:.9,w:'tri',glide:-90}]
  };
  function render(name){
    var notes=SPEC[name];if(!notes)return null;
    var len=0;notes.forEach(function(n){len=Math.max(len,n.t+n.d+0.03);});
    var N=Math.ceil(len*RATE),buf=new Float32Array(N);
    notes.forEach(function(n){
      var s0=Math.floor(n.t*RATE),s1=Math.min(N,Math.floor((n.t+n.d)*RATE)),ph=0;
      for(var i=s0;i<s1;i++){
        var x=(i-s0)/RATE,u=x/n.d;
        var f=n.f+(n.glide||0)*u;ph+=2*Math.PI*f/RATE;
        var env=n.sus?(x<0.004?x/0.004:1)*(u<0.6?1:(1-u)/0.4):(x<0.004?x/0.004:1)*Math.exp(-4.2*u)*(u>0.85?(1-u)/0.15:1);
        var v=n.w==='tri'?(2/Math.PI)*Math.asin(Math.sin(ph)):n.w==='square'?(Math.sin(ph)>=0?0.6:-0.6):Math.sin(ph);
        buf[i]+=v*env*(n.g||1);
      }
    });
    var peak=0;for(var j=0;j<N;j++)peak=Math.max(peak,Math.abs(buf[j]));
    if(peak>0){var k=0.92/peak;for(var q=0;q<N;q++)buf[q]*=k;}
    return buf;
  }
  function wav(buf){
    var N=buf.length,ab=new ArrayBuffer(44+N*2),dv=new DataView(ab);
    function str(o,s){for(var i=0;i<s.length;i++)dv.setUint8(o+i,s.charCodeAt(i));}
    str(0,'RIFF');dv.setUint32(4,36+N*2,true);str(8,'WAVE');str(12,'fmt ');dv.setUint32(16,16,true);dv.setUint16(20,1,true);dv.setUint16(22,1,true);
    dv.setUint32(24,RATE,true);dv.setUint32(28,RATE*2,true);dv.setUint16(32,2,true);dv.setUint16(34,16,true);str(36,'data');dv.setUint32(40,N*2,true);
    for(var i=0;i<N;i++){var s=Math.max(-1,Math.min(1,buf[i]));dv.setInt16(44+i*2,s<0?s*0x8000:s*0x7FFF,true);}
    var u8=new Uint8Array(ab),bin='';for(var c=0;c<u8.length;c+=8192)bin+=String.fromCharCode.apply(null,u8.subarray(c,c+8192));
    return'data:audio/wav;base64,'+btoa(bin);
  }
  var PCM={},EL={},unlocked=false,unlocking=false,ctx=null;
  function pcm(name){if(!PCM[name])PCM[name]=render(name);return PCM[name];}
  function el(name){
    if(name==='none')return null;
    if(!EL[name]){try{var b=pcm(name);if(!b)return null;var a=new Audio(wav(b));a.preload='auto';a.load();EL[name]=a;}catch(e){EL[name]=null;}}
    return EL[name];
  }
  function actx(){try{if(!ctx)ctx=new (window.AudioContext||window.webkitAudioContext)();return ctx;}catch(e){return null;}}
  /* first tap/keypress: silently prime every tone element (muted play → pause) and resume the context */
  function unlock(){
    if(unlocked||unlocking)return;unlocking=true;
    var names=Object.keys(SPEC),pending=names.length,okAny=false;
    names.forEach(function(n){
      var a=el(n);if(!a){if(--pending===0)done();return;}
      try{a.muted=true;a.volume=0.01;var p=a.play();
        var fin=function(ok){try{a.pause();a.currentTime=0;}catch(e){}a.muted=false;if(ok)okAny=true;if(--pending===0)done();};
        if(p&&p.then)p.then(function(){fin(true);}).catch(function(){fin(false);});else fin(true);
      }catch(e){a.muted=false;if(--pending===0)done();}
    });
    try{var c=actx();if(c&&c.state==='suspended')c.resume();}catch(e){}
    function done(){unlocking=false;unlocked=okAny||!!(ctx&&ctx.state==='running');}
  }
  ['pointerdown','touchend','keydown'].forEach(function(ev){document.addEventListener(ev,unlock,{capture:true,passive:true});});
  document.addEventListener('visibilitychange',function(){try{if(document.visibilityState==='visible'&&ctx&&ctx.state==='suspended')ctx.resume();}catch(e){}});
  function playWA(name,vol){
    var c=actx();if(!c)return false;
    try{var b=pcm(name);if(!b)return false;var ab=c.createBuffer(1,b.length,RATE);ab.getChannelData(0).set(b);
      var src=c.createBufferSource();src.buffer=ab;var g=c.createGain();g.gain.value=vol;src.connect(g);g.connect(c.destination);
      var go=function(){try{src.start(0);}catch(e){}};
      if(c.state==='suspended'){c.resume().then(go).catch(function(){});}else go();return true;}catch(e){return false;}
  }
  /* NC.play(name, opts) — plays one tone now. Returns false when the browser would not let us (no gesture yet). */
  NC.play=function(name,opts){
    opts=opts||{};name=name||'ding';if(name==='none')return true;
    var vol=typeof opts.volume==='number'?opts.volume:NC.volume();if(vol<=0)return true;
    var t=Date.now();if(!opts.force&&t-(NC._lastPlay||0)<900)return true;NC._lastPlay=t;   // one ring per burst
    var a=el(name);
    if(a&&(unlocked||opts.force)){try{a.muted=false;a.volume=vol;a.currentTime=0;var p=a.play();if(p&&p.then)p.catch(function(){playWA(name,vol);});return true;}catch(e){}}
    if(ctx&&ctx.state==='running')return playWA(name,vol);
    return false;
  };
  NC.unlocked=function(){return unlocked||!!(ctx&&ctx.state==='running');};

  /* ─────────────────────────── DND · quiet hours · device mute ─────────────────────────── */
  NC.muteKey=function(){return'bb_mute_'+(uid_()||'anon');};
  NC.deviceMuted=function(){return ls(NC.muteKey(),'0')==='1';};
  NC.setDeviceMuted=function(on){lsSet(NC.muteKey(),on?'1':'0');NC._paintDnd();};
  NC.dndUntil=function(){var p=prefs();var t=p.dnd_until?Date.parse(p.dnd_until):NaN;return isFinite(t)&&t>Date.now()?t:0;};
  NC.dndActive=function(){return NC.dndUntil()>0;};
  NC.quiet=function(){var p=prefs();var q=p.quiet||{};return{on:!!q.on,from:q.from||'22:00',to:q.to||'08:00',tz:q.tz||''};};
  function hm(s,d){var m=/^(\d{1,2}):(\d{2})$/.exec(String(s||''));return m?((+m[1])%24)*60+((+m[2])%60):d;}
  NC.quietNow=function(){
    var q=NC.quiet();if(!q.on)return false;var from=hm(q.from,1320),to=hm(q.to,480);if(from===to)return false;
    var d=new Date(),nowMin=d.getHours()*60+d.getMinutes();
    return from<to?(nowMin>=from&&nowMin<to):(nowMin>=from||nowMin<to);
  };
  NC.silenced=function(){return NC.deviceMuted()||NC.dndActive()||NC.quietNow();};
  NC.silencedWhy=function(){if(NC.deviceMuted())return'Muted on this device';if(NC.dndActive())return'Do Not Disturb until '+NC.fmtTime(NC.dndUntil());if(NC.quietNow())return'Quiet hours until '+NC.quiet().to;return'';};
  NC.fmtTime=function(t){try{var d=new Date(t);var today=new Date();var s=d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});if(d.toDateString()!==today.toDateString())s=d.toLocaleDateString([],{weekday:'short'})+' '+s;return s;}catch(e){return'';}};
  /* NC.setDnd('30m'|'1h'|'2h'|'tomorrow'|'off'|Date) — saved on the profile so every device honours it (server too) */
  NC.setDnd=function(v){
    var until=null;var now=new Date();
    if(v==='30m')until=new Date(now.getTime()+30*60000);
    else if(v==='1h')until=new Date(now.getTime()+60*60000);
    else if(v==='2h')until=new Date(now.getTime()+120*60000);
    else if(v==='tomorrow'){until=new Date(now);until.setDate(until.getDate()+1);until.setHours(8,0,0,0);}
    else if(v instanceof Date)until=v;
    var patch={dnd_until:until?until.toISOString():null};
    try{if(typeof _bbNPSave==='function')_bbNPSave(patch);}catch(e){}
    NC._paintDnd();try{toast(until?'Do Not Disturb until '+NC.fmtTime(until):'Notifications back on');}catch(e){}
    try{if(typeof render==='function'&&S_().route==='settings')render();}catch(e){}
  };
  NC.setQuiet=function(patch){
    var q=Object.assign({},NC.quiet(),patch||{});try{q.tz=Intl.DateTimeFormat().resolvedOptions().timeZone||q.tz;}catch(e){}
    try{if(typeof _bbNPSave==='function')_bbNPSave({quiet:q});}catch(e){}NC._paintDnd();
  };
  NC.setSound=function(family,name){var p=prefs();var s=Object.assign({},p.sounds||{});s[family]=name;try{if(typeof _bbNPSave==='function')_bbNPSave({sounds:s});}catch(e){}if(name!=='none')NC.play(name,{force:true});};
  NC.setVolume=function(v){var p=prefs();var s=Object.assign({},p.sounds||{});s.volume=Math.max(0,Math.min(1,+v||0));try{if(typeof _bbNPSave==='function')_bbNPSave({sounds:s});}catch(e){}};
  /* small bell-slash indicator in the top bar / sidebar when silenced (painted, not re-rendered) */
  NC._paintDnd=function(){try{var on=NC.silenced();document.documentElement.classList.toggle('bb-silenced',on);var els=document.querySelectorAll('[data-bb-dnd]');for(var i=0;i<els.length;i++){els[i].hidden=!on;els[i].title=NC.silencedWhy();}}catch(e){}};
  setInterval(NC._paintDnd,30000);

  /* ─────────────────────────── session clock, dedupe, tab election ─────────────────────────── */
  NC._readyAt=0;NC._skew=0;NC._seenCount={};
  NC.markReady=function(){
    /* called once the first sync is done (boot) and again after login — everything older is history */
    var s=sb_();
    var set=function(){NC._readyAt=nowServer();};
    if(s&&s.rpc){try{s.rpc('server_now').then(function(r){var t=r&&r.data?Date.parse(r.data):NaN;if(isFinite(t))NC._skew=t-Date.now();set();}).catch(set);}catch(e){set();}}else set();
    try{(DB.notifications||[]).forEach(function(n){if(n&&n.id)NC._seenCount[n.id]=n.count||1;});}catch(e){}
    NC._paintDnd();
  };
  function rungKey(){return'bb_rung_'+(uid_()||'anon');}
  function rungMap(){try{var m=JSON.parse(ls(rungKey(),'{}'))||{};var cut=Date.now()-86400000,out={},n=0;Object.keys(m).forEach(function(k){if(m[k]>cut){out[k]=m[k];n++;}});return out;}catch(e){return{};}}
  function rungHas(key){var m=rungMap();return !!m[key];}
  function rungAdd(key){var m=rungMap();m[key]=Date.now();var ks=Object.keys(m);if(ks.length>600){ks.sort(function(a,b){return m[a]-m[b];}).slice(0,ks.length-600).forEach(function(k){delete m[k];});}lsSet(rungKey(),JSON.stringify(m));}
  NC._tab=(Math.random().toString(36).slice(2,10));
  function leaderKey(){return'bb_nc_leader';}
  function claimLeader(){lsSet(leaderKey(),JSON.stringify({tab:NC._tab,at:Date.now(),focused:!!document.hasFocus()&&document.visibilityState==='visible'}));}
  function leader(){try{return JSON.parse(ls(leaderKey(),'null'));}catch(e){return null;}}
  ['focus','pointerdown','keydown'].forEach(function(ev){window.addEventListener(ev,function(){claimLeader();},{capture:true,passive:true});});
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')claimLeader();});
  window.addEventListener('blur',function(){var L=leader();if(L&&L.tab===NC._tab){L.focused=false;L.at=Date.now();lsSet(leaderKey(),JSON.stringify(L));}});
  window.addEventListener('pagehide',function(){var L=leader();if(L&&L.tab===NC._tab)lsDel(leaderKey());});
  /* which tab alerts? the focused one; else the last-focused one that is still alive */
  NC.thisTabAlerts=function(){
    if(document.visibilityState==='visible'&&document.hasFocus()){claimLeader();return true;}
    var L=leader();
    if(!L||Date.now()-(L.at||0)>90000){claimLeader();return true;}  // stale record → adopt
    return L.tab===NC._tab;
  };

  /* ─────────────────────────── the decision ─────────────────────────── */
  NC.viewing=function(link){try{return document.visibilityState==='visible'&&document.hasFocus()&&S_().route==='crm'&&typeof CRM!=='undefined'&&CRM&&CRM.sel&&!!link&&link===('crm:'+CRM.sel.convoId);}catch(e){return false;}};
  /* NC.handle(row, source) — row is a `notifications` row (snake_case). source: 'insert' | 'update' | 'push' | 'poll' */
  NC.handle=function(row,source){
    try{
      if(!row||!row.id||!uid_()||String(row.user_id)!==String(uid_()))return'not-mine';
      source=source||'insert';var count=row.count||1;var prev=NC._seenCount[row.id];NC._seenCount[row.id]=Math.max(prev||0,count);
      if(row.read)return'read';
      if(source==='poll')return'badge';
      if(source!=='insert'&&prev!=null&&count<=prev)return'nothing-new';      // marked read elsewhere / touched by a sync
      var when=source==='insert'?row.created_at:(row.updated_at||row.created_at);
      var t=when?Date.parse(when):NaN;
      if(!NC._readyAt||!isFinite(t)||t<NC._readyAt-15000)return'history';         // older than this session → badge only
      var key=row.id+':'+count;
      if(rungHas(key))return'already';
      rungAdd(key);
      if(NC.viewing(row.link)){NC._log(row,source,'viewing');return'viewing';}   // it is on screen — the chat shows it
      if(!NC.thisTabAlerts()){NC._log(row,source,'other-tab');return'other-tab';}
      var kind=kindOf(row);
      var focused=document.visibilityState==='visible'&&document.hasFocus();
      var silenced=NC.silenced();
      var fire=function(){
        if(!silenced&&prefOn(kind,'sound'))NC.play(NC.soundFor(kind));
        if(focused){if(!(NC.dndActive()||NC.quietNow()))NC.card(row);}   // device mute silences sound only; DND/quiet hours silence pop-ups too
        else{NC._missedAdd(row);if(!silenced&&prefOn(kind,'desktop')){try{if(typeof _bbDesktopShow==='function')_bbDesktopShow(row);}catch(e){}}}
        NC._log(row,source,focused?'rang+card':'rang (tab in background)');
      };
      /* v132 — this tab is in the background: if the same person has Bridge FOCUSED on another device
         (phone in hand, laptop asleep on the desk…), that device alerts — stay quiet here. Same rule the
         push server uses. Falls back to ringing if the check fails. */
      if(!focused){NC._otherDeviceFocused().then(function(yes){if(yes){NC._log(row,source,'quiet — another device is active');NC._missedAdd(row);}else fire();}).catch(fire);return'deferred';}
      fire();return'alerted';
    }catch(e){return'error';}
  };
  NC._otherDeviceFocused=function(){
    return new Promise(function(res){
      try{var s=sb_();if(!s||!uid_())return res(false);
        var since=new Date(Date.now()-45000).toISOString();
        s.from('user_presence').select('device_id,focused').eq('user_id',uid_()).eq('focused',true).gte('last_seen',since).then(function(r){var rows=(r&&r.data)||[];res(rows.some(function(x){return x.device_id!==NC.deviceId();}));}).catch(function(){res(false);});
        setTimeout(function(){res(false);},1500);
      }catch(e){res(false);}
    });
  };
  /* ── why did it ring? — a small per-device log shown in Settings → My notifications ── */
  function logKey(){return'bb_ring_log_'+(uid_()||'anon');}
  NC._log=function(row,source,decision){try{var m=JSON.parse(ls(logKey(),'[]'))||[];m.unshift({t:Date.now(),k:kindOf(row),x:String(row.text||'').slice(0,90),s:source,d:decision,n:row.count||1,id:row.id});if(m.length>40)m.length=40;lsSet(logKey(),JSON.stringify(m));}catch(e){}};
  NC.ringLog=function(){try{return JSON.parse(ls(logKey(),'[]'))||[];}catch(e){return[];}};
  NC.clearRingLog=function(){lsDel(logKey());};
  /* ── alerts that rang while this tab was in the background are shown as cards when you come back ── */
  NC._missed=[];
  NC._missedAdd=function(row){try{if(!NC._missed.some(function(x){return x.id===row.id;}))NC._missed.push(row);if(NC._missed.length>5)NC._missed.shift();}catch(e){}};
  NC._missedFlush=function(){try{if(!(document.visibilityState==='visible'&&document.hasFocus()))return;var rows=NC._missed.splice(0);rows.forEach(function(r){var loc=(DB.notifications||[]).find(function(x){return x.id===r.id;});if(loc&&loc.read)return;if(NC.viewing(r.link))return;NC.card(r);});}catch(e){}};
  window.addEventListener('focus',function(){setTimeout(NC._missedFlush,300);});
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')setTimeout(NC._missedFlush,300);});

  /* ─────────────────────────── in-app card (tab focused) ─────────────────────────── */
  var KIND_ICON={mention:'msg',chat:'msg',dm:'msg',ticket:'ticket',okr:'flag',checklist:'check',approval:'approve',feedback:'msg',reminder:'clock',escalation:'alert',attendance:'clock',people:'users',access:'shield',general:'bell'};
  var KIND_TITLE={mention:'You were tagged',chat:'New message',dm:'Direct message',ticket:'Ticket',okr:'OKR',checklist:'Checklist',approval:'Approval',feedback:'Feedback',reminder:'Reminder',escalation:'Escalation',attendance:'Attendance',people:'People',access:'Access changed',general:'Bridge'};
  NC.card=function(row){
    try{
      var host=document.getElementById('bb-nc-host');
      if(!host){host=document.createElement('div');host.id='bb-nc-host';document.body.appendChild(host);}
      var kind=kindOf(row);var title=kind==='chat'&&(row.count||1)>1?(row.count+' new messages'):(KIND_TITLE[kind]||'Bridge');
      var body=String(row.text||'').replace(/^[\p{Extended_Pictographic}\u{FE0F}\u{200D}]+\s*/u,'').slice(0,160);
      var id='nc-'+Math.random().toString(36).slice(2,8);
      var icon='';try{icon=ic(KIND_ICON[kind]||'bell','w-4 h-4');}catch(e){}
      var d=document.createElement('div');d.className='bb-nc-card';d.id=id;d.setAttribute('role','status');
      d.innerHTML='<span class="bb-nc-ic">'+icon+'</span><div class="bb-nc-body"><div class="bb-nc-t">'+esc_(title)+'</div><div class="bb-nc-x">'+esc_(body)+'</div></div><button class="bb-nc-close" aria-label="Dismiss">'+(function(){try{return ic('x','w-3.5 h-3.5');}catch(e){return'×';}})()+'</button>';
      d.querySelector('.bb-nc-close').addEventListener('click',function(ev){ev.stopPropagation();dismiss();});
      d.addEventListener('click',function(){dismiss();try{App._bbOpenLink(row.link||'',row.text||'',row.id);}catch(e){}});
      host.appendChild(d);requestAnimationFrame(function(){d.classList.add('in');});
      while(host.children.length>3)host.removeChild(host.firstChild);
      var tm=setTimeout(dismiss,6500);
      function dismiss(){clearTimeout(tm);d.classList.remove('in');setTimeout(function(){try{d.remove();}catch(e){}},220);}
    }catch(e){}
  };
  document.head.insertAdjacentHTML('beforeend','<style id="bb-nc-css">'
   +'#bb-nc-host{position:fixed;top:calc(64px + env(safe-area-inset-top));right:16px;z-index:480;display:flex;flex-direction:column;gap:8px;width:min(360px,calc(100vw - 24px));pointer-events:none}'
   +'.bb-nc-card{pointer-events:auto;display:flex;align-items:flex-start;gap:10px;padding:11px 12px;border-radius:14px;background:#13171B;color:#F4EFE8;box-shadow:0 14px 40px -12px rgba(0,0,0,.5),0 2px 8px rgba(0,0,0,.2);cursor:pointer;opacity:0;transform:translateY(-6px) scale(.98);transition:opacity .2s,transform .2s;border:1px solid rgba(255,255,255,.08)}'
   +'.bb-nc-card.in{opacity:1;transform:none}'
   +'.bb-nc-ic{width:30px;height:30px;border-radius:9px;background:rgba(209,182,143,.18);color:#D1B68F;display:grid;place-items:center;flex-shrink:0}'
   +'.bb-nc-body{flex:1;min-width:0}.bb-nc-t{font-size:12.5px;font-weight:700;letter-spacing:.01em}.bb-nc-x{font-size:12px;color:rgba(244,239,232,.78);margin-top:1px;line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}'
   +'.bb-nc-close{flex-shrink:0;width:26px;height:26px;border:none;border-radius:8px;background:transparent;color:rgba(244,239,232,.6);cursor:pointer;display:grid;place-items:center}.bb-nc-close:hover{background:rgba(255,255,255,.1);color:#fff}'
   +'@media(max-width:767px){#bb-nc-host{left:12px;right:12px;width:auto;top:calc(62px + env(safe-area-inset-top))}body:has(.crm-fs.crm-hasconvo) #bb-nc-host{top:calc(8px + env(safe-area-inset-top))}}'
   +'.bb-dnd-pill{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:#936659;background:#F5EDE4;border-radius:999px;padding:0 10px;min-height:30px;cursor:pointer;border:none;font-family:inherit;margin-right:6px}.bb-dnd-pill[hidden]{display:none}'
   +'</style>');

  /* ─────────────────────────── presence heartbeat (per device) ─────────────────────────── */
  NC.deviceId=function(){var d=ls('bb_device_id','');if(!d){d=Math.random().toString(36).slice(2,10)+Math.random().toString(36).slice(2,10);lsSet('bb_device_id',d);}return d;};
  var presT=null,presLast='';
  function presRow(extra){var focused=document.visibilityState==='visible'&&document.hasFocus();return Object.assign({user_id:uid_(),device_id:NC.deviceId(),focused:focused,visible:document.visibilityState==='visible',route:String(S_().route||''),ua:(navigator.userAgent||'').slice(0,160),last_seen:new Date().toISOString()},extra||{});}
  NC.heartbeat=function(force){
    var s=sb_();if(!s||!uid_())return;
    var row=presRow();var sig=row.focused+'|'+row.visible+'|'+row.route;
    if(!force&&sig===presLast&&Date.now()-(NC._presAt||0)<25000)return;
    presLast=sig;NC._presAt=Date.now();
    try{s.from('user_presence').upsert(row,{onConflict:'user_id,device_id'}).then(function(){}).catch(function(){});}catch(e){}
  };
  function presSoon(){clearTimeout(presT);presT=setTimeout(function(){NC.heartbeat(true);},250);}
  window.addEventListener('focus',presSoon);window.addEventListener('blur',presSoon);document.addEventListener('visibilitychange',presSoon);
  setInterval(function(){if(document.visibilityState==='visible')NC.heartbeat(false);},20000);
  /* leaving: tell the server right now (keepalive survives the unload) so push resumes at once */
  window.addEventListener('pagehide',function(){
    try{var s=sb_();if(!s||!uid_())return;var row=presRow({focused:false,visible:false});
      var tok='';try{var ses=JSON.parse(ls('sb-'+SB_URL.replace(/^https?:\/\//,'').split('.')[0]+'-auth-token','null'));tok=ses&&(ses.access_token||(ses.currentSession&&ses.currentSession.access_token))||'';}catch(e){}
      fetch(SB_URL+'/rest/v1/user_presence?on_conflict=user_id,device_id',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json','apikey':SB_ANON,'Authorization':'Bearer '+(tok||SB_ANON),'Prefer':'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(row)}).catch(function(){});
    }catch(e){}
  });

  /* ─────────────────────────── wiring: realtime · push hand-over · poll ─────────────────────────── */
  function rowToLocal(row){return{id:row.id,userId:row.user_id,text:row.text||'',read:row.read||false,time:row.updated_at||row.created_at,created:row.created_at,link:row.link||null,kind:row.kind||null,count:row.count||1,conversationId:row.conversation_id||null};}
  function repaint(){try{var ae=document.activeElement;var typing=ae&&/^(INPUT|TEXTAREA)$/.test(ae.tagName);if(S_().route==='crm'){if(typeof _crmLiveRR==='function')_crmLiveRR();}else if(S_().route==='notifications'){render();}else if(!typing){render();}else{try{if(typeof _paintNavBadges==='function')_paintNavBadges();}catch(e){}}}catch(e){}}
  NC.onInsert=function(row){
    try{
      if(!row||!row.id||String(row.user_id)!==String(uid_()))return;
      try{window._notifPersisted=window._notifPersisted||{};window._notifPersisted[row.id]=1;}catch(e){}
      var known=(DB.notifications||[]).some(function(x){return x.id===row.id;});
      if(!known){try{DB.notifications.unshift(rowToLocal(row));_invalidateNotifCache();}catch(e){}}
      /* v132 — an access change: pull the fresh profile + roles so tabs/buttons update within seconds */
      if(row.kind==='access'&&typeof _accessRefresh==='function'){try{_accessRefresh();}catch(e){}}
      NC.handle(row,'insert');repaint();
    }catch(e){}
  };
  NC.onUpdate=function(row){
    try{
      if(!row||!row.id||String(row.user_id)!==String(uid_()))return;
      var loc=(DB.notifications||[]).find(function(x){return x.id===row.id;});
      var grew=false;
      if(!loc){if(!row.read){try{DB.notifications.unshift(rowToLocal(row));_invalidateNotifCache();}catch(e){}grew=true;}}
      else{grew=(row.count||1)>(loc.count||1);var nowRead=!!row.read&&!loc.read;loc.text=row.text||loc.text;loc.read=!!row.read;loc.count=row.count||1;loc.time=row.updated_at||loc.time;loc.kind=row.kind||loc.kind;_invalidateNotifCache();if(!grew&&!nowRead)return;}
      NC.handle(row,'update');repaint();
    }catch(e){}
  };
  /* push handed over by the service worker while a Bridge window is open on this device */
  NC.onPush=function(d){
    try{
      if(!d||!d.id)return;
      var loc=(DB.notifications||[]).find(function(x){return x.id===d.id;});
      var row={id:d.id,user_id:uid_(),text:d.body||(loc&&loc.text)||'',link:d.link||(loc&&loc.link)||null,kind:d.kind||(loc&&loc.kind)||null,count:d.count||(loc&&loc.count)||1,read:!!(loc&&loc.read),created_at:d.at,updated_at:d.at};
      NC.handle(row,'push');
    }catch(e){}
  };
  (function boot(){
    if(window._bbNotifBoot2)return;window._bbNotifBoot2=true;
    /* live: one realtime channel per signed-in person — new rows AND changed rows */
    setInterval(function(){try{
      var s=sb_();if(!s||!uid_()||window._bbNotifRT)return;
      window._bbNotifRT=s.channel('bb-notif-'+uid_())
        .on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:'user_id=eq.'+uid_()},function(p){NC.onInsert(p.new||p.record||{});})
        .on('postgres_changes',{event:'UPDATE',schema:'public',table:'notifications',filter:'user_id=eq.'+uid_()},function(p){NC.onUpdate(p.new||p.record||{});})
        .subscribe();
      window._bbNotifRTUid=uid_();
    }catch(e){window._bbNotifRT=null;}},2500);
    /* user switched / signed out: drop the channel so the next person gets their own */
    setInterval(function(){try{if(window._bbNotifRT&&(!uid_()||uid_()!==window._bbNotifRTUid)){try{var s=sb_();if(s)s.removeChannel(window._bbNotifRT);}catch(e){}window._bbNotifRT=null;NC._readyAt=0;}}catch(e){}},4000);
    /* fallback: badge refresh once a minute while visible (never a sound) */
    setInterval(function(){if(!uid_()||document.visibilityState!=='visible')return;try{if(typeof _lazyLoad==='function')_lazyLoad('notifications');}catch(e){}},60000);
    /* history never rings: everything loaded by a fetch is "seen" at its current count */
    if(typeof _applyNotifications==='function'&&!window._bbApplyWrapped){window._bbApplyWrapped=true;var oap=_applyNotifications;_applyNotifications=function(n){oap(n);try{(DB.notifications||[]).forEach(function(x){if(x&&x.id)NC._seenCount[x.id]=Math.max(NC._seenCount[x.id]||0,x.count||1);});}catch(e){}};}
    /* service-worker hand-over */
    try{if('serviceWorker' in navigator&&!window._bbSWPushBound){window._bbSWPushBound=true;navigator.serviceWorker.addEventListener('message',function(ev){var d=ev.data||{};if(d.type==='bb-push')NC.onPush(d.data||{});});}}catch(e){}
    /* first sync done? mark ready once per sign-in (boot calls markReady explicitly; this is the safety net) */
    setInterval(function(){try{if(uid_()&&!NC._readyAt&&window._bbFirstSyncDone)NC.markReady();}catch(e){}},1500);
    claimLeader();
  })();

  /* ─────────────────────────── test / preview (Settings) ─────────────────────────── */
  NC.test=function(kind){
    kind=kind||'chat';
    var name=NC.soundFor(kind);var ok=NC.play(name,{force:true});
    NC.card({id:'test-'+Date.now(),user_id:uid_(),kind:kind,text:'This is how a '+(KIND_TITLE[kind]||'Bridge').toLowerCase()+' alert looks and sounds.',count:1,link:''});
    if(!ok)try{toast('Tap anywhere first, then test again','warn');}catch(e){}
    return ok;
  };
  NC.preview=function(name){if(name==='none')return;var ok=NC.play(name,{force:true});if(!ok)try{toast('Tap anywhere first, then try again','warn');}catch(e){}};

  /* legacy names still used by the chat header bell and older call sites */
  window._crmDing=function(m,force){if(force)NC.play(NC.soundFor('chat'),{force:true});};
  window._bbRing=function(kind){if(!NC.silenced()&&prefOn(kind,'sound'))NC.play(NC.soundFor(kind));};
  window._bbSndAllow=function(t){var k=typeof _bbKindNorm==='function'?_bbKindNorm(t):t;return !NC.silenced()&&prefOn(k,'sound');};
  window._bbSndSet=function(t,on){var k=typeof _bbKindNorm==='function'?_bbKindNorm(t):t;try{_bbNPSetChannel(k,'sound',on);}catch(e){}};
  window._bbDeviceMuted=NC.deviceMuted;
})();

/* ═══════════════════════════════════════════════════════════════════════════════
   v3.27 — SETTINGS → MY NOTIFICATIONS  (BBNotify.settingsHTML)
   Structured the way ClickUp / Slack do it, mobile-first:
     1. Do Not Disturb   — pause for a while, quiet hours, mute this device
     2. Sounds           — one tone per family (messages / mentions / everything else), volume, preview
     3. What notifies you— per kind: Inbox · Sound · Desktop · Push · Email as tap-able chips
     4. This device      — desktop pop-up permission, push while closed, test buttons
   ═══════════════════════════════════════════════════════════════════════════════ */
(function(){
  var NC=window.BBNotify;if(!NC)return;
  function esc_(s){try{return esc(s);}catch(e){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}}
  var CH_HELP={inbox:'Shows in your Inbox and the bell badge',sound:'Plays a tone while Bridge is open',desktop:'System pop-up while Bridge is open in the background',push:'Reaches this phone or computer when Bridge is closed',email:'Sends an e-mail'};
  var CH_ICON={inbox:'bell',sound:'bell',desktop:'grid',push:'flag',email:'msg'};
  function icn(n,c){try{return ic(n,c||'w-3.5 h-3.5');}catch(e){return'';}}
  function E(s){try{return esc(s);}catch(e){return String(s);}}
  function card(title,sub,body,iconName){
    return '<section class="bb-set-card">'
     +'<header class="bb-set-head"><span class="bb-set-hic">'+icn(iconName||'bell','w-4 h-4')+'</span><div><div class="bb-set-t">'+title+'</div>'+(sub?'<div class="bb-set-s">'+sub+'</div>':'')+'</div></header>'
     +'<div class="bb-set-body">'+body+'</div></section>';
  }
  function row(label,desc,right,opts){opts=opts||{};return '<div class="bb-set-row'+(opts.stack?' stack':'')+'"><div class="bb-set-lbl"><div class="bb-set-l">'+label+'</div>'+(desc?'<div class="bb-set-d">'+desc+'</div>':'')+'</div><div class="bb-set-right">'+right+'</div></div>';}
  function tog(on,onclick,label){return '<button role="switch" aria-checked="'+(on?'true':'false')+'" class="tog '+(on?'on':'off')+'" onclick="'+onclick+'" aria-label="'+E(label||'')+'"><span></span></button>';}

  NC.settingsHTML=function(){
    var dnd=NC.dndUntil(),q=NC.quiet(),muted=NC.deviceMuted(),p=(typeof _bbNP==='function'?_bbNP():{})||{};
    /* 1 · Do Not Disturb */
    var dndBody=''
      +'<div class="bb-dnd-state '+(dnd?'on':'')+'">'+icn(dnd?'clock':'check','w-4 h-4')+'<div><div class="bb-dnd-st">'+(dnd?'Paused until '+E(NC.fmtTime(dnd)):'Notifications are on')+'</div><div class="bb-dnd-sd">'+(dnd?'Inbox still collects everything — no sounds, pop-ups or push until then.':'Pause them for a while when you need to focus.')+'</div></div>'+(dnd?'<button class="ui-btn ui-btn-primary ui-btn-sm" onclick="BBNotify.setDnd(\'off\')">Resume</button>':'')+'</div>'
      +'<div class="bb-dnd-quick">'+[['30m','30 min'],['1h','1 hour'],['2h','2 hours'],['tomorrow','Until tomorrow 8:00']].map(function(x){return '<button class="bb-chip" onclick="BBNotify.setDnd(\''+x[0]+'\')">'+x[1]+'</button>';}).join('')+'</div>'
      +row('Quiet hours','Every day, automatically — like sleep hours on your phone',tog(q.on,'BBNotify.setQuiet({on:'+(q.on?'false':'true')+'});rr()','Quiet hours'))
      +(q.on?'<div class="bb-quiet-times"><label>From <input type="time" class="ui-input" value="'+E(q.from)+'" onchange="BBNotify.setQuiet({from:this.value});BBNotify._paintDnd()"></label><label>To <input type="time" class="ui-input" value="'+E(q.to)+'" onchange="BBNotify.setQuiet({to:this.value});BBNotify._paintDnd()"></label></div>':'')
      +row('Mute sounds on this device','Only this browser or phone — alerts still arrive silently',tog(muted,'BBNotify.setDeviceMuted('+(muted?'false':'true')+');rr()','Mute sounds on this device'));
    /* 2 · Sounds */
    var fams=[['chat','Messages','Every chat message on your boards'],['mention','Mentions & direct messages','When someone @tags you or messages you directly'],['attendance','Attendance','Clock-in / clock-out reminders'],['other','Everything else','Tickets, OKRs, checklists, approvals, reminders…']];
    var sndBody=fams.map(function(f){
      var cur=NC.soundFor(f[0]==='other'?'ticket':f[0]);
      var sel='<div class="bb-snd-pick"><select class="ui-select" aria-label="'+E(f[1]+' sound')+'" onchange="BBNotify.setSound(\''+f[0]+'\',this.value)">'+NC.SOUNDS.map(function(s){return '<option value="'+s[0]+'"'+(s[0]===cur?' selected':'')+'>'+s[1]+(s[0]==='none'?'':' — '+s[2])+'</option>';}).join('')+'</select>'
        +'<button class="bb-play" title="Preview" aria-label="Preview '+E(f[1])+' sound" onclick="BBNotify.preview(\''+cur+'\')">'+icn('chevR','w-4 h-4')+'</button></div>';
      return row(f[1],f[2],sel,{stack:true});
    }).join('')
      +row('Volume','',
        '<div class="bb-vol">'+icn('bell','w-4 h-4')+'<input type="range" min="0" max="1" step="0.05" value="'+NC.volume()+'" aria-label="Volume" oninput="BBNotify.setVolume(this.value)" onchange="BBNotify.preview(BBNotify.soundFor(\'chat\'))"></div>',{stack:true});
    /* 3 · What notifies you */
    var kinds=(typeof _BB_KINDS!=='undefined'?_BB_KINDS:[]),chans=(typeof _BB_CHANNELS!=='undefined'?_BB_CHANNELS:[]);
    var kindsBody='<div class="bb-kinds">'+kinds.map(function(k){
      var kind=k[0];var allOn=chans.every(function(c){return _bbPrefOn(kind,c[0]);});var anyOn=chans.some(function(c){return _bbPrefOn(kind,c[0]);});
      return '<div class="bb-kind'+(anyOn?'':' off')+'">'
       +'<div class="bb-kind-top"><div class="bb-kind-lbl"><div class="bb-set-l">'+k[1]+'</div><div class="bb-set-d">'+k[2]+'</div></div><button class="bb-kind-all" onclick="App._bbNPRowAll(\''+kind+'\','+(allOn?'false':'true')+')">'+(allOn?'All off':'All on')+'</button></div>'
       +'<div class="bb-chips">'+chans.map(function(c){var on=_bbPrefOn(kind,c[0]);return '<button role="switch" aria-checked="'+(on?'true':'false')+'" class="bb-chip tg'+(on?' on':'')+'" title="'+E(CH_HELP[c[0]]||'')+'" onclick="App._bbChip(this,\''+kind+'\',\''+c[0]+'\')">'+icn('check','w-3 h-3')+'<span>'+c[1]+'</span></button>';}).join('')+'</div>'
       +'</div>';
    }).join('')+'</div>'
     +'<div class="bb-set-note">Inbox = the bell and your Inbox page · Sound & Desktop = while Bridge is open · Push = when it’s closed. Tags always reach your Inbox. A busy chat groups into one line (“5 new messages in Dubai”).</div>';
    /* 4 · This device */
    var ds=(typeof _bbDesktopState==='function'?_bbDesktopState():'unsupported'),native=NC.isNative();
    var deskExtra=ds==='unsupported'?'<span class="bb-hint bb-bad">Not supported in this browser</span>'
      :ds==='granted'?'<span class="bb-hint bb-ok">'+icn('check','w-3 h-3')+' Allowed</span>'
      :ds==='denied'?'<span class="bb-hint bb-bad">Blocked in the browser — allow notifications for this site from the address bar</span>'
      :'<button onclick="App._bbDesktopEnable()" class="ui-btn ui-btn-primary ui-btn-sm">Allow</button>';
    var pushExtra=native?'<span class="bb-hint">Handled by the app</span>'
      :!(typeof _bbPushSupported==='function'&&_bbPushSupported())?'<span class="bb-hint bb-bad">'+(/iP(hone|ad)/.test(navigator.userAgent||'')?'On iPhone: Share → Add to Home Screen, then open Bridge from there':'Not supported in this browser')+'</span>'
      :(typeof _bbPushHere==='function'&&_bbPushHere())?'<span class="bb-hint bb-ok">'+icn('check','w-3 h-3')+' On</span> <button onclick="App._bbPushDisableHere()" class="ui-btn ui-btn-ghost ui-btn-sm">Turn off here</button>'
      :'<button onclick="App._bbPushEnable()" class="ui-btn ui-btn-primary ui-btn-sm">Enable</button>';
    var devBody=row('Desktop pop-ups','System notifications while Bridge is open in a background tab',deskExtra)
      +row('Push when Bridge is closed','Notifications on this device even when the app or tab isn’t open',pushExtra)
      +row('Preview an alert','See and hear exactly what you’ll get','<div class="bb-test">'+[['chat','Message'],['dm','Direct message'],['attendance','Attendance'],['ticket','Ticket']].map(function(x){return '<button class="ui-btn ui-btn-ghost ui-btn-sm" onclick="BBNotify.test(\''+x[0]+'\')">'+x[1]+'</button>';}).join('')+'</div>',{stack:true});
    return NC._settingsCSS()
      +card('Do Not Disturb','Pause everything except the Inbox',dndBody,'clock')
      +card('Sounds','One tone per family so you know what happened without looking',sndBody,'bell')
      +card('What notifies you','Saved to your profile — the same on every device',kindsBody,'users')
      +card('This device','Applies only to the browser or phone you are using now',devBody,'grid')
      +card('Why did it ring?','The last alerts this device decided on — what rang, what stayed quiet, and why',NC._ringLogHTML(),'help');
  };
  NC._ringLogHTML=function(){
    var L=NC.ringLog();
    if(!L.length)return '<div style="font-size:12.5px;color:var(--c-text-3);padding:6px 0">Nothing yet on this device. When a sound plays, it shows up here with the reason.</div>';
    var fmt=function(t){var d=new Date(t);return d.toLocaleDateString('en-GB',{day:'numeric',month:'short'})+' '+d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});};
    var rows=L.slice(0,25).map(function(e){var rang=/^rang/.test(e.d||'');return '<div style="display:flex;gap:9px;align-items:flex-start;padding:7px 0;border-top:1px solid var(--c-border)"><span style="flex-shrink:0;width:8px;height:8px;border-radius:50%;margin-top:6px;background:'+(rang?'#428059':'var(--c-border-2)')+'"></span><div style="flex:1;min-width:0"><div style="font-size:12.5px;color:var(--c-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc_(e.x||'')+'</div><div style="font-size:11px;color:var(--c-text-3)">'+fmt(e.t)+' · '+esc_(e.k||'')+(e.n>1?' ×'+e.n:'')+' · '+esc_(e.s||'')+' → <b style="color:'+(rang?'#346A47':'var(--c-text-2)')+'">'+esc_(e.d||'')+'</b></div></div></div>';}).join('');
    return rows+'<div style="margin-top:8px"><button class="ui-btn ui-btn-subtle ui-btn-sm" onclick="BBNotify.clearRingLog();rr()">Clear log</button></div>';
  };
  NC._settingsCSS=function(){return '<style id="bb-set-css">'
   +'.bb-set-card{background:#fff;border:1px solid #EDE7DC;border-radius:18px;box-shadow:0 1px 2px rgba(35,28,22,.04);overflow:hidden;margin-bottom:14px}'
   +'.bb-set-head{display:flex;align-items:center;gap:10px;padding:13px 18px;background:#F5F1EB;border-bottom:1px solid #EEE8DE}'
   +'.bb-set-hic{width:30px;height:30px;border-radius:9px;background:#fff;color:#54433C;display:grid;place-items:center;border:1px solid #EEE8DE;flex-shrink:0}'
   +'.bb-set-t{font-size:13.5px;font-weight:700;color:#13171B}.bb-set-s{font-size:11.5px;color:#A59788;margin-top:1px}'
   +'.bb-set-body{padding:4px 18px 12px}'
   +'.bb-set-row{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #F1ECE3}.bb-set-row:last-child{border-bottom:none}'
   +'.bb-set-lbl{flex:1;min-width:0}.bb-set-l{font-size:13px;font-weight:600;color:#13171B}.bb-set-d{font-size:11.5px;color:#A8998A;margin-top:1px;line-height:1.45}'
   +'.bb-set-right{flex-shrink:0;display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}'
   +'.bb-set-row.stack{flex-wrap:wrap}.bb-set-row.stack .bb-set-lbl{flex:1 1 180px}.bb-set-row.stack .bb-set-right{flex:1 1 300px;justify-content:stretch}'
   +'.bb-dnd-state{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:14px;background:#F7F3EE;border:1px solid #EEE8DE;margin:12px 0 10px;color:#54433C}.bb-dnd-state.on{background:#FBF3E6;border-color:#EBD8B8;color:#8A6A2F}'
   +'.bb-dnd-state>div{flex:1;min-width:0}.bb-dnd-st{font-size:13px;font-weight:700;color:#13171B}.bb-dnd-sd{font-size:11.5px;color:#A8998A;margin-top:1px;line-height:1.4}'
   +'.bb-dnd-quick{display:flex;gap:8px;flex-wrap:wrap;padding-bottom:8px}'
   +'.bb-chip{display:inline-flex;align-items:center;gap:6px;padding:0 12px;min-height:34px;border-radius:999px;border:1.5px solid #E6DED3;background:#fff;color:#54433C;font-size:12.5px;font-weight:600;cursor:pointer;font-family:inherit;-webkit-tap-highlight-color:transparent;transition:background .12s,border-color .12s,color .12s}'
   +'.bb-chip:hover{background:#F7F3EE}.bb-chip:active{transform:scale(.97)}'
   +'.bb-chip.tg svg{display:none}.bb-chip.tg.on{background:#13171B;border-color:#13171B;color:#F4EFE8}.bb-chip.tg.on svg{display:block}'
   +'.bb-quiet-times{display:flex;gap:12px;flex-wrap:wrap;padding:2px 0 12px}.bb-quiet-times label{display:flex;align-items:center;gap:8px;font-size:12.5px;color:#786A5F;font-weight:600}.bb-quiet-times .ui-input{width:auto;min-width:118px;padding:8px 10px}'
   +'.bb-snd-pick{display:flex;gap:8px;align-items:center;width:100%}.bb-snd-pick .ui-select{flex:1;min-width:0;padding:9px 34px 9px 12px;font-size:13px;background-image:url(\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="%2354433C" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>\');background-repeat:no-repeat;background-position:right 12px center}'
   +'.bb-play{width:40px;height:40px;border-radius:12px;border:1.5px solid #E6DED3;background:#fff;color:#54433C;cursor:pointer;display:grid;place-items:center;flex-shrink:0}.bb-play:hover{background:#F7F3EE}'
   +'.bb-vol{display:flex;align-items:center;gap:10px;width:100%;color:#A59788}.bb-vol input[type=range]{flex:1;accent-color:#54433C;height:28px}'
   +'.bb-kinds{display:flex;flex-direction:column}.bb-kind{padding:12px 0;border-bottom:1px solid #F1ECE3}.bb-kind:last-child{border-bottom:none}.bb-kind.off .bb-set-l{color:#A8998A}'
   +'.bb-kind-top{display:flex;align-items:flex-start;gap:10px}.bb-kind-lbl{flex:1;min-width:0}'
   +'.bb-kind-all{border:none;background:transparent;color:#936659;font-size:11.5px;font-weight:700;cursor:pointer;padding:4px 6px;border-radius:8px;font-family:inherit;flex-shrink:0}.bb-kind-all:hover{background:#F7F3EE}'
   +'.bb-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.bb-chips .bb-chip{min-height:32px;padding:0 11px;font-size:12px}'
   +'.bb-set-note{font-size:11.5px;color:#A8998A;line-height:1.5;padding:10px 0 2px}'
   +'.bb-hint{font-size:11.5px;color:#A8998A;display:inline-flex;align-items:center;gap:4px}.bb-ok{color:#2F7A57;font-weight:700}.bb-bad{color:#936659}'
   +'.bb-test{display:flex;gap:8px;flex-wrap:wrap}'
   +'@media(max-width:640px){.bb-set-row.stack .bb-set-lbl,.bb-set-row.stack .bb-set-right{flex-basis:100%}.bb-set-body{padding:2px 14px 10px}.bb-set-head{padding:12px 14px}.bb-set-row{padding:11px 0}.bb-chip{min-height:38px}.bb-chips .bb-chip{min-height:36px}.bb-test .ui-btn{flex:1}}'
   +'</style>';};
  /* chip toggle: flips one kind × channel, saves, asks for the browser permission when turning Desktop/Push on */
  App._bbChip=async function(btn,kind,ch){
    var on=!btn.classList.contains('on');
    btn.classList.toggle('on',on);btn.setAttribute('aria-checked',on?'true':'false');
    try{await _bbNPSetChannel(kind,ch,on);}catch(e){}
    if(on&&ch==='push'){try{await App._bbPushEnable(true);}catch(e){}}
    if(on&&ch==='desktop'){try{await App._bbDesktopEnable(true);}catch(e){}}
    if(on&&ch==='sound'){try{BBNotify.play(BBNotify.soundFor(kind),{force:true});}catch(e){}}
    try{var k=btn.closest('.bb-kind');if(k){var any=k.querySelector('.bb-chip.tg.on');k.classList.toggle('off',!any);var all=k.querySelectorAll('.bb-chip.tg').length===k.querySelectorAll('.bb-chip.tg.on').length;var b=k.querySelector('.bb-kind-all');if(b)b.textContent=all?'All off':'All on';}}catch(e){}
  };
  /* keep the older name working for anything that still calls it */
  window._bbMyNotifCard=function(){return NC.settingsHTML();};
  window._bbSndCard=function(){return'';};
})();
