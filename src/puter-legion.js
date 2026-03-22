/**
 * GRUDA Legion + Puter.js Integration
 *
 * Combines the Legion AI hub (ai.grudge-studio.com) with Puter.js services:
 *   - Puter KV for response caching and player data
 *   - Puter FS for asset storage and retrieval
 *   - Puter AI as fallback when Legion hub is unavailable (User Pays Model)
 *   - Puter Auth for user identity
 *
 * Requires: <script src="https://js.puter.com/v2/"></script>
 *           <script src="gruda-legion-sdk/src/legion.js"></script>
 *
 * @example
 *   const ai = new PuterLegion({ apiKey: 'your-key' });
 *   const reply = await ai.chat('Generate a quest for my warrior');
 */

class PuterLegion {
  /**
   * @param {Object} config
   * @param {string} config.apiKey - Legion hub API key
   * @param {string} [config.baseURL] - Override Legion base URL
   * @param {boolean} [config.enableCache=true] - Cache responses in Puter KV
   * @param {number} [config.cacheTTL=300] - Cache TTL in seconds (default 5 min)
   * @param {boolean} [config.puterFallback=true] - Fall back to Puter AI if Legion fails
   * @param {string} [config.puterModel='claude'] - Puter AI model for fallback
   */
  constructor(config = {}) {
    this.config = {
      enableCache: true,
      cacheTTL: 300,
      puterFallback: true,
      puterModel: 'claude',
      ...config,
    };

    // Core Legion client
    this.legion = new GrudaLegion({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });

    // Verify Puter.js is available
    this._hasPuter = typeof puter !== 'undefined';
    if (!this._hasPuter) {
      console.warn('[PuterLegion] puter.js not loaded — KV cache and Puter AI fallback disabled');
    }
  }

  // ════════════════════════════════════════════════════════════
  //  AI Chat (Legion primary → Puter AI fallback)
  // ════════════════════════════════════════════════════════════

  /**
   * Chat with automatic Legion → Puter fallback.
   * @param {string} message
   * @param {Object} [options]
   * @param {string} [options.role] - Agent role (dev, lore, art, etc.)
   * @param {boolean} [options.cache] - Override cache setting for this call
   * @returns {Promise<{response: string, provider: string, source: 'legion'|'puter-fallback'|'cache'}>}
   */
  async chat(message, options = {}) {
    const role = options.role || 'general';
    const useCache = options.cache ?? this.config.enableCache;

    // Check cache first
    if (useCache && this._hasPuter) {
      const cached = await this._getCached(role, message);
      if (cached) return { response: cached, provider: 'cache', source: 'cache' };
    }

    // Try Legion hub
    try {
      const result = role === 'general'
        ? await this.legion.chat(message, options)
        : await this.legion.agent(role, message, options);

      // Cache the response
      if (useCache && this._hasPuter) {
        this._setCache(role, message, result.response).catch(() => {});
      }

      return { ...result, source: 'legion' };
    } catch (legionErr) {
      console.warn(`[PuterLegion] Legion failed: ${legionErr.message}`);

      // Fallback to Puter AI (User Pays Model — user covers cost)
      if (this.config.puterFallback && this._hasPuter) {
        try {
          const puterResult = await puter.ai.chat(message, {
            model: this.config.puterModel,
          });
          const response = puterResult?.message?.content || String(puterResult);

          if (useCache) {
            this._setCache(role, message, response).catch(() => {});
          }

          return { response, provider: `puter-${this.config.puterModel}`, source: 'puter-fallback' };
        } catch (puterErr) {
          throw new Error(`All AI providers failed. Legion: ${legionErr.message}. Puter: ${puterErr.message}`);
        }
      }

      throw legionErr;
    }
  }

  // ════════════════════════════════════════════════════════════
  //  Shortcut agent methods
  // ════════════════════════════════════════════════════════════

  async dev(msg, opts) { return this.chat(msg, { ...opts, role: 'dev' }); }
  async balance(msg, opts) { return this.chat(msg, { ...opts, role: 'balance' }); }
  async lore(msg, opts) { return this.chat(msg, { ...opts, role: 'lore' }); }
  async art(msg, opts) { return this.chat(msg, { ...opts, role: 'art' }); }
  async mission(msg, opts) { return this.chat(msg, { ...opts, role: 'mission' }); }
  async companion(msg, opts) { return this.chat(msg, { ...opts, role: 'companion' }); }
  async faction(msg, opts) { return this.chat(msg, { ...opts, role: 'faction' }); }

  // ════════════════════════════════════════════════════════════
  //  Image Generation (Legion primary → Puter txt2img fallback)
  // ════════════════════════════════════════════════════════════

  /**
   * Generate an image. Legion SDXL primary, Puter txt2img fallback.
   * @param {string} prompt
   * @returns {Promise<{blob: Blob, url: string, source: 'legion'|'puter-fallback'}>}
   */
  async generateImage(prompt) {
    try {
      const blob = await this.legion.generateImage(prompt);
      const url = URL.createObjectURL(blob);
      return { blob, url, source: 'legion' };
    } catch (err) {
      if (this.config.puterFallback && this._hasPuter) {
        const img = await puter.ai.txt2img(prompt);
        return { blob: null, element: img, url: img?.src || null, source: 'puter-fallback' };
      }
      throw err;
    }
  }

  // ════════════════════════════════════════════════════════════
  //  Puter KV — Player Data Persistence
  // ════════════════════════════════════════════════════════════

  /**
   * Save player/game data to Puter KV.
   * @param {string} key
   * @param {any} value
   */
  async saveData(key, value) {
    if (!this._hasPuter) throw new Error('Puter.js not available');
    return puter.kv.set(`grudge_${key}`, typeof value === 'string' ? value : JSON.stringify(value));
  }

  /**
   * Load player/game data from Puter KV.
   * @param {string} key
   * @returns {Promise<any>}
   */
  async loadData(key) {
    if (!this._hasPuter) throw new Error('Puter.js not available');
    const raw = await puter.kv.get(`grudge_${key}`);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return raw; }
  }

  /**
   * Delete player/game data.
   * @param {string} key
   */
  async deleteData(key) {
    if (!this._hasPuter) throw new Error('Puter.js not available');
    return puter.kv.del(`grudge_${key}`);
  }

  /**
   * List all Grudge data keys.
   * @returns {Promise<string[]>}
   */
  async listData() {
    if (!this._hasPuter) throw new Error('Puter.js not available');
    return puter.kv.list('grudge_*');
  }

  // ════════════════════════════════════════════════════════════
  //  Puter FS — Asset Storage
  // ════════════════════════════════════════════════════════════

  /**
   * Save a generated asset (image, model data, etc.) to Puter cloud storage.
   * @param {string} filename
   * @param {Blob|string} data
   * @returns {Promise<Object>} File object with path
   */
  async saveAsset(filename, data) {
    if (!this._hasPuter) throw new Error('Puter.js not available');
    return puter.fs.write(`GRUDA/assets/${filename}`, data, { createMissingParents: true });
  }

  /**
   * Read an asset from Puter cloud storage.
   * @param {string} filename
   * @returns {Promise<Blob>}
   */
  async loadAsset(filename) {
    if (!this._hasPuter) throw new Error('Puter.js not available');
    return puter.fs.read(`GRUDA/assets/${filename}`);
  }

  // ════════════════════════════════════════════════════════════
  //  Puter Auth — User Identity
  // ════════════════════════════════════════════════════════════

  /** Check if user is signed in to Puter. */
  isSignedIn() {
    return this._hasPuter && puter.auth.isSignedIn();
  }

  /** Sign in with Puter. */
  async signIn() {
    if (!this._hasPuter) throw new Error('Puter.js not available');
    return puter.auth.signIn();
  }

  /** Get Puter user info. */
  async getUser() {
    if (!this._hasPuter) throw new Error('Puter.js not available');
    return puter.auth.getUser();
  }

  // ════════════════════════════════════════════════════════════
  //  Pass-through to core Legion client
  // ════════════════════════════════════════════════════════════

  async embed(text) { return this.legion.embed(text); }
  async listAgents() { return this.legion.listAgents(); }
  async health() { return this.legion.health(); }
  async usage(...a) { return this.legion.usage(...a); }
  async adminHealth() { return this.legion.adminHealth(); }
  async getConfig() { return this.legion.getConfig(); }
  async updateConfig(...a) { return this.legion.updateConfig(...a); }

  // ════════════════════════════════════════════════════════════
  //  Internal KV Cache
  // ════════════════════════════════════════════════════════════

  _cacheKey(role, message) {
    // Simple hash for cache key
    const hash = message.split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
    return `grudge_cache_${role}_${Math.abs(hash)}`;
  }

  async _getCached(role, message) {
    try {
      const key = this._cacheKey(role, message);
      const raw = await puter.kv.get(key);
      if (!raw) return null;
      const { response, ts } = JSON.parse(raw);
      if (Date.now() - ts > this.config.cacheTTL * 1000) {
        puter.kv.del(key).catch(() => {}); // Expired — clean up
        return null;
      }
      return response;
    } catch { return null; }
  }

  async _setCache(role, message, response) {
    const key = this._cacheKey(role, message);
    return puter.kv.set(key, JSON.stringify({ response, ts: Date.now() }));
  }
}

// UMD export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PuterLegion };
} else if (typeof window !== 'undefined') {
  window.PuterLegion = PuterLegion;
}
