/* Event-scoped remote AI panel. Credentials stay in this browser and are never bundled. */
(() => {
  'use strict';

  const DEFAULTS = { baseUrl: 'https://freeapi.site/v1', model: 'deepseek-ai/deepseek-v4.1-flash' };
  const STORAGE = { base: 'redmap.ai.base', model: 'redmap.ai.model', key: 'redmap.ai.key', remember: 'redmap.ai.remember' };
  const VIEW_PASSWORD_HASH = 'fc9f131ff6c4a732c07e4824181f738c9efcb8bdc3c6767b98a7e62c3edc05a0';
  const read = (storage, name) => storage.getItem(name) || '';
  const CONFIG = {
    baseUrl: read(localStorage, STORAGE.base) || read(sessionStorage, STORAGE.base) || DEFAULTS.baseUrl,
    model: read(localStorage, STORAGE.model) || read(sessionStorage, STORAGE.model) || DEFAULTS.model,
    key: read(localStorage, STORAGE.key) || read(sessionStorage, STORAGE.key),
    remember: read(localStorage, STORAGE.remember) === '1',
  };
  let voiceEnabled = true;
  let request;
  let modelNames = [];

  const stop = () => window.speechSynthesis?.cancel();
  const speak = text => {
    stop();
    if (!voiceEnabled || !window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    window.speechSynthesis.speak(utterance);
  };
  const endpoint = path => `${CONFIG.baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
  const hash = async value => {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  };
  const allowedRemote = () => CONFIG.baseUrl === DEFAULTS.baseUrl || CONFIG.baseUrl.startsWith(`${location.origin}/`);

  async function remote(path, options = {}) {
    if (!CONFIG.key) throw new Error('请先填写远程 API 卡密');
    if (!allowedRemote()) throw new Error('为避免泄露卡密，接口地址只允许 freeapi.site 或本站代理');
    let response;
    try {
      response = await fetch(endpoint(path), {
        ...options,
        headers: {
          Authorization: `Bearer ${CONFIG.key}`,
          ...(options.method && options.method !== 'GET' ? { 'Content-Type': 'application/json' } : {}),
          ...(options.headers || {}),
        },
      });
    } catch (error) {
      if (error instanceof TypeError) throw new Error('浏览器无法跨域访问远程 AI，请确认接口允许 CORS，或填写本站代理地址');
      throw error;
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error?.message || body?.detail || `远程 AI 请求失败（${response.status}）`);
    return body;
  }

  function saveConfig() {
    const base = document.querySelector('#remote-ai-base')?.value.trim();
    const model = document.querySelector('#remote-ai-model')?.value.trim();
    const key = document.querySelector('#remote-ai-key')?.value.trim();
    const remember = Boolean(document.querySelector('#remote-ai-remember')?.checked);
    if (base) CONFIG.baseUrl = base;
    if (model) CONFIG.model = model;
    if (key) CONFIG.key = key;
    CONFIG.remember = remember;
    sessionStorage.setItem(STORAGE.base, CONFIG.baseUrl);
    sessionStorage.setItem(STORAGE.model, CONFIG.model);
    sessionStorage.setItem(STORAGE.key, CONFIG.key);
    if (remember) {
      localStorage.setItem(STORAGE.base, CONFIG.baseUrl);
      localStorage.setItem(STORAGE.model, CONFIG.model);
      localStorage.setItem(STORAGE.key, CONFIG.key);
      localStorage.setItem(STORAGE.remember, '1');
    } else {
      localStorage.removeItem(STORAGE.key);
      localStorage.removeItem(STORAGE.remember);
    }
  }

  function renderModels(names = []) {
    modelNames = [...new Set(names.filter(Boolean).map(String))];
    const select = document.querySelector('#remote-ai-model');
    if (!select) return;
    const selected = CONFIG.model || DEFAULTS.model;
    const options = [...new Set([selected, DEFAULTS.model, ...modelNames])];
    select.replaceChildren(...options.map(name => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      return option;
    }));
    select.value = selected;
  }

  function configPanel() {
    const root = document.querySelector('#remote-ai-config');
    if (!root) return;
    root.replaceChildren();
    const baseLabel = document.createElement('label');
    baseLabel.className = 'ai-config-field';
    baseLabel.textContent = '接口地址';
    const baseInput = document.createElement('input');
    baseInput.id = 'remote-ai-base'; baseInput.type = 'url'; baseInput.value = CONFIG.baseUrl; baseInput.autocomplete = 'url';
    baseLabel.append(baseInput);
    const modelLabel = document.createElement('label');
    modelLabel.className = 'ai-config-field'; modelLabel.textContent = '模型选择';
    const modelRow = document.createElement('div'); modelRow.className = 'ai-model-row';
    const modelSelect = document.createElement('select'); modelSelect.id = 'remote-ai-model'; modelSelect.setAttribute('aria-label', '选择远程模型');
    const refresh = document.createElement('button'); refresh.id = 'refresh-ai-models'; refresh.className = 'ai-button secondary'; refresh.type = 'button'; refresh.textContent = '自动获取模型';
    modelRow.append(modelSelect, refresh); modelLabel.append(modelRow);
    const keyLabel = document.createElement('label'); keyLabel.className = 'ai-config-field'; keyLabel.textContent = 'API 卡密';
    const keyInput = document.createElement('input'); keyInput.id = 'remote-ai-key'; keyInput.type = 'password'; keyInput.placeholder = '输入后保存在当前浏览器'; keyInput.autocomplete = 'off'; keyInput.value = CONFIG.key; keyLabel.append(keyInput);
    const actions = document.createElement('div'); actions.className = 'ai-key-actions';
    const rememberLabel = document.createElement('label'); rememberLabel.className = 'ai-toggle';
    const remember = document.createElement('input'); remember.id = 'remote-ai-remember'; remember.type = 'checkbox'; remember.checked = CONFIG.remember;
    rememberLabel.append(remember, document.createTextNode('在此浏览器记住'));
    const view = document.createElement('button'); view.id = 'view-ai-key'; view.className = 'ai-button secondary'; view.type = 'button'; view.textContent = '查看卡密';
    actions.append(rememberLabel, view);
    const note = document.createElement('p'); note.className = 'ai-config-note'; note.textContent = '公开网页不会内置卡密，记住卡密会写入本机浏览器存储；查看密码只是本机界面锁，不是服务端保密。';
    root.append(baseLabel, modelLabel, keyLabel, actions, note);
    renderModels(modelNames);
  }

  async function loadModels(status, { save = true } = {}) {
    if (save) saveConfig();
    if (!CONFIG.key) { status.textContent = '请先填写 API 卡密，再自动获取模型'; return []; }
    status.textContent = '正在获取可用模型…';
    try {
      const result = await remote('models');
      const names = (result.data || []).map(item => item?.id).filter(Boolean);
      renderModels(names);
      const preferred = names.find(name => /^deepseek-ai\/deepseek-v4\.1-flash$/i.test(name)) || names.find(name => /^deepseek/i.test(name));
      if (preferred) {
        CONFIG.model = preferred;
        const select = document.querySelector('#remote-ai-model');
        if (select) select.value = preferred;
        sessionStorage.setItem(STORAGE.model, preferred);
        if (CONFIG.remember) localStorage.setItem(STORAGE.model, preferred);
      }
      status.textContent = names.length ? `已获取 ${names.length} 个模型，可在下拉框选择` : '接口已连接，但没有返回模型列表';
      return names;
    } catch (error) {
      status.textContent = error.message;
      return [];
    }
  }

  const panel = document.querySelector('#test-panel');
  const open = document.querySelector('#open-test-panel');
  if (panel && open) {
    configPanel();
    const status = panel.querySelector('#test-status');
    const close = () => { panel.classList.add('hidden'); panel.setAttribute('aria-hidden', 'true'); open.setAttribute('aria-expanded', 'false'); open.focus(); };
    open.addEventListener('click', () => { configPanel(); panel.classList.remove('hidden'); panel.setAttribute('aria-hidden', 'false'); open.setAttribute('aria-expanded', 'true'); panel.querySelector('#remote-ai-base')?.focus(); });
    panel.querySelector('#close-test-panel').addEventListener('click', close);
    panel.querySelector('#test-cancel').addEventListener('click', close);
    panel.addEventListener('click', event => {
      if (event.target === panel) close();
      if (event.target.id === 'refresh-ai-models') loadModels(status);
      if (event.target.id === 'view-ai-key') {
        const input = panel.querySelector('#remote-ai-key');
        if (!input?.value) { status.textContent = '当前没有已保存的卡密'; return; }
        const password = window.prompt('请输入查看卡密的本机密码');
        hash(password || '').then(value => {
          if (value !== VIEW_PASSWORD_HASH) { status.textContent = '密码错误，未显示卡密'; return; }
          input.type = input.type === 'password' ? 'text' : 'password';
          status.textContent = input.type === 'text' ? '卡密已显示，请注意旁人视线' : '卡密已隐藏';
        });
      }
    });
    panel.querySelector('#test-connection').addEventListener('click', async event => { saveConfig(); event.target.disabled = true; await loadModels(status, { save: false }); event.target.disabled = false; });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.classList.contains('hidden')) close(); });
  }

  window.redMapAiMount = (event, container) => {
    if (!event || !container) return;
    request?.abort();
    const history = [];
    const speech = [event.title, event.summary, event.story].filter(Boolean).join('。');
    speak(speech);
    const root = document.createElement('section'); root.className = 'event-ai';
    root.innerHTML = '<div class="section-label">事件 AI 讲解</div><div class="ai-speech-controls"><button class="ai-button" data-action="replay">▶ 重播</button><button class="ai-button secondary" data-action="stop">■ 停止</button><label class="ai-toggle"><input type="checkbox" data-action="voice" checked>自动朗读</label><button class="ai-button" data-action="config">配置远程 AI</button></div><div class="ai-chat"><textarea rows="2" maxlength="1200" aria-label="围绕当前事件提问" placeholder="询问当前事件的背景、经过、人物或影响"></textarea><button class="ai-button primary" data-action="ask">发送提问</button></div><p class="ai-status" role="status"></p><div class="ai-answer" hidden></div>';
    container.append(root);
    const status = root.querySelector('.ai-status'); status.textContent = CONFIG.key ? `远程 AI 已配置 · ${CONFIG.model}` : `请先配置远程 AI · 默认模型 ${DEFAULTS.model}`;
    root.addEventListener('click', async eventClick => {
      const action = eventClick.target.closest('[data-action]')?.dataset.action;
      if (action === 'stop') stop();
      if (action === 'replay') speak(speech);
      if (action === 'voice') { voiceEnabled = eventClick.target.checked; if (voiceEnabled) speak(speech); else stop(); }
      if (action === 'config') { open?.click(); return; }
      if (action !== 'ask') return;
      const question = root.querySelector('textarea').value.trim();
      if (!question) { status.textContent = '请输入当前事件的问题'; return; }
      const button = eventClick.target.closest('button'); button.disabled = true; request = new AbortController(); status.textContent = '正在询问远程模型…';
      try {
        const messages = [{ role: 'system', content: `你是红色精神历史地图的事件讲解助手，只能依据当前事件资料回答，资料未提供时要明确说明，不能编造。当前事件资料：标题：${event.title}\n年份：${event.year}\n地点：${event.province || ''} ${event.city || ''} ${event.district || ''}\n关联人物：${(event.people || []).join('、')}\n摘要：${event.summary || ''}\n资料正文：${event.story || ''}` }, ...history, { role: 'user', content: question }];
        const result = await remote('chat/completions', { method: 'POST', signal: request.signal, body: JSON.stringify({ model: CONFIG.model, messages, temperature: .2, max_tokens: 700, stream: false }) });
        const answer = result.choices?.[0]?.message?.content || '远程模型没有返回答案'; history.push({ role: 'user', content: question }, { role: 'assistant', content: answer }); history.splice(0, Math.max(0, history.length - 6));
        const answerBox = root.querySelector('.ai-answer'); answerBox.hidden = false; answerBox.textContent = answer; status.textContent = `远程模型已回答 · ${CONFIG.model}`;
      } catch (error) { if (error.name !== 'AbortError') status.textContent = error.message; } finally { button.disabled = false; }
    });
  };
  window.redMapAiStopSpeech = stop;
})();
