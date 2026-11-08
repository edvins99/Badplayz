import {relatedVenues} from './workspace.js';
import {EventEmitter} from './emitter.js';

import {ExchangeAdapter,HttpClient,announcements,SOURCES} from './adapters.js';
import {TF,PERIOD,closedBars,detectSignals,activity,evaluateResult,profile,change} from './analytics.js';

export function catalogUniverse(all){
  const sorted=[...all].filter(m=>['CRYPTO','STOCK','COMMODITY'].includes(m.assetClass)).sort((a,b)=>b.volume24h-a.volume24h||a.id.localeCompare(b.id));
  const seen=new Set();return sorted.filter(m=>{const key=m.assetClass+':'+m.base+':'+m.marketType;if(seen.has(key))return false;seen.add(key);return true;});
}
export function selectUniverse(all,settings){
  const unique=catalogUniverse(all).filter(m=>m.volume24h>=(m.assetClass==='CRYPTO'?settings.minVolume24h:settings.minTradfiVolume24h??0)&&(settings.assetClass==='ALL'||m.assetClass===settings.assetClass));
  if(settings.assetClass!=='ALL')return unique.slice(0,settings.maxMarkets);
  const commodities=unique.filter(m=>m.assetClass==='COMMODITY').slice(0,Math.max(1,Math.floor(settings.maxMarkets*.15)));
  const stocks=unique.filter(m=>m.assetClass==='STOCK').slice(0,Math.floor(settings.maxMarkets*.4));
  const crypto=unique.filter(m=>m.assetClass==='CRYPTO').slice(0,settings.maxMarkets-commodities.length-stocks.length);
  const chosen=[...commodities,...stocks,...crypto],ids=new Set(chosen.map(m=>m.id));
  return [...chosen,...unique.filter(m=>!ids.has(m.id))].slice(0,settings.maxMarkets);
}
export class ScannerEngine extends EventEmitter{
  constructor(store,{mode='live',http=new HttpClient(),adapterFactory}={}){
    super();this.store=store;this.mode=mode;this.http=http;this.adapters=new Map();this.adapterFactory=adapterFactory||((source)=>new ExchangeAdapter(source,http));
    this.running=false;this.timer=null;this.busy=false;this.revision=0;this.again=false;
    this.snapshot=store.getState('snapshot')||{mode,rows:[],asOf:null,settings:store.settings()};
    this.status={phase:'starting',startedAt:Date.now(),lastScanAt:null,lastSuccessAt:this.snapshot.asOf,error:null,progress:0,total:0,sources:[],announcementSources:[]};
  }
  adapter(source){if(!this.adapters.has(source))this.adapters.set(source,this.adapterFactory(source));return this.adapters.get(source);}
  emitState(event='status',data=this.status){this.emit('event',{event,data});}
  configure(input){
    if(input.source==='mock'&&this.mode!=='mock')throw new Error('Mock source is only available in explicit mock mode');
    const old=this.store.settings(),s=this.store.saveSettings(input);this.emitState('settings',s);
    const rescan=['source','timeframe','period','maxMarkets','minVolume24h','minTradfiVolume24h','refreshSeconds','assetClass'].some(k=>s[k]!==old[k]);
    if(rescan){this.revision++;if(this.busy)this.again=true;else if(this.running){clearTimeout(this.timer);this.timer=setTimeout(()=>this.scan(),0);}}return s;
  }
  start(){if(this.running)return;this.running=true;this.scan();}
  stop(){this.running=false;clearTimeout(this.timer);}
  async scan(){
    if(this.busy){this.again=true;return;}this.busy=true;
    const settings=this.store.settings(),revision=this.revision,now=Date.now(),health=[],errors=[];
    this.status={...this.status,phase:'discovering',error:null,progress:0,total:0};this.emitState();
    try{
      const sources=this.mode==='mock'?['mock']:settings.source==='auto'?['binance-spot','bybit-spot','bybit-perp','okx-spot','okx-perp']:[settings.source];
      const all=[];
      await Promise.all(sources.map(async source=>{
        try{
          const list=await this.adapter(source).markets();if(!list.length)throw new Error('No active USDT instruments returned');all.push(...list);
          health.push({source,ok:true,count:list.length,updatedAt:Date.now()});
          const previous=this.store.rememberUniverse(source,list.map(m=>m.id));
          if(previous){const old=new Set(previous),current=new Set(list.map(m=>m.id));for(const m of list)if(!old.has(m.id))this.store.listing({id:'market-added:'+m.id+':'+Math.floor(now/86400000),title:m.base+' · jauns tirgus datu avotā',tokens:[m.base],exchange:m.exchange,marketType:m.marketType,announcedAt:now,status:'TRADING',sourceUrl:m.tradeUrl,discovery:'market-list-diff',mode:this.mode,referencePrice:m.price,referenceAt:now,referenceKind:'first-observed',marketId:m.id});
            // A symbol disappearing once can be a transient API issue. Do not call it a delisting.
            const missing=previous.filter(id=>!current.has(id));if(missing.length)this.emitState('universe-change',{source,missing:missing.length,classification:'unconfirmed'});
          }
        }catch(e){health.push({source,ok:false,error:e.message,updatedAt:Date.now()});}
      }));
      this.status.sources=health;
      const catalog=catalogUniverse(all);for(const m of all)this.store.putMarket(m);
      const selected=selectUniverse(catalog,settings);this.status.total=selected.length;this.status.phase='scanning';this.emitState();
      if(!selected.length)throw new Error(all.length?'Nav instrumentu ar izvēlētajiem filtriem. Samazini minimālo apjomu vai nomaini datu avotu.':'Tirgus dati nav sasniedzami. Pārbaudi interneta savienojumu vai izvēlies citu avotu.');
      const activityTf=settings.period==='5m'?'5m':settings.period==='15m'?'15m':'1h';
      const duration=PERIOD[settings.period],historyCount=Math.ceil((604800000+duration)/TF[activityTf])+2;
      const rows=[],newSignals=[],evaluated=new Set(),selectedIds=new Set(selected.map(m=>m.id));
      const previous=this.snapshot.settings?.timeframe===settings.timeframe&&this.snapshot.settings?.period===settings.period?this.snapshot.rows:[];
      const enriched=new Map(previous.filter(m=>selectedIds.has(m.id)).map(m=>[m.id,{...m,...catalog.find(c=>c.id===m.id)}]));
      const publish=complete=>{if(revision!==this.revision)return;this.snapshot={mode:this.mode,asOf:Date.now(),settings,catalog,venues:all,rows:[...enriched.values()].sort((a,b)=>(b.score??-1)-(a.score??-1)),selectedIds:[...selectedIds],selectedCount:selected.length,scanComplete:complete,errors:[...errors],sources:health,discovered:all.length};this.store.putState('snapshot',this.snapshot);this.emitState('snapshot',this.snapshot);};
      // Publish all real quotes immediately; expensive candle history fills in progressively.
      publish(false);
      const pendingByMarket=new Map();for(const signal of this.store.pending()){const key=signal.marketId+'|'+signal.timeframe;if(!pendingByMarket.has(key))pendingByMarket.set(key,[]);pendingByMarket.get(key).push(signal);}
      let publishedAt=Date.now();
      for(let i=0;i<selected.length;i+=3){
        if(revision!==this.revision)return;
        await Promise.all(selected.slice(i,i+3).map(async m=>{
          try{
            await this.store.prepareCandles(m.id,settings.timeframe);const a=this.adapter(m.source),stored=this.store.candles(m.id,settings.timeframe,5000);
            const wanted=activityTf===settings.timeframe?Math.max(170,historyCount):170;
            const missing=stored.length?Math.ceil((Date.now()-stored.at(-1).ts)/TF[settings.timeframe])+2:wanted;
            const scanRaw=await a.candles(m,settings.timeframe,stored.length>=wanted?Math.min(5000,Math.max(10,missing)):wanted);
            const complete=closedBars(scanRaw,settings.timeframe);this.store.putMarket(m);this.store.putCandles(m.id,settings.timeframe,complete);
            const bars=this.store.candles(m.id,settings.timeframe,5000),last=bars.at(-1);
            if(!last)throw new Error('No closed candles');
            let activityBars=bars;
            if(activityTf!==settings.timeframe){await this.store.prepareCandles(m.id,activityTf);const old=this.store.candles(m.id,activityTf,5000),missing=old.length?Math.ceil((Date.now()-old.at(-1).ts)/TF[activityTf])+2:historyCount,raw=await a.candles(m,activityTf,old.length>=historyCount?Math.min(5000,Math.max(10,missing)):historyCount);this.store.putCandles(m.id,activityTf,closedBars(raw,activityTf));activityBars=this.store.candles(m.id,activityTf,5000);}
            const active=activity(activityBars,activityTf,settings.period),stale=Date.now()-last.ts-TF[settings.timeframe]>TF[settings.timeframe]*2;
            const signals=stale?[]:detectSignals(bars,m,settings.timeframe);
            for(const s of signals)if((s.activity={rvol:active?.rvol??null,score:active?.score??null,period:settings.period},this.store.addSignal(s,profile(m.assetClass).cooldown*TF[settings.timeframe])))newSignals.push(s);
            for(const s of pendingByMarket.get(m.id+'|'+settings.timeframe)||[]){const result=evaluateResult(s,bars);if(result)this.store.putResult(s.id,result);evaluated.add(s.id);}
            const row={...m,move:change(last.o,last.c),activity:active,rvol:active?.rvol??null,score:active?.score??null,bars:bars.slice(-120),candleAsOf:last.ts+TF[settings.timeframe],stale,signals:signals.map(s=>s.strategy)};rows.push(row);enriched.set(m.id,row);
          }catch(e){errors.push({market:m.id,error:e.message});}
          this.status.progress++;this.emitState();
        }));
        if(i%12===0||Date.now()-publishedAt>5000){publish(false);publishedAt=Date.now();}
      }
      if(revision!==this.revision)return;
      // Continue tracking earlier signals even after the selected source or timeframe changes.
      const remaining=this.store.pending().filter(s=>!evaluated.has(s.id));const groups=new Map();
      for(const s of remaining){const key=s.marketId+'|'+s.timeframe;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(s);}
      const groupList=[...groups.values()],offset=(this.pendingOffset||0)%Math.max(groupList.length,1),rotated=[...groupList.slice(offset),...groupList.slice(0,offset)];this.pendingOffset=offset+8;
      let additional=0;for(const signals of rotated){
        if(additional++>=8)break;const first=signals[0];
        try{const windowEnd=first.createdAt+TF[first.timeframe]*(first.strategy==='MOVES'?24:48);const raw=await this.adapter(first.market.source).candles(first.market,first.timeframe,80,Date.now()>windowEnd?{endTime:windowEnd}:{});this.store.putCandles(first.marketId,first.timeframe,closedBars(raw,first.timeframe));const bars=this.store.candles(first.marketId,first.timeframe,5000);for(const s of signals){const r=evaluateResult(s,bars);if(r)this.store.putResult(s.id,r);}}catch{}
      }
      if(this.mode!=='mock'){
        const news=await announcements(this.http);this.status.announcementSources=news.health;
        for(const listing of news.listings){
          const match=listing.marketType==='ALPHA'?null:all.find(m=>m.exchange===listing.exchange&&m.marketType===listing.marketType&&listing.tokens.length===1&&m.base===listing.tokens[0]);
          if(match){listing.marketId=match.id;if(listing.status==='ANNOUNCED'&&(!listing.tradingStartAt||listing.tradingStartAt<=Date.now()))listing.status='TRADING';
            // Never invent an announcement-time fill: retain only a clearly labelled first-observed quote.
            if(now-listing.announcedAt<120000){listing.referencePrice=match.price;listing.referenceAt=now;listing.referenceKind='first-observed';}}
          this.store.listing(listing);
        }
      }else{
        this.store.listing({id:'mock-listing',title:'Demonstrācijas tokena paziņojums (TEST)',tokens:['TEST'],exchange:'mock',marketType:'SPOT',announcedAt:now,status:'ANNOUNCED',sourceUrl:'https://example.invalid/mock-announcement',mode:'mock',discovery:'fixture'});
      }
      if(!rows.length)throw new Error('Neizdevās ielādēt sveces. '+(errors[0]?.error||''));
      if(revision===this.revision){publish(true);for(const s of newSignals)this.emitState('signal',{...s,fresh:Date.now()-s.barEnd<TF[s.timeframe]*2});}
      this.status={...this.status,phase:'idle',lastScanAt:Date.now(),lastSuccessAt:Date.now(),error:errors.length?errors.length+' instrumentiem dati nav pieejami.':null};
    }catch(e){this.status={...this.status,phase:'error',lastScanAt:Date.now(),error:e.message,sources:health};}
    finally{this.busy=false;this.emitState();if(this.running){this.timer=setTimeout(()=>this.scan(),this.again?100:this.store.settings().refreshSeconds*1000);this.again=false;}}
  }
  async marketDetail(id,timeframe){
    const m=this.snapshot.catalog?.find(m=>m.id===id)||this.snapshot.rows.find(m=>m.id===id)||this.store.market(id);if(!m)return null;
    const tf=timeframe||this.store.settings().timeframe;if(!TF[tf])throw new Error('Nederīgs grafika intervāls');const key=id+'|'+tf;this.details??=new Map();
    if(this.details.has(key))return this.details.get(key);
    const work=(async()=>{
      await this.store.prepareCandles?.(id,tf);let bars=this.store.candles(id,tf,500),last=bars.at(-1);
      if(bars.length<180||!last||last.ts<Math.floor(Date.now()/TF[tf])*TF[tf]-TF[tf]){const raw=await this.adapter(m.source).candles(m,tf,300);this.store.putCandles(id,tf,closedBars(raw,tf));bars=this.store.candles(id,tf,500);last=bars.at(-1);}
      const enriched=this.snapshot.settings?.timeframe===tf?this.snapshot.rows.find(x=>x.id===id):null;
      return {...m,...enriched,activity:enriched?.activity||activity(this.store.candles(id,tf,5000),tf,tf==='1d'?'24h':tf),price:m.price,bars,timeframe:tf,move:last?change(last.o,last.c):null,candleAsOf:last?last.ts+TF[tf]:null};
    })();this.details.set(key,work);try{return await work;}finally{this.details.delete(key);}
  }
  async instrumentDetail(id,timeframe){
    const market=await this.marketDetail(id,timeframe);if(!market)return null;
    const venues=relatedVenues(market,this.snapshot.venues||this.snapshot.catalog||[]),ids=new Set([market.id,...venues.map(v=>v.id)]);
    const signals=this.store.signals({limit:2000,assetClass:market.assetClass}).filter(s=>ids.has(s.marketId)).slice(0,40);
    return{market,venues:venues.length?venues:[market],signals};
  }
  async listingDetail(id){
    const listing=this.store.listings(1000).find(l=>l.id===id);if(!listing)return null;
    if(listing.marketType==='ALPHA')return{listing,market:null,venues:[],signals:[],note:'Alpha grafikam vajadzīga pārbaudīta ķēdes un līguma identitāte. Vienādu simbolu nepiesaistām biržas tirgum.'};
    const all=this.snapshot.venues||this.snapshot.catalog||[],m=all.find(m=>m.id===listing.marketId)||all.filter(m=>listing.tokens?.length===1&&m.base===listing.tokens[0]&&m.assetClass==='CRYPTO').sort((a,b)=>b.volume24h-a.volume24h)[0];
    if(!m)return{listing,market:null,venues:[],signals:[],note:'Šim tokenam mūsu cenu avotos vēl nav droši identificēta tirgus. Oficiālais paziņojums pieejams saitē.'};
    const start=listing.announcedAt-3600000,end=Math.min(Date.now(),listing.announcedAt+86400000),count=Math.min(500,Math.max(30,Math.ceil((end-start)/300000)+2));
    const raw=await this.adapter(m.source).candles(m,'5m',count,{endTime:end}),bars=closedBars(raw,'5m').filter(b=>b.ts>=start&&b.ts<=end);
    if(listing.referencePrice==null){const reference=bars.filter(b=>b.ts+300000<=listing.announcedAt).at(-1);if(reference&&listing.announcedAt-reference.ts-300000<=900000){listing.referencePrice=reference.c;listing.referenceAt=reference.ts+300000;listing.referenceKind='pre-announcement-candle';listing.marketId=m.id;this.store.listing(listing);}}
    return{listing:{...listing,currentPrice:m.price,changeSince:listing.referencePrice?change(listing.referencePrice,m.price):null},market:{...m,bars,timeframe:'5m'},venues:relatedVenues(m,all),signals:[]};
  }
  view(){return {...this.snapshot,status:this.status,appliedSettings:this.snapshot.settings,settings:this.store.settings(),storage:this.store.stats()};}
  listingView(){return this.store.listings(150).map(l=>{const m=l.marketId?this.store.market(l.marketId):null;return {...l,currentPrice:m?.price??null,changeSince:l.referencePrice&&m?change(l.referencePrice,m.price):null};});}
}
