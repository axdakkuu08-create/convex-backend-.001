module.exports = async function handler(req, res) {
  const rawCountry = String(req.query?.country || "in").trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(rawCountry)) {
    res.status(400).json({ error: "Country must be a two-letter Apple storefront code." });
    return;
  }
  try {
    const upstream = await fetch(
      "https://rss.applemarketingtools.com/api/v2/" +
        encodeURIComponent(rawCountry) +
        "/music/most-played/25/songs.json",
      { headers: { Accept: "application/json" } },
    );
    if (!upstream.ok) {
      res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
      res.status(502).json({ error: "Apple Music chart feed is temporarily unavailable." });
      return;
    }
    const payload = await upstream.json();
    const results = payload?.feed?.results;
    if (!Array.isArray(results)) {
      res.status(502).json({ error: "Apple Music returned an invalid chart response." });
      return;
    }
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=900, stale-while-revalidate=3600");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(200).json({
      source: "Apple Music public Marketing Tools RSS",
      country: rawCountry,
      updatedAt: payload?.feed?.updated || null,
      refreshedAt: new Date().toISOString(),
      results,
    });
  } catch (_) {
    res.setHeader("Cache-Control", "no-store");
    res.status(502).json({ error: "Unable to retrieve the official Apple Music chart." });
  }
};
