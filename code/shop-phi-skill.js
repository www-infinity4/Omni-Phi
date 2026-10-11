/* Shop Phi creator-curation editor for Code Phi. Local drafts only until the
 * authenticated WidgetPhi Cloudflare owner catalog service is connected. */
(function(root){
'use strict';
const key='codePhi:shopPhiCreatorDraft:v1';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
const clean=(x,n=150)=>String(x??'').replace(/\s+/g,' ').trim().slice(0,n);
function parse(raw){
 const items=[],seen=new Set(),lines=String(raw||'').split(/\r?\n/).slice(0,70);
 for(const line of lines){
  if(!line.trim())continue;
  const chunks=line.split('|').map(x=>x.trim());
  if(chunks.length<2||chunks.length>3)throw Error('Each line needs: Product title | https://seller/item | Optional seller. Ads use Ad: and a sponsor.');
  const ad=/^Ad:\s*/i.test(chunks[0]),title=clean(chunks[0].replace(/^Ad:\s*/i,''),130);
  let url;try{url=new URL(chunks[1])}catch{throw Error('Source URL must be a real https:// link')}
  if(url.protocol!=='https:'||url.username||url.password||/^(localhost|127\.0\.0\.1)$/i.test(url.hostname))throw Error('Use an original HTTPS merchant or creator source');
  if(title.length<3)throw Error('Give each curated product or ad a real title');
  if(ad&&!chunks[2])throw Error('Sponsored ads must name the advertiser after the second |');
  if(seen.has(url.href))continue;
  seen.add(url.href);
  items.push({title,url:url.href,sponsored:ad,seller:clean(chunks[2]||url.hostname,100),
   sponsor:ad?clean(chunks[2],100):''});
 }
 return items;
}
function build({name='My Curated Store',creator='My Picks',items=[]}={}){
 if(!items.length)throw Error('Add at least one real product or ad source to build Shop Phi');
 const first=items[0],disclosure=first.sponsored?'Sponsored · '+first.sponsor:'Creator-curated selection · not sponsored';
 return '<section data-codephi-widgetphi-card="shop-phi" style="margin:18px 0;padding:20px;border:2px solid #d9a93d;border-radius:20px;background:linear-gradient(145deg,#fff0bd,#f1d6bd);color:#2b1f1a;font-family:system-ui,sans-serif">'+
 '<small>SHOP PHI · OWNER CURATION</small><h2>'+esc(clean(name,100))+'</h2>'+
 '<p><strong>Curated by '+esc(clean(creator,100))+'</strong></p>'+
 '<p>These are the creator’s choices—not advertisements targeted from your personal shopping history.</p>'+
 '<article style="background:white;padding:15px;border-radius:14px;border:1px solid #d9be8a">'+
 '<small>'+esc(disclosure)+'</small><h3>'+esc(first.title)+'</h3><p>Source: '+esc(first.seller)+'</p>'+
 '<a href="'+esc(first.url)+'" target="_blank" rel="'+(first.sponsored?'noopener noreferrer sponsored':'noopener noreferrer')+'" style="display:inline-block;background:#ebc959;color:#33250e;padding:10px 14px;border-radius:10px">Open original shop ↗</a></article>'+
 '<button type="button" disabled style="margin-top:12px;padding:12px;border:1px solid #a18d62;border-radius:10px">Next curator pick · 1 StarCoin (wallet connection pending)</button>'+
 '<p style="font-size:12px">One curated pick is free. This draft cannot charge or reveal further paid picks. Sponsored and affiliate offers require disclosure and verified seller sources.</p>'+
 '</section>';
}
function mount(){
 const $=id=>document.getElementById(id);
 const name=$('shopPhiName'),creator=$('shopPhiCreator'),lines=$('shopPhiSources'),
       button=$('shopPhiAdd'),note=$('shopPhiStatus'),viewer=$('viewer');
 if(!name||!creator||!lines||!button||!note||!viewer)return;
 try{const prior=JSON.parse(localStorage.getItem(key)||'null');
  if(prior){name.value=prior.name||'';creator.value=prior.creator||'';lines.value=prior.lines||''}
 }catch{}
 function save(){
  try{localStorage.setItem(key,JSON.stringify({name:name.value.slice(0,140),creator:creator.value.slice(0,140),lines:lines.value.slice(0,5000)}));
   note.textContent='Shop Phi draft saved on this device as you type. No StarCoins charged.';
  }catch{note.textContent='Preview edits are available, but device storage could not save this draft.'}
 }
 for(const field of [name,creator,lines])field.addEventListener('input',save);
 button.addEventListener('click',()=>{
  try{
   const items=parse(lines.value);
   const html=build({name:name.value,creator:creator.value,items});
   const original=viewer.srcdoc||'<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body><main></main></body></html>';
   const doc=new DOMParser().parseFromString(original,'text/html');
   const added=new DOMParser().parseFromString(html,'text/html').body.firstElementChild;
   if(!added||!doc.body)throw Error('Code Phi website preview unavailable');
   const old=doc.querySelector('[data-codephi-widgetphi-card="shop-phi"]');
   if(old)old.replaceWith(added);else(doc.querySelector('main')||doc.body).appendChild(added);
   viewer.srcdoc='<!doctype html>'+doc.documentElement.outerHTML;
   note.textContent='Shop Phi preview added. '+items.length+' source choices in your local draft; one free public preview displayed. Save your website to keep the card.';
  }catch(e){note.textContent=String(e.message||e)}
 });
}
root.CodePhiShopPhi=Object.freeze({parse,build});
if(typeof document!=='undefined'){
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
}
})(window);
