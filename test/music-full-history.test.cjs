const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const script=fs.readFileSync('music-quant-cloud.js','utf8');
function fixture(mismatch=false){
 const memory=new Map([['infinity_unified_wallet_v1',JSON.stringify({currentWalletId:'selected-wallet',wallets:{'selected-wallet':{balances:{MUSIC_QUANT:0}}}})]]),queries=[],stored=[];
 const notes=Array.from({length:5},(_,i)=>({name:'C',midi:60,onsetMs:i*100,holdMs:100,group:i}));
 const mk=id=>({id,kind:'playable',notes,createdAt:'2026-10-11T23:00:00.000Z'});
 const pages=[{ok:true,wallet_id:'qw_authenticated',balance:3,has_more:true,quants:[mk('mq_one'),mk('mq_two')]},{ok:true,wallet_id:mismatch?'qw_another':'qw_authenticated',balance:3,has_more:false,quants:[mk('mq_three')]}];
 const context={localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},document:{title:'Music Quants',readyState:'loading',addEventListener(){}},addEventListener(){},setInterval(){},console,CustomEvent:class{constructor(type,init){this.type=type;this.detail=init.detail}}};
 context.window={MusicQuantStore:{list:async()=>[],putMany:async items=>stored.push(...items)},StarQuestCloudLedger:{authenticatedFetch:async(url,opts)=>{
  queries.push(url);
  if(!url.includes('/v1/music-quants/state'))throw Error('Unexpected POST');
  const page=url.includes('?offset=2')?pages[1]:pages[0];
  return {ok:true,json:async()=>page};
 }},ControlPhi:{refreshWallet(){}},dispatchEvent(){}};
 vm.runInNewContext(script,context,{timeout:2000});return{cloud:context.window.MusicQuantCloud,memory,queries,stored};
}
test('Fetches all Music Quant pages before announcing wallet recovery',async()=>{
 const f=fixture(),state=await f.cloud.sync();assert.equal(state.balance,3);
 assert.equal(state.quants.length,3);assert.equal(f.stored.length,3);
 assert.ok(f.queries.some(x=>x.endsWith('?offset=2')));
 const wallet=JSON.parse(f.memory.get('infinity_unified_wallet_v1'));
 assert.equal(wallet.currentWalletId,'selected-wallet');
 assert.equal(wallet.wallets.qw_authenticated.balances.MUSIC_QUANT,3);
});
test('Rejects a continuation page from a different wallet owner',async()=>{
 const f=fixture(true),result=await f.cloud.sync();
 assert.equal(result.ok,false);assert.equal(result.reason,'music_quant_wallet_changed_during_sync');
 assert.equal(f.cloud.state,null);assert.equal(f.stored.length,0);
});
