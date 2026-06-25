// Hike order metrics for the "live" path.
//
// Two ways to connect, depending on what the internal tooling team
// hands you. By default this uses Postgres (HIKE_DATABASE_URL), which
// is the usual shape for an internal analytics DB. If Hike instead
// exposes a REST API, jump to the REST branch marked below and switch
// which function `liveOrders` calls.

import { Pool } from "pg";
import type { OrderMetrics, WeeklyPoint } from "./types";

// ---- Option A: Postgres -------------------------------------------------
// One pool per server instance. Vercel reuses warm instances, so this
// avoids opening a new connection on every request.
let pool: Pool | null = null;
function getPool(): Pool {
  if (!process.env.HIKE_DATABASE_URL) {
    throw new Error(
      "HIKE_DATABASE_URL is not set. Add the read-only Postgres connection string in Vercel.",
    );
  }
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.HIKE_DATABASE_URL,
      // Most managed Postgres requires TLS; relax verification only if the
      // internal cert isn't in the trust store. Tighten if you can.
      ssl: { rejectUnauthorized: false },
      max: 3,
    });
  }
  return pool;
}

async function postgresOrders(
  start: Date,
  end: Date,
): Promise<OrderMetrics> {
  const db = getPool();

  // NOTE: table and column names below are placeholders matching a typical
  // orders table. Adjust `orders`, `created_at`, `total`, `status` to your
  // actual schema — the internal tooling team or `list_tables` will tell you.
  const summary = await db.query(
    `
    SELECT
      COUNT(*)::int                                            AS order_count,
      COALESCE(SUM(total), 0)::float                           AS revenue,
      COALESCE(
        AVG(CASE WHEN status = 'fulfilled' THEN 1 ELSE 0 END), 0
      )::float                                                 AS fulfillment_rate
    FROM orders
    WHERE created_at >= $1 AND created_at < $2
    `,
    [start, end],
  );

  const weeklyRows = await db.query(
    `
    SELECT
      to_char(date_trunc('week', created_at), 'YYYY-MM-DD') AS week,
      COUNT(*)::int                                          AS value
    FROM orders
    WHERE created_at >= $1 AND created_at < $2
    GROUP BY 1
    ORDER BY 1
    `,
    [start, end],
  );

  const row = summary.rows[0] ?? {};
  const weekly: WeeklyPoint[] = weeklyRows.rows.map((r: any) => ({
    week: r.week,
    value: Number(r.value),
  }));

  return {
    orderCount: Number(row.order_count ?? 0),
    revenue: Number(row.revenue ?? 0),
    fulfillmentRate: Number(row.fulfillment_rate ?? 0),
    currency: "USD",
    weekly,
  };
}

// ---- Option B: REST API -------------------------------------------------
// Uncomment and adapt if Hike exposes HTTP endpoints instead of Postgres,
// then have `liveOrders` call `restOrders` instead of `postgresOrders`.
//
// async function restOrders(start: Date, end: Date): Promise<OrderMetrics> {
//   const base = process.env.HIKE_API_BASE;
//   const key = process.env.HIKE_API_KEY;
//   if (!base || !key) throw new Error("HIKE_API_BASE / HIKE_API_KEY not set.");
//   const url = new URL("/orders/summary", base);
//   url.searchParams.set("start", start.toISOString());
//   url.searchParams.set("end", end.toISOString());
//   const res = await fetch(url, {
//     headers: { Authorization: `Bearer ${key}` },
//     cache: "no-store",
//   });
//   if (!res.ok) throw new Error(`Hike API failed (${res.status})`);
//   const json = await res.json();
//   return {
//     orderCount: json.orderCount,
//     revenue: json.revenue,
//     fulfillmentRate: json.fulfillmentRate,
//     currency: json.currency ?? "USD",
//     weekly: json.weekly,
//   };
// }

export async function liveOrders(
  start: Date,
  end: Date,
): Promise<OrderMetrics> {
  // Default path. Swap to `restOrders(start, end)` if you use Option B.
  return postgresOrders(start, end);
}
