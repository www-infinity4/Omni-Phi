(function(root){
"use strict";
const esc=s=>String(s??"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
const API_CATALOG=[
 {id:"metal-sentinel-widgets",name:"Metal Sentinel live metal widgets",provider:"Metal Sentinel",category:"Commodities",auth:"None",cost:"Free",access:"No key / no signup",tags:["metals","gold","silver","platinum","palladium","copper","nickel","aluminum","zinc","lead","commodities","prices"],endpoint:"https://metal-sentinel.com/widgets"},
 {id:"internet-archive",name:"Internet Archive APIs",provider:"Internet Archive",category:"Media",auth:"None",cost:"Free",access:"No key",tags:["audio","video","movies","books","archive","media","search"],endpoint:"https://archive.org/advancedsearch.php"},
 {id:"mediawiki",name:"MediaWiki / Wikipedia API",provider:"Wikimedia",category:"Knowledge",auth:"None",cost:"Free",access:"No key",tags:["wikipedia","knowledge","research","images","articles","search"],endpoint:"https://en.wikipedia.org/w/api.php"},
 {id:"crossref",name:"Crossref REST API",provider:"Crossref",category:"Research",auth:"None",cost:"Free",access:"No key",tags:["research","papers","doi","citations","academic","articles"],endpoint:"https://api.crossref.org/works"},
 {id:"duckduckgo-instant-answer",name:"DuckDuckGo Instant Answer API",provider:"DuckDuckGo",category:"Search",auth:"None",cost:"Free",access:"No key",tags:["search","web","answers","research"],endpoint:"https://api.duckduckgo.com/"},
 {id:"github-public",name:"GitHub public REST API",provider:"GitHub",category:"Development",auth:"None for public reads",cost:"Free",access:"No key for public reads",tags:["github","code","repositories","commits","development"],endpoint:"https://api.github.com/"},
 {id:"orange-brook-search",name:"Orange Brook SearXNG",provider:"Infinity / SearXNG",category:"Search",auth:"None from Phi front ends",cost:"Existing infrastructure",access:"Already connected",tags:["search","images","web","code phi","browser","research"],endpoint:"https://orange-brook-a2ac.marvaseater.workers.dev/search"}
]
const providerIds=route=>new Set((route?.repositories||[]).map(x=>x.id));
const terms=value=>String(value||"").toLowerCase().match(/[a-z0-9]+/g)||[];
function matchingApis(query){
 const q=new Set(terms(query));
 return API_CATALOG.map(api=>({...api,score:[api.name,api.provider,api.category,...api.tags].flatMap(terms).reduce((n,t)=>n+(q.has(t)?1:0),0)}))
   .filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name));
}
function quantPacket(context){
 const items=(context?.all||[]).slice(0,40);
 return {
  schema:"codephi.quant-context/v1",
  sourceContract:"Quant-AI Quant Packet v2 compatible context",
  privacy:{contains_direct_identity:false,contains_sensitive_profile:false},
  tokenId:String(context?.tokenId||""),
  query:String(context?.query||""),
  counts:context?.counts||{cards:0,images:0,video:0,audio:0},
  evidence:items.map((x,index)=>({
   evidence_id:"e"+(index+1),
   kind:String(x.kind||x.type||"card").slice(0,40),
   title:String(x.title||"Collected item").slice(0,180),
   source:String(x.url||x.sourceUrl||"").slice(0,500)
  }))
 };
}
function manifest(route,context,query){
 const selected=route?.repositories||[];
 const ids=providerIds(route);
 return {
  schema:"codephi.provider-manifest/v1",
  generatedAt:new Date().toISOString(),
  query:String(query||""),
  providers:selected.map(({id,name,repo,role})=>({id,name,repo,role})),
  apiCatalog:ids.has("apiphi")?matchingApis(query):[],
  widgetPhi:ids.has("widgetphi")?{status:"scaffold-contract",request:{type:"build_widget",widget:"research-summary",spec:{title:String(query||"Code Phi"),fields:["Evidence","Media","Sources"]}}}:null,
  quantAI:ids.has("quant-ai")?quantPacket(context):null,
  rules:{neverExposeSecrets:true,neverInventApiAvailability:true,preserveTokenProvenance:true}
 };
}
function visibleIntegration(man){
 const pieces=[];
 if(man.apiCatalog?.length){
  pieces.push('<section id="phi-integrations" style="margin:24px 0"><h2>Live data integrations</h2><div style="display:grid;gap:10px">'+man.apiCatalog.map(api=>'<article style="padding:14px;border:1px solid #d8cbe1;border-radius:16px;background:#fff"><b>'+esc(api.name)+'</b><p style="margin:5px 0">'+esc(api.provider)+' · '+esc(api.category)+'</p><small>Connector available in APIPhi catalog · authentication required: '+esc(api.auth)+'</small></article>').join("")+'</div></section>');
 }
 if(man.widgetPhi){
  pieces.push('<section id="phi-widget" style="margin:24px 0"><h2>Research widget</h2><article style="padding:16px;border-radius:18px;background:#f0e8f6;border:1px solid #d5c0e4"><b>'+esc(man.query||"Code Phi")+'</b><p>This widget is bound to the active research token and can be upgraded through WidgetPhi without dropping the source context.</p></article></section>');
 }
 if(man.quantAI){
  const c=man.quantAI.counts||{};
  pieces.push('<section id="quant-context" style="margin:24px 0"><h2>Quant context</h2><article style="padding:16px;border-radius:18px;background:#fff;border:1px solid #d5c0e4"><b>Research packet preserved</b><p>'+Number(c.cards||0)+' cards · '+Number(c.images||0)+' images · '+Number(c.video||0)+' video · '+Number(c.audio||0)+' audio</p><small>No direct identity or sensitive profile data is embedded in this build.</small></article></section>');
 }
 return pieces.join("");
}
function apply(html,route,context,query){
 const source=String(html||""); if(!source)return source;
 const man=manifest(route,context,query);
 const json=JSON.stringify(man).replace(/</g,"\\u003c");
 const visible=visibleIntegration(man);
 let out=source;
 if(visible && /<\/main>/i.test(out)) out=out.replace(/<\/main>/i,visible+"</main>");
 else if(visible && /<\/body>/i.test(out)) out=out.replace(/<\/body>/i,visible+"</body>");
 const tag='<script type="application/json" id="codephi-provider-manifest">'+json+'<\\/script>';
 if(/<\/body>/i.test(out)) out=out.replace(/<\/body>/i,tag+"</body>"); else out+=tag;
 return out;
}
root.CodePhiProviderBridge=Object.freeze({API_CATALOG,matchingApis,quantPacket,manifest,apply});
})(window);
