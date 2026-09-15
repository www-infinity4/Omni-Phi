(function(){
  'use strict';
  if(!window.OmniPhi||typeof OmniPhi.fetchWikipedia!=='function')return;
  const previous=OmniPhi.fetchWikipedia.bind(OmniPhi);
  const sports=/\b(baseball|mlb|home run|home runs|batting|pitcher|pitching|yankees|nba|nfl|nhl|football|basketball|hockey|sports)\b/i;

  OmniPhi.fetchWikipedia=async function(query){
    const results=await previous(query);
    if(!sports.test(String(query||'')))return results;
    return (Array.isArray(results)?results:[]).map(source=>({
      ...source,
      title:source.sourceTitle||source.title||'',
      extract:source.sourceExtract||source.extract||'',
      aiGenerated:false,
      sourceLocked:true
    }));
  };
  OmniPhi.fetchAllSources=OmniPhi.fetchWikipedia;
})();
