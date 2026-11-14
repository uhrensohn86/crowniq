import test from 'node:test';
import assert from 'node:assert/strict';
import {phrases} from '../public/tools/timegrapher/translations.mjs';
import {translate,resolveLanguage} from '../public/tools/timegrapher/localization.mjs';

test('all timegrapher phrases have four languages and preserve interpolation parameters',()=>{
  for(const [source,translations]of Object.entries(phrases)){
    const params=[...source.matchAll(/\{\d+\}/g)].map(m=>m[0]).sort();
    for(const lang of ['de','en','fr','es']){
      assert.ok(translations[lang],`${lang}: ${source}`);
      assert.deepEqual([...translations[lang].matchAll(/\{\d+\}/g)].map(m=>m[0]).sort(),params,`${lang}: ${source}`);
    }
  }
  assert.equal(resolveLanguage('invalid'),'de');
  assert.equal(translate('Messung starten',[],'fr'),'Démarrer la mesure');
  assert.equal(translate('Pegel: {0}',['0.42'],'en'),'Level: 0.42');
  assert.equal(translate('TGBC USB Audio',[],'fr'),'TGBC USB Audio');
});
