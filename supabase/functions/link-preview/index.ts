// Bridge — link-preview (v137)
// The browser cannot read another site's HTML (CORS), so this fetches the page server-side and returns the
// Open Graph / title / description / image for a chat link card. Signed-in Bridge users only (verify_jwt).
// Safety: http(s) only, public hosts only (no localhost / private ranges), 6 s timeout, first 300 KB of HTML.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "public, max-age=86400" } });
}
function blockedHost(h: string): boolean {
  h = h.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return true;
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(h);
  if (m) {
    const a = +m[1], b = +m[2];
    if (a === 10 || a === 127 || a === 0 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254)) return true;
  }
  if (h.includes(":")) return true; // no raw IPv6
  return false;
}
function meta(html: string, keys: string[]): string {
  for (const k of keys) {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]*content=["']([^"']*)["']`, "i");
    const m = re.exec(html); if (m && m[1]) return decode(m[1]);
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${k}["']`, "i");
    const m2 = re2.exec(html); if (m2 && m2[1]) return decode(m2[1]);
  }
  return "";
}
function decode(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).trim();
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  let url = "";
  try { const b = await req.json(); url = String(b.url || ""); } catch { /* empty */ }
  if (!/^https?:\/\//i.test(url)) return json({ error: "bad url" }, 400);
  let u: URL; try { u = new URL(url); } catch { return json({ error: "bad url" }, 400); }
  if (blockedHost(u.hostname)) return json({ error: "blocked" }, 400);
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch(u.toString(), { redirect: "follow", signal: ctl.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; BridgeLinkPreview/1.0; +https://bloomingbox.com)", "Accept": "text/html,*/*;q=0.8" } });
    const ct = r.headers.get("content-type") || "";
    if (ct.startsWith("image/")) return json({ url, image: u.toString(), title: u.hostname, site: u.hostname });
    if (!/text\/html|application\/xhtml/i.test(ct)) return json({ url, title: u.hostname, site: u.hostname });
    const reader = r.body?.getReader(); let html = ""; const dec = new TextDecoder();
    if (reader) { while (html.length < 300000) { const { value, done } = await reader.read(); if (done) break; html += dec.decode(value, { stream: true }); } try { reader.cancel(); } catch { /* */ } }
    const title = meta(html, ["og:title", "twitter:title"]) || decode((/<title[^>]*>([^<]*)<\/title>/i.exec(html) || [])[1] || "");
    const description = meta(html, ["og:description", "twitter:description", "description"]);
    let image = meta(html, ["og:image", "og:image:url", "twitter:image", "twitter:image:src"]);
    if (image && !/^https?:\/\//i.test(image)) { try { image = new URL(image, u).toString(); } catch { image = ""; } }
    const site = meta(html, ["og:site_name"]) || u.hostname.replace(/^www\./, "");
    return json({ url, title: title.slice(0, 160), description: description.slice(0, 240), image, site });
  } catch (e) {
    return json({ url, title: u.hostname, site: u.hostname, error: String(e).slice(0, 80) });
  } finally { clearTimeout(t); }
});
