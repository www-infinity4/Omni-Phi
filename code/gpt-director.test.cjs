const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const script=fs.readFileSync(require('node:path').join(__dirname,'gpt-director.js'),'utf8');
const oldHtml='<!doctype html><html><head><title>Working website</title></head><body><main><h1>Old site</h1><p>'+('Existing content. '.repeat(30))+'</p></main></body></html>';
const newHtml=oldHtml.replace('Old site','Better website');
function setup(answer=newHtml){
 const window={},requests=[];
 const fetch=async(url,options)=>{requests.push({url,input:JSON.parse(options.body).input});return{ok:true,json:async()=>({output_text:answer})}};
 vm.runInNewContext(script,{window,fetch,AbortController,setTimeout,clearTimeout});
 return{director:window.CodePhiGPTDirector,requests};
}
test('original search token and the literal creative direction reach GPT',async()=>{
 const{director,requests}=setup();
 const result=await director.compose({query:'Albert Pujols',tokenId:'quant-7',direction:'cartoon baseball site',latestDirection:'make an original animated-styled page',draftHtml:oldHtml,context:{all:[{title:'Pujols baseball',sourceUrl:'https://example.org/verified'}]},iteration:1});
 assert.equal(result.ok,true);assert.equal(result.evidenceCount,1);
 assert.match(requests[0].input,/quant-7/);assert.match(requests[0].input,/original animated-styled page/);
 assert.match(requests[0].input,/https:\/\/example.org\/verified/);
});
test('iteration sees prior website rather than overwriting it with template',async()=>{
 const{director,requests}=setup();
 const result=await director.compose({query:'Pujols',tokenId:'q',latestDirection:'larger hero',previousHtml:oldHtml,draftHtml:'<html>regenerated template</html>',iteration:2});
 assert.equal(result.ok,true);assert.match(requests[0].input,/EXISTING WEBSITE TO REVISE/);assert.match(requests[0].input,/Old site/);
});
test('failed AI response does not get reported as a successful iteration',async()=>{
 const{director}=setup('AI reply without HTML');
 const result=await director.compose({query:'Pujols',previousHtml:oldHtml,iteration:2});
 assert.equal(result.ok,false);assert.equal(result.html,oldHtml);
});
test('podcast and created artwork cannot be silently deleted',async()=>{
 const{director}=setup();
 const withWidget=oldHtml.replace('</main>','<section data-widgetphi-podcast>Original audio</section></main>');
 const result=await director.compose({query:'Podcast',previousHtml:withWidget,iteration:2});
 assert.equal(result.ok,false);assert.match(result.reason,/would remove data-widgetphi-podcast/);
 assert.match(result.html,/data-widgetphi-podcast/);
});
test('GPT repair requires a real browser report',async()=>{
 const{director}=setup();
 const result=await director.repairFromBrowser({query:'Pujols',html:oldHtml,report:{ok:true,issues:['overflow']}});
 assert.equal(result.ok,false);assert.match(result.reason,/No verified Cloud Browser/);
});
test('browser-grounded GPT repair receives the actual diagnostics',async()=>{
 const{director,requests}=setup();
 const result=await director.repairFromBrowser({
  query:'Pujols',tokenId:'q9',direction:'mobile hero',html:oldHtml,
  report:{ok:true,issues:['Horizontal mobile overflow detected.'],inspection:{title:'Old site',diagnostics:{horizontalOverflow:true},text:'Old site'}}
 });
 assert.equal(result.ok,true);assert.equal(result.changed,true);
 assert.match(requests[0].input,/Horizontal mobile overflow/);assert.match(requests[0].input,/mobile hero/);
});
