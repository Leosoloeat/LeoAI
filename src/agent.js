'use strict';

const EventEmitter = require('eventemitter3');
const OpenAI       = require('@openrouter/sdk');
const logger       = require('./logger');

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const TIMEOUT_MS      = 30_000;

/**
 * OpenRouter Agent
 * Extends EventEmitter so callers can hook into lifecycle events:
 *   'thinking:start' | 'stream:delta' | 'item:update' | 'tool:call' |
 *   'tool:result'    | 'done'         | 'error'
 */
class Agent extends EventEmitter {
  /**
   * @param {object} opts
   * @param {string} opts.apiKey       - OpenRouter API key
   * @param {string} opts.model        - Model ID e.g. 'qwen/qwen3-32b'
   * @param {string} [opts.systemPrompt]
   * @param {string} [opts.siteUrl]
   * @param {string} [opts.siteName]
   */
  constructor({ apiKey, model, systemPrompt = '', siteUrl = '', siteName = '' }) {
    super();
    this.model        = model;
    this.systemPrompt = systemPrompt;
    this.tools        = new Map(); // name -> { schema, handler }

    this.client = new OpenAI.default({
      baseURL: OPENROUTER_BASE,
      apiKey,
      defaultHeaders: {
        'HTTP-Referer': siteUrl,
        'X-Title':      siteName,
      },
      timeout: TIMEOUT_MS,
    });
  }

  // ── Tool registration ───────────────────────────────────────────────────────

  /**
   * Register a callable tool the model can invoke.
   * @param {string}   name
   * @param {object}   schema  - JSON Schema for parameters
   * @param {Function} handler - async (params) => string
   */
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

  // ── Core: send a message and get a reply ────────────────────────────────────

  /**
   * Send conversation history + new user message, return reply text.
   * Items-based: Map<itemId, content> — replaces chunks by ID.
   *
   * @param {Array<{role,content}>} history   - OpenAI-format history
   * @param {string}                userText  - Latest user message
   * @param {string}                [userId]  - For logging
   * @returns {Promise<string>}               - Final assistant reply
   */
  async chat(history, userText, userId = 'anon') {
    this.emit('thinking:start', { userId, model: this.model });

    const messages = [
      ...(this.systemPrompt ? [{ role: 'system', content: this.systemPrompt }] : []),
      ...history,
      { role: 'user', content: userText },
    ];

    const toolDefs = this._toolDefinitions();
    const reqOpts  = {
      model:    this.model,
      messages,
      stream:   false,          // LINE OA doesn't support streaming
      max_tokens: 1000,
      temperature: 0.7,
      ...(toolDefs.length ? { tools: toolDefs, tool_choice: 'auto' } : {}),
    };

    let response;
    try {
      response = await this.client.chat.completions.create(reqOpts);
    } catch (err) {
      this.emit('error', { userId, err: err.message });
      throw err;
    }

    const choice  = response.choices?.[0];
    const message = choice?.message;

    // ── Tool call loop ────────────────────────────────────────────────────────
    if (message?.tool_calls?.length) {
      const toolMessages = [{ role: 'assistant', content: null, tool_calls: message.tool_calls }];

      for (const tc of message.tool_calls) {
        const { name, arguments: rawArgs } = tc.function;
        this.emit('tool:call', { userId, name, args: rawArgs });

        let result;
        const entry = this.tools.get(name);
        if (entry) {
          try {
            const parsed = JSON.parse(rawArgs);
            result = String(await entry.handler(parsed));
          } catch (e) {
            result = `Error: ${e.message}`;
          }
        } else {
          result = `Unknown tool: ${name}`;
        }

        this.emit('tool:result', { userId, name, result });
        toolMessages.push({ role: 'tool', tool_call_id: tc.id, content: result });
      }

      // Second call with tool results
      const final = await this.client.chat.completions.create({
        model:    this.model,
        messages: [...messages, ...toolMessages],
        stream:   false,
        max_tokens: 1000,
        temperature: 0.7,
      });

      const text = final.choices?.[0]?.message?.content || '';
      this.emit('done', { userId, model: this.model, text });
      return text;
    }

    // ── Plain text reply ──────────────────────────────────────────────────────
    const text = message?.content || '';
    this.emit('item:update', { userId, model: this.model, text });
    this.emit('done', { userId, model: this.model, text });
    return text;
  }
}

module.exports = { Agent };
