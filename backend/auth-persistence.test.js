const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'../assets/js/platform.js'),'utf8');
const loadingSource = fs.readFileSync(path.join(__dirname,'../assets/js/loading.js'),'utf8');
const tick = () => new Promise(setImmediate);
function boot({status=200,signedIn=true,initialEvent=false,hold=false,hangSession=false,emitOnGet=false}={}) {
  const state={status,session:signedIn?{access_token:'TEST_SESSION',user:{id:'customer'}}:null,saved:null,clears:0,calls:0,creates:0,updates:0,getCalls:0,events:{},timers:new Map(),listener:null,requestUrls:[]};
  let timerId=0, release;
  const gate = new Promise(resolve=>release=resolve);state.release=release;
  const auth={getSession:async()=>{state.getCalls++;if(hangSession)return new Promise(()=>{});if(emitOnGet)state.listener?.('SIGNED_IN',state.session);return {data:{session:state.session}};},onAuthStateChange:fn=>{state.listener=fn;if(initialEvent)queueMicrotask(()=>fn('INITIAL_SESSION',state.session));}};
  const win={FAMINA_API_BASE:'https://api.invalid',supabase:{createClient:(url,key,options)=>{state.creates++;state.options=options;return {auth}}},
    FaminaSession:{clear:()=>{state.clears++;state.saved=null},save:(token,user)=>{state.saved={token,user}}},
    addEventListener:(name,fn)=>state.events[name]=fn,dispatchEvent:event=>{if(event.type==='famina-auth-updated')state.updates++;},FaminaNotifications:{show(){}}};
  const context={window:win,document:{addEventListener(){}},AbortSignal,Event,URL,queueMicrotask,
    setTimeout:(fn,ms)=>{const id=++timerId;state.timers.set(id,{fn,ms});return id;},clearTimeout:id=>state.timers.delete(id),
    fetch:async url=>{url=String(url);state.requestUrls.push(url);if(url.endsWith('/auth/me')){state.calls++;if(hold)await gate;}const status=url.endsWith('/config')||url.endsWith('/menu')?200:state.status;return {ok:status===200,status,json:async()=>url.endsWith('/config')?{configured:true,supabaseUrl:'https://test.invalid',supabaseAnonKey:'PUBLIC'}:url.endsWith('/auth/me')?{user:{id:'customer',role:'customer',name:'TEST'},message:'TEST failure'}:[]};}};
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
test('foreground platform requests balance loader state and background requests stay quiet',async()=>{
  const a=boot();await a.F.ready;let started=0,finished=0;
  a.context.window.FaminaLoading={request(){started++;return()=>{finished++;}}};
  await a.F.api('/cart');
  await a.F.api('/cart',{background:true});
  assert.equal(started,1);assert.equal(finished,1);
  a.status=503;await assert.rejects(a.F.api('/cart'));
  assert.equal(started,2);assert.equal(finished,2);
});
test('API requests normalize a trailing slash in the configured base URL',async()=>{
  const a=boot();await a.F.ready;
  a.context.window.FAMINA_API_BASE='https://api.invalid/api/';
  await a.F.api('/auth/pin',{method:'POST',body:{pin:'123456'}});
  assert.equal(a.requestUrls.at(-1),'https://api.invalid/api/auth/pin');
});
test('shared loader avoids quick flashes and remains visible until overlapping requests finish',()=>{
  const timers=new Map();let nextTimer=0;
  class Element {
    constructor(){this.children=[];this.attributes={};this.hidden=false;this.classList={contains:name=>name==='fp-verification-page',add(){},remove(){}};}
    append(...children){this.children.push(...children);}
    setAttribute(name,value){this.attributes[name]=value;}
  }
  const body=new Element();body.dataset={};
  const document={body,baseURI:'https://devsmaj.github.io/Famipay/',documentElement:{classList:{remove(){}}},createElement:()=>new Element(),addEventListener(){}};
  const window={setTimeout(fn){const id=++nextTimer;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);},addEventListener(){}};
  vm.runInNewContext(loadingSource,{window,document,URL});
  const quick=window.FaminaLoading.request();quick();
  assert.equal(body.children.length,0);
  const finishA=window.FaminaLoading.request(),finishB=window.FaminaLoading.request();
  const [timerId,show]=timers.entries().next().value;timers.delete(timerId);show();
  const loader=body.children[0];
  assert.equal(loader.hidden,false);assert.equal(loader.children.length,2);
  assert.equal(loader.children[0].className,'fp-global-loader-ring');
  finishA();finishA();assert.equal(loader.hidden,false);
  finishB();assert.equal(loader.hidden,true);
});
test('private navigation shows the official mark immediately and overlapping requests keep it visible',()=>{
  const timers=new Map();let nextTimer=0;
  class Element {
    constructor(){this.children=[];this.hidden=false;this.classList={contains:name=>name==='fp-app',remove(){}};}
    append(...children){this.children.push(...children);}
    setAttribute(){}
  }
  const body=new Element();body.dataset={};
  const document={body,baseURI:'https://devsmaj.github.io/Famipay/',documentElement:{classList:{remove(){}}},createElement:()=>new Element(),addEventListener(){}};
  const window={setTimeout(fn){const id=++nextTimer;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);},addEventListener(){}};
  vm.runInNewContext(loadingSource,{window,document,URL});
  window.FaminaLoading.transition();
  const loader=body.children[0];
  assert.equal(loader.hidden,false);
  assert.match(loader.children[1].children[0].src,/famipay-mark\.svg$/);
  const finish=window.FaminaLoading.request();
  for(const [id,fn] of [...timers]){timers.delete(id);fn();}
  assert.equal(loader.hidden,false);
  finish();assert.equal(loader.hidden,true);
});

test('public catalog does not wait for a stalled authentication SDK',async()=>{
  const a=boot({hangSession:true});await tick();assert.deepEqual(await a.F.api('/menu'),[]);
  const deadline=[...a.timers].find(([,t])=>t.ms===15000);assert(deadline);a.timers.delete(deadline[0]);deadline[1].fn();
  await a.F.ready;assert.equal(a.F.authState,'error');
});
