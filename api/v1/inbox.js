/* api/v1/inbox.js */
/*
  GET /api/v1/inbox?mailbox=:name
  Lists all messages in a mailbox.
  - Rate limited (30/min per IP, 5-min blacklist on excess)
  - In-memory cache (3s TTL) to protect the upstream
  - Global throttle (never 2 upstream calls within 750ms)
  - Includes per-request metadata: cached, duration, rate info
*/

"use strict";
const utils = require("./utils");

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return utils.handleOptions(req, res);
  if (req.method !== "GET") {
    return utils.failure(res, 405, "METHOD_NOT_ALLOWED", "Only GET is allowed.", {
      hint: "This endpoint accepts GET requests only.",
    });
  }

  const request_id = utils.newRequestId();
  const start = Date.now();

  const ip = utils.getClientIP(req);
  const rl = await utils.checkRateLimit(ip);
  await utils.bumpGlobalCounter();

  res.setHeader("X-RateLimit-Limit", rl.limit);
  res.setHeader("X-RateLimit-Remaining", rl.remaining);
  if (rl.resetAt) res.setHeader("X-RateLimit-Reset", Math.ceil(rl.resetAt / 1000));

  if (!rl.allowed) {
    res.setHeader("Retry-After", rl.retryAfter || 60);
    return utils.failure(
      res,
      429,
      rl.blacklisted ? "IP_BLACKLISTED" : "RATE_LIMITED",
      rl.blacklisted
        ? `Your IP is temporarily blocked. Retry in ${rl.retryAfter}s.`
        : "Rate limit exceeded.",
      {
        hint: rl.blacklisted
          ? "You exceeded the limit. Try again after the retry window."
          : "You've hit 30 requests in 60 seconds. Wait a moment.",
        retry_after_seconds: rl.retryAfter || 60,
        request_id,
      }
    );
  }

  const mailbox = String(req.query.mailbox || "").trim().toLowerCase();
  if (!mailbox) {
    return utils.failure(res, 400, "MISSING_MAILBOX", "The `mailbox` query parameter is required.", {
      hint: "Example: /api/v1/inbox?mailbox=2",
      details: { example: "/api/v1/inbox?mailbox=2" },
      request_id,
    });
  }
  if (!utils.validMailbox(mailbox)) {
    return utils.failure(res, 400, "INVALID_MAILBOX", "Mailbox name is invalid.", {
      hint: "Use lowercase letters, numbers, dots, underscores, or hyphens. Max 64 chars.",
      details: { received: mailbox, regex: "^[a-z0-9][a-z0-9._-]{0,63}$" },
      request_id,
    });
  }

  const cacheKey = "inbox:" + mailbox;
  const hit = utils.getCached(cacheKey);
  if (hit) {
    res.setHeader("X-Cache", "HIT");
    return utils.success(res, hit, {
      cached: true,
      duration_ms: Date.now() - start,
      rate: utils.rateMeta(rl),
      request_id,
    });
  }

  try {
    await utils.throttleUpstream();

    const hit2 = utils.getCached(cacheKey);
    if (hit2) {
      res.setHeader("X-Cache", "HIT-2");
      return utils.success(res, hit2, {
        cached: true,
        duration_ms: Date.now() - start,
        rate: utils.rateMeta(rl),
        request_id,
      });
    }

    const query = `
      query ($mailbox: String!) {
        inbox(mailbox: $mailbox) {
          id
          headerfrom
          subject
          date
        }
      }
    `;
    const data = await utils.maildropGraphQL(query, { mailbox });
    const messages = (data && data.inbox) || [];

    const payload = {
      mailbox,
      address: mailbox + "@maildrop.cc",
      count: messages.length,
      messages,
    };

    utils.setCached(cacheKey, payload);

    res.setHeader("X-Cache", "MISS");
    return utils.success(res, payload, {
      cached: false,
      duration_ms: Date.now() - start,
      rate: utils.rateMeta(rl),
      request_id,
    });
  } catch (err) {
    const isThrottle = String(err.message).includes("UPSTREAM_THROTTLE_TIMEOUT");

    return utils.failure(
      res,
      isThrottle ? 503 : 502,
      isThrottle ? "UPSTREAM_BUSY" : "UPSTREAM_ERROR",
      isThrottle
        ? "Server is currently busy. Please retry in a moment."
        : err.message || "Maildrop request failed.",
      {
        hint: isThrottle
          ? "Too many concurrent requests. Try again in a few seconds."
          : "The upstream mail provider returned an error.",
        request_id,
      }
    );
  }
};



