export const FILTER_DEFAULTS={assetClass:'ALL',exchange:'ALL',marketType:'ALL',strategy:'ALL',signalTf:'ALL',minVolume:0,minRvol:0,minMove:0,direction:'all',onlySaved:false};
export function validateFilters(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!(k in FILTER_DEFAULTS)))throw new Error('Nederīgi atlases lauki');
  const f={...FILTER_DEFAULTS,...input};
  for(const [key,values]of Object.entries({assetClass:['ALL','CRYPTO','STOCK','COMMODITY'],exchange:['ALL','binance','bybit','okx','mock'],marketType:['ALL','SPOT','PERP'],strategy:['ALL','MOVES','LEVELS','SLOPE'],signalTf:['ALL','5m','15m','1h','4h','1d'],direction:['all','up','down']}))if(!values.includes(f[key]))throw new Error('Nederīgs atlases lauks: '+key);
  for(const [k,max]of [['minVolume',1e12],['minRvol',1e6],['minMove',1e6]])if(!Number.isFinite(f[k])||f[k]<0||f[k]>max)throw new Error('Nederīgs atlases slieksnis');
  if(typeof f.onlySaved!=='boolean')throw new Error('Nederīga izlases atlase');return f;
}
export function workspaceSettings(s){
  const viewFilters=validateFilters(s.viewFilters),profiles=s.filterProfiles??[];
  if(!Array.isArray(profiles)||profiles.length>12)throw new Error('Var saglabāt līdz 12 atlasēm');
  const ids=new Set(),filterProfiles=profiles.map(p=>{if(!p||typeof p.id!=='string'||!/^[\w-]{1,64}$/.test(p.id)||ids.has(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>40)throw new Error('Nederīgs atlases nosaukums vai ID');ids.add(p.id);return{id:p.id,name:p.name.trim(),filters:validateFilters(p.filters)};});
  const activeProfileId=s.activeProfileId??null;if(activeProfileId!==null&&!ids.has(activeProfileId))throw new Error('Saglabātā atlase nav atrasta');return{viewFilters,filterProfiles,activeProfileId};
}
export function filtersFromParams(params){const f={};for(const [k,v]of Object.entries(FILTER_DEFAULTS))if(params.has(k)&&!(k==='strategy'&&params.get(k)==='NONE'))f[k]=typeof v==='number'?Number(params.get(k)):typeof v==='boolean'?params.get(k)==='true':params.get(k);return validateFilters(f);}
export function marketMatches(m,f,saved=[],{rvol=null,move=0,direction}={}){return(f.assetClass==='ALL'||f.assetClass===m.assetClass)&&(f.exchange==='ALL'||f.exchange===m.exchange)&&(f.marketType==='ALL'||f.marketType===m.marketType)&&(m.volume24h??0)>=f.minVolume&&(!f.onlySaved||saved.includes(m.id))&&(f.minRvol===0||(rvol??-1)>=f.minRvol)&&(f.minMove===0||(Number.isFinite(move)&&Math.abs(move)>=f.minMove))&&(f.direction==='all'||f.direction===(direction||(move>0?'up':move<0?'down':'flat')));}
export function signalMatches(s,f,saved=[]){const b=s.snapshot?.at(-1),move=s.movePct??(b?(b.c/b.o-1)*100:0);return(f.strategy==='ALL'||s.strategy===f.strategy)&&(f.signalTf==='ALL'||s.timeframe===f.signalTf)&&marketMatches(s.market,f,saved,{move,rvol:s.activity?.rvol,direction:['UP','LONG'].includes(s.direction)?'up':'down'});}
export function relatedVenues(m,all){return [...new Map(all.filter(v=>v.assetClass===m.assetClass&&v.quote===m.quote&&(v.base===m.base||(m.underlyingTicker&&v.underlyingTicker===m.underlyingTicker))).map(v=>[v.id,v])).values()].sort((a,b)=>b.volume24h-a.volume24h).slice(0,30);}
const avg=a=>a.length?a.reduce((n,v)=>n+v,0)/a.length:null;
const median=a=>{if(!a.length)return null;const s=[...a].sort((a,b)=>a-b),i=Math.floor(s.length/2);return s.length%2?s[i]:(s[i-1]+s[i])/2;};
export function resultGroups(rows,{days=7,now=Date.now(),assetClass='ALL',strategy='ALL',query=''}={}){
  const filtered=rows.filter(r=>r.signal.createdAt>=now-days*86400000&&r.signal.createdAt<=now&&(assetClass==='ALL'||r.signal.market.assetClass===assetClass)&&(strategy==='ALL'||r.signal.strategy===strategy)&&r.signal.market.base.toUpperCase().includes(query.toUpperCase()));
  const groups=new Map();
  for(const r of filtered){const key=r.signal.strategy+'|'+r.signal.market.assetClass;if(!groups.has(key))groups.set(key,{strategy:r.signal.strategy,assetClass:r.signal.market.assetClass,rows:[]});groups.get(key).rows.push(r);}
  return{rows:filtered,groups:[...groups.values()].map(g=>{const complete=g.rows.filter(r=>r.finalized&&r.coverage>=1&&r.windowEnd<=now),returns=complete.map(r=>r.endReturnPct).filter(Number.isFinite),mfes=complete.map(r=>r.mfePct).filter(Number.isFinite);return{strategy:g.strategy,assetClass:g.assetClass,total:g.rows.length,complete:complete.length,pending:g.rows.length-complete.length,meanEnd:avg(returns),medianMfe:median(mfes),tpFirst:complete.filter(r=>r.hitOrder==='TP_FIRST').length,slFirst:complete.filter(r=>r.hitOrder==='SL_FIRST').length,ambiguous:complete.filter(r=>r.hitOrder==='SAME_BAR_UNKNOWN').length,positive:returns.filter(v=>v>0).length,negative:returns.filter(v=>v<0).length,flat:returns.filter(v=>v===0).length};}).sort((a,b)=>b.total-a.total)};
}
