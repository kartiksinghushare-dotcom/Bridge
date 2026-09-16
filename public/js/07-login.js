/* ============================================================
   Bridge — 07-login.js  (split from Bridge.html lines 2088-2155)
   Classic script: shares top-level scope with the other /js files.
   Load order matters — see index.html.
   ============================================================ */
/* ===== LOGIN ===== */
function loginView(){return`<div class="min-h-screen flex" style="background:var(--c-bg)">
  <div class="hidden lg:flex flex-col justify-between" style="width:44%;background:#13171B;color:#fff;padding:56px;position:relative;overflow:hidden">
    <div style="position:absolute;right:-120px;top:-120px;width:420px;height:420px;border-radius:50%;background:radial-gradient(circle,rgba(209,182,143,.28),transparent 70%);filter:blur(40px)"></div>
    <div style="position:absolute;left:-80px;bottom:-100px;width:360px;height:360px;border-radius:50%;background:radial-gradient(circle,rgba(209,182,143,.18),transparent 70%);filter:blur(50px)"></div>
    <div class="relative" style="display:flex;flex-direction:column;gap:6px"><span class="fd" style="font-size:21px;font-weight:600;letter-spacing:.42em;color:#fff">BRIDGE</span><span style="font-size:10.5px;font-weight:600;letter-spacing:.34em;color:#D1B68F">BY BLOOMINGBOX</span></div>
    <div class="relative"><h1 class="fd" style="font-size:33px;font-weight:500;line-height:1.32;letter-spacing:.07em">EVERY GOAL,<br>EVERY SHIFT,<br><span style="color:#D1B68F">ONE BRIDGE.</span></h1><div style="width:56px;height:1px;background:#D1B68F;margin-top:22px"></div><p style="color:rgba(255,255,255,.6);margin-top:20px;line-height:1.7;font-size:14px;max-width:400px;font-weight:300">OKRs with scheduled check-ins, team Workspace chat and ticket boards, shift checklists with escalation and approvals — everything BloomingBox runs on, in one place.</p>
      <div style="display:flex;gap:22px;margin-top:34px;flex-wrap:wrap">
        <div><div class="fd" style="font-size:13px;font-weight:600;letter-spacing:.18em;color:#D1B68F">OKRs</div><div style="font-size:12px;color:rgba(255,255,255,.45);margin-top:4px;font-weight:300">targets &amp; check-ins</div></div>
        <div style="width:1px;background:rgba(209,182,143,.25)"></div>
        <div><div class="fd" style="font-size:13px;font-weight:600;letter-spacing:.18em;color:#D1B68F">WORKSPACE</div><div style="font-size:12px;color:rgba(255,255,255,.45);margin-top:4px;font-weight:300">chat &amp; tickets</div></div>
        <div style="width:1px;background:rgba(209,182,143,.25)"></div>
        <div><div class="fd" style="font-size:13px;font-weight:600;letter-spacing:.18em;color:#D1B68F">CHECKLISTS</div><div style="font-size:12px;color:rgba(255,255,255,.45);margin-top:4px;font-weight:300">every shift covered</div></div>
      </div></div>
    <div style="font-size:11px;letter-spacing:.22em;color:rgba(255,255,255,.35)">© 2026 BLOOMINGBOX</div>
  </div>
  <div class="flex-1 flex items-center justify-center p-6"><div class="w-full max-w-sm fade">
    <div class="lg:hidden flex flex-col items-center gap-1 mb-8"><span class="fd" style="font-size:17px;font-weight:600;letter-spacing:.4em;color:var(--c-ink)">BRIDGE</span><span style="font-size:9px;font-weight:600;letter-spacing:.3em;color:#54433C">BY BLOOMINGBOX</span></div>
    <h2 class="fd" style="font-size:26px;font-weight:700;letter-spacing:-.2px;margin-bottom:4px">Welcome back</h2>
    <p style="color:var(--c-text-2);font-size:14px;margin-bottom:24px">Sign in to your workspace.</p>
    <div style="display:flex;flex-direction:column;gap:14px">
      <div>
        <label for="li-e" class="ui-label">Email address</label>
        <input id="li-e" type="email" autocomplete="email" placeholder="you@company.com" class="ui-input"
          onkeydown="if(event.key==='Enter')document.getElementById('li-p').focus()"/>
      </div>
      <div>
        <label for="li-p" class="ui-label">Password</label>
        <input id="li-p" type="password" autocomplete="current-password" placeholder="Enter your password" class="ui-input"
          onkeydown="if(event.key==='Enter')App.login()"/>
      </div>
    </div>
    <button onclick="App.login()" class="ui-btn ui-btn-primary ui-btn-md" style="width:100%;margin-top:22px">Sign in</button>
    <div style="text-align:center;margin-top:16px"><button type="button" onclick="App.forgotPw()" style="border:none;background:transparent;color:#54433C;font-size:13px;font-weight:600;cursor:pointer;text-decoration:underline;text-underline-offset:3px">Forgot password?</button></div>
  </div></div></div>`;}
/* v155 — Forgot password: email → Supabase sends a reset link → #type=recovery brings the person back here to choose
   a new password. The link is only honoured for 10 minutes (pw_reset_window_ok() checks auth.users.recovery_sent_at). */
function _pwShell(inner){return`<div class="min-h-screen flex items-center justify-center p-6" style="background:var(--c-bg)"><div class="w-full max-w-sm fade">
    <div class="flex flex-col items-center gap-1 mb-8"><span class="fd" style="font-size:17px;font-weight:600;letter-spacing:.4em;color:var(--c-ink)">BRIDGE</span><span style="font-size:9px;font-weight:600;letter-spacing:.3em;color:#54433C">BY BLOOMINGBOX</span></div>${inner}</div></div>`;}
App.forgotPw=()=>{const pre=($('#li-e')?.value||'').trim();$('#app').innerHTML=_pwShell(`
    <h2 class="fd" style="font-size:26px;font-weight:700;letter-spacing:-.2px;margin-bottom:4px">Reset your password</h2>
    <p style="color:var(--c-text-2);font-size:14px;margin-bottom:24px;line-height:1.55">Enter your work email and we’ll send you a link to choose a new password. The link works for <b>10 minutes</b>.</p>
    <label for="fp-e" class="ui-label">Email address</label>
    <input id="fp-e" type="email" autocomplete="email" placeholder="you@company.com" class="ui-input" value="${pre.replace(/"/g,'&quot;')}" onkeydown="if(event.key==='Enter')App.forgotPwSend()"/>
    <button id="fp-btn" onclick="App.forgotPwSend()" class="ui-btn ui-btn-primary ui-btn-md" style="width:100%;margin-top:22px">Send reset link</button>
    <div style="text-align:center;margin-top:16px"><button type="button" onclick="S.uid=null;render()" style="border:none;background:transparent;color:#786A5F;font-size:13px;font-weight:600;cursor:pointer">← Back to sign in</button></div>`);
  setTimeout(()=>{const e=$('#fp-e');if(e)e.focus();},40);};
App.forgotPwSend=async()=>{
  const email=($('#fp-e')?.value||'').trim().toLowerCase();
  if(!email||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){toast('Enter a valid email address','err');return;}
  const btn=$('#fp-btn');if(btn){btn.disabled=true;btn.textContent='Sending…';}
  try{
    /* v156 — server-side, rate-limited lookup (5 tries per email per 15 min) so the answer is honest but can't be abused */
    const{data:st,error:le}=await sb.rpc('pw_reset_lookup',{p_email:email});
    if(le)throw le;
    if(st==='not_found'){toast('No Bridge account uses this email — check the spelling or ask your admin','err');if(btn){btn.disabled=false;btn.textContent='Send reset link';}return;}
    if(st==='inactive'){toast('This account is inactive — contact your admin','err');if(btn){btn.disabled=false;btn.textContent='Send reset link';}return;}
    if(st==='too_many'){toast('Too many attempts — please wait 15 minutes and try again','err');if(btn){btn.disabled=false;btn.textContent='Send reset link';}return;}
    if(st!=='ok'){toast('Enter a valid email address','err');if(btn){btn.disabled=false;btn.textContent='Send reset link';}return;}
    const{error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
    if(error){if(/rate|limit|seconds/i.test(error.message||''))throw new Error('A link was sent recently — check your inbox, or wait a minute and try again');throw error;}
    $('#app').innerHTML=_pwShell(`
      <h2 class="fd" style="font-size:26px;font-weight:700;letter-spacing:-.2px;margin-bottom:4px">Check your inbox</h2>
      <p style="color:var(--c-text-2);font-size:14px;line-height:1.6;margin-bottom:8px">A reset link has been sent to <b>${email.replace(/</g,'&lt;')}</b>. Open it within <b>10 minutes</b> to choose a new password.</p>
      <p style="color:var(--c-text-3);font-size:12.5px;line-height:1.6">Nothing there? Check spam, or wait a minute and try again.</p>
      <button onclick="S.uid=null;render()" class="ui-btn ui-btn-primary ui-btn-md" style="width:100%;margin-top:22px">Back to sign in</button>`);
  }catch(err){toast(err.message||'Could not send the email','err');if(btn){btn.disabled=false;btn.textContent='Send reset link';}}
};
/* the reset link lands on /#access_token=…&type=recovery (implicit flow; detectSessionInUrl is off, so we read it ourselves) */
function _pwRecoveryFromHash(){try{const h=(location.hash||'').replace(/^#\/?/,'');if(!h)return null;const q=new URLSearchParams(h);
  if(q.get('error')||q.get('error_code'))return{error:q.get('error_description')||q.get('error_code')||q.get('error')};
  if(q.get('type')==='recovery'&&q.get('access_token')&&q.get('refresh_token'))return{access_token:q.get('access_token'),refresh_token:q.get('refresh_token')};}catch(e){}return null;}
window._pwRecovery=_pwRecoveryFromHash();
if(window._pwRecovery){try{history.replaceState(null,'',location.pathname+location.search);}catch(e){}}
App.pwResetScreen=(msg)=>{$('#app').innerHTML=_pwShell(`
    <h2 class="fd" style="font-size:26px;font-weight:700;letter-spacing:-.2px;margin-bottom:4px">Choose a new password</h2>
    <p style="color:var(--c-text-2);font-size:14px;margin-bottom:24px;line-height:1.55">${msg||'At least 6 characters. You’ll be signed in straight after.'}</p>
    <div style="display:flex;flex-direction:column;gap:14px">
      <div><label for="rp-1" class="ui-label">New password</label><input id="rp-1" type="password" autocomplete="new-password" placeholder="New password" class="ui-input" onkeydown="if(event.key==='Enter')document.getElementById('rp-2').focus()"/></div>
      <div><label for="rp-2" class="ui-label">Confirm new password</label><input id="rp-2" type="password" autocomplete="new-password" placeholder="Type it again" class="ui-input" onkeydown="if(event.key==='Enter')App.pwResetSave()"/></div>
    </div>
    <button id="rp-btn" onclick="App.pwResetSave()" class="ui-btn ui-btn-primary ui-btn-md" style="width:100%;margin-top:22px">Save password</button>`);
  setTimeout(()=>{const e=$('#rp-1');if(e)e.focus();},40);};
App.pwResetExpired=(why)=>{$('#app').innerHTML=_pwShell(`
    <h2 class="fd" style="font-size:26px;font-weight:700;letter-spacing:-.2px;margin-bottom:4px">This link has expired</h2>
    <p style="color:var(--c-text-2);font-size:14px;line-height:1.6;margin-bottom:8px">Reset links work for 10 minutes and can be used once.${why?' ('+String(why).replace(/</g,'&lt;')+')':''}</p>
    <button onclick="App.forgotPw()" class="ui-btn ui-btn-primary ui-btn-md" style="width:100%;margin-top:22px">Send a new link</button>
    <div style="text-align:center;margin-top:16px"><button type="button" onclick="S.uid=null;render()" style="border:none;background:transparent;color:#786A5F;font-size:13px;font-weight:600;cursor:pointer">← Back to sign in</button></div>`);};
App.pwRecoveryBoot=async()=>{
  const r=window._pwRecovery;window._pwRecovery=null;
  try{
    if(r.error){await sb.auth.signOut().catch(()=>{});return App.pwResetExpired(r.error.replace(/\+/g,' '));}
    const{error}=await sb.auth.setSession({access_token:r.access_token,refresh_token:r.refresh_token});if(error)throw error;
    const{data:ok,error:e2}=await sb.rpc('pw_reset_window_ok');
    if(e2)throw e2;
    if(!ok){await sb.auth.signOut().catch(()=>{});return App.pwResetExpired();}
    App.pwResetScreen();
  }catch(e){await sb.auth.signOut().catch(()=>{});App.pwResetExpired(e.message||'');}
};
App.pwResetSave=async()=>{
  const a=($('#rp-1')?.value||'').trim(),b=($('#rp-2')?.value||'').trim();
  if(a.length<6){toast('Use at least 6 characters','err');return;}
  if(a!==b){toast('The two passwords don’t match','err');return;}
  const btn=$('#rp-btn');if(btn){btn.disabled=true;btn.textContent='Saving…';}
  try{
    const{data:ok}=await sb.rpc('pw_reset_window_ok');
    if(!ok){await sb.auth.signOut().catch(()=>{});return App.pwResetExpired();}
    const{error}=await sb.auth.updateUser({password:a});if(error)throw error;
    toast('Password updated ✓');
    setTimeout(()=>{location.replace(location.pathname+location.search);},600);   /* boot normally with the fresh session */
  }catch(e){toast(e.message||'Could not save the password','err');if(btn){btn.disabled=false;btn.textContent='Save password';}}
};
App.login=async()=>{
  const email=($('#li-e')?.value||'').trim().toLowerCase();
  const pw=($('#li-p')?.value||'').trim();
  if(!email||!pw){toast('Enter your email and password','err');return;}
  const btn=document.querySelector('button[onclick="App.login()"]');
  if(btn){btn.disabled=true;btn.textContent='Signing in…';}
  try{
    const{data,error}=await sb.auth.signInWithPassword({email,password:pw});
    if(error)throw error;
    // Render from cache immediately so UI appears fast
    const cachedUser=DB.users.find(x=>(x.email||'').toLowerCase()===email);
    if(cachedUser&&cachedUser.status==='Active'){
      S.uid=cachedUser.id;
      S.route='home';
      // v3.14: signing in must adopt THIS person's remembered filters. restoreFilters
      // throws the whole map away if it was written by someone else — people close the
      // browser without signing out, and the next person must not inherit their view.
      try{restoreFilters(S.route);if(typeof App._okrReloadExpanded==='function')App._okrReloadExpanded();}catch(e){}
      render(); // show page instantly
    }
    // Load fresh profile in background
    const{data:profile}=await sb.from('profiles').select('*').eq('id',data.user.id).single();
    if(!profile){await sb.auth.signOut();S.uid=null;render();throw new Error('Profile not found');}
    if(profile.status==='Inactive'){await sb.auth.signOut();S.uid=null;render();throw new Error('Account inactive — contact admin');}
    const u={id:profile.id,firstName:_unesc(profile.first_name)||'',lastName:_unesc(profile.last_name)||'',email:profile.email||'',phone:_unesc(profile.phone)||'',position:_unesc(profile.position)||'',department:_unesc(profile.department)||'',role:profile.role||'User',status:profile.status,managerId:profile.manager_id||null,managerHistory:profile.manager_history||[],rules:profile.rules||{past:true,future:true,edit:true},approval:profile.approval_settings||{past:false,future:false,edited:false},docAccess:profile.doc_access||{departments:{},locations:{}},questionsAccess:profile.questions_access||false,emailEnabled:profile.email_enabled!==false,cities:Array.isArray(profile.cities)?profile.cities:[],hrm:(profile.hrm&&typeof profile.hrm==='object')?profile.hrm:null,notifyPrefs:(profile.notify_prefs&&typeof profile.notify_prefs==='object')?profile.notify_prefs:{},password:'***'};
    const idx=DB.users.findIndex(x=>x.id===u.id);
    if(idx>-1)DB.users[idx]=u;else DB.users.push(u);
    S.uid=u.id;
    if(!S.route||S.route==='login')S.route='home';
    // Same restore on the no-cache path (first sign-in on this device, or cache miss).
    try{restoreFilters(S.route);if(typeof App._okrReloadExpanded==='function')App._okrReloadExpanded();}catch(e){}
    saveDB();render();
    // Load full data in background — don't block UI
    loadFromSB().then(()=>{saveDB();if(Date.now()-_lastUserAction>3000)render();try{if(typeof _bbAfterBoot==='function')_bbAfterBoot();}catch(e){}}).catch(()=>{});
  }catch(err){
    const msg=err.message.includes('Invalid')||err.message.includes('credentials')||err.message.includes('invalid_grant')
      ?'Incorrect email or password':err.message;
    toast(msg,'err');
    if(btn){btn.disabled=false;btn.textContent='Sign in';}
  }
};

