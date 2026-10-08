'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function load(name,context={}){
 const scope={window:{},URL,console,...context};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,name),'utf8'),scope,{filename:name});
 return scope.window;
}
test('site video sources whitelist provider and support real playlists',()=>{
 const site=load('site-experience.js').CodePhiSiteExperience;
 assert.match(site.mediaSource('https://www.youtube.com/watch?v=dQw4w9WgXcQ').embed,/youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
 assert.match(site.mediaSource('https://www.youtube.com/playlist?list=PLabcdefghijklmnopqrstu123').embed,/videoseries/);
 assert.equal(site.mediaSource('https://x.com/i/spaces/1OyKAjYPeXqGb'),null);
 assert.equal(site.mediaSource('javascript:alert(1)'),null);
});
test('design varies by active Quant and media without publishing unrelated history',()=>{
 const site=load('site-experience.js').CodePhiSiteExperience;
 const a=site.themeFor('Albert Pujols baseball', 'quant-a',{counts:{images:4}});
 const b=site.themeFor('Pink Floyd piano', 'quant-b',{counts:{audio:6}});
 assert.equal(a.focus,'visual');
 assert.equal(b.focus,'listening');
 assert.ok(a.palette.length===3);
});
test('past Quant history is weaker than current topic and only orientation returned',()=>{
 const history=JSON.stringify([{query:'piano music soundtrack'},{query:'music concert'}]);
 const localStorage={getItem:k=>k==='quantaPhiBuildHistoryV1'?history:null};
 const profile=load('quant-personalizer.js',{localStorage}).CodePhiQuantPersonalizer.score('Albert Pujols baseball',{images:[{title:'Cardinals player photo'}]});
 assert.equal(profile.category,'sports');
 assert.ok(!Object.hasOwn(profile,'rawHistory'));
 assert.ok(profile.historySignals>0);
});
test('overview prose yields multiple short paragraphs and keeps full text',()=>{
 const overview=load('../overview/overview-polish.js').OmniOverviewPolish;
 const x=('A historical subject has many facts that can be verified in sources. ').repeat(20);
 const rendered=overview.render(x);
 assert.match(rendered,/<details class="omni-overview-more">/);
 assert.ok(overview.textChunks(x).length>2);
 assert.ok(!overview.image('javascript:alert(1)'));
});
