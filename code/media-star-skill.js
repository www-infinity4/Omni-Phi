/* Code Phi Media Star skill adapter; reusable, source-only and opt-in.
 * No wallet actions, provider downloads, or automatic releases. */
(function(root){
'use strict';
const text=(v,n=160)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,n);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
function identify(item){
 const data=typeof item==='string'?{url:item}:item||{};
 let u;try{u=new URL(data.url||data.sourceUrl||data.imageUrl||data.image||'')}catch{return null}
 if(u.protocol!=='https:'||u.username||u.password)return null;
 const host=u.hostname.toLowerCase().replace(/^www\./,''),path=u.pathname;
 let provider='',kind='',embed='';
 if(host==='youtube.com'||host==='m.youtube.com'||host==='youtu.be'){
  const id=host==='youtu.be'?path.slice(1):u.searchParams.get('v')||path.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1];
  if(!/^[\w-]{11}$/.test(id||''))return null;
  provider='YouTube';kind='video';embed='https://www.youtube-nocookie.com/embed/'+id;
 }else if(host==='vimeo.com'||host==='player.vimeo.com'){
  const id=path.match(/\/(?:video\/)?(\d{5,13})(?:\/|$)/)?.[1];if(!id)return null;
  provider='Vimeo';kind='video';embed='https://player.vimeo.com/video/'+id;
 }else if(host==='open.spotify.com'){
  const m=path.match(/^\/(episode|show|track)\/([A-Za-z0-9]{22})/);if(!m)return null;
  provider='Spotify';kind='audio';embed='https://open.spotify.com/embed/'+m[1]+'/'+m[2];
 }else if((host==='x.com'||host==='twitter.com')&&/^\/i\/spaces\/[A-Za-z0-9]{10,25}\/?$/.test(path)){
  provider='X Space';kind='audio';
 }else if(/\.(mp3|m4a|ogg|wav|opus)$/i.test(path)){provider='Original audio';kind='audio'}
 else if(/\.(mp4|webm)$/i.test(path)){provider='Original video';kind='video'}
 else if(/\.(png|jpe?g|webp|avif|gif)$/i.test(path)){provider='Image';kind='image'}
 else return null;
 return {url:u.href,provider,kind,embed,title:text(data.title||data.sourceTitle||data.alt||provider+' source',140),
  sourceKey:text(data.sourceKey||data.researchId||'',100)};
}
function propose({query='',collected=[],images=[],videos=[],title='My Media Star'}={}){
 const sources=[...collected,...videos,...images],seen=new Set(),items=[];
 for(const v of sources.slice(0,200)){
  const item=identify(v);if(!item||seen.has(item.url))continue;
  seen.add(item.url);items.push(item);
 }
 const q=text(query,180),interest=/galax|star|film|video|audio|music|art|gallery|podcast|sound|space|planet|astronom/i.test(q);
 return {title:text(title,80)||'My Media Star',query:q,items,
  action:items.length?'offer_add_media_star':interest?'find_and_collect_media_first':'optional',
  payment:'not_connected',playback:'provider_sources_only',collectedCount:items.length};
}
function buildHtml(draft){
 if(!draft||!Array.isArray(draft.items)||!draft.items.length)throw Error('Collect a genuine media source before adding Media Star');
 const title=esc(draft.title),first=draft.items[0];
 const items=draft.items.map((v,i)=>{
  const url=esc(v.url),caption=esc(v.title),native=esc(v.provider);
  const preview=v.embed?'<iframe src="'+esc(v.embed)+'" title="'+caption+'" loading="lazy" referrerpolicy="no-referrer" allow="fullscreen; encrypted-media" style="width:100%;height:260px;border:0;border-radius:11px"></iframe>':
    v.kind==='image'?'<img src="'+url+'" alt="'+caption+'" style="max-width:100%;max-height:260px;object-fit:contain" loading="lazy">':
    '<a href="'+url+'" target="_blank" rel="noopener noreferrer">▶ Open original '+native+'</a>';
  return '<details'+(i===0?' open':'')+' style="margin:9px 0;padding:9px;border:1px solid #c5a759;border-radius:10px">'+
    '<summary>'+caption+' · '+native+'</summary>'+preview+
    '<p><a href="'+url+'" target="_blank" rel="noopener noreferrer">Original source ↗</a></p></details>';
 }).join('');
 return '<section class="phi-media-star-skill" data-phi-media-star-draft="1" style="margin:20px 0;padding:17px;border:2px solid #d6aa42;border-radius:18px;background:#fff1bd;color:#322448">'+
 '<strong>✦ MEDIA STAR · YOUR CURATED COLLECTION</strong><h2>'+title+'</h2>'+
 '<p>Media found or collected for '+esc(draft.query||'your website')+'. Rename or edit this card in Code Phi without changing the source URLs.</p>'+
 items+'<p style="font-size:12px">Playback uses the original provider. Paid unlocks remain disabled until your creator wallet has a real Cloudflare / StarQuest settlement receipt.</p></section>';
}
root.CodePhiMediaStarSkills=Object.freeze({identify,propose,buildHtml});
})(window);
