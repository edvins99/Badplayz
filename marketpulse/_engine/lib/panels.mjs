export const SCANNERS=[
  {id:'MOVES',title:'Kustības',view:'MOVES',strategy:'MOVES',assetClass:'ALL',color:'green'},
  {id:'LEVELS',title:'Līmeņi',view:'LEVELS',strategy:'LEVELS',assetClass:'ALL',color:'orange'},
  {id:'SLOPE',title:'Trendlīnijas',view:'SLOPE',strategy:'SLOPE',assetClass:'ALL',color:'purple'},
  {id:'COMMODITIES',title:'Izejvielas',view:'commodities',strategy:'ALL',assetClass:'COMMODITY',color:'orange'},
  {id:'TOP10',title:'Top 10 kripto',view:'top10',assetClass:'CRYPTO',color:'green'},
  {id:'STOCKS',title:'Akcijas',view:'stocks',strategy:'ALL',assetClass:'STOCK',color:'purple'}
];
export const SCANNER_IDS=SCANNERS.map(s=>s.id);
const excluded=new Set(['USDT','USDC','USDE','USD1','DAI','TUSD','FDUSD','USDD','USDP','PYUSD','BUSD','EUR','EURC','EURI','EURT','XAUT','PAXG','WBTC','WETH','WSTETH','STETH','USDS','SUSDE','RLUSD','USDG','USDF','USDY','USDX','FRAX','LUSD']);
export function rankTopCoins(markets,limit=10){
  const coins=new Map();
  for(const m of markets){
    const key=m.base?.toUpperCase();
    if(m.assetClass!=='CRYPTO'||!key||excluded.has(key)||!Number.isFinite(m.price)||m.price<=0||!Number.isFinite(m.volume24h)||m.volume24h<=0)continue;
    const old=coins.get(key);
    if(!old||m.volume24h>old.volume24h||(m.volume24h===old.volume24h&&m.id.localeCompare(old.id)<0))coins.set(key,m);
  }
  return [...coins.values()].sort((a,b)=>b.volume24h-a.volume24h||a.base.localeCompare(b.base)).slice(0,Math.max(0,Math.min(10,limit)));
}
export function databaseRows(markets,candleMeta=[],selectedIds=[]){
  const selected=new Set(selectedIds),byMarket=new Map();
  for(const c of candleMeta){if(!byMarket.has(c.market))byMarket.set(c.market,[]);byMarket.get(c.market).push({tf:c.tf,count:Number(c.count),firstTs:c.firstTs??null,lastTs:c.lastTs??null});}
  return markets.map(m=>{const history=(byMarket.get(m.id)||[]).sort((a,b)=>a.tf.localeCompare(b.tf)),times=history.map(c=>c.lastTs).filter(Number.isFinite);return {...m,history,candleCount:history.reduce((n,c)=>n+c.count,0),lastCandleAt:times.length?Math.max(...times):null,selected:selected.has(m.id)};});
}
