'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const script=fs.readFileSync(path.join(__dirname,'workshop-orchestrator.js'),'utf8');
const start=script.indexOf('async function request(path,data){');
const end=script.indexOf('\n function talk(',start);
assert.ok(start>=0&&end>start,'extract the real workshop request implementation, do not substitute a fake');

function setup(fetchImpl){
 const requests=[],timers=new Map();let tick=0;
 const ctx={
   API:'/api/codephi',
   $:()=>({value:'cloudflare'}),
   window:{CodePhiPersonalSkills:{context:()=>({owner:'verified-scope'})}},
   AbortController,
   setTimeout:fn=>{const id=++tick;timers.set(id,fn);return id;},
   clearTimeout:id=>timers.delete(id),
   fetch:(url,opts)=>{requests.push({url,opts});return fetchImpl(url,opts);}
 };
 vm.runInNewContext(script.slice(start,end)+'\n globalThis.callRequest=request;',ctx);
 return{ctx,requests,timers,expire:()=>{for(const fn of [...timers.values()])fn();}};
}

test('Android WebView works without static AbortSignal.timeout for GET',async()=>{
 const h=setup(async()=>({ok:true,status:200,json:async()=>({ok:true,model:'ready'})}));
 const result=await h.ctx.callRequest('/status');
 assert.equal(result.model,'ready');
 assert.equal(h.requests[0].url,'/api/codephi/status');
 assert.equal(h.requests[0].opts.credentials,'same-origin');
 assert.equal(h.requests[0].opts.signal.aborted,false);
 assert.equal(h.timers.size,0,'release timeout after response');
 assert.doesNotMatch(script,/signal:AbortSignal\.timeout/);
});

test('POST preserves natural build inputs, provider selection, and scoped context',async()=>{
 const h=setup(async()=>({ok:true,status:200,json:async()=>({ok:true,tasks:[]})}));
 await h.ctx.callRequest('/ai',{kind:'plan',topic:'Mobile history site'});
 const body=JSON.parse(h.requests[0].opts.body);
 assert.equal(body.topic,'Mobile history site');
 assert.equal(body.provider,'cloudflare');
 assert.equal(body.personalContext.owner,'verified-scope');
 assert.equal(h.requests[0].opts.method,'POST');
 assert.equal(h.timers.size,0);
});

test('timeout aborts a stalled request and leaves the prior website intact',async()=>{
 const h=setup((url,opts)=>new Promise((resolve,reject)=>{
  opts.signal.addEventListener('abort',()=>reject(Error('fetch cancelled')));
 }));
 const request=h.ctx.callRequest('/ai',{kind:'plan',topic:'Test'});
 h.expire();
 await assert.rejects(request,/request timed out.*working preview was preserved/i);
 assert.equal(h.requests[0].opts.signal.aborted,true);
 assert.equal(h.timers.size,0);
});
