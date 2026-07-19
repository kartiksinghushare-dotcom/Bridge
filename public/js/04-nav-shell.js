/* ============================================================
   Bridge — 04-nav-shell.js  (split from Bridge.html lines 1403-1627)
   Classic script: shares top-level scope with the other /js files.
   Load order matters — see index.html.
   ============================================================ */
/* ===== NAVIGATION ===== */
const NAV_ADM=[['dashboard','grid','Dashboard'],['mychecklists','check','My Checklists'],['tickets','ticket','Tickets'],['users','users','Users'],['hierarchy','tree','Hierarchy'],['checklists','list','Create Checklist'],['allcl','list','All Checklists'],['questions','help','Questions'],['approvals','approve','Approvals'],['notifications','bell','Notifications'],['analytics','chart','Analytics'],['locations','pin','Locations'],['departments','dept','Departments'],['settings','cog','Settings'],['audit','audit','Audit'],['okr','chart','OKRs'],['accesscontrol','shield','Access Control']];
const NAV_USR=[['mychecklists','check','My Checklists'],['tickets','ticket','Tickets'],['notifications','bell','Notifications']];
const NAV_MGR=[['dashboard','grid','Dashboard'],['mychecklists','check','My Checklists'],['tickets','ticket','Tickets'],['teamview','users','Team'],['users','user','My Users'],['checklists','list','Create Checklist'],['questions','help','Questions'],['approvals','approve','Approvals'],['notifications','bell','Notifications'],['analytics','chart','Analytics']];
const MOB_ADM=['dashboard','mychecklists','tickets','notifications','more'];
const MOB_USR=['mychecklists','tickets','notifications','more'];
const MOB_MGR=['dashboard','mychecklists','tickets','notifications','more'];
/* ── NAV v3 (Evarca-aligned): perms-driven master list + HUBS.
   A hub is ONE sidebar entry whose member pages show a pill sub-tab strip.
   Routes are unchanged — deep links, notifications and ⌘K keep working. ── */
const _isMgrRole=()=>{const r=(typeof _roleOf==='function')?_roleOf(me()):null;return !!r&&r.id==='manager';};
const NAV_ALL=[
  ['hub:dash','grid','Dashboard',()=>!!_hubHome('dash')],
  ['mychecklists','check','My Checklists',()=>true],
  ['okr','flag','OKRs',()=>can('okr','view')],
  ['crm','msg','CRM',()=>can('crm','view')],
  ['hub:inbox','bell','Inbox',()=>true],

  ['hub:cl','list','Checklists',()=>!!_hubHome('cl')],
  ['questions','help','Questions',()=>can('questions','view')],
  ['tickets','ticket','Tickets',()=>can('tickets','view')],

  ['hub:people','users','People',()=>!!_hubHome('people')],

  ['hub:admin','shield','Administration',()=>!!_hubHome('admin')],
];
/* ───── HUBS: one sidebar entry, sub-tab strip on every member route ───── */
const HUB_DEF={
  inbox:{label:'Inbox',tabs:[
    ['notifications','Alerts',()=>true],
    ['approvals','Approvals',()=>can('approvals','view')]]},
  dash:{label:'Dashboard',tabs:[
    ['dashboard','Overview',()=>can('analytics','view')]]},
  cl:{label:'Checklists',tabs:[
    ['checklists','Builder',()=>can('checklists','create')],
    ['allcl','All results',()=>can('allChecklists','view')||can('teamview','view')],
    ['teamview','Team',()=>can('teamview','view')]]},
  people:{label:'People',tabs:[
    ['users','Directory',()=>can('employees','view')],
    ['hierarchy','Hierarchy',()=>can('hierarchy','view')]]},
  admin:{label:'Administration',tabs:[
    ['settings','Settings',()=>can('settings','view')],
    ['accesscontrol','Access Control',()=>can('accessControl','view')],
    ['departments','Departments',()=>can('departments','view')],
    ['locations','Locations',()=>can('locations','view')],
    ['audit','Audit',()=>can('audit','view')]]},
};
function _hubOf(route){for(const k in HUB_DEF)if(HUB_DEF[k].tabs.some(t=>t[0]===route))return k;return null;}
function _hubTabsAllowed(k){return (HUB_DEF[k]?HUB_DEF[k].tabs:[]).filter(t=>{try{return !!t[2]();}catch(e){return false;}});}
function _hubHome(k){const t=_hubTabsAllowed(k);return t.length?t[0][0]:null;}
function _hubStrip(k){
  const tabs=_hubTabsAllowed(k);if(tabs.length<2)return'';
  return `<div class="hscroll" style="gap:4px;margin-bottom:16px;padding:5px;background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:14px;width:fit-content;max-width:100%">${tabs.map(([r,l])=>{const on=S.route===r;
    return `<button onclick="App.go('${r}')" style="flex-shrink:0;padding:8px 15px;border-radius:10px;border:none;background:${on?'var(--c-surface)':'transparent'};box-shadow:${on?'0 1px 3px rgba(21,23,28,.1)':'none'};color:${on?'var(--c-text)':'var(--c-text-2)'};font-size:13px;font-weight:${on?'800':'600'};cursor:pointer;transition:background .15s,color .15s;white-space:nowrap">${l}${(r==='notifications'||r==='approvals')?_navBadgeFor(r):''}</button>`;}).join('')}</div>`;
}
const navFor=()=>NAV_ALL.filter(n=>{try{return !!n[3]();}catch(e){return false;}}).map(n=>[n[0],n[1],n[2]]);
const NAV_DAILY=['hub:dash','mychecklists','okr','crm','hub:inbox']; // keep the daily strip tiny — everything else lives in named sections
const NAV_SECTION_OF={
  'hub:cl':'Work',questions:'Work',tickets:'Work',
  'hub:people':'People',
  'hub:admin':'Manage',
};
const NAV_SECTION_ORDER=['Work','People','Manage'];
const NAV_SECTION_ICON={Time:'clock',Work:'list',People:'users',Manage:'cog'};
function navSectionsFor(){
  const flat=navFor();
  const daily=[],sections={};
  flat.forEach(item=>{
    const r=item[0];
    // notifications becomes the bell; keep it out of the daily strip rendering but reachable in 'More'
    const sec=NAV_SECTION_OF[r];
    if(NAV_DAILY.includes(r)&&(sec==='__daily'||sec===undefined)){daily.push(item);return;}
    const bucket=sec&&sec!=='__daily'?sec:'More';
    (sections[bucket]=sections[bucket]||[]).push(item);
  });
  const ordered=[...NAV_SECTION_ORDER,'More'].filter(s=>sections[s]&&sections[s].length).map(s=>({label:s,icon:NAV_SECTION_ICON[s]||'grid',items:sections[s]}));
  return {daily,sections:ordered};
}
App.toggleNavSec=(name)=>{
  S._navCollapsed=S._navCollapsed||{};
  const {sections}=navSectionsFor();
  const sec=sections.find(x=>x.label===name);
  const hasActive=sec?sec.items.some(it=>it[0]===S.route):false;
  const cur=(name in S._navCollapsed)?!!S._navCollapsed[name]:!hasActive;
  S._navCollapsed[name]=!cur;
  render();
};
App.go=(r)=>{if(r&&String(r).slice(0,4)==='hub:')r=_hubHome(String(r).slice(4))||'mychecklists';S.route=r;S.search='';S.expandedCl=null;S.afOpen=null;
  // Preserve analytics filters; preserve questions sub-tab state; reset everything else
  if(r==='analytics'){/* keep filters */}
  else if(r==='questions'){const qTab=S.filters.qTab;const eQ=S.filters.expandedQ;const eL=S.filters.expandedL;S.filters={};if(qTab)S.filters.qTab=qTab;if(eQ)S.filters.expandedQ=eQ;if(eL)S.filters.expandedL=eL;}
  else if(r==='notifications'){const ntab=S.filters.ntab;S.filters={};if(ntab)S.filters.ntab=ntab;}
  else if(r==='settings'){const stab=S.filters.stab;const tplKey=S.filters.tplKey;S.filters={};if(stab)S.filters.stab=stab;if(tplKey)S.filters.tplKey=tplKey;}
  else if(r==='accesscontrol'){const at=S.filters.acTab;const au=S.filters.acUser;const aq=S.filters.acQ;S.filters={};if(at)S.filters.acTab=at;if(au)S.filters.acUser=au;if(aq)S.filters.acQ=aq;}
  else{S.filters={};}
  if(r!=='teamview')S.tvUser=null;
  // Update URL hash so deep-links work; pushState so browser Back/Forward walk in-app history.
  if(location.hash!=='#'+r){ if(history.pushState)history.pushState(null,'','#'+r); else if(history.replaceState)history.replaceState(null,'','#'+r); }
  render();window.scrollTo(0,0);
  // Lazy-load only the data this tab needs (nothing loads on a timer anymore).
  _lazyForRoute(r);};
// ── Deep-link + Back/Forward support: react to hash changes and route to the target
//    (App.go's guarded pushState prevents loops). ──
window.addEventListener('hashchange',()=>{
  if(!S.uid)return;
  const r=(location.hash||'').replace(/^#/,'').trim();
  if(r&&r!==S.route&&typeof App.go==='function')App.go(r);
});
App._lazyLoad=_lazyLoad;App._lazyLoadDate=_lazyLoadDate;

/* ===== RENDER ===== */
let _lastUserAction=0; // timestamp of last submit/approve/etc — prevents loadFromSB overwriting fresh state
function _touchAction(){_lastUserAction=Date.now();}
function render(){if(!S.uid){$('#app').innerHTML=loginView();return;}
  // Preserve the sidebar's own scroll position across a full re-render (clicking a lower nav
  // item used to jump the sidebar back to the top).
  const _sb=document.querySelector('.sidebar');const _sy=_sb?_sb.scrollTop:0;
  $('#app').innerHTML=shell(pageContent());
  const _sb2=document.querySelector('.sidebar');if(_sb2&&_sy)_sb2.scrollTop=_sy;}
function rr(){_invalidateNotifCache();const _y=window.scrollY||document.documentElement.scrollTop||0;const c=$('#content');if(c)c.innerHTML=pageContent();window.scrollTo(0,_y);requestAnimationFrame(()=>window.scrollTo(0,_y));}
App.rr=rr;
// UI-1: live-search helper — rr() rebuilds #content and destroys the typing <input>, dropping
// focus/caret. Re-render, then restore focus + selection on the search input by id.
App._searchRR=(inputId)=>{const a=document.activeElement;const ss=a?a.selectionStart:null,se=a?a.selectionEnd:null;rr();const el=document.getElementById(inputId);if(el){el.focus();try{if(ss!=null)el.setSelectionRange(ss,se);}catch(e){}}};

function _navBadgeFor(r){
  if(r==='hub:inbox'){let n=0;try{n=_notifCount();}catch(e){}return n?countBadge(n,'danger'):'';}
  if(r==='notifications'){const n=_notifCount();return n?countBadge(n,'danger'):'';}
  if(r==='approvals'){const ab=_approvalPendingCount();return ab?countBadge(ab,'approve'):'';}
  if(r==='tickets'){const tkB=(DB.tickets||[]).filter(t=>t.assignedTo===S.uid&&!(t.viewedBy||[]).includes(S.uid)).length;return tkB?countBadge(tkB,'rose'):'';}
  if(r==='crm'&&window.CRM&&CRM._loaded){try{const vis=_crmVisibleBoardIds();const cb=CRM.convos.filter(c=>vis[c.boardId]&&_crmUnread(c)).length;return cb?countBadge(cb,'approve'):'';}catch(e){return'';}}
  if(r==='okr'||r==='hub:dash'){try{const _t=todayISO();const n=okrDueForUser(S.uid,_t).filter(o=>!okrCheckinFor(o.id,S.uid,_t)).length;return n?countBadge(n,'approve'):'';}catch(e){return'';}}
  return '';
}
function _navItemHTML([r,i,l]){
  const act=String(r).slice(0,4)==='hub:'?_hubOf(S.route)===String(r).slice(4):S.route===r;
  return`<button onclick="App.go('${r}')" class="nav-item${act?' on':''}"><span class="nav-ico">${ic(i,'w-[17px] h-[17px]')}</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${l}</span>${_navBadgeFor(r)}</button>`;
}
function shell(content){
  const u=me();
  // Mobile nav: base array; add 'questions' for questionsAccess non-admin users
  let mob=isAdmin()?[...MOB_ADM]:(isMgr()||isSubAdmin())?[...MOB_MGR]:[...MOB_USR];

  const {daily,sections}=navSectionsFor();
  S._navCollapsed=S._navCollapsed||{};
  const dailyHTML=daily.map(_navItemHTML).join('');
  const sectionsHTML=sections.map(sec=>{
    // T1: honor the user's explicit collapse/expand. Only fall back to "auto-expand the
    // section with the active route" when the user hasn't toggled it yet — otherwise a
    // section containing the current page could never be collapsed.
    const hasActive=sec.items.some(it=>it[0]===S.route);
    const collapsed=(sec.label in S._navCollapsed)?!!S._navCollapsed[sec.label]:!hasActive;
    const show=!collapsed;
    return`<div class="nav-sec${show?'':' collapsed'}">
      <button class="nav-sec-hdr" onclick="App.toggleNavSec('${sec.label}')"><span class="nav-ico" style="width:14px;height:14px;color:rgba(255,255,255,.45)">${ic(sec.icon,'w-3.5 h-3.5')}</span><span style="flex:1;text-align:left">${sec.label}</span><span class="nav-chev">${ic('chevD','w-3.5 h-3.5')}</span></button>
      <div class="nav-sec-body" style="display:${show?'flex':'none'};flex-direction:column;gap:2px">${sec.items.map(_navItemHTML).join('')}</div>
    </div>`;
  }).join('');

  return`<div style="min-height:100vh;display:flex">
  <aside class="sidebar hidden md:flex flex-col w-56 fixed inset-y-0 left-0 z-30 overflow-y-auto" style="${S.route==='crm'?'display:none !important;':''}background:linear-gradient(177deg,#221B12 0%,#15100A 100%);color:#fff;border-right:1px solid rgba(255,255,255,.05)">
    <button onclick="App.go('dashboard')" style="padding:14px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid rgba(255,255,255,.06);background:transparent;border-left:none;border-right:none;border-top:none;cursor:pointer;width:100%;text-align:left" onmouseover="this.style.background='rgba(255,255,255,.05)'" onmouseout="this.style.background='transparent'">
      <div class="nav-brand">B</div>
      <span class="fd" style="font-weight:800;font-size:18px;letter-spacing:-.5px;color:#fff">Bridge</span>
    </button>
    <nav style="flex:1;padding:10px 8px;display:flex;flex-direction:column;gap:2px">${dailyHTML}<div style="height:1px;background:rgba(255,255,255,.07);margin:8px 6px"></div>${sectionsHTML}</nav>
    <div style="padding:8px;border-top:1px solid rgba(255,255,255,.06)">
      <button onclick="App.go('profile')" style="width:100%;display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:12px;background:transparent;border:none;cursor:pointer;color:#fff;margin-bottom:2px" onmouseover="this.style.background='rgba(255,255,255,.07)'" onmouseout="this.style.background='transparent'">
        ${avatar(u,'w-8 h-8','text-[11px]')}
        <div style="min-width:0;text-align:left;flex:1">
          <div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(fullName(u))}</div>
          <div style="font-size:11px;color:#A9ADB8;margin-top:1px">${esc(u.position||u.department||'')}</div>
        </div>
        <span style="font-size:10px;color:rgba(255,255,255,.3)">${ic('chevR','w-3 h-3')}</span>
      </button>
      <button onclick="App.logout()" style="width:100%;display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:10px;background:transparent;border:none;cursor:pointer;color:#A9ADB8;font-size:12px;font-weight:500" onmouseover="this.style.color='#fff';this.style.background='rgba(255,255,255,.07)'" onmouseout="this.style.color='#A9ADB8';this.style.background='transparent'">
        ${ic('logout','w-3.5 h-3.5')}Sign out
      </button>
    </div>
  </aside>
  <div class="flex flex-col" style="flex:1;min-width:0;margin-left:0" id="main-wrap">
    <header class="topbar sticky top-0 z-20" style="${S.route==='crm'?'display:none !important;':''}background:rgba(250,246,239,.82);backdrop-filter:saturate(180%) blur(20px);-webkit-backdrop-filter:saturate(180%) blur(20px);border-bottom:1px solid var(--c-border)">
      <div style="height:56px;padding:0 18px;display:flex;align-items:center;gap:10px">
        <button onclick="App.moreMenu()" class="md:hidden" aria-label="Open menu" style="${S.route==='crm'?'display:grid !important;':''}width:38px;height:38px;border-radius:10px;border:none;background:transparent;color:var(--c-text);display:grid;place-items:center;cursor:pointer">${ic('menu','w-5 h-5')}</button>
        <div class="md:hidden flex items-center gap-2">
          <div class="nav-brand" style="width:24px;height:24px;font-size:11px">B</div>
          <span class="fd" style="font-weight:800;font-size:15px">Bridge</span>
        </div>
        <div style="flex:1"></div><button onclick="App._cmdk()" class="hidden md:flex" style="${S.route==='crm'?'display:none !important;':''}align-items:center;gap:8px;width:240px;padding:8px 12px;border-radius:12px;border:1px solid var(--c-border);background:var(--c-surface);color:var(--c-text-3);font-size:12.5px;font-weight:500;cursor:text;box-shadow:inset 0 1px 2px rgba(16,24,40,.04)">${ic('search','w-4 h-4')}<span style="flex:1;text-align:left">Search anything…</span><span style="font-size:10px;font-weight:800;background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:6px;padding:1px 6px;color:var(--c-text-3)">⌘K</span></button>
        <button onclick="App.go('notifications')" class="md:hidden" aria-label="Notifications" style="position:relative;width:38px;height:38px;border-radius:10px;border:none;background:transparent;color:var(--c-text);display:grid;place-items:center;cursor:pointer">${ic('bell','w-5 h-5')}${(()=>{const n=_notifCount();return n?`<span style="position:absolute;top:5px;right:5px">${countBadge(n,'danger')}</span>`:'';})()}</button>
        <button onclick="App.go('profile')" class="md:hidden" aria-label="Profile">${avatar(u,'w-8 h-8','text-[11px]')}</button>
      </div>
    </header>
    <div style="max-width:1152px;width:100%;margin:0 auto;padding:0 20px"></div>
    <main id="content" style="${S.route==='crm'?'flex:1;min-width:0;padding:0;max-width:none;width:100%;margin:0;height:calc(100dvh - 56px);overflow:hidden':'flex:1;padding:22px 20px;padding-bottom:96px;max-width:1152px;width:100%;margin:0 auto'}" class="${S.route==='crm'?'':'md:pb-10'}">${content}</main>
  </div>
  <nav id="bottom-nav" class="mob-nav md:hidden fixed bottom-0 inset-x-0 z-30" style="background:var(--c-surface);border-top:1px solid var(--c-border);padding-bottom:env(safe-area-inset-bottom);box-shadow:0 -2px 16px rgba(16,24,40,.06)">
    <div style="display:grid;grid-template-columns:repeat(${mob.length},1fr);height:60px">
      ${mob.map(r=>{
        if(r==='more')return`<button onclick="App.moreMenu()" aria-label="More" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border:none;background:transparent;cursor:pointer;color:var(--c-text-3);min-height:44px">${ic('menu','w-[22px] h-[22px]')}<span style="font-size:10px;font-weight:700">More</span></button>`;
        const m=[...NAV_ADM,...NAV_USR,...(typeof NAV_MGR!=='undefined'?NAV_MGR:[])].find(n=>n[0]===r);if(!m)return'';
        const act=S.route===r;
        let nb=0;
        if(r==='notifications')nb=_notifCount();
        if(r==='tickets')nb=(DB.tickets||[]).filter(t=>t.assignedTo===S.uid&&!(t.viewedBy||[]).includes(S.uid)).length;
        if(r==='crm'&&window.CRM&&CRM._loaded){try{const _v=_crmVisibleBoardIds();nb=CRM.convos.filter(c=>_v[c.boardId]&&_crmUnread(c)).length;}catch(e){nb=0;}}
        return`<button onclick="App.go('${r}')" aria-label="${esc(m[2])}" style="position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border:none;background:transparent;cursor:pointer;min-height:44px;color:${act?'var(--c-brand)':'var(--c-text-3)'}">${ic(m[1],'w-[22px] h-[22px]')}${nb?`<span style="position:absolute;top:6px;right:calc(50% - 18px)">${countBadge(nb,'danger')}</span>`:''}<span style="font-size:10px;font-weight:700">${m[2].split(' ')[0]}</span></button>`;
      }).join('')}
    </div>
  </nav></div>`;
}


App.moreMenu=()=>{
  const {daily,sections}=navSectionsFor();
  const u=me();
  const tile=([r,i,l])=>{
    const act=String(r).slice(0,4)==='hub:'?_hubOf(S.route)===String(r).slice(4):S.route===r;const b=_navBadgeFor(r);
    return`<button onclick="App.closeModal();App.go('${r}')" style="position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;padding:14px 8px;min-height:80px;border-radius:14px;border:1px solid ${act?'var(--c-brand)':'var(--c-border)'};background:${act?'var(--c-brand-soft)':'var(--c-surface)'};color:${act?'var(--c-brand-ink)':'var(--c-text)'};cursor:pointer">${b?`<span style="position:absolute;top:7px;right:7px">${b}</span>`:''}${ic(i,'w-[22px] h-[22px]')}<span style="font-size:11px;font-weight:700;text-align:center;line-height:1.2">${esc(l)}</span></button>`;
  };
  const sectionBlock=(label,items)=>`<div style="margin-top:6px"><div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--c-text-3);margin:14px 2px 8px">${esc(label)}</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${items.map(tile).join('')}</div></div>`;
  const body=`
    <div style="display:flex;align-items:center;gap:11px;padding:12px;border-radius:14px;background:var(--c-surface-2);margin-bottom:8px">
      ${avatar(u,'w-10 h-10','text-sm')}
      <div style="min-width:0;flex:1"><div style="font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(fullName(u))}</div><div style="font-size:12px;color:var(--c-text-2)">${esc(u.position||u.department||'')}</div></div>
      <button onclick="App.closeModal();App.go('profile')" class="ui-btn ui-btn-ghost ui-btn-sm">Profile</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${daily.map(tile).join('')}</div>
    ${sections.map(s=>sectionBlock(s.label,s.items)).join('')}
    <button onclick="App.logout()" class="ui-btn ui-btn-subtle ui-btn-md" style="width:100%;margin-top:16px">${ic('logout','w-4 h-4')}Sign out</button>`;
  modalShell({title:'Menu',body,size:'max-w-md'});
};
/* W1.4 / X3: role-aware quick-add "+" menu. Reuses existing create handlers — no new logic,
   just a single discoverable entry point. Each action is gated by the same can()/role checks
   that gate its page button, so a user only sees actions they can actually perform. */
App.saveProfile=async()=>{
  const u=me();if(!u)return;
  const fn=($('#ep-fn')?.value||'').trim();
  const ln=($('#ep-ln')?.value||'').trim();
  if(!fn||!ln){toast('Name required','err');return;}
  // Update locally immediately
  u.firstName=fn;u.lastName=ln;
  u.phone=($('#ep-ph')?.value||'').trim();
  u.position=($('#ep-pos')?.value||'').trim();
  saveDB();toast('Profile updated ✓');render();
  // Sync to Supabase in background
  sb.from('profiles').update({
    first_name:u.firstName,last_name:u.lastName,
    phone:u.phone,position:u.position
  }).eq('id',u.id).then(({error})=>{
    if(error)console.error('saveProfile sync:',error.message);
  }).catch(()=>{});
};
App.changePw=async()=>{const cur=($('#pw-cur')?.value||'').trim();const nw=($('#pw-new')?.value||'').trim();if(!cur||!nw){toast('Fill both fields','err');return;}if(nw.length<6){toast('Min 6 characters','err');return;}const u=me();const{error:se}=await sb.auth.signInWithPassword({email:u.email,password:cur});if(se){toast('Current password incorrect','err');return;}const{error}=await sb.auth.updateUser({password:nw});if(error){toast(error.message,'err');return;}toast('Password updated');const c=$('#pw-cur'),n=$('#pw-new');if(c)c.value='';if(n)n.value='';};
// _showNotifs removed — now using notificationsPage route
App.logout=()=>{
  try{log(fullName(me()),'Logged out','');saveDB();}catch(e){}
  // Clear state and render immediately — don't wait for Supabase
  S.uid=null;S.route='dashboard';S.filters={};S.expandedCl=null;S.tvUser=null;RUN={};CLD=null;_QED=null;
  closeModal();render();
  // Sign out Supabase in background
  sb.auth.signOut().catch(()=>{});
};

