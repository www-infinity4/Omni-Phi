/* Code Phi yellow podcast/Spaces card, WidgetPhi-compatible v1.
   Does not spend, mint, or promise playback from third-party page URLs. */
(function(root){
 'use strict';
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
 const plain=(x,n=320)=>String(x??'').replace(/\s+/g,' ').trim().slice(0,n);
 const url=x=>{try{const u=new URL(String(x||''));return u.protocol==='https:'?u.href:''}catch{return ''}};
 const directAudio=x=>/\.(mp3|m4a|ogg|oga|wav|opus)(\?|#|$)/i.test(String(x||''));
 const isXML=x=>/\.xml(\?|$)|rss|feed|podcast/i.test(x);
 const classify=x=>{let h='';try{h=new URL(x).hostname.toLowerCase()}catch{}return /(^|\.)x\.com$|(^|\.)twitter\.com$/.test(h)?'X Spaces':/facebook\.com$/.test(h)?'Facebook':/spotify\.com$/.test(h)?'Spotify':/podcasts\.apple\.com$/.test(h)?'Apple Podcasts':isXML(x)?'RSS':'Episode link'};
 const validPrice=n=>Number.isInteger(Number(n))&&Number(n)>=0&&Number(n)<=100;
 function normalize(input){
  const link=url(input?.sourceUrl);if(!link)throw Error('Enter an HTTPS episode or RSS feed link.');
  const price=Number(input?.priceStarCoins??1);if(!validPrice(price))throw Error('Price must be a whole StarCoin amount between 0 and 100.');
  const rawEpisodes=Array.isArray(input.episodes)&&input.episodes.length?input.episodes:[{
   title:input.episodeTitle||'Episode information pending verification',
   sourceUrl:link,description:input.description||''}];
  const episodes=rawEpisodes.slice(0,40).map((e,i)=>{
   const source=url(e.sourceUrl||link),audio=url(e.audioUrl);
   return {id:plain(e.id||'ep-'+(i+1),65),title:plain(e.title||'Episode '+(i+1),160),
    description:plain(e.description||'',950),full:plain(e.full||'',5000),
    sourceUrl:source||link,audioUrl:e.authorizedAudio===true&&directAudio(audio)?audio:'',
    duration:plain(e.duration||'',50),imageUrl:url(e.imageUrl)};
  });
  return {schema:'widgetphi.podcast-card/v1',title:plain(input.title||'Podcast / Spaces',120),
   host:plain(input.host||'',110),sourceUrl:link,sourceType:classify(link),
   priceStarCoins:price,firstFree:true,wallet:'unified-wallet',
   creatorWalletId:plain(input.creatorWalletId||'',128),
   paymentState:'server-verification-required',episodes,
   quantContext:{query:plain(input.query||'',180),tokenId:plain(input.tokenId||'',90)}};
 }
 async function scan(source){
  const link=url(source);if(!link)throw Error('A valid HTTPS episode or RSS link is required.');
  const detected=classify(link);
  const response={sourceUrl:link,sourceType:detected,episodes:[],title:'',host:'',note:''};
  if(detected!=='RSS'){response.note='Original provider page linked. No metadata, playback, or rights inferred without an approved API or supplied files.';return response}
  const c=new AbortController(), timer=setTimeout(()=>c.abort(),7000);
  try{
   const result=await fetch(link,{signal:c.signal,headers:{accept:'application/rss+xml,application/xml,text/xml'}});
   if(!result.ok)throw Error('RSS returned HTTP '+result.status);
   const xml=new DOMParser().parseFromString(await result.text(),'text/xml');
   if(xml.querySelector('parsererror'))throw Error('Not a valid RSS document');
   const channel=xml.querySelector('channel');
   if(!channel)throw Error('Not a podcast RSS channel');
   response.title=plain(channel.querySelector(':scope > title')?.textContent||'',120);
   response.host=plain(channel.querySelector(':scope > managingEditor')?.textContent||'',110);
   response.episodes=[...channel.querySelectorAll(':scope > item')].slice(0,25).map((item,i)=>{
    const audio=item.querySelector('enclosure');
    const audioUrl=url(audio?.getAttribute('url'));
    const mime=audio?.getAttribute('type')||'';
    const sourceUrl=url(item.querySelector('link')?.textContent)||link;
    return {id:plain(item.querySelector('guid')?.textContent||'ep-'+(i+1),65),
     title:plain(item.querySelector('title')?.textContent||'',160)||'Untitled episode',
     description:plain(item.querySelector('description')?.textContent?.replace(/<[^>]*>/g,' ')||'',950),
     sourceUrl,audioUrl:audioUrl&&(/audio\//i.test(mime)||directAudio(audioUrl))?audioUrl:'',
     // RSS enclosures are source evidence, but permission for republishing must be confirmed by the creator.
     authorizedAudio:false};
   });
   response.note='RSS metadata scanned. Confirm creator rights to enable the enclosed audio on a published site.';
  }catch(error){response.note='RSS scan could not complete ('+(error?.name==='AbortError'?'timeout':'cross-origin or provider access')+'). Paste title or attach authorized files; no details were fabricated.'}
  finally{clearTimeout(timer)}
  return response;
 }
 function render(config){
  const c=normalize(config),first=c.episodes[0];
  const artwork=first.imageUrl?'<img loading="lazy" alt="" src="'+esc(first.imageUrl)+'" style="width:100%;max-height:270px;object-fit:cover;border-radius:10px">':'';
  const media=first.audioUrl?'<audio controls preload="none" src="'+esc(first.audioUrl)+'" style="width:100%"></audio>':
    '<a href="'+esc(first.sourceUrl)+'" target="_blank" rel="noopener noreferrer">Open official '+esc(c.sourceType)+' episode / player ↗</a>';
  const synopsis=esc(first.description||'Episode details will appear when a verified feed, source metadata, or transcript is supplied.');
  const list=c.episodes.map((e,i)=>'<li>'+esc(e.title)+' · '+(i===0?'FREE':c.priceStarCoins+' ★')+'</li>').join('');
  const quant=esc(JSON.stringify(c.quantContext));
  return '<section data-widgetphi-podcast data-quant-context="'+quant+'" style="font:16px system-ui;color:#2d230c;background:linear-gradient(145deg,#ffeda6,#f2c43d);padding:18px;border:2px solid #ad7c10;border-radius:12px;margin:20px 0">'+
   '<small style="font-weight:800">YELLOW CARD · PODCAST · FIRST EPISODE FREE</small><h2>'+esc(c.title)+'</h2>'+
   '<p>'+esc(c.host||c.sourceType)+' · '+esc(first.duration)+'</p>'+artwork+
   '<h3>'+esc(first.title)+'</h3><p>'+synopsis+'</p>'+
   (first.full?'<details><summary>Read full episode story</summary><p>'+esc(first.full)+'</p></details>':'')+
   '<div style="background:#27210f;color:#fff8d5;padding:14px;border-radius:10px">'+media+'</div>'+
   '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0"><button type="button" data-phi-action="star">☆ Star</button><button type="button" data-phi-action="share">Share</button><button type="button" data-phi-action="collect">Collect</button></div>'+
   '<details><summary>Episode list &amp; pricing</summary><ol>'+list+'</ol></details>'+
   '<p>Additional playable episodes: <b>'+c.priceStarCoins+' full StarCoins</b> per unlock. Rewards are issued by Infinity; paid unlocks credit the creator wallet after authoritative settlement.</p>'+
   '<button type="button" disabled aria-label="Paid episodes require confirmed Unified Wallet settlement">Next episode · '+c.priceStarCoins+' ★ (wallet settlement pending)</button>'+
   '<p role="status"><small>Paid episodes need an authorized player, verified creator Unified Wallet and a server-side ledger. No balances change in preview.</small></p>'+
   '</section>';
 }
 function apply(html,input){
  if(!html)return html;
  let c;try{c=normalize(input)}catch{return html}
  const marker='<!--CODEPHI_PODCAST_START-->',tail='<!--CODEPHI_PODCAST_END-->';
  let source=String(html).replace(/<!--CODEPHI_PODCAST_START-->[\s\S]*?<!--CODEPHI_PODCAST_END-->/g,'');
  const inserted=marker+render(c)+tail;
  if(/<\/main\s*>/i.test(source))return source.replace(/<\/main\s*>/i,inserted+'</main>');
  if(/<\/body\s*>/i.test(source))return source.replace(/<\/body\s*>/i,inserted+'</body>');
  return source+inserted;
 }
 function audit(html){
  const text=String(html||''),missing=[];
  if(!/data-widgetphi-podcast/.test(text))missing.push('Podcast component missing');
  if(!/data-quant-context/.test(text))missing.push('Quant context was not handed to the card');
  if(!/first episode free/i.test(text))missing.push('First free episode must be prominent');
  if(/<audio/i.test(text)&&!/controls/i.test(text))missing.push('Audio needs accessible playback controls');
  if(/data-phi-action="share"/.test(text)&&!(/unified.wallet|server-side ledger/i.test(text)))missing.push('Wallet/reward contract unclear');
  return {ok:missing.length===0,missing};
 }
 root.CodePhiPodcast=Object.freeze({normalize,scan,render,apply,audit,classify});
})(window);
