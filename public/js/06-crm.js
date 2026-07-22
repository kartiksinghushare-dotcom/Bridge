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
function _crmInit(){if(CRM)return;CRM={_loaded:false,_loading:false,_err:null,hubs:[],boards:[],views:[],categories:[],convos:[],reminders:[],sel:{hubId:null,boardId:null,viewId:null,category:'Chats',convoId:null,threadId:null},sidebarCollapsed:false,collapsedHubs:{},channels:[],boardMembersOpen:false,activity:[],settings:{},activityOpen:false,boardSettingsOpen:false,globalSettingsOpen:false,_bsBoardId:null,_rowAdd:null,search:'',compose:{images:[]},editMsgId:null,fwdMsgId:null,listFilter:'all',reads:{},boardFilter:{},boardView:(function(){try{return JSON.parse(localStorage.getItem('bridge_crm_views')||'{}');}catch(e){return{};}})()};if(!CRM._remInt)CRM._remInt=setInterval(function(){try{if(CRM&&CRM._loaded)_crmCheckReminders();}catch(e){}},60000);}
const _crmSeeAll=()=>isAdmin()||can('crm','manage');
/* ── People scoping (v3.12: channels removed) — a board's people = its members ── */
function _crmBoardPeople(board){var ids={};((board&&board.members)||[]).forEach(function(x){ids[x]=1;});return Object.keys(ids).map(function(x){return uById(x);}).filter(function(u){return u&&u.status!=='Disabled';}).sort(function(a,b){return fullName(a).localeCompare(fullName(b));});}
/* ── People groups (workspace-wide, stored in CRM.settings.groups) ── */
function _crmGroups(){return (CRM&&CRM.settings&&Array.isArray(CRM.settings.groups))?CRM.settings.groups:[];}
function _crmGroup(id){return _crmGroups().find(function(g){return g.id===id;});}
function _crmGroupToken(g){return String((g&&g.name)||'').replace(/[^\w]/g,'');}
/* Expand a mixed list of user-ids and 'grp:<id>' entries into unique user-ids */
function _crmExpandPeople(list){var out={};(list||[]).forEach(function(x){if(!x)return;if(String(x).indexOf('grp:')===0){var g=_crmGroup(String(x).slice(4));((g&&g.members)||[]).forEach(function(id){out[id]=1;});}else out[x]=1;});return Object.keys(out);}
function _crmSaveSettings(label){sbWrite({table:'workspace_settings',op:'upsert',values:{key:'crm_settings',value:CRM.settings},opts:{onConflict:'key'}},{label:label||'CRM settings'});}
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
function _crmBoardVisible(b){if(!b)return false;if(_crmSeeAll())return true;if((b.members||[]).indexOf(S.uid)>=0)return true;return b.createdBy===S.uid;}
function _crmVisibleBoards(){return (CRM.boards||[]).filter(_crmBoardVisible);}
/* ── v3.12.1: FILTERED VIEWS — a saved, member-scoped MIRROR OF THE WHOLE HUB: same board
   tabs as the hub itself, each ticket board narrowed by the view's saved per-board conditions.
   Only the view's assigned members (+ its creator + CRM managers) can open it; assigned people
   see all the hub's boards through the view even if they are not members of those boards. ── */
function _crmView(id){return (CRM.views||[]).find(function(v){return v.id===id;});}
function _crmViewVisible(v){if(!v)return false;if(_crmSeeAll())return true;if(v.createdBy===S.uid)return true;return (v.members||[]).indexOf(S.uid)>=0;}
function _crmVisibleViews(hubId){return (CRM.views||[]).filter(function(v){return v.hubId===hubId&&_crmViewVisible(v);});}
function _crmViewCanEdit(v){return !!v&&(_crmSeeAll()||v.createdBy===S.uid)&&can('crm','views');}
function _crmHubVisible(h){if(!h)return false;if(_crmSeeAll()||can('crm','create'))return true;return (CRM.boards||[]).some(function(b){return b.hubId===h.id&&_crmBoardVisible(b);})||(CRM.views||[]).some(function(v){return v.hubId===h.id&&_crmViewVisible(v);});}
/* Board ids whose content the user may read: visible boards ∪ every board of hubs with a visible view
   (v3.12.1: a filtered view mirrors the WHOLE hub — all of its boards, narrowed by the view's filters) */
function _crmVisibleBoardIds(){var s={};_crmVisibleBoards().forEach(b=>s[b.id]=1);(CRM.views||[]).forEach(function(v){if(!_crmViewVisible(v))return;(CRM.boards||[]).forEach(function(b){if(b.hubId===v.hubId)s[b.id]=1;});});return s;}
/* The view's saved conditions for ONE board (filters is a per-board map: {boardId:[conds]}) */
function _crmViewFilters(v,boardId){var f=(v&&v.filters)||{};return (f&&!Array.isArray(f)&&Array.isArray(f[boardId]))?f[boardId]:[];}
const _crmPri={Low:['#6B7280','#F3F4F6'],Medium:['#B45309','#FFF7ED'],High:['#B91C1C','#FEF2F2'],Critical:['#6D28D9','#F5F3FF']};
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
const _CRM_DEF_STATUSES=[{name:'Open',color:'#F97316'},{name:'In Progress',color:'#3B82F6'},{name:'Resolved',color:'#2E9E6B',done:true},{name:'Closed',color:'#6B7280',done:true}];
function _crmStatuses(b){var st=b&&b.settings&&b.settings.statuses;return (Array.isArray(st)&&st.length)?st:_CRM_DEF_STATUSES;}
function _crmStatusMeta(b,name){var st=_crmStatuses(b);return st.find(function(x){return x.name===name;})||{name:name||'Open',color:'#9CA3AF'};}
function _crmIsDone(b,name){var m=_crmStatusMeta(b,name);if(typeof m.done==='boolean')return m.done;return name==='Resolved'||name==='Closed';}
function _crmStatusChip(b,name){var m=_crmStatusMeta(b,name);return'<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:800;color:'+m.color+';background:'+m.color+'1A;border-radius:20px;padding:3px 9px;white-space:nowrap"><span style="width:6px;height:6px;border-radius:50%;background:'+m.color+'"></span>'+esc(m.name)+'</span>';}
function _crmStatusSel(b,convo,style){if(!can('crm','edit'))return _crmStatusChip(b,convo.status);var m=_crmStatusMeta(b,convo.status);var st=style||('font-size:11.5px;font-weight:700;color:'+m.color+';background:'+m.color+'14;border:1px solid '+m.color+'33;border-radius:7px;padding:3px 24px 3px 7px;cursor:pointer;max-width:150px');var opts=_crmStatuses(b).map(function(x){return'<option '+(x.name===convo.status?'selected':'')+'>'+esc(x.name)+'</option>';}).join('');if(!_crmStatuses(b).some(function(x){return x.name===convo.status;}))opts='<option selected>'+esc(convo.status)+'</option>'+opts;return'<select onchange="App._crmSetStatus(\''+convo.id+'\',this.value)" style="'+st+'">'+opts+'</select>';}
function _crmDueMeta(c){if(!c||!c.isTicket||!c.dueDate)return null;var _b=_crmBoard(c.boardId);var over=c.dueDate<todayISO()&&!_crmIsDone(_b,c.status);var today=c.dueDate===todayISO();return{overdue:over,today:today,label:fmtS(c.dueDate),color:over?'#DC2626':today?'#B45309':'#6B7280',bg:over?'#FEF2F2':today?'#FFFBEB':'#F3F4F6'};}
function _crmCats(board){var c=board&&board.settings&&board.settings.categories;return (c&&c.length)?c:[];}
const _crmFirst=u=>u?(fullName(u).split(' ')[0]||fullName(u)):'';
const _CRM_EMO=['\u{1F44D}','❤️','\u{1F602}','\u{1F389}','\u{1F62E}'];
function _crmCustAv(name,sz){sz=sz||34;var n=(name||'?').trim();var ini=(n[0]||'?').toUpperCase();var h=0;for(var i=0;i<n.length;i++)h+=n.charCodeAt(i);var bg=['#8B6B41','#2563EB','#D97706','#7C3AED','#DB2777','#0891B2'][h%6];return'<div style="width:'+sz+'px;height:'+sz+'px;border-radius:50%;background:'+bg+';color:#fff;display:grid;place-items:center;font-size:'+Math.round(sz*0.4)+'px;font-weight:700;flex-shrink:0">'+esc(ini)+'</div>';}
function _crmAt(t){return esc(t||'').replace(/@(\w+)/g,'<span style="background:#F1EAD9;color:#54433C;font-weight:700;border-radius:4px;padding:0 3px">@$1</span>');}
function _crmImgs(imgs){if(!imgs||!imgs.length)return'';return'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">'+imgs.map(function(s){return'<img src="'+s+'" onclick="App._bigImg&&App._bigImg(this.src)" style="width:130px;height:96px;object-fit:cover;border-radius:10px;border:1px solid rgba(0,0,0,.08);cursor:pointer"/>';}).join('')+'</div>';}
async function _crmProvisionDefault(){var hid=uid('hub'),bid=uid('brd');CRM.hubs.push({id:hid,name:'General',icon:'msg'});CRM.boards.push({id:bid,hubId:hid,name:'Chat',members:S.uid?[S.uid]:[],settings:{type:'chat'},createdBy:S.uid||null});CRM.sel.hubId=hid;CRM.sel.boardId=bid;try{await sb.from('crm_hubs').insert({id:hid,name:'General',icon:'msg',created_by:S.uid||null,sort:0});await sb.from('crm_boards').insert({id:bid,hub_id:hid,name:'Chat',created_by:S.uid||null,sort:0,settings:{type:'chat'}});if(S.uid)await sb.from('crm_board_members').insert({board_id:bid,user_id:S.uid});}catch(e){console.warn('[CRM default]',e&&e.message);}}
/* ── v3.12: every hub ALWAYS has a Chat board by default — created with the hub and healed
   here if ever missing (deleted, or a hub left empty). Deterministic id ('brd_chat_<hubId>')
   makes this idempotent: two clients loading at once can never double-create it. ── */
function _crmEnsureChatBoards(){
  if(!S.uid||!can('crm','create'))return;
  (CRM.hubs||[]).forEach(function(h){
    if((CRM.boards||[]).some(function(b){return b.hubId===h.id&&_crmBS(b).type==='chat';}))return;
    var bid='brd_chat_'+h.id;
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
      sb.from('crm_reminders').select('*').eq('user_id',S.uid||'').eq('fired',false),
      sb.from('crm_views').select('*').order('sort',{ascending:true})
    ]);
    if(R[0].error)throw R[0].error;
    CRM.hubs=(R[0].data||[]).map(r=>({id:r.id,name:r.name,icon:r.icon||'folder'}));
    const mb={};(R[2].data||[]).forEach(r=>{(mb[r.board_id]=mb[r.board_id]||[]).push(r.user_id);});
    CRM.boards=(R[1].data||[]).map(r=>({id:r.id,hubId:r.hub_id,name:r.name,members:mb[r.id]||[],settings:r.settings||{},createdBy:r.created_by||null}));
    CRM.categories=(R[3].data||[]).map(r=>r.name);
    const mc={};(R[5].data||[]).forEach(r=>{(mc[r.conversation_id]=mc[r.conversation_id]||[]).push({id:r.id,senderId:r.sender_id,fromCustomer:r.from_customer,name:r.name,text:r.body||'',images:r.images||[],at:r.created_at,reactions:r.reactions||{},parentId:r.parent_id||null,edited:!!r.edited_at});});
    CRM.convos=(R[4].data||[]).map(r=>({id:r.id,boardId:r.board_id,title:r.title,customer:r.customer,channel:r.channel,isTicket:r.is_ticket,ticketType:r.ticket_type,priority:r.priority||'Medium',status:r.status||'Open',assignedTo:r.assigned_to||null,createdBy:r.created_by||null,decision:r.decision||null,decidedBy:r.decided_by||null,decidedAt:r.decided_at||null,fields:r.fields||{},dueDate:r.due_date||null,createdAt:r.created_at,lastAt:r.last_at,messages:mc[r.id]||[]}));CRM.reminders=((R[9]&&R[9].data)||[]).map(function(r){return{id:r.id,userId:r.user_id,conversationId:r.conversation_id,messageId:r.message_id||null,remindAt:r.remind_at,note:r.note||'',fired:!!r.fired};});CRM.activity=(R[6].data||[]).map(function(r){return{id:r.id,conversationId:r.conversation_id,boardId:r.board_id,actor:r.actor,action:r.action,detail:r.detail||'',at:r.created_at};});try{var _gs=R[7].data&&R[7].data[0]&&R[7].data[0].value;if(_gs&&typeof _gs==='object')CRM.settings=_gs;}catch(e){}CRM.channels=[];CRM.views=((R[10]&&R[10].data)||[]).map(function(r){var fl=r.filters;if(fl&&typeof fl==='object'&&!Array.isArray(fl)){}else if(Array.isArray(fl)&&fl.length&&r.board_id){var _m={};_m[r.board_id]=fl;fl=_m;}else{fl={};}return{id:r.id,hubId:r.hub_id,name:r.name||'',filters:fl,members:Array.isArray(r.members)?r.members:[],createdBy:r.created_by||null,sort:r.sort||0};});CRM.reads={};((R[8]&&R[8].data)||[]).forEach(function(r){CRM.reads[r.conversation_id]=r.last_seen_at;});
    if(!CRM.hubs.length&&can('crm','create')&&S.uid)await _crmProvisionDefault();
    _crmEnsureChatBoards();
    if(CRM.sel.viewId&&!_crmViewVisible(_crmView(CRM.sel.viewId)))CRM.sel.viewId=null;
    const vb=_crmVisibleBoards();
    if(!CRM.sel.viewId&&(!CRM.sel.boardId||!vb.some(x=>x.id===CRM.sel.boardId))){var fb=vb[0];CRM.sel.boardId=fb?fb.id:null;CRM.sel.hubId=fb?fb.hubId:null;}
  }catch(e){CRM._err=(e&&e.message)||'Failed to load';console.warn('[CRM load]',CRM._err);}
  CRM._loaded=true;CRM._loading=false;rr();try{_crmCheckReminders();}catch(e){}
}
const _crmStyle='<style>.crm-only-mob{display:none!important}@media(max-width:767px){.crm-fs{bottom:60px!important}.crm-nav{position:absolute!important;left:0;top:0;bottom:0;z-index:40;width:82%!important;max-width:300px;transform:translateX(-100%);transition:transform .2s;box-shadow:4px 0 26px rgba(0,0,0,.22)}.crm-nav.crmopen{transform:none!important}.crm-listcol{width:100%!important;max-width:none!important;min-width:0!important}.crm-chatpane{display:none!important}.crm-hasconvo .crm-listcol{display:none!important}.crm-hasconvo .crm-chatpane{display:flex!important}.crm-hasconvo .crm-boardbar{display:none!important}.crm-hasconvo .crm-tabsrow{display:none!important}.crm-only-mob{display:inline-flex!important}.crm-hide-mob{display:none!important}.crm-chx,.crm-del,.crm-bdel,.crm-hdel,.crm-macts{display:flex!important}}.crm-chrow:hover .crm-chx{display:grid!important}.crm-scroll::-webkit-scrollbar{width:9px;height:9px}.crm-scroll::-webkit-scrollbar-thumb{background:#E3E5E9;border-radius:9px}.crm-scroll::-webkit-scrollbar-track{background:transparent}.crm-row:hover .crm-del{display:grid!important}.crm-brd:hover .crm-bdel{display:grid!important}.crm-hub:hover .crm-hdel{display:grid!important}.crm-tab:hover .crm-tx{display:inline-flex!important}.crm-msg:hover .crm-macts{display:flex!important}.crm-colh:hover .crm-colx{display:inline-flex!important}.crm-cell:focus{border-color:#8B6B41!important;background:#fff!important}.crm-trow:hover{background:#FAFBFC}.crm-rz{position:absolute;right:-4px;top:0;bottom:0;width:9px;cursor:col-resize;z-index:3}.crm-rz:hover,.crm-rz:active{background:rgba(139,107,65,.28);border-radius:3px}.crm-grip{display:inline-flex;align-items:center;color:#C9C2B4;cursor:grab;margin-right:6px;vertical-align:middle;padding:2px;border-radius:4px}.crm-grip:hover{color:#8B6B41;background:#F5EEE1}.crm-grip:active{cursor:grabbing}.crm-colh.crm-drop-l{box-shadow:inset 3px 0 0 #8B6B41}.crm-colh.crm-drop-r{box-shadow:inset -3px 0 0 #8B6B41}.crm-colh.crm-dragging{opacity:.45}</style>';
function _crmEmpty(icon,title,sub,btn){return'<div style="flex:1;display:grid;place-items:center;padding:40px"><div style="text-align:center;max-width:360px"><div style="width:56px;height:56px;border-radius:16px;background:#F8F5EE;color:#8B6B41;display:grid;place-items:center;margin:0 auto 14px">'+ic(icon,'w-7 h-7')+'</div><div class="fd" style="font-size:16px;font-weight:800;color:#13171B">'+esc(title)+'</div><div style="font-size:13px;color:#9CA3AF;margin-top:5px;line-height:1.5">'+esc(sub)+'</div>'+(btn||'')+'</div></div>';}
function _crmConvoRow(c,activeId,showBoard){
  var active=c.id===activeId;var last=(c.messages||[])[c.messages.length-1];var unread=_crmUnread(c);var due=_crmDueMeta(c);
  var snip=last?((last.fromCustomer?'':'You: ')+(last.text||((last.images&&last.images.length)?'\u{1F4F7} Photo':''))):'No messages yet';
  var typeChip=c.isTicket?'<span style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#4338CA;background:#EEF2FF;border-radius:5px;padding:1px 5px">'+esc(c.ticketType||'Ticket')+'</span>':'';
  var asg=c.assignedTo&&uById(c.assignedTo)?'<span title="Assigned to '+esc(fullName(uById(c.assignedTo)))+'">'+avatar(uById(c.assignedTo),'w-[18px] h-[18px]','text-[8px]')+'</span>':'';
  var bd=showBoard&&_crmBoard(c.boardId)?'<span style="font-size:9.5px;font-weight:700;color:#6B7280;background:#F1F2F4;border-radius:5px;padding:1px 6px">'+esc(_crmBoard(c.boardId).name)+'</span>':'';
  var del=can('crm','delete')?'<button title="Delete" onclick="event.stopPropagation();App._crmDelConvo(\''+c.id+'\')" class="crm-del" style="position:absolute;top:9px;right:9px;width:22px;height:22px;border:none;background:#fff;color:#DC2626;cursor:pointer;border-radius:6px;display:none;place-items:center;box-shadow:0 1px 3px rgba(0,0,0,.12)">'+ic('trash','w-3.5 h-3.5')+'</button>':'';
  return'<div class="crm-row" onclick="'+(showBoard?'App._crmOpenResult':'App._crmSelConvo')+'(\''+c.id+'\')" style="position:relative;cursor:pointer;padding:7px 10px;border-bottom:1px solid #F3F4F6;background:'+(active?'#F8F5EE':unread?'#FAF7F0':'#fff')+';border-left:3px solid '+(active?'#8B6B41':unread?'#D1B68F':'transparent')+'">'
    +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">'+_crmCustAv(c.customer,24)
    +'<span style="font-size:13px;font-weight:700;color:#13171B;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(c.customer||'—')+'</span>'
    +(unread?'<span title="Unread" style="width:8px;height:8px;border-radius:50%;background:#8B6B41;flex-shrink:0"></span>':'')+'<span style="font-size:10px;color:'+(unread?'#8B6B41':'#B8B5AC')+';font-weight:'+(unread?'800':'400')+';flex-shrink:0">'+_crmRel(c.lastAt)+'</span></div>'
    +'<div style="font-size:12px;font-weight:600;color:#374151;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-left:32px">'+esc(c.title||'')+'</div>'
    +'<div style="display:flex;align-items:center;gap:6px;margin-left:32px;margin-top:2px">'+bd+'<span style="font-size:11px;color:#9CA3AF;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(snip)+'</span>'+typeChip+(due?'<span style="font-size:9.5px;font-weight:800;color:'+due.color+';background:'+due.bg+';border-radius:5px;padding:1px 6px;flex-shrink:0">'+(due.overdue?'\u26A0 ':'')+due.label+'</span>':'')+'</div>'+del+'</div>';
}
function _crmReactChips(m,cid){
  var ks=Object.keys(m.reactions||{}).filter(function(e){return (m.reactions[e]||[]).length;});
  if(!ks.length)return'';
  return'<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:3px">'+ks.map(function(e){var arr=m.reactions[e]||[];var mine=arr.indexOf(S.uid)>=0;return'<button onclick="App._crmReact(\''+cid+'\',\''+m.id+'\',\''+encodeURIComponent(e)+'\')" style="display:inline-flex;align-items:center;gap:3px;font-size:11px;border:1px solid '+(mine?'#8B6B41':'#E5E7EB')+';background:'+(mine?'#F8F5EE':'#fff')+';border-radius:20px;padding:1px 7px;cursor:pointer">'+e+' '+arr.length+'</button>';}).join('')+'</div>';
}
function _crmMsgActions(m,cid,thread){
  if(m.fromCustomer)return'';
  var own=m.senderId===S.uid;var part=can('crm','create');if(!part&&!can('crm','delete'))return'';
  var b='';
  if(part)b+=_CRM_EMO.map(function(e){return'<button title="React" onclick="App._crmReact(\''+cid+'\',\''+m.id+'\',\''+encodeURIComponent(e)+'\')" style="border:none;background:transparent;cursor:pointer;font-size:14px;line-height:1;padding:2px 3px">'+e+'</button>';}).join('');
  if(part&&!thread&&!m.parentId)b+='<button title="Reply in thread" onclick="App._crmOpenThread(\''+m.id+'\')" style="border:none;background:transparent;cursor:pointer;color:#6B7280;padding:2px 3px">'+ic('msg','w-3.5 h-3.5')+'</button>';
  if(part)b+='<button title="Remind me about this (date & time)" onclick="App._crmRemindOpen(\''+cid+'\',\''+m.id+'\')" style="border:none;background:transparent;cursor:pointer;color:#54433C;padding:2px 3px">'+ic('bell','w-3.5 h-3.5')+'</button>';
  if(part)b+='<button title="Create ticket from this message" onclick="App._crmTicketFromMsg(\''+cid+'\',\''+m.id+'\')" style="border:none;background:transparent;cursor:pointer;color:#8B6B41;padding:2px 3px">'+ic('ticket','w-3.5 h-3.5')+'</button>';
  if(own&&part)b+='<button title="Edit" onclick="App._crmEditMsg(\''+cid+'\',\''+m.id+'\')" style="border:none;background:transparent;cursor:pointer;color:#6B7280;padding:2px 3px">'+ic('edit','w-3.5 h-3.5')+'</button>';
  if(own&&part)b+='<button title="Forward" onclick="App._crmForward(\''+m.id+'\')" style="border:none;background:transparent;cursor:pointer;color:#6B7280;padding:2px 3px">'+ic('send','w-3.5 h-3.5')+'</button>';
  if((own&&part)||can('crm','delete'))b+='<button title="Delete" onclick="App._crmDelMsg(\''+cid+'\',\''+m.id+'\')" style="border:none;background:transparent;cursor:pointer;color:#DC2626;padding:2px 3px">'+ic('trash','w-3.5 h-3.5')+'</button>';
  return'<div class="crm-macts" style="display:none;position:absolute;top:-13px;'+(!m.fromCustomer?'right:2px':'left:2px')+';background:#fff;border:1px solid #E5E7EB;border-radius:10px;box-shadow:0 4px 14px rgba(16,24,40,.16);padding:1px 3px;gap:0;align-items:center;z-index:25">'+b+'</div>';
}
function _crmMsg(m,cid,thread,prev){
  var editing=CRM.editMsgId===m.id;var mine=!m.fromCustomer;
  var who=m.fromCustomer?(m.name||'Customer'):(uById(m.senderId)?fullName(uById(m.senderId)):'You');
  var av=m.fromCustomer?_crmCustAv(m.name,24):(uById(m.senderId)?avatar(uById(m.senderId),'w-[24px] h-[24px]','text-[8px]'):_crmCustAv('You',24));
  var grouped=false;
  if(prev&&!editing){var same=(!!m.fromCustomer===!!prev.fromCustomer)&&(m.fromCustomer?(m.name===prev.name):(m.senderId===prev.senderId));var dtms=0;try{dtms=new Date(m.at)-new Date(prev.at);}catch(e){}grouped=same&&dtms>=0&&dtms<5*60000;}
  if(grouped)av='<div style="width:24px;flex-shrink:0"></div>';
  var bub=mine?'background:#8B6B41;color:#fff;border-radius:13px 13px 4px 13px':'background:#fff;color:#13171B;border:1px solid #ECEDF0;border-radius:13px 13px 13px 4px';
  var inner=editing
    ?'<textarea id="crm-edit-'+m.id+'" rows="2" style="width:280px;max-width:60vw;border:1px solid #E5E7EB;border-radius:10px;padding:8px;font-size:13.5px;font-family:inherit;outline:none">'+esc(m.text)+'</textarea><div style="display:flex;gap:6px;margin-top:5px;justify-content:flex-end"><button onclick="App._crmCancelEdit()" style="font-size:11px;padding:4px 9px;border:1px solid #E5E7EB;background:#fff;border-radius:7px;cursor:pointer">Cancel</button><button onclick="App._crmSaveEdit(\''+cid+'\',\''+m.id+'\')" style="font-size:11px;padding:4px 9px;border:none;background:#8B6B41;color:#fff;border-radius:7px;cursor:pointer">Save</button></div>'
    :'<div title="'+_crmDT(m.at)+'" style="'+bub+';padding:6px 10px;font-size:13px;line-height:1.4;word-break:break-word;box-shadow:0 1px 2px rgba(16,24,40,.04)">'+_crmAt(m.text)+(m.edited?' <span style="opacity:.55;font-size:10px">(edited)</span>':'')+_crmImgs(m.images)+'</div>';
  var replies=(!thread&&!m.parentId)?((_crmConvo(cid)||{messages:[]}).messages||[]).filter(x=>x.parentId===m.id):[];
  var opener=replies.length?'<button onclick="App._crmOpenThread(\''+m.id+'\')" style="margin-top:3px;border:none;background:transparent;color:#8B6B41;font-size:11.5px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:4px">'+ic('msg','w-3 h-3')+replies.length+' repl'+(replies.length===1?'y':'ies')+'</button>':'';
  var col='<div class="crm-msg" style="position:relative;max-width:78%;display:flex;flex-direction:column;'+(mine?'align-items:flex-end':'align-items:flex-start')+'">'
    +(grouped?'':'<div style="font-size:10.5px;font-weight:700;color:#9CA3AF;margin:0 4px 2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%">'+esc(who)+'<span style="font-weight:600;color:#C9C2B6"> \u00B7 '+_crmTime(m.at)+'</span></div>')
    +inner+_crmReactChips(m,cid)+opener
    +(editing?'':_crmMsgActions(m,cid,thread))+'</div>';
  return'<div style="display:flex;gap:7px;'+(mine?'flex-direction:row-reverse':'')+';align-items:flex-end;margin-top:'+(prev?(grouped?2:9):0)+'px">'+av+col+'</div>';
}
function _crmMentionItems(q){
  var b=_crmBoard(CRM.sel.boardId);var mem=_crmBoardPeople(b);q=(q||'').toLowerCase();
  var list=mem.filter(u=>!q||fullName(u).toLowerCase().indexOf(q)>=0);
  var memIds={};mem.forEach(function(u){memIds[u.id]=1;});
  // Groups are taggable too — only groups with at least one member of this board
  var glist=_crmGroups().filter(function(g){var n=String(g.name||'').toLowerCase();var t=_crmGroupToken(g).toLowerCase();return (!q||n.indexOf(q)>=0||t.indexOf(q)>=0)&&(g.members||[]).some(function(id){return memIds[id];});});
  var rows='<button onmousedown="event.preventDefault();App._crmPickMention(\'ALL\')" style="width:100%;text-align:left;display:flex;align-items:center;gap:8px;padding:7px 8px;border:none;background:transparent;border-radius:8px;cursor:pointer" onmouseover="this.style.background=\'#F3F4F6\'" onmouseout="this.style.background=\'transparent\'"><span style="width:24px;height:24px;border-radius:50%;background:#13171B;color:#fff;display:grid;place-items:center;font-size:11px;font-weight:800">@</span><span style="font-size:12.5px;font-weight:700;color:#13171B">Everyone</span><span style="font-size:10px;color:#9CA3AF;margin-left:auto">notify all</span></button>';
  rows+=glist.map(function(g){return'<button onmousedown="event.preventDefault();App._crmPickMention(\'grp:'+g.id+'\')" style="width:100%;text-align:left;display:flex;align-items:center;gap:8px;padding:6px 8px;border:none;background:transparent;border-radius:8px;cursor:pointer" onmouseover="this.style.background=\'#F3F4F6\'" onmouseout="this.style.background=\'transparent\'"><span style="width:24px;height:24px;border-radius:50%;background:#F5EEE1;color:#54433C;display:grid;place-items:center;flex-shrink:0">'+ic('users','w-3 h-3')+'</span><span style="font-size:12.5px;font-weight:700;color:#13171B">'+esc(g.name)+'</span><span style="font-size:10px;color:#9CA3AF;margin-left:auto">group · '+((g.members||[]).length)+'</span></button>';}).join('');
  rows+=list.map(u=>'<button onmousedown="event.preventDefault();App._crmPickMention(\''+u.id+'\')" style="width:100%;text-align:left;display:flex;align-items:center;gap:8px;padding:6px 8px;border:none;background:transparent;border-radius:8px;cursor:pointer" onmouseover="this.style.background=\'#F3F4F6\'" onmouseout="this.style.background=\'transparent\'">'+avatar(u,'w-6 h-6','text-[9px]')+'<span style="font-size:12.5px;font-weight:600;color:#13171B">'+esc(fullName(u))+'</span></button>').join('');
  if(!list.length&&!glist.length)rows+='<div style="padding:8px;font-size:12px;color:#9CA3AF">No matching teammate on this board</div>';
  return rows;
}
/* ── v3: Details side panel — every field of a ticket editable in one place ── */
function _crmDetailsPanel(convo,board){
  if(!convo||!convo.isTicket||CRM.detailsOpen===false)return'';
  var canEd=can('crm','edit');var canAsg=can('crm','assign');
  var dm=_crmDueMeta(convo);
  var asgU=convo.assignedTo?uById(convo.assignedTo):null;
  var candU=_crmBoardPeople(board); // only people assigned to this board
  if(convo.assignedTo&&!candU.some(function(u){return u.id===convo.assignedTo;})&&uById(convo.assignedTo))candU=candU.concat([uById(convo.assignedTo)]);
  var selSt='width:100%;box-sizing:border-box;border:1.5px solid #EBE3D6;border-radius:10px;padding:8px 10px;font-size:12.5px;font-weight:600;background:#fff;cursor:pointer;outline:none;color:#13171B';
  var fRow=function(label,inner){return'<div style="margin-bottom:14px"><div style="font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#A89E8F;margin-bottom:6px">'+label+'</div>'+inner+'</div>';};
  var cols=(board&&board.settings&&board.settings.columns)||[];
  var acts=_crmActFor(convo.id).slice(0,8);
  var myRems=(CRM.reminders||[]).filter(function(r){return r.conversationId===convo.id&&!r.fired;}).sort(function(a,b){return String(a.remindAt).localeCompare(String(b.remindAt));});
  var remBlock='<div style="border-top:1px dashed #EBE3D6;padding-top:12px;margin-bottom:14px"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px"><span style="font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#A89E8F">My reminders</span><button onclick="App._crmRemindOpen(\''+convo.id+'\')" style="border:none;background:#F5EEE1;color:#54433C;border-radius:7px;padding:3px 9px;font-size:11px;font-weight:800;cursor:pointer">+ Add</button></div>'
    +(myRems.length?myRems.map(function(r){return'<div style="display:flex;align-items:flex-start;gap:7px;padding:6px 8px;background:#FDF7F1;border:1px solid #F4E8DC;border-radius:9px;margin-bottom:5px"><span style="font-size:12px">\u23F0</span><div style="flex:1;min-width:0"><div style="font-size:11.5px;font-weight:700;color:#13171B">'+_crmDT(r.remindAt)+'</div>'+(r.note?'<div style="font-size:11px;color:#8A8072;margin-top:1px">'+esc(r.note)+'</div>':'')+'</div><button onclick="App._crmRemindDel(\''+r.id+'\')" title="Cancel reminder" style="border:none;background:transparent;color:#C7BBA8;cursor:pointer;padding:0">'+ic('x','w-3 h-3')+'</button></div>';}).join(''):'<div style="font-size:11.5px;color:#B8AE9D;line-height:1.5">None yet \u2014 get an email + in-app ping at a date & time you pick.</div>')
  +'</div>';
  return '<div class="crm-hide-mob" style="width:284px;flex-shrink:0;border-left:1px solid #EFE9DE;background:#FCFAF6;display:flex;flex-direction:column;min-height:0">'
    +'<div style="padding:13px 16px;border-bottom:1px solid #EFE9DE;display:flex;align-items:center;justify-content:space-between;flex-shrink:0"><span class="fd" style="font-weight:800;font-size:13.5px;color:#13171B">Ticket details</span><button onclick="App._crmTogDetails()" style="border:none;background:transparent;color:#B8AE9D;cursor:pointer;display:grid;place-items:center">'+ic('x','w-3.5 h-3.5')+'</button></div>'
    +'<div class="crm-scroll" style="flex:1;overflow-y:auto;padding:16px">'
    +fRow('Assignee',canAsg?'<select onchange="App._crmAssign(\''+convo.id+'\',this.value)" style="'+selSt+'"><option value="">Unassigned</option>'+candU.map(function(u){return'<option value="'+u.id+'" '+(convo.assignedTo===u.id?'selected':'')+'>'+esc(fullName(u))+'</option>';}).join('')+'</select>':(asgU?esc(fullName(asgU)):'\u2014'))
    +fRow('Status',canEd?_crmStatusSel(board,convo,selSt):_crmStatusChip(board,convo.status))
    +fRow('Customer','<span style="font-size:12.5px;font-weight:700">'+esc(convo.customer||'\u2014')+'</span>')
    +(cols.length?'<div style="border-top:1px dashed #EBE3D6;padding-top:12px">'+cols.map(function(col){return fRow(esc(col.name),_crmCell(convo,col));}).join('')+'</div>':'')
    +fRow('Created','<span style="font-size:12px;color:#8A8072">'+_crmDT(convo.createdAt)+'</span>')
    +remBlock
    +(acts.length?'<div style="border-top:1px dashed #EBE3D6;padding-top:12px"><div style="font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#A89E8F;margin-bottom:6px">Activity</div>'+acts.map(function(a){var au=uById(a.actor);return '<div style="font-size:11.5px;color:#6A6153;padding:3px 0;line-height:1.45"><b style="color:#13171B">'+esc(au?_crmFirst(au):'Someone')+'</b> '+esc(a.action)+(a.detail?' \u2014 '+esc(a.detail):'')+' <span style="color:#B8AE9D">\u00B7 '+_crmRel(a.at)+'</span></div>';}).join('')+'</div>':'')
    +'</div></div>';
}
function _crmChatPane(convo,board){
  if(!convo)return _crmEmpty('msg','No conversation selected',(_crmFilteredConvos().length?'Pick a conversation from the list.':'Start a new conversation using the form on the left.'),'');
  var meta;
  if(convo.isTicket){
    meta='<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap"><span style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#54433C;background:#F5EEE1;border-radius:6px;padding:3px 8px">'+esc(convo.ticketType||'Ticket')+'</span></div>';
  }else{
    meta='';
  }
  var asgU=convo.assignedTo?uById(convo.assignedTo):null;var bmem=_crmBoardPeople(board);
  var assignCtl=can('crm','assign')?'<div style="position:relative"><button onclick="App._crmTogAssign()" title="Assign" style="display:inline-flex;align-items:center;gap:6px;background:#fff;border:1px solid #E5E7EB;border-radius:10px;padding:5px 9px;cursor:pointer;font-size:12px;font-weight:600;color:#374151">'+(asgU?avatar(asgU,'w-5 h-5','text-[8px]')+'<span>'+esc(_crmFirst(asgU))+'</span>':ic('user','w-4 h-4')+'<span>Assign</span>')+'</button><div id="crm-assign" style="display:none;position:absolute;right:0;top:38px;z-index:60;background:#fff;border:1px solid #E5E7EB;border-radius:12px;box-shadow:0 12px 32px rgba(16,24,40,.18);padding:6px;width:220px;max-height:250px;overflow:auto"><div style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#9CA3AF;padding:4px 8px">Assign to</div><button onclick="App._crmAssign(\''+convo.id+'\',\'\')" style="width:100%;text-align:left;padding:6px 8px;border:none;background:transparent;border-radius:8px;cursor:pointer;font-size:12.5px;color:#6B7280">Unassigned</button>'+bmem.map(u=>'<button onclick="App._crmAssign(\''+convo.id+'\',\''+u.id+'\')" style="width:100%;text-align:left;display:flex;align-items:center;gap:8px;padding:6px 8px;border:none;background:transparent;border-radius:8px;cursor:pointer" onmouseover="this.style.background=\'#F3F4F6\'" onmouseout="this.style.background=\'transparent\'">'+avatar(u,'w-6 h-6','text-[9px]')+'<span style="font-size:12.5px;font-weight:600;color:#13171B">'+esc(fullName(u))+'</span></button>').join('')+'</div></div>':(asgU?'<span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;color:#6B7280">'+avatar(asgU,'w-5 h-5','text-[8px]')+esc(_crmFirst(asgU))+'</span>':'');
  var top=(convo.messages||[]).filter(x=>!x.parentId);
  var thread=top.length?top.map(function(m,i){return _crmMsg(m,convo.id,false,top[i-1]);}).join(''):'<div style="flex:1;display:grid;place-items:center;color:#B8B5AC;font-size:12.5px">No messages yet — say hello \u{1F44B}</div>';
  var canSend=can('crm','create');
  // thread panel
  var tpanel='';
  if(CRM.sel.threadId){var pm=(convo.messages||[]).find(x=>x.id===CRM.sel.threadId);var reps=(convo.messages||[]).filter(x=>x.parentId===CRM.sel.threadId);
    tpanel='<div style="width:320px;flex-shrink:0;border-left:1px solid #ECEDF0;display:flex;flex-direction:column;min-height:0;background:#fff"><div style="padding:9px 12px;border-bottom:1px solid #ECEDF0;display:flex;align-items:center;justify-content:space-between"><span style="font-weight:800;font-size:13.5px">Thread</span><button onclick="App._crmCloseThread()" style="border:none;background:transparent;cursor:pointer;color:#9CA3AF">'+ic('x','w-4 h-4')+'</button></div><div id="crm-tthread" class="crm-scroll" style="flex:1;overflow-y:auto;padding:10px;display:flex;flex-direction:column;min-height:0">'+(pm?_crmMsg(pm,convo.id,true):'<div style="color:#9CA3AF;font-size:12px">Original message was deleted.</div>')+'<div style="height:1px;background:#F0F1F3;margin:2px 0"></div><div style="font-size:11px;color:#9CA3AF;font-weight:700">'+reps.length+' repl'+(reps.length===1?'y':'ies')+'</div>'+reps.map(function(r,i){return _crmMsg(r,convo.id,true,reps[i-1]);}).join('')+'</div>'+(canSend?'<div style="border-top:1px solid #ECEDF0;padding:8px;display:flex;gap:7px;align-items:flex-end"><textarea id="crm-tinput" rows="1" placeholder="Reply…" onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();App._crmSendReply();}" style="flex:1;resize:none;border:1px solid #E5E7EB;border-radius:10px;padding:9px 11px;font-size:13px;font-family:inherit;outline:none;max-height:100px"></textarea><button onclick="App._crmSendReply()" style="width:34px;height:34px;border-radius:9px;border:none;background:#8B6B41;color:#fff;cursor:pointer;display:grid;place-items:center;flex-shrink:0">'+ic('send','w-4 h-4')+'</button></div>':'')+'</div>';
  }
  // forward overlay
  var _fl=CRM.convos.filter(c=>_crmVisibleBoardIds()[c.boardId]&&c.id!==CRM.sel.convoId);var fwd='';
  if(CRM.fwdMsgId){fwd='<div style="position:absolute;inset:0;z-index:80;background:rgba(0,0,0,.15);display:grid;place-items:center" onclick="App._crmForwardClose()"><div onclick="event.stopPropagation()" style="background:#fff;border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.25);width:340px;max-height:74%;display:flex;flex-direction:column;overflow:hidden"><div style="padding:12px 14px;border-bottom:1px solid #ECEDF0;font-weight:800;display:flex;align-items:center;justify-content:space-between">Forward to…<button onclick="App._crmForwardClose()" style="border:none;background:transparent;cursor:pointer;color:#9CA3AF">'+ic('x','w-4 h-4')+'</button></div><div class="crm-scroll" style="overflow-y:auto;padding:6px">'+(_fl.length?_fl.slice(0,80).map(c=>'<button onclick="App._crmDoForward(\''+c.id+'\')" style="width:100%;text-align:left;display:flex;align-items:center;gap:8px;padding:8px;border:none;background:transparent;border-radius:8px;cursor:pointer" onmouseover="this.style.background=\'#F3F4F6\'" onmouseout="this.style.background=\'transparent\'">'+_crmCustAv(c.customer,24)+'<div style="min-width:0"><div style="font-size:12.5px;font-weight:700;color:#13171B;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(c.customer||c.title||'—')+'</div><div style="font-size:11px;color:#9CA3AF;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc((_crmBoard(c.boardId)?_crmBoard(c.boardId).name:'')+' · '+(c.title||''))+'</div></div></button>').join(''):'<div style="padding:18px;text-align:center;color:#9CA3AF;font-size:12.5px">No other conversations to forward to.</div>')+'</div></div></div>';}
  return'<div class="crm-chatpane" style="flex:1;display:flex;flex-direction:column;min-width:0;min-height:0;position:relative">'+fwd
    +'<div style="padding:9px 14px;border-bottom:1px solid #ECEDF0;display:flex;align-items:center;gap:10px;flex-wrap:wrap;flex-shrink:0">'+'<button class="crm-only-mob" onclick="App._crmMobBack()" style="width:34px;height:34px;border:1px solid #E5E7EB;background:#fff;border-radius:9px;cursor:pointer;align-items:center;justify-content:center;color:#374151;flex-shrink:0;margin-right:2px">'+ic('back','w-5 h-5')+'</button>'+_crmCustAv(convo.customer,34)
    +'<div style="flex:1;min-width:120px"><div class="fd" style="font-size:15px;font-weight:800;color:#13171B;letter-spacing:-.2px">'+esc(convo.title||'—')+'</div><div style="font-size:12px;color:#9CA3AF;margin-top:1px">'+esc(convo.customer||'')+(convo.channel?' · '+esc(convo.channel):'')+(convo.createdAt?' · started '+_crmRel(convo.createdAt)+' ago':'')+'</div></div>'+meta+_crmHdrBtns(convo,board)+'</div>'
    +'<div style="flex:1;display:flex;min-height:0">'
      +'<div style="flex:1;display:flex;flex-direction:column;min-width:0;position:relative" ondragover="App._crmDragOver(event)" ondragleave="App._crmDragLeave(event)" ondrop="App._crmDrop(event)">'
        +'<div id="crm-drop" style="display:none;position:absolute;inset:10px;z-index:40;background:rgba(139,107,65,.08);border:2px dashed #8B6B41;border-radius:12px;place-items:center;pointer-events:none"><div style="text-align:center;color:#54433C;font-weight:700">'+ic('upload','w-7 h-7')+'<div style="margin-top:6px">Drop images to attach</div></div></div>'
        +'<div id="crm-thread" class="crm-scroll" style="flex:1;overflow-y:auto;padding:10px 14px;background:#FAFBFC;display:flex;flex-direction:column;min-height:0">'+thread+'</div>'
        +'<div style="border-top:1px solid #ECEDF0;padding:8px 12px;position:relative;flex-shrink:0"><div id="crm-preview" style="display:none;gap:6px;flex-wrap:wrap;margin-bottom:8px"></div><div id="crm-mention" style="display:none;position:absolute;bottom:58px;left:14px;z-index:60;background:#fff;border:1px solid #E5E7EB;border-radius:12px;box-shadow:0 12px 32px rgba(16,24,40,.18);padding:6px;width:240px;max-height:230px;overflow:auto"></div>'
        +(canSend?'<div style="display:flex;align-items:flex-end;gap:8px"><label title="Attach image" style="width:36px;height:36px;border-radius:10px;border:1px solid #E5E7EB;background:#fff;cursor:pointer;color:#6B7280;display:grid;place-items:center;flex-shrink:0">'+ic('cam','w-4 h-4')+'<input type="file" accept="image/*" multiple onchange="App._crmPickImg(this)" style="display:none"/></label><textarea id="crm-input" rows="1" placeholder="Message… @ to tag · Enter to send" oninput="App._crmOnInput(this)" onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();App._crmSend();}" style="flex:1;resize:none;border:1px solid #E5E7EB;border-radius:11px;padding:9px 12px;font-size:13px;font-family:inherit;outline:none;max-height:120px"></textarea><button onclick="App._crmSend()" style="width:38px;height:38px;border-radius:11px;border:none;background:#8B6B41;color:#fff;cursor:pointer;display:grid;place-items:center;flex-shrink:0">'+ic('send','w-4 h-4')+'</button></div>':'<div style="text-align:center;color:#B8B5AC;font-size:12px;padding:8px">Read-only access.</div>')
        +'</div></div>'+tpanel+_crmDetailsPanel(convo,board)+'</div></div>';
}
function _crmMine(c){return c.assignedTo===S.uid||c.createdBy===S.uid;}
function _crmFilteredConvos(){var lf=CRM.listFilter||'all';return CRM.convos.filter(function(c){return c.boardId===CRM.sel.boardId;}).filter(function(c){return lf==='unread'?_crmUnread(c):lf==='mine'?_crmMine(c):true;}).sort(function(a,b){return String(b.lastAt||'').localeCompare(String(a.lastAt||''));});}
App._crmListFilter=(v)=>{CRM.listFilter=v;rr();};
function _crmSearchResults(qArg){var q=String(qArg!=null?qArg:(CRM.search||'')).trim().toLowerCase();if(!q)return[];var vis=_crmVisibleBoardIds();return CRM.convos.filter(c=>vis[c.boardId]).filter(c=>((c.title||'')+' '+(c.customer||'')+' '+(c.ticketType||'')+' '+(c.messages||[]).map(m=>m.text||'').join(' ')).toLowerCase().indexOf(q)>=0).sort((a,b)=>String(b.lastAt||'').localeCompare(String(a.lastAt||''))).slice(0,60);}
function _crmConvoListInner(){
  if((CRM.search||'').trim()){var rs=_crmSearchResults();if(!rs.length)return'<div style="padding:26px 14px;text-align:center;color:#9CA3AF;font-size:12.5px">No matches for “'+esc(CRM.search)+'”.</div>';return'<div style="padding:8px 12px;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#9CA3AF;background:#FAFBFC;border-bottom:1px solid #F0F1F3">'+rs.length+' result'+(rs.length>1?'s':'')+' across all boards</div>'+rs.map(c=>_crmConvoRow(c,CRM.sel.convoId,true)).join('');}
  var cs=_crmFilteredConvos();if(!cs.length){var _lf2=CRM.listFilter||'all';return'<div style="padding:28px 14px;text-align:center;color:#9CA3AF;font-size:12.5px">'+(_lf2==='unread'?'Nothing unread — all caught up \u{1F389}':_lf2==='mine'?'Nothing you created or that\u2019s assigned to you here.':'No '+esc((CRM.sel.category||'chats').toLowerCase())+' here yet.')+'</div>';}return cs.map(c=>_crmConvoRow(c,CRM.sel.convoId,false)).join('');
}
function crmPage(){
  _crmInit();
  if(!CRM._loaded){if(!CRM._loading)_crmLoad();return _crmStyle+'<div class="crm-fs" style="position:fixed;top:0;left:0;right:0;bottom:0;background:#fff;display:grid;place-items:center;z-index:5;color:#9CA3AF"><div style="text-align:center">'+ic('msg','w-8 h-8')+'<div style="margin-top:10px;font-size:13px">Loading CRM…</div></div></div>';}
  if(CRM._err)return _crmStyle+'<div class="crm-fs" style="position:fixed;top:0;left:0;right:0;bottom:0;background:#fff;display:flex;z-index:5">'+_crmEmpty('alert','Couldn’t load CRM',CRM._err,'<button onclick="App._crmRetry()" style="margin-top:14px;padding:9px 18px;border:none;border-radius:10px;background:#13171B;color:#fff;font-weight:700;cursor:pointer">Retry</button>')+'</div>';
  var collapsed=CRM.sidebarCollapsed;var canCreate=can('crm','create');
  // ===== SIDEBAR (v3.12): Hubs → their FILTERED VIEWS. Boards open as tabs on the hub itself. =====
  var visHubs=CRM.hubs.filter(_crmHubVisible);
  var navHTML=visHubs.length?visHubs.map(function(h){
    var hcol=CRM.collapsedHubs[h.id];
    var views=_crmVisibleViews(h.id);
    var hOn=CRM.sel.hubId===h.id&&!CRM.sel.viewId;
    var bCount=CRM.boards.filter(function(b){return b.hubId===h.id&&_crmBoardVisible(b);}).length;
    return'<div class="crm-hub" style="margin-bottom:2px">'
      +'<div onclick="App._crmSelHub(\''+h.id+'\')" title="Open '+esc(h.name)+' — everything in it" style="display:flex;align-items:center;gap:5px;padding:6px 7px;color:'+(hOn?'#fff':'#374151')+';background:'+(hOn?'#13171B':'transparent')+';cursor:pointer;border-radius:7px">'
      +(collapsed?'':'<span onclick="event.stopPropagation();App._crmTogHub(\''+h.id+'\')" title="'+(hcol?'Show':'Hide')+' its filtered views" style="color:'+(hOn?'rgba(255,255,255,.6)':'#B8B5AC')+';display:grid;place-items:center;cursor:pointer">'+ic(hcol?'chevR':'chevD','w-3 h-3')+'</span>')
      +'<span style="color:'+(hOn?'rgba(255,255,255,.7)':'#9CA3AF')+'">'+ic(h.icon||'folder','w-3.5 h-3.5')+'</span>'
      +(collapsed?'':'<span style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(h.name)+'</span>'
        +'<span style="font-size:9.5px;color:'+(hOn?'rgba(255,255,255,.55)':'#B8B5AC')+'" title="'+bCount+' board'+(bCount===1?'':'s')+'">'+bCount+'</span>'
        +((canCreate||can('crm','views'))?'<button title="New board / filtered view" onclick="event.stopPropagation();App._crmHubAdd(\''+h.id+'\')" style="border:none;background:transparent;color:'+(hOn?'rgba(255,255,255,.8)':'#9CA3AF')+';cursor:pointer;padding:0">'+ic('plus','w-3 h-3')+'</button>':'')
        +(can('crm','rename')?'<button title="Rename" onclick="event.stopPropagation();App._crmRenameHub(\''+h.id+'\')" class="crm-hdel" style="border:none;background:transparent;color:'+(hOn?'#fff':'#6B7280')+';cursor:pointer;padding:0;display:none;place-items:center">'+ic('edit','w-3 h-3')+'</button>':'')
        +(can('crm','delete')?'<button title="Delete" onclick="event.stopPropagation();App._crmDelHub(\''+h.id+'\')" class="crm-hdel" style="border:none;background:transparent;color:#DC2626;cursor:pointer;padding:0;display:none;place-items:center">'+ic('trash','w-3 h-3')+'</button>':''))
      +'</div>'
      +(collapsed||hcol?'':views.map(function(v){var on=CRM.sel.viewId===v.id;var _tb=CRM.boards.filter(function(b){return b.hubId===v.hubId&&_crmBS(b).type!=='chat';});var n=_tb.reduce(function(s2,b){return s2+_crmApplyFilters(CRM.convos.filter(function(c){return c.boardId===b.id;}),_crmViewFilters(v,b.id)).length;},0);
        return'<div class="crm-chrow" style="position:relative;margin-left:6px"><button onclick="App._crmSelView(\''+v.id+'\')" title="Filtered view — all of '+esc(h.name)+'\u2019s boards, narrowed by its saved filters" style="width:100%;text-align:left;display:flex;align-items:center;gap:7px;padding:6px '+(_crmViewCanEdit(v)?26:6)+'px 6px 12px;border:none;border-radius:7px;cursor:pointer;background:'+(on?'#13171B':'transparent')+';color:'+(on?'#fff':'#374151')+';font-size:12px;font-weight:'+(on?'700':'600')+';margin-bottom:1px"><span style="color:'+(on?'rgba(255,255,255,.5)':'#8B6B41')+';display:grid;place-items:center">'+ic('filter','w-3.5 h-3.5')+'</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(v.name)+'</span><span style="font-size:9.5px;color:'+(on?'rgba(255,255,255,.55)':'#B8B5AC')+'">'+n+'</span></button>'
        +(_crmViewCanEdit(v)?'<button title="Edit view" onclick="App._crmEditView(\''+v.id+'\')" class="crm-chx" style="position:absolute;top:6px;right:6px;width:18px;height:18px;border:none;background:transparent;color:'+(on?'#fff':'#6B7280')+';cursor:pointer;border-radius:5px;display:none;place-items:center">'+ic('edit','w-3 h-3')+'</button>':'')
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
  var tabBoards=inView?(hub?CRM.boards.filter(function(b){return b.hubId===hub.id;}):[]):hbBoards;
  var board=_crmBoard(CRM.sel.boardId);
  if(!board||!hub||board.hubId!==hub.id||(!inView&&!_crmBoardVisible(board))){board=tabBoards[0]||null;CRM.sel.boardId=board?board.id:null;}
  var members=(board&&board.members||[]).map(function(id){return uById(id);}).filter(Boolean);
  var nonMembers=(DB.users||[]).filter(function(u){return u&&u.status!=='Disabled'&&!(board&&board.members||[]).includes(u.id);});
  var _dash='<button onclick="App.go(\'dashboard\')" title="Back to Dashboard" style="margin-left:6px;display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border:1px solid #E5E7EB;background:#fff;border-radius:10px;font-size:12.5px;font-weight:600;color:#374151;cursor:pointer;white-space:nowrap;flex-shrink:0">'+ic('grid','w-4 h-4')+'<span class="crm-hide-mob">Dashboard</span></button>';
  var _search='<div style="position:relative;display:flex;align-items:center"><span style="position:absolute;left:10px;color:#9CA3AF;pointer-events:none">'+ic('search','w-4 h-4')+'</span><input id="crm-search" autocomplete="off" oninput="App._crmSearch(this.value)" onfocus="App._crmSearch(this.value)" onblur="setTimeout(function(){var d=document.getElementById(\'crm-search-dd\');if(d)d.style.display=\'none\';},180)" placeholder="Search everywhere…" style="width:230px;max-width:44vw;padding:8px 10px 8px 32px;border:1px solid #E5E7EB;border-radius:10px;font-size:12.5px;outline:none"/><div id="crm-search-dd" class="crm-scroll" style="display:none;position:absolute;top:40px;right:0;z-index:80;width:330px;max-height:380px;overflow-y:auto;background:#fff;border:1px solid #E5E7EB;border-radius:14px;box-shadow:0 16px 44px rgba(16,24,40,.18);padding:6px"></div></div>';
  var mainInner;
  if(!CRM.hubs.length){mainInner=_crmEmpty('msg','Welcome to your CRM','Create your first Hub — it holds your boards (chats & ticket tables) and filtered views.',canCreate?'<button onclick="App._crmNewHub()" style="margin-top:16px;padding:10px 20px;border:none;border-radius:11px;background:#8B6B41;color:#fff;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:7px">'+ic('plus','w-4 h-4')+'Create your first hub</button>':'<div style="margin-top:12px;font-size:12px;color:#B8B5AC">Ask an admin for CRM access.</div>');}
  else if(!hub){mainInner=_crmEmpty('folder','Nothing to show','You haven’t been added to any board or filtered view yet — ask an admin for access.','');}
  else{
    var row1='<div class="crm-boardbar" style="padding:10px 16px;border-bottom:1px solid #ECEDF0;display:flex;align-items:center;gap:10px;flex-wrap:wrap;flex-shrink:0"><button class="crm-only-mob" onclick="App._crmMobNav()" style="width:34px;height:34px;border:1px solid #E5E7EB;background:#fff;border-radius:9px;cursor:pointer;align-items:center;justify-content:center;color:#374151;flex-shrink:0">'+ic('menu','w-5 h-5')+'</button><div style="font-size:16px;font-weight:800;color:#13171B">'+esc(hub.name)+(view?' <span style="font-weight:800;color:#8B6B41;font-size:13px">· '+esc(view.name)+'</span>':'')+'</div><div style="flex:1"></div>'+_search+_dash+'</div>';
    var tabs=tabBoards.map(function(b){var on=b.id===CRM.sel.boardId;var _un=_crmUnreadCount(b.id);var _isC=_crmBS(b).type==='chat';var _cnt=inView&&!_isC?_crmApplyFilters(CRM.convos.filter(function(x){return x.boardId===b.id;}),_crmViewFilters(view,b.id)).length:CRM.convos.filter(function(x){return x.boardId===b.id;}).length;return'<button onclick="'+(inView?'App._crmSelVBoard':'App._crmSelBoard')+'(\''+b.id+'\')" class="crm-btab" style="display:inline-flex;align-items:center;gap:6px;padding:9px 14px;border:none;background:transparent;border-bottom:2px solid '+(on?'#8B6B41':'transparent')+';color:'+(on?'#13171B':'#9CA3AF')+';font-size:13px;font-weight:'+(on?'800':'600')+';cursor:pointer;white-space:nowrap">'+ic(_isC?'msg':'ticket','w-3.5 h-3.5')+esc(b.name)+' <span style="font-size:11px;color:'+(on?'#8B6B41':'#C7CAD1')+'">'+_cnt+'</span>'+(_un?'<span style="min-width:17px;height:17px;padding:0 5px;border-radius:9px;background:#8B6B41;color:#fff;font-size:9.5px;font-weight:800;display:inline-grid;place-items:center">'+_un+'</span>':'')+'</button>';}).join('');
    var boardCtl=board?(((can('crm','manage')||can('crm','edit'))?'<button title="Board members — who can access this board" onclick="App._crmTogMembers()" style="display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 10px;border-radius:8px;border:1px solid #E5E7EB;background:#fff;color:#6B7280;cursor:pointer;font-size:12px;font-weight:700">'+ic('users','w-3.5 h-3.5')+members.length+'</button>':'')+(can('crm','rename')?'<button title="Rename board" onclick="App._crmRenameBoard(\''+board.id+'\')" style="width:30px;height:30px;border-radius:8px;border:1px solid #E5E7EB;background:#fff;color:#6B7280;cursor:pointer;display:grid;place-items:center">'+ic('edit','w-4 h-4')+'</button>':'')+(can('crm','delete')?'<button title="Delete board" onclick="App._crmDelBoard(\''+board.id+'\')" style="width:30px;height:30px;border-radius:8px;border:1px solid #FCA5A5;background:#fff;color:#DC2626;cursor:pointer;display:grid;place-items:center">'+ic('trash','w-4 h-4')+'</button>':'')):'';
    var row2='<div class="crm-tabsrow" style="display:flex;align-items:center;gap:2px;padding:0 10px;border-bottom:1px solid #ECEDF0;overflow-x:auto;flex-shrink:0">'+(inView?'<span title="Filtered view — same boards as the hub, narrowed by its saved filters" style="display:inline-flex;align-items:center;gap:5px;margin:6px 6px 6px 2px;font-size:10.5px;font-weight:800;color:#4338CA;background:#EEF2FF;border-radius:7px;padding:4px 9px;white-space:nowrap">'+ic('filter','w-3 h-3')+'VIEW</span>':'')+tabs+(canCreate?'<button onclick="App._crmNewBoard(\''+hub.id+'\')" title="New board" style="padding:8px 11px;border:none;background:transparent;color:#8B6B41;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:4px;white-space:nowrap">'+ic('plus','w-3.5 h-3.5')+'Board</button>':'')+'<div style="flex:1;min-width:8px"></div><div style="display:flex;align-items:center;gap:6px;padding:6px 2px">'+boardCtl+'</div></div>';
    if(!board){mainInner=row1+row2+_crmEmpty('msg','No boards yet in this hub','Add a board — a chat, or a ticket table with its own columns, statuses, members & automations.',canCreate?'<button onclick="App._crmNewBoard(\''+hub.id+'\')" style="margin-top:14px;padding:9px 18px;border:none;border-radius:10px;background:#8B6B41;color:#fff;font-weight:700;cursor:pointer">Create a board</button>':'');}
    else{
      var isChat=_crmBS(board).type==='chat';var searching=!!(CRM.search||'').trim();if(isChat){var convo=_crmConvo(CRM.sel.convoId);var filtered=_crmFilteredConvos();
      if(!searching){if(!convo||convo.boardId!==CRM.sel.boardId||!filtered.some(function(c){return c.id===convo.id;})){convo=filtered[0]||null;CRM.sel.threadId=null;}CRM.sel.convoId=convo?convo.id:null;}
      var _lf=CRM.listFilter||'all';var _bc=CRM.convos.filter(function(c){return c.boardId===CRM.sel.boardId;});
      var _lfCnt={all:_bc.length,unread:_bc.filter(_crmUnread).length,mine:_bc.filter(_crmMine).length};
      var lfRow='<div style="display:flex;gap:4px;padding:8px 10px;border-bottom:1px solid var(--c-border);background:#FCFCFD;flex-shrink:0">'+[['all','All'],['unread','Unread'],['mine','Mine']].map(function(x){var on=_lf===x[0];return '<button onclick="App._crmListFilter(\''+x[0]+'\')" style="flex:1;padding:5px 8px;border-radius:8px;border:none;background:'+(on?'#13171B':'transparent')+';color:'+(on?'#fff':'var(--c-text-2)')+';font-size:11px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:4px">'+x[1]+(_lfCnt[x[0]]?'<span style="font-size:9.5px;font-weight:800;border-radius:8px;min-width:15px;padding:1px 4px;background:'+(on?'rgba(255,255,255,.22)':'var(--c-border)')+';color:'+(on?'#fff':'var(--c-text-2)')+'">'+_lfCnt[x[0]]+'</span>':'')+'</button>';}).join('')+'</div>';
      var listCol='<div class="crm-listcol" style="width:22%;min-width:238px;max-width:340px;border-right:1px solid #ECEDF0;display:flex;flex-direction:column;min-height:0">'+lfRow+'<div class="crm-scroll" style="flex:1;overflow-y:auto" id="crm-list">'+_crmConvoListInner()+'</div>'+(canCreate?'<div style="border-top:1px solid #ECEDF0;padding:11px;background:#FAFBFC;flex-shrink:0"><div style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#9CA3AF;margin-bottom:7px">New conversation</div><input id="crm-nc-name" placeholder="Customer / Order ID" style="width:100%;box-sizing:border-box;padding:8px 9px;border:1px solid #E5E7EB;border-radius:8px;font-size:12.5px;margin-bottom:6px;outline:none"/><input id="crm-nc-title" placeholder="Subject" style="width:100%;box-sizing:border-box;padding:8px 9px;border:1px solid #E5E7EB;border-radius:8px;font-size:12.5px;margin-bottom:6px;outline:none"/><button onclick="App._crmNewConvo()" style="width:100%;padding:9px;border:none;border-radius:9px;background:#8B6B41;color:#fff;font-size:12.5px;font-weight:700;cursor:pointer">Start chat</button></div>':'')+'</div>';
      mainInner=row1+row2+'<div style="flex:1;display:flex;min-height:0">'+listCol+_crmChatPane((searching?_crmConvo(CRM.sel.convoId):convo),board)+'</div>';}else{var openC=_crmConvo(CRM.sel.convoId);if(openC&&openC.boardId===board.id){mainInner=row1+'<div style="flex:1;display:flex;flex-direction:column;min-height:0"><div style="padding:7px 14px;border-bottom:1px solid #ECEDF0;display:flex;align-items:center;gap:8px;flex-shrink:0"><button onclick="App._crmBackToTable()" style="display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border:1px solid #E5E7EB;background:#fff;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;color:#374151">'+ic('back','w-4 h-4')+'Back to '+esc(inView?view.name:board.name)+'</button></div>'+_crmChatPane(openC,board)+'</div>';}else{CRM.sel.convoId=null;mainInner=row1+row2+(inView?_crmViewBarV(board,view):_crmViewBar(board))+_crmTable(board,inView?{filters:_crmViewFilters(view,board.id)}:{});}}
    }
  }
  var hubsLabel=(CRM.settings&&CRM.settings.hubsLabel)||'Hubs';
  var grpFoot='';
  {var _gs=_crmGroups();var _canMg=can('crm','groups');
   // v3.11.2: the per-group list was removed from the sidebar (every row just opened the same
   // manage dialog anyway) — one compact "Groups (n)" entry opens it; @tags & automations unchanged.
   grpFoot='<div style="flex-shrink:0;border-top:1px solid #EAE4D8;padding:8px 6px'+(collapsed?';display:grid;place-items:center':'')+'">'
    +(collapsed
      ?'<button title="People groups" onclick="App._crmGroupsOpen()" style="width:34px;height:34px;border-radius:9px;border:none;background:transparent;color:#6B7280;cursor:pointer;display:grid;place-items:center">'+ic('users','w-4 h-4')+'</button>'
      :'<div style="display:flex;align-items:center;gap:5px;padding:2px 7px"><span style="color:#9CA3AF">'+ic('users','w-3.5 h-3.5')+'</span><button onclick="App._crmGroupsOpen()" title="Open people groups — @tag them in any board, notify them in automations" style="border:none;background:transparent;padding:0;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#6B7280;flex:1;text-align:left;cursor:pointer">Groups'+(_gs.length?' <span style="font-weight:800;color:#B8B5AC;text-transform:none;letter-spacing:0">('+_gs.length+')</span>':'')+'</button>'+(_canMg?'<button title="New group" onclick="App._crmGroupNewFromNav()" style="border:none;background:transparent;color:#9CA3AF;cursor:pointer;padding:0">'+ic('plus','w-3 h-3')+'</button>':'')+'</div>')
    +'</div>';}
  return _crmStyle+'<div class="crm-fs'+(CRM.sel.convoId?' crm-hasconvo':'')+'" style="position:fixed;top:0;left:0;right:0;bottom:0;background:#fff;display:flex;z-index:5">'
    +'<div class="crm-nav" style="width:'+(collapsed?'56px':'220px')+';flex-shrink:0;border-right:1px solid #ECEDF0;background:#F5F3EF;display:flex;flex-direction:column;transition:width .15s"><div style="display:flex;align-items:center;gap:6px;padding:13px 10px;border-bottom:1px solid #ECEDF0;flex-shrink:0"><button onclick="App._crmTogSidebar()" title="Collapse" style="width:30px;height:30px;border-radius:8px;border:none;background:transparent;color:#6B7280;cursor:pointer;display:grid;place-items:center">'+ic('menu','w-4 h-4')+'</button>'+(collapsed?'':'<span class="fd" '+(can('crm','rename')?'onclick="App._crmRenameHubsLabel()" title="Click to rename this label" style="cursor:pointer;font-weight:800;font-size:14px;color:#13171B;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"':'style="font-weight:800;font-size:14px;color:#13171B;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"')+'>'+esc(hubsLabel)+'</span>'+(canCreate?'<button title="New hub" onclick="App._crmNewHub()" style="width:26px;height:26px;border-radius:7px;border:none;background:#13171B;color:#fff;cursor:pointer;display:grid;place-items:center;flex-shrink:0">'+ic('plus','w-3.5 h-3.5')+'</button>':''))+'</div><div class="crm-scroll" style="flex:1;overflow-y:auto;padding:8px 6px">'+(navHTML||(collapsed?'':'<div style="padding:16px 8px;font-size:12px;color:#9CA3AF;text-align:center">No hubs yet</div>'))+'</div>'+grpFoot+'</div>'
    +'<div style="flex:1;display:flex;flex-direction:column;min-width:0">'+mainInner+'</div>'+_crmModals()+'</div>';
}
// ---- interactions ----
App._crmRetry=()=>{CRM._loaded=false;CRM._err=null;_crmLoad();};
App._crmTogSidebar=()=>{CRM.sidebarCollapsed=!CRM.sidebarCollapsed;rr();};
App._crmTogHub=(id)=>{CRM.collapsedHubs[id]=!CRM.collapsedHubs[id];rr();};
App._crmSelBoard=(id)=>{CRM._kbAdd=null;var b=_crmBoard(id);CRM.sel.boardId=id;CRM.sel.hubId=b?b.hubId:CRM.sel.hubId;CRM.sel.viewId=null;CRM.sel.convoId=null;CRM.sel.threadId=null;CRM.sel.category='Chats';CRM.search='';CRM.compose.images=[];rr();};
/* Same as _crmSelBoard but KEEPS the active filtered view (tab clicks inside a view) */
App._crmSelVBoard=(id)=>{CRM._kbAdd=null;CRM.sel.boardId=id;CRM.sel.convoId=null;CRM.sel.threadId=null;CRM.sel.category='Chats';CRM.search='';CRM.compose.images=[];rr();};
App._crmSelCat=(c)=>{CRM.sel.category=c;CRM.sel.convoId=null;CRM.sel.threadId=null;CRM.search='';rr();};
App._crmSelConvo=(id)=>{CRM.sel.convoId=id;CRM.sel.threadId=null;CRM.compose.images=[];_crmMarkRead(id);rr();var t=document.getElementById('crm-thread');if(t)t.scrollTop=t.scrollHeight;};
App._crmOpenResult=(id)=>{var c=_crmConvo(id);if(!c)return;CRM.sel.boardId=c.boardId;var b=_crmBoard(c.boardId);CRM.sel.hubId=b?b.hubId:null;CRM.sel.viewId=null;CRM.sel.category=c.isTicket?(c.ticketType||'Chats'):'Chats';CRM.sel.convoId=id;CRM.sel.threadId=null;CRM.search='';CRM.compose.images=[];_crmMarkRead(id);rr();var t=document.getElementById('crm-thread');if(t)t.scrollTop=t.scrollHeight;};
App._crmSearch=(v)=>{
  var dd=document.getElementById('crm-search-dd');if(!dd)return;
  var q=String(v||'').trim();
  if(!q){dd.style.display='none';dd.innerHTML='';return;}
  var rs=_crmSearchResults(q).slice(0,14);
  dd.innerHTML=rs.length?rs.map(function(c){var b=_crmBoard(c.boardId);var un=_crmUnread(c);
    return'<div onmousedown="App._crmSearchGo(\''+c.id+'\')" style="display:flex;align-items:center;gap:9px;padding:8px 9px;border-radius:10px;cursor:pointer" onmouseover="this.style.background=\'#F5F3EF\'" onmouseout="this.style.background=\'transparent\'">'+_crmCustAv(c.customer||c.title,28)
      +'<div style="flex:1;min-width:0"><div style="font-size:12.5px;font-weight:700;color:#13171B;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(c.title||c.customer||'—')+(un?' <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#8B6B41"></span>':'')+'</div><div style="font-size:10.5px;color:#9C9184;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(_crmBoardLabel(b))+(c.isTicket?' · ticket':'')+'</div></div>'
      +'<span style="font-size:10px;color:#B8B5AC;flex-shrink:0">'+_crmRel(c.lastAt)+'</span></div>';}).join('')
    :'<div style="padding:16px;text-align:center;color:#9CA3AF;font-size:12px">No matches for “'+esc(q)+'”.</div>';
  dd.style.display='block';
};
App._crmSearchGo=(id)=>{var i=document.getElementById('crm-search');if(i)i.value='';var d=document.getElementById('crm-search-dd');if(d){d.style.display='none';d.innerHTML='';}CRM.search='';App._crmOpenResult(id);};
App._crmTogConvert=()=>{var d=document.getElementById('crm-convert');if(d)d.style.display=d.style.display==='none'?'block':'none';};
App._crmTogAssign=()=>{var d=document.getElementById('crm-assign');if(d)d.style.display=d.style.display==='none'?'block':'none';};
App._crmTogMembers=()=>{CRM.boardMembersOpen=!CRM.boardMembersOpen;rr();};
App._crmOnInput=(el)=>{var v=el.value,pos=el.selectionStart||v.length;var m=v.slice(0,pos).match(/@(\w*)$/);var d=document.getElementById('crm-mention');if(!d)return;if(m){d.innerHTML=_crmMentionItems(m[1]);d.style.display='block';}else{d.style.display='none';}};
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
  if(!can('crm','create'))return;var inp=document.getElementById('crm-input');var text=(inp?inp.value:'').trim();var imgs=(CRM.compose.images||[]).slice();
  if(!text&&!imgs.length)return;var c=_crmConvo(CRM.sel.convoId);if(!c)return;var board=_crmBoard(c.boardId);var id=uid('msg');var at=new Date().toISOString();
  c.messages.push({id:id,senderId:S.uid,fromCustomer:false,text:text,images:imgs,at:at,reactions:{},parentId:null});c.lastAt=at;CRM.compose.images=[];
  var tagged=_crmMentioned(text,board);rr();var t=document.getElementById('crm-thread');if(t)t.scrollTop=t.scrollHeight;var i2=document.getElementById('crm-input');if(i2)i2.focus();
  await sbWrite({table:'crm_messages',op:'insert',id:id,values:{id:id,conversation_id:c.id,sender_id:S.uid||null,from_customer:false,body:text,images:imgs,created_at:at}},{label:'Message'});sbWrite({table:'crm_conversations',op:'update',id:c.id,match:{col:'id',val:c.id},values:{last_at:at}},{label:'Conversation',silent:true});try{await _crmNotify(tagged,c,at);}catch(e){}
};
async function _crmNotify(tagged,c,at){if(!tagged||!tagged.length)return;var who=me()?fullName(me()):'Someone';var txt='\u{1F4AC} '+who+' tagged you in “'+(c.title||'a conversation')+'”';for(var k=0;k<tagged.length;k++){if(_crmInappOn('crm_mention')){var nid=uid('n');try{DB.notifications.unshift({id:nid,userId:tagged[k],text:txt,time:at,read:false});}catch(e){}try{await sb.from('notifications').insert({id:nid,user_id:tagged[k],text:txt,read:false,created_at:at});}catch(e){}}if(typeof queueEmail==='function'){try{queueEmail('crm_mention',tagged[k],null,null,{title:(c.title||''),actor:who,preview:''});}catch(e){}}}try{_invalidateNotifCache();}catch(e){}}
function _crmAddFiles(files){files=[].slice.call(files||[]).filter(f=>f.type&&f.type.indexOf('image/')===0);files.forEach(function(f){var rd=new FileReader();rd.onload=function(e){CRM.compose.images.push(e.target.result);var pv=document.getElementById('crm-preview');if(pv){pv.style.display='flex';pv.insertAdjacentHTML('beforeend','<div><img src="'+e.target.result+'" style="width:56px;height:56px;object-fit:cover;border-radius:8px;border:1px solid #E5E7EB"/></div>');}};rd.readAsDataURL(f);});}
App._crmPickImg=(input)=>{_crmAddFiles(input.files);input.value='';};
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
/* ── \u23F0 personal reminders: pick date + time + note ── */
App._crmRemindOpen=(cid,mid)=>{if(!S.uid)return;var t=new Date(Date.now()+3600000);var pad=function(n){return(n<10?'0':'')+n;};CRM._rem={cid:cid,mid:mid||null,date:t.getFullYear()+'-'+pad(t.getMonth()+1)+'-'+pad(t.getDate()),time:pad(t.getHours())+':00',note:''};App._crmRemindRender();};
App._crmRemindRender=()=>{var d=CRM._rem;if(!d)return;var c=_crmConvo(d.cid);var m=d.mid&&c?(c.messages||[]).find(function(x){return x.id===d.mid;}):null;
  var upcoming=(CRM.reminders||[]).filter(function(r){return r.conversationId===d.cid&&!r.fired;}).sort(function(a,b){return String(a.remindAt).localeCompare(String(b.remindAt));});
  modalShell({title:'\u23F0 Remind me',sub:(m?'About a message in ':'About ')+'\u201C'+esc((c&&c.title)||'this conversation')+'\u201D \u2014 you\u2019ll get an email + in-app notification.',size:'max-w-md',key:'crm-rem',
    body:(m?'<div style="padding:9px 12px;background:var(--c-surface-2);border-radius:10px;font-size:12px;color:var(--c-text-2);margin-bottom:14px;line-height:1.5"><b>Message:</b> '+esc((m.text||'(image)').slice(0,120))+((m.text||'').length>120?'\u2026':'')+'</div>':'')
      +'<div style="display:flex;gap:10px;margin-bottom:14px"><div style="flex:1"><label class="ui-label">Date</label><input type="date" value="'+esc(d.date)+'" onchange="CRM._rem.date=this.value" class="ui-input"/></div><div style="width:130px"><label class="ui-label">Time</label><input type="time" value="'+esc(d.time)+'" onchange="CRM._rem.time=this.value" class="ui-input"/></div></div>'
      +'<label class="ui-label">Note (optional)</label><input value="'+esc(d.note)+'" oninput="CRM._rem.note=this.value" placeholder="e.g. Follow up with the customer" class="ui-input"/>'
      +(upcoming.length?'<div style="margin-top:16px"><div style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--c-text-3);margin-bottom:6px">Upcoming on this conversation</div>'+upcoming.map(function(r){return'<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--c-surface-2);border-radius:9px;margin-bottom:5px"><span>\u23F0</span><div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:700">'+_crmDT(r.remindAt)+'</div>'+(r.note?'<div style="font-size:11px;color:var(--c-text-2)">'+esc(r.note)+'</div>':'')+'</div><button onclick="App._crmRemindDel(\''+r.id+'\')" style="border:none;background:transparent;color:var(--c-danger);cursor:pointer;font-size:11px;font-weight:700">Remove</button></div>';}).join('')+'</div>':''),
    footer:btnG('Cancel','App.closeModal()')+btnP('Set reminder','App._crmRemindSave()')});};
App._crmRemindSave=async()=>{var d=CRM._rem;if(!d)return;var dt=new Date(d.date+'T'+(d.time||'09:00'));if(isNaN(dt.getTime()))return toast('Pick a date and time','err');if(dt.getTime()<=Date.now())return toast('Pick a future time','err');var id=uid('rem');var iso=dt.toISOString();var rec={id:id,userId:S.uid,conversationId:d.cid,messageId:d.mid,remindAt:iso,note:(d.note||'').trim(),fired:false};if(!CRM.reminders)CRM.reminders=[];CRM.reminders.push(rec);CRM._rem=null;closeModal();rr();toast('\u23F0 Reminder set \u00B7 '+_crmDT(iso));try{await sb.from('crm_reminders').insert({id:id,user_id:S.uid,conversation_id:rec.conversationId,message_id:rec.messageId,remind_at:iso,note:rec.note,fired:false});}catch(e){toast('Saved locally, sync failed','warn');}};
App._crmRemindDel=async(id)=>{CRM.reminders=(CRM.reminders||[]).filter(function(r){return r.id!==id;});if(CRM._rem)App._crmRemindRender();else rr();try{await sb.from('crm_reminders').delete().eq('id',id);}catch(e){}};
// ── Create a ticket from a single chat message ──
App._crmTicketFromMsg=(cid,mid)=>{if(!can('crm','create'))return toast('No permission','err');var c=_crmConvo(cid);if(!c)return;var m=(c.messages||[]).find(function(x){return x.id===mid;});if(!m)return;CRM._tfm={cid:cid,mid:mid,text:(m.text||''),customer:(c.customer||''),srcBoard:c.boardId};App._crmTfmRender();};
App._crmTfmRender=()=>{var d=CRM._tfm;if(!d)return;var srcB=_crmBoard(d.srcBoard);var hubId=srcB?srcB.hubId:null;var boards=CRM.boards.filter(function(b){return _crmBoardVisible(b)&&_crmBS(b).type!=='chat'&&(!hubId||b.hubId===hubId);});if(!boards.length)boards=CRM.boards.filter(function(b){return _crmBoardVisible(b)&&_crmBS(b).type!=='chat';});
  var title=(d.text||'').replace(/\s+/g,' ').trim().slice(0,80)||'Ticket from chat';
  var body='<label class="ui-label">Ticket title</label><input id="tfm-title" value="'+esc(title)+'" class="ui-input" style="margin-bottom:12px" placeholder="Ticket title"/>'
    +'<label class="ui-label">Customer / reference</label><input id="tfm-cust" value="'+esc(d.customer||'')+'" class="ui-input" style="margin-bottom:12px" placeholder="Customer / Order ID"/>'
    +(boards.length?'<label class="ui-label">Add to board</label><select id="tfm-board" class="ui-select" style="margin-bottom:12px">'+boards.map(function(b){return'<option value="'+b.id+'">'+esc(_crmBoardLabel(b))+'</option>';}).join('')+'</select>':'<div style="font-size:12.5px;color:var(--c-danger);margin-bottom:12px">No ticket board here yet — create one with the “+ Board” tab first.</div>')
    
    +'<div style="margin-top:14px;padding:10px 12px;background:var(--c-surface-2);border-radius:10px;font-size:12px;color:var(--c-text-2);line-height:1.5"><b>From message:</b> '+esc((d.text||'').slice(0,160))+((d.text||'').length>160?'…':'')+'</div>';
  modalShell({title:'Create ticket from message',sub:'Turns this message into a tracked ticket, keeping the text as its first note.',size:'max-w-md',key:'crm-tfm',body:body,footer:btnG('Cancel','App.closeModal()')+(boards.length?btnP('Create ticket','App._crmTfmCreate()'):'')});};
App._crmTfmCreate=async()=>{var d=CRM._tfm;if(!d)return;var g=function(id){var e=document.getElementById(id);return e?e.value:'';};var title=(g('tfm-title')||'').trim()||'Ticket from chat';var cust=(g('tfm-cust')||'').trim();var bid=g('tfm-board');var pri='Medium';var b=_crmBoard(bid);if(!b)return toast('Pick a board','err');var st=(_crmStatuses(b)[0]||{name:'Open'}).name;var id=uid('cv');var now=new Date().toISOString();var msgs=[];if(d.text){msgs.push({id:uid('msg'),senderId:S.uid,fromCustomer:false,text:d.text,images:[],at:now,reactions:{},parentId:null});}var c={id:id,boardId:bid,title:title,customer:cust,channel:'From chat',isTicket:true,ticketType:'Ticket',priority:pri,status:st,assignedTo:null,createdBy:S.uid||null,createdAt:now,lastAt:now,messages:msgs,fields:{},dueDate:null};CRM.convos.push(c);CRM._tfm=null;closeModal();CRM.sel.boardId=bid;CRM.sel.hubId=b.hubId;CRM.sel.viewId=null;CRM.sel.convoId=id;CRM.sel.threadId=null;CRM.search='';rr();toast('Ticket created ✓');_crmLog('created ticket',c,'from chat message');sbWrite({table:'crm_conversations',op:'insert',id:id,values:{id:id,board_id:bid,title:title,customer:cust,channel:'From chat',is_ticket:true,ticket_type:'Ticket',priority:pri,status:st,created_by:S.uid||null,created_at:now,last_at:now,updated_at:now}},{label:'New ticket'});if(msgs.length)sbWrite({table:'crm_messages',op:'insert',id:msgs[0].id,values:{id:msgs[0].id,conversation_id:id,sender_id:S.uid||null,from_customer:false,body:d.text,created_at:now}},{label:'Ticket note',silent:true});_crmNotifyRule('created',c,b,'crm_ticket',{title:title,type:b.name,customer:cust,actor:(me()?fullName(me()):'')});try{_crmRunAutos(b,'created',c,{});}catch(e){}};
App._crmDoForward=async(tid)=>{if(!can('crm','create'))return;var mid=CRM.fwdMsgId,m=null;for(var i=0;i<CRM.convos.length&&!m;i++){var mm=(CRM.convos[i].messages||[]).find(x=>x.id===mid);if(mm)m=mm;}if(!m)return;var tgt=_crmConvo(tid);if(!tgt)return;var id=uid('msg'),at=new Date().toISOString();var fm={id:id,senderId:S.uid,fromCustomer:false,text:(m.text?('↪ '+m.text):''),images:(m.images||[]).slice(),at:at,reactions:{},parentId:null};tgt.messages.push(fm);tgt.lastAt=at;CRM.fwdMsgId=null;toast('Forwarded ✓');rr();try{await sb.from('crm_messages').insert({id:id,conversation_id:tid,sender_id:S.uid||null,from_customer:false,body:fm.text,images:fm.images,created_at:at});await sb.from('crm_conversations').update({last_at:at}).eq('id',tid);}catch(e){}};
App._crmOpenThread=(mid)=>{CRM.sel.threadId=mid;rr();var t=document.getElementById('crm-tthread');if(t)t.scrollTop=t.scrollHeight;};
App._crmCloseThread=()=>{CRM.sel.threadId=null;rr();};
App._crmSendReply=async()=>{if(!can('crm','create'))return;var el=document.getElementById('crm-tinput');var text=el?el.value.trim():'';if(!text)return;var c=_crmConvo(CRM.sel.convoId);if(!c)return;var pid=CRM.sel.threadId;var id=uid('msg'),at=new Date().toISOString();c.messages.push({id:id,senderId:S.uid,fromCustomer:false,text:text,images:[],at:at,reactions:{},parentId:pid});c.lastAt=at;rr();var t=document.getElementById('crm-tthread');if(t)t.scrollTop=t.scrollHeight;var i2=document.getElementById('crm-tinput');if(i2)i2.focus();try{await sb.from('crm_messages').insert({id:id,conversation_id:c.id,sender_id:S.uid||null,from_customer:false,body:text,images:[],parent_id:pid,created_at:at});await sb.from('crm_conversations').update({last_at:at}).eq('id',c.id);}catch(e){}};
App._crmAssign=async(id,uid2)=>{if(!can('crm','assign'))return toast('No permission to assign','err');var c=_crmConvo(id);if(!c)return;var prev=c.assignedTo;c.assignedTo=uid2||null;var d=document.getElementById('crm-assign');if(d)d.style.display='none';rr();sbWrite({table:'crm_conversations',op:'update',id:id,match:{col:'id',val:id},values:{assigned_to:uid2||null,updated_at:new Date().toISOString()}},{label:'Assign'});try{_crmRunAutos(_crmBoard(c.boardId),'assigned',c,{to:uid2});}catch(e){}if(uid2&&uid2!==prev){_crmLog('assigned',c,'to '+(uById(uid2)?fullName(uById(uid2)):''));if(uid2!==S.uid){var nid=uid('n'),at2=new Date().toISOString();var ntxt='\u{1F3AF} '+(me()?fullName(me()):'Someone')+' assigned you: "'+(c.title||'')+'"';if(_crmInappOn('crm_ticket')){DB.notifications.unshift({id:nid,userId:uid2,text:ntxt,time:at2,read:false});sbWrite({table:'notifications',op:'insert',id:nid,values:{id:nid,user_id:uid2,text:ntxt,read:false,created_at:at2}},{label:'Notify',silent:true});_invalidateNotifCache();}if(typeof queueEmail==='function'){try{queueEmail('crm_ticket',uid2,null,null,{title:c.title,customer:c.customer,actor:me()?fullName(me()):''});}catch(e){}}}}};
App._crmNewConvo=async()=>{if(!can('crm','create'))return toast('You don’t have permission to create in CRM','err');if(!CRM.sel.boardId)return toast('Select a board first','err');var nm=document.getElementById('crm-nc-name'),tt=document.getElementById('crm-nc-title');var name=(nm?nm.value:'').trim()||'New customer';var title=(tt?tt.value:'').trim()||'New conversation';var id=uid('cv');var now=new Date().toISOString();var _isTk=_crmBS(_crmBoard(CRM.sel.boardId)).type!=='chat';var c={id:id,boardId:CRM.sel.boardId,title:title,customer:name,channel:'Manual',isTicket:_isTk,ticketType:(_isTk?'Ticket':null),priority:'Medium',status:'Open',assignedTo:null,createdBy:S.uid||null,createdAt:now,lastAt:now,messages:[]};CRM.convos.push(c);CRM.sel.category='Chats';CRM.sel.convoId=id;CRM.sel.threadId=null;CRM.search='';toast('Chat started ✓');rr();_crmLog('started chat',c,'');try{if(_isTk)_crmRunAutos(_crmBoard(CRM.sel.boardId),'created',c,{});}catch(e){}try{await sb.from('crm_conversations').insert({id:id,board_id:c.boardId,title:title,customer:name,channel:'Manual',is_ticket:_isTk,ticket_type:(_isTk?'Ticket':null),priority:'Medium',status:'Open',created_by:S.uid||null,created_at:now,last_at:now});}catch(e){console.warn('[CRM convo]',e&&e.message);toast('Saved locally, sync failed','warn');}};
App._crmDelConvo=async(id)=>{if(!can('crm','delete'))return toast('No permission to delete','err');var c=_crmConvo(id);if(!c)return;if(!(await _crmConfirmP('Delete conversation','“'+esc(c.title||'')+'” and all its messages will be permanently deleted.','Delete')))return;CRM.convos=CRM.convos.filter(x=>x.id!==id);if(CRM.sel.convoId===id){CRM.sel.convoId=null;CRM.sel.threadId=null;}rr();sbWrite({table:'crm_conversations',op:'delete',id:id,match:{col:'id',val:id}},{label:'Delete conversation'});};
App._crmConvert=async(id,type)=>{if(!can('crm','convert'))return toast('No permission to convert','err');var c=_crmConvo(id);if(!c)return;var d=document.getElementById('crm-convert');if(d)d.style.display='none';if(!type||type==='Other'){var t=await _crmPromptP('New ticket type','','e.g. Refunds','Add','General');if(!t)return;type=t.trim();var _cb2=_crmBoard(c.boardId);if(_cb2){if(!_cb2.settings)_cb2.settings={};var _cc=(_cb2.settings.categories&&_cb2.settings.categories.length?_cb2.settings.categories.slice():_crmCats(_cb2).slice());if(_cc.indexOf(type)<0)_cc.push(type);_cb2.settings.categories=_cc;try{await sb.from('crm_boards').update({settings:_cb2.settings}).eq('id',_cb2.id);}catch(e){}}}c.isTicket=true;c.ticketType=type;c.status=c.status||'Open';CRM.sel.category=type;CRM.sel.convoId=c.id;toast('Converted to '+type+' ticket ✓');rr();_crmLog('created ticket',c,type);var _cb=_crmBoard(c.boardId);_crmNotifyRule('created',c,_cb,'crm_ticket',{title:c.title,type:type,customer:c.customer});try{_crmRunAutos(_cb,'created',c,{});}catch(e){}if(_crmBS(_cb).type==='approval')_crmNotifyRule('approval',c,_cb,'crm_approval',{title:c.title,customer:c.customer});try{await sb.from('crm_conversations').update({is_ticket:true,ticket_type:type,status:c.status,priority:c.priority}).eq('id',id);}catch(e){console.warn('[CRM convert]',e&&e.message);}};
App._crmSetDue=async(id,v)=>{if(!can('crm','edit'))return;var c=_crmConvo(id);if(!c)return;c.dueDate=v||null;rr();_crmLog('due date',c,v?('set to '+v):'cleared');sbWrite({table:'crm_conversations',op:'update',id:id,match:{col:'id',val:id},values:{due_date:v||null,updated_at:new Date().toISOString()}},{label:'Due date'});};
App._crmSetPriority=async(id,v)=>{if(!can('crm','edit'))return;var c=_crmConvo(id);if(!c)return;c.priority=v;rr();sbWrite({table:'crm_conversations',op:'update',id:id,match:{col:'id',val:id},values:{priority:v,updated_at:new Date().toISOString()}},{label:'Priority'});try{_crmRunAutos(_crmBoard(c.boardId),'priority',c,{to:v});}catch(e){}};
App._crmSetStatus=async(id,v)=>{if(!can('crm','edit'))return;var c=_crmConvo(id);if(!c)return;var prev=c.status;c.status=v;rr();if(prev!==v)_crmLog('status',c,prev+' → '+v);sbWrite({table:'crm_conversations',op:'update',id:id,match:{col:'id',val:id},values:{status:v,updated_at:new Date().toISOString()}},{label:'Status'});try{_crmRunAutos(_crmBoard(c.boardId),'status',c,{to:v});}catch(e){}};
App._crmAddMember=async(uid2)=>{if(!(can('crm','manage')||can('crm','edit')))return toast('No permission','err');var b=_crmBoard(CRM.sel.boardId);if(!b)return;if(b.members.indexOf(uid2)<0)b.members.push(uid2);rr();try{await sb.from('crm_board_members').insert({board_id:b.id,user_id:uid2});}catch(e){console.warn('[CRM addMem]',e&&e.message);}};
App._crmRemoveMember=async(uid2)=>{if(!(can('crm','manage')||can('crm','edit')))return toast('No permission','err');var b=_crmBoard(CRM.sel.boardId);if(!b)return;b.members=b.members.filter(x=>x!==uid2);rr();try{await sb.from('crm_board_members').delete().eq('board_id',b.id).eq('user_id',uid2);}catch(e){}};
App._crmNewHub=async()=>{if(!can('crm','create'))return toast('No permission to create','err');var n=await _crmPromptP('New hub','A hub is a city or team — it holds boards (chats & ticket tables) and filtered views.','e.g. Dubai','Create hub');if(!n)return;var id=uid('hub'),bid=uid('brd');CRM.hubs.push({id:id,name:n.trim(),icon:'folder'});CRM.boards.push({id:bid,hubId:id,name:'Chat',members:S.uid?[S.uid]:[],settings:{type:'chat'},createdBy:S.uid||null});CRM.sel.hubId=id;CRM.sel.viewId=null;CRM.sel.boardId=bid;CRM.sel.convoId=null;CRM.sel.threadId=null;rr();try{await sb.from('crm_hubs').insert({id:id,name:n.trim(),icon:'folder',created_by:S.uid||null,sort:CRM.hubs.length});await sb.from('crm_boards').insert({id:bid,hub_id:id,name:'Chat',created_by:S.uid||null,sort:0,settings:{type:'chat'}});if(S.uid)await sb.from('crm_board_members').insert({board_id:bid,user_id:S.uid});}catch(e){toast('Saved locally, sync failed','warn');}};
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
      +'<span style="width:30px;height:30px;border-radius:9px;background:#F8F5EE;color:#8B6B41;display:grid;place-items:center;flex-shrink:0">'+ic('users','w-4 h-4')+'</span>'
      +'<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:800;color:var(--c-text)">'+esc(g.name||'—')+' <span style="font-size:10.5px;font-weight:700;color:var(--c-text-3)">@'+esc(_crmGroupToken(g))+'</span></div><div style="font-size:11.5px;color:var(--c-text-2);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(mem.length?mem.slice(0,4).map(function(u){return esc(_crmFirst(u));}).join(', ')+(mem.length>4?' +'+(mem.length-4):''):'No members yet')+'</div></div>'
      +'<span style="display:flex;align-items:center;flex-shrink:0">'+mem.slice(0,4).map(function(u,i){return'<span style="margin-left:'+(i?-7:0)+'px;border:2px solid #fff;border-radius:50%;display:inline-flex">'+avatar(u,'w-6 h-6','text-[9px]')+'</span>';}).join('')+'</span>'
      +'<span style="font-size:11px;font-weight:800;color:var(--c-text-2);background:var(--c-surface-2);border-radius:9px;padding:2px 8px;flex-shrink:0">'+mem.length+'</span>'
      +(canMg?'<button onclick="App._crmGroupEdit(\''+g.id+'\')" title="Edit group" style="border:none;background:var(--c-surface-2);color:var(--c-text-2);width:28px;height:28px;border-radius:8px;cursor:pointer;display:grid;place-items:center;flex-shrink:0">'+ic('edit','w-3.5 h-3.5')+'</button><button onclick="App._crmGroupDel(\''+g.id+'\')" title="Delete group" style="border:none;background:var(--c-danger-soft);color:var(--c-danger);width:28px;height:28px;border-radius:8px;cursor:pointer;display:grid;place-items:center;flex-shrink:0">'+ic('trash','w-3.5 h-3.5')+'</button>':'')
    +'</div>';}).join(''):'<div style="padding:22px;text-align:center;color:var(--c-text-3);font-size:12.5px;line-height:1.6">No groups yet.'+(canMg?'<br/>Create one and use it everywhere — @tag it in chat, pick it in automations and board notifications.':'')+'</div>';
  modalShell({title:'People groups',sub:'One group, used everywhere: @tag it in any board, notify it in automations, email it via board rules.',size:'max-w-lg',key:'crm-groups',
    body:list+(canMg?'<button onclick="App._crmGroupNew()" class="ui-btn ui-btn-brand ui-btn-sm" style="margin-top:4px">+ New group</button>':''),
    footer:btnP('Done','App.closeModal();rr()')});
};
App._crmGroupNew=()=>{if(!can('crm','groups'))return toast('You need the CRM → People groups permission','err');CRM._grpEdit={id:uid('grp'),name:'',members:[],_new:true};App._crmGroupsRender();};
App._crmGroupEdit=(id)=>{if(!can('crm','groups'))return toast('You need the CRM → People groups permission','err');var g=_crmGroup(id);if(!g)return;CRM._grpEdit=JSON.parse(JSON.stringify(g));delete CRM._grpEdit._new;App._crmGroupsRender();};
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
  var pill=function(v,label,desc,icon){var on=d.type===v;return'<button type="button" onclick="CRM._nbEdit.type=\''+v+'\';App._crmNewBoardRender()" style="flex:1;text-align:left;display:flex;align-items:flex-start;gap:9px;padding:11px;border:1.5px solid '+(on?'#8B6B41':'#E5E7EB')+';border-radius:12px;background:'+(on?'#F5EEE1':'#fff')+';cursor:pointer"><span style="width:30px;height:30px;border-radius:9px;background:'+(on?'#fff':'#F6F7F8')+';color:'+(on?'#8B6B41':'#9CA3AF')+';display:grid;place-items:center;flex-shrink:0">'+ic(icon,'w-4 h-4')+'</span><span><span style="display:block;font-size:12.5px;font-weight:800;color:#13171B">'+label+'</span><span style="display:block;font-size:10.5px;color:#9CA3AF;margin-top:1px;line-height:1.4">'+desc+'</span></span></button>';};
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
  var id=uid('brd');
  CRM.boards.push({id:id,hubId:d.hubId,name:n,members:S.uid?[S.uid]:[],settings:{type:d.type||'ticket'},createdBy:S.uid||null});
  CRM._nbEdit=null;closeModal();
  CRM.sel.hubId=d.hubId;CRM.sel.viewId=null;CRM.sel.boardId=id;CRM.sel.convoId=null;CRM.sel.threadId=null;rr();
  toast('Board created ✓');
  try{await sb.from('crm_boards').insert({id:id,hub_id:d.hubId,name:n,created_by:S.uid||null,sort:CRM.boards.length,settings:{type:d.type||'ticket'}});if(S.uid)await sb.from('crm_board_members').insert({board_id:id,user_id:S.uid});}catch(e){toast('Saved locally, sync failed','warn');}
};
App._crmDelBoard=async(id)=>{if(!can('crm','delete'))return toast('No permission to delete','err');var b=_crmBoard(id);if(!b)return;if(!(await _crmConfirmP('Delete board','“'+esc(b.name)+'” and its tickets & conversations will be permanently deleted. Filtered views keep working — this board simply disappears from them.','Delete board')))return;CRM.boards=CRM.boards.filter(x=>x.id!==id);CRM.convos=CRM.convos.filter(c=>c.boardId!==id);(CRM.views||[]).forEach(function(v){if(v.filters&&!Array.isArray(v.filters)&&v.filters[id]){delete v.filters[id];sbWrite({table:'crm_views',op:'update',id:v.id,match:{col:'id',val:v.id},values:{filters:v.filters}},{label:'View filter',silent:true});}});if(CRM.sel.boardId===id){CRM.sel.boardId=null;CRM.sel.convoId=null;CRM.sel.threadId=null;}rr();sbWrite({table:'crm_boards',op:'delete',id:id,match:{col:'id',val:id}},{label:'Delete board'});};
App._crmAddCat=async()=>{if(!can('crm','create'))return;var b=_crmBoard(CRM.sel.boardId);if(!b)return;var n=await _crmPromptP('New section','','e.g. Complaints','Add');if(!n)return;n=n.trim();if(!b.settings)b.settings={};var cats=(b.settings.categories&&b.settings.categories.length)?b.settings.categories.slice():_crmCats(b).slice();if(cats.indexOf(n)<0)cats.push(n);b.settings.categories=cats;CRM.sel.category=n;rr();try{await sb.from('crm_boards').update({settings:b.settings}).eq('id',b.id);}catch(e){}};
App._crmDelCat=async(name)=>{if(!can('crm','delete'))return;var b=_crmBoard(CRM.sel.boardId);if(!b)return;if(CRM.convos.some(function(c){return c.boardId===b.id&&c.isTicket&&c.ticketType===name;}))return toast('“'+name+'” still has tickets — move or delete those first','err');if(!(await _crmConfirmP('Remove section','The “'+esc(name)+'” section will be removed from this board.','Remove')))return;if(!b.settings)b.settings={};var cats=(b.settings.categories&&b.settings.categories.length?b.settings.categories:_crmCats(b)).filter(function(x){return x!==name;});b.settings.categories=cats;if(CRM.sel.category===name)CRM.sel.category='Chats';rr();try{await sb.from('crm_boards').update({settings:b.settings}).eq('id',b.id);}catch(e){}};

// ===== CRM AUTOMATION: activity log, approvals, notification rules, email =====
function _crmBS(board){var s=(board&&board.settings)||{};var g=CRM.settings||{};return{type:s.type||'chat',approvers:s.approvers||[],notify:s.notify||{},email:(s.email&&Object.keys(s.email).length?s.email:(g.email||{})),approveTo:s.approveTo||{action:'resolve'},rejectTo:s.rejectTo||{action:'resolve'}};}
function _crmActFor(cid){return (CRM.activity||[]).filter(function(a){return a.conversationId===cid;});}
async function _crmLog(action,convo,detail){var id=uid('act');var at=new Date().toISOString();var e={id:id,conversationId:convo?convo.id:null,boardId:convo?convo.boardId:CRM.sel.boardId,actor:S.uid,action:action,detail:detail||'',at:at};if(!CRM.activity)CRM.activity=[];CRM.activity.unshift(e);try{await sb.from('crm_activity').insert({id:id,conversation_id:e.conversationId,board_id:e.boardId,actor:S.uid||null,action:action,detail:e.detail,created_at:at});}catch(err){}}
function _crmRecips(board,event){var bs=_crmBS(board);var g=CRM.settings||{};var set={};var gl=_crmExpandPeople((g.notify&&g.notify.list)||[]);var bl=_crmExpandPeople((bs.notify&&bs.notify.list)||[]);if(event==='approval'){_crmExpandPeople(bs.approvers||[]).forEach(function(u){set[u]=1;});}else{gl.forEach(function(u){set[u]=1;});bl.forEach(function(u){set[u]=1;});}delete set[S.uid];return Object.keys(set);}
async function _crmNotifyRule(event,convo,board,emailType,vars){var recips=_crmRecips(board,event);if(!recips.length)return;var bs=_crmBS(board);var emailOn=!(bs.email&&bs.email[event]===false);var who=me()?fullName(me()):'Someone';var at=new Date().toISOString();var txt=(event==='created'?('\u{1F3AB} '+who+' created a ticket: "'+(convo.title||'')+'"'):event==='approval'?('✅ Approval needed: "'+(convo.title||'')+'"'):event==='decided'?(((vars&&vars.decision)||'Updated')+': "'+(convo.title||'')+'"'):('\u{1F514} '+(convo.title||'')));for(var i=0;i<recips.length;i++){if(_crmInappOn('crm_ticket')){var nid=uid('n');try{DB.notifications.unshift({id:nid,userId:recips[i],text:txt,time:at,read:false});}catch(e){}try{await sb.from('notifications').insert({id:nid,user_id:recips[i],text:txt,read:false,created_at:at});}catch(e){}}if(emailOn&&emailType&&typeof queueEmail==='function'){try{queueEmail(emailType,recips[i],null,null,vars||{});}catch(e){}}}try{_invalidateNotifCache();}catch(e){}}
App._crmDecide=async(id,decision)=>{var c=_crmConvo(id);if(!c)return;var board=_crmBoard(c.boardId);var bs=_crmBS(board);if(!(can('crm','manage')||(bs.approvers||[]).indexOf(S.uid)>=0||can('crm','convert')||can('crm','edit')))return toast('Only approvers can decide','err');var at=new Date().toISOString();c.decision=decision;c.decidedBy=S.uid;c.decidedAt=at;var step=decision==='Approved'?bs.approveTo:bs.rejectTo;var detail;if(step&&step.action==='move'&&step.boardId&&_crmBoard(step.boardId)){c.boardId=step.boardId;c.isTicket=true;detail='moved to '+_crmBoard(step.boardId).name;}else{var _doneSt=(_crmStatuses(board).find(function(x){return x.done;})||{name:'Resolved'}).name;c.status=_doneSt;detail='marked '+_doneSt;}await _crmLog(decision,c,detail);toast('Ticket '+decision.toLowerCase()+' ✓');rr();sbWrite({table:'crm_conversations',op:'update',id:id,match:{col:'id',val:id},values:{decision:decision,decided_by:S.uid||null,decided_at:at,board_id:c.boardId,status:c.status,updated_at:at}},{label:'Ticket decision'});_crmNotifyRule('decided',c,board,'crm_decided',{title:c.title,decision:decision,actor:(me()?fullName(me()):''),customer:c.customer});if(typeof _crmNotifyEvent==='function')_crmNotifyEvent(board,decision==='Approved'?'approved':'rejected',c,decision==='Approved'?'crm_approval':'crm_decided',{title:c.title,decision:decision,actor:(me()?fullName(me()):''),customer:c.customer});};
function _crmApprovalCtl(convo,board){return'';var bs=_crmBS(board);if(bs.type==='chat'||!convo.isTicket)return'';if(convo.decision){var col=convo.decision==='Approved'?['#047857','#F5EEE1']:['#B91C1C','#FEF2F2'];var by=convo.decidedBy&&uById(convo.decidedBy)?fullName(uById(convo.decidedBy)):'';return'<span style="display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;color:'+col[0]+';background:'+col[1]+';border-radius:8px;padding:4px 9px">'+esc(convo.decision)+(by?' · '+esc(by):'')+' · '+_crmDT(convo.decidedAt)+'</span>';}var ok=can('crm','manage')||(bs.approvers||[]).indexOf(S.uid)>=0||can('crm','convert');if(!ok)return'<span style="font-size:11.5px;color:#9CA3AF">Awaiting approval</span>';return'<div style="display:flex;gap:6px"><button onclick="App._crmDecide(\''+convo.id+'\',\'Approved\')" style="display:inline-flex;align-items:center;gap:5px;background:#8B6B41;color:#fff;font-size:12px;font-weight:700;padding:7px 12px;border-radius:9px;border:none;cursor:pointer">'+ic('check','w-3.5 h-3.5')+'Approve</button><button onclick="App._crmDecide(\''+convo.id+'\',\'Rejected\')" style="display:inline-flex;align-items:center;gap:5px;background:#fff;color:#DC2626;border:1px solid #FCA5A5;font-size:12px;font-weight:700;padding:7px 12px;border-radius:9px;cursor:pointer">'+ic('x','w-3.5 h-3.5')+'Reject</button></div>';}
function _crmHdrBtns(convo,board){var others=CRM.boards.filter(function(b){return board&&b.hubId===board.hubId&&b.id!==convo.boardId&&_crmBoardVisible(b)&&_crmBS(b).type!=='chat';});var mv=(can('crm','edit')&&others.length)?'<div style="position:relative"><button title="Move / escalate to another board" onclick="App._crmTogMove()" style="width:34px;height:34px;border-radius:9px;border:1px solid #E5E7EB;background:#fff;color:#6B7280;cursor:pointer;display:grid;place-items:center">'+ic('send','w-4 h-4')+'</button><div id="crm-move" style="display:none;position:absolute;right:0;top:38px;z-index:60;background:#fff;border:1px solid #E5E7EB;border-radius:12px;box-shadow:0 12px 32px rgba(16,24,40,.18);padding:6px;width:224px;max-height:250px;overflow:auto"><div style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#9CA3AF;padding:4px 8px">Move / escalate to</div>'+others.map(function(b){var t=_crmBS(b).type;return'<button onclick="App._crmMoveConvo(\''+convo.id+'\',\''+b.id+'\')" style="width:100%;text-align:left;display:flex;align-items:center;gap:8px;padding:7px 8px;border:none;background:transparent;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;color:#13171B" onmouseover="this.style.background=\'#F3F4F6\'" onmouseout="this.style.background=\'transparent\'"><span style="color:#9CA3AF">'+ic(t==='chat'?'msg':'ticket','w-3.5 h-3.5')+'</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(b.name)+'</span><span style="font-size:9px;font-weight:800;text-transform:uppercase;color:#B8B5AC">'+esc(t)+'</span></button>';}).join('')+'</div></div>':'';var rem=S.uid?'<button title="Remind me (date & time)" onclick="App._crmRemindOpen(\''+convo.id+'\')" style="width:34px;height:34px;border-radius:9px;border:1px solid #D1B68F;background:#F5EEE1;color:#54433C;cursor:pointer;display:grid;place-items:center">'+ic('bell','w-4 h-4')+'</button>':'';return rem+mv+(convo.isTicket?'<button title="Details panel" onclick="App._crmTogDetails()" style="width:34px;height:34px;border-radius:9px;border:1px solid #E5E7EB;background:'+(CRM.detailsOpen!==false?'#F8F5EE':'#fff')+';color:#6B7280;cursor:pointer;display:grid;place-items:center">'+ic('info','w-4 h-4')+'</button>':'')+'<button title="Activity — who did what" onclick="App._crmTogActivity()" style="width:34px;height:34px;border-radius:9px;border:1px solid #E5E7EB;background:'+(CRM.activityOpen?'#F8F5EE':'#fff')+';color:#6B7280;cursor:pointer;display:grid;place-items:center">'+ic('clock','w-4 h-4')+'</button>';}
function _crmChecked(prefix){var out=[];(DB.users||[]).forEach(function(u){var el=document.getElementById(prefix+u.id);if(el&&el.checked)out.push(u.id);});return out;}
App._crmTogActivity=()=>{CRM.activityOpen=!CRM.activityOpen;rr();};
App._crmTogBoardSettings=(bid)=>{CRM._bsBoardId=bid||CRM.sel.boardId;CRM.boardSettingsOpen=!CRM.boardSettingsOpen;rr();};
App._crmTogGlobalSettings=()=>{CRM.globalSettingsOpen=!CRM.globalSettingsOpen;CRM.boardSettingsOpen=false;rr();};
App._crmSaveGlobalSettings=async()=>{if(!can('crm','manage'))return toast('No permission','err');var nl=_crmChecked('crmgs-notify-');_crmGroups().forEach(function(g){var el=document.getElementById('crmgs-notify-grp-'+g.id);if(el&&el.checked)nl.push('grp:'+g.id);});var email=!!(document.getElementById('crmgs-email')||{}).checked;CRM.settings=Object.assign({},CRM.settings,{notify:{list:nl},email:{created:email,approval:email,decided:email,mention:email}});CRM.globalSettingsOpen=false;toast('CRM defaults saved ✓');rr();try{await sb.from('workspace_settings').upsert({key:'crm_settings',value:CRM.settings},{onConflict:'key'});}catch(e){}};
function _crmModals(){var out='';var convo=_crmConvo(CRM.sel.convoId);
  if(CRM.boardMembersOpen){var _b=_crmBoard(CRM.sel.boardId);var _bm=(_b&&_b.members||[]).map(function(id){return uById(id);}).filter(Boolean);var _bnm=(DB.users||[]).filter(function(u){return u&&u.status!=='Disabled'&&_b&&(_b.members||[]).indexOf(u.id)<0;});out+='<div style="position:fixed;inset:0;z-index:97;background:rgba(0,0,0,.28);display:grid;place-items:center" onclick="App._crmTogMembers()"><div onclick="event.stopPropagation()" style="background:#fff;border-radius:16px;width:430px;max-width:94vw;max-height:86vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.3)"><div class="fd" style="padding:15px 20px;border-bottom:1px solid #ECEDF0;font-weight:800;font-size:15px">Board members — '+esc(_b?_b.name:'')+'</div><div style="padding:8px 20px;font-size:12px;color:#9C9184;border-bottom:1px solid #F5F1EA;line-height:1.5">People added here can open <b>this board</b>. (Filtered views have their own people — assigned when the view is created.)</div><div class="crm-scroll" style="overflow-y:auto;padding:8px 14px;flex:1">'+(_bm.length?_bm.map(function(u){return'<div style="display:flex;align-items:center;gap:8px;padding:6px 4px"><span>'+avatar(u,'w-7 h-7','text-[9px]')+'</span><span style="font-size:13px;font-weight:600;color:#13171B;flex:1">'+esc(fullName(u))+'</span><button title="Remove from board" onclick="App._crmRemoveMember(\''+u.id+'\')" style="border:none;background:#FEF2F2;color:#DC2626;width:24px;height:24px;border-radius:7px;cursor:pointer;display:grid;place-items:center">'+ic('x','w-3.5 h-3.5')+'</button></div>';}).join(''):'<div style="padding:10px 4px;font-size:12.5px;color:#9C9184">No members yet — add people below so they can see this board.</div>')+'<div style="height:1px;background:#F2EDE4;margin:8px 0"></div><div style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#9C9184;padding:2px 4px 6px">Add to this board</div>'+_crmGroupAddRows(_b&&_b.members||[],'App._crmAddGroupToBoard')+(_bnm.length?_bnm.slice(0,80).map(function(u){return'<button onclick="App._crmAddMember(\''+u.id+'\')" style="width:100%;text-align:left;display:flex;align-items:center;gap:8px;padding:6px 4px;border:none;background:transparent;border-radius:8px;cursor:pointer" onmouseover="this.style.background=\'#F5F3EF\'" onmouseout="this.style.background=\'transparent\'">'+avatar(u,'w-7 h-7','text-[9px]')+'<span style="font-size:13px;font-weight:600;color:#13171B">'+esc(fullName(u))+'</span></button>';}).join(''):'<div style="padding:8px 4px;font-size:12px;color:#9C9184">Everyone already has access.</div>')+'</div><div style="padding:12px 20px;border-top:1px solid #ECEDF0;display:flex;justify-content:flex-end"><button onclick="App._crmTogMembers()" style="padding:9px 18px;border:none;background:#13171B;color:#fff;border-radius:10px;font-weight:700;cursor:pointer">Done</button></div></div></div>';}
  if(CRM.activityOpen&&convo){var items=_crmActFor(convo.id);out+='<div style="position:fixed;top:0;right:0;bottom:0;width:340px;max-width:92vw;z-index:90;background:#fff;border-left:1px solid #ECEDF0;box-shadow:-8px 0 30px rgba(16,24,40,.10);display:flex;flex-direction:column"><div style="padding:13px 16px;border-bottom:1px solid #ECEDF0;display:flex;align-items:center;justify-content:space-between"><span style="font-weight:800;font-size:14px">Activity</span><button onclick="App._crmTogActivity()" style="border:none;background:transparent;cursor:pointer;color:#9CA3AF">'+ic('x','w-4 h-4')+'</button></div><div class="crm-scroll" style="flex:1;overflow-y:auto;padding:10px 12px">'+(items.length?items.map(function(a){var u=a.actor&&uById(a.actor)?fullName(uById(a.actor)):'System';return'<div style="display:flex;gap:9px;padding:9px 4px;border-bottom:1px solid #F5F6F8"><div style="margin-top:1px">'+(a.actor&&uById(a.actor)?avatar(uById(a.actor),'w-6 h-6','text-[9px]'):_crmCustAv('S',24))+'</div><div style="min-width:0"><div style="font-size:12.5px;color:#13171B;line-height:1.4"><b>'+esc(u)+'</b> '+esc(a.action)+(a.detail?' <span style="color:#6B7280">— '+esc(a.detail)+'</span>':'')+'</div><div style="font-size:10.5px;color:#B8B5AC;margin-top:1px">'+_crmDT(a.at)+'</div></div></div>';}).join(''):'<div style="padding:22px;text-align:center;color:#9CA3AF;font-size:12.5px">No activity recorded yet.</div>')+'</div></div>';}
  if(CRM.boardSettingsOpen){var b=_crmBoard(CRM._bsBoardId||CRM.sel.boardId);var bs=(b&&b.settings)||{};var nt=bs.notify||{};var _uu=_crmBoardPeople(b);var _gg=_crmGroups();var _ul=function(ev){var h=_gg.length?'<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#9CA3AF;padding:2px">Groups</div>'+_gg.map(function(g){return'<label style="display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:700;cursor:pointer;padding:3px 2px"><input type="checkbox" id="crmn-'+ev+'-grp-'+g.id+'" '+(((nt[ev]||[]).indexOf('grp:'+g.id)>=0)?'checked':'')+'/>'+esc(g.name)+' <span style="font-weight:600;color:#9CA3AF;font-size:11px">('+((g.members||[]).length)+')</span></label>';}).join('')+'<div style="height:1px;background:#F0F1F3;margin:4px 0"></div>':'';return h+(_uu.length?_uu.map(function(u){return'<label style="display:flex;align-items:center;gap:8px;font-size:12.5px;cursor:pointer;padding:3px 2px"><input type="checkbox" id="crmn-'+ev+'-'+u.id+'" '+(((nt[ev]||[]).indexOf(u.id)>=0)?'checked':'')+'/>'+esc(fullName(u))+'</label>';}).join(''):'<div style="font-size:12px;color:#9CA3AF;padding:4px">No members on this board yet — add board or channel members first.</div>');};out+='<div style="position:fixed;inset:0;z-index:95;background:rgba(0,0,0,.28);display:grid;place-items:center" onclick="App._crmTogBoardSettings()"><div onclick="event.stopPropagation()" style="background:#fff;border-radius:16px;width:440px;max-width:94vw;max-height:88vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.3)"><div style="padding:15px 20px;border-bottom:1px solid #ECEDF0;font-weight:800;font-size:15px">Board rules — '+esc(b?b.name:'')+'</div><div style="padding:8px 20px;font-size:12px;color:#9CA3AF;border-bottom:1px solid #F5F6F8">Selected people get an <b>email + in-app</b> notification for each event on this board.</div><div class="crm-scroll" style="overflow-y:auto;padding:14px 20px;display:flex;flex-direction:column;gap:14px"><div><div style="font-size:12px;font-weight:800;color:#374151;margin-bottom:5px">Ticket moved here</div><div style="max-height:120px;overflow:auto;border:1px solid #F0F1F3;border-radius:8px;padding:6px">'+_ul('moved')+'</div></div><div><div style="font-size:12px;font-weight:800;color:#374151;margin-bottom:5px">Ticket approved</div><div style="max-height:120px;overflow:auto;border:1px solid #F0F1F3;border-radius:8px;padding:6px">'+_ul('approved')+'</div></div><div><div style="font-size:12px;font-weight:800;color:#374151;margin-bottom:5px">Ticket rejected</div><div style="max-height:120px;overflow:auto;border:1px solid #F0F1F3;border-radius:8px;padding:6px">'+_ul('rejected')+'</div></div></div><div style="padding:14px 20px;border-top:1px solid #ECEDF0;display:flex;justify-content:flex-end;gap:8px"><button onclick="App._crmTogBoardSettings()" style="padding:9px 16px;border:1px solid #E5E7EB;background:#fff;border-radius:10px;font-weight:600;cursor:pointer">Cancel</button><button onclick="App._crmSaveBoardSettings()" style="padding:9px 16px;border:none;background:#13171B;color:#fff;border-radius:10px;font-weight:700;cursor:pointer">Save rules</button></div></div></div>';}
  
  if(CRM.globalSettingsOpen){var allU=(DB.users||[]).filter(function(u){return u&&u.status!=='Disabled';});var gl=(CRM.settings&&CRM.settings.notify&&CRM.settings.notify.list)||[];var ge=!(CRM.settings&&CRM.settings.email&&CRM.settings.email.created===false);
    out+='<div style="position:fixed;inset:0;z-index:96;background:rgba(0,0,0,.28);display:grid;place-items:center" onclick="App._crmTogGlobalSettings()"><div onclick="event.stopPropagation()" style="background:#fff;border-radius:16px;width:420px;max-width:94vw;max-height:88vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.3)"><div style="padding:16px 20px;border-bottom:1px solid #ECEDF0;font-weight:800;font-size:15px">CRM notification defaults</div><div class="crm-scroll" style="overflow-y:auto;padding:18px 20px;display:flex;flex-direction:column;gap:14px"><div style="font-size:12px;color:#9CA3AF">These people are notified for CRM ticket events on <b>every</b> board, in addition to each board’s own list.</div><div style="display:flex;flex-direction:column;gap:3px;max-height:200px;overflow:auto;border:1px solid #F0F1F3;border-radius:8px;padding:6px">'+(_crmGroups().length?'<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#9CA3AF;padding:2px">Groups</div>'+_crmGroups().map(function(g){return'<label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;cursor:pointer"><input type="checkbox" id="crmgs-notify-grp-'+g.id+'" '+(gl.indexOf('grp:'+g.id)>=0?'checked':'')+'/>'+esc(g.name)+' <span style="font-weight:600;color:#9CA3AF;font-size:11px">('+((g.members||[]).length)+')</span></label>';}).join('')+'<div style="height:1px;background:#F0F1F3;margin:5px 0"></div>':'')+allU.map(function(u){return'<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer"><input type="checkbox" id="crmgs-notify-'+u.id+'" '+(gl.indexOf(u.id)>=0?'checked':'')+'/>'+esc(fullName(u))+'</label>';}).join('')+'</div><label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;cursor:pointer"><input type="checkbox" id="crmgs-email" '+(ge?'checked':'')+'/>Also send email for CRM events</label></div><div style="padding:14px 20px;border-top:1px solid #ECEDF0;display:flex;justify-content:flex-end;gap:8px"><button onclick="App._crmTogGlobalSettings()" style="padding:9px 16px;border:1px solid #E5E7EB;background:#fff;border-radius:10px;font-weight:600;cursor:pointer">Cancel</button><button onclick="App._crmSaveGlobalSettings()" style="padding:9px 16px;border:none;background:#13171B;color:#fff;border-radius:10px;font-weight:700;cursor:pointer">Save defaults</button></div></div></div>';}
  return out;}

/* (v3.12: the channel layer was removed — boards live directly on hubs; access = board members + filtered views) */
/* ── Add a whole people-group to a board in one tap ── */
function _crmGroupAddRows(existing,handler){var ex={};(existing||[]).forEach(function(id){ex[id]=1;});var gs=_crmGroups().map(function(g){var add=(g.members||[]).filter(function(id){var u=uById(id);return u&&u.status!=='Disabled'&&!ex[id];}).length;return{g:g,add:add};}).filter(function(x){return x.add>0;});if(!gs.length)return'';
  return'<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#9C9184;padding:2px 4px 4px">Add a whole group</div>'+gs.map(function(x){return'<button onclick="'+handler+'(\''+x.g.id+'\')" title="Adds every member of this group" style="width:100%;text-align:left;display:flex;align-items:center;gap:8px;padding:6px 4px;border:none;background:transparent;border-radius:8px;cursor:pointer" onmouseover="this.style.background=\'#F5F3EF\'" onmouseout="this.style.background=\'transparent\'"><span style="width:28px;height:28px;border-radius:9px;background:#F5EEE1;color:#8B6B41;display:grid;place-items:center;flex-shrink:0">'+ic('users','w-3.5 h-3.5')+'</span><span style="font-size:13px;font-weight:700;color:#13171B;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(x.g.name)+'</span><span style="font-size:11px;font-weight:800;color:#8B6B41;background:#F5EEE1;border-radius:8px;padding:2px 8px;flex-shrink:0">+ '+x.add+'</span></button>';}).join('')+'<div style="height:1px;background:#F2EDE4;margin:8px 0"></div>';}
App._crmAddGroupToBoard=async(gid)=>{if(!(can('crm','manage')||can('crm','edit')))return toast('No permission','err');var b=_crmBoard(CRM.sel.boardId);var g=_crmGroup(gid);if(!b||!g)return;var add=(g.members||[]).filter(function(id){var u=uById(id);return u&&u.status!=='Disabled'&&b.members.indexOf(id)<0;});if(!add.length)return toast('Everyone in \u201C'+g.name+'\u201D is already on this board');add.forEach(function(id){b.members.push(id);});rr();toast('Added '+add.length+' from \u201C'+g.name+'\u201D \u2713');try{await sb.from('crm_board_members').insert(add.map(function(id){return{board_id:b.id,user_id:id};}));}catch(e){console.warn('[CRM addGrp]',e&&e.message);}};

App._crmMobNav=()=>{var n=document.querySelector('.crm-nav');if(n)n.classList.toggle('crmopen');};
App._crmMobBack=()=>{CRM.sel.convoId=null;CRM.sel.threadId=null;rr();};

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
  (((board&&board.settings)||{}).columns||[]).forEach(function(c){f.push({id:c.id,name:c.name,type:c.type,options:c.options||[]});});
  return f;
}
function _crmFOps(t){
  var TXT=[['contains','contains'],['equals','equals'],['set','is filled'],['empty','is empty']];
  var NUM=[['eq','= equals'],['gt','> greater than'],['lt','< less than'],['set','is filled'],['empty','is empty']];
  var DTE=[['on','on date'],['before','before'],['after','after'],['past','date has passed'],['set','is filled'],['empty','is empty']];
  return t==='_status'||t==='_assignee'||t==='_priority'||t==='dropdown'||t==='person'?[['in','is any of'],['set','is filled'],['empty','is empty']]
    :t==='number'||t==='currency'?NUM
    :t==='date'?DTE
    :t==='time'?[['equals','equals'],['set','is filled'],['empty','is empty']]
    :t==='checkbox'?[['checked','is checked'],['unchecked','is not checked']]
    :TXT;
}
function _crmFieldVal(c,fid){
  if(fid==='_status')return c.status||'Open';
  if(fid==='_assignee')return c.assignedTo||'';
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
  if(f.op==='in'){
    var choices=[];
    if(fd.type==='_status'){choices=_crmStatuses(board).map(function(s){return[s.name,s.name];});}
    else if(fd.type==='_priority'){choices=['Low','Medium','High','Critical'].map(function(p){return[p,p];});}
    else if(fd.type==='_assignee'){choices=[['','(Unassigned)']].concat(_crmBoardPeople(board).map(function(u){return[u.id,fullName(u)];}));}
    else if(fd.type==='person'){choices=_crmBoardPeople(board).map(function(u){return[u.id,fullName(u)];});}
    else{choices=(fd.options||[]).map(function(o){return[String(o),String(o)];});}
    var sel=Array.isArray(f.value)?f.value:[];
    return'<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:6px">'+(choices.length?choices.map(function(ch){var on=sel.indexOf(ch[0])>=0;return'<button type="button" onclick="App._crmFValTog('+i+',\''+String(ch[0]).replace(/'/g,"\\'")+'\')" style="padding:4px 11px;border-radius:20px;border:1.5px solid '+(on?'#8B6B41':'#E5E7EB')+';background:'+(on?'#F5EEE1':'#fff')+';color:'+(on?'#54433C':'#6B7280')+';font-size:11.5px;font-weight:700;cursor:pointer">'+esc(ch[1])+'</button>';}).join(''):'<span style="font-size:11.5px;color:#9CA3AF">No options for this field.</span>')+'</div>';
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
App._crmFOp=(i,v)=>{var f=CRM._fDraft&&CRM._fDraft[i];if(!f)return;f.op=v;if(v==='in')f.value=Array.isArray(f.value)?f.value:[];App._crmFRr();};
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
  if(!can('crm','views'))return toast('You need the CRM → Filtered views permission','err');
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
App._crmViewTogM=(uid2)=>{var d=CRM._viewEdit;if(!d)return;d.members=d.members||[];var i=d.members.indexOf(uid2);if(i>=0)d.members.splice(i,1);else d.members.push(uid2);var el=document.getElementById('crm-view-cnt');if(el)el.textContent=d.members.length;};
App._crmViewEditRender=()=>{
  var d=CRM._viewEdit;if(!d)return;
  var h=_crmHub(d.hubId);
  var us=(DB.users||[]).filter(function(u){return u&&u.status!=='Disabled';}).sort(function(a,b2){return fullName(a).localeCompare(fullName(b2));});
  modalShell({title:(d._new?'New filtered view':'Edit view')+(h?' — '+esc(h.name):''),sub:'Exactly the same boards as the hub — but each board can carry a saved filter, and only the people you assign can open it. Edits made inside it update the boards themselves.',size:'max-w-lg',key:'crm-view',
    body:'<label class="ui-label">View name</label><input value="'+esc(d.name||'')+'" oninput="CRM._viewEdit.name=this.value" placeholder="e.g. Night shift — open tickets" class="ui-input" style="margin-bottom:12px"/>'
      +'<div style="display:flex;gap:8px;align-items:flex-start;background:#EEF2FF;border:1px solid #C7D2FE;border-radius:10px;padding:9px 12px;margin-bottom:12px;font-size:12px;color:#4338CA;line-height:1.5">'+ic('filter','w-3.5 h-3.5')+'<span>The view opens with <b>all of '+(h?esc(h.name):'the hub')+'\u2019s boards as tabs</b>. Set each board\u2019s filter from inside the view — the <b>'+(d._new?'Set view filter':'View filter')+'</b> button on every ticket board saves onto this view.</span></div>'
      +'<label class="ui-label">Who can see this view (<span id="crm-view-cnt">'+((d.members||[]).length)+'</span>)</label>'
      +'<input placeholder="Search people…" oninput="var q=this.value.toLowerCase();document.querySelectorAll(\'.crm-vw-row\').forEach(function(r){r.style.display=(r.getAttribute(\'data-n\')||\'\').indexOf(q)>=0?\'flex\':\'none\';})" class="ui-input" style="margin-bottom:8px"/>'
      +'<div style="max-height:190px;overflow:auto;border:1px solid var(--c-border);border-radius:10px;padding:6px">'+us.map(function(u){return'<label class="crm-vw-row" data-n="'+esc(fullName(u).toLowerCase())+'" style="display:flex;align-items:center;gap:8px;font-size:12.5px;padding:3px 2px;cursor:pointer"><input type="checkbox" '+(((d.members||[]).indexOf(u.id)>=0)?'checked':'')+' onchange="App._crmViewTogM(\''+u.id+'\')"/>'+avatar(u,'w-5 h-5','text-[8px]')+esc(fullName(u))+(u.id===S.uid?' <span style="font-size:10px;color:var(--c-text-3)">(you)</span>':'')+'</label>';}).join('')+'</div>'
      +'<div style="font-size:11px;color:var(--c-text-3);margin-top:6px">You (the creator) and CRM managers always see it. Assigned people see all of this hub\u2019s boards through the view — filtered — even if they are not members of those boards.</div>',
    footer:(d._new?'':'<button onclick="App._crmDelView(\''+d.id+'\')" class="ui-btn ui-btn-danger ui-btn-sm" style="margin-right:auto">Delete view</button>')+btnG('Cancel','App.closeModal()')+btnP(d._new?'Create view':'Save view','App._crmViewSave()')});
};
App._crmViewSave=()=>{
  if(!can('crm','views'))return toast('You need the CRM → Filtered views permission','err');
  var d=CRM._viewEdit;if(!d)return;
  var name=String(d.name||'').trim();if(!name)return toast('Name the view','err');
  var flt=(d.filters&&!Array.isArray(d.filters))?d.filters:{};
  var rec={id:d.id,hubId:d.hubId,name:name,filters:flt,members:(d.members||[]).slice(),createdBy:d.createdBy||S.uid||null,sort:d.sort||(CRM.views||[]).length};
  if(!CRM.views)CRM.views=[];
  var i=CRM.views.findIndex(function(v){return v.id===rec.id;});
  if(i>=0)CRM.views[i]=rec;else CRM.views.push(rec);
  var isNew=!!d._new;
  CRM._viewEdit=null;
  CRM.sel.hubId=rec.hubId;CRM.sel.viewId=rec.id;CRM.sel.convoId=null;CRM.sel.threadId=null;
  var b=_crmBoard(CRM.sel.boardId);if(!b||b.hubId!==rec.hubId){var fb=CRM.boards.filter(function(x){return x.hubId===rec.hubId;})[0];CRM.sel.boardId=fb?fb.id:null;}
  closeModal();rr();
  sbWrite({table:'crm_views',op:'upsert',id:rec.id,values:{id:rec.id,hub_id:rec.hubId,board_id:null,name:rec.name,filters:rec.filters,members:rec.members,created_by:rec.createdBy,sort:rec.sort},opts:{onConflict:'id'}},{label:'Filtered view'});
  _crmLog('saved view',null,name);
  toast(isNew?'View created ✓ — now use “Set view filter” on each board tab':'View saved ✓');
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
    body:'<button onclick="App.closeModal();App._crmNewBoard(\''+hubId+'\')" style="width:100%;text-align:left;display:flex;align-items:center;gap:11px;padding:13px;border:1.5px solid var(--c-border);border-radius:13px;background:#fff;cursor:pointer;margin-bottom:9px"><span style="width:36px;height:36px;border-radius:10px;background:#F5EEE1;color:#8B6B41;display:grid;place-items:center;flex-shrink:0">'+ic('ticket','w-4 h-4')+'</span><span><span style="display:block;font-size:13.5px;font-weight:800;color:#13171B">New board</span><span style="display:block;font-size:11.5px;color:#9CA3AF;margin-top:1px">A chat or a ticket table with its own columns & members</span></span></button>'
      +'<button onclick="App.closeModal();App._crmNewView(\''+hubId+'\')" style="width:100%;text-align:left;display:flex;align-items:center;gap:11px;padding:13px;border:1.5px solid var(--c-border);border-radius:13px;background:#fff;cursor:pointer"><span style="width:36px;height:36px;border-radius:10px;background:#EEF2FF;color:#4338CA;display:grid;place-items:center;flex-shrink:0">'+ic('filter','w-4 h-4')+'</span><span><span style="display:block;font-size:13.5px;font-weight:800;color:#13171B">New filtered view</span><span style="display:block;font-size:11.5px;color:#9CA3AF;margin-top:1px">Same boards as the hub, with saved filters — visible only to the people you assign</span></span></button>'});
};

// ===== CRM ticket-board views: view switcher + KANBAN (v2) + TABLE (dynamic columns) =====
function _crmViewBar(board){
  var rows=CRM.convos.filter(function(c){return c.boardId===board.id;});
  var flt=(CRM.boardFilter||{})[board.id]||[];
  var shown=flt.length?_crmApplyFilters(rows,flt).length:rows.length;
  return'<div style="display:flex;align-items:center;gap:8px;padding:9px 14px;border-bottom:1px solid #ECEDF0;background:#FCFCFD;flex-shrink:0;flex-wrap:wrap">'
    +(can('crm','create')?'<button onclick="App._crmRowAddOpen(\''+board.id+'\')" style="display:inline-flex;align-items:center;gap:6px;padding:8px 15px;border-radius:9px;border:none;background:#8B6B41;color:#fff;font-size:12.5px;font-weight:800;cursor:pointer;white-space:nowrap;line-height:1;flex-shrink:0;box-shadow:0 2px 8px rgba(139,107,65,.32)">'+ic('plus','w-3.5 h-3.5')+'New ticket</button>':'')
    +(can('crm','edit')?'<button onclick="App._crmColModal(\''+board.id+'\')" style="display:inline-flex;align-items:center;gap:5px;padding:7px 13px;border-radius:9px;border:1.5px solid #E5E7EB;background:#fff;color:#6B7280;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;line-height:1;flex-shrink:0">'+ic('plus','w-3.5 h-3.5')+'Column</button>':'')
    +((can('crm','manage')||can('crm','edit'))?'<button onclick="App._crmStatusEditor(\''+board.id+'\')" title="Add, rename, recolor this board’s statuses" style="display:inline-flex;align-items:center;gap:5px;padding:7px 13px;border-radius:9px;border:1.5px solid #E5E7EB;background:#fff;color:#6B7280;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;line-height:1;flex-shrink:0">'+ic('approve','w-3.5 h-3.5')+'Statuses</button>':'')
    +'<button onclick="App._crmBoardFilter(\''+board.id+'\')" title="Filter tickets — every column is filterable" style="display:inline-flex;align-items:center;gap:5px;padding:7px 13px;border-radius:9px;border:1.5px solid '+(flt.length?'#8B6B41':'#E5E7EB')+';background:'+(flt.length?'#F5EEE1':'#fff')+';color:'+(flt.length?'#54433C':'#6B7280')+';font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;line-height:1;flex-shrink:0">'+ic('filter','w-3.5 h-3.5')+(flt.length?'Filtered · '+flt.length:'Filter')+'</button>'
    +'<span style="flex:1"></span>'
    +((can('crm','manage')||can('crm','edit'))?'<button onclick="App._crmAutomations(\''+board.id+'\')" title="Automations & reminders" style="display:inline-flex;align-items:center;gap:5px;padding:7px 13px;border-radius:9px;border:1.5px solid #D1B68F;background:#F5EEE1;color:#54433C;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;line-height:1;flex-shrink:0">'+ic('flag','w-3.5 h-3.5')+'Automations</button>':'')
    +'<span style="font-size:11.5px;color:#6B7280;font-weight:600">'+(flt.length?shown+' of '+rows.length:rows.length)+' ticket'+(rows.length===1?'':'s')+'</span>'
  +'</div>';
}
/* v3.12.1: bar shown on a ticket board INSIDE a filtered view — identical to the board bar,
   but the Filter button edits & SAVES the view's conditions for this board (view editors only). */
function _crmViewBarV(board,view){
  var rows=CRM.convos.filter(function(c){return c.boardId===board.id;});
  var vf=_crmViewFilters(view,board.id);
  var shown=vf.length?_crmApplyFilters(rows,vf).length:rows.length;
  var canEdV=_crmViewCanEdit(view);
  return'<div style="display:flex;align-items:center;gap:8px;padding:9px 14px;border-bottom:1px solid #ECEDF0;background:#FCFCFD;flex-shrink:0;flex-wrap:wrap">'
    +(can('crm','create')?'<button onclick="App._crmRowAddOpen(\''+board.id+'\')" style="display:inline-flex;align-items:center;gap:6px;padding:8px 15px;border-radius:9px;border:none;background:#8B6B41;color:#fff;font-size:12.5px;font-weight:800;cursor:pointer;white-space:nowrap;line-height:1;flex-shrink:0;box-shadow:0 2px 8px rgba(139,107,65,.32)">'+ic('plus','w-3.5 h-3.5')+'New ticket</button>':'')
    +(can('crm','edit')?'<button onclick="App._crmColModal(\''+board.id+'\')" style="display:inline-flex;align-items:center;gap:5px;padding:7px 13px;border-radius:9px;border:1.5px solid #E5E7EB;background:#fff;color:#6B7280;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;line-height:1;flex-shrink:0">'+ic('plus','w-3.5 h-3.5')+'Column</button>':'')
    +((can('crm','manage')||can('crm','edit'))?'<button onclick="App._crmStatusEditor(\''+board.id+'\')" title="Add, rename, recolor this board\u2019s statuses" style="display:inline-flex;align-items:center;gap:5px;padding:7px 13px;border-radius:9px;border:1.5px solid #E5E7EB;background:#fff;color:#6B7280;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;line-height:1;flex-shrink:0">'+ic('approve','w-3.5 h-3.5')+'Statuses</button>':'')
    +(canEdV
      ?'<button onclick="App._crmViewFilterOpen(\''+view.id+'\',\''+board.id+'\')" title="Set this view\u2019s saved filter for this board — every column is filterable" style="display:inline-flex;align-items:center;gap:5px;padding:7px 13px;border-radius:9px;border:1.5px solid '+(vf.length?'#4338CA':'#E5E7EB')+';background:'+(vf.length?'#EEF2FF':'#fff')+';color:'+(vf.length?'#4338CA':'#6B7280')+';font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;line-height:1;flex-shrink:0">'+ic('filter','w-3.5 h-3.5')+(vf.length?'View filter \u00b7 '+vf.length:'Set view filter')+'</button>'
      :(vf.length?'<span style="display:inline-flex;align-items:center;gap:5px;padding:7px 13px;border-radius:9px;background:#EEF2FF;color:#4338CA;font-size:12px;font-weight:700;white-space:nowrap;line-height:1;flex-shrink:0">'+ic('filter','w-3.5 h-3.5')+vf.length+' condition'+(vf.length===1?'':'s')+'</span>':''))
    +'<span style="flex:1"></span>'
    +(canEdV?'<button onclick="App._crmEditView(\''+view.id+'\')" title="Rename the view / change who sees it" style="display:inline-flex;align-items:center;gap:5px;padding:7px 13px;border-radius:9px;border:1.5px solid #E5E7EB;background:#fff;color:#6B7280;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;line-height:1;flex-shrink:0">'+ic('edit','w-3.5 h-3.5')+'Edit view</button>':'')
    +((can('crm','manage')||can('crm','edit'))?'<button onclick="App._crmAutomations(\''+board.id+'\')" title="Automations & reminders" style="display:inline-flex;align-items:center;gap:5px;padding:7px 13px;border-radius:9px;border:1.5px solid #D1B68F;background:#F5EEE1;color:#54433C;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;line-height:1;flex-shrink:0">'+ic('flag','w-3.5 h-3.5')+'Automations</button>':'')
    +'<span style="font-size:11.5px;color:#6B7280;font-weight:600">'+(vf.length?shown+' of '+rows.length:rows.length)+' ticket'+(rows.length===1?'':'s')+'</span>'
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
App._crmSetView=(boardId,v)=>{CRM._kbAdd=null;if(!CRM.boardView)CRM.boardView={};CRM.boardView[boardId]=v;try{localStorage.setItem('bridge_crm_views',JSON.stringify(CRM.boardView));}catch(e){}rr();};
/* ── v3: per-board status editor ── */
App._crmStatusEditor=(boardId)=>{
  if(!(can('crm','manage')||can('crm','edit')))return toast('No permission','err');
  var b=_crmBoard(boardId||CRM.sel.boardId);if(!b)return;
  CRM._stEdit=JSON.parse(JSON.stringify(_crmStatuses(b)));CRM._stBoard=b.id;
  App._crmStatusEditorRender();
};
App._crmStatusEditorRender=()=>{
  var rows=(CRM._stEdit||[]).map(function(st,i){return '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">'
    +'<input type="color" value="'+esc(st.color||'#9C9184')+'" onchange="CRM._stEdit['+i+'].color=this.value" style="width:36px;height:36px;border:1px solid var(--c-border);border-radius:9px;padding:2px;cursor:pointer;background:#fff"/>'
    +'<input value="'+esc(st.name||'')+'" oninput="CRM._stEdit['+i+'].name=this.value" class="ui-input" style="flex:1;min-height:36px;padding:7px 10px;font-size:13px"/>'
    +'<label title="Counts as done (not overdue, not open)" style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:var(--c-text-2);cursor:pointer;flex-shrink:0"><input type="checkbox" '+(st.done?'checked':'')+' onchange="CRM._stEdit['+i+'].done=this.checked"/>done</label>'
    +'<button onclick="CRM._stEdit.splice('+i+',1);App._crmStatusEditorRender()" '+((CRM._stEdit||[]).length<=1?'disabled style="opacity:.4;cursor:not-allowed;':'style="cursor:pointer;')+'width:30px;height:30px;border:none;border-radius:8px;background:var(--c-danger-soft);color:var(--c-danger);display:grid;place-items:center;flex-shrink:0">'+ic('x','w-3.5 h-3.5')+'</button></div>';}).join('');
  modalShell({title:'Board statuses',sub:'These become the kanban columns and every status dropdown on this board. Drag tickets between them freely.',size:'max-w-md',key:'crm-status-ed',
    body:rows+'<button onclick="CRM._stEdit.push({name:\'New status\',color:\'#8B5CF6\'});App._crmStatusEditorRender()" class="ui-btn ui-btn-ghost ui-btn-sm" style="margin-top:2px">+ Add status</button>'
      +'<p style="font-size:11.5px;color:var(--c-text-3);margin-top:12px;line-height:1.5">Tickets whose status no longer exists after saving are moved to the first status.</p>',
    footer:btnG('Cancel','App.closeModal()')+btnP('Save statuses','App._crmStatusSave()')});
};
App._crmStatusSave=()=>{
  var b=_crmBoard(CRM._stBoard);if(!b)return;
  var st=(CRM._stEdit||[]).map(function(x){return{name:String(x.name||'').trim(),color:x.color||'#9C9184',done:!!x.done};}).filter(function(x){return x.name;});
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
  {v:'setcol',t:'Set a column value…',p:'setcol'},
  {v:'assign',t:'Assign to…',p:'user'},
  {v:'move',t:'Move to board…',p:'board'},
  {v:'comment',t:'Post a comment',p:'text'}
];
function _crmAutos(b){return (b&&b.settings&&b.settings.automations)||[];}
function _crmTrigText(tr){var d=_CRM_TRIG.find(function(x){return x.v===(tr&&tr.type);});if(!d)return'When…';
  if(tr.type==='column'){var b2=_crmBoard(CRM._autoBoard);var col=b2&&((b2.settings&&b2.settings.columns)||[]).find(function(c){return c.id===tr.colId;});var cn=col?col.name:'?';var opTxt={change:'changes',set:'is filled',equals:'= “'+esc(tr.value||'')+'”',contains:'contains “'+esc(tr.value||'')+'”',gt:'> '+esc(tr.value||''),lt:'< '+esc(tr.value||''),past:'date has passed',checked:'becomes checked',unchecked:'becomes unchecked'}[tr.op||'change']||'changes';return'When “'+esc(cn)+'” '+opTxt;}
  var s=d.t;if(tr.type==='status'||tr.type==='priority')s=s.replace('…',' “'+esc(tr.to||'?')+'”');if(tr.type==='due_soon'||tr.type==='stale')s=s.replace('N',(tr.days||1));return s;}
function _crmActText(a){var d=_CRM_ACT.find(function(x){return x.v===(a&&a.type);});if(!d)return'';if(a.type==='notify'){var _pp=(a.users||[]).filter(function(x){return String(x).indexOf('grp:')!==0;}).length;var _gc=(a.users||[]).filter(function(x){return String(x).indexOf('grp:')===0;}).length;var t2='notify '+_pp+' '+(_pp===1?'person':'people');if(_gc)t2+=' + '+_gc+' group'+(_gc===1?'':'s');return t2;}if(a.type==='status')return'set status “'+esc(a.value||'?')+'”';if(a.type==='assign')return'assign to '+(uById(a.value)?esc(fullName(uById(a.value))):'?');if(a.type==='move')return'move to '+(_crmBoard(a.value)?esc(_crmBoardLabel(_crmBoard(a.value))):'?');if(a.type==='comment')return'post a comment';if(a.type==='setcol'){var b3=_crmBoard(CRM._autoBoard);var c3=b3&&((b3.settings&&b3.settings.columns)||[]).find(function(c){return c.id===a.colId;});return'set \u201C'+esc(c3?c3.name:'?')+'\u201D = \u201C'+esc(a.value||'')+'\u201D';}return d.t;}
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
async function _crmDoAct(board,convo,a,rule){var at=new Date().toISOString();try{
  if(a.type==='notify'){var recips=_crmExpandPeople(a.users||[]).filter(function(u){return u&&u!==S.uid;});var txt='⚡ '+((rule&&rule.name)||'Automation')+' — “'+(convo.title||'ticket')+'”';for(var i=0;i<recips.length;i++){if(_crmInappOn('crm_ticket')){var nid=uid('n');try{DB.notifications.unshift({id:nid,userId:recips[i],text:txt,time:at,read:false});}catch(e){}sbWrite({table:'notifications',op:'insert',id:nid,values:{id:nid,user_id:recips[i],text:txt,read:false,created_at:at}},{label:'Automation',silent:true});}if(typeof queueEmail==='function'){try{queueEmail('crm_ticket',recips[i],null,null,{title:convo.title,customer:convo.customer,actor:((rule&&rule.name)||'Automation')});}catch(e){}}}try{_invalidateNotifCache();}catch(e){}}
  else if(a.type==='status'){convo.status=a.value;sbWrite({table:'crm_conversations',op:'update',id:convo.id,match:{col:'id',val:convo.id},values:{status:a.value,updated_at:at}},{label:'Automation status',silent:true});}
  else if(a.type==='assign'){convo.assignedTo=a.value||null;sbWrite({table:'crm_conversations',op:'update',id:convo.id,match:{col:'id',val:convo.id},values:{assigned_to:a.value||null,updated_at:at}},{label:'Automation assign',silent:true});}
  else if(a.type==='move'){var _mtb=_crmBoard(a.value);if(_mtb&&_crmBS(_mtb).type!=='chat'){convo.boardId=a.value;convo.isTicket=true;sbWrite({table:'crm_conversations',op:'update',id:convo.id,match:{col:'id',val:convo.id},values:{board_id:a.value,is_ticket:true,updated_at:at}},{label:'Automation move',silent:true});}}
  else if(a.type==='setcol'){if(a.colId){if(!convo.fields)convo.fields={};convo.fields[a.colId]=a.value;sbWrite({table:'crm_conversations',op:'update',id:convo.id,match:{col:'id',val:convo.id},values:{fields:convo.fields,updated_at:at}},{label:'Automation column',silent:true});var _d=(rule&&rule._ctxDepth)||0;if(_d<2){try{_crmRunAutos(board,'column',convo,{colId:a.colId,value:a.value,_depth:_d+1});}catch(e){}}}}
  else if(a.type==='comment'){var mid=uid('msg');if(!convo.messages)convo.messages=[];convo.messages.push({id:mid,senderId:null,fromCustomer:false,name:'Automation',text:a.text||'',images:[],at:at,reactions:{},parentId:null});convo.lastAt=at;sbWrite({table:'crm_messages',op:'insert',id:mid,values:{id:mid,conversation_id:convo.id,sender_id:null,from_customer:false,name:'Automation',body:a.text||'',created_at:at}},{label:'Automation comment',silent:true});}
}catch(e){console.warn('[CRM auto action]',e&&e.message);}}
async function _crmRunAutos(board,event,convo,ctx){if(!board||!convo)return;var _depth=(ctx&&ctx._depth)||0;if(_depth>=3)return;var list=_crmAutos(board).filter(function(a){return a&&a.enabled!==false&&a.trigger&&a.trigger.type===event;});var ran=false;for(var i=0;i<list.length;i++){var a=list[i];if(!_crmCondOk(convo,a.trigger,ctx))continue;a._ctxDepth=_depth;for(var j=0;j<(a.actions||[]).length;j++){await _crmDoAct(board,convo,a.actions[j],a);ran=true;}if((a.actions||[]).length){try{_crmLog('automation',convo,a.name||event);}catch(e){}}}if(ran)rr();}
function _crmCheckReminders(){try{var today=todayISO();var key='bridge_crm_rem';var fired={};try{fired=JSON.parse(localStorage.getItem(key)||'{}');}catch(e){fired={};}(CRM.boards||[]).forEach(function(b){var autos=_crmAutos(b).filter(function(a){return a&&a.enabled!==false&&a.trigger&&(a.trigger.type==='stale'||(a.trigger.type==='column'&&a.trigger.op==='past'));});if(!autos.length)return;CRM.convos.filter(function(c){return c.boardId===b.id&&c.isTicket&&!_crmIsDone(b,c.status);}).forEach(function(c){autos.forEach(function(a){var tr=a.trigger,hit=false;if(tr.type==='stale'){var last=c.lastAt||c.createdAt;if(last){var days=Math.floor((Date.now()-new Date(last))/86400000);hit=days>=(tr.days||3);}}else if(tr.type==='column'){var cv=(c.fields||{})[tr.colId];hit=!!cv&&String(cv)<today;}if(!hit)return;var fk=a.id+'|'+c.id+'|'+today;if(fired[fk])return;fired[fk]=1;(a.actions||[]).forEach(function(act){_crmDoAct(b,c,act,a);});try{_crmLog('reminder',c,a.name||tr.type);}catch(e){}});});});try{localStorage.setItem(key,JSON.stringify(fired));}catch(e){}
  // ── personal ⏰ reminders (date+time) — in-app + email when due; server cron also fires when app is closed ──
  var nowIso=new Date().toISOString();
  (CRM.reminders||[]).filter(function(r){return !r.fired&&r.userId===S.uid&&r.remindAt&&r.remindAt<=nowIso;}).forEach(function(r){
    r.fired=true;
    try{sb.from('crm_reminders').update({fired:true,fired_at:nowIso}).eq('id',r.id).eq('fired',false);}catch(e){}
    var c=_crmConvo(r.conversationId);var txt='⏰ Reminder: '+(r.note||(c&&c.title)||'CRM ticket');
    if(_crmInappOn('crm_reminder')){var nid=uid('n');try{DB.notifications.unshift({id:nid,userId:S.uid,text:txt,time:nowIso,read:false});}catch(e){}
    try{sb.from('notifications').insert({id:nid,user_id:S.uid,text:txt,read:false,created_at:nowIso});}catch(e){}}
    if(typeof queueEmail==='function'){try{queueEmail('crm_reminder',S.uid,null,null,{title:(c&&c.title)||'',note:r.note||(c&&c.title)||'CRM'});}catch(e){}}
    try{toast(txt);}catch(e){}try{_invalidateNotifCache();}catch(e){}
  });
  CRM.reminders=(CRM.reminders||[]).filter(function(r){return !r.fired;});}catch(e){console.warn('[CRM reminders]',e&&e.message);}}
App._crmAutomations=(boardId)=>{if(!(can('crm','manage')||can('crm','edit')))return toast('No permission','err');var b=_crmBoard(boardId||CRM.sel.boardId);if(!b)return;CRM._autoBoard=b.id;CRM._autoEdit=null;App._crmAutoRender();};
App._crmAutoRender=()=>{var b=_crmBoard(CRM._autoBoard);if(!b)return;if(CRM._autoEdit)return App._crmAutoEditRender();var autos=_crmAutos(b);
  var list=autos.length?autos.map(function(a){return '<div style="display:flex;align-items:flex-start;gap:10px;padding:11px 12px;border:1px solid var(--c-border);border-radius:12px;margin-bottom:8px;background:'+(a.enabled===false?'var(--c-surface-2)':'#fff')+'">'
    +'<button onclick="App._crmAutoToggle(\''+a.id+'\')" class="tog'+(a.enabled===false?'':' on')+'" style="margin-top:2px"><span></span></button>'
    +'<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700;color:var(--c-text)">'+esc(a.name||'Untitled rule')+'</div><div style="font-size:12px;color:var(--c-text-2);margin-top:2px;line-height:1.5">'+_crmTrigText(a.trigger)+' → <b>'+((a.actions||[]).map(_crmActText).join('</b>, <b>')||'—')+'</b></div></div>'
    +'<button onclick="App._crmAutoEdit(\''+a.id+'\')" title="Edit" style="border:none;background:var(--c-surface-2);color:var(--c-text-2);width:28px;height:28px;border-radius:8px;cursor:pointer;display:grid;place-items:center">'+ic('edit','w-3.5 h-3.5')+'</button>'
    +'<button onclick="App._crmAutoDel(\''+a.id+'\')" title="Delete" style="border:none;background:var(--c-danger-soft);color:var(--c-danger);width:28px;height:28px;border-radius:8px;cursor:pointer;display:grid;place-items:center">'+ic('trash','w-3.5 h-3.5')+'</button></div>';}).join(''):'<div style="padding:22px;text-align:center;color:var(--c-text-3);font-size:12.5px">No automations yet. Add a rule to email people or update tickets automatically — including due-date reminders.</div>';
  modalShell({title:'Automations — '+esc(b.name),sub:'Run actions automatically when things happen on this board.',size:'max-w-lg',key:'crm-auto',body:list+'<button onclick="App._crmAutoNew()" class="ui-btn ui-btn-brand ui-btn-sm" style="margin-top:4px">+ New rule</button>',footer:btnP('Done','App.closeModal()')});};
App._crmAutoNew=()=>{CRM._autoEdit={id:uid('auto'),name:'',enabled:true,trigger:{type:'created'},actions:[{type:'notify',users:[]}]};App._crmAutoEditRender();};
App._crmAutoEdit=(id)=>{var b=_crmBoard(CRM._autoBoard);var a=_crmAutos(b).find(function(x){return x.id===id;});if(!a)return;CRM._autoEdit=JSON.parse(JSON.stringify(a));App._crmAutoEditRender();};
App._crmAutoBack=()=>{CRM._autoEdit=null;App._crmAutoRender();};
App._crmAutoTrig=(v)=>{var t={type:v};if(v==='column'){var _b=_crmBoard(CRM._autoBoard);var _c=((_b&&_b.settings&&_b.settings.columns)||[])[0];t.colId=_c?_c.id:null;t.op='change';}if(v==='status')t.to=(_crmStatuses(_crmBoard(CRM._autoBoard))[0]||{}).name;if(v==='priority')t.to='High';if(v==='due_soon'||v==='stale')t.days=1;CRM._autoEdit.trigger=t;App._crmAutoEditRender();};
App._crmAutoActType=(i,v)=>{var a={type:v};if(v==='notify')a.users=[];CRM._autoEdit.actions[i]=a;App._crmAutoEditRender();};
App._crmAutoActUser=(i,uid2,on)=>{var a=CRM._autoEdit.actions[i];a.users=a.users||[];var k=a.users.indexOf(uid2);if(on&&k<0)a.users.push(uid2);if(!on&&k>=0)a.users.splice(k,1);};
App._crmAutoEditRender=()=>{var b=_crmBoard(CRM._autoBoard);if(!b)return;var d=CRM._autoEdit;var sts=_crmStatuses(b);var users=_crmBoardPeople(b);var boards=CRM.boards.filter(function(x){return x.id!==b.id&&_crmBoardVisible(x)&&_crmBS(x).type!=='chat';});
  var cols=(b.settings&&b.settings.columns)||[];
  var trig=_CRM_TRIG.find(function(x){return x.v===d.trigger.type;})||_CRM_TRIG[0];var tp='';
  if(trig.p==='column'){
    if(!cols.length){tp='<div style="margin-top:8px;padding:10px 12px;background:var(--c-warn-soft);color:var(--c-warn-ink);border-radius:9px;font-size:12.5px">This board has no columns yet — add a column first, then automate it.</div>';}
    else{
      var tcol=cols.find(function(c){return c.id===d.trigger.colId;})||cols[0];if(!d.trigger.colId)d.trigger.colId=tcol.id;
      var TXT=[['change','changes (any value)'],['equals','equals'],['contains','contains'],['set','is filled']];
      var NUM=[['change','changes (any value)'],['equals','equals (=)'],['gt','is greater than (>)'],['lt','is less than (<)'],['set','is filled']];
      var OPS={text:TXT,longtext:TXT,email:TXT,phone:TXT,url:TXT,number:NUM,currency:NUM,date:[['change','changes (any value)'],['equals','is exactly (date)'],['past','date has passed (checked daily)'],['set','is filled']],time:[['change','changes (any value)'],['equals','equals'],['set','is filled']],dropdown:[['change','changes (any value)'],['equals','becomes'],['set','is filled']],checkbox:[['checked','becomes checked'],['unchecked','becomes unchecked'],['change','changes']],person:[['change','changes (any value)'],['equals','becomes (person)'],['set','is filled']]};
      var ops=OPS[tcol.type]||OPS.text;if(!ops.some(function(o){return o[0]===d.trigger.op;}))d.trigger.op=ops[0][0];
      var needVal=['equals','contains','gt','lt'].indexOf(d.trigger.op)>=0;
      var vIn='';
      if(needVal){
        if(tcol.type==='dropdown')vIn='<select onchange="CRM._autoEdit.trigger.value=this.value" class="ui-select" style="flex:1"><option value="">— pick —</option>'+(tcol.options||[]).map(function(o){return'<option '+(String(o)===String(d.trigger.value)?'selected':'')+'>'+esc(o)+'</option>';}).join('')+'</select>';
        else if(tcol.type==='person')vIn='<select onchange="CRM._autoEdit.trigger.value=this.value" class="ui-select" style="flex:1"><option value="">— pick —</option>'+users.map(function(u){return'<option value="'+u.id+'" '+(String(u.id)===String(d.trigger.value)?'selected':'')+'>'+esc(fullName(u))+'</option>';}).join('')+'</select>';
        else vIn='<input type="'+((tcol.type==='number'||tcol.type==='currency')?'number':tcol.type==='date'?'date':tcol.type==='time'?'time':'text')+'" value="'+esc(d.trigger.value||'')+'" oninput="CRM._autoEdit.trigger.value=this.value" placeholder="value" class="ui-input" style="flex:1"/>';
      }
      tp='<div style="margin-top:8px;display:flex;flex-direction:column;gap:8px">'
        +'<select onchange="CRM._autoEdit.trigger.colId=this.value;CRM._autoEdit.trigger.op=\'change\';CRM._autoEdit.trigger.value=\'\';App._crmAutoEditRender()" class="ui-select">'+cols.map(function(c){return'<option value="'+c.id+'" '+(c.id===d.trigger.colId?'selected':'')+'>'+esc(c.name)+' ('+c.type+')</option>';}).join('')+'</select>'
        +'<div style="display:flex;gap:8px"><select onchange="CRM._autoEdit.trigger.op=this.value;App._crmAutoEditRender()" class="ui-select" style="flex:1">'+ops.map(function(o){return'<option value="'+o[0]+'" '+(o[0]===d.trigger.op?'selected':'')+'>'+o[1]+'</option>';}).join('')+'</select>'+vIn+'</div>'
      +'</div>';
    }
  }
  else if(trig.p==='status')tp='<select onchange="CRM._autoEdit.trigger.to=this.value" class="ui-select" style="margin-top:8px">'+sts.map(function(s){return'<option '+(d.trigger.to===s.name?'selected':'')+'>'+esc(s.name)+'</option>';}).join('')+'</select>';
  else if(trig.p==='priority')tp='<select onchange="CRM._autoEdit.trigger.to=this.value" class="ui-select" style="margin-top:8px">'+['Low','Medium','High','Critical'].map(function(s){return'<option '+(d.trigger.to===s?'selected':'')+'>'+s+'</option>';}).join('')+'</select>';
  else if(trig.p==='days')tp='<div style="margin-top:8px;display:flex;align-items:center;gap:8px"><input type="number" min="1" value="'+esc(d.trigger.days||1)+'" oninput="CRM._autoEdit.trigger.days=+this.value" class="ui-input" style="width:88px"/><span style="font-size:12.5px;color:var(--c-text-2)">day(s)</span></div>';
  var actRows=(d.actions||[]).map(function(a,i){var ad=_CRM_ACT.find(function(x){return x.v===a.type;})||_CRM_ACT[0];var pr='';
    if(ad.p==='users'){var _agg=_crmGroups();pr='<div style="margin-top:7px;max-height:150px;overflow:auto;border:1px solid var(--c-border);border-radius:9px;padding:6px">'+(_agg.length?'<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--c-text-3);padding:2px">Groups</div>'+_agg.map(function(g){return'<label style="display:flex;align-items:center;gap:7px;font-size:12.5px;padding:2px;cursor:pointer;font-weight:700"><input type="checkbox" '+(((a.users||[]).indexOf('grp:'+g.id)>=0)?'checked':'')+' onchange="App._crmAutoActUser('+i+',\'grp:'+g.id+'\',this.checked)"/>'+esc(g.name)+' <span style="font-weight:600;color:var(--c-text-3);font-size:11px">('+((g.members||[]).length)+')</span></label>';}).join('')+'<div style="height:1px;background:var(--c-border);margin:5px 0"></div>':'')+(users.length?users.map(function(u){return'<label style="display:flex;align-items:center;gap:7px;font-size:12.5px;padding:2px;cursor:pointer"><input type="checkbox" '+(((a.users||[]).indexOf(u.id)>=0)?'checked':'')+' onchange="App._crmAutoActUser('+i+',\''+u.id+'\',this.checked)"/>'+esc(fullName(u))+'</label>';}).join(''):'<div style="font-size:12px;color:var(--c-text-3);padding:2px">No members on this board yet.</div>')+'</div>';}
    else if(ad.p==='status')pr='<select onchange="CRM._autoEdit.actions['+i+'].value=this.value" class="ui-select" style="margin-top:7px">'+sts.map(function(s){return'<option '+(a.value===s.name?'selected':'')+'>'+esc(s.name)+'</option>';}).join('')+'</select>';
    else if(ad.p==='user')pr='<select onchange="CRM._autoEdit.actions['+i+'].value=this.value" class="ui-select" style="margin-top:7px"><option value="">— pick —</option>'+users.map(function(u){return'<option value="'+u.id+'" '+(a.value===u.id?'selected':'')+'>'+esc(fullName(u))+'</option>';}).join('')+'</select>';
    else if(ad.p==='board')pr='<select onchange="CRM._autoEdit.actions['+i+'].value=this.value" class="ui-select" style="margin-top:7px"><option value="">— pick —</option>'+boards.map(function(x){return'<option value="'+x.id+'" '+(a.value===x.id?'selected':'')+'>'+esc(_crmBoardLabel(x))+'</option>';}).join('')+'</select>';
    else if(ad.p==='text')pr='<input value="'+esc(a.text||'')+'" oninput="CRM._autoEdit.actions['+i+'].text=this.value" placeholder="Comment text…" class="ui-input" style="margin-top:7px"/>';
    else if(ad.p==='setcol'){
      if(!cols.length)pr='<div style="margin-top:7px;font-size:12px;color:var(--c-warn-ink)">No columns on this board yet.</div>';
      else{var scol=cols.find(function(c){return c.id===a.colId;})||cols[0];if(!a.colId)a.colId=scol.id;
        var sIn;
        if(scol.type==='dropdown')sIn='<select onchange="CRM._autoEdit.actions['+i+'].value=this.value" class="ui-select" style="flex:1"><option value="">—</option>'+(scol.options||[]).map(function(o){return'<option '+(String(o)===String(a.value)?'selected':'')+'>'+esc(o)+'</option>';}).join('')+'</select>';
        else if(scol.type==='checkbox')sIn='<select onchange="CRM._autoEdit.actions['+i+'].value=this.value" class="ui-select" style="flex:1"><option value="1" '+(a.value==='1'?'selected':'')+'>Checked</option><option value="" '+(a.value!=='1'?'selected':'')+'>Unchecked</option></select>';
        else if(scol.type==='person')sIn='<select onchange="CRM._autoEdit.actions['+i+'].value=this.value" class="ui-select" style="flex:1"><option value="">— pick —</option>'+users.map(function(u){return'<option value="'+u.id+'" '+(String(u.id)===String(a.value)?'selected':'')+'>'+esc(fullName(u))+'</option>';}).join('')+'</select>';
        else sIn='<input type="'+((scol.type==='number'||scol.type==='currency')?'number':scol.type==='date'?'date':scol.type==='time'?'time':'text')+'" value="'+esc(a.value||'')+'" oninput="CRM._autoEdit.actions['+i+'].value=this.value" placeholder="value" class="ui-input" style="flex:1"/>';
        pr='<div style="margin-top:7px;display:flex;gap:8px"><select onchange="CRM._autoEdit.actions['+i+'].colId=this.value;CRM._autoEdit.actions['+i+'].value=\'\';App._crmAutoEditRender()" class="ui-select" style="flex:1">'+cols.map(function(c){return'<option value="'+c.id+'" '+(c.id===a.colId?'selected':'')+'>'+esc(c.name)+'</option>';}).join('')+'</select>'+sIn+'</div>';}
    }
    return '<div style="border:1px solid var(--c-border);border-radius:11px;padding:10px;margin-bottom:8px"><div style="display:flex;gap:8px;align-items:center"><select onchange="App._crmAutoActType('+i+',this.value)" class="ui-select" style="flex:1">'+_CRM_ACT.map(function(x){return'<option value="'+x.v+'" '+(a.type===x.v?'selected':'')+'>'+x.t+'</option>';}).join('')+'</select>'+(d.actions.length>1?'<button onclick="CRM._autoEdit.actions.splice('+i+',1);App._crmAutoEditRender()" style="border:none;background:var(--c-danger-soft);color:var(--c-danger);width:34px;height:34px;border-radius:8px;cursor:pointer;display:grid;place-items:center;flex-shrink:0">'+ic('x','w-3.5 h-3.5')+'</button>':'')+'</div>'+pr+'</div>';}).join('');
  modalShell({title:(d.name?esc(d.name):'New rule'),sub:'Pick a trigger, then one or more actions.',size:'max-w-lg',key:'crm-auto',
    body:'<label class="ui-label">Rule name</label><input value="'+esc(d.name||'')+'" oninput="CRM._autoEdit.name=this.value" placeholder="e.g. Email support team when overdue" class="ui-input" style="margin-bottom:14px"/>'
      +'<label class="ui-label">When… (trigger)</label><select onchange="App._crmAutoTrig(this.value)" class="ui-select">'+_CRM_TRIG.map(function(x){return'<option value="'+x.v+'" '+(d.trigger.type===x.v?'selected':'')+'>'+x.t+'</option>';}).join('')+'</select>'+tp
      +'<div style="height:16px"></div><label class="ui-label">Then… (actions)</label>'+actRows+'<button onclick="CRM._autoEdit.actions.push({type:\'notify\',users:[]});App._crmAutoEditRender()" class="ui-btn ui-btn-ghost ui-btn-sm">+ Add action</button>',
    footer:btnG('Back','App._crmAutoBack()')+btnP('Save rule','App._crmAutoSave()')});};
App._crmAutoSave=()=>{var b=_crmBoard(CRM._autoBoard);if(!b)return;var d=CRM._autoEdit;if(!d)return;if(!d.name||!d.name.trim())return toast('Name your rule','err');if(!d.actions||!d.actions.length)return toast('Add at least one action','err');if(!b.settings)b.settings={};d.name=d.name.trim();var list=(b.settings.automations||[]).slice();var i=list.findIndex(function(x){return x.id===d.id;});if(i>=0)list[i]=d;else list.push(d);b.settings.automations=list;CRM._autoEdit=null;App._crmAutoRender();sbWrite({table:'crm_boards',op:'update',id:b.id,match:{col:'id',val:b.id},values:{settings:b.settings}},{label:'Automation'});toast('Rule saved ✓');};
App._crmAutoToggle=(id)=>{var b=_crmBoard(CRM._autoBoard);if(!b)return;var a=_crmAutos(b).find(function(x){return x.id===id;});if(!a)return;a.enabled=a.enabled===false;App._crmAutoRender();sbWrite({table:'crm_boards',op:'update',id:b.id,match:{col:'id',val:b.id},values:{settings:b.settings}},{label:'Automation'});};
App._crmAutoDel=async(id)=>{var b=_crmBoard(CRM._autoBoard);if(!b)return;if(!(await _crmConfirmP('Delete automation','This rule stops running immediately.','Delete rule'))){App._crmAutoRender();return;}b.settings.automations=_crmAutos(b).filter(function(x){return x.id!==id;});App._crmAutoRender();sbWrite({table:'crm_boards',op:'update',id:b.id,match:{col:'id',val:b.id},values:{settings:b.settings}},{label:'Automation'});};
App._crmTogDetails=()=>{CRM.detailsOpen=CRM.detailsOpen===false?true:false;rr();};
function _crmKanban(board){
  var canEd=can('crm','edit');
  var q=(CRM.search||'').trim().toLowerCase();
  var rows=CRM.convos.filter(function(c){return c.boardId===board.id;});
  if(q)rows=rows.filter(function(c){return((c.title||'')+' '+(c.customer||'')).toLowerCase().indexOf(q)>=0;});
  var STS=_crmStatuses(board).slice();
  var _known={};STS.forEach(function(x){_known[x.name]=1;});
  if(rows.some(function(c){return !_known[c.status||'Open'];}))STS.push({name:'(other)',color:'#9CA3AF',_other:true});
  var colHtml=STS.map(function(cd){
    var st=cd.name,clr=cd.color,bg=cd.color+'1A';
    var cards=rows.filter(function(c){return cd._other?!_known[c.status||'Open']:(c.status||'Open')===st;}).sort(function(a,b){return String(b.lastAt||'').localeCompare(String(a.lastAt||''));});
    var cardsHtml=cards.map(function(c){
      var asgU=c.assignedTo?uById(c.assignedTo):null;
      var pr=_crmPri[c.priority]||_crmPri.Medium;
      var due=_crmDueMeta(c);
      var unread=_crmUnread(c);
      return'<div draggable="'+(canEd?'true':'false')+'" ondragstart="App._crmKbDragStart(event,\''+c.id+'\')" onclick="App._crmSelConvo(\''+c.id+'\')" style="background:#fff;border:1.5px solid '+(unread?'#D1B68F':'#ECEDF0')+';border-radius:12px;padding:11px 12px;box-shadow:0 1px 2px rgba(16,24,40,.05);cursor:'+(canEd?'grab':'pointer')+'">'
        +'<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">'+_crmCustAv(c.customer,22)+'<span style="font-size:11px;font-weight:700;color:#6B7280;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(c.customer||'\u2014')+'</span>'+(unread?'<span style="width:7px;height:7px;border-radius:50%;background:#8B6B41"></span>':'')+'</div>'
        +'<div style="font-size:13px;font-weight:700;color:#13171B;line-height:1.35;margin-bottom:8px">'+esc(c.title||'\u2014')+'</div>'
        +'<div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap">'
          +'<span style="font-size:9.5px;font-weight:800;color:'+pr[0]+';background:'+pr[1]+';border-radius:5px;padding:1px 6px">'+esc(c.priority||'Medium')+'</span>'
          +(c.ticketType?'<span style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#4338CA;background:#EEF2FF;border-radius:5px;padding:1px 5px">'+esc(c.ticketType)+'</span>':'')
          +(due?'<span style="font-size:9.5px;font-weight:800;color:'+due.color+';background:'+due.bg+';border-radius:5px;padding:1px 6px">'+(due.overdue?'\u26A0 ':'')+due.label+'</span>':'')
          +'<span style="flex:1"></span>'
          +(asgU?'<span title="Assigned to '+esc(fullName(asgU))+'">'+avatar(asgU,'w-[20px] h-[20px]','text-[8px]')+'</span>':'')
        +'</div>'
      +'</div>';
    }).join('');
    var addUI='';
    if(!cd._other&&canEd&&can('crm','create')){
      addUI=(CRM._kbAdd===st)
        ?'<div style="background:#fff;border:1.5px solid #D1B68F;border-radius:12px;padding:10px 10px 8px;display:flex;flex-direction:column;gap:6px">'
          +'<input id="kb-new-title" placeholder="Ticket title" style="border:1px solid #E5E7EB;border-radius:8px;padding:7px 8px;font-size:12.5px;outline:none" onkeydown="if(event.key===\'Enter\')App._crmKbCreate(\''+encodeURIComponent(st)+'\')"/>'
          +'<input id="kb-new-cust" placeholder="Customer (optional)" style="border:1px solid #E5E7EB;border-radius:8px;padding:7px 8px;font-size:12.5px;outline:none" onkeydown="if(event.key===\'Enter\')App._crmKbCreate(\''+encodeURIComponent(st)+'\')"/>'
          +'<div style="display:flex;gap:6px;justify-content:flex-end"><button onclick="CRM._kbAdd=null;rr()" style="border:1px solid #E5E7EB;background:#fff;border-radius:8px;padding:5px 10px;font-size:11.5px;font-weight:700;cursor:pointer">Cancel</button><button onclick="App._crmKbCreate(\''+encodeURIComponent(st)+'\')" style="border:none;background:#8B6B41;color:#fff;border-radius:8px;padding:5px 12px;font-size:11.5px;font-weight:800;cursor:pointer">Add</button></div></div>'
        :'<button onclick="App._crmKbAddOpen(\''+encodeURIComponent(st)+'\')" style="border:1.5px dashed #D9DCE1;background:transparent;border-radius:11px;padding:8px;font-size:12px;font-weight:700;color:#9C9184;cursor:pointer">+ New</button>';
    }
    return'<div ondragover="App._crmKbDragOver(event)" ondragleave="App._crmKbLeave(event)" ondrop="App._crmKbDrop(event,\''+encodeURIComponent(st)+'\')" data-kbcol="'+esc(st)+'" style="flex:1;min-width:230px;max-width:330px;display:flex;flex-direction:column;background:#F5F3EF;border:1.5px solid #EEEFF2;border-radius:14px;min-height:0">'
      +'<div style="display:flex;align-items:center;gap:7px;padding:11px 13px;flex-shrink:0"><span style="width:8px;height:8px;border-radius:50%;background:'+clr+'"></span><span style="font-size:12px;font-weight:800;color:#374151">'+st+'</span><span style="font-size:11px;font-weight:800;color:'+clr+';background:'+bg+';border-radius:9px;min-width:18px;height:18px;display:inline-grid;place-items:center;padding:0 5px">'+cards.length+'</span></div>'
      +'<div class="crm-scroll" style="flex:1;overflow-y:auto;padding:0 9px 10px;display:flex;flex-direction:column;gap:8px;min-height:40px">'+addUI+(cardsHtml||'<div style="border:1.5px dashed #E2E4E8;border-radius:11px;padding:16px;text-align:center;font-size:11.5px;color:#B8B5AC">Drop tickets here</div>')+'</div>'
    +'</div>';
  }).join('');
  return'<div class="crm-scroll" style="flex:1;overflow:auto;background:#FBFBFC;min-height:0"><div style="display:flex;gap:10px;padding:12px 14px;min-height:100%;align-items:stretch">'+colHtml+'</div></div>';
}
App._crmKbDragStart=(e,id)=>{try{e.dataTransfer.setData('text/plain',id);e.dataTransfer.effectAllowed='move';}catch(x){}CRM._dragId=id;};
App._crmKbDragOver=(e)=>{e.preventDefault();var col=e.currentTarget;col.style.background='#F8F5EE';col.style.borderColor='#D1B68F';};
App._crmKbLeave=(e)=>{var col=e.currentTarget;col.style.background='#F5F3EF';col.style.borderColor='#EEEFF2';};
App._crmKbDrop=(e,status)=>{e.preventDefault();status=decodeURIComponent(status);if(status==='(other)')return;var col=e.currentTarget;col.style.background='#F5F3EF';col.style.borderColor='#EEEFF2';var id=null;try{id=e.dataTransfer.getData('text/plain');}catch(x){}id=id||CRM._dragId;CRM._dragId=null;if(!id)return;var c=_crmConvo(id);if(!c||c.status===status)return;if(!can('crm','edit'))return toast('No permission','err');App._crmSetStatus(id,status);toast('Moved to '+status+' \u2713');};
App._crmKbAddOpen=(st)=>{CRM._kbAdd=decodeURIComponent(st);rr();setTimeout(function(){var e=document.getElementById('kb-new-title');if(e)e.focus();},40);};
App._crmKbCreate=async(st)=>{
  st=decodeURIComponent(st);
  if(!can('crm','create'))return toast('No permission to create','err');
  var b=_crmBoard(CRM.sel.boardId);if(!b)return;
  var tt=document.getElementById('kb-new-title'),cu=document.getElementById('kb-new-cust');
  var title=(tt?tt.value:'').trim();if(!title)return toast('Give it a title','err');
  var name=(cu?cu.value:'').trim()||'—';
  var id=uid('cv');var now=new Date().toISOString();var _isTk=_crmBS(b).type!=='chat';
  var c={id:id,boardId:b.id,title:title,customer:name,channel:'Manual',isTicket:_isTk,ticketType:(_isTk?'Ticket':null),priority:'Medium',status:st,assignedTo:null,createdBy:S.uid||null,createdAt:now,lastAt:now,messages:[],fields:{},dueDate:null};
  CRM.convos.push(c);CRM._kbAdd=null;toast('Added to '+st+' \u2713');rr();
  _crmLog('created',c,'in '+st);
  sbWrite({table:'crm_conversations',op:'insert',id:id,values:{id:id,board_id:b.id,title:title,customer:name,channel:'Manual',is_ticket:_isTk,ticket_type:(_isTk?'Ticket':null),priority:'Medium',status:st,created_by:S.uid||null,created_at:now,last_at:now,updated_at:now}},{label:'New ticket'});
  _crmNotifyRule('created',c,b,'crm_ticket',{title:title,type:b.name,customer:name,actor:(me()?fullName(me()):'')});try{_crmRunAutos(b,'created',c,{});}catch(e){}
};
// ===== CRM ticket-board TABLE view (dynamic columns) =====
async function _crmNotifyEvent(board,event,convo,emailType,vars){var list=_crmExpandPeople((board&&board.settings&&board.settings.notify&&board.settings.notify[event])||[]).filter(function(u){return u!==S.uid;});if(!list.length)return;var who=me()?fullName(me()):'Someone';var at=new Date().toISOString();var label=event==='approved'?'✅ Approved':event==='rejected'?'❌ Rejected':event==='moved'?'↪ Moved':'🔔 Update';var txt=label+': "'+(convo.title||'')+'" by '+who;for(var i=0;i<list.length;i++){if(_crmInappOn('crm_ticket')){var nid=uid('n');try{DB.notifications.unshift({id:nid,userId:list[i],text:txt,time:at,read:false});}catch(e){}try{await sb.from('notifications').insert({id:nid,user_id:list[i],text:txt,read:false,created_at:at});}catch(e){}}if(emailType&&typeof queueEmail==='function'){try{queueEmail(emailType,list[i],null,null,vars||{});}catch(e){}}}try{_invalidateNotifCache();}catch(e){}}
function _crmRowStatus(r,board){board=board||_crmBoard(r.boardId);if(can('crm','edit'))return _crmStatusSel(board,r);return _crmStatusChip(board,r.status||'Open');}
/* ── Built-in Assignee cell for the table view (respects crm→assign; people = board members) ── */
function _crmAsgCell(r,board){
  var u=r.assignedTo?uById(r.assignedTo):null;
  if(!can('crm','assign'))return u?'<span style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:#374151;padding:5px 7px">'+avatar(u,'w-5 h-5','text-[8px]')+esc(fullName(u))+'</span>':'<span style="color:#B8B5AC;padding:5px 7px;font-size:12.5px">—</span>';
  var st='width:100%;box-sizing:border-box;border:1px solid transparent;background:transparent;border-radius:6px;padding:5px 7px;font-size:12.5px;outline:none;color:#13171B;cursor:pointer';
  var us=_crmBoardPeople(board);if(u&&!us.some(function(x){return x.id===u.id;}))us=us.concat([u]);
  return'<select class="crm-cell" onchange="App._crmAssign(\''+r.id+'\',this.value)" style="'+st+'"><option value="">Unassigned</option>'+us.map(function(x){return'<option value="'+x.id+'" '+(String(x.id)===String(r.assignedTo||'')?'selected':'')+'>'+esc(fullName(x))+'</option>';}).join('')+'</select>';
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
function _crmCell(r,col){
  var v=(r.fields&&r.fields[col.id]!=null)?r.fields[col.id]:'';
  var b='width:100%;box-sizing:border-box;border:1px solid transparent;background:transparent;border-radius:6px;padding:5px 7px;font-size:12.5px;outline:none;color:#13171B';
  var oc='class="crm-cell" onchange="App._crmSetCell(\''+r.id+'\',\''+col.id+'\',this.value)"';
  if(col.type==='number')return'<input type="number" value="'+esc(v)+'" '+oc+' style="'+b+'" placeholder="0"/>';
  if(col.type==='currency')return'<input type="number" step="0.01" value="'+esc(v)+'" '+oc+' style="'+b+'" placeholder="0.00"/>';
  if(col.type==='date')return'<input type="date" value="'+esc(v)+'" '+oc+' style="'+b+'"/>';
  if(col.type==='time')return'<input type="time" value="'+esc(v)+'" '+oc+' style="'+b+'"/>';
  if(col.type==='checkbox')return'<div style="display:flex;justify-content:center"><input type="checkbox" '+((v==='1'||v===true)?'checked':'')+' onchange="App._crmSetCell(\''+r.id+'\',\''+col.id+'\',this.checked?\'1\':\'\')" style="width:16px;height:16px;accent-color:#8B6B41;cursor:pointer"/></div>';
  if(col.type==='person'){var us=_crmBoardPeople(_crmBoard(r.boardId));if(v&&!us.some(function(u){return String(u.id)===String(v);})&&uById(v))us=us.concat([uById(v)]);return'<select '+oc+' style="'+b+';cursor:pointer"><option value="">\u2014</option>'+us.map(function(u){return'<option value="'+u.id+'" '+(String(u.id)===String(v)?'selected':'')+'>'+esc(fullName(u))+'</option>';}).join('')+'</select>';}
  if(col.type==='dropdown'){var opts=(col.options||[]);return'<select '+oc+' style="'+b+';cursor:pointer"><option value="">\u2014</option>'+opts.map(function(o){return'<option '+(String(o)===String(v)?'selected':'')+'>'+esc(o)+'</option>';}).join('')+'</select>';}
  if(col.type==='email')return'<input type="email" value="'+esc(v)+'" '+oc+' style="'+b+'" placeholder="name@\u2026"/>';
  if(col.type==='phone')return'<input type="tel" value="'+esc(v)+'" '+oc+' style="'+b+'" placeholder="+971\u2026"/>';
  if(col.type==='url')return'<div style="display:flex;align-items:center;gap:4px"><input type="url" value="'+esc(v)+'" '+oc+' style="'+b+';flex:1" placeholder="https://\u2026"/>'+(v?'<a href="'+esc(v)+'" target="_blank" rel="noopener" title="Open link" style="color:#8B6B41;flex-shrink:0;display:grid;place-items:center">'+ic('send','w-3.5 h-3.5')+'</a>':'')+'</div>';
  return'<input type="text" value="'+esc(v)+'" '+oc+' style="'+b+'" placeholder="\u2014"/>';
}
function _crmTable(board,opts){
  opts=opts||{};
  var cols=(board.settings&&board.settings.columns)||[];var canEd=can('crm','edit');var canCr=can('crm','create');
  var canStruct=canEd; // v3.12.1: a filtered view IS the board — same actions everywhere, permissions decide
  var rows=CRM.convos.filter(function(c){return c.boardId===board.id;});
  // opts.filters (a view's saved conditions) beats the ad-hoc board filter
  var flt=(opts.filters!=null)?opts.filters:((CRM.boardFilter||{})[board.id]||[]);
  rows=_crmApplyFilters(rows,flt);
  rows.sort(function(a,b){return String(b.lastAt||'').localeCompare(String(a.lastAt||''));});
  var _cw=(board.settings&&board.settings.colWidths)||{};
  var _w=function(k,d){var w=parseInt(_cw[k],10);return(w&&w>=70)?w:d;};
  var _wst=function(k,d){var w=_w(k,d);return'width:'+w+'px;min-width:'+w+'px;max-width:'+w+'px';};
  var hc='padding:9px 10px;font-size:11px;font-weight:800;color:#6B7280;border-bottom:1px solid #ECEDF0;background:#F5F3EF;text-align:left;white-space:nowrap;position:sticky;top:0;z-index:1';
  var _rzOr=function(k){return canStruct?_crmRz(board.id,k):'';};
  var th='<th style="'+hc+';position:relative;'+_wst('_title',260)+'">Ticket'+_rzOr('_title')+'</th>'
    +'<th style="'+hc+';position:relative;'+_wst('_asg',170)+'">Assignee'+_rzOr('_asg')+'</th>'
    +'<th style="'+hc+';position:relative;'+_wst('_st',150)+'">Status'+_rzOr('_st')+'</th>';
  cols.forEach(function(col){
    th+='<th class="crm-colh" data-cid="'+col.id+'" '+(canStruct?'ondragover="App._crmColDragOver(event)" ondragleave="App._crmColDragLeave(event)" ondrop="App._crmColDrop(event,\''+board.id+'\',\''+col.id+'\')"':'')+' style="'+hc+';'+_wst(col.id,150)+';position:relative">'
      +(canStruct?'<span class="crm-grip" draggable="true" ondragstart="App._crmColDragStart(event,\''+board.id+'\',\''+col.id+'\')" ondragend="App._crmColDragEnd(event)" title="Drag to reorder"><svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor"><circle cx="3" cy="2.5" r="1.3"/><circle cx="7" cy="2.5" r="1.3"/><circle cx="3" cy="7" r="1.3"/><circle cx="7" cy="7" r="1.3"/><circle cx="3" cy="11.5" r="1.3"/><circle cx="7" cy="11.5" r="1.3"/></svg></span>':'')
      +'<span onclick="'+(canStruct?'App._crmColModal(\''+board.id+'\',\''+col.id+'\')':'')+'" title="'+(canStruct?'Click to edit column':'')+'" style="cursor:'+(canStruct?'pointer':'default')+'">'+esc(col.name)+' <span style="font-size:9px;color:#B8B5AC;font-weight:600">'+esc(col.type)+'</span></span>'
      +(canStruct?'<span class="crm-colx" style="display:none;position:absolute;right:8px;top:8px;background:#F5F3EF;padding-left:3px"><button onclick="event.stopPropagation();App._crmDelCol(\''+board.id+'\',\''+col.id+'\')" title="Delete column" style="border:none;background:transparent;cursor:pointer;color:#DC2626">\u2715</button></span>':'')
      +_rzOr(col.id)
    +'</th>';
  });
  th+='<th style="'+hc+';width:52px"></th>';
  var addRow='';
  if(canCr&&CRM._rowAdd===board.id){
    addRow='<tr style="background:#FDF7F1"><td style="padding:7px 10px;border-bottom:1px solid #F4E8DC"><div style="display:flex;gap:6px"><input id="row-new-title" placeholder="Ticket title" onkeydown="if(event.key===\'Enter\')App._crmRowCreate(\''+board.id+'\');if(event.key===\'Escape\'){CRM._rowAdd=null;rr();}" style="flex:1;border:1.5px solid #D1B68F;border-radius:8px;padding:7px 9px;font-size:12.5px;outline:none;background:#fff"/><input id="row-new-cust" placeholder="Customer" onkeydown="if(event.key===\'Enter\')App._crmRowCreate(\''+board.id+'\')" style="width:130px;border:1px solid #EBD9C8;border-radius:8px;padding:7px 9px;font-size:12.5px;outline:none;background:#fff"/></div></td>'
      +'<td colspan="99" style="padding:7px 10px;border-bottom:1px solid #F4E8DC"><div style="display:flex;gap:6px;align-items:center"><button onclick="App._crmRowCreate(\''+board.id+'\')" style="border:none;background:#8B6B41;color:#fff;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:800;cursor:pointer">Add</button><button onclick="CRM._rowAdd=null;rr()" style="border:1px solid #E5E7EB;background:#fff;border-radius:8px;padding:6px 11px;font-size:12px;font-weight:700;cursor:pointer;color:#6B7280">Cancel</button><span style="font-size:11px;color:#B8B5AC">Enter to add \u00B7 Esc to close</span></div></td></tr>';
  }
  var body=rows.map(function(r){
    var tds='<td style="padding:6px 10px;border-bottom:1px solid #F3F4F6;overflow:hidden"><div onclick="App._crmSelConvo(\''+r.id+'\')" style="cursor:pointer"><div style="font-size:13px;font-weight:700;color:#13171B;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(r.title||r.customer||'\u2014')+'</div>'+(r.customer?'<div style="font-size:10.5px;color:#9CA3AF;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(r.customer)+'</div>':'')+'</div></td>';
    tds+='<td style="padding:2px 6px;border-bottom:1px solid #F3F4F6;overflow:hidden">'+_crmAsgCell(r,board)+'</td>';
    tds+='<td style="padding:2px 6px;border-bottom:1px solid #F3F4F6;overflow:hidden">'+_crmRowStatus(r,board)+'</td>';
    cols.forEach(function(col){tds+='<td style="padding:2px 6px;border-bottom:1px solid #F3F4F6;overflow:hidden">'+_crmCell(r,col)+'</td>';});
    tds+='<td style="padding:4px 8px;border-bottom:1px solid #F3F4F6;white-space:nowrap;text-align:right">'+(can('crm','delete')?'<button onclick="App._crmDelConvo(\''+r.id+'\')" title="Delete" style="border:none;background:transparent;color:#C7CAD1;cursor:pointer">'+ic('trash','w-3.5 h-3.5')+'</button>':'')+'</td>';
    return'<tr class="crm-trow">'+tds+'</tr>';
  }).join('');
  if(!rows.length&&!addRow)body='<tr><td colspan="99" style="padding:44px;text-align:center;color:#9CA3AF;font-size:13px">'+(flt.length?((opts.filters!=null)?'No tickets match this view\u2019s conditions right now.':'No tickets match the filter \u2014 <b style="color:#8B6B41">Filter</b> above adjusts or clears it.'):('No tickets yet.'+(canCr?' Hit <b style="color:#8B6B41">+ New ticket</b> above to add the first one'+(canEd?', and <b>+ Column</b> to shape the table':'')+'.':'')))+'</td></tr>';
  return'<div class="crm-scroll" style="flex:1;overflow:auto;background:#fff;min-height:0"><table style="width:100%;border-collapse:collapse"><thead><tr>'+th+'</tr></thead><tbody>'+addRow+body+'</tbody></table></div>';
}
App._crmRowAddOpen=(boardId)=>{CRM._rowAdd=boardId;rr();setTimeout(function(){var e=document.getElementById('row-new-title');if(e)e.focus();},40);};
App._crmRowCreate=async(boardId)=>{
  if(!can('crm','create'))return toast('No permission to create','err');
  var b=_crmBoard(boardId);if(!b)return;
  var tt=document.getElementById('row-new-title'),cu=document.getElementById('row-new-cust');
  var title=(tt?tt.value:'').trim();if(!title)return toast('Give it a title','err');
  var name=(cu?cu.value:'').trim()||'\u2014';
  var st=(_crmStatuses(b)[0]||{name:'Open'}).name;
  var id=uid('cv');var now=new Date().toISOString();
  var c={id:id,boardId:b.id,title:title,customer:name,channel:'Manual',isTicket:true,ticketType:'Ticket',priority:'Medium',status:st,assignedTo:null,createdBy:S.uid||null,createdAt:now,lastAt:now,messages:[],fields:{},dueDate:null};
  CRM.convos.push(c);toast('Ticket added \u2713');rr();
  setTimeout(function(){var e=document.getElementById('row-new-title');if(e)e.focus();},40);
  _crmLog('created',c,'in '+st);
  sbWrite({table:'crm_conversations',op:'insert',id:id,values:{id:id,board_id:b.id,title:title,customer:name,channel:'Manual',is_ticket:true,ticket_type:'Ticket',priority:'Medium',status:st,created_by:S.uid||null,created_at:now,last_at:now,updated_at:now}},{label:'New ticket'});
  _crmNotifyRule('created',c,b,'crm_ticket',{title:title,type:b.name,customer:name,actor:(me()?fullName(me()):'')});
  try{_crmRunAutos(b,'created',c,{});}catch(e){}
};
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
  var pills=types.map(function(t){var on=d.type===t[0];return'<button onclick="CRM._colEdit.type=\''+t[0]+'\';App._crmColModalRender()" style="padding:8px 14px;border-radius:9px;border:1.5px solid '+(on?'#8B6B41':'#E5E7EB')+';background:'+(on?'#F5EEE1':'#fff')+';color:'+(on?'#54433C':'#6B7280')+';font-size:12.5px;font-weight:700;cursor:pointer">'+t[1]+'</button>';}).join('');
  modalShell({title:d.colId?'Edit column':'New column',sub:'Columns are this board\u2019s fields \u2014 automations can react to them.',size:'max-w-md',key:'crm-col',
    body:'<label class="ui-label">Column name</label><input value="'+esc(d.name)+'" oninput="CRM._colEdit.name=this.value" placeholder="e.g. Order #, Amount, Approval" class="ui-input" style="margin-bottom:14px"/>'
      +'<label class="ui-label">Type</label><div style="display:flex;gap:6px;flex-wrap:wrap">'+pills+'</div>'
      +(d.type==='dropdown'?'<label class="ui-label" style="margin-top:14px">Options (one per line)</label><textarea oninput="CRM._colEdit.options=this.value" rows="4" class="ui-input" style="resize:vertical;font-family:inherit" placeholder="Pending\u000AApproved\u000ARejected">'+esc(d.options)+'</textarea>':''),
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

function _pageInner(){
  const r=S.route;
  if(r==='dashboard'){if(can('analytics','view'))return dashboardPage();S.route='mychecklists';return myClsPage();}
  if(r==='users'){if(can('employees','view'))return usersPage();S.route='dashboard';return _pageInner();}
  if(r==='departments'){if(can('departments','view'))return deptsPage();S.route='dashboard';return _pageInner();}
  if(r==='locations'){if(can('locations','view'))return locsPage();S.route='dashboard';return _pageInner();}
  if(r==='checklists'){if(can('checklists','create'))return clsPage();S.route='dashboard';return _pageInner();}
  if(r==='approvals'){if(can('approvals','view'))return approvalsPage();S.route='notifications';return notificationsPage();}
  if(r==='notifications')return notificationsPage();
  if(r==='tickets'){if(can('tickets','view'))return ticketsPage();S.route='mychecklists';return myClsPage();}
  if(r==='hierarchy')return hierarchyPage();
  if(r==='analytics'){S.route='dashboard';return _pageInner();} // Analytics tab removed — old links land on the Dashboard
  if(r==='audit'){if(can('audit','view'))return auditPage();S.route='dashboard';return _pageInner();}
  if(r==='settings'){if(can('settings','view'))return settingsPage();S.route='dashboard';return _pageInner();}
  if(r==='questions'){if(can('questions','view'))return questionsPage();return myClsPage();}
  if(r==='mychecklists')return myClsPage();
  if(r==='teamview'){if(can('teamview','view'))return teamViewPage();S.route='mychecklists';return myClsPage();}
  if(r==='allcl'){if(can('allChecklists','view'))return allClsPage();if(can('teamview','view'))return teamViewPage();S.route='dashboard';return _pageInner();}
  if(r==='profile')return profilePage();
  if(r==='okr'){if(can('okr','view'))return okrPage();S.route='dashboard';return _pageInner();}
  if(r==='accesscontrol'){if(can('accessControl','view'))return accessControlPage();S.route='dashboard';return _pageInner();}
  if(r==='crm'){if(can('crm','view'))return crmPage();S.route='dashboard';return _pageInner();}
  return empty('grid','Not found','');
}


/* ── Hub wrapper: after the inner router settles on the FINAL route (fallbacks may
   reassign it), prepend the hub pill strip when that route belongs to a hub. ── */
function pageContent(){
  const html=_pageInner();
  const hub=(typeof _hubOf==='function')?_hubOf(S.route):null;
  return hub?('<div class="fade">'+_hubStrip(hub)+'</div>'+html):html;
}
