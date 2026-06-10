/**
 * Authentication module — login and registration with Firebase.
 */

const Auth = {
  currentUser: null,
  authMode: 'login', // 'login' or 'register'

  /**
   * Hash a password using SHA-256 (via SubtleCrypto).
   * @param {string} password
   * @returns {Promise<string>}
   */
  async hashPassword(password) {
    try {
      if (!window.crypto || !window.crypto.subtle) {
        return password;
      }
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      return password;
    }
  },

  /**
   * Verify a password against a stored hash.
   * @param {string} password - plain text password
   * @param {string} storedHash - stored hash from DB
   * @returns {Promise<boolean>}
   */
  async verifyPassword(password, storedHash) {
    // Handle legacy plain-text passwords (migration)
    if (!storedHash || storedHash.indexOf(':') === -1) {
      return false;
    }
    const parts = storedHash.split(':');
    const salt = parts[0];
    const expected = parts[1];
    const actual = await this.hashPassword(salt + password);
    return actual === expected;
  },

  /**
   * Hash password with salt for storage.
   * Format: salt:hexHash
   * @param {string} password
   * @returns {Promise<string>}
   */
  async hashPasswordWithSalt(password) {
    const salt = crypto.randomUUID ? crypto.randomUUID().split('-')[0] : Math.random().toString(36).substr(2, 8);
    const hash = await this.hashPassword(salt + password);
    return salt + ':' + hash;
  },

  /**
   * Initialize auth state from localStorage.
   * @returns {Object|null} Saved user or null
   */
  init() {
    try {
      const saved = localStorage.getItem(AppConfig.STORAGE_KEYS.USER);
      if (saved) {
        this.currentUser = JSON.parse(saved);
        if (this.currentUser && this.currentUser.username) {
          API.updateLastSeen(this.currentUser.username, true);
        }
        return this.currentUser;
      }
    } catch (e) {
      this.clearSession();
    }
    return null;
  },

  /**
   * Login with existing username and password.
   * @param {string} username
   * @param {string} password
   * @returns {Promise<Object>}
   */
  async login(username, password) {
    const validation = Utils.validateUsername(username);
    if (!validation.valid) throw new Error(validation.error);

    const passwordValidation = Utils.validatePassword(password);
    if (!passwordValidation.valid) throw new Error(passwordValidation.error);

    const cleanUsername = validation.value;

    if (typeof API === 'undefined' || typeof getDB !== 'function') {
      throw new Error('Модуль API.js не загружен или поврежден!');
    }
    
    const db = getDB();
    const userRef = db.ref(`users/${cleanUsername}`);
    const snapshot = await userRef.get();

    if (!snapshot.exists()) {
      throw new Error('Пользователь с таким логином не найден');
    }

    const existingUser = snapshot.val();

    // Проверяем пароль
    if (!existingUser.passwordHash) {
      throw new Error('Неверный пароль');
    }

    const isValid = await this.verifyPassword(password, existingUser.passwordHash);
    if (!isValid) {
      throw new Error('Неверный пароль');
    }

    const userData = {
      username: cleanUsername,
      name: existingUser.name || cleanUsername,
      isOnline: true,
      lastSeen: new Date().toISOString()
    };

    await userRef.update({
      isOnline: true,
      lastSeen: userData.lastSeen
    });

    this.currentUser = userData;
    this.saveSession();
    return this.currentUser;
  },

  /**
   * Register a new user.
   * @param {string} username
   * @param {string} password
   * @param {string} name - Display name
   * @returns {Promise<Object>}
   */
  async register(username, password, name) {
    const validation = Utils.validateUsername(username);
    if (!validation.valid) throw new Error(validation.error);

    const passwordValidation = Utils.validatePassword(password);
    if (!passwordValidation.valid) throw new Error(passwordValidation.error);

    const nameValidation = Utils.validateDisplayName(name);
    if (!nameValidation.valid) throw new Error(nameValidation.error);

    const cleanUsername = validation.value;
    const cleanName = nameValidation.value;

    if (typeof API === 'undefined' || typeof getDB !== 'function') {
      throw new Error('Модуль API.js не загружен или поврежден!');
    }
    
    const db = getDB();
    const userRef = db.ref(`users/${cleanUsername}`);
    const snapshot = await userRef.get();

    if (snapshot.exists()) {
      throw new Error('Пользователь с таким логином уже существует');
    }

    const passwordHash = await this.hashPasswordWithSalt(password);

    const userData = {
      username: cleanUsername,
      name: cleanName,
      isOnline: true,
      lastSeen: new Date().toISOString()
    };

    await userRef.set({
      username: cleanUsername,
      passwordHash: passwordHash,
      name: cleanName,
      isOnline: true,
      lastSeen: userData.lastSeen
    });

    this.currentUser = userData;
    this.saveSession();
    return this.currentUser;
  },

  /**
   * Log out the current user.
   */
  logout() {
    if (this.currentUser && this.currentUser.username) {
      API.updateLastSeen(this.currentUser.username, false).catch(() => {});
    }
    this.currentUser = null;
    this.clearSession();
  },

  /**
   * Get the current logged-in user.
   * @returns {Object|null}
   */
  getUser() {
    return this.currentUser;
  },

  /**
   * Check if a user is logged in.
   * @returns {boolean}
   */
  isLoggedIn() {
    return this.currentUser !== null;
  },

  /**
   * Persist session to localStorage.
   */
  saveSession() {
    if (this.currentUser) {
      localStorage.setItem(AppConfig.STORAGE_KEYS.USER, JSON.stringify(this.currentUser));
    }
  },

  /**
   * Clear session from localStorage.
   */
  clearSession() {
    localStorage.removeItem(AppConfig.STORAGE_KEYS.USER);
  }
};