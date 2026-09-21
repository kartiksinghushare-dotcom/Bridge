/* ============================================================
   Bridge — 27-leaves.js  (v159)
   HRMS Phase 1 · Leave module — engine + employee & manager screens.
   · balances from the append-only leave_ledger (Accrued · Available · Booked, never one number)
   · working-day calculator (rest days / public holidays / sandwich rule / half days)
   · rule validation per leave type (eligibility, notice tiers, backdate, attachment, overlap, advance)
   · multi-level approval flows (RM → Head of People …), data-driven from Administration → Leaves
   · leaveCovering(userId,date) — the hook 21-attendance.js reads so an approved leave day is never Absent
   Classic script: shares top-level scope with the other /js files. Loads after 24-attendance-hrms.js.
   ============================================================ */

/* ═══════════════ SETTINGS (workspace_settings · leave_settings) — every value is a parameter (spec §17) ═══════════════ */
const LV_DEFAULT={enabled:false,tz:'Asia/Dubai',
  entity:{legal_name:'BloomingBox',jurisdiction:'UAE',emirate:'Dubai',licence_no:'',mohre_id:'',wps_id:'',currency:'AED'},
  leave_year:'calendar',                 // 1 Jan – 31 Dec for every type (Q6)
  accrual_from:'2026-01-01',             // first month accruals are generated for (backfilled automatically)
  prorate_joiners:true,
  accrue_during_unpaid:false,            // UAE practice / People manual: unpaid days don't count as service for accrual
  accrue_on_probation:true,probation_use_annual:true,
  statutory_floor_check:true,statutory_min_calendar_days:30,
  carry_forward_cap_days:5,carry_max_half_entitlement:true,carried_expiry_mmdd:'03-31',
  forfeiture_run_mmdd:'12-31',no_decision_default:'carry_forward_pending_decision',pre_forfeiture_days_before:60,
  encashment_in_service:true,encashment_rate_basis:'monthly_gross_30',exit_settlement_basis:'basic_wage',
  advance_allowed:true,advance_cap:'projected',advance_cap_days:0,advance_escalation_days:10,
  sandwich:'not_consumed',               // rest days / holidays inside a leave are not consumed (holidays_first)
  unpaid_requires_annual_exhausted:false,
  sla_days:3,notify_upcoming_days:1,
  bulk_approve:true};
let _LVS=null;
function _lvSettings(){return _LVS||LV_DEFAULT;}
function _lvEnabled(){return _lvSettings().enabled===true;}
async function _lvLoadSettings(){
  try{const{data}=await sb.from('workspace_settings').select('value').eq('key','leave_settings').maybeSingle();_LVS={...LV_DEFAULT,...((data&&data.value)||{}),entity:{...LV_DEFAULT.entity,...(((data&&data.value)||{}).entity||{})}};}catch(e){_LVS={...LV_DEFAULT};}
  return _LVS;
}
function _lvSaveSettings(patch,note){
  const before={};Object.keys(patch).forEach(k=>before[k]=_lvSettings()[k]);
  _LVS={...(_LVS||LV_DEFAULT),...patch};
  try{_lvAudit('settings',Object.keys(patch).join(','),before,patch,note);}catch(e){}
  return sb.from('workspace_settings').upsert({key:'leave_settings',value:_LVS,updated_at:new Date().toISOString()},{onConflict:'key'}).then(({error})=>{if(error)_syncErr('leave settings')(error);});
}
function _lvAudit(area,field,before,after,note){
  sb.from('leave_config_audit').insert({actor:S.uid,area,field:field||null,before:before==null?null:before,after:after==null?null:after,note:note||''}).then(()=>{}).catch(()=>{});
}

/* ═══════════════ DATA ═══════════════ */
function _mLT(r){return{key:r.key,name:r.name,sort:r.sort==null?100:r.sort,active:r.active!==false,color:r.color||'#54433C',icon:r.icon||'calendar',rules:(r.rules&&typeof r.rules==='object')?r.rules:{},updatedAt:r.updated_at||null};}
function _mLR(r){return{id:r.id,userId:r.user_id,typeKey:r.type_key,from:r.date_from,to:r.date_to,half:r.half_day||null,days:Number(r.days||0),dayList:Array.isArray(r.day_list)?r.day_list:[],reason:r.reason||'',attachment:r.attachment_url||null,status:r.status||'Pending',level:Number(r.level||0),flow:Array.isArray(r.flow)?r.flow:[],approvals:Array.isArray(r.approvals)?r.approvals:[],appliedBy:r.applied_by||null,overrideReason:r.override_reason||'',decidedBy:r.decided_by||null,decidedAt:r.decided_at||null,decisionNote:r.decision_note||'',snapshot:r.balance_snapshot||null,meta:r.meta||{},createdBy:r.created_by||null,createdAt:r.created_at||null,updatedAt:r.updated_at||null};}
function _mLL(r){return{id:r.id,userId:r.user_id,typeKey:r.type_key,entry:r.entry_type,qty:Number(r.quantity||0),date:r.effective_date,period:r.period||null,requestId:r.request_id||null,sourceId:r.source_id||null,actor:r.actor||null,reason:r.reason||'',meta:r.meta||{},createdAt:r.created_at||null};}
let _lvLoaded={};
function _lvTypes(all){return (DB.leaveTypes||[]).filter(t=>all||t.active).sort((a,b)=>a.sort-b.sort||a.name.localeCompare(b.name));}
function _lvType(key){return (DB.leaveTypes||[]).find(t=>t.key===key)||null;}
async function _lvLoadTypes(force){
  if(!S.uid||(_lvLoaded.types&&!force))return;_lvLoaded.types=true;
  try{const{data,error}=await sb.from('leave_types').select('*').order('sort');if(!error){DB.leaveTypes=(data||[]).map(_mLT);rr();}}catch(e){_lvLoaded.types=false;}
}
function _lvScopeUsers(){const f=scopeFilter('leave');return (DB.users||[]).filter(u=>u.status==='Active'&&(u.id===S.uid||f(u.id))).sort((a,b)=>fullName(a).localeCompare(fullName(b)));}
function _lvReqMerge(rows){DB.leaveRequests=DB.leaveRequests||[];const by=new Map(DB.leaveRequests.map(r=>[r.id,r]));(rows||[]).forEach(r=>by.set(r.id,_mLR(r)));DB.leaveRequests=[...by.values()].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));}
function _lvLedMerge(rows){DB.leaveLedger=DB.leaveLedger||[];const by=new Map(DB.leaveLedger.map(r=>[r.id,r]));(rows||[]).forEach(r=>by.set(r.id,_mLL(r)));DB.leaveLedger=[...by.values()].sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.createdAt).localeCompare(String(b.createdAt)));}
/* Requests + ledger for everyone in my leave scope (window: last year → next year). Approver rows outside my scope
   still arrive through RLS (the flow names me), so a manager of a cross-team approval never misses it. */
async function _lvLoadAll(force){
  if(!S.uid||(_lvLoaded.all&&!force))return;_lvLoaded.all=true;
  try{
    const y=Number(todayISO().slice(0,4));const from=(y-1)+'-01-01';
    const ids=_lvScopeUsers().map(u=>u.id);if(!ids.includes(S.uid))ids.push(S.uid);
    const rq=ids.length<=200?sb.from('leave_requests').select('*').in('user_id',ids).gte('date_to',from):sb.from('leave_requests').select('*').gte('date_to',from);
    const lq=ids.length<=200?sb.from('leave_ledger').select('*').in('user_id',ids):sb.from('leave_ledger').select('*');
    const [a,b,c]=await Promise.all([rq.order('created_at',{ascending:false}),lq.order('effective_date'),sb.from('leave_requests').select('*').eq('status','Pending').gte('date_to',from)]);
    if(!a.error)_lvReqMerge(a.data);if(!c.error)_lvReqMerge(c.data);if(!b.error)_lvLedMerge(b.data);
    rr();
  }catch(e){_lvLoaded.all=false;console.warn('[leave] load',e.message);}
}
/* Company calendar: everyone can see WHO is off, WHEN and WHAT TYPE (never the reason) — via bridge_leave_calendar().
   Rows arrive without reason / attachment and are marked calOnly; a full row (own / in scope) always wins. */
async function _lvLoadCalendar(force){
  if(!S.uid||(_lvLoaded.cal&&!force))return;_lvLoaded.cal=true;
  try{const y=Number(todayISO().slice(0,4));const{data,error}=await sb.rpc('bridge_leave_calendar',{p_from:(y-1)+'-12-01',p_to:(y+1)+'-12-31'});
    if(!error){DB.leaveRequests=DB.leaveRequests||[];const have=new Set(DB.leaveRequests.filter(r=>!r.calOnly).map(r=>r.id));const rows=(data||[]).filter(r=>!have.has(r.id)).map(r=>({..._mLR(r),calOnly:true}));const by=new Map(DB.leaveRequests.map(r=>[r.id,r]));rows.forEach(r=>by.set(r.id,r));DB.leaveRequests=[...by.values()].sort((a,b)=>String(b.createdAt||b.from).localeCompare(String(a.createdAt||a.from)));rr();}
  }catch(e){_lvLoaded.cal=false;}
}
function _lvBoot(){_lvLoadTypes();if(!_LVS)_lvLoadSettings().then(()=>rr());_lvLoadAll();_lvLoadCalendar();_lvLiveStart();try{_attLoadHolidays();_attLoadRequests();}catch(e){}}
let _lvRT=null;
function _lvLiveStart(){
  if(_lvRT||!S.uid||!sb.channel)return;
  try{
    _lvRT=sb.channel('bb-lv-'+S.uid)
      .on('postgres_changes',{event:'*',schema:'public',table:'leave_requests'},p=>{try{if(p.eventType==='DELETE'){DB.leaveRequests=(DB.leaveRequests||[]).filter(r=>r.id!==(p.old&&p.old.id));}else if(p.new&&p.new.id)_lvReqMerge([p.new]);if(['home','leaves','attendance','profile'].includes(S.route))rr();}catch(e){}})
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'leave_ledger'},p=>{try{if(p.new&&p.new.id)_lvLedMerge([p.new]);if(['home','leaves','profile'].includes(S.route))rr();}catch(e){}})
      .on('postgres_changes',{event:'*',schema:'public',table:'leave_types'},p=>{try{_lvLoadTypes(true);}catch(e){}})
      .subscribe();
  }catch(e){_lvRT=null;}
}
function _lvLiveStop(){try{if(_lvRT)sb.removeChannel(_lvRT);}catch(e){}_lvRT=null;_lvLoaded={};}
function _lvNotify(userId,text,link,evt){
  if(!userId||userId===S.uid)return;
  try{if(evt&&typeof _ns!=='undefined'&&_ns&&_ns['inapp_'+evt]===false)return;}catch(e){}
  const n={id:uid('n'),userId,text,time:new Date().toISOString(),read:false,link:link||null,kind:'leave'};
  DB.notifications.unshift(n);
  sb.from('notifications').insert({id:n.id,user_id:userId,text:n.text,read:false,created_at:n.time,link:n.link,kind:n.kind}).then(()=>{}).catch(()=>{});
  try{_invalidateNotifCache();}catch(e){}
}
function _lvEmail(evt,userId,vars){try{if(typeof sendEmail==='function'&&userId&&userId!==S.uid)sendEmail(evt,userId,vars).catch(()=>{});}catch(e){}}

/* ═══════════════ ENGINE ═══════════════ */
const _lvN=n=>{n=Math.round((Number(n)||0)*100)/100;return Number.isInteger(n)?String(n):String(n).replace(/\.?0+$/,'');};
const _lvD=n=>_lvN(n)+(Math.abs(Number(n))===1?' day':' days');
function _lvAddDays(iso,n){const d=new Date(iso+'T00:00:00');d.setDate(d.getDate()+n);return _attISO(d);}
function _lvServiceMonths(u,asOf){if(!u||!u.joiningDate)return null;const d=new Date(u.joiningDate+'T00:00:00'),n=new Date((asOf||todayISO())+'T00:00:00');let m=(n.getFullYear()-d.getFullYear())*12+(n.getMonth()-d.getMonth());if(n.getDate()<d.getDate())m--;return Math.max(0,m);}
function _lvOnProbation(u,asOf){const pe=(u&&u.details||{}).probationEnd;return !!pe&&(asOf||todayISO())<pe;}
function _lvOnNotice(u){return String((u&&u.details||{}).employmentStatus||'').toLowerCase()==='notice';}
/* Year window for a type: leave year (Jan–Dec) · service year (joining anniversary) · rolling 12 months · per instance */
function _lvYear(u,t,asOf){
  asOf=asOf||todayISO();const basis=(t&&t.rules||{}).year_basis||'leave_year';const y=asOf.slice(0,4);
  if(basis==='service_year'&&u&&u.joiningDate){const md=u.joiningDate.slice(5);let from=y+'-'+md;if(from>asOf)from=(Number(y)-1)+'-'+md;const to=_lvAddDays((Number(from.slice(0,4))+1)+'-'+md,-1);return{from,to,label:'service year'};}
  if(basis==='rolling'){return{from:_lvAddDays(asOf,-364),to:asOf,label:'last 12 months'};}
  return{from:y+'-01-01',to:y+'-12-31',label:y};
}
/* Annual entitlement in working days — mirrors bridge_leave_entitlement() in Postgres */
function _lvEntitlement(u,t){
  const r=(t&&t.rules)||{};const st=_lvSettings();
  const sched=(typeof _attSchedule==='function')?_attSchedule(u,todayISO()):{offDays:['Sun']};
  const workdays=Math.max(1,Math.min(7,7-((sched.offDays||[]).length)));
  const byWeek=r.entitlement_by_week||{};
  const band=Number(byWeek[String(workdays)]!=null?byWeek[String(workdays)]:(byWeek['6']!=null?byWeek['6']:(r.entitlement_days||0)));
  const statDays=Number(r.statutory_calendar_days!=null?r.statutory_calendar_days:(st.statutory_min_calendar_days||0));
  const statutory=(st.statutory_floor_check!==false&&r.accrues&&statDays>0)?Math.round(statDays*workdays/7*1e4)/1e4:0;
  const ent=Math.max(band,statutory);
  return{entitlement:ent,band,statutory,workdays,rate:Math.round(ent/12*1e4)/1e4};
}
/* Which calendar days a request actually consumes (spec §0.2 sandwich rule) */
function _lvCountDays(u,t,from,to,half){
  const r=(t&&t.rules)||{};const unit=r.unit||'working_days';
  const countRest=unit==='calendar_days'?true:(r.count_rest_days==null?(_lvSettings().sandwich==='consumed'):!!r.count_rest_days);
  const list=[];let rest=0,hol=0;
  if(!from||!to||to<from)return{days:0,list,rest,hol};
  _attDaysBetween(from,to).forEach(d=>{const h=_attHoliday(u,d);const off=_attIsOff(u,d);if((h||off)&&!countRest){if(h)hol++;else rest++;return;}list.push(d);});
  let days=list.length;if(half&&from===to&&days===1)days=0.5;
  return{days,list,rest,hol};
}
/* Comp-off credits come from approved rest-day / holiday work in Attendance (rate × 1 day each, expiring). */
function _lvCompOffCredits(uid2,asOf){
  asOf=asOf||todayISO();const exp=Number(_attSettings().comp_off_expiry_days||0);const t=_lvType('comp_off');const tExp=t&&t.rules.expiry_days!=null?Number(t.rules.expiry_days):exp;
  return (DB.attRequests||[]).filter(x=>x.userId===uid2&&x.type==='comp_off'&&x.status==='Approved').map(x=>{const rate=Number((x.payload||{}).rate||_attSettings().comp_off_rate||1);const expires=tExp?_lvAddDays(x.date,tExp):null;return{id:x.id,date:x.date,days:rate,expires,expired:!!(expires&&expires<asOf)};});
}
/* The balance object every screen reads. Never a single number: {accrued, taken, booked, pending, available, …} */
function _lvBalance(uid2,typeKey,asOf){
  asOf=asOf||todayISO();const u=uById(uid2);const t=_lvType(typeKey);if(!u||!t)return null;
  const r=t.rules||{};const yr=_lvYear(u,t,asOf);
  const reqs=(DB.leaveRequests||[]).filter(x=>x.userId===uid2&&x.typeKey===typeKey);
  const led=(DB.leaveLedger||[]).filter(x=>x.userId===uid2&&x.typeKey===typeKey&&x.date<=asOf);
  const takenIds=new Set(led.filter(x=>x.entry==='taken').map(x=>x.requestId));
  const approvedOpen=reqs.filter(x=>x.status==='Approved'&&!takenIds.has(x.id));      // approved, not yet posted as taken
  const pendingReqs=reqs.filter(x=>x.status==='Pending');
  const booked=approvedOpen.reduce((n,x)=>n+x.days,0),pending=pendingReqs.reduce((n,x)=>n+x.days,0);
  const B={typeKey,type:t,unit:r.unit||'working_days',year:yr,booked,pending,unlimited:false,accrues:!!r.accrues,ledger:led,approvedOpen,pendingReqs};
  if(r.accrues){
    const credits=led.filter(x=>x.qty>0).reduce((n,x)=>n+x.qty,0);const debits=led.filter(x=>x.qty<0).reduce((n,x)=>n+x.qty,0);
    const posted=Math.round((credits+debits)*1e4)/1e4;
    const ent=_lvEntitlement(u,t);
    const takenYear=-led.filter(x=>x.entry==='taken'&&x.date>=yr.from).reduce((n,x)=>n+x.qty,0);
    const carried=led.filter(x=>x.entry==='carry_forward'&&x.date>=yr.from).reduce((n,x)=>n+x.qty,0);
    const monthsLeft=(()=>{const m=Number(asOf.slice(5,7));return 12-m;})();
    const projected=Math.round((posted+monthsLeft*ent.rate)*1e4)/1e4;
    Object.assign(B,{accrued:Math.round(credits*1e4)/1e4,posted,taken:takenYear,available:Math.round((posted-booked-pending)*1e4)/1e4,availableBeforePending:Math.round((posted-booked)*1e4)/1e4,entitlement:ent.entitlement,rate:ent.rate,projected,projectedAvailable:Math.round((projected-booked-pending)*1e4)/1e4,carried,hasLedger:led.length>0});
  }else if(r.source==='attendance_comp_off'){
    const cr=_lvCompOffCredits(uid2,asOf);const earned=cr.filter(c=>!c.expired).reduce((n,c)=>n+c.days,0);const expired=cr.filter(c=>c.expired).reduce((n,c)=>n+c.days,0);
    const used=-led.filter(x=>x.entry==='taken').reduce((n,x)=>n+x.qty,0)+led.filter(x=>x.entry==='adjustment'||x.entry==='correction').reduce((n,x)=>n-x.qty,0);
    const posted=Math.round((earned-used)*1e4)/1e4;
    Object.assign(B,{accrued:earned,posted,taken:used,expired,available:Math.round((posted-booked-pending)*1e4)/1e4,availableBeforePending:Math.round((posted-booked)*1e4)/1e4,entitlement:null,credits:cr});
  }else{
    const entDays=r.entitlement_days==null?null:Number(r.entitlement_days);
    const inYear=x=>x.from<=yr.to&&x.to>=yr.from;
    const usedApproved=reqs.filter(x=>x.status==='Approved'&&inYear(x)).reduce((n,x)=>n+x.days,0);
    const adj=led.filter(x=>x.date>=yr.from&&(x.entry==='adjustment'||x.entry==='opening_balance'||x.entry==='correction')).reduce((n,x)=>n+x.qty,0);
    if(entDays==null){Object.assign(B,{unlimited:true,accrued:null,posted:null,taken:usedApproved,available:null,availableBeforePending:null,entitlement:null});}
    else{const ent=entDays+adj;Object.assign(B,{accrued:ent,posted:ent-usedApproved,taken:usedApproved,available:Math.round((ent-usedApproved-pending)*100)/100,availableBeforePending:Math.round((ent-usedApproved)*100)/100,entitlement:ent,bookedInYear:usedApproved});}
    if(r.paid==='banded'&&Array.isArray(r.pay_bands)){let used=usedApproved,acc=0;B.bands=r.pay_bands.map(b=>{const size=Number(b.days);const u2=Math.max(0,Math.min(size,used));used-=u2;acc+=size;return{days:size,pay:Number(b.pay),used:u2,left:size-u2};});}
  }
  return B;
}
/* Balance for ANY type, formatted for cards */
function _lvBalCards(uid2,typeKey,opts){
  const B=_lvBalance(uid2,typeKey);if(!B)return '';opts=opts||{};
  const t=B.type;const c=t.color;const small=opts.small;
  const card=(l,v,sub,tone)=>`<div class="lv-bal" style="background:var(--c-surface);border:1px solid var(--c-border);border-radius:14px;padding:${small?'8px 10px':'12px 14px'};min-width:0"><div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--c-text-3)">${l}</div><div class="fd" style="font-size:${small?'18px':'22px'};font-weight:800;color:${tone||c};margin-top:2px;line-height:1.1">${v}</div>${sub?`<div style="font-size:10.5px;color:var(--c-text-3);margin-top:3px">${sub}</div>`:''}</div>`;
  if(B.unlimited)return `<div class="lv-bals" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">${card('Taken',_lvN(B.taken),'this '+B.year.label,'var(--c-text)')}${card('Booked',_lvN(B.booked+B.pending),B.pending?_lvN(B.pending)+' pending':'approved','var(--c-text-2)')}${card('Available','∞','no fixed limit','var(--c-text-3)')}</div>`;
  const av=B.available;const neg=av<0;
  return `<div class="lv-bals" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">${card(B.accrues?'Accrued':'Entitlement',_lvN(B.accrued),B.accrues?(B.taken?_lvN(B.taken)+' taken · ':'')+'of '+_lvN(B.entitlement)+' / yr':(B.taken?_lvN(B.taken)+' used':'per '+B.year.label),'var(--c-text)')}${card('Booked',_lvN(B.booked+B.pending),B.pending?_lvN(B.pending)+' awaiting approval':'approved, upcoming','var(--c-text-2)')}${card('Available',_lvN(av),neg?'in advance':(B.accrues&&B.projectedAvailable!=null?_lvN(B.projectedAvailable)+' by year end':'ready to use'),neg?'#A63528':c)}</div>`;
}
/* ── leaveCovering: the hook 21-attendance.js reads (classify_day → ON_LEAVE, never Absent) ── */
function leaveCovering(uid2,date){
  if(!_lvEnabled())return null;
  const r=(DB.leaveRequests||[]).find(x=>x.userId===uid2&&x.status==='Approved'&&x.from<=date&&x.to>=date&&(x.dayList.length?x.dayList.includes(date):true));
  if(!r)return null;const t=_lvType(r.typeKey);return{id:r.id,typeKey:r.typeKey,name:t?t.name:r.typeKey,half:r.half,color:t?t.color:'#54433C'};
}
function _lvPendingCovering(uid2,date){return (DB.leaveRequests||[]).find(x=>x.userId===uid2&&x.status==='Pending'&&x.from<=date&&x.to>=date)||null;}

/* ── Notice tiers: the tier whose min_days ≤ requested days wins (largest) ── */
function _lvNoticeDays(t,days){const tiers=((t&&t.rules||{}).notice_tiers||[]).filter(x=>days>=Number(x.min_days||0)).sort((a,b)=>Number(b.min_days)-Number(a.min_days));return tiers.length?Number(tiers[0].notice_days||0):0;}
/* ── Approval flow for one request (levels resolved to people; self and empty levels dropped) ── */
const LV_APPROVER_LABEL={manager:'Reporting manager',manager2:'Manager’s manager',hop:'Head of People',people_admin:'People Admin',finance:'Finance',admin:'Administrator'};
function _lvUsersWithRole(roleId){return (DB.users||[]).filter(x=>x.status==='Active'&&x.hrm&&x.hrm.roleProfileId===roleId);}
function _lvApproverIds(kind,u){
  const active=x=>x&&x.status==='Active'&&x.id!==u.id;
  if(kind==='manager'){const m=u.managerId?uById(u.managerId):null;if(active(m))return[m.id];return (DB.users||[]).filter(x=>active(x)&&canUser(x,'leave','approve')&&x.hrm&&['hr','people_admin','head_of_people','admin','superadmin'].includes(x.hrm.roleProfileId)).slice(0,3).map(x=>x.id);}
  if(kind==='manager2'){const m=u.managerId?uById(u.managerId):null;const m2=m&&m.managerId?uById(m.managerId):null;return active(m2)?[m2.id]:[];}
  if(kind==='hop'){let l=_lvUsersWithRole('head_of_people').filter(active);if(!l.length)l=_lvUsersWithRole('superadmin').filter(active);return l.map(x=>x.id);}
  if(kind==='people_admin'){let l=_lvUsersWithRole('people_admin').filter(active);if(!l.length)l=_lvUsersWithRole('hr').filter(active);if(!l.length)l=_lvUsersWithRole('head_of_people').filter(active);return l.map(x=>x.id);}
  if(kind==='finance')return _lvUsersWithRole('finance').filter(active).map(x=>x.id);
  if(kind==='admin')return _lvUsersWithRole('admin').concat(_lvUsersWithRole('superadmin')).filter(active).map(x=>x.id);
  if(String(kind).indexOf('role:')===0)return _lvUsersWithRole(kind.slice(5)).filter(active).map(x=>x.id);
  return[];
}
function _lvFlowFor(u,t,ctx){
  ctx=ctx||{};const levels=((t&&t.rules||{}).approval||[{approver:'manager'}]);const out=[];
  levels.forEach(l=>{
    if(l.min_days!=null&&Number(l.min_days)>0&&!(ctx.days>=Number(l.min_days)||(l.or_advance&&ctx.advance)))return;
    if(l.on_probation&&!ctx.probation)return;
    let ids=_lvApproverIds(l.approver,u);if(!ids.length)return;
    const prev=out[out.length-1];if(prev&&prev.ids.length===ids.length&&prev.ids.every(i=>ids.includes(i)))return;   // same people twice → one level
    out.push({approver:l.approver,label:LV_APPROVER_LABEL[l.approver]||(_roleOfId(l.approver)||l.approver),ids});
  });
  if(!out.length){const ids=(DB.users||[]).filter(x=>x.status==='Active'&&x.id!==u.id&&canUser(x,'leave','approve')&&x.hrm&&['head_of_people','superadmin','admin','hr','people_admin'].includes(x.hrm.roleProfileId)).slice(0,3).map(x=>x.id);if(ids.length)out.push({approver:'people_admin',label:'People',ids});}
  return out;
}
function _roleOfId(k){const id=String(k).replace(/^role:/,'');const r=DB.roleProfiles&&DB.roleProfiles[id];return r?r.name:null;}
/* ── Validation (data-layer rules from spec §8.2 / Appendix B) — returns {errors, warnings, days, needsOverride} ── */
function _lvValidate(u,t,from,to,half,reason,hasAttachment,opts){
  opts=opts||{};const r=t.rules||{};const E=[],W=[];const today=todayISO();const st=_lvSettings();
  if(!from||!to)return{errors:['Pick the dates'],warnings:[],days:0};
  if(to<from)return{errors:['The end date is before the start date'],warnings:[],days:0};
  const cnt=_lvCountDays(u,t,from,to,half);const days=cnt.days;
  const el=r.eligibility||{};const svc=_lvServiceMonths(u,from);
  if(el.min_service_months&&svc!=null&&svc<Number(el.min_service_months))E.push('Available after '+el.min_service_months+' months of service (you are at '+svc+')');
  if(el.after_probation&&_lvOnProbation(u,from))E.push('Not available during probation'+((u.details||{}).probationEnd?' (ends '+fmtS(u.details.probationEnd)+')':''));
  if(el.gender&&(u.details||{}).gender&&(u.details||{}).gender!==el.gender)E.push('This leave type is for '+el.gender.toLowerCase()+' colleagues');
  if(el.once_per_tenure&&(DB.leaveRequests||[]).some(x=>x.userId===u.id&&x.typeKey===t.key&&x.status==='Approved'))E.push('Can be taken only once during employment — already used');
  if(el.instances_per_year){const yr=_lvYear(u,t,from);const n=(DB.leaveRequests||[]).filter(x=>x.userId===u.id&&x.typeKey===t.key&&['Approved','Pending'].includes(x.status)&&x.from>=yr.from&&x.from<=yr.to&&x.id!==opts.ignoreId).length;if(n>=Number(el.instances_per_year))E.push('Only '+el.instances_per_year+' per '+yr.label+' — already used');}
  if(r.during_notice_period===false&&_lvOnNotice(u))E.push('Not available during the notice period');
  if(!days){E.push(cnt.rest+cnt.hol?'Every day in this range is a rest day or public holiday — nothing to book':'No days selected');}
  if(r.min_days!=null&&days&&days<Number(r.min_days))E.push('Minimum '+_lvD(r.min_days)+' per request');
  if(r.max_days!=null&&days>Number(r.max_days))E.push('Maximum '+_lvD(r.max_days)+' per request');
  if(half&&!r.half_day)E.push('Half days are not allowed for '+t.name.toLowerCase());
  if(half&&from!==to)E.push('A half day is a single date');
  if(r.past_only&&from>today)E.push(t.name+' cannot be dated in the future');
  if(r.future_only&&from<today&&!(Number(r.backdate_days)>0&&from>=_lvAddDays(today,-Number(r.backdate_days))))E.push('Cannot be backdated'+(Number(r.backdate_days)>0?' more than '+r.backdate_days+' days':''));
  if(!r.future_only&&Number(r.backdate_days)>=0&&from<_lvAddDays(today,-Number(r.backdate_days||0)))E.push('Must be raised within '+(r.backdate_days||0)+' day'+(Number(r.backdate_days)===1?'':'s')+' of the date');
  if(r.comment_required&&!String(reason||'').trim())E.push('A reason is required');
  if(r.attachment_from_days!=null&&days>=Number(r.attachment_from_days)&&!hasAttachment)E.push('Attach a document (e.g. medical certificate) for '+r.attachment_from_days+'+ days');
  const ov=(DB.leaveRequests||[]).find(x=>x.userId===u.id&&x.id!==opts.ignoreId&&['Approved','Pending'].includes(x.status)&&x.from<=to&&x.to>=from);
  if(ov)E.push('Overlaps your '+(_lvType(ov.typeKey)||{name:ov.typeKey}).name.toLowerCase()+' '+fmtS(ov.from)+(ov.to!==ov.from?' – '+fmtS(ov.to):'')+' ('+ov.status.toLowerCase()+')');
  if(Number(r.gap_days)>0){const near=(DB.leaveRequests||[]).find(x=>x.userId===u.id&&x.typeKey===t.key&&x.id!==opts.ignoreId&&['Approved','Pending'].includes(x.status)&&(Math.abs((new Date(from)-new Date(x.to))/864e5)<=Number(r.gap_days)||Math.abs((new Date(x.from)-new Date(to))/864e5)<=Number(r.gap_days)));if(near)W.push('Less than '+r.gap_days+' days from your previous '+t.name.toLowerCase());}
  // notice
  const need=_lvNoticeDays(t,days);let needsOverride=false;
  if(need>0&&from>=today){const given=Math.round((new Date(from+'T00:00:00')-new Date(today+'T00:00:00'))/864e5);if(given<need){needsOverride=true;(opts.override?W:E).push(need+' days’ notice is required for '+_lvD(days)+' — you are giving '+given+(r.rm_override?'. Your manager can override with a reason.':''));}}
  // balance
  const B=_lvBalance(u.id,t.key,from);let advance=0;
  if(B&&!B.unlimited){
    const avail=B.availableBeforePending-(opts.ignoreId?0:0);
    if(B.accrues){
      if(days>avail){advance=Math.round((days-avail)*100)/100;
        const st2=_lvSettings();const allowed=r.advance_allowed!==false&&st2.advance_allowed!==false;
        if(!allowed)E.push('Only '+_lvD(Math.max(0,avail))+' available');
        else{const cap=st2.advance_cap==='projected'?Math.max(0,B.projectedAvailable+B.pending):Number(st2.advance_cap_days||0);
          if(days>Math.max(avail,0)+cap+1e-9)E.push('Only '+_lvD(Math.max(0,avail))+' available now and '+_lvD(cap)+' more can be taken in advance');
          else W.push(_lvD(advance)+' will be taken in advance of accrual'+(advance>=Number(st2.advance_escalation_days||10)?' — Head of People must also approve':''));}}
    }else if(days>avail+1e-9)E.push('Only '+_lvD(Math.max(0,avail))+' left this '+B.year.label+(B.bands?'':''));
    if(B.bands&&days>0){let left=B.bands.reduce((n,b)=>n+b.left,0);let acc=[];let dd=days;B.bands.forEach(b=>{const u2=Math.min(b.left,dd);if(u2>0){acc.push(_lvN(u2)+'d at '+b.pay+'% pay');dd-=u2;}});if(acc.length)W.push('Pay: '+acc.join(', '));}
  }
  if(r.requires_annual_exhausted||(t.key==='unpaid'&&st.unpaid_requires_annual_exhausted)){const A=_lvBalance(u.id,'annual',from);if(A&&A.availableBeforePending>0.49)E.push('Unpaid leave can only be taken once annual leave is used up ('+_lvD(A.availableBeforePending)+' left)');}
  if(cnt.rest||cnt.hol)W.push((cnt.hol?cnt.hol+' public holiday'+(cnt.hol>1?'s':''):'')+(cnt.hol&&cnt.rest?' and ':'')+(cnt.rest?cnt.rest+' rest day'+(cnt.rest>1?'s':''):'')+' inside the range '+(cnt.rest+cnt.hol>1?'are':'is')+' not deducted');
  return{errors:E,warnings:W,days,list:cnt.list,needsOverride,advance,balance:B};
}

/* ═══════════════ APPLY (bottom sheet on phones, dialog on desktop) ═══════════════ */
let _LVA=null;   // apply-form state
App._lvApply=(forUid,typeKey,date)=>{
  if(!_lvEnabled())return toast('Leave isn’t switched on yet','warn');
  const target=forUid||S.uid;const u=uById(target);if(!u)return;
  const onBehalf=target!==S.uid;
  if(onBehalf&&!(can('leave','applyFor')&&scopeFilter('leave')(target)))return toast('You can’t apply on behalf of '+fullName(u),'err');
  if(!onBehalf&&!can('leave','apply'))return toast('Your role can’t apply for leave — ask People','err');
  const types=_lvTypes().filter(t=>{const el=t.rules.eligibility||{};if(el.gender&&(u.details||{}).gender&&(u.details||{}).gender!==el.gender)return false;if(t.rules.who_can_apply==='people_only'&&!onBehalf)return false;return true;});
  if(!types.length)return toast('No leave types are set up yet','warn');
  if(_LVA&&_LVA.uid===target&&_LVA.from<todayISO()&&!date)_LVA=null;   // never reopen with stale past dates
  if(!_LVA||_LVA.uid!==target){_LVA={uid:target,type:typeKey||S.filters.lvApplyType||'annual',from:date||todayISO(),to:date||todayISO(),half:null,reason:'',file:null,fileName:'',override:''};}
  if(typeKey)_LVA.type=typeKey;if(date){_LVA.from=date;_LVA.to=date;}
  if(!types.some(t=>t.key===_LVA.type))_LVA.type=types[0].key;
  const t=_lvType(_LVA.type);
  modalShell({title:onBehalf?'Apply for '+fullName(u):'Apply for leave',sub:onBehalf?'Logged as applied by you on their behalf':'Your manager gets it straight away',size:'max-w-md',key:'lv-apply',
    body:`<div style="display:grid;gap:12px">
      <div class="lv-typepick hscroll" style="display:flex;gap:6px;padding-bottom:2px">${types.map(x=>`<button onclick="_LVA.type='${x.key}';_LVA.half=null;App._lvApply('${target}')" class="ui-btn ${_LVA.type===x.key?'ui-btn-primary':'ui-btn-ghost'} ui-btn-sm" style="flex-shrink:0;white-space:nowrap">${esc(x.name)}</button>`).join('')}</div>
      <div id="lv-ap-bal">${_lvBalCards(target,t.key,{small:true})}</div>
      ${t.rules.law?`<div style="font-size:11px;color:var(--c-text-3);line-height:1.45">${esc(t.rules.law)}</div>`:''}
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px"><div><label class="ui-label">From</label><input id="lv-ap-from" type="date" class="ui-input rf" value="${_LVA.from}" onchange="_LVA.from=this.value;if(_LVA.to<_LVA.from)_LVA.to=_LVA.from;App._lvApplyRecalc()"/></div><div><label class="ui-label">To</label><input id="lv-ap-to" type="date" class="ui-input rf" value="${_LVA.to}" min="${_LVA.from}" onchange="_LVA.to=this.value;App._lvApplyRecalc()"/></div></div>
      <div id="lv-ap-cal"></div>
      ${t.rules.half_day?`<div class="lv-half" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><span style="font-size:12px;font-weight:700;color:var(--c-text-2);margin-right:4px">Half day</span>${[[null,'No'],['am','Morning'],['pm','Afternoon']].map(([v,l])=>`<button onclick="_LVA.half=${v?"'"+v+"'":'null'};if(_LVA.half)_LVA.to=_LVA.from;App._lvApply('${target}')" class="ui-btn ${_LVA.half===v?'ui-btn-primary':'ui-btn-ghost'} ui-btn-sm">${l}</button>`).join('')}</div>`:''}
      ${t.key==='bereavement'&&t.rules.relation_days?selF('Relationship','lv-ap-rel',Object.keys(t.rules.relation_days).map(k=>[k,k+' · '+t.rules.relation_days[k]+' days']),_LVA.relation||Object.keys(t.rules.relation_days)[0]):''}
      <div><label class="ui-label">Reason${t.rules.comment_required?' *':''}</label><textarea id="lv-ap-reason" class="ui-input rf" rows="2" placeholder="${t.key==='sick'?'e.g. flu — resting at home':'e.g. family trip'}" oninput="_LVA.reason=this.value;App._lvApplyRecalc(true)">${esc(_LVA.reason)}</textarea></div>
      <div><label class="ui-label">Attachment${t.rules.attachment_from_days!=null?' <span style="font-weight:500;text-transform:none;letter-spacing:0">(required from '+t.rules.attachment_from_days+' day'+(Number(t.rules.attachment_from_days)===1?'':'s')+')</span>':''}</label>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><label class="ui-btn ui-btn-ghost ui-btn-sm" style="cursor:pointer">${ic('paperclip','w-4 h-4')}${_LVA.fileName?'Change':'Add file / photo'}<input type="file" accept="image/*,.pdf" capture="environment" style="display:none" onchange="App._lvApplyFile(this)"/></label><span id="lv-ap-file" style="font-size:12px;color:var(--c-text-2);min-width:0;overflow:hidden;text-overflow:ellipsis">${esc(_LVA.fileName||'')}</span></div></div>
      <div id="lv-ap-check"></div>
    </div>`,
    footer:btnG('Cancel','_LVA=null;App.closeModal()')+`<button id="lv-ap-go" type="button" onclick="App._lvSubmit()" class="ui-btn ui-btn-primary ui-btn-md">${ic('send','w-[18px] h-[18px]')}Submit</button>`});
  App._lvApplyRecalc();
}
App._lvApplyFile=(inp)=>{const f=inp.files&&inp.files[0];if(!f)return;if(f.size>10*1024*1024)return toast('File is over 10 MB','err');_LVA.file=f;_LVA.fileName=f.name;const el=$('#lv-ap-file');if(el)el.textContent=f.name;App._lvApplyRecalc(true);};
/* Live preview: mini calendar of the range + "N working days will be used" + rule messages */
App._lvApplyRecalc=(quiet)=>{
  if(!_LVA)return;const u=uById(_LVA.uid);const t=_lvType(_LVA.type);if(!u||!t)return;
  const fromEl=$('#lv-ap-from'),toEl=$('#lv-ap-to');if(fromEl)fromEl.value=_LVA.from;if(toEl){toEl.value=_LVA.to;toEl.min=_LVA.from;}
  const rel=$('#lv-ap-rel');if(rel)_LVA.relation=rel.value;
  const canOverride=_LVA.uid!==S.uid&&(can('leave','approve')||can('leave','adjust'));
  const V=_lvValidate(u,t,_LVA.from,_LVA.to,_LVA.half,_LVA.reason,!!_LVA.file,{override:canOverride&&!!_LVA.override});
  if(t.key==='bereavement'&&t.rules.relation_days&&_LVA.relation){const mx=Number(t.rules.relation_days[_LVA.relation]||0);if(mx&&V.days>mx)V.errors.push(_LVA.relation+': maximum '+_lvD(mx));}
  const cal=$('#lv-ap-cal');
  if(cal&&!quiet){
    const days=_attDaysBetween(_LVA.from,_LVA.to).slice(0,62);
    cal.innerHTML=days.length?`<div class="lv-mini" style="display:flex;gap:4px;flex-wrap:wrap">${days.map(d=>{const h=_attHoliday(u,d);const off=_attIsOff(u,d);const used=V.list.includes(d);const cls=used?'background:'+t.color+';color:#fff':(h?'background:#F5EFDF;color:#7F6533':off?'background:var(--c-surface-2);color:var(--c-text-3)':'background:var(--c-surface-2);color:var(--c-text-3)');return `<span title="${h?esc(h.name):off?'Rest day':'Working day'}" style="display:inline-flex;flex-direction:column;align-items:center;justify-content:center;width:34px;height:38px;border-radius:9px;font-size:11px;font-weight:800;${cls}${used&&_LVA.half?';background:linear-gradient(to '+(_LVA.half==='am'?'right':'left')+','+t.color+' 50%,var(--c-surface-2) 50%)':''}"><span style="font-size:8.5px;font-weight:700;opacity:.8">${dayAbbr(d)}</span>${Number(d.slice(8))}</span>`;}).join('')}${_attDaysBetween(_LVA.from,_LVA.to).length>62?'<span style="font-size:11px;color:var(--c-text-3);align-self:center">…</span>':''}</div>`:'';
  }
  const box=$('#lv-ap-check');const go=$('#lv-ap-go');
  const unitLbl=(t.rules.unit==='calendar_days')?'calendar day':'working day';
  const head=`<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;padding:10px 12px;border-radius:12px;background:${V.errors.length?'#FBEFEB':'var(--c-brand-soft)'}"><span style="font-size:13px;font-weight:800;color:${V.errors.length?'#A63528':'var(--c-brand-ink)'}">${V.days?_lvN(V.days)+' '+unitLbl+(V.days===1?'':'s')+' will be used':'No days selected'}</span>${V.balance&&!V.balance.unlimited?`<span style="font-size:11.5px;color:var(--c-text-2)">→ available after: <b style="color:${(V.balance.availableBeforePending-V.days)<0?'#A63528':'var(--c-text)'}">${_lvN(V.balance.availableBeforePending-V.days)}</b></span>`:''}</div>`;
  const msgs=V.errors.map(e=>`<div style="display:flex;gap:6px;font-size:12px;color:#A63528;line-height:1.45"><span>✕</span><span>${esc(e)}</span></div>`).concat(V.warnings.map(w=>`<div style="display:flex;gap:6px;font-size:12px;color:#7C5A26;line-height:1.45"><span>!</span><span>${esc(w)}</span></div>`)).join('');
  const ovr=canOverride&&V.needsOverride?`<div style="margin-top:6px">${fld('Override reason (you are the approver) *','lv-ap-ovr',_LVA.override||'','text','e.g. agreed verbally last week')}</div>`:'';
  if(box)box.innerHTML=head+(msgs?`<div style="display:grid;gap:4px;margin-top:8px">${msgs}</div>`:'')+ovr;
  const oel=$('#lv-ap-ovr');if(oel)oel.oninput=()=>{_LVA.override=oel.value;};
  if(go){go.disabled=!!V.errors.length;go.style.opacity=V.errors.length?'.5':'1';}
  _LVA._V=V;
};
App._lvSubmit=async()=>{
  if(!_LVA)return;const u=uById(_LVA.uid);const t=_lvType(_LVA.type);if(!u||!t)return;
  const reasonEl=$('#lv-ap-reason');if(reasonEl)_LVA.reason=reasonEl.value;const oel=$('#lv-ap-ovr');if(oel)_LVA.override=oel.value;
  const canOverride=_LVA.uid!==S.uid&&(can('leave','approve')||can('leave','adjust'));
  const V=_lvValidate(u,t,_LVA.from,_LVA.to,_LVA.half,_LVA.reason,!!_LVA.file,{override:canOverride&&!!String(_LVA.override||'').trim()});
  if(V.errors.length)return toast(V.errors[0],'err');
  if(V.needsOverride&&canOverride&&!String(_LVA.override||'').trim())return toast('Give a reason for overriding the notice rule','err');
  const go=$('#lv-ap-go');if(go){go.disabled=true;go.textContent='Sending…';}
  const id=uid('lv');let attachment=null;
  if(_LVA.file){try{const path=_LVA.uid+'/'+id+'_'+_LVA.file.name.replace(/[^\w.\-]+/g,'_');const{error}=await sb.storage.from('leave-docs').upload(path,_LVA.file,{upsert:true});if(error)throw error;attachment=path;}catch(e){if(go){go.disabled=false;go.textContent='Submit';}return toast('Upload failed — '+e.message,'err');}}
  const advance=V.advance>=Number(_lvSettings().advance_escalation_days||10);
  const flow=_lvFlowFor(u,t,{days:V.days,advance,probation:_lvOnProbation(u,_LVA.from)});
  const B=V.balance;const snap=B&&!B.unlimited?{accrued:B.accrued,available:B.availableBeforePending,booked:B.booked,pending:B.pending,after:Math.round((B.availableBeforePending-V.days)*100)/100}:null;
  const meta={};if(_LVA.relation)meta.relation=_LVA.relation;if(V.advance)meta.advance_days=V.advance;
  const now=new Date().toISOString();
  const row={id,user_id:_LVA.uid,type_key:t.key,date_from:_LVA.from,date_to:_LVA.to,half_day:_LVA.half||null,days:V.days,day_list:V.list,reason:String(_LVA.reason||'').trim(),attachment_url:attachment,status:'Pending',level:0,flow,approvals:[],applied_by:_LVA.uid===S.uid?null:S.uid,override_reason:String(_LVA.override||'').trim()||null,balance_snapshot:snap,meta,created_by:S.uid,created_at:now,updated_at:now};
  _lvReqMerge([row]);closeModal();rr();
  const{error}=await sb.from('leave_requests').insert(row);
  if(error){DB.leaveRequests=DB.leaveRequests.filter(r=>r.id!==id);rr();return toast('Couldn’t send — '+error.message,'err');}
  const lbl=_lvReqLabel(_mLR(row));
  log(fullName(me()),'Leave request',(_LVA.uid===S.uid?'':fullName(u)+' · ')+lbl+(row.reason?' · '+row.reason:''));
  if(flow[0])flow[0].ids.forEach(aid=>{_lvNotify(aid,'🌴 '+fullName(u)+' asks for '+lbl+(row.reason?' — '+row.reason:''),'leave:req:'+id,'leave_request');_lvEmail('leave_request',aid,{req_user:fullName(u),request:lbl,reason:row.reason||'',days:_lvN(V.days)});});
  if(_LVA.uid!==S.uid)_lvNotify(_LVA.uid,'📝 '+fullName(me())+' applied for '+lbl+' on your behalf.','leave:req:'+id,'leave_request');
  toast(flow.length?'Request sent to '+(flow[0].label)+' ✓':'Request sent ✓');
  S.filters.lvApplyType=t.key;_LVA=null;
};
function _lvReqLabel(r){const t=_lvType(r.typeKey);return (t?t.name:r.typeKey)+' · '+_lvD(r.days)+' · '+fmtS(r.from)+(r.to!==r.from?' – '+fmtS(r.to):'')+(r.half?' ('+(r.half==='am'?'morning':'afternoon')+')':'');}
function _lvWaitingFor(r){if(r.status!=='Pending')return '';const L=r.flow[r.level];if(!L)return 'People';const names=L.ids.map(i=>fullName(uById(i))).filter(Boolean);return names.length?names.slice(0,2).join(' / ')+(names.length>2?' +'+(names.length-2):''):L.label;}

/* ═══════════════ WITHDRAW / CANCEL (requester) ═══════════════ */
App._lvWithdraw=async(id)=>{
  const r=(DB.leaveRequests||[]).find(x=>x.id===id);if(!r||r.userId!==S.uid)return;
  const cancelApproved=r.status==='Approved';
  if(cancelApproved&&r.from<=todayISO())return toast('This leave has already started — ask People to correct it','err');
  if(!(await confirmP({title:cancelApproved?'Cancel this leave?':'Withdraw this request?',body:'<b>'+esc(_lvReqLabel(r))+'</b>'+(cancelApproved?'<br><span style="font-size:12px;color:var(--c-text-3)">The days go back to your balance and your manager is told.</span>':''),confirmLabel:cancelApproved?'Cancel leave':'Withdraw',cancelLabel:'Keep it'})))return;
  const was=r.status;const st=cancelApproved?'Cancelled':'Withdrawn';r.status=st;rr();
  const{error}=await sb.from('leave_requests').update({status:st,updated_at:new Date().toISOString()}).eq('id',id);
  if(error){r.status=was;rr();return toast('Couldn’t update — '+error.message,'err');}
  log(fullName(me()),'Leave '+st.toLowerCase(),_lvReqLabel(r));
  const tell=new Set();(r.flow||[]).forEach(L=>L.ids.forEach(i=>tell.add(i)));if(me().managerId)tell.add(me().managerId);
  tell.forEach(i=>_lvNotify(i,(cancelApproved?'↩️ ':'✋ ')+fullName(me())+' '+(cancelApproved?'cancelled':'withdrew')+' '+_lvReqLabel(r),'leave:req:'+id,'leave_cancelled'));
  toast(cancelApproved?'Leave cancelled':'Request withdrawn');
};

/* ═══════════════ DECIDE (approvers) ═══════════════ */
function _lvIsApproverFor(r){if(!r||r.status!=='Pending'||r.userId===S.uid)return false;const L=r.flow[r.level];if(L&&L.ids.includes(S.uid))return true;return can('leave','approve')&&scopeFilter('leave')(r.userId);}
function _lvInboxItems(all){
  return (DB.leaveRequests||[]).filter(r=>r.status==='Pending'&&r.userId!==S.uid&&_lvIsApproverFor(r)&&(all||((r.flow[r.level]||{ids:[]}).ids.includes(S.uid))||!(r.flow[r.level]))).sort((a,b)=>String(a.from).localeCompare(String(b.from)));
}
App._lvDecide=(ids,status)=>{
  ids=(ids||[]).filter(Boolean);if(!ids.length)return;
  const needNote=status==='Rejected'||ids.length>1;
  if(!needNote)return App._lvDecideGo(ids,status,'');
  const optional=status==='Approved';
  modalShell({title:status==='Rejected'?'Reason for rejecting':'Note for all '+ids.length,sub:status==='Rejected'?'Shown to the person':'Optional — shown to everyone in this batch',size:'max-w-sm',key:'lv-note',
    body:`<div>${fld(optional?'Note (optional)':'Reason *','lv-note-v','')}</div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP(status==='Rejected'?'Reject':'Approve '+ids.length,"App._lvDecideGo("+JSON.stringify(ids).replace(/"/g,'&quot;')+",'"+status+"',document.getElementById('lv-note-v').value,"+(optional?'true':'false')+")")});
};
App._lvDecideGo=async(ids,status,note,optional)=>{
  note=String(note||'').trim();
  if(status==='Rejected'&&!note&&!optional)return toast('A reason is required','err');
  closeModal();let done=0;
  for(const id of ids){
    const r=(DB.leaveRequests||[]).find(x=>x.id===id);if(!r||r.status!=='Pending')continue;
    if(!_lvIsApproverFor(r)){toast('You can’t decide for '+fullName(uById(r.userId)),'err');continue;}
    const now=new Date().toISOString();const u=uById(r.userId);
    const approvals=r.approvals.concat([{level:r.level,by:S.uid,at:now,status,note}]);
    const last=r.level>=r.flow.length-1;
    const patch={approvals,updated_at:now};
    if(status==='Rejected'){Object.assign(patch,{status:'Rejected',decided_by:S.uid,decided_at:now,decision_note:note});}
    else if(last){
      // final approval — re-check the balance now (it may have moved since submission)
      const t=_lvType(r.typeKey);const V=_lvValidate(u,t,r.from,r.to,r.half,r.reason||'x',true,{ignoreId:r.id,override:true});
      const bal=V.errors.filter(e=>/available|left this|in advance/.test(e));
      if(bal.length&&!(await confirmP({title:'Balance check',body:esc(bal[0])+'<br><span style="font-size:12px;color:var(--c-text-3)">Approve anyway? The balance can go negative (advance).</span>',confirmLabel:'Approve anyway',cancelLabel:'Back'})))continue;
      Object.assign(patch,{status:'Approved',decided_by:S.uid,decided_at:now,decision_note:note});
    }else{patch.level=r.level+1;}
    const{error}=await sb.from('leave_requests').update(patch).eq('id',id).eq('status','Pending');
    if(error){toast('Couldn’t save — '+error.message,'err');continue;}
    Object.assign(r,{approvals,level:patch.level!=null?patch.level:r.level,status:patch.status||r.status,decidedBy:patch.decided_by||r.decidedBy,decidedAt:patch.decided_at||r.decidedAt,decisionNote:patch.decision_note!=null?patch.decision_note:r.decisionNote});
    const lbl=_lvReqLabel(r);
    if(status==='Rejected'||last){
      log(fullName(me()),'Leave '+status.toLowerCase(),fullName(u)+' · '+lbl+(note?' · '+note:''));
      _lvNotify(r.userId,(status==='Approved'?'✅ ':'❌ ')+'Your '+lbl+' was '+status.toLowerCase()+' by '+fullName(me())+(note?': '+note:'.'),'leave:req:'+id,'leave_decided');
      _lvEmail('leave_decided',r.userId,{request:lbl,status,actor:fullName(me()),note:note||''});
      if(status==='Approved'&&u.managerId&&u.managerId!==S.uid)_lvNotify(u.managerId,'📅 '+fullName(u)+'’s '+lbl+' is approved.','leave:req:'+id,'leave_decided');
    }else{
      log(fullName(me()),'Leave approved (level '+(r.level)+')',fullName(u)+' · '+lbl);
      const L=r.flow[r.level];(L?L.ids:[]).forEach(aid=>{_lvNotify(aid,'🌴 '+fullName(u)+'’s '+lbl+' needs your approval (approved by '+fullName(me())+').','leave:req:'+id,'leave_request');_lvEmail('leave_request',aid,{req_user:fullName(u),request:lbl,reason:r.reason||'',days:_lvN(r.days)});});
      _lvNotify(r.userId,'👍 '+fullName(me())+' approved your '+lbl+' — now with '+(L?L.label:'People')+'.','leave:req:'+id,'leave_decided');
    }
    done++;
  }
  S.filters.lvSel={};rr();
  if(done)toast(done+' request'+(done>1?'s':'')+' '+status.toLowerCase()+' ✓');
};
/* ── Request detail sheet (everyone who can see it) ── */
App._lvOpen=(id)=>{
  const r=(DB.leaveRequests||[]).find(x=>x.id===id);if(!r)return;
  if(r.calOnly){const u0=uById(r.userId);const t0=_lvType(r.typeKey)||{name:r.typeKey,color:'#54433C'};return modalShell({title:t0.name,sub:fullName(u0),size:'max-w-sm',key:'lv-open',body:`<div style="display:flex;align-items:center;gap:12px">${avatar(u0,'w-12 h-12','text-sm')}<div><div style="font-size:15px;font-weight:800;color:var(--c-text)">${esc(fullName(u0))}</div><div style="font-size:12.5px;color:var(--c-text-2)">${esc(u0.position||u0.department||'')}</div></div></div><div style="margin-top:14px;padding:12px 14px;border-radius:12px;background:var(--c-surface-2);border-left:4px solid ${t0.color}"><div style="font-size:13px;font-weight:800;color:var(--c-text)">${esc(t0.name)} · ${_lvD(r.days)}</div><div style="font-size:12.5px;color:var(--c-text-2);margin-top:2px">${fmtD(r.from)}${r.to!==r.from?' – '+fmtD(r.to):''}${r.half?' · '+(r.half==='am'?'morning':'afternoon')+' only':''}</div><div style="font-size:11.5px;color:var(--c-text-3);margin-top:4px">Back on ${(()=>{let d=r.to;for(let i=0;i<14;i++){d=_lvAddDays(d,1);if(_attDayKind(u0,d).type==='SCHEDULED_WORKING'&&!leaveCovering(u0.id,d))break;}return fmtD(d);})()}</div></div>`,footer:btnP('Close','App.closeModal()')});}const u=uById(r.userId);const t=_lvType(r.typeKey)||{name:r.typeKey,color:'#54433C',rules:{}};
  const mine=r.userId===S.uid;const approver=_lvIsApproverFor(r);
  const snap=r.snapshot;const B=_lvBalance(r.userId,r.typeKey);
  const chipS=(tx,bg,fg)=>`<span style="font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:20px;background:${bg};color:${fg}">${tx}</span>`;
  const steps=(r.flow||[]).map((L,i)=>{const a=r.approvals.find(x=>x.level===i);const cur=r.status==='Pending'&&i===r.level;const names=L.ids.map(x=>fullName(uById(x))).filter(Boolean).join(', ');
    return `<div style="display:flex;gap:10px;align-items:flex-start;padding:7px 0;border-top:1px solid var(--c-border)"><span style="width:20px;height:20px;border-radius:50%;flex-shrink:0;display:grid;place-items:center;font-size:10px;font-weight:800;background:${a?(a.status==='Approved'?'#E9F1E8':'#F9EBE5'):cur?'var(--c-brand-soft)':'var(--c-surface-2)'};color:${a?(a.status==='Approved'?'#346A47':'#A63528'):cur?'var(--c-brand-ink)':'var(--c-text-3)'}">${a?(a.status==='Approved'?'✓':'✕'):i+1}</span><div style="min-width:0;flex:1"><div style="font-size:12.5px;font-weight:700;color:var(--c-text)">${esc(L.label)} <span style="font-weight:500;color:var(--c-text-3)">· ${esc(names||'—')}</span></div><div style="font-size:11.5px;color:var(--c-text-3)">${a?esc(a.status)+' by '+esc(fullName(uById(a.by)))+' · '+new Date(a.at).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+(a.note?' — '+esc(a.note):''):cur?'Waiting':(r.status==='Pending'?'Next':r.status==='Rejected'?'—':'Skipped')}</div></div></div>`;}).join('');
  const impact=B&&!B.unlimited?`<div class="lv-impact" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px">${[['Accrued',snap?snap.accrued:B.accrued],['Available now',B.availableBeforePending],['After this',snap?snap.after:(B.availableBeforePending-(r.status==='Pending'?r.days:0))]].map(([l,v])=>`<div style="background:var(--c-surface-2);border-radius:10px;padding:8px 10px"><div style="font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--c-text-3)">${l}</div><div class="fd" style="font-size:17px;font-weight:800;color:${Number(v)<0?'#A63528':'var(--c-text)'}">${v==null?'—':_lvN(v)}</div></div>`).join('')}</div>`:'';
  const cover=(r.dayList||[]).length?`<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:10px">${r.dayList.slice(0,40).map(d=>`<span style="font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:8px;background:${t.color}22;color:${t.color}">${fmtS(d)}</span>`).join('')}${r.dayList.length>40?'<span style="font-size:11px;color:var(--c-text-3)">+'+(r.dayList.length-40)+'</span>':''}</div>`:'';
  const att=r.attachment?`<div style="margin-top:10px">${btn('View attachment',`App._lvAttachment('${jsq(r.attachment)}')`,{variant:'ghost',size:'sm',icon:'paperclip'})}</div>`:'';
  const footer=(r.status==='Pending'&&approver?btn('Reject',`App._lvDecide(['${r.id}'],'Rejected')`,{variant:'ghost',size:'md',icon:'x'})+btn(r.level>=r.flow.length-1?'Approve':'Approve → '+((r.flow[r.level+1]||{}).label||'next'),`App._lvDecide(['${r.id}'],'Approved')`,{variant:'primary',size:'md',icon:'check'}):'')
    +(mine&&r.status==='Pending'?btn('Withdraw',`App._lvWithdraw('${r.id}')`,{variant:'ghost',size:'md',icon:'x'}):'')
    +(mine&&r.status==='Approved'&&r.from>todayISO()?btn('Cancel leave',`App._lvWithdraw('${r.id}')`,{variant:'ghost',size:'md',icon:'x'}):'')
    +(!mine&&can('leave','adjust')&&r.status==='Approved'?btn('Correct',`App._lvCorrect('${r.id}')`,{variant:'ghost',size:'md',icon:'edit'}):'')
    +btnP('Close','App.closeModal()');
  modalShell({title:t.name,sub:fullName(u)+' · '+_lvD(r.days)+' · '+fmtD(r.from)+(r.to!==r.from?' – '+fmtD(r.to):''),size:'max-w-md',key:'lv-open',
    body:`<div><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">${chip(r.status)}${r.half?chipS(r.half==='am'?'Morning half':'Afternoon half','var(--c-surface-2)','var(--c-text-2)'):''}${r.appliedBy?chipS('Applied by '+esc(fullName(uById(r.appliedBy))),'#F5EFDF','#463830'):''}${r.overrideReason?chipS('Notice overridden','#F9F1DF','#7C5A26'):''}${(r.meta||{}).advance_days?chipS(_lvN(r.meta.advance_days)+'d in advance','#F9F1DF','#7C5A26'):''}${r.status==='Pending'?chipS('Waiting for '+esc(_lvWaitingFor(r)),'var(--c-brand-soft)','var(--c-brand-ink)'):''}</div>
      ${r.reason?`<div style="font-size:13px;color:var(--c-text-2);margin-top:10px;line-height:1.5">${esc(r.reason)}</div>`:''}${r.overrideReason?`<div style="font-size:12px;color:#7C5A26;margin-top:6px">Override: ${esc(r.overrideReason)}</div>`:''}
      ${(r.meta||{}).relation?`<div style="font-size:12px;color:var(--c-text-3);margin-top:6px">Relationship: ${esc(r.meta.relation)}</div>`:''}
      ${cover}${impact}${att}
      <div style="margin-top:12px"><div style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--c-text-3)">Approval</div>${steps||'<div style="font-size:12px;color:var(--c-text-3);padding:6px 0">No approval level — auto-approved by People</div>'}${r.decidedBy&&!r.approvals.some(a=>a.by===r.decidedBy)?`<div style="font-size:11.5px;color:var(--c-text-3);padding-top:6px">${esc(r.status)} by ${esc(fullName(uById(r.decidedBy)))}${r.decisionNote?' — '+esc(r.decisionNote):''}</div>`:''}</div>
      <div style="font-size:11px;color:var(--c-text-3);margin-top:10px">Raised ${r.createdAt?new Date(r.createdAt).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):''}${r.createdBy&&r.createdBy!==r.userId?' by '+esc(fullName(uById(r.createdBy))):''}</div></div>`,
    footer});
};
App._lvAttachment=async(path)=>{try{const{data,error}=await sb.storage.from('leave-docs').createSignedUrl(path,300);if(error)throw error;window.open(data.signedUrl,'_blank');}catch(e){toast('Couldn’t open — '+e.message,'err');}};
/* People correction of an approved leave (early return / extension): a correction entry keeps the ledger honest */
App._lvCorrect=(id)=>{
  const r=(DB.leaveRequests||[]).find(x=>x.id===id);if(!r||!can('leave','adjust'))return;const u=uById(r.userId);
  modalShell({title:'Correct approved leave',sub:fullName(u)+' · '+_lvReqLabel(r),size:'max-w-sm',key:'lv-correct',
    body:`<div style="display:grid;gap:10px"><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">${fld('Actually from','lv-c-from',r.from,'date')}${fld('Actually to','lv-c-to',r.to,'date')}</div>${fld('Reason *','lv-c-why','','text','e.g. returned early on 14 Oct')}<p style="font-size:11.5px;color:var(--c-text-3);line-height:1.5">Days are recounted for the new range. If the leave was already deducted, a correction entry is posted to the ledger — nothing is ever overwritten.</p></div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP('Save correction',`App._lvCorrectSave('${id}')`)});
};
App._lvCorrectSave=async(id)=>{
  const r=(DB.leaveRequests||[]).find(x=>x.id===id);if(!r||!can('leave','adjust'))return;const u=uById(r.userId);const t=_lvType(r.typeKey);
  const from=$('#lv-c-from')?.value,to=$('#lv-c-to')?.value,why=($('#lv-c-why')?.value||'').trim();
  if(!from||!to||to<from)return toast('Check the dates','err');if(!why)return toast('A reason is required','err');
  const cnt=_lvCountDays(u,t,from,to,r.half);const before=r.days;const now=new Date().toISOString();
  const{error}=await sb.from('leave_requests').update({date_from:from,date_to:to,days:cnt.days,day_list:cnt.list,meta:{...(r.meta||{}),corrected:{by:S.uid,at:now,why,before:{from:r.from,to:r.to,days:before}}},updated_at:now}).eq('id',id);
  if(error)return toast('Couldn’t save — '+error.message,'err');
  const taken=(DB.leaveLedger||[]).find(x=>x.requestId===id&&x.entry==='taken');
  if(taken&&cnt.days!==before){const q=Math.round((before-cnt.days)*1e4)/1e4;const row={id:uid('ll'),user_id:r.userId,type_key:r.typeKey,entry_type:'correction',quantity:q,effective_date:todayISO(),request_id:id,actor:S.uid,reason:'Correction: '+why,meta:{before,after:cnt.days}};const{error:e2}=await sb.from('leave_ledger').insert(row);if(e2)toast('Request updated, but the ledger correction failed: '+e2.message,'err');else _lvLedMerge([row]);}
  Object.assign(r,{from,to,days:cnt.days,dayList:cnt.list});
  log(fullName(me()),'Leave corrected',fullName(u)+' · '+_lvReqLabel(r)+' · '+why);
  _lvNotify(r.userId,'✏️ '+fullName(me())+' corrected your '+(t?t.name.toLowerCase():'leave')+' to '+fmtS(from)+(to!==from?' – '+fmtS(to):'')+' — '+why,'leave:req:'+id,'leave_decided');
  closeModal();toast('Corrected ✓');rr();
};

/* ═══════════════ PAGE ═══════════════ */
function leavesPage(forceTab){
  const u=me();if(!u)return '';
  _lvBoot();
  if(forceTab==='settings')return (typeof leaveSettingsPage==='function')?leaveSettingsPage():'';
  const others=_lvScopeUsers().filter(x=>x.id!==S.uid).length>0;
  const canApprove=can('leave','approve')&&others;const canMng=can('leave','manage');
  const pendingN=_lvInboxItems().length;
  const canBal=others&&(can('leave','adjust')||can('leave','export')||canMng);
  const TABS=[['my','My leave'],['team','Calendar']].concat((canApprove||pendingN)?[['requests','Requests'+(pendingN?' <span style="font-size:9px;font-weight:800;padding:1px 6px;border-radius:99px;background:var(--c-danger-soft);color:var(--c-danger-ink)">'+pendingN+'</span>':'')]]:[]).concat(canBal?[['balances','Balances'],['reports','Reports']]:[]);
  let tab=S.filters.lvTab||'my';if(!TABS.some(t=>t[0]===tab))tab='my';
  const tabs=TABS.length>1?`<div class="ui-tabs" style="margin-bottom:14px">${TABS.map(([k,l])=>`<button class="ui-tab${tab===k?' on':''}" onclick="S.filters.lvTab='${k}';rr()">${l}</button>`).join('')}</div>`:'';
  let body='';
  if(!_lvEnabled()){body=_LVS?empty('calendar','Leave isn’t switched on yet',canMng?'Set the rules under Administration → Leaves and turn it on.':'Your People team will switch it on soon.'):loadingState();}
  else if(!DB.leaveTypes||!DB.leaveTypes.length)body=loadingState('Loading leave types…');
  else if(tab==='my')body=_lvMyTab(S.uid);
  else if(tab==='team')body=_lvTeamTab();
  else if(tab==='requests')body=_lvInboxTab();
  else if(tab==='balances')body=(typeof _lvBalancesTab==='function')?_lvBalancesTab():'';
  else if(tab==='reports')body=(typeof _lvReportsTab==='function')?_lvReportsTab():'';
  const actions=(canMng?btn('Rules',"App.go('leavesettings')",{variant:'subtle',size:'sm',icon:'cog'}):'')+(_lvEnabled()&&(tab==='my'||tab==='team'||tab==='requests')?btn('Export',`App._lvExport('${tab}')`,{variant:'ghost',size:'sm',icon:'download',attrs:'title="Download as CSV"'}):'')+(_lvEnabled()&&can('leave','apply')&&tab!=='my'?btn('Apply','App._lvApply()',{variant:'primary',size:'sm',icon:'plus'}):'');
  return `<div class="fade lv-page">${hdr('Leaves','Balances, requests and who’s off',actions)}${tabs}${body}</div>`;
}
/* ── My leave: hero (available · next leave) · a card per type · detail for the selected type · requests · year ── */
function _lvNextLeave(uid2){const t=todayISO();return (DB.leaveRequests||[]).filter(r=>r.userId===uid2&&(r.status==='Approved'||r.status==='Pending')&&r.to>=t).sort((a,b)=>a.from.localeCompare(b.from))[0]||null;}
function _lvMyTab(uid2,opts){
  opts=opts||{};const u=uById(uid2);if(!u)return '';const mine=uid2===S.uid;
  const types=_lvTypes().filter(t=>{const el=t.rules.eligibility||{};if(el.gender&&(u.details||{}).gender&&(u.details||{}).gender!==el.gender)return false;return true;});
  const focus=S.filters.lvBalType&&types.some(t=>t.key===S.filters.lvBalType)?S.filters.lvBalType:'annual';
  const noJoin=!u.joiningDate;const A=_lvBalance(uid2,'annual');const nx=_lvNextLeave(uid2);const nxT=nx?_lvType(nx.typeKey):null;
  const onLeave=leaveCovering(uid2,todayISO());
  const hero=`<div class="ui-card lv-hero" style="padding:18px 20px;margin-bottom:12px;background:linear-gradient(135deg,#1A2026,#13171B);color:#F4EFE8;border:none;position:relative;overflow:hidden">
    <div style="position:absolute;right:-30px;top:-30px;width:160px;height:160px;border-radius:50%;background:radial-gradient(circle,rgba(209,182,143,.22),transparent 70%)"></div>
    <div class="lv-hero-row" style="display:flex;align-items:center;gap:18px;flex-wrap:wrap;position:relative">
      <div style="flex:1;min-width:180px"><div style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:rgba(237,230,220,.6)">${mine?'Your annual leave':esc(fullName(u))+' · annual leave'}</div>
        <div style="display:flex;align-items:baseline;gap:8px;margin-top:4px"><span class="fd" style="font-size:40px;font-weight:800;line-height:1;color:${A&&A.available<0?'#E8A79A':'#D1B68F'}">${A?(A.unlimited?'∞':_lvN(A.available)):'—'}</span><span style="font-size:13px;color:rgba(237,230,220,.75)">days available</span></div>
        <div style="font-size:12px;color:rgba(237,230,220,.6);margin-top:6px">${A&&!A.unlimited?_lvN(A.accrued)+' accrued · '+_lvN(A.booked+A.pending)+' booked · '+_lvN(A.projectedAvailable)+' by 31 Dec':''}</div></div>
      <div class="lv-hero-next" style="min-width:200px;padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08)">
        ${onLeave?`<div style="font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#D1B68F">On leave now</div><div style="font-size:14px;font-weight:700;margin-top:3px">${esc(onLeave.name)}</div><div style="font-size:12px;color:rgba(237,230,220,.7)">${(()=>{const r=(DB.leaveRequests||[]).find(x=>x.id===onLeave.id);return r?'until '+fmtD(r.to):'';})()}</div>`
        :nx?`<div style="font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:rgba(237,230,220,.6)">Next leave</div><div style="font-size:14px;font-weight:700;margin-top:3px;display:flex;align-items:center;gap:6px"><span style="width:8px;height:8px;border-radius:50%;background:${nxT?nxT.color:'#D1B68F'};flex-shrink:0"></span>${esc(nxT?nxT.name:nx.typeKey)} · ${_lvD(nx.days)}</div><div style="font-size:12px;color:rgba(237,230,220,.7)">${fmtS(nx.from)}${nx.to!==nx.from?' – '+fmtS(nx.to):''} · ${nx.status==='Pending'?'awaiting '+esc(_lvWaitingFor(nx)):'approved'}</div>`
        :`<div style="font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:rgba(237,230,220,.6)">Next leave</div><div style="font-size:14px;font-weight:700;margin-top:3px">Nothing planned</div><div style="font-size:12px;color:rgba(237,230,220,.7)">${mine?'Book some time off':'No upcoming leave'}</div>`}
      </div>
      ${mine&&can('leave','apply')?`<button onclick="App._lvApply()" class="ui-btn ui-btn-md lv-hero-btn">${ic('plus','w-[18px] h-[18px]')}Apply</button>`:(!mine&&can('leave','applyFor')?`<button onclick="App._lvApply('${uid2}')" class="ui-btn ui-btn-md lv-hero-btn">${ic('plus','w-[18px] h-[18px]')}Apply for them</button>`:'')}
    </div></div>`;
  const cards=types.map(t=>{const B=_lvBalance(uid2,t.key);if(!B)return '';const on=t.key===focus;
    const main=B.unlimited?'∞':_lvN(B.available);const neg=!B.unlimited&&B.available<0;
    return `<button onclick="S.filters.lvBalType='${t.key}';rr()" class="lv-tcard${on?' on':''}" style="text-align:left;background:var(--c-surface);border:1.5px solid ${on?t.color:'var(--c-border)'};border-radius:14px;padding:10px 12px;cursor:pointer;min-width:0"><div style="display:flex;align-items:center;gap:6px"><span style="width:22px;height:22px;border-radius:7px;background:${t.color}1A;color:${t.color};display:grid;place-items:center;flex-shrink:0">${ic(t.icon||'calendar','w-3 h-3')}</span><span style="font-size:11.5px;font-weight:800;color:var(--c-text-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.name.replace(/ leave$/i,''))}</span></div><div class="fd" style="font-size:22px;font-weight:800;color:${neg?'#A63528':t.color};margin-top:6px;line-height:1">${main}</div><div style="font-size:10.5px;color:var(--c-text-3);margin-top:3px">${B.unlimited?'no limit':(B.booked+B.pending?_lvN(B.booked+B.pending)+' booked':(B.accrues?'of '+_lvN(B.entitlement)+' / yr':'available'))}</div></button>`;}).join('');
  const T=_lvType(focus);const B=T?_lvBalance(uid2,focus):null;
  const bands=B&&B.bands?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">${B.bands.map(b=>`<span style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;background:var(--c-surface-2);color:var(--c-text-2)">${b.pay}% pay · ${_lvN(b.used)} of ${b.days} used</span>`).join('')}</div>`:'';
  const credits=B&&B.credits?`<div style="margin-top:10px">${B.credits.filter(c=>!c.expired).length?`<div style="display:flex;gap:6px;flex-wrap:wrap">${B.credits.filter(c=>!c.expired).map(c=>`<span style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;background:var(--c-surface-2);color:var(--c-text-2)">+${_lvN(c.days)}d · worked ${fmtS(c.date)}${c.expires?' · use by '+fmtS(c.expires):''}</span>`).join('')}</div>`:'<div style="font-size:12px;color:var(--c-text-3)">No comp-off yet. It is earned by working on a rest day or public holiday (clock in that day, or claim it below) and approved by your manager.</div>'}${mine&&can('attendance','clock')?`<div style="margin-top:8px">${btn('Claim comp off for a day I worked','App._lvCompOffClaim()',{variant:'ghost',size:'sm',icon:'flag'})}</div>`:''}</div>`:'';
  const detail=T?`<div class="ui-card" style="margin:12px 0"><div class="ui-card-head"><span class="ui-card-title" style="display:flex;align-items:center;gap:8px"><span style="width:24px;height:24px;border-radius:7px;background:${T.color}1A;color:${T.color};display:grid;place-items:center">${ic(T.icon||'calendar','w-3.5 h-3.5')}</span>${esc(T.name)}</span><div style="display:flex;gap:6px">${mine&&can('leave','apply')&&T.key!=='comp_off'?btn('Apply',`App._lvApply(null,'${T.key}')`,{variant:'primary',size:'sm',icon:'plus'}):(!mine&&can('leave','applyFor')?btn('Apply for them',`App._lvApply('${uid2}','${T.key}')`,{variant:'ghost',size:'sm',icon:'plus'}):'')}${B&&B.ledger&&B.ledger.length?btn('Ledger',`App._lvLedger('${uid2}','${T.key}')`,{variant:'subtle',size:'sm',icon:'list'}):''}</div></div><div class="ui-card-pad" style="padding-top:10px">${_lvBalCards(uid2,T.key)}${bands}${credits}${B&&B.accrues?`<div style="font-size:11.5px;color:var(--c-text-3);margin-top:10px;line-height:1.5">${_lvN(B.rate)} days accrue on the last day of every month (${_lvN(B.entitlement)} / year${B.entitlement>(B.type.rules.entitlement_by_week||{})['6']?' · statutory floor':''}).${B.carried?' Includes '+_lvN(B.carried)+' carried from last year — use by '+fmtS((todayISO().slice(0,4))+'-'+_lvSettings().carried_expiry_mmdd)+'.':''}${noJoin?' <b style="color:#7C5A26">Joining date missing</b> — accrual assumes full months; People should set it on the profile.':''}${!B.hasLedger?' No accruals posted yet — People runs the first accrual under Administration → Leaves.':''}</div>`:''}${T.rules.law?`<div style="font-size:11px;color:var(--c-text-3);margin-top:10px;line-height:1.45;border-top:1px dashed var(--c-border);padding-top:8px">${esc(T.rules.law)}</div>`:''}</div></div>`:'';
  return hero+`<div class="lv-tcards" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px">${cards}</div>${detail}${_lvMyRequestsCard(uid2)}${_lvYearCalendar(u)}`;
}
/* Comp-off claim: a rest-day / holiday worked without a clock-in (site work, event) → attendance comp_off request to the manager */
App._lvCompOffClaim=()=>{
  if(!can('attendance','clock'))return toast('Your role can’t raise attendance requests','err');
  const u=me();
  modalShell({title:'Claim comp off',sub:'For a rest day or public holiday you worked — your manager approves it',size:'max-w-sm',key:'lv-co',
    body:`<div style="display:grid;gap:10px">${fld('Day worked','lv-co-date',todayISO(),'date')}${fld('Hours worked','lv-co-h','8','number')}${fld('What did you work on? *','lv-co-why','','text','e.g. Eid rush at the store')}<p style="font-size:11.5px;color:var(--c-text-3);line-height:1.5">Only rest days and public holidays qualify. If you clocked in that day, a request was raised automatically — check My requests under Attendance first.</p></div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP('Send claim','App._lvCompOffClaimSave()')});
};
App._lvCompOffClaimSave=async()=>{
  const u=me();const d=$('#lv-co-date')?.value,h=Number($('#lv-co-h')?.value||0),why=($('#lv-co-why')?.value||'').trim();
  if(!d)return toast('Pick the day','err');if(d>todayISO())return toast('Only a day you have already worked','err');if(!why)return toast('Say what you worked on','err');
  const kind=_attDayKind(u,d);if(kind.type!=='PUBLIC_HOLIDAY'&&kind.type!=='REST_DAY')return toast(fmtD(d)+' is a normal working day for you — comp off is only for rest days and public holidays','err');
  if((DB.attRequests||[]).some(r=>r.userId===S.uid&&r.type==='comp_off'&&r.date===d&&r.status!=='Cancelled'))return toast('A comp-off request already exists for that day','warn');
  const row={id:uid('areq'),user_id:S.uid,type:'comp_off',date:d,date_to:null,payload:{minutes:Math.round(h*60),rate:Number(_attSettings().comp_off_rate||1),manual:true},reason:'Worked on '+kind.label.toLowerCase()+(kind.holiday?' ('+kind.holiday.name+')':'')+' — '+why,status:'Pending',created_by:S.uid,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  _attReqMerge([row]);closeModal();rr();
  const{error}=await sb.from('attendance_requests').insert(row);
  if(error){DB.attRequests=DB.attRequests.filter(r=>r.id!==row.id);rr();return toast('Couldn’t send — '+error.message,'err');}
  log(fullName(u),'Comp-off claimed',d+' · '+why);
  try{_attNotifyApprovers(u,'🗓 '+fullName(u)+' claims comp off for '+fmtS(d)+' — '+why,'att:req:'+row.id);}catch(e){}
  toast('Claim sent to your manager ✓');
};
/* CSV exports: my leave (requests + ledger) · calendar month (who is off) · inbox */
App._lvExport=(what)=>{
  const q=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';const rowsToCsv=rows=>rows.map(r=>r.map(q).join(',')).join('\n');
  let csv='',name='leave';
  if(what==='my'){const reqs=(DB.leaveRequests||[]).filter(r=>r.userId===S.uid&&!r.calOnly);const led=(DB.leaveLedger||[]).filter(x=>x.userId===S.uid);
    csv=rowsToCsv([['REQUESTS'],['Type','From','To','Half day','Days','Status','Reason','Decided by','Decided at','Raised']].concat(reqs.map(r=>[(_lvType(r.typeKey)||{name:r.typeKey}).name,r.from,r.to,r.half||'',_lvN(r.days),r.status,r.reason,r.decidedBy?fullName(uById(r.decidedBy)):'',r.decidedAt?r.decidedAt.slice(0,10):'',r.createdAt?r.createdAt.slice(0,10):''])).concat([[],['LEDGER'],['Type','Date','Entry','Days','Reason','By']]).concat(led.map(x=>[(_lvType(x.typeKey)||{name:x.typeKey}).name,x.date,x.entry,_lvN(x.qty),x.reason,x.actor?fullName(uById(x.actor)):'System'])));name='my-leave-'+todayISO();}
  else if(what==='team'){const ym=S.filters.lvYm||todayISO().slice(0,7);const [y,m]=ym.split('-').map(Number);const nDays=new Date(y,m,0).getDate();const rows=[['Person','Department','Type','From','To','Days','Half day']];
    (DB.users||[]).filter(x=>x.status==='Active').forEach(p=>(DB.leaveRequests||[]).filter(r=>r.userId===p.id&&r.status==='Approved'&&r.from<=ym+'-'+nDays&&r.to>=ym+'-01').forEach(r=>rows.push([fullName(p),p.department||'',(_lvType(r.typeKey)||{name:r.typeKey}).name,r.from,r.to,_lvN(r.days),r.half||''])));csv=rowsToCsv(rows);name='leave-calendar-'+ym;}
  else{if(!can('leave','approve')&&!can('leave','export'))return toast('You need Leaves → Export','err');const rows=[['Person','Type','From','To','Days','Status','Waiting for','Raised','Reason']];_lvInboxItems(true).forEach(r=>rows.push([fullName(uById(r.userId)),(_lvType(r.typeKey)||{name:r.typeKey}).name,r.from,r.to,_lvN(r.days),r.status,_lvWaitingFor(r),r.createdAt?r.createdAt.slice(0,10):'',r.reason]));csv=rowsToCsv(rows);name='leave-requests-'+todayISO();}
  _attDownload(csv,name+'.csv');log(fullName(me()),'Exported leave data',name);
};
function _lvMyRequestsCard(uid2){
  const list=(DB.leaveRequests||[]).filter(r=>r.userId===uid2).slice(0,15);const mine=uid2===S.uid;
  const rows=list.map(r=>{const t=_lvType(r.typeKey)||{name:r.typeKey,color:'#54433C'};
    return `<button onclick="App._lvOpen('${r.id}')" class="lv-row" style="width:100%;text-align:left;display:flex;align-items:center;gap:10px;padding:9px 0;border:none;border-top:1px solid var(--c-border);background:none;cursor:pointer"><span style="width:10px;height:10px;border-radius:50%;background:${t.color};flex-shrink:0"></span><div style="min-width:0;flex:1"><div style="font-size:13px;font-weight:700;color:var(--c-text)">${esc(t.name)} <span style="font-weight:500;color:var(--c-text-3)">· ${_lvD(r.days)} · ${fmtS(r.from)}${r.to!==r.from?' – '+fmtS(r.to):''}${r.half?' ('+(r.half==='am'?'AM':'PM')+')':''}</span></div><div style="font-size:11.5px;color:var(--c-text-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.status==='Pending'?'Waiting for '+esc(_lvWaitingFor(r)):r.decidedBy?esc(r.status)+' by '+esc(fullName(uById(r.decidedBy))):esc(r.status)}${r.reason?' · '+esc(r.reason):''}</div></div>${chip(r.status)}</button>`;}).join('');
  return `<div class="ui-card" style="margin-bottom:12px"><div class="ui-card-head"><span class="ui-card-title">${mine?'My requests':'Requests'}</span>${mine&&can('leave','apply')?btn('Apply','App._lvApply()',{variant:'ghost',size:'sm',icon:'plus'}):''}</div><div class="ui-card-pad" style="padding-top:2px">${rows||'<div style="padding:12px 0;font-size:12.5px;color:var(--c-text-3)">No requests yet. Tap <b>Apply</b> — pick the type, the dates, and you’ll see exactly how many days it uses before you send it.</div>'}</div></div>`;
}
/* Year calendar: my leave (by type colour), pending (striped), holidays, rest days */
function _lvYearCalendar(u){
  const y=Number(S.filters.lvYear||todayISO().slice(0,4));const today=todayISO();
  const months=[];for(let m=1;m<=12;m++){const ym=y+'-'+String(m).padStart(2,'0');const first=new Date(y,m-1,1);const n=new Date(y,m,0).getDate();let lead=(first.getDay()+6)%7;const cells=[];for(let i=0;i<lead;i++)cells.push('<span></span>');
    for(let d=1;d<=n;d++){const iso=ym+'-'+String(d).padStart(2,'0');const lv=leaveCovering(u.id,iso);const pend=lv?null:_lvPendingCovering(u.id,iso);const h=_attHoliday(u,iso);const off=_attIsOff(u,iso);
      let st='';let title='';
      if(lv){st='background:'+lv.color+';color:#fff';title=lv.name;if(lv.half)st='background:linear-gradient(to '+(lv.half==='am'?'right':'left')+','+lv.color+' 50%,var(--c-surface-2) 50%);color:var(--c-text)';}
      else if(pend){const t=_lvType(pend.typeKey)||{color:'#54433C'};st='background:repeating-linear-gradient(45deg,'+t.color+'55 0 3px,transparent 3px 6px);color:var(--c-text)';title='Pending: '+(_lvType(pend.typeKey)||{name:''}).name;}
      else if(h){st='background:#F5EFDF;color:#7F6533';title=h.name;}
      else if(off){st='color:var(--c-text-3)';title='Rest day';}
      cells.push(`<span title="${esc(title)}" ${lv||pend?`onclick="App._lvOpen('${(lv||pend).id}')" style="cursor:pointer;`:'style="'}${st};border-radius:6px;font-size:10px;font-weight:${iso===today?'800':'600'};height:22px;display:grid;place-items:center;${iso===today?'outline:1.5px solid var(--c-brand);outline-offset:-1px':''}">${d}</span>`);}
    months.push(`<div class="lv-month" style="min-width:0"><div style="font-size:11.5px;font-weight:800;color:var(--c-text-2);margin-bottom:4px">${new Date(y,m-1,1).toLocaleDateString('en-GB',{month:'short'})}</div><div class="lv-month-grid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">${cells.join('')}</div></div>`);}
  const legend=`<div style="display:flex;gap:10px;flex-wrap:wrap;font-size:11px;color:var(--c-text-3);margin-top:10px">${_lvTypes().filter(t=>(DB.leaveRequests||[]).some(r=>r.userId===u.id&&r.typeKey===t.key&&r.status!=='Rejected'&&r.from.slice(0,4)===String(y))).map(t=>`<span style="display:inline-flex;align-items:center;gap:5px"><span style="width:9px;height:9px;border-radius:3px;background:${t.color}"></span>${esc(t.name)}</span>`).join('')}<span style="display:inline-flex;align-items:center;gap:5px"><span style="width:9px;height:9px;border-radius:3px;background:repeating-linear-gradient(45deg,#54433C55 0 2px,transparent 2px 4px)"></span>Pending</span><span style="display:inline-flex;align-items:center;gap:5px"><span style="width:9px;height:9px;border-radius:3px;background:#F5EFDF;border:1px solid #E5D9B8"></span>Holiday</span></div>`;
  return `<div class="ui-card"><div class="ui-card-head"><span class="ui-card-title">${y} at a glance</span><div style="display:flex;gap:4px;align-items:center"><button onclick="S.filters.lvYear='${y-1}';rr()" class="ui-btn ui-btn-subtle ui-btn-sm">${ic('back','w-3.5 h-3.5')}</button><span style="font-size:12.5px;font-weight:700;min-width:40px;text-align:center">${y}</span><button onclick="S.filters.lvYear='${y+1}';rr()" class="ui-btn ui-btn-subtle ui-btn-sm">${ic('chevR','w-3.5 h-3.5')}</button></div></div><div class="ui-card-pad" style="padding-top:8px"><div class="lv-year" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px 16px">${months.join('')}</div>${legend}</div></div>`;
}
/* Ledger sheet — every posting for one person × type */
App._lvLedger=(uid2,typeKey)=>{
  const u=uById(uid2);const t=_lvType(typeKey);if(!u||!t)return;
  const rows=(DB.leaveLedger||[]).filter(x=>x.userId===uid2&&x.typeKey===typeKey).slice().reverse();
  let run=rows.reduce((n,x)=>n+x.qty,0);
  const html=rows.map(x=>{const bal=run;run=Math.round((run-x.qty)*1e4)/1e4;const by=x.actor?fullName(uById(x.actor)):'System';return `<div style="display:flex;gap:10px;align-items:center;padding:8px 0;border-top:1px solid var(--c-border)"><div style="min-width:0;flex:1"><div style="font-size:12.5px;font-weight:700;color:var(--c-text)">${esc(x.reason||x.entry.replace('_',' '))}</div><div style="font-size:11px;color:var(--c-text-3)">${fmtS(x.date)} · ${esc(x.entry.replace('_',' '))} · ${esc(by)}</div></div><div style="text-align:right"><div class="fd" style="font-size:14px;font-weight:800;color:${x.qty<0?'#A63528':'#346A47'}">${x.qty>0?'+':''}${_lvN(x.qty)}</div><div style="font-size:10.5px;color:var(--c-text-3)">= ${_lvN(bal)}</div></div></div>`;}).join('');
  modalShell({title:t.name+' ledger',sub:fullName(u)+' · append-only, 4 decimals · newest first',size:'max-w-md',key:'lv-ledger',body:`<div>${html||'<div style="padding:16px;text-align:center;font-size:12.5px;color:var(--c-text-3)">No postings yet.</div>'}</div>`,footer:(can('leave','adjust')&&uid2!==S.uid?btn('Adjust',`App._lvAdjust('${uid2}','${typeKey}')`,{variant:'ghost',size:'md',icon:'edit'}):'')+btnP('Close','App.closeModal()')});
};

/* ── Calendar: everyone sees who is off, for how long and on what leave (month grid on desktop, day list on phones) ── */
function _lvTeamTab(){
  const scope=_lvScopeUsers();const scopeIds=new Set(scope.map(p=>p.id));
  const all=(DB.users||[]).filter(x=>x.status==='Active').sort((a,b)=>fullName(a).localeCompare(fullName(b)));
  const ym=S.filters.lvYm||todayISO().slice(0,7);const [y,m]=ym.split('-').map(Number);const nDays=new Date(y,m,0).getDate();const mEnd=ym+'-'+String(nDays).padStart(2,'0');
  const q=(S.filters.lvQ||'').toLowerCase();const onlyOff=!!S.filters.lvOnlyOff;const dep=S.filters.lvDep||'';
  const hasLeave=p=>(DB.leaveRequests||[]).some(r=>r.userId===p.id&&(r.status==='Approved'||(r.status==='Pending'&&scopeIds.has(p.id)))&&r.from<=mEnd&&r.to>=ym+'-01');
  const list=all.filter(p=>(!q||fullName(p).toLowerCase().includes(q)||String(p.department||'').toLowerCase().includes(q))&&(!dep||p.department===dep)&&(!onlyOff||hasLeave(p)));
  if(S.filters.lvPerson){const p=uById(S.filters.lvPerson);if(p&&scopeIds.has(p.id))return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><button onclick="S.filters.lvPerson=null;rr()" class="ui-btn ui-btn-subtle ui-btn-sm">${ic('back','w-3.5 h-3.5')}Calendar</button>${avatar(p,'w-8 h-8','text-[11px]')}<b style="font-size:14px">${esc(fullName(p))}</b>${can('employees','viewProfile')?`<button onclick="App.openProfile('${p.id}')" style="font-size:12px;font-weight:700;color:var(--c-brand);background:none;border:none;cursor:pointer">Profile →</button>`:''}</div>`+_lvMyTab(p.id);S.filters.lvPerson=null;}
  const today=todayISO();
  const prev=()=>_attISO(new Date(y,m-2,1)).slice(0,7),next=()=>_attISO(new Date(y,m,1)).slice(0,7);
  const nav=`<div class="lv-calnav" style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:10px"><div style="display:flex;gap:4px;align-items:center"><button onclick="S.filters.lvYm='${prev()}';rr()" class="ui-btn ui-btn-subtle ui-btn-sm" aria-label="Previous month">${ic('back','w-3.5 h-3.5')}</button><span style="font-size:14px;font-weight:800;min-width:130px;text-align:center">${_attMonthLabel(ym)}</span><button onclick="S.filters.lvYm='${next()}';rr()" class="ui-btn ui-btn-subtle ui-btn-sm" aria-label="Next month">${ic('chevR','w-3.5 h-3.5')}</button>${ym!==today.slice(0,7)?`<button onclick="S.filters.lvYm=null;rr()" class="ui-btn ui-btn-subtle ui-btn-sm">Today</button>`:''}</div><div class="lv-calfilters" style="display:flex;gap:6px;flex-wrap:wrap"><input id="lv-q" class="ui-input" placeholder="Search people…" value="${esc(S.filters.lvQ||'')}" oninput="S.filters.lvQ=this.value;App._searchRR('lv-q')" style="width:160px;padding:6px 10px"/><select class="ui-select" style="width:auto;padding:6px 26px 6px 10px" onchange="S.filters.lvDep=this.value;rr()"><option value="">All departments</option>${topDepts().map(d=>`<option ${dep===d.name?'selected':''}>${esc(d.name)}</option>`).join('')}</select><button onclick="S.filters.lvOnlyOff=${onlyOff?'false':'true'};rr()" class="ui-btn ${onlyOff?'ui-btn-primary':'ui-btn-ghost'} ui-btn-sm">Only people off</button>${can('leave','applyFor')&&scope.length>1?btn('Apply for someone','App._lvApplyForPick()',{variant:'ghost',size:'sm',icon:'plus'}):''}</div></div>`;
  const offToday=all.filter(p=>leaveCovering(p.id,today));
  const kpis=`<div class="bb-kpis lv-calkpis" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:12px">${[['Off today',offToday.length,'#54433C'],['Off this month',all.filter(p=>(DB.leaveRequests||[]).some(r=>r.userId===p.id&&r.status==='Approved'&&r.from<=mEnd&&r.to>=ym+'-01')).length,'#936659'],['Pending in my scope',(DB.leaveRequests||[]).filter(r=>r.status==='Pending'&&scopeIds.has(r.userId)).length,'#A97C33'],['People',all.length,'#13171B']].map(([l,v,c])=>`<div style="background:var(--c-surface);border:1px solid var(--c-border);border-radius:14px;padding:10px 12px"><div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--c-text-3)">${l}</div><div class="fd" style="font-size:20px;font-weight:800;color:${c};margin-top:3px">${v}</div></div>`).join('')}</div>`;
  // desktop grid: person × day
  const dayHead=Array.from({length:nDays},(_,i)=>{const iso=ym+'-'+String(i+1).padStart(2,'0');const wk=[6,0].includes(new Date(iso+'T00:00:00').getDay());const hol=(DB.holidays||[]).find(h=>h.date===iso&&!h.locationId);return `<div title="${hol?esc(hol.name):''}" style="font-size:9px;font-weight:${iso===today?'800':'600'};color:${iso===today?'var(--c-brand)':hol?'#7F6533':wk?'var(--c-text-3)':'var(--c-text-2)'};text-align:center">${i+1}</div>`;}).join('');
  const rows=list.map(p=>{
    const inScope=scopeIds.has(p.id);
    const cells=Array.from({length:nDays},(_,i)=>{const iso=ym+'-'+String(i+1).padStart(2,'0');const lv=leaveCovering(p.id,iso);const pend=lv||!inScope?null:_lvPendingCovering(p.id,iso);const h=_attHoliday(p,iso);const off=_attIsOff(p,iso);
      const bg=lv?lv.color:pend?'repeating-linear-gradient(45deg,'+((_lvType(pend.typeKey)||{color:'#54433C'}).color)+'66 0 2px,transparent 2px 4px)':h?'#F0E6CC':off?'var(--c-surface-2)':'transparent';
      const r=lv||pend?(DB.leaveRequests||[]).find(x=>x.id===(lv||pend).id):null;
      return `<div ${r?`onclick="App._lvOpen('${r.id}')" title="${esc((lv?lv.name:'Pending · '+(_lvType(pend.typeKey)||{name:''}).name)+' · '+fmtS(r.from)+(r.to!==r.from?' – '+fmtS(r.to):'')+' · '+_lvD(r.days))}"`:''} style="height:18px;border-radius:3px;background:${bg};${r?'cursor:pointer;':''}${iso===today?'box-shadow:inset 0 0 0 1px var(--c-brand)':''}"></div>`;}).join('');
    const offNow=leaveCovering(p.id,today);const rNow=offNow?(DB.leaveRequests||[]).find(x=>x.id===offNow.id):null;
    const cnt=(DB.leaveRequests||[]).filter(r=>r.userId===p.id&&r.status==='Approved'&&r.from<=mEnd&&r.to>=ym+'-01').reduce((n,r)=>n+(r.dayList||[]).filter(d=>d.slice(0,7)===ym).length,0);
    return `<div class="lv-trow" style="display:grid;grid-template-columns:180px 1fr;gap:8px;align-items:center;padding:6px 0;border-top:1px solid var(--c-border)"><button ${inScope?`onclick="S.filters.lvPerson='${p.id}';rr()"`:'disabled'} style="display:flex;align-items:center;gap:8px;min-width:0;background:none;border:none;cursor:${inScope?'pointer':'default'};text-align:left;padding:0">${avatar(p,'w-7 h-7','text-[9px]')}<div style="min-width:0"><div style="font-size:12.5px;font-weight:700;color:var(--c-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(fullName(p))}</div><div style="font-size:10.5px;color:${offNow?'#8A6152':'var(--c-text-3)'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${offNow?'On '+esc(offNow.name.toLowerCase())+(rNow&&rNow.to>today?' until '+fmtS(rNow.to):' today'):(cnt?cnt+'d this month':esc(p.department||''))}</div></div></button><div class="lv-cells" style="display:grid;grid-template-columns:repeat(${nDays},1fr);gap:2px">${cells}</div></div>`;}).join('');
  // phone list: who is off, by day, with type + duration
  const byDay=[];for(let i=1;i<=nDays;i++){const iso=ym+'-'+String(i).padStart(2,'0');const ppl=list.filter(p=>leaveCovering(p.id,iso));const hol=(DB.holidays||[]).find(h=>h.date===iso&&!h.locationId);if(ppl.length||hol)byDay.push([iso,ppl,hol]);}
  const listHtml=byDay.length?byDay.map(([iso,ppl,hol])=>`<div style="display:flex;gap:10px;padding:8px 0;border-top:1px solid var(--c-border)"><div style="width:44px;flex-shrink:0;text-align:center"><div class="fd" style="font-size:16px;font-weight:800;color:${iso===today?'var(--c-brand)':'var(--c-text)'}">${Number(iso.slice(8))}</div><div style="font-size:10px;color:var(--c-text-3)">${dayAbbr(iso)}</div></div><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;min-width:0">${hol?`<span style="font-size:11.5px;font-weight:700;padding:3px 9px;border-radius:8px;background:#F5EFDF;color:#7F6533">🎉 ${esc(hol.name)}</span>`:''}${ppl.map(p=>{const lv=leaveCovering(p.id,iso);const r=(DB.leaveRequests||[]).find(x=>x.id===lv.id);return `<button onclick="App._lvOpen('${lv.id}')" style="display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--c-text);background:var(--c-surface-2);border:none;border-left:3px solid ${lv.color};border-radius:8px;padding:4px 9px 4px 5px;cursor:pointer;max-width:100%"><span style="flex-shrink:0">${avatar(p,'w-5 h-5','text-[8px]')}</span><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(fullName(p))}</span><span style="font-size:10.5px;color:var(--c-text-3);white-space:nowrap">· ${esc(lv.name.replace(/ leave$/i,''))}${r?' · '+(r.from===r.to?(lv.half?'½ day':'1 day'):fmtS(r.from)+'–'+fmtS(r.to)):''}</span></button>`;}).join('')}</div></div>`).join(''):'<div style="padding:16px 0;text-align:center;font-size:12.5px;color:var(--c-text-3)">Nobody is off this month 🎉</div>';
  const legend=`<div style="display:flex;gap:10px;flex-wrap:wrap;font-size:11px;color:var(--c-text-3);margin-top:8px">${_lvTypes().map(t=>`<span style="display:inline-flex;align-items:center;gap:5px"><span style="width:9px;height:9px;border-radius:3px;background:${t.color}"></span>${esc(t.name.replace(/ leave$/i,''))}</span>`).join('')}<span style="display:inline-flex;align-items:center;gap:5px"><span style="width:9px;height:9px;border-radius:3px;background:repeating-linear-gradient(45deg,#54433C66 0 2px,transparent 2px 4px)"></span>Pending (your scope)</span><span style="display:inline-flex;align-items:center;gap:5px"><span style="width:9px;height:9px;border-radius:3px;background:#F0E6CC"></span>Holiday</span></div>`;
  const offNowCard=offToday.length?`<div class="ui-card" style="margin-bottom:12px;padding:12px 16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span style="font-size:12.5px;font-weight:800;color:var(--c-text-2)">Off today</span>${offToday.map(p=>{const lv=leaveCovering(p.id,today);const r=(DB.leaveRequests||[]).find(x=>x.id===lv.id);return `<button onclick="App._lvOpen('${lv.id}')" style="display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--c-text);background:var(--c-surface-2);border:none;border-left:3px solid ${lv.color};border-radius:8px;padding:4px 9px 4px 5px;cursor:pointer">${avatar(p,'w-5 h-5','text-[8px]')}${esc(fullName(p))}<span style="font-size:10.5px;color:var(--c-text-3)">· ${esc(lv.name.replace(/ leave$/i,''))}${r&&r.to>today?' until '+fmtS(r.to):''}</span></button>`;}).join('')}</div>`:'';
  return nav+kpis+offNowCard+`<div class="ui-card lv-grid-card" style="margin-bottom:12px"><div class="ui-card-pad" style="padding-top:12px"><div class="lv-trow" style="display:grid;grid-template-columns:180px 1fr;gap:8px"><div style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--c-text-3);align-self:end">${list.length} people</div><div style="display:grid;grid-template-columns:repeat(${nDays},1fr);gap:2px">${dayHead}</div></div>${rows||empty('users','Nobody matches','')}${legend}</div></div><div class="ui-card lv-list-card"><div class="ui-card-head"><span class="ui-card-title">Who’s off · ${_attMonthLabel(ym)}</span><span style="font-size:11px;color:var(--c-text-3)">tap for details</span></div><div class="ui-card-pad" style="padding-top:2px">${listHtml}</div></div>`;
}
App._lvApplyForPick=()=>{
  const people=_lvScopeUsers().filter(p=>p.id!==S.uid);
  modalShell({title:'Apply on behalf of',sub:'Logged as applied by you — the person is told',size:'max-w-sm',key:'lv-pick',body:`<div>${selF('Person','lv-pick-u',people.map(p=>[p.id,fullName(p)]))}</div>`,footer:btnG('Cancel','App.closeModal()')+btnP('Next',"App._lvApply(document.getElementById('lv-pick-u').value)")});
};
/* ── Requests inbox: rows with checkbox, approve/reject, swipe on phones, bulk ── */
function _lvInboxTab(){
  const all=!!S.filters.lvInboxAll;const items=_lvInboxItems(all);const sel=S.filters.lvSel||{};const nSel=Object.keys(sel).filter(k=>sel[k]).length;
  const canAll=can('leave','approve')&&_lvInboxItems(true).length!==_lvInboxItems(false).length;
  const sla=Number(_lvSettings().sla_days||3);
  const row=r=>{const u=uById(r.userId);if(!u)return '';const t=_lvType(r.typeKey)||{name:r.typeKey,color:'#54433C'};const age=Math.floor((Date.now()-new Date(r.createdAt))/864e5);const late=age>sla;const B=_lvBalance(r.userId,r.typeKey);const forMe=(r.flow[r.level]||{ids:[]}).ids.includes(S.uid);
    return `<div class="lv-inbox-row" data-id="${r.id}" style="display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--c-border);position:relative;background:var(--c-surface)"><input type="checkbox" ${sel[r.id]?'checked':''} onclick="event.stopPropagation()" onchange="S.filters.lvSel=S.filters.lvSel||{};S.filters.lvSel['${r.id}']=this.checked;rr()"/><div onclick="App._lvOpen('${r.id}')" style="min-width:0;display:flex;align-items:center;gap:10px;cursor:pointer">${avatar(u,'w-8 h-8','text-[10px]')}<div style="min-width:0"><div style="font-size:13px;font-weight:700;color:var(--c-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;align-items:center;gap:6px"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis">${esc(fullName(u))}</span><span style="font-size:10.5px;font-weight:800;padding:1px 8px;border-radius:20px;background:${t.color}1A;color:${t.color};white-space:nowrap">${esc(t.name.replace(/ leave$/i,''))}</span></div><div style="font-size:11.5px;color:var(--c-text-3);display:flex;gap:6px;flex-wrap:wrap;align-items:center"><span style="font-weight:700;color:var(--c-text-2)">${_lvD(r.days)}</span><span>${fmtS(r.from)}${r.to!==r.from?' – '+fmtS(r.to):''}${r.half?' ('+(r.half==='am'?'AM':'PM')+')':''}</span>${B&&!B.unlimited?`<span title="Available before → after">bal ${_lvN(B.availableBeforePending)} → <b style="color:${(B.availableBeforePending-r.days)<0?'#A63528':'var(--c-text-2)'}">${_lvN(B.availableBeforePending-r.days)}</b></span>`:''}${late?`<span style="font-weight:800;color:#A63528">${age}d · over SLA</span>`:`<span>${age}d</span>`}${!forMe?`<span style="color:#7C5A26">for ${esc(_lvWaitingFor(r))}</span>`:''}${r.overrideReason?'<span style="color:#7C5A26">notice overridden</span>':''}${r.attachment?ic('paperclip','w-3 h-3'):''}</div>${r.reason?`<div style="font-size:11.5px;color:var(--c-text-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.reason)}</div>`:''}</div></div><div class="lv-inbox-actions" style="display:flex;gap:6px">${btn('Approve',`App._lvDecide(['${r.id}'],'Approved')`,{variant:'primary',size:'sm',icon:'check'})}${btn('Reject',`App._lvDecide(['${r.id}'],'Rejected')`,{variant:'ghost',size:'sm',icon:'x'})}</div></div>`;};
  const hist=(DB.leaveRequests||[]).filter(r=>r.status!=='Pending'&&(r.decidedBy===S.uid||r.approvals.some(a=>a.by===S.uid))).slice(0,15);
  const histRows=hist.map(r=>{const u=uById(r.userId);return `<button onclick="App._lvOpen('${r.id}')" style="width:100%;text-align:left;display:flex;align-items:center;gap:10px;padding:7px 0;border:none;border-top:1px solid var(--c-border);background:none;font-size:12px;cursor:pointer"><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><b>${esc(fullName(u))}</b> · ${esc(_lvReqLabel(r))}</span>${chip(r.status)}</button>`;}).join('');
  setTimeout(_lvSwipeInit,0);
  return `<div class="ui-card"><div class="ui-card-head" style="flex-wrap:wrap;gap:8px"><span class="ui-card-title">Waiting for you <span style="font-weight:600;color:var(--c-text-3)">· ${items.length}</span></span><div style="display:flex;gap:6px;flex-wrap:wrap">${canAll?`<button onclick="S.filters.lvInboxAll=${all?'false':'true'};rr()" class="ui-btn ui-btn-subtle ui-btn-sm">${all?'Only mine':'All in my scope'}</button>`:''}${nSel&&_lvSettings().bulk_approve!==false?btn('Approve '+nSel,'App._lvDecide(Object.keys(S.filters.lvSel).filter(k=>S.filters.lvSel[k]),\'Approved\')',{variant:'primary',size:'sm',icon:'check'})+btn('Reject '+nSel,'App._lvDecide(Object.keys(S.filters.lvSel).filter(k=>S.filters.lvSel[k]),\'Rejected\')',{variant:'ghost',size:'sm',icon:'x'}):(items.length>1&&_lvSettings().bulk_approve!==false?btn('Select all','S.filters.lvSel={};_lvInboxItems(!!S.filters.lvInboxAll).forEach(i=>S.filters.lvSel[i.id]=true);rr()',{variant:'subtle',size:'sm'}):'')}</div></div>
    <div class="ui-card-pad" style="padding-top:2px">${items.map(row).join('')||'<div style="padding:18px 0;text-align:center;font-size:12.5px;color:var(--c-text-3)">Nothing waiting for you 🎉</div>'}${items.length?'<div class="lv-swipe-hint" style="font-size:11px;color:var(--c-text-3);padding-top:8px">Swipe a row right to approve, left to reject.</div>':''}</div></div>
    ${histRows?`<div class="ui-card" style="margin-top:12px"><div class="ui-card-head"><span class="ui-card-title">Recently decided by you</span></div><div class="ui-card-pad" style="padding-top:2px">${histRows}</div></div>`:''}`;
}
/* touch swipe: right = approve, left = reject (phones only) */
function _lvSwipeInit(){
  if(!window.matchMedia||!window.matchMedia('(max-width:767px)').matches)return;
  document.querySelectorAll('.lv-inbox-row').forEach(el=>{if(el._sw)return;el._sw=1;let x0=null,dx=0;
    el.addEventListener('touchstart',e=>{x0=e.touches[0].clientX;dx=0;el.style.transition='none';},{passive:true});
    el.addEventListener('touchmove',e=>{if(x0==null)return;dx=e.touches[0].clientX-x0;if(Math.abs(dx)<8)return;el.style.transform='translateX('+Math.max(-110,Math.min(110,dx))+'px)';el.style.background=dx>40?'#E9F1E8':dx<-40?'#F9EBE5':'var(--c-surface)';},{passive:true});
    el.addEventListener('touchend',()=>{el.style.transition='transform .18s';el.style.transform='';el.style.background='var(--c-surface)';const id=el.getAttribute('data-id');if(dx>90)App._lvDecide([id],'Approved');else if(dx<-90)App._lvDecide([id],'Rejected');x0=null;dx=0;});
  });
}

/* ═══════════════ MY DAY + PROFILE hooks ═══════════════ */
function _lvHomeTiles(tile){
  if(!_lvEnabled()||!DB.leaveTypes||!DB.leaveTypes.length)return '';
  let out='';
  try{const B=_lvBalance(S.uid,'annual');if(B&&!B.unlimited)out+=tile('Annual leave',_lvN(B.available),(B.booked+B.pending?_lvN(B.booked+B.pending)+' booked · ':'')+'days available','calendar',"App.go('leaves')",'#54433C');}catch(e){}
  try{const n=_lvInboxItems().length;if(n)out+=tile('Leave requests',n,'waiting for you','approve',"App.go('leaves');S.filters.lvTab='requests';rr()",'#936659');}catch(e){}
  return out;
}
function _lvHomeBanner(){
  if(!_lvEnabled())return '';const today=todayISO();const u=me();
  const lv=leaveCovering(S.uid,today);
  if(lv){const r=(DB.leaveRequests||[]).find(x=>x.id===lv.id);return `<div class="ui-card" style="padding:12px 16px;display:flex;align-items:center;gap:12px;margin-bottom:12px;border-left:4px solid ${lv.color}"><span style="font-size:22px">🌴</span><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:800;color:var(--c-text)">You’re on ${esc(lv.name.toLowerCase())}${r&&r.to>today?' until '+fmtD(r.to):' today'}</div><div style="font-size:12px;color:var(--c-text-3)">No clock-in expected. Enjoy the break.</div></div></div>`;}
  const off=(DB.users||[]).filter(p=>p.status==='Active'&&p.id!==S.uid&&leaveCovering(p.id,today));
  if(off.length)return `<div class="ui-card" style="padding:10px 16px;display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap"><span style="font-size:12.5px;font-weight:700;color:var(--c-text-2)">Off today:</span>${off.slice(0,8).map(p=>{const lv2=leaveCovering(p.id,today);const r2=(DB.leaveRequests||[]).find(x=>x.id===lv2.id);return `<button onclick="App._lvOpen('${lv2.id}')" style="display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:var(--c-text);background:var(--c-surface-2);border:none;border-left:3px solid ${lv2.color};border-radius:8px;padding:3px 9px 3px 5px;cursor:pointer">${avatar(p,'w-5 h-5','text-[8px]')}${esc(fullName(p))}<span style="font-size:10.5px;color:var(--c-text-3)">· ${esc(lv2.name.replace(/ leave$/i,''))}${r2&&r2.to>today?' until '+fmtS(r2.to):''}</span></button>`;}).join('')}${off.length>8?`<button onclick="App.go('leaves');S.filters.lvTab='team';rr()" style="font-size:12px;font-weight:700;color:var(--c-brand);background:none;border:none;cursor:pointer">+${off.length-8} more →</button>`:''}</div>`;
  return '';
}
/* Profile → Leave tab body */
function _lvProfileTab(u,P){
  _lvBoot();
  if(!_lvEnabled())return empty('calendar','Leave isn’t switched on yet','');
  return _lvMyTab(u.id,{profile:true});
}
/* Deep links: leave:req:<id> · leave:sla:<id> · leave:balances · leave */
App._lvOpenLink=(L)=>{
  App.go('leaves');
  if(L.indexOf('leave:req:')===0||L.indexOf('leave:sla:')===0){const id=L.split(':')[2];const r=(DB.leaveRequests||[]).find(x=>x.id===id);S.filters.lvTab=(r&&r.userId===S.uid)?'my':'requests';rr();if(r)setTimeout(()=>App._lvOpen(id),50);else _lvLoadAll(true).then(()=>{if((DB.leaveRequests||[]).some(x=>x.id===id))App._lvOpen(id);});return;}
  if(L==='leave:balances'){S.filters.lvTab='balances';rr();return;}
  rr();
};
