/* ============================================================
   Bridge — 02-state-roles.js  (split from Bridge.html lines 1171-1315)
   Classic script: shares top-level scope with the other /js files.
   Load order matters — see index.html.
   ============================================================ */
/* ===== STATUS CHIPS ===== */
const CHIP_STYLE={"On Time":"background:#ECFDF5;color:#047857","Submitted":"background:#ECFDF5;color:#047857","Pending":"background:#FFFBEB;color:#B45309","Late":"background:#FFF1F2;color:#BE123C","Pending Approval":"background:#FFF7ED;color:#C2410C","Rejected":"background:#FFF1F2;color:#9F1239","Active":"background:#ECFDF5;color:#047857","Inactive":"background:#F6F7F8;color:#9CA3AF","Approved":"background:#ECFDF5;color:#047857","Editing":"background:#EFF6FF;color:#1D4ED8","Upcoming":"background:#FAF5FF;color:#7E22CE","Draft":"background:#F6F7F8;color:#9CA3AF","Open":"background:#FFF7ED;color:#C2410C","In Progress":"background:#EFF6FF;color:#1D4ED8","Resolved":"background:#ECFDF5;color:#047857","Closed":"background:#F6F7F8;color:#9CA3AF"};
const CHIP_DOT_C={"On Time":"#10B981","Submitted":"#10B981","Pending":"#F59E0B","Late":"#F43F5E","Pending Approval":"#F97316","Rejected":"#9F1239","Active":"#10B981","Inactive":"#D1D5DB","Approved":"#10B981","Editing":"#3B82F6","Upcoming":"#A855F7","Draft":"#9CA3AF","Open":"#F97316","In Progress":"#3B82F6","Resolved":"#10B981","Closed":"#D1D5DB"};
const chip=s=>{const st=CHIP_STYLE[s]||'background:#FFFBEB;color:#B45309';const dot=CHIP_DOT_C[s]||'#F59E0B';return`<span style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:700;${st}"><span style="width:6px;height:6px;border-radius:50%;background:${dot};flex-shrink:0"></span>${esc(s)}</span>`;};


/* ===== DATA MODEL ===== */
let DB={
  departments:[],
  users:[],checklists:[],submissions:[],approvals:[],feedback:[],folders:[],documents:[],locations:[],audit:[],notifications:[],questions:[],tickets:[],okrs:[],okrCheckins:[],okrLogs:[],drafts:[]
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
    ['users','departments','locations','checklists','submissions','approvals','feedback','folders','documents','audit','notifications','questions','checklists_deleted','questions_deleted','folders_deleted','documents_deleted','users_deleted','departments_deleted','locations_deleted','okrs','okrCheckins','okrLogs','drafts'].forEach(k=>{if(!DB[k])DB[k]=[];});
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

