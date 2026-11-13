// Isolated regression fixtures. No hosted accounts, restaurant data or payments.
const {chromium}=require('../backend/node_modules/playwright');
const express=require('../backend/node_modules/express');
const assert=require('node:assert/strict');
const path=require('node:path');
const app=express(), cases=new Map();
app.use('/api/:scenario',(req,res)=>{
  const state=cases.get(req.params.scenario);
  const endpoint=req.path;
  if(endpoint==='/config'){
    if(state.hangConfig)return;
    return res.json({configured:true,supabaseUrl:'https://fixture.example',supabaseAnonKey:'TEST_PUBLIC'});
  }
  if(endpoint==='/auth/me'){
    state.authCalls++;
    return setTimeout(()=>state.authStatus===200?res.json({user:{id:'TEST_CUSTOMER',role:'customer',name:'TEST USER',active:true}}):res.status(state.authStatus).json({message:'TEST verification failed'}),40);
  }
  if(endpoint==='/orders'&&state.orderStatus===401)return res.status(401).json({message:'TEST expired session'});
  res.json([]);
});
app.use(express.static(path.resolve(__dirname,'..')));
const sdk=`window.supabase={createClient:()=>{window.TEST_CLIENTS=(window.TEST_CLIENTS||0)+1;let listener;const session=()=>localStorage.getItem('TEST_ROLE')?{access_token:'TEST_TOKEN',user:{id:'TEST_CUSTOMER'}}:null;window.TEST_AUTH_EVENTS=()=>{for(let i=0;i<30;i++)listener?.('SIGNED_IN',session());};return {auth:{getSession:async()=>{window.TEST_SESSION_READS=(window.TEST_SESSION_READS||0)+1;if(window.TEST_HANG_SESSION)return new Promise(()=>{});if(session())listener?.('SIGNED_IN',session());return {data:{session:session()}};},onAuthStateChange:fn=>{listener=fn;queueMicrotask(()=>fn('INITIAL_SESSION',session()));},signOut:async()=>{localStorage.removeItem('TEST_ROLE');listener('SIGNED_OUT',null);return {error:null};}},channel:()=>({on(){return this},subscribe(){return this}}),removeChannel(){}};}};`;
(async()=>{
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  const errors=[];let caseId=0;
  async function open(width,role,authStatus,pageName,{hang=false,orderStatus=200,deadline=false}={}){
    const key=String(++caseId), state={authCalls:0,authStatus,orderStatus,hangConfig:deadline};cases.set(key,state);
    const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block',reducedMotion:'reduce'});
    await context.addInitScript(({key,role,hang})=>{
      window.FAMINA_API_BASE=location.origin+'/api/'+key;localStorage.setItem('language','en');
      window.TEST_HANG_SESSION=hang;
      if(role)localStorage.setItem('TEST_ROLE',role);
    },{key,role,hang});
    await context.route('**/assets/vendor/supabase.js',route=>route.fulfill({contentType:'application/javascript',body:sdk}));
    await context.route('https://**/*',route=>route.abort());
    const page=await context.newPage();page.setDefaultTimeout(15000);
    if(deadline)await page.clock.install();
    page.on('pageerror',error=>errors.push(error.message));
    let documents=0;page.on('framenavigated',frame=>{if(frame===page.mainFrame())documents++;});
    await page.goto(base+'/'+pageName,{waitUntil:'domcontentloaded'});
    if(deadline){await page.clock.fastForward(31000);await page.waitForSelector('.page-load-error,[data-retry-auth]');}
    else await page.waitForFunction(()=>!document.documentElement.classList.contains('page-loading'));
    return {page,context,state,documents:()=>documents};
  }
  try {
    for(const width of [390,1440]){
      const customer=await open(width,'customer',200,'customer-home.html');
      await customer.page.waitForFunction(()=>Famina.user?.role==='customer');
      await customer.page.evaluate(()=>TEST_AUTH_EVENTS());
      await customer.page.waitForTimeout(250);
      assert.equal(customer.state.authCalls,1);assert.equal(customer.documents(),1);
      assert.equal(await customer.page.evaluate(()=>TEST_CLIENTS),1);
      assert.equal(await customer.page.locator('[data-customer-home]').count(),1);
      assert.equal(await customer.page.locator('[data-retry-auth]').count(),0);
      await customer.page.addScriptTag({url:base+'/assets/js/platform.js'});
      await customer.page.addScriptTag({url:base+'/assets/js/navigation.js'});
      assert.equal(await customer.page.evaluate(()=>TEST_CLIENTS),1);
      assert.equal(customer.documents(),1);
      await customer.context.close();
      const guest=await open(width,null,200,'orders.html');
      assert.match(await guest.page.locator('main').innerText(),/Please login to continue/);
      assert.equal(guest.documents(),1);assert.equal(guest.state.authCalls,0);
      await guest.context.close();
      const unavailable=await open(width,'customer',503,'profile.html');
      assert.match(await unavailable.page.locator('main').innerText(),/verification is temporarily unavailable/);
      await unavailable.page.clock.install();await unavailable.page.clock.fastForward(65000);
      assert.equal(unavailable.state.authCalls,1);assert.equal(unavailable.documents(),1);
      unavailable.state.authStatus=200;
      await unavailable.page.locator('[data-retry-auth]').click();
      await unavailable.page.clock.runFor(100);
      await unavailable.page.waitForFunction(()=>Famina.authState==='authenticated');
      assert.match(await unavailable.page.locator('main').innerText(),/Session updated/);
      assert.equal(unavailable.documents(),1);assert.equal(unavailable.state.authCalls,2);
      await unavailable.context.close();
      const rejected=await open(width,'customer',401,'customer-home.html');
      await rejected.page.evaluate(()=>TEST_AUTH_EVENTS());await rejected.page.waitForTimeout(100);
      assert.match(await rejected.page.locator('main').innerText(),/Please login to continue/);
      assert.equal(rejected.documents(),1);assert.equal(rejected.state.authCalls,1);
      await rejected.context.close();
      const expired=await open(width,'customer',200,'orders.html',{orderStatus:401});
      await expired.page.waitForFunction(()=>Famina.authState==='unauthenticated');
      await expired.page.evaluate(()=>TEST_AUTH_EVENTS());await expired.page.waitForTimeout(100);
      assert.match(await expired.page.locator('main').innerText(),/Please login to continue/);
      assert.equal(expired.documents(),1);assert.equal(expired.state.authCalls,1);
      await expired.context.close();
      const publicPage=await open(width,'customer',200,'menu.html',{hang:true});
      assert.match(await publicPage.page.locator('#menu-items').innerText(),/No verified menu items available/);
      assert.equal(publicPage.documents(),1);assert.equal(publicPage.state.authCalls,0);
      await publicPage.context.close();
      const publicHome=await open(width,'customer',200,'index.html');
      await publicHome.page.waitForFunction(()=>Famina.authState==='authenticated');
      await publicHome.page.evaluate(()=>TEST_AUTH_EVENTS());await publicHome.page.waitForTimeout(100);
      assert.equal(publicHome.documents(),1);assert(new URL(publicHome.page.url()).pathname.endsWith('/index.html'));
      await publicHome.context.close();
      const stalled=await open(width,'customer',200,'profile.html',{deadline:true});
      assert.match(await stalled.page.locator('main').innerText(),/Service unavailable|verification is temporarily unavailable/);
      assert.equal(await stalled.page.locator('main').getAttribute('aria-busy'),null);
      assert.equal(stalled.documents(),1);
      await stalled.context.close();
      console.log('Stable '+width+'px: initial auth race, duplicate events/scripts, guest guard, API outage/retry, expired/rejected session, public catalog and public homepage.');
    }
    assert.deepEqual(errors,[]);
  } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
