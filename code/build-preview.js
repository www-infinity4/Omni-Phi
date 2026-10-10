/* Keep the actual viewer visible; notifications never scroll the document. */
(()=>{'use strict';const panel=document.querySelector('.canvas-panel'),host=window.CodePhiWorkshopHost;if(!panel||!host)return;
const bar=document.createElement('div');bar.id='buildPreviewBar';bar.innerHTML='<p id="buildPreviewMessage" role="status" aria-live="polite">Preparing your website…</p><div><button id="buildPreviewStop" class="button secondary">Stop build</button><button id="buildPreviewExit" class="button secondary">Back to editor</button></div>';panel.append(bar);
let active=false;/* Observe the existing build button without replacing the frozen host. */
function enter(){active=true;document.body.classList.add('build-takeover');document.getElementById('viewerLoading').hidden=true;document.getElementById('buildPreviewStop').hidden=false;notify('Oracle is preparing the next iteration. Your website remains visible.');}
function notify(text,role){document.getElementById('buildPreviewMessage').textContent=String(text);bar.dataset.role=role||'oracle';}
function exit(){document.body.classList.remove('build-takeover');}
const button=document.getElementById('buildButton');new MutationObserver(()=>{if(button.disabled&&!active&&button.textContent.includes('Creating'))enter();if(!button.disabled&&active){active=false;document.getElementById('buildPreviewStop').hidden=true;notify(document.getElementById('statusMessage').textContent);}}).observe(button,{attributes:true,attributeFilter:['disabled'],childList:true,subtree:true});
document.getElementById('buildPreviewExit').onclick=exit;document.getElementById('buildPreviewStop').onclick=()=>document.getElementById('stopBuild').click();document.addEventListener('keydown',e=>{if(e.key==='Escape')exit();});window.CodePhiBuildPreview=Object.freeze({notify});
})();
