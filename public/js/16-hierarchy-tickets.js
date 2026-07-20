/* ============================================================
   Bridge — 16-hierarchy-tickets.js  (split from Bridge.html lines 5587-5923)
   Classic script: shares top-level scope with the other /js files.
   Load order matters — see index.html.
   ============================================================ */
/* ===== HIERARCHY ===== */
function hierarchyPage(){
  const admin=isAdmin()||isSubAdmin();
  const roots=admin?DB.users.filter(u=>u.status!=='Inactive'&&(!u.managerId||!uById(u.managerId))):[me()].filter(Boolean);
  return`<div class="fade">${hdr(admin?'Organisation':'My Team','Reporting structure')}
  <div class="ui-card" style="padding:26px 18px;overflow:auto"><div class="oc"><ul>${roots.map(r=>_tNode(r,0)).join('')}</ul></div></div></div>`;
}
function _tNode(u,d){
  if(d>9)return'';
  const kids=DB.users.filter(x=>x.managerId===u.id&&x.id!==u.id&&x.status!=='Inactive');
  const col=COLL[u.id];
  // Tag comes from the ASSIGNED ROLE (Access Control role profiles) — not the legacy base role.
  const rp=(typeof _roleOf==='function')?_roleOf(u):null;
  const tag=rp?.id==='superadmin'?['SUPER ADMIN','#13171B','#fff']
    :rp?.id==='admin'?['ADMIN','#EEF2FF','#4338CA']
    :((rp&&rp.id==='manager')||kids.length)?['MANAGER','#E0F2FE','#0369A1']
    :(rp&&!rp.builtin&&rp.name)?[String(rp.name).toUpperCase(),'#F5F3FF','#6D28D9']
    :null;
  const card=`<div style="display:inline-flex;flex-direction:column;align-items:center;gap:6px;background:var(--c-surface);border:1px solid var(--c-border);border-radius:12px;padding:10px 14px;box-shadow:var(--sh-xs);min-width:118px;max-width:170px;position:relative">
      ${avatar(u,'w-9 h-9','text-[11px]')}
      <div style="min-width:0;text-align:center">
        <div style="font-size:12px;font-weight:700;color:var(--c-text);line-height:1.25">${esc(fullName(u))}</div>
        <div style="font-size:10px;color:var(--c-text-3);margin-top:1px;line-height:1.3">${esc(u.position||u.department||'')}</div>
        ${tag?`<div style="margin-top:4px"><span style="font-size:8.5px;font-weight:800;padding:1px 7px;border-radius:4px;background:${tag[1]};color:${tag[2]};letter-spacing:.03em">${tag[0]}</span></div>`:''}
      </div>
      ${kids.length?`<button onclick="COLL['${u.id}']=!COLL['${u.id}'];rr()" title="${col?'Expand':'Collapse'} ${kids.length} report${kids.length===1?'':'s'}" style="position:absolute;bottom:-11px;left:50%;transform:translateX(-50%);min-width:22px;height:22px;padding:0 6px;display:inline-flex;align-items:center;justify-content:center;gap:2px;border-radius:11px;border:1.5px solid var(--c-border-2);background:var(--c-surface);cursor:pointer;color:var(--c-text-2);font-size:10px;font-weight:800;line-height:1;box-shadow:var(--sh-xs);z-index:1">${col?'+'+kids.length:'–'}</button>`:''}
    </div>`;
  return`<li>${card}${kids.length&&!col?`<ul>${kids.map(k2=>_tNode(k2,d+1)).join('')}</ul>`:''}</li>`;
}
function ticketsPage(){
  // Mark assigned tickets as viewed when page opens (no rr() — already rendering)
  let _dirty=false;const _justViewed=[];
  (DB.tickets||[]).forEach(t=>{
    if(t.assignedTo===S.uid&&!(t.viewedBy||[]).includes(S.uid)){
      if(!t.viewedBy)t.viewedBy=[];
      t.viewedBy.push(S.uid);
      _justViewed.push(t);
      _dirty=true;
    }
  });
  if(_dirty){
    saveDB();
    // Sync viewed_by to Supabase in background — no rr() here (already in a render)
    _justViewed.forEach(t=>{
      sbWrite({table:'tickets',op:'update',id:t.id,match:{col:'id',val:t.id},values:{viewed_by:t.viewedBy||[]}},{label:'Ticket viewed',silent:true});
    });
    // Schedule badge refresh after render completes
    setTimeout(()=>{_invalidateNotifCache();const c=document.getElementById('content');if(c)c.innerHTML=pageContent();},50);
  }
  // Visibility:
  // Admin — sees all tickets
  // Manager — sees tickets assigned to them OR tickets they created (so they can track)
  // User — sees ONLY tickets assigned to them
  let tickets=(DB.tickets||[]).slice().sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  if(isAdmin()||isSubAdmin()){
    // all tickets — no filter (Super Admin + Admin see everything regardless of escalation)
  } else if(isMgr()){
    // Manager sees: assigned to them + tickets they personally created
    tickets=tickets.filter(t=>t.assignedTo===S.uid);
  } else {
    // Regular user: ONLY tickets assigned directly to them
    tickets=tickets.filter(t=>t.assignedTo===S.uid);
  }

  const f=S.filters;
  const statusFilter=f.tkStatus||'';
  const priorityFilter=f.tkPriority||'';
  // R12 (Evarca-aligned filters) — search + assignee + sort on top of status/priority.
  const base=tickets.slice(); // pre-filter snapshot: drives the assignee options + stat cards
  const q=(f.tkQ||'').toLowerCase();
  if(q)tickets=tickets.filter(t=>((t.title||'')+' '+(t.description||'')+' '+(uById(t.assignedTo)?fullName(uById(t.assignedTo)):'')+' '+(uById(t.submitterId)?fullName(uById(t.submitterId)):'')).toLowerCase().includes(q));
  if(statusFilter)tickets=tickets.filter(t=>statusFilter==='Resolved'?(t.status==='Resolved'||t.status==='Closed'):t.status===statusFilter);
  if(priorityFilter)tickets=tickets.filter(t=>t.priority===priorityFilter);
  if(f.tkAssignee)tickets=tickets.filter(t=>t.assignedTo===f.tkAssignee);
  const _priRank={Critical:0,High:1,Medium:2,Low:3};
  const _tkTime=t=>t.createdAt||t.date||'';
  if(f.tkSort==='old')tickets.sort((a,b)=>String(_tkTime(a)).localeCompare(String(_tkTime(b))));
  else if(f.tkSort==='pri')tickets.sort((a,b)=>((_priRank[a.priority]??9)-(_priRank[b.priority]??9))||String(_tkTime(b)).localeCompare(String(_tkTime(a))));
  else tickets.sort((a,b)=>String(_tkTime(b)).localeCompare(String(_tkTime(a))));

  const open=base.filter(t=>t.status==='Open').length;
  const inprog=base.filter(t=>t.status==='In Progress').length;
  const resolved=base.filter(t=>t.status==='Resolved'||t.status==='Closed').length;

  const priClr={High:'#DC2626',Medium:'#F59E0B',Low:'#6B7280',Critical:'#7C3AED'};
  const priBg={High:'#FEF2F2',Medium:'#FFFBEB',Low:'#F9FAFB',Critical:'#F5F3FF'};

  function tkCard(t){
    const assignee=uById(t.assignedTo);
    const submitter=uById(t.submitterId);
    const cl=clById(t.checklistId);
    const canResolve=can('tickets','resolve')||can('tickets','manage')||(t.assignedTo===S.uid);
    const canDelete=can('tickets','delete');
    return'<div style="background:var(--c-surface);border-radius:var(--r-lg);border:1px solid var(--c-border);box-shadow:var(--sh-sm);padding:16px;border-left:4px solid '+(priClr[t.priority]||'#9CA3AF')+'">'+
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px">'+
        '<div style="flex:1;min-width:0">'+
          '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">'+
            '<span style="font-size:11px;font-weight:800;padding:2px 8px;border-radius:20px;background:'+(priBg[t.priority]||'#F9FAFB')+';color:'+(priClr[t.priority]||'#6B7280')+'">'+esc(t.priority)+'</span>'+
            chip(t.status)+
            '<span style="font-size:11px;color:#9CA3AF">'+fmtS(t.date||t.createdAt?.slice(0,10)||'')+'</span>'+
          '</div>'+
          '<div style="font-size:14px;font-weight:700;color:#13171B;margin-bottom:4px">'+esc(t.title)+'</div>'+
          '<div style="font-size:12px;color:#6B7280;line-height:1.5;white-space:pre-wrap">'+esc(t.description)+'</div>'+
          ((t.occurrences||[]).length?'<div style="margin-top:7px;display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:#B45309;background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:3px 9px" title="'+esc((t.occurrences||[]).map(o=>fmtS(o.date||'')).join(', '))+'">\u{1F501} Reoccurred '+(t.occurrences||[]).length+'\u00D7 — last '+esc(fmtS((((t.occurrences||[]).slice(-1)[0])||{}).date||t.date||''))+'</div>':'')+
          (t.resolveNote&&(t.status==='Resolved'||t.status==='Closed')?'<div style="margin-top:7px;font-size:11.5px;color:#047857;background:#FFEAD7;border:1px solid #A7F3D0;border-radius:8px;padding:5px 9px"><b>Resolution:</b> '+esc(t.resolveNote)+'</div>':'')+
          // Show photo from the linked submission's question response
          (()=>{
            if(!t.questionId||!t.submitterId||!t.date)return'';
            const sub=(DB.submissions||[]).find(s=>s.checklistId===t.checklistId&&s.userId===t.submitterId&&s.date===t.date);
            if(!sub)return'';
            const qr=(sub.questionResponses||[]).find(r=>r.questionId===t.questionId);
            const pl=_qrPhotoList(qr);
            if(!pl.length)return'';
            return'<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">'+pl.map(ph=>'<img src="'+esc(ph)+'" loading="lazy" decoding="async" alt="Task response photo" onclick="App._bigImg(this.src)" style="max-width:160px;max-height:110px;border-radius:10px;object-fit:cover;border:1px solid #E5E7EB;cursor:pointer" title="Response photo"/>').join('')+'</div>';
          })()+
        '</div>'+
        (canDelete?'<button onclick="App._delTicket(\''+t.id+'\')" style="width:28px;height:28px;display:grid;place-items:center;border-radius:8px;border:none;background:#FEF2F2;cursor:pointer;color:#DC2626;flex-shrink:0">'+ic('x','w-3.5 h-3.5')+'</button>':'')+
      '</div>'+
      '<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding-top:10px;border-top:1px solid #F3F4F6">'+
        '<div style="display:flex;align-items:center;gap:6px">'+
          '<span style="font-size:11px;font-weight:600;color:#9CA3AF">Assigned to</span>'+
          '<span style="font-size:12px;font-weight:700;color:#374151">'+(assignee?esc(fullName(assignee)):'Unknown')+'</span>'+
        '</div>'+
        (submitter?'<div style="display:flex;align-items:center;gap:6px"><span style="font-size:11px;font-weight:600;color:#9CA3AF">From</span><span style="font-size:12px;font-weight:700;color:#374151">'+esc(fullName(submitter))+'</span></div>':'')+
        (cl?'<div style="display:flex;align-items:center;gap:6px"><span style="font-size:11px;font-weight:600;color:#9CA3AF">Checklist</span><span style="font-size:12px;font-weight:700;color:#374151">'+esc(cl.name)+'</span></div>':'')+
        '<div style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap">'+
          (canResolve&&t.status==='Open'?btn('Start','App._tkSetStatus(this)',{variant:'subtle',size:'sm',attrs:`data-id="${t.id}" data-st="In Progress"`}):'')+
          (canResolve&&t.status==='In Progress'?btn('Resolve',`App._resolveTicket('${t.id}')`,{variant:'brand',size:'sm'}):'')+
          ((canResolve||can('tickets','close'))&&(t.status==='Open'||t.status==='In Progress')?btn('Close','App._tkSetStatus(this)',{variant:'ghost',size:'sm',attrs:`data-id="${t.id}" data-st="Closed"`}):'')+
          ((can('tickets','reopen')||can('tickets','manage'))&&(t.status==='Resolved'||t.status==='Closed')?btn('Reopen','App._tkSetStatus(this)',{variant:'ghost',size:'sm',attrs:`data-id="${t.id}" data-st="Open"`}):'')+
        '</div>'+
      '</div>'+
    '</div>';
  }

  return'<div class="fade">'+
    hdr('Tickets','Escalation tickets from checklist responses')+
    // Stats row — tap a card to filter by that status (Clear resets)
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">'+
      statCard('Open',open,'#F97316',"App._tkFilter('status','Open')")+
      statCard('In Progress',inprog,'#3B82F6',"App._tkFilter('status','In Progress')")+
      statCard('Resolved',resolved,'#936659',"App._tkFilter('status','Resolved')")+
    '</div>'+
    // R12 Filters: search · assignee · priority · sort (+ Clear), status pills below (one-line scroll)
    (()=>{
      const _selSt='font-size:12.5px;padding:6px 26px 6px 10px;min-height:0;height:34px;width:auto';
      const _people=[...new Set(base.map(t=>t.assignedTo).filter(Boolean))].map(id=>uById(id)).filter(Boolean).sort((a,b)=>fullName(a).localeCompare(fullName(b)));
      const _active=!!(f.tkQ||statusFilter||priorityFilter||f.tkAssignee||f.tkSort);
      return '<div class="ui-card" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:10px 12px;margin-bottom:10px">'+
        '<div style="position:relative;flex:1;min-width:170px"><span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--c-text-3);display:flex">'+ic('search','w-4 h-4')+'</span>'+
        `<input id="tk-q" value="${esc(f.tkQ||'')}" oninput="S.filters.tkQ=this.value;App._searchRR('tk-q')" placeholder="Search title, description, people…" class="ui-input" style="padding:6px 10px 6px 32px;min-height:34px;font-size:12.5px"/></div>`+
        `<select onchange="S.filters.tkAssignee=this.value;rr()" class="ui-select" style="${_selSt}"><option value="">All assignees</option>${_people.map(p=>`<option value="${p.id}" ${f.tkAssignee===p.id?'selected':''}>${esc(fullName(p))}</option>`).join('')}</select>`+
        `<select onchange="App._tkFilter('priority',this.value)" class="ui-select" style="${_selSt}"><option value="">Any priority</option>${['Critical','High','Medium','Low'].map(p=>`<option ${priorityFilter===p?'selected':''}>${p}</option>`).join('')}</select>`+
        `<select onchange="S.filters.tkSort=this.value;rr()" class="ui-select" style="${_selSt}"><option value="">Newest first</option><option value="old" ${f.tkSort==='old'?'selected':''}>Oldest first</option><option value="pri" ${f.tkSort==='pri'?'selected':''}>By priority</option></select>`+
        (_active?`<button onclick="['tkQ','tkStatus','tkPriority','tkAssignee','tkSort'].forEach(k=>delete S.filters[k]);rr()" class="ui-btn ui-btn-ghost ui-btn-sm">Clear</button>`:'')+
      '</div>'+
      '<div class="hscroll" style="gap:8px;margin-bottom:16px;align-items:center">'+
        ['','Open','In Progress','Resolved','Closed'].map(st=>{const on=statusFilter===st;return`<button type="button" class="ui-tab-pill${on?' on':''}" style="flex-shrink:0" onclick="App._tkFilter('status','${st}')">${st||'All'}</button>`;}).join('')+
        `<span style="flex-shrink:0;font-size:11.5px;color:var(--c-text-3);font-weight:600;margin-left:4px">${tickets.length} ticket${tickets.length===1?'':'s'}</span>`+
      '</div>';
    })()+
    // List
    (tickets.length?
      '<div style="display:flex;flex-direction:column;gap:10px">'+tickets.map(tkCard).join('')+'</div>':
      (_isLoading('tickets')?loadingState('Loading tickets…'):empty('ticket','No tickets','Tickets are created automatically when an escalation answer is submitted.'))
    )+
  '</div>';
}

App._showTeamStat=(uid,type)=>{
  const u=uById(uid);if(!u)return;
  let title='',rows='',empty='';
  if(type==='assigned'){
    title='Assigned checklists — '+esc(fullName(u));
    empty='No checklists assigned.';
    const cls=DB.checklists.filter(c=>(c.assignees||[]).includes(uid));
    rows=cls.map(c=>{
      const today=todayISO();
      const isOn=clOn(c,today);
      return'<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid #F3F4F6">'        +'<div><div style="font-size:13px;font-weight:600">'+esc(c.name)+'</div>'        +'<div style="font-size:11px;color:#9CA3AF;margin-top:2px">'+esc(c.frequency)+(c.department?' · '+esc(c.department):'')+'</div></div>'        +(isOn?'<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:#FFEAD7;color:#7A5344">Active today</span>':'<span style="font-size:11px;color:#D1D5DB">Not today</span>')        +'</div>';
    }).join('');
  } else if(type==='late'){
    title='Late submissions — '+esc(fullName(u));
    empty='No late submissions.';
    const lateSubs=DB.submissions.filter(s=>s.userId===uid&&s.status==='Late'&&!!clById(s.checklistId));
    rows=lateSubs.map(s=>{
      const c=clById(s.checklistId);
      return'<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid #F3F4F6">'        +'<div><div style="font-size:13px;font-weight:600">'+(c?esc(c.name):'[Deleted checklist]')+'</div>'        +'<div style="font-size:11px;color:#9CA3AF;margin-top:2px">'+fmtS(s.date)+(s.submittedAt?' · '+new Date(s.submittedAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}):'')+'</div></div>'        +chip(s.status)+'</div>';
    }).join('');
  } else if(type==='tickets'){
    title='Open tickets — '+esc(fullName(u));
    empty='No open tickets.';
    const tkts=(DB.tickets||[]).filter(t=>t.submitterId===uid&&t.status==='Open');
    rows=tkts.map(t=>{
      const priClr={High:'#DC2626',Medium:'#F59E0B',Low:'#6B7280'};
      return'<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid #F3F4F6">'        +'<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">'+esc(t.title)+'</div>'        +'<div style="font-size:11px;color:#9CA3AF;margin-top:2px">'+fmtS(t.date||t.createdAt?.slice(0,10)||'')+'</div></div>'        +'<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:#FEF2F2;color:'+(priClr[t.priority]||'#6B7280')+'">'+esc(t.priority)+'</span>'        +'</div>';
    }).join('');
  }
  openModal('<div style="padding:20px;max-height:80vh;display:flex;flex-direction:column">'    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">'    +'<h2 style="font-size:16px;font-weight:800;font-family:var(--font-display)">'+title+'</h2>'    +'<button onclick="App.closeModal()" style="width:28px;height:28px;display:grid;place-items:center;border-radius:8px;border:none;background:transparent;cursor:pointer;color:#9CA3AF">'+ic('x')+'</button>'    +'</div>'    +'<div style="overflow-y:auto;flex:1;border:1px solid #F3F4F6;border-radius:10px">'    +(rows||'<div style="font-size:13px;color:#9CA3AF;text-align:center;padding:24px">'+empty+'</div>')    +'</div></div>','max-w-md');
};

App._tkSetStatus=(el)=>{const id=el.dataset.id,status=el.dataset.st;App._ticketStatus(id,status);};
App._tkFilter=(key,val)=>{if(key==='status')S.filters.tkStatus=val;else if(key==='assignee')S.filters.tkAssignee=val;else S.filters.tkPriority=val;rr();};
App._ticketStatus=async(id,status)=>{
  const t=(DB.tickets||[]).find(x=>x.id===id);if(!t)return;
  const _tkOk = status==='Open' ? (can('tickets','reopen')||can('tickets','manage'))
    : status==='Closed' ? (can('tickets','close')||can('tickets','resolve')||can('tickets','manage')||t.assignedTo===S.uid)
    : (can('tickets','resolve')||can('tickets','manage')||t.assignedTo===S.uid);
  if(!_tkOk){toast('You don’t have permission to change this ticket','err');return;}
  t.status=status;t.updatedAt=new Date().toISOString();
  const values={status,updated_at:t.updatedAt};
  if(status==='Open'){t.resolvedAt=null;t.resolveNote='';values.resolved_at=null;values.resolve_note='';}
  saveDB();rr();
  // v2 FIX: checked + queued write — a stale session or dropped connection can no longer
  // silently lose the change (this was the "closed ticket reopens later" bug).
  const ok=await sbWrite({table:'tickets',op:'update',id,match:{col:'id',val:id},values},{label:'Ticket → '+status});
  if(ok)toast(status==='Closed'?'Ticket closed ✓':status==='Open'?'Ticket reopened ✓':'Ticket updated ✓');
};

App._resolveTicket=(id)=>{
  const t=(DB.tickets||[]).find(x=>x.id===id);if(!t)return;
  if(!(can('tickets','resolve')||can('tickets','manage')||t.assignedTo===S.uid)){toast('You don’t have permission to resolve this ticket','err');return;}
  openModal(`<div style="padding:20px">
    <h2 style="font-size:18px;font-weight:800;font-family:var(--font-display);margin-bottom:4px">Resolve ticket</h2>
    <p style="font-size:13px;color:#6B7280;margin-bottom:14px">Add a note explaining how this was resolved.</p>
    <textarea id="tk-note" rows="3" placeholder="What was done to resolve this?" style="width:100%;border:1.5px solid #E5E7EB;border-radius:10px;padding:10px;font-size:13px;resize:none;outline:none;box-sizing:border-box"></textarea>
    <div style="display:flex;gap:8px;margin-top:14px">
      <button onclick="App.closeModal()" style="flex:1;padding:11px;border-radius:10px;border:1.5px solid #E5E7EB;background:#fff;font-weight:600;font-size:14px;cursor:pointer">Cancel</button>
      <button onclick="App._confirmResolve('${id}')" style="flex:2;padding:11px;border-radius:10px;background:#936659;color:#fff;font-weight:700;font-size:14px;border:none;cursor:pointer">Mark Resolved</button>
    </div>
  </div>`,'max-w-sm');
};

App._confirmResolve=(id)=>{
  const note=$('#tk-note')?.value?.trim()||'';
  const t=(DB.tickets||[]).find(x=>x.id===id);if(!t)return;
  t.status='Resolved';t.resolvedAt=new Date().toISOString();t.resolveNote=note;
  // Notify the submitter
  if(t.submitterId&&t.submitterId!==S.uid){
    DB.notifications.unshift({id:uid('n'),userId:t.submitterId,text:'✅ Ticket resolved: "'+t.title+'"'+(note?' — '+note.slice(0,60):''),time:new Date().toISOString(),read:false});
    _invalidateNotifCache();
  }
  t.updatedAt=t.resolvedAt;
  closeModal();saveDB();rr();
  (async()=>{
    const ok=await sbWrite({table:'tickets',op:'update',id,match:{col:'id',val:id},values:{status:'Resolved',resolved_at:t.resolvedAt,resolve_note:note,updated_at:t.updatedAt}},{label:'Ticket resolve'});
    if(ok)toast('Ticket resolved ✓');
  })();
};

App._delTicket=async(id)=>{
  if(!can('tickets','delete')){toast('You don’t have permission to delete tickets','err');return;}
  // ── Delete on the server FIRST, then reflect locally and record the id in a deleted-overlay.
  //    Tickets are no longer mirrored by the background whole-table sync, so a stale second
  //    browser can no longer resurrect a ticket another admin just deleted (the "delete a
  //    ticket → it comes back" bug). ──
  let _dr;
  try{_dr=await sb.from('tickets').delete().eq('id',id);}catch(e){_dr={error:e};}
  if(_dr&&_dr.error){console.error('del ticket failed:',_dr.error.message||_dr.error);toast('Couldn’t delete — please retry.','err');return;}
  DB.tickets=(DB.tickets||[]).filter(t=>t.id!==id);
  if(!DB.tickets_deleted)DB.tickets_deleted=[];
  if(!DB.tickets_deleted.includes(id))DB.tickets_deleted.push(id);
  saveDB();rr();
};


// ── Analytics clickable stat card ──
App._aStatCard=(label,val,color,type,data)=>{
  const colMap={sky:'#0EA5E9',brand:'#936659',rose:'#EF4444',orange:'#F97316'};
  const c=colMap[color]||color;
  return`<div onclick="App._aStatDrill('${type}')" style="background:#fff;border-radius:16px;border:1.5px solid #E5E7EB;padding:16px;cursor:pointer;transition:all .15s" onmouseover="this.style.borderColor='${c}';this.style.boxShadow='0 4px 16px rgba(0,0,0,.08)'" onmouseout="this.style.borderColor='#E5E7EB';this.style.boxShadow=''">`
  +`<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#9CA3AF;margin-bottom:8px">${label}</div><div style="font-size:28px;font-weight:800;color:${c}">${val}</div><div style="font-size:11px;font-weight:700;color:#936659;margin-top:6px">View details →</div></div>`;
};

App._aStatDrill=(type)=>{
  const f=S.filters;
  const fArr=k=>Array.isArray(f[k])?f[k]:(f[k]?[f[k]]:[]);
  let subs=DB.submissions;
  if(!isAdmin())subs=subs.filter(s=>subTree(S.uid).some(u=>u.id===s.userId)||s.userId===S.uid);
  if(fArr('users').length)subs=subs.filter(s=>fArr('users').includes(s.userId));
  if(fArr('deps').length)subs=subs.filter(s=>{const c=clById(s.checklistId);return c&&fArr('deps').includes(c.department);});
  if(fArr('locs').length)subs=subs.filter(s=>{const c=clById(s.checklistId);return c&&fArr('locs').some(l=>(c.locationIds||[]).includes(l));});
  if(fArr('stats').length)subs=subs.filter(s=>fArr('stats').includes(s.status));
  if(f.dr1)subs=subs.filter(s=>s.date>=f.dr1);
  if(f.dr2)subs=subs.filter(s=>s.date<=f.dr2);
  let aTickets=(DB.tickets||[]).slice();
  if(!isAdmin()){
    // Both manager and user: only tickets assigned to them
    aTickets=aTickets.filter(t=>t.assignedTo===S.uid);
  }
  if(f.dr1)aTickets=aTickets.filter(t=>(t.date||t.createdAt?.slice(0,10)||'')>=f.dr1);
  if(f.dr2)aTickets=aTickets.filter(t=>(t.date||t.createdAt?.slice(0,10)||'')<=f.dr2);
  const today=todayISO();
  let title='',rows='',emptyMsg='No data.';
  const subRow=s=>{
    const u=uById(s.userId),c=clById(s.checklistId);
    const extra=s.submittedAt?' · '+new Date(s.submittedAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}):'';
    return'<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid #F3F4F6;cursor:pointer" onclick="App.viewSub(\''+s.id+'\')" onmouseover="this.style.background=\'#FAFAFA\'" onmouseout="this.style.background=\'\'">'
      +'<div style="flex:1;min-width:0">'
      +'<div style="font-size:13px;font-weight:600;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">'+(c?esc(c.name):'<span style="color:#EF4444;font-style:italic">[Deleted checklist]</span>')+'</div>'
      +'<div style="font-size:11px;color:#9CA3AF;margin-top:1px">'+(u?esc(fullName(u)):'?')+' · '+fmtS(s.date)+extra+'</div>'
      +'</div>'+chip(s.status)+'</div>';
  };
  if(type==='submitted'){
    const list=subs.slice().sort((a,b)=>(b.submittedAt||'').localeCompare(a.submittedAt||''));
    title='All Submissions ('+list.length+')';rows=list.map(subRow).join('');emptyMsg='No submissions in this period.';
  } else if(type==='ontime'){
    const list=subs.filter(s=>s.status==='On Time').sort((a,b)=>(b.submittedAt||'').localeCompare(a.submittedAt||''));
    title='On Time ('+list.length+')';rows=list.map(subRow).join('');emptyMsg='No on-time submissions.';
  } else if(type==='late'){
    const list=subs.filter(s=>s.status==='Late').sort((a,b)=>(b.submittedAt||'').localeCompare(a.submittedAt||''));
    title='Late ('+list.length+')';rows=list.map(subRow).join('');emptyMsg='No late submissions.';
  } else if(type==='missed'){
    const relevantUsers=isAdmin()?DB.users:[me(),...subTree(S.uid)].filter(Boolean);
    const dr1=f.dr1||(new Date(Date.now()-30*86400000).toISOString().slice(0,10));
    const dr2=f.dr2||today;
    const dateRange=[];
    let d=new Date(dr1+'T00:00:00');const dEnd=new Date(dr2+'T00:00:00');
    while(d<=dEnd&&dateRange.length<60){dateRange.push(d.toISOString().slice(0,10));d.setDate(d.getDate()+1);}
    const missed=[];
    const _seenGrp=new Set(); // anyOne checklists are collective → list once per date
    relevantUsers.forEach(u=>{
      dateRange.forEach(dt=>{
        if(dt>=today)return;
        DB.checklists.filter(c=>(c.assignees||[]).includes(u.id)&&clOn(c,dt)&&c.status!=='Draft').forEach(c=>{
          // For "any one" group checklists, a completion by ANY assignee counts for everyone —
          // so it's only "missed" if nobody in the group submitted. Otherwise check own submission.
          const done=c.anyOne
            ? DB.submissions.some(s=>s.checklistId===c.id&&s.date===dt&&s.status!=='Editing')
            : !!DB.submissions.find(s=>s.checklistId===c.id&&s.userId===u.id&&s.date===dt);
          if(done)return;
          if(c.anyOne){
            const k=c.id+'|'+dt;
            if(_seenGrp.has(k))return; // already listed this group checklist for this date
            _seenGrp.add(k);
            missed.push({u:null,c,dt}); // group → no single owner
          } else {
            missed.push({u,c,dt});
          }
        });
      });
    });
    title='Missed ('+missed.length+')';
    rows=missed.slice(0,100).map(({u,c,dt})=>'<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid #F3F4F6"><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600">'+esc(c.name)+(c.anyOne?' <span style="font-size:9px;font-weight:700;padding:1px 6px;border-radius:8px;background:#EEF2FF;color:#4338CA">👥 Group</span>':'')+'</div><div style="font-size:11px;color:#9CA3AF">'+(u?esc(fullName(u)):'No one in group completed')+' · '+fmtS(dt)+'</div></div><span style="font-size:11px;font-weight:700;color:#F97316;background:#FFF7ED;padding:2px 8px;border-radius:20px">Missed</span></div>').join('');
    emptyMsg='No missed checklists in this period.';
  } else if(type==='compliant'||type==='noncompliant'){
    const want=type==='noncompliant';
    const list=subs.map(s=>{const c=clById(s.checklistId);if(!c||!(c.questionIds||[]).length)return null;const n=_subEscalationCount(c,s);return{s,c,n};})
      .filter(x=>x&&((x.n>0)===want))
      .sort((a,b)=>want?(b.n-a.n)||((b.s.submittedAt||'').localeCompare(a.s.submittedAt||'')):(b.s.submittedAt||'').localeCompare(a.s.submittedAt||''));
    title=(want?'Non-compliant':'Compliant')+' ('+list.length+')';
    rows=list.map(({s,c,n})=>{const u=uById(s.userId);return'<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid #F3F4F6;cursor:pointer" onclick="App.viewSub(\''+s.id+'\')" onmouseover="this.style.background=\'#FAFAFA\'" onmouseout="this.style.background=\'\'">'
      +'<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">'+esc(c.name)+'</div>'
      +'<div style="font-size:11px;color:#9CA3AF;margin-top:1px">'+(u?esc(fullName(u)):'?')+' · '+fmtS(s.date)+'</div></div>'
      +(want
        ? '<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:#FFF1F2;color:#BE123C">⚠ '+n+' escalated</span>'
        : '<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:#FFEAD7;color:#7A5344">✓ Compliant</span>')
      +'</div>';}).join('');
    emptyMsg=want?'No non-compliant submissions in this period — all clear.':'No compliant submissions in this period.';
  } else {
    const tkMap={tickets:aTickets,tkopen:aTickets.filter(t=>t.status==='Open'),tkhigh:aTickets.filter(t=>t.priority==='High'||t.priority==='Critical'),tkresolved:aTickets.filter(t=>t.status==='Resolved'||t.status==='Closed')};
    const tkLabels={tickets:'All Tickets',tkopen:'Open Tickets',tkhigh:'High Priority Tickets',tkresolved:'Resolved Tickets'};
    const list=(tkMap[type]||[]).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
    title=(tkLabels[type]||'Tickets')+' ('+list.length+')';
    const priClr={High:'#DC2626',Medium:'#F59E0B',Low:'#6B7280',Critical:'#7C3AED'};
    rows=list.map(t=>'<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid #F3F4F6"><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">'+esc(t.title)+'</div><div style="font-size:11px;color:#9CA3AF;margin-top:1px">'+(uById(t.submitterId)?'From '+esc(fullName(uById(t.submitterId))):'')+' → '+(uById(t.assignedTo)?esc(fullName(uById(t.assignedTo))):'?')+' · '+fmtS(t.date||t.createdAt?.slice(0,10)||'')+'</div></div><span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:#FEF2F2;color:'+(priClr[t.priority]||'#6B7280')+'">'+esc(t.priority)+'</span>'+chip(t.status)+'</div>').join('');
    emptyMsg='No tickets in this category.';
  }
  openModal('<div style="display:flex;flex-direction:column;max-height:80vh">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #F3F4F6;flex-shrink:0">'
    +'<h2 style="font-size:16px;font-weight:800;font-family:var(--font-display)">'+title+'</h2>'
    +'<button onclick="App.closeModal()" style="width:28px;height:28px;display:grid;place-items:center;border-radius:8px;border:none;background:transparent;cursor:pointer;color:#9CA3AF">'+ic('x')+'</button>'
    +'</div>'
    +'<div style="overflow-y:auto;flex:1">'+(rows||'<div style="padding:32px;text-align:center;color:#9CA3AF;font-size:13px">'+emptyMsg+'</div>')+'</div></div>','max-w-lg');
};

