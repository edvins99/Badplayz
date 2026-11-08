import {createHash} from 'node:crypto';
export const TF={'5m':300000,'15m':900000,'1h':3600000,'4h':14400000,'1d':86400000};
export const PERIOD={...TF,'24h':86400000,'7d':604800000};
export const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:0;
export const sd=a=>Math.sqrt(mean(a.map(v=>(v-mean(a))**2)));
export const change=(a,b)=>(b/a-1)*100;
export const profile=asset=>({CRYPTO:{base:.8,k:1.8,z:3,n:3,touches:3,tolerance:.3,approach:.5,cooldown:2,size:1000},STOCK:{base:0,k:1.6,z:3,n:4,touches:3,tolerance:.25,approach:.35,cooldown:3,size:10000},COMMODITY:{base:0,k:1.5,z:2.8,n:4,touches:3,tolerance:.2,approach:.3,cooldown:3,size:.5}}[asset]);
export function closedBars(raw,tf,now=Date.now()){
  if(!TF[tf])throw new Error('Unsupported timeframe');
  return [...new Map(raw.filter(b=>Number.isFinite(b.ts)&&b.ts+TF[tf]<=now).map(b=>[b.ts,b])).values()].sort((a,b)=>a.ts-b.ts).filter(b=>[b.o,b.h,b.l,b.c,b.v].every(Number.isFinite)&&b.l>0&&b.v>=0&&b.h>=Math.max(b.o,b.c,b.l)&&b.l<=Math.min(b.o,b.c,b.h));
}
export function atr(bars,n=14){
  if(bars.length<n+1)return null;
  return mean(bars.slice(-n).map((b,i)=>{const p=bars[bars.length-n-1+i].c;return Math.max(b.h-b.l,Math.abs(b.h-p),Math.abs(b.l-p));}));
}
export function pivots(bars,n=3){
  const out={high:[],low:[]};
  for(let i=n;i<bars.length-n;i++){
    const span=bars.slice(i-n,i+n+1);
    if(span.every((b,j)=>j===n||bars[i].h>b.h))out.high.push({i,ts:bars[i].ts,p:bars[i].h,confirmedAt:bars[i+n].ts});
    if(span.every((b,j)=>j===n||bars[i].l<b.l))out.low.push({i,ts:bars[i].ts,p:bars[i].l,confirmedAt:bars[i+n].ts});
  }return out;
}
export function regression(points){
  const mx=mean(points.map(p=>p.i)),my=mean(points.map(p=>p.p));
  const den=points.reduce((s,p)=>s+(p.i-mx)**2,0);
  const slope=den?points.reduce((s,p)=>s+(p.i-mx)*(p.p-my),0)/den:0;
  return {slope,intercept:my-slope*mx};
}
export function detectMoves(bars,asset){
  if(bars.length<35)return null;
  const p=profile(asset),last=bars.at(-1),previous=bars.slice(-31,-1),a=atr(bars.slice(0,-1));
  const move=change(last.o,last.c),prior=previous.map(b=>change(b.o,b.c)),sigma=sd(prior);
  const z=sigma>1e-10?Math.abs(move-mean(prior))/sigma:0;
  const adaptive=p.k*a/last.o*100,threshold=Math.max(p.base,adaptive);
  if(Math.abs(move)<threshold&&!(z>=p.z&&Math.abs(move)>=p.base&&Math.abs(move)>adaptive*.5))return null;
  return {strategy:'MOVES',direction:move>=0?'UP':'DOWN',movePct:move,entry:last.c,thresholdPct:threshold,zScore:z,atr:a,reason:'volatility-move'};
}
export function detectLevels(bars,asset){
  if(bars.length<45)return null;
  const p=profile(asset),history=bars.slice(0,-1),last=bars.at(-1),prev=bars.at(-2),a=atr(history),s=pivots(history,p.n);
  const candidates=[];
  for(const [side,points]of [['support',s.low],['resistance',s.high]]){
    const clusters=[];
    for(const pt of points){let c=clusters.find(c=>Math.abs(c.price-pt.p)<=a*p.tolerance);if(!c){c={price:pt.p,points:[]};clusters.push(c);}c.points.push(pt);c.price=mean(c.points.map(x=>x.p));}
    for(const c of clusters){
      if(c.points.length<p.touches)continue;
      // The third confirming reaction establishes the level. A fourth reaction
      // must not reset its identity and turn an already tested level into a new one.
      const recent=c.points[p.touches-1],confirmed=recent.i+p.n;
      if(history.slice(confirmed+1).some(b=>side==='support'?b.l<=c.price+a*p.approach:b.h>=c.price-a*p.approach))continue;
      const distance=side==='support'?last.c-c.price:c.price-last.c;
      const before=side==='support'?prev.c-c.price:c.price-prev.c;
      if(distance<0||distance>a*p.approach||before<=a*p.approach)continue;
      candidates.push({strategy:'LEVELS',direction:side==='support'?'LONG':'SHORT',entry:last.c,levelPrice:c.price,levelStart:c.points[0].ts,touches:c.points.map(x=>({ts:x.ts,price:x.p})),atr:a,reason:side+'-approach',distance});
    }
  }return candidates.sort((a,b)=>a.distance-b.distance)[0]??null;
}
export function bestTrendLine(points,tolerance){
  const candidates=points.slice(-14);let best=null;
  for(let i=0;i<candidates.length;i++)for(let j=i+1;j<candidates.length;j++){
    const u=candidates[i],v=candidates[j];if(v.i-u.i<12)continue;
    const slope=(v.p-u.p)/(v.i-u.i),intercept=u.p-slope*u.i;
    const inliers=candidates.filter(p=>Math.abs(p.p-(intercept+slope*p.i))<=tolerance);
    if(inliers.length<3)continue;
    const fit=regression(inliers),residual=mean(inliers.map(p=>Math.abs(p.p-fit.intercept-fit.slope*p.i)));
    if(!best||inliers.length>best.points.length||inliers.length===best.points.length&&residual<best.residual)best={...fit,points:inliers,residual};
  }return best;
}
export function detectSlope(bars,asset){
  if(bars.length<60)return null;
  const p=profile(asset),history=bars.slice(0,-1),last=bars.at(-1),prev=bars.at(-2),a=atr(history),s=pivots(history,p.n),n=history.length;
  const candidates=[];
  for(const [side,points]of [['support',s.low],['resistance',s.high]]){
    const fit=bestTrendLine(points,a*p.tolerance);if(!fit)continue;
    const line=fit.intercept+fit.slope*n,priorLine=fit.intercept+fit.slope*(n-1),tol=a*p.tolerance;
    const breakout=side==='resistance'?last.c>line+tol&&prev.c<=priorLine+tol:last.c<line-tol&&prev.c>=priorLine-tol;
    const touch=side==='support'?Math.abs(last.l-line)<=tol&&last.c>=line&&prev.l>priorLine+tol:Math.abs(last.h-line)<=tol&&last.c<=line&&prev.h<priorLine-tol;
    if(!breakout&&!touch)continue;
    const direction=breakout?(side==='resistance'?'LONG':'SHORT'):(side==='support'?'LONG':'SHORT');
    const long=direction==='LONG',entry=last.c,risk=Math.max(a,Math.abs(entry-line)+a*.3);
    candidates.push({strategy:'SLOPE',direction,entry,sl:entry+(long?-risk:risk),tp:entry+(long?risk*2:-risk*2),atr:a,reason:breakout?'breakout':'retest',line:{side,p1:{ts:history[fit.points[0].i].ts,price:fit.intercept+fit.slope*fit.points[0].i},p2:{ts:last.ts,price:line},touches:fit.points.map(x=>({ts:x.ts,price:x.p}))},priority:breakout?1:0});
  }return candidates.sort((a,b)=>b.priority-a.priority)[0]??null;
}
export function detectSignals(bars,market,tf,now=Date.now()){
  const closed=closedBars(bars,tf,now);if(closed.length<35)return [];
  const last=closed.at(-1),start=closed.slice(-160);
  return [detectMoves(start,market.assetClass),detectLevels(start,market.assetClass),detectSlope(start,market.assetClass)].filter(Boolean).map(s=>({
    ...s,id:createHash('sha256').update([market.id,s.strategy,tf,last.ts].join(':')).digest('hex').slice(0,28),marketId:market.id,market,timeframe:tf,
    barTime:last.ts,barEnd:last.ts+TF[tf],createdAt:now,mode:market.mode||'live',snapshot:start,profileVersion:'personal-1.0'
  }));
}
export function activity(raw,tf,period,now=Date.now()){
  const bars=closedBars(raw,tf,now),step=TF[tf],duration=PERIOD[period];
  if(!duration||duration<step||duration%step||!bars.length)return null;
  const width=duration/step,end=bars.at(-1).ts+step,current=bars.filter(b=>b.ts>=end-duration);
  if(current.length!==width||current.some((b,i)=>b.ts!==end-duration+i*step))return null;
  const volumes=[],moves=[];let complete=0;
  for(let back=1;back<=Math.floor(604800000/duration);back++){
    const e=end-duration*back,s=e-duration,chunk=bars.filter(b=>b.ts>=s&&b.ts<e);
    if(chunk.length!==width||chunk.some((b,i)=>b.ts!==s+i*step))continue;
    if(chunk.some(b=>!Number.isFinite(b.q)))continue;
    volumes.push(chunk.reduce((v,b)=>v+b.q,0));moves.push(Math.abs(change(chunk[0].o,chunk.at(-1).c)));complete++;
  }
  // A seven-day period compares against the preceding, non-overlapping seven days.
  const expected=Math.max(1,Math.floor(604800000/duration)),coverage=complete/expected;
  const volume=current.every(b=>Number.isFinite(b.q))?current.reduce((v,b)=>v+b.q,0):null;
  const rvol=coverage>=.95&&volume!==null&&mean(volumes)>0?volume/mean(volumes):null;
  const movePct=change(current[0].o,current.at(-1).c),typical=mean(moves);
  const sigmoid=x=>1/(1+Math.exp(-x));
  const score=rvol===null||typical<=1e-10?null:Math.round(100*(.55*sigmoid(Math.log(Math.max(rvol,.001))*1.5)+.45*sigmoid((Math.abs(movePct)/typical-1)*1.2)));
  let waveStart=null;
  const recent=bars.slice(-25),baseline=mean(recent.slice(0,-1).map(b=>b.q));
  for(let i=recent.length-1;i>=Math.max(0,recent.length-7);i--)if(baseline>0&&recent[i].q>=baseline*2)waveStart=recent[i];
  return {period,movePct,volume,rvol,score,coverage,windowEnd:end,waveStart:waveStart?{ts:waveStart.ts,price:waveStart.o,changePct:change(waveStart.o,bars.at(-1).c)}:null};
}
export function evaluateResult(signal,raw,now=Date.now()){
  const long=['UP','LONG'].includes(signal.direction),entry=signal.entry;
  if(!Number.isFinite(entry)||entry<=0)return null;
  const windowBars=signal.strategy==='MOVES'?24:48,windowEnd=signal.createdAt+TF[signal.timeframe]*windowBars;
  const step=TF[signal.timeframe],eligibleStart=Math.ceil(signal.createdAt/step)*step,eligibleEnd=Math.min(windowEnd,now);
  const bars=closedBars(raw,signal.timeframe,now).filter(b=>b.ts>=signal.createdAt&&b.ts+step<=windowEnd);
  if(!bars.length)return null;
  const favourable=long?Math.max(...bars.map(b=>b.h)):Math.min(...bars.map(b=>b.l));
  const adverse=long?Math.min(...bars.map(b=>b.l)):Math.max(...bars.map(b=>b.h));
  const signed=p=>(long?1:-1)*change(entry,p);
  let hitTp=null,hitSl=null,hitOrder=null;
  for(const b of bars){const tp=signal.tp!=null&&(long?b.h>=signal.tp:b.l<=signal.tp),sl=signal.sl!=null&&(long?b.l<=signal.sl:b.h>=signal.sl);if(tp)hitTp=true;if(sl)hitSl=true;if(!hitOrder&&(tp||sl))hitOrder=tp&&sl?'SAME_BAR_UNKNOWN':tp?'TP_FIRST':'SL_FIRST';}
  if(signal.tp!=null&&hitTp===null)hitTp=false;if(signal.sl!=null&&hitSl===null)hitSl=false;
  const demo=profile(signal.market.assetClass).size,mfePct=Math.max(0,signed(favourable)),maePct=Math.max(0,-signed(adverse));
  const canPrice=signal.market.assetClass!=='COMMODITY'||signal.market.contractUnits>0;
  const profitUsd=!canPrice?null:signal.market.assetClass==='COMMODITY'?Math.abs(favourable-entry)*signal.market.contractUnits*demo:demo*mfePct/100;
  const expected=Math.max(0,Math.floor((eligibleEnd-eligibleStart)/step)),coverage=expected?Math.min(1,bars.length/expected):0;
  return {signalId:signal.id,evaluatedAt:now,windowEnd,finalized:now>=windowEnd&&coverage>=1,coverage,mfePct,maePct,endReturnPct:signed(bars.at(-1).c),hitTp,hitSl,hitOrder,demoSize:demo,demoUnit:signal.market.assetClass==='COMMODITY'?'LOT':'USD',profitUsd,method:'MFE',costsIncluded:false,lastBar:bars.at(-1).ts};
}
