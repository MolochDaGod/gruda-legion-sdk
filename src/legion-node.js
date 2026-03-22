/**
 * GRUDA Legion SDK — Node.js Client
 *
 * Server-side client for Express apps, backend services, and scripts.
 * Drop-in replacement for the browser GrudaLegion class.
 *
 * @example
 *   const { GrudaLegionNode } = require('gruda-legion-sdk');
 *   const legion = new GrudaLegionNode({ apiKey: process.env.LEGION_HUB_API_KEY });
 *   const reply = await legion.chat('Review this code for bugs');
 */

class GrudaLegionNode {
  constructor(config = {}) {
    if (!config.apiKey) throw new Error('GrudaLegionNode: apiKey is required');
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL || 'https://ai.grudge-studio.com';
    this.timeout = config.timeout || 20000;
  }

  // ── Core API ──────────────────────────────────────────────

  async chat(message, options = {}) {
    return this._post('/v1/chat', { message, ...options });
  }

  async agent(role, message, options = {}) {
    return this._post(`/v1/agents/${role}/chat`, { message, ...options });
  }

  async conversation(messages, options = {}) {
    const role = options.agentRole || 'general';
    const endpoint = role === 'general' ? '/v1/chat' : `/v1/agents/${role}/chat`;
    return this._post(endpoint, { messages, ...options });
  }

  async generateImage(prompt, options = {}) {
    const resp = await this._rawFetch('/v1/image/generate', {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({ prompt, ...options }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Image generation failed: ${resp.status} — ${text}`);
    }
    return Buffer.from(await resp.arrayBuffer());
  }

  async embed(text) {
    const body = Array.isArray(text) ? { texts: text } : { text };
    return this._post('/v1/embed', body);
  }

  // ── Info ───────────────────────────────────────────────────

  async listAgents() { return this._get('/v1/agents'); }
  async health() { return this._get('/health'); }

  // ── Admin ─────────────────────────────────────────────────

  async usage(hours = 24, role = null) {
    const params = new URLSearchParams({ hours: String(hours) });
    if (role) params.set('role', role);
    return this._get(`/v1/admin/usage?${params}`);
  }

  async adminHealth() { return this._get('/v1/admin/health'); }
  async getConfig() { return this._get('/v1/admin/config'); }
  async updateConfig(role, updates) { return this._put(`/v1/admin/config/${role}`, updates); }

  // ── Shortcuts ─────────────────────────────────────────────

  async dev(msg, opts) { return this.agent('dev', msg, opts); }
  async balance(msg, opts) { return this.agent('balance', msg, opts); }
  async lore(msg, opts) { return this.agent('lore', msg, opts); }
  async art(msg, opts) { return this.agent('art', msg, opts); }
  async mission(msg, opts) { return this.agent('mission', msg, opts); }
  async companion(msg, opts) { return this.agent('companion', msg, opts); }
  async faction(msg, opts) { return this.agent('faction', msg, opts); }

  // ── Internal ──────────────────────────────────────────────

  _headers() {
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` };
  }

  async _rawFetch(path, init) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      return await fetch(`${this.baseURL}${path}`, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  async _post(path, body) {
    const resp = await this._rawFetch(path, { method: 'POST', headers: this._headers(), body: JSON.stringify(body) });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || `Legion API error: ${resp.status}`);
    return data;
  }

  async _get(path) {
    const resp = await this._rawFetch(path, { headers: this._headers() });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || `Legion API error: ${resp.status}`);
    return data;
  }

  async _put(path, body) {
    const resp = await this._rawFetch(path, { method: 'PUT', headers: this._headers(), body: JSON.stringify(body) });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || `Legion API error: ${resp.status}`);
    return data;
  }
}

module.exports = { GrudaLegionNode };
