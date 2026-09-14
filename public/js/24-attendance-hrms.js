/* ============================================================
   Bridge — 24-attendance-hrms.js  (v133)
   HRMS Phase 1 · Attendance: public holidays · requests
   (regularisation, partial day, on-duty, comp off) · manager
   inbox · open-shift resolution · reports.
   Classic script: shares top-level scope with the other /js files.
   Loads after 21-attendance.js (which calls into it at runtime).
   ============================================================ */

/* ═══════════════ PUBLIC HOLIDAYS (spec §4.2) ═══════════════ */
function _mHol(r){return{id:r.id,date:r.date,name:r.name||'',locationId:r.location_id||null,createdBy:r.created_by||null};}
async function _attLoadHolidays(force){
  if(!S.uid||(_attLoaded.holidays&&!force))return;_attLoaded.holidays=true;
  try{const{data,error}=await sb.from('public_holidays').select('*').order('date');if(!error){DB.holidays=(data||[]).map(_mHol);rr();}}
  catch(e){_attLoaded.holidays=false;console.warn('[att] holidays',e.message);}
}
function _attHolidaysCard(){
  const yr=S.filters.attHolYear||todayISO().slice(0,4);
  const list=(DB.holidays||[]).filter(h=>h.date.slice(0,4)===yr).sort((a,b)=>a.date.localeCompare(b.date));
  const rows=list.map(h=>{const l=h.locationId?locById(h.locationId):null;return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--c-border)"><div style="min-width:0;flex:1"><div style="font-size:13px;font-weight:700;color:var(--c-text)">${esc(h.name)}</div><div style="font-size:11.5px;color:var(--c-text-3)">${fmtD(h.date)} · ${dayAbbr(h.date)} · ${l?esc(l.name):'All locations'}${h.date<todayISO()?'':' · upcoming'}</div></div>${btn('',`App._attHolDel('${h.id}')`,{variant:'subtle',size:'sm',icon:'trash',attrs:'title="Remove"'})}</div>`;}).join('');
  const years=[String(Number(yr)-1),yr,String(Number(yr)+1)];
  return `<div class="ui-card" style="margin-bottom:12px"><div class="ui-card-head"><span class="ui-card-title">Public holidays</span><div style="display:flex;gap:6px;align-items:center"><select class="ui-select" style="width:auto;padding:5px 26px 5px 10px;font-size:12px" onchange="S.filters.attHolYear=this.value;rr()">${years.map(y=>`<option ${y===yr?'selected':''}>${y}</option>`).join('')}</select>${btn('Add holiday','App._attHolAdd()',{variant:'primary',size:'sm',icon:'plus'})}</div></div>
    <div class="ui-card-pad" style="padding-top:2px">${rows||'<div style="padding:14px 0;font-size:12.5px;color:var(--c-text-3)">No holidays for '+yr+' yet. Add them as they are announced — leave and absence for those dates recalculate automatically, and nobody is expected to clock in.</div>'}
    <p style="font-size:11.5px;color:var(--c-text-3);margin-top:10px;line-height:1.5">A holiday for “All locations” applies to everyone; pick a location to limit it (e.g. a KSA-only holiday). Working on a holiday raises a comp-off request, like a rest day.</p></div></div>`;
}
App._attHolAdd=()=>{
  if(!can('attendance','manage'))return toast('You need Attendance → Manage','err');
  modalShell({title:'Add public holiday',sub:'Announced late? That’s fine — approved leave across the date is recalculated.',size:'max-w-md',key:'att-hol',
    body:`<div style="display:grid;gap:10px">${fld('Name','ah-name','','text','e.g. Eid Al Fitr')}<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">${fld('From','ah-from',todayISO(),'date')}${fld('To (optional, for multi-day)','ah-to','','date')}</div>${selF('Applies to','ah-loc',[['','All locations'],...(DB.locations||[]).filter(l=>l.status!=='Inactive').map(l=>[l.id,l.name])],'')}</div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP('Add','App._attHolSave()')});
};
App._attHolSave=async()=>{
  if(!can('attendance','manage'))return;
  const name=($('#ah-name')?.value||'').trim(),from=$('#ah-from')?.value,to=$('#ah-to')?.value||from,locId=$('#ah-loc')?.value||null;
  if(!name||!from)return toast('Name and date are required','err');
  const days=_attDaysBetween(from,to<from?from:to);
  const rows=days.map(d=>({id:uid('ph'),date:d,name,location_id:locId,created_by:S.uid}));
  const{error}=await sb.from('public_holidays').insert(rows);
  if(error)return toast('Couldn’t save — '+error.message,'err');
  DB.holidays=(DB.holidays||[]).concat(rows.map(_mHol));
  log(fullName(me()),'Public holiday added',name+' · '+from+(to!==from?' – '+to:'')+(locId?' · '+(locById(locId)||{}).name:''));
  closeModal();toast('Holiday added ✓');rr();
};
App._attHolDel=async(id)=>{
  if(!can('attendance','manage'))return toast('You need Attendance → Manage','err');
  const h=(DB.holidays||[]).find(x=>x.id===id);if(!h)return;
  if(!(await confirmP({title:'Remove this holiday?',body:'<b>'+esc(h.name)+'</b> · '+esc(fmtD(h.date))+'<br><span style="font-size:12px;color:var(--c-text-3)">The date becomes a normal working day again for everyone it applied to.</span>',confirmLabel:'Remove',cancelLabel:'Keep it'})))return;
  DB.holidays=DB.holidays.filter(x=>x.id!==id);rr();
  const{error}=await sb.from('public_holidays').delete().eq('id',id);
  if(error){DB.holidays.push(h);rr();return toast('Couldn’t remove — '+error.message,'err');}
  log(fullName(me()),'Public holiday removed',h.name+' · '+h.date);
};

/* ═══════════════ ATTENDANCE REQUESTS (spec §9.5, §9.6) ═══════════════ */
const ATT_REQ_TYPES={
  regularisation:{label:'Fix a punch',desc:'I forgot to clock in / out, or the time is wrong',icon:'edit'},
  partial_day:{label:'Partial day',desc:'Late arrival or early leave, agreed in advance',icon:'clock'},
  on_duty:{label:'On duty',desc:'Working off-site: client visit, delivery, bank, supplier',icon:'pin'},
  comp_off:{label:'Comp off',desc:'Worked on a rest day or public holiday',icon:'flag'}};
function _mReq(r){return{id:r.id,userId:r.user_id,type:r.type,date:r.date,dateTo:r.date_to||null,payload:(r.payload&&typeof r.payload==='object')?r.payload:{},reason:r.reason||'',status:r.status||'Pending',decidedBy:r.decided_by||null,decidedAt:r.decided_at||null,decisionNote:r.decision_note||'',createdBy:r.created_by||null,createdAt:r.created_at||null};}
function _attReqMerge(rows){DB.attRequests=DB.attRequests||[];const by=new Map(DB.attRequests.map(r=>[r.id,r]));(rows||[]).forEach(r=>by.set(r.id,_mReq(r)));DB.attRequests=[...by.values()].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));}
async function _attLoadRequests(force){
  if(!S.uid||(_attLoaded.reqs&&!force))return;_attLoaded.reqs=true;
  try{
    const from=new Date(Date.now()-120*864e5).toISOString().slice(0,10);
    const ids=_attScopeUsers().map(u=>u.id);if(!ids.includes(S.uid))ids.push(S.uid);
    const q=ids.length<=200?sb.from('attendance_requests').select('*').in('user_id',ids).gte('date',from):sb.from('attendance_requests').select('*').gte('date',from);
    const{data,error}=await q.order('created_at',{ascending:false});
    if(!error)_attReqMerge(data);
    // Open sessions for everyone in scope (any date) — the inbox and the Verification report must see them even for
    // people whose month hasn't been opened yet.
    if(ids.length<=200&&ids.length>1){const o=await sb.from('attendance').select('*').in('user_id',ids).is('clock_out_at',null).not('clock_in_at','is',null);if(!o.error)_attMerge(o.data);}
    rr();
  }catch(e){_attLoaded.reqs=false;console.warn('[att] requests',e.message);}
}
function _attReqLabel(r){const t=ATT_REQ_TYPES[r.type]||{label:r.type};const p=r.payload||{};if(r.type==='partial_day')return (p.kind==='early_leave'?'Early leave':'Late arrival')+(p.time?' · '+p.time:'');if(r.type==='regularisation')return 'Fix punch · '+(p.in||'—')+' → '+(p.out||'—');if(r.type==='on_duty')return 'On duty'+(p.where?' · '+p.where:'');if(r.type==='comp_off')return 'Comp off · '+(p.minutes?_attFmtMins(p.minutes):'in progress');return t.label;}
function _attReqCount(uid2,type,ym){return (DB.attRequests||[]).filter(r=>r.userId===uid2&&r.type===type&&r.date.slice(0,7)===ym&&r.status!=='Rejected'&&r.status!=='Cancelled').length;}
function _attRegularisable(d){const w=Number(_attSettings().regularisation_window_days||0);if(!w)return true;const lim=new Date(d+'T00:00:00');lim.setDate(lim.getDate()+w);return new Date()<=new Date(_attISO(lim)+'T23:59:59');}
/* Who decides: anyone with Attendance → Approve (or Edit) whose scope covers the person — never for themselves. */
function _attCanResolveFor(uid2){return !!uid2&&uid2!==S.uid&&(can('attendance','approve')||can('attendance','edit'))&&scopeFilter('attendance')(uid2);}
function _attApproversFor(u){
  // Manager first (spec: RM), else anyone in the org who can approve for this person — capped so a misconfigured role can't spam everyone.
  const out=[];if(u.managerId&&u.managerId!==u.id)out.push(u.managerId);
  if(!out.length)(DB.users||[]).filter(x=>x.status==='Active'&&x.id!==u.id&&canUser(x,'attendance','approve')).slice(0,3).forEach(x=>out.push(x.id));
  return out;
}
function _attNotifyApprovers(u,text,link){_attApproversFor(u).forEach(id=>{_attNotify(id,text,link,'attendance','attendance_request');try{if(typeof sendEmail==='function')sendEmail('attendance_request',id,{req_user:fullName(u),request:text}).catch(()=>{});}catch(e){}});}

/* ── New request (employee) ── */
App._attReqNew=(type,date)=>{
  const u=me();if(!u)return;
  if(!_attEnabled())return toast('Attendance isn’t switched on yet','warn');
  if(!can('attendance','clock'))return toast('Your role can’t use attendance requests','err');
  const st=_attSettings();const d=date||todayISO();const ym=d.slice(0,7);
  const pick=type||S.filters.attReqType||'regularisation';S.filters.attReqType=pick;
  const cards=Object.keys(ATT_REQ_TYPES).filter(k=>k!=='comp_off').map(k=>`<button onclick="App._attReqNew('${k}','${d}')" class="ui-btn ${pick===k?'ui-btn-primary':'ui-btn-ghost'} ui-btn-sm" style="justify-content:center;white-space:normal;line-height:1.2;min-height:40px">${ATT_REQ_TYPES[k].label}</button>`).join('');
  let form='',note='';
  if(pick==='regularisation'){
    const used=_attReqCount(S.uid,'regularisation',ym),cap=Number(st.regularisation_monthly_cap||0);
    const rs=_attRowsFor(S.uid,d);const first=rs[0],last=rs[rs.length-1];
    note=`<div style="font-size:11.5px;color:var(--c-text-3);line-height:1.5">${cap?used+' of '+cap+' used this month · ':''}${st.regularisation_window_days?'must be within '+st.regularisation_window_days+' day'+(st.regularisation_window_days>1?'s':'')+' of the date':''}. Your original punch is kept alongside the correction.</div>`;
    form=`${fld('Date','ar-date',d,'date')}<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">${fld('Clock in should be','ar-in',first?new Date(first.inAt).toTimeString().slice(0,5):'','time')}${fld('Clock out should be','ar-out',last&&last.outAt?new Date(last.outAt).toTimeString().slice(0,5):'','time')}</div>`;
  }else if(pick==='partial_day'){
    const used=_attReqCount(S.uid,'partial_day',ym),cap=Number(st.partial_day_instances_per_month||0);
    note=`<div style="font-size:11.5px;color:var(--c-text-3);line-height:1.5">${cap?used+' of '+cap+' used this month. ':''}Approved, the day is not flagged late / early.</div>`;
    form=`${fld('Date','ar-date',d,'date')}${selF('Type','ar-kind',[['late_arrival','Late arrival'],['early_leave','Early leave']],'late_arrival')}${fld('Arriving / leaving at','ar-time','','time')}`;
  }else if(pick==='on_duty'){
    note=`<div style="font-size:11.5px;color:var(--c-text-3);line-height:1.5">Approved on-duty days count as worked, need no geofence, and are never marked absent or late.</div>`;
    form=`<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">${fld('From','ar-date',d,'date')}${fld('To','ar-to',d,'date')}</div>${fld('Where / what','ar-where','','text','e.g. Client visit — Al Quoz')}`;
  }
  modalShell({title:'Attendance request',sub:'Goes to your manager for approval',size:'max-w-md',key:'att-req',
    body:`<div style="display:grid;gap:12px"><div class="att-req-pick" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px">${cards}</div><div style="font-size:12px;color:var(--c-text-3)">${esc(ATT_REQ_TYPES[pick].desc)}</div>${form}${fld('Reason *','ar-reason','')}${note}</div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP('Send request',`App._attReqSubmit('${pick}')`)});
};
App._attReqSubmit=async(type)=>{
  const u=me();if(!u)return;const st=_attSettings();
  const d=$('#ar-date')?.value,reason=($('#ar-reason')?.value||'').trim();
  if(!d)return toast('Pick a date','err');if(!reason)return toast('A reason is required','err');
  const ym=d.slice(0,7);const payload={};let dateTo=null;
  if(type==='regularisation'){
    if(d>todayISO())return toast('You can only fix a past or current day','err');
    if(!_attRegularisable(d))return toast('Too late — punches can only be corrected within '+st.regularisation_window_days+' day(s) of the date. Ask HR.','err');
    const cap=Number(st.regularisation_monthly_cap||0);if(cap&&_attReqCount(S.uid,'regularisation',ym)>=cap)return toast('You’ve used all '+cap+' regularisations for this month — ask HR','err');
    payload.in=$('#ar-in')?.value||'';payload.out=$('#ar-out')?.value||'';
    if(!payload.in)return toast('Enter the clock-in time','err');
    if(payload.out&&payload.out<=payload.in)payload.overnight=true;   // night shift: clock-out is on the next day
    const rs=_attRowsFor(S.uid,d);if(rs[0]){payload.attendance_id=rs[0].id;payload.original={in:rs[0].inAt,out:rs[rs.length-1].outAt||null};}
    if((DB.attRequests||[]).some(r=>r.userId===S.uid&&r.type==='regularisation'&&r.date===d&&r.status==='Pending'))return toast('You already have a pending fix for this date','warn');
  }else if(type==='partial_day'){
    const cap=Number(st.partial_day_instances_per_month||0);if(cap&&_attReqCount(S.uid,'partial_day',ym)>=cap)return toast('You’ve used all '+cap+' partial-day requests for this month','err');
    payload.kind=$('#ar-kind')?.value||'late_arrival';payload.time=$('#ar-time')?.value||'';
    if(!payload.time)return toast('Enter the time','err');
  }else if(type==='on_duty'){
    dateTo=$('#ar-to')?.value||d;if(dateTo<d)dateTo=d;
    payload.where=($('#ar-where')?.value||'').trim();if(!payload.where)return toast('Say where / what','err');
  }else return;
  const row={id:uid('areq'),user_id:S.uid,type,date:d,date_to:dateTo,payload,reason,status:'Pending',created_by:S.uid,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  _attReqMerge([row]);closeModal();rr();
  const{error}=await sb.from('attendance_requests').insert(row);
  if(error){DB.attRequests=DB.attRequests.filter(r=>r.id!==row.id);rr();return toast('Couldn’t send — '+error.message,'err');}
  const lbl=_attReqLabel(_mReq(row));
  log(fullName(u),'Attendance request',lbl+' · '+d+' · '+reason);
  _attNotifyApprovers(u,'🕒 '+fullName(u)+' asks: '+lbl+' on '+fmtS(d)+' — '+reason,'att:req:'+row.id);
  toast('Request sent to your manager ✓');
};
App._attReqCancel=async(id)=>{
  const r=(DB.attRequests||[]).find(x=>x.id===id);if(!r||r.userId!==S.uid||r.status!=='Pending')return;
  r.status='Cancelled';rr();
  const{error}=await sb.from('attendance_requests').update({status:'Cancelled',updated_at:new Date().toISOString()}).eq('id',id);
  if(error){r.status='Pending';rr();return toast('Couldn’t cancel — '+error.message,'err');}
  toast('Request withdrawn');
};
/* Comp-off request raised automatically by a rest-day / holiday clock-in (spec §9.2, §9.5) */
async function _attCompOffRequest(u,attId,date,kind){
  try{await _attLoadRequests();}catch(e){}   // make sure an existing request for today is known before deduping
  if((DB.attRequests||[]).some(r=>r.userId===u.id&&r.type==='comp_off'&&r.date===date&&r.status!=='Cancelled'))return;
  const why=kind.type==='PUBLIC_HOLIDAY'?'Worked on public holiday'+(kind.holiday?' ('+kind.holiday.name+')':''):'Worked on rest day';
  const row={id:uid('areq'),user_id:u.id,type:'comp_off',date,date_to:null,payload:{attendance_id:attId,minutes:0,rate:Number(_attSettings().comp_off_rate||1)},reason:why,status:'Pending',created_by:u.id,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  _attReqMerge([row]);
  sb.from('attendance_requests').insert(row).then(({error})=>{if(error){console.warn('[att] comp off',error.message);return;}
    log(fullName(u),'Comp-off requested',date+' · '+why);
    _attNotifyApprovers(u,'🗓 '+fullName(u)+' clocked in on a '+kind.label.toLowerCase()+' ('+fmtS(date)+') — comp-off request raised.','att:req:'+row.id);});
}
function _attCompOffUpdate(a){
  const r=(DB.attRequests||[]).find(x=>x.userId===a.userId&&x.type==='comp_off'&&x.date===a.date&&x.status==='Pending');if(!r)return;
  const mins=_attDayMins(a.userId,a.date);r.payload={...(r.payload||{}),minutes:mins};
  sb.from('attendance_requests').update({payload:r.payload,updated_at:new Date().toISOString()}).eq('id',r.id).then(()=>{}).catch(()=>{});
}

/* ── My requests (employee card under My attendance) ── */
function _attMyRequestsCard(uid2){
  const list=(DB.attRequests||[]).filter(r=>r.userId===uid2).slice(0,12);
  if(!list.length&&uid2!==S.uid)return '';
  const rows=list.map(r=>`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--c-border)"><div style="min-width:0;flex:1"><div style="font-size:13px;font-weight:700;color:var(--c-text)">${esc(_attReqLabel(r))} <span style="font-weight:500;color:var(--c-text-3)">· ${fmtS(r.date)}${r.dateTo&&r.dateTo!==r.date?' – '+fmtS(r.dateTo):''}</span></div><div style="font-size:11.5px;color:var(--c-text-3)">${esc(r.reason)}${r.status!=='Pending'&&r.decidedBy?' · '+esc(r.status.toLowerCase())+' by '+esc(fullName(uById(r.decidedBy))||'—')+(r.decisionNote?': '+esc(r.decisionNote):''):''}</div></div>${chip(r.status)}${r.status==='Pending'&&r.userId===S.uid&&r.type!=='comp_off'?btn('',`App._attReqCancel('${r.id}')`,{variant:'subtle',size:'sm',icon:'x',attrs:'title="Withdraw"'}):''}</div>`).join('');
  return `<div class="ui-card" style="margin-top:12px"><div class="ui-card-head"><span class="ui-card-title">${uid2===S.uid?'My requests':'Requests'}</span>${uid2===S.uid&&can('attendance','clock')?btn('New request','App._attReqNew()',{variant:'ghost',size:'sm',icon:'plus'}):''}</div><div class="ui-card-pad" style="padding-top:2px">${rows||'<div style="padding:12px 0;font-size:12.5px;color:var(--c-text-3)">No requests yet. Use <b>Request…</b> to fix a missed punch, ask for a late arrival / early leave, or log on-duty work.</div>'}</div></div>`;
}

/* ── Manager inbox: pending requests + open shifts for people in scope (spec §8.5 — one inbox, bulk actions) ── */
function _attInboxItems(){
  const f=scopeFilter('attendance');
  const reqs=(DB.attRequests||[]).filter(r=>r.status==='Pending'&&r.userId!==S.uid&&f(r.userId)).map(r=>({kind:'req',id:r.id,userId:r.userId,date:r.date,r}));
  const opens=(DB.attendance||[]).filter(a=>_attIsOpenShift(a)&&a.userId!==S.uid&&f(a.userId)).map(a=>({kind:'open',id:a.id,userId:a.userId,date:a.date,a}));
  return reqs.concat(opens).sort((x,y)=>String(x.date).localeCompare(String(y.date)));
}
function _attInboxTab(){
  const items=_attInboxItems();const sel=S.filters.attSel||{};
  const hist=(DB.attRequests||[]).filter(r=>r.status!=='Pending'&&r.decidedBy===S.uid).slice(0,15);
  const nSel=Object.keys(sel).filter(k=>sel[k]).length;
  const row=it=>{const u=uById(it.userId);if(!u)return '';
    if(it.kind==='open'){const a=it.a;return `<div class="att-inbox-row" style="display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--c-border)"><span style="width:18px"></span><div class="att-nowrap" style="min-width:0;display:flex;align-items:center;gap:10px">${avatar(u,'w-8 h-8','text-[10px]')}<div style="min-width:0"><div style="font-size:13px;font-weight:700;color:var(--c-text)">${esc(fullName(u))} <span style="font-size:10.5px;font-weight:800;padding:1px 8px;border-radius:20px;background:#F9EBE5;color:#A63528">Open shift</span></div><div style="font-size:11.5px;color:var(--c-text-3)">${fmtD(a.date)} · clocked in ${_attHM(a.inAt)}, never clocked out${a.mode==='wfh'?' · WFH':''}</div></div></div><div class="att-inbox-actions" style="display:flex;gap:6px">${btn('Close shift',`App._attResolve('${a.id}')`,{variant:'primary',size:'sm',icon:'clock'})}</div></div>`;}
    const r=it.r;const p=r.payload||{};const rs=_attRowsFor(r.userId,r.date);
    const detail=r.type==='regularisation'?('Now: '+(rs[0]?_attHM(rs[0].inAt)+' → '+(rs[rs.length-1].outAt?_attHM(rs[rs.length-1].outAt):'…'):'no punch')+' · Asked: '+esc(p.in||'—')+' → '+esc(p.out||'—')):r.type==='comp_off'?(p.minutes?_attFmtMins(p.minutes)+' worked':'still clocked in')+' · '+esc(r.reason):esc(r.reason);
    return `<div class="att-inbox-row" style="display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--c-border)"><input type="checkbox" ${sel[r.id]?'checked':''} onchange="S.filters.attSel=S.filters.attSel||{};S.filters.attSel['${r.id}']=this.checked;rr()"/><div class="att-nowrap" style="min-width:0;display:flex;align-items:center;gap:10px">${avatar(u,'w-8 h-8','text-[10px]')}<div style="min-width:0"><div style="font-size:13px;font-weight:700;color:var(--c-text)">${esc(fullName(u))} <span style="font-weight:500;color:var(--c-text-2)">· ${esc(_attReqLabel(r))}</span> <span style="font-size:11px;color:var(--c-text-3)">${fmtS(r.date)}${r.dateTo&&r.dateTo!==r.date?' – '+fmtS(r.dateTo):''}</span></div><div style="font-size:11.5px;color:var(--c-text-3)">${detail}${r.type!=='comp_off'&&r.reason&&r.type!=='regularisation'?'':''}${r.type==='regularisation'?' — '+esc(r.reason):''}</div></div></div><div class="att-inbox-actions" style="display:flex;gap:6px">${btn('Approve',`App._attReqDecide(['${r.id}'],'Approved')`,{variant:'primary',size:'sm',icon:'check'})}${btn('Reject',`App._attReqDecide(['${r.id}'],'Rejected')`,{variant:'ghost',size:'sm',icon:'x'})}</div></div>`;};
  const histRows=hist.map(r=>{const u=uById(r.userId);return `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-top:1px solid var(--c-border);font-size:12px"><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><b>${esc(fullName(u))}</b> · ${esc(_attReqLabel(r))} · ${fmtS(r.date)}</span>${chip(r.status)}</div>`;}).join('');
  return `<div class="ui-card"><div class="ui-card-head"><span class="ui-card-title">Waiting for you <span style="font-weight:600;color:var(--c-text-3)">· ${items.length}</span></span><div style="display:flex;gap:6px">${nSel?btn('Approve '+nSel,'App._attReqDecide(Object.keys(S.filters.attSel).filter(k=>S.filters.attSel[k]),\'Approved\')',{variant:'primary',size:'sm',icon:'check'})+btn('Reject '+nSel,'App._attReqDecide(Object.keys(S.filters.attSel).filter(k=>S.filters.attSel[k]),\'Rejected\')',{variant:'ghost',size:'sm',icon:'x'}):(items.some(i=>i.kind==='req')?btn('Select all','S.filters.attSel={};_attInboxItems().forEach(i=>{if(i.kind===\'req\')S.filters.attSel[i.id]=true});rr()',{variant:'subtle',size:'sm'}):'')}</div></div>
    <div class="ui-card-pad" style="padding-top:2px">${items.map(row).join('')||'<div style="padding:18px 0;text-align:center;font-size:12.5px;color:var(--c-text-3)">Nothing waiting — no open shifts, no requests 🎉</div>'}</div></div>
    ${histRows?`<div class="ui-card" style="margin-top:12px"><div class="ui-card-head"><span class="ui-card-title">Recently decided by you</span></div><div class="ui-card-pad" style="padding-top:2px">${histRows}</div></div>`:''}`;
}
App._attReqDecide=(ids,status)=>{
  ids=(ids||[]).filter(Boolean);if(!ids.length)return;
  const needNote=status==='Rejected'||ids.length>1;
  if(!needNote)return App._attReqDecideGo(ids,status,'');
  const optional=status==='Approved';
  modalShell({title:status==='Rejected'?'Reason for rejecting':'Note for all '+ids.length,sub:status==='Rejected'?'Shown to the person':'Optional — shown to everyone in this batch',size:'max-w-sm',key:'att-note',
    body:`<div>${fld(optional?'Note (optional)':'Reason *','att-note-v','')}</div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP(status==='Rejected'?'Reject':'Approve '+ids.length,"App._attReqDecideGo("+JSON.stringify(ids).replace(/"/g,'&quot;')+",'"+status+"',document.getElementById('att-note-v').value,"+(optional?'true':'false')+")")});
};
App._attReqDecideGo=async(ids,status,note,optional)=>{
  note=String(note||'').trim();
  if(status==='Rejected'&&!note&&!optional)return toast('A reason is required','err');
  closeModal();
  let done=0;
  for(const id of ids){
    const r=(DB.attRequests||[]).find(x=>x.id===id);if(!r||r.status!=='Pending')continue;
    if(!_attCanResolveFor(r.userId)){toast('You can’t decide for '+fullName(uById(r.userId)),'err');continue;}
    const now=new Date().toISOString();
    const patch={status,decided_by:S.uid,decided_at:now,decision_note:note||'',updated_at:now};
    const{error}=await sb.from('attendance_requests').update(patch).eq('id',id).eq('status','Pending');
    if(error){toast('Couldn’t save — '+error.message,'err');continue;}
    Object.assign(r,{status,decidedBy:S.uid,decidedAt:now,decisionNote:note||''});
    if(status==='Approved'){try{await _attReqApply(r);}catch(e){console.warn('[att] apply',e.message);toast('Approved, but applying it failed: '+e.message,'err');}}
    const u=uById(r.userId);
    log(fullName(me()),'Attendance request '+status.toLowerCase(),fullName(u)+' · '+_attReqLabel(r)+' · '+r.date+(note?' · '+note:''));
    _attNotify(r.userId,(status==='Approved'?'✅ ':'❌ ')+'Your request — '+_attReqLabel(r)+' on '+fmtS(r.date)+' — was '+status.toLowerCase()+' by '+fullName(me())+(note?': '+note:'.'),'att:'+r.date,'attendance','attendance_decided');
    try{if(typeof sendEmail==='function')sendEmail('attendance_decided',r.userId,{request:_attReqLabel(r),date:fmtD(r.date),status,actor:fullName(me()),note:note||''}).catch(()=>{});}catch(e){}
    done++;
  }
  S.filters.attSel={};rr();
  if(done)toast(done+' request'+(done>1?'s':'')+' '+status.toLowerCase()+' ✓');
};
/* What an approval DOES (the request is the audit record; the attendance row keeps its original in history) */
async function _attReqApply(r){
  if(r.type==='regularisation'){
    const p=r.payload||{};const now=new Date().toISOString();
    const mk=t=>t?new Date(r.date+'T'+t+':00').toISOString():null;
    const mkOut=t=>{if(!t)return null;const d=new Date(r.date+'T'+t+':00');if(p.in&&d<=new Date(r.date+'T'+p.in+':00'))d.setDate(d.getDate()+1);return d.toISOString();};
    const rs=_attRowsFor(r.userId,r.date);const a=rs[0];
    const reason='Regularisation approved: '+r.reason;
    if(a){
      const hist=(a.history||[]).concat([{at:now,by:S.uid,reason,before:{in:a.inAt,out:a.outAt,mode:a.mode},request_id:r.id}]);
      const patch={clock_in_at:mk(p.in),clock_out_at:p.out?mkOut(p.out):(a.outAt||null),edited_by:S.uid,edited_at:now,edit_reason:reason,auto_out:false,history:hist,source:'regularised',updated_at:now};
      const{error}=await sb.from('attendance').update(patch).eq('id',a.id);if(error)throw new Error(error.message);
      Object.assign(a,{inAt:patch.clock_in_at,outAt:patch.clock_out_at,editedBy:S.uid,editedAt:now,editReason:reason,autoOut:false,history:hist,source:'regularised'});
    }else{
      const row={id:uid('att'),user_id:r.userId,date:r.date,clock_in_at:mk(p.in),clock_out_at:mkOut(p.out),mode:'office',source:'regularised',edited_by:S.uid,edited_at:now,edit_reason:reason,history:[{at:now,by:S.uid,reason,before:null,request_id:r.id}],created_at:now,updated_at:now};
      const{error}=await sb.from('attendance').insert(row);if(error)throw new Error(error.message);_attMerge([row]);
    }
  }
  // partial_day / on_duty / comp_off: the approved request itself is what the day engine reads (flags, on-duty, comp-off report).
}
/* ── Close an open shift (manager) — spec §9.2: only on an event someone actually observed ── */
App._attResolve=(id)=>{
  const a=(DB.attendance||[]).find(x=>x.id===id);if(!a)return;
  if(!_attCanResolveFor(a.userId))return toast('You need Attendance → Approve for this person','err');
  const u=uById(a.userId);const s=_attSchedule(u,a.date);
  modalShell({title:'Close open shift — '+fullName(u),sub:fmtD(a.date)+' · clocked in '+_attHM(a.inAt)+', never clocked out',size:'max-w-sm',key:'att-resolve',
    body:`<div style="display:grid;gap:10px">${fld('They actually left at','ar-out',s.out,'time')}${fld('How do you know? *','ar-why','','text','e.g. saw them leave at 18:10 / confirmed on the phone')}<p style="font-size:11.5px;color:var(--c-text-3);line-height:1.5">The open punch stays in the record; your time and reason are added on top, and the person is told.</p></div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP('Close shift',`App._attResolveSave('${id}')`)});
};
App._attResolveSave=async(id)=>{
  const a=(DB.attendance||[]).find(x=>x.id===id);if(!a||!_attCanResolveFor(a.userId))return;
  const t=$('#ar-out')?.value,why=($('#ar-why')?.value||'').trim();
  if(!t)return toast('Enter the clock-out time','err');if(!why)return toast('Say how you know — it goes in the audit trail','err');
  const od=new Date(a.date+'T'+t+':00');if(od<=new Date(a.inAt))od.setDate(od.getDate()+1);   // night shift → next day
  if(od-new Date(a.inAt)>36*36e5)return toast('That is more than 36 hours after the clock-in ('+_attHM(a.inAt)+') — check the time','err');
  const out=od.toISOString();
  const now=new Date().toISOString();const reason='Open shift closed by manager: '+why;
  const hist=(a.history||[]).concat([{at:now,by:S.uid,reason,before:{in:a.inAt,out:null,mode:a.mode}}]);
  const patch={clock_out_at:out,edited_by:S.uid,edited_at:now,edit_reason:reason,history:hist,updated_at:now};
  const{error}=await sb.from('attendance').update(patch).eq('id',id);
  if(error)return toast('Couldn’t save — '+error.message,'err');
  Object.assign(a,{outAt:out,editedBy:S.uid,editedAt:now,editReason:reason,history:hist});
  log(fullName(me()),'Open shift closed',fullName(uById(a.userId))+' · '+a.date+' · '+t+' · '+why);
  _attNotify(a.userId,'⏱ '+fullName(me())+' closed your open shift from '+fmtS(a.date)+' at '+t+' — '+why,'att:'+a.date,'attendance','attendance_edited');
  try{if(typeof sendEmail==='function')sendEmail('attendance_edited',a.userId,{date:fmtD(a.date),reason,actor:fullName(me())}).catch(()=>{});}catch(e){}
  try{_attCompOffUpdate(a);}catch(e){}
  closeModal();toast('Shift closed ✓');rr();
};

/* ═══════════════ REPORTS (spec §12) ═══════════════ */
function _attReportsTab(){
  const r=_attRange();const people=_attScopeUsers();
  _attLoadRange(r.from,r.to,people.map(p=>p.id));
  const rep=S.filters.attRep||'verification';
  const REPS=[['verification','Verification / exceptions'],['absentee','Absentee'],['summary','Summary per person'],['compoff','Comp off'],['requests','Requests & SLA']];
  const pills=`<div class="hscroll att-rep-pills" style="display:flex;gap:6px;margin-bottom:12px;padding-bottom:2px">${REPS.map(([k,l])=>`<button class="ui-btn ${rep===k?'ui-btn-primary':'ui-btn-ghost'} ui-btn-sm" onclick="S.filters.attRep='${k}';rr()">${l}</button>`).join('')}</div>`;
  let body='';
  if(rep==='verification')body=_attRepVerification(people,r);
  else if(rep==='absentee')body=_attRepAbsentee(people,r);
  else if(rep==='summary')body=_attRepSummary(people,r);
  else if(rep==='compoff')body=_attRepCompOff(people,r);
  else body=_attRepRequests(people,r);
  return _attRangeBar()+pills+body;
}
function _attRepTable(cols,rows,csvName){
  const canX=can('attendance','export');
  const html=`<div class="ui-card"><div class="ui-card-head"><span class="ui-card-title">${rows.length} row${rows.length===1?'':'s'}</span>${canX&&rows.length?btn('Download CSV',`App._attRepCsv('${csvName}')`,{variant:'ghost',size:'sm',icon:'download'}):''}</div>
    <div class="att-rep-wrap" style="overflow-x:auto"><table class="ui-table att-rep" style="width:100%;font-size:12.5px"><thead><tr>${cols.map(c=>`<th style="text-align:left;padding:8px 10px;font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--c-text-3);white-space:nowrap">${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(rw=>`<tr>${rw.map((v,i)=>`<td data-label="${esc(cols[i]||'')}" style="padding:7px 10px;border-top:1px solid var(--c-border);white-space:nowrap">${v==null?'':v}</td>`).join('')}</tr>`).join('')||`<tr><td class="att-rep-empty" colspan="${cols.length}" style="padding:18px;text-align:center;color:var(--c-text-3)">Nothing to show for this range 🎉</td></tr>`}</tbody></table></div></div>`;
  window._attRepLast={cols,rows:rows.map(rw=>rw.map(v=>String(v==null?'':v).replace(/<[^>]*>/g,''))),name:csvName};
  return html;
}
App._attRepCsv=(name)=>{if(!can('attendance','export'))return toast('You need Attendance → Export','err');const L=window._attRepLast;if(!L)return;const r=_attRange();const csv=[L.cols].concat(L.rows).map(x=>x.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');_attDownload(csv,name+'-'+r.from+'_'+r.to+'.csv');log(fullName(me()),'Exported report',name+' · '+r.from+' to '+r.to);};
/* Verification (pre cut-off): every person-day the manager must resolve before payroll (spec §10.1, §12) */
function _attRepVerification(people,r){
  const rows=[];const days=_attDaysBetween(r.from,r.to).filter(d=>d<todayISO());
  people.forEach(p=>days.forEach(d=>{const f=_attDayFlags(p,d);const issues=[];
    if(f.openShift)issues.push('Open shift');if(f.absent&&!f.rows)issues.push('Absent (no punch)');else if(f.absent)issues.push('Absent (too few hours)');
    if(f.halfDay)issues.push('Half day');else if(f.shortage)issues.push('Hours short');
    if(f.late)issues.push('Late');if(f.early)issues.push('Left early');if(f.autoOut)issues.push('Auto clock-out');if(f.queued)issues.push('Synced late');
    if(f.otMins>Number(_attSettings().ot_max_day_h||99)*60)issues.push('OT over daily cap');
    if(f.restDayWork)issues.push('Rest-day work');
    const pend=(DB.attRequests||[]).filter(x=>x.userId===p.id&&x.status==='Pending'&&x.date===d);if(pend.length)issues.push('Pending: '+pend.map(_attReqLabel).join(', '));
    if(!issues.length)return;
    const rs=_attRowsFor(p.id,d);
    rows.push([`<b>${esc(fullName(p))}</b>`,esc(p.department||''),`<a href="#" onclick="event.preventDefault();App._attDay('${p.id}','${d}')" style="color:var(--c-brand);font-weight:700">${fmtS(d)} ${dayAbbr(d)}</a>`,esc(_attDayStatus(p,d)),rs.length?_attHM(rs[0].inAt)+' → '+(rs[rs.length-1].outAt?_attHM(rs[rs.length-1].outAt):'…'):'',_attFmtHHMM(f.mins),issues.map(i=>`<span style="font-size:10.5px;font-weight:700;padding:1px 7px;border-radius:20px;background:var(--c-surface-2);color:var(--c-text-2);margin-right:3px">${esc(i)}</span>`).join('')]);}));
  const n=rows.length;
  const head=`<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px"><span style="font-size:12.5px;color:var(--c-text-2)">Unresolved exceptions in range: <b style="color:${n?'#A63528':'#346A47'}">${n}</b></span><span style="font-size:11.5px;color:var(--c-text-3)">Payroll can only be released at zero — close open shifts, decide pending requests, and correct or excuse absences before the cut-off.</span></div>`;
  return head+_attRepTable(['Person','Department','Date','Status','Punches','Worked','Issues'],rows,'attendance-verification');
}
function _attRepAbsentee(people,r){
  const rows=[];const days=_attDaysBetween(r.from,r.to).filter(d=>d<=todayISO());
  people.forEach(p=>days.forEach(d=>{const st=_attDayStatus(p,d);if(st!=='Absent'&&st!=='Not in yet'&&st!=='Open shift')return;const f=_attDayFlags(p,d);
    rows.push([`<b>${esc(fullName(p))}</b>`,esc(p.department||''),`<a href="#" onclick="event.preventDefault();App._attDay('${p.id}','${d}')" style="color:var(--c-brand);font-weight:700">${fmtS(d)} ${dayAbbr(d)}</a>`,esc(st),f.rows?_attFmtHHMM(f.mins):'—',esc(fullName(uById(p.managerId))||'—')]);}));
  return _attRepTable(['Person','Department','Date','Status','Worked','Manager'],rows,'absentee');
}
function _attRepSummary(people,r){
  const rows=people.map(p=>{const st=_attStats(p.id,r.from,r.to);const sched=_attSchedule(p,r.to);
    return [`<b>${esc(fullName(p))}</b>`,esc(p.employeeId||''),esc(p.department||''),esc(sched.category||'office'),st.scheduled,st.present,st.absent,st.off+st.holiday,st.wfh,st.onDuty,st.late,st.early,st.halfDay,st.openShift,_attFmtHHMM(st.mins),_attFmtHHMM(st.otMins),st.restWork];});
  return _attRepTable(['Person','Emp ID','Department','Category','Scheduled days','Present','Absent','Rest / holiday','WFH','On duty','Late','Early out','Half days','Open shifts','Worked','Overtime','Rest-day work'],rows,'attendance-summary');
}
function _attRepCompOff(people,r){
  const ids=new Set(people.map(p=>p.id));
  const list=(DB.attRequests||[]).filter(x=>x.type==='comp_off'&&ids.has(x.userId)&&x.date>=r.from&&x.date<=r.to);
  const exp=Number(_attSettings().comp_off_expiry_days||0);
  const rows=list.map(x=>{const p=uById(x.userId);const m=(x.payload||{}).minutes||_attDayMins(x.userId,x.date);const rate=(x.payload||{}).rate||1;const expires=exp?(()=>{const d=new Date(x.date+'T00:00:00');d.setDate(d.getDate()+exp);return _attISO(d);})():'';
    return [`<b>${esc(fullName(p))}</b>`,esc(p&&p.department||''),fmtS(x.date)+' '+dayAbbr(x.date),esc(x.reason),_attFmtHHMM(m),(Math.round(rate*100)/100)+' day'+(rate===1?'':'s'),chip(x.status),x.decidedBy?esc(fullName(uById(x.decidedBy))):'',expires?fmtS(expires):''];});
  return `<p style="font-size:12px;color:var(--c-text-3);margin-bottom:10px;line-height:1.5">Comp-off is earned by clocking in on a rest day or public holiday and approved by the manager. Balances, expiry and use will be handled by the leave module.</p>`+_attRepTable(['Person','Department','Worked on','Why','Hours','Earns','Status','Decided by','Expires'],rows,'comp-off');
}
function _attRepRequests(people,r){
  const ids=new Set(people.map(p=>p.id));const sla=3;
  const list=(DB.attRequests||[]).filter(x=>ids.has(x.userId)&&x.date>=r.from&&x.date<=r.to);
  const rows=list.map(x=>{const p=uById(x.userId);const age=Math.floor((Date.now()-new Date(x.createdAt))/864e5);const late=x.status==='Pending'&&age>sla;
    return [`<b>${esc(fullName(p))}</b>`,esc(_attReqLabel(x)),fmtS(x.date),esc(x.reason),chip(x.status),x.createdAt?fmtS(x.createdAt.slice(0,10)):'',x.status==='Pending'?(late?`<span style="color:#A63528;font-weight:800">${age} days — over SLA</span>`:age+' day'+(age===1?'':'s')):(x.decidedAt?fmtS(x.decidedAt.slice(0,10)):''),x.decidedBy?esc(fullName(uById(x.decidedBy))):esc(fullName(uById(p&&p.managerId))||'—')];});
  return _attRepTable(['Person','Request','For','Reason','Status','Raised','Waiting / decided','Approver'],rows,'attendance-requests');
}

/* ═══════════════ DEEP LINKS ═══════════════ */
/* att:req:<id> → the Requests inbox (approver) or My attendance (requester) */
App._attOpenReqLink=(id)=>{
  const r=(DB.attRequests||[]).find(x=>x.id===id);
  App.go('attendance');S.filters.attTab=(r&&r.userId===S.uid)?'my':'requests';rr();
};
