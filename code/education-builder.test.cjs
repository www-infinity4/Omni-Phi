const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(fetch){const window={};vm.runInNewContext(fs.readFileSync(__dirname+'/education-builder.js','utf8'),{window,fetch,URL,AbortController,setTimeout,clearTimeout});return window.CodePhiEducation}
const context={cards:[{title:'Material evidence',url:'https://example.test/material',extract:'The supplied source describes this material and identifies its stated properties.'}],images:[{title:'Selected visual',image:'https://example.test/selected.jpg',url:'https://example.test/material'}],audio:[{title:'Audio source',url:'https://example.test/audio'}]};
test('education fallback produces lessons, exercises and linked lesson files using the same source collection',()=>{
 const api=setup(),sources=api.evidence(context,[]),model=api.fallback('ShopLC','Education',sources),html=api.render(model,sources,context,'original-token');
 assert.equal(model.lessons.length,4);assert.ok(html.includes('Try it yourself'));assert.ok(html.includes('Check your understanding'));assert.ok(html.includes('selected.jpg'));assert.ok(html.includes('https://example.test/audio'));assert.ok(html.includes('Human review pending'));
 const files=api.packageFiles(model,sources,context,'original-token');assert.equal(files.length,5);assert.ok(files[0].content.includes('./learn/1-'));assert.ok(files[1].content.includes('href="../../"'));
});
test('AI lesson blueprint changes rendered curriculum and unknown source IDs are rejected',async()=>{
 const api=setup(async()=>({ok:true,json:async()=>({output_text:JSON.stringify({title:'Gem Learning',design:'gallery',lessons:[1,2,3].map(n=>({title:'AI lesson '+n,objective:'Compare evidence',explanation:'Grounded explanation',sourceIds:['s0'],activity:'Compare cited claims',example:'Hypothetical comparison',comparison:'Evidence versus claim',question:'What is supported?',answer:'The cited claim.'}))})})}));
 const sources=api.evidence(context,[]),model=await api.plan('ShopLC','Education with comparison activities',sources);
 assert.equal(model.generation,'ai-draft');assert.equal(model.title,'Gem Learning');assert.ok(api.render(model,sources,context,'t').includes('AI lesson 2'));
 assert.throws(()=>api.validate({lessons:[1,2,3].map(()=>({title:'False',explanation:'Unsupported',activity:'Task',sourceIds:['invented']}))},model,sources));
});
test('offline AI retains a useful education page and source URLs reject executable schemes',async()=>{
 const api=setup(async()=>{throw Error('offline')}),sources=api.evidence(context,[]),model=await api.plan('ShopLC','Education',sources);assert.equal(model.generation,'source-guided');assert.equal(api.evidence({cards:[{title:'bad',url:'javascript:alert(1)',extract:'unsafe'}]},[]).length,0);
});
