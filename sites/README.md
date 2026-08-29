# Site packs

Generated packs, trimmed to one site's actual content by
`scripts/score-corpus.py`. Unlike `packs/`, these are not built by
`build-packs.py` and are not reproducible from source data in this repo — they
depend on a crawl of the site they were generated from.

Load one by absolute URL:

```html
<script src="https://cdn.jsdelivr.net/gh/JakeLabate/ctx-cards@v0.7.0/dist/ctx.min.js"
        data-packs="https://cdn.jsdelivr.net/gh/JakeLabate/ctx-cards@v0.7.0/sites/jakelabate.json"
        defer></script>
```

The pack's `description` records how it was generated, including the density
target and any `--keep` overrides, so a surprising inclusion or omission can be
traced without rerunning the scorer.
