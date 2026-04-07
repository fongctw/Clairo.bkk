"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

import {
  fetchAirQuality,
  fetchEnrichedParks,
  fetchForecast,
  fetchPm25Stations,
  fetchWeather,
  getSafetyInfo,
  idwPm25,
  reverseGeocode,
} from "@/lib/api";
import type {
  AirQualityData,
  EnrichedPark,
  ForecastSlot,
  LocationData,
  Pm25Station,
  SafetyInfo,
  WeatherData,
} from "@/lib/api";

const DynamicMapView = dynamic(
  () => import("@/components/MapView").then((m) => m.MapView),
  { ssr: false, loading: () => <div style={{ height: "100%", minHeight: 480, borderRadius: 24, background: "#e8f0eb" }} /> }
);

type Basemap = "satellite" | "street";

// ─── Time-of-day advice ───────────────────────────────────────────────────────

function getTimeAdvice() {
  const h = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" })).getHours();
  if (h >= 6 && h < 9)   return { icon: "🚗", text: "Morning rush", sub: "PM2.5 typically higher 6–9 am. Best after 10 am." };
  if (h >= 9 && h < 16)  return { icon: "✅", text: "Good window", sub: "Mid-morning to afternoon is usually the cleanest time." };
  if (h >= 16 && h < 20) return { icon: "🚗", text: "Evening rush", sub: "PM2.5 spikes 4–8 pm. Consider going earlier or after 8 pm." };
  return { icon: "🌙", text: "Night time", sub: "Air is usually cleaner at night — check the sensors." };
}

// ─── Haversine distance ───────────────────────────────────────────────────────

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function fmtDist(m: number) {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MapPage() {
  const [userCoords, setUserCoords]           = useState<[number, number] | null>(null);
  const [locationError, setLocationError]     = useState<string | null>(null);
  const [location, setLocation]               = useState<LocationData | null>(null);
  const [airQuality, setAirQuality]           = useState<AirQualityData | null>(null);
  const [weather, setWeather]                 = useState<WeatherData | null>(null);
  const [safety, setSafety]                   = useState<SafetyInfo>(getSafetyInfo(null));
  const [forecast, setForecast]               = useState<ForecastSlot[]>([]);
  const [enrichedParks, setEnrichedParks]     = useState<EnrichedPark[]>([]);
  const [stations, setStations]               = useState<Pm25Station[]>([]);
  const [parksLoading, setParksLoading]       = useState(true);
  const [stationsLoading, setStationsLoading] = useState(true);
  const [bufferKm, setBufferKm]               = useState(2);
  const [sensorBufferKm, setSensorBufferKm]   = useState(3);
  const [basemap, setBasemap]                 = useState<Basemap>("satellite");
  const [showSensorBuffers, setShowSensorBuffers] = useState(true);
  const [flyToCoords, setFlyToCoords]         = useState<[number, number] | null>(null);
  const [search, setSearch]                   = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!navigator.geolocation) { setLocationError("Geolocation not supported"); return; }
    navigator.geolocation.getCurrentPosition(
      async ({ coords: c }) => {
        const lat = c.latitude;
        const lng = c.longitude;
        setUserCoords([lat, lng]);
        const [aq, wx, loc, fc] = await Promise.all([
          fetchAirQuality(lat, lng).catch(() => null),
          fetchWeather(lat, lng).catch(() => null),
          reverseGeocode(lat, lng).catch(() => null),
          fetchForecast(lat, lng).catch(() => []),
        ]);
        if (aq) {
          setAirQuality(aq);
          setSafety(getSafetyInfo(aq.pm25));
          if (aq.stationLat && aq.stationLng) {
            setStations((prev) => {
              const alreadyExists = prev.some(
                (s) => Math.abs(s.lat - aq.stationLat!) < 0.001 && Math.abs(s.lng - aq.stationLng!) < 0.001
              );
              if (alreadyExists) return prev;
              return [
                { id: "nearest", name: aq.station, lat: aq.stationLat!, lng: aq.stationLng!, pm25: aq.pm25, aqi: aq.aqi },
                ...prev,
              ];
            });
          }
        }
        if (wx) setWeather(wx);
        if (loc) setLocation(loc);
        setForecast(fc ?? []);
      },
      () => setLocationError("Location permission denied — please allow and reload"),
      { timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    fetchEnrichedParks().then((data) => { setEnrichedParks(data); setParksLoading(false); }).catch(() => { setEnrichedParks([]); setParksLoading(false); });
  }, []);

  useEffect(() => {
    fetchPm25Stations().then(setStations).catch(() => setStations([])).finally(() => setStationsLoading(false));
  }, []);

  useEffect(() => {
    if (!userCoords || stations.length === 0) return;
    const result = idwPm25(userCoords[0], userCoords[1], stations);
    if (result) {
      setAirQuality((prev) => prev ? { ...prev, pm25: result.pm25 } : prev);
      setSafety(getSafetyInfo(result.pm25));
    }
  }, [stations, userCoords]);

  const timeAdvice   = getTimeAdvice();
  const locationLabel = location ? [location.district, location.area, location.city].filter(Boolean).join(", ") : null;

  // ─── Derived filter options from enrichedParks data ───────────────────────

  const allDistricts = useMemo(() => {
    const countMap = new Map<string, number>();
    enrichedParks.forEach((p) => {
      if (p.district) countMap.set(p.district, (countMap.get(p.district) ?? 0) + 1);
    });
    return Array.from(countMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "th"))
      .map(([name, count]) => ({ name, count }));
  }, [enrichedParks]);

  // Fixed groups by BMA category label
  const CATEGORY_GROUPS = [
    { title: "Activities",          labels: ["Pedal Boating", "Cycling", "Fitness", "Basketball", "Running Track", "Playground", "Swimming Pool", "Badminton", "Skateboard"] },
    { title: "Pets",                labels: ["Pet Friendly", "Guide Dogs"] },
    { title: "Bathroom",            labels: ["Restroom"] },
    { title: "Transportation",      labels: ["Bus Access", "BTS/MRT", "Parking"] },
    { title: "Elderly & Disabled",  labels: ["Accessible"] },
  ];

  const categoryGroups = useMemo(() => {
    // Count + icon per label from actual data
    const countByLabel = new Map<string, number>();
    const iconByLabel  = new Map<string, string>();
    enrichedParks.forEach((p) => {
      p.categories.forEach((c) => {
        countByLabel.set(c.label, (countByLabel.get(c.label) ?? 0) + 1);
        if (!iconByLabel.has(c.label)) iconByLabel.set(c.label, c.icon);
      });
    });

    return CATEGORY_GROUPS.map((group) => ({
      title: group.title,
      items: group.labels
        .filter((label) => countByLabel.has(label))
        .map((label) => ({ icon: iconByLabel.get(label) ?? "", label, count: countByLabel.get(label)! })),
    })).filter((g) => g.items.length > 0);
  }, [enrichedParks]);

  // ─── Parks with distance, sorted + filtered ───────────────────────────────

  const parksWithDistance = useMemo(() => {
    return enrichedParks
      .filter((p) => p.centroid !== null)
      .map((p) => ({
        ...p,
        distanceM: userCoords
          ? haversineM(userCoords[0], userCoords[1], p.centroid![0], p.centroid![1])
          : null,
      }))
      .sort((a, b) => {
        if (a.distanceM === null && b.distanceM === null) return 0;
        if (a.distanceM === null) return 1;
        if (b.distanceM === null) return -1;
        return a.distanceM - b.distanceM;
      });
  }, [enrichedParks, userCoords]);

  const filteredParks = useMemo(() => {
    return parksWithDistance.filter((p) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!p.nameEn.toLowerCase().includes(q) && !p.nameTh.includes(q)) return false;
      }
      if (selectedDistrict && p.district !== selectedDistrict) return false;
      if (selectedCategories.size > 0) {
        const parkLabels = new Set(p.categories.map((c) => c.label));
        for (const sel of selectedCategories) {
          if (!parkLabels.has(sel)) return false;
        }
      }
      return true;
    });
  }, [parksWithDistance, search, selectedDistrict, selectedCategories]);

  function toggleCategory(label: string) {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  }

  function clearFilters() {
    setSearch("");
    setSelectedDistrict("");
    setSelectedCategories(new Set());
  }

  const hasActiveFilters = !!(search.trim() || selectedDistrict || selectedCategories.size > 0);

  return (
    <main className="space-y-4">

      {/* ── PM2.5 + weather panel ───────────────────────────────── */}
      <div className="rounded-3xl p-5 shadow-sm" style={{ backgroundColor: safety.color + "18", border: `1px solid ${safety.color}40` }}>
        <div className="flex flex-wrap items-start gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 flex-col items-center justify-center rounded-2xl shadow-md" style={{ backgroundColor: safety.color }}>
              <span className="text-3xl font-black leading-none text-white">
                {airQuality?.pm25 != null ? Math.round(airQuality.pm25) : "—"}
              </span>
              <span className="mt-0.5 text-xs font-semibold text-white/80">PM2.5</span>
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: safety.color }}>{safety.emoji} {safety.level}</p>
              <p className="mt-0.5 text-sm text-ink/70">{safety.message}</p>
              {locationLabel && <p className="mt-1 text-xs text-ink/50">📍 {locationLabel}</p>}
              {airQuality?.station && <p className="mt-0.5 text-xs text-ink/40">Sensor: {airQuality.station}</p>}
              <p className="mt-0.5 text-xs text-ink/30">1-hr avg · AQICN · US EPA scale</p>
              {locationError && <p className="mt-1 text-xs text-red-500">⚠️ {locationError}</p>}
            </div>
          </div>

          {/* Time advice */}
          <div className="rounded-2xl border border-white/60 bg-white/70 px-4 py-3 shadow-sm backdrop-blur">
            <p className="font-semibold text-ink">{timeAdvice.icon} {timeAdvice.text}</p>
            <p className="mt-1 text-xs text-ink/60">{timeAdvice.sub}</p>
          </div>

          {/* Weather */}
          {weather && (
            <div className="ml-auto flex flex-wrap gap-2">
              {[
                { icon: "🌡️", val: `${Math.round(weather.temp)}°C`, label: "Temp" },
                { icon: "🤔", val: `${Math.round(weather.feels_like)}°C`, label: "Feels like" },
                { icon: "💧", val: `${weather.humidity}%`, label: "Humidity" },
                { icon: "💨", val: `${weather.wind} m/s`, label: "Wind" },
              ].map((w) => (
                <div key={w.label} className="rounded-2xl border border-white/60 bg-white/70 px-3 py-2 text-center shadow-sm backdrop-blur">
                  <p className="text-sm">{w.icon}</p>
                  <p className="text-sm font-bold text-ink">{w.val}</p>
                  <p className="text-xs text-ink/50">{w.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Forecast strip ──────────────────────────────────────── */}
      {forecast.length > 0 && (
        <div className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-white/60 bg-white/80 px-3 py-2 shadow-sm">
          <span className="mr-2 shrink-0 text-xs font-semibold text-ink/40">Next 24h</span>
          {forecast.map((slot, i) => (
            <div key={i} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-mist px-2.5 py-1.5">
              <img src={`https://openweathermap.org/img/wn/${slot.icon}.png`} alt="" className="h-6 w-6" />
              <div>
                <p className="text-xs font-semibold text-ink">{slot.temp}°C</p>
                <p className="text-xs text-ink/40">{slot.time}</p>
              </div>
              {slot.pop > 20 && <span className="text-xs text-blue-400">💧{slot.pop}%</span>}
            </div>
          ))}
        </div>
      )}

      {/* ── Sidebar + map ───────────────────────────────────────── */}
      <div className="grid gap-4 xl:grid-cols-[340px_1fr] xl:items-stretch">

        {/* ── Left sidebar ── */}
        <div className="flex flex-col">
          <div className="flex flex-col rounded-3xl border border-white/60 bg-white/90 p-4 shadow-sm">

            {/* Header */}
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold text-ink">
                Parks &amp; Filter
                {!parksLoading && (
                  <span className="ml-2 text-xs font-normal text-ink/50">
                    {filteredParks.length} / {parksWithDistance.length}
                  </span>
                )}
              </p>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="text-xs font-semibold text-red-500 hover:text-red-700 transition">
                  Clear filter
                </button>
              )}
            </div>

            {/* Search */}
            <input
              type="text"
              placeholder="Search parks…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mb-3 w-full rounded-xl border border-ink/10 bg-mist px-3 py-2 text-sm outline-none focus:border-canopy"
            />

            {/* District filter */}
            <div className="mb-3">
              <p className="mb-1.5 text-xs font-semibold text-ink/50">Area (District)</p>
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                className="w-full rounded-xl border border-ink/10 bg-mist px-3 py-2 text-sm outline-none focus:border-canopy"
              >
                <option value="">All districts</option>
                {allDistricts.map(({ name, count }) => (
                  <option key={name} value={name}>{name} ({count})</option>
                ))}
              </select>
            </div>

            {/* Category filter — grouped checkboxes, scrollable */}
            {categoryGroups.length > 0 && (
              <div className="mb-4">
                <div className="max-h-[280px] overflow-y-auto space-y-3 pr-1">
                  {categoryGroups.map((group) => (
                    <div key={group.title}>
                      <p className="mb-1 text-xs font-bold text-ink/40 uppercase tracking-wide">{group.title}</p>
                      <div className="space-y-0.5">
                        {group.items.map((c) => {
                          const active = selectedCategories.has(c.label);
                          return (
                            <label
                              key={c.label}
                              className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-mist"
                            >
                              <input
                                type="checkbox"
                                checked={active}
                                onChange={() => toggleCategory(c.label)}
                                className="accent-canopy h-3.5 w-3.5 shrink-0"
                              />
                              <span className="text-base leading-none">{c.icon}</span>
                              <span className="flex-1 text-sm text-ink">{c.label}</span>
                              <span className="rounded-full bg-ink/8 px-2 py-0.5 text-xs font-semibold text-ink/50">
                                {c.count}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── 3 Nearest parks ── */}
            <div className="border-t border-ink/8 pt-4">
              <p className="mb-2 text-xs font-bold text-ink/40 uppercase tracking-wide">
                Nearest Parks
                {!userCoords && <span className="ml-1 font-normal normal-case text-ink/30">· enable location</span>}
              </p>
              {parksLoading && <p className="text-sm text-ink/40">Loading…</p>}
              {!parksLoading && (
                <div className="space-y-2">
                  {parksWithDistance.slice(0, 3).map((park) => (
                    <button
                      key={park.id}
                      onClick={() => park.centroid && setFlyToCoords([...park.centroid] as [number, number])}
                      className="w-full rounded-2xl border border-ink/8 bg-mist px-3 py-3 text-left transition hover:bg-field hover:shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold leading-snug text-ink">{park.nameEn}</p>
                        {park.distanceM !== null ? (
                          <span className="shrink-0 rounded-full bg-canopy/15 px-2 py-0.5 text-xs font-semibold text-canopy">
                            {fmtDist(park.distanceM)}
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-full bg-ink/8 px-2 py-0.5 text-xs text-ink/40">—</span>
                        )}
                      </div>
                      {park.nameTh && <p className="text-xs text-ink/50 mt-0.5">{park.nameTh}</p>}
                      {park.district && <p className="text-xs text-ink/40 mt-0.5">📍 {park.district}</p>}
                      {park.categories.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {park.categories.map((c, i) => (
                            <span key={i} title={c.label} className="text-sm">{c.icon}</span>
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                  {parksWithDistance.length === 0 && (
                    <p className="text-sm text-ink/40">No parks found nearby.</p>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* ── Map column ── */}
        <div className="flex flex-col gap-3">
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-white/60 bg-white/90 px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold text-ink/50 shrink-0">Legend</p>
            {[
              { color: "#3b82f6", label: "Your location" },
              { color: "#22c55e", label: "Park (safe)" },
              { color: "#d97706", label: "Park (caution)" },
              { color: "#16a34a", label: "Sensor ≤25 · Safe" },
              { color: "#d97706", label: "Sensor 26–50 · Moderate" },
              { color: "#dc2626", label: "Sensor 51–100 · Unhealthy" },
              { color: "#7c3aed", label: "Sensor >100 · Dangerous" },
              { color: "#6366f1", label: "Dropped pin" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 shrink-0 rounded-full border border-white shadow" style={{ backgroundColor: item.color }} />
                <span className="text-xs text-ink/60">{item.label}</span>
              </div>
            ))}
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/60 bg-white/90 px-4 py-3 shadow-sm">
            <p className="flex-1 text-xs text-ink/50">
              {parksLoading ? "Loading parks…" : `${enrichedParks.length} parks`}
              {" · "}
              {stationsLoading ? "Loading sensors…" : `${stations.length} sensors`}
              {" · Click map to drop a pin"}
            </p>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-ink/50">Your radius</span>
              {[1, 2, 3].map((km) => (
                <button key={km} onClick={() => setBufferKm(km)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${bufferKm === km ? "bg-blue-500 text-white" : "bg-mist text-ink hover:bg-field"}`}>
                  {km} km
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-ink/50">Sensor zones</span>
              {[1, 2, 3].map((km) => (
                <button key={km} onClick={() => setSensorBufferKm(km)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${sensorBufferKm === km ? "bg-amber-500 text-white" : "bg-mist text-ink hover:bg-field"}`}>
                  {km} km
                </button>
              ))}
            </div>

            <button onClick={() => setShowSensorBuffers((v) => !v)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${showSensorBuffers ? "bg-amber-500 text-white" : "bg-mist text-ink hover:bg-field"}`}>
              {showSensorBuffers ? "Hide zones" : "Show zones"}
            </button>

            <div className="flex gap-1 rounded-full border border-ink/10 bg-mist p-1">
              {(["satellite", "street"] as Basemap[]).map((b) => (
                <button key={b} onClick={() => setBasemap(b)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${basemap === b ? "bg-white shadow text-ink" : "text-ink/50 hover:text-ink"}`}>
                  {b === "satellite" ? "🛰 Satellite" : "🗺 Street"}
                </button>
              ))}
            </div>
          </div>

          {/* Map — flex-1 so it fills remaining height to match sidebar */}
          <div className="flex-1 overflow-hidden rounded-3xl border border-white/60 shadow-sm" style={{ minHeight: 480 }}>
            <DynamicMapView
              userCoords={userCoords}
              enrichedParks={enrichedParks}
              visibleParkIds={hasActiveFilters ? new Set(filteredParks.map((p) => p.id)) : null}
              stations={stations}
              bufferKm={bufferKm}
              sensorBufferKm={sensorBufferKm}
              basemap={basemap}
              showSensorBuffers={showSensorBuffers}
              flyToCoords={flyToCoords}
              userPm25={airQuality?.pm25 ?? null}
              activityMaxPm25={null}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
