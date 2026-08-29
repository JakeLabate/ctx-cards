# ctx-cards collector

Optional. Most sites should use `data-analytics="auto"` and let events land in
the analytics they already run. Use this when you want the raw event stream.

## Deploy

The D1 database `ctx-analytics` already exists and its schema is applied, so
`wrangler.toml` is filled in and ready:

```bash
cd collector
npx wrangler deploy
```

That prints a URL like `https://ctx-collect.<subdomain>.workers.dev`. Point the
script at its `/collect` path:

```html
<script src="…/ctx.min.js"
        data-analytics="https://ctx-collect.<subdomain>.workers.dev/collect"
        defer></script>
```

## Reading the data

`GET /stats` returns the last 30 days aggregated by term, with an open rate:

```bash
curl https://ctx-collect.<subdomain>.workers.dev/stats | jq '.[0:10]'
```

Open rate is the number that matters. A term marked 400 times and opened twice
is noise on the page and should probably be dropped from the pack. A term
opened on a third of its impressions is doing real work and may deserve a
richer card kind.

`follow` counts the opposite case: the card was opened and the reader still
clicked through, meaning the definition did not finish the job.

## What is stored

Day, event, term, kind, path, a count, and a running mean dwell. No IP, no
user agent, no referrer, no timestamp beyond the date, and no identifier of any
kind. Rows are upserted rather than appended, so there is no per-hit history
that could be reassembled into a session later.
