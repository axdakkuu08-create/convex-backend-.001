module.exports = async function handler(req, res) {
  const raw = String(req.query?.country || "in").toLowerCase();
  if (!/^[a-z]{2}$/.test(raw)) {
    res.status(400).json({ error: "Invalid country code." });
    return;
  }
  try {
    const upstream = await fetch(
      "https://rss.applemarketingtools.com/api/v2/" +
        encodeURIComponent(raw) +
        "/music/most-played/25/songs.json",
      { headers: { Accept: "application/json" } },
    );
    if (!upstream.ok) {
      res.status(502).json({ error: "Apple chart provider is temporarily unavailable." });
      return;
    }
    const payload = await upstream.json();
    res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(200).json(payload);
  } catch (_) {
    res.status(502).json({ error: "Could not retrieve the official Apple chart feed." });
  }
};
