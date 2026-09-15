(function(){
  if(!window.OmniPhi||!OmniPhi.collectSource)return;
  const original=OmniPhi.collectSource;
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
        if(source.image)saved.image=source.image;
        if(saved.sourceTitle)saved.title=saved.sourceTitle;
        if(saved.sourceExtract)saved.extract=saved.sourceExtract;
        localStorage.setItem(sharedKey,JSON.stringify(shared));
      }
    }catch(_){ }
    return result;
  };
})();
