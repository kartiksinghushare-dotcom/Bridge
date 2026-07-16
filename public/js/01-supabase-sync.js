/* ============================================================
   Bridge — 01-supabase-sync.js  (split from Bridge.html lines 826-1170)
   Classic script: shares top-level scope with the other /js files.
   Load order matters — see index.html.
   ============================================================ */
/* ===== SUPABASE CLIENT ===== */
const SB_URL='https://bxuhmyxfzoqvmukausjd.supabase.co';
const SB_ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4dWhteXhmem9xdm11a2F1c2pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxODgxMTgsImV4cCI6MjA5NDc2NDExOH0._-WHdcw2p1LR09imPkfGx7F7VfqwHJHkcW6b0hSD00k';
const sb=supabase.createClient(SB_URL,SB_ANON,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
function _unesc(s){if(!s)return s;return String(s).replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");}
const _mQrow=q=>({id:q.id,text:q.text||'',type:q.type||'answer',options:q.options||[],photo:q.photo||false,approval:q.approval||false,comment:q.comment||false,isPublic:q.is_public!==false,createdBy:q.created_by||null,createdAt:q.created_at,departmentId:q.department_id||null,subDepartmentId:q.sub_department_id||null});
function _mU(r){return(r||[]).map(p=>({id:p.id,firstName:_unesc(p.first_name)||'',lastName:_unesc(p.last_name)||'',email:p.email||'',phone:_unesc(p.phone)||'',position:_unesc(p.position)||'',department:_unesc(p.department)||'',role:p.role||'User',status:p.status||'Active',managerId:p.manager_id||null,managerHistory:p.manager_history||[],rules:p.rules||{past:true,future:true,edit:true},approval:p.approval_settings||{past:false,future:false,edited:false},docAccess:p.doc_access||{departments:{},locations:{}},questionsAccess:p.questions_access||false,emailEnabled:p.email_enabled!==false,cities:Array.isArray(p.cities)?p.cities:[],hrm:(p.hrm&&typeof p.hrm==='object')?p.hrm:null,password:'***'}));}
function _mC(r){return(r||[]).map(c=>({id:c.id,name:c.name||'',description:c.description||'',department:c.department||'',subDepartment:c.sub_department||'',frequency:c.frequency||'Daily',schedule:c.schedule||'',selectedDays:c.selected_days||[],selectedDates:(c.selected_dates||[]).map(x=>x==='L'?'L':Number(x)),customDates:c.custom_dates||[],startDate:c.start_date||'',endDate:c.end_date||'',locationIds:c.location_ids||[],assignees:c.assignees||[],tasks:c.tasks||[],questionIds:c.question_ids||[],questionConfigs:(()=>{const raw=c.question_configs||{};const fixed={};Object.keys(raw).forEach(k=>{const clean=k.startsWith('"')&&k.endsWith('"')?JSON.parse(k):k;fixed[clean]=raw[k];});return fixed;})(),scheduleTime:c.schedule_time||null,status:c.status||'Active',anyOne:c.any_one||false,createdBy:c.created_by||null}));}
function _mDraft(r){return{id:r.id,checklistId:r.checklist_id,userId:r.user_id,date:r.date,questionResponses:r.question_responses||[],tasks:r.tasks||[],updatedAt:r.updated_at||null};}
function _mS(r){return(r||[]).map(s=>({id:s.id,checklistId:s.checklist_id,userId:s.user_id,date:s.date,status:s.status||'Pending',submittedAt:s.submitted_at||null,tasks:s.tasks||[],questionResponses:s.question_responses||[],editCount:s.edit_count||0,editHistory:s.edit_history||[],checklistDeleted:s.checklist_deleted||false}));}
function _mA(r){return(r||[]).map(a=>({id:a.id,type:a.type||'Submission',requesterId:a.requester_id,checklistId:a.checklist_id||null,date:a.date||null,status:a.status||'Pending',note:a.note||'',createdAt:a.created_at,isResubmit:a.is_resubmit||false,usedAt:a.used_at||null}));}
/* ===== Egress-reduction helpers: 30-day windowing + lazy per-tab loading ===== */
const _DAY_MS=24*60*60*1000;
function _cutoff30ISO(){return new Date(Date.now()-30*_DAY_MS).toISOString();}
function _cutoff30Date(){return _cutoff30ISO().slice(0,10);}
function _mapTk(rows){return(rows||[]).map(t=>({id:t.id,title:t.title||'',description:t.description||'',priority:t.priority||'Medium',status:t.status||'Open',assignedTo:t.assigned_to||null,createdBy:t.created_by||null,checklistId:t.checklist_id||null,questionId:t.question_id||null,questionText:t.question_text||'',answerGiven:t.answer_given||'',submitterId:t.submitter_id||null,date:t.date||null,createdAt:t.created_at,resolvedAt:t.resolved_at||null,resolveNote:t.resolve_note||'',viewedBy:t.viewed_by||[],updatedAt:t.updated_at||null,reopenCount:t.reopen_count||0,occurrences:t.occurrences||[]}));}
function _roleCtx(){const _uid=S.uid;const _isAdmin=isAdmin();const _isSubAdmin=isSubAdmin();const _isMgr=isMgr();const _teamIds=(_isMgr&&!_isAdmin)?new Set([_uid,...subTree(_uid).map(u=>u.id)]):null;return{_uid,_isAdmin,_isSubAdmin,_isMgr,_teamIds};}
// Apply helpers — shared by the startup bulk load AND the lazy per-tab loaders so the
// role-based visibility filtering can never drift between the two paths.
function _applySubmissions(subs,{merge=false}={}){
  const {_uid,_isAdmin,_isSubAdmin,_isMgr,_teamIds}=_roleCtx();
  const allSubs=_mS(subs||[]);
  let visible;
  if(_isAdmin||_isSubAdmin){visible=allSubs;}
  else if(_isMgr){const _grpIds=new Set(DB.checklists.filter(c=>c.anyOne&&(c.assignees||[]).includes(_uid)).map(c=>c.id));visible=allSubs.filter(s=>_teamIds.has(s.userId)||_grpIds.has(s.checklistId));}
  else{const _grpIds=new Set(DB.checklists.filter(c=>c.anyOne&&(c.assignees||[]).includes(_uid)).map(c=>c.id));visible=allSubs.filter(s=>s.userId===_uid||_grpIds.has(s.checklistId));}
  if(merge){const byId=new Map((DB.submissions||[]).map(s=>[s.id,s]));visible.forEach(s=>byId.set(s.id,s));DB.submissions=[...byId.values()];}
  else{DB.submissions=visible;}
}
function _applyApprovals(appr){
  const {_uid,_isAdmin,_isSubAdmin,_isMgr,_teamIds}=_roleCtx();
  const allAppr=_mA(appr||[]);
  if(_isAdmin||_isSubAdmin){DB.approvals=allAppr;}
  else if(_isMgr){DB.approvals=allAppr.filter(a=>_teamIds.has(a.requesterId)||a.requesterId===_uid);}
  else{DB.approvals=allAppr.filter(a=>a.requesterId===_uid);}
}
function _applyNotifications(notifs){
  const _uid=S.uid;
  DB.notifications=(notifs||[]).filter(n=>n.user_id===_uid).map(n=>({id:n.id,userId:n.user_id,text:n.text||'',read:n.read||false,time:n.created_at}));
}
function _applyFeedback(feedbackRows){
  if(!feedbackRows){DB.feedback=DB.feedback||[];return;}
  const {_uid,_isAdmin,_isSubAdmin,_isMgr,_teamIds}=_roleCtx();
  const allFb=feedbackRows.map(fb=>({id:fb.id,checklistId:fb.checklist_id||null,userId:fb.user_id,managerId:fb.manager_id,date:fb.date||null,title:fb.title||null,type:fb.type||'General',text:fb.text||'',priority:fb.priority||'Low',taskName:fb.task_name||null,level:fb.level||'direct',status:fb.status||'Sent',acknowledged:fb.acknowledged||false,acknowledgedAt:fb.acknowledged_at||null,reply:fb.reply||null,repliedAt:fb.replied_at||null,replies:fb.replies||[],createdAt:fb.created_at}));
  if(_isAdmin||_isSubAdmin){DB.feedback=allFb;}
  else if(_isMgr){DB.feedback=allFb.filter(fb=>fb.managerId===_uid||_teamIds.has(fb.userId));}
  else{DB.feedback=allFb.filter(fb=>fb.userId===_uid);}
}
function _applyFolders(docFolderRows){
  if(!docFolderRows)return;
  const _delFolders=new Set(DB.folders_deleted||[]);
  DB.folders=docFolderRows.filter(f=>!_delFolders.has(f.id)).map(f=>({id:f.id,name:f.name,parentId:f.parent_id||null,type:f.type,scope:f.scope,createdBy:f.created_by||null,createdAt:f.created_at}));
}
function _applyDocuments(docRows){
  if(!docRows)return;
  const _delDocs=new Set(DB.documents_deleted||[]);
  DB.documents=docRows.filter(d=>!_delDocs.has(d.id)).map(d=>({id:d.id,name:d.name,folderId:d.folder_id||null,type:d.type,scope:d.scope,url:d.url,storagePath:d.storage_path||null,fileType:d.fileType||null,fileSize:d.file_size||null,uploadedBy:d.uploaded_by||null,uploaderName:d.uploader_name||null,uploadedAt:d.uploaded_at}));
}
function _applyTickets(rows){
  const {_uid,_isAdmin,_isSubAdmin}=_roleCtx();
  // Deleted-overlay: ids the user deleted locally are never re-shown, even if a slow/stale
  // server read still returns them. Mirrors DB.checklists_deleted / DB.questions_deleted.
  const _delTk=new Set(DB.tickets_deleted||[]);
  const allTk=_mapTk(rows||[]).filter(t=>!_delTk.has(t.id));
  // Admin/subadmin see all; everyone else only tickets assigned to them.
  const visible=(_isAdmin||_isSubAdmin)?allTk:allTk.filter(t=>t.assignedTo===_uid);
  // Keep any local-only tickets (just created, or older than the 30-day window) that the
  // server query didn't return — never drop them (but never re-add a deleted one).
  const fromSB=new Set(allTk.map(t=>t.id));
  const localOnly=(DB.tickets||[]).filter(t=>!fromSB.has(t.id)&&!_delTk.has(t.id));
  // ── v2 FIX: never let a server snapshot clobber a ticket that still has queued local
  //    writes (e.g. it was closed while the session was stale — the close sits in the
  //    sync-queue but hasn't reached the server yet). Server wins for everything else.
  const _pend=typeof pendingWriteIds==='function'?pendingWriteIds('tickets'):new Set();
  const merged=_pend.size?visible.map(sv=>{if(_pend.has(sv.id)){const loc=(DB.tickets||[]).find(t=>t.id===sv.id);return loc||sv;}return sv;}):visible;
  DB.tickets=[...merged,...localOnly];
  _invalidateNotifCache();
}

// Per-tab lazy loaders — fetch only the opened tab's data (last 30 days), nothing on a timer.
let _tabLoading={};
/* ── PORTED: sync bar + tab-loading helpers (Safe Backup) ── */
function _anyLoading(){try{return Object.values(_tabLoading||{}).some(Boolean);}catch(e){return false;}}
function _syncBar(on){try{let b=document.getElementById('syncbar');if(!b){if(!on)return;b=document.createElement('div');b.id='syncbar';document.body.appendChild(b);}b.classList.toggle('on',!!on);}catch(e){}}
async function _lazyLoad(kind){
  if(!S.uid||document.visibilityState==='hidden'||_tabLoading[kind])return;
  _tabLoading[kind]=true;_syncBar(true);
  // Safety net (ported): never let a slow/hung request trap a tab on a loading skeleton forever.
  const _loadTO=setTimeout(()=>{if(_tabLoading[kind]){_tabLoading[kind]=false;_syncBar(_anyLoading());try{rr();}catch(e){}}},9000);
  try{
    const c=_cutoff30ISO();
    if(kind==='tickets'){const{data,error}=await sb.from('tickets').select('*').or('created_at.gte.'+c+',status.in.("Open","In Progress")').order('created_at',{ascending:false});if(error){console.error('[TK] lazy error:',error.message);}else _applyTickets(data);}
    else if(kind==='approvals'){const{data,error}=await sb.from('approvals').select('*').gte('created_at',c).order('created_at',{ascending:false});if(!error)_applyApprovals(data);}
    else if(kind==='notifications'){const{data,error}=await sb.from('notifications').select('*').gte('created_at',c).order('created_at',{ascending:false});if(!error)_applyNotifications(data);}
    else if(kind==='feedback'){const{data,error}=await sb.from('feedback').select('*').gte('created_at',c).order('created_at',{ascending:false});if(!error)_applyFeedback(data);}
    else if(kind==='documents'){const r=await Promise.all([sb.from('documents').select('*').gte('uploaded_at',c).order('uploaded_at',{ascending:false}),sb.from('doc_folders').select('*').order('created_at',{ascending:false})]);if(!r[0].error)_applyDocuments(r[0].data);if(!r[1].error)_applyFolders(r[1].data);}
    else if(kind==='checklists'){
      // Checklist & question DEFINITIONS refresh — fixes edits by one user (e.g. a manager adding a
      // question) not reaching other users' open sessions until a full reload.
      const r=await Promise.all([sb.from('checklists').select('*').order('created_at',{ascending:false}),sb.from('questions').select('*').order('created_at',{ascending:false})]);
      if(!r[0].error&&r[0].data){const _delCls=new Set(DB.checklists_deleted||[]);DB.checklists=_mC(r[0].data).filter(c=>!_delCls.has(c.id));}
      if(!r[1].error&&r[1].data){const _delQs=new Set(DB.questions_deleted||[]);DB.questions=r[1].data.filter(q=>!_delQs.has(q.id)).map(_mQrow);}
    }
    else if(kind==='okr'){const r=await Promise.all([sb.from('okrs').select('*').order('created_at',{ascending:true}),sb.from('okr_checkins').select('*').order('date',{ascending:true}),sb.from('okr_logs').select('*').order('created_at',{ascending:false}).limit(800)]);if(!r[0].error)DB.okrs=_mOKR(r[0].data);if(!r[1].error)DB.okrCheckins=_mOKRCheckin(r[1].data);if(!r[2].error)DB.okrLogs=_mOKRLog(r[2].data);}
    saveDB();rr();
  }catch(e){console.warn('[lazyLoad]',kind,e.message);}
  finally{clearTimeout(_loadTO);_tabLoading[kind]=false;_syncBar(_anyLoading());}
}
async function _lazyLoadDate(view){
  if(!S.uid||document.visibilityState==='hidden')return;
  let d;
  if(view==='mychecklists')d=S.calDate||todayISO();
  else if(view==='teamview')d=S.tvCalDate||todayISO();
  else if(view==='allcl')d=(S.filters&&S.filters.aclDate)||todayISO();
  if(!d)return;
  const key='subs:'+d;
  if(_tabLoading[key])return;_tabLoading[key]=true;
  try{
    const{data,error}=await sb.from('submissions').select('*').eq('date',d).order('submitted_at',{ascending:false});
    if(!error){_applySubmissions(data,{merge:true});saveDB();rr();}
  }catch(e){console.warn('[lazyLoadDate]',e.message);}
  finally{_tabLoading[key]=false;}
}
// Refresh only the active route's data — used on navigation and when the tab regains focus.
function _lazyForRoute(r){
  if(document.visibilityState==='hidden'||!S.uid)return;
  if(r==='tickets')_lazyLoad('tickets');
  else if(r==='approvals')_lazyLoad('approvals');
  else if(r==='notifications'){_lazyLoad('notifications');_lazyLoad('feedback');}
  else if(r==='departments'||r==='locations')_lazyLoad('documents');
  else if(r==='mychecklists'){_lazyLoad('checklists');_lazyLoadDate('mychecklists');}
  else if(r==='teamview'){_lazyLoad('checklists');_lazyLoadDate('teamview');}
  else if(r==='allcl'){_lazyLoad('checklists');_lazyLoadDate('allcl');_lazyLoadDate('teamview');}
  else if(r==='dashboard'){_lazyLoad('tickets');_lazyLoad('checklists');_lazyLoadDate('mychecklists');}
  else if(r==='okr')_lazyLoad('okr');
}

async function loadFromSB(){
  // Check and refresh session before queries — prevents 401 on stale tokens
  try{
    const {data:{session},error}=await sb.auth.getSession();
    if(error||!session){
      const {data:refreshData,error:refreshErr}=await sb.auth.refreshSession();
      if(refreshErr||!refreshData?.session){
        console.warn('[auth] no valid session, skipping loadFromSB');
        return; // Don't loop — user needs to log in again
      }
    }
  }catch(e){console.warn('[auth] session check:',e.message);}

  // Egress control: the big tables load only the last 30 days at startup. Older rows stay
  // in the DB and load on demand when the user opens that day/tab. Small reference tables
  // (departments, locations, checklists, audit_logs, profiles, doc_folders, questions) load fully.
  const _c30=_cutoff30ISO(), _c30d=_cutoff30Date();
  let depts,locs,allCls,subs,appr,audit,notifs,profiles,feedbackRows,docFolderRows,docRows,qRows,okrRows,okrCiRows,okrLogRows,rpRows;
  try{
    const res=await Promise.all([
      sb.from('departments').select('*').order('name'),
      sb.from('locations').select('*').order('name'),
      sb.from('checklists').select('*').order('created_at',{ascending:false}),
      sb.from('submissions').select('*').gte('date',_c30d).order('submitted_at',{ascending:false}),
      sb.from('approvals').select('*').gte('created_at',_c30).order('created_at',{ascending:false}),
      sb.from('audit_logs').select('*').order('created_at',{ascending:false}).limit(300),
      sb.from('notifications').select('*').gte('created_at',_c30).order('created_at',{ascending:false}),
      sb.from('profiles').select('*').order('first_name'),
      sb.from('feedback').select('*').gte('created_at',_c30).order('created_at',{ascending:false}),
      sb.from('doc_folders').select('*').order('created_at',{ascending:false}),
      sb.from('documents').select('*').gte('uploaded_at',_c30).order('uploaded_at',{ascending:false}),
      sb.from('questions').select('*').order('created_at',{ascending:false}),
      sb.from('okrs').select('*').order('created_at',{ascending:true}),
      sb.from('okr_checkins').select('*').order('date',{ascending:true}),
      sb.from('okr_logs').select('*').order('created_at',{ascending:false}).limit(800),
      sb.from('workspace_settings').select('*').eq('key','role_profiles'),
    ]);
  [depts,locs,allCls,subs,appr,audit,notifs,profiles,feedbackRows,docFolderRows,docRows,qRows,okrRows,okrCiRows,okrLogRows,rpRows]=res.map(r=>r.data||[]);
  }catch(e){
    console.error('loadFromSB failed:',e.message);
    return; // Keep existing cached data
  }
  // ── Role-based IDs for filtering ──
  // NOTE: DB.users is populated below from profiles, but we need it for subTree.
  // Use the already-loaded DB.users from local cache for role checks here.
  const _uid=S.uid;
  const _isAdmin=isAdmin();
  const _isSubAdmin=isSubAdmin();
  const _isMgr=isMgr();
  const _teamIds=(_isMgr&&!_isAdmin)?new Set([_uid,...subTree(_uid).map(u=>u.id)]):null;

  // ── Departments + Locations: everyone sees all ──
  const _delDepts=new Set(DB.departments_deleted||[]);
  DB.departments=(depts||[]).filter(d=>!_delDepts.has(d.id)).map(d=>({id:d.id,name:d.name,parentId:d.parent_id||null}));
  const _delLocs=new Set(DB.locations_deleted||[]);
  DB.locations=(locs||[]).filter(l=>!_delLocs.has(l.id)).map(l=>({id:l.id,name:l.name,address:l.address||'',department:l.department||'',status:l.status||'Active'}));

  // ── Checklists ──
  {
    const _delCls=new Set(DB.checklists_deleted||[]);
    const mapped=_mC(allCls||[]).filter(c=>!_delCls.has(c.id));
    // IDs that came back from Supabase this load
    const _serverIds=new Set(mapped.map(c=>c.id));
    // Local checklists the current user owns that have NOT yet arrived from the server
    // (e.g. an upsert that hasn't completed yet, or one blocked by RLS). These must NOT
    // be wiped on refresh — keep them so the user never loses a checklist they just made.
    const _localPending=(DB.checklists||[]).filter(c=>
      !_serverIds.has(c.id)&&!_delCls.has(c.id)&&
      (c.createdBy===_uid||(c.assignees||[]).includes(_uid))
    );
    let _visible;
    if(mapped.length===0&&DB.checklists.length>0){
      // Nothing from Supabase — keep local cache (RLS may be blocking)
      _visible=DB.checklists.filter(c=>!_delCls.has(c.id));
    } else if(_isAdmin||_isSubAdmin){
      _visible=mapped;
    } else if(_isMgr){
      // Manager: checklists he created OR assigned to him OR assigned to his team
      _visible=mapped.filter(c=>c.createdBy===_uid||(c.assignees||[]).includes(_uid)||(_teamIds&&(c.assignees||[]).some(a=>_teamIds.has(a))));
    } else {
      // User: checklists assigned to them OR created by them
      _visible=mapped.filter(c=>(c.assignees||[]).includes(_uid)||c.createdBy===_uid);
    }
    // Merge in any local-only checklists the server didn't return, de-duplicated by id.
    const _seen=new Set(_visible.map(c=>c.id));
    DB.checklists=[..._visible,..._localPending.filter(c=>!_seen.has(c.id))];
  }

  // ── Submissions (role filtering via shared helper) ──
  _applySubmissions(subs);

  // ── Approvals (role filtering via shared helper) ──
  _applyApprovals(appr);

  // ── Audit logs: admin + subadmin ──
  if(_isAdmin||_isSubAdmin){
    DB.audit=(audit||[]).map(l=>({id:l.id,actor:l.actor||'',action:l.action||'',target:l.target||'',time:l.created_at}));
  } else {
    DB.audit=[];
  }

  // ── Notifications: always only for this user (shared helper) ──
  _applyNotifications(notifs);
  // ── Profiles (users): always load ALL users ──
  // subTree(), fullName(), uById(), avatar(), checklist assignee picker all need full user list.
  // Role-based visibility is enforced at the page/UI level, not by restricting DB.users.
  {
    const _savedQAccess={};DB.users.forEach(u=>{if(u.questionsAccess)_savedQAccess[u.id]=true;});
    const _delUsers=new Set(DB.users_deleted||[]);
    DB.users=_mU(profiles).filter(u=>!_delUsers.has(u.id));
    DB.users.forEach(u=>{if(!u.questionsAccess&&_savedQAccess[u.id])u.questionsAccess=true;});
  }

  // ── PORTED (Safe Backup): OKR data + role profiles + role migration ──
  DB.users.forEach(u=>_ensureHrm(u));
  DB.okrs=_mOKR(okrRows);DB.okrCheckins=_mOKRCheckin(okrCiRows);DB.okrLogs=_mOKRLog(okrLogRows);
  try{const _rpRow=(rpRows&&rpRows[0])||null;if(_rpRow&&_rpRow.value&&typeof _rpRow.value==='object')DB.roleProfiles={...(DB.roleProfiles||{}),..._rpRow.value};}catch(e){}
  _seedRoleProfiles();
  try{_permsV3Migrate();}catch(e){console.warn('[perms] migrate skipped:',e.message);}

  // ── One-time self-heal: legacy duplicate root departments (unused copies of Operations'
  //    sub-departments) get resurrected by stale sessions' whole-table sync. Drop them from
  //    memory (so this client never re-pushes them) and delete server-side (idempotent).
  try{
    const _dupIds=['d_v3smuwi','d_fq9j44a'];
    if((DB.departments||[]).some(d=>_dupIds.includes(d.id))){
      DB.departments=DB.departments.filter(d=>!_dupIds.includes(d.id));
      sb.from('departments').delete().in('id',_dupIds).then(()=>{}).catch(()=>{});
    }
  }catch(e){}

  // ── Questions: load ALL for everyone — needed so checklist cards can show questions ──
  // Questions tab visibility is controlled by nav (users have no tab, manager needs questionsAccess)
  // Questions tab content is filtered by createdBy in questionsPage()
  if(qRows){
    const _delQs=new Set(DB.questions_deleted||[]);
    DB.questions=qRows.filter(q=>!_delQs.has(q.id)).map(_mQrow);
  }

  // ── Feedback: role-scoped (shared helper, last-30-day window) ──
  _applyFeedback(feedbackRows);

  // ── Documents + Folders: everyone sees all (access controlled by scope in UI) ──
  _applyFolders(docFolderRows);
  _applyDocuments(docRows);

  // ── Tickets: last 30 days, role-filtered via shared helper ──
  sb.from('tickets').select('*').or('created_at.gte.'+_cutoff30ISO()+',status.in.("Open","In Progress")').order('created_at',{ascending:false})
    .then(({data,error})=>{
      if(error){console.error('[TK] error:',error.message);return;}
      _applyTickets(data);saveDB();rr();
    }).catch(e=>console.error('[TK] fetch failed:',e.message));
  // ── Drafts: this user's own in-progress checklist drafts (personal, syncs across devices) ──
  sb.from('submission_drafts').select('*').eq('user_id',S.uid)
    .then(({data,error})=>{
      if(error){console.warn('[draft] load error:',error.message);return;}
      DB.drafts=(data||[]).map(_mDraft);
      // Seed any freshly-opened (still-empty) RUN with its saved draft so progress shows up.
      DB.drafts.forEach(d=>{
        const r=RUN[d.checklistId];
        if(r&&r.date===d.date&&r.status!=='Editing'&&(!r.questionResponses||!r.questionResponses.length)){
          r.questionResponses=JSON.parse(JSON.stringify(d.questionResponses||[]));
          r.tasks=d.tasks||[];
        }
      });
      rr();
    }).catch(e=>console.warn('[draft] fetch failed:',e&&e.message));
}
/* ── v2: background mirror helper — only POSTs a table when its payload actually
   changed since the last successful mirror (kills the constant re-upsert noise). ── */
function _mirror(table,rows){
  window._syncHashes=window._syncHashes||{};
  const h=JSON.stringify(rows);
  if(window._syncHashes[table]===h)return Promise.resolve({skipped:true});
  return sb.from(table).upsert(rows,{onConflict:'id'}).then(r=>{if(!r||!r.error)window._syncHashes[table]=h;return r;});
}
async function _sync(){try{
  const results=await Promise.allSettled([
    _mirror('departments',DB.departments.map(d=>({id:d.id,name:d.name,parent_id:d.parentId||null}))),
    _mirror('locations',DB.locations.map(l=>({id:l.id,name:l.name,address:l.address||'',department:l.department||'',status:l.status||'Active'}))),
    // ⚠ Checklists are intentionally NOT mirrored in this background whole-table sync.
    //   This upsert used to let a stale second browser silently overwrite a checklist another
    //   user had just edited (e.g. reverting a question count back up → the "Mohit sees 15,
    //   Wendy sees 16" bug). Checklists are now written ONLY through their own confirmed saves
    //   (_saveCl / dupCl / delCl / delUser / delDept), which are race-safe.
    // ⚠ tasks & question_responses are intentionally OMITTED from this background mirror. A
    //   PostgREST upsert only updates the columns it sends, so omitting these two means a stale
    //   second browser (e.g. a manager who opened the submission before its photos finished
    //   uploading) can no longer overwrite the durable photo URLs with '[photo]'. These fields
    //   are written only by the submitter's own confirmed submit / resubmit (targeted upsert).
    _mirror('submissions',DB.submissions.map(s=>({id:s.id,checklist_id:s.checklistId,user_id:s.userId,date:s.date,status:s.status,submitted_at:s.submittedAt||null,edit_count:s.editCount||0,edit_history:s.editHistory||[]}))),
    _mirror('approvals',DB.approvals.map(a=>({id:a.id,type:a.type||'Submission',requester_id:a.requesterId,checklist_id:a.checklistId||null,date:a.date||null,status:a.status,note:a.note||'',is_resubmit:a.isResubmit||false,used_at:a.usedAt||null}))),
    _mirror('audit_logs',DB.audit.slice(0,200).map(l=>({id:l.id,actor:l.actor,action:l.action,target:l.target||''}))),
    _mirror('notifications',DB.notifications.map(n=>({id:n.id,user_id:n.userId,text:n.text,read:n.read||false,created_at:n.time||new Date().toISOString()}))),
    _mirror('feedback',(DB.feedback||[]).map(fb=>({id:fb.id,checklist_id:fb.checklistId||null,user_id:fb.userId,manager_id:fb.managerId,date:fb.date||null,title:fb.title||null,type:fb.type||'General',text:fb.text||'',priority:fb.priority||'Low',task_name:fb.taskName||null,level:fb.level||'direct',status:fb.status||'Sent',acknowledged:fb.acknowledged||false,acknowledged_at:fb.acknowledgedAt||null,reply:fb.reply||null,replied_at:fb.repliedAt||null,replies:fb.replies||[],created_at:fb.createdAt||new Date().toISOString()}))),
    _mirror('doc_folders',(DB.folders||[]).map(f=>({id:f.id,name:f.name,parent_id:f.parentId||null,type:f.type,scope:f.scope,created_by:f.createdBy||null,created_at:f.createdAt}))),
    _mirror('documents',(DB.documents||[]).map(d=>({id:d.id,name:d.name,folder_id:d.folderId||null,type:d.type,scope:d.scope,url:d.url,storage_path:d.storagePath||null,file_type:d.fileType||null,file_size:d.fileSize||null,uploaded_by:d.uploadedBy||null,uploader_name:d.uploaderName||null,uploaded_at:d.uploadedAt}))),
    // ⚠ Questions are intentionally NOT mirrored in this background whole-table sync.
    //   This upsert used to let a stale second browser (a) resurrect a question that another
    //   user had just deleted and (b) wipe department_id / sub_department_id that another user
    //   had just set (→ "department resets to unassigned on refresh"). Questions are now written
    //   ONLY through their own confirmed saves (_saveQuestion / _delQuestion / _importQCSV /
    //   _togQPublic), so a stale cache can no longer overwrite or resurrect them.
    // ⚠ Tickets are intentionally NOT mirrored in this background whole-table sync.
    //   This bulk upsert used to let a stale second browser resurrect a ticket that another
    //   admin had just deleted (the "delete a ticket → it comes back" bug). Tickets are now
    //   written ONLY through their own confirmed writes — escalation insert (direct), resolve/
    //   status/viewed_by updates, and _delTicket (delete + DB.tickets_deleted overlay) — so a
    //   stale cache can no longer recreate a deleted ticket.
  ]);
  // Background full-DB mirror. Row-level-security will reject rows owned by other users
  // (notifications, audit_logs, feedback, etc.) — that is expected and harmless, because all
  // user-facing writes go through confirmed per-record saves that report their own errors.
  // So we log these quietly and DON'T alarm the user with a toast.
  const failed=results.filter(r=>r.status==='rejected'||(r.value&&r.value.error));
  if(failed.length){
    const msg=failed.map(r=>(r.reason&&r.reason.message)||(r.value&&r.value.error&&r.value.error.message)||'').filter(Boolean).join(', ');
    console.warn('[Bridge sync] '+failed.length+' background table(s) skipped (non-blocking):',msg);
  }
}catch(e){console.warn('[Bridge sync error]',e.message);}}

