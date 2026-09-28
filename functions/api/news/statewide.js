/**
 * GET /api/news/statewide?state=Texas&country=United%20States
 * Google News RSS search for a state or region derived from the browser
 * location service. This function does not read a signup State field.
 */
const COUNTRY_CEID = {
  "United States": { gl: "US", hl: "en-US", ceid: "US:en" },
  Canada: { gl: "CA", hl: "en-CA", ceid: "CA:en" },
  "United Kingdom": { gl: "GB", hl: "en-GB", ceid: "GB:en" },
  Mexico: { gl: "MX", hl: "es-419", ceid: "MX:es-419" },
  India: { gl: "IN", hl: "en-IN", ceid: "IN:en" },
};

function pickCountry(name) {
  return COUNTRY_CEID[name] || COUNTRY_CEID["United States"];
}

function parseRss(xml) {
  const items = [];
  const parts = String(xml || "").split(/<item>/i).slice(1);
  for (const part of parts.slice(0, 20)) {
    const title = (part.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/i) ||
      part.match(/<title>(.*?)<\/title>/i) || [, ""])[1];
    const link = (part.match(/<link>(.*?)<\/link>/i) || [, ""])[1];
    const pubDate = (part.match(/<pubDate>(.*?)<\/pubDate>/i) || [, ""])[1];
    const source = (part.match(/<source[^>]*>(.*?)<\/source>/i) || [, ""])[1];
    const desc = (part.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/i) ||
      part.match(/<description>(.*?)<\/description>/i) || [, ""])[1];
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
  const state = String(url.searchParams.get("state") || "").trim().slice(0, 80);
  const country = String(url.searchParams.get("country") || "United States").trim().slice(0, 80);
  if (!state) {
    return Response.json(
      { ok: false, error: "state required", state: "", country, items: [], seedPosts: [] },
      { status: 400 }
    );
  }
  const { gl, hl, ceid } = pickCountry(country);
  const q = state + " " + country;
  const rssUrl =
    "https://news.google.com/rss/search?q=" +
    encodeURIComponent(q) +
    "&hl=" +
    encodeURIComponent(hl) +
    "&gl=" +
    encodeURIComponent(gl) +
    "&ceid=" +
    encodeURIComponent(ceid);

  try {
    const res = await fetch(rssUrl, {
      headers: { "User-Agent": "CognationNewsBot/1.0" },
    });
    if (!res.ok) {
      return Response.json(
        { ok: false, error: "upstream " + res.status, state, country, items: [], seedPosts: [] },
        { status: 502 }
      );
    }
    const items = parseRss(await res.text());
    return Response.json(
      {
        ok: true,
        edition: "statewide",
        state,
        country,
        source: "Google News RSS",
        fetchedAt: new Date().toISOString(),
        items,
        seedPosts: items.slice(0, 12).map((it, i) => ({
          id: "gn-state-" + Date.now().toString(36) + "-" + i,
          authorName: it.source || "State Desk",
          kind: "news",
          source: "Google News · " + state,
          body:
            it.title +
            (it.summary ? " — " + it.summary : "") +
            (it.link ? " Source: " + it.link : ""),
          createdAt: it.pubDate ? new Date(it.pubDate).toISOString() : new Date().toISOString(),
          seeded: true,
          place: state,
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
      { ok: false, error: "fetch failed", state, country, items: [], seedPosts: [] },
      { status: 502 }
    );
  }
}
