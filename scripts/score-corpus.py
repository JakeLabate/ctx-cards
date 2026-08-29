#!/usr/bin/env python3
"""Rank pack terms by how much value each is likely to add on a specific site.

Answers "which terms should this site mark" without needing a single visitor.
Engagement data tells you whether a card was used; this tells you whether it
should exist, which is the more important question and the one you can answer
before launch.

    python3 scripts/score-corpus.py --corpus ./pages --packs seo-core,ecommerce
    python3 scripts/score-corpus.py --corpus ./pages --packs seo-core --emit site-pack.json

Score is three factors multiplied:

  reach      how many pages the term appears on, as a curve rather than a line.
             A term on 2% of pages is niche; on 15% it is a strong candidate;
             on 80% it is house vocabulary the audience already knows.

  obscurity  how rare the term is in general English against how prominent it
             is in this corpus. This is the strongest factor: it directly
             approximates "would a reader of this page not already know this".
             HIPAA is rare in English and frequent in healthcare writing.
             Conversion rate is common in both and needs no card.

  cost       what looking it up elsewhere would cost. An acronym resolves
             cheaply; a term with a contested or vendor-specific meaning does
             not, because a generic search returns the wrong answer.

Two things the score cannot express, applied separately:

  - Terms appearing only inside links and headings are structurally unmarkable
    and are excluded outright, whatever they score.
  - Density is a page property, not a term property. Forty individually
    defensible marks still make a page look spammy, so the output is capped at
    a marks-per-thousand-words budget rather than a score threshold.
"""

import argparse, json, os, re, sys, math, glob
from collections import defaultdict

try:
    from wordfreq import zipf_frequency
except ImportError:
    sys.exit("needs wordfreq:  pip install wordfreq")

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

# Mirrors ctx.js data-ignore. A term living only in these is never a candidate,
# so counting it would overstate its reach.
SKIP_TAGS = r"a|h1|h2|h3|pre|code|kbd|samp|script|style|nav|footer|header|select|button"


def strip_html(html, markable_only=True):
    """Return (markable_text, blocked_text). Crude but matches what the script
    can actually reach: content inside links, headings, and code is excluded."""
    html = re.sub(r"<!--.*?-->", " ", html, flags=re.S)
    main = re.search(r"<main[^>]*>(.*?)</main>", html, flags=re.S | re.I)
    body = main.group(1) if main else html

    blocked = []

    def pull(m):
        blocked.append(m.group(0))
        return " "

    stripped = re.sub(r"<(%s)\b[^>]*>.*?</\1>" % SKIP_TAGS, pull, body, flags=re.S | re.I)
    detag = lambda s: re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s)).strip()
    return detag(stripped), detag(" ".join(blocked))


def load_packs(ids):
    terms = []
    for pid in ids:
        path = os.path.join(ROOT, "packs", pid + ".json")
        if not os.path.exists(path):
            sys.exit("no such pack: " + pid)
        data = json.load(open(path))
        for t in data["hasDefinedTerm"]:
            terms.append({
                "pack": pid,
                "name": t["name"],
                "aliases": t.get("alternateName", []),
                "desc": t.get("description", ""),
                "tier": 1 if t.get("termCode") == "T1" else 2,
                "expansion": (t.get("ctx") or {}).get("expansion"),
                "node": t,
            })
    return terms


def matcher(term):
    pats = [term["name"]] + term["aliases"]
    parts = []
    for p in pats:
        b = r"\b" if re.match(r"^[\w][\w.\-]*$", p) else ""
        parts.append(b + re.escape(p) + b)
    flags = re.I if len(term["name"]) > 4 else 0
    return re.compile("|".join(parts), flags)


def general_familiarity(term):
    """How familiar the term's parts are in ordinary English, on the Zipf scale
    (higher = more common). For a phrase, the rarest content word bounds it: if
    every component is common the phrase is usually guessable from its parts."""
    words = re.findall(r"[a-zA-Z][a-zA-Z\-']+", term["name"])
    words = [w for w in words if len(w) > 2]
    if not words:
        return 2.0
    return min(zipf_frequency(w.lower(), "en") for w in words)


def reach_curve(page_ratio):
    """Peaks around 15% of pages. Below that the term is too rare to matter;
    above ~50% it is site vocabulary the audience has already absorbed."""
    if page_ratio <= 0:
        return 0.0
    x = math.log(page_ratio / 0.15)
    return math.exp(-(x * x) / 2.0)


def lookup_cost(term):
    """What the reader saves by not leaving. Acronyms resolve cheaply once
    expanded; judgment-bearing and ambiguous terms do not."""
    c = 1.0
    if term["expansion"]:
        c += 0.35                                   # opaque until expanded
    words = len(term["desc"].split())
    c += min(words / 40.0, 0.7)                     # long definition = hard concept
    d = term["desc"].lower()
    if any(k in d for k in ("contested", "overloaded", "distinct from",
                            "as opposed to", "not a ", "confirm whether")):
        c += 0.5                                    # a search would mislead
    if term["tier"] == 1:
        c -= 0.2                                    # plain definitions are cheap
    return max(c, 0.4)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus", required=True, help="directory of .html files")
    ap.add_argument("--packs", required=True, help="comma-separated pack ids")
    ap.add_argument("--per-1000-words", type=float, default=6.0,
                    help="density budget: marks allowed per 1000 words of prose")
    ap.add_argument("--emit", help="write a trimmed site-specific pack here")
    ap.add_argument("--top", type=int, default=40, help="rows to print")
    args = ap.parse_args()

    files = sorted(glob.glob(os.path.join(args.corpus, "**", "*.html"), recursive=True))
    if not files:
        sys.exit("no .html found under " + args.corpus)

    terms = load_packs([p.strip() for p in args.packs.split(",")])
    pats = {t["name"]: matcher(t) for t in terms}

    pages_with = defaultdict(int)
    hits = defaultdict(int)
    blocked_only = defaultdict(int)
    total_words = 0
    page_terms = []   # per page: (word count, set of terms present in prose)

    for f in files:
        html = open(f, encoding="utf-8", errors="replace").read()
        prose, blocked = strip_html(html)
        w = len(prose.split())
        total_words += w
        present = set()
        for t in terms:
            n = len(pats[t["name"]].findall(prose))
            if n:
                pages_with[t["name"]] += 1
                hits[t["name"]] += n
                present.add(t["name"])
            elif pats[t["name"]].search(blocked):
                blocked_only[t["name"]] += 1
        page_terms.append((w, present))

    npages = len(files)
    corpus_words = max(total_words, 1)

    rows = []
    for t in terms:
        name = t["name"]
        if not pages_with[name]:
            rows.append(dict(t, score=0.0, reach=0.0, obscurity=0.0, cost=0.0,
                             pages=0, hits=0, blocked=blocked_only[name],
                             why="only in links/headings" if blocked_only[name] else "absent"))
            continue

        ratio = pages_with[name] / npages
        reach = reach_curve(ratio)

        # Prominence here, on the same Zipf scale as general English, so the two
        # are directly comparable: occurrences per billion words, log10.
        prominence = math.log10((hits[name] / corpus_words) * 1e9 + 1)
        familiar = general_familiarity(t)
        obscurity = max(prominence - familiar, 0.0)

        cost = lookup_cost(t)
        score = reach * obscurity * cost

        rows.append(dict(t, score=score, reach=reach, obscurity=obscurity,
                         cost=cost, pages=pages_with[name], hits=hits[name],
                         blocked=blocked_only[name], why=""))

    rows.sort(key=lambda r: -r["score"])

    # Density is a page property, so the cut-off has to be simulated per page
    # rather than divided out of the corpus total. Under repeat="first" a kept
    # term contributes at most one mark to a page that contains it, so for any
    # candidate top-K we can compute each page's marks per 1000 words directly.
    # We bind on the 75th percentile: the target should hold for the densest
    # pages, not just the typical one, since those are where a page starts to
    # look spammy.
    ranked = [r for r in rows if r["score"] > 0]

    def density_at(k):
        names = {r["name"] for r in ranked[:k]}
        per = []
        for w, present in page_terms:
            if w < 100:
                continue          # nav-only or stub pages distort the measure
            per.append(len(present & names) / (w / 1000.0))
        if not per:
            return 0.0
        per.sort()
        return per[int(len(per) * 0.75)]

    budget = 0
    for k in range(1, len(ranked) + 1):
        if density_at(k) > args.per_1000_words:
            break
        budget = k
    budget = max(budget, 1)
    kept = ranked[:budget]

    print(f"corpus: {npages} pages, {corpus_words:,} markable words")
    print(f"packs:  {args.packs}  ({len(terms)} terms)")
    print(f"budget: {args.per_1000_words}/1000 words at p75 -> keep {budget} "
          f"(p75 density {density_at(budget):.1f}, all terms would be "
          f"{density_at(len(ranked)):.1f})\n")
    print("%-26s %-13s %6s %6s %6s %5s %5s" %
          ("term", "pack", "score", "reach", "obscur", "cost", "pages"))
    print("-" * 76)
    for r in rows[:args.top]:
        flag = "  KEEP" if r in kept else ""
        print("%-26s %-13s %6.2f %6.2f %6.2f %5.2f %5d%s" %
              (r["name"][:26], r["pack"], r["score"], r["reach"],
               r["obscurity"], r["cost"], r["pages"], flag))

    dead = [r for r in rows if r["score"] == 0]
    link_only = [r for r in dead if r["blocked"]]
    print(f"\n{len(kept)} kept, {len(rows) - len(kept)} cut")
    print(f"  {len(dead) - len(link_only)} never appear in this corpus")
    print(f"  {len(link_only)} appear only inside links or headings (unmarkable)")
    if link_only:
        print("    " + ", ".join(r["name"] for r in link_only[:8]))

    if args.emit:
        out = {"@context": "https://schema.org", "@type": "DefinedTermSet",
               "name": "Site-specific pack",
               "description": "Generated by score-corpus.py from %d pages." % npages,
               "hasDefinedTerm": [r["node"] for r in kept]}
        json.dump(out, open(args.emit, "w"), indent=2, ensure_ascii=False)
        print("\nwrote %s (%d terms)" % (args.emit, len(kept)))


if __name__ == "__main__":
    main()
