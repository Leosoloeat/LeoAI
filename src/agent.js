'use strict';

const EventEmitter = require('eventemitter3');
const logger       = require('./logger');

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const TIMEOUT_MS      = 30_000;

/**
 * OpenRouter Agent (fetch-based, CommonJS-safe)
 *
 * Lifecycle events emitted:
 *   'thinking:start' { userId, model }
 *   'item:update'    { userId, model, text }
 *   'tool:call'      { userId, name, args }
 *   'tool:result'    { userId, name, result }
 *   'done'           { userId, model, text }
 *   'error'          { userId, err }
 */
class Agent extends EventEmitter {
  /**
   * @param {object} opts
   * @param {string} opts.apiKey
   * @param {string} opts.model       e.g. 'qwen/qwen3-32b:free'
   * @param {string} [opts.systemPrompt]
   * @param {string} [opts.siteUrl]
   * @param {string} [opts.siteName]
   */
  constructor({ apiKey, model, systemPrompt = '', siteUrl = '', siteName = '' }) {
    super();
    this.apiKey       = apiKey;
    this.model        = model;
    this.systemPrompt = systemPrompt;
    this.siteUrl      = siteUrl;
    this.siteName     = siteName;
    this.tools        = new Map(); // name -> { schema, handler }
  }

  // ── Tool registration ───────────────────────────────────────────────────────

  registerTool(name, schema, handler) {
    this.tools.set(name, { schema, handler });
    return this;
  }

  _toolDefinitions() {
    return [...this.tools.entries()].map(([name, { schema }]) => ({
      type:     'function',
      function: { name, description: schema.description || name, parameters: schema },
    }));
  }

  // ── HTTP helper ───────────────────────────────────────────────────────────────

  async _post(body) {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization:  `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': this.siteUrl,
          'X-Title':      this.siteName,
        },
        body:   JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const raw = await res.text();
        throw new Error(`OpenRouter ${res.status}: ${raw.slice(0, 300)}`);
      }

      return res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Core: send messages and return reply text ─────────────────────────────────

  /**
   * @param {Array<{role,content}>} history   OpenAI-format history (no system msg)
   * @param {string}                userText
   * @param {string}                [userId]
   * @returns {Promise<string>}
   */
  async chat(history, userText, userId = 'anon') {
    this.emit('thinking:start', { userId, model: this.model });

    const messages = [
      ...(this.systemPrompt ? [{ role: 'system', content: this.systemPrompt }] : []),
      ...history,
      { role: 'user', content: userText },
    ];

    const toolDefs = this._toolDefinitions();
    const reqBody  = {
      model:       this.model,
      messages,
      max_tokens:  1000,
      temperature: 0.7,
      ...(toolDefs.length ? { tools: toolDefs, tool_choice: 'auto' } : {}),
    };

    let data;
    try {
      data = await this._post(reqBody);
    } catch (err) {
      this.emit('error', { userId, err: err.message });
      throw err;
    }

    const choice  = data.choices?.[0];
    const message = choice?.message;

    // ── Tool-call loop ────────────────────────────────────────────────────────
    if (message?.tool_calls?.length) {
      const toolMessages = [{ role: 'assistant', content: null, tool_calls: message.tool_calls }];

      for (const tc of message.tool_calls) {
        const { name, arguments: rawArgs } = tc.function;
        this.emit('tool:call', { userId, name, args: rawArgs });

        let result;
        const entry = this.tools.get(name);
        try {
          result = entry
            ? String(await entry.handler(JSON.parse(rawArgs)))
            : `Unknown tool: ${name}`;
        } catch (e) {
          result = `Error in tool ${name}: ${e.message}`;
        }

        this.emit('tool:result', { userId, name, result });
        toolMessages.push({ role: 'tool', tool_call_id: tc.id, content: result });
      }

      // Second call with tool results
      const final = await this._post({
        model:    this.model,
        messages: [...messages, ...toolMessages],
        max_tokens:  1000,
        temperature: 0.7,
      });

      const text = final.choices?.[0]?.message?.content || '';
      this.emit('done', { userId, model: this.model, text });
      return text;
    }

    // ── Plain text reply ──────────────────────────────────────────────────────
    const text = message?.content || '';
    this.emit('item:update', { userId, model: this.model, text });
    this.emit('done',        { userId, model: this.model, text });
    return text;
  }
}

module.exports = { Agent };
