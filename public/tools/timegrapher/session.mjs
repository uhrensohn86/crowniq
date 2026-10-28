// V0.6 — 90-second fixed measurement, with independent 20-second intervals.
// The warm-up signal is NEVER included in the final rate or beat-error estimate.
import {analyzeEnvelope} from './analyzer.mjs';

export const WARMUP_MS=30000;
export const EVALUATION_MS=60000;
export const TOTAL_MS=WARMUP_MS+EVALUATION_MS;
export const INTERVAL_MS=20000;

const median=values=>{
  const sorted=[...values].sort((a,b)=>a-b);
  if(!sorted.length)return null;
  const i=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[i]:(sorted[i-1]+sorted[i])/2;
};
const meanWeighted=(values,key)=>{
  const total=values.reduce((sum,v)=>sum+v.pulseCount,0);
  return total?values.reduce((sum,v)=>sum+v[key]*v.pulseCount,0)/total:null;
};
const spread=(values,key)=>Math.max(...values.map(v=>v[key]))-Math.min(...values.map(v=>v[key]));

export class SessionCollector{
  constructor(){this.reset();}
  reset(){this.elapsed=0;this.evaluation=[];}
  add(samples){
    if(!Array.isArray(samples)||!samples.length)return this.elapsed>=TOTAL_MS;
    const before=this.elapsed;
    const begin=Math.max(0,WARMUP_MS-before);
    const end=Math.min(samples.length,TOTAL_MS-before);
    if(end>begin)this.evaluation.push(...samples.slice(begin,end));
    this.elapsed=Math.min(TOTAL_MS,before+samples.length);
    return this.elapsed>=TOTAL_MS;
  }
  get progress(){return this.elapsed/TOTAL_MS;}
  get phase(){return this.elapsed<WARMUP_MS?'warmup':this.elapsed<TOTAL_MS?'evaluation':'complete';}
  evaluate(){return evaluateSession(this.evaluation);}
}

export function evaluateSession(evaluation){
  if(evaluation.length<EVALUATION_MS){
    return {ok:false,reason:'Messzeit noch nicht vollständig.',intervals:[],accepted:0};
  }
  const intervals=[];
  for(let i=0;i<EVALUATION_MS;i+=INTERVAL_MS){
    const segment=evaluation.slice(i,i+INTERVAL_MS);
    const result=analyzeEnvelope(segment,1,INTERVAL_MS);
    intervals.push(result);
  }
  const candidates=intervals.filter(v=>Number.isFinite(v.rate)&&Number.isFinite(v.beatError)&&
    Number.isFinite(v.bph)&&v.confidence>=82&&v.quality==='high'&&!v.ambiguous);
  if(candidates.length<2){
    return {ok:false,reason:'Zu wenige verwertbare Messabschnitte.',intervals,accepted:0};
  }
  // Two or three independent intervals must agree on the detected frequency.
  const counts=new Map();
  for(const v of candidates)counts.set(v.bph,(counts.get(v.bph)||0)+1);
  const [[bph,count]]=Array.from(counts).sort((a,b)=>b[1]-a[1]);
  if(count<2){
    return {ok:false,reason:'Schlagzahl wechselt zwischen den Abschnitten.',intervals,accepted:0};
  }
  const sameBph=candidates.filter(v=>v.bph===bph);
  const rateMedian=median(sameBph.map(v=>v.rate));
  const beatMedian=median(sameBph.map(v=>v.beatError));
  const rateMAD=median(sameBph.map(v=>Math.abs(v.rate-rateMedian)))||0;
  const beatMAD=median(sameBph.map(v=>Math.abs(v.beatError-beatMedian)))||0;
  // Reject a distinctly bad interval without smoothing the raw tick timings.
  const accepted=sameBph.filter(v=>
    Math.abs(v.rate-rateMedian)<=Math.max(6,3*1.4826*rateMAD)&&
    Math.abs(v.beatError-beatMedian)<=Math.max(.35,3*1.4826*beatMAD));
  if(accepted.length<2){
    return {ok:false,reason:'Messabschnitte widersprechen sich.',intervals,accepted:accepted.length};
  }
  const rateSpread=spread(accepted,'rate'),beatSpread=spread(accepted,'beatError');
  if(rateSpread>15||beatSpread>1){
    return {ok:false,reason:'Gang oder Abfallfehler schwanken zu stark.',intervals,
      accepted:accepted.length,rateSpread,beatSpread};
  }
  return {
    ok:true,bph,rate:meanWeighted(accepted,'rate'),
    beatError:meanWeighted(accepted,'beatError'),
    confidence:Math.round(meanWeighted(accepted,'confidence')),
    quality:accepted.length===3&&rateSpread<=6&&beatSpread<=.4?'high':'medium',
    rateSpread,beatSpread,accepted:accepted.length,intervals,
  };
}
