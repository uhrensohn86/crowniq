// Crowniq Timegrapher V0.3 — presentation-only processing.
// Underlying detector, raw event times, BPH selection and its physical estimates
// remain untouched. Display filtering MUST NOT be fed back into measurement.
const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
const median=values=>{
  if(!values.length)return null;
  const a=[...values].sort((x,y)=>x-y),mid=Math.floor(a.length/2);
  return a.length%2?a[mid]:(a[mid-1]+a[mid])/2;
};

export class CalmReadings{
  constructor(){this.reset();}
  reset(){this.bph=null;this.lastGood=null;this.lastTime=null;this.samples=[];this.rate=null;this.beatError=null;}
  update(result,timeMs){
    const good=Number.isFinite(result?.rate)&&Number.isFinite(result?.beatError)&&
      result.quality!=='low'&&!result.ambiguous&&Number.isFinite(result.bph);
    if(!good){
      // Never hold a stale reading when BPH is lost or signal quality collapses.
      this.reset();return {rate:null,beatError:null,rawRate:null,rawBeatError:null,ready:false};
    }
    if(this.bph!==result.bph || this.lastTime===null || timeMs<this.lastTime || timeMs-this.lastTime>3500){
      this.reset();this.bph=result.bph;
    }
    this.samples.push({t:timeMs,rate:result.rate,beatError:result.beatError});
    this.samples=this.samples.filter(x=>timeMs-x.t<=7000);
    const rateMedian=median(this.samples.map(x=>x.rate));
    const beatMedian=median(this.samples.map(x=>x.beatError));
    // First value appears immediately. Then a time-aware low pass, on a short
    // rolling median, calms UI jitter without concealing sustained changes.
    const dt=this.lastTime===null?0:clamp(timeMs-this.lastTime,0,3500);
    const gain=this.lastTime===null?1:1-Math.exp(-dt/4200);
    this.rate=this.rate===null?rateMedian:this.rate+(rateMedian-this.rate)*gain;
    this.beatError=this.beatError===null?beatMedian:this.beatError+(beatMedian-this.beatError)*(this.lastTime===null?1:1-Math.exp(-dt/5500));
    this.lastTime=timeMs;
    return {rate:this.rate,beatError:this.beatError,rawRate:result.rate,rawBeatError:result.beatError,
      ready:this.samples.length>=4};
  }
}

// Local robust linear regression on each parity; unlike simple flat averages,
// a straight trend (which encodes +/- seconds/day) remains a straight trend.
// This changes *drawing coordinates only*, not physical measurement results.
export function calmPhasePoints(points,neighborCount=8){
  if(!Array.isArray(points)||!points.length)return [];
  const output=[];
  for(const parity of [0,1]){
    const series=points.filter(p=>p.parity===parity).sort((a,b)=>a.t-b.t);
    if(!series.length)continue;
    for(let k=0;k<series.length;k++){
      const left=Math.max(0,k-neighborCount),right=Math.min(series.length,k+neighborCount+1);
      const window=series.slice(left,right),center=series[k];
      const centerMedian=median(window.map(p=>p.phase));
      const absoluteResidual=window.map(p=>Math.abs(p.phase-centerMedian));
      const spread=median(absoluteResidual)||0;
      const cap=Math.max(.55,3.5*spread);
      // Don't discard true slope by filtering on absolute phase. First detrend
      // locally and downweight residual outliers in a second regression pass.
      function fit(weights){
        let sw=0,sx=0,sy=0,sxx=0,sxy=0;
        for(let j=0;j<window.length;j++){
          const p=window[j],x=(p.t-center.t)/1000,w=weights[j];
          sw+=w;sx+=w*x;sy+=w*p.phase;sxx+=w*x*x;sxy+=w*x*p.phase;
        }
        if(sw<1e-9)return {intercept:center.phase,slope:0};
        const denominator=sw*sxx-sx*sx;
        const slope=Math.abs(denominator)>1e-12?(sw*sxy-sx*sy)/denominator:0;
        return {intercept:(sy-slope*sx)/sw,slope};
      }
      const baseWeights=window.map(p=>Math.exp(-.5*((p.t-center.t)/2100)**2));
      const first=fit(baseWeights);
      const residuals=window.map(p=>Math.abs(p.phase-(first.intercept+first.slope*((p.t-center.t)/1000))));
      const robust= Math.max(.35,2.8*(median(residuals)||0));
      const weights=baseWeights.map((v,j)=>v*Math.min(1,robust/Math.max(residuals[j],1e-8)));
      const final=fit(weights);
      // Do not allow an isolated outlier to move even its smoothed own point.
      output.push({...center,phase:final.intercept});
    }
  }
  return output.sort((a,b)=>a.t-b.t||a.parity-b.parity);
}

export function summarizeTrend(values){
  const valid=values.filter(x=>Number.isFinite(x.rate));
  if(!valid.length)return null;
  const low=median(valid.map(x=>x.rate));
  const halfRange=Math.max(.6,Math.min(8,Math.max(...valid.map(x=>Math.abs(x.rate-low)))*1.35));
  return {center:low,halfRange,values:valid};
}
