// Crowniq Timegrapher V0.4 — display-only stabilization and measurement gating.
// No measured value, BPH candidate or event timing is fed back into analyzer.mjs.
// All durations are expressed in signal-time milliseconds (not wall-clock time).
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const median=arr=>{
  if(!arr.length)return null;
  const a=[...arr].sort((x,y)=>x-y),m=Math.floor(a.length/2);
  return a.length%2?a[m]:(a[m-1]+a[m])/2;
};
const medianAbsDeviation=(arr,m)=>median(arr.map(x=>Math.abs(x-m)))??0;

export const PROFILES=Object.freeze({
  quick:Object.freeze({name:'Schnell',minMs:12000,minPulses:55,historyMs:6500,minSpanMs:3800,maxRateDrift:7,maxBeatDrift:.9,maxRateMad:3.4,maxRms:3.5,tauMs:3600,updateMs:800}),
  balanced:Object.freeze({name:'Ausgewogen',minMs:20000,minPulses:80,historyMs:9500,minSpanMs:5500,maxRateDrift:5,maxBeatDrift:.70,maxRateMad:2.6,maxRms:2.6,tauMs:6500,updateMs:1200}),
  quiet:Object.freeze({name:'Ruhig',minMs:25000,minPulses:100,historyMs:12000,minSpanMs:7500,maxRateDrift:3.5,maxBeatDrift:.60,maxRateMad:2.1,maxRms:2.0,tauMs:11500,updateMs:1800})
});

const blank=(phase='search',message='Suche nach einem regelmäßigen Tick-Signal.',progress=0,remaining=0)=>({
  phase,message,progress,remaining,ready:false,rate:null,beatError:null,rawRate:null,rawBeatError:null
});

export class MeasurementStabilizer{
  constructor(mode='quiet'){this.mode=PROFILES[mode]?mode:'quiet';this.reset();}
  reset(){
    this.bph=null;this.firstBphAt=null;this.samples=[];
    this.displayRate=null;this.displayBeat=null;this.lastDisplayAt=null;
    this.lastSampleAt=null;this.ready=false;
  }
  setMode(mode){
    if(!PROFILES[mode])throw new Error('Unbekannter Messmodus');
    if(this.mode!==mode){this.mode=mode;this.reset();}
  }
  get profile(){return PROFILES[this.mode];}
  update(result,timeMs){
    const cfg=this.profile;
    if(!Number.isFinite(timeMs))return blank();
    const clearSignal=!Number.isFinite(result?.bph)||result.ambiguous||result.quality==='low'||result.quality==='none';
    if(clearSignal){this.reset();return blank();}
    if(result.bph!==this.bph || this.lastSampleAt!==null && (timeMs<this.lastSampleAt||timeMs-this.lastSampleAt>3500)){
      this.reset();this.bph=result.bph;this.firstBphAt=timeMs;
    }
    this.lastSampleAt=timeMs;
    const elapsed=Math.max(0,timeMs);
    const minRemaining=Math.max(0,Math.ceil((cfg.minMs-elapsed)/1000));
    const progress=clamp(elapsed/cfg.minMs,0,1);
    const valid=Number.isFinite(result.rate)&&Number.isFinite(result.beatError)&&result.confidence>=82&&
      (result.rms===null||Number.isFinite(result.rms)&&result.rms<=cfg.maxRms);
    // Exclude acquisition artifacts from the *display* estimator, while the
    // physical estimator and raw tick event times are kept unchanged.
    if(valid&&elapsed>=6000){
      this.samples.push({t:timeMs,rate:result.rate,beatError:result.beatError});
      this.samples=this.samples.filter(s=>timeMs-s.t<=Math.max(25000,cfg.historyMs*2));
    }
    if(elapsed<8000){
      this.ready=false;this.displayRate=null;this.displayBeat=null;this.lastDisplayAt=null;
      return blank('search','Schlagzahl wird geprüft · Messwerte noch gesperrt.',progress,minRemaining);
    }
    if(!valid){
      this.ready=false;this.displayRate=null;this.displayBeat=null;this.lastDisplayAt=null;
      this.samples=[];
      return blank('stabilizing','Signalqualität unzureichend · Werte werden zurückgehalten.',progress,minRemaining);
    }
    if(elapsed<cfg.minMs||result.pulseCount<cfg.minPulses||timeMs-this.firstBphAt<5000){
      this.ready=false;this.displayRate=null;this.displayBeat=null;this.lastDisplayAt=null;
      return blank('warmup',`Einmessphase · noch mindestens ${minRemaining} s`,progress,minRemaining);
    }
    const latest=this.samples.filter(s=>timeMs-s.t<=cfg.historyMs);
    const span=latest.length?latest.at(-1).t-latest[0].t:0;
    if(latest.length<8||span<cfg.minSpanMs){
      this.ready=false;this.displayRate=null;this.displayBeat=null;this.lastDisplayAt=null;
      return blank('stabilizing','Sammle ausreichend aktuelle, verwertbare Messwerte …',progress,0);
    }
    const halfway=latest[0].t+span/2;
    const earlier=latest.filter(s=>s.t<=halfway),later=latest.filter(s=>s.t>halfway);
    if(earlier.length<3||later.length<3)return blank('stabilizing','Prüfe die Gangstabilität …',progress,0);
    const rateValues=latest.map(s=>s.rate),beatValues=latest.map(s=>s.beatError);
    const drift=Math.abs(median(earlier.map(s=>s.rate))-median(later.map(s=>s.rate)));
    const beatDrift=Math.abs(median(earlier.map(s=>s.beatError))-median(later.map(s=>s.beatError)));
    const mad=medianAbsDeviation(rateValues,median(rateValues));
    if(drift>cfg.maxRateDrift||beatDrift>cfg.maxBeatDrift||mad>cfg.maxRateMad){
      this.ready=false;this.displayRate=null;this.displayBeat=null;this.lastDisplayAt=null;
      return blank('stabilizing','Gang oder Abfallfehler schwanken noch · warte auf Stabilität.',progress,0);
    }
    const targetRate=median(rateValues),targetBeat=median(beatValues);
    const dt=this.lastDisplayAt===null?Infinity:timeMs-this.lastDisplayAt;
    if(this.displayRate===null||this.displayBeat===null){
      this.displayRate=targetRate;this.displayBeat=targetBeat;this.lastDisplayAt=timeMs;
    }else if(dt>=cfg.updateMs){
      const gain=1-Math.exp(-dt/cfg.tauMs);
      this.displayRate+=gain*(targetRate-this.displayRate);
      this.displayBeat+=gain*(targetBeat-this.displayBeat);
      this.lastDisplayAt=timeMs;
    }
    this.ready=true;
    return {phase:'stable',message:`Stabil · ${cfg.name.toLowerCase()}e Anzeige (aktualisiert ca. alle ${(cfg.updateMs/1000).toFixed(1).replace('.',',')} s)`,
      progress:1,remaining:0,ready:true,rate:this.displayRate,beatError:this.displayBeat,
      rawRate:result.rate,rawBeatError:result.beatError};
  }
}
