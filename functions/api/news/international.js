/**
 * GET /api/news/international
 * Free Google News RSS (World) → JSON for International COMMUNE.
 */
function parseRss(xml) {
  const items = [];
  const parts = xml.split(/<item>/i).slice(1);
  for (const part of parts.slice(0, 20)) {
    const title = (part.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/i) ||
      part.match(/<title>(.*?)<\/title>/i) || [,""])[1];
    const link = (part.match(/<link>(.*?)<\/link>/i) || [,""])[1];
    const pubDate = (part.match(/<pubDate>(.*?)<\/pubDate>/i) || [,""])[1];
    const source = (part.match(/<source[^>]*>(.*?)<\/source>/i) || [,""])[1];
    const desc = (part.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/i) ||
      part.match(/<description>(.*?)<\/description>/i) || [,""])[1];
    if (!title) continue;
    items.push({
      title: title.trim(),
      link: link.trim(),
      pubDate: pubDate.trim(),
      source: source.trim() || "Google News",
      summary: desc.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400),
    });
  }
  return items;
}

export async function onRequestGet() {
  const rssUrl =
    "https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-US&gl=US&ceid=US:en";
  try {
    const res = await fetch(rssUrl, {
      headers: { "User-Agent": "CognationNewsBot/1.0" },
    });
    if (!res.ok) {
      return Response.json(
        { ok: false, error: `upstream ${res.status}`, items: [] },
        { status: 502 }
      );
    }
    const xml = await res.text();
    const items = parseRss(xml);
    return Response.json(
      {
        ok: true,
        edition: "international",
        source: "Google News RSS · World",
        fetchedAt: new Date().toISOString(),
        items,
        seedPosts: items.slice(0, 12).map((it, i) => ({
          id: `gn-intl-${Date.now().toString(36)}-${i}`,
          authorName: it.source || "World Desk",
          kind: "news",
          source: "Google News · International",
          body: `${it.title}${it.summary ? " — " + it.summary : ""}${it.link ? " Source: " + it.link : ""}`,
          createdAt: it.pubDate ? new Date(it.pubDate).toISOString() : new Date().toISOString(),
          seeded: true,
        })),
      },
      {
        headers: {
          "Cache-Control": "public, max-age=900",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (err) {
    return Response.json(
      { ok: false, error: String(err && err.message ? err.message : err), items: [] },
      { status: 500 }
    );
  }
}
