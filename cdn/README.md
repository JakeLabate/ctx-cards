# ctx-cards CDN

Serves the tagged build from `cdn.jakelabate.com/context-cards/*` so the URL on
a customer's page belongs to you rather than to jsDelivr.

```
https://cdn.jakelabate.com/context-cards/v0.10.0/dist/ctx.min.js
https://cdn.jakelabate.com/context-cards/v0.10.0/packs/seo-core.json
https://cdn.jakelabate.com/context-cards/v0.10.0/sites/jakelabate.json
```

## How it works

The Worker proxies `raw.githubusercontent.com` at a pinned ref rather than
storing its own copies. The repo stays the single source of truth: cutting a
tag publishes it, with no upload step that could drift from the release.

Tagged paths are immutable and cached with `max-age=31536000, immutable`, so
each edge fetches from GitHub once and serves from cache after that. `main` is
allowed for testing with a 5 minute TTL and is not stored in the edge cache.

The script derives its pack URLs by swapping `/dist/<file>` for `/packs` in its
own `src`, so a pinned script tag pins its packs to the same ref automatically.

## Deploy

Requires `jakelabate.com` to already be a zone in the Cloudflare account.

```bash
cd cdn
npx wrangler deploy
```

Wrangler creates the `cdn.jakelabate.com` DNS record on first deploy from the
`routes` block in `wrangler.toml`. If the record already exists as an A or
CNAME, delete it first — a Worker route and a proxied DNS record on the same
hostname conflict.

Verify:

```bash
curl -I https://cdn.jakelabate.com/context-cards/v0.10.0/dist/ctx.min.js
curl -s https://cdn.jakelabate.com/context-cards/v0.10.0/packs/index.json | head -c 200
```

Expect `cache-control: public, max-age=31536000, immutable` and `x-cache: MISS`
on the first request, `HIT` on the second.

## The script tag

```html
<script src="https://cdn.jakelabate.com/context-cards/v0.10.0/dist/ctx.min.js"
        integrity="sha384-…"
        crossorigin="anonymous"
        data-packs="seo-core"
        defer></script>
```

The SRI hash is unchanged by the move: the bytes are identical, only the
hostname differs. `dist/ctx.min.js.sri` in the repo holds the current value.

## What is deliberately restricted

Only `dist/`, `packs/`, and `sites/` are reachable, and a ref must be a
`vN.N.N` tag or `main`. Without those two limits the Worker would be an open
proxy for any file at any commit in the repo, served from your domain under
your permissive CORS header.

Paths containing `..` or characters outside `[\w.\-/]` are rejected.

## Cutting a release

Nothing to do here. Tag the repo and the new version is live at the new path
immediately, because tags resolve on first request. Old tags keep working
forever, which is what lets a customer pin a version and not be moved off it.
