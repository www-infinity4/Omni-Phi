'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('code/media-star-skill.js','utf8');
function skills(){
 const window={};vm.runInNewContext(src,{window,URL,URLSearchParams});
 return window.CodePhiMediaStarSkills;
}
test('galaxy without collected media asks for sources rather than fabricating a card',()=>{
 const result=skills().propose({query:'galaxy',collected:[]});
 assert.equal(result.action,'find_and_collect_media_first');
 assert.equal(result.items.length,0);
});
test('real collected galaxy media produces a branded add-media-star proposal',()=>{
 const s=skills(),p=s.propose({query:'galaxy',title:'Fred Galaxy Radio',collected:[
 {url:'https://www.youtube.com/watch?v=dQw4w9WgXcQ',title:'Clip from Galaxy Research'},
 {url:'https://x.com/i/spaces/1OyKAjYPeXqGb',title:'Space from curator'},
 {url:'https://www.youtube.com/watch?v=dQw4w9WgXcQ',title:'duplicate'},
 {url:'javascript:alert(1)',title:'fake'},
 {url:'https://example.com/art.png',title:'Art Reference'}
 ]});
 assert.equal(p.action,'offer_add_media_star');
 assert.equal(p.collectedCount,3);
 assert.equal(p.items[0].embed,'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
 assert.equal(p.items[1].embed,'');
 const html=s.buildHtml(p);
 assert.match(html,/Fred Galaxy Radio/);
 assert.match(html,/Clip from Galaxy Research/);
 assert.match(html,/www.youtube-nocookie.com/);
 assert.match(html,/https:\/\/x.com\/i\/spaces/);
 assert.match(html,/paid unlocks remain disabled/i);
 assert.doesNotMatch(html,/javascript:|script src|authorization:|access[_-]token/i);
});
test('source preview edits keep existing Code Phi site intact',()=>{
 const studio=fs.readFileSync('code/studio-tools.js','utf8');
 const html=fs.readFileSync('code/index.html','utf8');
 assert.match(html,/media-star-skill\.js/);
 assert.match(html,/id="mediaStarAdd"/);
 assert.match(studio,/function addMediaStar\(\)/);
 assert.match(studio,/doc\.querySelector\('main'\)\|\|doc\.body/);
 assert.match(studio,/doc\.documentElement\.outerHTML/);
 assert.match(studio,/existing\.replaceWith\(child\)/);
 assert.match(studio,/original site|original=viewer\.srcdoc/i);
});
