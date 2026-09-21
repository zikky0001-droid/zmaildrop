export default function handler(req, res) {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = Array.isArray(forwarded)
    ? forwarded[0]
    : String(forwarded || req.headers["x-real-ip"] || "").split(",")[0].trim();

  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ ip: ip || "Unavailable" });
}
