/**
 * GET /api/news/nationwide?country=United%20States
 * Free Google News RSS → JSON (Cloudflare Pages Function).
 */
const COUNTRY_CEID = {
  "United States": { gl: "US", hl: "en-US", ceid: "US:en" },
  Canada: { gl: "CA", hl: "en-CA", ceid: "CA:en" },
  "United Kingdom": { gl: "GB", hl: "en-GB", ceid: "GB:en" },
  Mexico: { gl: "MX", hl: "es-419", ceid: "MX:es-419" },
  India: { gl: "IN", hl: "en-IN", ceid: "IN:en" },
};

function pickCountry(name) {
  const key = name || "United States";
  return COUNTRY_CEID[key] || COUNTRY_CEID["United States"];
}

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

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const country = url.searchParams.get("country") || "United States";
  const { gl, hl, ceid } = pickCountry(country);
  const rssUrl = `https://news.google.com/rss?hl=${encodeURIComponent(hl)}&gl=${encodeURIComponent(gl)}&ceid=${encodeURIComponent(ceid)}`;

  try {
    const res = await fetch(rssUrl, {
      headers: { "User-Agent": "CognationNewsBot/1.0" },
    });
    if (!res.ok) {
      return Response.json(
        { ok: false, error: `upstream ${res.status}`, country, items: [] },
        { status: 502 }
      );
    }
    const xml = await res.text();
    const items = parseRss(xml);
    return Response.json(
      {
        ok: true,
        edition: "nationwide",
        country,
        source: "Google News RSS",
        fetchedAt: new Date().toISOString(),
        items,
        seedPosts: items.slice(0, 12).map((it, i) => ({
          id: `gn-nat-${Date.now().toString(36)}-${i}`,
          authorName: it.source || "National Desk",
          kind: "news",
          source: `Google News · ${country}`,
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
      { ok: false, error: String(err && err.message ? err.message : err), country, items: [] },
      { status: 500 }
    );
  }
}
