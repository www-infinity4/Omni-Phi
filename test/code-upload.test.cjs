const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(){
 const nodes=new Map();const make=()=>({style:{},files:[],handlers:{},value:'',options:[],append(){},replaceChildren(){},addEventListener(k,f){this.handlers[k]=f}});
 const document={getElementById:id=>{if(!nodes.has(id))nodes.set(id,make());return nodes.get(id)},createElement:make};
 class FileReader{readAsDataURL(){this.result='data:image/png;base64,iVBORw0KGgo=';this.onload()}}
 const window={CodePhiSiteExperience:{},CodePhiMediaStarSkills:null};
 vm.runInNewContext(fs.readFileSync('code/studio-tools.js','utf8'),{window,document,FileReader,URL,DOMParser:class{parseFromString(){return{querySelectorAll:()=>[]}}},localStorage:{getItem:()=>null}});
 const viewer={srcdoc:''};window.CodePhiStudioTools.mount({viewer,query:'test',tokenId:'fixture'});return nodes;
}
test('selected image appears immediately and can be added without AI generation',async()=>{
 const nodes=setup(),file=nodes.get('assetFile');file.files=[{name:'reference.png',type:'image/png',size:100}];
 await file.handlers.change();assert.match(nodes.get('assetResult').src,/^data:image\/png/);assert.equal(nodes.get('assetUse').disabled,false);assert.match(nodes.get('assetFeedback').textContent,/Image loaded/);
});
test('unsupported upload stays disabled and reports its cause',async()=>{
 const nodes=setup(),file=nodes.get('assetFile');file.files=[{name:'document.pdf',type:'application/pdf',size:100}];
 await file.handlers.change();assert.equal(nodes.get('assetUse').disabled,true);assert.match(nodes.get('assetFeedback').textContent,/PNG\/JPG\/WebP/);
});
