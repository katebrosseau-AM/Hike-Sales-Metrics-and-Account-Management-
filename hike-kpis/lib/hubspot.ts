// HubSpot deal metrics for the "live" path. Talks to the HubSpot CRM
// v3 API with a private-app token held server-side. The browser never
// sees the token — only this route does.

import type { DealMetrics, WeeklyPoint } from "./types";

const BASE = "https://api.hubapi.com";

function headers() {
  const token = process.env.HUBSPOT_TOKEN;
  if (!token) {
    throw new Error(
      "HUBSPOT_TOKEN is not set. Add it in Vercel → Settings → Environment Variables.",
    );
  }
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function mondayKey(iso: string): string {
  const d = new Date(iso);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

// Page through a CRM search, collecting all matching deals.
async function searchDeals(body: Record<string, unknown>) {
  const results: any[] = [];
  let after: string | undefined;
  do {
    const res = await fetch(`${BASE}/crm/v3/objects/deals/search`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ ...body, limit: 100, after }),
      // Always hit HubSpot fresh; caching happens at the route level.
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HubSpot search failed (${res.status}): ${text}`);
    }
    const json = await res.json();
    results.push(...(json.results ?? []));
    after = json.paging?.next?.after;
  } while (after);
  return results;
}

export async function liveDeals(start: Date, end: Date): Promise<DealMetrics> {
  const pipeline = process.env.HUBSPOT_PIPELINE || "default";
  const startMs = start.getTime();
  const endMs = end.getTime();

  // Deals created within the window, on the reporting pipeline.
  const created = await searchDeals({
    filterGroups: [
      {
        filters: [
          { propertyName: "createdate", operator: "BETWEEN", value: startMs, highValue: endMs },
          { propertyName: "pipeline", operator: "EQ", value: pipeline },
        ],
      },
    ],
    properties: ["createdate", "amount", "dealstage", "deal_currency_code"],
    sorts: [{ propertyName: "createdate", direction: "ASCENDING" }],
  });

  // Open deals on the pipeline, for pipeline value (any create date).
  const open = await searchDeals({
    filterGroups: [
      {
        filters: [
          { propertyName: "pipeline", operator: "EQ", value: pipeline },
          { propertyName: "hs_is_closed", operator: "EQ", value: "false" },
        ],
      },
    ],
    properties: ["amount", "deal_currency_code"],
  });

  // Closed deals in the window, for win rate.
  const closed = await searchDeals({
    filterGroups: [
      {
        filters: [
          { propertyName: "pipeline", operator: "EQ", value: pipeline },
          { propertyName: "hs_is_closed", operator: "EQ", value: "true" },
          { propertyName: "closedate", operator: "BETWEEN", value: startMs, highValue: endMs },
        ],
      },
    ],
    properties: ["hs_is_closed_won", "amount"],
  });

  const pipelineValue = open.reduce(
    (sum, d) => sum + Number(d.properties.amount ?? 0),
    0,
  );

  const won = closed.filter(
    (d) => String(d.properties.hs_is_closed_won) === "true",
  ).length;
  const winRate = closed.length > 0 ? won / closed.length : 0;

  // Bucket created deals into weeks.
  const byWeek = new Map<string, number>();
  for (const d of created) {
    const key = mondayKey(d.properties.createdate);
    byWeek.set(key, (byWeek.get(key) ?? 0) + 1);
  }
  const weekly: WeeklyPoint[] = [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, value]) => ({ week, value }));

  const currency =
    created[0]?.properties?.deal_currency_code ||
    open[0]?.properties?.deal_currency_code ||
    "USD";

  return {
    newDeals: created.length,
    pipelineValue,
    winRate,
    currency,
    weekly,
  };
}
