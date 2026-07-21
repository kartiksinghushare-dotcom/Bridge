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

/* ── Role display comes from ACCESS CONTROL (role profiles) — the single role system. ── */
function _uRoleChip(u){
  const id=u&&u.hrm&&u.hrm.roleProfileId;
  const rp=id?(DB.roleProfiles||{})[id]:null;
  if(!rp)return'<span class="text-xs text-ink-300">No role</span>';
  const st=id==='superadmin'?'background:#13171B;color:#fff'
    :id==='admin'?'background:#EEF2FF;color:#4338CA'
    :id==='manager'?'background:#E0F2FE;color:#0369A1'
    :id==='basic'?'background:#F3F4F6;color:#4B5563'
    :'background:#F5F3FF;color:#6D28D9';
  return`<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;white-space:nowrap;${st}">${esc(rp.name)}</span>`;
}
const _uIsSuperAdmin=u=>!!u&&(u.hrm?.roleProfileId==='superadmin'||u.role==='Admin');
/* ── Bulk selection state (lives in S.filters so it clears when leaving the tab) ── */
let _U_LIST=[];
const _uSel=()=>{if(!Array.isArray(S.filters.uSel))S.filters.uSel=[];return S.filters.uSel;};
App._uSelTog=(id)=>{const s=_uSel();const i=s.indexOf(id);if(i>-1)s.splice(i,1);else s.push(id);rr();};
App._uSelAll=()=>{const s=_uSel();const all=_U_LIST.length&&_U_LIST.every(id=>s.includes(id));S.filters.uSel=all?[]:_U_LIST.slice();rr();};
App._uSelClear=()=>{S.filters.uSel=[];rr();};

function usersPage(){
  let list=visU();const q=S.search.toLowerCase();
  if(q)list=list.filter(u=>fullName(u).toLowerCase().includes(q)||u.email.toLowerCase().includes(q));
  if(S.filters.dep)list=list.filter(u=>u.department===S.filters.dep);
  if(S.filters.stat)list=list.filter(u=>u.status===S.filters.stat);
  const canBulk=can('employees','edit');
  _U_LIST=list.map(u=>u.id);
  S.filters.uSel=_uSel().filter(id=>_U_LIST.includes(id)); // drop selections hidden by filters
  const sel=S.filters.uSel;
  const allSel=list.length>0&&sel.length===list.length;
  const cbx=(checked,onclick,title)=>`<input type="checkbox" ${checked?'checked':''} onclick="event.stopPropagation();${onclick}" ${title?`title="${title}"`:''} style="width:16px;height:16px;accent-color:#13171B;cursor:pointer;vertical-align:middle"/>`;
  const bulkBar=canBulk&&sel.length?`<div class="ui-card" style="display:flex;align-items:center;gap:10px;padding:10px 14px;margin-bottom:12px;flex-wrap:wrap;border:1.5px solid #13171B">
      <span style="font-size:13px;font-weight:800;color:var(--c-text)">${sel.length} selected</span>
      <span style="font-size:11.5px;color:var(--c-text-3)">of ${list.length} shown — pick the fields to change once, they apply to everyone selected</span>
      <span style="flex:1"></span>
      ${btnP('Bulk edit','App._bulkEditUsers()','edit')}
      <button onclick="App._uSelClear()" class="ui-btn ui-btn-ghost ui-btn-sm">Clear</button>
    </div>`:'';
  const headActions=[
    can('employees','view')?btn('Download','App._usersExport()',{variant:'ghost',icon:'download'}):'',
    can('employees','create')?btn('Bulk upload','App._usersImport()',{variant:'ghost',icon:'upload'}):'',
    can('employees','create')?btnP('Add user','App.editUser()','plus'):''
  ].join('');
  return`<div class="fade">${hdr('Users',visU().length+' people',headActions)}
  <div class="flex gap-2 mb-4 flex-wrap">
    <div class="relative flex-1 min-w-[160px]"><span class="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300">${ic('search','w-4 h-4')}</span><input id="u-search" oninput="S.search=this.value;App._searchRR('u-search')" value="${esc(S.search)}" placeholder="Search by name or email…" class="w-full bg-white border border-ink-200 rounded-xl pl-9 pr-3 py-2.5 text-sm rf"/></div>
    <select onchange="S.filters.dep=this.value;rr()" class="bg-white border border-ink-200 rounded-xl px-3 py-2.5 text-sm rf"><option value="">All depts</option>${topDepts().map(d=>`<option ${S.filters.dep===d.name?'selected':''}>${esc(d.name)}</option>`).join('')}</select>
    <select onchange="S.filters.stat=this.value;rr()" class="bg-white border border-ink-200 rounded-xl px-3 py-2.5 text-sm rf"><option value="">Any status</option><option ${S.filters.stat==='Active'?'selected':''}>Active</option><option ${S.filters.stat==='Inactive'?'selected':''}>Inactive</option></select>
  </div>
  ${bulkBar}
  <div class="hidden md:block bg-white rounded-2xl border border-ink-100 shadow-soft overflow-hidden">
    <table class="w-full text-sm"><thead><tr class="text-[10px] text-ink-400 uppercase tracking-wide border-b border-ink-100 text-left">${canBulk?`<th class="px-4 py-3" style="width:34px">${cbx(allSel,'App._uSelAll()','Select all shown')}</th>`:''}<th class="px-5 py-3 font-semibold">Name</th><th class="px-5 py-3 font-semibold">Department</th><th class="px-5 py-3 font-semibold">Role</th><th class="px-5 py-3 font-semibold">Reports to</th><th class="px-5 py-3 font-semibold">Status</th><th class="px-5 py-3"></th></tr></thead>
    <tbody class="divide-y divide-ink-50">${list.map(u=>{const mgr=u.managerId?uById(u.managerId):null;const on=sel.includes(u.id);return`<tr class="hover:bg-ink-50/50"${on?' style="background:#F5F8FF"':''}>${canBulk?`<td class="px-4 py-3">${cbx(on,`App._uSelTog('${u.id}')`)}</td>`:''}<td class="px-5 py-3"><div class="flex items-center gap-3">${avatar(u,'w-9 h-9','text-xs')}<div><div class="font-semibold">${esc(fullName(u))}</div><div class="text-xs text-ink-400">${esc(u.email)}</div></div></div></td><td class="px-5 py-3">${esc(u.department)}<div class="text-xs text-ink-400">${esc(u.position)}</div></td><td class="px-5 py-3">${_uRoleChip(u)}</td><td class="px-5 py-3 text-sm">${mgr?esc(fullName(mgr)):'<span class="text-ink-300">—</span>'}</td><td class="px-5 py-3">${chip(u.status)}</td><td class="px-5 py-3"><div class="flex gap-1 justify-end">${(can('employees','edit')||can('employees','resetPassword')||can('employees','deactivate')||can('employees','delete'))?`${can('employees','edit')?`<button onclick="App.editUser('${u.id}')" style="width:32px;height:32px;display:grid;place-items:center;border-radius:8px;color:#9CA3AF;background:transparent;border:none;cursor:pointer" onmouseover="this.style.background='#F3F4F6'" onmouseout="this.style.background='transparent'">${ic('edit','w-4 h-4')}</button>`:''}${can('employees','resetPassword')?`<button onclick="App.resetPw('${u.id}')" style="width:32px;height:32px;display:grid;place-items:center;border-radius:8px;color:#9CA3AF;background:transparent;border:none;cursor:pointer" onmouseover="this.style.background='#F3F4F6'" onmouseout="this.style.background='transparent'" title="Reset password">${ic('key','w-4 h-4')}</button>`:''}${can('employees','deactivate')?_disableBtn(u):''}${(!_uIsSuperAdmin(u)&&can('employees','delete'))?`<button onclick="App.delUser('${u.id}')" style="width:32px;height:32px;display:grid;place-items:center;border-radius:8px;color:#9CA3AF;background:transparent;border:none;cursor:pointer" onmouseover="this.style.background='#FFF1F2';this.style.color='#BE123C'" onmouseout="this.style.background='transparent';this.style.color='#9CA3AF'">${ic('trash','w-4 h-4')}</button>`:''}`:'<span class="text-ink-200">—</span>'}</div></td></tr>`;}).join('')}</tbody></table>
    ${list.length?'':empty('users','No users','')}
  </div>
  <div class="md:hidden space-y-2">${list.map(u=>{const mgr=u.managerId?uById(u.managerId):null;const on=sel.includes(u.id);return`<div class="bg-white rounded-2xl border border-ink-100 shadow-soft p-4" style="${can('employees','edit')?'cursor:pointer;':''}${on?'border-color:#13171B':''}"${can('employees','edit')?` onclick="App.editUser('${u.id}')"`:''}>
    <div class="flex items-center gap-3">${canBulk?`<span onclick="event.stopPropagation()">${cbx(on,`App._uSelTog('${u.id}')`)}</span>`:''}${avatar(u,'w-10 h-10','text-sm')}<div class="min-w-0 flex-1"><div class="font-semibold truncate">${esc(fullName(u))}</div><div class="text-xs text-ink-400">${esc(u.position)} · ${esc(u.department)}</div><div style="margin-top:3px">${_uRoleChip(u)}</div></div>${chip(u.status)}</div>
    ${mgr?`<div class="text-xs text-ink-400 mt-2.5 pt-2.5 border-t border-ink-50">Reports to <strong>${esc(fullName(mgr))}</strong></div>`:''}</div>`;}).join('')}</div>
</div>`;}

/* ═══ BULK EDIT — change any mix of fields for every selected user at once ═══ */
App._bulkEditUsers=()=>{
  if(!can('employees','edit'))return toast('You don\'t have permission to edit users','err');
  const sel=_uSel();
  if(!sel.length)return toast('Select at least one user first','err');
  try{_seedRoleProfiles();}catch(e){}
  const users=sel.map(uById).filter(Boolean);
  const canRole=can('accessControl','manage');
  const roles=Object.values(DB.roleProfiles||{}).sort((a,b)=>(b.builtin?1:0)-(a.builtin?1:0)||String(a.name).localeCompare(String(b.name)));
  const mgrOpts=DB.users.filter(x=>x.status==='Active'&&!sel.includes(x.id));
  const L='font-size:10px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em';
  const row=(k,label,control,hint)=>`<div style="display:grid;grid-template-columns:24px 1fr;gap:10px;padding:12px 0;border-top:1px solid var(--c-border);align-items:start">
      <input type="checkbox" id="bu-on-${k}" onchange="const c=document.getElementById('bu-c-${k}');if(c){c.style.opacity=this.checked?'1':'.45';c.style.pointerEvents=this.checked?'auto':'none'}" style="width:16px;height:16px;accent-color:#13171B;cursor:pointer;margin-top:2px"/>
      <div><label for="bu-on-${k}" style="${L};cursor:pointer">${label}</label>
        <div id="bu-c-${k}" style="margin-top:6px;opacity:.45;pointer-events:none">${control}</div>
        ${hint?`<div style="font-size:11px;color:var(--c-text-3);margin-top:5px;line-height:1.45">${hint}</div>`:''}
      </div>
    </div>`;
  const chips=users.slice(0,8).map(u=>`<span style="display:inline-flex;align-items:center;gap:5px;background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:20px;padding:2px 9px 2px 3px;font-size:11.5px;font-weight:700">${avatar(u,'w-4 h-4','text-[7px]')}${esc(fullName(u))}</span>`).join(' ')
    +(users.length>8?` <span style="font-size:11.5px;color:var(--c-text-3)">+${users.length-8} more</span>`:'');
  modalShell({title:'Bulk edit — '+users.length+' user'+(users.length===1?'':'s'),sub:'Tick a field to change it. Unticked fields stay exactly as they are for everyone.',size:'max-w-lg',key:'u-bulk',
    body:`<div>
      <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:6px">${chips}</div>
      ${row('dep','Department',`<select id="bu-dep" class="ui-select rf">${topDepts().map(d=>`<option value="${esc(d.name)}">${esc(d.name)}</option>`).join('')}</select>`)}
      ${row('pos','Position',`<input id="bu-pos" class="ui-input rf" placeholder="e.g. Sales Executive"/>`)}
      ${row('mgr','Reports to',`<select id="bu-mgr" class="ui-select rf"><option value="">— None —</option>${mgrOpts.map(m=>`<option value="${m.id}">${esc(fullName(m))}</option>`).join('')}</select>`,'Anyone whose change would create a circular hierarchy is skipped and reported.')}
      ${row('status','Status',`<select id="bu-status" class="ui-select rf"><option>Active</option><option>Inactive</option></select>`)}
      ${row('email','Email notifications',`<select id="bu-email" class="ui-select rf"><option value="on">On — receive email notifications</option><option value="off">Off — no email notifications</option></select>`)}
      ${canRole?row('role','Role (Access Control)',`<select id="bu-role" class="ui-select rf">${roles.map(r=>`<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('')}</select>`,'Same safety as Access Control: the last person holding Access Control can never lose it — they\'re skipped and reported.'):''}
    </div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP('Apply to '+users.length+' user'+(users.length===1?'':'s'),'App._bulkApplyUsers()')});
};
App._bulkApplyUsers=()=>{
  if(!can('employees','edit'))return toast('You don\'t have permission to edit users','err');
  const ids=_uSel().slice();
  if(!ids.length)return toast('Nothing selected','err');
  const on=k=>!!document.getElementById('bu-on-'+k)?.checked;
  const val=k=>{const el=document.getElementById('bu-'+k);return el?el.value:'';};
  const F={};
  if(on('dep'))F.department=val('dep');
  if(on('pos'))F.position=val('pos').trim();
  if(on('status'))F.status=val('status');
  if(on('mgr'))F.managerId=val('mgr')||null;
  if(on('email'))F.emailEnabled=val('email')==='on';
  const roleId=(on('role')&&can('accessControl','manage'))?val('role'):null;
  if(!Object.keys(F).length&&!roleId)return toast('Tick at least one field to change','err');
  const chDate=todayISO();
  let ok=0;const skipped=[];
  ids.forEach(id=>{
    const u=uById(id);if(!u)return;
    const pd={};
    if('department' in F){u.department=F.department;pd.department=F.department;}
    if('position' in F){u.position=F.position;pd.position=F.position;}
    if('status' in F){u.status=F.status;pd.status=F.status;}
    if('emailEnabled' in F){u.emailEnabled=F.emailEnabled;pd.email_enabled=F.emailEnabled;}
    if('managerId' in F){
      if(F.managerId&&(F.managerId===id||isDesc(F.managerId,id))){skipped.push(fullName(u)+' — manager unchanged (circular hierarchy)');}
      else if((u.managerId||null)!==(F.managerId||null)){
        // Same history rule as the single editor: dates before the change belong to the old manager
        let h=Array.isArray(u.managerHistory)?JSON.parse(JSON.stringify(u.managerHistory)):[];
        if(!h.length)h.push({managerId:u.managerId||null,from:'0001-01-01',to:chDate});
        else{const open=h.find(p=>!p.to);if(open)open.to=chDate;}
        h.push({managerId:F.managerId,from:chDate,to:null});
        u.managerHistory=h;pd.manager_history=h;
        u.managerId=F.managerId;pd.manager_id=F.managerId;
      }
    }
    if(roleId&&DB.roleProfiles[roleId]){
      _ensureHrm(u);
      let blocked=false;
      const newGrants=a=>!!(DB.roleProfiles[roleId].perms?.accessControl?.actions?.[a])||!!(u.hrm.perms?.accessControl?.actions?.[a]);
      for(const act of ['view','manage']){
        if(canUser(u,'accessControl',act)&&!newGrants(act)&&!_acLockoutSafe(u.id,act)){blocked=true;break;}
      }
      if(blocked)skipped.push(fullName(u)+' — role unchanged (last Access Control holder)');
      else if(u.hrm.roleProfileId!==roleId){
        u.hrm.roleProfileId=roleId;u.hrm.permsV3=1;
        u.hrm.isHR=(roleId==='hr');
        const baseRole=roleId==='superadmin'?'Admin':roleId==='admin'?'SubAdmin':'User';
        u.role=baseRole;pd.role=baseRole;
        pd.hrm=u.hrm;
      }
    }
    if(Object.keys(pd).length){
      ok++;
      sbWrite({table:'profiles',op:'update',values:pd,match:{col:'id',val:id},id:id},{label:'Bulk user update'});
    }
  });
  const fieldNames=[];
  if('department' in F)fieldNames.push('department');if('position' in F)fieldNames.push('position');
  if('managerId' in F)fieldNames.push('manager');if('status' in F)fieldNames.push('status');
  if('emailEnabled' in F)fieldNames.push('email notifications');if(roleId)fieldNames.push('role');
  log(fullName(me()),'Bulk edited users',ok+' user'+(ok===1?'':'s')+' · '+fieldNames.join(', '));
  S.filters.uSel=[];
  saveDB();closeModal();rr();
  toast(ok+' user'+(ok===1?'':'s')+' updated ✓'+(skipped.length?' · '+skipped.length+' skipped':''));
  if(skipped.length)setTimeout(()=>toast(skipped.slice(0,2).join(' · ')+(skipped.length>2?' · +'+(skipped.length-2)+' more':''),'warn'),1100);
};
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
  <div class="flex gap-2 mt-5"><button onclick="App.closeModal()" style="flex:1;padding:12px;border-radius:12px;border:1.5px solid #ECEDF0;background:#fff;font-weight:600;font-size:14px;cursor:pointer">Cancel</button><button id="save-user-btn" onclick="if(this.disabled)return;this.disabled=true;this.textContent=this.textContent==='Save'?'Saving…':'Creating…';App.saveUser('${id||''}').catch(()=>{}).finally(()=>{const b=document.getElementById('save-user-btn');if(b){b.disabled=false;b.textContent='${u?'Save':'Create'}';}})" style="flex:1;padding:12px;border-radius:12px;background:#13171B;color:#fff;font-weight:600;font-size:14px;border:none;cursor:pointer">${u?'Save':'Create'}</button></div>
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
    +'<button id="rp-btn" onclick="if(this.disabled)return;this.disabled=true;this.textContent=\'Resetting…\';App._doResetPw(this.dataset.uid).finally(()=>{const b=document.getElementById(\'rp-btn\');if(b){b.disabled=false;b.textContent=\'Reset\';}})" data-uid="'+id+'" style="flex:1;padding:12px;border-radius:12px;background:#13171B;color:#fff;font-weight:600;font-size:14px;border:none;cursor:pointer">Reset</button>'
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

/* ═══════════════════════════════════════════════════════════════
   v3.11 — USERS IMPORT / EXPORT
   · Download users  → .xlsx of everyone you can see
   · Download template → .xlsx with a Users sheet + Help sheet
   · Bulk upload → parse .xlsx/.csv → validate → preview → create
     via the create-user edge function (real login accounts).
   Passwords: use the file's Password column; blank = auto-generated
   and shown in the results (downloadable credentials sheet).
   ═══════════════════════════════════════════════════════════════ */
let _UIMP=null;
function _loadXLSX(){
  return new Promise((res,rej)=>{
    if(window.XLSX)return res(window.XLSX);
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload=()=>window.XLSX?res(window.XLSX):rej(new Error('Spreadsheet library failed to load'));
    s.onerror=()=>rej(new Error('Couldn\'t load the spreadsheet library — check your connection'));
    document.head.appendChild(s);
  });
}
const _U_TPL_HEADERS=['First name*','Last name*','Email*','Password','Phone','Position','Department','Reports to (email)','Status (Active/Inactive)','Role','Email notifications (On/Off)'];
App._usersTemplate=async()=>{
  try{
    const X=await _loadXLSX();
    const wb=X.utils.book_new();
    const ws=X.utils.aoa_to_sheet([_U_TPL_HEADERS,['Aisha','Khan','aisha@company.com','','+971 50 000 0000','Sales Executive',(topDepts()[0]||{}).name||'','','Active','Basic Employee','On']]);
    ws['!cols']=_U_TPL_HEADERS.map(h=>({wch:Math.max(16,h.length+2)}));
    X.utils.book_append_sheet(wb,ws,'Users');
    const roles=Object.values(DB.roleProfiles||{}).map(r=>r.name);
    const help=[['How to fill this template'],[''],
      ['• Required: First name, Last name, Email. Everything else is optional.'],
      ['• Password: leave blank to auto-generate a secure one (shown to you right after the import). Minimum 6 characters if you set one.'],
      ['• Department must match an existing department exactly:'],
      ...topDepts().map(d=>['     - '+d.name]),
      ['• Role must match an Access Control role (leave blank for the default):'],
      ...roles.map(r=>['     - '+r]),
      ['• Reports to: the manager\'s email — an existing user, or a user on an EARLIER row of this same file.'],
      ['• Status: Active or Inactive (blank = Active). Email notifications: On or Off (blank = On).'],
      ['• Rows with errors (missing name/email, duplicate or existing email…) are skipped and reported — the rest import fine.']];
    X.utils.book_append_sheet(wb,X.utils.aoa_to_sheet(help),'Help');
    X.writeFile(wb,'bridge_users_template.xlsx');
    toast('Template downloaded');
  }catch(e){toast(e.message,'err');}
};
App._usersExport=async()=>{
  if(!can('employees','view'))return toast('You don\'t have permission to view users','err');
  try{
    const X=await _loadXLSX();
    const rows=[['First name','Last name','Email','Phone','Position','Department','Reports to','Status','Role','Email notifications']];
    visU().filter(Boolean).forEach(u=>{
      const mgr=u.managerId?uById(u.managerId):null;
      const rp=(DB.roleProfiles||{})[u.hrm?.roleProfileId];
      rows.push([u.firstName||'',u.lastName||'',u.email||'',u.phone||'',u.position||'',u.department||'',mgr?(mgr.email||fullName(mgr)):'',u.status||'',rp?rp.name:'',u.emailEnabled===false?'Off':'On']);
    });
    const wb=X.utils.book_new();
    const ws=X.utils.aoa_to_sheet(rows);
    ws['!cols']=rows[0].map(()=>({wch:20}));
    X.utils.book_append_sheet(wb,ws,'Users');
    X.writeFile(wb,'bridge_users_'+todayISO()+'.xlsx');
    log(fullName(me()),'Downloaded users',(rows.length-1)+' users');
    toast('Downloaded '+(rows.length-1)+' user'+(rows.length===2?'':'s'));
  }catch(e){toast(e.message,'err');}
};
App._usersImport=()=>{
  if(!can('employees','create'))return toast('You don\'t have permission to create users','err');
  _UIMP=null;
  modalShell({title:'Bulk upload users',sub:'Upload the filled template — every row becomes a real login account',size:'max-w-2xl',key:'u-imp',
    body:`<div id="uimp-body">${_uImpPickHTML()}</div>`});
};
function _uImpPickHTML(){
  return `<div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;align-items:center">
      ${btn('Download template','App._usersTemplate()',{variant:'ghost',icon:'download'})}
      <span style="font-size:11.5px;color:var(--c-text-3)">Fill it in Excel, then drop it below (.xlsx or .csv)</span>
    </div>
    <div onclick="document.getElementById('uimp-file').click()" ondragover="event.preventDefault();this.style.borderColor='#8B6B41'" ondragleave="this.style.borderColor='var(--c-border-2)'" ondrop="event.preventDefault();this.style.borderColor='var(--c-border-2)';App._uImpFile({files:event.dataTransfer.files})" style="border:2px dashed var(--c-border-2);border-radius:16px;padding:34px;text-align:center;cursor:pointer;transition:border-color .15s">
      <div style="font-size:30px;margin-bottom:8px">📄</div>
      <div style="font-size:14px;font-weight:700;color:var(--c-text)">Click to browse or drag &amp; drop</div>
      <div style="font-size:12px;color:var(--c-text-3);margin-top:4px">.xlsx or .csv — same columns as the template</div>
      <input type="file" id="uimp-file" accept=".xlsx,.xls,.csv" hidden onchange="App._uImpFile(this)"/>
    </div>
  </div>`;
}
App._uImpFile=async(input)=>{
  const f=(input.files||[])[0];if(!f)return;
  const body=document.getElementById('uimp-body');
  if(body)body.innerHTML='<div style="padding:30px;text-align:center;color:var(--c-text-3);font-size:13px">Reading '+esc(f.name)+'…</div>';
  try{
    const X=await _loadXLSX();
    const buf=await f.arrayBuffer();
    const wb=X.read(buf,{type:'array'});
    const ws=wb.Sheets[wb.SheetNames.includes('Users')?'Users':wb.SheetNames[0]];
    const aoa=X.utils.sheet_to_json(ws,{header:1,raw:false,defval:''});
    _uImpParse(aoa);
  }catch(e){
    toast('Couldn\'t read the file: '+(e.message||e),'err');
    if(body)body.innerHTML=_uImpPickHTML();
  }
};
function _uImpNorm(h){return String(h||'').toLowerCase().replace(/\(.*?\)/g,'').replace(/[^a-z]/g,'');}
function _uImpGenPw(){const A='abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';let p='';for(let i=0;i<10;i++)p+=A[Math.floor(Math.random()*A.length)];return p;}
function _uImpParse(aoa){
  const body=document.getElementById('uimp-body');
  const rows=(aoa||[]).filter(r=>Array.isArray(r)&&r.some(c=>String(c||'').trim()!==''));
  if(rows.length<2){toast('The file has no data rows','err');if(body)body.innerHTML=_uImpPickHTML();return;}
  const H=rows[0].map(_uImpNorm);
  const col={};
  [['firstname','fn'],['lastname','ln'],['email','email'],['password','pw'],['phone','phone'],['position','pos'],['department','dep'],['reportsto','mgr'],['status','status'],['role','role'],['emailnotifications','notif']].forEach(([k,key])=>{col[key]=H.findIndex(h=>h===k||h.indexOf(k)===0);});
  if(col.fn<0||col.ln<0||col.email<0){toast('Missing required columns — keep the template\'s First name, Last name and Email headers','err');if(body)body.innerHTML=_uImpPickHTML();return;}
  const seen=new Set();
  const canRole=can('accessControl','manage');
  let roleWarned=false;
  const parsed=rows.slice(1).map((r,i)=>{
    const g=k=>col[k]>=0?String(r[col[k]]||'').trim():'';
    const row={line:i+2,fn:g('fn'),ln:g('ln'),email:g('email').toLowerCase(),pw:g('pw'),phone:g('phone'),pos:g('pos'),dep:g('dep'),mgr:g('mgr').toLowerCase(),status:g('status'),role:g('role'),notif:g('notif'),roleId:null,errs:[],warns:[]};
    if(!row.fn||!row.ln)row.errs.push('name missing');
    if(!row.email)row.errs.push('email missing');
    else if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(row.email))row.errs.push('invalid email');
    else if(seen.has(row.email))row.errs.push('duplicate row in file');
    else if((DB.users||[]).some(u=>String(u.email||'').toLowerCase()===row.email))row.errs.push('user already exists');
    if(row.email)seen.add(row.email);
    if(row.pw&&row.pw.length<6)row.errs.push('password under 6 characters');
    if(row.dep){
      const d=topDepts().find(x=>String(x.name).toLowerCase()===row.dep.toLowerCase());
      if(d)row.dep=d.name;else{row.warns.push('unknown department “'+row.dep+'” — left empty');row.dep='';}
    }
    row.status=/^inactive$/i.test(row.status)?'Inactive':'Active';
    row.emailEnabled=!/^(off|no|false|0)$/i.test(row.notif||'');
    if(row.role){
      const rp=Object.values(DB.roleProfiles||{}).find(x=>String(x.name).toLowerCase()===row.role.toLowerCase());
      if(!rp)row.warns.push('unknown role “'+row.role+'” — default applies');
      else if(!canRole){if(!roleWarned){roleWarned=true;}row.warns.push('no permission to assign roles — ignored');}
      else row.roleId=rp.id;
    }
    row.genPw=!row.pw;
    if(!row.pw)row.pw=_uImpGenPw();
    return row;
  });
  _UIMP={rows:parsed};
  _uImpPreview();
}
function _uImpPreview(){
  const body=document.getElementById('uimp-body');if(!body||!_UIMP)return;
  const rows=_UIMP.rows;
  const ok=rows.filter(r=>!r.errs.length);
  const bad=rows.filter(r=>r.errs.length);
  const wn=rows.filter(r=>!r.errs.length&&r.warns.length);
  const chip=(n,label,bg,fg)=>`<span style="font-size:12px;font-weight:800;background:${bg};color:${fg};padding:3px 11px;border-radius:20px">${n} ${label}</span>`;
  const tr=r=>`<tr style="${r.errs.length?'background:#FFF1F2;':''}border-top:1px solid var(--c-border)">
      <td style="padding:6px 8px;color:var(--c-text-3)">${r.line}</td>
      <td style="padding:6px 8px;font-weight:700;white-space:nowrap">${esc(r.fn)} ${esc(r.ln)}</td>
      <td style="padding:6px 8px">${esc(r.email)}</td>
      <td style="padding:6px 8px">${esc(r.dep||'—')}</td>
      <td style="padding:6px 8px">${esc(r.roleId?((DB.roleProfiles[r.roleId]||{}).name||''):(r.role?r.role+' ⚠':'—'))}</td>
      <td style="padding:6px 8px;color:var(--c-text-3)">${r.genPw?'auto':'from file'}</td>
      <td style="padding:6px 8px;font-size:11px;color:${r.errs.length?'#BE123C':'#B45309'}">${esc([...r.errs,...r.warns].join(' · '))||'✓'}</td>
    </tr>`;
  body.innerHTML=`<div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px">
      ${chip(ok.length,'ready','#E6F2EA','#1E7A50')}
      ${bad.length?chip(bad.length,'skipped (errors)','#FFF1F2','#BE123C'):''}
      ${wn.length?chip(wn.length,'with warnings','#FEF7E6','#B36A00'):''}
      <span style="flex:1"></span>
      <button onclick="document.getElementById('uimp-body').innerHTML=(_uImpPickHTML());_UIMP=null" class="ui-btn ui-btn-ghost ui-btn-sm">Pick another file</button>
    </div>
    <div style="max-height:300px;overflow:auto;border:1px solid var(--c-border);border-radius:12px">
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <thead><tr style="text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--c-text-3)">
          <th style="padding:8px">Row</th><th style="padding:8px">Name</th><th style="padding:8px">Email</th><th style="padding:8px">Department</th><th style="padding:8px">Role</th><th style="padding:8px">Password</th><th style="padding:8px">Issues</th>
        </tr></thead>
        <tbody>${rows.map(tr).join('')}</tbody>
      </table>
    </div>
    <div style="font-size:11.5px;color:var(--c-text-3);margin-top:8px">Auto-generated passwords are shown after the import, with a downloadable credentials sheet.</div>
    <div style="display:flex;gap:10px;margin-top:14px;justify-content:flex-end">
      ${btnG('Cancel','App.closeModal()')}
      ${ok.length?btnP('Create '+ok.length+' user'+(ok.length===1?'':'s'),'App._uImpRun()'):''}
    </div>
  </div>`;
}
App._uImpRun=async()=>{
  if(!can('employees','create'))return toast('You don\'t have permission to create users','err');
  const rows=((_UIMP&&_UIMP.rows)||[]).filter(r=>!r.errs.length);
  if(!rows.length)return;
  const body=document.getElementById('uimp-body');if(!body)return;
  body.innerHTML=`<div style="padding:10px 0">
    <div style="font-size:13.5px;font-weight:800;color:var(--c-text);margin-bottom:10px">Creating ${rows.length} user${rows.length===1?'':'s'}…</div>
    <div style="height:7px;background:var(--c-surface-2);border-radius:4px;overflow:hidden;margin-bottom:12px"><div id="uimp-bar" style="height:100%;width:0%;background:#8B6B41;border-radius:4px;transition:width .25s"></div></div>
    <div id="uimp-live" style="max-height:260px;overflow-y:auto;font-size:12px;color:var(--c-text-2)"></div>
    <div style="font-size:11px;color:var(--c-text-3);margin-top:10px">Keep this window open — each row creates a real login account.</div>
  </div>`;
  const bar=()=>document.getElementById('uimp-bar');
  const live=()=>document.getElementById('uimp-live');
  const results=[];
  const emailToId={};(DB.users||[]).forEach(u=>{if(u.email)emailToId[String(u.email).toLowerCase()]=u.id;});
  const canRole=can('accessControl','manage');
  let done=0;
  for(const r of rows){
    // Manager: an existing user, or one created earlier in this same import
    let mgrId=null;
    if(r.mgr){
      mgrId=emailToId[r.mgr]||null;
      if(!mgrId){const mu=(DB.users||[]).find(u=>fullName(u).toLowerCase()===r.mgr);mgrId=mu?mu.id:null;}
      if(!mgrId)r.warns.push('manager “'+r.mgr+'” not found — none set');
    }
    const baseRole=r.roleId==='superadmin'?'Admin':r.roleId==='admin'?'SubAdmin':'User';
    const pd={first_name:r.fn,last_name:r.ln,email:r.email,phone:r.phone,position:r.pos,department:r.dep,role:baseRole,status:r.status,manager_id:mgrId,rules:{past:true,future:true,edit:true},approval_settings:{past:false,future:false,edited:false},doc_access:{departments:{},locations:{}},questions_access:false,email_enabled:r.emailEnabled,password:r.pw};
    try{
      const{data:res,error}=await sb.functions.invoke('create-user',{body:pd});
      if(error||res?.error){
        let msg=error?.message||res?.error||'Failed';
        try{if(error?.context){const b=await error.context.json();msg=b.error||msg;}}catch(e){}
        results.push({r:r,ok:false,msg:msg});
      }else{
        const newId=res?.id||res?.user?.id;
        if(!newId){results.push({r:r,ok:false,msg:'created, but no id returned — reload to see them'});}
        else{
          emailToId[r.email]=newId;
          const nu={id:newId,firstName:r.fn,lastName:r.ln,email:r.email,phone:r.phone,position:r.pos,department:r.dep,role:baseRole,status:r.status,managerId:mgrId,rules:pd.rules,approval:pd.approval_settings,questionsAccess:false,emailEnabled:r.emailEnabled,docAccess:pd.doc_access,cities:[],hrm:null,password:'***'};
          DB.users.push(nu);
          try{
            _ensureHrm(nu);
            if(canRole&&r.roleId&&DB.roleProfiles[r.roleId]){nu.hrm.roleProfileId=r.roleId;nu.hrm.permsV3=1;nu.hrm.isHR=false;}
            else{_permsV3Migrate();}
          }catch(e){}
          sb.from('profiles').update({doc_access:pd.doc_access,questions_access:false,email_enabled:r.emailEnabled,hrm:nu.hrm||null}).eq('id',newId).then(()=>{}).catch(()=>{});
          results.push({r:r,ok:true});
        }
      }
    }catch(e){results.push({r:r,ok:false,msg:e.message||'Failed'});}
    done++;
    const b=bar();if(b)b.style.width=Math.round(done/rows.length*100)+'%';
    const lv=live();if(lv){const last=results[results.length-1];lv.innerHTML+='<div style="padding:2px 0">'+(last.ok?'✅':'❌')+' '+esc(r.fn+' '+r.ln)+' — '+(last.ok?'created':esc(last.msg))+'</div>';lv.scrollTop=lv.scrollHeight;}
  }
  log(fullName(me()),'Bulk uploaded users',results.filter(x=>x.ok).length+' created of '+results.length);
  saveDB();rr();
  window._UIMP_RESULTS=results;
  _uImpResults(results);
};
function _uImpResults(results){
  const body=document.getElementById('uimp-body');if(!body)return;
  const okR=results.filter(x=>x.ok),bad=results.filter(x=>!x.ok);
  const tr=x=>`<tr style="${x.ok?'':'background:#FFF1F2;'}border-top:1px solid var(--c-border)">
      <td style="padding:6px 8px">${x.ok?'✅':'❌'}</td>
      <td style="padding:6px 8px;font-weight:700;white-space:nowrap">${esc(x.r.fn)} ${esc(x.r.ln)}</td>
      <td style="padding:6px 8px">${esc(x.r.email)}</td>
      <td style="padding:6px 8px;font-family:monospace">${x.ok?esc(x.r.pw):'—'}</td>
      <td style="padding:6px 8px;font-size:11px;color:${x.ok?'var(--c-text-3)':'#BE123C'}">${x.ok?(x.r.genPw?'auto-generated':'from file')+(x.r.warns.length?' · '+esc(x.r.warns.join(' · ')):''):esc(x.msg||'failed')}</td>
    </tr>`;
  body.innerHTML=`<div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px">
      <span style="font-size:12px;font-weight:800;background:#E6F2EA;color:#1E7A50;padding:3px 11px;border-radius:20px">${okR.length} created</span>
      ${bad.length?`<span style="font-size:12px;font-weight:800;background:#FFF1F2;color:#BE123C;padding:3px 11px;border-radius:20px">${bad.length} failed</span>`:''}
    </div>
    ${okR.length?`<div style="font-size:12px;color:#B36A00;background:#FEF7E6;border:1px solid #FDE68A;border-radius:10px;padding:9px 12px;margin-bottom:10px">🔑 Passwords are shown below <b>only this once</b> — download the credentials sheet before closing.</div>`:''}
    <div style="max-height:300px;overflow:auto;border:1px solid var(--c-border);border-radius:12px">
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <thead><tr style="text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--c-text-3)">
          <th style="padding:8px"></th><th style="padding:8px">Name</th><th style="padding:8px">Email</th><th style="padding:8px">Password</th><th style="padding:8px">Notes</th>
        </tr></thead>
        <tbody>${results.map(tr).join('')}</tbody>
      </table>
    </div>
    <div style="display:flex;gap:10px;margin-top:14px;justify-content:flex-end">
      ${okR.length?btn('Download credentials (.xlsx)','App._uImpDownloadCreds()',{variant:'ghost',icon:'download'}):''}
      ${btnP('Done','App.closeModal()')}
    </div>
  </div>`;
}
App._uImpDownloadCreds=async()=>{
  const results=(window._UIMP_RESULTS||[]).filter(x=>x.ok);
  if(!results.length)return toast('Nothing to download','warn');
  try{
    const X=await _loadXLSX();
    const rows=[['First name','Last name','Email','Password','Status','Department']];
    results.forEach(x=>rows.push([x.r.fn,x.r.ln,x.r.email,x.r.pw,x.r.status,x.r.dep||'']));
    const wb=X.utils.book_new();
    const ws=X.utils.aoa_to_sheet(rows);
    ws['!cols']=rows[0].map(()=>({wch:22}));
    X.utils.book_append_sheet(wb,ws,'Credentials');
    X.writeFile(wb,'bridge_new_users_'+todayISO()+'.xlsx');
    toast('Credentials downloaded — store it safely');
  }catch(e){toast(e.message,'err');}
};

