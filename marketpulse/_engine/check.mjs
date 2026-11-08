import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {sha256} from '../hash.js';
import * as browser from '../analytics.js';
import * as server from './lib/analytics.mjs';
import {classify} from '../adapters.js';
import {BrowserStore,validateSettings} from '../store.js';
for(const s of ['', 'abc','zelts · akcijas','x'.repeat(55),'x'.repeat(64),'x'.repeat(257)])assert.equal(sha256(s),createHash('sha256').update(s).digest('hex'));
const end=Date.UTC(2026,10,8),bars=Array.from({length:100},(_,i)=>({ts:end-(100-i)*900000,o:100,h:101,l:99,c:100,v:10,q:1000}));bars.at(-1).c=108;bars.at(-1).h=109;
const market={id:'binance-spot:BTCUSDT',base:'BTC',source:'binance-spot',exchange:'binance',marketType:'SPOT',assetClass:'CRYPTO'};
assert.deepEqual(browser.detectSignals(bars,market,'15m',end),server.detectSignals(bars,market,'15m',end));
assert.equal(classify('AAOI',{symbolType:'stock'},'bybit'),'STOCK');assert.equal(classify('BZ',{instCategory:'4'},'okx'),'COMMODITY');
const prefs=new BrowserStore();prefs.saveSettings({visibleScanners:['STOCKS'],assetScope:'STOCK'});assert.deepEqual(prefs.settings().visibleScanners,['STOCKS']);assert.throws(()=>prefs.saveSettings({visibleScanners:['MISSING']}));prefs.putMarket(market);prefs.putCandles(market.id,'15m',bars);const inventory=prefs.database([market.id])[0];assert.equal(inventory.candleCount,100);assert.equal(inventory.lastCandleAt,bars.at(-1).ts);assert.equal(inventory.selected,true);
const store=new BrowserStore();store.saveSettings({saved:[market.id],maxMarkets:20});const signal=browser.detectSignals(bars,market,'15m',end)[0];assert.ok(store.addSignal(signal));assert.equal(store.addSignal(signal),false);assert.equal(store.signals().length,1);assert.equal(store.settings().saved[0],market.id);assert.throws(()=>validateSettings({source:'mock'}));assert.throws(()=>validateSettings({source:'https://evil.example'}));
console.log('Browser SHA-256, detector parity, provider categories, persistence contract and settings validation passed');
prefs.kvMap.delete('candle-meta');await prefs.prepareInventory();assert.equal(prefs.database()[0].lastCandleAt,bars.at(-1).ts);

const defaults=(await import('../workspace.js')).FILTER_DEFAULTS;store.saveSettings({viewFilters:{...defaults,marketType:'SPOT'},filterProfiles:[{id:'crypto',name:'Crypto',filters:defaults}],activeProfileId:'crypto'});assert.equal(store.settings().activeProfileId,'crypto');const newer={...signal,id:'history-new',barTime:signal.barTime+900000,createdAt:signal.createdAt+900000};assert.equal(store.addSignal(newer),true);assert.equal(store.addSignal({...signal,id:'history-old',barTime:signal.barTime-900000,createdAt:signal.createdAt-900000}),true);assert.ok(store.signals({filters:{...defaults,signalTf:'1h'}}).length===0);
