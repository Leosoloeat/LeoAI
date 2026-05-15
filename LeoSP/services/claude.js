'use strict';

const Anthropic = require('@anthropic-ai/sdk');

const client    = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL     = 'claude-sonnet-4-6';
const MAX_TOK   = 1000;
const MAX_RETRY = 2;

/**
 * Send a message to Claude with prompt caching on the system message.
 * Cache persists 5 min — saves ~90% input token cost since KB is injected every call.
 */
async function askClaude(systemMessage, userText, history = []) {
  const messages = [
    ...history,
    { role: 'user', content: userText },
  ];

  for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
    try {
      const response = await client.messages.create({
        model:       MODEL,
        max_tokens:  MAX_TOK,
        temperature: 0.2,
        system: [
          {
            type: 'text',
            text: systemMessage,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages,
        betas: ['prompt-caching-2024-07-31'],
      });

      const text  = response.content[0]?.text?.trim() || '';
      const usage = response.usage;
      if (usage?.cache_read_input_tokens) {
        console.log(`[claude] cache_hit=${usage.cache_read_input_tokens}tok saved`);
      } else if (usage?.cache_creation_input_tokens) {
        console.log(`[claude] cache_write=${usage.cache_creation_input_tokens}tok`);
      }

      return text;
    } catch (err) {
      if (attempt < MAX_RETRY && (err.status === 529 || err.status === 500)) {
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
}

module.exports = { askClaude };
