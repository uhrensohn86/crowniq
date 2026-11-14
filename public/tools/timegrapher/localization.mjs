import {phrases} from './translations.mjs';
const languages=['de','en','fr','es'];
export function resolveLanguage(value){return languages.includes(value)?value:'de';}
function initialLanguage(){
  try {
    const explicit=new URLSearchParams(globalThis.window?.location?.search||'').get('lang');
    return resolveLanguage(explicit||globalThis.window?.localStorage?.getItem('crowniq-lang')||globalThis.navigator?.language?.slice(0,2));
  }catch{return 'de';}
}
export const language=initialLanguage();
export function translate(source,values=[],lang=language){
  const raw=phrases[source]?.[resolveLanguage(lang)]??source;
  return raw.replace(/\{(\d+)\}/g,(match,i)=>i in values?String(values[i]):match);
}
export function tr(source,...values){
  return translate(source,values.map(value=>typeof value==='string'?translate(value):value));
}
const patterns=Object.keys(phrases).filter(key=>key.includes('{0}')).map(key=>({key,
  regex:new RegExp('^'+key.split(/\{\d+\}/).map(part=>part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('(.*?)')+'$','s'),
}));
// Translate detector diagnostics at the display boundary; detector output is untouched.
export function diagnostic(source){
  if(phrases[source])return tr(source);
  for(const {key,regex} of patterns){const match=regex.exec(source);if(match)return tr(key,...match.slice(1));}
  return source;
}
export function localizeDocument(doc=globalThis.document){
  if(!doc?.createTreeWalker)return;
  doc.documentElement.lang=language;
  const walker=doc.createTreeWalker(doc.documentElement,4);
  const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
  for(const node of nodes){
    if(node.parentElement?.closest('script,style'))continue;
    const source=node.textContent.trim();
    if(phrases[source])node.textContent=node.textContent.replace(source,tr(source));
  }
  for(const el of doc.querySelectorAll('[aria-label],[title],[placeholder]')){
    for(const name of ['aria-label','title','placeholder']){
      const source=el.getAttribute(name);if(source&&phrases[source])el.setAttribute(name,tr(source));
    }
  }
}
