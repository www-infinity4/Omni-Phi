(function(){
  if(!window.OmniPhi||!OmniPhi.collectSource)return;

  const NEWS_PHI_URL='https://www-infinity4.github.io/News-Phi/';
  const original=OmniPhi.collectSource;

  function storyKey(source){
    return source.storyKey||source.url||source.id||String(source.title||'card').toLowerCase().replace(/[^a-z0-9]+/g,'-');
  }

  function newsPhiUrl(source){
    const params=new URLSearchParams({
      collect:'1',
      from:'omni-phi',
      sharedTitle:source.sourceTitle||source.title||'Collected Omni Phi card',
      sharedBody:String(source.sourceExtract||source.extract||'').slice(0,1800),
      sharedUrl:source.url||'',
      sharedImage:source.image||'',
      sharedDomain:source.domain||source.provider||'Omni Phi',
      sharedQuery:source.searchQuery||OmniPhi.activeResearch?.()?.query||''
    });
    return `${NEWS_PHI_URL}?${params.toString()}#story=${encodeURIComponent(storyKey(source))}`;
  }

  OmniPhi.collectSource=function(source){
    const result=original(source);
    try{
      const key=source.url||source.id||source.title;
      const sharedKey=OmniPhi.STORAGE.sharedCollection;
      const shared=JSON.parse(localStorage.getItem(sharedKey)||'[]');
      const saved=shared.find(item=>(item.url||item.id||item.title)===key);
      if(saved){
        saved.sourceTitle=source.sourceTitle||source.title||'';
        saved.sourceExtract=source.sourceExtract||source.extract||'';
        saved.sourceBacked=Boolean(source.url);
        saved.imageVerified=Boolean(source.image);
        saved.aiGenerated=Boolean(source.aiGenerated);
        saved.searchQuery=saved.searchQuery||OmniPhi.activeResearch?.()?.query||'';
        if(source.image)saved.image=source.image;
        if(saved.sourceTitle)saved.title=saved.sourceTitle;
        if(saved.sourceExtract)saved.extract=saved.sourceExtract;
        localStorage.setItem(sharedKey,JSON.stringify(shared));
      }

      // Collect is a bridge action: keep Omni's personalization signal, then
      // carry the exact source card into News Phi so its story card builds now.
      location.href=newsPhiUrl(saved||source);
    }catch(_){
      location.href=newsPhiUrl(source);
    }
    return result;
  };
})();
