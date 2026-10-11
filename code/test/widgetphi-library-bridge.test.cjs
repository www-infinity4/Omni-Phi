'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('code/widgetphi-library-bridge.js','utf8');
function library(){const window={};vm.runInNewContext(src,{window,URL,AbortSignal,encodeURIComponent});return window.CodePhiWidgetLibrary}
test('Code Phi can create an existing functional market ticker from explicit symbols',()=>{
 const html=library().tickerHTML('NASDAQ:AAPL, NASDAQ:MSFT','My Stock Watch');
 assert.match(html,/data-codephi-widgetphi-card="market-ticker"/);
 assert.match(html,/s3.tradingview.com\/external-embedding\/embed-widget-ticker-tape.js/);
 assert.match(html,/NASDAQ:AAPL/);assert.match(html,/NASDAQ:MSFT/);
 assert.match(html,/No StarCoins charged or generated/);
 assert.doesNotMatch(html,/unlock|credit_wallet/i);
});
test('unsafe symbols fail closed and title cannot inject HTML',()=>{
 const card=library();
 assert.throws(()=>card.tickerHTML('<script>alert(1)</script>','Unsafe'),/1–15 symbols/);
 assert.throws(()=>card.tickerHTML('','Missing'),/1–15 symbols/);
 assert.doesNotMatch(card.tickerHTML('NASDAQ:MSFT','<img src=x onerror=alert(1)>'),/<img/);
});
test('cloudflare card search demands the declared read-only public registry contract',async()=>{
 const w=library();let uri='';
 const reply=async url=>{uri=String(url);return new Response(JSON.stringify({schema:'phi.card-library/public-v1',cards:[{id:'market-ticker',readyToEmbed:true}]}),{status:200})};
 const results=await w.query('stock ticker',reply);
 assert.equal(results[0].id,'market-ticker');
 assert.match(uri,/widgetphi-card-library\.marvaseater\.workers\.dev\/v1\/cards\?q=stock%20ticker/);
 const rejected=async()=>new Response(JSON.stringify({cards:[]}),{status:200});
 await assert.rejects(w.query('stock',rejected),/Invalid card registry/);
});
test('Code Phi renders card suggestions in existing editor without a Cloudflare write key',()=>{
 const html=fs.readFileSync('code/index.html','utf8');
 assert.match(html,/widgetphi-library-bridge\.js/);
 assert.match(html,/id="widgetPhiResults"/);
 assert.match(html,/id="widgetPhiSymbols"/);
 assert.match(src,/appendPreview/);
 assert.doesNotMatch(src,/GITHUB_TOKEN|CLOUDFLARE_API_TOKEN|starcoin_credit\(/i);
});
