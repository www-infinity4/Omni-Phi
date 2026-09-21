(function(root){
"use strict";
const COLORS=Object.freeze({
 overview:{color:"yellow",label:"AI Overview",hex:"#f4c542"},
 story:{color:"orange",label:"Full Story",hex:"#ef7b32"},
 knowledge:{color:"blue",label:"Knowledge",hex:"#3f78c5"},
 image:{color:"pink",label:"Images",hex:"#ee8fba"},
 video:{color:"red",label:"Video",hex:"#d84b4b"},
 audio:{color:"black",label:"Audio",hex:"#171717"},
 timeline:{color:"tan",label:"Timeline",hex:"#c9a97d"},
 research:{color:"purple",label:"Research",hex:"#8053a6"},
 source:{color:"green",label:"Sources",hex:"#3f985b"},
 interactive:{color:"teal",label:"Interactive",hex:"#2b9993"},
 culture:{color:"brown",label:"Culture",hex:"#835b42"},
 system:{color:"gray",label:"System",hex:"#707780"}
});
const esc=s=>String(s||"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
const jesusStories=[
 ["The Nativity","Jesus is born in Bethlehem after Mary and Joseph travel there. Shepherds receive the announcement and visit the child, while the story presents the birth as hope arriving in humble circumstances."],
 ["Jesus in the Temple","As a boy, Jesus remains in Jerusalem and is found speaking with teachers in the Temple. The account introduces his unusual understanding and his devotion to his Father's work."],
 ["The Wedding at Cana","At a wedding feast, Jesus turns water into wine after the supply runs out. The story joins ordinary celebration with generosity and is presented in John as the first public sign of his ministry."],
 ["The Good Samaritan","Jesus answers a question about loving one's neighbor with the story of an injured traveler helped by a Samaritan. Compassion, rather than status or group identity, becomes the measure of neighborly love."],
 ["Feeding the Five Thousand","A large crowd follows Jesus into a remote place. A small offering of loaves and fish becomes enough to feed everyone, making the story one of provision, sharing, and abundance."],
 ["Walking on Water","During a storm, the disciples see Jesus walking across the water toward their boat. Fear gives way to recognition, while Peter's attempt to follow becomes a story about courage and wavering trust."],
 ["The Last Supper","Jesus shares a final meal with his disciples before his arrest. Bread and wine become signs of remembrance, service, sacrifice, and the continuing community formed around his teaching."],
 ["Crucifixion and Resurrection","The Gospel story moves through Jesus' arrest, crucifixion, burial, and the discovery of the empty tomb. For Christians, the resurrection is the central declaration that death and injustice do not have the final word."]
];
function infer(query){
 const q=String(query||"").trim(),l=q.toLowerCase();
 const jesus=/\bjesus\b/.test(l)&&/\b(story|stories|life|gospel|parables?)\b/.test(l);
 const music=/\b(band|music|album|singer|artist|pink floyd)\b/.test(l);
 return {
  query:q,title:jesus?"The Stories of Jesus":q,
  kind:jesus?"story-collection":music?"music-archive":"research-publication",
  nav:jesus?["Stories","Images","Video","Audio","Timeline","Sources"]:music?["Overview","Archive","Articles","Music","Films","Culture","Sources"]:["Overview","Features","Images","Video","Audio","Sources"],
  stories:jesus?jesusStories:[]
 };
}
function sourceCards(results){
 return (results||[]).slice(0,8).map(x=>({title:x.title||"Source",text:String(x.content||x.description||"").slice(0,420),url:x.url||"#"}));
}
function render(query,results,direction,visuals){
 const p=infer(query),sources=sourceCards(results),stories=p.stories.length?p.stories.map(x=>({title:x[0],text:x[1]})):sources.slice(0,6);
 const nav=p.nav.map(x=>'<a href="#'+esc(x.toLowerCase())+'">'+esc(x)+'</a>').join("");
 const cards=(items,type)=>items.map(x=>'<article class="phi-card '+type+'"><span class="type">'+COLORS[type].label+'</span><h3>'+esc(x.title)+'</h3><p>'+esc(x.text)+'</p>'+(x.url&&x.url!=="#"?'<a class="more" href="'+esc(x.url)+'" target="_blank" rel="noopener">Read source</a>':"")+'</article>').join("");
 const overview=p.kind==="story-collection"?"An illustrated collection of the life, teachings, parables, death, and resurrection of Jesus, organized for reading, listening, watching, and further study.":p.kind==="music-archive"?"A living publication connecting biography, archives, recordings, films, imagery, cultural influence, and reliable sources.":"A living research website shaped from the search, selected media, and strongest available sources.";
 return '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(p.title)+'</title><style>body{margin:0;background:#fffaf2;color:#201728;font:16px/1.55 system-ui}header{min-height:52vh;display:grid;align-content:end;padding:clamp(30px,7vw,90px);background:linear-gradient(135deg,#20102e,#71379b 62%,#e58437);color:white}h1{font-size:clamp(3rem,10vw,7rem);line-height:.92;margin:12px 0;max-width:900px}nav{position:sticky;top:0;z-index:5;display:flex;gap:8px;overflow:auto;padding:12px;background:#21152aed}nav a{color:white;text-decoration:none;padding:8px 12px;border-radius:999px;background:#ffffff18;white-space:nowrap}.wrap{max-width:1180px;margin:auto;padding:26px}.rail{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(280px,36%);gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;padding:4px 2px 18px}.phi-card{border-radius:22px;padding:20px;min-height:230px;scroll-snap-align:start;box-shadow:0 10px 28px #2d183019;border-top:9px solid var(--accent);background:white}.type{font-size:.72rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.story{--accent:#ef7b32}.knowledge{--accent:#3f78c5}.image{--accent:#ee8fba}.video{--accent:#d84b4b}.audio{--accent:#171717}.timeline{--accent:#c9a97d}.research{--accent:#8053a6}.source{--accent:#3f985b}.overview{--accent:#f4c542}.media{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.image-rail{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(210px,28%);gap:12px;overflow-x:auto}.image-tile{display:block;aspect-ratio:4/3;border-radius:18px;overflow:hidden;background:#eee}.image-tile img{width:100%;height:100%;object-fit:cover}.media .phi-card{min-height:160px}.more{font-weight:800;color:#4f2670}@media(max-width:700px){header{min-height:42vh}.rail{grid-auto-columns:86%}.media{grid-template-columns:1fr}}</style></head><body><header><small>INFINITY PHI PRESENTS</small><h1>'+esc(p.title)+'</h1><p>'+esc(overview)+'</p></header><nav>'+nav+'</nav><main class="wrap">'+(direction?'<section><div class="phi-card research"><span class="type">Current direction</span><p>'+esc(direction)+'</p></div></section>':"")+'<section id="overview"><h2>Overview</h2><div class="phi-card overview"><span class="type">AI Overview</span><h3>'+esc(p.title)+'</h3><p>'+esc(overview)+'</p></div></section><section id="stories"><h2>'+(p.kind==="story-collection"?"Stories":"Feature cards")+'</h2><div class="rail">'+cards(stories.length?stories:[{title:p.title,text:"Research is arriving for this token."}],"story")+'</div></section><section id="images"><h2>Images</h2><div class="image-rail">'+((visuals||[]).length?(visuals||[]).slice(0,12).map(x=>'<a class="image-tile" href="'+esc(x.href||x.url||"#")+'" target="_blank" rel="noopener"><img loading="lazy" src="'+esc(x.url||"")+'" alt="'+esc(x.title||p.title)+'"></a>').join(""):'<div class="phi-card image"><span class="type">Images</span><h3>Image gallery</h3><p>Matching artwork and photography are still arriving for this token.</p></div>')+'</div></section><section class="media"><div class="phi-card video"><span class="type">Video</span><h3>Watch</h3><p>Films, documentaries, and playable archive video.</p></div><div class="phi-card audio"><span class="type">Audio</span><h3>Listen</h3><p>Narration, music, interviews, and archive recordings.</p></div></section><section id="sources"><h2>Sources</h2><div class="rail">'+cards(sources.length?sources:[{title:"Source search continuing",text:"Code Phi keeps the page active while stronger sources arrive."}],"source")+'</div></section></main></body></html>';
}
function actions(query,html){
 const p=infer(query),h=String(html||"").toLowerCase(),a=[];
 if(p.kind==="story-collection")a.push("Match an image to every story","Add narrated Jesus stories","Build a chronological journey","Compare Gospel accounts","Add a parables section","Create a children's reading mode");
 else if(p.kind==="music-archive")a.push("Add album-era navigation","Match songs to each era","Build a concert archive","Add films and documentaries","Create an album-art gallery","Add cultural influence");
 else a.push("Strengthen the opening overview","Match images to feature cards","Add a useful interactive tool","Build a timeline","Add playable video","Improve source quality");
 if(!h.includes("audio"))a.unshift("Add an audio section");
 if(!h.includes("sources"))a.unshift("Strengthen sources");
 return [...new Set(a)].slice(0,8);
}
root.InfinityPhiCards=Object.freeze({COLORS,infer,render,actions});
})(window);
