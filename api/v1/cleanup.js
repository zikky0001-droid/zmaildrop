/* api/v1/cleanup.js */
/*
  GET or POST /api/v1/cleanup
  Wipes the entire `rate_limits` collection in batches of 500.
  Keeps `stats/global` and `system/upstream_lock` intact.

  Protected by CRON_SECRET — must send:
    Authorization: Bearer <CRON_SECRET>

  Vercel cron fires this automatically at 23:00 UTC (00:00 Lagos).
  Can also be called manually for testing.
*/

"use strict";
const utils = require("./utils");

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return utils.handleOptions(req, res);
  if (req.method !== "GET" && req.method !== "POST") {
    return utils.failure(res, 405, "METHOD_NOT_ALLOWED", "Only GET or POST are allowed.", {
      hint: "This endpoint is normally triggered automatically by Vercel cron.",
    });
  }

  const authHeader = req.headers["authorization"] || "";
  const expected = "Bearer " + (process.env.CRON_SECRET || "");

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return utils.failure(res, 401, "UNAUTHORIZED", "Cron secret required.", {
      hint: "Send `Authorization: Bearer <CRON_SECRET>` in the header.",
    });
  }

  const db = utils.getDb();
  if (!db) {
    return utils.success(res, {
      cleaned: 0,
      note: "Firebase is disabled — nothing to clean.",
    });
  }

  try {
    let totalDeleted = 0;
    let batches = 0;

    while (true) {
      const snap = await db.collection("rate_limits").limit(500).get();
      if (snap.empty) break;

      const batch = db.batch();
      snap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();

      totalDeleted += snap.size;
      batches += 1;

      if (snap.size < 500) break;
    }

    return utils.success(res, {
      cleaned: totalDeleted,
      batches,
      collection: "rate_limits",
      note: "stats/global and system/upstream_lock were NOT touched.",
    });
  } catch (err) {
    return utils.failure(res, 500, "CLEANUP_FAILED", err.message || "Cleanup failed.", {
      hint: "Check Firestore permissions or try again.",
    });
  }
};



