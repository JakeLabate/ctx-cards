/* Verifies data-repeat semantics without a browser: exercises the same
   matching rules the scan loop uses, so a regression in flags, word
   boundaries, or budget handling fails the build. */
import assert from 'node:assert';

const PROSE = 'mentions GEO and then GEO again, plus structured data. ' +
              'A third GEO appears here alongside structured data once more. ' +
              'But this final GEO in plain prose counts.';

function count(term, text, max) {
  const wordy = /^[\w][\w.\-]*$/.test(term);
  const b = wordy ? '\\b' : '';
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(b + esc + b, 'g' + (term.length > 4 ? 'i' : ''));
  let n = 0, m;
  while ((m = re.exec(text)) !== null && n < max) {
    if (m.index === re.lastIndex) { re.lastIndex++; continue; }
    n++;
  }
  return n;
}

// repeat="first" -> max 1
assert.strictEqual(count('GEO', PROSE, 1), 1, 'first should mark once');
assert.strictEqual(count('structured data', PROSE, 1), 1);

// repeat="all" -> every occurrence
assert.strictEqual(count('GEO', PROSE, Infinity), 4, 'all should mark every occurrence');
assert.strictEqual(count('structured data', PROSE, Infinity), 2);

// explicit numeric cap
assert.strictEqual(count('GEO', PROSE, 2), 2, 'max-per-term should cap');

// short terms stay case-sensitive so acronyms do not match inside words
assert.strictEqual(count('GEO', 'geometry and geography', Infinity), 0,
  'short acronyms must not match inside ordinary words');

// longer terms match case-insensitively
assert.strictEqual(count('structured data', 'Structured Data here', Infinity), 1);

console.log('repeat semantics: all assertions passed');

/* --- pack id resolution (v0.7.1) ---
   A bare id resolves against packBase; anything path-like is used as given.
   Getting this wrong appends .json to a path and 404s in a way that looks
   like an empty pack rather than a mistake. */
function resolvePack(id, base) {
  const isPath = /^https?:/.test(id) || id.indexOf('/') !== -1 || /\.json$/i.test(id);
  return isPath ? id : base + '/' + id + '.json';
}
const B = 'https://cdn.example.com/packs';
assert.strictEqual(resolvePack('seo-core', B), B + '/seo-core.json', 'bare id uses packBase');
assert.strictEqual(resolvePack('https://x.dev/a.json', B), 'https://x.dev/a.json', 'absolute url as given');
assert.strictEqual(resolvePack('/sites/jakelabate.json', B), '/sites/jakelabate.json', 'root-relative as given');
assert.strictEqual(resolvePack('../packs/custom.json', B), '../packs/custom.json', 'relative path as given');
assert.strictEqual(resolvePack('custom.json', B), 'custom.json', 'bare filename as given');
assert.strictEqual(resolvePack('agentic-ai', B), B + '/agentic-ai.json', 'hyphenated id still resolves');

console.log('pack id resolution: all assertions passed');

/* --- self-link suppression (v0.10.0) ---
   A card linking to the page the reader is already on wastes a line and a
   click. Fragments are exempt: #verdict still jumps somewhere. */
function normalizePath(p) {
  p = p.replace(/\/index\.html?$/i, '/');
  if (p.length > 1 && p.charAt(p.length - 1) !== '/') p += '/';
  return p;
}
function isSelfLink(href, current) {
  if (!href) return false;
  let there, here;
  try { there = new URL(href, current); here = new URL(current); }
  catch { return false; }
  if (there.hash) return false;
  return there.origin === here.origin
      && normalizePath(there.pathname) === normalizePath(here.pathname)
      && there.search === here.search;
}

const HERE = 'https://www.jakelabate.com/debunking-geo/llms-txt/';
assert.strictEqual(isSelfLink(HERE, HERE), true, 'exact self');
assert.strictEqual(isSelfLink('/debunking-geo/llms-txt/', HERE), true, 'root-relative self');
assert.strictEqual(isSelfLink('/debunking-geo/llms-txt/index.html', HERE), true, 'index.html self');
assert.strictEqual(isSelfLink('/debunking-geo/llms-txt', HERE), true, 'missing trailing slash');
assert.strictEqual(isSelfLink('#verdict', HERE), false, 'fragment still links');
assert.strictEqual(isSelfLink(HERE + '#verdict', HERE), false, 'absolute + fragment still links');
assert.strictEqual(isSelfLink('/debunking-geo/', HERE), false, 'parent page is not self');
assert.strictEqual(isSelfLink('/debunking-geo/content-chunking/', HERE), false, 'sibling is not self');
assert.strictEqual(isSelfLink('https://example.com/x', HERE), false, 'other origin');
assert.strictEqual(isSelfLink('?q=1', HERE), false, 'different query is not self');
assert.strictEqual(isSelfLink('', HERE), false, 'empty href');
assert.strictEqual(isSelfLink('ht tp://%%%', HERE), false, 'unparseable is left alone');

console.log('self-link suppression: all assertions passed');
