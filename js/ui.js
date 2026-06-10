/**
 * UI rendering and DOM manipulation helpers.
 */

const UI = {
  elements: {},
  _previewFiles: [], // selected files before sending

  /**
   * Cache all DOM element references on init.
   */
  init() {
    const ids = [
      'login-screen', 'app-screen', 'login-form', 'username-input', 'name-input', 'password-input', 'login-btn',
      'login-error', 'current-user-avatar', 'current-username',
      'tab-login', 'tab-register', 'name-group',
      'settings-btn', 'user-search', 'users-list', 'app-layout', 'sidebar', 'chat-area', 'chat-empty',
      'chat-active', 'back-btn', 'chat-user-avatar', 'chat-username', 'chat-status',
      'messages-container', 'messages-list', 'typing-indicator', 'typing-text',
      'message-input', 'send-btn', 'error-toast', 'error-toast-text',
      'attach-btn',
      'file-input-photos', 'file-input-docs',
      'attach-sheet-overlay', 'attach-sheet', 'attach-sheet-cancel',
      'file-preview-panel', 'file-preview-grid', 'file-preview-count',
      'file-preview-add-more', 'file-preview-clear', 'file-preview-send',
      // New
      'reply-panel', 'reply-panel-text', 'reply-panel-close',
      'forward-modal', 'forward-modal-overlay', 'forward-modal-list', 'forward-modal-close'
    ];

    ids.forEach(id => {
      this.elements[id] = document.getElementById(id);
    });
  },

  // ─── Screen Management ───────────────────────────────────────────────────

  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById(screenId);
    if (screen) screen.classList.add('active');
  },

  showLogin() {
    this.showScreen('login-screen');
  },

  showApp() {
    this.showScreen('app-screen');
  },

  // ─── Login UI ────────────────────────────────────────────────────────────

  setLoginLoading(loading) {
    const btn = this.elements['login-btn'];
    btn.querySelector('.btn-text').classList.toggle('hidden', loading);
    btn.querySelector('.btn-loader').classList.toggle('hidden', !loading);
    btn.disabled = loading;
  },

  showLoginError(message) {
    const el = this.elements['login-error'];
    el.textContent = message;
    el.classList.remove('hidden');
  },

  hideLoginError() {
    this.elements['login-error'].classList.add('hidden');
  },

  // ─── Avatar Rendering ────────────────────────────────────────────────────

  setAvatar(element, username) {
    if (!element || !username) return;
    const initials = Utils.getInitials(username);
    const color = Utils.getAvatarColor(username);
    element.textContent = initials;
    element.style.backgroundColor = color;
    element.title = username;
  },

  // ─── Users List ──────────────────────────────────────────────────────────

  renderUsersList(users, activeUsername, searchQuery = '') {
    const container = this.elements['users-list'];

    if (!users || !Array.isArray(users) || users.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No users found</p>
          <span>Be the first to invite friends!</span>
        </div>`;
      return;
    }

    const validUsers = users.filter(u => u && u.username);

    const query = searchQuery.toLowerCase().trim();
    const filtered = query
      ? validUsers.filter(u => (
          String(u.username).toLowerCase().includes(query) ||
          String(u.name || '').toLowerCase().includes(query)
        ))
      : validUsers;

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No matching users</p>
          <span>Try a different search term</span>
        </div>`;
      return;
    }

    container.innerHTML = filtered.map(user => {
      const isActive = user.username === activeUsername;
      const isOnline = !!user.isOnline;
      const displayName = user.name || user.username || 'Unknown';
      const hasUnread = !!user.hasUnread;

      return `
        <button
          class="user-item ${isActive ? 'active' : ''}"
          data-username="${Utils.escapeHtml(user.username)}"
          data-name="${Utils.escapeHtml(displayName)}"
          aria-label="Chat with ${Utils.escapeHtml(displayName)}"
        >
          <div class="user-item-avatar-wrapper">
            <div class="user-item-avatar avatar" style="background-color: ${Utils.getAvatarColor(user.username)}">
              ${Utils.escapeHtml(Utils.getInitials(displayName))}
            </div>
            ${isOnline ? '<span class="online-dot"></span>' : ''}
          </div>
          <div class="user-item-info">
            <span class="user-item-name">
              ${Utils.escapeHtml(displayName)}
              ${hasUnread ? '<span class="unread-dot"></span>' : ''}
            </span>
            <span class="user-item-last-msg"></span>
          </div>
        </button>`;
    }).join('');
  },

  showUsersLoading() {
    this.elements['users-list'].innerHTML = `
      <div class="loading-state">
        <span class="spinner"></span>
        <span>Loading users...</span>
      </div>`;
  },

  // ─── Chat UI ─────────────────────────────────────────────────────────────

  showChatEmpty() {
    this.elements['chat-empty'].classList.remove('hidden');
    this.elements['chat-active'].classList.add('hidden');
  },

  showChatActive(loginUsername, displayName, isOnline = false, lastSeen = null) {
    this.elements['chat-empty'].classList.add('hidden');
    this.elements['chat-active'].classList.remove('hidden');

    const shownName = displayName || loginUsername;
    this.setAvatar(this.elements['chat-user-avatar'], shownName);
    this.elements['chat-username'].textContent = shownName;
    this.updateChatStatus(isOnline, lastSeen);
  },

  updateChatStatus(isOnline, lastSeen = null) {
    const el = this.elements['chat-status'];
    if (isOnline) {
      el.textContent = 'В сети';
      el.className = 'chat-status online';
    } else {
      el.textContent = Utils.formatLastSeen(lastSeen);
      el.className = 'chat-status offline';
    }
  },

  /**
   * Render a single file attachment HTML.
   */
  renderFileAttachment(fileData, metaHtml) {
    if (!fileData) return '';

    const isImage = fileData.category === 'image';
    const fileSize = Storage.formatFileSize(fileData.size);

    if (isImage) {
      return `
        <div class="file-attachment file-attachment-image photo-wrapper">
          <img src="${Utils.escapeHtml(fileData.url)}" alt="${Utils.escapeHtml(fileData.name)}"
               class="file-preview-image" loading="lazy"
               onclick="UI.openImageGallery('${Utils.escapeHtml(fileData.url)}')">
          ${metaHtml ? `<div class="photo-meta">${metaHtml}</div>` : ''}
        </div>`;
    }

    return `
      <div class="file-attachment file-attachment-doc">
        <div class="file-icon">${Storage.getFileIconSVG(fileData.category)}</div>
        <div class="file-info">
          <span class="file-name">${Utils.escapeHtml(fileData.name)}</span>
          <span class="file-size">${Utils.escapeHtml(fileSize)}</span>
        </div>
        <a href="${Utils.escapeHtml(fileData.url)}" class="file-download-btn" download
           title="Скачать файл" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </a>
      </div>`;
  },

  // ─── Gallery ─────────────────────────────────────────────────────────────

  openImageGallery(startUrl) {
    const allImages = [];
    if (typeof Chat !== 'undefined' && Chat.messages) {
      Chat.messages.forEach(msg => {
        if (msg.file && msg.file.category === 'image') {
          allImages.push({ url: msg.file.url, name: msg.file.name });
        }
        if (msg.files && Array.isArray(msg.files)) {
          msg.files.forEach(f => {
            if (f.category === 'image') {
              allImages.push({ url: f.url, name: f.name });
            }
          });
        }
      });
    }

    if (allImages.length === 0) return this._openSingleImage(startUrl);

    let currentIndex = allImages.findIndex(img => img.url === startUrl);
    if (currentIndex === -1) currentIndex = 0;

    const existing = document.querySelector('.file-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'file-overlay';
    overlay.innerHTML = `
      <div class="file-overlay-bg"></div>
      <div class="gallery-top-bar">
        <span class="gallery-counter">${currentIndex + 1} / ${allImages.length}</span>
        <button class="gallery-close icon-btn" aria-label="Close gallery">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" width="24" height="24">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <button class="gallery-nav gallery-prev" aria-label="Previous">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round" width="28" height="28">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <div class="gallery-image-container">
        <img src="${Utils.escapeHtml(allImages[currentIndex].url)}" class="file-overlay-image" alt="Preview">
      </div>
      <button class="gallery-nav gallery-next" aria-label="Next">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round" width="28" height="28">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
      <div class="gallery-bottom-bar">
        <button class="gallery-save-btn" aria-label="Save image">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Сохранить
        </button>
      </div>
    `;

    const bg = overlay.querySelector('.file-overlay-bg');
    const closeBtn = overlay.querySelector('.gallery-close');
    const prevBtn = overlay.querySelector('.gallery-prev');
    const nextBtn = overlay.querySelector('.gallery-next');
    const img = overlay.querySelector('.file-overlay-image');
    const counter = overlay.querySelector('.gallery-counter');
    const saveBtn = overlay.querySelector('.gallery-save-btn');

    function updateGallery(index) {
      currentIndex = index;
      img.src = allImages[currentIndex].url;
      img.alt = allImages[currentIndex].name || 'Photo';
      counter.textContent = `${currentIndex + 1} / ${allImages.length}`;
      prevBtn.style.display = currentIndex === 0 ? 'none' : 'flex';
      nextBtn.style.display = currentIndex === allImages.length - 1 ? 'none' : 'flex';
    }

    prevBtn.addEventListener('click', (e) => { e.stopPropagation(); if (currentIndex > 0) updateGallery(currentIndex - 1); });
    nextBtn.addEventListener('click', (e) => { e.stopPropagation(); if (currentIndex < allImages.length - 1) updateGallery(currentIndex + 1); });

    const keyHandler = (e) => {
      if (e.key === 'Escape') { removeGallery(); }
      if (e.key === 'ArrowLeft') { prevBtn.click(); }
      if (e.key === 'ArrowRight') { nextBtn.click(); }
    };
    document.addEventListener('keydown', keyHandler);

    function removeGallery() {
      document.removeEventListener('keydown', keyHandler);
      overlay.remove();
    }

    bg.addEventListener('click', removeGallery);
    closeBtn.addEventListener('click', removeGallery);

    saveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const current = allImages[currentIndex];
      this._downloadFile(current.url, current.name || 'photo');
    });

    let touchStartX = 0;
    overlay.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
    overlay.addEventListener('touchend', (e) => {
      const diff = touchStartX - e.changedTouches[0].screenX;
      if (Math.abs(diff) > 50) diff > 0 ? nextBtn.click() : prevBtn.click();
    }, { passive: true });

    updateGallery(currentIndex);
    document.body.appendChild(overlay);
  },

  _openSingleImage(url) {
    const existing = document.querySelector('.file-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'file-overlay';
    overlay.innerHTML = `
      <div class="file-overlay-bg"></div>
      <button class="gallery-close icon-btn" aria-label="Close preview">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" width="24" height="24">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
      <div class="gallery-image-container">
        <img src="${url}" class="file-overlay-image" alt="Preview">
      </div>
      <div class="gallery-bottom-bar">
        <button class="gallery-save-btn" aria-label="Save image">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Сохранить
        </button>
      </div>
    `;
    const bg = overlay.querySelector('.file-overlay-bg');
    const closeBtn = overlay.querySelector('.gallery-close');
    const saveBtn = overlay.querySelector('.gallery-save-btn');
    const remove = () => overlay.remove();
    bg.addEventListener('click', remove);
    closeBtn.addEventListener('click', remove);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') remove(); }, { once: true });
    saveBtn.addEventListener('click', (e) => { e.stopPropagation(); this._downloadFile(url, 'photo'); });
    document.body.appendChild(overlay);
  },

  _downloadFile(url, filename) {
    fetch(url)
      .then(res => res.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename || 'download';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(blobUrl); }, 1000);
      })
      .catch(() => {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'download';
        a.target = '_blank';
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => a.remove(), 1000);
      });
  },

  /**
   * Render image grid for multiple photos.
   */
  renderImageGrid(files) {
    const count = files.length;
    let gridClass = 'grid-1';
    if (count === 2) gridClass = 'grid-2';
    else if (count === 3) gridClass = 'grid-3';
    else if (count === 4) gridClass = 'grid-4';
    else if (count === 5) gridClass = 'grid-5';
    else if (count >= 6) gridClass = 'grid-many';

    const imagesHtml = files.map(f =>
      `<img src="${Utils.escapeHtml(f.url)}" alt="${Utils.escapeHtml(f.name)}"
            loading="lazy" onclick="UI.openImageGallery('${Utils.escapeHtml(f.url)}')">`
    ).join('');

    return `<div class="message-images-grid ${gridClass}">${imagesHtml}</div>`;
  },

  // ─── Quoted / Reply message rendering ────────────────────────────────────

  /**
   * Render a "reply to" preview block.
   * @param {object} replyTo
   * @returns {string}
   */
  renderReplyBlock(replyTo) {
    if (!replyTo) return '';
    const text = replyTo.message
      ? `<span>${Utils.escapeHtml(replyTo.message.substring(0, 150))}</span>`
      : (replyTo.file ? '<span>📷 Фото</span>' : '<span>📎 Файл</span>');
    return `
      <div class="message-reply">
        <div class="message-reply-line"></div>
        <div class="message-reply-content">
          <span class="message-reply-name">${Utils.escapeHtml(replyTo.senderName || replyTo.sender)}</span>
          ${text}
        </div>
      </div>`;
  },

  // ─── Context Menu ────────────────────────────────────────────────────────

  /**
   * Show context menu at position for a given message element.
   * @param {MouseEvent|TouchEvent} event
   * @param {Element} messageEl - the .message element
   */
  showContextMenu(event, messageEl) {
    event.preventDefault();
    const msgId = messageEl.dataset.id;
    if (!msgId) return;

    // Find message data
    const msg = typeof Chat !== 'undefined' ? Chat.messages.find(m => m.id === msgId) : null;
    if (!msg || msg.deleted) return;

    const currentUser = Auth.getUser()?.username;
    const isOwn = msg.sender === currentUser;
    const isForwarded = !!msg.forwarded;

    // Remove existing menu
    this._removeContextMenu();

    const x = event.type === 'touchstart' ? event.touches[0].clientX : event.clientX;
    const y = event.type === 'touchstart' ? event.touches[0].clientY : event.clientY;

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';

    let itemsHtml = '';

    // Reply
    itemsHtml += `<button class="context-menu-item" data-action="reply">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"
           stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 17 4 12 9 7"/>
        <path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
      </svg>
      Ответить
    </button>`;

    // Forward
    itemsHtml += `<button class="context-menu-item" data-action="forward">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"
           stroke-linecap="round" stroke-linejoin="round">
        <polyline points="17 1 21 5 17 9"/>
        <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
        <line x1="21" y1="5" x2="3" y2="5"/>
      </svg>
      Переслать
    </button>`;

    // Delete (only for own messages)
    if (isOwn) {
      itemsHtml += `<div class="context-menu-divider"></div>`;
      itemsHtml += `<button class="context-menu-item context-menu-item-danger" data-action="delete-me">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"
             stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
        Удалить у меня
      </button>`;
      itemsHtml += `<button class="context-menu-item context-menu-item-danger" data-action="delete-all">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"
             stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          <line x1="10" y1="11" x2="10" y2="17"/>
          <line x1="14" y1="11" x2="14" y2="17"/>
        </svg>
        Удалить у всех
      </button>`;
    }

    menu.innerHTML = itemsHtml;

    // Action handlers
    menu.querySelectorAll('.context-menu-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        this._removeContextMenu();

        if (action === 'reply') {
          Chat.setReplyTo(msg);
        } else if (action === 'forward') {
          this.showForwardModal(msg);
        } else if (action === 'delete-me') {
          Chat.deleteMessage(msgId, false);
        } else if (action === 'delete-all') {
          if (confirm('Удалить это сообщение у всех?')) {
            Chat.deleteMessage(msgId, true);
          }
        }
      });
    });

    // Position adjustment
    requestAnimationFrame(() => {
      const rect = menu.getBoundingClientRect();
      if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 8) + 'px';
      if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 8) + 'px';
    });

    // Close on click outside
    this._contextMenuCloseHandler = (e) => {
      if (!menu.contains(e.target)) this._removeContextMenu();
    };
    setTimeout(() => document.addEventListener('click', this._contextMenuCloseHandler), 10);

    document.body.appendChild(menu);
  },

  _removeContextMenu() {
    const existing = document.querySelector('.context-menu');
    if (existing) existing.remove();
    if (this._contextMenuCloseHandler) {
      document.removeEventListener('click', this._contextMenuCloseHandler);
      this._contextMenuCloseHandler = null;
    }
  },

  // ─── Reply Panel ────────────────────────────────────────────────────────

  showReplyPanel(replyData) {
    const panel = this.elements['reply-panel'];
    const textEl = this.elements['reply-panel-text'];
    if (!panel || !textEl) return;

    const name = replyData.senderName || replyData.sender;
    const content = replyData.message
      ? replyData.message.substring(0, 150)
      : (replyData.file ? '📷 Фото' : '📎 Файл');

    textEl.innerHTML = `<strong>${Utils.escapeHtml(name)}</strong>: ${Utils.escapeHtml(content)}`;
    panel.classList.remove('hidden');
  },

  hideReplyPanel() {
    const panel = this.elements['reply-panel'];
    if (panel) panel.classList.add('hidden');
  },

  // ─── Forward Modal ──────────────────────────────────────────────────────

  showForwardModal(message) {
    const overlay = this.elements['forward-modal-overlay'];
    const modal = this.elements['forward-modal'];
    const list = this.elements['forward-modal-list'];
    if (!overlay || !modal || !list) return;

    const currentUser = Auth.getUser()?.username;
    const users = typeof Chat !== 'undefined' ? Chat.users : [];

    list.innerHTML = users
      .filter(u => u.username !== currentUser)
      .map(u => `
        <button class="forward-user-item" data-username="${Utils.escapeHtml(u.username)}">
          <div class="user-item-avatar avatar" style="background-color: ${Utils.getAvatarColor(u.username)}">
            ${Utils.escapeHtml(Utils.getInitials(u.name || u.username))}
          </div>
          <span class="forward-user-name">${Utils.escapeHtml(u.name || u.username)}</span>
        </button>
      `).join('') || '<p class="forward-empty">Нет доступных чатов</p>';

    // Click handler
    list.querySelectorAll('.forward-user-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const username = btn.dataset.username;
        Chat.forwardToUser(username, message);
        this.hideForwardModal();
      });
    });

    overlay.classList.remove('hidden');
    modal.classList.remove('hidden');
  },

  hideForwardModal() {
    const overlay = this.elements['forward-modal-overlay'];
    const modal = this.elements['forward-modal'];
    if (overlay) overlay.classList.add('hidden');
    if (modal) modal.classList.add('hidden');
  },

  // ─── Render Messages (with reply block, context menu, forwarded) ────────

  renderMessages(messages, currentUsername) {
    const container = this.elements['messages-list'];

    if (!messages || messages.length === 0) {
      container.innerHTML = `
        <div class="messages-empty">
          <p>Сообщений пока нет</p>
          <span>Начните общение первым!</span>
        </div>`;
      return;
    }

    let html = '';
    let lastDate = null;

    messages.forEach(msg => {
      if (Utils.isDifferentDay(msg.timestamp, lastDate)) {
        html += `<div class="date-separator"><span>${Utils.escapeHtml(Utils.formatDateSeparator(msg.timestamp))}</span></div>`;
        lastDate = msg.timestamp;
      }

      // Deleted message
      if (msg.deleted) {
        html += `
          <div class="message message-deleted" data-id="${Utils.escapeHtml(msg.id || '')}">
            <div class="message-bubble message-bubble-deleted">
              <span class="message-deleted-text">Сообщение удалено</span>
            </div>
          </div>`;
        return;
      }

      const isSent = msg.sender === currentUsername;

      let readIcon = '';
      if (isSent) {
        if (msg.status === 'sending') {
          readIcon = '<span class="read-icon-loader"></span>';
        } else if (msg.status === 'failed') {
          readIcon = '<span class="read-icon-error" title="Не удалось отправить.">⚠️</span>';
        } else {
          readIcon = msg.read
            ? '<span class="message-status read">✓✓</span>'
            : '<span class="message-status sent">✓</span>';
        }
      }

      const sendingAttr = msg.status === 'sending' ? 'data-sending="true"' : '';
      const failedAttr = msg.status === 'failed' ? 'data-failed="true"' : '';

      // Reply block
      const replyBlock = msg.replyTo ? this.renderReplyBlock(msg.replyTo) : '';

      // Forwarded label
      let forwardedHtml = '';
      if (msg.forwarded) {
        const fromName = (typeof Chat !== 'undefined' && Chat.users)
          ? (Chat.users.find(u => u.username === msg.forwardedFrom)?.name || msg.forwardedFrom)
          : msg.forwardedFrom;
        forwardedHtml = `<div class="message-forwarded">↗ ${Utils.escapeHtml(fromName)}</div>`;
      }

      // Build content
      const hasText = !!msg.message;
      const hasFile = !!msg.file;
      const hasFilesArray = msg.files && Array.isArray(msg.files) && msg.files.length > 0;
      const isImageFile = hasFile && msg.file.category === 'image';
      const isPhotoOnly = hasFile && isImageFile && !hasText && !hasFilesArray;

      let messageContent = replyBlock + forwardedHtml;
      if (hasText) {
        messageContent += `<div class="message-text">${Utils.escapeHtml(msg.message)}</div>`;
      }

      if (hasFilesArray) {
        const imageFiles = msg.files.filter(f => f.category === 'image');
        const docFiles = msg.files.filter(f => f.category !== 'image');
        if (imageFiles.length > 0) messageContent += this.renderImageGrid(imageFiles);
        docFiles.forEach(f => { messageContent += this.renderFileAttachment(f); });
      } else if (hasFile) {
        if (isPhotoOnly) {
          const metaHtml = `<span class="message-time">${Utils.escapeHtml(Utils.formatTimestamp(msg.timestamp))}</span>${readIcon}`;
          messageContent += this.renderFileAttachment(msg.file, metaHtml);
        } else {
          messageContent += this.renderFileAttachment(msg.file);
        }
      }

      const isMediaOnly = hasFilesArray && !hasText;
      const isLegacyPhotoOnly = isPhotoOnly;

      // Context menu attributes
      const ctxAttr = `data-ctx="true"`;

      if (isMediaOnly) {
        const imageFiles = msg.files.filter(f => f.category === 'image');
        const docFiles = msg.files.filter(f => f.category !== 'image');
        if (imageFiles.length > 0 && docFiles.length === 0) {
          const timeHtml = `<span class="message-time">${Utils.escapeHtml(Utils.formatTimestamp(msg.timestamp))}</span>`;
          html += `
            <div class="message ${isSent ? 'sent' : 'received'} message-photo"
                 data-id="${Utils.escapeHtml(msg.id || '')}" ${sendingAttr} ${failedAttr} ${ctxAttr}>
              <div class="photo-wrapper">
                ${replyBlock ? `<div class="photo-reply-overlay">${replyBlock}</div>` : ''}
                ${forwardedHtml}
                ${this.renderImageGrid(imageFiles)}
                <div class="photo-meta">${timeHtml} ${readIcon}</div>
              </div>
            </div>`;
        } else {
          html += `
            <div class="message ${isSent ? 'sent' : 'received'}"
                 data-id="${Utils.escapeHtml(msg.id || '')}" ${sendingAttr} ${failedAttr} ${ctxAttr}>
              <div class="message-bubble">
                ${messageContent}
                <div class="message-meta">
                  <span class="message-time">${Utils.escapeHtml(Utils.formatTimestamp(msg.timestamp))}</span>
                  ${readIcon}
                </div>
              </div>
            </div>`;
        }
      } else if (isLegacyPhotoOnly) {
        html += `
          <div class="message ${isSent ? 'sent' : 'received'} message-photo"
               data-id="${Utils.escapeHtml(msg.id || '')}" ${sendingAttr} ${failedAttr} ${ctxAttr}>
            ${messageContent}
          </div>`;
      } else {
        html += `
          <div class="message ${isSent ? 'sent' : 'received'}"
               data-id="${Utils.escapeHtml(msg.id || '')}" ${sendingAttr} ${failedAttr} ${ctxAttr}>
            <div class="message-bubble">
              ${messageContent}
              <div class="message-meta">
                <span class="message-time">${Utils.escapeHtml(Utils.formatTimestamp(msg.timestamp))}</span>
                ${readIcon}
              </div>
            </div>
          </div>`;
      }
    });

    container.innerHTML = html || `
      <div class="messages-empty">
        <p>No matching messages</p>
        <span>Try a different search term</span>
      </div>`;

    // Bind context menu on all messages
    container.querySelectorAll('.message[data-ctx]').forEach(el => {
      // Right click (desktop)
      el.addEventListener('contextmenu', (e) => {
        this.showContextMenu(e, el);
      });

      // Long press (mobile)
      let longPressTimer = null;
      el.addEventListener('touchstart', (e) => {
        longPressTimer = setTimeout(() => {
          this.showContextMenu(e, el);
        }, 500);
      }, { passive: true });
      el.addEventListener('touchend', () => clearTimeout(longPressTimer), { passive: true });
      el.addEventListener('touchmove', () => clearTimeout(longPressTimer), { passive: true });
    });
  },

  scrollToBottom(smooth = false) {
    const container = this.elements['messages-container'];
    if (!container) return;
    requestAnimationFrame(() => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: smooth ? 'smooth' : 'instant'
      });
    });
  },

  showTypingIndicator(username, isTyping) {
    const el = this.elements['typing-indicator'];
    const text = this.elements['typing-text'];

    if (isTyping) {
      text.textContent = `${username} печатает...`;
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  },

  // ─── Mobile Sidebar ─────────────────────────────────────────────────────

  showSidebar() {
    this.elements['app-layout']?.classList.remove('is-chat-open');
  },

  hideSidebar() {
    this.elements['app-layout']?.classList.add('is-chat-open');
  },

  // ─── iOS Keyboard ──────────────────────────────────────────────────────

  setupViewportHeight() {
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        if (typeof Chat !== 'undefined' && Chat.activeChatUser) {
          setTimeout(() => this.scrollToBottom(false), 50);
        }
      });
    }
  },

  // ─── Theme ─────────────────────────────────────────────────────────────

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(AppConfig.STORAGE_KEYS.THEME, theme);
  },

  getTheme() {
    return localStorage.getItem(AppConfig.STORAGE_KEYS.THEME) ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  },

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    this.applyTheme(current === 'dark' ? 'light' : 'dark');
  },

  // ─── Auth Tabs ─────────────────────────────────────────────────────────

  switchAuthTab(mode) {
    const tabLogin = this.elements['tab-login'];
    const tabRegister = this.elements['tab-register'];
    const nameGroup = this.elements['name-group'];
    const btnText = this.elements['login-btn']?.querySelector('.btn-text');

    tabLogin.classList.toggle('active', mode === 'login');
    tabRegister.classList.toggle('active', mode === 'register');

    nameGroup.classList.toggle('hidden', mode === 'login');
    nameGroup.querySelector('input').required = (mode === 'register');

    if (btnText) {
      btnText.textContent = mode === 'login' ? 'Войти' : 'Зарегистрироваться';
    }
    this.hideLoginError();
  },

  // ─── Toast ─────────────────────────────────────────────────────────────

  showError(message, duration = 4000) {
    const toast = this.elements['error-toast'];
    const text = this.elements['error-toast-text'];
    text.textContent = message;
    toast.classList.remove('hidden');

    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.add('hidden');
    }, duration);
  },

  // ─── File Preview Panel ────────────────────────────────────────────────

  showAttachSheet() {
    this.elements['attach-sheet-overlay'].classList.remove('hidden');
    this.elements['attach-sheet'].classList.remove('hidden');
  },

  hideAttachSheet() {
    this.elements['attach-sheet-overlay'].classList.add('hidden');
    this.elements['attach-sheet'].classList.add('hidden');
  },

  // ─── Settings Sheet (gear) ─────────────────────────────────────────────

  showSettingsSheet() {
    const existing = document.querySelector('.settings-sheet-overlay');
    if (existing) existing.remove();
    const existingSheet = document.querySelector('.settings-sheet');
    if (existingSheet) existingSheet.remove();

    const overlay = document.createElement('div');
    overlay.className = 'attach-sheet-overlay settings-sheet-overlay';
    overlay.addEventListener('click', () => this._removeSettingsSheet());

    const sheet = document.createElement('div');
    sheet.className = 'attach-sheet settings-sheet';
    sheet.innerHTML = `
      <div class="attach-sheet-handle"></div>
      <div class="attach-sheet-title">Настройки</div>
      <div class="attach-sheet-options">
        <button class="attach-sheet-option" data-action="theme">
          <div class="attach-option-icon" style="background:#8b5cf6;color:#fff;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22"
                 stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="5"/>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
          </div>
          <span>Сменить тему</span>
        </button>
        <button class="attach-sheet-option" data-action="logout">
          <div class="attach-option-icon" style="background:#ef4444;color:#fff;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22"
                 stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </div>
          <span>Выйти</span>
        </button>
      </div>
      <button class="attach-sheet-cancel" id="settings-sheet-cancel">Отмена</button>
    `;

    sheet.querySelectorAll('.attach-sheet-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        this._removeSettingsSheet();
        if (action === 'theme') {
          this.toggleTheme();
        } else if (action === 'logout') {
          if (typeof App !== 'undefined') App.handleLogout();
        }
      });
    });

    sheet.querySelector('#settings-sheet-cancel').addEventListener('click', () => this._removeSettingsSheet());

    document.body.appendChild(overlay);
    document.body.appendChild(sheet);
  },

  _removeSettingsSheet() {
    const overlay = document.querySelector('.settings-sheet-overlay');
    const sheet = document.querySelector('.settings-sheet');
    if (overlay) overlay.remove();
    if (sheet) sheet.remove();
  },

  addFilesToPreview(files) {
    const fileArray = Array.from(files);
    fileArray.forEach(file => {
      const exists = this._previewFiles.some(f => f.name === file.name && f.size === file.size);
      if (!exists) this._previewFiles.push(file);
    });
    this.renderFilePreview();
  },

  removeFileFromPreview(index) {
    this._previewFiles.splice(index, 1);
    this.renderFilePreview();
  },

  clearFilePreview() {
    this._previewFiles = [];
    this.renderFilePreview();
  },

  renderFilePreview() {
    const panel = this.elements['file-preview-panel'];
    const grid = this.elements['file-preview-grid'];
    const countEl = this.elements['file-preview-count'];
    const files = this._previewFiles;

    if (files.length === 0) {
      panel.classList.add('hidden');
      return;
    }

    panel.classList.remove('hidden');
    countEl.textContent = `${files.length} файл${files.length > 1 ? 'ов' : ''}`;

    grid.innerHTML = files.map((file, index) => {
      const isImage = file.type.startsWith('image/');
      if (isImage) {
        const url = URL.createObjectURL(file);
        return `<div class="file-preview-item" data-index="${index}">
          <img src="${url}" alt="${Utils.escapeHtml(file.name)}">
          <button class="file-preview-item-remove" data-index="${index}" aria-label="Remove">✕</button>
        </div>`;
      } else {
        const category = Storage.getFileCategory(file.type);
        return `<div class="file-preview-item file-preview-item-doc" data-index="${index}">
          ${Storage.getFileIconSVG(category)}<span>${Utils.escapeHtml(file.name)}</span>
          <button class="file-preview-item-remove" data-index="${index}" aria-label="Remove">✕</button>
        </div>`;
      }
    }).join('');

    grid.querySelectorAll('.file-preview-item-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeFileFromPreview(parseInt(btn.dataset.index, 10));
      });
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  UI.setupViewportHeight();
});