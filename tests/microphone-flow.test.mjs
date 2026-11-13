import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DemoSource} from '../public/tools/timegrapher/analyzer.mjs';

test('capture integration: permission probe, 90s result payload, manual fallback, unplug and denial',async()=>{
  class Element {
    value='';textContent='';disabled=false;style={};dataset={};handlers={};
    classList={add(){},remove(){},toggle(){}};
    addEventListener(name,fn){this.handlers[name]=fn;}
    async fire(name){await this.handlers[name]?.({target:this});}
    setAttribute(){} querySelector(){return this;} getBoundingClientRect(){return {width:0,height:0};}
    replaceChildren(...items){this.options=items;this.value=items[0]?.value||'';}
    add(item){this.options.push(item);}
  }
  const html=readFileSync(new URL('../public/tools/timegrapher/index.html',import.meta.url),'utf8');
  const elements=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()]));
  elements.microphoneType.value='auto';
  const position=new Element();position.dataset.position='dial_up';
  globalThis.document={getElementById:id=>elements[id],querySelector:()=>new Element(),querySelectorAll:()=>[position]};
  globalThis.Option=class {constructor(text,value){this.text=text;this.value=value;}};
  let track,node,saved,constraints,denied=false,label='TGBC USB Audio';
  const media={
    addEventListener(){},
    enumerateDevices:async()=>[{kind:'audioinput',deviceId:'usb1',label:'TGBC USB Audio'}],
    getUserMedia:async c=>{
      constraints=c;
      if(denied)throw Object.assign(new Error('denied'),{name:'NotAllowedError'});
      track={label,readyState:'live',stop(){this.readyState='ended';},addEventListener(name,fn){this[name]=fn;}};
      return {getAudioTracks:()=>[track],getTracks:()=>[track]};
    },
  };
  Object.defineProperty(globalThis,'navigator',{value:{mediaDevices:media},configurable:true});
  class AudioContext {
    sampleRate=48000;audioWorklet={addModule:async()=>{}};
    async resume(){} async close(){} createMediaStreamSource(){return {connect(){}};}
    createGain(){return {gain:{},connect(){},disconnect(){}};}
  }
  globalThis.AudioWorkletNode=class {port={};constructor(){node=this;}connect(){}disconnect(){}};
  globalThis.window={location:{search:'?watchId=w'},isSecureContext:true,AudioContext,AudioWorkletNode:globalThis.AudioWorkletNode,addEventListener(){}};
  globalThis.fetch=async(url,options)=>{
    if(options?.method==='POST'){saved=JSON.parse(options.body);return {ok:true,json:async()=>({data:[saved]})};}
    return {ok:true,json:async()=>({data:[{id:'w',brand:'Test',model:'Synthetic'}]})};
  };
  await import('../public/tools/timegrapher/main.mjs');
  await new Promise(resolve=>setImmediate(resolve));
  await elements.refreshMicrophones.fire('click');
  assert.equal(track.readyState,'ended');
  await position.fire('click');elements.microphoneDevice.value='usb1';
  await elements.startBtn.fire('click');
  assert.deepEqual(constraints.audio.deviceId,{exact:'usb1'});
  assert.equal(elements.microphoneType.disabled,true);
  const demo=new DemoSource(21600,8,.4,75321,{});
  for(let i=0;i<1800;i++)node.port.onmessage({data:demo.take(50,1)});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(elements.saveMeasurementBtn.disabled,false);
  await elements.saveMeasurementBtn.fire('click');
  assert.equal(saved.microphone_type,'usb');assert.equal(saved.microphone_label,'TGBC USB Audio');
  assert.equal(saved.microphone_detection,'label');assert.equal(saved.duration_s,90);
  assert.equal(saved.source,'crowniq');assert.equal('deviceId' in saved,false);
  await elements.resetBtn.fire('click');label='';elements.microphoneType.value='usb';
  await elements.startBtn.fire('click');
  assert.match(elements.microphoneStatus.textContent,/manuell zugeordnet/);
  track.ended();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(elements.saveMeasurementBtn.disabled,true);assert.match(elements.error.textContent,/getrennt/);
  await elements.resetBtn.fire('click');denied=true;
  const originalError=console.error;console.error=()=>{};
  try{await elements.startBtn.fire('click');}finally{console.error=originalError;}
  assert.match(elements.error.textContent,/abgelehnt/);
  assert.equal(elements.microphoneType.disabled,false);assert.equal(elements.saveMeasurementBtn.disabled,true);
});
