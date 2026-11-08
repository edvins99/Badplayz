export const NEWS_SOURCES=[
  {id:'coindesk',name:'CoinDesk',assetClass:'CRYPTO',url:'https://www.coindesk.com/arc/outboundfeeds/rss/',host:'coindesk.com'},
  {id:'yahoo',name:'Yahoo Finance · AAPL/MSFT/NVDA/SPY',assetClass:'STOCK',url:'https://feeds.finance.yahoo.com/rss/2.0/headline?s=AAPL,MSFT,NVDA,SPY&region=US&lang=en-US',host:'yahoo.com'},
  {id:'eia',name:'U.S. EIA',assetClass:'COMMODITY',url:'https://www.eia.gov/rss/todayinenergy.xml',host:'eia.gov'},
  {id:'fed',name:'Federal Reserve',assetClass:'ALL',url:'https://www.federalreserve.gov/feeds/press_all.xml',host:'federalreserve.gov'}
];
function decode(s){return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]*>/g,' ').replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(all,key)=>{if(key[0]==='#'){const n=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1));return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';}return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '}[key.toLowerCase()]||all;}).replace(/\s+/g,' ').trim();}
export function safeNewsUrl(value,host){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(u.hostname===host||u.hostname.endsWith('.'+host))?u.href:null;}catch{return null;}}
export function parseRss(xml,source,now=Date.now()){
  if(typeof xml!=='string'||xml.length>2e6)throw new Error('Nederīga ziņu plūsma');
  const rows=[];
  for(const match of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)){
    const block=match[1],field=name=>decode(block.match(new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+name+'>','i'))?.[1]||'');
    const title=field('title').slice(0,350),url=safeNewsUrl(field('link'),source.host),publishedAt=Date.parse(field('pubDate')||field('dc:date'));
    if(!title||!url||!Number.isFinite(publishedAt)||publishedAt>now+300000)continue;
    rows.push({id:url,title,url,publishedAt,publisher:source.name,source:source.id,assetClass:source.assetClass});
  }
  return [...new Map(rows.map(r=>[r.url,r])).values()].sort((a,b)=>b.publishedAt-a.publishedAt).slice(0,40);
}
export async function fetchNews({fetchImpl=globalThis.fetch.bind(globalThis),now=Date.now()}={}){
  const sources=[],rows=[];
  await Promise.all(NEWS_SOURCES.map(async source=>{
    try{const response=await fetchImpl(source.url,{signal:AbortSignal.timeout(10000),headers:{Accept:'application/rss+xml, application/xml, text/xml'}});if(!response.ok)throw new Error('HTTP '+response.status);const items=parseRss(await response.text(),source,now);if(!items.length)throw new Error('Nav derīgu virsrakstu');rows.push(...items);sources.push({source:source.name,ok:true,count:items.length});}
    catch(e){sources.push({source:source.name,ok:false,error:e.message});}
  }));
  return {rows:[...new Map(rows.map(r=>[r.url,r])).values()].sort((a,b)=>b.publishedAt-a.publishedAt).slice(0,120),sources,updatedAt:now};
}
export function cachedNews(store,{fetchImpl,now=Date.now()}={}){
  const cached=store.getState('news');
  if(cached&&now-cached.updatedAt<600000)return Promise.resolve(cached);
  if(store.newsPending)return store.newsPending;
  store.newsPending=fetchNews({fetchImpl,now}).then(next=>{const rows=[...new Map([...next.rows,...(cached?.rows||[])].map(r=>[r.url,r])).values()].sort((a,b)=>b.publishedAt-a.publishedAt).slice(0,120),value={...next,rows};store.putState('news',value);return value;}).finally(()=>{store.newsPending=null;});
  return store.newsPending;
}
