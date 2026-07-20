/* ============================================================
   Bridge — 08-dashboards.js  (split from Bridge.html lines 2156-2300)
   Classic script: shares top-level scope with the other /js files.
   Load order matters — see index.html.
   ============================================================ */
/* ===== DASHBOARD HELPERS: date range filter + tickets panel ===== */
const DASH_RANGES=[['all','All time'],['today','Today'],['yesterday','Yesterday'],['cweek','Current week'],['lweek','Last week'],['cmonth','Current month'],['lmonth','Last month'],['custom','Custom range']];
function _dashRangeBounds(){
  const r=S.filters.dashRange||'all';
  const today=todayISO();
  const t=new Date(today+'T00:00:00');
  const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  if(r==='today')return{from:today,to:today};
  if(r==='yesterday'){const d=new Date(t);d.setDate(d.getDate()-1);const y=iso(d);return{from:y,to:y};}
  if(r==='cweek'){const d=new Date(t);const dow=d.getDay();d.setDate(d.getDate()+(dow===0?-6:1-dow));return{from:iso(d),to:today};}
  if(r==='lweek'){const d=new Date(t);const dow=d.getDay();d.setDate(d.getDate()+(dow===0?-6:1-dow)-7);const e=new Date(d);e.setDate(e.getDate()+6);return{from:iso(d),to:iso(e)};}
  if(r==='cmonth'){return{from:iso(new Date(t.getFullYear(),t.getMonth(),1)),to:today};}
  if(r==='lmonth'){return{from:iso(new Date(t.getFullYear(),t.getMonth()-1,1)),to:iso(new Date(t.getFullYear(),t.getMonth(),0))};}
  if(r==='custom'){
    const f=S.filters.dashFrom||'',e=S.filters.dashTo||'';
    if(!f&&!e)return null;
    return{from:f||'0000-01-01',to:e||'9999-12-31'};
  }
  return null; // 'all'
}
const _inDashRange=date=>{const b=_dashRangeBounds();if(!b)return true;return !!date&&date>=b.from&&date<=b.to;};
function _dashFilterBar(){
  const r=S.filters.dashRange||'all';
  const b=_dashRangeBounds();
  return`<div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center;padding:10px 14px;background:#fff;border-radius:14px;border:1.5px solid #ECEDF0">
    <span style="font-size:11px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:.05em">📅 Date range</span>
    <select onchange="S.filters.dashRange=this.value;rr()" style="background:#fff;border:1.5px solid #E5E7EB;border-radius:9px;padding:6px 10px;font-size:13px;font-weight:600;outline:none;cursor:pointer">
      ${DASH_RANGES.map(([id,lbl])=>`<option value="${id}" ${r===id?'selected':''}>${lbl}</option>`).join('')}
    </select>
    ${r==='custom'?`
      <input type="date" value="${esc(S.filters.dashFrom||'')}" onchange="S.filters.dashFrom=this.value;rr()" style="border:1.5px solid #E5E7EB;border-radius:9px;padding:5px 8px;font-size:13px;outline:none"/>
      <span style="font-size:12px;color:#9CA3AF">to</span>
      <input type="date" value="${esc(S.filters.dashTo||'')}" onchange="S.filters.dashTo=this.value;rr()" style="border:1.5px solid #E5E7EB;border-radius:9px;padding:5px 8px;font-size:13px;outline:none"/>
    `:''}
    ${b?`<span style="font-size:12px;color:#6B7280;font-weight:600">${b.from===b.to?new Date(b.from+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):new Date(b.from+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'})+' – '+new Date(b.to+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</span>`:''}
  </div>`;
}
function _dashTicketsPanel(scopeUsers){
  const open=(DB.tickets||[]).filter(t=>t.status==='Open'||t.status==='In Progress');
  const ids=scopeUsers?new Set(scopeUsers.map(u=>u.id)):null;
  const counts={};let unassigned=0;
  open.forEach(t=>{
    if(!t.assignedTo){if(!ids)unassigned++;return;}
    if(ids&&!ids.has(t.assignedTo))return;
    counts[t.assignedTo]=(counts[t.assignedTo]||0)+1;
  });
  const rows=Object.entries(counts).map(([uid2,n])=>({u:uById(uid2),n})).filter(r=>r.u).sort((a,b)=>b.n-a.n);
  const total=rows.reduce((s,r)=>s+r.n,0)+unassigned;
  return`<div class="bg-white rounded-2xl border border-ink-100 shadow-soft overflow-hidden">
    <div class="px-4 py-3 border-b border-ink-100 flex justify-between items-center">
      <h3 class="fd font-semibold text-sm">Open tickets by user</h3>
      <button onclick="App.go('tickets')" class="text-xs font-semibold text-brand-700">View all →</button>
    </div>
    <div class="divide-y divide-ink-50">
      ${rows.map(({u,n})=>`<div class="px-4 py-2.5 flex items-center gap-2.5" style="cursor:pointer" onclick="App.go('tickets')">${avatar(u,'w-7 h-7','text-[10px]')}<div class="flex-1 min-w-0"><div class="text-xs font-semibold truncate">${esc(fullName(u))}</div><div class="text-[11px] text-ink-400">not completed</div></div><span style="font-size:12px;font-weight:800;min-width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;border-radius:13px;background:${n>=5?'#FFEDED':'#FEF7E6'};color:${n>=5?'#C92C2C':'#B36A00'};padding:0 8px">${n}</span></div>`).join('')}
      ${unassigned?`<div class="px-4 py-2.5 flex items-center gap-2.5"><div style="width:28px;height:28px;border-radius:50%;background:#F3F4F6;display:grid;place-items:center;font-size:11px">？</div><div class="flex-1 min-w-0"><div class="text-xs font-semibold">Unassigned</div></div><span style="font-size:12px;font-weight:800;min-width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;border-radius:13px;background:#F3F4F6;color:#6B7280;padding:0 8px">${unassigned}</span></div>`:''}
      ${!total?'<div class="px-4 py-8 text-center text-sm text-ink-400">No open tickets 🎉</div>':''}
    </div>
  </div>`;
}

/* ===== ADMIN DASHBOARD ===== */
function adminDash(){
  const today=todayISO();
  const fSubs=DB.submissions.filter(s=>_inDashRange(s.date));
  const active=DB.users.filter(u=>u.status==='Active').length;
  const pendA=DB.approvals.filter(a=>a.status==='Pending').length;
  const late=fSubs.filter(s=>s.status==='Late').length;
  const depts=topDepts().map(d=>{const us=DB.users.filter(u=>u.department===d.name).length;const cls=DB.checklists.filter(c=>c.department===d.name).length;const ss=fSubs.filter(s=>{const c=clById(s.checklistId);return c?.department===d.name;});return{name:d.name,us,cls,total:ss.length,onTime:ss.filter(s=>s.status==='On Time').length,late:ss.filter(s=>s.status==='Late').length};}).filter(d=>d.us||d.cls);
  const recent=fSubs.slice().sort((a,b)=>(b.submittedAt||'').localeCompare(a.submittedAt||'')).slice(0,8);
  return`<div class="fade">${hdr('Dashboard',new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'}))}
  ${_dashFilterBar()}
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
    ${statCard('Active users',active,'sky',"App.go('users')")}${statCard('Pending approvals',pendA,'amber',"App.go('approvals')")}${statCard('Late submissions',late,'rose',"S.filters={stats:['Late']};App.go('analytics')")}
  </div>
  <div class="grid lg:grid-cols-3 gap-4">
    <div class="lg:col-span-2 bg-white rounded-2xl border border-ink-100 shadow-soft overflow-hidden">
      <div class="px-5 py-3 border-b border-ink-100"><h3 class="fd font-semibold text-sm">Department performance</h3></div>
      <div class="divide-y divide-ink-50">${depts.map(d=>`<div class="px-5 py-3 flex items-center gap-4"><span class="text-sm font-semibold w-32 truncate">${esc(d.name)}</span><div class="flex-1"><div class="pg"><div class="pgf" style="width:${d.total?Math.round(d.onTime/d.total*100):0}%"></div></div></div><span class="text-xs text-ink-400 w-24 text-right shrink-0">${d.us}u · ${d.cls}cl · ${d.late?`<span class="text-rose-600 font-semibold">${d.late} late</span>`:d.total+' sub'}</span></div>`).join('')||'<div class="px-5 py-8 text-center text-sm text-ink-400">No data yet</div>'}</div>
    </div>
    <div class="space-y-4">
      <div class="bg-white rounded-2xl border border-ink-100 shadow-soft overflow-hidden">
        <div class="px-4 py-3 border-b border-ink-100 flex justify-between items-center"><h3 class="fd font-semibold text-sm">Recent submissions</h3><button onclick="App.go('analytics')" class="text-xs font-semibold text-brand-700">View all →</button></div>
        <div class="divide-y divide-ink-50">${recent.map(s=>{const u=uById(s.userId),c=clById(s.checklistId);if(!u)return'';const cName=c?c.name:'[Deleted]';return`<div class="px-4 py-2.5 flex items-center gap-2.5">${avatar(u,'w-7 h-7','text-[10px]')}<div class="flex-1 min-w-0"><div class="text-xs font-semibold truncate">${esc(fullName(u))}</div><div class="text-[11px] text-ink-400 truncate">${esc(cName)}</div></div>${chip(s.status)}</div>`;}).join('')||'<div class="px-4 py-8 text-center text-sm text-ink-400">No submissions yet</div>'}</div>
      </div>
      ${_dashTicketsPanel(null)}
    </div>
  </div>
  <!-- All users performance (range-aware) -->
  ${(()=>{
    const aRows=DB.users.filter(u=>u.status==='Active').map(u=>{
      const asgn=DB.checklists.filter(c=>(c.assignees||[]).includes(u.id)).length;
      const ss=fSubs.filter(s=>s.userId===u.id);
      const lateU=ss.filter(s=>s.status==='Late').length;
      const pend=ss.filter(s=>['Pending','Pending Approval'].includes(s.status)).length;
      const tk=(DB.tickets||[]).filter(t=>t.assignedTo===u.id&&(t.status==='Open'||t.status==='In Progress')).length;
      const todayAsgnCls=DB.checklists.filter(c=>(c.assignees||[]).includes(u.id)&&clOn(c,todayISO()));
      const todayAsgn=todayAsgnCls.length;
      // Effective completions for today: own submission, OR for "any one" group checklists
      // any assignee's completed submission counts as done for this user (Fix #2).
      const todayDone=todayAsgnCls.filter(c=>subForCl(c,u.id,todayISO())).length;
      const pct=todayAsgn?Math.round(todayDone/todayAsgn*100):ss.length?Math.round(Math.min(ss.length,asgn)/Math.max(asgn,1)*100):0;
      return{u,asgn,total:ss.length,late:lateU,pend,tk,pct};
    }).sort((a,b)=>fullName(a.u).localeCompare(fullName(b.u)));
    return`<div class="bg-white rounded-2xl border border-ink-100 shadow-soft overflow-hidden mt-4">
    <div class="px-5 py-3 border-b border-ink-100"><h3 class="fd font-semibold text-sm">All users performance</h3></div>
    <div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="text-[10px] text-ink-400 uppercase tracking-wide border-b border-ink-100 text-left"><th class="px-4 py-2.5 font-semibold">Member</th><th class="px-4 py-2.5 font-semibold">Assigned</th><th class="px-4 py-2.5 font-semibold">Submitted</th><th class="px-4 py-2.5 font-semibold">Late</th><th class="px-4 py-2.5 font-semibold">Pending</th><th class="px-4 py-2.5 font-semibold" title="Open + In Progress tickets assigned to this member">Tickets</th><th class="px-4 py-2.5 font-semibold">Completion</th></tr></thead>
    <tbody class="divide-y divide-ink-50">${aRows.map(({u,asgn,total,late:lt,pend,tk,pct})=>`<tr class="hover:bg-ink-50/50"><td class="px-4 py-2.5"><div class="flex items-center gap-2">${avatar(u,'w-7 h-7','text-[10px]')}<span class="font-semibold text-sm">${esc(fullName(u))}</span></div></td><td class="px-4 py-2.5 text-sm">${asgn}</td><td class="px-4 py-2.5 text-emerald-700 font-medium text-sm">${total}</td><td class="px-4 py-2.5 ${lt?'text-rose-600 font-semibold':''} text-sm">${lt}</td><td class="px-4 py-2.5 text-amber-600 text-sm">${pend}</td><td class="px-4 py-2.5">${tk?`<span onclick="App.go('tickets')" title="${tk} open ticket${tk>1?'s':''} — not completed" style="display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:24px;padding:0 8px;border-radius:12px;font-size:12px;font-weight:800;cursor:pointer;background:${tk>=5?'#FFEDED':'#FEF7E6'};color:${tk>=5?'#C92C2C':'#B36A00'}">${tk}</span>`:`<span class="text-sm text-ink-300">0</span>`}</td><td class="px-4 py-2.5"><div class="flex items-center gap-2"><div style="width:64px;height:6px;border-radius:3px;background:#ECEDF0;overflow:hidden"><div style="height:100%;border-radius:2px;width:${pct}%;background:${pct>=80?'#8B6B41':pct>=50?'#F59E0B':'#F43F5E'}"></div></div><span class="text-xs font-semibold">${pct}%</span></div></td></tr>`).join('')}</tbody></table></div>
  </div>`;
  })()}
  </div>`;}

/* ===== MANAGER DASHBOARD ===== */
function mgrDash(){
  const team=subTree(S.uid);if(!team.length)return myClsPage();
  const teamIds=new Set(team.map(u=>u.id));
  // Former direct reports (manager changed away) — shown only if they have in-range data from their time under me
  const former=DB.users.filter(u=>!teamIds.has(u.id)&&u.id!==S.uid&&Array.isArray(u.managerHistory)&&u.managerHistory.some(p=>p.managerId===S.uid));
  const mkRow=(u,cur)=>{
    // Only count submissions from dates the user was actually under me (handles transfers in AND out)
    const ss=DB.submissions.filter(s=>s.userId===u.id&&_inDashRange(s.date)&&_underOn(u.id,S.uid,s.date));
    const late=ss.filter(s=>s.status==='Late').length;
    const pend=ss.filter(s=>['Pending','Pending Approval'].includes(s.status)).length;
    if(!cur)return ss.length?{u,cur,asgn:null,total:ss.length,late,pend,tk:null,pct:null}:null;
    const asgn=DB.checklists.filter(c=>(c.assignees||[]).includes(u.id)).length;
    const tk=(DB.tickets||[]).filter(t=>t.assignedTo===u.id&&(t.status==='Open'||t.status==='In Progress')).length;
    const todayAsgnCls=DB.checklists.filter(c=>(c.assignees||[]).includes(u.id)&&clOn(c,todayISO()));
    const todayAsgn=todayAsgnCls.length;
    const todayDone=todayAsgnCls.filter(c=>subForCl(c,u.id,todayISO())).length;
    const pct=todayAsgn?Math.round(todayDone/todayAsgn*100):ss.length?Math.round(Math.min(ss.length,asgn)/Math.max(asgn,1)*100):0;
    return{u,cur,asgn,total:ss.length,late,pend,tk,pct};
  };
  const rows=[...team.map(u=>mkRow(u,true)),...former.map(u=>mkRow(u,false))].filter(Boolean);
  const curRows=rows.filter(r=>r.cur);
  return`<div class="fade">${hdr('Team Dashboard',team.length+' member'+(team.length>1?'s':''))}
  ${_dashFilterBar()}
  <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
    ${statCard('Team members',team.length,'sky',"App.go('teamview')")}${statCard('Late submissions',rows.reduce((n,r)=>n+r.late,0),'rose',"S.filters={stats:['Late']};App.go('analytics')")}${statCard('Avg completion',Math.round(curRows.reduce((n,r)=>n+r.pct,0)/Math.max(curRows.length,1))+'%','brand',"App.go('analytics')")}
  </div>
  <div class="bg-white rounded-2xl border border-ink-100 shadow-soft overflow-hidden mb-4">
    <div class="px-5 py-3 border-b border-ink-100"><h3 class="fd font-semibold text-sm">Team performance</h3></div>
    <div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="text-[10px] text-ink-400 uppercase tracking-wide border-b border-ink-100 text-left"><th class="px-4 py-2.5 font-semibold">Member</th><th class="px-4 py-2.5 font-semibold">Assigned</th><th class="px-4 py-2.5 font-semibold">Submitted</th><th class="px-4 py-2.5 font-semibold">Late</th><th class="px-4 py-2.5 font-semibold">Pending</th><th class="px-4 py-2.5 font-semibold" title="Open + In Progress tickets assigned to this member">Tickets</th><th class="px-4 py-2.5 font-semibold">Completion</th></tr></thead>
    <tbody class="divide-y divide-ink-50">${rows.map(({u,cur,asgn,total,late,pend,tk,pct})=>`<tr class="hover:bg-ink-50/50"><td class="px-4 py-2.5"><div class="flex items-center gap-2">${avatar(u,'w-7 h-7','text-[10px]')}<span class="font-semibold text-sm">${esc(fullName(u))}</span>${cur?'':'<span title="No longer reports to you — showing data from when they did" style="font-size:10px;font-weight:700;padding:1px 7px;border-radius:10px;background:#F3F4F6;color:#6B7280">former</span>'}</div></td><td class="px-4 py-2.5 text-sm">${cur?asgn:'<span class="text-ink-300">—</span>'}</td><td class="px-4 py-2.5 text-emerald-700 font-medium text-sm">${total}</td><td class="px-4 py-2.5 ${late?'text-rose-600 font-semibold':''} text-sm">${late}</td><td class="px-4 py-2.5 text-amber-600 text-sm">${pend}</td><td class="px-4 py-2.5">${cur?(tk?`<span onclick="App.go('tickets')" title="${tk} open ticket${tk>1?'s':''} — not completed" style="display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:24px;padding:0 8px;border-radius:12px;font-size:12px;font-weight:800;cursor:pointer;background:${tk>=5?'#FFEDED':'#FEF7E6'};color:${tk>=5?'#C92C2C':'#B36A00'}">${tk}</span>`:`<span class="text-sm text-ink-300">0</span>`):'<span class="text-ink-300">—</span>'}</td><td class="px-4 py-2.5">${cur?`<div class="flex items-center gap-2"><div style="width:64px;height:6px;border-radius:3px;background:#ECEDF0;overflow:hidden"><div style="height:100%;border-radius:2px;width:${pct}%;background:${pct>=80?'#8B6B41':pct>=50?'#F59E0B':'#F43F5E'}"></div></div><span class="text-xs font-semibold">${pct}%</span></div>`:'<span class="text-ink-300">—</span>'}</td></tr>`).join('')}</tbody></table></div>
  </div></div>`;}

