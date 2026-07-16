/* ============================================================
   Bridge — 09-users.js  (split from Bridge.html lines 2301-2565)
   Classic script: shares top-level scope with the other /js files.
   Load order matters — see index.html.
   ============================================================ */
/* ===== USERS ===== */
function _disableBtn(u){
  const isActive=u.status==='Active';
  const bg=isActive?'transparent':'#FEF3C7';
  const col=isActive?'#9CA3AF':'#D97706';
  const tip=isActive?'Disable user':'Enable user';
  return '<button onclick="App.togUser(\''+u.id+'\')" title="'+tip+'" style="width:32px;height:32px;display:grid;place-items:center;border-radius:8px;color:'+col+';background:'+bg+';border:none;cursor:pointer">'+ic(isActive?'lock':'unlock','w-4 h-4')+'</button>';
}

function usersPage(){
  let list=visU();const q=S.search.toLowerCase();
  if(q)list=list.filter(u=>fullName(u).toLowerCase().includes(q)||u.email.toLowerCase().includes(q));
  if(S.filters.dep)list=list.filter(u=>u.department===S.filters.dep);
  if(S.filters.stat)list=list.filter(u=>u.status===S.filters.stat);
  return`<div class="fade">${hdr('Users',visU().length+' people',can('employees','create')?btnP('Add user','App.editUser()','plus'):'')}
  <div class="flex gap-2 mb-4 flex-wrap">
    <div class="relative flex-1 min-w-[160px] md:hidden"><span class="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300">${ic('search','w-4 h-4')}</span><input oninput="S.search=this.value;rr()" value="${esc(S.search)}" placeholder="Search…" class="w-full bg-white border border-ink-200 rounded-xl pl-9 pr-3 py-2.5 text-sm rf"/></div>
    <select onchange="S.filters.dep=this.value;rr()" class="bg-white border border-ink-200 rounded-xl px-3 py-2.5 text-sm rf"><option value="">All depts</option>${topDepts().map(d=>`<option ${S.filters.dep===d.name?'selected':''}>${esc(d.name)}</option>`).join('')}</select>
    <select onchange="S.filters.stat=this.value;rr()" class="bg-white border border-ink-200 rounded-xl px-3 py-2.5 text-sm rf"><option value="">Any status</option><option ${S.filters.stat==='Active'?'selected':''}>Active</option><option ${S.filters.stat==='Inactive'?'selected':''}>Inactive</option></select>
  </div>
  <div class="hidden md:block bg-white rounded-2xl border border-ink-100 shadow-soft overflow-hidden">
    <table class="w-full text-sm"><thead><tr class="text-[10px] text-ink-400 uppercase tracking-wide border-b border-ink-100 text-left"><th class="px-5 py-3 font-semibold">Name</th><th class="px-5 py-3 font-semibold">Department</th><th class="px-5 py-3 font-semibold">Role</th><th class="px-5 py-3 font-semibold">Reports to</th><th class="px-5 py-3 font-semibold">Status</th><th class="px-5 py-3"></th></tr></thead>
    <tbody class="divide-y divide-ink-50">${list.map(u=>{const mgr=u.managerId?uById(u.managerId):null;const isMgrUser=subTree(u.id).length>0;return`<tr class="hover:bg-ink-50/50"><td class="px-5 py-3"><div class="flex items-center gap-3">${avatar(u,'w-9 h-9','text-xs')}<div><div class="font-semibold">${esc(fullName(u))}</div><div class="text-xs text-ink-400">${esc(u.email)}</div></div></div></td><td class="px-5 py-3">${esc(u.department)}<div class="text-xs text-ink-400">${esc(u.position)}</div></td><td class="px-5 py-3">${u.role==='Admin'?'<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:#15171C;color:#fff">Super Admin</span>':u.role==='SubAdmin'?'<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:#EEF2FF;color:#4338CA">Admin</span>':isMgrUser?'<span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700">Manager</span>':'<span class="text-xs text-ink-400">User</span>'}</td><td class="px-5 py-3 text-sm">${mgr?esc(fullName(mgr)):'<span class="text-ink-300">—</span>'}</td><td class="px-5 py-3">${chip(u.status)}</td><td class="px-5 py-3"><div class="flex gap-1 justify-end">${(can('employees','edit')||can('employees','resetPassword')||can('employees','deactivate')||can('employees','delete'))?`${can('employees','edit')?`<button onclick="App.editUser('${u.id}')" style="width:32px;height:32px;display:grid;place-items:center;border-radius:8px;color:#9CA3AF;background:transparent;border:none;cursor:pointer" onmouseover="this.style.background='#F3F4F6'" onmouseout="this.style.background='transparent'">${ic('edit','w-4 h-4')}</button>`:''}${can('employees','resetPassword')?`<button onclick="App.resetPw('${u.id}')" style="width:32px;height:32px;display:grid;place-items:center;border-radius:8px;color:#9CA3AF;background:transparent;border:none;cursor:pointer" onmouseover="this.style.background='#F3F4F6'" onmouseout="this.style.background='transparent'" title="Reset password">${ic('key','w-4 h-4')}</button>`:''}${can('employees','deactivate')?_disableBtn(u):''}${(u.role!=='Admin'&&can('employees','delete'))?`<button onclick="App.delUser('${u.id}')" style="width:32px;height:32px;display:grid;place-items:center;border-radius:8px;color:#9CA3AF;background:transparent;border:none;cursor:pointer" onmouseover="this.style.background='#FFF1F2';this.style.color='#BE123C'" onmouseout="this.style.background='transparent';this.style.color='#9CA3AF'">${ic('trash','w-4 h-4')}</button>`:''}`:'<span class="text-ink-200">—</span>'}</div></td></tr>`;}).join('')}</tbody></table>
    ${list.length?'':empty('users','No users','')}
  </div>
  <div class="md:hidden space-y-2">${list.map(u=>{const mgr=u.managerId?uById(u.managerId):null;return`<div class="bg-white rounded-2xl border border-ink-100 shadow-soft p-4" ${can('employees','edit')?`onclick="App.editUser('${u.id}')" style="cursor:pointer"`:''}>
    <div class="flex items-center gap-3">${avatar(u,'w-10 h-10','text-sm')}<div class="min-w-0 flex-1"><div class="font-semibold truncate">${esc(fullName(u))}</div><div class="text-xs text-ink-400">${esc(u.position)} · ${esc(u.department)}</div></div>${chip(u.status)}</div>
    ${mgr?`<div class="text-xs text-ink-400 mt-2.5 pt-2.5 border-t border-ink-50">Reports to <strong>${esc(fullName(mgr))}</strong></div>`:''}</div>`;}).join('')}</div>
</div>`;}
function _docAccessSection(u){
  if(!topDepts().length&&!DB.locations.length)return'<div style="background:#F9FAFB;border-radius:16px;padding:14px;margin-top:8px"><p style="font-size:12px;color:#9CA3AF;text-align:center">Add departments and locations first to assign document access.</p></div>';
  const da=u?.docAccess||{departments:{},locations:{}};
  const PERMS=['view','upload','download','edit'];
  let html='<div style="border-top:1px solid #ECEDF0;margin-top:14px;padding-top:14px">'
    +'<p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#9CA3AF;margin-bottom:10px">Document Access</p>';
  if(topDepts().length){
    html+='<p style="font-size:11px;font-weight:700;color:#374151;margin-bottom:8px">Departments</p>';
    html+=topDepts().map(d=>{
      const dp=da.departments?.[d.name]||{};
      return'<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:9px 12px;background:#F9FAFB;border-radius:10px">'
        +'<span style="font-size:12px;font-weight:600;min-width:100px;flex-shrink:0">'+esc(d.name)+'</span>'
        +'<div style="display:flex;gap:12px;flex-wrap:wrap">'
        +PERMS.map(p=>'<label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer">'
          +'<input type="checkbox" class="doc-perm-dept" data-dept="'+esc(d.name)+'" data-perm="'+p+'"'+(dp[p]?' checked':'')+'> '
          +p.charAt(0).toUpperCase()+p.slice(1)
          +'</label>').join('')
        +'</div></div>';
    }).join('');
  }
  if(DB.locations.length){
    html+='<p style="font-size:11px;font-weight:700;color:#374151;margin-bottom:8px;margin-top:10px">Locations</p>';
    html+=DB.locations.map(l=>{
      const lp=da.locations?.[l.id]||{};
      return'<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:9px 12px;background:#F9FAFB;border-radius:10px">'
        +'<span style="font-size:12px;font-weight:600;min-width:100px;flex-shrink:0">'+esc(l.name)+'</span>'
        +'<div style="display:flex;gap:12px;flex-wrap:wrap">'
        +PERMS.map(p=>'<label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer">'
          +'<input type="checkbox" class="doc-perm-loc" data-loc="'+l.id+'" data-perm="'+p+'"'+(lp[p]?' checked':'')+'> '
          +p.charAt(0).toUpperCase()+p.slice(1)
          +'</label>').join('')
        +'</div></div>';
    }).join('');
  }
  html+='</div>';
  return html;
}

App.editUser=(id=null)=>{
  const u=id?uById(id):null;
  if(!can('employees',id?'edit':'create')){toast('You don’t have permission to do that','err');return;}
  const mgrOpts=DB.users.filter(x=>!u||x.id!==u.id&&!isDesc(x.id,u.id));
  const v=(f,d='')=>esc(u?u[f]??d:d);
  openModal(`<div class="p-5"><div class="flex justify-between mb-4"><h2 class="fd text-xl font-bold">${u?'Edit':'New'} user</h2><button onclick="App.closeModal()" class="text-ink-400">${ic('x')}</button></div>
  <div class="space-y-3">
    <div class="grid grid-cols-2 gap-3">${fld('First name','u-fn',v('firstName'))}${fld('Last name','u-ln',v('lastName'))}</div>
    <div class="grid grid-cols-2 gap-3">${fld('Email','u-email',v('email'),'email')}${fld('Phone','u-phone',v('phone'))}</div>
    <div class="grid grid-cols-2 gap-3">${fld('Position','u-pos',v('position'))}${selF('Department','u-dep',topDepts().map(d=>d.name),u?.department||'')}</div>
    <div class="grid grid-cols-2 gap-3">${selF('Status','u-status',['Active','Inactive'],u?.status||'Active')}<div><label for="u-mgr" class="block text-xs font-semibold text-ink-500 mb-1">Reports to</label><select id="u-mgr" class="w-full bg-white border border-ink-200 rounded-xl px-3 py-2.5 text-sm rf"><option value="">— None —</option>${mgrOpts.map(m=>`<option value="${m.id}"${u?.managerId===m.id?' selected':''}>${esc(fullName(m))}</option>`).join('')}</select></div></div>
    ${!u?fld('Password','u-pw','','password','Set a password'):''}
    <div class="bg-ink-50 rounded-2xl p-4"><p class="text-[10px] font-bold text-ink-400 uppercase tracking-wide mb-2">Notifications</p>${mkTog('u-email',u?.emailEnabled??true,'Receive email notifications')}</div>
    <div style="font-size:11.5px;color:var(--c-text-3);background:var(--c-surface-2);border:1px dashed var(--c-border-2);border-radius:10px;padding:9px 12px">🛡️ Role, tab access, document permissions and submission rules are managed in <b>Access Control</b>.</div>
  </div>
  <div class="flex gap-2 mt-5"><button onclick="App.closeModal()" style="flex:1;padding:12px;border-radius:12px;border:1.5px solid #ECEDF0;background:#fff;font-weight:600;font-size:14px;cursor:pointer">Cancel</button><button id="save-user-btn" onclick="if(this.disabled)return;this.disabled=true;this.textContent=this.textContent==='Save'?'Saving…':'Creating…';App.saveUser('${id||''}').catch(()=>{}).finally(()=>{const b=document.getElementById('save-user-btn');if(b){b.disabled=false;b.textContent='${u?'Save':'Create'}';}})" style="flex:1;padding:12px;border-radius:12px;background:#15171C;color:#fff;font-weight:600;font-size:14px;border:none;cursor:pointer">${u?'Save':'Create'}</button></div>
  </div>`,'max-w-2xl');
};
App.saveUser=async(id)=>{
  if(!can('employees',id?'edit':'create')){toast('You don’t have permission to do that','err');return;}
  const g=i=>($('#'+i)?.value||'').trim();
  const fn=g('u-fn'),ln=g('u-ln'),email=g('u-email');
  if(!fn||!ln||!email){toast('Name & email required','err');return;}
  const mId=$('#u-mgr')?.value||null;
  if(id&&mId&&(mId===id||isDesc(mId,id))){toast('Circular hierarchy!','err');return;}

  // ── Email change: must update the LOGIN email too (auth), not only the profile row.
  //    Done via the update-user-email edge function (service role) — profile row updated after success.
  if(id){
    const _cur=uById(id);
    if(_cur&&email&&_cur.email&&email.toLowerCase()!==_cur.email.toLowerCase()){
      const btn=document.getElementById('save-user-btn');
      if(btn){btn.disabled=true;btn.textContent='Updating email…';}
      const{data:_er,error:_ee}=await sb.functions.invoke('update-user-email',{body:{user_id:id,email}});
      if(_ee||_er?.error){
        let msg=_er?.error||_ee?.message||'Email update failed';
        try{if(_ee?.context){const b=await _ee.context.json();msg=b.error||msg;}}catch(e){}
        toast('Email not changed: '+msg,'err');
        if(btn){btn.disabled=false;btn.textContent='Save';}
        return;
      }
      toast('Login email updated ✓');
    }
  }

  // ── Access fields are managed in Access Control — preserve existing values here ──
  const _ex=id?uById(id):null;
  const docAccess=_ex?(_ex.docAccess||{departments:{},locations:{}}):{departments:{},locations:{}};
  const questionsAccess=_ex?(_ex.questionsAccess??false):false;
  const emailEnabled=togV('u-email');
  const rules=_ex?(_ex.rules||{past:true,future:true,edit:true}):{past:true,future:true,edit:true};
  const approval_settings=_ex?(_ex.approval||{past:false,future:false,edited:false}):{past:false,future:false,edited:false};

  const pd={first_name:fn,last_name:ln,email,
    phone:g('u-phone'),position:g('u-pos'),
    department:$('#u-dep')?.value,role:(_ex?_ex.role:'User'),
    status:$('#u-status')?.value,manager_id:mId||null,
    rules,approval_settings,
    doc_access:docAccess,questions_access:questionsAccess,email_enabled:emailEnabled};

  if(id){
    // Update local state immediately
    const u=uById(id);
    // ── Manager change: record history so dashboards can scope by date ──
    // Rule: dates BEFORE the change belong to the old manager; the change date onwards belongs to the new one
    if(u&&(u.managerId||null)!==(mId||null)){
      const chDate=todayISO();
      let h=Array.isArray(u.managerHistory)?JSON.parse(JSON.stringify(u.managerHistory)):[];
      if(!h.length)h.push({managerId:u.managerId||null,from:'0001-01-01',to:chDate});
      else{const open=h.find(p=>!p.to);if(open)open.to=chDate;}
      h.push({managerId:mId||null,from:chDate,to:null});
      u.managerHistory=h;
      pd.manager_history=h;
    }
    if(u)Object.assign(u,{firstName:fn,lastName:ln,email,
      phone:pd.phone,position:pd.position,department:pd.department,
      role:pd.role,status:pd.status,managerId:mId,
      rules,approval:approval_settings,
      questionsAccess,emailEnabled,
      docAccess});
    log(fullName(me()),'Edited user',fn+' '+ln);
    toast('Saved ✓');closeModal();saveDB();render();
    // Sync all fields including doc_access to Supabase in background
    sb.from('profiles').update(pd).eq('id',id).then(({error})=>{
      if(error)console.warn('saveUser sync:',error.message);
    });
  } else {
    const pw=g('u-pw');if(!pw){toast('Password required','err');return;}
    const saveBtn=document.querySelector('[onclick*="saveUser"]');
    if(saveBtn){saveBtn.disabled=true;saveBtn.textContent='Creating…';}
    toast('Creating user…','ok');
    const{data:res,error}=await sb.functions.invoke('create-user',{body:{...pd,password:pw}});
    if(error||res?.error){
      let msg=error?.message||res?.error||'Failed';
      try{if(error?.context){const b=await error.context.json();msg=b.error||msg;}}catch(e){}
      toast(msg,'err');
      if(saveBtn){saveBtn.disabled=false;saveBtn.textContent='Create';}
      return;
    }
    const newId=res?.id||res?.user?.id;
    if(!newId){toast('User created — reload to see them','ok');closeModal();render();return;}
    DB.users.push({id:newId,firstName:fn,lastName:ln,email,
      phone:pd.phone,position:pd.position,department:pd.department,
      role:pd.role,status:pd.status,managerId:mId,
      rules:pd.rules,approval:pd.approval_settings,
      questionsAccess,emailEnabled,
      docAccess,cities:[],hrm:null,password:'***'});
    try{_ensureHrm(uById(newId));_permsV3Migrate();}catch(e){}
    // Save doc_access + questions_access for new user
    sb.from('profiles').update({doc_access:docAccess,questions_access:questionsAccess,email_enabled:emailEnabled}).eq('id',newId).then(()=>{}).catch(()=>{});
    log(fullName(me()),'Created user',fn+' '+ln);
    toast('✓ '+fn+' '+ln+' created');
    closeModal();saveDB();render();
  }
};
App.resetPw=(id)=>{
  if(!can('employees','resetPassword')){toast('You don’t have permission to reset passwords','err');return;}
  const u=uById(id);
  openModal(
    '<div class="p-6">'
    +'<div class="flex justify-between mb-4">'
    +'<h2 class="fd text-xl font-bold">Reset password</h2>'
    +'<button onclick="App.closeModal()" class="text-ink-400">'+ic('x')+'</button>'
    +'</div>'
    +'<p class="text-sm text-ink-400 mb-4">New password for <strong>'+esc(fullName(u))+'</strong></p>'
    +fld('New password','rp-pw','','password','')
    +'<div class="flex gap-2 mt-4">'
    +'<button onclick="App.closeModal()" style="flex:1;padding:12px;border-radius:12px;border:1.5px solid #ECEDF0;background:#fff;font-weight:600;font-size:14px;cursor:pointer">Cancel</button>'
    +'<button id="rp-btn" onclick="if(this.disabled)return;this.disabled=true;this.textContent=\'Resetting…\';App._doResetPw(this.dataset.uid).finally(()=>{const b=document.getElementById(\'rp-btn\');if(b){b.disabled=false;b.textContent=\'Reset\';}})" data-uid="'+id+'" style="flex:1;padding:12px;border-radius:12px;background:#15171C;color:#fff;font-weight:600;font-size:14px;border:none;cursor:pointer">Reset</button>'
    +'</div></div>',
    'max-w-sm'
  );
};
App._doResetPw=async(uid)=>{
  if(!can('employees','resetPassword')){toast('You don’t have permission to reset passwords','err');return;}
  const pw=$('#rp-pw')?.value?.trim();
  if(!pw){toast('Enter a password','err');return;}
  const{error}=await sb.functions.invoke('reset-password',{body:{user_id:uid,password:pw}});
  if(error){toast(error.message,'err');return;}
  log(fullName(me()),'Reset password',fullName(uById(uid)));
  toast('Password reset');closeModal();
};
App.togUser=(id)=>{
  if(!can('employees','deactivate')){toast('You don’t have permission to enable/disable users','err');return;}
  const u=uById(id);if(!u)return;
  const enabling=u.status!=='Active';
  u.status=enabling?'Active':'Inactive';
  saveDB();render();
  toast(fullName(u)+' '+(enabling?'enabled ✓':'disabled'),enabling?'ok':'warn');
  sb.from('profiles').update({status:u.status}).eq('id',id).then(()=>{}).catch(e=>console.warn('togUser:',e));
};
App.delUser=async(id)=>{
  if(!can('employees','delete')){toast('You don’t have permission to delete users','err');return;}
  const u=uById(id);if(!u)return;
  const name=fullName(u);
  // ── Guard: a user who is still assigned to checklists must not be deleted. ──
  const _asgCls=(DB.checklists||[]).filter(c=>(c.assignees||[]).includes(id));
  if(_asgCls.length){
    const _names=_asgCls.slice(0,4).map(c=>'• '+(c.name||'Untitled')).join('\n')+(_asgCls.length>4?'\n• +'+(_asgCls.length-4)+' more':'');
    alert("Can't delete "+name+" — they're still assigned to "+_asgCls.length+' checklist'+(_asgCls.length>1?'s':'')+':\n'+_names+".\n\nUnassign them from those checklists first, or use Disable to keep their data.");
    return;
  }
  if(!confirm('Permanently delete '+name+'?\n\nThis will delete ALL their submissions and approvals. This cannot be undone.\n\nTo keep their data, use Disable instead.'))return;
  // Optimistic local cleanup first
  DB.users.filter(x=>x.managerId===id).forEach(x=>x.managerId=u.managerId);
  if(!DB.users_deleted)DB.users_deleted=[];
  if(!DB.users_deleted.includes(id))DB.users_deleted.push(id);
  DB.users=DB.users.filter(x=>x.id!==id);
  DB.checklists.forEach(c=>c.assignees=(c.assignees||[]).filter(a=>a!==id));
  DB.submissions=DB.submissions.filter(s=>s.userId!==id);
  DB.approvals=DB.approvals.filter(a=>a.requesterId!==id);
  DB.notifications=DB.notifications.filter(n=>n.userId!==id);
  DB.feedback=(DB.feedback||[]).filter(f=>f.userId!==id&&f.managerId!==id);
  // FIX: If ex-manager now has 0 direct reports, downgrade to User
  if(u.managerId){
    const exMgr=uById(u.managerId);
    if(exMgr&&exMgr.role==='Manager'){
      const stillHasTeam=DB.users.some(x=>x.managerId===exMgr.id);
      if(!stillHasTeam){
        exMgr.role='User';
        sb.from('profiles').update({role:'User'}).eq('id',exMgr.id).then(()=>{}).catch(()=>{});
        toast(fullName(exMgr)+' has no team — role changed to User','warn');
      }
    }
  }
  log(fullName(me()),'Deleted user',name);
  toast(name+' deleted','warn');
  render();saveDB();
  // Background Supabase deletion of all related data
  Promise.all([
    sb.from('submissions').delete().eq('user_id',id),
    sb.from('approvals').delete().eq('requester_id',id),
    sb.from('notifications').delete().eq('user_id',id),
    sb.from('feedback').delete().eq('user_id',id),
    sb.from('profiles').delete().eq('id',id),
  ]).then(()=>{}).catch(e=>console.warn('delUser cleanup:',e));
};

