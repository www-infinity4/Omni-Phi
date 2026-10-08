'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function load(){
 const sandbox={window:{},URL,DOMParser:undefined,console,setTimeout,clearTimeout};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'podcast-widget.js'),'utf8'),sandbox);
 return sandbox.window.CodePhiPodcast;
}
test('creator-defined price, first free and persisted Quant context',()=>{
 const api=load();
 const payload=api.normalize({title:'Fred Spaces',sourceUrl:'https://x.com/i/spaces/1OyKAjYPeXqGb',episodeTitle:'Bitcoin and Coffee',priceStarCoins:3,query:'bitcoin silver',tokenId:'quant-xyz'});
 const html=api.apply('<!doctype html><html><body><main><h1>My site</h1></main></body></html>',payload);
 assert.match(html,/FIRST EPISODE FREE/);
 assert.match(html,/3 full StarCoins/);
 assert.match(html,/bitcoin silver/);
 assert.match(html,/quant-xyz/);
 assert.match(html,/https:\/\/x.com\/i\/spaces\//);
 assert.match(html,/disabled/);
 assert.doesNotMatch(html,/<audio/i);
 assert.equal(api.audit(html).ok,true);
 assert.equal(api.apply(html,payload).match(/CODEPHI_PODCAST_START/g).length,1);
});
test('unsafe URLs and invalid pricing never create playable/purchasable HTML',()=>{
 const api=load();
 assert.throws(()=>api.normalize({sourceUrl:'javascript:alert(1)'}));
 assert.throws(()=>api.normalize({sourceUrl:'http://example.com',priceStarCoins:1}));
 assert.throws(()=>api.normalize({sourceUrl:'https://example.com',priceStarCoins:-1}));
 assert.throws(()=>api.normalize({sourceUrl:'https://example.com',priceStarCoins:1.5}));
 const c=api.normalize({sourceUrl:'https://x.com/i/spaces/TEST',episodes:[{sourceUrl:'https://x.com/i/spaces/TEST',audioUrl:'https://cdn.example.com/show.mp3',authorizedAudio:false}]});
 assert.doesNotMatch(api.render(c),/<audio/i);
});
test('cross-platform source classification is explicit and conservative',()=>{
 const api=load();
 assert.equal(api.classify('https://x.com/i/spaces/ABCD'),'X Spaces');
 assert.equal(api.classify('https://open.spotify.com/episode/ABCD'),'Spotify');
 assert.equal(api.classify('https://example.org/feed.xml'),'RSS');
});
