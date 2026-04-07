"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { fetchAirQuality, fetchPm25History, getSafetyInfo } from "@/lib/api";
import type { Pm25Day } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeaturedPark {
  name: string;
  nameTh: string;
  lat: number;
  lng: number;
  story: string;
  best_time: string;
  activities: string[];
  loop_km: number;
}

// ─── Load featured parks from GeoJSON ─────────────────────────────────────────

async function loadFeaturedParks(): Promise<FeaturedPark[]> {
  const res = await fetch("/park.geojson");
  const data: GeoJSON.FeatureCollection = await res.json();

  return data.features
    .filter((f) => f.properties?.featured === true)
    .map((f) => {
      const p = f.properties!;
      // Compute centroid
      let lat = 0, lng = 0;
      if (f.geometry.type === "Point") {
        [lng, lat] = (f.geometry as GeoJSON.Point).coordinates;
      } else if (f.geometry.type === "Polygon") {
        const ring = (f.geometry as GeoJSON.Polygon).coordinates[0];
        lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
        lng = ring.reduce((s, c) => s + c[0], 0) / ring.length;
      } else if (f.geometry.type === "MultiPolygon") {
        const ring = (f.geometry as GeoJSON.MultiPolygon).coordinates[0][0];
        lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
        lng = ring.reduce((s, c) => s + c[0], 0) / ring.length;
      }
      return {
        name: p["name:en"] ?? p.name ?? "Park",
        nameTh: p.name ?? "",
        lat,
        lng,
        story: p.story ?? "",
        best_time: p.best_time ?? "",
        activities: p.activities ?? [],
        loop_km: p.loop_km ?? 0,
        trend: p.trend ?? [],
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pm25Color(pm25: number | null): string {
  if (pm25 === null) return "#9ca3af";
  if (pm25 <= 25)  return "#16a34a";
  if (pm25 <= 50)  return "#d97706";
  if (pm25 <= 100) return "#dc2626";
  return "#7c3aed";
}

function runVerdict(pm25: number | null): { label: string; color: string } {
  if (pm25 === null) return { label: "No data", color: "#9ca3af" };
  if (pm25 <= 17)   return { label: "✅ Excellent for running", color: "#16a34a" };
  if (pm25 <= 25)   return { label: "✅ Good for running", color: "#16a34a" };
  if (pm25 <= 37)   return { label: "⚠️ Marginal — consider a mask", color: "#d97706" };
  return { label: "❌ Not recommended for running", color: "#dc2626" };
}

function trendPrediction(trend: number[]): number {
  // Simple weighted average — recent days count more
  const weights = [1, 1, 1, 2, 2, 3, 3];
  const total = weights.reduce((s, w) => s + w, 0);
  return Math.round(trend.reduce((s, v, i) => s + v * weights[i], 0) / total);
}

const ACTIVITY_ICONS: Record<string, string> = {
  run: "🏃",
  walk: "🚶",
  cycle: "🚴",
  yoga: "🧘",
  family: "👨‍👩‍👧",
  dog: "🐕",
};

// ─── Park card ────────────────────────────────────────────────────────────────

function ParkCard({ park }: { park: FeaturedPark }) {
  const [pm25, setPm25]         = useState<number | null>(null);
  const [loading, setLoading]   = useState(true);
  const [history, setHistory]   = useState<Pm25Day[]>([]);
  const [histLoading, setHistLoading] = useState(true);

  useEffect(() => {
    fetchAirQuality(park.lat, park.lng)
      .then((aq) => setPm25(aq.pm25))
      .catch(() => setPm25(null))
      .finally(() => setLoading(false));
    fetchPm25History(park.lat, park.lng)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setHistLoading(false));
  }, [park.lat, park.lng]);

  const safety    = getSafetyInfo(pm25);
  const verdict   = runVerdict(pm25);
  const avg       = history.length ? Math.round(history.reduce((s, d) => s + d.pm25, 0) / history.length) : null;
  const predicted = history.length ? trendPrediction(history.map((d) => d.pm25)) : null;
  const chartData = history.map((d) => ({ day: d.date, pm25: d.pm25 }));
  const gmapsUrl  = `https://www.google.com/maps/dir/?api=1&destination=${park.lat},${park.lng}`;

  return (
    <div className="rounded-3xl border border-white/60 bg-white/90 p-5 shadow-sm space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink leading-snug">{park.name}</h2>
          <p className="text-sm text-ink/50">{park.nameTh}</p>
          {park.loop_km > 0 && (
            <p className="text-xs text-ink/40 mt-0.5">🔄 {park.loop_km} km loop</p>
          )}
        </div>

        {/* Live PM2.5 badge */}
        <div
          className="flex flex-col items-center justify-center rounded-2xl px-4 py-2 shadow-sm shrink-0"
          style={{ backgroundColor: loading ? "#e5e7eb" : pm25Color(pm25) }}
        >
          <span className="text-2xl font-black text-white leading-none">
            {loading ? "…" : pm25 !== null ? Math.round(pm25) : "—"}
          </span>
          <span className="text-xs font-semibold text-white/80">PM2.5</span>
          <span className="text-xs text-white/70">{safety.emoji} {safety.level}</span>
          <span className="text-xs text-white/50">1-hr avg</span>
        </div>
      </div>

      {/* Running verdict */}
      {!loading && (
        <div
          className="rounded-2xl px-4 py-2.5"
          style={{ backgroundColor: verdict.color + "18", border: `1px solid ${verdict.color}40` }}
        >
          <p className="font-bold text-sm" style={{ color: verdict.color }}>{verdict.label}</p>
        </div>
      )}

      {/* Story */}
      <p className="text-sm text-ink/70 leading-relaxed">{park.story}</p>

      {/* Best time + activities */}
      <div className="flex flex-wrap gap-3 text-sm">
        <div className="rounded-xl bg-mist px-3 py-1.5">
          <span className="text-ink/50 text-xs">Best time · </span>
          <span className="font-semibold text-ink">{park.best_time}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {park.activities.map((a) => (
            <span key={a} title={a} className="text-lg">{ACTIVITY_ICONS[a] ?? "🌿"}</span>
          ))}
        </div>
      </div>

      {/* 7-day trend chart */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold text-ink/50">7-day PM2.5 trend · Open-Meteo · daily avg</p>
          {!histLoading && avg !== null && predicted !== null && (
            <div className="flex gap-3 text-xs text-ink/50">
              <span>Avg <strong className="text-ink">{avg}</strong></span>
              <span>Predicted <strong style={{ color: pm25Color(predicted) }}>{predicted}</strong></span>
            </div>
          )}
        </div>
        {histLoading && <p className="text-xs text-ink/40 py-4 text-center">Loading history…</p>}
        {!histLoading && chartData.length === 0 && <p className="text-xs text-ink/40 py-4 text-center">No historical data available</p>}
        {!histLoading && chartData.length > 0 && (
          <>
            <ResponsiveContainer width="100%" height={90}>
              <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, "auto"]} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 10, border: "none", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
                  formatter={(v: number) => [`${v} µg/m³`, "PM2.5"]}
                />
                <ReferenceLine y={25} stroke="#16a34a" strokeDasharray="3 3" strokeWidth={1} />
                <ReferenceLine y={50} stroke="#d97706" strokeDasharray="3 3" strokeWidth={1} />
                <Line
                  type="monotone"
                  dataKey="pm25"
                  stroke={pm25Color(avg)}
                  strokeWidth={2}
                  dot={{ r: 3, fill: pm25Color(avg) }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-ink/30 mt-1">Green line = safe (25 µg/m³) · Amber = moderate (50 µg/m³)</p>
          </>
        )}
      </div>

      {/* Directions */}
      <a
        href={gmapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-2xl bg-canopy/90 py-2.5 text-center text-sm font-semibold text-white hover:bg-canopy transition"
      >
        🗺️ Get directions
      </a>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ParksPage() {
  const [parks, setParks] = useState<FeaturedPark[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFeaturedParks().then(setParks).finally(() => setLoading(false));
  }, []);

  return (
    <main className="space-y-5">
      {/* Header */}
      <div className="rounded-3xl border border-white/60 bg-white/90 px-6 py-5 shadow-sm">
        <h1 className="text-2xl font-bold text-ink">🏃 Running Parks in Bangkok</h1>
        <p className="mt-1 text-sm text-ink/60">
          10 top parks ranked by air quality. Live PM2.5 data + 7-day trend. Know before you go.
        </p>
        <p className="mt-2 text-xs text-ink/40">
          Live data from <strong>AQICN</strong> · 1-hour average · US EPA PM2.5 scale · 7-day trend is simulated for demonstration
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink/50">
          {[
            { color: "#16a34a", label: "≤25 · Safe to run" },
            { color: "#d97706", label: "26–50 · Marginal" },
            { color: "#dc2626", label: ">50 · Not recommended" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5 rounded-full bg-mist px-2.5 py-1">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <p className="text-sm text-ink/40 px-2">Loading parks…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {parks.map((park) => (
            <ParkCard key={park.name} park={park} />
          ))}
        </div>
      )}
    </main>
  );
}
