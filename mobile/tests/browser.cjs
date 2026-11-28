const {chromium}=require(process.env.FAMIPAY_PLAYWRIGHT_MODULE||'../../backend/node_modules/playwright');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');

const root=path.resolve(process.env.FAMIPAY_BROWSER_ROOT||path.resolve(__dirname,'../www'));
const mime={
 '.css':'text/css',
 '.html':'text/html',
 '.js':'text/javascript',
 '.json':'application/json',
 '.png':'image/png',
 '.svg':'image/svg+xml',
};
const server=http.createServer((request,response)=>{
 const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
 const file=path.resolve(root,'.'+pathname);
 if(!file.startsWith(root+path.sep)){response.writeHead(403).end();return;}
 fs.readFile(file,(error,body)=>{
  if(error){response.writeHead(404).end();return;}
  response.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
  response.end(body);
 });
});

(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const origin='http://127.0.0.1:'+server.address().port;
  await page.route('**/*',route=>{
   if(route.request().url().startsWith(origin+'/'))return route.continue();
   return route.abort();
  });
  await page.route('**/assets/js/platform.js',route=>route.fulfill({
   contentType:'text/javascript',
   body:`const role=new URL(location.href).searchParams.get('role')||'customer';
    const user={id:'browser-test',role,name:'Test User',email:'test@example.invalid',
      email_verified:true,phone_verified:false,onboarding_complete:true};
    window.Famina={user,authState:'authenticated',ready:Promise.resolve(),config:{},
      escape:value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])),
      money:value=>String(value),notify:()=>{},refreshUser:async()=>{},
      api:async()=>[],client:{auth:{getSession:async()=>({data:{session:null},error:null}),
        signOut:async()=>({error:null})}}};`,
  }));

  for(const role of ['customer','restaurant_owner','seller','rider','admin']){
   await page.goto(`${origin}/famipay-app.html?role=${role}`);
   await page.locator('#app .app').waitFor({state:'attached'});
   assert(await page.locator('#app .app').count(),`missing shared app shell for ${role}`);
   if(role==='customer')assert(await page.locator('.fp-classic-dashboard').count(),'missing existing classic customer dashboard');
   if(role==='customer'){
    for(const size of [{width:320,height:568},{width:360,height:640},{width:390,height:844},{width:412,height:915},{width:768,height:1024},{width:844,height:390}]){
     await page.setViewportSize(size);
     const layout=await page.evaluate(()=>{
      const nav=document.querySelector('.bottom').getBoundingClientRect();
      const cards=[...document.querySelectorAll('.fp-classic-grid .card')];
      return {count:cards.length,width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,
       top:document.querySelector('.fp-classic-dashboard').getBoundingClientRect().top,navBottom:nav.bottom,
       fits:cards.every(card=>{const r=card.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&card.scrollHeight<=card.clientHeight+1;})};
     });
     assert.equal(layout.count,9);assert(layout.fits,JSON.stringify({size,layout}));
     // Home is intentionally vertically scrollable; the bottom navigation remains fixed.
     assert(layout.width<=size.width,JSON.stringify({size,layout}));
     assert(layout.height>=size.height,JSON.stringify({size,layout}));
     assert.equal(layout.top,0);assert.equal(layout.navBottom,size.height);
    }
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.locator('.fp-classic-balance-value').textContent(),'******');
    await page.getByRole('button',{name:'Show balance',exact:true}).click();
    assert.equal(await page.locator('.fp-classic-balance-value').textContent(),'Wallet not connected');
    await page.getByRole('button',{name:'Hide balance',exact:true}).click();
    assert.equal(await page.locator('.fp-classic-balance-value').textContent(),'******');
    // Exercise a real private navigation click, not a manually forced loader.
    await page.clock.install();
    await page.locator('.fp-classic-grid .card').filter({hasText:'Send Money'}).click();
    await page.waitForFunction(()=>location.hash==='#send-money');
    await page.locator('.fp-global-loader').waitFor({state:'visible'});
    assert.equal(await page.locator('.fp-global-loader-ring').evaluate(node=>getComputedStyle(node).width),'48px');
    await page.clock.runFor(500);
    await page.locator('.fp-global-loader').waitFor({state:'hidden'});
    await page.evaluate(()=>{location.hash='home';});
    await page.locator('.fp-classic-dashboard').waitFor();
    await page.clock.runFor(500);
    await page.clock.resume();
    for(const [label,hash] of [['Send Money','send-money'],['Receive Money','receive-money'],['Mobile Money','mobile-money'],['Airtime','airtime'],['Pay Bills','pay-bills'],['QR Payment','qr-payment'],['Restaurants','restaurants'],['Online Shop','online-shop'],['Agriculture','agriculture']]){
     await page.locator('.fp-classic-grid .card').filter({hasText:label}).click();
     await page.waitForFunction(hash=>location.hash==='#'+hash,hash);
     await page.evaluate(()=>{location.hash='home';});
     await page.locator('.fp-classic-dashboard').waitFor();
    }
   }
   assert(await page.locator('#app main').count(),`missing private content for ${role}`);
   const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('body *')].filter(node=>node.getBoundingClientRect().right>innerWidth+1).slice(0,6).map(node=>({tag:node.tagName,cls:node.className,width:node.getBoundingClientRect().width}))}));
   assert.equal(layout.scroll<=layout.width,true,`${role}: ${JSON.stringify(layout)}`);
  }

  for(const route of ['login.html','register.html','verify-email.html']){
   await page.goto(`${origin}/${route}`);
   assert(await page.locator('main').count(),`missing page content in ${route}`);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: shared web app loads for customer, restaurant, seller, rider and admin; auth pages load without script errors.');
 }finally{
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
