/* ============================================================
   Bridge — 02-state-roles.js  (split from Bridge.html lines 1171-1315)
   Classic script: shares top-level scope with the other /js files.
   Load order matters — see index.html.
   ============================================================ */
/* ===== STATUS CHIPS ===== */
const CHIP_STYLE={"On Time":"background:#E8F7EE;color:#0F7A45","Submitted":"background:#E8F7EE;color:#0F7A45","Pending":"background:#FEFAEC;color:#8A5F00","Late":"background:#FEEEEF;color:#C41E32","Pending Approval":"background:#FFF4EA;color:#B85200","Rejected":"background:#FEEEEF;color:#A0182A","Active":"background:#E8F7EE;color:#0F7A45","Inactive":"background:#F4F9FA;color:#90A5AB","Approved":"background:#E8F7EE;color:#0F7A45","Editing":"background:#EAF2FE;color:#1257B5","Upcoming":"background:#F9F4FE;color:#7E22CE","Draft":"background:#F4F9FA;color:#90A5AB","Open":"background:#FFF4EA;color:#B85200","In Progress":"background:#EAF2FE;color:#1257B5","Resolved":"background:#E8F7EE;color:#0F7A45","Closed":"background:#F4F9FA;color:#90A5AB"};
const CHIP_DOT_C={"On Time":"#17A45C","Submitted":"#17A45C","Pending":"#E0A106","Late":"#F2495B","Pending Approval":"#FF7F11","Rejected":"#A0182A","Active":"#17A45C","Inactive":"#C9D9DD","Approved":"#17A45C","Editing":"#2680EB","Upcoming":"#A855F7","Draft":"#90A5AB","Open":"#FF7F11","In Progress":"#2680EB","Resolved":"#17A45C","Closed":"#C9D9DD"};
const chip=s=>{const st=CHIP_STYLE[s]||'background:#FEFAEC;color:#8A5F00';const dot=CHIP_DOT_C[s]||'#E0A106';return`<span style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:700;${st}"><span style="width:6px;height:6px;border-radius:50%;background:${dot};flex-shrink:0"></span>${esc(s)}</span>`;};


/* ===== DATA MODEL ===== */
let DB={
  departments:[],
  // okrsDeleted (v3.14): ids removed by a cascade delete, kept until the server confirms —
  // stops a failed/lagging delete request resurrecting the subtree on the next refresh.
  users:[],checklists:[],submissions:[],approvals:[],feedback:[],folders:[],documents:[],locations:[],audit:[],notifications:[],questions:[],tickets:[],okrs:[],okrCheckins:[],okrLogs:[],okrsDeleted:[],drafts:[]
};
function log(a,b,c){
  if(!a||!b)return;
  if(DB.audit.length>200)DB.audit.length=200;
  const entry={id:uid('lg'),actor:a,action:b,target:c||'',time:new Date().toISOString()};
  DB.audit.unshift(entry);
  // Write audit log directly to Supabase — use Promise chain not .catch() directly
  sb.from('audit_logs').insert({id:entry.id,actor:entry.actor,action:entry.action,target:entry.target,created_at:entry.time}).then(()=>{}).catch(()=>{});
}

/* ===== LOCALSTORAGE ===== */
const LS_KEY=window.LS_KEY='shiftly_v3';
let _syncTimer=null;
function saveDB(){
  // Always save to localStorage — strip large base64 photos to avoid 5MB limit
  try{
    const dbCopy=JSON.parse(JSON.stringify({DB,uid:S.uid}));
    // Strip base64 photos from submissions to avoid 5MB localStorage limit
    (dbCopy.DB.submissions||[]).forEach(s=>{
      (s.tasks||[]).forEach(t=>{if(t.photo&&t.photo.startsWith('data:'))t.photo='[photo]';});
      // Also strip question response photos (single legacy + multi photos[])
      (s.questionResponses||[]).forEach(r=>{
        if(r.photo&&r.photo.startsWith('data:'))r.photo='[photo]';
        if(Array.isArray(r.photos))r.photos=r.photos.map(p=>(typeof p==='string'&&p.startsWith('data:'))?'[photo]':p);
      });
    });
    // OKR check-in photos: strip base64 the same way (real bytes live in Supabase; targeted writes
    // send them at save time — _okrCheckinRow filters '[photo]' placeholders so they're never pushed).
    (dbCopy.DB.okrCheckins||[]).forEach(c=>{
      if(Array.isArray(c.photos))c.photos=c.photos.map(p=>(typeof p==='string'&&p.startsWith('data:'))?'[photo]':p);
    });
    // Drafts can carry photo URLs/large payloads and are always reloaded fresh from Supabase
    // per user — keep them out of the localStorage cache so they can never blow the 5MB limit.
    dbCopy.DB.drafts=[];
    localStorage.setItem(LS_KEY,JSON.stringify(dbCopy));
  }catch(e){
    // If still too large, save without submissions
    try{const slim={DB:{...DB,submissions:[]},uid:S.uid};localStorage.setItem(LS_KEY,JSON.stringify(slim));}catch(e2){}
  }
  // Debounce Supabase sync — batch rapid changes into one request every 1.5s
  clearTimeout(_syncTimer);
  _syncTimer=setTimeout(()=>{
    _sync().catch(e=>{
      console.warn('[Bridge] Sync error:',e.message);
    });
  },1500);
}
function loadDB(){
  try{
    const r=localStorage.getItem(LS_KEY);
    if(!r)return false;
    const p=JSON.parse(r);if(!p.DB)return false;DB=p.DB;
    ['users','departments','locations','checklists','submissions','approvals','feedback','folders','documents','audit','notifications','questions','checklists_deleted','questions_deleted','folders_deleted','documents_deleted','users_deleted','departments_deleted','locations_deleted','okrs','okrCheckins','okrLogs','okrsDeleted','drafts'].forEach(k=>{if(!DB[k])DB[k]=[];});
    if(!DB.roleProfiles||typeof DB.roleProfiles!=='object')DB.roleProfiles={};
    try{DB.users.forEach(u=>_ensureHrm(u));_seedRoleProfiles();_permsV3Migrate();}catch(e){console.warn('[perms] cache init:',e.message);}
    DB.users.forEach(u=>{
      if(!u.rules)u.rules={past:true,future:true,edit:true};
      // Ensure individual rule fields have proper defaults (true, not false)
      if(u.rules.past===undefined||u.rules.past===null)u.rules.past=true;
      if(u.rules.future===undefined||u.rules.future===null)u.rules.future=true;
      if(u.rules.edit===undefined||u.rules.edit===null)u.rules.edit=true;
      if(!u.approval)u.approval={past:false,future:false,edited:false};
      if(!u.phone)u.phone='';if(!u.position)u.position='';
      if(!u.docAccess)u.docAccess={departments:{},locations:{}};
      if(u.questionsAccess===undefined)u.questionsAccess=false;if(u.emailEnabled===undefined)u.emailEnabled=true;
    });
    S.uid=p.uid||null;return true;
  }catch(e){return false;}
}

/* ===== STATE ===== */
let S={uid:null,route:'dashboard',search:'',calDate:todayISO(),calWk:0,expandedCl:null,filters:{},filterOpen:false,tvUser:null,tvCalDate:null,tvCalWk:0,tvExpanded:null,afOpen:null};

/* ═══════════════ v3.14 — FILTER MEMORY (per tab, survives refresh) ═══════════════
   Until now App.go() did a flat `S.filters={}` on every route change, so setting up
   a filter, stepping into another tab and coming back meant building it all again.
   Each route now keeps its OWN filter bag, and the whole map is persisted to
   localStorage, so filters survive a reload / reopening the browser too.

   Two things are deliberately NOT remembered:
   · open dropdown popovers (okrMSOpen / okrQtrOpen) — reopening the app with a
     menu already hanging open looks broken;
   · bulk-selection ticks (uSel) — coming back tomorrow to 40 silently selected
     rows, one click away from a bulk edit, is worse than forgetting them.
   Everything else — search text, multi-selects, sub-tabs, drill-down state — stays.

   Also not remembered: `aclWk` / `aclDate` — a week OFFSET relative to today. Storing
   "3 weeks back" and replaying it a month later drops you on an unrelated week with no
   Today highlight, so the calendar always reopens on the current week.

   The stored map is stamped with the user id that wrote it. Clearing on logout is not
   enough on its own — people close the browser without signing out, and the next person
   to sign in on that machine would inherit their filters (including other people's ids
   in the owner chips). A uid mismatch discards the whole map.                        */
const FILTERS_KEY='bridge_filters_v1';
const FILTERS_TRANSIENT=['okrMSOpen','okrQtrOpen','uSel','aclWk','aclDate'];
let _filtersByRoute={},_filtersUid=null,_filtersLastWritten='';
try{
  const _fp=JSON.parse(localStorage.getItem(FILTERS_KEY)||'{}')||{};
  // v2 shape is {uid,routes}; anything older is discarded rather than guessed at.
  if(_fp&&_fp.routes&&typeof _fp.routes==='object'){_filtersByRoute=_fp.routes;_filtersUid=_fp.uid||null;}
}catch(e){_filtersByRoute={};_filtersUid=null;}
/* Drop transient keys and empty values so the stored bag stays small and honest —
   an empty array must not count as "a filter is on" when the bar decides to show Clear. */
function _filtersClean(f){
  const out={};
  Object.keys(f||{}).forEach(k=>{
    if(FILTERS_TRANSIENT.indexOf(k)>=0)return;
    const v=f[k];
    if(v===''||v===null||v===undefined||v===false)return;
    if(Array.isArray(v)&&!v.length)return;
    if(typeof v==='object'&&!Array.isArray(v)&&!Object.keys(v).length)return;
    out[k]=v;
  });
  return out;
}
/* Called on every render as well as on route change, so the filters you are looking at
   right now are already on disk when you hit refresh — saving only when LEAVING a tab
   meant the tab you were actually on never got persisted. The written-string check keeps
   the common case (nothing changed) down to one JSON.stringify and no localStorage write. */
function saveFilters(route){
  if(!route||!S.uid)return;
  try{
    const clean=_filtersClean(S.filters);
    if(Object.keys(clean).length)_filtersByRoute[route]=clean;
    else delete _filtersByRoute[route];
    _filtersUid=S.uid;
    const str=JSON.stringify({uid:_filtersUid,routes:_filtersByRoute});
    if(str===_filtersLastWritten)return;
    localStorage.setItem(FILTERS_KEY,str);_filtersLastWritten=str;
  }catch(e){}
}
function restoreFilters(route){
  // Someone else's remembered filters must never be handed to the person signing in now.
  if(S.uid&&_filtersUid&&_filtersUid!==S.uid){clearAllFilters();S.filters={};return;}
  const saved=route&&_filtersByRoute[route];
  try{S.filters=saved?JSON.parse(JSON.stringify(saved)):{};}catch(e){S.filters={};}
}
function clearAllFilters(){_filtersByRoute={};_filtersUid=null;_filtersLastWritten='';S.filters={};try{localStorage.removeItem(FILTERS_KEY);}catch(e){}}
/* Expand/collapse state of the OKR tree rides along with the filters — losing which
   branches were open on every refresh is the same complaint in a different shape.
   Stamped with the user id for the same reason as the filters: the ids of branches one
   person had open must not be written back to disk by whoever signs in next. */
const OKREXP_KEY='bridge_okr_expanded_v1';
function saveOkrExpanded(map){try{localStorage.setItem(OKREXP_KEY,JSON.stringify({uid:S.uid||null,map:map||{}}));}catch(e){}}
function loadOkrExpanded(){
  try{
    const p=JSON.parse(localStorage.getItem(OKREXP_KEY)||'{}')||{};
    if(!p.map||typeof p.map!=='object')return{};
    if(S.uid&&p.uid&&p.uid!==S.uid)return{};
    return p.map;
  }catch(e){return{};}
}
const me=()=>DB.users.find(u=>u.id===S.uid);
// ── Admin standing is DYNAMIC-FIRST (roles-first v3) ──
// A user's admin standing comes from their assigned ROLE PROFILE (u.hrm.roleProfileId),
// NOT the legacy u.role string. Legacy u.role is retained ONLY as (a) a fallback for any
// user not yet migrated to a role profile and (b) first-load routing before profiles load.
// This stops the two systems diverging — the bug where a dynamic "Administrator" (legacy
// SubAdmin, e.g. Mohit) was refused admin-only behaviour because the old string still
// read "SubAdmin". Access Control itself stays separately gated by can('accessControl',…),
// which the Administrator profile omits, so broadening isAdmin() here never leaks it.
const _rpid=u=>(u&&u.hrm&&u.hrm.roleProfileId)||null;
// Super Admin only (the top profile, incl. Access Control). Legacy 'Admin' as fallback.
const isSuperAdmin=()=>{const u=me();if(!u)return false;const id=_rpid(u);return id?id==='superadmin':u.role==='Admin';};
// Full org-wide admin = Super Admin OR Administrator profile. 'Admin' displays as "Super
// Admin"; 'SubAdmin' displays as "Admin" (manager powers + the All Checklists tab).
const isAdmin=()=>{const u=me();if(!u)return false;const id=_rpid(u);return id?(id==='superadmin'||id==='admin'):(u.role==='Admin'||u.role==='SubAdmin');};
const isSubAdmin=()=>{const u=me();if(!u)return false;const id=_rpid(u);return id?id==='admin':u.role==='SubAdmin';};
// (legacy roleLabel removed — the UI shows Access Control role profiles everywhere now)
const hasDocAccess=()=>{const u=me();if(!u)return false;if(isAdmin())return true;const da=u.docAccess||{};return Object.values(da.departments||{}).some(p=>p.view)||Object.values(da.locations||{}).some(p=>p.view);};
function subTree(uid,_seen=new Set()){if(_seen.has(uid))return[];_seen.add(uid);const direct=DB.users.filter(u=>u.managerId===uid&&u.id!==uid);return direct.flatMap(u=>[u,...subTree(u.id,_seen)]);}
// ── Date-aware manager lookup (uses managerHistory; falls back to current managerId) ──
function _mgrOfOn(u,date){
  const h=u?.managerHistory;
  if(Array.isArray(h)&&h.length){
    let hit;for(const p of h){if((p.from||'0001-01-01')<=date&&(!p.to||date<p.to))hit=p;}
    if(hit!==undefined)return hit.managerId||null;
  }
  return u?.managerId||null;
}
// Was user uid2 under mgrId (directly or via chain) on a given date?
function _underOn(uid2,mgrId,date){
  let cur=uById(uid2);let g=0;
  while(cur&&g++<12){
    const m=_mgrOfOn(cur,date);
    if(!m)return false;
    if(m===mgrId)return true;
    cur=uById(m);
  }
  return false;
}
const isMgr=()=>DB.users.some(u=>u.managerId===S.uid&&u.id!==S.uid)&&!isAdmin();
function visU(){if(isAdmin())return DB.users;return[me(),...subTree(S.uid)].filter(Boolean);}
function isDesc(a,b){return subTree(b).some(u=>u.id===a);}
const uById=id=>DB.users.find(u=>u.id===id);
const clById=id=>DB.checklists.find(c=>c.id===id);
const locById=id=>DB.locations.find(l=>l.id===id);
function myCls(uid,date){
  const assigned=DB.checklists.filter(c=>(c.assignees||[]).includes(uid)&&clOn(c,date));
  // Sort by deadline time (earlier first), then by name
  return assigned.sort((a,b)=>{
    const ta=a.scheduleTime||'99:99',tb=b.scheduleTime||'99:99';
    if(ta!==tb)return ta.localeCompare(tb);
    return (a.name||'').localeCompare(b.name||'');
  });
}
const subFor=(clId,uid,date)=>DB.submissions.find(s=>s.checklistId===clId&&s.userId===uid&&s.date===date);
// Checklist-aware lookup: own submission first; in "any one can complete" mode,
// a completed submission by ANY assignee counts for everyone (someone else's mid-edit doesn't block you)
const subForCl=(c,uid,date)=>{
  const own=subFor(c.id,uid,date);
  if(own||!c.anyOne)return own||null;
  return DB.submissions.find(s=>s.checklistId===c.id&&s.date===date&&s.status!=='Editing')||null;
};

