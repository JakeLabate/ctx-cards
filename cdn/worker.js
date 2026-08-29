/* ctx-cards CDN edge — cdn.jakelabate.com/context-cards/*
 *
 * Serves the tagged build from one custom domain instead of jsDelivr, so the
 * URL on a customer's page belongs to you.
 *
 * It proxies GitHub raw at a pinned ref rather than storing copies, which keeps
 * the repo as the single source of truth: cutting a tag publishes it, with no
 * separate upload step that could drift from the release. GitHub is only hit on
 * a cold cache — tagged paths are immutable, so each edge fetches once and then
 * serves from cache indefinitely.
 *
 *   /context-cards/v0.10.0/dist/ctx.min.js
 *   /context-cards/v0.10.0/packs/seo-core.json
 *   /context-cards/v0.10.0/sites/jakelabate.json
 *
 * The script derives its pack URLs from its own src by swapping /dist/<file>
 * for /packs, so a pinned script tag automatically pins its packs to the same
 * ref. Nothing extra to configure.
 */

const REPO = "JakeLabate/ctx-cards";
const PREFIX = "/context-cards/";

// Only these directories are reachable. Without an allowlist this Worker would
// be an open proxy for anything in the repo, on your domain, with your CORS.
const DIRS = new Set(["dist", "packs", "sites"]);

// A tag is immutable, so it can be cached forever. A branch is not, so it gets
// a short TTL — long enough to be useful, short enough that a fix propagates.
const TAG = /^v\d+\.\d+\.\d+$/;
const BRANCH = /^(main|latest)$/;

const TYPES = {
  js: "application/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  sri: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
};

function cors(extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "X-Content-Type-Options": "nosniff",
    ...extra,
  };
}

function fail(status, message) {
  return new Response(message + "\n", {
    status,
    headers: cors({ "Content-Type": "text/plain; charset=utf-8" }),
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors() });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return fail(405, "Method not allowed");
    }

    if (url.pathname === "/" || url.pathname === PREFIX) {
      return new Response(
        `ctx-cards CDN\n\n` +
        `  ${url.origin}${PREFIX}v0.10.0/dist/ctx.min.js\n` +
        `  ${url.origin}${PREFIX}v0.10.0/packs/seo-core.json\n\n` +
        `Source: https://github.com/${REPO}\n`,
        { status: 200, headers: cors({ "Content-Type": "text/plain; charset=utf-8" }) }
      );
    }

    if (!url.pathname.startsWith(PREFIX)) return fail(404, "Not found");

    const parts = url.pathname.slice(PREFIX.length).split("/").filter(Boolean);
    if (parts.length < 3) return fail(404, "Expected /context-cards/<ref>/<dir>/<file>");

    const [ref, dir, ...rest] = parts;
    const file = rest.join("/");

    const immutable = TAG.test(ref);
    if (!immutable && !BRANCH.test(ref)) {
      // Refuse arbitrary refs: a ref is part of the upstream URL, so accepting
      // anything here would let a caller reach any commit or branch in the repo.
      return fail(400, "Ref must be a version tag such as v0.10.0, or main");
    }
    if (!DIRS.has(dir)) return fail(404, "Unknown directory");
    if (file.includes("..") || !/^[\w.\-/]+$/.test(file)) return fail(400, "Bad path");

    const cache = caches.default;
    const cacheKey = new Request(url.toString(), { method: "GET" });
    const hit = await cache.match(cacheKey);
    if (hit) {
      const h = new Headers(hit.headers);
      h.set("X-Cache", "HIT");
      return new Response(hit.body, { status: hit.status, headers: h });
    }

    const upstream = `https://raw.githubusercontent.com/${REPO}/${ref}/${dir}/${file}`;
    let res;
    try {
      res = await fetch(upstream, { cf: { cacheEverything: true } });
    } catch (e) {
      return fail(502, "Upstream unreachable");
    }
    if (!res.ok) return fail(res.status === 404 ? 404 : 502, "Upstream " + res.status);

    const ext = file.split(".").pop().toLowerCase();
    const headers = cors({
      "Content-Type": TYPES[ext] || "application/octet-stream",
      "Cache-Control": immutable
        ? "public, max-age=31536000, immutable"
        : "public, max-age=300, stale-while-revalidate=86400",
      "X-Cache": "MISS",
      "X-Source": upstream,
    });

    const body = await res.arrayBuffer();
    const out = new Response(body, { status: 200, headers });
    // Only immutable responses are worth storing; a branch ref would go stale.
    if (immutable) ctx.waitUntil(cache.put(cacheKey, out.clone()));
    return out;
  },
};
