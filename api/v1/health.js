/* api/v1/health.js */
/*
  GET /api/v1/health
  Status check for the ZMAIL Drop API.
  Returns service version, Firebase connection state, Lagos time,
  lifetime request count, and a list of available endpoints.
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

  await utils.bumpGlobalCounter();

  const now = new Date();
  const lagosTime = new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos",
    dateStyle: "full",
    timeStyle: "long",
  }).format(now);

  const stats = await utils.getGlobalStats();

  return utils.success(
    res,
    {
      service: "ZMAIL Drop API",
      version: "v1",
      status: "online",
      firebase: utils.firebaseEnabled() ? "connected" : "disabled",
      timezone: {
        name: "Africa/Lagos",
        offset: "UTC+1",
        now: lagosTime,
      },
      time: {
        iso_utc: now.toISOString(),
        unix_ms: now.getTime(),
      },
      stats: {
        total_requests: stats.totalRequests,
        last_hit_at: stats.lastHitAt ? new Date(stats.lastHitAt).toISOString() : null,
      },
      endpoints: {
        inbox: "/api/v1/inbox?mailbox=:name",
        message: "/api/v1/message?mailbox=:name&id=:id",
        docs: utils.DOCS_URL,
      },
    },
    {
      docs: utils.DOCS_URL,
    }
  );
};



