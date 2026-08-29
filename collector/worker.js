/* Reference collector for ctx-cards analytics.
 *
 * Deploy on Cloudflare Workers with a D1 database bound as CTX_DB. This is
 * optional: most sites should use data-analytics="auto" and let events land in
 * the analytics they already run. Use this when you want the raw event stream.
 *
 *   wrangler d1 create ctx-analytics
 *   wrangler d1 execute ctx-analytics --file=schema.sql
 *   wrangler deploy
 *
 * Then point the script at it:
 *   data-analytics="https://ctx-collect.<subdomain>.workers.dev/collect"
 *
 * The payload carries no identifiers. This worker deliberately does not log IP
 * addresses, user agents, or referrers, because storing them alongside the
 * event stream would reintroduce exactly the identity the client avoided
 * sending. Only the day is retained, not the timestamp, so events cannot be
 * ordered into a per-visitor session after the fact.
 */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS events (
  day      TEXT NOT NULL,
  event    TEXT NOT NULL,
  term     TEXT NOT NULL,
  kind     TEXT NOT NULL,
  path     TEXT NOT NULL,
  n        INTEGER NOT NULL DEFAULT 0,
  dwell_ms INTEGER,
  words    INTEGER,
  cplx     INTEGER,
  PRIMARY KEY (day, event, term, kind, path)
);
CREATE INDEX IF NOT EXISTS idx_events_term ON events(term);
CREATE INDEX IF NOT EXISTS idx_events_day  ON events(day);
`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const EVENTS = new Set(["mark", "open", "close", "follow"]);
const MAX_BATCH = 200;
const MAX_LEN = 120;

function clean(s) {
  return typeof s === "string" ? s.slice(0, MAX_LEN) : "";
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (url.pathname === "/stats" && request.method === "GET") {
      // Aggregate read for a dashboard. Open rate per term is the number that
      // actually tells you whether a definition is pulling its weight.
      const { results } = await env.CTX_DB.prepare(`
        SELECT term, kind,
               SUM(CASE WHEN event='mark'   THEN n ELSE 0 END) AS marks,
               SUM(CASE WHEN event='open'   THEN n ELSE 0 END) AS opens,
               SUM(CASE WHEN event='follow' THEN n ELSE 0 END) AS follows,
               MAX(dwell_ms) AS max_dwell,
               MAX(words) AS words,
               MAX(cplx) AS cplx
        FROM events
        WHERE day >= date('now', '-30 days')
        GROUP BY term, kind
        ORDER BY opens DESC
        LIMIT 500
      `).all();
      // read_ratio normalises dwell against how much card there was to read,
      // so an acronym card and a verdict card become comparable. The constants
      // are a starting estimate; refit them once the distributions are real.
      const ORIENT = 250, MS_PER_WORD = 200, MS_PER_CPLX = 120;
      const rows = results.map(r => {
        const expected = r.words != null
          ? ORIENT + MS_PER_WORD * r.words + MS_PER_CPLX * (r.cplx || 0)
          : null;
        return {
          ...r,
          open_rate: r.marks ? +(r.opens / r.marks).toFixed(3) : null,
          expected_ms: expected,
          read_ratio: expected && r.max_dwell ? +(r.max_dwell / expected).toFixed(2) : null,
        };
      });
      return Response.json(rows, { headers: CORS });
    }

    if (url.pathname !== "/collect" || request.method !== "POST") {
      return new Response("Not found", { status: 404, headers: CORS });
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return new Response("Bad JSON", { status: 400, headers: CORS });
    }

    const events = Array.isArray(payload?.events) ? payload.events.slice(0, MAX_BATCH) : [];
    if (!events.length) return new Response(null, { status: 204, headers: CORS });

    await env.CTX_DB.exec(SCHEMA.replace(/\n/g, " "));
    const day = new Date().toISOString().slice(0, 10);

    // Upsert counts rather than appending rows: the table stays small, and
    // there is no row-per-hit history to correlate later even in principle.
    const stmt = env.CTX_DB.prepare(`
      INSERT INTO events (day, event, term, kind, path, n, dwell_ms, words, cplx)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
      ON CONFLICT(day, event, term, kind, path) DO UPDATE SET
        n = n + 1,
        words = COALESCE(excluded.words, events.words),
        cplx  = COALESCE(excluded.cplx,  events.cplx),
        dwell_ms = CASE
          WHEN excluded.dwell_ms IS NULL THEN events.dwell_ms
          WHEN events.dwell_ms IS NULL THEN excluded.dwell_ms
          ELSE (events.dwell_ms * events.n + excluded.dwell_ms) / (events.n + 1)
        END
    `);

    const batch = [];
    for (const e of events) {
      if (!EVENTS.has(e?.e) || !e?.t) continue;
      const dwell = Number.isFinite(e.d) ? Math.min(Math.round(e.d), 600000) : null;
      const words = Number.isFinite(e.w) ? Math.min(e.w, 1000) : null;
      const cplx = Number.isFinite(e.c) ? Math.min(e.c, 200) : null;
      batch.push(stmt.bind(day, e.e, clean(e.t), clean(e.k) || "term",
                           clean(e.p), dwell, words, cplx));
    }
    if (batch.length) await env.CTX_DB.batch(batch);

    return new Response(null, { status: 204, headers: CORS });
  },
};
