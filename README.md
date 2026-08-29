# ctx-cards

Contextual definition cards for the web, driven by schema.org `DefinedTermSet`.

One script tag marks terms in your prose and shows a card on hover or tap. The
definitions come from JSON-LD on the page, so search engines and retrieval
systems read the same source your readers do. No page text is sent anywhere.

**7.9 KB gzipped. No dependencies. No network calls unless you load a pack.**

---

## Install

```html
<script src="https://cdn.jsdelivr.net/gh/JakeLabate/ctx-cards@v0.1.0/dist/ctx.min.js"
        data-packs="seo-core"
        data-scope="main"
        data-style="minimal"
        defer></script>
```

That is the whole install. `seo-core` gives you 40 terms immediately with
nothing authored.

Pin the version. `@v0.1.0` is served immutably by jsDelivr and the script
derives its pack URLs from its own `src`, so pinning the tag pins the packs too.

---

## Options

| Attribute | Default | Notes |
|---|---|---|
| `data-scope` | `main, article` | Selector for the content root to scan. |
| `data-style` | `minimal` | `minimal`, `paper`, or `contrast`. |
| `data-packs` | none | Comma-separated pack ids or absolute URLs. |
| `data-pack-base` | derived from `src` | Override where packs are fetched from. |
| `data-ignore` | `pre, code, kbd, samp, a, h1, h2, h3, [data-no-ctx]` | Selectors never marked. |
| `data-repeat` | `first` | `first` marks one occurrence per term; `all` marks every occurrence. |
| `data-max-per-term` | unset | A number. Overrides `data-repeat` with an explicit cap. |
| `data-analytics` | off | `auto` forwards to the analytics already on your page; a URL posts batches to your own collector. |

### Repeating a term

By default a term is marked once per page, on its first occurrence. Set
`data-repeat="all"` to mark every occurrence instead:

```html
<script src="…/ctx.min.js" data-repeat="all" defer></script>
```

For a middle ground, `data-max-per-term="3"` caps each term at three
occurrences and overrides `data-repeat` entirely.

**Occurrences inside ignored elements never count.** A term appearing in a
linked heading, a nav item, a `<code>` block, or anywhere else matched by
`data-ignore` is not a candidate, so it neither gets marked nor consumes the
budget under `first`. The first *markable* occurrence in body prose is the one
that gets the card.

Which to choose:

- **`first`** suits articles and documentation, where a reader meets a term
  once and a second underline on the same word is noise.
- **`all`** suits long reference pages and pages a reader enters mid-scroll,
  where the first occurrence may be far above where they started reading.

`all` marks more of the page, so it also creates more visual texture. On a
term-dense page it can start to look like a spam-linked article. Try it on
your longest page before enabling it site-wide.

The card follows the page. It samples your content background's luminance and
picks a light or dark palette from that, rather than trusting the visitor's OS
setting, so a light site stays light for a visitor in dark mode.

---

## Packs

| Pack | Terms | Covers |
|---|---|---|
| `seo-core` | 100 | Search, technical SEO, structured data, GEO. Load on every site. |
| `agentic-ai` | 25 | MCP, WebMCP, A2A, UCP, ACP, NLWeb, and agent vocabulary. |
| `ecommerce` | 56 | Catalog, merchandising, fulfilment, conversion, agentic commerce. |
| `saas` | 54 | Subscription metrics, APIs, developer experience, procurement. |
| `finance` | 53 | Lending, investing, compliance, business finance. |
| `healthcare` | 47 | Payers, systems, standards, research. Industry terms only. |
| `legal` | 50 | Contracts, disputes, IP, data protection. |
| `insurance` | 40 | Coverage, claims, underwriting, distribution. |
| `real-estate` | 40 | Residential, commercial, and local property search. |
| `home-services` | 38 | Trades, local search, field operations. |
| `manufacturing` | 40 | Production, quality, supply chain, industrial B2B. |
| `hospitality` | 38 | Hotels, restaurants, distribution, revenue management. |
| `education` | 40 | Higher ed, K-12, workforce training, compliance. |
| `automotive` | 39 | Dealership retail, service, EV. |

**660 terms, 149 KB total.** Packs load independently, so a site pulls only
what it needs. 145 acronyms carry a written-out expansion.

Each pack carries a content-hashed `version` so the CDN can cache immutably.

**Precedence, highest first:** page glossary → site glossary → vertical pack →
`seo-core`. A term defined closer to the content always wins, so you override
any pack definition just by putting your own `DefinedTerm` on the page. Packs
load in parallel and a failed pack is skipped rather than blocking the rest.

**Caveat on regulated verticals.** The `healthcare` and `finance` packs contain
industry and marketing vocabulary only. They carry no clinical or financial
advice and must not be treated as a substitute for review by a qualified person.

---

## Analytics

Off unless you set `data-analytics`. Nothing is sent otherwise.

```html
<script src="…/ctx.min.js" data-analytics="auto" defer></script>
```

`auto` forwards events to whatever analytics the page already runs, so there is
no backend to deploy and no new vendor to approve. Detected automatically:
Google Analytics via `gtag` or `dataLayer`, Plausible, PostHog, Umami, and
Fathom. Anything else can hook `window.ctxAnalytics = (name, props) => …`.

To collect the raw stream instead, pass a URL. Events batch and send with
`sendBeacon`, flushing every five seconds, at twenty events, and on page hide.

```html
<script src="…/ctx.min.js"
        data-analytics="https://ctx-collect.example.workers.dev/collect" defer></script>
```

`collector/` holds a reference Cloudflare Worker and D1 schema for that mode.

### Events

| Event | Fires when | Carries |
|---|---|---|
| `mark` | A term is marked on load | term, kind, path |
| `open` | A card is opened | term, kind, path |
| `close` | A card is dismissed | term, kind, path, dwell in ms |
| `follow` | The card's outbound link is clicked | term, kind, path |

`mark` exists to give `open` a denominator. Five opens out of five marked terms
and five out of ninety are very different results, and an open count alone
cannot tell them apart.

Dwell separates a glance from a read. A card dismissed in 300ms answered
nothing; one held for four seconds did. `follow` is the inverse signal: the
card did not finish the job and the reader left anyway, which usually means the
definition is too thin for that term's tier.

### What is not sent

No cookie, no `localStorage`, no visitor id, no session id, no fingerprint, no
IP logging in the reference collector, and no page content of any kind. There
is nothing in the payload that can be joined back to a person, which is what
keeps this outside the scope of consent banners in most jurisdictions.

Because there is no identifier, some questions are unanswerable by design: you
cannot follow one reader across pages or measure per-visitor behaviour. That is
the trade, and it is deliberate — the alternative would turn a script whose
selling point is that page text never leaves the browser into one that needs a
privacy review before install.

`Do Not Track` and Global Privacy Control are both honoured: if either is set,
no event is sent and the cards continue to work normally.

---

## Your own terms

Put a `DefinedTermSet` anywhere on the page:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "DefinedTermSet",
  "hasDefinedTerm": [
    {
      "@type": "DefinedTerm",
      "name": "MCP",
      "alternateName": ["Model Context Protocol"],
      "description": "Standardizes how an AI host discovers tools and resources from external systems.",
      "url": "/protocols/mcp/",
      "termCode": "T2",
      "ctx": { "expansion": "Model Context Protocol" }
    }
  ]
}
</script>
```

`termCode` sets the tier: `T1` renders a bare definition, `T2` adds the link.

`alternateName` is for **matching** — text that actually appears in your prose.
`ctx.expansion` is for **display** — the written-out form of an acronym. They
are different jobs. Nobody writes "Health Insurance Portability and
Accountability Act" in body copy, so it belongs in `expansion`, not
`alternateName`, or it becomes a match target and the useful acronym renders
without its expansion.

### Card kinds

Set `ctx.kind` to change the body. All kinds share the same shell, tail,
entrance, and dismiss behaviour.

| Kind | For |
|---|---|
| `term` | Default. Definition, optional expansion and link. |
| `verdict` | An adjudicated claim. Coloured badge plus evidence rows. |
| `stat` | A measured value with a chart and provenance. |
| `entity` | A person, product, or organization. Avatar and meta rows. |
| `steps` | A numbered procedure. |
| `compare` | Two-column comparison. |
| `quote` | A cited passage with attribution. |
| `code` | A snippet with a caption. |

### Charts

Any card kind can carry `ctx.chart`.

| Type | For | Fields |
|---|---|---|
| `line` | Trend over continuous time | `data` |
| `bars` | Discrete periods | `data` |
| `ring` | One percentage of a whole | `value`, `caption` |
| `progress` | Completion against a target | `value`, `caption` |
| `share` | Composition, stacked to 100% | `data`, `labels` |
| `hbars` | Ranked comparison | `data`, `labels` |
| `range` | Position between two bounds | `min`, `max`, `value` |
| `winloss` | Pass and fail runs | `data` (positive, negative, or zero) |

Always set `alt`. It becomes the chart's accessible label, and it should state
the finding rather than describe the shape.

These are sparklines, not charts. No axes, no tooltips, no interrogation. A
transient card is the wrong container for anything that needs studying — if a
number needs real analysis, the card's job is to link out to it.

---

## Accessibility

Triggers are focusable and keyboard-operable. `Escape` dismisses and returns
focus. Cards are `role="tooltip"` and wired with `aria-describedby`. Charts are
`role="img"` with your `alt` text. All palettes clear WCAG AA for text in both
light and dark, and clear 3:1 for the non-text underline.

Pointer-initiated focus does not open the card, because on touch it fires
alongside `click` and would toggle the card shut on the same tap.

`prefers-reduced-motion` replaces the entrance with a plain fade.

---

## Privacy

The script reads JSON-LD already in your DOM. It sends no page content
anywhere. If you load packs, the only request is a static JSON fetch with
`credentials: 'omit'`.

---

## Development

```bash
python3 scripts/build-packs.py     # rebuild packs from source
npx terser src/ctx.js -c passes=2 -m -o dist/ctx.min.js
python3 -m http.server 8000        # examples/ need http, not file://
```

`examples/` contains four pages: `packs-only.html` (cold start, no glossary),
`verdicts.html`, `card-kinds.html`, and `charts.html`.

## Licence

MIT
