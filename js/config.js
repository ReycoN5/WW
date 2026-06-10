/**
 * Application configuration.
 */
const AppConfig = {
  // URL Google скрипта (загружается из localStorage, либо задаётся через config-modal)
  API_URL: '',

  // Настройки интервалов и лимитов
  POLL_INTERVAL: 2000,
  HEARTBEAT_INTERVAL: 15000,
  TYPING_DEBOUNCE: 1000,
  TYPING_TIMEOUT: 5000,

  // Порог онлайна
  ONLINE_THRESHOLD_MS: 30 * 1000,

  // Ключи LocalStorage
  STORAGE_KEYS: {
    USER: 'sheetchat_user',
    THEME: 'sheetchat_theme',
    API_URL: 'sheetchat_api_url',
    CHAT_CACHE: 'sheetchat_chat_cache'
  },

  // Supabase Storage
  SUPABASE_URL: 'https://kfojkafbbohkpaymlnsb.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_R0HqYYl1ZrCec4q6ZEfYNw_dBPMCodJ',
  SUPABASE_BUCKET: 'ww',

  // Максимальный размер файла для загрузки (в байтах)
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10 MB

  // Лимиты валидации
  MAX_MESSAGE_LENGTH: 5000,
  MAX_USERNAME_LENGTH: 30,
  MIN_PASSWORD_LENGTH: 6,
  MAX_PASSWORD_LENGTH: 128,

  // ВАШЕ ПОДКЛЮЧЕНИЕ К FIREBASE REALTIME DATABASE
  firebaseConfig: {
    apiKey: "AIzaSyCmOeb74dgqBlSSOe5cR3fxuTu_q-FU0a8",
    authDomain: "wwchat-17d6f.firebaseapp.com",
    databaseURL: "https://wwchat-17d6f-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "wwchat-17d6f",
    storageBucket: "wwchat-17d6f.firebasestorage.app",
    messagingSenderId: "293328525637",
    appId: "1:293328525637:web:17a45f048d1a690478062c",
    measurementId: "G-V1YZHHVM6G"
  }
};

// Подгрузка сохраненного URL из локального хранилища
(function loadSavedConfig() {
  const savedUrl = localStorage.getItem(AppConfig.STORAGE_KEYS.API_URL);
  if (savedUrl) {
    AppConfig.API_URL = savedUrl;
  }
})();