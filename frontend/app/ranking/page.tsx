"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchEnrichedParks,
  fetchPm25Stations,
  getSafetyInfo,
  idwPm25,
  pm25ToAqi,
} from "@/lib/api";
import type { EnrichedPark, Pm25Station } from "@/lib/api";

type SortKey = "aqi" | "name";

export default function RankingPage() {
  const router = useRouter();
  const [enrichedParks, setEnrichedParks] = useState<EnrichedPark[]>([]);
  const [stations, setStations]           = useState<Pm25Station[]>([]);
  const [parksLoading, setParksLoading]   = useState(true);
  const [stationsLoading, setStationsLoading] = useState(true);
  const [sortKey, setSortKey]             = useState<SortKey>("aqi");
  const [search, setSearch]               = useState("");

  useEffect(() => {
    fetchEnrichedParks()
      .then(setEnrichedParks)
      .catch(() => {})
      .finally(() => setParksLoading(false));
  }, []);

  useEffect(() => {
    fetchPm25Stations()
      .then(setStations)
      .catch(() => {})
      .finally(() => setStationsLoading(false));
  }, []);

  const ranked = useMemo(() => {
    const list = enrichedParks
      .filter((p) => p.centroid)
      .map((p) => {
        const result = stations.length > 0 ? idwPm25(p.centroid![0], p.centroid![1], stations, 40) : null;
        return { ...p, pm25: result?.pm25 ?? null };
      });

    if (sortKey === "aqi") {
      // parks with data first (cleanest→worst), then no-data parks alphabetically
      const withData    = list.filter((p) => p.pm25 !== null).sort((a, b) => (a.pm25 ?? 999) - (b.pm25 ?? 999));
      const withoutData = list.filter((p) => p.pm25 === null).sort((a, b) => a.nameEn.localeCompare(b.nameEn));
      return [...withData, ...withoutData];
    }
    return list.sort((a, b) => a.nameEn.localeCompare(b.nameEn));
  }, [enrichedParks, stations, sortKey]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ranked;
    return ranked.filter((p) => p.nameEn.toLowerCase().includes(q) || p.nameTh.includes(search.trim()));
  }, [ranked, search]);

  const loading = parksLoading || (stationsLoading && stations.length === 0);

  function activityLabel(pm25: number | null) {
    if (pm25 === null) return "—";
    if (pm25 <= 25)  return "Safe to run";
    if (pm25 <= 50)  return "Light activity";
    if (pm25 <= 100) return "Wear mask";
    return "Avoid outdoors";
  }

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="rounded-3xl border border-white/60 bg-white/90 px-6 py-5 shadow-sm">
        <h1 className="text-2xl font-black text-ink">🏆 Park Air Quality Ranking</h1>
        <p className="mt-1 text-sm text-ink/50">
          All {ranked.length} parks ranked by real-time PM2.5 · IDW interpolation · updated live
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search parks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-xl border border-ink/10 bg-white px-4 py-2 text-sm outline-none focus:border-canopy min-w-48"
        />
        <div className="flex rounded-xl border border-ink/10 bg-white p-1 gap-1">
          <button
            onClick={() => setSortKey("aqi")}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${sortKey === "aqi" ? "bg-canopy text-white" : "text-ink/50 hover:text-ink"}`}
          >
            Cleanest first
          </button>
          <button
            onClick={() => setSortKey("name")}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${sortKey === "name" ? "bg-canopy text-white" : "text-ink/50 hover:text-ink"}`}
          >
            A–Z
          </button>
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex animate-pulse items-center gap-4 rounded-2xl bg-white/90 px-5 py-4 shadow-sm">
              <div className="h-6 w-6 rounded-full bg-ink/10" />
              <div className="h-4 w-4 rounded-full bg-ink/10" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/2 rounded bg-ink/10" />
                <div className="h-3 w-1/3 rounded bg-ink/8" />
              </div>
              <div className="h-8 w-20 rounded-xl bg-ink/10" />
            </div>
          ))}
        </div>
      )}

      {/* No data */}
      {!loading && filtered.length === 0 && (
        <div className="rounded-2xl border border-ink/8 bg-white/90 px-6 py-8 text-center text-sm text-ink/40">
          No parks found.
        </div>
      )}

      {/* Ranked list */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((park) => {
            const safety   = getSafetyInfo(park.pm25);
            const aqi      = park.pm25 !== null ? pm25ToAqi(park.pm25) : null;
            const label    = activityLabel(park.pm25);
            const rankNum  = ranked.indexOf(park) + 1;
            const rankDisp = sortKey === "aqi" && park.pm25 !== null
              ? (rankNum === 1 ? "🥇" : rankNum === 2 ? "🥈" : rankNum === 3 ? "🥉" : `#${rankNum}`)
              : null;

            return (
              <div
                key={park.id}
                onClick={() => router.push(`/map?parkId=${park.id}`)}
                className={`flex cursor-pointer items-center gap-4 rounded-2xl px-4 py-3 shadow-sm transition hover:shadow-md ${rankNum === 1 && sortKey === "aqi" && park.pm25 !== null ? "border-2 border-canopy bg-canopy/5 hover:border-canopy" : "border border-white/60 bg-white/90 hover:border-canopy/40"}`}
              >
                {/* Park image with rank overlaid — LEFT */}
                <div className="relative shrink-0 overflow-hidden rounded-xl" style={{ width: 80, height: 64 }}>
                  {park.image ? (
                    <img src={park.image} alt={park.nameEn} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl" style={{ backgroundColor: safety.color + "20" }}>
                      🌿
                    </div>
                  )}
                  {rankDisp && (
                    <span className="absolute left-1 top-1 rounded-md bg-black/50 px-1.5 py-0.5 text-xs font-black text-white backdrop-blur-sm">
                      {rankDisp}
                    </span>
                  )}
                </div>

                {/* Name + district */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                    <p className="truncate font-semibold text-ink">{park.nameEn}</p>
                    {rankNum === 1 && sortKey === "aqi" && park.pm25 !== null && (
                      <span className="shrink-0 rounded-full bg-canopy px-2 py-0.5 text-xs font-black text-white">
                        ✅ Go here today!
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-ink/40">{park.nameTh}</p>
                  {park.district && <p className="truncate text-xs text-ink/30">📍 {park.district}</p>}
                  {rankNum === 1 && sortKey === "aqi" && park.pm25 !== null && (
                    <p className="text-xs font-medium text-canopy/80 mt-0.5">Cleanest air in Bangkok right now</p>
                  )}
                </div>

                {/* Activity label — hidden on small screens */}
                <span
                  className="hidden shrink-0 rounded-full px-3 py-1 text-xs font-semibold sm:inline"
                  style={{ background: safety.color + "20", color: safety.color }}
                >
                  {label}
                </span>

                {/* AQI box — RIGHT */}
                <div
                  className="flex shrink-0 flex-col items-center justify-center rounded-xl px-3 py-2 text-white"
                  style={{ backgroundColor: safety.color, minWidth: 64 }}
                >
                  <span className="text-xl font-black leading-none">{aqi ?? "—"}</span>
                  <span className="text-xs font-semibold opacity-80">US AQI</span>
                  <span className="text-xs opacity-60">{label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
