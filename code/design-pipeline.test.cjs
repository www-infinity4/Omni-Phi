const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function load(){const ctx={window:{},console};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'design-pipeline.js'),'utf8'),ctx,{filename:'design-pipeline.js'});return ctx.window.CodePhiDesignPipeline;}
test('Code Phi design fallback consumes LayaPhi structure with Oracle Octaves tokens',()=>{
 const p=load(),model={design:'gallery',lessons:[{title:'Hydrogen'},{title:'Helium'}]};
 const layout=p.educationLayout(model),spec=p.localDesign(layout,model);
 assert.equal(layout.schema,'layaphi.layout');
 assert.equal(spec.schema,'desiphi.codephi-spec');
 assert.equal(spec.theme,'oracle-octaves');
 assert.equal(spec.tokens.colors.background,'#fbf8f1');
 assert.equal(spec.tokens.colors.accent,'#8f202d');
 assert.equal(spec.tokens.accessibility.minTapTarget,44);
 assert.equal(spec.components.length,5);
 assert.equal(spec.components[2].contentReference.componentId,'lesson1');
 assert.equal(spec.components[3].identity.id,'lesson2');
 assert.equal(spec.designIntensity,'visual');
});
test('fallback manifest says Code Phi fallback and does not fabricate a DesiPhi execution',()=>{
 const p=load(),layout=p.educationLayout({lessons:[]}),design=p.localDesign(layout,{});
 const html=p.stamp('<html><body><main>Research</main></body></html>',{layout,design,source:'local-contract'});
 assert.match(html,/Code Phi contract fallback/);
 assert.match(html,/layaphi|LayaPhi/);
 assert.ok(html.includes('codephi-build-manifest'));
 assert.doesNotMatch(html,/ownerToken|walletToken|Bearer /);
});
