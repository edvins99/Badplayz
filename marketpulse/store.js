import {TF,PERIOD} from './analytics.js';
import {SOURCES} from './adapters.js';
export const DEFAULT_SETTINGS={source:'auto',timeframe:'15m',period:'15m',maxMarkets:300,minVolume24h:100000,minTradfiVolume24h:0,refreshSeconds:60,sound:false,saved:[],assetClass:'ALL'};
export function validateSettings(input,current=DEFAULT_SETTINGS){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Nederīgi iestatījumi');
  for(const key of Object.keys(input))if(!(key in DEFAULT_SETTINGS))throw new Error('Nezināms iestatījums');
  const s={...current,...input};if(!['auto',...SOURCES].includes(s.source)||!TF[s.timeframe]||!PERIOD[s.period]||s.period==='1d')throw new Error('Nederīgs avots vai intervāls');
  for(const [key,min,max]of [['maxMarkets',5,1000],['minVolume24h',0,1e12],['minTradfiVolume24h',0,1e12],['refreshSeconds',30,600]])if(!Number.isFinite(s[key])||s[key]<min||s[key]>max)throw new Error('Nederīgs '+key);
  if(!Number.isInteger(s.maxMarkets)||!Number.isInteger(s.refreshSeconds)||typeof s.sound!=='boolean'||!['ALL','CRYPTO','STOCK','COMMODITY'].includes(s.assetClass)||!Array.isArray(s.saved)||s.saved.length>200||s.saved.some(x=>typeof x!=='string'||x.length>100))throw new Error('Nederīgi filtri');return s;
}
export class BrowserStore{
  constructor(){for(const name of ['kv','markets','candles','signals','listings','universe'])this[name+'Map']=new Map();this.warning=null;this.candleCount=0;}
  static async open(){
    const store=new BrowserStore();
    try{
      store.db=await new Promise((resolve,reject)=>{const req=indexedDB.open('marketpulse-personal-v1',1);req.onupgradeneeded=()=>{for(const name of ['kv','markets','candles','signals','listings','universe'])req.result.createObjectStore(name);};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
      for(const name of ['kv','markets','signals','listings','universe']){const tx=store.db.transaction(name),os=tx.objectStore(name);const [keys,values]=await Promise.all([request(os.getAllKeys()),request(os.getAll())]);store[name+'Map']=new Map(keys.map((k,i)=>[k,values[i]]));}
      const pairs=store.kvMap.get('candle-counts')||{};store.candleCount=Object.values(pairs).reduce((a,b)=>a+b,0);store.candleCounts=pairs;
    }catch(e){store.warning='Pārlūka krātuve nav pieejama; šīs sesijas vēsture netiks saglabāta.';}
    return store;
  }
  write(name,key,value){if(!this.db)return;try{const tx=this.db.transaction(name,'readwrite');tx.objectStore(name).put(value,key);tx.onerror=()=>{this.warning='Pārlūka krātuve ir pilna vai nepieejama. Eksportē vēsturi.';};}catch{this.warning='Neizdevās saglabāt pārlūka vēsturi.';}}
  settings(){return {...DEFAULT_SETTINGS,...this.kvMap.get('settings')};}
  saveSettings(input){const s=validateSettings(input,this.settings());this.kvMap.set('settings',s);this.write('kv','settings',s);return s;}
  putState(key,value){this.kvMap.set(key,value);if(key!=='snapshot'||Date.now()-(this.savedSnapshotAt||0)>15000){this.savedSnapshotAt=Date.now();this.write('kv',key,value);}}
  getState(key){return this.kvMap.get(key)||null;}
  putMarket(m){this.marketsMap.set(m.id,m);this.write('markets',m.id,m);}
  market(id){return this.marketsMap.get(id)||null;}
  async prepareCandles(id,tf){const key=id+'|'+tf;if(this.candlesMap.has(key))return;if(this.db){try{const value=await request(this.db.transaction('candles').objectStore('candles').get(key));if(value)this.candlesMap.set(key,value);}catch{}}}
  putCandles(id,tf,bars){const key=id+'|'+tf,old=this.candlesMap.get(key)||[],all=[...new Map([...old,...bars].map(b=>[b.ts,b])).values()].sort((a,b)=>a.ts-b.ts).slice(-5000);this.candlesMap.set(key,all);this.candleCounts??={};this.candleCount+=all.length-(this.candleCounts[key]||0);this.candleCounts[key]=all.length;this.write('candles',key,all);this.write('kv','candle-counts',this.candleCounts);}
  candles(id,tf,limit=5000){return (this.candlesMap.get(id+'|'+tf)||[]).slice(-limit);}
  addSignal(s,cooldown=0){if(this.signalsMap.has(s.id))return false;const previous=[...this.signalsMap.values()].filter(x=>x.marketId===s.marketId&&x.strategy===s.strategy&&x.timeframe===s.timeframe).sort((a,b)=>b.barTime-a.barTime)[0];if(previous&&s.barTime-previous.barTime<cooldown)return false;this.signalsMap.set(s.id,s);this.write('signals',s.id,s);return true;}
  signals({limit=50,before=Number.MAX_SAFE_INTEGER,beforeId='~',strategy='ALL',assetClass='ALL',query=''}={}){return [...this.signalsMap.values()].filter(s=>(s.createdAt<before||(s.createdAt===before&&s.id<beforeId))&&(strategy==='ALL'||s.strategy===strategy)&&(assetClass==='ALL'||s.market.assetClass===assetClass)&&s.market.base.toUpperCase().includes(query.toUpperCase())).sort((a,b)=>b.createdAt-a.createdAt||b.id.localeCompare(a.id)).slice(0,limit);}
  pending(){return this.signals({limit:2000}).filter(s=>!s.result||!s.result.finalized).slice(0,500);}
  putResult(id,result){const s=this.signalsMap.get(id);if(s){const next={...s,result};this.signalsMap.set(id,next);this.write('signals',id,next);}}
  results(limit=100){return this.signals({limit:2000}).filter(s=>s.result).slice(0,limit).map(s=>{const {result,...signal}=s;return{signal,...result};});}
  listing(item){const previous=this.listingsMap.get(item.id);const value={...previous,...item};if(previous?.referencePrice!=null)for(const k of ['referencePrice','referenceAt','referenceKind'])value[k]=previous[k];if(previous?.status==='TRADING'&&item.status==='ANNOUNCED')value.status='TRADING';this.listingsMap.set(value.id,value);this.write('listings',value.id,value);return !previous;}
  listings(limit=100){return [...this.listingsMap.values()].sort((a,b)=>b.announcedAt-a.announcedAt).slice(0,limit);}
  rememberUniverse(source,symbols){const previous=this.universeMap.get(source);this.universeMap.set(source,symbols);this.write('universe',source,symbols);return previous;}
  stats(){return {signals:this.signalsMap.size,candles:this.candleCount,listings:this.listingsMap.size};}
  async importPublic(data){
    if(!data||data.mode!=='live'||!Array.isArray(data.rows))return;
    for(const m of data.catalog||data.rows)if(m.id&&SOURCES.includes(m.source)&&['CRYPTO','STOCK','COMMODITY'].includes(m.assetClass))this.putMarket(m);
    if(!this.getState('snapshot')||data.asOf>this.getState('snapshot').asOf){this.putState('snapshot',data);for(const m of data.rows)if(m.bars?.length){await this.prepareCandles(m.id,data.settings.timeframe);this.putCandles(m.id,data.settings.timeframe,m.bars);}}
  }
}
function request(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
