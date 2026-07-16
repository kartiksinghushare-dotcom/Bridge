/* ============================================================
   Bridge — 01a-sync-queue.js  (NEW in v2)
   Reliable write layer.

   Why: writes used to be fire-and-forget — supabase-js does NOT
   reject on API errors ({error} is returned, not thrown), so an
   expired session or a flaky connection made changes silently
   vanish, and the next background refresh reverted them locally
   (the "closed ticket reopens hours later" bug).

   What this does:
   1. sbWrite() — every critical write checks {error}, refreshes
      the auth session first if it is about to expire, and retries.
   2. Failed writes are queued in localStorage and re-sent when the
      connection/session recovers (online / tab-visible / every 30s).
   3. pendingWriteIds(table) lets refresh code protect rows that
      still have unsent local changes from being clobbered.
   ============================================================ */
const PENDING_WRITES_KEY='bridge_pending_writes_v1';
let _pendingWrites=[];
try{_pendingWrites=JSON.parse(localStorage.getItem(PENDING_WRITES_KEY)||'[]')||[];}catch(e){_pendingWrites=[];}
function _savePendingWrites(){try{localStorage.setItem(PENDING_WRITES_KEY,JSON.stringify(_pendingWrites));}catch(e){}}

/* Rows (by table) that still have queued local changes */
function pendingWriteIds(table){const s=new Set();_pendingWrites.forEach(w=>{if(w.table===table&&w.id)s.add(w.id);});return s;}

/* Make sure the JWT is fresh before an important request */
async function ensureSession(){
  try{
    const{data:{session}}=await sb.auth.getSession();
    if(!session)return false;
    const expMs=(session.expires_at||0)*1000;
    if(expMs&&expMs-Date.now()<60*1000){                       // <1 min left → refresh now
      const{error}=await sb.auth.refreshSession();
      if(error)return false;
    }
    return true;
  }catch(e){return false;}
}

async function _runWrite(w){
  try{
    let q;
    if(w.op==='update')q=sb.from(w.table).update(w.values).eq(w.match.col,w.match.val);
    else if(w.op==='insert')q=sb.from(w.table).insert(w.values);
    else if(w.op==='upsert')q=sb.from(w.table).upsert(w.values,w.opts||undefined);
    else if(w.op==='delete')q=sb.from(w.table).delete().eq(w.match.col,w.match.val);
    else return{error:{message:'unknown op '+w.op}};
    const{error}=await q;
    return{error:error||null};
  }catch(e){return{error:{message:(e&&e.message)||'network error'}}; }
}

/* The one entry point: sbWrite({table,op,values,match,id},{label,queueOnFail,silent}) */
async function sbWrite(w,opts){
  opts=opts||{};const label=opts.label||'Change';
  await ensureSession();
  let res=await _runWrite(w);
  if(res.error){                                                // one immediate retry after a forced refresh
    try{await sb.auth.refreshSession();}catch(e){}
    res=await _runWrite(w);
  }
  if(res.error){
    console.warn('[sbWrite failed]',w.table,label,res.error.message);
    if(opts.queueOnFail===false){
      if(!opts.silent)toast(label+' could not sync: '+res.error.message,'err');
      return false;
    }
    w.ts=Date.now();w.label=label;
    _pendingWrites.push(w);_savePendingWrites();_pendingBadge();
    if(!opts.silent)toast(label+' saved on this device — will keep retrying to sync','warn');
    return false;
  }
  return true;
}

let _flushingWrites=false;
async function flushPendingWrites(){
  if(_flushingWrites||!_pendingWrites.length)return;
  if(typeof navigator!=='undefined'&&navigator.onLine===false)return;
  _flushingWrites=true;
  try{
    if(!(await ensureSession())){return;}
    const still=[];
    for(const w of _pendingWrites){
      const res=await _runWrite(w);
      if(res.error){
        if(Date.now()-(w.ts||0)>7*24*3600*1000)console.warn('[sync-queue] dropping write older than 7 days:',w);
        else still.push(w);
      }
    }
    const flushed=_pendingWrites.length-still.length;
    _pendingWrites=still;_savePendingWrites();_pendingBadge();
    if(flushed&&!still.length){toast('All pending changes synced ✓');try{if(typeof _lazyForRoute==='function'&&window.S&&S.route)_lazyForRoute(S.route);}catch(e){}}
  }finally{_flushingWrites=false;}
}

/* Small fixed badge so unsent changes are visible instead of silent */
function _pendingBadge(){
  try{
    let b=document.getElementById('pendingbar');const n=_pendingWrites.length;
    if(!n){if(b)b.remove();return;}
    if(!b){
      b=document.createElement('div');b.id='pendingbar';
      b.style.cssText='position:fixed;bottom:14px;left:14px;z-index:99;background:#FFF7ED;color:#C2410C;border:1.5px solid #FED7AA;border-radius:10px;padding:6px 12px;font-size:12px;font-weight:700;box-shadow:0 4px 14px rgba(0,0,0,.10);cursor:pointer';
      b.title='Some changes haven’t reached the server yet. Click to retry now.';
      b.onclick=()=>flushPendingWrites();
      document.body.appendChild(b);
    }
    b.textContent='↻ '+n+' change'+(n===1?'':'s')+' waiting to sync — tap to retry';
  }catch(e){}
}

setInterval(flushPendingWrites,30*1000);
window.addEventListener('online',()=>flushPendingWrites());
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')flushPendingWrites();});
document.addEventListener('DOMContentLoaded',()=>{_pendingBadge();if(_pendingWrites.length)flushPendingWrites();});
