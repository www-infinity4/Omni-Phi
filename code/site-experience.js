/* Code Phi Site Experience v1 — turns a token-backed research preview into
   a purpose-built website. WidgetPhi components may work behind the scenes. */
(function(root){
 'use strict';
 const text=x=>String(x??'').replace(/\s+/g,' ').trim();
 const https=x=>{try{const u=new URL(String(x||''));return u.protocol==='https:'?u.href:''}catch{return ''}};
 const hashed=s=>{let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
 function mediaSource(raw){
  const original=https(raw);if(!original)return null;
  const u=new URL(original),h=u.hostname.toLowerCase().replace(/^www\./,'');let id='',provider='',embed='';
  if(h==='youtube.com'||h==='m.youtube.com'||h==='youtube-nocookie.com'||h==='youtu.be'){
   const list=u.searchParams.get('list')||'';
   if((u.pathname==='/playlist'||!u.searchParams.get('v'))&&/^[A-Za-z0-9_-]{12,80}$/.test(list)){
    id=list;provider='YouTube playlist';embed='https://www.youtube-nocookie.com/embed/videoseries?list='+encodeURIComponent(id);
   }else{
    id=h==='youtu.be'?u.pathname.split('/')[1]:u.searchParams.get('v')||u.pathname.match(/\/(?:shorts|embed|live)\/([^/?#]+)/)?.[1]||'';
    if(!/^[a-zA-Z0-9_-]{11}$/.test(id))return null;
    provider='YouTube';embed='https://www.youtube-nocookie.com/embed/'+id+'?rel=0';
   }
  }else if(h==='vimeo.com'||h==='player.vimeo.com'){
   id=u.pathname.match(/\/(?:video\/)?(\d{5,12})/)?.[1]||'';
   if(!id)return null;
   provider='Vimeo';embed='https://player.vimeo.com/video/'+id;
  }else if(h==='archive.org'){
   id=u.pathname.match(/\/(?:details|embed)\/([a-zA-Z0-9._-]+)/)?.[1]||'';
   if(!id)return null;
   provider='Internet Archive';embed='https://archive.org/embed/'+encodeURIComponent(id);
  }else return null;
  return {url:original,provider,id,embed};
 }
 function candidates(context={},extras=[]){
  const all=[...(context.video||[]),...(context.cards||[]),...(context.all||[]),...(extras||[])],seen=new Set(),out=[];
  for(const v of all){
   const link=mediaSource(v?.sourceUrl||v?.url||v?.href||'');
   if(!link||seen.has(link.provider+':'+link.id))continue;
   seen.add(link.provider+':'+link.id);
   out.push({...link,title:text(v.title||v.sourceTitle||link.provider+' video').slice(0,150),
     description:text(v.extract||v.description||'').slice(0,550)});
  }
  return out.slice(0,24);
 }
 function paragraphs(raw,max=450){
  const clean=String(raw||'').replace(/\r/g,'').trim();
  if(!clean)return [];
  const lines=clean.split(/\n{2,}/g).flatMap(x=>x.split(/\n(?=[A-Z][^\n]{2,50}:)/g)).map(text).filter(Boolean);
  const result=[];
  for(const line of lines){
   if(line.length<=max){result.push(line);continue}
   const parts=line.match(/[^.!?]+(?:[.!?]+|$)/g)||[line];let bucket='';
   for(const sentence of parts){if(bucket.length+sentence.length>max&&bucket){result.push(bucket.trim());bucket=''}bucket+=sentence}
   if(bucket.trim())result.push(bucket.trim());
  }
  return result.slice(0,22);
 }
 function themeFor(query,token,context){
  const seed=hashed(String(token||query)),c=context?.counts||{},subject=String(query||'').toLowerCase();
  const focus=/\b(album|music|podcast|concert|sound|radio)\b/.test(subject)||Number(c.audio)>Number(c.images)?'listening':
   /\b(film|movie|youtube|video|clip)\b/.test(subject)||Number(c.video)>Number(c.images)?'cinema':
   /\b(paint|art|photograph|museum|sport|baseball|athlete|card|poster)\b/.test(subject)||Number(c.images)>1?'visual':(['listening','cinema','visual'].includes(context?.privateInterestFocus)?context.privateInterestFocus:'editorial');
  const palettes=[['#142942','#f8f5ef','#ac6e2c'],['#241d2d','#fbf7ee','#6d457b'],['#173b38','#f5f7ef','#147e73'],['#3b2423','#fffaf4','#b76345']];
  return {seed,focus,palette:palettes[seed%palettes.length],layout:seed%3===0?'magazine':seed%3===1?'field-guide':'studio'};
 }
 function attachImage(html,{src='',title='Created with Oracle',description=''}={}){
  if(!/^https:\/\//.test(src)&&!/^data:image\/(png|jpeg|webp);base64,/.test(src))return html;
  const d=new DOMParser().parseFromString(String(html||''),'text/html');
  const section=d.getElementById('images')||d.querySelector('main')||d.body;
  if(!section)return html;
  const existing=d.querySelector('[data-phi-created-asset]');
  if(existing)existing.remove();
  const card=d.createElement('figure');card.dataset.phiCreatedAsset='yes';
  card.style.cssText='margin:18px 0;border:1px solid #d5bdd4;background:#fff;padding:12px;border-radius:15px;max-width:100%';
  const img=d.createElement('img');img.src=src;img.alt=title;img.style.cssText='width:100%;height:auto;max-height:620px;object-fit:contain;border-radius:11px';
  const cap=d.createElement('figcaption');cap.textContent=title+(description?' · '+description:'');
  card.append(img,cap);section.prepend(card);
  return '<!doctype html>\n'+d.documentElement.outerHTML;
 }
 function ensureStoryReaders(doc){
  for(const card of doc.querySelectorAll('.phi-card.story,.phi-card.research,article.story-card,#stories article,article[data-phi-story],article[data-story-id],article[data-story-url]')){
   if(card.querySelector('details.phi-full-story,details[data-full-story]'))continue;
   const original=card.querySelector('p'),source=card.querySelector('a.more,a[href^="https://"]');
   const full=(card.dataset.fullStory||original?.textContent||'').trim();
   const sourceHref=source?.getAttribute('href')||card.dataset.storyUrl||'';
   if(!full&&!sourceHref)continue;
   const chunks=paragraphs(full,340);
   const detail=doc.createElement('details');detail.className='phi-full-story';
   const summary=doc.createElement('summary');
   summary.textContent=full.length>=250?'Read full story':'Read story & source';
   detail.append(summary);
   if(full){
    if(original){
     const teaser=full.length>180?full.slice(0,180).replace(/\s+\S*$/,'')+'…':full.slice(0,110)+(full.length>110?'…':'');
     original.textContent=teaser;
    }
    for(const part of chunks){
     const paragraph=doc.createElement('p');paragraph.textContent=part;detail.append(paragraph);
    }
   }
   if(/^https:\/\//i.test(sourceHref)){
    const anchor=doc.createElement('a');anchor.href=sourceHref;anchor.textContent='Continue at original source ↗';
    anchor.target='_blank';anchor.rel='noopener noreferrer';detail.append(anchor);
   }
   // A source snippet is evidence, not a generated full-length article.
   if(full.length<250){
    const note=doc.createElement('small');
    note.textContent='Short source extract. Open the original source for additional material.';
    detail.append(note);
   }
   card.append(detail);
  }
  // Whole card activation supports touch screens and keyboard-safe native
  // details behavior. Existing links/buttons still keep their own actions.
  if(!doc.getElementById('phi-story-card-open')){
   const script=doc.createElement('script');script.id='phi-story-card-open';
   script.textContent="document.addEventListener('click',function(event){const card=event.target.closest('.phi-card.story,.phi-card.research,article.story-card,#stories article,article[data-phi-story]');if(!card||event.target.closest('a,button,summary,details,input,select,textarea,[contenteditable]'))return;const reader=card.querySelector('details.phi-full-story');if(reader)reader.open=!reader.open;});";
   doc.body.append(script);
  }
  const css=doc.createElement('style');css.id='phi-story-reader-style';
  css.textContent='.phi-card.story,.phi-card.research{cursor:pointer}.phi-full-story{margin-top:14px;border-top:1px solid #ab8dca;padding-top:11px}.phi-full-story summary{cursor:pointer;font-weight:900;display:block;padding:11px 13px;border:1px solid #9f7dcd;border-radius:999px;color:#482077;background:#f6efff}.phi-full-story[open] summary{margin-bottom:12px}.phi-full-story p{margin:9px 0;white-space:normal;line-height:1.65}.phi-full-story a{display:inline-block;margin-top:12px;color:#6427a4;font-weight:800}.phi-full-story small{display:block;margin-top:9px}';
  if(!doc.getElementById(css.id))doc.head.append(css);
  return doc;
 }
 function addReaders(html){
  try{
   const doc=new DOMParser().parseFromString(String(html||''),'text/html');
   ensureStoryReaders(doc);
   return '<!doctype html>\n'+doc.documentElement.outerHTML;
  }catch{return String(html||'')}
 }
 function enhance(html,{query='',tokenId='',context={},videos=[]}={}){
  if(!String(html||'').trim()||typeof DOMParser==='undefined')return html;
  const doc=new DOMParser().parseFromString(String(html),'text/html'),title=doc.title||text(query)||'Your website';
  const theme=themeFor(query,tokenId,context),[ink,paper,accent]=theme.palette;
  const body=doc.body;body.dataset.phiStyle=theme.layout;body.dataset.phiFocus=theme.focus;
  doc.getElementById('codephi-site-experience')?.remove();
  const style=doc.createElement('style');style.id='codephi-site-experience';
  style.textContent=`:root{--phi-ink:${ink};--phi-paper:${paper};--phi-accent:${accent}}
  body{background:var(--phi-paper)!important;color:var(--phi-ink)!important;font:16px/1.55 system-ui,sans-serif!important;max-width:1100px!important;margin:0 auto!important}
  header{min-height:240px!important;max-height:540px;padding:56px 24px 32px!important}
  header h1{font-size:clamp(2.35rem,7vw,4.3rem)!important;letter-spacing:-.035em}
  header p{max-width:61ch;font-size:1rem!important}
  main.wrap{padding:22px clamp(14px,3vw,34px) 80px!important}
  .wrap section{margin:0 0 36px}
  .rail,.image-rail{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(min(100%,270px),1fr))!important;
  grid-auto-flow:row!important;grid-auto-columns:auto!important;overflow:visible!important;scroll-snap-type:none!important;gap:16px!important}
  .rail-arrow,.rail-shell>.rail-arrow{display:none!important}
  .phi-card{min-height:auto!important;border-radius:14px!important;border-top:3px solid var(--accent,var(--phi-accent))!important;
  box-shadow:0 5px 25px #00000012!important;padding:18px!important}
  .phi-card p{line-height:1.6;overflow-wrap:anywhere}
  .image-tile{height:auto!important;aspect-ratio:4/3!important;border-radius:12px!important}
  .image-tile img{width:100%;height:100%;object-fit:cover}
  .phi-video{border-radius:14px;overflow:hidden;background:#13131e;color:white;min-height:220px;display:grid}
  .phi-video button{border:0;cursor:pointer;color:white;background:#2d2452;
  min-height:170px;padding:16px;font:inherit;font-weight:800;text-align:center}
  .phi-video button:focus-visible{outline:3px solid #f5d862;outline-offset:-5px}
  .phi-video iframe{width:100%;aspect-ratio:16/9;border:0;min-height:210px}
  .phi-video small{display:block;color:#eedca4;padding:8px}
  .phi-provenance{color:#5d5271;font-size:.85rem;margin:8px 0 17px}
  details.phi-deep{margin:10px 0;background:#f8f4ff;border-radius:12px;padding:12px 15px}
  details.phi-deep summary{font-weight:800;cursor:pointer}
  details.phi-deep p{max-width:70ch;line-height:1.7}
  body[data-phi-focus="visual"] .image-tile:first-child{grid-column:span 1}
  body[data-phi-style="magazine"] main>section:first-child{border-left:5px solid var(--phi-accent);padding-left:15px}
  body[data-phi-focus="cinema"] #video{order:-1}
  body[data-phi-focus="listening"] #audio{order:-1}
  @media(min-width:700px){body{max-width:1100px!important}.wrap{display:flex;flex-direction:column}}
  @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
  `;
  doc.head.append(style);
  const sections=[...doc.querySelectorAll('main.wrap > section')];
  const order=theme.focus==='cinema'?['video','stories','images','audio','sources']:
    theme.focus==='listening'?['audio','stories','images','video','sources']:
    theme.focus==='visual'?['images','stories','video','audio','sources']:['stories','images','video','audio','sources'];
  const main=doc.querySelector('main.wrap');
  if(main){for(const id of order){const el=doc.getElementById(id);if(el&&el.parentNode===main)main.append(el)}}
  for(const arrow of doc.querySelectorAll('.rail-arrow'))arrow.remove();
  // Existing card rail script generates arrows. Suppress after it executes;
  // keep the existing audio-player script intact.
  doc.getElementById('codephi-rail-cleanup')?.remove();
  const onReady=doc.createElement('script');onReady.id='codephi-rail-cleanup';onReady.textContent="document.addEventListener('DOMContentLoaded',()=>document.querySelectorAll('.rail-arrow').forEach(x=>x.remove()));";body.append(onReady);
  const overview=doc.querySelector('#overview .phi-card');
  const overviewTitle=doc.querySelector('#overview > h2');if(overviewTitle)overviewTitle.textContent='The essentials';
  const kindLabel=overview?.querySelector('.type');if(kindLabel)kindLabel.textContent='Reader’s guide';
  const small=doc.querySelector('header small');if(small)small.textContent='CURATED WITH PHI · '+theme.focus.toUpperCase();
  const hero=doc.querySelector('header p');
  const full=context?.overview||overview?.querySelector('p')?.textContent||'';
  const chunks=paragraphs(full,380);
  if(hero){hero.textContent=(chunks[0]||text(query)).slice(0,185);}
  if(overview){
   const node=overview.querySelector('p');if(node)node.textContent=(chunks[0]||'').slice(0,440);
   const heading=overview.querySelector('h3');if(heading)heading.textContent='At a glance';
   if(chunks.length>1){
    const details=doc.createElement('details');details.className='phi-deep';const summary=doc.createElement('summary');summary.textContent='Explore the deeper research';details.append(summary);
    for(const part of chunks.slice(1)){const p=doc.createElement('p');p.textContent=part;details.append(p)}
    overview.append(details);
   }
  }
  const headingMap={stories:'Discover',images:'Visual archive',video:'Watch',audio:'Listen',sources:'Research & credits'};
  for(const [id,label] of Object.entries(headingMap)){const h=doc.querySelector('#'+id+' h2');if(h)h.textContent=label}
  // Remove unsupported "search continuing" stories once a real source exists.
  for(const image of doc.querySelectorAll('img')){
   const src=https(image.getAttribute('src'));
   if(!src||/\.svg(?:\?|$)/i.test(src)&&!/^https:\/\//.test(src)){image.remove();continue}
   image.loading='lazy';image.referrerPolicy='strict-origin-when-cross-origin';
   image.setAttribute('onerror',"this.style.display='none';this.closest('.image-tile')?.classList.add('image-unavailable')");
  }
  // EVERY story card needs a meaningful reading action. Do not duplicate
  // the teaser as the full story or pretend a short source extract is complete.
  ensureStoryReaders(doc);
  const gathered=candidates(context,videos);
  const videoArea=doc.querySelector('#video .rail');
  if(videoArea&&gathered.length){
   videoArea.replaceChildren();
   for(const [i,v] of gathered.entries()){
    const card=doc.createElement('article');card.className='phi-card video';card.dataset.provider=v.provider;card.dataset.videoUrl=v.url;
    const h=doc.createElement('h3');h.textContent=v.title;card.append(h);
    const player=doc.createElement('div');player.className='phi-video';const button=doc.createElement('button');button.type='button';button.dataset.phiEmbed=v.embed;button.setAttribute('aria-label','Load '+v.provider+' player for '+v.title);button.textContent='▶ Watch '+v.provider+' video';player.append(button);card.append(player);
    if(v.description){const p=doc.createElement('p');p.textContent=v.description.slice(0,280);card.append(p)}
    const link=doc.createElement('a');link.href=v.url;link.textContent='Original video ↗';link.rel='noopener noreferrer';link.target='_blank';card.append(link);
    videoArea.append(card);
   }
   doc.getElementById('codephi-video-loader')?.remove();
   const runtime=doc.createElement('script');runtime.id='codephi-video-loader';
   runtime.textContent="document.addEventListener('click',function(e){var b=e.target.closest('[data-phi-embed]');if(!b)return;var src=b.dataset.phiEmbed;if(!/^https:\\/\\/(www\\.youtube-nocookie\\.com|player\\.vimeo\\.com|archive\\.org)\\//.test(src))return;var f=document.createElement('iframe');f.src=src;f.title=b.getAttribute('aria-label');f.loading='lazy';f.allow='accelerometer;autoplay;encrypted-media;picture-in-picture;fullscreen';f.allowFullscreen=true;f.referrerPolicy='strict-origin-when-cross-origin';b.replaceWith(f);});";
   body.append(runtime);
  }
  doc.querySelector('meta[name="phi-quant-source"]')?.remove();
  doc.getElementById('codephi-lifecycle')?.remove();
  const lifecycle=doc.createElement('script');lifecycle.id='codephi-lifecycle';
  lifecycle.textContent=`(function(){
   const advance=card=>{
    const rail=card?.parentElement;if(!rail||!rail.classList.contains('rail')||rail.children.length<2)return;
    if(card.dataset.phiReadComplete==='yes')return;
    card.dataset.phiReadComplete='yes';
    rail.append(card);
    const first=rail.querySelector('.phi-card');
    const heading=first?.querySelector('h3');
    if(heading)heading.setAttribute('tabindex','-1');
    const status=document.querySelector('#phi-reading-status');
    if(status)status.textContent=heading?'Next: '+heading.textContent:'Next selected discovery ready';
   };
   document.addEventListener('ended',e=>{
    if(e.target.matches('audio,video'))advance(e.target.closest('.phi-card'));
   },true);
   document.addEventListener('toggle',e=>{
    const detail=e.target;
    if(!detail.matches('details.phi-full-story'))return;
    if(detail.open)detail.dataset.phiOpened='yes';
    else if(detail.dataset.phiOpened==='yes')advance(detail.closest('.phi-card'));
   },true);
  })();`;
  body.append(lifecycle);
  const feedback=doc.createElement('p');feedback.id='phi-reading-status';feedback.style.cssText='font-size:12px;color:#655772;margin:8px 0';feedback.setAttribute('aria-live','polite');
  if(main)main.append(feedback);
  const meta=doc.createElement('meta');meta.name='phi-quant-source';meta.content=String(tokenId).slice(0,120);doc.head.append(meta);
  doc.querySelector('.phi-provenance')?.remove();
  const provenance=doc.createElement('p');provenance.className='phi-provenance';provenance.textContent='This edition follows your selected research and Quant interests. Media remains credited to its original sources.';
  if(main)main.prepend(provenance);
  return '<!doctype html>\n'+doc.documentElement.outerHTML;
 }
 root.CodePhiSiteExperience=Object.freeze({mediaSource,candidates,paragraphs,themeFor,enhance,attachImage,addReaders});
})(window);
