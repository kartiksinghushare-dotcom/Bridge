/* ============================================================
   Bridge — 19-okr-roles-acl.js  (split from Bridge.html lines 6860-8376)
   Classic script: shares top-level scope with the other /js files.
   Load order matters — see index.html.
   ============================================================ */
/* ── PORTED: chart registry shim (OKR progress charts; Chart.js loaded in <head>) ── */
let _aCharts=[];
function _destroyACharts(){_aCharts.forEach(c=>{try{c.destroy();}catch(e){}});_aCharts=[];}


/* ═══ PORTED: shared helpers required by AC/OKR modules (Safe Backup) ═══ */
function _isRlsErr(e){const m=(e&&(e.message||e.error_description||''))+'';return /row-level security|permission denied|violates|not authorized|forbidden|RLS/i.test(m);}
// .catch / .then-error handler for a TARGETED write. Returns a fn so it can be passed directly to .catch.
function _syncErr(label){return (e)=>{
  console.warn('[sync]',label,e?.message||e);
  const rls=_isRlsErr(e);
  toast(rls?('Couldn\'t save '+(label||'changes')+' — you may not have permission'):('Couldn\'t save '+(label||'changes')+' — check your connection'),'err');
};}
// Surface a caught exception from a user-initiated operation (validation already toasts its own message).
function _opErr(e,ctx){console.warn('[op]',ctx,e?.message||e);toast((ctx?(ctx+' failed'):'Something went wrong')+(_isRlsErr(e)?' — permission denied':''),'err');}
/* chipBar(items,activeKey,fnName,opts) — ONE tab/segment bar.
   items: [[key,label,count?],...]  fnName is a STRING like 'App.x' called as fnName('key').
   opts.style: 'segment'(default)|'pill'. Preserves existing onclick strings via fnName. */
function modalShell({title='',sub='',body='',footer='',size='max-w-lg',key=''}={}){
  openModal(`<div style="position:sticky;top:0;z-index:2;background:var(--c-surface);border-bottom:1px solid var(--c-border);padding:16px 20px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;border-radius:20px 20px 0 0">
    <div style="min-width:0"><h2 class="fd" style="font-size:18px;font-weight:800;color:var(--c-text)">${esc(title)}</h2>${sub?`<p style="font-size:13px;color:var(--c-text-2);margin-top:2px">${esc(sub)}</p>`:''}</div>
    <button type="button" onclick="App.closeModal()" aria-label="Close" style="flex-shrink:0;width:34px;height:34px;border-radius:10px;border:none;background:var(--c-surface-2);color:var(--c-text-2);cursor:pointer;display:grid;place-items:center">${ic('x','w-4 h-4')}</button>
  </div>
  <div style="padding:20px">${body}</div>
  ${footer?`<div style="position:sticky;bottom:0;background:var(--c-surface);border-top:1px solid var(--c-border);padding:14px 20px;display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap">${footer}</div>`:''}`,size,{key});
}
const HOW={
  dashboard:{t:'Your day at a glance: who\'s in, what needs you, and quick actions. Most people never need another tab.',d:['Clock in/out here — it feeds Attendance and Payroll automatically.','“Mark today as WFH” tags your attendance for reports and payslips.','Cards show today\'s checklists, leave status and OKR check-ins — tap any to act.'],l:[['mychecklists','My Checklists'],['approvals','Approvals']]},
  mychecklists:{t:'Everything assigned to YOU, day by day. Pick a date on the strip; submit each card.',d:['Miss the due time → the card turns LATE (red) and analytics record it.','Whether you may submit past/future dates or edit comes from your Personal settings.','Scheduled OKR check-ins appear here as one combined card on their due day.'],l:[['okr','OKRs'],['approvals','Approvals']]},
  tickets:{t:'Issues raised by people or auto-created when a checklist answer breaches a rule.',d:['Bad answers on escalation questions open tickets automatically and re-escalate while open.','Resolve with a note — the submitter is notified.'],l:[['mychecklists','My Checklists'],['questions','Questions']]},
  teamview:{t:'Live board of your team: today\'s checklist status, lates and open tickets per person. Click someone to drill into their calendar.',l:[['users','Users'],['approvals','Approvals']]},
  users:{t:'The people directory: identity, manager, HRM schedule, salary and documents.',d:['“Reports to” decides who approves this person\'s leave/overtime and who sees them in Team.','Salary + IBAN here feed Payroll and the bank file.','Access is NOT set here — one role per person in Access Control.'],l:[['accesscontrol','Access Control'],['payroll','Payroll'],['hierarchy','Hierarchy']]},
  hierarchy:{t:'The reporting tree, drawn from each person\'s “Reports to”. Fix structure in Users.',l:[['users','Users']]},
  checklists:{t:'Build recurring task lists: frequency, assignees, questions, due time.',d:['On due days they appear in each assignee\'s My Checklists; late submissions are flagged.','Attach questions to capture numbers/photos — escalation rules can open tickets.'],l:[['questions','Questions'],['allcl','All Checklists']]},
  allcl:{t:'Every checklist in the company in one list — edit, duplicate or reassign.',l:[['checklists','Create Checklist']]},
  questions:{t:'The reusable question bank checklists pull from — with types, photo/comment rules and escalation.',l:[['checklists','Create Checklist'],['tickets','Tickets']]},
  approvals:{t:'One inbox for every decision: leave, submissions, edits, documents, overtime.',d:['Approve/reject inline; the requester is notified instantly.','Filter by type and use “Approve all” for bulk.'],l:[['leave','Leave'],['overtime','Overtime']]},
  notifications:{t:'Every alert lands here (and is queued for email once a provider is connected). Tap one to jump to the right tab.',l:[]},
  locations:{t:'Offices with GPS geofence — controls where clock-in works and holds location documents.',l:[['attendance','Attendance'],['users','Users']]},
  departments:{t:'Departments and sub-departments; also holds each department\'s document folders.',l:[['users','Users'],['okr','OKRs']]},
  settings:{t:'App-wide settings and templates.',l:[]},
  audit:{t:'Every action anyone takes, filterable by person, department and tab. If you wonder “who changed this?” — the answer is here.',l:[['accesscontrol','Access Control']]},
  profile:{t:'Your own details, documents and preferences.',l:[]},
  accesscontrol:{t:'One rule runs everything: a ROLE is a bundle of switches (which tabs, which buttons) — give each person ONE role, done. “Personal” only holds personal facts: past/future submission rights, HR-approver stage, cities and document folders.',d:['Edit a role → everyone with it changes instantly.','You can never remove the last person holding Access Control.'],l:[['users','Users'],['audit','Audit']]},
  okr:{t:'Create an objective with a target and a check-in day → the owner gets it as a task on that day → their numbers roll up the tree (L2 → L1 → L0) and the graph shows planned pace vs reality.',d:['Who sees what is set in Access Control (OKRs → “sees”): only their own, their team\'s, their department\'s, or everyone\'s. Owners always see their own objectives, and anything below a visible objective is visible too.','Green = on pace, red = off pace, computed against the period; you can also mark status manually.','Turn on “Annual objective” in the editor to split it into quarterly targets — same owner & metric, only dates and targets differ; the quarters\' updates drive the annual number automatically.','Click any objective to open Progress & Updates — every action (add sub-objective, edit, move, revise, close, delete) now sits in one row at the top of that popup, so the cards themselves stay readable. Move still carries the whole subtree with it.',
    'Set “Which way is good?” to <b>Lower is better</b> when the target is a limit rather than a goal (spend, errors, complaints). The graph then draws a straight line at the limit — cross it and the objective reads Not achieved — and the % becomes how much of the limit is used.',
    'Tick the box on any objective to select it, then <b>Bulk edit</b> changes owners, department, dates, targets, direction, schedule, roll-up or status across all of them at once — and can close, reopen or delete them. Only the fields you tick are written.','The quarter filter has an All / Annual / Quarterly switch, so you can view just the annual picture, just the quarters, or everything.','Every input and edit is kept in the objective\'s activity log.'],l:[['mychecklists','My Checklists'],['dashboard','Dashboard'],['accesscontrol','Access Control']]},
};

App._howModal=()=>{
  const h=HOW[S.route];if(!h)return;
  const nav=navFor().find(n=>n[0]===S.route);
  modalShell({title:'How this tab works',sub:nav?nav[2]:'',size:'max-w-md',
    body:`<div style="font-size:13.5px;color:var(--c-text);line-height:1.65">${h.t}</div>
      ${h.d?`<div style="margin-top:12px;border-top:1px dashed var(--c-border);padding-top:10px">${h.d.map(x=>`<div style="display:flex;gap:8px;font-size:12.5px;color:var(--c-text-2);line-height:1.55;padding:4px 0"><span style="color:var(--c-brand-ink);font-weight:800;flex-shrink:0">→</span><span>${x}</span></div>`).join('')}</div>`:''}
      ${h.l&&h.l.length?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px;align-items:center"><span style="font-size:10px;font-weight:800;color:var(--c-text-3);text-transform:uppercase">Linked tabs:</span>${h.l.filter(x=>navFor().some(n=>n[0]===x[0])).map(x=>`<button onclick="App.closeModal();App.go('${x[0]}')" class="ui-btn ui-btn-ghost ui-btn-sm">${x[1]} →</button>`).join('')}</div>`:''}`,
    footer:btnP('Got it','App.closeModal()')});
};
function _howBar(key){return'';// v3.16: blue helper banners removed (user request) — the "?" HOW modal content stays available to future UI
  const h=HOW[key];if(!h)return'';
  try{if(localStorage.getItem('bridge_how_'+key))return'';}catch(e){}
  return `<div style="display:flex;gap:10px;align-items:flex-start;background:var(--c-info-soft);border:1px solid #BFE3DF;border-radius:12px;padding:10px 14px;margin-bottom:14px">
    <span style="flex-shrink:0;margin-top:1px">${ic('help','w-4 h-4')}</span>
    <div style="flex:1;min-width:0">
      <div style="font-size:12.5px;color:#0B5F5A;line-height:1.55">${h.t}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;align-items:center">
        <span style="font-size:10px;font-weight:800;color:#0B5F5A;text-transform:uppercase;letter-spacing:.05em">Linked:</span>
        ${h.l.filter(x=>navFor().some(n=>n[0]===x[0])).map(x=>`<button onclick="App.go('${x[0]}')" style="font-size:11px;font-weight:700;padding:2px 10px;border-radius:20px;border:1px solid #BFE3DF;background:var(--c-surface);color:#0B5F5A;cursor:pointer">${x[1]} →</button>`).join('')}
      </div>
    </div>
    <button onclick="try{localStorage.setItem('bridge_how_${key}','1')}catch(e){};rr()" title="Got it — hide" style="border:none;background:transparent;color:#0B5F5A;cursor:pointer;font-size:14px;line-height:1;flex-shrink:0">×</button>
  </div>`;
}
/* dismissNote(key,html,opts) — an informational note the user can dismiss with × ("got it,
   don't show again" — remembered per browser in localStorage, same rule as the How-bars).
   opts: icon · style (extra outer css) · onDismiss (JS string run after hiding; default rr()). */
function dismissNote(key,html,opts={}){return'';// v3.16: blue info notes removed (user request)
  try{if(localStorage.getItem('bridge_note_'+key))return'';}catch(e){}
  const after=opts.onDismiss||'rr()';
  return `<div style="display:flex;gap:8px;align-items:flex-start;background:var(--c-info-soft);border:1px solid #BFE3DF;border-radius:10px;padding:8px 12px;font-size:12px;color:#0B5F5A;${opts.style||''}">
    ${opts.icon?`<span style="flex-shrink:0;margin-top:1px">${ic(opts.icon,'w-3.5 h-3.5')}</span>`:''}
    <div style="flex:1;min-width:0;line-height:1.5">${html}</div>
    <button type="button" onclick="event.stopPropagation();try{localStorage.setItem('bridge_note_${key}','1')}catch(e){};${after}" title="Got it — don't show this again" aria-label="Dismiss" style="flex-shrink:0;width:18px;height:18px;border:none;background:transparent;color:#0B5F5A;cursor:pointer;font-size:14px;line-height:1;padding:0;display:grid;place-items:center">×</button>
  </div>`;
}
function _aChartTheme(){return {tick:'#5F777E',grid:'rgba(144,165,171,0.18)'};}
App._searchRR=(inputId)=>{const a=document.activeElement;const ss=a?a.selectionStart:null,se=a?a.selectionEnd:null;rr();const el=document.getElementById(inputId);if(el){el.focus();try{if(ss!=null)el.setSelectionRange(ss,se);}catch(e){}}};

/* shims for ported shell (index approvals model; announcements not included) */
function _approvalPendingCount(){return (DB.approvals||[]).filter(a=>a.status==='Pending').length;}
/* ── PORTED: ⌘K global search ── */
App._cmdk=()=>{
  if(!S.uid)return;
  modalShell({title:'Quick search',sub:'Pages · people · OKRs — type, then Enter',size:'max-w-md',
    body:`<div><input id="cmdk-in" class="ui-input rf" placeholder="e.g. tickets, Sara, revenue…" oninput="App._cmdkQ(this.value)" onkeydown="if(event.key==='Enter'){const b=document.querySelector('#cmdk-res [data-go]');if(b)b.click();}"/>
      <div id="cmdk-res" style="margin-top:10px;max-height:320px;overflow-y:auto"></div></div>`,
    footer:btnG('Close','App.closeModal()')});
  setTimeout(()=>{const el=document.getElementById('cmdk-in');if(el){el.focus();App._cmdkQ('');}},60);
};
App._cmdkQ=(q)=>{
  const box=document.getElementById('cmdk-res');if(!box)return;
  q=(q||'').toLowerCase().trim();
  const out=[];
  navFor().forEach(([r,i,l])=>{if(!q||l.toLowerCase().includes(q))out.push({icon:i,label:l,sub:'Page',go:`App.closeModal();App.go('${r}')`});});
  if(typeof HUB_DEF!=='undefined')Object.keys(HUB_DEF).forEach(k=>{_hubTabsAllowed(k).forEach(([r,l])=>{if(q&&!l.toLowerCase().includes(q))return;if(out.some(o=>o.go.includes(`'${r}'`)))return;out.push({icon:'grid',label:l,sub:HUB_DEF[k].label,go:`App.closeModal();App.go('${r}')`});});});
  if(can('employees','view'))(typeof visU==='function'?visU():DB.users).filter(Boolean).forEach(u=>{if(q&&fullName(u).toLowerCase().includes(q))out.push({icon:'users',label:fullName(u),sub:(u.position||'Person')+' · '+(u.department||''),go:`App.closeModal();App.go('users');S.search='${jsq(fullName(u))}';rr()`});});
  // ^ two fixes (v3.14): order — App.go() resets S.search, so setting it FIRST meant picking
  //   a person in ⌘K landed on an unfiltered Users list; and jsq() not esc(), because these
  //   strings are JS inside an attribute and esc()'s &#39; decodes back to a bare quote that
  //   breaks the handler outright for anyone named O'Brien.
  if(can('okr','view'))okrVisible().forEach(o=>{if(q&&(o.title||'').toLowerCase().includes(q))out.push({icon:'chart',label:o.title,sub:'OKR · L'+okrLevel(o),go:`App.closeModal();App.go('okr');S.filters.okrQ='${jsq(o.title)}';rr()`});});
  const SUB=[['Email settings','settings','stab','email','settings'],['Templates (Settings)','settings','stab','templates','settings'],['In-app notification rules','settings','stab','inapp','settings'],['Roles (Access Control)','accesscontrol','acTab','roles','accessControl'],['People (Access Control)','accesscontrol','acTab','people','accessControl']];
  SUB.forEach(([label,route,fk,fv,area])=>{if(q&&label.toLowerCase().includes(q)&&can(area,'view'))out.push({icon:'cog',label:label,sub:'Screen',go:`App.closeModal();App.go('${route}');S.filters.${fk}='${fv}';rr()`});});
  box.innerHTML=out.slice(0,12).map(r=>`<button data-go onclick="${r.go}" style="width:100%;display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:10px;border:none;background:transparent;cursor:pointer;text-align:left" onmouseover="this.style.background='var(--c-surface-2)'" onmouseout="this.style.background='transparent'">
    <span style="width:30px;height:30px;border-radius:9px;background:var(--c-surface-2);display:grid;place-items:center;color:var(--c-text-2);flex-shrink:0">${ic(r.icon,'w-4 h-4')}</span>
    <span style="min-width:0"><span style="display:block;font-size:13px;font-weight:700;color:var(--c-text)">${esc(r.label)}</span><span style="display:block;font-size:10.5px;color:var(--c-text-3)">${esc(r.sub)}</span></span>
  </button>`).join('')||'<div style="padding:14px;font-size:12.5px;color:var(--c-text-3)">Nothing matches.</div>';
};
window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();App._cmdk();}});

/* ═════════════════ PORTED BLOCK: ACCESS-CONTROL CORE (from Safe Backup) ═════════════════ */
/* ═══ PORTED FROM SAFE BACKUP: access-control support (reduced — HRM suite not included) ═══ */
const isHR=()=>{const u=me();return !!u&&(u.hrm?.isHR===true);};
function _ensureHrm(u){if(!u)return u;if(!u.hrm||typeof u.hrm!=='object')u.hrm={};const h=u.hrm;if(h.isHR===undefined)h.isHR=false;if(h.roleProfileId===undefined)h.roleProfileId=null;return u;}
/* ═══════════════════════════════════════════════════════════════
   PERMISSIONS SYSTEM (frontend-only — NO Supabase, all on DB / u.hrm)
   - PERM_AREAS: single source of truth. Add an area = add one entry.
   - DB.roleProfiles: named permission bundles (object keyed by id).
   - u.hrm.roleProfileId: per-user assignment (null = base-role floor).
   - can()/scopeOf()/scopeFilter(): the resolver every gate calls.
   - _baseCan()/_baseScope(): back-compat shim = TODAY's exact access
     for any user with NO assigned profile. This is the safety net.
   ═══════════════════════════════════════════════════════════════ */
// `group` partitions the Access-Control editor into labelled sections (rendering only — does not
// affect can()/scope resolution). Every `actions` entry below is an action that is actually enforced
// by a can(area,action) gate somewhere in this file (verified by grep — see B2a matrix); the editor
// is fully data-driven from this list so a toggle exists for every gate the app checks.
const PERM_GROUPS=['People & Org','Tasks & Tickets','Content','Insights','System'];
const PERM_AREAS=[
  {key:'dashboard',label:'Dashboard',desc:'The landing overview',actions:['view'],scoped:false,group:'System'},
  {key:'employees',label:'Users',desc:'The people directory — create, edit, deactivate people, assign managers & roles',actions:['view','create','edit','delete','deactivate','resetPassword','assignManager','assignRole','assign','manage'],scoped:true,group:'People & Org'},
  {key:'hierarchy',label:'Hierarchy / Org chart',desc:'The reporting tree',actions:['view'],scoped:true,group:'People & Org'},
  {key:'teamview',label:'Team view',desc:'The Team page — live checklist status of the team',actions:['view'],scoped:false,group:'People & Org'},
  {key:'departments',label:'Departments',desc:'Top-level department list',actions:['view','create','edit','delete'],scoped:false,group:'People & Org'},
  {key:'subDepartments',label:'Sub-departments',desc:'Sub-departments nested inside a department',actions:['view','create','edit','delete'],scoped:false,group:'People & Org'},
  {key:'checklists',label:'Checklists',desc:'The checklist system',actions:['view','create','edit','duplicate','assign','approve','delete','export'],scoped:true,group:'Tasks & Tickets'},
  {key:'allChecklists',label:'All Checklists',desc:'Browse every checklist across the company',actions:['view','export'],scoped:false,group:'Tasks & Tickets'},
  {key:'questions',label:'Questions',desc:'The questions feature',actions:['view','create','edit','manage','delete','import','export'],scoped:false,group:'Tasks & Tickets'},
  {key:'tickets',label:'Tickets',desc:'Issue tickets',actions:['view','create','edit','assign','comment','resolve','reopen','close','manage','delete','export'],scoped:true,group:'Tasks & Tickets'},
  {key:'crm',label:'Workspace',desc:'Workspace inbox — hubs (channels), boards, chats & tickets. ACCESS: a person added to a CHANNEL sees every board in it; a person added to a single BOARD sees only that board. “Assign people (channel)” and “Assign people (board)” decide who can hand out that access, and “See every channel & board” bypasses membership entirely. “Rename” covers hubs/boards + the sidebar title; “People groups” manages the reusable @taggable groups; “Filtered views” lets them create member-scoped filtered views on a board',actions:['view','create','edit','convert','assign','rename','groups','views','members','hubMembers','seeAll','delete','manage'],scoped:false,group:'Tasks & Tickets'},
  {key:'documentsOrg',label:'Documents (organization)',desc:'Shared dept/location files',actions:['view','create','edit','delete','upload','download','approve'],scoped:true,group:'Content'},
  {key:'documentsPersonal',label:'Personal documents',desc:'Files on a person\'s profile',actions:['view','create','edit','delete','upload','download'],scoped:true,group:'Content'},
  {key:'analytics',label:'Analytics',desc:'Operational analytics dashboard (checklists, compliance, tickets)',actions:['view','export'],scoped:false,group:'Insights'},
  {key:'okr',label:'OKRs',desc:'Hierarchical objectives (L0 → L1 → L2). “Sees” decides WHOSE objectives they can view — owners always see their own (they have to update them); sub-objectives of anything visible are included',actions:['view','create','edit','checkin','manage','delete'],scoped:true,group:'Insights'},
  {key:'locations',label:'Locations',desc:'Offices and GPS boundary',actions:['view','create','edit','manage','delete','manageGeofence'],scoped:false,group:'System'},
  {key:'approvals',label:'Approvals inbox',desc:'The unified approvals page (what they can act on is still per-area)',actions:['view','decide'],scoped:false,group:'System'},
  {key:'audit',label:'Audit / Activity log',desc:'History of actions',actions:['view','export'],scoped:false,group:'System'},
  {key:'settings',label:'Settings',desc:'App settings',actions:['view','edit','manage'],scoped:false,group:'System'},
  {key:'accessControl',label:'Access Control',desc:'The role-profile system itself',actions:['view','manage'],scoped:false,group:'System'},
];
// Plain-language labels used by the Access Control editor + live summary.
const PERM_ACTION_LABEL={view:'View',create:'Create',edit:'Edit',delete:'Delete',deactivate:'Deactivate',resetPassword:'Reset password',approve:'Approve',decide:'Approve / Reject',download:'Download / Export',export:'Export',import:'Import',duplicate:'Duplicate',checkin:'Check-in / Update',resolve:'Resolve',reopen:'Reopen',close:'Close',comment:'Comment',manage:'Manage',manageSettings:'Manage settings',assign:'Assign',assignRole:'Assign role profile',assignManager:'Assign manager',grant:'Grant / Remove',submit:'Submit',upload:'Upload',manageGeofence:'Manage geofence',issue:'Issue',verify:'Verify',run:'Run',finalize:'Finalize',rollback:'Roll back',rename:'Rename',groups:'People groups',views:'Filtered views',members:'Assign people (board)',hubMembers:'Assign people (channel)',seeAll:'See every channel & board'};
const SCOPE_ORDER=['none','self','team','department','location','everyone'];
const SCOPE_LABEL={none:'None',self:'Only their own',team:'Their team',department:'Their department',location:'Their office',everyone:'Everyone'};
const _areaByKey=k=>PERM_AREAS.find(a=>a.key===k);

// ── Seed built-in roles (idempotent; version-stamped so v3 upgrades older seeds in place) ──
// ROLES-FIRST MODEL (v3): Access Control creates ROLES (full toggle bundles); every user is
// ASSIGNED one role (u.hrm.roleProfileId) and sees only what it grants. Per-user AREA OVERRIDES
// (u.hrm.perms) sit on top for individual exceptions and beat the role — even for a Super Admin.
function _seedRoleProfiles(){
  if(!DB.roleProfiles||typeof DB.roleProfiles!=='object')DB.roleProfiles={};
  const A=(scope,...acts)=>({scope,actions:acts.reduce((o,a)=>(o[a]=true,o),{})});
  const allOf=(exceptAC)=>{const p={};PERM_AREAS.forEach(a=>{if(exceptAC&&a.key==='accessControl')return;p[a.key]={scope:a.scoped?'everyone':'none',actions:a.actions.reduce((o,act)=>(o[act]=true,o),{})};});return p;};
  const presets={
    superadmin:{id:'superadmin',name:'Super Admin',description:'Everything, including Access Control itself.',builtin:true,perms:allOf(false)},
    admin:{id:'admin',name:'Administrator',description:'Full operational access across the whole organization — everything except Access Control.',builtin:true,perms:allOf(true)},
    manager:{id:'manager',name:'Team Lead / Manager',description:'Sees and acts on their team: approvals, checklists, tickets, team OKRs, reports.',builtin:true,perms:{
      dashboard:A('none','view'),
      employees:A('team','view'),
      teamview:A('none','view'),
      checklists:A('team','view','create','edit','duplicate','assign','approve','delete'),
      tickets:A('team','view','create','edit','assign','resolve','manage'),
      crm:A('everyone','view','create','edit','convert','assign','rename','groups','views','members','delete'),
      documentsPersonal:A('self','view','create','download'),
      approvals:A('none','view','decide'),
      okr:A('team','view','create','edit','manage'),
      analytics:A('none','view'),
    }},
    basic:{id:'basic',name:'Basic Employee',description:'A standard employee — their own checklists, attendance, leave and tickets.',builtin:true,perms:{
      dashboard:A('none','view'),
      checklists:A('self','view'),
      tickets:A('self','view','create'),
      crm:A('everyone','view','create','edit','convert','assign'),
      documentsPersonal:A('self','view','create','download'),
      okr:A('self','view'),
    }},
  };
  const _validAreas=new Set(PERM_AREAS.map(a=>a.key));Object.values(presets).forEach(p=>{Object.keys(p.perms||{}).forEach(k=>{if(!_validAreas.has(k))delete p.perms[k];});});
  const V='14'; // v14: Workspace access is membership-based — CRM gains 'members' (assign to a board), 'hubMembers' (assign to a whole channel) and 'seeAll' (bypass membership). Super Admin/Admin get all three; Manager gets board-level assignment; Basic gets none. Custom roles keep their toggles: switch the new ones on per role in Access Control.
  Object.values(presets).forEach(p=>{
    const cur=DB.roleProfiles[p.id];
    if(!cur||(cur.builtin&&cur._v!==V)){p._v=V;DB.roleProfiles[p.id]=p;} // upgrade built-ins once; never touch custom roles
  });
}

// ── Resolver v3 (roles-first, fully toggle-driven) ──
// Priority: 1) per-user AREA OVERRIDE (u.hrm.perms — beats everything, even Super Admin)
//           2) ASSIGNED ROLE (u.hrm.roleProfileId → DB.roleProfiles)
//           3) legacy fallbacks for anyone not yet migrated (Admin default-all, HR floor, base shim).
function _myProfile(){const u=me();if(!u)return null;const id=u.hrm?.roleProfileId;return id?(DB.roleProfiles?.[id]||null):null;}
function _roleOf(u){const id=u&&u.hrm&&u.hrm.roleProfileId;return id?(DB.roleProfiles?.[id]||null):null;}
function _userPermArea(u,area){const p=u&&u.hrm&&u.hrm.perms;return(p&&typeof p==='object'&&p[area]&&typeof p[area]==='object')?p[area]:null;}
function can(area,action){
  const u=me();if(!u)return false;
  const o=_userPermArea(u,area);
  if(o)return !!(o.actions&&o.actions[action]);
  const rp=_roleOf(u);
  if(rp)return !!(rp.perms&&rp.perms[area]&&rp.perms[area].actions&&rp.perms[area].actions[action]);
  if(isAdmin())return true;
  if(_hrFloor(area,action))return true;
  return _baseCan(area,action);
}
// Evaluate for ANOTHER user (Access Control editor + lockout guard).
function canUser(u,area,action){
  if(!u)return false;
  const o=_userPermArea(u,area);
  if(o)return !!(o.actions&&o.actions[action]);
  const rp=_roleOf(u);
  if(rp)return !!(rp.perms&&rp.perms[area]&&rp.perms[area].actions&&rp.perms[area].actions[action]);
  return u.role==='Admin';
}
// Lockout guard: would ANY other active user still hold accessControl.<action> if `uid2` loses it?
function _acLockoutSafe(uid2,action){
  return (DB.users||[]).some(x=>x.id!==uid2&&x.status==='Active'&&canUser(x,'accessControl',action));
}
// Which built-in role matches a user's legacy standing? (migration + base-role changes)
function _roleIdForUser(u){
  if(u.role==='Admin')return 'superadmin';
  if(u.role==='SubAdmin')return 'admin';
  if((DB.users||[]).some(x=>x.managerId===u.id&&x.id!==u.id))return 'manager';
  return 'basic';
}
/* ── One-time v3 migration: assign everyone a ROLE from their current standing, translate the old
   personal grants (questionsAccess / docAccess) into small per-user overrides, and clear the v2
   full baked maps so the ROLE is what drives access from now on. Idempotent via u.hrm.permsV3. ── */
function _permsV3Migrate(){
  let n=0;
  (DB.users||[]).forEach(u=>{
    if(!u)return;_ensureHrm(u);
    if(u.hrm.permsV3)return;
    if(!u.hrm.roleProfileId||!DB.roleProfiles[u.hrm.roleProfileId])u.hrm.roleProfileId=_roleIdForUser(u);
    const ov={};
    if(u.questionsAccess&&u.hrm.roleProfileId==='basic')ov.questions={scope:'none',actions:{view:true,manage:false}};
    const da=u.docAccess||{};
    const anyDept=Object.values(da.departments||{}).some(p=>p&&p.view);
    const anyLoc=Object.values(da.locations||{}).some(p=>p&&p.view);
    if((anyDept||anyLoc)&&['basic','manager','hr'].includes(u.hrm.roleProfileId)){
      ov.documentsOrg={scope:'everyone',actions:{view:true,create:true,download:true,delete:false,approve:u.hrm.roleProfileId==='hr'}};
      if(anyDept)ov.departments={scope:'none',actions:{view:true,create:false,edit:false}};
      if(anyLoc)ov.locations={scope:'none',actions:{view:true,create:false,edit:false,manage:false}};
    }
    u.hrm.perms=Object.keys(ov).length?ov:null; // clear v2 baked map — the role drives now
    u.hrm.permsBaked=1;u.hrm.permsV3=1;n++;
  });
  if(n)console.log('[perms] v3 roles derived for',n,'user(s)');
}
// HR-role floor — legacy fallback for users with NO assigned role (pre-migration edge only).
function _hrFloor(area,action){
  if(!isHR())return false;
  if(area==='leaveBalances')return action==='view'||action==='edit'||action==='grant';
  if(area==='hrSettings')return action==='view'||action==='edit';
  if(area==='leaveRequests')return action==='view'||action==='approve';
  if(area==='attendance')return action==='view'||action==='edit';
  if(area==='documentsOrg')return action==='approve';
  return false;
}
// scopeOf(area) → 'none'|'self'|'team'|'department'|'location'|'everyone'
function scopeOf(area){
  const u=me();if(!u)return 'none';
  const o=_userPermArea(u,area);
  if(o)return o.scope||'none';
  const rp=_roleOf(u);
  if(rp){const a=rp.perms&&rp.perms[area];return a?(a.scope||'none'):'none';}
  if(isAdmin())return 'everyone';
  return _baseScope(area);
}
// scopeFilter(area) → predicate(userId)=>bool ("can I see this person under <area>'s scope").
function scopeFilter(area){
  const sc=scopeOf(area),myId=S.uid,u=me();
  if(sc==='none')return ()=>false;
  if(sc==='everyone')return id=>{const t=uById(id);return !!t&&(t.role!=='Admin'||isAdmin());};
  if(sc==='self')return id=>id===myId;
  if(sc==='team'){const set=new Set([myId,...subTree(myId).map(x=>x.id)]);return id=>set.has(id);}
  if(sc==='department'){const d=u?.department;return id=>!!d&&uById(id)?.department===d;}
  if(sc==='location'){const l=u?.hrm?.locationId;return id=>!!l&&uById(id)?.hrm?.locationId===l;}
  return ()=>false;
}
function scopedUsers(area){const f=scopeFilter(area);return DB.users.filter(u=>f(u.id));}

// ── Legacy base-role shim (only reachable for users with NO role assigned — pre-migration) ──
const _canReportLegacy=()=>{const p=me()?.hrm?.reportPerms||{};return Object.values(p).some(Boolean);};
function _baseCan(area,action){
  const sub=isSubAdmin(),mgr=isMgr(),hr=isHR(),q=!!me()?.questionsAccess,doc=hasDocAccess();
  switch(area){
    case 'dashboard':return true;
    case 'attendance':return action==='view'?true:(sub||hr);
    case 'leaveRequests':return action==='approve'?(sub||mgr||hr):(action==='download'?(sub||hr):true);
    case 'leaveBalances':return action==='view'?(sub||mgr||hr):((action==='grant'||action==='edit')?hr:false);
    case 'hrSettings':return hr;
    case 'employees':
      if(action==='deactivate'||action==='assignManager')return sub;
      if(action==='assignRole')return false;
      return action==='view'?(sub||mgr):sub;
    case 'hierarchy':return true;
    case 'scheduling':return action==='view'?true:(sub||mgr||hr);
    case 'checklists':return action==='view'?true:(sub||mgr);
    case 'analytics':return (sub||mgr||hr);
    case 'questions':return q||sub;
    case 'tickets':return action==='manage'?(sub||mgr):true;
    case 'documentsOrg':return action==='approve'?hr:doc;
    case 'documentsPersonal':return true;
    case 'reports':return (action==='download')?(hr||_canReportLegacy()):(hr||mgr||_canReportLegacy());
    case 'announcements':return action==='view'?true:hr;
    case 'locations':return action==='view'?doc:false;
    case 'departments':return doc;
    case 'teamview':return sub||mgr;
    case 'allChecklists':return sub;
    case 'approvals':return sub||mgr||hr;
    case 'audit':return false;
    case 'settings':return false;
    case 'accessControl':return false;
    case 'okr':
      if(action==='view')return sub||mgr||(DB.okrs||[]).some(o=>o.ownerId===S.uid||(Array.isArray(o.owners)&&o.owners.includes(S.uid)));
      return sub||mgr;
  }
  return false;
}
function _baseScope(area){
  if(area==='employees')return 'team';
  if(isSubAdmin())return 'everyone';
  if(isHR()&&['attendance','leaveRequests','leaveBalances','reports','scheduling','expenses'].includes(area))return 'everyone';
  if(isMgr())return 'team';
  return 'self';
}
/* ═══════════════ end PERMISSIONS SYSTEM ═══════════════ */

/* ═════════════════ PORTED BLOCK: UI KIT (from Safe Backup) ═════════════════ */
/* ═══ PORTED: UI kit helpers (Safe Backup) ═══ */
function btn(label,onclick,opts={}){
  const v=opts.variant||'primary',sz=opts.size||'md',i=opts.icon||'';
  const dis=opts.disabled?' aria-disabled="true"':'';
  const extra=opts.attrs?(' '+opts.attrs):'';
  return `<button type="button" onclick="${onclick}" class="ui-btn ui-btn-${v} ui-btn-${sz}"${dis}${extra}>${i?ic(i,sz==='sm'?'w-4 h-4':'w-[18px] h-[18px]'):''}${esc(label)}</button>`;
}
function card(inner,opts={}){
  const head=opts.head?`<div class="ui-card-head"><span class="ui-card-title">${opts.head}</span>${opts.headRight||''}</div>`:'';
  const body=opts.pad===false?inner:`<div class="ui-card-pad">${inner}</div>`;
  return `<div class="ui-card"${opts.attrs?(' '+opts.attrs):''}>${head}${body}</div>`;
}
/* countBadge(n,tone) — unifies the 3x hand-written nav badges */
function chipBar(items,activeKey,fnName,opts={}){
  const pill=opts.style==='pill';
  const cls=pill?'ui-tab-pill':'ui-tab';
  const inner=items.map(it=>{const[k,l,c]=Array.isArray(it)?it:[it,it];const on=k===activeKey;
    return `<button type="button" class="${cls}${on?' on':''}" onclick="${fnName}('${k}')">${esc(l)}${c?`<span style="display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;border-radius:var(--r-pill);padding:1px 6px;min-width:16px;background:${on?'rgba(255,255,255,.22)':'var(--c-border)'};color:${on?'#fff':'var(--c-text-2)'}">${c}</span>`:''}</button>`;
  }).join('');
  return pill?`<div style="display:flex;gap:8px;flex-wrap:wrap;overflow-x:auto;-webkit-overflow-scrolling:touch">${inner}</div>`:`<div class="ui-tabs">${inner}</div>`;
}
const COUNT_TONE={danger:'#EF4444',approve:'#0F766E',rose:'#DE2440',brand:'#0F766E'};
const countBadge=(n,tone='danger',extra='')=>!n?'':`<span class="ui-count" style="background:${COUNT_TONE[tone]||tone};${extra}">${n}</span>`;
/* badge(text,tone) — generic soft pill */


/* ═════════════════ PORTED BLOCK: OKR MODULE (from Safe Backup) ═════════════════ */
/* ═══ PORTED: OKR mappers ═══ */
function _mOKR(rows){return(rows||[]).map(o=>({id:o.id,parentId:o.parent_id||null,title:_unesc(o.title)||'',description:_unesc(o.description)||'',departmentId:o.department_id||null,subDepartmentId:o.sub_department_id||null,ownerId:o.owner_id||null,owners:(Array.isArray(o.owners)&&o.owners.length)?o.owners.filter(Boolean):(o.owner_id?[o.owner_id]:[]),metricType:o.metric_type||'number',startValue:(o.start_value===null||o.start_value===undefined)?0:Number(o.start_value),targetValue:(o.target_value===null||o.target_value===undefined)?null:Number(o.target_value),unit:_unesc(o.unit)||'',direction:o.direction||'up',frequency:(o.frequency&&typeof o.frequency==='object')?o.frequency:{},periodStart:o.period_start||null,periodEnd:o.period_end||null,statusMode:o.status_mode||'auto',statusManual:o.status_manual||null,rollup:!!o.rollup,rollupMode:o.rollup_mode||'sum',isAnnual:!!o.is_annual,quarterLabel:_unesc(o.quarter_label)||null,closed:!!o.closed,closedReason:_unesc(o.closed_reason)||'',closedAt:o.closed_at||null,closedBy:o.closed_by||null,revisedTarget:(o.revised_target===null||o.revised_target===undefined)?null:Number(o.revised_target),revisedNote:_unesc(o.revised_note)||'',revisedAt:o.revised_at||null,revisedBy:o.revised_by||null,deletedAt:o.deleted_at||null,deletedBy:o.deleted_by||null,sort:o.sort||0,createdBy:o.created_by||null,createdAt:o.created_at,updatedAt:o.updated_at||null}));}
function _mOKRCheckin(rows){return(rows||[]).map(c=>({id:c.id,okrId:c.okr_id,userId:c.user_id||null,date:c.date,value:(c.value===null||c.value===undefined)?null:Number(c.value),comment:_unesc(c.comment)||'',photos:Array.isArray(c.photos)?c.photos:[],statusMark:c.status_mark||null,editCount:c.edit_count||0,createdAt:c.created_at,updatedAt:c.updated_at||null}));}
function _mOKRLog(rows){return(rows||[]).map(l=>({id:l.id,okrId:l.okr_id,actorId:l.actor_id||null,action:l.action||'',details:(l.details&&typeof l.details==='object')?l.details:{},createdAt:l.created_at}));}
function _okrRow(o){return{id:o.id,parent_id:o.parentId||null,title:o.title||'',description:o.description||'',department_id:o.departmentId||null,sub_department_id:o.subDepartmentId||null,owner_id:o.ownerId||null,owners:okrOwners(o),metric_type:o.metricType||'number',start_value:(o.startValue===null||o.startValue===undefined||o.startValue==='')?0:o.startValue,target_value:(o.targetValue===null||o.targetValue===undefined||o.targetValue==='')?null:o.targetValue,unit:o.unit||'',direction:o.direction||'up',frequency:o.frequency||{},period_start:o.periodStart||null,period_end:o.periodEnd||null,status_mode:o.statusMode||'auto',status_manual:o.statusManual||null,rollup:!!o.rollup,rollup_mode:o.rollupMode||'sum',is_annual:!!o.isAnnual,quarter_label:o.quarterLabel||null,closed:!!o.closed,closed_reason:o.closedReason||null,closed_at:o.closedAt||null,closed_by:o.closedBy||null,revised_target:(o.revisedTarget===null||o.revisedTarget===undefined||o.revisedTarget==='')?null:o.revisedTarget,revised_note:o.revisedNote||'',revised_at:o.revisedAt||null,revised_by:o.revisedBy||null,
  /* v3.14: deleted_at / deleted_by are deliberately NOT written here. This row is sent by
     every ordinary save (_okrPush) from whatever the client has in memory, which may be
     minutes old — including a copy fetched before someone else deleted the objective.
     Writing deleted_at:null from that stale copy would silently UN-DELETE it for everyone
     (and a queued write replayed after a reconnect would do it 30 seconds later). PostgREST
     upserts only touch the columns present in the payload, so leaving them out means the
     delete state can be changed by exactly two places: _okrPurgeIds and _okrBinRestore. */
  sort:o.sort||0,created_by:o.createdBy||null,created_at:o.createdAt||new Date().toISOString(),updated_at:new Date().toISOString()};}
function _okrCheckinRow(c){return{id:c.id,okr_id:c.okrId,user_id:c.userId||null,date:c.date,value:(c.value===null||c.value===undefined||c.value==='')?null:c.value,comment:c.comment||'',photos:(c.photos||[]).filter(p=>typeof p==='string'&&p!=='[photo]'),status_mark:c.statusMark||null,edit_count:c.editCount||0,created_at:c.createdAt||new Date().toISOString(),updated_at:new Date().toISOString()};}
/* ═══ PORTED: OKR helpers ═══ */
const OKR_METRICS=[['number','Number'],['percent','Percentage'],['currency','Currency'],['yesno','Yes / No (done or not)']];
const OKR_STATUSES=['On track','Off track','Achieved','Not achieved'];
const okrById=id=>(DB.okrs||[]).find(o=>o.id===id);
/* ── v3.11: MULTIPLE OWNERS — okrOwners() is the single source of truth. Falls back to the
   legacy single ownerId so every pre-existing OKR keeps working. ownerId stays = owners[0]. ── */
function okrOwners(o){if(!o)return[];const a=Array.isArray(o.owners)?o.owners.filter(Boolean):[];if(a.length)return[...new Set(a)];return o.ownerId?[o.ownerId]:[];}
function okrOwnerIs(o,uid2){return !!uid2&&okrOwners(o).includes(uid2);}
/* Effective department: an OKR's own department, or (when empty) the nearest ancestor's — so
   every level can carry its own department/sub-department while children inherit by default. */
function okrDeptOf(o,_g){_g=_g||0;if(!o)return{deptId:null,subDeptId:null};if(o.departmentId)return{deptId:o.departmentId,subDeptId:o.subDepartmentId||null};const p=o.parentId?okrById(o.parentId):null;return(p&&_g<15)?okrDeptOf(p,_g+1):{deptId:null,subDeptId:null};}
/* Children of a node. QUARTERLY SPLITS always group together FIRST (in date order) so the
   annual reads Q1, Q2, Q3, Q4 in a block — regular sub-objectives follow after, whatever
   their raw sort number is (fixes quarters interleaving with other children). */
function okrChildren(id){
  const base=(a,b)=>((a.sort||0)-(b.sort||0))||String(a.createdAt||'').localeCompare(String(b.createdAt||''));
  return(DB.okrs||[]).filter(o=>o.parentId===id).sort((a,b)=>{
    const qa=a.quarterLabel?0:1,qb=b.quarterLabel?0:1;
    if(qa!==qb)return qa-qb;
    if(!qa)return String(a.periodStart||'').localeCompare(String(b.periodStart||''))||base(a,b);
    return base(a,b);
  });
}
/* Level of an objective. A QUARTERLY SPLIT is the same objective time-boxed, not a sub-objective:
   the step from a quarter (quarterLabel set) up to its annual doesn't count as a level — so an
   L0 annual's quarters read “L0 · Q1”, their children read L1, and so on down the tree. */
function okrLevel(o){
  let l=0,cur=o,g=0;
  while(cur&&cur.parentId&&g++<15){
    const p=okrById(cur.parentId);
    if(!p)break;
    if(!cur.quarterLabel)l++; // quarter → annual is a sideways step, not down
    cur=p;
  }
  /* v3.14 — the walk above can only climb ancestors THIS user is allowed to see, so it
     stops at the first hidden one and under-reports: a person scoped to "only their own"
     was shown their L3 objective as L0. bridge_okr_levels() supplies the real depth for
     every objective they can see. Take whichever is larger: the server value is the truth,
     and the local walk covers an objective just created or moved deeper in this session,
     before the map has been refreshed. The walk can only ever under-count, never over. */
  try{
    const t=(typeof OKR_TRUE_LVL!=='undefined'&&OKR_TRUE_LVL&&o)?OKR_TRUE_LVL[o.id]:undefined;
    if(typeof t==='number'&&t>l)return t;
  }catch(e){}
  return l;
}
/* Where the objective sits in the tree YOU ARE LOOKING AT, which is what indentation needs.
   Distinct from okrLevel(): a person scoped to "only their own" should read the real "L3" on
   the chip, but the card must still sit flush at the left of their list rather than indented
   three steps for ancestors that aren't on screen. */
function okrLevelVisible(o){
  let l=0,cur=o,g=0;
  while(cur&&cur.parentId&&g++<15){
    const p=okrById(cur.parentId);
    if(!p)break;
    if(!cur.quarterLabel)l++;
    cur=p;
  }
  return l;
}
/* The server's level map is refreshed on load, so between refreshes a create or a move
   would leave it stale — no entry at all for something just created (falling back to the
   under-counting local walk), or, worse, a now-too-deep entry for something moved higher up,
   which okrLevel()'s "take the larger" rule would then trust. Derive the subtree's levels
   from the new parent's known level instead. */
function _okrRelevel(id,_d){
  if((_d||0)>15)return;
  try{
    if(typeof OKR_TRUE_LVL==='undefined'||!OKR_TRUE_LVL)return;
    const o=okrById(id);if(!o)return;
    if(!o.parentId)OKR_TRUE_LVL[o.id]=0;
    else{
      const pl=OKR_TRUE_LVL[o.parentId];
      if(typeof pl!=='number')delete OKR_TRUE_LVL[o.id];   // parent unknown → fall back to the walk
      else OKR_TRUE_LVL[o.id]=pl+(o.quarterLabel?0:1);
    }
    okrChildren(o.id).forEach(k=>_okrRelevel(k.id,(_d||0)+1));
  }catch(e){}
}
function okrDescendants(id,_seen){_seen=_seen||new Set();if(_seen.has(id))return[];_seen.add(id);return okrChildren(id).flatMap(c=>[c,...okrDescendants(c.id,_seen)]);}
function okrRootOf(o){let cur=o,g=0;while(cur&&cur.parentId&&g++<15){const p=okrById(cur.parentId);if(!p)break;cur=p;}return cur;}
function okrCheckinsOf(id){return(DB.okrCheckins||[]).filter(c=>c.okrId===id).sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.createdAt||'').localeCompare(String(b.createdAt||'')));}
function okrLatestCheckin(id){const cs=okrCheckinsOf(id);return cs.length?cs[cs.length-1]:null;}
// Leaf progress %: how far the latest reported value moved from startValue toward targetValue.
// Works for direction 'down' too (target < start flips the sign naturally). v3.17: >100% shows when beaten.
/* ── Revisions: a revised target OVERLAYS the same objective. The original target and every
   check-in stay untouched — one input stream feeds both numbers, so the two can be compared. ── */
function okrHasRevision(o){return !!o&&o.revisedTarget!==null&&o.revisedTarget!==undefined&&o.metricType!=='yesno';}
function _okrTargetEff(o){return okrHasRevision(o)?Number(o.revisedTarget):((o.targetValue===null||o.targetValue===undefined)?null:Number(o.targetValue));}
/* ══ v3.14 — WHICH WAY IS GOOD? four modes, two families ═══════════════════════════════════
   RANGE modes — a journey from a START value to a TARGET value. Progress = how far along.
     'up'   Higher is better  → start 94 → target 118. The target is a goal to reach.
     'down' Lower is better   → start 39 → target 36. The number has to come down.
            (Legacy shape: 'down' with the target ABOVE the start is an ALLOWANCE — start 0,
            limit 30k of spend. Progress reads "how much of the limit is used" = value ÷ limit.
            New objectives should use 'lte' for that instead; this is kept so old rows behave.)
   THRESHOLD modes — no journey, just a line the number must stay on the right side of.
     'gte'  Greater than      → one value. At or ABOVE it = good (Achieved / On track).
     'lte'  Less than         → one value. At or BELOW it = good (Achieved / On track).
            There is no start, so "how far along" is meaningless. The % instead reports
            NO PROGRESS % (v3.18): pass/fail against a line, so no percentage is reported at
            all — the panel shows how many updates held the line as a plain count (e.g. 1 / 3).
            v3.19: status follows the PERIOD'S DAILY AVERAGE — every reported day's value,
            averaged, judged against the line — so one good day can no longer hide a bad month.
   v3.17: the % is uncapped above 100 (real overachievement shows); bars still fill at 100.
   v3.19: the floor is gone too — a number that moves BACKWARDS from its start value reads as
   a NEGATIVE % (start 100 → target 150, reading 80 → −40%), so regression is visible. */
const OKR_DIRS=[['up','Higher is better'],['down','Lower is better'],['gte','Greater than'],['lte','Less than']];
const OKR_DIR_LONG={
  up:'Higher is better — start value climbs to the target',
  down:'Lower is better — start value comes down to the target',
  gte:'Greater than — one value; at or above it is good',
  lte:'Less than — one value; at or below it is good'
};
function okrDirOf(o){const d=(o&&o.direction)||'up';return(d==='down'||d==='gte'||d==='lte')?d:'up';}
/* THRESHOLD family: a single value, no start, compliance-based %. */
function okrIsThresh(o){return !!o&&o.metricType!=='yesno'&&(okrDirOf(o)==='gte'||okrDirOf(o)==='lte');}
/* RANGE family: start → target. */
function okrIsRange(o){return !!o&&!okrIsThresh(o);}
function okrDirDown(o){return !!o&&okrDirOf(o)==='down'&&o.metricType!=='yesno';}
/* Legacy allowance shape only — 'down' whose target sits ABOVE the start. */
function okrIsLimit(o){
  if(!okrDirDown(o))return false;
  const t=_okrTargetEff(o);
  return t!==null&&t!==undefined&&isFinite(t)&&t>Number(o.startValue||0);
}
/* v3.18: the modes that report NO progress % at all. Thresholds are pass/fail against a line;
   legacy allowance objectives used to report "% of the limit used", a number that CLIMBS as
   performance gets worse (19,535 against a 3,000 limit read 651%) - not a progress figure, so
   both now show status only. */
function okrNoPct(o){return okrIsThresh(o)||okrIsLimit(o);}
/* Allowance consumption, 0-999. Used ONLY to pace the automatic status - never displayed. */
function _okrLimitUsedPct(o){
  const t=_okrTargetEff(o),s=Number(o.startValue||0),v=okrCurrentOf(o);
  if(t===null||t===undefined||!isFinite(t)||v===null||v===undefined||!isFinite(Number(v))||t===s)return null;
  return _okrClampPct((Number(v)/(t-s))*100);
}
/* Is `v` on the good side of a threshold objective's line? null when it can't be judged. */
function okrThreshOK(o,v){
  if(!okrIsThresh(o))return null;
  const t=_okrTargetEff(o);
  if(t===null||t===undefined||!isFinite(t)||v===null||v===undefined||!isFinite(Number(v)))return null;
  return okrDirOf(o)==='gte'?(Number(v)>=t):(Number(v)<=t);
}
/* Every reading that feeds this objective, inside its period, oldest first.
   Roll-ups and annuals are evaluated on their aggregated value on each date a child reported —
   the same series the graph plots — so compliance means the same thing at every level. */
function _okrReadings(o){
  let pts;
  if(o.rollup||o.isAnnual){
    /* v3.19: an ANNUAL always reads from its quarter-tagged children — the roll-up flag no
       longer overrides it (annuals are quarters-only; the toggle is hidden on them). */
    const src=o.isAnnual?okrChildren(o.id).filter(k=>k.quarterLabel):_okrRollupKids(o);
    const set=new Set();
    src.forEach(k=>okrCheckinsOf(k.id).forEach(c=>{if(c.value!==null&&c.value!==undefined&&isFinite(Number(c.value)))set.add(c.date);}));
    pts=[...set].sort().map(d=>({date:d,value:_okrValueAt(o,d)}));
  }else{
    pts=okrCheckinsOf(o.id).map(c=>({date:c.date,value:c.value===null||c.value===undefined?null:Number(c.value)}));
  }
  pts=pts.filter(p=>p.value!==null&&p.value!==undefined&&isFinite(p.value));
  const eff=_okrEffPeriod(o);
  const ps=o.periodStart||eff.ps,pe=o.periodEnd||eff.pe;
  if(ps)pts=pts.filter(p=>p.date>=ps);
  if(pe)pts=pts.filter(p=>p.date<=pe);
  return pts;
}
/* THRESHOLD % = compliance: share of the period's readings on the good side of the line. */
function _okrCompliancePct(o){
  const pts=_okrReadings(o);
  if(!pts.length)return null;
  const ok=pts.filter(p=>okrThreshOK(o,p.value)===true).length;
  return Math.round((ok/pts.length)*1000)/10;
}
/* v3.19 — THRESHOLD verdicts run on the period's DAILY AVERAGE, not the latest reading.
   One value per reported day (the day's newest report wins), averaged across every day that
   reported inside the period. Status then asks: is that AVERAGE on the good side of the line?
   Null when nothing has been reported yet. */
function _okrThreshAvg(o){
  const pts=_okrReadings(o);
  if(!pts.length)return null;
  const by={};
  pts.forEach(p=>{by[p.date]=Number(p.value);}); // readings are date-sorted → last report of a day wins
  const days=Object.keys(by);
  if(!days.length)return null;
  return days.reduce((a,d)=>a+by[d],0)/days.length;
}
/* v3.17: one decimal, sanity ceiling ±999 — real overachievement shows (e.g. 122%), absurd values don't.
   v3.19: the 0 floor is GONE — moving backwards from the start value reads as a negative %. */
function _okrClampPct(p){return isFinite(p)?Math.round(Math.max(-999,Math.min(999,Number(p)))*10)/10:null;}
function okrDirLabel(o){const d=okrDirOf(o);return(OKR_DIRS.find(x=>x[0]===d)||OKR_DIRS[0])[1];}
/* The comparison sign that belongs in front of a TARGET: "\u226550" for a floor, "\u226450" for a
   ceiling. Use this wherever a TARGET is shown; never for current/start/check-in values. */
function _okrTargetSign(o){const d=okrDirOf(o);return d==='gte'?'\u2265':(d==='lte'||d==='down')?'\u2264':'';}
function _okrFmtTarget(o,v){const t=_okrFmtVal(o,v);return t==='\u2014'?t:(_okrTargetSign(o)+t);}
function _okrTargetWord(o){return okrIsThresh(o)?'threshold':okrDirDown(o)?'limit':'target';}
/* The % against target `t`. v3.17: beating the target shows the REAL number (122%); bars still fill at 100. */
function _okrPctVs(o,t){
  /* v3.18: THRESHOLD modes (Greater than / Less than) are pass/fail against a line — there is no
     meaningful % to report, so they carry none. Status alone answers "is it ok". */
  if(okrIsThresh(o))return null;
  const v0=okrCurrentOf(o);if(v0===null||v0===undefined)return null;
  if(o.metricType==='yesno')return Number(v0)>=1?100:0;
  const s=Number(o.startValue||0),v=Number(v0);
  if(t===null||t===undefined||!isFinite(t))return null;
  /* Legacy allowance ('down' with the target above the start): the % is "how much of the
     allowance is used". The allowance is the SPAN the start\u2192target pair describes (t \u2212 s), and
     the reported figure is this period's own number \u2014 so it is v \u00f7 (t \u2212 s), never
     (v \u2212 s) \u00f7 (t \u2212 s). Subtracting the start from a per-period figure is what used to make
     5,257 of a 16,000 quarterly allowance read 0%. With a start of 0 this is exactly v \u00f7 t.
     v3.18: that figure is no longer REPORTED - it reads worse the higher it goes and blows past
     100% once the limit breaks, which is not progress. Status carries the verdict; the
     consumption number survives in _okrLimitUsedPct(), used only to pace that status. */
  if(okrIsLimit(o))return null;
  /* Hold-the-line ("maintain 98%": start === target). Dividing by the gap would be a divide by
     zero, so meeting the line is 100% and missing it reads how close the number got. */
  if(t===s){
    const good=okrDirDown(o)?(v<=t):(v>=t);
    if(good)return 100;
    if(okrDirDown(o))return 0;
    return t===0?0:_okrClampPct((v/t)*100);
  }
  return _okrClampPct(((v-s)/(t-s))*100);
}
/* When a revision is active, the OPERATIVE progress/status track the revised target;
   okrProgressOrig() keeps the original number for the side-by-side comparison. */
function _okrLeafPct(o){return _okrPctVs(o,_okrTargetEff(o));}
function okrProgressOrig(o){return _okrPctVs(o,(o.targetValue===null||o.targetValue===undefined)?null:Number(o.targetValue));}
// Node progress %: children average (roll-up) if it has children, else its own check-ins. Cycle-safe.
/* ── ANNUAL ← QUARTERS: how the annual number is built (v3.20) ──────────────────────────
   Only quarter-tagged children ever feed an annual — regular sub-objectives never do.
   The owner picks HOW in the editor (stored in rollup_mode with a 'q-' prefix so the
   legacy values 'sum'/'avg' left behind by the old level-below era still mean the default):
     'progress'  DEFAULT — combined progress of the quarters, each counting equally.
                 Q1 done 10%, three untouched → annual reads 2.5% ("out of all progress").
     'q-sum'     Total — the quarterly CURRENT VALUES added up, measured against the
                 annual's own start → target (quarterly targets should add up to it).
     'q-avg'     Average of the quarterly current values.
     'q-max'     Highest quarterly current value.
     'q-min'     Lowest quarterly current value.
     'q-latest'  The most recent value reported on any quarter. */
const OKR_ANNUAL_MODES=[
  ['progress','Combined progress of the quarters (each counts equally)'],
  ['q-sum','Total — sum of the quarterly values'],
  ['q-avg','Average of the quarterly values'],
  ['q-max','Highest quarterly value'],
  ['q-min','Lowest quarterly value'],
  ['q-latest','Latest quarterly update']
];
function okrAnnualMode(o){const m=(o&&o.rollupMode)||'';return(m==='q-sum'||m==='q-avg'||m==='q-max'||m==='q-min'||m==='q-latest')?m.slice(2):'progress';}
function _okrAnnualModeLabel(o){
  const m=okrAnnualMode(o);
  return m==='progress'?'combined progress of its quarters'
    :m==='sum'?'total (sum) of its quarterly values'
    :m==='avg'?'average of its quarterly values'
    :m==='max'?'highest quarterly value'
    :m==='min'?'lowest quarterly value'
    :'latest quarterly update';
}
function _okrQKids(o){return okrChildren(o.id).filter(k=>k.quarterLabel);}
function _okrQProgressAvg(o){
  // Threshold and allowance quarters report no % - they must not be averaged in as 0.
  const qs=_okrQKids(o).filter(k=>!okrNoPct(k));
  if(!qs.length)return null;
  let any=false;
  // v3.17: quarters contribute their REAL progress (an overachieved Q1 counts fully).
  // v3.19: no floor either — a quarter that slid below its start drags the annual down for real.
  const ps=qs.map(k=>{const p=okrProgress(k);if(p===null)return 0;any=true;return p;});
  if(!any)return null;
  return _okrClampPct(ps.reduce((a,b)=>a+b,0)/qs.length);
}
function okrProgress(o,_seen){
  // v3.19 precedence when reading the number:
  //   threshold mode → no % at all (pass/fail against a line — status carries the verdict)
  //   annual ON      → its quarters, ALWAYS (quarters or nothing; the roll-up flag never
  //                    overrides an annual) — combined per the owner's annual mode (v3.20):
  //                    'progress' averages the quarters' progress; the value modes aggregate
  //                    the quarterly values (okrCurrentOf) and measure vs start → target.
  //   roll-up ON     → level-below aggregation (non-annual objectives only)
  //   both OFF       → the objective's own check-ins
  if(okrIsThresh(o))return null;
  if(o&&o.isAnnual)return okrAnnualMode(o)==='progress'?_okrQProgressAvg(o):_okrLeafPct(o);
  return _okrLeafPct(o);
}
function _okrExpectedPct(o){
  if(!o.periodStart||!o.periodEnd)return null;
  const t=todayISO();
  if(t<=o.periodStart)return 0;if(t>=o.periodEnd)return 100;
  const s=new Date(o.periodStart+'T00:00:00').getTime(),e=new Date(o.periodEnd+'T00:00:00').getTime(),n=new Date(t+'T00:00:00').getTime();
  return e>s?Math.round(((n-s)/(e-s))*100):100;
}
// Status: a manual mark (statusMode 'manual') wins; otherwise derived from progress vs expected pace.
//   ≥100% → Achieved · period over & <100% → Not achieved · within 10 pts of pace → On track · else Off track.
function _okrExpectedForNode(o,_seen){
  if(o.periodStart&&o.periodEnd)return _okrExpectedPct(o);
  const eff=_okrEffPeriod(o);
  if(eff.ps&&eff.pe)return _okrExpectedPct({periodStart:eff.ps,periodEnd:eff.pe});
  return _okrExpectedPct(o);
}
function okrStatusOf(o){
  if(o.closed)return 'Closed'; // closed beats everything — frozen for record
  if(o.statusMode==='manual'&&o.statusManual)return o.statusManual;
  /* v3.19 — THRESHOLD modes are judged on the PERIOD'S DAILY AVERAGE, not on a pace and not on
     the latest reading alone: every reported day's value is averaged, and that average is what
     must sit on the good side of the line. Average on the good side reads On track (Achieved
     once the period closes); on the wrong side reads Off track (Not achieved once it closes).
     The count beside it ("held the line") is the day-by-day history, a separate question. */
  if(okrIsThresh(o)){
    const avg=_okrThreshAvg(o);
    const ok=okrThreshOK(o,avg!==null?avg:okrCurrentOf(o)); // no in-period readings → fall back to the latest value
    if(ok===null)return 'No data';
    const over=!!(o.periodEnd&&todayISO()>o.periodEnd);
    return ok?(over?'Achieved':'On track'):(over?'Not achieved':'Off track');
  }
  /* v3.18: an allowance reports no % any more, so the pace comparison below reads the internal
     consumption figure instead. It is never shown to anyone - status carries the verdict. */
  const pct=okrIsLimit(o)?_okrLimitUsedPct(o):okrProgress(o);
  if(pct===null)return 'No data';
  /* LEGACY ALLOWANCE: 'down' with the target above the start. The % is "how much of the limit
     is used", so the comparisons flip — burning the allowance faster than the clock is the risk,
     and finishing the period without exhausting it is the win. */
  if(okrIsLimit(o)){
    const cap=_okrTargetEff(o),cur=okrCurrentOf(o);
    if(cap!==null&&isFinite(cap)&&cur!==null&&Number(cur)>cap)return 'Not achieved'; // cap broken
    if(o.periodEnd&&todayISO()>o.periodEnd)return 'Achieved'; // period done, still under it
    const expL=_okrExpectedForNode(o);
    if(expL===null)return pct<=50?'On track':'Off track';
    return pct<=expL+15?'On track':'Off track';             // under the pace line = on track
  }
  if(pct>=100)return 'Achieved';
  if(o.periodEnd&&todayISO()>o.periodEnd)return 'Not achieved';
  const exp=_okrExpectedForNode(o);
  if(exp===null)return pct>=50?'On track':'Off track';
  return pct>=exp-15?'On track':'Off track';
}
const OKR_ST_META={'Achieved':{bg:'#F0E4BE',fg:'#0B5F37',dot:'#D4A72C'},'On track':{bg:'#E4F2F0',fg:'#0B6660',dot:'#22C55E'},'Off track':{bg:'#FEEEEF',fg:'#C41E32',dot:'#EF4444'},'Not achieved':{bg:'#FEF0F0',fg:'#991B1B',dot:'#B91C1C'},'No data':{bg:'#F4F9FA',fg:'#5E767D',dot:'#90A5AB'},'Closed':{bg:'#DFEAEC',fg:'#2F4C55',dot:'#5E767D'}};
function okrStatusChip(st,sm){const m=OKR_ST_META[st]||OKR_ST_META['No data'];return`<span style="display:inline-flex;align-items:center;gap:5px;padding:${sm?'2px 8px':'3px 10px'};border-radius:20px;font-size:${sm?'10.5':'11.5'}px;font-weight:800;background:${m.bg};color:${m.fg};white-space:nowrap"><span style="width:6px;height:6px;border-radius:50%;background:${m.dot};flex-shrink:0"></span>${esc(st)}</span>`;}
function _okrBarColor(st){return(OKR_ST_META[st]||OKR_ST_META['No data']).dot;}
/* Abbreviate big values: 1000 → 1k · 10000 → 10k · 1000000 → 1M (2 decimals max: 1.25M) */
function _fmtAbbr(v){
  const n=Number(v);if(!isFinite(n))return String(v);
  const neg=n<0,a=Math.abs(n);
  const r2=x=>String(Math.round(x*100)/100);
  let out;
  if(a>=1e9)out=r2(a/1e9)+'B';
  else if(a>=1e6)out=r2(a/1e6)+'M';
  else if(a>=1e3)out=r2(a/1e3)+'k';
  else out=r2(a);
  return(neg?'-':'')+out;
}
function _okrFmtVal(o,v){
  if(v===null||v===undefined||v==='')return '—';
  if(o.metricType==='yesno')return Number(v)>=1?'Yes':'No';
  const n=Math.round(Number(v)*100)/100;
  if(o.metricType==='percent')return n+'%';
  if(o.metricType==='currency')return(o.unit?o.unit+' ':'')+_fmtAbbr(n);
  return _fmtAbbr(n)+(o.unit?(' '+o.unit):'');
}
function _okrFreqLabel(o){
  if(o&&o.isAnnual){const m=okrAnnualMode(o);return 'Auto · '+(m==='progress'?'progress of its quarters':m==='sum'?'total of its quarters':m==='avg'?'average of its quarters':m==='max'?'highest quarter':m==='min'?'lowest quarter':'latest quarter update');}
  if(o&&o.rollup)return 'Auto · '+_okrModeLabel(o.rollupMode)+' of level below';
  const f=o.frequency||{};
  if(f.type==='weekly')return 'Weekly · every '+(f.day||'Mon');
  if(f.type==='monthly')return 'Monthly · day '+(f.day||1);
  if(f.type==='custom')return 'Custom · '+((f.dates||[]).length)+' date'+((f.dates||[]).length===1?'':'s');
  return 'No schedule';
}
/* ── Check-in scheduling: is this OKR's update due on `date`? ── */
function okrDueOn(o,date){
  if(o.closed)return false; // closed — no reminders, no tasks
  if(o.isAnnual)return false; // auto-updates from its quarters — nothing to ask the owner
  if(o.rollup)return false; // auto-updates from the level below — nothing to ask the owner
  const f=o.frequency||{};
  if(!f.type)return false;
  if(o.periodStart&&date<o.periodStart)return false;
  if(o.periodEnd&&date>o.periodEnd)return false;
  if(f.type==='weekly')return dayAbbr(date)===(f.day||'Mon');
  if(f.type==='monthly'){
    const d=new Date(date+'T00:00:00');
    const want=Math.min(Number(f.day||1),new Date(d.getFullYear(),d.getMonth()+1,0).getDate());
    return d.getDate()===want;
  }
  if(f.type==='custom')return(f.dates||[]).includes(date);
  return false;
}
// Every OKR whose scheduled check-in lands on `date` for `uid2` — the OWNER gets the task.
// This is the "combined checklist": all of a user's OKR tasks for one day, in one list.
function okrDueForUser(uid2,date){return(DB.okrs||[]).filter(o=>okrOwnerIs(o,uid2)&&okrDueOn(o,date));}
function okrCheckinFor(okrId,uid2,date){return(DB.okrCheckins||[]).find(c=>c.okrId===okrId&&c.userId===uid2&&c.date===date);}
/* GROUP RULE (multi-owner): a check-in by ANY owner on that date counts for the whole group —
   same semantics as "any one can complete" checklists. Latest one wins for display. */
function okrCheckinForDate(okrId,date){const cs=(DB.okrCheckins||[]).filter(c=>c.okrId===okrId&&c.date===date);return cs.length?cs[cs.length-1]:null;}
/* ── Visibility — fully driven by ACCESS CONTROL (role's OKR scope, or a per-person override) ──
   The area's "sees" scope decides WHOSE objectives are visible:
     everyone → all OKRs · team → own + owned by their team · department → own + owned by
     people in their department + OKRs assigned to their department · location → own + owned
     at their office · self / none → only their own.
   Two rules always apply on top:
     1) OWNERSHIP FLOOR — you always see objectives you own or created (you must update them).
     2) SUBTREE RULE — everything below a visible node is visible ("their level and below"). */
function okrVisible(){
  /* _shadow rows are numeric stand-ins for objectives RLS hides from this user.
     They feed roll-up math only and must never appear in any list. */
  const all=(DB.okrs||[]).filter(o=>!o._shadow);
  if(!S.uid||!can('okr','view'))return[];
  const sc=scopeOf('okr');
  if(sc==='everyone')return all;
  // 'none' means none. Previously it fell through and behaved like 'self'.
  if(sc==='none')return[];
  // 'self' means STRICTLY the objectives they own or co-own: no sub-objective
  // expansion, and creating an OKR for someone else does not grant sight of it.
  if(sc==='self')return all.filter(o=>okrOwnerIs(o,S.uid));
  const mine=new Set();
  // 1) ownership floor
  all.forEach(o=>{if(okrOwnerIs(o,S.uid)||o.createdBy===S.uid)mine.add(o.id);});
  // 2) scope extension — owner-based (ANY of the owners), resolved by the same scopeFilter every other area uses
  if(sc==='team'||sc==='department'||sc==='location'){
    const f=scopeFilter('okr');
    all.forEach(o=>{if(okrOwners(o).some(id=>f(id)))mine.add(o.id);});
    if(sc==='department'){
      // an OKR ASSIGNED to my department (own or inherited from its ancestors) is departmental
      // work — visible even if its owner sits elsewhere
      const myDept=(me()||{}).department;
      const dRow=myDept?(DB.departments||[]).find(d=>d.name===myDept):null;
      if(dRow)all.forEach(o=>{const eff=okrDeptOf(o);if(eff.deptId===dRow.id||eff.subDeptId===dRow.id)mine.add(o.id);});
    }
  }
  // 3) subtree rule
  [...mine].forEach(id=>okrDescendants(id).forEach(d=>mine.add(d.id)));
  return all.filter(o=>mine.has(o.id));
}
/* Single source of truth for "may this user lay eyes on this objective at all".
   Used to guard the detail, edit, move, revise and check-in paths — the list was
   already filtered, but those entry points are reachable directly by id. */
function okrCanSee(o){
  if(!o||o._shadow)return false;
  if(!S.uid||!can('okr','view'))return false;
  const sc=scopeOf('okr');
  if(sc==='everyone')return true;
  if(sc==='none')return false;
  if(sc==='self')return okrOwnerIs(o,S.uid);
  return okrVisible().some(v=>v.id===o.id);
}
/* Children of a node, narrowed to what this user is allowed to see. */
function okrChildrenVisible(id){const vis=new Set(okrVisible().map(o=>o.id));return okrChildren(id).filter(c=>vis.has(c.id));}
// Visible roots: a visible node whose parent is missing or not visible renders as top level.
function okrVisibleRoots(){const vis=okrVisible();const ids=new Set(vis.map(o=>o.id));return vis.filter(o=>!o.parentId||!ids.has(o.parentId)).sort((a,b)=>((a.sort||0)-(b.sort||0))||String(a.createdAt||'').localeCompare(String(b.createdAt||'')));}
/* ── Per-OKR activity trail + targeted Supabase writers ── */
function okrLog(okrId,action,details){
  const entry={id:uid('okl'),okrId:okrId,actorId:S.uid,action:action,details:details||{},createdAt:new Date().toISOString()};
  DB.okrLogs=DB.okrLogs||[];DB.okrLogs.unshift(entry);
  sbWrite({table:'okr_logs',op:'insert',id:entry.id,values:{id:entry.id,okr_id:okrId,actor_id:entry.actorId,action:action,details:entry.details,created_at:entry.createdAt}},{label:'OKR activity',silent:true});
}
function _okrPush(o){return sbWrite({table:'okrs',op:'upsert',id:o.id,values:_okrRow(o),opts:{onConflict:'id'}},{label:'OKR'});}
function _okrPushCheckin(c){return sbWrite({table:'okr_checkins',op:'upsert',id:c.id,values:_okrCheckinRow(c),opts:{onConflict:'id'}},{label:'OKR update'});}
/* ── v3.11: OKR notifications — one helper for every OKR event.
   In-app: gated by Settings → In-App → OKRs toggles (inapp_<evKey>).
   Email:  sendEmail() itself applies the Settings → Email toggles (email_<evKey>),
           the per-user "email notifications" switch and the custom template. ── */
function _okrNotify(ids,evKey,text,vars){
  [...new Set((ids||[]).filter(Boolean))].filter(id=>id!==S.uid).forEach(id=>{
    try{
      if(typeof _ns==='undefined'||!_ns||_ns['inapp_'+evKey]!==false){
        const n={id:uid('n'),userId:id,text:text,time:new Date().toISOString(),read:false,kind:'okr'};
        DB.notifications.unshift(n);
        sb.from('notifications').insert({id:n.id,user_id:id,text:n.text,read:false,created_at:n.time}).then(()=>{}).catch(()=>{});
      }
    }catch(e){}
    try{if(typeof sendEmail==='function')sendEmail(evKey,id,vars||{}).catch(()=>{});}catch(e){}
  });
}
function _okrNotifyAssigned(o,ids){
  _okrNotify(ids,'okr_assigned','🎯 New OKR assigned to you: "'+(o.title||'')+'" — '+_okrFreqLabel(o),{
    okr_title:o.title||'',assigner:fullName(me()),
    target:o.metricType==='yesno'?'Yes':_okrFmtVal(o,o.targetValue),
    schedule:_okrFreqLabel(o),
    period:(o.periodStart||o.periodEnd)?(fmtS(o.periodStart)+' → '+fmtS(o.periodEnd)):'Ongoing'
  });
}

/* ===== OKR TAB (UI) — hierarchical objectives =====
   One tab. Summary cards on top → "due today" combined check-in panel → the L0 tree.
   Every node expands to its children (L1 under L0, L2 under L1, …) and carries TWO
   node card opens ONE popup on click — Progress & Updates (goal + rules summary, current
   value, roll-up graph, check-ins with comments & photos, manual status marking, per-OKR
   activity log). Every change writes an okr_logs entry. (v3.11: the separate Rules & Target
   panel was removed — its info lives at the top of the Progress popup + the editor.) */
/* v3.14: which branches of the tree are open is restored from localStorage, so a refresh
   (or coming back tomorrow) does not collapse the whole tree back to the roots. */
let _OKR_EXP=(typeof loadOkrExpanded==='function'?loadOkrExpanded():{}),_OKR_LOGS={},_OKRED=null,_OKRCI=null,_OKRCIALL=null,_OKR_QVK={};
/* v3.13 — BULK EDIT: ids ticked on the cards + the draft of what the bulk dialog will write.
   _OKRBULK.on is the per-field "apply this one" switch; a field is only written when ticked. */
let _OKRSEL=new Set(),_OKRBULK=null,_OKR_SHOWN=[];
/* Everything the current view/filters are showing that this user is allowed to change —
   what "Select all" ticks and what the selection counter measures itself against. */
function _okrSelectable(){return _OKR_SHOWN.map(okrById).filter(Boolean).filter(_okrCanEditNode);}
/* Anything on screen the user may see — the export needs no edit rights. */
function _okrSelectableView(){return _OKR_SHOWN.map(okrById).filter(Boolean).filter(okrCanSee);}
App._okrTogSel=(id)=>{if(_OKRSEL.has(id))_OKRSEL.delete(id);else _OKRSEL.add(id);rr();};
App._okrSelAll=()=>{const all=_okrSelectable();const every=all.length&&all.every(o=>_OKRSEL.has(o.id));if(every)all.forEach(o=>_OKRSEL.delete(o.id));else all.forEach(o=>_OKRSEL.add(o.id));rr();};
App._okrSelClear=()=>{_OKRSEL=new Set();rr();};
/* Quarterly-view hierarchy: a quarter's virtual parent is the SAME-LABEL quarter of its
   nearest ancestor annual — so "B2C Growth — Q1" (L1) nests under "Domestic Growth — Q1" (L0). */
function _okrQParent(qn){
  if(!qn||!qn.quarterLabel||!qn.parentId)return null;
  const lbl=String(qn.quarterLabel).trim().toLowerCase();
  let cur=okrById(qn.parentId),g=0;
  while(cur&&g++<15){
    if(!cur.parentId)return null;
    const anc=okrById(cur.parentId);
    if(!anc)return null;
    if(anc.isAnnual){
      const m=okrChildren(anc.id).find(k=>k.quarterLabel&&String(k.quarterLabel).trim().toLowerCase()===lbl);
      if(m)return m;
    }
    cur=anc;
  }
  return null;
}
const _OKR_LVL_T=['#0F3038','#0F8A84','#0A544F','#7C3AED','#8A5F00','#DB2777'];      /* the same hues as TEXT on white, AA-safe */
function _okrCanManage(){return can('okr','manage');}
function _okrCanCreate(){return can('okr','create')||_okrCanManage();}
function _okrCanEditNode(o){return can('okr','edit')||_okrCanManage()||o.createdBy===S.uid||okrOwnerIs(o,S.uid);} // any owner can edit
function _okrCanCheckin(o){
  if(o&&(o.rollup||o.isAnnual||o.closed))return false;
  if(!okrCanSee(o))return false;
  if(!can('okr','checkin')&&!_okrCanManage())return false;   // the 'checkin' permission was declared but never enforced
  return okrOwnerIs(o,S.uid)||_okrCanEditNode(o);
}
/* Deleting is gated on the declared 'delete' permission, not merely on ownership. */
function _okrCanDelete(o){return okrCanSee(o)&&_okrCanEditNode(o)&&(can('okr','delete')||_okrCanManage());}
function _okrLvlChip(lvl){const c=_OKR_LVL_T[lvl%_OKR_LVL_T.length];return`<span style="flex-shrink:0;display:inline-flex;align-items:center;font-size:11.5px;font-weight:800;line-height:1;color:${c};letter-spacing:.02em">L${lvl}</span>`;}
/* Annual / quarter tags shown next to the level chip — keeps the tree readable at a glance. */
function _okrAnnualChip(){return`<span title="Annual objective — updates automatically from its quarterly objectives" style="flex-shrink:0;display:inline-flex;align-items:center;font-size:10px;font-weight:800;line-height:1;padding:3px 7px;border-radius:6px;background:#F5EBCC;color:#8A6E14;border:1px solid #E6D9A8;letter-spacing:.04em">ANNUAL</span>`;}
/* Quarter tags removed from the rows — the Quarterly view already groups by quarter,
   so repeating "Q1" on every line was noise. Kept as a no-op so call sites stay put. */
function _okrQtrChip(label){return'';}
I.move='<polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/>';
/* TZ-safe date helpers (toISOString shifts a day in +TZ — use local fields like todayISO does) */
const _okrISO=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
function _okrDateAddD(iso,n){const d=new Date(iso+'T00:00:00');d.setDate(d.getDate()+n);return _okrISO(d);}
function _okrDateAddM(iso,m){const d=new Date(iso+'T00:00:00');d.setMonth(d.getMonth()+m);return _okrISO(d);}

/* ═══ Move an objective to another parent / level — the WHOLE subtree moves with it ═══ */
let _OKRMV=null; // {id, targetId(''=top level), deptId, subDeptId}
function _okrMoveOptions(excl){
  const out=[];
  const walk=(o,depth)=>{
    if(excl.has(o.id))return;
    out.push([o.id,' '.repeat(depth*3)+'L'+okrLevel(o)+' · '+(o.title||'Untitled')+(o.quarterLabel?' ['+o.quarterLabel+']':'')]);
    okrChildren(o.id).forEach(k=>walk(k,depth+1));
  };
  okrVisibleRoots().forEach(r=>walk(r,0));
  return out;
}
App._okrMove=(id)=>{
  const o=okrById(id);if(!o)return;
  if(!okrCanSee(o)||!_okrCanEditNode(o))return toast('You can\u2019t move this OKR','err');
  const root=okrRootOf(o);
  _OKRMV={id:id,targetId:o.parentId||'',deptId:o.departmentId||(root?root.departmentId:null)||'',subDeptId:o.subDepartmentId||''};
  App._renderOKRMove();
};
App._okrMvSetTarget=(v)=>{if(_OKRMV){_OKRMV.targetId=v;App._renderOKRMove();}};
App._renderOKRMove=()=>{
  const d=_OKRMV;if(!d)return;
  const o=okrById(d.id);if(!o)return;
  const excl=new Set([o.id,...okrDescendants(o.id).map(x=>x.id)]);
  const opts=_okrMoveOptions(excl);
  const desc=okrDescendants(o.id);
  const target=d.targetId?okrById(d.targetId):null;
  const newLvl=target?(okrLevel(target)+(o.quarterLabel?0:1)):0; // a quarterly split lands AT the target's level, not below it
  const curParent=o.parentId?okrById(o.parentId):null;
  const L='display:block;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px';
  const deptOpts=(topDepts()||[]).map(x=>[x.id,x.name]);
  const subOpts=d.deptId?(subDepts(d.deptId)||[]).map(s=>[s.id,s.name]):[];
  const same=(d.targetId||'')===(o.parentId||'');
  modalShell({title:'Move objective',sub:o.title||'',size:'max-w-md',key:'okr-move',
    body:`<div style="display:flex;flex-direction:column;gap:14px">
      <div style="font-size:12px;color:var(--c-text-2);background:var(--c-surface-2);border-radius:10px;padding:9px 12px;line-height:1.5">Currently <b>L${okrLevel(o)}</b>${curParent?' under “'+esc(curParent.title||'—')+'”':' (top level)'}${desc.length?` · its <b>${desc.length}</b> sub-objective${desc.length===1?'':'s'} move with it`:''}.</div>
      <div><label style="${L}">New parent</label>
        <select class="ui-select rf" onchange="App._okrMvSetTarget(this.value)">
          <option value="" ${!d.targetId?'selected':''}>◎ Top level (becomes an L0 objective)</option>
          ${opts.map(([id2,label])=>`<option value="${esc(id2)}" ${d.targetId===id2?'selected':''}>${esc(label)}</option>`).join('')}
        </select>
        <div style="font-size:11px;color:var(--c-text-3);margin-top:6px">You can pick any objective at any level — its own branch is excluded so a loop can't be created.</div>
      </div>
      ${!d.targetId?`<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><label style="${L}">Department *</label><select class="ui-select rf" onchange="_OKRMV.deptId=this.value||'';_OKRMV.subDeptId='';App._renderOKRMove()"><option value="">— Select department —</option>${deptOpts.map(x=>`<option value="${esc(x[0])}" ${d.deptId===x[0]?'selected':''}>${esc(x[1])}</option>`).join('')}</select></div>
        <div><label style="${L}">Sub-department</label><select class="ui-select rf" ${subOpts.length?'':'disabled'} onchange="_OKRMV.subDeptId=this.value||''"><option value="">${subOpts.length?'— All / none —':'No sub-departments'}</option>${subOpts.map(s=>`<option value="${esc(s[0])}" ${d.subDeptId===s[0]?'selected':''}>${esc(s[1])}</option>`).join('')}</select></div>
      </div>`:''}
      <div style="display:flex;gap:8px;align-items:center;background:${same?'var(--c-surface-2)':'var(--c-info-soft)'};border:1px solid ${same?'var(--c-border)':'#BFE3DF'};border-radius:10px;padding:9px 12px;font-size:12px;color:${same?'var(--c-text-3)':'#0B5F5A'}">${ic('move','w-3.5 h-3.5')}${same?'No change yet — pick a different parent above.':`Will become <b>&nbsp;L${newLvl}&nbsp;</b>${target?' under “'+esc(target.title||'—')+'”':' at the top level'}${desc.length?' — sub-objectives shift level with it':''}.`}</div>
      ${o.quarterLabel&&!same?`<div style="font-size:11.5px;color:#7A4E00;background:#FDF3D9;border-radius:9px;padding:8px 11px">This is a quarterly objective — moving it away from its annual objective stops it feeding that annual number.</div>`:''}
    </div>`,
    footer:btnG('Cancel','_OKRMV=null;App.closeModal()')+btnP('Move here','App._okrMoveSave()')});
};
App._okrMoveSave=()=>{
  const d=_OKRMV;if(!d)return;
  const o=okrById(d.id);if(!o)return;
  if(!_okrCanEditNode(o))return toast('You can\'t move this OKR','err');
  const newParentId=d.targetId||null;
  if((newParentId||'')===(o.parentId||''))return toast('Pick a different parent first','warn');
  if(newParentId){
    const t=okrById(newParentId);
    if(!t)return toast('That parent no longer exists','err');
    if(newParentId===o.id||okrDescendants(o.id).some(x=>x.id===newParentId))return toast('You can\'t move an objective under its own sub-objective','err');
  }else{
    if(!d.deptId)return toast('Assign the objective to a department — top-level objectives need one','err');
  }
  const oldParent=o.parentId?okrById(o.parentId):null;
  const oldLvl=okrLevel(o);
  const newParent=newParentId?okrById(newParentId):null;
  o.parentId=newParentId;
  // v3.11: every level can carry its own department — moving under a parent no longer wipes it
  // (empty = inherits the parent's). Moving to top level applies the picked department.
  if(!newParentId){o.departmentId=d.deptId||null;o.subDepartmentId=d.subDeptId||null;}
  o.sort=okrChildren(newParentId).filter(x=>x.id!==o.id).length;
  // The parent changed, so the server's level map is stale for this whole branch — a move
  // UP would otherwise keep reporting the old, deeper level until the next refresh.
  _okrRelevel(o.id);
  const desc=okrDescendants(o.id);
  okrLog(o.id,'Moved objective',{changes:[
    {field:'Parent',from:oldParent?(oldParent.title||'—'):'Top level',to:newParent?(newParent.title||'—'):'Top level'},
    {field:'Level',from:'L'+oldLvl,to:'L'+okrLevel(o)}
  ].concat(desc.length?[{field:'Moved with it',from:'',to:desc.length+' sub-objective'+(desc.length===1?'':'s')}]:[])});
  if(newParentId)_OKR_EXP[newParentId]=true;
  _okrPush(o);
  _OKRMV=null;saveDB();closeModal();toast('Objective moved — now L'+okrLevel(o));rr();
};

/* ═══ Close / Reopen — freeze an objective for the record (reason required) ═══
   Closed = no updates, no check-in reminders, no revisions; the card stays in the list
   (greyed, "Closed" status) with its full history + the reason, and can be reopened. */
App._okrCloseAsk=(id)=>{
  const o=okrById(id);if(!o)return;
  if(!_okrCanEditNode(o))return toast('You can\'t close this OKR','err');
  const desc=okrDescendants(id);
  modalShell({title:'Close objective',sub:o.title||'',size:'max-w-md',key:'okr-close',
    body:`<div style="display:flex;flex-direction:column;gap:12px">
      <div style="font-size:12.5px;color:var(--c-text-2);line-height:1.55">Closing freezes this objective — no more updates, check-ins or reminders. It stays in the list with its full history so the record is kept, and it can be reopened anytime.</div>
      ${desc.length?`<div style="font-size:11.5px;color:#7A4E00;background:#FDF3D9;border-radius:9px;padding:8px 11px">Its ${desc.length} sub-objective${desc.length===1?'':'s'} stay open — close them separately if needed.</div>`:''}
      <div><label class="ui-label">Reason for closing *</label>
      <textarea id="okr-close-reason" rows="2" class="ui-input rf" placeholder="e.g. Deprioritised after the H2 strategy review" style="resize:vertical"></textarea></div>
    </div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP('Close objective',`App._okrCloseGo('${id}')`)});
};
App._okrCloseGo=(id)=>{
  const o=okrById(id);if(!o)return;
  if(!_okrCanEditNode(o))return toast('You can\'t close this OKR','err');
  const reason=($('#okr-close-reason')?.value||'').trim();
  if(!reason)return toast('Add the reason — it\'s kept on the record','err');
  o.closed=true;o.closedReason=reason;o.closedAt=new Date().toISOString();o.closedBy=S.uid;
  okrLog(id,'Closed objective',{reason:reason});
  _okrNotify(okrOwners(o),'okr_closed','🔒 OKR closed: "'+(o.title||'')+'" — '+reason,{okr_title:o.title||'',actor:fullName(me()),status:'closed',reason:reason});
  _okrPush(o);saveDB();closeModal();toast('Objective closed — kept for record');rr();
};
App._okrReopen=async(id)=>{
  const o=okrById(id);if(!o)return;
  if(!_okrCanEditNode(o))return toast('You can\'t reopen this OKR','err');
  if(!(await confirmP({
    title:'Reopen objective',
    body:'<b>'+esc(o.title||'This objective')+'</b> goes back to being active.',
    items:['updates and check-ins resume',(o.isAnnual?'it keeps updating from its quarterly objectives':o.rollup?'it keeps updating from the level below':'its owners start getting check-in reminders again'),'the closing reason stays in the activity log'],
    confirmLabel:'Reopen',cancelLabel:'Leave it closed',danger:false,icon:'unlock'})))return;
  okrLog(id,'Reopened objective',{was:o.closedReason||''});
  const _wasReason=o.closedReason||'';
  o.closed=false;o.closedReason='';o.closedAt=null;o.closedBy=null;
  _okrNotify(okrOwners(o),'okr_closed','🔓 OKR reopened: "'+(o.title||'')+'" — updates resume',{okr_title:o.title||'',actor:fullName(me()),status:'reopened',reason:_wasReason});
  _okrPush(o);saveDB();toast('Objective reopened');rr();
};
/* ── Revise targets: the node + its DIRECT sub-objectives in one compact screen.
   Originals are never modified; entering the original value removes that revision. ── */
App._okrRevise=(id)=>{
  const o=okrById(id);if(!o)return;
  if(!okrCanSee(o)||!_okrCanEditNode(o))return toast('You can\u2019t revise this OKR','err');
  if(o.closed)return toast('This objective is closed — reopen it first','err');
  const rows=[o,...okrChildren(o.id)].filter(x=>x.metricType!=='yesno');
  if(!rows.length)return toast('Yes/No objectives can\'t be revised','err');
  const inp=(x)=>`<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--c-border)">
      ${_okrLvlChip(okrLevel(x))}
      <div style="flex:1;min-width:0"><div style="font-size:12.5px;font-weight:700;color:var(--c-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.title||'Untitled')}</div>
      <div style="font-size:10.5px;color:var(--c-text-3)">Original ${esc(_okrFmtTarget(x,x.targetValue))}${okrHasRevision(x)?' · currently revised to '+esc(_okrFmtTarget(x,x.revisedTarget)):''}</div></div>
      <input type="number" step="any" data-rev-id="${x.id}" value="${okrHasRevision(x)?x.revisedTarget:(x.targetValue!==null&&x.targetValue!==undefined?x.targetValue:'')}" class="ui-input" style="width:128px;min-height:36px;padding:6px 9px;font-size:12.5px;flex-shrink:0"/>
    </div>`;
  modalShell({title:'Revise targets',sub:'Originals stay untouched — the same updates feed both, so you can compare growth.',size:'max-w-md',key:'okr-rev',
    body:`<div style="font-size:11.5px;color:var(--c-text-3);margin-bottom:6px">Set the new target per objective. Enter the <b>original</b> value to remove a revision.</div>
      <div>${rows.map(inp).join('')}</div>
      <div style="margin-top:14px"><label class="ui-label">Reason *  <span style="font-weight:500;color:var(--c-text-3)">(kept on record — shown next to the revised target)</span></label>
      <input id="okr-rev-note" class="ui-input rf" value="${esc(o.revisedNote||'')}" placeholder="e.g. Market slowdown — H2 targets adjusted"/></div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP('Save revision','App._okrReviseSave()')});
};
App._okrReviseSave=()=>{
  const note=($('#okr-rev-note')?.value||'').trim();
  const at=new Date().toISOString();
  // Pre-pass: collect what would change, so the reason can be REQUIRED before anything is written.
  const ops=[];
  document.querySelectorAll('[data-rev-id]').forEach(el=>{
    const o=okrById(el.getAttribute('data-rev-id'));if(!o)return;
    const raw=String(el.value||'').trim();if(raw==='')return;
    const v=parseFloat(raw);if(!isFinite(v))return;
    const orig=(o.targetValue===null||o.targetValue===undefined)?null:Number(o.targetValue);
    const had=okrHasRevision(o);
    if(orig!==null&&v===orig){if(had)ops.push({o:o,type:'clear',orig:orig});return;}
    if(had&&Number(o.revisedTarget)===v&&(o.revisedNote||'')===note)return;
    ops.push({o:o,type:'set',v:v,had:had,orig:orig});
  });
  if(!ops.length){closeModal();return toast('No changes','ok');}
  if(ops.some(x=>x.type==='set')&&!note)return toast('Add the reason for this revision — it\'s kept and shown next to the revised target','err');
  let changed=0,cleared=0;
  ops.forEach(op=>{
    const o=op.o;
    if(op.type==='clear'){
      okrLog(o.id,'Revision removed',{changes:[{field:'Revised target',from:o.revisedTarget,to:'(original '+op.orig+')'}]});
      o.revisedTarget=null;o.revisedNote='';o.revisedAt=null;o.revisedBy=null;cleared++;_okrPush(o);
    }else{
      okrLog(o.id,op.had?'Revision updated':'Target revised',{reason:note,changes:[{field:'Revised target',from:op.had?o.revisedTarget:op.orig,to:op.v}]});
      const _fromV=op.had?o.revisedTarget:op.orig;
      o.revisedTarget=op.v;o.revisedNote=note;o.revisedAt=at;o.revisedBy=S.uid;changed++;_okrPush(o);
      _okrNotify(okrOwners(o),'okr_target_revised','✏️ Target revised on "'+(o.title||'')+'": '+_okrFmtVal(o,_fromV)+' → '+_okrFmtVal(o,op.v)+(note?' — '+note:''),{okr_title:o.title||'',actor:fullName(me()),old_target:_okrFmtVal(o,op.orig),new_target:_okrFmtVal(o,op.v),reason:note});
    }
  });
  saveDB();closeModal();rr();
  toast('Revision saved ✓ — '+changed+' target'+(changed===1?'':'s')+' revised'+(cleared?', '+cleared+' restored to original':''),'ok');
};
App._okrTogQtr=(q)=>{const a=S.filters.okrQtr||[];S.filters.okrQtr=a.includes(q)?a.filter(x=>x!==q):[...a,q];S.filters.okrQtrOpen=true;rr();};
/* ── v3.11: multi-select filter helpers ── */
App._okrMSOpen=(k)=>{S.filters.okrMSOpen=S.filters.okrMSOpen===k?null:k;S.filters.okrQtrOpen=false;rr();};
App._okrTogF=(k,v)=>{const a=Array.isArray(S.filters[k])?S.filters[k]:(S.filters[k]?[S.filters[k]]:[]);S.filters[k]=a.includes(v)?a.filter(x=>x!==v):[...a,v];S.filters.okrMSOpen=k;rr();};
function _okrFArr(k){const v=S.filters[k];return Array.isArray(v)?v:(v?[v]:[]);}
/* Does `o` pass the (multi-select) department / sub-department / owner / status / level filters? */
function _okrMatchF(o,fDept,fSub,fOwn,fSt,fLvl,fDir){
  if(fDept.length||fSub.length){
    const eff=okrDeptOf(o);
    if(fDept.length&&!fDept.includes(eff.deptId))return false;
    if(fSub.length&&!fSub.includes(eff.subDeptId))return false;
  }
  if(fOwn.length&&!okrOwners(o).some(id=>fOwn.includes(id)))return false;
  if(fSt.length&&!fSt.includes(okrStatusOf(o)))return false;
  if(fLvl.length&&!fLvl.includes(String(okrLevel(o))))return false;
  if(fDir&&fDir.length&&!fDir.includes(okrDirOf(o)))return false;
  return true;
}
/* ── v3.11: summary "number cards" are clickable — list exactly which OKRs make the number,
   each row opens that OKR's Progress & Updates. ── */
App._okrSummaryList=(key)=>{
  const vis=okrVisible();
  const hits=vis.filter(o=>key==='all'?true:okrStatusOf(o)===key);
  // tree order (pre-order walk) so parents come before their children
  const _ord={};let _oi=0;
  const _walk=(o)=>{_ord[o.id]=_oi++;okrChildren(o.id).forEach(_walk);};
  (DB.okrs||[]).filter(o=>!o.parentId||!okrById(o.parentId)).sort((a,b)=>((a.sort||0)-(b.sort||0))||String(a.createdAt||'').localeCompare(String(b.createdAt||''))).forEach(_walk);
  hits.sort((a,b)=>((_ord[a.id]!==undefined?_ord[a.id]:1e9)-(_ord[b.id]!==undefined?_ord[b.id]:1e9)));
  const rows=hits.map(o=>{
    const pct=okrProgress(o),st=okrStatusOf(o);
    const owners=okrOwners(o).map(uById).filter(Boolean);
    const eff=okrDeptOf(o);const dept=(DB.departments||[]).find(d=>d.id===eff.deptId);
    return `<div onclick="App._okrProgressModal('${o.id}')" style="display:flex;align-items:center;gap:9px;padding:9px 8px;border-radius:10px;cursor:pointer" onmouseover="this.style.background='var(--c-surface-2)'" onmouseout="this.style.background='transparent'">
      ${_okrLvlChip(okrLevel(o))}${o.quarterLabel?_okrQtrChip(o.quarterLabel):''}${o.isAnnual?_okrAnnualChip():''}
      <div style="flex:1;min-width:0">
        <div style="font-size:12.5px;font-weight:700;color:var(--c-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(o.title||'Untitled')}</div>
        <div style="font-size:10.5px;color:var(--c-text-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${owners.length?esc(owners.map(fullName).join(', ')):'No owner'}${dept?' · '+esc(dept.name):''}</div>
      </div>
      ${okrNoPct(o)?'':`<div style="width:56px;height:4px;background:var(--c-border);border-radius:2px;overflow:hidden;flex-shrink:0"><div style="height:100%;width:${pct===null?0:Math.max(0,Math.min(100,pct))}%;background:${_okrBarColor(st)}"></div></div>
      <span class="fd" style="font-size:12px;font-weight:800;color:var(--c-text);width:40px;text-align:right;flex-shrink:0">${pct===null?'—':pct+'%'}</span>`}
      ${okrStatusChip(st,true)}
      <span style="color:var(--c-text-3);flex-shrink:0">${ic('chevR','w-3.5 h-3.5')}</span>
    </div>`;
  }).join('');
  modalShell({title:key==='all'?'All OKRs':(key+' — OKRs'),sub:hits.length+' objective'+(hits.length===1?'':'s')+' behind this number · tap one to open it',size:'max-w-lg',key:'okr-sum',
    body:rows||'<p style="font-size:13px;color:var(--c-text-3)">No OKRs in this bucket right now.</p>'});
};
let _OKR_FLTOPEN=false; // v3.16: the filter chips live in a collapsible panel — this is its open state (per session, not persisted)
App._okrTogFilters=()=>{_OKR_FLTOPEN=!_OKR_FLTOPEN;S.filters.okrMSOpen=null;S.filters.okrQtrOpen=false;rr();};
App._okrTogExp=(id)=>{const _qv=(S.filters.okrView==='quarter');const cur=_qv?(_OKR_EXP[id]!==false):!!_OKR_EXP[id];_OKR_EXP[id]=!cur;saveOkrExpanded(_OKR_EXP);rr();};
/* Logout / login without a page reload: the in-memory map has to be reset too, otherwise
   the next person's first expand writes the PREVIOUS person's branch ids back to disk. */
App._okrResetExpanded=()=>{_OKR_EXP={};saveOkrExpanded({});};
App._okrReloadExpanded=()=>{_OKR_EXP=loadOkrExpanded();};
App._okrNodeLogs=(id)=>{
  const o=okrById(id);if(!o)return;
  const logs=(DB.okrLogs||[]).filter(l=>l.okrId===id).slice(0,80);
  const fmtDetail=(d)=>{
    if(!d||typeof d!=='object'||!Object.keys(d).length)return'';
    if(Array.isArray(d.changes))return d.changes.map(c=>typeof c==='string'?c:(c.field?`${c.field}: ${c.from??'—'} → ${c.to??'—'}`:JSON.stringify(c))).join(' · ');
    return Object.entries(d).map(([k,v])=>`${k}: ${typeof v==='object'?JSON.stringify(v):v}`).join(' · ');
  };
  const rows=logs.map(l=>{const a=uById(l.actorId);const det=fmtDetail(l.details);
    return `<div style="display:flex;gap:10px;padding:9px 2px;border-bottom:1px solid var(--c-border)">
      <div style="flex-shrink:0;margin-top:1px">${a?avatar(a,'w-7 h-7','text-[10px]'):`<div style="width:28px;height:28px;border-radius:50%;background:var(--c-surface-2)"></div>`}</div>
      <div style="min-width:0;flex:1">
        <div style="font-size:12.5px;color:var(--c-text)"><b>${esc(a?fullName(a):'Someone')}</b> · ${esc(l.action||'')}</div>
        ${det?`<div style="font-size:11.5px;color:var(--c-text-2);margin-top:1px">${esc(det)}</div>`:''}
        <div style="font-size:11px;color:var(--c-text-3);margin-top:1px">${esc(l.createdAt?new Date(l.createdAt).toLocaleString():'')}</div>
      </div></div>`;}).join('');
  modalShell({title:'Change log',sub:o.title||'',size:'max-w-lg',
    body:rows||'<p style="font-size:13px;color:var(--c-text-3)">No changes logged yet.</p>'});
};
App._okrActivity=()=>{
  const rows=(DB.okrLogs||[]).slice(0,100).map(l=>{
    const o=okrById(l.okrId);const a=uById(l.actorId);
    const when=l.createdAt?new Date(l.createdAt).toLocaleString():'';
    return `<div style="display:flex;gap:10px;padding:9px 2px;border-bottom:1px solid var(--c-border)">
      <div style="flex-shrink:0;margin-top:1px">${a?avatar(a,'w-7 h-7','text-[10px]'):`<div style="width:28px;height:28px;border-radius:50%;background:var(--c-surface-2)"></div>`}</div>
      <div style="min-width:0;flex:1">
        <div style="font-size:12.5px;color:var(--c-text)"><b>${esc(a?fullName(a):'Someone')}</b> · ${esc(l.action||'')}</div>
        <div style="font-size:11.5px;color:var(--c-text-3)">${esc(o?o.title:'(deleted objective)')} — ${esc(when)}</div>
      </div></div>`;
  }).join('');
  modalShell({title:'OKR activity',sub:'All OKR changes — kept separate from the main audit log',size:'max-w-lg',
    body:rows||'<p style="font-size:13px;color:var(--c-text-3)">No OKR activity yet.</p>'});
};
function _okrPMRefresh(id){
  // If the Progress & Updates popup is open for this OKR, rebuild it so status/check-in
  // changes show IMMEDIATELY (page behind the modal already re-renders via rr()).
  try{const el=document.getElementById('okr-pm');if(el&&el.getAttribute('data-okr')===id)App._okrProgressModal(id);}catch(e){}
}
App._okrCkDel=async(okrId,ckId)=>{
  const o=okrById(okrId);if(!o)return;
  const c=(DB.okrCheckins||[]).find(x=>x.id===ckId);if(!c)return;
  if(o.rollup)return toast('This objective updates from the level below — its past updates are read-only history','warn');
  if(!(c.userId===S.uid||_okrCanManage()||okrOwnerIs(o,S.uid)))return toast('Only the author, an owner or a manager can delete an update','err');
  // This button lives INSIDE the Progress & Updates popup, and the app has one modal slot —
  // the confirm takes it over. Note whether the popup was open so it can be put back, on
  // Cancel as well as after the delete; otherwise saying "no" costs you the popup you were
  // reading, and saying "yes" leaves _okrPMRefresh with no #okr-pm element to refresh.
  let _pmWasOpen=false;
  try{const el=document.getElementById('okr-pm');_pmWasOpen=!!(el&&el.getAttribute('data-okr')===okrId);}catch(e){}
  const _reopen=()=>{if(_pmWasOpen)App._okrProgressModal(okrId);};
  if(!(await confirmP({
    title:'Delete update',
    body:'The value <b>'+esc(_okrFmtVal(o,c.value))+'</b> recorded on <b>'+esc(fmtS(c.date))+'</b> will be removed from <b>'+esc(o.title||'this objective')+'</b>.',
    items:[c.comment?'its comment':'',(c.photos||[]).filter(p=>typeof p==='string'&&p!=='[photo]').length?'its photo(s)':'','progress and the graph recalculate without it'].filter(Boolean),
    note:'The deletion itself is written to the activity log.',
    confirmLabel:'Delete update',cancelLabel:'Keep it'})))return _reopen();
  App._okrCkDelGo(okrId,ckId);
  _reopen();
};
App._okrCkDelGo=(okrId,ckId)=>{
  const c=(DB.okrCheckins||[]).find(x=>x.id===ckId);if(!c)return;
  DB.okrCheckins=DB.okrCheckins.filter(x=>x.id!==ckId);
  okrLog(okrId,'Deleted check-in',{date:c.date,value:c.value});
  sbWrite({table:'okr_checkins',op:'delete',id:ckId,match:{col:'id',val:ckId}},{label:'OKR update delete'});
  saveDB();toast('Update deleted');rr();_okrPMRefresh(okrId);
};
App._okrProgressModal=(id)=>{
  const o=okrById(id);if(!o)return;
  if(!okrCanSee(o))return toast('You don\u2019t have access to that objective','err');
  // An annual's progress panel lists ONLY what feeds it — its quarters. Regular sub-objectives
  // (L1s etc.) have their own cards and panels. With the roll-up override on, all children feed it.
  const kids=o.isAnnual?okrChildrenVisible(o.id).filter(k=>k.quarterLabel):okrChildrenVisible(o.id); // v3.19: annual ⇒ quarters always
  const pct=okrProgress(o),st=okrStatusOf(o);
  modalShell({title:'Progress & Updates',sub:(o.title||'')+(okrNoPct(o)?'':' — '+(pct===null?'no data yet':pct+'%')),size:'max-w-2xl',key:'okr-pm',
    body:`<div id="okr-pm" data-okr="${o.id}" style="margin:-6px -2px 0">${_okrProgressPanel(o,kids,pct,st)}</div>`});
  setTimeout(()=>{try{_drawOKRCharts();}catch(e){}},80);
};
App._okrTogLogs=(id)=>{_OKR_LOGS[id]=!_OKR_LOGS[id];rr();};

function okrPage(){
  const vis=okrVisible(),canCreate=_okrCanCreate();
  const today=todayISO();
  const head=hdr('OKRs','Objectives & key results — inputs roll up L2 → L1 → L0',btn('Activity','App._okrActivity()',{variant:'ghost',icon:'audit'})+(canCreate?btn('New L0 objective','App._okrEdit(null,null)',{variant:'primary',icon:'plus'}):''));
  // ── Summary cards — clickable (v3.11): tap a number to see exactly which OKRs it counts ──
  const sts=vis.map(o=>okrStatusOf(o));
  const cnt=x=>sts.filter(s=>s===x).length;
  const scard=(label,n,bg,fg,icon,key)=>`<div role="button" tabindex="0" onclick="App._okrSummaryList('${key}')" onkeydown="if(event.key==='Enter')App._okrSummaryList('${key}')" title="See which OKRs these are" style="flex:1;min-width:108px;background:var(--c-surface);border:1px solid var(--c-border);border-radius:11px;padding:7px 10px;display:flex;align-items:center;gap:8px;cursor:pointer;transition:border-color .12s" onmouseover="this.style.borderColor='var(--c-text)'" onmouseout="this.style.borderColor='var(--c-border)'"><span style="width:30px;height:30px;border-radius:9px;background:${bg};color:${fg};display:grid;place-items:center;flex-shrink:0">${ic(icon,'w-4 h-4')}</span><span style="min-width:0"><span class="fd" style="display:block;font-size:17px;font-weight:800;line-height:1;color:var(--c-text)">${n}</span><span style="display:block;font-size:10.5px;color:var(--c-text-2);margin-top:2px;white-space:nowrap">${label}</span></span></div>`;
  const summary=`<div class="okr-stats">
    ${scard('Total OKRs',vis.length,'var(--c-brand-soft)','var(--c-brand-ink)','chart','all')}
    ${scard('Achieved',cnt('Achieved'),'#F0E4BE','#0B5F37','check','Achieved')}
    ${scard('On track',cnt('On track'),'#E4F2F0','#0B6660','approve','On track')}
    ${scard('Off track',cnt('Off track'),'#FEEEEF','#C41E32','alert','Off track')}
    ${scard('Not achieved',cnt('Not achieved'),'#FEF0F0','#991B1B','x','Not achieved')}
    ${cnt('No data')?scard('No data',cnt('No data'),'#F4F9FA','#5E767D','help','No data'):''}
    ${cnt('Closed')?scard('Closed',cnt('Closed'),'#DFEAEC','#2F4C55','lock','Closed'):''}
  </div>`;
  // ── My check-ins due today (combined task list — GROUP rule: any owner's update counts) ──
  const due=okrDueForUser(S.uid,today);
  const pendDue=due.filter(o=>!okrCheckinForDate(o.id,today));
  const duePanel=due.length?`<div style="background:${pendDue.length?'var(--c-warn-soft)':'var(--c-success-soft)'};border:1px solid ${pendDue.length?'#FBE6A6':'#B7F0C8'};border-radius:14px;padding:14px 16px;margin-bottom:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <span style="width:38px;height:38px;border-radius:11px;background:var(--c-surface);color:${pendDue.length?'var(--c-warn-ink)':'var(--c-success-ink)'};display:grid;place-items:center;flex-shrink:0">${ic('clock','w-5 h-5')}</span>
      <div style="flex:1;min-width:180px">
        <div class="fd" style="font-size:14px;font-weight:800;color:var(--c-text)">OKR check-ins due today</div>
        <div style="font-size:12.5px;color:var(--c-text-2);margin-top:2px">${due.length-pendDue.length}/${due.length} updated · ${pendDue.length?esc(pendDue.slice(0,3).map(o=>o.title).join(', '))+(pendDue.length>3?' +'+(pendDue.length-3)+' more':''):'all done for today'}</div>
      </div>
      ${btn(pendDue.length?('Update now ('+pendDue.length+')'):'Review / edit',`App._okrCheckinAll('${today}')`,{variant:pendDue.length?'primary':'ghost',icon:'edit'})}
    </div>`:'';
  // ── Filters (v3.11: department / sub-department / owner / status / level are ALL multi-select) ──
  const F=S.filters;
  // Two views only: 'annual' (default — quarterly splits hidden, clean annual tree) and
  // 'quarter' (a TREE of quarters that mirrors the annual hierarchy: L1 Q1 nests under L0 Q1).
  const _view=(F.okrView==='quarter')?'quarter':'annual';
  const fDept=_okrFArr('okrDept'),fSub=_okrFArr('okrSub'),fOwn=_okrFArr('okrOwner'),fSt=_okrFArr('okrStatus'),fLvl=_okrFArr('okrLvl').map(String),fDir=_okrFArr('okrDir');
  const fActive=!!(fDept.length||fSub.length||fOwn.length||fSt.length||fLvl.length||fDir.length||F.okrQ||(F.okrQtr||[]).length);
  const _dName=id=>{const d=(DB.departments||[]).find(x=>x.id===id);return d?d.name:id;};
  const deptIds=[...new Set(vis.map(o=>okrDeptOf(o).deptId).filter(Boolean))];
  const subIds=[...new Set(vis.map(o=>okrDeptOf(o)).filter(e=>e.subDeptId&&(!fDept.length||fDept.includes(e.deptId))).map(e=>e.subDeptId))];
  const ownerIds=[...new Set(vis.flatMap(o=>okrOwners(o)))];
  /* v3.14: list the levels that actually occur rather than 0…max. Now that levels are the
     TRUE depth, someone who only sees their own objectives may have nothing above L3, and
     offering them L0/L1/L2 filters that can never match reads as broken. */
  //   Levels already ticked are kept in the list even when nothing matches them any more,
  //   so a filter remembered from a previous session can still be seen and unticked.
  const lvlsPresent=[...new Set([...vis.map(o=>okrLevel(o)),..._okrFArr('okrLvl').map(Number)])]
    .filter(n=>Number.isFinite(n)).sort((a,b)=>a-b);
  const _qy2=Number(F.okrQtrYear)||new Date().getFullYear();
  const _qsel=F.okrQtr||[];
  const _QR=_okrQuarterRanges(_qy2);
  const _qLabel=(_view==='quarter'?'Quarterly':'Annual')+(_qsel.length?' · '+_qsel.slice().sort().join(', ')+' · '+_qy2:'');
  const _navB='width:26px;height:26px;border-radius:8px;border:1px solid var(--c-border-2);background:var(--c-surface);color:var(--c-text-2);cursor:pointer;font-size:14px;font-weight:800;display:grid;place-items:center';
  const _fOn=!!(_qsel.length||_view==='quarter');
  const _vBtn=(v,label)=>{const on=_view===v;return`<button onclick="S.filters.okrView='${v}';S.filters.okrQtrOpen=true;rr()" style="flex:1;padding:5px 4px;border-radius:7px;border:none;background:${on?'var(--c-ink)':'transparent'};color:${on?'#fff':'var(--c-text-2)'};font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap">${label}</button>`;};
  const qtrDrop=`<div style="position:relative">
      <button onclick="S.filters.okrMSOpen=null;S.filters.okrQtrOpen=!S.filters.okrQtrOpen;rr()" style="display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 11px;border-radius:9px;border:1.5px solid ${_fOn?'var(--c-text)':'var(--c-border-2)'};background:${_fOn?'var(--c-ink)':'var(--c-surface)'};color:${_fOn?'#fff':'var(--c-text-2)'};font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap">${ic('calendar','w-3.5 h-3.5')}${esc(_qLabel)}${ic('chevD','w-3 h-3')}</button>
      ${F.okrQtrOpen?`<div style="position:absolute;top:37px;left:0;z-index:60;background:var(--c-surface);border:1px solid var(--c-border);border-radius:12px;box-shadow:var(--sh-md);padding:10px;width:238px">
        <div style="display:flex;gap:3px;background:var(--c-surface-2);border-radius:9px;padding:3px;margin-bottom:9px">
          ${_vBtn('annual','Annual')}${_vBtn('quarter','Quarterly')}
        </div>
        ${_view==='annual'?`<div style="font-size:10.5px;color:var(--c-text-3);margin:-3px 0 8px;line-height:1.45">The clean annual tree — quarterly splits are tucked away in the Quarterly view.</div>`:''}
        ${_view==='quarter'?`<div style="font-size:10.5px;color:var(--c-text-3);margin:-3px 0 8px;line-height:1.45">Quarters keep the annual hierarchy — an L1's Q1 sits under the L0's Q1. Tick quarters below to narrow.</div>`:''}
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <button onclick="S.filters.okrQtrYear=${_qy2-1};rr()" style="${_navB}" aria-label="Previous year">‹</button>
          <span class="fd" style="font-size:13.5px;font-weight:800">${_qy2}</span>
          <button onclick="S.filters.okrQtrYear=${_qy2+1};rr()" style="${_navB}" aria-label="Next year">›</button>
        </div>
        ${['Q1','Q2','Q3','Q4'].map(q=>{const on=_qsel.includes(q);const r=_QR[q];return`<div role="checkbox" aria-checked="${on}" onclick="App._okrTogQtr('${q}')" style="display:flex;align-items:center;gap:9px;padding:7px 8px;border-radius:8px;cursor:pointer;${on?'background:var(--c-brand-soft);':''}" onmouseover="if(!${on})this.style.background='var(--c-surface-2)'" onmouseout="this.style.background='${on?'var(--c-brand-soft)':'transparent'}'">
          <span style="width:16px;height:16px;border-radius:5px;border:1.5px solid ${on?'var(--c-brand)':'var(--c-border-2)'};background:${on?'var(--c-brand)':'#fff'};display:grid;place-items:center;color:#fff;flex-shrink:0">${on?ic('check','w-3 h-3'):''}</span>
          <span style="flex:1;font-size:12.5px;font-weight:800;color:var(--c-text)">${q}</span>
          <span style="font-size:10.5px;color:var(--c-text-3)">${fmtS(r[0])} – ${fmtS(r[1])}</span>
        </div>`;}).join('')}
        <div style="display:flex;gap:6px;margin-top:9px">
          ${_fOn?`<button onclick="S.filters.okrQtr=[];S.filters.okrView='';rr()" class="ui-btn ui-btn-ghost ui-btn-sm" style="flex:1">Clear</button>`:''}
          <button onclick="S.filters.okrQtrOpen=false;rr()" class="ui-btn ui-btn-primary ui-btn-sm" style="flex:1">Done</button>
        </div>
        <div style="font-size:10.5px;color:var(--c-text-3);margin-top:8px;line-height:1.5">Shows every OKR whose period overlaps a selected quarter — a 6-month OKR appears in both. OKRs without dates are hidden while filtering.</div>
      </div>`:''}
    </div>`;
  // One generic multi-select dropdown (checkbox list) — used by every filter.
  const msDrop=(key,label,opts)=>{
    const sel=_okrFArr(key);
    const on=!!sel.length;
    const open=F.okrMSOpen===key;
    return `<div style="position:relative">
      <button onclick="App._okrMSOpen('${key}')" style="display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 11px;border-radius:9px;border:1.5px solid ${on?'var(--c-text)':'var(--c-border-2)'};background:${on?'var(--c-ink)':'var(--c-surface)'};color:${on?'#fff':'var(--c-text-2)'};font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap">${esc(label)}${on?`<span style="display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;border-radius:20px;padding:1px 6px;min-width:16px;background:rgba(255,255,255,.22)">${sel.length}</span>`:''}${ic('chevD','w-3 h-3')}</button>
      ${open?`<div style="position:absolute;top:37px;left:0;z-index:60;background:var(--c-surface);border:1px solid var(--c-border);border-radius:12px;box-shadow:var(--sh-md);padding:8px;width:232px">
        <div style="max-height:260px;overflow-y:auto">
        ${opts.length?opts.map(([v,l])=>{const onV=sel.includes(v);return`<div role="checkbox" aria-checked="${onV}" onclick="App._okrTogF('${key}','${String(v)}')" style="display:flex;align-items:center;gap:9px;padding:6px 8px;border-radius:8px;cursor:pointer;${onV?'background:var(--c-brand-soft);':''}" onmouseover="if(!${onV})this.style.background='var(--c-surface-2)'" onmouseout="this.style.background='${onV?'var(--c-brand-soft)':'transparent'}'">
          <span style="width:15px;height:15px;border-radius:5px;border:1.5px solid ${onV?'var(--c-brand)':'var(--c-border-2)'};background:${onV?'var(--c-brand)':'#fff'};display:grid;place-items:center;color:#fff;flex-shrink:0">${onV?ic('check','w-3 h-3'):''}</span>
          <span style="flex:1;font-size:12.5px;font-weight:600;color:var(--c-text);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(l)}</span>
        </div>`;}).join(''):'<div style="padding:10px;font-size:12px;color:var(--c-text-3)">Nothing to pick here.</div>'}
        </div>
        <div style="display:flex;gap:6px;margin-top:8px">
          ${sel.length?`<button onclick="S.filters.${key}=[];rr()" class="ui-btn ui-btn-ghost ui-btn-sm" style="flex:1">Clear</button>`:''}
          <button onclick="S.filters.okrMSOpen=null;rr()" class="ui-btn ui-btn-primary ui-btn-sm" style="flex:1">Done</button>
        </div>
      </div>`:''}
    </div>`;
  };
  /* v3.14 — the bar also has to survive an EMPTY result, not just an empty workspace. Gating
     it on `vis.length` alone produced two dead ends: filter down to nothing and the "Clear
     all" button that would rescue you disappears with the bar, and delete your last visible
     objective and the "Deleted" button you need to restore it goes too. Shown whenever there
     is anything to show, a filter to clear, or a recycle bin to reach. */
  const _canBin=can('okr','delete')||_okrCanManage();
  const _fCnt=(fDept.length?1:0)+(fSub.length?1:0)+(fOwn.length?1:0)+(fSt.length?1:0)+(fLvl.length?1:0)+(fDir.length?1:0)+(((F.okrQ||'').trim())?1:0)+((F.okrQtr||[]).length?1:0);
  const _fltBtn=`<button onclick="App._okrTogFilters()" title="Show / hide filters" style="display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 11px;border-radius:9px;border:1.5px solid ${(_OKR_FLTOPEN||_fCnt)?'var(--c-text)':'var(--c-border-2)'};background:${_OKR_FLTOPEN?'var(--c-ink)':'var(--c-surface)'};color:${_OKR_FLTOPEN?'#fff':'var(--c-text-2)'};font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap">${ic('filter','w-3.5 h-3.5')}Filters${_fCnt?`<span style="display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;border-radius:20px;padding:1px 6px;min-width:16px;background:${_OKR_FLTOPEN?'rgba(255,255,255,.22)':'var(--c-brand)'};color:#fff">${_fCnt}</span>`:''}<span style="transform:${_OKR_FLTOPEN?'rotate(180deg)':'none'};display:inline-flex">${ic('chevD','w-3 h-3')}</span></button>`;
  const fBar=(vis.length||fActive||_view==='quarter'||_canBin)?`<div class="ui-card okr-toolbar" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:8px 10px;margin-bottom:${_OKR_FLTOPEN?'8px':'14px'};overflow:visible">
      ${qtrDrop}
      <input id="okr-q" value="${esc(F.okrQ||'')}" oninput="S.filters.okrQ=this.value;App._searchRR('okr-q')" placeholder="Search…" class="ui-input" style="flex:1;min-width:110px;height:32px;min-height:0;padding:4px 12px;font-size:12.5px"/>
      ${_fltBtn}
      ${fActive||_view==='quarter'?`<button onclick="S.filters.okrQ='';S.filters.okrDept=[];S.filters.okrSub=[];S.filters.okrOwner=[];S.filters.okrStatus=[];S.filters.okrLvl=[];S.filters.okrDir=[];S.filters.okrQtr=[];S.filters.okrView='';S.filters.okrQtrOpen=false;S.filters.okrMSOpen=null;rr()" class="ui-btn ui-btn-ghost ui-btn-sm">Clear</button>`:''}
    </div>${_OKR_FLTOPEN?`<div class="ui-card okr-fpanel" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:10px 12px;margin-bottom:14px;overflow:visible">
      ${msDrop('okrDept','Departments',deptIds.map(id=>[id,_dName(id)]))}
      ${(subIds.length||fSub.length)?msDrop('okrSub','Sub-departments',subIds.map(id=>[id,_dName(id)])):''}
      ${msDrop('okrOwner','Owners',ownerIds.map(id=>{const u2=uById(id);return[id,u2?fullName(u2):id];}))}
      ${msDrop('okrStatus','Status',['Achieved','On track','Off track','Not achieved','No data','Closed'].map(s=>[s,s]))}
      ${msDrop('okrDir','Which way is good?',OKR_DIRS.map(d=>[d[0],d[1]]))}
      ${msDrop('okrLvl','Level',lvlsPresent.map(i=>[String(i),'L'+i]))}
      ${_canBin?`<button onclick="App._okrRecycle()" title="Objectives that were deleted — restore them or erase them for good" class="ui-btn ui-btn-ghost ui-btn-sm" style="margin-left:auto">${ic('trash','w-3.5 h-3.5')}Deleted</button>`:''}
    </div>`:''}`:'';
  // ── Three renderings: quarterly hierarchy tree · flat filtered list · the annual tree ──
  let tree;
  if(_view==='quarter'){
    // QUARTERLY VIEW — quarters keep the SAME hierarchy as their annuals: each quarter nests
    // under the matching quarter (same label) of its nearest ancestor annual (L1 Q1 → under L0 Q1).
    const q2=(F.okrQ||'').toLowerCase();
    const _qy=Number(F.okrQtrYear)||new Date().getFullYear();
    const qNodes=vis.filter(o=>o.quarterLabel).filter(o=>{
      if((F.okrQtr||[]).length&&!_okrInQuarters(o,F.okrQtr,_qy))return false;
      if(!_okrMatchF(o,fDept,fSub,fOwn,fSt,fLvl,fDir))return false;
      if(q2&&!((o.title||'').toLowerCase().includes(q2)||(o.description||'').toLowerCase().includes(q2)))return false;
      return true;
    });
    const qSet=new Set(qNodes.map(o=>o.id));
    _OKR_QVK={};
    const qRoots=[];
    qNodes.forEach(qn=>{
      const p=_okrQParent(qn);
      if(p&&qSet.has(p.id))(_OKR_QVK[p.id]=_OKR_QVK[p.id]||[]).push(qn);
      else qRoots.push(qn);
    });
    const byAnnual=(a,b)=>{const pa=okrById(a.parentId),pb=okrById(b.parentId);return(((pa&&pa.sort)||0)-((pb&&pb.sort)||0))||String(a.periodStart||'').localeCompare(String(b.periodStart||''))||((a.sort||0)-(b.sort||0));};
    const byLvl=(a,b)=>(okrLevel(a)-okrLevel(b))||byAnnual(a,b);
    Object.keys(_OKR_QVK).forEach(k=>_OKR_QVK[k].sort(byLvl));
    qRoots.sort(byLvl);
    _OKR_SHOWN=qNodes.map(x=>x.id);
    tree=qRoots.length?dismissNote('okr-qview',`Quarterly view — quarters keep their annual hierarchy${(F.okrQtr||[]).length?'':' · tick quarters in the filter to focus on one'}`,{icon:'calendar',style:'margin-bottom:8px'})+qRoots.map(o=>_okrNodeHTML(o,0)).join('')
      :empty('chart','No quarterly objectives','Turn on the “Annual objective” toggle on an objective to split it into quarters.');
  }else if(fActive){
    const q=(F.okrQ||'').toLowerCase();
    const _qy=Number(F.okrQtrYear)||new Date().getFullYear();
    const hits=vis.filter(o=>{
      if(o.quarterLabel)return false; // annual view: the quarterly splits live in the Quarterly view
      if((F.okrQtr||[]).length&&!_okrInQuarters(o,F.okrQtr,_qy))return false;
      if(!_okrMatchF(o,fDept,fSub,fOwn,fSt,fLvl,fDir))return false;
      if(q&&!((o.title||'').toLowerCase().includes(q)||(o.description||'').toLowerCase().includes(q)))return false;
      return true;
    });
    // Flat list follows TREE order (pre-order walk) — an annual's quarters stay together, then
    // its other sub-objectives, instead of raw creation order interleaving them confusingly.
    const _ord={};let _oi=0;
    const _walkOrd=(o)=>{_ord[o.id]=_oi++;okrChildren(o.id).forEach(_walkOrd);};
    (DB.okrs||[]).filter(o=>!o.parentId||!okrById(o.parentId)).sort((a,b)=>((a.sort||0)-(b.sort||0))||String(a.createdAt||'').localeCompare(String(b.createdAt||''))).forEach(_walkOrd);
    hits.sort((a,b)=>((_ord[a.id]!==undefined?_ord[a.id]:1e9)-(_ord[b.id]!==undefined?_ord[b.id]:1e9)));
    _OKR_SHOWN=hits.map(x=>x.id);
    tree=hits.length?`<div style="font-size:11.5px;color:var(--c-text-3);margin-bottom:8px">${hits.length} match${hits.length===1?'':'es'} — showing flat list</div>`+hits.map(o=>_okrNodeHTML(o,0)).join('')
      :empty('chart','Nothing matches','Try clearing a filter.');
  }else{
    // Annual tree (default) — quarterly splits live in the Quarterly view
    _OKR_SHOWN=vis.filter(o=>!o.quarterLabel).map(x=>x.id);
    const roots=okrVisibleRoots().filter(o=>!o.quarterLabel);
    tree=roots.length?roots.map(o=>_okrNodeHTML(o,0)).join('')
      :empty('chart','No OKRs yet',canCreate?'Create your first L0 objective, assign it to a department and an owner, then add L1 / L2 sub-objectives under it.':'No OKRs have been assigned to you yet. Your manager creates them.');
  }
  /* ── v3.13 BULK BAR — appears the moment anything is ticked. Selection survives
     re-renders and filter changes; "Select all" only ever covers what's on screen
     AND editable by this user, so the count never promises more than it can do. ── */
  const _selectable=_okrSelectable();
  const _selCount=[..._OKRSEL].map(okrById).filter(Boolean).length;
  const _allOn=_selectable.length>0&&_selectable.every(x=>_OKRSEL.has(x.id));
  const bulkBar=vis.length?`<div class="ui-card okr-bulkbar" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;padding:${_selCount?'10px 13px':'7px 13px'};margin-bottom:12px;${_selCount?'border-color:var(--c-brand);background:var(--c-brand-soft)':''}">
      <button onclick="App._okrSelAll()" style="display:inline-flex;align-items:center;gap:8px;background:transparent;border:none;cursor:pointer;padding:0;color:var(--c-text)">
        <span style="width:17px;height:17px;border-radius:5px;border:1.5px solid ${_allOn?'var(--c-brand)':'var(--c-border-2)'};background:${_allOn?'var(--c-brand)':'var(--c-surface)'};display:grid;place-items:center;color:#fff;flex-shrink:0">${_allOn?ic('check','w-3 h-3'):''}</span>
        <span style="font-size:12px;font-weight:700">${_allOn?'Deselect all':'Select all'} <span style="color:var(--c-text-3);font-weight:600">(${_selectable.length} on screen)</span></span>
      </button>
      ${_selCount?`<span style="font-size:12.5px;font-weight:800;color:var(--c-text)">${_selCount} selected</span>
        ${btn('Bulk edit '+_selCount+' objective'+(_selCount===1?'':'s'),'App._okrBulk()',{variant:'primary',size:'sm',icon:'edit'})}
        <button onclick="App._okrExport()" class="ui-btn ui-btn-ghost ui-btn-sm" title="Download these objectives with every update, revision and activity entry as an Excel workbook">Export to Excel</button>
        <button onclick="App._okrSelClear()" class="ui-btn ui-btn-ghost ui-btn-sm">Clear selection</button>`
      :`<span class="okr-bulkhint" style="flex:1;min-width:180px;font-size:11.5px;color:var(--c-text-3)">Tick the box on any objective to change several at once — owners, department, dates, targets, schedule, status, close or delete.</span>
        <button onclick="App._okrExport()" class="ui-btn ui-btn-ghost ui-btn-sm" title="Download every objective you can see — with all updates, revisions and activity — as an Excel workbook">Export to Excel</button>`}
    </div>`:'';
  return `<div class="fade">${head}${_howBar('okr')}${summary}${duePanel}${fBar}${bulkBar}<div>${tree}</div></div>`;
}

function _okrNodeHTML(o,depth){
  if(depth>10)return'';
  // Annual view: quarterly splits hidden (they live in the Quarterly view).
  // Quarterly view: children = the node's regular children + the matching child-annual quarters.
  const _qv=(S.filters.okrView==='quarter');
  const kids=_qv?[...okrChildrenVisible(o.id).filter(k=>!k.quarterLabel),...((_OKR_QVK&&_OKR_QVK[o.id])||[])]
              :okrChildrenVisible(o.id).filter(k=>!k.quarterLabel);
  const lvl=okrLevel(o);
  const exp=_qv?(_OKR_EXP[o.id]!==false):!!_OKR_EXP[o.id]; // quarterly hierarchy opens expanded
  const pct=okrProgress(o);
  const st=okrStatusOf(o);
  const barC=_okrBarColor(st);
  const owners=okrOwners(o).map(uById).filter(Boolean);
  const deptEff=okrDeptOf(o);
  const dept=(DB.departments||[]).find(d=>d.id===deptEff.deptId);
  const subDept=(DB.departments||[]).find(d=>d.id===deptEff.subDeptId);
  const canEdit=_okrCanEditNode(o);
  const icBtn='width:24px;height:24px;display:grid;place-items:center;border-radius:7px;color:var(--c-text-3);background:transparent;border:none;cursor:pointer;flex-shrink:0';
  const meta='font-size:10.5px;color:var(--c-text-2);display:inline-flex;align-items:center;gap:4px';
  /* ── v3.13 CARD ──────────────────────────────────────────────────────────────
     The six action icons are GONE — they live as labelled buttons inside the
     Progress & Updates popup, so the row is no longer a wall of tiny glyphs.
     What's left breathes: a select checkbox for bulk edit, the expand chevron,
     the title on its own line, a meta strip under it, and the numbers on the
     right. Clicking anywhere still opens the popup; the checkbox and the
     chevron stop propagation. ─────────────────────────────────────────────── */
  const _isLim=okrIsLimit(o);
  const _tgtTxt=okrHasRevision(o)?`<s style="opacity:.5">${_okrFmtVal(o,o.targetValue)}</s> ${_okrFmtVal(o,o.revisedTarget)}`:_okrFmtVal(o,o.targetValue);
  /* The separator carries the comparison, so the target is not prefixed a second time:
     "40 / 50" reaching a target \u00b7 "40 \u2264 50" a ceiling \u00b7 "99.2 \u2265 99" a floor. */
  const _sep=_okrTargetSign(o)||'/';
  /* v3.19 — current value and target are separate spans, not one string, so the mobile card can
     stack them (big number over "≤ 36%") while the desktop row still reads "39% ≤ 36%" inline. */
  const curTgt=o.metricType==='yesno'?`<span class="okr-curv">${(okrLatestCheckin(o.id)||{}).value>=1?'Done':'Not done'}</span>`
    :`<span class="okr-curv">${_okrFmtVal(o,_okrOwnCur(o))}</span><span class="okr-tgt"><span style="opacity:.55">${_sep}</span> ${_tgtTxt}</span>`;
  const ownersHTML=owners.length?`<span title="Owner${owners.length===1?'':'s'}: ${esc(owners.map(fullName).join(', '))}${owners.length>1?' — any of them can update':''}" style="flex-shrink:0;display:inline-flex;align-items:center;cursor:default">${owners.slice(0,3).map((u,i)=>`<span style="display:inline-flex;${i?'margin-left:-5px;':''}border-radius:50%;box-shadow:0 0 0 1.5px var(--c-surface)">${avatar(u,'w-5 h-5','text-[8px]')}</span>`).join('')}${owners.length>3?`<span style="font-size:9.5px;font-weight:800;color:var(--c-text-3);margin-left:4px">+${owners.length-3}</span>`:''}<span style="${meta};margin-left:5px">${esc(owners.map(fullName)[0]||'')}${owners.length>1?' +'+(owners.length-1):''}</span></span>`:'';
  const sel=_OKRSEL.has(o.id);
  const selBox=canEdit?`<button class="okr-selbox" onclick="event.stopPropagation();App._okrTogSel('${o.id}')" role="checkbox" aria-checked="${sel}" title="${sel?'Deselect':'Select for bulk edit'}" style="width:24px;height:24px;display:grid;place-items:center;border:none;background:transparent;cursor:pointer;flex-shrink:0"><span style="width:16px;height:16px;border-radius:5px;border:1.5px solid ${sel?'var(--c-brand)':'var(--c-border-2)'};background:${sel?'var(--c-brand)':'var(--c-surface)'};display:grid;place-items:center;color:#fff">${sel?ic('check','w-3 h-3'):''}</span></button>`:`<span class="okr-selbox" style="width:24px;flex-shrink:0"></span>`;
  const barTitle=okrIsThresh(o)?('Stay '+(okrDirOf(o)==='gte'?'at or above ':'at or below ')+_okrFmtVal(o,_okrTargetEff(o))+' \u2014 judged pass/fail, not scored as a %')
    :_isLim?('Stay under '+_okrFmtVal(o,_okrTargetEff(o))+' \u2014 judged pass/fail, not scored as a %')
    :pct===null?'No data yet':(pct+'% of target');
  // Indentation follows the tree ON SCREEN, not the absolute level — see okrLevelVisible().
  const _ind=_qv?okrLevelVisible(o):depth;const _indPx=(window.matchMedia&&window.matchMedia('(max-width:767px)').matches)?10:16;const card=`<div class="okr-card" onclick="App._okrProgressModal('${o.id}')" style="background:var(--c-surface);border:1px solid ${sel?'var(--c-brand)':'var(--c-border)'};${sel?'box-shadow:0 0 0 2px var(--c-brand-soft);':''}border-radius:12px;margin-bottom:6px;${_ind?'margin-left:'+Math.min(_ind,5)*_indPx+'px;':''}${o.closed?'opacity:.72;':''}overflow:hidden;cursor:pointer;transition:border-color .12s,box-shadow .12s" onmouseover="this.style.borderColor='${sel?'var(--c-brand)':'var(--c-text-3)'}'" onmouseout="this.style.borderColor='${sel?'var(--c-brand)':'var(--c-border)'}'" title="Open Progress &amp; Updates">
    <div class="okr-cardpad" style="padding:10px 13px">
      <div class="okr-row" style="display:flex;align-items:flex-start;gap:9px">
        ${selBox}
        ${kids.length?`<button class="okr-exp" onclick="event.stopPropagation();App._okrTogExp('${o.id}')" title="${exp?'Collapse':'Expand'} sub-objectives" style="${icBtn};transform:${exp?'rotate(90deg)':'none'}">${ic('chevR','w-4 h-4')}</button>`:`<span class="okr-exp okr-leaf" style="width:24px;flex-shrink:0;display:grid;place-items:center;height:24px"><span style="width:4px;height:4px;border-radius:50%;background:var(--c-border-2)"></span></span>`}
        <div class="okr-main" style="flex:1;min-width:140px">
          <div class="okr-titlerow" style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;min-width:0;row-gap:4px">
            ${_okrLvlChip(lvl)}${o.quarterLabel?_okrQtrChip(o.quarterLabel):''}${o.isAnnual?_okrAnnualChip():''}
            <span class="fd okr-title" style="font-size:13.5px;font-weight:600;color:var(--c-text);line-height:1.35;min-width:0">${esc(o.title||'Untitled')}</span>
            ${okrHasRevision(o)?`<span style="${meta};color:#8A5F00;font-weight:800" title="Target was revised — the original is kept for comparison">${ic('edit','w-3 h-3')}Revised</span>`:''}
          </div>
          <div class="okr-meta" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;row-gap:3px;margin-top:5px">
            ${ownersHTML}
            ${dept?`<span style="${meta}"${o.departmentId?'':' title="Inherited from the parent objective"'}>${ic('dept','w-3 h-3')}${esc(dept.name)}${subDept?' › '+esc(subDept.name):''}</span>`:''}
            ${o.periodStart||o.periodEnd?`<span style="${meta}">${ic('calendar','w-3 h-3')}${fmtS(o.periodStart)} → ${fmtS(o.periodEnd)}</span>`:''}
            ${kids.length?`<button class="okr-subtog" onclick="event.stopPropagation();App._okrTogExp('${o.id}')" title="${exp?'Collapse':'Expand'} sub-objectives" style="${meta};border:none;background:transparent;cursor:pointer;padding:0;font-weight:700">${ic('tree','w-3 h-3')}${kids.length} sub-objective${kids.length===1?'':'s'}<span style="display:inline-flex;transform:${exp?'rotate(180deg)':'none'};transition:transform .12s">${ic('chevD','w-3 h-3')}</span></button>`:''}
          </div>
        </div>
        <div class="okr-nums" style="display:flex;align-items:center;gap:10px;flex-shrink:0;margin-left:auto;padding-left:6px">
          <span class="okr-cur" style="font-size:11px;font-weight:700;color:var(--c-text-2);white-space:nowrap">${curTgt}</span>
          ${(okrNoPct(o)||pct===null)?'':`<div class="okr-bar" title="${barTitle}" style="width:70px;height:5px;background:var(--c-border);border-radius:3px;overflow:hidden;flex-shrink:0"><div style="height:100%;width:${Math.max(0,Math.min(100,pct))}%;background:${barC};border-radius:3px;transition:width .3s"></div></div>
          <span class="fd okr-pct" title="${barTitle}" style="font-size:13px;font-weight:800;color:var(--c-text);min-width:38px;text-align:right">${pct}%</span>`}
          <span class="okr-stwrap"${o.closed?` title="Closed${o.closedReason?': '+esc(o.closedReason):''}" style="display:inline-flex;cursor:default"`:''}>${okrStatusChip(st)}</span>
        </div>
      </div>
    </div>
  </div>`;
  return card+(exp?kids.map(k=>_okrNodeHTML(k,depth+1)).join(''):'');
}

/* ── Progress & Updates panel (v3.11: the ONE popup — the separate "Rules & Target" panel was
   removed as duplicated info; the goal + rules summary now sits at the top of this panel). ── */
/* ── Check-in comment formatting (display) ──────────────────────────────────
   Keeps the line breaks the user typed, renders bullet lines (-, *, •) as a real
   list, and **text** as bold. Everything is HTML-escaped FIRST, so user text can
   never inject markup. Used by the Updates & inputs feed. */
function _okrFmtComment(text){
  const raw=String(text==null?'':text);
  if(!raw.trim())return '&nbsp;';
  const inline=s=>esc(s).replace(/\*\*([^*\n]+?)\*\*/g,'<b>$1</b>');
  const lines=raw.split(/\r?\n/);
  let html='',inList=false;
  const closeList=()=>{if(inList){html+='</ul>';inList=false;}};
  lines.forEach(line=>{
    const m=line.match(/^\s*[•*\-]\s+(.*)$/);
    if(m){
      if(!inList){html+='<ul style="margin:3px 0;padding-left:18px;list-style:disc">';inList=true;}
      html+='<li style="margin:1px 0">'+inline(m[1])+'</li>';
    }else if(line.trim()===''){
      closeList();html+='<div style="height:7px"></div>';
    }else{
      closeList();html+='<div>'+inline(line)+'</div>';
    }
  });
  closeList();
  return html||'&nbsp;';
}
/* One-line, marker-stripped preview shown on the collapsed entry header. */
function _okrCommentPreview(text){
  const first=String(text==null?'':text).split(/\r?\n/).map(l=>l.trim()).find(l=>l!=='')||'';
  const clean=first.replace(/^\s*[•*\-]\s+/,'').replace(/\*\*/g,'');
  return clean.length>64?clean.slice(0,64).replace(/\s+$/,'')+'…':clean;
}
/* Expand / collapse a single check-in entry (DOM-only, no re-render). `head` is the
   clicked header row; its sibling [data-ck-body] holds the comment + photos. */
App._okrCkToggle=(head)=>{
  try{
    const body=head.parentElement.querySelector('[data-ck-body]');if(!body)return;
    const open=body.style.display!=='none';
    body.style.display=open?'none':'';
    const chev=head.querySelector('[data-ck-chev]');if(chev)chev.style.transform=open?'':'rotate(90deg)';
    const peek=head.querySelector('[data-ck-peek]');if(peek)peek.style.display=open?'':'none';
  }catch(e){}
};
/* Comment-box toolbar: insert a bullet on the current/selected line(s), or wrap the
   selection in **bold**. Fires the textarea's own input event so the model stays in sync. */
App._okrFmtInsert=(id,kind)=>{
  const ta=document.getElementById(id);if(!ta)return;
  const v=ta.value,s=ta.selectionStart==null?v.length:ta.selectionStart,e=ta.selectionEnd==null?v.length:ta.selectionEnd;
  let a,b;
  if(kind==='bold'){
    const sel=v.slice(s,e)||'bold';
    ta.value=v.slice(0,s)+'**'+sel+'**'+v.slice(e);a=s+2;b=s+2+sel.length;
  }else{
    const ls=v.lastIndexOf('\n',s-1)+1,pre=v.slice(0,ls),mid=v.slice(ls,e),post=v.slice(e);
    const out=mid.split('\n').map(l=>/^\s*[•*\-]\s+/.test(l)?l:('- '+l)).join('\n');
    ta.value=pre+out+post;a=b=(pre+out).length;
  }
  ta.focus();try{ta.setSelectionRange(a,b);}catch(_){}
  ta.dispatchEvent(new Event('input',{bubbles:true}));
};
function _okrProgressPanel(o,kids,pct,st){
  const last=okrLatestCheckin(o.id);
  const canCk=_okrCanCheckin(o);
  const lab='font-size:10px;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em;font-weight:700';
  const big='font-size:20px;font-weight:800;color:var(--c-text)';
  const _ownCur=_okrOwnCur(o);
  const cur=esc(_okrFmtVal(o,_okrOwnCur(o)));
  const tgt=o.metricType==='yesno'?'Yes':esc(_okrFmtTarget(o,o.targetValue));
  const strt=o.metricType==='yesno'?'No':esc(_okrFmtVal(o,o.startValue));
  /* ── v3.13: every per-objective ACTION lives here now. The six icon buttons were removed
     from the cards (which are back to being readable) and became labelled buttons in one
     row at the top of this popup. ── */
  const _canEd=_okrCanEditNode(o);
  const actBtn=(label,call,icon,danger)=>`<button type="button" onclick="${call}" style="display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border-radius:9px;border:1px solid var(--c-border);background:var(--c-surface);color:${danger?'#C41E32':'var(--c-text-2)'};font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap" onmouseover="this.style.borderColor='${danger?'#C41E32':'var(--c-text)'}'" onmouseout="this.style.borderColor='var(--c-border)'">${ic(icon,'w-3.5 h-3.5')}${esc(label)}</button>`;
  const _acts=[
    _okrCanCreate()?actBtn('Add sub-objective',"App.closeModal();App._okrEdit(null,'"+o.id+"')",'plus'):'',
    _canEd?actBtn('Edit',"App.closeModal();App._okrEdit('"+o.id+"')",'edit'):'',
    _canEd?actBtn('Move',"App.closeModal();App._okrMove('"+o.id+"')",'move'):'',
    (_canEd&&!o.closed&&o.metricType!=='yesno')?actBtn('Revise target',"App.closeModal();App._okrRevise('"+o.id+"')",'refresh'):'',
    _canEd?(o.closed?actBtn('Reopen',"App.closeModal();App._okrReopen('"+o.id+"')",'unlock'):actBtn('Close',"App.closeModal();App._okrCloseAsk('"+o.id+"')",'lock')):'',
    _canEd?actBtn('Delete',"App.closeModal();App._okrDelete('"+o.id+"')",'trash',true):''
  ].filter(Boolean).join('');
  const actionsBar=_acts?`<div style="display:flex;gap:6px;flex-wrap:wrap;padding-bottom:12px;margin-bottom:13px;border-bottom:1px solid var(--c-border)">${_acts}</div>`:'';
  /* "Lower is better" explainer — spells out what the two graph lines mean for this objective. */
  const _capV=_okrTargetEff(o);
  /* One note explaining how THIS objective's mode is scored — nothing for plain higher-is-better. */
  const dirNote=(()=>{ // v3.17 — the un-dismissable yellow essay is gone; instead: the ACTUAL arithmetic behind the %, with a × (remembered per browser)
    try{if(localStorage.getItem('bridge_note_okrmath'))return '';}catch(e){}
    if(o.metricType==='yesno')return '';
    const X=`<button onclick="event.stopPropagation();try{localStorage.setItem('bridge_note_okrmath','1')}catch(e){};App._okrProgressModal('${o.id}')" title="Hide this explanation" aria-label="Dismiss" style="margin-left:auto;flex-shrink:0;border:none;background:transparent;color:var(--c-text-3);cursor:pointer;font-size:14px;line-height:1;padding:0 2px">×</button>`;
    const wrap=t2=>`<div style="display:flex;gap:7px;align-items:flex-start;background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:9px;padding:7px 10px;margin-top:10px;font-size:11px;color:var(--c-text-2);line-height:1.55">${ic('info','w-3.5 h-3.5')}<span style="min-width:0">${t2}</span>${X}</div>`;
    const f=v2=>esc(_okrFmtVal(o,v2));
    if(okrIsLimit(o)){const t1=_okrTargetEff(o),v1=okrCurrentOf(o);return wrap(`No % here \u2014 an allowance is <b>pass/fail</b>: stay under ${f(t1)} for the period and it is met, break it and it is not.${(v1===null||v1===undefined)?'':` So far <b>${f(v1)}</b> of the ${f(t1)} allowance.`}`);}
    if(okrIsThresh(o)){const r=_okrReadings(o),ok=r.filter(x=>okrThreshOK(o,x.value)===true).length,t0=_okrTargetEff(o),av=_okrThreshAvg(o);return wrap(`No % here — a threshold objective is <b>pass/fail</b> against the ${f(t0)} line, judged on the <b>average of each reported day</b> this period${av===null?'':` (currently ${f(Math.round(av*100)/100)})`}. <b>${ok} of ${r.length}</b> update${r.length===1?'':'s'} stayed ${okrDirOf(o)==='gte'?'at or above':'at or below'} the line.`);}
    const p=okrProgress(o);if(p===null)return '';
    if(o.isAnnual){
      if(okrAnnualMode(o)==='progress')return wrap(`<b>${p}%</b> = the average of its quarters' progress, each counting equally.`);
      const vC=okrCurrentOf(o);
      return wrap(`<b>${p}%</b> — current value${vC===null?'':` <b>${f(vC)}</b>`} = the ${_okrAnnualModeLabel(o)}, measured against this annual's own start → target.`);
    }
    if(o.rollup)return wrap(`<b>${p}%</b> = ${esc(_okrModeLabel(o.rollupMode))} of its direct sub-objectives.`);
    const t=_okrTargetEff(o),s2=Number(o.startValue||0),v=okrCurrentOf(o);
    if(v===null||t===null||!isFinite(Number(t)))return '';
    if(Number(t)===s2)return wrap(`<b>${p}%</b> — hold the line at ${f(t)}: meeting it reads 100%.`);
    const raw=((Number(v)-s2)/(Number(t)-s2))*100;
    return wrap(`<b>${p}%</b> = (current − start) ÷ (target − start) = (${f(v)} − ${f(s2)}) ÷ (${f(t)} − ${f(s2)})${(isFinite(raw)&&raw<0)?' — the number has moved <b>backwards past the start value</b>, so progress reads negative':(p>100?' — target beaten':'')}.`);
  })();
  // manual status marking (owner / manager) — every mark is logged
  const markRow=canCk?`<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:10px">
      <span style="font-size:11px;font-weight:700;color:var(--c-text-3)">MARK:</span>
      ${OKR_STATUSES.map(s=>{const on=o.statusMode==='manual'&&o.statusManual===s;const m=OKR_ST_META[s];return`<button onclick="App._okrMarkStatus('${o.id}','${s}')" style="padding:4px 10px;border-radius:20px;border:1.5px solid ${on?m.dot:'var(--c-border)'};background:${on?m.bg:'var(--c-surface)'};color:${on?m.fg:'var(--c-text-2)'};font-size:11px;font-weight:700;cursor:pointer">${s}</button>`;}).join('')}
      <button onclick="App._okrMarkStatus('${o.id}','auto')" title="Let progress decide the status" style="padding:4px 10px;border-radius:20px;border:1.5px solid ${o.statusMode!=='manual'?'var(--c-text)':'var(--c-border)'};background:${o.statusMode!=='manual'?'var(--c-ink)':'var(--c-surface)'};color:${o.statusMode!=='manual'?'#fff':'var(--c-text-2)'};font-size:11px;font-weight:700;cursor:pointer">Auto</button>
    </div>`:'';
  const cmpBars=(okrHasRevision(o)&&!okrNoPct(o))?(function(){
    const pr=okrProgress(o),po=okrProgressOrig(o);
    const bar=(lbl,pct,col)=>`<div style="display:flex;align-items:center;gap:8px"><span style="width:88px;font-size:10.5px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.03em">${lbl}</span><div style="flex:1;height:6px;background:var(--c-border);border-radius:3px;overflow:hidden"><div style="height:100%;width:${pct===null?0:Math.max(0,Math.min(100,pct))}%;background:${col}"></div></div><span style="width:46px;text-align:right;font-size:11.5px;font-weight:800;color:var(--c-text)">${pct===null?'—':pct+'%'}</span></div>`;
    const who=o.revisedBy&&uById(o.revisedBy)?fullName(uById(o.revisedBy)):'';
    return `<div style="background:var(--c-surface);border:1px solid var(--c-border);border-radius:12px;padding:11px 13px;margin-top:12px">
      <div style="display:flex;flex-direction:column;gap:6px">${bar('vs revised',pr,'#E0A106')}${bar('vs original',po,'#0F766E')}</div>
      <div style="font-size:11px;color:var(--c-text-3);margin-top:8px">Revised${o.revisedAt?' '+fmtS(String(o.revisedAt).slice(0,10)):''}${who?' by '+esc(who):''}${o.revisedNote?' — “'+esc(o.revisedNote)+'”':''} · same updates feed both numbers</div>
    </div>`;})():'';
  const rollupNote=(o.rollup||o.isAnnual)?dismissNote('okr-auto-'+(o.isAnnual?'annual':'rollup'),
    (o.isAnnual?`This annual objective updates automatically from its quarterly objectives — ${okrAnnualMode(o)==='progress'?'its progress is the <b>&nbsp;combined progress of its quarters&nbsp;</b> (each quarter counts equally':'its current value is the <b>&nbsp;'+esc(_okrAnnualModeLabel(o))+'&nbsp;</b> (measured against its own start → target'}; the level below doesn't feed it).`
               :`This objective updates automatically — its current value is the <b>&nbsp;${esc(_okrModeLabel(o.rollupMode))}&nbsp;</b> of its direct sub-objectives.`),
    {icon:'refresh',style:'margin-top:10px',onDismiss:`App._okrProgressModal('${o.id}')`}):'';
  // check-in feed (latest first)
  const feed=okrCheckinsOf(o.id).slice().reverse().slice(0,30).map(c=>{
    const u=uById(c.userId);
    const photos=(c.photos||[]).filter(p=>typeof p==='string'&&p!=='[photo]');
    // co-owners can edit the group's entry — but NOT once the objective auto-updates from
    // the level below (v3.14): its number no longer comes from these entries, so they are
    // kept as read-only history rather than something that can still be edited or deleted.
    const canEditCk=!o.rollup&&(c.userId===S.uid||_okrCanManage()||okrOwnerIs(o,S.uid));
    const hasBody=!!c.comment||photos.length>0; // only entries with content collapse/expand
    const peekTxt=c.comment?_okrCommentPreview(c.comment):(photos.length?(photos.length+' photo'+(photos.length>1?'s':'')):'');
    const commentHtml=c.comment?`<div style="font-size:12px;color:var(--c-text-2);margin-top:5px;line-height:1.55">${_okrFmtComment(c.comment)}</div>`:'';
    const photosHtml=photos.length?`<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">${photos.map(p=>`<img src="${esc(p)}" onclick="App._bigImg('${esc(p)}')" alt="Check-in photo" style="width:44px;height:44px;object-fit:cover;border-radius:8px;cursor:pointer;border:1px solid var(--c-border)"/>`).join('')}</div>`:'';
    return `<div style="display:flex;gap:10px;padding:10px 0;border-top:1px solid var(--c-border)">
      <div style="width:64px;flex-shrink:0;font-size:11.5px;color:var(--c-text-2);font-weight:600">${esc(fmtS(c.date))}</div>
      <div style="flex:1;min-width:0">
        <div ${hasBody?'onclick="App._okrCkToggle(this)" ':''}style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;${hasBody?'cursor:pointer':''}">
          ${hasBody?`<span data-ck-chev style="display:inline-flex;flex-shrink:0;color:var(--c-text-3);transition:transform .15s">${ic('chevR','w-3.5 h-3.5')}</span>`:''}
          <span style="font-size:13px;font-weight:800;color:var(--c-brand-ink)">${esc(_okrFmtVal(o,c.value))}</span>
          ${c.statusMark?okrStatusChip(c.statusMark,true):''}
          <span style="font-size:11px;color:var(--c-text-3)">${u?esc(fullName(u)):'—'}</span>
          ${(c.editCount||0)>0?`<span style="font-size:9.5px;font-weight:800;background:#FDF3D9;color:#7A4E00;padding:1px 6px;border-radius:10px">edited ×${c.editCount}</span>`:''}
          ${hasBody&&peekTxt?`<span data-ck-peek style="max-width:220px;min-width:0;font-size:11px;color:var(--c-text-3);font-style:italic;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(peekTxt)}</span>`:''}
          ${canEditCk?`<button onclick="event.stopPropagation();App._okrCheckin('${o.id}','${c.date}')" title="Edit this update (logged)" style="width:22px;height:22px;display:grid;place-items:center;border-radius:6px;color:var(--c-text-3);background:transparent;border:none;cursor:pointer;flex-shrink:0">${ic('edit','w-3 h-3')}</button>`:''}${canEditCk?`<button onclick="event.stopPropagation();App._okrCkDel('${o.id}','${c.id}')" title="Delete this update (logged)" style="width:22px;height:22px;display:grid;place-items:center;border-radius:6px;color:var(--c-text-3);background:transparent;border:none;cursor:pointer;flex-shrink:0" onmouseover="this.style.color='#C41E32'" onmouseout="this.style.color='var(--c-text-3)'">${ic('trash','w-3 h-3')}</button>`:''}
        </div>
        ${hasBody?`<div data-ck-body style="display:none">${commentHtml}${photosHtml}</div>`:''}
      </div>
    </div>`;
  }).join('')||`<div style="padding:12px 0;color:var(--c-text-3);font-size:12.5px;border-top:1px solid var(--c-border)">No updates yet${canCk?' — add the first one.':'.'}</div>`;
  // children breakdown (roll-up view)
  const kidRows=kids.length?`<div style="margin-top:12px">
      <div style="${lab};margin-bottom:6px">${o.isAnnual?'Quarterly objectives — feeding this annual (other sub-objectives have their own panels)':o.rollup?('Sub-objectives — feeding this objective ('+esc(_okrModeLabel(o.rollupMode))+')'):'Sub-objectives (each tracks its own progress)'}</div>
      ${kids.map(k=>{const kp=okrProgress(k),ks=okrStatusOf(k);return`<div style="display:flex;align-items:center;gap:9px;padding:6px 0">
        ${_okrLvlChip(okrLevel(k))}${k.quarterLabel?_okrQtrChip(k.quarterLabel):''}
        <span style="flex:1;min-width:0;font-size:12.5px;font-weight:600;color:var(--c-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(k.title)}</span>
        ${okrNoPct(k)?'':`<div style="width:90px;height:5px;background:var(--c-border);border-radius:3px;overflow:hidden"><div style="height:100%;width:${kp===null?0:Math.max(0,Math.min(100,kp))}%;background:${_okrBarColor(ks)}"></div></div>`}
        <span style="font-size:10.5px;color:var(--c-text-3);white-space:nowrap">${k.metricType==='yesno'?((okrLatestCheckin(k.id)||{}).value>=1?'Done':'Not done'):esc(_okrFmtVal(k,_okrOwnCur(k)))+' '+(_okrTargetSign(k)||'/')+' '+esc(_okrFmtVal(k,_okrTargetEff(k)))}</span>${okrNoPct(k)?'':`<span style="font-size:12px;font-weight:800;color:var(--c-text);width:44px;text-align:right">${kp===null?'—':kp+'%'}</span>`}
        ${okrStatusChip(ks,true)}
      </div>`;}).join('')}
    </div>`:'';
  const logs=(DB.okrLogs||[]).filter(l=>l.okrId===o.id);
  return `<div style="border-top:1px solid var(--c-border);background:var(--c-surface-2);padding:14px 16px">
    ${actionsBar}
    <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:14px 18px;flex-wrap:wrap">
      <div style="flex:1 1 auto;min-width:0;display:flex;flex-wrap:wrap;gap:14px 26px;align-items:flex-end">
        ${okrIsThresh(o)?'':`<div style="min-width:84px"><div style="${lab};white-space:nowrap">Start</div><div style="${big}">${strt}</div></div>`}
        <div style="min-width:84px"><div style="${lab};white-space:nowrap">Current${(o.rollup||o.isAnnual)?' · auto':''}</div><div style="${big}">${cur}</div></div>
        <div style="min-width:84px"><div style="${lab};white-space:nowrap">${(()=>{const w=_okrTargetWord(o);const W=w.charAt(0).toUpperCase()+w.slice(1);return okrHasRevision(o)?('Original '+w):W;})()}</div><div style="${big}${okrHasRevision(o)?';text-decoration:line-through;opacity:.6':''}">${tgt}</div></div>
        ${okrHasRevision(o)?`<div style="min-width:84px"><div style="${lab};white-space:nowrap;color:#8A5F00">Revised ${_okrTargetWord(o)}</div><div style="${big};color:#8A5F00">${esc(_okrFmtTarget(o,o.revisedTarget))}</div></div>`:''}
        ${okrNoPct(o)?'':`<div style="min-width:84px"><div style="${lab};white-space:nowrap">Progress</div><div style="${big}">${pct===null?'—':pct+'%'}</div></div>`}${okrIsThresh(o)?`<div style="min-width:84px" title="Average of each reported day this period — this is what the status is judged on"><div style="${lab};white-space:nowrap">Daily average</div><div style="${big}">${(()=>{const av=_okrThreshAvg(o);return av===null?'—':esc(_okrFmtVal(o,Math.round(av*100)/100));})()}</div></div><div style="min-width:84px" title="Updates this period that stayed on the good side of the ${esc(_okrFmtVal(o,_okrTargetEff(o)))} line"><div style="${lab};white-space:nowrap">Held the line</div><div style="${big}">${(()=>{const r=_okrReadings(o);if(!r.length)return '—';return r.filter(x=>okrThreshOK(o,x.value)===true).length+' / '+r.length;})()}</div></div>`:''}
        <div style="min-width:84px"><div style="${lab};white-space:nowrap">Status</div><div style="margin-top:3px">${okrStatusChip(st)}</div></div>
      </div>
      ${canCk?`<div style="flex-shrink:0">${btn(kids.length?'Add note / update':'Add update',`App._okrCheckin('${o.id}','${todayISO()}')`,{variant:'primary',size:'sm',icon:'plus'})}</div>`:''}
    </div>
    ${dirNote}
    ${markRow}
    ${cmpBars}
    ${o.closed?`<div style="display:flex;gap:8px;align-items:center;background:#DFEAEC;border-radius:10px;padding:8px 12px;margin-top:10px;font-size:12px;color:#2F4C55">${ic('lock','w-3.5 h-3.5')}<b>Closed</b>&nbsp;${o.closedAt?esc(fmtS(String(o.closedAt).slice(0,10))):''}${o.closedBy&&uById(o.closedBy)?' by '+esc(fullName(uById(o.closedBy))):''}${o.closedReason?' — “'+esc(o.closedReason)+'”':''} · kept for record, updates are frozen</div>`:''}
    ${rollupNote}
    <div style="height:190px;background:var(--c-surface);border:1px solid var(--c-border);border-radius:12px;padding:10px;margin-top:12px;position:relative">
      ${okrNoPct(o)?'':`<div style="position:absolute;top:10px;right:12px;z-index:2;display:flex;align-items:baseline;gap:4px;background:var(--c-surface);padding:1px 8px;border-radius:8px;border:1px solid var(--c-border)"><span style="font-size:15px;font-weight:800;color:var(--c-text)">${pct===null?'—':pct+'%'}</span><span style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--c-text-3)">progress</span></div>`}
      <canvas data-okr-chart="${o.id}"></canvas>
    </div>
    ${kidRows}
    <div style="margin-top:12px">
      <div style="${lab};margin-bottom:2px">Updates & inputs</div>
      <div style="max-height:300px;overflow-y:auto">${feed}</div>
    </div>
    ${logs.length?`<button onclick="App._okrNodeLogs('${o.id}')" style="margin-top:10px;display:inline-flex;align-items:center;gap:6px;background:transparent;border:none;cursor:pointer;font-size:11.5px;font-weight:700;color:var(--c-text-3)">${ic('audit','w-3.5 h-3.5')}${logs.length} logged changes — view →</button>`:''}
  </div>`;
}

/* ── Node editor (create / edit any level) ── */
App._okrEdit=(id,parentId)=>{
  const existing=id?okrById(id):null;
  if(existing&&(!okrCanSee(existing)||!_okrCanEditNode(existing)))return toast('You can\u2019t edit this OKR','err');
  if(!existing&&!_okrCanCreate())return toast('You can\'t create OKRs','err');
  _OKRED=existing?JSON.parse(JSON.stringify(existing)):{id:uid('okr'),parentId:parentId||null,title:'',description:'',departmentId:null,subDepartmentId:null,ownerId:S.uid,owners:[S.uid],metricType:'number',startValue:0,targetValue:null,unit:'',direction:'up',frequency:{type:'weekly',day:'Mon'},periodStart:null,periodEnd:null,statusMode:'auto',statusManual:null,isAnnual:false,quarterLabel:null,sort:okrChildren(parentId||null).length,createdBy:S.uid,createdAt:new Date().toISOString()};
  delete _OKRED._qRows;delete _OKRED._qEdit;delete _OKRED._ownQ;
  if(existing&&existing.isAnnual)_OKRED._qEdit=_okrBuildQEdit(existing.id); // live quarter values — edits made on the quarters themselves show up here
  App._renderOKREdit();
};
/* Editable snapshot of the EXISTING quarterly objectives, always read fresh from the tree
   (so a change made on a quarter directly is what the annual's editor shows — and edits made
   here write back to those same quarter objectives on Save). */
function _okrBuildQEdit(id){return okrChildren(id).filter(k=>k.quarterLabel).map(k=>({id:k.id,label:k.quarterLabel,start:k.periodStart,end:k.periodEnd,startVal:(k.startValue===null||k.startValue===undefined)?0:k.startValue,target:(k.targetValue===null||k.targetValue===undefined)?null:k.targetValue}));}
App._okrEdQESet=(i,field,val)=>{
  const o=_OKRED;if(!o||!o._qEdit||!o._qEdit[i])return;
  if(field==='startVal'||field==='target')o._qEdit[i][field]=val===''?null:parseFloat(val);
  else o._qEdit[i][field]=val;
};
/* ── Annual objective → quarterly split (editor-side helpers) ──
   _OKRED._qRows holds the NEW quarterly periods being defined: [{label,start,end,startVal,target}].
   Fully flexible: keep 2, add 6, change any date — the defaults are only a starting point. */
/* ══ Split a period into REAL calendar quarters ═════════════════════════════════════════════
   Every calendar quarter the period overlaps, clipped to the period's own edges:
     Jan 1 – Dec 31  → Q1 · Q2 · Q3 · Q4                         (four full quarters)
     Jan 1 – Jul 31  → Q1 · Q2 · Q3 (Jul 1 – Jul 31)             (three, the last one short)
     Jun 1 – Feb 28  → Q2 (Jun 1–Jun 30) · Q3 · Q4 · Q1 '27      (year in the label once it wraps)
   A period that sits inside ONE calendar quarter is split into its MONTHS instead — asking to
   split "Q1" into four sub-quarters called Q1–Q4 is never what anyone means, and it used to
   produce ranges like "Q2 = Jan 24 – Feb 14" that no reporting period lines up with.
   This replaces the old behaviour of cutting the span into four equal day-slices, which only
   gave true quarters when the period was exactly Jan 1 – Dec 31.                            */
const _OKR_MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
function _okrMonthLen(y,m){return m===2?(((y%4===0&&y%100!==0)||y%400===0)?29:28):[31,28,31,30,31,30,31,31,30,31,30,31][m-1];}
function _okrMkISO(y,m,d){return y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');}
function _okrCalQuarters(ps,pe){
  if(!ps||!pe||pe<ps)return[];
  const y0=+ps.slice(0,4),m0=+ps.slice(5,7),y1=+pe.slice(0,4),m1=+pe.slice(5,7);
  if(!isFinite(y0)||!isFinite(m0)||!isFinite(y1)||!isFinite(m1))return[];
  const q0=Math.floor((m0-1)/3),q1=Math.floor((m1-1)/3);
  const out=[];
  // Inside a single calendar quarter → months, so a quarter can still be broken down usefully.
  if(y0===y1&&q0===q1){
    for(let m=m0;m<=m1;m++){
      out.push({label:_OKR_MONTHS[m-1],
        start:m===m0?ps:_okrMkISO(y0,m,1),
        end:m===m1?pe:_okrMkISO(y0,m,_okrMonthLen(y0,m))});
    }
    return out;
  }
  const multiYear=y0!==y1;
  let y=y0,q=q0;
  while(y*4+q<=y1*4+q1){
    const a=q*3+1,b=q*3+3;
    let s=_okrMkISO(y,a,1),e=_okrMkISO(y,b,_okrMonthLen(y,b));
    if(s<ps)s=ps;          // clip the first quarter to the period's start
    if(e>pe)e=pe;          // clip the last quarter to the period's end
    out.push({label:'Q'+(q+1)+(multiYear?(" '"+String(y).slice(2)):''),start:s,end:e});
    if(++q>3){q=0;y++;}
  }
  return out;
}
function _okrGenQRows(o){
  let ps=o.periodStart,pe=o.periodEnd;
  if(!ps||!pe){const y=new Date().getFullYear();ps=y+'-01-01';pe=y+'-12-31';o.periodStart=ps;o.periodEnd=pe;}
  const qs=_okrCalQuarters(ps,pe);
  const s=Number(o.startValue||0),t=(o.targetValue===null||o.targetValue===undefined)?null:Number(o.targetValue);
  const n=qs.length||1,round=x=>Math.round(x*100)/100;
  const mode=o.rollupMode||'latest';
  return qs.map((q,i)=>{
    let sv=0,tv=null;
    if(t!==null&&isFinite(t)){
      if(mode==='sum'){sv=0;tv=round(t/n);}                                    // each quarter contributes its share; year total = sum
      else if(mode==='avg'){sv=s;tv=t;}                                        // every quarter aims at the same rate; year = average
      else{sv=round(s+(t-s)*i/n);tv=round(s+(t-s)*(i+1)/n);}                   // latest/max/min: staircase from start → target
    }else{sv=(mode==='sum')?0:s;}
    return{label:q.label,start:q.start,end:q.end,startVal:sv,target:tv};
  });
}
App._okrEdTogAnnual=()=>{
  const o=_OKRED;if(!o)return;
  o.isAnnual=!o.isAnnual;
  if(o.isAnnual)o.rollup=false; // v3.19: an annual is quarters-only — the level-below toggle is hidden and off
  if(o.isAnnual){
    const hasQKids=okrById(o.id)&&okrChildren(o.id).some(k=>k.quarterLabel);
    o._qRows=hasQKids?[]:_okrGenQRows(o);
    o._qEdit=hasQKids?_okrBuildQEdit(o.id):null;
  }else{delete o._qRows;delete o._qEdit;if(/^q-/.test(o.rollupMode||''))o.rollupMode=o.rollupMode.slice(2);} // annual mode makes no sense off-annual — strip the prefix
  App._renderOKREdit();
};
App._okrEdReQ=()=>{const o=_OKRED;if(!o||!o.isAnnual)return;o._qRows=_okrGenQRows(o);App._renderOKREdit();};
App._okrEdQAdd=()=>{
  const o=_OKRED;if(!o)return;o._qRows=o._qRows||[];
  const last=o._qRows[o._qRows.length-1];
  const nQKids=okrById(o.id)?okrChildren(o.id).filter(k=>k.quarterLabel).length:0;
  const start=last?_okrDateAddD(last.end,1):(o.periodStart||todayISO());
  o._qRows.push({label:'Q'+(o._qRows.length+nQKids+1),start:start,end:_okrDateAddD(_okrDateAddM(start,3),-1),startVal:last?(last.target!==null&&last.target!==undefined?last.target:0):Number(o.startValue||0),target:null});
  App._renderOKREdit();
};
App._okrEdQRm=(i)=>{const o=_OKRED;if(o&&o._qRows){o._qRows.splice(i,1);App._renderOKREdit();}};
App._okrEdQSet=(i,field,val)=>{
  const o=_OKRED;if(!o||!o._qRows||!o._qRows[i])return;
  if(field==='startVal'||field==='target')o._qRows[i][field]=val===''?null:parseFloat(val);
  else o._qRows[i][field]=val;
};
App._okrEdSetFreqType=(t)=>{const o=_OKRED;if(!o)return;if(t==='none')o.frequency={};else if(t==='weekly')o.frequency={type:'weekly',day:(o.frequency||{}).day&&WKDAYS.includes(o.frequency.day)?o.frequency.day:'Mon'};else if(t==='monthly')o.frequency={type:'monthly',day:Number((o.frequency||{}).day)||1};else o.frequency={type:'custom',dates:Array.isArray((o.frequency||{}).dates)?o.frequency.dates:[]};App._renderOKREdit();};
App._okrEdAddDate=()=>{const el=document.getElementById('okrEdCustomDate');if(!el||!el.value)return;const o=_OKRED;o.frequency=o.frequency||{type:'custom',dates:[]};o.frequency.dates=o.frequency.dates||[];if(!o.frequency.dates.includes(el.value)){o.frequency.dates.push(el.value);o.frequency.dates.sort();}App._renderOKREdit();};
App._okrEdRmDate=(i)=>{const o=_OKRED;if(o&&o.frequency&&Array.isArray(o.frequency.dates)){o.frequency.dates.splice(i,1);App._renderOKREdit();}};
/* The "Annual objective" block of the editor: toggle → flexible quarterly periods. */
function _okrEdAnnualSection(o,L){
  const isExisting=!!okrById(o.id);
  const qKids=isExisting?okrChildren(o.id).filter(k=>k.quarterLabel):[];
  const rows=o._qRows||[];
  const inp='class="ui-input" style="min-height:34px;padding:5px 8px;font-size:12px"';
  /* Threshold modes carry no start value, so the Start column disappears and the last number
     is the line itself — one fewer input per period, and the grid narrows to match. */
  const _thr=okrIsThresh(o);
  const cols=_thr?'64px 1fr 1fr 86px 26px':'64px 1fr 1fr 86px 86px 26px';
  const tgtPh=_thr?(okrDirOf(o)==='gte'?'Min':'Max'):'Target';
  const rowHTML=(r,i)=>`<div style="display:grid;grid-template-columns:${cols};gap:6px;align-items:center;margin-top:6px">
      <input type="text" value="${esc(r.label||'')}" oninput="App._okrEdQSet(${i},'label',this.value)" ${inp} placeholder="Q${i+1}"/>
      <input type="date" value="${r.start||''}" onchange="App._okrEdQSet(${i},'start',this.value)" ${inp}/>
      <input type="date" value="${r.end||''}" onchange="App._okrEdQSet(${i},'end',this.value)" ${inp}/>
      ${_thr?'':`<input type="number" step="any" value="${r.startVal!==null&&r.startVal!==undefined?r.startVal:''}" oninput="App._okrEdQSet(${i},'startVal',this.value)" ${inp} placeholder="Start"/>`}
      <input type="number" step="any" value="${r.target!==null&&r.target!==undefined?r.target:''}" oninput="App._okrEdQSet(${i},'target',this.value)" ${inp} placeholder="${tgtPh}"/>
      <button type="button" onclick="App._okrEdQRm(${i})" title="Remove this period" style="width:24px;height:24px;border-radius:7px;border:none;background:var(--c-surface-2);color:var(--c-text-3);cursor:pointer;font-size:13px;line-height:1">×</button>
    </div>`;
  const qEdit=o._qEdit||[];
  const gridHead=`<div style="display:grid;grid-template-columns:${cols};gap:6px;font-size:10px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.04em;margin-top:4px"><span>Label</span><span>From</span><span>To</span>${_thr?'':'<span>Start</span>'}<span>${_thr?(okrDirOf(o)==='gte'?'At or above':'At or below'):'Target'}</span><span></span></div>`;
  const eRow=(r,i)=>`<div style="display:grid;grid-template-columns:${cols};gap:6px;align-items:center;margin-top:6px">
      <input type="text" value="${esc(r.label||'')}" oninput="App._okrEdQESet(${i},'label',this.value)" ${inp}/>
      <input type="date" value="${r.start||''}" onchange="App._okrEdQESet(${i},'start',this.value)" ${inp}/>
      <input type="date" value="${r.end||''}" onchange="App._okrEdQESet(${i},'end',this.value)" ${inp}/>
      ${_thr?'':`<input type="number" step="any" value="${r.startVal!==null&&r.startVal!==undefined?r.startVal:''}" oninput="App._okrEdQESet(${i},'startVal',this.value)" ${inp}/>`}
      <input type="number" step="any" value="${r.target!==null&&r.target!==undefined?r.target:''}" oninput="App._okrEdQESet(${i},'target',this.value)" ${inp}/>
      <span title="Existing quarterly objective — your edits save with this form" style="display:grid;place-items:center;color:#0B6660">${ic('check','w-3.5 h-3.5')}</span>
    </div>`;
  return `<div style="border-top:1px dashed var(--c-border);padding-top:12px">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
      <div style="min-width:0"><label style="${L}">Annual objective — split into quarterly targets</label>
      <div style="font-size:11px;color:var(--c-text-3);margin-top:2px;line-height:1.5">Creates one linked objective per period below — <b>same owner, same metric</b>, only dates and targets differ. Their updates automatically drive this annual number; the owner never fills it in by hand.</div></div>
      <button type="button" role="switch" aria-checked="${o.isAnnual?'true':'false'}" class="tog ${o.isAnnual?'on':'off'}" style="margin-top:2px" onclick="App._okrEdTogAnnual()"><span></span></button>
    </div>
    ${o.isAnnual?`
      ${(()=>{ /* v3.20 — HOW the annual is calculated from its quarters */
        const md=okrAnnualMode(o);
        const hint=md==='progress'?'Each quarter counts equally — e.g. Q1 done 10% and the rest untouched → the annual shows 2.5%. Regular sub-objectives never feed it.'
          :md==='sum'?'The quarterly <b>current values are added up</b> and measured against this annual’s own start → target — so set the quarterly targets to add up to the annual target (e.g. 4 × 3M = 12M).'
          :md==='avg'?'The quarterly <b>current values are averaged</b> and measured against this annual’s own start → target — right for rates and percentages (e.g. keep satisfaction at 90% each quarter).'
          :md==='max'?'The <b>highest</b> quarterly current value is the annual’s current value, measured against its own start → target.'
          :md==='min'?'The <b>lowest</b> quarterly current value is the annual’s current value, measured against its own start → target — the annual is only as good as its weakest quarter.'
          :'The <b>most recent value reported on any quarter</b> is the annual’s current value, measured against its own start → target — right for running totals the quarters keep cumulatively.';
        return `<div style="margin-top:12px"><label style="${L}">How is this annual calculated from its quarters?</label>
        <select class="ui-select rf" onchange="_OKRED.rollupMode=this.value==='progress'?'sum':this.value;App._renderOKREdit()">
          ${OKR_ANNUAL_MODES.map(m=>`<option value="${m[0]}" ${(m[0]==='progress'?md==='progress':o.rollupMode===m[0])?'selected':''}>${esc(m[1])}</option>`).join('')}
        </select>
        <div style="font-size:11px;color:var(--c-text-3);margin-top:6px;line-height:1.5">${hint}</div></div>`;})()}
      ${okrAnnualMode(o)==='progress'?dismissNote('okr-ed-annual',`This annual's progress = the <b>combined progress of its quarters</b>, each counting equally. Regular sub-objectives never feed it, and the “auto-update from the level below” toggle does not apply to annuals.`,{style:'margin-top:10px;font-size:11px',onDismiss:'App._renderOKREdit()'}):''}
      ${qEdit.length?`<div style="margin-top:12px"><label style="${L}">Quarterly objectives (${qEdit.length}) — edit them right here</label>
        ${gridHead}
        ${qEdit.map(eRow).join('')}
        <div style="font-size:11px;color:var(--c-text-3);margin-top:6px;line-height:1.45">Label, dates, start and target save onto each quarterly objective when you press <b>Save</b> — their check-in history is never touched. Edits made on a quarter from the tree show up here too.</div>
      </div>`:''}
      <div style="margin-top:12px">
        <label style="${L}">${qKids.length?'Add more periods':'Quarterly periods & targets'}</label>
        ${rows.length?gridHead:''}
        ${rows.map(rowHTML).join('')||(qKids.length?'':'<div style="font-size:11.5px;color:var(--c-text-3);margin-top:4px">No periods yet — add one below.</div>')}
        <div style="display:flex;gap:8px;margin-top:9px;flex-wrap:wrap">
          <button type="button" onclick="App._okrEdQAdd()" class="ui-btn ui-btn-ghost ui-btn-sm">${ic('plus','w-3.5 h-3.5')}Add period</button>
          ${!qKids.length?`<button type="button" onclick="App._okrEdReQ()" class="ui-btn ui-btn-ghost ui-btn-sm" title="Re-split the annual period into calendar quarters">${ic('refresh','w-3.5 h-3.5')}Reset to calendar quarters</button>`:''}
        </div>
        <div style="font-size:11px;color:var(--c-text-3);margin-top:8px;line-height:1.5">Fully flexible — keep 2 periods, add 6, rename them, shift any date. Defaults follow real calendar quarters, clipped to the period — a Jan–Jul objective gets Q1, Q2 and a short Q3. A period inside one quarter is split into its months instead.</div>
      </div>`:''}
  </div>`;
}
/* Live search over the owner list — filters the rendered rows directly (no re-render). */
App._okrEdOwnQ=(v)=>{
  if(_OKRED)_OKRED._ownQ=v;
  const q=String(v||'').trim().toLowerCase();
  const box=document.getElementById('okr-own-list');if(!box)return;
  let any=false;
  box.querySelectorAll('[data-own-name]').forEach(el=>{const hit=!q||(el.getAttribute('data-own-name')||'').includes(q);el.style.display=hit?'flex':'none';if(hit)any=true;});
  const none=document.getElementById('okr-own-none');
  if(none){none.style.display=any?'none':'block';const nq=document.getElementById('okr-own-none-q');if(nq)nq.textContent=v||'';}
};
/* Toggle an owner in the editor draft — owners is the source of truth, ownerId mirrors owners[0]. */
App._okrEdTogOwner=(uid2)=>{
  const o=_OKRED;if(!o)return;
  let a=Array.isArray(o.owners)&&o.owners.length?o.owners.slice():(o.ownerId?[o.ownerId]:[]);
  a=a.includes(uid2)?a.filter(x=>x!==uid2):[...a,uid2];
  o.owners=a;o.ownerId=a[0]||null;
  App._renderOKREdit();
};
/* Switching to a threshold mode drops the start value (there is no journey to start), and
   switching back out of one restores a sensible 0 so the field is never left undefined. */
App._okrEdSetDir=(d)=>{
  const o=_OKRED;if(!o)return;
  o.direction=(d==='down'||d==='gte'||d==='lte')?d:'up';
  if(o.direction==='gte'||o.direction==='lte')o.startValue=0;
  else if(o.startValue===null||o.startValue===undefined||!isFinite(o.startValue))o.startValue=0;
  App._renderOKREdit();
};
App._renderOKREdit=()=>{
  const o=_OKRED;if(!o)return;
  const isExisting=!!okrById(o.id);
  const parent=o.parentId?okrById(o.parentId):null;
  const lvl=isExisting?okrLevel(o):(parent?okrLevel(parent)+1:0); // existing nodes show their real (display) level — a quarter reads L0, not L1
  const L='display:block;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px';
  const users=visU().filter(u=>u&&u.status==='Active');
  okrOwners(o).forEach(id=>{if(!users.some(u=>u.id===id)){const u2=uById(id);if(u2)users.push(u2);}}); // keep out-of-scope existing owners visible
  const f=o.frequency||{};
  const fType=f.type||'none';
  // Department (top level) + separate Sub-department select (children of the chosen department)
  const deptOpts=(topDepts()||[]).map(d=>[d.id,d.name]);
  const subOpts=o.departmentId?(subDepts(o.departmentId)||[]).map(s=>[s.id,s.name]):[];
  const dayChip=d=>`<button type="button" onclick="_OKRED.frequency.day='${d}';App._renderOKREdit()" style="padding:6px 11px;border-radius:9px;border:1.5px solid ${f.day===d?'var(--c-text)':'var(--c-border)'};background:${f.day===d?'var(--c-ink)':'var(--c-surface)'};color:${f.day===d?'#fff':'var(--c-text-2)'};font-size:12px;font-weight:700;cursor:pointer">${d}</button>`;
  modalShell({title:(isExisting?'Edit':'New')+' L'+lvl+' objective',sub:parent?('Under: '+(parent.title||'—')):('Top-level objective — assigned to a department'),size:'max-w-lg',key:'okr-edit',
    body:`<div style="display:flex;flex-direction:column;gap:14px">
      <div><label style="${L}">Objective title *</label><input type="text" value="${esc(o.title||'')}" oninput="_OKRED.title=this.value" placeholder="e.g. Increase monthly revenue" class="ui-input rf"/></div>
      <div><label style="${L}">Goal / description</label><textarea rows="2" oninput="_OKRED.description=this.value" placeholder="What does success look like? Why does it matter?" class="ui-input rf" style="resize:vertical">${esc(o.description||'')}</textarea></div>
      ${(()=>{const pEff=parent?okrDeptOf(parent):null;const pDept=(pEff&&pEff.deptId)?(DB.departments||[]).find(x=>x.id===pEff.deptId):null;
      return `<div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><label style="${L}">Department ${o.parentId?'':'*'}</label><select class="ui-select rf" onchange="_OKRED.departmentId=this.value||null;_OKRED.subDepartmentId=null;App._renderOKREdit()"><option value="">${o.parentId?('— Inherit'+(pDept?' ('+esc(pDept.name)+')':'')+' —'):'— Select department —'}</option>${deptOpts.map(d=>`<option value="${esc(d[0])}" ${o.departmentId===d[0]?'selected':''}>${esc(d[1])}</option>`).join('')}</select></div>
        <div><label style="${L}">Sub-department</label><select class="ui-select rf" ${subOpts.length?'':'disabled'} onchange="_OKRED.subDepartmentId=this.value||null"><option value="">${subOpts.length?'— All / none —':'No sub-departments'}</option>${subOpts.map(s=>`<option value="${esc(s[0])}" ${o.subDepartmentId===s[0]?'selected':''}>${esc(s[1])}</option>`).join('')}</select></div>
      </div>${o.parentId?`<div style="font-size:11px;color:var(--c-text-3);margin-top:6px">Every level can carry its own department & sub-department — leave on “Inherit” to follow the parent's.</div>`:''}</div>`;})()}
      ${(()=>{const selOwn=okrOwners(o);
      // v3.11.1 owner picker: selected owners as removable chips + a search box over the
      // people list (typing filters the DOM directly — no re-render, focus never lost).
      const list=users.slice().sort((a,b)=>{const sa=selOwn.includes(a.id)?0:1,sb2=selOwn.includes(b.id)?0:1;if(sa!==sb2)return sa-sb2;return fullName(a).localeCompare(fullName(b));});
      return `<div><label style="${L}">Owners — any of them can update & edit *</label>
        ${selOwn.length?`<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px">${selOwn.map(id=>{const u=uById(id);if(!u)return'';return`<span style="display:inline-flex;align-items:center;gap:6px;background:var(--c-brand-soft);border:1px solid var(--c-border);border-radius:20px;padding:3px 5px;font-size:11.5px;font-weight:700;color:var(--c-text)">${avatar(u,'w-4 h-4','text-[8px]')}${esc(fullName(u))}<button type="button" onclick="App._okrEdTogOwner('${id}')" title="Remove ${esc(fullName(u))}" style="width:16px;height:16px;border-radius:50%;border:none;background:var(--c-border);color:var(--c-text-2);cursor:pointer;font-size:10px;line-height:1;display:grid;place-items:center;flex-shrink:0">×</button></span>`;}).join('')}</div>`
        :`<div style="font-size:11.5px;color:#8A5F00;background:#FEF5E0;border-radius:8px;padding:6px 10px;margin-bottom:8px">No owner yet — search and tick at least one below.</div>`}
        <div style="border:1.5px solid var(--c-border);border-radius:12px;background:var(--c-surface);overflow:hidden">
          <div style="display:flex;align-items:center;gap:7px;padding:7px 10px;border-bottom:1px solid var(--c-border);background:var(--c-surface-2);color:var(--c-text-3)">${ic('search','w-3.5 h-3.5')}<input id="okr-own-q" value="${esc(o._ownQ||'')}" oninput="App._okrEdOwnQ(this.value)" placeholder="Search by name, email or department…" style="flex:1;border:none;outline:none;background:transparent;font-size:12.5px;color:var(--c-text);min-width:0"/></div>
          <div id="okr-own-list" style="max-height:148px;overflow-y:auto;padding:4px">
            ${list.map(u=>{const on=selOwn.includes(u.id);return`<div data-own-name="${esc((fullName(u)+' '+(u.email||'')+' '+(u.department||'')).toLowerCase())}" role="checkbox" aria-checked="${on}" onclick="App._okrEdTogOwner('${u.id}')" style="display:flex;align-items:center;gap:9px;padding:5px 8px;border-radius:8px;cursor:pointer;${on?'background:var(--c-brand-soft);':''}">
              <span style="width:15px;height:15px;border-radius:5px;border:1.5px solid ${on?'var(--c-brand)':'var(--c-border-2)'};background:${on?'var(--c-brand)':'#fff'};display:grid;place-items:center;color:#fff;flex-shrink:0">${on?ic('check','w-3 h-3'):''}</span>
              ${avatar(u,'w-5 h-5','text-[9px]')}
              <span style="flex:1;min-width:0;font-size:12.5px;font-weight:600;color:var(--c-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(fullName(u))}</span>
              <span style="font-size:10px;color:var(--c-text-3);flex-shrink:0">${esc(u.department||'')}</span>
            </div>`;}).join('')}
            <div id="okr-own-none" style="display:none;padding:10px;font-size:12px;color:var(--c-text-3)">No one matches “<span id="okr-own-none-q"></span>”.</div>
          </div>
        </div>
        <div style="font-size:11px;color:var(--c-text-3);margin-top:6px">${selOwn.length} selected · scheduled check-ins reach every owner as a <b>group task — any one</b> of them can fill it and it counts for everyone.</div>
      </div>`;})()}
      <div style="border-top:1px dashed var(--c-border);padding-top:12px"><label style="${L}">Rules & target — how is this measured?</label>
        <select class="ui-select rf" onchange="_OKRED.metricType=this.value;App._renderOKREdit()">${OKR_METRICS.map(m=>`<option value="${m[0]}" ${o.metricType===m[0]?'selected':''}>${m[1]}</option>`).join('')}</select>
      </div>
      ${o.metricType!=='yesno'?`<div><label style="${L}">Which way is good?</label>
        <select class="ui-select rf" onchange="App._okrEdSetDir(this.value)">
          ${OKR_DIRS.map(d=>`<option value="${d[0]}" ${okrDirOf(o)===d[0]?'selected':''}>${esc(OKR_DIR_LONG[d[0]])}</option>`).join('')}
        </select>
      </div>
      ${okrIsThresh(o)?`<div>
        <label style="${L}">${okrDirOf(o)==='gte'?'Stay at or above *':'Stay at or below *'}</label>
        <input type="number" step="any" value="${o.targetValue!==null&&o.targetValue!==undefined?o.targetValue:''}" oninput="_OKRED.targetValue=this.value===''?null:parseFloat(this.value)" placeholder="e.g. ${okrDirOf(o)==='gte'?'99':'0.5'}" class="ui-input rf"/>
      </div>`:`<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><label style="${L}">Start value</label><input type="number" step="any" value="${o.startValue!==null&&o.startValue!==undefined?o.startValue:''}" oninput="_OKRED.startValue=this.value===''?0:parseFloat(this.value)" placeholder="0" class="ui-input rf"/></div>
        <div><label style="${L}">${okrHasRevision(o)?'Original target *':'Target value *'}</label><input type="number" step="any" value="${o.targetValue!==null&&o.targetValue!==undefined?o.targetValue:''}" oninput="_OKRED.targetValue=this.value===''?null:parseFloat(this.value)" placeholder="e.g. 100" class="ui-input rf"/></div>
      </div>`}
      <div>
        ${(()=>{
          const _d=okrDirOf(o);
          const _s=Number(o.startValue||0),_t=(o.targetValue===null||o.targetValue===undefined)?null:Number(o.targetValue);
          const _set=(_t!==null&&isFinite(_t));
          const _plain=(txt)=>'<div style="font-size:11px;color:var(--c-text-3);line-height:1.55">'+txt+'</div>';
          const _amber=(txt)=>'<div style="font-size:11px;line-height:1.6;color:#7A4E00;background:#FEF5E0;border:1px solid #FBE6A6;border-radius:9px;padding:8px 10px">'+txt+'</div>';
          if(_d==='up')return _plain('A journey from the start value up to the target. The % is <b>how far along that climb</b> the latest update is, and the graph draws the planned pace from start to target. Beating the target reads <b>100% · Achieved</b> — never more than 100%.');
          if(_d==='down'){
            if(!_set)return _amber('Set a target above — the number has to come down to it.');
            if(_t>_s)return _amber('Your target sits <b>above</b> the start, so this behaves as an <b>allowance</b>: the % reads <b>how much of it is used</b> ('+esc(_okrFmtVal(o,(_t-_s)*0.4))+' of the '+esc(_okrFmtVal(o,_t-_s))+' this period allows → 40%) and going over it reads <b>Not achieved</b>. If what you actually want is “just keep it under '+esc(_okrFmtVal(o,_t))+'”, pick <b>Less than</b> instead — no start value, and the graph shows every reading against that one line.');
            return _plain('A journey from '+esc(_okrFmtVal(o,_s))+' down to '+esc(_okrFmtVal(o,_t))+'. The % is <b>how much of that drop is done</b>, and the graph draws the planned pace down to the target.');
          }
          const _word=_d==='gte'?'at or above':'at or below';
          return _amber('One line, no start value. The status is judged on the <b>average of each reported day</b> this period: average <b>'+_word+' '+(_set?esc(_okrFmtVal(o,_t)):'the value')+'</b> reads <b>On track</b> while the period runs and <b>Achieved</b> once it closes; an average on the wrong side reads <b>Off track</b>, then <b>Not achieved</b>. One bad day can be pulled back by good ones — and one good day can’t hide a bad month. There is <b>no progress %</b> on this mode — a percentage would be misleading. The graph draws the line flat, with every reading dotted green or red against it.');
        })()}
      </div>
      ${okrHasRevision(o)?`<div style="background:#FEFAEC;border:1px solid #FBE6A6;border-radius:11px;padding:10px 12px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:end">
          <div><label style="${L};color:#7A4E00">Revised target (drives progress)</label><input type="number" step="any" value="${o.revisedTarget!==null&&o.revisedTarget!==undefined?o.revisedTarget:''}" oninput="_OKRED.revisedTarget=this.value===''?null:parseFloat(this.value)" class="ui-input rf" style="border-color:#FBE6A6"/></div>
          <div style="font-size:11px;color:#7A4E00;line-height:1.5;padding-bottom:4px">Revised ${o.revisedAt?esc(fmtS(String(o.revisedAt).slice(0,10))):''}${o.revisedBy&&uById(o.revisedBy)?' by '+esc(fullName(uById(o.revisedBy))):''}${o.revisedNote?' — “'+esc(o.revisedNote)+'”':''}</div>
        </div>
        <div style="font-size:11px;color:#8A5F00;margin-top:6px">This number is what progress is measured against; the original stays for comparison. Clear it (or set it back to the original) to remove the revision.</div>
      </div>`:''}
      <div><label style="${L}">${o.metricType==='currency'?'Currency':'Unit'} ${o.metricType==='percent'?'(auto: %)':''}</label><input type="text" value="${esc(o.unit||'')}" oninput="_OKRED.unit=this.value" placeholder="${o.metricType==='currency'?'e.g. AED / $':'e.g. orders, hrs'}" class="ui-input rf" ${o.metricType==='percent'?'disabled':''}/></div>`:`<div style="font-size:12px;color:var(--c-text-3);background:var(--c-surface-2);border-radius:9px;padding:9px 12px">Yes / No objective — a check-in of "Yes" counts as 100%, "No" as 0%.</div>`}
      ${o.metricType!=='yesno'?_okrEdAnnualSection(o,L):''}
      ${(o.metricType!=='yesno'&&!o.isAnnual)?`<div style="border-top:1px dashed var(--c-border);padding-top:12px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
          <div style="min-width:0"><label style="${L}">Auto-update from the level below</label>
          <div style="font-size:11px;color:var(--c-text-3);margin-top:2px;line-height:1.5">L${lvl} takes its current value from its <b>direct L${lvl+1} sub-objectives only</b> — the owner never enters it by hand. Progress is still measured against this objective's own start → target.</div></div>
          <button type="button" role="switch" aria-checked="${o.rollup?'true':'false'}" class="tog ${o.rollup?'on':'off'}" style="margin-top:2px" onclick="_OKRED.rollup=!_OKRED.rollup;App._renderOKREdit()"><span></span></button>
        </div>
        ${o.rollup?`<div style="margin-top:10px"><label style="${L}">How to combine the L${lvl+1} values</label>
          <select class="ui-select rf" onchange="_OKRED.rollupMode=this.value">
            <option value="sum" ${!o.rollupMode||o.rollupMode==='sum'?'selected':''}>Total (sum of all)</option>
            <option value="avg" ${o.rollupMode==='avg'?'selected':''}>Average</option>
            <option value="max" ${o.rollupMode==='max'?'selected':''}>Highest value</option>
            <option value="min" ${o.rollupMode==='min'?'selected':''}>Lowest value</option>
            <option value="latest" ${o.rollupMode==='latest'?'selected':''}>Latest update (most recent value reported below)</option>
          </select>
          <div style="font-size:11px;color:var(--c-text-3);margin-top:6px">Works best when the L${lvl+1} sub-objectives measure the same thing in the same unit.</div></div>`:''}
      </div>`:''}
      ${(o.rollup&&!o.isAnnual)?`<div style="border-top:1px dashed var(--c-border);padding-top:12px"><label style="${L}">Check-in frequency</label>
        <div style="font-size:11.5px;color:#7A4E00;background:#FDF3D9;border:1px solid #FBE6A6;border-radius:9px;padding:8px 11px;line-height:1.55">
          <b>No check-ins on this objective.</b> Its value is the ${esc(_okrModeLabel(o.rollupMode))} of the level below, so nobody is asked to update it: no schedule, no reminder e-mail, and it never appears as a task in My Checklists. Any schedule it had is cleared on save. Update the sub-objectives instead — this number follows them.
        </div></div>`:`<div style="border-top:1px dashed var(--c-border);padding-top:12px"><label style="${L}">Check-in frequency — ${o.isAnnual?'when is the owner asked to update each quarterly objective?':'when is the owner asked for an update?'}</label>
        <select class="ui-select rf" onchange="App._okrEdSetFreqType(this.value)">
          <option value="weekly" ${fType==='weekly'?'selected':''}>Weekly · on a chosen day</option>
          <option value="monthly" ${fType==='monthly'?'selected':''}>Monthly · on a chosen date</option>
          <option value="custom" ${fType==='custom'?'selected':''}>Custom dates</option>
          <option value="none" ${fType==='none'?'selected':''}>No schedule (manual updates only)</option>
        </select>
        ${fType==='weekly'?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:9px">${WKDAYS.map(dayChip).join('')}</div><div style="font-size:11px;color:var(--c-text-3);margin-top:6px">Every ${esc(f.day||'Mon')}, this OKR joins the owner's combined check-in list.</div>`:''}
        ${fType==='monthly'?`<div style="display:flex;align-items:center;gap:8px;margin-top:9px"><span style="font-size:12.5px;color:var(--c-text-2)">Day of month</span><input type="number" min="1" max="31" value="${Number(f.day)||1}" oninput="_OKRED.frequency.day=Math.max(1,Math.min(31,parseInt(this.value)||1))" class="ui-input rf" style="width:80px"/><span style="font-size:11px;color:var(--c-text-3)">shorter months use their last day</span></div>`:''}
        ${fType==='custom'?`<div style="margin-top:9px"><div style="display:flex;gap:8px"><input type="date" id="okrEdCustomDate" class="ui-input rf" style="flex:1"/><button type="button" onclick="App._okrEdAddDate()" class="ui-btn ui-btn-ghost ui-btn-sm">Add</button></div>
          ${(f.dates||[]).length?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${(f.dates||[]).map((d,i)=>`<span style="display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:20px;padding:3px 6px 3px 10px">${esc(fmtS(d))}<button type="button" onclick="App._okrEdRmDate(${i})" style="width:16px;height:16px;border-radius:50%;border:none;background:var(--c-border);color:var(--c-text-2);cursor:pointer;font-size:10px;line-height:1">×</button></span>`).join('')}</div>`:'<div style="font-size:11px;color:var(--c-text-3);margin-top:6px">No dates added yet.</div>'}</div>`:''}
      </div>`}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><label style="${L}">Period start</label><input type="date" value="${o.periodStart||''}" oninput="_OKRED.periodStart=this.value||null" class="ui-input rf"/></div>
        <div><label style="${L}">Period end</label><input type="date" value="${o.periodEnd||''}" oninput="_OKRED.periodEnd=this.value||null" class="ui-input rf"/></div>
      </div>
      <div style="font-size:11px;color:var(--c-text-3)">The period drives the automatic On track / Off track pace and stops check-in reminders after it ends.</div>
    </div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP(isExisting?'Save changes':'Create objective','App._okrSave()')});
  if(o._ownQ)setTimeout(()=>{try{App._okrEdOwnQ((_OKRED&&_OKRED._ownQ)||'');}catch(e){}},0); // keep the owner search applied across re-renders
};
App._okrSave=()=>{
  const o=_OKRED;if(!o)return;
  if(!(o.title||'').trim())return toast('Add an objective title','err');
  o.owners=okrOwners(o);o.ownerId=o.owners[0]||null; // normalize: owners drives, ownerId mirrors owners[0]
  if(!o.owners.length)return toast('Pick at least one owner','err');
  if(!o.parentId&&!o.departmentId)return toast('Assign the L0 objective to a department','err');
  if(o.metricType!=='yesno'&&(o.targetValue===null||o.targetValue===undefined||!isFinite(o.targetValue)))return toast(okrIsThresh(o)?'Set the threshold value':'Set a target value','err');
  // Threshold modes have no start value — keep the column at 0 so nothing downstream reads a stale one.
  if(okrIsThresh(o))o.startValue=0;
  if(o.metricType==='percent')o.unit='%';
  const f=o.frequency||{};
  if(o.rollup&&o.metricType==='yesno')o.rollup=false;
  if(o.isAnnual&&o.metricType==='yesno')o.isAnnual=false;
  if(!o.isAnnual&&/^q-/.test(o.rollupMode||''))o.rollupMode=o.rollupMode.slice(2); // v3.20: annual modes live only on annuals
  // ── Annual objective: enforce the auto-update link + validate the quarterly rows ──
  //    (qRows = NEW periods to create · qEdit = EXISTING quarterly objectives edited inline)
  const qRows=(o.isAnnual&&Array.isArray(o._qRows))?o._qRows:null;
  const qEdit=(o.isAnnual&&Array.isArray(o._qEdit))?o._qEdit:null;
  if(o.isAnnual){
    o.rollup=false; // v3.19: an annual is quarters-only — a stray roll-up flag (old data) is cleared on save
    if(!o.periodStart||!o.periodEnd)return toast('Set the annual period (start & end dates)','err');
    const hasQKids=okrChildren(o.id).some(k=>k.quarterLabel);
    if(!hasQKids&&(!qRows||!qRows.length))return toast('Add at least one quarterly period (or turn the annual toggle off)','err');
    for(let i=0;i<(qRows||[]).length;i++){
      const r=qRows[i];
      if(!(r.label||'').trim())return toast('Period '+(i+1)+': give it a label (e.g. Q'+(i+1)+')','err');
      if(!r.start||!r.end)return toast(String(r.label||'Period '+(i+1))+': set both dates','err');
      if(r.end<r.start)return toast(String(r.label)+': end date is before its start','err');
      if(r.target===null||r.target===undefined||!isFinite(r.target))return toast(String(r.label)+': set a target value','err');
      if(r.startVal===null||r.startVal===undefined||!isFinite(r.startVal))r.startVal=0;
    }
    for(let i=0;i<(qEdit||[]).length;i++){
      const r=qEdit[i];if(!r||!okrById(r.id))continue; // quarter deleted meanwhile — just skip it
      if(!(r.label||'').trim())return toast('Quarterly objective '+(i+1)+': give it a label','err');
      if(!r.start||!r.end)return toast(String(r.label)+': set both dates','err');
      if(r.end<r.start)return toast(String(r.label)+': end date is before its start','err');
      if(r.target===null||r.target===undefined||!isFinite(r.target))return toast(String(r.label)+': set a target value','err');
      if(r.startVal===null||r.startVal===undefined||!isFinite(r.startVal))r.startVal=0;
    }
  }
  if(!o.rollup||o.isAnnual){
  if(f.type==='weekly'&&!WKDAYS.includes(f.day))return toast('Pick the weekday for check-ins','err');
  if(f.type==='monthly'&&!(Number(f.day)>=1&&Number(f.day)<=31))return toast('Pick a day of month (1–31)','err');
  if(f.type==='custom'&&!(f.dates||[]).length)return toast('Add at least one check-in date','err');
  }
  if(o.periodStart&&o.periodEnd&&o.periodEnd<o.periodStart)return toast('Period end is before its start','err');
  delete o._qRows;delete o._qEdit;delete o._ownQ; // editor-only — dropped AFTER validation so a failed save keeps the rows on screen
  /* v3.14 — auto-update from the level below means NO manual input on this objective:
     no update button, no check-in, and no task in anybody's checklist. okrDueOn() and
     _okrCanCheckin() already refuse it, but a stored schedule left sitting on the row is
     a trap — flip any other flag later and it starts firing again. So the schedule is
     cleared on save. An ANNUAL keeps its frequency even with roll-up on, because there it
     is only the template stamped onto its quarterly objectives, never a task for itself.
     Placed AFTER every validation return, for the same reason the editor-only fields are:
     `o` IS the live editor state, so wiping it before a toast-and-abort would silently
     destroy the user's schedule on a save that never happened. */
  if(o.rollup&&!o.isAnnual)o.frequency={};
  if(o.metricType==='yesno'){o.startValue=0;o.targetValue=1;}
  const idx=(DB.okrs||[]).findIndex(x=>x.id===o.id);
  if(idx>-1){
    const prev=DB.okrs[idx];
    const fields=[['title','Title'],['description','Goal'],['departmentId','Department'],['subDepartmentId','Sub-department'],['owners','Owners'],['metricType','Metric'],['startValue','Start value'],['targetValue','Target'],['unit','Unit'],['direction','Which way is good?'],['rollup','Auto roll-up'],['rollupMode','Calculation mode'],['isAnnual','Annual objective'],['periodStart','Period start'],['periodEnd','Period end']];
    const changes=[];
    fields.forEach(([k,label])=>{const a=k==='owners'?okrOwners(prev):prev[k],b=k==='owners'?okrOwners(o):o[k];if(String(a===null||a===undefined?'':a)!==String(b===null||b===undefined?'':b)){
      let from=a,to=b;
      if(k==='owners'){const nm=v2=>Array.isArray(v2)&&v2.length?v2.map(x=>{const u3=uById(x);return u3?fullName(u3):x;}).join(', '):'—';from=nm(a);to=nm(b);}
      if(k==='departmentId'||k==='subDepartmentId'){const da=(DB.departments||[]).find(d=>d.id===a),db2=(DB.departments||[]).find(d=>d.id===b);from=da?da.name:(a||'—');to=db2?db2.name:(b||'—');}
      changes.push({field:label,from:from,to:to});
    }});
    if(JSON.stringify(prev.frequency||{})!==JSON.stringify(o.frequency||{}))changes.push({field:'Frequency',from:_okrFreqLabel(prev),to:_okrFreqLabel(o)});
    // Revised target edited inline in this form: keep the revision coherent —
    // clearing it or setting it back to the original REMOVES the revision.
    if(String(prev.revisedTarget??'')!==String(o.revisedTarget??'')){
      const orig=(o.targetValue===null||o.targetValue===undefined)?null:Number(o.targetValue);
      if(o.revisedTarget===null||o.revisedTarget===undefined||(orig!==null&&Number(o.revisedTarget)===orig)){
        changes.push({field:'Revised target',from:prev.revisedTarget,to:'(removed — back to original '+(orig??'—')+')'});
        o.revisedTarget=null;o.revisedNote='';o.revisedAt=null;o.revisedBy=null;
      }else{
        changes.push({field:'Revised target',from:(prev.revisedTarget===null||prev.revisedTarget===undefined)?'(none)':prev.revisedTarget,to:o.revisedTarget});
        o.revisedAt=new Date().toISOString();o.revisedBy=S.uid;
      }
    }
    DB.okrs[idx]=o;
    if(changes.length)okrLog(o.id,'Edited objective',{changes:changes});
    // v3.11: owners newly added on edit are notified + emailed like a fresh assignment
    const _addedOwn=okrOwners(o).filter(x=>!okrOwners(prev).includes(x));
    if(_addedOwn.length)_okrNotifyAssigned(o,_addedOwn);
    /* ── Annual ⇄ quarterly sync ──
       1) The inline rows from the annual's editor write back onto each quarterly objective.
       2) Shared fields changed on the annual (owner, goal, unit, direction, metric, schedule,
          auto-pattern title) follow onto quarters that still MATCH the annual's old value —
          a quarter you customised by hand keeps its own value. Check-ins are never touched. */
    if(o.isAnnual){
      const qeById={};(qEdit||[]).forEach(r=>{if(r&&r.id)qeById[r.id]=r;});
      okrChildren(o.id).filter(k=>k.quarterLabel).forEach(k=>{
        const kc=[];
        const oldLabel=k.quarterLabel;
        const qe=qeById[k.id];
        if(qe){
          const lbl=String(qe.label||'').trim();
          if(lbl&&lbl!==k.quarterLabel){kc.push({field:'Quarter label',from:k.quarterLabel,to:lbl});k.quarterLabel=lbl;}
          if(qe.start&&qe.start!==k.periodStart){kc.push({field:'Period start',from:k.periodStart,to:qe.start});k.periodStart=qe.start;}
          if(qe.end&&qe.end!==k.periodEnd){kc.push({field:'Period end',from:k.periodEnd,to:qe.end});k.periodEnd=qe.end;}
          if(qe.startVal!==null&&qe.startVal!==undefined&&isFinite(qe.startVal)&&Number(qe.startVal)!==Number(k.startValue||0)){kc.push({field:'Start value',from:k.startValue,to:qe.startVal});k.startValue=Number(qe.startVal);}
          if(qe.target!==null&&qe.target!==undefined&&isFinite(qe.target)&&Number(qe.target)!==Number(k.targetValue)){kc.push({field:'Target',from:k.targetValue,to:qe.target});k.targetValue=Number(qe.target);}
        }
        // owners follow onto quarters that still match the annual's previous owners
        if(String(okrOwners(prev))!==String(okrOwners(o))&&String(okrOwners(k))===String(okrOwners(prev))){
          const nm=v2=>v2.map(x=>{const u3=uById(x);return u3?fullName(u3):x;}).join(', ')||'—';
          kc.push({field:'Owners',from:nm(okrOwners(prev)),to:nm(okrOwners(o))});
          k.owners=okrOwners(o).slice();k.ownerId=k.owners[0]||null;
        }
        [['description','Goal'],['unit','Unit'],['metricType','Metric'],['direction','Direction']].forEach(([fk,label])=>{
          if(String(prev[fk]??'')!==String(o[fk]??'')&&String(k[fk]??'')===String(prev[fk]??'')){kc.push({field:label,from:prev[fk],to:o[fk]});k[fk]=o[fk];}
        });
        if(JSON.stringify(prev.frequency||{})!==JSON.stringify(o.frequency||{})&&JSON.stringify(k.frequency||{})===JSON.stringify(prev.frequency||{})){kc.push({field:'Frequency',from:_okrFreqLabel(prev),to:_okrFreqLabel(o)});k.frequency=JSON.parse(JSON.stringify(o.frequency||{}));}
        const autoOld=(prev.title||'')+' — '+oldLabel;
        if(k.title===autoOld){
          const autoNew=(o.title||'')+' — '+k.quarterLabel;
          if(k.title!==autoNew){kc.push({field:'Title',from:k.title,to:autoNew});k.title=autoNew;}
        }
        if(kc.length){k.updatedAt=new Date().toISOString();okrLog(k.id,'Edited objective',{via:'annual editor',changes:kc});_okrPush(k);}
      });
    }
  }else{
    DB.okrs=DB.okrs||[];DB.okrs.push(o);
    // Brand new: the server's level map has no entry yet, and the local walk under-reports
    // for anyone who can't see the ancestors. Derive it from the parent's known level.
    _okrRelevel(o.id);
    okrLog(o.id,'Created objective',{level:'L'+(o.parentId?okrLevel(o):0)});
    if(o.parentId)_OKR_EXP[o.parentId]=true;
    _okrNotifyAssigned(o,okrOwners(o)); // every owner (except the creator) gets in-app + email
  }
  _okrPush(o);
  // ── Generate the quarterly objectives: same owner / metric / unit / check-in schedule —
  //    only the dates and targets differ. Each is a normal objective nested under the annual. ──
  if(qRows&&qRows.length){
    const baseSort=okrChildren(o.id).length;
    qRows.forEach((r,i)=>{
      const q={id:uid('okr'),parentId:o.id,quarterLabel:String(r.label).trim(),title:(o.title||'').trim()+' — '+String(r.label).trim(),description:o.description||'',departmentId:null,subDepartmentId:null,ownerId:o.ownerId,owners:okrOwners(o),metricType:o.metricType,startValue:Number(r.startVal||0),targetValue:Number(r.target),unit:o.unit||'',direction:o.direction||'up',frequency:JSON.parse(JSON.stringify(o.frequency||{})),periodStart:r.start,periodEnd:r.end,statusMode:'auto',statusManual:null,rollup:false,rollupMode:'sum',isAnnual:false,sort:baseSort+i,createdBy:S.uid,createdAt:new Date().toISOString()};
      DB.okrs.push(q);
      _okrRelevel(q.id);   // a quarter sits AT its annual's level — derive, don't guess
      okrLog(q.id,'Created objective',{level:'L'+okrLevel(q),quarter:q.quarterLabel,from:'annual split of "'+(o.title||'')+'"'});
      _okrPush(q);
    });
    okrLog(o.id,'Quarterly objectives generated',{count:qRows.length,periods:qRows.map(r=>r.label).join(', ')});
    _OKR_EXP[o.id]=true;
  }
  saveDB();closeModal();toast(o.isAnnual&&qRows&&qRows.length?('OKR saved — '+qRows.length+' quarterly objective'+(qRows.length===1?'':'s')+' created'):'OKR saved');rr();
};
/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 v3.14 \u2014 CASCADE DELETE (subtree, on the server too) \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   The old version pulled the whole subtree out of the LOCAL list but sent exactly ONE
   delete to Supabase \u2014 the objective itself. Its children, their check-ins and their
   activity logs stayed on the server and were pulled straight back on the next refresh,
   so deleting an L0 (or an annual with quarters) looked like it worked and then undid
   itself. Every id in the subtree is now deleted explicitly, each with its check-ins
   and its log, so deleting an L0 takes its L1s / L2s / quarters with it for good.     */
function _okrPurgeIds(ids){
  /* 1. Cancel queued writes to the OKR ROWS only \u2014 never to their check-ins or logs.
        \u00b7 okrs: a queued _okrPush is an UPSERT. Omitting deleted_at protects the ON CONFLICT
          branch, but if the row was never on the server (created while offline, save still
          queued) the replay takes the INSERT branch, deleted_at defaults to NULL, and the
          objective comes back live. Note the delete itself gives no warning in that case \u2014
          an UPDATE matching zero rows is a success, not an error.
        \u00b7 okr_checkins / okr_logs: deliberately left queued. Cancelling them would throw away
          exactly the history the restore promises to return \u2014 a check-in submitted offline
          and still unsent when the objective was deleted would simply never exist. */
  try{cancelPendingWrites('okrs',ids);}catch(e){}
  // 2. Remember locally that these ids are gone, so a soft-delete write that fails outright
  //    can't have the next refresh hand the rows back before the queue flushes (the same
  //    overlay pattern tickets/users/questions already use).
  DB.okrsDeleted=DB.okrsDeleted||[];
  ids.forEach(oid=>{if(DB.okrsDeleted.indexOf(oid)<0)DB.okrsDeleted.push(oid);});
  if(DB.okrsDeleted.length>2000)DB.okrsDeleted=DB.okrsDeleted.slice(-2000);
  // 3. SOFT delete: stamp deleted_at instead of dropping the row. The objective disappears
  //    from the app completely \u2014 tree, filters, counts, roll-ups, exports, tasks, reminders,
  //    for everyone \u2014 but the row, its check-ins and its whole activity log stay in the
  //    database, so the deletion can be pulled back from Deleted objectives (recycle bin).
  //    Check-ins and logs are deliberately NOT touched: they are only reachable through the
  //    objective, and leaving them intact is what makes a restore complete rather than a
  //    hollow shell. Permanent removal is a separate, explicit action in the recycle bin.
  const stamp=new Date().toISOString();
  ids.forEach(oid=>{
    const o=okrById(oid);if(o){o.deletedAt=stamp;o.deletedBy=S.uid;}
    sbWrite({table:'okrs',op:'update',id:oid,match:{col:'id',val:oid},
             values:{deleted_at:stamp,deleted_by:S.uid,updated_at:stamp}},{label:'OKR delete',silent:true});
  });
}
/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 v3.14 \u2014 DELETED OBJECTIVES (recycle bin) \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   Because a delete only stamps deleted_at, everything that was removed is still in the
   database and can be brought back. This lists each DELETION rather than each row: only
   the top of every deleted branch is shown, because that is how it was deleted \u2014 restoring
   one brings its whole subtree back with its check-ins and activity log intact.
   Deleted rows are excluded from the app's normal reads, so they are fetched on demand. */
const _OKRBIN_LIMIT=2000;
let _OKRBIN=null,_OKRBIN_SEQ=0;
App._okrRecycle=async()=>{
  if(!(can('okr','delete')||_okrCanManage()))return toast('You don\u2019t have permission to see deleted objectives','err');
  const seq=++_OKRBIN_SEQ;
  _OKRBIN={loading:true,rows:[],err:'',truncated:false,seq:seq};
  App._renderOKRBin();
  let next;
  try{
    // Ordered by id as the tie-break: every row in one deletion carries the SAME deleted_at
    // stamp, so ordering by the timestamp alone leaves the cut-off inside a tie group and
    // Postgres may return half a branch.
    const{data,error}=await sb.from('okrs').select('*').not('deleted_at','is',null)
      .order('deleted_at',{ascending:false}).order('id',{ascending:true}).limit(_OKRBIN_LIMIT);
    if(error)throw error;
    next={loading:false,rows:_mOKR(data||[]),err:'',truncated:(data||[]).length>=_OKRBIN_LIMIT,seq:seq};
  }catch(e){next={loading:false,rows:[],err:(e&&e.message)||'Could not load',truncated:false,seq:seq};}
  // Don't reopen over whatever the user is doing now: they may have closed this dialog while
  // the fetch was in flight, or opened an editor. Only paint if this is still the live bin.
  if(!_okrBinPaint(seq)){_OKRBIN=next;return;}
  _OKRBIN=next;App._renderOKRBin();
};
/* May the bin (re)draw itself right now? Only if it is still the bin the user asked for AND
   nothing else has taken the single modal slot. An empty slot is fine — that is the state
   right after a confirmP resolves, when the bin is expected to come back. Anything else on
   screen (an objective editor with half-typed input, say) must not be painted over: these
   handlers now await real network round-trips, so the page is interactive in between. */
function _okrBinPaint(seq){
  if(_OKRBIN_SEQ!==seq)return false;
  const m=$('#modal');
  if(!m)return true;
  const k=m.dataset.mkey||'';
  return k==='okr-bin'||k==='app-confirm';
}
/* Each DELETION is one entry, not each row. Every objective removed in a single delete
   carries the same `deletedAt` stamp, which is what identifies the batch: a row belongs to
   its parent's entry only if the parent was deleted in the SAME action. That distinction
   matters \u2014 deleting an L1 on Monday and its L0 on Friday are two separate deletions, so
   restoring Friday's L0 must not silently resurrect the L1 you deliberately removed on
   Monday, and Monday's L1 must keep its own entry rather than vanishing from the list. */
function _okrBinBatchParent(r,byId){
  if(!r.parentId)return null;
  const p=byId.get(r.parentId);
  return (p&&String(p.deletedAt||'')===String(r.deletedAt||''))?p:null;
}
function _okrBinRoots(){
  const rows=(_OKRBIN&&_OKRBIN.rows)||[];
  const byId=new Map(rows.map(r=>[r.id,r]));
  return rows.filter(r=>!_okrBinBatchParent(r,byId));
}
function _okrBinSubtree(id){
  const rows=(_OKRBIN&&_OKRBIN.rows)||[];
  const byId=new Map(rows.map(r=>[r.id,r]));
  const root=byId.get(id);if(!root)return[];
  const out=[],seen=new Set([id]);
  (function walk(pid){
    rows.forEach(r=>{
      if(r.parentId!==pid||seen.has(r.id))return;
      if(String(r.deletedAt||'')!==String(root.deletedAt||''))return;  // a different deletion
      seen.add(r.id);out.push(r);walk(r.id);
    });
  })(id);
  return out;
}
App._renderOKRBin=()=>{
  const B=_OKRBIN;if(!B)return;
  let body;
  if(B.loading)body='<div style="padding:26px 0;text-align:center;font-size:13px;color:var(--c-text-3)">Loading deleted objectives\u2026</div>';
  else if(B.err)body='<div style="padding:20px;border:1px solid var(--c-danger-soft);background:var(--c-danger-soft);border-radius:11px;font-size:13px;color:var(--c-danger-ink)">'+esc(B.err)+'</div>';
  else{
    const roots=_okrBinRoots();
    if(!roots.length)body='<div style="padding:26px 0;text-align:center"><div style="font-size:13.5px;font-weight:700;color:var(--c-text-2)">Nothing has been deleted</div><div style="font-size:12px;color:var(--c-text-3);margin-top:4px">Deleted objectives are kept here so you can bring them back.</div></div>';
    else body=(B.truncated?'<div style="font-size:11.5px;color:#7A4E00;background:#FDF3D9;border:1px solid #FBE6A6;border-radius:9px;padding:8px 11px;margin-bottom:10px;line-height:1.5">Showing the <b>'+_OKRBIN_LIMIT+'</b> most recent deletions. Older ones are still in the database \u2014 erase or restore some of these to see further back.</div>':'')
      +roots.map(r=>{
      const kids=_okrBinSubtree(r.id).length;
      const who=fullName(uById(r.deletedBy))||'someone';
      const when=r.deletedAt?fmtS(String(r.deletedAt).slice(0,10)):'';
      const mine=_okrCanEditNode(r);
      // NOTE: no "parent is gone" claim here. okrById() only sees LIVE objectives, so a
      // parent that is merely soft-deleted, or simply outside this user's visibility scope,
      // also reads as missing \u2014 the old check turned that into "returns at the top level"
      // and then actually nulled parent_id, permanently detaching a branch. The real state
      // of the parent is checked against the server at restore time instead.
      return`<div style="border:1px solid var(--c-border);border-radius:12px;padding:12px 13px;margin-bottom:9px;background:var(--c-surface)">
        <div style="display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap">
          <div style="flex:1;min-width:160px">
            <div style="font-size:13.5px;font-weight:700;color:var(--c-text);line-height:1.4">${esc(r.title||'Untitled objective')}</div>
            <div style="font-size:11.5px;color:var(--c-text-3);margin-top:3px">
              Deleted by ${esc(who)}${when?' \u00b7 '+esc(when):''}${kids?' \u00b7 brings back <b>'+kids+'</b> sub-objective'+(kids===1?'':'s'):''}
            </div>
            ${mine?'':'<div style="font-size:11px;color:var(--c-text-3);margin-top:5px">You can\u2019t restore or erase this one \u2014 you\u2019re not an owner and don\u2019t have edit rights on it.</div>'}
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            ${mine?`<button onclick="App._okrBinRestore('${r.id}')" class="ui-btn ui-btn-primary ui-btn-sm">${ic('refresh','w-3.5 h-3.5')}Restore</button>
            <button onclick="App._okrBinErase('${r.id}')" title="Remove permanently \u2014 this cannot be undone" class="ui-btn ui-btn-ghost ui-btn-sm" style="color:var(--c-danger)">${ic('trash','w-3.5 h-3.5')}Erase</button>`:''}
          </div>
        </div></div>`;
    }).join('');
  }
  modalShell({title:'Deleted objectives',sub:'Restore a deletion, or erase it for good',size:'max-w-2xl',key:'okr-bin',
    body:body,footer:btnG('Close','App.closeModal()')});
};
/* What has become of a restored objective's parent? okrById() is not enough \u2014 it only sees
   live objectives the user can see, so it says "missing" for a parent that is merely
   soft-deleted OR simply outside this user's visibility scope. Ask the server. */
async function _okrParentState(parentId){
  if(!parentId)return'none';                       // top-level already
  if(okrById(parentId))return'live';               // visible and alive \u2014 nothing to warn about
  try{
    const{data,error}=await sb.from('okrs').select('id,deleted_at').eq('id',parentId).maybeSingle();
    if(error)return'unknown';
    if(!data)return'unknown';                      // erased, or hidden from this user by RLS
    return data.deleted_at?'deleted':'live-hidden';
  }catch(e){return'unknown';}
}
App._okrBinRestore=async(id)=>{
  const B=_OKRBIN;if(!B)return;
  const seq=_OKRBIN_SEQ;
  const root=(B.rows||[]).find(r=>r.id===id);if(!root)return;
  // Per-row rights: the bin's own gate is only can('okr','delete'), which would otherwise let
  // someone restore or erase an objective they could never have deleted from the tree.
  if(!_okrCanEditNode(root))return toast('You can\u2019t restore this objective \u2014 you\u2019re not an owner and don\u2019t have edit rights on it','err');
  const subtree=_okrBinSubtree(id);
  const ids=[root.id,...subtree.map(r=>r.id)];
  const pstate=await _okrParentState(root.parentId);
  // parent_id is NEVER rewritten. Detaching a branch is destructive and irreversible, and
  // the three "can't see the parent" cases are indistinguishable from the client.
  const parentNote=pstate==='deleted'
      ?'its parent is still deleted, so it stays hidden until you restore that one too'
    :pstate==='unknown'
      ?'its parent isn\u2019t visible to you, so it may not appear in your own tree'
    :'';
  if(!(await confirmP({
    title:'Restore objective',
    body:'<b>'+esc(root.title||'This objective')+'</b> comes back with everything that was deleted alongside it.',
    items:[subtree.length?('<b>'+subtree.length+'</b> sub-objective'+(subtree.length===1?'':'s')):'',
           'their check-ins, comments and activity logs are intact',
           parentNote].filter(Boolean),
    confirmLabel:'Restore',cancelLabel:'Cancel',danger:false,icon:'refresh'})))return App._renderOKRBin();
  // Await the writes: the reload below issues its SELECT in the same tick, so firing these
  // off unawaited meant the refresh raced ahead of them and the tree came back unchanged.
  const stamp=new Date().toISOString();
  const oks=await Promise.all(ids.map(oid=>sbWrite(
    {table:'okrs',op:'update',id:oid,match:{col:'id',val:oid},values:{deleted_at:null,deleted_by:null,updated_at:stamp}},
    {label:'OKR restore',silent:true})));
  // If the server refused (an RLS write rule the client can't see, a 5xx), say so instead of
  // claiming success — the reload a moment later would silently take the objective away
  // again, which reads as the restore button simply not working.
  if(oks.some(ok=>!ok)){
    const failed=oks.filter(ok=>!ok).length;
    toast(failed===ids.length?'Restore failed — nothing was changed on the server':(failed+' of '+ids.length+' could not be restored; retrying in the background'),'err');
    if(failed===ids.length)return _okrBinPaint(seq)&&App._renderOKRBin();
  }
  // Drop them from this device's tombstone list, or the next refresh hides them again.
  const back=new Set(ids);
  DB.okrsDeleted=(DB.okrsDeleted||[]).filter(x=>!back.has(x));
  // Put them straight back into the live list too, so the tree updates now rather than
  // whenever the next background load happens to run.
  const live=new Set((DB.okrs||[]).map(x=>x.id));
  [root,...subtree].forEach(r=>{if(!live.has(r.id)){const c=JSON.parse(JSON.stringify(r));c.deletedAt=null;c.deletedBy=null;DB.okrs.push(c);}});
  okrLog(root.id,'Restored objective',{count:ids.length,from:'Deleted objectives'});
  _OKRBIN.rows=(_OKRBIN.rows||[]).filter(r=>!back.has(r.id));
  saveDB();toast(ids.length>1?(ids.length+' objectives restored'):'Objective restored');
  if(_okrBinPaint(seq))App._renderOKRBin();
  rr();
  try{await _lazyLoad('okr');}catch(e){}
};
App._okrBinErase=async(id)=>{
  const B=_OKRBIN;if(!B)return;
  const seq=_OKRBIN_SEQ;
  const root=(B.rows||[]).find(r=>r.id===id);if(!root)return;
  if(!_okrCanEditNode(root))return toast('You can\u2019t erase this objective \u2014 you\u2019re not an owner and don\u2019t have edit rights on it','err');
  const subtree=_okrBinSubtree(id);
  const ids=[root.id,...subtree.map(r=>r.id)];
  if(!(await confirmP({
    title:'Erase permanently',
    body:'<b>'+esc(root.title||'This objective')+'</b> will be removed from the database for good.',
    items:[subtree.length?('<b>'+subtree.length+'</b> sub-objective'+(subtree.length===1?'':'s')):'',
           'every check-in, comment and activity log in that branch'].filter(Boolean),
    note:'This is the one that cannot be undone \u2014 it will not come back from here.',
    confirmLabel:'Erase '+ids.length,cancelLabel:'Keep it'})))return App._renderOKRBin();
  _okrHardPurgeIds(new Set(ids));
  const gone=new Set(ids);
  _OKRBIN.rows=(_OKRBIN.rows||[]).filter(r=>!gone.has(r.id));
  DB.okrsDeleted=(DB.okrsDeleted||[]).filter(x=>!gone.has(x));
  saveDB();toast(ids.length+' objective'+(ids.length===1?'':'s')+' erased','warn');
  if(_okrBinPaint(seq))App._renderOKRBin();
};
/* Permanent removal \u2014 only ever reached from the recycle bin, never from a normal delete. */
function _okrHardPurgeIds(ids){
  try{
    cancelPendingWrites('okrs',ids);
    cancelPendingWrites('okr_checkins',ids,'okr_id');
    cancelPendingWrites('okr_logs',ids,'okr_id');
  }catch(e){}
  ids.forEach(oid=>{
    sbWrite({table:'okrs',op:'delete',id:oid,match:{col:'id',val:oid}},{label:'OKR erase',silent:true});
    sbWrite({table:'okr_checkins',op:'delete',match:{col:'okr_id',val:oid}},{label:'OKR check-ins erase',silent:true});
    sbWrite({table:'okr_logs',op:'delete',match:{col:'okr_id',val:oid}},{label:'OKR log erase',silent:true});
  });
}
/* Everything that will disappear with `o` \u2014 used to spell it out in the confirmation.
   SHADOW rows are excluded deliberately. _loadOkrShadows() merges numbers-only stand-ins
   for objectives row-level security hides from this user; they carry no title or owner,
   exist purely so a roll-up parent can total its children, and RLS would refuse to delete
   them anyway (a delete matching zero rows reports success, so we would tell the user they
   were deleted and then watch them return as parentless roots). Counting them would also
   leak how many hidden objectives sit under the tree. If any are present the caller blocks
   the delete outright rather than knowingly orphaning them. */
function _okrDeleteScope(roots){
  const ids=new Set();
  roots.forEach(o=>{ids.add(o.id);okrDescendants(o.id).forEach(d=>ids.add(d.id));});
  let hidden=0;
  [...ids].forEach(x=>{const o=okrById(x);if(o&&o._shadow){hidden++;ids.delete(x);}});
  const all=[...ids].map(okrById).filter(Boolean);
  const rootIds=new Set(roots.map(r=>r.id));
  const kids=all.filter(x=>!rootIds.has(x.id));
  return{
    ids,
    hidden,
    subCount:kids.length,
    quarterCount:kids.filter(x=>x.quarterLabel).length,
    checkins:(DB.okrCheckins||[]).filter(c=>ids.has(c.okrId)&&!c._shadow).length
  };
}
/* Shown when a branch reaches into objectives this user cannot see. */
async function _okrBlockedByHidden(n){
  await confirmP({
    title:'Can\u2019t delete this branch',
    body:'<b>'+n+'</b> objective'+(n===1?'':'s')+' below this one '+(n===1?'is':'are')+' outside what you have access to, so '+(n===1?'it':'they')+' cannot be deleted from here.',
    items:['deleting only the part you can see would leave '+(n===1?'it':'them')+' with no parent',
           'ask an administrator, or someone with access to that department, to delete the branch'],
    confirmLabel:'OK',cancelLabel:'Close',danger:false,icon:'lock'});
  return false;
}
App._okrDelete=async(id)=>{
  const o=okrById(id);if(!o)return;
  if(!_okrCanDelete(o))return toast('You can\u2019t delete this OKR','err');
  const sc=_okrDeleteScope([o]);
  if(sc.hidden)return _okrBlockedByHidden(sc.hidden);
  const plainSubs=sc.subCount-sc.quarterCount;
  const items=[];
  if(sc.quarterCount)items.push('<b>'+sc.quarterCount+'</b> quarterly objective'+(sc.quarterCount===1?'':'s'));
  if(plainSubs)items.push('<b>'+plainSubs+'</b> sub-objective'+(plainSubs===1?'':'s')+' below it');
  if(sc.checkins)items.push('<b>'+sc.checkins+'</b> check-in'+(sc.checkins===1?'':'s')+' and their comments');
  if(sc.subCount)items.push('every activity log in that branch');
  if(!(await confirmP({
    title:'Delete objective',
    body:'<b>'+esc(o.title||'This objective')+'</b>'+(sc.subCount?' and <b>everything underneath it</b> will be removed':' will be removed')+' \u2014 from the tree, the filters, the totals, everyone\u2019s check-in tasks and the reminders.',
    items:items,
    note:'Kept in <b>Deleted objectives</b>, so you can restore the whole branch \u2014 history included \u2014 if you change your mind.',
    confirmLabel:sc.subCount?('Delete all '+(sc.subCount+1)):'Delete',
    cancelLabel:'Keep it'})))return;
  const ids=sc.ids;
  // Purge FIRST, then drop the rows locally: _okrPurgeIds reads each row via okrById() to
  // stamp deletedAt on the in-memory copy, and those rows are about to be filtered out.
  _okrPurgeIds(ids);
  DB.okrs=(DB.okrs||[]).filter(x=>!ids.has(x.id));
  DB.okrCheckins=(DB.okrCheckins||[]).filter(c=>!ids.has(c.okrId));
  DB.okrLogs=(DB.okrLogs||[]).filter(l=>!ids.has(l.okrId));
  ids.forEach(x=>{_OKRSEL.delete(x);delete _OKR_EXP[x];});
  saveOkrExpanded(_OKR_EXP);
  saveDB();toast(ids.size>1?(ids.size+' objectives deleted'):'OKR deleted','warn');rr();
};
/* ═══════════════ v3.13 — BULK EDIT (any field, any number of objectives) ═══════════════
   Tick objectives on the tree → "Bulk edit" → tick the FIELDS you want written. ONLY ticked
   fields are touched; every other value on each objective is left exactly as it was, so one
   pass can retarget 40 quarters without disturbing their owners, dates or history.
   Objectives the user isn't allowed to edit are skipped and reported, never silently changed.
   Each objective gets its own "Bulk edit" entry in its activity log listing what moved.      */
App._okrBulk=()=>{
  const sel=[..._OKRSEL].map(okrById).filter(Boolean);
  if(!sel.length)return toast('Nothing selected','err');
  const editable=sel.filter(_okrCanEditNode);
  if(!editable.length)return toast('You can\'t edit any of the selected objectives','err');
  const f=editable[0];
  _OKRBULK={on:{},ownerMode:'replace',owners:[],ownQ:'',
    departmentId:'',subDepartmentId:'',
    description:'',
    periodStart:'',periodEnd:'',
    metricType:f.metricType||'number',startValue:0,targetValue:null,unit:'',direction:'up',
    freq:{type:'weekly',day:'Mon'},
    rollup:false,rollupMode:'sum',isAnnual:false,
    statusMark:'auto',
    lifecycle:'close',closeReason:''};
  App._renderOKRBulk();
};
App._okrBulkTog=(k)=>{const d=_OKRBULK;if(!d)return;d.on[k]=!d.on[k];App._renderOKRBulk();};
App._okrBulkSet=(k,v)=>{const d=_OKRBULK;if(d)d[k]=v;};
App._okrBulkSetR=(k,v)=>{const d=_OKRBULK;if(!d)return;d[k]=v;App._renderOKRBulk();};
App._okrBulkNum=(k,v)=>{const d=_OKRBULK;if(d)d[k]=(v===''?null:parseFloat(v));};
App._okrBulkDept=(v)=>{const d=_OKRBULK;if(!d)return;d.departmentId=v;d.subDepartmentId='';App._renderOKRBulk();};
App._okrBulkTogOwner=(id)=>{const d=_OKRBULK;if(!d)return;const i=d.owners.indexOf(id);if(i>=0)d.owners.splice(i,1);else d.owners.push(id);App._renderOKRBulk();};
App._okrBulkOwnQ=(v)=>{
  const d=_OKRBULK;if(d)d.ownQ=v;
  const q=String(v||'').trim().toLowerCase();
  const box=document.getElementById('okr-bulk-own-list');if(!box)return;
  let any=false;
  box.querySelectorAll('[data-own-name]').forEach(el=>{const hit=!q||(el.getAttribute('data-own-name')||'').includes(q);el.style.display=hit?'flex':'none';if(hit)any=true;});
  const none=document.getElementById('okr-bulk-own-none');if(none)none.style.display=any?'none':'block';
};
App._okrBulkFreq=(t)=>{
  const d=_OKRBULK;if(!d)return;
  if(t==='none')d.freq={};
  else if(t==='weekly')d.freq={type:'weekly',day:(d.freq&&WKDAYS.includes(d.freq.day))?d.freq.day:'Mon'};
  else if(t==='monthly')d.freq={type:'monthly',day:Number(d.freq&&d.freq.day)||1};
  else d.freq={type:'custom',dates:Array.isArray(d.freq&&d.freq.dates)?d.freq.dates:[]};
  App._renderOKRBulk();
};
App._okrBulkAddDate=()=>{
  const el=document.getElementById('okrBulkDate');if(!el||!el.value)return;
  const d=_OKRBULK;if(!d)return;
  d.freq=d.freq&&d.freq.type==='custom'?d.freq:{type:'custom',dates:[]};
  d.freq.dates=d.freq.dates||[];
  if(!d.freq.dates.includes(el.value)){d.freq.dates.push(el.value);d.freq.dates.sort();}
  App._renderOKRBulk();
};
App._okrBulkRmDate=(i)=>{const d=_OKRBULK;if(d&&d.freq&&Array.isArray(d.freq.dates)){d.freq.dates.splice(i,1);App._renderOKRBulk();}};
App._renderOKRBulk=()=>{
  const d=_OKRBULK;if(!d)return;
  const sel=[..._OKRSEL].map(okrById).filter(Boolean);
  const targets=sel.filter(_okrCanEditNode);
  const skipped=sel.length-targets.length;
  const L='display:block;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px';
  const users=visU().filter(u=>u&&u.status==='Active');
  const deptOpts=(topDepts()||[]).map(x=>[x.id,x.name]);
  const subOpts=d.departmentId?(subDepts(d.departmentId)||[]).map(s=>[s.id,s.name]):[];
  const nYes=targets.filter(o=>o.metricType==='yesno').length;
  const f=d.freq||{},fType=f.type||'none';
  // One ticked "apply this field" row — the control only appears once the field is armed.
  const row=(k,label,help,ctrl)=>{
    const on=!!d.on[k];
    return `<div style="border:1.5px solid ${on?'var(--c-brand)':'var(--c-border)'};background:${on?'var(--c-surface)':'var(--c-surface-2)'};border-radius:12px;padding:11px 13px">
      <div role="checkbox" aria-checked="${on}" onclick="App._okrBulkTog('${k}')" style="display:flex;align-items:flex-start;gap:9px;cursor:pointer">
        <span style="width:17px;height:17px;border-radius:5px;border:1.5px solid ${on?'var(--c-brand)':'var(--c-border-2)'};background:${on?'var(--c-brand)':'var(--c-surface)'};display:grid;place-items:center;color:#fff;flex-shrink:0;margin-top:1px">${on?ic('check','w-3 h-3'):''}</span>
        <span style="min-width:0"><span class="fd" style="display:block;font-size:12.5px;font-weight:800;color:var(--c-text)">${esc(label)}</span>${help?`<span style="display:block;font-size:11px;color:var(--c-text-3);margin-top:2px;line-height:1.5">${help}</span>`:''}</span>
      </div>
      ${on?`<div style="margin-top:10px">${ctrl}</div>`:''}
    </div>`;
  };
  const pill=(active,label,call)=>`<button type="button" onclick="${call}" style="padding:5px 11px;border-radius:20px;border:1.5px solid ${active?'var(--c-text)':'var(--c-border)'};background:${active?'var(--c-ink)':'var(--c-surface)'};color:${active?'#fff':'var(--c-text-2)'};font-size:11.5px;font-weight:700;cursor:pointer">${esc(label)}</button>`;
  const ownersCtrl=`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:9px">
      ${pill(d.ownerMode==='replace','Replace owners',"App._okrBulkSetR('ownerMode','replace')")}
      ${pill(d.ownerMode==='add','Add these owners',"App._okrBulkSetR('ownerMode','add')")}
      ${pill(d.ownerMode==='remove','Remove these owners',"App._okrBulkSetR('ownerMode','remove')")}
    </div>
    <div style="border:1.5px solid var(--c-border);border-radius:12px;background:var(--c-surface);overflow:hidden">
      <div style="display:flex;align-items:center;gap:7px;padding:7px 10px;border-bottom:1px solid var(--c-border);background:var(--c-surface-2);color:var(--c-text-3)">${ic('search','w-3.5 h-3.5')}<input id="okr-bulk-own-q" value="${esc(d.ownQ||'')}" oninput="App._okrBulkOwnQ(this.value)" placeholder="Search by name, email or department…" style="flex:1;border:none;outline:none;background:transparent;font-size:12.5px;color:var(--c-text);min-width:0"/></div>
      <div id="okr-bulk-own-list" style="max-height:152px;overflow-y:auto;padding:4px">
        ${users.slice().sort((a,b)=>{const sa=d.owners.includes(a.id)?0:1,sb2=d.owners.includes(b.id)?0:1;return sa!==sb2?sa-sb2:fullName(a).localeCompare(fullName(b));}).map(u=>{const on=d.owners.includes(u.id);return `<div data-own-name="${esc((fullName(u)+' '+(u.email||'')+' '+(u.department||'')).toLowerCase())}" role="checkbox" aria-checked="${on}" onclick="App._okrBulkTogOwner('${u.id}')" style="display:flex;align-items:center;gap:9px;padding:5px 8px;border-radius:8px;cursor:pointer;${on?'background:var(--c-brand-soft);':''}">
          <span style="width:15px;height:15px;border-radius:5px;border:1.5px solid ${on?'var(--c-brand)':'var(--c-border-2)'};background:${on?'var(--c-brand)':'#fff'};display:grid;place-items:center;color:#fff;flex-shrink:0">${on?ic('check','w-3 h-3'):''}</span>
          ${avatar(u,'w-5 h-5','text-[9px]')}
          <span style="flex:1;min-width:0;font-size:12.5px;font-weight:600;color:var(--c-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(fullName(u))}</span>
          <span style="font-size:10px;color:var(--c-text-3);flex-shrink:0">${esc(u.department||'')}</span>
        </div>`;}).join('')}
        <div id="okr-bulk-own-none" style="display:none;padding:10px;font-size:12px;color:var(--c-text-3)">No one matches that search.</div>
      </div>
    </div>
    <div style="font-size:11px;color:var(--c-text-3);margin-top:6px">${d.owners.length} picked${d.ownerMode==='replace'?' — these become the <b>only</b> owners on every selected objective':d.ownerMode==='add'?' — added alongside whoever already owns each objective':' — removed where present (an objective is never left with no owner)'}</div>`;
  const body=`<div style="display:flex;flex-direction:column;gap:10px">
    <div style="background:var(--c-brand-soft);border:1px solid var(--c-border);border-radius:12px;padding:10px 13px;font-size:12px;color:var(--c-text);line-height:1.6">
      Writing to <b>${targets.length} objective${targets.length===1?'':'s'}</b>${skipped?` · <span style="color:#8A5F00">${skipped} skipped — you don't have edit rights on ${skipped===1?'it':'them'}</span>`:''}.
      <div style="font-size:11px;color:var(--c-text-3);margin-top:3px">Only the fields you tick below are written. Everything else on each objective — including its check-in history — is left untouched.</div>
      ${targets.length<=6?`<div style="font-size:11px;color:var(--c-text-2);margin-top:6px">${targets.map(o=>esc(o.title||'Untitled')).join(' · ')}</div>`:''}
    </div>
    ${row('description','Goal / description','Replaces the description on every selected objective.',
      `<textarea rows="2" oninput="App._okrBulkSet('description',this.value)" placeholder="What does success look like?" class="ui-input" style="resize:vertical">${esc(d.description||'')}</textarea>`)}
    ${row('owners','Owners','Scheduled check-ins reach every owner as one group task — any of them can fill it.',ownersCtrl)}
    ${row('department','Department & sub-department','Leave on “Inherit” to make each objective follow its parent instead.',
      `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><label style="${L}">Department</label><select class="ui-select" onchange="App._okrBulkDept(this.value)"><option value="">— Inherit from parent —</option>${deptOpts.map(x=>`<option value="${esc(x[0])}" ${d.departmentId===x[0]?'selected':''}>${esc(x[1])}</option>`).join('')}</select></div>
        <div><label style="${L}">Sub-department</label><select class="ui-select" ${subOpts.length?'':'disabled'} onchange="App._okrBulkSet('subDepartmentId',this.value)"><option value="">${subOpts.length?'— All / none —':'No sub-departments'}</option>${subOpts.map(s=>`<option value="${esc(s[0])}" ${d.subDepartmentId===s[0]?'selected':''}>${esc(s[1])}</option>`).join('')}</select></div>
      </div>`)}
    ${row('period','Period start & end','The period drives the On track / Off track pace and stops reminders after it ends. Leave a box empty to clear that date.',
      `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><label style="${L}">Period start</label><input type="date" value="${d.periodStart||''}" oninput="App._okrBulkSet('periodStart',this.value)" class="ui-input"/></div>
        <div><label style="${L}">Period end</label><input type="date" value="${d.periodEnd||''}" oninput="App._okrBulkSet('periodEnd',this.value)" class="ui-input"/></div>
      </div>`)}
    ${row('metricType','Metric — how it is measured',(nYes?`${nYes} of the selected objectives are Yes/No.`:'')+' Switching to Yes/No resets start to No and target to Yes.',
      `<select class="ui-select" onchange="App._okrBulkSetR('metricType',this.value)">${OKR_METRICS.map(m=>`<option value="${m[0]}" ${d.metricType===m[0]?'selected':''}>${m[1]}</option>`).join('')}</select>`)}
    ${row('startValue','Start value','Written to every selected objective that isn\'t Yes/No.',
      `<input type="number" step="any" value="${d.startValue===null||d.startValue===undefined?'':d.startValue}" oninput="App._okrBulkNum('startValue',this.value)" placeholder="0" class="ui-input"/>`)}
    ${row('targetValue','Target value','The same number lands on every selected objective — handy for a batch of identical quarterly targets.',
      `<input type="number" step="any" value="${d.targetValue===null||d.targetValue===undefined?'':d.targetValue}" oninput="App._okrBulkNum('targetValue',this.value)" placeholder="e.g. 100" class="ui-input"/>`)}
    ${row('unit','Unit / currency','Percentage objectives always keep “%” and are skipped.',
      `<input type="text" value="${esc(d.unit||'')}" oninput="App._okrBulkSet('unit',this.value)" placeholder="e.g. AED, orders, hrs" class="ui-input"/>`)}
    ${row('direction','Which way is good?','Higher / Lower is better run from a start value to a target. Greater than / Less than use the target as a single line to stay on the right side of — the start value is ignored, no progress % is shown, and the status is judged on the average of each reported day in the period.',
      `<select class="ui-select" onchange="App._okrBulkSetR('direction',this.value)">
        ${OKR_DIRS.map(x=>`<option value="${x[0]}" ${(d.direction||'up')===x[0]?'selected':''}>${esc(OKR_DIR_LONG[x[0]])}</option>`).join('')}
      </select>`)}
    ${row('freq','Check-in schedule','When each owner is asked for an update.',
      `<select class="ui-select" onchange="App._okrBulkFreq(this.value)">
        <option value="weekly" ${fType==='weekly'?'selected':''}>Weekly · on a chosen day</option>
        <option value="monthly" ${fType==='monthly'?'selected':''}>Monthly · on a chosen date</option>
        <option value="custom" ${fType==='custom'?'selected':''}>Custom dates</option>
        <option value="none" ${fType==='none'?'selected':''}>No schedule (manual updates only)</option>
      </select>
      ${fType==='weekly'?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:9px">${WKDAYS.map(x=>pill(f.day===x,x,"App._okrBulkSetR('freq',{type:'weekly',day:'"+x+"'})")).join('')}</div>`:''}
      ${fType==='monthly'?`<div style="display:flex;align-items:center;gap:8px;margin-top:9px"><span style="font-size:12.5px;color:var(--c-text-2)">Day of month</span><input type="number" min="1" max="31" value="${Number(f.day)||1}" oninput="_OKRBULK.freq.day=Math.max(1,Math.min(31,parseInt(this.value)||1))" class="ui-input" style="width:80px"/><span style="font-size:11px;color:var(--c-text-3)">shorter months use their last day</span></div>`:''}
      ${fType==='custom'?`<div style="margin-top:9px"><div style="display:flex;gap:8px"><input type="date" id="okrBulkDate" class="ui-input" style="flex:1"/><button type="button" onclick="App._okrBulkAddDate()" class="ui-btn ui-btn-ghost ui-btn-sm">Add</button></div>
        ${(f.dates||[]).length?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${(f.dates||[]).map((x,i)=>`<span style="display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:20px;padding:3px 6px 3px 10px">${esc(fmtS(x))}<button type="button" onclick="App._okrBulkRmDate(${i})" style="width:16px;height:16px;border-radius:50%;border:none;background:var(--c-border);color:var(--c-text-2);cursor:pointer;font-size:10px;line-height:1">×</button></span>`).join('')}</div>`:'<div style="font-size:11px;color:var(--c-text-3);margin-top:6px">No dates added yet.</div>'}</div>`:''}`)}
    ${row('rollup','Auto-update from the level below','Each objective takes its current value from its own direct sub-objectives instead of a hand-entered check-in. Annual objectives are skipped — they always update from their quarterly objectives.',
      `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        ${pill(d.rollup===true,'On',"App._okrBulkSetR('rollup',true)")}${pill(d.rollup===false,'Off',"App._okrBulkSetR('rollup',false)")}
      </div>
      ${d.rollup?`<div style="margin-top:10px"><label style="${L}">How to combine the values below</label>
        <select class="ui-select" onchange="App._okrBulkSet('rollupMode',this.value)">
          <option value="sum" ${d.rollupMode==='sum'?'selected':''}>Total (sum of all)</option>
          <option value="avg" ${d.rollupMode==='avg'?'selected':''}>Average</option>
          <option value="max" ${d.rollupMode==='max'?'selected':''}>Highest value</option>
          <option value="min" ${d.rollupMode==='min'?'selected':''}>Lowest value</option>
          <option value="latest" ${d.rollupMode==='latest'?'selected':''}>Latest update reported below</option>
        </select></div>`:''}`)}
    ${row('isAnnual','Annual objective flag','Only flips the flag — quarterly objectives are <b>not</b> generated in bulk. Open an objective\'s own editor to split it into quarters.',
      `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">${pill(d.isAnnual===true,'On',"App._okrBulkSetR('isAnnual',true)")}${pill(d.isAnnual===false,'Off',"App._okrBulkSetR('isAnnual',false)")}</div>`)}
    ${row('statusMark','Status','A manual mark overrides the automatic pace calculation until you set it back to Auto.',
      `<div style="display:flex;gap:6px;flex-wrap:wrap">${OKR_STATUSES.map(s=>pill(d.statusMark===s,s,"App._okrBulkSetR('statusMark','"+s+"')")).join('')}${pill(d.statusMark==='auto','Auto — let progress decide',"App._okrBulkSetR('statusMark','auto')")}</div>`)}
    ${row('lifecycle','Close or reopen','Closing freezes updates, check-ins and reminders but keeps everything on record. Owners are notified either way.',
      `<div style="display:flex;gap:6px;flex-wrap:wrap">${pill(d.lifecycle==='close','Close them',"App._okrBulkSetR('lifecycle','close')")}${pill(d.lifecycle==='reopen','Reopen them',"App._okrBulkSetR('lifecycle','reopen')")}</div>
      ${d.lifecycle==='close'?`<div style="margin-top:10px"><label style="${L}">Reason — required, kept on the record</label><textarea rows="2" oninput="App._okrBulkSet('closeReason',this.value)" placeholder="e.g. Superseded by the FY27 plan" class="ui-input" style="resize:vertical">${esc(d.closeReason||'')}</textarea></div>`:''}`)}
    <div style="border:1.5px solid #FBCDCD;background:#FEF0F0;border-radius:12px;padding:11px 13px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div style="min-width:0"><div class="fd" style="font-size:12.5px;font-weight:800;color:#991B1B">Delete these objectives</div><div style="font-size:11px;color:#B91C1C;margin-top:2px;line-height:1.5">Sub-objectives, check-in history and logs go with them — kept in Deleted objectives, so a deletion can be restored.</div></div>
      <button type="button" onclick="App._okrBulkDelete()" style="display:inline-flex;align-items:center;gap:6px;padding:7px 13px;border-radius:9px;border:1.5px solid #B91C1C;background:var(--c-surface);color:#B91C1C;font-size:12px;font-weight:800;cursor:pointer;flex-shrink:0">${ic('trash','w-3.5 h-3.5')}Delete ${targets.length}</button>
    </div>
  </div>`;
  modalShell({title:'Bulk edit',sub:targets.length+' objective'+(targets.length===1?'':'s')+' selected — tick the fields to change',size:'max-w-2xl',key:'okr-bulk',
    body:body,
    footer:btnG('Cancel','App.closeModal()')+btnP('Apply to '+targets.length+' objective'+(targets.length===1?'':'s'),'App._okrBulkApply()')});
  if(d.ownQ)setTimeout(()=>{try{App._okrBulkOwnQ((_OKRBULK&&_OKRBULK.ownQ)||'');}catch(e){}},0);
};
App._okrBulkApply=()=>{
  const d=_OKRBULK;if(!d)return;
  const sel=[..._OKRSEL].map(okrById).filter(Boolean);
  const targets=sel.filter(_okrCanEditNode);
  if(!targets.length)return toast('Nothing to apply to','err');
  const on=d.on;
  if(!Object.keys(on).some(k=>on[k]))return toast('Tick at least one field to change','err');
  // ── validate everything BEFORE a single objective is touched ──
  if(on.owners&&!d.owners.length)return toast('Pick the people first','err');
  if(on.startValue&&(d.startValue===null||d.startValue===undefined||!isFinite(d.startValue)))return toast('Enter the start value','err');
  if(on.targetValue&&(d.targetValue===null||d.targetValue===undefined||!isFinite(d.targetValue)))return toast('Enter the target value','err');
  if(on.period&&d.periodStart&&d.periodEnd&&d.periodEnd<d.periodStart)return toast('Period end is before its start','err');
  if(on.freq){
    const f=d.freq||{};
    if(f.type==='weekly'&&!WKDAYS.includes(f.day))return toast('Pick the weekday for check-ins','err');
    if(f.type==='monthly'&&!(Number(f.day)>=1&&Number(f.day)<=31))return toast('Pick a day of month (1–31)','err');
    if(f.type==='custom'&&!(f.dates||[]).length)return toast('Add at least one check-in date','err');
  }
  if(on.lifecycle&&d.lifecycle==='close'&&!(d.closeReason||'').trim())return toast('Add the reason for closing — it\'s kept on the record','err');
  const _nm=ids=>ids.map(x=>{const u=uById(x);return u?fullName(u):x;}).join(', ');
  let changed=0;const newlyAssigned=[];
  targets.forEach(o=>{
    const ch=[];
    const set=(field,label,val)=>{
      const a=(o[field]===null||o[field]===undefined)?'':String(o[field]);
      const b=(val===null||val===undefined)?'':String(val);
      if(a===b)return;
      ch.push({field:label,from:o[field],to:val});o[field]=val;
    };
    if(on.description)set('description','Goal',d.description||'');
    if(on.owners){
      const before=okrOwners(o);
      let next=d.ownerMode==='replace'?d.owners.slice()
             :d.ownerMode==='add'?[...new Set([...before,...d.owners])]
             :before.filter(x=>!d.owners.includes(x));
      if(!next.length)next=before; // never leave an objective without an owner
      if(JSON.stringify(next)!==JSON.stringify(before)){
        ch.push({field:'Owners',from:_nm(before),to:_nm(next)});
        const added=next.filter(x=>!before.includes(x));
        o.owners=next;o.ownerId=next[0]||null;
        if(added.length)newlyAssigned.push([o,added]);
      }
    }
    if(on.department){set('departmentId','Department',d.departmentId||null);set('subDepartmentId','Sub-department',d.subDepartmentId||null);}
    if(on.period){set('periodStart','Period start',d.periodStart||null);set('periodEnd','Period end',d.periodEnd||null);}
    if(on.metricType){
      set('metricType','Metric',d.metricType);
      if(o.metricType==='percent')o.unit='%';
      if(o.metricType==='yesno'){o.startValue=0;o.targetValue=1;o.rollup=false;o.isAnnual=false;}
    }
    if(on.startValue&&o.metricType!=='yesno')set('startValue','Start value',Number(d.startValue));
    if(on.targetValue&&o.metricType!=='yesno')set('targetValue','Target',Number(d.targetValue));
    if(on.unit&&o.metricType!=='percent'&&o.metricType!=='yesno')set('unit','Unit',d.unit||'');
    if(on.direction&&o.metricType!=='yesno'){set('direction','Which way is good?',d.direction);if(d.direction==='gte'||d.direction==='lte')set('startValue','Start value',0);}
    if(on.freq){
      const nf=(d.freq&&d.freq.type)?JSON.parse(JSON.stringify(d.freq)):{};
      if(JSON.stringify(o.frequency||{})!==JSON.stringify(nf)){
        ch.push({field:'Frequency',from:_okrFreqLabel({frequency:o.frequency||{}}),to:_okrFreqLabel({frequency:nf})});
        o.frequency=nf;
      }
    }
    if(on.rollup&&o.metricType!=='yesno'&&!o.isAnnual){ // v3.19: annuals are quarters-only — bulk roll-up skips them
      if(!!o.rollup!==!!d.rollup){ch.push({field:'Auto roll-up',from:!!o.rollup,to:!!d.rollup});o.rollup=!!d.rollup;}
      if(d.rollup)set('rollupMode','Roll-up mode',d.rollupMode||'sum');
    }
    if(on.isAnnual&&o.metricType!=='yesno'&&!!o.isAnnual!==!!d.isAnnual){ch.push({field:'Annual objective',from:!!o.isAnnual,to:!!d.isAnnual});o.isAnnual=!!d.isAnnual;}
    if(o.isAnnual&&o.rollup){ch.push({field:'Auto roll-up',from:true,to:false});o.rollup=false;} // v3.19: annual ⇒ quarters-only
    if(!o.isAnnual&&/^q-/.test(o.rollupMode||''))o.rollupMode=o.rollupMode.slice(2); // v3.20: annual modes live only on annuals
    /* v3.14: same rule as the single editor — roll-up ON (and not an annual, whose
       frequency is only the template for its quarters) means this objective is never
       asked for an update, so any schedule on it is cleared rather than left dormant.
       Runs AFTER the rollup/isAnnual toggles above so it sees their final values, and
       ONLY when this pass actually touched roll-up, the schedule, or the annual flag —
       bulk-editing the department of 40 objectives must not quietly wipe a schedule on
       any of them, but turning the annual flag OFF on a roll-up objective leaves exactly
       the `rollup && !isAnnual` + live schedule combination this rule exists to prevent. */
    if((on.rollup||on.freq||on.isAnnual)&&o.rollup&&!o.isAnnual&&Object.keys(o.frequency||{}).length){
      ch.push({field:'Check-in schedule',from:_okrFreqLabel({frequency:o.frequency||{}}),to:'none — updates from the level below'});
      o.frequency={};
    }
    if(on.statusMark){
      if(d.statusMark==='auto'){
        if(o.statusMode==='manual'){ch.push({field:'Status',from:o.statusManual,to:'Auto'});o.statusMode='auto';o.statusManual=null;}
      }else if(!(o.statusMode==='manual'&&o.statusManual===d.statusMark)){
        ch.push({field:'Status',from:o.statusMode==='manual'?o.statusManual:'Auto',to:d.statusMark});
        o.statusMode='manual';o.statusManual=d.statusMark;
      }
    }
    if(on.lifecycle){
      if(d.lifecycle==='close'&&!o.closed){
        o.closed=true;o.closedReason=(d.closeReason||'').trim();o.closedAt=new Date().toISOString();o.closedBy=S.uid;
        ch.push({field:'Closed',from:'open',to:o.closedReason});
        _okrNotify(okrOwners(o),'okr_closed','🔒 OKR closed: "'+(o.title||'')+'" — '+o.closedReason,{okr_title:o.title||'',actor:fullName(me()),status:'closed',reason:o.closedReason});
      }else if(d.lifecycle==='reopen'&&o.closed){
        const was=o.closedReason||'';
        o.closed=false;o.closedReason='';o.closedAt=null;o.closedBy=null;
        ch.push({field:'Closed',from:was,to:'reopened'});
        _okrNotify(okrOwners(o),'okr_closed','🔓 OKR reopened: "'+(o.title||'')+'" — updates resume',{okr_title:o.title||'',actor:fullName(me()),status:'reopened',reason:was});
      }
    }
    if(ch.length){o.updatedAt=new Date().toISOString();okrLog(o.id,'Bulk edit',{of:targets.length,changes:ch});_okrPush(o);changed++;}
  });
  newlyAssigned.forEach(x=>{try{_okrNotifyAssigned(x[0],x[1]);}catch(e){}});
  const skipped=sel.length-targets.length;
  const tail=skipped?(' · '+skipped+' skipped (no edit rights)'):'';
  saveDB();closeModal();rr();
  toast(changed?(changed+' objective'+(changed===1?'':'s')+' updated'+tail):('Nothing needed changing'+tail),changed?'':'warn');
};
App._okrBulkDelete=async()=>{
  const sel=[..._OKRSEL].map(okrById).filter(Boolean);
  const targets=sel.filter(_okrCanDelete);
  if(!targets.length)return toast('Nothing you can delete is selected','err');
  const sc=_okrDeleteScope(targets);
  // Blocked because the branch reaches objectives this user cannot see — that notice takes
  // over the single modal slot, so put the bulk dialog back once it is dismissed.
  if(sc.hidden){closeModal();await _okrBlockedByHidden(sc.hidden);return App._renderOKRBulk();}
  // "Skipped" must only count objectives that really survive. One you have no rights to
  // still goes if it sits UNDER something you are deleting, so reporting it as skipped
  // while deleting it anyway was a lie — count only those outside every target's subtree.
  const skipped=sel.filter(x=>!sc.ids.has(x.id)).length;
  const plainSubs=sc.subCount-sc.quarterCount;
  const items=[];
  if(sc.quarterCount)items.push('<b>'+sc.quarterCount+'</b> quarterly objective'+(sc.quarterCount===1?'':'s'));
  if(plainSubs)items.push('<b>'+plainSubs+'</b> sub-objective'+(plainSubs===1?'':'s')+' below them');
  if(sc.checkins)items.push('<b>'+sc.checkins+'</b> check-in'+(sc.checkins===1?'':'s')+' and their comments');
  items.push('every activity log in those branches');
  if(skipped)items.push('<span style="color:var(--c-text-3)">'+skipped+' selected objective'+(skipped===1?'':'s')+' will be skipped — you don’t have delete rights</span>');
  // Closing the bulk dialog first, so the confirm is not stacked on top of it.
  closeModal();
  if(!(await confirmP({
    title:'Delete '+targets.length+' objective'+(targets.length===1?'':'s'),
    body:'<b>'+targets.length+'</b> selected objective'+(targets.length===1?'':'s')+(sc.subCount?' and <b>everything underneath</b> will be removed':' will be removed')+' from the tree, the totals and everyone’s check-in tasks.',
    items:items,
    note:'Kept in <b>Deleted objectives</b> — each deletion can be restored with its history.',
    confirmLabel:'Delete '+sc.ids.size,
    cancelLabel:'Keep them'})))return App._renderOKRBulk(); // cancel puts the bulk dialog back, selection intact
  const ids=sc.ids;
  // v3.14: mark the FULL subtree deleted server-side, not just the selected roots — and
  // before the local rows go, since _okrPurgeIds reads each one via okrById().
  _okrPurgeIds(ids);
  DB.okrs=(DB.okrs||[]).filter(x=>!ids.has(x.id));
  DB.okrCheckins=(DB.okrCheckins||[]).filter(c=>!ids.has(c.okrId));
  DB.okrLogs=(DB.okrLogs||[]).filter(l=>!ids.has(l.okrId));
  ids.forEach(x=>{delete _OKR_EXP[x];});
  saveOkrExpanded(_OKR_EXP);
  _OKRSEL=new Set();
  saveDB();toast(ids.size+' objective'+(ids.size===1?'':'s')+' deleted','warn');rr();
};
App._okrMarkStatus=(id,st)=>{
  const o=okrById(id);if(!o)return;
  if(!_okrCanCheckin(o))return toast('Only the owner or a manager can mark status','err');
  if(st==='auto'){
    if(o.statusMode!=='auto'){o.statusMode='auto';o.statusManual=null;okrLog(id,'Status switched to automatic',{});_okrPush(o);}
  }else{
    if(!(o.statusMode==='manual'&&o.statusManual===st)){o.statusMode='manual';o.statusManual=st;okrLog(id,'Marked status',{to:st});_okrPush(o);}
  }
  saveDB();rr();

  rr();_okrPMRefresh(id);};

/* ── Single check-in modal (value + comment + photos + optional status mark) ── */
App._okrCheckin=(okrId,date)=>{
  {const _o=okrById(okrId);if(_o&&_o.closed)return toast('This objective is closed — reopen it to add updates','warn');if(_o&&_o.isAnnual)return toast('This annual objective updates automatically from its quarterly objectives','warn');if(_o&&_o.rollup)return toast('This objective updates automatically from its sub-objectives','warn');}
  const o=okrById(okrId);if(!o)return;
  if(!_okrCanCheckin(o))return toast('Only the owner or a manager can add updates','err');
  const d=date||todayISO();
  const ex=okrCheckinFor(okrId,S.uid,d)||((DB.okrCheckins||[]).find(c=>c.okrId===okrId&&c.date===d));
  _OKRCI={okrId:okrId,date:d,value:ex?ex.value:(o.metricType==='yesno'?null:null),comment:ex?ex.comment:'',photos:ex?(ex.photos||[]).filter(p=>typeof p==='string'&&p!=='[photo]').slice():[],statusMark:ex?ex.statusMark:null,existingId:ex?ex.id:null};
  App._renderOKRCheckin();
};
App._okrCISetDate=(v)=>{if(!v||!_OKRCI)return;App._okrCheckin(_OKRCI.okrId,v);};
App._okrCISetVal=(v)=>{if(_OKRCI){_OKRCI.value=v;App._renderOKRCheckin();}};
App._okrCIPhotoAdd=(input)=>{
  const files=[...(input.files||[])];if(!files.length)return;
  let pending=files.length;
  files.forEach(f=>{const r=new FileReader();r.onload=e=>{_OKRCI&&_OKRCI.photos.push(e.target.result);if(--pending===0)App._renderOKRCheckin();};r.onerror=()=>{if(--pending===0)App._renderOKRCheckin();};r.readAsDataURL(f);});
  input.value='';
};
App._okrCIPhotoRm=(i)=>{if(_OKRCI){_OKRCI.photos.splice(i,1);App._renderOKRCheckin();}};
App._renderOKRCheckin=()=>{
  const d=_OKRCI;if(!d)return;
  const o=okrById(d.okrId);if(!o)return;
  const L='display:block;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px';
  const ynBtn=(v,label)=>`<button type="button" onclick="App._okrCISetVal(${v})" style="flex:1;padding:12px;border-radius:11px;border:2px solid ${Number(d.value)===v?(v===1?'#22C55E':'#EF4444'):'var(--c-border)'};background:${Number(d.value)===v?(v===1?'#E4F2F0':'#FEEEEF'):'var(--c-surface)'};color:${Number(d.value)===v?(v===1?'#0F7A45':'#C41E32'):'var(--c-text-2)'};font-size:14px;font-weight:800;cursor:pointer">${label}</button>`;
  modalShell({title:(d.existingId?'Edit update':'Add update'),sub:(o.title||'')+' · '+_okrTargetWord(o)+' '+(o.metricType==='yesno'?'Yes':_okrFmtTarget(o,_okrTargetEff(o))),size:'max-w-md',key:'okr-ci',
    body:`<div style="display:flex;flex-direction:column;gap:14px">
      <div><label style="${L}">Date</label><input type="date" value="${d.date}" onchange="App._okrCISetDate(this.value)" class="ui-input rf"/></div>
      ${o.metricType==='yesno'
        ?`<div><label style="${L}">Done?</label><div style="display:flex;gap:10px">${ynBtn(1,'Yes ✓')}${ynBtn(0,'No ✗')}</div></div>`
        :`<div><label style="${L}">Value ${o.unit?('('+esc(o.unit)+')'):''} *</label><input type="number" step="any" value="${d.value!==null&&d.value!==undefined?d.value:''}" oninput="_OKRCI.value=this.value===''?null:parseFloat(this.value)" placeholder="Latest measured value" class="ui-input rf"/></div>`}
      <div><label style="${L}">Comment</label>
        <div style="display:flex;gap:6px;margin-bottom:6px">
          <button type="button" onclick="App._okrFmtInsert('okr-ci-comment','bullet')" title="Add a bullet point" style="display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border:1px solid var(--c-border);background:var(--c-surface);border-radius:8px;font-size:12px;font-weight:700;color:var(--c-text-2);cursor:pointer">${ic('list','w-3.5 h-3.5')}Bullet</button>
          <button type="button" onclick="App._okrFmtInsert('okr-ci-comment','bold')" title="Bold the selected text" style="padding:5px 12px;border:1px solid var(--c-border);background:var(--c-surface);border-radius:8px;font-size:13px;font-weight:800;color:var(--c-text-2);cursor:pointer">B</button>
        </div>
        <textarea id="okr-ci-comment" rows="4" oninput="_OKRCI.comment=this.value" placeholder="Context, blockers, wins…&#10;Start a line with “- ” for a bullet · wrap text in **stars** for bold · new lines are kept" class="ui-input rf" style="resize:vertical;line-height:1.5">${esc(d.comment||'')}</textarea>
      </div>
      <div><label style="${L}">Photos</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          ${d.photos.map((p,i)=>`<span style="position:relative;display:inline-block"><img src="${esc(p)}" alt="Attached photo" style="width:52px;height:52px;object-fit:cover;border-radius:9px;border:1px solid var(--c-border)"/><button type="button" onclick="App._okrCIPhotoRm(${i})" style="position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;border:none;background:#0F3038;color:#fff;font-size:10px;cursor:pointer;line-height:1">×</button></span>`).join('')}
          <label style="width:52px;height:52px;border:1.5px dashed var(--c-border);border-radius:9px;display:grid;place-items:center;color:var(--c-text-3);cursor:pointer">${ic('cam','w-4 h-4')}<input type="file" accept="image/*" multiple hidden onchange="App._okrCIPhotoAdd(this)"/></label>
        </div>
      </div>
      <div><label style="${L}">Mark status (optional)</label><div style="display:flex;gap:6px;flex-wrap:wrap">
        ${OKR_STATUSES.map(s=>{const on=d.statusMark===s;const m=OKR_ST_META[s];return`<button type="button" onclick="_OKRCI.statusMark=_OKRCI.statusMark==='${s}'?null:'${s}';App._renderOKRCheckin()" style="padding:5px 11px;border-radius:20px;border:1.5px solid ${on?m.dot:'var(--c-border)'};background:${on?m.bg:'var(--c-surface)'};color:${on?m.fg:'var(--c-text-2)'};font-size:11.5px;font-weight:700;cursor:pointer">${s}</button>`;}).join('')}
      </div><div style="font-size:11px;color:var(--c-text-3);margin-top:6px">Marking a status here also sets it on the objective (logged). Leave empty to keep the automatic status.</div></div>
      ${d.existingId?`<div style="font-size:11.5px;color:#7A4E00;background:#FDF3D9;border-radius:9px;padding:8px 11px">You're editing an existing update — the change is recorded in the activity log.</div>`:''}
    </div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP(d.existingId?'Save changes':'Save update','App._okrCheckinSave()')});
};
// Shared apply: used by the single modal AND the combined "due today" modal. Logs everything.
function _okrApplyCheckin(okrId,date,d){
  const o=okrById(okrId);if(!o)return false;
  /* v3.14 — the last gate before a value is written. An objective that auto-updates from
     the level below takes its number from its sub-objectives and from nothing else, so no
     manual value may land on it whatever route got here: a modal left open while somebody
     else flipped the toggle, a queued save replayed after reconnect, or any future caller.
     Annuals (fed by their quarters) and closed objectives are refused for the same reason. */
  if(o.rollup||o.isAnnual||o.closed)return false;
  if(d.value===null||d.value===undefined||!isFinite(d.value))return false;
  const ex=d.existingId?(DB.okrCheckins||[]).find(c=>c.id===d.existingId):null;
  if(ex){
    const changes=[];
    if(String(ex.value)!==String(d.value))changes.push({field:'value',from:ex.value,to:d.value});
    if((ex.comment||'')!==(d.comment||''))changes.push({field:'comment',from:(ex.comment||'').slice(0,80),to:(d.comment||'').slice(0,80)});
    ex.value=d.value;ex.comment=String(d.comment||'').slice(0,2000);
    if(d.photos)ex.photos=d.photos;
    ex.statusMark=d.statusMark||null;
    if(changes.length){ex.editCount=(ex.editCount||0)+1;okrLog(okrId,'Edited check-in',{date:date,changes:changes});}
    ex.updatedAt=new Date().toISOString();
    _okrPushCheckin(ex);
  }else{
    const c={id:uid('okc'),okrId:okrId,userId:S.uid,date:date,value:d.value,comment:String(d.comment||'').slice(0,2000),photos:d.photos||[],statusMark:d.statusMark||null,editCount:0,createdAt:new Date().toISOString()};
    DB.okrCheckins=DB.okrCheckins||[];DB.okrCheckins.push(c);
    okrLog(okrId,'Check-in',{date:date,value:d.value});
    _okrPushCheckin(c);
    // v3.11: co-owners are told the group's update is in (in-app + optional email)
    _okrNotify(okrOwners(o),'okr_update_added','📈 "'+(o.title||'')+'" updated: '+_okrFmtVal(o,d.value)+' by '+fullName(me()),{okr_title:o.title||'',actor:fullName(me()),value:_okrFmtVal(o,d.value),comment:d.comment||''});
  }
  if(d.statusMark&&!(o.statusMode==='manual'&&o.statusManual===d.statusMark)){
    o.statusMode='manual';o.statusManual=d.statusMark;
    okrLog(okrId,'Marked status',{to:d.statusMark});_okrPush(o);
  }
  return true;
}
App._okrCheckinSave=()=>{
  const d=_OKRCI;if(!d)return;
  const o=okrById(d.okrId);if(!o)return;
  if(d.value===null||d.value===undefined||!isFinite(d.value))return toast(o.metricType==='yesno'?'Pick Yes or No':'Enter the value','err');
  // v3.14: honour the guard's answer. _okrApplyCheckin refuses roll-up / annual / closed
  // objectives; reporting "Update saved" while silently dropping the value is exactly how
  // people lose work — this is the case where a co-owner flipped the toggle (and a
  // background refresh replaced DB.okrs) while this modal sat open.
  if(!_okrApplyCheckin(d.okrId,d.date,d)){
    return toast(o.rollup?'This objective now updates from the level below — your value was not saved'
                :o.isAnnual?'This objective now updates from its quarters — your value was not saved'
                :o.closed?'This objective has been closed — your value was not saved'
                :'That value could not be saved','err');
  }
  const _oid=d.okrId;_OKRCI=null;saveDB();closeModal();toast('Update saved');rr();if(typeof _okrPMRefresh==='function')_okrPMRefresh(_oid);
};

/* ── Combined "all OKR tasks due that day" modal — the scheduled checklist ── */
/* ══════════════════════════════════════════════════════════════════════════════
   OKR EXTRACT — a full Excel workbook for the selected (or all visible) objectives.
   Four sheets: Objectives · Updates · Target revisions · Activity.
   Everything is drawn from what the user is allowed to see (okrVisible/okrCanSee).
   ══════════════════════════════════════════════════════════════════════════════ */
function _okrDeptNames(o){
  const eff=okrDeptOf(o);
  const d=(DB.departments||[]).find(x=>x.id===eff.deptId);
  const sd=(DB.departments||[]).find(x=>x.id===eff.subDeptId);
  return{dept:d?d.name:'',sub:sd?sd.name:''};
}
function _okrPlain(v){return v===null||v===undefined?'':v;}
function _okrDT(v){if(!v)return'';try{const d=new Date(v);return isNaN(d)?String(v):d.toISOString().slice(0,16).replace('T',' ');}catch(e){return String(v);}}
function _okrNameOf(id){const u=id?uById(id):null;return u?fullName(u):'';}
/* Rich text -> plain, so comments written with the bold/bullet helpers export readably. */
function _okrCommentText(t){
  return String(t||'').replace(/<br\s*\/?>/gi,'\n').replace(/<\/(p|div|li)>/gi,'\n')
    .replace(/<li[^>]*>/gi,'• ').replace(/<[^>]+>/g,'')
    .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'")
    .replace(/\n{3,}/g,'\n\n').trim();
}

/* Which objectives the extract covers: the ticked ones, else everything on screen. */
function _okrExportSet(){
  const sel=[..._OKRSEL].map(okrById).filter(Boolean).filter(okrCanSee);
  if(sel.length)return sel;
  return okrVisible();
}

App._okrExport=async()=>{
  if(!can('okr','view'))return toast('You don’t have permission to view objectives','err');
  const list=_okrExportSet();
  if(!list.length)return toast('Nothing to export','err');
  let X;
  try{X=await _loadXLSX();}
  catch(e){return toast(e.message||'Couldn’t load the spreadsheet library','err');}
  try{
    /* ── Sheet 1: Objectives ─────────────────────────────────────────────── */
    const oHead=['Level','Objective','Description','Parent objective','Owner(s)','Department','Sub-department',
      'Metric','Unit','Which way is good?','Scoring','Start','Current','Target','Revised target','Effective target',
      'Progress %','Status','Status set','Period start','Period end','Quarter','Annual','Rolls up','Roll-up mode',
      'Check-in schedule','Updates','Last update','Last value','Last comment',
      'Closed','Close reason','Closed on','Closed by','Created by','Created on','Last changed','ID'];
    const oRows=[oHead];
    list.forEach(o=>{
      const cks=okrCheckinsOf(o.id), last=cks.length?cks[cks.length-1]:null;
      const dn=_okrDeptNames(o), par=o.parentId?okrById(o.parentId):null;
      const pct=okrProgress(o);
      oRows.push([
        'L'+okrLevel(o), o.title||'', o.description||'', par?(par.title||''):'',
        okrOwners(o).map(_okrNameOf).filter(Boolean).join(', '), dn.dept, dn.sub,
        (OKR_METRICS.find(m=>m[0]===o.metricType)||[,o.metricType])[1], o.unit||'',
        okrDirLabel(o), okrIsThresh(o)?'Not scored — pass/fail against the threshold':okrIsLimit(o)?'Not scored \u2014 pass/fail against the allowance':'Distance from start to target',
        _okrPlain(o.startValue), _okrPlain(_okrOwnCur(o)), _okrPlain(o.targetValue),
        _okrPlain(o.revisedTarget), _okrPlain(_okrTargetEff(o)),
        pct===null?'':pct, okrStatusOf(o), o.statusMode==='manual'?'Manual':'Automatic',
        o.periodStart||'', o.periodEnd||'', o.quarterLabel||'',
        o.isAnnual?'Yes':'No', o.rollup?'Yes':'No', o.rollup?_okrModeLabel(o.rollupMode):'',
        _okrFreqLabel(o), cks.length,
        last?last.date:'', last?_okrPlain(last.value):'', last?_okrCommentText(last.comment):'',
        o.closed?'Yes':'No', o.closedReason||'', _okrDT(o.closedAt), _okrNameOf(o.closedBy),
        _okrNameOf(o.createdBy), _okrDT(o.createdAt), _okrDT(o.updatedAt), o.id
      ]);
    });

    /* ── Sheet 2: every update, with its comment ─────────────────────────── */
    const uHead=['Objective','Level','Date','Value','Comment','Status marked','Recorded by','Times edited','Recorded at','Objective ID','Update ID'];
    const uRows=[uHead];
    list.forEach(o=>okrCheckinsOf(o.id).forEach(c=>{
      uRows.push([o.title||'','L'+okrLevel(o),c.date||'',_okrPlain(c.value),_okrCommentText(c.comment),
        c.statusMark||'',_okrNameOf(c.userId),c.editCount||0,_okrDT(c.createdAt),o.id,c.id]);
    }));
    if(uRows.length===1)uRows.push(['No updates recorded for the selected objectives','','','','','','','','','','']);

    /* ── Sheet 3: target revisions ──────────────────────────────────────── */
    const rHead=['Objective','Original target','Revised target','Reason','Revised on','Revised by','Objective ID'];
    const rRows=[rHead];
    list.filter(okrHasRevision).forEach(o=>{
      rRows.push([o.title||'',_okrPlain(o.targetValue),_okrPlain(o.revisedTarget),
        o.revisedNote||'',_okrDT(o.revisedAt),_okrNameOf(o.revisedBy),o.id]);
    });
    if(rRows.length===1)rRows.push(['No target revisions','','','','','','']);

    /* ── Sheet 4: activity trail ────────────────────────────────────────── */
    const ids=new Set(list.map(o=>o.id));
    const aHead=['Objective','Action','Detail','By','When','Objective ID'];
    const aRows=[aHead];
    (DB.okrLogs||[]).filter(l=>ids.has(l.okrId)).forEach(l=>{
      const o=okrById(l.okrId);
      let det='';
      try{det=Object.entries(l.details||{}).map(([k,v])=>k+': '+(typeof v==='object'?JSON.stringify(v):v)).join(' · ');}catch(e){}
      aRows.push([o?(o.title||''):'',l.action||'',det,_okrNameOf(l.actorId),_okrDT(l.createdAt),l.okrId]);
    });
    if(aRows.length===1)aRows.push(['No activity recorded','','','','','']);

    const wb=X.utils.book_new();
    [['Objectives',oRows,[6,34,44,28,26,18,18,12,10,15,15,10,10,10,13,15,11,13,11,13,13,10,8,9,15,26,9,13,11,50,8,26,17,18,18,17,17,14]],
     ['Updates',uRows,[34,6,12,10,60,14,20,12,17,14,14]],
     ['Target revisions',rRows,[34,15,15,44,17,20,14]],
     ['Activity',aRows,[34,20,52,20,17,14]]]
    .forEach(([name,rows,cols])=>{
      const ws=X.utils.aoa_to_sheet(rows);
      ws['!cols']=cols.map(w=>({wch:w}));
      ws['!freeze']={xSplit:0,ySplit:1};
      X.utils.book_append_sheet(wb,ws,name);
    });
    X.writeFile(wb,'bridge_okrs_'+todayISO()+'.xlsx');
    toast('Exported '+list.length+' objective'+(list.length===1?'':'s')+' · '+(uRows.length-1)+' update'+(uRows.length===2?'':'s'));
    try{log(fullName(me()),'Exported OKRs',list.length+' objectives');}catch(e){}
  }catch(e){toast(e.message||'Export failed','err');}
};

App._okrCheckinAll=(date)=>{
  const d=date||todayISO();
  const due=okrDueForUser(S.uid,d);
  if(!due.length)return toast('No OKR check-ins scheduled for this day','warn');
  _OKRCIALL={date:d,items:due.map(o=>{const ex=okrCheckinFor(o.id,S.uid,d)||okrCheckinForDate(o.id,d);return{okrId:o.id,value:ex?ex.value:null,comment:ex?ex.comment:'',statusMark:ex?ex.statusMark:null,existingId:ex?ex.id:null,photos:ex?(ex.photos||[]).slice():[]};})};
  App._renderOKRCheckinAll();
};
App._okrCIAllVal=(i,v)=>{const it=_OKRCIALL&&_OKRCIALL.items[i];if(it){it.value=v;App._renderOKRCheckinAll();}};
App._renderOKRCheckinAll=()=>{
  const A=_OKRCIALL;if(!A)return;
  const rows=A.items.map((it,i)=>{
    const o=okrById(it.okrId);if(!o)return'';
    const exCk=it.existingId?(DB.okrCheckins||[]).find(c=>c.id===it.existingId):null;
    const done=exCk?('<span style="font-size:10px;font-weight:800;background:#E4F2F0;color:#0B6660;padding:2px 8px;border-radius:10px">'+(exCk.userId&&exCk.userId!==S.uid?('updated by '+esc(fullName(uById(exCk.userId))||'a co-owner')+' — editing'):'already updated — editing')+'</span>'):'';
    const ynBtn=(v,label)=>`<button type="button" onclick="App._okrCIAllVal(${i},${v})" style="flex:1;padding:8px;border-radius:9px;border:2px solid ${Number(it.value)===v?(v===1?'#22C55E':'#EF4444'):'var(--c-border)'};background:${Number(it.value)===v?(v===1?'#E4F2F0':'#FEEEEF'):'var(--c-surface)'};color:${Number(it.value)===v?(v===1?'#0F7A45':'#C41E32'):'var(--c-text-2)'};font-size:12.5px;font-weight:800;cursor:pointer">${label}</button>`;
    return `<div style="border:1px solid var(--c-border);border-radius:12px;padding:12px;margin-bottom:10px;background:var(--c-surface)">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">
        ${_okrLvlChip(okrLevel(o))}
        <span style="flex:1;min-width:0;font-size:13.5px;font-weight:600;color:var(--c-text)">${esc(o.title)}</span>
        ${done}
        <button type="button" title="Open full form (photos)" onclick="App.closeModal();App._okrCheckin('${o.id}','${A.date}')" style="width:26px;height:26px;display:grid;place-items:center;border-radius:7px;border:1px solid var(--c-border);background:var(--c-surface);color:var(--c-text-3);cursor:pointer">${ic('cam','w-3.5 h-3.5')}</button>
      </div>
      <div style="font-size:11px;color:var(--c-text-3);margin-bottom:7px">${(()=>{const w=_okrTargetWord(o);return w.charAt(0).toUpperCase()+w.slice(1);})()}: ${o.metricType==='yesno'?'Yes':esc(_okrFmtTarget(o,_okrTargetEff(o)))}${o.metricType!=='yesno'?' · currently '+esc(_okrFmtVal(o,(okrLatestCheckin(o.id)||{}).value)):''}</div>
      ${o.metricType==='yesno'
        ?`<div style="display:flex;gap:8px;margin-bottom:8px">${ynBtn(1,'Yes ✓')}${ynBtn(0,'No ✗')}</div>`
        :`<input type="number" step="any" value="${it.value!==null&&it.value!==undefined?it.value:''}" oninput="_OKRCIALL.items[${i}].value=this.value===''?null:parseFloat(this.value)" placeholder="Value ${o.unit?('('+esc(o.unit)+')'):''}" class="ui-input rf" style="margin-bottom:8px"/>`}
      <input type="text" value="${esc(it.comment||'')}" oninput="_OKRCIALL.items[${i}].comment=this.value" placeholder="Comment (optional)" class="ui-input rf"/>
    </div>`;
  }).join('');
  modalShell({title:'OKR check-ins · '+fmtD(A.date),sub:A.items.length+' scheduled update'+(A.items.length===1?'':'s')+' — fill what you have, save once',size:'max-w-lg',key:'okr-ciall',
    body:`<div>${rows}</div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP('Save all','App._okrCheckinAllSave()')});
};
App._okrCheckinAllSave=()=>{
  const A=_OKRCIALL;if(!A)return;
  const hasVal=it=>it.value!==null&&it.value!==undefined&&isFinite(it.value);
  /* A comment with no value used to be dropped silently on save. Block instead and
     name the objectives that still need a number, so nothing typed is ever lost. */
  const orphan=A.items.filter(it=>!hasVal(it)&&String(it.comment||'').trim());
  if(orphan.length){
    const names=orphan.map(it=>'\u201c'+((okrById(it.okrId)||{}).title||'')+'\u201d').join(', ');
    return toast('Add a value for '+names+' \u2014 a comment on its own can\u2019t be saved','err');
  }
  let n=0;
  A.items.forEach(it=>{if(hasVal(it)){if(_okrApplyCheckin(it.okrId,A.date,it))n++;}});
  if(!n)return toast('Enter at least one value','err');
  _OKRCIALL=null;saveDB();closeModal();toast(n+' update'+(n===1?'':'s')+' saved');rr();
};

/* ── Virtual "OKR Check-ins" card shown inside My Checklists on due days ── */
function _okrClCard(due,date){
  const today=todayISO();
  // GROUP rule: a check-in by ANY owner counts for the whole group (like "any one" checklists)
  const doneN=due.filter(o=>okrCheckinForDate(o.id,date)).length;
  const allDone=doneN===due.length;
  const isFuture=date>today;
  const anyGroup=due.some(o=>okrOwners(o).length>1);
  const rows=due.slice(0,6).map(o=>{
    const ck=okrCheckinForDate(o.id,date);
    const by=ck&&ck.userId&&ck.userId!==S.uid?uById(ck.userId):null;
    return `<div style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--c-text-2);padding:3px 0">
      ${ck?`<span style="color:#0B6660;flex-shrink:0">${ic('check','w-3.5 h-3.5')}</span>`:`<span style="width:6px;height:6px;border-radius:50%;background:#E0A106;flex-shrink:0;margin:0 5px"></span>`}
      <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(o.title)}</span>
      ${by?`<span title="Submitted by ${esc(fullName(by))} — counts for the whole group" style="font-size:10px;color:var(--c-text-3);flex-shrink:0">by ${esc(fullName(by))}</span>`:''}
      ${ck?`<span style="font-weight:800;color:var(--c-success-ink);font-size:12px">${esc(_okrFmtVal(o,ck.value))}</span>`:''}
    </div>`;
  }).join('');
  return `<div class="ui-card" style="padding:14px;border-left:3px solid ${allDone?'#22C55E':'#E0A106'}">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
      <span style="width:36px;height:36px;border-radius:10px;background:var(--c-brand-soft);color:var(--c-brand-ink);display:grid;place-items:center;flex-shrink:0">${ic('chart','w-4.5 h-4.5')}</span>
      <div style="flex:1;min-width:0">
        <div class="fd" style="font-size:14px;font-weight:800;color:var(--c-text)">OKR Check-ins <span style="font-size:10px;font-weight:800;padding:1px 7px;border-radius:20px;background:var(--c-brand-soft);color:var(--c-brand-ink);vertical-align:middle;margin-left:4px">OKR</span></div>
        <div style="font-size:12px;color:var(--c-text-2)">${doneN}/${due.length} updated · combined from all your scheduled OKRs${anyGroup?' · shared — any owner can submit for the group':''}</div>
      </div>
      <span style="font-size:12px;font-weight:800;padding:3px 10px;border-radius:20px;background:${allDone?'var(--c-success-soft)':'var(--c-warn-soft)'};color:${allDone?'var(--c-success-ink)':'var(--c-warn-ink)'}">${allDone?'Done':(due.length-doneN)+' to do'}</span>
    </div>
    ${rows}${due.length>6?`<div style="font-size:11px;color:var(--c-text-3);padding:3px 0">+${due.length-6} more…</div>`:''}
    <div style="display:flex;justify-content:flex-end;margin-top:9px">
      ${isFuture?'<span style="font-size:12px;color:#90A5AB;font-weight:600">Scheduled for this date</span>':btn(allDone?'Review / edit':'Update now',`App._okrCheckinAll('${date}')`,{variant:allDone?'ghost':'primary',size:'sm',icon:'edit'})}
    </div>
  </div>`;
}

/* ── Per-node charts v2: TWO lines in one graph — “Ideal” (how it should go, a straight pace
   line from start → target across the period) and “Actual” (what the owner really reported).
   Leaves plot metric values; parents plot roll-up progress % over time vs the 0→100% pace. ── */
const _OKR_MODE_LABEL={sum:'total',avg:'average',max:'highest',min:'lowest',latest:'latest update'};
function _okrModeLabel(m){return _OKR_MODE_LABEL[m]||'total';}
/* Which children feed a roll-up node: the classic rule — ALL direct children. (Annuals never
   roll up from the level below any more — they read their quarter-tagged children only, per
   the annual mode; see okrAnnualMode().) */
function _okrRollupKids(o){
  return okrChildren(o.id);
}
/* 'latest' roll-up: the value of the MOST RECENT update on any feeding sub-objective (≤ date).
   Made for annual objectives fed by quarters — Q2's newest number supersedes Q1's.
   v3.20: on an ANNUAL only the quarter-tagged children feed it — never regular sub-objectives. */
function _okrLatestChildValueAt(o,date){
  let best=null;
  (o.isAnnual?_okrQKids(o):_okrRollupKids(o)).forEach(k=>{
    okrCheckinsOf(k.id).forEach(c=>{
      if(c.value===null||c.value===undefined||!isFinite(Number(c.value)))return;
      if(c.date>date)return;
      if(!best||c.date>best.date||(c.date===best.date&&String(c.createdAt||'')>String(best.createdAt||'')))best={date:c.date,createdAt:c.createdAt,value:Number(c.value)};
    });
  });
  return best?best.value:null;
}
function _okrAgg(vals,mode){
  if(!vals.length)return null;
  if(mode==='avg')return Math.round((vals.reduce((a,b)=>a+b,0)/vals.length)*100)/100;
  if(mode==='max')return Math.max(...vals);
  if(mode==='min')return Math.min(...vals);
  return Math.round(vals.reduce((a,b)=>a+b,0)*100)/100; // sum (default)
}
/* Value as it stood on `date`. Roll-up nodes take it from their DIRECT children
   (one level below) combined by rollupMode; leaves from their own check-ins. Cycle-safe. */
function _okrValueAt(o,date,_seen){
  _seen=_seen||new Set();
  if(_seen.has(o.id))return null;
  _seen.add(o.id);
  // v3.19 precedence: an ANNUAL is always quarters-driven — quarters or nothing (roll-up never
  // overrides an annual). v3.20: HOW the quarters combine follows the annual mode — the value
  // modes aggregate the quarterly values as of `date`; the default maps the quarters' combined
  // progress onto the annual's own scale. Non-annual roll-ups aggregate their direct children;
  // everything else reads its own check-ins.
  if(o.isAnnual){
    const qs=okrChildren(o.id).filter(k=>k.quarterLabel);
    if(!qs.length)return null;
    const md=okrAnnualMode(o);
    if(md==='latest')return _okrLatestChildValueAt(o,date);
    if(md!=='progress'){ // sum / avg / max / min of the quarterly values as of `date`
      const vals=qs.map(k=>_okrValueAt(k,date,_seen)).filter(v=>v!==null&&v!==undefined&&isFinite(v));
      return _okrAgg(vals,md);
    }
    /* THRESHOLD annuals have no start → target scale to map a progress % onto, so they read the
       most recent quarterly figure instead: the newest number IS the current standing. */
    if(okrIsThresh(o))return _okrLatestChildValueAt(o,date);
    let any=false;
    // v3.19: no 0 floor — a quarter sitting below its start pulls the annual's value below its start too.
    const ps=qs.map(k=>{const p=_okrLeafPctAt(k,date);if(p===null)return 0;any=true;return Math.min(100,p);});
    if(!any)return null;
    const avg=ps.reduce((a,b)=>a+b,0)/qs.length;
    const s=Number(o.startValue||0),t=_okrTargetEff(o);
    if(t===null||!isFinite(t))return null;
    return Math.round((s+(t-s)*avg/100)*100)/100;
  }
  if(o.rollup){
    if((o.rollupMode||'sum')==='latest')return _okrLatestChildValueAt(o,date);
    const vals=_okrRollupKids(o).map(k=>_okrValueAt(k,date,_seen)).filter(v=>v!==null&&v!==undefined&&isFinite(v));
    return _okrAgg(vals,o.rollupMode||'sum');
  }
  let v=null;
  okrCheckinsOf(o.id).forEach(c=>{if(c.date<=date&&c.value!==null&&c.value!==undefined)v=Number(c.value);});
  return v;
}
/* Effective current value: annuals read their quarters per the annual mode (value modes
   aggregate the quarterly values; the default maps combined progress onto the annual's own
   start → target scale); other roll-up nodes aggregate; leaves use their latest check-in. */
function okrCurrentOf(o){
  if(o.isAnnual){ // v3.19: an annual is ALWAYS quarters-driven — quarters or nothing
    if(okrAnnualMode(o)!=='progress')return _okrValueAt(o,'9999-12-31'); // v3.20: sum/avg/max/min/latest of the quarters
    if(okrIsThresh(o))return _okrLatestChildValueAt(o,'9999-12-31'); // no scale to map onto
    const qp=_okrQProgressAvg(o);
    if(qp===null)return null;
    const s=Number(o.startValue||0),t=_okrTargetEff(o);
    if(t===null||!isFinite(t))return null;
    return Math.round((s+(t-s)*qp/100)*100)/100;
  }
  if(o.rollup)return _okrValueAt(o,'9999-12-31'); // non-annual roll-up: level below drives it
  const last=okrLatestCheckin(o.id);
  return(last&&last.value!==null&&last.value!==undefined)?Number(last.value):null;
}
/* Point-in-time twin of _okrPctVs — same rules, same 0–100 clamp, evaluated as of `date`. */
function _okrLeafPctAt(o,date){
  const v=_okrValueAt(o,date);if(v===null)return null;
  if(o.metricType==='yesno')return v>=1?100:0;
  const s=Number(o.startValue||0),t=_okrTargetEff(o);
  if(t===null||!isFinite(t))return null;
  if(okrIsThresh(o))return okrThreshOK(o,v)?100:0;
  if(okrIsLimit(o))return _okrClampPct((v/(t-s))*100);
  if(t===s){
    const good=okrDirDown(o)?(v<=t):(v>=t);
    if(good)return 100;
    if(okrDirDown(o))return 0;
    return t===0?0:_okrClampPct((v/t)*100);
  }
  return _okrClampPct(((v-s)/(t-s))*100);
}
// Roll-up progress as it stood on `date` (only check-ins ≤ date count). Cycle-safe.
function _okrProgressAt(o,date,_seen){
  return _okrLeafPctAt(o,date); // own inputs only (matches okrProgress)
}
function _okrIdealAt(o,date,span,pctMode,tOverride){
  const ps=o.periodStart||span[0],pe=o.periodEnd||span[1];
  const lo=pctMode?0:Number(o.startValue||0);
  const hi=pctMode?100:Number(tOverride!==undefined&&tOverride!==null?tOverride:o.targetValue);
  if(!ps||!pe||!isFinite(hi))return null;
  if(date<=ps)return lo;if(date>=pe)return hi;
  const t0=new Date(ps+'T00:00:00').getTime(),t1=new Date(pe+'T00:00:00').getTime(),tn=new Date(date+'T00:00:00').getTime();
  if(t1<=t0)return hi;
  return Math.round((lo+(hi-lo)*((tn-t0)/(t1-t0)))*100)/100;
}
/* Current & target in the objective's OWN units.
   Leaf: latest check-in (or start). Parent WITH its own start→target (e.g. 98% → 99%):
   the roll-up % mapped onto that scale — rollup 20% of 98→99 = 98.2. */
function _okrHasOwnScale(o){return o.targetValue!==null&&o.targetValue!==undefined&&o.metricType!=='yesno';}
function _okrOwnCur(o){
  const v=okrCurrentOf(o);
  return(v===null||v===undefined)?Number(o.startValue||0):v;
}
/* ── Quarter filter: an OKR belongs to every quarter its period OVERLAPS
   (a 6-month OKR falls into both quarters). Uses the node's own period,
   falling back to the span of its descendants (_okrEffPeriod). ── */
function _okrQuarterRanges(year){return{Q1:[year+'-01-01',year+'-03-31'],Q2:[year+'-04-01',year+'-06-30'],Q3:[year+'-07-01',year+'-09-30'],Q4:[year+'-10-01',year+'-12-31']};}
function _okrInQuarters(o,quarters,year){
  if(!quarters||!quarters.length)return true;
  const eff=_okrEffPeriod(o);
  const ps=eff.ps||eff.pe,pe=eff.pe||eff.ps;
  if(!ps||!pe)return false; // no dates → hidden while a quarter filter is on
  const R=_okrQuarterRanges(year);
  return quarters.some(q=>{const r=R[q];return r&&ps<=r[1]&&pe>=r[0];});
}
function _okrEffPeriod(o){
  let ps=o.periodStart||null,pe=o.periodEnd||null;
  if(!ps||!pe){okrDescendants(o.id).forEach(k=>{if(k.periodStart&&(!ps||k.periodStart<ps))ps=k.periodStart;if(k.periodEnd&&(!pe||k.periodEnd>pe))pe=k.periodEnd;});}
  return{ps,pe};
}
function _drawOKRCharts(){
  if(typeof Chart==='undefined')return;
  _destroyACharts();
  const T=_aChartTheme();
  document.querySelectorAll('canvas[data-okr-chart]').forEach(cv=>{
    const o=okrById(cv.getAttribute('data-okr-chart'));if(!o)return;
    const kids=okrChildren(o.id);
    const fail=(msg)=>{const p=cv.parentElement;if(p)p.innerHTML='<div style="height:100%;display:grid;place-items:center;color:var(--c-text-3);font-size:12px;text-align:center;padding:0 14px">'+msg+'</div>';};
    try{
      let labels,dates,actual,ideal;
      const ds=[];
      // EVERY level plots its OWN check-ins (no roll-up, no child lines): just IDEAL vs ACTUAL
      // in the objective's own units, with the axis spanning its period (or its subtree's).
      const _tnow=todayISO();
      const _eff=_okrEffPeriod(o);
      const _addBounds=(ds2)=>{const s=new Set(ds2);if(_eff.ps)s.add(_eff.ps);if(_eff.pe)s.add(_eff.pe);if(!s.has(_tnow)&&(!_eff.pe||_tnow<=_eff.pe))s.add(_tnow);let arr=[...s].sort();
        if(arr.length<2){const d0=new Date((arr[0]||_tnow)+'T00:00:00');d0.setDate(d0.getDate()+60);arr.push(d0.toISOString().slice(0,10));arr.sort();}
        return arr;};
      // Roll-up nodes plot their AGGREGATED value on every date a child reported (v3.2 fix)
      const cs=(o.rollup||o.isAnnual)
        ?(function(){const src=o.isAnnual?okrChildren(o.id).filter(k=>k.quarterLabel):_okrRollupKids(o);const set=new Set();src.forEach(k=>okrCheckinsOf(k.id).forEach(c=>{if(c.value!==null&&c.value!==undefined)set.add(c.date);}));return[...set].sort().map(d=>({date:d,value:_okrValueAt(o,d)})).filter(x=>x.value!==null);})()
        :okrCheckinsOf(o.id).filter(c=>c.value!==null&&c.value!==undefined);
      const _hasPeriod=!!(_eff.ps&&_eff.pe);
      if(!cs.length&&!_hasPeriod)return fail(kids.length?'No check-ins on this objective yet — use “Add note / update” to record its own numbers.':'No updates yet — set a period (start & end date) or add the first update to see the graph.');
      // Build the X-axis across the WHOLE configured period (e.g. 1st → 31st) so the timeline is
      // there from day one, not only on the dates that already have an input.
      const _spanDates=(ps,pe)=>{
        const d=new Date(ps+'T00:00:00'),end=new Date(pe+'T00:00:00');
        if(isNaN(d)||isNaN(end)||end<d)return null;
        const days=Math.round((end-d)/86400000);
        const step=days<=45?1:days<=180?7:days<=550?30:90; // day / week / ~month / ~quarter granularity
        const out=[];for(let cur=new Date(d);cur<=end;cur.setDate(cur.getDate()+step))out.push(cur.toISOString().slice(0,10));
        if(out[out.length-1]!==pe)out.push(pe);
        return out;
      };
      const _span=_hasPeriod?_spanDates(_eff.ps,_eff.pe):null;
      if(_span){
        const s=new Set(_span);
        cs.forEach(c=>{if(c.date>=_eff.ps&&c.date<=_eff.pe)s.add(c.date);}); // land actual points on their exact date
        if(_tnow>=_eff.ps&&_tnow<=_eff.pe)s.add(_tnow);
        dates=[...s].sort();
      } else {
        dates=_addBounds(cs.map(c=>c.date));
      }
      const byDate={};cs.forEach(c=>byDate[c.date]=Number(c.value));
      actual=dates.map(d=>(d in byDate)?byDate[d]:null);
      /* THRESHOLD modes have no ramp from a start value, so there is no planned pace to draw —
         the flat threshold line below is the whole story. */
      ideal=(o.metricType==='yesno'||okrIsThresh(o))?null:dates.map(d=>_okrIdealAt(o,d,[dates[0],dates[dates.length-1]],false));
      labels=dates.map(d=>fmtS(d));
      // Daily granularity (period ≤45 days): show EVERY day on the x-axis (7,8,9…31), not just ~8.
      const _daily=_hasPeriod&&(Math.round((new Date(_eff.pe+'T00:00:00')-new Date(_eff.ps+'T00:00:00'))/86400000)<=45);
      /* Reference lines. THRESHOLD modes get ONE flat line — the value to stay above or below.
         "Lower is better" gets a flat line at the target plus the sloped pace line below it,
         which answers on-track vs off-track while the number is still inside the allowance. */
      const _th=okrIsThresh(o);
      const _dn=okrDirDown(o)&&o.metricType!=='yesno';
      if(_th||_dn){
        const capV=_okrTargetEff(o);
        if(capV!==null&&isFinite(capV)){
          const lbl=_th?((okrDirOf(o)==='gte'?'Stay at or above ':'Stay at or below ')+_okrFmtVal(o,capV))
                       :okrIsLimit(o)?('Allowance — stay under '+_okrFmtVal(o,capV)):('Target — '+_okrFmtVal(o,capV));
          ds.push({label:lbl,data:dates.map(()=>Number(capV)),borderColor:'#EF4444',borderDash:_th?[6,4]:[2,4],pointRadius:0,fill:false,tension:0,borderWidth:2});
        }
      }
      if(ideal&&ideal.some(v=>v!==null))ds.push({label:okrHasRevision(o)?'Original pace':(_dn?'Ideal pace — stay below':'Ideal (planned pace)'),data:ideal,borderColor:'#8CA3AA',borderDash:[7,5],pointRadius:0,fill:false,tension:0,borderWidth:2});
      if(okrHasRevision(o)&&o.metricType!=='yesno'){
        const idealRev=dates.map(d=>_okrIdealAt(o,d,[dates[0],dates[dates.length-1]],false,Number(o.revisedTarget)));
        if(idealRev.some(v=>v!==null))ds.push({label:'Revised pace',data:idealRev,borderColor:'#E0A106',borderDash:[4,4],pointRadius:0,fill:false,tension:0,borderWidth:2});
      }
      /* On threshold objectives each reading is scored individually, so the dots carry the verdict:
         green where the line held, red where it broke. Everywhere else they stay brand orange. */
      const _ptCol=_th?actual.map(v=>{const k=okrThreshOK(o,v);return k===null?'#0F766E':(k?'#22C55E':'#EF4444');}):'#0F766E';
      ds.push({label:'Actual',data:actual,spanGaps:true,order:-1,borderColor:'#0F766E',backgroundColor:'rgba(15,118,110,.12)',fill:true,tension:.3,pointRadius:_th?4:3,pointBackgroundColor:_ptCol,pointBorderColor:_ptCol,borderWidth:2});
      const yOpts={beginAtZero:true,ticks:{color:T.tick,font:{size:10}},grid:{color:T.grid}};
      if(o.metricType!=='yesno'){
        const _act=actual.filter(v=>v!==null&&v!==undefined&&isFinite(v));
        const _thr=_okrTargetEff(o);
        if(_th){
          /* Threshold: the line itself must always be on screen, with a little air either side so
             a reading sitting exactly on it doesn't hug the frame. There is no start value here. */
          const _base=(_thr!==null&&isFinite(_thr))?[Number(_thr)]:[];
          const _all=_base.concat(_act.length?_act:_base);
          if(_all.length){
            const _lo=Math.min(..._all),_hi=Math.max(..._all);
            const _pad=Math.max((_hi-_lo)*0.15,(_hi===_lo?Math.max(Math.abs(_hi)*0.02,0.5):0));
            yOpts.beginAtZero=false;
            yOpts.min=_lo-_pad;
            yOpts.suggestedMax=_hi+_pad;
          }
        }else{
          // Y-axis baseline = the Start value; only drop lower if an actual input dips below it.
          const _start=Number(o.startValue||0);
          let _tgt=(o.targetValue===null||o.targetValue===undefined)?_start:Number(o.targetValue);
          if(okrHasRevision(o))_tgt=Math.abs(Number(o.revisedTarget)-_start)>Math.abs(_tgt-_start)?Number(o.revisedTarget):_tgt;
          // Include target so "reduce" goals (target below start) still show the whole line; for an
          // "increase" goal (target above start) this leaves the baseline sitting exactly on Start.
          const _lo=Math.min(_start,_tgt,...(_act.length?_act:[_start]));
          const _hi=Math.max(_start,_tgt,...(_act.length?_act:[_start]));
          yOpts.beginAtZero=false;
          yOpts.min=_lo;
          yOpts.suggestedMax=_hi+Math.max((_hi-_lo)*0.08,(_hi===_lo?1:0));
        }
      }
      if(o.metricType==='yesno')yOpts.ticks.callback=function(v){return v===1?'Yes':v===0?'No':'';};
      _aCharts.push(new Chart(cv.getContext('2d'),{type:'line',data:{labels:labels,datasets:ds},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:true,labels:{color:T.tick,font:{size:10.5},boxWidth:14,padding:8}}},scales:{x:{ticks:{color:T.tick,font:{size:9},autoSkip:false,maxRotation:_daily?90:60,minRotation:0,padding:4,callback:function(v,i){const _iso=dates[i];if(!_iso)return '';if(_daily){const _dd=new Date(_iso+'T00:00:00');return (i===0||_dd.getDate()===1)?fmtS(_iso):String(_dd.getDate());}return fmtS(_iso);}},grid:{color:T.grid,drawOnChartArea:false}},y:yOpts}}}));
    }catch(e){fail("Couldn't draw chart.");}
  });
}

/* ═════════════════ PORTED BLOCK: ACCESS CONTROL PAGE (from Safe Backup) ═════════════════ */
let _ACD=null; // per-user draft: {uid,perms(overrides),rules,approval,cities,docAccess,dirty}
let _RPD=null; // role draft: {id,name,description,perms,builtin,isNew,dirty}
function accessControlPage(){
  if(!can('accessControl','view'))return empty('shield','Restricted','You don\'t have access to Access Control.');
  _seedRoleProfiles();
  const tab=S.filters.acTab||'people';
  const tabs=`<div class="ui-tabs" style="margin-bottom:14px">
    <button class="ui-tab${tab==='people'?' on':''}" onclick="S.filters.acTab='people';rr()">People <span style="font-size:10px;font-weight:800;padding:1px 7px;border-radius:99px;background:var(--c-surface-2);color:var(--c-text-2);margin-left:5px">${DB.users.filter(u=>u.status==='Active').length}</span></button>
    <button class="ui-tab${tab==='roles'?' on':''}" onclick="S.filters.acTab='roles';rr()">Roles <span style="font-size:10px;font-weight:800;padding:1px 7px;border-radius:99px;background:var(--c-surface-2);color:var(--c-text-2);margin-left:5px">${Object.keys(DB.roleProfiles||{}).length}</span></button>
  </div>`;
  return `<div class="fade">${hdr('Access Control','Create roles → assign to people. Overrides handle the exceptions.')}${tabs}${_howBar('accesscontrol')}${tab==='roles'?_acRolesTab():_acPeopleTab()}</div>`;
}
/* ─────────────── PEOPLE TAB ─────────────── */
function _acPeopleTab(){
  const canMng=can('accessControl','manage');
  const q=(S.filters.acQ||'').toLowerCase();
  let list=DB.users.slice();
  if(q)list=list.filter(u=>fullName(u).toLowerCase().includes(q)||String(u.email||'').toLowerCase().includes(q));
  if(S.filters.acDep)list=list.filter(u=>u.department===S.filters.acDep);
  list.sort((a,b)=>fullName(a).localeCompare(fullName(b)));
  const roles=Object.values(DB.roleProfiles||{});
  const hi=S.filters.acUser;
  const rows=list.map(u=>{
    _ensureHrm(u);
    const rid=u.hrm.roleProfileId||'';
    const nOv=Object.keys(u.hrm.perms||{}).length;
    const hrTag=u.hrm.isHR?'<span style="font-size:9px;font-weight:800;padding:1px 6px;border-radius:10px;background:#FCE7F3;color:#A0182A" title="HR approver stage">HR</span>':'';
    return `<tr id="acu-${u.id}" style="${hi===u.id?'background:var(--c-brand-soft);':''}border-bottom:1px solid var(--c-border)">
      <td style="padding:11px 16px"><div style="display:flex;align-items:center;gap:11px;min-width:0">${avatar(u,'w-8 h-8','text-[11px]')}<div style="min-width:0"><div style="font-size:13px;font-weight:700;color:var(--c-text);display:flex;align-items:center;gap:6px">${esc(fullName(u))} ${hrTag}</div><div style="font-size:11px;color:var(--c-text-3)">${esc(u.department||'—')}${u.position?' · '+esc(u.position):''}</div></div></div></td>
      <td style="padding:11px 8px">${canMng
        ?`<select onchange="App._acAssignRole('${u.id}',this.value)" class="ui-select" style="width:200px;font-size:12.5px;min-height:0;height:36px;padding:4px 26px 4px 12px">${roles.map(r=>`<option value="${r.id}" ${rid===r.id?'selected':''}>${esc(r.name)}</option>`).join('')}${rid&&!DB.roleProfiles[rid]?`<option value="${esc(rid)}" selected>${esc(rid)} (missing)</option>`:''}${!rid?'<option value="" selected>— No role —</option>':''}</select>`
        :`<span style="font-size:12px;font-weight:700;color:var(--c-text-2)">${esc((DB.roleProfiles[rid]||{}).name||'— No role —')}</span>`}</td>
      <td style="padding:11px 16px;text-align:right"><button onclick="App._acCustomize('${u.id}')" class="ui-btn ui-btn-ghost ui-btn-sm">${ic('cog','w-3.5 h-3.5')}Personal</button></td>
    </tr>`;
  }).join('');
  return `<div class="ui-card" style="padding:0;overflow:hidden">
    <div style="display:flex;gap:8px;flex-wrap:wrap;padding:12px;border-bottom:1px solid var(--c-border)">
      <input oninput="S.filters.acQ=this.value;App._searchRR('ac-q')" id="ac-q" value="${esc(S.filters.acQ||'')}" placeholder="Search people…" class="ui-input" style="flex:1;min-width:160px"/>
      <select onchange="S.filters.acDep=this.value;rr()" class="ui-select" style="width:auto"><option value="">All departments</option>${DB.departments.map(d=>`<option ${S.filters.acDep===d.name?'selected':''}>${esc(d.name)}</option>`).join('')}</select>
    </div>
    <div style="overflow-x:auto"><table class="ac-people" style="width:100%;border-collapse:collapse">
      <thead><tr style="text-align:left;border-bottom:1px solid var(--c-border)">
        <th style="padding:11px 16px;font-size:10px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em">Person</th>
        <th style="padding:11px 8px;font-size:10px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em">Role (decides their tabs)</th>
        <th style="padding:11px 16px;font-size:10px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em;text-align:right">Personal settings</th></tr></thead>
      <tbody>${rows||`<tr><td colspan="3">${empty('users','No people match','')}</td></tr>`}</tbody>
    </table></div>
  </div>`;
}
App._acAssignRole=(uid2,roleId)=>{
  if(!can('accessControl','manage'))return toast('You need Access Control → Manage','err');
  const u=uById(uid2);if(!u||!roleId||!DB.roleProfiles[roleId])return;
  _ensureHrm(u);
  const old=u.hrm.roleProfileId;
  if(old===roleId)return;
  // lockout: if the OLD standing granted AC and the new role doesn't, someone else must still hold it
  const newGrants=a=>!!(DB.roleProfiles[roleId].perms?.accessControl?.actions?.[a])||!!(u.hrm.perms?.accessControl?.actions?.[a]);
  for(const act of ['view','manage']){
    if(canUser(u,'accessControl',act)&&!newGrants(act)&&!_acLockoutSafe(u.id,act)){rr();return toast('Blocked — '+fullName(u)+' is the last person with Access Control ('+act+')','err');}
  }
  u.hrm.roleProfileId=roleId;u.hrm.permsV3=1;
  // ONE role: derive the legacy base-role field from the access role so nothing is set twice.
  const baseRole=roleId==='superadmin'?'Admin':roleId==='admin'?'SubAdmin':'User';
  if(u.role!==baseRole){u.role=baseRole;sb.from('profiles').update({role:baseRole}).eq('id',u.id).then(()=>{}).catch(()=>{});}
  u.hrm.isHR=(roleId==='hr'); // ONE concept: the HR role IS the HR approver stage
  log(fullName(me()),'Role assigned',fullName(u)+' → '+(DB.roleProfiles[roleId].name||roleId));
  _acPushProfile(u);
  saveDB();_syncRoleProfiles();toast(fullName(u)+' → '+(DB.roleProfiles[roleId].name||roleId));rr();
};
/* ── Per-person Customize modal: personal switches + doc access + per-area overrides ── */
function _acDraft(u){
  if(_ACD&&_ACD.uid===u.id)return _ACD;
  _ensureHrm(u);
  _ACD={uid:u.id,
    perms:JSON.parse(JSON.stringify(u.hrm.perms||{})),
    rules:{past:true,future:true,edit:true,...(u.rules||{})},
    approval:{past:false,future:false,edited:false,...(u.approval||{})},
    isHR:u.hrm.isHR===true,
    cities:Array.isArray(u.cities)?u.cities.slice():[],
    docAccess:JSON.parse(JSON.stringify(u.docAccess||{departments:{},locations:{}})),
    dirty:false};
  return _ACD;
}
function _acTogBtn(on,label,onclick,disabled){
  return `<button ${disabled?'disabled':''} onclick="${onclick}" style="display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border-radius:20px;border:1.5px solid ${on?'#0F766E':'var(--c-border)'};background:${on?'#E4F2F0':'var(--c-surface)'};color:${on?'#0B6660':'var(--c-text-3)'};font-size:11.5px;font-weight:700;cursor:${disabled?'not-allowed':'pointer'};opacity:${disabled?'.45':'1'}">
    <span style="width:6px;height:6px;border-radius:50%;background:${on?'#D4A72C':'#C9D9DD'};flex-shrink:0"></span>${esc(label)}</button>`;
}
App._acCustomize=async(uid2)=>{
  if(_ACD&&_ACD.uid!==uid2&&_ACD.dirty&&!(await confirmP({
    title:'Discard unsaved changes?',
    body:'You have unsaved permission changes for <b>'+esc(fullName(uById(_ACD.uid))||'the previous person')+'</b>. Switching now throws them away.',
    confirmLabel:'Discard and switch',cancelLabel:'Go back',danger:false,icon:'alert'})))return;
  if(_ACD&&_ACD.uid!==uid2)_ACD=null;
  S.filters.acUser=uid2;
  App._renderACUser();
};
App._renderACUser=()=>{
  const u=uById(S.filters.acUser);if(!u)return;
  const d=_acDraft(u);
  const canMng=can('accessControl','manage'),dis=!canMng;
  const lab='font-size:10px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.06em';
  const role=_roleOf(u);
  const r=d.rules,ap=d.approval;
  const personal=`<div style="${lab};margin:2px 0 8px">Personal switches</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:14px">
      <div><div style="font-size:12px;font-weight:700;margin-bottom:6px;color:var(--c-text)">Checklist submissions</div><div style="display:flex;flex-direction:column;gap:5px;align-items:flex-start">
        ${_acTogBtn(r.past!==false,'Can submit past dates',`App._acRule('past')`,dis)}
        ${_acTogBtn(r.future!==false,'Can submit future dates',`App._acRule('future')`,dis)}
        ${_acTogBtn(r.edit!==false,'Can edit submitted data',`App._acRule('edit')`,dis)}
      </div></div>
      <div><div style="font-size:12px;font-weight:700;margin-bottom:6px;color:var(--c-text)">Needs approval when…</div><div style="display:flex;flex-direction:column;gap:5px;align-items:flex-start">
        ${_acTogBtn(ap.past===true,'Past-dated entry',`App._acAppr('past')`,dis)}
        ${_acTogBtn(ap.future===true,'Future-dated entry',`App._acAppr('future')`,dis)}
        ${_acTogBtn(ap.edited===true,'Edited entry',`App._acAppr('edited')`,dis)}
      </div></div>

      <div><div style="font-size:12px;font-weight:700;margin-bottom:6px;color:var(--c-text)">City access <span style="font-weight:500;color:var(--c-text-3)">(none = all)</span></div>
        <div style="display:flex;flex-wrap:wrap;gap:5px">${(DB.locations||[]).filter(l=>l.status==='Active').map(l=>_acTogBtn((d.cities||[]).includes(l.id),l.name,`App._acCity('${l.id}')`,dis)).join('')||'<span style="font-size:11px;color:var(--c-text-3)">No locations.</span>'}</div>
      </div>
    </div>`;
  const da=d.docAccess||{departments:{},locations:{}};
  const docRow=(kind,id,name)=>{
    const p=(da[kind]||{})[id]||{};
    return `<div style="display:flex;align-items:center;gap:7px;padding:4px 0">
      <span style="flex:1;min-width:0;font-size:12px;font-weight:600;color:var(--c-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(name)}</span>
      ${_acTogBtn(!!p.view,'View',`App._acDoc('${kind}','${id}','view')`,dis)}
      ${_acTogBtn(!!(p.upload||p.edit||p.download),'Manage',`App._acDoc('${kind}','${id}','manage')`,dis)}
    </div>`;
  };
  const docs=`<div style="${lab};margin:2px 0 4px">Document access <span style="text-transform:none;font-weight:600">(also unlocks the Departments / Locations tabs)</span></div>
    <div style="font-size:11px;font-weight:800;color:var(--c-text-3);margin:2px 0 4px">Departments</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:2px 20px;margin-bottom:10px">
      ${(DB.departments||[]).map(dp=>docRow('departments',dp.id,dp.name)).join('')||'<span style="font-size:11px;color:var(--c-text-3)">No departments.</span>'}
    </div>
    <div style="font-size:11px;font-weight:800;color:var(--c-text-3);margin:2px 0 4px">Locations</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:2px 20px;margin-bottom:14px">
      ${(DB.locations||[]).filter(l=>l.status==='Active').map(l=>docRow('locations',l.id,l.name)).join('')||'<span style="font-size:11px;color:var(--c-text-3)">No locations.</span>'}
    </div>`;
  // per-area overrides: follows role by default; Override copies the role's area for editing
  const groups={};PERM_AREAS.forEach(a=>{(groups[a.group||'System']=groups[a.group||'System']||[]).push(a);});
  const ovCards=Object.keys(groups).map(g=>{
    const rowsH=groups[g].map(a=>{
      const ov=d.perms[a.key];
      const roleArea=(role&&role.perms&&role.perms[a.key])||null;
      const roleActs=roleArea?a.actions.filter(x=>roleArea.actions&&roleArea.actions[x]).map(x=>PERM_ACTION_LABEL[x]||x).join(', ')||'nothing':'nothing';
      const body=ov
        ?`<div style="display:flex;flex-wrap:wrap;gap:5px;align-items:center">
            ${a.actions.map(act=>_acTogBtn(!!(ov.actions||{})[act],PERM_ACTION_LABEL[act]||act,`App._acT('${a.key}','${act}')`,dis)).join('')}
            ${a.scoped?`<select ${dis?'disabled':''} onchange="App._acScope('${a.key}',this.value)" class="ui-select" style="width:auto;font-size:11px;padding:3px 24px 3px 8px;min-height:0;height:25px">${SCOPE_ORDER.map(s=>`<option value="${s}" ${((ov.scope||'none')===s)?'selected':''}>${SCOPE_LABEL[s]}</option>`).join('')}</select>`:''}
            ${canMng?`<button onclick="App._acOvRm('${a.key}')" style="font-size:10.5px;font-weight:700;color:var(--c-danger-ink);background:none;border:none;cursor:pointer;padding:2px 6px">✕ Remove override</button>`:''}
          </div>`
        :`<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="font-size:11px;color:var(--c-text-3)">Follows role: <b style="color:var(--c-text-2)">${esc(roleActs)}</b>${a.scoped&&roleArea?` · sees ${SCOPE_LABEL[roleArea.scope||'none']}`:''}</span>
            ${canMng?`<button onclick="App._acOvAdd('${a.key}')" class="ui-btn ui-btn-ghost ui-btn-sm" style="min-height:24px;padding:2px 10px;font-size:11px">Override</button>`:''}
          </div>`;
      return `<div style="display:grid;grid-template-columns:minmax(140px,200px) 1fr;gap:4px 12px;padding:8px 0;border-top:1px solid var(--c-border);align-items:center;${ov?'background:linear-gradient(90deg,rgba(15,118,110,.06),transparent);':''}">
        <div><div style="font-size:12px;font-weight:700;color:var(--c-text)">${esc(a.label)}${ov?' <span style="font-size:9px;font-weight:800;color:#7A4E00;background:#FDF3D9;padding:1px 6px;border-radius:8px;vertical-align:middle">OVERRIDE</span>':''}</div></div>
        ${body}
      </div>`;
    }).join('');
    return `<div style="margin-bottom:10px"><div style="${lab};margin-bottom:2px">${esc(g)}</div>${rowsH}</div>`;
  }).join('');
  modalShell({title:'Personal settings — '+fullName(u),sub:(role?('Role: '+role.name):'No role assigned')+' · changes apply on Save',size:'max-w-3xl',key:'ac-user',
    body:`<div>${d.dirty?'<div style="font-size:11.5px;font-weight:800;color:#7A4E00;background:#FDF3D9;border-radius:9px;padding:7px 11px;margin-bottom:12px">● Unsaved changes — press Save below</div>':''}
      ${personal}${docs}
      ${(()=>{const SYS=['departments','locations','documentsOrg'];const legacy=Object.keys(d.perms).filter(k=>!SYS.includes(k));return legacy.length?`<div style="font-size:11px;color:var(--c-text-3);background:var(--c-surface-2);border-radius:9px;padding:8px 11px">This person has ${legacy.length} legacy exception(s) from migration, so some areas ignore their role. <button onclick="['${'${'}legacy.join(\"','\")}'].forEach(k=>delete _ACD.perms[k]);_acMark()" style="border:none;background:none;color:var(--c-danger-ink);font-weight:800;cursor:pointer;font-size:11px;padding:0">Clear them</button> so the role decides everything. (Document-folder access is managed above and not affected.)</div>`:'';})()}
    </div>`,
    footer:btnG('Cancel','_ACD=null;App.closeModal();rr()')+(canMng?btnP('Save changes','App._acSave()'):'')});
};
function _acGuard(){if(!can('accessControl','manage')){toast('You need Access Control → Manage','err');return false;}return true;}
function _acMark(){if(_ACD){_ACD.dirty=true;App._renderACUser();}}
function _acPushProfile(u){
  sb.from('profiles').update({rules:u.rules||{},approval_settings:u.approval||{},cities:u.cities||[],doc_access:u.docAccess||{departments:{},locations:{}},hrm:u.hrm||{}}).eq('id',u.id).then(({error})=>{if(error)_syncErr('access change')(error);}).catch(_syncErr('access change'));
}
App._acOvAdd=(area)=>{
  if(!_acGuard()||!_ACD)return;
  const u=uById(_ACD.uid);const role=_roleOf(u);
  const base=(role&&role.perms&&role.perms[area])?JSON.parse(JSON.stringify(role.perms[area])):{scope:'none',actions:{}};
  base.actions=base.actions||{};
  _ACD.perms[area]=base;_acMark();
};
App._acOvRm=(area)=>{if(!_acGuard()||!_ACD)return;delete _ACD.perms[area];_acMark();};
App._acT=(area,act)=>{
  if(!_acGuard()||!_ACD)return;
  const p=_ACD.perms[area];if(!p)return;
  p.actions=p.actions||{};
  const next=!p.actions[act];p.actions[act]=next;
  if(next&&act!=='view'&&(PERM_AREAS.find(a=>a.key===area)||{actions:[]}).actions.includes('view')&&!p.actions.view)p.actions.view=true;
  if(next&&(PERM_AREAS.find(a=>a.key===area)||{}).scoped&&(!p.scope||p.scope==='none'))p.scope='self';
  _acMark();
};
App._acScope=(area,scope)=>{if(!_acGuard()||!_ACD)return;const p=_ACD.perms[area];if(!p)return;p.scope=scope;_acMark();};
App._acRule=(key)=>{if(!_acGuard()||!_ACD)return;_ACD.rules[key]=_ACD.rules[key]===false;_acMark();};
App._acAppr=(key)=>{if(!_acGuard()||!_ACD)return;_ACD.approval[key]=_ACD.approval[key]!==true;_acMark();};
App._acHRFlag=()=>{if(!_acGuard()||!_ACD)return;_ACD.isHR=!(_ACD.isHR===true);_acMark();};
App._acCity=(cityId)=>{
  if(!_acGuard()||!_ACD)return;
  const i=_ACD.cities.indexOf(cityId);
  if(i>-1)_ACD.cities.splice(i,1);else _ACD.cities.push(cityId);
  _acMark();
};
App._acDoc=(kind,id,which)=>{
  if(!_acGuard()||!_ACD)return;
  const bucket=_ACD.docAccess[kind]=_ACD.docAccess[kind]||{};
  const p=bucket[id]=bucket[id]||{};
  if(which==='view'){const on=!p.view;p.view=on;if(!on){p.upload=false;p.edit=false;p.download=false;}}
  else{const on=!(p.upload||p.edit||p.download);p.upload=on;p.edit=on;p.download=on;if(on)p.view=true;}
  _acMark();
};
App._acSave=()=>{
  if(!_acGuard())return;
  const d=_ACD;if(!d)return;
  const u=uById(d.uid);if(!u)return;
  for(const act of ['view','manage']){
    const has=canUser(u,'accessControl',act);
    const ov=d.perms.accessControl;
    const role=_roleOf(u);
    const will=ov?!!(ov.actions&&ov.actions[act]):!!(role&&role.perms&&role.perms.accessControl&&role.perms.accessControl.actions&&role.perms.accessControl.actions[act]);
    if(has&&!will&&!_acLockoutSafe(u.id,act))return toast('Blocked — '+fullName(u)+' is the last person with Access Control ('+act+'). Grant it to someone else first.','err');
  }
  _ensureHrm(u);
  u.hrm.perms=Object.keys(d.perms).length?JSON.parse(JSON.stringify(d.perms)):null;
  u.hrm.isHR=d.isHR===true;
  u.rules={...d.rules};u.approval={...d.approval};
  u.cities=d.cities.slice();u.docAccess=JSON.parse(JSON.stringify(d.docAccess));
  _acPushProfile(u);
  log(fullName(me()),'Access updated',fullName(u));
  _ACD=null;
  saveDB();closeModal();toast('Access saved for '+fullName(u));rr();
};
/* ─────────────── ROLES TAB ─────────────── */
function _acRolesTab(){
  const canMng=can('accessControl','manage');
  const roles=Object.values(DB.roleProfiles||{}).sort((a,b)=>(b.builtin?1:0)-(a.builtin?1:0)||String(a.name).localeCompare(String(b.name)));
  const cards=roles.map(p=>{
    const n=DB.users.filter(u=>u.hrm?.roleProfileId===p.id).length;
    let on=0;Object.values(p.perms||{}).forEach(a=>Object.values(a.actions||{}).forEach(v=>{if(v)on++;}));
    return `<div class="ui-card" style="padding:16px;display:flex;flex-direction:column;gap:9px">
      <div style="min-width:0">
        <div class="fd" style="font-size:15px;font-weight:800;color:var(--c-text);display:flex;align-items:center;gap:6px;flex-wrap:wrap">${esc(p.name)}${p.builtin?'<span style="font-size:9px;font-weight:800;text-transform:uppercase;background:var(--c-info-soft);color:var(--c-info-ink);padding:2px 6px;border-radius:99px">Built-in</span>':''}</div>
        <div style="font-size:12px;color:var(--c-text-3);margin-top:3px;line-height:1.45">${esc(p.description||'')}</div>
      </div>
      <div style="display:flex;gap:12px;font-size:11.5px;color:var(--c-text-2);font-weight:600">
        <span style="display:inline-flex;align-items:center;gap:4px">${ic('users','w-3.5 h-3.5')}${n} ${n===1?'person':'people'}</span>
        <span style="display:inline-flex;align-items:center;gap:4px">${ic('check','w-3.5 h-3.5')}${on} permissions on</span>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:auto">
        ${canMng?btn('Edit',`App._rpEdit('${p.id}')`,{variant:'ghost',size:'sm',icon:'edit'}):btn('View',`App._rpEdit('${p.id}')`,{variant:'ghost',size:'sm'})}
        ${canMng?btn('Duplicate',`App._rpDup('${p.id}')`,{variant:'ghost',size:'sm',icon:'copy'}):''}
        ${canMng&&!p.builtin?btn('Delete',`App._rpDel('${p.id}')`,{variant:'danger',size:'sm',icon:'trash'}):''}
      </div>
    </div>`;
  }).join('');
  return `<div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;flex-wrap:wrap">
      <p style="font-size:12.5px;color:var(--c-text-3);max-width:560px;line-height:1.5;margin:0">A role bundles every tab / feature / action toggle. Assign roles in the <b>People</b> tab. Built-in roles can be edited or duplicated as a starting point.</p>
      ${canMng?btnP('New role','App._rpEdit(null)','plus'):''}
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px">${cards||empty('shield','No roles yet','Create one to get started.')}</div>
  </div>`;
}
App._rpEdit=(id)=>{
  const ex=id?DB.roleProfiles[id]:null;
  _RPD=ex?{...JSON.parse(JSON.stringify(ex)),isNew:false,dirty:false}
        :{id:uid('role'),name:'',description:'',builtin:false,perms:{},isNew:true,dirty:false};
  App._renderRPEdit();
};
App._renderRPEdit=()=>{
  const p=_RPD;if(!p)return;
  const canMng=can('accessControl','manage'),dis=!canMng;
  const lab='font-size:10px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.06em';
  const nUsers=p.isNew?0:DB.users.filter(u=>u.hrm?.roleProfileId===p.id).length;
  const groups={};PERM_AREAS.forEach(a=>{(groups[a.group||'System']=groups[a.group||'System']||[]).push(a);});
  const grid=Object.keys(groups).map(g=>{
    const rowsH=groups[g].map(a=>{
      const cur=p.perms[a.key]||{scope:'none',actions:{}};
      const nOn=a.actions.filter(x=>(cur.actions||{})[x]).length;
      const hay=(a.label+' '+a.desc+' '+a.actions.map(x=>PERM_ACTION_LABEL[x]||x).join(' ')).toLowerCase();
      return `<div data-rp-row="${esc(hay)}" style="display:${(p.q&&!hay.includes(String(p.q).toLowerCase()))?'none':'grid'};grid-template-columns:minmax(140px,200px) 1fr;gap:4px 12px;padding:8px 0;border-top:1px solid var(--c-border);align-items:center">
        <div><div style="font-size:12px;font-weight:700;color:var(--c-text)">${esc(a.label)} ${nOn?`<span style="font-size:9px;font-weight:800;color:#0B6660">${nOn} on</span>`:''}</div><div style="font-size:10px;color:var(--c-text-3);line-height:1.3">${esc(a.desc)}</div></div>
        <div style="display:flex;flex-wrap:wrap;gap:5px;align-items:center">
          ${a.actions.map(act=>_acTogBtn(!!(cur.actions||{})[act],PERM_ACTION_LABEL[act]||act,`App._rpT('${a.key}','${act}')`,dis)).join('')}
          ${a.scoped?`<span style="font-size:9.5px;color:var(--c-text-3)">sees:</span><select ${dis?'disabled':''} onchange="App._rpScope('${a.key}',this.value)" class="ui-select" style="width:auto;font-size:11px;padding:3px 24px 3px 8px;min-height:0;height:25px">${SCOPE_ORDER.map(s=>`<option value="${s}" ${((cur.scope||'none')===s)?'selected':''}>${SCOPE_LABEL[s]}</option>`).join('')}</select>`:''}
        </div>
      </div>`;
    }).join('');
    return `<div style="margin-bottom:8px"><div style="${lab};margin-bottom:2px">${esc(g)}</div>${rowsH}</div>`;
  }).join('');
  modalShell({title:p.isNew?'New role':('Role — '+(p.name||'Untitled')),sub:(nUsers?nUsers+' people have this role · ':'')+'toggles apply on Save',size:'max-w-3xl',key:'ac-role',
    body:`<div>
      ${p.dirty?'<div style="font-size:11.5px;font-weight:800;color:#7A4E00;background:#FDF3D9;border-radius:9px;padding:7px 11px;margin-bottom:12px">● Unsaved changes — press Save below</div>':''}
      <div style="display:grid;grid-template-columns:1fr 2fr;gap:10px;margin-bottom:14px">
        <div><label style="${lab}">Role name *</label><input ${dis?'disabled':''} type="text" value="${esc(p.name||'')}" oninput="_RPD.name=this.value;_RPD.dirty=true" placeholder="e.g. Branch Supervisor" class="ui-input rf" style="margin-top:5px"/></div>
        <div><label style="${lab}">Description</label><input ${dis?'disabled':''} type="text" value="${esc(p.description||'')}" oninput="_RPD.description=this.value;_RPD.dirty=true" placeholder="What is this role for?" class="ui-input rf" style="margin-top:5px"/></div>
      </div>
      <input value="${esc(p.q||'')}" placeholder="Find a permission… e.g. create user, payroll, tickets" class="ui-input rf" style="margin-bottom:10px" oninput="_RPD.q=this.value;const q=this.value.toLowerCase();document.querySelectorAll('[data-rp-row]').forEach(r=>{r.style.display=!q||r.getAttribute('data-rp-row').includes(q)?'grid':'none'});"/>
      ${grid}
    </div>`,
    footer:btnG('Cancel','_RPD=null;App.closeModal()')+(canMng?btnP(p.isNew?'Create role':'Save role','App._rpSave()'):'')});
};
App._rpT=(area,act)=>{
  if(!can('accessControl','manage')||!_RPD)return;
  const p=_RPD.perms[area]=_RPD.perms[area]||{scope:'none',actions:{}};
  p.actions=p.actions||{};
  const next=!p.actions[act];p.actions[act]=next;
  if(next&&act!=='view'&&(PERM_AREAS.find(a=>a.key===area)||{actions:[]}).actions.includes('view')&&!p.actions.view)p.actions.view=true;
  if(next&&(PERM_AREAS.find(a=>a.key===area)||{}).scoped&&(!p.scope||p.scope==='none'))p.scope='self';
  _RPD.dirty=true;App._renderRPEdit();
};
App._rpScope=(area,scope)=>{if(!can('accessControl','manage')||!_RPD)return;const p=_RPD.perms[area]=_RPD.perms[area]||{scope:'none',actions:{}};p.scope=scope;_RPD.dirty=true;App._renderRPEdit();};
App._rpSave=()=>{
  if(!can('accessControl','manage'))return toast('You need Access Control → Manage','err');
  const p=_RPD;if(!p)return;
  if(!(p.name||'').trim())return toast('Give the role a name','err');
  // lockout: would this edit strip Access Control from its LAST holder(s)?
  const ex=DB.roleProfiles[p.id];
  if(ex){
    for(const act of ['view','manage']){
      const had=!!(ex.perms?.accessControl?.actions?.[act]);
      const will=!!(p.perms?.accessControl?.actions?.[act]);
      if(had&&!will){
        const holders=DB.users.filter(u=>u.status==='Active'&&canUser(u,'accessControl',act));
        const survivors=holders.filter(u=>{
          const o=_userPermArea(u,'accessControl');
          if(o)return !!(o.actions&&o.actions[act]);
          return u.hrm?.roleProfileId!==p.id; // keeps it via a different role
        });
        if(holders.length&&!survivors.length)return toast('Blocked — removing Access Control ('+act+') from this role would lock everyone out. Grant it elsewhere first.','err');
      }
    }
  }
  const clean={id:p.id,name:p.name.trim(),description:p.description||'',builtin:!!(ex&&ex.builtin),_v:ex?ex._v:'3',perms:JSON.parse(JSON.stringify(p.perms||{}))};
  DB.roleProfiles[p.id]=clean;
  log(fullName(me()),p.isNew?'Role created':'Role updated',clean.name);
  _RPD=null;
  saveDB();_syncRoleProfiles();closeModal();toast('Role saved — applies to everyone assigned to it');rr();
};
App._rpDup=(id)=>{
  if(!can('accessControl','manage'))return toast('You need Access Control → Manage','err');
  const ex=DB.roleProfiles[id];if(!ex)return;
  const copy=JSON.parse(JSON.stringify(ex));
  copy.id=uid('role');copy.name=ex.name+' (copy)';copy.builtin=false;delete copy._v;
  DB.roleProfiles[copy.id]=copy;
  log(fullName(me()),'Role duplicated',ex.name);
  saveDB();_syncRoleProfiles();toast('Role duplicated — edit the copy');rr();
};
App._rpDel=async(id)=>{
  if(!can('accessControl','manage'))return toast('You need Access Control → Manage','err');
  const ex=DB.roleProfiles[id];if(!ex)return;
  if(ex.builtin)return toast('Built-in roles can\'t be deleted (duplicate them instead)','err');
  const n=DB.users.filter(u=>u.hrm?.roleProfileId===id).length;
  if(n)return toast(n+' people still have this role — assign them another role first','err');
  if(!(await confirmP({
    title:'Delete role',
    body:'The role <b>'+esc(ex.name)+'</b> and all of its permission settings will be deleted.',
    items:['nobody currently holds this role, so no one loses access'],
    confirmLabel:'Delete role',cancelLabel:'Keep it'})))return;
  delete DB.roleProfiles[id];
  log(fullName(me()),'Role deleted',ex.name);
  saveDB();_syncRoleProfiles();toast('Role deleted','warn');rr();
};
function _syncRoleProfiles(){
  if(!can('accessControl','manage')||!sb||!DB.roleProfiles)return;
  sb.from('workspace_settings').upsert({key:'role_profiles',value:DB.roleProfiles,updated_at:new Date().toISOString()},{onConflict:'key'})
    .then(({error})=>{if(error)toast('Couldn\'t sync role profiles to server','err');}).catch(()=>toast('Couldn\'t sync role profiles to server','err'));
}


/* ═══ v3.16 — keep OKR filter popovers on-screen on phones ═══
   The multi-select dropdowns anchor left:0 to their chip; a chip in the right half
   of a phone screen pushed its 232px popover past the edge, so the tap LOOKED dead.
   After every redraw, any open popover that pokes past the right edge is flipped to
   right-align against its chip (and clamped on the left as a last resort). */
App._okrClampPop=function(){
  try{
    if(S.route!=='okr')return;
    document.querySelectorAll('.okr-fpanel [style*="position:absolute"],.okr-toolbar [style*="position:absolute"]').forEach(function(p){
      var r=p.getBoundingClientRect();if(!r.width)return;
      var vw=window.innerWidth||document.documentElement.clientWidth;
      if(r.right>vw-8){
        p.style.left='auto';p.style.right='0';
        var r2=p.getBoundingClientRect();
        if(r2.left<8){var par=p.offsetParent?p.offsetParent.getBoundingClientRect():r2;p.style.right='auto';p.style.left=(8-par.left)+'px';}
      }
    });
  }catch(e){}
};
(function(){
  var _rr0=window.rr;
  if(typeof _rr0==='function'&&!window.__okrRRWrapped){
    window.__okrRRWrapped=true;
    window.rr=function(){_rr0();try{requestAnimationFrame(App._okrClampPop);}catch(e){}};
    App.rr=window.rr;
  }
})();
