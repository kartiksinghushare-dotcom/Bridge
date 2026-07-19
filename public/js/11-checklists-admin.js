/* ============================================================
   Bridge — 11-checklists-admin.js  (split from Bridge.html lines 2949-3311)
   Classic script: shares top-level scope with the other /js files.
   Load order matters — see index.html.
   ============================================================ */
/* ===== CHECKLIST ADMIN PAGE ===== */
function clsPage(){
  const myTeamIds=new Set([S.uid,...subTree(S.uid).map(u=>u.id)]);
let list=can('allChecklists','view')?DB.checklists:DB.checklists.filter(c=>c.createdBy===S.uid||(c.assignees||[]).includes(S.uid));
  if(S.search)list=list.filter(c=>c.name.toLowerCase().includes(S.search.toLowerCase())||c.department.toLowerCase().includes(S.search.toLowerCase()));
  return`<div class="fade">${hdr('Create Checklist',list.length+' configured',can('checklists','create')?btnP('New checklist','App.editCl()','plus'):'')}
  <div class="space-y-2.5">
    ${list.map(c=>{
      const ass=(c.assignees||[]).map(uById).filter(Boolean);
      const active=clOn(c,todayISO());
      const locs=(c.locationIds||[]).map(locById).filter(Boolean);
      return`<div class="bg-white rounded-2xl border border-ink-100 shadow-soft p-4"><div class="flex items-start gap-3"><div class="flex-1 min-w-0"><div class="flex items-center gap-2 flex-wrap mb-1"><span class="text-[11px] font-bold px-2 py-0.5 rounded-full ${active?'bg-brand-50 text-brand-700':'bg-ink-100 text-ink-400'}">${esc(c.frequency)}</span><span class="text-xs text-ink-400">${esc(c.department)}</span>${locs.length?`<span class="text-xs text-sky-600 flex items-center gap-1">${ic('pin','w-3 h-3')}${locs.map(l=>esc(l.name)).join(', ')}</span>`:''}</div><h3 class="fd font-bold">${esc(c.name)}${c.status==='Draft'?'<span style="font-size:10px;font-weight:800;padding:1px 7px;border-radius:20px;background:#FEF3C7;color:#92400E;margin-left:6px;vertical-align:middle">DRAFT</span>':''}</h3><p class="text-xs text-ink-400 mt-0.5 line-clamp-1">${esc(c.description||'')}</p><div class="flex items-center gap-3 mt-1.5 text-xs text-ink-400"><span>${ic('clock','w-3 h-3 inline mr-0.5')}${esc(c.schedule||c.frequency)}${c.scheduleTime?' · due '+c.scheduleTime:''}</span>${c.startDate?`<span>${ic('doc','w-3 h-3 inline mr-0.5')}${fmtS(c.startDate)}${c.endDate?' → '+fmtS(c.endDate):''}</span>`:''}</div></div><div class="flex flex-col items-end gap-2 shrink-0">${(can('checklists','edit')||can('checklists','duplicate')||can('checklists','delete'))?`<div class="flex gap-1">${can('checklists','edit')?`<button onclick="App.editCl('${c.id}')" title="Edit" style="width:28px;height:28px;display:grid;place-items:center;border-radius:8px;color:#9CA3AF;background:transparent;border:none;cursor:pointer" onmouseover="this.style.background='#F3F4F6'" onmouseout="this.style.background='transparent'">${ic('edit','w-3.5 h-3.5')}</button>`:''}${can('checklists','duplicate')?`<button onclick="App.dupCl('${c.id}')" title="Duplicate" style="width:28px;height:28px;display:grid;place-items:center;border-radius:8px;color:#9CA3AF;background:transparent;border:none;cursor:pointer" onmouseover="this.style.background='#EFF6FF';this.style.color='#3B82F6'" onmouseout="this.style.background='transparent';this.style.color='#9CA3AF'">${ic('copy','w-3.5 h-3.5')}</button>`:''}${can('checklists','delete')?`<button onclick="App.delCl('${c.id}')" title="Delete" style="width:28px;height:28px;display:grid;place-items:center;border-radius:8px;color:#9CA3AF;background:transparent;border:none;cursor:pointer" onmouseover="this.style.background='#FFF1F2';this.style.color='#BE123C'" onmouseout="this.style.background='transparent';this.style.color='#9CA3AF'">${ic('trash','w-3.5 h-3.5')}</button>`:''}</div>`:''}<div class="flex -space-x-1">${ass.slice(0,4).map(u=>`<div class="ring-2 ring-white rounded-full">${avatar(u,'w-6 h-6','text-[9px]')}</div>`).join('')}</div></div></div></div>`;
    }).join('')}
    ${list.length?'':empty('list','No checklists','Create your first checklist.')}
  </div></div>`;}
/* ===== CHECKLIST CREATE / EDIT ===== */
let CLD=null;

App.editCl=(id=null)=>{
  if(!can('checklists',id?'edit':'create')){toast('You don’t have permission to do that','err');return;}
  try{
    const c=id?clById(id):null;
    CLD=c?JSON.parse(JSON.stringify(c)):{
      id:uid('cl'),name:'',description:'',department:topDepts()[0]?.name||'',subDepartment:'',
      frequency:'Daily',schedule:'Every day',selectedDays:[],selectedDates:[],customDates:[],
      startDate:'',endDate:'',locationIds:[],assignees:[],tasks:[],questionIds:[],questionConfigs:{},scheduleTime:null,anyOne:false,createdBy:S.uid
    };
    _renderClModal(!!c);
  }catch(err){console.error('editCl error:',err);toast('Error opening checklist: '+err.message,'err');}
};

function _renderClModal(editing){
  if(!CLD)return'';
  const c=CLD;
  // Admin sees all users; manager sees only their direct team; regular user sees none
  const cands=(isAdmin()||isSubAdmin())?DB.users.filter(u=>u.status==='Active'):isMgr()?[me(),...subTree(S.uid)].filter(Boolean).filter(u=>u.status==='Active'):[];
  const activeLocs=DB.locations.filter(l=>l.status==='Active');
  openModal(`<div style="display:flex;flex-direction:column;max-height:92vh">
    <!-- Modal header -->
    <div class="flex items-center justify-between px-5 pt-5 pb-4 border-b border-ink-100">
      <div>
        <h2 class="fd text-xl font-bold">${editing?'Edit checklist':'New checklist'}</h2>
        <p class="text-xs text-ink-400 mt-0.5">${editing?'Update checklist settings and tasks':'Configure schedule, tasks, and assignments'}</p>
      </div>
      <button onclick="App.closeModal()" style="width:32px;height:32px;display:grid;place-items:center;border-radius:10px;background:transparent;border:none;cursor:pointer;color:#9CA3AF" onmouseover="this.style.background='#F6F7F8'" onmouseout="this.style.background='transparent'">${ic('x')}</button>
    </div>
    <!-- Scrollable body -->
    <div style="overflow-y:auto;flex:1;padding:16px 20px;display:flex;flex-direction:column;gap:20px">
      <!-- Basic info -->
      <div class="space-y-3">
        <div>
          <label for="cn-name" class="block text-xs font-bold text-ink-500 uppercase tracking-wide mb-1.5">Checklist name</label>
          <input id="cn-name" value="${esc(c.name)}" placeholder="e.g. Morning Inspection, Daily Cleaning Round…" class="w-full bg-white border-2 border-ink-200 focus:border-brand-500 rounded-xl px-3.5 py-3 text-sm font-semibold rf transition"/>
        </div>
        <div>
          <label for="cn-desc" class="block text-xs font-bold text-ink-500 uppercase tracking-wide mb-1.5">Description <span class="font-normal text-ink-300">(optional)</span></label>
          <textarea id="cn-desc" rows="2" placeholder="Brief description of this checklist's purpose…" class="w-full bg-white border-2 border-ink-200 focus:border-brand-500 rounded-xl px-3.5 py-3 text-sm rf transition resize-none">${esc(c.description)}</textarea>
        </div>
        <div class="grid grid-cols-2 gap-3">
          ${selF('Status','cn-status',['Active','Draft'],c?.status||'Active')}
       <div><label for="cn-dep" class="block text-xs font-semibold text-ink-500 mb-1">Department</label><select id="cn-dep" onchange="App._clDepChange(this.value)" class="w-full bg-white border border-ink-200 rounded-xl px-3 py-2.5 text-sm rf">${topDepts().map(d=>`<option value="${esc(d.name)}" ${d.name===c.department?'selected':''}>${esc(d.name)}</option>`).join('')}</select></div>
          <div>
            <label for="cn-freq" class="block text-xs font-bold text-ink-500 uppercase tracking-wide mb-1.5">Frequency</label>
            <select id="cn-freq" onchange="App._freqChange(this.value)" class="w-full bg-white border-2 border-ink-200 rounded-xl px-3 py-3 text-sm font-medium rf">
              ${['Daily','Weekly','Monthly','Custom'].map(f=>`<option ${c.frequency===f?'selected':''}>${f}</option>`).join('')}
            </select>
          </div>
          <div><label for="cn-subdep" class="block text-xs font-semibold text-ink-500 mb-1">Sub-department</label><select id="cn-subdep" class="w-full bg-white border border-ink-200 rounded-xl px-3 py-2.5 text-sm rf">${_clSubDeptOptions(c.department,c.subDepartment)}</select></div>
        </div>
        <div id="cn-sched" class="bg-ink-50 rounded-xl p-3">${_freqUI(c.frequency)}</div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="cn-sd" class="block text-xs font-bold text-ink-500 uppercase tracking-wide mb-1.5">Start date</label>
            <input id="cn-sd" type="date" value="${esc(c.startDate||'')}" class="w-full bg-white border-2 border-ink-200 rounded-xl px-3 py-2.5 text-sm rf"/>
          </div>
          <div>
            <label for="cn-ed" class="block text-xs font-bold text-ink-500 uppercase tracking-wide mb-1.5">End date</label>
            <input id="cn-ed" type="date" value="${esc(c.endDate||'')}" class="w-full bg-white border-2 border-ink-200 rounded-xl px-3 py-2.5 text-sm rf"/>
          </div>
        </div>
        <div>
          <label for="cn-time" class="block text-xs font-bold text-ink-500 uppercase tracking-wide mb-1.5">Deadline time <span class="font-normal text-ink-300">(marked Late if not submitted by this time)</span></label>
          <input id="cn-time" type="time" value="${esc(c.scheduleTime||'')}" class="w-full bg-white border-2 border-ink-200 rounded-xl px-3 py-2.5 text-sm rf"/>
        </div>
      </div>
      <!-- Locations -->
      ${activeLocs.length?`<div>
        <label class="block text-xs font-bold text-ink-500 uppercase tracking-wide mb-2">Locations <span class="font-normal text-ink-300">(optional)</span></label>
        <div class="flex flex-wrap gap-2">${activeLocs.map(l=>`<label class="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border-2 cursor-pointer transition ${(c.locationIds||[]).includes(l.id)?'border-sky-400 bg-sky-50 text-sky-700':'border-ink-100 text-ink-500 hover:border-ink-300'}"><input type="checkbox" class="sr-only" ${(c.locationIds||[]).includes(l.id)?'checked':''} onchange="App._togLoc('${l.id}',this.checked,this)"/>${ic('pin','w-3 h-3')} ${esc(l.name)}</label>`).join('')}</div>
      </div>`:''}
      <!-- Questions -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <label class="block text-xs font-bold text-ink-500 uppercase tracking-wide">Questions <span style="color:#EF4444">*</span></label>
          <button type="button" onclick="App._openClQuestionPicker()" style="display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:700;padding:5px 12px;border-radius:8px;background:#E8785C;color:#fff;border:none;cursor:pointer">${ic('plus','w-3 h-3')}Add question</button>
        </div>
        <div id="cn-questions" style="display:flex;flex-direction:column;gap:6px">
          ${(c.questionIds||[]).map(qid=>{const q=(DB.questions||[]).find(x=>x.id===qid);if(!q)return'';const tl=(Q_TYPES.find(t=>t.id===q.type)||{label:q.type}).label;const clr=Q_TYPE_CLR[q.type]||'#6B7280';const bg=Q_TYPE_BG[q.type]||'#F6F7F8';const cfg=(c.questionConfigs||{})[qid]||{};const escCount=Object.values(cfg).filter(v=>v).length;return`<div style="display:flex;align-items:center;gap:8px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;padding:8px 12px"><span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px;background:${bg};color:${clr};flex-shrink:0">${tl}</span><span style="flex:1;font-size:13px;font-weight:500;color:#1C1712;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(q.text)}</span>${escCount?`<span style="font-size:10px;font-weight:700;color:#EF4444;flex-shrink:0">${escCount} escalation${escCount>1?'s':''}</span>`:''}<button type="button" onclick="App._editClQuestionEscalation('${qid}')" style="font-size:11px;font-weight:600;padding:3px 8px;border-radius:6px;border:1px solid #E5E7EB;background:#fff;cursor:pointer;color:#374151;flex-shrink:0">Escalation</button><button type="button" onclick="App._removeClQuestion('${qid}')" style="width:20px;height:20px;display:grid;place-items:center;border-radius:5px;border:none;background:transparent;color:#D1D5DB;cursor:pointer;flex-shrink:0" onmouseover="this.style.color='#BE123C'" onmouseout="this.style.color='#D1D5DB'">${ic('x','w-3 h-3')}</button></div>`;}).join('')}
          ${!(c.questionIds||[]).length?`<div style="text-align:center;padding:12px;border:2px dashed #E5E7EB;border-radius:10px;font-size:12px;color:#9CA3AF">No questions added yet</div>`:''}
        </div>
      </div>
      <!-- Assign -->
      <div>
        <label class="block text-xs font-bold text-ink-500 uppercase tracking-wide mb-2">Assign to</label>
        <div class="bg-ink-50 rounded-xl p-3 mb-2">
          ${mkTog('cn-anyone',c.anyOne||false,'Any one assignee can complete')}
          <p style="font-size:11px;color:#9CA3AF;margin-top:2px">On: one submission by any assignee completes it for everyone. Off: every assignee must submit individually.</p>
        </div>
        <div class="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
          ${cands.map(u=>`<label class="flex items-center gap-2.5 p-2.5 rounded-xl border-2 cursor-pointer transition ${(c.assignees||[]).includes(u.id)?'border-brand-400 bg-brand-50':'border-ink-100 hover:border-ink-200'}">
            <input type="checkbox" class="sr-only" ${(c.assignees||[]).includes(u.id)?'checked':''} onchange="App._togAsgn('${u.id}',this.checked,this)"/>
            ${avatar(u,'w-7 h-7','text-[10px]')}
            <div class="min-w-0"><div class="text-xs font-semibold truncate">${esc(fullName(u))}</div><div class="text-[10px] text-ink-400 truncate">${esc(u.position||u.department)}</div></div>
            ${(c.assignees||[]).includes(u.id)?`<span class="ml-auto text-brand-600 shrink-0">${ic('check','w-3.5 h-3.5')}</span>`:''}
          </label>`).join('')}
        </div>
      </div>
    </div>
    <!-- Sticky footer -->
    <div class="px-5 py-4 border-t border-ink-100 flex gap-3 bg-white">
      <button onclick="App.closeModal()" class="flex-1 py-3 rounded-xl border-2 border-ink-200 font-semibold text-sm text-ink-600 hover:bg-ink-50 transition">Cancel</button>
      <button id="cl-save-btn" onclick="if(this.disabled)return;this.disabled=true;this.textContent='Saving…';try{App._saveCl(${editing});}catch(e){console.error('Save button error:',e);this.disabled=false;this.textContent='${editing?'Save changes':'Create checklist'}';}" style="flex:1;padding:12px;border-radius:12px;background:#1C1712;color:#fff;font-weight:700;font-size:14px;border:none;cursor:pointer" onmouseover="if(!this.disabled)this.style.background='#0E0F13'" onmouseout="if(!this.disabled)this.style.background='#1C1712'">${editing?'Save changes':'Create checklist'}</button>
    </div>
  </div>`,'max-w-2xl');
}

function _freqUI(freq){
  if(!CLD)return'';
  const sd=CLD?.selectedDays||[], sdt=CLD?.selectedDates||[], cdt=CLD?.customDates||[];
  const sched=CLD?.schedule||'Every day';

  if(freq==='Daily'){
    return`<div>
      <div style="font-size:10px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Schedule</div>
      <div style="display:flex;gap:6px;margin-bottom:10px">
        ${['Every day','Selected weekdays'].map(o=>`<button type="button" data-sched="${o}" onclick="App._dailySched('${o}',this)"
          style="flex:1;padding:8px;border-radius:10px;border:1.5px solid;font-size:13px;font-weight:600;cursor:pointer;transition:all .12s;background:${sched===o?'#1C1712':'#fff'};color:${sched===o?'#fff':'#6B7280'};border-color:${sched===o?'#1C1712':'#ECEDF0'}">${o}</button>`).join('')}
      </div>
      <div id="cn-daysel" style="display:${sched==='Selected weekdays'?'flex':'none'};flex-wrap:wrap;gap:6px">
        ${WKDAYS.map(d=>`<button type="button" onclick="App._togDay('${d}',this)" class="dchip ${sd.includes(d)?'on':''}">${d}</button>`).join('')}
      </div>
    </div>`;
  }

  if(freq==='Weekly'){
    return`<div>
      <div style="font-size:10px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Repeat on</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">${WKDAYS.map(d=>`<button type="button" onclick="App._togDay('${d}',this)" class="dchip ${sd.includes(d)?'on':''}">${d}</button>`).join('')}</div>
    </div>`;
  }

  if(freq==='Monthly'){
    // Include 'L' = Last day of month
    const nums=[...Array.from({length:31},(_,i)=>i+1),'L'];
    // Normalise sdt: always compare as numbers (Supabase may return strings)
    const sdtNorm=sdt.map(x=>x==='L'?'L':Number(x));
    return`<div>
      <div style="font-size:10px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Days of month</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:6px">
        ${nums.map(n=>{const on=sdtNorm.includes(n);return`<button type="button" onclick="App._togDN('${n}',this)"
          style="min-width:${n==='L'?48:32}px;height:32px;border-radius:50%;border:1.5px solid;font-size:12px;font-weight:600;cursor:pointer;transition:all .12s;background:${on?'#1C1712':'#fff'};color:${on?'#fff':'#6B7280'};border-color:${on?'#1C1712':'#ECEDF0'};${n==='L'?'border-radius:8px;padding:0 8px':''}" title="${n==='L'?'Last day of month':n}">${n==='L'?'Last':n}</button>`;}).join('')}
      </div>
      <p style="font-size:11px;color:#9CA3AF">Tip: Select "Last" to always run on the last day of any month (handles 28/29/30/31 automatically)</p>
    </div>`;
  }

  if(freq==='Custom'){
    const now=new Date();const cy=now.getFullYear(),cm=now.getMonth();
    const calYear=CLD._calYear||cy, calMonth=CLD._calMonth||cm;
    const firstDay=new Date(calYear,calMonth,1).getDay();
    const daysInMonth=new Date(calYear,calMonth+1,0).getDate();
    const MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const cdt=CLD?.customDates||[];
    const cells=[];for(let i=0;i<firstDay;i++)cells.push('');for(let d=1;d<=daysInMonth;d++)cells.push(d);while(cells.length%7!==0)cells.push('');
    const weeks=[];for(let i=0;i<cells.length;i+=7)weeks.push(cells.slice(i,i+7));
    return`<div>
      <div style="font-size:10px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Pick dates</div>
      <div style="background:#F6F7F8;border-radius:10px;padding:8px;display:inline-block;min-width:220px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <button type="button" onclick="if(!CLD._calYear)CLD._calYear=${cy};if(!CLD._calMonth&&CLD._calMonth!==0)CLD._calMonth=${cm};CLD._calMonth--;if(CLD._calMonth<0){CLD._calMonth=11;CLD._calYear--;}$('#cn-sched').innerHTML=_freqUI('Custom')" style="width:22px;height:22px;border-radius:6px;border:1px solid #ECEDF0;background:#fff;cursor:pointer;display:grid;place-items:center;color:#6B7280">${ic('back','w-3 h-3')}</button>
          <span style="font-size:12px;font-weight:700;color:#1C1712">${MN[calMonth]} ${calYear}</span>
          <button type="button" onclick="if(!CLD._calYear)CLD._calYear=${cy};if(!CLD._calMonth&&CLD._calMonth!==0)CLD._calMonth=${cm};CLD._calMonth++;if(CLD._calMonth>11){CLD._calMonth=0;CLD._calYear++;}$('#cn-sched').innerHTML=_freqUI('Custom')" style="width:22px;height:22px;border-radius:6px;border:1px solid #ECEDF0;background:#fff;cursor:pointer;display:grid;place-items:center;color:#6B7280">${ic('chevR','w-3 h-3')}</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:1px;margin-bottom:2px;text-align:center">
          ${['S','M','T','W','T','F','S'].map(d=>`<div style="font-size:9px;font-weight:700;color:#9CA3AF;padding:2px 0">${d}</div>`).join('')}
        </div>
        ${weeks.map(w=>`<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:1px">${w.map(d=>{if(!d)return'<div></div>';const iso=calYear+'-'+String(calMonth+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');const on=cdt.includes(iso);const past=iso<todayISO();return`<button type="button" onclick="App._togCalDate('${iso}')" style="aspect-ratio:1;border-radius:6px;border:none;font-size:11px;font-weight:${on?700:400};cursor:pointer;background:${on?'#1C1712':'transparent'};color:${on?'#fff':past?'#D1D5DB':'#1C1712'};padding:3px 0">${d}</button>`;}).join('')}</div>`).join('')}
      </div>
      ${cdt.length?`<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px">${cdt.sort().map(d=>`<span style="display:inline-flex;align-items:center;gap:3px;background:#1C1712;color:#fff;font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px">${fmtS(d)}<button onclick="App._remCD('${d}')" style="background:none;border:none;color:rgba(255,255,255,.6);cursor:pointer;padding:0;font-size:13px;line-height:1">×</button></span>`).join('')}</div>`:''}
    </div>`;
  }
  return'';
}

App._freqChange=f=>{
  const prev=CLD.frequency;
  CLD.frequency=f;
  if(prev!==f){
    CLD.schedule=f==='Daily'?'Every day':'';
    CLD.selectedDays=[];CLD.selectedDates=[];CLD.customDates=[];
  }
  if(f==='Custom'&&!CLD._calYear){const n=new Date();CLD._calYear=n.getFullYear();CLD._calMonth=n.getMonth();}
  const sw=$('#cn-sched');if(sw)sw.innerHTML=_freqUI(f);
};
App._dailySched=(o,el)=>{
  CLD.schedule=o;
  // Update button styles
  el.parentNode.querySelectorAll('button[data-sched]').forEach(b=>{
    const active=b.dataset.sched===o;
    b.style.background=active?'#1C1712':'#fff';
    b.style.color=active?'#fff':'#6B7280';
    b.style.borderColor=active?'#1C1712':'#ECEDF0';
  });
  // Show/hide weekday picker
  const daysel=$('#cn-daysel');
  if(daysel)daysel.style.display=o==='Selected weekdays'?'flex':'none';
};
App._togDay=(d,el)=>{const i=CLD.selectedDays.indexOf(d);if(i>-1)CLD.selectedDays.splice(i,1);else CLD.selectedDays.push(d);el.classList.toggle('on');};
App._togDN=(n,el)=>{
  if(!CLD.selectedDates)CLD.selectedDates=[];
  const val=isNaN(n)?n:Number(n);
  // Normalise existing array to same type to avoid duplicates from type mismatch
  CLD.selectedDates=CLD.selectedDates.map(x=>x==='L'?'L':Number(x));
  const i=CLD.selectedDates.indexOf(val);
  if(i>-1)CLD.selectedDates.splice(i,1);else CLD.selectedDates.push(val);
  const on=CLD.selectedDates.includes(val);
  el.style.background=on?'#1C1712':'#fff';el.style.color=on?'#fff':'#6B7280';el.style.borderColor=on?'#1C1712':'#ECEDF0';
};
App._togCalDate=(iso)=>{
  if(!CLD.customDates)CLD.customDates=[];
  const i=CLD.customDates.indexOf(iso);
  if(i>-1)CLD.customDates.splice(i,1);else CLD.customDates.push(iso);
  // Re-render the calendar
  const sw=$('#cn-sched');if(sw)sw.innerHTML=_freqUI('Custom');
};
App._remCD=d=>{CLD.customDates=(CLD.customDates||[]).filter(x=>x!==d);const w=$('#cn-cdt');if(w)w.innerHTML=(CLD.customDates||[]).map(d=>`<span style="display:inline-flex;align-items:center;gap:4px;background:#1C1712;color:#fff;font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px">${fmtS(d)}<button onclick="App._remCD('${d}')" class="opacity-70 hover:opacity-100">${ic('x','w-3 h-3')}</button></span>`).join('');};
App._togLoc=(id,on,el)=>{if(!CLD.locationIds)CLD.locationIds=[];if(on&&!CLD.locationIds.includes(id))CLD.locationIds.push(id);if(!on)CLD.locationIds=CLD.locationIds.filter(x=>x!==id);el.closest('label').className=`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl border cursor-pointer transition ${on?'border-sky-300 bg-sky-50 text-sky-700':'border-ink-200 text-ink-600'}`;};
App._togAsgn=(id,on,el)=>{if(!CLD.assignees)CLD.assignees=[];if(on&&!CLD.assignees.includes(id))CLD.assignees.push(id);if(!on)CLD.assignees=CLD.assignees.filter(a=>a!==id);el.closest('label').className=`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition text-xs ${on?'border-brand-300 bg-brand-50':'border-ink-100'}`;};


App._saveCl=async(editing)=>{
  const btn=document.getElementById('cl-save-btn');
  const _resetBtn=()=>{if(btn){btn.disabled=false;btn.removeAttribute('data-saving');btn.textContent=editing?'Save changes':'Create checklist';}};
  try{
  // Read all form values — also call _snapshotCLD for safety
  _snapshotCLD();
  CLD.name=$('#cn-name')?.value.trim()||CLD.name;CLD.description=$('#cn-desc')?.value.trim()||'';
  CLD.status=$('#cn-status')?.value||'Active';
  CLD.department=$('#cn-dep')?.value||CLD.department;CLD.subDepartment=$('#cn-subdep')?.value||'';CLD.frequency=$('#cn-freq')?.value||CLD.frequency;
  CLD.startDate=$('#cn-sd')?.value||null;CLD.endDate=$('#cn-ed')?.value||null;
  CLD.scheduleTime=$('#cn-time')?.value||null;
  if($('#cn-anyone'))CLD.anyOne=$('#cn-anyone').classList.contains('on');
  if(!CLD.name){toast('Name required','err');_resetBtn();return;}
  CLD.questionIds=CLD.questionIds||[];CLD.questionConfigs=CLD.questionConfigs||{};CLD.tasks=CLD.tasks||[];
  if(!CLD.questionIds.length){toast('Add at least one question','err');_resetBtn();return;}
  // ── Saving state ──
  if(btn){btn.disabled=true;btn.setAttribute('data-saving','1');btn.textContent=editing?'Saving…':'Creating…';}
  const prevAssignees=editing?((clById(CLD.id)?.assignees)||[]):[];
  // ── Write to Supabase FIRST. Only commit local state / audit log / notifications
  //    AFTER the server confirms the write, so nothing is ever "created" in the UI
  //    or audit log without actually being stored in the database. ──
  const _cld=CLD;
  const clRow={id:_cld.id,name:_cld.name,description:_cld.description||'',department:_cld.department||'',sub_department:_cld.subDepartment||'',frequency:_cld.frequency||'Daily',schedule:_cld.schedule||'',selected_days:_cld.selectedDays||[],selected_dates:_cld.selectedDates||[],custom_dates:_cld.customDates||[],start_date:_cld.startDate||null,end_date:_cld.endDate||null,location_ids:_cld.locationIds||[],assignees:_cld.assignees||[],tasks:_cld.tasks||[],question_ids:_cld.questionIds||[],question_configs:_cld.questionConfigs||{},schedule_time:_cld.scheduleTime||null,status:_cld.status||'Active',any_one:_cld.anyOne||false,created_by:_cld.createdBy||null};
  let _res;
  try{_res=await sb.from('checklists').upsert(clRow,{onConflict:'id'});}
  catch(e){_res={error:e};}
  if(_res&&_res.error){
    console.error('Checklist save failed:',_res.error.message||_res.error);
    toast('Couldn’t save to server — please retry. ('+String(_res.error.message||_res.error).slice(0,48)+')','err');
    _resetBtn();
    return;
  }
  // ── Server confirmed → commit locally ──
  const _existIdx=DB.checklists.findIndex(c=>c.id===_cld.id);
  if(_existIdx>-1){DB.checklists[_existIdx]=_cld;}else{DB.checklists.push(_cld);}
  const newlyAssigned=(_cld.assignees||[]).filter(uid2=>!prevAssignees.includes(uid2)&&uid2!==S.uid);
  newlyAssigned.forEach(uid2=>{
    DB.notifications.unshift({id:uid('n'),userId:uid2,text:'📋 Checklist assigned: "'+_cld.name+'"',time:new Date().toISOString(),read:false});
    queueEmail('checklist_assigned',uid2,null,null,{checklist_name:_cld.name});
  });
  if(newlyAssigned.length)_invalidateNotifCache();
  log(fullName(me()),editing?'Edited cl':'Created cl',_cld.name);
  const toastMsg=editing?'Saved to server ✓':'Checklist created ✓';
  CLD=null;
  App._clQSel=null;
  closeModal();
  toast(toastMsg);
  saveDB();
  render();
  }catch(err){
    console.error('_saveCl error:',err);
    toast('Error saving: '+(err&&err.message||err),'err');
    _resetBtn();
  }
};
App.dupCl=async(id)=>{
  if(!can('checklists','duplicate')){toast('You don’t have permission to duplicate checklists','err');return;}
  const src=clById(id);if(!src)return;
  const newId=uid('cl');
  const copy=JSON.parse(JSON.stringify(src)); // deep clone
  copy.id=newId;
  copy.name='Duplicated — '+src.name;
  copy.status='Draft';          // always draft so it can be reviewed before going live
  copy.assignees=[];            // clear assignees — manager will assign fresh
  copy.startDate='';
  copy.endDate='';
  copy.createdBy=S.uid;
  // Give each task a fresh ID to avoid any ID collisions
  (copy.tasks||[]).forEach(t=>{t.id=uid('t');});
  // ── Write to Supabase FIRST, then reflect locally only on success ──
  toast('Duplicating…');
  let _dres;
  try{_dres=await sb.from('checklists').insert({
    id:copy.id,name:copy.name,description:copy.description||'',
    department:copy.department||'',frequency:copy.frequency||'Daily',
    schedule:copy.schedule||'',selected_days:copy.selectedDays||[],
    selected_dates:copy.selectedDates||[],custom_dates:copy.customDates||[],
    start_date:null,end_date:null,
    location_ids:copy.locationIds||[],assignees:[],tasks:copy.tasks||[],question_ids:copy.questionIds||[],question_configs:JSON.parse(JSON.stringify(copy.questionConfigs||{})),schedule_time:copy.scheduleTime||null,any_one:copy.anyOne||false,
    status:'Draft',created_by:S.uid
  });}catch(e){_dres={error:e};}
  if(_dres&&_dres.error){
    console.error('dupCl failed:',_dres.error.message||_dres.error);
    toast('Couldn’t duplicate — please retry.','err');
    return;
  }
  copy.assignees=[];
  DB.checklists.unshift(copy);  // show at top of list
  log(fullName(me()),'Duplicated checklist',src.name);
  toast('✓ Duplicated as Draft — tap Edit to make changes');
  saveDB();render();
};

App.delCl=async(id)=>{
  if(!can('checklists','delete')){toast('You don’t have permission to delete checklists','err');return;}
  const c=clById(id);if(!c)return;
  // ── Guard: a checklist that is still assigned to people must not be deleted. ──
  if((c.assignees||[]).length){
    alert("Can't delete \""+(c.name||'this checklist')+"\" — it's assigned to "+c.assignees.length+' user'+(c.assignees.length>1?'s':'')+".\n\nOpen the checklist and remove everyone from Assignees first, or set its Status to Inactive to pause it. Past submissions are always kept.");
    return;
  }
  if(!confirm('Delete "'+c.name+'"?\n\nPast submissions will be preserved.'))return;
  // ── Delete on the server FIRST. Only update local state / audit log after
  //    the server confirms, so the UI and DB never disagree. ──
  toast('Deleting…','warn');
  let _dr;
  try{_dr=await sb.from('checklists').delete().eq('id',id);}catch(e){_dr={error:e};}
  if(_dr&&_dr.error){
    console.error('delCl failed:',_dr.error.message||_dr.error);
    toast('Couldn’t delete — please retry.','err');
    return;
  }
  // ── Server confirmed → reflect locally ──
  DB.checklists=DB.checklists.filter(x=>x.id!==id);
  if(!DB.checklists_deleted)DB.checklists_deleted=[];
  if(!DB.checklists_deleted.includes(id))DB.checklists_deleted.push(id);
  DB.submissions.filter(s=>s.checklistId===id).forEach(s=>s.checklistDeleted=true);
  const clAssignees=c.assignees||[];
  clAssignees.forEach(uid2=>{if(uid2!==S.uid)DB.notifications.unshift({id:uid('n'),userId:uid2,text:'Checklist removed: "'+c.name+'" is no longer assigned to you',time:new Date().toISOString(),read:false});});
  _invalidateNotifCache();log(fullName(me()),'Deleted cl',c.name);
  toast('Deleted','warn');saveDB();render();
};

