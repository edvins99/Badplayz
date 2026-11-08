import {createHash} from 'node:crypto';
import {TF,closedBars,change} from './analytics.mjs';
export const SOURCES=['binance-spot','binance-perp','bybit-spot','bybit-perp','okx-spot','okx-perp'];
const STABLE=new Set(['USDT','USDC','FDUSD','TUSD','USDP','DAI','USDE','USD1','USDD','EUR','EURI','AEUR','WBTC','WBETH','WETH']);
const STOCK=new Set(['AAPL','TSLA','NVDA','MSFT','AMZN','GOOGL','GOOG','META','COIN','MSTR','HOOD','SPY','QQQ','AAPLX','TSLAX','NVDAX','MSFTX','AMZNX','GOOGLX','METAX','COINX','MSTRX','SPYX','QQQX','CRCL','PLTR','AMD','INTC','NFLX']);
const COMMODITY=new Set(['XAU','XAG','XAUT','PAXG','GOLD','SILVER','WTI','BRENT','XTI','XBR','USOIL','UKOIL','CL','BZ','NG','XCU','XPT','XPD']);
export function classify(base,info={},exchange=''){
  // Prefer the exchange's instrument identity over ticker guesses. Unknown categories
  // are excluded rather than silently classifying forex/bonds as cryptocurrency.
  if(exchange==='okx'&&info.instCategory){return {'1':COMMODITY.has(base)?'COMMODITY':'CRYPTO','3':'STOCK','4':'COMMODITY'}[info.instCategory]||null;}
  const kind=String(info.symbolType||'').toLowerCase();
  if(['stock','etf','xstocks','stock_token'].includes(kind))return 'STOCK';
  if(['commodity','metal','oil'].includes(kind))return 'COMMODITY';
  if(['forex','bond','bonds'].includes(kind))return null;
  return COMMODITY.has(base)?'COMMODITY':STOCK.has(base)?'STOCK':'CRYPTO';
}
export function validBase(base){return /^[A-Z0-9._]{1,30}$/.test(base)&&!STABLE.has(base)&&!/^(BTC|ETH|BNB|XRP|ADA|LTC)(UP|DOWN)$/.test(base);}
export const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export class HttpClient{
  constructor({fetchImpl=globalThis.fetch.bind(globalThis),delay=250,wait=sleep}={}){this.fetchImpl=fetchImpl;this.delay=delay;this.wait=wait;this.queues=new Map();this.last=new Map();this.cache=new Map();}
  async json(url,ttl=0){
    const u=new URL(url),allowed=['data-api.binance.vision','fapi.binance.com','api.bybit.com','www.okx.com','www.binance.com'];
    if(u.protocol!=='https:'||!allowed.includes(u.hostname))throw new Error('Unsupported upstream host');
    const hit=this.cache.get(url);if(hit&&hit.expires>Date.now())return hit.data;
    const previous=this.queues.get(u.hostname)||Promise.resolve();
    const task=previous.catch(()=>{}).then(async()=>{
      const pause=this.delay-(Date.now()-(this.last.get(u.hostname)||0));if(pause>0)await this.wait(pause);
      for(let attempt=0;attempt<3;attempt++){
        this.last.set(u.hostname,Date.now());
        try{
          const r=await this.fetchImpl(url,{headers:{Accept:'application/json','User-Agent':'MarketPulse-Personal/1.0'},signal:AbortSignal.timeout(8000)});
          if(!r.ok){const e=new Error(u.hostname+' · HTTP '+r.status);e.retry=r.status===429||r.status>=500;throw e;}
          const data=await r.json();if(ttl)this.cache.set(url,{data,expires:Date.now()+ttl});
          if(this.cache.size>500)this.cache.delete(this.cache.keys().next().value);
          return data;
        }catch(e){if(attempt===2||e.retry===false||/HTTP 4(?!29)/.test(e.message))throw e;await this.wait(500*2**attempt);}
      }
    });this.queues.set(u.hostname,task);return task;
  }
}
function market(source,symbol,base,type,price,volume,change24h,extra={}){
  if(!validBase(base)||!Number.isFinite(price)||price<=0||!Number.isFinite(volume)||volume<0)return null;
  const exchange=source.split('-')[0],marketType=type==='perp'?'PERP':'SPOT';
  const tradeUrl=exchange==='binance'?(type==='perp'?'https://www.binance.com/en/futures/'+symbol:'https://www.binance.com/en/trade/'+base+'_USDT'):
    exchange==='bybit'?(type==='perp'?'https://www.bybit.com/trade/usdt/'+symbol:'https://www.bybit.com/en/trade/spot/'+base+'/USDT'):
    'https://www.okx.com/trade-'+(type==='perp'?'swap':'spot')+'/'+symbol.toLowerCase();
  return {id:source+':'+symbol,source,exchange,marketType,symbol,base,quote:'USDT',assetClass:classify(base),price,volume24h:volume,change24h,priceAsOf:Date.now(),tradeUrl,mode:'live',contractUnits:null,...extra};
}
export class ExchangeAdapter{
  constructor(source,http=new HttpClient()){if(!SOURCES.includes(source))throw new Error('Unknown source');this.source=source;this.http=http;[this.exchange,this.type]=source.split('-');}
  async markets(){
    if(this.exchange==='binance'){
      const base=this.type==='spot'?'https://data-api.binance.vision/api/v3/':'https://fapi.binance.com/fapi/v1/';
      const [tickers,info]=await Promise.all([this.http.json(base+'ticker/24hr',30000),this.http.json(base+'exchangeInfo',3600000)]);
      const active=new Map((info.symbols||[]).filter(s=>s.status==='TRADING'&&s.quoteAsset==='USDT'&&(this.type==='spot'||s.contractType==='PERPETUAL')).map(s=>[s.symbol,s]));
      return tickers.filter(t=>active.has(t.symbol)).map(t=>market(this.source,t.symbol,active.get(t.symbol).baseAsset,this.type,+t.lastPrice,+t.quoteVolume,+t.priceChangePercent,{priceAsOf:+t.closeTime||Date.now()})).filter(Boolean);
    }
    if(this.exchange==='bybit'){
      const category=this.type==='spot'?'spot':'linear';
      const data=await this.http.json('https://api.bybit.com/v5/market/tickers?category='+category,30000);
      if(data.retCode!==0)throw new Error('Bybit: '+data.retMsg);
      const items=[];let cursor='';
      for(let page=0;page<10;page++){
        const i=await this.http.json('https://api.bybit.com/v5/market/instruments-info?category='+category+'&limit=1000'+(cursor?'&cursor='+encodeURIComponent(cursor):''),3600000);
        if(i.retCode!==0)throw new Error('Bybit instruments: '+i.retMsg);items.push(...i.result.list);cursor=i.result.nextPageCursor;if(!cursor)break;
      }
      const active=new Map(items.filter(i=>i.status==='Trading'&&i.quoteCoin==='USDT'&&(this.type==='spot'||i.contractType==='LinearPerpetual')).map(i=>[i.symbol,i]));
      return data.result.list.filter(t=>active.has(t.symbol)).map(t=>{
        const info=active.get(t.symbol),assetClass=classify(info.baseCoin,info,'bybit');if(!assetClass)return null;
        return market(this.source,t.symbol,info.baseCoin,this.type,+t.lastPrice,+t.turnover24h,+t.price24hPcnt*100,{assetClass,displayName:info.fullName||info.baseCoin,instrumentKind:info.symbolType||'crypto',underlyingTicker:info.underlyingTicker||null});
      }).filter(Boolean);
    }

    const instType=this.type==='spot'?'SPOT':'SWAP';
    const [data,info]=await Promise.all([this.http.json('https://www.okx.com/api/v5/market/tickers?instType='+instType,30000),this.http.json('https://www.okx.com/api/v5/public/instruments?instType='+instType,3600000)]);
    if(data.code!=='0'||info.code!=='0')throw new Error('OKX: '+(data.msg||info.msg));
    const active=new Map(info.data.filter(i=>i.state==='live'&&(this.type==='spot'?i.quoteCcy==='USDT':i.settleCcy==='USDT'&&i.instId.endsWith('-USDT-SWAP'))).map(i=>[i.instId,i]));
    return data.data.filter(t=>active.has(t.instId)).map(t=>{const base=t.instId.split('-')[0],info=active.get(t.instId),assetClass=classify(base,info,'okx');if(!assetClass)return null;const volume=this.type==='spot'?+t.volCcy24h:+t.volCcy24h*+t.last;return market(this.source,t.instId,base,this.type,+t.last,volume,+t.open24h>0?change(+t.open24h,+t.last):0,{assetClass,instrumentKind:info.instCategory==='3'?'stock':info.instCategory==='4'?'commodity':'crypto',priceAsOf:+t.ts||Date.now(),volumeApproximate:this.type==='perp'});}).filter(Boolean);
  }
  async candles(m,tf,count=750,{endTime}={}){
    if(!TF[tf]&&tf!=='1m')throw new Error('Unsupported interval');
    const target=Math.min(5000,count),records=[];let end=endTime;
    for(let page=0;page<Math.ceil(target/300)+2&&records.length<target;page++){
      const limit=Math.min(this.exchange==='okx'?300:1000,target-records.length);let batch=[];
      if(this.exchange==='binance'){
        const prefix=this.type==='spot'?'https://data-api.binance.vision/api/v3/':'https://fapi.binance.com/fapi/v1/';
        const data=await this.http.json(prefix+'klines?symbol='+encodeURIComponent(m.symbol)+'&interval='+tf+'&limit='+limit+(end?'&endTime='+end:''),end?3600000:15000);
        if(!Array.isArray(data))throw new Error('Invalid Binance candles');batch=data.map(k=>({ts:+k[0],o:+k[1],h:+k[2],l:+k[3],c:+k[4],v:+k[5],q:+k[7]}));
      }else if(this.exchange==='bybit'){
        const intervals={'1m':'1','5m':'5','15m':'15','1h':'60','4h':'240','1d':'D'};
        const data=await this.http.json('https://api.bybit.com/v5/market/kline?category='+(this.type==='spot'?'spot':'linear')+'&symbol='+encodeURIComponent(m.symbol)+'&interval='+intervals[tf]+'&limit='+limit+(end?'&end='+end:''),end?3600000:15000);
        if(data.retCode!==0)throw new Error('Bybit candles: '+data.retMsg);batch=data.result.list.map(k=>({ts:+k[0],o:+k[1],h:+k[2],l:+k[3],c:+k[4],v:+k[5],q:+k[6]}));
      }else{
        const bar={'1m':'1m','5m':'5m','15m':'15m','1h':'1H','4h':'4H','1d':'1Dutc'}[tf];
        const data=await this.http.json('https://www.okx.com/api/v5/market/history-candles?instId='+encodeURIComponent(m.symbol)+'&bar='+bar+'&limit='+limit+(end?'&after='+(end+1):''),end?3600000:15000);
        if(data.code!=='0')throw new Error('OKX candles: '+data.msg);batch=data.data.map(k=>({ts:+k[0],o:+k[1],h:+k[2],l:+k[3],c:+k[4],v:+k[this.type==='spot'?5:6],q:+k[7]}));
      }
      batch.sort((a,b)=>a.ts-b.ts);if(!batch.length)break;records.push(...batch);const next=batch[0].ts-1;if(end&&next>=end)break;end=next;if(batch.length<limit)break;
    }
    return [...new Map(records.map(b=>[b.ts,b])).values()].sort((a,b)=>a.ts-b.ts).slice(-target);
  }
}
export function listingTokens(title){
  const found=new Set();for(const m of title.matchAll(/\(([A-Z][A-Z0-9]{1,14})\)|\$([A-Z][A-Z0-9]{1,14})\b|\b([A-Z][A-Z0-9]{1,14})USDT\b/g))found.add(m[1]||m[2]||m[3]);
  for(const word of ['USDT','USDC','USD','UTC','ETF','APR','VIP','SPOT','US','AI'])found.delete(word);return [...found];
}
export function parseAnnouncement(item,exchange){
  const title=String(item.title||'');if(!/list(?:ing|s|ed)?\b|delist|launchpool|alpha/i.test(title))return null;
  const url=item.url||(item.code?'https://www.binance.com/en/support/announcement/'+item.code:null);
  if(!url||!/^https:\/\//.test(url))return null;
  const announcedAt=Number(item.publishTime||item.releaseDate||item.dateTimestamp||item.pTime);if(!Number.isFinite(announcedAt)||announcedAt<1e12)return null;
  const marketType=/alpha/i.test(title)?'ALPHA':/perpetual|futures|USDT.*contract/i.test(title)?'PERP':'SPOT';
  return {id:createHash('sha256').update(exchange+':'+url).digest('hex').slice(0,28),title,tokens:listingTokens(title),exchange,marketType,announcedAt,tradingStartAt:null,status:/delist/i.test(title)?'DELISTING_ANNOUNCED':'ANNOUNCED',sourceUrl:url,referencePrice:null,mode:'live',discovery:'announcement'};
}
export async function announcements(http){
  const lists=[],health=[];
  await Promise.all([
    (async()=>{try{const d=await http.json('https://api.bybit.com/v5/announcements/index?locale=en-US&limit=50',60000);if(d.retCode!==0)throw new Error(d.retMsg);lists.push(...d.result.list.map(i=>parseAnnouncement(i,'bybit')).filter(Boolean));health.push({source:'Bybit announcements',ok:true,updatedAt:Date.now()});}catch(e){health.push({source:'Bybit announcements',ok:false,error:e.message});}})(),
    (async()=>{try{const d=await http.json('https://www.binance.com/bapi/composite/v1/public/cms/article/list/query?type=1&pageNo=1&pageSize=30&catalogId=48',60000);const items=d.data?.catalogs?.flatMap(c=>c.articles||[])||d.data?.articles;if(!items)throw new Error('Binance announcement format unavailable');lists.push(...items.map(i=>parseAnnouncement(i,'binance')).filter(Boolean));health.push({source:'Binance announcements',ok:true,updatedAt:Date.now()});}catch(e){health.push({source:'Binance announcements',ok:false,error:e.message});}})()
  ]);return {listings:lists,health};
}
