export const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const price=n=>n==null||!Number.isFinite(n)?'—':new Intl.NumberFormat('en-US',{maximumFractionDigits:Math.abs(n)<.01?8:Math.abs(n)<1?6:Math.abs(n)<100?4:2}).format(n);
export const pct=n=>n==null||!Number.isFinite(n)?'—':(n>=0?'+':'')+n.toFixed(2)+'%';
export const compact=n=>n==null||!Number.isFinite(n)?'—':new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2}).format(n);
export const date=n=>new Date(n).toLocaleString('lv-LV',{timeZone:'Europe/Riga',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});
export const age=n=>{const minutes=Math.max(0,Math.floor((Date.now()-n)/60000));return minutes<1?'pirms <1 min':minutes<60?'pirms '+minutes+' min':minutes<1440?'pirms '+Math.floor(minutes/60)+' h':'pirms '+Math.floor(minutes/1440)+' d';};
export const isUp=direction=>['UP','LONG'].includes(direction);
export function avatar(m){const colors={BTC:['#342a1e','#f4bd67'],ETH:['#24263a','#afb6f6'],SOL:['#20332e','#86dec0'],BNB:['#35331f','#efd264'],XRP:['#26323c','#c2d2de'],DOGE:['#343121','#e2c97d']};const [bg,fg]=colors[m.base]||['#2b2a38','#c0b2e5'];return '<span class="coin-avatar" style="--coin-bg:'+bg+';--coin-color:'+fg+'">'+escapeHtml(m.base?.slice(0,1)||'?')+'</span>';}
export function spark(bars,positive=true,cls='spark'){
  if(!bars?.length)return '';
  const values=bars.map(b=>b.c),min=Math.min(...values),range=Math.max(...values)-min||1;
  return '<svg class="'+cls+' '+(positive?'positive':'negative')+'" viewBox="0 0 120 48" preserveAspectRatio="none" aria-label="Cenu līkne"><polyline vector-effect="non-scaling-stroke" points="'+values.map((v,i)=>(i/(values.length-1||1)*120).toFixed(2)+','+(40-(v-min)/range*32).toFixed(2)).join(' ')+'"/></svg>';
}
export function candles(all,{overlay=null,limit=80,mini=false}={}){
  const bars=all?.slice(-limit)||[];if(!bars.length)return '<div class="empty-mini">Grafika dati nav pieejami.</div>';
  const w=800,h=mini?250:320,L=12,R=mini?8:90,T=20,B=mini?12:38,pw=w-L-R;
  const extra=overlay?[overlay.levelPrice,overlay.entry,overlay.tp,overlay.sl,overlay.line?.p2?.price].filter(Number.isFinite):[];
  let low=Math.min(...bars.map(b=>b.l),...extra),high=Math.max(...bars.map(b=>b.h),...extra);const padding=(high-low)*.08||high*.01;low-=padding;high+=padding;
  const y=v=>T+(high-v)/(high-low)*(h-T-B),x=i=>L+(i+.5)/bars.length*pw;
  const timeX=ts=>L+((ts-bars[0].ts)/(bars[1]?.ts-bars[0].ts||1)+.5)/bars.length*pw;
  let svg='<svg class="candle-chart '+(mini?'mini-candles':'')+'" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Noslēgto sveču grafiks ar signāla atzīmēm">';
  for(let i=0;i<5;i++){const value=low+(high-low)*i/4,yy=y(value);svg+='<path d="M'+L+' '+yy+'H'+(w-R)+'" stroke="#202b39"/>';if(!mini)svg+='<text x="'+(w-R+9)+'" y="'+(yy+4)+'" fill="#8190a5" font-size="10">'+price(value)+'</text>';}
  const maxVolume=Math.max(...bars.map(b=>b.q??b.v));
  for(let i=0;i<bars.length;i++){
    const b=bars[i],color=b.c>=b.o?'#43d5b0':'#f27d8b',xx=x(i),bw=Math.max(2,pw/bars.length*.65),volume=maxVolume>0?(b.q??b.v)/maxVolume*40:0;
    svg+='<g data-bar="'+i+'"><rect x="'+(xx-bw/2)+'" y="'+(h-B-volume)+'" width="'+bw+'" height="'+volume+'" fill="'+color+'" opacity=".13"/><path d="M'+xx+' '+y(b.h)+'V'+y(b.l)+'" stroke="'+color+'"/><rect x="'+(xx-bw/2)+'" y="'+Math.min(y(b.o),y(b.c))+'" width="'+bw+'" height="'+Math.max(1,Math.abs(y(b.o)-y(b.c)))+'" fill="'+color+'"/></g>';
  }
  if(overlay){for(const [value,color,label]of [[overlay.levelPrice,'#c6f56b','LEVEL'],[overlay.entry,'#a6b6cb','ENTRY'],[overlay.tp,'#43d5b0','TP'],[overlay.sl,'#f27d8b','SL']])if(Number.isFinite(value)){svg+='<path d="M'+L+' '+y(value)+'H'+(w-R)+'" stroke="'+color+'" stroke-dasharray="5 5" opacity=".7"/>';if(!mini)svg+='<text x="'+(L+5)+'" y="'+(y(value)-5)+'" fill="'+color+'" font-size="10">'+label+' '+price(value)+'</text>';}
    if(overlay.line){const line=overlay.line,a=line.p1,b=line.p2,start=Math.max(a.ts,bars[0].ts),ratio=(start-a.ts)/(b.ts-a.ts||1),startPrice=a.price+(b.price-a.price)*ratio;svg+='<path d="M'+timeX(start)+' '+y(startPrice)+'L'+timeX(b.ts)+' '+y(b.price)+'" stroke="#b4a0fa" stroke-width="2"/>';for(const touch of line.touches||[])if(touch.ts>=bars[0].ts)svg+='<circle cx="'+timeX(touch.ts)+'" cy="'+y(touch.price)+'" r="4" fill="#b4a0fa"/>';}}
  if(!mini)for(let i=0;i<bars.length;i+=Math.max(1,Math.floor(bars.length/4)))svg+='<text x="'+x(i)+'" y="'+(h-10)+'" fill="#718299" font-size="10" text-anchor="middle">'+new Date(bars[i].ts).toLocaleString('lv-LV',{timeZone:'Europe/Riga',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})+'</text>';
  return svg+'</svg>';
}
