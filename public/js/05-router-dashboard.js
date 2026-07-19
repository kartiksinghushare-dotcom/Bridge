/* ============================================================
   Bridge — 05-router-dashboard.js  (split from Bridge.html lines 1628-1733)
   Classic script: shares top-level scope with the other /js files.
   Load order matters — see index.html.
   ============================================================ */
/* ===== ROUTER ===== */
/* ── Dashboard: Visuals (real charts of the same numbers the cards show) + Cards (stat cards) ── */
function dashboardPage(){
  const{subs,tickets}=_dashScope();
  const okrs=(typeof okrVisible==='function'&&can('okr','view'))?okrVisible():[];
  const onTime=subs.filter(s=>s.status==='On Time').length;
  const late=subs.filter(s=>s.status==='Late').length;
  const rate=(onTime+late)?Math.round(onTime/(onTime+late)*100):null;
  const openTk=tickets.filter(t=>t.status==='Open').length;
  const progTk=tickets.filter(t=>t.status==='In Progress').length;
  const apprN=(typeof _approvalPendingCount==='function')?(()=>{try{return _approvalPendingCount();}catch(e){return 0;}})():0;
  setTimeout(()=>{try{_drawDashCharts();}catch(e){console.warn('[dash charts]',e.message);}},80);
  const kpi=(label,val,color,icon,go,sub)=>`<button onclick="${go}" class="stat-card-click" style="text-align:left;background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--r-lg);box-shadow:var(--sh-sm);padding:16px;cursor:pointer;min-width:0">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><span style="width:30px;height:30px;border-radius:9px;background:${color}18;color:${color};display:grid;place-items:center;flex-shrink:0">${ic(icon,'w-4 h-4')}</span><span style="font-size:11px;font-weight:700;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em">${label}</span></div>
      <div class="fd" style="font-size:30px;font-weight:800;line-height:1;color:${color}">${val}</div>
      ${sub?`<div style="font-size:11.5px;color:var(--c-text-3);margin-top:7px">${sub}</div>`:''}
    </button>`;
  const chartCard=(key,title,sub)=>`<div class="ui-card" style="padding:16px 18px;min-width:0"><div style="margin-bottom:10px"><div class="fd" style="font-size:13.5px;font-weight:800;color:var(--c-text)">${title}</div><div style="font-size:11px;color:var(--c-text-3);margin-top:1px">${sub}</div></div><div style="height:210px;position:relative"><canvas data-dash-chart="${key}"></canvas></div></div>`;
  return `<div class="fade">${hdr('Dashboard','How the team is doing right now — tap any number to jump in')}
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:10px;margin-bottom:14px">
      ${kpi('On-time rate',rate===null?'—':rate+'%','#E8785C','approve',"App.go('allcl')",'last 30 days')}
      ${kpi('Late',late,'#DC2626','alert',"App.go('allcl')",'submissions (30d)')}
      ${kpi('Open tickets',openTk+progTk,'#F97316','ticket',"App.go('tickets')",openTk+' open · '+progTk+' in progress')}
      ${kpi('Approvals waiting',apprN,'#0284C7','approve',"App.go('approvals')",'in your inbox')}
      ${okrs.length?kpi('OKRs',okrs.length,'#8B5CF6','chart',"App.go('okr')",'objectives you can see'):''}
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px;margin-bottom:12px">
      ${chartCard('daily','Daily submissions','On time vs late — last 14 days')}
      ${chartCard('trend','On-time % trend','Weekly, last 8 weeks')}
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px">
      ${chartCard('tickets','Tickets by status','Everything currently open or done')}
      ${(typeof _dashTicketsPanel==='function')?_dashTicketsPanel(null):''}
    </div></div>`;
}
/* Same scope rules as the Cards (analytics) tab: Super Admin sees everything, others see their team. */
function _dashScope(){
  const all=isAdmin();
  const team=all?null:new Set([S.uid,...subTree(S.uid).map(u=>u.id)]);
  return{subs:all?DB.submissions:DB.submissions.filter(s=>team.has(s.userId)),
         tickets:all?(DB.tickets||[]):(DB.tickets||[]).filter(t=>t.assignedTo===S.uid),
         users:all?DB.users.filter(u=>u.status==='Active'):DB.users.filter(u=>u.status==='Active'&&team.has(u.id))};
}
/* _dashChartsPage removed — its KPIs/charts folded into the single dashboardPage above. */
function _drawDashCharts(){
  if(typeof Chart==='undefined')return;
  _destroyACharts();
  const T=_aChartTheme();
  const{subs,tickets}=_dashScope();
  const today=todayISO();
  const C={green:'#E8785C',greenSoft:'rgba(232,120,92,.14)',red:'#EF4444',amber:'#F59E0B',sky:'#0284C7',violet:'#8B5CF6',grey:'#9CA3AF',ink:'#221B12'};
  const mk=(key,cfg)=>{const cv=document.querySelector('canvas[data-dash-chart="'+key+'"]');if(!cv)return;cfg.options=cfg.options||{};cfg.options.responsive=true;cfg.options.maintainAspectRatio=false;cfg.options.plugins=cfg.options.plugins||{};cfg.options.plugins.legend=cfg.options.plugins.legend||{labels:{color:T.tick,font:{size:10.5},boxWidth:14,padding:8}};_aCharts.push(new Chart(cv.getContext('2d'),cfg));};
  const dISO=(d)=>{const x=new Date();x.setDate(x.getDate()-d);return x.toISOString().slice(0,10);};
  const fmtDay=(iso)=>{const d=new Date(iso+'T00:00:00');return d.toLocaleDateString(undefined,{day:'numeric',month:'short'});};
  // 1) daily stacked bars — 14 days
  const days=[];for(let i=13;i>=0;i--)days.push(dISO(i));
  const byDay=(st)=>days.map(d=>subs.filter(s=>s.date===d&&s.status===st).length);
  mk('daily',{type:'bar',data:{labels:days.map(fmtDay),datasets:[
    {label:'On time',data:byDay('On Time'),backgroundColor:C.green,stack:'s',borderRadius:3},
    {label:'Late',data:byDay('Late'),backgroundColor:C.red,stack:'s',borderRadius:3},
    {label:'Pending approval',data:byDay('Pending Approval'),backgroundColor:C.amber,stack:'s',borderRadius:3}]},
    options:{scales:{x:{stacked:true,ticks:{color:T.tick,font:{size:9.5},maxRotation:0,autoSkip:true},grid:{display:false}},y:{stacked:true,beginAtZero:true,ticks:{color:T.tick,font:{size:10},precision:0},grid:{color:T.grid}}}}});
  // 2) weekly on-time % — 8 weeks
  const wk=[];for(let i=7;i>=0;i--){const end=dISO(i*7),start=dISO(i*7+6);const ss=subs.filter(s=>s.date>=start&&s.date<=end);const ot=ss.filter(s=>s.status==='On Time').length,lt=ss.filter(s=>s.status==='Late').length;wk.push({label:fmtDay(start),pct:(ot+lt)?Math.round(ot/(ot+lt)*100):null});}
  mk('trend',{type:'line',data:{labels:wk.map(x=>x.label),datasets:[
    {label:'On-time %',data:wk.map(x=>x.pct),spanGaps:true,borderColor:C.green,backgroundColor:C.greenSoft,fill:true,tension:.3,pointRadius:3,pointBackgroundColor:C.green,borderWidth:2},
    {label:'Goal (100%)',data:wk.map(()=>100),borderColor:C.grey,borderDash:[6,5],pointRadius:0,fill:false,borderWidth:1.5}]},
    options:{scales:{x:{ticks:{color:T.tick,font:{size:9.5},maxRotation:0},grid:{display:false}},y:{beginAtZero:true,suggestedMax:110,ticks:{color:T.tick,font:{size:10},callback:v=>v+'%'},grid:{color:T.grid}}}}});
  // 3) outcomes doughnut
  const stMap=[['On Time',C.green],['Late',C.red],['Pending Approval',C.amber],['Rejected','#B91C1C'],['Editing',C.sky]];
  const stData=stMap.map(([s])=>subs.filter(x=>x.status===s).length);
  mk('status',{type:'doughnut',data:{labels:stMap.map(([s])=>s),datasets:[{data:stData,backgroundColor:stMap.map(([,c])=>c),borderWidth:2,borderColor:'#fff'}]},options:{cutout:'62%'}});
  // 4) dept compliance bars
  const depts={};subs.forEach(s=>{const c=clById(s.checklistId);const d=c?c.department:null;if(!d)return;depts[d]=depts[d]||{ot:0,lt:0};if(s.status==='On Time')depts[d].ot++;else if(s.status==='Late')depts[d].lt++;});
  const dNames=Object.keys(depts).filter(d=>depts[d].ot+depts[d].lt>0);
  mk('dept',{type:'bar',data:{labels:dNames,datasets:[{label:'On-time %',data:dNames.map(d=>Math.round(depts[d].ot/(depts[d].ot+depts[d].lt)*100)),backgroundColor:dNames.map((_,i)=>[C.green,C.sky,C.violet,C.amber][i%4]),borderRadius:5,maxBarThickness:46}]},
    options:{plugins:{legend:{display:false}},scales:{x:{ticks:{color:T.tick,font:{size:10.5}},grid:{display:false}},y:{beginAtZero:true,suggestedMax:110,ticks:{color:T.tick,font:{size:10},callback:v=>v+'%'},grid:{color:T.grid}}}}});
  // 5) tickets doughnut
  const tMap=[['Open',C.red],['In Progress',C.amber],['Resolved',C.green],['Closed',C.grey]];
  mk('tickets',{type:'doughnut',data:{labels:tMap.map(([s])=>s),datasets:[{data:tMap.map(([s])=>tickets.filter(t=>t.status===s).length),backgroundColor:tMap.map(([,c])=>c),borderWidth:2,borderColor:'#fff'}]},options:{cutout:'62%'}});
  // 6) OKR health doughnut
  if(typeof okrVisible==='function'&&can('okr','view')){
    const okrs=okrVisible();
    if(okrs.length){
      const oMap=[['Achieved','#ED8368'],['On track','#22C55E'],['Off track',C.red],['Not achieved','#B91C1C'],['No data',C.grey]];
      const oData=oMap.map(([s])=>okrs.filter(o=>okrStatusOf(o)===s).length);
      mk('okr',{type:'doughnut',data:{labels:oMap.map(([s])=>s),datasets:[{data:oData,backgroundColor:oMap.map(([,c])=>c),borderWidth:2,borderColor:'#fff'}]},options:{cutout:'62%'}});
    }
  }
}
/* allClTeamPage removed — Builder / All results / Team are hub pills now (no inner tab bar). */
