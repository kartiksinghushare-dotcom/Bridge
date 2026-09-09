/* ============================================================
   Bridge — 08-dashboards.js  (split from Bridge.html lines 2156-2300)
   Classic script: shares top-level scope with the other /js files.
   Load order matters — see index.html.
   ============================================================ */
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
      ${rows.map(({u,n})=>`<div class="px-4 py-2.5 flex items-center gap-2.5" style="cursor:pointer" onclick="App.go('tickets')">${avatar(u,'w-7 h-7','text-[10px]')}<div class="flex-1 min-w-0"><div class="text-xs font-semibold truncate">${esc(fullName(u))}</div><div class="text-[11px] text-ink-400">not completed</div></div><span style="font-size:12px;font-weight:800;min-width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;border-radius:13px;background:${n>=5?'#F9E9E3':'#F9F1DF'};color:${n>=5?'#AC3B2A':'#7C5A26'};padding:0 8px">${n}</span></div>`).join('')}
      ${unassigned?`<div class="px-4 py-2.5 flex items-center gap-2.5"><div style="width:28px;height:28px;border-radius:50%;background:#F4F0EA;display:grid;place-items:center;font-size:11px">？</div><div class="flex-1 min-w-0"><div class="text-xs font-semibold">Unassigned</div></div><span style="font-size:12px;font-weight:800;min-width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;border-radius:13px;background:#F4F0EA;color:#786A5F;padding:0 8px">${unassigned}</span></div>`:''}
      ${!total?'<div class="px-4 py-8 text-center text-sm text-ink-400">No open tickets 🎉</div>':''}
    </div>
  </div>`;
}

