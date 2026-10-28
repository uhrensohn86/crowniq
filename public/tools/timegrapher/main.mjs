import {EnvelopeBuffer, DemoSource} from './analyzer.mjs';
import {calmPhasePoints, summarizeTrend} from './presentation.mjs';
import {MeasurementStabilizer, PROFILES} from './stabilization.mjs';
import {SessionCollector, WARMUP_MS, TOTAL_MS} from './session.mjs';
const $=id=>document.getElementById(id);
const fields=['demoTab','micTab','demoPanel','demoOptions','micOptions','sourceTitle','sourceDescription','positionPicker','demoBph','demoScenario','status','startBtn','startText','startIcon','resetBtn','error','waveform','traceCanvas','traceStatus','traceScale','calmBtn','detailBtn','rateTrend','rawValues','trendHint','signalTag','signalLevel','detected','duration','quality','rms','audioInfo','candidates','reason','confidence','bph','bphHint','rate','beatError','score','scoreBar','stabilityMode','phaseLabel','phaseHint','gateBar','gateRemaining','watchSelect','saveMeasurementBtn','saveStatus','viewWatchLink','selectedPosition','sessionPhase','sessionTimer','sessionBar','sessionHint','finalSummary'];
const els=Object.fromEntries(fields.map(id=>[id,$(id)]));
const buffer=new EnvelopeBuffer(1,20000);
let mode='mic',running=false,timer=null,audioContext=null,stream=null,audioNode=null,gain=null;
let lastAnalysis=null,demonstrator=null,renderId=null,lastUpdate=0;
const stabilizer=new MeasurementStabilizer('quiet');
const session=new SessionCollector();
let traceMode='calm', trendSamples=[], lastTrendSample=-Infinity, displayReadings=null;
const POSITION_NAMES=Object.freeze({
  dial_up:'Zifferblatt oben',dial_down:'Zifferblatt unten',
  crown_up:'Krone oben',crown_down:'Krone unten',
  crown_left:'Krone links',crown_right:'Krone rechts',
});
let chosenPosition=null;
const API='http://[::1]:8788/api';
const requestedWatchId=new URLSearchParams(window.location.search).get('watchId');
let completedMeasurement=null,savedMeasurement=false,knownWatchIds=new Set(),savingMeasurement=false;
const printNum=x=>Number(x).toLocaleString('de-DE');
const printDecimal=(x,d=1)=>Number(x).toFixed(d).replace('.',',');
// Shared numeric clipping helper for the waveform phase-chart coordinates.
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const showError=text=>{els.error.textContent=text;els.error.classList.toggle('hidden',!text);};
function setStatus(label,active=false){els.status.classList.toggle('running',active);els.status.querySelector('span').textContent=label;}
function saveFeedback(message,error=false,success=false){
  els.saveStatus.textContent=message;
  els.saveStatus.classList.toggle('error',error);
  els.saveStatus.classList.toggle('saved',success);
}
function updateSaveControls(){
  els.saveMeasurementBtn.disabled=running||savingMeasurement||savedMeasurement||
    !completedMeasurement||!knownWatchIds.has(els.watchSelect.value);
}
function updatePositionControls(){
  for(const button of document.querySelectorAll('.position-option')){
    const selected=button.dataset.position===chosenPosition;
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-pressed',String(selected));
    button.disabled=running||!!completedMeasurement;
  }
  els.selectedPosition.textContent=chosenPosition?POSITION_NAMES[chosenPosition]:'Noch keine Lage ausgewählt';
}
function updateSessionProgress(){
  const seconds=Math.floor(session.elapsed/1000);
  els.sessionTimer.textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')} / 01:30`;
  els.sessionBar.style.width=`${Math.round(session.progress*100)}%`;
  if(!running&&session.elapsed===0){
    els.sessionPhase.textContent='Bereit für 90 Sekunden';
    els.sessionHint.textContent='30 Sekunden Einmessung, danach 60 Sekunden Auswertung.';
  }else if(session.phase==='warmup'){
    els.sessionPhase.textContent='Einmessung';
    els.sessionHint.textContent=`Noch ${Math.ceil((WARMUP_MS-session.elapsed)/1000)} s bis zur Auswertung · Uhr ruhig halten.`;
  }else if(session.phase==='evaluation'){
    els.sessionPhase.textContent='Auswertung';
    els.sessionHint.textContent=`Noch ${Math.ceil((TOTAL_MS-session.elapsed)/1000)} s · Drei unabhängige Messabschnitte.`;
  }else{
    els.sessionPhase.textContent='Messung abgeschlossen';
    els.sessionHint.textContent='90 Sekunden vollständig; Messergebnis wird geprüft.';
  }
}
function showFinalSummary(message,warning=false){
  els.finalSummary.textContent=message;
  els.finalSummary.classList.remove('hidden');
  els.finalSummary.classList.toggle('warning',warning);
}
async function loadCollectionWatches(){
  try{
    const response=await fetch(`${API}/table/watches?select=id,brand,model`);
    const payload=await response.json();
    if(!response.ok||!Array.isArray(payload.data))throw new Error('Keine Uhrenliste');
    const watches=payload.data.filter(w=>typeof w.id==='string'&&typeof w.brand==='string'&&typeof w.model==='string')
      .sort((a,b)=>`${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`,'de'));
    knownWatchIds=new Set(watches.map(w=>w.id));
    els.watchSelect.replaceChildren(new Option('Uhr auswählen …',''));
    for(const w of watches)els.watchSelect.add(new Option(`${w.brand} · ${w.model}`,w.id));
    els.watchSelect.disabled=watches.length===0;
    if(requestedWatchId&&knownWatchIds.has(requestedWatchId)){
      els.watchSelect.value=requestedWatchId;
      document.querySelector('.crowniq-back').href=`/watches/${encodeURIComponent(requestedWatchId)}`;
      saveFeedback('Diese Uhr ist vorausgewählt. Mikrofonmessung durchführen, beenden und speichern.');
    }else if(watches.length){
      saveFeedback(mode==='demo'?
        'Demo-Signale sind Testdaten und können nicht gespeichert werden. Für echte Messungen auf „Mikrofon“ wechseln.':
        'Mikrofonmessung durchführen, beenden und anschließend die passende Uhr auswählen.');
    }else saveFeedback('Noch keine Uhr in der Sammlung vorhanden.',true);
    updateSaveControls();
  }catch(error){
    els.watchSelect.replaceChildren(new Option('Sammlung nicht erreichbar',''));
    els.watchSelect.disabled=true;
    saveFeedback('Uhren konnten nicht geladen werden. Bitte Crowniq-Server prüfen.',true);
    updateSaveControls();
  }
}
function resetReadings(){
  buffer.reset();session.reset();lastAnalysis=null;stabilizer.reset();displayReadings=null;trendSamples=[];lastTrendSample=-Infinity;
  completedMeasurement=null;savedMeasurement=false;
  els.finalSummary.classList.add('hidden');
  els.viewWatchLink.classList.add('hidden');
  updateSaveControls();
  updatePositionControls();
  updateSessionProgress();
  els.bph.textContent='—';els.bphHint.textContent='Warte auf ein regelmäßiges Tick-Signal.';
  els.confidence.textContent='WARTET';els.rate.textContent='—';els.beatError.textContent='—';
  els.score.textContent='—';els.scoreBar.style.width='0%';els.detected.textContent='—';
  els.duration.textContent='00:00';els.quality.textContent='—';els.signalLevel.textContent='Pegel: —';
  els.signalTag.textContent='KEIN SIGNAL';els.signalTag.classList.remove('on');
  els.traceStatus.textContent='WARTET';els.traceScale.textContent='Abweichung: — ms';
  els.rms.textContent='—';els.candidates.textContent='—';els.reason.textContent='Warte auf ein geeignetes Signal.';
  els.rawValues.textContent='';els.trendHint.textContent='Warte auf eine stabile Messung.';
  els.phaseLabel.textContent='Suche läuft';els.phaseHint.textContent='Messwerte werden nach der Einmessphase freigegeben.';
  els.gateBar.style.width='0%';els.gateRemaining.textContent='—';
  draw();
}
function changeMode(next){
  if(running)stop();mode=next;showError('');resetReadings();
  if(mode==='demo')saveFeedback('Demo-Signale sind Testdaten und können nicht gespeichert werden.');
  else saveFeedback('Lage auswählen und die 90-Sekunden-Messung vollständig abwarten.');
  els.sourceTitle.textContent=mode==='demo'?'Demo-Signal':'Mikrofonmessung';
  els.sourceDescription.textContent=mode==='demo'?'Künstliche Testsignale · keine Speicherung.':'Echte Uhr messen · 90 Sekunden · lokal.';
  els.positionPicker.classList.toggle('hidden',mode!=='mic');
  if(mode==='mic')els.demoPanel.open=false;
  els.demoTab.classList.toggle('active',mode==='demo');els.micTab.classList.toggle('active',mode==='mic');
  els.demoTab.setAttribute('aria-pressed',mode==='demo');els.micTab.setAttribute('aria-pressed',mode==='mic');
  els.demoOptions.classList.toggle('hidden',mode!=='demo');els.micOptions.classList.toggle('hidden',mode!=='mic');
  els.startText.textContent=mode==='demo'?'Demo starten':'Mikrofon starten';
  els.audioInfo.textContent=mode==='demo'?'Virtueller Signalgenerator':'Noch nicht geprüft';
}
function feed(samples){
  if(!running)return;
  const complete=session.add(samples);
  buffer.add(samples);
  const now=performance.now();
  if(now-lastUpdate>400||!lastAnalysis){lastUpdate=now;lastAnalysis=buffer.analyze();updateReadings(lastAnalysis);}
  if(complete||Math.floor(session.elapsed/1000)!==Math.floor((session.elapsed-samples.length)/1000))updateSessionProgress();
  if(complete)void stop({completed:true});
}
function updateReadings(result){
  displayReadings=stabilizer.update(result,buffer.totalBins);
  els.rawValues.textContent=displayReadings.rawRate===null?'':`Rohwerte: ${displayReadings.rawRate>=0?'+':''}${printDecimal(displayReadings.rawRate,1)} s/Tag · ${printDecimal(displayReadings.rawBeatError,2)} ms`;
  els.rawValues.classList.toggle('hidden',traceMode!=='detail'||!displayReadings.ready||displayReadings.rawRate===null);
  const phase=displayReadings.phase;
  els.phaseLabel.textContent=phase==='stable'?'Stabil':phase==='warmup'?'Einmessphase':phase==='stabilizing'?'Stabilisiert sich':'Suche läuft';
  els.phaseHint.textContent=displayReadings.message;
  els.gateBar.style.width=`${Math.round(100*displayReadings.progress)}%`;
  els.gateRemaining.textContent=phase==='stable'?'Freigegeben':displayReadings.remaining>0?`mind. ${displayReadings.remaining} s`:'Qualitätsprüfung';
  if(displayReadings.rate!==null){
    const t=buffer.totalBins,rate=displayReadings.rate;
    if(t-lastTrendSample>=1000){lastTrendSample=t;trendSamples.push({t,rate});trendSamples=trendSamples.filter(p=>t-p.t<=60000);}
    els.trendHint.textContent='Geglätteter Verlauf nach Einmessphase · Rohdaten unverändert';
  }else{trendSamples=[];lastTrendSample=-Infinity;els.trendHint.textContent='Warte auf eine stabile Messung.';}
  els.detected.textContent=printNum(result.events);
  const d=Math.floor(buffer.totalBins/1000);
  els.duration.textContent=`${String(Math.floor(d/60)).padStart(2,'0')}:${String(d%60).padStart(2,'0')}`;
  const tail=buffer.values.slice(-500),vmax=tail.length?Math.max(...tail):0;
  els.signalLevel.textContent=`Pegel: ${vmax.toFixed(4)}`;
  const hasSignal=result.events>0;
  els.signalTag.textContent=hasSignal?'TICK-IMPULSE ERKANNT':'SUCHE NACH TICKS';
  els.signalTag.classList.toggle('on',hasSignal);
  els.reason.textContent=result.reason;
  els.rms.textContent=result.rms===null?'—':`${printDecimal(result.rms,2)} ms`;
  els.candidates.textContent=result.candidates.length>1?result.candidates.slice(1).map(c=>printNum(c.bph)).join(' / '):'—';
  if(result.bph===null){
    els.bph.textContent='—';els.rate.textContent='—';els.beatError.textContent='—';
    els.confidence.textContent='SUCHE LÄUFT';els.bphHint.textContent=hasSignal?'Suche ein stabiles Intervall …':'Noch keine regelmäßigen Tick-Impulse.';
    els.score.textContent='—';els.scoreBar.style.width='0%';els.quality.textContent='Noch nicht bestimmt';
    return;
  }
  els.bph.textContent=printNum(result.bph);
  els.confidence.textContent=displayReadings.phase==='stable'?'STABIL':displayReadings.phase==='warmup'?'EINMESSEN':displayReadings.phase==='stabilizing'?'PRÜFUNG':'SUCHE LÄUFT';
  els.score.textContent=`${result.confidence} %`;
  els.scoreBar.style.width=`${result.confidence}%`;
  els.quality.textContent=result.quality==='high'?'Hoch':result.quality==='medium'?'Mittel':'Niedrig';
  els.bphHint.textContent=`Aus ${result.pulseCount} Hemmungsschlägen automatisch bestimmt`;
  const smoothRate=displayReadings.rate,smoothBeat=displayReadings.beatError;
  els.rate.textContent=smoothRate===null?'—':`${smoothRate>=0?'+':''}${printDecimal(smoothRate,1)}`;
  els.beatError.textContent=smoothBeat===null?'—':printDecimal(smoothBeat,2);
}
function setupCanvas(canvas){
  const rect=canvas.getBoundingClientRect(),w=rect.width,h=rect.height;
  if(w<5||h<5)return null;
  const scale=Math.min(2,window.devicePixelRatio||1);
  const iw=Math.round(w*scale),ih=Math.round(h*scale);
  if(canvas.width!==iw||canvas.height!==ih){canvas.width=iw;canvas.height=ih;}
  const ctx=canvas.getContext('2d');ctx.setTransform(scale,0,0,scale,0,0);ctx.clearRect(0,0,w,h);
  return {ctx,w,h};
}
function drawWaveform(){
  const dims=setupCanvas(els.waveform);if(!dims)return;
  const {ctx,w,h}=dims;
  ctx.lineWidth=1;ctx.strokeStyle='#233950';
  for(let i=1;i<5;i++){const y=h*i/5;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
  const data=buffer.values.slice(-2000);
  if(!data.length){ctx.fillStyle='#69829a';ctx.textAlign='center';ctx.font='13px system-ui';ctx.fillText('Noch kein Signal',w/2,h/2+4);return;}
  let maximum=0;for(const p of data)maximum=Math.max(maximum,p);
  maximum=Math.max(maximum,.005);
  const step=Math.max(1,Math.floor(data.length/w));
  ctx.strokeStyle='#5cdeba';ctx.lineWidth=1.4;ctx.lineJoin='round';ctx.beginPath();
  let begun=false;
  for(let i=0;i<data.length;i+=step){
    const normalized=Math.min(1,data[i]/maximum),x=w*(i/2000),y=h-11-normalized*(h-25);
    if(!begun){ctx.moveTo(x,y);begun=true;}else ctx.lineTo(x,y);
  }
  ctx.stroke();
}
function drawTraces(){
  const dims=setupCanvas(els.traceCanvas);if(!dims)return;
  const {ctx,w,h}=dims;
  const pad={l:40,r:12,t:16,b:27},plotW=w-pad.l-pad.r,plotH=h-pad.t-pad.b;
  ctx.strokeStyle='#233950';ctx.lineWidth=1;
  for(let i=0;i<=4;i++){
    const y=pad.t+plotH*i/4;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();
  }
  const result=lastAnalysis;
  if(!result?.phasePoints?.length){
    els.traceStatus.textContent='SUCHE LÄUFT';els.traceScale.textContent='Abweichung: — ms';
    ctx.fillStyle='#8da3b7';ctx.font='13px system-ui';ctx.textAlign='center';
    ctx.fillText('Warte auf stabile Schlagzahl',pad.l+plotW/2,pad.t+plotH/2);
    return;
  }
  const points=result.phasePoints;
  const drawnPoints=traceMode==='calm'?calmPhasePoints(points):points;
  const absPhases=drawnPoints.map(p=>Math.abs(p.phase)).sort((a,b)=>a-b);
  const p95=absPhases[Math.floor((absPhases.length-1)*.95)]??0;
  const halfRange=Math.max(2,Math.min(40,Math.ceil(p95*(traceMode==='calm'?1.65:1.35))));
  const begin=Math.max(0,result.duration-18000),end=result.duration||1;
  const x=t=>pad.l+clamp((t-begin)/(end-begin),0,1)*plotW;
  const y=phase=>pad.t+plotH/2-clamp(phase/halfRange,-1,1)*(plotH/2);
  ctx.font='11px system-ui';ctx.textAlign='right';ctx.fillStyle='#8da3b7';
  for(const a of [-halfRange,0,halfRange])ctx.fillText(`${a>0?'+':''}${a}`,pad.l-7,y(a)+4);
  ctx.textAlign='center';ctx.fillText('−18 s',pad.l+15,h-8);ctx.fillText('jetzt',w-pad.r-18,h-8);
  const colors=['#5cdeba','#dfae6a'];
  for(const parity of [0,1]){
    const segment=drawnPoints.filter(p=>p.parity===parity&&p.t>=begin);
    ctx.strokeStyle=colors[parity];ctx.lineWidth=traceMode==='calm'?2.25:1.25;ctx.globalAlpha=traceMode==='calm'?.92:.7;
    ctx.beginPath();let prev=null;
    for(const p of segment){
      if(!prev||p.n-prev.n>4)ctx.moveTo(x(p.t),y(p.phase));
      else ctx.lineTo(x(p.t),y(p.phase));
      prev=p;
    }
    ctx.stroke();ctx.globalAlpha=1;
    if(traceMode==='detail'){
      ctx.fillStyle=colors[parity];
      for(const p of segment){ctx.beginPath();ctx.arc(x(p.t),y(p.phase),1.8,0,Math.PI*2);ctx.fill();}
    }
  }
  els.traceStatus.textContent=traceMode==='calm'?`RUHIG · ${points.length} TICKS`:`ROH · ${points.length} PUNKTE`;
  els.traceScale.textContent=`Vertikal: ±${halfRange} ms`;
}
function drawRateTrend(){
  const dims=setupCanvas(els.rateTrend);if(!dims)return;
  const {ctx,w,h}=dims,pad={l:12,r:12,t:14,b:13};
  const summary=summarizeTrend(trendSamples);
  if(!summary||summary.values.length<2){
    ctx.fillStyle='#70869a';ctx.font='12px system-ui';ctx.textAlign='center';
    ctx.fillText('Trend nach stabiler Messung sichtbar',w/2,h/2+4);return;
  }
  const {center,halfRange,values}=summary;
  const pW=w-pad.l-pad.r,pH=h-pad.t-pad.b;
  const y=v=>pad.t+(center+halfRange-v)/(2*halfRange)*pH;
  const now=buffer.totalBins,start=Math.max(trendSamples[0]?.t??0,now-60000);
  const x=t=>pad.l+clamp((t-start)/Math.max(now-start,1),0,1)*pW;
  ctx.strokeStyle='#344357';ctx.lineWidth=1;
  for(const dv of [-halfRange/2,0,halfRange/2]){
    const gy=y(center+dv);ctx.beginPath();ctx.moveTo(pad.l,gy);ctx.lineTo(w-pad.r,gy);ctx.stroke();
  }
  ctx.strokeStyle='#e8b374';ctx.lineWidth=2.5;ctx.lineCap='round';ctx.lineJoin='round';
  ctx.beginPath();values.forEach((p,i)=>i?ctx.lineTo(x(p.t),y(p.rate)):ctx.moveTo(x(p.t),y(p.rate)));
  ctx.stroke();
  const latest=values[values.length-1];ctx.fillStyle='#e8b374';ctx.beginPath();ctx.arc(x(latest.t),y(latest.rate),3,0,Math.PI*2);ctx.fill();
}
function setTraceMode(next){
  traceMode=next==='detail'?'detail':'calm';
  els.calmBtn.classList.toggle('active',traceMode==='calm');els.detailBtn.classList.toggle('active',traceMode==='detail');
  els.calmBtn.setAttribute('aria-pressed',traceMode==='calm');els.detailBtn.setAttribute('aria-pressed',traceMode==='detail');
  els.rawValues.classList.toggle('hidden',traceMode!=='detail'||!displayReadings?.ready||displayReadings.rawRate===null);
  $('traceInfo').textContent=traceMode==='calm'?
    'Ruhige Ansicht: Die Messspuren A/B werden ausschließlich für die Darstellung robust geglättet. Die Rohdaten und Messberechnungen bleiben unverändert.':
    'Detailansicht: Alle erkannten Schlagzeitpunkte A/B werden ungefiltert dargestellt. Einzelne Ausreißer und Störimpulse sind sichtbar.';
  drawTraces();
}
function draw(){drawWaveform();drawTraces();drawRateTrend();}
function animation(){if(!running)return;draw();renderId=setTimeout(animation,250);}
function createDemo(){
  const variant=els.demoScenario.value;
  const variants={normal:{rate:8,beatError:.4},fast:{rate:35,beatError:.8},
    slow:{rate:-30,beatError:.4},noisy:{rate:8,beatError:.4,noise:.04,spurious:6},
    dropout:{rate:8,beatError:.4,dropout:.20},chaos:{rate:8,beatError:.4,noise:.10,spurious:15,dropout:.15}};
  const {rate,beatError,...opts}=variants[variant]||variants.normal;
  demonstrator=new DemoSource(Number(els.demoBph.value),rate,beatError,75321,opts);
}
async function startMicrophone(){
  if(!window.isSecureContext)throw new Error('Lokale Adresse wird nicht als sicherer Kontext erkannt. http://[::1]:3000/tools/timegrapher/ öffnen.');
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('Mikrofon-API fehlt in diesem Browser. Firefox oder Chrome verwenden.');
  stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false,channelCount:1},video:false});
  const Context=window.AudioContext||window.webkitAudioContext;
  if(!Context)throw new Error('Web Audio API nicht verfügbar.');
  audioContext=new Context({latencyHint:'interactive'});
  await audioContext.resume();
  const input=audioContext.createMediaStreamSource(stream);
  gain=audioContext.createGain();gain.gain.value=0;
  if(audioContext.audioWorklet&&window.AudioWorkletNode){
    await audioContext.audioWorklet.addModule('./audio-processor.js');
    audioNode=new AudioWorkletNode(audioContext,'crowniq-envelope');
    audioNode.port.onmessage=e=>{if(Array.isArray(e.data))feed(e.data);};
    input.connect(audioNode);audioNode.connect(gain);gain.connect(audioContext.destination);
    els.audioInfo.textContent=`AudioWorklet · ${printNum(audioContext.sampleRate)} Hz`;
  }else{
    let energy=0,samples=0,last=0;
    const blockSize=audioContext.sampleRate/1000;
    audioNode=audioContext.createScriptProcessor(1024,1,1);
    audioNode.onaudioprocess=e=>{
      const inp=e.inputBuffer.getChannelData(0),out=e.outputBuffer.getChannelData(0),arr=[];
      out.fill(0);
      for(let i=0;i<inp.length;i++){
        const diff=inp[i]-last*.985;last=inp[i];energy+=diff*diff;samples++;
        if(samples>=blockSize){arr.push(Math.sqrt(energy/samples));energy=0;samples=0;}
      }
      feed(arr);
    };
    input.connect(audioNode);audioNode.connect(gain);gain.connect(audioContext.destination);
    els.audioInfo.textContent=`Audio-Fallback · ${printNum(audioContext.sampleRate)} Hz`;
  }
}
async function start(){
  if(running)return stop();
  if(session.phase==='complete'){
    resetReadings();
    setStatus('Bereit');
    els.startText.textContent=mode==='demo'?'Demo starten':'Mikrofon starten';
    els.startIcon.textContent='▶';
    saveFeedback('Neue Messung bereit. Bei Bedarf eine andere Lage wählen.');
    return;
  }
  if(mode==='mic'&&!chosenPosition){
    showError('Bitte zuerst die Messposition der Uhr auswählen.');
    return;
  }
  showError('');resetReadings();running=true;lastUpdate=0;
  updatePositionControls();
  updateSaveControls();
  updateSessionProgress();
  setStatus('Wird gestartet …');els.startBtn.disabled=true;
  try{
    if(mode==='demo'){
      createDemo();timer=setInterval(()=>feed(demonstrator.take(50,1)),50);
      els.audioInfo.textContent='Virtueller Signalgenerator · 1 ms';
    }else await startMicrophone();
    setStatus(mode==='demo'?'Demo läuft':'Mikrofon aktiv',true);
    els.startText.textContent='Messung beenden';els.startIcon.textContent='■';animation();
  }catch(error){
    console.error('Timegrapher start:',error);
    showError(error.name==='NotAllowedError'?'Mikrofonzugriff abgelehnt. Browserberechtigung prüfen.':`Mikrofonstart fehlgeschlagen: ${error.message}`);
    await stop();
  }finally{els.startBtn.disabled=false;}
}
async function stop({completed=false}={}){
  const hadMeasurement=running;
  if(hadMeasurement&&completed){
    const result=session.evaluate();
    if(result.ok){
      els.bph.textContent=printNum(result.bph);
      els.rate.textContent=`${result.rate>=0?'+':''}${printDecimal(result.rate,1)}`;
      els.beatError.textContent=printDecimal(result.beatError,2);
      els.confidence.textContent=result.quality==='high'?'STABIL':'AUSGEWERTET';
      els.quality.textContent=result.quality==='high'?'Hoch':'Mittel';
      els.score.textContent=`${result.confidence} %`;
      els.scoreBar.style.width=`${result.confidence}%`;
      els.phaseLabel.textContent='90 Sekunden abgeschlossen';
      els.phaseHint.textContent='Der Endwert stammt aus getrennten Abschnitten, nicht aus dem letzten Live-Wert.';
      els.gateRemaining.textContent='Freigegeben';
      els.gateBar.style.width='100%';
      showFinalSummary(`Gesamtergebnis aus ${result.accepted} von 3 Messabschnitten\nGangabweichung: ${result.rate>=0?'+':''}${printDecimal(result.rate,1)} s/Tag · Spannweite: ${printDecimal(result.rateSpread,1)} s/Tag\nAbfallfehler: ${printDecimal(result.beatError,2)} ms · Spannweite: ${printDecimal(result.beatSpread,2)} ms\nLage: ${POSITION_NAMES[chosenPosition]||'Nicht festgelegt'}`);
      if(mode==='mic'){
        completedMeasurement={
          recorded_at:new Date().toISOString(),source:'crowniq',
          rate_s_per_day:result.rate,beat_error_ms:result.beatError,bph:result.bph,
          confidence_pct:result.confidence,quality:result.quality,
          duration_s:90,rate_spread_s_per_day:result.rateSpread,
          beat_spread_ms:result.beatSpread,position:chosenPosition,
        };
        saveFeedback('90 Sekunden erfolgreich ausgewertet. Uhr auswählen und Ergebnis speichern.');
      }else{
        saveFeedback('Demomessung beendet. Demo-Ergebnisse werden nicht in die Sammlung übernommen.');
      }
      els.sessionHint.textContent='Auswertung erfolgreich abgeschlossen. Das Endergebnis ist freigegeben.';
    }else{
      showFinalSummary(`Messung nicht freigegeben: ${result.reason}\nBitte Signal oder Lage prüfen und erneut 90 Sekunden messen.`,true);
      saveFeedback('Kein ausreichend zuverlässiges Ergebnis – Speichern gesperrt.',true);
      els.sessionHint.textContent='Auswertung beendet, aber die Messabschnitte waren nicht ausreichend zuverlässig.';
    }
  }else if(hadMeasurement){
    saveFeedback('Messung vorzeitig beendet. Für ein speicherbares Ergebnis sind alle 90 Sekunden erforderlich.',true);
  }
  running=false;
  updateSaveControls();
  updatePositionControls();
  if(timer!==null){clearInterval(timer);timer=null;}
  if(renderId!==null){clearTimeout(renderId);renderId=null;}
  if(audioNode){try{audioNode.disconnect();}catch{}audioNode=null;}
  if(gain){try{gain.disconnect();}catch{}gain=null;}
  if(stream){for(const track of stream.getTracks())track.stop();stream=null;}
  if(audioContext){const context=audioContext;audioContext=null;try{await context.close();}catch{}}
  setStatus(completed?'Abgeschlossen':'Bereit');
  els.startText.textContent=completed?'Neue Messung':mode==='demo'?'Demo starten':'Mikrofon starten';
  els.startIcon.textContent='▶';
}
async function saveMeasurement(){
  const watchId=els.watchSelect.value;
  if(savingMeasurement||savedMeasurement||running||!completedMeasurement||!knownWatchIds.has(watchId))return;
  savingMeasurement=true;updateSaveControls();
  try{
    const response=await fetch(`${API}/table/watch_timegrapher_measurements`,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({...completedMeasurement,watch_id:watchId,user_id:'local-user'}),
    });
    const payload=await response.json();
    if(!response.ok||payload.error)throw new Error(payload.error?.message||'Speichern fehlgeschlagen');
    savedMeasurement=true;
    els.viewWatchLink.href=`/watches/${encodeURIComponent(watchId)}`;
    els.viewWatchLink.classList.remove('hidden');
    saveFeedback('Messung erfolgreich bei der ausgewählten Uhr gespeichert.',false,true);
  }catch(error){
    saveFeedback(`Speichern fehlgeschlagen: ${error.message}`,true);
  }finally{savingMeasurement=false;updateSaveControls();}
}
async function restartDemo(){if(mode!=='demo')return;if(running){await stop();await start();}else resetReadings();}
els.stabilityMode.addEventListener('change',e=>{
  stabilizer.setMode(e.target.value);
  displayReadings=null;trendSamples=[];lastTrendSample=-Infinity;
  if(lastAnalysis)updateReadings(lastAnalysis);else resetReadings();
  drawRateTrend();
});
els.calmBtn.addEventListener('click',()=>setTraceMode('calm'));
els.detailBtn.addEventListener('click',()=>setTraceMode('detail'));
els.demoTab.addEventListener('click',()=>changeMode('demo'));
els.micTab.addEventListener('click',()=>changeMode('mic'));
els.startBtn.addEventListener('click',start);
els.resetBtn.addEventListener('click',async()=>{await stop();resetReadings();showError('');});
for(const button of document.querySelectorAll('.position-option')){
  button.addEventListener('click',()=>{
    if(running||completedMeasurement)return;
    chosenPosition=button.dataset.position;
    updatePositionControls();
  });
}
els.watchSelect.addEventListener('change',updateSaveControls);
els.saveMeasurementBtn.addEventListener('click',saveMeasurement);
els.demoBph.addEventListener('change',restartDemo);
els.demoScenario.addEventListener('change',restartDemo);
window.addEventListener('pagehide',()=>{stop();});
window.addEventListener('resize',draw);
changeMode('mic');
setTraceMode('calm');
els.stabilityMode.value=stabilizer.mode;
loadCollectionWatches();
