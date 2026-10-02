/* ============================================================
   19b-okr-v4.js — Bridge v4.0 · OKR "One scoreboard"
   ------------------------------------------------------------
   Everything NEW for the Road-to-1,000 proposal lives here; 19-okr-roles-acl.js keeps
   the engine (tree, roll-ups, annual↔quarters, revisions, visibility, bulk edit, export)
   and calls into this file at a handful of points:

     · Objective · KR · KPI      okrIsKR / okrIsKPI / okrKRsOf / okrKPIsOf / okrKRParentPct — KPIs link under number KRs
     · Key-result kinds          metric (today's number) · milestone (date) · count (items) · range (floor+target)
     · Approved ramp             okrHasPacing / okrPlanValueAt / okrPlanPctAt / okrTol  (Appendix A)
     · Owner flag                on_track / at_risk / blocked on every check-in — okrFlagOf / okrFlagChip
     · North Star + engines      okrContributors / okrContribSummary
     · Governance                proposed vs confirmed targets · owner TBD · needs decision · drafts
     · Scoreboard tab            okrScoreboardHTML
     · Blocked alert             okrBlockedAlert → owners up the tree + OKR managers

   Loaded right after 19-okr-roles-acl.js (classic script, shared scope). Nothing here runs at
   load time except constant declarations; every function is called at render / click time.
   ============================================================ */

/* ───────────────────────── icons used by the new UI (added only if missing) ───────────────────────── */
if(typeof I!=='undefined'){
  if(!I.info)I.info='<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>';
  if(!I.star)I.star='<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>';
  if(!I.target)I.target='<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>';
  if(!I.hash)I.hash='<line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>';
  if(!I.range)I.range='<line x1="4" y1="20" x2="20" y2="20"/><line x1="4" y1="4" x2="20" y2="4"/><polyline points="12 8 12 16"/><polyline points="9 13 12 16 15 13"/><polyline points="9 11 12 8 15 11"/>';
  if(!I.print)I.print='<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>';
  if(!I.link)I.link='<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>';
  if(!I.trend)I.trend='<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>';
}

/* ═════════════════════════════ 1. MODEL HELPERS ═════════════════════════════ */
const OKR_KR_KINDS=[
  ['metric','Number to reach','A measured number with a start and a target — "+150 orders/day", "AED 27M → 34M", "47K → 100K visits". Updated by typing the latest value.'],
  ['milestone','Milestone — done by a date','One deliverable with a due date — "Live Oct 2026", "Phase 1 by 21 Sep", "Investor deck ready". Ticked done when it lands.'],
  ['count','Count of named items','A list of things to complete, each with its own date — "6 / 6 Dubai areas certified", "CT filing · VAT ×4 · annual audit". The items stay visible, so a clean % never hides what’s missing.'],
  ['range','Floor + target','A minimum that must never be breached and a level to build to — "cash runway: never below 3 months, build to 6". Breaching the floor reads Off track whatever the %.']
];
const OKR_KR_KIND_META={metric:{icon:'trend',label:'Number',short:'#'},milestone:{icon:'flag',label:'Milestone',short:'Due'},count:{icon:'hash',label:'Count',short:'Items'},range:{icon:'range',label:'Floor + target',short:'Range'}};
const OKR_FLAGS={on_track:{label:'On track',bg:'#E9F2EC',fg:'#2B5638',dot:'#58996E'},at_risk:{label:'At risk',bg:'#FBF1DC',fg:'#7A5A12',dot:'#D9A62B'},blocked:{label:'Blocked',bg:'#F9E7E3',fg:'#8E2A1E',dot:'#C25441'}};
const OKR_FLAG_ORDER=['on_track','at_risk','blocked'];
const OKR_FLAG_RANK={on_track:1,at_risk:2,blocked:3};

function okrIsKR(o){return !!o&&o.kind==='kr';}
function okrKRKind(o){return (o&&(o.krKind==='milestone'||o.krKind==='count'||o.krKind==='range'))?o.krKind:'metric';}
function okrKRsOf(id){return okrChildren(id).filter(k=>k.kind==='kr');}
function okrSubObjs(id){return okrChildren(id).filter(k=>k.kind!=='kr');}
function okrHasKRs(o){return !!o&&o.kind!=='kr'&&okrMeasuresOf(o.id).length>0;}
/* ── KPI (kind 'kpi'): everything Bridge measured before the OKR tree. The migration marks every existing row
   as a KPI and rows the older frontend keeps writing default to it. Mechanically a KPI is an objective — own
   number, check-ins, sub-KPIs, roll-ups, annual splits all work exactly as before. It differs in WHERE it shows:
   linked under an objective it becomes one line in that objective's "KPIs · key results" column and feeds the
   objective's average; unlinked it sits in the scoreboard's "KPIs not linked to an objective" section. */
function okrIsKPI(o){return !!o&&o.kind==='kpi';}
function okrIsObjective(o){return !!o&&o.kind!=='kr'&&o.kind!=='kpi';}
function okrKPIsOf(id){return okrChildren(id).filter(k=>k.kind==='kpi'&&!k.quarterLabel);}
/* The measures of an objective: its key results and the KPIs linked directly under it. */
function okrMeasuresOf(id){return okrChildren(id).filter(k=>(k.kind==='kr'||k.kind==='kpi')&&!k.quarterLabel);}
function okrKindLabel(o){return o.kind==='kr'?'key result':o.kind==='kpi'?'KPI':'objective';}
/* An objective MEASURED BY its key results: metric type 'krs' (stored in the existing metric_type column, so
   no migration). Its own number is ignored; progress = the KRs' average. An objective with its own number
   (the North Star's daily orders, say) keeps that number even when key results hang under it. */
function okrReadsFromKRs(o){if(!o||o.metricType!=='krs')return false;if(o.kind==='kr'){const kk=okrKRKind(o);return kk!=='milestone'&&kk!=='count';}return true;}
/* Where a KPI can be linked: a key result that is a number (metric or range). Objectives are measured by their KRs. */
function okrCanHoldKPIs(o){if(!o||o.kind!=='kr'||o.closed||o.quarterLabel)return false;const kk=okrKRKind(o);return kk==='metric'||kk==='range';}
function okrLinkedChip(o){if(!o||o.kind!=='kpi'||!o.parentId)return'';const p=okrById(o.parentId);if(!p||p.kind==='kpi')return'';const top=okrRootOf(p);return`<span title="Linked under the key result “${esc(p.title||'')}”${top&&top!==p?' · '+esc(top.title||''):''}" style="flex-shrink:0;display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:800;line-height:1;padding:3px 7px;border-radius:6px;background:#EFE8F3;color:#5B3F73;border:1px solid #DED1E6;letter-spacing:.04em;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${ic('link','w-3 h-3')}${esc((p.title||'').slice(0,34))}${(p.title||'').length>34?'…':''}</span>`;}
/* Key results AND linked KPIs that count toward the objective: live (not draft) and not closed. */
function okrActiveKRs(o){return okrMeasuresOf(o.id).filter(k=>!k.closed&&k.state!=='draft');}
/* An objective with key results reads their AVERAGE progress — each KR counts equally, a KR with no
   data yet counts as 0 once any sibling has reported (the same "out of all progress" rule annuals use).
   Threshold KRs carry no % (pass/fail), so they are left out of the average. */
function okrKRParentPct(o){
  const ks=okrActiveKRs(o).filter(k=>!okrNoPct(k));
  if(!ks.length)return null;
  let any=false;
  const ps=ks.map(k=>{const p=okrProgress(k);if(p===null)return 0;any=true;return Math.max(0,Math.min(100,p));});
  if(!any)return null;
  return Math.round((ps.reduce((a,b)=>a+b,0)/ks.length)*10)/10;
}
/* Progress for the two kinds that are ticked rather than typed. */
function okrKRPct(o){
  const kk=okrKRKind(o);
  if(kk==='milestone')return o.doneAt?100:0;
  if(kk==='count'){const its=okrItems(o);if(!its.length)return null;const d=its.filter(x=>x.doneAt).length;return Math.round((d/its.length)*1000)/10;}
  return null;
}
function okrItems(o){return Array.isArray(o&&o.items)?o.items.filter(x=>x&&typeof x==='object'):[];}
/* Verdict for milestone / count KRs. Achieved waits for nothing here — done is done. */
function okrKRStatus(o){
  const t=todayISO(),kk=okrKRKind(o);
  const over=!!(o.periodEnd&&t>o.periodEnd);
  if(kk==='milestone'){
    if(o.doneAt)return 'Achieved';
    if(o.dueDate&&t>o.dueDate)return over?'Not achieved':'Off track';
    if(over)return 'Not achieved';
    return 'On track';
  }
  if(kk==='count'){
    const its=okrItems(o);if(!its.length)return 'No data';
    if(its.every(x=>x.doneAt))return 'Achieved';
    if(over)return 'Not achieved';
    if(its.some(x=>!x.doneAt&&x.due&&t>x.due))return 'Off track';
    return 'On track';
  }
  return 'No data';
}
/* Range KRs: has the floor (or, for lower-is-better, the ceiling) been crossed? */
function okrFloorBreached(o){
  if(!o||okrKRKind(o)!=='range'||o.floorValue===null||o.floorValue===undefined)return false;
  const v=okrCurrentOf(o);if(v===null||v===undefined)return false;
  return okrDirDown(o)?Number(v)>Number(o.floorValue):Number(v)<Number(o.floorValue);
}
/* Check-ins without a number: the objective reads from its KRs, or the KR is ticked not typed. */
function okrNoValueCheckin(o){
  if(!o)return false;
  if(o.kind!=='kr')return okrReadsFromKRs(o);
  const kk=okrKRKind(o);return kk==='milestone'||kk==='count'||okrReadsFromKRs(o);
}
function okrNoValueCheckinWhy(o){
  if(o.kind!=='kr')return 'This objective’s number comes from its <b>key results</b> — this update is your <b>status flag and one-liner</b> for the week.';
  if(okrReadsFromKRs(o))return 'This key result’s number comes from its <b>linked KPIs</b> — this update is your <b>status flag and one-liner</b> for the week.';
  return okrKRKind(o)==='milestone'?'A milestone is ticked <b>Done</b> from its panel — this update is your <b>status flag and one-liner</b>.':'Items are ticked off from the panel — this update is your <b>status flag and one-liner</b>.';
}

/* ───────────── approved ramp (Appendix A): expected VALUE on a date, read off the plan ───────────── */
function okrPacingPts(o){
  if(!o||!Array.isArray(o.pacing))return[];
  return o.pacing.filter(p=>p&&p.date&&p.value!==null&&p.value!==undefined&&p.value!==''&&isFinite(Number(p.value)))
    .map(p=>({date:String(p.date).slice(0,10),value:Number(p.value)})).sort((a,b)=>a.date.localeCompare(b.date));
}
function okrHasPacing(o){return okrPacingPts(o).length>0;}
/* Anchors: period start → start value, every ramp point, period end → target. Linear between anchors;
   flat before the first and after the last. null when there is no ramp. */
function okrPlanAnchors(o){
  const pts=okrPacingPts(o);if(!pts.length)return null;
  const s=Number(o.startValue||0),t=_okrTargetEff(o);
  const out=pts.slice();
  const ps=o.periodStart||o.baselineAsOf||(o.createdAt?String(o.createdAt).slice(0,10):null);
  if(ps&&(!out.length||out[0].date>ps))out.unshift({date:ps,value:s});
  if(o.periodEnd&&t!==null&&isFinite(t)&&out[out.length-1].date<o.periodEnd)out.push({date:o.periodEnd,value:Number(t)});
  return out;
}
function okrPlanValueAt(o,date){
  const a=okrPlanAnchors(o);if(!a||!a.length)return null;
  const d=String(date).slice(0,10);
  if(d<=a[0].date)return a[0].value;
  if(d>=a[a.length-1].date)return a[a.length-1].value;
  for(let i=1;i<a.length;i++){
    if(d<=a[i].date){
      const p=a[i-1],q=a[i];
      const t0=new Date(p.date+'T00:00:00').getTime(),t1=new Date(q.date+'T00:00:00').getTime(),tn=new Date(d+'T00:00:00').getTime();
      if(t1<=t0)return q.value;
      return Math.round((p.value+(q.value-p.value)*((tn-t0)/(t1-t0)))*100)/100;
    }
  }
  return a[a.length-1].value;
}
function okrPlanPctAt(o,date){
  const v=okrPlanValueAt(o,date);if(v===null)return null;
  const s=Number(o.startValue||0),t=_okrTargetEff(o);
  if(t===null||!isFinite(t)||Number(t)===s)return null;
  return Math.round(Math.max(0,Math.min(100,((v-s)/(Number(t)-s))*100)));
}
/* The ramp point the objective is heading for next (first anchor after today). */
function okrNextCheckpoint(o){const t=todayISO();return okrPacingPts(o).find(p=>p.date>=t)||null;}
/* Pace tolerance in percentage points: the objective's own → Settings → 15. */
function okrDefaultTol(){try{const v=Number(((typeof _ns!=='undefined'&&_ns&&_ns.okr_alerts)||{}).tolerance);return isFinite(v)&&v>=0?v:15;}catch(e){return 15;}}
function okrTol(o){const v=o&&o.paceTolerance;return(v!==null&&v!==undefined&&v!==''&&isFinite(Number(v)))?Number(v):okrDefaultTol();}

/* ───────────── owner flag: the latest check-in that carried one; parents inherit the worst below ───────────── */
let _okrFlagCache={t:0,map:{}};
function okrFlagOf(o,_seen){
  if(!o)return null;
  const now=Date.now();if(now-_okrFlagCache.t>300)_okrFlagCache={t:now,map:{}};
  if(!_seen&&Object.prototype.hasOwnProperty.call(_okrFlagCache.map,o.id))return _okrFlagCache.map[o.id];
  const top=!_seen;_seen=_seen||new Set();if(_seen.has(o.id))return null;_seen.add(o.id);
  const out=_okrFlagOfCalc(o,_seen);
  if(top)_okrFlagCache.map[o.id]=out;
  return out;
}
function _okrFlagOfCalc(o,_seen){
  const cs=okrCheckinsOf(o.id).filter(c=>c.flag);
  if(cs.length){const c=cs[cs.length-1];return{flag:c.flag,date:c.date,comment:c.comment||'',userId:c.userId,okrId:o.id,inherited:false};}
  let worst=null;
  okrChildren(o.id).forEach(k=>{if(k.closed||k.state==='draft')return;const f=okrFlagOf(k,_seen);if(f&&(!worst||OKR_FLAG_RANK[f.flag]>OKR_FLAG_RANK[worst.flag]))worst=f;});
  return worst?Object.assign({},worst,{inherited:true}):null;
}
function okrFlagLabel(f){return (OKR_FLAGS[f]||{}).label||'';}
function okrFlagChip(f,sm,ctx){
  const m=OKR_FLAGS[f];if(!m)return'';
  const who=ctx&&ctx.userId?uById(ctx.userId):null;
  const tip=ctx?('Owner’s call'+(ctx.inherited?' (from a key result / sub-objective)':'')+(who?' — '+fullName(who):'')+(ctx.date?' on '+fmtS(ctx.date):'')+(ctx.comment?': '+String(ctx.comment).slice(0,140):'')):'Owner’s call';
  return`<span class="okr-flag" title="${esc(tip)}" style="display:inline-flex;align-items:center;gap:4px;padding:${sm?'1px 7px':'2px 9px'};border-radius:20px;font-size:${sm?'10.5':'11.5'}px;font-weight:800;background:transparent;color:${m.fg};border:1.5px solid ${m.dot};white-space:nowrap;margin-left:4px">${ic('user','w-3 h-3')}${m.label}</span>`;
}
/* Three buttons. `call` is JS with the token FLAG where the flag string goes. */
function okrFlagPicker(cur,call,sm){
  return OKR_FLAG_ORDER.map(f=>{const m=OKR_FLAGS[f];const on=cur===f;const js=String(call).split('FLAG').join("'"+f+"'");
    return`<button type="button" onclick="${js}" style="display:inline-flex;align-items:center;gap:6px;padding:${sm?'5px 10px':'7px 13px'};border-radius:20px;border:1.5px solid ${on?m.dot:'var(--c-border)'};background:${on?m.bg:'var(--c-surface)'};color:${on?m.fg:'var(--c-text-2)'};font-size:${sm?'11':'12'}px;font-weight:700;cursor:pointer"><span style="width:7px;height:7px;border-radius:50%;background:${on?m.dot:'var(--c-border-2)'}"></span>${m.label}</button>`;}).join('');
}
/* Blocked → tell the people who can unblock: owners up the tree, plus everyone with OKR → Manage. */
function okrBlockedAlert(o,ck){
  try{
    const ids=new Set();
    let cur=o?okrById(o.parentId):null,g=0;
    while(cur&&g++<15){okrOwners(cur).forEach(x=>ids.add(x));cur=cur.parentId?okrById(cur.parentId):null;}
    (DB.users||[]).forEach(u=>{if(u&&u.status==='Active'&&canUser(u,'okr','manage'))ids.add(u.id);});
    ids.delete(S.uid);
    const who=fullName(me());
    _okrNotify([...ids],'okr_blocked','⛔ Blocked: "'+(o.title||'')+'" — '+who+(ck&&ck.comment?': '+String(ck.comment).slice(0,120):''),{okr_title:o.title||'',actor:who,comment:(ck&&ck.comment)||'',date:(ck&&ck.date)||todayISO()});
  }catch(e){console.warn('[okr blocked alert]',e&&e.message);}
}

/* ───────────── North Star & engines: "counts toward" links ───────────── */
function okrContributors(id){return(DB.okrs||[]).filter(o=>o&&o.contributesTo===id&&o.state!=='draft'&&!o.closed&&okrCanSee(o));}
/* Each engine promises (target − start); it has delivered (current − start). Totals sit under the hero. */
function okrContribSummary(ns){
  const rows=okrContributors(ns.id).map(o=>{
    const s=Number(o.startValue||0),t=_okrTargetEff(o),cur=okrCurrentOf(o);
    const promised=(t===null||!isFinite(t))?null:Number(t)-s;
    const delivered=(cur===null||cur===undefined)?null:Number(cur)-s;
    return{o:o,promised:promised,delivered:delivered,pct:okrProgress(o),st:okrStatusOf(o),flag:okrFlagOf(o)};
  }).sort((a,b)=>(b.promised||0)-(a.promised||0));
  const sum=(k)=>rows.reduce((a,r)=>a+(r[k]===null?0:r[k]),0);
  return{rows:rows,promised:sum('promised'),delivered:sum('delivered'),count:rows.length,onTrack:rows.filter(r=>r.st==='On track'||r.st==='Achieved').length};
}

/* ───────────── chips & badges shared by cards, panel and scoreboard ───────────── */
function okrKRKindChip(o){
  const m=OKR_KR_KIND_META[okrKRKind(o)]||OKR_KR_KIND_META.metric;
  return`<span title="Key result · ${esc(m.label)}" style="flex-shrink:0;display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:800;line-height:1;padding:3px 7px;border-radius:6px;background:#EFE8F3;color:#5B3F73;border:1px solid #DED1E6;letter-spacing:.04em">${ic(m.icon,'w-3 h-3')}KR</span>`;
}
function okrKPIChip(){return`<span title="KPI — a tracked number: updated by its owner or from its sub-KPIs, and linkable under an objective" style="flex-shrink:0;display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:800;line-height:1;padding:3px 7px;border-radius:6px;background:#E6F1F0;color:#1F5F5A;border:1px solid #CFE3E0;letter-spacing:.04em">${ic('target','w-3 h-3')}KPI</span>`;}
/* One chip for any node: KR kind · KPI · L-level. withLevel also prints the level after a KPI chip (the cards). */
function okrKindChip(o,withLevel){if(!o)return'';if(o.kind==='kr')return okrKRKindChip(o);if(o.kind==='kpi')return okrKPIChip()+(withLevel?_okrLvlChip(okrLevel(o)):'');return _okrLvlChip(okrLevel(o));}
function _okrBadge(txt,bg,fg,bd,tip){return`<span title="${esc(tip||'')}" style="flex-shrink:0;display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:800;line-height:1;padding:3px 7px;border-radius:6px;background:${bg};color:${fg};border:1px solid ${bd};letter-spacing:.04em;white-space:nowrap">${txt}</span>`;}
function okrBadgesHTML(o,opts){
  opts=opts||{};const out=[];
  if(o.isNorthStar)out.push(_okrBadge(ic('star','w-3 h-3')+'NORTH STAR','#13171B','#F3E7C9','#13171B','The one number the company runs on'));
  if(o.state==='draft')out.push(_okrBadge('DRAFT','#F3F0EA','#6B5F55','#E2DBD1','Proposed — not live, not counted'));
  if(o.targetConfirmed===false)out.push(_okrBadge('PROPOSED','#FBF1DC','#7A5A12','#EEDEB5','Target not yet confirmed by leadership'+(o.targetBasis?' — basis: '+o.targetBasis:'')));
  if(o.ownerTbd&&!okrOwners(o).length)out.push(_okrBadge('OWNER TBD','#FBF1DC','#7A5A12','#EEDEB5','Owner still to be decided'));
  if(o.needsDecision)out.push(_okrBadge('NEEDS DECISION','#F9E7E3','#8E2A1E','#F0CFC8',o.decisionNote||'Flagged for a decision'));
  if(o.kind==='kr'&&o.leadLag&&!opts.noLead)out.push(_okrBadge(o.leadLag==='leading'?'LEADING':'LAGGING','#EEF2F5','#3F5566','#D8E0E6',o.leadLag==='leading'?'Leading indicator — moves first':'Lagging indicator — the result'));
  return out.join('');
}
/* The KR's value as a short phrase: "540 / 1,000", "Done 21 Sep", "Due 31 Dec", "4 / 6", "4.2 mo (floor 3 → 6)" */
function okrKRValueText(k){
  const kk=okrKRKind(k);
  if(kk==='milestone')return k.doneAt?('Done '+fmtS(String(k.doneAt).slice(0,10))):(k.dueDate?('Due '+fmtS(k.dueDate)):'No date yet');
  if(kk==='count'){const its=okrItems(k);return its.filter(x=>x.doneAt).length+' / '+its.length;}
  if(okrReadsFromKRs(k)){const p=okrProgress(k),ms=okrActiveKRs(k),nk=ms.filter(x=>x.kind==='kr').length,np=ms.length-nk;const parts=[];if(nk)parts.push(nk+' KR'+(nk===1?'':'s'));if(np)parts.push(np+' KPI'+(np===1?'':'s'));return (p===null?'—':p+'%')+(parts.length?' <span style="opacity:.6">· '+parts.join(' · ')+'</span>':'');}
  if(k.metricType==='yesno')return (okrLatestCheckin(k.id)||{}).value>=1?'Done':'Not done';
  /* every fragment goes through esc(): the unit is free text typed by a user */
  const cur=esc(_okrFmtVal(k,_okrOwnCur(k))),tgt=esc(_okrFmtVal(k,_okrTargetEff(k)));
  if(kk==='range'){const fl=_fmtAbbr(Math.round(Number(k.floorValue)*100)/100);return cur+' <span style="opacity:.55">/</span> '+tgt+' <span style="opacity:.6">· floor '+esc(fl)+'</span>';}
  const sep=esc(_okrTargetSign(k)||'/');
  return cur+' <span style="opacity:.55">'+sep+'</span> '+tgt;
}
/* One compact line per key result, inside its objective's card / scoreboard row. */
function okrKRLineHTML(k,opts){
  opts=opts||{};
  const st=okrStatusOf(k),m=OKR_ST_META[st]||OKR_ST_META['No data'],kk=okrKRKind(k),isKPI=k.kind==='kpi',km=isKPI?{icon:'target',label:'KPI'}:OKR_KR_KIND_META[kk];
  const pct=okrNoPct(k)?null:okrProgress(k);
  const f=okrFlagOf(k);
  const nSub=isKPI?okrChildren(k.id).filter(x=>!x.quarterLabel).length:0;
  return`<div class="okr-krline${isKPI?' okr-kpiline':''}" onclick="event.stopPropagation();App._okrProgressModal('${k.id}')" title="${esc(km.label)} · ${esc(st)} — open">
    <span class="okr-krdot" style="background:${m.dot}" title="${esc(st)}"></span>
    <span class="okr-krico" title="${esc(km.label)}">${ic(km.icon,'w-3 h-3')}</span>
    <span class="okr-krtitle">${esc(k.title||'Untitled')}${k.closed?' <span style="opacity:.6">· closed</span>':''}</span>
    ${k.leadLag?`<span class="okr-krlead">${k.leadLag==='leading'?'leading':'lagging'}</span>`:''}
    ${k.targetConfirmed===false?`<span class="okr-krprop">proposed</span>`:''}
    <span class="okr-krval">${okrKRValueText(k)}</span>
    ${pct===null?'':`<span class="okr-krpct">${pct}%</span>`}
    ${f?`<span class="okr-krflag" style="background:${OKR_FLAGS[f.flag].dot}" title="${esc(okrFlagLabel(f.flag))}"></span>`:''}
    ${nSub?`<span class="okr-krsub" title="${nSub} sub-KPI${nSub===1?'':'s'} underneath — open to see them">${ic('tree','w-3 h-3')}${nSub}</span>`:''}
    ${opts.unlink?`<button class="okr-krunlink" onclick="event.stopPropagation();App._okrUnlinkKPI('${k.id}')" title="Unlink from this key result (the KPI keeps everything, it just moves to the top level)">${ic('x','w-3 h-3')}</button>`:''}
  </div>${opts.withKPIs&&k.kind==='kr'?okrKPIsOf(k.id).filter(x=>okrCanSee(x)&&(x.state!=='draft'||S.filters.okrSbDrafts)).map(x=>`<div class="okr-krline-sub">${okrKRLineHTML(x)}</div>`).join(''):''}`;
}

/* ═════════════════════════════ 2. PROGRESS PANEL EXTRAS ═════════════════════════════ */
/* Returns {top, body, krs}: facts strip for the kind, the kind's own controls, and the KR list. */
function okrPanelV4(o,canCk){
  const lab='font-size:10px;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em;font-weight:700';
  const big='font-size:20px;font-weight:800;color:var(--c-text)';
  const canEd=_okrCanEditNode(o);
  const out={top:'',body:'',krs:''};
  const kk=o.kind==='kr'?okrKRKind(o):null;
  const tile=(l,v,extra)=>`<div style="min-width:84px"><div style="${lab};white-space:nowrap">${l}</div><div style="${big}${extra||''}">${v}</div></div>`;
  /* facts strip for ticked kinds + KR-parent objectives */
  if(kk==='milestone'){
    out.top=`<div style="display:flex;flex-wrap:wrap;gap:14px 26px;align-items:flex-end">
      ${tile('Due',o.dueDate?esc(fmtD(o.dueDate)):'—')}
      ${tile('Done',o.doneAt?esc(fmtD(String(o.doneAt).slice(0,10))):'<span style="color:var(--c-text-3)">not yet</span>')}
      ${o.doneBy&&uById(o.doneBy)?tile('By',esc(fullName(uById(o.doneBy))),';font-size:14px'):''}
      ${o.periodEnd?tile('Period ends',esc(fmtS(o.periodEnd)),';font-size:14px'):''}
    </div>`;
    if(canCk||canEd)out.body=`<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">${o.doneAt
      ?`<button onclick="App._okrKRUndone('${o.id}')" class="ui-btn ui-btn-ghost ui-btn-sm">${ic('refresh','w-3.5 h-3.5')}Mark not done</button>`
      :`<button onclick="App._okrKRDone('${o.id}')" class="ui-btn ui-btn-primary ui-btn-sm">${ic('check','w-3.5 h-3.5')}Mark done today</button><button onclick="App._okrKRDoneOn('${o.id}')" class="ui-btn ui-btn-ghost ui-btn-sm">Done on another date…</button>`}</div>`;
  }else if(kk==='count'){
    const its=okrItems(o),d=its.filter(x=>x.doneAt).length,t=todayISO();
    out.top=`<div style="display:flex;flex-wrap:wrap;gap:14px 26px;align-items:flex-end">
      ${tile('Done',d+' <span style="font-size:13px;color:var(--c-text-3)">/ '+its.length+'</span>')}
      ${tile('Overdue',its.filter(x=>!x.doneAt&&x.due&&t>x.due).length,its.some(x=>!x.doneAt&&x.due&&t>x.due)?';color:#A63528':'')}
      ${tile('Progress',(okrProgress(o)===null?'—':okrProgress(o)+'%'))}
    </div>`;
    out.body=`<div style="margin-top:12px;background:var(--c-surface);border:1px solid var(--c-border);border-radius:12px;padding:6px 10px">
      <div style="${lab};padding:6px 2px 4px">Items — counted separately</div>
      ${its.map((x,i)=>{const over=!x.doneAt&&x.due&&t>x.due;return`<div style="display:flex;align-items:center;gap:9px;padding:7px 2px;border-top:1px solid var(--c-border)">
        <button ${canCk||canEd?`onclick="App._okrItemTog('${o.id}',${i})"`:'disabled'} aria-label="${x.doneAt?'Mark not done':'Mark done'}" style="width:20px;height:20px;border-radius:6px;border:1.5px solid ${x.doneAt?'#58996E':'var(--c-border-2)'};background:${x.doneAt?'#58996E':'var(--c-surface)'};display:grid;place-items:center;color:#fff;flex-shrink:0;cursor:${canCk||canEd?'pointer':'default'}">${x.doneAt?ic('check','w-3 h-3'):''}</button>
        <span style="flex:1;min-width:0;font-size:12.5px;font-weight:600;color:${x.doneAt?'var(--c-text-3)':'var(--c-text)'};${x.doneAt?'text-decoration:line-through;':''}overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.name||'Item')}</span>
        <span style="font-size:11px;font-weight:700;color:${over?'#A63528':'var(--c-text-3)'};white-space:nowrap">${x.doneAt?('done '+fmtS(String(x.doneAt).slice(0,10))):(x.due?((over?'overdue · ':'due ')+fmtS(x.due)):'')}</span>
      </div>`;}).join('')||'<div style="padding:10px 2px;font-size:12px;color:var(--c-text-3)">No items yet — add them in Edit.</div>'}
    </div>`;
  }else if(kk==='range'){
    const br=okrFloorBreached(o);
    out.body=`<div style="margin-top:10px;display:flex;gap:8px;align-items:center;background:${br?'#F9E7E3':'var(--c-surface)'};border:1px solid ${br?'#F0CFC8':'var(--c-border)'};border-radius:10px;padding:8px 12px;font-size:12px;color:${br?'#8E2A1E':'var(--c-text-2)'}">${ic(br?'alert':'range','w-3.5 h-3.5')}<b>${okrDirDown(o)?'Ceiling':'Floor'} ${esc(_okrFmtVal(o,o.floorValue))}</b>&nbsp;${br?'— crossed. This reads Off track whatever the progress % says.':'— must never be crossed; the target '+esc(_okrFmtVal(o,_okrTargetEff(o)))+' is what the % climbs toward.'}</div>`;
  }else if(okrReadsFromKRs(o)){
    const ks=okrActiveKRs(o),p=okrKRParentPct(o);
    const fl=ks.map(k=>okrFlagOf(k)).filter(Boolean);
    out.top=`<div style="display:flex;flex-wrap:wrap;gap:14px 26px;align-items:flex-end">
      ${tile('Progress',(p===null?'—':p+'%'),'')}
      ${tile(o.kind==='kr'?'Linked KPIs':'Key results',ks.length+(okrMeasuresOf(o.id).length>ks.length?' <span style="font-size:12px;color:var(--c-text-3)">+'+(okrMeasuresOf(o.id).length-ks.length)+' closed / draft</span>':''))}
      ${tile('Blocked',fl.filter(f=>f.flag==='blocked').length,fl.some(f=>f.flag==='blocked')?';color:#A63528':'')}
      ${tile('At risk',fl.filter(f=>f.flag==='at_risk').length,fl.some(f=>f.flag==='at_risk')?';color:#7A5A12':'')}
    </div>`;
  }
  /* ramp card: what the plan says for today, for any node with pacing */
  if(okrHasPacing(o)){
    const t=todayISO(),plan=okrPlanValueAt(o,t),cur=okrCurrentOf(o),nx=okrNextCheckpoint(o);
    const delta=(plan===null||cur===null||cur===undefined)?null:Number(cur)-plan;
    const good=delta===null?null:(okrDirDown(o)?delta<=0:delta>=0);
    out.body+=`<div style="margin-top:12px;background:var(--c-surface);border:1px solid var(--c-border);border-radius:12px;padding:11px 13px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="${lab}">Approved ramp</span><span style="font-size:10.5px;color:var(--c-text-3)">· on track is judged against this plan, ±${okrTol(o)} pts</span>${canEd?`<button onclick="App.closeModal();App._okrEdit('${o.id}')" style="margin-left:auto;border:none;background:transparent;color:var(--c-text-3);font-size:11px;font-weight:700;cursor:pointer">edit ramp →</button>`:''}</div>
      <div style="display:flex;flex-wrap:wrap;gap:12px 24px">
        ${tile('Plan today',plan===null?'—':esc(_okrFmtVal(o,plan)),';font-size:17px')}
        ${tile('Actual',(cur===null||cur===undefined)?'—':esc(_okrFmtVal(o,cur)),';font-size:17px')}
        ${delta===null?'':tile('vs plan',(delta>0?'+':'')+esc(_okrFmtVal(o,Math.round(delta*100)/100)),';font-size:17px;color:'+(good?'#2B5638':'#A63528'))}
        ${nx?tile('Next checkpoint',esc(_okrFmtVal(o,nx.value))+' <span style="font-size:11px;color:var(--c-text-3)">by '+esc(fmtS(nx.date))+'</span>',';font-size:17px'):''}
      </div>
    </div>`;
  }
  /* governance notes (proposed / TBD / decision / basis) */
  const gov=[];
  if(o.targetConfirmed===false)gov.push(`<div style="display:flex;gap:8px;align-items:flex-start"><span>${ic('help','w-3.5 h-3.5')}</span><span><b>Target proposed, not confirmed.</b>${o.targetBasis?' Basis: '+esc(o.targetBasis):''}${okrCanConfirm()?` <button onclick="App._okrConfirmTarget('${o.id}')" style="border:none;background:transparent;color:#7A5A12;font-weight:800;cursor:pointer;text-decoration:underline;font-size:12px;padding:0">Confirm it</button>`:''}</span></div>`);
  if(o.ownerTbd&&!okrOwners(o).length)gov.push(`<div style="display:flex;gap:8px;align-items:flex-start"><span>${ic('user','w-3.5 h-3.5')}</span><span><b>Owner to be decided</b> — nobody is asked to update this until someone is named.</span></div>`);
  if(o.needsDecision)gov.push(`<div style="display:flex;gap:8px;align-items:flex-start"><span>${ic('alert','w-3.5 h-3.5')}</span><span><b>Needs a decision:</b> ${esc(o.decisionNote||'flagged for a decision')}${okrCanConfirm()?` <button onclick="App._okrDecided('${o.id}')" style="border:none;background:transparent;color:#8E2A1E;font-weight:800;cursor:pointer;text-decoration:underline;font-size:12px;padding:0">Mark decided</button>`:''}</span></div>`);
  if(o.state==='draft')gov.push(`<div style="display:flex;gap:8px;align-items:flex-start"><span>${ic('doc','w-3.5 h-3.5')}</span><span><b>Draft.</b> Not live yet — excluded from every count, status and alert.${canEd?` <button onclick="App._okrActivate('${o.id}')" style="border:none;background:transparent;color:var(--c-text);font-weight:800;cursor:pointer;text-decoration:underline;font-size:12px;padding:0">Make it live</button>`:''}</span></div>`);
  if(gov.length)out.body+=`<div style="margin-top:10px;background:#FBF7EB;border:1px solid #EEDEC0;border-radius:10px;padding:9px 12px;font-size:12px;color:#5A4A2E;display:flex;flex-direction:column;gap:6px;line-height:1.5">${gov.join('')}</div>`;
  const bt='display:inline-flex;align-items:center;gap:5px;border:1px solid var(--c-border);background:var(--c-surface);border-radius:8px;padding:4px 10px;font-size:11.5px;font-weight:700;color:var(--c-text-2);cursor:pointer';
  /* objective → its key results (each with the KPIs linked beneath it) */
  if(okrIsObjective(o)){
    const krsAll=okrKRsOf(o.id).filter(k=>okrCanSee(k));
    const _canAdd=_okrCanCreate()&&!o.isAnnual&&!o.rollup&&!o.closed&&_okrV4Ready();
    if(krsAll.length||_canAdd){
      out.krs=`<div style="margin-top:12px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap"><span style="${lab}">Key results${krsAll.length?' — '+(okrReadsFromKRs(o)?'this objective reads their average':'alongside its own number'):''}</span><span style="margin-left:auto;display:inline-flex;gap:6px">${_canAdd?`<button onclick="App.closeModal();App._okrEdit(null,'${o.id}','kr')" style="${bt}">${ic('plus','w-3 h-3')}Add key result</button>`:''}</span></div>
        ${krsAll.length?`<div class="okr-krs okr-krs-panel">${krsAll.map(k=>okrKRLineHTML(k,{withKPIs:true})).join('')}</div>`:`<div style="font-size:12px;color:var(--c-text-3);padding:6px 0">None yet. Key results are the numbers, dates and counts that prove this objective — then it needs no target of its own. KPIs Bridge already tracks are linked under a key result.</div>`}
      </div>`;
    }
  }
  /* number key result → the KPIs linked under it */
  if(o.kind==='kr'&&okrCanHoldKPIs(o)){
    const kpisAll=okrKPIsOf(o.id).filter(k=>okrCanSee(k));
    const _canLink=canEd&&_okrV4Ready();
    if(kpisAll.length||_canLink){
      out.krs=`<div style="margin-top:12px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap"><span style="${lab}">Linked KPIs${kpisAll.length?' — '+(okrReadsFromKRs(o)?'this key result reads their average':'alongside its own number'):''}</span><span style="margin-left:auto;display:inline-flex;gap:6px">${_canLink?`<button onclick="App._okrLinkKPI('${o.id}')" style="${bt}">${ic('link','w-3 h-3')}Link KPI</button>`:''}</span></div>
        ${kpisAll.length?`<div class="okr-krs okr-krs-panel">${kpisAll.map(k=>okrKRLineHTML(k,{unlink:_canLink})).join('')}</div>`:`<div style="font-size:12px;color:var(--c-text-3);padding:6px 0">None yet. Link the KPIs Bridge already tracks that prove this key result — with no target of its own it reads their average.</div>`}
      </div>`;
    }
  }
  return out;
}

/* ───────────── linking KPIs: the KPI moves under the objective in the tree ─────────────
   Same mechanics as Move (parent, level map, activity trail) — a KPI keeps its number, owners, check-ins,
   sub-KPIs and annual splits; only its place in the tree changes. */
function okrReparent(o,newParentId,action,detail){
  const oldParent=o.parentId?okrById(o.parentId):null,oldLvl=okrLevel(o);
  const np=newParentId?okrById(newParentId):null;
  if(newParentId&&!np)return 'That objective no longer exists';
  if(np&&np.kind==='kr'&&!(o.kind==='kpi'&&okrCanHoldKPIs(np)))return o.kind==='kpi'?'Only a number key result can hold KPIs':'Only KPIs can sit under a key result';
  if(np&&o.kind==='kpi'&&okrIsObjective(np))return 'KPIs link under a key result, not directly under an objective';
  if(np&&(np.id===o.id||okrDescendants(o.id).some(x=>x.id===np.id)))return 'That would create a loop';
  if(np&&okrIsObjective(o)&&np.kind==='kpi')return 'An objective can’t sit under a KPI';
  if(o.kind==='kr'&&!np)return 'A key result has to sit under an objective';
  if(!np){const eff=okrDeptOf(o);if(!o.departmentId)o.departmentId=eff.deptId||null;if(!o.subDepartmentId)o.subDepartmentId=eff.subDeptId||null;if(!o.departmentId)return 'Give the KPI a department first (Edit → Department) — top-level items need one';}
  o.parentId=np?np.id:null;
  o.sort=okrChildren(o.parentId).filter(x=>x.id!==o.id).length;
  try{_okrRelevel(o.id);}catch(e){}
  okrLog(o.id,action||'Moved objective',Object.assign({changes:[{field:'Parent',from:oldParent?(oldParent.title||'—'):'Top level',to:np?(np.title||'—'):'Top level'},{field:'Level',from:'L'+oldLvl,to:'L'+okrLevel(o)}]},detail||{}));
  if(np)_OKR_EXP[np.id]=true;
  _okrFlagCache={t:0,map:{}};o.updatedAt=new Date().toISOString();_okrPush(o);saveDB();
  return null;
}
/* An objective with nothing typed as a target reads its linked KPIs / KRs the moment the first one lands. */
function _okrAutoKrs(o){
  if(!o||o.metricType==='krs'||o.metricType==='yesno'||o.isAnnual||o.rollup||o.quarterLabel)return false;
  if(o.kind==='kr'&&!okrCanHoldKPIs(o))return false;
  if(o.targetValue!==null&&o.targetValue!==undefined&&o.targetValue!==''&&isFinite(o.targetValue))return false;
  o.metricType='krs';o.startValue=0;o.targetValue=null;o.revisedTarget=null;o.direction='up';o.unit='';o.pacing=[];o.paceTolerance=null;
  okrLog(o.id,o.kind==='kr'?'Measured by linked KPIs':'Measured by key results',{changes:[{field:'Measured by',from:'own number (no target set)',to:o.kind==='kr'?'its linked KPIs':'its key results'}]});
  _okrPush(o);return true;
}
function okrLinkCandidates(obj,q){
  q=String(q||'').trim().toLowerCase();
  return okrVisible().filter(k=>k.kind==='kpi'&&!k.quarterLabel&&!k.closed&&k.id!==obj.id&&k.parentId!==obj.id)
    .filter(k=>!q||(k.title||'').toLowerCase().includes(q)||okrOwners(k).map(u=>{const x=uById(u);return x?fullName(x).toLowerCase():'';}).join(' ').includes(q))
    .sort((a,b)=>String(a.title||'').localeCompare(String(b.title||'')));
}
function _okrLinkRowHTML(objId,k){
  const p=k.parentId?okrById(k.parentId):null;const st=okrStatusOf(k);
  return`<div class="okr-linkrow">
    ${okrKPIChip()}
    <span class="okr-linkmain"><div class="okr-linktitle">${esc(k.title||'Untitled')}</div><div style="font-size:11px;color:var(--c-text-3)">${p?'under '+esc(String(p.title||'').slice(0,40))+((p.title||'').length>40?'…':''):'top level'} · ${okrOwners(k).map(u=>{const x=uById(u);return x?esc(fullName(x)):'';}).filter(Boolean).join(', ')||'no owner'} · ${okrKRValueText(k)}</div></span>
    ${okrStatusChip(st,true)}
    <button class="ui-btn ui-btn-primary ui-btn-sm" onclick="App._okrLinkKPIPick('${objId}','${k.id}')">${ic('link','w-3.5 h-3.5')}Link</button>
  </div>`;
}
function _okrLinkListHTML(o){
  const q=S.filters.okrLinkQ||'';const all=okrLinkCandidates(o,q);const rows=all.slice(0,60);
  return(rows.map(k=>_okrLinkRowHTML(o.id,k)).join('')||`<div style="color:var(--c-text-3);font-size:13px;padding:14px 4px">${q?'No KPI matches “'+esc(q)+'”.':'No KPIs left to link.'}</div>`)+(all.length>rows.length?`<div style="font-size:11.5px;color:var(--c-text-3);padding:8px 4px">${all.length-rows.length} more — type to narrow the list.</div>`:'');
}
App._okrLinkKPI=(objId)=>{
  const o=okrById(objId);if(!o)return;
  if(!_okrV4Ready())return toast('Database update pending — linking needs the v4 migration','err');
  if(!okrCanHoldKPIs(o))return toast('KPIs link under a number key result','warn');
  if(!_okrCanEditNode(o))return toast('You can’t edit this key result','err');
  S.filters.okrLinkQ='';
  const linked=okrKPIsOf(o.id).filter(k=>okrCanSee(k));
  modalShell({title:'Link KPIs',sub:o.title||'',size:'max-w-2xl',key:'okr-link',
    body:`<div style="font-size:12px;color:var(--c-text-2);background:var(--c-surface-2);border-radius:10px;padding:9px 12px;line-height:1.5;margin-bottom:10px">A linked KPI moves under this key result in the tree and shows as a line beneath it on the scoreboard. It keeps its own number, owners, updates and sub-KPIs. ${o.metricType==='krs'?'This key result reads the average of what is linked.':(o.targetValue===null||o.targetValue===undefined)?'This key result has no target of its own, so it will read the average of what you link.':'This key result keeps its own number; linked KPIs show beneath it.'}</div>
      ${linked.length?`<div style="font-size:11px;color:var(--c-text-3);margin-bottom:8px">Already linked: ${linked.map(k=>'<b>'+esc(k.title||'')+'</b>').join(', ')}</div>`:''}
      <input type="search" class="ui-input" placeholder="Search KPIs by title or owner…" oninput="S.filters.okrLinkQ=this.value;const el=document.getElementById('okr-link-list');if(el)el.innerHTML=_okrLinkListHTML(okrById('${o.id}'))" style="margin-bottom:8px" autofocus/>
      <div id="okr-link-list" class="okr-linklist">${_okrLinkListHTML(o)}</div>`,
    footer:btnP('Done',"App.closeModal();App._okrProgressModal('"+o.id+"')",'check')});
  setTimeout(()=>{const i=document.querySelector('#modal input[type=search]');if(i)i.focus();},50);
};
App._okrLinkKPIPick=(objId,kid)=>{
  const o=okrById(objId),k=okrById(kid);if(!o||!k)return;
  if(!_okrCanEditNode(o))return toast('You can’t edit this key result','err');
  if(!(_okrCanEditNode(k)||_okrCanManage()))return toast('You can’t move that KPI — ask its owner, or someone with OKR → Manage','err');
  if(k.kind!=='kpi')return toast('Only KPIs can be linked','warn');
  const err=okrReparent(k,o.id,'Linked to key result',{keyResult:o.title||''});if(err)return toast(err,'err');
  const auto=_okrAutoKrs(o);
  toast('“'+(k.title||'KPI')+'” linked'+(auto?' — the key result now reads its KPIs’ average':''));
  const el=document.getElementById('okr-link-list');if(el)el.innerHTML=_okrLinkListHTML(o);
  rr();
};
App._okrUnlinkKPI=(kid)=>{
  const k=okrById(kid);if(!k||!k.parentId)return;
  const o=okrById(k.parentId);
  if(!(o&&_okrCanEditNode(o))&&!(_okrCanEditNode(k)||_okrCanManage()))return toast('You can’t unlink this KPI','err');
  const err=okrReparent(k,null,'Unlinked from key result',{keyResult:o?(o.title||''):''});if(err)return toast(err,'err');
  toast('“'+(k.title||'KPI')+'” unlinked — now a top-level KPI');
  if(o)App._okrProgressModal(o.id);else rr();
};

/* ───────────── small actions from the panel ───────────── */
function okrCanConfirm(){return can('okr','confirmTarget')||_okrCanManage();}
function _okrV4Save(o,action,details){_okrFlagCache={t:0,map:{}};o.updatedAt=new Date().toISOString();okrLog(o.id,action,details||{});_okrPush(o);saveDB();rr();if(typeof _okrPMRefresh==='function')_okrPMRefresh(o.id);}
App._okrKRDone=(id)=>{const o=okrById(id);if(!o||!(_okrCanCheckin(o)||_okrCanEditNode(o)))return toast('You can’t update this key result','err');if(o.closed)return toast('Closed — reopen it first','warn');o.doneAt=new Date().toISOString();o.doneBy=S.uid;_okrV4Save(o,'Milestone done',{date:todayISO()});toast('Marked done');};
App._okrKRDoneOn=(id)=>{const o=okrById(id);if(!o||!(_okrCanCheckin(o)||_okrCanEditNode(o)))return;const d=prompt('Done on which date? (YYYY-MM-DD)',todayISO());if(!d)return;if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||isNaN(new Date(d+'T00:00:00')))return toast('Use the format YYYY-MM-DD','err');o.doneAt=d+'T12:00:00.000Z';o.doneBy=S.uid;_okrV4Save(o,'Milestone done',{date:d});toast('Marked done on '+fmtS(d));};
App._okrKRUndone=(id)=>{const o=okrById(id);if(!o||!(_okrCanCheckin(o)||_okrCanEditNode(o)))return;o.doneAt=null;o.doneBy=null;_okrV4Save(o,'Milestone reopened',{});toast('Marked not done');};
App._okrItemTog=(id,i)=>{const o=okrById(id);if(!o||!(_okrCanCheckin(o)||_okrCanEditNode(o)))return toast('You can’t update this key result','err');if(o.closed)return toast('Closed — reopen it first','warn');const its=okrItems(o);const x=its[i];if(!x)return;if(x.doneAt){x.doneAt=null;x.doneBy=null;}else{x.doneAt=new Date().toISOString();x.doneBy=S.uid;}o.items=its;_okrV4Save(o,x.doneAt?'Item done':'Item reopened',{item:x.name});};
App._okrConfirmTarget=(id)=>{const o=okrById(id);if(!o)return;if(!okrCanConfirm())return toast('You need OKR → Confirm targets','err');o.targetConfirmed=true;_okrV4Save(o,'Target confirmed',{target:o.targetValue,basis:o.targetBasis||''});toast('Target confirmed');};
App._okrDecided=(id)=>{const o=okrById(id);if(!o)return;if(!okrCanConfirm())return toast('You need OKR → Confirm targets','err');o.needsDecision=false;_okrV4Save(o,'Decision taken',{note:o.decisionNote||''});toast('Marked decided');};
App._okrActivate=(id)=>{const o=okrById(id);if(!o||!_okrCanEditNode(o))return;o.state='active';_okrV4Save(o,'Made live',{});toast('Now live');};

/* ═════════════════════════════ 3. EDITOR SECTIONS ═════════════════════════════ */
App._okrEdSetKRKind=(v)=>{const o=_OKRED;if(!o)return;o.krKind=(v==='milestone'||v==='count'||v==='range')?v:'metric';
  if(o.krKind==='milestone'){o.metricType='yesno';}else if(o.krKind==='count'){o.metricType='number';if(!Array.isArray(o.items))o.items=[];}
  else if(o.metricType==='yesno')o.metricType='number';
  App._renderOKREdit();};
function okrEdKRKindSection(o,L){
  const kk=okrKRKind(o);
  const opt=(k)=>{const m=OKR_KR_KINDS.find(x=>x[0]===k);const on=kk===k;const im=OKR_KR_KIND_META[k];return`<button type="button" onclick="App._okrEdSetKRKind('${k}')" style="text-align:left;padding:9px 11px;border-radius:10px;border:1.5px solid ${on?'var(--c-text)':'var(--c-border)'};background:${on?'var(--c-ink)':'var(--c-surface)'};color:${on?'#fff':'var(--c-text)'};cursor:pointer"><div style="display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800">${ic(im.icon,'w-3.5 h-3.5')}${m[1]}</div></button>`;};
  const cur=OKR_KR_KINDS.find(x=>x[0]===kk);
  let extra='';
  if(kk==='milestone'){
    extra=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">
      <div><label style="${L}">Due by *</label><input type="date" value="${o.dueDate||''}" onchange="_OKRED.dueDate=this.value||null" class="ui-input rf"/></div>
      <div><label style="${L}">Done on</label><input type="date" value="${o.doneAt?String(o.doneAt).slice(0,10):''}" onchange="_OKRED.doneAt=this.value?(this.value+'T12:00:00.000Z'):null;_OKRED.doneBy=this.value?S.uid:null" class="ui-input rf"/></div>
    </div><div style="font-size:11px;color:var(--c-text-3);margin-top:6px">Leave “Done on” empty until it lands — the owner can tick it from the panel. Multi-phase launches (Phase 1 / Phase 2) are two milestones.</div>`;
  }else if(kk==='count'){
    const its=Array.isArray(o.items)?o.items:(o.items=[]);
    extra=`<div style="margin-top:10px"><label style="${L}">Items to count *</label>
      <div style="border:1.5px solid var(--c-border);border-radius:12px;background:var(--c-surface);overflow:hidden">
        ${its.map((x,i)=>`<div style="display:grid;grid-template-columns:1fr 128px 28px;gap:6px;align-items:center;padding:6px 8px;border-bottom:1px solid var(--c-border)">
          <input type="text" value="${esc(x.name||'')}" oninput="_OKRED.items[${i}].name=this.value" placeholder="e.g. VAT filing — Q4" class="ui-input" style="min-height:32px;padding:4px 8px;font-size:12.5px"/>
          <input type="date" value="${x.due||''}" onchange="_OKRED.items[${i}].due=this.value||null" class="ui-input" style="min-height:32px;padding:4px 6px;font-size:12px" title="Due date (optional)"/>
          <button type="button" onclick="_OKRED.items.splice(${i},1);App._renderOKREdit()" aria-label="Remove" style="width:26px;height:26px;border-radius:7px;border:none;background:transparent;color:var(--c-text-3);cursor:pointer;font-size:15px">×</button>
        </div>`).join('')}
        <div style="padding:7px 8px;display:flex;gap:6px"><button type="button" onclick="_OKRED.items.push({id:uid('it'),name:'',due:null,doneAt:null,doneBy:null});App._renderOKREdit()" class="ui-btn ui-btn-ghost ui-btn-sm">${ic('plus','w-3.5 h-3.5')}Add item</button>
        <button type="button" onclick="App._okrEdItemsBulk()" class="ui-btn ui-btn-ghost ui-btn-sm" title="Paste one item per line">Paste a list</button></div>
      </div>
      <div style="font-size:11px;color:var(--c-text-3);margin-top:6px">${its.length} item${its.length===1?'':'s'} — the target is the count. Progress is done ÷ total; an item past its date reads Off track until it’s ticked.</div></div>`;
  }else if(kk==='range'){
    extra=`<div style="margin-top:10px"><label style="${L}">${okrDirDown(o)?'Ceiling — must never go above *':'Floor — must never go below *'}</label>
      <input type="number" step="any" value="${o.floorValue!==null&&o.floorValue!==undefined?o.floorValue:''}" oninput="_OKRED.floorValue=this.value===''?null:parseFloat(this.value)" placeholder="e.g. 3" class="ui-input rf"/>
      <div style="font-size:11px;color:var(--c-text-3);margin-top:6px">The <b>target</b> below is the level to build to (e.g. 6); the % climbs start → target as usual. Cross the ${okrDirDown(o)?'ceiling':'floor'} and the status reads <b>Off track</b> regardless.</div></div>`;
  }
  return`<div style="border-top:1px dashed var(--c-border);padding-top:12px"><label style="${L}">Kind of key result</label>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px">${OKR_KR_KINDS.map(k=>opt(k[0])).join('')}</div>
    <div style="font-size:11px;color:var(--c-text-3);margin-top:7px;line-height:1.5">${cur?cur[2]:''}</div>
    ${extra}
  </div>`;
}
App._okrEdItemsBulk=()=>{const o=_OKRED;if(!o)return;const txt=prompt('One item per line (optionally add a date after a | : "VAT filing Q4 | 2026-01-28")');if(!txt)return;String(txt).split(/\r?\n/).map(s=>s.trim()).filter(Boolean).forEach(line=>{const parts=line.split('|').map(s=>s.trim());o.items.push({id:uid('it'),name:parts[0],due:(parts[1]&&/^\d{4}-\d{2}-\d{2}$/.test(parts[1]))?parts[1]:null,doneAt:null,doneBy:null});});App._renderOKREdit();};

/* Approved ramp table (metric & range) */
function okrEdRampSection(o,L){
  if(o.metricType==='yesno'||okrIsThresh(o)||!_okrV4Ready())return'';
  const pts=Array.isArray(o.pacing)?o.pacing:(o.pacing=[]);
  const parent=o.parentId?okrById(o.parentId):null;
  const open=!!(pts.length||o._rampOpen);
  return`<div style="border-top:1px dashed var(--c-border);padding-top:12px">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
      <div style="min-width:0"><label style="${L}">Approved ramp (optional)</label>
        <div style="font-size:11px;color:var(--c-text-3);margin-top:2px;line-height:1.5">Month-by-month checkpoints the plan was actually approved on (e.g. Dec 540 · Jan 490 · Feb 640). <b>On track</b> is then judged against this curve instead of an even split from start to target, and the graph draws it.</div></div>
      <button type="button" role="switch" aria-checked="${open?'true':'false'}" class="tog ${open?'on':'off'}" style="margin-top:2px" onclick="_OKRED._rampOpen=!${open};if(!_OKRED._rampOpen)_OKRED.pacing=[];App._renderOKREdit()"><span></span></button>
    </div>
    ${open?`<div style="margin-top:10px;border:1.5px solid var(--c-border);border-radius:12px;background:var(--c-surface);overflow:hidden">
      <div style="display:grid;grid-template-columns:1fr 1fr 28px;gap:6px;padding:6px 8px;font-size:10px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid var(--c-border)"><span>By date</span><span>Planned value${o.unit?' ('+esc(o.unit)+')':''}</span><span></span></div>
      ${pts.map((p,i)=>`<div style="display:grid;grid-template-columns:1fr 1fr 28px;gap:6px;align-items:center;padding:5px 8px;border-bottom:1px solid var(--c-border)">
        <input type="date" value="${p.date||''}" onchange="_OKRED.pacing[${i}].date=this.value" class="ui-input" style="min-height:32px;padding:4px 6px;font-size:12px"/>
        <input type="number" step="any" value="${p.value!==null&&p.value!==undefined?p.value:''}" oninput="_OKRED.pacing[${i}].value=this.value===''?null:parseFloat(this.value)" class="ui-input" style="min-height:32px;padding:4px 8px;font-size:12.5px" placeholder="e.g. 540"/>
        <button type="button" onclick="_OKRED.pacing.splice(${i},1);App._renderOKREdit()" aria-label="Remove" style="width:26px;height:26px;border-radius:7px;border:none;background:transparent;color:var(--c-text-3);cursor:pointer;font-size:15px">×</button>
      </div>`).join('')}
      <div style="padding:7px 8px;display:flex;gap:6px;flex-wrap:wrap">
        <button type="button" onclick="App._okrEdRampAdd()" class="ui-btn ui-btn-ghost ui-btn-sm">${ic('plus','w-3.5 h-3.5')}Add checkpoint</button>
        <button type="button" onclick="App._okrEdRampMonthly()" class="ui-btn ui-btn-ghost ui-btn-sm" title="One row per month-end between the period dates, values left for you to fill">Month-ends</button>
        <button type="button" onclick="App._okrEdRampPaste()" class="ui-btn ui-btn-ghost ui-btn-sm" title="Paste rows like: Dec 26 | 540  or  2026-12-31, 540">Paste</button>
        ${parent&&okrHasPacing(parent)?`<button type="button" onclick="App._okrEdRampFromParent()" class="ui-btn ui-btn-ghost ui-btn-sm" title="Copy the parent's ramp, scaled to this start → target">Copy parent’s shape</button>`:''}
        ${pts.length?`<button type="button" onclick="_OKRED.pacing.sort((a,b)=>String(a.date).localeCompare(String(b.date)));App._renderOKREdit()" class="ui-btn ui-btn-ghost ui-btn-sm">Sort</button>`:''}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">
      <div><label style="${L}">Tolerance (pts)</label><input type="number" min="0" max="100" step="1" value="${o.paceTolerance!==null&&o.paceTolerance!==undefined?o.paceTolerance:''}" oninput="_OKRED.paceTolerance=this.value===''?null:parseFloat(this.value)" placeholder="default ${okrDefaultTol()}" class="ui-input rf"/></div>
      <div style="font-size:11px;color:var(--c-text-3);align-self:end;padding-bottom:6px;line-height:1.45">How far behind the plan (in % points) still reads On track. Blank = the Settings default.</div>
    </div>`:''}
  </div>`;
}
App._okrEdRampAdd=()=>{const o=_OKRED;if(!o)return;o.pacing=o.pacing||[];const last=o.pacing[o.pacing.length-1];let d=last&&last.date?_okrDateAddM(last.date,1):(o.periodStart?_okrDateAddM(o.periodStart,1):todayISO());o.pacing.push({date:d,value:null});App._renderOKREdit();};
App._okrEdRampMonthly=()=>{const o=_OKRED;if(!o)return;if(!o.periodStart||!o.periodEnd)return toast('Set the period start and end first','warn');const out=[];let d=new Date(o.periodStart+'T00:00:00');d=new Date(d.getFullYear(),d.getMonth()+1,0);const end=new Date(o.periodEnd+'T00:00:00');while(d<end){out.push({date:_okrISO(d),value:null});d=new Date(d.getFullYear(),d.getMonth()+2,0);}if(!out.length)return toast('The period is shorter than a month','warn');const have=new Set((o.pacing||[]).map(p=>p.date));o.pacing=(o.pacing||[]).concat(out.filter(p=>!have.has(p.date))).sort((a,b)=>String(a.date).localeCompare(String(b.date)));App._renderOKREdit();};
App._okrEdRampPaste=()=>{const o=_OKRED;if(!o)return;const txt=prompt('Paste checkpoints, one per line.\nAccepted: "2026-12-31 | 540"  ·  "Dec 26, 540"  ·  "Dec 2026 540"');if(!txt)return;
  const MON={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,sept:8,oct:9,nov:10,dec:11};const out=[];
  String(txt).split(/\r?\n/).forEach(line=>{line=line.trim();if(!line)return;let m=line.match(/^(\d{4}-\d{2}-\d{2})\s*[|,;\t ]\s*([-\d.,]+)/);if(m){out.push({date:m[1],value:Number(m[2].replace(/,/g,''))});return;}
    m=line.match(/^([A-Za-z]{3,})\.?\s+(\d{2,4})\s*[|,;\t ]\s*([-\d.,]+)/);if(m&&MON[m[1].slice(0,4).toLowerCase()]!==undefined||(m&&MON[m[1].slice(0,3).toLowerCase()]!==undefined)){const mi=MON[m[1].slice(0,4).toLowerCase()]!==undefined?MON[m[1].slice(0,4).toLowerCase()]:MON[m[1].slice(0,3).toLowerCase()];let y=Number(m[2]);if(y<100)y+=2000;const last=new Date(y,mi+1,0);out.push({date:_okrISO(last),value:Number(m[3].replace(/,/g,''))});}});
  if(!out.length)return toast('Couldn’t read any rows — use "2026-12-31 | 540" or "Dec 26 | 540"','err');
  const byDate={};(o.pacing||[]).concat(out).forEach(p=>{if(p.date&&isFinite(p.value))byDate[p.date]=p;});o.pacing=Object.values(byDate).sort((a,b)=>String(a.date).localeCompare(String(b.date)));App._renderOKREdit();toast(out.length+' checkpoint'+(out.length===1?'':'s')+' added');};
/* Copy the parent's ramp SHAPE: each parent point's % of its own climb, mapped onto this node's start → target. */
App._okrEdRampFromParent=()=>{const o=_OKRED;if(!o)return;const p=o.parentId?okrById(o.parentId):null;if(!p||!okrHasPacing(p))return;
  const ps=Number(p.startValue||0),pt=_okrTargetEff(p);const s=Number(o.startValue||0),t=(o.targetValue===null||o.targetValue===undefined)?null:Number(o.targetValue);
  if(pt===null||!isFinite(pt)||pt===ps||t===null||!isFinite(t))return toast('Set this key result’s start and target first','warn');
  o.pacing=okrPacingPts(p).map(q=>({date:q.date,value:Math.round((s+(t-s)*((q.value-ps)/(pt-ps)))*100)/100}));o._rampOpen=true;App._renderOKREdit();toast('Ramp copied from “'+(p.title||'parent')+'”, scaled to this target');};

/* Plan & governance block, at the bottom of the editor */
function okrEdGovernanceSection(o,L,parent,isExisting){
  if(!_okrV4Ready())return`<div style="border-top:1px dashed var(--c-border);padding-top:12px"><div class="sb-pending">${ic('alert','w-3.5 h-3.5')} Database update pending — North Star, ramps, proposed targets, drafts and the other v4 fields are hidden until migration <b>2026-10-02_v400_okr_v4.sql</b> has been applied.</div></div>`;
  const isRoot=!o.parentId;
  const canMg=_okrCanManage();
  const canConf=okrCanConfirm();
  const row=(label,sub,ctl)=>`<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:9px 0;border-top:1px solid var(--c-border)"><div style="min-width:0"><div style="font-size:12.5px;font-weight:700;color:var(--c-text)">${label}</div>${sub?`<div style="font-size:11px;color:var(--c-text-3);margin-top:2px;line-height:1.45">${sub}</div>`:''}</div><div style="flex-shrink:0">${ctl}</div></div>`;
  const tog=(k,on,dis)=>`<button type="button" role="switch" aria-checked="${on?'true':'false'}" class="tog ${on?'on':'off'}" ${dis?'disabled style="opacity:.45"':''} onclick="_OKRED.${k}=!_OKRED.${k};App._renderOKREdit()"><span></span></button>`;
  const roots=(DB.okrs||[]).filter(x=>x.kind!=='kr'&&!x.quarterLabel&&x.id!==o.id&&x.state!=='draft'&&okrCanSee(x)&&(x.isNorthStar||!x.parentId));
  return`<div style="border-top:1px dashed var(--c-border);padding-top:12px">
    <label style="${L}">Plan & governance</label>
    <div style="font-size:11px;color:var(--c-text-3);margin-bottom:4px;line-height:1.45">Everything here shows on the card and the scoreboard and feeds the “Need a decision” count at the top of the Scoreboard.</div>
    ${isRoot&&o.kind!=='kr'?row('North Star','The one company number everything else serves. Shown as the hero at the top of the Scoreboard; the engines below declare that they count toward it.'+(canMg?'':' <i>(Manage permission needed)</i>'),tog('isNorthStar',!!o.isNorthStar,!canMg)):''}
    ${row('Target confirmed','Off = <b>proposed</b> — benchmarked but not agreed yet. Shows a PROPOSED tag and sits in “needs a decision” until confirmed.'+(canConf?'':' <i>(Confirm-targets permission needed to switch it on)</i>'),tog('targetConfirmed',o.targetConfirmed!==false,!canConf&&o.targetConfirmed===false))}
    ${o.targetConfirmed===false?`<div style="padding:0 0 9px"><input type="text" value="${esc(o.targetBasis||'')}" oninput="_OKRED.targetBasis=this.value" placeholder="Where the proposed number came from (e.g. standard 3–6 month reserve guidance)" class="ui-input rf" style="font-size:12.5px"/></div>`:''}
    ${o.kind==='kr'?row('Leading or lagging','Leading moves first (engines on schedule, site visits); lagging is the result (orders, revenue). A label, nothing more.',`<select class="ui-select" style="min-width:130px" onchange="_OKRED.leadLag=this.value||null"><option value="" ${!o.leadLag?'selected':''}>—</option><option value="leading" ${o.leadLag==='leading'?'selected':''}>Leading</option><option value="lagging" ${o.leadLag==='lagging'?'selected':''}>Lagging</option></select>`):''}
    ${roots.length?row('Counts toward','Declare that this target is a slice of a bigger number — e.g. an engine’s +150 orders/day counts toward the North Star’s 1,000. The hero then shows promised vs delivered across all contributors.',`<select class="ui-select" style="max-width:220px" onchange="_OKRED.contributesTo=this.value||null"><option value="" ${!o.contributesTo?'selected':''}>— nothing —</option>${roots.map(r=>`<option value="${r.id}" ${o.contributesTo===r.id?'selected':''}>${r.isNorthStar?'★ ':''}${esc((r.title||'').slice(0,60))}</option>`).join('')}</select>`):''}
    ${row('Owner to be decided','Save without an owner. Flagged on the card and the scoreboard until someone is named; no reminders go out meanwhile.',tog('ownerTbd',!!o.ownerTbd&&!okrOwners(o).length,okrOwners(o).length>0))}
    ${row('Needs a decision','Flag it for leadership with a note (e.g. “confirm the critical link to the North Star, or remove”). Counted under “Need a decision” on the Scoreboard.',tog('needsDecision',!!o.needsDecision))}
    ${o.needsDecision?`<div style="padding:0 0 9px"><input type="text" value="${esc(o.decisionNote||'')}" oninput="_OKRED.decisionNote=this.value" placeholder="What has to be decided, by whom" class="ui-input rf" style="font-size:12.5px"/></div>`:''}
    ${row('Draft','Not live: excluded from counts, statuses, reminders and alerts. Use it to park 2027 ideas or anything awaiting approval.',tog('_draft',o.state==='draft'))}
    ${row('Baseline as of','The date the start value was measured (e.g. the Q1–Q3 retrospective). Shown with the start value.',`<input type="date" value="${o.baselineAsOf||''}" onchange="_OKRED.baselineAsOf=this.value||null" class="ui-input" style="min-height:34px;padding:4px 8px;font-size:12px"/>`)}
  </div>`;
}
/* `_draft` is a view-model switch mapped onto state on every render */
(function(){const _r=App._renderOKREdit;App._renderOKREdit=function(){const o=_OKRED;if(o){if(o._draft===undefined)o._draft=o.state==='draft';o.state=o._draft?'draft':'active';}return _r.apply(this,arguments);};})();
(function(){const _s=App._okrSave;App._okrSave=function(){const o=_OKRED;if(o&&o._draft!==undefined)o.state=o._draft?'draft':'active';
  const r=_s.apply(this,arguments);
  /* saved ⇔ the editor's object is now the live row (same reference) — then drop the editor-only switches */
  try{if(o&&(DB.okrs||[]).includes(o)){delete o._draft;delete o._rampOpen;}}catch(e){}
  return r;};})();

/* ═════════════════════════════ 4. TABS ═════════════════════════════ */
function okrTab(){const t=S.filters.okrTab;return(t==='scoreboard'||t==='objectives')?t:'scoreboard';}
App._okrTab=(t)=>{S.filters.okrTab=t;S.filters.okrMSOpen=null;S.filters.okrQtrOpen=false;rr();};
function okrTabsHTML(cur){
  const t=(k,label,icon,show)=>show===false?'':`<button class="ui-tab ${cur===k?'on':''}" onclick="App._okrTab('${k}')">${ic(icon,'w-3.5 h-3.5')}${label}</button>`;
  return`<div class="ui-tabs okr-tabs" style="margin-bottom:12px">${t('scoreboard','OKR','star')}${t('objectives','KPIs','target')}</div>`;
}


/* ═════════════════════════════ 5. SCOREBOARD ═════════════════════════════ */
/* The leadership read: North Star hero(s) with the approved ramp and the engines that count
   toward it, then one section per L0 laid out like the proposal's tables —
   Lvl · Objective (with its why) · Key results · Owner · Status (computed + the owner's flag).
   Read-only: every row opens the same Progress & Updates popup as the tree. */
function _sbOwnerCell(o){
  const owners=okrOwners(o).map(uById).filter(Boolean);
  if(!owners.length)return o.ownerTbd?`<span class="sb-tbd">${ic('user','w-3 h-3')}To be decided</span>`:`<span style="color:var(--c-text-3)">—</span>`;
  return`<span class="sb-owner" title="${esc(owners.map(fullName).join(', '))}">${owners.slice(0,2).map((u,i)=>`<span style="display:inline-flex;${i?'margin-left:-6px;':''}border-radius:50%;box-shadow:0 0 0 1.5px var(--c-surface)">${avatar(u,'w-6 h-6','text-[9px]')}</span>`).join('')}<span class="sb-owner-name">${esc(fullName(owners[0]))}${owners.length>1?' <span style="color:var(--c-text-3)">+'+(owners.length-1)+'</span>':''}</span></span>`;
}
/* An objective without key results shows its own number in the KR column, in the same shape. */
function okrOwnMetricLine(o){
  if(!o.isAnnual&&!o.rollup&&o.metricType!=='yesno'&&(o.targetValue===null||o.targetValue===undefined)&&okrCurrentOf(o)===null)return'';
  const st=okrStatusOf(o),m=OKR_ST_META[st]||OKR_ST_META['No data'];
  const pct=okrNoPct(o)?null:okrProgress(o);
  let val;
  if(o.metricType==='yesno')val=(okrLatestCheckin(o.id)||{}).value>=1?'Done':'Not done';
  else if(o.isAnnual||o.rollup){const c=okrCurrentOf(o);val=((c===null||c===undefined)?'—':esc(_okrFmtVal(o,c)))+' <span style="opacity:.55">'+(_okrTargetSign(o)||'/')+'</span> '+esc(_okrFmtVal(o,_okrTargetEff(o)))+(o.isAnnual?' <span style="opacity:.6">· from quarters</span>':' <span style="opacity:.6">· roll-up</span>');}
  else val=esc(_okrFmtVal(o,_okrOwnCur(o)))+' <span style="opacity:.55">'+(_okrTargetSign(o)||'/')+'</span> '+esc(_okrFmtVal(o,_okrTargetEff(o)));
  return`<div class="okr-krline okr-krline-own" title="${esc(st)}">
    <span class="okr-krdot" style="background:${m.dot}"></span>
    <span class="okr-krico">${ic('trend','w-3 h-3')}</span>
    <span class="okr-krtitle" style="color:var(--c-text-2)">${o.metricType==='yesno'?'Done / not done':(o.isAnnual?'From quarters':o.rollup?'Roll-up':'Latest')+(o.metricType==='percent'?' <span style="opacity:.6">· %</span>':(o.unit?' <span style="opacity:.6">· '+esc(o.unit)+'</span>':''))}</span>
    <span class="okr-krval">${val}</span>
    ${pct===null?'':`<span class="okr-krpct">${pct}%</span>`}
  </div>`;
}
/* Nesting state for the scoreboard: which objectives are open. Collapsed by default; remembered with the
   tab's other filters (survives reload). */
/* Nested rows under a node: an objective's sub-objectives (its KPIs are lines, not rows); a KPI's sub-KPIs. */
function _sbKids(o,showDrafts){return okrChildren(o.id).filter(k=>k.kind!=='kr'&&!k.quarterLabel&&(okrIsKPI(o)||k.kind!=='kpi')&&okrCanSee(k)&&(showDrafts||k.state!=='draft'));}
function _sbExp(id){const m=S.filters.okrSbExp;return !!(m&&typeof m==='object'&&m[id]);}
App._okrSbTog=(id)=>{const m=(S.filters.okrSbExp&&typeof S.filters.okrSbExp==='object')?S.filters.okrSbExp:{};if(m[id])delete m[id];else m[id]=true;S.filters.okrSbExp=m;rr();};
App._okrSbExpandAll=(on)=>{const m={};if(on){const sd=!!S.filters.okrSbDrafts;(DB.okrs||[]).forEach(o=>{if(o.kind!=='kr'&&!o.quarterLabel&&_sbKids(o,sd).length)m[o.id]=true;});}S.filters.okrSbExp=m;rr();};
function _sbRow(o,depth,isHead,kidsN,exp){
  const st=okrStatusOf(o),f=okrFlagOf(o),pct=okrNoPct(o)?null:okrProgress(o);
  const krs=(okrIsKPI(o)?okrKRsOf(o.id):okrMeasuresOf(o.id)).filter(k=>okrCanSee(k)&&(k.state!=='draft'||S.filters.okrSbDrafts));
  const lvl=okrLevel(o);const kidLabel=okrIsKPI(o)?'sub-KPI':'sub-objective';
  const chev=kidsN?`<button class="sb-chev${exp?' on':''}" onclick="event.stopPropagation();App._okrSbTog('${o.id}')" title="${exp?'Collapse':'Expand'} ${kidsN} ${kidLabel}${kidsN===1?'':'s'}" aria-expanded="${exp?'true':'false'}">${ic('chevR','w-3.5 h-3.5')}</button>`:`<span class="sb-chev sb-chev-leaf"></span>`;
  /* own number first (unless the objective is measured BY its KRs), then every key result */
  const own=okrReadsFromKRs(o)?'':okrOwnMetricLine(o);
  const krCol=(own+krs.map(k=>okrKRLineHTML(k,{withKPIs:true})).join(''))||'<span style="color:var(--c-text-3);font-size:11.5px">No target or key results yet</span>';
  return`<div class="sb-row sb-d${Math.min(depth,4)}${isHead?' sb-row-head':''}${o.state==='draft'?' sb-draft':''}" onclick="App._okrProgressModal('${o.id}')" title="Open">
    <div class="sb-c sb-lvl">${chev}${okrIsKPI(o)?okrKPIChip():_okrLvlChip(lvl)}</div>
    <div class="sb-c sb-obj">
      <div class="sb-title">${esc(o.title||'Untitled')}${o.isAnnual?' '+_okrAnnualChip():''}</div>
      ${(o.description||'').trim()?`<div class="sb-why">${esc(o.description)}</div>`:''}
      ${okrBadgesHTML(o)||kidsN?`<div class="sb-badges">${okrBadgesHTML(o)}${kidsN?`<button class="sb-subtog" onclick="event.stopPropagation();App._okrSbTog('${o.id}')">${ic('tree','w-3 h-3')}${kidsN} ${kidLabel}${kidsN===1?'':'s'} <span style="display:inline-flex;transform:${exp?'rotate(180deg)':'none'}">${ic('chevD','w-3 h-3')}</span></button>`:''}</div>`:''}
    </div>
    <div class="sb-c sb-krs"><div class="okr-krs">${krCol}</div></div>
    <div class="sb-c sb-own">${_sbOwnerCell(o)}</div>
    <div class="sb-c sb-st">
      <div class="sb-stline">${okrStatusChip(st,true)}${f?okrFlagChip(f.flag,true,f):''}</div>
      ${pct===null?'':`<div class="sb-bar" title="${pct}% of target"><div class="sb-track"><div style="width:${Math.max(0,Math.min(100,pct))}%;background:${_okrBarColor(st)}"></div></div><span>${pct}%</span></div>`}
    </div>
  </div>`;
}
function _sbWalk(o,depth,out,showDrafts){
  if(depth>8)return;
  _sbKids(o,showDrafts).forEach(k=>{const kk=_sbKids(k,showDrafts);const exp=_sbExp(k.id);out.push(_sbRow(k,depth,false,kk.length,exp));if(exp)_sbWalk(k,depth+1,out,showDrafts);});
}
/* "Bolt — launch and scale…" -> "Bolt" for the engines table; the full title stays in the tooltip */
function _sbShortTitle(t){t=String(t||'');const m=t.match(/^(.{2,40}?)\s[—\u2013:-]\s/);return m?m[1]:(t.length>48?t.slice(0,46)+'…':t);}
/* Hero figures: full digits below a million ("1,000", "342.6"), decimals no finer than the plan uses. */
function _sbNum(o,v){
  if(v===null||v===undefined||!isFinite(v))return{num:'—',unit:''};
  const dec=Math.max(0,...okrPacingPts(o).concat([{value:Number(o.targetValue||0)},{value:Number(o.startValue||0)}]).map(p=>{const s=String(p.value);const i=s.indexOf('.');return i<0?0:Math.min(2,s.length-i-1);}));
  const n=Number(v);
  const num=Math.abs(n)>=1e6?_fmtAbbr(Math.round(n*100)/100):n.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:dec});
  if(o.metricType==='percent')return{num:num+'%',unit:''};
  if(o.metricType==='currency')return{num:(o.unit?o.unit+' ':'')+num,unit:''};
  return{num:num,unit:o.unit||''};
}
function _sbHero(ns){
  const today=todayISO();
  const cur=okrCurrentOf(ns),s=Number(ns.startValue||0),t=_okrTargetEff(ns),pct=okrNoPct(ns)?null:okrProgress(ns),st=okrStatusOf(ns),f=okrFlagOf(ns);
  const plan=okrHasPacing(ns)?okrPlanValueAt(ns,today):null;
  const delta=(plan===null||cur===null||cur===undefined)?null:Number(cur)-plan;
  const good=delta===null?null:(okrDirDown(ns)?delta<=0:delta>=0);
  const nx=okrNextCheckpoint(ns);
  const c=okrContribSummary(ns);
  const measuredDelta=(cur===null||cur===undefined)?null:Number(cur)-s;
  const fmt=v=>esc(_sbNum(ns,v).num);
  const unit=esc(_sbNum(ns,1).unit);
  const tile=(l,v,sub,cls)=>`<div class="sb-tile ${cls||''}"><div class="sb-tile-l">${l}</div><div class="sb-tile-v">${v}</div>${sub?`<div class="sb-tile-s">${sub}</div>`:''}</div>`;
  const krs=okrMeasuresOf(ns.id).filter(k=>okrCanSee(k)&&k.state!=='draft');
  return`<section class="sb-hero" onclick="App._okrProgressModal('${ns.id}')">
    <div class="sb-hero-main">
      <div class="sb-hero-tags">${okrBadgesHTML(ns)}${okrStatusChip(st)}${f?okrFlagChip(f.flag,false,f):''}<span class="sb-hero-owner">${_sbOwnerCell(ns)}</span></div>
      <h2 class="sb-hero-title">${esc(ns.title||'North Star')}</h2>
      ${(ns.description||'').trim()?`<p class="sb-hero-why">${esc(ns.description)}</p>`:''}
      ${krs.length?`<div class="okr-krs sb-hero-krs">${krs.map(k=>okrKRLineHTML(k,{withKPIs:true})).join('')}</div>`:''}
    </div>
    <div class="sb-hero-tiles">
      ${tile('Today',(cur===null||cur===undefined)?'—':fmt(cur),(unit?unit+' · ':'')+(pct===null?'':pct+'% of the way'),' sb-tile-big')}
      ${okrHasPacing(ns)?tile('Plan for today',plan===null?'—':fmt(plan),delta===null?unit:'<b style="color:'+(good?'#2B5638':'#A63528')+'">'+(delta>0?'+':'')+fmt(Math.round(delta*100)/100)+'</b> vs plan'):tile('Start',fmt(s),ns.baselineAsOf?'as of '+esc(fmtS(ns.baselineAsOf)):unit)}
      ${tile('Target',t===null?'—':fmt(t),(unit?unit+(ns.periodEnd?' · ':''):'')+(ns.periodEnd?'by '+esc(fmtS(ns.periodEnd)):''))}
      ${nx?tile('Next checkpoint',fmt(nx.value),(unit?unit+' · ':'')+'by '+esc(fmtS(nx.date))):tile('Progress',pct===null?'—':pct+'%','of the way')}
    </div>
    <div class="sb-hero-chart" onclick="event.stopPropagation()"><canvas data-okr-chart="${ns.id}"></canvas></div>
    ${c.count?`<div class="sb-engines" onclick="event.stopPropagation()">
      <div class="sb-eng-head"><span>${c.count} engine${c.count===1?'':'s'} count toward this</span><span class="sb-eng-sum">promised <b>${c.promised>=0?'+':''}${fmt(c.promised)}</b> · delivered <b>${c.delivered>=0?'+':''}${fmt(c.delivered)}</b>${measuredDelta===null?'':' · measured <b>'+(measuredDelta>=0?'+':'')+fmt(measuredDelta)+'</b>'+(Math.abs(measuredDelta-c.delivered)>0.0001?' <span title="Measured change minus what the engines report — growth nobody has claimed, or double counting">(unattributed '+(measuredDelta-c.delivered>=0?'+':'')+fmt(Math.round((measuredDelta-c.delivered)*100)/100)+')</span>':'')}${unit?' '+unit:''}</span></div>
      <div class="sb-eng-rows">
        <div class="sb-eng-row sb-eng-th"><span>Engine</span><span>Owner</span><span class="sb-r">Promised</span><span class="sb-r">Delivered</span><span class="sb-r">Progress</span><span>Status</span></div>
        ${c.rows.map(r=>{const eo=(r.o.kind==='kr'&&r.o.parentId)?(okrById(r.o.parentId)||r.o):r.o;return`<div class="sb-eng-row" onclick="App._okrProgressModal('${r.o.id}')"><span class="sb-eng-name" title="${esc(eo.title||'')}">${esc(_sbShortTitle(eo.title))}${eo!==r.o?`<span class="sb-eng-kr">${esc(r.o.title||'')}</span>`:''}${okrBadgesHTML(eo,{noLead:true})?' '+okrBadgesHTML(eo,{noLead:true}):''}</span><span>${_sbOwnerCell(r.o)}</span><span class="sb-r">${r.promised===null?'—':(r.promised>=0?'+':'')+esc(_okrFmtVal(r.o,r.promised))}</span><span class="sb-r">${r.delivered===null?'—':(r.delivered>=0?'+':'')+esc(_okrFmtVal(r.o,r.delivered))}</span><span class="sb-r">${r.pct===null?'—':r.pct+'%'}</span><span>${okrStatusChip(r.st,true)}${r.flag?okrFlagChip(r.flag.flag,true,r.flag):''}</span></div>`;}).join('')}
      </div>
    </div>`:''}
  </section>`;
}
function okrScoreboardHTML(){
  const vis=okrVisible();
  const showDrafts=!!S.filters.okrSbDrafts;
  const rootsAll=okrVisibleRoots().filter(o=>!o.quarterLabel&&o.kind!=='kr'&&(showDrafts||o.state!=='draft'));
  const roots=rootsAll.filter(okrIsObjective);
  const nss=roots.filter(o=>o.isNorthStar),others=roots.filter(o=>!o.isNorthStar);
  const live=vis.filter(o=>o.state!=='draft'&&!o.closed&&!o.quarterLabel);
  const objs=live.filter(okrIsObjective),krs=live.filter(o=>o.kind==='kr');
  const kpis=live.filter(o=>okrIsKPI(o)&&o.parentId&&(okrById(o.parentId)||{}).kind==='kr');   // only KPIs linked under a key result belong to the scoreboard
  const flagsOwn=live.map(o=>okrFlagOf(o)).filter(f=>f&&!f.inherited);
  const nBlocked=new Set(flagsOwn.filter(f=>f.flag==='blocked').map(f=>f.okrId)).size,nRisk=new Set(flagsOwn.filter(f=>f.flag==='at_risk').map(f=>f.okrId)).size;
  const nProp=live.filter(o=>o.targetConfirmed===false).length,nDec=live.filter(o=>o.needsDecision||(o.ownerTbd&&!okrOwners(o).length)).length;
  const nOff=objs.concat(kpis).filter(o=>{const s=okrStatusOf(o);return s==='Off track'||s==='Not achieved';}).length;
  const tile=(l,n,key,tone)=>`<button class="sb-stat ${n?'':'sb-stat-zero'} ${tone||''}" ${key?`onclick="App._okrSbList('${key}')"`:''} ${key?'':'disabled'}><span class="sb-stat-n">${n}</span><span class="sb-stat-l">${l}</span></button>`;
  const strip=`<div class="sb-strip">
      ${tile('Objectives',objs.length,'objectives')}${tile('Key results',krs.length,'krs')}${tile('Linked KPIs',kpis.length,'kpis')}
      ${tile('Blocked',nBlocked,'blocked','sb-red')}${tile('At risk',nRisk,'at_risk','sb-amber')}${tile('Off track',nOff,'off','sb-red')}
      ${tile('Proposed targets',nProp,'proposed','sb-amber')}${tile('Need a decision',nDec,'decision','sb-amber')}
    </div>`;
  const anyExp=!!(S.filters.okrSbExp&&typeof S.filters.okrSbExp==='object'&&Object.keys(S.filters.okrSbExp).length);
  const ctl=`<div class="sb-ctl">
      <span class="sb-asof">${ic('calendar','w-3.5 h-3.5')}As of ${esc(fmtD(todayISO()))}</span>
      <span class="sb-expctl"><button class="ui-btn ui-btn-ghost ui-btn-sm" onclick="App._okrSbExpandAll(${anyExp?'false':'true'})">${ic(anyExp?'chevR':'chevD','w-3.5 h-3.5')}${anyExp?'Collapse all':'Expand all'}</button></span>
      <label class="sb-chk"><input type="checkbox" ${showDrafts?'checked':''} onchange="S.filters.okrSbDrafts=this.checked;rr()"/> Show drafts</label>
      <button class="ui-btn ui-btn-ghost ui-btn-sm" onclick="window.print()" title="Print or save as PDF">${ic('print','w-3.5 h-3.5')}Print</button>
    </div>`;
  const loneKRs=okrVisibleRoots().filter(o=>o.kind==='kr'&&(showDrafts||o.state!=='draft'));
  if(!roots.length&&loneKRs.length)return`<div class="sb">${strip}${ctl}<section class="sb-sec"><div class="sb-thead"><span></span><span>Your key results</span><span>Value</span><span>Owner</span><span>Status</span></div>${loneKRs.map(k=>{const p=k.parentId?okrById(k.parentId):null;return`<div class="sb-row" onclick="App._okrProgressModal('${k.id}')"><div class="sb-c sb-lvl">${okrKRKindChip(k)}</div><div class="sb-c sb-obj"><div class="sb-title">${esc(k.title||'')}</div>${p?`<div class="sb-why">under ${esc(p.title||'')}</div>`:''}</div><div class="sb-c sb-krs"><div class="okr-krs">${okrKRLineHTML(k)}</div></div><div class="sb-c sb-own">${_sbOwnerCell(k)}</div><div class="sb-c sb-st"><div class="sb-stline">${okrStatusChip(okrStatusOf(k),true)}${(f=>f?okrFlagChip(f.flag,true,f):'')(okrFlagOf(k))}</div></div></div>`;}).join('')}</section></div>`;
  if(!roots.length){
    const pending0=_okrV4Ready()?'':`<div class="sb-pending">${ic('alert','w-3.5 h-3.5')} Database update pending — objectives, key results, ramps, flags and the new fields will not save until migration <b>2026-10-02_v400_okr_v4.sql</b> has been applied.</div>`;
    const nKpi=vis.filter(o=>okrIsKPI(o)&&!o.quarterLabel&&!o.closed).length;
    return`<div class="sb">${pending0}${strip}${ctl}<div class="sb-empty">${ic('star','w-5 h-5')}<div><b>No objectives yet.</b> ${_okrV4Ready()?(_okrCanCreate()?'Use <b>New objective</b> above to create the first one, mark the North Star in its editor (Plan & governance), then add key results and link KPIs under them.':'Objectives will appear here once leadership creates them.'):'Objectives can be created once the database update has run.'}${nKpi?` The ${nKpi} KPI${nKpi===1?'':'s'} Bridge already tracks live on the <a href="#" onclick="event.preventDefault();App._okrTab('objectives')" style="font-weight:700;text-decoration:underline">Objectives tab</a>.`:''}</div></div></div>`;
  }
  const sections=others.map(r=>{
    const kids=_sbKids(r,showDrafts),exp=_sbExp(r.id);
    const rows=[];if(exp)_sbWalk(r,1,rows,showDrafts);
    return`<section class="sb-sec${r.state==='draft'?' sb-draft':''}">
      <div class="sb-table">
        <div class="sb-thead"><span>Lvl</span><span>Objective</span><span>KPIs · key results / target</span><span>Owner</span><span>Status</span></div>
        ${_sbRow(r,0,true,kids.length,exp)}
        ${rows.join('')}
      </div>
    </section>`;}).join('');
  setTimeout(()=>{try{_drawOKRCharts();}catch(e){}},60);
  const pending=_okrV4Ready()?'':`<div class="sb-pending">${ic('alert','w-3.5 h-3.5')} Database update pending — key results, ramps, flags and the new fields will not save until migration <b>2026-10-02_v400_okr_v4.sql</b> has been applied.</div>`;
  return`<div class="sb">${pending}${strip}${ctl}${nss.map(_sbHero).join('')}${sections}</div>`;
}
/* The strip's numbers open the exact list they count. */
App._okrSbList=(key)=>{
  const vis=okrVisible().filter(o=>o.state!=='draft'&&!o.closed&&!o.quarterLabel);
  let hits=[],title='';
  if(key==='objectives'){hits=vis.filter(okrIsObjective);title='Objectives';}
  else if(key==='krs'){hits=vis.filter(o=>o.kind==='kr');title='Key results';}
  else if(key==='kpis'){hits=vis.filter(o=>okrIsKPI(o)&&o.parentId&&(okrById(o.parentId)||{}).kind==='kr');title='KPIs linked under key results';}
  else if(key==='blocked'||key==='at_risk'){hits=vis.filter(o=>{const f=okrFlagOf(o);return f&&!f.inherited&&f.flag===key;});title=key==='blocked'?'Blocked — owner’s call':'At risk — owner’s call';}
  else if(key==='off'){hits=vis.filter(o=>o.kind!=='kr'&&['Off track','Not achieved'].includes(okrStatusOf(o)));title='Off track / not achieved';}
  else if(key==='proposed'){hits=vis.filter(o=>o.targetConfirmed===false);title='Proposed targets — confirm or adjust';}
  else if(key==='decision'){hits=vis.filter(o=>o.needsDecision||(o.ownerTbd&&!okrOwners(o).length));title='Needs a decision';}
  const rows=hits.map(o=>{const f=okrFlagOf(o);const p=o.parentId?okrById(o.parentId):null;return`<div onclick="App.closeModal();App._okrProgressModal('${o.id}')" style="display:flex;align-items:center;gap:9px;padding:9px 4px;border-top:1px solid var(--c-border);cursor:pointer">
      ${okrKindChip(o)}
      <span style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;color:var(--c-text)">${esc(o.title)}</div>${p?`<div style="font-size:11px;color:var(--c-text-3)">under ${esc(p.title)}</div>`:''}${f&&f.comment&&(key==='blocked'||key==='at_risk')?`<div style="font-size:11.5px;color:var(--c-text-2);margin-top:2px">“${esc(String(f.comment).slice(0,160))}”</div>`:''}${o.needsDecision&&o.decisionNote&&key==='decision'?`<div style="font-size:11.5px;color:var(--c-text-2);margin-top:2px">${esc(o.decisionNote)}</div>`:''}</span>
      <span style="display:inline-flex;align-items:center">${okrStatusChip(okrStatusOf(o),true)}${f?okrFlagChip(f.flag,true,f):''}</span>
    </div>`;}).join('');
  modalShell({title:title,sub:hits.length+' item'+(hits.length===1?'':'s'),size:'max-w-lg',key:'okr-sblist',body:rows||'<div style="color:var(--c-text-3);font-size:13px;padding:10px 0">Nothing here.</div>'});
};
