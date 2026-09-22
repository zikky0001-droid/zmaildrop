"use strict";
const utils = require("./utils");

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return utils.handleOptions(req, res);
  if (req.method !== "GET" && req.method !== "DELETE") return utils.send(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "GET or DELETE only." } });

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
  const id = String(req.query.id || "").trim();
  if (!utils.validMailbox(mailbox)) return utils.send(res, 400, { ok: false, error: { code: "INVALID_MAILBOX", message: "Invalid mailbox." } });
  if (!utils.validId(id)) return utils.send(res, 400, { ok: false, error: { code: "INVALID_ID", message: "Invalid message ID." } });

  if (req.method === "GET") {
    const cacheKey = "message:" + mailbox + ":" + id;
    const hit = utils.getCached(cacheKey);
    if (hit) {
      res.setHeader("X-Cache", "HIT");
      return utils.send(res, 200, { ok: true, data: hit, meta: { cached: true } });
    }

    try {
      await utils.throttleUpstream();

      const hit2 = utils.getCached(cacheKey);
      if (hit2) {
        res.setHeader("X-Cache", "HIT-2");
        return utils.send(res, 200, { ok: true, data: hit2, meta: { cached: true } });
      }

      const query = 'query ($mailbox: String!, $id: String!) { message(mailbox: $mailbox, id: $id) { id headerfrom subject date html data } }';
      const data = await utils.maildropGraphQL(query);
      if (!data || !data.message) return utils.send(res, 404, { ok: false, error: { code: "MESSAGE_NOT_FOUND", message: "Message not found or expired." } });

      const payload = { mailbox, message: data.message };
      utils.setCached(cacheKey, payload);

      res.setHeader("X-Cache", "MISS");
      return utils.send(res, 200, { ok: true, data: payload, meta: { cached: false } });
    } catch (err) {
      const isThrottle = String(err.message).includes("UPSTREAM_THROTTLE_TIMEOUT");
      return utils.send(res, isThrottle ? 503 : 502, {
        ok: false,
        error: { code: isThrottle ? "UPSTREAM_BUSY" : "UPSTREAM_ERROR", message: isThrottle ? "Server busy. Retry in a moment." : err.message },
      });
    }
  }

  try {
    await utils.throttleUpstream();
    const mutation = 'mutation ($mailbox: String!, $id: String!) { delete(mailbox: $mailbox, id: $id) }';
    const data = await utils.maildropGraphQL(mutation);
    utils.deleteCached("inbox:" + mailbox);
    utils.deleteCached("message:" + mailbox + ":" + id);
    return utils.send(res, 200, { ok: true, data: { mailbox, id, deleted: true, result: (data && data.delete) || null } });
  } catch (err) {
    const isThrottle = String(err.message).includes("UPSTREAM_THROTTLE_TIMEOUT");
    return utils.send(res, isThrottle ? 503 : 502, {
      ok: false,
      error: { code: isThrottle ? "UPSTREAM_BUSY" : "UPSTREAM_ERROR", message: isThrottle ? "Server busy. Retry in a moment." : err.message },
    });
  }
};



