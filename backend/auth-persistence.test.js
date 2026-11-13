const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'../assets/js/platform.js'),'utf8');
const tick = () => new Promise(setImmediate);
function boot({status=200,signedIn=true,initialEvent=false,hold=false,hangSession=false,emitOnGet=false}={}) {
  const state={status,session:signedIn?{access_token:'TEST_SESSION',user:{id:'customer'}}:null,saved:null,clears:0,calls:0,creates:0,updates:0,getCalls:0,events:{},timers:new Map(),listener:null};
  let timerId=0, release;
  const gate = new Promise(resolve=>release=resolve);state.release=release;
  const auth={getSession:async()=>{state.getCalls++;if(hangSession)return new Promise(()=>{});if(emitOnGet)state.listener?.('SIGNED_IN',state.session);return {data:{session:state.session}};},onAuthStateChange:fn=>{state.listener=fn;if(initialEvent)queueMicrotask(()=>fn('INITIAL_SESSION',state.session));}};
  const win={FAMINA_API_BASE:'https://api.invalid',supabase:{createClient:(url,key,options)=>{state.creates++;state.options=options;return {auth}}},
    FaminaSession:{clear:()=>{state.clears++;state.saved=null},save:(token,user)=>{state.saved={token,user}}},
    addEventListener:(name,fn)=>state.events[name]=fn,dispatchEvent:event=>{if(event.type==='famina-auth-updated')state.updates++;},FaminaNotifications:{show(){}}};
  const context={window:win,document:{addEventListener(){}},AbortSignal,Event,queueMicrotask,
    setTimeout:(fn,ms)=>{const id=++timerId;state.timers.set(id,{fn,ms});return id;},clearTimeout:id=>state.timers.delete(id),
    fetch:async url=>{if(url.endsWith('/auth/me')){state.calls++;if(hold)await gate;}const status=url.endsWith('/config')||url.endsWith('/menu')?200:state.status;return {ok:status===200,status,json:async()=>url.endsWith('/config')?{configured:true,supabaseUrl:'https://test.invalid',supabaseAnonKey:'PUBLIC'}:url.endsWith('/auth/me')?{user:{id:'customer',role:'customer',name:'TEST'},message:'TEST failure'}:[]};}};
  vm.createContext(context);vm.runInContext(source,context);state.context=context;state.F=win.Famina;
  state.flush=async()=>{for(const [id,timer] of [...state.timers])if(timer.ms===0){state.timers.delete(id);timer.fn();}await tick();};
  return state;
}
test('initial SDK callback and initial restore share one verification and ready waits for it',async()=>{
  const a=boot({initialEvent:true,hold:true});await tick();assert.equal(a.calls,1);assert.equal(a.F.user,null);
  a.listener('SIGNED_IN',a.session);await a.flush();assert.equal(a.calls,1);
  a.release();await a.F.ready;await a.flush();assert.equal(a.F.user.id,'customer');assert.equal(a.calls,1);
  assert.equal(a.options.auth.persistSession,true);assert.equal(a.options.auth.autoRefreshToken,true);
});
test('duplicate SIGNED_IN events and getSession notifications do not reverify or rerender',async()=>{
  const a=boot({initialEvent:true,emitOnGet:true});await a.F.ready;await a.flush();const updates=a.updates;
  for(let i=0;i<20;i++)a.listener('SIGNED_IN',a.session);await a.flush();
  for(let i=0;i<5;i++)await a.F.api('/cart');await a.flush();
  assert.equal(a.calls,1);assert.equal(a.updates,updates);assert(a.getCalls<10);
});
test('initial API outage settles to error without retry timers; explicit retry recovers once',async()=>{
  const a=boot({status:503,initialEvent:true});await a.F.ready;await a.flush();
  assert.equal(a.F.authState,'error');assert.equal(a.calls,1);assert.equal(a.clears,0);
  assert.equal([...a.timers.values()].filter(t=>t.ms>0).length,0);
  a.status=200;await Promise.all([a.F.retryAuth(),a.F.retryAuth()]);assert.equal(a.calls,2);assert.equal(a.F.user.id,'customer');
});
test('an explicit profile refresh can fail transiently without deleting a verified SDK session',async()=>{
  const a=boot();await a.F.ready;a.status=503;await assert.rejects(a.F.refreshUser(a.session));
  assert.equal(a.F.user.id,'customer');assert.equal(a.clears,0);assert(a.F.authError);
  a.status=200;await a.F.retryAuth();assert.equal(a.F.authError,null);
});
test('rejected token settles to login-required and duplicate SDK events cannot resurrect it',async()=>{
  const a=boot({status:401});await a.F.ready;assert.equal(a.F.authState,'unauthenticated');
  for(let i=0;i<10;i++)a.listener('SIGNED_IN',a.session);await a.flush();assert.equal(a.calls,1);assert.equal(a.F.user,null);
});
test('sign-out during verification invalidates its late result',async()=>{
  const a=boot({hold:true});await tick();a.session=null;a.listener('SIGNED_OUT',null);a.release();await a.F.ready;await a.flush();
  assert.equal(a.F.user,null);assert.equal(a.F.authState,'unauthenticated');assert.equal(a.saved,null);
});
test('loading platform twice creates only one client and listener',async()=>{
  const a=boot();await a.F.ready;vm.runInContext(source,a.context);assert.equal(a.creates,1);assert.equal(a.calls,1);
});
test('public catalog does not wait for a stalled authentication SDK',async()=>{
  const a=boot({hangSession:true});await tick();assert.deepEqual(await a.F.api('/menu'),[]);
  const deadline=[...a.timers].find(([,t])=>t.ms===15000);assert(deadline);a.timers.delete(deadline[0]);deadline[1].fn();
  await a.F.ready;assert.equal(a.F.authState,'error');
});
