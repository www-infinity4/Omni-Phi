(function(){
'use strict';
const ENDPOINT='https://quanta-phi-ledger.marvaseater.workers.dev';
const LOCAL='musicPhi:quants:v1',LISTENING='musicPhi:listeningQuants:v1',UNIFIED='infinity_unified_wallet_v1';
const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}},write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}};
let syncing=false;
function mirror(state){
 const unified=read(UNIFIED,{}),walletId=String(state.wallet_id||'');
 if(!walletId)return;
 const wallets=unified.wallets&&typeof unified.wallets==='object'?unified.wallets:{},wallet=wallets[walletId]&&typeof wallets[walletId]==='object'?wallets[walletId]:{},balances=wallet.balances&&typeof wallet.balances==='object'?wallet.balances:{};
 const confirmed=Math.max(0,Number(state.balance)||0);
 wallets[walletId]={...wallet,balances:{...balances,MUSIC_QUANT:confirmed},updatedAt:Date.now()};
 write(UNIFIED,{...unified,currentWalletId:unified.currentWalletId||walletId,wallets,musicQuants:confirmed,updatedAt:Date.now(),source:'music-quant-cloud'});
 window.dispatchEvent(new CustomEvent('controlphi:wallet-change',{detail:{musicQuants:confirmed,attachedMusicQuantRecords:confirmed,source:'music-quant-cloud'}}));
 window.ControlPhi?.refreshWallet?.();
}
async function mergeCloud(cloud){
 const playable=read(LOCAL,[]),listening=read(LISTENING,[]),playableMap=new Map(playable.filter(q=>!q.transferredAt).map(q=>[q.id,q])),listeningMap=new Map(listening.filter(q=>!q.transferredAt).map(q=>[q.id,q]));
 (Array.isArray(cloud)?cloud:[]).forEach(q=>{if(!q?.id)return;if(q.kind==='listening'&&Array.isArray(q.notes)&&q.notes.length===0)listeningMap.set(q.id,q);else if(Array.isArray(q.notes)&&q.notes.length>=5&&q.notes.length<=15)playableMap.set(q.id,q)});
 const playableMerged=[...playableMap.values()].sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
 const listeningMerged=[...listeningMap.values()].sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
 if(window.MusicQuantStore?.putMany)await window.MusicQuantStore.putMany(playableMerged).catch(error=>console.warn('Music Quant IndexedDB backfill pending',error));
 write(LOCAL,playableMerged);write(LISTENING,listeningMerged);return [...playableMerged,...listeningMerged];
}

async function fetchCompleteMusicHistory(bridge){
 const page=async offset=>{
  const url=ENDPOINT+'/v1/music-quants/state'+(offset?'?offset='+offset:'');
  const response=await bridge.authenticatedFetch(url,{cache:'no-store'});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||'music_quant_state_failed');
  if(!Array.isArray(data.quants))throw new Error('music_quant_history_invalid');
  return data;
 };
 const first=await page(0),all=[],seen=new Set();
 let current=first,offset=0,done=false;
 for(let pageNumber=0;pageNumber<40;pageNumber++){
  if(current.wallet_id!==first.wallet_id)throw new Error('music_quant_wallet_changed_during_sync');
  for(const item of current.quants){
   if(item?.id&&!seen.has(item.id)){seen.add(item.id);all.push(item)}
  }
  offset+=current.quants.length;
  if(!current.has_more){done=true;break}
  if(!current.quants.length||offset>=20000)break;
  current=await page(offset);
 }
 if(!done||all.length<Number(first.balance||0))throw new Error('music_quant_history_incomplete');
 return {...first,quants:all,has_more:false};
}

async function sync(){
 if(syncing)return {ok:false,reason:'sync_in_progress'};const Wallet=window.InfinityCloudWallet;const bridge=window.StarQuestCloudLedger||(Wallet?{authenticatedFetch:(url,opt={})=>{const w=new Wallet({appName:document.title});return fetch(url,{...opt,headers:{'content-type':'application/json',authorization:'Bearer '+w.token(),...(opt.headers||{})},body:typeof opt.body==='string'?opt.body:opt.body?JSON.stringify(opt.body):undefined})}}:null);const indexed=window.MusicQuantStore?await window.MusicQuantStore.list().catch(()=>[]):[],playableMap=new Map([...read(LOCAL,[]),...indexed].filter(q=>q?.id&&!q.transferredAt).map(q=>[q.id,q])),listeningMap=new Map(read(LISTENING,[]).filter(q=>q?.id&&!q.transferredAt&&!playableMap.has(q.id)).map(q=>[q.id,q])),localBalance=playableMap.size+listeningMap.size;window.MusicQuantCloud.localCount=localBalance;window.MusicQuantCloud.pianoCount=playableMap.size;window.MusicQuantCloud.listeningCount=listeningMap.size;window.ControlPhi?.refreshWallet?.();if(!bridge?.authenticatedFetch){return {ok:false,reason:'account_not_connected',localBalance}}syncing=true;
 try{
  const local=[...playableMap.values(),...listeningMap.values()].sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  if(local.length){
   for(let offset=0;offset<local.length;offset+=100){
    const response=await bridge.authenticatedFetch(ENDPOINT+'/v1/music-quants/sync',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({quants:local.slice(offset,offset+100)})});
    if(!response.ok)throw new Error('music_quant_sync_failed');
    const receipt=await response.json().catch(()=>({}));
    const submitted=local.slice(offset,offset+100).map(q=>q.id);
    const accepted=new Set(receipt.accepted||[]);
    if(submitted.some(id=>!accepted.has(id)))throw new Error('music_quant_rejected_by_ledger');
   }
  }
  const state=await fetchCompleteMusicHistory(bridge);
  await mergeCloud(state.quants);const owned=new Map((state.quants||[]).filter(q=>q?.id&&!q.transferredAt).map(q=>[q.id,q]));window.MusicQuantCloud.pianoCount=[...owned.values()].filter(q=>q.kind!=='listening').length;window.MusicQuantCloud.listeningCount=[...owned.values()].filter(q=>q.kind==='listening').length;window.MusicQuantCloud.state=state;window.MusicQuantCloud.lastError='';mirror(state);
  window.dispatchEvent(new CustomEvent('musicquant:cloud-synced',{detail:state}));
  return state;
 }catch(error){console.warn('Music Quant cloud sync deferred',error);window.MusicQuantCloud.lastError=String(error?.message||error);window.dispatchEvent(new CustomEvent('musicquant:cloud-error',{detail:{message:window.MusicQuantCloud.lastError}}));window.ControlPhi?.refreshWallet?.();return {ok:false,reason:window.MusicQuantCloud.lastError}}
 finally{syncing=false}
}
window.MusicQuantCloud={sync,endpoint:ENDPOINT,state:null,localCount:0};
document.addEventListener('starquest:ledger-connected',()=>void sync());
document.addEventListener('starquest:auth-changed',()=>void sync());
addEventListener('musicquant:changed',()=>void sync());
addEventListener('online',()=>void sync());
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{sync();setInterval(sync,30000)},{once:true});else{sync();setInterval(sync,30000)}
})();
