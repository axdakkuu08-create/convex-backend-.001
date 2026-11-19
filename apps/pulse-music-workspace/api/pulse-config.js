// Vercel serverless endpoint for browser-safe public configuration only.
module.exports = function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }
  res.statusCode = 200;
  res.end(
    JSON.stringify({
      convexUrl: process.env.PULSE_CONVEX_URL || "",
      clerkPublishableKey: process.env.PULSE_CLERK_PUBLISHABLE_KEY || "",
    }),
  );
};
