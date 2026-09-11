/* ============================================================
   Bridge — 23-dm.js  (v132)
   Direct messages — private one-to-one chats inside Workspace.
   A DM is a crm_conversations row with kind='dm' and dm_members=[a,b]
   (deterministic id, so two people can never create two chats), so the
   whole chat machinery — bubbles, photos, reactions, threads, ticks,
   typing, realtime, notifications — is reused untouched.
   Classic script: shares top-level scope with the other /js files.
   ============================================================ */

function _crmIsDM(c){return !!(c&&(c.kind==='dm'||(Array.isArray(c.dmMembers)&&c.dmMembers.length===2)));}
function _crmDMMembers(c){return (c&&Array.isArray(c.dmMembers))?c.dmMembers.map(String):[];}
function _crmDMPeer(c){var id=_crmDMMembers(c).find(function(x){return x!==String(S.uid);});return id?uById(id):null;}
function _crmDMVisible(c){return _crmDMMembers(c).indexOf(String(S.uid))>=0;}
function _dmIdFor(a,b){return 'dm_'+[String(a),String(b)].sort().join('_');}
function _dmConvos(){return (CRM&&CRM.convos||[]).filter(function(c){return _crmIsDM(c)&&_crmDMVisible(c);}).sort(function(a,b){return String(b.lastAt||'').localeCompare(String(a.lastAt||''));});}
function _dmUnreadTotal(){try{if(!window.CRM||!CRM._loaded)return (DB.notifications||[]).filter(function(n){return n.userId===S.uid&&!n.read&&n.kind==='dm';}).length;return _dmConvos().filter(_crmUnread).length;}catch(e){return 0;}}
function _dmPeerStatus(p){
  if(!p)return '';
  var on=!!(window._bbOnline&&window._bbOnline[p.id]);
  var open=(typeof _attOpen==='function')?_attOpen(p.id):null;
  var bits=[];
  if(on)bits.push('<span style="color:#346A47;font-weight:700">● Online</span>');
  if(open)bits.push(open.mode==='wfh'?'Working from home':'Clocked in');
  if(p.position)bits.push(esc(p.position));
  if(p.department)bits.push(esc(p.department));
  return bits.join(' · ')||'Direct message';
}
function _dmHdrBtns(convo,peer){
  var snd=(typeof _crmSndOn==='function')?_crmSndOn():true;
  return '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0">'
    +(typeof App._crmSndTog==='function'?'<button class="crm-hdr-btn" title="'+(snd?'Mute message sounds':'Unmute message sounds')+'" onclick="App._crmSndTog()" style="width:34px;height:34px;border-radius:9px;border:1px solid #E6DED3;background:#fff;color:'+(snd?'#54433C':'#A59788')+';cursor:pointer;display:grid;place-items:center">'+ic('bell','w-4 h-4')+'</button>':'')
    +(typeof App.openProfile==='function'?'<button class="crm-hdr-btn" title="View profile" onclick="App.openProfile(\''+peer.id+'\')" style="width:34px;height:34px;border-radius:9px;border:1px solid #E6DED3;background:#fff;color:#786A5F;cursor:pointer;display:grid;place-items:center">'+ic('user','w-4 h-4')+'</button>':'')
    +(can('messages','delete')?'<button class="crm-hdr-btn" title="Delete this chat for both of you" onclick="App._dmDelete(\''+convo.id+'\')" style="width:34px;height:34px;border-radius:9px;border:1px solid #E4A898;background:#fff;color:#B3402E;cursor:pointer;display:grid;place-items:center">'+ic('trash','w-4 h-4')+'</button>':'')
    +'</div>';
}

/* ── Sidebar section ── */
function _dmNavHTML(collapsed){
  var list=_dmConvos();var un=list.filter(_crmUnread).length;var on=!!CRM.sel.dm;
  if(collapsed){
    return '<div class="crm-hub crm-hub-mini'+(on?' on':'')+'" style="position:relative;margin-bottom:8px"><button onclick="App._dmOpenList()" title="Direct messages" class="crm-mini-tile">'+ic('msg','w-4 h-4')+(un?'<span class="crm-mini-un">'+(un>99?'99+':un)+'</span>':'')+'</button></div>';
  }
  var rows=list.slice(0,8).map(function(c){var p=_crmDMPeer(c);if(!p)return '';var act=on&&CRM.sel.convoId===c.id;var u2=_crmUnread(c);var online=!!(window._bbOnline&&window._bbOnline[p.id]);
    return '<button onclick="App._dmSel(\''+c.id+'\')" style="width:100%;text-align:left;display:flex;align-items:center;gap:7px;padding:5px 6px 5px 10px;border:none;border-radius:7px;cursor:pointer;background:'+(act?'#13171B':'transparent')+';color:'+(act?'#fff':'#3A312A')+';font-size:12px;font-weight:'+(u2||act?'700':'600')+';margin-bottom:1px">'+avatar(p,'w-5 h-5','text-[8px]')+'<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(fullName(p))+'</span>'+(u2?'<span style="min-width:16px;height:16px;padding:0 5px;border-radius:8px;background:'+(act?'rgba(255,255,255,.25)':'#54433C')+';color:#fff;font-size:9px;font-weight:800;display:inline-grid;place-items:center">'+_crmUnreadN(c)+'</span>':(online?'<span style="width:7px;height:7px;border-radius:50%;background:#428059;flex-shrink:0"></span>':''))+'</button>';}).join('');
  return '<div class="crm-hub" style="margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #E8E0D5">'
    +'<div onclick="App._dmOpenList()" title="Direct messages — private one-to-one chats" style="display:flex;align-items:center;gap:5px;padding:6px 7px;color:'+(on&&!CRM.sel.convoId?'#fff':'#3A312A')+';background:'+(on&&!CRM.sel.convoId?'#13171B':'transparent')+';cursor:pointer;border-radius:7px">'
      +'<span style="color:'+(on&&!CRM.sel.convoId?'rgba(255,255,255,.7)':'#A59788')+'">'+ic('msg','w-3.5 h-3.5')+'</span>'
      +'<span style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Messages</span>'
      +(un?'<span style="min-width:17px;height:17px;padding:0 5px;border-radius:9px;background:#54433C;color:#fff;font-size:9.5px;font-weight:800;display:inline-grid;place-items:center">'+un+'</span>':'')
      +(can('messages','send')?'<button title="New message" onclick="event.stopPropagation();App._dmNew()" style="border:none;background:transparent;color:'+(on&&!CRM.sel.convoId?'rgba(255,255,255,.8)':'#A59788')+';cursor:pointer;padding:0;display:grid;place-items:center;min-width:22px;min-height:22px">'+ic('plus','w-3 h-3')+'</button>':'')
    +'</div>'+rows+(list.length>8?'<button onclick="App._dmOpenList()" style="width:100%;text-align:left;border:none;background:transparent;color:#786A5F;font-size:11px;font-weight:700;padding:4px 10px;cursor:pointer">All messages ('+list.length+') →</button>':'')
    +'</div>';
}

/* ── Main area (replaces hub/board content while CRM.sel.dm) ── */
function _dmMain(searchHTML,dashHTML){
  var list=_dmConvos();var q=(CRM._dmQ||'').toLowerCase();
  var shown=q?list.filter(function(c){var p=_crmDMPeer(c);return p&&(fullName(p).toLowerCase().indexOf(q)>=0||String(p.department||'').toLowerCase().indexOf(q)>=0);}):list;
  var lf=CRM.listFilter||'all';if(lf==='unread')shown=shown.filter(_crmUnread);
  var convo=_crmConvo(CRM.sel.convoId);
  if(convo&&!(_crmIsDM(convo)&&_crmDMVisible(convo))){convo=null;CRM.sel.convoId=null;}
  if(!convo&&!(typeof _crmIsMob==='function'&&_crmIsMob())&&shown.length&&!q){convo=shown[0];CRM.sel.convoId=convo.id;}
  var row1='<div class="crm-boardbar" style="padding:10px 16px;border-bottom:1px solid #EDE7DC;display:flex;align-items:center;gap:10px;flex-wrap:wrap;flex-shrink:0"><button class="crm-only-mob crm-tap" aria-label="Open hubs" onclick="App._crmMobNav()" style="width:34px;height:34px;border:1px solid #E6DED3;background:#fff;border-radius:9px;cursor:pointer;align-items:center;justify-content:center;color:#3A312A;flex-shrink:0">'+ic('menu','w-5 h-5')+'</button><div class="crm-hubname" style="font-size:16px;font-weight:800;color:#13171B;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Messages <span style="font-weight:600;color:#A59788;font-size:12.5px">· private</span></div><div style="flex:1"></div>'+(searchHTML||'')+(dashHTML||'')+'</div>';
  var cnt={all:list.length,unread:list.filter(_crmUnread).length};
  var lfRow='<div class="crm-lfrow">'+[['all','All'],['unread','Unread']].map(function(x){var on=lf===x[0];return '<button onclick="App._crmListFilter(\''+x[0]+'\')" class="crm-lchipf'+(on?' on':'')+'">'+x[1]+(cnt[x[0]]&&x[0]!=='all'?' <b>'+cnt[x[0]]+'</b>':'')+'</button>';}).join('')+'<span style="flex:1"></span>'+(can('messages','send')?'<button class="crm-newchat" title="New message" onclick="App._dmNew()">'+ic('plus','w-4 h-4')+'</button>':'')+'</div>';
  var search='<div style="padding:6px 10px 4px"><input id="dm-q" value="'+esc(CRM._dmQ||'')+'" placeholder="Search people…" oninput="CRM._dmQ=this.value;App._searchRR(\'dm-q\')" style="width:100%;padding:7px 10px;border:1px solid #E6DED3;border-radius:9px;font-size:12.5px;outline:none"/></div>';
  var rows=shown.map(function(c){return _crmConvoRow(c,CRM.sel.convoId,false);}).join('');
  var emptyL=list.length?'<div style="padding:24px 14px;text-align:center;color:#A59788;font-size:12.5px">No chats match.</div>':'<div style="padding:28px 16px;text-align:center;color:#A59788;font-size:12.5px">'+ic('msg','w-7 h-7')+'<div style="margin-top:8px;font-weight:700;color:#3A312A">No direct messages yet</div><div style="margin-top:3px">Tap + to message a colleague. Only the two of you can read it.</div></div>';
  var listCol='<div class="crm-listcol" style="width:23%;min-width:232px;max-width:290px;border-right:1px solid #EDE7DC;display:flex;flex-direction:column;min-height:0;background:#fff">'+lfRow+search+'<div class="crm-scroll" style="flex:1;overflow-y:auto" id="crm-list">'+(rows||emptyL)+'</div>'+((can('messages','send')&&typeof _crmIsMob==='function'&&_crmIsMob())?'<button class="crm-fab" onclick="App._dmNew()" aria-label="New message">'+ic('plus','w-4 h-4')+'New message</button>':'')+'</div>';
  var pane=convo?_crmChatPane(convo,null):'<div class="crm-chatpane" style="flex:1;display:flex;min-width:0;min-height:0">'+_crmEmpty('msg','Your messages','Pick a chat on the left, or start a new one — private, one-to-one, and only the two of you can see it.',(can('messages','send')?'<button onclick="App._dmNew()" style="margin-top:14px;padding:9px 18px;border:none;border-radius:10px;background:#54433C;color:#fff;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:7px">'+ic('plus','w-4 h-4')+'New message</button>':''))+'</div>';
  return row1+'<div class="crm-mainrow" style="flex:1;display:flex;min-height:0">'+listCol+pane+'</div>';
}

/* ── interactions ── */
App._dmOpenList=()=>{CRM.sel.dm=true;CRM.sel.convoId=null;CRM.sel.threadId=null;CRM.sel.viewId=null;CRM._miniHub=null;CRM.search='';try{App._crmMobNav(false);}catch(e){}rr();};
App._dmSel=(id)=>{var c=_crmConvo(id);if(!c||!_crmDMVisible(c))return;CRM.sel.dm=true;CRM.sel.viewId=null;CRM.sel.convoId=id;CRM.sel.threadId=null;CRM.compose.images=[];CRM._miniHub=null;try{App._crmMobNav(false);}catch(e){}_crmMarkRead(id);rr();_crmScrollBottom();};
App._dmNew=()=>{
  if(!can('messages','send'))return toast('Your role can’t send direct messages','err');
  CRM._dmPickQ='';App._dmRenderPick();
};
App._dmRenderPick=()=>{
  var q=(CRM._dmPickQ||'').toLowerCase();
  var people=(DB.users||[]).filter(function(u){return u&&u.id!==S.uid&&u.status==='Active';}).filter(function(u){return !q||fullName(u).toLowerCase().indexOf(q)>=0||String(u.department||'').toLowerCase().indexOf(q)>=0||String(u.position||'').toLowerCase().indexOf(q)>=0;}).sort(function(a,b){return fullName(a).localeCompare(fullName(b));});
  var recent=_dmConvos().map(_crmDMPeer).filter(Boolean).slice(0,5);
  var row=function(u){var on=!!(window._bbOnline&&window._bbOnline[u.id]);return '<button onclick="_dmOpenWith(\''+u.id+'\')" style="width:100%;text-align:left;display:flex;align-items:center;gap:10px;padding:8px 10px;border:none;background:transparent;border-radius:10px;cursor:pointer" onmouseover="this.style.background=\'#F4F0EA\'" onmouseout="this.style.background=\'transparent\'">'+avatar(u,'w-9 h-9','text-[11px]')+'<span style="min-width:0;flex:1"><span style="display:block;font-size:13px;font-weight:700;color:#13171B;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(fullName(u))+'</span><span style="display:block;font-size:11px;color:#A59788;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc([u.position,u.department].filter(Boolean).join(' · ')||u.email||'')+'</span></span>'+(on?'<span style="font-size:10px;font-weight:800;color:#346A47">● Online</span>':'')+'</button>';};
  modalShell({title:'New message',sub:'Private — only you and the person you pick can read it',size:'max-w-md',key:'dm-pick',
    body:'<div><input id="dm-pick-q" value="'+esc(CRM._dmPickQ||'')+'" placeholder="Search by name, role or department…" class="ui-input rf" oninput="CRM._dmPickQ=this.value;App._dmRenderPick();setTimeout(function(){var e=document.getElementById(\'dm-pick-q\');if(e){e.focus();e.setSelectionRange(e.value.length,e.value.length);}},0)"/>'
      +(!q&&recent.length?'<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#A59788;margin:12px 4px 4px">Recent</div>'+recent.map(row).join(''):'')
      +'<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#A59788;margin:12px 4px 4px">'+(q?'Matches':'Everyone')+' · '+people.length+'</div><div style="max-height:46vh;overflow-y:auto">'+(people.map(row).join('')||'<div style="padding:18px;text-align:center;color:#A59788;font-size:12.5px">Nobody matches.</div>')+'</div></div>',
    footer:btnG('Close','App.closeModal()')});
  setTimeout(function(){var e=document.getElementById('dm-pick-q');if(e&&!e.value)e.focus();},60);
};
/* Open (or create) the DM with a person. Called from the picker, profiles and the Users list. */
async function _dmOpenWith(uid2){
  if(!can('messages','send')&&!can('messages','view'))return toast('Your role can’t use direct messages','err');
  var peer=uById(uid2);if(!peer||uid2===S.uid)return;
  try{closeModal();}catch(e){}
  if(S.route!=='crm')App.go('crm');
  _crmInit();CRM.sel.dm=true;
  if(!CRM._loaded){if(!CRM._loading){try{_crmLoad();}catch(e){}}var w=0;while(!CRM._loaded&&w<100){await new Promise(function(r){setTimeout(r,100);});w++;}if(!CRM._loaded)return;}
  var id=_dmIdFor(S.uid,uid2);
  var c=_crmConvo(id);
  if(!c){
    if(!can('messages','send'))return toast('Your role can’t start direct messages','err');
    var at=new Date().toISOString();
    c={id:id,boardId:null,title:fullName(peer),customer:fullName(peer),channel:'dm',isTicket:false,ticketType:null,priority:'Medium',status:'Open',assignedTo:null,assignedGroup:null,createdBy:S.uid,decision:null,fields:{},dueDate:null,createdAt:at,lastAt:at,kind:'dm',dmMembers:[String(S.uid),String(uid2)],messages:[]};
    CRM.convos.unshift(c);if(typeof _crmMarkFresh==='function')_crmMarkFresh(id);
    // upsert with ignoreDuplicates: if the other person created it a moment ago, keep theirs
    sb.from('crm_conversations').upsert({id:id,board_id:null,title:fullName(peer),customer:fullName(peer),channel:'dm',is_ticket:false,created_by:S.uid,created_at:at,last_at:at,kind:'dm',dm_members:[String(S.uid),String(uid2)]},{onConflict:'id',ignoreDuplicates:true}).then(function(r){if(r&&r.error)_syncErr('direct message')(r.error);}).catch(_syncErr('direct message'));
  }
  App._dmSel(id);
  setTimeout(function(){var i=document.getElementById('crm-input');if(i)i.focus();},80);
}
App._dmDelete=async(id)=>{
  if(!can('messages','delete'))return toast('You need Direct messages → Delete','err');
  var c=_crmConvo(id);if(!c||!_crmIsDM(c)||!_crmDMVisible(c))return;
  var p=_crmDMPeer(c);
  if(!(await confirmP({title:'Delete this chat?',body:'Your chat with <b>'+esc(p?fullName(p):'this person')+'</b> — '+((c.messages||[]).length)+' message(s) — will be deleted for <b>both</b> of you.',confirmLabel:'Delete chat',cancelLabel:'Keep it'})))return;
  CRM.convos=CRM.convos.filter(function(x){return x.id!==id;});CRM.sel.convoId=null;rr();
  try{await sb.from('crm_messages').delete().eq('conversation_id',id);await sb.from('crm_reads').delete().eq('conversation_id',id);var r=await sb.from('crm_conversations').delete().eq('id',id);if(r.error)throw r.error;toast('Chat deleted','warn');log(fullName(me()),'Deleted direct message',p?fullName(p):id);}
  catch(e){toast('Couldn’t delete — '+(e.message||e),'err');}
};
