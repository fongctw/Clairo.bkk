"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

import {
  fetchAirQuality,
  fetchEnrichedParks,
  fetchForecast,
  fetchParks,
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
  { ssr: false, loading: () => <div style={{ height: 680, borderRadius: 24, background: "#e8f0eb" }} /> }
);

type Basemap = "satellite" | "street";

// ─── Activities ───────────────────────────────────────────────────────────────

const ACTIVITIES = [
  { id: "walk",   emoji: "🚶", label: "Walk",      maxPm25: 50, desc: "Low intensity · safe in moderate air" },
  { id: "run",    emoji: "🏃", label: "Run",       maxPm25: 25, desc: "High intensity · needs clean air" },
  { id: "cycle",  emoji: "🚴", label: "Cycle",     maxPm25: 25, desc: "High intensity · needs clean air" },
  { id: "yoga",   emoji: "🧘", label: "Yoga",      maxPm25: 25, desc: "Deep breathing · needs very clean air" },
  { id: "family", emoji: "👨‍👩‍👧", label: "Family",   maxPm25: 37, desc: "Children are more sensitive" },
  { id: "dog",    emoji: "🐕", label: "Dog Walk",  maxPm25: 50, desc: "Moderate pace · safe in moderate air" },
] as const;

type ActivityId = typeof ACTIVITIES[number]["id"];

function getActivityVerdict(pm25: number | null, maxPm25: number): { label: string; color: string } {
  if (pm25 === null) return { label: "No data", color: "#9ca3af" };
  if (pm25 <= maxPm25 * 0.7) return { label: "✅ Safe", color: "#16a34a" };
  if (pm25 <= maxPm25)       return { label: "⚠️ Marginal", color: "#d97706" };
  return { label: "❌ Not recommended", color: "#dc2626" };
}

// ─── Time-of-day advice ───────────────────────────────────────────────────────

function getTimeAdvice() {
  const h = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" })).getHours();
  if (h >= 6 && h < 9)   return { icon: "🚗", text: "Morning rush", sub: "PM2.5 typically higher 6–9 am. Best after 10 am." };
  if (h >= 9 && h < 16)  return { icon: "✅", text: "Good window", sub: "Mid-morning to afternoon is usually the cleanest time." };
  if (h >= 16 && h < 20) return { icon: "🚗", text: "Evening rush", sub: "PM2.5 spikes 4–8 pm. Consider going earlier or after 8 pm." };
  return { icon: "🌙", text: "Night time", sub: "Air is usually cleaner at night — check the sensors." };
}

// ─── Nearby parks ─────────────────────────────────────────────────────────────

interface NearbyPark {
  name: string;
  nameTh: string;
  distanceM: number;
  centroid: [number, number];
}

// Haversine distance in metres between two lat/lng points
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function geomCentroid(geometry: GeoJSON.Geometry): [number, number] | null {
  if (geometry.type === "Point") return [geometry.coordinates[1], geometry.coordinates[0]];
  if (geometry.type === "Polygon") {
    const ring = geometry.coordinates[0];
    return [ring.reduce((s, c) => s + c[1], 0) / ring.length, ring.reduce((s, c) => s + c[0], 0) / ring.length];
  }
  if (geometry.type === "MultiPolygon") {
    const ring = geometry.coordinates[0][0];
    return [ring.reduce((s, c) => s + c[1], 0) / ring.length, ring.reduce((s, c) => s + c[0], 0) / ring.length];
  }
  return null;
}

function getNearbyParks(userCoords: [number, number] | null, parksGeoJSON: GeoJSON.FeatureCollection | null, limit = 10): NearbyPark[] {
  if (!userCoords || !parksGeoJSON) return [];
  return parksGeoJSON.features
    .filter((f) => f.geometry.type !== "LineString")
    .map((f) => {
      const centroid = geomCentroid(f.geometry);
      if (!centroid) return null;
      const nameEn = String(f.properties?.["name:en"] ?? "");
      const nameTh = String(f.properties?.name ?? "");
      const name = nameEn || nameTh || "Public Park";
      return {
        name,
        nameTh: nameTh !== name ? nameTh : "",
        distanceM: haversineM(userCoords[0], userCoords[1], centroid[0], centroid[1]),
        centroid,
      };
    })
    .filter((p): p is NearbyPark => p !== null)
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, limit);
}

function fmtDist(m: number) {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MapPage() {
  const [userCoords, setUserCoords]       = useState<[number, number] | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [location, setLocation]           = useState<LocationData | null>(null);
  const [airQuality, setAirQuality]       = useState<AirQualityData | null>(null);
  const [weather, setWeather]             = useState<WeatherData | null>(null);
  const [safety, setSafety]               = useState<SafetyInfo>(getSafetyInfo(null));
  const [forecast, setForecast]           = useState<ForecastSlot[]>([]);
  const [parks, setParks]                 = useState<GeoJSON.FeatureCollection | null>(null);
  const [enrichedParks, setEnrichedParks] = useState<EnrichedPark[]>([]);
  const [stations, setStations]           = useState<Pm25Station[]>([]);
  const [parksLoading, setParksLoading]   = useState(true);
  const [stationsLoading, setStationsLoading] = useState(true);
  const [bufferKm, setBufferKm]           = useState(2);
  const [sensorBufferKm, setSensorBufferKm] = useState(3);
  const [basemap, setBasemap]             = useState<Basemap>("satellite");
  const [showSensorBuffers, setShowSensorBuffers] = useState(true);
  const [flyToCoords, setFlyToCoords]     = useState<[number, number] | null>(null);
  const [search, setSearch]               = useState("");
  const [activity, setActivity]           = useState<ActivityId | null>(null);

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
          // Inject nearest sensor into stations list so it always appears on map
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
    fetchParks().then(setParks).catch(() => setParks(null)).finally(() => setParksLoading(false));
    fetchEnrichedParks().then(setEnrichedParks).catch(() => setEnrichedParks([]));
  }, []);

  useEffect(() => {
    fetchPm25Stations().then(setStations).catch(() => setStations([])).finally(() => setStationsLoading(false));
  }, []);

  // Re-calculate current location PM2.5 via IDW once stations are loaded
  useEffect(() => {
    if (!userCoords || stations.length === 0) return;
    const result = idwPm25(userCoords[0], userCoords[1], stations);
    if (result) {
      setAirQuality((prev) => prev ? { ...prev, pm25: result.pm25 } : prev);
      setSafety(getSafetyInfo(result.pm25));
    }
  }, [stations, userCoords]);

  const nearbyParks  = useMemo(() => getNearbyParks(userCoords, parks), [userCoords, parks]);
  const timeAdvice   = getTimeAdvice();
  const locationLabel = location ? [location.district, location.area, location.city].filter(Boolean).join(", ") : null;
  const selectedActivity = ACTIVITIES.find((a) => a.id === activity) ?? null;
  const activityMaxPm25  = selectedActivity?.maxPm25 ?? null;

  const filteredParks = useMemo(() => {
    let list = nearbyParks;
    if (search.trim()) list = list.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [search, nearbyParks]);

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

        {/* ── Activity verdict banner ── */}
        {selectedActivity && (
          <div
            className="mt-4 flex items-center gap-3 rounded-2xl px-4 py-3"
            style={{
              backgroundColor: getActivityVerdict(airQuality?.pm25 ?? null, selectedActivity.maxPm25).color + "20",
              border: `1px solid ${getActivityVerdict(airQuality?.pm25 ?? null, selectedActivity.maxPm25).color}50`,
            }}
          >
            <span className="text-2xl">{selectedActivity.emoji}</span>
            <div className="flex-1">
              <p className="font-bold text-ink">
                {selectedActivity.label} right now:{" "}
                <span style={{ color: getActivityVerdict(airQuality?.pm25 ?? null, selectedActivity.maxPm25).color }}>
                  {getActivityVerdict(airQuality?.pm25 ?? null, selectedActivity.maxPm25).label}
                </span>
              </p>
              <p className="text-xs text-ink/60">
                {selectedActivity.desc} · Safe up to PM2.5 {selectedActivity.maxPm25} µg/m³
                {airQuality?.pm25 != null && ` · Current: ${Math.round(airQuality.pm25)} µg/m³`}
              </p>
            </div>
            <button onClick={() => setActivity(null)} className="text-xs text-ink/40 hover:text-ink">✕</button>
          </div>
        )}
      </div>

      {/* ── Forecast strip — compact ────────────────────────────── */}
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
      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">

        {/* ── Left sidebar ── */}
        <div className="space-y-3 xl:sticky xl:top-4 xl:self-start">

          {/* Activity selector */}
          <div className="rounded-3xl border border-white/60 bg-white/90 p-4 shadow-sm">
            <p className="mb-3 font-semibold text-ink">What are you doing today?</p>
            <div className="grid grid-cols-3 gap-2">
              {ACTIVITIES.map((a) => {
                const verdict = getActivityVerdict(airQuality?.pm25 ?? null, a.maxPm25);
                const isActive = activity === a.id;
                return (
                  <button
                    key={a.id}
                    onClick={() => setActivity(isActive ? null : a.id)}
                    className="flex flex-col items-center rounded-2xl border px-2 py-2.5 text-center transition"
                    style={{
                      backgroundColor: isActive ? verdict.color + "22" : "#f3f6f4",
                      borderColor: isActive ? verdict.color : "transparent",
                    }}
                  >
                    <span className="text-xl">{a.emoji}</span>
                    <span className="mt-0.5 text-xs font-semibold text-ink">{a.label}</span>
                    <span className="mt-0.5 text-xs font-bold" style={{ color: verdict.color }}>{verdict.label}</span>
                  </button>
                );
              })}
            </div>
            {selectedActivity && (
              <div className="mt-3 rounded-2xl p-3 text-sm" style={{ backgroundColor: getActivityVerdict(airQuality?.pm25 ?? null, selectedActivity.maxPm25).color + "18" }}>
                <p className="font-semibold text-ink">{selectedActivity.emoji} {selectedActivity.label}</p>
                <p className="mt-0.5 text-xs text-ink/60">{selectedActivity.desc}</p>
                <p className="mt-1 text-xs text-ink/60">Safe up to <strong>PM2.5 {selectedActivity.maxPm25} µg/m³</strong></p>
                <p className="mt-1 font-semibold" style={{ color: getActivityVerdict(airQuality?.pm25 ?? null, selectedActivity.maxPm25).color }}>
                  {getActivityVerdict(airQuality?.pm25 ?? null, selectedActivity.maxPm25).label} right now
                </p>
              </div>
            )}
          </div>

          {/* Nearby parks */}
          <div className="rounded-3xl border border-white/60 bg-white/90 p-4 shadow-sm">
            <p className="mb-3 font-semibold text-ink">
              Nearby Parks
              {!parksLoading && nearbyParks.length > 0 && (
                <span className="ml-2 text-xs font-normal text-ink/50">{nearbyParks.length} found</span>
              )}
            </p>

            {/* Search */}
            <input
              type="text"
              placeholder="Search parks…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mb-3 w-full rounded-xl border border-ink/10 bg-mist px-3 py-2 text-sm outline-none focus:border-canopy"
            />

            {/* Legend */}
            <div className="mb-3 flex flex-wrap gap-2 rounded-2xl border border-white/60 bg-mist p-3">
              <p className="w-full text-xs font-semibold text-ink/50">Legend</p>
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

            {parksLoading && <p className="text-sm text-ink/40">Loading parks…</p>}
            {!parksLoading && filteredParks.length === 0 && (
              <p className="text-sm text-ink/40">{search ? "No parks match your search." : "Enable location to see nearby parks."}</p>
            )}

            <div className="max-h-[400px] space-y-2 overflow-y-auto pr-1">
              {filteredParks.map((park, i) => {
                const verdict = selectedActivity
                  ? getActivityVerdict(airQuality?.pm25 ?? null, selectedActivity.maxPm25)
                  : null;
                return (
                  <button
                    key={i}
                    onClick={() => setFlyToCoords([...park.centroid] as [number, number])}
                    className="w-full rounded-2xl border border-ink/8 bg-mist px-3 py-3 text-left transition hover:bg-field hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold leading-snug text-ink">{park.name}</p>
                      <span className="shrink-0 rounded-full bg-canopy/15 px-2 py-0.5 text-xs font-semibold text-canopy">
                        {fmtDist(park.distanceM)}
                      </span>
                    </div>
                    {verdict && (
                      <p className="mt-1 text-xs font-semibold" style={{ color: verdict.color }}>
                        {selectedActivity?.emoji} {verdict.label} for {selectedActivity?.label}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-ink/50">🌿 Click to locate on map</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Map column ── */}
        <div className="space-y-3">
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/60 bg-white/90 px-4 py-3 shadow-sm">
            <p className="flex-1 text-xs text-ink/50">
              {parksLoading ? "Loading parks…" : `${parks?.features.length ?? 0} parks`}
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

          {/* Map */}
          <div className="overflow-hidden rounded-3xl border border-white/60 shadow-sm">
            <DynamicMapView
              userCoords={userCoords}
              enrichedParks={enrichedParks}
              stations={stations}
              bufferKm={bufferKm}
              sensorBufferKm={sensorBufferKm}
              basemap={basemap}
              showSensorBuffers={showSensorBuffers}
              flyToCoords={flyToCoords}
              userPm25={airQuality?.pm25 ?? null}
              activityMaxPm25={activityMaxPm25}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
