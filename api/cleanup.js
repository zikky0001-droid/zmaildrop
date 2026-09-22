"use strict";
const utils = require("./utils");

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return utils.handleOptions(req, res);
  if (req.method !== "GET" && req.method !== "POST") return utils.send(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "GET or POST only." } });

  const authHeader = req.headers["authorization"] || "";
  const expected = "Bearer " + (process.env.CRON_SECRET || "");
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return utils.send(res, 401, { ok: false, error: { code: "UNAUTHORIZED", message: "Cron secret required." } });
  }

  const db = utils.getDb();
  if (!db) return utils.send(res, 200, { ok: true, data: { cleaned: 0, note: "Firebase disabled." } });

  try {
    let totalDeleted = 0;
    while (true) {
      const snap = await db.collection("rate_limits").limit(500).get();
      if (snap.empty) break;
      const batch = db.batch();
      snap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      totalDeleted += snap.size;
      if (snap.size < 500) break;
    }

    return utils.send(res, 200, {
      ok: true,
      data: { cleaned: totalDeleted, timestamp: new Date().toISOString() },
    });
  } catch (err) {
    return utils.send(res, 500, { ok: false, error: { code: "CLEANUP_FAILED", message: err.message } });
  }
};


