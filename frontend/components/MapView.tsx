"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Circle,
  GeoJSON as GeoJSONLayer,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";

import { fetchAirQuality, getSafetyInfo, idwPm25, pm25ToAqi } from "@/lib/api";
import type { BMACategory, EnrichedPark, IdwResult, Pm25Station, SafetyInfo } from "@/lib/api";

// ─── Tiles ────────────────────────────────────────────────────────────────────

const TILES = {
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles © Esri",
  },
  street: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
};

// ─── Sensor color by PM2.5 ────────────────────────────────────────────────────

function sensorColor(pm25: number | null): string {
  if (pm25 === null) return "#9ca3af";
  if (pm25 <= 25)  return "#16a34a";
  if (pm25 <= 50)  return "#d97706";
  if (pm25 <= 100) return "#dc2626";
  return "#7c3aed";
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const PULSE_STYLE = `
  @keyframes pulse-ring {
    0%   { transform:scale(0.8); opacity:0.8; }
    100% { transform:scale(2.2); opacity:0; }
  }
`;

const parkIcon = new L.DivIcon({
  className: "",
  html: `<style>${PULSE_STYLE}</style>
    <div style="position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;width:36px;height:36px;border-radius:50%;background:rgba(34,197,94,0.3);animation:pulse-ring 2s ease-out infinite;"></div>
      <div style="position:relative;z-index:1;width:26px;height:26px;border-radius:50%;background:#22c55e;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;font-size:12px;">🌿</div>
    </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -22],
});

const userIcon = new L.DivIcon({
  className: "",
  html: `<style>${PULSE_STYLE}</style>
    <div style="position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;width:36px;height:36px;border-radius:50%;background:rgba(59,130,246,0.3);animation:pulse-ring 2s ease-out infinite;"></div>
      <div style="position:relative;z-index:1;width:18px;height:18px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5);"></div>
    </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const warnParkIcon = new L.DivIcon({
  className: "",
  html: `<style>${PULSE_STYLE}</style>
    <div style="position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;width:36px;height:36px;border-radius:50%;background:rgba(217,119,6,0.3);animation:pulse-ring 2s ease-out infinite;"></div>
      <div style="position:relative;z-index:1;width:26px;height:26px;border-radius:50%;background:#d97706;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;font-size:12px;">⚠️</div>
    </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -22],
});

const droppedPinIcon = new L.DivIcon({
  className: "",
  html: `<div style="width:22px;height:22px;border-radius:50%;background:#6366f1;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5);"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function makeSensorIcon(pm25: number | null) {
  const color = sensorColor(pm25);
  const label = pm25 !== null ? pm25ToAqi(pm25).toString() : "?";
  return new L.DivIcon({
    className: "",
    html: `
      <div style="
        background:${color};
        color:white;
        border:2px solid white;
        border-radius:8px;
        padding:2px 6px;
        font-size:11px;
        font-weight:700;
        white-space:nowrap;
        box-shadow:0 2px 6px rgba(0,0,0,0.4);
        font-family:system-ui,sans-serif;
      ">${label}</div>`,
    iconSize: [40, 24],
    iconAnchor: [20, 12],
    popupAnchor: [0, -16],
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inlinePopup(content: string) {
  return `<div style="font-family:system-ui,sans-serif;min-width:200px;padding:4px">${content}</div>`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FlyToUser({ coords }: { coords: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(coords, 13, { animate: true, duration: 1.2 });
  }, [coords, map]);
  return null;
}

function PinDropHandler({ onDrop, popupJustClosed }: { onDrop: (lat: number, lng: number) => void; popupJustClosed: React.MutableRefObject<boolean> }) {
  useMapEvents({
    popupclose: () => { popupJustClosed.current = true; },
    click: (e) => {
      if (popupJustClosed.current) { popupJustClosed.current = false; return; }
      onDrop(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// ─── BMA park popup ───────────────────────────────────────────────────────────

interface BMAPopupProps {
  park: EnrichedPark;
  stations: Pm25Station[];
  activityMaxPm25: number | null;
}

function BMAPopupContent({ park, stations, activityMaxPm25 }: BMAPopupProps) {
  const [pm25, setPm25]       = useState<number | null>(null);
  const [idwMeta, setIdwMeta] = useState<IdwResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!park.centroid) { setLoading(false); return; }
    const [lat, lng] = park.centroid;
    const result = idwPm25(lat, lng, stations);
    if (result) {
      setPm25(result.pm25);
      setIdwMeta(result);
      setLoading(false);
    } else {
      fetchAirQuality(lat, lng)
        .then((aq) => setPm25(aq.pm25))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [park.centroid, stations]);

  const safety = getSafetyInfo(pm25);
  const activityVerdict = activityMaxPm25 !== null && pm25 !== null
    ? pm25 <= activityMaxPm25 * 0.7 ? { label: "✅ Good for your activity", color: "#16a34a" }
    : pm25 <= activityMaxPm25       ? { label: "⚠️ Marginal for your activity", color: "#d97706" }
    : { label: "❌ Not recommended for your activity", color: "#dc2626" }
    : null;
  const gmapsUrl = park.centroid
    ? `https://www.google.com/maps/dir/?api=1&destination=${park.centroid[0]},${park.centroid[1]}`
    : "#";

  return (
    <div style={{ minWidth: 260, maxWidth: 300, fontFamily: "system-ui,sans-serif", padding: 4 }}>
      {/* Photo */}
      {park.image && (
        <img src={park.image} alt={park.nameEn}
          style={{ width: "100%", height: 130, objectFit: "cover", borderRadius: 10, marginBottom: 10 }} />
      )}

      {/* Name */}
      <p style={{ fontWeight: 800, fontSize: 15, margin: "0 0 2px", color: "#15803d" }}>🌿 {park.nameEn}</p>
      <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 2px" }}>{park.nameTh}</p>
      {park.district && <p style={{ fontSize: 11, color: "#9ca3af", margin: "0 0 6px" }}>📍 {park.district}</p>}

      {/* Open hours */}
      {park.openHours && (
        <p style={{ fontSize: 11, color: "#4b5563", margin: "0 0 8px" }}>🕐 {park.openHours}</p>
      )}

      {/* Description */}
      {park.description && (
        <p style={{ fontSize: 12, color: "#4b5563", margin: "0 0 8px", lineHeight: 1.5 }}>{park.description}</p>
      )}

      {/* Amenity icons */}
      {park.categories.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
          {park.categories.map((c: BMACategory, i: number) => (
            <span key={i} title={c.label}
              style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, padding: "2px 6px", fontSize: 13 }}>
              {c.icon}
            </span>
          ))}
        </div>
      )}

      {/* AQI badge */}
      {loading && <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 8px" }}>Loading air quality…</p>}
      {!loading && (
        <div style={{ background: safety.color, borderRadius: 10, padding: "8px 12px", textAlign: "center", marginBottom: 6 }}>
          <p style={{ color: "white", fontWeight: 800, fontSize: 22, margin: 0 }}>
            {pm25 !== null ? pm25ToAqi(pm25) : "—"}
          </p>
          <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: 600, margin: "1px 0 2px" }}>
            US AQI · {safety.emoji} {safety.level}
          </p>
          {pm25 !== null && (
            <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 10, margin: 0 }}>
              PM2.5 {Math.round(pm25)} µg/m³
            </p>
          )}
        </div>
      )}
      {!loading && idwMeta && (
        <p style={{ fontSize: 10, color: "#9ca3af", textAlign: "center", margin: "0 0 8px" }}>
          📐 IDW · {idwMeta.stationsUsed} stations · nearest {idwMeta.nearestDistM < 1000 ? `${idwMeta.nearestDistM} m` : `${(idwMeta.nearestDistM / 1000).toFixed(1)} km`}
        </p>
      )}

      {/* Activity verdict */}
      {activityVerdict && (
        <div style={{ borderRadius: 8, padding: "6px 10px", marginBottom: 8, background: activityVerdict.color + "18", border: `1px solid ${activityVerdict.color}40` }}>
          <p style={{ color: activityVerdict.color, fontWeight: 700, fontSize: 12, margin: 0 }}>{activityVerdict.label}</p>
        </div>
      )}

      {/* Directions */}
      <a href={gmapsUrl} target="_blank" rel="noopener noreferrer"
        style={{ display: "block", background: "#2563eb", color: "white", borderRadius: 10, padding: "8px 12px", textAlign: "center", fontSize: 13, fontWeight: 600, textDecoration: "none", marginBottom: 6 }}>
        🗺️ Get directions
      </a>

      {/* BMA park page */}
      {park.link && (
        <a href={park.link} target="_blank" rel="noopener noreferrer"
          style={{ display: "block", background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d", borderRadius: 10, padding: "7px 12px", textAlign: "center", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
          🌿 View on Greener Bangkok
        </a>
      )}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface MapViewProps {
  userCoords: [number, number] | null;
  enrichedParks: EnrichedPark[];
  visibleParkIds: Set<number> | null;
  stations: Pm25Station[];
  basemap: "satellite" | "street";
  showSensorBuffers: boolean;
  flyToCoords: [number, number] | null;
  openParkId: number | null;
  openParkTick?: number;
  userPm25: number | null;
  activityMaxPm25: number | null;
  showChoropleth?: boolean;
  /** Called when the user drops a pin on the map */
  onPinDrop?: (lat: number, lng: number) => void;
  /** Extra right-side padding (px) so popup auto-pan clears any overlay panel */
  panelPaddingRight?: number;
  /** Increment to trigger map.invalidateSize() when surrounding layout changes */
  layoutKey?: number;
}

// ─── FlyTo helper (reacts to prop changes) ────────────────────────────────────

function FlyTo({ coords }: { coords: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(coords, 15, { animate: true, duration: 1 });
  }, [coords, map]);
  return null;
}

// ─── Invalidate map size when surrounding layout changes ─────────────────────

function InvalidateSize({ layoutKey }: { layoutKey?: number }) {
  const map = useMap();
  useEffect(() => { map.invalidateSize(); }, [layoutKey, map]);
  return null;
}

// ─── Open popup for a park after flying ──────────────────────────────────────

function OpenParkPopup({ parkId, tick, panelPaddingRight, markerRefs }: {
  parkId: number;
  tick: number;
  panelPaddingRight: number;
  markerRefs: React.RefObject<Map<number, L.Marker>>;
}) {
  const map = useMap();
  useEffect(() => {
    const tryOpen = (attempts = 0) => {
      const marker = markerRefs.current?.get(parkId);
      if (marker) {
        // Wait for fly animation to fully complete (duration=1s), then reposition
        // marker into the lower-center of the visible viewport so popup has room above.
        setTimeout(() => {
          const mapSize = map.getSize();
          const markerPt = map.latLngToContainerPoint(marker.getLatLng());
          // Target: marker at 82% down so popup has plenty of room above
          const usableWidth = mapSize.x - panelPaddingRight;
          const targetX = usableWidth / 2;
          const targetY = mapSize.y * 0.82;
          const dx = markerPt.x - targetX;
          const dy = markerPt.y - targetY;
          map.panBy([dx, dy], { animate: true, duration: 0.25 });
          setTimeout(() => marker.openPopup(), 280);
        }, 1100);
      } else if (attempts < 10) {
        setTimeout(() => tryOpen(attempts + 1), 150);
      }
    };
    tryOpen();
  }, [parkId, tick, panelPaddingRight, markerRefs, map]);
  return null;
}

// ─── Overpass relation → GeoJSON ─────────────────────────────────────────────
// Builds polygon features from Overpass `out geom` relation response.
function overpassRelationsToGeoJSON(elements: any[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];

  for (const el of elements) {
    if (el.type !== "relation") continue;
    const outerWays: { geometry: { lat: number; lon: number }[] }[] =
      el.members?.filter((m: any) => m.type === "way" && m.role === "outer" && Array.isArray(m.geometry)) ?? [];
    if (outerWays.length === 0) continue;

    // Chain way segments end-to-end into closed rings
    let remaining = outerWays.map((w) => w.geometry.map((p) => [p.lon, p.lat] as [number, number]));
    const rings: [number, number][][] = [];

    while (remaining.length > 0) {
      let ring: [number, number][] = [...remaining[0]];
      remaining = remaining.slice(1);
      let extended = true;
      while (extended && remaining.length > 0) {
        extended = false;
        const tail = ring[ring.length - 1];
        for (let i = 0; i < remaining.length; i++) {
          const seg = remaining[i];
          const head = seg[0], back = seg[seg.length - 1];
          if (Math.abs(head[0] - tail[0]) < 1e-6 && Math.abs(head[1] - tail[1]) < 1e-6) {
            ring = [...ring, ...seg.slice(1)]; remaining.splice(i, 1); extended = true; break;
          }
          if (Math.abs(back[0] - tail[0]) < 1e-6 && Math.abs(back[1] - tail[1]) < 1e-6) {
            ring = [...ring, ...[...seg].reverse().slice(1)]; remaining.splice(i, 1); extended = true; break;
          }
        }
      }
      if (ring.length > 2) {
        const [f, l] = [ring[0], ring[ring.length - 1]];
        if (Math.abs(f[0] - l[0]) > 1e-7 || Math.abs(f[1] - l[1]) > 1e-7) ring.push(f);
        rings.push(ring);
      }
    }

    if (rings.length === 0) continue;
    features.push({
      type: "Feature",
      properties: { name: el.tags?.name ?? "", nameEn: el.tags?.["name:en"] ?? "" },
      geometry: rings.length === 1
        ? { type: "Polygon", coordinates: rings }
        : { type: "MultiPolygon", coordinates: rings.map((r) => [r]) },
    });
  }

  return { type: "FeatureCollection", features };
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MapView({ userCoords, enrichedParks, visibleParkIds, stations, basemap, showSensorBuffers, flyToCoords, openParkId, openParkTick, userPm25, activityMaxPm25, showChoropleth = false, onPinDrop, panelPaddingRight = 0, layoutKey }: MapViewProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [droppedPin, setDroppedPin] = useState<[number, number] | null>(null);
  const [droppedPinSafety, setDroppedPinSafety] = useState<SafetyInfo | null>(null);
  const [droppedPinPm25, setDroppedPinPm25] = useState<number | null>(null);
  const [droppedPinMeta, setDroppedPinMeta] = useState<IdwResult | null>(null);
  const droppedMarkerRef = useRef<L.Marker | null>(null);
  const parkMarkerRefs = useRef<Map<number, L.Marker>>(new Map());
  const popupJustClosed = useRef(false);
  const [bangkokBoundary, setBangkokBoundary] = useState<GeoJSON.FeatureCollection | null>(null);
  const [bangkokDistricts, setBangkokDistricts] = useState<GeoJSON.FeatureCollection | null>(null);
  const [bangkokSubdistricts, setBangkokSubdistricts] = useState<GeoJSON.FeatureCollection | null>(null);

  // Choropleth: district polygons coloured by IDW PM2.5
  const districtChoropleth = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!bangkokDistricts || stations.length === 0) return null;
    const features = bangkokDistricts.features.map((f) => {
      let lats = 0, lngs = 0, count = 0;
      const coords: number[][][] =
        f.geometry.type === "Polygon"
          ? (f.geometry as GeoJSON.Polygon).coordinates
          : (f.geometry as GeoJSON.MultiPolygon).coordinates[0];
      coords[0].forEach(([lng, lat]) => { lngs += lng; lats += lat; count++; });
      const cLat = lats / count, cLng = lngs / count;
      const result = idwPm25(cLat, cLng, stations, 40);
      const pm25 = result?.pm25 ?? null;
      const color =
        pm25 === null  ? "#9ca3af"
        : pm25 <= 25   ? "#16a34a"
        : pm25 <= 50   ? "#d97706"
        : pm25 <= 100  ? "#dc2626"
        : "#7c3aed";
      return { ...f, properties: { ...f.properties, pm25, color } };
    });
    return { type: "FeatureCollection", features };
  }, [bangkokDistricts, stations]);

  useEffect(() => { setIsMounted(true); }, []);

  // Bangkok province boundary — Nominatim
  useEffect(() => {
    fetch(
      "https://nominatim.openstreetmap.org/search?city=Bangkok&country=Thailand&polygon_geojson=1&format=json&limit=1",
      { headers: { "Accept-Language": "en" } }
    )
      .then((r) => r.json())
      .then((data) => {
        const geo = data?.[0]?.geojson;
        if (geo) setBangkokBoundary({ type: "FeatureCollection", features: [{ type: "Feature", geometry: geo, properties: {} }] });
      })
      .catch(() => {});
  }, []);

  // Bangkok district (khet) boundaries — admin_level=8
  useEffect(() => {
    const q = `[out:json][timeout:60];area["name"="กรุงเทพมหานคร"]["admin_level"="4"]->.bkk;(relation["admin_level"="8"](area.bkk););out geom;`;
    fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((data) => {
        const fc = overpassRelationsToGeoJSON(data.elements ?? []);
        if (fc.features.length > 0) setBangkokDistricts(fc);
      })
      .catch(() => {});
  }, []);

  // Bangkok subdistrict (khwaeng) boundaries — admin_level=9
  useEffect(() => {
    const q = `[out:json][timeout:90];area["name"="กรุงเทพมหานคร"]["admin_level"="4"]->.bkk;(relation["admin_level"="9"](area.bkk););out geom;`;
    fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((data) => {
        const fc = overpassRelationsToGeoJSON(data.elements ?? []);
        if (fc.features.length > 0) setBangkokSubdistricts(fc);
      })
      .catch(() => {});
  }, []);


  function handlePinDrop(lat: number, lng: number) {
    setDroppedPin([lat, lng]);
    setDroppedPinMeta(null);
    onPinDrop?.(lat, lng);

    const result = idwPm25(lat, lng, stations);
    if (result) {
      setDroppedPinPm25(result.pm25);
      setDroppedPinSafety(getSafetyInfo(result.pm25));
      setDroppedPinMeta(result);
    } else {
      // No stations in range — fall back to AQICN nearest station
      fetchAirQuality(lat, lng)
        .then((aq) => {
          setDroppedPinPm25(aq?.pm25 ?? null);
          setDroppedPinSafety(getSafetyInfo(aq?.pm25 ?? null));
        })
        .catch(() => setDroppedPinSafety(getSafetyInfo(null)));
    }
    setTimeout(() => droppedMarkerRef.current?.openPopup(), 150);
  }

  if (!isMounted) {
    return <div style={{ height: "100%", minHeight: 480, borderRadius: 24, background: "#e8f0eb" }} />;
  }

  const tile = TILES[basemap];

  return (
    <MapContainer
      center={userCoords ?? [13.7563, 100.5018]}
      zoom={12}
      minZoom={10}
      maxZoom={18}
      scrollWheelZoom
      style={{ height: "100%", minHeight: 480, width: "100%", borderRadius: 24 }}
    >
      <InvalidateSize layoutKey={layoutKey} />
      {userCoords && <FlyToUser coords={userCoords} />}
      {flyToCoords && <FlyTo coords={flyToCoords} />}
      {openParkId && <OpenParkPopup parkId={openParkId} tick={openParkTick ?? 0} panelPaddingRight={panelPaddingRight} markerRefs={parkMarkerRefs} />}
      <PinDropHandler onDrop={handlePinDrop} popupJustClosed={popupJustClosed} />

      <TileLayer key={basemap} url={tile.url} attribution={tile.attribution} noWrap />

      {/* ── Bangkok subdistrict (khwaeng) lines — finest grid ── */}
      {bangkokSubdistricts && (
        <GeoJSONLayer
          key={`bkk-sub-${bangkokSubdistricts.features.length}`}
          data={bangkokSubdistricts}
          style={() => ({
            color: "#CEA2FD",
            weight: 0.6,
            opacity: 1,
            fillOpacity: 0,
          })}
        />
      )}

      {/* ── Bangkok district (khet) lines — medium grid ── */}
      {bangkokDistricts && (
        <GeoJSONLayer
          key={`bkk-districts-${bangkokDistricts.features.length}`}
          data={bangkokDistricts}
          style={() => ({
            color: "#B47EE5",
            weight: 1.5,
            opacity: 1,
            fillOpacity: 0,
            dashArray: "5 4",
          })}
        />
      )}

      {/* ── Bangkok province boundary — QGIS-style amber highlight ── */}
      {bangkokBoundary && (
        <GeoJSONLayer
          key={`bkk-boundary-${showChoropleth}`}
          data={bangkokBoundary}
          style={() => ({
            color: "#a9c7ee",
            weight: 3.5,
            opacity: 1,
            fillColor: "#7AA2C4",
            fillOpacity: showChoropleth ? 0 : 0.3,
            dashArray: "10 7",
            lineCap: "round",
            lineJoin: "round",
          })}
        />
      )}

      {/* ── District choropleth — AQI fill (renders above boundary) ── */}
      {showChoropleth && districtChoropleth && (
        <GeoJSONLayer
          key={`choropleth-${districtChoropleth.features.length}-${stations.map(s => s.pm25).join(",").length}`}
          data={districtChoropleth}
          style={(feature) => ({
            color: "transparent",
            weight: 0,
            fillColor: feature?.properties?.color ?? "#9ca3af",
            fillOpacity: 0.35,
          })}
          onEachFeature={(feature, layer) => {
            const name = feature.properties?.nameEn || feature.properties?.name || "District";
            const pm25 = feature.properties?.pm25;
            const aqi = pm25 !== null && pm25 !== undefined ? pm25ToAqi(pm25) : null;
            const label = pm25 === null || pm25 === undefined ? "No data"
              : pm25 <= 25  ? "Safe"
              : pm25 <= 50  ? "Moderate"
              : pm25 <= 100 ? "Unhealthy"
              : "Dangerous";
            layer.bindTooltip(
              `<div style="font-family:system-ui,sans-serif;font-size:12px;font-weight:700;padding:2px 4px">${name}<br/><span style="color:${feature.properties?.color}">${aqi !== null ? `AQI ${aqi} · ${label}` : "No data"}</span></div>`,
              { sticky: true, opacity: 0.95 }
            );
            layer.on({
              mouseover: (e) => { e.target.setStyle({ fillOpacity: 0.55 }); },
              mouseout:  (e) => { e.target.setStyle({ fillOpacity: 0.35 }); },
            });
          }}
        />
      )}

      {/* BMA park polygon fills — only matched OSM polygons */}
      {enrichedParks.length > 0 && (() => {
        const visible = enrichedParks.filter((ep) => !visibleParkIds || visibleParkIds.has(ep.id));
        const bmaPolygons: GeoJSON.FeatureCollection = {
          type: "FeatureCollection",
          features: visible
            .filter((ep) => ep.polygon !== null && (ep.polygon!.geometry.type === "Polygon" || ep.polygon!.geometry.type === "MultiPolygon"))
            .map((ep) => ep.polygon!),
        };
        if (bmaPolygons.features.length === 0) return null;
        return (
          <GeoJSONLayer
            key={`bma-fill-${bmaPolygons.features.length}`}
            data={bmaPolygons}
            style={() => ({
              color: "#16a34a",
              weight: 1.5,
              fillColor: "#22c55e",
              fillOpacity: 0.18,
              opacity: 0.7,
            })}
          />
        );
      })()}

      {/* BMA park markers — filtered by active filters */}
      {enrichedParks.map((ep) => {
        if (!ep.centroid) return null;
        if (visibleParkIds && !visibleParkIds.has(ep.id)) return null;
        const safe = activityMaxPm25 === null || userPm25 === null || userPm25 <= activityMaxPm25;
        return (
          <Marker
            key={`bma-${ep.id}`}
            position={ep.centroid}
            icon={safe ? parkIcon : warnParkIcon}
            ref={(m) => {
              if (m) parkMarkerRefs.current.set(ep.id, m);
              else parkMarkerRefs.current.delete(ep.id);
            }}
          >
            <Popup minWidth={260} maxWidth={310} autoPan autoPanPaddingTopLeft={[20, 60]} autoPanPaddingBottomRight={[20, 20]}>
              <BMAPopupContent
                park={ep}
                stations={stations}
                activityMaxPm25={activityMaxPm25}
              />
            </Popup>
          </Marker>
        );
      })}

      {/* PM2.5 sensor buffer circles — 1 km, 2 km, 3 km rings */}
      {showSensorBuffers && stations.flatMap((s) =>
        [1000, 2000, 3000]
          .map((r) => (
            <Circle
              key={`buf-${s.id}-${r}`}
              center={[s.lat, s.lng]}
              radius={r}
              pathOptions={{
                color: sensorColor(s.pm25),
                fillColor: sensorColor(s.pm25),
                fillOpacity: r === 1000 ? 0.15 : r === 2000 ? 0.09 : 0.05,
                weight: r === 1000 ? 2 : 1.5,
                opacity: 0.7,
                dashArray: r === 3000 ? "4 4" : undefined,
              }}
            />
          ))
      )}

      {/* PM2.5 sensor markers */}
      {stations.map((s) => (
        <Marker key={`sensor-${s.id}`} position={[s.lat, s.lng]} icon={makeSensorIcon(s.pm25)}>
          <Popup>
            <div dangerouslySetInnerHTML={{ __html: inlinePopup(`
              <p style="font-weight:700;font-size:13px;margin:0 0 6px;color:#374151">${s.name}</p>
              <div style="background:${sensorColor(s.pm25)};border-radius:8px;padding:8px 12px;text-align:center">
                <p style="color:white;font-weight:800;font-size:22px;margin:0">
                  ${s.pm25 !== null ? pm25ToAqi(s.pm25) : "—"}
                </p>
                <p style="color:rgba(255,255,255,0.85);font-size:11px;font-weight:600;margin:2px 0 1px">US AQI</p>
                <p style="color:rgba(255,255,255,0.65);font-size:10px;margin:0">PM2.5 ${s.pm25 !== null ? Math.round(s.pm25) : "—"} µg/m³</p>
              </div>
            `) }} />
          </Popup>
        </Marker>
      ))}

      {/* User location + buffer */}
      {userCoords && (
        <>
          <Marker position={userCoords} icon={userIcon}>
            <Popup>
              <div dangerouslySetInnerHTML={{ __html: inlinePopup(`
                <p style="font-weight:700;text-align:center;margin:0">📍 Your location</p>
              `) }} />
            </Popup>
          </Marker>
        </>
      )}

      {/* Dropped pin */}
      {droppedPin && (
        <Marker position={droppedPin} icon={droppedPinIcon} ref={droppedMarkerRef}>
          <Popup minWidth={240} maxWidth={300}>
            <div style={{ minWidth: 230, fontFamily: "system-ui,sans-serif", padding: 4 }}>
              <p style={{ fontWeight: 700, fontSize: 14, margin: "0 0 10px" }}>📍 Dropped pin</p>
              {droppedPinSafety && (
                <div style={{ background: droppedPinSafety.color, borderRadius: 12, padding: "10px 14px", textAlign: "center", marginBottom: 10 }}>
                  <p style={{ color: "white", fontWeight: 800, fontSize: 24, margin: 0 }}>
                    {droppedPinPm25 !== null ? pm25ToAqi(droppedPinPm25) : "—"}
                  </p>
                  <p style={{ color: "rgba(255,255,255,0.85)", fontWeight: 600, fontSize: 11, margin: "2px 0 1px" }}>
                    US AQI · {droppedPinSafety.emoji} {droppedPinSafety.level}
                  </p>
                  {droppedPinPm25 !== null && (
                    <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 10, margin: "0 0 2px" }}>
                      PM2.5 {Math.round(droppedPinPm25)} µg/m³
                    </p>
                  )}
                  <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, margin: 0 }}>
                    {droppedPinSafety.message}
                  </p>
                </div>
              )}
              {/* IDW metadata */}
              {droppedPinMeta && (
                <div style={{ background: "#f3f4f6", borderRadius: 8, padding: "8px 10px", marginBottom: 10, fontSize: 11, color: "#6b7280" }}>
                  <p style={{ margin: "0 0 3px", fontWeight: 600, color: "#374151" }}>📐 IDW interpolation</p>
                  <p style={{ margin: "0 0 2px" }}>Stations used: <strong>{droppedPinMeta.stationsUsed}</strong> (within 15 km)</p>
                  <p style={{ margin: "0 0 2px" }}>Nearest: <strong>{droppedPinMeta.nearestStation}</strong></p>
                  <p style={{ margin: 0 }}>Distance to nearest: <strong>{droppedPinMeta.nearestDistM < 1000 ? `${droppedPinMeta.nearestDistM} m` : `${(droppedPinMeta.nearestDistM / 1000).toFixed(1)} km`}</strong></p>
                </div>
              )}
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${droppedPin[0]},${droppedPin[1]}`}
                target="_blank" rel="noopener noreferrer"
                style={{ display: "block", background: "#2563eb", color: "white", borderRadius: 10, padding: "8px 12px", textAlign: "center", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
              >
                🗺️ Get directions
              </a>
            </div>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
