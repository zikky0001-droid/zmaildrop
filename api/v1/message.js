/* api/v1/message.js */
/*
  GET    /api/v1/message?mailbox=:name&id=:id   → read one message
  DELETE /api/v1/message?mailbox=:name&id=:id   → delete one message

  GET response includes parsed helpers:
    - html            → sanitized body HTML
    - raw             → full MIME source
    - cid_map         → { content-id: "data:image/...;base64,..." }
    - has_attachments → boolean (true if MIME has Content-Disposition: attachment)
  DELETE invalidates cached inbox + message views.
*/

"use strict";
const utils = require("./utils");

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return utils.handleOptions(req, res);
  if (req.method !== "GET" && req.method !== "DELETE") {
    return utils.failure(res, 405, "METHOD_NOT_ALLOWED", "Only GET or DELETE are allowed.", {
      hint: "Use GET to read a message, DELETE to remove it.",
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
  const id = String(req.query.id || "").trim();

  if (!mailbox) {
    return utils.failure(res, 400, "MISSING_MAILBOX", "The `mailbox` query parameter is required.", {
      hint: "Example: /api/v1/message?mailbox=2&id=abc",
      request_id,
    });
  }
  if (!utils.validMailbox(mailbox)) {
    return utils.failure(res, 400, "INVALID_MAILBOX", "Mailbox name is invalid.", {
      hint: "Use lowercase letters, numbers, dots, underscores, or hyphens.",
      details: { received: mailbox },
      request_id,
    });
  }
  if (!id) {
    return utils.failure(res, 400, "MISSING_ID", "The `id` query parameter is required.", {
      hint: "Get it from /api/v1/inbox?mailbox=" + mailbox,
      request_id,
    });
  }
  if (!utils.validId(id)) {
    return utils.failure(res, 400, "INVALID_ID", "Message ID is invalid.", {
      hint: "IDs must be alphanumeric with dots, underscores, colons, or hyphens.",
      details: { received: id },
      request_id,
    });
  }

  if (req.method === "GET") {
    const cacheKey = "message:" + mailbox + ":" + id;
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
        query ($mailbox: String!, $id: String!) {
          message(mailbox: $mailbox, id: $id) {
            id
            headerfrom
            subject
            date
            html
            data
          }
        }
      `;
      const data = await utils.maildropGraphQL(query, { mailbox, id });

      if (!data || !data.message) {
        return utils.failure(res, 404, "MESSAGE_NOT_FOUND", "Message not found or expired.", {
          hint: "It may have been deleted, or the ID is wrong. Refresh the inbox list.",
          details: { mailbox, id },
          request_id,
        });
      }

      const payload = {
        mailbox,
        address: mailbox + "@maildrop.cc",
        message: {
          id: data.message.id,
          from: data.message.headerfrom,
          subject: data.message.subject,
          date: data.message.date,
          html: data.message.html || null,
          raw: data.message.data || null,
          has_attachments: detectAttachments(data.message.data),
          cid_map: buildCidMap(data.message.data),
        },
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
        isThrottle ? "Server is currently busy. Please retry in a moment." : err.message,
        {
          hint: isThrottle
            ? "Too many concurrent requests. Try again in a few seconds."
            : "The upstream mail provider returned an error.",
          request_id,
        }
      );
    }
  }

  try {
    await utils.throttleUpstream();

    const mutation = `
      mutation ($mailbox: String!, $id: String!) {
        delete(mailbox: $mailbox, id: $id)
      }
    `;
    const data = await utils.maildropGraphQL(mutation, { mailbox, id });

    utils.deleteCached("inbox:" + mailbox);
    utils.deleteCached("message:" + mailbox + ":" + id);

    return utils.success(
      res,
      {
        mailbox,
        id,
        deleted: true,
        result: (data && data.delete) || null,
      },
      {
        duration_ms: Date.now() - start,
        rate: utils.rateMeta(rl),
        request_id,
      }
    );
  } catch (err) {
    const isThrottle = String(err.message).includes("UPSTREAM_THROTTLE_TIMEOUT");
    return utils.failure(
      res,
      isThrottle ? 503 : 502,
      isThrottle ? "UPSTREAM_BUSY" : "UPSTREAM_ERROR",
      isThrottle ? "Server is currently busy. Please retry in a moment." : err.message,
      {
        hint: isThrottle
          ? "Too many concurrent requests. Try again in a few seconds."
          : "The upstream mail provider could not delete the message.",
        request_id,
      }
    );
  }
};

function detectAttachments(rawMime) {
  if (!rawMime) return false;
  return /Content-Disposition:\s*attachment/i.test(rawMime);
}

function buildCidMap(rawMime) {
  if (!rawMime) return {};
  const map = {};
  const parts = rawMime.split(/^--[^\r\n]+/m);

  for (const part of parts) {
    const cidMatch = part.match(/Content-ID:\s*<([^>]+)>/i);
    if (!cidMatch) continue;

    const typeMatch = part.match(/Content-Type:\s*([^;\r\n]+)/i);
    if (!typeMatch) continue;

    if (!/Content-Transfer-Encoding:\s*base64/i.test(part)) continue;

    const headerEnd = part.search(/\r?\n\r?\n/);
    if (headerEnd === -1) continue;

    const body = part.slice(headerEnd).replace(/[\r\n\s]/g, "");
    if (!body) continue;

    const mimeType = typeMatch[1].trim();
    map[cidMatch[1]] = `data:${mimeType};base64,${body}`;
  }

  return map;
}



