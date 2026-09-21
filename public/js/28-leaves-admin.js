/* ============================================================
   Bridge — 28-leaves-admin.js  (v159)
   Administration → Leaves (every rule, no code) · Balances · Reports ·
   Year-end · ledger adjustments · compensation (Head of People only).
   Classic script: shares top-level scope with the other /js files.
   Loads after 27-leaves.js.
   ============================================================ */

/* ═══════════════ ADMINISTRATION → LEAVES ═══════════════ */
const LV_ADM_SECTIONS=[['overview','Overview','grid'],['types','Leave types','list'],['accrual','Accrual & balances','chart'],['yearend','Year-end','calendar'],['approvals','Approvals & SLA','approve'],['holidays','Holidays','flag'],['roles','Roles','shield'],['audit','Audit','audit']];
function leaveSettingsPage(){
  if(!can('leave','manage'))return `<div class="fade">${hdr('Leave rules','')}${empty('lock','Restricted','You need Leaves → Manage.')}</div>`;
  _lvBoot();if(!_lvLoaded.audit)_lvLoadAudit();
  const sec=S.filters.lvAdmSec||'overview';const s=_lvSettings();
  const nav=`<div class="lv-adm-nav hscroll" style="display:flex;gap:4px;padding-bottom:2px">${LV_ADM_SECTIONS.map(([k,l,i])=>`<button onclick="S.filters.lvAdmSec='${k}';rr()" class="lv-adm-item${sec===k?' on':''}" style="display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:10px;border:none;background:${sec===k?'var(--c-surface)':'transparent'};box-shadow:${sec===k?'var(--sh-sm)':'none'};color:${sec===k?'var(--c-text)':'var(--c-text-2)'};font-size:13px;font-weight:${sec===k?'800':'600'};cursor:pointer;white-space:nowrap;flex-shrink:0">${ic(i,'w-4 h-4')}${l}</button>`).join('')}</div>`;
  let body='';
  if(!_LVS||!DB.leaveTypes)body=loadingState();
  else if(sec==='overview')body=_lvAdmOverview(s);
  else if(sec==='types')body=_lvAdmTypes();
  else if(sec==='accrual')body=_lvAdmAccrual(s);
  else if(sec==='yearend')body=_lvAdmYearEnd(s);
  else if(sec==='approvals')body=_lvAdmApprovals(s);
  else if(sec==='holidays')body=(typeof _attHolidaysCard==='function'?_attHolidaysCard():'')+`<div class="ui-card"><div class="ui-card-pad" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><div style="flex:1;min-width:220px"><div style="font-size:13px;font-weight:800;color:var(--c-text)">Attendance rules</div><div style="font-size:12px;color:var(--c-text-3);line-height:1.45">Grace, comp-off rate and expiry, regularisation caps, WFH quota and reminders live under Administration → Attendance. Leave reads comp-off and holidays from there.</div></div>${btn('Open Attendance rules',"App.go('attsettings')",{variant:'ghost',size:'sm',icon:'clock'})}</div></div>`;
  else if(sec==='roles')body=_lvAdmRoles();
  else body=_lvAdmAudit();
  return `<div class="fade">${hdr('Leave rules','Everything the leave module does is decided here — no code, applies to everyone',(s.enabled?'<span style="font-size:11px;font-weight:800;padding:4px 10px;border-radius:20px;background:#E9F1E8;color:#346A47;align-self:center">LIVE</span>':'<span style="font-size:11px;font-weight:800;padding:4px 10px;border-radius:20px;background:var(--c-surface-2);color:var(--c-text-3);align-self:center">OFF</span>'))}<div class="lv-adm" style="display:grid;grid-template-columns:200px minmax(0,1fr);gap:16px;align-items:start"><div class="lv-adm-side" style="position:sticky;top:70px">${nav}</div><div style="min-width:0">${body}</div></div></div>`;
}
/* shared row / control builders (same look as Administration → Attendance) */
function _lvRow(label,desc,ctl){return `<div class="att-set-row" style="display:flex;align-items:center;justify-content:space-between;gap:14px;padding:11px 0;border-top:1px solid var(--c-border)"><div class="att-set-text" style="min-width:0;flex:1"><div style="font-size:13.5px;font-weight:700;color:var(--c-text)">${label}</div><div style="font-size:11.5px;color:var(--c-text-3);line-height:1.45">${desc}</div></div><div class="att-set-ctl" style="flex-shrink:0">${ctl}</div></div>`;}
function _lvTog(k,val){return `<button role="switch" aria-checked="${val?'true':'false'}" class="tog ${val?'on':'off'}" onclick="App._lvSet('${k}',!(this.classList.contains('on')));this.classList.toggle('on');this.classList.toggle('off')"><span></span></button>`;}
function _lvNum(k,val,unit,min,max,step){return `<div class="att-num" style="display:flex;align-items:center;gap:6px"><input type="number" inputmode="decimal" min="${min}" max="${max}" step="${step||1}" value="${val==null?'':val}" class="ui-input" style="width:84px;padding:7px 10px" onchange="App._lvSet('${k}',this.value===''?null:Number(this.value))"/><span style="font-size:11.5px;color:var(--c-text-3);white-space:nowrap">${unit||''}</span></div>`;}
function _lvSel(k,val,opts){return `<select class="ui-select" style="width:auto;max-width:100%;padding:7px 30px 7px 12px" onchange="App._lvSet('${k}',this.value)">${opts.map(([v,l])=>`<option value="${v}" ${String(val)===String(v)?'selected':''}>${l}</option>`).join('')}</select>`;}
function _lvTxt(k,val,w,type){return `<input type="${type||'text'}" value="${esc(val==null?'':val)}" class="ui-input" style="width:${w||150}px;padding:7px 10px" onchange="App._lvSet('${k}',this.value)"/>`;}
function _lvCard(title,rows,note){return `<div class="ui-card" style="margin-bottom:12px"><div class="ui-card-head"><span class="ui-card-title">${title}</span><span style="font-size:11px;color:var(--c-text-3)">${note||'saved instantly'}</span></div><div class="ui-card-pad" style="padding-top:2px">${rows}</div></div>`;}
App._lvSet=(k,v)=>{
  if(!can('leave','manage'))return toast('You need Leaves → Manage','err');
  let patch;
  if(k.indexOf('entity.')===0){patch={entity:{...(_lvSettings().entity||{}),[k.slice(7)]:v}};}
  else patch={[k]:v};
  _lvSaveSettings(patch).then(()=>{toast(k==='enabled'?(v?'Leave is LIVE — balances, requests and accruals are on':'Leave switched off'):'Saved');if(k==='enabled'){log(fullName(me()),v?'Leave module switched ON':'Leave module switched OFF','');rr();}});
};
function _lvAdmOverview(s){
  const people=(DB.users||[]).filter(u=>u.status==='Active');const noJoin=people.filter(u=>!u.joiningDate);
  const acc=(DB.leaveLedger||[]).filter(x=>x.entry==='accrual');const lastP=acc.length?acc.map(x=>x.period).sort().pop():null;
  const master=`<div class="ui-card" style="margin-bottom:12px;border:1.5px solid ${s.enabled?'#428059':'var(--c-border-2)'}"><div class="ui-card-pad" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap"><div style="flex:1;min-width:220px"><div style="font-size:14px;font-weight:800;color:var(--c-text)">Leave module</div><div style="font-size:12px;color:var(--c-text-3);line-height:1.45">Off: nobody sees balances or the Apply button, and the server posts no accruals. Turn it on once the leave types and the accrual start date below are right.</div></div>${_lvTog('enabled',s.enabled)}</div></div>`;
  const status=`<div class="bb-kpis" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:12px">${[['Leave types',_lvTypes().length+' on','#54433C'],['Accruals posted',acc.length,'#463830'],['Last accrual',lastP?_attMonthLabel(lastP):'—','#936659'],['Missing joining date',noJoin.length,noJoin.length?'#A63528':'#346A47']].map(([l,v,c])=>`<div style="background:var(--c-surface);border:1px solid var(--c-border);border-radius:14px;padding:10px 12px"><div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--c-text-3)">${l}</div><div class="fd" style="font-size:18px;font-weight:800;color:${c};margin-top:3px">${v}</div></div>`).join('')}</div>`;
  const e=s.entity||{};
  return master+status
   +_lvCard('Leave year & accrual start',
      _lvRow('Leave year','1 January – 31 December for every type (spec). Sick leave counts per service year from the joining anniversary; parental, bereavement and maternity per event.','<span style="font-size:12.5px;font-weight:700">Calendar year</span>')
     +_lvRow('Accruals start from','The first month the server generates monthly accruals for. Earlier balances (Keka) come in as opening-balance entries under Leaves → Balances → Adjust.',_lvTxt('accrual_from',s.accrual_from,150,'date'))
     +_lvRow('Run accruals now','Posts every missing month up to last month for everyone (idempotent — safe to press again). The server does this itself every hour once the module is on.',btn('Run now','App._lvRunTick()',{variant:'ghost',size:'sm',icon:'refresh'}))
     +_lvRow('Time zone','Used for “today” in the server job.',_lvTxt('tz',s.tz,150)))
   +(noJoin.length?`<div class="ui-card" style="margin-bottom:12px;border-left:4px solid #C9A76B"><div class="ui-card-pad"><div style="font-size:13px;font-weight:800;color:var(--c-text)">${noJoin.length} ${noJoin.length===1?'person has':'people have'} no joining date</div><div style="font-size:12px;color:var(--c-text-3);line-height:1.5;margin:4px 0 8px">Accrual, service-year sick leave, probation and the 2-year study-leave rule all read it. Until it is set, accrual assumes they joined before the accrual start date.</div><div style="display:flex;gap:6px;flex-wrap:wrap">${noJoin.slice(0,12).map(u=>`<button onclick="App.openProfile('${u.id}');S.filters.profTab='work';rr()" style="display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:var(--c-text);background:var(--c-surface-2);border:none;border-radius:20px;padding:3px 10px 3px 3px;cursor:pointer">${avatar(u,'w-5 h-5','text-[8px]')}${esc(fullName(u))}</button>`).join('')}${noJoin.length>12?'<span style="font-size:12px;color:var(--c-text-3);align-self:center">+'+(noJoin.length-12)+' more</span>':''}</div></div></div>`:'')
   +_lvCard('Legal entity',
      _lvRow('Legal name','',_lvTxt('entity.legal_name',e.legal_name,200))
     +_lvRow('Jurisdiction · Emirate','One country for now; a second entity (KSA) can be added later without a migration.',`<div style="display:flex;gap:6px">${_lvTxt('entity.jurisdiction',e.jurisdiction,70)}${_lvTxt('entity.emirate',e.emirate,110)}</div>`)
     +_lvRow('Trade licence · MOHRE · WPS','Reference only — shown on exports.',`<div class="lv-ent-ids" style="display:flex;gap:6px;flex-wrap:wrap">${_lvTxt('entity.licence_no',e.licence_no,100)}${_lvTxt('entity.mohre_id',e.mohre_id,100)}${_lvTxt('entity.wps_id',e.wps_id,100)}</div>`)
     +_lvRow('Currency','For liability and encashment figures.',_lvTxt('entity.currency',e.currency,70)),'')
   +`<p style="font-size:12px;color:var(--c-text-3);line-height:1.5">Per-person settings — <b>joining date</b>, <b>probation end</b>, <b>rest days / work pattern</b> (which decide the 22- or 26-day band) and <b>employment status</b> — live on each profile (People → open profile → Work).</p>`;
}
App._lvRunTick=async()=>{
  if(!can('leave','manage'))return;
  if(!_lvEnabled())return toast('Switch the module on first — the job only runs while it is live','warn');
  toast('Running…');const{error}=await sb.rpc('bridge_leave_tick');
  if(error)return toast('Failed — '+error.message,'err');
  await _lvLoadAll(true);toast('Accruals up to date ✓');rr();
};
/* ── Leave types ── */
function _lvAdmTypes(){
  const list=_lvTypes(true);
  const rows=list.map(t=>{const r=t.rules||{};const ent=r.accrues?Object.keys(r.entitlement_by_week||{}).map(k=>r.entitlement_by_week[k]+'d/'+k+'-day wk').join(' · '):(r.entitlement_days!=null?r.entitlement_days+' '+(r.unit==='calendar_days'?'calendar':'working')+' days / '+(r.year_basis==='per_instance'?'instance':r.year_basis==='service_year'?'service yr':'year'):'no fixed limit');
    const flow=(r.approval||[]).map(l=>(LV_APPROVER_LABEL[l.approver]||l.approver)+(l.min_days?' (≥'+l.min_days+'d'+(l.or_advance?' / advance':'')+')':'')).join(' → ')||'auto';
    return `<div class="lv-type-row" style="display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;padding:10px 0;border-top:1px solid var(--c-border);opacity:${t.active?1:.55}"><span style="width:12px;height:12px;border-radius:4px;background:${t.color}"></span><div style="min-width:0"><div style="font-size:13.5px;font-weight:800;color:var(--c-text)">${esc(t.name)} <span style="font-size:10.5px;font-weight:700;padding:1px 7px;border-radius:20px;background:var(--c-surface-2);color:var(--c-text-2)">${r.paid==='unpaid'?'Unpaid':r.paid==='banded'?'Paid in bands':'Paid'}</span>${t.active?'':' <span style="font-size:10.5px;font-weight:700;padding:1px 7px;border-radius:20px;background:var(--c-surface-2);color:var(--c-text-3)">Off</span>'}</div><div style="font-size:11.5px;color:var(--c-text-3);line-height:1.45">${esc(ent)} · ${r.accrues?'accrues monthly':'no accrual'}${r.half_day?' · half days':''}${(r.notice_tiers||[]).length?' · notice '+(r.notice_tiers||[]).map(x=>x.notice_days+'d for ≥'+x.min_days+'d').join(', '):''}<br>Approval: ${esc(flow)}</div></div><div style="display:flex;gap:6px">${btn('Edit',`App._lvTypeEdit('${t.key}')`,{variant:'ghost',size:'sm',icon:'edit'})}</div></div>`;}).join('');
  return `<div class="ui-card"><div class="ui-card-head"><span class="ui-card-title">Leave types</span>${btn('Add type','App._lvTypeEdit()',{variant:'primary',size:'sm',icon:'plus'})}</div><div class="ui-card-pad" style="padding-top:2px">${rows}<p style="font-size:11.5px;color:var(--c-text-3);margin-top:10px;line-height:1.5">Each type carries its own pay treatment, entitlement, eligibility, notice tiers, attachments, half-day rule and approval flow. Switching a type off hides it from Apply but keeps history and balances.</p></div></div>`;
}
const LV_TYPE_BLANK={paid:'paid',accrues:false,unit:'working_days',entitlement_days:null,entitlement_by_week:{5:22,6:26},statutory_calendar_days:null,year_basis:'leave_year',eligibility:{min_service_months:0,after_probation:false,gender:null,once_per_tenure:false,instances_per_year:null},half_day:false,backdate_days:0,future_only:true,notice_tiers:[],rm_override:true,min_days:1,max_days:null,gap_days:0,attachment_from_days:null,comment_required:true,count_rest_days:null,during_notice_period:true,carry_forward:false,encashable:false,advance_allowed:false,approval:[{approver:'manager'}],law:''};
let _LVT=null;
App._lvTypeEdit=(key)=>{
  if(!can('leave','manage'))return;
  const t=key?_lvType(key):null;
  if(!_LVT||_LVT.key!==(key||'__new')){_LVT={key:key||'__new',name:t?t.name:'',color:t?t.color:'#54433C',active:t?t.active:true,sort:t?t.sort:(_lvTypes(true).length+1),rules:JSON.parse(JSON.stringify(t?{...LV_TYPE_BLANK,...t.rules,eligibility:{...LV_TYPE_BLANK.eligibility,...(t.rules.eligibility||{})}}:LV_TYPE_BLANK))};}
  const r=_LVT.rules;const el=r.eligibility;const sec=_LVT.sec||'basics';
  const F=(label,id,val,type,ph,extra)=>`<div><label class="ui-label">${label}</label><input id="${id}" type="${type||'text'}" value="${esc(val==null?'':val)}" placeholder="${esc(ph||'')}" class="ui-input rf" ${extra||''}/></div>`;
  const SEL=(label,id,val,opts)=>`<div><label class="ui-label">${label}</label><select id="${id}" class="ui-select rf">${opts.map(([v,l])=>`<option value="${v}" ${String(val)===String(v)?'selected':''}>${l}</option>`).join('')}</select></div>`;
  const TOG=(label,id,val,desc)=>`<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 0"><div><div style="font-size:13px;font-weight:600;color:var(--c-text)">${label}</div>${desc?`<div style="font-size:11px;color:var(--c-text-3)">${desc}</div>`:''}</div><button id="${id}" role="switch" class="tog ${val?'on':'off'}" onclick="this.classList.toggle('on');this.classList.toggle('off')"><span></span></button></div>`;
  const two=(a,b)=>`<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">${a}${b}</div>`;
  const SECS=[['basics','Basics'],['entitle','Entitlement'],['who','Who & when'],['rules','Rules'],['approval','Approval'],['yearend','Year-end']];
  const pills=`<div class="hscroll" style="display:flex;gap:4px;padding-bottom:2px;margin-bottom:12px">${SECS.map(([k,l])=>`<button onclick="App._lvTypeCollect();_LVT.sec='${k}';App._lvTypeEdit('${key||''}')" class="ui-btn ${sec===k?'ui-btn-primary':'ui-btn-ghost'} ui-btn-sm" style="flex-shrink:0">${l}</button>`).join('')}</div>`;
  let body='';
  if(sec==='basics')body=`${two(F('Name','lt-name',_LVT.name,'text','e.g. Annual leave'),F('Key (id, no spaces)','lt-key',_LVT.key==='__new'?'':_LVT.key,'text','annual',key?'disabled':''))}
    ${two(SEL('Pay','lt-paid',r.paid,[['paid','Paid'],['unpaid','Unpaid'],['banded','Paid in bands (sick / maternity)']]),F('Colour','lt-color',_LVT.color,'color'))}
    ${r.paid==='banded'?`<div><label class="ui-label">Pay bands (days at % pay, in order)</label><input id="lt-bands" class="ui-input rf" value="${esc((r.pay_bands||[]).map(b=>b.days+'@'+b.pay).join(', '))}" placeholder="15@100, 30@50, 45@0"/></div>`:''}
    ${TOG('Active','lt-active',_LVT.active,'Off hides it from Apply; history and balances are kept')}
    ${F('Order','lt-sort',_LVT.sort,'number')}
    <div><label class="ui-label">Law / policy note (shown to people when they apply)</label><textarea id="lt-law" class="ui-input rf" rows="3">${esc(r.law||'')}</textarea></div>`;
  else if(sec==='entitle')body=`${TOG('Accrues monthly','lt-accrues',r.accrues,'On: entitlement ÷ 12 is credited on the last day of each month (annual leave). Off: a fixed number of days per year / per event.')}
    ${SEL('Unit','lt-unit',r.unit,[['working_days','Working days (rest days & holidays inside the leave are skipped)'],['calendar_days','Calendar days (every day counts — UAE statutory sick / maternity)']])}
    ${two(F('Days per year · 5-day week','lt-e5',(r.entitlement_by_week||{})['5'],'number'),F('Days per year · 6-day week','lt-e6',(r.entitlement_by_week||{})['6'],'number'))}
    <div style="font-size:11px;color:var(--c-text-3);margin-top:-6px">Used when the type accrues. The band comes from the person’s rest days (People → Work). The statutory floor below always wins if higher.</div>
    ${two(F('Statutory minimum (calendar days)','lt-stat',r.statutory_calendar_days,'number','30'),F('Fixed days (non-accruing types)','lt-ed',r.entitlement_days,'number','leave empty = no limit'))}
    ${SEL('Counted per','lt-year',r.year_basis,[['leave_year','Leave year (Jan–Dec)'],['service_year','Service year (joining anniversary)'],['rolling','Rolling 12 months'],['per_instance','Per event / instance']])}
    ${_LVT.key==='comp_off'?F('Comp-off expires after (days)','lt-exp',r.expiry_days,'number'):''}`;
  else if(sec==='who')body=`${two(F('Minimum service (months)','lt-svc',el.min_service_months,'number'),SEL('Gender','lt-gender',el.gender||'',[['','Everyone'],['Female','Female'],['Male','Male']]))}
    ${TOG('Only after probation','lt-prob',el.after_probation,'UAE law: paid sick leave starts after probation')}
    ${TOG('Once per employment','lt-once',el.once_per_tenure,'e.g. Hajj')}
    ${two(F('Max instances per year','lt-inst',el.instances_per_year,'number','empty = unlimited'),F('Gap between two requests (days)','lt-gap',r.gap_days,'number'))}
    ${TOG('Available during notice period','lt-notice',r.during_notice_period)}
    ${SEL('Who applies','lt-who',r.who_can_apply||'self',[['self','The person (and managers / People on their behalf)'],['people_only','People only (e.g. national service)']])}`;
  else if(sec==='rules')body=`${two(F('Minimum days per request','lt-min',r.min_days,'number','0.5'),F('Maximum days per request','lt-max',r.max_days,'number','empty = none'))}
    ${TOG('Half days allowed','lt-half',r.half_day)}
    ${SEL('Dates','lt-dates',r.past_only?'past':(r.future_only?'future':'both'),[['future','Future only (planned leave)'],['past','Past only — reported after the fact (sick)'],['both','Past or future']])}
    ${F('Can be backdated up to (days)','lt-back',r.backdate_days,'number')}
    <div><label class="ui-label">Notice tiers (days of leave → days of notice)</label><input id="lt-tiers" class="ui-input rf" value="${esc((r.notice_tiers||[]).map(x=>x.min_days+'→'+x.notice_days).join(', '))}" placeholder="1→7, 6→30"/></div>
    ${TOG('Manager can override the notice rule with a reason','lt-ovr',r.rm_override)}
    ${two(F('Attachment required from (days)','lt-att',r.attachment_from_days,'number','empty = never'),SEL('Rest days / holidays inside the leave','lt-rest',r.count_rest_days==null?'':(r.count_rest_days?'1':'0'),[['','Workspace default ('+(_lvSettings().sandwich==='consumed'?'consumed':'not consumed')+')'],['0','Not consumed'],['1','Consumed (sandwich)']]))}
    ${TOG('Reason required','lt-comment',r.comment_required)}
    ${_LVT.key==='unpaid'?TOG('Only when annual leave is used up','lt-exh',r.requires_annual_exhausted,'UAE law does not require this; the People manual does'):''}`;
  else if(sec==='approval'){const levels=r.approval||[];const kinds=[['manager','Reporting manager'],['manager2','Manager’s manager'],['hop','Head of People'],['people_admin','People Admin'],['finance','Finance'],['admin','Administrator']].concat(Object.values(DB.roleProfiles||{}).filter(p=>!p.builtin).map(p=>['role:'+p.id,'Role: '+p.name]));
    body=`<div style="font-size:12px;color:var(--c-text-3);line-height:1.5;margin-bottom:8px">Levels run in order. A level with a condition is skipped when the condition isn’t met. A level that resolves to nobody (no manager) falls back to People. Nobody ever approves their own request.</div>
    <div id="lt-levels" style="display:grid;gap:8px">${levels.map((l,i)=>`<div class="lt-level" style="display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;padding:8px 10px;border:1px solid var(--c-border);border-radius:12px"><span style="width:22px;height:22px;border-radius:50%;background:var(--c-surface-2);display:grid;place-items:center;font-size:11px;font-weight:800">${i+1}</span><div style="display:grid;gap:6px;min-width:0"><select class="ui-select lt-lv-kind" style="padding:6px 28px 6px 10px">${kinds.map(([v,n])=>`<option value="${v}" ${l.approver===v?'selected':''}>${n}</option>`).join('')}</select><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:11.5px;color:var(--c-text-2)"><span>only if ≥</span><input type="number" class="ui-input lt-lv-min" value="${l.min_days||''}" placeholder="any" style="width:64px;padding:4px 8px"/><span>days</span><label style="display:inline-flex;align-items:center;gap:4px"><input type="checkbox" class="lt-lv-adv" ${l.or_advance?'checked':''}/> or advance beyond threshold</label><label style="display:inline-flex;align-items:center;gap:4px"><input type="checkbox" class="lt-lv-prob" ${l.on_probation?'checked':''}/> only on probation</label></div></div><button onclick="App._lvTypeCollect();_LVT.rules.approval.splice(${i},1);App._lvTypeEdit('${key||''}')" class="ui-btn ui-btn-subtle ui-btn-sm">${ic('trash','w-3.5 h-3.5')}</button></div>`).join('')}</div>
    <div style="margin-top:8px">${btn('Add level',`App._lvTypeCollect();_LVT.rules.approval.push({approver:'hop'});App._lvTypeEdit('${key||''}')`,{variant:'ghost',size:'sm',icon:'plus'})}</div>`;}
  else body=`${TOG('Carries forward at year-end','lt-carry',r.carry_forward,'Subject to the cap under Year-end')}
    ${TOG('Can be encashed','lt-encash',r.encashable)}
    ${TOG('Can be taken in advance of accrual','lt-adv',r.advance_allowed,'Subject to the advance cap under Accrual & balances')}`;
  modalShell({title:t?t.name:'New leave type',sub:'Rules apply from the next request; history is never rewritten',size:'max-w-lg',key:'lv-type',
    body:pills+`<div style="display:grid;gap:10px">${body}</div>`,
    footer:(t&&t.active?btn('Switch off',`App._lvTypeToggle('${t.key}',false)`,{variant:'ghost',size:'md'}):'')+btnG('Cancel','_LVT=null;App.closeModal()')+btnP('Save',`App._lvTypeSave('${key||''}')`)});
};
/* read the open section's fields back into _LVT (so switching sections keeps edits) */
App._lvTypeCollect=()=>{
  if(!_LVT)return;const r=_LVT.rules;const g=id=>document.getElementById(id);const v=id=>{const e=g(id);return e?e.value:undefined;};const n=id=>{const x=v(id);return x===undefined?undefined:(x===''?null:Number(x));};const on=id=>{const e=g(id);return e?e.classList.contains('on'):undefined;};
  const set=(o,k,val)=>{if(val!==undefined)o[k]=val;};
  set(_LVT,'name',v('lt-name'));if(v('lt-key')!==undefined&&_LVT.key==='__new')_LVT.newKey=String(v('lt-key')||'').trim().toLowerCase().replace(/[^a-z0-9_]+/g,'_');
  set(r,'paid',v('lt-paid'));set(_LVT,'color',v('lt-color'));set(_LVT,'active',on('lt-active'));if(n('lt-sort')!==undefined)_LVT.sort=n('lt-sort')||100;set(r,'law',v('lt-law'));
  if(v('lt-bands')!==undefined)r.pay_bands=String(v('lt-bands')).split(',').map(s=>s.trim()).filter(Boolean).map(s=>{const [d,p]=s.split('@');return{days:Number(d),pay:Number(p)};}).filter(b=>b.days>0);
  set(r,'accrues',on('lt-accrues'));set(r,'unit',v('lt-unit'));if(n('lt-e5')!==undefined||n('lt-e6')!==undefined)r.entitlement_by_week={5:n('lt-e5')==null?22:n('lt-e5'),6:n('lt-e6')==null?26:n('lt-e6')};
  set(r,'statutory_calendar_days',n('lt-stat'));set(r,'entitlement_days',n('lt-ed'));set(r,'year_basis',v('lt-year'));set(r,'expiry_days',n('lt-exp'));
  const el=r.eligibility;set(el,'min_service_months',n('lt-svc'));if(v('lt-gender')!==undefined)el.gender=v('lt-gender')||null;set(el,'after_probation',on('lt-prob'));set(el,'once_per_tenure',on('lt-once'));set(el,'instances_per_year',n('lt-inst'));set(r,'gap_days',n('lt-gap'));set(r,'during_notice_period',on('lt-notice'));set(r,'who_can_apply',v('lt-who'));
  set(r,'min_days',n('lt-min'));set(r,'max_days',n('lt-max'));set(r,'half_day',on('lt-half'));if(v('lt-dates')!==undefined){r.past_only=v('lt-dates')==='past';r.future_only=v('lt-dates')==='future';}set(r,'backdate_days',n('lt-back'));
  if(v('lt-tiers')!==undefined)r.notice_tiers=String(v('lt-tiers')).split(',').map(s=>s.trim()).filter(Boolean).map(s=>{const [a,b]=s.split(/→|->|:/);return{min_days:Number(a),notice_days:Number(b)};}).filter(x=>x.min_days>=0&&x.notice_days>=0);
  set(r,'rm_override',on('lt-ovr'));set(r,'attachment_from_days',n('lt-att'));if(v('lt-rest')!==undefined)r.count_rest_days=v('lt-rest')===''?null:v('lt-rest')==='1';set(r,'comment_required',on('lt-comment'));set(r,'requires_annual_exhausted',on('lt-exh'));
  const lv=document.getElementById('lt-levels');if(lv){r.approval=[...lv.querySelectorAll('.lt-level')].map(row=>{const o={approver:row.querySelector('.lt-lv-kind').value};const m=Number(row.querySelector('.lt-lv-min').value||0);if(m>0)o.min_days=m;if(row.querySelector('.lt-lv-adv').checked)o.or_advance=true;if(row.querySelector('.lt-lv-prob').checked)o.on_probation=true;return o;});}
  set(r,'carry_forward',on('lt-carry'));set(r,'encashable',on('lt-encash'));set(r,'advance_allowed',on('lt-adv'));
};
App._lvTypeSave=async(key)=>{
  if(!can('leave','manage'))return;App._lvTypeCollect();
  const isNew=!key;const k=isNew?(_LVT.newKey||''):key;
  if(!_LVT.name.trim())return toast('Give it a name','err');if(isNew&&!k)return toast('Give it a key (e.g. study)','err');if(isNew&&_lvType(k))return toast('That key already exists','err');
  const before=isNew?null:_lvType(key);
  const row={key:k,name:_LVT.name.trim(),sort:_LVT.sort,active:_LVT.active,color:_LVT.color,icon:before?before.icon:'calendar',rules:_LVT.rules,updated_by:S.uid,updated_at:new Date().toISOString()};
  const{error}=await sb.from('leave_types').upsert(row,{onConflict:'key'});
  if(error)return toast('Couldn’t save — '+error.message,'err');
  _lvAudit('type:'+k,null,before?{name:before.name,active:before.active,rules:before.rules}:null,{name:row.name,active:row.active,rules:row.rules},isNew?'created':'edited');
  DB.leaveTypes=(DB.leaveTypes||[]).filter(t=>t.key!==k).concat([_mLT(row)]);
  log(fullName(me()),isNew?'Leave type created':'Leave type edited',row.name);
  _LVT=null;closeModal();toast('Saved ✓');rr();
};
App._lvTypeToggle=async(key,active)=>{const t=_lvType(key);if(!t||!can('leave','manage'))return;const{error}=await sb.from('leave_types').update({active,updated_by:S.uid,updated_at:new Date().toISOString()}).eq('key',key);if(error)return toast(error.message,'err');_lvAudit('type:'+key,'active',t.active,active,'');t.active=active;_LVT=null;closeModal();toast(active?'Switched on':'Switched off');rr();};
/* ── Accrual & balances ── */
function _lvAdmAccrual(s){
  return _lvCard('Accrual',
      _lvRow('Monthly accrual','Entitlement ÷ 12, credited on the last calendar day of the month, stored to 4 decimals. Joiners are prorated on calendar days in their first month.','<span style="font-size:12.5px;font-weight:700">Last day of month</span>')
     +_lvRow('Prorate joiners','A person who joins mid-month accrues for the days they were employed.',_lvTog('prorate_joiners',s.prorate_joiners!==false))
     +_lvRow('Accrue during unpaid leave','<b>Off (UAE practice, People manual)</b>: approved unpaid days are taken out of the month’s service days. <b>On (spec)</b>: accrual continues in full.',_lvTog('accrue_during_unpaid',!!s.accrue_during_unpaid))
     +_lvRow('Accrue during probation','Annual leave accrues from day one (UAE law: leave is earned from the start; usable per the switch below).',_lvTog('accrue_on_probation',s.accrue_on_probation!==false))
     +_lvRow('Usable during probation','People on probation may request annual leave against what they have accrued.',_lvTog('probation_use_annual',s.probation_use_annual!==false)))
   +_lvCard('Statutory floor',
      _lvRow('Check the statutory minimum','Entitlement = the higher of the policy band (22 / 26 working days) and the statutory minimum converted to working days (30 calendar days × workdays ÷ 7 → 25.7 for a 6-day week, 21.4 for a 5-day week).',_lvTog('statutory_floor_check',s.statutory_floor_check!==false))
     +_lvRow('Statutory minimum','UAE: 30 calendar days per year of service (Art. 29).',_lvNum('statutory_min_calendar_days',s.statutory_min_calendar_days,'calendar days',0,60)))
   +_lvCard('Advance (negative balance)',
      _lvRow('Allow leave in advance of accrual','A person may book more than they have accrued, up to the cap.',_lvTog('advance_allowed',s.advance_allowed!==false))
     +_lvRow('Advance cap','<b>Projected</b>: what they will have accrued by 31 December. <b>Fixed</b>: the number of days below.',_lvSel('advance_cap',s.advance_cap,[['projected','Projected year-end accrual'],['fixed','Fixed number of days']]))
     +(s.advance_cap==='fixed'?_lvRow('Fixed cap','',_lvNum('advance_cap_days',s.advance_cap_days,'days',0,60)):'')
     +_lvRow('Escalate to Head of People when negative by','A request that would take the balance this far below zero also needs Head of People (added to the flow automatically).',_lvNum('advance_escalation_days',s.advance_escalation_days,'days',0,60)))
   +_lvCard('Sandwich rule',
      _lvRow('Rest days & public holidays inside a leave','<b>Not consumed</b> (default, holidays-first): a Sat–Mon request on a 5-day week uses 2 days. <b>Consumed</b>: every calendar day counts. Types with unit = calendar days always count every day.',_lvSel('sandwich',s.sandwich,[['not_consumed','Not consumed'],['consumed','Consumed']])))
   +_lvCard('Unpaid leave',
      _lvRow('Only when annual leave is used up','UAE law does not require this (Art. 33 — by agreement); the People manual does. Applies to the Unpaid type.',_lvTog('unpaid_requires_annual_exhausted',!!s.unpaid_requires_annual_exhausted)));
}
/* ── Year-end ── */
function _lvAdmYearEnd(s){
  return _lvCard('Carry forward',
      _lvRow('Carry-forward cap','Unused annual leave carried into the next year, per person (policy: 5 days).',_lvNum('carry_forward_cap_days',s.carry_forward_cap_days,'days',0,60))
     +_lvRow('Never more than half the entitlement','Cabinet Resolution 1/2022 Art. 19: at most half the annual leave may be carried over.',_lvTog('carry_max_half_entitlement',s.carry_max_half_entitlement!==false))
     +_lvRow('Carried days expire on','Carried days must be used by this date (end of Q1) or they are forfeited by the server job.',_lvTxt('carried_expiry_mmdd',s.carried_expiry_mmdd,80)))
   +_lvCard('Forfeiture',
      _lvRow('Forfeiture run date','The year-end run (Leaves → Reports → Year-end) is expected on this date; it can be deferred.',_lvTxt('forfeiture_run_mmdd',s.forfeiture_run_mmdd,80))
     +_lvRow('Pre-forfeiture report','Days before the run that People and managers are reminded of balances above the cap.',_lvNum('pre_forfeiture_days_before',s.pre_forfeiture_days_before,'days',0,180))
     +_lvRow('If no decision is recorded','What happens to days above the cap when nobody decided (schedule / carry exception / encash) before the run.',_lvSel('no_decision_default',s.no_decision_default,[['carry_forward_pending_decision','Carry forward, flag as pending decision'],['forfeit','Forfeit'],['encash','Encash']])))
   +_lvCard('Encashment',
      _lvRow('Encashment while in service','UAE: allowed by agreement. (KSA: off by default.)',_lvTog('encashment_in_service',s.encashment_in_service!==false))
     +_lvRow('In-service rate basis','',_lvSel('encashment_rate_basis',s.encashment_rate_basis,[['monthly_gross_30','Monthly gross ÷ 30'],['basic_30','Basic wage ÷ 30']]))
     +_lvRow('Exit settlement basis','UAE Art. 29(9): unused leave on exit is paid at the basic wage.',_lvSel('exit_settlement_basis',s.exit_settlement_basis,[['basic_wage','Basic wage ÷ 30'],['monthly_gross_30','Monthly gross ÷ 30']])));
}
/* ── Approvals & SLA ── */
function _lvAdmApprovals(s){
  const types=_lvTypes();
  const rows=types.map(t=>`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--c-border)"><span style="width:10px;height:10px;border-radius:3px;background:${t.color};flex-shrink:0"></span><div style="min-width:0;flex:1"><div style="font-size:13px;font-weight:700;color:var(--c-text)">${esc(t.name)}</div><div style="font-size:11.5px;color:var(--c-text-3)">${esc(((t.rules||{}).approval||[]).map(l=>(LV_APPROVER_LABEL[l.approver]||_roleOfId(l.approver)||l.approver)+(l.min_days?' (≥'+l.min_days+'d'+(l.or_advance?' / advance':'')+')':'')+(l.on_probation?' (probation)':'')).join(' → ')||'auto-approved')}</div></div>${btn('Edit',`_LVT=null;App._lvTypeEdit('${t.key}');setTimeout(()=>{_LVT.sec='approval';App._lvTypeEdit('${t.key}')},0)`,{variant:'ghost',size:'sm',icon:'edit'})}</div>`).join('');
  return `<div class="ui-card" style="margin-bottom:12px"><div class="ui-card-head"><span class="ui-card-title">Approval flows</span><span style="font-size:11px;color:var(--c-text-3)">per leave type</span></div><div class="ui-card-pad" style="padding-top:2px">${rows}<p style="font-size:11.5px;color:var(--c-text-3);margin-top:10px;line-height:1.5">Starting point (Q4): annual leave up to 5 days → reporting manager only; 6+ days, or an advance beyond the threshold → manager then Head of People; all other types as listed.</p></div></div>`
   +_lvCard('Service levels',
      _lvRow('Decision SLA','A request waiting longer than this is flagged in the inbox and the approvers + Head of People are nudged once by the server.',_lvNum('sla_days',s.sla_days,'days',1,30))
     +_lvRow('Bulk approve / reject','Approvers can tick several requests and decide them in one go.',_lvTog('bulk_approve',s.bulk_approve!==false))
     +_lvRow('“Starts tomorrow” reminder','The person and their manager are told the day before an approved leave begins.',_lvNum('notify_upcoming_days',s.notify_upcoming_days,'day(s) before',0,7)));
}
/* ── Roles ── */
function _lvAdmRoles(){
  const R=[['head_of_people','Head of People','Full leave control incl. compensation view/update, year-end, config.'],['people_admin','People Admin','Applies on behalf, approves, adjusts balances, configures — no compensation.'],['finance','Finance','Balances and liability reports, export — no documents, no approvals.'],['manager','Team Lead / Manager','Their team: view, apply on behalf, approve, export.'],['basic','Basic Employee','Own leave: view and apply.']];
  const rows=R.map(([id,name,desc])=>{const ppl=_lvUsersWithRole(id);return `<div style="display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-top:1px solid var(--c-border)"><div style="min-width:0;flex:1"><div style="font-size:13px;font-weight:700;color:var(--c-text)">${name} <span style="font-weight:500;color:var(--c-text-3)">· ${ppl.length}</span></div><div style="font-size:11.5px;color:var(--c-text-3);line-height:1.45">${desc}</div><div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">${ppl.slice(0,8).map(u=>`<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;background:var(--c-surface-2);border-radius:20px;padding:2px 8px 2px 2px">${avatar(u,'w-4 h-4','text-[7px]')}${esc(fullName(u))}</span>`).join('')}${ppl.length>8?'<span style="font-size:11px;color:var(--c-text-3)">+'+(ppl.length-8)+'</span>':''}</div></div></div>`;}).join('');
  return `<div class="ui-card"><div class="ui-card-head"><span class="ui-card-title">Built-in roles for leave</span>${can('accessControl','view')?btn('Access Control',"App.go('accesscontrol')",{variant:'ghost',size:'sm',icon:'shield'}):''}</div><div class="ui-card-pad" style="padding-top:2px">${rows}<p style="font-size:11.5px;color:var(--c-text-3);margin-top:10px;line-height:1.5">Assign roles under People → open profile → Access, or Access Control. The old HR role keeps working as People Admin; Administrators approve and configure but never see compensation. Super admin sees everything.</p></div></div>`;
}
/* ── Audit ── */
async function _lvLoadAudit(force){if(_lvLoaded.audit&&!force)return;_lvLoaded.audit=true;try{const{data}=await sb.from('leave_config_audit').select('*').order('at',{ascending:false}).limit(200);DB.leaveAudit=data||[];rr();}catch(e){}}
function _lvAdmAudit(){
  const rows=(DB.leaveAudit||[]).map(a=>{const by=a.actor?fullName(uById(a.actor)):'System';const b=a.before==null?'—':(typeof a.before==='object'?JSON.stringify(a.before):String(a.before));const af=a.after==null?'—':(typeof a.after==='object'?JSON.stringify(a.after):String(a.after));
    return `<div style="padding:8px 0;border-top:1px solid var(--c-border)"><div style="font-size:12.5px;font-weight:700;color:var(--c-text)">${esc(a.area)}${a.field?' · '+esc(a.field):''} <span style="font-weight:500;color:var(--c-text-3)">· ${esc(by)} · ${new Date(a.at).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span></div><div style="font-size:11px;color:var(--c-text-3);font-family:ui-monospace,monospace;overflow-wrap:anywhere;max-height:60px;overflow:hidden">${esc(b).slice(0,160)} → ${esc(af).slice(0,160)}</div>${a.note?`<div style="font-size:11px;color:var(--c-text-2)">${esc(a.note)}</div>`:''}</div>`;}).join('');
  return `<div class="ui-card"><div class="ui-card-head"><span class="ui-card-title">Configuration audit</span><span style="font-size:11px;color:var(--c-text-3)">actor · before → after</span></div><div class="ui-card-pad" style="padding-top:2px">${rows||'<div style="padding:14px 0;font-size:12.5px;color:var(--c-text-3)">No changes recorded yet.</div>'}</div></div>`;
}

/* ═══════════════ BALANCES (People / HoP / Finance) ═══════════════ */
function _lvBalancesTab(){
  const people=_lvScopeUsers();const types=_lvTypes();
  const dep=S.filters.lvBalDep||'',loc=S.filters.lvBalLoc||'',q=(S.filters.lvBalQ||'').toLowerCase();const asOf=S.filters.lvAsOf||todayISO();
  const list=people.filter(p=>(!dep||p.department===dep)&&(!loc||p.locationId===loc)&&(!q||fullName(p).toLowerCase().includes(q)));
  const cols=types.filter(t=>t.rules.entitlement_days!=null||t.rules.accrues||t.rules.source);
  const sel=S.filters.lvBalSel||{};const nSel=list.filter(p=>sel[p.id]&&p.id!==S.uid).length;const canAdj=can('leave','adjust');
  const filters=`<div class="lv-filters" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;align-items:center"><input id="lv-bq" class="ui-input" placeholder="Search…" value="${esc(S.filters.lvBalQ||'')}" oninput="S.filters.lvBalQ=this.value;App._searchRR('lv-bq')" style="width:150px;padding:6px 10px"/><select class="ui-select" style="width:auto;padding:6px 26px 6px 10px" onchange="S.filters.lvBalDep=this.value;rr()"><option value="">All departments</option>${topDepts().map(d=>`<option ${dep===d.name?'selected':''}>${esc(d.name)}</option>`).join('')}</select><select class="ui-select" style="width:auto;padding:6px 26px 6px 10px" onchange="S.filters.lvBalLoc=this.value;rr()"><option value="">All locations</option>${(DB.locations||[]).map(l=>`<option value="${l.id}" ${loc===l.id?'selected':''}>${esc(l.name)}</option>`).join('')}</select><span style="font-size:12px;color:var(--c-text-3)">as of</span><input type="date" class="ui-input" value="${asOf}" style="width:auto;padding:6px 10px" onchange="S.filters.lvAsOf=this.value;rr()"/><span style="flex:1"></span>${canAdj?(nSel?btn('Adjust '+nSel+' selected',`App._lvAdjust(Object.keys(S.filters.lvBalSel).filter(k=>S.filters.lvBalSel[k]))`,{variant:'primary',size:'sm',icon:'edit'})+btn('Clear','S.filters.lvBalSel={};rr()',{variant:'subtle',size:'sm'}):btn('Select all','S.filters.lvBalSel={};_lvScopeUsers().forEach(p=>{if(p.id!==S.uid)S.filters.lvBalSel[p.id]=true});rr()',{variant:'subtle',size:'sm'})):''}${can('leave','export')?btn('CSV','App._lvBalCsv()',{variant:'ghost',size:'sm',icon:'download'}):''}</div>`;
  const rows=list.map(p=>{const cells=cols.map(t=>{const B=_lvBalance(p.id,t.key,asOf);if(!B)return '<td></td>';const v=B.unlimited?'∞':_lvN(B.available);const neg=!B.unlimited&&B.available<0;return `<td data-label="${esc(t.name)}" style="padding:7px 8px;border-top:1px solid var(--c-border);text-align:right;white-space:nowrap"><button onclick="App._lvLedger('${p.id}','${t.key}')" style="background:none;border:none;cursor:pointer;font-weight:800;font-size:13px;color:${neg?'#A63528':'var(--c-text)'}" title="Accrued ${B.accrued==null?'—':_lvN(B.accrued)} · booked ${_lvN(B.booked+B.pending)}${B.projectedAvailable!=null?' · '+_lvN(B.projectedAvailable)+' by year end':''}">${v}</button>${B.booked+B.pending?`<div style="font-size:10px;color:var(--c-text-3)">${_lvN(B.booked+B.pending)} booked</div>`:''}</td>`;}).join('');
    return `<tr><td data-label="Person" style="padding:7px 10px;border-top:1px solid var(--c-border)"><div style="display:flex;align-items:center;gap:8px;min-width:0">${canAdj&&p.id!==S.uid?`<input type="checkbox" ${sel[p.id]?'checked':''} onchange="S.filters.lvBalSel=S.filters.lvBalSel||{};S.filters.lvBalSel['${p.id}']=this.checked;rr()"/>`:''}${avatar(p,'w-7 h-7','text-[9px]')}<div style="min-width:0"><button onclick="S.filters.lvTab='team';S.filters.lvPerson='${p.id}';rr()" style="font-size:12.5px;font-weight:700;color:var(--c-text);background:none;border:none;padding:0;cursor:pointer;text-align:left">${esc(fullName(p))}</button><div style="font-size:10.5px;color:var(--c-text-3)">${esc(p.department||'')}${p.joiningDate?'':' · <span style="color:#7C5A26">no joining date</span>'}</div></div></div></td>${cells}<td style="padding:7px 6px;border-top:1px solid var(--c-border);text-align:right">${can('leave','adjust')&&p.id!==S.uid?btn('',`App._lvAdjust('${p.id}')`,{variant:'subtle',size:'sm',icon:'edit',attrs:'title="Adjust balance"'}):''}</td></tr>`;}).join('');
  window._lvBalLast={cols:['Person','Employee ID','Department'].concat(cols.map(t=>t.name+' available'),cols.map(t=>t.name+' booked')),rows:list.map(p=>[fullName(p),p.employeeId||'',p.department||''].concat(cols.map(t=>{const B=_lvBalance(p.id,t.key,asOf);return B?(B.unlimited?'':_lvN(B.available)):'';}),cols.map(t=>{const B=_lvBalance(p.id,t.key,asOf);return B?_lvN(B.booked+B.pending):'';})))};
  const sum=cols.map(t=>{let n=0;list.forEach(p=>{const B=_lvBalance(p.id,t.key,asOf);if(B&&!B.unlimited)n+=B.available;});return n;});
  return filters+`<div class="ui-card"><div class="ui-card-head"><span class="ui-card-title">${list.length} people · available as of ${fmtD(asOf)}</span><span style="font-size:11px;color:var(--c-text-3)">tap a number for the ledger</span></div><div class="att-rep-wrap" style="overflow-x:auto"><table class="ui-table att-rep lv-baltable" style="width:100%;font-size:12.5px"><thead><tr><th style="text-align:left;padding:8px 10px;font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--c-text-3)">Person</th>${cols.map(t=>`<th style="text-align:right;padding:8px 8px;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:${t.color};line-height:1.2">${esc(t.name.replace(/ leave$/i,''))}</th>`).join('')}<th></th></tr></thead><tbody>${rows||`<tr><td colspan="${cols.length+2}" style="padding:18px;text-align:center;color:var(--c-text-3)">Nobody matches</td></tr>`}</tbody><tfoot><tr><td style="padding:8px 10px;border-top:2px solid var(--c-border-2);font-size:11px;font-weight:800;color:var(--c-text-3)">TOTAL</td>${sum.map(n=>`<td style="padding:8px 10px;border-top:2px solid var(--c-border-2);text-align:right;font-weight:800">${_lvN(n)}</td>`).join('')}<td style="border-top:2px solid var(--c-border-2)"></td></tr></tfoot></table></div></div>`;
}
App._lvBalCsv=()=>{if(!can('leave','export'))return;const L=window._lvBalLast;if(!L)return;const csv=[L.cols].concat(L.rows).map(x=>x.map(v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"').join(',')).join('\n');_attDownload(csv,'leave-balances-'+(S.filters.lvAsOf||todayISO())+'.csv');log(fullName(me()),'Exported leave balances','');};
/* Ledger adjustment (opening balance from Keka, correction, encashment…) — People only, never for yourself */
App._lvAdjust=(uid2,typeKey)=>{
  if(!can('leave','adjust'))return toast('You need Leaves → Adjust','err');
  const ids=(Array.isArray(uid2)?uid2:[uid2]).filter(id=>id&&id!==S.uid&&uById(id));if(!ids.length)return toast('You can’t adjust your own balance','err');
  const u=uById(ids[0]);const types=_lvTypes().filter(t=>t.rules.accrues||t.rules.source||t.rules.entitlement_days!=null);
  modalShell({title:ids.length>1?'Adjust '+ids.length+' balances':'Adjust balance',sub:(ids.length>1?ids.map(i=>fullName(uById(i))).slice(0,4).join(', ')+(ids.length>4?' +'+(ids.length-4):''):fullName(u))+' · posted to the append-only ledger with your name',size:'max-w-sm',key:'lv-adjust',
    body:`<div style="display:grid;gap:10px">${selF('Leave type','lv-adj-type',types.map(t=>[t.key,t.name]),typeKey||'annual')}${selF('Entry','lv-adj-kind',[['opening_balance','Opening balance (migration from Keka)'],['adjustment','Adjustment (+ / −)'],['encashment','Encashment (−)'],['carry_forward','Carry forward (+)'],['forfeiture','Forfeiture (−)']],'adjustment')}<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">${fld('Days (negative to deduct)','lv-adj-qty','','number')}${fld('Effective date','lv-adj-date',todayISO(),'date')}</div>${fld('Reason *','lv-adj-why','','text','e.g. Keka balance at 31 Oct 2026')}</div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP(ids.length>1?'Post '+ids.length+' entries':'Post entry',`App._lvAdjustSave(${JSON.stringify(ids).replace(/"/g,'&quot;')})`)});
};
App._lvAdjustSave=async(ids)=>{
  if(!can('leave','adjust'))return;ids=(Array.isArray(ids)?ids:[ids]).filter(id=>id!==S.uid);if(!ids.length)return;
  const type=$('#lv-adj-type')?.value,kind=$('#lv-adj-kind')?.value,qty=Number($('#lv-adj-qty')?.value),date=$('#lv-adj-date')?.value,why=($('#lv-adj-why')?.value||'').trim();
  if(!type||!kind||!qty||!date)return toast('Fill in the days and date','err');if(!why)return toast('A reason is required — it goes in the ledger','err');
  let q=qty;if((kind==='encashment'||kind==='forfeiture')&&q>0)q=-q;if(kind==='carry_forward'&&q<0)q=-q;
  const rows=ids.map(id=>({id:uid('ll'),user_id:id,type_key:type,entry_type:kind,quantity:Math.round(q*1e4)/1e4,effective_date:date,actor:S.uid,reason:why,meta:{manual:true,bulk:ids.length>1}}));
  const{error}=await sb.from('leave_ledger').insert(rows);if(error)return toast('Couldn’t post — '+error.message,'err');
  _lvLedMerge(rows);log(fullName(me()),'Leave balance adjusted',(ids.length>1?ids.length+' people':fullName(uById(ids[0])))+' · '+type+' · '+_lvN(q)+' · '+why);
  ids.forEach(id=>_lvNotify(id,'📒 '+fullName(me())+' posted '+(q>0?'+':'')+_lvN(q)+' days to your '+((_lvType(type)||{name:type}).name.toLowerCase())+' — '+why,'leave:balances','leave_adjusted'));
  S.filters.lvBalSel={};closeModal();toast(rows.length>1?rows.length+' entries posted ✓':'Posted ✓');rr();
};

/* ═══════════════ REPORTS ═══════════════ */
function _lvReportsTab(){
  const rep=S.filters.lvRep||'balance';
  const REPS=[['balance','Leave balance'],['requests','Requests & SLA'],['liability','Liability'],['yearend','Year-end'],['docs','Document expiry']];
  const pills=`<div class="hscroll att-rep-pills" style="display:flex;gap:6px;margin-bottom:12px;padding-bottom:2px">${REPS.map(([k,l])=>`<button class="ui-btn ${rep===k?'ui-btn-primary':'ui-btn-ghost'} ui-btn-sm" onclick="S.filters.lvRep='${k}';rr()">${l}</button>`).join('')}</div>`;
  let body='';const people=_lvScopeUsers();
  if(rep==='balance')body=_lvRepBalance(people);else if(rep==='requests')body=_lvRepRequests(people);else if(rep==='liability')body=_lvRepLiability(people);else if(rep==='yearend')body=_lvRepYearEnd(people);else body=_lvRepDocs(people);
  return pills+body;
}
function _lvRepTable(cols,rows,name){if(typeof _attRepTable==='function'){const h=_attRepTable(cols,rows,name);window._lvRepLast=window._attRepLast;return h.replace(/App\._attRepCsv\('([^']+)'\)/,"App._lvRepCsv('$1')");}return '';}
App._lvRepCsv=(name)=>{if(!can('leave','export'))return toast('You need Leaves → Export','err');const L=window._lvRepLast||window._attRepLast;if(!L)return;const csv=[L.cols].concat(L.rows).map(x=>x.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');_attDownload(csv,name+'-'+todayISO()+'.csv');log(fullName(me()),'Exported report',name);};
function _lvRepBalance(people){
  const asOf=S.filters.lvAsOf||todayISO();const y=asOf.slice(0,4);const lastYear=(Number(y)-1)+asOf.slice(4);
  const rows=[];people.forEach(p=>_lvTypes().filter(t=>t.rules.accrues).forEach(t=>{const B=_lvBalance(p.id,t.key,asOf);if(!B)return;const L=_lvBalance(p.id,t.key,lastYear);rows.push([`<b>${esc(fullName(p))}</b>`,esc(p.department||''),esc(t.name),_lvN(B.entitlement),_lvN(B.accrued),_lvN(B.taken),_lvN(B.booked),_lvN(B.pending),`<b style="color:${B.available<0?'#A63528':'inherit'}">${_lvN(B.available)}</b>`,_lvN(B.projectedAvailable),L?_lvN(L.available):'',_lvN(B.carried)]);}));
  return `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px"><span style="font-size:12px;color:var(--c-text-3)">Point in time</span><input type="date" class="ui-input" value="${asOf}" style="width:auto;padding:6px 10px" onchange="S.filters.lvAsOf=this.value;rr()"/><span style="font-size:11.5px;color:var(--c-text-3)">Accrued · Booked · Available are always shown separately (spec §12).</span></div>`+_lvRepTable(['Person','Department','Type','Entitlement / yr','Accrued','Taken','Booked','Pending','Available','Projected 31 Dec','Same date last year','Carried in'],rows,'leave-balance');
}
function _lvRepRequests(people){
  const ids=new Set(people.map(p=>p.id));const sla=Number(_lvSettings().sla_days||3);const y=todayISO().slice(0,4);
  const list=(DB.leaveRequests||[]).filter(x=>ids.has(x.userId)&&x.from.slice(0,4)>=String(Number(y)-1));
  const rows=list.map(x=>{const p=uById(x.userId);const age=Math.floor((Date.now()-new Date(x.createdAt))/864e5);const dec=x.decidedAt?Math.round((new Date(x.decidedAt)-new Date(x.createdAt))/864e5*10)/10:null;const late=x.status==='Pending'?age>sla:(dec!=null&&dec>sla);
    return [`<b>${esc(fullName(p))}</b>`,esc((_lvType(x.typeKey)||{name:x.typeKey}).name),fmtS(x.from)+(x.to!==x.from?' – '+fmtS(x.to):''),_lvN(x.days),chip(x.status),x.createdAt?fmtS(x.createdAt.slice(0,10)):'',x.status==='Pending'?`<span style="${late?'color:#A63528;font-weight:800':''}">${age}d${late?' — over SLA':''}</span>`:(dec!=null?`<span style="${late?'color:#A63528':''}">${dec}d</span>`:''),esc(_lvWaitingFor(x)||(x.decidedBy?fullName(uById(x.decidedBy)):'')),x.appliedBy?'on behalf':'',x.overrideReason?'yes':''];});
  const n=list.filter(x=>x.status==='Pending'&&Math.floor((Date.now()-new Date(x.createdAt))/864e5)>sla).length;
  return `<div style="font-size:12.5px;color:var(--c-text-2);margin-bottom:10px">Pending over the ${sla}-day SLA: <b style="color:${n?'#A63528':'#346A47'}">${n}</b></div>`+_lvRepTable(['Person','Type','Dates','Days','Status','Raised','Waiting / decided in','Approver','Applied','Notice override'],rows,'leave-requests');
}
/* Liability = available days × daily rate (needs compensation → Head of People / super admin; Finance sees days only) */
function _lvRepLiability(people){
  const canPay=can('leave','viewCompensation');if(canPay&&!_lvLoaded.comp)_lvLoadComp(people.map(p=>p.id));
  const basis=_lvSettings().exit_settlement_basis||'basic_wage';const cur=(_lvSettings().entity||{}).currency||'AED';
  let total=0,totalDays=0;
  const rows=people.map(p=>{const B=_lvBalance(p.id,'annual');if(!B)return null;const c=canPay?(DB.compensation||{})[p.id]:null;const monthly=c?(basis==='basic_wage'?Number(c.basic):Number(c.basic)+Number(c.housing)+Number(c.transport)+Number(c.other)):null;const daily=monthly!=null?monthly/30:null;const amt=daily!=null?Math.max(0,B.available)*daily:null;totalDays+=Math.max(0,B.available);if(amt!=null)total+=amt;
    return [`<b>${esc(fullName(p))}</b>`,esc(p.department||''),esc(p.locationId&&locById(p.locationId)?locById(p.locationId).name:''),_lvN(B.accrued),_lvN(B.available),canPay?(daily!=null?daily.toFixed(2):'<span style="color:var(--c-text-3)">no pay record</span>'):'',canPay?(amt!=null?amt.toFixed(2):''):''];}).filter(Boolean);
  const cols=['Person','Department','Location','Accrued','Available days'].concat(canPay?['Daily rate ('+cur+')','Liability ('+cur+')']:[]);
  return `<div style="font-size:12.5px;color:var(--c-text-2);margin-bottom:10px;line-height:1.5">Annual-leave liability: available days × daily rate (${basis==='basic_wage'?'basic wage':'monthly gross'} ÷ 30 — set under Leave rules → Year-end). ${canPay?`Total: <b>${total.toFixed(2)} ${cur}</b> over ${_lvN(totalDays)} days.`:`<b>${_lvN(totalDays)} days</b> across ${people.length} people. Amounts need compensation access (Head of People).`}</div>`+_lvRepTable(cols,rows,'leave-liability');
}
/* Year-end: pre-forfeiture report, per-person decision, simulation, run */
function _lvRepYearEnd(people){
  const s=_lvSettings();const y=Number(todayISO().slice(0,4));const cap=Number(s.carry_forward_cap_days||0);const dec=(s.yearend_decisions||{})[y]||{};
  const rows=[];let carrySum=0,forfeitSum=0;
  people.forEach(p=>{const t=_lvType('annual');if(!t)return;const B=_lvBalance(p.id,'annual',y+'-12-31');if(!B)return;const bal=Math.max(0,B.projectedAvailable!=null?B.posted+((12-Number(todayISO().slice(5,7)))*B.rate)-B.booked:B.available);
    let capP=cap;if(s.carry_max_half_entitlement!==false)capP=Math.min(capP,B.entitlement/2);
    const d=dec[p.id]||{};const carry=d.action==='carry_exception'?Math.round(bal*100)/100:Math.min(bal,capP);const encash=d.action==='encash'?Math.max(0,bal-capP):0;const forfeit=Math.max(0,bal-carry-encash);
    carrySum+=carry;forfeitSum+=forfeit;
    if(bal<=0)return;
    rows.push([`<b>${esc(fullName(p))}</b>`,esc(p.department||''),_lvN(bal),_lvN(capP),`<b style="color:#346A47">${_lvN(carry)}</b>`,encash?_lvN(encash):'',`<b style="color:${forfeit?'#A63528':'inherit'}">${_lvN(forfeit)}</b>`,can('leave','adjust')?`<select class="ui-select" style="padding:4px 24px 4px 8px;font-size:12px" onchange="App._lvYeDecide('${p.id}',this.value)"><option value="" ${!d.action?'selected':''}>${bal>capP?'No decision':'Within cap'}</option><option value="schedule" ${d.action==='schedule'?'selected':''}>Schedule leave before 31 Dec</option><option value="carry_exception" ${d.action==='carry_exception'?'selected':''}>Carry all (exception)</option><option value="encash" ${d.action==='encash'?'selected':''}>Encash excess</option></select>`:esc(d.action||'')]);});
  const head=`<div class="ui-card" style="margin-bottom:12px"><div class="ui-card-pad" style="display:flex;gap:14px;flex-wrap:wrap;align-items:center"><div style="flex:1;min-width:220px"><div style="font-size:13.5px;font-weight:800;color:var(--c-text)">Year-end ${y} · projected to 31 December</div><div style="font-size:12px;color:var(--c-text-3);line-height:1.5">Cap ${cap} days${s.carry_max_half_entitlement!==false?' (max half the entitlement)':''}, carried days expire ${s.carried_expiry_mmdd}. Run date ${s.forfeiture_run_mmdd}${(s.yearend_runs||{})[y]?' · <b style="color:#346A47">run on '+fmtS((s.yearend_runs||{})[y].at.slice(0,10))+'</b>':''}. Decisions here are saved instantly; the run posts carry-forward and forfeiture entries to every ledger.</div></div><div style="display:flex;gap:6px;flex-wrap:wrap">${btn('Simulate','App._lvYeRun(true)',{variant:'ghost',size:'sm',icon:'eye'})}${can('leave','adjust')&&!(s.yearend_runs||{})[y]?btn('Run year-end','App._lvYeRun(false)',{variant:'primary',size:'sm',icon:'check'}):''}</div></div></div><div class="bb-kpis" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:12px">${[['People above cap',rows.filter(r=>String(r[6]).indexOf('#A63528')>0).length,'#A63528'],['Days carried',_lvN(carrySum),'#346A47'],['Days forfeited',_lvN(forfeitSum),'#A63528']].map(([l,v,c])=>`<div style="background:var(--c-surface);border:1px solid var(--c-border);border-radius:14px;padding:10px 12px"><div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--c-text-3)">${l}</div><div class="fd" style="font-size:20px;font-weight:800;color:${c};margin-top:3px">${v}</div></div>`).join('')}</div>`;
  return head+_lvRepTable(['Person','Department','Projected 31 Dec','Cap','Carry','Encash','Forfeit','Decision'],rows,'leave-yearend');
}
App._lvYeDecide=(uid2,action)=>{if(!can('leave','adjust'))return;const y=todayISO().slice(0,4);const all={...(_lvSettings().yearend_decisions||{})};all[y]={...(all[y]||{}),[uid2]:action?{action,by:S.uid,at:new Date().toISOString()}:undefined};if(!action)delete all[y][uid2];_lvSaveSettings({yearend_decisions:all},'year-end decision').then(()=>toast('Saved'));};
App._lvYeRun=async(simulate)=>{
  const s=_lvSettings();const y=Number(todayISO().slice(0,4));const cap=Number(s.carry_forward_cap_days||0);const dec=(s.yearend_decisions||{})[y]||{};const people=_lvScopeUsers();
  const plan=[];people.forEach(p=>{const B=_lvBalance(p.id,'annual',y+'-12-31');if(!B)return;const bal=Math.max(0,B.posted+((12-Number(todayISO().slice(5,7)))*B.rate)-B.booked);let capP=cap;if(s.carry_max_half_entitlement!==false)capP=Math.min(capP,B.entitlement/2);const d=dec[p.id]||{};const carry=Math.round((d.action==='carry_exception'?bal:Math.min(bal,capP))*1e4)/1e4;const encash=d.action==='encash'?Math.round(Math.max(0,bal-capP)*1e4)/1e4:0;const forfeit=Math.round(Math.max(0,bal-carry-encash)*1e4)/1e4;if(bal>0)plan.push({p,bal,carry,encash,forfeit,decision:d.action||(bal>capP?s.no_decision_default:'within_cap')});});
  const body=`<div style="font-size:12.5px;color:var(--c-text-2);line-height:1.5">${plan.length} people · carry ${_lvN(plan.reduce((n,x)=>n+x.carry,0))} · encash ${_lvN(plan.reduce((n,x)=>n+x.encash,0))} · forfeit ${_lvN(plan.reduce((n,x)=>n+x.forfeit,0))} days.</div><div style="max-height:40vh;overflow:auto;margin-top:8px">${plan.map(x=>`<div style="display:flex;gap:8px;font-size:12px;padding:5px 0;border-top:1px solid var(--c-border)"><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><b>${esc(fullName(x.p))}</b> · ${_lvN(x.bal)}d</span><span style="color:#346A47">+${_lvN(x.carry)} carry</span>${x.encash?`<span>${_lvN(x.encash)} encash</span>`:''}${x.forfeit?`<span style="color:#A63528">−${_lvN(x.forfeit)} forfeit</span>`:''}</div>`).join('')}</div>${simulate?'<p style="font-size:11.5px;color:var(--c-text-3);margin-top:8px">Simulation only — nothing is posted.</p>':'<p style="font-size:11.5px;color:#A63528;margin-top:8px">This posts carry-forward, encashment and forfeiture entries dated 31 Dec '+y+' to every ledger. It cannot be undone (only corrected).</p>'}`;
  if(simulate)return modalShell({title:'Year-end simulation '+y,body,size:'max-w-md',footer:btnP('Close','App.closeModal()')});
  if(!can('leave','adjust'))return;
  if(!(await confirmP({title:'Run year-end '+y+'?',body,confirmLabel:'Run and post',cancelLabel:'Not yet',danger:true,size:'max-w-md'})))return;
  const date=y+'-12-31';const rows=[];
  plan.forEach(x=>{if(x.forfeit>0)rows.push({id:uid('ll'),user_id:x.p.id,type_key:'annual',entry_type:'forfeiture',quantity:-x.forfeit,effective_date:date,actor:S.uid,reason:'Year-end '+y+' forfeiture above cap ('+x.decision+')',meta:{yearend:y,balance:x.bal}});if(x.encash>0)rows.push({id:uid('ll'),user_id:x.p.id,type_key:'annual',entry_type:'encashment',quantity:-x.encash,effective_date:date,actor:S.uid,reason:'Year-end '+y+' encashment',meta:{yearend:y}});if(x.carry>0){rows.push({id:uid('ll'),user_id:x.p.id,type_key:'annual',entry_type:'adjustment',quantity:-x.carry,effective_date:date,actor:S.uid,reason:'Year-end '+y+' close — moved to carry-forward',meta:{yearend:y}});rows.push({id:uid('ll'),user_id:x.p.id,type_key:'annual',entry_type:'carry_forward',quantity:x.carry,effective_date:(y+1)+'-01-01',actor:S.uid,reason:'Carried forward from '+y+' (use by '+(y+1)+'-'+s.carried_expiry_mmdd+')',meta:{yearend:y,expires:(y+1)+'-'+s.carried_expiry_mmdd}});}});
  for(let i=0;i<rows.length;i+=100){const{error}=await sb.from('leave_ledger').insert(rows.slice(i,i+100));if(error)return toast('Stopped — '+error.message,'err');}
  _lvLedMerge(rows);await _lvSaveSettings({yearend_runs:{...(s.yearend_runs||{}),[y]:{at:new Date().toISOString(),by:S.uid,people:plan.length}}},'year-end run');
  log(fullName(me()),'Leave year-end run',y+' · '+plan.length+' people');plan.forEach(x=>_lvNotify(x.p.id,'📆 Year-end '+y+': '+_lvN(x.carry)+' days carried forward'+(x.forfeit?', '+_lvN(x.forfeit)+' forfeited':'')+(x.encash?', '+_lvN(x.encash)+' encashed':'')+'.','leave:balances','leave_adjusted'));
  toast('Year-end posted ✓');rr();
};
function _lvRepDocs(people){
  const rows=[];const today=todayISO();
  people.forEach(p=>((DB.profileDocs&&DB.profileDocs[p.id])||[]).forEach(d=>{if(!d.expiryDate)return;const left=Math.round((new Date(d.expiryDate)-new Date(today))/864e5);if(left>120)return;rows.push([`<b>${esc(fullName(p))}</b>`,esc(p.department||''),esc(d.category||''),esc(d.name||''),fmtS(d.expiryDate),`<span style="${left<0?'color:#A63528;font-weight:800':left<30?'color:#7C5A26;font-weight:700':''}">${left<0?'expired '+(-left)+'d ago':left+' days'}</span>`]);}));
  return `<p style="font-size:12px;color:var(--c-text-3);margin-bottom:10px">Documents expiring within 120 days (from each profile’s Documents tab). Loads as profiles are opened; the server reminds at 90 / 60 / 30 / 7 / 0 days.</p>`+_lvRepTable(['Person','Department','Category','Document','Expires','In'],rows,'document-expiry');
}

/* ═══════════════ COMPENSATION (Head of People + super admin — data-layer enforced) ═══════════════ */
async function _lvLoadComp(ids){
  if(!can('leave','viewCompensation'))return;_lvLoaded.comp=true;
  try{const{data,error}=await sb.from('compensation').select('*').in('user_id',ids||[]);if(!error){DB.compensation=DB.compensation||{};(data||[]).forEach(c=>DB.compensation[c.user_id]=c);rr();}}catch(e){}
}
function _lvCompCard(u,P){
  if(!can('leave','viewCompensation')||u.id===S.uid)return '';
  if(!DB.compensation||!(u.id in (DB.compensation||{}))){if(!_lvLoaded['comp:'+u.id]){_lvLoaded['comp:'+u.id]=true;_lvLoadComp([u.id]).then(()=>{DB.compensation=DB.compensation||{};if(!(u.id in DB.compensation))DB.compensation[u.id]=null;rr();});}}
  const c=(DB.compensation||{})[u.id];const cur=c?c.currency:((_lvSettings().entity||{}).currency||'AED');
  const gross=c?Number(c.basic)+Number(c.housing)+Number(c.transport)+Number(c.other):0;
  const inner=c?_profKV([['Basic',Number(c.basic).toLocaleString()+' '+cur],['Housing',Number(c.housing).toLocaleString()+' '+cur],['Transport',Number(c.transport).toLocaleString()+' '+cur],['Other',Number(c.other).toLocaleString()+' '+cur],['Monthly gross',`<b>${gross.toLocaleString()} ${cur}</b>`],['Effective from',c.effective_from?fmtD(c.effective_from):'—']])+(c.history&&c.history.length?`<div style="font-size:11px;color:var(--c-text-3);margin-top:10px">${c.history.length} earlier version${c.history.length>1?'s':''} · last change by ${esc(fullName(uById(c.updated_by))||'—')}</div>`:''):'<div style="font-size:12.5px;color:var(--c-text-3)">No compensation record yet'+(can('leave','editCompensation')?' — add one for liability and encashment figures.':'.')+'</div>';
  return _profCard('Compensation <span style="font-size:10px;font-weight:800;padding:1px 7px;border-radius:20px;background:#F9EBE5;color:#A63528;vertical-align:middle">RESTRICTED</span>',inner,can('leave','editCompensation')?btn(c?'Edit':'Add',`App._lvCompEdit('${u.id}')`,{variant:'ghost',size:'sm',icon:'edit'}):'');
}
App._lvCompEdit=(uid2)=>{
  if(!can('leave','editCompensation'))return toast('Only Head of People can change compensation','err');const u=uById(uid2);const c=(DB.compensation||{})[uid2]||{};
  modalShell({title:'Compensation',sub:fullName(u)+' · every change keeps the previous version',size:'max-w-md',key:'lv-comp',
    body:`<div style="display:grid;gap:10px"><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">${fld('Basic salary','cp-basic',c.basic||'','number')}${fld('Housing allowance','cp-housing',c.housing||'','number')}</div><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">${fld('Transport allowance','cp-transport',c.transport||'','number')}${fld('Other allowances','cp-other',c.other||'','number')}</div><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">${fld('Currency','cp-cur',c.currency||(_lvSettings().entity||{}).currency||'AED')}${fld('Effective from','cp-from',c.effective_from||todayISO(),'date')}</div></div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP('Save',`App._lvCompSave('${uid2}')`)});
};
App._lvCompSave=async(uid2)=>{
  if(!can('leave','editCompensation'))return;const prev=(DB.compensation||{})[uid2]||null;
  const row={user_id:uid2,basic:Number($('#cp-basic')?.value||0),housing:Number($('#cp-housing')?.value||0),transport:Number($('#cp-transport')?.value||0),other:Number($('#cp-other')?.value||0),currency:($('#cp-cur')?.value||'AED').trim(),effective_from:$('#cp-from')?.value||null,history:(prev?(prev.history||[]).concat([{effective_from:prev.effective_from,basic:prev.basic,housing:prev.housing,transport:prev.transport,other:prev.other,currency:prev.currency,changed_by:S.uid,changed_at:new Date().toISOString()}]).slice(-24):[]),updated_by:S.uid,updated_at:new Date().toISOString()};
  const{error}=await sb.from('compensation').upsert(row,{onConflict:'user_id'});if(error)return toast('Couldn’t save — '+error.message,'err');
  DB.compensation=DB.compensation||{};DB.compensation[uid2]=row;log(fullName(me()),'Compensation updated',fullName(uById(uid2)));closeModal();toast('Saved ✓');rr();
};
/* Employment status (active / notice / exit) — read by leave rules (during_notice_period) */
App._lvEmpStatus=async(uid2,v)=>{const u=uById(uid2);if(!u)return;const P=_profPerm(u);if(!P.editHr)return toast('You need Users → Edit HR details','err');const d={...(u.details||{}),employmentStatus:v};u.details=d;if(await _profSave(u,{details:d},'employment status'))toast('Saved');};
