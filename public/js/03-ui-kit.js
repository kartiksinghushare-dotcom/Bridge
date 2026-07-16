/* ============================================================
   Bridge — 03-ui-kit.js  (split from Bridge.html lines 1316-1402)
   Classic script: shares top-level scope with the other /js files.
   Load order matters — see index.html.
   ============================================================ */
/* ===== AVATARS ===== */
const PAL=['bg-rose-100 text-rose-700','bg-amber-100 text-amber-700','bg-emerald-100 text-emerald-700','bg-sky-100 text-sky-700','bg-violet-100 text-violet-700','bg-orange-100 text-orange-700','bg-teal-100 text-teal-700'];
const avatar=(u,sz='w-9 h-9',tx='text-xs')=>{if(!u)return'<div class="'+sz+' bg-ink-200 rounded-full grid place-items-center '+tx+' shrink-0">?</div>';return`<div class="${sz} ${PAL[((u.firstName||'?').charCodeAt(0)+(u.lastName||'?').charCodeAt(0))%PAL.length]} rounded-full grid place-items-center font-semibold ${tx} shrink-0 fd">${esc(initials(u))}</div>`;}

/* ═══════════ SHARED UI — token-driven design system (Evarca-aligned) ═══════════
   ONE button helper btn() with variants; btnP/btnG kept as thin aliases so every
   existing call site keeps working. New code can call btn() directly. */
const hdr=(t,s,a='')=>`<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:22px;flex-wrap:wrap"><div style="min-width:0"><h1 class="fd" style="font-size:var(--fs-h1);font-weight:800;letter-spacing:-.6px;line-height:1.15;color:var(--c-text)">${esc(t)}</h1>${s?`<p style="font-size:14px;color:var(--c-text-2);margin-top:4px">${esc(s)}</p>`:''}</div><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-start">${a}</div></div>`;
const pageHeader=hdr;
function btn(label,onclick,opts={}){
  const v=opts.variant||'primary',sz=opts.size||'md',i=opts.icon||'';
  const dis=opts.disabled?' aria-disabled="true"':'';
  const extra=opts.attrs?(' '+opts.attrs):'';
  return `<button type="button" onclick="${onclick}" class="ui-btn ui-btn-${v} ui-btn-${sz}"${dis}${extra}>${i?ic(i,sz==='sm'?'w-4 h-4':'w-[18px] h-[18px]'):''}${esc(label)}</button>`;
}
const btnP=(l,o,i='')=>btn(l,o,{variant:'primary',icon:i});
const btnG=(l,o,i='')=>btn(l,o,{variant:'ghost',icon:i});
const btnDanger=(l,o,i='')=>btn(l,o,{variant:'danger',icon:i});
const fld=(l,id,v='',t='text',p='')=>`<div><label for="${id}" class="ui-label">${l}</label><input id="${id}" type="${t}" value="${esc(v)}" placeholder="${esc(p)}" class="ui-input rf"/></div>`;
const selF=(l,id,opts,sv='')=>`<div><label for="${id}" class="ui-label">${l}</label><select id="${id}" class="ui-select rf">${opts.map(o=>`<option value="${esc(Array.isArray(o)?o[0]:o)}" ${(Array.isArray(o)?o[0]:o)===sv?'selected':''}>${esc(Array.isArray(o)?o[1]:o)}</option>`).join('')}</select></div>`;
function mkTog(id,on,label){return`<div class="flex items-center justify-between" style="padding:7px 0;min-height:40px"><span style="font-size:14px;color:var(--c-text)">${label}</span><button id="${id}" role="switch" aria-checked="${on?'true':'false'}" aria-label="${esc(label)}" class="tog ${on?'on':'off'}" onclick="this.classList.toggle('on');this.classList.toggle('off');this.setAttribute('aria-checked',this.classList.contains('on'))"><span></span></button></div>`;}
/* card(inner,{pad,head,headRight,attrs}) — standard surface */
function card(inner,opts={}){
  const head=opts.head?`<div class="ui-card-head"><span class="ui-card-title">${opts.head}</span>${opts.headRight||''}</div>`:'';
  const body=opts.pad===false?inner:`<div class="ui-card-pad">${inner}</div>`;
  return `<div class="ui-card"${opts.attrs?(' '+opts.attrs):''}>${head}${body}</div>`;
}
/* badge(text,tone) — generic soft pill */
const BADGE_TONE={brand:['var(--c-brand-soft)','var(--c-brand-ink)'],success:['var(--c-success-soft)','var(--c-success-ink)'],warn:['var(--c-warn-soft)','var(--c-warn-ink)'],danger:['var(--c-danger-soft)','var(--c-danger-ink)'],info:['var(--c-info-soft)','var(--c-info-ink)'],neutral:['var(--c-surface-2)','var(--c-text-2)']};
const badge=(text,tone='neutral')=>{const[bg,fg]=BADGE_TONE[tone]||BADGE_TONE.neutral;return `<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:var(--r-pill);font-size:12px;font-weight:700;background:${bg};color:${fg}">${esc(text)}</span>`;};
/* chipBar(items,activeKey,fnName,opts) — ONE tab/segment bar. items: [[key,label,count?],...] */
function chipBar(items,activeKey,fnName,opts={}){
  const pill=opts.style==='pill';
  const cls=pill?'ui-tab-pill':'ui-tab';
  const inner=items.map(it=>{const[k,l,c]=Array.isArray(it)?it:[it,it];const on=k===activeKey;
    return `<button type="button" class="${cls}${on?' on':''}" onclick="${fnName}('${k}')">${esc(l)}${c?`<span style="display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;border-radius:var(--r-pill);padding:1px 6px;min-width:16px;background:${on?'rgba(255,255,255,.22)':'var(--c-border)'};color:${on?'#fff':'var(--c-text-2)'}">${c}</span>`:''}</button>`;
  }).join('');
  return pill?`<div style="display:flex;gap:8px;flex-wrap:wrap;overflow-x:auto;-webkit-overflow-scrolling:touch">${inner}</div>`:`<div class="ui-tabs">${inner}</div>`;
}
const togV=id=>{const el=$(`#${id}`);if(!el)return false;return el.classList?.contains('on')||false;};
const STAT_C={sky:'#0284C7',brand:'#0E9F6E',rose:'#E11D48',amber:'#D97706',orange:'#EA580C',emerald:'#059669'};
const statCard=(t,v,c='sky',oc='')=>{
  const col=STAT_C[c]||c||'#0284C7';
  const base='background:var(--c-surface);border-radius:var(--r-lg);border:1px solid var(--c-border);box-shadow:var(--sh-sm);padding:18px';
  const lbl='<div style="font-size:11px;font-weight:700;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">'+t+'</div>';
  const val='<div class="fd" style="font-size:30px;font-weight:800;line-height:1;color:'+col+'">'+v+'</div>';
  if(oc){
    return '<div class="stat-card-click" onclick="'+oc+'" data-col="'+col+'" style="'+base+';cursor:pointer;transition:border-color .15s,box-shadow .15s">'
      +lbl+val
      +'<div style="font-size:12px;color:var(--c-text-3);margin-top:8px;display:flex;align-items:center;gap:3px">Details '+ic('chevR','w-3 h-3')+'</div>'
      +'</div>';
  }
  return '<div style="'+base+'">'+lbl+val+'</div>';
};
const empty=(i,t,s)=>`<div style="text-align:center;padding:40px 24px"><div style="width:56px;height:56px;border-radius:var(--r-lg);background:var(--c-brand-soft);color:var(--c-brand-ink);display:grid;place-items:center;margin:0 auto 14px">${ic(i,'w-6 h-6')}</div><p class="fd" style="font-weight:700;color:var(--c-text);font-size:15.5px">${esc(t)}</p>${s?`<p style="font-size:13px;color:var(--c-text-3);margin-top:5px;max-width:340px;margin-left:auto;margin-right:auto;line-height:1.55">${esc(s)}</p>`:''}</div>`;
const emptyState=empty;
const emptyCTA=(i,t,s,ctaLabel,onclick)=>`<div style="text-align:center;padding:48px 24px"><div style="width:52px;height:52px;border-radius:var(--r-lg);background:var(--c-surface-2);color:var(--c-text-3);display:grid;place-items:center;margin:0 auto 14px">${ic(i,'w-6 h-6')}</div><p class="fd" style="font-weight:700;color:var(--c-text-2);font-size:15px">${esc(t)}</p>${s?`<p style="font-size:13px;color:var(--c-text-3);margin-top:5px;max-width:340px;margin-left:auto;margin-right:auto">${esc(s)}</p>`:''}${ctaLabel?`<div style="margin-top:16px">${btn(ctaLabel,onclick,{variant:'primary',size:'sm',icon:'plus'})}</div>`:''}</div>`;
const loadingState=(label='Loading…')=>`<div style="text-align:center;padding:48px 24px"><div style="display:flex;flex-direction:column;gap:10px;max-width:360px;margin:0 auto 16px"><div class="ui-skel" style="height:14px;width:60%"></div><div class="ui-skel" style="height:48px"></div><div class="ui-skel" style="height:48px"></div></div><p style="font-size:13px;color:var(--c-text-3)">${esc(label)}</p></div>`;
const errorState=(t='Something went wrong',s='',retry='')=>`<div style="text-align:center;padding:48px 24px"><div style="width:52px;height:52px;border-radius:var(--r-lg);background:var(--c-danger-soft);color:var(--c-danger);display:grid;place-items:center;margin:0 auto 14px">${ic('alert','w-6 h-6')}</div><p class="fd" style="font-weight:700;color:var(--c-text);font-size:15px">${esc(t)}</p>${s?`<p style="font-size:13px;color:var(--c-text-2);margin-top:5px">${esc(s)}</p>`:''}${retry?`<div style="margin-top:16px">${btn('Try again',retry,{variant:'ghost',size:'sm',icon:'refresh'})}</div>`:''}</div>`;
const _isLoading=(kind)=>{try{return !!(_tabLoading&&_tabLoading[kind]);}catch(e){return false;}};

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
