/* Omni overview presentation: brief reader-first copy plus full expandable notes. */
(function(root){
 'use strict';
 const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
 const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function textChunks(input,max=300){
  const lines=String(input||'').replace(/\r/g,'').split(/\n+/).map(clean).filter(Boolean),out=[];
  for(const value of lines){
   const header=value.replace(/^#{1,4}\s*/,'');
   if(/^#{1,4}\s/.test(value)||/^(website direction|value direction|education direction|choose a website path)\b/i.test(header)){out.push({kind:'heading',text:header.slice(0,100)});continue}
   const li=value.match(/^(?:[-*•]|\d+[.)])\s+(.+)/);
   if(li){out.push({kind:'bullet',text:li[1]});continue}
   const sentences=value.match(/[^.!?]+(?:[.!?]+|$)/g)||[value];
   let chunk='';
   for(const sentence of sentences){
    const words=sentence.trim().split(/\s+/);
    for(const word of words){
     if((chunk+' '+word).length>max&&chunk){out.push({kind:'paragraph',text:chunk.trim()});chunk=''}
     chunk+=(chunk?' ':'')+word;
    }
   }
   if(chunk)out.push({kind:'paragraph',text:chunk.trim()});
  }
  return out.slice(0,80);
 }
 function render(input,{visibleParagraphs=2}={}){
  const parts=textChunks(input,300),intro=[],deeper=[];
  let visible=0;
  const emit=(target,item)=>target.push(item.kind==='heading'?'<h3>'+esc(item.text)+'</h3>':item.kind==='bullet'?'<p class="overview-bullet">• '+esc(item.text)+'</p>':'<p>'+esc(item.text)+'</p>');
  for(const item of parts){
   if(visible<visibleParagraphs&&item.kind==='paragraph'){emit(intro,item);visible++}
   else if(visible===0&&item.kind!=='paragraph')emit(intro,item);
   else emit(deeper,item);
  }
  return intro.join('')+(deeper.length?'<details class="omni-overview-more"><summary>Read the full overview and website directions</summary>'+deeper.join('')+'</details>':'');
 }
 function image(src){
  const value=String(src||'').trim();
  if(/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/i.test(value)&&value.length<=2500000)return value;
  try{const u=new URL(value);if(u.protocol!=='https:')return'';return u.href}catch{return''}
 }
 function fallback(img){
  if(!img||img.dataset.omniFallbackInstalled==='true')return;
  img.dataset.omniFallbackInstalled='true';
  img.addEventListener('error',()=>{
   const parent=img.parentElement;
   if(parent?.querySelector('.omni-image-unavailable'))return;
   const notice=document.createElement('div');notice.className='omni-image-unavailable';notice.setAttribute('role','img');
   notice.setAttribute('aria-label','Source image unavailable');
   notice.textContent='Source image unavailable · Open its reference to view the original';
   notice.style.cssText='min-height:120px;padding:18px;display:grid;place-items:center;background:linear-gradient(135deg,#f4eee6,#e5e1ed);color:#594a62;border-radius:11px;font-size:13px;text-align:center';
   img.style.display='none';parent?.insertBefore(notice,img.nextSibling);
  },{once:true});
 }
 root.OmniOverviewPolish=Object.freeze({textChunks,render,image,fallback});
})(window);
