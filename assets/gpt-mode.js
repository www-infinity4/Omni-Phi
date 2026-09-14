(() => {
  'use strict';

  const ENDPOINT = 'https://infinity-rogers.marvaseater.workers.dev/v1/chat';
  const STORAGE_KEY = 'omniPhiGptConversation';
  const modeRow = document.querySelector('.cosmic-modes');
  const form = document.getElementById('searchForm');
  const input = document.getElementById('searchInput');
  const deck = document.querySelector('.search-deck');
  const submit = form && form.querySelector('.search-submit');
  const suggestionPanel = document.getElementById('suggestionPanel');

  if (!modeRow || !form || !input || !deck || !submit) return;

  const style = document.createElement('style');
  style.textContent = `
    .cosmic-modes { grid-template-columns: repeat(4,minmax(0,1fr)); width:min(58vw,890px); }
    .cosmic-modes .gpt-mode-button { border-color:rgba(112,226,255,.95); box-shadow:0 0 12px rgba(90,220,255,.9),0 0 26px rgba(84,112,255,.45),inset 0 1px 0 rgba(255,255,255,.25); }
    .cosmic-modes .gpt-mode-button b { font:800 clamp(.78rem,1.2vw,1.08rem)/1 system-ui,sans-serif; letter-spacing:.03em; border:1px solid rgba(255,255,255,.8); border-radius:8px; padding:.48rem .42rem; }
    body.omni-gpt-mode .suggestion-panel { display:none !important; }
    body.omni-gpt-mode .search-icon { display:none; }
    body.omni-gpt-mode .search-shell { padding-left:24px; border-color:rgba(107,225,255,.95); box-shadow:0 0 6px #fff,0 0 22px #36bce8,inset 0 0 28px rgba(51,111,255,.18); }
    body.omni-gpt-mode .search-submit { font:800 1rem/1 system-ui,sans-serif; background:radial-gradient(circle at 35% 25%,#79eaff,#3178ff 48%,#25106d 84%); }
    .omni-gpt-panel { display:none; margin:12px auto 0; width:96%; max-height:min(40vh,430px); overflow:auto; border:1px solid rgba(106,205,255,.72); border-radius:20px; background:linear-gradient(135deg,rgba(7,20,61,.96),rgba(24,12,69,.96)); box-shadow:0 12px 34px rgba(0,0,0,.4),0 0 20px rgba(62,161,255,.25); backdrop-filter:blur(14px); }
    body.omni-gpt-mode .omni-gpt-panel { display:block; }
    .omni-gpt-head { position:sticky; top:0; z-index:2; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 14px; background:rgba(6,17,53,.96); border-bottom:1px solid rgba(119,176,255,.28); }
    .omni-gpt-head strong { color:#fff; font-size:.9rem; letter-spacing:.08em; }
    .omni-gpt-head span { color:#9ddcff; font-size:.72rem; }
    .omni-gpt-clear { border:1px solid rgba(170,210,255,.45); border-radius:999px; color:#dff4ff; background:rgba(46,78,145,.3); padding:6px 10px; font-size:.72rem; }
    .omni-gpt-log { padding:12px; display:grid; gap:10px; }
    .omni-gpt-message { max-width:92%; padding:11px 13px; border-radius:15px; white-space:pre-wrap; overflow-wrap:anywhere; font-size:.95rem; line-height:1.45; }
    .omni-gpt-message.user { margin-left:auto; background:linear-gradient(135deg,rgba(76,63,196,.9),rgba(111,33,153,.92)); color:#fff; border-bottom-right-radius:5px; }
    .omni-gpt-message.assistant { margin-right:auto; background:rgba(14,45,82,.94); color:#eff9ff; border:1px solid rgba(123,210,255,.3); border-bottom-left-radius:5px; }
    .omni-gpt-message.error { background:rgba(98,25,48,.9); border-color:rgba(255,129,160,.45); }
    .omni-gpt-thinking::after { content:' …'; animation:omniDots 1s steps(4,end) infinite; }
    @keyframes omniDots { 0%{opacity:.25} 50%{opacity:1} 100%{opacity:.25} }
    @media(max-width:700px){
      .cosmic-modes { width:94%; gap:1.2vw; top:29.7vh; }
      .cosmic-modes .mode-button { min-height:78px; gap:.28rem; padding:6px 2px; }
      .cosmic-modes .mode-button span { font-size:clamp(.72rem,3.4vw,.98rem); }
      .cosmic-modes .mode-button small { letter-spacing:.08em; }
      .search-deck { top:39.4vh; width:90%; }
      .omni-gpt-panel { width:100%; max-height:42vh; }
    }
    @media(max-width:420px){
      .cosmic-modes { top:29vh; }
      .cosmic-modes .mode-button { min-height:60px; border-radius:15px; }
      .cosmic-modes .mode-button b { font-size:1.2rem; }
      .cosmic-modes .gpt-mode-button b { font-size:.66rem; padding:.38rem .3rem; }
      .cosmic-modes .mode-button span { font-size:.7rem; }
      .search-deck { top:37.2vh; }
    }
  `;
  document.head.appendChild(style);

  const gptButton = document.createElement('button');
  gptButton.className = 'mode-button gpt-mode-button';
  gptButton.type = 'button';
  gptButton.dataset.mode = 'gpt';
  gptButton.innerHTML = '<b>GPT</b><span>GPT<small>Talk</small></span>';
  modeRow.appendChild(gptButton);

  const panel = document.createElement('section');
  panel.className = 'omni-gpt-panel';
  panel.setAttribute('aria-live', 'polite');
  panel.innerHTML = '<div class="omni-gpt-head"><div><strong>GPT</strong> <span>OpenAI via secure gateway</span></div><button class="omni-gpt-clear" type="button">Clear</button></div><div class="omni-gpt-log"></div>';
  deck.appendChild(panel);
  const log = panel.querySelector('.omni-gpt-log');
  const clearButton = panel.querySelector('.omni-gpt-clear');

  let conversation = [];
  let busy = false;
  try {
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]');
    if (Array.isArray(stored)) conversation = stored.slice(-24);
  } catch {}

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  function save() {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(conversation.slice(-24))); } catch {}
  }

  function render() {
    if (!conversation.length) {
      log.innerHTML = '<div class="omni-gpt-message assistant">GPT mode is ready. Ask a question here without leaving Omni Phi.</div>';
      return;
    }
    log.innerHTML = conversation.map((item) => `<div class="omni-gpt-message ${item.role === 'user' ? 'user' : 'assistant'}">${escapeHtml(item.content)}</div>`).join('');
    panel.scrollTop = panel.scrollHeight;
  }

  function currentMode() {
    try { return typeof mode !== 'undefined' ? mode : localStorage.getItem(OmniPhi.STORAGE.mode); } catch { return localStorage.getItem('omniPhiMode') || 'search'; }
  }

  function activateGpt(shouldFocus = true) {
    try { mode = 'gpt'; } catch {}
    try { localStorage.setItem(OmniPhi.STORAGE.mode, 'gpt'); } catch {}
    document.body.classList.add('omni-gpt-mode');
    [...modeRow.querySelectorAll('[data-mode]')].forEach((button) => button.classList.toggle('active', button === gptButton));
    input.placeholder = 'Message GPT…';
    submit.textContent = 'GPT';
    submit.setAttribute('aria-label', 'Send message to GPT');
    deck.classList.remove('suggestions-open');
    render();
    if (shouldFocus) input.focus();
  }

  function leaveGpt(nextMode) {
    document.body.classList.remove('omni-gpt-mode');
    gptButton.classList.remove('active');
    submit.textContent = 'φ';
    submit.setAttribute('aria-label', 'Run Omni Phi search');
    if (nextMode === 'code') input.placeholder = 'What do you want to code?';
    else if (nextMode === 'create') input.placeholder = 'What do you want to create?';
    else input.placeholder = 'Search the universe in proportion…';
  }

  async function askGpt(text) {
    if (busy) return;
    busy = true;
    conversation.push({ role: 'user', content: text });
    save();
    render();
    const thinking = document.createElement('div');
    thinking.className = 'omni-gpt-message assistant omni-gpt-thinking';
    thinking.textContent = 'GPT is thinking';
    log.appendChild(thinking);
    panel.scrollTop = panel.scrollHeight;

    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          input: text,
          context: {
            application: 'Omni Phi',
            assistant: 'gpt',
            conversation: conversation.slice(-12),
            verified_context: {
              page: location.href,
              title: document.title,
              interface_mode: 'gpt'
            }
          }
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
      const answer = String(payload.output_text || payload.output || '').trim();
      if (!answer) throw new Error('empty_response');
      conversation.push({ role: 'assistant', content: answer });
      save();
      render();
    } catch (error) {
      thinking.remove();
      const message = document.createElement('div');
      message.className = 'omni-gpt-message assistant error';
      message.textContent = `GPT gateway unavailable: ${error && error.message ? error.message : 'connection failed'}.`;
      log.appendChild(message);
    } finally {
      busy = false;
      panel.scrollTop = panel.scrollHeight;
    }
  }

  gptButton.addEventListener('click', () => activateGpt());

  [...modeRow.querySelectorAll('[data-mode]')].filter((button) => button !== gptButton).forEach((button) => {
    button.addEventListener('click', () => leaveGpt(button.dataset.mode));
  });

  form.addEventListener('submit', (event) => {
    if (currentMode() !== 'gpt' && !document.body.classList.contains('omni-gpt-mode')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const text = input.value.trim();
    if (!text || busy) return;
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    askGpt(text);
  }, true);

  input.addEventListener('keydown', (event) => {
    if (!document.body.classList.contains('omni-gpt-mode')) return;
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  clearButton.addEventListener('click', () => {
    conversation = [];
    save();
    render();
    input.focus();
  });

  if (currentMode() === 'gpt') activateGpt(false);
  else render();
})();
