/* Private builder-side Quant interest weights; never publish raw search history. */
(function(root){
 'use strict';
 const FAMILIES=[
  ['sports',/\b(baseball|football|basketball|athlete|team|player|mlb|nfl|stadium|pujols|cardinals)\b/i,'visual'],
  ['music',/\b(music|piano|concert|radio|album|song|band|sound|vinyl|singer)\b/i,'listening'],
  ['cinema',/\b(movie|film|video|youtube|cinema|television|stream|movie trailer)\b/i,'cinema'],
  ['art',/\b(art|painting|poster|design|gallery|photograph|illustration|cartoon|trading card)\b/i,'visual'],
  ['collecting',/\b(coin|silver|gold|gem|memorabilia|collectible|auction|antique)\b/i,'visual'],
  ['research',/\b(history|museum|science|astronomy|element|invention|discovery|biography)\b/i,'editorial']
 ];
 function read(key){
  try{const a=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(a)?a:[]}catch{return []}
 }
 function topic(x){return String(x?.query||x?.searchQuery||x?.title||x||'').slice(0,260)}
 function score(query,context={}){
  const scores=new Map(FAMILIES.map(([name])=>[name,0]));
  const add=(v,weight)=>{const t=topic(v);if(!t)return;for(const [name,re] of FAMILIES)if(re.test(t))scores.set(name,scores.get(name)+weight)};
  add(query,9);
  for(const item of (context.cards||[]).slice(0,30))add(item,2);
  for(const item of (context.images||[]).slice(0,35))add(item,1.2);
  for(const item of (context.video||[]).slice(0,20))add(item,1.6);
  const seen=new Set();
  const history=[...read('quantaPhiBuildHistoryV1'),...read('omniPhi:searchHistoryV1'),...read('infinityPhi:searchHistoryV1')].slice(-300).reverse();
  history.forEach((item,index)=>{const k=topic(item).toLowerCase();if(!k||seen.has(k))return;seen.add(k);add(item,Math.max(.15,1.6/(1+index/20)))});
  const ranked=[...scores.entries()].sort((a,b)=>b[1]-a[1]);
  const [name,weight]=ranked[0]||['research',0];
  const family=FAMILIES.find(x=>x[0]===name);
  return {category:name,focus:family?.[2]||'editorial',confidence:Math.min(1,weight/16),
   historySignals:seen.size,source:'private Quant interests · current token prioritized'};
 }
 root.CodePhiQuantPersonalizer=Object.freeze({score});
})(window);
