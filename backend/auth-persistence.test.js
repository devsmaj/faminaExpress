const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../assets/js/platform.js'), 'utf8');
function boot({status=200,signedIn=true}={}) {
  const state={status,session:signedIn?{access_token:'TEST_SESSION'}:null,saved:null,clears:0,timers:[],listener:null,events:{}};
  const auth={getSession:async()=>({data:{session:state.session}}),onAuthStateChange:fn=>{state.listener=fn}};
  const win={supabase:{createClient:(url,key,options)=>{state.options=options;return {auth}}},
    FaminaSession:{clear:()=>{state.clears++;state.saved=null},save:(token,user)=>{state.saved={token,user}}},
    addEventListener:(name,fn)=>{state.events[name]=fn},dispatchEvent(){},FaminaNotifications:{show(){}}};
  const context={window:win,document:{addEventListener(){},hidden:false},AbortSignal,Event,
    setTimeout:fn=>{state.timers.push(fn);return state.timers.length},clearTimeout(){},
    fetch:async url=>({ok:url.endsWith('/config')||state.status===200,status:state.status,
      json:async()=>url.endsWith('/config')?{configured:true,supabaseUrl:'https://test.invalid',supabaseAnonKey:'PUBLIC'}:state.status===200?{user:{id:'customer',role:'customer',name:'TEST'}}:{message:'TEST failure'}})};
  win.FAMINA_API_BASE='https://api.invalid';vm.runInNewContext(source,context);
  state.F=win.Famina;return state;
}
test('stored SDK session restores verified account on a fresh page',async()=>{
  const a=boot();await a.F.ready;assert.equal(a.F.user.id,'customer');assert.equal(a.saved.token,'TEST_SESSION');
  assert.equal(a.options.auth.persistSession,true);assert.equal(a.options.auth.autoRefreshToken,true);
  const b=boot();await b.F.ready;assert.equal(b.F.user.id,'customer');
});
test('temporary backend error retains verified identity and SDK session for retry',async()=>{
  const a=boot();await a.F.ready;a.status=503;a.listener();await a.timers.shift()();
  await new Promise(setImmediate);assert.equal(a.F.user.id,'customer');assert.equal(a.clears,0);assert(a.F.authError);
  a.status=200;await a.events.online();await new Promise(setImmediate);assert.equal(a.F.authError,null);
});
test('listener survives initial API outage and later verifies the saved SDK session',async()=>{
  const a=boot({status:503});await a.F.ready;assert.equal(a.F.user,null);assert.equal(typeof a.listener,'function');assert.equal(a.clears,0);
  a.status=200;await a.events.online();await new Promise(setImmediate);assert.equal(a.F.user.id,'customer');
});
test('rejected identity clears visible profile instead of accepting cached data',async()=>{
  const a=boot();await a.F.ready;a.status=401;a.listener();await a.timers.shift()();await new Promise(setImmediate);
  assert.equal(a.F.user,null);assert.equal(a.saved,null);
});
test('explicit sign-out clears the profile',async()=>{
  const a=boot();await a.F.ready;a.session=null;a.listener();await a.timers.shift()();await new Promise(setImmediate);
  assert.equal(a.F.user,null);assert.equal(a.saved,null);
});
