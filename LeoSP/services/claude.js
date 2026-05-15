'use strict';

const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL   = 'claude-sonnet-4-6';
const MAX_TOK = 1000;

/**
 * Send a message to Claude with full context injection.
 * @param {string} systemMessage — combined master prompt + knowledge base
 * @param {string} userText      — current user message
 * @param {Array}  history       — [{role:'user'|'assistant', content:string}]
 * @returns {Promise<string>}
 */
async function askClaude(systemMessage, userText, history = []) {
  const messages = [
    ...history,
    { role: 'user', content: userText },
  ];

  const response = await client.messages.create({
    model:       MODEL,
    max_tokens:  MAX_TOK,
    temperature: 0.2,
    system:      systemMessage,
    messages,
  });

  return response.content[0].text.trim();
}

module.exports = { askClaude };
