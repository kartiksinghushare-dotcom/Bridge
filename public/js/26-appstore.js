/* ============================================================
   Bridge — 26-appstore.js  (v157)
   App Store readiness: legal links (Privacy · Terms · Support) on the sign-in
   page and in the More menu, and the in-app "Delete my account" request that
   Apple's guideline 5.1.1(v) requires for any app with sign-in.
   Classic script: loads after 07-login / 04-nav-shell and wraps their globals.
   ============================================================ */
var LEGAL_URLS={privacy:'/legal/privacy.html',terms:'/legal/terms.html',support:'/legal/support.html'};
function _legalLinks(opts){opts=opts||{};var c=opts.color||'#8C7F73';
  var a=function(k,l){return'<a href="'+LEGAL_URLS[k]+'" target="_blank" rel="noopener" style="color:'+c+';text-decoration:none;font-size:12px;font-weight:600">'+l+'</a>';};
  return'<div style="display:flex;justify-content:center;gap:14px;flex-wrap:wrap;'+(opts.style||'')+'">'+a('privacy','Privacy')+a('terms','Terms')+a('support','Support')+'</div>';}

/* sign-in page: footer links under the Forgot-password line */
(function(){var _lv=loginView;loginView=function(){var h=_lv.apply(this,arguments);var i=h.lastIndexOf('</div></div></div>');if(i<0)return h;
  return h.slice(0,i)+_legalLinks({style:'margin-top:26px'})+h.slice(i);};})();

/* More menu: Privacy · Terms · Support · Delete my account, under Sign out */
(function(){var _mm=App.moreMenu;App.moreMenu=function(){var out=_mm.apply(this,arguments);
  try{var btn=document.querySelector('button[onclick="App.logout()"].ui-btn-subtle');if(btn&&!btn.nextElementSibling)
    btn.insertAdjacentHTML('afterend',_legalLinks({style:'margin-top:14px'})+'<div style="text-align:center;margin-top:8px"><button type="button" onclick="App.closeModal();App.deleteAccount()" style="border:none;background:transparent;color:#B3402E;font-size:12px;font-weight:600;cursor:pointer;padding:6px 8px">Delete my account</button></div>');}catch(e){}
  return out;};})();

/* email template for the admins' heads-up */
(function(){if(typeof _defaultTemplates!=='function')return;var _dt=_defaultTemplates;_defaultTemplates=function(){var t=_dt.apply(this,arguments)||{};
  t.account_deletion={subject:'🗑️ Account deletion requested — {{req_user}}',body:'Hi {{user_name}},\n\n{{req_user}} ({{req_email}}) has asked for their Bridge account to be deleted.\n\nReason: {{reason}}\n\nPlease deactivate the account in People and remove personal data that BloomingBox is not required to keep (Privacy Policy §7 and §9).\n\n{{action_url}}'};
  return t;};})();

function _adminIds(){return (DB.users||[]).filter(function(u){if(!u||u.status==='Inactive'||u.status==='Disabled')return false;var id=u.hrm&&u.hrm.roleProfileId;return id?(id==='superadmin'||id==='admin'):(u.role==='Admin'||u.role==='SubAdmin');}).map(function(u){return u.id;});}

App.deleteAccount=function(){var u=me();if(!u)return;
  modalShell({title:'Delete my account',sub:'This sends a deletion request to the People team',size:'max-w-md',key:'del-account',
    body:'<div style="font-size:13.5px;line-height:1.6;color:#3A312A">'
      +'<p style="margin:0 0 10px">Bridge is BloomingBox’s workplace system, so your account is closed by the People team rather than deleted instantly:</p>'
      +'<ul style="margin:0 0 12px;padding-left:18px;list-style:disc"><li>You are signed out now and your access is deactivated.</li><li>Personal data that BloomingBox is not legally required to keep is removed.</li><li>Attendance, payroll and other records UAE law requires are kept for the statutory period, then deleted — see the <a href="'+LEGAL_URLS.privacy+'" target="_blank" rel="noopener" style="color:#54433C">Privacy Policy</a>.</li></ul>'
      +'<label class="ui-label" for="da-reason">Reason (optional)</label><textarea id="da-reason" class="ui-input" rows="2" placeholder="Leaving the company, wrong account…" style="resize:vertical"></textarea>'
      +'<label class="ui-label" for="da-confirm" style="margin-top:12px;display:block">Type <b>DELETE</b> to confirm</label><input id="da-confirm" class="ui-input" autocomplete="off" autocapitalize="characters" placeholder="DELETE"/>'
      +'</div>',
    footer:btnG('Cancel','App.closeModal()')+'<button id="da-go" onclick="App._deleteAccountGo()" class="ui-btn ui-btn-md" style="background:#B3402E;color:#fff;border:none">Request deletion</button>'});
  setTimeout(function(){var e=document.getElementById('da-reason');if(e)e.focus();},60);};

App._deleteAccountGo=async function(){var u=me();if(!u)return;
  var ok=(document.getElementById('da-confirm')||{}).value||'';if(ok.trim().toUpperCase()!=='DELETE'){toast('Type DELETE to confirm','err');return;}
  var reason=((document.getElementById('da-reason')||{}).value||'').trim().slice(0,500);
  var btn=document.getElementById('da-go');if(btn){btn.disabled=true;btn.textContent='Sending…';}
  try{
    var ins=await sb.from('account_deletion_requests').insert({user_id:u.id,email:u.email||null,reason:reason||null});
    if(ins.error)throw ins.error;
    var who=fullName(u);var at=new Date().toISOString();var txt='🗑️ '+who+' requested account deletion'+(reason?': "'+reason+'"':'');
    _adminIds().forEach(function(aid){if(aid===u.id)return;
      var nid=uid('n');try{DB.notifications.unshift({id:nid,userId:aid,text:txt,time:at,read:false,link:'users'});}catch(e){}
      try{sbWrite({table:'notifications',op:'insert',id:nid,values:{id:nid,user_id:aid,text:txt,read:false,created_at:at,link:'users'}},{label:'Notify',silent:true});}catch(e){}
      if(typeof sendEmail==='function'){try{sendEmail('account_deletion',aid,{req_user:who,req_email:u.email||'',reason:reason||'—'});}catch(e){}}
    });
    try{if(typeof _invalidateNotifCache==='function')_invalidateNotifCache();}catch(e){}
    try{if(typeof logAudit==='function')logAudit('account_deletion_requested',{user:u.id,reason:reason||''});}catch(e){}
    closeModal();toast('Request sent — the People team will close your account');
    setTimeout(function(){try{App.logout();}catch(e){S.uid=null;render();}},900);
  }catch(e){toast(e.message||'Could not send the request','err');if(btn){btn.disabled=false;btn.textContent='Request deletion';}}
};
