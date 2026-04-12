"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  fetchAirQuality,
  fetchEnrichedParks,
  fetchPm25Stations,
  getSafetyInfo,
  idwPm25,
  pm25ToAqi,
  reverseGeocode,
} from "@/lib/api";
import type {
  AirQualityData,
  EnrichedPark,
  LocationData,
  Pm25Station,
  SafetyInfo,
} from "@/lib/api";

const DynamicMapView = dynamic(
  () => import("@/components/MapView").then((m) => m.MapView),
  { ssr: false, loading: () => <div style={{ width: "100%", height: "100%", background: "#e8f0eb" }} /> }
);

type Basemap = "satellite" | "street";

const CATEGORY_GROUPS = [
  { title: "Activities",         labels: ["Pedal Boating","Cycling","Fitness","Basketball","Running Track","Playground","Swimming Pool","Badminton","Skateboard"] },
  { title: "Pets",               labels: ["Pet Friendly"] },
  { title: "Bathroom",           labels: ["Restroom"] },
  { title: "Transportation",     labels: ["Bus Access","BTS/MRT","Parking"] },
  { title: "Elderly & Disabled", labels: ["Accessible","Guide Dogs"] },
];

const LEGEND_ITEMS = [
  { color: "#3b82f6", label: "Your location" },
  { color: "#22c55e", label: "Park" },
  { color: "#16a34a", label: "≤25 Safe" },
  { color: "#d97706", label: "26–50 Moderate" },
  { color: "#dc2626", label: "51–100 Unhealthy" },
  { color: "#7c3aed", label: ">100 Dangerous" },
  { color: "#6366f1", label: "Dropped pin" },
];

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
function fmtDist(m: number) { return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`; }

// ─── Shared style helpers ─────────────────────────────────────────────────────

const PANEL_BG = "rgba(255,255,255,0.97)";

const secLabel: React.CSSProperties = {
  display: "block", fontSize: 9, fontWeight: 800, color: "#9ca3af",
  textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4,
};
const chip = (active: boolean, accent: string): React.CSSProperties => ({
  borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 700,
  cursor: "pointer", border: "none",
  background: active ? accent : "#f3f4f6",
  color: active ? "white" : "#374151",
});

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FullscreenMapPage() {
  const [userCoords, setUserCoords]       = useState<[number, number] | null>(null);
  const [location, setLocation]           = useState<LocationData | null>(null);
  const [airQuality, setAirQuality]       = useState<AirQualityData | null>(null);
  const [safety, setSafety]               = useState<SafetyInfo>(getSafetyInfo(null));
  const [enrichedParks, setEnrichedParks] = useState<EnrichedPark[]>([]);
  const [stations, setStations]           = useState<Pm25Station[]>([]);
  const [bufferKm, setBufferKm]           = useState(2);
  const [basemap, setBasemap]             = useState<Basemap>("satellite");
  const [showSensorBuffers, setShowSensorBuffers] = useState(true);
  const [showChoropleth, setShowChoropleth] = useState(false);
  const [flyToCoords, setFlyToCoords]     = useState<[number, number] | null>(null);
  const [openParkId, setOpenParkId]       = useState<{ id: number; tick: number } | null>(null);
  const [search, setSearch]               = useState("");
  const [searchOpen, setSearchOpen]       = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async ({ coords: c }) => {
        const lat = c.latitude, lng = c.longitude;
        setUserCoords([lat, lng]);
        const [aq, loc] = await Promise.all([
          fetchAirQuality(lat, lng).catch(() => null),
          reverseGeocode(lat, lng).catch(() => null),
        ]);
        if (aq) { setAirQuality(aq); setSafety(getSafetyInfo(aq.pm25)); }
        if (loc) setLocation(loc);
      },
      () => {}, { timeout: 10000 }
    );
  }, []);

  useEffect(() => { fetchPm25Stations().then(setStations).catch(() => {}); }, []);

  useEffect(() => {
    if (!userCoords || stations.length === 0) return;
    const r = idwPm25(userCoords[0], userCoords[1], stations);
    if (r) { setAirQuality((p) => p ? { ...p, pm25: r.pm25 } : p); setSafety(getSafetyInfo(r.pm25)); }
  }, [stations, userCoords]);

  useEffect(() => { fetchEnrichedParks().then(setEnrichedParks).catch(() => {}); }, []);

  const allDistricts = useMemo(() => {
    const m = new Map<string, number>();
    enrichedParks.forEach((p) => { if (p.district) m.set(p.district, (m.get(p.district) ?? 0) + 1); });
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0], "th")).map(([name, count]) => ({ name, count }));
  }, [enrichedParks]);

  const categoryGroups = useMemo(() => {
    const counts = new Map<string, number>(), icons = new Map<string, string>();
    enrichedParks.forEach((p) => p.categories.forEach((c) => {
      counts.set(c.label, (counts.get(c.label) ?? 0) + 1);
      if (!icons.has(c.label)) icons.set(c.label, c.icon);
    }));
    return CATEGORY_GROUPS.map((g) => ({
      title: g.title,
      items: g.labels.filter((l) => counts.has(l)).map((l) => ({ icon: icons.get(l) ?? "", label: l, count: counts.get(l)! })),
    })).filter((g) => g.items.length > 0);
  }, [enrichedParks]);

  const parksWithDistance = useMemo(() =>
    enrichedParks.filter((p) => p.centroid).map((p) => ({
      ...p,
      distanceM: userCoords ? haversineM(userCoords[0], userCoords[1], p.centroid![0], p.centroid![1]) : null,
    })).sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity)),
  [enrichedParks, userCoords]);

  const filteredParks = useMemo(() =>
    parksWithDistance.filter((p) => {
      if (search.trim() && !p.nameEn.toLowerCase().includes(search.toLowerCase()) && !p.nameTh.includes(search)) return false;
      if (selectedDistrict && p.district !== selectedDistrict) return false;
      if (selectedCategories.size > 0) {
        const lbs = new Set(p.categories.map((c) => c.label));
        for (const s of selectedCategories) if (!lbs.has(s)) return false;
      }
      return true;
    }),
  [parksWithDistance, search, selectedDistrict, selectedCategories]);

  const searchSuggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return enrichedParks
      .filter((p) => p.nameEn.toLowerCase().includes(q) || p.nameTh.includes(search.trim()))
      .slice(0, 8);
  }, [search, enrichedParks]);

  function flyToPark(park: EnrichedPark & { distanceM?: number | null }) {
    if (!park.centroid) return;
    setFlyToCoords([...park.centroid] as [number, number]);
    setOpenParkId((prev) => ({ id: park.id, tick: (prev?.tick ?? 0) + 1 }));
  }

  function toggleCategory(label: string) {
    setSelectedCategories((prev) => { const n = new Set(prev); n.has(label) ? n.delete(label) : n.add(label); return n; });
  }
  function clearFilters() { setSearch(""); setSelectedDistrict(""); setSelectedCategories(new Set()); }

  const hasActiveFilters = !!(search.trim() || selectedDistrict || selectedCategories.size > 0);
  const locationLabel = location ? [location.district, location.area, location.city].filter(Boolean).join(", ") : null;
  const visibleParkIds = hasActiveFilters ? new Set(filteredParks.map((p) => p.id)) : null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9000 }}>

      {/* Map */}
      <div style={{ position: "absolute", inset: 0, zIndex: 1 }}>
        <DynamicMapView
          userCoords={userCoords}
          enrichedParks={enrichedParks}
          visibleParkIds={visibleParkIds}
          stations={stations}
          bufferKm={bufferKm}
          basemap={basemap}
          showSensorBuffers={showSensorBuffers}
          flyToCoords={flyToCoords}
          openParkId={openParkId?.id ?? null}
          openParkTick={openParkId?.tick ?? 0}
          panelPaddingRight={316}
          userPm25={airQuality?.pm25 ?? null}
          activityMaxPm25={null}
          showChoropleth={showChoropleth}
        />
      </div>

      {/* UI overlay */}
      <div style={{ position: "absolute", inset: 0, zIndex: 9999, pointerEvents: "none" }}>

        {/* ── CENTER: PM2.5 pill + legend below ── */}
        <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>

          {/* PM2.5 pill */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: safety.color, color: "white",
            borderRadius: 999, padding: "7px 18px 7px 12px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
            fontSize: 13, fontWeight: 700, fontFamily: "system-ui,sans-serif",
            whiteSpace: "nowrap",
          }}>
            <span style={{ fontSize: 20, fontWeight: 900 }}>{airQuality?.pm25 != null ? pm25ToAqi(airQuality.pm25) : "—"}</span>
            <span style={{ opacity: 0.85 }}>US AQI</span>
            {airQuality?.pm25 != null && (
              <span style={{ opacity: 0.65, fontSize: 11, background: "rgba(0,0,0,0.15)", borderRadius: 999, padding: "1px 7px" }}>
                {Math.round(airQuality.pm25)} µg/m³
              </span>
            )}
            <span style={{ opacity: 0.7 }}>·</span>
            <span style={{ opacity: 0.9 }}>{safety.emoji} {safety.level}</span>
            {locationLabel && <span style={{ opacity: 0.6, fontSize: 11 }}>· 📍 {locationLabel}</span>}
          </div>

          {/* Legend — horizontal row directly below pill */}
          <div style={{
            background: PANEL_BG,
            borderRadius: 12,
            padding: "7px 14px",
            boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
            fontFamily: "system-ui,sans-serif",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
          }}>
            {LEGEND_ITEMS.map((item) => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 9, height: 9, borderRadius: "50%", background: item.color, flexShrink: 0, border: "1.5px solid white", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
                <span style={{ fontSize: 11, color: "#374151", whiteSpace: "nowrap" }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── TOP LEFT: Back button ── */}
        <div style={{ position: "absolute", top: 16, left: 16, pointerEvents: "all" }}>
          <Link href="/map" title="Back to map" style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 40, height: 40, borderRadius: 10,
            background: "rgba(255,255,255,0.93)",
            boxShadow: "0 2px 10px rgba(0,0,0,0.22)",
            textDecoration: "none", color: "#374151", fontSize: 17,
            backdropFilter: "blur(6px)",
          }}>←</Link>
        </div>

        {/* ── TOP RIGHT: unified filter + controls panel ── */}
        <div style={{
          position: "absolute", top: 16, right: 16, bottom: 16,
          width: 300,
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 4px 24px rgba(0,0,0,0.22)",
          fontFamily: "system-ui,sans-serif",
          display: "flex",
          flexDirection: "column",
          pointerEvents: "all",
          zIndex: 9999,
        }}>

          {/* Panel header */}
          <div style={{
            background: PANEL_BG,
            padding: "10px 14px 8px",
            borderBottom: "1px solid rgba(0,0,0,0.07)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: "#15803d" }}>🔍 Filter &amp; Controls</span>
            <span style={{ fontSize: 11, color: "#9ca3af" }}>
              {filteredParks.length}/{parksWithDistance.length}
              {hasActiveFilters && (
                <button onClick={clearFilters} style={{ background: "none", border: "none", color: "#ef4444", fontSize: 11, fontWeight: 700, cursor: "pointer", marginLeft: 6 }}>Clear</button>
              )}
            </span>
          </div>

          {/* Scrollable body */}
          <div style={{
            background: PANEL_BG,
            flex: 1,
            overflowY: "auto",
            padding: "10px 14px 14px",
          }}>

            {/* Search with autocomplete */}
            <div style={{ position: "relative", marginBottom: 8 }}>
              <input
                type="text"
                placeholder="Search parks…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchSuggestions.length > 0) {
                    flyToPark(searchSuggestions[0]);
                    setSearch(searchSuggestions[0].nameEn);
                    setSearchOpen(false);
                  }
                  if (e.key === "Escape") setSearchOpen(false);
                }}
                style={{ width: "100%", boxSizing: "border-box", borderRadius: 10, border: "1px solid #e5e7eb", background: "#f3f6f4", padding: "6px 10px", fontSize: 12, outline: "none" }}
              />
              {searchOpen && searchSuggestions.length > 0 && (
                <div style={{
                  position: "absolute", left: 0, right: 0, top: "100%", zIndex: 50,
                  marginTop: 4, borderRadius: 10, border: "1px solid #e5e7eb",
                  background: "white", boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                  overflow: "hidden",
                }}>
                  {searchSuggestions.map((park) => (
                    <button
                      key={park.id}
                      onMouseDown={(e) => { e.preventDefault(); flyToPark(park); setSearch(park.nameEn); setSearchOpen(false); }}
                      style={{ width: "100%", display: "flex", flexDirection: "column", padding: "7px 10px", textAlign: "left", background: "none", border: "none", cursor: "pointer", borderBottom: "1px solid #f3f4f6" }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>{park.nameEn}</span>
                      <span style={{ fontSize: 10, color: "#9ca3af" }}>{park.nameTh}{park.district ? ` · ${park.district}` : ""}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* District */}
            <span style={secLabel}>Area (District)</span>
            <select
              value={selectedDistrict} onChange={(e) => setSelectedDistrict(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", marginBottom: 10, borderRadius: 10, border: "1px solid #e5e7eb", background: "#f3f6f4", padding: "6px 10px", fontSize: 12, outline: "none" }}
            >
              <option value="">All districts</option>
              {allDistricts.map(({ name, count }) => <option key={name} value={name}>{name} ({count})</option>)}
            </select>

            {/* Categories — 2-col grid per group */}
            {categoryGroups.map((group) => (
              <div key={group.title} style={{ marginBottom: 8 }}>
                <span style={secLabel}>{group.title}</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 6px" }}>
                  {group.items.map((c) => {
                    const active = selectedCategories.has(c.label);
                    return (
                      <label key={c.label} style={{
                        display: "flex", alignItems: "center", gap: 5,
                        padding: "3px 5px", borderRadius: 7, cursor: "pointer",
                        background: active ? "#f0fdf4" : "transparent",
                      }}>
                        <input type="checkbox" checked={active} onChange={() => toggleCategory(c.label)}
                          style={{ accentColor: "#15803d", width: 12, height: 12, flexShrink: 0, cursor: "pointer" }} />
                        <span style={{ fontSize: 13 }}>{c.icon}</span>
                        <span style={{ fontSize: 11, color: "#1f2937", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}

            <div style={{ borderTop: "1px solid #f3f4f6", margin: "8px 0" }} />

            {/* Map Controls */}
            <span style={secLabel}>Your Radius</span>
            <div style={{ display: "flex", gap: 5, marginBottom: 8, flexWrap: "wrap" }}>
              {[1, 2, 3].map((km) => <button key={km} onClick={() => setBufferKm(km)} style={chip(bufferKm === km, "#3b82f6")}>{km} km</button>)}
            </div>

            <span style={secLabel}>Sensor Zones</span>
            <div style={{ display: "flex", gap: 5, marginBottom: 8, flexWrap: "wrap" }}>
              <button onClick={() => setShowSensorBuffers((v) => !v)} style={chip(showSensorBuffers, "#f59e0b")}>
                {showSensorBuffers ? "Hide" : "Show"}
              </button>
            </div>

            <span style={secLabel}>District AQI</span>
            <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
              <button onClick={() => setShowChoropleth((v) => !v)} style={chip(showChoropleth, "#7c3aed")}>
                {showChoropleth ? "Hide AQI map" : "Show AQI map"}
              </button>
            </div>


            <span style={secLabel}>Basemap</span>
            <div style={{ display: "flex", gap: 5, marginBottom: 10 }}>
              {(["satellite", "street"] as Basemap[]).map((b) => (
                <button key={b} onClick={() => setBasemap(b)} style={chip(basemap === b, "#15803d")}>
                  {b === "satellite" ? "🛰 Satellite" : "🗺 Street"}
                </button>
              ))}
            </div>

            {/* Nearest Parks */}
            {parksWithDistance.length > 0 && (
              <>
                <div style={{ borderTop: "1px solid #f3f4f6", margin: "8px 0" }} />
                <span style={secLabel}>Nearest Parks</span>
                {parksWithDistance.slice(0, 3).map((park) => (
                  <button
                    key={park.id}
                    onClick={() => flyToPark(park)}
                    style={{ width: "100%", textAlign: "left", background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 10, padding: "7px 10px", marginBottom: 5, cursor: "pointer" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 6, marginBottom: 1 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>{park.nameEn}</span>
                      {park.distanceM !== null && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#15803d", background: "#dcfce7", borderRadius: 999, padding: "1px 7px", whiteSpace: "nowrap" }}>{fmtDist(park.distanceM)}</span>
                      )}
                    </div>
                    {park.district && <p style={{ fontSize: 10, color: "#9ca3af", margin: 0 }}>📍 {park.district}</p>}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
