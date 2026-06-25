// Shapes returned by the two API routes. The frontend imports these
// so the cards and charts stay in sync with what the server sends.

export interface DealMetrics {
  newDeals: number; // deals created in the window
  pipelineValue: number; // sum of open-deal amounts, home currency
  winRate: number; // 0..1, closed-won / (closed-won + closed-lost)
  currency: string; // e.g. "USD"
  weekly: WeeklyPoint[]; // trend of new deals by week
}

export interface OrderMetrics {
  orderCount: number; // orders placed in the window
  revenue: number; // summed order revenue
  fulfillmentRate: number; // 0..1, fulfilled / total
  currency: string;
  weekly: WeeklyPoint[]; // trend of orders by week
}

export interface WeeklyPoint {
  week: string; // ISO date of the week's Monday, e.g. "2026-06-15"
  value: number;
}

export type DataMode = "mock" | "live";

export function dataMode(): DataMode {
  return process.env.DATA_MODE === "live" ? "live" : "mock";
}

// Inclusive day count for a date range, defaulting to the last 28 days.
export function rangeFromParams(searchParams: URLSearchParams): {
  start: Date;
  end: Date;
} {
  const end = searchParams.get("end")
    ? new Date(searchParams.get("end")!)
    : new Date();
  const days = Number(searchParams.get("days") ?? 28);
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return { start, end };
}
