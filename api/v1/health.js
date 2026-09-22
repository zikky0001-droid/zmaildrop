"use strict";
const utils = require("./utils");

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return utils.handleOptions(req, res);
  if (req.method !== "GET") {
    return utils.send(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Only GET is allowed." } });
  }

  utils.bumpGlobalCounter();

  const now = new Date();
  const lagos = new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos",
    dateStyle: "medium",
    timeStyle: "long",
  }).format(now);

  return utils.send(res, 200, {
    ok: true,
    data: {
      service: "ZMAIL Drop API",
      version: "v1",
      status: "online",
      firebase: utils.firebaseEnabled() ? "connected" : "disabled",
      timezone: "Africa/Lagos (UTC+1)",
      time_utc: now.toISOString(),
      time_lagos: lagos,
    },
  });
};

