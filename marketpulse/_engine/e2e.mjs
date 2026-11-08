import {createServer} from 'node:http';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright'),root=resolve(import.meta.dirname,'..','..'),server=createServer((req,res)=>{
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=resolve(root,'.'+path+(path.endsWith('/')?'index.html':''));
  if(!file.startsWith(root+'/')&&!file.startsWith(root+'\\')){res.writeHead(403);res.end();return;}
  try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json'})[extname(file)]||'application/octet-stream');res.end(readFileSync(file));}catch{res.writeHead(404);res.end();}
});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url='http://127.0.0.1:'+server.address().port+'/marketpulse/',browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto(url);await page.locator('.market-table tbody tr').first().waitFor({timeout:60000});
  assert.ok(+await page.locator('#stat-markets').textContent()>100);assert.match(await page.locator('body').textContent(),/GITHUB PAGES/);
  await page.locator('#search').fill('BTC');await page.locator('.market-table tbody tr').first().waitFor();assert.ok(await page.locator('.market-table tbody tr').count()>0);
  await page.locator('.market-table [data-star]').first().click();await page.waitForFunction(()=>+document.querySelector('#saved-count').textContent>0);
  await page.locator('#navigation [data-view="saved"]').click();await page.locator('.market-table tbody tr').first().waitFor();
  await page.locator('.market-table tbody tr').first().click();await page.locator('#detail-dialog[open] .candle-chart').waitFor({timeout:90000});
  for(const n of [30,80,160]){await page.locator('[data-chart-limit="'+n+'"]').click();assert.ok(await page.locator('[data-chart-limit="'+n+'"]').evaluate(e=>e.classList.contains('selected')));}
  await page.locator('#detail-dialog [data-close]').click();
  for(const view of ['stocks','commodities','crypto']){await page.locator('#navigation [data-view="'+view+'"]').click();await page.locator('.market-table tbody tr').first().waitFor();assert.ok(await page.locator('.market-table tbody tr').count()>0);await page.locator('[data-class-mode="signals"]').click();await page.locator('[data-class-mode="markets"]').click();}
  await page.locator('#navigation [data-view="markets"]').click();await page.locator('#filter-button').click();await page.locator('#asset-filter').selectOption('COMMODITY');assert.ok(await page.locator('.market-table tbody tr').count()>0);await page.locator('#reset-filters').click();await page.locator('#sort').selectOption('change24h');
  await page.locator('[data-layout="cards"]').click();assert.ok(await page.locator('.market-card').count()>0);await page.locator('[data-layout="table"]').click();
  for(const view of ['MOVES','LEVELS','SLOPE','listings','results']){await page.locator('#navigation [data-view="'+view+'"]').click();await page.waitForTimeout(250);assert.ok((await page.locator('#market-content').textContent()).length>30);}
  await page.locator('[data-view="settings"]').last().click();await page.locator('#settings-form').waitFor();await page.locator('[name="maxMarkets"]').fill('20');await page.getByRole('button',{name:'Saglabāt iestatījumus',exact:true}).click();await page.locator('#settings-form').waitFor();assert.equal(await page.locator('[name="maxMarkets"]').inputValue(),'20');await page.locator('#preview-sound').click();
  await page.locator('#tour-button').click();await page.locator('.tour-panel:not([hidden])').waitFor();for(let i=0;i<13;i++)await page.locator('[data-tour="next"]').click();await page.locator('[data-tour="next"]').click();assert.ok(await page.locator('.tour-panel').evaluate(e=>e.hidden));
  const download=page.waitForEvent('download');await page.locator('#export-link').click();assert.equal((await download).suggestedFilename(),'MarketPulse-history.json');
  await page.reload();await page.locator('.market-table tbody tr').first().waitFor();await page.locator('[data-view="settings"]').last().click();assert.equal(await page.locator('[name="maxMarkets"]').inputValue(),'20');
  await page.locator('#navigation [data-view="markets"]').click();mkdirSync('marketpulse-checks',{recursive:true});await page.screenshot({path:'marketpulse-checks/desktop.png',animations:'disabled'});
  await page.setViewportSize({width:390,height:844});await page.reload();await page.locator('#stat-markets').filter({hasNotText:'—'}).waitFor();await page.locator('#menu-button').click();await page.locator('#navigation [data-view="stocks"]').click();await page.waitForFunction(()=>document.querySelector('#sidebar').getBoundingClientRect().right<=1);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:'marketpulse-checks/mobile.png',animations:'disabled'});assert.deepEqual(errors,[]);
  console.log(JSON.stringify({status:'passed',flows:['real market feed','search','saved instruments','chart 30/80/160','stock/commodity/crypto catalogs','filters and sorting','cards/table','all strategies','listings/results','settings persist after reload','sound preview','14-step tour','JSON download','mobile navigation'],errors}));
}catch(e){mkdirSync('marketpulse-checks',{recursive:true});await page.screenshot({path:'marketpulse-checks/failure.png'}).catch(()=>{});throw e;}finally{await browser.close();await new Promise(r=>server.close(r));}
