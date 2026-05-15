'use strict';

const line = require('@line/bot-sdk');

/**
 * Reply to a LINE user.
 * @param {string} channelAccessToken
 * @param {string} replyToken
 * @param {string} text
 */
async function replyToLine(channelAccessToken, replyToken, text) {
  const client = new line.messagingApi.MessagingApiClient({ channelAccessToken });
  await client.replyMessage({
    replyToken,
    messages: [{ type: 'text', text }],
  });
}

module.exports = { replyToLine };
