// Realistic sample data so the dashboard runs and deploys before any
// credentials exist. Deterministic-ish (seeded by week) so the trend
// line looks stable across refreshes rather than jumping randomly.

import type { DealMetrics, OrderMetrics, WeeklyPoint } from "./types";

function mondayOf(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // 0 = Monday
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function weeksBetween(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  let cur = mondayOf(start);
  const last = mondayOf(end);
  while (cur <= last) {
    out.push(new Date(cur));
    cur = new Date(cur);
    cur.setDate(cur.getDate() + 7);
  }
  return out;
}

// Small seeded wobble so numbers feel organic but don't flicker.
function wobble(seed: number, base: number, spread: number): number {
  const n = Math.sin(seed * 12.9898) * 43758.5453;
  const frac = n - Math.floor(n);
  return Math.round(base + (frac - 0.5) * 2 * spread);
}

export function mockDeals(start: Date, end: Date): DealMetrics {
  const weeks = weeksBetween(start, end);
  const weekly: WeeklyPoint[] = weeks.map((w, i) => ({
    week: w.toISOString().slice(0, 10),
    value: Math.max(0, wobble(w.getTime() / 6.048e8, 14 + i * 0.4, 4)),
  }));
  const newDeals = weekly.reduce((s, p) => s + p.value, 0);
  return {
    newDeals,
    pipelineValue: 1_280_000 + wobble(weeks.length, 0, 90_000),
    winRate: 0.32,
    currency: "USD",
    weekly,
  };
}

export function mockOrders(start: Date, end: Date): OrderMetrics {
  const weeks = weeksBetween(start, end);
  const weekly: WeeklyPoint[] = weeks.map((w, i) => ({
    week: w.toISOString().slice(0, 10),
    value: Math.max(0, wobble(w.getTime() / 6.048e8 + 7, 210 + i * 3, 35)),
  }));
  const orderCount = weekly.reduce((s, p) => s + p.value, 0);
  return {
    orderCount,
    revenue: orderCount * 268,
    fulfillmentRate: 0.94,
    currency: "USD",
    weekly,
  };
}
