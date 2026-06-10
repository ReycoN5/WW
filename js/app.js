/**
 * Main application entry point.
 * Wires together auth, chat, and UI modules.
 */

const App = {
  /**
   * Bootstrap the application.
   */
  async init() {
    UI.init();
    UI.applyTheme(UI.getTheme());

    await this.start();
  },

  /**
   * Start the app.
   */
  async start() {
    this.bindEvents();

    const savedUser = Auth.init();

    if (savedUser) {
      await this.enterApp();
    } else {
      UI.showLogin();
    }
  },

  /**
   * Transition into the main app after login.
   */
  async enterApp() {
    const user = Auth.getUser();
    UI.setAvatar(UI.elements['current-user-avatar'], user.name || user.username);
    UI.elements['current-username'].textContent = user.name || user.username;

    UI.showApp();
    Chat.startPolling();
  },

  /**
   * Bind all UI event listeners.
   */
  bindEvents() {
    // Auth tabs
    UI.elements['tab-login'].addEventListener('click', () => {
      Auth.authMode = 'login';
      UI.switchAuthTab('login');
    });

    UI.elements['tab-register'].addEventListener('click', () => {
      Auth.authMode = 'register';
      UI.switchAuthTab('register');
    });

    // Login form
    UI.elements['login-form'].addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleAuth();
    });

    // Settings button (gear) → show bottom sheet with Theme + Logout
    UI.elements['settings-btn'].addEventListener('click', () => {
      UI.showSettingsSheet();
    });

    // User search
    UI.elements['user-search'].addEventListener('input', Utils.debounce((e) => {
      UI.renderUsersList(Chat.users, Chat.activeChatUser, e.target.value);
    }, 200));

    // Users list click delegation
    UI.elements['users-list'].addEventListener('click', (e) => {
      const item = e.target.closest('.user-item');
      if (item) {
        const username = item.dataset.username;
        const name = item.dataset.name;
        Chat.openChat(username, name);
        UI.renderUsersList(Chat.users, username, UI.elements['user-search'].value);
      }
    });

    // Back button (mobile)
    UI.elements['back-btn'].addEventListener('click', () => {
      Chat.closeChat();
      UI.renderUsersList(Chat.users, null, UI.elements['user-search'].value);
    });

    // Message input
    const messageInput = UI.elements['message-input'];

    messageInput.addEventListener('input', () => {
      const hasText = messageInput.value.trim().length > 0;
      UI.elements['send-btn'].disabled = !hasText;
      Chat.autoResizeInput();
      Chat.notifyTyping();
    });

    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (messageInput.value.trim()) {
          Chat.sendMessage(messageInput.value);
        }
      }
    });

    // Send button
    UI.elements['send-btn'].addEventListener('click', () => {
      Chat.sendMessage(messageInput.value);
    });

    // ══════════════════════════════════════════════════════════════════
    // NEW: Attachment system (like Telegram)
    // ══════════════════════════════════════════════════════════════════

    // 1. "+" button → show bottom sheet
    UI.elements['attach-btn'].addEventListener('click', () => {
      UI.showAttachSheet();
    });

    // 2. Bottom sheet buttons
    document.querySelectorAll('.attach-sheet-option').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.currentTarget.dataset.action;
        UI.hideAttachSheet();

        if (action === 'photos') {
          UI.elements['file-input-photos'].click();
        } else if (action === 'files') {
          UI.elements['file-input-docs'].click();
        } else if (action === 'camera') {
          // Camera: use file-input-photos with capture attribute
          const input = UI.elements['file-input-photos'];
          input.setAttribute('capture', 'environment');
          input.click();
          // Reset capture after a moment so next time it's normal gallery
          setTimeout(() => input.removeAttribute('capture'), 1000);
        }
      });
    });

    // 3. Cancel button & overlay click → close sheet
    UI.elements['attach-sheet-cancel'].addEventListener('click', () => {
      UI.hideAttachSheet();
    });

    UI.elements['attach-sheet-overlay'].addEventListener('click', () => {
      UI.hideAttachSheet();
    });

    // 4. Photos/video input → add to preview
    UI.elements['file-input-photos'].addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        UI.addFilesToPreview(e.target.files);
      }
      e.target.value = '';
    });

    // 5. Docs/files input → add to preview
    UI.elements['file-input-docs'].addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        UI.addFilesToPreview(e.target.files);
      }
      e.target.value = '';
    });

    // 6. "Add more" button in preview panel → open photos picker
    UI.elements['file-preview-add-more'].addEventListener('click', () => {
      UI.elements['file-input-photos'].click();
    });

    // 7. Clear all files
    UI.elements['file-preview-clear'].addEventListener('click', () => {
      UI.clearFilePreview();
    });

    // 8. Send all files from preview panel
    UI.elements['file-preview-send'].addEventListener('click', async () => {
      const files = UI._previewFiles;
      if (files.length === 0) return;

      if (!Chat.activeChatUser) {
        UI.showError('Выберите чат для отправки');
        return;
      }

      // Disable send button
      const sendBtn = UI.elements['file-preview-send'];
      sendBtn.disabled = true;
      sendBtn.textContent = 'Загрузка...';

      try {
        // Clear preview immediately to allow new selections
        UI.clearFilePreview();

        const uploadedFiles = await Storage.uploadFiles(files, (done, total) => {
          UI.showError(`Загрузка файлов: ${done}/${total}`, 2000);
        });

        if (uploadedFiles.length > 0) {
          await Chat.sendFiles(uploadedFiles);
        }

        UI.showError(`Отправлено ${uploadedFiles.length} файл${uploadedFiles.length > 1 ? 'ов' : ''}`, 3000);
      } catch (error) {
        UI.showError(error.message || 'Ошибка загрузки файлов');
      } finally {
        sendBtn.disabled = false;
        sendBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
          <line x1="5" y1="12" x2="19" y2="12"/>
          <polyline points="12 5 19 12 12 19"/>
        </svg>
        Отправить`;
      }
    });

    // 9. Reply panel close button
    UI.elements['reply-panel-close']?.addEventListener('click', () => {
      Chat.clearReply();
    });

    // 10. Forward modal close
    UI.elements['forward-modal-close']?.addEventListener('click', () => {
      UI.hideForwardModal();
    });
    UI.elements['forward-modal-overlay']?.addEventListener('click', () => {
      UI.hideForwardModal();
    });

    // Handle visibility change — polling уже обновляет данные
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && Auth.isLoggedIn()) {
        // Состояние обновляется автоматически через Firebase listeners
      }
    });
  },

  /**
   * Handle auth form submission (login or register based on active tab).
   */
  async handleAuth() {
    const username = UI.elements['username-input'].value;
    const password = UI.elements['password-input'].value;
    const name = UI.elements['name-input'].value;

    UI.hideLoginError();
    UI.setLoginLoading(true);

    try {
      if (Auth.authMode === 'register') {
        await Auth.register(username, password, name);
      } else {
        await Auth.login(username, password);
      }
      await this.enterApp();
    } catch (error) {
      UI.showLoginError(error.message || 'Ошибка входа. Попробуйте снова.');
    } finally {
      UI.setLoginLoading(false);
    }
  },

  /**
   * Handle logout.
   */
  handleLogout() {
    Chat.stopPolling();
    Chat.closeChat();
    Auth.logout();
    UI.showLogin();
    UI.elements['username-input'].value = '';
    UI.elements['name-input'].value = '';
    UI.elements['password-input'].value = '';
    UI.elements['username-input'].focus();
  }
};

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());