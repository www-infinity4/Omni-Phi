const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('assets/smart-search.js','utf8');
test('large retrieved evidence fits the live AI gateway and stays valid JSON',async()=>{
 let sent;const context={clean:(v,max)=>String(v||'').slice(0,max),AI_ENDPOINT:'https://gateway.test',AbortController,setTimeout,clearTimeout,normalizeQuery:x=>x,aiOverviewByQuery:new Map(),parseAiJson:JSON.parse,aiPayloadText:d=>d.output_text,fetch:async(_,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({output_text:JSON.stringify({overview:'A grounded overview.'})})}}};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('  function evidencePrompt'),source.indexOf('  async function callCardAi'))+source.slice(source.indexOf('  async function callOverviewAi'),source.indexOf('  async function generateOverviewWithAi')),context);
 const result=await context.callOverviewAi('Iran',{summary:'Detailed research '.repeat(300)},Array.from({length:20},(_,i)=>({title:'Iran source '+i,url:'https://source.example/'+i,image:'https://image.example/'+'x'.repeat(700),extract:'Relevant source evidence '.repeat(100)})));
 assert.equal(result,'A grounded overview.');assert.ok(sent.input.length<=11500);const evidence=JSON.parse(sent.input.split('\nEvidence: ')[1]);assert.ok(evidence.length>0&&evidence.length<20);assert.equal(evidence[0].index,0);assert.equal(sent.context.verified_context.source_count,evidence.length);
});
