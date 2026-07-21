/* ============================================================
   Bridge — 99-boot.js  (split from Bridge.html lines 4408-4459)
   Classic script: shares top-level scope with the other /js files.
   Load order matters — see index.html.
   ============================================================ */
/* ===== BOOT ===== */
(async function boot(){
  const _hashRoute=(window.location.hash||'').replace('#','').trim();
  const VALID_ROUTES=['dashboard','crm','mychecklists','users','hierarchy','checklists','allcl','questions','approvals','notifications','analytics','locations','departments','settings','audit','teamview','profile','okr','tickets'];
  const _deepLink=VALID_ROUTES.includes(_hashRoute)?_hashRoute:null;
  try{const{data:{session}}=await sb.auth.getSession();if(session){
      // Load local cache first for instant UI
      const hadLocal=loadDB();
      if(S.uid){S.route=_deepLink||S.route||'dashboard';_recoverEditingSubmissions();render();}
      const{data:profile}=await sb.from('profiles').select('*').eq('id',session.user.id).single();
      if(profile&&profile.status==='Active'){
        const mapped={id:profile.id,firstName:_unesc(profile.first_name)||'',lastName:_unesc(profile.last_name)||'',email:profile.email||'',phone:_unesc(profile.phone)||'',position:_unesc(profile.position)||'',department:_unesc(profile.department)||'',role:profile.role||'User',status:profile.status,managerId:profile.manager_id||null,rules:profile.rules||{past:true,future:true,edit:true},approval:profile.approval_settings||{past:false,future:false,edited:false},docAccess:profile.doc_access||{departments:{},locations:{}},questionsAccess:profile.questions_access||false,emailEnabled:profile.email_enabled!==false,cities:Array.isArray(profile.cities)?profile.cities:[],hrm:(profile.hrm&&typeof profile.hrm==='object')?profile.hrm:null,password:'***'};
        const idx=DB.users.findIndex(x=>x.id===mapped.id);if(idx>-1)DB.users[idx]=mapped;else DB.users.push(mapped);
        S.uid=mapped.id;
        if(_deepLink)S.route=_deepLink;
        else if(!S.route||S.route==='login')S.route=mapped.role==='Admin'?'dashboard':'mychecklists';
        // CRITICAL: Always load from Supabase FIRST before any sync
        // This prevents empty local state from overwriting real server data
        await loadFromSB();
        saveDB();
        render();
        return;
      }
      await sb.auth.signOut();
    }
    loadDB();S.uid=null;render();
  }catch(e){try{loadDB();}catch(e2){}S.uid=null;render();console.error('Boot error:',e);if(e.message&&!e.message.includes('JWT'))toast('Connection error — check your internet connection','err');}
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

