import {BrowserStore} from './store.js';
import {ScannerEngine} from './engine.js';
import {SOURCES} from './adapters.js';
import {TF} from './analytics.js';
import {cachedNews} from './news.js';
let engine,store;
const ready=(async()=>{
  store=await BrowserStore.open();
  try{const r=await fetch(new URL('./data/news.json',import.meta.url),{cache:'no-store'});if(r.ok){const news=await r.json();if(Array.isArray(news.rows)&&Number.isFinite(news.updatedAt))store.putState('news',news);}}catch{}
  try{const r=await fetch(new URL('./data/snapshot.json',import.meta.url),{cache:'no-store'});if(r.ok)await store.importPublic(await r.json());}catch{}
  try{const r=await fetch(new URL('./data/history.json',import.meta.url),{cache:'no-store'});if(r.ok){const data=await r.json();for(const s of (data.signals||[]).slice(0,2000)){if(!validSignal(s)||store.signalsMap.has(s.id))continue;const {result,...signal}=s;store.addSignal(signal);if(result)store.putResult(s.id,result);}for(const l of (data.listings||[]).slice(0,1000))if(typeof l.id==='string'&&Number.isFinite(l.announcedAt)&&/^https:\/\//.test(l.sourceUrl))store.listing(l);}}catch{}
  engine=new ScannerEngine(store,{mode:'live'});
  engine.on('event',({event,data})=>postMessage({type:'event',event,data:event==='snapshot'?view():data}));
  setTimeout(()=>engine.start(),250);
})();
function validSignal(s){return s&&typeof s.id==='string'&&SOURCES.includes(s.market?.source)&&['CRYPTO','STOCK','COMMODITY'].includes(s.market.assetClass)&&['MOVES','LEVELS','SLOPE'].includes(s.strategy)&&TF[s.timeframe]&&Number.isFinite(s.createdAt)&&s.createdAt<=Date.now()+1000&&Array.isArray(s.snapshot)&&s.snapshot.length<=1000;}
function view(){return {...engine.view(),host:'github-pages',storageWarning:store.warning};}
self.onmessage=async({data:request})=>{
  try{await ready;const url=new URL(request.path,'https://marketpulse.invalid'),body=request.body;let data;
    switch(url.pathname){
      case '/api/health':data={ok:true,app:'MarketPulse Personal',mode:'live',phase:engine.status.phase,dataReady:Boolean(engine.snapshot.catalog?.length||engine.snapshot.rows.length)};break;
      case '/api/markets':data=view();break;
      case '/api/settings':data=body===undefined?{settings:store.settings(),sources:['auto',...SOURCES],mode:'live'}:engine.configure(body);break;
      case '/api/scan':engine.scan();data={scheduled:true};break;
      case '/api/signals':{
        const limit=Math.min(100,Math.max(1,Number(url.searchParams.get('limit')||30))),cursor=url.searchParams.get('cursor');let before=Number.MAX_SAFE_INTEGER,beforeId='~';
        if(cursor){const c=JSON.parse(atob(cursor.replace(/-/g,'+').replace(/_/g,'/')));before=c.time;beforeId=c.id;if(!Number.isFinite(before)||typeof beforeId!=='string')throw new Error('Nederīga vēstures lapa');}
        const rows=store.signals({limit:limit+1,before,beforeId,strategy:url.searchParams.get('strategy')||'ALL',assetClass:url.searchParams.get('assetClass')||'ALL',query:url.searchParams.get('q')||''}),more=rows.length>limit;rows.splice(limit);const last=rows.at(-1);
        data={rows,nextCursor:more&&last?btoa(JSON.stringify({time:last.createdAt,id:last.id})).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''):null};break;
      }
      case '/api/results':data={rows:store.results(300)};break;
      case '/api/listings':data={rows:engine.listingView(),sources:engine.status.announcementSources};break;
      case '/api/news':{
        data=store.getState('news');
        if(Date.now()-(store.newsCheckedAt||0)>60000){store.newsCheckedAt=Date.now();try{const r=await fetch(new URL('./data/news.json',import.meta.url),{cache:'no-store',signal:AbortSignal.timeout(8000)});if(r.ok){const next=await r.json();if(Array.isArray(next.rows)&&Number.isFinite(next.updatedAt)&&(!data||next.updatedAt>=data.updatedAt)){store.putState('news',next);data=next;}}}catch{}}
        if(!data)data=await cachedNews(store);break;
      }
      case '/api/database':data={rows:store.database(engine.snapshot.selectedIds),updatedAt:Date.now()};break;
      case '/api/market':data=await engine.marketDetail(url.searchParams.get('id'));if(!data)throw new Error('Instruments vairs nav pieejams');break;
      case '/api/export':data={exportedAt:new Date().toISOString(),mode:'live',host:'github-pages',signals:store.signals({limit:2000}),results:store.results(2000),listings:store.listings(1000)};break;
      default:throw new Error('Nezināma darbība');
    }
    postMessage({type:'response',id:request.id,data});
  }catch(e){postMessage({type:'response',id:request.id,error:e.message});}
};
