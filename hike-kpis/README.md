# Weekly Clinical KPIs — Hike

An interactive, hosted dashboard for deal metrics (from HubSpot) and order
metrics (from Hike). Built with Next.js so it deploys to Vercel with no
configuration, and styled with the Hike brand tokens (SoleBlue, BoneWhite,
DM Sans) from the original design.

It runs in two modes:

- **mock** (default) — realistic sample data, no credentials. Deploy and see it
  working today.
- **live** — pulls real numbers from HubSpot and Hike once you add credentials.

---

## Run it locally

```bash
npm install
cp .env.example .env.local   # leave DATA_MODE=mock for now
npm run dev                  # open http://localhost:3000
```

You'll see the full dashboard on sample data: deal cards (new deals, pipeline
value, win rate), order cards (orders, revenue, fulfillment), a weekly trend,
plus the range filter and auto-refresh control.

---

## Deploy to Vercel

1. Push this folder to a Git repo (GitHub/GitLab/Bitbucket).
2. In Vercel, **Add New → Project**, import the repo. Framework auto-detects as
   Next.js; accept the defaults and **Deploy**.
3. You now have a live URL running on sample data. Share it, react to the
   layout, then go live with the steps below.

---

## Go live with real data

The dashboard reads its credentials only on the server (in the API routes), so
secrets never reach the browser. Add them in **Vercel → Project → Settings →
Environment Variables**, then redeploy.

### 1. HubSpot (deals)

1. In HubSpot: **Settings → Integrations → Private Apps → Create a private app**.
2. Under **Scopes**, enable the read scope `crm.objects.deals.read`.
3. Create the app and copy the **access token**.
4. In Vercel, set:
   - `HUBSPOT_TOKEN` = the access token
   - `HUBSPOT_PIPELINE` = your reporting pipeline's internal name (the standard
     sales pipeline is `default`; find others under
     **Settings → Objects → Deals → Pipelines**)

### 2. Hike (orders)

Hike's order data lives in an internal analytics database. Ask whoever runs the
internal tooling for **one** of the following:

- **Postgres (most common):** a read-only connection string. Set
  `HIKE_DATABASE_URL` in Vercel. Then open `lib/hike.ts` and adjust the table and
  column names in the two SQL queries (`orders`, `created_at`, `total`, `status`)
  to match the real schema.
- **REST API:** if Hike exposes HTTP endpoints, set `HIKE_API_BASE` and
  `HIKE_API_KEY`, then in `lib/hike.ts` uncomment the `restOrders` function and
  have `liveOrders` call it instead of `postgresOrders`.

### 3. Flip the switch

Set `DATA_MODE=live` in Vercel and redeploy. The dashboard now shows real
numbers. The "Sample data" badge disappears automatically.

---

## How it's organized

```
app/
  page.tsx              renders the dashboard
  layout.tsx            html shell + fonts
  globals.css           Hike brand tokens
  api/deals/route.ts    server endpoint: mock or HubSpot
  api/orders/route.ts   server endpoint: mock or Hike
components/
  Dashboard.tsx         the interactive UI (filters, refresh, cards, chart)
lib/
  types.ts              shared payload shapes + range parsing
  mock.ts               sample data generator
  hubspot.ts            live HubSpot deal fetcher
  hike.ts               live Hike order fetcher (Postgres + REST options)
```

## Notes

- **Why not reuse the Claude connectors?** The HubSpot/Hike MCP connectors are
  authenticated through your Claude session and can't be reused by a standalone
  server. A hosted app needs its own server-side credentials — that's the
  private-app token and the database connection above.
- **Auto-refresh** is client-side (the page re-fetches on an interval). For
  scheduled server-side refreshes you could later add a Vercel Cron job, but the
  interval covers a live wall-display use case without extra setup.
- **Currency** follows what HubSpot returns; the mock and Hike paths assume USD —
  adjust in `lib/hike.ts` if your orders are in another currency.
