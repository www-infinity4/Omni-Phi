/* Code Phi Oracle Studio — viewer-first shared Infinity + Omni editor.
 * Projects only persist HTML locally until the owner chooses Publish.
 * No wallet mint, debit, purchase or other account mutation on load or iteration.
 */
(() => {
  'use strict';
  if (window.__codePhiOracleWorkspace) return;
  window.__codePhiOracleWorkspace = true;
  const $ = id => document.getElementById(id);
  const viewer = $('viewer'), subject = $('subject'), instruction = $('instruction');
  const safeText = (v,n=800) => String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,n);
  const escapeHtml = s => String(s||'').replace(/[&<>"']/g,ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const read = (key,def=null) => { try { const value=JSON.parse(localStorage.getItem(key)||'null'); return value==null?def:value; } catch {return def;} };
  const getSearch = () => new URLSearchParams(location.search);
  const p=getSearch(), storedSeed=read('omniPhi:codeSeed:v1',{}), research=read('omniPhi:lastResearch:v1',{});
  const rememberedToken=read('omniPhi:lastSearchToken:v1',{});
  let query=safeText(p.get('q') || storedSeed?.query || research?.query || '',400);
  let tokenId=safeText(p.get('token') || storedSeed?.tokenId || rememberedToken?.tokenId || '',140);
  const exactQuery=v=>safeText(v,400).toLowerCase()===query.toLowerCase();
  const scopedResearch = exactQuery(research?.query) ? research : {};
  const directionSeed=read('omniPhi:websiteDirection:v1',{});
  const sourceSeed=[
    ...(Array.isArray(scopedResearch?.sources)?scopedResearch.sources:[]),
    ...(Array.isArray(storedSeed?.sources)&&exactQuery(storedSeed?.query)?storedSeed.sources:[]),
    ...(directionSeed?.tokenId && directionSeed.tokenId===tokenId && Array.isArray(directionSeed?.selectedImages)?directionSeed.selectedImages:[])
  ];
  const unique=new Set();
  const evidence=sourceSeed.map(item=>{
    const url=safeText(item?.sourceUrl||item?.url||item?.href||'',1200);
    let trusted='';
    try{const check=new URL(url);if(check.protocol==='https:')trusted=check.href}catch(_){}
    return {
      title:safeText(item?.title||item?.sourceTitle||item?.name||'',140),
      extract:safeText(item?.extract||item?.sourceExtract||item?.description||'',400),
      url:trusted, image:safeText(item?.image||item?.imageUrl||'',1200)
    };
  }).filter(item=>{
    if(!item.title && !item.url)return false;
    const key=item.url||item.title.toLowerCase();
    if(unique.has(key))return false;unique.add(key);return true;
  }).slice(0,15);
  const overview=safeText(scopedResearch?.overview||storedSeed?.overview||directionSeed?.overview||'',1450);
  const projectKey=()=> 'phiOracle:project:v2:'+safeText(tokenId||query||'default',110);
  const notes=[];
  let busy=false,rev=0,history=[],html='',expanded=false,linked=false;
  const projectId=()=>tokenId||'search topic (unminted)';
  const setBadge=s=>$('engineBadge').textContent=s;
  function announce(message,type='info'){
    const node=$('statusMessage');
    node.textContent=String(message);
    node.className='notice'+(type==='error'?' error':type==='success'?' success':'');
  }
  function eventLog(message){
    const item=document.createElement('li'),time=document.createElement('time');
    time.dateTime=new Date().toISOString();
    time.textContent=new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
    item.append(time,document.createTextNode(String(message)));
    $('historyList').prepend(item);
    while($('historyList').children.length>14)$('historyList').lastElementChild.remove();
  }
  function projectHeading(){
    $('projectName').textContent=query || 'New website';
    $('projectMeta').textContent='Source: '+(p.get('from')==='infinity'?'Infinity Phi':p.get('from')==='omni'?'Omni Phi':'Phi research')+
      ' · '+(tokenId?'Original token '+tokenId.slice(0,24):'No token required for a local preview')+
      ' · '+evidence.length+' saved source'+(evidence.length===1?'':'s');
    subject.value=query;
    document.title=(query?query+' · ':'')+'Code Phi Oracle Studio';
  }
  function buildStarter(){
    const topic=query||'Your next website';
    const linkTerm=encodeURIComponent(query.slice(0,120));
    const body=overview?
      '<p class="lede">'+escapeHtml(overview)+'</p>':
      '<p class="lede">Your website starts here. Enter a direction in the Oracle Studio to develop the content, structure, and design.</p>';
    const features=evidence.length?
      evidence.map((card,i)=>'<article class="feature"><small>RESEARCH '+String(i+1).padStart(2,'0')+'</small><h2>'+escapeHtml(card.title||'Research source')+'</h2><p>'+escapeHtml(card.extract||'Explore the original source for additional context.')+'</p>'+(card.url?'<a href="'+escapeHtml(card.url)+'" target="_blank" rel="noopener noreferrer">Open verified source ↗</a>':'')+'</article>').join(''):
      '<article class="feature empty"><small>YOUR FIRST SECTION</small><h2>Build a complete website from this subject</h2><p>The Oracle workspace can add article sections, research cards, media, interactive controls, and custom design. No unsupported source claims have been added.</p></article>';
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escapeHtml(topic)+'</title><style>'+
      '*{box-sizing:border-box}html,body{margin:0}body{font:16px/1.65 system-ui,sans-serif;background:#110d1d;color:#f8f3ff}header{background:linear-gradient(130deg,#24143b,#593776);padding:18px clamp(18px,4vw,56px);display:flex;gap:15px;align-items:center;justify-content:space-between}header b{letter-spacing:.13em;color:#ffe5a5;font-size:12px}header a{color:#fff;text-decoration:none;border:1px solid #e9ceff69;border-radius:999px;padding:7px 13px;font-size:12px;font-weight:800}main{width:min(1040px,94vw);margin:auto;padding:clamp(32px,8vw,90px) 0}small{font-size:11px;font-weight:900;letter-spacing:.17em;color:#fbd38a}.hero{background:radial-gradient(ellipse at 90% 0,#633884 0,transparent 55%),#261a38;padding:clamp(25px,5vw,70px);border:1px solid #8a579c;border-radius:27px;box-shadow:0 24px 80px #06030e99}.hero h1{font-size:clamp(37px,7vw,76px);line-height:1.05;letter-spacing:-.055em;overflow-wrap:break-word;margin:14px 0 24px}.lede{max-width:780px;color:#e6d9ee;font-size:clamp(16px,2vw,19px)}.actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:22px}.actions a{background:#ffe0a3;color:#241235;border-radius:999px;padding:12px 20px;font-weight:900;text-decoration:none}.actions a+ a{background:#6a3589;color:#fff}.section-head{margin:45px 0 19px;font-size:25px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr));gap:14px}.feature{padding:24px;border:1px solid #684c80;border-radius:21px;background:#241a34}.feature h2{font-size:20px;line-height:1.3;margin:13px 0 8px}.feature p{color:#dccddd}.feature a{display:inline-flex;margin-top:7px;color:#ffe2a5;font-weight:800;text-decoration:none}.empty{grid-column:1/-1}footer{text-align:center;margin:50px auto 0;color:#b79cc7;font-size:12px}@media(max-width:600px){header{flex-wrap:wrap}.hero{padding:25px}.cards{grid-template-columns:1fr}}'+
      '</style></head><body><header><b>CODE PHI · RESEARCH EDITION</b><a href="https://quantaphi.org/">QuantaPhi ↗</a></header><main><section class="hero"><small>WELCOME TO YOUR WEBSITE</small><h1>'+escapeHtml(topic)+'</h1>'+body+'<div class="actions"><a href="https://quantaphi.org/infinity-phi/?q='+linkTerm+'" target="_blank" rel="noopener">Explore in Infinity Phi</a><a href="https://quantaphi.org/omni-phi/overview/?q='+linkTerm+'" target="_blank" rel="noopener">Research in Omni Phi</a></div></section><h2 class="section-head">Research &amp; ideas</h2><div class="cards">'+features+'</div><footer>Created with Code Phi · Oracle Studio</footer></main></body></html>';
  }
  const valid=next=>typeof next==='string'&&next.length>100&&next.length<900000&&/<(?:main|article|section)\b/i.test(next)&&/<html\b/i.test(next)&&/<\/html>/i.test(next);
  function persist(silent=false){
    if(!valid(html))return false;
    const project={schema:'codephi/oracle/v2',query,tokenId,html,history:history.slice(-9),revision:rev,updatedAt:new Date().toISOString(),sourceCount:evidence.length};
    try{
      localStorage.setItem(projectKey(),JSON.stringify(project));
      localStorage.setItem('omniPhi:codeBuild:v3',JSON.stringify({
        schema:'infinity-code-asset/v1',id:'oracle-'+(tokenId||'local'),name:query||'Oracle Site',
        query,tokenId,iteration:rev,html,createdAt:project.updatedAt,creator:'Code Phi Oracle',origin:'generated'}));
      $('saveLabel').textContent='Saved to this device';
      if(!silent)announce('This website revision is saved on this device. Publish only when the page is ready.','success');
      return true;
    }catch(e){$('saveLabel').textContent='Device storage unavailable';if(!silent)announce('Preview is working but device storage could not save it. Export HTML to preserve it.','error');return false;}
  }
  function display(next,description='Working preview',shouldSave=true){
    if(!valid(next))return false;
    html=next;viewer.srcdoc=next;rev+=1;
    history.push({html:next,description,at:Date.now()});
    history=history.slice(-9);
    $('revisionLabel').textContent='Revision '+rev+' · '+description;
    $('previewLabel').textContent=query||'LIVE WEBSITE VIEWER';
    if(!$('sourcePanel').hidden)$('htmlSource').value=next;
    $('undoButton').disabled=history.length<=1;
    if(shouldSave)persist(true);
    eventLog(description);
    return true;
  }
  function restore(){
    const saved=read(projectKey(),null);
    if(valid(saved?.html)&&(!saved.query||exactQuery(saved.query))&&(!saved.tokenId||saved.tokenId===tokenId)){
      const old=Array.isArray(saved.history)?saved.history.filter(x=>valid(x?.html)).slice(-9):[];
      history=old.length?old:[{html:saved.html,description:'Restored website',at:Date.now()}];
      html=saved.html;rev=Math.max(1,Number(saved.revision)||history.length);
      viewer.srcdoc=html;
      $('revisionLabel').textContent='Revision '+rev+' · Restored working website';
      $('undoButton').disabled=history.length<=1;
      $('saveLabel').textContent='Restored saved website';
      eventLog('Restored previously saved website');
      announce('Your previous working site was restored. You can change it without rebuilding from zero.','success');
      return;
    }
    display(buildStarter(),evidence.length?'Research starter':'Oracle starter');
    announce('Your starter website is ready. Describe your changes and press Build / Iterate website.');
  }
  function setBusy(value){
    busy=value;$('viewerLoading').hidden=!value;$('buildButton').disabled=value;
    $('publishButton').disabled=value;$('undoButton').disabled=value||history.length<=1;
    $('applyHtml').disabled=value;$('engineBadge').textContent=value?'Oracle creating…':'Editor ready';
    $('buildButton').textContent=value?'Creating next version…':'✦ Build / Iterate website';
  }
  function setNewTopic(newTopic){
    if(!newTopic||newTopic===query)return;
    query=newTopic;tokenId='';history=[];rev=0;
    // A manually typed new topic does not inherit the unrelated previous token.
    evidence.length=0;
    projectHeading();
    display(buildStarter(),'New subject');
  }
  async function build(){
    if(busy)return;
    const requested=safeText(subject.value,400);
    if(!requested){subject.focus();announce('Enter the website subject first.','error');return;}
    if(requested!==query)setNewTopic(requested);
    const note=safeText(instruction.value,1400)||'Build a polished, functional, mobile-first website using the subject and collected sources.';
    if(!window.CodePhiGPTDirector?.compose){
      announce('The Oracle AI connection script did not load. You can still edit HTML, save, restore, and export the current site.','error');setBadge('AI unavailable');return;
    }
    const base=html, prior=history.length,context={
      all:evidence.map(x=>({...x,sourceUrl:x.url,sourceTitle:x.title,sourceExtract:x.extract})),
      overview,origin:p.get('from')||'phi',tokenId,query
    };
    setBusy(true);announce('Asking Oracle to revise the current website. Your existing preview remains intact.');
    eventLog('Oracle requested: '+note.slice(0,95));
    try{
      const result=await window.CodePhiGPTDirector.compose({
        query,tokenId,direction:note,latestDirection:note,iteration:prior+1,
        previousHtml:base,draftHtml:base,context
      });
      if(!result?.ok||!valid(result.html)){
        throw Error(result?.reason||'The AI service did not return a complete website. Your previous version was preserved.');
      }
      const repaired=window.CodePhiRepairEngine?.applySafe(result.html)||{html:result.html};
      if(!valid(repaired.html))throw Error('Incomplete HTML returned; current website was preserved.');
      if(repaired.html===base){announce('Oracle did not change the website. Try a more specific instruction.');return;}
      display(repaired.html,'Oracle iteration '+(rev+1));
      instruction.value='';
      announce('New website iteration appears in the viewer. The last working version remains in Undo.','success');
    }catch(error){
      announce('The AI iteration could not complete: '+safeText(error?.message||error,350)+'. Your working preview was not overwritten.','error');
      eventLog('Oracle iteration failed; previous website kept');
    }finally{setBusy(false)}
  }
  function undo(){
    if(busy||history.length<=1)return;
    history.pop();const last=history[history.length-1];
    html=last.html;viewer.srcdoc=html;rev=Math.max(1,rev-1);
    $('revisionLabel').textContent='Revision '+rev+' · Restored previous version';
    $('undoButton').disabled=history.length<=1;
    if(!$('sourcePanel').hidden)$('htmlSource').value=html;
    persist(true);announce('Previous working website restored.','success');eventLog('Reverted one version');
  }
  function exportHtml(){
    if(!valid(html)){announce('There is no complete HTML to export.','error');return;}
    const blob=new Blob([html],{type:'text/html;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=(query||'code-phi').toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,50)+'-website.html';
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    eventLog('Website HTML exported');announce('HTML export started. The source remains available in the HTML viewer.','success');
  }
  function readDeviceToken(){
    // Do not choose between multiple wallet identities or create a guest account.
    const found=new Set();
    try{
      for(let i=0;i<localStorage.length;i++){
        const key=localStorage.key(i)||'';
        if(!key.startsWith('starquest_ledger_device_v1:'))continue;
        const value=localStorage.getItem(key)||'';
        let token=value;
        try{const parsed=JSON.parse(value);token=parsed?.deviceToken||''}catch(_){}
        if(/^sq_[A-Za-z0-9_-]{32,}$/.test(token))found.add(token);
      }
    }catch(_){}
    return found.size===1?[...found][0]:'';
  }
  async function publish(){
    if(busy)return;
    if(!valid(html)){announce('The website HTML is not complete yet.','error');return;}
    const deviceToken=readDeviceToken();
    if(!deviceToken){
      announce('Publishing requires your existing connected Unified Wallet identity. Reopen QuantaPhi in this browser, then return here. Your website remains saved.','error');
      eventLog('Publish not attempted: no unambiguous existing wallet');
      return;
    }
    setBusy(true);
    announce('Sending this exact website revision to the public QuantaPhi page store…');
    try{
      const revisionId='oracle-'+Date.now().toString(36);
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),27000);
      let response;
      try{
        response=await fetch('https://quanta-phi-ledger.marvaseater.workers.dev/v1/pages',{
          method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+deviceToken},
          body:JSON.stringify({revision_id:revisionId,html,title:query||'Oracle website',source_token:tokenId}),
          signal:controller.signal
        });
      }finally{clearTimeout(timer)}
      const reply=await response.json().catch(()=>({}));
      const url=String(reply.url||'');
      if(!response.ok||!reply.ok||!/^https:\/\/quantaphi\.org\/page\/\?id=p_[a-z0-9]{20,40}$/.test(url)){
        throw Error(reply.error||'The page server did not confirm a public URL (HTTP '+response.status+').');
      }
      persist(true);
      localStorage.setItem('codePhi:deployReady:v1',JSON.stringify({query,tokenId,html,revisionId,publicUrl:url,status:'published',publishedAt:new Date().toISOString()}));
      announce('Your website was published successfully: '+url,'success');eventLog('Published '+url);
      const link=document.createElement('a');
      link.href=url;link.textContent='Open published website ↗';link.target='_blank';link.rel='noopener noreferrer';
      link.style.cssText='display:block;margin-top:10px;color:#ffe49d;font-weight:850';
      $('statusMessage').append(link);
    }catch(error){
      announce('Publication was not confirmed: '+safeText(error?.message||error,280)+'. Your local website is still saved.','error');
      eventLog('Public publishing not confirmed');
    }finally{setBusy(false)}
  }
  function openBuilder(open){
    const panel=$('infinityPanel'),frame=$('infinityEngineFrame');
    panel.hidden=!open;$('builderToggle').setAttribute('aria-expanded',String(open));
    if(!open)return;
    if(!frame.src){
      const u=new URL('https://quantaphi.org/infinity-phi/phi/code/builder/');
      if(query)u.searchParams.set('q',query);
      if(tokenId)u.searchParams.set('token',tokenId);
      frame.src=u.href;
    }
    panel.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function sendToCompanion(){
    const frame=$('infinityEngineFrame'),target=frame.contentWindow;
    if(!target||!frame.src)return;
    const url=new URL(frame.src);
    if(url.origin!==location.origin)return;
    target.postMessage({type:'phi-oracle/seed/v1',query,tokenId,html:valid(html)?html.slice(0,480000):'',direction:instruction.value.slice(0,1200)},location.origin);
    linked=true;eventLog('Sent working HTML to Infinity builder');
  }
  window.addEventListener('message',event=>{
    const frame=$('infinityEngineFrame');
    if(event.origin!==location.origin||event.source!==frame.contentWindow)return;
    const data=event.data;
    if(!data||typeof data!=='object')return;
    if(data.type==='phi-oracle/ready/v1'){sendToCompanion();return;}
    if(data.type==='phi-oracle/preview/v1'&&valid(data.html)){
      if(data.html===html)return;
      display(data.html,'Infinity builder import');
      announce('Infinity builder sent its latest website into this Oracle viewer. Continue iterating here.','success');
    }
  });
  function bind(){
    projectHeading();restore();
    $('buildButton').addEventListener('click',build);
    instruction.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();void build()}});
    $('undoButton').addEventListener('click',undo);
    $('saveButton').addEventListener('click',()=>{persist();eventLog('Website saved')});
    $('exportButton').addEventListener('click',exportHtml);
    $('publishButton').addEventListener('click',publish);
    $('sourceToggle').addEventListener('click',()=>{
      const open=$('sourcePanel').hidden;
      $('sourcePanel').hidden=!open;
      $('sourceToggle').setAttribute('aria-pressed',String(open));
      if(open){$('htmlSource').value=html;$('sourcePanel').scrollIntoView({block:'nearest',behavior:'smooth'})}
    });
    $('applyHtml').addEventListener('click',()=>{
      const draft=$('htmlSource').value;
      if(!valid(draft)){announce('Please enter a complete HTML document with HTML and main content tags. The viewer was not changed.','error');return;}
      display(draft,'Manual HTML edit');announce('Your HTML changes now appear in the live viewer.','success');
    });
    $('deviceToggle').addEventListener('click',()=>{
      const mobile=$('canvasFrame').classList.toggle('mobile');
      $('deviceToggle').setAttribute('aria-pressed',String(mobile));
      $('deviceToggle').textContent=mobile?'Desktop':'Mobile';
    });
    $('fullToggle').addEventListener('click',()=>{
      expanded=!expanded;document.body.classList.toggle('full',expanded);
      $('fullToggle').setAttribute('aria-pressed',String(expanded));
      $('fullToggle').textContent=expanded?'Collapse':'Expand';
    });
    $('builderToggle').addEventListener('click',()=>openBuilder($('infinityPanel').hidden));
    $('builderClose').addEventListener('click',()=>openBuilder(false));
    $('infinityEngineFrame').addEventListener('load',sendToCompanion);
    document.querySelectorAll('[data-idea]').forEach(button=>button.addEventListener('click',()=>{
      const val=button.dataset.idea||'';
      instruction.value=instruction.value.trim()?instruction.value.trim()+'\n'+val:val;
      instruction.focus();
    }));
    window.addEventListener('beforeunload',()=>{if(valid(html))persist(true)});
    // Reconnect the original artwork and video tools. Their changes are
    // captured as full undoable Oracle revisions rather than silently editing
    // the iframe and losing the saved workspace state.
    if(window.CodePhiStudioTools?.mount && window.CodePhiSiteExperience){
      window.CodePhiStudioTools.mount({
        viewer, query, tokenId,
        context:()=>({
          query,all:evidence,
          images:evidence.filter(item=>item.image).map(item=>({...item,imageUrl:item.image}))
        })
      });
      const studioObserver=new MutationObserver(()=>{
        const candidate=viewer.srcdoc;
        if(!busy && valid(candidate) && candidate!==html){
          display(candidate,'Media Studio update');
          announce('Media Studio updated this website. The previous revision remains available through Undo.','success');
        }
      });
      studioObserver.observe(viewer,{attributes:true,attributeFilter:['srcdoc']});
      eventLog('Artwork and playable video tools connected');
    }
    if(linked)sendToCompanion();
  }
  bind();
})();
