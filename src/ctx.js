/* ctx.js — context cards driven by on-page DefinedTermSet JSON-LD.
   No network calls. No page text leaves the browser.

   Usage: add a script tag pointing at this file, with:
     src="/ctx.js"  data-style="minimal"  data-scope="main"  defer

   data-style   minimal | paper | contrast
   data-scope   selector for the content root to scan
   data-ignore  selector list to skip
   data-max-per-term  occurrences to mark per term (default 1)
*/
(function () {
  'use strict';

  var S = document.currentScript || (function () {
    var a = document.getElementsByTagName('script');
    return a[a.length - 1];
  })();

  var CFG = {
    scope: S.getAttribute('data-scope') || 'main, article',
    style: S.getAttribute('data-style') || 'minimal',
    ignore: S.getAttribute('data-ignore') || 'pre, code, kbd, samp, a, h1, h2, h3, [data-no-ctx]',
    /* 'first' marks one occurrence per term, 'all' marks every occurrence.
       data-max-per-term takes a number and overrides both. Occurrences inside
       ignored elements (links, headings, code) never count toward the budget,
       because they are never candidates in the first place. */
    repeat: (S.getAttribute('data-repeat') || 'first').toLowerCase(),
    /* Off unless set. 'auto' forwards to whatever analytics the page already
       runs; a URL posts to your own collector. Nothing is sent otherwise. */
    analytics: S.getAttribute('data-analytics') || '',
    /* Opt-in. When the page's own H1 contains a term, the reader already knows
       it — it is the subject they clicked through for. Off by default because
       the opposite is also a valid pattern: a card on the page's own subject
       can work as a summary. */
    skipTitle: S.getAttribute('data-skip-title') === 'true',
    packs: (S.getAttribute('data-packs') || '').split(',')
             .map(function (x) { return x.trim(); }).filter(Boolean),
    packBase: (S.getAttribute('data-pack-base') ||
               /* derive from this script's own URL so a pinned tag gets pinned packs */
               ((S.src || '').replace(/\/dist\/[^\/]+$/, '/packs') || '') ||
               'https://cdn.jsdelivr.net/gh/JakeLabate/ctx-cards@latest/packs')
             .replace(/\/+$/, ''),
    openDelay: 140,
    closeDelay: 380
  };

  /* mk* = on-page marker (sits on the HOST surface).
     bg/fg/mut/bd/acc = the card (its own surface). Keep them separate. */
  /* data-max-per-term wins if present; otherwise repeat decides. */
  var explicitMax = parseInt(S.getAttribute('data-max-per-term'), 10);
  CFG.max = (explicitMax > 0) ? explicitMax
          : (CFG.repeat === 'all' ? Infinity : 1);

  var THEMES = {
    minimal: {
      layout: 'standard',
      mkColor: '#8f8c85', mkStyle: 'dotted', mkWidth: '1.5px',
      bg: '#ffffff', fg: '#16161a', mut: '#55535d', bd: '#e0dfe4', acc: '#15558f',
      eye: '#6d6a79', rule: '#ececf0',
      r: '12px', sh: '0 12px 32px -8px rgba(20,20,30,.18), 0 2px 6px -2px rgba(20,20,30,.10)',
      dark: { bg: '#22222a', fg: '#f2f1f5', mut: '#a9a7b3', bd: '#35343e', acc: '#8fbdf2',
              eye: '#9a97a6', rule: '#2e2d37', mkColor: '#8a867e',
              sh: '0 14px 36px -8px rgba(0,0,0,.6)' }
    },
    paper: {
      layout: 'editorial',
      mkColor: '#8a7c63', mkStyle: 'solid', mkWidth: '1px',
      bg: '#fffdf8', fg: '#1e1b16', mut: '#5c554a', bd: '#e0d7c5', acc: '#7a4a1e',
      eye: '#7d735f', rule: '#eee7d9',
      r: '3px', sh: '0 10px 26px -10px rgba(90,70,40,.30), 0 1px 0 #e0d7c5',
      dark: { bg: '#24211a', fg: '#f4efe4', mut: '#aca596', bd: '#3d382c', acc: '#d9a76a',
              eye: '#a09684', rule: '#332f25', mkColor: '#8b8071',
              sh: '0 14px 34px -10px rgba(0,0,0,.65)' }
    },
    contrast: {
      layout: 'ledger',
      mkColor: '#000000', mkStyle: 'solid', mkWidth: '2px',
      bg: '#ffffff', fg: '#000000', mut: '#22222a', bd: '#000000', acc: '#0b3d91',
      eye: '#4a4a55', rule: '#000000',
      r: '0px', sh: '4px 4px 0 rgba(0,0,0,.90)',
      dark: { bg: '#000000', fg: '#ffffff', mut: '#e8e8ec', bd: '#ffffff', acc: '#9ec5ff',
              eye: '#b8b8c0', rule: '#ffffff', mkColor: '#ffffff',
              sh: '4px 4px 0 rgba(255,255,255,.80)' }
    },

    /* Technical documentation and developer tools. Monospace throughout,
       tight radius, so the card reads as part of a reference rather than a
       marketing surface. */
    terminal: {
      layout: 'compact',
      mkColor: '#767670', mkStyle: 'dashed', mkWidth: '1px',
      font: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      bg: '#fbfbfa', fg: '#17171a', mut: '#4b4b50', bd: '#d8d8d4', acc: '#0a6046',
      eye: '#73736d', rule: '#ebebe7',
      r: '2px', sh: '0 3px 10px -2px rgba(0,0,0,.13)',
      dark: { bg: '#131315', fg: '#e9e9e5', mut: '#a2a29c', bd: '#2d2d2f', acc: '#4fd6a0',
              eye: '#7e7e79', rule: '#232325', mkColor: '#7d7d77',
              sh: '0 6px 18px -4px rgba(0,0,0,.7)' }
    },

    /* Consumer-facing sites: retail, health, education. Large radius, no hard
       border, generous padding. The least technical-looking option. */
    soft: {
      layout: 'hero',
      mkColor: '#8b86a0', mkStyle: 'dotted', mkWidth: '2px',
      bg: '#ffffff', fg: '#1c1b22', mut: '#54525e', bd: '#e9e7f0', acc: '#5b3fb8',
      eye: '#6f6c80', rule: '#f1eff6',
      r: '16px', sh: '0 10px 28px -8px rgba(38,28,74,.20), 0 2px 6px -2px rgba(38,28,74,.10)',
      dark: { bg: '#242130', fg: '#f3f1f8', mut: '#aeaabc', bd: '#37343f', acc: '#b7a2f2',
              eye: '#8d8a9c', rule: '#2e2b39', mkColor: '#8a86a0',
              sh: '0 14px 34px -10px rgba(0,0,0,.6)' }
    },

    /* Finance, legal, insurance. Restrained navy, small radius, no flourish.
       Built to survive a compliance review rather than to be noticed. */
    corporate: {
      layout: 'bar',
      mkColor: '#78818d', mkStyle: 'solid', mkWidth: '1px',
      bg: '#ffffff', fg: '#14181f', mut: '#4a525f', bd: '#d8dce2', acc: '#0f4c81',
      eye: '#5f6874', rule: '#eef1f4',
      r: '4px', sh: '0 5px 16px -5px rgba(14,30,52,.20), 0 1px 3px rgba(14,30,52,.08)',
      dark: { bg: '#171b21', fg: '#eff2f6', mut: '#a5adb8', bd: '#2b313a', acc: '#84b4e4',
              eye: '#7e8794', rule: '#232932', mkColor: '#79828e',
              sh: '0 10px 26px -8px rgba(0,0,0,.65)' }
    }
  };
  /* Layout is structure, not colour: where the eyebrow goes, whether there is
     a rule or a tail, how tight the padding is, how far the title sits above
     the body. Two themes sharing a layout will look related no matter how
     different their palettes are, so each theme picks one. */
  var LAYOUTS = {
    standard: { pad: '13px 15px 14px', eyebrow: 'top', rule: true, tail: true,
                ttl: '14.5px', bdy: '13.5px', eye: '10px', gap: '4px' },
    compact:  { pad: '9px 11px 10px', eyebrow: 'none', rule: false, tail: false,
                ttl: '13px', bdy: '12.5px', eye: '9.5px', gap: '3px' },
    bar:      { pad: '12px 14px 13px 15px', eyebrow: 'inline', rule: false, tail: false,
                ttl: '14px', bdy: '13px', eye: '10px', gap: '5px', accentBar: true },
    hero:     { pad: '18px 20px 20px', eyebrow: 'badge', rule: false, tail: true,
                ttl: '20px', bdy: '14px', eye: '10px', gap: '8px' },
    ledger:   { pad: '0', eyebrow: 'top', rule: true, tail: false,
                ttl: '13.5px', bdy: '13px', eye: '9.5px', gap: '4px', banded: true },
    editorial:{ pad: '16px 18px 17px', eyebrow: 'top', rule: true, tail: true,
                ttl: '17px', bdy: '14px', eye: '10px', gap: '6px', serifTitle: true }
  };

  var T = THEMES[CFG.style] || THEMES.minimal;
  var L = LAYOUTS[T.layout] || LAYOUTS.standard;

  /* The card must match the surface it sits ON, not the visitor's OS setting.
     Walk up from the content root until we hit a non-transparent background. */
  function hostLuminance() {
    var el = document.querySelector(CFG.scope.split(',')[0].trim()) || document.body;
    while (el) {
      var bg = getComputedStyle(el).backgroundColor;
      var m = bg && bg.match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/);
      if (m && (m[4] === undefined || parseFloat(m[4]) > 0.5)) {
        var c = [m[1], m[2], m[3]].map(function (v) {
          v = parseFloat(v) / 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      }
      el = el.parentElement;
    }
    return matchMedia('(prefers-color-scheme: dark)').matches ? 0 : 1;
  }
  var P = hostLuminance() < 0.25 ? T.dark : T;
  var MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

  /* ---------- 1. read the glossary ---------- */
  /* Walk any JSON-LD value and pull out DefinedTerm nodes. Used for both the
     page's own glossary and for fetched vertical packs. */
  function termsFrom(data) {
    var out = [];
    var stack = Array.isArray(data) ? data.slice() : [data];
    while (stack.length) {
      var n = stack.pop();
      if (!n || typeof n !== 'object') continue;
      if (n['@graph']) stack = stack.concat(n['@graph']);
      if (n['@type'] === 'DefinedTermSet' && n.hasDefinedTerm) {
        stack = stack.concat([].concat(n.hasDefinedTerm));
      }
      if (n['@type'] === 'DefinedTerm' && n.name && (n.description || n.ctx)) {
        var names = [n.name].concat(n.alternateName ? [].concat(n.alternateName) : []);
        var budget = { n: 0 };
        for (var j = 0; j < names.length; j++) {
          var x = n.ctx || {};
          out.push({
            match: names[j],
            title: x.title || n.name,
            body: x.body || n.description,
            href: n.url || x.href || null,
            tier: n.termCode === 'T1' ? 1 : 2,
            kind: x.kind || 'term',
            verdict: x.verdict, value: x.value, series: x.series,
            rows: x.rows, steps: x.steps, pairs: x.pairs, chart: x.chart,
            initials: x.initials, subtitle: x.subtitle,
            kindLabel: x.kindLabel, attribution: x.attribution,
            code: x.code, lang: x.lang, expansion: x.expansion,
            budget: budget
          });
        }
      }
    }
    return out;
  }

  function loadTerms() {
    var out = [];
    var nodes = document.querySelectorAll('script[type="application/ld+json"]');
    for (var i = 0; i < nodes.length; i++) {
      var data;
      try { data = JSON.parse(nodes[i].textContent); } catch (e) { continue; }
      out = out.concat(termsFrom(data));
    }
    return out;
  }

  /* ---------- pack loading ----------
     Precedence, highest first: page glossary > site glossary > vertical packs
     > seo-core. A term defined closer to the content always wins, so a customer
     can override any pack definition just by putting their own on the page.
     Packs are fetched in parallel, cached by the browser, and a failed pack is
     skipped rather than blocking the ones that loaded. */
  function mergeTerms(packLists) {
    var byName = Object.create(null), out = [];
    /* page terms are pushed last so they overwrite; build low-to-high then reverse */
    var tiers = packLists.concat([loadTerms()]);
    tiers.forEach(function (list) {
      list.forEach(function (t) {
        byName[t.match.toLowerCase()] = t;
      });
    });
    for (var k in byName) out.push(byName[k]);
    out.sort(function (a, b) { return b.match.length - a.match.length; });
    return out;
  }

  function fetchPack(id) {
    /* A bare id ("seo-core") resolves against packBase. Anything that already
       looks like a location — absolute URL, root-relative, relative path, or a
       name ending in .json — is used as given. Without this, a path silently
       became packBase + '/' + path + '.json', producing a 404 that looked like
       an empty pack rather than a mistake. */
    var isPath = /^https?:/.test(id) || id.indexOf('/') !== -1 || /\.json$/i.test(id);
    var url = isPath ? id : CFG.packBase + '/' + id + '.json';
    return fetch(url, { credentials: 'omit', cache: 'force-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error(r.status + ' ' + url);
        return r.json();
      })
      .then(function (j) { return termsFrom(j); })
      .catch(function (e) {
        /* A missing pack is survivable — the others still load — but silence
           makes a typo look like a pack with no matching terms. */
        if (window.console && console.warn) console.warn('[ctx-cards] pack failed:', e.message || e);
        return [];
      });
  }

  function start(packLists) {
    var TERMS = mergeTerms(packLists);
    if (!TERMS.length) return;
    run(TERMS);
  }

  if (CFG.packs.length && typeof fetch === 'function') {
    Promise.all(CFG.packs.map(fetchPack)).then(start);
  } else {
    start([]);
  }

  function run(TERMS) {
  if (!window.CSS || !CSS.highlights) { /* still works, falls back to spans */ }

  /* ---------- 2. find text ---------- */
  var roots = document.querySelectorAll(CFG.scope);
  if (!roots.length) roots = [document.body];

  function ignored(node) {
    var el = node.parentElement;
    while (el && el !== document.body) {
      if (el.matches(CFG.ignore) || el.isContentEditable) return true;
      if (el.hasAttribute('data-ctx-mark')) return true;
      el = el.parentElement;
    }
    return false;
  }

  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function wordy(s) { return /^[\w][\w.\-]*$/.test(s); }

  var marks = [];
  var claimed = new Map();

  /* Terms named in the page's H1 are the page's subject. Under data-skip-title
     they are dropped rather than marked. */
  var titleText = '';
  if (CFG.skipTitle) {
    var h1s = document.querySelectorAll('h1');
    for (var hi = 0; hi < h1s.length; hi++) titleText += ' ' + (h1s[hi].textContent || '');
    titleText = titleText.toLowerCase();
  }
  function isPageSubject(term) {
    if (!CFG.skipTitle || !titleText) return false;
    return titleText.indexOf(term.match.toLowerCase()) !== -1;
  }

  function scanRoot(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (ignored(n)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var texts = [], n;
    while ((n = walker.nextNode())) texts.push(n);

    for (var t = 0; t < TERMS.length; t++) {
      var term = TERMS[t];
      if (term.budget.n >= CFG.max) continue;
      if (isPageSubject(term)) continue;
      var bound = wordy(term.match) ? '\\b' : '';
      /* Global flag so a single text node can yield more than one occurrence,
         which is what data-repeat="all" needs. Case-insensitive only for
         longer terms, so short acronyms are not matched inside ordinary words. */
      var flags = 'g' + (term.match.length > 4 ? 'i' : '');
      var re = new RegExp(bound + esc(term.match) + bound, flags);

      for (var i = 0; i < texts.length && term.budget.n < CFG.max; i++) {
        var node = texts[i];
        if (!node.parentNode) continue;
        re.lastIndex = 0;
        var m;
        while ((m = re.exec(node.nodeValue)) !== null) {
          if (term.budget.n >= CFG.max) break;
          var a = m.index, z = m.index + m[0].length;
          if (z === a) { re.lastIndex++; continue; }
          /* Two terms can match the same span ("query fan-out" inside
             "query fan-outs"). Overlapping hit targets stack and swallow each
             other's clicks, so the first (longest) match wins the span. */
          var clash = false;
          var taken = claimed.get(node);
          if (taken) {
            for (var k = 0; k < taken.length; k++) {
              if (a < taken[k][1] && z > taken[k][0]) { clash = true; break; }
            }
          }
          if (clash) continue;
          if (!taken) { taken = []; claimed.set(node, taken); }
          taken.push([a, z]);
          var r = document.createRange();
          r.setStart(node, a);
          r.setEnd(node, z);
          marks.push({ range: r, term: term });
          term.budget.n++;
        }
      }
    }
  }

  for (var i = 0; i < roots.length; i++) scanRoot(roots[i]);
  if (!marks.length) return;

  /* ---------- analytics ----------
     Off by default. No identity of any kind: no cookie, no localStorage, no
     visitor or session id, no fingerprint. Each event carries the term, its
     card kind, the page path, and for opens a dwell time. That is all, which
     keeps this outside the scope of consent banners in most jurisdictions and
     means it cannot be joined back to a person later.

     Two modes:
       data-analytics="auto"    forward to the page's existing analytics
       data-analytics="https://…"  POST batches to your own collector

     Nothing about the page's text is ever transmitted. */
  var ANALYTICS = (function () {
    var mode = CFG.analytics;
    if (!mode) return { on: false, send: function () {} };

    /* Honour both the legacy header signal and Global Privacy Control. */
    var nav = window.navigator || {};
    if (nav.doNotTrack === '1' || nav.globalPrivacyControl === true) {
      return { on: false, send: function () {} };
    }

    var isURL = /^https?:\/\//.test(mode);
    var path = location.pathname;
    var queue = [];
    var flushTimer = null;

    /* Adapters for the analytics tools a mid-market site is actually running.
       Each receives a flat event object; none receives page content. */
    function forward(ev) {
      var name = 'ctx_' + ev.e;
      var props = { term: ev.t, kind: ev.k, path: ev.p };
      if (ev.d != null) props.dwell_ms = ev.d;
      if (ev.w != null) props.words = ev.w;
      if (ev.c != null) props.complexity = ev.c;

      if (typeof window.gtag === 'function') {
        window.gtag('event', name, props);
      } else if (Array.isArray(window.dataLayer)) {
        window.dataLayer.push(Object.assign({ event: name }, props));
      }
      if (typeof window.plausible === 'function') {
        window.plausible(name, { props: props });
      }
      if (window.posthog && typeof window.posthog.capture === 'function') {
        window.posthog.capture(name, props);
      }
      if (window.umami && typeof window.umami.track === 'function') {
        window.umami.track(name, props);
      }
      if (window.fathom && typeof window.fathom.trackEvent === 'function') {
        window.fathom.trackEvent(name + ' ' + ev.t);
      }
      if (typeof window.ctxAnalytics === 'function') {
        window.ctxAnalytics(name, props);   /* escape hatch for anything else */
      }
    }

    function flush() {
      flushTimer = null;
      if (!queue.length || !isURL) { queue = []; return; }
      var body = JSON.stringify({ v: 1, events: queue });
      queue = [];
      try {
        if (nav.sendBeacon) {
          nav.sendBeacon(mode, new Blob([body], { type: 'application/json' }));
        } else {
          fetch(mode, { method: 'POST', body: body, keepalive: true,
                        credentials: 'omit',
                        headers: { 'Content-Type': 'application/json' } });
        }
      } catch (e) { /* analytics must never break the page */ }
    }

    addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') flush();
    });
    addEventListener('pagehide', flush);

    return {
      on: true,
      send: function (name, term, dwell, cost) {
        var ev = { e: name, t: term.title, k: term.kind || 'term', p: path };
        if (dwell != null) ev.d = dwell;
        /* w = words rendered, c = complexity units. Sent raw so the reading
           model can be fitted later rather than fixed now. */
        if (cost) { ev.w = cost.w; ev.c = cost.c; }
        try {
          if (isURL) {
            queue.push(ev);
            /* batch so a reader hovering ten terms makes one request */
            if (queue.length >= 20) flush();
            else if (!flushTimer) flushTimer = setTimeout(flush, 5000);
          } else {
            forward(ev);
          }
        } catch (e) {}
      }
    };
  })();

  /* ---------- 3. paint markers ---------- */

  /* Structural overrides. Only the active layout's rules are emitted, so the
     card is genuinely a different shape per theme rather than a recolour. */
  var LAY_CSS = {
    standard: '',

    compact:
      '#ctx-card .rule{display:none}' +
      '#ctx-card .ttl{margin-bottom:3px}' +
      '#ctx-card .bdy{line-height:1.45}' +
      '#ctx-card .lnk{margin-top:8px;font-size:10.5px}' +
      '#ctx-card .row{padding:3px 0}' +
      '#ctx-card .big{font-size:22px}',

    bar:
      '#ctx-card{border-left:3px solid var(--ctx-acc);border-radius:0 4px 4px 0}' +
      '#ctx-card .rule{display:none}' +
      '#ctx-card .eye{display:inline;margin:0 8px 0 0;vertical-align:1px}' +
      '#ctx-card .ttl{display:inline;font-weight:500}' +
      '#ctx-card .bdy{margin-top:7px}' +
      '#ctx-tail{display:none}',

    hero:
      '#ctx-card .rule{display:none}' +
      '#ctx-card .eye{display:inline-block;background:var(--ctx-rule);color:var(--ctx-fg);' +
        'padding:3px 8px;border-radius:20px;letter-spacing:.06em;margin-bottom:10px}' +
      '#ctx-card .ttl{line-height:1.2;letter-spacing:-.02em;font-weight:500}' +
      '#ctx-card .bdy{margin-top:8px}' +
      '#ctx-card .big{font-size:38px;margin-top:6px}' +
      '#ctx-card .lnk{margin-top:14px}',

    ledger:
      '#ctx-card{overflow:hidden}' +
      '#ctx-card .eye{margin:0;padding:8px 14px;background:var(--ctx-fg);color:var(--ctx-bg);' +
        'letter-spacing:.12em}' +
      /* the card itself has no padding in this layout, so any row that is not
         a full-bleed band has to supply its own gutters */
      '#ctx-card .vhead{padding:11px 14px 0;margin-bottom:8px}' +
      '#ctx-card .ttl{padding:11px 14px 0}' +
      '#ctx-card .vhead + .ttl{padding-top:0}' +
      '#ctx-card .rule{margin:10px 0 0;height:1px;background:var(--ctx-bd)}' +
      '#ctx-card .bdy{padding:10px 14px 12px}' +
      '#ctx-card .row{margin:0 14px;padding:6px 0}' +
      '#ctx-card .big{padding:0 14px;margin-top:6px}' +
      '#ctx-card .spark,#ctx-card svg{margin-left:14px;margin-right:14px}' +
      '#ctx-card .lnk{margin:0 14px 13px}' +
      '#ctx-tail{display:none}',

    editorial:
      '#ctx-card .ttl{font-weight:500;line-height:1.25}' +
      '#ctx-card .rule{margin:11px 0 10px}' +
      '#ctx-card .bdy{line-height:1.6}' +
      '#ctx-card .eye{letter-spacing:.14em}' +
      '#ctx-card .big{font-size:34px}'
  };

  var css = document.createElement('style');
  css.textContent =
    ':root{--ctx-mk:' + P.mkColor + ';--ctx-bg:' + P.bg + ';--ctx-fg:' + P.fg + ';' +
      '--ctx-mut:' + P.mut + ';--ctx-bd:' + P.bd + ';--ctx-acc:' + P.acc + ';' +
      '--ctx-eye:' + P.eye + ';--ctx-rule:' + P.rule + ';' +
      '--ctx-sh:' + (P.sh || '0 12px 32px -8px rgba(0,0,0,.5)') + '}' +
    '::highlight(ctx-term){text-decoration:underline ' + T.mkStyle + ' ' + T.mkWidth + ';' +
      'text-underline-offset:3px;text-decoration-color:var(--ctx-mk)}' +
    '[data-ctx-mark]{border-bottom:' + T.mkWidth + ' ' + T.mkStyle + ' var(--ctx-mk);cursor:help}' +
    '[data-ctx-mark]:focus-visible{outline:2px solid var(--ctx-acc);outline-offset:2px}' +
    '#ctx-card{position:absolute;z-index:2147483000;width:max-content;' +
      'max-width:min(var(--ctx-w,302px),calc(100vw - 24px));background:var(--ctx-bg);color:var(--ctx-fg);' +
      'border:1px solid var(--ctx-bd);border-radius:' + T.r + ';box-shadow:var(--ctx-sh);' +
      'padding:' + L.pad + ';font-family:' + (T.font || 'inherit') + ';opacity:0;overflow:hidden;' +
      'transform:translateY(-6px) scale(.94);' +
      'transition:opacity .12s ease-out,transform .13s ease-out;pointer-events:none}' +
    '#ctx-card.on{opacity:1;transform:none;pointer-events:auto;' +
      'transition:opacity .14s ease-out,transform .28s cubic-bezier(.34,1.42,.44,1)}' +
    '#ctx-tail{position:absolute;width:9px;height:9px;background:var(--ctx-bg);' +
      'border-left:1px solid var(--ctx-bd);border-top:1px solid var(--ctx-bd);' +
      'transform:rotate(45deg);left:18px}' +
    '#ctx-card.below #ctx-tail{top:-5.5px}' +
    '#ctx-card.above #ctx-tail{bottom:-5.5px;transform:rotate(225deg)}' +
    '#ctx-card .eye{display:block;font-family:' + MONO + ';font-size:' + L.eye + ';font-weight:500;' +
      'letter-spacing:.09em;text-transform:uppercase;color:var(--ctx-eye);margin:0 0 7px}' +
    '#ctx-card .ttl{display:block;font-size:' + L.ttl + ';font-weight:600;line-height:1.28;' +
      'letter-spacing:-.012em;color:var(--ctx-fg);margin:0}' +
    '#ctx-card .exp{display:block;font-size:12.5px;line-height:1.4;color:var(--ctx-mut);margin:3px 0 0}' +
    '#ctx-card .rule{height:1px;background:var(--ctx-rule);margin:9px 0 8px;border:0}' +
    '#ctx-card .bdy{margin:0;color:var(--ctx-mut);font-size:' + L.bdy + ';line-height:1.55}' +
    '#ctx-card .lnk{display:inline-block;margin-top:11px;font-family:' + MONO + ';font-size:11.5px;' +
      'letter-spacing:.02em;color:var(--ctx-acc);text-decoration:none;' +
      'border-bottom:1px solid var(--ctx-acc);padding-bottom:1px}' +
    '#ctx-card .row{display:flex;align-items:baseline;justify-content:space-between;gap:14px;padding:5px 0;border-bottom:1px solid var(--ctx-rule)}' +
    '#ctx-card .row:last-of-type{border-bottom:0}' +
    '#ctx-card .row dt{font-family:' + MONO + ';font-size:10.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--ctx-eye);margin:0}' +
    '#ctx-card .row dd{font-size:12.5px;color:var(--ctx-fg);margin:0;text-align:right}' +
    '#ctx-card .big{font-size:30px;font-weight:600;letter-spacing:-.02em;line-height:1;margin:2px 0 0}' +
    '#ctx-card .big.txt{font-size:19px;line-height:1.25;letter-spacing:-.01em;margin:4px 0 0}' +
    /* letter-spacing is applied after every character including the last, so
       symmetric padding leaves the text sitting visually left of centre.
       Trim the right side by exactly one letter-space to correct it. */
    '#ctx-card .badge{display:inline-block;font-family:' + MONO + ';font-size:10px;font-weight:600;' + 'letter-spacing:.11em;text-transform:uppercase;border-radius:3px;margin:0;' + 'padding:4px calc(8px - .11em) 4px 8px}' +
    '#ctx-card .vhead{display:flex;align-items:center;justify-content:space-between;gap:14px;margin:0 0 10px}' +
    '#ctx-card .vhead .eye{margin:0;white-space:nowrap}' +
    '#ctx-card .avatar{width:38px;height:38px;border-radius:50%;flex:0 0 38px;display:flex;align-items:center;justify-content:center;font-family:' + MONO + ';font-size:12px;font-weight:600;background:var(--ctx-rule);color:var(--ctx-fg)}' +
    '#ctx-card .hd{display:flex;gap:11px;align-items:center}' +
    '#ctx-card ol.steps{margin:0;padding:0;list-style:none;counter-reset:s}' +
    '#ctx-card ol.steps li{counter-increment:s;position:relative;padding:0 0 9px 24px;font-size:13px;line-height:1.5;color:var(--ctx-mut)}' +
    '#ctx-card ol.steps li:last-child{padding-bottom:0}' +
    '#ctx-card ol.steps li::before{content:counter(s);position:absolute;left:0;top:1px;font-family:' + MONO + ';font-size:10px;color:var(--ctx-eye);border:1px solid var(--ctx-rule);width:16px;height:16px;border-radius:50%;display:flex;align-items:center;justify-content:center}' +
    '#ctx-card .cmp{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}' +
    '#ctx-card .cmp h4{font-family:' + MONO + ';font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:var(--ctx-eye);margin:0 0 5px;font-weight:500}' +
    '#ctx-card .cmp p{margin:0;font-size:12.5px;line-height:1.5;color:var(--ctx-mut)}' +
    '#ctx-card .cmp .sep{grid-column:1/-1;height:1px;background:var(--ctx-rule);margin:9px 0}' +
    '#ctx-card blockquote{margin:0;font-size:14px;line-height:1.55;color:var(--ctx-fg);border-left:2px solid var(--ctx-rule);padding-left:11px}' +
    '#ctx-card .attr{margin:9px 0 0;font-size:12px;color:var(--ctx-eye)}' +
    '#ctx-card pre{margin:0;background:var(--ctx-rule);border-radius:4px;padding:9px 10px;overflow-x:auto;font-family:' + MONO + ';font-size:11.5px;line-height:1.6;color:var(--ctx-fg)}' +
    '#ctx-card .spark{display:flex;align-items:flex-end;gap:2px;height:26px;margin:9px 0 0}' +
    '#ctx-card .spark i{flex:1;background:var(--ctx-acc);opacity:.32;border-radius:1px}' +
    '#ctx-card .spark i:last-child{opacity:1}' +
    '#ctx-card .lnk:hover{opacity:.75}' +
    '#ctx-card .lnk .arw{display:inline-block;transition:transform .2s cubic-bezier(.2,.8,.3,1)}' +
    '#ctx-card .lnk:hover .arw{transform:translateX(3px)}' +
    '[data-ctx-mark]{transition:border-color .18s ease,background-color .18s ease}' +
    '[data-ctx-mark]:hover{border-bottom-color:var(--ctx-acc)}' +
    '@media (prefers-reduced-motion:reduce){' +
      '#ctx-card,#ctx-card.on{transition:opacity .01s linear;transform:none}' +
      '#ctx-card .lnk .arw{transition:none}}' +
    (LAY_CSS[T.layout] || '') +
    /* The eyebrow inside a verdict header is a plain inline label whatever the
       layout does with a stacked one — ledger's inverted bar and hero's pill
       both look wrong sitting next to a badge. Emitted last so it wins. */
    '#ctx-card .vhead .eye{display:inline;background:none;color:var(--ctx-eye);' +
      'padding:0;margin:0;border-radius:0;letter-spacing:.08em;font-size:9.5px}';
  document.head.appendChild(css);

  var useHL = !!(window.CSS && CSS.highlights && window.Highlight);
  var hl = useHL ? new Highlight() : null;
  var anchors = [];

  marks.forEach(function (m, idx) {
    if (useHL) {
      hl.add(m.range);
      var hit = document.createElement('span');
      hit.setAttribute('data-ctx-mark', idx);
      hit.setAttribute('tabindex', '0');
      hit.setAttribute('role', 'button');
      hit.setAttribute('aria-label', m.term.title + ', show definition');
      hit.style.cssText = 'all:unset;position:absolute;cursor:help';
      var rect = m.range.getBoundingClientRect();
      hit.style.left = (rect.left + scrollX) + 'px';
      hit.style.top = (rect.top + scrollY) + 'px';
      hit.style.width = rect.width + 'px';
      hit.style.height = rect.height + 'px';
      document.body.appendChild(hit);
      anchors.push({ el: hit, term: m.term, range: m.range });
    } else {
      var sp = document.createElement('span');
      sp.setAttribute('data-ctx-mark', idx);
      sp.setAttribute('tabindex', '0');
      sp.setAttribute('role', 'button');
      sp.setAttribute('aria-label', m.term.title + ', show definition');
      try { m.range.surroundContents(sp); } catch (e) { return; }
      anchors.push({ el: sp, term: m.term, range: null });
    }
  });
  if (useHL) CSS.highlights.set('ctx-term', hl);

  /* One event per marked term on load. Without a denominator an open count is
     meaningless: five opens out of five marks is a very different result from
     five out of ninety. */
  if (ANALYTICS.on) {
    anchors.forEach(function (a) { ANALYTICS.send('mark', a.term); });

    /* `mark` counts terms present on the page, which is the wrong denominator
       for an open rate: a reader who leaves at the fold never laid eyes on the
       terms below it. Worse, the error is positional — a term in the first
       paragraph is seen by everyone and one in the last by a fraction, so
       comparing their open rates would mostly measure page position.

       `seen` fires once per marker when it actually enters the viewport, so
       open/seen answers the real question: of the times a reader could have
       used this card, how often did they.

       Fires once per marker per page. There is no identifier, so this is a
       count of viewport entries, not of distinct readers. */
    if (typeof IntersectionObserver === 'function') {
      var io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          var e = entries[i];
          if (!e.isIntersecting) continue;
          var a = e.target.__ctxAnchor;
          if (a && !a.seen) {
            a.seen = true;
            ANALYTICS.send('seen', a.term);
          }
          io.unobserve(e.target);
        }
      }, {
        /* A marker counts as seen once any part of it is on screen. Markers are
           a line of text tall, so a threshold above 0 would miss ones clipped
           by the viewport edge — exactly the boundary cases this is meant to
           measure. */
        threshold: 0,
        rootMargin: '0px'
      });
      anchors.forEach(function (a) {
        a.el.__ctxAnchor = a;
        io.observe(a.el);
      });
    } else {
      /* No IntersectionObserver: treat every marker as seen so open/seen stays
         computable rather than dividing by zero. */
      anchors.forEach(function (a) {
        a.seen = true;
        ANALYTICS.send('seen', a.term);
      });
    }
  }

  if (useHL) {
    var reflow = function () {
      anchors.forEach(function (a) {
        var r = a.range.getBoundingClientRect();
        a.el.style.left = (r.left + scrollX) + 'px';
        a.el.style.top = (r.top + scrollY) + 'px';
        a.el.style.width = r.width + 'px';
        a.el.style.height = r.height + 'px';
      });
    };
    addEventListener('resize', reflow, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(reflow);
  }



  /* ---------- micro charts ----------
     Every chart is inline SVG or flexbox, sized to sit inside a card.
     Shared vocabulary: c.type picks the renderer, c.data carries values,
     c.labels/c.caption are optional. No libraries, no layout thrash. */
  var NS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function fmt(v) {
    if (typeof v !== 'number') return String(v);
    if (Math.abs(v) >= 1000000) return (v / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return Math.round(v * 10) / 10 + '';
  }

  var CHART = {
    /* vertical bars, last one emphasised */
    bars: function (c) {
      var wrap = el('div', 'spark');
      var max = Math.max.apply(null, c.data);
      var min = Math.min.apply(null, c.data);
      /* Baseline at the series minimum, not zero. A run from 800 to 2400
         baselined at zero starts at a third height and reads as almost flat,
         which hides the shape the sparkline exists to show. A small floor keeps
         the smallest bar visible. Set baseline:"zero" when absolute magnitude
         matters more than trend. */
      var zero = c.baseline === 'zero' || min === max;
      var lo = zero ? 0 : min - (max - min) * 0.15;
      var span = (max - lo) || 1;
      c.data.forEach(function (v) {
        var b = el('i');
        b.style.height = Math.max(10, Math.round(((v - lo) / span) * 100)) + '%';
        wrap.appendChild(b);
      });
      return wrap;
    },

    /* line with soft area fill and an endpoint dot */
    line: function (c) {
      var d = c.data, W = 260, H = 46, P = 3;
      var max = Math.max.apply(null, d), min = Math.min.apply(null, d);
      var span = (max - min) || 1;
      var x = function (i) { return P + (i / (d.length - 1)) * (W - P * 2); };
      var y = function (v) { return H - P - ((v - min) / span) * (H - P * 2); };
      var pts = d.map(function (v, i) { return x(i) + ',' + y(v); }).join(' ');
      var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', height: H,
                           preserveAspectRatio: 'none', 'aria-hidden': 'true' });
      s.appendChild(svg('polygon', { points: x(0) + ',' + H + ' ' + pts + ' ' + x(d.length - 1) + ',' + H,
                                     fill: 'var(--ctx-acc)', opacity: '.11' }));
      s.appendChild(svg('polyline', { points: pts, fill: 'none', stroke: 'var(--ctx-acc)',
                                      'stroke-width': '1.75', 'stroke-linejoin': 'round',
                                      'stroke-linecap': 'round', 'vector-effect': 'non-scaling-stroke' }));
      s.appendChild(svg('circle', { cx: x(d.length - 1), cy: y(d[d.length - 1]), r: '2.75',
                                    fill: 'var(--ctx-acc)' }));
      var box = el('div');
      box.style.cssText = 'margin:10px 0 0;line-height:0';
      box.appendChild(s);
      return box;
    },

    /* donut for a single percentage */
    ring: function (c) {
      var pct = Math.max(0, Math.min(100, c.value)), R = 21, C = 2 * Math.PI * R;
      var s = svg('svg', { viewBox: '0 0 52 52', width: '52', height: '52', 'aria-hidden': 'true' });
      s.appendChild(svg('circle', { cx: 26, cy: 26, r: R, fill: 'none',
                                    stroke: 'var(--ctx-rule)', 'stroke-width': '5' }));
      var arc = svg('circle', { cx: 26, cy: 26, r: R, fill: 'none', stroke: 'var(--ctx-acc)',
                                'stroke-width': '5', 'stroke-linecap': 'round',
                                'stroke-dasharray': C, 'stroke-dashoffset': C * (1 - pct / 100),
                                transform: 'rotate(-90 26 26)' });
      s.appendChild(arc);
      var row = el('div');
      row.style.cssText = 'display:flex;align-items:center;gap:12px;margin:10px 0 0';
      row.appendChild(s);
      var lab = el('div');
      var big = el('span', null, pct + '%');
      big.style.cssText = 'display:block;font-size:19px;font-weight:600;letter-spacing:-.01em';
      lab.appendChild(big);
      if (c.caption) {
        var cap = el('span', null, c.caption);
        cap.style.cssText = 'display:block;font-size:12px;color:var(--ctx-mut);margin-top:1px';
        lab.appendChild(cap);
      }
      row.appendChild(lab);
      return row;
    },

    /* single progress bar with an optional target notch */
    progress: function (c) {
      var pct = Math.max(0, Math.min(100, c.value));
      var box = el('div');
      box.style.cssText = 'margin:10px 0 0';
      var track = el('div');
      track.style.cssText = 'position:relative;height:7px;border-radius:4px;background:var(--ctx-rule);overflow:hidden';
      var fill = el('div');
      fill.style.cssText = 'position:absolute;inset:0 auto 0 0;width:' + pct +
                           '%;background:var(--ctx-acc);border-radius:4px';
      track.appendChild(fill);
      box.appendChild(track);
      var foot = el('div');
      foot.style.cssText = 'display:flex;justify-content:space-between;margin-top:6px;' +
                           'font-family:' + MONO + ';font-size:10.5px;color:var(--ctx-eye)';
      foot.appendChild(el('span', null, c.caption || ''));
      foot.appendChild(el('span', null, pct + '%'));
      box.appendChild(foot);
      return box;
    },

    /* 100% stacked bar with a legend */
    share: function (c) {
      var total = c.data.reduce(function (a, b) { return a + b; }, 0) || 1;
      var box = el('div');
      box.style.cssText = 'margin:10px 0 0';
      var bar = el('div');
      bar.style.cssText = 'display:flex;height:9px;border-radius:4px;overflow:hidden;gap:1.5px';
      c.data.forEach(function (v, i) {
        var seg = el('div');
        seg.style.cssText = 'flex:' + v + ';background:var(--ctx-acc);opacity:' +
                            (1 - i * (0.62 / Math.max(1, c.data.length - 1))).toFixed(2);
        bar.appendChild(seg);
      });
      box.appendChild(bar);
      if (c.labels) {
        var leg = el('div');
        leg.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px 13px;margin-top:8px;' +
                            'font-size:11.5px;color:var(--ctx-mut)';
        c.labels.forEach(function (t, i) {
          var it = el('span');
          it.style.cssText = 'display:inline-flex;align-items:center;gap:5px';
          var dot = el('span');
          dot.style.cssText = 'width:7px;height:7px;border-radius:2px;background:var(--ctx-acc);opacity:' +
                              (1 - i * (0.62 / Math.max(1, c.data.length - 1))).toFixed(2);
          it.appendChild(dot);
          it.appendChild(document.createTextNode(t + ' ' + Math.round((c.data[i] / total) * 100) + '%'));
          leg.appendChild(it);
        });
        box.appendChild(leg);
      }
      return box;
    },

    /* horizontal labelled bars, for comparing a handful of items */
    hbars: function (c) {
      var max = Math.max.apply(null, c.data) || 1;
      var box = el('div');
      box.style.cssText = 'margin:10px 0 0;display:grid;gap:7px';
      c.data.forEach(function (v, i) {
        var r = el('div');
        r.style.cssText = 'display:grid;grid-template-columns:78px 1fr auto;align-items:center;gap:9px';
        var lb = el('span', null, (c.labels && c.labels[i]) || '');
        lb.style.cssText = 'font-size:11.5px;color:var(--ctx-mut);overflow:hidden;' +
                           'text-overflow:ellipsis;white-space:nowrap';
        var tr = el('div');
        tr.style.cssText = 'height:7px;border-radius:4px;background:var(--ctx-rule);overflow:hidden';
        var fl = el('div');
        fl.style.cssText = 'height:100%;width:' + Math.round((v / max) * 100) +
                           '%;background:var(--ctx-acc);border-radius:4px;opacity:' +
                           (v === max ? '1' : '.55');
        tr.appendChild(fl);
        var vl = el('span', null, fmt(v));
        vl.style.cssText = 'font-family:' + MONO + ';font-size:10.5px;color:var(--ctx-eye)';
        r.appendChild(lb); r.appendChild(tr); r.appendChild(vl);
        box.appendChild(r);
      });
      return box;
    },

    /* min / value / max on a track, for showing where something sits in a range */
    range: function (c) {
      var lo = c.min, hi = c.max, v = c.value;
      var pos = Math.max(0, Math.min(100, ((v - lo) / ((hi - lo) || 1)) * 100));
      var box = el('div');
      box.style.cssText = 'margin:12px 0 0';
      var track = el('div');
      track.style.cssText = 'position:relative;height:3px;border-radius:2px;background:var(--ctx-rule)';
      var dot = el('div');
      dot.style.cssText = 'position:absolute;top:50%;left:' + pos + '%;width:11px;height:11px;' +
                          'margin:-5.5px 0 0 -5.5px;border-radius:50%;background:var(--ctx-acc);' +
                          'border:2px solid var(--ctx-bg)';
      track.appendChild(dot);
      box.appendChild(track);
      var foot = el('div');
      foot.style.cssText = 'display:flex;justify-content:space-between;margin-top:7px;' +
                           'font-family:' + MONO + ';font-size:10.5px;color:var(--ctx-eye)';
      foot.appendChild(el('span', null, fmt(lo)));
      foot.appendChild(el('span', null, (c.caption ? c.caption + ' ' : '') + fmt(v)));
      foot.appendChild(el('span', null, fmt(hi)));
      box.appendChild(foot);
      return box;
    },

    /* up / down ticks, for pass-fail or period-over-period runs */
    winloss: function (c) {
      var box = el('div');
      box.style.cssText = 'display:flex;align-items:center;gap:3px;height:26px;margin:10px 0 0';
      c.data.forEach(function (v) {
        var t = el('div');
        var up = v > 0;
        t.style.cssText = 'flex:1;height:' + (v === 0 ? '3px' : '10px') + ';border-radius:1px;' +
                          'align-self:' + (v === 0 ? 'center' : (up ? 'flex-start' : 'flex-end')) + ';' +
                          'background:' + (v === 0 ? 'var(--ctx-rule)' : 'var(--ctx-acc)') + ';' +
                          'opacity:' + (up ? '1' : '.42');
        box.appendChild(t);
      });
      return box;
    }
  };

  function chart(c) {
    if (!c || !CHART[c.type]) return null;
    var node = CHART[c.type](c);
    node.setAttribute('role', 'img');
    node.setAttribute('aria-label', c.alt || (c.type + ' chart'));
    return node;
  }

  /* ---------- renderers ----------
     Each kind gets the same shell (tail, eyebrow, entrance) and its own body.
     `w` is the max width for that kind; rich content gets more room. */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function rule() {
    var h = document.createElement('hr');
    h.className = 'rule';
    if (!L.rule) h.style.display = 'none';
    return h;
  }
  function rows(host, pairs) {
    var dl = el('dl');
    dl.style.margin = '0';
    (pairs || []).forEach(function (p) {
      var r = el('div', 'row');
      r.appendChild(el('dt', null, p[0]));
      r.appendChild(el('dd', null, p[1]));
      dl.appendChild(r);
    });
    host.appendChild(dl);
  }
  /* A link back to the page the reader is already on does nothing but waste a
     line and invite a wasted click. Fragments are the exception: a same-page
     link to #verdict jumps to a section and is genuinely useful, so only bare
     self-links are dropped. */
  function normalizePath(p) {
    p = p.replace(/\/index\.html?$/i, '/');
    if (p.length > 1 && p.charAt(p.length - 1) !== '/') p += '/';
    return p;
  }

  function isSelfLink(href) {
    if (!href) return false;
    var here, there;
    try {
      there = new URL(href, document.baseURI);
      here = new URL(location.href);
    } catch (e) {
      return false;                       /* unparseable: leave it alone */
    }
    if (there.hash) return false;         /* a jump link still has a job to do */
    return there.origin === here.origin
        && normalizePath(there.pathname) === normalizePath(here.pathname)
        && there.search === here.search;
  }

  function linkOut(host, href, label) {
    if (!href) return;
    if (isSelfLink(href)) return;
    var a = el('a', 'lnk');
    a.href = href;
    a.addEventListener('click', function () {
      if (cur) ANALYTICS.send('follow', cur.term);
    });
    a.appendChild(document.createTextNode((label || 'Read more') + ' '));
    var w = el('span', 'arw', '\u2192');
    a.appendChild(w);
    host.appendChild(a);
  }

  var VERDICT_TONE = {
    'DEBUNKED': ['#f7c1c1', '#501313'],
    'PLAUSIBLE': ['#fac775', '#412402'],
    'TRUE': ['#c0dd97', '#173404'],
    'CONTESTED': ['#cecbf6', '#26215c']
  };

  var RENDER = {
    term: { w: 302,
      eyebrow: function (d) {
        return d.expansion ? 'acronym' : (d.tier === 1 ? 'definition' : 'defined term');
      },
      body: function (h, d) {
        h.appendChild(el('span', 'ttl', d.title));
        /* The written-out form is context an acronym cannot carry on its own.
           It sits above the rule because it belongs to the name, not the body. */
        if (d.expansion) h.appendChild(el('span', 'exp', d.expansion));
        h.appendChild(rule());
        h.appendChild(el('p', 'bdy', d.body));
        var g0 = chart(d.chart); if (g0) h.appendChild(g0);
        linkOut(h, d.href);
      } },

    verdict: { w: 330, headEyebrow: true,
      eyebrow: function () { return 'claim \u00b7 adjudicated'; },
      body: function (h, d, eyeNode) {
        var tone = VERDICT_TONE[(d.verdict || '').toUpperCase()] || VERDICT_TONE.CONTESTED;
        var b = el('span', 'badge', d.verdict);
        b.style.background = tone[0];
        b.style.color = tone[1];
        var head = el('div', 'vhead');
        head.appendChild(b);
        if (eyeNode) head.appendChild(eyeNode);
        h.appendChild(head);
        h.appendChild(el('span', 'ttl', d.title));
        h.appendChild(rule());
        h.appendChild(el('p', 'bdy', d.body));
        var g1 = chart(d.chart); if (g1) h.appendChild(g1);
        if (d.rows) rows(h, d.rows);
        linkOut(h, d.href, 'Full verdict');
      } },

    stat: { w: 300, eyebrow: function () { return 'measured value'; },
      body: function (h, d) {
        h.appendChild(el('span', 'ttl', d.title));
        if (d.expansion) h.appendChild(el('span', 'exp', d.expansion));
        var big = el('p', 'big', d.value);
        /* .big is sized for figures. A text value ("MCP leads") at 30px
           overpowers the card and wraps badly, so step it down. */
        if (!/^[+\-]?[\d.,]/.test(String(d.value || ''))) big.className = 'big txt';
        h.appendChild(big);
        var spec = d.chart || (d.series ? { type: 'bars', data: d.series } : null);
        var g = chart(spec);
        if (g) h.appendChild(g);
        h.appendChild(rule());
        if (d.rows) rows(h, d.rows);
        linkOut(h, d.href, 'Source');
      } },

    entity: { w: 306, eyebrow: function (d) { return d.kindLabel || 'organization'; },
      body: function (h, d) {
        var hd = el('div', 'hd');
        var av = el('div', 'avatar', d.initials || d.title.slice(0, 2).toUpperCase());
        hd.appendChild(av);
        var col = el('div');
        col.appendChild(el('span', 'ttl', d.title));
        if (d.subtitle) {
          var st = el('p', 'bdy', d.subtitle);
          st.style.fontSize = '12.5px';
          st.style.marginTop = '2px';
          col.appendChild(st);
        }
        hd.appendChild(col);
        h.appendChild(hd);
        h.appendChild(rule());
        if (d.body) h.appendChild(el('p', 'bdy', d.body));
        var g2 = chart(d.chart); if (g2) h.appendChild(g2);
        if (d.rows) rows(h, d.rows);
        linkOut(h, d.href, 'Open record');
      } },

    steps: { w: 320, eyebrow: function () { return 'procedure'; },
      body: function (h, d) {
        h.appendChild(el('span', 'ttl', d.title));
        h.appendChild(rule());
        var ol = el('ol', 'steps');
        (d.steps || []).forEach(function (t) { ol.appendChild(el('li', null, t)); });
        h.appendChild(ol);
        linkOut(h, d.href, 'Full guide');
      } },

    compare: { w: 344, eyebrow: function () { return 'comparison'; },
      body: function (h, d) {
        h.appendChild(el('span', 'ttl', d.title));
        h.appendChild(rule());
        var g = el('div', 'cmp');
        (d.pairs || []).forEach(function (p, i) {
          if (i) g.appendChild(el('div', 'sep'));
          var a = el('div'); a.appendChild(el('h4', null, p[0])); a.appendChild(el('p', null, p[1]));
          var b = el('div'); b.appendChild(el('h4', null, p[2])); b.appendChild(el('p', null, p[3]));
          g.appendChild(a); g.appendChild(b);
        });
        h.appendChild(g);
        linkOut(h, d.href);
      } },

    quote: { w: 312, eyebrow: function () { return 'cited passage'; },
      body: function (h, d) {
        var q = el('blockquote', null, d.body);
        h.appendChild(q);
        h.appendChild(el('p', 'attr', d.attribution || ''));
        linkOut(h, d.href, 'Source');
      } },

    code: { w: 348, eyebrow: function (d) { return d.lang || 'snippet'; },
      body: function (h, d) {
        h.appendChild(el('span', 'ttl', d.title));
        h.appendChild(rule());
        h.appendChild(el('pre', null, d.code));
        if (d.body) {
          var p = el('p', 'bdy', d.body);
          p.style.marginTop = '9px';
          h.appendChild(p);
        }
        linkOut(h, d.href, 'Docs');
      } }
  };



  /* ---------- reading cost ----------
     Raw dwell cannot be compared across card kinds: a 12-word acronym card and
     a 60-word verdict card are not the same read. We measure the card that was
     actually rendered and send the inputs, not a ratio.

     Complexity counts the structural elements that cost time to parse but
     carry few words — a sparkline, a provenance table, a numbered procedure.
     Without it every stat card would look ignored.

     The client deliberately does not compute a ratio. Any ms-per-word constant
     is a guess until fitted against real distributions, and baking one in here
     would lock every historical event to a model you will want to revise. */
  function readingCost(host) {
    /* textContent concatenates adjacent elements with no separator, so a card
       reading "VALUE" then "Indexed pages" collapses to "VALUEIndexed pages"
       and undercounts. Walk the text nodes and join them instead. */
    var walk = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    var parts = [], tn;
    while ((tn = walk.nextNode())) {
      var v = (tn.nodeValue || '').trim();
      if (v) parts.push(v);
    }
    var text = parts.join(' ').trim();
    var words = text ? text.split(/\s+/).length : 0;
    var c = 0;
    c += host.querySelectorAll('.row').length * 2;        /* table rows scan slowly */
    c += host.querySelectorAll('ol.steps li').length * 2; /* enumerated steps */
    c += host.querySelectorAll('.cmp h4').length * 2;     /* comparison columns */
    if (host.querySelector('svg, .spark')) c += 6;        /* a chart is a real pause */
    if (host.querySelector('.badge')) c += 1;
    if (host.querySelector('pre')) c += 4;                /* code is read slowly */
    if (host.querySelector('.big')) c += 1;
    return { w: words, c: c };
  }

  /* ---------- 4. the card ---------- */
  var card = document.createElement('div');
  card.id = 'ctx-card';
  card.setAttribute('role', 'tooltip');
  var tail = document.createElement('span');
  tail.id = 'ctx-tail';
  if (!L.tail) tail.style.display = 'none';
  var inner = document.createElement('div');
  card.appendChild(tail);
  card.appendChild(inner);
  document.body.appendChild(card);

  var openT = null, closeT = null, cur = null, viaPointer = false, openedAt = 0;
  var lastCost = null;
  var coarse = matchMedia('(hover: none), (pointer: coarse)').matches;

  function place(el) {
    var r = el.getBoundingClientRect();
    card.style.left = '0px'; card.style.top = '0px';
    var w = card.offsetWidth, h = card.offsetHeight;
    var left = Math.min(Math.max(8, r.left + scrollX), scrollX + innerWidth - w - 8);
    var below = r.bottom + scrollY + 8;
    var above = r.top + scrollY - h - 8;
    var goAbove = (r.bottom + h + 12 > innerHeight) && (above > scrollY + 4);
    card.classList.toggle('above', goAbove);
    card.classList.toggle('below', !goAbove);
    card.style.left = left + 'px';
    card.style.top = (goAbove ? above : below) + 'px';
    var tx = Math.min(Math.max(10, r.left + scrollX - left + Math.min(r.width, 40) / 2 - 4.5), w - 20);
    tail.style.left = tx + 'px';
    card.style.transformOrigin = (tx + 4.5) + 'px ' + (goAbove ? '100%' : '0');
  }

  function show(a) {
    clearTimeout(closeT);
    cur = a;
    var t = a.term;
    inner.innerHTML = '';
    var R = RENDER[t.kind] || RENDER.term;
    card.style.setProperty('--ctx-w', R.w + 'px');
    var eyeNode = (L.eyebrow !== 'none') ? el('span', 'eye', R.eyebrow(t)) : null;
    /* Most kinds want the eyebrow stacked on top. A verdict card already has a
       badge on that line, so it places the eyebrow itself, opposite the badge. */
    if (eyeNode && !R.headEyebrow) inner.appendChild(eyeNode);
    R.body(inner, t, eyeNode);
    lastCost = readingCost(inner);
    var wasOpen = card.classList.contains('on');
    if (wasOpen) {
      /* moving between terms: snap back to the closed state with no transition,
         reposition off-screen-visible, then replay the entrance from the new anchor */
      card.style.transition = 'none';
      card.classList.remove('on');
    }
    place(a.el);
    if (wasOpen) {
      void card.offsetWidth;
      card.style.transition = '';
    }
    card.classList.add('on');
    a.el.setAttribute('aria-describedby', 'ctx-card');
    openedAt = Date.now();
    ANALYTICS.send('open', t);
  }

  function hide() {
    if (cur && openedAt) {
      /* Dwell separates a glance from a read. A card dismissed in 300ms did not
         answer anything; one held for four seconds did. */
      ANALYTICS.send('close', cur.term, Date.now() - openedAt, lastCost);
    }
    openedAt = 0;
    card.classList.remove('on');
    if (cur) cur.el.removeAttribute('aria-describedby');
    cur = null;
  }

  document.addEventListener('pointerdown', function () {
    viaPointer = true;
    setTimeout(function () { viaPointer = false; }, 600);
  }, true);

  anchors.forEach(function (a) {
    if (!coarse) {
      a.el.addEventListener('mouseenter', function () {
        clearTimeout(closeT);
        openT = setTimeout(function () { show(a); }, CFG.openDelay);
      });
      a.el.addEventListener('mouseleave', function () {
        clearTimeout(openT);
        closeT = setTimeout(hide, CFG.closeDelay);
      });
    }
    a.el.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      clearTimeout(openT);
      if (cur === a) hide(); else show(a);
    });
    /* Keyboard focus opens the card. Pointer-initiated focus does not:
       on touch it fires alongside click and would toggle the card shut. */
    a.el.addEventListener('focus', function () {
      if (viaPointer) return;
      show(a);
    });
    a.el.addEventListener('blur', function () {
      closeT = setTimeout(function () {
        if (!card.contains(document.activeElement)) hide();
      }, 100);
    });
  });

  card.addEventListener('mouseenter', function () { clearTimeout(closeT); });
  card.addEventListener('mouseleave', function () { closeT = setTimeout(hide, CFG.closeDelay); });
  document.addEventListener('click', function (e) { if (cur && !card.contains(e.target)) hide(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && cur) { var el = cur.el; hide(); el.focus(); }
  });
  /* No scroll reposition: the card is absolutely positioned, so it travels with
     the text already. Calling place() per frame re-triggered the transform
     transition on every scroll event, which is what made it stutter. */
  } /* end run */
})();
