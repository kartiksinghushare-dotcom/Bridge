/* ============================================================
   Bridge — 15-questions-escalation.js  (split from Bridge.html lines 4460-5586)
   Classic script: shares top-level scope with the other /js files.
   Load order matters — see index.html.
   ============================================================ */
/* ===== QUESTIONS PAGE ===== */
let _QED=null;

// ── Questions CSV template download ──
App._downloadQTemplate=()=>{
  // Clean template — just header + examples (no instruction rows to delete)
  const rows=[
    // header — simple columns only, no number condition fields
    'text,type,option1,option2,option3,option4,option5,photo_required,comment_required,approval_required',
    // passfail / yesno / tick — options auto-filled, leave blank
    'Is the area clean?,passfail,,,,,,FALSE,FALSE,FALSE',
    'Was the handover completed?,yesno,,,,,,FALSE,FALSE,FALSE',
    'Were all items checked?,tick,,,,,,FALSE,FALSE,FALSE',
    // answer — fill option1..option5 with your choices
    'What is the shift status?,answer,Normal,Understaffed,Overstaffed,,,FALSE,FALSE,FALSE',
    'Describe any issues found?,answer,None,Minor issue,Major issue,,TRUE,TRUE,FALSE',
  ];
  const csv=rows.join('\n');
  const blob=new Blob([csv],{type:'text/csv'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='bridge_questions_template.csv';
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
  toast('Template downloaded ✓');
};

// ── Questions CSV import ──
App._importQCSV=(input)=>{
  if(!can('questions','import')){toast('You don’t have permission to import questions','err');return;}
  const file=input.files?.[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    const lines=e.target.result.split('\n').map(l=>l.trim()).filter(Boolean);
    if(!lines.length){toast('Empty file','err');return;}
    // Skip header row
    const start=lines[0].toLowerCase().startsWith('text')?1:0;
    const rows=lines.slice(start);
    if(!rows.length){toast('No data rows found','err');return;}
    let added=0,skipped=0;
    rows.forEach(line=>{
      // Parse CSV properly (handle quoted commas)
      const cols=[];let cur='',inQ=false;
      for(let i=0;i<line.length;i++){
        if(line[i]==='"'){inQ=!inQ;}
        else if(line[i]===','&&!inQ){cols.push(cur.trim());cur='';}
        else cur+=line[i];
      }
      cols.push(cur.trim());
      const [text,type,o1,o2,o3,o4,o5,condition,cval,cval2,photo,comment,approval]=cols;
      if(!text||!type){skipped++;return;}
      const qtRaw=(type||'').toLowerCase().trim();
      const qtype=['passfail','yesno','tick','number','answer'].includes(qtRaw)?qtRaw:'answer';
      // Build options
      let options=[];
      if(qtype==='passfail'){
        options=[{text:'Pass',escalate:false},{text:'Fail',escalate:false}];
      } else if(qtype==='yesno'){
        options=[{text:'Yes',escalate:false},{text:'No',escalate:false}];
      } else if(qtype==='tick'){
        options=[{text:'Done',escalate:false},{text:'Not done',escalate:false}];
      } else if(qtype==='answer'){
        options=[o1,o2,o3,o4,o5].filter(Boolean).map(t=>({text:t.trim(),escalate:false}));
        if(!options.length){skipped++;return;}
      } else if(qtype==='number'){
        // Parse condition if provided
        const validConds=['lt','lte','gt','gte','eq','neq','between'];
        const cond=(condition||'').toLowerCase().trim();
        if(cond&&validConds.includes(cond)){
          const condObj={condition:cond,value:parseFloat(cval)||0};
          if(cond==='between')condObj.value2=parseFloat(cval2)||condObj.value;
          options=[condObj];
        }
        // number questions can have 0 conditions (manual entry) so don't skip
      }
      const isTrue=s=>(s||'').toLowerCase().trim()==='true'||s==='1';
      const q={
        id:uid('q'),
        text:text.trim(),
        type:qtype,
        options,
        photo:isTrue(photo),
        comment:isTrue(comment),
        approval:isTrue(approval),
        isPublic:false,
        createdBy:S.uid,
        createdAt:new Date().toISOString()
      };
      if(!DB.questions)DB.questions=[];
      DB.questions.push(q);
      added++;
    });
    if(added){
      saveDB();
      sb.from('questions').upsert(DB.questions.filter(q=>q.createdBy===S.uid).map(q=>({id:q.id,text:q.text||'',type:q.type||'answer',options:q.options||[],photo:q.photo||false,approval:q.approval||false,comment:q.comment||false,is_public:q.isPublic!==false,created_by:q.createdBy||null,created_at:q.createdAt||new Date().toISOString(),department_id:q.departmentId||null,sub_department_id:q.subDepartmentId||null})),{onConflict:'id'}).then(()=>{}).catch(()=>{});
      rr();
      toast(added+' question'+(added===1?'':'s')+' imported'+(skipped?' ('+skipped+' skipped)':'')+'  ✓','ok');
    } else {
      toast('No valid questions found'+(skipped?' — '+skipped+' rows skipped':''),'err');
    }
    input.value=''; // Reset so same file can be uploaded again
  };
  reader.readAsText(file);
};


// ── Question visibility ──
// Public (isPublic !== false): visible to everyone with Questions access.
// Private: visible only to the creator (assigned users still see it inside their checklists).
// Admin always sees everything.
function visibleQuestions(){
  const all=DB.questions||[];
  if(can('questions','manage'))return all;
  return all.filter(q=>q.isPublic!==false||q.createdBy===S.uid);
}
// Creator (or admin) can manage a question
function canManageQ(q){return can('questions','manage')||q.createdBy===S.uid;}

App._togQPublic=(id)=>{
  const q=(DB.questions||[]).find(x=>x.id===id);if(!q)return;
  if(!canManageQ(q)){toast('Only the creator can change this','warn');return;}
  q.isPublic=q.isPublic===false?true:false;
  toast(q.isPublic?'Question is now Public — visible to everyone with Questions access':'Question is now Private — visible only to you and assigned users','ok');
  saveDB();rr();
  // Sync to Supabase in background
  sb.from('questions').update({is_public:q.isPublic}).eq('id',id).then(({error})=>{
    if(error)console.error('togQPublic sync:',error.message);
  }).catch(e=>console.error('togQPublic:',e));
};

function qCard(q){
    const _qdep=q.departmentId?(DB.departments||[]).find(d=>d.id===q.departmentId):null;
    const _qsub=q.subDepartmentId?(DB.departments||[]).find(d=>d.id===q.subDepartmentId):null;
    const exp=S.filters.expandedQ===q.id;
    const clr=Q_TYPE_CLR[q.type]||'#6B7280';
    const bg=Q_TYPE_BG[q.type]||'#F6F7F8';
    const tl=(Q_TYPES.find(t=>t.id===q.type)||{label:q.type}).label;
    let h=`<div style="background:#fff;border-radius:14px;border:1.5px solid ${exp?'#C7D2FE':'#ECEDF0'};overflow:hidden">`;
    h+=`<div style="display:flex;align-items:center;gap:10px;padding:12px 14px;cursor:pointer" onclick="App._togExpandQ('${q.id}')">`;
    h+=`<span style="color:#C8C5BD;transition:transform .2s;transform:rotate(${exp?90:0}deg)">${ic('chevR','w-4 h-4')}</span>`;
    h+=`<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;background:${bg};color:${clr}">${tl}</span>`;
    if(_qdep){h+=`<span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:6px;background:#F3F4F6;color:#6B7280;white-space:nowrap;flex-shrink:0">${esc(_qdep.name)}${_qsub?' › '+esc(_qsub.name):''}</span>`;}
    h+=`<div style="flex:1;min-width:0;font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(q.text)}</div>`;
    const isPub=q.isPublic!==false;
    const mine=canManageQ(q);
    h+=`<div style="display:flex;gap:4px;align-items:center" onclick="event.stopPropagation()">`;
    if(mine){
      h+=`<span title="Change via Edit" style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;border:1.5px solid ${isPub?'#A7F3D0':'#FDE68A'};background:${isPub?'#ECFDF5':'#FFFBEB'};font-size:11px;font-weight:700;color:${isPub?'#047857':'#B45309'}">${isPub?'🌐 Public':'🔒 Private'}</span>`;
      h+=`<button onclick="App._editQuestion('${q.id}')" style="padding:5px 12px;border-radius:8px;border:1.5px solid #ECEDF0;background:#fff;font-size:12px;font-weight:600;cursor:pointer">Edit</button>`;
      h+=`<button onclick="App._delQuestion('${q.id}')" style="width:30px;height:30px;display:grid;place-items:center;border-radius:8px;border:none;background:transparent;color:#D1D5DB;cursor:pointer" onmouseover="this.style.color='#BE123C'" onmouseout="this.style.color='#D1D5DB'">${ic('trash','w-4 h-4')}</button>`;
    } else {
      h+=`<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;border:1.5px solid #E5E7EB;background:#F9FAFB;font-size:11px;font-weight:700;color:#6B7280">🌐 Public</span>`;
    }
    h+=`</div></div>`;
    if(exp){
      h+=`<div style="padding:0 14px 12px 40px;border-top:1px solid #F5F4F0">`;
      const opts=q.options||[];
      if(!opts.length){h+=`<p style="font-size:12px;color:#D1D5DB;font-style:italic;padding:8px 0">No options — click Edit</p>`;}
      else opts.forEach((o,oi)=>{

        let lbl=q.type==='number'
          ?((NUM_CONDITIONS.find(x=>x.id===o.condition)||{label:o.condition}).label+' '+o.value+(o.condition==='between'?' – '+o.value2:''))
          :(o.text||o.label||'');
        h+=`<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #F9F8F5">`;
        h+=`<span style="width:20px;height:20px;border-radius:50%;background:#EFF6FF;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#1D4ED8">${oi+1}</span>`;
        h+=`<span style="flex:1;font-size:13px;color:#374151">${esc(lbl)}</span>`;

        h+=`</div>`;
      });
      h+=`</div>`;
    }
    h+=`</div>`;
    return h;
  }

function _qGroupHTML(list){
  if(!list.length)return empty('help','No questions yet','Create questions or upload a CSV template.');
  const C=S.filters.qColl=S.filters.qColl||{};
  const tops=topDepts();
  const used=new Set();
  let html='';
  const chev=(open)=>`<span style="display:inline-grid;place-items:center;width:20px;height:20px;border-radius:6px;background:#F3F4F6;color:#6B7280;font-size:9px;flex-shrink:0;transform:rotate(${open?90:0}deg);transition:transform .15s">▶</span>`;
  const deptHdr=(key,name,count,open)=>`<button onclick="App._qTogGroup('${key}')" style="width:100%;display:flex;align-items:center;gap:8px;margin:18px 0 8px;background:transparent;border:none;cursor:pointer;text-align:left;padding:0">${chev(open)}<div style="width:30px;height:30px;border-radius:9px;background:#ECFDF5;display:grid;place-items:center;flex-shrink:0">${ic('dept','w-4 h-4')}</div><div style="font-size:14px;font-weight:800;color:#111827">${esc(name)}</div><span style="font-size:11px;font-weight:800;padding:1px 8px;border-radius:10px;background:#F3F4F6;color:#6B7280">${count}</span></button>`;
  const subHdr=(key,name,count,open)=>`<button onclick="App._qTogGroup('${key}')" style="display:flex;align-items:center;gap:7px;margin:10px 0 6px 8px;background:transparent;border:none;cursor:pointer;padding:0">${chev(open)}<span style="width:6px;height:6px;border-radius:50%;background:#0E9F6E"></span><div style="font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.04em">${esc(name)}</div><span style="font-size:10.5px;font-weight:800;color:#9CA3AF">${count}</span></button>`;
  tops.forEach(dep=>{
    const direct=list.filter(q=>q.departmentId===dep.id&&!q.subDepartmentId);
    const subBlocks=subDepts(dep.id).map(sd=>({sd,qs:list.filter(q=>q.subDepartmentId===sd.id)}));
    const total=direct.length+subBlocks.reduce((a,b)=>a+b.qs.length,0);
    direct.forEach(q=>used.add(q.id));subBlocks.forEach(({qs})=>qs.forEach(q=>used.add(q.id)));
    if(!total)return;
    const dKey='d:'+dep.id,dOpen=!C[dKey];
    html+=deptHdr(dKey,dep.name,total,dOpen);
    if(dOpen){
      if(direct.length){const k='s:'+dep.id+':general',sOpen=!C[k];html+=subHdr(k,'General',direct.length,sOpen);if(sOpen)html+='<div class="space-y-2">'+direct.map(q=>qCard(q)).join('')+'</div>';}
      subBlocks.forEach(({sd,qs})=>{if(!qs.length)return;const k='s:'+sd.id,sOpen=!C[k];html+=subHdr(k,sd.name,qs.length,sOpen);if(sOpen)html+='<div class="space-y-2">'+qs.map(q=>qCard(q)).join('')+'</div>';});
    }
  });
  const rest=list.filter(q=>!used.has(q.id));
  if(rest.length){const k='d:rest',rOpen=!C[k];html+=deptHdr(k,'Unassigned',rest.length,rOpen);if(rOpen)html+='<div class="space-y-2">'+rest.map(q=>qCard(q)).join('')+'</div>';}
  return html;
}
App._qTogGroup=(k)=>{const C=S.filters.qColl=S.filters.qColl||{};C[k]=!C[k];App._filterQuestions(S.filters.qSearch||'');};
function questionsPage(){
  // Questions tab: admin sees all; others see public questions + their own private questions
  let allQ=visibleQuestions();
  const _qd=S.filters.qDept||'',_qsd=S.filters.qSubDept||'';
  if(_qd)allQ=allQ.filter(q=>q.departmentId===_qd||(_qsd?false:(DB.departments||[]).some(sd=>sd.parentId===_qd&&sd.id===q.subDepartmentId)));
  if(_qsd)allQ=allQ.filter(q=>q.subDepartmentId===_qsd);
  return`<div class="fade">${hdr('Questions','Reusable question library for your checklists')}
    <!-- Action bar: New + Search -->
    <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
      <input id="qSearchInput" type="text" placeholder="Search questions…" value="${S.filters.qSearch||''}"
        oninput="App._filterQuestions(this.value)"
        style="flex:1;min-width:180px;border:1.5px solid #ECEDF0;border-radius:10px;padding:8px 12px;font-size:13px;outline:none;background:#fff"/>
      <select onchange="S.filters.qDept=this.value;S.filters.qSubDept='';rr()" class="ui-select" style="width:auto;min-width:150px;flex:0 0 auto"><option value="">All departments</option>${topDepts().map(d=>`<option value="${d.id}" ${(S.filters.qDept||'')===d.id?'selected':''}>${esc(d.name)}</option>`).join('')}</select>
      <select onchange="S.filters.qSubDept=this.value;rr()" class="ui-select" style="width:auto;min-width:160px;flex:0 0 auto" ${(S.filters.qDept&&(DB.departments||[]).some(d=>d.parentId===S.filters.qDept))?'':'disabled'}><option value="">All sub-departments</option>${(DB.departments||[]).filter(d=>d.parentId===(S.filters.qDept||'')).map(d=>`<option value="${d.id}" ${(S.filters.qSubDept||'')===d.id?'selected':''}>${esc(d.name)}</option>`).join('')}</select>

      ${can('questions','create')?`<button onclick="App._editQuestion(null)" style="display:inline-flex;align-items:center;gap:6px;background:#15171C;color:#fff;font-size:13px;font-weight:700;padding:9px 16px;border-radius:10px;border:none;cursor:pointer">${ic('plus','w-4 h-4')} New question</button>`:''}
    </div>
    <!-- CSV Import / Export bar -->
    ${can('questions','import')?`<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center;padding:10px 14px;background:#F9FAFB;border-radius:12px;border:1.5px solid #ECEDF0">
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:1px">Bulk import via CSV</div>
        <div style="font-size:11px;color:#9CA3AF">Download the template, fill it in, then upload to add multiple questions at once</div>
      </div>
      <button onclick="App._downloadQTemplate()" style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:9px;border:1.5px solid #ECEDF0;background:#fff;font-size:12px;font-weight:600;cursor:pointer;color:#374151;white-space:nowrap">${ic('download','w-3.5 h-3.5')} Download template</button>
      <label style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:9px;border:1.5px solid #0E9F6E;background:#ECFDF5;font-size:12px;font-weight:600;cursor:pointer;color:#047857;white-space:nowrap">
        ${ic('upload','w-3.5 h-3.5')} Upload CSV
        <input type="file" accept=".csv" onchange="App._importQCSV(this)" style="display:none"/>
      </label>
    </div>`:''}
    <div id="qResults">${(()=>{
      const filtered=S.filters.qSearch?allQ.filter(q=>q.text.toLowerCase().includes((S.filters.qSearch||'').toLowerCase())):allQ;
      return _qGroupHTML(filtered);
    })()}</div>
  </div>`;
}

App._togExpandQ=(id)=>{S.filters.expandedQ=S.filters.expandedQ===id?null:id;rr();};

App._filterQuestions=(val)=>{
  S.filters.qSearch=val;
  const box=document.getElementById('qResults');
  if(!box)return;
  let allQ=visibleQuestions();
  const _qd=S.filters.qDept||'',_qsd=S.filters.qSubDept||'';
  if(_qd)allQ=allQ.filter(q=>q.departmentId===_qd||(_qsd?false:(DB.departments||[]).some(sd=>sd.parentId===_qd&&sd.id===q.subDepartmentId)));
  if(_qsd)allQ=allQ.filter(q=>q.subDepartmentId===_qsd);
  const filtered=val?allQ.filter(q=>q.text.toLowerCase().includes(val.toLowerCase())):allQ;
  box.innerHTML=_qGroupHTML(filtered);
};

App._delQuestion=(id)=>{
  const q=(DB.questions||[]).find(x=>x.id===id);if(!q)return;
  if(!canManageQ(q)&&!can('questions','delete')){toast('You don’t have permission to delete this question','err');return;}
  // ── Guard: a question that is still used in ANY checklist must not be deleted. Deleting a
  //    question that was assigned to someone is exactly what caused the "Mohit 15 / Wendy 16"
  //    count mismatch. The question must first be removed from those checklists. ──
  const _usedIn=(DB.checklists||[]).filter(c=>(c.questionIds||[]).includes(id));
  if(_usedIn.length){
    const _assignees=new Set();_usedIn.forEach(c=>(c.assignees||[]).forEach(a=>_assignees.add(a)));
    const _names=_usedIn.slice(0,4).map(c=>'• '+(c.name||'Untitled')).join('\n')+(_usedIn.length>4?'\n• +'+(_usedIn.length-4)+' more':'');
    alert("Can't delete this question — it's still used in "+_usedIn.length+' checklist'+(_usedIn.length>1?'s':'')+':\n'+_names+(_assignees.size?'\n\nThose checklists are assigned to '+_assignees.size+' user'+(_assignees.size>1?'s':''):'')+".\n\nOpen each checklist and remove this question first, then you can delete it.");
    return;
  }
  if(!confirm('Delete "'+q.text+'"?'))return;
  if(!DB.questions_deleted)DB.questions_deleted=[];
  if(!DB.questions_deleted.includes(id))DB.questions_deleted.push(id);
  DB.questions=(DB.questions||[]).filter(x=>x.id!==id);
  DB.checklists.forEach(c=>{c.questionIds=(c.questionIds||[]).filter(x=>x!==id);if(c.questionConfigs)delete c.questionConfigs[id];});
  toast('Deleted','warn');saveDB();render();
  // Sync to Supabase in background
  sb.from('questions').delete().eq('id',id).then(({error})=>{
    if(error)console.error('delQuestion sync:',error.message);
  }).catch(e=>console.error('delQuestion:',e));
};

App._editQuestion=(id)=>{
  const existing=id?(DB.questions||[]).find(x=>x.id===id):null;
  if(id&&!existing)return;
  if(!(id?(canManageQ(existing)||can('questions','edit')):can('questions','create'))){toast('You don’t have permission to do that','err');return;}
  _QED=existing?JSON.parse(JSON.stringify(existing)):{
    id:uid('q'),text:'',type:'answer',options:[],photo:false,approval:false,comment:false,isPublic:false,departmentId:null,subDepartmentId:null
  };
  if(_QED.isPublic===undefined)_QED.isPublic=true;
  App._renderQModal();
};

App._renderQModal=()=>{
  if(!_QED)return;
  const q=_QED;
  const au=DB.users.filter(u=>u.status==='Active');
  const _qDeptOpts='<option value="">— No department —</option>'+topDepts().map(d=>`<option value="${d.id}" ${q.departmentId===d.id?'selected':''}>${esc(d.name)}</option>`).join('');
  const _qSubs=q.departmentId?subDepts(q.departmentId):[];
  const _qSubOpts='<option value="">— No sub-department —</option>'+_qSubs.map(s=>`<option value="${s.id}" ${q.subDepartmentId===s.id?'selected':''}>${esc(s.name)}</option>`).join('');

  let optsHtml='';
  if(q.type==='answer'){
    let rows='';
    (q.options||[]).forEach((o,i)=>{
      rows+=`<div style="display:flex;align-items:center;gap:6px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:9px;padding:7px 10px">
        <span style="font-size:11px;font-weight:700;color:#9CA3AF;width:18px;text-align:center">${String.fromCharCode(65+i)}</span>
        <input type="text" value="${o.text||''}" oninput="_QED.options[${i}].text=this.value" placeholder="Answer option…" style="flex:1;background:transparent;border:none;border-bottom:1px solid #E5E7EB;font-size:13px;outline:none;padding:2px 0"/>
        <button onclick="_QED.options.splice(${i},1);App._renderQModal()" style="width:20px;height:20px;display:grid;place-items:center;border-radius:5px;border:none;background:transparent;color:#D1D5DB;cursor:pointer">${ic('x','w-3 h-3')}</button>
      </div>`;
    });
    optsHtml=rows+`<button onclick="_QED.options.push({text:''});App._renderQModal()" style="margin-top:6px;display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:700;padding:5px 12px;border-radius:8px;background:#0E9F6E;color:#fff;border:none;cursor:pointer">${ic('plus','w-3 h-3')}Add answer</button>`;
  }
  else if(q.type==='number'){
    let rows='';
    (q.options||[]).forEach((o,i)=>{
      const cSel=NUM_CONDITIONS.map(c=>`<option value="${c.id}" ${o.condition===c.id?'selected':''}>${c.label}</option>`).join('');
      rows+=`<div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:9px;padding:8px 10px;display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <select onchange="_QED.options[${i}].condition=this.value;App._renderQModal()" style="font-size:12px;background:#fff;border:1px solid #E5E7EB;border-radius:6px;padding:4px 8px;outline:none">${cSel}</select>
          <input type="number" value="${o.value!=null?o.value:''}" oninput="_QED.options[${i}].value=parseFloat(this.value)" placeholder="Value" style="width:70px;background:#fff;border:1px solid #E5E7EB;border-radius:6px;padding:4px 8px;font-size:12px;outline:none"/>
          ${o.condition==='between'?`<span style="font-size:12px;color:#9CA3AF">and</span><input type="number" value="${o.value2!=null?o.value2:''}" oninput="_QED.options[${i}].value2=parseFloat(this.value)" placeholder="Value 2" style="width:70px;background:#fff;border:1px solid #E5E7EB;border-radius:6px;padding:4px 8px;font-size:12px;outline:none"/>`:''}
          <button onclick="_QED.options.splice(${i},1);App._renderQModal()" style="width:20px;height:20px;display:grid;place-items:center;border-radius:5px;border:none;background:transparent;color:#D1D5DB;cursor:pointer;margin-left:auto">${ic('x','w-3 h-3')}</button>
        </div>
      </div>`;
    });
    optsHtml=rows+`<button onclick="_QED.options.push({condition:'lt',value:null,value2:null});App._renderQModal()" style="margin-top:6px;display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:700;padding:5px 12px;border-radius:8px;background:#0E9F6E;color:#fff;border:none;cursor:pointer">${ic('plus','w-3 h-3')}Add condition</button>`;
  }
  else {
    const labels={passfail:['Pass','Fail'],yesno:['Yes','No'],tick:['Done','Not done']};
    const lbs=labels[q.type]||['Option A','Option B'];
    if(!q.options||q.options.length!==2)_QED.options=[{label:lbs[0]},{label:lbs[1]}];
    optsHtml=(q.options||[]).map((o,i)=>{
      const good=i===0;
      return`<div style="display:flex;align-items:center;gap:10px;background:${good?'#F0FDF4':'#FFF5F5'};border:1px solid ${good?'#BBF7D0':'#FECACA'};border-radius:9px;padding:8px 12px;margin-bottom:6px">
        <span style="font-size:13px;font-weight:700;color:${good?'#16A34A':'#DC2626'};min-width:50px">${lbs[i]}</span>
      </div>`;
    }).join('');
  }

  // Preview
  let prev='';
  if(q.type==='answer')prev=(q.options||[]).map((o,i)=>`<div style="padding:7px 12px;border-radius:8px;border:1.5px solid #E5E7EB;background:#fff;font-size:13px;margin-bottom:4px">${String.fromCharCode(65+i)}. ${o.text||'...'}</div>`).join('');
  else if(q.type==='number')prev=`<input disabled placeholder="Enter a number…" style="width:100%;padding:9px;border-radius:9px;border:1.5px solid #E5E7EB;font-size:14px;background:#F9FAFB"/>`;
  else if(q.type==='passfail')prev=`<div style="display:flex;gap:8px"><div style="flex:1;padding:9px;border-radius:9px;background:#DCFCE7;color:#16A34A;font-weight:700;font-size:13px;text-align:center">Pass</div><div style="flex:1;padding:9px;border-radius:9px;background:#FEE2E2;color:#DC2626;font-weight:700;font-size:13px;text-align:center">Fail</div></div>`;
  else if(q.type==='yesno')prev=`<div style="display:flex;gap:8px"><div style="flex:1;padding:9px;border-radius:9px;background:#DCFCE7;color:#16A34A;font-weight:700;font-size:13px;text-align:center">Yes</div><div style="flex:1;padding:9px;border-radius:9px;background:#FEE2E2;color:#DC2626;font-weight:700;font-size:13px;text-align:center">No</div></div>`;
  else if(q.type==='tick')prev=`<div style="display:flex;gap:8px"><div style="flex:1;padding:9px;border-radius:9px;background:#DCFCE7;color:#16A34A;font-weight:700;font-size:18px;text-align:center">✓</div><div style="flex:1;padding:9px;border-radius:9px;background:#FEE2E2;color:#DC2626;font-weight:700;font-size:18px;text-align:center">✕</div></div>`;

  const flags=[q.photo?'📷 Photo required':'',q.approval?'✓ Approval needed':'',q.comment?'💬 Comment required':''].filter(Boolean);

  const togRow=(k,lbl,desc)=>`<label style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 12px;border-radius:9px;border:1.5px solid ${_QED[k]?'#BBF7D0':'#F3F4F6'};background:${_QED[k]?'#F0FDF4':'#FAFAFA'};cursor:pointer;margin-bottom:5px">
    <div><div style="font-size:13px;font-weight:600">${lbl}</div><div style="font-size:11px;color:#9CA3AF">${desc}</div></div>
    <button type="button" role="switch" aria-checked="${_QED[k]?'true':'false'}" aria-label="${esc(lbl)}" class="tog ${_QED[k]?'on':'off'}" onclick="_QED['${k}']=!_QED['${k}'];App._renderQModal()"><span></span></button>
  </label>`;

  const typeBtns=Q_TYPES.map(t=>`<button type="button" onclick="_QED.type='${t.id}';_QED.options=[];App._renderQModal()" style="padding:8px;border-radius:9px;border:1.5px solid ${q.type===t.id?Q_TYPE_CLR[t.id]:'#E5E7EB'};background:${q.type===t.id?Q_TYPE_BG[t.id]:'#fff'};cursor:pointer;text-align:left">
    <div style="font-size:12px;font-weight:700;color:${q.type===t.id?Q_TYPE_CLR[t.id]:'#374151'}">${t.label}</div>
    <div style="font-size:10px;color:#9CA3AF;margin-top:2px">${t.desc}</div>
  </button>`).join('');

  const isExisting=!!(DB.questions||[]).find(x=>x.id===q.id);

  openModal(`
    <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px 12px;border-bottom:1px solid #ECEDF0">
      <h2 style="font-size:17px;font-weight:800;font-family:var(--font-display)">${isExisting?'Edit':'New'} Question</h2>
      <button onclick="App.closeModal()" style="width:28px;height:28px;display:grid;place-items:center;border-radius:8px;border:none;background:transparent;cursor:pointer;color:#9CA3AF">${ic('x')}</button>
    </div>
    <div style="padding:16px 18px;display:flex;flex-direction:column;gap:14px;overflow-y:auto;max-height:70vh">
      <div>
        <label for="qed-text" style="display:block;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Question text *</label>
        <input id="qed-text" type="text" value="${q.text||''}" oninput="_QED.text=this.value" placeholder="e.g. Is the area clean?" style="width:100%;box-sizing:border-box;border:1.5px solid #E5E7EB;border-radius:10px;padding:10px 12px;font-size:14px;outline:none" />
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div>
          <label style="display:block;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Department</label>
          <select onchange="_QED.departmentId=this.value||null;_QED.subDepartmentId=null;App._renderQModal()" style="width:100%;box-sizing:border-box;border:1.5px solid #E5E7EB;border-radius:10px;padding:9px 10px;font-size:13px;outline:none;background:#fff">${_qDeptOpts}</select>
        </div>
        <div>
          <label style="display:block;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Sub-department</label>
          <select ${_qSubs.length?'':'disabled'} onchange="_QED.subDepartmentId=this.value||null" style="width:100%;box-sizing:border-box;border:1.5px solid #E5E7EB;border-radius:10px;padding:9px 10px;font-size:13px;outline:none;background:${_qSubs.length?'#fff':'#F3F4F6'}">${_qSubOpts}</select>
        </div>
      </div>
      <div>
        <label style="display:block;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Response type</label>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">${typeBtns}</div>
      </div>
      <div>
        <label style="display:block;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">${q.type==='answer'?'Answer options':q.type==='number'?'Conditions':'Response options'}</label>
        ${optsHtml}
      </div>
      <div>
        <label style="display:block;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Options</label>
        ${togRow('isPublic','🌐 Public question','Off = Private (default): only you and assigned users see it. On: everyone with Questions access sees it')}
        ${togRow('photo','📷 Photo mandatory','Upload button always shown — this makes it required')}
        ${togRow('approval','✓ Approval required','Response needs manager approval')}
        ${togRow('comment','💬 Comment mandatory','Comment box always shown — this makes it required')}
      </div>
      <div style="background:#F9FAFB;border:1.5px solid #E5E7EB;border-radius:12px;padding:14px">
        <div style="font-size:10px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Preview</div>
        <div style="font-size:14px;font-weight:700;color:#15171C;margin-bottom:10px">${q.text||'Your question text…'}</div>
        ${prev}
        ${flags.length?`<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px">${flags.map(f=>`<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;background:#F3F4F6;color:#374151">${f}</span>`).join('')}</div>`:''}
      </div>
    </div>
    <div style="padding:12px 18px;border-top:1px solid #ECEDF0;display:flex;gap:8px;background:#fff">
      <button onclick="App.closeModal()" style="flex:1;padding:11px;border-radius:11px;border:1.5px solid #ECEDF0;background:#fff;font-weight:600;font-size:14px;cursor:pointer">Cancel</button>
      <button onclick="App._saveQuestion()" style="flex:2;padding:11px;border-radius:11px;background:#15171C;color:#fff;font-weight:700;font-size:14px;border:none;cursor:pointer">${isExisting?'Save changes':'Create question'}</button>
    </div>
  `,'max-w-lg');

};

App._saveQuestion=()=>{
  if(!_QED)return;
  if(!can('questions','create')&&!can('questions','edit')&&!can('questions','manage')){toast('You don’t have permission to do that','err');return;}
  const textEl=document.getElementById('qed-text');
  if(textEl)_QED.text=textEl.value.trim();
  const text=(_QED.text||'').trim();
  if(!text){toast('Question text is required','err');const qb=document.getElementById('q-save-btn');if(qb){qb.disabled=false;qb.textContent=_QED?.createdAt?'Save changes':'Create question';}return;}
  if(_QED.type==='answer'){
    _QED.options=(_QED.options||[]).filter(o=>(o.text||'').trim());
    if(!_QED.options.length){toast('Add at least one answer option','err');const qb=document.getElementById('q-save-btn');if(qb){qb.disabled=false;qb.textContent=_QED?.createdAt?'Save changes':'Create question';}return;}
  }
  if(_QED.type==='number'&&!(_QED.options||[]).length){toast('Add at least one condition','err');const qb=document.getElementById('q-save-btn');if(qb){qb.disabled=false;qb.textContent=_QED?.createdAt?'Save changes':'Create question';}return;}
  if(!DB.questions)DB.questions=[];
  const existIdx=DB.questions.findIndex(x=>x.id===_QED.id);
  const isNew=existIdx===-1;
  if(!isNew){DB.questions[existIdx]=_QED;}
  else{_QED.createdBy=S.uid;_QED.createdAt=new Date().toISOString();DB.questions.push(_QED);}
  // ── Save locally and close IMMEDIATELY ──
  toast(isNew?'Question created ✓':'Saved ✓');
  closeModal();
  const savedQ=_QED;_QED=null;
  saveDB();
  render();
  // ── Sync to Supabase in background ──
  const qRow={id:savedQ.id,text:savedQ.text||'',type:savedQ.type||'answer',options:savedQ.options||[],photo:savedQ.photo||false,approval:savedQ.approval||false,comment:savedQ.comment||false,is_public:savedQ.isPublic!==false,created_by:savedQ.createdBy||null,created_at:savedQ.createdAt||new Date().toISOString(),department_id:savedQ.departmentId||null,sub_department_id:savedQ.subDepartmentId||null};
  sb.from('questions').upsert(qRow,{onConflict:'id'}).then(({error})=>{
    if(error){console.error('Question sync error:',error.message);toast('⚠ Question saved locally but not synced: '+error.message.slice(0,60),'warn');}
    // Department & sub-department are protected by a DB freeze-trigger so stale browser tabs can't
    // wipe them. A plain upsert can no longer change them — apply this deliberate assignment
    // through the sanctioned RPC (works for both a new and an existing question).
    sb.rpc('set_question_department',{p_id:savedQ.id,p_dept:savedQ.departmentId||null,p_subdept:savedQ.subDepartmentId||null}).then(({error})=>{if(error)console.warn('set_question_department:',error.message);}).catch(e=>console.warn('set dept:',e&&e.message));
  }).catch(e=>console.error('Question sync:',e));
};

// ── Checklist question picker ──
App._openClQuestionPicker=()=>{
  if(!CLD)return;
  // CRITICAL: Snapshot form values NOW while checklist modal is still open
  _snapshotCLD();
  const allQ=visibleQuestions();
  const sel=new Set(CLD.questionIds||[]);
  App._clQSel=new Set(sel);
  App._showClQPicker();
};

App._showClQPicker=()=>{
  const sel=App._clQSel||new Set();
  // Show questions the user can see, plus any already selected on this checklist (so existing private picks aren't lost)
  const allQ=(DB.questions||[]).filter(q=>q.isPublic!==false||q.createdBy===S.uid||isAdmin()||isSubAdmin()||sel.has(q.id));
  openModal(`
    <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px 10px;border-bottom:1px solid #ECEDF0">
      <div>
        <h2 style="font-size:16px;font-weight:800;font-family:var(--font-display)">Add Questions</h2>
        <p style="font-size:12px;color:#9CA3AF;margin-top:1px">Select questions, then configure escalation</p>
      </div>
      <button onclick="App.closeModal()" style="width:28px;height:28px;display:grid;place-items:center;border-radius:8px;border:none;background:transparent;cursor:pointer;color:#9CA3AF">${ic('x')}</button>
    </div>
    <div style="padding:12px 16px;overflow-y:auto;max-height:60vh;display:flex;flex-direction:column;gap:5px">
      ${!allQ.length
        ?`<div style="text-align:center;padding:32px;color:#9CA3AF;font-size:13px">No questions yet — create some in the Questions page first</div>`
        :allQ.map(q=>{
          const on=sel.has(q.id);
          const tl=(Q_TYPES.find(t=>t.id===q.type)||{label:q.type}).label;
          const clr=Q_TYPE_CLR[q.type]||'#6B7280';
          const bg=Q_TYPE_BG[q.type]||'#F6F7F8';
          return`<label id="qpick-${q.id}" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;border:1.5px solid ${on?'#15171C':'#E5E7EB'};background:${on?'#F9FAFB':'#fff'};cursor:pointer" onclick="App._togClQ('${q.id}',this,event)">
            <div style="width:20px;height:20px;border-radius:6px;border:1.5px solid ${on?'#15171C':'#D1D5DB'};background:${on?'#15171C':'#fff'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
              ${on?`<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5"><path d="M20 6 9 17l-5-5"/></svg>`:''}
            </div>
            <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:5px;background:${bg};color:${clr};flex-shrink:0">${tl}</span>
            ${q.isPublic===false?`<span style="font-size:10px;flex-shrink:0" title="Private question">🔒</span>`:''}
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${q.text}</div>
              <div style="font-size:11px;color:#9CA3AF">${(q.options||[]).length} option${(q.options||[]).length!==1?'s':''}</div>
            </div>
          </label>`;
        }).join('')}
    </div>
    <div style="padding:10px 16px;border-top:1px solid #ECEDF0;background:#fff;display:flex;gap:8px">
      <button onclick="App.closeModal()" style="flex:1;padding:11px;border-radius:11px;border:1.5px solid #ECEDF0;background:#fff;font-weight:600;font-size:14px;cursor:pointer">Cancel</button>
      <button onclick="App._showClQEscalation()" style="flex:2;padding:11px;border-radius:11px;background:#15171C;color:#fff;font-weight:700;font-size:14px;border:none;cursor:pointer">Next: Set escalation →</button>
    </div>
  `,'max-w-md');
};

App._togClQ=(qid,el,e)=>{if(e&&e.preventDefault)e.preventDefault();
  if(!App._clQSel)App._clQSel=new Set();
  const on=App._clQSel.has(qid);
  if(on)App._clQSel.delete(qid);else App._clQSel.add(qid);
  const now=!on;
  el.style.border=`1.5px solid ${now?'#15171C':'#E5E7EB'}`;
  el.style.background=now?'#F9FAFB':'#fff';
  const box=el.querySelector('div');
  if(box){
    box.style.border=`1.5px solid ${now?'#15171C':'#D1D5DB'}`;
    box.style.background=now?'#15171C':'#fff';
    box.innerHTML=now?`<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5"><path d="M20 6 9 17l-5-5"/></svg>`:'';
  }
};

App._showClQEscalation=()=>{
  if(!CLD){toast('Checklist context lost — please reopen','err');return;}
  if(!App._clQSel)App._clQSel=new Set(CLD.questionIds||[]);
  const selectedIds=[...App._clQSel];
  if(!selectedIds.length){toast('Select at least one question','warn');return;}
  const au=DB.users.filter(u=>u.status==='Active');
  const configs=CLD.questionConfigs||{};

  const uOptsFn=(curVal)=>'<option value="">— No escalation —</option>'+au.map(u=>`<option value="${u.id}" ${curVal===u.id?'selected':''}>${fullName(u)}</option>`).join('');

  let sectionsHtml=selectedIds.map(qid=>{
    const q=(DB.questions||[]).find(x=>x.id===qid);
    if(!q)return'';
    const tl=(Q_TYPES.find(t=>t.id===q.type)||{label:q.type}).label;
    const clr=Q_TYPE_CLR[q.type]||'#6B7280';
    const bg=Q_TYPE_BG[q.type]||'#F6F7F8';
    const qCfg=configs[qid]||{};

    // Build option rows with escalation dropdown per option
    let optRows='';
    const opts=q.options||[];

    if(q.type==='answer'){
      opts.forEach((o,i)=>{
        const key='opt_'+i;
        const cur=qCfg[key]||'';
        optRows+=`<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid #F5F4F0">
          <span style="width:20px;height:20px;border-radius:50%;background:#EEF2FF;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#4338CA;flex-shrink:0">${String.fromCharCode(65+i)}</span>
          <span style="flex:1;font-size:13px;color:#374151">${o.text||''}</span>
          <select onchange="(CLD.questionConfigs=CLD.questionConfigs||{})['${qid}']=(CLD.questionConfigs['${qid}']||{});CLD.questionConfigs['${qid}']['opt_${i}']=this.value||null" style="font-size:12px;background:#fff;border:1.5px solid #E5E7EB;border-radius:8px;padding:4px 10px;outline:none;min-width:150px">${uOptsFn(cur)}</select>
        </div>`;
      });
    } else if(q.type==='number'){
      opts.forEach((o,i)=>{
        const key='opt_'+i;
        const cur=qCfg[key]||'';
        const condLabel=(NUM_CONDITIONS.find(c=>c.id===o.condition)||{label:o.condition}).label;
        const condText=condLabel+' '+o.value+(o.condition==='between'?' – '+o.value2:'');
        optRows+=`<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid #F5F4F0">
          <span style="width:20px;height:20px;border-radius:50%;background:#E0F2FE;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#0369A1;flex-shrink:0">${i+1}</span>
          <span style="flex:1;font-size:13px;color:#374151">${condText}</span>
          <select onchange="(CLD.questionConfigs=CLD.questionConfigs||{})['${qid}']=(CLD.questionConfigs['${qid}']||{});CLD.questionConfigs['${qid}']['opt_${i}']=this.value||null" style="font-size:12px;background:#fff;border:1.5px solid #E5E7EB;border-radius:8px;padding:4px 10px;outline:none;min-width:150px">${uOptsFn(cur)}</select>
        </div>`;
      });
    } else {
      // passfail, yesno, tick
      const labels={passfail:['Pass','Fail'],yesno:['Yes','No'],tick:['Done','Not done']};
      const lbs=labels[q.type]||['Option A','Option B'];
      lbs.forEach((lbl,i)=>{
        const key='opt_'+i;
        const cur=qCfg[key]||'';
        const isGood=i===0;
        optRows+=`<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid #F5F4F0">
          <span style="font-size:12px;font-weight:700;color:${isGood?'#16A34A':'#DC2626'};min-width:50px">${lbl}</span>
          <div style="flex:1"></div>
          <select onchange="(CLD.questionConfigs=CLD.questionConfigs||{})['${qid}']=(CLD.questionConfigs['${qid}']||{});CLD.questionConfigs['${qid}']['opt_${i}']=this.value||null" style="font-size:12px;background:#fff;border:1.5px solid #E5E7EB;border-radius:8px;padding:4px 10px;outline:none;min-width:150px">${uOptsFn(cur)}</select>
        </div>`;
      });
    }

    if(!opts.length){
      optRows=`<p style="font-size:12px;color:#D1D5DB;font-style:italic;padding:6px 0">No options defined for this question</p>`;
    }

    return`<div style="background:#F9FAFB;border:1.5px solid #E5E7EB;border-radius:12px;padding:12px 14px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;background:${bg};color:${clr}">${tl}</span>
        <span style="font-size:13px;font-weight:700;color:#15171C">${q.text}</span>
      </div>
      <div style="font-size:11px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Escalate answer to</div>
      ${optRows}
    </div>`;
  }).join('');

  openModal(`
    <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px 10px;border-bottom:1px solid #ECEDF0">
      <div>
        <h2 style="font-size:16px;font-weight:800;font-family:var(--font-display)">Set Escalation</h2>
        <p style="font-size:12px;color:#9CA3AF;margin-top:1px">Choose who gets notified for each answer</p>
      </div>
      <button onclick="App.closeModal()" style="width:28px;height:28px;display:grid;place-items:center;border-radius:8px;border:none;background:transparent;cursor:pointer;color:#9CA3AF">${ic('x')}</button>
    </div>
    <div style="padding:14px 16px;overflow-y:auto;max-height:60vh">
      ${sectionsHtml}
    </div>
    <div style="padding:10px 16px;border-top:1px solid #ECEDF0;background:#fff;display:flex;gap:8px">
      <button onclick="App._showClQPicker()" style="flex:1;padding:11px;border-radius:11px;border:1.5px solid #ECEDF0;background:#fff;font-weight:600;font-size:14px;cursor:pointer">← Back</button>
      <button onclick="App._confirmClQs()" style="flex:2;padding:11px;border-radius:11px;background:#15171C;color:#fff;font-weight:700;font-size:14px;border:none;cursor:pointer">Done</button>
    </div>
  `,'max-w-lg');
};

// Read all checklist modal form values into CLD (prevents data loss on re-render)
function _snapshotCLD(){
  if(!CLD)return;
  // Only read fields that actually exist in DOM right now
  const el=id=>document.getElementById(id);
  if(el('cn-name'))CLD.name=el('cn-name').value.trim()||CLD.name;
  if(el('cn-desc'))CLD.description=el('cn-desc').value.trim();
  if(el('cn-status')&&el('cn-status').value)CLD.status=el('cn-status').value;
  if(el('cn-dep')&&el('cn-dep').value)CLD.department=el('cn-dep').value;
  if(el('cn-subdep'))CLD.subDepartment=el('cn-subdep').value;
  if(el('cn-freq')&&el('cn-freq').value)CLD.frequency=el('cn-freq').value;
  if(el('cn-sd'))CLD.startDate=el('cn-sd').value||null;
  if(el('cn-ed'))CLD.endDate=el('cn-ed').value||null;
  if(el('cn-time'))CLD.scheduleTime=el('cn-time').value||null;
  if(el('cn-anyone'))CLD.anyOne=el('cn-anyone').classList.contains('on');
}


App._confirmClQs=()=>{
  if(!CLD||!App._clQSel)return;
  // Snapshot all current form values before re-rendering (prevents data loss)
  _snapshotCLD();
  // Preserve existing order, then add new ones at end
  const existing=CLD.questionIds||[];
  const newIds=[...App._clQSel];
  // Keep existing order for already-selected, add new ones at end
  CLD.questionIds=[...existing.filter(id=>newIds.includes(id)),...newIds.filter(id=>!existing.includes(id))];
  CLD.questionConfigs=CLD.questionConfigs||{};
  // Remove configs for deselected questions
  Object.keys(CLD.questionConfigs).forEach(qid=>{
    if(!App._clQSel.has(qid))delete CLD.questionConfigs[qid];
  });
  closeModal();
  _renderClModal(!!(DB.checklists.find(c=>c.id===CLD.id)));
};

App._removeClQuestion=(qid)=>{
  if(!CLD)return;
  _snapshotCLD();
  CLD.questionIds=(CLD.questionIds||[]).filter(x=>x!==qid);
  if(CLD.questionConfigs)delete CLD.questionConfigs[qid];
  _renderClModal(!!(DB.checklists.find(c=>c.id===CLD.id)));
};

App._editClQuestionEscalation=(qid)=>{
  if(!CLD)return;
  _snapshotCLD(); // snapshot before replacing modal
  App._clQSel=new Set(CLD.questionIds||[]);
  App._showClQEscalation();
};


// ── Compliance check (Fix #3, revised) ──
// Returns the Set of question IDs that actually triggered a REAL escalation ticket for a
// given submission — matched by checklist + date + the submission's own submitter (so
// "any one" group submissions match whoever submitted). This is the single source of
// truth for both the card badge (count) and the per-question red highlight.
// Does a single stored answer (resp) trip an escalation for question q on checklist c?
// Pure re-evaluation of the saved response against the checklist's escalation config —
// this is what makes OLD submissions show compliance even when no ticket was ever created.
function _qrEscalates(c,q,resp){
  if(!c||!q||!resp)return false;
  const r=resp.response;
  if(r===null||r===undefined||r==='')return false; // unanswered ≠ escalation
  const qCfg=(c.questionConfigs||{})[q.id]||{};
  if(q.type==='answer'){
    const _respStr=String(r).trim();
    const optIdx=(q.options||[]).findIndex(o=>String(o.text||'').trim()===_respStr);
    return optIdx>-1&&!!qCfg['opt_'+optIdx];
  }
  if(q.type==='number'){
    const val=parseFloat(r);
    for(let i=0;i<(q.options||[]).length;i++){
      const cond=q.options[i];let m=false;
      if(cond.condition==='lt')m=val<cond.value;
      else if(cond.condition==='lte')m=val<=cond.value;
      else if(cond.condition==='gt')m=val>cond.value;
      else if(cond.condition==='gte')m=val>=cond.value;
      else if(cond.condition==='eq')m=val===cond.value;
      else if(cond.condition==='neq')m=val!==cond.value;
      else if(cond.condition==='between')m=val>=cond.value&&val<=(cond.value2||cond.value);
      if(m)return !!qCfg['opt_'+i];
    }
    return false;
  }
  // passfail / yesno / tick — match by label index
  const labels={passfail:['Pass','Fail'],yesno:['Yes','No'],tick:['Done','Not done']};
  const lbs=labels[q.type]||[];
  const optIdx=lbs.findIndex(l=>l.toLowerCase()===String(r).trim().toLowerCase());
  return optIdx>-1&&!!qCfg['opt_'+optIdx];
}
function _subEscalatedQids(c,sub){
  const out=new Set();
  if(!c||!sub)return out;
  // 1) Re-evaluate the actual saved answers against the escalation config (works on old data)
  const qById={};(c.questionIds||[]).forEach(qid=>{const q=(DB.questions||[]).find(x=>x.id===qid);if(q)qById[qid]=q;});
  (sub.questionResponses||[]).forEach(resp=>{
    const q=qById[resp.questionId];
    if(q&&_qrEscalates(c,q,resp))out.add(resp.questionId);
  });
  // 2) Union with any real escalation tickets recorded for this submission (belt and suspenders)
  const submitterId=sub.userId; // for "any one" group checklists this is whoever submitted
  (DB.tickets||[]).forEach(t=>{
    if(t.checklistId===c.id&&t.date===sub.date&&t.submitterId===submitterId&&t.questionId){
      out.add(t.questionId);
    }
  });
  return out;
}
// Count of distinct questions that escalated (0 = compliant).
function _subEscalationCount(c,sub){return _subEscalatedQids(c,sub).size;}
// ── Separate badges: Attempt (answered/total) + Compliance (escalations) ──
// Returns an HTML string with up to two pills. `opts.small` shrinks them for dense rows.
function _subBadges(c,sub,opts){
  if(!sub)return'';
  const total=(c.questionIds||[]).length;
  const answered=(sub.questionResponses||[]).filter(r=>r.response!==null&&r.response!==undefined&&r.response!=='').length;
  const flagged=_subEscalationCount(c,sub);
  const small=opts&&opts.small;
  const pad=small?'2px 7px':'3px 9px';
  const fs=small?'10px':'11px';
  const allAns=total>0&&answered>=total;
  // Attempt badge — green when all questions attempted, grey otherwise
  const attBg=allAns?'#ECFDF5':'#F6F7F8';
  const attClr=allAns?'#059669':'#6B7280';
  const attLabel=small?answered+'/'+total:answered+'/'+total+' attempted';
  const attempt=total>0
    ? '<span title="'+answered+' of '+total+' question'+(total>1?'s':'')+' attempted" style="font-size:'+fs+';font-weight:700;padding:'+pad+';border-radius:20px;background:'+attBg+';color:'+attClr+'">'+(allAns?'✓ ':'')+attLabel+'</span>'
    : '';
  // Compliance badge — green "Compliant" when no escalations, red "N escalated" when flagged
  const compBg=flagged?'#FFF1F2':'#ECFDF5';
  const compClr=flagged?'#BE123C':'#059669';
  const compLabel=flagged
    ? (small?'⚠ '+flagged:'⚠ '+flagged+' escalated')
    : (small?'✓':'✓ Compliant');
  const compliance='<span title="'+(flagged?flagged+' answer'+(flagged>1?'s':'')+' triggered an escalation':'No escalations — compliant')+'" style="font-size:'+fs+';font-weight:700;padding:'+pad+';border-radius:20px;background:'+compBg+';color:'+compClr+'">'+compLabel+'</span>';
  return attempt+compliance;
}
// Back-compat boolean wrapper (kept in case anything references the old name)
function _subHasEscalation(c,subOrResponses){
  if(subOrResponses&&!Array.isArray(subOrResponses))return _subEscalationCount(c,subOrResponses)>0;
  return false;
}

// ── Escalation on submit ──
function _processEscalations(checklistId,date,responses){
  const c=clById(checklistId);if(!c)return;
  const u=me();
  const configs=c.questionConfigs||{};
  (responses||[]).forEach(resp=>{
    const q=(DB.questions||[]).find(x=>x.id===resp.questionId);if(!q)return;
    const qCfg=configs[resp.questionId]||{};
    let escalateTo=null;
    // Find which option index matched the response
    if(q.type==='answer'){
      const _respStr=String(resp.response||'').trim();const optIdx=(q.options||[]).findIndex(o=>String(o.text||'').trim()===_respStr);
      if(optIdx>-1)escalateTo=qCfg['opt_'+optIdx]||null;
    } else if(q.type==='number'){
      const val=parseFloat(resp.response);
      for(let i=0;i<(q.options||[]).length;i++){
        const cond=q.options[i];
        let m=false;
        if(cond.condition==='lt')m=val<cond.value;
        else if(cond.condition==='lte')m=val<=cond.value;
        else if(cond.condition==='gt')m=val>cond.value;
        else if(cond.condition==='gte')m=val>=cond.value;
        else if(cond.condition==='eq')m=val===cond.value;
        else if(cond.condition==='neq')m=val!==cond.value;
        else if(cond.condition==='between')m=val>=cond.value&&val<=(cond.value2||cond.value);
        if(m){escalateTo=qCfg['opt_'+i]||null;break;}
      }
    } else {
      // passfail, yesno, tick — match by label index
      const labels={passfail:['Pass','Fail'],yesno:['Yes','No'],tick:['Done','Not done']};
      const lbs=labels[q.type]||[];
      const optIdx=lbs.findIndex(l=>l.toLowerCase()===String(resp.response||'').trim().toLowerCase());
      if(optIdx>-1)escalateTo=qCfg['opt_'+optIdx]||null;
    }
    if(escalateTo){
      if(!DB.notifications)DB.notifications=[];
      if(!DB.tickets)DB.tickets=[];
      const escMsg='⚠️ Escalation: "'+q.text+'" answered "'+String(resp.response||'')+'" by '+fullName(u)+' on '+c.name+' ('+date+')';
      // Determine priority from question or response
      const _respLower=String(resp.response||'').toLowerCase();
      const ticketPriority=_respLower==='fail'||_respLower==='not done'||_respLower==='no'?'High':'Medium';
      // ── v2 FIX: dedup + reopen is SERVER-side now. The old check only looked at THIS
      //    device's local tickets — but staff can't see tickets assigned to their managers,
      //    so every repeat failure quietly created a brand-new identical ticket each day
      //    (the "closed ticket keeps coming back" bug). New behaviour: ONE ticket per issue —
      //    a repeat failure REOPENS the same ticket and logs the occurrence on it.
      (async()=>{
        const nowISO=new Date().toISOString();
        const occ={date:date,answer:String(resp.response||''),at:nowISO};
        let existing=null;
        try{
          const{data,error}=await sb.from('tickets')
            .select('id,status,assigned_to,reopen_count,occurrences,priority')
            .eq('question_id',q.id).eq('checklist_id',checklistId).eq('submitter_id',S.uid)
            .order('created_at',{ascending:false}).limit(1);
          if(!error&&data&&data.length)existing=data[0];
        }catch(e){/* offline — fall back to the local view below */}
        if(!existing){
          const loc=(DB.tickets||[]).find(t=>t.questionId===q.id&&t.checklistId===checklistId&&t.submitterId===S.uid);
          if(loc)existing={id:loc.id,status:loc.status,assigned_to:loc.assignedTo,reopen_count:loc.reopenCount||0,occurrences:loc.occurrences||[],priority:loc.priority};
        }
        if(existing&&!(DB.tickets_deleted||[]).includes(existing.id)){
          const wasClosed=existing.status==='Resolved'||existing.status==='Closed';
          const lastOcc=(existing.occurrences||[]).slice(-1)[0];
          if(!wasClosed&&lastOcc&&lastOcc.date===date&&lastOcc.answer===occ.answer){
            return; // same-day edit with the same failing answer — nothing new to record
          }
          const assignee=existing.assigned_to||escalateTo;
          const values={
            status:'Open',
            updated_at:nowISO,
            reopen_count:(existing.reopen_count||0)+(wasClosed?1:0),
            occurrences:[...(existing.occurrences||[]),occ],
            resolved_at:null,resolve_note:'',
            viewed_by:[]
          };
          if(ticketPriority==='High'&&existing.priority!=='Critical')values.priority='High';
          await sbWrite({table:'tickets',op:'update',id:existing.id,match:{col:'id',val:existing.id},values},{label:'Ticket reoccurrence',silent:true});
          const lt=(DB.tickets||[]).find(t=>t.id===existing.id);
          if(lt){lt.status='Open';lt.updatedAt=nowISO;lt.reopenCount=values.reopen_count;lt.occurrences=values.occurrences;lt.resolvedAt=null;lt.resolveNote='';lt.viewedBy=[];if(values.priority)lt.priority=values.priority;}
          const rTxt=(wasClosed?'\u{1F501} Reopened: ':'\u{1F501} Reoccurred: ')+'"'+q.text+'" answered "'+String(resp.response||'')+'" again by '+fullName(u)+' ('+date+') — ticket #'+existing.id.slice(-6);
          DB.notifications.unshift({id:uid('n'),userId:assignee,text:rTxt,time:nowISO,read:false,type:'escalation',kind:'escalation'});
          queueEmail('escalation',assignee,null,date,{checklist_name:c.name,question:q.text,answer:String(resp.response||''),submitter:fullName(u)});
          _invalidateNotifCache();saveDB();
          return;
        }
        // ── First failure for this issue → create the ticket ──
        const ticket={
          id:uid('tk'),
          title:q.text.slice(0,80),
          description:'Answer: "'+String(resp.response||'')+'"\nSubmitted by: '+fullName(u)+'\nChecklist: '+c.name+'\nDate: '+date,
          priority:ticketPriority,
          status:'Open',
          assignedTo:escalateTo,
          createdBy:S.uid,
          checklistId:checklistId,
          questionId:q.id,
          questionText:q.text,
          answerGiven:String(resp.response||''),
          submitterId:S.uid,
          date:date,
          createdAt:nowISO,
          resolvedAt:null,
          resolveNote:'',
          viewedBy:[],
          occurrences:[occ],
          reopenCount:0,
          updatedAt:nowISO
        };
        DB.tickets.unshift(ticket);
        await sbWrite({table:'tickets',op:'insert',id:ticket.id,values:{
          id:ticket.id,title:ticket.title,description:ticket.description,priority:ticket.priority,
          status:'Open',assigned_to:ticket.assignedTo,created_by:ticket.createdBy,
          checklist_id:ticket.checklistId,question_id:ticket.questionId,question_text:ticket.questionText,
          answer_given:ticket.answerGiven,submitter_id:ticket.submitterId,date:ticket.date,
          created_at:ticket.createdAt,resolved_at:null,resolve_note:'',viewed_by:[],
          occurrences:[occ],reopen_count:0,updated_at:nowISO
        }},{label:'Escalation ticket',silent:true});
        DB.notifications.unshift({id:uid('n'),userId:escalateTo,text:escMsg,time:nowISO,read:false,type:'escalation',kind:'escalation'});
        queueEmail('escalation',escalateTo,null,date,{checklist_name:c.name,question:q.text,answer:String(resp.response||''),submitter:fullName(u)});
        const adminU=DB.users.find(x=>x.role==='Admin');
        if(adminU&&adminU.id!==escalateTo&&adminU.id!==S.uid){
          DB.notifications.unshift({id:uid('n'),userId:adminU.id,text:escMsg,time:nowISO,read:false,type:'escalation',kind:'escalation'});
        }
        _invalidateNotifCache();saveDB();
      })();
    }
  });
}



function _feedbackTabContent(uid){
  const myFb=DB.feedback.filter(fb=>fb.userId===uid).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  if(!myFb.length)return empty('msg','No feedback yet','Feedback from your manager appears here.');
  return'<div style="display:flex;flex-direction:column;gap:10px">'+myFb.map(fb=>{
    const mgr=uById(fb.managerId);const cl=clById(fb.checklistId);
    const bc=fb.acknowledged?'#E5E7EB':'#BFDBFE';
    const priClr=fb.priority==='High'||fb.priority==='Critical'?'#DC2626':'#92400E';
    const priBg=fb.priority==='High'||fb.priority==='Critical'?'#FEE2E2':'#FEF9C3';
    return'<div style="background:#fff;border-radius:16px;border:1px solid '+bc+';padding:16px">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'
      +'<div>'
      +'<div style="font-size:14px;font-weight:700">'+(cl?esc(cl.name):'General feedback')+'</div>'
      +'<div style="font-size:12px;color:#9CA3AF;margin-top:2px">From '+(mgr?esc(fullName(mgr)):'Manager')+(fb.date||fb.createdAt?' &middot; '+fmtD((fb.date||fb.createdAt||'').slice(0,10)):'')+'</div>'
      +'</div>'
      +(fb.priority&&fb.priority!=='Low'?'<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:'+priBg+';color:'+priClr+'">'+fb.priority+'</span>':'')
      +'</div>'
      +'<p style="font-size:13px;line-height:1.6;margin:0 0 10px">'+esc(fb.text)+'</p>'
      +(fb.reply?'<div style="background:#F0FDF4;border-radius:10px;padding:10px 12px;margin-bottom:10px"><div style="font-size:11px;font-weight:700;color:#059669;margin-bottom:4px">Your reply</div><p style="font-size:13px;color:#374151;margin:0">'+esc(fb.reply)+'</p></div>':'')
      +'<div style="display:flex;gap:8px;flex-wrap:wrap">'
      +(!fb.acknowledged?'<button onclick="App._ackFb(this.dataset.id)" data-id="'+fb.id+'" style="padding:6px 14px;border-radius:8px;background:#1D4ED8;color:#fff;font-size:12px;font-weight:600;border:none;cursor:pointer">Acknowledge</button>':'<span style="font-size:12px;font-weight:600;color:#0E9F6E">&#10003; Acknowledged</span>')
      +(!fb.reply?'<button onclick="App._replyFb(this.dataset.id)" data-id="'+fb.id+'" style="padding:6px 14px;border-radius:8px;background:#F3F4F6;color:#374151;font-size:12px;font-weight:600;border:none;cursor:pointer">Reply</button>':'')
      +'</div></div>';
  }).join('')+'</div>';
}


function notificationsPage(){
  const uid=S.uid;
  const notifs=DB.notifications.filter(n=>n.userId===uid).sort((a,b)=>(b.time||'').localeCompare(a.time||'')).slice(0,80);
  // Track which were unread BEFORE marking them (so the dot shows on this render)
  const unreadIds=new Set(notifs.filter(n=>!n.read).map(n=>n.id));
  const hadUnread=unreadIds.size>0;
  // Mark as read after a short delay so user can see what was unread
  if(hadUnread){
    setTimeout(()=>{
      notifs.forEach(n=>n.read=true);
      _invalidateNotifCache();
      saveDB();
    },1500);
  }
  // Feedback for this user
  const myFb=DB.feedback.filter(fb=>fb.userId===uid).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  const unackFb=myFb.filter(fb=>!fb.acknowledged);

  const tab=S.filters.ntab||'All';
  const TABS=['All','Approvals','Escalations','Feedback'];

  function notifType(text){
    if(!text)return'general';
    if(text.includes('💬')||text.includes('replied')||text.includes('reply'))return'feedback';
    if(text.includes('Feedback')||text.includes('feedback'))return'feedback';
    
    if(text.includes('Escalation')||text.includes('escalation'))return'escalation';
    if(text.includes('Approved')||text.includes('approved'))return'approval';
    if(text.includes('Rejected')||text.includes('rejected'))return'approval';
    if(text.includes('pproval')||text.includes('pprove'))return'approval';
    if(text.includes('Edit')||text.includes('edit request')||text.includes('resubmit'))return'edit';
    if(text.includes('Re-submitted')||text.includes('Resubmit'))return'edit';
    if(text.includes('overdue')||text.includes('Late')||text.includes('late'))return'late';
    return'general';
  }
  const TYPE_CLR={approval:'#8B5CF6',edit:'#0EA5E9',escalation:'#F97316',feedback:'#3B82F6',late:'#EF4444',general:'#6B7280'};
  const TYPE_BG={approval:'#EDE9FE',edit:'#E0F2FE',escalation:'#FFF7ED',feedback:'#EFF6FF',late:'#FEF2F2',general:'#F6F7F8'};
  const TYPE_ICON={approval:'approve',edit:'edit',escalation:'alert',feedback:'msg',late:'clock',general:'bell'};

  const filteredNotifs=tab==='All'?notifs
    :tab==='Approvals'?notifs.filter(n=>['approval','edit'].includes(notifType(n.text)))
    :tab==='Feedback'?notifs.filter(n=>notifType(n.text)==='feedback')
    :tab==='Escalations'?notifs.filter(n=>notifType(n.text)==='escalation')
    :notifs;

  const counts={
    All:notifs.length,
    Approvals:notifs.filter(n=>['approval','edit'].includes(notifType(n.text))).length,
    Escalations:notifs.filter(n=>notifType(n.text)==='escalation').length,
    Feedback:notifs.filter(n=>notifType(n.text)==='feedback').length+myFb.filter(fb=>!fb.acknowledged).length,

  };

  return '<div class="fade">'+hdr('Notifications','')
    // Tabs
    +'<div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap">'
    +TABS.map(t=>{
      const active=tab===t;
      const badge=counts[t]?(' <span style="font-size:10px;font-weight:800;padding:1px 6px;border-radius:10px;background:'+(active?'rgba(255,255,255,0.25)':'#F3F4F6')+';color:'+(active?'#fff':'#6B7280')+'">'+counts[t]+'</span>'):'';
      return '<button onclick="App._setNTab(this.dataset.t)" data-t="'+t+'" style="padding:8px 16px;border-radius:10px;font-size:14px;font-weight:600;border:none;cursor:pointer;background:'+(active?'#15171C':'transparent')+';color:'+(active?'#fff':'#6B7280')+'">'+t+badge+'</button>';
    }).join('')
    +'</div>'
    // Feedback section (when tab=Feedback)
    +(tab==='Feedback'
      ? _feedbackTabContent(uid)
      // Notification timeline for other tabs
      : (filteredNotifs.length
        ? '<div style="background:#fff;border-radius:16px;border:1px solid #E5E7EB;overflow:hidden">'
          +'<div style="display:flex;flex-direction:column">'
          +filteredNotifs.map((n,idx)=>{
              const type=notifType(n.text);
              const clr=TYPE_CLR[type];const bg=TYPE_BG[type];const ico=TYPE_ICON[type];
              const isNew=unreadIds.has(n.id);
              // Parse deep-link target from notification text
              return '<div style="display:flex;align-items:flex-start;gap:12px;padding:13px 16px;border-bottom:1px solid #F9F8F5;cursor:pointer;'+(isNew?'background:#FAFFFE':'background:#fff')+'" onclick="App._notifClick(this.dataset.id)" data-id="'+n.id+'">'
                +'<div style="width:36px;height:36px;border-radius:10px;background:'+bg+';display:grid;place-items:center;flex-shrink:0;margin-top:1px">'+ic(ico,'w-4 h-4 text-['+clr+']')+'</div>'
                +'<div style="flex:1;min-width:0">'
                +'<p style="font-size:13px;color:#111110;margin:0;line-height:1.5;font-weight:'+(isNew?'600':'400')+'">'+esc(n.text)+'</p>'
                +'<p style="font-size:11px;color:#B8B5AC;margin-top:3px">'+(n.time?new Date(n.time).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'')+' · '+type.charAt(0).toUpperCase()+type.slice(1)+'</p>'
                +'</div>'
                +(isNew?'<div style="width:7px;height:7px;border-radius:50%;background:#0E9F6E;flex-shrink:0;margin-top:6px"></div>':'')
                +'</div>';
            }).join('')
          +'</div></div>'
        : empty('bell','All clear','No notifications yet.')
      )
    )
    +'</div>';
}
App._setNTab=(t)=>{S.filters.ntab=t;rr();};
App._notifClick=(id)=>{
  const n=DB.notifications.find(x=>x.id===id);if(!n)return;
  n.read=true;_invalidateNotifCache();saveDB();
  const t=n.text||'';
  // Navigate first with clean filters, then set the tab
  if(t.includes('💬')||t.includes('replied')||t.includes('Feedback')){
    App._goNotifFeedback();return;
  }

  if(t.includes('approved')||t.includes('Approved')){
    S.route='approvals';S.search='';S.expandedCl=null;S.afOpen=null;S.tvUser=null;
    S.filters={atab:'Approved'};render();window.scrollTo(0,0);return;
  }
  if(t.includes('rejected')||t.includes('Rejected')){
    S.route='approvals';S.search='';S.expandedCl=null;S.afOpen=null;S.tvUser=null;
    S.filters={atab:'Rejected'};render();window.scrollTo(0,0);return;
  }
  if(t.includes('approval')||t.includes('Pending')){
    S.route='approvals';S.search='';S.expandedCl=null;S.afOpen=null;S.tvUser=null;
    S.filters={atab:'Pending'};render();window.scrollTo(0,0);return;
  }
  if(t.includes('submitted')||t.includes('resubmit')||t.includes('Re-submitted')){
    S.route='approvals';S.search='';S.expandedCl=null;S.afOpen=null;S.tvUser=null;
    S.filters={atab:'Pending'};render();window.scrollTo(0,0);return;
  }
  // Escalation/ticket notification → go to tickets page
  if(t.includes('Escalation')||t.includes('escalation')){
    App.go('tickets');return;
  }
  // Checklist removed → go to my checklists
  if(t.includes('Checklist removed')||t.includes('no longer assigned')){
    App.go('mychecklists');return;
  }
  // Default: go to notifications
  App._setNTab('All');App.go('notifications');
};

App._replyFb=(id)=>{
  openModal(
    '<div class="p-6">'
    +'<div class="flex justify-between mb-4"><h2 class="fd text-xl font-bold">Reply to feedback</h2><button onclick="App.closeModal()" class="text-ink-400">'+ic('x')+'</button></div>'
    +'<textarea id="rfb-t" rows="4" placeholder="Write your reply…" class="w-full bg-white border border-ink-200 rounded-xl px-3 py-2.5 text-sm rf"></textarea>'
    +'<div class="flex gap-2 mt-4">'
    +'<button onclick="App.closeModal()" style="flex:1;padding:10px;border-radius:10px;border:1.5px solid #ECEDF0;background:#fff;font-weight:600;font-size:14px;cursor:pointer">Cancel</button>'
    +'<button onclick="App._saveReplyFb(this.dataset.id)" data-id="'+id+'" style="flex:1;padding:10px;border-radius:10px;background:#15171C;color:#fff;font-weight:600;font-size:14px;border:none;cursor:pointer">Send reply</button>'
    +'</div></div>',
    'max-w-sm'
  );
};
App._saveReplyFb=(id)=>{
  const text=$('#rfb-t')?.value?.trim();if(!text){toast('Write something first','err');return;}
  const fb=DB.feedback.find(x=>x.id===id);if(!fb)return;
  fb.reply=text;fb.status='Responded';fb.repliedAt=new Date().toISOString();
  fb.replies=fb.replies||[];
  fb.replies.push({text,from:S.uid,at:new Date().toISOString()});
  // Notify manager — text must contain 'Feedback reply' so notifType detects it
  const mgr=uById(fb.managerId);
  if(mgr)DB.notifications.unshift({id:uid('n'),userId:mgr.id,
    text:'💬 Feedback reply from '+fullName(me())+': "'+text.slice(0,60)+(text.length>60?'...':'')+'"',
    time:new Date().toISOString(),read:false,fbId:id});
  _invalidateNotifCache();toast('Reply sent ✓');closeModal();saveDB();render();
};

App._openSendFeedback=(userId)=>{
  const u=uById(userId);if(!u)return;
  // Store userId on App object (not window) — cleared when modal closes
  App._sfbCls=DB.checklists.filter(c=>(c.assignees||[]).includes(userId));
  const clOptions=App._sfbCls.map(c=>'<option value="'+c.id+'">'+esc(c.name)+'</option>').join('');
  openModal(
    '<div class="p-6">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">'
    +'<h2 class="fd" style="font-size:18px;font-weight:800">Send Feedback</h2>'
    +'<button onclick="App.closeModal()" class="text-ink-400">'+ic('x')+'</button></div>'
    // User chip
    +'<div style="display:flex;align-items:center;gap:10px;background:#F0FDF4;border:1px solid #A7F3D0;border-radius:12px;padding:10px 14px;margin-bottom:16px">'
    +avatar(u,'w-10 h-10','text-xs')
    +'<div><div style="font-size:14px;font-weight:700">'+esc(fullName(u))+'</div>'
    +'<div style="font-size:12px;color:#6B7280">'+esc(u.position||u.department)+'</div></div>'
    +'</div>'
    // Type selector
    +'<div style="margin-bottom:14px"><label style="display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6B7280;margin-bottom:6px">Feedback type</label>'
    +'<input type="hidden" id="sfb-type-val" value="General">'+'<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">'
    +['General','Checklist','Performance'].map((t,i)=>'<button type="button" onclick="App._sfbSelectType(this)" data-type="'+t+'" style="padding:8px;border-radius:9px;border:1.5px solid '+(i===0?'#15171C':'#E5E7EB')+';background:'+(i===0?'#15171C':'#fff')+';color:'+(i===0?'#fff':'#6B7280')+';font-size:13px;font-weight:600;cursor:pointer">'+t+'</button>').join('')
    +'</div></div>'
    // Checklist dropdown
    +'<div id="sfb-cl-wrap" style="margin-bottom:14px"><label for="sfb-cl" style="display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6B7280;margin-bottom:6px">Checklist <span style="color:#9CA3AF;text-transform:none;font-weight:400">(optional)</span></label>'
    +'<select id="sfb-cl" onchange="App._sfbClChange(this.value)" class="w-full bg-white border border-ink-200 rounded-xl px-3 py-2.5 text-sm rf"><option value="">Select checklist…</option>'+clOptions+'</select></div>'
    // Task dropdown (updates dynamically)

    // Priority + title in one row
    +'<div style="display:grid;grid-template-columns:2fr 1fr;gap:10px;margin-bottom:14px">'
    +'<div><label for="sfb-title" style="display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6B7280;margin-bottom:6px">Title</label>'
    +'<input id="sfb-title" type="text" placeholder="e.g. Great work on opening" class="w-full bg-white border border-ink-200 rounded-xl px-3 py-2.5 text-sm rf"/></div>'
    +'<div><label for="sfb-pri" style="display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6B7280;margin-bottom:6px">Priority</label>'
    +'<select id="sfb-pri" class="w-full bg-white border border-ink-200 rounded-xl px-3 py-2.5 text-sm rf"><option>Low</option><option>Medium</option><option>High</option></select></div>'
    +'</div>'
    // Comment
    +'<div style="margin-bottom:16px"><label for="sfb-text" style="display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6B7280;margin-bottom:6px">Comment</label>'
    +'<textarea id="sfb-text" rows="4" placeholder="Write your feedback…" class="w-full bg-white border border-ink-200 rounded-xl px-3 py-2.5 text-sm rf"></textarea></div>'
    +'<button onclick="App._saveSendFeedback(this.dataset.uid)" data-uid="'+userId+'" style="width:100%;background:#15171C;color:#fff;font-weight:700;padding:13px;border-radius:12px;border:none;cursor:pointer;font-size:15px">Send feedback</button>'
    +'</div>',
    'max-w-md'
  );
};
App._sfbSelectType=(btn)=>{
  document.querySelectorAll('[data-type]').forEach(b=>{
    const active=b===btn;
    b.style.background=active?'#15171C':'#fff';
    b.style.color=active?'#fff':'#6B7280';
    b.style.borderColor=active?'#15171C':'#E5E7EB';
  });
  const type=btn.dataset.type;
  // Store in hidden input for reliable reading
  const hid=document.getElementById('sfb-type-val');if(hid)hid.value=type;
  // Show/hide checklist+task based on type — use explicit wrapper IDs
  const clWrap=document.getElementById('sfb-cl-wrap');
  const taskWrap=document.getElementById('sfb-task-wrap');
  if(type==='Performance'||type==='General'){
    if(clWrap)clWrap.style.display='none';
    if(taskWrap)taskWrap.style.display='none';
  } else if(type==='Checklist'){
    if(clWrap)clWrap.style.display='';
    if(taskWrap)taskWrap.style.display='none';
  } else {
    if(clWrap)clWrap.style.display='';
  }
};
App._sfbClChange=(clId)=>{
  // Tasks removed — task selector always hidden
  const taskWrap=document.getElementById('sfb-task-wrap');
  if(taskWrap)taskWrap.style.display='none';
};
App._saveSendFeedback=(userId)=>{
  if(!userId){toast('No user selected','err');return;}
  const title=$('#sfb-title')?.value?.trim();
  const text=$('#sfb-text')?.value?.trim();
  if(!text){toast('Write a comment','err');return;}
  const clId=$('#sfb-cl')?.value||null;
  const type=(document.getElementById('sfb-type-val')?.value)||'General';
  const priority=$('#sfb-pri')?.value||'Low';
  if(!DB.feedback)DB.feedback=[];
  DB.feedback.push({
    id:uid('fb'),title:title||type+' Feedback',type,
    checklistId:clId||null,userId,managerId:S.uid,
    date:todayISO(),text,priority,taskName:taskName||null,
    level:'direct',acknowledged:false,status:'Sent',
    createdAt:new Date().toISOString()
  });
  DB.notifications.unshift({id:uid('n'),userId,text:'Feedback from '+fullName(me())+': "'+( title||text.slice(0,40))+'"',time:new Date().toISOString(),read:false});
  _invalidateNotifCache();log(fullName(me()),'Sent feedback',fullName(uById(userId)));
  toast('Feedback sent ✓');closeModal();saveDB();render();
};
