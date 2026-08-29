#!/usr/bin/env python3
"""Judge shortlisted terms with an LLM, using the sentences they actually
appear in.

The corpus scorer answers a proxy question — is this term rare in English and
prominent here — using hand-tuned constants that nobody has validated. It
cannot answer the real question, which is whether a reader of *this* page,
with *this* audience, would need *this* term defined. That needs judgment.

So: scorer as retrieval, LLM as rerank.

    python3 scripts/score-corpus.py --corpus ./pages --packs seo-core \\
            --per-1000-words 40 --emit shortlist.json
    ANTHROPIC_API_KEY=... python3 scripts/judge-terms.py \\
            --corpus ./pages --shortlist shortlist.json \\
            --audience "mid-market SEO managers" --emit judged.json

Three properties that matter more than the prompt:

1. The LLM never runs at page load. It runs once, at onboarding, and its
   output is frozen into a static pack. Runtime stays fully deterministic.

2. Every verdict is cached on a hash of its exact inputs, so a rerun costs
   nothing and returns identical results. Non-determinism is confined to the
   first time a given term-and-context pair is seen.

3. Every verdict carries a one-line reason, so the output is reviewable rather
   than an oracle. A human disagreeing with a call is the point.

Only the shortlist is judged. Sending 660 terms x every page would be
expensive and mostly wasted on terms that never appear.
"""

import argparse, json, os, re, sys, glob, hashlib, time, urllib.request
from collections import defaultdict

MODEL = "claude-sonnet-4-6"
API = "https://api.anthropic.com/v1/messages"
SKIP_TAGS = r"a|h1|h2|h3|pre|code|kbd|samp|script|style|nav|footer|header"


def prose_of(html):
    html = re.sub(r"<!--.*?-->", " ", html, flags=re.S)
    m = re.search(r"<main[^>]*>(.*?)</main>", html, flags=re.S | re.I)
    body = m.group(1) if m else html
    body = re.sub(r"<(%s)\b[^>]*>.*?</\1>" % SKIP_TAGS, " ", body, flags=re.S | re.I)
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", body)).strip()


def sentences_for(term, corpus_sentences, limit=3):
    """Real sentences the term appears in. Judging a term in isolation is a
    different and easier question than judging it in the prose it lives in —
    a term can be obscure in general and obvious from its surrounding sentence."""
    b = r"\b" if re.match(r"^[\w][\w.\-]*$", term) else ""
    pat = re.compile(b + re.escape(term) + b, re.I if len(term) > 4 else 0)
    seen, hits = set(), []
    for s in corpus_sentences:
        if not pat.search(s):
            continue
        # Boilerplate repeats verbatim across pages. Three copies of the same
        # sentence tells the model nothing an one copy does not, and crowds out
        # the varied context that would.
        norm = re.sub(r"\W+", " ", s.lower()).strip()
        if norm in seen:
            continue
        seen.add(norm)
        hits.append(s)
    hits.sort(key=len)                      # mid-length sentences carry the most context
    mid = hits[len(hits) // 4: len(hits) // 4 + limit] or hits[:limit]
    return [s[:300] for s in mid]


PROMPT = """You are deciding which terms on a website should get an inline definition card.

A card is worth showing when a reader of this site would plausibly not know the term, or would know it only vaguely, and understanding it matters for following the argument. A card is NOT worth showing when the audience obviously already knows the term, when the surrounding sentence already makes it clear, or when it is ordinary English rather than domain vocabulary.

Marking too many terms is a real cost: the page starts to look like spam and readers stop trusting it. Be willing to cut.

Site audience: {audience}
Site subject: {subject}

For each term below you are given its definition and up to three real sentences from the site where it appears.

Return ONLY a JSON array, no preamble and no markdown fences. One object per term, in the same order:
[{{"term": "...", "keep": true, "confidence": 0.0-1.0, "reason": "under 15 words"}}]

Terms:
{terms}"""


def call_api(key, prompt, retries=3):
    body = json.dumps({
        "model": MODEL,
        "max_tokens": 4000,
        "messages": [{"role": "user", "content": prompt}],
    }).encode()
    for attempt in range(retries):
        try:
            r = urllib.request.Request(API, data=body, method="POST")
            r.add_header("x-api-key", key)
            r.add_header("anthropic-version", "2023-06-01")
            r.add_header("content-type", "application/json")
            with urllib.request.urlopen(r, timeout=120) as resp:
                data = json.loads(resp.read())
            text = "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text")
            text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
            return json.loads(text)
        except Exception as e:
            if attempt == retries - 1:
                raise
            time.sleep(2 ** attempt)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus", required=True)
    ap.add_argument("--shortlist", required=True, help="pack emitted by score-corpus.py")
    ap.add_argument("--audience", required=True, help='e.g. "mid-market SEO managers"')
    ap.add_argument("--subject", default="", help="what the site is about")
    ap.add_argument("--emit", help="write the kept pack here")
    ap.add_argument("--review", help="write a reviewable CSV of every verdict here")
    ap.add_argument("--cache", default=".judge-cache.json")
    ap.add_argument("--batch", type=int, default=12)
    ap.add_argument("--min-confidence", type=float, default=0.0,
                    help="treat verdicts below this as keep, since a low-confidence "
                         "cut is a guess and cutting is the destructive direction")
    args = ap.parse_args()

    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        sys.exit("set ANTHROPIC_API_KEY")

    pack = json.load(open(args.shortlist))
    terms = pack["hasDefinedTerm"]

    corpus_sentences = []
    for f in sorted(glob.glob(os.path.join(args.corpus, "**", "*.html"), recursive=True)):
        text = prose_of(open(f, encoding="utf-8", errors="replace").read())
        corpus_sentences += [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if 40 < len(s) < 400]

    cache = {}
    if os.path.exists(args.cache):
        cache = json.load(open(args.cache))

    # Cache on the exact inputs, so a rerun is free and returns the same answer.
    # Non-determinism is confined to the first sight of a term-and-context pair.
    def key_for(t, samples):
        blob = json.dumps([t["name"], t.get("description", ""), args.audience,
                           args.subject, samples], sort_keys=True)
        return hashlib.sha1(blob.encode()).hexdigest()[:16]

    pending, prepared = [], {}
    for t in terms:
        samples = sentences_for(t["name"], corpus_sentences)
        prepared[t["name"]] = samples
        k = key_for(t, samples)
        if k not in cache:
            pending.append(t)

    print("%d shortlisted, %d cached, %d to judge" %
          (len(terms), len(terms) - len(pending), len(pending)))

    for i in range(0, len(pending), args.batch):
        chunk = pending[i:i + args.batch]
        block = ""
        for t in chunk:
            block += "\n- %s: %s\n" % (t["name"], t.get("description", ""))
            for s in prepared[t["name"]]:
                block += "    in context: %s\n" % s
            if not prepared[t["name"]]:
                block += "    (no sample sentences found)\n"
        out = call_api(key, PROMPT.format(audience=args.audience,
                                          subject=args.subject or "not specified",
                                          terms=block))
        by_name = {str(o.get("term", "")).lower(): o for o in out}
        for t in chunk:
            o = by_name.get(t["name"].lower())
            if not o:
                # A term the model skipped is not a cut. Default to keeping and
                # flag it, rather than silently dropping on a formatting slip.
                o = {"keep": True, "confidence": 0.0, "reason": "no verdict returned"}
            cache[key_for(t, prepared[t["name"]])] = o
        json.dump(cache, open(args.cache, "w"), indent=1)
        print("  judged %d/%d" % (min(i + args.batch, len(pending)), len(pending)))

    rows = []
    for t in terms:
        v = cache[key_for(t, prepared[t["name"]])]
        keep = bool(v.get("keep", True))
        conf = float(v.get("confidence", 0))
        if not keep and conf < args.min_confidence:
            keep, v = True, dict(v, reason=v.get("reason", "") + " [low-confidence cut overridden]")
        rows.append({"term": t["name"], "keep": keep, "confidence": conf,
                     "reason": v.get("reason", ""), "node": t})

    rows.sort(key=lambda r: (r["keep"], r["confidence"]), reverse=True)
    kept = [r for r in rows if r["keep"]]

    print("\n%-26s %-5s %5s  %s" % ("term", "keep", "conf", "reason"))
    print("-" * 90)
    for r in rows:
        print("%-26s %-5s %5.2f  %s" % (r["term"][:26], "yes" if r["keep"] else "no",
                                        r["confidence"], r["reason"][:44]))
    print("\n%d kept, %d cut" % (len(kept), len(rows) - len(kept)))

    if args.review:
        import csv
        with open(args.review, "w", newline="") as fh:
            w = csv.writer(fh)
            w.writerow(["term", "keep", "confidence", "reason"])
            for r in rows:
                w.writerow([r["term"], r["keep"], r["confidence"], r["reason"]])
        print("wrote", args.review)

    if args.emit:
        out = dict(pack, hasDefinedTerm=[r["node"] for r in kept])
        out["description"] = (pack.get("description", "") +
                              " Reranked by judge-terms.py for audience: %s." % args.audience)
        json.dump(out, open(args.emit, "w"), indent=2, ensure_ascii=False)
        print("wrote %s (%d terms)" % (args.emit, len(kept)))


if __name__ == "__main__":
    main()
