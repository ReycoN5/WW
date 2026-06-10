/**
 * Supabase Storage module for file upload/download.
 * Uses Supabase JS SDK for file operations.
 */

const Storage = {
  client: null,

  /**
   * Initialize Supabase client.
   */
  init() {
    if (this.client) return this.client;
    this.client = supabase.createClient(
      AppConfig.SUPABASE_URL,
      AppConfig.SUPABASE_ANON_KEY
    );
    return this.client;
  },

  /**
   * Generate a unique file name with UUID prefix.
   * @param {File} file
   * @returns {string}
   */
  _generateFileName(file) {
    const uuid = crypto.randomUUID();
    const ext = file.name.split('.').pop();
    // Sanitize: only ASCII letters, digits, underscores, hyphens, dots
    const baseName = file.name.replace(/\.[^.]+$/, ''); // remove extension
    const safeName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 64);
    const safeExt = ext ? ext.replace(/[^a-zA-Z0-9]/g, '') : 'file';
    return `${uuid}_${safeName}.${safeExt}`;
  },

  /**
   * Validate file type against allowed list.
   * @param {File} file
   * @returns {boolean}
   */
  validateFile(file) {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/zip',
      'application/x-zip-compressed'
    ];
    return allowedTypes.includes(file.type);
  },

  /**
   * Get a human-readable file type category.
   * @param {string} mimeType
   * @returns {string}
   */
  getFileCategory(mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.includes('word') || mimeType === 'application/msword') return 'doc';
    if (mimeType === 'text/plain') return 'text';
    if (mimeType.includes('zip') || mimeType.includes('compress')) return 'archive';
    return 'other';
  },

  /**
   * Format file size for display.
   * @param {number} bytes
   * @returns {string}
   */
  formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  },

  /**
   * Upload a file to Supabase Storage.
   * @param {File} file
   * @returns {Promise<{url: string, name: string, size: number, type: string, category: string}>}
   */
  async uploadFile(file) {
    this.init();

    // Validate file type
    if (!this.validateFile(file)) {
      throw new Error('Недопустимый тип файла. Разрешены: jpg, png, gif, webp, pdf, doc, docx, txt, zip');
    }

    // Validate file size
    if (file.size > AppConfig.MAX_FILE_SIZE) {
      throw new Error(`Файл слишком большой. Максимальный размер: ${this.formatFileSize(AppConfig.MAX_FILE_SIZE)}`);
    }

    const fileName = this._generateFileName(file);

    console.log('Uploading file:', fileName, 'size:', file.size, 'type:', file.type);

    const { data, error } = await this.client.storage
      .from(AppConfig.SUPABASE_BUCKET)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    console.log('Upload result:', data, error);

    if (error) {
      throw new Error('Ошибка загрузки: ' + error.message + ' (HTTP ' + (error.statusCode || 'unknown') + ')');
    }

    // Пробуем getPublicUrl из SDK
    const { data: urlData } = this.client.storage
      .from(AppConfig.SUPABASE_BUCKET)
      .getPublicUrl(fileName);

    console.log('SDK publicUrl:', urlData?.publicUrl);

    // Формируем вручную для гарантии
    const publicUrl = AppConfig.SUPABASE_URL + '/storage/v1/object/public/' + AppConfig.SUPABASE_BUCKET + '/' + fileName;

    console.log('Manual publicUrl:', publicUrl);

    return {
      url: publicUrl,
      name: file.name,
      size: file.size,
      type: file.type,
      category: this.getFileCategory(file.type)
    };
  },

  /**
   * Upload multiple files in parallel.
   * @param {File[]} files
   * @param {function} [onProgress] - callback(index, total) after each file upload
   * @returns {Promise<Array<{url: string, name: string, size: number, type: string, category: string}>>}
   */
  async uploadFiles(files, onProgress) {
    const results = [];
    for (let i = 0; i < files.length; i++) {
      const fileData = await this.uploadFile(files[i]);
      results.push(fileData);
      if (onProgress) onProgress(i + 1, files.length);
    }
    return results;
  },

  /**
   * Get SVG icon for a file type category.
   * @param {string} category
   * @returns {string} SVG markup
   */
  getFileIconSVG(category) {
    // Document icon
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
                stroke-linecap="round" stroke-linejoin="round" width="32" height="32">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>`;
  }
};
