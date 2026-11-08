import {FILTER_DEFAULTS,workspaceSettings,signalMatches} from './workspace.mjs';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {TF,PERIOD} from './analytics.mjs';
import {SCANNER_IDS,databaseRows} from './panels.mjs';
export const DEFAULT_SETTINGS={source:'auto',timeframe:'15m',period:'15m',maxMarkets:300,minVolume24h:100000,minTradfiVolume24h:0,refreshSeconds:60,sound:false,saved:[],assetClass:'ALL',assetScope:'ALL',visibleScanners:SCANNER_IDS,viewFilters:FILTER_DEFAULTS,filterProfiles:[],activeProfileId:null};
export function validateSettings(input,current=DEFAULT_SETTINGS){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Settings must be an object');
  const allowed=new Set(Object.keys(DEFAULT_SETTINGS));for(const key of Object.keys(input))if(!allowed.has(key))throw new Error('Unknown setting: '+key);
  const s={...current,...input};
  if(!['auto','binance-spot','binance-perp','bybit-spot','bybit-perp','okx-spot','okx-perp','mock'].includes(s.source))throw new Error('Unknown data source');
  if(!TF[s.timeframe]||!PERIOD[s.period]||s.period==='1d')throw new Error('Invalid timeframe or activity period');
  for(const [key,min,max]of [['maxMarkets',5,1000],['minVolume24h',0,1e12],['minTradfiVolume24h',0,1e12],['refreshSeconds',30,600]])if(!Number.isFinite(s[key])||s[key]<min||s[key]>max)throw new Error('Invalid '+key);
  if(!Number.isInteger(s.maxMarkets)||!Number.isInteger(s.refreshSeconds)||typeof s.sound!=='boolean'||!['ALL','CRYPTO','STOCK','COMMODITY'].includes(s.assetClass))throw new Error('Invalid settings');
  if(!Array.isArray(s.saved)||s.saved.length>200||s.saved.some(x=>typeof x!=='string'||x.length>100))throw new Error('Invalid saved markets');
  if(!['ALL','CRYPTO','STOCK','COMMODITY'].includes(s.assetScope)||!Array.isArray(s.visibleScanners)||s.visibleScanners.length>6||s.visibleScanners.some(x=>!SCANNER_IDS.includes(x)))throw new Error('Invalid dashboard settings');
  s.visibleScanners=[...new Set(s.visibleScanners)];
  return {...s,...workspaceSettings(s)};
}
export class Store{
  constructor(path){
    if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});this.db=new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS markets(id TEXT PRIMARY KEY,document TEXT NOT NULL,updated INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS candles(market TEXT NOT NULL,tf TEXT NOT NULL,ts INTEGER NOT NULL,o REAL NOT NULL,h REAL NOT NULL,l REAL NOT NULL,c REAL NOT NULL,v REAL NOT NULL,q REAL,PRIMARY KEY(market,tf,ts));
      CREATE TABLE IF NOT EXISTS signals(id TEXT PRIMARY KEY,market TEXT NOT NULL,strategy TEXT NOT NULL,tf TEXT NOT NULL,bar INTEGER NOT NULL,created INTEGER NOT NULL,document TEXT NOT NULL,result TEXT,UNIQUE(market,strategy,tf,bar));
      CREATE INDEX IF NOT EXISTS signals_created ON signals(created DESC,id);
      CREATE TABLE IF NOT EXISTS listings(id TEXT PRIMARY KEY,announced INTEGER NOT NULL,document TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS universe(source TEXT PRIMARY KEY,symbols TEXT NOT NULL,updated INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS state(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
  }
  settings(){const row=this.db.prepare('SELECT value FROM settings WHERE key=?').get('personal');return {...DEFAULT_SETTINGS,...(row?JSON.parse(row.value):{})};}
  saveSettings(input){const s=validateSettings(input,this.settings());this.db.prepare('INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('personal',JSON.stringify(s));return s;}
  putState(key,value){this.db.prepare('INSERT INTO state VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value));}
  getState(key){const row=this.db.prepare('SELECT value FROM state WHERE key=?').get(key);return row?JSON.parse(row.value):null;}
  putMarket(m){this.db.prepare('INSERT INTO markets VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET document=excluded.document,updated=excluded.updated').run(m.id,JSON.stringify(m),Date.now());}
  market(id){const r=this.db.prepare('SELECT document FROM markets WHERE id=?').get(id);return r?JSON.parse(r.document):null;}
  database(selectedIds=[]){return databaseRows(this.db.prepare('SELECT document FROM markets').all().map(r=>JSON.parse(r.document)),this.db.prepare('SELECT market,tf,count(*) AS count,min(ts) AS firstTs,max(ts) AS lastTs FROM candles GROUP BY market,tf').all(),selectedIds);}
  putCandles(id,tf,bars){const stmt=this.db.prepare('INSERT INTO candles VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(market,tf,ts) DO UPDATE SET o=excluded.o,h=excluded.h,l=excluded.l,c=excluded.c,v=excluded.v,q=excluded.q');this.db.exec('BEGIN');try{for(const b of bars)stmt.run(id,tf,b.ts,b.o,b.h,b.l,b.c,b.v,b.q??null);this.db.exec('COMMIT');}catch(e){this.db.exec('ROLLBACK');throw e;}}
  candles(id,tf,limit=5000){return this.db.prepare('SELECT ts,o,h,l,c,v,q FROM candles WHERE market=? AND tf=? ORDER BY ts DESC LIMIT ?').all(id,tf,limit).reverse().map(x=>({...x}));}
  addSignal(s,cooldownMs=0){
    const previous=this.db.prepare('SELECT bar FROM signals WHERE market=? AND strategy=? AND tf=? ORDER BY bar DESC LIMIT 1').get(s.marketId,s.strategy,s.timeframe);
    if(previous&&cooldownMs>0&&s.barTime-previous.bar<cooldownMs)return false;
    return this.db.prepare('INSERT OR IGNORE INTO signals(id,market,strategy,tf,bar,created,document) VALUES(?,?,?,?,?,?,?)').run(s.id,s.marketId,s.strategy,s.timeframe,s.barTime,s.createdAt,JSON.stringify(s)).changes>0;
  }
  signals({limit=50,before=Number.MAX_SAFE_INTEGER,beforeId='~',strategy='ALL',assetClass='ALL',query='',filters=FILTER_DEFAULTS}={}){
    const saved=filters.onlySaved?this.settings().saved:[],out=[];
    const cursor=this.db.prepare("SELECT document,result FROM signals WHERE (created<? OR (created=? AND id<?)) AND (?='ALL' OR strategy=?) AND (?='ALL' OR json_extract(document,'$.market.assetClass')=?) AND (?='' OR instr(upper(json_extract(document,'$.market.base')),?)>0) ORDER BY created DESC,id DESC").iterate(before,before,beforeId,strategy,strategy,assetClass,assetClass,query,query.toUpperCase());
    for(const row of cursor){const s={...JSON.parse(row.document),result:row.result?JSON.parse(row.result):null};if(signalMatches(s,filters,saved))out.push(s);if(out.length>=Math.min(2000,Math.max(1,limit)))break;}return out;
  }
  pending(){return this.db.prepare("SELECT document FROM signals WHERE result IS NULL OR json_extract(result,'$.finalized')=0 ORDER BY created DESC LIMIT 500").all().map(r=>JSON.parse(r.document));}
  putResult(id,result){this.db.prepare('UPDATE signals SET result=? WHERE id=?').run(JSON.stringify(result),id);}
  results(limit=100){return this.db.prepare('SELECT document,result FROM signals WHERE result IS NOT NULL ORDER BY created DESC LIMIT ?').all(limit).map(r=>({signal:JSON.parse(r.document),...JSON.parse(r.result)}));}
  listing(item){
    const old=this.db.prepare('SELECT document FROM listings WHERE id=?').get(item.id);let value=item;
    if(old){const previous=JSON.parse(old.document);value={...previous,...item};if(previous.referencePrice!=null){for(const key of ['referencePrice','referenceAt','referenceKind'])value[key]=previous[key];}if(item.status==='ANNOUNCED'&&previous.status==='TRADING')value.status='TRADING';}
    this.db.prepare('INSERT INTO listings VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET document=excluded.document').run(value.id,value.announcedAt,JSON.stringify(value));return !old;
  }
  listings(limit=100){return this.db.prepare('SELECT document FROM listings ORDER BY announced DESC LIMIT ?').all(limit).map(r=>JSON.parse(r.document));}
  rememberUniverse(source,symbols){const prev=this.db.prepare('SELECT symbols FROM universe WHERE source=?').get(source);this.db.prepare('INSERT INTO universe VALUES(?,?,?) ON CONFLICT(source) DO UPDATE SET symbols=excluded.symbols,updated=excluded.updated').run(source,JSON.stringify(symbols),Date.now());return prev?JSON.parse(prev.symbols):null;}
  stats(){return {signals:this.db.prepare('SELECT count(*) AS n FROM signals').get().n,candles:this.db.prepare('SELECT count(*) AS n FROM candles').get().n,listings:this.db.prepare('SELECT count(*) AS n FROM listings').get().n};}
  close(){this.db.close();}
}
