/**
 * Chat module — message sending, realtime sync, typing indicators, and read status using Firebase.
 */

/**
 * Generate a random ID (fallback if crypto.randomUUID is not available).
 * @returns {string}
 */
function generateClientId() {
  try {
    return crypto.randomUUID();
  } catch (e) {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

const Chat = {
  activeChatUser: null,
  messages: [],
  users: [],

  isSendingMessage: false,
  
  messagesRef: null,
  typingRef: null,
  usersRef: null,
  
  heartbeatTimer: null,
  typingTimer: null,
  isTyping: false,
  lastMessageCount: 0,
  lastSeenUpdateTimer: null,
  _unreadRefreshTimer: null,

  // Reply state
  replyToMessage: null,

  async openChat(loginUsername, displayName) {
    if (!loginUsername || loginUsername === Auth.getUser()?.username) return;

    this.cleanupActiveChatListeners();
    this.clearReply();

    this.activeChatUser = loginUsername;
    this.messages = [];
    this.lastMessageCount = 0;

    const cachedUser = this.users.find(u => u.username === loginUsername);
    const isOnline = !!cachedUser?.isOnline;
    const lastSeen = cachedUser?.lastSeen || null;

    UI.showChatActive(loginUsername, displayName, isOnline, lastSeen);
    UI.hideSidebar();

    this.startLastSeenTimer();

    const currentUser = Auth.getUser().username;

    const chatKey = Utils.getChatKey(currentUser, loginUsername);
    const cached = Utils.getCachedMessages(chatKey);
    if (cached) {
      this.messages = cached;
      UI.renderMessages(this.messages, currentUser);
    } else {
      UI.renderMessages([], currentUser);
    }

    this.messagesRef = API.listenToMessages(currentUser, loginUsername, (freshMessages) => {
      const optimisticItems =
  this.messages.filter(
    m => m.status === 'sending' ||
         m.status === 'failed'
  );
      
      const firebaseClientIds =
  new Set(
    freshMessages
      .filter(m => m.clientId)
      .map(m => m.clientId)
  );

const filteredOptimistic =
  optimisticItems.filter(
    m => !firebaseClientIds.has(m.clientId)
  );
      
      this.messages = [...freshMessages, ...filteredOptimistic];
      
      const hadNewMessages = this.messages.length > this.lastMessageCount;
      this.lastMessageCount = this.messages.length;

      Utils.cacheMessages(chatKey, this.messages);
      UI.renderMessages(this.messages, currentUser);

      if (hadNewMessages) {
        UI.scrollToBottom(true);
        this.markAsRead();
      }
    });

    this.typingRef = API.listenToTyping(currentUser, loginUsername, (isPartnerTyping) => {
      const partner = this.users.find(u => u.username === this.activeChatUser);
      const shownName = partner ? (partner.name || partner.username) : this.activeChatUser;
      UI.showTypingIndicator(shownName, isPartnerTyping);
      if (isPartnerTyping) UI.scrollToBottom(true);
    });

    this.markAsRead();

    const userInList = this.users.find(u => u.username === loginUsername);
    if (userInList) {
      userInList.hasUnread = false;
      const searchQuery = UI.elements['user-search']?.value || '';
      UI.renderUsersList(this.users, loginUsername, searchQuery);
    }

    if (window.innerWidth > 768) {
      UI.elements['message-input'].focus();
    }
  },

  closeChat() {
    this.cleanupActiveChatListeners();
    this.stopLastSeenTimer();
    this.activeChatUser = null;
    this.messages = [];
    this.stopTyping();
    this.clearReply();
    UI.showChatEmpty();
    UI.showSidebar();
  },

  startLastSeenTimer() {
    this.stopLastSeenTimer();
    this.lastSeenUpdateTimer = setInterval(() => {
      if (!this.activeChatUser) return;
      const activeUser = this.users.find(u => u.username === this.activeChatUser);
      if (activeUser && !activeUser.isOnline) {
        UI.updateChatStatus(false, activeUser.lastSeen);
      }
    }, 60000);
  },

  stopLastSeenTimer() {
    if (this.lastSeenUpdateTimer) {
      clearInterval(this.lastSeenUpdateTimer);
      this.lastSeenUpdateTimer = null;
    }
  },

  cleanupActiveChatListeners() {
    if (this.messagesRef) {
      API.stopListeningToMessages(this.messagesRef);
      this.messagesRef = null;
    }
    if (this.typingRef) {
      if (typeof this.typingRef.off === 'function') this.typingRef.off('value');
      this.typingRef = null;
    }
  },

  async sendMessage(text, fileData = null) {
    if (!this.activeChatUser || !Auth.isLoggedIn()) return;
    if (this.isSendingMessage) return;

    const hasText = text && text.trim().length > 0;
    if (!hasText && !fileData) return;

    let validatedText = '';
    if (hasText) {
      const validation = Utils.validateMessage(text);
      if (!validation.valid) { UI.showError(validation.error); return; }
      validatedText = validation.value;
    }

    const currentUser = Auth.getUser().username;
    this.isSendingMessage = true;
    this.stopTyping();

    const inputEl = UI.elements['message-input'];
    const sendBtnEl = UI.elements['send-btn'];
    if (inputEl) inputEl.disabled = true;
    if (sendBtnEl) sendBtnEl.disabled = true;

    const clientId = generateClientId();
    const replyTo = this.replyToMessage;

    const optimisticMessage = {
      id: 'temp-' + clientId, clientId,
      sender: currentUser, receiver: this.activeChatUser,
      message: validatedText || '', timestamp: new Date().toISOString(),
      read: false, status: 'sending', file: fileData,
      replyTo: replyTo ? {
        id: replyTo.id,
        sender: replyTo.sender,
        message: replyTo.message || '',
        senderName: replyTo.senderName || replyTo.sender
      } : null
    };

    this.messages.push(optimisticMessage);
    this.lastMessageCount = this.messages.length;
    UI.renderMessages(this.messages, currentUser);
    UI.scrollToBottom(true);
    if (inputEl) { inputEl.value = ''; this.autoResizeInput(); }

    try {
      const response = await API.sendMessage(
        currentUser, this.activeChatUser, validatedText || '',
        clientId, fileData, null, replyTo
      );
      if (!response || !response.success) throw new Error('Firebase write failed');
      this.clearReply();
    } catch (error) {
      console.error(error);
      const msg = this.messages.find(m => m.clientId === clientId);
      if (msg) msg.status = 'failed';
      UI.showError(error.message || 'Не удалось отправить сообщение');
      UI.renderMessages(this.messages, currentUser);
    } finally {
      this.isSendingMessage = false;
      if (inputEl) { inputEl.disabled = false; inputEl.focus(); }
      if (sendBtnEl) sendBtnEl.disabled = false;
      this.autoResizeInput();
    }
  },

  async markAsRead() {
    if (!this.activeChatUser || !Auth.isLoggedIn()) return;
    try {
      await API.markMessagesRead(Auth.getUser().username, this.activeChatUser);
    } catch (error) {
      console.warn('Failed to mark messages as read:', error.message);
    }
  },

  notifyTyping() {
    if (!this.activeChatUser || !Auth.isLoggedIn()) return;
    if (!this.isTyping) {
      this.isTyping = true;
      API.setTyping(Auth.getUser().username, this.activeChatUser, true).catch(() => {});
    }
    clearTimeout(this.typingTimer);
    this.typingTimer = setTimeout(() => this.stopTyping(), AppConfig.TYPING_TIMEOUT || 4000);
  },

  stopTyping() {
    if (!this.isTyping) return;
    this.isTyping = false;
    clearTimeout(this.typingTimer);
    if (this.activeChatUser && Auth.isLoggedIn()) {
      API.setTyping(Auth.getUser().username, this.activeChatUser, false).catch(() => {});
    }
  },

  /**
   * Send multiple files as a SINGLE message with grid display.
   */
  async sendFiles(filesArray) {
    if (!this.activeChatUser || !Auth.isLoggedIn() || !filesArray || filesArray.length === 0) return;

    const currentUser = Auth.getUser().username;
    this.isSendingMessage = true;
    this.stopTyping();

    const inputEl = UI.elements['message-input'];
    const sendBtnEl = UI.elements['send-btn'];
    if (inputEl) inputEl.disabled = true;
    if (sendBtnEl) sendBtnEl.disabled = true;

    const clientId = generateClientId();
    const replyTo = this.replyToMessage;

    const optimisticMessage = {
      id: 'temp-' + clientId, clientId,
      sender: currentUser, receiver: this.activeChatUser,
      message: '',
      timestamp: new Date().toISOString(),
      read: false, status: 'sending',
      files: filesArray,
      replyTo: replyTo ? {
        id: replyTo.id,
        sender: replyTo.sender,
        message: replyTo.message || '',
        senderName: replyTo.senderName || replyTo.sender
      } : null
    };

    this.messages.push(optimisticMessage);
    this.lastMessageCount = this.messages.length;
    UI.renderMessages(this.messages, currentUser);
    UI.scrollToBottom(true);

    try {
      const response = await API.sendMessage(
        currentUser, this.activeChatUser, '',
        clientId, null, filesArray, replyTo
      );
      if (!response || !response.success) throw new Error('Firebase write failed');
      this.clearReply();
    } catch (error) {
      console.error(error);
      const msg = this.messages.find(m => m.clientId === clientId);
      if (msg) msg.status = 'failed';
      UI.showError(error.message || 'Не удалось отправить сообщение');
      UI.renderMessages(this.messages, currentUser);
    } finally {
      this.isSendingMessage = false;
      if (inputEl) { inputEl.disabled = false; inputEl.focus(); }
      if (sendBtnEl) sendBtnEl.disabled = false;
    }
  },

  autoResizeInput() {
    const input = UI.elements['message-input'];
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  },

  // ─── Reply ─────────────────────────────────────────────────────────────

  setReplyTo(message) {
    if (!message || message.deleted) return;
    const currentUser = Auth.getUser()?.username;
    const partnerName = message.sender === currentUser ? 'Вы' :
      (this.users.find(u => u.username === message.sender)?.name || message.sender);

    this.replyToMessage = {
      id: message.id,
      sender: message.sender,
      message: message.message || '',
      senderName: partnerName,
      file: message.file || null,
      files: message.files || null
    };

    UI.showReplyPanel(this.replyToMessage);
    UI.elements['message-input']?.focus();
  },

  clearReply() {
    this.replyToMessage = null;
    UI.hideReplyPanel();
  },

  // ─── Delete Message ────────────────────────────────────────────────────

  async deleteMessage(messageId, forEveryone = false) {
    if (!this.activeChatUser || !messageId || !Auth.isLoggedIn()) return;

    const currentUser = Auth.getUser().username;

    try {
      await API.deleteMessage(currentUser, this.activeChatUser, messageId);
      UI.showError('Сообщение удалено' + (forEveryone ? ' у всех' : ''), 2000);
    } catch (error) {
      UI.showError('Ошибка удаления сообщения');
    }
  },

  // ─── Forward Message ───────────────────────────────────────────────────

  async forwardToUser(receiverUsername, originalMessage) {
    if (!receiverUsername || !originalMessage || !Auth.isLoggedIn()) return;

    const currentUser = Auth.getUser().username;
    const clientId = generateClientId();

    try {
      await API.forwardMessage(currentUser, receiverUsername, originalMessage, clientId);

      // Если пересылаем в текущий открытый чат — сразу показываем
      if (this.activeChatUser === receiverUsername) {
        const optimisticForwarded = {
          id: 'temp-' + clientId, clientId,
          sender: currentUser, receiver: receiverUsername,
          message: originalMessage.message || '',
          timestamp: new Date().toISOString(),
          read: false, status: 'sending',
          forwarded: true,
          forwardedFrom: originalMessage.sender,
          file: originalMessage.file || null,
          files: originalMessage.files || null
        };

        this.messages.push(optimisticForwarded);
        this.lastMessageCount = this.messages.length;
        UI.renderMessages(this.messages, currentUser);
        UI.scrollToBottom(true);
      }

      UI.showError('Сообщение переслано', 2000);
    } catch (error) {
      UI.showError('Ошибка пересылки сообщения');
    }
  },

  // ─── Unread ────────────────────────────────────────────────────────────

  /**
   * Check if a user has unread messages by checking the last message in their chat.
   */
  async checkUnread(currentUser, partnerUsername) {
    const chatKey = Utils.getChatKey(currentUser, partnerUsername);
    const cached = Utils.getCachedMessages(chatKey);

    if (cached && Array.isArray(cached) && cached.length > 0) {
      for (let i = cached.length - 1; i >= 0; i--) {
        const msg = cached[i];
        if (msg.sender === partnerUsername && msg.read === false) return true;
        if (msg.sender === currentUser) break;
      }
      return false;
    }

    try {
      const db = getDB();
      const ref = db.ref(`chats/${chatKey}/messages`).orderByKey().limitToLast(1);
      const snapshot = await ref.get();
      if (!snapshot.exists()) return false;
      let lastMsg = null;
      snapshot.forEach(child => { lastMsg = child.val(); });
      if (!lastMsg) return false;
      return lastMsg.sender === partnerUsername && lastMsg.read === false;
    } catch (e) {
      return false;
    }
  },

  /**
   * Асинхронно обновляет hasUnread для всех пользователей и перерендеривает список.
   */
  async refreshUnreadBadges() {
    const currentUser = Auth.getUser()?.username;
    if (!currentUser || this.users.length === 0) return;

    const results = await Promise.all(
      this.users.map(u => this.checkUnread(currentUser, u.username))
    );
    let changed = false;
    this.users.forEach((u, i) => {
      if (u.hasUnread !== results[i]) {
        u.hasUnread = results[i];
        changed = true;
      }
    });
    if (changed) {
      const searchQuery = UI.elements['user-search']?.value || '';
      UI.renderUsersList(this.users, this.activeChatUser, searchQuery);
    }
  },

  /**
   * Start Firebase real-time listeners for general app states (Users & Heartbeat).
   */
  startPolling() {
    this.stopPolling();
    const currentUser = Auth.getUser()?.username;
    if (!currentUser) return;

    const db = getDB();
    const usersRef = db.ref('users');
    this.usersRef = usersRef;

    usersRef.on('value', (snapshot) => {
      const usersData = snapshot.val() || {};
      const now = Date.now();

      this.users = Object.entries(usersData)
        .map(([key, value]) => {
          const lastSeenMs = value.lastSeen ? new Date(value.lastSeen).getTime() : 0;
          return {
            username: key,
            name: value.name || key,
            isOnline: (now - lastSeenMs) < AppConfig.ONLINE_THRESHOLD_MS,
            lastSeen: value.lastSeen || null,
            hasUnread: false
          };
        })
        .filter(u => u.username !== currentUser);

      const searchQuery = UI.elements['user-search']?.value || '';
      UI.renderUsersList(this.users, this.activeChatUser, searchQuery);

      if (this.activeChatUser) {
        const activeUser = this.users.find(u => u.username === this.activeChatUser);
        if (activeUser) {
          UI.updateChatStatus(!!activeUser.isOnline, activeUser.lastSeen);
        }
      }

      setTimeout(() => this.refreshUnreadBadges(), 0);
    });

    this.heartbeatTimer = setInterval(() => {
      API.updateLastSeen(currentUser, true);
    }, AppConfig.HEARTBEAT_INTERVAL || 30000);

    API.updateLastSeen(currentUser, true);
  },

  stopPolling() {
    this.cleanupActiveChatListeners();
    this.stopLastSeenTimer();

    if (this.usersRef && typeof this.usersRef.off === 'function') {
      this.usersRef.off('value');
      this.usersRef = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this._unreadRefreshTimer) {
      clearTimeout(this._unreadRefreshTimer);
      this._unreadRefreshTimer = null;
    }

    const user = Auth.getUser()?.username;
    if (user) {
      API.updateLastSeen(user, false);
    }
  }
};