import test from 'node:test';
import assert from 'node:assert/strict';
import {describeMicrophone, microphoneConstraints, listMicrophones} from '../public/tools/timegrapher/microphone.mjs';

test('recognizes explicit device labels but never assumes the default is internal',()=>{
  for(const label of ['TGBC','USB Audio Device','Default - USB PnP Sound Device'])assert.equal(describeMicrophone({label}).microphone_type,'usb');
  for(const label of ['Built-in microphone','Internal microphone','Integriertes Mikrofon'])assert.equal(describeMicrophone({label}).microphone_type,'internal');
  for(const label of ['', 'Default', 'Android audio input', 'Bluetooth headset'])assert.equal(describeMicrophone({label}).microphone_type,'unknown');
});
test('manual fallback overrides labels and snapshots metadata without device IDs',()=>{
  const track={label:'USB microphone',deviceId:'private-id'};
  const result=describeMicrophone(track,'internal');
  track.label='changed';
  assert.deepEqual(result,{microphone_type:'internal',microphone_label:'USB microphone',microphone_detection:'manual'});
  assert.ok(Object.isFrozen(result));
  assert.equal(describeMicrophone({label:''},'usb').microphone_type,'usb');
});
test('explicit device requests use exact constraints; default preserves audio options',()=>{
  assert.deepEqual(microphoneConstraints().audio,{echoCancellation:false,noiseSuppression:false,autoGainControl:false,channelCount:1});
  assert.deepEqual(microphoneConstraints('usb-1').audio.deviceId,{exact:'usb-1'});
});
test('device lists handle unsupported browsers and filter non-input devices',async()=>{
  assert.deepEqual(await listMicrophones({}),[]);
  const input={kind:'audioinput',deviceId:'1',label:'USB'};
  assert.deepEqual(await listMicrophones({enumerateDevices:async()=>[input,{kind:'audiooutput',deviceId:'2'},{kind:'audioinput',deviceId:''}]}),[input]);
});
