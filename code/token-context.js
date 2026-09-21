(function(root){
"use strict";
const json=(store,key,fallback)=>{try{const value=JSON.parse(store.getItem(key)||"null");return value==null?fallback:value}catch{return fallback}};
const text=value=>String(value==null?"":value).replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
const list=value=>Array.isArray(value)?value:value&&typeof value==="object"?Object.values(value):[];
const stores=()=>[localStorage,sessionStorage];
const sameToken=(item,tokenId,query)=>{
 if(!item||typeof item!=="object")return false;
 if(item.tokenId)return String(item.tokenId)===String(tokenId);
 const q=text(item.searchQuery||item.query||item.selectionScope||item.refinedQuery).toLowerCase();
 const needle=text(query).toLowerCase();
 return !q||q===needle||q.startsWith(needle+" ")||needle.startsWith(q+" ");
};
const identity=item=>text(item.storyKey||item.id||item.url||item.sourceUrl||item.imageUrl||item.image||item.title);
function unique(items){const seen=new Set();return items.filter(item=>{const key=identity(item);if(!key||seen.has(key))return false;seen.add(key);return true})}
function normalized(item,forcedKind){
 const kind=text(forcedKind||item.kind||item.type||item.mediaType).toLowerCase();
 const image=text(item.imageUrl||item.img_src||item.thumbnail_src||item.thumbnail||item.image||item.src);
 const url=text(item.url||item.sourceUrl||item.href||item.source);
 const id=text(item.identifier||item.id||(url.match(/archive\.org\/details\/([^/?#]+)/i)||[])[1]);
 return {...item,id,title:text(item.title||item.sourceTitle||item.name)||"Collected item",extract:text(item.extract||item.sourceExtract||item.description||item.text||item.summary),url,image,kind,provider:text(item.provider||item.domain||item.sourceName),storyKey:text(item.storyKey)||identity(item)};
}
function collectKeys(keys,tokenId,query,forcedKind){
 const found=[];
 for(const store of stores())for(const key of keys)for(const item of list(json(store,key,[])))if(sameToken(item,tokenId,query))found.push(normalized(item,forcedKind));
 return unique(found);
}
function load(query,tokenId){
 const research=root.OmniPhi?.activeResearch?.()||{};
 const images=collectKeys(["phiShared:imageSelections:v1","omniPhi:imageSelections:v1","omniPhi:selectedImages:v1","infinityPhi:imageSelections:v1","infinityPhi:selectedImages:v1","phi:selectedImages"],tokenId,query,"image");
 const media=collectKeys(["omniPhi:mediaSelections:v1","infinityPhi:mediaSelections:v1"],tokenId,query);
 const shared=collectKeys(["phiShared:collection:v1","omniPhi:collection:v1","infinityPhi:collection:v1","omniPhi:websiteIndexCards:v1","infinityPhi:websiteIndexCards:v1"],tokenId,query);
 const profile=list(root.OmniPhi?.profile?.()?.collected).filter(item=>sameToken(item,tokenId,query)).map(item=>normalized(item));
 const researchCards=sameToken(research,tokenId,query)||text(research.query).toLowerCase()===text(query).toLowerCase()?list(research.sources).map(item=>normalized(item)):[];
 const all=unique([...media,...shared,...profile,...researchCards]);
 const audio=unique(all.filter(item=>/audio|sound|music/.test(item.kind)));
 const video=unique(all.filter(item=>/video|movie|film/.test(item.kind)));
 const imageCards=unique([...images,...all.filter(item=>item.kind==="image")]);
 const mediaKeys=new Set([...audio,...video,...imageCards].map(identity));
 const cards=unique(all.filter(item=>!mediaKeys.has(identity(item))));
 const overview=text(research.overview||research.visualPatternOverview||json(localStorage,"omniPhi:codeSeed:v1",{})?.overview);
 const context={schema:"infinity-code-token-context/v1",query,tokenId,overview,cards,images:imageCards,audio,video,all:unique([...cards,...imageCards,...video,...audio])};
 context.counts={cards:cards.length,images:imageCards.length,video:video.length,audio:audio.length};
 context.forPrompt=()=>({schema:context.schema,query,tokenId,overview:overview.slice(0,5000),counts:context.counts,cards:cards.slice(0,20).map(({title,extract,url,provider})=>({title,extract:extract.slice(0,1200),url,provider})),images:imageCards.slice(0,20).map(({title,image,url,provider})=>({title,image,url,provider})),video:video.slice(0,12).map(({id,title,extract,url})=>({id,title,extract:extract.slice(0,900),url})),audio:audio.slice(0,12).map(({id,title,extract,url})=>({id,title,extract:extract.slice(0,900),url}))});
 return context;
}
root.InfinityTokenContext=Object.freeze({load});
const params=new URLSearchParams(location.search),seed=json(localStorage,"omniPhi:codeSeed:v1",{}),active=root.OmniPhi?.activeResearch?.();
const currentQuery=(params.get("q")||seed?.query||active?.query||"").trim(),currentToken=params.get("token")||seed?.tokenId||active?.createdAt||"";
const current=load(currentQuery,currentToken);
root.CodePhiTokenContext=current;
const enhance=cards=>Object.freeze({...cards,
 render:(q,results,direction,visuals,id,media)=>cards.render(q,results,direction,visuals,id,media,current),
 actions:(q,html)=>{
  const actions=[];
  if(current.video.length)actions.push("Design around the selected video collection");
  if(current.audio.length)actions.push("Build a listening section from selected audio");
  if(current.images.length)actions.push("Match selected images to their story cards");
  if(current.cards.length)actions.push("Turn collected cards into readable feature sections");
  return [...new Set([...actions,...cards.actions(q,html)])].slice(0,8);
 }
});
let cardSystem;
Object.defineProperty(root,"InfinityPhiCards",{configurable:true,get:()=>cardSystem,set:value=>{cardSystem=enhance(value)}});
const nativeFetch=root.fetch.bind(root);
root.fetch=async(input,init)=>{
 try{
  const url=typeof input==="string"?input:input?.url||"";
  if(init?.method==="POST"&&/\/code-phi\/(plan|inspect)$/.test(new URL(url,location.href).pathname)&&init.body){
   const body=JSON.parse(init.body);body.tokenContext=current.forPrompt();
   body.requirements=[...new Set([...(body.requirements||[]),"Treat tokenContext as the primary content collection","Keep selected images video and audio attached to their collected cards","Use web search only to fill genuine gaps"] )];
   init={...init,body:JSON.stringify(body)};
  }
 }catch{}
 return nativeFetch(input,init);
};
})(window);
