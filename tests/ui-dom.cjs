// Optional component tests: npm install --no-save --package-lock=false jsdom
// Or CROWNIQ_UI_TEST_MODULES=/path/to/test/node_modules node tests/ui-dom.cjs
const assert = require('node:assert/strict');
const {mkdtempSync, rmSync} = require('node:fs');
const {tmpdir} = require('node:os');
const path = require('node:path');
const {JSDOM} = require(process.env.CROWNIQ_UI_TEST_MODULES ? path.join(process.env.CROWNIQ_UI_TEST_MODULES,'jsdom') : 'jsdom');
const esbuild = require('esbuild');
const temp = mkdtempSync(path.join(tmpdir(),'crowniq-ui-unit-'));
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'http://localhost/'});
for(const key of ['window','document','HTMLElement','HTMLInputElement','Element','Node','NodeFilter','MutationObserver','Event','KeyboardEvent','MouseEvent','CustomEvent','getComputedStyle'])global[key]=dom.window[key];
Object.defineProperty(global,'navigator',{value:dom.window.navigator,configurable:true});
global.IS_REACT_ACT_ENVIRONMENT=true;
global.requestAnimationFrame=fn=>setTimeout(fn,0);
global.cancelAnimationFrame=clearTimeout;
(async()=>{
 await esbuild.build({stdin:{contents:`export {createElement,act} from 'react';export {createRoot} from 'react-dom/client';export {WatchGallery} from './src/components/WatchGallery';export {I18nProvider} from './src/lib/i18n';export {ThemeProvider,useTheme} from './src/lib/theme';`,resolveDir:path.resolve(__dirname,'..'),loader:'tsx'},bundle:true,platform:'node',format:'cjs',outfile:path.join(temp,'components.cjs'),jsx:'automatic'});
 const {createElement:h,act,createRoot,WatchGallery,I18nProvider,ThemeProvider,useTheme}=require(path.join(temp,'components.cjs'));
 const root=createRoot(document.querySelector('#root'));
 const flush=()=>new Promise(resolve=>setTimeout(resolve,5));
 const renderGallery=async paths=>{await act(async()=>{root.render(h(I18nProvider,null,h(WatchGallery,{paths,title:'Synthetic watch'})));await flush();});};
 const click=async element=>{assert.ok(element);await act(async()=>{element.click();await flush();});};
 const button=label=>document.querySelector(`[aria-label="${label}"]`);
 await renderGallery(['a.jpg','b.jpg','c.jpg','a.jpg']);
 // Open the tapped thumbnail rather than resetting to the first image.
 const opener=button('Open image 2'); await click(opener);
 assert.ok(document.querySelector('[role="dialog"]'));
 assert.match(document.querySelector('[aria-live="polite"]').textContent,/2 \/ 3/);
 await click(button('Next image'));
 assert.match(document.querySelector('[aria-live="polite"]').textContent,/3 \/ 3/);
 await click(button('Next image'));
 assert.match(document.querySelector('[aria-live="polite"]').textContent,/1 \/ 3/);
 await act(async()=>{document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));await flush();});
 assert.match(document.querySelector('[aria-live="polite"]').textContent,/3 \/ 3/);
 const imageArea=document.querySelector('[role="dialog"] .relative');
 const touch=(type,props)=>{const e=new Event(type,{bubbles:true});for(const [key,value] of Object.entries(props))Object.defineProperty(e,key,{value});imageArea.dispatchEvent(e);};
 await act(async()=>{touch('touchstart',{touches:[{clientX:200,clientY:100}]});touch('touchend',{changedTouches:[{clientX:80,clientY:105}]});await flush();});
 assert.match(document.querySelector('[aria-live="polite"]').textContent,/1 \/ 3/);
 // A pinch gesture must not navigate.
 await act(async()=>{touch('touchstart',{touches:[{clientX:200,clientY:100}]});touch('touchmove',{touches:[{},{}]});touch('touchend',{changedTouches:[{clientX:80,clientY:105}]});await flush();});
 assert.match(document.querySelector('[aria-live="polite"]').textContent,/1 \/ 3/);
 await act(async()=>{document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await flush();});
 assert.equal(document.querySelector('[role="dialog"]'),null);
 assert.equal(document.activeElement,opener);
 await renderGallery(['only.jpg']);await click(button('Open image 1'));
 assert.equal(button('Next image'),null);assert.equal(button('Previous image'),null);
 await click(button('Close'));
 await renderGallery([]);assert.equal(button('Open image 1').disabled,true);
 function ThemeProbe(){const {theme,toggleTheme}=useTheme();return h('button',{id:'theme',onClick:toggleTheme},theme);}
 window.localStorage.setItem('crowniq-theme','oled');
 await act(async()=>{root.render(h(ThemeProvider,null,h(ThemeProbe)));await flush();});
 assert.equal(document.querySelector('#theme').textContent,'oled');
 assert.equal(window.localStorage.getItem('crowniq-theme'),'oled');
 await click(document.querySelector('#theme'));assert.equal(window.localStorage.getItem('crowniq-theme'),'ivory');
 await click(document.querySelector('#theme'));assert.equal(window.localStorage.getItem('crowniq-theme'),'graphite');
 await act(async()=>root.unmount());
 console.log('PASS: gallery thumbnail, arrows, wraparound, keyboard, swipe, pinch exclusion, Escape/focus restoration, single/empty gallery; saved theme hydration and toggle.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{dom.window.close();rmSync(temp,{recursive:true,force:true});process.exit(process.exitCode || 0);});
