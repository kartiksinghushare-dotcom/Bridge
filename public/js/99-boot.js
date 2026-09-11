/* ============================================================
   Bridge — 99-boot.js  (split from Bridge.html lines 4408-4459)
   Classic script: shares top-level scope with the other /js files.
   Load order matters — see index.html.
   ============================================================ */
/* ===== BOOT ===== */
(async function boot(){
  var _hashRoute=(window.location.hash||'').replace('#','').trim();_hashRoute=({bolt:'okr',workspace:'crm'})[_hashRoute]||_hashRoute;
  const VALID_ROUTES=['home','attendance','attsettings','dashboard','crm','mychecklists','users','hierarchy','checklists','allcl','questions','approvals','notifications','analytics','locations','departments','settings','audit','teamview','profile','okr','tickets'];
  const _deepLink=VALID_ROUTES.includes(_hashRoute)?_hashRoute:null;
  try{const{data:{session}}=await sb.auth.getSession();if(session){
      // Load local cache first for instant UI
      const hadLocal=loadDB();
      if(S.uid){S.route=_deepLink||S.route||'home';restoreFilters(S.route);_recoverEditingSubmissions();render();}
      const{data:profile,error:pErr}=await sb.from('profiles').select('*').eq('id',session.user.id).single();
      if(pErr&&!profile)throw new Error('profile: '+(pErr.message||pErr.code||'unknown'));
      if(profile&&profile.status==='Active'){
        const mapped=_mU([profile])[0];   /* v132: one mapper for every profile column (avatar, HR fields, schedule…) */
        const idx=DB.users.findIndex(x=>x.id===mapped.id);if(idx>-1)DB.users[idx]=mapped;else DB.users.push(mapped);
        S.uid=mapped.id;
        if(_deepLink)S.route=_deepLink;
        else if(!S.route||S.route==='login')S.route='home';
        // v3.14: bring back this tab's remembered filters (and the OKR tree's open branches)
        // before the first paint, so a refresh lands you exactly where you left off.
        restoreFilters(S.route);
        // CRITICAL: Always load from Supabase FIRST before any sync
        // This prevents empty local state from overwriting real server data
        // v132.7: a hiccup in one loader or in the first paint must not sign the person out —
        // keep the session, say what failed, and land on My Day.
        try{await loadFromSB();}catch(e){console.error('[boot] loadFromSB:',e);toast('Some data could not be loaded — '+(e.message||e),'err');}
        try{saveDB();}catch(e){}
        try{render();}catch(e){console.error('[boot] render:',e);toast('Could not draw this page — '+(e.message||e),'err');S.route='home';try{render();}catch(e2){}}
        try{if(typeof _bbAfterBoot==='function')_bbAfterBoot();}catch(e){}
        return;
      }
      await sb.auth.signOut();
    }
    loadDB();S.uid=null;render();
  }catch(e){try{loadDB();}catch(e2){}S.uid=null;render();console.error('Boot error:',e,e&&e.stack);
    const m=String(e&&e.message||e||'');
    if(m&&!m.includes('JWT'))toast((/fetch|network|load failed|connection/i.test(m)?'Connection error — check your internet connection':'Could not start Bridge')+' · '+m.slice(0,140),'err');}
})();

// ── Session keepalive: refresh the auth token every 10 minutes to prevent 401 ──
// NOTE: this no longer re-downloads all data on a timer (that was the main egress drain).
// Data now loads per-tab on click (see _lazyForRoute) and on tab refocus (visibilitychange).
setInterval(async()=>{
  if(!S.uid)return;
  if(document.visibilityState==='hidden')return; // paused while tab is backgrounded
  try{
    const{data:{session},error}=await sb.auth.getSession();
    if(error||!session){
      // Session gone — try refresh
      const{data,error:re}=await sb.auth.refreshSession();
      if(re){console.warn('[auth] session expired, reloading');render();return;}
    }
  }catch(e){console.warn('[keepalive]',e.message);}
},10*60*1000); // every 10 minutes

// ── Refresh the active tab's data when the user returns to a backgrounded tab ──
// While hidden, nothing downloads; on return we refresh only the current route once.
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState!=='visible'||!S.uid)return;
  _lazyForRoute(S.route);
});


// v132.7: surface script errors instead of failing silently (helps catch browser-specific issues, e.g. Safari)
(function(){const seen={};window.addEventListener('error',e=>{try{const f=String(e.filename||'');if(!f.includes('/js/'))return;const m=String(e.message||'');if(seen[m])return;seen[m]=1;console.error('[Bridge]',m,f.split('/').pop(),e.lineno);if(typeof toast==='function')toast('Script error in '+f.split('/').pop().split('?')[0]+': '+m.slice(0,120),'err');}catch(_){}});})();
