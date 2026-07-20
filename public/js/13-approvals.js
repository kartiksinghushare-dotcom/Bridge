/* ============================================================
   Bridge — 13-approvals.js  (split from Bridge.html lines 3848-4000)
   Classic script: shares top-level scope with the other /js files.
   Load order matters — see index.html.
   ============================================================ */
/* ===== APPROVALS ===== */

/* ═══ TEAM VIEW ═══ */
function teamViewPage(){
  // If no user selected → show team member picker
  if(!S.tvUser){
    // Managers see DIRECT reports only, not the full recursive tree
    const directReports=DB.users.filter(u=>u.managerId===S.uid&&u.id!==S.uid);
    const team=isAdmin()?subTree(S.uid):directReports;
    if(!team.length)return myClsPage();
    return`<div class="fade">
      ${hdr('Team','Select a team member to view their checklists')}
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px">
        ${team.map(u=>{
          const asgn=DB.checklists.filter(c=>(c.assignees||[]).includes(u.id)).length;
          const subs=DB.submissions.filter(s=>s.userId===u.id);
          const late=subs.filter(s=>s.status==='Late'&&!!clById(s.checklistId)).length;
          const tkCount=(DB.tickets||[]).filter(t=>t.submitterId===u.id&&t.status==='Open').length;
          const _uid2=u.id;
          const _statCell=(val,label,bg,color,type)=>'<div onclick="event.stopPropagation();App._showTeamStat(this.dataset.uid,this.dataset.type)" data-uid="'+_uid2+'" data-type="'+type+'" style="background:'+bg+';border-radius:8px;padding:8px 4px;cursor:pointer" title="Click to see details"><div style="font-size:18px;font-weight:800;color:'+color+'">'+val+'</div><div style="font-size:9px;font-weight:700;color:#9CA3AF;text-transform:uppercase">'+label+'</div></div>';
          const _sc=_statCell(asgn,'assigned','#F6F7F8','#13171B','assigned')+_statCell(late,'late',late?'#FFF1F2':'#F6F7F8',late?'#BE123C':'#13171B','late')+_statCell(tkCount,'tickets',tkCount?'#FFF7ED':'#F6F7F8',tkCount?'#C2410C':'#13171B','tickets');
          return`<button onclick="S.tvUser='${u.id}';S.tvCalDate=todayISO();S.tvCalWk=0;S.tvExpanded=null;rr()"
            style="background:#fff;border-radius:16px;border:1.5px solid #ECEDF0;padding:16px;text-align:left;cursor:pointer;display:flex;flex-direction:column;gap:14px;transition:all .15s"
            class="team-card-hover">
            <div style="display:flex;align-items:center;gap:10px">
              ${avatar(u,'w-12 h-12','text-sm')}
              <div><div style="font-size:14px;font-weight:700">${esc(fullName(u))}</div><div style="font-size:12px;color:#9CA3AF;margin-top:1px">${esc(u.position||u.department)}</div></div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;text-align:center">
              ${_sc}
            </div>
            <div style="font-size:12px;font-weight:600;color:#936659;display:flex;align-items:center;gap:4px">${ic('chevR','w-3.5 h-3.5')}View submissions</div>
          </button>`;
        }).join('')}
      </div>
    </div>`;
  }

  // Show selected user's checklist calendar (read-only)
  const tvU=uById(S.tvUser);
  if(!tvU){S.tvUser=null;return teamViewPage();}
  if(!S.tvCalDate)S.tvCalDate=todayISO();
  if(!S.tvCalWk)S.tvCalWk=0;


  const today=todayISO();
  const ref=new Date(today+'T00:00:00');
  const dow=ref.getDay();
  ref.setDate(ref.getDate()+(dow===0?-6:1-dow)+S.tvCalWk*7);
  const week=Array.from({length:7},(_,i)=>{const d=new Date(ref);d.setDate(d.getDate()+i);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');});
  // Snap tvCalDate to displayed week if out of sync
  if(!week.includes(S.tvCalDate)){S.tvCalDate=week.find(d=>d===today)||week[0];}
  const selDate=S.tvCalDate;
  const dayCls=myCls(S.tvUser,selDate);

  return`<div class="fade">
    <!-- Back header -->
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
      <button onclick="S.tvUser=null;rr()" style="width:34px;height:34px;border-radius:10px;border:1.5px solid #ECEDF0;background:#fff;cursor:pointer;display:grid;place-items:center;color:#6B7280">
        ${ic('back','w-4 h-4')}</button>
      ${avatar(tvU,'w-9 h-9','text-xs')}
      <div style="flex:1">
        <div class="fd" style="font-size:16px;font-weight:800">${esc(fullName(tvU))}</div>
        <div style="font-size:12px;color:#9CA3AF">${esc(tvU.position||tvU.department)}</div>
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="App._userDrill(this.dataset.id)" data-id="${S.tvUser}" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:10px;background:#F6F7F8;color:#374151;font-size:13px;font-weight:600;border:1px solid #ECEDF0;cursor:pointer">${ic('chart','w-4 h-4')}Stats</button>
        <button onclick="App._openSendFeedback(this.dataset.id)" data-id="${S.tvUser}" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:10px;background:#13171B;color:#fff;font-size:13px;font-weight:600;border:none;cursor:pointer">${ic('msg','w-4 h-4')}Send feedback</button>
      </div>
    </div>

    <!-- Sticky calendar strip -->
    <div style="position:sticky;top:52px;z-index:10;background:rgba(247,246,242,.95);backdrop-filter:blur(12px);margin:0 -16px;padding:0 16px 10px">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0">
        <span style="font-size:13px;font-weight:600;color:#B8B5AC">${selDate===today?'Today · ':''}${fmtD(selDate)}</span>
        <div style="display:flex;gap:4px;align-items:center">
          <button onclick="S.tvCalWk--;rr()" style="width:28px;height:28px;border-radius:8px;border:1.5px solid #ECEDF0;background:#fff;cursor:pointer;display:grid;place-items:center;color:#6B7280">${ic('back','w-3.5 h-3.5')}</button>
          <button onclick="S.tvCalWk=0;S.tvCalDate='${today}';rr()" style="padding:5px 10px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;border:none;background:${S.tvCalWk===0&&selDate===today?'#13171B':'#F6F7F8'};color:${S.tvCalWk===0&&selDate===today?'#fff':'#6B7280'}">Today</button>
          <button onclick="S.tvCalWk++;rr()" style="width:28px;height:28px;border-radius:8px;border:1.5px solid #ECEDF0;background:#fff;cursor:pointer;display:grid;place-items:center;color:#6B7280">${ic('chevR','w-3.5 h-3.5')}</button>
        </div>
      </div>
      <div class="cal4" style="display:flex;flex-direction:row;flex-wrap:nowrap;width:100%">
        ${week.map(d=>{
          const dn=DAYS3[new Date(d+'T00:00:00').getDay()];const num=new Date(d+'T00:00:00').getDate();
          const isT=d===today;const isSel=d===selDate;
          const dCls=myCls(S.tvUser,d);
          const hasSub=dCls.some(c=>subForCl(c,S.tvUser,d));
          const hasPend=dCls.some(c=>!subForCl(c,S.tvUser,d));
          const hasLate=hasPend&&d<today;
          return`<button onclick="S.tvCalDate='${d}';S.tvExpanded=null;rr();App._lazyLoadDate('teamview')" class="cal4-d ${isSel?'sel':''}" style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;padding:10px 4px 8px;cursor:pointer;border:none;background:${isSel?'#13171B':'transparent'};gap:2px">
            <span style="font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${isSel?'rgba(255,255,255,.4)':'#B8B5AC'}">${dn.slice(0,3)}</span>
            <span style="width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:${isSel?'#fff':isT?'#fff':'#13171B'};background:${isT&&!isSel?'#13171B':'transparent'}">${num}</span>
            <div style="display:flex;gap:2px;height:6px">
              ${hasSub?`<span style="width:5px;height:5px;border-radius:50%;background:${isSel?'rgba(255,255,255,.8)':'#A1735F'}"></span>`:'' }
              ${hasLate?`<span style="width:5px;height:5px;border-radius:50%;background:${isSel?'rgba(255,180,180,.9)':'#F43F5E'}"></span>`:hasPend?`<span style="width:5px;height:5px;border-radius:50%;background:${isSel?'rgba(255,220,120,.9)':'#F59E0B'}"></span>`:''}
            </div>
          </button>`;
        }).join('')}
      </div>
    </div>

    <!-- Checklist cards for this user/date -->
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:8px">
      ${dayCls.length?dayCls.map(c=>{
        const sub=subForCl(c,S.tvUser,selDate);
        const st=sub?sub.status:selDate<today?'Late':'Pending';
        const BC={'Late':'#F43F5E','Pending Approval':'#F97316','On Time':'#A1735F','Submitted':'#A1735F','Pending':'#F59E0B','Rejected':'#9F1239'};
        const exp=S.tvExpanded===c.id;
        return`<div style="background:#fff;border-radius:16px;border:1px solid #ECEDF0;border-left:4px solid ${BC[st]||'#D1D5DB'};overflow:hidden">
          <!-- Header -->
          <button onclick="S.tvExpanded=S.tvExpanded==='${c.id}'?null:'${c.id}';rr()" style="width:100%;text-align:left;padding:14px 16px;background:transparent;border:none;cursor:pointer;display:flex;align-items:center;gap:10px">
            <div style="flex:1;min-width:0">
              <div style="font-size:14px;font-weight:700">${esc(c.name)}</div>
              <div style="font-size:12px;color:#9CA3AF;margin-top:2px">${(c.questionIds||[]).length} question${(c.questionIds||[]).length!==1?'s':''} · ${esc(c.department)}</div>
            </div>
            <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
              ${sub&&(sub.questionResponses||[]).length?(()=>{const total=(c.questionIds||[]).length;return total?_subBadges(c,sub):'';})():''}
              ${chip(st)}
              <span style="color:#D1D5DB;transform:rotate(${exp?'90':'0'}deg);transition:transform .2s">${ic('chevR','w-4 h-4')}</span>
            </div>
          </button>
          <!-- Expanded question responses (read-only) -->
          ${exp?`<div style="border-top:1px solid #F3F4F6">
            ${(()=>{
              if(!sub)return`<div style="padding:14px 16px;font-size:13px;color:#9CA3AF">No submission for ${fmtD(selDate)}</div>`;
              const qResps=sub.questionResponses||[];
              const qs=(c.questionIds||[]).map(qid=>(DB.questions||[]).find(x=>x.id===qid)).filter(Boolean);
              if(!qs.length)return`<div style="padding:14px 16px;font-size:13px;color:#9CA3AF">No questions in this checklist</div>`;
              const escSet=_subEscalatedQids(c,sub);
              return qs.map(q=>{
                const qr=qResps.find(r=>r.questionId===q.id)||{};
                const resp=qr.response;const hasR=resp!==null&&resp!==undefined&&resp!=='';
                const esc1=escSet.has(q.id);
                const boxBg=esc1?'#EF4444':(hasR?'#A1735F':'#E5E7EB');
                const ansClr=esc1?'#BE123C':'#936659';
                return`<div style="padding:10px 14px;border-bottom:1px solid #F9FAFB;display:flex;align-items:center;gap:10px;${esc1?'background:#FFF5F5':''}">
                  <div style="width:18px;height:18px;border-radius:5px;background:${boxBg};display:grid;place-items:center;flex-shrink:0">${esc1?'<span style="color:#fff;font-size:12px;font-weight:800;line-height:1">!</span>':(hasR?'<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg>':'')}</div>
                  <div style="flex:1;min-width:0">
                    <div style="font-size:12px;font-weight:600;color:${hasR?'#13171B':'#9CA3AF'}">${esc(q.text)}${esc1?'<span style="font-size:9px;font-weight:800;color:#BE123C;background:#FFE4E6;padding:1px 6px;border-radius:8px;margin-left:6px;text-transform:uppercase;letter-spacing:.04em">Flagged</span>':''}</div>
                    ${hasR?`<div style="font-size:11px;font-weight:700;color:${ansClr};margin-top:2px">${esc(String(resp))}</div>`:'<div style="font-size:11px;color:#D1D5DB;font-style:italic;margin-top:2px">Not answered</div>'}
                    ${qr.comment?`<div style="font-size:11px;color:#6B7280;margin-top:2px;font-style:italic">"${esc(qr.comment)}"</div>`:''}
                    ${(()=>{const pl=_qrPhotoList(qr);return pl.length?'<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">'+pl.map(ph=>'<img src="'+esc(ph)+'" loading="lazy" decoding="async" alt="Task response photo" onclick="App._bigImg(this.src)" style="max-width:100px;max-height:72px;border-radius:8px;object-fit:cover;border:1px solid #E5E7EB;cursor:pointer" title="Click to enlarge"/>').join('')+'</div>':'';})()}
                  </div>
                </div>`;
              }).join('');
            })()}
            ${sub?`<div style="padding:10px 16px;font-size:11px;color:#9CA3AF;border-top:1px solid #F3F4F6">Submitted ${sub.submittedAt?new Date(sub.submittedAt).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'unknown time'}</div>`:''}
          </div>`:''}
        </div>`;
      }).join(''):`<div style="text-align:center;padding:48px 24px;color:#9CA3AF"><div style="font-size:32px;margin-bottom:8px">📅</div><div style="font-size:14px;font-weight:600">No checklists</div><div style="font-size:13px;margin-top:4px">No checklists scheduled for this date</div></div>`}
    </div>
  </div>`;
}
