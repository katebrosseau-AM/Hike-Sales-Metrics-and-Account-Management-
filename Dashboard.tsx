"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { DealMetrics, OrderMetrics } from "@/lib/types";

const RANGES = [
  { label: "4 weeks", days: 28 },
  { label: "8 weeks", days: 56 },
  { label: "13 weeks", days: 91 },
];

const REFRESH = [
  { label: "Off", ms: 0 },
  { label: "1 min", ms: 60_000 },
  { label: "5 min", ms: 300_000 },
];

function money(n: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function count(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
}

export default function Dashboard() {
  const [days, setDays] = useState(28);
  const [refreshMs, setRefreshMs] = useState(0);
  const [deals, setDeals] = useState<DealMetrics | null>(null);
  const [orders, setOrders] = useState<OrderMetrics | null>(null);
  const [mode, setMode] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, o] = await Promise.all([
        fetch(`/api/deals?days=${days}`).then((r) => r.json()),
        fetch(`/api/orders?days=${days}`).then((r) => r.json()),
      ]);
      if (d.error || o.error) {
        setError(d.error || o.error);
      } else {
        setDeals(d);
        setOrders(o);
        setMode(d.mode);
        setUpdatedAt(new Date());
      }
    } catch {
      setError("Couldn't reach the server. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (refreshMs === 0) return;
    const id = setInterval(load, refreshMs);
    return () => clearInterval(id);
  }, [refreshMs, load]);

  // Merge the two weekly trends onto a shared week axis for one chart.
  const trend = mergeWeekly(deals?.weekly, orders?.weekly);

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Hike Medical</p>
          <h1 style={styles.title}>Weekly Clinical KPIs</h1>
        </div>
        <div style={styles.status}>
          {mode === "mock" && (
            <span style={styles.badge}>Sample data — add credentials to go live</span>
          )}
          {updatedAt && (
            <span style={styles.updated}>
              Updated {updatedAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </header>

      <section style={styles.controls} aria-label="Filters">
        <Control label="Range">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              aria-pressed={days === r.days}
              style={days === r.days ? styles.pillActive : styles.pill}
            >
              {r.label}
            </button>
          ))}
        </Control>
        <Control label="Auto-refresh">
          {REFRESH.map((r) => (
            <button
              key={r.ms}
              onClick={() => setRefreshMs(r.ms)}
              aria-pressed={refreshMs === r.ms}
              style={refreshMs === r.ms ? styles.pillActive : styles.pill}
            >
              {r.label}
            </button>
          ))}
        </Control>
        <button onClick={load} style={styles.refreshBtn} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh now"}
        </button>
      </section>

      {error && <div style={styles.error}>{error}</div>}

      <section style={styles.cards} aria-label="Deal metrics">
        <h2 style={styles.groupHead}>Deals</h2>
        <div style={styles.cardRow}>
          <Card label="New deals" value={deals ? count(deals.newDeals) : "—"} sub={`Last ${days} days`} />
          <Card label="Pipeline value" value={deals ? money(deals.pipelineValue, deals.currency) : "—"} sub="Open deals" />
          <Card label="Win rate" value={deals ? pct(deals.winRate) : "—"} sub="Closed in range" />
        </div>
      </section>

      <section style={styles.cards} aria-label="Order metrics">
        <h2 style={styles.groupHead}>Orders</h2>
        <div style={styles.cardRow}>
          <Card label="Orders" value={orders ? count(orders.orderCount) : "—"} sub={`Last ${days} days`} />
          <Card label="Revenue" value={orders ? money(orders.revenue, orders.currency) : "—"} sub="In range" />
          <Card label="Fulfillment" value={orders ? pct(orders.fulfillmentRate) : "—"} sub="Fulfilled / total" />
        </div>
      </section>

      <section style={styles.chartCard} aria-label="Weekly trend">
        <h2 style={styles.groupHead}>Weekly trend</h2>
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <LineChart data={trend} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 12, fill: "#6e6e6e" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#6e6e6e" }} tickLine={false} axisLine={false} width={36} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)", fontSize: 13 }} />
              <Line type="monotone" dataKey="deals" name="New deals" stroke="#024ae3" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="orders" name="Orders" stroke="#00b3c0" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={styles.legend}>
          <Legend color="#024ae3" label="New deals" />
          <Legend color="#00b3c0" label="Orders" />
        </div>
      </section>
    </main>
  );
}

function mergeWeekly(
  a?: { week: string; value: number }[],
  b?: { week: string; value: number }[],
) {
  const weeks = new Set<string>();
  a?.forEach((p) => weeks.add(p.week));
  b?.forEach((p) => weeks.add(p.week));
  const dealMap = new Map(a?.map((p) => [p.week, p.value]));
  const orderMap = new Map(b?.map((p) => [p.week, p.value]));
  return [...weeks]
    .sort()
    .map((week) => ({
      week: week.slice(5), // MM-DD for a tidier axis
      deals: dealMap.get(week) ?? 0,
      orders: orderMap.get(week) ?? 0,
    }));
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={styles.control}>
      <span style={styles.controlLabel}>{label}</span>
      <div style={styles.pillRow}>{children}</div>
    </div>
  );
}

function Card({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={styles.card}>
      <span style={styles.cardLabel}>{label}</span>
      <span style={styles.cardValue}>{value}</span>
      <span style={styles.cardSub}>{sub}</span>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={styles.legendItem}>
      <span style={{ ...styles.legendDot, background: color }} />
      {label}
    </span>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 1080, margin: "0 auto", padding: "48px 24px 80px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16, marginBottom: 32 },
  eyebrow: { color: "#024ae3", fontWeight: 600, fontSize: 14, letterSpacing: "0.02em", textTransform: "uppercase" },
  title: { fontSize: 40, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.05, marginTop: 4 },
  status: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 },
  badge: { background: "#e6edfc", color: "#002471", fontSize: 13, fontWeight: 500, padding: "6px 12px", borderRadius: 999 },
  updated: { color: "#6e6e6e", fontSize: 13 },
  controls: { display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 24, marginBottom: 32 },
  control: { display: "flex", flexDirection: "column", gap: 8 },
  controlLabel: { fontSize: 13, color: "#6e6e6e", fontWeight: 500 },
  pillRow: { display: "flex", gap: 8 },
  pill: { background: "#fff", border: "1px solid rgba(0,0,0,0.12)", color: "#515151", padding: "8px 16px", borderRadius: 999, fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" },
  pillActive: { background: "#024ae3", border: "1px solid #024ae3", color: "#fff", padding: "8px 16px", borderRadius: 999, fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" },
  refreshBtn: { marginLeft: "auto", background: "#001442", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 999, fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" },
  error: { background: "#fff", border: "1px solid #f0c9c9", color: "#9a2a2a", padding: "12px 16px", borderRadius: 12, marginBottom: 24, fontSize: 14 },
  cards: { marginBottom: 32 },
  groupHead: { fontSize: 14, fontWeight: 600, color: "#737687", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 },
  cardRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 },
  card: { background: "#fff", borderRadius: 20, padding: 24, boxShadow: "6px 6px 24px rgba(0,0,0,0.08)", display: "flex", flexDirection: "column", gap: 6 },
  cardLabel: { fontSize: 14, color: "#6e6e6e", fontWeight: 500 },
  cardValue: { fontSize: 36, fontWeight: 600, letterSpacing: "-0.03em", color: "#151619" },
  cardSub: { fontSize: 13, color: "#737687" },
  chartCard: { background: "#fff", borderRadius: 20, padding: 24, boxShadow: "6px 6px 24px rgba(0,0,0,0.08)" },
  legend: { display: "flex", gap: 20, marginTop: 12 },
  legendItem: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#515151" },
  legendDot: { width: 12, height: 12, borderRadius: 999, display: "inline-block" },
};
