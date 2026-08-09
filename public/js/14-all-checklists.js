/* ============================================================
   Bridge — 14-all-checklists.js  (split from Bridge.html lines 4001-4407)
   Classic script: shares top-level scope with the other /js files.
   Load order matters — see index.html.
   ============================================================ */
/* ===== ALL CHECKLISTS (Super Admin + Admin role) ===== */
// Read-only question responses block (adapted from team view)
function _roResponses(c,sub,date){
  if(!sub)return`<div style="padding:14px 16px;font-size:13px;color:#90A5AB">No submission for ${fmtD(date)}</div>`;
  const qResps=sub.questionResponses||[];
  const qs=(c.questionIds||[]).map(qid=>(DB.questions||[]).find(x=>x.id===qid)).filter(Boolean);
  if(!qs.length)return`<div style="padding:14px 16px;font-size:13px;color:#90A5AB">No questions in this checklist</div>`;
  const _escSetRo=_subEscalatedQids(c,sub);
  let h=qs.map(q=>{
    const qr=qResps.find(r=>r.questionId===q.id)||{};
    const resp=qr.response;const hasR=resp!==null&&resp!==undefined&&resp!=='';
    const esc1=_escSetRo.has(q.id);
    const boxBg=esc1?'#EF4444':(hasR?'#D4A72C':'#DFEAEC');
    const ansClr=esc1?'#C41E32':'#0F766E';
    return`<div style="padding:10px 14px;border-bottom:1px solid #F8FBFC;display:flex;align-items:center;gap:10px;${esc1?'background:#FEF3F3':''}">
      <div style="width:18px;height:18px;border-radius:5px;background:${boxBg};display:grid;place-items:center;flex-shrink:0">${esc1?'<span style="color:#fff;font-size:12px;font-weight:800;line-height:1">!</span>':(hasR?'<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg>':'')}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600;color:${hasR?'#10262E':'#90A5AB'}">${esc(q.text)}${esc1?'<span style="font-size:9px;font-weight:800;color:#C41E32;background:#FCE1E3;padding:1px 6px;border-radius:8px;margin-left:6px;text-transform:uppercase;letter-spacing:.04em">Flagged</span>':''}</div>
        ${hasR?`<div style="font-size:11px;font-weight:700;color:${ansClr};margin-top:2px">${esc(String(resp))}</div>`:'<div style="font-size:11px;color:#C9D9DD;font-style:italic;margin-top:2px">Not answered</div>'}
        ${qr.comment?`<div style="font-size:11px;color:#5E767D;margin-top:2px;font-style:italic">"${esc(qr.comment)}"</div>`:''}
        ${(()=>{const pl=_qrPhotoList(qr);return pl.length?'<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">'+pl.map(ph=>'<img src="'+esc(ph)+'" loading="lazy" decoding="async" alt="Task response photo" onclick="App._bigImg(this.src)" style="max-width:100px;max-height:72px;border-radius:8px;object-fit:cover;border:1px solid #DFEAEC;cursor:pointer" title="Click to enlarge"/>').join('')+'</div>':'';})()}
      </div>
    </div>`;
  }).join('');
  const by=sub.userId?uById(sub.userId):null;
  h+=`<div style="padding:10px 16px;font-size:11px;color:#90A5AB;border-top:1px solid #F1F7F8">Submitted${by?' by <strong>'+esc(fullName(by))+'</strong>':''} ${sub.submittedAt?new Date(sub.submittedAt).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):''}</div>`;
  return h;
}

function allClsPage(){
  const today=todayISO();
  if(S.filters.aclWk===undefined)S.filters.aclWk=0;
  // Week strip (Mon–Sun) — same as Team view
  const ref=new Date(today+'T00:00:00');
  const dow=ref.getDay();
  ref.setDate(ref.getDate()+(dow===0?-6:1-dow)+S.filters.aclWk*7);
  const week=Array.from({length:7},(_,i)=>{const dd=new Date(ref);dd.setDate(dd.getDate()+i);return dd.getFullYear()+'-'+String(dd.getMonth()+1).padStart(2,'0')+'-'+String(dd.getDate()).padStart(2,'0');});
  if(!S.filters.aclDate||!week.includes(S.filters.aclDate)){S.filters.aclDate=week.find(x=>x===today)||week[0];}
  const d=S.filters.aclDate;
  const dep=S.filters.aclDep||'';
  const loc=S.filters.aclLoc||'';
  const filtCls=dd=>DB.checklists.filter(c=>clOn(c,dd)&&(!dep||c.department===dep)&&(!loc||(c.locationIds||[]).includes(loc)));
  // ── Hierarchy scope: Super Admin sees everyone; Admin (SubAdmin) / managers see themselves + their tree (users under them, and users under those users) ──
  const scopeUsers=(isAdmin()||isSubAdmin()
    ? DB.users
    : [me(),...subTree(S.uid)].filter(Boolean)
  ).filter(u=>u.status==='Active');
  const scopeIds=new Set(scopeUsers.map(u=>u.id));
  const cls=filtCls(d);

  // Strip dots: aggregated across ALL users/checklists (respecting filters)
  const dayDots=dd=>{
    const dcls=filtCls(dd);
    let sub=false,pend=false;
    dcls.forEach(c=>{
      if(c.anyOne){
        if(!isAdmin()&&!isSubAdmin()&&!(c.assignees||[]).some(a=>scopeIds.has(a)))return;
        if(DB.submissions.some(x=>x.checklistId===c.id&&x.date===dd&&x.status!=='Editing'))sub=true;else pend=true;
      }
      else (c.assignees||[]).forEach(a=>{if(!scopeIds.has(a))return;if(subFor(c.id,a,dd))sub=true;else pend=true;});
    });
    return{sub,pend,late:pend&&dd<today};
  };

  const BC={'Late':'#F2495B','Pending Approval':'#0F766E','On Time':'#D4A72C','Submitted':'#D4A72C','Pending':'#E0A106','Rejected':'#A0182A','Editing':'#22A79C'};

  // One read-only expandable card
  const roCard=(c,sub,key,metaExtra)=>{
    const st=sub?sub.status:(d<today?'Late':'Pending');
    const exp=S.filters.aclExp===key;
    const ansN=sub?(sub.questionResponses||[]).filter(r=>r.response!==null&&r.response!==undefined&&r.response!=='').length:0;
    return`<div style="background:#fff;border-radius:14px;border:1px solid #E7F0F2;border-left:4px solid ${BC[st]||'#C9D9DD'};overflow:hidden">
      <button onclick="S.filters.aclExp=S.filters.aclExp==='${key}'?null:'${key}';rr()" style="width:100%;text-align:left;padding:12px 14px;background:transparent;border:none;cursor:pointer;display:flex;align-items:center;gap:10px">
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:700">${esc(c.name)}${c.anyOne?' <span title="Any one assignee can complete" style="font-size:10px;font-weight:700;padding:1px 7px;border-radius:10px;background:#F5EBCC;color:#8A6E14">\ud83d\udc65 Any one</span>':''}</div>
          <div style="font-size:12px;color:#90A5AB;margin-top:2px">${(c.questionIds||[]).length} question${(c.questionIds||[]).length!==1?'s':''}${c.department?' · '+esc(c.department):''}${metaExtra||''}</div>
        </div>
        <div style="display:flex;align-items:center;gap:5px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end">
          ${sub&&(c.questionIds||[]).length?_subBadges(c,sub,{small:true}):''}
          ${chip(st)}
          <span style="color:#C9D9DD;transform:rotate(${exp?'90':'0'}deg);transition:transform .2s">${ic('chevR','w-4 h-4')}</span>
        </div>
      </button>
      ${exp?`<div style="border-top:1px solid #F1F7F8">${_roResponses(c,sub,d)}</div>`:''}
    </div>`;
  };

  // ── Render one location's section: group ("any one") checklists, then individual checklists user-by-user.
  //    secKey is prefixed into every expand key so the same checklist/user appearing under two
  //    locations expands independently. Returns '' when this section has nothing to show. ──
  const renderSection=(sectionCls,secKey)=>{
    const sgrp=sectionCls.filter(c=>c.anyOne&&(isAdmin()||isSubAdmin()||(c.assignees||[]).some(a=>scopeIds.has(a))));
    const sind=sectionCls.filter(c=>!c.anyOne);
    const sUserMap={};
    sind.forEach(c=>(c.assignees||[]).forEach(uid2=>{if(!scopeIds.has(uid2))return;const u=uById(uid2);if(!u||u.status!=='Active')return;(sUserMap[uid2]=sUserMap[uid2]||[]).push(c);}));
    const sUserIds=Object.keys(sUserMap).sort((a,b)=>fullName(uById(a)).localeCompare(fullName(uById(b))));

    let gHtml='';
    if(sgrp.length){
      gHtml=`<div style="margin-bottom:18px;margin-top:8px">
        <div style="font-size:11px;font-weight:700;color:#90A5AB;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Group checklists — any one can complete</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${sgrp.map(c=>{
            const sub=DB.submissions.find(x=>x.checklistId===c.id&&x.date===d&&x.status!=='Editing')||null;
            const names=(c.assignees||[]).map(a=>uById(a)).filter(Boolean).map(u=>fullName(u));
            const meta=' · '+((c.assignees||[]).length)+' assignee'+((c.assignees||[]).length!==1?'s':'')+(names.length?' ('+esc(names.slice(0,3).join(', '))+(names.length>3?' +'+(names.length-3):'')+')':'');
            return roCard(c,sub,secKey+'|grp|'+c.id,meta);
          }).join('')}
        </div>
      </div>`;
    }

    let uHtml='';
    if(sUserIds.length){
      uHtml=`<div style="margin-top:${sgrp.length?'0':'8px'}">
        <div style="font-size:11px;font-weight:700;color:#90A5AB;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Individual checklists — user by user</div>
        <div style="display:flex;flex-direction:column;gap:8px">
        ${sUserIds.map(uid2=>{
          const u=uById(uid2);
          const uKey=secKey+'|'+uid2;
          const ucls=sUserMap[uid2].slice().sort((a,b)=>(a.scheduleTime||'99:99').localeCompare(b.scheduleTime||'99:99')||(a.name||'').localeCompare(b.name||''));
          const done=ucls.filter(c=>subFor(c.id,uid2,d)).length;
          const uExp=S.filters.aclU===uKey;
          const allDone=done===ucls.length;
          const flaggedN=ucls.filter(c=>{const s=subForCl(c,uid2,d);return s&&_subEscalationCount(c,s)>0;}).length;
          return`<div style="background:#fff;border-radius:16px;border:1.5px solid ${uExp?'#E6D9A8':'#E7F0F2'};overflow:hidden">
            <button onclick="S.filters.aclU=S.filters.aclU==='${uKey}'?null:'${uKey}';S.filters.aclExp=null;rr()" style="width:100%;text-align:left;padding:12px 14px;background:transparent;border:none;cursor:pointer;display:flex;align-items:center;gap:10px">
              <span style="color:#B9CBCF;transform:rotate(${uExp?90:0}deg);transition:transform .2s">${ic('chevR','w-4 h-4')}</span>
              ${avatar(u,'w-9 h-9','text-xs')}
              <div style="flex:1;min-width:0">
                <div style="font-size:14px;font-weight:700">${esc(fullName(u))}</div>
                <div style="font-size:12px;color:#90A5AB">${esc(u.position||u.department||'')}${(()=>{const mg=u.managerId?uById(u.managerId):null;return mg?' · under '+esc(fullName(mg)):'';})()}</div>
              </div>
              ${flaggedN?`<span title="${flaggedN} non-compliant submission${flaggedN>1?'s':''}" style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;background:#FEEEEF;color:#C41E32;margin-right:6px">⚠ ${flaggedN}</span>`:''}
              <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:${allDone?'#E8F7EE':'#FEF5E0'};color:${allDone?'#0F7A45':'#8A5F00'}">${done}/${ucls.length} done</span>
            </button>
            ${uExp?`<div style="padding:0 14px 12px 38px;display:flex;flex-direction:column;gap:8px;border-top:1px solid #EDF4F5;padding-top:10px">
              ${ucls.map(c=>roCard(c,subFor(c.id,uid2,d)||null,uKey+'|'+c.id,'')).join('')}
            </div>`:''}
          </div>`;
        }).join('')}
        </div>
      </div>`;
    }
    return gHtml+uHtml;
  };

  // ── Segregate checklists by location: one section per location (Dubai, etc.), then a
  //    "No location" bucket. A checklist tagged with multiple locations appears under each. ──
  let locationsHtml='';
  let anyContent=false;
  const locList=loc?DB.locations.filter(l=>l.id===loc):DB.locations.slice();
  const locHeader=(label,count,muted)=>`<div style="display:flex;align-items:center;gap:7px;margin:18px 0 10px">
      <span style="color:${muted?'#90A5AB':'#C9A227'}">${ic('pin','w-4 h-4')}</span>
      <span style="font-size:15px;font-weight:800;color:${muted?'#5E767D':'#10262E'}">${esc(label)}</span>
      <span style="font-size:11px;font-weight:700;color:#90A5AB;background:#F1F7F8;padding:2px 9px;border-radius:20px">${count}</span>
    </div>`;
  locList.forEach(l=>{
    const secCls=cls.filter(c=>(c.locationIds||[]).includes(l.id));
    if(!secCls.length)return;
    const secHtml=renderSection(secCls,'loc'+l.id);
    if(!secHtml)return;
    anyContent=true;
    locationsHtml+=locHeader(l.name,secCls.length,false)+secHtml;
  });
  if(!loc){
    const noLocCls=cls.filter(c=>!(c.locationIds||[]).length);
    if(noLocCls.length){
      const secHtml=renderSection(noLocCls,'locnone');
      if(secHtml){
        anyContent=true;
        locationsHtml+=locHeader('No location',noLocCls.length,true)+secHtml;
      }
    }
  }

  return`<div class="fade">
    ${hdr('All Checklists',"Everyone's checklists and responses")}
    <!-- Filters row -->
    <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;align-items:center">
      <select onchange="S.filters.aclDep=this.value;S.filters.aclExp=null;S.filters.aclU=null;rr()" style="background:#fff;border:1.5px solid #DFEAEC;border-radius:9px;padding:6px 10px;font-size:13px;font-weight:600;outline:none;cursor:pointer">
        <option value="">All departments</option>
        ${topDepts().map(x=>`<option value="${esc(x.name)}" ${dep===x.name?'selected':''}>${esc(x.name)}</option>`).join('')}
      </select>
      <select onchange="S.filters.aclLoc=this.value;S.filters.aclExp=null;S.filters.aclU=null;rr()" style="background:#fff;border:1.5px solid #DFEAEC;border-radius:9px;padding:6px 10px;font-size:13px;font-weight:600;outline:none;cursor:pointer">
        <option value="">All locations</option>
        ${DB.locations.map(x=>`<option value="${x.id}" ${loc===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}
      </select>
    </div>
    <!-- Sticky calendar strip (same as Team view) -->
    <div style="position:sticky;top:52px;z-index:10;background:rgba(244,249,250,.95);backdrop-filter:blur(12px);margin:0 -16px;padding:0 16px 10px">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0">
        <span style="font-size:13px;font-weight:600;color:#93A6AC">${d===today?'Today · ':''}${fmtD(d)}</span>
        <div style="display:flex;gap:4px;align-items:center">
          <button onclick="S.filters.aclWk--;S.filters.aclExp=null;rr()" style="width:28px;height:28px;border-radius:8px;border:1.5px solid #E7F0F2;background:#fff;cursor:pointer;display:grid;place-items:center;color:#5E767D">${ic('back','w-3.5 h-3.5')}</button>
          <button onclick="S.filters.aclWk=0;S.filters.aclDate='${today}';S.filters.aclExp=null;rr()" style="padding:5px 10px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;border:none;background:${S.filters.aclWk===0&&d===today?'#10262E':'#F4F9FA'};color:${S.filters.aclWk===0&&d===today?'#fff':'#5E767D'}">Today</button>
          <button onclick="S.filters.aclWk++;S.filters.aclExp=null;rr()" style="width:28px;height:28px;border-radius:8px;border:1.5px solid #E7F0F2;background:#fff;cursor:pointer;display:grid;place-items:center;color:#5E767D">${ic('chevR','w-3.5 h-3.5')}</button>
        </div>
      </div>
      <div class="cal4" style="display:flex;flex-direction:row;flex-wrap:nowrap;width:100%">
        ${week.map(dd=>{
          const dn=DAYS3[new Date(dd+'T00:00:00').getDay()];const num=new Date(dd+'T00:00:00').getDate();
          const isT=dd===today;const isSel=dd===d;
          const dots=dayDots(dd);
          return`<button onclick="S.filters.aclDate='${dd}';S.filters.aclExp=null;rr();App._lazyLoadDate('allcl')" class="cal4-d ${isSel?'sel':''}" style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;padding:10px 4px 8px;cursor:pointer;border:none;background:${isSel?'#10262E':'transparent'};gap:2px">
            <span style="font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${isSel?'rgba(255,255,255,.4)':'#93A6AC'}">${dn.slice(0,3)}</span>
            <span style="width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:${isSel?'#fff':isT?'#fff':'#10262E'};background:${isT&&!isSel?'#10262E':'transparent'}">${num}</span>
            <div style="display:flex;gap:2px;height:6px">
              ${dots.sub?`<span style="width:5px;height:5px;border-radius:50%;background:${isSel?'rgba(255,255,255,.8)':'#D4A72C'}"></span>`:''}
              ${dots.late?`<span style="width:5px;height:5px;border-radius:50%;background:${isSel?'rgba(255,180,180,.9)':'#F2495B'}"></span>`:dots.pend?`<span style="width:5px;height:5px;border-radius:50%;background:${isSel?'rgba(255,220,120,.9)':'#E0A106'}"></span>`:''}
            </div>
          </button>`;
        }).join('')}
      </div>
    </div>
    ${locationsHtml}
    ${!anyContent?`<div style="padding:60px 20px;text-align:center;background:#fff;border-radius:18px;border:1px solid #E4EDEF;margin-top:8px">
      <div style="font-size:40px;margin-bottom:10px">\ud83d\udcc5</div>
      <div class="fd" style="font-size:17px;font-weight:800;color:#10262E">${!isAdmin()&&!isSubAdmin()&&scopeUsers.length<=1?'No users under you':'No checklists'}</div>
      <p style="font-size:13px;color:#93A6AC;margin-top:6px">${!isAdmin()&&!isSubAdmin()&&scopeUsers.length<=1
        ?'This tab shows checklists for users in your reporting tree, but nobody reports to this account. Ask a Super Admin to set "Reports to" on your team members — or give the Admin role to the manager they already report to.'
        :`No checklists scheduled for this date${dep||loc?' with the selected filters':''}`}</p>
    </div>`:''}
  </div>`;
}

App._bigImg=(src)=>{openModal(`<div style="padding:10px;position:relative"><button onclick="App.closeModal()" style="position:absolute;top:6px;right:6px;background:rgba(0,0,0,.6);border:none;border-radius:50%;width:26px;height:26px;color:#fff;cursor:pointer;display:grid;place-items:center;z-index:1;font-size:14px">×</button><img src="${esc(src)}" alt="Enlarged photo" style="width:100%;border-radius:10px;max-height:80vh;object-fit:contain;display:block"/></div>`,'max-w-xl');};


function approvalsPage(){
  // Approval list scoped to this user's visibility
  let list=isAdmin()?DB.approvals:DB.approvals.filter(a=>subTree(S.uid).some(u=>u.id===a.requesterId)||a.requesterId===S.uid);
  const tab=S.filters.atab||'Pending';

  const cnt={
    Pending:list.filter(a=>a.status==='Pending').length,
    Approved:list.filter(a=>a.status==='Approved'||a.status==='Used').length,
    Rejected:list.filter(a=>a.status==='Rejected').length,
  };
  const filtered=tab==='Approved'?list.filter(a=>a.status==='Approved'||a.status==='Used'):list.filter(a=>a.status===tab);
  const TABS=['Pending','Approved','Rejected'];
  const TAB_CLR={};

  return '<div class="fade">'+hdr('Approvals','')
    +'<div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap">'
    +TABS.map(t=>{
      const active=tab===t;
      const badge=cnt[t]?(' <span style="font-size:11px;font-weight:700;padding:1px 6px;border-radius:10px;background:'+(active?'rgba(255,255,255,0.2)':'#F1F7F8')+';color:'+(active?'#fff':TAB_CLR[t]||'#5E767D')+'">'+cnt[t]+'</span>'):'';
      return '<button onclick="App._setTab(this.dataset.t)" data-t="'+t+'" style="padding:8px 16px;border-radius:10px;font-size:14px;font-weight:600;border:none;cursor:pointer;transition:all .15s;background:'+(active?'#10262E':'transparent')+';color:'+(active?'#fff':TAB_CLR[t]||'#5E767D')+'">'+t+badge+'</button>';
    }).join('')
    +'</div>'
    +'<div class="space-y-3">'
    // ── Approvals tabs ──
    +( tab!=='Feedback'
      ? (filtered.length
        ? filtered.map(a=>{
            const u=uById(a.requesterId),c=clById(a.checklistId);if(!u)return'';
            const canDecide=a.status==='Pending'&&can('approvals','decide')&&(a.requesterId!==S.uid||isAdmin());
            const canFeedback=(a.status==='Approved')&&can('approvals','decide')&&(a.requesterId!==S.uid||isAdmin());
            return '<div class="bg-white rounded-2xl border border-ink-100 shadow-soft p-4">'
              +'<div class="flex items-start gap-3">'+avatar(u,'w-10 h-10','text-xs')
              +'<div class="flex-1 min-w-0">'
              +'<div class="flex items-center gap-2 flex-wrap"><span class="font-semibold text-sm">'+esc(fullName(u))+'</span>'
              +'<span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-ink-100 text-ink-500">'+esc(a.type)+'</span></div>'
              +'<div class="text-xs text-ink-400 mt-0.5">'+esc(c?.name||'—')+' · '+fmtD(a.date)+'</div>'
              +(a.note?'<p class="text-sm text-ink-600 mt-2 bg-ink-50 rounded-xl px-3 py-2">'+esc(a.note)+'</p>':'')
              +(a.isResubmit?'<p style="font-size:11px;color:#90A5AB;margin-top:4px">Re-submitted after edit</p>':'')
              +'</div>'
              +(a.status==='Used'?'<span style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;background:#FDF3D9;color:#7A4E00">Resubmitted</span>':a.status!=='Pending'?chip(a.status):'')
              +'</div>'
              +(canDecide
                ?'<div class="flex gap-2 mt-3">'
                  +'<button onclick="App._decideApprove(this.dataset.id)" data-id="'+a.id+'" style="flex:1;padding:10px;border-radius:12px;background:#0F766E;color:#fff;font-weight:600;font-size:14px;border:none;cursor:pointer">Approve</button>'
                  +'<button onclick="App._decideReject(this.dataset.id)" data-id="'+a.id+'" style="flex:1;padding:10px;border-radius:12px;border:1.5px solid #E7F0F2;background:#fff;color:#234049;font-weight:600;font-size:14px;cursor:pointer">Reject</button>'
                  +'</div>'
                :'')
              +((canFeedback||isAdmin())
                ?'<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">'
                  +(a.type==='Submission'?'<button onclick="App._viewSubFor(this)" data-cl="'+a.checklistId+'" data-uid="'+a.requesterId+'" data-dt="'+a.date+'" style="display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#0B6660;background:#E4F2F0;border:1px solid #A7EBC2;border-radius:8px;padding:5px 10px;cursor:pointer">'+ic('eye','w-3.5 h-3.5')+'View</button>':'')
                  +(canFeedback?'<button onclick="App._addFb(this.dataset.id)" data-id="'+a.id+'" style="display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#234049;background:#F4F9FA;border:1px solid #E7F0F2;border-radius:8px;padding:5px 10px;cursor:pointer">'+ic('msg','w-3.5 h-3.5')+'Feedback</button>':'')
                  +'</div>'
                :'')
              +'</div>';
          }).join('')
        : empty('approve','No '+tab.toLowerCase()+' requests','All caught up.')
      )
      : ''
    )
    // ── Feedback tab (kept for backwards compat but not shown in TABS) ──
    +(tab==='Feedback'?(()=>{const myFeedback=DB.feedback.filter(fb=>fb.userId===S.uid);return myFeedback.length?myFeedback.map(fb=>{const mgr=uById(fb.managerId);const cl=clById(fb.checklistId);return'<div style="background:#fff;border-radius:16px;border:1px solid '+(fb.acknowledged?'#DFEAEC':'#BFE3DF')+';padding:16px;margin-bottom:10px"><div style="font-size:14px;font-weight:700">'+(cl?.name||'Checklist')+'</div><div style="font-size:12px;color:#90A5AB">From '+(mgr?esc(fullName(mgr)):'Manager')+'</div><p style="font-size:13px;margin-top:8px">'+esc(fb.text)+'</p>'+(fb.acknowledged?'':'<button onclick="App._ackFb(this.dataset.id)" data-id="'+fb.id+'" style="margin-top:8px;padding:6px 14px;border-radius:8px;background:#10262E;color:#fff;font-size:12px;font-weight:600;border:none;cursor:pointer">Acknowledge</button>')+'</div>';}).join(''):empty('msg','No feedback','Feedback appears here when managers send it.')})():'')
    +'</div></div>';
}

App._decide=async(id,status)=>{
  // Guard: cannot approve your own submission
  const _appr=DB.approvals.find(x=>x.id===id);
  if(_appr&&_appr.requesterId===S.uid&&status==='Approved'){toast('Cannot approve your own submission','err');return;}
  const a=DB.approvals.find(x=>x.id===id);if(!a)return;
  if(a.status!=='Pending'){toast('Already '+a.status.toLowerCase(),'warn');return;}
  // Immediately disable buttons to prevent double-click
  document.querySelectorAll(`[data-id="${id}"]`).forEach(b=>{b.disabled=true;b.style.opacity='0.5';});
  a.status=status;
  const u=uById(a.requesterId),c=clById(a.checklistId);
  const s=DB.submissions.find(x=>x.checklistId===a.checklistId&&x.userId===a.requesterId&&x.date===a.date);
  if(s&&a.type==='Submission'){
    if(status==='Approved'){
      s.status=s.status==='Late'?'Late':'On Time';
    } else {
      s.status='Rejected';
    }
  }
  if(s&&a.type==='Edit Request'){
    s.editRequestStatus=status;
    if(status==='Rejected')s.editRequestStatus='Rejected';
  }
  const msg=a.type==='Edit Request'
    ?(status==='Approved'?'✅ Edit approved for "'+c?.name+'" — you can now resubmit':'❌ Edit request rejected for "'+c?.name+'"')
    :(status==='Approved'
      ?'✅ Submission approved — '+c?.name+' on '+fmtD(a.date)
      :'❌ Submission rejected — '+c?.name+'. '+(a.date?fmtD(a.date):''));
  DB.notifications.unshift({id:uid('n'),userId:a.requesterId,text:msg,time:new Date().toISOString(),read:false});
  if(a.type==='Submission'){
    queueEmail(status==='Approved'?'submission_approved':'submission_rejected', a.requesterId, null, null, {checklist_name:c?.name||''});
  } else if(a.type==='Edit Request'){
    queueEmail('approval_decided', a.requesterId, null, null, {checklist_name:c?.name||''});
  }
  log(fullName(me()),status+' '+a.type,fullName(u));
  _invalidateNotifCache();
  saveDB();
  toast(status==='Approved'?'Approved ✓':'Rejected',status==='Approved'?'ok':'warn');
  _touchAction();render();
  // Targeted Supabase save — only affected rows, not full 11-table sync
  Promise.allSettled([
    sb.from('approvals').update({status:a.status}).eq('id',a.id),
    // Approving/rejecting changes ONLY the status — never rewrite question_responses here, or an
    // approver whose cache is stale would clobber the submitter's uploaded photo URLs with '[photo]'.
    s ? sb.from('submissions').update({status:s.status}).eq('id',s.id) : Promise.resolve(),
    sb.from('notifications').upsert(DB.notifications.slice(0,20).map(n=>({id:n.id,user_id:n.userId,text:n.text,read:n.read||false,created_at:n.time||new Date().toISOString()})),{onConflict:'id'}),
  ]).catch(()=>{});
};

App.viewSub=(subId)=>{
  if(!subId){toast('No submission found','warn');return;}
  const s=DB.submissions.find(x=>x.id===subId);
  if(!s){toast('Submission not found','warn');return;}
  const u=uById(s.userId);
  const c=clById(s.checklistId);
  const clName=c?esc(c.name):'<em style="color:#90A5AB">Deleted checklist</em>';
  const qResps=s.questionResponses||[];
  // If checklist deleted, reconstruct question list from saved responses
  let qs=c?(c.questionIds||[]).map(qid=>(DB.questions||[]).find(x=>x.id===qid)).filter(Boolean):[];
  if(!qs.length&&qResps.length){
    // Hydrate from DB.questions using the response questionIds
    qs=qResps.map(r=>(DB.questions||[]).find(x=>x.id===r.questionId)).filter(Boolean);
  }
  const TYPE_LABELS={answer:'Answer',number:'Number',passfail:'Pass/Fail',yesno:'Yes/No',tick:'Tick/Cross'};
  const qRows=qs.map(q=>{
    const qr=qResps.find(r=>r.questionId===q.id)||{};
    const resp=qr.response;
    const hasResp=resp!==null&&resp!==undefined&&resp!=='';
    const typeBg=Q_TYPE_BG[q.type]||'#F4F9FA';
    const typeClr=Q_TYPE_CLR[q.type]||'#5E767D';
    const typeLabel=TYPE_LABELS[q.type]||q.type;
    return'<div style="border-radius:10px;border:1px solid '+(hasResp?'#F0E4BE':'#F1F7F8')+';padding:10px 12px;background:'+(hasResp?'#F6FBFB':'#F8FBFC')+'">'
      +'<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">'
      +'<span style="font-size:10px;font-weight:700;padding:1px 7px;border-radius:5px;background:'+typeBg+';color:'+typeClr+'">'+typeLabel+'</span>'
      +'<span style="font-size:13px;font-weight:600">'+esc(q.text)+'</span>'
      +'</div>'
      +(hasResp?'<div style="font-size:13px;font-weight:700;color:#0F766E">'+esc(String(resp))+'</div>':'<div style="font-size:12px;color:#C9D9DD;font-style:italic">Not answered</div>')
      +(qr.comment?'<div style="font-size:12px;color:#5E767D;margin-top:4px;font-style:italic">"'+esc(qr.comment)+'"</div>':'')
      +(()=>{const pl=_qrPhotoList(qr);return pl.length?'<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">'+pl.map(ph=>'<img src="'+esc(ph)+'" loading="lazy" decoding="async" alt="Task response photo" onclick="App._bigImg(this.src)" style="max-width:120px;max-height:80px;border-radius:8px;object-fit:cover;border:1px solid #DFEAEC;cursor:pointer"/>').join('')+'</div>':'';})()
      +'</div>';
  }).join('');
  openModal('<div class="p-5">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
    +'<div><h2 class="fd" style="font-size:18px;font-weight:800">'+clName+'</h2>'
    +'<div style="font-size:12px;color:#90A5AB;margin-top:2px">'+(u?esc(fullName(u)):'Unknown user')+' · '+fmtD(s.date)+' · '+chip(s.status)+'</div>'
    +(c&&(c.questionIds||[]).length?'<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">'+_subBadges(c,s)+'</div>':'')
    +'</div>'
    +'<button onclick="App.closeModal()" style="background:none;border:none;cursor:pointer;color:#90A5AB">'+ic('x')+'</button>'
    +'</div>'
    +'<div style="display:flex;flex-direction:column;gap:8px">'
    +(qRows||'<div style="text-align:center;padding:20px;color:#90A5AB;font-size:13px">No questions in this submission</div>')
    +'</div>'
    +'<div style="margin-top:16px;padding-top:12px;border-top:1px solid #F1F7F8;font-size:12px;color:#90A5AB">'
    +'Submitted '+(s.submittedAt?new Date(s.submittedAt).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'-')
    +(s.editCount?' · Edited '+s.editCount+'×':'')
    +'</div></div>','max-w-lg');
};
App._addFb=(aprId)=>{const a=DB.approvals.find(x=>x.id===aprId);if(!a)return;openModal(`<div class="p-6"><div class="flex justify-between mb-4"><h2 class="fd text-xl font-bold">Add feedback</h2><button onclick="App.closeModal()" class="text-ink-400">${ic('x')}</button></div><p class="text-sm text-ink-400 mb-3">This will be sent to <strong>${esc(fullName(uById(a.requesterId)))}</strong> for acknowledgement.</p><textarea id="fb-t" rows="4" placeholder="Write feedback…" class="w-full bg-white border border-ink-200 rounded-xl px-3 py-2.5 text-sm rf"></textarea><button onclick="App._saveFb('${aprId}')" style="margin-top:16px;width:100%;background:#10262E;color:#fff;font-weight:600;padding:12px;border-radius:12px;border:none;cursor:pointer">Send feedback</button></div>`,'max-w-sm');};
App._saveFb=(aprId)=>{const a=DB.approvals.find(x=>x.id===aprId);if(!a)return;const text=$('#fb-t')?.value?.trim();if(!text){toast('Write something first','err');return;}if(!DB.feedback)DB.feedback=[];const cl=clById(a.checklistId);DB.feedback.push({id:uid('fb'),checklistId:a.checklistId,userId:a.requesterId,managerId:S.uid,date:a.date,text,level:'checklist',acknowledged:false,createdAt:new Date().toISOString()});DB.notifications.unshift({id:uid('n'),userId:a.requesterId,text:'Feedback received on '+(cl?.name||'a checklist'),time:new Date().toISOString(),read:false});queueEmail('feedback_received',a.requesterId,null,null,{checklist_name:cl?.name||''});log(fullName(me()),'Feedback sent',fullName(uById(a.requesterId)));_invalidateNotifCache();toast('Feedback sent');closeModal();saveDB();render();};
App._setTab=(t)=>{S.filters.atab=t;rr();};
App._decideApprove=(id)=>App._decide(id,'Approved');
App._decideReject=(id)=>App._decide(id,'Rejected');
App._viewSubFor=async(btn)=>{
  let s=DB.submissions.find(x=>x.checklistId===btn.dataset.cl&&x.userId===btn.dataset.uid&&x.date===btn.dataset.dt);
  if(!s){
    // Try loading from Supabase
    const{data}=await sb.from('submissions').select('*').eq('checklist_id',btn.dataset.cl).eq('user_id',btn.dataset.uid).eq('date',btn.dataset.dt).single();
    if(data){
      s={id:data.id,checklistId:data.checklist_id,userId:data.user_id,date:data.date,status:data.status||'Pending',submittedAt:data.submitted_at||null,tasks:data.tasks||[],questionResponses:data.question_responses||[],editCount:data.edit_count||0,editHistory:data.edit_history||[]};
      DB.submissions.push(s);
    }
  }
  if(s){if(DB.submissions.findIndex(x=>x.id===s.id)<0){DB.submissions.push(s);saveDB();}App.viewSub(s.id);}
  else toast('No submission found for this date','warn');
};
