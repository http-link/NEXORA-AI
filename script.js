(() => {
  const AI_NAME = 'NEXORA AI';
  const AI_IMG = 'https://res.cloudinary.com/dqqyvozdw/image/upload/v1795167935/ymkqmxn7je9eeyiqtqel.png';
  const STORE_KEY = 'nexora_chats_v1';
  const THEME_KEY = 'nexora_theme';
  let selectedImage = null;
  let activeProject = null;
  let projectsCache = [];
  let modalMode = ''; 

  const $ = (id) => document.getElementById(id);
  const msgsEl = $('messages');
  const inputEl = $('input');
  const sendBtn = $('sendBtn');
  const listEl = $('chatList');
  const sidebar = $('sidebar');
  const overlay = $('overlay');
  const themeBtn = $('themeBtn');

  const SUGGESTIONS = [
    { icon: 'fa-code', title: 'Build a project', text: 'Build a responsive portfolio website using HTML, CSS and JavaScript, and tell me where each file goes.' },
    { icon: 'fa-bug', title: 'Debug my code', text: 'Help me debug my code. I will paste the code and the error message in my next message.' },
    { icon: 'fa-graduation-cap', title: 'Learn programming', text: 'Teach me JavaScript from absolute zero. Start with the basics, give examples and a small exercise.' },
    { icon: 'fa-magnifying-glass-chart', title: 'Review & optimize', text: 'Review my code for performance, security and readability, and suggest improvements without breaking it.' }
  ];

  let chats = [];
  let currentId = null;
  let loading = false;
  let errorMsg = null;

  /* ---------- helpers ---------- */
  const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const timeNow = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  function avatarHTML(size) {
    return `<span class="avatar ${size}" data-letter="${AI_NAME.charAt(0)}"><img src="${AI_IMG}" alt="${AI_NAME}" onerror="this.parentNode.classList.add('fb');this.remove()"></span>`;
  }

  function load() {
    try { chats = JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch { chats = []; }
    if (!Array.isArray(chats)) chats = [];
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(chats)); } catch {}
  }
  const current = () => chats.find((c) => c.id === currentId) || null;

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise((resolve) => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch {}
      ta.remove(); resolve();
    });
  }

  /* ---------- markdown ---------- */
  function inline(s) {
    return s
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  }

  function renderMarkdown(text) {
    const blocks = [];
    let t = String(text);
    t = t.replace(/```([\w+#.-]*)[^\n]*\n([\s\S]*?)```/g, (m, lang, code) => {
      blocks.push({ lang: lang || 'code', code: code.replace(/\n$/, '') });
      return `\n\u0000CODE${blocks.length - 1}\u0000\n`;
    });
    // unclosed fence (streaming/cut-off replies)
    t = t.replace(/```([\w+#.-]*)[^\n]*\n([\s\S]*)$/, (m, lang, code) => {
      blocks.push({ lang: lang || 'code', code });
      return `\n\u0000CODE${blocks.length - 1}\u0000\n`;
    });

    t = escapeHtml(t);
    const lines = t.split('\n');
    let html = '';
    let list = null; // 'ul' | 'ol'
    let para = [];

    const flushPara = () => { if (para.length) { html += `<p>${inline(para.join('<br>'))}</p>`; para = []; } };
    const closeList = () => { if (list) { html += `</${list}>`; list = null; } };

    for (const raw of lines) {
      const line = raw.trimEnd();
      let m;
      if ((m = line.match(/^\u0000CODE(\d+)\u0000$/))) {
        flushPara(); closeList();
        const b = blocks[+m[1]];
        html += `<div class="code-block"><div class="code-head"><span>${escapeHtml(b.lang)}</span><button class="copy-code" type="button"><i class="fa-regular fa-copy"></i> Copy code</button></div><pre><code>${escapeHtml(b.code)}</code></pre></div>`;
      } else if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
        flushPara(); closeList();
        html += `<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`;
      } else if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) {
        flushPara();
        if (list !== 'ul') { closeList(); html += '<ul>'; list = 'ul'; }
        html += `<li>${inline(m[1])}</li>`;
      } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
        flushPara();
        if (list !== 'ol') { closeList(); html += '<ol>'; list = 'ol'; }
        html += `<li>${inline(m[1])}</li>`;
      } else if (line.trim() === '') {
        flushPara(); closeList();
      } else {
        closeList();
        para.push(line);
      }
    }
    flushPara(); closeList();
    return html;
  }

  /* ---------- rendering ---------- */
  function welcomeHTML() {
    return `<div class="welcome">
      ${avatarHTML('xl')}
      <h1>Hello, I'm ${AI_NAME}</h1>
      <p>Your premium coding and development assistant. I write complete code, debug errors, teach programming in English or Malayalam, and help you build real projects from idea to deployment.</p>
      <div class="tagline">Your Ideas. Your Code. Your Future.</div>
      <div class="cards">
        ${SUGGESTIONS.map((s, i) => `<button class="card" data-s="${i}"><i class="fa-solid ${s.icon}"></i><b>${s.title}</b><span>${escapeHtml(s.text)}</span></button>`).join('')}
      </div>
    </div>`;
  }

  function aiMessageHTML(m, i) {
    const up = m.feedback === 'up' ? ' active' : '';
    const down = m.feedback === 'down' ? ' active' : '';
    return `<div class="msg ai" data-i="${i}">
      ${avatarHTML('sm')}
      <div class="ai-body">
        <div class="ai-content">${renderMarkdown(m.content)}</div>
        <div class="actions">
          <button class="act copy" title="Copy reply" type="button"><i class="fa-regular fa-copy"></i></button>
          <span class="time">${escapeHtml(m.time || '')}</span>
          <button class="act up${up}" title="Good response" type="button"><i class="fa-regular fa-thumbs-up"></i></button>
          <button class="act down${down}" title="Bad response" type="button"><i class="fa-regular fa-thumbs-down"></i></button>
        </div>
      </div>
    </div>`;
  }

  function renderMessages(scroll = true) {
    const chat = current();
    if (!chat || !chat.messages.length) {
      msgsEl.innerHTML = welcomeHTML() + (loading ? '' : '');
      return;
    }
    let html = '<div class="thread">';
    chat.messages.forEach((m, i) => {
      if (m.role === 'user') html += `<div class="msg user"><div class="bubble">${escapeHtml(m.content).replace(/\n/g, '<br>')}</div></div>`;
      else html += aiMessageHTML(m, i);
    });
    if (loading) html += `<div class="msg ai">${avatarHTML('sm')}<div class="ai-body"><div class="typing"><i></i><i></i><i></i></div></div></div>`;
    if (errorMsg) html += `<div class="msg ai error">${avatarHTML('sm')}<div class="ai-body"><div class="ai-content">${escapeHtml(errorMsg)}</div></div></div>`;
    html += '</div>';
    msgsEl.innerHTML = html;
    if (scroll) msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  function renderList() {
    if (!chats.length) { listEl.innerHTML = '<div class="empty-list">No chats yet. Start a new one!</div>'; return; }
    const sorted = [...chats].sort((a, b) => b.updated - a.updated);
    listEl.innerHTML = sorted.map((c) => `<div class="chat-item${c.id === currentId ? ' active' : ''}" data-id="${c.id}">
      <i class="fa-regular fa-message"></i><span>${escapeHtml(c.title)}</span>
      <button class="del" title="Delete chat" type="button"><i class="fa-solid fa-trash"></i></button></div>`).join('');
  }

  /* ---------- actions ---------- */
  function closeSidebar() { sidebar.classList.remove('open'); overlay.classList.remove('show'); }

  function newChat() {
    currentId = null; errorMsg = null; loading = false;
    renderList(); renderMessages(); closeSidebar(); inputEl.focus();
  }

  function openChat(id) {
    currentId = id; errorMsg = null;
    renderList(); renderMessages(); closeSidebar();
  }

  function deleteChat(id) {
    chats = chats.filter((c) => c.id !== id);
    save();
    if (currentId === id) currentId = null;
    renderList(); renderMessages();
  }

  function autoGrow() {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 200) + 'px';
    sendBtn.disabled = loading || (!inputEl.value.trim() && !selectedImage);
  }

  async function send(text) {
    text = (text || '').trim();
    if ((!text && !selectedImage) || loading) return;
    if (!text && selectedImage) text = 'Please analyse this image and explain what you see.';
    const imageForRequest = selectedImage;
    const displayText = imageForRequest ? `${text}\n[Image attached: ${imageForRequest.name}]` : text;
    let chat = current();
    if (!chat) {
      chat = { id: uid(), title: text.length > 40 ? text.slice(0, 40) + '…' : text, messages: [], updated: Date.now() };
      chats.push(chat); currentId = chat.id;
    }
    chat.messages.push({ role: 'user', content: displayText, time: timeNow() });
    chat.updated = Date.now(); save();
    selectedImage = null; renderAttachment();
    inputEl.value = ''; autoGrow(); errorMsg = null; loading = true; sendBtn.disabled = true;
    renderList(); renderMessages();
    const activeId = chat.id;
    try {
      const history = chat.messages.slice(-20).map((m, index, arr) => {
        if (imageForRequest && index === arr.length - 1) return { role: m.role, content: [
          { type: 'text', text: text },
          { type: 'image_url', image_url: { url: imageForRequest.data } }
        ] };
        return { role: m.role, content: m.content };
      });
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, mode: $('modelSelect')?.value || 'auto', long_mode: !!$('longMode')?.checked, project_context: activeProject ? `${activeProject.name}\n${activeProject.description || ''}\n${activeProject.context || ''}` : '' })
      });
      let data = {}; try { data = await res.json(); } catch {}
      if (!res.ok || !data.reply) throw new Error(data.error || `Request failed (${res.status})`);
      const target = chats.find(c => c.id === activeId);
      if (target) {
        target.messages.push({ role: 'assistant', content: data.reply, time: timeNow(), feedback: null, model: data.model });
        target.updated = Date.now(); save();
      }
      if (activeProject) await appendProjectMemory(activeProject, text, data.reply);
      const status = document.querySelector('.status');
      if (status) status.innerHTML = `<i></i> ${escapeHtml(data.provider || 'AI')} · ${escapeHtml(data.model || 'Ready')}`;
    } catch (err) {
      errorMsg = 'NEXORA could not complete the request. ' + (err.message ? `(${err.message}) ` : '') + 'Please check your provider setup and try again.';
    } finally {
      loading = false; autoGrow(); renderList(); if (currentId === activeId) renderMessages();
    }
  }


  /* ---------- PRO workspace: images, projects, usage, export ---------- */
  function showModal(title, html) {
    $('modalTitle').textContent = title; $('modalContent').innerHTML = html;
    $('modalBackdrop').hidden = false; modalMode = title;
  }
  function closeModal() { $('modalBackdrop').hidden = true; modalMode = ''; }
  async function apiJson(url, options = {}) {
    const r = await fetch(url, { ...options, headers: { 'Content-Type':'application/json', ...(options.headers || {}) } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || `Request failed (${r.status})`);
    return d;
  }
  async function loadProjects() {
    const d = await apiJson('/api/projects'); projectsCache = d.projects || []; return projectsCache;
  }
  function extractProjectFiles(reply) {
    const files = [];
    const pattern = /(?:^|\n)\s*(?:#{1,4}\s*)?(?:\*\*)?([\w./-]+\.(?:html|css|js|jsx|ts|tsx|json|md|py|php|sql|vue|svelte|java|c|cpp|txt))(?:\*\*)?\s*\n```[\w+#.-]*\n([\s\S]*?)```/g;
    let match; while ((match = pattern.exec(reply)) && files.length < 40) { const path = match[1].replace(/^\/+|\.\./g,''); if (path) files.push({ path, content:match[2].trimEnd() }); }
    return files;
  }
  async function appendProjectMemory(project, prompt, reply) {
    try {
      const extracted = extractProjectFiles(reply);
      project.files = [...(project.files || []), ...extracted].reduce((acc, file) => { const i = acc.findIndex(x => x.path === file.path); if (i >= 0) acc[i] = file; else acc.push(file); return acc; }, []).slice(0,100);
      project.context = `${project.context || ''}\n\nUSER: ${prompt}\nNEXORA: ${reply}`.slice(-11000);
      await apiJson(`/api/project?id=${encodeURIComponent(project.id)}`, { method:'PUT', body:JSON.stringify({ name:project.name, description:project.description || '', context:project.context, files:project.files || [] }) });
    } catch (e) { console.warn('Project memory could not be saved:', e.message); }
  }
  async function openProjects() {
    showModal('Projects', '<div class="modal-row"><div><strong>Project Memory</strong><small>Save project context, decisions and generated files in Cloudflare D1.</small></div><div style="display:flex;gap:7px"><button class="modal-secondary" id="exportProject">Export ZIP</button><button class="modal-primary" id="createProject">+ New project</button></div></div><div id="projectRows" class="modal-empty">Loading projects…</div>');
    try {
      const projects = await loadProjects();
      $('projectRows').innerHTML = projects.length ? projects.map(p => `<div class="modal-row"><div><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.description || 'No description')}${activeProject?.id === p.id ? ' · Active' : ''}</small></div><button class="modal-secondary" data-project="${escapeHtml(p.id)}">${activeProject?.id === p.id ? 'Selected' : 'Open'}</button></div>`).join('') : '<div class="modal-empty">No projects saved yet. Create your first project.</div>';
    } catch (e) { $('projectRows').innerHTML = `<div class="modal-empty">${escapeHtml(e.message)}<br><br>Cloudflare storage needs to be configured first.</div>`; }
  }
  async function createProject() {
    const name = prompt('Project name?'); if (!name?.trim()) return;
    const description = prompt('Short project description (optional):') || '';
    try {
      const d = await apiJson('/api/projects', { method:'POST', body:JSON.stringify({ name:name.trim(), description, context:'', files:[] }) });
      activeProject = d.project; closeModal(); renderProjectStatus();
    } catch (e) { alert(e.message); }
  }
  function renderProjectStatus() {
    const status = document.querySelector('.status');
    if (status && activeProject) status.innerHTML = `<i></i> Project: ${escapeHtml(activeProject.name)}`;
  }
  async function showUsage() {
    showModal('Usage Dashboard', '<div class="modal-empty">Loading usage…</div>');
    try {
      const d = await apiJson('/api/usage');
      $('modalContent').innerHTML = `<div class="modal-row"><div><strong>Requests · last 24 hours</strong><small>Requests recorded by NEXORA</small></div><strong>${Number(d.requests || 0).toLocaleString()}</strong></div><div class="modal-row"><div><strong>Recorded tokens</strong><small>${escapeHtml(d.token_note || 'Provider-reported tokens')}</small></div><strong>${Number(d.recorded_tokens || 0).toLocaleString()}</strong></div><h3 style="font-size:13px;margin:20px 0 8px">Provider breakdown</h3>${(d.breakdown || []).map(x => `<div class="modal-row"><div><strong>${escapeHtml(x.provider)} · ${escapeHtml(x.model)}</strong><small>${escapeHtml(x.request_type)}</small></div><strong>${x.requests}</strong></div>`).join('') || '<div class="modal-empty">No usage records yet.</div>'}`;
    } catch (e) { $('modalContent').innerHTML = `<div class="modal-empty">${escapeHtml(e.message)}<br><br>Connect Cloudflare D1 to activate global usage tracking.</div>`; }
  }
  async function exportActiveProject() {
    if (!activeProject) { alert('Open a project first.'); return; }
    if (!(activeProject.files || []).length) { alert('No project files have been captured yet. Ask NEXORA to provide files with clear filenames such as index.html, style.css and script.js while this project is active.'); return; }
    try {
      const r = await fetch('/api/export', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ files:activeProject.files }) });
      if (!r.ok) { const d=await r.json().catch(()=>({})); throw new Error(d.error || 'Export failed.'); }
      const blob = await r.blob(), url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href=url; a.download=(activeProject.name || 'nexora-project').toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.zip'; a.click(); URL.revokeObjectURL(url);
    } catch(e) { alert(e.message); }
  }
  function openImageStudio() {
    showModal('Image Studio', `<p style="color:#95A2B8;font-size:12px;line-height:1.7">Create an image from a prompt using your configured image-generation provider. Upload and analyse images directly from the chat composer.</p><label class="modal-label">Image prompt</label><textarea class="modal-textarea" id="imagePrompt" placeholder="A premium futuristic dashboard illustration…"></textarea><button class="modal-primary" id="generateImage">Generate image</button><div id="imageResult"></div>`);
  }
  async function generateImage() {
    const promptText = $('imagePrompt')?.value.trim(); if (!promptText) return;
    $('generateImage').disabled = true; $('generateImage').textContent = 'Generating…';
    try {
      const d = await apiJson('/api/generate-image', { method:'POST', body:JSON.stringify({ prompt:promptText }) });
      $('imageResult').innerHTML = d.image ? `<img class="modal-image" src="${d.image}" alt="Generated image">` : '<div class="modal-empty">Provider returned no image.</div>';
    } catch (e) { $('imageResult').innerHTML = `<div class="modal-empty">${escapeHtml(e.message)}</div>`; }
    finally { if ($('generateImage')) { $('generateImage').disabled = false; $('generateImage').textContent = 'Generate image'; } }
  }
  function renderAttachment() {
    const box = $('attachmentPreview'); if (!box) return;
    if (!selectedImage) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false; box.innerHTML = `<img src="${selectedImage.data}" alt="Selected image">${escapeHtml(selectedImage.name)} <button id="removeAttachment" type="button" title="Remove image"><i class="fa-solid fa-xmark"></i></button>`;
  }
  $('attachBtn')?.addEventListener('click', () => $('imageInput').click());
  $('imageInput')?.addEventListener('change', async e => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!['image/png','image/jpeg','image/webp'].includes(file.type)) { alert('Please choose PNG, JPG or WebP.'); e.target.value=''; return; }
    if (file.size > 6 * 1024 * 1024) { alert('Image must be smaller than 6 MB.'); e.target.value=''; return; }
    const reader = new FileReader(); reader.onload = () => { selectedImage = { name:file.name, data:String(reader.result) }; renderAttachment(); autoGrow(); }; reader.readAsDataURL(file);
  });
  $('attachmentPreview')?.addEventListener('click', e => { if (e.target.closest('#removeAttachment')) { selectedImage = null; $('imageInput').value=''; renderAttachment(); } });
  $('projectsBtn')?.addEventListener('click', openProjects);
  $('imageStudioBtn')?.addEventListener('click', openImageStudio);
  $('usageBtn')?.addEventListener('click', showUsage);
  $('modalContent')?.addEventListener('click', e => {
    if (e.target.closest('#createProject')) { createProject(); return; }
    if (e.target.closest('#exportProject')) { exportActiveProject(); return; }
    if (e.target.closest('#generateImage')) { generateImage(); return; }
    const p = e.target.closest('[data-project]');
    if (p) { activeProject = projectsCache.find(x => x.id === p.dataset.project) || null; closeModal(); renderProjectStatus(); }
  });
  $('closeModal')?.addEventListener('click', closeModal);
  $('modalBackdrop')?.addEventListener('click', e => { if (e.target.id === 'modalBackdrop') closeModal(); });
  $('input')?.addEventListener('paste', e => { const item = [...(e.clipboardData?.items || [])].find(x => x.type.startsWith('image/')); if (!item) return; const file = item.getAsFile(); if (file && file.size <= 6*1024*1024) { const reader = new FileReader(); reader.onload = () => { selectedImage={name:'pasted-image',data:String(reader.result)}; renderAttachment(); }; reader.readAsDataURL(file); } });

  /* ---------- events ---------- */
  inputEl.addEventListener('input', autoGrow);
  inputEl.addEventListener('keydown', (e) => {
    const isDesktop = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (e.key === 'Enter' && !e.shiftKey && isDesktop) { e.preventDefault(); send(inputEl.value); }
  });
  sendBtn.addEventListener('click', () => send(inputEl.value));
  $('newChat').addEventListener('click', newChat);
  $('menuBtn').addEventListener('click', () => { sidebar.classList.add('open'); overlay.classList.add('show'); });
  overlay.addEventListener('click', closeSidebar);

  listEl.addEventListener('click', (e) => {
    const item = e.target.closest('.chat-item');
    if (!item) return;
    if (e.target.closest('.del')) deleteChat(item.dataset.id);
    else openChat(item.dataset.id);
  });

  msgsEl.addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (card) { send(SUGGESTIONS[+card.dataset.s].text); return; }

    const codeBtn = e.target.closest('.copy-code');
    if (codeBtn) {
      const code = codeBtn.closest('.code-block').querySelector('code').textContent;
      copyText(code).then(() => {
        codeBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied';
        setTimeout(() => { codeBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy code'; }, 1500);
      });
      return;
    }

    const msgEl = e.target.closest('.msg.ai[data-i]');
    if (!msgEl) return;
    const chat = current();
    const m = chat && chat.messages[+msgEl.dataset.i];
    if (!m) return;

    const copyBtn = e.target.closest('.act.copy');
    if (copyBtn) {
      copyText(m.content).then(() => {
        copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied';
        setTimeout(() => { copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>'; }, 1500);
      });
      return;
    }

    const upBtn = e.target.closest('.act.up');
    const downBtn = e.target.closest('.act.down');
    if (upBtn || downBtn) {
      const kind = upBtn ? 'up' : 'down';
      m.feedback = m.feedback === kind ? null : kind;
      save();
      msgEl.querySelector('.act.up').classList.toggle('active', m.feedback === 'up');
      msgEl.querySelector('.act.down').classList.toggle('active', m.feedback === 'down');
    }
  });

  /* ---------- private account ---------- */
  $('logoutBtn')?.addEventListener('click', async () => {
    try { await fetch('/api/logout', { method: 'POST' }); } catch {}
    location.replace('/login.html');
  });

  /* ---------- theme ---------- */
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    themeBtn.innerHTML = t === 'dark' ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
  }
  themeBtn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch {}
  });

  /* ---------- init ---------- */
  $('topAvatar').innerHTML = avatarHTML('md');
  $('brandBox').insertAdjacentHTML('afterbegin', avatarHTML('sm'));
  let savedTheme = 'dark';
  try { savedTheme = localStorage.getItem(THEME_KEY) || 'dark'; } catch {}
  applyTheme(savedTheme);
  load();
  renderList();
  renderMessages();
  autoGrow();
})();
