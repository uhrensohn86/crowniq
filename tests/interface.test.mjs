import test from 'node:test';
import assert from 'node:assert/strict';
import {positionForView,readPreference} from '../public/tools/timegrapher/interface.mjs';
test('quick view forces dial up; expert view retains its own selected position',()=>{
  assert.equal(positionForView('quick','crown_left'),'dial_up');
  assert.equal(positionForView('expert','crown_left'),'crown_left');
  assert.equal(positionForView('expert',null),null);
});
test('unavailable storage and invalid preferences safely fall back',()=>{
  const choices=['auto','usb'];
  assert.equal(readPreference(null,'key',choices,'auto'),'auto');
  assert.equal(readPreference({getItem(){throw new Error('blocked');}},'key',choices,'auto'),'auto');
  assert.equal(readPreference({getItem:()=> 'unsupported'},'key',choices,'auto'),'auto');
  assert.equal(readPreference({getItem:()=> 'usb'},'key',choices,'auto'),'usb');
});
