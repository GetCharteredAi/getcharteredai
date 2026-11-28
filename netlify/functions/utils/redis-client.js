// netlify/functions/utils/redis-client.js
// Upstash Redis wrapper for atomic per-manager allowance tracking.
// Uses Lua scripts to avoid INCR/DECR races when checking and reserving credits.
//
// Injected via require.cache in tests — no live Redis calls are made in test suites.

'use strict';

// RESERVE_LUA: atomically checks the allowance and reserves one credit.
//   Returns the new counter value (integer >= 1) on success.
//   Returns -1 (integer) if the counter is already at or over the limit.
//   Sets EXPIREAT only on first creation so a pre-existing TTL is never extended.
//
// KEYS[1] : counter key
// ARGV[1] : allowed limit (string integer)
// ARGV[2] : EXPIREAT value in Unix seconds
const RESERVE_LUA = `
local current = redis.call('GET', KEYS[1])
local allowed = tonumber(ARGV[1])
if current == false then
  redis.call('SET', KEYS[1], 1)
  redis.call('EXPIREAT', KEYS[1], tonumber(ARGV[2]))
  return 1
end
local n = tonumber(current)
if n >= allowed then
  return -1
end
local newval = redis.call('INCR', KEYS[1])
return newval
`.trim();

// REFUND_LUA: safely decrements a counter by one.
//   Returns the new value, or 0 if the key is absent or already zero.
//   Called when an AI or transcription request fails after a credit was reserved.
//
// KEYS[1] : counter key
const REFUND_LUA = `
local current = redis.call('GET', KEYS[1])
if current == false or tonumber(current) <= 0 then
  return 0
end
return redis.call('DECR', KEYS[1])
`.trim();

function getRedis() {
  const { Redis } = require('@upstash/redis');
  return new Redis({
    url:   process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN
  });
}

/**
 * Atomically checks the allowance for `key` and reserves one credit.
 * @param {string}  key      Redis counter key
 * @param {number}  allowed  Monthly or daily limit
 * @param {number}  expireAt Unix timestamp (seconds) when the counter should expire
 * @returns {Promise<number>} New counter value (>= 1) on success; -1 if limit reached
 */
async function checkAndReserveCredit(key, allowed, expireAt) {
  const redis = getRedis();
  const result = await redis.eval(RESERVE_LUA, [key], [String(allowed), String(expireAt)]);
  return Number(result);
}

/**
 * Refunds one credit after a failed AI or transcription request.
 * Safe to call even if the key has already expired or does not exist.
 * @param {string} key Redis counter key
 */
async function refundCredit(key) {
  const redis = getRedis();
  await redis.eval(REFUND_LUA, [key], []);
}

module.exports = { checkAndReserveCredit, refundCredit };
