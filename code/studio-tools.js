/* Code Phi builder-side Oracle asset studio and verified media feed chooser.
   Never insert a paid entitlement or claim a stock image is an AI render. */
(function(root){
 'use strict';
 function mount({viewer,query,tokenId,context=()=>({})}={}){
  if(!viewer||!root.CodePhiSiteExperience)return null;
  const $=id=>document.getElementById(id),safe=x=>{try{const u=new URL(x);return u.protocol==='https:'?u.href:''}catch{return''}};
  const studio=root.CodePhiSiteExperience;
  const storageKey='codePhi:videoFeed:'+tokenId;
  let videos=[],asset=null,inProgress=false;
  try{const saved=JSON.parse(localStorage.getItem(storageKey)||'[]');videos=Array.isArray(saved)?saved.slice(0,24).filter(v=>studio.mediaSource(v.url)):[]}catch{}
  function currentSources(){
   const c=context()||{},xs=[...(c.images||[])];
   try{const d=new DOMParser().parseFromString(viewer.srcdoc||'','text/html');
    d.querySelectorAll('img[src]').forEach(img=>xs.push({imageUrl:img.src,title:img.alt||'Site visual'}))
   }catch{}
   const seen=new Set();
   return xs.map(x=>({url:safe(x.imageUrl||x.image||x.src||''),title:String(x.title||x.sourceTitle||'Source image').slice(0,80)}))
    .filter(x=>{if(!x.url||seen.has(x.url))return false;seen.add(x.url);return true}).slice(0,45);
  }
  function refreshSources(){
   const select=$('assetReference');if(!select)return;
   const val=select.value;select.replaceChildren();
   const empty=document.createElement('option');empty.value='';empty.textContent='Text-only image / upload instead';select.append(empty);
   for(const [i,item] of currentSources().entries()){const el=document.createElement('option');el.value=item.url;el.textContent=(i+1)+'. '+item.title;select.append(el)}
   if([...select.options].some(o=>o.value===val))select.value=val;
  }
  function refreshVideos(){
   const box=$('videoSelections');if(!box)return;
   box.replaceChildren();
   for(const [i,v] of videos.entries()){
    const line=document.createElement('p');
    const label=document.createElement('span');label.textContent=(i+1)+'. '+v.provider+' video · '+v.title+' ';
    const remove=document.createElement('button');remove.type='button';remove.textContent='Remove';remove.style.cssText='font-size:11px;padding:5px';
    remove.onclick=()=>{videos=videos.filter(item=>item.url!==v.url);save();refreshVideos();refreshPreview()};
    line.append(label,remove);box.append(line);
   }
  }
  function save(){try{localStorage.setItem(storageKey,JSON.stringify(videos))}catch{}}
  function refreshPreview(){
   const orig=viewer.srcdoc||'<!doctype html><html><head><title>My site</title></head><body><main><h1>'+query.replace(/[<>]/g,'')+'</h1><section id="video"><h2>Watch</h2><div class="rail"></div></section><section id="images"><h2>Visuals</h2></section></main></body></html>';
   viewer.srcdoc=studio.enhance(orig,{query,tokenId,context:context(),videos});
   if(asset)viewer.srcdoc=studio.attachImage(viewer.srcdoc,asset);
  }
  async function loadReference(){
   const upload=$('assetFile').files?.[0];
   if(upload){if(!/^image\/(png|jpeg|webp)$/.test(upload.type)||upload.size>10e6)throw Error('Upload a PNG/JPG/WebP image under 10 MB.');return upload}
   const url=$('assetReference').value;
   if(!url)return null;
   const response=await fetch(url,{mode:'cors',credentials:'omit',signal:AbortSignal.timeout(9000)});
   if(!response.ok)throw Error('The chosen source image did not load. Upload the reference image instead.');
   const blob=await response.blob();
   if(!/^image\/(png|jpeg|webp)$/.test(blob.type)||blob.size>10e6)throw Error('The reference image is not a supported file. Upload a PNG/JPG/WebP.');
   return new File([blob],'site-reference.'+(blob.type==='image/png'?'png':'jpg'),{type:blob.type});
  }
  async function compactSiteImage(src){
   if(!/^data:image\/(png|jpeg|webp);base64,/.test(String(src)))return src;
   const img=await new Promise((ok,fail)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>fail(Error('Generated image cannot be resized'));i.src=src});
   const max=1200,scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
   const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
   const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,canvas.width,canvas.height);
   for(const quality of [.84,.72,.58]){
    const data=canvas.toDataURL('image/jpeg',quality);
    if(data.length<650000)return data;
   }
   throw Error('This artwork is too large for website storage. Download or host the image before publishing it.');
  }
  async function generate(){
   if(inProgress)return;
   const status=$('assetFeedback'),prompt=$('assetPrompt').value.trim();
   if(prompt.length<15){status.textContent='Describe the artwork you want in at least 15 characters.';return}
   const renderer=root.PhiVisualRender;if(!renderer){status.textContent='Oracle image renderer has not loaded. Try the image generator on QuantaPhi.';return}
   const button=$('assetGenerate');inProgress=true;button.disabled=true;
   try{
    status.textContent='Preparing reference image from this website…';
    const source=await loadReference();
    status.textContent=source?'Reading the reference image with Oracle…':'Planning a text-only visual…';
    let vision='';if(source)vision=await renderer.inspect(source);
    const titles=currentSources().slice(0,7).map(x=>x.title).join('; ');
    const contextText=[query,'Quant token '+tokenId,'Site images: '+titles,'Selected search topic: '+String(context()?.query||query)].join('\n');
    status.textContent='Oracle is composing an original image prompt…';
    let fullPrompt;
    try{fullPrompt=await renderer.direct({description:prompt,mode:'Image',vision,search:contextText,hasUpload:!!source,exactText:''})}
    catch{fullPrompt=renderer.modePrompt('Image')+'\n'+prompt+'\n'+vision+'\n'+contextText}
    status.textContent='Rendering original site artwork…';
    const out=await renderer.render({description:prompt,mode:'Image',source,prompt:fullPrompt,exactText:''});
    const dimensions=await renderer.validate(out.src);
    let review=null;try{review=await renderer.review({src:out.src,description:prompt,mode:'Image',exactText:''})}catch{}
    asset={src:out.src,title:'Original visual for '+query,description:prompt,dimensions,renderer:out.renderer,review};
    const img=$('assetResult');img.src=out.src;img.style.display='block';$('assetUse').disabled=false;
    status.textContent='Original artwork created '+dimensions.width+'×'+dimensions.height+(review?.status?' · Review '+review.status:'')+'. Tap Add artwork to put it into the site preview.';
   }catch(error){status.textContent='No finished asset: '+String(error?.message||error).slice(0,210)}
   finally{inProgress=false;button.disabled=false}
  }
  $('studioArtwork')?.addEventListener('click',()=>{$('siteAssetLab').hidden=false;$('siteAssetLab').scrollIntoView({behavior:'smooth',block:'center'});refreshSources()});
  $('studioVideos')?.addEventListener('click',()=>{$('siteVideoLab').hidden=false;$('siteVideoLab').scrollIntoView({behavior:'smooth',block:'center'});refreshVideos()});
  $('studioPodcast')?.addEventListener('click',()=>{$('podcastMaker').hidden=false;$('podcastMaker').scrollIntoView({behavior:'smooth',block:'center'})});
  $('assetGenerate')?.addEventListener('click',()=>void generate());
  $('assetUse')?.addEventListener('click',async()=>{
   if(!asset)return;
   const btn=$('assetUse');btn.disabled=true;
   try{
    const compact=await compactSiteImage(asset.src);
    asset={...asset,src:compact,siteOptimized:true};
    refreshPreview();
    $('assetFeedback').textContent='Optimized artwork added to this site's preview. Review it in the complete site before publishing. A provider-hosted URL is preferable for long-term sharing.';
   }catch(error){$('assetFeedback').textContent='Artwork kept in the asset preview: '+error.message}
   finally{btn.disabled=false}
  });
  $('videoAdd')?.addEventListener('click',()=>{
   const value=$('videoLink').value.trim(),v=studio.mediaSource(value);
   if(!v){$('videoFeedback').textContent='Use an actual YouTube watch/short, Vimeo video, or Internet Archive item URL. No unrelated result will be substituted.';return}
   if(!videos.some(x=>x.url===v.url))videos.push({...v,title:v.provider+' video '+v.id});
   videos=videos.slice(-24);save();refreshVideos();refreshPreview();
   $('videoFeedback').textContent=v.provider+' source added. The finished page will load its official player on demand.';$('videoLink').value='';
  });
  refreshSources();refreshVideos();
  return Object.freeze({videos:()=>videos.slice(),asset:()=>asset,refreshSources,refreshPreview});
 }
 root.CodePhiStudioTools=Object.freeze({mount});
})(window);
