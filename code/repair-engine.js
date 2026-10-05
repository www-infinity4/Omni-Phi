(function(root){
"use strict";
function ensureHead(html,markup){
 if(/<head[\s>]/i.test(html))return html.replace(/<head([^>]*)>/i,m=>m+markup);
 if(/<html[\s>]/i.test(html))return html.replace(/<html([^>]*)>/i,m=>m+"<head>"+markup+"</head>");
 return markup+html;
}
function applySafe(html,report={}){
 let out=String(html||""),repairs=[];
 if(!out.trim())return{html:out,repairs,changed:false};
 if(!/<meta[^>]+name=["']viewport["']/i.test(out)){
  out=ensureHead(out,'<meta name="viewport" content="width=device-width,initial-scale=1">');repairs.push("Added mobile viewport metadata");
 }
 if(!/<title[\s>]/i.test(out)){
  out=ensureHead(out,"<title>Code Phi Build</title>");repairs.push("Added document title");
 }
 const beforeAlt=out;
 out=out.replace(/<img\b(?![^>]*\balt=)([^>]*)>/gi,'<img alt=""$1>');
 if(out!==beforeAlt)repairs.push("Added missing image alt attributes");
 const issues=[...(report.issues||[]),...(report.localPreviewCheck?.issues||[])].map(String);
 if(issues.some(x=>/horizontal.*overflow|mobile overflow/i.test(x))){
  const style='<style id="codephi-safe-repair">html,body{max-width:100%;overflow-x:hidden}img,video,iframe,canvas,svg{max-width:100%;height:auto}*{box-sizing:border-box}</style>';
  if(!/id=["']codephi-safe-repair["']/.test(out)){out=ensureHead(out,style);repairs.push("Constrained media and page width for mobile overflow");}
 }
 const broken=issues.filter(x=>/^Broken image:/i.test(x)).map(x=>x.replace(/^Broken image:\s*/i,"").trim()).filter(Boolean);
 for(const url of broken){
  const q=url.replace(/[.*+?^$()|[\]\\]/g,"\\$&");
  const re=new RegExp('<img\\b([^>]*\\bsrc=["\\\']'+q+'["\\\'][^>]*)>','gi');
  const prior=out;
  out=out.replace(re,'<div role="img" aria-label="Image unavailable" style="min-height:96px;display:grid;place-items:center;background:#eee;border-radius:12px">Image unavailable</div>');
  if(out!==prior)repairs.push("Replaced one broken image with an accessible fallback");
 }
 return{html:out,repairs:[...new Set(repairs)],changed:out!==String(html||"")};
}
root.CodePhiRepairEngine=Object.freeze({applySafe});
})(window);
