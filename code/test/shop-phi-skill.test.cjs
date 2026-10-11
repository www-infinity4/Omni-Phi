'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function skill(){
 const sandbox={window:{},URL,console};vm.runInNewContext(fs.readFileSync('code/shop-phi-skill.js','utf8'),sandbox);
 return sandbox.window.CodePhiShopPhi;
}
test('Shop Phi Code Phi input creates exactly user-chosen merchandise and sponsor labels',()=>{
 const s=skill();
 const products=s.parse('Astronomy art | https://example.org/art | Creator Store\nAd: Telescope special | https://seller.example/ad | Seller Sponsor');
 assert.equal(products.length,2);assert.equal(products[0].seller,'Creator Store');
 assert.equal(products[1].sponsored,true);assert.equal(products[1].sponsor,'Seller Sponsor');
 const html=s.build({name:'Galaxy Recommendations',creator:'My Gallery',items:products});
 assert.match(html,/Galaxy Recommendations/);assert.match(html,/Astronomy art/);
 assert.doesNotMatch(html,/Telescope special/);
 assert.match(html,/Next curator pick · 1 StarCoin/);
 assert.match(html,/disabled/);
});
test('Shop Phi cannot create fake advertiser endorsement or unsafe source',()=>{
 const s=skill();
 assert.throws(()=>s.parse('Ad: Special | https://example.org/product'),/must name the advertiser/);
 assert.throws(()=>s.parse('Unsafe | javascript:alert(1)'),/original HTTPS merchant/);
 assert.throws(()=>s.parse('Local | https://localhost/item'),/original HTTPS/);
 const x=s.build({name:'<script>alert(1)</script>',items:s.parse('Curated mug | https://example.org/mug')});
 assert.doesNotMatch(x,/<script>alert/);
 assert.match(x,/&#60;script/);
});
test('Composer is actually mounted within Code Phi and protects local typing drafts',()=>{
 const html=fs.readFileSync('code/index.html','utf8');
 const bridge=fs.readFileSync('code/widgetphi-library-bridge.js','utf8');
 const code=fs.readFileSync('code/shop-phi-skill.js','utf8');
 assert.match(html,/id="shopPhiComposer"/);
 assert.match(html,/shop-phi-skill\.js/);
 assert.match(html,/id="shopPhiSources"/);
 assert.match(bridge,/card\.id==='shop-phi'/);
 assert.match(code,/localStorage\.setItem/);
 assert.match(code,/localStorage\.getItem/);
 assert.match(code,/viewer\.srcdoc=/);
});
