(function(root){
"use strict";
const entities=Object.freeze({
 "steve-winwood":{
  id:"person:steve-winwood",type:"person",name:"Steve Winwood",
  aliases:["steve winwood","stephen lawrence winwood"],
  ids:{wikidata:"Q211311",musicbrainz:"7681c51f-1f65-4c7b-9f9d-9af0b6539bc5"},
  facets:["biography","eras","bands","albums","songs","performances","interviews","images","video","audio","culture","sources"],
  eras:[
   {label:"Early years and Spencer Davis Group",from:1963,to:1967,summary:"Teenage breakthrough as singer and keyboard player, including the era of Keep On Running, Somebody Help Me and Gimme Some Lovin'."},
   {label:"Traffic",from:1967,to:1974,summary:"Traffic joined rock, soul, folk and jazz through changing lineups and albums including Mr. Fantasy, John Barleycorn Must Die and The Low Spark of High Heeled Boys."},
   {label:"Blind Faith and collaborations",from:1969,to:1977,summary:"Blind Faith, studio work and collaborations connected Winwood with Eric Clapton, Ginger Baker, Jimi Hendrix and other major artists."},
   {label:"Solo breakthrough",from:1977,to:1989,summary:"The solo catalog grew from Steve Winwood and Arc of a Diver to Back in the High Life and Roll with It."},
   {label:"Later work and legacy",from:1990,to:null,summary:"Later albums, touring, collaborations and reappraisal of a career spanning British rhythm and blues, progressive rock, soul and pop."}
  ],
  works:[
   {kind:"band",title:"The Spencer Davis Group",year:1963},
   {kind:"band",title:"Traffic",year:1967},
   {kind:"band",title:"Blind Faith",year:1969},
   {kind:"album",title:"Arc of a Diver",year:1980},
   {kind:"album",title:"Talking Back to the Night",year:1982},
   {kind:"album",title:"Back in the High Life",year:1986},
   {kind:"album",title:"Roll with It",year:1988},
   {kind:"song",title:"Gimme Some Lovin'",year:1966},
   {kind:"song",title:"While You See a Chance",year:1980},
   {kind:"song",title:"Higher Love",year:1986},
   {kind:"song",title:"Roll with It",year:1988}
  ]
 }
});
const key=s=>String(s||"").toLowerCase().replace(/\b(music|songs?|albums?|videos?|images?|photos?|biography|history|website)\b/g," ").replace(/[^a-z0-9]+/g," ").trim();
function find(query){
 const q=key(query);
 return Object.values(entities).find(e=>e.aliases.some(a=>q===a||q.startsWith(a+" ")||q.endsWith(" "+a)))||null;
}
function resolve(query){
 const e=find(query); if(!e)return null;
 const cards=[
  {title:e.name+" — indexed subject",content:"Prepared catalog: "+e.facets.join(", ")+".",url:"https://www.wikidata.org/wiki/"+e.ids.wikidata},
  ...e.eras.map(x=>({title:x.label+" ("+x.from+"–"+(x.to||"present")+")",content:x.summary,url:"https://en.wikipedia.org/wiki/Steve_Winwood"})),
  ...e.works.map(x=>({title:x.title+" · "+x.kind+" · "+x.year,content:"Indexed "+x.kind+" connected to "+e.name+". Use this record to rank the page, retrieve matching media, and refine by era.",url:"https://musicbrainz.org/artist/"+e.ids.musicbrainz}))
 ];
 return {entity:e,cards,mediaQueries:e.eras.map(x=>e.name+" "+x.label),facets:e.facets};
}
root.InfinityEntityCatalog=Object.freeze({schema:"infinity-entity-catalog/v1",entities,find,resolve});
})(window);
