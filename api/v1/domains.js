/* api/v1/domains.js */
/*
  GET /api/v1/domains
  Lists every domain this API can receive mail on.
  Currently supports maildrop.cc only (public inboxes).
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

  const domains = [
    {
      name: "maildrop.cc",
      label: "Maildrop",
      description: "Free public temporary inbox. Pick any name, no signup.",
      public: true,
    },
  ];

  return utils.success(
    res,
    {
      provider: "maildrop",
      provider_url: "https://maildrop.cc",
      domains,
    },
    {
      count: domains.length,
    }
  );
};



