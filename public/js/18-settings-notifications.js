/* ============================================================
   Bridge — 18-settings-notifications.js  (split from Bridge.html lines 6149-6859)
   Classic script: shares top-level scope with the other /js files.
   Load order matters — see index.html.
   ============================================================ */
/* ===== AUDIT / NOTIF / PROFILE / SETTINGS ===== */

function auditPage(){return`<div class="fade">${hdr('Audit Logs','')}<div class="bg-white rounded-2xl border border-ink-100 shadow-soft overflow-hidden"><div class="divide-y divide-ink-50 max-h-[70vh] overflow-y-auto">${DB.audit.map(l=>`<div class="px-4 py-3 flex items-center gap-2.5 text-sm"><span class="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0"></span><div class="flex-1 min-w-0"><span class="font-semibold">${esc(l.actor)}</span> <span class="text-ink-500">${esc(l.action.toLowerCase())}</span>${l.target?` <span class="font-medium">${esc(l.target)}</span>`:''}</div><span class="text-[11px] text-ink-300 shrink-0">${new Date(l.time).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span></div>`).join('')||empty('audit','No logs yet','')}</div></div></div>`;}
App._goNotifFeedback=()=>{S.route="notifications";S.search="";S.expandedCl=null;S.afOpen=null;S.tvUser=null;S.filters={ntab:"Feedback"};render();window.scrollTo(0,0);};

function profilePage(){
  const u=me();
  return`<div class="fade max-w-xl">
  ${hdr('Profile','')}
  <div class="bg-white rounded-2xl border border-ink-100 shadow-soft p-5 mb-4">
    <div class="flex items-center gap-4 mb-5">
      ${avatar(u,'w-14 h-14','text-xl')}
      <div>
        <h2 class="fd text-xl font-bold">${esc(fullName(u))}</h2>
        <p class="text-ink-400 text-sm">${isAdmin()?'Admin':isMgr()?'Manager':'Member'} · ${esc(u.department||'')}</p>
        <div class="mt-1.5">${chip(u.status)}</div>
      </div>
    </div>
    <div class="grid sm:grid-cols-2 gap-x-6 gap-y-3 border-t border-ink-100 pt-4 mb-4">
      ${[['Email',u.email],['Phone',u.phone||'—'],['Department',u.department||'—'],['Role',u.role],
         ['Reports to',u.managerId?fullName(uById(u.managerId)):'—'],
         ['Direct reports',subTree(u.id).length]].map(([k,v])=>`
        <div><div class="text-[10px] font-bold text-ink-400 uppercase tracking-wide">${k}</div>
        <div class="font-medium text-sm mt-0.5">${esc(String(v))}</div></div>`).join('')}
    </div>
    <!-- Edit form -->
    <div class="border-t border-ink-100 pt-4">
      <h3 class="fd font-semibold text-sm mb-3">Edit profile</h3>
      <div class="grid sm:grid-cols-2 gap-3 mb-3">
        ${fld('First name','ep-fn',u.firstName||'')}
        ${fld('Last name','ep-ln',u.lastName||'')}
        ${fld('Phone','ep-ph',u.phone||'','tel')}
        ${fld('Position','ep-pos',u.position||'')}
      </div>
      <button id="ep-save-btn" onclick="if(this.disabled)return;this.disabled=true;this.textContent='Saving…';App.saveProfile().finally(()=>{const b=document.getElementById('ep-save-btn');if(b){b.disabled=false;b.textContent='Save changes';}})" style="padding:10px 20px;border-radius:12px;background:#1C1712;color:#fff;font-weight:600;font-size:14px;border:none;cursor:pointer">Save changes</button>
    </div>
  </div>
  <!-- Change password -->
  <div class="bg-white rounded-2xl border border-ink-100 shadow-soft p-5 mb-4">
    <h3 class="fd font-semibold text-sm mb-3">Change password</h3>
    <div class="space-y-2">
      ${fld('Current password','pw-cur','','password','')}
      ${fld('New password','pw-new','','password','min 6 characters')}
      <button id="pw-save-btn" onclick="if(this.disabled)return;this.disabled=true;this.textContent='Updating…';App.changePw().finally(()=>{const b=document.getElementById('pw-save-btn');if(b){b.disabled=false;b.textContent='Update password';}})" style="margin-top:8px;padding:10px 20px;border-radius:12px;background:#1C1712;color:#fff;font-weight:600;font-size:14px;border:none;cursor:pointer">Update password</button>
    </div>
  </div>
  <!-- Feedback history -->
  ${(()=>{
    const myFb=DB.feedback.filter(fb=>fb.userId===S.uid).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).slice(0,5);
    if(!myFb.length)return '';
    return '<div class="bg-white rounded-2xl border border-ink-100 shadow-soft p-5 mb-4">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">'
      +'<h3 class="fd font-semibold text-sm">Recent Feedback</h3>'
      +'<button onclick="App._goNotifFeedback()" style="font-size:12px;font-weight:600;color:#E8785C;background:none;border:none;cursor:pointer">View all</button>'
      +'</div>'
      +myFb.map(fb=>{
        const mgr=uById(fb.managerId);
        const stClr=fb.status==='Responded'?'#CE5B41':fb.status==='Acknowledged'?'#0EA5E9':'#3B82F6';
        return '<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid #F3F4F6">'
          +'<div style="flex:1;min-width:0">'
          +'<div style="font-size:13px;font-weight:600">'+(fb.title||fb.type+' Feedback')+'</div>'
          +'<div style="font-size:11px;color:#9CA3AF;margin-top:2px">From '+(mgr?esc(fullName(mgr)):'Manager')+' · '+fmtD(fb.date||fb.createdAt?.slice(0,10))+'</div>'
          +'</div>'
          +'<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:#F6F7F8;color:'+stClr+';flex-shrink:0">'+(fb.status||'Sent')+'</span>'
          +'</div>';
      }).join('')
      +'</div>';
  })()}
  </div>`;
}


function _fmtSize(b){if(!b)return'';if(b<1024)return b+'B';if(b<1048576)return Math.round(b/1024)+'KB';return(b/1048576).toFixed(1)+'MB';}

App._docNav=(id)=>{S.filters.docFolder=id;rr();};  // alias kept for compatibility

App._delFolder=(id)=>{
  const f=(DB.folders||[]).find(x=>x.id===id);
  if(!f)return;
  if(!confirm('Delete folder "'+f.name+'" and all its files?'))return;
  // Collect all folder IDs (recursive) and doc IDs BEFORE modifying DB
  const toDelete=[];
  function collectRec(fid){toDelete.push(fid);(DB.folders||[]).filter(x=>x.parentId===fid).forEach(c=>collectRec(c.id));}
  collectRec(id);
  const docIds=(DB.documents||[]).filter(x=>toDelete.includes(x.folderId)).map(x=>x.id);
  // Track deleted IDs
  if(!DB.folders_deleted)DB.folders_deleted=[];
  toDelete.forEach(fid=>{if(!DB.folders_deleted.includes(fid))DB.folders_deleted.push(fid);});
  DB.folders=(DB.folders||[]).filter(x=>!toDelete.includes(x.id));
  DB.documents=(DB.documents||[]).filter(x=>!toDelete.includes(x.folderId||''));
  log(fullName(me()),'Deleted folder',f.name);
  toast('Deleted','warn');saveDB();render();
  // Sync to Supabase in background
  const delOps=toDelete.map(fid=>sb.from('doc_folders').delete().eq('id',fid).then(({error})=>{if(error)console.error('delFolder sync:',error.message);}));
  if(docIds.length)delOps.push(sb.from('documents').delete().in('id',docIds).then(({error})=>{if(error)console.error('delDoc sync:',error.message);}));
  Promise.all(delOps).catch(e=>console.error('delFolder:',e));
};

// ── Upload file ──
App._uploadDoc=()=>{
  const scopeTab=S.filters.docScope||'dept';
  // Read scope key from the right filter key based on scope tab
  const scopeKey=S.filters.docScopeKey||(scopeTab==='dept'?S.filters.docDeptKey:S.filters.docLocKey)||null;
  const folderId=S.filters.docFolder||null;
  if(!scopeKey){toast('Select a department or location first','warn');return;}
  openModal(
    '<div class="p-6">'
    +'<div class="flex justify-between mb-4"><h2 class="fd text-xl font-bold">Upload file</h2><button onclick="App.closeModal()" class="text-ink-400">'+ic('x')+'</button></div>'
    +'<div id="ud-dropzone" style="border:2px dashed #D1D5DB;border-radius:16px;padding:32px;text-align:center;cursor:pointer;transition:all .2s;margin-bottom:14px" onclick="document.getElementById(\'ud-file\').click()" ondragover="event.preventDefault();this.style.borderColor=\'#E8785C\';this.style.background=\'#F0FDF4\'" ondragleave="this.style.borderColor=\'#D1D5DB\';this.style.background=\'transparent\'" ondrop="App._handleFileDrop(event)">'
    +'<div style="font-size:32px;margin-bottom:8px">📎</div>'
    +'<div style="font-size:14px;font-weight:600;color:#374151">Click to browse or drag & drop</div>'
    +'<div style="font-size:12px;color:#9CA3AF;margin-top:4px">PDF, Word, Excel, PowerPoint, Images — max 50MB</div>'
    +'<input type="file" id="ud-file" style="display:none" onchange="App._previewUpload(this)" multiple>'
    +'</div>'
    +'<div id="ud-preview" style="display:none;margin-bottom:14px"></div>'
    +'<div id="ud-progress" style="display:none;margin-bottom:14px">'
    +'<div style="font-size:13px;font-weight:600;color:#374151;margin-bottom:6px">Uploading…</div>'
    +'<div style="height:6px;background:#F3F4F6;border-radius:3px;overflow:hidden"><div id="ud-bar" style="height:100%;background:#E8785C;border-radius:3px;width:0%;transition:width .3s"></div></div>'
    +'</div>'
    +'<button id="ud-btn" onclick="App._doUpload()" style="width:100%;padding:12px;border-radius:12px;background:#1C1712;color:#fff;font-weight:700;font-size:15px;border:none;cursor:pointer;display:none">Upload</button>'
    +'</div>',
    'max-w-md'
  );
  App._pendingFiles=null;
};

App._handleFileDrop=(e)=>{
  e.preventDefault();
  document.getElementById('ud-dropzone').style.borderColor='#D1D5DB';
  document.getElementById('ud-dropzone').style.background='transparent';
  App._previewUpload({files:e.dataTransfer.files});
};

App._previewUpload=(input)=>{
  const files=Array.from(input.files||[]);if(!files.length)return;
  App._pendingFiles=files;
  const preview=document.getElementById('ud-preview');
  const btn=document.getElementById('ud-btn');
  if(preview){
    preview.style.display='block';
    preview.innerHTML='<div style="display:flex;flex-direction:column;gap:6px">'+files.map(f=>{
      const ext=(f.name.split('.').pop()||'').toLowerCase();
      const icon=ext==='pdf'?'📄':ext.match(/xlsx?|csv/)?'📊':ext.match(/docx?/)?'📝':'📎';
      return'<div style="display:flex;align-items:center;gap:10px;background:#F6F7F8;border-radius:10px;padding:10px">'
        +'<span style="font-size:20px">'+icon+'</span>'
        +'<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">'+esc(f.name)+'</div>'
        +'<div style="font-size:11px;color:#9CA3AF">'+_fmtSize(f.size)+'</div></div>'
        +'</div>';
    }).join('')+'</div>';
  }
  if(btn)btn.style.display='block';
};

App._doUpload=async()=>{
  const files=App._pendingFiles;if(!files?.length){toast('Select a file','err');return;}
  const btn=document.getElementById('ud-btn');
  const prog=document.getElementById('ud-progress');
  const bar=document.getElementById('ud-bar');
  if(btn)btn.style.display='none';
  if(prog)prog.style.display='block';
  const scopeTab=S.filters.docScope||'dept';
  const scopeKey=S.filters.docScopeKey;
  const folderId=S.filters.docFolder||null;
  let done=0;
  for(const file of files){
    const path=scopeTab+'/'+scopeKey+'/'+(folderId||'root')+'/'+Date.now()+'_'+file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
    const{data,error}=await sb.storage.from('documents').upload(path,file,{cacheControl:'3600',upsert:false});
    if(error){toast('Upload failed: '+error.message,'err');if(btn)btn.style.display='block';if(prog)prog.style.display='none';return;}
    const{data:urlData}=sb.storage.from('documents').getPublicUrl(path);
    if(!DB.documents)DB.documents=[];
    const docObj={id:uid('doc'),name:file.name,folderId,type:scopeTab,scope:scopeKey,url:urlData?.publicUrl||path,storagePath:path,fileType:file.type,fileSize:file.size,uploadedBy:S.uid,uploaderName:fullName(me()),uploadedAt:new Date().toISOString()};
    DB.documents.push(docObj);
    // Insert directly to Supabase so refresh doesn't lose the file
    await sb.from('documents').insert({id:docObj.id,name:docObj.name,folder_id:docObj.folderId||null,type:docObj.type,scope:docObj.scope,url:docObj.url,storage_path:docObj.storagePath,file_type:docObj.fileType,file_size:docObj.fileSize,uploaded_by:docObj.uploadedBy,uploader_name:docObj.uploaderName,uploaded_at:docObj.uploadedAt}).then(({error})=>{if(error)console.error('doc insert:',error.message);}).catch(()=>{});
    done++;
    if(bar)bar.style.width=Math.round(done/files.length*100)+'%';
  }
  log(fullName(me()),'Uploaded '+done+' file(s)',scopeKey);
  toast('Uploaded '+done+' file'+(done>1?'s':''));
  saveDB();closeModal();render();
};

App._downloadDoc=async(id)=>{
  const doc=(DB.documents||[]).find(x=>x.id===id);if(!doc)return;
  if(doc.url&&doc.url.startsWith('http')){
    const a=document.createElement('a');a.href=doc.url;a.download=doc.name;a.target='_blank';a.rel='noopener noreferrer';a.click();return;
  }
  // Signed URL
  const{data,error}=await sb.storage.from('documents').createSignedUrl(doc.storagePath||doc.url,300);
  if(error){toast('Download failed','err');return;}
  const a=document.createElement('a');a.href=data.signedUrl;a.download=doc.name;a.click();
};

App._previewDoc=async(id)=>{
  const doc=(DB.documents||[]).find(x=>x.id===id);if(!doc)return;
  let url=doc.url;
  if(!url?.startsWith('http')){
    const{data,error}=await sb.storage.from('documents').createSignedUrl(doc.storagePath||doc.url,300);
    if(error){toast('Preview failed','err');return;}
    url=data.signedUrl;
  }
  const ext=(doc.name.split('.').pop()||'').toLowerCase();
  if(ext.match(/jpe?g|png|gif|webp/)){
    openModal('<div class="p-4"><div class="flex justify-between mb-3"><h3 class="fd font-bold">'+esc(doc.name)+'</h3><button onclick="App.closeModal()" class="text-ink-400">'+ic('x')+'</button></div><img src="'+url+'" alt="'+esc(doc.name)+'" style="width:100%;border-radius:12px;max-height:70vh;object-fit:contain"/></div>','max-w-2xl');
  } else if(ext==='pdf'){
    window.open(url,'_blank','noopener');
  } else {
    window.open(url,'_blank','noopener');
  }
};

App._delDoc=(id)=>{
  const doc=(DB.documents||[]).find(x=>x.id===id);if(!doc||!confirm('Delete "'+doc.name+'"?'))return;
  if(!DB.documents_deleted)DB.documents_deleted=[];
  if(!DB.documents_deleted.includes(id))DB.documents_deleted.push(id);
  DB.documents=(DB.documents||[]).filter(x=>x.id!==id);
  log(fullName(me()),'Deleted doc',doc.name);toast('Deleted','warn');saveDB();render();
  // Sync to Supabase in background
  sb.from('documents').delete().eq('id',id).then(({error})=>{
    if(error)console.error('delDoc sync:',error.message);
  }).catch(e=>console.error('delDoc:',e));
  if(doc.storagePath)sb.storage.from('documents').remove([doc.storagePath]).catch(()=>{});
};

App._clearOperational=()=>{
  const cats=[
    {key:'submissions',  label:'Submissions',    icon:'✅', desc:'All checklist submission records',    count:()=>DB.submissions.length},
    {key:'checklists',   label:'Checklists',     icon:'☑️', desc:'All checklist configurations',        count:()=>DB.checklists.length},
    {key:'tickets',      label:'Tickets',        icon:'🎫', desc:'All escalation tickets',              count:()=>(DB.tickets||[]).length},
    {key:'approvals',    label:'Approvals',      icon:'✔️', desc:'All approval requests',               count:()=>DB.approvals.length},
    {key:'notifications',label:'Notifications',  icon:'🔔', desc:'All in-app notifications',            count:()=>DB.notifications.length},
    {key:'feedback',     label:'Feedback',       icon:'💬', desc:'All manager feedback',                count:()=>(DB.feedback||[]).length},
    {key:'questions',    label:'Questions',      icon:'❓', desc:'Question library',                    count:()=>(DB.questions||[]).length},
    {key:'documents',    label:'Documents',      icon:'📄', desc:'Documents and folders',               count:()=>(DB.documents||[]).length},
    {key:'audit',        label:'Audit logs',     icon:'📋', desc:'System audit trail',                  count:()=>(DB.audit||[]).length},
    {key:'users',        label:'Users (except you)', icon:'👥', desc:'All user accounts except yours', count:()=>DB.users.filter(u=>u.id!==S.uid).length},
  ];
  const rows=cats.map(cat=>{
    const n=cat.count();
    return '<label id="lbl-clr-'+cat.key+'" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:12px;cursor:pointer;border:1.5px solid #F3F4F6;margin-bottom:6px;transition:all .12s" onmouseover="this.style.background=\'#FAFAFA\'" onmouseout="this.style.background=\'\'">'
      +'<input type="checkbox" id="clr-'+cat.key+'" onchange="this.closest(\'label\').style.borderColor=this.checked?\'#EF4444\':\'#F3F4F6\'" style="width:17px;height:17px;accent-color:#EF4444;cursor:pointer;flex-shrink:0"/>'
      +'<span style="font-size:20px;flex-shrink:0">'+cat.icon+'</span>'
      +'<div style="flex:1;min-width:0">'
      +'<div style="font-size:13px;font-weight:700;color:#1C1712">'+cat.label+'</div>'
      +'<div style="font-size:11px;color:#9CA3AF;margin-top:1px">'+cat.desc+'</div>'
      +'</div>'
      +'<span style="font-size:12px;font-weight:800;background:'+(n?'#FEF2F2':'#F6F7F8')+';color:'+(n?'#DC2626':'#9CA3AF')+';padding:3px 9px;border-radius:20px;flex-shrink:0">'+n+' records</span>'
      +'</label>';
  }).join('');

  openModal(
    '<div style="display:flex;flex-direction:column;max-height:88vh">'
    +'<div style="padding:18px 20px 14px;border-bottom:1px solid #F3F4F6;flex-shrink:0">'
    +'<div style="display:flex;align-items:center;justify-content:space-between">'
    +'<div><div style="font-size:17px;font-weight:800;font-family:var(--font-display)">🧹 Clear Data</div>'
    +'<div style="font-size:12px;color:#9CA3AF;margin-top:2px">Select categories to permanently delete</div></div>'
    +'<button onclick="App.closeModal()" style="width:28px;height:28px;display:grid;place-items:center;border-radius:8px;border:none;background:transparent;cursor:pointer;color:#9CA3AF">'+ic('x')+'</button>'
    +'</div>'
    +'<div style="display:flex;gap:8px;margin-top:12px">'
    +'<button onclick="document.querySelectorAll(\'[id^=clr-]\').forEach(c=>{c.checked=true;document.getElementById(\'lbl-\'+c.id).style.borderColor=\'#EF4444\';})" style="padding:5px 14px;border-radius:8px;border:1.5px solid #E5E7EB;background:#fff;font-size:12px;font-weight:600;cursor:pointer">Select all</button>'
    +'<button onclick="document.querySelectorAll(\'[id^=clr-]\').forEach(c=>{c.checked=false;document.getElementById(\'lbl-\'+c.id).style.borderColor=\'#F3F4F6\';})" style="padding:5px 14px;border-radius:8px;border:1.5px solid #E5E7EB;background:#fff;font-size:12px;font-weight:600;cursor:pointer">Deselect all</button>'
    +'</div>'
    +'</div>'
    +'<div style="overflow-y:auto;flex:1;padding:14px 20px">'+rows+'</div>'
    +'<div style="padding:14px 20px;border-top:1px solid #F3F4F6;flex-shrink:0;display:flex;gap:10px">'
    +'<button onclick="App.closeModal()" style="flex:1;padding:12px;border-radius:12px;border:1.5px solid #E5E7EB;background:#fff;font-weight:600;font-size:14px;cursor:pointer">Cancel</button>'
    +'<button onclick="App._execClear()" style="flex:2;padding:12px;border-radius:12px;background:#EF4444;color:#fff;font-weight:700;font-size:14px;border:none;cursor:pointer">🗑 Delete selected</button>'
    +'</div>'
    +'</div>',
    'max-w-md'
  );
};

App._execClear=async()=>{
  const catMap={
    submissions: {local:()=>{DB.submissions=[];Object.keys(RUN).forEach(k=>delete RUN[k]);},table:'submissions'},
    checklists:  {local:()=>{DB.checklists=[];DB.checklists_deleted=[];},table:'checklists'},
    tickets:     {local:()=>{DB.tickets=[];},table:'tickets'},
    approvals:   {local:()=>{DB.approvals=[];},table:'approvals'},
    notifications:{local:()=>{DB.notifications=[];_invalidateNotifCache();},table:'notifications'},
    feedback:    {local:()=>{DB.feedback=[];},table:'feedback'},
    questions:   {local:()=>{DB.questions=[];DB.questions_deleted=[];},table:'questions'},
    documents:   {local:()=>{DB.documents=[];DB.folders=[];DB.documents_deleted=[];DB.folders_deleted=[];},table:'documents'},
    audit:       {local:()=>{DB.audit=[];},table:'audit_logs'},
    users:       {local:()=>{DB.users=DB.users.filter(u=>u.id===S.uid);},table:'profiles'},
  };
  const sel=Object.keys(catMap).filter(k=>document.getElementById('clr-'+k)?.checked);
  if(!sel.length){toast('Select at least one category','warn');return;}
  const labels=sel.map(k=>catMap[k].table).join(', ');
  if(!confirm('Permanently delete: '+labels+'?\n\nThis cannot be undone.'))return;
  closeModal();
  // Local deletion
  sel.forEach(k=>catMap[k].local());
  // ── Supabase deletion — ORDER MATTERS. The DB integrity guard blocks deleting a question
  //    that is still referenced by a checklist, so everything that references questions must be
  //    removed first. When questions are wiped but checklists are kept, detach the questions
  //    from the surviving checklists so the bulk delete can't be aborted by the guard. ──
  const _blank='00000000-0000-0000-0000-000000000000';
  const _del=k=>sb.from(catMap[k].table).delete().neq('id',_blank).then(()=>{}).catch(()=>{});
  if(sel.includes('questions')&&!sel.includes('checklists')){
    await sb.from('checklists').update({question_ids:[],question_configs:{}}).neq('id',_blank).then(()=>{}).catch(()=>{});
    DB.checklists.forEach(c=>{c.questionIds=[];c.questionConfigs={};});
  }
  if(sel.includes('checklists')) await _del('checklists');
  await Promise.allSettled(sel.filter(k=>k!=='checklists'&&k!=='questions').map(_del));
  if(sel.includes('questions')) await _del('questions');
  log(fullName(me()),'Cleared data',labels);
  toast('Deleted: '+sel.length+' categor'+(sel.length===1?'y':'ies')+' ✓','ok');
  saveDB();S.route='dashboard';render();
};

// ── Notification Settings (NS) — stored in workspace_settings table ──
const NS_LS='shiftly_ns_v2';

// Default templates — subject + body for every event type
// Variables: {{user_name}} {{checklist_name}} {{date}} {{status}} {{manager_name}} {{action_url}} {{app_url}}
const EMAIL_EVENTS=[
  {key:'checklist_assigned',label:'Checklist assigned',  vars:'{{user_name}}, {{checklist_name}}, {{action_url}}'},
  {key:'submission_late',  label:'Submission late',       vars:'{{user_name}}, {{checklist_name}}, {{action_url}}'},
  {key:'submission_approved',label:'Submission approved',vars:'{{user_name}}, {{checklist_name}}, {{action_url}}'},
  {key:'submission_rejected',label:'Submission rejected',vars:'{{user_name}}, {{checklist_name}}, {{action_url}}'},
  {key:'approval_requested',label:'Approval requested',  vars:'{{user_name}}, {{checklist_name}}, {{action_url}}'},
  {key:'approval_decided', label:'Approval decided',     vars:'{{user_name}}, {{checklist_name}}, {{action_url}}'},
  {key:'feedback_received',label:'Feedback received',    vars:'{{user_name}}, {{checklist_name}}, {{action_url}}'},
  {key:'deadline_reminder',label:'Deadline reminder',    vars:'{{user_name}}, {{checklist_name}}, {{action_url}}'},
  {key:'escalation',       label:'Escalation raised',    vars:'{{submitter}}, {{checklist_name}}, {{question}}, {{answer}}, {{action_url}}'},
];

function _defaultTemplates(){
  return{
    checklist_assigned:{subject:'📋 Checklist assigned: {{checklist_name}}',   body:'Hi {{user_name}},\n\nA checklist has been assigned to you: {{checklist_name}}\n\nOpen Bridge to complete it.\n\n{{action_url}}'},
    submission_late:  {subject:'⏰ Late submission: {{checklist_name}}',        body:'Hi {{user_name}},\n\nA submission is overdue: {{checklist_name}}\n\n{{action_url}}'},
    submission_approved:{subject:'✅ Submission approved: {{checklist_name}}',  body:'Hi {{user_name}},\n\nYour submission for {{checklist_name}} has been approved.\n\n{{action_url}}'},
    submission_rejected:{subject:'❌ Submission rejected: {{checklist_name}}',  body:'Hi {{user_name}},\n\nYour submission for {{checklist_name}} has been rejected. Please review and resubmit.\n\n{{action_url}}'},
    approval_requested:{subject:'🔔 Approval needed: {{checklist_name}}',      body:'Hi {{user_name}},\n\nAn approval is pending for {{checklist_name}}.\n\n{{action_url}}'},
    approval_decided: {subject:'Approval update: {{checklist_name}}',          body:'Hi {{user_name}},\n\nYour approval request for {{checklist_name}} has been decided.\n\n{{action_url}}'},
    feedback_received:{subject:'💬 New feedback received',                      body:'Hi {{user_name}},\n\nYou have received new feedback on {{checklist_name}}.\n\n{{action_url}}'},
    deadline_reminder:{subject:'⏳ Reminder: {{checklist_name}} deadline soon', body:'Hi {{user_name}},\n\nYour checklist {{checklist_name}} deadline is approaching soon. Please complete it before the cutoff.\n\n{{action_url}}'},
    escalation:{subject:'⚠️ Escalation: {{checklist_name}}',                    body:'An escalation was raised on {{checklist_name}}.\n\nQuestion: {{question}}\nAnswer: {{answer}}\nRaised by: {{submitter}}\n\nOpen Bridge to follow up.\n\n{{action_url}}'},
    crm_mention:{subject:'💬 You were tagged in {{title}}',body:'Hi {{user_name}},\n\n{{actor}} tagged you in "{{title}}" on the CRM.\n\nOpen Bridge to reply.\n\n{{action_url}}'},
    crm_ticket:{subject:'🎫 New {{type}} ticket: {{title}}',body:'Hi {{user_name}},\n\nA new {{type}} ticket was created: "{{title}}" ({{customer}}).\n\n{{action_url}}'},
    crm_approval:{subject:'✅ Approval needed: {{title}}',body:'Hi {{user_name}},\n\n"{{title}}" ({{customer}}) needs your approval.\n\n{{action_url}}'},
    crm_decided:{subject:'{{decision}}: {{title}}',body:'Hi {{user_name}},\n\n"{{title}}" was {{decision}} by {{actor}}.\n\n{{action_url}}'},
    crm_reminder:{subject:'⏰ Reminder: {{note}}',body:'Hi {{user_name}},\n\nYour reminder is due: {{note}}\n\nConversation: "{{title}}"\n\n{{action_url}}'},
  };
}

function _nsDefault(){return{
  email_enabled:false,email_from_name:'Bridge',email_from_address:'',email_reminder_minutes:15,
  inapp_checklist_assigned:true,inapp_submission_submitted:true,
  inapp_submission_late:true,inapp_submission_approved:true,inapp_submission_rejected:true,
  inapp_approval_requested:true,inapp_approval_decided:true,
  inapp_feedback_received:true,inapp_deadline_reminder:true,
  email_checklist_assigned:true,email_submission_submitted:false,
  email_submission_late:true,email_submission_approved:true,email_submission_rejected:true,
  email_approval_requested:true,email_approval_decided:true,
  email_feedback_received:false,email_deadline_reminder:true,email_escalation:true,
  templates:{},
};}
let _ns=null;
async function _loadNS(){
  if(_ns)return _ns;
  try{const r=localStorage.getItem(NS_LS);if(r)_ns={..._nsDefault(),...JSON.parse(r)};}catch(e){}
  if(!_ns)_ns=_nsDefault();
  try{const{data,error:wsErr}=await sb.from('workspace_settings').select('value').eq('key','notification_settings').single();
      if(wsErr&&(wsErr.code==='42P01'||wsErr.message?.includes('does not exist'))){console.warn('workspace_settings table missing — using defaults');return _ns;}
    if(data?.value){
      const saved=data.value;
      _ns={..._nsDefault(),...saved};
      // Deep-merge templates — spread would overwrite entire templates obj with saved one, which is correct
      // but if saved has no templates key at all, restore empty object
      if(!_ns.templates)_ns.templates={};
      localStorage.setItem(NS_LS,JSON.stringify(_ns));
    }}catch(e){}
  return _ns;
}
async function _saveNS(){
  if(!_ns)return;
  localStorage.setItem(NS_LS,JSON.stringify(_ns));
  try{await sb.from('workspace_settings').upsert({key:'notification_settings',value:_ns,updated_at:new Date().toISOString()},{onConflict:'key'});}catch(e){console.warn('NS sync:',e.message);}
}

// ── Resolve template variables ──
function _fillTemplate(str, vars){
  return str.replace(/\{\{(\w+)\}\}/g,(_,k)=>vars[k]||'');
}

// ── Render plain text body as HTML — {{action_url}} line becomes a CTA button ──
function _bodyToHtml(fromName, bodyText, actionUrl=''){
  const safeName=String(fromName||'Bridge').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
  const rawLines = bodyText.split('\n').map(l=>l.trim());
  // ctaUrl is passed in as 3rd arg — already the resolved URL
  let ctaUrl = actionUrl||'';
  // Strip: the {{action_url}} placeholder, the resolved URL itself (already a button), and any bare https line
  const lines = rawLines
    .filter(l=>l!=='{{action_url}}' && l!==ctaUrl && !/^https?:\/\//.test(l))
    .map(l=>l.replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c])));
  const ctaLabel=ctaUrl.includes('approvals')?'View Approvals'
    :ctaUrl.includes('mychecklists')?'Open My Checklists'
    :ctaUrl.includes('notifications')?'View Notifications'
    :ctaUrl.includes('settings')?'Open Settings'
    :ctaUrl.includes('analytics')?'View Analytics'
    :'Open Bridge';
  return`<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F7F3EC;font-family:sans-serif">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;border:1px solid #ECEDF0;overflow:hidden">
    <div style="background:#1C1712;padding:20px 28px;display:flex;align-items:center;gap:10px">
      <div style="width:28px;height:28px;border-radius:8px;background:#E8785C;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;color:#fff">B</div>
      <span style="font-weight:700;font-size:16px;color:#fff">${safeName}</span>
    </div>
    <div style="padding:28px">
      ${lines.filter(Boolean).map((l,i)=>i===0
        ?`<p style="font-size:15px;color:#374151;margin:0 0 16px">${l}</p>`
        :`<p style="font-size:14px;color:#6B7280;margin:0 0 8px;line-height:1.6">${l}</p>`
      ).join('')}
      ${ctaUrl?`<div style="margin-top:24px">
        <a href="${ctaUrl}" style="display:inline-block;background:#1C1712;color:#fff;font-weight:700;font-size:14px;padding:12px 24px;border-radius:10px;text-decoration:none">${ctaLabel} →</a>
        <p style="margin:10px 0 0;font-size:11px;color:#B8B5AC">Or copy: ${ctaUrl}</p>
      </div>`:''}
    </div>
    <div style="padding:16px 28px;background:#F9F8F5;border-top:1px solid #ECEDF0;font-size:11px;color:#9CA3AF">
      ${safeName} · Automated notification · Do not reply
    </div>
  </div></body></html>`;
}

// ── sendEmail: FAST — calls edge function directly, no queue, no extra DB round trip ──
async function sendEmail(eventType, userId, vars){
  const user = userId ? uById(userId) : null;
  if(!user?.email){console.warn('sendEmail: no email for user',userId);return;}
  if(user.emailEnabled===false) return;
  if(!_ns) await _loadNS();
  if(!_ns.email_enabled) return;
  if(_ns['email_'+eventType]===false) return;
  // Build app URL from current window location
  const appUrl = window.location.origin;
  // Each event type links to the most relevant page
  const routeMap = {
    checklist_assigned:'mychecklists',
    submission_late:'mychecklists', submission_approved:'mychecklists',
    submission_rejected:'mychecklists', approval_requested:'approvals',
    approval_decided:'approvals', feedback_received:'notifications',
    deadline_reminder:'mychecklists', escalation:'tickets',crm_mention:'crm',crm_ticket:'crm',crm_approval:'crm',crm_decided:'crm',crm_reminder:'crm',
  };
  const actionUrl = appUrl + '/#' + (routeMap[eventType]||'');
  const allVars = {user_name:fullName(user), from_name:_ns.email_from_name||'Bridge', app_url:appUrl, action_url:actionUrl, ...vars};
  const defaults = _defaultTemplates();
  const tpl = {
    subject:(_ns.templates?.[eventType]?.subject)||defaults[eventType]?.subject||eventType,
    body:   (_ns.templates?.[eventType]?.body)   ||defaults[eventType]?.body   ||'',
  };
  const subject  = _fillTemplate(tpl.subject, allVars);
  const bodyHtml = _bodyToHtml(_ns.email_from_name, _fillTemplate(tpl.body, allVars), actionUrl);
  sb.functions.invoke('send-notification',{body:{
    to:user.email, from_name:_ns.email_from_name||'Bridge', subject, html:bodyHtml,
  }}).catch(e=>console.warn('sendEmail invoke failed:',e.message));
}


function _nsTogRow(key,label,desc){
  const on=_ns?(_ns[key]!==false):true;
  return`<div style="display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid #F5F4F0">
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;font-weight:600;color:#1C1712">${label}</div>
      ${desc?`<div style="font-size:11px;color:#B8B5AC;margin-top:1px">${desc}</div>`:''}
    </div>
    <button role="switch" aria-checked="${on?'true':'false'}" aria-label="${esc(label)}" class="tog ${on?'on':'off'}" onclick="App._nsTog(this,'${key}')"><span></span></button>
  </div>`;}
App._nsTog=async(btn,key)=>{
  if(!_ns)_ns=_nsDefault();
  const nowOn=btn.classList.contains('off');
  btn.classList.toggle('on',nowOn);btn.classList.toggle('off',!nowOn);
  btn.setAttribute('aria-checked',nowOn?'true':'false');
  _ns[key]=nowOn;await _saveNS();
};
App._nsSaveEmail=async()=>{
  if(!_ns)_ns=_nsDefault();
  const name=($('#ns-from-name')?.value||'').trim();
  const addr=($('#ns-from-addr')?.value||'').trim();
  const mins=parseInt($('#ns-reminder-mins')?.value||'15')||15;
  if(!addr){toast('Enter a from email address','err');return;}
  if(!addr.includes('@')){toast('Enter a valid email address','err');return;}
  _ns.email_from_name=name||'Bridge';_ns.email_from_address=addr;
  _ns.email_reminder_minutes=Math.max(5,Math.min(120,mins));
  await _saveNS();toast('Saved ✓');
};
App._testEmail=async()=>{
  if(!_ns) await _loadNS();
  const u=me();
  if(!u?.email){toast('Your user profile has no email address','err');return;}
  const btn=document.getElementById('ns-test-btn');
  if(btn){btn.disabled=true;btn.textContent='Sending…';}
  try{
    const appUrl=window.location.origin;
    const {error}=await sb.functions.invoke('send-notification',{body:{
      to: u.email,
      from_name: _ns.email_from_name||'Bridge',
      subject: '✅ Bridge test email',
      html: _bodyToHtml(_ns.email_from_name||'Bridge',
        'Hi '+u.firstName+',\n\nThis is a test email from Bridge.\n\nIf you received this, your email setup is working correctly. SMTP is connected and emails will be delivered to users based on their profile email address.',
        appUrl+'/#mychecklists'),
    }});
    if(error)throw new Error(error.message||'Function error');
    toast('Test email sent to '+u.email+' ✓','ok');
  }catch(e){
    toast('Failed: '+e.message,'err');
    console.error('Test email error:',e);
  }finally{
    if(btn){btn.disabled=false;btn.textContent='Send test email';}
  }
};


App._setSTab=(k)=>{S.filters.stab=k;rr();};
function settingsPage(){
  const stab=(S.filters.stab&&S.filters.stab!=='workflow')?S.filters.stab:'inapp';
  if(!_ns){_loadNS().then(()=>rr());return`<div class="fade max-w-2xl">${hdr('Settings','')}<div style="padding:40px;text-align:center;color:#9CA3AF;font-size:13px">Loading…</div></div>`;}
  const ns=_ns;
  // Workflow tab removed (Evarca-aligned): its 4 toggles were saved but never read by any code.
  const TABS=[['inapp','In-App'],['email','Email'],['templates','Templates'],['data','Data']];
  const tabBar=`<div class="ui-tabs" style="margin-bottom:20px">${TABS.map(([k,l])=>`<button class="ui-tab${stab===k?' on':''}" onclick="App._setSTab('${k}')">${l}</button>`).join('')}</div>`;

  const inappTab=`<div class="space-y-4">
    <div class="bg-white rounded-2xl border border-ink-100 shadow-soft" style="overflow:hidden">
      <div style="padding:14px 20px;background:#F9F8F5;border-bottom:1px solid #F0EEE9">
        <div style="font-size:14px;font-weight:700">In-app notifications</div>
        <div style="font-size:12px;color:#9CA3AF;margin-top:2px">Bell icon — shown only to the relevant user</div>
      </div>
      <div style="padding:4px 20px 12px">
        <div style="font-size:10px;font-weight:800;color:#B8B5AC;letter-spacing:.06em;text-transform:uppercase;padding:12px 0 4px">Checklists</div>
        ${_nsTogRow('inapp_checklist_assigned','Checklist assigned','Sent to the user the checklist is assigned to')}
        ${_nsTogRow('inapp_submission_submitted','Submission submitted','Sent to the manager when their team submits')}
        ${_nsTogRow('inapp_submission_late','Submission late','Sent to the manager when a submission is overdue')}
        ${_nsTogRow('inapp_submission_approved','Submission approved','Sent to the user whose submission was approved')}
        ${_nsTogRow('inapp_submission_rejected','Submission rejected','Sent to the user whose submission was rejected')}
        ${_nsTogRow('inapp_deadline_reminder','Deadline reminder','Sent to the user before their task cutoff')}
        <div style="font-size:10px;font-weight:800;color:#B8B5AC;letter-spacing:.06em;text-transform:uppercase;padding:14px 0 4px">Approvals & Feedback</div>
        ${_nsTogRow('inapp_approval_requested','Approval requested','Sent to admin when an approval is pending')}
        ${_nsTogRow('inapp_approval_decided','Approval decided','Sent to the user when their approval is approved/rejected')}
        ${_nsTogRow('inapp_feedback_received','Feedback received','Sent to the user when their manager sends feedback')}
      </div>
    </div>
  </div>`;

  const emailOn=ns.email_enabled!==false;
  const emailTab=`<div class="space-y-4">
    <div class="bg-white rounded-2xl border border-ink-100 shadow-soft" style="overflow:hidden">
      <div style="padding:14px 20px;background:#F9F8F5;border-bottom:1px solid #F0EEE9;display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:14px;font-weight:700">Email notifications</div>
          <div style="font-size:12px;color:#9CA3AF;margin-top:2px">Sends to the email address set on each user's account</div>
        </div>
        <button role="switch" aria-checked="${emailOn?'true':'false'}" aria-label="Email notifications" class="tog ${emailOn?'on':'off'}" onclick="App._nsTog(this,'email_enabled')"><span></span></button>
      </div>
      <div style="padding:16px 20px;border-bottom:1px solid #F0EEE9">
        <div style="font-size:11px;font-weight:700;color:#9CA3AF;letter-spacing:.05em;text-transform:uppercase;margin-bottom:10px">Sender identity</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
          <div>
            <label for="ns-from-name" style="display:block;font-size:11px;font-weight:700;color:#6B7280;margin-bottom:4px">From name</label>
            <input id="ns-from-name" value="${esc(ns.email_from_name||'Bridge')}" placeholder="Bridge"
              style="width:100%;box-sizing:border-box;border:1.5px solid #E5E7EB;border-radius:10px;padding:8px 12px;font-size:13px;outline:none" class="rf"/>
          </div>
          <div>
            <label for="ns-from-addr" style="display:block;font-size:11px;font-weight:700;color:#6B7280;margin-bottom:4px">From address</label>
            <input id="ns-from-addr" type="email" value="${esc(ns.email_from_address||'')}" placeholder="you@company.com"
              style="width:100%;box-sizing:border-box;border:1.5px solid #E5E7EB;border-radius:10px;padding:8px 12px;font-size:13px;outline:none" class="rf"/>
          </div>
        </div>
        <div style="margin-bottom:12px">
          <label for="ns-reminder-mins" style="display:block;font-size:11px;font-weight:700;color:#6B7280;margin-bottom:4px">Reminder lead time (minutes before deadline)</label>
          <input id="ns-reminder-mins" type="number" min="5" max="120" value="${ns.email_reminder_minutes||15}"
            style="width:120px;border:1.5px solid #E5E7EB;border-radius:10px;padding:8px 12px;font-size:13px;outline:none" class="rf"/>
        </div>
        <div style="display:flex;gap:8px">
          <button onclick="App._nsSaveEmail()" style="flex:1;padding:10px;border-radius:11px;background:#1C1712;color:#fff;font-size:13px;font-weight:700;border:none;cursor:pointer" onmouseover="this.style.background='#000'" onmouseout="this.style.background='#1C1712'">Save settings</button>
          <button id="ns-test-btn" onclick="App._testEmail()" style="padding:10px 16px;border-radius:11px;background:#fff;color:#374151;font-size:13px;font-weight:700;border:1.5px solid #E5E7EB;cursor:pointer" onmouseover="this.style.background='#F9F8F5'" onmouseout="this.style.background='#fff'">Send test email</button>
        </div>
      </div>
      <div style="padding:4px 20px 12px">
        <div style="font-size:10px;font-weight:800;color:#B8B5AC;letter-spacing:.06em;text-transform:uppercase;padding:12px 0 4px">Checklists</div>
        ${_nsTogRow('email_checklist_assigned','Checklist assigned','Email sent to the assigned user')}
        ${_nsTogRow('email_submission_late','Submission late','Email sent to the manager')}
        ${_nsTogRow('email_submission_approved','Submission approved','Email sent to the user')}
        ${_nsTogRow('email_submission_rejected','Submission rejected','Email sent to the user')}
        ${_nsTogRow('email_deadline_reminder','Deadline reminder','Email sent to the user before cutoff')}
        <div style="font-size:10px;font-weight:800;color:#B8B5AC;letter-spacing:.06em;text-transform:uppercase;padding:14px 0 4px">Approvals & Feedback</div>
        ${_nsTogRow('email_approval_requested','Approval requested','Email sent to admin')}
        ${_nsTogRow('email_approval_decided','Approval decided','Email sent to the user')}
        ${_nsTogRow('email_feedback_received','Feedback received','Email sent to the user')}
        ${_nsTogRow('email_escalation','Escalation raised','Email sent to the person it escalates to')}
      </div>
    </div>
  </div>`;

  // ── TEMPLATES TAB ──
  const defaults=_defaultTemplates();
  const expandedTpl=S.filters.tplKey||null;
  const templatesTab=`<div class="space-y-2">
    <div style="padding:4px 0 10px">
      <div style="font-size:13px;color:#9CA3AF;line-height:1.6">
        Customise the subject and body for each email. Use these variables anywhere in your text:
        <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">
          ${['{{user_name}}','{{checklist_name}}','{{date}}','{{status}}','{{manager_name}}','{{action_url}}','{{app_url}}'].map(v=>`<code style="background:#F5F4F0;border-radius:6px;padding:2px 8px;font-size:12px;color:#374151">${v}</code>`).join('')}
        </div>
      </div>
    </div>
    ${EMAIL_EVENTS.map(ev=>{
      const tpl={...(defaults[ev.key]||{}), ...(ns.templates?.[ev.key]||{})};
      const open=expandedTpl===ev.key;
      return`<div style="background:#fff;border-radius:14px;border:1.5px solid ${open?'#E8785C':'#ECEDF0'};overflow:hidden;transition:border-color .15s">
        <button onclick="S.filters.tplKey='${open?'':ev.key}';rr()"
          style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:13px 16px;background:transparent;border:none;cursor:pointer;text-align:left">
          <div>
            <div style="font-size:13px;font-weight:700;color:#1C1712">${ev.label}</div>
            <div style="font-size:11px;color:#B8B5AC;margin-top:1px">${ev.vars}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            ${(ns.templates?.[ev.key])?`<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:#FBEAE2;color:#065F46">Custom</span>`:''}
            <span style="color:#B8B5AC;font-size:16px">${open?'▲':'▼'}</span>
          </div>
        </button>
        ${open?`<div style="padding:0 16px 16px;border-top:1px solid #F5F4F0">
          <div style="margin-bottom:10px">
            <label for="tpl-subj-${ev.key}" style="display:block;font-size:11px;font-weight:700;color:#6B7280;margin-bottom:4px;margin-top:12px">Subject</label>
            <input id="tpl-subj-${ev.key}" value="${esc(tpl.subject||'')}" placeholder="Email subject…"
              style="width:100%;box-sizing:border-box;border:1.5px solid #E5E7EB;border-radius:10px;padding:8px 12px;font-size:13px;outline:none" class="rf"/>
          </div>
          <div>
            <label for="tpl-body-${ev.key}" style="display:block;font-size:11px;font-weight:700;color:#6B7280;margin-bottom:4px">Body</label>
            <textarea id="tpl-body-${ev.key}" rows="6"
              style="width:100%;box-sizing:border-box;border:1.5px solid #E5E7EB;border-radius:10px;padding:8px 12px;font-size:13px;outline:none;resize:vertical;font-family:monospace;line-height:1.6" class="rf">${esc(tpl.body||'')}</textarea>
            <div style="font-size:11px;color:#B8B5AC;margin-top:4px">Tip: each line in the body becomes a paragraph in the email.</div>
          </div>
          <div style="display:flex;gap:8px;margin-top:12px">
            <button onclick="App._resetTpl('${ev.key}')"
              style="padding:8px 14px;border-radius:9px;border:1.5px solid #ECEDF0;background:#fff;font-size:12px;font-weight:600;cursor:pointer;color:#9CA3AF">Reset to default</button>
            <button onclick="App._saveTpl('${ev.key}')"
              style="flex:1;padding:8px 14px;border-radius:9px;background:#1C1712;color:#fff;font-size:13px;font-weight:700;border:none;cursor:pointer">Save template</button>
          </div>
        </div>`:''}
      </div>`;
    }).join('')}
  </div>`;

  App._saveTpl=async(key)=>{
    if(!_ns)_ns=_nsDefault();
    if(!_ns.templates)_ns.templates={};
    const subj=($('#tpl-subj-'+key)?.value||'').trim();
    const body=($('#tpl-body-'+key)?.value||'').trim();
    if(!subj||!body){toast('Subject and body required','err');return;}
    _ns.templates[key]={subject:subj,body};
    await _saveNS();
    toast('Template saved ✓');rr();
  };
  App._resetTpl=async(key)=>{
    if(!_ns)_ns=_nsDefault();
    if(_ns.templates)delete _ns.templates[key];
    await _saveNS();
    toast('Reset to default ✓');rr();
  };

  const dataTab=`<div class="space-y-4">
    <div class="bg-white rounded-2xl border border-ink-100 shadow-soft p-5">
      <h3 class="fd font-semibold text-sm mb-3">Export & Reset</h3>
      <div class="flex gap-3 flex-wrap">
        ${btnG('Export CSV','App._exportCSV()','download')}
        <button onclick="App._clearOperational()" style="flex:1;min-width:140px;padding:10px;border-radius:12px;border:1.5px solid #FED7AA;color:#C2410C;background:#fff;font-weight:600;font-size:14px;cursor:pointer" onmouseover="this.style.background='#FFF7ED'" onmouseout="this.style.background='#fff'">🧹 Clear data</button>
        <button onclick="if(confirm('Reset ALL workspace data?')){localStorage.removeItem(window.LS_KEY||'shiftly_v3');location.reload();}" style="flex:1;min-width:140px;padding:10px;border-radius:12px;border:1.5px solid #FECACA;color:#BE123C;background:#fff;font-weight:600;font-size:14px;cursor:pointer" onmouseover="this.style.background='#FFF1F2'" onmouseout="this.style.background='#fff'">Reset workspace</button>
      </div>
    </div>
    <div class="bg-white rounded-2xl border border-ink-100 shadow-soft p-5">
      <h3 class="fd font-semibold text-sm mb-3">Workspace stats</h3>
      <div class="grid grid-cols-4 gap-2 text-center">${[['Users',DB.users.length],['Checklists',DB.checklists.length],['Locations',DB.locations.length],['Submissions',DB.submissions.length]].map(([k,v])=>`<div class="bg-ink-50 rounded-xl p-3"><div class="fd text-xl font-bold">${v}</div><div class="text-[10px] text-ink-400 font-medium">${k}</div></div>`).join('')}</div>
    </div>
  </div>`;

  const content=stab==='inapp'?inappTab:stab==='email'?emailTab:stab==='templates'?templatesTab:dataTab;
  return`<div class="fade max-w-2xl">${hdr('Settings','')}${tabBar}${content}</div>`;
}

App._exportCSV=()=>{
  let subs=DB.submissions;if(!isAdmin())subs=subs.filter(s=>subTree(S.uid).some(u=>u.id===s.userId)||s.userId===S.uid);
  const f=S.filters;const fArr=k=>Array.isArray(f[k])?f[k]:(f[k]?[f[k]]:[]);
  if(fArr('users').length)subs=subs.filter(s=>fArr('users').includes(s.userId));
  if(fArr('deps').length)subs=subs.filter(s=>{const c=clById(s.checklistId);return fArr('deps').includes(c?.department);});
  if(fArr('locs').length)subs=subs.filter(s=>{const c=clById(s.checklistId);return fArr('locs').some(l=>(c?.locationIds||[]).includes(l));});
  if(fArr('stats').length)subs=subs.filter(s=>fArr('stats').includes(s.status));
  if(f.dr1)subs=subs.filter(s=>s.date>=f.dr1);if(f.dr2)subs=subs.filter(s=>s.date<=f.dr2);
  const summaryRows=[['#','User','Email','Phone','Department','Position','Checklist','Dept','Location(s)','Date','Status','Submitted At','Edit Count','Pending Approval','Compliance','Escalations']];
  subs.forEach((s,i)=>{const u=uById(s.userId),c=clById(s.checklistId);if(!u)return;if(!c&&!s.checklistDeleted)return;const clName=c?c.name:'[Deleted checklist]';const clDept=c?c.department||'':'';const clLocs=c?(c.locationIds||[]).map(id=>DB.locations.find(l=>l.id===id)?.name||'').join('; '):'';const _escN=(c&&(c.questionIds||[]).length)?_subEscalationCount(c,s):0;const _compTxt=(c&&(c.questionIds||[]).length)?(_escN>0?'Non-compliant':'Compliant'):'N/A';summaryRows.push([i+1,fullName(u),u.email||'',u.phone||'',u.department||'',u.position||'',clName,clDept,clLocs,s.date,s.status,s.submittedAt?new Date(s.submittedAt).toLocaleString('en-GB'):'',s.editCount||0,s.status==='Pending Approval'?'Yes':'No',_compTxt,_escN]);});
  // Also export question responses as a second sheet
  const qRows=[['Sub #','User','Email','Checklist','Date','Status','Question','Response','Comment','Escalated']];
  subs.forEach((s,si)=>{const u=uById(s.userId),c=clById(s.checklistId);if(!u)return;(s.questionResponses||[]).forEach((qr,qi)=>{const q=(DB.questions||[]).find(x=>x.id===qr.questionId);const _esc=(c&&q&&_qrEscalates(c,q,qr))?'Yes':'';qRows.push([si+1,fullName(u),u.email||'',c?c.name:'[Deleted]',s.date,s.status,q?q.text:'Q'+(qi+1),qr.response!==null&&qr.response!==undefined?String(qr.response):'',qr.comment||'',_esc]);});});
  const all=[...summaryRows,[],['=== QUESTION RESPONSES (one row per response) ==='],[],...qRows];
  const csv=all.map(r=>r.map(v=>{let cell=String(v??'');
    // Neutralize CSV formula injection: cells that begin with = + - @ (or tab/CR)
    // are prefixed with a single quote so spreadsheet apps treat them as text.
    if(/^[=+\-@\t\r]/.test(cell))cell="'"+cell;
    return '"'+cell.replace(/"/g,'""')+'"';}).join(',')).join('\n');
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,﻿'+encodeURIComponent(csv);a.download='bridge_export_'+todayISO()+'.csv';a.click();
  toast('Exported '+subs.length+' submissions ('+(qRows.length-1)+' question responses)');
};

