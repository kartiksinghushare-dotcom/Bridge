/* ============================================================
   Bridge — 00-helpers.js  (split from Bridge.html lines 732-825)
   Classic script: shares top-level scope with the other /js files.
   Load order matters — see index.html.
   ============================================================ */


const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const uid=p=>p+'_'+Math.random().toString(36).slice(2,9);
const esc=s=>(s==null?'':String(s)).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const todayISO=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const nowHM=()=>{const d=new Date();return d.getHours()*60+d.getMinutes();};
const hm2m=t=>{if(!t)return 1440;const[h,m]=t.split(':').map(Number);return h*60+(m||0);};
const WKDAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const DAYS3=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const fmtD=d=>d?new Date(d+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'—';
const fmtS=d=>d?new Date(d+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'}):'—';
const initials=u=>((u?.firstName||'?')[0]||'?')+((u?.lastName||'')[0]||'');
const fullName=u=>(u?(u.firstName||'')+' '+(u.lastName||''):'Unknown').trim()||'Unknown';
const dayAbbr=iso=>DAYS3[new Date(iso+'T00:00:00').getDay()].slice(0,3);

function clOn(c,date){if(c.status&&c.status!=='Active')return false;
  if(c.startDate&&date<c.startDate)return false;
  if(c.endDate&&date>c.endDate)return false;
  const dy=dayAbbr(date);
  const dn=new Date(date+'T00:00:00').getDate();
  if(c.frequency==='Daily'){
    if(!c.schedule||c.schedule==='Every day')return true;
    return(c.selectedDays||[]).includes(dy);
  }
  if(c.frequency==='Weekly')return(c.selectedDays||[]).includes(dy);
  if(c.frequency==='Monthly'){
    const lastDay=new Date(new Date(date+'T00:00:00').getFullYear(),new Date(date+'T00:00:00').getMonth()+1,0).getDate();
    const isLast=dn===lastDay;
    const sdt=(c.selectedDates||[]).map(x=>x==='L'?'L':Number(x));
    return sdt.includes(dn)||(isLast&&sdt.includes('L'));
  }
  if(c.frequency==='Custom')return(c.customDates||[]).includes(date);
  return true;
}

let _toast;
function toast(msg,type='ok'){
  let t=$('#toast');if(!t){t=document.createElement('div');t.id='toast';t.style.cssText='position:fixed;z-index:500;left:50%;transform:translateX(-50%);bottom:calc(70px + env(safe-area-inset-bottom));pointer-events:none';document.body.appendChild(t);}
  const bg=type==='ok'?'#1C1712':type==='warn'?'#D97706':'#DC2626';
  const icbg=type==='ok'?'rgba(232,120,92,.9)':'rgba(255,255,255,.2)';
  const glyph=type==='ok'?'✓':type==='warn'?'!':'✕';
  t.innerHTML=`<div class="pop tt" style="background:${bg};color:#fff;padding:11px 16px 11px 12px;border-radius:14px;font-size:13px;font-weight:600;box-shadow:0 10px 34px -10px rgba(0,0,0,.45),0 2px 8px rgba(0,0,0,.2)"><span class="ic" style="background:${icbg};color:#fff">${glyph}</span><span>${esc(msg)}</span></div>`;
  clearTimeout(_toast);_toast=setTimeout(()=>{if(t)t.innerHTML='';},type==='ok'?2800:4800);
}

/* toastAction(msg,type,{label,fn,ms}) — a toast with ONE inline action button (Undo / Retry).
   `fn` is a STRING of JS run on click. Stays up longer (default 6s) so the user can act. */
window._toastAction=null;
function toastAction(msg,type='ok',{label='Undo',fn='',ms=6000}={}){
  let t=$('#toast');if(!t){t=document.createElement('div');t.id='toast';t.style.cssText='position:fixed;z-index:500;left:50%;transform:translateX(-50%);bottom:calc(76px + env(safe-area-inset-bottom));pointer-events:none';document.body.appendChild(t);}
  const bg=type==='ok'?'#1C1712':type==='warn'?'#D97706':'#DC2626';
  t.innerHTML=`<div class="pop" style="display:flex;align-items:center;gap:14px;background:${bg};color:#fff;padding:10px 12px 10px 18px;border-radius:12px;font-size:13px;font-weight:600;box-shadow:0 4px 20px rgba(0,0,0,.25);pointer-events:auto;max-width:calc(100vw - 32px)"><span style="min-width:0;display:inline-flex;align-items:center;gap:7px">${type==='ok'?ic('check','w-3.5 h-3.5'):ic('alert','w-3.5 h-3.5')}<span>${esc(msg)}</span></span>${fn?`<button onclick="(()=>{const t=document.getElementById('toast');if(t)t.innerHTML='';})();${fn}" style="flex-shrink:0;background:rgba(255,255,255,.18);color:#fff;border:none;border-radius:8px;padding:7px 14px;font-size:12.5px;font-weight:800;cursor:pointer;min-height:34px">${esc(label)}</button>`:''}</div>`;
  clearTimeout(_toast);clearTimeout(window._toastAction);window._toastAction=setTimeout(()=>{if(t)t.innerHTML='';},ms);
}

/* ===== ICONS ===== */
const I={
  menu:'<path d="M3 12h18M3 6h18M3 18h18"/>',
  grid:'<path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  dept:'<path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-3"/>',
  list:'<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
  check:'<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  approve:'<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01l-3-3"/>',
  tree:'<rect x="9" y="2" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="16" y="16" width="6" height="6" rx="1"/><path d="M12 8v4M12 12H5v4M12 12h7v4"/>',
  chart:'<path d="M3 3v18h18"/><path d="M7 14l3-3 3 3 5-6"/>',
  audit:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h4"/>',
  cog:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  bell:'<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
  folder:'<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  copy:'<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  lock:'<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  unlock:'<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
  cam:'<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  chevR:'<path d="M9 18l6-6-6-6"/>',
  chevD:'<path d="M6 9l6 6 6-6"/>',
  x:'<path d="M18 6 6 18M6 6l12 12"/>',
  edit:'<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/>',
  trash:'<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
  back:'<path d="M19 12H5M12 19l-7-7 7-7"/>',
  key:'<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
  filter:'<path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>',
  pin:'<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  msg:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  flag:'<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
  alert:'<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
  doc:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  help:`<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/>`,
  ticket:`<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><path d="M13 5v2M13 17v2M13 11v2"/>`,
  eye:`<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`,
  user:`<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`,
  download:`<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>`,
  upload:`<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>`,
  send:`<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>`,
  shield:`<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>`,
  refresh:`<path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>`,
  calendar:`<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>`,
  paperclip:`<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>`,
  image:`<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>`,
  sheet:`<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8M8 9h2"/>`,
  globe:`<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>`,
  info:`<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>`,
};
const ic=(n,cls='w-5 h-5',sw=2)=>`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${I[n]||''}</svg>`;


