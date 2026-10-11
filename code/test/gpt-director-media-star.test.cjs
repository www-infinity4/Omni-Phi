'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const script=fs.readFileSync('code/gpt-director.js','utf8'),ctx={window:{}};
vm.runInNewContext(script,ctx);
test('Oracle Code Phi carries real collected media evidence into context',()=>{
 const sources=ctx.window.CodePhiGPTDirector.sources({
  collected:[
   {title:'Galaxy art',url:'https://example.org/galaxy.png'},
   {title:'Spaces recording',url:'https://x.com/i/spaces/1OyKAjYPeXqGb'},
   {title:'Fake',url:'javascript:alert(1)'}
  ]});
 assert.equal(sources.length,2);
 assert.equal(sources[1].url,'https://x.com/i/spaces/1OyKAjYPeXqGb');
});
test('Oracle Media Star directions do not allow fake paid checkout or fabricated streams',()=>{
 assert.match(script,/Media Star creation skill:/);
 assert.match(script,/creator-specific server ledger/);
 assert.match(script,/source provenance/);
 assert.match(script,/Do not claim.*AI repair/);
});
