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
 {id:"orange-brook-search",name:"Orange Brook SearXNG",provider:"Infinity / SearXNG",category:"Search",auth:"None from Phi front ends",cost:"Existing infrastructure",access:"Already connected",tags:["search","images","web","code phi","browser","research"],endpoint:"https://orange-brook-a2ac.marvaseater.workers.dev/search"},
 {id:"youtube-privacy-embed",name:"YouTube public video/playlist player",provider:"YouTube",category:"Video",auth:"None for known IDs",cost:"Free embed",access:"Public source link",tags:["youtube","video","playlist","embed"],endpoint:"https://www.youtube-nocookie.com/embed/"},
 {id:"vimeo-public-embed",name:"Vimeo public video player",provider:"Vimeo",category:"Video",auth:"None",cost:"Free embed",access:"Public source link",tags:["vimeo","video","embed"],endpoint:"https://player.vimeo.com/video/"}
]
const providerIds=route=>new Set((route?.repositories||[]).map(x=>x.id));
const terms=value=>String(value||"").toLowerCase().match(/[a-z0-9]+/g)||[];
function freeOnly(api){
 return api && api.requiresSignup !== true && api.requiresPayment !== true && api.requiresCard !== true &&
   !/paid|subscription|trial|credit card|billing/i.test([api.cost,api.access,api.auth,api.description].filter(Boolean).join(" "));
}
function matchingApis(query){
 const q=new Set(terms(query));
 return API_CATALOG.filter(freeOnly).map(api=>({...api,score:[api.name,api.provider,api.category,...api.tags].flatMap(terms).reduce((n,t)=>n+(q.has(t)?1:0),0)}))
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
  widgetPhi:{status:"real-widget-catalog",supported:["podcast-card","video-feed","stock-card","market-ticker","stock-wallet"],selection:"Only user-selected and source-supported widgets belong on the published site"},
  quantAI:quantPacket(context),
  rules:{freeOnly:true,rejectSignup:true,rejectPayment:true,rejectCreditCard:true,neverExposeSecrets:true,neverInventApiAvailability:true,preserveTokenProvenance:true}
 };
}
// Catalogs and Quant provenance are builder metadata. Never spam a visitor's
// finished website with capability catalogs, research scaffolds or token debug panels.
function visibleIntegration(){return "";}
function apply(html,route,context,query){
 const source=String(html||"").replace(/<script[^>]*id=["']codephi-provider-manifest["'][^>]*>[\s\S]*?<\/script>/gi,""); if(!source)return source;
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
