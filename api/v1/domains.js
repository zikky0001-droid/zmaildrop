"use strict";
const utils = require("./utils");

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return utils.handleOptions(req, res);
  if (req.method !== "GET") return utils.send(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Only GET is allowed." } });

  utils.bumpGlobalCounter();

  return utils.send(res, 200, {
    ok: true,
    data: {
      provider: "maildrop",
      domains: [{ name: "maildrop.cc", label: "Maildrop (Public)" }],
    },
    meta: { count: 1 },
  });
};

