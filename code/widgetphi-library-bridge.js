/* Code Phi's read-only Cloudflare WidgetPhi card finder.
 * Installs existing ticker components into website preview; no wallet writes. */
(function(root){
 'use strict';
 const LIBRARY='https://widgetphi-card-library.marvaseater.workers.dev';
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
 function symbols(raw){
  const parts=String(raw||'').split(/[,\n\s]+/).map(x=>x.trim().toUpperCase()).filter(Boolean);
  if(!parts.length||parts.length>15||parts.some(x=>!/^(?:[A-Z0-9._-]{2,20}:)?[A-Z0-9.^-]{1,16}$/.test(x)))throw Error('Enter 1–15 symbols, for example NASDAQ:AAPL,NASDAQ:MSFT');
  return [...new Set(parts)];
 }
 function tickerHTML(raw,title){
  const pairs=symbols(raw).map(s=>{const parts=s.split(':');return{proName:s,title:parts.at(-1)}});
  const config={symbols:pairs,showSymbolLogo:true,isTransparent:false,displayMode:'adaptive',colorTheme:'light',locale:'en'};
  const safe=JSON.stringify(config).replace(/</g,'\\u003c');
  return '<section data-codephi-widgetphi-card="market-ticker" style="background:white;color:#211e2b;padding:16px;border:1px solid #d4c9de;border-radius:18px;margin:20px 0">'+
   '<h2>'+esc(title||'My Market Ticker')+'</h2><p><small>WidgetPhi existing market-ticker · TradingView source</small></p>'+
   '<div class="tradingview-widget-container"><div class="tradingview-widget-container__widget"></div>'+
   '<script async type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js">'+safe+'</script></div>'+
   '<p><small>Informational market display. No StarCoins charged or generated.</small></p></section>';
 }
 function appendPreview(html){
  const frame=document.getElementById('viewer');if(!frame)throw Error('Code Phi website viewer missing');
  const before=frame.srcdoc||'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>My website</title></head><body><main></main></body></html>';
  const doc=new DOMParser().parseFromString(before,'text/html');
  const fresh=new DOMParser().parseFromString(html,'text/html').body.firstElementChild;
  if(!fresh||!doc.body)throw Error('No safe website preview');
  const old=doc.querySelector('[data-codephi-widgetphi-card="'+fresh.dataset.codephiWidgetphiCard+'"]');
  if(old)old.replaceWith(fresh);else(doc.querySelector('main')||doc.body).append(fresh);
  frame.srcdoc='<!doctype html>'+doc.documentElement.outerHTML;
 }
 async function query(q,fetcher=fetch){
  const uri=LIBRARY+'/v1/cards?q='+encodeURIComponent(String(q||'').slice(0,130));
  const r=await fetcher(uri,{cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw Error('Cloudflare card library not responding');
  const data=await r.json();
  if(data.schema!=='phi.card-library/public-v1'||!Array.isArray(data.cards))throw Error('Invalid card registry response');
  return data.cards;
 }
 function mount(){
  const section=document.getElementById('widgetPhiLibrary');
  const output=document.getElementById('widgetPhiResults');
  const notice=document.getElementById('widgetPhiStatus');
  const input=document.getElementById('widgetPhiSymbols');
  const subject=document.getElementById('subject'),direction=document.getElementById('instruction');
  if(!section||!output||!notice||!input||!subject)return;
  let previous='',running=0,pending=null;
  async function refresh(){
   const q=(direction?.value?.trim()||subject.value.trim()).slice(0,130);
   if(q.length<3||q===previous)return;
   previous=q;const run=++running;notice.textContent='Looking for working cards already stored in Cloudflare…';
   try{
    const cards=await query(q);
    if(run!==running)return;
    output.replaceChildren();
    for(const card of cards.slice(0,6)){
     const row=document.createElement('div');row.className='media-row';
     const title=document.createElement('strong');title.textContent=card.name+' · '+card.readiness;
     const desc=document.createElement('p');desc.textContent=card.description||'Reusable Phi template';
     row.append(title,desc);
     if(card.id==='market-ticker'&&card.readyToEmbed){
      const btn=document.createElement('button');btn.type='button';btn.textContent='Add this stock ticker';
      btn.addEventListener('click',()=>{
       try{
        const markup=tickerHTML(input.value,subject.value+' · Ticker');
        appendPreview(markup);notice.textContent='Working WidgetPhi ticker added to your existing Code Phi preview. Save your website to keep the change.';
       }catch(e){notice.textContent=e.message||'Ticker settings are incomplete'}
      });
      row.append(btn);
     }else if(card.id==='media-star'){
      const btn=document.createElement('button');btn.type='button';btn.textContent='Configure Media Star';
      btn.addEventListener('click',()=>document.getElementById('mediaStarPrompt')?.scrollIntoView({behavior:'smooth'}));
      row.append(btn);
     }else if(card.id==='video-feed'){
      const btn=document.createElement('button');btn.type='button';btn.textContent='Configure video feed';
      btn.addEventListener('click',()=>document.getElementById('studioVideos')?.click());
      row.append(btn);
     }else{
      const p=document.createElement('small');p.textContent=card.readyToEmbed?'WidgetPhi adapter available; Code Phi installer pending.':'Card integration pending. No fake preview will be inserted.';
      row.append(p);
     }
     output.append(row);
    }
    notice.textContent=cards.length+' relevant catalog card(s) found. Working installations use verified existing components.';
   }catch(e){
    if(run===running){previous='';notice.textContent='Cloudflare catalog could not load. Existing website and cards remain unchanged.'}
   }
  }
  const debounce=()=>{if(pending)clearTimeout(pending);pending=setTimeout(refresh,650)};
  subject.addEventListener('input',debounce);
  direction?.addEventListener('input',debounce);
  debounce();
 }
 root.CodePhiWidgetLibrary=Object.freeze({symbols,tickerHTML,query});
 if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
 }
})(window);
