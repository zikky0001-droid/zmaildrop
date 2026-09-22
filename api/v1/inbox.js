"use strict";
const utils = require("./utils");

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return utils.handleOptions(req, res);
  if (req.method !== "GET") return utils.send(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Only GET is allowed." } });

  const ip = utils.getClientIP(req);
  const rl = await utils.checkRateLimit(ip);
  utils.bumpGlobalCounter();

  res.setHeader("X-RateLimit-Limit", rl.limit);
  res.setHeader("X-RateLimit-Remaining", rl.remaining);
  if (rl.resetAt) res.setHeader("X-RateLimit-Reset", Math.ceil(rl.resetAt / 1000));

  if (!rl.allowed) {
    res.setHeader("Retry-After", rl.retryAfter || 60);
    return utils.send(res, 429, {
      ok: false,
      error: {
        code: rl.blacklisted ? "IP_BLACKLISTED" : "RATE_LIMITED",
        message: rl.blacklisted ? "Your IP is temporarily blocked. Retry in " + rl.retryAfter + "s." : "Rate limit exceeded.",
        retry_after_seconds: rl.retryAfter || 60,
      },
    });
  }

  const mailbox = String(req.query.mailbox || "").trim().toLowerCase();
  if (!utils.validMailbox(mailbox)) return utils.send(res, 400, { ok: false, error: { code: "INVALID_MAILBOX", message: "Mailbox must be lowercase alphanumeric (a-z0-9._-)." } });

  const cacheKey = "inbox:" + mailbox;
  const hit = utils.getCached(cacheKey);
  if (hit) {
    res.setHeader("X-Cache", "HIT");
    return utils.send(res, 200, { ok: true, data: hit, meta: { cached: true, rate: { remaining: rl.remaining, limit: rl.limit } } });
  }

  try {
    await utils.throttleUpstream();

    const hit2 = utils.getCached(cacheKey);
    if (hit2) {
      res.setHeader("X-Cache", "HIT-2");
      return utils.send(res, 200, { ok: true, data: hit2, meta: { cached: true, rate: { remaining: rl.remaining, limit: rl.limit } } });
    }

    const query = 'query ($mailbox: String!) { inbox(mailbox: $mailbox) { id headerfrom subject date } }';
    const data = await utils.maildropGraphQL(query);
    const messages = (data && data.inbox) || [];
    const payload = { mailbox, messages };
    utils.setCached(cacheKey, payload);

    res.setHeader("X-Cache", "MISS");
    return utils.send(res, 200, { ok: true, data: payload, meta: { cached: false, rate: { remaining: rl.remaining, limit: rl.limit } } });
  } catch (err) {
    const isThrottle = String(err.message).includes("UPSTREAM_THROTTLE_TIMEOUT");
    return utils.send(res, isThrottle ? 503 : 502, {
      ok: false,
      error: { code: isThrottle ? "UPSTREAM_BUSY" : "UPSTREAM_ERROR", message: isThrottle ? "Server is currently busy. Please retry in a moment." : (err.message || "Maildrop request failed.") },
    });
  }
};


