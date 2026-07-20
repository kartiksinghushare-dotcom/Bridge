/* ============================================================
   Bridge — 07-login.js  (split from Bridge.html lines 2088-2155)
   Classic script: shares top-level scope with the other /js files.
   Load order matters — see index.html.
   ============================================================ */
/* ===== LOGIN ===== */
function loginView(){return`<div class="min-h-screen flex" style="background:var(--c-bg)">
  <div class="hidden lg:flex flex-col justify-between" style="width:44%;background:#13171B;color:#fff;padding:56px;position:relative;overflow:hidden">
    <div style="position:absolute;right:-120px;top:-120px;width:420px;height:420px;border-radius:50%;background:radial-gradient(circle,rgba(209,182,143,.28),transparent 70%);filter:blur(40px)"></div>
    <div style="position:absolute;left:-80px;bottom:-100px;width:360px;height:360px;border-radius:50%;background:radial-gradient(circle,rgba(226,183,169,.18),transparent 70%);filter:blur(50px)"></div>
    <div class="relative" style="display:flex;flex-direction:column;gap:6px"><span class="fd" style="font-size:21px;font-weight:600;letter-spacing:.42em;color:#fff">BRIDGE</span><span style="font-size:10.5px;font-weight:600;letter-spacing:.34em;color:#D1B68F">BY BLOOMINGBOX</span></div>
    <div class="relative"><h1 class="fd" style="font-size:33px;font-weight:500;line-height:1.32;letter-spacing:.07em">EVERY SHIFT,<br>EVERY CHECK,<br><span style="color:#D1B68F">ACCOUNTED FOR.</span></h1><div style="width:56px;height:1px;background:#D1B68F;margin-top:22px"></div><p style="color:rgba(255,255,255,.6);margin-top:20px;line-height:1.7;font-size:14px;max-width:380px;font-weight:300">Enterprise checklists with question-based responses, escalation routing, location tracking, and real-time approvals.</p>
      <div style="display:flex;gap:24px;margin-top:34px">
        <div><div class="fd" style="font-size:13px;font-weight:600;letter-spacing:.18em;color:#D1B68F">CHECKLISTS</div><div style="font-size:12px;color:rgba(255,255,255,.45);margin-top:4px;font-weight:300">every shift covered</div></div>
        <div style="width:1px;background:rgba(209,182,143,.25)"></div>
        <div><div class="fd" style="font-size:13px;font-weight:600;letter-spacing:.18em;color:#D1B68F">APPROVALS</div><div style="font-size:12px;color:rgba(255,255,255,.45);margin-top:4px;font-weight:300">one unified inbox</div></div>
      </div></div>
    <div style="font-size:11px;letter-spacing:.22em;color:rgba(255,255,255,.35)">© 2026 BLOOMINGBOX</div>
  </div>
  <div class="flex-1 flex items-center justify-center p-6"><div class="w-full max-w-sm fade">
    <div class="lg:hidden flex flex-col items-center gap-1 mb-8"><span class="fd" style="font-size:17px;font-weight:600;letter-spacing:.4em;color:var(--c-ink)">BRIDGE</span><span style="font-size:9px;font-weight:600;letter-spacing:.3em;color:#936659">BY BLOOMINGBOX</span></div>
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
  </div></div></div>`;}
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
      S.route=cachedUser.role==='Admin'?'dashboard':'mychecklists';
      render(); // show page instantly
    }
    // Load fresh profile in background
    const{data:profile}=await sb.from('profiles').select('*').eq('id',data.user.id).single();
    if(!profile){await sb.auth.signOut();S.uid=null;render();throw new Error('Profile not found');}
    if(profile.status==='Inactive'){await sb.auth.signOut();S.uid=null;render();throw new Error('Account inactive — contact admin');}
    const u={id:profile.id,firstName:_unesc(profile.first_name)||'',lastName:_unesc(profile.last_name)||'',email:profile.email||'',phone:_unesc(profile.phone)||'',position:_unesc(profile.position)||'',department:_unesc(profile.department)||'',role:profile.role||'User',status:profile.status,managerId:profile.manager_id||null,managerHistory:profile.manager_history||[],rules:profile.rules||{past:true,future:true,edit:true},approval:profile.approval_settings||{past:false,future:false,edited:false},docAccess:profile.doc_access||{departments:{},locations:{}},questionsAccess:profile.questions_access||false,emailEnabled:profile.email_enabled!==false,cities:Array.isArray(profile.cities)?profile.cities:[],hrm:(profile.hrm&&typeof profile.hrm==='object')?profile.hrm:null,password:'***'};
    const idx=DB.users.findIndex(x=>x.id===u.id);
    if(idx>-1)DB.users[idx]=u;else DB.users.push(u);
    S.uid=u.id;
    if(!S.route||S.route==='login')S.route=u.role==='Admin'?'dashboard':'mychecklists';
    saveDB();render();
    // Load full data in background — don't block UI
    loadFromSB().then(()=>{saveDB();if(Date.now()-_lastUserAction>3000)render();}).catch(()=>{});
  }catch(err){
    const msg=err.message.includes('Invalid')||err.message.includes('credentials')||err.message.includes('invalid_grant')
      ?'Incorrect email or password':err.message;
    toast(msg,'err');
    if(btn){btn.disabled=false;btn.textContent='Sign in';}
  }
};

