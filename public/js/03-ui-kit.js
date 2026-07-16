/* ============================================================
   Bridge — 03-ui-kit.js  (split from Bridge.html lines 1316-1402)
   Classic script: shares top-level scope with the other /js files.
   Load order matters — see index.html.
   ============================================================ */
/* ===== AVATARS ===== */
const PAL=['bg-rose-100 text-rose-700','bg-amber-100 text-amber-700','bg-emerald-100 text-emerald-700','bg-sky-100 text-sky-700','bg-violet-100 text-violet-700','bg-orange-100 text-orange-700','bg-teal-100 text-teal-700'];
const avatar=(u,sz='w-9 h-9',tx='text-xs')=>{if(!u)return'<div class="'+sz+' bg-ink-200 rounded-full grid place-items-center '+tx+' shrink-0">?</div>';return`<div class="${sz} ${PAL[((u.firstName||'?').charCodeAt(0)+(u.lastName||'?').charCodeAt(0))%PAL.length]} rounded-full grid place-items-center font-semibold ${tx} shrink-0 fd">${esc(initials(u))}</div>`;}

/* ===== SHARED UI ===== */
const hdr=(t,s,a='')=>`<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:20px;flex-wrap:wrap"><div><h1 class="fd" style="font-size:26px;font-weight:800;letter-spacing:-.5px;line-height:1.2">${esc(t)}</h1>${s?`<p style="font-size:13px;color:#9CA3AF;margin-top:2px">${esc(s)}</p>`:''}</div><div style="display:flex;gap:8px">${a}</div></div>`;
const btnP=(l,o,i='')=>`<button onclick="${o}" style="display:inline-flex;align-items:center;gap:6px;background:#15171C;color:#fff;font-size:14px;font-weight:600;padding:10px 16px;border-radius:12px;border:none;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.12)" onmouseover="this.style.background='#0E0F13'" onmouseout="this.style.background='#15171C'">${i?ic(i,'w-4 h-4'):''}${esc(l)}</button>`;
const btnG=(l,o,i='')=>`<button onclick="${o}" style="display:inline-flex;align-items:center;gap:6px;background:#fff;color:#262A33;font-size:14px;font-weight:600;padding:10px 16px;border-radius:12px;border:1.5px solid #ECEDF0;cursor:pointer" onmouseover="this.style.background='#F6F7F8'" onmouseout="this.style.background='#fff'">${i?ic(i,'w-4 h-4'):''}${esc(l)}</button>`;
const fld=(l,id,v='',t='text',p='')=>`<div><label for="${id}" class="block text-xs font-semibold text-ink-500 mb-1">${l}</label><input id="${id}" type="${t}" value="${esc(v)}" placeholder="${esc(p)}" class="w-full bg-white border border-ink-200 rounded-xl px-3 py-2.5 text-sm rf"/></div>`;
const selF=(l,id,opts,sv='')=>`<div><label for="${id}" class="block text-xs font-semibold text-ink-500 mb-1">${l}</label><select id="${id}" class="w-full bg-white border border-ink-200 rounded-xl px-3 py-2.5 text-sm rf">${opts.map(o=>`<option value="${esc(Array.isArray(o)?o[0]:o)}" ${(Array.isArray(o)?o[0]:o)===sv?'selected':''}>${esc(Array.isArray(o)?o[1]:o)}</option>`).join('')}</select></div>`;
function mkTog(id,on,label){return`<div class="flex items-center justify-between" style="padding:7px 0;min-height:40px"><span style="font-size:14px;color:var(--c-text)">${label}</span><button id="${id}" role="switch" aria-checked="${on?'true':'false'}" aria-label="${esc(label)}" class="tog ${on?'on':'off'}" onclick="this.classList.toggle('on');this.classList.toggle('off');this.setAttribute('aria-checked',this.classList.contains('on'))"><span></span></button></div>`;}
/* card(inner,{pad,head,headRight,attrs}) — standard surface */
const togV=id=>{const el=$(`#${id}`);if(!el)return false;return el.classList?.contains('on')||false;};
const STAT_C={sky:'#0284C7',brand:'#0E9F6E',rose:'#E11D48',amber:'#D97706',orange:'#EA580C',emerald:'#059669'};
const statCard=(t,v,c='sky',oc='')=>{
  const col=STAT_C[c]||c||'#0284C7';
  if(oc){
    return '<div class="stat-card-click" onclick="'+oc+'" data-col="'+col+'" style="background:#fff;border-radius:20px;border:1px solid #ECEDF0;box-shadow:0 1px 3px rgba(16,24,40,.06);padding:16px;cursor:pointer;transition:border-color .15s,box-shadow .15s">'
      +'<div style="font-size:10px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">'+t+'</div>'
      +'<div class="fd" style="font-size:30px;font-weight:800;color:'+col+'">'+v+'</div>'
      +'<div style="font-size:11px;font-weight:700;color:#0E9F6E;margin-top:6px">View details →</div>'
      +'</div>';
  }
  return '<div style="background:#fff;border-radius:20px;border:1px solid #ECEDF0;box-shadow:0 1px 3px rgba(16,24,40,.06);padding:16px">'
    +'<div style="font-size:10px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">'+t+'</div>'
    +'<div class="fd" style="font-size:30px;font-weight:800;color:'+col+'">'+v+'</div>'
    +'</div>';
};
const empty=(i,t,s)=>`<div style="text-align:center;padding:48px 24px"><div style="width:44px;height:44px;border-radius:16px;background:#F6F7F8;color:#D1D5DB;display:grid;place-items:center;margin:0 auto 12px">${ic(i,'w-5 h-5')}</div><p class="fd" style="font-weight:600;color:#6B7280;font-size:14px">${esc(t)}</p>${s?`<p style="font-size:12px;color:#9CA3AF;margin-top:4px">${esc(s)}</p>`:''}</div>`;

/* ===== MODAL ===== */
function openModal(html,size='max-w-lg',opts={}){
  let m=$('#modal');
  // Preserve scroll when RE-RENDERING the same logical modal (same opts.key), e.g. the Access
  // Control editors that rebuild themselves on every toggle — otherwise the panel jumps to top.
  const _prevKey=m?(m.dataset.mkey||''):'';
  const _prevPop=m?m.querySelector('.pop'):null;
  const _prevScroll=_prevPop?_prevPop.scrollTop:0;
  if(!m){m=document.createElement('div');m.id='modal';document.body.appendChild(m);}
  m.className='fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-6';m.style.cssText='background:rgba(14,15,19,0.65);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)';
  m.dataset.mkey=(opts&&opts.key)||'';
  m.innerHTML=`<div role="dialog" aria-modal="true" aria-label="Dialog" class="pop w-full ${size} md:rounded-3xl rounded-t-3xl max-h-[92vh] overflow-y-auto" style="background:#fff;border:1px solid rgba(0,0,0,.1);box-shadow:0 32px 80px rgba(0,0,0,.28),0 8px 32px rgba(0,0,0,.16),0 0 0 1px rgba(255,255,255,.08)">${html}</div>`;
  m.onclick=e=>{if(e.target===m)closeModal();};
  if(opts&&opts.key&&opts.key===_prevKey){const _np=m.querySelector('.pop');if(_np){_np.scrollTop=_prevScroll;requestAnimationFrame(()=>{const p2=m&&m.querySelector('.pop');if(p2)p2.scrollTop=_prevScroll;});}}
}
const closeModal=()=>{const m=$('#modal');if(m&&m.remove)m.remove();};
const App={};window.App=App;App.closeModal=closeModal;

let _notifCache={uid:null,count:0,ts:0};
function _notifCount(){
  const uid=S.uid;if(!uid)return 0;
  const now=Date.now();
  // Cache for 3 seconds to avoid recalculating on every rr()
  if(_notifCache.uid===uid&&now-_notifCache.ts<3000)return _notifCache.count;
  let count=0;
  if(isAdmin()||isMgr()){
    const myTree=subTree(uid).map(u=>u.id);
    count+=DB.approvals.filter(a=>a.status==='Pending'&&(isAdmin()||myTree.includes(a.requesterId))).length;
  }
  count+=DB.notifications.filter(n=>n.userId===uid&&!n.read).length;
  // Count unviewed tickets assigned to me
  const unviewedTickets=(DB.tickets||[]).filter(t=>t.assignedTo===uid&&!(t.viewedBy||[]).includes(uid)).length;
  count+=unviewedTickets;
  _notifCache={uid,count,ts:now};
  return count;
}
function _invalidateNotifCache(){_notifCache.ts=0;}

// B11 fix: recover submissions stuck in 'Editing' if RUN cache lost
function _recoverEditingSubmissions(){
  if(!DB.submissions)return;
  DB.submissions.forEach(s=>{
    if(s.status==='Editing'){
      if(RUN[s.checklistId]){
        // Already has an active RUN — restore questionResponses into it
        if(!RUN[s.checklistId].questionResponses&&s.questionResponses)
          RUN[s.checklistId].questionResponses=JSON.parse(JSON.stringify(s.questionResponses||[]));
      } else {
        // No active RUN — reset status
        const today=todayISO();
        const cl=clById(s.checklistId);const late=s.date<today||(s.date===today&&cl?.scheduleTime&&nowHM()>hm2m(cl.scheduleTime));
        s.status=s.editCount>0?(late?'Late':'On Time'):(late?'Late':'Pending');
        console.info('Recovered stuck submission:',s.id,'→',s.status);
      }
    }
  });
}
