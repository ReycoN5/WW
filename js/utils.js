/**
 * Utility functions for sanitization, formatting, and caching.
 */

const Utils = {
  /**
   * Escape HTML entities to prevent XSS attacks.
   * @param {string} str
   * @returns {string}
   */
  escapeHtml(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  },

  /**
   * Sanitize user input by trimming and removing control characters.
   * @param {string} str
   * @returns {string}
   */
  sanitizeInput(str) {
    if (str == null) return '';
    return String(str)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .trim();
  },

  /**
   * Validate username format.
   * @param {string} username
   * @returns {{ valid: boolean, error?: string }}
   */
  validateUsername(username) {
    const value = this.sanitizeInput(username);

    if (!value) {
      return { valid: false, error: 'Username is required' };
    }
    if (value.length > AppConfig.MAX_USERNAME_LENGTH) {
      return { valid: false, error: `Username must be ${AppConfig.MAX_USERNAME_LENGTH} characters or less` };
    }
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(value)) {
      return { valid: false, error: 'Username can only contain letters, numbers, underscores, hyphens, and dots' };
    }
    return { valid: true, value };
  },

  /**
   * Validate password format.
   * @param {string} password
   * @returns {{ valid: boolean, error?: string, value?: string }}
   */
  validatePassword(password) {
    if (password == null || String(password).length === 0) {
      return { valid: false, error: 'Password is required' };
    }
    if (password.length < AppConfig.MIN_PASSWORD_LENGTH) {
      return { valid: false, error: `Password must be at least ${AppConfig.MIN_PASSWORD_LENGTH} characters` };
    }
    if (password.length > AppConfig.MAX_PASSWORD_LENGTH) {
      return { valid: false, error: `Password must be ${AppConfig.MAX_PASSWORD_LENGTH} characters or less` };
    }
    return { valid: true, value: password };
  },

  /**
   * Validate display name (shown in chats).
   * This is purely for UI; backend also validates and stores a display name.
   * @param {string} name
   * @returns {{ valid: boolean, error?: string, value?: string }}
   */
  validateDisplayName(name) {
    const value = this.sanitizeInput(name);
    if (!value) {
      return { valid: false, error: 'Name is required' };
    }
    if (value.length < 2) {
      return { valid: false, error: 'Name must be at least 2 characters' };
    }
    if (value.length > 50) {
      return { valid: false, error: 'Name must be 50 characters or less' };
    }
    return { valid: true, value };
  },

  /**
   * Validate message content.
   * @param {string} message
   * @returns {{ valid: boolean, error?: string }}
   */
  validateMessage(message) {
    const value = this.sanitizeInput(message);

    if (!value) {
      return { valid: false, error: 'Сообщение не может быть пустым' };
    }
    if (value.length > AppConfig.MAX_MESSAGE_LENGTH) {
      return { valid: false, error: `Message must be ${AppConfig.MAX_MESSAGE_LENGTH} characters or less` };
    }
    return { valid: true, value };
  },

  /**
   * Generate avatar initials from a username.
   * @param {string} username
   * @returns {string}
   */
  getInitials(username) {
    if (!username) return '?';
    const parts = username.trim().split(/[\s_\-\.]+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return username.substring(0, 2).toUpperCase();
  },

    /**
   * Generate a consistent color from a username string.
   * @param {string} username
   * @returns {string} HSL color string
   */
    getAvatarColor(username) {
      if (!username || typeof username !== 'string') {
        return 'hsl(210, 60%, 50%)'; // fallback цвет
      }
  
      let hash = 0;
      for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
      }
      const hue = Math.abs(hash) % 360;
      return `hsl(${hue}, 55%, 45%)`;
    },

  /**
   * Format a timestamp for display.
   * @param {string|Date} timestamp
   * @returns {string}
   */
  formatTimestamp(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';

    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isToday) return time;
    if (isYesterday) return `Вчера ${time}`;

    const daysDiff = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    if (daysDiff < 7) {
      return `${date.toLocaleDateString([], { weekday: 'short' })} ${time}`;
    }

    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
  },

  /**
   * Format date for message group separators.
   * @param {string|Date} timestamp
   * @returns {string}
   */
  formatDateSeparator(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();

    if (date.toDateString() === now.toDateString()) return 'Сегодня';
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Вчера';

    return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  },

  /**
   * Check if two timestamps are on different days.
   */
  isDifferentDay(ts1, ts2) {
    if (!ts1 || !ts2) return true;
    return new Date(ts1).toDateString() !== new Date(ts2).toDateString();
  },

  /**
   * Russian pluralization helper.
   * @param {number} n
   * @param {string[]} forms - [one, few, many] e.g. ['минуту', 'минуты', 'минут']
   * @returns {string}
   */
  pluralizeRu(n, forms) {
    const abs = Math.abs(n) % 100;
    const lastDigit = abs % 10;
    if (abs >= 11 && abs <= 14) return forms[2];
    if (lastDigit === 1) return forms[0];
    if (lastDigit >= 2 && lastDigit <= 4) return forms[1];
    return forms[2];
  },

  /**
   * Format "last seen" time relative to now (Russian locale).
   * @param {string|Date} timestamp
   * @returns {string}
   */
  formatLastSeen(timestamp) {
    if (!timestamp) return 'Был(а) недавно';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';

    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    // Только что (до 60 секунд)
    if (diffSec < 60) return 'Был(а) только что';

    // Минуты (1-59)
    if (diffMin < 60) {
      const word = this.pluralizeRu(diffMin, ['минуту', 'минуты', 'минут']);
      return `Был(а) ${diffMin} ${word} назад`;
    }

    // Часы (1-23)
    if (diffHour < 24) {
      const word = this.pluralizeRu(diffHour, ['час', 'часа', 'часов']);
      return `Был(а) ${diffHour} ${word} назад`;
    }

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Вчера
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return `Был(а) вчера в ${timeStr}`;
    }

    // 2-6 дней назад
    if (diffDay < 7) {
      const dayName = date.toLocaleDateString([], { weekday: 'long' });
      return `Был(а) в ${dayName} в ${timeStr}`;
    }

    // Более 7 дней
    const dateStr = date.toLocaleDateString([], { day: 'numeric', month: 'long' });
    return `Был(а) ${dateStr} в ${timeStr}`;
  },

  /**
   * Debounce a function call.
   * @param {Function} fn
   * @param {number} delay
   * @returns {Function}
   */
  debounce(fn, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  /**
   * Save chat messages to localStorage cache.
   * @param {string} chatKey - e.g. "user1_user2"
   * @param {Array} messages
   */
  cacheMessages(chatKey, messages) {
    try {
      const cache = JSON.parse(localStorage.getItem(AppConfig.STORAGE_KEYS.CHAT_CACHE) || '{}');
      cache[chatKey] = { messages, cachedAt: Date.now() };
      localStorage.setItem(AppConfig.STORAGE_KEYS.CHAT_CACHE, JSON.stringify(cache));
    } catch (e) {
      // localStorage full or unavailable — silently ignore
    }
  },

  /**
   * Load cached messages for a chat.
   * @param {string} chatKey
   * @returns {Array|null}
   */
  getCachedMessages(chatKey) {
    try {
      const cache = JSON.parse(localStorage.getItem(AppConfig.STORAGE_KEYS.CHAT_CACHE) || '{}');
      const entry = cache[chatKey];
      if (entry && entry.messages) {
        return entry.messages;
      }
    } catch (e) {
      // ignore
    }
    return null;
  },

  /**
   * Generate a consistent cache key for a chat between two users.
   */
  getChatKey(user1, user2) {
    return [user1, user2].sort().join('::');
  }
};
