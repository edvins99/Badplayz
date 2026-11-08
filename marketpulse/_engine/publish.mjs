import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {Store} from './lib/store.mjs';
import {ScannerEngine} from './lib/engine.mjs';
import {SOURCES} from './lib/adapters.mjs';
import {TF} from './lib/analytics.mjs';
const base='https://edvins99.github.io/Badplayz/marketpulse/data/',out=resolve(import.meta.dirname,'..','data'),store=new Store(':memory:');
const previous=async file=>{try{const r=await fetch(base+file+'?build='+Date.now(),{signal:AbortSignal.timeout(15000)});if(r.ok)return await r.json();}catch{}return null;};
const [history,universe]=await Promise.all([previous('history.json'),previous('universe.json')]);
for(const s of (history?.signals||[]).slice(0,1500)){
  if(!s||!SOURCES.includes(s.market?.source)||!['MOVES','LEVELS','SLOPE'].includes(s.strategy)||!TF[s.timeframe]||!Number.isFinite(s.createdAt)||s.createdAt>Date.now()+1000||!Array.isArray(s.snapshot)||s.snapshot.length>1000)continue;
  const {result,...signal}=s;store.putMarket(signal.market);store.addSignal(signal);if(result)store.putResult(signal.id,result);
}
for(const l of (history?.listings||[]).slice(0,1000))if(typeof l.id==='string'&&Number.isFinite(l.announcedAt)&&/^https:\/\//.test(l.sourceUrl))store.listing(l);
for(const [source,ids]of Object.entries(universe||{}))if(SOURCES.includes(source)&&Array.isArray(ids)&&ids.length<20000)store.rememberUniverse(source,ids.filter(id=>typeof id==='string'&&id.startsWith(source+':')));
store.saveSettings({source:'auto',maxMarkets:300,timeframe:'15m',period:'15m',minVolume24h:100000,minTradfiVolume24h:0});
const engine=new ScannerEngine(store);
try{
  await engine.scan();if(!engine.snapshot.rows.length)throw new Error(engine.status.error||'No verified exchange data; keeping the prior deployment');
  mkdirSync(out,{recursive:true});
  const write=(name,data)=>writeFileSync(resolve(out,name),JSON.stringify(data));
  write('snapshot.json',{...engine.view(),host:'github-pages',generatedAt:new Date().toISOString(),publicFeed:true});
  write('history.json',{generatedAt:new Date().toISOString(),mode:'live',signals:store.signals({limit:1500}),listings:store.listings(1000)});
  write('universe.json',Object.fromEntries(store.db.prepare('SELECT source,symbols FROM universe').all().map(r=>[r.source,JSON.parse(r.symbols)])));
  console.log(JSON.stringify({status:'verified-live-feed',catalog:engine.snapshot.catalog.length,scanned:engine.snapshot.rows.length,signals:store.stats().signals,classes:Object.fromEntries(['CRYPTO','STOCK','COMMODITY'].map(k=>[k,engine.snapshot.catalog.filter(m=>m.assetClass===k).length])),sources:engine.status.sources,errors:engine.snapshot.errors.length}));
}finally{engine.stop();store.close();}
