/**
 * GRUDA Legion SDK — Browser Client
 *
 * Connect any Grudge Studio app to ai.grudge-studio.com
 * Works standalone (fetch) or with Puter.js integration.
 *
 * @example
 *   const legion = new GrudaLegion({ apiKey: 'your-key' });
 *   const reply = await legion.chat('Hello!');
 *   console.log(reply.response);
 */

const LEGION_DEFAULT_URL = 'https://ai.grudge-studio.com';
const LEGION_WORKERS_URL = 'https://grudge-ai-hub.grudge.workers.dev';

class GrudaLegion {
  /**
   * @param {Object} config
   * @param {string} config.apiKey - Legion hub API key (Bearer token)
   * @param {string} [config.baseURL] - Override base URL
   * @param {number} [config.timeout=20000] - Request timeout in ms
   */
  constructor(config = {}) {
    if (!config.apiKey) throw new Error('GrudaLegion: apiKey is required');
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL || LEGION_DEFAULT_URL;
    this.timeout = config.timeout || 20000;
  }

  // ════════════════════════════════════════════════════════════
  //  Core API
  // ════════════════════════════════════════════════════════════

  /**
   * General chat — uses the 'general' agent role.
   * @param {string} message
   * @param {Object} [options]
   * @param {string} [options.model]
   * @param {number} [options.temperature]
   * @param {number} [options.max_tokens]
   * @returns {Promise<{response: string, provider: string, model: string, role: string, request_id: string}>}
   */
  async chat(message, options = {}) {
    return this._post('/v1/chat', { message, ...options });
  }

  /**
   * Chat with a specific agent role.
   * Roles: general, dev, balance, lore, art, mission, companion, faction
   * @param {string} role
   * @param {string} message
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  async agent(role, message, options = {}) {
    return this._post(`/v1/agents/${role}/chat`, { message, ...options });
  }

  /**
   * Multi-turn conversation with messages array.
   * @param {Array<{role: string, content: string}>} messages
   * @param {Object} [options]
   * @param {string} [options.agentRole='general'] - Agent role to use
   * @returns {Promise<Object>}
   */
  async conversation(messages, options = {}) {
    const role = options.agentRole || 'general';
    const endpoint = role === 'general' ? '/v1/chat' : `/v1/agents/${role}/chat`;
    return this._post(endpoint, { messages, ...options });
  }

  /**
   * Generate an image from a text prompt.
   * @param {string} prompt
   * @param {Object} [options]
   * @param {number} [options.num_steps=20]
   * @param {number} [options.guidance=7.5]
   * @returns {Promise<Blob>} PNG image blob
   */
  async generateImage(prompt, options = {}) {
    const resp = await this._fetch('/v1/image/generate', {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({ prompt, ...options }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }));
      throw new Error(err.error || `Image generation failed: ${resp.status}`);
    }
    return resp.blob();
  }

  /**
   * Generate text embeddings.
   * @param {string|string[]} text - Single string or array of strings
   * @returns {Promise<{embeddings: number[][], model: string, count: number}>}
   */
  async embed(text) {
    const body = Array.isArray(text) ? { texts: text } : { text };
    return this._post('/v1/embed', body);
  }

  // ════════════════════════════════════════════════════════════
  //  Info / Health
  // ════════════════════════════════════════════════════════════

  /** List all available agent roles. */
  async listAgents() {
    return this._get('/v1/agents');
  }

  /** Health check. */
  async health() {
    return this._get('/health');
  }

  // ════════════════════════════════════════════════════════════
  //  Admin (requires admin-scoped API key)
  // ════════════════════════════════════════════════════════════

  /** Get usage analytics. */
  async usage(hours = 24, role = null) {
    const params = new URLSearchParams({ hours });
    if (role) params.set('role', role);
    return this._get(`/v1/admin/usage?${params}`);
  }

  /** Get provider health diagnostics. */
  async adminHealth() {
    return this._get('/v1/admin/health');
  }

  /** Get all agent role configurations. */
  async getConfig() {
    return this._get('/v1/admin/config');
  }

  /** Update an agent role's configuration. */
  async updateConfig(role, updates) {
    return this._put(`/v1/admin/config/${role}`, updates);
  }

  // ════════════════════════════════════════════════════════════
  //  Shortcut agent methods
  // ════════════════════════════════════════════════════════════

  /** Code review and generation. */
  async dev(message, opts) { return this.agent('dev', message, opts); }
  /** Game balance analysis. */
  async balance(message, opts) { return this.agent('balance', message, opts); }
  /** Lore, quest text, NPC dialogue. */
  async lore(message, opts) { return this.agent('lore', message, opts); }
  /** 3D art prompts for Meshy/text2vox. */
  async art(message, opts) { return this.agent('art', message, opts); }
  /** Dynamic mission generation. */
  async mission(message, opts) { return this.agent('mission', message, opts); }
  /** Gouldstone companion dialogue. */
  async companion(message, opts) { return this.agent('companion', message, opts); }
  /** Faction intel and recommendations. */
  async faction(message, opts) { return this.agent('faction', message, opts); }

  // ════════════════════════════════════════════════════════════
  //  Internal
  // ════════════════════════════════════════════════════════════

  _headers() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };
  }

  async _fetch(path, init) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      return await fetch(`${this.baseURL}${path}`, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  async _post(path, body) {
    const resp = await this._fetch(path, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || `Legion API error: ${resp.status}`);
    return data;
  }

  async _get(path) {
    const resp = await this._fetch(path, { headers: this._headers() });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || `Legion API error: ${resp.status}`);
    return data;
  }

  async _put(path, body) {
    const resp = await this._fetch(path, {
      method: 'PUT',
      headers: this._headers(),
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || `Legion API error: ${resp.status}`);
    return data;
  }
}

// UMD export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GrudaLegion };
} else if (typeof window !== 'undefined') {
  window.GrudaLegion = GrudaLegion;
}
