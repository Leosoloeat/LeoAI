'use strict';

// Per-user: 3s cooldown + block if already processing
const COOLDOWN_MS = 3_000;
const userCooldown = new Map(); // userId -> lastProcessedAt (ms)
const userPending  = new Set(); // userId currently awaiting AI response

// Clean up stale entries every 10 min
setInterval(() => {
  const cutoff = Date.now() - 60_000;
  for (const [k, v] of userCooldown) {
    if (v < cutoff) userCooldown.delete(k);
  }
}, 10 * 60_000).unref();

function check(userId) {
  if (userPending.has(userId)) {
    return { ok: false, reason: 'pending' };
  }
  const last   = userCooldown.get(userId) || 0;
  const waitMs = COOLDOWN_MS - (Date.now() - last);
  if (waitMs > 0) {
    return { ok: false, reason: 'cooldown', waitMs };
  }
  return { ok: true };
}

function start(userId) {
  userPending.add(userId);
  userCooldown.set(userId, Date.now());
}

function done(userId) {
  userPending.delete(userId);
}

module.exports = { check, start, done };
