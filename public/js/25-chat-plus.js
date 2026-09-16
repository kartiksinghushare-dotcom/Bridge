/* ═══════════════════════════════════════════════════════════════════════════════════════════════
   Bridge v137 — Workspace chat, WhatsApp parity
   voice notes · any file · quoted replies (+ jump) · forward (multi-select, “Forwarded”) · edit 15 min ·
   message info (read / delivered per person) · last seen · pin · star · link previews · swipe gestures ·
   emoji + sticker picker · chat info page (members, media, files, links, mute, archive, leave)
   Loads after 06-crm.js / 23-dm.js and extends them; nothing here talks to the database except through
   the same `sb` client. Files live in the private `chat-media` bucket and are read through signed links.
   ═══════════════════════════════════════════════════════════════════════════════════════════════ */

/* ── icons the rest of the app doesn't have yet ── */
(function(){try{
  I.mic='<path d="M12 15a4 4 0 0 0 4-4V6a4 4 0 0 0-8 0v5a4 4 0 0 0 4 4z"/><path d="M19 11a7 7 0 0 1-14 0"/><path d="M12 18v3"/><path d="M8 21h8"/>';
  I.reply='<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 5 5v6"/>';
  I.forward='<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0-5 5v6"/>';
  I.more='<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>';
  I.star='<path d="m12 3 2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.4 6.3 20.5l1.2-6.4L2.8 9.7l6.4-.8z"/>';
  I.play='<path d="M7 4v16l13-8z" fill="currentColor" stroke="none"/>';
  I.pause='<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/>';
  I.stop='<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>';
  I.bellOff='<path d="M13.7 21a2 2 0 0 1-3.4 0"/><path d="M18.6 13A17.9 17.9 0 0 1 18 8"/><path d="M6.3 6.3A6 6 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.3-5"/><path d="m2 2 20 20"/>';
  I.archive='<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/>';
  I.link='<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>';
  I.logoutR='<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>';
}catch(e){}})();

/* ═══ 1. per-person state: stars, chat prefs (mute / archive / pin), loaded once after the workspace ═══ */
function _crmPrefs(cid){return ((typeof CRM!=='undefined'&&CRM&&CRM.prefs)||{})[cid]||{};}
function _crmMuted(cid){var p=_crmPrefs(cid);return !!(p.mutedUntil&&new Date(p.mutedUntil).getTime()>Date.now());}
async function _cpLoadExtras(){
  if(!S.uid||!window.sb)return;
  try{var r=await sb.from('crm_stars').select('message_id,conversation_id,created_at').eq('user_id',S.uid);CRM.stars={};((r&&r.data)||[]).forEach(function(x){CRM.stars[x.message_id]={cid:x.conversation_id,at:x.created_at};});}catch(e){}
  try{var r2=await sb.from('crm_convo_prefs').select('*').eq('user_id',S.uid);CRM.prefs={};((r2&&r2.data)||[]).forEach(function(x){CRM.prefs[x.conversation_id]={mutedUntil:x.muted_until||null,archived:!!x.archived,pinned:!!x.pinned};});}catch(e){}
  CRM._extrasLoaded=true;
}
/* v139 — opening the Workspace lands on the board (or Messages) with the NEWEST activity, never on a board remembered
   from days ago. A deep link from a notification still wins. Runs once per sign-in. */
function _cpLandNewest(){try{
  if(CRM._landed||CRM.sel.convoId||CRM._openAfterLoad)return;CRM._landed=true;
  var best=null,bt='';_crmVisibleBoards().forEach(function(b){(CRM.convos||[]).forEach(function(c){if(c.boardId===b.id&&!_crmPrefs(c.id).archived&&String(c.lastAt||'')>bt){bt=String(c.lastAt);best=b;}});});
  var dmT='';if(typeof _dmConvos==='function')_dmConvos().forEach(function(c){if(String(c.lastAt||'')>dmT)dmT=String(c.lastAt);});
  if(best&&bt>=dmT){CRM.sel.viewId=null;CRM.sel.dm=false;CRM.sel.boardId=best.id;CRM.sel.hubId=best.hubId;}
  else if(dmT){CRM.sel.dm=true;CRM.sel.viewId=null;}
  CRM.sel.convoId=null;CRM.sel.threadId=null;
}catch(e){}}
(function(){var _o=_crmLoad;_crmLoad=async function(){await _o.apply(this,arguments);try{await _cpLoadExtras();}catch(e){}try{_cpLandNewest();}catch(e){}try{if(S.route==='crm'){rr();_crmScrollBottom();}}catch(e){}};})();
async function _cpSavePref(cid,patch){
  CRM.prefs=CRM.prefs||{};var cur=CRM.prefs[cid]||{};CRM.prefs[cid]=Object.assign({},cur,patch);
  var row={user_id:S.uid,conversation_id:cid,muted_until:CRM.prefs[cid].mutedUntil||null,archived:!!CRM.prefs[cid].archived,pinned:!!CRM.prefs[cid].pinned,updated_at:new Date().toISOString()};
  try{await sb.from('crm_convo_prefs').upsert(row,{onConflict:'user_id,conversation_id'});}catch(e){}
}
App._crmMute=(cid,preset)=>{
  var until=null;var now=Date.now();
  if(preset==='8h')until=new Date(now+8*3600e3).toISOString();else if(preset==='1w')until=new Date(now+7*864e5).toISOString();else if(preset==='always')until='2999-01-01T00:00:00.000Z';
  _cpSavePref(cid,{mutedUntil:until});_cpSheetClose();toast(until?'Muted — you still get @tags':'Unmuted');rr();
};
App._crmMuteAsk=(cid)=>{
  var muted=_crmMuted(cid);
  _cpSheet('<div class="cp-sh-t">Mute notifications</div><div class="cp-sh-s">No sounds, pop-ups or push for this chat. Messages still arrive and someone tagging you always gets through.</div>'
    +'<div class="cp-list">'+[['8h','8 hours'],['1w','1 week'],['always','Always']].map(function(x){return'<button class="cp-item" onclick="App._crmMute(\''+cid+'\',\''+x[0]+'\')">'+ic('bellOff','w-4 h-4')+'<span>'+x[1]+'</span></button>';}).join('')
    +(muted?'<button class="cp-item cp-item-ok" onclick="App._crmMute(\''+cid+'\',\'\')">'+ic('bell','w-4 h-4')+'<span>Unmute</span></button>':'')+'</div>',{title:'Mute'});
};
App._crmArchive=(cid,on)=>{_cpSavePref(cid,{archived:!!on});_cpSheetClose();toast(on?'Archived — find it under “Archived” in the list':'Back in your chats');if(on&&CRM.sel.convoId===cid){CRM.sel.convoId=null;}rr();};
App._crmPinChat=(cid,on)=>{_cpSavePref(cid,{pinned:!!on});_cpSheetClose();toast(on?'Pinned to the top':'Unpinned');rr();};
App._crmMarkUnread=(cid)=>{try{if(!CRM.reads)CRM.reads={};CRM.reads[cid]='1970-01-01T00:00:00.000Z';sb.from('crm_reads').upsert({user_id:S.uid,conversation_id:cid,last_seen_at:'1970-01-01T00:00:00.000Z'},{onConflict:'user_id,conversation_id'}).then(function(){}).catch(function(){});}catch(e){}_cpSheetClose();rr();};

/* ═══ 2. bottom sheet (phone) / centred card (desktop) — one host, used by every feature below ═══ */
function _cpSheetHost(){var h=document.getElementById('cp-sheet');if(!h){h=document.createElement('div');h.id='cp-sheet';h.innerHTML='<div class="cp-scrim" onclick="_cpSheetClose()"></div><div class="cp-card" role="dialog"><div class="cp-grab"></div><div class="cp-body"></div></div>';document.body.appendChild(h);}return h;}
function _cpSheet(html,opts){opts=opts||{};var h=_cpSheetHost();var body=h.querySelector('.cp-body');body.innerHTML=(opts.title?'<div class="cp-hd"><div class="cp-hd-t">'+esc(opts.title)+'</div><button class="cp-x" onclick="_cpSheetClose()" aria-label="Close">'+ic('x','w-4 h-4')+'</button></div>':'')+html;h.classList.toggle('cp-wide',!!opts.wide);h.classList.toggle('cp-tall',!!opts.tall);h.classList.add('on');document.body.classList.add('cp-sheet-open');try{App._crmCloseMsgActs();}catch(e){}return h;}
function _cpSheetClose(){var h=document.getElementById('cp-sheet');if(h)h.classList.remove('on');document.body.classList.remove('cp-sheet-open');try{if(window._cpAudio&&CRM._infoAudio){}}catch(e){}}
window._cpSheetClose=_cpSheetClose;
document.addEventListener('keydown',function(e){if(e.key==='Escape')_cpSheetClose();});

/* ═══ 3. composer: quoted reply bar · mic ⇄ send · file chips ═══ */
function _crmComposerEmpty(){if(!CRM.compose)CRM.compose={images:[],files:[]};var el=document.getElementById('crm-input');var t=el?el.value.trim():'';return !t&&!((CRM.compose.images||[]).length)&&!((CRM.compose.files||[]).length);}
function _crmSendMode(){var b=document.getElementById('crm-sendbtn');if(!b)return;b.classList.toggle('crm-mic',_crmComposerEmpty());b.setAttribute('aria-label',_crmComposerEmpty()?'Record a voice note':'Send');}
function _crmReplyBarHTML(){var r=CRM.compose.replyTo;if(!r||r.cid!==CRM.sel.convoId)return'';return'<div class="crm-replybar">'+_crmQuoteHTML(r.cid,r.mid,true)+'<button type="button" class="crm-rbx" onclick="App._crmQuoteClear()" aria-label="Cancel reply">'+ic('x','w-4 h-4')+'</button></div>';}
function _crmRenderReplyBar(){var el=document.getElementById('crm-replybar');if(el)el.innerHTML=_crmReplyBarHTML();}
App._crmQuote=(cid,mid)=>{if(!_crmCanPart(cid))return;CRM.compose.replyTo={cid:cid,mid:mid};_cpSheetClose();try{App._crmCloseMsgActs();}catch(e){}
  if(CRM.sel.convoId!==cid){App._crmOpenResult(cid);return;}
  _crmRenderReplyBar();var el=document.getElementById('crm-input');if(el){el.focus();}try{if(navigator.vibrate)navigator.vibrate(6);}catch(e){}};
App._crmQuoteClear=()=>{CRM.compose.replyTo=null;_crmRenderReplyBar();};
/* jump to a message in the open chat (quote tap, pinned bar, starred list, message info) and flash it */
App._crmJumpTo=(cid,mid)=>{_cpSheetClose();
  var tries=0;var go=function(){var el=document.querySelector('#crm-thread .crm-msg[data-mid="'+mid+'"]');if(!el&&document.querySelector('.crm-earlier')&&tries<3){tries++;App._crmShowEarlier(cid,true);setTimeout(go,220);return;}if(!el){toast('That message is in a thread or no longer here');return;}el.scrollIntoView({block:'center',behavior:'smooth'});el.classList.add('crm-hit-cur');setTimeout(function(){el.classList.remove('crm-hit-cur');},2200);};
  if(CRM.sel.convoId!==cid){App._crmOpenResult(cid);setTimeout(go,320);}else go();};
App._crmSendOrRec=(ev)=>{if(_crmComposerEmpty()){App._crmRecStart(ev);return;}App._crmSend();};

/* ═══ 4. uploads → private bucket, signed links on read ═══ */
function _cpSafeName(n){return String(n||'file').replace(/[^\w.\-()+ ]+/g,'_').slice(0,80);}
async function _crmUploadFiles(files,cid){
  var out=[];
  for(var i=0;i<files.length;i++){var f=files[i];
    var path=cid+'/'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8)+'-'+_cpSafeName(f.name);
    var r=await sb.storage.from('chat-media').upload(path,f,{cacheControl:'31536000',upsert:false,contentType:f.type||'application/octet-stream'});
    if(r&&r.error)throw r.error;
    out.push({kind:_crmAttKind(f),name:f.name,size:f.size,type:f.type||'',path:path,dur:f._dur||undefined});
  }
  return out;
}
window._cpUrls=window._cpUrls||{};   // path -> {url, exp}
async function _cpSign(paths){
  paths=(paths||[]).filter(function(p){return p&&!(_cpUrls[p]&&_cpUrls[p].exp>Date.now()+60000);});
  if(!paths.length)return;
  try{var r=await sb.storage.from('chat-media').createSignedUrls(paths,3600);((r&&r.data)||[]).forEach(function(x){if(x&&x.signedUrl&&x.path)_cpUrls[x.path]={url:x.signedUrl,exp:Date.now()+3600e3};});}catch(e){}
}
/* everything rendered with data-cp-path gets its link filled in after paint (voice, video, file cards, info-sheet media) */
var _cpSignTimer=null;
function _cpSignPending(){
  var els=document.querySelectorAll('[data-cp-path]:not([data-cp-ok])');if(!els.length)return;
  var need=[];els.forEach(function(el){var p=el.getAttribute('data-cp-path');if(!p){el.setAttribute('data-cp-ok','0');return;}if(!(_cpUrls[p]&&_cpUrls[p].exp>Date.now()+60000))need.push(p);});
  var apply=function(){document.querySelectorAll('[data-cp-path]:not([data-cp-ok])').forEach(function(el){var p=el.getAttribute('data-cp-path');var u=_cpUrls[p]&&_cpUrls[p].url;if(!u)return;el.setAttribute('data-cp-ok','1');el.setAttribute('data-cp-url',u);
    if(el.tagName==='VIDEO'||el.tagName==='IMG'||el.tagName==='AUDIO')el.src=u;else if(el.tagName==='A'&&!el.classList.contains('crm-file'))el.href=u;});};
  if(!need.length){apply();return;}
  _cpSign(Array.from(new Set(need))).then(apply);
}
(function(){try{var mo=new MutationObserver(function(){if(_cpSignTimer)return;_cpSignTimer=setTimeout(function(){_cpSignTimer=null;try{_cpSignPending();}catch(e){}try{if(window._cpStrip)_cpStrip(document);}catch(e){}try{document.documentElement.classList.toggle('cp-ws',!!document.querySelector('#content .crm-fs'));}catch(e){}},90);});mo.observe(document.body,{childList:true,subtree:true});}catch(e){}})();
App._crmOpenFile=async(a)=>{var p=a.getAttribute('data-cp-path');if(!p)return;var u=a.getAttribute('data-cp-url');
  if(!u){await _cpSign([p]);u=_cpUrls[p]&&_cpUrls[p].url;}
  if(!u)return toast('Could not open the file — try again','err');
  try{var r=await sb.storage.from('chat-media').createSignedUrl(p,600,{download:a.getAttribute('data-cp-name')||true});if(r&&r.data&&r.data.signedUrl)u=r.data.signedUrl;}catch(e){}
  window.open(u,'_blank','noopener');};
function _crmRepaintMsg(cid,mid){try{var c=_crmConvo(cid);var m=c&&(c.messages||[]).find(function(x){return x.id===mid;});if(!m)return;var els=document.querySelectorAll('.crm-msg[data-mid="'+mid+'"]');els.forEach(function(el){var line=el.closest('.crm-line');if(!line)return;var tops=(c.messages||[]).filter(function(x){return !x.parentId;});var i=tops.findIndex(function(x){return x.id===mid;});var tmp=document.createElement('div');tmp.innerHTML=_crmMsg(m,cid,!!m.parentId,i>0?tops[i-1]:null);line.replaceWith(tmp.firstElementChild);});}catch(e){}}
window._crmRepaintMsg=_crmRepaintMsg;

/* ═══ 5. voice notes — hold nothing, tap to record, tap to send (WhatsApp “lock” mode by default) ═══ */
var _cpRec=null;
function _cpRecMime(){var c=['audio/mp4','audio/aac','audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus'];for(var i=0;i<c.length;i++){try{if(window.MediaRecorder&&MediaRecorder.isTypeSupported(c[i]))return c[i];}catch(e){}}return'';}
App._crmRecStart=async(ev)=>{
  if(ev&&ev.preventDefault)ev.preventDefault();
  if(!_crmCanPart(CRM.sel.convoId))return;
  if(!window.MediaRecorder||!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)return toast('Voice notes need a newer browser','err');
  if(_cpRec)return;
  var stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:true});}catch(e){return toast('Microphone blocked — allow it for this site in the browser settings','err');}
  var mime=_cpRecMime();var rec;try{rec=mime?new MediaRecorder(stream,{mimeType:mime}):new MediaRecorder(stream);}catch(e){rec=new MediaRecorder(stream);}
  var chunks=[];_cpRec={rec:rec,stream:stream,chunks:chunks,t0:Date.now(),cancel:false,mime:rec.mimeType||mime||'audio/webm'};
  rec.ondataavailable=function(e){if(e.data&&e.data.size)chunks.push(e.data);};
  rec.onstop=function(){var st=_cpRec;_cpRec=null;try{stream.getTracks().forEach(function(t){t.stop();});}catch(e){}_cpRecPaint(false);
    if(!st||st.cancel)return;var dur=Math.round((Date.now()-st.t0)/1000);if(dur<1&&!st.chunks.length){toast('Too short');return;}
    var blob=new Blob(st.chunks,{type:st.mime});var ext=/mp4|aac|m4a/.test(st.mime)?'m4a':(/ogg/.test(st.mime)?'ogg':'webm');
    var f=new File([blob],'voice-'+new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')+'.'+ext,{type:st.mime.split(';')[0]});f._dur=dur;
    CRM.compose.files=[f];App._crmSend();};
  try{rec.start(250);}catch(e){_cpRec=null;return toast('Could not start recording','err');}
  _cpRecPaint(true);try{if(navigator.vibrate)navigator.vibrate(10);}catch(e){}
  _cpRec.timer=setInterval(function(){var el=document.getElementById('crm-rec-t');if(el&&_cpRec)el.textContent=_crmFmtDur((Date.now()-_cpRec.t0)/1000);if(_cpRec&&Date.now()-_cpRec.t0>10*60000)App._crmRecStop();},250);
};
App._crmRecStop=()=>{if(!_cpRec)return;clearInterval(_cpRec.timer);try{_cpRec.rec.stop();}catch(e){_cpRec=null;_cpRecPaint(false);}};
App._crmRecCancel=()=>{if(!_cpRec)return;_cpRec.cancel=true;clearInterval(_cpRec.timer);try{_cpRec.rec.stop();}catch(e){_cpRec=null;_cpRecPaint(false);}};
function _cpRecPaint(on){var box=document.getElementById('crm-rec');var row=document.querySelector('.crm-composer .crm-sendrow');if(!box)return;
  if(on){box.style.display='flex';if(row)row.style.display='none';box.innerHTML='<button type="button" class="crm-rec-del" onclick="App._crmRecCancel()" aria-label="Cancel recording">'+ic('trash','w-5 h-5')+'</button><span class="crm-rec-dot"></span><span id="crm-rec-t" class="crm-rec-t">0:00</span><span class="crm-rec-hint">Recording… tap ➤ to send</span><button type="button" class="crm-sendbtn crm-rec-send" onclick="App._crmRecStop()" aria-label="Send voice note">'+ic('send','w-[18px] h-[18px]')+'</button>';}
  else{box.style.display='none';box.innerHTML='';if(row)row.style.display='';}}

/* voice player — one shared <audio>, waveform bar, 1×/1.5×/2× */
window._cpAudio=window._cpAudio||null;
function _cpAudioEl(){if(!_cpAudio){_cpAudio=new Audio();_cpAudio.preload='none';_cpAudio.addEventListener('timeupdate',_cpAudioTick);_cpAudio.addEventListener('ended',function(){_cpAudioStop(true);});_cpAudio.addEventListener('error',function(){toast('Could not play this voice note','err');_cpAudioStop(true);});}return _cpAudio;}
function _cpAudioBox(){return _cpAudio&&_cpAudio._box&&document.body.contains(_cpAudio._box)?_cpAudio._box:null;}
function _cpAudioTick(){var box=_cpAudioBox();if(!box)return;var a=_cpAudio;var d=a.duration&&isFinite(a.duration)?a.duration:(Number(box.getAttribute('data-dur'))||0);var p=d?Math.min(1,a.currentTime/d):0;box.style.setProperty('--p',(p*100)+'%');var t=box.querySelector('.crm-vtime');if(t)t.textContent=_crmFmtDur(a.currentTime);}
function _cpAudioStop(reset){var box=_cpAudioBox();if(box){box.classList.remove('playing');var b=box.querySelector('.crm-vplay');if(b)b.innerHTML=ic('play','w-4 h-4');if(reset){box.style.setProperty('--p','0%');var t=box.querySelector('.crm-vtime');if(t)t.textContent=_crmFmtDur(box.getAttribute('data-dur'));}}}
App._crmVoiceTog=async(btn)=>{var box=btn.closest('.crm-voice');if(!box)return;var a=_cpAudioEl();
  if(_cpAudio._box===box&&!a.paused){a.pause();_cpAudioStop(false);return;}
  if(_cpAudio._box&&_cpAudio._box!==box){a.pause();_cpAudioStop(true);}
  var p=box.getAttribute('data-cp-path');var u=box.getAttribute('data-cp-url');if(!u){await _cpSign([p]);u=_cpUrls[p]&&_cpUrls[p].url;if(u){box.setAttribute('data-cp-url',u);box.setAttribute('data-cp-ok','1');}}
  if(!u)return toast('Still uploading…');
  if(_cpAudio._box!==box||a.src!==u){a.src=u;_cpAudio._box=box;}
  a.playbackRate=Number(box.getAttribute('data-rate')||1);
  try{await a.play();}catch(e){return toast('Could not play this voice note','err');}
  box.classList.add('playing');btn.innerHTML=ic('pause','w-4 h-4');};
App._crmVoiceSeek=(ev,bar)=>{var box=bar.closest('.crm-voice');if(!box||_cpAudio._box!==box)return;var r=bar.getBoundingClientRect();var x=(ev.clientX-r.left)/r.width;var d=_cpAudio.duration&&isFinite(_cpAudio.duration)?_cpAudio.duration:(Number(box.getAttribute('data-dur'))||0);if(d)_cpAudio.currentTime=Math.max(0,Math.min(d,x*d));};
App._crmVoiceRate=(btn)=>{var box=btn.closest('.crm-voice');var r=Number(box.getAttribute('data-rate')||1);r=r===1?1.5:(r===1.5?2:1);box.setAttribute('data-rate',String(r));btn.textContent=r+'×';if(_cpAudio&&_cpAudio._box===box)_cpAudio.playbackRate=r;};

/* ═══ 6. link previews — first http(s) link in a message, fetched once by the sender via the edge function ═══ */
function _crmFirstUrl(t){var m=String(t||'').match(/https?:\/\/[^\s<>"']+/i);if(!m)return null;var u=m[0].replace(/[),.!?:;\]]+$/,'');try{new URL(u);return u;}catch(e){return null;}}
async function _crmLinkPreviewFor(cid,mid,text){
  var u=_crmFirstUrl(text);if(!u)return;
  var c=_crmConvo(cid);var m=c&&(c.messages||[]).find(function(x){return x.id===mid;});if(!m||m.linkPreview)return;
  var lp=null;try{var r=await sb.functions.invoke('link-preview',{body:{url:u}});lp=r&&r.data;}catch(e){}
  if(!lp||lp.error||!(lp.title||lp.description||lp.image))return;
  lp={url:lp.url||u,title:String(lp.title||'').slice(0,160),description:String(lp.description||'').slice(0,240),image:lp.image||'',site:lp.site||''};
  m.linkPreview=lp;_crmRepaintMsg(cid,mid);
  try{await sb.from('crm_messages').update({link_preview:lp}).eq('id',mid);}catch(e){}
}

/* ═══ 7. pin (per chat, visible to everyone) · star (per person) ═══ */
function _crmPinned(convo){return ((convo&&convo.messages)||[]).filter(function(m){return m.pinnedAt&&!m.deletedAt;}).sort(function(a,b){return String(b.pinnedAt).localeCompare(String(a.pinnedAt));});}
function _crmPinBar(convo){var ps=_crmPinned(convo);if(!ps.length)return'';var i=Math.min(CRM._pinIdx||0,ps.length-1);var m=ps[i];
  return'<div class="crm-pinbar" onclick="App._crmPinBarGo(\''+convo.id+'\')"><span class="crm-pinic">'+ic('pin','w-4 h-4')+'</span><div class="crm-pinbody"><div class="crm-pinl">Pinned'+(ps.length>1?' · '+(i+1)+' of '+ps.length:'')+' · '+esc(_crmSenderName(m))+'</div><div class="crm-pint">'+esc(_crmMsgKind(m)).slice(0,120)+'</div></div>'+(ps.length>1?'<span class="crm-pindots">'+ps.map(function(_,k){return'<i class="'+(k===i?'on':'')+'"></i>';}).join('')+'</span>':'')+'<button type="button" class="crm-pinx" onclick="event.stopPropagation();App._crmPinList(\''+convo.id+'\')" aria-label="All pinned messages">'+ic('list','w-4 h-4')+'</button></div>';}
App._crmPinBarGo=(cid)=>{var c=_crmConvo(cid);var ps=_crmPinned(c);if(!ps.length)return;var i=Math.min(CRM._pinIdx||0,ps.length-1);App._crmJumpTo(cid,ps[i].id);CRM._pinIdx=(i+1)%ps.length;var bar=document.querySelector('.crm-pinbar');if(bar&&ps.length>1){var tmp=document.createElement('div');tmp.innerHTML=_crmPinBar(c);bar.replaceWith(tmp.firstElementChild);}};
App._crmPinList=(cid)=>{var c=_crmConvo(cid);var ps=_crmPinned(c);_cpSheet('<div class="cp-list">'+(ps.length?ps.map(function(m){return'<div class="cp-msgrow" onclick="App._crmJumpTo(\''+cid+'\',\''+m.id+'\')"><div class="cp-msgwho">'+esc(_crmSenderName(m))+' · '+_crmDT(m.at)+'</div><div class="cp-msgtxt">'+esc(_crmMsgKind(m)).slice(0,200)+'</div>'+(_crmCanPart(cid)?'<button class="cp-msgx" onclick="event.stopPropagation();App._crmPin(\''+cid+'\',\''+m.id+'\')" title="Unpin">'+ic('x','w-4 h-4')+'</button>':'')+'</div>';}).join(''):'<div class="cp-empty">Nothing pinned yet.</div>')+'</div>',{title:'Pinned messages',tall:true});};
App._crmPin=async(cid,mid)=>{if(!_crmCanPart(cid))return toast('No permission','err');var c=_crmConvo(cid);var m=c&&(c.messages||[]).find(function(x){return x.id===mid;});if(!m)return;
  var on=!m.pinnedAt;m.pinnedAt=on?new Date().toISOString():null;m.pinnedBy=on?S.uid:null;_cpSheetClose();try{App._crmCloseMsgActs();}catch(e){}toast(on?'Pinned for everyone in this chat':'Unpinned');rr();
  try{await sb.from('crm_messages').update({pinned_at:m.pinnedAt,pinned_by:m.pinnedBy}).eq('id',mid);}catch(e){}};
App._crmStar=async(cid,mid)=>{CRM.stars=CRM.stars||{};var on=!CRM.stars[mid];if(on)CRM.stars[mid]={cid:cid,at:new Date().toISOString()};else delete CRM.stars[mid];_cpSheetClose();try{App._crmCloseMsgActs();}catch(e){}_crmRepaintMsg(cid,mid);toast(on?'Starred ★':'Star removed');
  try{if(on)await sb.from('crm_stars').upsert({user_id:S.uid,message_id:mid,conversation_id:cid},{onConflict:'user_id,message_id'});else await sb.from('crm_stars').delete().eq('user_id',S.uid).eq('message_id',mid);}catch(e){}};
App._crmStarred=(cidOnly)=>{var ids=Object.keys(CRM.stars||{});var rows=[];ids.forEach(function(mid){var st=CRM.stars[mid];if(cidOnly&&st.cid!==cidOnly)return;var c=_crmConvo(st.cid);var m=c&&(c.messages||[]).find(function(x){return x.id===mid;});if(m)rows.push({c:c,m:m,at:st.at});});rows.sort(function(a,b){return String(b.at).localeCompare(String(a.at));});
  _cpSheet('<div class="cp-list">'+(rows.length?rows.map(function(r){var name=_crmIsDM(r.c)?(_crmDMPeer(r.c)?fullName(_crmDMPeer(r.c)):'Direct message'):(r.c.title||r.c.customer||'');return'<div class="cp-msgrow" onclick="App._crmJumpTo(\''+r.c.id+'\',\''+r.m.id+'\')"><div class="cp-msgwho">'+esc(_crmSenderName(r.m))+(cidOnly?'':' · '+esc(name))+' · '+_crmDT(r.m.at)+'</div><div class="cp-msgtxt">'+esc(_crmMsgKind(r.m)).slice(0,200)+'</div><button class="cp-msgx" onclick="event.stopPropagation();App._crmStar(\''+r.c.id+'\',\''+r.m.id+'\')" title="Remove star">'+ic('x','w-4 h-4')+'</button></div>';}).join(''):'<div class="cp-empty">No starred messages yet — long press a message and tap Star.</div>')+'</div>',{title:'Starred messages',tall:true});};

/* ═══ 8. message menu — hover ⋯ on desktop, long press on phones (emoji row + actions, WhatsApp style) ═══ */
App._crmMsgMenu=(ev,cid,mid)=>{if(ev&&ev.stopPropagation)ev.stopPropagation();var c=_crmConvo(cid);var m=c&&(c.messages||[]).find(function(x){return x.id===mid;});if(!m||m.deletedAt)return;
  var part=_crmCanPart(cid);var own=!m.fromCustomer&&m.senderId===S.uid;var mob=_crmIsMob();
  var it=function(icon,label,fn,cls){return'<button class="cp-item'+(cls?' '+cls:'')+'" onclick="'+fn+'">'+ic(icon,'w-4 h-4')+'<span>'+label+'</span></button>';};
  var fromBar=!!(ev&&ev.target);var h='';
  if(mob&&part&&!fromBar)h+='<div class="cp-emorow">'+_CRM_EMO.map(function(e){return'<button onclick="_cpSheetClose();App._crmReact(\''+cid+'\',\''+mid+'\',\''+encodeURIComponent(e)+'\')">'+e+'</button>';}).join('')+'<button class="cp-emoplus" onclick="_cpSheetClose();App._crmEmoOpen(event,\'react\',\''+cid+'\',\''+mid+'\')">+</button></div>';
  h+='<div class="cp-list">';
  if(!fromBar){
  if(part&&!m.parentId)h+=it('reply','Reply','App._crmQuote(\''+cid+'\',\''+mid+'\')');
  if(part&&!m.parentId)h+=it('msg','Reply in thread','_cpSheetClose();App._crmOpenThread(\''+mid+'\')');
  if(part)h+=it('forward','Forward…','App._crmForward(\''+mid+'\')');}
  if(m.text)h+=it('copy','Copy text','App._crmCopy(\''+cid+'\',\''+mid+'\')');
  h+=it('star',_crmIsStarred(mid)?'Unstar':'Star','App._crmStar(\''+cid+'\',\''+mid+'\')');
  if(part&&!m.parentId)h+=it('pin',m.pinnedAt?'Unpin':'Pin','App._crmPin(\''+cid+'\',\''+mid+'\')');
  if(own)h+=it('info','Message info','App._crmMsgInfo(\''+cid+'\',\''+mid+'\')');
  if(own&&part&&_crmCanEdit(m))h+=it('edit','Edit','_cpSheetClose();App._crmEditMsg(\''+cid+'\',\''+mid+'\')');
  if((own&&part)||can('crm','delete'))h+=it('trash','Delete','_cpSheetClose();App._crmDelMsg(\''+cid+'\',\''+mid+'\')','cp-item-del');
  h+='</div>';
  if(mob){try{App._crmCloseMsgActs();}catch(e){}_cpSheet(h,{});return;}
  /* desktop: small popover next to the ⋯ */
  var pop=document.getElementById('cp-pop');if(!pop){pop=document.createElement('div');pop.id='cp-pop';document.body.appendChild(pop);document.addEventListener('click',function(e){if(!e.target.closest('#cp-pop'))pop.classList.remove('on');},true);}
  pop.innerHTML=h;pop.classList.add('on');var r=ev&&ev.target&&ev.target.closest('button')?ev.target.closest('button').getBoundingClientRect():{left:innerWidth/2,bottom:innerHeight/2};
  var W=220,H=pop.offsetHeight||300;var x=Math.min(Math.max(8,r.left-W/2),innerWidth-W-8);var y=r.bottom+6;if(y+H>innerHeight-8)y=Math.max(8,r.top-H-6);pop.style.left=x+'px';pop.style.top=y+'px';};
document.addEventListener('click',function(e){var p=document.getElementById('cp-pop');if(p&&p.classList.contains('on')&&e.target.closest&&e.target.closest('#cp-pop .cp-item'))setTimeout(function(){p.classList.remove('on');},0);},true);
/* v138 — phones: a long press (CRM_LONG_PRESS_MS) shows the floating bar on the bubble — quick emojis · Reply · Thread ·
   Forward · ⋯ — exactly like desktop hover. ⋯ opens the sheet with the rest (copy, star, pin, info, edit, delete). */
try{CRM_LONG_PRESS_MS=1500;}catch(e){}
App._crmCopy=async(cid,mid)=>{var c=_crmConvo(cid);var m=c&&(c.messages||[]).find(function(x){return x.id===mid;});_cpSheetClose();if(!m||!m.text)return;try{await navigator.clipboard.writeText(m.text);toast('Copied');}catch(e){try{var ta=document.createElement('textarea');ta.value=m.text;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();toast('Copied');}catch(x){toast('Copy failed','err');}}};
/* “Message info” — read / delivered / not yet, per member, from crm_reads (last_seen_at ≥ message time = read) */
App._crmMsgInfo=(cid,mid)=>{var c=_crmConvo(cid);var m=c&&(c.messages||[]).find(function(x){return x.id===mid;});if(!m)return;var b=_crmBoard(c.boardId);
  var others=_crmEffMemberIds(b,c).filter(function(id){if(id===S.uid)return false;var u=uById(id);return u&&u.status!=='Disabled';});
  var r=(CRM.readsAll||{})[cid]||{};var read=[],deliv=[],none=[];
  others.forEach(function(id){var x=r[id]||{};if(x.seen&&String(x.seen)>=String(m.at))read.push({id:id,at:x.seen});else if(x.deliv&&String(x.deliv)>=String(m.at))deliv.push({id:id,at:x.deliv});else none.push({id:id});});
  var grp=function(title,arr,tick){if(!arr.length)return'';return'<div class="cp-sec">'+tick+' '+title+' · '+arr.length+'</div>'+arr.map(function(p){var u=uById(p.id);return'<div class="cp-person">'+avatar(u,'w-8 h-8','text-[10px]')+'<span class="cp-pname">'+esc(fullName(u))+'</span>'+(p.at?'<span class="cp-ptime">'+_crmDT(p.at)+'</span>':'')+'</div>';}).join('');};
  _cpSheet('<div class="cp-msgprev">'+esc(_crmMsgKind(m)).slice(0,160)+'<div class="cp-msgwho">Sent '+_crmDT(m.at)+'</div></div>'+grp('Read',read,'<span class="crm-tk-read" style="display:inline-flex">'+_CRM_TK_TWO+'</span>')+grp('Delivered',deliv,'<span style="display:inline-flex;color:#A59788">'+_CRM_TK_TWO+'</span>')+grp('Not yet delivered',none,'<span style="display:inline-flex;color:#A59788">'+_CRM_TK_ONE+'</span>')+(others.length?'':'<div class="cp-empty">Nobody else is in this chat.</div>'),{title:'Message info',tall:true});};

/* ═══ 9. forward — pick several chats / people, keeps photos, files and voice notes, marks “Forwarded” ═══ */
App._crmForward=(mid)=>{var m=null,src=null;for(var i=0;i<CRM.convos.length&&!m;i++){var mm=(CRM.convos[i].messages||[]).find(function(x){return x.id===mid;});if(mm){m=mm;src=CRM.convos[i];}}if(!m)return;
  CRM._fwd={mid:mid,sel:{},q:''};_cpSheet('<div class="cp-msgprev">'+esc(_crmMsgKind(m)).slice(0,120)+'</div><input id="cp-fwd-q" type="search" class="cp-search" placeholder="Search chats and people…" autocomplete="off" oninput="CRM._fwd.q=this.value;App._crmFwdList()"/><div id="cp-fwd-list" class="cp-list"></div><div class="cp-foot"><span id="cp-fwd-n" class="cp-foot-n"></span><button class="cp-btn" onclick="App._crmDoForward()">'+ic('forward','w-4 h-4')+'Forward</button></div>',{title:'Forward to…',tall:true});App._crmFwdList();};
App._crmFwdList=()=>{var st=CRM._fwd;if(!st)return;var q=String(st.q||'').trim().toLowerCase();var vis=_crmVisibleBoardIds();
  var list=CRM.convos.filter(function(c){return (vis[c.boardId]||(_crmIsDM(c)&&_crmDMVisible(c)))&&_crmCanPart(c.id);}).map(function(c){var p=_crmIsDM(c)?_crmDMPeer(c):null;var b=_crmBoard(c.boardId);return{c:c,name:p?fullName(p):(c.title||c.customer||'—'),sub:p?'Direct message':((b?b.name:'')+(c.customer&&c.customer!==c.title?' · '+c.customer:'')),av:p?avatar(p,'w-9 h-9','text-[11px]'):_crmCustAv(c.customer||c.title,36)};}).filter(function(x){return !q||(x.name+' '+x.sub).toLowerCase().indexOf(q)>=0;}).sort(function(a,b){return String(b.c.lastAt||'').localeCompare(String(a.c.lastAt||''));}).slice(0,80);
  /* people without a DM yet */
  var people=q?(DB.users||[]).filter(function(u){return u&&u.id!==S.uid&&u.status==='Active'&&fullName(u).toLowerCase().indexOf(q)>=0&&can('messages','send')&&!CRM.convos.some(function(c){return _crmIsDM(c)&&(c.dmMembers||[]).indexOf(String(u.id))>=0;});}).slice(0,10):[];
  var el=document.getElementById('cp-fwd-list');if(!el)return;
  el.innerHTML=list.map(function(x){var on=!!st.sel[x.c.id];return'<button class="cp-item cp-pick'+(on?' on':'')+'" onclick="App._crmFwdTog(\''+x.c.id+'\')">'+x.av+'<span class="cp-pickbody"><span class="cp-pickn">'+esc(x.name)+'</span><span class="cp-picks">'+esc(x.sub)+'</span></span><span class="cp-tick">'+ic('check','w-3.5 h-3.5')+'</span></button>';}).join('')
    +people.map(function(u){var k='u:'+u.id;var on=!!st.sel[k];return'<button class="cp-item cp-pick'+(on?' on':'')+'" onclick="App._crmFwdTog(\''+k+'\')">'+avatar(u,'w-9 h-9','text-[11px]')+'<span class="cp-pickbody"><span class="cp-pickn">'+esc(fullName(u))+'</span><span class="cp-picks">New direct message</span></span><span class="cp-tick">'+ic('check','w-3.5 h-3.5')+'</span></button>';}).join('')
    +((list.length||people.length)?'':'<div class="cp-empty">No chats match.</div>');
  var n=Object.keys(st.sel).length;var nn=document.getElementById('cp-fwd-n');if(nn)nn.textContent=n?n+' selected':'';};
App._crmFwdTog=(k)=>{var st=CRM._fwd;if(!st)return;if(st.sel[k])delete st.sel[k];else st.sel[k]=1;App._crmFwdList();};
App._crmDoForward=async()=>{var st=CRM._fwd;if(!st)return;var keys=Object.keys(st.sel);if(!keys.length)return toast('Pick at least one chat');
  var m=null;for(var i=0;i<CRM.convos.length&&!m;i++){var mm=(CRM.convos[i].messages||[]).find(function(x){return x.id===st.mid;});if(mm)m=mm;}if(!m)return;
  _cpSheetClose();CRM._fwd=null;var n=0;
  for(var k=0;k<keys.length;k++){var key=keys[k];var tgt=null;
    if(key.indexOf('u:')===0){try{var pid=key.slice(2);if(typeof _dmIdFor==='function'){var did=_dmIdFor(S.uid,pid);tgt=_crmConvo(did);if(!tgt){var peer=uById(pid);var at0=new Date().toISOString();tgt={id:did,boardId:null,title:fullName(peer),customer:fullName(peer),channel:'dm',isTicket:false,ticketType:null,priority:'Medium',status:'Open',assignedTo:null,assignedGroup:null,createdBy:S.uid,decision:null,fields:{},dueDate:null,createdAt:at0,lastAt:at0,kind:'dm',dmMembers:[String(S.uid),String(pid)],messages:[]};CRM.convos.unshift(tgt);await sb.from('crm_conversations').upsert({id:did,board_id:null,title:fullName(peer),customer:fullName(peer),channel:'dm',is_ticket:false,created_by:S.uid,created_at:at0,last_at:at0,kind:'dm',dm_members:[String(S.uid),String(pid)]},{onConflict:'id',ignoreDuplicates:true});}}}catch(e){}}
    else tgt=_crmConvo(key);
    if(!tgt)continue;
    var id=uid('msg'),at=new Date().toISOString();
    var fm={id:id,senderId:S.uid,fromCustomer:false,text:m.text||'',images:(m.images||[]).slice(),at:at,reactions:{},parentId:null,forwarded:true,attachments:(m.attachments||[]).slice(),sticker:m.sticker||null,linkPreview:m.linkPreview||null,replyTo:null};
    tgt.messages.push(fm);tgt.lastAt=at;n++;
    try{await sb.from('crm_messages').insert({id:id,conversation_id:tgt.id,sender_id:S.uid||null,from_customer:false,body:fm.text,images:fm.images,created_at:at,forwarded:true,attachments:fm.attachments,sticker:fm.sticker,link_preview:fm.linkPreview});await sb.from('crm_conversations').update({last_at:at}).eq('id',tgt.id);}catch(e){}
  }
  toast('Forwarded to '+n+' chat'+(n===1?'':'s')+' ✓');rr();};

/* ═══ 10. emoji + stickers — the picker gets a second page ═══ */
var _CRM_STICKERS=[
  ['Reactions','👍','👍 👎 👏 🙌 🙏 💪 🤝 ✌️ 🤞 👌 🫡 🫶 🔥 ⭐ 💯 ✅ ❌ ❤️ 💔 🎯'],
  ['Moods','😂','😂 🤣 😍 🥰 😎 🤩 🥳 😴 🤯 😱 😭 🥺 🙄 😤 🤔 🫠 🫣 🤗 😇 🤠'],
  ['Work','☕','☕ 💻 📱 📊 📈 📉 📅 ⏰ ⏳ 🚀 🧠 💡 📌 📎 🗂️ ✍️ 🔧 🧰 🛠️ 🏁'],
  ['Celebrate','🎉','🎉 🎊 🎈 🎂 🍰 🥂 🍾 🎁 🏆 🥇 🎖️ 🌟 ✨ 💐 🌹 🌸 🦄 🐣 🎵 🎶'],
  ['Food','🍕','🍕 🍔 🍟 🌮 🍣 🍜 🍩 🍪 🧁 🍫 🍎 🍉 🥑 🥗 🍿 🧋 🍵 🥤 🍦 🍇'],
  ['Animals','🐶','🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🦄 🐝 🦋']
];
function _crmEmoRender(){var h=_crmEmoHost();var st=CRM._emo||{};var rec=_crmEmoRec();var page=st.page||'emoji';var cat=st.cat;
  var top='<div class="crm-epages"><button class="'+(page==='emoji'?'on':'')+'" data-page="emoji">Emoji</button>'+(st.mode==='react'?'':'<button class="'+(page==='stick'?'on':'')+'" data-page="stick">Stickers</button>')+'</div>';
  if(page==='stick'){var sc=(st.scat==null)?0:st.scat;var tabs='<div class="crm-ehd">'+_CRM_STICKERS.map(function(c,i){return'<button class="crm-ecat'+(sc===i?' on':'')+'" data-si="'+i+'" title="'+c[0]+'">'+c[1]+'</button>';}).join('')+'</div>';
    var grid='<div class="crm-sgrid">'+_CRM_STICKERS[sc][2].split(' ').map(function(e){return'<button class="crm-sstk">'+e+'</button>';}).join('')+'</div>';
    h.innerHTML=top+tabs+grid;return;}
  if(cat===undefined||cat===null)cat=(rec.length?-1:0);CRM._emo.cat=cat;
  var tabs2='<button class="crm-ecat'+(cat===-1?' on':'')+'" data-i="-1" title="Recent">🕘</button>'+_CRM_EMOJI.map(function(c,i){return'<button class="crm-ecat'+(cat===i?' on':'')+'" data-i="'+i+'" title="'+c[0]+'">'+c[1]+'</button>';}).join('');
  var list=cat===-1?rec:(_CRM_EMOJI[cat]?_CRM_EMOJI[cat][2].split(' '):[]);
  var grid2=list.length?list.map(function(e){return'<button class="crm-eemo">'+e+'</button>';}).join(''):'<div class="crm-elab" style="padding:14px 4px">Nothing here yet — pick a few and they will land in Recent.</div>';
  h.innerHTML=top+'<div class="crm-ehd">'+tabs2+'</div><div class="crm-egrid">'+grid2+'</div>';}
(function(){var h=_crmEmoHost();h.addEventListener('click',function(ev){var b=ev.target.closest?ev.target.closest('button'):null;if(!b)return;
  if(b.getAttribute('data-page')){ev.stopPropagation();CRM._emo.page=b.getAttribute('data-page');_crmEmoRender();return;}
  if(b.getAttribute('data-si')!=null){ev.stopPropagation();CRM._emo.scat=parseInt(b.getAttribute('data-si'),10);_crmEmoRender();return;}
  if(b.classList.contains('crm-sstk')){ev.stopPropagation();App._crmEmoClose();var st=b.textContent.trim();if(CRM._emo&&CRM._emo.mode==='tinput')return;App._crmSend({sticker:st});return;}},true);})();

/* ═══ 11. chat info — tap the name: members, media, files, links, mute, pinned, starred, archive, leave ═══ */
function _crmLastSeenText(u){if(!u)return'';if(window._bbOnline&&window._bbOnline[u.id])return'Online';var t=u.lastSeenAt;if(!t)return'';try{var d=new Date(t),n=new Date();var same=d.toDateString()===n.toDateString();var y=new Date(n);y.setDate(n.getDate()-1);var hm=d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});if(same)return'Last seen today at '+hm;if(d.toDateString()===y.toDateString())return'Last seen yesterday at '+hm;if((n-d)<7*864e5)return'Last seen '+d.toLocaleDateString('en-GB',{weekday:'long'})+' at '+hm;return'Last seen '+d.toLocaleDateString('en-GB',{day:'numeric',month:'short'});}catch(e){return'';}}
function _crmGroupSub(convo,board){try{var ids=_crmEffMemberIds(board,convo).filter(function(id){var u=uById(id);return u&&u.status!=='Disabled';});var on=ids.filter(function(id){return window._bbOnline&&window._bbOnline[id];}).length;if(!ids.length)return esc(convo.customer||'')+(convo.channel?' · '+esc(convo.channel):'');var names=ids.slice(0,4).map(function(id){var u=uById(id);return u?_crmFirst(u):'';}).filter(Boolean).join(', ');return ids.length+' member'+(ids.length===1?'':'s')+(on?' · <span style="color:#346A47;font-weight:700">'+on+' online</span>':'')+(names?' · '+esc(names)+(ids.length>4?'…':''):'');}catch(e){return'';}}
(function(){if(typeof _dmPeerStatus!=='function')return;var _o=_dmPeerStatus;_dmPeerStatus=function(p){var s=_o(p);var ls=_crmLastSeenText(p);if(ls&&ls!=='Online'&&s.indexOf('Online')<0)s='<span style="color:#786A5F">'+esc(ls)+'</span>'+(s&&s!=='Direct message'?' · '+s:'');return s;};})();
App._crmChatInfo=(cid,tab)=>{var c=_crmConvo(cid);if(!c)return;var b=_crmBoard(c.boardId);var peer=_crmIsDM(c)?_crmDMPeer(c):null;tab=tab||'members';
  var ids=peer?[peer.id]:_crmEffMemberIds(b,c).filter(function(id){var u=uById(id);return u&&u.status!=='Disabled';});
  var msgs=(c.messages||[]).filter(function(m){return !m.deletedAt;});
  var media=[];msgs.forEach(function(m){(m.images||[]).forEach(function(src){media.push({m:m,src:src});});(m.attachments||[]).forEach(function(a){if(a.kind==='video')media.push({m:m,vid:a});});});
  var files=[];msgs.forEach(function(m){(m.attachments||[]).forEach(function(a){if(a.kind==='file'||a.kind==='audio')files.push({m:m,a:a});});});
  var links=[];msgs.forEach(function(m){var re=/https?:\/\/[^\s<>"']+/gi,x;while((x=re.exec(m.text||'')))links.push({m:m,u:x[0].replace(/[),.!?:;\]]+$/,'')});});
  var pinned=_crmPinned(c).length,starred=Object.keys(CRM.stars||{}).filter(function(k){return CRM.stars[k].cid===cid;}).length;
  var tabs=[['members',peer?'Profile':'Members',ids.length],['media','Media',media.length],['files','Files',files.length],['links','Links',links.length]];
  var body='';
  if(tab==='members'){body='<div class="cp-list">'+ids.map(function(id){var u=uById(id);if(!u)return'';var on=window._bbOnline&&window._bbOnline[id];return'<div class="cp-person" onclick="'+(typeof App.openProfile==='function'?'_cpSheetClose();App.openProfile(\''+id+'\')':'')+'">'+avatar(u,'w-9 h-9','text-[11px]')+'<span class="cp-pbody"><span class="cp-pname">'+esc(fullName(u))+(id===S.uid?' <span class="cp-you">you</span>':'')+'</span><span class="cp-psub">'+esc([u.position,u.department].filter(Boolean).join(' · '))+'</span></span><span class="cp-ptime'+(on?' cp-on':'')+'">'+esc(_crmLastSeenText(u).replace(/^Last seen /,'')||'')+'</span></div>';}).join('')+'</div>';}
  else if(tab==='media'){body=media.length?'<div class="cp-media">'+media.slice().reverse().map(function(x){return x.src?'<img src="'+x.src+'" alt="" onclick="_cpSheetClose();App._crmJumpTo(\''+cid+'\',\''+x.m.id+'\')"/>':'<video data-cp-path="'+esc(x.vid.path)+'" preload="metadata" muted playsinline onclick="_cpSheetClose();App._crmJumpTo(\''+cid+'\',\''+x.m.id+'\')"></video>';}).join('')+'</div>':'<div class="cp-empty">No photos or videos yet.</div>';}
  else if(tab==='files'){body=files.length?'<div class="cp-list">'+files.slice().reverse().map(function(x){var a=x.a;return'<a class="crm-file cp-filerow" href="#" data-cp-path="'+esc(a.path||'')+'" data-cp-name="'+esc(a.name||'file')+'" onclick="event.preventDefault();App._crmOpenFile(this)"><span class="crm-fic">'+esc(a.kind==='audio'?'🎤':_crmFileIcon(a))+'</span><span class="crm-fbody"><span class="crm-fname">'+esc(a.name||'File')+'</span><span class="crm-fmeta">'+esc(_crmSenderName(x.m))+' · '+_crmDT(x.m.at)+' · '+_crmFmtSize(a.size)+'</span></span><span class="crm-fdl">'+ic('download','w-4 h-4')+'</span></a>';}).join('')+'</div>':'<div class="cp-empty">No files yet.</div>';}
  else{body=links.length?'<div class="cp-list">'+links.slice().reverse().map(function(x){var host='';try{host=new URL(x.u).hostname.replace(/^www\./,'');}catch(e){}return'<a class="cp-linkrow" href="'+esc(x.u)+'" target="_blank" rel="noopener noreferrer"><span class="cp-linkic">'+ic('link','w-4 h-4')+'</span><span class="cp-pbody"><span class="cp-pname">'+esc(host||x.u)+'</span><span class="cp-psub">'+esc(x.u).slice(0,90)+' · '+esc(_crmSenderName(x.m))+' · '+_crmDT(x.m.at)+'</span></span></a>';}).join('')+'</div>':'<div class="cp-empty">No links yet.</div>';}
  var muted=_crmMuted(cid),pf=_crmPrefs(cid);
  var head='<div class="cp-chathead">'+(peer?avatar(peer,'w-16 h-16','text-[18px]'):_crmCustAv(c.customer||c.title,64))+'<div class="cp-chatname">'+esc(peer?fullName(peer):(c.title||c.customer||'—'))+'</div><div class="cp-chatsub">'+(peer?esc([peer.position,peer.department].filter(Boolean).join(' · ')||_crmLastSeenText(peer)):esc((b?b.name:'')+(c.customer&&c.customer!==c.title?' · '+c.customer:''))+' · started '+_crmDT(c.createdAt))+'</div>'
    +'<div class="cp-quick"><button class="cp-qbtn'+(muted?' on':'')+'" onclick="App._crmMuteAsk(\''+cid+'\')">'+ic(muted?'bellOff':'bell','w-4 h-4')+'<span>'+(muted?'Muted':'Mute')+'</span></button><button class="cp-qbtn" onclick="App._crmPinList(\''+cid+'\')">'+ic('pin','w-4 h-4')+'<span>Pinned'+(pinned?' · '+pinned:'')+'</span></button><button class="cp-qbtn" onclick="App._crmStarred(\''+cid+'\')">'+ic('star','w-4 h-4')+'<span>Starred'+(starred?' · '+starred:'')+'</span></button><button class="cp-qbtn" onclick="_cpSheetClose();App._crmMsgSearchTog()">'+ic('search','w-4 h-4')+'<span>Search</span></button></div></div>';
  var tabbar='<div class="cp-tabs">'+tabs.map(function(t){return'<button class="'+(tab===t[0]?'on':'')+'" onclick="App._crmChatInfo(\''+cid+'\',\''+t[0]+'\')">'+t[1]+(t[2]?' <b>'+t[2]+'</b>':'')+'</button>';}).join('')+'</div>';
  var canLeave=!peer&&b&&(b.members||[]).indexOf(S.uid)>=0&&!(CRM.hubMembers&&(CRM.hubMembers[b.hubId]||[]).indexOf(S.uid)>=0);
  var foot='<div class="cp-list cp-danger"><button class="cp-item" onclick="App._crmPinChat(\''+cid+'\','+(pf.pinned?'false':'true')+')">'+ic('pin','w-4 h-4')+'<span>'+(pf.pinned?'Unpin from top':'Pin chat to top')+'</span></button><button class="cp-item" onclick="App._crmArchive(\''+cid+'\','+(pf.archived?'false':'true')+')">'+ic('archive','w-4 h-4')+'<span>'+(pf.archived?'Unarchive chat':'Archive chat')+'</span></button>'+(canLeave?'<button class="cp-item cp-item-del" onclick="App._crmLeaveBoard(\''+b.id+'\')">'+ic('logoutR','w-4 h-4')+'<span>Leave “'+esc(b.name)+'”</span></button>':'')+'</div>';
  _cpSheet(head+tabbar+'<div class="cp-tabbody">'+body+'</div>'+foot,{title:peer?'Contact info':'Chat info',tall:true,wide:true});};
App._crmLeaveBoard=async(bid)=>{var b=_crmBoard(bid);if(!b)return;if(!(await _crmConfirmP('Leave board','You will stop seeing “'+esc(b.name)+'” and its chats. An admin can add you back later.','Leave')))return;_cpSheetClose();
  b.members=(b.members||[]).filter(function(x){return x!==S.uid;});CRM.sel.convoId=null;if(CRM.sel.boardId===bid)CRM.sel.boardId=null;rr();
  try{await sb.from('crm_board_members').delete().eq('board_id',bid).eq('user_id',S.uid);}catch(e){}toast('You left “'+b.name+'”');};

/* ═══ 11b. board actions on phones — one ⋯ instead of three buttons in the tab strip ═══ */
App._crmBoardMenu=(bid)=>{var b=_crmBoard(bid);if(!b)return;var inView=!!CRM.sel.viewId;var v=inView?_crmView(CRM.sel.viewId):null;
  var it=function(icon,label,fn,cls){return'<button class="cp-item'+(cls?' '+cls:'')+'" onclick="_cpSheetClose();'+fn+'">'+ic(icon,'w-4 h-4')+'<span>'+label+'</span></button>';};
  var h='<div class="cp-list">';
  if(inView){if(_crmViewCanEdit(v))h+=it('x','Remove board from this view','App._crmViewHideBoard(\''+bid+'\')');}
  else{
    if(_crmCanBoardMembers())h+=it('users','Board members · '+_crmBoardPeople(b).length,'App._crmTogMembers()');
    if(can('crm','rename'))h+=it('edit','Rename board','App._crmRenameBoard(\''+bid+'\')');
    if(can('crm','delete'))h+=it('trash','Delete board','App._crmDelBoard(\''+bid+'\')','cp-item-del');
  }
  h+='</div>';if(h==='<div class="cp-list"></div>')return;_cpSheet(h,{title:b.name});};
/* ═══ 12. chat-list row: long press or swipe left → pin / mute / archive / mark unread ═══ */
App._crmRowMenu=(cid)=>{var c=_crmConvo(cid);if(!c)return;var pf=_crmPrefs(cid),muted=_crmMuted(cid);var peer=_crmIsDM(c)?_crmDMPeer(c):null;
  var it=function(icon,label,fn,cls){return'<button class="cp-item'+(cls?' '+cls:'')+'" onclick="'+fn+'">'+ic(icon,'w-4 h-4')+'<span>'+label+'</span></button>';};
  _cpSheet('<div class="cp-msgprev">'+esc(peer?fullName(peer):(c.title||c.customer||''))+'</div><div class="cp-list">'
    +it('pin',pf.pinned?'Unpin from top':'Pin to top','App._crmPinChat(\''+cid+'\','+(pf.pinned?'false':'true')+')')
    +it(muted?'bell':'bellOff',muted?'Unmute':'Mute…',muted?'App._crmMute(\''+cid+'\',\'\')':'App._crmMuteAsk(\''+cid+'\')')
    +(_crmUnread(c)?'':it('msg','Mark as unread','App._crmMarkUnread(\''+cid+'\')'))
    +it('archive',pf.archived?'Unarchive':'Archive','App._crmArchive(\''+cid+'\','+(pf.archived?'false':'true')+')')
    +it('info','Chat info','App._crmChatInfo(\''+cid+'\')')
    +((peer?can('messages','delete'):can('crm','delete'))?it('trash','Delete chat','_cpSheetClose();'+(peer?'App._dmDelete':'App._crmDelConvo')+'(\''+cid+'\')','cp-item-del'):'')+'</div>',{});};
(function(){
  var lp=null,sw=null;
  document.addEventListener('touchstart',function(e){var row=e.target.closest&&e.target.closest('#crm-list .crm-row[data-cid]');if(!row)return;if(e.target.closest('button'))return;var t=e.touches[0];
    lp={row:row,x:t.clientX,y:t.clientY,timer:setTimeout(function(){if(!lp)return;lp.fired=true;row._cpHold=Date.now();try{if(navigator.vibrate)navigator.vibrate(12);}catch(_){}App._crmRowMenu(row.getAttribute('data-cid'));},550)};sw={row:row,x:t.clientX,y:t.clientY,d:0,go:false};},{passive:true});
  document.addEventListener('touchmove',function(e){var t=e.touches[0];if(lp&&(Math.abs(t.clientX-lp.x)>10||Math.abs(t.clientY-lp.y)>10)){clearTimeout(lp.timer);lp=null;}
    if(!sw)return;var dx=t.clientX-sw.x,dy=t.clientY-sw.y;if(!sw.go){if(Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)){sw=null;return;}if(dx<-14&&Math.abs(dx)>Math.abs(dy)*1.2)sw.go=true;else return;}
    var d=Math.max(-90,Math.min(0,dx));sw.d=d;sw.row.style.transform='translateX('+d+'px)';sw.row.classList.toggle('crm-swl',d<-60);},{passive:true});
  var end=function(){if(lp){clearTimeout(lp.timer);var fired=lp.fired;lp=null;if(fired){if(sw){sw.row.style.transform='';sw.row.classList.remove('crm-swl');sw=null;}return;}}
    if(!sw)return;var row=sw.row,ok=sw.d<-60;row.style.transition='transform .18s ease';row.style.transform='';setTimeout(function(){row.style.transition='';},220);row.classList.remove('crm-swl');
    if(ok){row._cpHold=Date.now();try{if(navigator.vibrate)navigator.vibrate(10);}catch(e){}App._crmRowMenu(row.getAttribute('data-cid'));}sw=null;};
  document.addEventListener('touchend',end,{passive:true});document.addEventListener('touchcancel',end,{passive:true});
  /* the tap that ends a long press or a swipe must not also open the chat */
  document.addEventListener('click',function(e){var row=e.target.closest&&e.target.closest('#crm-list .crm-row[data-cid]');if(row&&row._cpHold&&Date.now()-row._cpHold<900){e.stopPropagation();e.preventDefault();row._cpHold=0;}},true);
  /* desktop: right-click a row */
  document.addEventListener('contextmenu',function(e){var row=e.target.closest&&e.target.closest('#crm-list .crm-row[data-cid]');if(!row)return;e.preventDefault();App._crmRowMenu(row.getAttribute('data-cid'));});
})();
function _dmArchivedN(){try{return (CRM.convos||[]).filter(function(c){return _crmIsDM(c)&&_crmDMVisible(c)&&_crmPrefs(c.id).archived;}).length;}catch(e){return 0;}}
/* the direct-message list honours pin / archive too */
(function(){if(typeof _dmConvos!=='function')return;var _o=_dmConvos;_dmConvos=function(){var lf=CRM.listFilter||'all';return _o().filter(function(c){var ar=!!_crmPrefs(c.id).archived;return lf==='archived'?ar:!ar;}).sort(function(a,b){var pa=_crmPrefs(a.id).pinned?1:0,pb=_crmPrefs(b.id).pinned?1:0;if(pa!==pb)return pb-pa;return String(b.lastAt||'').localeCompare(String(a.lastAt||''));});};})();


/* ═══ 14. v140 — entering the Workspace (tab / bottom nav) opens the chat at its NEWEST message and marks it read;
   on phones the whole workspace is fitted to the visible viewport (keyboard open or closed) so the page never moves ═══ */
(function(){var _o=crmPage;crmPage=function(){var wasOpen=!!document.getElementById('crm-thread');var preCid=CRM&&CRM.sel?CRM.sel.convoId:null;var h=_o.apply(this,arguments);try{var cid=CRM&&CRM.sel&&CRM.sel.convoId;
  if(cid&&(!wasOpen||CRM._paintedConvo!==cid||preCid!==cid)){CRM._paintedConvo=cid;setTimeout(function(){try{_crmScrollBottom();if(document.visibilityState!=='hidden')_crmMarkRead(cid);_crmLoadImagesFor(cid);}catch(e){}},0);}
  if(!cid)CRM._paintedConvo=null;}catch(e){}return h;};})();
function _cpFitViewport(){try{
  if(!window.visualViewport||!_crmIsMob()){document.documentElement.style.removeProperty('--vvh');document.documentElement.style.removeProperty('--vvt');return;}
  var vv=window.visualViewport;document.documentElement.style.setProperty('--vvh',Math.round(vv.height)+'px');document.documentElement.style.setProperty('--vvt',Math.round(vv.offsetTop)+'px');document.documentElement.classList.toggle('cp-kb',(window.innerHeight-vv.height)>120);
  var th=document.getElementById('crm-thread');if(th&&(th.scrollHeight-th.scrollTop-th.clientHeight)<200)setTimeout(function(){th.scrollTop=th.scrollHeight;},50);
  if(document.querySelector('.crm-fs')&&(window.scrollY||window.scrollX))window.scrollTo(0,0);
}catch(e){}}
(function(){if(!window.visualViewport)return;var t=null;var f=function(){if(t)return;t=setTimeout(function(){t=null;_cpFitViewport();},40);};window.visualViewport.addEventListener('resize',f);window.visualViewport.addEventListener('scroll',f);window.addEventListener('orientationchange',f);document.addEventListener('focusin',function(e){if(e.target&&e.target.closest&&e.target.closest('.crm-fs'))setTimeout(_cpFitViewport,120);});_cpFitViewport();})();


/* ═══ 15. v141 — touch fixes ═══
   · iOS treats an element with an inline onmouseover as "hover first, click second": the first tap only hovered, so rows and
     buttons needed two taps. On touch screens those inline hover handlers are stripped as they render.
   · The message bar must never appear from a tap or while scrolling (a tap makes iOS apply :hover); only a 2 s hold opens it.
   · Expanding / collapsing a hub inside the phone drawer keeps the drawer open. */
try{CRM_LONG_PRESS_MS=1000;}catch(e){}
(function(){
  var touch=('ontouchstart' in window)||(navigator.maxTouchPoints>0);
  if(!touch)return;
  var strip=function(root){try{(root.querySelectorAll?root:document).querySelectorAll('[onmouseover],[onmouseout]').forEach(function(el){el.removeAttribute('onmouseover');el.removeAttribute('onmouseout');});}catch(e){}};
  document.documentElement.classList.add('cp-touch');strip(document);window._cpStrip=strip;
})();
(function(){var _o=App._crmTogHub;App._crmTogHub=function(id){var r=_o.apply(this,arguments);try{if(_crmIsMob())App._crmMobNav(true);}catch(e){}return r;};})();


/* ═══ 16. v147 — profile from the menu is always MY profile · columns manager · ticket (i) sheet · board switcher ═══ */
(function(){var _go=App.go;App.go=function(r){try{if(r==='profile'&&typeof S!=='undefined'&&S.filters)S.filters.profUid=null;}catch(e){}var out=_go.apply(this,arguments);try{if(r==='profile'&&S.filters&&S.filters.profUid){S.filters.profUid=null;rr();}}catch(e){}return out;};})();

App._crmColsManage=(bid)=>{if(!can('crm','edit'))return toast('You need Workspace → Edit','err');var b=_crmBoard(bid);if(!b)return;b.settings=b.settings||{};
  var cols=(b.settings.columns||[]).filter(function(c){return c.type!=='remind';});var byId={};cols.forEach(function(c){byId[c.id]=c;});
  var lblIn=function(key,val,ph){return'<input class="cp-input cp-lbl" value="'+esc(val)+'" placeholder="'+ph+'" maxlength="30" onchange="App._crmColLabel(\''+bid+'\',\''+key+'\',this.value)"/>';};
  var h='<div class="cp-sh-s">Type to rename any column. Drag ⋮⋮ to reorder. Tap the pencil on a custom column to change its type or options.</div>'
    +'<div class="cp-colrow"><div class="cp-pbody"><span class="cp-psub">First column</span>'+lblIn('title',b.settings.titleLabel||_crmLbl(b,'title'),'Ticket')+'</div></div>'
    +'<div id="cp-collist" data-bid="'+bid+'">'+_crmColKeys(b).map(function(k){
      if(k==='_asg'||k==='_st'){var kk=k==='_asg'?'asg':'st';return'<div class="cp-colrow cp-drag" data-cid="'+k+'"><span class="cp-grip" aria-label="Drag to reorder">⋮⋮</span><div class="cp-pbody"><span class="cp-psub">'+(k==='_asg'?'Assignee (built-in)':'Status (built-in)')+'</span>'+lblIn(kk,_crmLbl(b,kk),k==='_asg'?'Assignee':'Status')+'</div></div>';}
      var c=byId[k];if(!c)return'';
      return'<div class="cp-colrow cp-drag" data-cid="'+c.id+'"><span class="cp-grip" aria-label="Drag to reorder">⋮⋮</span><div class="cp-pbody"><span class="cp-psub">'+esc(c.type)+'</span><input class="cp-input cp-lbl" value="'+esc(c.name)+'" maxlength="40" onchange="App._crmColRename(\''+bid+'\',\''+c.id+'\',this.value)"/></div><span class="cp-colbtns"><button onclick="_cpSheetClose();App._crmColModal(\''+bid+'\',\''+c.id+'\')" aria-label="Edit column">'+ic('edit','w-3.5 h-3.5')+'</button><button class="cp-coldel" onclick="_cpSheetClose();App._crmDelCol(\''+bid+'\',\''+c.id+'\')" aria-label="Delete column">'+ic('trash','w-3.5 h-3.5')+'</button></span></div>';}).join('')+'</div>'
    +'<button class="cp-item" onclick="_cpSheetClose();App._crmColModal(\''+bid+'\')">'+ic('plus','w-4 h-4')+'<span>Add column</span></button>';
  _cpSheet(h,{title:'Columns · '+b.name,tall:true});setTimeout(_cpColDragInit,0);};
function _cpSaveBoard(b,label){sbWrite({table:'crm_boards',op:'update',id:b.id,match:{col:'id',val:b.id},values:{settings:b.settings}},{label:label||'Board',silent:true});}
App._crmTitleLabel=(bid,v)=>{App._crmColLabel(bid,'title',v);};
App._crmColLabel=(bid,key,v)=>{var b=_crmBoard(bid);if(!b)return;b.settings=b.settings||{};b.settings.labels=b.settings.labels||{};var dflt={title:'Ticket',asg:'Assignee',st:'Status'}[key];v=String(v||'').trim()||dflt;b.settings.labels[key]=v;if(key==='title')b.settings.titleLabel=v;_cpSaveBoard(b,'Column label');rr();};
App._crmColRename=(bid,cid,v)=>{var b=_crmBoard(bid);if(!b||!b.settings)return;var c=(b.settings.columns||[]).find(function(x){return x.id===cid;});if(!c)return;v=String(v||'').trim();if(!v)return;c.name=v;_cpSaveBoard(b,'Column name');rr();};
App._crmColOrder=(bid,order)=>{var b=_crmBoard(bid);if(!b||!b.settings)return;var cols=(b.settings.columns||[]);var byId={};cols.forEach(function(c){byId[c.id]=c;});
  var customs=order.filter(function(k){return byId[k];});var next=customs.map(function(id){return byId[id];}).concat(cols.filter(function(c){return customs.indexOf(c.id)<0;}));
  b.settings.columns=next;b.settings.colOrder=order.slice();_cpSaveBoard(b,'Column order');rr();};
/* drag-to-reorder (mouse + touch, pointer events): grab the ⋮⋮, the row follows the finger, others slide out of the way */
function _cpColDragInit(){var list=document.getElementById('cp-collist');if(!list||list._dragOn)return;list._dragOn=true;var drag=null;
  list.addEventListener('pointerdown',function(e){var grip=e.target.closest('.cp-grip');if(!grip)return;var row=grip.closest('.cp-drag');if(!row)return;e.preventDefault();
    drag={row:row,y0:e.clientY,h:row.getBoundingClientRect().height};row.classList.add('dragging');row.setPointerCapture&&row.setPointerCapture(e.pointerId);try{if(navigator.vibrate)navigator.vibrate(8);}catch(x){}
    var mv=function(ev){if(!drag)return;ev.preventDefault();var dy=ev.clientY-drag.y0;drag.row.style.transform='translateY('+dy+'px)';
      var rows=[].slice.call(list.querySelectorAll('.cp-drag'));var mid=drag.row.getBoundingClientRect().top+drag.h/2;
      rows.forEach(function(r){if(r===drag.row)return;var rc=r.getBoundingClientRect();var rm=rc.top+rc.height/2;var before=[].indexOf.call(list.children,r)<[].indexOf.call(list.children,drag.row);
        if(!before&&mid>rm){list.insertBefore(r,drag.row);drag.y0+=rc.height;drag.row.style.transform='translateY('+(ev.clientY-drag.y0)+'px)';}
        else if(before&&mid<rm){list.insertBefore(drag.row,r);drag.y0-=rc.height;drag.row.style.transform='translateY('+(ev.clientY-drag.y0)+'px)';}});};
    var up=function(ev){document.removeEventListener('pointermove',mv);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',up);if(!drag)return;drag.row.style.transform='';drag.row.classList.remove('dragging');
      var order=[].slice.call(list.querySelectorAll('.cp-drag')).map(function(r){return r.getAttribute('data-cid');});drag=null;App._crmColOrder(list.getAttribute('data-bid'),order);};
    document.addEventListener('pointermove',mv,{passive:false});document.addEventListener('pointerup',up);document.addEventListener('pointercancel',up);});}

App._crmTitleLabel=(bid,v)=>{var b=_crmBoard(bid);if(!b)return;b.settings=b.settings||{};b.settings.titleLabel=String(v||'').trim()||'Ticket';sbWrite({table:'crm_boards',op:'update',id:b.id,match:{col:'id',val:b.id},values:{settings:b.settings}},{label:'Column label',silent:true});rr();};

/* phones: (i) on a ticket row → every field in a sheet (assignee, status, columns, activity) + open chat / delete */
App._crmTicketInfo=(cid)=>{var c=_crmConvo(cid);if(!c)return;var b=_crmBoard(c.boardId);
  var h='<div class="cp-msgprev"><b>'+esc(c.title||c.customer||'—')+'</b>'+(c.customer&&c.customer!==c.title?'<div class="cp-msgwho">'+esc(c.customer)+'</div>':'')+'</div>'
    +'<div class="cp-tbody">'+_crmDetailsBody(c,b)+'</div>'
    +'<div class="cp-list cp-danger"><button class="cp-item" onclick="_cpSheetClose();App._crmSelConvo(\''+cid+'\')">'+ic('msg','w-4 h-4')+'<span>Open the ticket chat'+(_crmUnread(c)?' · <b>'+_crmUnreadN(c)+' unread</b>':'')+'</span></button>'
    +(can('crm','delete')?'<button class="cp-item cp-item-del" onclick="_cpSheetClose();App._crmDelConvo(\''+cid+'\')">'+ic('trash','w-4 h-4')+'<span>Delete ticket</span></button>':'')+'</div>';
  _cpSheet(h,{title:'Ticket details',tall:true});};

/* board switcher inside ⋯ on phones; landing prefers the Chat board */
(function(){var _o=App._crmBoardMenu;App._crmBoardMenu=function(bid){var b=_crmBoard(bid);if(!b||!_crmIsMob())return _o.apply(this,arguments);
  var inView=!!CRM.sel.viewId;var v=inView?_crmView(CRM.sel.viewId):null;var hub=_crmHub(b.hubId);
  var boards=inView?CRM.boards.filter(function(x){return x.hubId===b.hubId&&!_crmViewHides(v,x.id);}):CRM.boards.filter(function(x){return x.hubId===b.hubId&&_crmBoardVisible(x);});
  var it=function(icon,label,fn,cls){return'<button class="cp-item'+(cls?' '+cls:'')+'" onclick="_cpSheetClose();'+fn+'">'+ic(icon,'w-4 h-4')+'<span>'+label+'</span></button>';};
  var h='<div class="cp-sec">Switch board</div><div class="cp-list">'+boards.map(function(x){var on=x.id===bid;var isC=_crmBS(x).type==='chat';var un=_crmUnreadCount(x.id);return'<button class="cp-item cp-pick'+(on?' on':'')+'" onclick="_cpSheetClose();'+(inView?'App._crmSelVBoard':'App._crmSelBoard')+'(\''+x.id+'\')">'+ic(isC?'msg':'ticket','w-4 h-4')+'<span class="cp-pickbody"><span class="cp-pickn">'+esc(x.name)+'</span><span class="cp-picks">'+(isC?'Chat':'Tickets')+'</span></span>'+(un?'<span class="crm-unb">'+un+'</span>':'')+'<span class="cp-tick">'+ic('check','w-3.5 h-3.5')+'</span></button>';}).join('')
    +(can('crm','create')&&!inView?it('plus','New board','App._crmNewBoard(\''+b.hubId+'\')'):'')+'</div>';
  var acts='';
  if(inView){if(_crmViewCanEdit(v))acts+=it('x','Remove “'+esc(b.name)+'” from this view','App._crmViewHideBoard(\''+bid+'\')');}
  else{if(_crmCanBoardMembers())acts+=it('users','Board members · '+_crmBoardPeople(b).length,'App._crmTogMembers()');if(can('crm','rename'))acts+=it('edit','Rename “'+esc(b.name)+'”','App._crmRenameBoard(\''+bid+'\')');if(can('crm','delete'))acts+=it('trash','Delete “'+esc(b.name)+'”','App._crmDelBoard(\''+bid+'\')','cp-item-del');}
  if(acts)h+='<div class="cp-sec">This board</div><div class="cp-list cp-danger">'+acts+'</div>';
  _cpSheet(h,{title:hub?hub.name:'Boards',tall:true});};})();
(function(){var _o=_cpLandNewest;_cpLandNewest=function(){if(CRM._landed||CRM.sel.convoId||CRM._openAfterLoad)return;_o();try{
  /* Chat board first: the most recently active CHAT board of the landing hub (falls back to whatever _o picked) */
  var hubId=CRM.sel.hubId;var best=null,bt='';CRM.boards.forEach(function(b){if(b.hubId!==hubId||!_crmBoardVisible(b)||_crmBS(b).type!=='chat')return;var t='';(CRM.convos||[]).forEach(function(c){if(c.boardId===b.id&&String(c.lastAt||'')>t)t=String(c.lastAt);});if(!best||t>bt){best=b;bt=t;}});
  if(best&&!CRM.sel.dm){CRM.sel.boardId=best.id;CRM.sel.viewId=null;}}catch(e){}};})();

/* ═══ 13. styles ═══ */
(function(){
  document.head.insertAdjacentHTML('beforeend','<style id="crm-plus3-css">'
  +'.crm-earlier{display:block;margin:6px auto 10px;border:1px solid #E6DED3;background:#fff;color:#54433C;font-size:12px;font-weight:700;padding:7px 14px;border-radius:20px;cursor:pointer}'
  +'.cp-colrow{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:12px}.cp-colrow.cp-dim{opacity:.55}.cp-colname{flex:1;text-align:left;border:none;background:transparent;font-size:14px;font-weight:700;color:#13171B;cursor:pointer;padding:0;display:flex;flex-direction:column;align-items:flex-start;gap:1px}.cp-colbtns{display:inline-flex;gap:4px;flex-shrink:0}.cp-colbtns button{width:34px;height:34px;border:1px solid #E6DED3;background:#fff;border-radius:9px;cursor:pointer;color:#54433C;font-size:12px;display:grid;place-items:center}.cp-colbtns button:disabled{opacity:.3}.cp-colbtns .cp-coldel{color:#B3402E}.cp-fixed{font-size:10px;font-weight:800;text-transform:uppercase;color:#A59788}'
  +'.cp-grip{width:34px;height:34px;display:grid;place-items:center;color:#A59788;font-size:16px;letter-spacing:-3px;cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none;flex-shrink:0;border-radius:9px}.cp-grip:active{cursor:grabbing}.cp-drag.dragging{background:#FBF4E7;box-shadow:0 8px 24px rgba(35,28,22,.18);position:relative;z-index:2;transition:none}.cp-drag{transition:transform .12s}'
  +'.cp-lbl{margin-top:2px;padding:7px 10px;font-size:15px}'
  +'.cp-input{width:100%;box-sizing:border-box;border:1px solid #E6DED3;border-radius:10px;padding:9px 12px;font-size:16px;margin-top:4px;background:#fff}'
  +'.cp-tbody{padding:4px 6px}.cp-tbody select,.cp-tbody input{font-size:16px}'
  +'.crm-td-unread{background:#FBF7EF}'
  /* quoted reply */
  +'.crm-quote{display:flex;align-items:center;gap:8px;min-width:min(200px,60vw);border-left:3px solid #D1B68F;background:rgba(0,0,0,.05);border-radius:8px;padding:5px 8px;margin:2px 0 6px;cursor:pointer;max-width:100%;min-width:0}'
    +'.crm-qbody{flex:1;min-width:0}.crm-qwho{font-size:11px;font-weight:800;line-height:1.2}.crm-qtxt{font-size:12px;color:#5E5148;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.35}'
    +'.crm-qthumb{width:38px;height:38px;object-fit:cover;border-radius:6px;flex-shrink:0}'
  +'.crm-quote-gone .crm-qtxt{font-style:italic;color:#A59788}'
  +'.crm-replybar{display:flex;align-items:center;gap:6px;padding:0 0 8px}.crm-replybar .crm-quote{flex:1;margin:0;background:#F4EFE7;cursor:default}.crm-rbx{width:32px;height:32px;border:none;background:transparent;color:#A59788;border-radius:50%;display:grid;place-items:center;cursor:pointer;flex-shrink:0}'
  +'.crm-fwd{display:flex;align-items:center;gap:4px;font-size:10.5px;font-style:italic;color:#8A7B6D;margin-bottom:3px}'
  /* meta flags */
  +'.crm-mflag{display:inline-flex;align-items:center;opacity:.85}'
  /* voice */
  +'.crm-voice{display:flex;align-items:center;gap:8px;min-width:210px;max-width:290px;padding:4px 2px 2px;--p:0%}'
  +'.crm-vplay{width:36px;height:36px;border-radius:50%;border:none;background:#54433C;color:#FFEAD7;display:grid;place-items:center;cursor:pointer;flex-shrink:0}'
  +'.crm-vbar{flex:1;height:30px;position:relative;cursor:pointer;display:flex;align-items:center}'
  +'.crm-vwave{display:flex;align-items:center;gap:2px;height:100%;width:100%;position:relative}.crm-vwave i{flex:1;background:#C9BCAE;border-radius:2px;display:block;min-width:2px}'
    +'.crm-vwave::after{content:"";position:absolute;left:0;top:0;bottom:0;width:var(--p);background:rgba(84,67,60,.22);border-radius:3px;pointer-events:none}'
  +'.crm-vknob{position:absolute;left:var(--p);top:50%;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;background:#54433C;box-shadow:0 1px 3px rgba(0,0,0,.25);pointer-events:none}'
  +'.crm-vtime{font-size:11px;font-variant-numeric:tabular-nums;color:#786A5F;min-width:30px}'
  +'.crm-vrate{border:1px solid #E6DED3;background:#fff;color:#54433C;font-size:10.5px;font-weight:800;border-radius:12px;padding:2px 7px;cursor:pointer;min-height:0!important}'
  +'.crm-voice.playing .crm-vplay{box-shadow:0 0 0 3px rgba(209,182,143,.35)}'
  /* recording strip */
  +'.crm-rec{display:flex;align-items:center;gap:10px}'
  +'.crm-rec-del{width:40px;height:40px;border:none;background:transparent;color:#B3402E;border-radius:50%;display:grid;place-items:center;cursor:pointer}'
  +'.crm-rec-dot{width:10px;height:10px;border-radius:50%;background:#C25441;animation:cpBlink 1s infinite}@keyframes cpBlink{50%{opacity:.25}}'
  +'.crm-rec-t{font-weight:800;font-variant-numeric:tabular-nums;color:#13171B;min-width:40px}.crm-rec-hint{flex:1;font-size:12px;color:#A59788}'
  /* mic ⇄ send */
  +'.crm-sendbtn .crm-sb-mic{display:none}.crm-sendbtn.crm-mic .crm-sb-send{display:none}.crm-sendbtn.crm-mic .crm-sb-mic{display:grid}'
  /* files */
  +'.crm-file{display:flex;align-items:center;gap:10px;background:rgba(0,0,0,.05);border-radius:10px;padding:8px 10px;margin:2px 0 4px;min-width:200px;max-width:100%;color:inherit;text-decoration:none;cursor:pointer}'
    +'.crm-fic{width:38px;height:38px;border-radius:9px;background:#54433C;color:#FFEAD7;font-size:10px;font-weight:800;display:grid;place-items:center;flex-shrink:0;letter-spacing:.03em}'
  +'.crm-fbody{flex:1;min-width:0;display:flex;flex-direction:column}.crm-fname{font-size:12.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.crm-fmeta{font-size:10.5px;opacity:.7}'
  +'.crm-fdl{flex-shrink:0;opacity:.7}'
  +'.crm-vid video{max-width:260px;width:100%;border-radius:10px;display:block;background:#000;margin:2px 0 4px}'
  +'.crm-hasatt{min-width:230px}'
  /* composer chips */
  +'.crm-pvimg{position:relative}.crm-pvimg img{width:56px;height:56px;object-fit:cover;border-radius:8px;border:1px solid #E6DED3;display:block}'
  +'.crm-pvimg button,.crm-pvfile button{position:absolute;top:-6px;right:-6px;width:20px;height:20px;min-height:20px!important;border-radius:50%;border:none;background:#13171B;color:#fff;font-size:13px;line-height:1;cursor:pointer;padding:0;display:grid;place-items:center}'
  +'.crm-pvfile{position:relative;display:flex;align-items:center;gap:8px;border:1px solid #E6DED3;border-radius:10px;padding:6px 10px;background:#FAF7F3;max-width:100%}.crm-pvfile .crm-fic{width:30px;height:30px;font-size:9px}.crm-pvname{font-size:12px;font-weight:700;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.crm-pvsize{font-size:10.5px;color:#A59788}'
  /* link card */
  +'.crm-lcard{display:flex;flex-direction:column;background:rgba(0,0,0,.05);border-radius:10px;overflow:hidden;margin:6px 0 4px;text-decoration:none;color:inherit;max-width:300px}'
    +'.crm-lcard img{width:100%;max-height:150px;object-fit:cover;display:block}.crm-lcbody{display:flex;flex-direction:column;gap:2px;padding:7px 10px}'
  +'.crm-lcsite{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;opacity:.65}.crm-lctitle{font-size:12.5px;font-weight:700;line-height:1.3}.crm-lcdesc{font-size:11.5px;opacity:.8;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}'
  /* stickers */
  +'.crm-stick{background:transparent!important;box-shadow:none!important;padding:0 2px!important}.crm-stickg{display:block;font-size:88px;line-height:1.1;filter:drop-shadow(0 4px 6px rgba(35,28,22,.25))}'
  +'.crm-stick .crm-meta{float:none;display:flex;justify-content:flex-end;margin:1px 2px 0;color:#A59788}'
  +'.crm-epages{display:flex;gap:4px;padding:8px 8px 0}.crm-epages button{flex:1;border:none;background:#F3EDE2;color:#786A5F;font-weight:700;font-size:12px;padding:7px;border-radius:9px;cursor:pointer}.crm-epages button.on{background:#54433C;color:#FFEAD7}'
  +'.crm-sgrid{flex:1;overflow-y:auto;display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:10px;align-content:start}.crm-sstk{border:none;background:#FAF7F3;font-size:46px;padding:8px 0;border-radius:14px;cursor:pointer;line-height:1.2;transition:transform .1s}.crm-sstk:active{transform:scale(1.15)}'
  /* pinned bar */
  +'.crm-pinbar{display:flex;align-items:center;gap:9px;padding:7px 12px;background:#FBF7EF;border-bottom:1px solid #EDE7DC;cursor:pointer;flex-shrink:0}'
  +'.crm-pinic{color:#7C5A26;display:grid;place-items:center}.crm-pinbody{flex:1;min-width:0}.crm-pinl{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#7C5A26}.crm-pint{font-size:12.5px;color:#3A312A;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
  +'.crm-pindots{display:flex;flex-direction:column;gap:2px}.crm-pindots i{width:3px;height:9px;border-radius:2px;background:#E2D6C4}.crm-pindots i.on{background:#7C5A26}'
  +'.crm-pinx{width:30px;height:30px;border:none;background:transparent;color:#786A5F;border-radius:8px;display:grid;place-items:center;cursor:pointer;min-height:30px!important}'
  /* list */
  +'.crm-lpin,.crm-lmute{display:inline-flex;align-items:center;color:#A59788;margin-left:4px;flex-shrink:0}.crm-unb-mute{background:#CFC4B6;color:#fff}'
  +'.crm-row.crm-swl{background:#F4EFE7}.crm-mutedic{display:inline-flex;vertical-align:middle;color:#A59788}'
  /* sheet */
  +'#cp-sheet{position:fixed;inset:0;z-index:230;display:none}#cp-sheet.on{display:block}'
  +'#cp-sheet .cp-scrim{position:absolute;inset:0;background:rgba(10,27,33,.42);animation:cpFade .18s}'
  +'@keyframes cpFade{from{opacity:0}}@keyframes cpUp{from{transform:translateY(40px);opacity:0}}'
  +'#cp-sheet .cp-card{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(460px,calc(100vw - 32px));max-height:min(80vh,720px);background:#fff;border-radius:18px;box-shadow:0 24px 60px rgba(35,28,22,.35);display:flex;flex-direction:column;overflow:hidden;animation:cpUp .2s cubic-bezier(.2,.8,.25,1)}'
  +'#cp-sheet.cp-wide .cp-card{width:min(560px,calc(100vw - 32px))}#cp-sheet.cp-tall .cp-card{height:min(80vh,720px)}'
  +'#cp-sheet .cp-grab{display:none}#cp-sheet .cp-body{overflow-y:auto;-webkit-overflow-scrolling:touch;padding:6px 10px 12px;flex:1;min-height:0}'
  +'.cp-hd{display:flex;align-items:center;justify-content:space-between;padding:8px 6px 6px}.cp-hd-t{font-size:15px;font-weight:800;color:#13171B}.cp-x{width:34px;height:34px;border:none;background:#F4EFE7;color:#786A5F;border-radius:50%;display:grid;place-items:center;cursor:pointer}'
  +'.cp-sh-t{font-size:15px;font-weight:800;padding:6px 6px 2px}.cp-sh-s{font-size:12.5px;color:#786A5F;padding:0 6px 8px;line-height:1.45}'
  +'.cp-list{display:flex;flex-direction:column;gap:2px}'
  +'.cp-item{display:flex;align-items:center;gap:12px;width:100%;text-align:left;border:none;background:transparent;padding:11px 10px;border-radius:12px;font-size:14px;font-weight:600;color:#13171B;cursor:pointer;min-height:44px}.cp-item:hover{background:#F4EFE7}.cp-item svg{color:#786A5F;flex-shrink:0}'
  +'.cp-item-del{color:#B3402E}.cp-item-del svg{color:#B3402E}.cp-item-ok{color:#2F7A57}.cp-item-ok svg{color:#2F7A57}'
  +'.cp-emorow{display:flex;gap:2px;justify-content:space-between;padding:6px 4px 10px;border-bottom:1px solid #F1ECE4;margin-bottom:6px}.cp-emorow button{border:none;background:#FAF7F3;font-size:26px;width:44px;height:44px;border-radius:50%;cursor:pointer;flex-shrink:0}.cp-emorow .cp-emoplus{font-size:22px;color:#786A5F;font-weight:800}'
  +'.cp-msgprev{font-size:12.5px;color:#3A312A;background:#F7F3EC;border-left:3px solid #D1B68F;border-radius:8px;padding:8px 10px;margin:2px 4px 10px;line-height:1.4}.cp-msgprev .cp-msgwho{margin-top:3px}'
  +'.cp-msgrow{position:relative;padding:9px 40px 9px 10px;border-radius:12px;cursor:pointer}.cp-msgrow:hover{background:#F4EFE7}.cp-msgwho{font-size:10.5px;font-weight:800;color:#A59788;text-transform:uppercase;letter-spacing:.04em}.cp-msgtxt{font-size:13px;color:#13171B;margin-top:2px;line-height:1.4}'
  +'.cp-msgx{position:absolute;right:6px;top:50%;transform:translateY(-50%);width:32px;height:32px;border:none;background:transparent;color:#A59788;border-radius:50%;display:grid;place-items:center;cursor:pointer}'
  +'.cp-empty{padding:26px 12px;text-align:center;color:#A59788;font-size:12.5px}'
  +'.cp-sec{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#786A5F;padding:12px 10px 4px;display:flex;align-items:center;gap:6px}'
  +'.cp-person{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:12px;cursor:pointer}.cp-person:hover{background:#F4EFE7}.cp-pbody{flex:1;min-width:0;display:flex;flex-direction:column}.cp-pname{font-size:13.5px;font-weight:700;color:#13171B;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cp-psub{font-size:11.5px;color:#A59788;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cp-ptime{font-size:11px;color:#A59788;white-space:nowrap;margin-left:auto}.cp-ptime.cp-on{color:#2F7A57;font-weight:700}.cp-you{font-size:10px;font-weight:800;color:#A59788;text-transform:uppercase}'
  +'.cp-search{width:100%;box-sizing:border-box;border:1px solid #E6DED3;border-radius:20px;padding:9px 14px;font-size:14px;outline:none;margin:2px 0 8px;background:#F7F3EC}'
  +'.cp-pick{position:relative}.cp-pickbody{flex:1;min-width:0;display:flex;flex-direction:column}.cp-pickn{font-size:13.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cp-picks{font-size:11.5px;color:#A59788;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
  +'.cp-tick{width:22px;height:22px;border-radius:50%;border:1.5px solid #D8CCC0;display:grid;place-items:center;color:transparent;flex-shrink:0}.cp-pick.on .cp-tick{background:#54433C;border-color:#54433C;color:#fff}.cp-pick.on{background:#FBF4E7}'
  +'.cp-foot{display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:10px 4px 0;border-top:1px solid #F1ECE4;margin-top:6px;position:sticky;bottom:0;background:#fff}.cp-foot-n{font-size:12px;color:#786A5F;margin-right:auto}'
  +'.cp-btn{display:inline-flex;align-items:center;gap:7px;border:none;background:#54433C;color:#FFEAD7;font-weight:800;font-size:13px;padding:10px 18px;border-radius:12px;cursor:pointer}'
  +'.cp-chathead{display:flex;flex-direction:column;align-items:center;text-align:center;padding:6px 6px 10px}.cp-chatname{font-size:17px;font-weight:800;color:#13171B;margin-top:8px}.cp-chatsub{font-size:12px;color:#A59788;margin-top:2px;line-height:1.4}'
  +'.cp-quick{display:flex;gap:6px;margin-top:12px;width:100%}.cp-qbtn{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;border:1px solid #EAE3D8;background:#FAF7F3;border-radius:12px;padding:9px 4px;font-size:11px;font-weight:700;color:#54433C;cursor:pointer;min-width:0}.cp-qbtn span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}.cp-qbtn.on{background:#EEE4D5;border-color:#D1B68F}'
  +'.cp-tabs{display:flex;gap:2px;border-bottom:1px solid #EDE7DC;margin:0 -4px 6px;padding:0 4px;overflow-x:auto}.cp-tabs button{border:none;background:transparent;padding:9px 12px;font-size:12.5px;font-weight:700;color:#A59788;border-bottom:2px solid transparent;cursor:pointer;white-space:nowrap}.cp-tabs button.on{color:#13171B;border-bottom-color:#54433C}.cp-tabs b{font-size:10px;color:#A59788;font-weight:800}'
  +'.cp-tabbody{min-height:120px}'
  +'.cp-media{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:4px 0}.cp-media img,.cp-media video{width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;cursor:pointer;background:#EEE8DE;display:block}'
  +'.cp-filerow{background:#FAF7F3!important;margin:0!important;min-width:0!important}'
  +'.cp-linkrow{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:12px;text-decoration:none;color:inherit}.cp-linkrow:hover{background:#F4EFE7}.cp-linkic{width:34px;height:34px;border-radius:9px;background:#EEE4D5;color:#54433C;display:grid;place-items:center;flex-shrink:0}'
  +'.cp-danger{border-top:1px solid #F1ECE4;margin-top:10px;padding-top:6px}'
  /* desktop popover */
  +'#cp-pop{position:fixed;z-index:225;width:220px;background:#fff;border:1px solid #E6DED3;border-radius:14px;box-shadow:0 18px 50px rgba(35,28,22,.25);padding:6px;display:none}#cp-pop.on{display:block;animation:crmIn .14s ease}#cp-pop .cp-item{padding:8px 10px;font-size:13px;min-height:36px}'
  /* phones: real bottom sheet */
  +'@media(max-width:767px){'
  +'#cp-sheet .cp-card{left:0;right:0;top:auto;bottom:0;transform:none;width:auto;max-height:86vh;border-radius:20px 20px 0 0;padding-bottom:env(safe-area-inset-bottom);animation:cpUp .22s cubic-bezier(.2,.8,.25,1)}'
  +'#cp-sheet.cp-tall .cp-card{height:auto;max-height:88vh}#cp-sheet .cp-grab{display:block;width:40px;height:4px;border-radius:2px;background:#DDD3C6;margin:8px auto 2px}'
  +'.cp-item{min-height:48px;font-size:15px}.crm-voice{min-width:200px}.crm-stickg{font-size:96px}'
  +'.crm-sgrid{grid-template-columns:repeat(4,1fr)}.crm-lcard{max-width:100%}.crm-vid video{max-width:100%}'
  +'.crm-fs .crm-vplay{min-width:36px!important;min-height:36px!important}.crm-fs .crm-vrate{min-height:24px!important}.crm-fs .crm-pinx,.crm-fs .crm-rbx{min-height:32px!important;min-width:32px!important}'
  +'.crm-fs .crm-rec-del{min-width:44px;min-height:44px}'
  +'body.cp-sheet-open{overflow:hidden}'
  +'#content .crm-tabsrow .crm-btab:not(.crm-btab-on){display:none!important}#content .crm-tabsrow>button[onclick*="_crmNewBoard"]{display:none!important}'
  +'#content .crm-tabsrow .crm-btab-on{border-bottom-color:transparent!important;padding-left:4px!important}'
  +'.crm-tinfo{width:32px;height:32px;min-height:32px!important;margin-right:4px;border:1px solid #E6DED3;background:#fff;color:#54433C;border-radius:9px;display:inline-grid;place-items:center;cursor:pointer}'
  +'#crm-thread{will-change:scroll-position;transform:translateZ(0)}'
  +'.crm-line{contain:layout style}'
  +'.crm-bub{box-shadow:0 1px 1px rgba(35,28,22,.10)!important}'
  +'.crm-anew-in,.crm-anew-out{animation-duration:.16s}'
  +'html.cp-touch #content .crm-fs .crm-row:hover .crm-del,html.cp-touch #content .crm-fs .crm-brd:hover .crm-bdel,html.cp-touch #content .crm-fs .crm-chrow:hover .crm-chx,html.cp-touch #content .crm-fs .crm-hub:hover .crm-hdel,html.cp-touch #content .crm-fs .crm-tab:hover .crm-tx,html.cp-touch #content .crm-fs .crm-colh:hover .crm-colx{display:none!important}'
  +'#content .crm-fs .crm-msg:hover .crm-macts,#content .crm-fs .crm-msg:active .crm-macts,#content .crm-fs .crm-msg:focus-within .crm-macts{display:none!important}'
  +'#content .crm-fs .crm-msg.crm-actopen .crm-macts,#content .crm-fs .crm-msg.crm-actopen:hover .crm-macts{display:flex!important}'
  +'.crm-msg:active .crm-bub{transform:none!important}'
  +'html.cp-ws body{position:fixed;inset:0;width:100%;overflow:hidden;overscroll-behavior:none}'
  /* v143 — these must beat the page-level .crm-fs rules (they are injected inside #content, after this sheet) */
  +'#content .crm-fs,#content .crm-fs.crm-fs{top:var(--vvt,0px)!important;bottom:auto!important;height:calc(var(--vvh,100dvh) - 60px - env(safe-area-inset-bottom))!important;max-height:none!important}'
  +'#content .crm-fs.crm-hasconvo{height:var(--vvh,100dvh)!important;padding-bottom:0!important}'
  +'#content .crm-fs.crm-hasconvo .crm-composer{padding-bottom:calc(8px + env(safe-area-inset-bottom))!important}'
  +'html.cp-kb #content .crm-fs.crm-hasconvo .crm-composer{padding-bottom:8px!important}'
  /* the "Search people…" box in Messages must not grow (a generic rule turns any div holding a Search input into flex:1) */
  +'#content .crm-fs .crm-listcol>div:has(>input){flex:0 0 auto!important;width:100%!important}'
  +'#content .crm-fs #crm-list{flex:1 1 auto!important}'
  +'#crm-thread,#crm-tthread{overflow-x:hidden!important;overscroll-behavior-x:none}'
  +'.crm-msg[data-swipe]{touch-action:pan-y}'
  +'#cp-sheet .cp-card{left:0!important;right:0!important;top:auto!important;bottom:0!important;width:100%!important;max-width:100vw!important;transform:none!important;margin:0!important}'
  +'#cp-sheet .cp-body{padding-left:max(10px,env(safe-area-inset-left));padding-right:max(10px,env(safe-area-inset-right))}'
  +'.crm-hasconvo .crm-thread-panel{bottom:0!important;height:100dvh!important;padding-bottom:env(safe-area-inset-bottom)}'
  +'.crm-warow .crm-del{display:none!important}'
  +'.crm-msg,.crm-msg *{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}.crm-msg input,.crm-msg textarea{-webkit-user-select:text;user-select:text}'
  +'.crm-tabsrow .crm-bctl-desk{display:none!important}'
  +'.crm-fs .crm-lfrow .crm-newchat{display:none!important}'
  +'}'
  +'</style>');
})();
