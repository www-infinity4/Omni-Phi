/* Ordered capability direction for Code Phi, GPT Oracle Studio, WidgetPhi, APIPhi, LayaPhi, and Web Phi. */
(function(global){
'use strict';
const phases=Object.freeze([
 {id:'identity',tool:'Unified-Wallet',label:'Resolve existing Unified Wallet; never create a guest debit account'},
 {id:'quant-context',tool:'QuantaPhi',label:'Preserve original research token, prior searches, stars, collects and purple assimilation context'},
 {id:'evidence',tool:'Search/Oracle',label:'Verify names, entities, source links and episode metadata before claiming content'},
 {id:'providers',tool:'APIPhi',label:'Find free, approved, keyless providers; discriminate data from licensed embeds'},
 {id:'media',tool:'CreatePhi/APIPhi',label:'Rank relevant image, audio and video candidates, check identity and licensing, retain provenance'},
 {id:'components',tool:'WidgetPhi',label:'Select story, image, video, podcast, ticker or live-data cards from the capability catalog'},
 {id:'art-direction',tool:'Oracle / GPT Oracle Studio',label:'Choose identity, color, card affordances and adaptive variants, not repetitive templates'},
 {id:'layout',tool:'LayaPhi / DesiPhi',label:'Generate varied responsive layouts, accessible player controls and Read More text'},
 {id:'lifecycle',tool:'WidgetPhi',label:'Advance on completed media or finished reading; no horizontal carousel required'},
 {id:'reward-settlement',tool:'Unified-Wallet',label:'Use signed server receipts: Infinity-funded reward credits versus viewer-to-creator paid unlocks'},
 {id:'review',tool:'Code Phi Cloud Browser',label:'Inspect rendered output, working URLs, visual quality, captions, empty and failed states'},
 {id:'repair',tool:'Code Phi',label:'Repair blockers, rerun verification and preserve a reversible working revision'},
 {id:'publish',tool:'Web Phi',label:'Publish durable version only after QA; preserve original search and wallet ownership'}
]);
function review(html,context={}){
 const problems=[],s=String(html||'');
 if(!/<(main|article|section)\b/i.test(s))problems.push('No semantic content container');
 if(/<img\b/i.test(s)&&/<img\b(?![^>]*\balt=)/i.test(s))problems.push('An image needs descriptive alt text');
 if(/<video\b/i.test(s)&&!/controls/i.test(s))problems.push('A video is missing controls');
 if(/data-widgetphi-podcast/.test(s)){
  if(!/FIRST EPISODE FREE/i.test(s))problems.push('Podcast first episode is not marked free');
  if(!/data-quant-context/.test(s))problems.push('Podcast lost Quant provenance');
  if(/next episode/i.test(s)&&!/wallet settlement pending/i.test(s)&&context.walletSettled!==true)problems.push('Paid episode must not be playable without a confirmed Unified Wallet receipt');
 }
 return {schema:'codephi.review/v1',tokenId:String(context.tokenId||''),checks:phases.map(p=>p.id),missing:problems,ok:problems.length===0};
}
global.CodePhiBuildSequence=Object.freeze({phases,review});
})(window);
