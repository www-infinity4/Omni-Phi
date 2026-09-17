(() => {
  'use strict';
  if (window.__omniImageModeV4) return;
  window.__omniImageModeV4 = true;
  const row=document.querySelector('.cosmic-modes'),form=document.getElementById('searchForm'),input=document.getElementById('searchInput'),submit=form?.querySelector('.search-submit');
  if(!row||!form||!input||!submit||!window.OmniPhi)return;
  const style=document.createElement('style');style.textContent=`.cosmic-modes{grid-template-columns:repeat(5,minmax(0,1fr))!important;width:min(72vw,1040px)!important}.cosmic-modes .image-mode-button{border-color:rgba(255,221,86,.95);box-shadow:0 0 12px rgba(255,219,70,.9),0 0 26px rgba(255,122,65,.32),inset 0 1px 0 rgba(255,255,255,.25)}.cosmic-modes .image-mode-button.active{background:linear-gradient(120deg,rgba(244,168,0,.96),rgba(207,93,0,.96) 54%,rgba(122,35,145,.96))}@media(max-width:700px){.cosmic-modes{width:96%!important;gap:1vw!important}.cosmic-modes .mode-button{padding:6px 2px!important}.cosmic-modes .mode-button span{font-size:.7rem!important}}`;document.head.appendChild(style);
  const button=document.createElement('button');button.className='mode-button image-mode-button';button.type='button';button.dataset.mode='images';button.innerHTML='<b>▧</b><span>Images <i>φ</i><small>Photo results</small></span>';const gpt=row.querySelector('.gpt-mode-button');gpt?row.insertBefore(button,gpt):row.appendChild(button);
  function setImageMode(focus=true){try{localStorage.setItem(OmniPhi.STORAGE.mode,'images')}catch{};row.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('active',x===button));input.placeholder='Search a full page of image results…';submit.textContent='φ';submit.setAttribute('aria-label','Search image results');if(focus)input.focus()}
  button.onclick=()=>setImageMode(true);row.querySelectorAll('[data-mode]').forEach(x=>{if(x!==button)x.addEventListener('click',()=>button.classList.remove('active'))});
  form.addEventListener('submit',e=>{let active=button.classList.contains('active');try{active=active||localStorage.getItem(OmniPhi.STORAGE.mode)==='images'}catch{}if(!active)return;e.preventDefault();e.stopImmediatePropagation();const q=input.value.trim();if(!q){input.focus();return}location.href=`${OmniPhi.url('images/')}?${new URLSearchParams({q})}`},true);
  try{if(localStorage.getItem(OmniPhi.STORAGE.mode)==='images')setImageMode(false)}catch{}
})();