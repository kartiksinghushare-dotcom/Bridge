/* ============================================================
   Bridge — 06-crm.js  (split from Bridge.html lines 1734-2087)
   Classic script: shares top-level scope with the other /js files.
   Load order matters — see index.html.
   ============================================================ */
/* ============================================================================
   CRM — mini-ClickUp style inbox (CLIENT-ONLY PROTOTYPE)
   Everything here is in-memory and dynamic. There are NO Supabase/database
   calls anywhere in this module — it exists purely to review the UI/flow.
   Structure: Hubs (collapsible sidebar) -> Boards (with members) -> category
   tabs (Chats / Complaints / Refunds / Approvals, dynamic) -> conversations.
   A conversation starts as a chat and can be "converted to a ticket" of a type.
   ============================================================================ */
let CRM=null;
function _crmInit(){if(CRM)return;CRM={hubMembers:{},_loaded:false,_loading:false,_err:null,hubs:[],boards:[],views:[],categories:[],convos:[],sel:{hubId:null,boardId:null,viewId:null,category:'Chats',convoId:null,threadId:null},sidebarCollapsed:false,collapsedHubs:{},channels:[],boardMembersOpen:false,activity:[],settings:{},activityOpen:false,boardSettingsOpen:false,globalSettingsOpen:false,_bsBoardId:null,_rowAdd:null,search:'',compose:{images:[]},editMsgId:null,fwdMsgId:null,listFilter:'all',reads:{},boardFilter:{}};try{_crmRestoreSel();}catch(e){}
  if(!CRM._remInt)CRM._remInt=setInterval(function(){try{if(CRM&&CRM._loaded)_crmCheckReminders();}catch(e){}},60000);}
/* ══ v3.19 — WORKSPACE ACCESS ═══════════════════════════════════════════════════
   Two levels, both dynamic (toggled per role in Access Control):
     · CHANNEL (hub) member → sees EVERY board in that channel
     · BOARD member        → sees ONLY that board
   'seeAll' bypasses both. isAdmin() stays as a fallback so existing admin role
   profiles keep working before anyone re-saves them in Access Control.        ══ */
const _crmSeeAll=()=>can('crm','seeAll')||can('crm','manage')||isAdmin();
/* Who may hand out access. Falls back to the old gate so nothing locks up on upgrade. */
const _crmCanHubMembers=()=>can('crm','hubMembers')||can('crm','manage')||_crmSeeAll();
const _crmCanBoardMembers=()=>can('crm','members')||can('crm','manage')||can('crm','edit')||_crmCanHubMembers();
function _crmHubMemberIds(hubId){var m=(CRM&&CRM.hubMembers)||{};return Array.isArray(m[hubId])?m[hubId]:[];}
function _crmIsHubMember(hubId,uid2){return _crmHubMemberIds(hubId).indexOf(uid2||S.uid)>=0;}
function _crmHubPeopleList(hubId){return _crmHubMemberIds(hubId).map(function(id){return uById(id);}).filter(function(u){return u&&u.status!=='Disabled';}).sort(function(a,b){return fullName(a).localeCompare(fullName(b));});}
/* ── People scoping (v3.12: channels removed) — a board's people = its members ── */
function _crmBoardPeople(board){var ids={};((board&&board.members)||[]).forEach(function(x){ids[x]=1;});return Object.keys(ids).map(function(x){return uById(x);}).filter(function(u){return u&&u.status!=='Disabled';}).sort(function(a,b){return fullName(a).localeCompare(fullName(b));});}
/* ── People groups (workspace-wide, stored in CRM.settings.groups) ── */
function _crmGroups(){return (CRM&&CRM.settings&&Array.isArray(CRM.settings.groups))?CRM.settings.groups:[];}
function _crmGroup(id){return _crmGroups().find(function(g){return g.id===id;});}
function _crmGroupToken(g){return String((g&&g.name)||'').replace(/[^\w]/g,'');}
/* Expand a mixed list of user-ids and 'grp:<id>' entries into unique user-ids */
function _crmExpandPeople(list){var out={};(list||[]).forEach(function(x){if(!x)return;if(String(x).indexOf('grp:')===0){var g=_crmGroup(String(x).slice(4));((g&&g.members)||[]).forEach(function(id){out[id]=1;});}else out[x]=1;});return Object.keys(out);}
/* v3.15: groups offered as ASSIGNEES on a board = groups with at least one (active) member of that
   board — the same scoping rule as @group tagging. Callers concat the currently-assigned group if
   it no longer qualifies, so an existing assignment always stays visible & selectable. */
function _crmBoardGroups(board){var mem={};((board&&board.members)||[]).forEach(function(x){mem[x]=1;});return _crmGroups().filter(function(g){return (g.members||[]).some(function(id){var u=uById(id);return mem[id]&&u&&u.status!=='Disabled';});}).sort(function(a,b){return String(a.name||'').localeCompare(String(b.name||''));});}
function _crmGroupHasMe(gid){var g=_crmGroup(gid);return !!g&&(g.members||[]).indexOf(S.uid)>=0;}
/* Compact chip for a group-assigned ticket (read-only displays) */
function _crmGroupChip(g,extra){if(!g)return'<span style="color:#A8998A;font-size:12.5px">—</span>';return'<span title="Assigned to group “'+esc(g.name)+'” ('+((g.members||[]).length)+' members)" style="display:inline-flex;align-items:center;gap:6px;max-width:100%;'+(extra||'')+'"><span style="width:20px;height:20px;border-radius:50%;background:#EEE4D5;color:#3E322B;display:inline-grid;place-items:center;flex-shrink:0">'+ic('users','w-3 h-3')+'</span><span style="font-size:12.5px;font-weight:600;color:#3A312A;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(g.name)+'</span><span style="font-size:10px;font-weight:700;color:#A8998A;flex-shrink:0">'+((g.members||[]).length)+'</span></span>';}
function _crmSaveSettings(label){sbWrite({table:'workspace_settings',op:'upsert',id:'crm_settings',values:{key:'crm_settings',value:CRM.settings},opts:{onConflict:'key'}},{label:label||'Workspace settings'});}
/* On-brand ask/confirm modals — replace native prompt()/confirm() browser boxes */
function _crmPromptP(title,sub,placeholder,btnLabel,value){return new Promise(function(res){CRM._promptRes=res;
  modalShell({title:esc(title),sub:sub||'',size:'max-w-sm',key:'crm-prompt',
    body:'<input id="crm-prompt-in" class="ui-input" value="'+esc(value||'')+'" placeholder="'+esc(placeholder||'')+'" onkeydown="if(event.key===\'Enter\')App._crmPromptEnd(1);if(event.key===\'Escape\')App._crmPromptEnd(0)"/>',
    footer:btnG('Cancel','App._crmPromptEnd(0)')+btnP(btnLabel||'Create','App._crmPromptEnd(1)')});
  setTimeout(function(){var e=document.getElementById('crm-prompt-in');if(e){e.focus();try{e.select();}catch(x){}}},60);});}
App._crmPromptEnd=(yes)=>{var r=CRM._promptRes;CRM._promptRes=null;var v=yes?(((document.getElementById('crm-prompt-in')||{}).value||'').trim()||null):null;closeModal();if(r)r(v);};
function _crmConfirmP(title,body,btnLabel){return new Promise(function(res){CRM._confirmRes=res;
  modalShell({title:esc(title),sub:'',size:'max-w-sm',key:'crm-confirm',
    body:'<div style="display:flex;gap:12px;align-items:flex-start"><div style="width:38px;height:38px;border-radius:11px;background:var(--c-danger-soft);color:var(--c-danger);display:grid;place-items:center;flex-shrink:0">'+ic('trash','w-4 h-4')+'</div><div style="font-size:13px;color:var(--c-text-2);line-height:1.6;padding-top:2px">'+body+'</div></div>',
    footer:btnG('Cancel','App._crmConfirmEnd(0)')+'<button onclick="App._crmConfirmEnd(1)" class="ui-btn ui-btn-danger ui-btn-md">'+esc(btnLabel||'Delete')+'</button>'});});}
App._crmConfirmEnd=(yes)=>{var r=CRM._confirmRes;CRM._confirmRes=null;closeModal();if(r)r(!!yes);};
function _crmInappOn(ev){try{return typeof _ns==='undefined'||!_ns||_ns['inapp_'+ev]!==false;}catch(e){return true;}}
/* NOTE: "created it" is deliberately NOT a grant any more — that was the bug where
   removing somebody from a board never actually took their access away. */
function _crmBoardVisible(b){
  if(!b)return false;
  if(_crmSeeAll())return true;
  if(_crmIsHubMember(b.hubId))return true;              // channel-level access
  return (b.members||[]).indexOf(S.uid)>=0;             // board-level access
}
function _crmVisibleBoards(){return (CRM.boards||[]).filter(_crmBoardVisible);}
/* ── v3.12.1: FILTERED VIEWS — a saved, member-scoped MIRROR OF THE WHOLE HUB: same board
   tabs as the hub itself, each ticket board narrowed by the view's saved per-board conditions.
   Only the view's assigned members (+ its creator + CRM managers) can open it; assigned people
   see all the hub's boards through the view even if they are not members of those boards. ── */
function _crmView(id){return (CRM.views||[]).find(function(v){return v.id===id;});}
function _crmViewVisible(v){if(!v)return false;if(_crmSeeAll())return true;if(v.createdBy===S.uid)return true;return _crmExpandPeople(v.members||[]).indexOf(S.uid)>=0;}  /* v3.15: members may be user-ids or 'grp:<id>' */
function _crmVisibleViews(hubId){return (CRM.views||[]).filter(function(v){return v.hubId===hubId&&_crmViewVisible(v);});}
function _crmViewCanEdit(v){return !!v&&(_crmSeeAll()||v.createdBy===S.uid)&&can('crm','views');}
/* A channel shows up when you are a member of it, when one of its boards is yours,
   or when a filtered view hands it to you. Being allowed to CREATE no longer reveals
   every existing channel — that leaked the whole workspace to ordinary staff. */
function _crmHubVisible(h){
  if(!h)return false;
  if(_crmSeeAll())return true;
  if(_crmIsHubMember(h.id))return true;
  return (CRM.boards||[]).some(function(b){return b.hubId===h.id&&_crmBoardVisible(b);})
      ||(CRM.views||[]).some(function(v){return v.hubId===h.id&&_crmViewVisible(v);});
}
/* Board ids whose content the user may read: visible boards ∪ every board of hubs with a visible view
   (v3.12.1: a filtered view mirrors the WHOLE hub — all of its boards, narrowed by the view's filters) */
function _crmVisibleBoardIds(){var s={};_crmVisibleBoards().forEach(b=>s[b.id]=1);(CRM.views||[]).forEach(function(v){if(!_crmViewVisible(v))return;(CRM.boards||[]).forEach(function(b){if(b.hubId===v.hubId&&!_crmViewHides(v,b.id))s[b.id]=1;});});return s;}
/* Boards REMOVED FROM A VIEW. Removing a board from a filtered view must never delete the
   board itself — it only disappears from that view. Kept inside `filters` under a reserved
   key ('_hidden') so this needs no crm_views column. */
const _CRM_VHIDE='_hidden';
function _crmViewHidden(v){var f=(v&&v.filters)||{};return Array.isArray(f[_CRM_VHIDE])?f[_CRM_VHIDE]:[];}
function _crmViewHides(v,boardId){return _crmViewHidden(v).indexOf(boardId)>=0;}
/* The view's saved conditions for ONE board (filters is a per-board map: {boardId:[conds]}) */
function _crmViewFilters(v,boardId){if(boardId===_CRM_VHIDE)return[];var f=(v&&v.filters)||{};return (f&&!Array.isArray(f)&&Array.isArray(f[boardId]))?f[boardId]:[];}
const _crmPri={Low:['#786A5F','#F4F0EA'],Medium:['#7C5A26','#F5EFDF'],High:['#93301F','#FAEDE8'],Critical:['#7F6533','#F3EDEA']};
const _crmTime=iso=>{try{return new Date(iso).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});}catch(e){return'';}};
const _crmDT=iso=>{try{return new Date(iso).toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'});}catch(e){return'';}};
const _crmRel=iso=>{if(!iso)return'';const s=(Date.now()-new Date(iso).getTime())/1000;if(s<60)return'now';if(s<3600)return Math.floor(s/60)+'m';if(s<86400)return Math.floor(s/3600)+'h';return Math.floor(s/86400)+'d';};
const _crmBoard=id=>CRM.boards.find(b=>b.id===id);
const _crmConvo=id=>CRM.convos.find(c=>c.id===id);
const _crmHub=id=>(CRM.hubs||[]).find(h=>h.id===id);
function _crmBoardLabel(b){if(!b)return'';var h=_crmHub(b.hubId);return(h?h.name+' · ':'')+b.name;}
/* ── v2: unread + due-date helpers ── */
function _crmUnread(c){if(!c||!c.lastAt||!S.uid)return false;var last=(c.messages||[])[(c.messages||[]).length-1];if(last&&!last.fromCustomer&&last.senderId===S.uid)return false;var seen=(CRM.reads||{})[c.id];return !seen||String(c.lastAt)>String(seen);}
function _crmUnreadCount(boardId){return (CRM.convos||[]).filter(function(c){return c.boardId===boardId&&_crmUnread(c);}).length;}
function _crmMarkRead(id){var c=_crmConvo(id);if(!c||!S.uid)return;var now=new Date().toISOString();var seen=(CRM.reads||{})[id];if(seen&&String(seen)>=String(c.lastAt||''))return;if(!CRM.reads)CRM.reads={};CRM.reads[id]=now;sbWrite({table:'crm_reads',op:'upsert',values:{user_id:S.uid,conversation_id:id,last_seen_at:now},opts:{onConflict:'user_id,conversation_id'}},{label:'Read state',silent:true});}
/* ── v3: PER-BOARD CUSTOM STATUSES (ClickUp-style, fully dynamic) ──
   Stored in board.settings.statuses = [{name,color,done}] — no schema change needed.
   They drive the kanban columns, every status dropdown and the done/overdue logic. */
const _CRM_DEF_STATUSES=[{name:'Open',color:'#54433C'},{name:'In Progress',color:'#96695B'},{name:'Resolved',color:'#428059',done:true},{name:'Closed',color:'#786A5F',done:true}];
function _crmStatuses(b){var st=b&&b.settings&&b.settings.statuses;return (Array.isArray(st)&&st.length)?st:_CRM_DEF_STATUSES;}
function _crmStatusMeta(b,name){var st=_crmStatuses(b);return st.find(function(x){return x.name===name;})||{name:name||'Open',color:'#A59788'};}
function _crmIsDone(b,name){var m=_crmStatusMeta(b,name);if(typeof m.done==='boolean')return m.done;return name==='Resolved'||name==='Closed';}
function _crmNotDone(b,rows){return (rows||[]).filter(function(x){return !_crmIsDone(b,x.status);});}
/* Count badge for a ticket board: shows OPEN (not-done) tickets, red while any remain. */
function _crmNotDoneBadge(b,rows,on){
  var nd=_crmNotDone(b,rows).length,tot=(rows||[]).length;
  var col=nd?'#B3402E':(on?'#428059':'#CEC1B3');
  return'<span title="'+nd+' not done of '+tot+' ticket'+(tot===1?'':'s')+'" style="font-size:11px;font-weight:800;color:'+col+'">'+nd+'</span>';
}
function _crmStatusChip(b,name){var m=_crmStatusMeta(b,name);return'<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:800;color:'+m.color+';background:'+m.color+'1A;border-radius:20px;padding:3px 9px;white-space:nowrap"><span style="width:6px;height:6px;border-radius:50%;background:'+m.color+'"></span>'+esc(m.name)+'</span>';}
function _crmStatusSel(b,convo,style){if(!can('crm','edit'))return _crmStatusChip(b,convo.status);var m=_crmStatusMeta(b,convo.status);var st=style||('font-size:11.5px;font-weight:700;color:'+m.color+';background:'+m.color+'14;border:1px solid '+m.color+'33;border-radius:7px;padding:3px 24px 3px 7px;cursor:pointer;max-width:150px');var opts=_crmStatuses(b).map(function(x){return'<option '+(x.name===convo.status?'selected':'')+'>'+esc(x.name)+'</option>';}).join('');if(!_crmStatuses(b).some(function(x){return x.name===convo.status;}))opts='<option selected>'+esc(convo.status)+'</option>'+opts;return'<select onchange="App._crmSetStatus(\''+convo.id+'\',this.value)" style="'+st+'">'+opts+'</select>';}
function _crmDueMeta(c){if(!c||!c.isTicket||!c.dueDate)return null;var _b=_crmBoard(c.boardId);var over=c.dueDate<todayISO()&&!_crmIsDone(_b,c.status);var today=c.dueDate===todayISO();return{overdue:over,today:today,label:fmtS(c.dueDate),color:over?'#B3402E':today?'#7C5A26':'#786A5F',bg:over?'#FAEDE8':today?'#FBF7EB':'#F4F0EA'};}
function _crmCats(board){var c=board&&board.settings&&board.settings.categories;return (c&&c.length)?c:[];}
const _crmFirst=u=>u?(fullName(u).split(' ')[0]||fullName(u)):'';
const _CRM_EMO=['\u{1F44D}','❤️','\u{1F602}','\u{1F62E}','\u{1F622}','\u{1F64F}'];
function _crmCustAv(name,sz){sz=sz||34;var n=(name||'?').trim();var ini=(n[0]||'?').toUpperCase();var h=0;for(var i=0;i<n.length;i++)h+=n.charCodeAt(i);var bg=['#54433C','#96695B','#A97C33','#8A5D6B','#BC6E62','#A5796A'][h%6];return'<div style="width:'+sz+'px;height:'+sz+'px;border-radius:50%;background:'+bg+';color:#fff;display:grid;place-items:center;font-size:'+Math.round(sz*0.4)+'px;font-weight:700;flex-shrink:0">'+esc(ini)+'</div>';}
/* v3.20 — the chip is a CLASS, not inline styles, so it can invert inside the sender's own
   orange bubble (.crm-mine): a pale chip with dark-orange text was unreadable on #54433C. */
function _crmAtPlain(t){return esc(t||'').replace(/@(\w+)/g,'<span class="crm-tag">@$1</span>');}
function _crmAt(t){
  t=String(t||'');
  var re=/((?:https?:\/\/|www\.)[^\s<>"']+)/gi,out='',last=0,mm;
  while((mm=re.exec(t))){
    out+=_crmAtPlain(t.slice(last,mm.index));
    var raw=mm[1],trail='';
    var tm=raw.match(/[),.!?:;\]]+$/);if(tm){trail=tm[0];raw=raw.slice(0,raw.length-trail.length);}
    var href=raw.toLowerCase().indexOf('http')===0?raw:('https://'+raw);
    out+='<a class="crm-link" href="'+esc(href)+'" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">'+esc(raw)+'</a>'+_crmAtPlain(trail);
    last=mm.index+mm[1].length;
  }
  out+=_crmAtPlain(t.slice(last));
  return out;
}
function _crmImgs(imgs){if(!imgs||!imgs.length)return'';return'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">'+imgs.map(function(s){return'<img src="'+s+'" onclick="App._bigImg&&App._bigImg(this.src)" style="width:130px;height:96px;object-fit:cover;border-radius:10px;border:1px solid rgba(0,0,0,.08);cursor:pointer"/>';}).join('')+'</div>';}
async function _crmProvisionDefault(){var hid=uid('hub'),bid=uid('brd');_crmMarkFresh(hid);_crmMarkFresh(bid);CRM.hubs.push({id:hid,name:'General',icon:'msg'});if(S.uid)CRM.hubMembers[hid]=[S.uid];CRM.boards.push({id:bid,hubId:hid,name:'Chat',members:S.uid?[S.uid]:[],settings:{type:'chat'},createdBy:S.uid||null});CRM.sel.hubId=hid;CRM.sel.boardId=bid;try{await sb.from('crm_hubs').insert({id:hid,name:'General',icon:'msg',created_by:S.uid||null,sort:0});if(S.uid)await sb.from('crm_hub_members').insert({hub_id:hid,user_id:S.uid});await sb.from('crm_boards').insert({id:bid,hub_id:hid,name:'Chat',created_by:S.uid||null,sort:0,settings:{type:'chat'}});if(S.uid)await sb.from('crm_board_members').insert({board_id:bid,user_id:S.uid});}catch(e){console.warn('[CRM default]',e&&e.message);}}
/* ── v3.12: every hub ALWAYS has a Chat board by default — created with the hub and healed
   here if ever missing (deleted, or a hub left empty). Deterministic id ('brd_chat_<hubId>')
   makes this idempotent: two clients loading at once can never double-create it. ── */
function _crmEnsureChatBoards(){
  if(!S.uid||!can('crm','create'))return;
  (CRM.hubs||[]).forEach(function(h){
    // v3.19: only inside channels this person actually belongs to. Previously this ran for
    // every hub in the workspace and quietly created a board (with the runner as a member)
    // in channels they had never been given.
    if(!(_crmSeeAll()||_crmIsHubMember(h.id)))return;
    if((CRM.boards||[]).some(function(b){return b.hubId===h.id&&_crmBS(b).type==='chat';}))return;
    var bid='brd_chat_'+h.id;_crmMarkFresh(bid);
    if((CRM.boards||[]).some(function(b){return b.id===bid;}))return;
    CRM.boards.push({id:bid,hubId:h.id,name:'Chat',members:S.uid?[S.uid]:[],settings:{type:'chat'},createdBy:S.uid||null});
    sb.from('crm_boards').insert({id:bid,hub_id:h.id,name:'Chat',created_by:S.uid||null,sort:0,settings:{type:'chat'}}).then(function(r){
      if((!r||!r.error)&&S.uid)sb.from('crm_board_members').insert({board_id:bid,user_id:S.uid}).then(function(){}).catch(function(){});
    }).catch(function(){});
  });
}
async function _crmLoad(){
  if(CRM._loading)return;CRM._loading=true;CRM._err=null;
  try{
    const R=await Promise.all([
      sb.from('crm_hubs').select('*').order('sort',{ascending:true}),
      sb.from('crm_boards').select('*').order('sort',{ascending:true}),
      sb.from('crm_board_members').select('*'),
      sb.from('crm_categories').select('*').order('sort',{ascending:true}),
      sb.from('crm_conversations').select('*').order('last_at',{ascending:false}),
      sb.from('crm_messages').select('*').order('created_at',{ascending:true}),
      sb.from('crm_activity').select('*').order('created_at',{ascending:false}).limit(500),
      sb.from('workspace_settings').select('*').eq('key','crm_settings'),
      sb.from('crm_reads').select('*').eq('user_id',S.uid||''),
      sb.from('crm_views').select('*').order('sort',{ascending:true}),
      sb.from('crm_hub_members').select('*')
    ]);
    if(R[0].error)throw R[0].error;
    CRM.hubs=(R[0].data||[]).map(r=>({id:r.id,name:r.name,icon:r.icon||'folder'}));
    const mb={};(R[2].data||[]).forEach(r=>{(mb[r.board_id]=mb[r.board_id]||[]).push(r.user_id);});
    CRM.boards=(R[1].data||[]).map(r=>({id:r.id,hubId:r.hub_id,name:r.name,members:mb[r.id]||[],settings:r.settings||{},createdBy:r.created_by||null}));
    CRM.categories=(R[3].data||[]).map(r=>r.name);
    const mc={};(R[5].data||[]).forEach(r=>{(mc[r.conversation_id]=mc[r.conversation_id]||[]).push({id:r.id,senderId:r.sender_id,fromCustomer:r.from_customer,name:r.name,text:r.body||'',images:r.images||[],at:r.created_at,reactions:r.reactions||{},parentId:r.parent_id||null,edited:!!r.edited_at});});
    CRM.convos=(R[4].data||[]).map(r=>({id:r.id,boardId:r.board_id,title:r.title,customer:r.customer,channel:r.channel,isTicket:r.is_ticket,ticketType:r.ticket_type,priority:r.priority||'Medium',status:r.status||'Open',assignedTo:r.assigned_to||null,assignedGroup:r.assigned_group||null,createdBy:r.created_by||null,decision:r.decision||null,decidedBy:r.decided_by||null,decidedAt:r.decided_at||null,fields:r.fields||{},dueDate:r.due_date||null,createdAt:r.created_at,lastAt:r.last_at,messages:mc[r.id]||[]}));CRM.activity=(R[6].data||[]).map(function(r){return{id:r.id,conversationId:r.conversation_id,boardId:r.board_id,actor:r.actor,action:r.action,detail:r.detail||'',at:r.created_at};});try{var _gs=R[7].data&&R[7].data[0]&&R[7].data[0].value;if(_gs&&typeof _gs==='object')CRM.settings=_gs;}catch(e){}CRM.channels=[];CRM.views=((R[9]&&R[9].data)||[]).map(function(r){var fl=r.filters;if(fl&&typeof fl==='object'&&!Array.isArray(fl)){}else if(Array.isArray(fl)&&fl.length&&r.board_id){var _m={};_m[r.board_id]=fl;fl=_m;}else{fl={};}return{id:r.id,hubId:r.hub_id,name:r.name||'',filters:fl,members:Array.isArray(r.members)?r.members:[],createdBy:r.created_by||null,sort:r.sort||0};});CRM.reads={};((R[8]&&R[8].data)||[]).forEach(function(r){CRM.reads[r.conversation_id]=r.last_seen_at;});
    CRM.hubMembers={};((R[10]&&R[10].data)||[]).forEach(function(r){(CRM.hubMembers[r.hub_id]=CRM.hubMembers[r.hub_id]||[]).push(r.user_id);});
    if(!CRM.hubs.length&&can('crm','create')&&S.uid)await _crmProvisionDefault();
    _crmEnsureChatBoards();
    if(CRM.sel.viewId&&!_crmViewVisible(_crmView(CRM.sel.viewId)))CRM.sel.viewId=null;
    const vb=_crmVisibleBoards();
    if(!CRM.sel.viewId&&(!CRM.sel.boardId||!vb.some(x=>x.id===CRM.sel.boardId))){var fb=vb[0];CRM.sel.boardId=fb?fb.id:null;CRM.sel.hubId=fb?fb.hubId:null;}
    // v3.18: a board restored from the last session decides the hub, so a refresh lands on the same tab.
    if(CRM.sel.boardId){var _rb=_crmBoard(CRM.sel.boardId);if(_rb)CRM.sel.hubId=_rb.hubId;}
  }catch(e){CRM._err=(e&&e.message)||'Failed to load';console.warn('[CRM load]',CRM._err);}
  CRM._loaded=true;CRM._loading=false;rr();try{_crmCheckReminders();}catch(e){}
  try{_crmLiveInitTs();_crmLiveStart();}catch(e){}
}
const _crmStyle='<style>'
+'.crm-only-mob{display:none!important}'
/* ── desktop hover affordances ── */
+'.crm-chrow:hover .crm-chx{display:grid!important}'
+'.crm-row:hover .crm-del{display:grid!important}'
+'.crm-brd:hover .crm-bdel{display:grid!important}'
+'.crm-hub:hover .crm-hdel{display:grid!important}'
+'.crm-tab:hover .crm-tx{display:inline-flex!important}'
+'.crm-msg:hover .crm-macts{display:flex!important}'
+'.crm-colh:hover .crm-colx{display:inline-flex!important}'
+'.crm-scroll::-webkit-scrollbar{width:9px;height:9px}.crm-scroll::-webkit-scrollbar-thumb{background:#E4DBD0;border-radius:9px}.crm-scroll::-webkit-scrollbar-track{background:transparent}'
+'.crm-cell:focus{border-color:#54433C!important;background:#fff!important}.crm-trow:hover{background:#FAF7F3}'
/* v3.20 @-mention chip: readable on BOTH bubble colours */
+'.crm-tag{background:#F2EDE5;color:#3E322B;font-weight:700;border-radius:4px;padding:0 4px}'
+'.crm-msg.crm-mine .crm-tag{background:rgba(255,255,255,.24);color:#fff}'
+'#crm-mention .crm-mrow:active{background:#F4F0EA}'
+'.crm-rz{position:absolute;right:-4px;top:0;bottom:0;width:9px;cursor:col-resize;z-index:3}.crm-rz:hover,.crm-rz:active{background:rgba(84,67,60,.28);border-radius:3px}'
+'.crm-grip{display:inline-flex;align-items:center;color:#D2C5B7;cursor:grab;margin-right:6px;vertical-align:middle;padding:2px;border-radius:4px}.crm-grip:hover{color:#54433C;background:#EEE4D5}.crm-grip:active{cursor:grabbing}'
+'.crm-colh.crm-drop-l{box-shadow:inset 3px 0 0 #54433C}.crm-colh.crm-drop-r{box-shadow:inset -3px 0 0 #54433C}.crm-colh.crm-dragging{opacity:.45}'
/* ══ MOBILE ══ */
+'@media(max-width:767px){'
  /* clear the bottom nav AND the iOS home indicator */
  +'.crm-fs{bottom:calc(60px + env(safe-area-inset-bottom))!important}'
  /* iOS Safari sizes a position:fixed box against the LARGE viewport (toolbar hidden), so the
     bottom edge - and with it the message composer - ends up underneath Safari's own toolbar.
     100dvh tracks the visible viewport instead, so the composer always sits on the bottom nav.
     Wrapped in @supports so older browsers keep the bottom-offset version above. */
  +'@supports(height:100dvh){.crm-fs{top:0!important;bottom:auto!important;height:calc(100dvh - 60px - env(safe-area-inset-bottom))!important}}'
  /* hub drawer + its scrim */
  +'.crm-nav{position:absolute!important;left:0;top:0;bottom:0;z-index:41;width:82%!important;max-width:300px;transform:translateX(-100%);transition:transform .2s;box-shadow:4px 0 26px rgba(0,0,0,.22)}'
  +'.crm-nav.crmopen{transform:none!important}'
  +'.crm-scrim{position:absolute;inset:0;z-index:40;background:rgba(10,27,33,.42);opacity:0;pointer-events:none;transition:opacity .2s}'
  +'.crm-scrim.on{opacity:1;pointer-events:auto}'
  /* list <-> chat swap */
  +'.crm-listcol{width:100%!important;max-width:none!important;min-width:0!important}'
  +'.crm-chatpane{display:none!important}'
  +'.crm-hasconvo .crm-listcol{display:none!important}'
  +'.crm-hasconvo .crm-chatpane{display:flex!important}'
  +'.crm-hasconvo .crm-boardbar{display:none!important}'
  +'.crm-hasconvo .crm-tabsrow{display:none!important}'
  +'.crm-only-mob{display:inline-flex!important}'
  /* row affordances have no hover on touch, so they stay visible - but tappable */
  +'.crm-hdel,.crm-chx{display:none!important}.crm-del,.crm-bdel{display:flex!important;align-items:center;justify-content:center;min-width:32px;min-height:32px}.crm-hdr-sec{display:none!important}.crm-msg{max-width:86%!important}'
  /* THE FIX: the message action bar is tap-to-open, not permanently pinned.
     It used to be forced visible on every message, so it never went away after sending. */
  +'.crm-macts{display:none!important}'
  +'.crm-msg.crm-actopen .crm-macts{display:flex!important}'
  +'.crm-macts{position:absolute;top:100%;bottom:auto;margin-top:6px;margin-bottom:0;right:0;left:auto;flex-wrap:wrap;max-width:min(300px,88vw);gap:2px!important;padding:5px!important;box-shadow:0 8px 26px rgba(35,28,22,.26)!important}'
  +'.crm-msg:not(.crm-mine) .crm-macts{right:auto;left:0}'
  +'.crm-macts button{min-width:38px!important;min-height:38px!important;display:inline-flex!important;align-items:center;justify-content:center;padding:0!important;font-size:17px!important}'
  /* the ticket details panel was display:none on mobile, so assignee/status/fields/reminders
     were unreachable. It is now a dismissable bottom sheet. */
  +'.crm-hide-mob{display:none!important}'
  +'.crm-details.crm-dopen{display:flex!important;position:fixed;left:0;right:0;bottom:0;top:auto;z-index:60;width:auto!important;max-height:78vh;border-left:none!important;border-top:1px solid #E6DED3;border-radius:18px 18px 0 0;box-shadow:0 -14px 44px rgba(35,28,22,.3);overflow-y:auto;padding-bottom:calc(14px + env(safe-area-inset-bottom))}'
  +'.crm-dscrim{position:fixed;inset:0;z-index:59;background:rgba(10,27,33,.42)}'
  /* the thread panel had no mobile rule at all - it left ~40px for the message list */
  +'.crm-thread-panel{position:fixed!important;left:0;right:0;top:0;bottom:calc(60px + env(safe-area-inset-bottom));width:auto!important;z-index:58;border-left:none!important}'
  /* v3.18 THE COMPOSER FIX. iOS Safari does not reliably constrain a flex column nested this
     deep, so #crm-thread grew to its full content height: the messages painted straight through
     the bottom nav and the composer was pushed off-screen entirely. On mobile the chat pane is
     therefore lifted OUT of the flex chain and pinned to .crm-fs (its nearest positioned
     ancestor), which gives every row below it a definite height to divide up. */
  +'.crm-hasconvo .crm-chatpane{position:absolute!important;top:0;left:0;right:0;bottom:0;flex-direction:column!important;overflow:hidden}'
  +'.crm-chatbody{flex:1 1 auto!important;min-height:0!important;overflow:hidden}'
  +'.crm-threadcol{flex:1 1 auto!important;min-height:0!important;overflow:hidden}'
  +'#crm-thread{flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important}'
  +'.crm-composer{flex:0 0 auto!important;background:#fff;z-index:2}'
  /* v3.19 THE ACTUAL BUG. main.css ships a blunt mobile rule —
       #content [style*="display:flex"]:not([style*="flex-direction:column"]){flex-wrap:wrap}
     — which matched .crm-chatbody (inline display:flex, row). In a WRAPPING flex container a
     flex line is sized to its content, so .crm-threadcol grew to the full height of the message
     list instead of being clipped by its parent: the thread never became scrollable and the
     composer was laid out below the fold. The same rule wrapped the composer row (attach button
     on one line, textarea on the next) and could drop long bubbles under their avatar.
     Everything in the chat column is an explicit single-line row — say so. */
  +'.crm-chatpane,.crm-chatbody,.crm-threadcol,.crm-composer>div,#crm-thread>div{flex-wrap:nowrap!important}'
  /* a bubble may never be wider than the row minus the 24px avatar + 7px gap */
  +'.crm-msg{max-width:calc(100% - 34px)!important}'
  /* v3.19 density — the phone view was scaled for a desktop pane. ~10% tighter across the board:
     slimmer header, tighter bubbles, a compact composer. Nothing shrinks below a 44px tap target
     and the textarea stays at 16px so iOS does not zoom the viewport on focus. */
  +'.crm-chathdr{padding:6px 10px!important;gap:8px!important}'
  +'.crm-chathdr .fd{font-size:14px!important}'
  +'.crm-chathdr .crm-chatsub{font-size:11px!important}'
  +'#crm-thread{padding:8px 10px!important}'
  +'.crm-msg .crm-bub{font-size:12.5px!important;line-height:1.38!important;padding:6px 9px!important}'
  +'.crm-msg .crm-who{font-size:10px!important}'
  +'.crm-composer{padding:6px 8px!important}'
  +'.crm-composer textarea{min-height:38px!important;padding:8px 10px!important}'
  +'.crm-composer .crm-sendrow>label,.crm-composer .crm-sendrow>button{width:36px!important;height:36px!important;min-height:36px!important}'
  /* v3.20 — the @-mention picker was a 240px desktop popover; on a phone it becomes a
     full-width sheet pinned above the composer, with thumb-sized rows. */
  +'#crm-mention{left:6px!important;right:6px!important;width:auto!important;max-height:46vh!important;border-radius:14px!important;box-shadow:0 -8px 30px rgba(35,28,22,.22)!important;padding:8px!important}'
  +'#crm-mention .crm-mrow{min-height:46px!important;padding:8px 10px!important;border-radius:10px!important}'
  +'#crm-mention .crm-mname{font-size:14px!important}'
  +'@supports(height:100dvh){.crm-thread-panel{bottom:auto!important;height:calc(100dvh - 60px - env(safe-area-inset-bottom))!important}}'
  /* every CRM control reaches a 44px tap target */
  +'.crm-fs button{min-height:38px}'
  +'.crm-fs .crm-tap,.crm-fs button[onclick*="_crmMob"],.crm-fs .crm-hdr-btn{min-width:44px!important;min-height:44px!important}'
  +'.crm-fs input,.crm-fs select,.crm-fs textarea{font-size:16px!important;min-height:44px}'   /* 16px stops iOS zooming on focus */
  +'.crm-fs textarea{min-height:44px}'
  /* nothing inside the CRM may push the viewport sideways */
  +'.crm-fs,.crm-fs *{max-width:100%}'
  +'.crm-fs [style*="position:absolute"]{max-width:94vw}'
  /* the table keeps its own scroller but gains momentum + a visible edge */
  +'.crm-scroll{-webkit-overflow-scrolling:touch}'
+'}'
+'</style>';
function _crmEmpty(icon,title,sub,btn){return'<div style="flex:1;display:grid;place-items:center;padding:40px"><div style="text-align:center;max-width:360px"><div style="width:56px;height:56px;border-radius:16px;background:#F7F4EF;color:#54433C;display:grid;place-items:center;margin:0 auto 14px">'+ic(icon,'w-7 h-7')+'</div><div class="fd" style="font-size:16px;font-weight:800;color:#13171B">'+esc(title)+'</div><div style="font-size:13px;color:#A59788;margin-top:5px;line-height:1.5">'+esc(sub)+'</div>'+(btn||'')+'</div></div>';}
function _crmConvoRow(c,activeId,showBoard){
  var active=c.id===activeId;var last=(c.messages||[])[c.messages.length-1];var unread=_crmUnread(c);var due=_crmDueMeta(c);
  var snip=last?((last.fromCustomer?'':'You: ')+(last.text||((last.images&&last.images.length)?'\u{1F4F7} Photo':''))):'No messages yet';
  var typeChip=c.isTicket?'<span style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#7F6533;background:#F2E9D4;border-radius:5px;padding:1px 5px">'+esc(c.ticketType||'Ticket')+'</span>':'';
  var asg=c.assignedTo&&uById(c.assignedTo)?'<span title="Assigned to '+esc(fullName(uById(c.assignedTo)))+'">'+avatar(uById(c.assignedTo),'w-[18px] h-[18px]','text-[8px]')+'</span>':(c.assignedGroup&&_crmGroup(c.assignedGroup)?'<span title="Assigned to group “'+esc(_crmGroup(c.assignedGroup).name)+'”" style="width:18px;height:18px;border-radius:50%;background:#EEE4D5;color:#3E322B;display:inline-grid;place-items:center;flex-shrink:0">'+ic('users','w-2.5 h-2.5')+'</span>':'');
  var bd=showBoard&&_crmBoard(c.boardId)?'<span style="font-size:9.5px;font-weight:700;color:#786A5F;background:#F3EFE7;border-radius:5px;padding:1px 6px">'+esc(_crmBoard(c.boardId).name)+'</span>':'';
  var del=can('crm','delete')?'<button title="Delete" onclick="event.stopPropagation();App._crmDelConvo(\''+c.id+'\')" class="crm-del" style="position:absolute;top:9px;right:9px;width:22px;height:22px;border:none;background:#fff;color:#B3402E;cursor:pointer;border-radius:6px;display:none;place-items:center;box-shadow:0 1px 3px rgba(0,0,0,.12)">'+ic('trash','w-3.5 h-3.5')+'</button>':'';
  return'<div class="crm-row" data-cid="'+c.id+'" onclick="'+(showBoard?'App._crmOpenResult':'App._crmSelConvo')+'(\''+c.id+'\')" style="position:relative;cursor:pointer;padding:8px 10px;border-bottom:1px solid #F4F0EA;background:'+(active?'#F7F4EF':unread?'#F9F6F2':'#fff')+';border-left:3px solid '+(active?'#54433C':unread?'#D1B68F':'transparent')+'">'
    +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">'+_crmCustAv(c.customer,30)
    +'<span style="font-size:13px;font-weight:700;color:#13171B;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(c.customer||'—')+'</span>'
    +(unread?'<span class="crm-unb" title="Unread">'+_crmUnreadN(c)+'</span>':'')+'<span style="font-size:10px;color:'+(unread?'#54433C':'#A8998A')+';font-weight:'+(unread?'800':'400')+';flex-shrink:0">'+_crmRel(c.lastAt)+'</span></div>'
    +'<div style="font-size:12px;font-weight:600;color:#3A312A;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-left:38px">'+esc(c.title||'')+'</div>'
    +'<div style="display:flex;align-items:center;gap:6px;margin-left:38px;margin-top:2px">'+bd+'<span style="font-size:11px;color:#A59788;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(snip)+'</span>'+typeChip+(due?'<span style="font-size:9.5px;font-weight:800;color:'+due.color+';background:'+due.bg+';border-radius:5px;padding:1px 6px;flex-shrink:0">'+(due.overdue?'\u26A0 ':'')+due.label+'</span>':'')+'</div>'+del+'</div>';
}
function _crmReactChips(m,cid){
  var ks=Object.keys(m.reactions||{}).filter(function(e){return (m.reactions[e]||[]).length;});
  if(!ks.length)return'';
  return'<div class="crm-reacts">'+ks.map(function(e){var arr=m.reactions[e]||[];var mine=arr.indexOf(S.uid)>=0;return'<button class="crm-rchip'+(mine?' on':'')+'" onclick="App._crmReact(\''+cid+'\',\''+m.id+'\',\''+encodeURIComponent(e)+'\')">'+e+(arr.length>1?' <b>'+arr.length+'</b>':'')+'</button>';}).join('')+'</div>';
}
function _crmMsgActions(m,cid,thread){
  if(m.fromCustomer)return'';
  var own=m.senderId===S.uid;var part=can('crm','create');if(!part&&!can('crm','delete'))return'';
  var b='';
  if(part)b+=_CRM_EMO.map(function(e){return'<button title="React" onclick="App._crmReact(\''+cid+'\',\''+m.id+'\',\''+encodeURIComponent(e)+'\')" style="border:none;background:transparent;cursor:pointer;font-size:14px;line-height:1;padding:2px 3px">'+e+'</button>';}).join('')+'<button title="More reactions" onclick="App._crmEmoOpen(event,\'react\',\''+cid+'\',\''+m.id+'\')" style="border:none;background:transparent;cursor:pointer;color:#786A5F;font-size:14px;font-weight:800;line-height:1;padding:2px 5px">+</button>';
  if(part&&!thread&&!m.parentId)b+='<button title="Reply in thread" onclick="App._crmOpenThread(\''+m.id+'\')" style="border:none;background:transparent;cursor:pointer;color:#786A5F;padding:2px 3px">'+ic('msg','w-3.5 h-3.5')+'</button>';
  if(part)b+='<button title="Create ticket from this message" onclick="App._crmTicketFromMsg(\''+cid+'\',\''+m.id+'\')" style="border:none;background:transparent;cursor:pointer;color:#54433C;padding:2px 3px">'+ic('ticket','w-3.5 h-3.5')+'</button>';
  if(own&&part)b+='<button title="Edit" onclick="App._crmEditMsg(\''+cid+'\',\''+m.id+'\')" style="border:none;background:transparent;cursor:pointer;color:#786A5F;padding:2px 3px">'+ic('edit','w-3.5 h-3.5')+'</button>';
  if(own&&part)b+='<button title="Forward" onclick="App._crmForward(\''+m.id+'\')" style="border:none;background:transparent;cursor:pointer;color:#786A5F;padding:2px 3px">'+ic('send','w-3.5 h-3.5')+'</button>';
  if((own&&part)||can('crm','delete'))b+='<button title="Delete" onclick="App._crmDelMsg(\''+cid+'\',\''+m.id+'\')" style="border:none;background:transparent;cursor:pointer;color:#B3402E;padding:2px 3px">'+ic('trash','w-3.5 h-3.5')+'</button>';
  return'<div class="crm-macts" style="display:none;position:absolute;top:-13px;'+(!m.fromCustomer?'right:2px':'left:2px')+';background:#fff;border:1px solid #E6DED3;border-radius:10px;box-shadow:0 4px 14px rgba(35,28,22,.16);padding:1px 3px;gap:0;align-items:center;z-index:25">'+b+'</div>';
}
function _crmMsg(m,cid,thread,prev){
  var editing=CRM.editMsgId===m.id;var _co=_crmConvo(cid);var _bd=_co?_crmBoard(_co.boardId):null;var _isChat=_bd?(_crmBS(_bd).type==='chat'):false;var mine=_isChat?(m.senderId===S.uid):(!m.fromCustomer);
  var who=m.fromCustomer?(m.name||'Customer'):(uById(m.senderId)?fullName(uById(m.senderId)):'You');
  var av=m.fromCustomer?_crmCustAv(m.name,24):(uById(m.senderId)?avatar(uById(m.senderId),'w-[24px] h-[24px]','text-[8px]'):_crmCustAv('You',24));
  var grouped=false;
  if(prev&&!editing){var same=(!!m.fromCustomer===!!prev.fromCustomer)&&(m.fromCustomer?(m.name===prev.name):(m.senderId===prev.senderId));var dtms=0;try{dtms=new Date(m.at)-new Date(prev.at);}catch(e){}grouped=same&&dtms>=0&&dtms<5*60000;}
  if(grouped||(mine&&_isChat))av='<div style="width:24px;flex-shrink:0"></div>';
  var bigemo=!editing&&!(m.images||[]).length&&_crmEmojiOnly(m.text);
  var anim=_crmAnimCls(m,mine);
  var meta='<span class="crm-meta'+(bigemo?' crm-meta-out':'')+'">'+(m.edited?'<i class="crm-edited">edited</i>':'')+_crmTime(m.at)+(mine&&m.senderId===S.uid?_crmTicks(m,cid):'')+'</span>';
  var bub=mine?'crm-bub-mine':'crm-bub-their';
  var inner=editing
    ?'<textarea id="crm-edit-'+m.id+'" rows="2" style="width:280px;max-width:60vw;border:1px solid #E6DED3;border-radius:10px;padding:8px;font-size:13.5px;font-family:inherit;outline:none">'+esc(m.text)+'</textarea><div style="display:flex;gap:6px;margin-top:5px;justify-content:flex-end"><button onclick="App._crmCancelEdit()" style="font-size:11px;padding:4px 9px;border:1px solid #E6DED3;background:#fff;border-radius:7px;cursor:pointer">Cancel</button><button onclick="App._crmSaveEdit(\''+cid+'\',\''+m.id+'\')" style="font-size:11px;padding:4px 9px;border:none;background:#54433C;color:#fff;border-radius:7px;cursor:pointer">Save</button></div>'
    :'<div class="crm-bub '+bub+(bigemo?' crm-bigemo':'')+((m.images||[]).length&&!m.text?' crm-media':'')+'" title="'+_crmDT(m.at)+'">'+_crmAt(m.text)+_crmImgs(m.images)+meta+'</div>';
  var replies=(!thread&&!m.parentId)?((_crmConvo(cid)||{messages:[]}).messages||[]).filter(x=>x.parentId===m.id):[];
  var opener=replies.length?'<button onclick="App._crmOpenThread(\''+m.id+'\')" style="margin-top:3px;border:none;background:transparent;color:#54433C;font-size:11.5px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:4px">'+ic('msg','w-3 h-3')+replies.length+' repl'+(replies.length===1?'y':'ies')+'</button>':'';
  var col='<div class="crm-msg'+(mine?' crm-mine':'')+anim+'" data-mid="'+m.id+'"'+((!thread&&!m.parentId&&!editing)?' data-swipe="1"':'')+' onclick="App._crmMsgActs(event,this)" style="position:relative;max-width:78%;display:flex;flex-direction:column;'+(mine?'align-items:flex-end':'align-items:flex-start')+'">'
    +((grouped||mine)?'':'<div class="crm-who" style="font-size:10.5px;font-weight:700;color:#A59788;margin:0 4px 2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%">'+esc(who)+'</div>')
    +'<span class="crm-swhint">'+ic('msg','w-3.5 h-3.5')+'</span>'
    +inner+_crmReactChips(m,cid)+opener
    +(editing?'':_crmMsgActions(m,cid,thread))+'</div>';
  return'<div class="crm-line" style="display:flex;gap:7px;'+(mine?'flex-direction:row-reverse':'')+';align-items:flex-end;margin-top:'+(prev?(grouped?2:10):0)+'px">'+av+col+'</div>';
}
function _crmMentionItems(q){
  var b=_crmBoard(CRM.sel.boardId);var mem=_crmBoardPeople(b);q=(q||'').toLowerCase();
  var list=mem.filter(u=>!q||fullName(u).toLowerCase().indexOf(q)>=0);
  var memIds={};mem.forEach(function(u){memIds[u.id]=1;});
  // Groups are taggable too — only groups with at least one member of this board
  var glist=_crmGroups().filter(function(g){var n=String(g.name||'').toLowerCase();var t=_crmGroupToken(g).toLowerCase();return (!q||n.indexOf(q)>=0||t.indexOf(q)>=0)&&(g.members||[]).some(function(id){return memIds[id];});});
  var rows='<button class="crm-mrow" onmousedown="event.preventDefault();App._crmPickMention(\'ALL\')" style="width:100%;text-align:left;display:flex;align-items:center;gap:8px;padding:7px 8px;border:none;background:transparent;border-radius:8px;cursor:pointer" onmouseover="this.style.background=\'#F4F0EA\'" onmouseout="this.style.background=\'transparent\'"><span style="width:24px;height:24px;border-radius:50%;background:#13171B;color:#fff;display:grid;place-items:center;font-size:11px;font-weight:800">@</span><span class="crm-mname" style="font-size:12.5px;font-weight:700;color:#13171B">Everyone</span><span style="font-size:10px;color:#A59788;margin-left:auto">notify all</span></button>';
  rows+=glist.map(function(g){return'<button class="crm-mrow" onmousedown="event.preventDefault();App._crmPickMention(\'grp:'+g.id+'\')" style="width:100%;text-align:left;display:flex;align-items:center;gap:8px;padding:6px 8px;border:none;background:transparent;border-radius:8px;cursor:pointer" onmouseover="this.style.background=\'#F4F0EA\'" onmouseout="this.style.background=\'transparent\'"><span style="width:24px;height:24px;border-radius:50%;background:#EEE4D5;color:#3E322B;display:grid;place-items:center;flex-shrink:0">'+ic('users','w-3 h-3')+'</span><span class="crm-mname" style="font-size:12.5px;font-weight:700;color:#13171B">'+esc(g.name)+'</span><span style="font-size:10px;color:#A59788;margin-left:auto">group · '+((g.members||[]).length)+'</span></button>';}).join('');
  rows+=list.map(u=>'<button class="crm-mrow" onmousedown="event.preventDefault();App._crmPickMention(\''+u.id+'\')" style="width:100%;text-align:left;display:flex;align-items:center;gap:8px;padding:6px 8px;border:none;background:transparent;border-radius:8px;cursor:pointer" onmouseover="this.style.background=\'#F4F0EA\'" onmouseout="this.style.background=\'transparent\'">'+avatar(u,'w-6 h-6','text-[9px]')+'<span class="crm-mname" style="font-size:12.5px;font-weight:600;color:#13171B">'+esc(fullName(u))+'</span></button>').join('');
  if(!list.length&&!glist.length)rows+='<div style="padding:8px;font-size:12px;color:#A59788">No matching teammate on this board</div>';
  return rows;
}
/* ── v3: Details side panel — every field of a ticket editable in one place ── */
function _crmDetailsPanel(convo,board){
  if(!convo||!convo.isTicket||CRM.detailsOpen===false)return'';
  var canEd=can('crm','edit');var canAsg=can('crm','assign');
  var dm=_crmDueMeta(convo);
  var asgU=convo.assignedTo?uById(convo.assignedTo):null;
  var asgG=convo.assignedGroup?_crmGroup(convo.assignedGroup):null;
  var selSt='width:100%;box-sizing:border-box;border:1.5px solid #EAE3D8;border-radius:10px;padding:8px 10px;font-size:12.5px;font-weight:600;background:#fff;cursor:pointer;outline:none;color:#13171B';
  var fRow=function(label,inner){return'<div style="margin-bottom:14px"><div style="font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#A8998A;margin-bottom:6px">'+label+'</div>'+inner+'</div>';};
  var cols=(board&&board.settings&&board.settings.columns)||[];
  var acts=_crmActFor(convo.id).slice(0,8);
  return (CRM._mobDetails?'<div class="crm-dscrim crm-only-mob" onclick="App._crmMobDetails(false)"></div>':'')
    +'<div class="crm-hide-mob crm-details'+(CRM._mobDetails?' crm-dopen':'')+'" style="width:284px;flex-shrink:0;border-left:1px solid #F0EAE2;background:#FBF9F5;display:flex;flex-direction:column;min-height:0">'
    +(CRM._mobDetails?'<button class="crm-only-mob crm-tap" onclick="App._crmMobDetails(false)" aria-label="Close details" style="position:sticky;top:0;align-self:flex-end;border:none;background:transparent;font-size:20px;line-height:1;color:#786A5F;padding:8px 12px">\u00d7</button>':'')
    +'<div style="padding:13px 16px;border-bottom:1px solid #F0EAE2;display:flex;align-items:center;justify-content:space-between;flex-shrink:0"><span class="fd" style="font-weight:800;font-size:13.5px;color:#13171B">Ticket details</span><button onclick="App._crmTogDetails()" style="border:none;background:transparent;color:#B8AA9C;cursor:pointer;display:grid;place-items:center">'+ic('x','w-3.5 h-3.5')+'</button></div>'
    +'<div class="crm-scroll" style="flex:1;overflow-y:auto;padding:16px">'
    +fRow('Assignee',canAsg?_crmAsgSelect(convo,board,selSt):(asgU?esc(fullName(asgU)):(asgG?_crmGroupChip(asgG):'\u2014')))
    +fRow('Status',canEd?_crmStatusSel(board,convo,selSt):_crmStatusChip(board,convo.status))
    +fRow('Customer','<span style="font-size:12.5px;font-weight:700">'+esc(convo.customer||'\u2014')+'</span>')
    +(function(){var _dc=cols.filter(function(c){return c.type!=='remind';});return _dc.length?'<div style="border-top:1px dashed #EAE3D8;padding-top:12px">'+_dc.map(function(col){return fRow(esc(col.name),_crmCell(convo,col));}).join('')+'</div>':'';})()
    +fRow('Created','<span style="font-size:12px;color:#7B6D62">'+_crmDT(convo.createdAt)+'</span>')
    +(acts.length?'<div style="border-top:1px dashed #EAE3D8;padding-top:12px"><div style="font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#A8998A;margin-bottom:6px">Activity</div>'+acts.map(function(a){var au=uById(a.actor);return '<div style="font-size:11.5px;color:#75675C;padding:3px 0;line-height:1.45"><b style="color:#13171B">'+esc(au?_crmFirst(au):'Someone')+'</b> '+esc(a.action)+(a.detail?' \u2014 '+esc(a.detail):'')+' <span style="color:#B8AA9C">\u00B7 '+_crmRel(a.at)+'</span></div>';}).join('')+'</div>':'')
    +'</div></div>';
}
function _crmChatPane(convo,board){
  if(!convo)return '<div class="crm-chatpane" style="flex:1;display:flex;min-width:0;min-height:0">'+_crmEmpty('msg','No conversation selected',(_crmFilteredConvos().length?'Pick a conversation from the list.':'Start a new conversation using the form on the left.'),'')+'</div>';
  var meta;
  if(convo.isTicket){
    meta='<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap"><span style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#3E322B;background:#EEE4D5;border-radius:6px;padding:3px 8px">'+esc(convo.ticketType||'Ticket')+'</span></div>';
  }else{
    meta='';
  }
  var asgU=convo.assignedTo?uById(convo.assignedTo):null;var bmem=_crmBoardPeople(board);
  var asgG2=convo.assignedGroup?_crmGroup(convo.assignedGroup):null;
  var bgrps=_crmBoardGroups(board);if(asgG2&&!bgrps.some(function(g){return g.id===asgG2.id;}))bgrps=[asgG2].concat(bgrps);
  var _asgBtnInner=asgU?avatar(asgU,'w-5 h-5','text-[8px]')+'<span>'+esc(_crmFirst(asgU))+'</span>':(asgG2?'<span style="width:20px;height:20px;border-radius:50%;background:#EEE4D5;color:#3E322B;display:inline-grid;place-items:center">'+ic('users','w-3 h-3')+'</span><span>'+esc(asgG2.name)+'</span>':ic('user','w-4 h-4')+'<span>Assign</span>');
  var assignCtl=can('crm','assign')?'<div style="position:relative"><button onclick="App._crmTogAssign()" title="Assign to a person or a group" style="display:inline-flex;align-items:center;gap:6px;background:#fff;border:1px solid #E6DED3;border-radius:10px;padding:5px 9px;cursor:pointer;font-size:12px;font-weight:600;color:#3A312A">'+_asgBtnInner+'</button><div id="crm-assign" style="display:none;position:absolute;right:0;top:38px;z-index:60;background:#fff;border:1px solid #E6DED3;border-radius:12px;box-shadow:0 12px 32px rgba(35,28,22,.18);padding:6px;width:230px;max-height:280px;overflow:auto"><div style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#A59788;padding:4px 8px">Assign to</div><button onclick="App._crmAssign(\''+convo.id+'\',\'\')" style="width:100%;text-align:left;padding:6px 8px;border:none;background:transparent;border-radius:8px;cursor:pointer;font-size:12.5px;color:#786A5F">Unassigned</button>'
    +(bgrps.length?'<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#A59788;padding:6px 8px 2px">Groups</div>'+bgrps.map(function(g){var on=convo.assignedGroup===g.id;return'<button onclick="App._crmAssign(\''+convo.id+'\',\'grp:'+g.id+'\')" style="width:100%;text-align:left;display:flex;align-items:center;gap:8px;padding:6px 8px;border:none;background:'+(on?'#EEE4D5':'transparent')+';border-radius:8px;cursor:pointer" onmouseover="this.style.background=\'#F4F0EA\'" onmouseout="this.style.background=\''+(on?'#EEE4D5':'transparent')+'\'"><span style="width:24px;height:24px;border-radius:50%;background:#EEE4D5;color:#3E322B;display:inline-grid;place-items:center;flex-shrink:0">'+ic('users','w-3 h-3')+'</span><span class="crm-mname" style="font-size:12.5px;font-weight:700;color:#13171B;flex:1">'+esc(g.name)+'</span><span style="font-size:10px;color:#A59788">'+((g.members||[]).length)+'</span></button>';}).join('')+'<div style="height:1px;background:#F1ECE4;margin:4px 6px"></div><div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#A59788;padding:2px 8px">People</div>':'')
    +bmem.map(u=>'<button onclick="App._crmAssign(\''+convo.id+'\',\''+u.id+'\')" style="width:100%;text-align:left;display:flex;align-items:center;gap:8px;padding:6px 8px;border:none;background:transparent;border-radius:8px;cursor:pointer" onmouseover="this.style.background=\'#F4F0EA\'" onmouseout="this.style.background=\'transparent\'">'+avatar(u,'w-6 h-6','text-[9px]')+'<span class="crm-mname" style="font-size:12.5px;font-weight:600;color:#13171B">'+esc(fullName(u))+'</span></button>').join('')+'</div></div>':(asgU?'<span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;color:#786A5F">'+avatar(asgU,'w-5 h-5','text-[8px]')+esc(_crmFirst(asgU))+'</span>':(asgG2?_crmGroupChip(asgG2):''));
  var top=(convo.messages||[]).filter(x=>!x.parentId);
  var thread=top.length?_crmMsgsWithDates(top,convo.id,false):'<div style="flex:1;display:grid;place-items:center;color:#A8998A;font-size:12.5px">No messages yet — say hello \u{1F44B}</div>';
  var canSend=can('crm','create');
  // thread panel
  var tpanel='';
  if(CRM.sel.threadId){var pm=(convo.messages||[]).find(x=>x.id===CRM.sel.threadId);var reps=(convo.messages||[]).filter(x=>x.parentId===CRM.sel.threadId);
    tpanel='<div class="crm-thread-panel" style="width:320px;flex-shrink:0;border-left:1px solid #EDE7DC;display:flex;flex-direction:column;min-height:0;background:#fff"><div style="padding:9px 12px;border-bottom:1px solid #EDE7DC;display:flex;align-items:center;justify-content:space-between"><span style="font-weight:800;font-size:13.5px">Thread</span><button onclick="App._crmCloseThread()" style="border:none;background:transparent;cursor:pointer;color:#A59788">'+ic('x','w-4 h-4')+'</button></div><div id="crm-tthread" class="crm-scroll" style="flex:1;overflow-y:auto;padding:10px;display:flex;flex-direction:column;min-height:0">'+(pm?_crmMsg(pm,convo.id,true):'<div style="color:#A59788;font-size:12px">Original message was deleted.</div>')+'<div style="height:1px;background:#F1ECE4;margin:2px 0"></div><div style="font-size:11px;color:#A59788;font-weight:700">'+reps.length+' repl'+(reps.length===1?'y':'ies')+'</div>'+reps.map(function(r,i){return _crmMsg(r,convo.id,true,reps[i-1]);}).join('')+'</div>'+(canSend?'<div style="border-top:1px solid #EDE7DC;padding:8px;display:flex;gap:7px;align-items:flex-end"><div class="crm-pill crm-pill-sm"><button type="button" class="crm-emobtn" title="Emoji" onclick="App._crmEmoOpen(event,\'tinput\')">'+_CRM_SMILEY+'</button><textarea id="crm-tinput" rows="1" placeholder="Reply" oninput="App._crmGrow(this)" onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();App._crmSendReply();}"></textarea></div><button class="crm-sendbtn crm-sendbtn-sm" onclick="App._crmSendReply()" aria-label="Send reply">'+ic('send','w-4 h-4')+'</button></div>':'')+'</div>';
  }
  // forward overlay
  var _fl=CRM.convos.filter(c=>_crmVisibleBoardIds()[c.boardId]&&c.id!==CRM.sel.convoId);var fwd='';
  if(CRM.fwdMsgId){fwd='<div style="position:absolute;inset:0;z-index:80;background:rgba(0,0,0,.15);display:grid;place-items:center" onclick="App._crmForwardClose()"><div onclick="event.stopPropagation()" style="background:#fff;border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.25);width:340px;max-height:74%;display:flex;flex-direction:column;overflow:hidden"><div style="padding:12px 14px;border-bottom:1px solid #EDE7DC;font-weight:800;display:flex;align-items:center;justify-content:space-between">Forward to…<button onclick="App._crmForwardClose()" style="border:none;background:transparent;cursor:pointer;color:#A59788">'+ic('x','w-4 h-4')+'</button></div><div class="crm-scroll" style="overflow-y:auto;padding:6px">'+(_fl.length?_fl.slice(0,80).map(c=>'<button onclick="App._crmDoForward(\''+c.id+'\')" style="width:100%;text-align:left;display:flex;align-items:center;gap:8px;padding:8px;border:none;background:transparent;border-radius:8px;cursor:pointer" onmouseover="this.style.background=\'#F4F0EA\'" onmouseout="this.style.background=\'transparent\'">'+_crmCustAv(c.customer,24)+'<div style="min-width:0"><div style="font-size:12.5px;font-weight:700;color:#13171B;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(c.customer||c.title||'—')+'</div><div style="font-size:11px;color:#A59788;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc((_crmBoard(c.boardId)?_crmBoard(c.boardId).name:'')+' · '+(c.title||''))+'</div></div></button>').join(''):'<div style="padding:18px;text-align:center;color:#A59788;font-size:12.5px">No other conversations to forward to.</div>')+'</div></div></div>';}
  return'<div class="crm-chatpane" style="flex:1;display:flex;flex-direction:column;min-width:0;min-height:0;position:relative">'+fwd
    +'<div class="crm-chathdr" style="padding:9px 14px;border-bottom:1px solid #EDE7DC;display:flex;align-items:center;gap:10px;flex-wrap:wrap;flex-shrink:0">'+'<button class="crm-only-mob crm-tap" aria-label="Back" onclick="App._crmMobBack()" style="width:34px;height:34px;border:1px solid #E6DED3;background:#fff;border-radius:9px;cursor:pointer;align-items:center;justify-content:center;color:#3A312A;flex-shrink:0;margin-right:2px">'+ic('back','w-5 h-5')+'</button>'+_crmCustAv(convo.customer,34)
    +'<div style="flex:1;min-width:0"><div class="fd" style="font-size:15px;font-weight:800;color:#13171B;letter-spacing:-.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(convo.title||'—')+'</div><div id="crm-chatsub" class="crm-chatsub" style="font-size:12px;color:#A59788;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(convo.customer||'')+(convo.channel?' · '+esc(convo.channel):'')+(convo.createdAt?' · started '+_crmRel(convo.createdAt)+' ago':'')+'</div></div>'+meta+_crmHdrBtns(convo,board)+'</div>'
    +'<div class="crm-chatbody" style="flex:1;display:flex;min-height:0">'
      +'<div class="crm-threadcol" style="flex:1;display:flex;flex-direction:column;min-width:0;min-height:0;position:relative" ondragover="App._crmDragOver(event)" ondragleave="App._crmDragLeave(event)" ondrop="App._crmDrop(event)">'
        +'<div id="crm-drop" style="display:none;position:absolute;inset:10px;z-index:40;background:rgba(84,67,60,.08);border:2px dashed #54433C;border-radius:12px;place-items:center;pointer-events:none"><div style="text-align:center;color:#3E322B;font-weight:700">'+ic('upload','w-7 h-7')+'<div style="margin-top:6px">Drop images to attach</div></div></div>'
        +'<div id="crm-thread" class="crm-scroll crm-wall" onscroll="App._crmThScroll(this)" style="flex:1;overflow-y:auto;padding:12px 14px;display:flex;flex-direction:column;min-height:0">'+thread+'</div>'
        +'<button id="crm-jump" onclick="App._crmJump()" aria-label="Jump to latest">'+ic('chevD','w-4 h-4')+'</button>'
        +'<div class="crm-composer" style="border-top:1px solid #EDE7DC;padding:8px 12px;position:relative;flex-shrink:0"><div id="crm-preview" style="display:none;gap:6px;flex-wrap:wrap;margin-bottom:8px"></div><div id="crm-mention" style="display:none;position:absolute;bottom:calc(100% + 6px);left:14px;z-index:60;background:#fff;border:1px solid #E6DED3;border-radius:12px;box-shadow:0 12px 32px rgba(35,28,22,.18);padding:6px;width:240px;max-height:230px;overflow:auto"></div>'
        +(canSend?'<div class="crm-sendrow" style="display:flex;align-items:flex-end;gap:7px"><div class="crm-pill"><button type="button" class="crm-emobtn" title="Emoji" onclick="App._crmEmoOpen(event,\'input\')">'+_CRM_SMILEY+'</button><textarea id="crm-input" rows="1" placeholder="'+(_crmIsMob()?'Message':'Message… @ to tag · Enter to send')+'" oninput="App._crmOnInput(this)" onpaste="App._crmPaste(event)" onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();App._crmSend();}"></textarea><label class="crm-attbtn" title="Attach image">'+ic('cam','w-[18px] h-[18px]')+'<input type="file" accept="image/*" multiple onchange="App._crmPickImg(this)" style="display:none"/></label></div><button class="crm-sendbtn" onclick="App._crmSend()" aria-label="Send">'+ic('send','w-[18px] h-[18px]')+'</button></div>':'<div style="text-align:center;color:#A8998A;font-size:12px;padding:8px">Read-only access.</div>')
        +'</div></div>'+tpanel+_crmDetailsPanel(convo,board)+'</div></div>';
}
function _crmMine(c){return c.assignedTo===S.uid||c.createdBy===S.uid||(!!c.assignedGroup&&_crmGroupHasMe(c.assignedGroup));}
function _crmFilteredConvos(){var lf=CRM.listFilter||'all';return CRM.convos.filter(function(c){return c.boardId===CRM.sel.boardId;}).filter(function(c){return lf==='unread'?_crmUnread(c):lf==='mine'?_crmMine(c):true;}).sort(function(a,b){return String(b.lastAt||'').localeCompare(String(a.lastAt||''));});}
App._crmListFilter=(v)=>{CRM.listFilter=v;rr();};
function _crmSearchResults(qArg){var q=String(qArg!=null?qArg:(CRM.search||'')).trim().toLowerCase();if(!q)return[];var vis=_crmVisibleBoardIds();return CRM.convos.filter(c=>vis[c.boardId]).filter(c=>((c.title||'')+' '+(c.customer||'')+' '+(c.ticketType||'')+' '+(c.messages||[]).map(m=>m.text||'').join(' ')).toLowerCase().indexOf(q)>=0).sort((a,b)=>String(b.lastAt||'').localeCompare(String(a.lastAt||''))).slice(0,60);}
function _crmConvoListInner(){
  if((CRM.search||'').trim()){var rs=_crmSearchResults();if(!rs.length)return'<div style="padding:26px 14px;text-align:center;color:#A59788;font-size:12.5px">No matches for “'+esc(CRM.search)+'”.</div>';return'<div style="padding:8px 12px;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#A59788;background:#FAF7F3;border-bottom:1px solid #F1ECE4">'+rs.length+' result'+(rs.length>1?'s':'')+' across all boards</div>'+rs.map(c=>_crmConvoRow(c,CRM.sel.convoId,true)).join('');}
  var cs=_crmFilteredConvos();if(!cs.length){var _lf2=CRM.listFilter||'all';return'<div style="padding:28px 14px;text-align:center;color:#A59788;font-size:12.5px">'+(_lf2==='unread'?'Nothing unread — all caught up \u{1F389}':_lf2==='mine'?'Nothing you created or that\u2019s assigned to you here.':'No '+esc((CRM.sel.category||'chats').toLowerCase())+' here yet.')+'</div>';}return cs.map(c=>_crmConvoRow(c,CRM.sel.convoId,false)).join('');
}
function crmPage(){
  _crmInit();
  if(!CRM._loaded){if(!CRM._loading)_crmLoad();return _crmStyle+'<div class="crm-fs" style="position:fixed;top:0;left:0;right:0;bottom:0;background:#fff;display:grid;place-items:center;z-index:5;color:#A59788"><div style="text-align:center">'+ic('msg','w-8 h-8')+'<div style="margin-top:10px;font-size:13px">Loading Workspace…</div></div></div>';}
  if(CRM._err)return _crmStyle+'<div class="crm-fs" style="position:fixed;top:0;left:0;right:0;bottom:0;background:#fff;display:flex;z-index:5">'+_crmEmpty('alert','Couldn’t load Workspace',CRM._err,'<button onclick="App._crmRetry()" style="margin-top:14px;padding:9px 18px;border:none;border-radius:10px;background:#13171B;color:#fff;font-weight:700;cursor:pointer">Retry</button>')+'</div>';
  var collapsed=CRM.sidebarCollapsed;var canCreate=can('crm','create');
  // ===== SIDEBAR (v3.12): Hubs → their FILTERED VIEWS. Boards open as tabs on the hub itself. =====
  var visHubs=CRM.hubs.filter(_crmHubVisible);
  var navHTML=visHubs.length?visHubs.map(function(h){
    var hcol=CRM.collapsedHubs[h.id];
    var views=_crmVisibleViews(h.id);
    var hOn=CRM.sel.hubId===h.id&&!CRM.sel.viewId;
    var bCount=CRM.boards.filter(function(b){return b.hubId===h.id&&_crmBoardVisible(b);}).length;
    return'<div class="crm-hub" style="margin-bottom:2px">'
      +'<div onclick="App._crmSelHub(\''+h.id+'\')" title="Open '+esc(h.name)+' — everything in it" style="display:flex;align-items:center;gap:5px;padding:6px 7px;color:'+(hOn?'#fff':'#3A312A')+';background:'+(hOn?'#13171B':'transparent')+';cursor:pointer;border-radius:7px">'
      +(collapsed?'':'<span onclick="event.stopPropagation();App._crmTogHub(\''+h.id+'\')" title="'+(hcol?'Show':'Hide')+' its filtered views" style="color:'+(hOn?'rgba(255,255,255,.6)':'#A8998A')+';display:grid;place-items:center;cursor:pointer">'+ic(hcol?'chevR':'chevD','w-3 h-3')+'</span>')
      +'<span style="color:'+(hOn?'rgba(255,255,255,.7)':'#A59788')+'">'+ic(h.icon||'folder','w-3.5 h-3.5')+'</span>'
      +(collapsed?'':'<span style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(h.name)+'</span>'
        +'<span style="font-size:9.5px;color:'+(hOn?'rgba(255,255,255,.55)':'#A8998A')+'" title="'+bCount+' board'+(bCount===1?'':'s')+'">'+bCount+'</span>'
        +(_crmCanHubMembers()?'<button title="Channel people — who can see every board in here" aria-label="Channel people" onclick="event.stopPropagation();App._crmHubPeople(\''+h.id+'\')" style="border:none;background:transparent;color:'+(hOn?'rgba(255,255,255,.85)':'#786A5F')+';cursor:pointer;padding:0;display:grid;place-items:center;min-width:26px;min-height:26px">'+ic('users','w-3.5 h-3.5')+'</button>':'')
        +((canCreate||can('crm','views'))?'<button title="New board / filtered view" onclick="event.stopPropagation();App._crmHubAdd(\''+h.id+'\')" style="border:none;background:transparent;color:'+(hOn?'rgba(255,255,255,.8)':'#A59788')+';cursor:pointer;padding:0">'+ic('plus','w-3 h-3')+'</button>':'')
        +(can('crm','rename')?'<button title="Rename" onclick="event.stopPropagation();App._crmRenameHub(\''+h.id+'\')" class="crm-hdel" style="border:none;background:transparent;color:'+(hOn?'#fff':'#786A5F')+';cursor:pointer;padding:0;display:none;place-items:center">'+ic('edit','w-3 h-3')+'</button>':'')
        +(can('crm','delete')?'<button title="Delete" onclick="event.stopPropagation();App._crmDelHub(\''+h.id+'\')" class="crm-hdel" style="border:none;background:transparent;color:#B3402E;cursor:pointer;padding:0;display:none;place-items:center">'+ic('trash','w-3 h-3')+'</button>':''))
      +'</div>'
      +(collapsed||hcol?'':views.map(function(v){var on=CRM.sel.viewId===v.id;var _tb=CRM.boards.filter(function(b){return b.hubId===v.hubId&&_crmBS(b).type!=='chat'&&!_crmViewHides(v,b.id);});var n=_tb.reduce(function(s2,b){return s2+_crmApplyFilters(CRM.convos.filter(function(c){return c.boardId===b.id;}),_crmViewFilters(v,b.id)).length;},0);
        return'<div class="crm-chrow" style="position:relative;margin-left:6px"><button onclick="App._crmSelView(\''+v.id+'\')" title="Filtered view — the boards of '+esc(h.name)+' it includes, narrowed by its saved filters" style="width:100%;text-align:left;display:flex;align-items:center;gap:7px;padding:6px '+(_crmViewCanEdit(v)?46:6)+'px 6px 12px;border:none;border-radius:7px;cursor:pointer;background:'+(on?'#13171B':'transparent')+';color:'+(on?'#fff':'#3A312A')+';font-size:12px;font-weight:'+(on?'700':'600')+';margin-bottom:1px"><span style="color:'+(on?'rgba(255,255,255,.5)':'#54433C')+';display:grid;place-items:center">'+ic('filter','w-3.5 h-3.5')+'</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(v.name)+'</span><span style="font-size:9.5px;color:'+(on?'rgba(255,255,255,.55)':'#A8998A')+'">'+n+'</span></button>'
        +(_crmViewCanEdit(v)?'<button title="Edit view" onclick="App._crmEditView(\''+v.id+'\')" class="crm-chx" style="position:absolute;top:6px;right:26px;width:18px;height:18px;border:none;background:transparent;color:'+(on?'#fff':'#786A5F')+';cursor:pointer;border-radius:5px;display:none;place-items:center">'+ic('edit','w-3 h-3')+'</button><button title="Delete view" onclick="App._crmDelView(\''+v.id+'\')" class="crm-chx" style="position:absolute;top:6px;right:6px;width:18px;height:18px;border:none;background:transparent;color:'+(on?'#fff':'#B3402E')+';cursor:pointer;border-radius:5px;display:none;place-items:center">'+ic('trash','w-3 h-3')+'</button>':'')
        +'</div>';}).join(''))
      +'</div>';
  }).join(''):'';
  // ===== resolve selection: filtered-view mode, or hub + board tabs =====
  var view=CRM.sel.viewId?_crmView(CRM.sel.viewId):null;
  if(view&&!_crmViewVisible(view)){view=null;CRM.sel.viewId=null;}
  var hub=view?(_crmHub(view.hubId)||_crmHub(CRM.sel.hubId)):_crmHub(CRM.sel.hubId);
  if(!hub){hub=visHubs[0]||null;CRM.sel.hubId=hub?hub.id:null;}
  var hbBoards=hub?CRM.boards.filter(function(b){return b.hubId===hub.id&&_crmBoardVisible(b);}):[];
  // v3.12.1: inside a filtered view the tabs are ALL the hub's boards (access flows through the view)
  var inView=!!view;
  var tabBoards=inView?(hub?CRM.boards.filter(function(b){return b.hubId===hub.id&&!_crmViewHides(view,b.id);}):[]):hbBoards;
  var board=_crmBoard(CRM.sel.boardId);
  if(!board||!hub||board.hubId!==hub.id||(!inView&&!_crmBoardVisible(board))){board=tabBoards[0]||null;CRM.sel.boardId=board?board.id:null;}
  var members=(board&&board.members||[]).map(function(id){return uById(id);}).filter(Boolean);
  var nonMembers=(DB.users||[]).filter(function(u){return u&&u.status!=='Disabled'&&!(board&&board.members||[]).includes(u.id);});
  var _dash='<button onclick="App.go(\'dashboard\')" title="Back to Dashboard" class="crm-dash" style="margin-left:6px;display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border:1px solid #E6DED3;background:#fff;border-radius:10px;font-size:12.5px;font-weight:600;color:#3A312A;cursor:pointer;white-space:nowrap;flex-shrink:0">'+ic('grid','w-4 h-4')+'<span class="crm-hide-mob">Dashboard</span></button>';
  var _search='<div class="crm-search" style="position:relative;display:flex;align-items:center"><span style="position:absolute;left:10px;color:#A59788;pointer-events:none">'+ic('search','w-4 h-4')+'</span><input id="crm-search" autocomplete="off" oninput="App._crmSearch(this.value)" onfocus="App._crmSearch(this.value)" onblur="setTimeout(function(){var d=document.getElementById(\'crm-search-dd\');if(d)d.style.display=\'none\';},180)" placeholder="Search everywhere…" style="width:230px;max-width:44vw;padding:8px 10px 8px 32px;border:1px solid #E6DED3;border-radius:10px;font-size:12.5px;outline:none"/><div id="crm-search-dd" class="crm-scroll" style="display:none;position:absolute;top:40px;right:0;z-index:80;width:330px;max-height:380px;overflow-y:auto;background:#fff;border:1px solid #E6DED3;border-radius:14px;box-shadow:0 16px 44px rgba(35,28,22,.18);padding:6px"></div></div>';
  var mainInner;
  if(!CRM.hubs.length){mainInner=_crmEmpty('msg','Welcome to your Workspace','Create your first Hub — it holds your boards (chats & ticket tables) and filtered views.',canCreate?'<button onclick="App._crmNewHub()" style="margin-top:16px;padding:10px 20px;border:none;border-radius:11px;background:#54433C;color:#fff;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:7px">'+ic('plus','w-4 h-4')+'Create your first hub</button>':'<div style="margin-top:12px;font-size:12px;color:#A8998A">Ask an admin for Workspace access.</div>');}
  else if(!hub){mainInner=_crmEmpty('folder','Nothing to show','You haven’t been added to any board or filtered view yet — ask an admin for access.','');}
  else{
    var row1='<div class="crm-boardbar" style="padding:10px 16px;border-bottom:1px solid #EDE7DC;display:flex;align-items:center;gap:10px;flex-wrap:wrap;flex-shrink:0"><button class="crm-only-mob crm-tap" aria-label="Open hubs" onclick="App._crmMobNav()" style="width:34px;height:34px;border:1px solid #E6DED3;background:#fff;border-radius:9px;cursor:pointer;align-items:center;justify-content:center;color:#3A312A;flex-shrink:0">'+ic('menu','w-5 h-5')+'</button><div class="crm-hubname" style="font-size:16px;font-weight:800;color:#13171B;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(hub.name)+(view?' <span style="font-weight:800;color:#54433C;font-size:13px">· '+esc(view.name)+'</span>':'')+'</div>'+_crmHubPeopleBtn(hub)+'<div style="flex:1"></div>'+_search+_dash+'</div>';
    var tabs=tabBoards.map(function(b){var on=b.id===CRM.sel.boardId;var _un=_crmUnreadCount(b.id);var _isC=_crmBS(b).type==='chat';var _brows=CRM.convos.filter(function(x){return x.boardId===b.id;});if(inView&&!_isC)_brows=_crmApplyFilters(_brows,_crmViewFilters(view,b.id));return'<button onclick="'+(inView?'App._crmSelVBoard':'App._crmSelBoard')+'(\''+b.id+'\')" class="crm-btab" style="display:inline-flex;align-items:center;gap:6px;padding:9px 14px;border:none;background:transparent;border-bottom:2px solid '+(on?'#54433C':'transparent')+';color:'+(on?'#13171B':'#A59788')+';font-size:13px;font-weight:'+(on?'800':'600')+';cursor:pointer;white-space:nowrap">'+ic(_isC?'msg':'ticket','w-3.5 h-3.5')+esc(b.name)+' '+(_isC?'<span style="font-size:11px;color:'+(on?'#54433C':'#CEC1B3')+'">'+_brows.length+'</span>':_crmNotDoneBadge(b,_brows,on))+(_un?'<span style="min-width:17px;height:17px;padding:0 5px;border-radius:9px;background:#54433C;color:#fff;font-size:9.5px;font-weight:800;display:inline-grid;place-items:center">'+_un+'</span>':'')+'</button>';}).join('');
    var boardCtl=board?(inView?(_crmViewCanEdit(view)?'<button title="Remove this board from the view — the board itself is not deleted" onclick="App._crmViewHideBoard(\''+board.id+'\')" style="display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 10px;border-radius:8px;border:1px solid #E6DED3;background:#fff;color:#786A5F;cursor:pointer;font-size:12px;font-weight:700">'+ic('x','w-3.5 h-3.5')+'Remove from view</button>':''):((_crmCanBoardMembers()?'<button title="Board members — who can access only this board" aria-label="Board members" onclick="App._crmTogMembers()" style="display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 10px;border-radius:8px;border:1px solid #E6DED3;background:#fff;color:#786A5F;cursor:pointer;font-size:12px;font-weight:700">'+ic('users','w-3.5 h-3.5')+'<span class="crm-hide-mob">Board</span>'+members.length+'</button>':'')+(can('crm','rename')?'<button title="Rename board" onclick="App._crmRenameBoard(\''+board.id+'\')" style="width:30px;height:30px;border-radius:8px;border:1px solid #E6DED3;background:#fff;color:#786A5F;cursor:pointer;display:grid;place-items:center">'+ic('edit','w-4 h-4')+'</button>':'')+(can('crm','delete')?'<button title="Delete board" onclick="App._crmDelBoard(\''+board.id+'\')" style="width:30px;height:30px;border-radius:8px;border:1px solid #E4A898;background:#fff;color:#B3402E;cursor:pointer;display:grid;place-items:center">'+ic('trash','w-4 h-4')+'</button>':''))):'';  /* v3.15: inside a view only view actions show — board admin lives on the hub */
    var row2='<div class="crm-tabsrow" style="display:flex;align-items:center;gap:2px;padding:0 10px;border-bottom:1px solid #EDE7DC;overflow-x:auto;flex-shrink:0">'+tabs+(canCreate&&!inView?'<button onclick="App._crmNewBoard(\''+hub.id+'\')" title="New board" style="padding:8px 11px;border:none;background:transparent;color:#54433C;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:4px;white-space:nowrap">'+ic('plus','w-3.5 h-3.5')+'Board</button>':'')+'<div style="flex:1;min-width:8px"></div><div style="display:flex;align-items:center;gap:6px;padding:6px 2px">'+boardCtl+'</div></div>';
    if(!board){mainInner=row1+row2+_crmEmpty('msg','No boards yet in this hub','Add a board — a chat, or a ticket table with its own columns, statuses, members & automations.',canCreate?'<button onclick="App._crmNewBoard(\''+hub.id+'\')" style="margin-top:14px;padding:9px 18px;border:none;border-radius:10px;background:#54433C;color:#fff;font-weight:700;cursor:pointer">Create a board</button>':'');}
    else{
      var isChat=_crmBS(board).type==='chat';var searching=!!(CRM.search||'').trim();if(isChat){var convo=_crmConvo(CRM.sel.convoId);var filtered=_crmFilteredConvos();
      if(!searching){var _valid=convo&&convo.boardId===CRM.sel.boardId&&filtered.some(function(c){return c.id===convo.id;});if(!_valid){var _mob=(typeof window!=='undefined'&&window.matchMedia)?window.matchMedia('(max-width:767px)').matches:false;if(_mob){convo=null;}else{convo=filtered[0]||null;}CRM.sel.threadId=null;}CRM.sel.convoId=convo?convo.id:null;}
      var _lf=CRM.listFilter||'all';var _bc=CRM.convos.filter(function(c){return c.boardId===CRM.sel.boardId;});
      var _lfCnt={all:_bc.length,unread:_bc.filter(_crmUnread).length,mine:_bc.filter(_crmMine).length};
      var lfRow='<div style="display:flex;gap:4px;padding:8px 10px;border-bottom:1px solid var(--c-border);background:#FCFAF7;flex-shrink:0">'+[['all','All'],['unread','Unread'],['mine','Mine']].map(function(x){var on=_lf===x[0];return '<button onclick="App._crmListFilter(\''+x[0]+'\')" style="flex:1;padding:5px 8px;border-radius:8px;border:none;background:'+(on?'#13171B':'transparent')+';color:'+(on?'#fff':'var(--c-text-2)')+';font-size:11px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:4px">'+x[1]+(_lfCnt[x[0]]?'<span style="font-size:9.5px;font-weight:800;border-radius:8px;min-width:15px;padding:1px 4px;background:'+(on?'rgba(255,255,255,.22)':'var(--c-border)')+';color:'+(on?'#fff':'var(--c-text-2)')+'">'+_lfCnt[x[0]]+'</span>':'')+'</button>';}).join('')+'</div>';
      var listCol='<div class="crm-listcol" style="width:22%;min-width:238px;max-width:340px;border-right:1px solid #EDE7DC;display:flex;flex-direction:column;min-height:0">'+lfRow+'<div class="crm-scroll" style="flex:1;overflow-y:auto" id="crm-list">'+_crmConvoListInner()+'</div>'+((canCreate&&!_crmIsMob())?'<div style="border-top:1px solid #EDE7DC;padding:11px;background:#FAF7F3;flex-shrink:0"><div style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#A59788;margin-bottom:7px">New conversation</div><input id="crm-nc-name" placeholder="Customer / Order ID" style="width:100%;box-sizing:border-box;padding:8px 9px;border:1px solid #E6DED3;border-radius:8px;font-size:12.5px;margin-bottom:6px;outline:none"/><input id="crm-nc-title" placeholder="Subject" style="width:100%;box-sizing:border-box;padding:8px 9px;border:1px solid #E6DED3;border-radius:8px;font-size:12.5px;margin-bottom:6px;outline:none"/><button onclick="App._crmNewConvo()" style="width:100%;padding:9px;border:none;border-radius:9px;background:#54433C;color:#fff;font-size:12.5px;font-weight:700;cursor:pointer">Start chat</button></div>':'')+((canCreate&&_crmIsMob())?'<button class="crm-fab" onclick="App._crmNewChatModal()" aria-label="New chat">'+ic('plus','w-4 h-4')+'New chat</button>':'')+'</div>';
      mainInner=row1+row2+'<div style="flex:1;display:flex;min-height:0">'+listCol+_crmChatPane((searching?_crmConvo(CRM.sel.convoId):convo),board)+'</div>';}else{var openC=_crmConvo(CRM.sel.convoId);if(openC&&openC.boardId===board.id){mainInner=row1+'<div style="flex:1;display:flex;flex-direction:column;min-height:0"><div style="padding:7px 14px;border-bottom:1px solid #EDE7DC;display:flex;align-items:center;gap:8px;flex-shrink:0"><button onclick="App._crmBackToTable()" style="display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border:1px solid #E6DED3;background:#fff;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;color:#3A312A">'+ic('back','w-4 h-4')+'Back to '+esc(inView?view.name:board.name)+'</button></div>'+_crmChatPane(openC,board)+'</div>';}else{CRM.sel.convoId=null;mainInner=row1+row2+(inView?_crmViewBarV(board,view):_crmViewBar(board))+_crmTable(board,inView?{filters:_crmViewFilters(view,board.id)}:{});}}
    }
  }
  var hubsLabel=(CRM.settings&&CRM.settings.hubsLabel)||'Hubs';
  var grpFoot='';
  {var _gs=_crmGroups();var _canMg=can('crm','groups');
   // v3.11.2: the per-group list was removed from the sidebar (every row just opened the same
   // manage dialog anyway) — one compact "Groups (n)" entry opens it; @tags & automations unchanged.
   grpFoot='<div style="flex-shrink:0;border-top:1px solid #E8E0D5;padding:8px 6px'+(collapsed?';display:grid;place-items:center':'')+'">'
    +(collapsed
      ?'<button title="People groups" onclick="App._crmGroupsOpen()" style="width:34px;height:34px;border-radius:9px;border:none;background:transparent;color:#786A5F;cursor:pointer;display:grid;place-items:center">'+ic('users','w-4 h-4')+'</button>'
      :'<div style="display:flex;align-items:center;gap:5px;padding:2px 7px"><span style="color:#A59788">'+ic('users','w-3.5 h-3.5')+'</span><button onclick="App._crmGroupsOpen()" title="Open people groups — @tag them in any board, notify them in automations" style="border:none;background:transparent;padding:0;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#786A5F;flex:1;text-align:left;cursor:pointer">Groups'+(_gs.length?' <span style="font-weight:800;color:#A8998A;text-transform:none;letter-spacing:0">('+_gs.length+')</span>':'')+'</button>'+(_canMg?'<button title="New group" onclick="App._crmGroupNewFromNav()" style="border:none;background:transparent;color:#A59788;cursor:pointer;padding:0">'+ic('plus','w-3 h-3')+'</button>':'')+'</div>')
    +'</div>';}
  try{_crmSaveSel();}catch(e){}
  return _crmStyle+'<div class="crm-fs'+(CRM.sel.convoId?' crm-hasconvo':'')+'" style="position:fixed;top:0;left:0;right:0;bottom:0;background:#fff;display:flex;z-index:5">'
    +'<div class="crm-scrim" onclick="App._crmMobNav(false)"></div>'
    +'<div class="crm-nav" style="width:'+(collapsed?'56px':'220px')+';flex-shrink:0;border-right:1px solid #EDE7DC;background:#FAF7F1;display:flex;flex-direction:column;transition:width .15s"><div style="display:flex;align-items:center;gap:6px;padding:13px 10px;border-bottom:1px solid #EDE7DC;flex-shrink:0"><button onclick="App._crmTogSidebar()" title="Collapse" style="width:30px;height:30px;border-radius:8px;border:none;background:transparent;color:#786A5F;cursor:pointer;display:grid;place-items:center">'+ic('menu','w-4 h-4')+'</button>'+(collapsed?'':'<span class="fd" '+(can('crm','rename')?'onclick="App._crmRenameHubsLabel()" title="Click to rename this label" style="cursor:pointer;font-weight:800;font-size:14px;color:#13171B;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"':'style="font-weight:800;font-size:14px;color:#13171B;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"')+'>'+esc(hubsLabel)+'</span>'+(canCreate?'<button title="New hub" onclick="App._crmNewHub()" style="width:26px;height:26px;border-radius:7px;border:none;background:#13171B;color:#fff;cursor:pointer;display:grid;place-items:center;flex-shrink:0">'+ic('plus','w-3.5 h-3.5')+'</button>':''))+'</div><div class="crm-scroll" style="flex:1;overflow-y:auto;padding:8px 6px">'+(navHTML||(collapsed?'':'<div style="padding:16px 8px;font-size:12px;color:#A59788;text-align:center">No hubs yet</div>'))+'</div>'+grpFoot+'</div>'
    +'<div style="flex:1;display:flex;flex-direction:column;min-width:0;min-height:0">'+mainInner+'</div>'+_crmModals()+'</div>';
}
// ---- interactions ----
App._crmRetry=()=>{CRM._loaded=false;CRM._err=null;_crmLoad();};
App._crmTogSidebar=()=>{CRM.sidebarCollapsed=!CRM.sidebarCollapsed;rr();};
App._crmTogHub=(id)=>{CRM.collapsedHubs[id]=!CRM.collapsedHubs[id];rr();};
App._crmSelBoard=(id)=>{var b=_crmBoard(id);CRM.sel.boardId=id;CRM.sel.hubId=b?b.hubId:CRM.sel.hubId;CRM.sel.viewId=null;CRM.sel.convoId=null;CRM.sel.threadId=null;CRM.sel.category='Chats';CRM.search='';CRM.compose.images=[];rr();};
/* Same as _crmSelBoard but KEEPS the active filtered view (tab clicks inside a view) */
App._crmSelVBoard=(id)=>{CRM.sel.boardId=id;CRM.sel.convoId=null;CRM.sel.threadId=null;CRM.sel.category='Chats';CRM.search='';CRM.compose.images=[];rr();};
App._crmSelCat=(c)=>{CRM.sel.category=c;CRM.sel.convoId=null;CRM.sel.threadId=null;CRM.search='';rr();};
App._crmSelConvo=(id)=>{CRM.sel.convoId=id;CRM.sel.threadId=null;CRM.compose.images=[];_crmMarkRead(id);rr();var t=document.getElementById('crm-thread');if(t)t.scrollTop=t.scrollHeight;};
App._crmOpenResult=(id)=>{var c=_crmConvo(id);if(!c)return;CRM.sel.boardId=c.boardId;var b=_crmBoard(c.boardId);CRM.sel.hubId=b?b.hubId:null;CRM.sel.viewId=null;CRM.sel.category=c.isTicket?(c.ticketType||'Chats'):'Chats';CRM.sel.convoId=id;CRM.sel.threadId=null;CRM.search='';CRM.compose.images=[];_crmMarkRead(id);rr();var t=document.getElementById('crm-thread');if(t)t.scrollTop=t.scrollHeight;};
App._crmSearch=(v)=>{
  var dd=document.getElementById('crm-search-dd');if(!dd)return;
  var q=String(v||'').trim();
  if(!q){dd.style.display='none';dd.innerHTML='';return;}
  var rs=_crmSearchResults(q).slice(0,14);
  dd.innerHTML=rs.length?rs.map(function(c){var b=_crmBoard(c.boardId);var un=_crmUnread(c);
    return'<div onmousedown="App._crmSearchGo(\''+c.id+'\')" style="display:flex;align-items:center;gap:9px;padding:8px 9px;border-radius:10px;cursor:pointer" onmouseover="this.style.background=\'#FAF7F1\'" onmouseout="this.style.background=\'transparent\'">'+_crmCustAv(c.customer||c.title,28)
      +'<div style="flex:1;min-width:0"><div style="font-size:12.5px;font-weight:700;color:#13171B;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(c.title||c.customer||'—')+(un?' <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#54433C"></span>':'')+'</div><div style="font-size:10.5px;color:#796B60;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(_crmBoardLabel(b))+(c.isTicket?' · ticket':'')+'</div></div>'
      +'<span style="font-size:10px;color:#A8998A;flex-shrink:0">'+_crmRel(c.lastAt)+'</span></div>';}).join('')
    :'<div style="padding:16px;text-align:center;color:#A59788;font-size:12px">No matches for “'+esc(q)+'”.</div>';
  dd.style.display='block';
};
App._crmSearchGo=(id)=>{var i=document.getElementById('crm-search');if(i)i.value='';var d=document.getElementById('crm-search-dd');if(d){d.style.display='none';d.innerHTML='';}CRM.search='';App._crmOpenResult(id);};
App._crmTogConvert=()=>{var d=document.getElementById('crm-convert');if(d)d.style.display=d.style.display==='none'?'block':'none';};
App._crmTogAssign=()=>{var d=document.getElementById('crm-assign');if(d)d.style.display=d.style.display==='none'?'block':'none';};
App._crmTogMembers=()=>{
  CRM.boardMembersOpen=!CRM.boardMembersOpen;
  /* v3.21 — staged like the channel dialog: edit freely, nothing is written until Save. */
  if(CRM.boardMembersOpen){var _b=_crmBoard(CRM.sel.boardId);CRM._boardDraft=((_b&&_b.members)||[]).slice();}
  else CRM._boardDraft=null;
  rr();
};
App._crmBoardMembersCancel=()=>{CRM._boardDraft=null;CRM.boardMembersOpen=false;rr();};
App._crmBoardMembersSave=async()=>{
  if(!_crmCanBoardMembers())return toast('No permission','err');
  var b=_crmBoard(CRM.sel.boardId);if(!b){CRM.boardMembersOpen=false;rr();return;}
  var before=(b.members||[]).slice(),after=(CRM._boardDraft||[]).slice();
  var added=after.filter(function(x){return before.indexOf(x)<0;});
  var removed=before.filter(function(x){return after.indexOf(x)<0;});
  b.members=after;CRM._boardDraft=null;CRM.boardMembersOpen=false;
  if(added.length||removed.length){
    var bits=[];if(added.length)bits.push(added.length+' added');if(removed.length)bits.push(removed.length+' removed');
    toast('Board members updated — '+bits.join(', ')+' \u2713');
  }
  rr();
  try{
    if(added.length)await sb.from('crm_board_members').insert(added.map(function(id){return{board_id:b.id,user_id:id};}));
    for(var i=0;i<removed.length;i++)await sb.from('crm_board_members').delete().eq('board_id',b.id).eq('user_id',removed[i]);
  }catch(e){console.warn('[CRM boardMembers save]',e&&e.message);toast('Saved locally, sync failed','warn');}
};
App._crmOnInput=(el)=>{App._crmGrow(el);_crmTypingSend();var v=el.value,pos=el.selectionStart||v.length;var m=v.slice(0,pos).match(/@(\w*)$/);var d=document.getElementById('crm-mention');if(!d)return;if(m){d.innerHTML=_crmMentionItems(m[1]);d.style.display='block';}else{d.style.display='none';}};
App._crmPickMention=(who)=>{var el=document.getElementById('crm-input');if(!el)return;var v=el.value,pos=el.selectionStart||v.length;var before=v.slice(0,pos).replace(/@(\w*)$/,''),after=v.slice(pos);var name;if(who==='ALL')name='All';else if(String(who).indexOf('grp:')===0)name=_crmGroupToken(_crmGroup(String(who).slice(4)))||'group';else name=(_crmFirst(uById(who))||'user').replace(/[^\w]/g,'')||'user';var ins='@'+name+' ';el.value=before+ins+after;el.focus();var np=(before+ins).length;try{el.setSelectionRange(np,np);}catch(e){}var d=document.getElementById('crm-mention');if(d)d.style.display='none';};
function _crmMentioned(text,board){
  var mem=_crmBoardPeople(board).map(function(u){return u.id;}); // board members only (v3.12)
  var ids={};var low=' '+(text||'').toLowerCase()+' ';
  if(/@all\b|@everyone\b/.test(low))mem.forEach(function(id){ids[id]=1;});
  mem.forEach(function(id){var u=uById(id);if(!u)return;var fn=_crmFirst(u).toLowerCase().replace(/[^\w]/g,'');if(fn&&new RegExp('@'+fn+'\\b').test(low))ids[id]=1;});
  var memSet={};mem.forEach(function(id){memSet[id]=1;});
  _crmGroups().forEach(function(g){var t=_crmGroupToken(g).toLowerCase();if(t&&new RegExp('@'+t+'\\b').test(low))(g.members||[]).forEach(function(id){if(memSet[id])ids[id]=1;});});
  delete ids[S.uid];return Object.keys(ids);}
App._crmSend=async()=>{
  App._crmCloseMsgActs();
  if(!can('crm','create'))return;var inp=document.getElementById('crm-input');var text=(inp?inp.value:'').trim();var imgs=(CRM.compose.images||[]).slice();
  if(!text&&!imgs.length)return;var c=_crmConvo(CRM.sel.convoId);if(!c)return;var board=_crmBoard(c.boardId);var id=uid('msg');var at=new Date().toISOString();
  var tops=(c.messages||[]).filter(function(x){return !x.parentId;});var pv=tops[tops.length-1]||null;
  var m={id:id,senderId:S.uid,fromCustomer:false,text:text,images:imgs,at:at,reactions:{},parentId:null};
  c.messages.push(m);c.lastAt=at;CRM.compose.images=[];
  CRM._pend=CRM._pend||{};CRM._pend[id]=1;
  var tagged=_crmMentioned(text,board);
  var t=document.getElementById('crm-thread');
  if(t&&CRM.sel.convoId===c.id){
    var html=(pv&&_crmDayKey(pv.at)===_crmDayKey(at)?'':_crmDatePill(at))+_crmMsg(m,c.id,false,pv);
    var emptyNote=t.querySelector('[style*="place-items:center"]');if(emptyNote&&!t.querySelector('.crm-line'))t.innerHTML='';
    t.insertAdjacentHTML('beforeend',html);t.scrollTop=t.scrollHeight;
    if(inp){inp.value='';inp.style.height='auto';inp.focus();}
    _crmRenderPreview();_crmTouchListRow(c);
  }else{rr();var t2=document.getElementById('crm-thread');if(t2)t2.scrollTop=t2.scrollHeight;var i2=document.getElementById('crm-input');if(i2)i2.focus();}
  try{if(navigator.vibrate)navigator.vibrate(8);}catch(e){}
  await sbWrite({table:'crm_messages',op:'insert',id:id,values:{id:id,conversation_id:c.id,sender_id:S.uid||null,from_customer:false,body:text,images:imgs,created_at:at}},{label:'Message'});
  delete CRM._pend[id];_crmTickFlip(id);
  sbWrite({table:'crm_conversations',op:'update',id:c.id,match:{col:'id',val:c.id},values:{last_at:at}},{label:'Conversation',silent:true});try{await _crmNotify(tagged,c,at);}catch(e){}
};
async function _crmNotify(tagged,c,at){if(!tagged||!tagged.length)return;var who=me()?fullName(me()):'Someone';var txt='\u{1F4AC} '+who+' tagged you in “'+(c.title||'a conversation')+'”';var _lnk='crm:'+c.id;for(var k=0;k<tagged.length;k++){if(_crmInappOn('crm_mention')){var nid=uid('n');try{DB.notifications.unshift({id:nid,userId:tagged[k],text:txt,time:at,read:false,link:_lnk});}catch(e){}try{await sb.from('notifications').insert({id:nid,user_id:tagged[k],text:txt,read:false,created_at:at,link:_lnk});}catch(e){}}if(typeof queueEmail==='function'){try{queueEmail('crm_mention',tagged[k],null,null,{title:(c.title||''),actor:who,preview:''});}catch(e){}}}try{_invalidateNotifCache();}catch(e){}}
function _crmAddFiles(files){files=[].slice.call(files||[]).filter(f=>f.type&&f.type.indexOf('image/')===0);files.forEach(function(f){var rd=new FileReader();rd.onload=function(e){CRM.compose.images.push(e.target.result);var pv=document.getElementById('crm-preview');if(pv){pv.style.display='flex';pv.insertAdjacentHTML('beforeend','<div><img src="'+e.target.result+'" style="width:56px;height:56px;object-fit:cover;border-radius:8px;border:1px solid #E6DED3"/></div>');}};rd.readAsDataURL(f);});}
App._crmPickImg=(input)=>{_crmAddFiles(input.files);input.value='';};
/* v3.18: the preview strip is built imperatively, so a live redraw would wipe pending
   attachments from view while they were still queued to send. Rebuild it from state. */
function _crmRenderPreview(){
  var pv=document.getElementById('crm-preview');if(!pv)return;
  var imgs=(CRM.compose&&CRM.compose.images)||[];
  if(!imgs.length){pv.style.display='none';pv.innerHTML='';return;}
  pv.style.display='flex';
  pv.innerHTML=imgs.map(function(src){return'<div><img src="'+src+'" style="width:56px;height:56px;object-fit:cover;border-radius:8px;border:1px solid #E6DED3"/></div>';}).join('');
}
App._crmDragOver=(e)=>{e.preventDefault();var z=document.getElementById('crm-drop');if(z)z.style.display='grid';};
App._crmDragLeave=(e)=>{if(e&&e.relatedTarget)return;var z=document.getElementById('crm-drop');if(z)z.style.display='none';};
App._crmDrop=(e)=>{e.preventDefault();var z=document.getElementById('crm-drop');if(z)z.style.display='none';if(!can('crm','create'))return;_crmAddFiles(e.dataTransfer&&e.dataTransfer.files);};
App._crmReact=async(cid,mid,emo)=>{if(!can('crm','create'))return;emo=decodeURIComponent(emo);var c=_crmConvo(cid);if(!c)return;var m=(c.messages||[]).find(x=>x.id===mid);if(!m)return;if(!m.reactions)m.reactions={};var arr=m.reactions[emo]||[];var i=arr.indexOf(S.uid);if(i>=0)arr.splice(i,1);else arr.push(S.uid);if(arr.length)m.reactions[emo]=arr;else delete m.reactions[emo];rr();try{await sb.from('crm_messages').update({reactions:m.reactions}).eq('id',mid);}catch(e){}};
App._crmEditMsg=(cid,mid)=>{CRM.editMsgId=mid;rr();var el=document.getElementById('crm-edit-'+mid);if(el){el.focus();try{el.setSelectionRange(el.value.length,el.value.length);}catch(e){}}};
App._crmCancelEdit=()=>{CRM.editMsgId=null;rr();};
App._crmSaveEdit=async(cid,mid)=>{var el=document.getElementById('crm-edit-'+mid);var v=el?el.value.trim():'';var c=_crmConvo(cid);var m=c&&(c.messages||[]).find(x=>x.id===mid);CRM.editMsgId=null;if(m&&v){m.text=v;m.edited=true;}rr();if(m&&v){try{await sb.from('crm_messages').update({body:v,edited_at:new Date().toISOString()}).eq('id',mid);}catch(e){}}};
App._crmDelMsg=async(cid,mid)=>{var c=_crmConvo(cid);if(!c)return;var m=(c.messages||[]).find(x=>x.id===mid);if(!m)return;var own=!m.fromCustomer&&m.senderId===S.uid;if(!((own&&can('crm','create'))||can('crm','delete')))return toast('No permission','err');if(!(await _crmConfirmP('Delete message','This message'+((m.images||[]).length?' and its image(s)':'')+' will be removed for everyone.','Delete')))return;c.messages=c.messages.filter(x=>x.id!==mid&&x.parentId!==mid);if(CRM.sel.threadId===mid)CRM.sel.threadId=null;rr();try{await sb.from('crm_messages').delete().eq('id',mid);}catch(e){}};
App._crmForward=(mid)=>{CRM.fwdMsgId=mid;rr();};
App._crmForwardClose=()=>{CRM.fwdMsgId=null;rr();};
// ── Create a ticket from a single chat message ──
App._crmTicketFromMsg=(cid,mid)=>{if(!can('crm','create'))return toast('No permission','err');var c=_crmConvo(cid);if(!c)return;var m=(c.messages||[]).find(function(x){return x.id===mid;});if(!m)return;CRM._tfm={cid:cid,mid:mid,text:(m.text||''),customer:(c.customer||''),srcBoard:c.boardId};App._crmTfmRender();};
App._crmTfmRender=()=>{var d=CRM._tfm;if(!d)return;var srcB=_crmBoard(d.srcBoard);var hubId=srcB?srcB.hubId:null;var boards=CRM.boards.filter(function(b){return _crmBoardVisible(b)&&_crmBS(b).type!=='chat'&&(!hubId||b.hubId===hubId);});if(!boards.length)boards=CRM.boards.filter(function(b){return _crmBoardVisible(b)&&_crmBS(b).type!=='chat';});
  var title=(d.text||'').replace(/\s+/g,' ').trim().slice(0,80)||'Ticket from chat';
  var body='<label class="ui-label">Ticket title</label><input id="tfm-title" value="'+esc(title)+'" class="ui-input" style="margin-bottom:12px" placeholder="Ticket title"/>'
    +'<label class="ui-label">Customer / reference</label><input id="tfm-cust" value="'+esc(d.customer||'')+'" class="ui-input" style="margin-bottom:12px" placeholder="Customer / Order ID"/>'
    +(boards.length?'<label class="ui-label">Add to board</label><select id="tfm-board" class="ui-select" style="margin-bottom:12px">'+boards.map(function(b){return'<option value="'+b.id+'">'+esc(_crmBoardLabel(b))+'</option>';}).join('')+'</select>':'<div style="font-size:12.5px;color:var(--c-danger);margin-bottom:12px">No ticket board here yet — create one with the “+ Board” tab first.</div>')
    
    +'<div style="margin-top:14px;padding:10px 12px;background:var(--c-surface-2);border-radius:10px;font-size:12px;color:var(--c-text-2);line-height:1.5"><b>From message:</b> '+esc((d.text||'').slice(0,160))+((d.text||'').length>160?'…':'')+'</div>';
  modalShell({title:'Create ticket from message',sub:'Turns this message into a tracked ticket, keeping the text as its first note.',size:'max-w-md',key:'crm-tfm',body:body,footer:btnG('Cancel','App.closeModal()')+(boards.length?btnP('Create ticket','App._crmTfmCreate()'):'')});};
App._crmTfmCreate=async()=>{var d=CRM._tfm;if(!d)return;var g=function(id){var e=document.getElementById(id);return e?e.value:'';};var title=(g('tfm-title')||'').trim()||'Ticket from chat';var cust=(g('tfm-cust')||'').trim();var bid=g('tfm-board');var pri='Medium';var b=_crmBoard(bid);if(!b)return toast('Pick a board','err');var st=(_crmStatuses(b)[0]||{name:'Open'}).name;var id=uid('cv');var now=new Date().toISOString();var msgs=[];if(d.text){msgs.push({id:uid('msg'),senderId:S.uid,fromCustomer:false,text:d.text,images:[],at:now,reactions:{},parentId:null});}var c={id:id,boardId:bid,title:title,customer:cust,channel:'From chat',isTicket:true,ticketType:'Ticket',priority:pri,status:st,assignedTo:null,assignedGroup:null,createdBy:S.uid||null,createdAt:now,lastAt:now,messages:msgs,fields:{},dueDate:null};CRM.convos.push(c);CRM._tfm=null;closeModal();CRM.sel.boardId=bid;CRM.sel.hubId=b.hubId;CRM.sel.viewId=null;CRM.sel.convoId=id;CRM.sel.threadId=null;CRM.search='';rr();toast('Ticket created ✓');_crmLog('created ticket',c,'from chat message');sbWrite({table:'crm_conversations',op:'insert',id:id,values:{id:id,board_id:bid,title:title,customer:cust,channel:'From chat',is_ticket:true,ticket_type:'Ticket',priority:pri,status:st,created_by:S.uid||null,created_at:now,last_at:now,updated_at:now}},{label:'New ticket'});if(msgs.length)sbWrite({table:'crm_messages',op:'insert',id:msgs[0].id,values:{id:msgs[0].id,conversation_id:id,sender_id:S.uid||null,from_customer:false,body:d.text,created_at:now}},{label:'Ticket note',silent:true});_crmNotifyRule('created',c,b,'crm_ticket',{title:title,type:b.name,customer:cust,actor:(me()?fullName(me()):'')});try{_crmRunAutos(b,'created',c,{});}catch(e){}};
App._crmDoForward=async(tid)=>{if(!can('crm','create'))return;var mid=CRM.fwdMsgId,m=null;for(var i=0;i<CRM.convos.length&&!m;i++){var mm=(CRM.convos[i].messages||[]).find(x=>x.id===mid);if(mm)m=mm;}if(!m)return;var tgt=_crmConvo(tid);if(!tgt)return;var id=uid('msg'),at=new Date().toISOString();var fm={id:id,senderId:S.uid,fromCustomer:false,text:(m.text?('↪ '+m.text):''),images:(m.images||[]).slice(),at:at,reactions:{},parentId:null};tgt.messages.push(fm);tgt.lastAt=at;CRM.fwdMsgId=null;toast('Forwarded ✓');rr();try{await sb.from('crm_messages').insert({id:id,conversation_id:tid,sender_id:S.uid||null,from_customer:false,body:fm.text,images:fm.images,created_at:at});await sb.from('crm_conversations').update({last_at:at}).eq('id',tid);}catch(e){}};
App._crmOpenThread=(mid)=>{CRM.sel.threadId=mid;rr();var t=document.getElementById('crm-tthread');if(t)t.scrollTop=t.scrollHeight;};
App._crmCloseThread=()=>{CRM.sel.threadId=null;rr();};
App._crmSendReply=async()=>{App._crmCloseMsgActs();if(!can('crm','create'))return;var el=document.getElementById('crm-tinput');var text=el?el.value.trim():'';if(!text)return;var c=_crmConvo(CRM.sel.convoId);if(!c)return;var pid=CRM.sel.threadId;var id=uid('msg'),at=new Date().toISOString();
  var reps=(c.messages||[]).filter(function(x){return x.parentId===pid;});var pv=reps[reps.length-1]||null;
  var m={id:id,senderId:S.uid,fromCustomer:false,text:text,images:[],at:at,reactions:{},parentId:pid};
  c.messages.push(m);c.lastAt=at;CRM._pend=CRM._pend||{};CRM._pend[id]=1;
  var t=document.getElementById('crm-tthread');
  if(t){t.insertAdjacentHTML('beforeend',_crmMsg(m,c.id,true,pv));t.scrollTop=t.scrollHeight;if(el){el.value='';el.style.height='auto';el.focus();}}
  else{rr();var t2=document.getElementById('crm-tthread');if(t2)t2.scrollTop=t2.scrollHeight;var i2=document.getElementById('crm-tinput');if(i2)i2.focus();}
  try{if(navigator.vibrate)navigator.vibrate(8);}catch(e){}
  try{await sb.from('crm_messages').insert({id:id,conversation_id:c.id,sender_id:S.uid||null,from_customer:false,body:text,images:[],parent_id:pid,created_at:at});delete CRM._pend[id];_crmTickFlip(id);await sb.from('crm_conversations').update({last_at:at}).eq('id',c.id);}catch(e){delete CRM._pend[id];_crmTickFlip(id);}};
/* v3.15: assign to a person (user-id) OR a group ('grp:<id>') — permission crm→assign covers both.
   Group assignment notifies every active member (in-app + email, personal toggles respected). */
App._crmAssign=async(id,val)=>{if(!can('crm','assign'))return toast('No permission to assign','err');var c=_crmConvo(id);if(!c)return;
  var prevU=c.assignedTo,prevG=c.assignedGroup||null;
  var isGrp=String(val||'').indexOf('grp:')===0;var gid=isGrp?String(val).slice(4):null;
  if(isGrp&&!_crmGroup(gid))return toast('That group no longer exists','err');
  c.assignedTo=isGrp?null:(val||null);c.assignedGroup=isGrp?gid:null;
  var d=document.getElementById('crm-assign');if(d)d.style.display='none';rr();
  sbWrite({table:'crm_conversations',op:'update',id:id,match:{col:'id',val:id},values:{assigned_to:c.assignedTo,assigned_group:c.assignedGroup,updated_at:new Date().toISOString()}},{label:'Assign'});
  try{_crmRunAutos(_crmBoard(c.boardId),'assigned',c,{to:val});}catch(e){}
  try{_crmRunAutos(_crmBoard(c.boardId),'column',c,{colId:'nat:assignee',value:val||''});}catch(e){}
  var at2=new Date().toISOString(),who=me()?fullName(me()):'Someone',_lnkA='crm:'+c.id;
  if(isGrp&&gid!==prevG){var g=_crmGroup(gid);
    _crmLog('assigned',c,'to group “'+(g?g.name:'')+'”');
    var memN=((g&&g.members)||[]).filter(function(x){var u=uById(x);return u&&u.status!=='Disabled'&&x!==S.uid;});
    var ntxtG='\u{1F3AF} '+who+' assigned your group “'+(g?g.name:'')+'”: "'+(c.title||'')+'"';
    memN.forEach(function(mid){
      if(_crmInappOn('crm_ticket')){var nid=uid('n');try{DB.notifications.unshift({id:nid,userId:mid,text:ntxtG,time:at2,read:false,link:_lnkA});}catch(e){}sbWrite({table:'notifications',op:'insert',id:nid,values:{id:nid,user_id:mid,text:ntxtG,read:false,created_at:at2,link:_lnkA}},{label:'Notify',silent:true});}
      if(typeof queueEmail==='function'){try{queueEmail('crm_ticket',mid,null,null,{title:c.title,customer:c.customer,actor:who});}catch(e){}}
    });
    try{_invalidateNotifCache();}catch(e){}
  }else if(!isGrp&&val&&val!==prevU){_crmLog('assigned',c,'to '+(uById(val)?fullName(uById(val)):''));
    if(val!==S.uid){var nid2=uid('n');var ntxt='\u{1F3AF} '+who+' assigned you: "'+(c.title||'')+'"';
      if(_crmInappOn('crm_ticket')){try{DB.notifications.unshift({id:nid2,userId:val,text:ntxt,time:at2,read:false,link:_lnkA});}catch(e){}sbWrite({table:'notifications',op:'insert',id:nid2,values:{id:nid2,user_id:val,text:ntxt,read:false,created_at:at2,link:_lnkA}},{label:'Notify',silent:true});_invalidateNotifCache();}
      if(typeof queueEmail==='function'){try{queueEmail('crm_ticket',val,null,null,{title:c.title,customer:c.customer,actor:who});}catch(e){}}}}};
function _crmIsMob(){return !!(window.matchMedia&&window.matchMedia('(max-width:767px)').matches);}
/* v3.16 — on phones the New-conversation form is a modal behind a floating "New chat" button,
   so the list gets the full screen. Same input ids -> _crmNewConvo works unchanged. */
App._crmNewChatModal=()=>{if(!can('crm','create'))return;modalShell({title:'New conversation',sub:'Starts on this board',size:'max-w-sm',key:'crm-newchat',
  body:'<input id="crm-nc-name" class="ui-input" placeholder="Customer / Order ID" style="margin-bottom:10px"/><input id="crm-nc-title" class="ui-input" placeholder="Subject" onkeydown="if(event.key===\'Enter\')App._crmNewChatGo()"/>',
  footer:btnG('Cancel','App.closeModal()')+btnP('Start chat','App._crmNewChatGo()')});
  setTimeout(function(){var e=document.getElementById('crm-nc-name');if(e)e.focus();},60);};
App._crmNewChatGo=()=>{App._crmNewConvo();App.closeModal();};
App._crmNewConvo=async()=>{if(!can('crm','create'))return toast('You don’t have permission to create in Workspace','err');if(!CRM.sel.boardId)return toast('Select a board first','err');var nm=document.getElementById('crm-nc-name'),tt=document.getElementById('crm-nc-title');var name=(nm?nm.value:'').trim()||'New customer';var title=(tt?tt.value:'').trim()||'New conversation';var id=uid('cv');var now=new Date().toISOString();var _isTk=_crmBS(_crmBoard(CRM.sel.boardId)).type!=='chat';var c={id:id,boardId:CRM.sel.boardId,title:title,customer:name,channel:'Manual',isTicket:_isTk,ticketType:(_isTk?'Ticket':null),priority:'Medium',status:'Open',assignedTo:null,assignedGroup:null,createdBy:S.uid||null,createdAt:now,lastAt:now,messages:[]};CRM.convos.push(c);CRM.sel.category='Chats';CRM.sel.convoId=id;CRM.sel.threadId=null;CRM.search='';toast('Chat started ✓');rr();_crmLog('started chat',c,'');try{if(_isTk)_crmRunAutos(_crmBoard(CRM.sel.boardId),'created',c,{});}catch(e){}try{await sb.from('crm_conversations').insert({id:id,board_id:c.boardId,title:title,customer:name,channel:'Manual',is_ticket:_isTk,ticket_type:(_isTk?'Ticket':null),priority:'Medium',status:'Open',created_by:S.uid||null,created_at:now,last_at:now});}catch(e){console.warn('[CRM convo]',e&&e.message);toast('Saved locally, sync failed','warn');}};
App._crmDelConvo=async(id)=>{if(!can('crm','delete'))return toast('No permission to delete','err');var c=_crmConvo(id);if(!c)return;if(!(await _crmConfirmP('Delete conversation','“'+esc(c.title||'')+'” and all its messages will be permanently deleted.','Delete')))return;CRM.convos=CRM.convos.filter(x=>x.id!==id);if(CRM.sel.convoId===id){CRM.sel.convoId=null;CRM.sel.threadId=null;}rr();sbWrite({table:'crm_conversations',op:'delete',id:id,match:{col:'id',val:id}},{label:'Delete conversation'});};
App._crmConvert=async(id,type)=>{if(!can('crm','convert'))return toast('No permission to convert','err');var c=_crmConvo(id);if(!c)return;var d=document.getElementById('crm-convert');if(d)d.style.display='none';if(!type||type==='Other'){var t=await _crmPromptP('New ticket type','','e.g. Refunds','Add','General');if(!t)return;type=t.trim();var _cb2=_crmBoard(c.boardId);if(_cb2){if(!_cb2.settings)_cb2.settings={};var _cc=(_cb2.settings.categories&&_cb2.settings.categories.length?_cb2.settings.categories.slice():_crmCats(_cb2).slice());if(_cc.indexOf(type)<0)_cc.push(type);_cb2.settings.categories=_cc;try{await sb.from('crm_boards').update({settings:_cb2.settings}).eq('id',_cb2.id);}catch(e){}}}c.isTicket=true;c.ticketType=type;c.status=c.status||'Open';CRM.sel.category=type;CRM.sel.convoId=c.id;toast('Converted to '+type+' ticket ✓');rr();_crmLog('created ticket',c,type);var _cb=_crmBoard(c.boardId);_crmNotifyRule('created',c,_cb,'crm_ticket',{title:c.title,type:type,customer:c.customer});try{_crmRunAutos(_cb,'created',c,{});}catch(e){}if(_crmBS(_cb).type==='approval')_crmNotifyRule('approval',c,_cb,'crm_approval',{title:c.title,customer:c.customer});try{await sb.from('crm_conversations').update({is_ticket:true,ticket_type:type,status:c.status,priority:c.priority}).eq('id',id);}catch(e){console.warn('[CRM convert]',e&&e.message);}};
App._crmSetDue=async(id,v)=>{if(!can('crm','edit'))return;var c=_crmConvo(id);if(!c)return;c.dueDate=v||null;rr();_crmLog('due date',c,v?('set to '+v):'cleared');sbWrite({table:'crm_conversations',op:'update',id:id,match:{col:'id',val:id},values:{due_date:v||null,updated_at:new Date().toISOString()}},{label:'Due date'});try{_crmRunAutos(_crmBoard(c.boardId),'column',c,{colId:'nat:due',value:v||''});}catch(e){}};
App._crmSetPriority=async(id,v)=>{if(!can('crm','edit'))return;var c=_crmConvo(id);if(!c)return;c.priority=v;rr();sbWrite({table:'crm_conversations',op:'update',id:id,match:{col:'id',val:id},values:{priority:v,updated_at:new Date().toISOString()}},{label:'Priority'});try{_crmRunAutos(_crmBoard(c.boardId),'priority',c,{to:v});}catch(e){}try{_crmRunAutos(_crmBoard(c.boardId),'column',c,{colId:'nat:priority',value:v});}catch(e){}};
App._crmSetStatus=async(id,v)=>{if(!can('crm','edit'))return;var c=_crmConvo(id);if(!c)return;var prev=c.status;c.status=v;rr();if(prev!==v)_crmLog('status',c,prev+' → '+v);sbWrite({table:'crm_conversations',op:'update',id:id,match:{col:'id',val:id},values:{status:v,updated_at:new Date().toISOString()}},{label:'Status'});try{_crmRunAutos(_crmBoard(c.boardId),'status',c,{to:v});}catch(e){}try{if(prev!==v)_crmRunAutos(_crmBoard(c.boardId),'column',c,{colId:'nat:status',value:v});}catch(e){}};
App._crmAddMember=(uid2)=>{if(!_crmCanBoardMembers())return toast('No permission','err');CRM._boardDraft=CRM._boardDraft||[];if(CRM._boardDraft.indexOf(uid2)<0)CRM._boardDraft.push(uid2);rr();};
App._crmRemoveMember=(uid2)=>{if(!_crmCanBoardMembers())return toast('No permission','err');CRM._boardDraft=(CRM._boardDraft||[]).filter(function(x){return x!==uid2;});rr();};
App._crmNewHub=async()=>{if(!can('crm','create'))return toast('No permission to create','err');var n=await _crmPromptP('New hub','A hub is a city or team — it holds boards (chats & ticket tables) and filtered views.','e.g. Dubai','Create hub');if(!n)return;var id=uid('hub'),bid=uid('brd');_crmMarkFresh(id);_crmMarkFresh(bid);CRM.hubs.push({id:id,name:n.trim(),icon:'folder'});if(S.uid)CRM.hubMembers[id]=[S.uid];CRM.boards.push({id:bid,hubId:id,name:'Chat',members:S.uid?[S.uid]:[],settings:{type:'chat'},createdBy:S.uid||null});CRM.sel.hubId=id;CRM.sel.viewId=null;CRM.sel.boardId=bid;CRM.sel.convoId=null;CRM.sel.threadId=null;rr();try{await sb.from('crm_hubs').insert({id:id,name:n.trim(),icon:'folder',created_by:S.uid||null,sort:CRM.hubs.length});if(S.uid)await sb.from('crm_hub_members').insert({hub_id:id,user_id:S.uid});await sb.from('crm_boards').insert({id:bid,hub_id:id,name:'Chat',created_by:S.uid||null,sort:0,settings:{type:'chat'}});if(S.uid)await sb.from('crm_board_members').insert({board_id:bid,user_id:S.uid});}catch(e){toast('Saved locally, sync failed','warn');}};
App._crmDelHub=async(id)=>{if(!can('crm','delete'))return toast('No permission to delete','err');var h=CRM.hubs.find(x=>x.id===id);if(!h)return;if(!(await _crmConfirmP('Delete hub','“'+esc(h.name)+'” and <b>all</b> its boards, filtered views and conversations will be permanently deleted.','Delete hub')))return;var bids=CRM.boards.filter(b=>b.hubId===id).map(b=>b.id);var vids=(CRM.views||[]).filter(v=>v.hubId===id).map(v=>v.id);CRM.hubs=CRM.hubs.filter(x=>x.id!==id);CRM.boards=CRM.boards.filter(b=>b.hubId!==id);CRM.views=(CRM.views||[]).filter(v=>v.hubId!==id);CRM.convos=CRM.convos.filter(c=>bids.indexOf(c.boardId)<0);if(bids.indexOf(CRM.sel.boardId)>=0||vids.indexOf(CRM.sel.viewId)>=0){CRM.sel.boardId=null;CRM.sel.viewId=null;CRM.sel.convoId=null;CRM.sel.threadId=null;}rr();sbWrite({table:'crm_hubs',op:'delete',id:id,match:{col:'id',val:id}},{label:'Delete hub'});vids.forEach(function(vid){sbWrite({table:'crm_views',op:'delete',id:vid,match:{col:'id',val:vid}},{label:'Delete view',silent:true});});};
/* ── Renaming (crm → rename permission): sidebar label + hubs / boards ── */
App._crmRenameHubsLabel=async()=>{if(!can('crm','rename'))return toast('No permission to rename','err');var cur=(CRM.settings&&CRM.settings.hubsLabel)||'Hubs';var n=await _crmPromptP('Rename sidebar title','This is the label above your hubs list — e.g. “Workspaces”, “Cities”, “Teams”.','e.g. Workspaces','Rename',cur);if(!n||n.trim()===cur)return;CRM.settings=Object.assign({},CRM.settings,{hubsLabel:n.trim()});rr();_crmSaveSettings('Sidebar title');toast('Renamed to “'+n.trim()+'” ✓');};
App._crmRenameHub=async(id)=>{if(!can('crm','rename'))return toast('No permission to rename','err');var h=CRM.hubs.find(function(x){return x.id===id;});if(!h)return;var n=await _crmPromptP('Rename hub','','e.g. Dubai','Rename',h.name);if(!n||n.trim()===h.name)return;h.name=n.trim();rr();_crmLog('renamed hub',null,h.name);sbWrite({table:'crm_hubs',op:'update',id:id,match:{col:'id',val:id},values:{name:h.name}},{label:'Rename hub'});};
App._crmRenameBoard=async(id)=>{if(!can('crm','rename'))return toast('No permission to rename','err');var b=_crmBoard(id);if(!b)return;var n=await _crmPromptP('Rename board','','e.g. Complaints','Rename',b.name);if(!n||n.trim()===b.name)return;b.name=n.trim();rr();_crmLog('renamed board',null,b.name);sbWrite({table:'crm_boards',op:'update',id:id,match:{col:'id',val:id},values:{name:b.name}},{label:'Rename board'});};
/* ── People groups: create once, use everywhere (tag with @, automations, board & global notifications) ── */
App._crmGroupsOpen=()=>{CRM._grpEdit=null;App._crmGroupsRender();};
App._crmGroupNewFromNav=()=>{App._crmGroupNew();};
App._crmGroupsRender=()=>{
  if(CRM._grpEdit)return App._crmGroupEditRender();
  var canMg=can('crm','groups');var gs=_crmGroups();
  var list=gs.length?gs.map(function(g){var mem=(g.members||[]).map(uById).filter(Boolean);
    return'<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--c-border);border-radius:12px;margin-bottom:8px;background:#fff">'
      +'<span style="width:30px;height:30px;border-radius:9px;background:#F7F4EF;color:#54433C;display:grid;place-items:center;flex-shrink:0">'+ic('users','w-4 h-4')+'</span>'
      +'<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:800;color:var(--c-text)">'+esc(g.name||'—')+' <span style="font-size:10.5px;font-weight:700;color:var(--c-text-3)">@'+esc(_crmGroupToken(g))+'</span></div><div style="font-size:11.5px;color:var(--c-text-2);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(mem.length?mem.slice(0,4).map(function(u){return esc(_crmFirst(u));}).join(', ')+(mem.length>4?' +'+(mem.length-4):''):'No members yet')+'</div></div>'
      +'<span style="display:flex;align-items:center;flex-shrink:0">'+mem.slice(0,4).map(function(u,i){return'<span style="margin-left:'+(i?-7:0)+'px;border:2px solid #fff;border-radius:50%;display:inline-flex">'+avatar(u,'w-6 h-6','text-[9px]')+'</span>';}).join('')+'</span>'
      +'<span style="font-size:11px;font-weight:800;color:var(--c-text-2);background:var(--c-surface-2);border-radius:9px;padding:2px 8px;flex-shrink:0">'+mem.length+'</span>'
      +(canMg?'<button onclick="App._crmGroupEdit(\''+g.id+'\')" title="Edit group" style="border:none;background:var(--c-surface-2);color:var(--c-text-2);width:28px;height:28px;border-radius:8px;cursor:pointer;display:grid;place-items:center;flex-shrink:0">'+ic('edit','w-3.5 h-3.5')+'</button><button onclick="App._crmGroupDel(\''+g.id+'\')" title="Delete group" style="border:none;background:var(--c-danger-soft);color:var(--c-danger);width:28px;height:28px;border-radius:8px;cursor:pointer;display:grid;place-items:center;flex-shrink:0">'+ic('trash','w-3.5 h-3.5')+'</button>':'')
    +'</div>';}).join(''):'<div style="padding:22px;text-align:center;color:var(--c-text-3);font-size:12.5px;line-height:1.6">No groups yet.'+(canMg?'<br/>Create one and use it everywhere — @tag it in chat, pick it in automations and board notifications.':'')+'</div>';
  modalShell({title:'People groups',sub:'One group, used everywhere: @tag it in any board, notify it in automations, email it via board rules.',size:'max-w-lg',key:'crm-groups',
    body:list+(canMg?'<button onclick="App._crmGroupNew()" class="ui-btn ui-btn-brand ui-btn-sm" style="margin-top:4px">+ New group</button>':''),
    footer:btnP('Done','App.closeModal();rr()')});
};
App._crmGroupNew=()=>{if(!can('crm','groups'))return toast('You need the Workspace → People groups permission','err');CRM._grpEdit={id:uid('grp'),name:'',members:[],_new:true};App._crmGroupsRender();};
App._crmGroupEdit=(id)=>{if(!can('crm','groups'))return toast('You need the Workspace → People groups permission','err');var g=_crmGroup(id);if(!g)return;CRM._grpEdit=JSON.parse(JSON.stringify(g));delete CRM._grpEdit._new;App._crmGroupsRender();};
App._crmGroupTogM=(uid2,on)=>{var d=CRM._grpEdit;if(!d)return;d.members=d.members||[];var i=d.members.indexOf(uid2);if(on&&i<0)d.members.push(uid2);if(!on&&i>=0)d.members.splice(i,1);var el=document.getElementById('crm-grp-cnt');if(el)el.textContent=d.members.length;};
App._crmGroupEditRender=()=>{var d=CRM._grpEdit;if(!d)return;
  var us=(DB.users||[]).filter(function(u){return u&&u.status!=='Disabled';}).sort(function(a,b){return fullName(a).localeCompare(fullName(b));});
  modalShell({title:(d._new?'New group':'Edit group'),sub:'Tag everyone in it at once with @'+(_crmGroupToken(d)||'name')+' — automations and board rules can notify or email the whole group.',size:'max-w-md',key:'crm-groups',
    body:'<label class="ui-label">Group name</label><input value="'+esc(d.name||'')+'" oninput="CRM._grpEdit.name=this.value" placeholder="e.g. Night shift, Support team" class="ui-input" style="margin-bottom:12px"/>'
      +'<label class="ui-label">Members (<span id="crm-grp-cnt">'+((d.members||[]).length)+'</span>)</label>'
      +'<input placeholder="Search people…" oninput="var q=this.value.toLowerCase();document.querySelectorAll(\'.crm-grp-row\').forEach(function(r){r.style.display=(r.getAttribute(\'data-n\')||\'\').indexOf(q)>=0?\'flex\':\'none\';})" class="ui-input" style="margin-bottom:8px"/>'
      +'<div style="max-height:230px;overflow:auto;border:1px solid var(--c-border);border-radius:10px;padding:6px">'+(us.length?us.map(function(u){return'<label class="crm-grp-row" data-n="'+esc(fullName(u).toLowerCase())+'" style="display:flex;align-items:center;gap:8px;font-size:12.5px;padding:3px 2px;cursor:pointer"><input type="checkbox" '+(((d.members||[]).indexOf(u.id)>=0)?'checked':'')+' onchange="App._crmGroupTogM(\''+u.id+'\',this.checked)"/>'+avatar(u,'w-5 h-5','text-[8px]')+esc(fullName(u))+'</label>';}).join(''):'<div style="padding:8px;font-size:12px;color:var(--c-text-3)">No users.</div>')+'</div>',
    footer:btnG('Back','App._crmGroupsOpen()')+btnP('Save group','App._crmGroupSave()')});
};
App._crmGroupSave=()=>{if(!can('crm','groups'))return toast('No permission','err');var d=CRM._grpEdit;if(!d)return;var name=String(d.name||'').trim();if(!name)return toast('Name the group','err');if(!_crmGroupToken({name:name}))return toast('The name needs at least one letter or number','err');var gs=_crmGroups().slice();var tok=_crmGroupToken({name:name}).toLowerCase();if(gs.some(function(g){return g.id!==d.id&&_crmGroupToken(g).toLowerCase()===tok;}))return toast('A group with that @tag already exists','err');var rec={id:d.id,name:name,members:(d.members||[]).slice()};var i=gs.findIndex(function(g){return g.id===d.id;});if(i>=0)gs[i]=rec;else gs.push(rec);CRM.settings=Object.assign({},CRM.settings,{groups:gs});CRM._grpEdit=null;App._crmGroupsRender();_crmSaveSettings('People group');toast('Group saved ✓ — tag it with @'+_crmGroupToken(rec));};
App._crmGroupDel=async(id)=>{if(!can('crm','groups'))return toast('No permission','err');var g=_crmGroup(id);if(!g)return;if(!(await _crmConfirmP('Delete group','“'+esc(g.name)+'” disappears from tagging, automations and notification lists. The people themselves are not affected.','Delete group'))){App._crmGroupsRender();return;}CRM.settings=Object.assign({},CRM.settings,{groups:_crmGroups().filter(function(x){return x.id!==id;})});App._crmGroupsRender();_crmSaveSettings('Delete group');};
/* v3.12: boards are created ON THE HUB — pick a name and a type (ticket table / chat) */
App._crmNewBoard=(hubId)=>{if(!can('crm','create'))return toast('No permission to create','err');var h=_crmHub(hubId);if(!h)return;CRM._nbEdit={hubId:hubId,name:'',type:'ticket'};App._crmNewBoardRender();};
App._crmNewBoardRender=()=>{
  var d=CRM._nbEdit;if(!d)return;var h=_crmHub(d.hubId);
  var pill=function(v,label,desc,icon){var on=d.type===v;return'<button type="button" onclick="CRM._nbEdit.type=\''+v+'\';App._crmNewBoardRender()" style="flex:1;text-align:left;display:flex;align-items:flex-start;gap:9px;padding:11px;border:1.5px solid '+(on?'#54433C':'#E6DED3')+';border-radius:12px;background:'+(on?'#EEE4D5':'#fff')+';cursor:pointer"><span style="width:30px;height:30px;border-radius:9px;background:'+(on?'#fff':'#F7F3EE')+';color:'+(on?'#54433C':'#A59788')+';display:grid;place-items:center;flex-shrink:0">'+ic(icon,'w-4 h-4')+'</span><span><span style="display:block;font-size:12.5px;font-weight:800;color:#13171B">'+label+'</span><span style="display:block;font-size:10.5px;color:#A59788;margin-top:1px;line-height:1.4">'+desc+'</span></span></button>';};
  modalShell({title:'New board — '+esc(h?h.name:''),sub:'It appears as a tab on the hub, with its own members, columns, statuses & automations.',size:'max-w-md',key:'crm-nb',
    body:'<label class="ui-label">Board name</label><input id="crm-nb-name" value="'+esc(d.name||'')+'" oninput="CRM._nbEdit.name=this.value" placeholder="e.g. Complaints, Refunds, Chat" class="ui-input" style="margin-bottom:14px" onkeydown="if(event.key===\'Enter\')App._crmNewBoardGo()"/>'
      +'<label class="ui-label">Type</label><div style="display:flex;gap:8px">'+pill('ticket','Ticket table','Rows with Status, Assignee + your own columns','ticket')+pill('chat','Chat','Conversations with customers or the team','msg')+'</div>',
    footer:btnG('Cancel','App.closeModal()')+btnP('Create board','App._crmNewBoardGo()')});
  setTimeout(function(){var e=document.getElementById('crm-nb-name');if(e)e.focus();},60);
};
App._crmNewBoardGo=async()=>{
  if(!can('crm','create'))return toast('No permission to create','err');
  var d=CRM._nbEdit;if(!d)return;var h=_crmHub(d.hubId);if(!h)return;
  var n=String(d.name||'').trim();if(!n)return toast('Name the board','err');
  var id=uid('brd');_crmMarkFresh(id);
  CRM.boards.push({id:id,hubId:d.hubId,name:n,members:S.uid?[S.uid]:[],settings:{type:d.type||'ticket'},createdBy:S.uid||null});
  CRM._nbEdit=null;closeModal();
  CRM.sel.hubId=d.hubId;CRM.sel.viewId=null;CRM.sel.boardId=id;CRM.sel.convoId=null;CRM.sel.threadId=null;rr();
  toast('Board created ✓');
  try{await sb.from('crm_boards').insert({id:id,hub_id:d.hubId,name:n,created_by:S.uid||null,sort:CRM.boards.length,settings:{type:d.type||'ticket'}});if(S.uid)await sb.from('crm_board_members').insert({board_id:id,user_id:S.uid});}catch(e){toast('Saved locally, sync failed','warn');}
};
App._crmDelBoard=async(id)=>{if(!can('crm','delete'))return toast('No permission to delete','err');var b=_crmBoard(id);if(!b)return;if(!(await _crmConfirmP('Delete board','“'+esc(b.name)+'” and its tickets & conversations will be permanently deleted. Filtered views keep working — this board simply disappears from them.','Delete board')))return;CRM.boards=CRM.boards.filter(x=>x.id!==id);CRM.convos=CRM.convos.filter(c=>c.boardId!==id);(CRM.views||[]).forEach(function(v){if(!v.filters||Array.isArray(v.filters))return;var had=!!v.filters[id];if(had)delete v.filters[id];var h=_crmViewHidden(v);if(h.indexOf(id)>=0){v.filters[_CRM_VHIDE]=h.filter(function(x){return x!==id;});if(!v.filters[_CRM_VHIDE].length)delete v.filters[_CRM_VHIDE];had=true;}if(had)sbWrite({table:'crm_views',op:'update',id:v.id,match:{col:'id',val:v.id},values:{filters:v.filters}},{label:'View filter',silent:true});});if(CRM.sel.boardId===id){CRM.sel.boardId=null;CRM.sel.convoId=null;CRM.sel.threadId=null;}rr();sbWrite({table:'crm_boards',op:'delete',id:id,match:{col:'id',val:id}},{label:'Delete board'});};
App._crmAddCat=async()=>{if(!can('crm','create'))return;var b=_crmBoard(CRM.sel.boardId);if(!b)return;var n=await _crmPromptP('New section','','e.g. Complaints','Add');if(!n)return;n=n.trim();if(!b.settings)b.settings={};var cats=(b.settings.categories&&b.settings.categories.length)?b.settings.categories.slice():_crmCats(b).slice();if(cats.indexOf(n)<0)cats.push(n);b.settings.categories=cats;CRM.sel.category=n;rr();try{await sb.from('crm_boards').update({settings:b.settings}).eq('id',b.id);}catch(e){}};
App._crmDelCat=async(name)=>{if(!can('crm','delete'))return;var b=_crmBoard(CRM.sel.boardId);if(!b)return;if(CRM.convos.some(function(c){return c.boardId===b.id&&c.isTicket&&c.ticketType===name;}))return toast('“'+name+'” still has tickets — move or delete those first','err');if(!(await _crmConfirmP('Remove section','The “'+esc(name)+'” section will be removed from this board.','Remove')))return;if(!b.settings)b.settings={};var cats=(b.settings.categories&&b.settings.categories.length?b.settings.categories:_crmCats(b)).filter(function(x){return x!==name;});b.settings.categories=cats;if(CRM.sel.category===name)CRM.sel.category='Chats';rr();try{await sb.from('crm_boards').update({settings:b.settings}).eq('id',b.id);}catch(e){}};

// ===== CRM AUTOMATION: activity log, approvals, notification rules, email =====
function _crmBS(board){var s=(board&&board.settings)||{};var g=CRM.settings||{};return{type:s.type||'chat',approvers:s.approvers||[],notify:s.notify||{},email:(s.email&&Object.keys(s.email).length?s.email:(g.email||{})),approveTo:s.approveTo||{action:'resolve'},rejectTo:s.rejectTo||{action:'resolve'}};}
function _crmActFor(cid){return (CRM.activity||[]).filter(function(a){return a.conversationId===cid;});}
async function _crmLog(action,convo,detail){var id=uid('act');var at=new Date().toISOString();var e={id:id,conversationId:convo?convo.id:null,boardId:convo?convo.boardId:CRM.sel.boardId,actor:S.uid,action:action,detail:detail||'',at:at};if(!CRM.activity)CRM.activity=[];CRM.activity.unshift(e);try{await sb.from('crm_activity').insert({id:id,conversation_id:e.conversationId,board_id:e.boardId,actor:S.uid||null,action:action,detail:e.detail,created_at:at});}catch(err){}}
function _crmRecips(board,event){var bs=_crmBS(board);var g=CRM.settings||{};var set={};var gl=_crmExpandPeople((g.notify&&g.notify.list)||[]);var bl=_crmExpandPeople((bs.notify&&bs.notify.list)||[]);if(event==='approval'){_crmExpandPeople(bs.approvers||[]).forEach(function(u){set[u]=1;});}else{gl.forEach(function(u){set[u]=1;});bl.forEach(function(u){set[u]=1;});}delete set[S.uid];return Object.keys(set);}
async function _crmNotifyRule(event,convo,board,emailType,vars){var recips=_crmRecips(board,event);if(!recips.length)return;var bs=_crmBS(board);var emailOn=!(bs.email&&bs.email[event]===false);var who=me()?fullName(me()):'Someone';var at=new Date().toISOString();var txt=(event==='created'?('\u{1F3AB} '+who+' created a ticket: "'+(convo.title||'')+'"'):event==='approval'?('✅ Approval needed: "'+(convo.title||'')+'"'):event==='decided'?(((vars&&vars.decision)||'Updated')+': "'+(convo.title||'')+'"'):('\u{1F514} '+(convo.title||'')));var _lnk2=convo&&convo.id?('crm:'+convo.id):null;for(var i=0;i<recips.length;i++){if(_crmInappOn('crm_ticket')){var nid=uid('n');try{DB.notifications.unshift({id:nid,userId:recips[i],text:txt,time:at,read:false,link:_lnk2});}catch(e){}try{await sb.from('notifications').insert({id:nid,user_id:recips[i],text:txt,read:false,created_at:at,link:_lnk2});}catch(e){}}if(emailOn&&emailType&&typeof queueEmail==='function'){try{queueEmail(emailType,recips[i],null,null,vars||{});}catch(e){}}}try{_invalidateNotifCache();}catch(e){}}
App._crmDecide=async(id,decision)=>{var c=_crmConvo(id);if(!c)return;var board=_crmBoard(c.boardId);var bs=_crmBS(board);if(!(can('crm','manage')||(bs.approvers||[]).indexOf(S.uid)>=0||can('crm','convert')||can('crm','edit')))return toast('Only approvers can decide','err');var at=new Date().toISOString();c.decision=decision;c.decidedBy=S.uid;c.decidedAt=at;var step=decision==='Approved'?bs.approveTo:bs.rejectTo;var detail;if(step&&step.action==='move'&&step.boardId&&_crmBoard(step.boardId)){c.boardId=step.boardId;c.isTicket=true;detail='moved to '+_crmBoard(step.boardId).name;}else{var _doneSt=(_crmStatuses(board).find(function(x){return x.done;})||{name:'Resolved'}).name;c.status=_doneSt;detail='marked '+_doneSt;}await _crmLog(decision,c,detail);toast('Ticket '+decision.toLowerCase()+' ✓');rr();sbWrite({table:'crm_conversations',op:'update',id:id,match:{col:'id',val:id},values:{decision:decision,decided_by:S.uid||null,decided_at:at,board_id:c.boardId,status:c.status,updated_at:at}},{label:'Ticket decision'});_crmNotifyRule('decided',c,board,'crm_decided',{title:c.title,decision:decision,actor:(me()?fullName(me()):''),customer:c.customer});if(typeof _crmNotifyEvent==='function')_crmNotifyEvent(board,decision==='Approved'?'approved':'rejected',c,decision==='Approved'?'crm_approval':'crm_decided',{title:c.title,decision:decision,actor:(me()?fullName(me()):''),customer:c.customer});};
function _crmApprovalCtl(convo,board){return'';var bs=_crmBS(board);if(bs.type==='chat'||!convo.isTicket)return'';if(convo.decision){var col=convo.decision==='Approved'?['#346A47','#EEE4D5']:['#93301F','#FAEDE8'];var by=convo.decidedBy&&uById(convo.decidedBy)?fullName(uById(convo.decidedBy)):'';return'<span style="display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;color:'+col[0]+';background:'+col[1]+';border-radius:8px;padding:4px 9px">'+esc(convo.decision)+(by?' · '+esc(by):'')+' · '+_crmDT(convo.decidedAt)+'</span>';}var ok=can('crm','manage')||(bs.approvers||[]).indexOf(S.uid)>=0||can('crm','convert');if(!ok)return'<span style="font-size:11.5px;color:#A59788">Awaiting approval</span>';return'<div style="display:flex;gap:6px"><button onclick="App._crmDecide(\''+convo.id+'\',\'Approved\')" style="display:inline-flex;align-items:center;gap:5px;background:#54433C;color:#fff;font-size:12px;font-weight:700;padding:7px 12px;border-radius:9px;border:none;cursor:pointer">'+ic('check','w-3.5 h-3.5')+'Approve</button><button onclick="App._crmDecide(\''+convo.id+'\',\'Rejected\')" style="display:inline-flex;align-items:center;gap:5px;background:#fff;color:#B3402E;border:1px solid #E4A898;font-size:12px;font-weight:700;padding:7px 12px;border-radius:9px;cursor:pointer">'+ic('x','w-3.5 h-3.5')+'Reject</button></div>';}
function _crmHdrBtns(convo,board){var others=CRM.boards.filter(function(b){return board&&b.hubId===board.hubId&&b.id!==convo.boardId&&_crmBoardVisible(b)&&_crmBS(b).type!=='chat';});var mv=(can('crm','edit')&&others.length)?'<div style="position:relative"><button class="crm-hdr-sec crm-hdr-btn" title="Move / escalate to another board" onclick="App._crmTogMove()" style="width:34px;height:34px;border-radius:9px;border:1px solid #E6DED3;background:#fff;color:#786A5F;cursor:pointer;display:grid;place-items:center">'+ic('send','w-4 h-4')+'</button><div id="crm-move" style="display:none;position:absolute;right:0;top:38px;z-index:60;background:#fff;border:1px solid #E6DED3;border-radius:12px;box-shadow:0 12px 32px rgba(35,28,22,.18);padding:6px;width:224px;max-height:250px;overflow:auto"><div style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#A59788;padding:4px 8px">Move / escalate to</div>'+others.map(function(b){var t=_crmBS(b).type;return'<button onclick="App._crmMoveConvo(\''+convo.id+'\',\''+b.id+'\')" style="width:100%;text-align:left;display:flex;align-items:center;gap:8px;padding:7px 8px;border:none;background:transparent;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;color:#13171B" onmouseover="this.style.background=\'#F4F0EA\'" onmouseout="this.style.background=\'transparent\'"><span style="color:#A59788">'+ic(t==='chat'?'msg':'ticket','w-3.5 h-3.5')+'</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(b.name)+'</span><span style="font-size:9px;font-weight:800;text-transform:uppercase;color:#A8998A">'+esc(t)+'</span></button>';}).join('')+'</div></div>':'';var snd='<button class="crm-hdr-btn" id="crm-sndbtn" title="Message sound (loud!)" onclick="App._crmSndTog(this)" style="width:34px;height:34px;border-radius:9px;border:1px solid #E6DED3;background:#fff;cursor:pointer;display:grid;place-items:center;font-size:15px;line-height:1">'+(_crmSndOn()?'\u{1F514}':'\u{1F515}')+'</button>';return snd+mv+(convo.isTicket?'<button class="crm-hdr-btn" title="Details panel" onclick="App._crmTogDetails()" style="width:34px;height:34px;border-radius:9px;border:1px solid #E6DED3;background:'+(CRM.detailsOpen!==false?'#F7F4EF':'#fff')+';color:#786A5F;cursor:pointer;display:grid;place-items:center">'+ic('info','w-4 h-4')+'</button>':'')+'<button title="Activity — who did what" class="crm-hdr-sec crm-hdr-btn" onclick="App._crmTogActivity()" style="width:34px;height:34px;border-radius:9px;border:1px solid #E6DED3;background:'+(CRM.activityOpen?'#F7F4EF':'#fff')+';color:#786A5F;cursor:pointer;display:grid;place-items:center">'+ic('clock','w-4 h-4')+'</button>';}
function _crmChecked(prefix){var out=[];(DB.users||[]).forEach(function(u){var el=document.getElementById(prefix+u.id);if(el&&el.checked)out.push(u.id);});return out;}
App._crmTogActivity=()=>{CRM.activityOpen=!CRM.activityOpen;rr();};
App._crmTogBoardSettings=(bid)=>{CRM._bsBoardId=bid||CRM.sel.boardId;CRM.boardSettingsOpen=!CRM.boardSettingsOpen;rr();};
App._crmTogGlobalSettings=()=>{CRM.globalSettingsOpen=!CRM.globalSettingsOpen;CRM.boardSettingsOpen=false;rr();};
App._crmSaveGlobalSettings=async()=>{if(!can('crm','manage'))return toast('No permission','err');var nl=_crmChecked('crmgs-notify-');_crmGroups().forEach(function(g){var el=document.getElementById('crmgs-notify-grp-'+g.id);if(el&&el.checked)nl.push('grp:'+g.id);});var email=!!(document.getElementById('crmgs-email')||{}).checked;CRM.settings=Object.assign({},CRM.settings,{notify:{list:nl},email:{created:email,approval:email,decided:email,mention:email}});CRM.globalSettingsOpen=false;toast('Workspace defaults saved ✓');rr();try{await sb.from('workspace_settings').upsert({key:'crm_settings',value:CRM.settings},{onConflict:'key'});}catch(e){}};
function _crmModals(){var out='';var convo=_crmConvo(CRM.sel.convoId);
  if(CRM.boardMembersOpen){var _b=_crmBoard(CRM.sel.boardId);var _draft=CRM._boardDraft||((_b&&_b.members)||[]);var _bm=_draft.map(function(id){return uById(id);}).filter(Boolean);var _bnm=(DB.users||[]).filter(function(u){return u&&u.status!=='Disabled'&&_draft.indexOf(u.id)<0;});out+='<div style="position:fixed;inset:0;z-index:97;background:rgba(0,0,0,.28);display:grid;place-items:center" onclick="App._crmBoardMembersCancel()"><div onclick="event.stopPropagation()" style="background:#fff;border-radius:16px;width:430px;max-width:94vw;max-height:86vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.3)"><div class="fd" style="padding:15px 20px;border-bottom:1px solid #EDE7DC;font-weight:800;font-size:15px">Board members — '+esc(_b?_b.name:'')+'</div><div style="padding:8px 20px;font-size:12px;color:#796B60;border-bottom:1px solid #F6F3EE;line-height:1.5">People added here can open <b>this board</b>. (Filtered views have their own people — assigned when the view is created.)</div><div class="crm-scroll" style="overflow-y:auto;padding:8px 14px;flex:1">'+(_bm.length?_bm.map(function(u){return'<div style="display:flex;align-items:center;gap:8px;padding:6px 4px"><span>'+avatar(u,'w-7 h-7','text-[9px]')+'</span><span style="font-size:13px;font-weight:600;color:#13171B;flex:1">'+esc(fullName(u))+'</span><button title="Remove from board" onclick="App._crmRemoveMember(\''+u.id+'\')" style="border:none;background:#FAEDE8;color:#B3402E;width:24px;height:24px;border-radius:7px;cursor:pointer;display:grid;place-items:center">'+ic('x','w-3.5 h-3.5')+'</button></div>';}).join(''):'<div style="padding:10px 4px;font-size:12.5px;color:#796B60">No members yet — add people below so they can see this board.</div>')+'<div style="height:1px;background:#F4F0E9;margin:8px 0"></div><div style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#796B60;padding:2px 4px 6px">Add to this board</div>'+_crmGroupAddRows(_draft,'App._crmAddGroupToBoard')+(_bnm.length?_bnm.slice(0,80).map(function(u){return'<button onclick="App._crmAddMember(\''+u.id+'\')" style="width:100%;text-align:left;display:flex;align-items:center;gap:8px;padding:6px 4px;border:none;background:transparent;border-radius:8px;cursor:pointer" onmouseover="this.style.background=\'#FAF7F1\'" onmouseout="this.style.background=\'transparent\'">'+avatar(u,'w-7 h-7','text-[9px]')+'<span style="font-size:13px;font-weight:600;color:#13171B">'+esc(fullName(u))+'</span></button>';}).join(''):'<div style="padding:8px 4px;font-size:12px;color:#796B60">Everyone already has access.</div>')+'</div><div style="padding:12px 20px;border-top:1px solid #EDE7DC;display:flex;justify-content:flex-end;gap:8px"><button onclick="App._crmBoardMembersCancel()" style="padding:9px 16px;border:1px solid #E6DED3;background:#fff;color:#3A312A;border-radius:10px;font-weight:600;cursor:pointer">Cancel</button><button onclick="App._crmBoardMembersSave()" style="padding:9px 18px;border:none;background:#13171B;color:#fff;border-radius:10px;font-weight:700;cursor:pointer">Save changes</button></div></div></div>';}
  if(CRM.activityOpen&&convo){var items=_crmActFor(convo.id);out+='<div style="position:fixed;top:0;right:0;bottom:0;width:340px;max-width:92vw;z-index:90;background:#fff;border-left:1px solid #EDE7DC;box-shadow:-8px 0 30px rgba(35,28,22,.10);display:flex;flex-direction:column"><div style="padding:13px 16px;border-bottom:1px solid #EDE7DC;display:flex;align-items:center;justify-content:space-between"><span style="font-weight:800;font-size:14px">Activity</span><button onclick="App._crmTogActivity()" style="border:none;background:transparent;cursor:pointer;color:#A59788">'+ic('x','w-4 h-4')+'</button></div><div class="crm-scroll" style="flex:1;overflow-y:auto;padding:10px 12px">'+(items.length?items.map(function(a){var u=a.actor&&uById(a.actor)?fullName(uById(a.actor)):'System';return'<div style="display:flex;gap:9px;padding:9px 4px;border-bottom:1px solid #F6F2ED"><div style="margin-top:1px">'+(a.actor&&uById(a.actor)?avatar(uById(a.actor),'w-6 h-6','text-[9px]'):_crmCustAv('S',24))+'</div><div style="min-width:0"><div style="font-size:12.5px;color:#13171B;line-height:1.4"><b>'+esc(u)+'</b> '+esc(a.action)+(a.detail?' <span style="color:#786A5F">— '+esc(a.detail)+'</span>':'')+'</div><div style="font-size:10.5px;color:#A8998A;margin-top:1px">'+_crmDT(a.at)+'</div></div></div>';}).join(''):'<div style="padding:22px;text-align:center;color:#A59788;font-size:12.5px">No activity recorded yet.</div>')+'</div></div>';}
  if(CRM.boardSettingsOpen){var b=_crmBoard(CRM._bsBoardId||CRM.sel.boardId);var bs=(b&&b.settings)||{};var nt=bs.notify||{};var _uu=_crmBoardPeople(b);var _gg=_crmGroups();var _ul=function(ev){var h=_gg.length?'<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#A59788;padding:2px">Groups</div>'+_gg.map(function(g){return'<label style="display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:700;cursor:pointer;padding:3px 2px"><input type="checkbox" id="crmn-'+ev+'-grp-'+g.id+'" '+(((nt[ev]||[]).indexOf('grp:'+g.id)>=0)?'checked':'')+'/>'+esc(g.name)+' <span style="font-weight:600;color:#A59788;font-size:11px">('+((g.members||[]).length)+')</span></label>';}).join('')+'<div style="height:1px;background:#F1ECE4;margin:4px 0"></div>':'';return h+(_uu.length?_uu.map(function(u){return'<label style="display:flex;align-items:center;gap:8px;font-size:12.5px;cursor:pointer;padding:3px 2px"><input type="checkbox" id="crmn-'+ev+'-'+u.id+'" '+(((nt[ev]||[]).indexOf(u.id)>=0)?'checked':'')+'/>'+esc(fullName(u))+'</label>';}).join(''):'<div style="font-size:12px;color:#A59788;padding:4px">No members on this board yet — add board or channel members first.</div>');};out+='<div style="position:fixed;inset:0;z-index:95;background:rgba(0,0,0,.28);display:grid;place-items:center" onclick="App._crmTogBoardSettings()"><div onclick="event.stopPropagation()" style="background:#fff;border-radius:16px;width:440px;max-width:94vw;max-height:88vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.3)"><div style="padding:15px 20px;border-bottom:1px solid #EDE7DC;font-weight:800;font-size:15px">Board rules — '+esc(b?b.name:'')+'</div><div style="padding:8px 20px;font-size:12px;color:#A59788;border-bottom:1px solid #F6F2ED">Selected people get an <b>email + in-app</b> notification for each event on this board.</div><div class="crm-scroll" style="overflow-y:auto;padding:14px 20px;display:flex;flex-direction:column;gap:14px"><div><div style="font-size:12px;font-weight:800;color:#3A312A;margin-bottom:5px">Ticket moved here</div><div style="max-height:120px;overflow:auto;border:1px solid #F1ECE4;border-radius:8px;padding:6px">'+_ul('moved')+'</div></div><div><div style="font-size:12px;font-weight:800;color:#3A312A;margin-bottom:5px">Ticket approved</div><div style="max-height:120px;overflow:auto;border:1px solid #F1ECE4;border-radius:8px;padding:6px">'+_ul('approved')+'</div></div><div><div style="font-size:12px;font-weight:800;color:#3A312A;margin-bottom:5px">Ticket rejected</div><div style="max-height:120px;overflow:auto;border:1px solid #F1ECE4;border-radius:8px;padding:6px">'+_ul('rejected')+'</div></div></div><div style="padding:14px 20px;border-top:1px solid #EDE7DC;display:flex;justify-content:flex-end;gap:8px"><button onclick="App._crmTogBoardSettings()" style="padding:9px 16px;border:1px solid #E6DED3;background:#fff;border-radius:10px;font-weight:600;cursor:pointer">Cancel</button><button onclick="App._crmSaveBoardSettings()" style="padding:9px 16px;border:none;background:#13171B;color:#fff;border-radius:10px;font-weight:700;cursor:pointer">Save rules</button></div></div></div>';}
  
  if(CRM.globalSettingsOpen){var allU=(DB.users||[]).filter(function(u){return u&&u.status!=='Disabled';});var gl=(CRM.settings&&CRM.settings.notify&&CRM.settings.notify.list)||[];var ge=!(CRM.settings&&CRM.settings.email&&CRM.settings.email.created===false);
    out+='<div style="position:fixed;inset:0;z-index:96;background:rgba(0,0,0,.28);display:grid;place-items:center" onclick="App._crmTogGlobalSettings()"><div onclick="event.stopPropagation()" style="background:#fff;border-radius:16px;width:420px;max-width:94vw;max-height:88vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.3)"><div style="padding:16px 20px;border-bottom:1px solid #EDE7DC;font-weight:800;font-size:15px">Workspace notification defaults</div><div class="crm-scroll" style="overflow-y:auto;padding:18px 20px;display:flex;flex-direction:column;gap:14px"><div style="font-size:12px;color:#A59788">These people are notified for Workspace ticket events on <b>every</b> board, in addition to each board’s own list.</div><div style="display:flex;flex-direction:column;gap:3px;max-height:200px;overflow:auto;border:1px solid #F1ECE4;border-radius:8px;padding:6px">'+(_crmGroups().length?'<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#A59788;padding:2px">Groups</div>'+_crmGroups().map(function(g){return'<label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;cursor:pointer"><input type="checkbox" id="crmgs-notify-grp-'+g.id+'" '+(gl.indexOf('grp:'+g.id)>=0?'checked':'')+'/>'+esc(g.name)+' <span style="font-weight:600;color:#A59788;font-size:11px">('+((g.members||[]).length)+')</span></label>';}).join('')+'<div style="height:1px;background:#F1ECE4;margin:5px 0"></div>':'')+allU.map(function(u){return'<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer"><input type="checkbox" id="crmgs-notify-'+u.id+'" '+(gl.indexOf(u.id)>=0?'checked':'')+'/>'+esc(fullName(u))+'</label>';}).join('')+'</div><label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;cursor:pointer"><input type="checkbox" id="crmgs-email" '+(ge?'checked':'')+'/>Also send email for Workspace events</label></div><div style="padding:14px 20px;border-top:1px solid #EDE7DC;display:flex;justify-content:flex-end;gap:8px"><button onclick="App._crmTogGlobalSettings()" style="padding:9px 16px;border:1px solid #E6DED3;background:#fff;border-radius:10px;font-weight:600;cursor:pointer">Cancel</button><button onclick="App._crmSaveGlobalSettings()" style="padding:9px 16px;border:none;background:#13171B;color:#fff;border-radius:10px;font-weight:700;cursor:pointer">Save defaults</button></div></div></div>';}
  return out;}

/* (v3.12: the channel layer was removed — boards live directly on hubs; access = board members + filtered views) */
/* ── Add a whole people-group to a board in one tap ── */
function _crmGroupAddRows(existing,handler){var ex={};(existing||[]).forEach(function(id){ex[id]=1;});var gs=_crmGroups().map(function(g){var add=(g.members||[]).filter(function(id){var u=uById(id);return u&&u.status!=='Disabled'&&!ex[id];}).length;return{g:g,add:add};}).filter(function(x){return x.add>0;});if(!gs.length)return'';
  return'<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#796B60;padding:2px 4px 4px">Add a whole group</div>'+gs.map(function(x){return'<button onclick="'+handler+'(\''+x.g.id+'\')" title="Adds every member of this group" style="width:100%;text-align:left;display:flex;align-items:center;gap:8px;padding:6px 4px;border:none;background:transparent;border-radius:8px;cursor:pointer" onmouseover="this.style.background=\'#FAF7F1\'" onmouseout="this.style.background=\'transparent\'"><span style="width:28px;height:28px;border-radius:9px;background:#EEE4D5;color:#54433C;display:grid;place-items:center;flex-shrink:0">'+ic('users','w-3.5 h-3.5')+'</span><span style="font-size:13px;font-weight:700;color:#13171B;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(x.g.name)+'</span><span style="font-size:11px;font-weight:800;color:#54433C;background:#EEE4D5;border-radius:8px;padding:2px 8px;flex-shrink:0">+ '+x.add+'</span></button>';}).join('')+'<div style="height:1px;background:#F4F0E9;margin:8px 0"></div>';}
App._crmAddGroupToBoard=(gid)=>{if(!_crmCanBoardMembers())return toast('No permission','err');var g=_crmGroup(gid);if(!g)return;CRM._boardDraft=CRM._boardDraft||[];var add=(g.members||[]).filter(function(id){var u=uById(id);return u&&u.status!=='Disabled'&&CRM._boardDraft.indexOf(id)<0;});if(!add.length)return toast('Everyone in \u201C'+g.name+'\u201D is already on this board');add.forEach(function(id){CRM._boardDraft.push(id);});rr();toast('Added '+add.length+' from \u201C'+g.name+'\u201D — press Save to apply');};

App._crmMobNav=(open)=>{
  var n=document.querySelector('.crm-nav'),sc=document.querySelector('.crm-scrim');
  if(!n)return;
  var willOpen=(open===undefined)?!n.classList.contains('crmopen'):!!open;
  n.classList.toggle('crmopen',willOpen);
  if(sc)sc.classList.toggle('on',willOpen);
};
/* Message actions on touch: tap a message to reveal its bar, tap anywhere else to dismiss.
   Previously the bar was pinned open on every message and never went away after sending. */
App._crmMsgActs=(e,el)=>{
  if(window.matchMedia&&!window.matchMedia('(max-width:767px)').matches)return;   // desktop keeps hover
  var t=e&&e.target;
  if(t&&t.closest&&(t.closest('.crm-macts')||t.closest('button')||t.closest('a')||t.closest('input')||t.closest('textarea')))return;
  var on=el.classList.contains('crm-actopen');
  document.querySelectorAll('.crm-msg.crm-actopen').forEach(function(m){m.classList.remove('crm-actopen');});
  if(!on)el.classList.add('crm-actopen');
  if(e&&e.stopPropagation)e.stopPropagation();
};
App._crmCloseMsgActs=()=>{document.querySelectorAll('.crm-msg.crm-actopen').forEach(function(m){m.classList.remove('crm-actopen');});};
/* Ticket details as a bottom sheet on small screens. */
App._crmMobDetails=(open)=>{CRM._mobDetails=(open===undefined)?!CRM._mobDetails:!!open;rr();};
if(!window._crmActsBound){
  window._crmActsBound=true;
  document.addEventListener('click',function(e){
    if(e.target&&e.target.closest&&e.target.closest('.crm-msg'))return;
    App._crmCloseMsgActs();
  },true);
  window.addEventListener('resize',function(){App._crmCloseMsgActs();});
}
App._crmMobBack=()=>{App._crmCloseMsgActs();CRM._mobDetails=false;CRM.sel.convoId=null;CRM.sel.threadId=null;rr();};

App._crmTogMove=()=>{var d=document.getElementById('crm-move');if(d)d.style.display=d.style.display==='none'?'block':'none';};

/* ═════════ v3.12: FILTER ENGINE — every built-in field + every custom column is filterable.
   Used by: filtered views (saved, member-scoped) AND the ad-hoc board Filter button. ═════════ */
function _crmFilterFields(board){
  var f=[
    {id:'_status',name:'Status',type:'_status'},
    {id:'_assignee',name:'Assignee',type:'_assignee'},
    {id:'_priority',name:'Priority',type:'_priority'},
    {id:'_customer',name:'Customer',type:'text'},
    {id:'_title',name:'Ticket title',type:'text'},
    {id:'_due',name:'Due date',type:'date'}
  ];
  (((board&&board.settings)||{}).columns||[]).forEach(function(c){if(c.type==='remind')return;f.push({id:c.id,name:c.name,type:c.type,options:c.options||[]});});
  return f;
}
function _crmFOps(t){
  var TXT=[['contains','contains'],['equals','equals'],['set','is filled'],['empty','is empty']];
  var NUM=[['eq','= equals'],['gt','> greater than'],['lt','< less than'],['between','between (range)'],['set','is filled'],['empty','is empty']];
  var DTE=[['on','on date'],['before','before'],['after','after'],['daterange','between (range)'],['past','date has passed'],['set','is filled'],['empty','is empty']];
  return t==='_status'||t==='_assignee'||t==='_priority'||t==='dropdown'||t==='person'?[['in','is any of'],['set','is filled'],['empty','is empty']]
    :t==='number'||t==='currency'?NUM
    :t==='date'?DTE
    :t==='time'?[['equals','equals'],['daterange','between (range)'],['set','is filled'],['empty','is empty']]
    :t==='checkbox'?[['checked','is checked'],['unchecked','is not checked']]
    :TXT;
}
function _crmFieldVal(c,fid){
  if(fid==='_status')return c.status||'Open';
  if(fid==='_assignee')return c.assignedTo||(c.assignedGroup?'grp:'+c.assignedGroup:'');
  if(fid==='_priority')return c.priority||'Medium';
  if(fid==='_customer')return c.customer||'';
  if(fid==='_title')return c.title||'';
  if(fid==='_due')return c.dueDate||'';
  return (c.fields||{})[fid];
}
function _crmFMatch(c,f){
  var v=_crmFieldVal(c,f.field);var op=f.op||'contains';var fv=f.value;
  var s=(v==null)?'':String(v);
  if(op==='in'){var arr=Array.isArray(fv)?fv:(fv?[fv]:[]);return arr.length?arr.indexOf(s)>=0:true;}
  if(op==='set')return s.trim()!=='';
  if(op==='empty')return s.trim()==='';
  if(op==='contains')return s.toLowerCase().indexOf(String(fv||'').toLowerCase())>=0;
  if(op==='equals')return s===String(fv||'');
  if(op==='eq')return parseFloat(s)===parseFloat(fv);
  if(op==='gt')return parseFloat(s)>parseFloat(fv);
  if(op==='lt')return parseFloat(s)<parseFloat(fv);
  if(op==='between'){var ba=Array.isArray(fv)?fv:[];var lo=parseFloat(ba[0]),hi=parseFloat(ba[1]);if(s.trim()==='')return false;var nv=parseFloat(s);if(!isFinite(nv))return false;if(isFinite(lo)&&nv<lo)return false;if(isFinite(hi)&&nv>hi)return false;return true;}
  if(op==='daterange'){var da=Array.isArray(fv)?fv:[];var dlo=da[0]||'',dhi=da[1]||'';if(!s)return false;if(dlo&&s<dlo)return false;if(dhi&&s>dhi)return false;return true;}
  if(op==='on')return s===String(fv||'');
  if(op==='before')return !!s&&s<String(fv||'');
  if(op==='after')return !!s&&s>String(fv||'');
  if(op==='past')return !!s&&s<todayISO();
  if(op==='checked')return s==='1'||s==='true';
  if(op==='unchecked')return !(s==='1'||s==='true');
  return true;
}
function _crmApplyFilters(rows,filters){if(!filters||!filters.length)return rows;return rows.filter(function(c){return filters.every(function(f){try{return f&&f.field?_crmFMatch(c,f):true;}catch(e){return true;}});});}
/* ── Filter builder UI — mutates the CRM._fDraft array; CRM._fRerender re-renders the host modal ── */
function _crmFValueUI(board,f,i){
  var fields=_crmFilterFields(board);var fd=fields.find(function(x){return x.id===f.field;})||fields[0];
  var ops=_crmFOps(fd.type);if(!ops.some(function(o){return o[0]===f.op;}))f.op=ops[0][0];
  if(['set','empty','checked','unchecked','past'].indexOf(f.op)>=0)return'';
  if(f.op==='between'||f.op==='daterange'){
    var ra=Array.isArray(f.value)&&f.value.length===2?f.value:['',''];
    var it2=(fd.type==='number'||fd.type==='currency')?'number':(fd.type==='time'?'time':'date');
    return'<div style="display:flex;gap:8px;align-items:center;margin-top:6px">'
      +'<input type="'+it2+'" value="'+esc(ra[0]!=null?ra[0]:'')+'" oninput="App._crmFRange('+i+',0,this.value)" placeholder="from" class="ui-input" style="flex:1;min-height:34px;padding:6px 9px;font-size:12.5px"/>'
      +'<span style="color:#A59788;font-size:12px;flex-shrink:0">\u2192</span>'
      +'<input type="'+it2+'" value="'+esc(ra[1]!=null?ra[1]:'')+'" oninput="App._crmFRange('+i+',1,this.value)" placeholder="to" class="ui-input" style="flex:1;min-height:34px;padding:6px 9px;font-size:12.5px"/>'
    +'</div>'
    +'<div style="font-size:10.5px;color:#A8998A;margin-top:4px">Leave one side empty for an open range \u2014 e.g. only \u201cfrom\u201d = everything above it.</div>';
  }
  if(f.op==='in'){
    var choices=[];
    if(fd.type==='_status'){choices=_crmStatuses(board).map(function(s){return[s.name,s.name];});}
    else if(fd.type==='_priority'){choices=['Low','Medium','High','Critical'].map(function(p){return[p,p];});}
    else if(fd.type==='_assignee'){choices=[['','(Unassigned)']].concat(_crmBoardGroups(board).map(function(g){return['grp:'+g.id,'\u{1F465} '+g.name];})).concat(_crmBoardPeople(board).map(function(u){return[u.id,fullName(u)];}));}
    else if(fd.type==='person'){choices=_crmBoardPeople(board).map(function(u){return[u.id,fullName(u)];});}
    else{choices=(fd.options||[]).map(function(o){return[String(o),String(o)];});}
    var sel=Array.isArray(f.value)?f.value:[];
    return'<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:6px">'+(choices.length?choices.map(function(ch){var on=sel.indexOf(ch[0])>=0;return'<button type="button" onclick="App._crmFValTog('+i+',\''+String(ch[0]).replace(/'/g,"\\'")+'\')" style="padding:4px 11px;border-radius:20px;border:1.5px solid '+(on?'#54433C':'#E6DED3')+';background:'+(on?'#EEE4D5':'#fff')+';color:'+(on?'#3E322B':'#786A5F')+';font-size:11.5px;font-weight:700;cursor:pointer">'+esc(ch[1])+'</button>';}).join(''):'<span style="font-size:11.5px;color:#A59788">No options for this field.</span>')+'</div>';
  }
  var it=(fd.type==='number'||fd.type==='currency')?'number':fd.type==='date'?'date':fd.type==='time'?'time':'text';
  return'<input type="'+it+'" value="'+esc(f.value!=null&&!Array.isArray(f.value)?f.value:'')+'" oninput="CRM._fDraft['+i+'].value=this.value" placeholder="value" class="ui-input" style="margin-top:6px;min-height:34px;padding:6px 9px;font-size:12.5px"/>';
}
function _crmFilterBuilderHTML(board,filters){
  var fields=_crmFilterFields(board);
  var rows=(filters||[]).map(function(f,i){
    var fd=fields.find(function(x){return x.id===f.field;})||fields[0];if(!f.field)f.field=fd.id;
    var ops=_crmFOps(fd.type);if(!ops.some(function(o){return o[0]===f.op;}))f.op=ops[0][0];
    return'<div style="border:1px solid var(--c-border);border-radius:11px;padding:9px 10px;margin-bottom:8px;background:#fff">'
      +'<div style="display:flex;gap:7px;align-items:center">'
      +'<select onchange="App._crmFField('+i+',this.value)" class="ui-select" style="flex:1;min-height:34px;padding:5px 26px 5px 9px;font-size:12.5px">'+fields.map(function(x){return'<option value="'+esc(x.id)+'" '+(x.id===f.field?'selected':'')+'>'+esc(x.name)+'</option>';}).join('')+'</select>'
      +'<select onchange="App._crmFOp('+i+',this.value)" class="ui-select" style="flex:1;min-height:34px;padding:5px 26px 5px 9px;font-size:12.5px">'+ops.map(function(o){return'<option value="'+o[0]+'" '+(o[0]===f.op?'selected':'')+'>'+o[1]+'</option>';}).join('')+'</select>'
      +'<button type="button" onclick="App._crmFDel('+i+')" title="Remove condition" style="width:30px;height:30px;border:none;border-radius:8px;background:var(--c-danger-soft);color:var(--c-danger);cursor:pointer;display:grid;place-items:center;flex-shrink:0">'+ic('x','w-3.5 h-3.5')+'</button>'
      +'</div>'+_crmFValueUI(board,f,i)+'</div>';
  }).join('');
  return (rows||'<div style="padding:14px;text-align:center;color:var(--c-text-3);font-size:12px;border:1.5px dashed var(--c-border);border-radius:11px;margin-bottom:8px">No conditions yet — everything matches. Add one below.</div>')
    +'<button type="button" onclick="App._crmFAdd()" class="ui-btn ui-btn-ghost ui-btn-sm">+ Add condition</button>'
    +'<div style="font-size:11px;color:var(--c-text-3);margin-top:6px">A ticket shows only when it matches <b>all</b> conditions.</div>';
}
App._crmFRr=()=>{try{var fn=CRM._fRerender;if(typeof fn==='function')fn();}catch(e){}};
App._crmFField=(i,v)=>{var f=CRM._fDraft&&CRM._fDraft[i];if(!f)return;f.field=v;f.op=null;f.value=null;App._crmFRr();};
App._crmFOp=(i,v)=>{var f=CRM._fDraft&&CRM._fDraft[i];if(!f)return;f.op=v;f.value=(v==='in')?[]:((v==='between'||v==='daterange')?['','']:null);App._crmFRr();};
App._crmFRange=(i,k,v)=>{var f=CRM._fDraft&&CRM._fDraft[i];if(!f)return;if(!Array.isArray(f.value)||f.value.length!==2)f.value=['',''];f.value[k]=v;};
App._crmFValTog=(i,v)=>{var f=CRM._fDraft&&CRM._fDraft[i];if(!f)return;var a=Array.isArray(f.value)?f.value.slice():[];var k=a.indexOf(v);if(k>=0)a.splice(k,1);else a.push(v);f.value=a;App._crmFRr();};
App._crmFAdd=()=>{if(!CRM._fDraft)CRM._fDraft=[];CRM._fDraft.push({field:'_status',op:'in',value:[]});App._crmFRr();};
App._crmFDel=(i)=>{if(CRM._fDraft)CRM._fDraft.splice(i,1);App._crmFRr();};
/* ── Ad-hoc board filter (session-only) — “all columns can be filtered” on any board ── */
App._crmBoardFilter=(boardId)=>{
  var b=_crmBoard(boardId);if(!b)return;
  CRM._fDraft=JSON.parse(JSON.stringify((CRM.boardFilter||{})[boardId]||[]));
  CRM._fBoard=boardId;
  CRM._fRerender=App._crmBoardFilterRender;
  App._crmBoardFilterRender();
};
App._crmBoardFilterRender=()=>{
  var b=_crmBoard(CRM._fBoard);if(!b)return;
  modalShell({title:'Filter — '+esc(b.name),sub:'Show only the tickets matching these conditions. Every column can be filtered.',size:'max-w-md',key:'crm-filter',
    body:_crmFilterBuilderHTML(b,CRM._fDraft),
    footer:((CRM.boardFilter||{})[CRM._fBoard]||[]).length?'<button onclick="App._crmBoardFilterClear()" class="ui-btn ui-btn-ghost ui-btn-md" style="margin-right:auto">Clear filter</button>':''
      +btnG('Cancel','App.closeModal()')+btnP('Apply','App._crmBoardFilterApply()')});
};
App._crmBoardFilterApply=()=>{if(!CRM.boardFilter)CRM.boardFilter={};CRM.boardFilter[CRM._fBoard]=(CRM._fDraft||[]).filter(function(f){return f&&f.field;});closeModal();rr();};
App._crmBoardFilterClear=()=>{if(CRM.boardFilter)delete CRM.boardFilter[CRM._fBoard];closeModal();rr();};
/* ── Filtered-view CRUD (permission: crm → views) ── */
App._crmNewView=(hubId)=>{
  if(!can('crm','views'))return toast('You need the Workspace → Filtered views permission','err');
  if(!_crmHub(hubId))return;
  CRM._viewEdit={id:uid('view'),hubId:hubId,name:'',members:[],filters:{},_new:true};
  App._crmViewEditRender();
};
App._crmEditView=(id)=>{
  var v=_crmView(id);if(!v)return;
  if(!_crmViewCanEdit(v))return toast('Only the view\'s creator (with the Filtered views permission) can edit it','err');
  CRM._viewEdit=JSON.parse(JSON.stringify(v));delete CRM._viewEdit._new;
  App._crmViewEditRender();
};
App._crmViewTogM=(uid2)=>{var d=CRM._viewEdit;if(!d)return;d.members=d.members||[];var i=d.members.indexOf(uid2);if(i>=0)d.members.splice(i,1);else d.members.push(uid2);var el=document.getElementById('crm-view-cnt');if(el)el.textContent=_crmExpandPeople(d.members).length;};
App._crmViewEditRender=()=>{
  var d=CRM._viewEdit;if(!d)return;
  var h=_crmHub(d.hubId);
  var us=(DB.users||[]).filter(function(u){return u&&u.status!=='Disabled';}).sort(function(a,b2){return fullName(a).localeCompare(fullName(b2));});
  var hbs=CRM.boards.filter(function(b2){return b2.hubId===d.hubId;});
  var hid=_crmViewHidden(d);
  /* v3.15: boards are picked (and their filters set) right here — at creation AND when editing. */
  var boardRows=hbs.length?hbs.map(function(b2){
    var isChat=_crmBS(b2).type==='chat';
    var on=hid.indexOf(b2.id)<0;
    var conds=(!isChat&&d.filters&&!Array.isArray(d.filters)&&Array.isArray(d.filters[b2.id]))?d.filters[b2.id].filter(function(f){return f&&f.field;}):[];
    var brws=CRM.convos.filter(function(c){return c.boardId===b2.id;});
    var all=brws.length;var match=conds.length?_crmApplyFilters(brws,conds).length:all;
    return'<div style="display:flex;align-items:center;gap:9px;padding:8px 10px;border:1px solid '+(on?'#E4DBCF':'#F2EEE6')+';border-radius:11px;margin-bottom:7px;background:'+(on?'#fff':'#FBF9F6')+'">'
      +'<label style="display:flex;align-items:center;gap:9px;flex:1;min-width:0;cursor:pointer'+(on?'':';opacity:.55')+'">'
      +'<input type="checkbox" '+(on?'checked':'')+' onchange="App._crmViewTogBoard(\''+b2.id+'\')" style="width:16px;height:16px;accent-color:#54433C;cursor:pointer;flex-shrink:0"/>'
      +'<span style="color:'+(on?'#54433C':'#A8998A')+';display:grid;place-items:center;flex-shrink:0">'+ic(isChat?'msg':'ticket','w-4 h-4')+'</span>'
      +'<span style="min-width:0;flex:1"><span style="display:block;font-size:12.5px;font-weight:700;color:#13171B;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(b2.name)+'</span>'
      +'<span style="display:block;font-size:10.5px;color:#A8998A">'+(isChat?'Chat — shown as-is, chats aren’t filtered':(conds.length?(match+' of '+all+' tickets match the filter'):(all+' ticket'+(all===1?'':'s')+' · no filter yet')))+'</span></span>'
      +'</label>'
      +(!isChat&&on?'<button type="button" onclick="App._crmViewEditFilter(\''+b2.id+'\')" title="Set this board’s saved filter for the view — every column is filterable" style="display:inline-flex;align-items:center;gap:5px;padding:6px 11px;border-radius:8px;border:1.5px solid '+(conds.length?'#7F6533':'#E6DED3')+';background:'+(conds.length?'#F2E9D4':'#fff')+';color:'+(conds.length?'#7F6533':'#786A5F')+';font-size:11.5px;font-weight:700;cursor:pointer;flex-shrink:0">'+ic('filter','w-3 h-3')+(conds.length?('Filter · '+conds.length):'Set filter')+'</button>':'')
    +'</div>';
  }).join(''):'<div style="padding:14px;text-align:center;color:var(--c-text-3);font-size:12px;border:1.5px dashed var(--c-border);border-radius:11px;margin-bottom:7px">This hub has no boards yet — the view will pick them up as they’re created.</div>';
  modalShell({title:(d._new?'New filtered view':'Edit view')+(h?' — '+esc(h.name):''),sub:'Pick which of '+(h?esc(h.name):'the hub')+'’s boards this view shows, set each board’s saved filter, and choose who can open it. Everything done inside the view updates the real boards.',size:'max-w-lg',key:'crm-view',
    body:'<label class="ui-label">View name</label><input value="'+esc(d.name||'')+'" oninput="CRM._viewEdit.name=this.value" placeholder="e.g. Night shift — open tickets" class="ui-input" style="margin-bottom:14px"/>'
      +'<label class="ui-label">Boards in this view ('+(hbs.length-hid.length)+' of '+hbs.length+')</label>'
      +'<div style="max-height:232px;overflow:auto;margin-bottom:4px;padding-right:2px">'+boardRows+'</div>'
      +'<div style="font-size:11px;color:var(--c-text-3);margin:0 0 14px">Unticking removes a board from <b>this view only</b> — the board and its tickets are never touched. Filters can also be changed later from inside the view.</div>'
      +'<label class="ui-label">Who can see this view (<span id="crm-view-cnt">'+_crmExpandPeople(d.members||[]).length+'</span> people)</label>'
      +'<input placeholder="Search people…" oninput="var q=this.value.toLowerCase();document.querySelectorAll(\'.crm-vw-row\').forEach(function(r){r.style.display=(r.getAttribute(\'data-n\')||\'\').indexOf(q)>=0?\'flex\':\'none\';})" class="ui-input" style="margin-bottom:8px"/>'
      +'<div style="max-height:190px;overflow:auto;border:1px solid var(--c-border);border-radius:10px;padding:6px">'+(_crmGroups().length?'<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--c-text-3);padding:2px 2px 4px">Groups</div>'+_crmGroups().map(function(g){return'<label class="crm-vw-row" data-n="'+esc((g.name+' group').toLowerCase())+'" style="display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:700;padding:3px 2px;cursor:pointer"><input type="checkbox" '+(((d.members||[]).indexOf('grp:'+g.id)>=0)?'checked':'')+' onchange="App._crmViewTogM(\'grp:'+g.id+'\')"/><span style="width:20px;height:20px;border-radius:50%;background:#EEE4D5;color:#3E322B;display:inline-grid;place-items:center;flex-shrink:0">'+ic('users','w-3 h-3')+'</span>'+esc(g.name)+' <span style="font-weight:600;color:var(--c-text-3);font-size:11px">('+((g.members||[]).length)+')</span></label>';}).join('')+'<div style="height:1px;background:var(--c-border);margin:5px 0"></div><div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--c-text-3);padding:2px 2px 4px">People</div>':'')+us.map(function(u){return'<label class="crm-vw-row" data-n="'+esc(fullName(u).toLowerCase())+'" style="display:flex;align-items:center;gap:8px;font-size:12.5px;padding:3px 2px;cursor:pointer"><input type="checkbox" '+(((d.members||[]).indexOf(u.id)>=0)?'checked':'')+' onchange="App._crmViewTogM(\''+u.id+'\')"/>'+avatar(u,'w-5 h-5','text-[8px]')+esc(fullName(u))+(u.id===S.uid?' <span style="font-size:10px;color:var(--c-text-3)">(you)</span>':'')+'</label>';}).join('')+'</div>'
      +'<div style="font-size:11px;color:var(--c-text-3);margin-top:6px">You (the creator) and Workspace managers always see it. Assigned people & groups see the boards you keep in this view — filtered — even if they are not members of those boards. A group here means <b>whoever is in the group at the time</b>: edit the group and the view follows.</div>',
    footer:(d._new?'':'<button onclick="App._crmDelView(\''+d.id+'\')" class="ui-btn ui-btn-danger ui-btn-sm" style="margin-right:auto">Delete view</button>')+btnG('Cancel','App.closeModal()')+btnP(d._new?'Create view':'Save view','App._crmViewSave()')});
};
/* Tick / untick a board in the dialog. Hidden ids live under filters._hidden on the DRAFT —
   nothing is written until Create/Save. Conditions of an unticked board are kept on the draft
   (re-ticking restores them) and stripped on save. */
App._crmViewTogBoard=(boardId)=>{
  var d=CRM._viewEdit;if(!d)return;
  if(!d.filters||Array.isArray(d.filters))d.filters={};
  var h=Array.isArray(d.filters[_CRM_VHIDE])?d.filters[_CRM_VHIDE].slice():[];
  var i=h.indexOf(boardId);
  if(i>=0)h.splice(i,1);else h.push(boardId);
  if(h.length)d.filters[_CRM_VHIDE]=h;else delete d.filters[_CRM_VHIDE];
  App._crmViewEditRender();
};
/* Per-board filter page INSIDE the view dialog (create & edit) — reuses the shared condition builder. */
App._crmViewEditFilter=(boardId)=>{
  var d=CRM._viewEdit;if(!d)return;var b=_crmBoard(boardId);if(!b)return;
  CRM._vefBoard=boardId;
  CRM._fDraft=JSON.parse(JSON.stringify((d.filters&&!Array.isArray(d.filters)&&Array.isArray(d.filters[boardId]))?d.filters[boardId]:[]));
  CRM._fRerender=App._crmViewEditFilterRender;
  App._crmViewEditFilterRender();
};
App._crmViewEditFilterRender=()=>{
  var d=CRM._viewEdit;var b=_crmBoard(CRM._vefBoard);if(!d||!b)return;
  modalShell({title:'Filter — '+esc(b.name),sub:'Part of “'+esc((d.name||'').trim()||'this view')+'” — stored when you '+(d._new?'create':'save')+' the view. Every column is filterable.',size:'max-w-md',key:'crm-view',
    body:_crmFilterBuilderHTML(b,CRM._fDraft),
    footer:((CRM._fDraft||[]).length?'<button onclick="CRM._fDraft=[];App._crmFRr()" class="ui-btn ui-btn-ghost ui-btn-md" style="margin-right:auto">Clear</button>':'')+btnG('← Back','App._crmViewEditFilterBack()')+btnP('Done','App._crmViewEditFilterDone()')});
};
App._crmViewEditFilterBack=()=>{CRM._vefBoard=null;CRM._fDraft=null;CRM._fRerender=null;App._crmViewEditRender();};
App._crmViewEditFilterDone=()=>{
  var d=CRM._viewEdit;if(!d)return;
  var conds=(CRM._fDraft||[]).filter(function(f){return f&&f.field;});
  if(!d.filters||Array.isArray(d.filters))d.filters={};
  if(conds.length)d.filters[CRM._vefBoard]=conds;else delete d.filters[CRM._vefBoard];
  App._crmViewEditFilterBack();
};
/* Remove a board from THIS view only. The board, its tickets and every other view keep working. */
App._crmViewHideBoard=async(boardId)=>{
  var v=CRM.sel.viewId?_crmView(CRM.sel.viewId):null;
  if(!v)return;
  if(!_crmViewCanEdit(v))return toast('You can\u2019t change this view','err');
  var b=_crmBoard(boardId);if(!b)return;
  if(!(await _crmConfirmP('Remove from view','\u201c'+esc(b.name)+'\u201d will stop appearing in <b>'+esc(v.name)+'</b>. The board and its tickets are not deleted, and other views are unaffected.','Remove from view')))return;
  if(!v.filters||Array.isArray(v.filters))v.filters={};
  var h=Array.isArray(v.filters[_CRM_VHIDE])?v.filters[_CRM_VHIDE]:[];
  if(h.indexOf(boardId)<0)h.push(boardId);
  v.filters[_CRM_VHIDE]=h;
  delete v.filters[boardId];                                  // its saved conditions are moot now
  if(CRM.sel.boardId===boardId){CRM.sel.boardId=null;CRM.sel.convoId=null;CRM.sel.threadId=null;}
  rr();toast('Removed from '+v.name);
  sbWrite({table:'crm_views',op:'update',id:v.id,match:{col:'id',val:v.id},values:{filters:v.filters}},{label:'View boards'});
};
App._crmViewSave=()=>{
  if(CRM._viewEdit)_crmMarkFresh(CRM._viewEdit.id);
  if(!can('crm','views'))return toast('You need the Workspace → Filtered views permission','err');
  var d=CRM._viewEdit;if(!d)return;
  var name=String(d.name||'').trim();if(!name)return toast('Name the view','err');
  var flt=(d.filters&&!Array.isArray(d.filters))?d.filters:{};
  var hbs=CRM.boards.filter(function(b2){return b2.hubId===d.hubId;});
  /* keep only hidden ids that still exist; a view must keep at least one board */
  var hid=Array.isArray(flt[_CRM_VHIDE])?flt[_CRM_VHIDE].filter(function(id2){return hbs.some(function(b2){return b2.id===id2;});}):[];
  if(hbs.length&&hid.length>=hbs.length)return toast('Keep at least one board in the view','err');
  /* strip: conditions of hidden/unknown boards, empty condition lists, half-built rows */
  var clean={};if(hid.length)clean[_CRM_VHIDE]=hid;
  hbs.forEach(function(b2){
    if(hid.indexOf(b2.id)>=0)return;
    var c2=flt[b2.id];if(!Array.isArray(c2))return;
    c2=c2.filter(function(f){return f&&f.field;});
    if(c2.length)clean[b2.id]=c2;
  });
  var rec={id:d.id,hubId:d.hubId,name:name,filters:clean,members:(d.members||[]).slice(),createdBy:d.createdBy||S.uid||null,sort:d.sort||(CRM.views||[]).length};
  if(!CRM.views)CRM.views=[];
  var i=CRM.views.findIndex(function(v){return v.id===rec.id;});
  if(i>=0)CRM.views[i]=rec;else CRM.views.push(rec);
  var isNew=!!d._new;
  CRM._viewEdit=null;CRM._vefBoard=null;CRM._fDraft=null;CRM._fRerender=null;
  CRM.sel.hubId=rec.hubId;CRM.sel.viewId=rec.id;CRM.sel.convoId=null;CRM.sel.threadId=null;
  var b=_crmBoard(CRM.sel.boardId);
  if(!b||b.hubId!==rec.hubId||hid.indexOf(b.id)>=0){var fb=CRM.boards.filter(function(x){return x.hubId===rec.hubId&&hid.indexOf(x.id)<0;})[0];CRM.sel.boardId=fb?fb.id:null;}
  closeModal();rr();
  sbWrite({table:'crm_views',op:'upsert',id:rec.id,values:{id:rec.id,hub_id:rec.hubId,board_id:null,name:rec.name,filters:rec.filters,members:rec.members,created_by:rec.createdBy,sort:rec.sort},opts:{onConflict:'id'}},{label:'Filtered view'});
  _crmLog('saved view',null,name);
  toast(isNew?'View created ✓':'View saved ✓');
};
App._crmDelView=async(id)=>{
  var v=_crmView(id);if(!v)return;
  if(!_crmViewCanEdit(v))return toast('Only the view\'s creator can delete it','err');
  if(!(await _crmConfirmP('Delete view','“'+esc(v.name)+'” disappears for everyone assigned. The board and its tickets are not affected.','Delete view')))return;
  CRM.views=(CRM.views||[]).filter(function(x){return x.id!==id;});
  if(CRM.sel.viewId===id){CRM.sel.viewId=null;}
  CRM._viewEdit=null;rr();
  sbWrite({table:'crm_views',op:'delete',id:id,match:{col:'id',val:id}},{label:'Delete view'});
};
App._crmSelView=(id)=>{var v=_crmView(id);if(!v||!_crmViewVisible(v))return;CRM.sel.hubId=v.hubId;CRM.sel.viewId=id;var b=_crmBoard(CRM.sel.boardId);if(!b||b.hubId!==v.hubId){var fb=CRM.boards.filter(function(x){return x.hubId===v.hubId;})[0];CRM.sel.boardId=fb?fb.id:null;}CRM.sel.convoId=null;CRM.sel.threadId=null;CRM.search='';rr();};
App._crmSelHub=(id)=>{CRM.sel.hubId=id;CRM.sel.viewId=null;var vb=CRM.boards.filter(function(b){return b.hubId===id&&_crmBoardVisible(b);});CRM.sel.boardId=vb[0]?vb[0].id:null;CRM.sel.convoId=null;CRM.sel.threadId=null;CRM.search='';rr();};
/* ── “+” on a hub: create a board or a filtered view ── */
App._crmHubAdd=(hubId)=>{
  var canB=can('crm','create'),canV=can('crm','views');
  if(canB&&!canV)return App._crmNewBoard(hubId);
  if(canV&&!canB)return App._crmNewView(hubId);
  if(!canB&&!canV)return toast('No permission','err');
  var h=_crmHub(hubId);
  modalShell({title:'Add to '+esc(h?h.name:''),sub:'',size:'max-w-sm',key:'crm-hubadd',
    body:'<button onclick="App.closeModal();App._crmNewBoard(\''+hubId+'\')" style="width:100%;text-align:left;display:flex;align-items:center;gap:11px;padding:13px;border:1.5px solid var(--c-border);border-radius:13px;background:#fff;cursor:pointer;margin-bottom:9px"><span style="width:36px;height:36px;border-radius:10px;background:#EEE4D5;color:#54433C;display:grid;place-items:center;flex-shrink:0">'+ic('ticket','w-4 h-4')+'</span><span><span style="display:block;font-size:13.5px;font-weight:800;color:#13171B">New board</span><span style="display:block;font-size:11.5px;color:#A59788;margin-top:1px">A chat or a ticket table with its own columns & members</span></span></button>'
      +'<button onclick="App.closeModal();App._crmNewView(\''+hubId+'\')" style="width:100%;text-align:left;display:flex;align-items:center;gap:11px;padding:13px;border:1.5px solid var(--c-border);border-radius:13px;background:#fff;cursor:pointer"><span style="width:36px;height:36px;border-radius:10px;background:#F2E9D4;color:#7F6533;display:grid;place-items:center;flex-shrink:0">'+ic('filter','w-4 h-4')+'</span><span><span style="display:block;font-size:13.5px;font-weight:800;color:#13171B">New filtered view</span><span style="display:block;font-size:11.5px;color:#A59788;margin-top:1px">Pick which boards it shows & each board’s filter — visible only to the people you assign</span></span></button>'});
};

// ===== CRM ticket-board views: view switcher + KANBAN (v2) + TABLE (dynamic columns) =====
function _crmViewBar(board){
  var rows=CRM.convos.filter(function(c){return c.boardId===board.id;});
  var flt=(CRM.boardFilter||{})[board.id]||[];
  var shown=flt.length?_crmApplyFilters(rows,flt).length:rows.length;
  return'<div class="crm-viewbar" style="display:flex;align-items:center;gap:8px;padding:9px 14px;border-bottom:1px solid #EDE7DC;background:#FCFAF7;flex-shrink:0;flex-wrap:wrap">'
    +(can('crm','create')?'<button onclick="App._crmRowAddOpen(\''+board.id+'\')" style="display:inline-flex;align-items:center;gap:6px;padding:8px 15px;border-radius:9px;border:none;background:#54433C;color:#fff;font-size:12.5px;font-weight:800;cursor:pointer;white-space:nowrap;line-height:1;flex-shrink:0;box-shadow:0 2px 8px rgba(84,67,60,.32)">'+ic('plus','w-3.5 h-3.5')+'New ticket</button>':'')
    +(can('crm','edit')?'<button onclick="App._crmColModal(\''+board.id+'\')" style="display:inline-flex;align-items:center;gap:5px;padding:7px 13px;border-radius:9px;border:1.5px solid #E6DED3;background:#fff;color:#786A5F;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;line-height:1;flex-shrink:0">'+ic('plus','w-3.5 h-3.5')+'Column</button>':'')
    +((can('crm','manage')||can('crm','edit'))?'<button onclick="App._crmStatusEditor(\''+board.id+'\')" title="Add, rename, recolor this board’s statuses" style="display:inline-flex;align-items:center;gap:5px;padding:7px 13px;border-radius:9px;border:1.5px solid #E6DED3;background:#fff;color:#786A5F;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;line-height:1;flex-shrink:0">'+ic('approve','w-3.5 h-3.5')+'Statuses</button>':'')
    +'<button onclick="App._crmBoardFilter(\''+board.id+'\')" title="Filter tickets — every column is filterable" style="display:inline-flex;align-items:center;gap:5px;padding:7px 13px;border-radius:9px;border:1.5px solid '+(flt.length?'#54433C':'#E6DED3')+';background:'+(flt.length?'#EEE4D5':'#fff')+';color:'+(flt.length?'#3E322B':'#786A5F')+';font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;line-height:1;flex-shrink:0">'+ic('filter','w-3.5 h-3.5')+(flt.length?'Filtered · '+flt.length:'Filter')+'</button>'
    +'<span style="flex:1"></span>'
    +((can('crm','manage')||can('crm','edit'))?'<button onclick="App._crmAutomations(\''+board.id+'\')" title="Automations — rules & reminders" style="display:inline-flex;align-items:center;gap:5px;padding:7px 13px;border-radius:9px;border:1.5px solid #AF7B6D;background:#EEE4D5;color:#3E322B;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;line-height:1;flex-shrink:0">'+ic('flag','w-3.5 h-3.5')+'Automations</button>':'')
    +'<span style="font-size:11.5px;color:#786A5F;font-weight:600">'+(flt.length?shown+' of '+rows.length:rows.length)+' ticket'+(rows.length===1?'':'s')+(_crmNotDone(board,rows).length?' \u00b7 <span style="color:#B3402E;font-weight:800">'+_crmNotDone(board,rows).length+' not done</span>':'')+'</span>'
  +'</div>';
}
/* v3.12.1: bar shown on a ticket board INSIDE a filtered view — identical to the board bar,
   but the Filter button edits & SAVES the view's conditions for this board (view editors only). */
function _crmViewBarV(board,view){
  var rows=CRM.convos.filter(function(c){return c.boardId===board.id;});
  var vf=_crmViewFilters(view,board.id);
  var shown=vf.length?_crmApplyFilters(rows,vf).length:rows.length;
  var canEdV=_crmViewCanEdit(view);
  return'<div class="crm-viewbar" style="display:flex;align-items:center;gap:8px;padding:9px 14px;border-bottom:1px solid #EDE7DC;background:#FCFAF7;flex-shrink:0;flex-wrap:wrap">'
    +(can('crm','create')?'<button onclick="App._crmRowAddOpen(\''+board.id+'\')" style="display:inline-flex;align-items:center;gap:6px;padding:8px 15px;border-radius:9px;border:none;background:#54433C;color:#fff;font-size:12.5px;font-weight:800;cursor:pointer;white-space:nowrap;line-height:1;flex-shrink:0;box-shadow:0 2px 8px rgba(84,67,60,.32)">'+ic('plus','w-3.5 h-3.5')+'New ticket</button>':'')
    +(canEdV
      ?'<button onclick="App._crmViewFilterOpen(\''+view.id+'\',\''+board.id+'\')" title="Set this view\u2019s saved filter for this board — every column is filterable" style="display:inline-flex;align-items:center;gap:5px;padding:7px 13px;border-radius:9px;border:1.5px solid '+(vf.length?'#7F6533':'#E6DED3')+';background:'+(vf.length?'#F2E9D4':'#fff')+';color:'+(vf.length?'#7F6533':'#786A5F')+';font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;line-height:1;flex-shrink:0">'+ic('filter','w-3.5 h-3.5')+(vf.length?'View filter \u00b7 '+vf.length:'Set view filter')+'</button>'
      :(vf.length?'<span style="display:inline-flex;align-items:center;gap:5px;padding:7px 13px;border-radius:9px;background:#F2E9D4;color:#7F6533;font-size:12px;font-weight:700;white-space:nowrap;line-height:1;flex-shrink:0">'+ic('filter','w-3.5 h-3.5')+vf.length+' condition'+(vf.length===1?'':'s')+'</span>':''))
    +'<span style="flex:1"></span>'
    +(canEdV?'<button onclick="App._crmEditView(\''+view.id+'\')" title="Edit this view — boards, filters, name & people" style="display:inline-flex;align-items:center;gap:5px;padding:7px 13px;border-radius:9px;border:1.5px solid #E6DED3;background:#fff;color:#786A5F;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;line-height:1;flex-shrink:0">'+ic('edit','w-3.5 h-3.5')+'Edit view</button><button onclick="App._crmDelView(\''+view.id+'\')" title="Delete this view (boards & tickets are not affected)" style="display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9px;border:1.5px solid #E4A898;background:#fff;color:#B3402E;cursor:pointer;flex-shrink:0">'+ic('trash','w-3.5 h-3.5')+'</button>':'')
    +'<span style="font-size:11.5px;color:#786A5F;font-weight:600">'+(vf.length?shown+' of '+rows.length:rows.length)+' ticket'+(rows.length===1?'':'s')+(_crmNotDone(board,rows).length?' \u00b7 <span style="color:#B3402E;font-weight:800">'+_crmNotDone(board,rows).length+' not done</span>':'')+'</span>'
  +'</div>';
}
/* Edit + save the view's per-board filter */
App._crmViewFilterOpen=(viewId,boardId)=>{
  var v=_crmView(viewId);if(!v)return;
  if(!_crmViewCanEdit(v))return toast('Only the view\'s creator (with the Filtered views permission) can change its conditions','err');
  CRM._vfCtx={viewId:viewId,boardId:boardId};
  CRM._fDraft=JSON.parse(JSON.stringify(_crmViewFilters(v,boardId)));
  CRM._fRerender=App._crmViewFilterRender;
  App._crmViewFilterRender();
};
App._crmViewFilterRender=()=>{
  var ctx=CRM._vfCtx;if(!ctx)return;var v=_crmView(ctx.viewId);var b=_crmBoard(ctx.boardId);if(!v||!b)return;
  modalShell({title:'View filter — '+esc(b.name),sub:'Saved on \u201c'+esc(v.name)+'\u201d — everyone assigned to the view sees only the matching tickets on this board. Every column is filterable.',size:'max-w-md',key:'crm-vfilter',
    body:_crmFilterBuilderHTML(b,CRM._fDraft),
    footer:(_crmViewFilters(v,ctx.boardId).length?'<button onclick="App._crmViewFilterClear()" class="ui-btn ui-btn-ghost ui-btn-md" style="margin-right:auto">Clear</button>':'')+btnG('Cancel','App.closeModal()')+btnP('Save filter','App._crmViewFilterSave()')});
};
App._crmViewFilterSave=()=>{
  var ctx=CRM._vfCtx;if(!ctx)return;var v=_crmView(ctx.viewId);if(!v)return;
  var conds=(CRM._fDraft||[]).filter(function(f){return f&&f.field;});
  if(!v.filters||Array.isArray(v.filters))v.filters={};
  if(conds.length)v.filters[ctx.boardId]=conds;else delete v.filters[ctx.boardId];
  CRM._vfCtx=null;CRM._fDraft=null;CRM._fRerender=null;
  closeModal();rr();
  sbWrite({table:'crm_views',op:'update',id:v.id,match:{col:'id',val:v.id},values:{filters:v.filters}},{label:'View filter'});
  _crmLog('view filter',null,v.name);
  toast('View filter saved \u2713');
};
App._crmViewFilterClear=()=>{CRM._fDraft=[];App._crmViewFilterSave();};
/* ── v3: per-board status editor ── */
App._crmStatusEditor=(boardId)=>{
  if(!(can('crm','manage')||can('crm','edit')))return toast('No permission','err');
  var b=_crmBoard(boardId||CRM.sel.boardId);if(!b)return;
  CRM._stEdit=JSON.parse(JSON.stringify(_crmStatuses(b)));CRM._stBoard=b.id;
  App._crmStatusEditorRender();
};
App._crmStatusEditorRender=()=>{
  var rows=(CRM._stEdit||[]).map(function(st,i){return '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">'
    +'<input type="color" value="'+esc(st.color||'#796B60')+'" onchange="CRM._stEdit['+i+'].color=this.value" style="width:36px;height:36px;border:1px solid var(--c-border);border-radius:9px;padding:2px;cursor:pointer;background:#fff"/>'
    +'<input value="'+esc(st.name||'')+'" oninput="CRM._stEdit['+i+'].name=this.value" class="ui-input" style="flex:1;min-height:36px;padding:7px 10px;font-size:13px"/>'
    +'<label title="Counts as done (not overdue, not open)" style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:var(--c-text-2);cursor:pointer;flex-shrink:0"><input type="checkbox" '+(st.done?'checked':'')+' onchange="CRM._stEdit['+i+'].done=this.checked"/>done</label>'
    +'<button onclick="CRM._stEdit.splice('+i+',1);App._crmStatusEditorRender()" '+((CRM._stEdit||[]).length<=1?'disabled style="opacity:.4;cursor:not-allowed;':'style="cursor:pointer;')+'width:30px;height:30px;border:none;border-radius:8px;background:var(--c-danger-soft);color:var(--c-danger);display:grid;place-items:center;flex-shrink:0">'+ic('x','w-3.5 h-3.5')+'</button></div>';}).join('');
  modalShell({title:'Board statuses',sub:'These become the kanban columns and every status dropdown on this board. Drag tickets between them freely.',size:'max-w-md',key:'crm-status-ed',
    body:rows+'<button onclick="CRM._stEdit.push({name:\'New status\',color:\'#9C7386\'});App._crmStatusEditorRender()" class="ui-btn ui-btn-ghost ui-btn-sm" style="margin-top:2px">+ Add status</button>'
      +'<p style="font-size:11.5px;color:var(--c-text-3);margin-top:12px;line-height:1.5">Tickets whose status no longer exists after saving are moved to the first status.</p>',
    footer:btnG('Cancel','App.closeModal()')+btnP('Save statuses','App._crmStatusSave()')});
};
App._crmStatusSave=()=>{
  var b=_crmBoard(CRM._stBoard);if(!b)return;
  var st=(CRM._stEdit||[]).map(function(x){return{name:String(x.name||'').trim(),color:x.color||'#796B60',done:!!x.done};}).filter(function(x){return x.name;});
  if(!st.length)return toast('Keep at least one status','err');
  var names=st.map(function(x){return x.name;});
  if(new Set(names).size!==names.length)return toast('Status names must be unique','err');
  if(!b.settings)b.settings={};
  b.settings.statuses=st;
  var fallback=names[0];var moved=0;
  CRM.convos.filter(function(c){return c.boardId===b.id&&names.indexOf(c.status)<0;}).forEach(function(c){
    c.status=fallback;moved++;
    sbWrite({table:'crm_conversations',op:'update',id:c.id,match:{col:'id',val:c.id},values:{status:fallback,updated_at:new Date().toISOString()}},{label:'Status migrate',silent:true});
  });
  closeModal();rr();
  sbWrite({table:'crm_boards',op:'update',id:b.id,match:{col:'id',val:b.id},values:{settings:b.settings}},{label:'Board statuses'});
  toast('Statuses saved \u2713'+(moved?' — '+moved+' ticket'+(moved===1?'':'s')+' moved to "'+fallback+'"':''));
};
// ===== CRM Automations — per-board trigger→action rules (stored in board.settings.automations) =====
var _CRM_TRIG=[
  {v:'column',t:'When a column… (pick column + condition)',p:'column'},
  {v:'created',t:'When a ticket is created'},
  {v:'assigned',t:'When a ticket is assigned'},
  {v:'moved',t:'When a ticket is moved here'},
  {v:'stale',t:'When no activity for N days',p:'days'}
];
var _CRM_ACT=[
  {v:'notify',t:'Email + notify people',p:'users'},
  {v:'remind',t:'Set a reminder…',p:'remind'},
  {v:'setcol',t:'Set a column value…',p:'setcol'},
  {v:'assign',t:'Assign to…',p:'user'},
  {v:'move',t:'Move to board…',p:'board'},
  {v:'comment',t:'Post a comment',p:'text'}
];
/* ── v3.21: BUILT-IN (native) columns — automations can react to them and set them, exactly
   like custom columns. Pseudo-ids 'nat:*' can never collide with generated column ids. ── */
var _CRM_NAT=[
  {id:'nat:status',  name:'Status',        type:'nat_status'},
  {id:'nat:assignee',name:'Assignee',      type:'nat_person'},
  {id:'nat:priority',name:'Priority',      type:'nat_prio'},
  {id:'nat:due',     name:'Due date',      type:'date'},
  {id:'nat:customer',name:'Customer',      type:'text'},
  {id:'nat:title',   name:'Ticket (title)',type:'text'}
];
function _crmIsNat(id){return String(id||'').indexOf('nat:')===0;}
function _crmNatCol(id){return _CRM_NAT.find(function(c){return c.id===id;})||null;}
function _crmColById(b,id){return _crmIsNat(id)?_crmNatCol(id):((((b&&b.settings&&b.settings.columns)||[]).find(function(c){return c.id===id;}))||null);}
/* Current value of ANY column (native or custom) on a ticket. Assignee reads as the user id
   or 'grp:<id>' — the same encoding every assignee picker already uses. */
function _crmColVal(convo,colId){
  if(!convo)return null;
  if(colId==='nat:title')return convo.title||'';
  if(colId==='nat:customer')return convo.customer||'';
  if(colId==='nat:assignee')return convo.assignedGroup?('grp:'+convo.assignedGroup):(convo.assignedTo||'');
  if(colId==='nat:status')return convo.status||'';
  if(colId==='nat:priority')return convo.priority||'';
  if(colId==='nat:due')return convo.dueDate||'';
  return (convo.fields||{})[colId];
}
/* 'YYYY-MM-DD' + 'HH:MM' as DUBAI wall-clock time → UTC ISO (Dubai has no DST — fixed +04:00).
   Returns null for anything malformed, so callers can simply skip. */
function _crmDubaiISO(dateStr,timeStr){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr||'')))return null;
  var t=String(timeStr||'09:00');if(/^\d{2}:\d{2}:\d{2}$/.test(t))t=t.slice(0,5);
  if(!/^\d{2}:\d{2}$/.test(t))return null;
  var d=new Date(dateStr+'T'+t+':00+04:00');
  return isNaN(d.getTime())?null:d.toISOString();
}
function _crmAutos(b){return (b&&b.settings&&b.settings.automations)||[];}
function _crmTrigText(tr){var d=_CRM_TRIG.find(function(x){return x.v===(tr&&tr.type);});if(!d)return'When…';
  if(tr.type==='column'){var b2=_crmBoard(CRM._autoBoard);var col=_crmColById(b2,tr.colId);var cn=col?col.name:'?';
    var vTxt=tr.value;if(tr.colId==='nat:assignee'&&tr.value){vTxt=String(tr.value).indexOf('grp:')===0?(function(){var g=_crmGroup(String(tr.value).slice(4));return g?('group “'+g.name+'”'):'?';})():(uById(tr.value)?fullName(uById(tr.value)):'?');}
    var opTxt={change:'changes',set:'is filled',equals:(_crmIsNat(tr.colId)&&tr.colId!=='nat:title'&&tr.colId!=='nat:customer'?'becomes “':'= “')+esc(vTxt||'')+'”',contains:'contains “'+esc(tr.value||'')+'”',gt:'> '+esc(tr.value||''),lt:'< '+esc(tr.value||''),past:'date has passed',checked:'becomes checked',unchecked:'becomes unchecked'}[tr.op||'change']||'changes';return'When “'+esc(cn)+'” '+opTxt;}
  var s=d.t;if(tr.type==='status'||tr.type==='priority')s=s.replace('…',' “'+esc(tr.to||'?')+'”');if(tr.type==='due_soon'||tr.type==='stale')s=s.replace('N',(tr.days||1));return s;}
function _crmActText(a){var d=_CRM_ACT.find(function(x){return x.v===(a&&a.type);});if(!d)return'';if(a.type==='notify'){var _pp=(a.users||[]).filter(function(x){return String(x).indexOf('grp:')!==0;}).length;var _gc=(a.users||[]).filter(function(x){return String(x).indexOf('grp:')===0;}).length;var t2='notify '+_pp+' '+(_pp===1?'person':'people');if(_gc)t2+=' + '+_gc+' group'+(_gc===1?'':'s');return t2;}if(a.type==='status')return'set status “'+esc(a.value||'?')+'”';if(a.type==='assign'){if(String(a.value||'').indexOf('grp:')===0){var _ag=_crmGroup(String(a.value).slice(4));return'assign to group “'+(_ag?esc(_ag.name):'?')+'”';}return'assign to '+(uById(a.value)?esc(fullName(uById(a.value))):'?');}if(a.type==='move')return'move to '+(_crmBoard(a.value)?esc(_crmBoardLabel(_crmBoard(a.value))):'?');if(a.type==='comment')return'post a comment';if(a.type==='setcol'){var b3=_crmBoard(CRM._autoBoard);var c3=_crmColById(b3,a.colId);return'set \u201C'+esc(c3?c3.name:'?')+'\u201D = \u201C'+esc(a.value||'')+'\u201D';}
  if(a.type==='remind'){
    var whenTxt;
    if(a.when==='fixed')whenTxt='at '+esc(a.date||'?')+' '+esc(a.time||'09:00');
    else{var b4=_crmBoard(CRM._autoBoard);var dc=_crmColById(b4,a.dateCol);whenTxt='at “'+esc(dc?dc.name:'?')+'”'+(a.timeCol?(function(){var tc=_crmColById(b4,a.timeCol);return' + “'+esc(tc?tc.name:'?')+'”';})():(' '+esc(a.atTime||'09:00')));}
    if(a.who==='me'){var mu=a.meUid&&uById(a.meUid);return'remind only '+(mu?esc(fullName(mu)):'me')+' '+whenTxt;}
    var _rp=(a.users||[]).filter(function(x){return String(x).indexOf('grp:')!==0;}).length;var _rg=(a.users||[]).filter(function(x){return String(x).indexOf('grp:')===0;}).length;
    return'remind '+_rp+' '+(_rp===1?'person':'people')+(_rg?(' + '+_rg+' group'+(_rg===1?'':'s')):'')+' '+whenTxt;
  }
  return d.t;}
function _crmCondOk(convo,tr,ctx){
  if(tr.type==='status'||tr.type==='priority'){var cur=(ctx&&ctx.to!=null)?ctx.to:(tr.type==='status'?convo.status:convo.priority);if(tr.to&&String(tr.to)!==String(cur))return false;}
  if(tr.type==='column'){
    if(!ctx||tr.colId!==ctx.colId)return false;
    var v=ctx.value,op=tr.op||'change';
    if(op==='change')return true;
    if(op==='set')return v!=null&&String(v).trim()!=='';
    if(op==='equals')return String(v)===String(tr.value);
    if(op==='contains')return String(v||'').toLowerCase().indexOf(String(tr.value||'').toLowerCase())>=0;
    if(op==='gt')return parseFloat(v)>parseFloat(tr.value);
    if(op==='lt')return parseFloat(v)<parseFloat(tr.value);
    if(op==='checked')return v==='1'||v===true||v==='true';
    if(op==='unchecked')return !(v==='1'||v===true||v==='true');
    if(op==='past')return ctx.daily===true&&!!v&&String(v)<todayISO();
    return false;
  }
  return true;}
/* Every automation email on every board renders ONE shared template (crm_automation),
   editable in Settings -> Notifications -> Templates. This builds its variables. */
function _crmAutoVars(board,convo,rule){
  var asg=convo&&convo.assignedTo?uById(convo.assignedTo):null;
  var asgG=(!asg&&convo&&convo.assignedGroup)?_crmGroup(convo.assignedGroup):null;
  return{
    rule:(rule&&rule.name)||'Automation',
    title:(convo&&convo.title)||'',
    customer:(convo&&convo.customer)||'',
    board:(board&&board.name)||'',
    type:(board&&board.name)||'',
    status:(convo&&convo.status)||'',
    priority:(convo&&convo.priority)||'',
    assignee:asg?fullName(asg):(asgG?('Group “'+asgG.name+'”'):'Unassigned'),
    due_date:(convo&&convo.dueDate)?fmtS(convo.dueDate):'\u2014',
    actor:(function(){try{return fullName(me())||'';}catch(e){return'';}})()
  };
}
/* Automation email respects the same board/global email switch as every other event. */
function _crmAutoEmailOn(board){var bs=_crmBS(board);return !(bs.email&&bs.email.created===false);}
async function _crmDoAct(board,convo,a,rule){var at=new Date().toISOString();try{
  if(a.type==='notify'){var recips=_crmExpandPeople(a.users||[]).filter(function(u){return u&&u!==S.uid;});var txt='⚡ '+((rule&&rule.name)||'Automation')+' — “'+(convo.title||'ticket')+'”';for(var i=0;i<recips.length;i++){if(_crmInappOn('crm_ticket')){var nid=uid('n');try{DB.notifications.unshift({id:nid,userId:recips[i],text:txt,time:at,read:false});}catch(e){}sbWrite({table:'notifications',op:'insert',id:nid,values:{id:nid,user_id:recips[i],text:txt,read:false,created_at:at}},{label:'Automation',silent:true});}if(typeof queueEmail==='function'&&_crmAutoEmailOn(board)){try{queueEmail('crm_automation',recips[i],null,null,_crmAutoVars(board,convo,rule));}catch(e){}}}try{_invalidateNotifCache();}catch(e){}}
  else if(a.type==='status'){convo.status=a.value;sbWrite({table:'crm_conversations',op:'update',id:convo.id,match:{col:'id',val:convo.id},values:{status:a.value,updated_at:at}},{label:'Automation status',silent:true});}
  else if(a.type==='assign'){var _isG=String(a.value||'').indexOf('grp:')===0;convo.assignedTo=_isG?null:(a.value||null);convo.assignedGroup=_isG?String(a.value).slice(4):null;sbWrite({table:'crm_conversations',op:'update',id:convo.id,match:{col:'id',val:convo.id},values:{assigned_to:convo.assignedTo,assigned_group:convo.assignedGroup,updated_at:at}},{label:'Automation assign',silent:true});}
  else if(a.type==='move'){var _mtb=_crmBoard(a.value);if(_mtb&&_crmBS(_mtb).type!=='chat'){convo.boardId=a.value;convo.isTicket=true;sbWrite({table:'crm_conversations',op:'update',id:convo.id,match:{col:'id',val:convo.id},values:{board_id:a.value,is_ticket:true,updated_at:at}},{label:'Automation move',silent:true});}}
  else if(a.type==='setcol'){if(a.colId){
    var _d=(rule&&rule._ctxDepth)||0;
    if(_crmIsNat(a.colId)){ /* v3.21: built-in columns can be set too */
      var nv=(a.value==null?'':a.value);
      if(a.colId==='nat:status'){convo.status=nv;sbWrite({table:'crm_conversations',op:'update',id:convo.id,match:{col:'id',val:convo.id},values:{status:nv,updated_at:at}},{label:'Automation status',silent:true});if(_d<2){try{_crmRunAutos(board,'status',convo,{to:nv,_depth:_d+1});}catch(e){}}}
      else if(a.colId==='nat:priority'){convo.priority=nv;sbWrite({table:'crm_conversations',op:'update',id:convo.id,match:{col:'id',val:convo.id},values:{priority:nv,updated_at:at}},{label:'Automation priority',silent:true});}
      else if(a.colId==='nat:due'){convo.dueDate=nv||null;sbWrite({table:'crm_conversations',op:'update',id:convo.id,match:{col:'id',val:convo.id},values:{due_date:nv||null,updated_at:at}},{label:'Automation due date',silent:true});}
      else if(a.colId==='nat:customer'){convo.customer=nv;sbWrite({table:'crm_conversations',op:'update',id:convo.id,match:{col:'id',val:convo.id},values:{customer:nv,updated_at:at}},{label:'Automation customer',silent:true});}
      else if(a.colId==='nat:title'){if(nv){convo.title=nv;sbWrite({table:'crm_conversations',op:'update',id:convo.id,match:{col:'id',val:convo.id},values:{title:nv,updated_at:at}},{label:'Automation title',silent:true});}}
      if(_d<2){try{_crmRunAutos(board,'column',convo,{colId:a.colId,value:nv,_depth:_d+1});}catch(e){}}
    }else{
      if(!convo.fields)convo.fields={};convo.fields[a.colId]=a.value;sbWrite({table:'crm_conversations',op:'update',id:convo.id,match:{col:'id',val:convo.id},values:{fields:convo.fields,updated_at:at}},{label:'Automation column',silent:true});if(_d<2){try{_crmRunAutos(board,'column',convo,{colId:a.colId,value:a.value,_depth:_d+1});}catch(e){}}
    }
  }}
  else if(a.type==='remind'){
    /* v3.21 — schedule a reminder: the date & time come from the row's columns (or a fixed
       date/time on the rule), interpreted as DUBAI time. One pending reminder per rule+ticket
       (a re-trigger re-arms it — latest date/time wins); a server job fires it in-app + email
       at that minute, Bridge open or closed. Past or incomplete dates are skipped. */
    var _dv,_tv;
    if(a.when==='fixed'){_dv=a.date;_tv=a.time||'09:00';}
    else{_dv=_crmColVal(convo,a.dateCol);_tv=a.timeCol?String(_crmColVal(convo,a.timeCol)||''):'';if(!_tv)_tv=a.atTime||'09:00';}
    var _iso=_crmDubaiISO(_dv,_tv);
    if(_iso&&_iso>at){
      var _tg=a.who==='me'?[a.meUid||S.uid].filter(Boolean):(a.users||[]).slice();
      if(_tg.length){
        var _rid='arem_'+String((rule&&rule.id)||'r').replace(/[^A-Za-z0-9_-]/g,'')+'_'+String(convo.id).replace(/[^A-Za-z0-9_-]/g,'');
        sbWrite({table:'crm_rule_reminders',op:'upsert',id:_rid,values:{id:_rid,board_id:(board&&board.id)||convo.boardId||null,conversation_id:convo.id,rule_id:(rule&&rule.id)||null,rule_name:(rule&&rule.name)||'',note:a.note||'',remind_at:_iso,targets:_tg,created_by:S.uid||null,fired:false,fired_at:null}},{label:'Reminder',silent:true});
      }
    }
  }
  else if(a.type==='comment'){var mid=uid('msg');if(!convo.messages)convo.messages=[];convo.messages.push({id:mid,senderId:null,fromCustomer:false,name:'Automation',text:a.text||'',images:[],at:at,reactions:{},parentId:null});convo.lastAt=at;sbWrite({table:'crm_messages',op:'insert',id:mid,values:{id:mid,conversation_id:convo.id,sender_id:null,from_customer:false,name:'Automation',body:a.text||'',created_at:at}},{label:'Automation comment',silent:true});}
}catch(e){console.warn('[CRM auto action]',e&&e.message);}}
async function _crmRunAutos(board,event,convo,ctx){if(!board||!convo)return;var _depth=(ctx&&ctx._depth)||0;if(_depth>=3)return;var list=_crmAutos(board).filter(function(a){return a&&a.enabled!==false&&a.trigger&&a.trigger.type===event;});var ran=false;for(var i=0;i<list.length;i++){var a=list[i];if(!_crmCondOk(convo,a.trigger,ctx))continue;a._ctxDepth=_depth;for(var j=0;j<(a.actions||[]).length;j++){await _crmDoAct(board,convo,a.actions[j],a);ran=true;}if((a.actions||[]).length){try{_crmLog('automation',convo,a.name||event);}catch(e){}}}if(ran)rr();}
function _crmCheckReminders(){try{var today=todayISO();var key='bridge_crm_rem';var fired={};try{fired=JSON.parse(localStorage.getItem(key)||'{}');}catch(e){fired={};}(CRM.boards||[]).forEach(function(b){var autos=_crmAutos(b).filter(function(a){return a&&a.enabled!==false&&a.trigger&&(a.trigger.type==='stale'||(a.trigger.type==='column'&&a.trigger.op==='past'));});if(!autos.length)return;CRM.convos.filter(function(c){return c.boardId===b.id&&c.isTicket&&!_crmIsDone(b,c.status);}).forEach(function(c){autos.forEach(function(a){var tr=a.trigger,hit=false;if(tr.type==='stale'){var last=c.lastAt||c.createdAt;if(last){var days=Math.floor((Date.now()-new Date(last))/86400000);hit=days>=(tr.days||3);}}else if(tr.type==='column'){var cv=_crmColVal(c,tr.colId);hit=!!cv&&String(cv)<today;}if(!hit)return;var fk=a.id+'|'+c.id+'|'+today;if(fired[fk])return;fired[fk]=1;(a.actions||[]).forEach(function(act){_crmDoAct(b,c,act,a);});try{_crmLog('reminder',c,a.name||tr.type);}catch(e){}});});});try{localStorage.setItem(key,JSON.stringify(fired));}catch(e){}
  }catch(e){console.warn('[CRM reminders]',e&&e.message);}}
App._crmAutomations=(boardId)=>{if(!(can('crm','manage')||can('crm','edit')))return toast('No permission','err');var b=_crmBoard(boardId||CRM.sel.boardId);if(!b)return;CRM._autoBoard=b.id;CRM._autoEdit=null;App._crmAutoRender();};
App._crmAutoRender=()=>{var b=_crmBoard(CRM._autoBoard);if(!b)return;if(CRM._autoEdit)return App._crmAutoEditRender();var autos=_crmAutos(b);
  var list=autos.length?autos.map(function(a){return '<div style="display:flex;align-items:flex-start;gap:10px;padding:11px 12px;border:1px solid var(--c-border);border-radius:12px;margin-bottom:8px;background:'+(a.enabled===false?'var(--c-surface-2)':'#fff')+'">'
    +'<button onclick="App._crmAutoToggle(\''+a.id+'\')" class="tog'+(a.enabled===false?'':' on')+'" style="margin-top:2px"><span></span></button>'
    +'<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700;color:var(--c-text)">'+esc(a.name||'Untitled rule')+'</div><div style="font-size:12px;color:var(--c-text-2);margin-top:2px;line-height:1.5">'+_crmTrigText(a.trigger)+' → <b>'+((a.actions||[]).map(_crmActText).join('</b>, <b>')||'—')+'</b></div></div>'
    +'<button onclick="App._crmAutoEdit(\''+a.id+'\')" title="Edit" style="border:none;background:var(--c-surface-2);color:var(--c-text-2);width:28px;height:28px;border-radius:8px;cursor:pointer;display:grid;place-items:center">'+ic('edit','w-3.5 h-3.5')+'</button>'
    +'<button onclick="App._crmAutoDel(\''+a.id+'\')" title="Delete" style="border:none;background:var(--c-danger-soft);color:var(--c-danger);width:28px;height:28px;border-radius:8px;cursor:pointer;display:grid;place-items:center">'+ic('trash','w-3.5 h-3.5')+'</button></div>';}).join(''):'<div style="padding:22px;text-align:center;color:var(--c-text-3);font-size:12.5px">No rules yet. Add one to notify people, update tickets automatically, or schedule reminders from a trigger.</div>';
  modalShell({title:'Automations — '+esc(b.name),sub:'Run actions automatically when things happen on this board.',size:'max-w-lg',key:'crm-auto',body:list+'<button onclick="App._crmAutoNew()" class="ui-btn ui-btn-brand ui-btn-sm" style="margin-top:4px">+ New rule</button>',footer:btnP('Done','App.closeModal()')});};
App._crmAutoNew=()=>{App._crmAutoNewRule();}; /* v3.21: one rule type — reminders are an action now */
App._crmAutoNewRule=()=>{CRM._autoEdit={id:uid('auto'),name:'',enabled:true,trigger:{type:'created'},actions:[{type:'notify',users:[]}]};App._crmAutoEditRender();};
App._crmAutoEdit=(id)=>{var b=_crmBoard(CRM._autoBoard);var a=_crmAutos(b).find(function(x){return x.id===id;});if(!a)return;CRM._autoEdit=JSON.parse(JSON.stringify(a));App._crmAutoEditRender();};
App._crmAutoBack=()=>{CRM._autoEdit=null;App._crmAutoRender();};
App._crmAutoTrig=(v)=>{var t={type:v};if(v==='column'){t.colId='nat:status';t.op='change';}if(v==='status')t.to=(_crmStatuses(_crmBoard(CRM._autoBoard))[0]||{}).name;if(v==='priority')t.to='High';if(v==='due_soon'||v==='stale')t.days=1;CRM._autoEdit.trigger=t;App._crmAutoEditRender();};
App._crmAutoActType=(i,v)=>{var a={type:v};if(v==='notify')a.users=[];if(v==='remind'){a.who='me';a.users=[];a.when='col';a.dateCol='nat:due';a.timeCol='';a.atTime='09:00';a.note='';}CRM._autoEdit.actions[i]=a;App._crmAutoEditRender();};
App._crmAutoActUser=(i,uid2,on)=>{var a=CRM._autoEdit.actions[i];a.users=a.users||[];var k=a.users.indexOf(uid2);if(on&&k<0)a.users.push(uid2);if(!on&&k>=0)a.users.splice(k,1);};
App._crmAutoEditRender=()=>{var b=_crmBoard(CRM._autoBoard);if(!b)return;var d=CRM._autoEdit;var sts=_crmStatuses(b);var users=_crmBoardPeople(b);var boards=CRM.boards.filter(function(x){return x.id!==b.id&&_crmBoardVisible(x)&&_crmBS(x).type!=='chat';});
  var cols=((b.settings&&b.settings.columns)||[]).filter(function(c){return c.type!=='remind';});
  var trig=_CRM_TRIG.find(function(x){return x.v===d.trigger.type;})||_CRM_TRIG[0];var tp='';
  if(trig.p==='column'){
    /* v3.21: built-in columns (Status, Assignee, Priority, Due date, Customer, Title) are
       triggerable exactly like custom columns — one combined picker, grouped. */
    var tcols=_CRM_NAT.concat(cols);
    var tcol=tcols.find(function(c){return c.id===d.trigger.colId;})||tcols[0];if(!d.trigger.colId||!tcols.some(function(c){return c.id===d.trigger.colId;}))d.trigger.colId=tcol.id;
    var TXT=[['change','changes (any value)'],['equals','equals'],['contains','contains'],['set','is filled']];
    var NUM=[['change','changes (any value)'],['equals','equals (=)'],['gt','is greater than (>)'],['lt','is less than (<)'],['set','is filled']];
    var OPS={text:TXT,longtext:TXT,email:TXT,phone:TXT,url:TXT,number:NUM,currency:NUM,date:[['change','changes (any value)'],['equals','is exactly (date)'],['past','date has passed (checked daily)'],['set','is filled']],time:[['change','changes (any value)'],['equals','equals'],['set','is filled']],dropdown:[['change','changes (any value)'],['equals','becomes'],['set','is filled']],checkbox:[['checked','becomes checked'],['unchecked','becomes unchecked'],['change','changes']],person:[['change','changes (any value)'],['equals','becomes (person)'],['set','is filled']],nat_status:[['change','changes (any status)'],['equals','becomes'],['set','is filled']],nat_prio:[['change','changes (any priority)'],['equals','becomes']],nat_person:[['change','changes (anyone)'],['equals','becomes'],['set','is filled']]};
    var ops=OPS[tcol.type]||OPS.text;if(!ops.some(function(o){return o[0]===d.trigger.op;}))d.trigger.op=ops[0][0];
    var needVal=['equals','contains','gt','lt'].indexOf(d.trigger.op)>=0;
    var vIn='';
    if(needVal){
      if(tcol.type==='nat_status')vIn='<select onchange="CRM._autoEdit.trigger.value=this.value" class="ui-select" style="flex:1"><option value="">— pick —</option>'+sts.map(function(s){return'<option '+(String(s.name)===String(d.trigger.value)?'selected':'')+'>'+esc(s.name)+'</option>';}).join('')+'</select>';
      else if(tcol.type==='nat_prio')vIn='<select onchange="CRM._autoEdit.trigger.value=this.value" class="ui-select" style="flex:1"><option value="">— pick —</option>'+['Low','Medium','High','Critical'].map(function(s){return'<option '+(String(s)===String(d.trigger.value)?'selected':'')+'>'+s+'</option>';}).join('')+'</select>';
      else if(tcol.type==='nat_person'){var _tbg=_crmBoardGroups(b);vIn='<select onchange="CRM._autoEdit.trigger.value=this.value" class="ui-select" style="flex:1"><option value="">— pick —</option>'+(_tbg.length?'<optgroup label="Groups">'+_tbg.map(function(g){return'<option value="grp:'+g.id+'" '+(d.trigger.value==='grp:'+g.id?'selected':'')+'>\u{1F465} '+esc(g.name)+'</option>';}).join('')+'</optgroup><optgroup label="People">':'')+users.map(function(u){return'<option value="'+u.id+'" '+(String(u.id)===String(d.trigger.value)?'selected':'')+'>'+esc(fullName(u))+'</option>';}).join('')+(_tbg.length?'</optgroup>':'')+'</select>';}
      else if(tcol.type==='dropdown')vIn='<select onchange="CRM._autoEdit.trigger.value=this.value" class="ui-select" style="flex:1"><option value="">— pick —</option>'+(tcol.options||[]).map(function(o){return'<option '+(String(o)===String(d.trigger.value)?'selected':'')+'>'+esc(o)+'</option>';}).join('')+'</select>';
      else if(tcol.type==='person')vIn='<select onchange="CRM._autoEdit.trigger.value=this.value" class="ui-select" style="flex:1"><option value="">— pick —</option>'+users.map(function(u){return'<option value="'+u.id+'" '+(String(u.id)===String(d.trigger.value)?'selected':'')+'>'+esc(fullName(u))+'</option>';}).join('')+'</select>';
      else vIn='<input type="'+((tcol.type==='number'||tcol.type==='currency')?'number':tcol.type==='date'?'date':tcol.type==='time'?'time':'text')+'" value="'+esc(d.trigger.value||'')+'" oninput="CRM._autoEdit.trigger.value=this.value" placeholder="value" class="ui-input" style="flex:1"/>';
    }
    var _tOpt=function(c){var tl=_crmIsNat(c.id)?'built-in':c.type;return'<option value="'+c.id+'" '+(c.id===d.trigger.colId?'selected':'')+'>'+esc(c.name)+' ('+tl+')</option>';};
    tp='<div style="margin-top:8px;display:flex;flex-direction:column;gap:8px">'
      +'<select onchange="CRM._autoEdit.trigger.colId=this.value;CRM._autoEdit.trigger.op=\'change\';CRM._autoEdit.trigger.value=\'\';App._crmAutoEditRender()" class="ui-select"><optgroup label="Built-in columns">'+_CRM_NAT.map(_tOpt).join('')+'</optgroup>'+(cols.length?'<optgroup label="Board columns">'+cols.map(_tOpt).join('')+'</optgroup>':'')+'</select>'
      +'<div style="display:flex;gap:8px"><select onchange="CRM._autoEdit.trigger.op=this.value;App._crmAutoEditRender()" class="ui-select" style="flex:1">'+ops.map(function(o){return'<option value="'+o[0]+'" '+(o[0]===d.trigger.op?'selected':'')+'>'+o[1]+'</option>';}).join('')+'</select>'+vIn+'</div>'
    +'</div>';
  }
  else if(trig.p==='status')tp='<select onchange="CRM._autoEdit.trigger.to=this.value" class="ui-select" style="margin-top:8px">'+sts.map(function(s){return'<option '+(d.trigger.to===s.name?'selected':'')+'>'+esc(s.name)+'</option>';}).join('')+'</select>';
  else if(trig.p==='priority')tp='<select onchange="CRM._autoEdit.trigger.to=this.value" class="ui-select" style="margin-top:8px">'+['Low','Medium','High','Critical'].map(function(s){return'<option '+(d.trigger.to===s?'selected':'')+'>'+s+'</option>';}).join('')+'</select>';
  else if(trig.p==='days')tp='<div style="margin-top:8px;display:flex;align-items:center;gap:8px"><input type="number" min="1" value="'+esc(d.trigger.days||1)+'" oninput="CRM._autoEdit.trigger.days=+this.value" class="ui-input" style="width:88px"/><span style="font-size:12.5px;color:var(--c-text-2)">day(s)</span></div>';
  var actRows=(d.actions||[]).map(function(a,i){var ad=_CRM_ACT.find(function(x){return x.v===a.type;})||_CRM_ACT[0];var pr='';
    if(ad.p==='users'){var _agg=_crmGroups();pr='<div style="margin-top:7px;max-height:150px;overflow:auto;border:1px solid var(--c-border);border-radius:9px;padding:6px">'+(_agg.length?'<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--c-text-3);padding:2px">Groups</div>'+_agg.map(function(g){return'<label style="display:flex;align-items:center;gap:7px;font-size:12.5px;padding:2px;cursor:pointer;font-weight:700"><input type="checkbox" '+(((a.users||[]).indexOf('grp:'+g.id)>=0)?'checked':'')+' onchange="App._crmAutoActUser('+i+',\'grp:'+g.id+'\',this.checked)"/>'+esc(g.name)+' <span style="font-weight:600;color:var(--c-text-3);font-size:11px">('+((g.members||[]).length)+')</span></label>';}).join('')+'<div style="height:1px;background:var(--c-border);margin:5px 0"></div>':'')+(users.length?users.map(function(u){return'<label style="display:flex;align-items:center;gap:7px;font-size:12.5px;padding:2px;cursor:pointer"><input type="checkbox" '+(((a.users||[]).indexOf(u.id)>=0)?'checked':'')+' onchange="App._crmAutoActUser('+i+',\''+u.id+'\',this.checked)"/>'+esc(fullName(u))+'</label>';}).join(''):'<div style="font-size:12px;color:var(--c-text-3);padding:2px">No members on this board yet.</div>')+'</div>';}
    else if(ad.p==='status')pr='<select onchange="CRM._autoEdit.actions['+i+'].value=this.value" class="ui-select" style="margin-top:7px">'+sts.map(function(s){return'<option '+(a.value===s.name?'selected':'')+'>'+esc(s.name)+'</option>';}).join('')+'</select>';
    else if(ad.p==='user'){var _bgg=_crmBoardGroups(_crmBoard(CRM._autoBoard));pr='<select onchange="CRM._autoEdit.actions['+i+'].value=this.value" class="ui-select" style="margin-top:7px"><option value="">— pick —</option>'+(_bgg.length?'<optgroup label="Groups">'+_bgg.map(function(g){return'<option value="grp:'+g.id+'" '+(a.value==='grp:'+g.id?'selected':'')+'>\u{1F465} '+esc(g.name)+' ('+((g.members||[]).length)+')</option>';}).join('')+'</optgroup><optgroup label="People">':'')+users.map(function(u){return'<option value="'+u.id+'" '+(a.value===u.id?'selected':'')+'>'+esc(fullName(u))+'</option>';}).join('')+(_bgg.length?'</optgroup>':'')+'</select>';}
    else if(ad.p==='board')pr='<select onchange="CRM._autoEdit.actions['+i+'].value=this.value" class="ui-select" style="margin-top:7px"><option value="">— pick —</option>'+boards.map(function(x){return'<option value="'+x.id+'" '+(a.value===x.id?'selected':'')+'>'+esc(_crmBoardLabel(x))+'</option>';}).join('')+'</select>';
    else if(ad.p==='text')pr='<input value="'+esc(a.text||'')+'" oninput="CRM._autoEdit.actions['+i+'].text=this.value" placeholder="Comment text…" class="ui-input" style="margin-top:7px"/>';
    else if(ad.p==='setcol'){
      /* v3.21: built-in columns are settable too (Assignee stays on the dedicated action). */
      var scols=_CRM_NAT.filter(function(c){return c.id!=='nat:assignee';}).concat(cols);
      var scol=scols.find(function(c){return c.id===a.colId;})||scols[0];if(!a.colId||!scols.some(function(c){return c.id===a.colId;}))a.colId=scol.id;
      var sIn;
      if(scol.type==='nat_status')sIn='<select onchange="CRM._autoEdit.actions['+i+'].value=this.value" class="ui-select" style="flex:1"><option value="">\u2014 pick \u2014</option>'+sts.map(function(st2){return'<option '+(String(st2.name)===String(a.value)?'selected':'')+'>'+esc(st2.name)+'</option>';}).join('')+'</select>';
      else if(scol.type==='nat_prio')sIn='<select onchange="CRM._autoEdit.actions['+i+'].value=this.value" class="ui-select" style="flex:1"><option value="">\u2014 pick \u2014</option>'+['Low','Medium','High','Critical'].map(function(pv){return'<option '+(String(pv)===String(a.value)?'selected':'')+'>'+pv+'</option>';}).join('')+'</select>';
      else if(scol.type==='dropdown')sIn='<select onchange="CRM._autoEdit.actions['+i+'].value=this.value" class="ui-select" style="flex:1"><option value="">\u2014</option>'+(scol.options||[]).map(function(o){return'<option '+(String(o)===String(a.value)?'selected':'')+'>'+esc(o)+'</option>';}).join('')+'</select>';
      else if(scol.type==='checkbox')sIn='<select onchange="CRM._autoEdit.actions['+i+'].value=this.value" class="ui-select" style="flex:1"><option value="1" '+(a.value==='1'?'selected':'')+'>Checked</option><option value="" '+(a.value!=='1'?'selected':'')+'>Unchecked</option></select>';
      else if(scol.type==='person')sIn='<select onchange="CRM._autoEdit.actions['+i+'].value=this.value" class="ui-select" style="flex:1"><option value="">\u2014 pick \u2014</option>'+users.map(function(u){return'<option value="'+u.id+'" '+(String(u.id)===String(a.value)?'selected':'')+'>'+esc(fullName(u))+'</option>';}).join('')+'</select>';
      else sIn='<input type="'+((scol.type==='number'||scol.type==='currency')?'number':scol.type==='date'?'date':scol.type==='time'?'time':'text')+'" value="'+esc(a.value||'')+'" oninput="CRM._autoEdit.actions['+i+'].value=this.value" placeholder="value" class="ui-input" style="flex:1"/>';
      var _sOpt=function(c){return'<option value="'+c.id+'" '+(c.id===a.colId?'selected':'')+'>'+esc(c.name)+(_crmIsNat(c.id)?' (built-in)':'')+'</option>';};
      pr='<div style="margin-top:7px;display:flex;gap:8px"><select onchange="CRM._autoEdit.actions['+i+'].colId=this.value;CRM._autoEdit.actions['+i+'].value=\'\';App._crmAutoEditRender()" class="ui-select" style="flex:1"><optgroup label="Built-in columns">'+_CRM_NAT.filter(function(c){return c.id!=='nat:assignee';}).map(_sOpt).join('')+'</optgroup>'+(cols.length?'<optgroup label="Board columns">'+cols.map(_sOpt).join('')+'</optgroup>':'')+'</select>'+sIn+'</div>';
    }
    else if(ad.p==='remind'){
      /* v3.21 \u2014 reminder action: WHO gets it (myself \u00b7 people & groups) and WHEN
         (the row's date & time columns, or a fixed date & time \u2014 Dubai time). */
      if(a.who==null)a.who='me';
      if(a.when==null)a.when='col';
      var dOpts=[{id:'nat:due',name:'Due date'}].concat(cols.filter(function(c){return c.type==='date';}));
      var tOpts=cols.filter(function(c){return c.type==='time';});
      if(!a.dateCol||!dOpts.some(function(c){return c.id===a.dateCol;}))a.dateCol=dOpts[0].id;
      if(a.timeCol&&!tOpts.some(function(c){return c.id===a.timeCol;}))a.timeCol='';
      var whoSel='<select onchange="CRM._autoEdit.actions['+i+'].who=this.value;App._crmAutoEditRender()" class="ui-select" style="flex:1"><option value="me" '+(a.who==='me'?'selected':'')+'>Only me \u2014 the person who saves this rule</option><option value="people" '+(a.who==='people'?'selected':'')+'>Specific people / groups\u2026</option></select>';
      var whoList='';
      if(a.who==='people'){var _rgg=_crmGroups();whoList='<div style="margin-top:7px;max-height:150px;overflow:auto;border:1px solid var(--c-border);border-radius:9px;padding:6px">'+(_rgg.length?'<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--c-text-3);padding:2px">Groups</div>'+_rgg.map(function(g){return'<label style="display:flex;align-items:center;gap:7px;font-size:12.5px;padding:2px;cursor:pointer;font-weight:700"><input type="checkbox" '+(((a.users||[]).indexOf('grp:'+g.id)>=0)?'checked':'')+' onchange="App._crmAutoActUser('+i+',\'grp:'+g.id+'\',this.checked)"/>'+esc(g.name)+' <span style="font-weight:600;color:var(--c-text-3);font-size:11px">('+((g.members||[]).length)+')</span></label>';}).join('')+'<div style="height:1px;background:var(--c-border);margin:5px 0"></div>':'')+(users.length?users.map(function(u){return'<label style="display:flex;align-items:center;gap:7px;font-size:12.5px;padding:2px;cursor:pointer"><input type="checkbox" '+(((a.users||[]).indexOf(u.id)>=0)?'checked':'')+' onchange="App._crmAutoActUser('+i+',\''+u.id+'\',this.checked)"/>'+esc(fullName(u))+'</label>';}).join(''):'<div style="font-size:12px;color:var(--c-text-3);padding:2px">No members on this board yet.</div>')+'</div>';}
      var whenSel='<select onchange="CRM._autoEdit.actions['+i+'].when=this.value;App._crmAutoEditRender()" class="ui-select" style="flex:1"><option value="col" '+(a.when!=='fixed'?'selected':'')+'>At the row\u2019s date & time columns</option><option value="fixed" '+(a.when==='fixed'?'selected':'')+'>At a fixed date & time</option></select>';
      var whenRow;
      if(a.when==='fixed'){
        whenRow='<div style="display:flex;gap:8px"><input type="date" value="'+esc(a.date||'')+'" onchange="CRM._autoEdit.actions['+i+'].date=this.value" class="ui-input" style="flex:1"/><input type="time" value="'+esc(a.time||'09:00')+'" onchange="CRM._autoEdit.actions['+i+'].time=this.value" class="ui-input" style="width:110px"/></div>';
      }else{
        var _dOpt=function(c){return'<option value="'+c.id+'" '+(c.id===a.dateCol?'selected':'')+'>'+esc(c.name)+(_crmIsNat(c.id)?' (built-in)':'')+'</option>';};
        whenRow='<div style="display:flex;gap:8px"><select onchange="CRM._autoEdit.actions['+i+'].dateCol=this.value" class="ui-select" style="flex:1" title="Date column">'+dOpts.map(_dOpt).join('')+'</select>'
          +(tOpts.length?'<select onchange="CRM._autoEdit.actions['+i+'].timeCol=this.value;App._crmAutoEditRender()" class="ui-select" style="flex:1" title="Time column"><option value="">at a fixed time\u2026</option>'+tOpts.map(function(c){return'<option value="'+c.id+'" '+(c.id===a.timeCol?'selected':'')+'>'+esc(c.name)+'</option>';}).join('')+'</select>':'')
          +(!a.timeCol?'<input type="time" value="'+esc(a.atTime||'09:00')+'" onchange="CRM._autoEdit.actions['+i+'].atTime=this.value" class="ui-input" style="width:110px" title="Time of day (Dubai)"/>':'')+'</div>';
      }
      pr='<div style="margin-top:7px;display:flex;flex-direction:column;gap:8px">'
        +'<div style="display:flex;gap:8px;align-items:center"><span style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--c-text-3);width:38px;flex-shrink:0">Who</span>'+whoSel+'</div>'+whoList
        +'<div style="display:flex;gap:8px;align-items:center"><span style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--c-text-3);width:38px;flex-shrink:0">When</span>'+whenSel+'</div>'+whenRow
        +'<input value="'+esc(a.note||'')+'" oninput="CRM._autoEdit.actions['+i+'].note=this.value" placeholder="Note shown in the reminder (optional)" class="ui-input"/>'
        +'<div style="font-size:11px;color:var(--c-text-3);line-height:1.5">Fires in-app + email at that moment (Dubai time), even with Bridge closed. If the trigger fires again for the same ticket, the reminder is re-armed to the latest date & time. Past or empty dates are skipped.</div>'
      +'</div>';
    }
    return '<div style="border:1px solid var(--c-border);border-radius:11px;padding:10px;margin-bottom:8px"><div style="display:flex;gap:8px;align-items:center"><select onchange="App._crmAutoActType('+i+',this.value)" class="ui-select" style="flex:1">'+_CRM_ACT.map(function(x){return'<option value="'+x.v+'" '+(a.type===x.v?'selected':'')+'>'+x.t+'</option>';}).join('')+'</select>'+(d.actions.length>1?'<button onclick="CRM._autoEdit.actions.splice('+i+',1);App._crmAutoEditRender()" style="border:none;background:var(--c-danger-soft);color:var(--c-danger);width:34px;height:34px;border-radius:8px;cursor:pointer;display:grid;place-items:center;flex-shrink:0">'+ic('x','w-3.5 h-3.5')+'</button>':'')+'</div>'+pr+'</div>';}).join('');
  modalShell({title:(d.name?esc(d.name):'New rule'),sub:'Pick a trigger, then one or more actions.',size:'max-w-lg',key:'crm-auto',
    body:'<label class="ui-label">Rule name</label><input value="'+esc(d.name||'')+'" oninput="CRM._autoEdit.name=this.value" placeholder="e.g. Email support team when overdue" class="ui-input" style="margin-bottom:14px"/>'
      +'<label class="ui-label">When… (trigger)</label><select onchange="App._crmAutoTrig(this.value)" class="ui-select">'+_CRM_TRIG.map(function(x){return'<option value="'+x.v+'" '+(d.trigger.type===x.v?'selected':'')+'>'+x.t+'</option>';}).join('')+'</select>'+tp
      +'<div style="height:16px"></div><label class="ui-label">Then… (actions)</label>'+actRows+'<button onclick="CRM._autoEdit.actions.push({type:\'notify\',users:[]});App._crmAutoEditRender()" class="ui-btn ui-btn-ghost ui-btn-sm">+ Add action</button>',
    footer:btnG('Back','App._crmAutoBack()')+btnP('Save rule','App._crmAutoSave()')});};
App._crmAutoSave=()=>{var b=_crmBoard(CRM._autoBoard);if(!b)return;var d=CRM._autoEdit;if(!d)return;if(!d.name||!d.name.trim())return toast('Name your rule','err');if(!d.actions||!d.actions.length)return toast('Add at least one action','err');for(var ri=0;ri<d.actions.length;ri++){var ra=d.actions[ri];if(ra&&ra.type==='remind'){if(ra.who==='people'&&!(ra.users||[]).length)return toast('Pick who the reminder is for','err');if(ra.when==='fixed'&&!/^\d{4}-\d{2}-\d{2}$/.test(String(ra.date||'')))return toast('Pick the reminder\u2019s date','err');ra.meUid=S.uid||ra.meUid||null;}}if(!b.settings)b.settings={};d.name=d.name.trim();var list=(b.settings.automations||[]).slice();var i=list.findIndex(function(x){return x.id===d.id;});if(i>=0)list[i]=d;else list.push(d);b.settings.automations=list;CRM._autoEdit=null;App._crmAutoRender();sbWrite({table:'crm_boards',op:'update',id:b.id,match:{col:'id',val:b.id},values:{settings:b.settings}},{label:'Automation'});toast('Rule saved ✓');};
App._crmAutoToggle=(id)=>{var b=_crmBoard(CRM._autoBoard);if(!b)return;var a=_crmAutos(b).find(function(x){return x.id===id;});if(!a)return;a.enabled=a.enabled===false;App._crmAutoRender();sbWrite({table:'crm_boards',op:'update',id:b.id,match:{col:'id',val:b.id},values:{settings:b.settings}},{label:'Automation'});};
App._crmAutoDel=async(id)=>{var b=_crmBoard(CRM._autoBoard);if(!b)return;if(!(await _crmConfirmP('Delete automation','This rule stops running immediately.','Delete rule'))){App._crmAutoRender();return;}b.settings.automations=_crmAutos(b).filter(function(x){return x.id!==id;});App._crmAutoRender();sbWrite({table:'crm_boards',op:'update',id:b.id,match:{col:'id',val:b.id},values:{settings:b.settings}},{label:'Automation'});};
App._crmTogDetails=()=>{
  var mob=window.matchMedia&&window.matchMedia('(max-width:767px)').matches;
  if(mob){CRM.detailsOpen=true;CRM._mobDetails=!CRM._mobDetails;rr();return;}
  CRM.detailsOpen=CRM.detailsOpen===false?true:false;rr();
};
/* Kanban board view removed — it was orphaned (never rendered); the table view is the only board renderer. */
// ===== CRM ticket-board TABLE view (dynamic columns) =====
async function _crmNotifyEvent(board,event,convo,emailType,vars){var list=_crmExpandPeople((board&&board.settings&&board.settings.notify&&board.settings.notify[event])||[]).filter(function(u){return u!==S.uid;});if(!list.length)return;var who=me()?fullName(me()):'Someone';var at=new Date().toISOString();var label=event==='approved'?'✅ Approved':event==='rejected'?'❌ Rejected':event==='moved'?'↪ Moved':'🔔 Update';var txt=label+': "'+(convo.title||'')+'" by '+who;var _lnk3=convo&&convo.id?('crm:'+convo.id):null;for(var i=0;i<list.length;i++){if(_crmInappOn('crm_ticket')){var nid=uid('n');try{DB.notifications.unshift({id:nid,userId:list[i],text:txt,time:at,read:false,link:_lnk3});}catch(e){}try{await sb.from('notifications').insert({id:nid,user_id:list[i],text:txt,read:false,created_at:at,link:_lnk3});}catch(e){}}if(emailType&&typeof queueEmail==='function'){try{queueEmail(emailType,list[i],null,null,vars||{});}catch(e){}}}try{_invalidateNotifCache();}catch(e){}}
function _crmRowStatus(r,board){board=board||_crmBoard(r.boardId);if(can('crm','edit'))return _crmStatusSel(board,r);return _crmStatusChip(board,r.status||'Open');}
/* ── Built-in Assignee — people AND groups (v3.15). Respects crm→assign; scoped to the board. ── */
/* One shared <select> for every assignee editor (table cell, details panel): Unassigned · Groups · People. */
function _crmAsgSelect(convo,board,st){
  var us=_crmBoardPeople(board);var u=convo.assignedTo?uById(convo.assignedTo):null;
  if(u&&!us.some(function(x){return x.id===u.id;}))us=us.concat([u]);
  var gs=_crmBoardGroups(board);var g=convo.assignedGroup?_crmGroup(convo.assignedGroup):null;
  if(g&&!gs.some(function(x){return x.id===g.id;}))gs=[g].concat(gs);
  var cur=convo.assignedGroup?('grp:'+convo.assignedGroup):(convo.assignedTo||'');
  return'<select class="crm-cell" onchange="App._crmAssign(\''+convo.id+'\',this.value)" style="'+st+'"><option value="">Unassigned</option>'
    +(gs.length?'<optgroup label="Groups">'+gs.map(function(x){return'<option value="grp:'+x.id+'" '+(cur==='grp:'+x.id?'selected':'')+'>\u{1F465} '+esc(x.name)+' ('+((x.members||[]).length)+')</option>';}).join('')+'</optgroup>':'')
    +(gs.length?'<optgroup label="People">':'')+us.map(function(x){return'<option value="'+x.id+'" '+(String(x.id)===String(cur)?'selected':'')+'>'+esc(fullName(x))+'</option>';}).join('')+(gs.length?'</optgroup>':'')
  +'</select>';
}
function _crmAsgCell(r,board){
  var u=r.assignedTo?uById(r.assignedTo):null;var g=r.assignedGroup?_crmGroup(r.assignedGroup):null;
  if(!can('crm','assign'))return u?'<span style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:#3A312A;padding:5px 7px">'+avatar(u,'w-5 h-5','text-[8px]')+esc(fullName(u))+'</span>':(g?'<span style="padding:5px 7px;display:inline-flex;max-width:100%">'+_crmGroupChip(g)+'</span>':'<span style="color:#A8998A;padding:5px 7px;font-size:12.5px">—</span>');
  var st='width:100%;box-sizing:border-box;border:1px solid transparent;background:transparent;border-radius:6px;padding:5px 7px;font-size:12.5px;outline:none;color:#13171B;cursor:pointer';
  return _crmAsgSelect(r,board,st);
}
/* ── Column resize handle (shared widths, saved on board.settings.colWidths — CRM edit only) ── */
function _crmRz(boardId,key){if(!can('crm','edit'))return'';return'<span class="crm-rz" onmousedown="App._crmColRzStart(event,\''+boardId+'\',\''+key+'\')" ondragstart="event.preventDefault();event.stopPropagation();return false" title="Drag to resize"></span>';}
App._crmColRzStart=(e,boardId,key)=>{
  if(!can('crm','edit'))return;
  e.preventDefault();e.stopPropagation();
  var th=e.target&&e.target.closest?e.target.closest('th'):null;if(!th)return;
  var startX=e.clientX,startW=th.getBoundingClientRect().width;CRM._rzW=null;
  var wasDrag=th.getAttribute('draggable');th.setAttribute('draggable','false');
  document.body.style.userSelect='none';document.body.style.cursor='col-resize';
  var mv=function(ev){var w=Math.max(70,Math.round(startW+(ev.clientX-startX)));th.style.width=w+'px';th.style.minWidth=w+'px';th.style.maxWidth=w+'px';CRM._rzW=w;};
  var up=function(){
    document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);
    document.body.style.userSelect='';document.body.style.cursor='';
    if(wasDrag!=null)th.setAttribute('draggable',wasDrag);
    var b=_crmBoard(boardId);var w=CRM._rzW;CRM._rzW=null;if(!b||!w)return;
    if(!b.settings)b.settings={};var cw=Object.assign({},b.settings.colWidths||{});cw[key]=w;b.settings.colWidths=cw;
    sbWrite({table:'crm_boards',op:'update',id:b.id,match:{col:'id',val:b.id},values:{settings:b.settings}},{label:'Column width',silent:true});
  };
  document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
};
/* v3.16.1 — Safari renders EMPTY date/time inputs with a ghost value (today's date / a default
   time) in full ink, so an untouched cell looks saved. Empty cells now render grey; the value
   turns ink only once actually committed. Commits on change AND blur (Safari sometimes skips
   change), deduped via data-v so automations never run twice for one edit. */
App._crmDTCell=(el,rid,cid)=>{
  var v=el.value||'';
  if(v===(el.getAttribute('data-v')||''))return;
  el.setAttribute('data-v',v);
  el.style.color=v?'#13171B':'#BCAFA1';
  App._crmSetCell(rid,cid,v);
};
function _crmCell(r,col){
  var v=(r.fields&&r.fields[col.id]!=null)?r.fields[col.id]:'';
  /* v3.15 access fix: without Workspace→Edit the cell used to LOOK editable but silently did
     nothing — now it renders read-only, matching how Status and Assignee already behave. */
  if(!can('crm','edit')){
    var ro='display:block;padding:5px 7px;font-size:12.5px;color:#3A312A;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    if(col.type==='checkbox')return'<div style="display:flex;justify-content:center">'+((v==='1'||v===true)?'<span style="color:#54433C">'+ic('approve','w-4 h-4')+'</span>':'<span style="color:#D2C5B7;font-size:12.5px">—</span>')+'</div>';
    if(col.type==='person'){var pu=v?uById(v):null;return pu?'<span style="display:inline-flex;align-items:center;gap:6px;padding:5px 7px;font-size:12.5px;font-weight:600;color:#3A312A">'+avatar(pu,'w-5 h-5','text-[8px]')+esc(fullName(pu))+'</span>':'<span style="color:#A8998A;padding:5px 7px;font-size:12.5px">—</span>';}
    if(col.type==='url'&&v)return'<a href="'+esc(v)+'" target="_blank" rel="noopener" style="'+ro+';color:#54433C">'+esc(v)+'</a>';
    return'<span style="'+ro+(String(v).trim()===''?';color:#A8998A':'')+'">'+(String(v).trim()===''?'—':esc(v))+'</span>';
  }
  var b='width:100%;box-sizing:border-box;border:1px solid transparent;background:transparent;border-radius:6px;padding:5px 7px;font-size:12.5px;outline:none;color:#13171B';
  var oc='class="crm-cell" onchange="App._crmSetCell(\''+r.id+'\',\''+col.id+'\',this.value)"';
  if(col.type==='number')return'<input type="number" value="'+esc(v)+'" '+oc+' style="'+b+'" placeholder="0"/>';
  if(col.type==='currency')return'<input type="number" step="0.01" value="'+esc(v)+'" '+oc+' style="'+b+'" placeholder="0.00"/>';
  if(col.type==='date'||col.type==='time'){var dtc='data-v="'+esc(v)+'" onchange="App._crmDTCell(this,\''+r.id+'\',\''+col.id+'\')" onblur="App._crmDTCell(this,\''+r.id+'\',\''+col.id+'\')"';
    return'<input type="'+col.type+'" value="'+esc(v)+'" class="crm-cell" '+dtc+' style="'+b+(String(v).trim()===''?';color:#BCAFA1':'')+'" title="'+(String(v).trim()===''?'Empty — click to pick':'')+'"/>';}
  if(col.type==='checkbox')return'<div style="display:flex;justify-content:center"><input type="checkbox" '+((v==='1'||v===true)?'checked':'')+' onchange="App._crmSetCell(\''+r.id+'\',\''+col.id+'\',this.checked?\'1\':\'\')" style="width:16px;height:16px;accent-color:#54433C;cursor:pointer"/></div>';
  if(col.type==='person'){var us=_crmBoardPeople(_crmBoard(r.boardId));if(v&&!us.some(function(u){return String(u.id)===String(v);})&&uById(v))us=us.concat([uById(v)]);return'<select '+oc+' style="'+b+';cursor:pointer"><option value="">\u2014</option>'+us.map(function(u){return'<option value="'+u.id+'" '+(String(u.id)===String(v)?'selected':'')+'>'+esc(fullName(u))+'</option>';}).join('')+'</select>';}
  if(col.type==='dropdown'){var opts=(col.options||[]);return'<select '+oc+' style="'+b+';cursor:pointer"><option value="">\u2014</option>'+opts.map(function(o){return'<option '+(String(o)===String(v)?'selected':'')+'>'+esc(o)+'</option>';}).join('')+'</select>';}
  if(col.type==='email')return'<input type="email" value="'+esc(v)+'" '+oc+' style="'+b+'" placeholder="name@\u2026"/>';
  if(col.type==='phone')return'<input type="tel" value="'+esc(v)+'" '+oc+' style="'+b+'" placeholder="+971\u2026"/>';
  if(col.type==='url')return'<div style="display:flex;align-items:center;gap:4px"><input type="url" value="'+esc(v)+'" '+oc+' style="'+b+';flex:1" placeholder="https://\u2026"/>'+(v?'<a href="'+esc(v)+'" target="_blank" rel="noopener" title="Open link" style="color:#54433C;flex-shrink:0;display:grid;place-items:center">'+ic('send','w-3.5 h-3.5')+'</a>':'')+'</div>';
  return'<input type="text" value="'+esc(v)+'" '+oc+' style="'+b+'" placeholder="\u2014"/>';
}
function _crmTable(board,opts){
  opts=opts||{};
  var cols=((board.settings&&board.settings.columns)||[]).filter(function(c){return c.type!=='remind';});var canEd=can('crm','edit');var canCr=can('crm','create');
  var canStruct=canEd; // v3.12.1: a filtered view IS the board — same actions everywhere, permissions decide
  var rows=CRM.convos.filter(function(c){return c.boardId===board.id;});
  // opts.filters (a view's saved conditions) beats the ad-hoc board filter
  var flt=(opts.filters!=null)?opts.filters:((CRM.boardFilter||{})[board.id]||[]);
  rows=_crmApplyFilters(rows,flt);
  rows.sort(function(a,b){return String(b.lastAt||'').localeCompare(String(a.lastAt||''));});
  var _cw=(board.settings&&board.settings.colWidths)||{};
  var _w=function(k,d){var w=parseInt(_cw[k],10);return(w&&w>=70)?w:d;};
  var _wst=function(k,d){var w=_w(k,d);return'width:'+w+'px;min-width:'+w+'px;max-width:'+w+'px';};
  var hc='padding:9px 10px;font-size:11px;font-weight:800;color:#786A5F;border-bottom:1px solid #EDE7DC;background:#FAF7F1;text-align:left;white-space:nowrap;position:sticky;top:0;z-index:1';
  var _rzOr=function(k){return canStruct?_crmRz(board.id,k):'';};
  var th='<th style="'+hc+';position:relative;'+_wst('_title',260)+'">Ticket'+_rzOr('_title')+'</th>'
    +'<th style="'+hc+';position:relative;'+_wst('_asg',170)+'">Assignee'+_rzOr('_asg')+'</th>'
    +'<th style="'+hc+';position:relative;'+_wst('_st',150)+'">Status'+_rzOr('_st')+'</th>';
  cols.forEach(function(col){
    th+='<th class="crm-colh" data-cid="'+col.id+'" '+(canStruct?'ondragover="App._crmColDragOver(event)" ondragleave="App._crmColDragLeave(event)" ondrop="App._crmColDrop(event,\''+board.id+'\',\''+col.id+'\')"':'')+' style="'+hc+';'+_wst(col.id,150)+';position:relative">'
      +(canStruct?'<span class="crm-grip" draggable="true" ondragstart="App._crmColDragStart(event,\''+board.id+'\',\''+col.id+'\')" ondragend="App._crmColDragEnd(event)" title="Drag to reorder"><svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor"><circle cx="3" cy="2.5" r="1.3"/><circle cx="7" cy="2.5" r="1.3"/><circle cx="3" cy="7" r="1.3"/><circle cx="7" cy="7" r="1.3"/><circle cx="3" cy="11.5" r="1.3"/><circle cx="7" cy="11.5" r="1.3"/></svg></span>':'')
      +'<span onclick="'+(canStruct?'App._crmColModal(\''+board.id+'\',\''+col.id+'\')':'')+'" title="'+(canStruct?'Click to edit column':'')+'" style="cursor:'+(canStruct?'pointer':'default')+'">'+esc(col.name)+' <span style="font-size:9px;color:#A8998A;font-weight:600">'+esc(col.type)+'</span></span>'
      +(canStruct?'<span class="crm-colx" style="display:none;position:absolute;right:8px;top:8px;background:#FAF7F1;padding-left:3px"><button onclick="event.stopPropagation();App._crmDelCol(\''+board.id+'\',\''+col.id+'\')" title="Delete column" style="border:none;background:transparent;cursor:pointer;color:#B3402E">\u2715</button></span>':'')
      +_rzOr(col.id)
    +'</th>';
  });
  th+='<th style="'+hc+';width:52px"></th>';
  var addRow='';
  if(canCr&&CRM._rowAdd===board.id&&CRM._ntDraft&&CRM._ntDraft.boardId===board.id){
    var _d=CRM._ntDraft;var canAsgN=can('crm','assign');
    var ist='width:100%;box-sizing:border-box;border:1px solid #E6DED3;border-radius:8px;padding:6px 8px;font-size:12.5px;outline:none;background:#fff;color:#13171B';
    var _kd=' onkeydown="if(event.key===\'Enter\')App._crmNtCreate();if(event.key===\'Escape\')App._crmNtCancel();"';
    var ntc='<td style="padding:6px 8px;border-bottom:1px solid #EEE4D5;vertical-align:top">'
      +'<input id="nt-title" value="'+esc(_d.title)+'" oninput="CRM._ntDraft.title=this.value"'+_kd+' placeholder="Ticket title *" style="'+ist+';border-color:#AF7B6D;border-width:1.5px;font-weight:600;margin-bottom:4px"/>'
      +'<input value="'+esc(_d.customer)+'" oninput="CRM._ntDraft.customer=this.value"'+_kd+' placeholder="Customer" style="'+ist+'"/></td>';
    var ntAsg='<td style="padding:6px 8px;border-bottom:1px solid #EEE4D5;vertical-align:top">';
    if(canAsgN){
      var _us=_crmBoardPeople(board),_gs=_crmBoardGroups(board);
      ntAsg+='<select onchange="CRM._ntDraft.assign=this.value" style="'+ist+';cursor:pointer"><option value="">Unassigned</option>'
        +(_gs.length?'<optgroup label="Groups">'+_gs.map(function(g){return'<option value="grp:'+g.id+'" '+(_d.assign==='grp:'+g.id?'selected':'')+'>\u{1F465} '+esc(g.name)+' ('+((g.members||[]).length)+')</option>';}).join('')+'</optgroup>':'')
        +(_gs.length?'<optgroup label="People">':'')+_us.map(function(u){return'<option value="'+u.id+'" '+(_d.assign===u.id?'selected':'')+'>'+esc(fullName(u))+'</option>';}).join('')+(_gs.length?'</optgroup>':'')+'</select>';
    }else ntAsg+='<span style="color:#A8998A;font-size:12px;line-height:30px">—</span>';
    ntAsg+='</td>';
    var ntSt='<td style="padding:6px 8px;border-bottom:1px solid #EEE4D5;vertical-align:top">'
      +(canEd?'<select onchange="CRM._ntDraft.status=this.value" style="'+ist+';cursor:pointer">'+_crmStatuses(board).map(function(x){return'<option '+(x.name===_d.status?'selected':'')+'>'+esc(x.name)+'</option>';}).join('')+'</select>':'<div style="padding:3px 0">'+_crmStatusChip(board,_d.status)+'</div>')+'</td>';
    var ntCols='';
    cols.forEach(function(col){
      ntCols+='<td style="padding:6px 8px;border-bottom:1px solid #EEE4D5;vertical-align:top">'
        +(canEd?_crmNtField(col,board,ist):'<span style="color:#A8998A;font-size:12px;line-height:30px">—</span>')+'</td>';
    });
    var ntAct='<td style="padding:6px 6px;border-bottom:1px solid #EEE4D5;vertical-align:top">'
      +'<button onclick="App._crmNtCreate()" title="Add ticket (Enter)" style="display:block;width:100%;border:none;background:#54433C;color:#fff;border-radius:8px;padding:7px 0;font-size:12px;font-weight:800;cursor:pointer">Add</button>'
      +'<button onclick="App._crmNtCancel()" title="Close (Esc)" style="display:block;width:100%;border:1px solid #E6DED3;background:#fff;color:#786A5F;border-radius:8px;padding:4px 0;margin-top:4px;cursor:pointer;font-weight:700;font-size:12px">×</button></td>';
    addRow='<tr style="background:#FAF8F4">'+ntc+ntAsg+ntSt+ntCols+ntAct+'</tr>';
  }
  var body=rows.map(function(r){
    var tds='<td style="padding:6px 10px;border-bottom:1px solid #F4F0EA;overflow:hidden"><div onclick="App._crmSelConvo(\''+r.id+'\')" style="cursor:pointer"><div style="font-size:13px;font-weight:700;color:#13171B;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(r.title||r.customer||'\u2014')+'</div>'+(r.customer?'<div style="font-size:10.5px;color:#A59788;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(r.customer)+'</div>':'')+'</div></td>';
    tds+='<td style="padding:2px 6px;border-bottom:1px solid #F4F0EA;overflow:hidden">'+_crmAsgCell(r,board)+'</td>';
    tds+='<td style="padding:2px 6px;border-bottom:1px solid #F4F0EA;overflow:hidden">'+_crmRowStatus(r,board)+'</td>';
    cols.forEach(function(col){var cell=_crmCell(r,col);
      tds+='<td style="padding:2px 6px;border-bottom:1px solid #F4F0EA;overflow:hidden">'+cell+'</td>';});
    tds+='<td style="padding:4px 8px;border-bottom:1px solid #F4F0EA;white-space:nowrap;text-align:right">'+(can('crm','delete')?'<button onclick="App._crmDelConvo(\''+r.id+'\')" title="Delete" style="border:none;background:transparent;color:#CEC1B3;cursor:pointer">'+ic('trash','w-3.5 h-3.5')+'</button>':'')+'</td>';
    return'<tr class="crm-trow">'+tds+'</tr>';
  }).join('');
  if(!rows.length&&!addRow)body='<tr><td colspan="99" style="padding:44px;text-align:center;color:#A59788;font-size:13px">'+(flt.length?((opts.filters!=null)?'No tickets match this view\u2019s conditions right now.':'No tickets match the filter \u2014 <b style="color:#54433C">Filter</b> above adjusts or clears it.'):('No tickets yet.'+(canCr?' Hit <b style="color:#54433C">+ New ticket</b> above to add the first one'+((canEd&&opts.filters==null)?', and <b>+ Column</b> to shape the table':'')+'.':'')))+'</td></tr>';
  return'<div class="crm-scroll" style="flex:1;overflow:auto;background:#fff;min-height:0"><table style="width:100%;border-collapse:collapse"><thead><tr>'+th+'</tr></thead><tbody>'+addRow+body+'</tbody></table></div>';
}
/* ── v3.16.4 New-ticket FORM: every column up front, then one Add button.
   Access rules match the table: title/customer come with crm→create; Status, Due date and
   custom columns need crm→edit; Assignee needs crm→assign (groups included). ── */
App._crmRowAddOpen=(boardId)=>{
  if(!can('crm','create'))return toast('No permission to create','err');
  var b=_crmBoard(boardId);if(!b)return;
  CRM._rowAdd=boardId;
  CRM._ntDraft={boardId:boardId,title:'',customer:'',assign:'',status:(_crmStatuses(b)[0]||{name:'Open'}).name,due:'',fields:{}};
  rr();
  setTimeout(function(){var e=document.getElementById('nt-title');if(e)e.focus();},40);
};
function _crmNtField(col,board,st2){
  var d=CRM._ntDraft;var v=(d.fields||{})[col.id];v=(v==null)?'':String(v);
  var st=st2||'width:100%;box-sizing:border-box;border:1.5px solid #EAE3D8;border-radius:10px;padding:9px 11px;font-size:13px;background:#fff;outline:none;color:#13171B';
  var oc='oninput="CRM._ntDraft.fields[\''+col.id+'\']=this.value"';
  var ocs='onchange="CRM._ntDraft.fields[\''+col.id+'\']=this.value"';
  if(col.type==='longtext')return'<textarea rows="3" '+oc+' style="'+st+';resize:vertical;font-family:inherit">'+esc(v)+'</textarea>';
  if(col.type==='number')return'<input type="number" value="'+esc(v)+'" '+oc+' style="'+st+'" placeholder="0"/>';
  if(col.type==='currency')return'<input type="number" step="0.01" value="'+esc(v)+'" '+oc+' style="'+st+'" placeholder="0.00"/>';
  if(col.type==='date'||col.type==='time')return'<input type="'+col.type+'" value="'+esc(v)+'" onchange="CRM._ntDraft.fields[\''+col.id+'\']=this.value;this.style.color=this.value?\'#13171B\':\'#BCAFA1\'" style="'+st+(v?'':';color:#BCAFA1')+'"/>';
  if(col.type==='checkbox')return'<label style="display:inline-flex;align-items:center;gap:8px;font-size:12.5px;font-weight:600;color:#3A312A;cursor:pointer;padding:4px 0"><input type="checkbox" '+((v==='1')?'checked':'')+' onchange="CRM._ntDraft.fields[\''+col.id+'\']=this.checked?\'1\':\'\'" style="width:16px;height:16px;accent-color:#54433C;cursor:pointer"/>Yes</label>';
  if(col.type==='dropdown')return'<select '+ocs+' style="'+st+';cursor:pointer"><option value="">—</option>'+(col.options||[]).map(function(o){return'<option '+(String(o)===v?'selected':'')+'>'+esc(o)+'</option>';}).join('')+'</select>';
  if(col.type==='person'){var us=_crmBoardPeople(board);return'<select '+ocs+' style="'+st+';cursor:pointer"><option value="">—</option>'+us.map(function(u){return'<option value="'+u.id+'" '+(String(u.id)===v?'selected':'')+'>'+esc(fullName(u))+'</option>';}).join('')+'</select>';}
  if(col.type==='email')return'<input type="email" value="'+esc(v)+'" '+oc+' style="'+st+'" placeholder="name@…"/>';
  if(col.type==='phone')return'<input type="tel" value="'+esc(v)+'" '+oc+' style="'+st+'" placeholder="+971…"/>';
  if(col.type==='url')return'<input type="url" value="'+esc(v)+'" '+oc+' style="'+st+'" placeholder="https://…"/>';
  return'<input type="text" value="'+esc(v)+'" '+oc+' style="'+st+'" placeholder="—"/>';
}
App._crmNtCancel=()=>{CRM._ntDraft=null;CRM._rowAdd=null;rr();};
App._crmNtCreate=async()=>{
  if(!can('crm','create'))return toast('No permission to create','err');
  var d=CRM._ntDraft;if(!d)return;var b=_crmBoard(d.boardId);if(!b)return;
  var title=String(d.title||'').trim();if(!title)return toast('Give it a title','err');
  var name=String(d.customer||'').trim()||'—';
  var canEd=can('crm','edit'),canAsg=can('crm','assign');
  var stName=(canEd&&_crmStatuses(b).some(function(x){return x.name===d.status;}))?d.status:(_crmStatuses(b)[0]||{name:'Open'}).name;
  var isGrp=canAsg&&String(d.assign||'').indexOf('grp:')===0;
  var asgG=isGrp?String(d.assign).slice(4):null;if(asgG&&!_crmGroup(asgG))asgG=null;
  var asgU=(canAsg&&!isGrp&&d.assign)?d.assign:null;
  var flds={};if(canEd)Object.keys(d.fields||{}).forEach(function(k){var v=d.fields[k];if(v!=null&&String(v).trim()!=='')flds[k]=v;});
  var due=(canEd&&d.due)?d.due:null;
  var id=uid('cv');var now=new Date().toISOString();
  var c={id:id,boardId:b.id,title:title,customer:name,channel:'Manual',isTicket:true,ticketType:'Ticket',priority:'Medium',status:stName,assignedTo:asgU,assignedGroup:asgG,createdBy:S.uid||null,createdAt:now,lastAt:now,messages:[],fields:flds,dueDate:due};
  CRM.convos.push(c);
  CRM._ntDraft={boardId:b.id,title:'',customer:'',assign:'',status:(_crmStatuses(b)[0]||{name:'Open'}).name,due:'',fields:{}};
  toast('Ticket added ✓');rr();
  setTimeout(function(){var e=document.getElementById('nt-title');if(e)e.focus();},40);
  _crmLog('created',c,'in '+stName);
  sbWrite({table:'crm_conversations',op:'insert',id:id,values:{id:id,board_id:b.id,title:title,customer:name,channel:'Manual',is_ticket:true,ticket_type:'Ticket',priority:'Medium',status:stName,assigned_to:asgU,assigned_group:asgG,fields:flds,due_date:due,created_by:S.uid||null,created_at:now,last_at:now,updated_at:now}},{label:'New ticket'});
  _crmNotifyRule('created',c,b,'crm_ticket',{title:title,type:b.name,customer:name,actor:(me()?fullName(me()):'')});
  try{_crmRunAutos(b,'created',c,{});}catch(e){}
  if(asgU||asgG){try{_crmRunAutos(b,'assigned',c,{to:d.assign});}catch(e){}}
  /* assignment notifications — same as assigning from the table */
  var who=me()?fullName(me()):'Someone';var _lnk='crm:'+id;
  if(asgG){var g=_crmGroup(asgG);_crmLog('assigned',c,'to group “'+(g?g.name:'')+'”');
    var ntxtG='\u{1F3AF} '+who+' assigned your group “'+(g?g.name:'')+'”: "'+title+'"';
    ((g&&g.members)||[]).filter(function(x){var u=uById(x);return u&&u.status!=='Disabled'&&x!==S.uid;}).forEach(function(mid){
      if(_crmInappOn('crm_ticket')){var nid=uid('n');try{DB.notifications.unshift({id:nid,userId:mid,text:ntxtG,time:now,read:false,link:_lnk});}catch(e){}sbWrite({table:'notifications',op:'insert',id:nid,values:{id:nid,user_id:mid,text:ntxtG,read:false,created_at:now,link:_lnk}},{label:'Notify',silent:true});}
      if(typeof queueEmail==='function'){try{queueEmail('crm_ticket',mid,null,null,{title:title,customer:name,actor:who});}catch(e){}}
    });
    try{_invalidateNotifCache();}catch(e){}
  }else if(asgU&&asgU!==S.uid){_crmLog('assigned',c,'to '+(uById(asgU)?fullName(uById(asgU)):''));
    var ntxt='\u{1F3AF} '+who+' assigned you: "'+title+'"';
    if(_crmInappOn('crm_ticket')){var nid2=uid('n');try{DB.notifications.unshift({id:nid2,userId:asgU,text:ntxt,time:now,read:false,link:_lnk});}catch(e){}sbWrite({table:'notifications',op:'insert',id:nid2,values:{id:nid2,user_id:asgU,text:ntxt,read:false,created_at:now,link:_lnk}},{label:'Notify',silent:true});try{_invalidateNotifCache();}catch(e){}}
    if(typeof queueEmail==='function'){try{queueEmail('crm_ticket',asgU,null,null,{title:title,customer:name,actor:who});}catch(e){}}
  }
};
/* ── Column add/edit modal (replaces prompt() flow) ── */
/* ── Column add/edit modal (replaces prompt() flow) ── */
App._crmColModal=(boardId,colId)=>{
  if(!can('crm','edit'))return toast('No permission','err');
  var b=_crmBoard(boardId);if(!b)return;
  var col=colId?((b.settings&&b.settings.columns)||[]).find(function(c){return c.id===colId;}):null;
  CRM._colEdit={boardId:boardId,colId:col?col.id:null,name:col?col.name:'',type:col?col.type:'text',options:(col&&col.options?col.options.join('\n'):'')};
  App._crmColModalRender();
};
App._crmColModalRender=()=>{
  var d=CRM._colEdit;if(!d)return;
  var types=[['text','Text'],['longtext','Long text'],['number','Number'],['currency','Currency'],['date','Date'],['time','Time'],['dropdown','Dropdown'],['checkbox','Checkbox'],['person','Person'],['email','Email'],['phone','Phone'],['url','Link']];
  var pills=types.map(function(t){var on=d.type===t[0];return'<button onclick="CRM._colEdit.type=\''+t[0]+'\';App._crmColModalRender()" style="padding:8px 14px;border-radius:9px;border:1.5px solid '+(on?'#54433C':'#E6DED3')+';background:'+(on?'#EEE4D5':'#fff')+';color:'+(on?'#3E322B':'#786A5F')+';font-size:12.5px;font-weight:700;cursor:pointer">'+t[1]+'</button>';}).join('');
  modalShell({title:d.colId?'Edit column':'New column',sub:'Columns are this board\u2019s fields \u2014 automations can react to them.',size:'max-w-md',key:'crm-col',
    body:'<label class="ui-label">Column name</label><input value="'+esc(d.name)+'" oninput="CRM._colEdit.name=this.value" placeholder="e.g. Order #, Amount, Approval" class="ui-input" style="margin-bottom:14px"/>'
      +'<label class="ui-label">Type</label><div style="display:flex;gap:6px;flex-wrap:wrap">'+pills+'</div>'
      +(d.type==='dropdown'?'<label class="ui-label" style="margin-top:14px">Options (one per line)</label><textarea oninput="CRM._colEdit.options=this.value" rows="4" class="ui-input" style="resize:vertical;font-family:inherit" placeholder="Pending\u000AApproved\u000ARejected">'+esc(d.options)+'</textarea>':'')
      ,
    footer:(d.colId?'<button onclick="App._crmDelCol(\''+d.boardId+'\',\''+d.colId+'\');App.closeModal()" class="ui-btn ui-btn-danger ui-btn-sm" style="margin-right:auto">Delete</button>':'')+btnG('Cancel','App.closeModal()')+btnP(d.colId?'Save column':'Add column','App._crmColSave()')});
};
App._crmColSave=async()=>{
  var d=CRM._colEdit;if(!d)return;var b=_crmBoard(d.boardId);if(!b)return;
  var name=(d.name||'').trim();if(!name)return toast('Name the column','err');
  if(!b.settings)b.settings={};var cols=(b.settings.columns||[]).slice();
  var opts=(d.type==='dropdown')?String(d.options||'').split(/\n|,/).map(function(x){return x.trim();}).filter(Boolean):null;
  if(d.type==='dropdown'&&(!opts||!opts.length))return toast('Add at least one option','err');
  if(d.colId){var col=cols.find(function(c){return c.id===d.colId;});if(col){col.name=name;col.type=d.type;if(opts)col.options=opts;else delete col.options;}}
  else{var nc={id:uid('col'),name:name,type:d.type};if(opts)nc.options=opts;cols.push(nc);}
  b.settings.columns=cols;CRM._colEdit=null;closeModal();rr();
  sbWrite({table:'crm_boards',op:'update',id:b.id,match:{col:'id',val:b.id},values:{settings:b.settings}},{label:'Column'});
  toast('Column saved \u2713');
};
/* ── Column drag-to-reorder ── */
App._crmColDragStart=(e,boardId,colId)=>{CRM._dragCol={boardId:boardId,colId:colId,after:false};try{e.dataTransfer.setData('text/plain',colId);e.dataTransfer.effectAllowed='move';var th=e.target&&e.target.closest?e.target.closest('th'):null;if(th){th.classList.add('crm-dragging');try{e.dataTransfer.setDragImage(th,24,18);}catch(x){}}}catch(x){}};
App._crmColDragEnd=()=>{CRM._dragCol=null;try{document.querySelectorAll('.crm-colh').forEach(function(t){t.classList.remove('crm-dragging','crm-drop-l','crm-drop-r');});}catch(x){}};
App._crmColDragOver=(e)=>{var d=CRM._dragCol;if(!d)return;e.preventDefault();try{e.dataTransfer.dropEffect='move';}catch(x){}var th=e.currentTarget;if(!th||th.getAttribute('data-cid')===d.colId){return;}
  var r=th.getBoundingClientRect();var after=(e.clientX-r.left)>r.width/2;
  try{document.querySelectorAll('.crm-colh.crm-drop-l,.crm-colh.crm-drop-r').forEach(function(t){if(t!==th)t.classList.remove('crm-drop-l','crm-drop-r');});}catch(x){}
  th.classList.toggle('crm-drop-r',after);th.classList.toggle('crm-drop-l',!after);d.after=after;};
App._crmColDragLeave=(e)=>{var th=e.currentTarget;try{if(!th.contains(e.relatedTarget))th.classList.remove('crm-drop-l','crm-drop-r');}catch(x){th.classList.remove('crm-drop-l','crm-drop-r');}};
App._crmColDrop=async(e,boardId,targetColId)=>{
  e.preventDefault();var d=CRM._dragCol;CRM._dragCol=null;
  try{document.querySelectorAll('.crm-colh').forEach(function(t){t.classList.remove('crm-dragging','crm-drop-l','crm-drop-r');});}catch(x){}
  if(!d||d.boardId!==boardId||d.colId===targetColId)return;
  var b=_crmBoard(boardId);if(!b||!b.settings)return;var cols=(b.settings.columns||[]).slice();
  var from=cols.findIndex(function(c){return c.id===d.colId;});if(from<0)return;
  var m=cols.splice(from,1)[0];
  var to=cols.findIndex(function(c){return c.id===targetColId;});
  if(to<0){cols.splice(from,0,m);}else{cols.splice(to+(d.after?1:0),0,m);}
  b.settings.columns=cols;rr();
  sbWrite({table:'crm_boards',op:'update',id:b.id,match:{col:'id',val:b.id},values:{settings:b.settings}},{label:'Column order'});
};
App._crmBackToTable=()=>{CRM.sel.convoId=null;CRM.sel.threadId=null;rr();};
App._crmSetCell=async(id,colId,val)=>{if(!can('crm','edit'))return;var c=_crmConvo(id);if(!c)return;if(!c.fields)c.fields={};c.fields[colId]=val;try{await sb.from('crm_conversations').update({fields:c.fields}).eq('id',id);}catch(e){}try{_crmRunAutos(_crmBoard(c.boardId),'column',c,{colId:colId,value:val});}catch(e){}};
App._crmAddCol=(boardId)=>App._crmColModal(boardId);
App._crmDelCol=async(boardId,colId)=>{if(!can('crm','edit'))return;var b=_crmBoard(boardId);if(!b||!b.settings)return;
  // Guard: a column that still holds values on any ticket cannot be deleted — clear the values first.
  var col=(b.settings.columns||[]).find(function(c){return c.id===colId;});
  var used=CRM.convos.filter(function(c){if(c.boardId!==boardId||!c.fields)return false;var v=c.fields[colId];return v!=null&&String(v).trim()!=='';}).length;
  if(used)return toast('“'+((col&&col.name)||'Column')+'” still has values on '+used+' ticket'+(used===1?'':'s')+' — clear them before deleting the column','err');
  if(!(await _crmConfirmP('Delete column','The “'+esc((col&&col.name)||'')+'” column is empty and will be removed from this board.','Delete column')))return;b.settings.columns=(b.settings.columns||[]).filter(function(c){return c.id!==colId;});rr();try{await sb.from('crm_boards').update({settings:b.settings}).eq('id',b.id);}catch(e){}};
App._crmRenameCol=(boardId,colId)=>App._crmColModal(boardId,colId);
App._crmMoveCol=async(boardId,colId,dir)=>{if(!can('crm','edit'))return;var b=_crmBoard(boardId);if(!b||!b.settings)return;var cols=(b.settings.columns||[]).slice();var i=cols.findIndex(function(c){return c.id===colId;});var j=i+dir;if(i<0||j<0||j>=cols.length)return;var t=cols[i];cols[i]=cols[j];cols[j]=t;b.settings.columns=cols;rr();try{await sb.from('crm_boards').update({settings:b.settings}).eq('id',b.id);}catch(e){}};
App._crmMoveConvo=async(id,boardId)=>{if(!can('crm','edit'))return toast('No permission','err');var c=_crmConvo(id);if(!c)return;var tb=_crmBoard(boardId);if(!tb)return;var isTk=_crmBS(tb).type!=='chat';c.boardId=boardId;c.isTicket=isTk;if(isTk&&!c.ticketType)c.ticketType='Ticket';c.decision=null;c.decidedBy=null;c.decidedAt=null;var d=document.getElementById('crm-move');if(d)d.style.display='none';if(CRM.sel.convoId===id)CRM.sel.convoId=null;toast('Moved to '+tb.name+' ✓');rr();await _crmLog('moved',c,'to '+tb.name);sbWrite({table:'crm_conversations',op:'update',id:id,match:{col:'id',val:id},values:{board_id:boardId,is_ticket:c.isTicket,ticket_type:c.ticketType,decision:null,decided_by:null,decided_at:null,updated_at:new Date().toISOString()}},{label:'Move conversation'});if(isTk){if(typeof _crmNotifyEvent==='function')_crmNotifyEvent(tb,'moved',c,'crm_ticket',{title:c.title,type:tb.name,customer:c.customer});_crmNotifyRule('created',c,tb,'crm_ticket',{title:c.title,type:tb.name,customer:c.customer});}try{_crmRunAutos(tb,'moved',c,{});}catch(e){}};
App._crmSaveBoardSettings=async()=>{if(!(can('crm','edit')||can('crm','manage')))return toast('No permission','err');var b=_crmBoard(CRM._bsBoardId||CRM.sel.boardId);if(!b)return;function _chk(ev){var out=[];(DB.users||[]).forEach(function(u){var el=document.getElementById('crmn-'+ev+'-'+u.id);if(el&&el.checked)out.push(u.id);});_crmGroups().forEach(function(g){var el=document.getElementById('crmn-'+ev+'-grp-'+g.id);if(el&&el.checked)out.push('grp:'+g.id);});return out;}if(!b.settings)b.settings={};b.settings.notify=Object.assign({},b.settings.notify||{},{moved:_chk('moved'),approved:_chk('approved'),rejected:_chk('rejected')});CRM.boardSettingsOpen=false;toast('Board rules saved ✓');rr();sbWrite({table:'crm_boards',op:'update',id:b.id,match:{col:'id',val:b.id},values:{settings:b.settings}},{label:'Board rules'});};

/* v3.14 — a permission fallback IS a navigation, so the filter bag has to move with it.
   Previously these branches reassigned S.route mid-render while S.filters still held the
   bag restoreFilters() had just loaded for the route that was refused. The next redraw
   then called saveFilters() with S.route='dashboard' and the wrong contents, overwriting
   (usually emptying) whatever the dashboard had genuinely saved. */
function _reroute(r){S.route=r;try{if(typeof restoreFilters==='function')restoreFilters(r);}catch(e){}return _pageInner();}
function _pageInner(){
  const r=S.route;
  if(r==='dashboard'){if(can('analytics','view'))return dashboardPage();return _reroute('mychecklists');}
  if(r==='users'){if(can('employees','view'))return usersPage();return _reroute('dashboard');}
  if(r==='departments'){if(can('departments','view'))return deptsPage();return _reroute('dashboard');}
  if(r==='locations'){if(can('locations','view'))return locsPage();return _reroute('dashboard');}
  if(r==='checklists'){if(can('checklists','create'))return clsPage();return _reroute('dashboard');}
  if(r==='approvals'){if(can('approvals','view'))return approvalsPage();return _reroute('notifications');}
  if(r==='notifications')return notificationsPage();
  if(r==='tickets'){if(can('tickets','view'))return ticketsPage();return _reroute('mychecklists');}
  if(r==='hierarchy')return hierarchyPage();
  if(r==='analytics'){return _reroute('dashboard');} // Analytics tab removed — old links land on the Dashboard
  if(r==='audit'){if(can('audit','view'))return auditPage();return _reroute('dashboard');}
  if(r==='settings'){if(can('settings','view'))return settingsPage();return _reroute('dashboard');}
  if(r==='questions'){if(can('questions','view'))return questionsPage();return _reroute('mychecklists');}
  if(r==='mychecklists')return myClsPage();
  if(r==='teamview'){if(can('teamview','view'))return teamViewPage();return _reroute('mychecklists');}
  if(r==='allcl'){if(can('allChecklists','view'))return allClsPage();if(can('teamview','view'))return _reroute('teamview');return _reroute('dashboard');}
  if(r==='profile')return profilePage();
  if(r==='okr'){if(can('okr','view'))return okrPage();return _reroute('dashboard');}
  if(r==='accesscontrol'){if(can('accessControl','view'))return accessControlPage();return _reroute('dashboard');}
  if(r==='crm'){if(can('crm','view'))return crmPage();return _reroute('dashboard');}
  return empty('grid','Not found','');
}


/* ── Hub wrapper: after the inner router settles on the FINAL route (fallbacks may
   reassign it), prepend the hub pill strip when that route belongs to a hub. ── */
function pageContent(){
  const html=_pageInner();
  const hub=(typeof _hubOf==='function')?_hubOf(S.route):null;
  return hub?('<div class="fade">'+_hubStrip(hub)+'</div>'+html):html;
}


/* ══════════════════════════════════════════════════════════════════════════════
   v3.18 — STICKY WORKSPACE POSITION + LIVE CHAT
   1. Where you were (hub · board · filtered view · conversation) survives a refresh.
   2. Messages arrive by themselves: Supabase Realtime push, with a polling safety net.
   ══════════════════════════════════════════════════════════════════════════════ */

/* ─── 1. Sticky position ─────────────────────────────────────────────────────
   Stamped with the user id for the same reason the filter memory is: people close
   the browser without signing out, and the next person on that machine must not
   inherit a board they cannot even see. */
const CRM_SEL_KEY='bridge_crm_sel_v1';
let _crmSelLastWritten='';
function _crmSaveSel(){
  if(!S.uid||!CRM||!CRM.sel)return;
  try{
    var str=JSON.stringify({uid:S.uid,sel:{hubId:CRM.sel.hubId||null,boardId:CRM.sel.boardId||null,viewId:CRM.sel.viewId||null,convoId:CRM.sel.convoId||null}});
    if(str===_crmSelLastWritten)return;               // no-op unless something actually moved
    localStorage.setItem(CRM_SEL_KEY,str);_crmSelLastWritten=str;
  }catch(e){}
}
function _crmRestoreSel(){
  try{
    var p=JSON.parse(localStorage.getItem(CRM_SEL_KEY)||'{}')||{};
    if(!p.sel||!p.uid)return;
    if(S.uid&&p.uid!==S.uid)return;                   // someone else's position — ignore
    CRM.sel.hubId=p.sel.hubId||null;CRM.sel.boardId=p.sel.boardId||null;
    CRM.sel.viewId=p.sel.viewId||null;CRM.sel.convoId=p.sel.convoId||null;
  }catch(e){}
}
function _crmClearSel(){try{localStorage.removeItem(CRM_SEL_KEY);}catch(e){}_crmSelLastWritten='';}
window._crmClearSel=_crmClearSel;

/* ─── 2. Live feed ─────────────────────────────────────────────────────────── */
var _crmRT={ch:null,status:'',poll:null,bound:false,tick:0,lastTs:null,busy:false,sBusy:false,fresh:{}};
/* Rows created on THIS client are immune to delete-reconcile for 5 min — a slow or queued
   insert must not be 'reconciled away' before it reaches the server. Server-pushed DELETE
   events are NOT guarded: a confirmed delete always wins. */
function _crmMarkFresh(id){if(id)_crmRT.fresh[id]=Date.now();}
function _crmIsFresh(id){var t=_crmRT.fresh[id];if(!t)return false;if(Date.now()-t>300000){delete _crmRT.fresh[id];return false;}return true;}

function _crmLiveInitTs(){
  var mx='';
  (CRM.convos||[]).forEach(function(c){(c.messages||[]).forEach(function(m){if(m.at&&String(m.at)>mx)mx=String(m.at);});});
  _crmRT.lastTs=mx||new Date(Date.now()-864e5).toISOString();
}
function _crmRowToMsg(r){
  return {id:r.id,senderId:r.sender_id,fromCustomer:r.from_customer,name:r.name,text:r.body||'',
          images:r.images||[],at:r.created_at,reactions:r.reactions||{},parentId:r.parent_id||null,edited:!!r.edited_at};
}
function _crmRowToConvo(r){
  return {id:r.id,boardId:r.board_id,title:r.title,customer:r.customer,channel:r.channel,isTicket:r.is_ticket,
          ticketType:r.ticket_type,priority:r.priority||'Medium',status:r.status||'Open',assignedTo:r.assigned_to||null,
          assignedGroup:r.assigned_group||null,createdBy:r.created_by||null,decision:r.decision||null,decidedBy:r.decided_by||null,decidedAt:r.decided_at||null,
          fields:r.fields||{},dueDate:r.due_date||null,createdAt:r.created_at,lastAt:r.last_at,messages:[]};
}
/* Apply one message row. Returns true when it actually changed something —
   our own optimistic inserts come back over the wire and must be no-ops. */
function _crmMergeMsgRow(r,evt){
  if(!r||!r.id)return false;
  var c=_crmConvo(r.conversation_id);
  if(!c){_crmRT.needConvos=true;return false;}
  if(!c.messages)c.messages=[];
  var i=c.messages.findIndex(function(x){return x.id===r.id;});
  if(evt==='DELETE'){
    if(i<0)return false;
    c.messages=c.messages.filter(function(x){return x.id!==r.id&&x.parentId!==r.id;});
    if(CRM.sel.threadId===r.id)CRM.sel.threadId=null;
    return true;
  }
  var m=_crmRowToMsg(r);
  if(i<0){
    c.messages.push(m);
    c.messages.sort(function(a,b){return String(a.at||'').localeCompare(String(b.at||''));});
    if(!c.lastAt||String(m.at)>String(c.lastAt))c.lastAt=m.at;
    if(m.at&&(!_crmRT.lastTs||String(m.at)>_crmRT.lastTs))_crmRT.lastTs=String(m.at);
    try{if(m.senderId!==S.uid&&m.at&&(Date.now()-new Date(m.at).getTime())<90000)_crmDing(m);}catch(e){}
    return true;
  }
  var old=c.messages[i];
  if(old.text===m.text&&!!old.edited===!!m.edited&&JSON.stringify(old.reactions||{})===JSON.stringify(m.reactions||{})
     &&JSON.stringify(old.images||[])===JSON.stringify(m.images||[]))return false;
  c.messages[i]=Object.assign(old,{text:m.text,edited:m.edited,reactions:m.reactions,images:m.images});
  return true;
}
function _crmMergeConvoRow(r,evt){
  if(!r||!r.id)return false;
  var i=(CRM.convos||[]).findIndex(function(x){return x.id===r.id;});
  if(evt==='DELETE'){
    if(i<0)return false;
    CRM.convos.splice(i,1);
    if(CRM.sel.convoId===r.id){CRM.sel.convoId=null;CRM.sel.threadId=null;}
    return true;
  }
  if(i<0){
    if(!_crmVisibleBoardIds()[r.board_id])return false;   // a board this user can't see
    CRM.convos.unshift(_crmRowToConvo(r));
    _crmRT.needMsgsFor=r.id;
    return true;
  }
  var c=CRM.convos[i],n=_crmRowToConvo(r),ch=false;
  ['boardId','title','customer','channel','isTicket','ticketType','priority','status','assignedTo','assignedGroup','decision','decidedBy','decidedAt','dueDate','lastAt'].forEach(function(k){
    if(JSON.stringify(c[k])!==JSON.stringify(n[k])){c[k]=n[k];ch=true;}
  });
  if(JSON.stringify(c.fields||{})!==JSON.stringify(n.fields||{})){c.fields=n.fields;ch=true;}
  return ch;
}
/* ── v3.15: STRUCTURE stays in sync live — boards (columns/statuses/automations/widths/renames),
   hubs, filtered views, board membership and people-groups all broadcast to every open client.
   Same rules as conversations: last write wins, own echoes are no-ops via JSON compare. ── */
function _crmMergeHubRow(r,evt){
  if(!r||!r.id)return false;
  var i=(CRM.hubs||[]).findIndex(function(x){return x.id===r.id;});
  if(evt==='DELETE'){
    if(i<0)return false;
    CRM.hubs.splice(i,1);
    var bids=CRM.boards.filter(function(b){return b.hubId===r.id;}).map(function(b){return b.id;});
    CRM.boards=CRM.boards.filter(function(b){return b.hubId!==r.id;});
    CRM.views=(CRM.views||[]).filter(function(v){return v.hubId!==r.id;});
    CRM.convos=CRM.convos.filter(function(c){return bids.indexOf(c.boardId)<0;});
    if(CRM.sel.hubId===r.id){CRM.sel.hubId=null;CRM.sel.boardId=null;CRM.sel.viewId=null;CRM.sel.convoId=null;CRM.sel.threadId=null;}
    return true;
  }
  var n={id:r.id,name:r.name,icon:r.icon||'folder'};
  if(i<0){CRM.hubs.push(n);return true;}
  var c=CRM.hubs[i],ch=false;
  ['name','icon'].forEach(function(k){if(c[k]!==n[k]){c[k]=n[k];ch=true;}});
  return ch;
}
function _crmMergeBoardRow(r,evt){
  if(!r||!r.id)return false;
  var i=(CRM.boards||[]).findIndex(function(x){return x.id===r.id;});
  if(evt==='DELETE'){
    if(i<0)return false;
    CRM.boards.splice(i,1);
    CRM.convos=CRM.convos.filter(function(c){return c.boardId!==r.id;});
    if(CRM.sel.boardId===r.id){CRM.sel.boardId=null;CRM.sel.convoId=null;CRM.sel.threadId=null;}
    return true;
  }
  if(i<0){CRM.boards.push({id:r.id,hubId:r.hub_id,name:r.name,members:[],settings:r.settings||{},createdBy:r.created_by||null});return true;}
  var b=CRM.boards[i],ch=false;
  if(b.hubId!==r.hub_id){b.hubId=r.hub_id;ch=true;}
  if(b.name!==r.name){b.name=r.name;ch=true;}
  var cb2=r.created_by||null;if(b.createdBy!==cb2){b.createdBy=cb2;ch=true;}
  var ns=r.settings||{};
  if(JSON.stringify(b.settings||{})!==JSON.stringify(ns)){b.settings=ns;ch=true;}   // columns, statuses, automations, widths
  return ch;   // members ride on crm_board_members events, not this row
}
function _crmMergeViewRow(r,evt){
  if(!r||!r.id)return false;
  if(!CRM.views)CRM.views=[];
  var i=CRM.views.findIndex(function(x){return x.id===r.id;});
  if(evt==='DELETE'){
    if(i<0)return false;
    CRM.views.splice(i,1);
    if(CRM.sel.viewId===r.id){CRM.sel.viewId=null;CRM.sel.convoId=null;CRM.sel.threadId=null;}
    return true;
  }
  var fl=r.filters;
  if(fl&&typeof fl==='object'&&!Array.isArray(fl)){}else if(Array.isArray(fl)&&fl.length&&r.board_id){var _m={};_m[r.board_id]=fl;fl=_m;}else{fl={};}
  var n={id:r.id,hubId:r.hub_id,name:r.name||'',filters:fl,members:Array.isArray(r.members)?r.members:[],createdBy:r.created_by||null,sort:r.sort||0};
  var ch;
  if(i<0){CRM.views.push(n);CRM.views.sort(function(a,b){return (a.sort||0)-(b.sort||0);});ch=true;}
  else if(JSON.stringify(CRM.views[i])===JSON.stringify(n))ch=false;
  else{CRM.views[i]=n;CRM.views.sort(function(a,b){return (a.sort||0)-(b.sort||0);});ch=true;}
  if(ch&&CRM.sel.viewId===r.id&&!_crmViewVisible(n)){CRM.sel.viewId=null;CRM.sel.boardId=null;CRM.sel.convoId=null;CRM.sel.threadId=null;}
  return ch;
}
function _crmMergeBoardMemberRow(r,evt){
  if(!r||!r.board_id||!r.user_id)return false;
  var b=_crmBoard(r.board_id);if(!b)return false;
  if(!b.members)b.members=[];
  var i=b.members.indexOf(r.user_id);
  if(evt==='DELETE'){if(i<0)return false;b.members.splice(i,1);}
  else{if(i>=0)return false;b.members.push(r.user_id);}
  if(r.user_id===S.uid&&!CRM.sel.viewId){          // my own board access changed (views grant their own access)
    var cb=_crmBoard(CRM.sel.boardId);
    if(cb&&!_crmBoardVisible(cb)){CRM.sel.boardId=null;CRM.sel.convoId=null;CRM.sel.threadId=null;}
  }
  return true;
}
function _crmMergeSettingsRow(r,evt){
  if(!r||r.key!=='crm_settings'||evt==='DELETE')return false;
  try{if(typeof pendingWriteIds==='function'&&pendingWriteIds('workspace_settings').has('crm_settings'))return false;}catch(e){}  // a queued local edit wins until it flushes
  var v=r.value;
  if(!v||typeof v!=='object'||Array.isArray(v))return false;
  if(JSON.stringify(CRM.settings||{})===JSON.stringify(v))return false;
  CRM.settings=v;                                   // people-groups + workspace notify defaults
  return true;
}
function _crmOnStructEvent(merge){return function(p){try{
  var evt=p.eventType||p.event;
  var row=(evt==='DELETE')?(p.old||{}):(p.new||{});
  if(merge(row,evt))_crmLiveApplied(true,false);
}catch(e){}};}
/* Structure safety net — full tiny-table reconcile (adds, edits AND deletes), piggybacked on the
   normal poll cadence. Rows with queued unsent local writes are left alone so offline edits
   don't flicker away before the queue flushes. */
function _crmStructPoll(){
  if(_crmRT.sBusy||!CRM._loaded)return;
  _crmRT.sBusy=true;
  Promise.all([
    sb.from('crm_hubs').select('*').order('sort',{ascending:true}),
    sb.from('crm_boards').select('*').order('sort',{ascending:true}),
    sb.from('crm_board_members').select('*'),
    sb.from('crm_views').select('*').order('sort',{ascending:true}),
    sb.from('workspace_settings').select('*').eq('key','crm_settings')
  ]).then(function(R){
    _crmRT.sBusy=false;
    if(!R||R.some(function(r){return !r||r.error;}))return;
    var pend=function(t){try{return typeof pendingWriteIds==='function'?pendingWriteIds(t):new Set();}catch(e){return new Set();}};
    var pH=pend('crm_hubs'),pB=pend('crm_boards'),pV=pend('crm_views');
    var ch=false,seen={};
    (R[0].data||[]).forEach(function(r){seen['h'+r.id]=1;if(!pH.has(r.id)&&_crmMergeHubRow(r,'UPSERT'))ch=true;});
    CRM.hubs.slice().forEach(function(h){if(!seen['h'+h.id]&&!pH.has(h.id)&&!_crmIsFresh(h.id)&&_crmMergeHubRow({id:h.id},'DELETE'))ch=true;});
    (R[1].data||[]).forEach(function(r){seen['b'+r.id]=1;if(!pB.has(r.id)&&_crmMergeBoardRow(r,'UPSERT'))ch=true;});
    CRM.boards.slice().forEach(function(b){if(!seen['b'+b.id]&&!pB.has(b.id)&&!_crmIsFresh(b.id)&&_crmMergeBoardRow({id:b.id},'DELETE'))ch=true;});
    var mb={};(R[2].data||[]).forEach(function(r){(mb[r.board_id]=mb[r.board_id]||[]).push(r.user_id);});
    CRM.boards.forEach(function(b){
      var srv=(mb[b.id]||[]).slice().sort(),cur=(b.members||[]).slice().sort();
      if(JSON.stringify(srv)!==JSON.stringify(cur)){b.members=mb[b.id]||[];ch=true;}
    });
    (R[3].data||[]).forEach(function(r){seen['v'+r.id]=1;if(!pV.has(r.id)&&_crmMergeViewRow(r,'UPSERT'))ch=true;});
    (CRM.views||[]).slice().forEach(function(v){if(!seen['v'+v.id]&&!pV.has(v.id)&&!_crmIsFresh(v.id)&&_crmMergeViewRow({id:v.id},'DELETE'))ch=true;});
    var st=(R[4].data||[])[0];if(st&&_crmMergeSettingsRow(st,'UPDATE'))ch=true;
    if(CRM.sel.boardId&&!_crmBoard(CRM.sel.boardId)){CRM.sel.boardId=null;CRM.sel.convoId=null;CRM.sel.threadId=null;ch=true;}
    if(ch)_crmLiveApplied(true,false);
  }).catch(function(){_crmRT.sBusy=false;});
}
/* Re-render WITHOUT stealing what the user is doing: the composer's text, caret and
   focus, pending attachments, and both scroll positions are carried across. */
function _crmLiveRR(){
  if(S.route!=='crm'){return;}                       // off-tab: state is updated, paint later
  if(CRM.editMsgId){CRM._liveDirty=true;return;}     // never yank a message being edited
  var mDD=document.getElementById('crm-mention');
  if(mDD&&mDD.style.display!=='none'&&mDD.innerHTML){CRM._liveDirty=true;return;} // @-picker open
  var keep={};
  ['crm-input','crm-tinput','crm-nc-name','crm-nc-title','crm-search'].forEach(function(id){
    var e=document.getElementById(id);
    if(e)keep[id]={v:e.value,ss:e.selectionStart,se:e.selectionEnd,f:(document.activeElement===e)};
  });
  var th=document.getElementById('crm-thread');
  var atBottom=true,thTop=0;
  if(th){thTop=th.scrollTop;atBottom=(th.scrollHeight-th.scrollTop-th.clientHeight)<70;}
  var ls=document.getElementById('crm-list');var lsTop=ls?ls.scrollTop:0;
  rr();
  Object.keys(keep).forEach(function(id){
    var e=document.getElementById(id);if(!e)return;
    e.value=keep[id].v;
    if(keep[id].f){try{e.focus();e.setSelectionRange(keep[id].ss,keep[id].se);}catch(x){}}
  });
  try{_crmRenderPreview();}catch(e){}
  var th2=document.getElementById('crm-thread');
  if(th2)th2.scrollTop=atBottom?th2.scrollHeight:thTop;   // pinned to newest unless reading history
  var ls2=document.getElementById('crm-list');if(ls2&&lsTop)ls2.scrollTop=lsTop;
}
/* Anything that lands from the server funnels through here. */
function _crmLiveApplied(changed,touchedOpenConvo){
  if(!changed)return;
  if(touchedOpenConvo&&CRM.sel.convoId&&S.route==='crm'){try{_crmMarkRead(CRM.sel.convoId);}catch(e){}}
  _crmLiveRR();
}
function _crmOnMsgEvent(p){
  try{
    var evt=p.eventType||p.event;
    var row=(evt==='DELETE')?(p.old||{}):(p.new||{});
    var changed=_crmMergeMsgRow(row,evt);
    if(_crmRT.needConvos){_crmRT.needConvos=false;_crmPoll(true);}
    _crmLiveApplied(changed,row.conversation_id===CRM.sel.convoId);
  }catch(e){}
}
function _crmOnConvoEvent(p){
  try{
    var evt=p.eventType||p.event;
    var row=(evt==='DELETE')?(p.old||{}):(p.new||{});
    var changed=_crmMergeConvoRow(row,evt);
    if(_crmRT.needMsgsFor){var cid=_crmRT.needMsgsFor;_crmRT.needMsgsFor=null;_crmFetchMsgsFor(cid);}
    _crmLiveApplied(changed,row.id===CRM.sel.convoId);
  }catch(e){}
}
function _crmFetchMsgsFor(cid){
  sb.from('crm_messages').select('*').eq('conversation_id',cid).order('created_at',{ascending:true}).then(function(r){
    if(!r||r.error||!r.data)return;
    var ch=false;r.data.forEach(function(row){if(_crmMergeMsgRow(row,'INSERT'))ch=true;});
    _crmLiveApplied(ch,cid===CRM.sel.convoId);
  }).catch(function(){});
}
/* Safety net. Realtime is the fast path; this catches a dropped socket, a sleeping
   phone waking up, or a project where replication was switched off again.
   Only asks for rows NEWER than what we hold, so it stays tiny. */
function _crmPoll(force){
  if(!CRM||!CRM._loaded||_crmRT.busy)return;
  if(!force){
    if(document.visibilityState==='hidden')return;                  // nothing while backgrounded
    if(S.route!=='crm')return;
    var healthy=(_crmRT.status==='SUBSCRIBED');
    _crmRT.tick++;
    if(healthy&&(_crmRT.tick%6)!==0)return;                          // ~54s when push is working
  }
  try{_crmStructPoll();}catch(e){}
  _crmRT.busy=true;
  var since=_crmRT.lastTs||new Date(Date.now()-864e5).toISOString();
  var overlap=new Date(new Date(since).getTime()-30000).toISOString(); // clock-skew cushion
  sb.from('crm_messages').select('*').gt('created_at',overlap).order('created_at',{ascending:true}).then(function(r){
    _crmRT.busy=false;
    if(!r||r.error||!r.data||!r.data.length)return;
    var ch=false,touched=false;
    r.data.forEach(function(row){
      if(_crmMergeMsgRow(row,'INSERT')){ch=true;if(row.conversation_id===CRM.sel.convoId)touched=true;}
    });
    if(_crmRT.needConvos){
      _crmRT.needConvos=false;
      sb.from('crm_conversations').select('*').order('last_at',{ascending:false}).then(function(r2){
        if(!r2||r2.error||!r2.data)return;
        var ch2=false;r2.data.forEach(function(row){if(_crmMergeConvoRow(row,'INSERT'))ch2=true;});
        if(ch2)_crmLiveApplied(true,false);
      }).catch(function(){});
    }
    _crmLiveApplied(ch,touched);
  }).catch(function(){_crmRT.busy=false;});
}
function _crmLiveStart(){
  if(_crmRT.bound)return;_crmRT.bound=true;
  try{
    _crmRT.ch=sb.channel('bridge-crm-'+(S.uid||'anon'))
      .on('postgres_changes',{event:'*',schema:'public',table:'crm_messages'},_crmOnMsgEvent)
      .on('postgres_changes',{event:'*',schema:'public',table:'crm_conversations'},_crmOnConvoEvent)
      .on('postgres_changes',{event:'*',schema:'public',table:'crm_hub_members'},_crmOnHubMemberEvent)
      .on('postgres_changes',{event:'*',schema:'public',table:'crm_boards'},_crmOnStructEvent(_crmMergeBoardRow))
      .on('postgres_changes',{event:'*',schema:'public',table:'crm_hubs'},_crmOnStructEvent(_crmMergeHubRow))
      .on('postgres_changes',{event:'*',schema:'public',table:'crm_views'},_crmOnStructEvent(_crmMergeViewRow))
      .on('postgres_changes',{event:'*',schema:'public',table:'crm_board_members'},_crmOnStructEvent(_crmMergeBoardMemberRow))
      .on('postgres_changes',{event:'*',schema:'public',table:'workspace_settings'},_crmOnStructEvent(_crmMergeSettingsRow))
      .on('postgres_changes',{event:'*',schema:'public',table:'crm_reads'},_crmOnReadEvent)
      .subscribe(function(st){_crmRT.status=st;});
  }catch(e){_crmRT.status='ERROR';}
  try{_crmTypingJoin();_crmLoadReadsAll();}catch(e){}
  if(!_crmRT.poll)_crmRT.poll=setInterval(function(){try{_crmPoll();}catch(e){}},9000);
  if(!_crmRT.visBound){
    _crmRT.visBound=true;
    document.addEventListener('visibilitychange',function(){
      if(document.visibilityState==='visible'&&S.route==='crm'){try{_crmPoll(true);}catch(e){}}
    });
  }
}
function _crmLiveStop(){
  try{if(_crmRT.ch&&sb.removeChannel)sb.removeChannel(_crmRT.ch);}catch(e){}
  if(_crmRT.poll){clearInterval(_crmRT.poll);_crmRT.poll=null;}
  _crmRT.ch=null;_crmRT.bound=false;_crmRT.status='';
}
App._crmLiveStatus=function(){return{status:_crmRT.status,bound:_crmRT.bound,lastTs:_crmRT.lastTs};};
window._crmLiveStart=_crmLiveStart;window._crmLiveStop=_crmLiveStop;window._crmPoll=_crmPoll;


/* ══════════════════════════════════════════════════════════════════════════════
   v3.19 — CHANNEL (hub) MEMBERSHIP UI
   Add someone to a channel and they get every board inside it. Add them to a
   single board instead and that board is all they see.
   ══════════════════════════════════════════════════════════════════════════════ */
function _crmHubPeopleBtn(hub){
  if(!hub)return '';
  var n=_crmHubPeopleList(hub.id).length;
  if(!_crmCanHubMembers())return '';
  /* Dark pill + the word "Channel": the board-members button right below the tabs is a
     white 👥+count too, and two identical chips meant nobody could tell them apart. */
  return '<button onclick="App._crmHubPeople(\''+hub.id+'\')" aria-label="Channel people" title="Channel access — who can see every board in this channel" class="crm-tap" style="display:inline-flex;align-items:center;gap:5px;height:32px;padding:0 11px;border-radius:9px;border:none;background:#1D1712;color:#fff;font-size:12px;font-weight:800;cursor:pointer;flex-shrink:0">'+ic('users','w-3.5 h-3.5')+'<span class="crm-hide-mob">Channel</span>'+n+'</button>';
}
App._crmHubPeople=(hubId)=>{
  if(!_crmCanHubMembers())return toast('You don’t have permission to assign people','err');
  CRM._hubPeopleId=hubId;
  /* v3.21 — edits are STAGED. Nothing reaches the database (or anybody else's screen)
     until Save is pressed, so Cancel / X / backdrop genuinely means "changed my mind". */
  CRM._hubDraft=_crmHubMemberIds(hubId).slice();
  App._crmHubPeopleRender();
};
App._crmHubPeopleRender=()=>{
  var hubId=CRM._hubPeopleId;var h=_crmHub(hubId);if(!h)return;
  var draft=CRM._hubDraft||_crmHubMemberIds(hubId).slice();
  var mem=draft.map(function(id){return uById(id);}).filter(function(u){return u&&u.status!=='Disabled';}).sort(function(a,b){return fullName(a).localeCompare(fullName(b));});
  var memSet={};mem.forEach(function(u){memSet[u.id]=1;});
  var boards=(CRM.boards||[]).filter(function(b){return b.hubId===hubId;});
  /* People who reach a board in here WITHOUT channel access — shown so it is obvious
     who is board-scoped and who is channel-wide. */
  var boardOnly={};
  boards.forEach(function(b){(b.members||[]).forEach(function(id){if(!memSet[id])(boardOnly[id]=boardOnly[id]||[]).push(b.name);});});
  var others=(DB.users||[]).filter(function(u){return u&&u.status!=='Disabled'&&!memSet[u.id];})
                           .sort(function(a,b){return fullName(a).localeCompare(fullName(b));});
  var row=function(u,right){return '<div style="display:flex;align-items:center;gap:9px;padding:7px 4px">'+avatar(u,'w-7 h-7','text-[9px]')+'<span style="flex:1;min-width:0;font-size:13px;font-weight:600;color:var(--c-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(fullName(u))+'</span>'+right+'</div>';};
  var memHTML=mem.length?mem.map(function(u){
    return row(u,'<button onclick="App._crmRemoveHubMember(\''+u.id+'\')" title="Remove channel access" style="border:none;background:var(--c-danger-soft);color:var(--c-danger);width:28px;height:28px;border-radius:8px;cursor:pointer;display:grid;place-items:center;flex-shrink:0">'+ic('x','w-3.5 h-3.5')+'</button>');
  }).join(''):'<div style="padding:10px 4px;font-size:12.5px;color:var(--c-text-3);line-height:1.55">Nobody has channel-wide access yet. People added to individual boards below still see those boards.</div>';
  var boHTML=Object.keys(boardOnly).map(function(id){
    var u=uById(id);if(!u)return '';
    return row(u,'<span style="font-size:10.5px;font-weight:700;color:var(--c-text-3);background:var(--c-surface-2);border-radius:20px;padding:3px 9px;flex-shrink:0;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(boardOnly[id].join(', '))+'</span>');
  }).join('');
  var addHTML=others.length?others.slice(0,120).map(function(u){
    return '<button onclick="App._crmAddHubMember(\''+u.id+'\')" style="width:100%;text-align:left;display:flex;align-items:center;gap:9px;padding:7px 4px;border:none;background:transparent;border-radius:8px;cursor:pointer" onmouseover="this.style.background=\'var(--c-surface-2)\'" onmouseout="this.style.background=\'transparent\'">'+avatar(u,'w-7 h-7','text-[9px]')+'<span style="flex:1;min-width:0;font-size:13px;font-weight:600;color:var(--c-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(fullName(u))+'</span><span style="font-size:11px;font-weight:800;color:var(--c-brand-ink);flex-shrink:0">+ Add</span></button>';
  }).join(''):'<div style="padding:8px 4px;font-size:12px;color:var(--c-text-3)">Everyone already has channel access.</div>';
  var sec=function(t,sub){return '<div style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--c-text-3);margin:14px 2px 4px">'+t+(sub?' <span style="font-weight:600;text-transform:none;letter-spacing:0">'+sub+'</span>':'')+'</div>';};
  modalShell({title:'People in “'+h.name+'”',sub:'Channel access = every board in here. Board-only access is set on the board itself.',size:'max-w-md',key:'crm-hubpeople',
    body:sec('Channel access','· sees all '+boards.length+' board'+(boards.length===1?'':'s'))+memHTML
        +(boHTML?sec('Board-only access','· limited to the boards listed')+boHTML:'')
        +sec('Add to this channel')+'<div class="crm-scroll" style="max-height:230px;overflow-y:auto">'+addHTML+'</div>',
    footer:btnG('Cancel','App._crmHubPeopleCancel()')+btnP(_crmHubDraftDirty()?'Save changes':'Done','App._crmHubPeopleSave()')});
};
function _crmHubDraftDirty(){
  var hubId=CRM._hubPeopleId;if(!hubId||!CRM._hubDraft)return false;
  var a=_crmHubMemberIds(hubId).slice().sort().join(','),b=CRM._hubDraft.slice().sort().join(',');
  return a!==b;
}
/* Draft edits — in-memory only. */
App._crmAddHubMember=(uid2)=>{
  if(!_crmCanHubMembers())return toast('No permission','err');
  CRM._hubDraft=CRM._hubDraft||[];
  if(CRM._hubDraft.indexOf(uid2)<0)CRM._hubDraft.push(uid2);
  App._crmHubPeopleRender();
};
App._crmRemoveHubMember=(uid2)=>{
  if(!_crmCanHubMembers())return toast('No permission','err');
  CRM._hubDraft=(CRM._hubDraft||[]).filter(function(x){return x!==uid2;});
  App._crmHubPeopleRender();
};
App._crmHubPeopleCancel=()=>{CRM._hubDraft=null;CRM._hubPeopleId=null;closeModal();};
/* Save = one diff, applied to state, the database and everyone else's screen at once. */
App._crmHubPeopleSave=async()=>{
  if(!_crmCanHubMembers())return toast('No permission','err');
  var hubId=CRM._hubPeopleId;if(!hubId)return;
  var before=_crmHubMemberIds(hubId).slice(),after=(CRM._hubDraft||[]).slice();
  var added=after.filter(function(x){return before.indexOf(x)<0;});
  var removed=before.filter(function(x){return after.indexOf(x)<0;});
  if(!added.length&&!removed.length){App._crmHubPeopleCancel();return;}
  var h=_crmHub(hubId);
  if(removed.indexOf(S.uid)>=0&&!_crmSeeAll()){
    if(!(await _crmConfirmP('Remove your own access','You will lose access to “'+esc(h?h.name:'')+'” and every board in it.','Remove me'))){App._crmHubPeopleRender();return;}
  }
  CRM.hubMembers[hubId]=after;
  CRM._hubDraft=null;CRM._hubPeopleId=null;closeModal();
  var bits=[];if(added.length)bits.push(added.length+' added');if(removed.length)bits.push(removed.length+' removed');
  toast('Channel access updated — '+bits.join(', ')+' \u2713');
  rr();
  try{
    if(added.length)await sb.from('crm_hub_members').insert(added.map(function(id){return{hub_id:hubId,user_id:id};}));
    for(var i=0;i<removed.length;i++)await sb.from('crm_hub_members').delete().eq('hub_id',hubId).eq('user_id',removed[i]);
  }catch(e){console.warn('[CRM hubMembers save]',e&&e.message);toast('Saved locally, sync failed','warn');}
};
/* Membership changes propagate live, so revoking access takes effect on the other
   person's screen without them reloading. */
function _crmOnHubMemberEvent(p){
  try{
    var evt=p.eventType||p.event;
    var row=(evt==='DELETE')?(p.old||{}):(p.new||{});
    if(!row||!row.hub_id)return;
    var list=_crmHubMemberIds(row.hub_id);
    if(evt==='DELETE')CRM.hubMembers[row.hub_id]=list.filter(function(x){return x!==row.user_id;});
    else if(list.indexOf(row.user_id)<0)CRM.hubMembers[row.hub_id]=list.concat([row.user_id]);
    else return;
    if(row.user_id===S.uid){                    // my own access just changed
      var b=_crmBoard(CRM.sel.boardId);
      if(b&&!_crmBoardVisible(b)){CRM.sel.boardId=null;CRM.sel.convoId=null;CRM.sel.threadId=null;}
    }
    if(S.route==='crm')_crmLiveRR();
  }catch(e){}
}

/* ══════════════════════════════════════════════════════════════════════════════
   v3.21 — OPEN THE THING THE NOTIFICATION IS ABOUT
   New notifications carry link = 'crm:<conversationId>'. Older rows predate that
   column, so we fall back to the quoted title the message already contains
   ("… tagged you in “Return”" / '… created a ticket: "Refund"').
   ══════════════════════════════════════════════════════════════════════════════ */
function _crmFindConvoByTitle(text){
  if(!text)return null;
  var m=String(text).match(/[“"]([^”"]{1,120})[”"]/);
  if(!m)return null;
  var want=m[1].trim().toLowerCase();
  var vis=_crmVisibleBoardIds();
  var hits=(CRM.convos||[]).filter(function(c){
    return vis[c.boardId]&&String(c.title||'').trim().toLowerCase()===want;
  });
  if(!hits.length)return null;
  hits.sort(function(a,b){return String(b.lastAt||'').localeCompare(String(a.lastAt||''));});
  return hits[0];
}
/* Open a conversation from anywhere: resolves its board + hub, switches route, marks read. */
App._crmOpenFromNotification=(link,text)=>{
  _crmInit();
  if(!can('crm','view'))return false;
  var c=null;
  if(link&&String(link).indexOf('crm:')===0)c=_crmConvo(String(link).slice(4));
  if(!c)c=_crmFindConvoByTitle(text);
  S.route='crm';S.search='';
  if(!c||!_crmVisibleBoardIds()[c.boardId]){
    // no longer exists, or not ours to see — land on the Workspace rather than nowhere
    render();window.scrollTo(0,0);
    if(link||text)toast('That conversation isn’t available','warn');
    return true;
  }
  var b=_crmBoard(c.boardId);
  CRM.sel.boardId=c.boardId;CRM.sel.hubId=b?b.hubId:CRM.sel.hubId;CRM.sel.viewId=null;
  CRM.sel.convoId=c.id;CRM.sel.threadId=null;CRM.search='';CRM.compose.images=[];
  try{_crmMarkRead(c.id);}catch(e){}
  render();window.scrollTo(0,0);
  setTimeout(function(){var t=document.getElementById('crm-thread');if(t)t.scrollTop=t.scrollHeight;},60);
  return true;
};


/* ═════════════════════════ CHAT+ — WhatsApp-grade layer ═════════════════════════
   Adds: in-bubble time + sent/read ticks, date pills, entrance animations, big
   emoji, full emoji picker (recents + categories), typing indicator over realtime
   broadcast, optimistic sends, swipe-to-reply, scroll-to-latest, unread counts,
   chat wallpaper, keyboard-safe pinning. Everything degrades gracefully. */

var _CRM_SMILEY='<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="9.2"/><path d="M8.4 14.2c.9 1.4 2.1 2.1 3.6 2.1s2.7-.7 3.6-2.1"/><circle cx="9" cy="9.6" r=".6" fill="currentColor"/><circle cx="15" cy="9.6" r=".6" fill="currentColor"/></svg>';
var _CRM_TK_CLOCK='<svg class="crm-tk" viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="6" cy="6" r="4.6"/><path d="M6 3.8V6l1.7 1.1"/></svg>';
var _CRM_TK_ONE='<svg class="crm-tk" viewBox="0 0 14 11" width="13" height="11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 6 5 9.5 12.5 1.8"/></svg>';
var _CRM_TK_TWO='<svg class="crm-tk" viewBox="0 0 18 11" width="16" height="11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 6 5 9.5 12.5 1.8"/><path d="M8.8 8.9l.7.6L16.9 1.8"/></svg>';

function _crmEmojiOnly(t){t=(t||'').trim();if(!t||t.length>40)return false;try{if(!/^[\p{Extended_Pictographic}\p{Emoji_Component}\u{FE0F}\u{200D}\s]+$/u.test(t))return false;var n=0;if(window.Intl&&Intl.Segmenter){var seg=new Intl.Segmenter('en',{granularity:'grapheme'});for(var s of seg.segment(t.replace(/\s+/g,'')))n++;}else{n=Math.ceil(t.replace(/\s+/g,'').length/2);}return n>=1&&n<=6;}catch(e){return false;}}
function _crmAnimCls(m,mine){CRM._seenM=CRM._seenM||{};if(CRM._seenM[m.id])return'';CRM._seenM[m.id]=1;return mine?' crm-anew-out':' crm-anew-in';}
function _crmDayKey(iso){try{var d=new Date(iso);return d.getFullYear()+'-'+d.getMonth()+'-'+d.getDate();}catch(e){return'';}}
function _crmDayLbl(iso){try{var d=new Date(iso),n=new Date();var one=864e5;var d0=new Date(d.getFullYear(),d.getMonth(),d.getDate());var n0=new Date(n.getFullYear(),n.getMonth(),n.getDate());var diff=Math.round((n0-d0)/one);if(diff===0)return'Today';if(diff===1)return'Yesterday';if(diff<7)return d.toLocaleDateString('en-GB',{weekday:'long'});return d.toLocaleDateString('en-GB',{day:'numeric',month:'short'})+(d.getFullYear()===n.getFullYear()?'':' '+d.getFullYear());}catch(e){return'';}}
function _crmDatePill(iso){return'<div class="crm-datep"><span>'+_crmDayLbl(iso)+'</span></div>';}
function _crmMsgsWithDates(list,cid,thread){
  CRM._seenM=CRM._seenM||{};
  if(CRM._seenConvo!==cid){list.forEach(function(m){CRM._seenM[m.id]=1;});CRM._seenConvo=cid;}
  var out='',prev=null;
  for(var i=0;i<list.length;i++){var m=list[i];
    if(!prev||_crmDayKey(prev.at)!==_crmDayKey(m.at)){out+=_crmDatePill(m.at);prev=null;}
    out+=_crmMsg(m,cid,thread,prev);prev=m;}
  return out;
}
function _crmTicks(m,cid){CRM._pend=CRM._pend||{};var pend=CRM._pend[m.id];var read=!pend&&_crmReadByOthers(cid,m.at);return'<span class="crm-ticks'+(read?' crm-tk-read':'')+'" data-tk="'+m.id+'">'+(pend?_CRM_TK_CLOCK:(read?_CRM_TK_TWO:_CRM_TK_ONE))+'</span>';}
function _crmTickFlip(id){try{var el=document.querySelector('[data-tk="'+id+'"]');if(!el)return;var cid=CRM.sel.convoId;var c=cid?_crmConvo(cid):null;var m=c?(c.messages||[]).find(function(x){return x.id===id;}):null;if(m)el.outerHTML=_crmTicks(m,cid);else el.innerHTML=_CRM_TK_ONE;}catch(e){}}
function _crmReadByOthers(cid,at){var r=(CRM.readsAll||{})[cid];if(!r)return false;for(var k in r){if(k!==S.uid&&String(r[k])>=String(at))return true;}return false;}
function _crmLoadReadsAll(){if(CRM._readsLoaded)return;CRM._readsLoaded=true;try{sb.from('crm_reads').select('conversation_id,user_id,last_seen_at').then(function(res){var rows=(res&&res.data)||[];if(!rows.length)return;CRM.readsAll=CRM.readsAll||{};rows.forEach(function(r){(CRM.readsAll[r.conversation_id]=CRM.readsAll[r.conversation_id]||{})[r.user_id]=r.last_seen_at;});_crmPaintTicks();}).catch?null:null;}catch(e){}}
function _crmOnReadEvent(p){try{var row=(p&&(p.new||p.record))||{};if(!row.conversation_id||row.user_id===S.uid)return;CRM.readsAll=CRM.readsAll||{};(CRM.readsAll[row.conversation_id]=CRM.readsAll[row.conversation_id]||{})[row.user_id]=row.last_seen_at;if(row.conversation_id===CRM.sel.convoId)_crmPaintTicks();}catch(e){}}
function _crmPaintTicks(){try{var cid=CRM.sel.convoId;if(!cid)return;var c=_crmConvo(cid);if(!c)return;var els=document.querySelectorAll('#crm-thread .crm-ticks,#crm-tthread .crm-ticks');for(var i=0;i<els.length;i++){var el=els[i];var id=el.getAttribute('data-tk');var m=(c.messages||[]).find(function(x){return x.id===id;});if(m)el.outerHTML=_crmTicks(m,cid);}}catch(e){}}
function _crmUnreadN(c){try{var seen=(CRM.reads||{})[c.id]||'';var n=(c.messages||[]).filter(function(m){return !m.parentId&&(m.fromCustomer||m.senderId!==S.uid)&&String(m.at)>String(seen);}).length;n=Math.max(1,n);return n>99?'99+':n;}catch(e){return'•';}}
function _crmTouchListRow(c){try{var row=document.querySelector('.crm-row[data-cid="'+c.id+'"]');if(!row)return;var tmp=document.createElement('div');tmp.innerHTML=_crmConvoRow(c,CRM.sel.convoId,false);if(tmp.firstElementChild)row.replaceWith(tmp.firstElementChild);}catch(e){}}
App._crmGrow=(el)=>{try{el.style.height='auto';el.style.height=Math.min(el.scrollHeight,120)+'px';}catch(e){}};
App._crmPaste=(e)=>{try{var items=(e.clipboardData||{}).items||[];var fs=[];for(var i=0;i<items.length;i++){if(items[i].kind==='file'){var f=items[i].getAsFile();if(f&&f.type&&f.type.indexOf('image/')===0)fs.push(f);}}if(fs.length){e.preventDefault();_crmAddFiles(fs);}}catch(x){}};
App._crmThScroll=(el)=>{var j=document.getElementById('crm-jump');if(!j)return;var far=el.scrollHeight-el.scrollTop-el.clientHeight;j.classList.toggle('on',far>320);};
App._crmJump=()=>{var t=document.getElementById('crm-thread');if(!t)return;try{t.scrollTo({top:t.scrollHeight,behavior:'smooth'});}catch(e){t.scrollTop=t.scrollHeight;}};

/* ── typing indicator: broadcast over a shared realtime channel ── */
function _crmTypingJoin(){if(typeof _crmRT==='undefined'||_crmRT.tch)return;try{_crmRT.tch=sb.channel('bridge-crm-typing',{config:{broadcast:{self:false}}}).on('broadcast',{event:'typing'},function(p){var d=(p&&p.payload)||{};if(!d.cid||d.uid===S.uid)return;CRM._typing=CRM._typing||{};(CRM._typing[d.cid]=CRM._typing[d.cid]||{})[d.uid]={n:d.n||'Someone',ts:Date.now()};_crmTypingPaint();}).subscribe();}catch(e){}}
function _crmTypingSend(){try{if(typeof _crmRT==='undefined'||!_crmRT.tch||!CRM.sel.convoId)return;var now=Date.now();if(CRM._tySent&&now-CRM._tySent<2200)return;CRM._tySent=now;_crmRT.tch.send({type:'broadcast',event:'typing',payload:{cid:CRM.sel.convoId,uid:S.uid,n:(typeof me==='function'&&me())?_crmFirst(me()):''}});}catch(e){}}
function _crmTypingPaint(){var el=document.getElementById('crm-chatsub');if(!el)return;var cid=CRM.sel.convoId;var t=(CRM._typing||{})[cid]||{};var now=Date.now();var names=[];for(var k in t){if(now-t[k].ts<3200)names.push(t[k].n||'Someone');}
  if(!el.dataset.sub)el.dataset.sub=el.innerHTML;
  if(names.length){el.innerHTML='<span class="crm-typ">'+esc(names.slice(0,2).join(', '))+(names.length===1?' is':' are')+' typing<span class="crm-typd"><i></i><i></i><i></i></span></span>';}
  else if(el.dataset.sub){el.innerHTML=el.dataset.sub;}}

/* ── emoji picker: zero-dependency, categories + recents ── */
var _CRM_EMOJI=[
["Smileys","😀","😀 😃 😄 😁 😆 😅 😂 🤣 🥲 ☺️ 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🤩 🥳 😏 😒 😞 😔 😟 😕 🙁 ☹️ 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🤭 🤫 🤥 😶 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕 🤑 🤠 😈 🤡 💩 👻 💀 👽 🤖"],
["Gestures","👋","👋 🤚 ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 ✍️ 💅 🤳 💪 🦾 🫶 🫡 🫰 🫢 🫣 🧠 👀 👁️ 👄 🦷 👅 👂 👃 🦻 🦶 🦵"],
["Hearts","❤️","❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❤️‍🔥 ❤️‍🩹 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 💯 💢 💥 💫 💦 💨 💬 💤 🎉 🎊 🎈 🎀 🎁 🪄 ✨ ⭐ 🌟 ⚡ 🔥 🌈 ☀️"],
["Nature","🌸","🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🐤 🦆 🦅 🦉 🦄 🐝 🦋 🐌 🐞 🐢 🐍 🦖 🐙 🦀 🐠 🐬 🐳 🦈 🌸 💐 🌹 🌺 🌻 🌼 🌷 🌱 🌿 ☘️ 🍀 🍁 🍄 🌍 🌙 ⛅ ☁️ 🌧️ ⛈️ ❄️ 💧 🌊"],
["Food","🍕","🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🥦 🥒 🌶️ 🌽 🥕 🍞 🥐 🥖 🥨 🧀 🥚 🍳 🥞 🧇 🥓 🍔 🍟 🍕 🌭 🥪 🌮 🌯 🥗 🍝 🍜 🍲 🍣 🍱 🍤 🍚 🍦 🍰 🎂 🧁 🍫 🍬 🍭 🍯 🍪 ☕ 🍵 🧃 🥤 🧋 🥂 🍷"],
["Activity","⚽","⚽ 🏀 🏈 ⚾ 🎾 🏐 🏉 🎱 🏓 🏸 ⛳ 🏹 🎣 🥊 🥋 🛹 ⛸️ 🎿 🏂 🏋️ 🤸 🧘 🏄 🏊 🚴 🚵 🎪 🎭 🎨 🎬 🎤 🎧 🎼 🎹 🥁 🎷 🎺 🎸 🎻 🎲 ♟️ 🎯 🎳 🎮 🧩 🚗 🚕 🚌 🏎️ 🚓 🚑 🚒 ✈️ 🚀 🛳️ ⛵ 🏝️ 🏔️ 🏕️ 🎡 🎢 🎠 🗼 🗽"],
["Objects","💡","⌚ 📱 💻 ⌨️ 🖥️ 🖨️ 🖱️ 💾 💿 📷 📸 📹 🎥 📞 ☎️ 📺 📻 🧭 ⏰ ⏳ 🔋 🔌 💡 🔦 🕯️ 💸 💵 💰 💳 💎 ⚖️ 🧰 🔧 🔨 ⚙️ 🧲 🔮 🧿 🔭 🔬 💊 💉 🩹 🩺 🌡️ 🧬 🧹 🧺 🛁 🛎️ 🔑 🚪 🪑 🛏️ 🧸 🖼️ 🛍️ 📦 📜 📄 📊 📈 📉 📅 🗑️ 📌 📎 📏 ✂️ 🖊️ ✏️ 🔍 🔒 🔓"],
["Symbols","✅","✅ ☑️ ✔️ ❌ ❎ ➕ ➖ ➗ ✖️ 💲 ™️ ©️ ®️ ⚠️ 🚸 ⛔ 🚫 ❗ ❕ ❓ ❔ ‼️ ⁉️ 💠 🔱 ⚜️ 🔰 ♻️ 💹 ❇️ ✳️ 🌐 🏧 ♿ 🅿️ 🔢 🔤 ℹ️ 🆗 🆕 🆙 🆒 🆓 🆖 🎵 🎶 ➡️ ⬅️ ⬆️ ⬇️ ↗️ ↘️ ↙️ ↖️ ↕️ ↔️ 🔄 🔃 🔚 🔙 🔛 🔝 🔜"]
];
function _crmEmoRec(){try{return JSON.parse(localStorage.getItem('bb_emo_rec')||'[]');}catch(e){return[];}}
function _crmEmoRecPush(ch){try{var r=_crmEmoRec().filter(function(x){return x!==ch;});r.unshift(ch);localStorage.setItem('bb_emo_rec',JSON.stringify(r.slice(0,24)));}catch(e){}}
function _crmEmoHost(){var h=document.getElementById('crm-emohost');if(!h){h=document.createElement('div');h.id='crm-emohost';document.body.appendChild(h);
  h.addEventListener('click',function(ev){var b=ev.target.closest?ev.target.closest('button'):null;if(!b)return;ev.stopPropagation();
    if(b.classList.contains('crm-ecat')){CRM._emo.cat=parseInt(b.getAttribute('data-i'),10);_crmEmoRender();return;}
    if(b.classList.contains('crm-eemo')){App._crmEmoPick(b.textContent.trim());return;}});}
  return h;}
function _crmEmoRender(){var h=_crmEmoHost();var st=CRM._emo||{};var rec=_crmEmoRec();var cat=st.cat;
  if(cat===undefined||cat===null)cat=(rec.length?-1:0);CRM._emo.cat=cat;
  var tabs='<button class="crm-ecat'+(cat===-1?' on':'')+'" data-i="-1" title="Recent">🕘</button>'+_CRM_EMOJI.map(function(c,i){return'<button class="crm-ecat'+(cat===i?' on':'')+'" data-i="'+i+'" title="'+c[0]+'">'+c[1]+'</button>';}).join('');
  var list=cat===-1?rec:(_CRM_EMOJI[cat]?_CRM_EMOJI[cat][2].split(' '):[]);
  var grid=list.length?list.map(function(e){return'<button class="crm-eemo">'+e+'</button>';}).join(''):'<div class="crm-elab" style="padding:14px 4px">Nothing here yet — pick a few and they will land in Recent.</div>';
  h.innerHTML='<div class="crm-ehd">'+tabs+'</div><div class="crm-egrid">'+grid+'</div>';}
App._crmEmoOpen=(ev,mode,cid,mid)=>{if(ev&&ev.stopPropagation)ev.stopPropagation();App._crmCloseMsgActs();
  CRM._emo={mode:mode,cid:cid||null,mid:mid||null,cat:(_crmEmoRec().length?-1:0)};_crmEmoRender();
  var h=_crmEmoHost();h.classList.add('on');var mob=_crmIsMob();h.classList.toggle('crm-esheet',mob);
  if(!mob){var r=null;try{r=ev&&ev.target&&ev.target.closest('button').getBoundingClientRect();}catch(e){}
    var W=352,H=340;var x=r?Math.min(Math.max(8,r.left-46),window.innerWidth-W-8):(window.innerWidth-W)/2;
    var y=r?(r.top-H-10):(window.innerHeight-H)/2;if(y<8)y=Math.min(window.innerHeight-H-8,(r?r.bottom+10:8));
    h.style.left=x+'px';h.style.top=y+'px';}
  else{h.style.left='';h.style.top='';}};
App._crmEmoClose=()=>{var h=document.getElementById('crm-emohost');if(h)h.classList.remove('on');};
App._crmEmoPick=(ch)=>{if(!ch)return;var st=CRM._emo||{};_crmEmoRecPush(ch);try{if(navigator.vibrate)navigator.vibrate(5);}catch(e){}
  if(st.mode==='react'&&st.cid&&st.mid){App._crmEmoClose();App._crmReact(st.cid,st.mid,encodeURIComponent(ch));return;}
  var el=document.getElementById(st.mode==='tinput'?'crm-tinput':'crm-input');if(!el)return;
  var p=el.selectionStart!=null?el.selectionStart:el.value.length;var q=el.selectionEnd!=null?el.selectionEnd:p;
  el.value=el.value.slice(0,p)+ch+el.value.slice(q);var np=p+ch.length;
  try{el.focus();el.setSelectionRange(np,np);}catch(e){}App._crmGrow(el);};

/* ── one-time wiring: styles, gestures, keyboard pinning, panel dismissal ── */
(function(){
  if(window._crmPlus)return;window._crmPlus=true;

  /* premark thread replies as seen before the panel opens (no mass animation) */
  var _o=App._crmOpenThread;
  App._crmOpenThread=function(mid){try{var c=_crmConvo(CRM.sel.convoId);CRM._seenM=CRM._seenM||{};if(c)(c.messages||[]).forEach(function(x){if(x.parentId===mid||x.id===mid)CRM._seenM[x.id]=1;});}catch(e){}return _o(mid);};

  /* dismiss emoji panel on outside tap / Esc */
  document.addEventListener('click',function(e){var h=document.getElementById('crm-emohost');if(!h||!h.classList.contains('on'))return;if(e.target.closest&&(e.target.closest('#crm-emohost')||e.target.closest('.crm-emobtn')))return;h.classList.remove('on');},true);
  document.addEventListener('keydown',function(e){if(e.key==='Escape')App._crmEmoClose();});

  /* swipe-right a message to reply in thread (touch devices) */
  var st=null;
  document.addEventListener('touchstart',function(e){var ms=e.target.closest&&e.target.closest('#crm-thread .crm-msg[data-swipe]');if(!ms)return;var t=e.touches[0];st={el:ms,x:t.clientX,y:t.clientY,go:false,d:0};},{passive:true});
  document.addEventListener('touchmove',function(e){if(!st)return;var t=e.touches[0];var dx=t.clientX-st.x,dy=t.clientY-st.y;
    if(!st.go){if(Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)){st=null;return;}if(dx>14&&Math.abs(dx)>Math.abs(dy)*1.2)st.go=true;else return;}
    var d=Math.max(0,Math.min(dx,76));st.d=d;st.el.style.transform='translateX('+(d*.55)+'px)';st.el.classList.toggle('crm-swok',d>52);},{passive:true});
  document.addEventListener('touchend',function(){if(!st)return;var el=st.el,ok=(st.d||0)>52;el.style.transition='transform .18s ease';el.style.transform='';setTimeout(function(){el.style.transition='';},220);el.classList.remove('crm-swok');
    if(ok){try{if(navigator.vibrate)navigator.vibrate(10);}catch(e){}var mid=el.getAttribute('data-mid');if(mid)App._crmOpenThread(mid);}st=null;},{passive:true});

  /* keep the newest message visible when the mobile keyboard opens */
  if(window.visualViewport){window.visualViewport.addEventListener('resize',function(){var t=document.getElementById('crm-thread');if(!t)return;var atB=(t.scrollHeight-t.scrollTop-t.clientHeight)<140;if(atB)setTimeout(function(){t.scrollTop=t.scrollHeight;},60);});}

  /* typing indicator refresh */
  setInterval(function(){if(S&&S.route==='crm')_crmTypingPaint();},1100);

  var css=''
  +'.crm-scroll{-webkit-overflow-scrolling:touch;overscroll-behavior:contain}'
  /* bubbles */
  +'.crm-bub{position:relative;padding:7px 9px 8px 11px;font-size:13.5px;line-height:1.42;word-break:break-word;box-shadow:0 1px 1.5px rgba(35,28,22,.10);max-width:100%;transition:transform .1s}'
  +'.crm-bub-their{background:#fff;color:#13171B;border-radius:14px 14px 14px 5px}'
  +'.crm-bub-mine{background:linear-gradient(160deg,#5E4C43 0%,#54433C 70%);color:#fff;border-radius:14px 14px 5px 14px}'
  +'.crm-msg:active .crm-bub{transform:scale(.985)}'
  +'.crm-meta{float:right;margin:8px -3px -4px 9px;font-size:10px;line-height:1;display:inline-flex;align-items:center;gap:3px;color:#A59788;user-select:none;white-space:nowrap}'
  +'.crm-bub-mine .crm-meta{color:rgba(255,234,215,.75)}'
  +'.crm-ticks{display:inline-flex;align-items:center}'
  +'.crm-tk-read{color:#FFD9A0}.crm-bub-their .crm-tk-read{color:#C9A76B}'
  +'.crm-edited{font-style:normal;opacity:.75;margin-right:4px}'
  +'.crm-bigemo{background:transparent!important;border:none!important;box-shadow:none!important;padding:0 2px!important;font-size:42px;line-height:1.2}'
  +'.crm-bigemo .crm-meta{float:none;display:flex;justify-content:flex-end;margin:1px 2px 0;color:#A59788}'
  +'.crm-media{padding:4px 4px 6px!important}'
  /* entrance animations */
  +'@keyframes crmIn{from{opacity:0;transform:translateY(10px) scale(.96)}to{opacity:1;transform:none}}'
  +'@keyframes crmOut{from{opacity:0;transform:translate(12px,10px) scale(.94)}to{opacity:1;transform:none}}'
  +'.crm-anew-in{animation:crmIn .26s cubic-bezier(.2,.8,.25,1)}'
  +'.crm-anew-out{animation:crmOut .24s cubic-bezier(.2,.8,.25,1);transform-origin:100% 100%}'
  /* date pills */
  +'.crm-datep{display:flex;justify-content:center;position:sticky;top:2px;z-index:6;margin:10px 0 3px}'
  +'.crm-datep span{font-size:10.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#7B6D62;background:rgba(255,255,255,.92);border:1px solid #EAE3D8;border-radius:20px;padding:3px 12px;box-shadow:0 1px 3px rgba(35,28,22,.08);backdrop-filter:blur(4px)}'
  /* reactions */
  +'.crm-reacts{display:flex;gap:3px;flex-wrap:wrap;margin-top:-7px;z-index:2;padding:0 4px}'
  +'.crm-mine .crm-reacts{justify-content:flex-end}'
  +'.crm-rchip{display:inline-flex;align-items:center;gap:2px;font-size:12px;border:1px solid #EAE3D8;background:#fff;border-radius:20px;padding:1.5px 7px;cursor:pointer;box-shadow:0 1px 3px rgba(35,28,22,.10);transition:transform .12s}'
  +'.crm-rchip b{font-size:10px;color:#786A5F}'
  +'.crm-rchip.on{border-color:#D1B68F;background:#FBF4E7}'
  +'.crm-rchip:active{transform:scale(1.18)}'
  /* wallpaper */
  +'.crm-wall{background-color:#F2EBE1;background-image:radial-gradient(900px 420px at 88% -12%,rgba(209,182,143,.16),transparent 60%),radial-gradient(760px 460px at -12% 112%,rgba(175,123,109,.11),transparent 55%),url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%27220%27%20height%3D%27220%27%3E%3Cg%20fill%3D%27none%27%20stroke%3D%27%2313171B%27%20stroke-opacity%3D%27.05%27%20stroke-width%3D%271.3%27%3E%3Ccircle%20cx%3D%2730%27%20cy%3D%2734%27%20r%3D%277%27%2F%3E%3Cpath%20d%3D%27M160%2040c8-10%2022-10%2026%200-10%208-22%206-26%200z%27%2F%3E%3Ccircle%20cx%3D%27110%27%20cy%3D%27120%27%20r%3D%275%27%2F%3E%3Cpath%20d%3D%27M40%20170c0-9%208-16%2017-16%27%2F%3E%3Ccircle%20cx%3D%27190%27%20cy%3D%27180%27%20r%3D%278%27%2F%3E%3Cpath%20d%3D%27M90%20190l8%208m0-8l-8%208%27%2F%3E%3Cpath%20d%3D%27M150%20150c6-6%2014-6%2018%200%27%2F%3E%3Ccircle%20cx%3D%2770%27%20cy%3D%2780%27%20r%3D%273.4%27%2F%3E%3Cpath%20d%3D%27M190%2090c-7%202-12%208-12%2015%27%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E")}'
  /* composer pill */
  +'.crm-pill{flex:1;display:flex;align-items:flex-end;gap:2px;background:#fff;border:1px solid #E6DED3;border-radius:23px;padding:3px 5px 3px 4px;min-width:0;transition:box-shadow .15s,border-color .15s}'
  +'.crm-pill:focus-within{border-color:#D1B68F;box-shadow:0 0 0 3px rgba(209,182,143,.22)}'
  +'.crm-pill textarea{flex:1;resize:none;border:none;background:transparent;padding:8px 4px;font-size:14px;font-family:inherit;outline:none;max-height:120px;line-height:1.45;min-width:0}'
  +'.crm-pill textarea:focus{box-shadow:none!important;border-color:transparent!important}'
  +'.crm-emobtn,.crm-attbtn{width:36px;height:36px;border:none;background:transparent;border-radius:50%;display:grid;place-items:center;cursor:pointer;color:#8A7B6D;flex-shrink:0;transition:background .12s,transform .12s,color .12s;align-self:flex-end;margin-bottom:1px}'
  +'.crm-emobtn:hover,.crm-attbtn:hover{background:#F4EFE7;color:#54433C}'
  +'.crm-emobtn:active,.crm-attbtn:active{transform:scale(.88)}'
  +'.crm-sendbtn{width:44px;height:44px;border-radius:50%;border:none;background:linear-gradient(150deg,#5E4C43,#54433C);color:#FFEAD7;cursor:pointer;display:grid;place-items:center;flex-shrink:0;box-shadow:0 3px 10px -2px rgba(35,28,22,.4);transition:transform .12s,box-shadow .15s}'
  +'.crm-sendbtn:hover{box-shadow:0 5px 14px -2px rgba(35,28,22,.45)}'
  +'.crm-sendbtn:active{transform:scale(.86)}'
  +'.crm-sendbtn-sm{width:38px;height:38px}'
  +'.crm-pill-sm textarea{font-size:13px;padding:7px 4px}'
  /* jump to latest */
  +'#crm-jump{position:absolute;right:14px;bottom:78px;width:40px;height:40px;border-radius:50%;border:1px solid #EAE3D8;background:rgba(255,255,255,.97);color:#54433C;display:grid;place-items:center;cursor:pointer;box-shadow:0 4px 14px rgba(35,28,22,.20);opacity:0;transform:translateY(10px);pointer-events:none;transition:opacity .18s,transform .18s;z-index:12}'
  +'#crm-jump.on{opacity:1;transform:none;pointer-events:auto}'
  /* typing */
  +'.crm-typ{color:#936659;font-weight:600;display:inline-flex;align-items:center}'
  +'.crm-typd{display:inline-flex;gap:2.5px;margin-left:5px}'
  +'.crm-typd i{width:4px;height:4px;border-radius:50%;background:currentColor;animation:crmTy 1.2s infinite}'
  +'.crm-typd i:nth-child(2){animation-delay:.15s}.crm-typd i:nth-child(3){animation-delay:.3s}'
  +'@keyframes crmTy{0%,60%,100%{opacity:.25;transform:translateY(0)}30%{opacity:1;transform:translateY(-2.5px)}}'
  /* unread badge */
  +'.crm-unb{min-width:18px;height:18px;border-radius:10px;background:#D1B68F;color:#2B2118;font-size:10.5px;font-weight:800;display:inline-grid;place-items:center;padding:0 5px;flex-shrink:0;box-shadow:0 1px 2px rgba(35,28,22,.15)}'
  /* swipe hint */
  +'.crm-swhint{position:absolute;left:-36px;top:50%;transform:translateY(-50%) scale(.6);opacity:0;color:#54433C;background:#fff;border:1px solid #EAE3D8;border-radius:50%;width:28px;height:28px;display:grid;place-items:center;transition:opacity .15s,transform .15s;pointer-events:none;z-index:3}'
  +'.crm-mine .crm-swhint{left:auto;right:-36px}'
  +'.crm-swok .crm-swhint{opacity:1;transform:translateY(-50%) scale(1)}'
  /* emoji picker */
  +'#crm-emohost{position:fixed;z-index:220;width:352px;height:340px;background:#fff;border:1px solid #E6DED3;border-radius:16px;box-shadow:0 18px 50px rgba(35,28,22,.28);display:none;flex-direction:column;overflow:hidden}'
  +'#crm-emohost.on{display:flex;animation:crmIn .16s ease}'
  +'#crm-emohost .crm-ehd{display:flex;gap:2px;padding:8px 8px 5px;border-bottom:1px solid #F1ECE4;overflow-x:auto;flex-shrink:0}'
  +'.crm-ecat{border:none;background:transparent;font-size:17px;padding:5px 8px;border-radius:9px;cursor:pointer;flex-shrink:0;opacity:.55;transition:opacity .12s,background .12s}'
  +'.crm-ecat.on{background:#F3EDE2;opacity:1}'
  +'#crm-emohost .crm-egrid{flex:1;overflow-y:auto;display:grid;grid-template-columns:repeat(8,1fr);gap:2px;padding:8px;align-content:start}'
  +'.crm-eemo{border:none;background:transparent;font-size:21px;padding:4px 0;border-radius:8px;cursor:pointer;line-height:1.25;transition:transform .1s,background .1s}'
  +'.crm-eemo:hover{background:#F4EFE7}'
  +'.crm-eemo:active{transform:scale(1.3)}'
  +'.crm-elab{grid-column:1/-1;font-size:11px;font-weight:600;color:#A59788}'
  /* mobile */
  +'@media(max-width:767px){'
    +'.crm-bub{font-size:14.5px;padding:8px 10px 9px 12px}'
    +'.crm-pill textarea{font-size:16px}'
    +'.crm-sendbtn{width:46px;height:46px}'
    +'.crm-msg{max-width:84%!important}'
    +'#crm-jump{bottom:86px}'
    +'#crm-emohost.on{left:0!important;right:0;top:auto!important;bottom:0;width:auto;height:46vh;border-radius:18px 18px 0 0;padding-bottom:env(safe-area-inset-bottom);box-shadow:0 -14px 44px rgba(35,28,22,.3)}'
    +'.crm-eemo{font-size:25px;padding:6px 0}'
  +'}'
  +'@media(prefers-reduced-motion:reduce){.crm-anew-in,.crm-anew-out,#crm-emohost.on{animation:none}.crm-typd i{animation:none}}';
  document.head.insertAdjacentHTML('beforeend','<style id="crm-plus-css">'+css+'</style>');
})();


/* ═══ CHAT+ round 2: clickable links + loud incoming-message sound ═══ */
var _crmAC=null,_crmDingT=0;
function _crmSndOn(){try{if(typeof _bbSndAllow==='function')return _bbSndAllow('workspace_message');return localStorage.getItem('bb_chat_sound')!=='0';}catch(e){return true;}}
App._crmSndTog=(btn)=>{var on;if(typeof _bbSndSet==='function'&&typeof _bbSndAllow==='function'){on=!_bbSndAllow('workspace_message');_bbSndSet('workspace_message',on);}else{on=!(localStorage.getItem('bb_chat_sound')!=='0');try{localStorage.setItem('bb_chat_sound',on?'1':'0');}catch(e){}}if(btn)btn.textContent=on?'\u{1F514}':'\u{1F515}';if(on)_crmDing(null,true);try{toast(on?'Chat sound on \u{1F514}':'Chat sound off');}catch(e){}};
function _crmACtx(){try{if(!_crmAC)_crmAC=new (window.AudioContext||window.webkitAudioContext)();if(_crmAC.state==='suspended')_crmAC.resume();return _crmAC;}catch(e){return null;}}
function _crmDing(m,force){
  if(!force){if(!_crmSndOn())return;var now=Date.now();if(now-(window._bbDingT||0)<1500)return;window._bbDingT=now;}
  var ctx=_crmACtx();if(!ctx)return;
  try{
    var t0=ctx.currentTime+0.02;
    var master=ctx.createGain();master.gain.value=0.95;
    var comp=ctx.createDynamicsCompressor();master.connect(comp);comp.connect(ctx.destination);
    var seq=[740,988,1245,740,988,1245];
    for(var i=0;i<seq.length;i++){
      var t=t0+i*0.185;var f=seq[i];
      for(var d=0;d<2;d++){
        var o=ctx.createOscillator();o.type='square';o.frequency.setValueAtTime(f+(d?7:0),t);
        var g=ctx.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.55,t+0.015);g.gain.setValueAtTime(0.55,t+0.125);g.gain.exponentialRampToValueAtTime(0.001,t+0.17);
        o.connect(g);g.connect(master);o.start(t);o.stop(t+0.18);
      }
    }
  }catch(e){}
}
(function(){
  if(window._crmPlus2)return;window._crmPlus2=true;
  /* browsers only allow audio after a user gesture — unlock on the first one */
  ['click','keydown','touchstart'].forEach(function(ev){
    document.addEventListener(ev,function once(){_crmACtx();document.removeEventListener(ev,once,true);},true);
  });
  document.head.insertAdjacentHTML('beforeend','<style id="crm-plus2-css">'
   +'.crm-link{color:#936659;font-weight:600;text-decoration:underline;text-underline-offset:2px;word-break:break-all}'
   +'.crm-link:active{opacity:.7}'
   +'.crm-bub-mine .crm-link{color:#FFEAD7}'
   +'.crm-bub-mine .crm-tag{background:rgba(255,255,255,.24);color:#fff}'
   +'</style>');
})();
