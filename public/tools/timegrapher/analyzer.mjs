// Crowniq Timegrapher Lab V0.2 — LOCAL experimental acoustic analysis.
// The incoming 1 ms energy envelope is identical for demo and microphone.
// A watch specification / demo selection is NEVER passed to the detector.
export const SUPPORTED_BPH = [7200, 9000, 10800, 14400, 18000, 19800, 21600, 25200, 28800, 36000, 43200];
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const median=arr=>{if(!arr.length)return 0;const a=[...arr].sort((a,b)=>a-b);return a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2;};
const quantile=(sorted,p)=>sorted[Math.floor((sorted.length-1)*p)]??0;

// A single mechanical beat often consists of several nearby impacts. Merge
// impulses within 42ms; this is shorter than the 83ms beat interval at 43,200 A/h.
// Sub-bin peak interpolation reduces systematic 1ms sampling quantization.
export function detectEvents(envelope,binMs=1){
  if(!envelope.length)return {events:[],contrast:0,floor:0,threshold:0};
  const sample=[],stride=Math.max(1,Math.floor(envelope.length/5000));
  for(let i=0;i<envelope.length;i+=stride)sample.push(envelope[i]);
  sample.sort((a,b)=>a-b);
  const floor=Math.max(1e-9,quantile(sample,.38));
  const high=quantile(sample,.995);
  const contrast=(high-floor)/floor;
  if(contrast<1.25||high<0.000007)return {events:[],contrast,floor,threshold:0};
  const threshold=Math.max(floor*2.45, floor+(high-floor)*.27);
  const refractoryBins=Math.ceil(42/binMs);
  const events=[];
  let pending=null;
  const emit=p=>{
    const i=p.peak;
    const l=envelope[Math.max(i-1,0)],c=envelope[i],r=envelope[Math.min(i+1,envelope.length-1)];
    const den=l-2*c+r;
    const fractional=den<-.0000000001?clamp(.5*(l-r)/den,-.5,.5):0;
    events.push({t:(i+fractional)*binMs,strength:p.strength});
  };
  for(let i=0;i<envelope.length;i++){
    const value=envelope[i];
    if(value<threshold)continue;
    if(pending===null)pending={peak:i,last:i,strength:value};
    else if(i-pending.last<refractoryBins){
      pending.last=i;
      if(value>pending.strength){pending.peak=i;pending.strength=value;}
    }else{
      emit(pending);pending={peak:i,last:i,strength:value};
    }
  }
  if(pending)emit(pending);
  return {events,contrast,floor,threshold};
}

function scoreCandidate(times,bph){
  const period=3600000/bph;
  const tolerance=Math.max(9,period*.075);
  let best=null;
  for(const anchor of times.slice(0,Math.min(14,times.length))){
    let matched=0,error=0;
    const used=new Set();
    for(const t of times){
      const n=Math.round((t-anchor)/period),delta=Math.abs(t-anchor-n*period);
      if(delta<=tolerance&&!used.has(n)){used.add(n);matched++;error+=delta;}
    }
    const expected=Math.max(1,Math.round((times[times.length-1]-times[0])/period)+1);
    const precision=matched/times.length;
    const recall=clamp(matched/expected,0,1);
    const f1=precision+recall>0?2*precision*recall/(precision+recall):0;
    const timing=matched?1-clamp(error/(matched*tolerance),0,1):0;
    const score=f1*(.88+.12*timing);
    if(!best||score>best.score)best={bph,period,tolerance,score,matched,expected,precision,recall,anchor};
  }
  return best;
}

function linearFit(matches,period){
  const n=matches.length;
  if(n<3)return null;
  const meanN=matches.reduce((s,v)=>s+v.n,0)/n,meanT=matches.reduce((s,v)=>s+v.t,0)/n;
  let numer=0,denom=0;
  for(const p of matches){numer+=(p.n-meanN)*(p.t-meanT);denom+=(p.n-meanN)**2;}
  if(!denom)return null;
  const slope=numer/denom,offset=meanT-slope*meanN;
  const residues=matches.map(p=>({...p,residual:p.t-(offset+slope*p.n)}));
  const even=residues.filter(p=>Math.abs(p.n)%2===0).map(p=>p.residual);
  const odd=residues.filter(p=>Math.abs(p.n)%2===1).map(p=>p.residual);
  const beatError=even.length>=5&&odd.length>=5?Math.abs(median(even)-median(odd)):null;
  const rms=Math.sqrt(residues.reduce((s,v)=>s+v.residual*v.residual,0)/n);
  // Physical sign: smaller measured period means watch is running fast (+).
  const rate=(period/slope-1)*86400;
  // Phase relative to NOMINAL period: slope of the traces shows fast/slow drift.
  const phasePoints=residues.map(p=>({t:p.t,n:p.n,phase:p.t-(offset+p.n*period),parity:Math.abs(p.n)%2}));
  const centering=median(phasePoints.map(p=>p.phase));
  phasePoints.forEach(p=>{p.phase-=centering;});
  return {rate,beatError,rms,phasePoints,seconds:(matches[n-1].t-matches[0].t)/1000,pulseCount:n};
}

export function analyzeEnvelope(envelope,binMs=1,windowMs=18000){
  const detected=detectEvents(envelope,binMs);
  const duration=envelope.length*binMs;
  const times=detected.events.filter(e=>e.t>=Math.max(0,duration-windowMs)).map(e=>e.t);
  const base={duration,events:detected.events.length,contrast:detected.contrast,
    bph:null,confidence:0,quality:'none',reason:'Noch kein stabiles Tick-Intervall',
    rate:null,beatError:null,rms:null,pulseCount:0,phasePoints:[],sampleDuration:0,
    candidates:[]};
  if(times.length<14||times[times.length-1]-times[0]<2500)return base;
  const candidates=SUPPORTED_BPH.map(v=>scoreCandidate(times,v)).filter(Boolean).sort((a,b)=>b.score-a.score);
  const best=candidates[0],second=candidates[1];
  if(!best||best.score<.55||best.matched<14||best.precision<.65||best.recall<.60){
    return {...base,reason:'Impulse zu unregelmäßig oder zu wenige Ticks',
      candidates:candidates.slice(0,3).map(c=>({bph:c.bph,score:c.score}))};
  }
  const matches=[],used=new Set();
  for(const t of times){
    const n=Math.round((t-best.anchor)/best.period),delta=Math.abs(t-best.anchor-n*best.period);
    if(delta<=best.tolerance&&!used.has(n)){used.add(n);matches.push({t,n});}
  }
  const fit=linearFit(matches,best.period);
  const ambiguous=!!second && best.score-second.score<.035 && second.score>.64;
  // Detections can be tentative while rate/beat error require a longer,
  // clean, non-ambiguous measurement. Don't interpret weak evidence as a result.
  const sufficient=fit&&fit.seconds>=9&&fit.pulseCount>=36;
  const measurementOK=sufficient&&!ambiguous&&fit.rms<6.5&&Math.abs(fit.rate)<1800&&best.score>=.72;
  const confidence=Math.round(clamp(best.score*100,0,100));
  const quality=ambiguous?'low':confidence>=85?'high':confidence>=70?'medium':'low';
  const reason=ambiguous?'Mehrere Schlagzahlen ähnlich plausibel':
    quality==='low'?'Schlagzahl nur vorläufig erkannt':
    !sufficient?'Schlagzahl erkannt – weitere Ticks für Gangmessung nötig':
    !measurementOK?'Tick-Schwankungen zu groß für Gangmessung':
    'Schlagzahl stabil – Gangwerte weiterhin experimentell';
  return {...base,bph:best.bph,confidence,quality,reason,
    rate:measurementOK?fit.rate:null,beatError:measurementOK?fit.beatError:null,
    rms:fit?.rms??null,pulseCount:best.matched,
    phasePoints:quality==='low'?[]:fit?.phasePoints??[],
    sampleDuration:fit?.seconds??0,
    ambiguous,candidates:candidates.slice(0,3).map(c=>({bph:c.bph,score:Math.round(c.score*100)}))};
}

export class EnvelopeBuffer{
  constructor(binMs=1,windowMs=20000){this.binMs=binMs;this.windowMs=windowMs;this.values=[];this.totalBins=0;}
  add(values){this.values.push(...values);this.totalBins+=values.length;
    const max=Math.ceil(this.windowMs/this.binMs);
    if(this.values.length>max+256)this.values.splice(0,this.values.length-max);
  }
  reset(){this.values=[];this.totalBins=0;}
  analyze(){return analyzeEnvelope(this.values,this.binMs);}
}

// Deliberately deterministic per-tick jitter: adjacent 50-ms blocks cannot
// shift the same beat differently at their boundary.
export class DemoSource{
  constructor(bph=21600,rate=8,beatError=.4,seed=75321,options={}){
    this.bph=bph;this.rate=rate;this.beatError=beatError;this.seed=seed>>>0;
    this.interval=(3600000/bph)/(1+rate/86400);
    this.index=0;this.noise=options.noise??0;this.dropout=options.dropout??0;
    this.jitter=options.jitter??.24;this.spurious=options.spurious??0;
  }
  random(){this.seed=(Math.imul(1664525,this.seed)+1013904223)>>>0;return this.seed/4294967296;}
  hash(n,salt){let x=(Math.imul(n+19,0x9e3779b1)+Math.imul(salt+7,0x85ebca6b)+0x7f4a7c15)>>>0;
    x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);return ((x^(x>>>16))>>>0)/4294967296;
  }
  take(ms=100,binMs=1){
    const count=Math.round(ms/binMs),begin=this.index*binMs,end=begin+count*binMs;
    const values=new Array(count);
    for(let i=0;i<count;i++){
      values[i]=.006+(.004+this.noise)*this.random();
      if(this.spurious&&this.random()<this.spurious*binMs/1000)values[i]+=.12;
    }
    const first=Math.max(0,Math.floor(begin/this.interval)-2),last=Math.ceil(end/this.interval)+2;
    for(let n=first;n<=last;n++){
      if(this.hash(n,4)<this.dropout)continue;
      const center=n*this.interval+(n%2?this.beatError/2:-this.beatError/2)+(this.hash(n,8)-.5)*this.jitter;
      for(const [shift,amp,width] of [[0,.17,1.35],[7,.095,1.55],[14,.07,1.35]]){
        const peak=center+shift,left=Math.max(0,Math.floor((peak-begin-4*width)/binMs)),right=Math.min(count-1,Math.ceil((peak-begin+4*width)/binMs));
        for(let i=left;i<=right;i++){
          const d=(begin+i*binMs-peak)/width;
          values[i]+=amp*Math.exp(-.5*d*d);
        }
      }
    }
    this.index+=count;
    return values;
  }
}
