/* ============================================================
   Bridge — 18-settings-notifications.js  (split from Bridge.html lines 6149-6859)
   Classic script: shares top-level scope with the other /js files.
   Load order matters — see index.html.
   ============================================================ */
/* ===== AUDIT / NOTIF / PROFILE / SETTINGS ===== */

function auditPage(){
  const L=(DB.audit||[]);const q=(S.filters.auditQ||'').toLowerCase().trim();
  const list=q?L.filter(l=>[l.actor,l.action,l.target].some(x=>String(x||'').toLowerCase().includes(q))):L;
  const shown=list.slice(0,500);
  return`<div class="fade">${hdr('Audit Logs',L.length+' entr'+(L.length===1?'y':'ies')+(q?' · '+list.length+' match':'')+' · newest first')}
  <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap"><input id="audit-q" class="ui-input" style="flex:1;min-width:200px" placeholder="Search by person, action or target…" value="${esc(S.filters.auditQ||'')}" oninput="S.filters.auditQ=this.value;App._searchRR('audit-q')"/>${q?`<button onclick="S.filters.auditQ='';rr()" class="ui-btn ui-btn-ghost ui-btn-sm">Clear</button>`:''}</div>
  <div class="bg-white rounded-2xl border border-ink-100 shadow-soft overflow-hidden"><div class="divide-y divide-ink-50 max-h-[70vh] overflow-y-auto">${shown.map(l=>`<div class="px-4 py-3 flex items-center gap-2.5 text-sm"><span class="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0"></span><div class="flex-1 min-w-0"><span class="font-semibold">${esc(l.actor||'')}</span> <span class="text-ink-500">${esc(String(l.action||'').toLowerCase())}</span>${l.target?` <span class="font-medium">${esc(l.target)}</span>`:''}</div><span class="text-[11px] text-ink-300 shrink-0">${l.time?new Date(l.time).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):''}</span></div>`).join('')||empty('audit',q?'No matching entries':'No logs yet','')}${list.length>500?`<div style="padding:10px 16px;font-size:12px;color:var(--c-text-3)">Showing the latest 500 of ${list.length}.</div>`:''}</div></div></div>`;}
App._goNotifFeedback=()=>{S.route="notifications";S.search="";S.expandedCl=null;S.afOpen=null;S.tvUser=null;S.filters={ntab:"Feedback"};render();window.scrollTo(0,0);};

/* v3.23 — the Profile page became the "Profile" tab of Settings (everyone can open Settings now:
   personal tabs for all, workspace-wide tabs for admins). */
/* _profileTab removed in v132.2 — the Profile page (22-profile.js) replaced it. */


function _fmtSize(b){if(!b)return'';if(b<1024)return b+'B';if(b<1048576)return Math.round(b/1024)+'KB';return(b/1048576).toFixed(1)+'MB';}

App._docNav=(id)=>{S.filters.docFolder=id;rr();};  // alias kept for compatibility

App._delFolder=async(id)=>{
  const f=(DB.folders||[]).find(x=>x.id===id);
  if(!f)return;
  if(!_docScopePerm(f.type,f.scope).edit){toast('You don’t have permission to delete folders here','err');return;}
  {const _sub=[];(function _c(fid){_sub.push(fid);(DB.folders||[]).filter(x=>x.parentId===fid).forEach(c=>_c(c.id));})(id);
   const _nSub=_sub.length-1,_nDoc=(DB.documents||[]).filter(x=>_sub.includes(x.folderId)).length;
   if(!(await confirmP({
     title:'Delete folder',
     body:'<b>'+esc(f.name)+'</b> and everything inside it will be permanently deleted.',
     items:[_nSub?('<b>'+_nSub+'</b> sub-folder'+(_nSub===1?'':'s')):'',
            _nDoc?('<b>'+_nDoc+'</b> file'+(_nDoc===1?'':'s')+' — including the stored uploads'):'no files inside'].filter(Boolean),
     confirmLabel:'Delete folder',cancelLabel:'Keep it'})))return;}
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
    +'<div id="ud-dropzone" style="border:2px dashed #D5C9BC;border-radius:16px;padding:32px;text-align:center;cursor:pointer;transition:all .2s;margin-bottom:14px" onclick="document.getElementById(\'ud-file\').click()" ondragover="event.preventDefault();this.style.borderColor=\'#54433C\';this.style.background=\'#F2F7F1\'" ondragleave="this.style.borderColor=\'#D5C9BC\';this.style.background=\'transparent\'" ondrop="App._handleFileDrop(event)">'
    +'<div style="font-size:32px;margin-bottom:8px">📎</div>'
    +'<div style="font-size:14px;font-weight:600;color:#3A312A">Click to browse or drag & drop</div>'
    +'<div style="font-size:12px;color:#A59788;margin-top:4px">PDF, Word, Excel, PowerPoint, Images — max 50MB</div>'
    +'<input type="file" id="ud-file" style="display:none" onchange="App._previewUpload(this)" multiple>'
    +'</div>'
    +'<div id="ud-preview" style="display:none;margin-bottom:14px"></div>'
    +'<div id="ud-progress" style="display:none;margin-bottom:14px">'
    +'<div style="font-size:13px;font-weight:600;color:#3A312A;margin-bottom:6px">Uploading…</div>'
    +'<div style="height:6px;background:#F4F0EA;border-radius:3px;overflow:hidden"><div id="ud-bar" style="height:100%;background:#54433C;border-radius:3px;width:0%;transition:width .3s"></div></div>'
    +'</div>'
    +'<button id="ud-btn" onclick="App._doUpload()" style="width:100%;padding:12px;border-radius:12px;background:#13171B;color:#fff;font-weight:700;font-size:15px;border:none;cursor:pointer;display:none">Upload</button>'
    +'</div>',
    'max-w-md'
  );
  App._pendingFiles=null;
};

App._handleFileDrop=(e)=>{
  e.preventDefault();
  document.getElementById('ud-dropzone').style.borderColor='#D5C9BC';
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
      return'<div style="display:flex;align-items:center;gap:10px;background:#F7F3EE;border-radius:10px;padding:10px">'
        +'<span style="font-size:20px">'+icon+'</span>'
        +'<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">'+esc(f.name)+'</div>'
        +'<div style="font-size:11px;color:#A59788">'+_fmtSize(f.size)+'</div></div>'
        +'</div>';
    }).join('')+'</div>';
  }
  if(btn)btn.style.display='block';
};

App._doUpload=async()=>{
  const files=App._pendingFiles;if(!files?.length){toast('Select a file','err');return;}
  if(!_docScopePerm(S.filters.docScope||'dept',S.filters.docScopeKey).upload){toast('You don’t have permission to upload here','err');return;}
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

App._delDoc=async(id)=>{
  const doc=(DB.documents||[]).find(x=>x.id===id);if(!doc)return;
  if(!_docScopePerm(doc.type,doc.scope).edit){toast('You don’t have permission to delete files here','err');return;}
  if(!(await confirmP({
    title:'Delete file',
    body:'<b>'+esc(doc.name)+'</b> will be permanently deleted for everyone who can see this folder.',
    confirmLabel:'Delete file',cancelLabel:'Keep it'})))return;
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

/* `pre` (v3.14) re-ticks the given category keys — used when the delete confirmation is
   cancelled, so the dialog comes back exactly as the user had it instead of blank. */
App._clearOperational=(pre)=>{
  if(!can('settings','manage')){toast('You need Settings → Manage','err');return;}
  const _pre=Array.isArray(pre)?pre:[];
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
    const _on=_pre.indexOf(cat.key)>=0;
    return '<label id="lbl-clr-'+cat.key+'" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:12px;cursor:pointer;border:1.5px solid '+(_on?'#C25441':'#F4F0EA')+';margin-bottom:6px;transition:all .12s" onmouseover="this.style.background=\'#FAF7F3\'" onmouseout="this.style.background=\'\'">'
      +'<input type="checkbox" id="clr-'+cat.key+'"'+(_on?' checked':'')+' onchange="this.closest(\'label\').style.borderColor=this.checked?\'#C25441\':\'#F4F0EA\'" style="width:17px;height:17px;accent-color:#C25441;cursor:pointer;flex-shrink:0"/>'
      +'<span style="font-size:20px;flex-shrink:0">'+cat.icon+'</span>'
      +'<div style="flex:1;min-width:0">'
      +'<div style="font-size:13px;font-weight:700;color:#13171B">'+cat.label+'</div>'
      +'<div style="font-size:11px;color:#A59788;margin-top:1px">'+cat.desc+'</div>'
      +'</div>'
      +'<span style="font-size:12px;font-weight:800;background:'+(n?'#FAEDE8':'#F7F3EE')+';color:'+(n?'#B3402E':'#A59788')+';padding:3px 9px;border-radius:20px;flex-shrink:0">'+n+' records</span>'
      +'</label>';
  }).join('');

  openModal(
    '<div style="display:flex;flex-direction:column;max-height:88vh">'
    +'<div style="padding:18px 20px 14px;border-bottom:1px solid #F4F0EA;flex-shrink:0">'
    +'<div style="display:flex;align-items:center;justify-content:space-between">'
    +'<div><div style="font-size:17px;font-weight:800;font-family:var(--font-display)">🧹 Clear Data</div>'
    +'<div style="font-size:12px;color:#A59788;margin-top:2px">Select categories to permanently delete</div></div>'
    +'<button onclick="App.closeModal()" style="width:28px;height:28px;display:grid;place-items:center;border-radius:8px;border:none;background:transparent;cursor:pointer;color:#A59788">'+ic('x')+'</button>'
    +'</div>'
    +'<div style="display:flex;gap:8px;margin-top:12px">'
    +'<button onclick="document.querySelectorAll(\'[id^=clr-]\').forEach(c=>{c.checked=true;document.getElementById(\'lbl-\'+c.id).style.borderColor=\'#C25441\';})" style="padding:5px 14px;border-radius:8px;border:1.5px solid #E6DED3;background:#fff;font-size:12px;font-weight:600;cursor:pointer">Select all</button>'
    +'<button onclick="document.querySelectorAll(\'[id^=clr-]\').forEach(c=>{c.checked=false;document.getElementById(\'lbl-\'+c.id).style.borderColor=\'#F4F0EA\';})" style="padding:5px 14px;border-radius:8px;border:1.5px solid #E6DED3;background:#fff;font-size:12px;font-weight:600;cursor:pointer">Deselect all</button>'
    +'</div>'
    +'</div>'
    +'<div style="overflow-y:auto;flex:1;padding:14px 20px">'+rows+'</div>'
    +'<div style="padding:14px 20px;border-top:1px solid #F4F0EA;flex-shrink:0;display:flex;gap:10px">'
    +'<button onclick="App.closeModal()" style="flex:1;padding:12px;border-radius:12px;border:1.5px solid #E6DED3;background:#fff;font-weight:600;font-size:14px;cursor:pointer">Cancel</button>'
    +'<button onclick="App._execClear()" style="flex:2;padding:12px;border-radius:12px;background:#C25441;color:#fff;font-weight:700;font-size:14px;border:none;cursor:pointer">🗑 Delete selected</button>'
    +'</div>'
    +'</div>',
    'max-w-md'
  );
};

App._execClear=async()=>{
  if(!can('settings','manage')){toast('You need Settings → Manage','err');return;}
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
  // The confirm takes over the single modal slot this Clear-Data dialog is using, so on
  // Cancel put the dialog back — otherwise saying "no" also throws away every category
  // the user had just ticked and they have to start again.
  if(!(await confirmP({
    title:'Permanently clear workspace data',
    body:'Everything in the selected categories will be deleted from the database, for every user.',
    items:sel.map(k=>'<b>'+esc(catMap[k].table)+'</b>'),
    note:'This cannot be undone and there is no backup.',
    confirmLabel:'Delete it all',cancelLabel:'Cancel',size:'max-w-md'})))return App._clearOperational(sel);
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
  log(fullName(me()),'Cleared data',sel.join(', '));
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
  {key:'okr_assigned',      label:'OKR assigned',          vars:'{{user_name}}, {{okr_title}}, {{assigner}}, {{target}}, {{schedule}}, {{period}}, {{action_url}}'},
  {key:'okr_checkin_due',   label:'OKR check-in due (daily)',vars:'{{user_name}}, {{count}}, {{date}}, {{okr_titles}}, {{action_url}}'},
  {key:'okr_update_added',  label:'OKR update added',      vars:'{{user_name}}, {{okr_title}}, {{actor}}, {{value}}, {{comment}}, {{action_url}}'},
  {key:'okr_target_revised',label:'OKR target revised',    vars:'{{user_name}}, {{okr_title}}, {{actor}}, {{old_target}}, {{new_target}}, {{reason}}, {{action_url}}'},
  {key:'okr_closed',        label:'OKR closed / reopened', vars:'{{user_name}}, {{okr_title}}, {{actor}}, {{status}}, {{reason}}, {{action_url}}'},
  /* Workspace. These templates already existed and were honoured by sendEmail, but were
     absent from this list, so nothing rendered an editor for them. */
  {key:'crm_automation',label:'Workspace automation (all boards)',vars:'{{user_name}}, {{rule}}, {{title}}, {{customer}}, {{board}}, {{status}}, {{priority}}, {{assignee}}, {{due_date}}, {{actor}}, {{action_url}}'},
  {key:'crm_ticket',    label:'Workspace ticket activity',        vars:'{{user_name}}, {{title}}, {{customer}}, {{type}}, {{action_url}}'},
  {key:'crm_mention',   label:'Workspace chat mention',           vars:'{{user_name}}, {{actor}}, {{title}}, {{action_url}}'},
  {key:'crm_approval',  label:'Workspace approval needed',        vars:'{{user_name}}, {{title}}, {{customer}}, {{action_url}}'},
  {key:'crm_decided',   label:'Workspace approval decided',       vars:'{{user_name}}, {{title}}, {{decision}}, {{actor}}, {{action_url}}'},
  /* v132 — attendance, direct messages, people */
  {key:'attendance_reminder',label:'Attendance reminders (clock in / out, auto clock-out)',vars:'{{user_name}}, {{action_url}} — the server job sends these; edit wording here'},
  {key:'attendance_wfh',     label:'Work-from-home day (to the manager)',vars:'{{user_name}} (manager), {{wfh_user}}, {{date}}, {{action_url}}'},
  {key:'attendance_edited',  label:'Attendance edited by a manager',     vars:'{{user_name}}, {{actor}}, {{date}}, {{reason}}, {{action_url}}'},
  {key:'dm_message',         label:'Direct message received',            vars:'{{user_name}}, {{actor}}, {{preview}}, {{action_url}}'},
  {key:'people_event',       label:'Birthdays, anniversaries & document expiry',vars:'{{user_name}}, {{text}}, {{action_url}}'},
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
    crm_mention:{subject:'💬 You were tagged in {{title}}',body:'Hi {{user_name}},\n\n{{actor}} tagged you in "{{title}}" on the Workspace.\n\nOpen Bridge to reply.\n\n{{action_url}}'},
    crm_automation:{subject:'⚡ {{rule}} — {{title}}',body:'Hi {{user_name}},\n\nThe automation "{{rule}}" ran on {{board}}.\n\nTicket: {{title}}\nCustomer: {{customer}}\nStatus: {{status}}\nPriority: {{priority}}\nAssigned to: {{assignee}}\nDue: {{due_date}}\n\n{{action_url}}'},
    crm_ticket:{subject:'🎫 New {{type}} ticket: {{title}}',body:'Hi {{user_name}},\n\nA new {{type}} ticket was created: "{{title}}" ({{customer}}).\n\n{{action_url}}'},
    crm_approval:{subject:'✅ Approval needed: {{title}}',body:'Hi {{user_name}},\n\n"{{title}}" ({{customer}}) needs your approval.\n\n{{action_url}}'},
    crm_decided:{subject:'{{decision}}: {{title}}',body:'Hi {{user_name}},\n\n"{{title}}" was {{decision}} by {{actor}}.\n\n{{action_url}}'},
    crm_reminder:{subject:'Reminder: {{note}}',body:'Hi {{user_name}},\n\nYour reminder is due: {{note}}\n\nConversation: "{{title}}"\n\n{{action_url}}'},
    okr_assigned:{subject:'🎯 New OKR assigned: {{okr_title}}',body:'Hi {{user_name}},\n\n{{assigner}} assigned you an objective: {{okr_title}}\n\nTarget: {{target}}\nCheck-ins: {{schedule}}\nPeriod: {{period}}\n\nIf the objective has several owners, any one of you can submit an update — it counts for the whole group.\n\n{{action_url}}'},
    okr_checkin_due:{subject:'⏰ OKR check-in due today ({{count}})',body:'Hi {{user_name}},\n\nYou have {{count}} OKR check-in(s) scheduled for today ({{date}}):\n\n{{okr_titles}}\n\nOpen Bridge to submit your update — if a co-owner already submitted, you\'re covered.\n\n{{action_url}}'},
    okr_update_added:{subject:'📈 {{okr_title}} — updated by {{actor}}',body:'Hi {{user_name}},\n\n{{actor}} added an update on "{{okr_title}}": {{value}}\n\n{{comment}}\n\nThis counts for the whole owner group — nothing more to do for today\'s check-in.\n\n{{action_url}}'},
    okr_target_revised:{subject:'✏️ Target revised: {{okr_title}}',body:'Hi {{user_name}},\n\n{{actor}} revised the target on "{{okr_title}}": {{old_target}} → {{new_target}}\n\nReason: {{reason}}\n\nThe original target stays visible for comparison — the same updates feed both numbers.\n\n{{action_url}}'},
    okr_closed:{subject:'🔒 OKR {{status}}: {{okr_title}}',body:'Hi {{user_name}},\n\n{{actor}} {{status}} the objective "{{okr_title}}".\n\n{{reason}}\n\n{{action_url}}'},
    attendance_reminder:{subject:'⏰ Attendance reminder',body:'Hi {{user_name}},\n\nThis is your attendance reminder from Bridge. Open My Day to clock in or out.\n\n{{action_url}}'},
    attendance_wfh:{subject:'🏠 {{wfh_user}} is working from home today',body:'Hi {{user_name}},\n\n{{wfh_user}} marked {{date}} as a work-from-home day.\n\n{{action_url}}'},
    attendance_edited:{subject:'✏️ Your attendance for {{date}} was edited',body:'Hi {{user_name}},\n\n{{actor}} edited your attendance for {{date}}.\n\nReason: {{reason}}\n\n{{action_url}}'},
    dm_message:{subject:'💬 New message from {{actor}}',body:'Hi {{user_name}},\n\n{{actor}} sent you a message on Bridge:\n\n"{{preview}}"\n\n{{action_url}}'},
    people_event:{subject:'🎉 {{text}}',body:'Hi {{user_name}},\n\n{{text}}\n\n{{action_url}}'},
  };
}

function _nsDefault(){return{
  email_enabled:false,email_from_name:'Bridge',email_from_address:'',email_reminder_minutes:15,
  inapp_checklist_assigned:true,inapp_submission_submitted:true,
  inapp_submission_late:true,inapp_submission_approved:true,inapp_submission_rejected:true,
  inapp_approval_requested:true,inapp_approval_decided:true,
  inapp_feedback_received:true,inapp_deadline_reminder:true,inapp_crm_message:true,
  email_checklist_assigned:true,email_submission_submitted:false,
  email_submission_late:true,email_submission_approved:true,email_submission_rejected:true,
  email_approval_requested:true,email_approval_decided:true,
  email_feedback_received:false,email_deadline_reminder:true,email_escalation:true,
  inapp_okr_assigned:true,inapp_okr_update_added:true,inapp_okr_target_revised:true,inapp_okr_closed:true,
  email_okr_assigned:true,email_okr_checkin_due:true,email_okr_update_added:false,email_okr_target_revised:true,email_okr_closed:true,
  inapp_attendance_reminder:true,inapp_attendance_wfh:true,inapp_attendance_edited:true,inapp_dm_message:true,inapp_people_event:true,
  email_attendance_reminder:true,email_attendance_wfh:true,email_attendance_edited:true,email_dm_message:false,email_people_event:true,
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
  try{_ns.app_url=window.location.origin;}catch(e){} // the okr-reminders schedule reads this for email links
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
    :ctaUrl.includes('okr')?'Open OKRs'
    :'Open Bridge';
  return`<!DOCTYPE html><html><body style="margin:0;padding:0;background:#FAF7F1;font-family:sans-serif">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;border:1px solid #EDE7DC;overflow:hidden">
    <div style="background:#13171B;padding:20px 28px;display:flex;align-items:center;gap:10px">
      <div style="width:28px;height:28px;border-radius:8px;background:#54433C;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;color:#fff">B</div>
      <span style="font-weight:700;font-size:16px;color:#fff">${safeName}</span>
    </div>
    <div style="padding:28px">
      ${lines.filter(Boolean).map((l,i)=>i===0
        ?`<p style="font-size:15px;color:#3A312A;margin:0 0 16px">${l}</p>`
        :`<p style="font-size:14px;color:#786A5F;margin:0 0 8px;line-height:1.6">${l}</p>`
      ).join('')}
      ${ctaUrl?`<div style="margin-top:24px">
        <a href="${ctaUrl}" style="display:inline-block;background:#13171B;color:#fff;font-weight:700;font-size:14px;padding:12px 24px;border-radius:10px;text-decoration:none">${ctaLabel} →</a>
        <p style="margin:10px 0 0;font-size:11px;color:#A8998A">Or copy: ${ctaUrl}</p>
      </div>`:''}
    </div>
    <div style="padding:16px 28px;background:#F5F1EB;border-top:1px solid #EDE7DC;font-size:11px;color:#A59788">
      ${safeName} · Automated notification · Do not reply
    </div>
  </div></body></html>`;
}

// ── sendEmail: FAST — calls edge function directly, no queue, no extra DB round trip ──
async function sendEmail(eventType, userId, vars){
  const user = userId ? uById(userId) : null;
  if(!user?.email){console.warn('sendEmail: no email for user',userId);return;}
  if(user.emailEnabled===false) return;
  try{var _k=({crm_mention:'mention',crm_ticket:'ticket',crm_moved:'ticket',crm_decided:'ticket',crm_created:'ticket',crm_reminder:'reminder',deadline_reminder:'reminder',escalation:'escalation',feedback_received:'feedback',checklist_assigned:'checklist',submission_submitted:'checklist',submission_late:'checklist',submission_approved:'checklist',submission_rejected:'checklist',approval_requested:'approval',approval_decided:'approval',attendance_reminder:'attendance',attendance_wfh:'attendance',attendance_edited:'attendance',dm_message:'dm',people_event:'people'})[eventType]||(String(eventType).indexOf('okr_')===0?'okr':'general');
    var _np=user.notifyPrefs||{};var _c=_np.channels&&_np.channels[_k];if(_c&&_c.email===false)return;}catch(e){}
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
    deadline_reminder:'mychecklists', escalation:'tickets',crm_mention:'crm',crm_ticket:'crm',crm_approval:'crm',crm_decided:'crm',crm_reminder:'crm',crm_automation:'crm',
    okr_assigned:'okr',okr_checkin_due:'okr',okr_update_added:'okr',okr_target_revised:'okr',okr_closed:'okr',
    attendance_reminder:'home',attendance_wfh:'attendance',attendance_edited:'attendance',dm_message:'workspace',people_event:'profile',
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
  return`<div style="display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid #F1ECE3">
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;font-weight:600;color:#13171B">${label}</div>
      ${desc?`<div style="font-size:11px;color:#A8998A;margin-top:1px">${desc}</div>`:''}
    </div>
    <button role="switch" aria-checked="${on?'true':'false'}" aria-label="${esc(label)}" class="tog ${on?'on':'off'}" onclick="App._nsTog(this,'${key}')"><span></span></button>
  </div>`;}
App._nsTog=async(btn,key)=>{
  if(!can('settings','edit')){toast('You need Settings → Edit','err');return;}
  if(!_ns)_ns=_nsDefault();
  const nowOn=btn.classList.contains('off');
  btn.classList.toggle('on',nowOn);btn.classList.toggle('off',!nowOn);
  btn.setAttribute('aria-checked',nowOn?'true':'false');
  _ns[key]=nowOn;await _saveNS();
};
App._nsSaveEmail=async()=>{
  if(!can('settings','edit'))return toast('You need Settings → Edit','err');
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
function settingsPage(forceTab){
  const admin=can('settings','view');
  const TABS=[['mynotif','My notifications']].concat(admin?[['inapp','In-App'],['email','Email'],['templates','Templates']]:[]);
  let stab=forceTab||S.filters.stab||(admin?'inapp':'mynotif');if(stab==='profile'){stab=S.filters.stab='mynotif';}   /* v132: Profile is its own page now */
  if(!TABS.some(t=>t[0]===stab))stab=admin?'inapp':'mynotif';
  const tabBar=`<div class="ui-tabs" style="margin-bottom:20px">${TABS.map(([k,l])=>`<button class="ui-tab${stab===k?' on':''}" onclick="App._setSTab('${k}')">${l}</button>`).join('')}</div>`;
  if(stab==='mynotif')return`<div class="fade max-w-2xl">${hdr('Settings','')}${tabBar}<div>${window.BBNotify?BBNotify.settingsHTML():(typeof _bbMyNotifCard==='function'?_bbMyNotifCard():'')}</div></div>`;
  if(!_ns){_loadNS().then(()=>rr());return`<div class="fade max-w-2xl">${hdr('Settings','')}${tabBar}<div style="padding:40px;text-align:center;color:#A59788;font-size:13px">Loading…</div></div>`;}
  const ns=_ns;

  const inappTab=`<div class="space-y-4">
    <div class="bg-white rounded-2xl border border-ink-100 shadow-soft" style="overflow:hidden">
      <div style="padding:14px 20px;background:#F5F1EB;border-bottom:1px solid #EEE8DE">
        <div style="font-size:14px;font-weight:700">In-app notifications</div>
        <div style="font-size:12px;color:#A59788;margin-top:2px">Bell icon — shown only to the relevant user</div>
      </div>
      <div style="padding:4px 20px 12px">
        <div style="font-size:10px;font-weight:800;color:#A8998A;letter-spacing:.06em;text-transform:uppercase;padding:12px 0 4px">Checklists</div>
        ${_nsTogRow('inapp_checklist_assigned','Checklist assigned','Sent to the user the checklist is assigned to')}
        ${_nsTogRow('inapp_submission_submitted','Submission submitted','Sent to the manager when their team submits')}
        ${_nsTogRow('inapp_submission_late','Submission late','Sent to the manager when a submission is overdue')}
        ${_nsTogRow('inapp_submission_approved','Submission approved','Sent to the user whose submission was approved')}
        ${_nsTogRow('inapp_submission_rejected','Submission rejected','Sent to the user whose submission was rejected')}
        ${_nsTogRow('inapp_deadline_reminder','Deadline reminder','Sent to the user before their task cutoff')}
        <div style="font-size:10px;font-weight:800;color:#A8998A;letter-spacing:.06em;text-transform:uppercase;padding:14px 0 4px">Approvals & Feedback</div>
        ${_nsTogRow('inapp_approval_requested','Approval requested','Sent to admin when an approval is pending')}
        ${_nsTogRow('inapp_approval_decided','Approval decided','Sent to the user when their approval is approved/rejected')}
        ${_nsTogRow('inapp_feedback_received','Feedback received','Sent to the user when their manager sends feedback')}
        <div style="font-size:10px;font-weight:800;color:#A8998A;letter-spacing:.06em;text-transform:uppercase;padding:14px 0 4px">Workspace</div>
        ${_nsTogRow('inapp_crm_message','Every Workspace message','Board & channel members are alerted for each message (each person can switch their own off in Profile → My notifications)')}
        ${_nsTogRow('inapp_crm_mention','Tagged in Workspace chat','When someone @mentions you in a conversation')}
        ${_nsTogRow('inapp_crm_ticket','Workspace ticket activity','Created, assigned, moved & automation alerts')}
        ${_nsTogRow('inapp_crm_reminder','Workspace reminders','Reminders scheduled by board automations (date & time)')}
        <div style="font-size:10px;font-weight:800;color:#A8998A;letter-spacing:.06em;text-transform:uppercase;padding:14px 0 4px">OKRs</div>
        ${_nsTogRow('inapp_okr_assigned','OKR assigned','Sent to every owner when an objective is assigned to them')}
        ${_nsTogRow('inapp_okr_update_added','OKR update added','Sent to co-owners when someone submits the group\'s check-in')}
        ${_nsTogRow('inapp_okr_target_revised','OKR target revised','Sent to the owners when a target is revised')}
        ${_nsTogRow('inapp_okr_closed','OKR closed / reopened','Sent to the owners when an objective is closed or reopened')}
        <div style="font-size:10px;font-weight:800;color:#A8998A;letter-spacing:.06em;text-transform:uppercase;padding:14px 0 4px">Attendance</div>
        ${_nsTogRow('inapp_attendance_reminder','Clock-in / clock-out reminders & auto clock-out','Server-side reminders after shift start / end, and the note when someone is clocked out automatically')}
        ${_nsTogRow('inapp_attendance_wfh','Work-from-home day → manager','Tell the manager when someone marks a WFH day')}
        ${_nsTogRow('inapp_attendance_edited','Attendance edited','Tell the person when a manager edits or adds one of their entries')}
        <div style="font-size:10px;font-weight:800;color:#A8998A;letter-spacing:.06em;text-transform:uppercase;padding:14px 0 4px">Direct messages & people</div>
        ${_nsTogRow('inapp_dm_message','Direct messages','New private messages (each person can silence their own in My notifications)')}
        ${_nsTogRow('inapp_people_event','Birthdays, anniversaries & document expiry','To the manager (and the person, for documents) — 30 / 7 / 0 days before expiry')}
      </div>
    </div>
  </div>`;

  const emailOn=ns.email_enabled!==false;
  const emailTab=`<div class="space-y-4">
    <div class="bg-white rounded-2xl border border-ink-100 shadow-soft" style="overflow:hidden">
      <div style="padding:14px 20px;background:#F5F1EB;border-bottom:1px solid #EEE8DE;display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:14px;font-weight:700">Email notifications</div>
          <div style="font-size:12px;color:#A59788;margin-top:2px">Sends to the email address set on each user's account</div>
        </div>
        <button role="switch" aria-checked="${emailOn?'true':'false'}" aria-label="Email notifications" class="tog ${emailOn?'on':'off'}" onclick="App._nsTog(this,'email_enabled')"><span></span></button>
      </div>
      <div style="padding:16px 20px;border-bottom:1px solid #EEE8DE">
        <div style="font-size:11px;font-weight:700;color:#A59788;letter-spacing:.05em;text-transform:uppercase;margin-bottom:10px">Sender identity</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
          <div>
            <label for="ns-from-name" style="display:block;font-size:11px;font-weight:700;color:#786A5F;margin-bottom:4px">From name</label>
            <input id="ns-from-name" value="${esc(ns.email_from_name||'Bridge')}" placeholder="Bridge"
              style="width:100%;box-sizing:border-box;border:1.5px solid #E6DED3;border-radius:10px;padding:8px 12px;font-size:13px;outline:none" class="rf"/>
          </div>
          <div>
            <label for="ns-from-addr" style="display:block;font-size:11px;font-weight:700;color:#786A5F;margin-bottom:4px">From address</label>
            <input id="ns-from-addr" type="email" value="${esc(ns.email_from_address||'')}" placeholder="you@company.com"
              style="width:100%;box-sizing:border-box;border:1.5px solid #E6DED3;border-radius:10px;padding:8px 12px;font-size:13px;outline:none" class="rf"/>
          </div>
        </div>
        <div style="margin-bottom:12px">
          <label for="ns-reminder-mins" style="display:block;font-size:11px;font-weight:700;color:#786A5F;margin-bottom:4px">Reminder lead time (minutes before deadline)</label>
          <input id="ns-reminder-mins" type="number" min="5" max="120" value="${ns.email_reminder_minutes||15}"
            style="width:120px;border:1.5px solid #E6DED3;border-radius:10px;padding:8px 12px;font-size:13px;outline:none" class="rf"/>
        </div>
        <div style="display:flex;gap:8px">
          <button onclick="App._nsSaveEmail()" style="flex:1;padding:10px;border-radius:11px;background:#13171B;color:#fff;font-size:13px;font-weight:700;border:none;cursor:pointer" onmouseover="this.style.background='#000'" onmouseout="this.style.background='#13171B'">Save settings</button>
          <button id="ns-test-btn" onclick="App._testEmail()" style="padding:10px 16px;border-radius:11px;background:#fff;color:#3A312A;font-size:13px;font-weight:700;border:1.5px solid #E6DED3;cursor:pointer" onmouseover="this.style.background='#F5F1EB'" onmouseout="this.style.background='#fff'">Send test email</button>
        </div>
      </div>
      <div style="padding:4px 20px 12px">
        <div style="font-size:10px;font-weight:800;color:#A8998A;letter-spacing:.06em;text-transform:uppercase;padding:12px 0 4px">Checklists</div>
        ${_nsTogRow('email_checklist_assigned','Checklist assigned','Email sent to the assigned user')}
        ${_nsTogRow('email_submission_late','Submission late','Email sent to the manager')}
        ${_nsTogRow('email_submission_approved','Submission approved','Email sent to the user')}
        ${_nsTogRow('email_submission_rejected','Submission rejected','Email sent to the user')}
        ${_nsTogRow('email_deadline_reminder','Deadline reminder','Email sent to the user before cutoff')}
        <div style="font-size:10px;font-weight:800;color:#A8998A;letter-spacing:.06em;text-transform:uppercase;padding:14px 0 4px">Approvals & Feedback</div>
        ${_nsTogRow('email_approval_requested','Approval requested','Email sent to admin')}
        ${_nsTogRow('email_approval_decided','Approval decided','Email sent to the user')}
        ${_nsTogRow('email_feedback_received','Feedback received','Email sent to the user')}
        ${_nsTogRow('email_escalation','Escalation raised','Email sent to the person it escalates to')}
        <div style="font-size:10px;font-weight:800;color:#A8998A;letter-spacing:.06em;text-transform:uppercase;padding:14px 0 4px">Workspace</div>
        ${_nsTogRow('email_crm_mention','Tagged in Workspace chat','Email when someone @mentions you')}
        ${_nsTogRow('email_crm_ticket','Workspace ticket activity','Email for created / assigned / automation alerts')}
        ${_nsTogRow('email_crm_reminder','Workspace reminders','Email for reminders scheduled by board automations')}
        <div style="font-size:10px;font-weight:800;color:#A8998A;letter-spacing:.06em;text-transform:uppercase;padding:14px 0 4px">OKRs</div>
        ${_nsTogRow('email_okr_assigned','OKR assigned','Email to every owner when an objective is assigned to them')}
        ${_nsTogRow('email_okr_checkin_due','OKR check-in due (daily)','Sent automatically every morning (server schedule) to owners with a check-in due that day')}
        ${_nsTogRow('email_okr_update_added','OKR update added','Email to co-owners when someone submits the group\'s check-in')}
        ${_nsTogRow('email_okr_target_revised','OKR target revised','Email to the owners when a target is revised')}
        ${_nsTogRow('email_okr_closed','OKR closed / reopened','Email to the owners when an objective is closed or reopened')}
        <div style="font-size:10px;font-weight:800;color:#A8998A;letter-spacing:.06em;text-transform:uppercase;padding:14px 0 4px">Attendance</div>
        ${_nsTogRow('email_attendance_reminder','Clock-in / clock-out reminders','Email with the reminder (server job, honours each person’s Attendance → Email switch)')}
        ${_nsTogRow('email_attendance_wfh','Work-from-home day → manager','Email the manager when someone marks a WFH day')}
        ${_nsTogRow('email_attendance_edited','Attendance edited','Email the person when a manager edits their entry')}
        <div style="font-size:10px;font-weight:800;color:#A8998A;letter-spacing:.06em;text-transform:uppercase;padding:14px 0 4px">Direct messages & people</div>
        ${_nsTogRow('email_dm_message','Direct messages','Email for every private message — off by default, in-app + push usually suffice')}
        ${_nsTogRow('email_people_event','Birthdays, anniversaries & document expiry','Email the manager / person for people events')}
      </div>
    </div>
  </div>`;

  // ── TEMPLATES TAB ──
  const defaults=_defaultTemplates();
  const expandedTpl=S.filters.tplKey||null;
  const templatesTab=`<div class="space-y-2">
    <div style="padding:4px 0 10px">
      <div style="font-size:13px;color:#A59788;line-height:1.6">
        Customise the subject and body for each email. Use these variables anywhere in your text:
        <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">
          ${['{{user_name}}','{{checklist_name}}','{{date}}','{{status}}','{{manager_name}}','{{action_url}}','{{app_url}}'].map(v=>`<code style="background:#F1ECE3;border-radius:6px;padding:2px 8px;font-size:12px;color:#3A312A">${v}</code>`).join('')}
        </div>
      </div>
    </div>
    ${EMAIL_EVENTS.map(ev=>{
      const tpl={...(defaults[ev.key]||{}), ...(ns.templates?.[ev.key]||{})};
      const open=expandedTpl===ev.key;
      return`<div style="background:#fff;border-radius:14px;border:1.5px solid ${open?'#54433C':'#EDE7DC'};overflow:hidden;transition:border-color .15s">
        <button onclick="S.filters.tplKey='${open?'':ev.key}';rr()"
          style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:13px 16px;background:transparent;border:none;cursor:pointer;text-align:left">
          <div>
            <div style="font-size:13px;font-weight:700;color:#13171B">${ev.label}</div>
            <div style="font-size:11px;color:#A8998A;margin-top:1px">${ev.vars}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            ${(ns.templates?.[ev.key])?`<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:#EEE4D5;color:#2B5638">Custom</span>`:''}
            <span style="color:#A8998A;font-size:16px">${open?'▲':'▼'}</span>
          </div>
        </button>
        ${open?`<div style="padding:0 16px 16px;border-top:1px solid #F1ECE3">
          <div style="margin-bottom:10px">
            <label for="tpl-subj-${ev.key}" style="display:block;font-size:11px;font-weight:700;color:#786A5F;margin-bottom:4px;margin-top:12px">Subject</label>
            <input id="tpl-subj-${ev.key}" value="${esc(tpl.subject||'')}" placeholder="Email subject…"
              style="width:100%;box-sizing:border-box;border:1.5px solid #E6DED3;border-radius:10px;padding:8px 12px;font-size:13px;outline:none" class="rf"/>
          </div>
          <div>
            <label for="tpl-body-${ev.key}" style="display:block;font-size:11px;font-weight:700;color:#786A5F;margin-bottom:4px">Body</label>
            <textarea id="tpl-body-${ev.key}" rows="6"
              style="width:100%;box-sizing:border-box;border:1.5px solid #E6DED3;border-radius:10px;padding:8px 12px;font-size:13px;outline:none;resize:vertical;font-family:monospace;line-height:1.6" class="rf">${esc(tpl.body||'')}</textarea>
            <div style="font-size:11px;color:#A8998A;margin-top:4px">Tip: each line in the body becomes a paragraph in the email.</div>
          </div>
          <div style="display:flex;gap:8px;margin-top:12px">
            <button onclick="App._resetTpl('${ev.key}')"
              style="padding:8px 14px;border-radius:9px;border:1.5px solid #EDE7DC;background:#fff;font-size:12px;font-weight:600;cursor:pointer;color:#A59788">Reset to default</button>
            <button onclick="App._saveTpl('${ev.key}')"
              style="flex:1;padding:8px 14px;border-radius:9px;background:#13171B;color:#fff;font-size:13px;font-weight:700;border:none;cursor:pointer">Save template</button>
          </div>
        </div>`:''}
      </div>`;
    }).join('')}
  </div>`;

  App._saveTpl=async(key)=>{
    if(!can('settings','edit'))return toast('You need Settings → Edit','err');
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
    if(!can('settings','edit'))return toast('You need Settings → Edit','err');
    if(!_ns)_ns=_nsDefault();
    if(_ns.templates)delete _ns.templates[key];
    await _saveNS();
    toast('Reset to default ✓');rr();
  };

  const content=stab==='inapp'?inappTab:stab==='email'?emailTab:templatesTab;
  return`<div class="fade max-w-2xl">${hdr('Settings','')}${tabBar}${content}</div>`;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   v3.27 — NOTIFICATION KINDS & PREFERENCES
   The database decides WHO gets a notification and writes the row (kind, conversation, count).
   HOW it is shown (badge / sound / card / desktop pop-up / push) is decided in ONE place:
   20-notification-center.js (window.BBNotify). This file keeps the kinds, the per-person
   preference helpers (profiles.notify_prefs.channels[kind][channel]) and the Settings UI.
   ═══════════════════════════════════════════════════════════════════════════════ */
var _BB_KINDS=[
 ['mention','Tagged in a chat','Someone @mentions you or your group in Workspace'],
 ['chat','Every chat message','New messages on boards you belong to (grouped per chat)'],
 ['ticket','Tickets','Created, assigned, moved, approved and automation alerts'],
 ['okr','OKRs','Assigned, check-ins, updates, target changes'],
 ['checklist','Checklists','Assigned, submitted, approved, rejected, late'],
 ['approval','Approvals','Requested and decided'],
 ['feedback','Feedback','Feedback and replies from your manager'],
 ['reminder','Reminders & deadlines','Due reminders, overdue items, edit requests'],
 ['escalation','Escalations','A question or task escalates to you'],
 ['dm','Direct messages','Private one-to-one messages'],
 ['attendance','Attendance','Clock-in / clock-out reminders, auto clock-out, WFH and edits'],
 ['people','People & documents','Birthdays, work anniversaries and document expiry'],
 ['access','Access changes','Your role or permissions were changed']
];
var _BB_CHANNELS=[['inbox','Inbox'],['sound','Sound'],['desktop','Desktop'],['push','Push'],['email','Email']];
/* defaults when nothing is saved: everything on, except e-mail for plain chat */
function _bbPrefDefault(kind,ch){return !(kind==='chat'&&ch==='email');}
/* legacy text → kind, only for rows older than the engine (new rows carry kind from the server) */
function _bbKindFromText(text,link){
  text=text||'';link=link||'';
  if(/tagged you in/i.test(text))return'mention';
  if(/OKR|BOLT|objective/i.test(text))return'okr';
  if(link.indexOf('crm:')===0&&text.indexOf('\u{1F4AC}')>=0)return'chat';
  if(/checklist/i.test(text))return'checklist';
  if(/escalat/i.test(text))return'escalation';
  if(/feedback|replied|reply/i.test(text))return'feedback';
  if(/approv|reject/i.test(text))return'approval';
  if(/overdue|late|reminder|deadline|edit request|re-?submit/i.test(text))return'reminder';
  if(link.indexOf('crm:')===0)return'ticket';
  return'general';
}
function _bbNotifKind(n){if(!n)return'general';if(n.kind)return n.kind;return _bbKindFromText(n.text,n.link);}
/* old sound-type names still used by a few callers */
function _bbKindNorm(t){return({workspace_message:'chat',crm_mention:'mention',workspace:'ticket',late:'reminder',edit:'reminder'})[t]||t||'general';}
/* the person's preference for one kind × channel (saved on the profile, follows them everywhere) */
function _bbPrefOn(kind,ch){
  try{
    kind=_bbKindNorm(kind);var p=_bbNP();var c=p.channels&&p.channels[kind];
    if(c&&typeof c[ch]==='boolean')return c[ch];
    /* legacy single switches */
    if(ch==='inbox'&&kind==='chat'&&p.chat_all===false)return false;
    if(ch==='desktop'&&p.desktop===false)return false;
    if(ch==='push'&&p.push===false)return false;
    return _bbPrefDefault(kind,ch);
  }catch(e){return true;}
}
async function _bbNPSetChannel(kind,ch,on){
  var p=_bbNP();var channels=Object.assign({},p.channels||{});channels[kind]=Object.assign({},channels[kind]||{});channels[kind][ch]=!!on;
  var patch={channels:channels};
  if(kind==='chat'&&ch==='inbox')patch.chat_all=!!on;        // keep the legacy switch in step (server trigger reads both)
  if(ch==='desktop'||ch==='push'){var all=_BB_KINDS.every(function(k){var c=channels[k[0]];return !(c&&c[ch]===false);});patch[ch]=all;}
  await _bbNPSave(patch);
}
function _bbSB(){try{if(typeof sb!=='undefined'&&sb)return sb;}catch(e){}try{return window.sb||null;}catch(e){}return null;}

/* ═══════════ PRESENCE — green dot while a person's Bridge tab is open ═══════════ */
window._bbOnline=window._bbOnline||{};
function _bbPresPaint(){try{var els=document.querySelectorAll('[data-pres]');for(var i=0;i<els.length;i++){els[i].classList.toggle('on',!!window._bbOnline[els[i].getAttribute('data-pres')]);}}catch(e){}}
(function(){
  if(window._bbPresBoot)return;window._bbPresBoot=true;
  document.head.insertAdjacentHTML('beforeend','<style id="bb-pres-css">'
   +'.bb-dot{position:absolute;right:-1px;bottom:-1px;width:30%;height:30%;min-width:8px;min-height:8px;max-width:12px;max-height:12px;border-radius:50%;background:#C25441;border:2px solid #fff;box-sizing:border-box;z-index:2;transition:background .25s}'
   +'.bb-dot.on{background:#2FA36B;box-shadow:0 0 5px rgba(47,163,107,.55)}'
   +'aside.sidebar .bb-dot{border-color:#181D23}'
   +'</style>');
  /* join the shared presence channel once signed in; tab close = socket close = red */
  setInterval(function(){try{
    var _s=_bbSB();
    if(!_s||typeof S==='undefined'||!S||!S.uid||window._bbPresRT)return;
      var ch=_s.channel('bb-presence',{config:{presence:{key:S.uid}}});
      window._bbPresRT=ch;window._bbPresUid=S.uid;
      ch.on('presence',{event:'sync'},function(){
        try{var st=ch.presenceState();var o={};for(var k in st)o[k]=true;window._bbOnline=o;_bbPresPaint();}catch(e){}
      }).subscribe(function(s){if(s==='SUBSCRIBED'){try{ch.track({uid:S.uid,at:new Date().toISOString()});}catch(e){}}});
    }catch(e){window._bbPresRT=null;}
  },2500);
  /* sign-out or user switch: leave and re-key */
  setInterval(function(){
    try{
      if(window._bbPresRT&&(!S||!S.uid||S.uid!==window._bbPresUid)){
        try{var _s2=_bbSB();if(_s2)_s2.removeChannel(window._bbPresRT);}catch(e){}
        window._bbPresRT=null;window._bbOnline={};_bbPresPaint();
      }
    }catch(e){}
  },4000);
})();


/* ═══════════ PASSWORD EYE — every password field gets a show/hide toggle ═══════════ */
(function(){
  if(window._bbEyeBoot)return;window._bbEyeBoot=true;
  var EYE='<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.7"/></svg>';
  var EYEOFF='<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 5.9a10 10 0 0 1 1.4-.4c6.5 0 10 6.5 10 6.5a17 17 0 0 1-3 3.6M6.6 6.9A16.7 16.7 0 0 0 2 12s3.5 6.5 10 6.5a10 10 0 0 0 4.4-1"/><path d="M9.9 9.9a2.7 2.7 0 0 0 3.8 3.8"/></svg>';
  document.head.insertAdjacentHTML('beforeend','<style id="bb-eye-css">.bb-eyewrap{position:relative;display:block;min-width:0;width:100%}.bb-eye{position:absolute;right:6px;top:50%;transform:translateY(-50%);width:30px;height:30px;border:none;background:transparent;color:#A59788;cursor:pointer;display:grid;place-items:center;border-radius:8px;z-index:3;padding:0}.bb-eye:hover{color:#54433C;background:rgba(84,67,60,.06)}.bb-eyewrap input{padding-right:40px!important;width:100%;box-sizing:border-box}</style>');
  function _bbEyeEnhance(){
    try{
      var ins=document.querySelectorAll('input[type="password"]:not([data-eye])');
      for(var i=0;i<ins.length;i++){
        var inp=ins[i];inp.setAttribute('data-eye','1');
        var w=document.createElement('div');w.className='bb-eyewrap';
        inp.parentNode.insertBefore(w,inp);w.appendChild(inp);
        var b=document.createElement('button');b.type='button';b.className='bb-eye';b.setAttribute('aria-label','Show password');b.tabIndex=-1;b.innerHTML=EYE;
        b.addEventListener('click',function(ev){ev.preventDefault();ev.stopPropagation();var ip=this.parentNode.querySelector('input');if(!ip)return;var show=ip.type==='password';ip.type=show?'text':'password';this.innerHTML=show?EYEOFF:EYE;this.setAttribute('aria-label',show?'Hide password':'Show password');try{ip.focus();var L=ip.value.length;ip.setSelectionRange(L,L);}catch(e){}});
        w.appendChild(b);
      }
    }catch(e){}
  }
  var deb=null;
  try{new MutationObserver(function(){clearTimeout(deb);deb=setTimeout(_bbEyeEnhance,120);}).observe(document.documentElement,{childList:true,subtree:true});}catch(e){}
  _bbEyeEnhance();
})();


/* ═══════════════════════════════════════════════════════════════════════════════
   v3.22 — MY NOTIFICATIONS (per person) + DESKTOP notifications + WEB PUSH
   · profiles.notify_prefs (jsonb) holds each person's own switches:
       chat_all  — alert me on EVERY Workspace message on my boards (default ON)
       desktop   — system notifications while Bridge is open in a tab (default ON)
       push      — notifications while Bridge is closed, via Web Push (default ON once enabled)
   · Desktop = the browser Notification API, fired from the same realtime row that rings the bell.
   · Push = service worker (/sw.js) + push_subscriptions table + `send-push` edge function,
     called by a trigger on `notifications` — so every kind of alert reaches a closed app.
   · Native (Capacitor iOS/Android): register the device token into push_subscriptions with
     kind 'apns'/'fcm' from the shell and the same trigger/function picks it up (sender TODO).
   ═══════════════════════════════════════════════════════════════════════════════ */
var _BB_VAPID_PUBLIC='BHQnIaq-75Zs5dj1k7IBupTUYqBYpHknv8XaXHqlV3ti1IkDaLgr-Pk7SuemZSoFTRx7VN8te6mvjpl3nn64nmc';
function _bbNP(){try{var u=me();if(!u)return{};if(!u.notifyPrefs||typeof u.notifyPrefs!=='object')u.notifyPrefs={};return u.notifyPrefs;}catch(e){return{};}}
function _bbNPOn(key){var p=_bbNP();return p[key]!==false;}
async function _bbNPSave(patch){
  var u=me();if(!u)return;
  u.notifyPrefs=Object.assign({},u.notifyPrefs||{},patch||{});
  try{saveDB();}catch(e){}
  try{var r=await sb.from('profiles').update({notify_prefs:u.notifyPrefs}).eq('id',u.id);if(r&&r.error)throw r.error;}
  catch(e){console.warn('[notify_prefs]',e&&e.message);toast('Saved on this device only — sync failed','warn');}
}
App._bbNPTogCh=async(btn,kind,ch)=>{
  var nowOn=btn.classList.contains('off');
  btn.classList.toggle('on',nowOn);btn.classList.toggle('off',!nowOn);btn.setAttribute('aria-checked',nowOn?'true':'false');
  await _bbNPSetChannel(kind,ch,nowOn);
  if(ch==='push'&&nowOn){try{await App._bbPushEnable(true);}catch(e){}}
  if(ch==='desktop'&&nowOn){try{await App._bbDesktopEnable(true);}catch(e){}}
};
App._bbNPRowAll=async(kind,on)=>{for(var i=0;i<_BB_CHANNELS.length;i++){await _bbNPSetChannel(kind,_BB_CHANNELS[i][0],on);}render();};
/* ── Desktop notifications (tab open, maybe in the background) ── */
function _bbDesktopSupported(){return typeof window!=='undefined'&&'Notification' in window;}
function _bbDesktopState(){if(!_bbDesktopSupported())return'unsupported';try{return Notification.permission;}catch(e){return'unsupported';}}
App._bbDesktopEnable=async(quiet)=>{
  if(!_bbDesktopSupported()){if(!quiet)toast('This browser can’t show desktop notifications','warn');return false;}
  try{var p=await Notification.requestPermission();
    if(p==='granted'){if(!quiet){toast('Desktop notifications on ✓');try{new Notification('Bridge',{body:'You’ll be notified here when something needs you.',icon:'/icons/icon-192.png',tag:'bb-test'});}catch(e){}}return true;}
    if(!quiet)toast(p==='denied'?'Blocked in the browser — allow notifications for this site in the address-bar settings':'Not enabled','warn');
  }catch(e){}
  return false;
};
/* Show a system notification for a fresh bell row — but not for the conversation the person is
   looking at right now (they can see it), and never twice for the same row. */
function _bbDesktopShow(row){
  try{
    if(!row||!row.id)return;if(_bbDesktopState()!=='granted')return;if(!_bbPrefOn(_bbNotifKind(row),'desktop'))return;
    window._bbDeskSeen=window._bbDeskSeen||{};var _dk=row.id+':'+(row.count||1);if(window._bbDeskSeen[_dk])return;window._bbDeskSeen[_dk]=1;
    var link=row.link||'';
    var viewing=false;
    try{viewing=document.visibilityState==='visible'&&document.hasFocus()&&S.route==='crm'&&typeof CRM!=='undefined'&&CRM&&CRM.sel&&link===('crm:'+CRM.sel.convoId);}catch(e){}
    /* v3.27: while a Bridge window is open the service worker never shows a system notification
       (it hands the push to the app) — so this pop-up is THE one, and only in the background. */
    if(viewing){_bbCloseSWNotif(link||row.id);return;}
    if(document.visibilityState==='visible'&&document.hasFocus())return;
    var text=String(row.text||'');var kind=_bbNotifKind(row);
    var title=({mention:'You were tagged',chat:((row.count||1)>1?(row.count+' new messages'):'New message'),ticket:'Ticket',okr:'OKR',checklist:'Checklist',approval:'Approval',feedback:'Feedback',reminder:'Reminder',escalation:'Escalation',dm:((row.count||1)>1?(row.count+' new messages'):'New message'),attendance:'Attendance',people:'People',access:'Access changed'})[kind]||'Bridge';
    var body=text.replace(/^[\p{Extended_Pictographic}\u{FE0F}\u{200D}]+\s*/u,'').slice(0,200);
    var n=new Notification(title,{body:body,icon:'/icons/icon-192.png',badge:'/icons/icon-192.png',tag:link||row.id,renotify:true,data:{link:link,id:row.id}});
    n.onclick=function(){try{window.focus();}catch(e){}try{n.close();}catch(e){}try{App._bbOpenLink(link,text,row.id);}catch(e){}};
    setTimeout(function(){try{n.close();}catch(e){}},12000);
  }catch(e){}
}
function _bbCloseSWNotif(tag){try{if(!('serviceWorker' in navigator))return;var go=function(){navigator.serviceWorker.getRegistration('/').then(function(r){if(!r||!r.getNotifications)return;r.getNotifications({tag:tag}).then(function(ns){ns.forEach(function(n){try{n.close();}catch(e){}});}).catch(function(){});}).catch(function(){});};go();setTimeout(go,1500);setTimeout(go,4000);}catch(e){}}
/* Open what a notification points at (system notification click, push tap, ?nl= deep link) */
App._bbOpenLink=(link,text,nid)=>{
  try{if(nid){var n=(DB.notifications||[]).find(function(x){return x.id===nid;});if(n&&!n.read){n.read=true;_invalidateNotifCache();try{sb.from('notifications').update({read:true}).eq('id',nid).then(function(){}).catch(function(){});}catch(e){}}}}catch(e){}
  if(link&&String(link).indexOf('crm:')===0&&typeof App._crmOpenFromNotification==='function'){if(App._crmOpenFromNotification(link,text||''))return;}
  /* v132 deep links: att:<date> / att:in:<date> / att:out:<date> → My Day (clock card) · att:team:<date> → Attendance team ·
     profile:<uid>[:docs] → that profile · home → My Day */
  try{
    var L=String(link||'');
    if(L==='home'||L.indexOf('att:in:')===0||L.indexOf('att:out:')===0){App.go('home');return;}
    if(L.indexOf('att:team:')===0){App.go('attendance');S.filters.attTab='team';S.filters.attDay=L.slice(9)||null;if(S.filters.attDay)S.filters.attYm=S.filters.attDay.slice(0,7);rr();return;}
    if(L.indexOf('att:')===0){App.go('attendance');S.filters.attTab='my';var d=L.slice(4);if(/^\d{4}-\d{2}/.test(d))S.filters.attYm=d.slice(0,7);rr();return;}
    if(L.indexOf('profile:')===0){var parts=L.split(':');if(typeof App.openProfile==='function'){App.openProfile(parts[1]);if(parts[2]==='docs'){S.filters.profTab='docs';rr();}return;}}
  }catch(e){}
  App.go('notifications');
};
/* ── Web Push (app closed) ── */
function _bbPushSupported(){return typeof navigator!=='undefined'&&'serviceWorker' in navigator&&'PushManager' in window&&_bbDesktopSupported();}
function _bbB64ToU8(b){var pad='='.repeat((4-b.length%4)%4);var s=(b+pad).replace(/-/g,'+').replace(/_/g,'/');var raw=atob(s);var out=new Uint8Array(raw.length);for(var i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;}
function _bbIsNative(){try{return !!(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform());}catch(e){return false;}}
async function _bbSWReg(){
  if(!('serviceWorker' in navigator))return null;
  try{var reg=await navigator.serviceWorker.register('/sw.js',{scope:'/'});return reg;}catch(e){console.warn('[sw]',e&&e.message);return null;}
}
async function _bbPushSaveSub(sub){
  if(!sub||!S.uid)return;
  var j=sub.toJSON?sub.toJSON():sub;
  var row={user_id:S.uid,kind:'webpush',endpoint:j.endpoint,keys:j.keys||{},ua:(navigator.userAgent||'').slice(0,200),updated_at:new Date().toISOString(),last_error:null};
  try{var r=await sb.from('push_subscriptions').upsert(row,{onConflict:'endpoint'});if(r&&r.error)throw r.error;try{localStorage.setItem('bb_push_ep_'+S.uid,j.endpoint);}catch(e){}}
  catch(e){console.warn('[push save]',e&&e.message);}
}
App._bbPushEnable=async(quiet)=>{
  if(_bbIsNative()){if(!quiet)toast('In the app, notifications are set up by the app itself','warn');return false;}
  if(!_bbPushSupported()){if(!quiet)toast('This browser can’t receive push notifications'+(/iP(hone|ad)/.test(navigator.userAgent)?' — add Bridge to your Home Screen first':''),'warn');return false;}
  try{
    var ok=await App._bbDesktopEnable(true);if(!ok){if(!quiet)toast('Allow notifications first','warn');return false;}
    var reg=await _bbSWReg();if(!reg){if(!quiet)toast('Could not start background notifications','err');return false;}
    await navigator.serviceWorker.ready;
    var sub=await reg.pushManager.getSubscription();
    if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:_bbB64ToU8(_BB_VAPID_PUBLIC)});
    await _bbPushSaveSub(sub);
    if(_bbNP().push===false)await _bbNPSave({push:true});
    if(!quiet)toast('Push notifications on for this device ✓');
    try{render();}catch(e){}
    return true;
  }catch(e){console.warn('[push]',e&&e.message);if(!quiet)toast('Push setup failed: '+((e&&e.message)||'unknown'),'err');return false;}
};
App._bbPushDisableHere=async()=>{
  try{var reg=await navigator.serviceWorker.getRegistration('/');var sub=reg?await reg.pushManager.getSubscription():null;
    if(sub){try{await sb.from('push_subscriptions').delete().eq('endpoint',sub.endpoint);}catch(e){}try{await sub.unsubscribe();}catch(e){}}
    try{localStorage.removeItem('bb_push_ep_'+S.uid);}catch(e){}
    toast('Push off on this device');render();}catch(e){}
};
/* On every boot: keep the subscription fresh (endpoints rotate) without asking anything. */
async function _bbPushResync(){
  if(!S.uid||_bbIsNative()||!_bbPushSupported())return;
  if(_bbDesktopState()!=='granted'||_bbNP().push===false)return;
  try{var reg=await _bbSWReg();if(!reg)return;var sub=await reg.pushManager.getSubscription();
    if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:_bbB64ToU8(_BB_VAPID_PUBLIC)});
    var ep='';try{ep=localStorage.getItem('bb_push_ep_'+S.uid)||'';}catch(e){}
    if(sub&&sub.endpoint!==ep)await _bbPushSaveSub(sub);
  }catch(e){}
}
function _bbPushHere(){try{return !!localStorage.getItem('bb_push_ep_'+(S&&S.uid));}catch(e){return false;}}
/* v3.27: the My-notifications UI is BBNotify.settingsHTML() in 20-notification-center.js */
/* Boot hooks: SW registration, subscription resync, deep link from a push tap */
function _bbAfterBoot(){
  /* v3.27: first sync is done — from here on, rows are "new"; everything before is history (badge only) */
  window._bbFirstSyncDone=true;try{if(window.BBNotify)BBNotify.markReady();}catch(e){}
  try{if(window.BBNotify)BBNotify.heartbeat(true);}catch(e){}
  try{_bbPushResync();}catch(e){}
  try{
    var q=new URLSearchParams(window.location.search||'');var nl=q.get('nl');
    if(nl){try{history.replaceState(null,'',window.location.pathname+window.location.hash);}catch(e){}setTimeout(function(){try{App._bbOpenLink(nl,'');}catch(e){}},400);}
  }catch(e){}
  try{if('serviceWorker' in navigator&&!window._bbSWMsgBound){window._bbSWMsgBound=true;navigator.serviceWorker.addEventListener('message',function(ev){var d=ev.data||{};if(d.type==='bb-open'){try{App._bbOpenLink(d.link||'','');}catch(e){}}});}}catch(e){}
}
window._bbAfterBoot=_bbAfterBoot;
