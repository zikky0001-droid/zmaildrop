// api/v1/utils.js 

"use strict";
const admin = require("firebase-admin");

const CONFIG = {
  rateLimit: { max: 30, windowMs: 60_000, blacklistMs: 300_000, fastPathLimit: 5 },
  upstream: { minGapMs: 750, maxWaitMs: 5_000 },
  cache: { ttlMs: 3_000 },
};

const MAILDROP_URL = "https://api.maildrop.cc/graphql";

const memRate = new Map();
const memCache = new Map();
let memUpstreamLock = 0;

let _app = null;
let _db = null;

function firebaseEnabled() {
  return !!(
    (process.env.PROJECT_KEY || process.env.FIREBASE_PROJECT_ID) &&
    (process.env.EMAIL_KEY || process.env.FIREBASE_CLIENT_EMAIL) &&
    (process.env.PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY)
  );
}

function getDb() {
  if (_db) return _db;
  if (!firebaseEnabled()) return null;
  const projectId = process.env.PROJECT_KEY || process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.EMAIL_KEY || process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  _app = admin.apps.length ? admin.app() : admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
  _db = _app.firestore();
  return _db;
}

function handleOptions(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.statusCode = 204;
  res.end();
}

function send(res, status, body) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.statusCode = status;
  res.end(JSON.stringify(body));
}

function getClientIP(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length) return xff.split(",")[0].trim();
  return req.headers["x-real-ip"] || (req.socket && req.socket.remoteAddress) || "unknown";
}

function safeDocId(str) { return String(str).replace(/[\/\\]/g, "_").toLowerCase().slice(0, 200); }
function validMailbox(n) { return typeof n === "string" && /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(n); }
function validId(id) { return typeof id === "string" && id.length > 0 && id.length < 200 && /^[a-zA-Z0-9._:-]+$/.test(id); }

async function bumpGlobalCounter() {
  const db = getDb();
  if (!db) return;
  try {
    await db.collection("stats").doc("global").set(
      { totalRequests: admin.firestore.FieldValue.increment(1), lastHitAt: Date.now() },
      { merge: true }
    );
  } catch { /* silent */ }
}

async function checkRateLimit(ip) {
  const now = Date.now();
  const rec = memRate.get(ip) || { count: 0, windowStart: now, blacklistedUntil: 0 };

  if (rec.blacklistedUntil > now) {
    return { allowed: false, blacklisted: true, retryAfter: Math.ceil((rec.blacklistedUntil - now) / 1000), limit: CONFIG.rateLimit.max, remaining: 0 };
  }

  if (now - rec.windowStart > CONFIG.rateLimit.windowMs) { rec.count = 0; rec.windowStart = now; }
  rec.count += 1;

  if (rec.count <= CONFIG.rateLimit.fastPathLimit) {
    memRate.set(ip, rec);
    return { allowed: true, limit: CONFIG.rateLimit.max, remaining: CONFIG.rateLimit.max - rec.count, resetAt: rec.windowStart + CONFIG.rateLimit.windowMs };
  }

  const db = getDb();
  if (!db) {
    memRate.set(ip, rec);
    if (rec.count > CONFIG.rateLimit.max) {
      rec.blacklistedUntil = now + CONFIG.rateLimit.blacklistMs;
      return { allowed: false, blacklisted: true, retryAfter: Math.ceil(CONFIG.rateLimit.blacklistMs / 1000), limit: CONFIG.rateLimit.max, remaining: 0 };
    }
    return { allowed: true, limit: CONFIG.rateLimit.max, remaining: CONFIG.rateLimit.max - rec.count, resetAt: rec.windowStart + CONFIG.rateLimit.windowMs };
  }

  const ref = db.collection("rate_limits").doc(safeDocId(ip));

  return await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : {};
    const storedBlacklist = data.blacklistedUntil || 0;

    if (storedBlacklist > now) {
      return { allowed: false, blacklisted: true, retryAfter: Math.ceil((storedBlacklist - now) / 1000), limit: CONFIG.rateLimit.max, remaining: 0 };
    }

    let windowStart = data.windowStart || 0;
    let count = data.requestCount || 0;
    if (now - windowStart > CONFIG.rateLimit.windowMs) { windowStart = now; count = 0; }
    count += 1;

    if (count > CONFIG.rateLimit.max) {
      tx.set(ref, {
        requestCount: 0, windowStart: now,
        blacklistedUntil: now + CONFIG.rateLimit.blacklistMs,
        blacklistReason: "rate_limit_exceeded",
        firstSeen: data.firstSeen || now,
      }, { merge: true });
      return { allowed: false, blacklisted: true, retryAfter: Math.ceil(CONFIG.rateLimit.blacklistMs / 1000), limit: CONFIG.rateLimit.max, remaining: 0 };
    }

    tx.set(ref, {
      requestCount: count, windowStart,
      blacklistedUntil: null, blacklistReason: null,
      firstSeen: data.firstSeen || now,
    }, { merge: true });

    return { allowed: true, limit: CONFIG.rateLimit.max, remaining: CONFIG.rateLimit.max - count, resetAt: windowStart + CONFIG.rateLimit.windowMs };
  });
}

async function throttleUpstream() {
  const db = getDb();
  const now = Date.now();

  if (now - memUpstreamLock >= CONFIG.upstream.minGapMs) {
    memUpstreamLock = now;
    if (db) { try { await db.collection("system").doc("upstream_lock").set({ lastCallAt: now }, { merge: true }); } catch { /* silent */ } }
    return;
  }

  if (db) {
    const ref = db.collection("system").doc("upstream_lock");
    const deadline = Date.now() + CONFIG.upstream.maxWaitMs;
    while (Date.now() < deadline) {
      const result = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const lastAt = snap.exists ? (snap.data().lastCallAt || 0) : 0;
        const elapsed = Date.now() - lastAt;
        if (elapsed >= CONFIG.upstream.minGapMs) {
          const stamp = Date.now();
          tx.set(ref, { lastCallAt: stamp }, { merge: true });
          memUpstreamLock = stamp;
          return { acquired: true };
        }
        return { acquired: false, waitMs: CONFIG.upstream.minGapMs - elapsed };
      });
      if (result.acquired) return;
      await new Promise((r) => setTimeout(r, Math.min(result.waitMs + 40, 400)));
    }
    throw new Error("UPSTREAM_THROTTLE_TIMEOUT");
  }

  const waitMs = CONFIG.upstream.minGapMs - (now - memUpstreamLock);
  await new Promise((r) => setTimeout(r, waitMs));
  memUpstreamLock = Date.now();
}

function getCached(key) {
  const rec = memCache.get(key);
  if (!rec) return null;
  if (Date.now() > rec.expiresAt) { memCache.delete(key); return null; }
  return rec.payload;
}
function setCached(key, payload, ttlMs = CONFIG.cache.ttlMs) { memCache.set(key, { payload, expiresAt: Date.now() + ttlMs }); }
function deleteCached(key) { memCache.delete(key); }

async function maildropGraphQL(query) {
  const res = await fetch(MAILDROP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query }),
    cache: "no-store",
  });
  const text = await res.text();
  let parsed;
  try { parsed = text ? JSON.parse(text) : {}; } catch { throw new Error("Maildrop returned non-JSON response."); }
  if (parsed && parsed.errors && parsed.errors.length) {
    throw new Error(parsed.errors.map((e) => (e && e.message) || "Maildrop error").join("; "));
  }
  return parsed && parsed.data;
}

async function handler(req, res) {
  if (req.method === "OPTIONS") return handleOptions(req, res);
  return send(res, 404, { ok: false, error: { code: "NOT_FOUND", message: "This endpoint does not exist." } });
}

handler.CONFIG = CONFIG;
handler.MAILDROP_URL = MAILDROP_URL;
handler.firebaseEnabled = firebaseEnabled;
handler.getDb = getDb;
handler.handleOptions = handleOptions;
handler.send = send;
handler.getClientIP = getClientIP;
handler.safeDocId = safeDocId;
handler.validMailbox = validMailbox;
handler.validId = validId;
handler.bumpGlobalCounter = bumpGlobalCounter;
handler.checkRateLimit = checkRateLimit;
handler.throttleUpstream = throttleUpstream;
handler.getCached = getCached;
handler.setCached = setCached;
handler.deleteCached = deleteCached;
handler.maildropGraphQL = maildropGraphQL;

module.exports = handler;



