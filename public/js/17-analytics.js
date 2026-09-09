/* ============================================================
   Bridge — 17-analytics.js  (split from Bridge.html lines 5924-6148)
   Classic script: shares top-level scope with the other /js files.
   Load order matters — see index.html.
   ============================================================ */
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
    +'<div style="font-size:12px;color:#A59788;margin-top:2px">'+esc(u.position)+' · '+esc(u.department)+'</div></div>'
    +'<button onclick="App.closeModal()" style="margin-left:auto;background:none;border:none;cursor:pointer;color:#A59788;font-size:20px">×</button>'
    +'</div>'
    // Score
    +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">'
    +[['Submitted',tot,'#13171B'],['On time',onTime,'#463830'],['Late',late,'#B3402E'],['Pending',pending,'#54433C'],['Non-compliant',nonComp,'#A63528'],['Answered',issues,'#54433C']].map(([l,v,c])=>'<div style="background:#FAF7F3;border-radius:12px;padding:12px;text-align:center"><div class="fd" style="font-size:22px;font-weight:800;color:'+c+'">'+v+'</div><div style="font-size:11px;font-weight:600;color:#A59788;margin-top:2px">'+l+'</div></div>').join('')
    +'</div>'
    // Completion rate bar
    +'<div style="background:#FAF7F3;border-radius:12px;padding:12px;margin-bottom:16px">'
    +'<div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-bottom:6px"><span>On-time rate (last 30d)</span><span style="color:'+(pct>=80?'#463830':pct>=60?'#54433C':'#B3402E')+'">'+pct+'%</span></div>'
    +'<div style="height:6px;background:#E6DED3;border-radius:3px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:'+(pct>=80?'#463830':pct>=60?'#54433C':'#B3402E')+';border-radius:3px;transition:width .5s"></div></div>'
    +'</div>'
    // Recent submissions
    +'<div class="fd" style="font-size:13px;font-weight:700;margin-bottom:8px">Recent submissions</div>'
    +(recent.length
      ? recent.map(s=>{const c=clById(s.checklistId);const _esc=(c&&(c.questionIds||[]).length)?_subEscalationCount(c,s):0;const _comp=(c&&(c.questionIds||[]).length)?(_esc>0?'<span style="font-size:10px;font-weight:700;padding:1px 7px;border-radius:20px;background:#F9EBE5;color:#A63528;white-space:nowrap">⚠ '+_esc+'</span>':'<span style="font-size:10px;font-weight:700;padding:1px 7px;border-radius:20px;background:#EEE4D5;color:#463830">✓</span>'):'';return'<div style="display:flex;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid #F4F0EA;cursor:pointer" onclick="App._viewSubById(this.dataset.id)" data-id="'+s.id+'">'+'<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:500;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">'+esc(c?.name||'—')+'</div><div style="font-size:11px;color:#A59788;margin-top:1px">'+fmtS(s.date)+'</div></div>'+_comp+chip(s.status)+'</div>';}).join('')
      : '<p style="font-size:13px;color:#A59788">No submissions in last 30 days</p>'
    )
    +'</div>',
    'max-w-md'
  );
};
