(() => {
  const AI_NAME = 'NEXORA AI';
  const AI_IMG = 'https://res.cloudinary.com/dqqyvozdw/image/upload/v1795167935/ymkqmxn7je9eeyiqtqel.png';
  const STORE_KEY = 'nexora_chats_v1';
  const THEME_KEY = 'nexora_theme';

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
    sendBtn.disabled = loading || !inputEl.value.trim();
  }

  async function send(text) {
    text = (text || '').trim();
    if (!text || loading) return;

    let chat = current();
    if (!chat) {
      chat = { id: uid(), title: text.length > 40 ? text.slice(0, 40) + '…' : text, messages: [], updated: Date.now() };
      chats.push(chat);
      currentId = chat.id;
    }
    chat.messages.push({ role: 'user', content: text, time: timeNow() });
    chat.updated = Date.now();
    save();

    inputEl.value = ''; autoGrow();
    errorMsg = null; loading = true;
    sendBtn.disabled = true;
    renderList(); renderMessages();

    const activeId = chat.id;
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: chat.messages.slice(-20).map((m) => ({ role: m.role, content: m.content })) })
      });
      let data = {};
      try { data = await res.json(); } catch {}
      if (!res.ok || !data.reply) throw new Error(data.error || `Request failed (${res.status})`);

      const target = chats.find((c) => c.id === activeId);
      if (target) {
        target.messages.push({ role: 'assistant', content: data.reply, time: timeNow(), feedback: null });
        target.updated = Date.now();
        save();
      }
    } catch (err) {
      errorMsg = 'Sorry, I could not get a reply right now. ' + (err.message ? `(${err.message}) ` : '') + 'Please check your connection and try again.';
    } finally {
      loading = false;
      autoGrow();
      renderList();
      if (currentId === activeId) renderMessages();
    }
  }

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
  let savedTheme = 'light';
  try { savedTheme = localStorage.getItem(THEME_KEY) || 'light'; } catch {}
  applyTheme(savedTheme);
  load();
  renderList();
  renderMessages();
  autoGrow();
})();
