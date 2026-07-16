/* ============================================================
   Bridge — 10-departments-locations.js  (split from Bridge.html lines 2566-2948)
   Classic script: shares top-level scope with the other /js files.
   Load order matters — see index.html.
   ============================================================ */
/* ===== DEPARTMENTS ===== */
function _scopeDocsTab(type, scopeKey){
  const u=me();const isAdm=isAdmin();
  const da=(u?.docAccess)||{departments:{},locations:{}};
  function perm(){
    if(isAdm)return{view:true,upload:true,download:true,edit:true};
    const map=type==='dept'?da.departments:da.locations;
    return (map&&map[scopeKey])||{};
  }
  const p=perm();
  if(!p.view&&!isAdm)return empty('folder','No access','You do not have document access for this '+(type==='dept'?'department':'location')+'.');

  const folderId=S.filters.docFolder||null;
  const scopeFolders=(DB.folders||[]).filter(f=>f.type===type&&f.scope===scopeKey&&(f.parentId||null)===(folderId||null));
  const scopeDocs=(DB.documents||[]).filter(d=>d.type===type&&d.scope===scopeKey&&(d.folderId||null)===(folderId||null));

  // Breadcrumb
  function buildPath(id){if(!id)return[];const f=(DB.folders||[]).find(x=>x.id===id);if(!f)return[];return[...buildPath(f.parentId||null),f];}
  const crumbs=buildPath(folderId);
  const rootLabel=type==='dept'?scopeKey:(DB.locations.find(l=>l.id===scopeKey)?.name||scopeKey);

  let html='';
  // Breadcrumb bar
  if(crumbs.length){
    html+='<div style="display:flex;align-items:center;gap:6px;margin-bottom:12px;flex-wrap:wrap">'
      +'<button onclick="App._docNav(null)" style="font-size:13px;font-weight:600;color:#0E9F6E;background:none;border:none;cursor:pointer;padding:0">'+esc(rootLabel)+'</button>'
      +crumbs.map(f=>'<span style="color:#D1D5DB">›</span><button onclick="App._docNav(this.dataset.id)" data-id="'+f.id+'" style="font-size:13px;font-weight:600;color:'+(folderId===f.id?'#15171C':'#0E9F6E')+';background:none;border:none;cursor:pointer;padding:0">'+esc(f.name)+'</button>').join('')
      +'</div>';
  }
  // Toolbar
  html+='<div style="display:flex;gap:8px;margin-bottom:14px">';
  if(isAdm||p.edit)html+='<button onclick="App._newFolderIn(\''+type+'\',\''+scopeKey+'\')" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:10px;border:1.5px solid #ECEDF0;background:#fff;font-size:13px;font-weight:600;cursor:pointer">📁 New folder</button>';
  if(isAdm||p.upload)html+='<button onclick="App._uploadDocIn(\''+type+'\',\''+scopeKey+'\')" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:10px;background:#15171C;color:#fff;font-size:13px;font-weight:600;border:none;cursor:pointer">⬆ Upload file</button>';
  html+='</div>';
  // Empty state
  if(!scopeFolders.length&&!scopeDocs.length){html+=empty('folder','No files yet',(isAdm||p.upload)?'Click "Upload file" to add documents':'No documents uploaded yet.');return html;}
  // Folders grid
  if(scopeFolders.length){
    html+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:14px">'
      +scopeFolders.map(f=>'<div onclick="App._docNav(this.dataset.id)" data-id="'+f.id+'" class="fld-card" style="background:#fff;border-radius:14px;border:1.5px solid #ECEDF0;padding:14px;cursor:pointer;transition:all .15s">'
        +'<div style="font-size:28px;margin-bottom:8px">📁</div>'
        +'<div style="font-size:13px;font-weight:700">'+esc(f.name)+'</div>'
        +'<div style="font-size:11px;color:#9CA3AF;margin-top:4px">'+((DB.documents||[]).filter(d=>d.folderId===f.id).length)+' files</div>'
        +(isAdm||p.edit?'<button onclick="event.stopPropagation();App._delFolder(this.dataset.id)" data-id="'+f.id+'" style="margin-top:8px;font-size:11px;color:#DC2626;background:none;border:none;cursor:pointer;padding:0">Delete</button>':'')
        +'</div>'
      ).join('')+'</div>';
  }
  // Documents list
  if(scopeDocs.length){
    html+='<div style="background:#fff;border-radius:16px;border:1px solid #ECEDF0;overflow:hidden">'
      +scopeDocs.map((d,i)=>{
        const ext=(d.name.split('.').pop()||'').toLowerCase();
        const icon=ext==='pdf'?'📄':ext.match(/xlsx?|csv/)?'📊':ext.match(/docx?/)?'📝':ext.match(/pptx?/)?'📊':ext.match(/jpe?g|png|gif|webp/)?'🖼':'📎';
        return'<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:'+(i<scopeDocs.length-1?'1px solid #F3F4F6':'none')+'">'
          +'<span style="font-size:22px;flex-shrink:0">'+icon+'</span>'
          +'<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">'+esc(d.name)+'</div>'
          +'<div style="font-size:11px;color:#9CA3AF;margin-top:1px">'+(d.uploadedAt?fmtS(d.uploadedAt.slice(0,10)):'')+' · '+(d.uploaderName||'')+(d.fileSize?' · '+_fmtSize(d.fileSize):'')+'</div></div>'
          +'<div style="display:flex;gap:6px;flex-shrink:0">'
          +(p.download||isAdm?'<button onclick="App._downloadDoc(this.dataset.id)" data-id="'+d.id+'" style="padding:5px 10px;border-radius:7px;background:#ECFDF5;color:#0E9F6E;font-size:12px;font-weight:700;border:1px solid #A7F3D0;cursor:pointer">↓ Download</button>':'')
          +(p.view||isAdm?'<button onclick="App._previewDoc(this.dataset.id)" data-id="'+d.id+'" style="padding:5px 10px;border-radius:7px;background:#F6F7F8;color:#374151;font-size:12px;font-weight:700;border:1px solid #ECEDF0;cursor:pointer">View</button>':'')
          +(isAdm||p.edit?'<button onclick="App._delDoc(this.dataset.id)" data-id="'+d.id+'" style="padding:5px 8px;border-radius:7px;background:#FEE2E2;color:#DC2626;font-size:12px;font-weight:700;border:1px solid #FECACA;cursor:pointer">✕</button>':'')
          +'</div></div>';
      }).join('')+'</div>';
  }
  return html;
}

// ── Scoped new folder (called from dept/loc detail) ──
App._openDept=(id)=>{S.filters.deptSel=id;S.filters.deptTab='docs';S.filters.docFolder=null;rr();};
App._closeDept=()=>{S.filters.deptSel=null;rr();};
App._openLoc=(id)=>{S.filters.locSel=id;S.filters.locTab='docs';S.filters.docFolder=null;rr();};
App._closeLoc=()=>{S.filters.locSel=null;rr();};
App._setDeptTab=(k)=>{S.filters.deptTab=k;rr();};
App._setLocTab=(k)=>{S.filters.locTab=k;rr();};
// Store pending folder context in App — no data attribute tricks
App._folderCtx={type:null,scope:null};

App._newFolderIn=(t,s)=>{
  App._folderCtx={type:t,scope:s};
  openModal(
    '<div class="p-6">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
    +'<h2 class="fd" style="font-size:18px;font-weight:800">New folder</h2>'
    +'<button onclick="App.closeModal()" style="background:none;border:none;cursor:pointer;color:#9CA3AF;font-size:20px">×</button>'
    +'</div>'
    +'<div style="margin-bottom:16px">'
    +'<label for="nf-name" style="display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6B7280;margin-bottom:6px">Folder name</label>'
    +'<input id="nf-name" type="text" placeholder="e.g. Procurement, Inventory…" '
    +'style="width:100%;background:#fff;border:1.5px solid #ECEDF0;border-radius:12px;padding:10px 14px;font-size:14px;outline:none;box-sizing:border-box;font-family:inherit" '
    +'autofocus/>'
    +'</div>'
    +'<div style="display:flex;gap:8px">'
    +'<button onclick="App.closeModal()" style="flex:1;padding:11px;border-radius:10px;border:1.5px solid #ECEDF0;background:#fff;font-weight:600;font-size:14px;cursor:pointer">Cancel</button>'
    +'<button onclick="App._createFolderIn()" style="flex:1;padding:11px;border-radius:10px;background:#15171C;color:#fff;font-weight:700;font-size:14px;border:none;cursor:pointer">Create folder</button>'
    +'</div>'
    +'</div>',
    'max-w-sm'
  );
  // Focus and add Enter key handler
  setTimeout(()=>{
    const inp=document.getElementById('nf-name');
    if(inp){
      inp.focus();
      inp.addEventListener('keydown',function handler(e){
        if(e.key==='Enter'){e.preventDefault();App._createFolderIn();}
        if(e.key==='Escape'){App.closeModal();}
      },{once:false});
    }
  },100);
};

App._createFolderIn=()=>{
  // Guard: prevent double-tap / double-submit
  if(App._folderCtx._creating)return;

  const name=(document.getElementById('nf-name')?.value||'').trim();
  if(!name){
    const inp=document.getElementById('nf-name');
    if(inp){inp.style.borderColor='#EF4444';inp.focus();}
    toast('Enter a folder name','err');
    return;
  }
  const {type:t,scope:s}=App._folderCtx;
  if(!t||!s){toast('Scope error — please try again','err');closeModal();return;}

  // Lock immediately
  App._folderCtx._creating=true;

  // Disable the button visually
  const createBtn=document.querySelector('[onclick="App._createFolderIn()"]');
  if(createBtn){createBtn.disabled=true;createBtn.textContent='Creating…';createBtn.style.opacity='0.7';}

  if(!DB.folders)DB.folders=[];
  const parentId=S.filters.docFolder||null;
  const f={
    id:uid('fld'),name,
    type:t,scope:s,
    parentId,
    createdBy:S.uid,
    createdAt:new Date().toISOString()
  };
  DB.folders.push(f);

  // Close modal first so user sees the result immediately
  closeModal();
  toast('📁 "'+name+'" created');
  App._folderCtx={type:null,scope:null,_creating:false};
  saveDB();
  render();

  // Sync to Supabase in background
  sb.from('doc_folders').insert({
    id:f.id,name:f.name,parent_id:f.parentId||null,
    type:f.type,scope:f.scope,
    created_by:f.createdBy,created_at:f.createdAt
  }).then(()=>{}).catch(e=>console.warn('folder sync:',e));
  log(fullName(me()),'Created folder',name);
};

// ── Scoped upload ──
App._uploadDocIn=(t,s)=>{
  // Pre-set scope then open upload modal
  S.filters.docScope=t;S.filters.docScopeKey=s;
  App._uploadDoc();
};

// ── Document navigation ──


// queueEmail stub — wire up to your email provider (Resend, SendGrid etc.)
function queueEmail(eventKey,userId,clId,date,vars){
  // sendEmail is defined later in the file but called here — JS hoisting handles async functions
  if(typeof sendEmail==='function'){
    sendEmail(eventKey,userId,vars||{}).catch(e=>console.warn('[queueEmail] sendEmail failed:',e.message));
  }
}


function topDepts(){return (DB.departments||[]).filter(d=>!d.parentId);}
function subDepts(pid){return (DB.departments||[]).filter(d=>d.parentId===pid);}
// ── Sub-department <option>s for the checklist form (checklist.department is stored by NAME) ──
function _clSubDeptOptions(deptName,selSub){
  const dep=(DB.departments||[]).find(d=>!d.parentId&&d.name===deptName);
  const subs=dep?subDepts(dep.id):[];
  let h='<option value="">— No sub-department —</option>';
  h+=subs.map(s=>`<option value="${esc(s.name)}" ${s.name===selSub?'selected':''}>${esc(s.name)}</option>`).join('');
  return h;
}
// When the checklist department changes, refresh the sub-department list and clear the prior pick.
App._clDepChange=(name)=>{
  if(CLD)CLD.department=name;
  const sel=document.getElementById('cn-subdep');
  if(sel){if(CLD)CLD.subDepartment='';sel.innerHTML=_clSubDeptOptions(name,'');}
};
let _deptParent=null;
function _subDeptsTabHTML(d){
  const subs=subDepts(d.id);
  let h='<div>';
  h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
  h+='<div style="font-size:13px;color:#6B7280">'+subs.length+' sub-department'+(subs.length===1?'':'s')+'</div>';
  if(can('subDepartments','create'))h+='<button onclick="App.editDept(null,\''+d.id+'\')" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:10px;background:#15171C;color:#fff;font-size:13px;font-weight:700;border:none;cursor:pointer">'+ic('plus','w-4 h-4')+'Add sub-department</button>';
  h+='</div>';
  if(!subs.length){h+=empty('dept','No sub-departments','Create a sub-department to organise questions inside '+esc(d.name)+'.');}
  else{h+='<div class="space-y-2">'+subs.map(s=>{
    const qn=(DB.questions||[]).filter(q=>q.subDepartmentId===s.id).length;
    return '<div style="display:flex;align-items:center;gap:12px;background:#fff;border-radius:14px;border:1px solid #ECEDF0;padding:12px 14px">'
      +'<div style="width:36px;height:36px;border-radius:10px;background:#ECFDF5;display:grid;place-items:center;flex-shrink:0">'+ic('dept','w-4 h-4 text-brand-600')+'</div>'
      +'<div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:600">'+esc(s.name)+'</div><div style="font-size:12px;color:#9CA3AF">'+qn+' question'+(qn===1?'':'s')+'</div></div>'
      +((can('subDepartments','edit')||can('subDepartments','delete'))?'<div style="display:flex;gap:4px">'+(can('subDepartments','edit')?'<button onclick="App.editDept(\''+s.id+'\')" style="width:30px;height:30px;display:grid;place-items:center;border-radius:8px;border:none;background:transparent;color:#9CA3AF;cursor:pointer">'+ic('edit','w-4 h-4')+'</button>':'')+(can('subDepartments','delete')?'<button onclick="App.delDept(\''+s.id+'\')" style="width:30px;height:30px;display:grid;place-items:center;border-radius:8px;border:none;background:transparent;color:#D1D5DB;cursor:pointer">'+ic('trash','w-4 h-4')+'</button>':'')+'</div>':'')
      +'</div>';
  }).join('')+'</div>';}
  h+='</div>';
  return h;
}
function deptsPage(){
  const sel=S.filters.deptSel||null;
  const stab=S.filters.deptTab||'docs';
  // ── Detail view ──
  if(sel){
    const d=DB.departments.find(x=>x.id===sel||x.name===sel);
    if(!d){S.filters.deptSel=null;return deptsPage();}
    const dUsers=DB.users.filter(u=>u.department===d.name);
    const dCls=DB.checklists.filter(c=>c.department===d.name);
    const TABS=[['docs','📁 Documents'],['users','👥 Users'],['checklists','✓ Checklists'],['subdepts','🏢 Sub-departments']];
    return'<div class="fade">'
      // Back bar
      +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">'
      +'<button onclick="App._closeDept()" style="width:34px;height:34px;border-radius:10px;border:1.5px solid #ECEDF0;background:#fff;cursor:pointer;display:grid;place-items:center;color:#6B7280">'+ic('back','w-4 h-4')+'</button>'
      +'<div style="width:36px;height:36px;border-radius:10px;background:#ECFDF5;display:grid;place-items:center">'+ic('dept','w-4 h-4 text-brand-600')+'</div>'
      +'<div style="flex:1"><div class="fd" style="font-size:16px;font-weight:800">'+esc(d.name)+'</div>'
      +'<div style="font-size:12px;color:#9CA3AF">'+dUsers.length+' users · '+dCls.length+' checklists'+(subDepts(d.id).length?' · '+subDepts(d.id).length+' sub-depts':'')+'</div></div>'
      +(can('departments','edit')?'<button onclick="App.editDept(this.dataset.id)" data-id="'+d.id+'" style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:10px;background:#F6F7F8;color:#374151;font-size:13px;font-weight:600;border:1px solid #ECEDF0;cursor:pointer">'+ic('edit','w-4 h-4')+'Edit</button>':'')
      +'</div>'
      // Sub-tabs
      +'<div style="display:flex;gap:4px;margin-bottom:16px;background:#F6F7F8;border-radius:12px;padding:4px">'
      +TABS.map(([k,l])=>'<button onclick="App._setDeptTab(this.dataset.k)" data-k="'+k+'" style="flex:1;padding:8px;border-radius:9px;font-size:13px;font-weight:700;border:none;cursor:pointer;background:'+(stab===k?'#fff':'transparent')+';color:'+(stab===k?'#15171C':'#6B7280')+';box-shadow:'+(stab===k?'0 1px 4px rgba(0,0,0,.08)':'none')+'">'+l+'</button>').join('')
      +'</div>'
      // Tab content
      +(stab==='docs'?_scopeDocsTab('dept',d.name):'')
      +(stab==='users'
        ?('<div class="space-y-2">'
          +(dUsers.length
            ?dUsers.map(u=>'<div style="display:flex;align-items:center;gap:12px;background:#fff;border-radius:14px;border:1px solid #ECEDF0;padding:12px 14px">'+avatar(u,'w-10 h-10','text-xs')+'<div style="flex:1"><div style="font-size:14px;font-weight:600">'+esc(fullName(u))+'</div><div style="font-size:12px;color:#9CA3AF">'+esc(u.position||u.role)+'</div></div>'+chip(u.status)+'</div>').join('')
            :empty('users','No users','No users assigned to this department.')
          )+'</div>')
        :'')
      +(stab==='checklists'
        ?('<div class="space-y-2">'
          +(dCls.length
            ?dCls.map(c=>'<div style="display:flex;align-items:center;gap:12px;background:#fff;border-radius:14px;border:1px solid #ECEDF0;padding:12px 14px"><div style="width:36px;height:36px;border-radius:10px;background:#F6F7F8;display:grid;place-items:center;flex-shrink:0">'+ic('list','w-4 h-4')+'</div><div style="flex:1"><div style="font-size:14px;font-weight:600">'+esc(c.name)+'</div><div style="font-size:12px;color:#9CA3AF">'+esc(c.frequency)+' · '+(c.assignees||[]).length+' assigned</div></div></div>').join('')
            :empty('list','No checklists','No checklists in this department.')
          )+'</div>')
        :'')
      +(stab==='subdepts'?_subDeptsTabHTML(d):'')
      +'</div>';
  }
  // ── List view ──
  // Filter depts by user's access if not admin
  const visibleDepts=can('departments','view')?topDepts():topDepts().filter(d=>{
    const da=(me()?.docAccess)||{};
    return Object.keys(da.departments||{}).includes(d.name);
  });
  return'<div class="fade">'+hdr('Departments','',can('departments','create')?btnP('Add','App.editDept()','plus'):'')
    +'<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">'
    +visibleDepts.map(d=>{
      const us=DB.users.filter(u=>u.department===d.name);
      const cls=DB.checklists.filter(c=>c.department===d.name);
      const docs=(DB.documents||[]).filter(x=>x.type==='dept'&&x.scope===d.name).length;
      const folders=(DB.folders||[]).filter(x=>x.type==='dept'&&x.scope===d.name&&!x.parentId).length;
      return'<div onclick="App._openDept(this.dataset.id)" data-id="'+d.id+'" class="dept-card" style="background:#fff;border-radius:16px;border:1.5px solid #ECEDF0;padding:16px;cursor:pointer;transition:all .15s;display:block;width:100%">'
        +'<div style="display:flex;justify-content:space-between;margin-bottom:12px">'
        +'<div style="width:36px;height:36px;border-radius:10px;background:#ECFDF5;display:grid;place-items:center">'+ic('dept','w-4 h-4 text-brand-600')+'</div>'
        +((can('departments','edit')||can('departments','delete'))?'<div style="display:flex;gap:4px" onclick="event.stopPropagation()">'+(can('departments','edit')?'<button onclick="App.editDept(this.dataset.id)" data-id="'+d.id+'" style="width:28px;height:28px;display:grid;place-items:center;border-radius:7px;color:#9CA3AF;border:none;background:transparent;cursor:pointer">'+ic('edit','w-3.5 h-3.5')+'</button>':'')+(can('departments','delete')?'<button onclick="App.delDept(this.dataset.id)" data-id="'+d.id+'" style="width:28px;height:28px;display:grid;place-items:center;border-radius:7px;color:#9CA3AF;border:none;background:transparent;cursor:pointer">'+ic('trash','w-3.5 h-3.5')+'</button>':'')+'</div>':'')
        +'</div>'
        +'<div class="fd" style="font-size:15px;font-weight:800;margin-bottom:6px">'+esc(d.name)+'</div>'
        +'<div style="display:flex;gap:12px;font-size:12px;color:#9CA3AF">'
        +'<span><b style="color:#15171C">'+us.length+'</b> users</span>'
        +'<span><b style="color:#15171C">'+cls.length+'</b> checklists</span>'+(subDepts(d.id).length?'<span><b style="color:#15171C">'+subDepts(d.id).length+'</b> sub-depts</span>':'')
        +(docs||folders?'<span><b style="color:#0E9F6E">'+(folders+' folders, '+docs+' files')+'</b></span>':'')
        +'</div>'
        +'<div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px">'
        +'<div style="display:flex;-space-x-1.5">'+us.slice(0,5).map(u=>'<div style="border-radius:50%;ring:2px solid #fff;margin-right:-6px">'+avatar(u,'w-6 h-6','text-[9px]')+'</div>').join('')+'</div>'
        +'<span style="font-size:11px;font-weight:600;color:#0E9F6E">Open →</span>'
        +'</div></div>';
    }).join('')
    +(topDepts().length?'':empty('dept','No departments','Create your first department.'))
    +'</div></div>';
}
App.editDept=(id=null,parentId=null)=>{const d=id?DB.departments.find(x=>x.id===id):null;_deptParent=d?(d.parentId||null):(parentId||null);if(!can(_deptParent?'subDepartments':'departments',id?'edit':'create')){toast('You don’t have permission to do that','err');return;}const _lbl=_deptParent?'sub-department':'department';openModal(`<div class="p-6"><div class="flex justify-between mb-4"><h2 class="fd text-xl font-bold">${d?'Edit':'New'} ${_lbl}</h2><button onclick="App.closeModal()" class="text-ink-400">${ic('x')}</button></div>${fld('Name','d-n',d?.name||'')}<div class="flex gap-2 mt-4"><button onclick="App.closeModal()" style="flex:1;padding:12px;border-radius:12px;border:1.5px solid #ECEDF0;background:#fff;font-weight:600;font-size:14px;cursor:pointer">Cancel</button><button onclick="App.saveDept('${id||''}')" style="flex:1;padding:12px;border-radius:12px;background:#15171C;color:#fff;font-weight:600;font-size:14px;border:none;cursor:pointer">${d?'Save':'Create'}</button></div></div>`,'max-w-sm');};
App.saveDept=(id)=>{const n=$('#d-n')?.value.trim();if(!n){toast('Name required','err');return;}const _isSub=!!(id?((DB.departments.find(x=>x.id===id)||{}).parentId):_deptParent);if(!can(_isSub?'subDepartments':'departments',id?'edit':'create')){toast('You don’t have permission to do that','err');return;}const obj=id?DB.departments.find(x=>x.id===id):{id:uid('d'),name:n,parentId:_deptParent||null};if(id)obj.name=n;else DB.departments.push(obj);log(fullName(me()),id?'Edited dept':'Created dept',n);toast(id?'Updated ✓':'Created ✓');saveDB();closeModal();render();sb.from('departments').upsert({id:obj.id,name:obj.name,parent_id:obj.parentId||null},{onConflict:'id'}).then(({error})=>{if(error){console.error('saveDept:',error.message);toast('Couldn’t save to server — a department with this name may already exist here. ('+String(error.message||'').slice(0,50)+')','err');}}).catch(e=>{toast('Couldn’t save department to server','err');});};
App.delDept=(id)=>{const d=DB.departments.find(x=>x.id===id);if(!d)return;const isSub=!!d.parentId;if(!can(isSub?'subDepartments':'departments','delete')){toast('You don’t have permission to delete '+(isSub?'sub-departments':'departments'),'err');return;}const kids=DB.departments.filter(x=>x.parentId===id);
// ── Guard: a department (or its sub-departments) that is still tagged to questions,
//    checklists, or users must not be deleted. Note: questions reference departments by ID,
//    while checklists and users reference them by NAME. ──
const _allIds=[id,...kids.map(k=>k.id)];const _allNames=[d.name,...kids.map(k=>k.name)];const _qUsed=(DB.questions||[]).filter(q=>_allIds.includes(q.departmentId)||_allIds.includes(q.subDepartmentId)).length;const _cUsed=(DB.checklists||[]).filter(c=>_allNames.includes(c.department)||_allNames.includes(c.subDepartment)).length;const _uUsed=(DB.users||[]).filter(u=>_allNames.includes(u.department)).length;if(_qUsed||_cUsed||_uUsed){const _p=[];if(_qUsed)_p.push(_qUsed+' question'+(_qUsed>1?'s':''));if(_cUsed)_p.push(_cUsed+' checklist'+(_cUsed>1?'s':''));if(_uUsed)_p.push(_uUsed+' user'+(_uUsed>1?'s':''));alert("Can't delete \""+d.name+"\" — it's still used by "+_p.join(', ')+".\n\nReassign or untag those first (change their department), then delete this "+(isSub?'sub-department':'department')+".");return;}
const msg=isSub?('Delete sub-department '+d.name+'? Questions tagged to it will become untagged.'):('Delete '+d.name+'?'+(kids.length?' Its '+kids.length+' sub-department(s) will also be deleted.':'')+' Users and checklists in this department will not be deleted but will have no department.');if(!confirm(msg))return;if(!DB.departments_deleted)DB.departments_deleted=[];const _toDel=[id,...kids.map(k=>k.id)];_toDel.forEach(did=>{if(!DB.departments_deleted.includes(did))DB.departments_deleted.push(did);});DB.departments=DB.departments.filter(x=>!_toDel.includes(x.id));_toDel.forEach(did=>{sb.from('departments').delete().eq('id',did).then(({error})=>{if(error)console.error('delDept:',error.message);}).catch(()=>{});});// Clear dept from users and checklists (don't delete them)
DB.users.forEach(u=>{if(u.department===d.name)u.department='';});DB.checklists.forEach(c=>{if(c.department===d.name)c.department='';});(DB.questions||[]).forEach(q=>{if(_toDel.includes(q.departmentId))q.departmentId=null;if(_toDel.includes(q.subDepartmentId))q.subDepartmentId=null;});log(fullName(me()),'Deleted dept',d.name);toast('Deleted','warn');saveDB();render();};

/* ===== LOCATIONS ===== */
function locsPage(){
  const sel=S.filters.locSel||null;
  const stab=S.filters.locTab||'docs';
  // ── Detail view ──
  if(sel){
    const l=DB.locations.find(x=>x.id===sel);
    if(!l){S.filters.locSel=null;return locsPage();}
    const lCls=DB.checklists.filter(c=>(c.locationIds||[]).includes(l.id));
    const TABS=[['docs','📁 Documents'],['checklists','✓ Checklists'],['info','ℹ Info']];
    return'<div class="fade">'
      +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">'
      +'<button onclick="App._closeLoc()" style="width:34px;height:34px;border-radius:10px;border:1.5px solid #ECEDF0;background:#fff;cursor:pointer;display:grid;place-items:center;color:#6B7280">'+ic('back','w-4 h-4')+'</button>'
      +'<div style="width:36px;height:36px;border-radius:10px;background:#EFF6FF;display:grid;place-items:center">'+ic('pin','w-4 h-4')+'</div>'
      +'<div style="flex:1"><div class="fd" style="font-size:16px;font-weight:800">'+esc(l.name)+'</div>'
      +'<div style="font-size:12px;color:#9CA3AF">'+esc(l.address||'No address')+'</div></div>'
      +chip(l.status||'Active')
      +((can('locations','edit')||can('locations','delete'))?(can('locations','edit')?'<button onclick="App.editLoc(this.dataset.id)" data-id="'+l.id+'" style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:10px;background:#F6F7F8;color:#374151;font-size:13px;font-weight:600;border:1px solid #ECEDF0;cursor:pointer">'+ic('edit','w-4 h-4')+'Edit</button>':'')+(can('locations','delete')?'<button onclick="App.delLoc(this.dataset.id)" data-id="'+l.id+'" style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:10px;background:#FFF1F2;color:#BE123C;font-size:13px;font-weight:600;border:1px solid #FECACA;cursor:pointer">'+ic('trash','w-4 h-4')+'Delete</button>':''):'')
      +'</div>'
      +'<div style="display:flex;gap:4px;margin-bottom:16px;background:#F6F7F8;border-radius:12px;padding:4px">'
      +TABS.map(([k,ll])=>'<button onclick="App._setLocTab(this.dataset.k)" data-k="'+k+'" style="flex:1;padding:8px;border-radius:9px;font-size:13px;font-weight:700;border:none;cursor:pointer;background:'+(stab===k?'#fff':'transparent')+';color:'+(stab===k?'#15171C':'#6B7280')+';box-shadow:'+(stab===k?'0 1px 4px rgba(0,0,0,.08)':'none')+'">'+ll+'</button>').join('')
      +'</div>'
      +(stab==='docs'?_scopeDocsTab('loc',l.id):'')
      +(stab==='checklists'
        ?('<div class="space-y-2">'
          +(lCls.length
            ?lCls.map(c=>'<div style="display:flex;align-items:center;gap:12px;background:#fff;border-radius:14px;border:1px solid #ECEDF0;padding:12px 14px"><div style="width:36px;height:36px;border-radius:10px;background:#F6F7F8;display:grid;place-items:center;flex-shrink:0">'+ic('list','w-4 h-4')+'</div><div style="flex:1"><div style="font-size:14px;font-weight:600">'+esc(c.name)+'</div><div style="font-size:12px;color:#9CA3AF">'+esc(c.frequency)+'</div></div></div>').join('')
            :empty('list','No checklists','No checklists assigned to this location.')
          )+'</div>')
        :'')
      +(stab==='info'
        ?'<div class="bg-white rounded-2xl border border-ink-100 p-5 space-y-3">'
          +[['Name',l.name],['Address',l.address||'—'],['Department',l.department||'All departments'],['Status',l.status||'Active']].map(([k,v])=>'<div><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#9CA3AF;margin-bottom:2px">'+k+'</div><div style="font-size:14px;font-weight:600">'+esc(v)+'</div></div>').join('')
          +'</div>'
        :'')
      +'</div>';
  }
  // ── List view ──
  // Filter locations by user's access if not admin
  const visibleLocs=can('locations','view')?DB.locations:DB.locations.filter(l=>{
    const da=(me()?.docAccess)||{};
    return Object.keys(da.locations||{}).includes(l.id);
  });
  return'<div class="fade">'+hdr('Locations','Physical sites & areas',can('locations','create')?btnP('Add location','App.editLoc()','plus'):'')
    +'<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">'
    +visibleLocs.map(l=>{
      const docs=(DB.documents||[]).filter(x=>x.type==='loc'&&x.scope===l.id).length;
      const folders=(DB.folders||[]).filter(x=>x.type==='loc'&&x.scope===l.id&&!x.parentId).length;
      return'<div onclick="App._openLoc(this.dataset.id)" data-id="'+l.id+'" class="loc-card" style="background:#fff;border-radius:16px;border:1.5px solid #ECEDF0;padding:16px;cursor:pointer;transition:all .15s;display:block;width:100%">'
        +'<div style="display:flex;justify-content:space-between;margin-bottom:12px">'
        +'<div style="width:36px;height:36px;border-radius:10px;background:#EFF6FF;display:grid;place-items:center">'+ic('pin','w-4 h-4')+'</div>'
        +chip(l.status||'Active')+'</div>'
        +'<div class="fd" style="font-size:15px;font-weight:800;margin-bottom:4px">'+esc(l.name)+'</div>'
        +'<div style="font-size:12px;color:#9CA3AF;margin-bottom:8px">'+esc(l.address||l.department||'')+'</div>'
        +(docs||folders?'<div style="font-size:11px;font-weight:600;color:#3B82F6;margin-bottom:8px">'+folders+' folders · '+docs+' files</div>':'')
        +'<div style="font-size:11px;font-weight:600;color:#6B7280;text-align:right">Open →</div>'
        +'</div>';
    }).join('')
    +(DB.locations.length?'':empty('pin','No locations','Add locations to assign them to checklists.'))
    +'</div></div>';
}
App.editLoc=(id=null)=>{if(!can('locations',id?'edit':'create')){toast('You don’t have permission to do that','err');return;}const l=id?locById(id):null;openModal(`<div class="p-6"><div class="flex justify-between mb-4"><h2 class="fd text-xl font-bold">${l?'Edit':'New'} location</h2><button onclick="App.closeModal()" class="text-ink-400">${ic('x')}</button></div><div class="space-y-3">${fld('Location name','ln-n',l?.name||'')}${fld('Address','ln-a',l?.address||'')}${selF('Department (optional)','ln-d',[['','All departments'],...topDepts().map(d=>[d.name,d.name])],l?.department||'')}${selF('Status','ln-s',['Active','Inactive'],l?.status||'Active')}</div><div class="flex gap-2 mt-5"><button onclick="App.closeModal()" style="flex:1;padding:12px;border-radius:12px;border:1.5px solid #ECEDF0;background:#fff;font-weight:600;font-size:14px;cursor:pointer">Cancel</button><button onclick="App.saveLoc('${id||''}')" style="flex:1;padding:12px;border-radius:12px;background:#15171C;color:#fff;font-weight:600;font-size:14px;border:none;cursor:pointer">${l?'Save':'Create'}</button></div></div>`,'max-w-sm');};
App.saveLoc=(id)=>{if(!can('locations',id?'edit':'create')){toast('You don’t have permission to do that','err');return;}const n=$('#ln-n')?.value.trim();if(!n){toast('Name required','err');return;}const data={name:n,address:$('#ln-a')?.value.trim()||'',department:$('#ln-d')?.value||'',status:$('#ln-s')?.value||'Active'};const obj=id?locById(id):{id:uid('loc'),...data};if(id)Object.assign(obj,data);else DB.locations.push(obj);log(fullName(me()),id?'Edited location':'Created location',n);toast(id?'Updated ✓':'Created ✓');saveDB();closeModal();render();sb.from('locations').upsert({id:obj.id,...data},{onConflict:'id'}).then(({error})=>{if(error)console.error('saveLoc:',error.message);}).catch(()=>{});};
App.delLoc=(id)=>{if(!can('locations','delete')){toast('You don’t have permission to delete locations','err');return;}const l=locById(id);if(!l)return;if(!confirm('Delete "'+l.name+'"? Checklists using this location will keep it as reference.'))return;if(!DB.locations_deleted)DB.locations_deleted=[];if(!DB.locations_deleted.includes(id))DB.locations_deleted.push(id);DB.locations=DB.locations.filter(x=>x.id!==id);saveDB();render();toast('Deleted','warn');sb.from('locations').delete().eq('id',id).then(({error})=>{if(error)console.error('delLoc:',error.message);}).catch(()=>{});};


const Q_TYPES=[
  {id:'answer',   label:'Answer',      desc:'Multiple choice answers'},
  {id:'number',   label:'Number',      desc:'Numeric value with conditions'},
  {id:'passfail', label:'Pass / Fail', desc:'Pass or Fail response'},
  {id:'yesno',    label:'Yes / No',    desc:'Yes or No response'},
  {id:'tick',     label:'Tick / Cross',desc:'Done or Not done'},
];
const Q_TYPE_CLR={answer:'#4338CA',number:'#0369A1',passfail:'#16A34A',yesno:'#D97706',tick:'#0E9F6E'};
const Q_TYPE_BG ={answer:'#EEF2FF',number:'#E0F2FE',passfail:'#DCFCE7',yesno:'#FEF9C3',tick:'#ECFDF5'};
const NUM_CONDITIONS=[
  {id:'lt',     label:'Less than'},
  {id:'lte',    label:'Less than or equal'},
  {id:'gt',     label:'Greater than'},
  {id:'gte',    label:'Greater than or equal'},
  {id:'eq',     label:'Equal to'},
  {id:'neq',    label:'Not equal to'},
  {id:'between',label:'Between'},
];

