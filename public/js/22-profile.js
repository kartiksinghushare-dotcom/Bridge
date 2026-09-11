/* ============================================================
   Bridge — 22-profile.js  (v132)
   The full profile page — own profile and other people's (from Users).
   Photo · personal & work details · emergency contact · documents with
   expiry · attendance · security. Everything gated by Access Control.
   Classic script: shares top-level scope with the other /js files.
   ============================================================ */

const PROF_DOC_CATS=['Passport','Visa','Emirates ID','Labour card','Contract','Certificate','Offer letter','Medical','Other'];
const PROF_TABS=[['overview','Overview'],['work','Work'],['docs','Documents'],['attendance','Attendance'],['security','Security']];

/* ── who may do what on THIS profile ── */
function _profPerm(u){
  const self=u.id===S.uid;
  const inScope=self||scopeFilter('employees')(u.id);
  const admin=isAdmin();
  return{
    self,
    view:self||(can('employees','viewProfile')&&inScope)||admin,
    sensitive:self||(can('employees','viewSensitive')&&inScope)||admin,
    editDetails:self?can('myProfile','editDetails'):(can('employees','edit')&&inScope),
    editAvatar:self?can('myProfile','editAvatar'):(can('employees','edit')&&inScope),
    editEmergency:self?can('myProfile','editEmergency'):(can('employees','edit')&&inScope),
    editHr:(can('employees','editHr')&&(inScope||self))||admin,
    manageWfh:(can('employees','manageWfh')&&(inScope||self))||admin,
    docsView:self||(can('documentsPersonal','view')&&scopeFilter('documentsPersonal')(u.id))||admin,
    docsUpload:self?can('myProfile','uploadDocs'):((can('documentsPersonal','upload')||can('documentsPersonal','create'))&&scopeFilter('documentsPersonal')(u.id)),
    docsDelete:self?can('myProfile','deleteDocs'):(can('documentsPersonal','delete')&&scopeFilter('documentsPersonal')(u.id)),
    docsDownload:self||can('documentsPersonal','download')||admin,
    attendance:self||(can('attendance','view')&&scopeFilter('attendance')(u.id)),
    dm:!self&&can('messages','send')&&typeof _dmOpenWith==='function',
  };
}
App.openProfile=(uid2)=>{const id=(uid2&&uid2!==S.uid)?uid2:null;if(S.route!=='profile')App.go('profile');S.filters.profUid=id;S.filters.profTab='overview';rr();window.scrollTo(0,0);};
function _profUser(){const id=S.filters.profUid;const u=id?uById(id):me();return u||me();}
function _profTenure(join){if(!join)return '';const d=new Date(join+'T00:00:00'),n=new Date();let m=(n.getFullYear()-d.getFullYear())*12+(n.getMonth()-d.getMonth());if(n.getDate()<d.getDate())m--;if(m<0)return '';const y=Math.floor(m/12),mm=m%12;return (y?y+' yr'+(y>1?'s':''):'')+(y&&mm?' ':'')+(mm||!y?mm+' mo':'');}
function _profAge(dob){if(!dob)return null;const d=new Date(dob+'T00:00:00'),n=new Date();let a=n.getFullYear()-d.getFullYear();if(n<new Date(n.getFullYear(),d.getMonth(),d.getDate()))a--;return a;}
function _profNextBirthday(dob){if(!dob)return null;const d=new Date(dob+'T00:00:00'),n=new Date();let b=new Date(n.getFullYear(),d.getMonth(),d.getDate());if(b<new Date(n.getFullYear(),n.getMonth(),n.getDate()))b=new Date(n.getFullYear()+1,d.getMonth(),d.getDate());return Math.round((b-new Date(n.getFullYear(),n.getMonth(),n.getDate()))/864e5);}

/* ═══════════════ PAGE ═══════════════ */
function profilePage(){
  const u=_profUser();if(!u)return '';
  const P=_profPerm(u);
  if(!P.view){S.filters.profUid=null;return `<div class="fade">${empty('lock','No access','You can’t view this person’s profile.')}</div>`;}
  _profLoadDocs(u.id);
  if(typeof _attLoadMine==='function'&&P.self)_attLoadMine();
  let tab=S.filters.profTab||'overview';
  const tabs=PROF_TABS.filter(([k])=>{if(k==='security')return P.self;if(k==='docs')return P.docsView;if(k==='attendance')return P.attendance;return true;});
  if(!tabs.some(t=>t[0]===tab))tab='overview';
  const mgr=u.managerId?uById(u.managerId):null;
  const loc=u.locationId?locById(u.locationId):null;
  const chips=[u.employeeId?['#'+u.employeeId,'key']:null,u.joiningDate?['Joined '+fmtD(u.joiningDate)+(_profTenure(u.joiningDate)?' · '+_profTenure(u.joiningDate):''),'calendar']:null,mgr?['Reports to '+fullName(mgr),'user']:null,loc?[loc.name,'pin']:null].filter(Boolean);
  const online=!!(window._bbOnline&&window._bbOnline[u.id]);
  const open=(typeof _attOpen==='function')?_attOpen(u.id):null;
  const head=`<div class="ui-card" style="overflow:hidden">
    <div style="height:74px;background:var(--grad-brand,linear-gradient(135deg,#54433C,#AF7B6D))"></div>
    <div class="ui-card-pad" style="padding-top:0">
      <div style="display:flex;align-items:flex-end;gap:14px;margin-top:-34px;flex-wrap:wrap">
        <div style="position:relative;flex-shrink:0">
          <div style="width:88px;height:88px;border-radius:50%;border:4px solid var(--c-surface);background:var(--c-surface);box-shadow:var(--sh-sm);overflow:hidden;display:grid;place-items:center">${avatar(u,'w-20 h-20','text-2xl')}</div>
          ${P.editAvatar?`<button onclick="App._profAvatarPick('${u.id}')" title="Change photo" style="position:absolute;right:-2px;bottom:2px;width:30px;height:30px;border-radius:50%;border:2px solid var(--c-surface);background:var(--c-ink);color:#fff;display:grid;place-items:center;cursor:pointer">${ic('cam','w-3.5 h-3.5')}</button>`:''}
        </div>
        <div style="flex:1;min-width:200px;padding-bottom:4px">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><h1 class="fd" style="font-size:22px;font-weight:800;line-height:1.1;color:var(--c-text)">${esc(fullName(u))}</h1>${chip(u.status||'Active')}${open?'<span style="font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:20px;background:#E9F1E8;color:#346A47">● Clocked in</span>':(online?'<span style="font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:20px;background:var(--c-surface-2);color:var(--c-text-2)">Online</span>':'')}</div>
          <div style="font-size:13.5px;color:var(--c-text-2);margin-top:3px">${esc(u.position||'—')}${u.department?' · '+esc(u.department):''}${(()=>{const r=_roleOf(u);return r?' · <span style="color:var(--c-text-3)">'+esc(r.name)+'</span>':'';})()}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${chips.map(([t,i])=>`<span style="display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;padding:3px 9px;border-radius:20px;background:var(--c-surface-2);color:var(--c-text-2)">${ic(i,'w-3 h-3')}${esc(t)}</span>`).join('')}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;padding-bottom:4px">
          ${P.dm?btn('Message',`_dmOpenWith('${u.id}')`,{variant:'ghost',size:'sm',icon:'msg'}):''}
          ${!P.self&&can('employees','edit')?btn('Edit account',`App.editUser('${u.id}')`,{variant:'ghost',size:'sm',icon:'edit'}):''}
          ${!P.self&&can('accessControl','view')?btn('Access',`App.go('accesscontrol');S.filters.acQ='${jsq(fullName(u))}';rr()`,{variant:'ghost',size:'sm',icon:'shield'}):''}
          ${P.self?btn('Notifications',`App.go('settings');S.filters.stab='mynotif';rr()`,{variant:'ghost',size:'sm',icon:'bell'}):''}
        </div>
      </div>
    </div></div>`;
  const tabsHTML=`<div class="ui-tabs" style="margin:14px 0">${tabs.map(([k,l])=>`<button class="ui-tab${tab===k?' on':''}" onclick="S.filters.profTab='${k}';rr()">${l}${k==='docs'?(()=>{const n=(DB.profileDocs&&DB.profileDocs[u.id]||[]).filter(d=>d.expiryDate&&(new Date(d.expiryDate)-Date.now())<30*864e5).length;return n?` <span style="font-size:9px;font-weight:800;padding:1px 6px;border-radius:99px;background:var(--c-danger-soft);color:var(--c-danger-ink)">${n}</span>`:'';})():''}</button>`).join('')}</div>`;
  let body='';
  if(tab==='overview')body=_profOverview(u,P);
  else if(tab==='work')body=_profWork(u,P);
  else if(tab==='docs')body=_profDocs(u,P);
  else if(tab==='attendance')body=(typeof _attMyTab==='function')?_attMyTab(u.id):'';
  else if(tab==='security')body=_profSecurity(u);
  const back=S.filters.profUid?`<button onclick="S.filters.profUid=null;App.go('users')" class="ui-btn ui-btn-ghost ui-btn-sm" style="margin-bottom:12px">${ic('back','w-4 h-4')}Back to people</button>`:'';
  return `<div class="fade">${back}${head}${tabsHTML}${body}</div>`;
}
function _profKV(items){return `<div class="prof-kv" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px 20px">${items.map(([k,v,extra])=>`<div style="min-width:0"><div style="font-size:10px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em">${k}</div><div style="font-size:14px;font-weight:600;color:var(--c-text);margin-top:2px;overflow-wrap:anywhere">${v||'<span style="color:var(--c-text-3);font-weight:500">—</span>'}${extra||''}</div></div>`).join('')}</div>`;}
function _profCard(title,inner,action){return `<div class="ui-card" style="margin-bottom:12px"><div class="ui-card-head"><span class="ui-card-title">${title}</span>${action||''}</div><div class="ui-card-pad">${inner}</div></div>`;}
function _profOverview(u,P){
  const d=u.details||{};
  const em=d.emergency||{};
  const bday=u.birthDate?fmtD(u.birthDate)+(P.sensitive&&_profAge(u.birthDate)!=null?' <span style="color:var(--c-text-3);font-weight:500">· '+_profAge(u.birthDate)+' yrs</span>':''):'';
  const nb=_profNextBirthday(u.birthDate);
  return _profCard('Personal details',_profKV([
      ['Email',`<a href="mailto:${esc(u.email)}" style="color:var(--c-brand)">${esc(u.email||'')}</a>`],
      ['Phone',u.phone?`<a href="tel:${esc(u.phone)}" style="color:var(--c-brand)">${esc(u.phone)}</a>`:''],
      P.sensitive?['Date of birth',bday,(nb!=null&&nb<=14)?' <span style="font-size:11px;font-weight:800;color:#8A6152">🎂 '+(nb===0?'today!':'in '+nb+' days')+'</span>':'']:null,
      ['Gender',esc(d.gender||'')],['Nationality',esc(d.nationality||'')],
      P.sensitive?['Home address',esc(d.address||'')]:null,
      ['Languages',esc(d.languages||'')],
    ].filter(Boolean))+(d.bio?`<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--c-border);font-size:13px;color:var(--c-text-2);line-height:1.55">${esc(d.bio)}</div>`:''),
    P.editDetails?btn('Edit',`App._profEditPersonal('${u.id}')`,{variant:'ghost',size:'sm',icon:'edit'}):'')
  +(P.sensitive?_profCard('Emergency contact',em.name?_profKV([['Name',esc(em.name)],['Phone',`<a href="tel:${esc(em.phone||'')}" style="color:var(--c-brand)">${esc(em.phone||'')}</a>`],['Relationship',esc(em.relation||'')]]):'<div style="font-size:12.5px;color:var(--c-text-3)">No emergency contact yet'+(P.editEmergency?' — add one so the team knows who to call.':'.')+'</div>',
    P.editEmergency?btn(em.name?'Edit':'Add',`App._profEditEmergency('${u.id}')`,{variant:'ghost',size:'sm',icon:'edit'}):''):'')
  +_profCard('Team',_profKV([['Reports to',u.managerId?`<button onclick="App.openProfile('${u.managerId}')" style="color:var(--c-brand);font-weight:700;background:none;border:none;padding:0;cursor:pointer;font-size:14px">${esc(fullName(uById(u.managerId)))}</button>`:''],['Direct reports',(()=>{const r=DB.users.filter(x=>x.managerId===u.id&&x.status==='Active');return r.length?r.map(x=>`<button onclick="App.openProfile('${x.id}')" style="display:inline-flex;align-items:center;gap:5px;margin:2px 6px 2px 0;font-size:12px;font-weight:600;color:var(--c-text);background:var(--c-surface-2);border:none;border-radius:20px;padding:3px 10px 3px 3px;cursor:pointer">${avatar(x,'w-5 h-5','text-[8px]')}${esc(fullName(x))}</button>`).join(''):'';})()],['Department',esc(u.department||'')],['Position',esc(u.position||'')]]));
}
function _profWork(u,P){
  const s={in:'09:00',out:'18:00',offDays:['Sun'],...(u.workSchedule||{})};
  const loc=u.locationId?locById(u.locationId):null;
  const pill=(on,l)=>`<span style="display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;padding:3px 10px;border-radius:20px;background:${on?'#E9F1E8':'var(--c-surface-2)'};color:${on?'#346A47':'var(--c-text-3)'}">${on?'✓':'✕'} ${l}</span>`;
  return _profCard('Employment',_profKV([['Employee ID',esc(u.employeeId||'')],['Joining date',u.joiningDate?fmtD(u.joiningDate)+(_profTenure(u.joiningDate)?' <span style="color:var(--c-text-3);font-weight:500">· '+_profTenure(u.joiningDate)+'</span>':''):''],['Position',esc(u.position||'')],['Department',esc(u.department||'')],['Work location',loc?esc(loc.name):'<span style="color:var(--c-text-3);font-weight:500">Any office</span>'],['Employment type',esc((u.details||{}).employmentType||'')],['Contract end',(u.details||{}).contractEnd?fmtD(u.details.contractEnd):''],['Probation ends',(u.details||{}).probationEnd?fmtD(u.details.probationEnd):'']]),
      P.editHr?btn('Edit',`App._profEditWork('${u.id}')`,{variant:'ghost',size:'sm',icon:'edit'}):'')
    +_profCard('Schedule & attendance',`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px 20px;margin-bottom:12px">
        <div><div style="font-size:10px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em">Shift</div><div style="font-size:14px;font-weight:600;margin-top:2px">${esc(s.in)} – ${esc(s.out)}</div></div>
        <div><div style="font-size:10px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em">Off days</div><div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">${WKDAYS.map(d=>`<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:${(s.offDays||[]).includes(d)?'var(--c-ink)':'var(--c-surface-2)'};color:${(s.offDays||[]).includes(d)?'#fff':'var(--c-text-2)'}">${d}</span>`).join('')}</div></div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">${pill(u.attendanceRequired!==false,'Must clock in')}${pill(!!u.wfhAllowed,'Can work from home')}</div>
      <p style="font-size:11.5px;color:var(--c-text-3);margin-top:10px;line-height:1.5">Shift times drive the late flag and the clock-in / clock-out reminders. “Can work from home” shows the WFH button on ${P.self?'your':'their'} My Day and lets ${P.self?'you':'them'} clock in without a geofence on those days.</p>`,
      (P.editHr||P.manageWfh)?btn('Edit',`App._profEditSchedule('${u.id}')`,{variant:'ghost',size:'sm',icon:'edit'}):'');
}
function _profSecurity(u){
  return _profCard('Change password',`<div style="display:grid;gap:10px;max-width:420px">${fld('Current password','pw-cur','','password','')}${fld('New password','pw-new','','password','min 6 characters')}<div><button id="pw-save-btn" onclick="if(this.disabled)return;this.disabled=true;this.textContent='Updating…';App.changePw().finally(()=>{const b=document.getElementById('pw-save-btn');if(b){b.disabled=false;b.textContent='Update password';}})" class="ui-btn ui-btn-primary ui-btn-md">Update password</button></div></div>`)
    +_profCard('Sessions & devices',`<div style="font-size:13px;color:var(--c-text-2);line-height:1.55">You are signed in as <b>${esc(u.email)}</b>. Signing out clears this device; notification and push settings for this device live under <button onclick="App.go('settings');S.filters.stab='mynotif';rr()" style="color:var(--c-brand);font-weight:700;background:none;border:none;padding:0;cursor:pointer">My notifications</button>.</div><div style="margin-top:12px">${btn('Sign out','App.logout()',{variant:'ghost',size:'sm',icon:'logout'})}</div>`);
}

/* ═══════════════ EDITORS ═══════════════ */
function _profSave(u,patch,label,after){
  return sb.from('profiles').update(patch).eq('id',u.id).then(({error})=>{if(error){_syncErr(label||'profile')(error);return false;}log(fullName(me()),'Profile updated',(u.id===S.uid?'own':fullName(u))+' · '+(label||''));saveDB();if(after)after();return true;});
}
App._profEditPersonal=(uid2)=>{
  const u=uById(uid2);if(!u)return;const P=_profPerm(u);if(!P.editDetails)return toast('You can’t edit these details','err');
  const d=u.details||{};
  modalShell({title:'Personal details',sub:fullName(u),size:'max-w-lg',key:'prof-personal',
    body:`<div style="display:grid;gap:10px">
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">${fld('First name','pp-fn',u.firstName||'')}${fld('Last name','pp-ln',u.lastName||'')}</div>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">${fld('Phone','pp-ph',u.phone||'','tel')}${P.sensitive?fld('Date of birth','pp-dob',u.birthDate||'','date'):''}</div>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">${selF('Gender','pp-gender',[['',''],'Female','Male','Other','Prefer not to say'],d.gender||'')}${fld('Nationality','pp-nat',d.nationality||'')}</div>
      ${P.sensitive?fld('Home address','pp-addr',d.address||''):''}
      ${fld('Languages','pp-lang',d.languages||'','text','e.g. English, Hindi, Arabic')}
      <div><label class="ui-label">About</label><textarea id="pp-bio" class="ui-input rf" rows="3" placeholder="A line or two about ${P.self?'yourself':'them'}">${esc(d.bio||'')}</textarea></div>
    </div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP('Save',`App._profSavePersonal('${u.id}')`)});
};
App._profSavePersonal=async(uid2)=>{
  const u=uById(uid2);if(!u)return;const P=_profPerm(u);if(!P.editDetails)return;
  const fn=($('#pp-fn')?.value||'').trim(),ln=($('#pp-ln')?.value||'').trim();if(!fn)return toast('First name is required','err');
  const d={...(u.details||{}),gender:$('#pp-gender')?.value||'',nationality:($('#pp-nat')?.value||'').trim(),languages:($('#pp-lang')?.value||'').trim(),bio:($('#pp-bio')?.value||'').trim()};
  if(P.sensitive)d.address=($('#pp-addr')?.value||'').trim();
  const patch={first_name:fn,last_name:ln,phone:($('#pp-ph')?.value||'').trim(),details:d};
  if(P.sensitive)patch.birth_date=$('#pp-dob')?.value||null;
  u.firstName=fn;u.lastName=ln;u.phone=patch.phone;u.details=d;if(P.sensitive)u.birthDate=patch.birth_date;
  closeModal();rr();
  if(await _profSave(u,patch,'personal details'))toast('Saved ✓');
};
App._profEditEmergency=(uid2)=>{
  const u=uById(uid2);if(!u)return;const P=_profPerm(u);if(!P.editEmergency)return toast('You can’t edit this','err');
  const em=(u.details||{}).emergency||{};
  modalShell({title:'Emergency contact',sub:'Who should we call if something happens?',size:'max-w-md',key:'prof-em',
    body:`<div style="display:grid;gap:10px">${fld('Full name','pe-name',em.name||'')}${fld('Phone','pe-phone',em.phone||'','tel')}${fld('Relationship','pe-rel',em.relation||'','text','e.g. Spouse, Parent, Friend')}</div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP('Save',`App._profSaveEmergency('${u.id}')`)});
};
App._profSaveEmergency=async(uid2)=>{
  const u=uById(uid2);if(!u)return;const P=_profPerm(u);if(!P.editEmergency)return;
  const d={...(u.details||{}),emergency:{name:($('#pe-name')?.value||'').trim(),phone:($('#pe-phone')?.value||'').trim(),relation:($('#pe-rel')?.value||'').trim()}};
  u.details=d;closeModal();rr();
  if(await _profSave(u,{details:d},'emergency contact'))toast('Saved ✓');
};
App._profEditWork=(uid2)=>{
  const u=uById(uid2);if(!u)return;const P=_profPerm(u);if(!P.editHr)return toast('You need Users → Edit HR details','err');
  const d=u.details||{};
  modalShell({title:'Employment details',sub:fullName(u),size:'max-w-lg',key:'prof-work',
    body:`<div style="display:grid;gap:10px">
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">${fld('Employee ID','pw-eid',u.employeeId||'')}${fld('Joining date','pw-join',u.joiningDate||'','date')}</div>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">${fld('Position','pw-pos',u.position||'')}${selF('Department','pw-dep',[['','—'],...topDepts().map(x=>[x.name,x.name])],u.department||'')}</div>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">${selF('Work location','pw-loc',[['','Any office'],...(DB.locations||[]).filter(l=>l.status!=='Inactive').map(l=>[l.id,l.name])],u.locationId||'')}${selF('Employment type','pw-type',[['',''],'Full-time','Part-time','Contract','Intern','Freelance'],d.employmentType||'')}</div>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">${fld('Probation ends','pw-prob',d.probationEnd||'','date')}${fld('Contract ends','pw-cend',d.contractEnd||'','date')}</div>
    </div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP('Save',`App._profSaveWork('${u.id}')`)});
};
App._profSaveWork=async(uid2)=>{
  const u=uById(uid2);if(!u)return;const P=_profPerm(u);if(!P.editHr)return;
  const d={...(u.details||{}),employmentType:$('#pw-type')?.value||'',probationEnd:$('#pw-prob')?.value||'',contractEnd:$('#pw-cend')?.value||''};
  const patch={employee_id:($('#pw-eid')?.value||'').trim(),joining_date:$('#pw-join')?.value||null,position:($('#pw-pos')?.value||'').trim(),department:$('#pw-dep')?.value||'',location_id:$('#pw-loc')?.value||null,details:d};
  u.employeeId=patch.employee_id;u.joiningDate=patch.joining_date;u.position=patch.position;u.department=patch.department;u.locationId=patch.location_id;u.details=d;
  closeModal();rr();
  if(await _profSave(u,patch,'employment'))toast('Saved ✓');
};
App._profEditSchedule=(uid2)=>{
  const u=uById(uid2);if(!u)return;const P=_profPerm(u);if(!(P.editHr||P.manageWfh))return toast('No permission','err');
  const s={in:'09:00',out:'18:00',offDays:['Sun'],...(u.workSchedule||{})};
  modalShell({title:'Schedule & attendance',sub:fullName(u),size:'max-w-md',key:'prof-sched',
    body:`<div style="display:grid;gap:12px">
      ${P.editHr?`<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">${fld('Shift starts','ps-in',s.in,'time')}${fld('Shift ends','ps-out',s.out,'time')}</div>
      <div><label class="ui-label">Off days</label><div style="display:flex;gap:6px;flex-wrap:wrap">${WKDAYS.map(d=>`<label style="display:inline-flex;align-items:center;gap:5px;font-size:12.5px;font-weight:600;padding:5px 10px;border-radius:20px;border:1.5px solid var(--c-border-2);cursor:pointer"><input type="checkbox" class="ps-off" value="${d}" ${(s.offDays||[]).includes(d)?'checked':''}/>${d}</label>`).join('')}</div></div>
      ${mkTog('ps-req',u.attendanceRequired!==false,'Must clock in (gets reminders, counts as absent when missing)')}`:''}
      ${P.manageWfh?mkTog('ps-wfh',!!u.wfhAllowed,'Can work from home (WFH button on My Day)'):''}
    </div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP('Save',`App._profSaveSchedule('${u.id}')`)});
};
App._profSaveSchedule=async(uid2)=>{
  const u=uById(uid2);if(!u)return;const P=_profPerm(u);if(!(P.editHr||P.manageWfh))return;
  const patch={};
  if(P.editHr){const sched={in:$('#ps-in')?.value||'09:00',out:$('#ps-out')?.value||'18:00',offDays:$$('.ps-off:checked').map(x=>x.value)};patch.work_schedule=sched;patch.attendance_required=togV('ps-req');u.workSchedule=sched;u.attendanceRequired=patch.attendance_required;}
  if(P.manageWfh){patch.wfh_allowed=togV('ps-wfh');const was=!!u.wfhAllowed;u.wfhAllowed=patch.wfh_allowed;if(was!==u.wfhAllowed&&u.id!==S.uid&&typeof _attNotify==='function')_attNotify(u.id,(u.wfhAllowed?'🏠 Work from home is now enabled on your profile.':'Work from home has been switched off on your profile.'),'home','attendance');}
  closeModal();rr();
  if(await _profSave(u,patch,'schedule'))toast('Saved ✓');
};

/* ═══════════════ AVATAR ═══════════════ */
App._profAvatarPick=(uid2)=>{
  const u=uById(uid2);if(!u)return;if(!_profPerm(u).editAvatar)return toast('No permission','err');
  let inp=document.getElementById('prof-av-input');
  if(!inp){inp=document.createElement('input');inp.type='file';inp.accept='image/*';inp.id='prof-av-input';inp.style.display='none';document.body.appendChild(inp);}
  inp.onchange=async()=>{const f=inp.files&&inp.files[0];inp.value='';if(f)await _profAvatarUpload(u,f);};
  inp.click();
};
function _profResizeImage(file,max=512){
  return new Promise((res,rej)=>{
    const img=new Image();const url=URL.createObjectURL(file);
    img.onload=()=>{try{const s=Math.min(1,max/Math.max(img.width,img.height));const w=Math.round(img.width*s),h=Math.round(img.height*s);const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);c.toBlob(b=>{URL.revokeObjectURL(url);b?res(b):rej(new Error('Could not process image'));},'image/jpeg',.86);}catch(e){rej(e);}};
    img.onerror=()=>{URL.revokeObjectURL(url);rej(new Error('Not an image'));};img.src=url;
  });
}
async function _profAvatarUpload(u,file){
  toast('Uploading photo…');
  try{
    const blob=await _profResizeImage(file,512);
    const path=u.id+'/avatar_'+Date.now()+'.jpg';
    const{error}=await sb.storage.from('avatars').upload(path,blob,{contentType:'image/jpeg',cacheControl:'3600',upsert:true});
    if(error)throw error;
    const{data}=sb.storage.from('avatars').getPublicUrl(path);
    const url=data&&data.publicUrl;if(!url)throw new Error('No URL');
    const old=u.avatarUrl;u.avatarUrl=url;render();
    const r=await sb.from('profiles').update({avatar_url:url}).eq('id',u.id);
    if(r.error){u.avatarUrl=old;render();throw r.error;}
    if(old){try{const op=old.split('/avatars/')[1];if(op)sb.storage.from('avatars').remove([decodeURIComponent(op)]).catch(()=>{});}catch(e){}}
    log(fullName(me()),'Photo updated',u.id===S.uid?'own':fullName(u));saveDB();toast('Photo updated ✓');
  }catch(e){toast('Couldn’t upload — '+(e.message||e),'err');}
}
App._profAvatarRemove=async(uid2)=>{const u=uById(uid2);if(!u||!_profPerm(u).editAvatar)return;const old=u.avatarUrl;u.avatarUrl=null;render();await sb.from('profiles').update({avatar_url:null}).eq('id',u.id);if(old){try{const op=old.split('/avatars/')[1];if(op)sb.storage.from('avatars').remove([decodeURIComponent(op)]).catch(()=>{});}catch(e){}}saveDB();};

/* ═══════════════ DOCUMENTS ═══════════════ */
let _profDocsLoaded={};
function _mPDoc(r){return{id:r.id,userId:r.user_id,name:r.name,category:r.category||'Other',storagePath:r.storage_path,fileType:r.file_type||'',fileSize:r.file_size||0,expiryDate:r.expiry_date||null,notes:r.notes||'',uploadedBy:r.uploaded_by||null,uploadedAt:r.uploaded_at};}
async function _profLoadDocs(uid2){
  if(_profDocsLoaded[uid2])return;_profDocsLoaded[uid2]=true;
  try{const{data,error}=await sb.from('profile_documents').select('*').eq('user_id',uid2).order('uploaded_at',{ascending:false});if(error)throw error;DB.profileDocs=DB.profileDocs||{};DB.profileDocs[uid2]=(data||[]).map(_mPDoc);if(S.route==='profile')rr();}
  catch(e){_profDocsLoaded[uid2]=false;console.warn('[profile docs]',e.message);}
}
function _profDocExpiry(d){if(!d.expiryDate)return null;const days=Math.round((new Date(d.expiryDate+'T00:00:00')-new Date(todayISO()+'T00:00:00'))/864e5);return days;}
function _profDocs(u,P){
  const docs=(DB.profileDocs&&DB.profileDocs[u.id])||[];
  const byCat={};docs.forEach(d=>{(byCat[d.category]=byCat[d.category]||[]).push(d);});
  const cats=Object.keys(byCat).sort((a,b)=>PROF_DOC_CATS.indexOf(a)-PROF_DOC_CATS.indexOf(b));
  const ext=n=>(String(n).split('.').pop()||'').toLowerCase();
  const ico=n=>{const e=ext(n);return e==='pdf'?'📄':/jpe?g|png|gif|webp|heic/.test(e)?'🖼️':/docx?/.test(e)?'📝':/xlsx?|csv/.test(e)?'📊':'📎';};
  const row=d=>{const days=_profDocExpiry(d);const ex=days==null?'':(days<0?`<span style="font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:20px;background:var(--c-danger-soft);color:var(--c-danger-ink)">Expired ${fmtS(d.expiryDate)}</span>`:days<=30?`<span style="font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:20px;background:var(--c-warn-soft);color:var(--c-warn-ink)">Expires in ${days} d</span>`:`<span style="font-size:10.5px;font-weight:700;color:var(--c-text-3)">Expires ${fmtS(d.expiryDate)}</span>`);
    return `<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--c-border)">
      <span style="font-size:20px;flex-shrink:0">${ico(d.name)}</span>
      <div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700;color:var(--c-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(d.name)}</div><div style="font-size:11px;color:var(--c-text-3);display:flex;gap:8px;flex-wrap:wrap;align-items:center">${ex}<span>${_fmtSize(d.fileSize)}${d.uploadedAt?' · '+fmtS(d.uploadedAt.slice(0,10)):''}${d.uploadedBy&&d.uploadedBy!==u.id?' · by '+esc(fullName(uById(d.uploadedBy))):''}</span>${d.notes?`<span>· ${esc(d.notes)}</span>`:''}</div></div>
      <div style="display:flex;gap:4px;flex-shrink:0">${P.docsDownload?`<button onclick="App._profDocOpen('${d.id}','${u.id}')" class="ui-btn ui-btn-subtle ui-btn-sm" style="min-height:30px;padding:3px 9px" title="Open">${ic('eye','w-3.5 h-3.5')}</button><button onclick="App._profDocOpen('${d.id}','${u.id}',true)" class="ui-btn ui-btn-subtle ui-btn-sm" style="min-height:30px;padding:3px 9px" title="Download">${ic('download','w-3.5 h-3.5')}</button>`:''}${P.docsDelete?`<button onclick="App._profDocDel('${d.id}','${u.id}')" class="ui-btn ui-btn-subtle ui-btn-sm" style="min-height:30px;padding:3px 9px;color:var(--c-danger-ink)" title="Delete">${ic('trash','w-3.5 h-3.5')}</button>`:''}</div>
    </div>`;};
  const expiring=docs.filter(d=>{const x=_profDocExpiry(d);return x!=null&&x<=30;}).length;
  return `${expiring?`<div style="font-size:12.5px;font-weight:700;color:var(--c-warn-ink);background:var(--c-warn-soft);border-radius:12px;padding:10px 14px;margin-bottom:12px">⚠ ${expiring} document${expiring>1?'s':''} expired or expiring within 30 days.</div>`:''}
    ${_profCard('Documents',docs.length?cats.map(c=>`<div style="margin-bottom:6px"><div style="font-size:10px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em;margin:8px 0 2px">${esc(c)} <span style="font-weight:600">· ${byCat[c].length}</span></div>${byCat[c].map(row).join('')}</div>`).join(''):`<div style="padding:18px 0;text-align:center;font-size:12.5px;color:var(--c-text-3)">${_profDocsLoaded[u.id]?'No documents yet'+(P.docsUpload?' — upload a passport, visa, contract…':'.'):'Loading…'}</div>`,
      P.docsUpload?btn('Upload',`App._profDocUpload('${u.id}')`,{variant:'primary',size:'sm',icon:'upload'}):'')}
    <p style="font-size:11.5px;color:var(--c-text-3);line-height:1.5">Files are stored privately — only ${P.self?'you':'this person'} and people with “Personal documents” access can open them. Expiry reminders go out 30 days, 7 days and on the day.</p>`;
}
App._profDocUpload=(uid2)=>{
  const u=uById(uid2);if(!u)return;if(!_profPerm(u).docsUpload)return toast('No permission to upload here','err');
  modalShell({title:'Upload document',sub:fullName(u),size:'max-w-md',key:'prof-doc',
    body:`<div style="display:grid;gap:10px">
      <div onclick="document.getElementById('pd-file').click()" ondragover="event.preventDefault();this.style.borderColor='var(--c-brand)'" ondragleave="this.style.borderColor='var(--c-border-2)'" ondrop="event.preventDefault();this.style.borderColor='var(--c-border-2)';document.getElementById('pd-file').files=event.dataTransfer.files;App._profDocPicked()" style="border:2px dashed var(--c-border-2);border-radius:14px;padding:22px;text-align:center;cursor:pointer;background:var(--c-surface-2)">
        ${ic('upload','w-6 h-6')}<div id="pd-file-lbl" style="font-size:13px;font-weight:700;margin-top:6px">Tap to choose a file</div><div style="font-size:11px;color:var(--c-text-3);margin-top:2px">PDF, images, Word, Excel · up to 25 MB</div>
        <input id="pd-file" type="file" style="display:none" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx" onchange="App._profDocPicked()"/>
      </div>
      ${fld('Name','pd-name','','text','e.g. Passport — Kartik')}
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">${selF('Category','pd-cat',PROF_DOC_CATS,'Other')}${fld('Expiry date (optional)','pd-exp','','date')}</div>
      ${fld('Notes (optional)','pd-notes','')}
      <div id="pd-prog" style="display:none;height:6px;border-radius:3px;background:var(--c-surface-2);overflow:hidden"><div id="pd-bar" style="height:100%;width:0;background:var(--c-brand);transition:width .3s"></div></div>
    </div>`,
    footer:btnG('Cancel','App.closeModal()')+`<button id="pd-go" onclick="App._profDocDo('${u.id}')" class="ui-btn ui-btn-primary ui-btn-md">Upload</button>`});
};
App._profDocPicked=()=>{const f=document.getElementById('pd-file')?.files?.[0];const l=document.getElementById('pd-file-lbl');if(f&&l)l.textContent=f.name+' · '+_fmtSize(f.size);const n=document.getElementById('pd-name');if(f&&n&&!n.value)n.value=f.name.replace(/\.[^.]+$/,'');const c=document.getElementById('pd-cat');if(f&&c){const nm=f.name.toLowerCase();const guess=PROF_DOC_CATS.find(x=>nm.includes(x.toLowerCase().split(' ')[0]));if(guess)c.value=guess;}};
App._profDocDo=async(uid2)=>{
  const u=uById(uid2);if(!u||!_profPerm(u).docsUpload)return;
  const f=document.getElementById('pd-file')?.files?.[0];if(!f)return toast('Choose a file first','err');
  if(f.size>25*1048576)return toast('File is over 25 MB','err');
  const name=($('#pd-name')?.value||'').trim()||f.name;const cat=$('#pd-cat')?.value||'Other';const exp=$('#pd-exp')?.value||null;const notes=($('#pd-notes')?.value||'').trim();
  const go=document.getElementById('pd-go');if(go){go.disabled=true;go.textContent='Uploading…';}
  const prog=document.getElementById('pd-prog'),bar=document.getElementById('pd-bar');if(prog)prog.style.display='block';if(bar)bar.style.width='35%';
  const id=uid('pdoc');const path=u.id+'/'+id+'_'+f.name.replace(/[^a-zA-Z0-9._-]/g,'_');
  try{
    const{error}=await sb.storage.from('profile-docs').upload(path,f,{cacheControl:'3600',upsert:false});if(error)throw error;
    if(bar)bar.style.width='80%';
    const row={id,user_id:u.id,name,category:cat,storage_path:path,file_type:f.type,file_size:f.size,expiry_date:exp,notes,uploaded_by:S.uid,uploaded_at:new Date().toISOString()};
    const r=await sb.from('profile_documents').insert(row);
    if(r.error){sb.storage.from('profile-docs').remove([path]).catch(()=>{});throw r.error;}   // the row is what makes the file findable — never leave an orphan blob
    DB.profileDocs=DB.profileDocs||{};(DB.profileDocs[u.id]=DB.profileDocs[u.id]||[]).unshift(_mPDoc(row));
    log(fullName(me()),'Uploaded document',(u.id===S.uid?'own':fullName(u))+' · '+name);
    if(u.id!==S.uid&&typeof _attNotify==='function')_attNotify(u.id,'📄 '+fullName(me())+' added “'+name+'” to your profile documents.','profile:'+u.id+':docs','people');
    closeModal();toast('Uploaded ✓');rr();
  }catch(e){toast('Upload failed — '+(e.message||e),'err');if(go){go.disabled=false;go.textContent='Upload';}if(prog)prog.style.display='none';}
};
App._profDocOpen=async(id,uid2,download)=>{
  const d=((DB.profileDocs||{})[uid2]||[]).find(x=>x.id===id);if(!d)return;
  const u=uById(uid2);if(!u||!_profPerm(u).docsDownload)return toast('No permission','err');
  const{data,error}=await sb.storage.from('profile-docs').createSignedUrl(d.storagePath,300,download?{download:d.name}:undefined);
  if(error||!data)return toast('Couldn’t open the file','err');
  const e=(d.name.split('.').pop()||'').toLowerCase();
  if(!download&&/jpe?g|png|gif|webp/.test(e))openModal('<div class="p-4"><div class="flex justify-between mb-3"><h3 class="fd font-bold">'+esc(d.name)+'</h3><button onclick="App.closeModal()" class="text-ink-400">'+ic('x')+'</button></div><img src="'+data.signedUrl+'" alt="" style="width:100%;border-radius:12px;max-height:70vh;object-fit:contain"/></div>','max-w-2xl');
  else{const a=document.createElement('a');a.href=data.signedUrl;a.target='_blank';a.rel='noopener';if(download)a.download=d.name;a.click();}
};
App._profDocDel=async(id,uid2)=>{
  const d=((DB.profileDocs||{})[uid2]||[]).find(x=>x.id===id);if(!d)return;
  const u=uById(uid2);if(!u||!_profPerm(u).docsDelete)return toast('No permission','err');
  if(!(await confirmP({title:'Delete document',body:'<b>'+esc(d.name)+'</b> will be permanently deleted.',confirmLabel:'Delete',cancelLabel:'Keep it'})))return;
  DB.profileDocs[uid2]=DB.profileDocs[uid2].filter(x=>x.id!==id);rr();
  const r=await sb.from('profile_documents').delete().eq('id',id);
  if(r.error){DB.profileDocs[uid2].push(d);rr();return toast('Couldn’t delete — '+r.error.message,'err');}
  sb.storage.from('profile-docs').remove([d.storagePath]).catch(()=>{});
  log(fullName(me()),'Deleted document',(u.id===S.uid?'own':fullName(u))+' · '+d.name);toast('Deleted','warn');
};
