/**
 * Firebase Realtime Database API Module.
 */

// Функция безопасного получения инстанса базы данных с защитой от задержки загрузки скриптов
const getDB = () => {
  const fbInstance = typeof firebase !== 'undefined' ? firebase : window.firebase;

  if (!fbInstance) {
    throw new Error("Библиотека Firebase SDK не найдена на странице! Проверьте порядок тегов <script> в index.html или очистите кэш.");
  }
  
  if (fbInstance.apps.length === 0) {
    if (typeof AppConfig === 'undefined' || !AppConfig.firebaseConfig) {
      throw new Error("Конфигурация firebaseConfig не найдена в объекте AppConfig! Проверьте файл config.js.");
    }
    fbInstance.initializeApp(AppConfig.firebaseConfig);
  }
  
  return fbInstance.database();
};

/**
 * Generate a consistent chat key for two users.
 * @param {string} user1
 * @param {string} user2
 * @returns {string}
 */
function getChatKey(user1, user2) {
  return [user1, user2].sort().join('::');
}

const API = {
  /**
   * Регистрация или обновление пользователя (Online статус и имя).
   */
  async loginOrUpdateUser(username, displayName) {
    try {
      const db = getDB();
      const userRef = db.ref(`users/${username}`);
      const snapshot = await userRef.get();
      
      let userData = {
        username: username,
        name: displayName || username,
        isOnline: true,
        lastSeen: new Date().toISOString()
      };

      if (snapshot.exists()) {
        await userRef.update({
          isOnline: true,
          lastSeen: userData.lastSeen
        });
        return { success: true, user: { ...snapshot.val(), isOnline: true } };
      } else {
        await userRef.set(userData);
        return { success: true, user: userData };
      }
    } catch (error) {
      throw new Error('Ошибка авторизации в Firebase: ' + error.message);
    }
  },

  /**
   * Получение списка всех пользователей.
   */
  async getUsers(excludeUsername) {
    try {
      const db = getDB();
      const snapshot = await db.ref('users').get();
      const usersData = snapshot.val() || {};
      
      const usersList = Object.entries(usersData)
        .map(([key, value]) => ({
          username: key,
          ...value
        }))
        .filter(u => u.username !== excludeUsername);
        
      return { success: true, users: usersList };
    } catch (error) {
      throw new Error('Не удалось загрузить пользователей: ' + error.message);
    }
  },

  /**
   * Отправка сообщения в чат-комнату.
   * @param {string} sender
   * @param {string} receiver
   * @param {string} message
   * @param {string} clientId
   * @param {object|null} fileData
   * @param {object[]|null} filesData
   * @param {object|null} replyTo - { id, sender, message, senderName? }
   */
  async sendMessage(sender, receiver, message, clientId, fileData = null, filesData = null, replyTo = null) {
    const db = getDB();
    const chatId = getChatKey(sender, receiver);
    const ref = db.ref(`chats/${chatId}/messages`).push();
  
    const messageData = {
      id: ref.key,
      clientId,
      sender,
      receiver,
      message,
      timestamp: Date.now(),
      read: false
    };

    // Вложения
    if (filesData && Array.isArray(filesData) && filesData.length > 0) {
      messageData.files = filesData;
      if (filesData.length === 1) {
        messageData.file = filesData[0];
      }
    } else if (fileData) {
      messageData.file = fileData;
    }

    // Ответ на сообщение
    if (replyTo) {
      messageData.replyTo = {
        id: replyTo.id,
        sender: replyTo.sender,
        message: (replyTo.message || '').substring(0, 200),
        senderName: replyTo.senderName || replyTo.sender
      };
      // Если в replyTo есть файл — сохраняем превью
      if (replyTo.file) {
        messageData.replyTo.file = replyTo.file;
      }
      if (replyTo.files && replyTo.files.length > 0) {
        messageData.replyTo.files = replyTo.files;
      }
    }
  
    await ref.set(messageData);
    return { success: true, id: ref.key };
  },

  /**
   * Удаление сообщения (замена содержимого на "[deleted]").
   * @param {string} user1
   * @param {string} user2
   * @param {string} messageId
   * @returns {Promise<{success: boolean}>}
   */
  async deleteMessage(user1, user2, messageId) {
    const db = getDB();
    const chatId = getChatKey(user1, user2);
    const msgRef = db.ref(`chats/${chatId}/messages/${messageId}`);
    
    // Удаляем содержимое, но оставляем запись
    await msgRef.update({
      message: '',
      deleted: true,
      file: null,
      files: null
    });
    return { success: true };
  },

  /**
   * Пересылка сообщения другому пользователю.
   * @param {string} sender
   * @param {string} receiver
   * @param {object} originalMsg
   * @param {string} clientId
   * @returns {Promise<{success: boolean, id: string}>}
   */
  async forwardMessage(sender, receiver, originalMsg, clientId) {
    const db = getDB();
    const chatId = getChatKey(sender, receiver);
    const ref = db.ref(`chats/${chatId}/messages`).push();

    // Копируем структуру, помечая как пересланное
    const forwarded = {
      id: ref.key,
      clientId,
      sender,
      receiver,
      message: originalMsg.message || '',
      timestamp: Date.now(),
      read: false,
      forwarded: true,
      forwardedFrom: originalMsg.sender
    };

    // Копируем вложения если есть
    if (originalMsg.file) {
      forwarded.file = originalMsg.file;
    }
    if (originalMsg.files && Array.isArray(originalMsg.files)) {
      forwarded.files = originalMsg.files;
    }

    await ref.set(forwarded);
    return { success: true, id: ref.key };
  },

  /**
   * Подписка на сообщения в реальном времени.
   */
  listenToMessages(sender, receiver, callback) {
    const db = getDB();
    const chatId = getChatKey(sender, receiver);
    const messagesRef = db.ref(`chats/${chatId}/messages`);

    messagesRef.on('value', snapshot => {
      const data = snapshot.val() || {};
      const messagesList = Object.entries(data).map(
        ([key, value]) => ({ id: key, ...value })
      );
      messagesList.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      callback(messagesList);
    });

    return messagesRef;
  },

  /**
   * Отписка от прослушивания конкретного чата.
   */
  stopListeningToMessages(messagesRef) {
    if (messagesRef && typeof messagesRef.off === 'function') {
      messagesRef.off('value');
    }
  },

  /**
   * Отметить сообщения в комнате как прочитанные.
   */
  async markMessagesRead(currentUser, partnerUser) {
    try {
      const db = getDB();
      const chatId = getChatKey(currentUser, partnerUser);
      const messagesRef = db.ref(`chats/${chatId}/messages`);
      const snapshot = await messagesRef.get();
      const data = snapshot.val();

      if (data) {
        const updates = {};
        Object.keys(data).forEach(key => {
          if (data[key].sender === partnerUser && !data[key].read) {
            updates[`${key}/read`] = true;
          }
        });
        if (Object.keys(updates).length > 0) {
          await messagesRef.update(updates);
        }
      }
    } catch (error) {
      console.warn('Не удалось обновить статус прочтения:', error);
    }
  },

  /**
   * Установка статуса "печатает...".
   */
  async setTyping(currentUser, partnerUser, isTyping) {
    const db = getDB();
    const chatId = getChatKey(currentUser, partnerUser);
    await db.ref(`typing/${chatId}/${currentUser}`).set(isTyping);
  },

  /**
   * Подписка на статус "печатает..." партнера.
   */
  listenToTyping(currentUser, partnerUser, callback) {
    const db = getDB();
    const chatId = getChatKey(currentUser, partnerUser);
    const typingRef = db.ref(`typing/${chatId}/${partnerUser}`);
    
    typingRef.on('value', (snapshot) => {
      callback(!!snapshot.val());
    });
    return typingRef;
  },

  /**
   * Обновление статуса последней активности (Heartbeat).
   */
  async updateLastSeen(username, isOnline = true) {
    try {
      const db = getDB();
      await db.ref(`users/${username}`).update({
        isOnline: isOnline,
        lastSeen: new Date().toISOString()
      });
    } catch (e) {
      // silent fail
    }
  }
};