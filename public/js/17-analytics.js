/* ============================================================
   Bridge — 17-analytics.js  (split from Bridge.html lines 5924-6148)
   Classic script: shares top-level scope with the other /js files.
   Load order matters — see index.html.
   ============================================================ */
function analyticsPage(){
  const today=todayISO();
  // Collect all relevant submissions
  let subs=DB.submissions;
  if(!isAdmin())subs=subs.filter(s=>subTree(S.uid).some(u=>u.id===s.userId)||s.userId===S.uid);
  const f=S.filters;
  const fArr=k=>Array.isArray(f[k])?f[k]:(f[k]?[f[k]]:[]);
  if(fArr('users').length)  subs=subs.filter(s=>fArr('users').includes(s.userId));
  if(fArr('deps').length)   subs=subs.filter(s=>{const c=clById(s.checklistId);return c&&fArr('deps').includes(c.department);});
  if(fArr('locs').length)   subs=subs.filter(s=>{const c=clById(s.checklistId);return c&&fArr('locs').some(l=>(c.locationIds||[]).includes(l));});
  if(fArr('stats').length)  subs=subs.filter(s=>fArr('stats').includes(s.status));
  if(f.dr1) subs=subs.filter(s=>s.date>=f.dr1);
  if(f.dr2) subs=subs.filter(s=>s.date<=f.dr2);

  // Ticket stats for analytics
  let aTickets=(DB.tickets||[]).slice();
  if(!isAdmin()){
    // Both manager and user: only tickets assigned to them
    aTickets=aTickets.filter(t=>t.assignedTo===S.uid);
  }
  if(f.dr1)aTickets=aTickets.filter(t=>(t.date||t.createdAt?.slice(0,10)||'')>=f.dr1);
  if(f.dr2)aTickets=aTickets.filter(t=>(t.date||t.createdAt?.slice(0,10)||'')<=f.dr2);
  const tkOpen=aTickets.filter(t=>t.status==='Open').length;
  const tkResolved=aTickets.filter(t=>t.status==='Resolved'||t.status==='Closed').length;
  const tkHigh=aTickets.filter(t=>t.priority==='High'||t.priority==='Critical').length;
  const tot=Math.max(subs.length,1);
  const byS={'On Time':0,'Late':0,'Pending Approval':0,'Rejected':0,'Pending (not submitted)':0};
  subs.forEach(s=>{if(byS[s.status]!==undefined)byS[s.status]++;else byS['Pending (not submitted)']++;});
  // ── Compliance over the filtered submissions (computed from answers → covers old data) ──
  let compliantN=0,nonCompliantN=0,totalEscalations=0;
  subs.forEach(s=>{const c=clById(s.checklistId);if(!c||!(c.questionIds||[]).length)return;const n=_subEscalationCount(c,s);if(n>0){nonCompliantN++;totalEscalations+=n;}else{compliantN++;}});

  // Count missed (assigned but no submission for past dates)
  const relevantUsers=isAdmin()?DB.users:[me(),...subTree(S.uid)].filter(Boolean);
  const dateRange=[];
  const dr1=f.dr1||(new Date(Date.now()-30*86400000).toISOString().slice(0,10));
  const dr2=f.dr2||today;
  let d=new Date(dr1+'T00:00:00');const dEnd=new Date(dr2+'T00:00:00');
  while(d<=dEnd&&dateRange.length<60){dateRange.push(d.toISOString().slice(0,10));d.setDate(d.getDate()+1);}
  let totalAssigned=0,totalMissed=0;
  relevantUsers.forEach(u=>{
    if(fArr('users').length&&!fArr('users').includes(u.id))return;
    dateRange.forEach(dt=>{
      const cls=DB.checklists.filter(c=>(c.assignees||[]).includes(u.id)&&clOn(c,dt)&&c.status!=='Draft');
      cls.forEach(c=>{
        totalAssigned++;
        // For "any one" group checklists, a submission by ANY assignee completes it for
        // everyone — so it's only "missed" if nobody submitted (Fix #2).
        const _done=c.anyOne
          ? DB.submissions.some(s=>s.checklistId===c.id&&s.date===dt&&s.status!=='Editing')
          : !!DB.submissions.find(s=>s.checklistId===c.id&&s.userId===u.id&&s.date===dt);
        if(!_done&&dt<today){
          totalMissed++;
        }
      });
    });
  });

  const topU=relevantUsers.map(u=>({u,n:subs.filter(s=>s.userId===u.id).length,tk:aTickets.filter(t=>t.assignedTo===u.id||t.submitterId===u.id).length})).filter(x=>x.n).sort((a,b)=>b.n-a.n);
  const recent=subs.slice().sort((a,b)=>(b.submittedAt||'').localeCompare(a.submittedAt||'')).slice(0,50);
  const activeCount=fArr('users').length+fArr('deps').length+fArr('locs').length+fArr('stats').length+(f.dr1?1:0)+(f.dr2?1:0);

  function msDropdown(label,key,items,getId,getLabel){
    const sel=fArr(key);const isOpen=S.afOpen===key;
    const txt=sel.length===0?'All':sel.length===1?getLabel(items.find(x=>getId(x)===sel[0])||items[0])||'?':sel.length+' selected';
    return`<div data-af="1" style="position:relative;flex:1;min-width:120px">
      <button data-af="1" type="button" onclick="S.afOpen=S.afOpen==='${key}'?null:'${key}';rr()"
        style="width:100%;display:flex;align-items:center;justify-content:space-between;gap:6px;background:#fff;border:1.5px solid ${isOpen?'#10B981':sel.length?'#15171C':'#E5E7EB'};border-radius:10px;padding:7px 12px;font-size:13px;font-weight:${sel.length?600:400};color:${sel.length?'#15171C':'#9CA3AF'};cursor:pointer">
        <span style="overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${esc(label+(sel.length?': '+txt:''))}</span>
        <span style="color:#9CA3AF;transform:rotate(${isOpen?180:0}deg);transition:transform .15s;flex-shrink:0">${ic('chevD','w-4 h-4')}</span>
      </button>
      ${isOpen?`<div data-af="1" style="position:absolute;top:calc(100%+4px);left:0;right:0;background:#fff;border:1.5px solid #E5E7EB;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.12);z-index:100;max-height:220px;overflow-y:auto;padding:6px">
        ${sel.length?`<button data-af="1" onclick="delete S.filters['${key}'];rr()" style="width:100%;text-align:left;padding:6px 10px;font-size:12px;font-weight:600;color:#E11D48;background:none;border:none;cursor:pointer;border-radius:8px">Clear selection</button><div style="height:1px;background:#F3F4F6;margin:4px 0"></div>`:''}
        ${items.map(item=>{const id=getId(item);const nm=getLabel(item)||'?';const on=sel.includes(id);return`<button data-af="1" type="button" onclick="App._togF('${key}','${id}')"
          style="width:100%;display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;border:none;cursor:pointer;background:${on?'#F0FDF9':'transparent'};text-align:left">
          <div style="width:16px;height:16px;border-radius:4px;border:1.5px solid ${on?'#10B981':'#D1D5DB'};background:${on?'#10B981':'#fff'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
            ${on?`<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg>`:''}
          </div>
          <span style="font-size:13px;font-weight:${on?600:400};color:${on?'#15171C':'#6B7280'}">${esc(nm)}</span>
        </button>`;}).join('')}
      </div>`:''}
    </div>`;
  }
  

  return`<div class="fade" onclick="(function(e){if(S.afOpen&&!e.target.closest('[data-af]')){S.afOpen=null;rr();}})(event)">
  ${hdr('Analytics','')}
  <!-- Filter bar -->
  <div style="background:#fff;border-radius:16px;border:1px solid #E5E7EB;padding:14px 16px;margin-bottom:14px;position:sticky;top:0;z-index:20">
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
      ${msDropdown('Status','stats',['On Time','Late','Pending Approval','Rejected'],s=>s,s=>s)}
      ${msDropdown('Department','deps',topDepts(),d=>d.name,d=>d.name)}
      ${msDropdown('Team member','users',relevantUsers,u=>u.id,u=>fullName(u))}
      ${DB.locations.length?msDropdown('Location','locs',DB.locations,l=>l.id,l=>l.name):''}
    </div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:220px">
        <input type="date" value="${f.dr1||''}" onchange="S.filters.dr1=this.value;rr()" style="flex:1;background:#F6F7F8;border:1.5px solid #E5E7EB;border-radius:8px;padding:6px 10px;font-size:13px;outline:none"/>
        <span style="color:#9CA3AF">to</span>
        <input type="date" value="${f.dr2||''}" onchange="S.filters.dr2=this.value;rr()" style="flex:1;background:#F6F7F8;border:1.5px solid #E5E7EB;border-radius:8px;padding:6px 10px;font-size:13px;outline:none"/>
      </div>

      ${activeCount?`<button onclick="S.filters={};S.afOpen=null;rr()" style="padding:6px 12px;border-radius:8px;border:1px solid #E5E7EB;font-size:13px;font-weight:600;color:#9CA3AF;background:#fff;cursor:pointer">Clear (${activeCount})</button>`:''}
      ${btnG('Export','App._exportCSV()','download')}
    </div>
  </div>

  <!-- Stats row 1: submissions (all clickable) -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px">
    ${App._aStatCard('Submitted',subs.length,'sky','submitted',subs)}
    ${App._aStatCard('On time',byS['On Time']||0,'brand','ontime',subs.filter(s=>s.status==='On Time'))}
    ${App._aStatCard('Late',byS['Late']||0,'rose','late',subs.filter(s=>s.status==='Late'&&!!clById(s.checklistId)))}
    ${App._aStatCard('Missed',totalMissed,'orange','missed',null)}
  </div>
  <!-- Stats row 2: tickets (all clickable) -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px">
    ${App._aStatCard('Tickets',aTickets.length,'#F97316','tickets',aTickets)}
    ${App._aStatCard('Open',tkOpen,'#F59E0B','tkopen',aTickets.filter(t=>t.status==='Open'))}
    ${App._aStatCard('High Priority',tkHigh,'#DC2626','tkhigh',aTickets.filter(t=>t.priority==='High'||t.priority==='Critical'))}
    ${App._aStatCard('Resolved',tkResolved,'#0E9F6E','tkresolved',aTickets.filter(t=>t.status==='Resolved'||t.status==='Closed'))}
  </div>
  <!-- Stats row 3: compliance (computed from answers — covers historical data) -->
  <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:14px">
    ${App._aStatCard('Compliant',compliantN,'#0E9F6E','compliant',null)}
    ${App._aStatCard('Non-compliant',nonCompliantN,'#BE123C','noncompliant',null)}
  </div>


  <!-- Charts -->

  
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
    <div style="background:#fff;border-radius:16px;border:1px solid #E5E7EB;padding:18px">
      <div class="fd" style="font-size:14px;font-weight:700;margin-bottom:14px">Status breakdown</div>
      ${[['On Time','#10B981'],['Late','#EF4444'],['Pending Approval','#F97316'],['Rejected','#9F1239']].map(([k,c])=>{const v=byS[k]||0;const pct=Math.round(v/tot*100);return`<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span style="font-weight:600">${k}</span><span style="color:#9CA3AF">${v} · ${pct}%</span></div><div style="height:5px;background:#F3F4F6;border-radius:3px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${c};border-radius:3px"></div></div></div>`;}).join('')}
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid #F3F4F6">
        <div style="font-size:12px;font-weight:600;color:#9CA3AF;margin-bottom:6px">MISSED (past, no submission)</div>
        <div style="display:flex;justify-content:space-between;font-size:13px"><span style="font-weight:600;color:#F97316">${totalMissed} missed</span><span style="color:#9CA3AF">of ${totalAssigned} assigned in period</span></div>
      </div>
    </div>
    <div style="background:#fff;border-radius:16px;border:1px solid #E5E7EB;padding:18px">
      <div class="fd" style="font-size:14px;font-weight:700;margin-bottom:14px">Top contributors</div>
      ${topU.slice(0,7).map(({u,n})=>`<div style="display:flex;align-items:center;gap:8px;margin-bottom:9px;cursor:pointer" onclick="App._userDrill('${u.id}')">${avatar(u,'w-7 h-7','text-[10px]')}<div style="flex:1;font-size:13px;font-weight:500;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${esc(fullName(u))}</div><span class="fd" style="font-size:15px;font-weight:800">${n}</span><span style="font-size:11px;color:#9CA3AF">&rsaquo;</span></div>`).join('')||'<p style="font-size:13px;color:#9CA3AF">No data yet</p>'}
    </div>
  </div>

  <!-- Table -->
  <div style="background:#fff;border-radius:16px;border:1px solid #E5E7EB;overflow:hidden">
    <div style="padding:14px 18px;border-bottom:1px solid #F3F4F6;display:flex;justify-content:space-between;align-items:center">
      <span class="fd" style="font-size:14px;font-weight:700">Submissions (${subs.length})</span>
      ${btnG('Export CSV','App._exportCSV()','download')}
    </div>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="border-bottom:1px solid #F3F4F6">
        ${['User','Checklist','Dept','Date','Status','Answered','Compliance'].map(h=>`<th style="padding:9px 16px;font-size:10px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:.05em;text-align:left;white-space:nowrap">${h}</th>`).join('')}
      </tr></thead>
      <tbody>${recent.map(s=>{const u=uById(s.userId),c=clById(s.checklistId);if(!u)return'';const qCount=(s.questionResponses||[]).filter(r=>r.response!==null&&r.response!==undefined&&r.response!=='').length;if(!c)return`<tr style="border-bottom:1px solid #F9FAFB;opacity:.5"><td style="padding:9px 16px" colspan="7"><span style="font-size:12px;color:#9CA3AF">${esc(fullName(u))} — deleted checklist — ${fmtS(s.date)}</span></td></tr>`;const _qTot=(c.questionIds||[]).length;const _esc=_qTot?_subEscalationCount(c,s):0;return`<tr style="border-bottom:1px solid #F9FAFB;cursor:pointer" onclick="App.viewSub('${s.id}')" onmouseover="this.style.background='#FAFAFA'" onmouseout="this.style.background=''">
        <td style="padding:9px 16px"><div style="display:flex;align-items:center;gap:7px;cursor:pointer" onclick="event.stopPropagation();App._userDrill('${u.id}')">${avatar(u,'w-7 h-7','text-[10px]')}<span style="font-weight:500;text-decoration:underline;text-decoration-color:#E5E7EB">${esc(fullName(u))}</span></div></td>
        <td style="padding:9px 16px;max-width:140px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${esc(c.name)}</td>
        <td style="padding:9px 16px;color:#9CA3AF;font-size:12px">${esc(c.department)}</td>
        <td style="padding:9px 16px;color:#9CA3AF;font-size:12px;white-space:nowrap">${fmtS(s.date)}</td>
        <td style="padding:9px 16px">${chip(s.status)}</td>
        <td style="padding:9px 16px">${qCount?`<span style="font-size:12px;font-weight:700;color:#0E9F6E">${qCount}/${_qTot}</span>`:'<span style="color:#E5E7EB">—</span>'}</td>
        <td style="padding:9px 16px">${_qTot?(_esc>0?`<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:#FFF1F2;color:#BE123C;white-space:nowrap">⚠ ${_esc}</span>`:`<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:#ECFDF5;color:#059669;white-space:nowrap">✓</span>`):'<span style="color:#E5E7EB">—</span>'}</td>
      </tr>`;}).join('')}</tbody>
    </table>${recent.length?'':empty('chart','No submissions match','Adjust filters or date range')}</div>
  </div></div>`;
}


App._viewSubById=(id)=>App.viewSub(id);
App._userDrill=(uid)=>{
  const u=uById(uid);if(!u)return;
  let subs=DB.submissions.filter(s=>s.userId===uid);
  const today=todayISO();
  const dr1=new Date(Date.now()-30*86400000).toISOString().slice(0,10);
  subs=subs.filter(s=>s.date>=dr1);
  const tot=subs.length;
  const onTime=subs.filter(s=>s.status==='On Time').length;
  const late=subs.filter(s=>s.status==='Late'&&!!clById(s.checklistId)).length;
  const pending=subs.filter(s=>s.status==='Pending Approval').length;
  const rejected=subs.filter(s=>s.status==='Rejected').length;
  const issues=subs.reduce((n,s)=>n+(s.questionResponses||[]).filter(r=>r.response!==null&&r.response!==undefined&&r.response!=='').length,0);
  const nonComp=subs.reduce((n,s)=>{const c=clById(s.checklistId);return n+((c&&(c.questionIds||[]).length&&_subEscalationCount(c,s)>0)?1:0);},0);
  const pct=tot?Math.round(onTime/tot*100):0;
  const recent=subs.slice().sort((a,b)=>(b.submittedAt||'').localeCompare(a.submittedAt||'')).slice(0,10);
  openModal(
    '<div class="p-5" style="max-height:80vh;overflow-y:auto">'
    +'<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">'
    +avatar(u,'w-12 h-12','text-sm')
    +'<div><div class="fd" style="font-size:18px;font-weight:800">'+esc(fullName(u))+'</div>'
    +'<div style="font-size:12px;color:#9CA3AF;margin-top:2px">'+esc(u.position)+' · '+esc(u.department)+'</div></div>'
    +'<button onclick="App.closeModal()" style="margin-left:auto;background:none;border:none;cursor:pointer;color:#9CA3AF;font-size:20px">×</button>'
    +'</div>'
    // Score
    +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">'
    +[['Submitted',tot,'#15171C'],['On time',onTime,'#059669'],['Late',late,'#DC2626'],['Pending',pending,'#F97316'],['Non-compliant',nonComp,'#BE123C'],['Answered',issues,'#0E9F6E']].map(([l,v,c])=>'<div style="background:#F9FAFB;border-radius:12px;padding:12px;text-align:center"><div class="fd" style="font-size:22px;font-weight:800;color:'+c+'">'+v+'</div><div style="font-size:11px;font-weight:600;color:#9CA3AF;margin-top:2px">'+l+'</div></div>').join('')
    +'</div>'
    // Completion rate bar
    +'<div style="background:#F9FAFB;border-radius:12px;padding:12px;margin-bottom:16px">'
    +'<div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-bottom:6px"><span>On-time rate (last 30d)</span><span style="color:'+(pct>=80?'#059669':pct>=60?'#F97316':'#DC2626')+'">'+pct+'%</span></div>'
    +'<div style="height:6px;background:#E5E7EB;border-radius:3px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:'+(pct>=80?'#059669':pct>=60?'#F97316':'#DC2626')+';border-radius:3px;transition:width .5s"></div></div>'
    +'</div>'
    // Recent submissions
    +'<div class="fd" style="font-size:13px;font-weight:700;margin-bottom:8px">Recent submissions</div>'
    +(recent.length
      ? recent.map(s=>{const c=clById(s.checklistId);const _esc=(c&&(c.questionIds||[]).length)?_subEscalationCount(c,s):0;const _comp=(c&&(c.questionIds||[]).length)?(_esc>0?'<span style="font-size:10px;font-weight:700;padding:1px 7px;border-radius:20px;background:#FFF1F2;color:#BE123C;white-space:nowrap">⚠ '+_esc+'</span>':'<span style="font-size:10px;font-weight:700;padding:1px 7px;border-radius:20px;background:#ECFDF5;color:#059669">✓</span>'):'';return'<div style="display:flex;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid #F3F4F6;cursor:pointer" onclick="App._viewSubById(this.dataset.id)" data-id="'+s.id+'">'+'<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:500;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">'+esc(c?.name||'—')+'</div><div style="font-size:11px;color:#9CA3AF;margin-top:1px">'+fmtS(s.date)+'</div></div>'+_comp+chip(s.status)+'</div>';}).join('')
      : '<p style="font-size:13px;color:#9CA3AF">No submissions in last 30 days</p>'
    )
    +'</div>',
    'max-w-md'
  );
};
App._togF=(key,val)=>{
  if(!S.filters)S.filters={};
  if(!S.filters[key])S.filters[key]=[];
  if(!Array.isArray(S.filters[key]))S.filters[key]=[S.filters[key]];
  const idx=S.filters[key].indexOf(val);
  if(idx>-1)S.filters[key].splice(idx,1);
  else S.filters[key].push(val);
  if(!S.filters[key].length)delete S.filters[key];
  S.afOpen=key; // keep dropdown open
  rr();
};

