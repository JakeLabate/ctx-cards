# Getting this live

The repo is committed and ready. It has no remote, because I have no GitHub
credentials in this environment. Four commands from you and it is on a CDN.

## 1. Create the repo

Make an empty **public** repo at `github.com/JakeLabate/ctx-cards`. No README,
no licence, no `.gitignore` — this repo already has all three and GitHub's
starter files will only cause a merge conflict.

Public matters: jsDelivr will not serve from a private repo.

## 2. Push

```bash
cd ctx-cards
git remote add origin git@github.com:JakeLabate/ctx-cards.git
git branch -M main
git push -u origin main
```

## 3. Tag the release

```bash
git tag v0.1.0
git push origin v0.1.0
```

jsDelivr serves tags immutably and caches them forever. `@latest` is
convenient for your own testing but must never appear in a customer's tag:
it means their site changes when you publish.

## 4. Verify

```bash
curl -I https://cdn.jsdelivr.net/gh/JakeLabate/ctx-cards@v0.1.0/dist/ctx.min.js
curl -s  https://cdn.jsdelivr.net/gh/JakeLabate/ctx-cards@v0.1.0/packs/seo-core.json | head -c 120
```

First request may take a few seconds while jsDelivr pulls from GitHub. After
that it is edge-cached.

## 5. The customer script tag

```html
<script src="https://cdn.jsdelivr.net/gh/JakeLabate/ctx-cards@v0.1.0/dist/ctx.min.js"
        data-packs="seo-core"
        data-scope="main"
        defer></script>
```

Nothing else. The script derives its pack URLs from its own `src`, so the
pinned version above also pins the packs to `v0.1.0`.

### For jakelabate.com

```html
<script src="https://cdn.jsdelivr.net/gh/JakeLabate/ctx-cards@v0.1.0/dist/ctx.min.js"
        data-packs="seo-core"
        data-style="paper"
        data-scope="main"
        defer></script>
```

`paper` is tuned to your `#fbf7f1`. Add your own `DefinedTermSet` to the page
and it overrides the pack wherever the two disagree.

---

## Cutting the next version

```bash
python3 scripts/build-packs.py    # if packs changed
npm run build                     # rebuild dist/
# bump "version" in package.json and the terser preamble
git commit -am "v0.2.0" && git tag v0.2.0 && git push origin main v0.2.0
```

CI fails the build if `dist/` or `packs/` are stale relative to source, so a
forgotten rebuild cannot ship.

## Before you take money for this

- **Move off jsDelivr.** It is free and genuinely good, but it is someone
  else's uptime on your customers' pages. Fine for launch and early design
  partners. Not fine once a paying customer's site depends on it.
- **Add SRI.** A hash on the script tag means a compromised CDN cannot inject
  code into customer pages. `openssl dgst -sha384 -binary dist/ctx.min.js | openssl base64 -A`
- **Version the pack schema.** Once customers pin packs, the `ctx` field shape
  becomes a contract you cannot casually change.
